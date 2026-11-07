import logging
from typing import Optional

from django.utils import timezone

from api.models import Account
from communications.models import InterpretationSession, SessionEvent, SessionParticipant
from .session_service import SessionService

logger = logging.getLogger(__name__)


class ParticipantService:
    """Manages participant presence, joins, leaves, disconnections, and reconnects in PostgreSQL.

    Supports multiple join/leave intervals without overwriting historical participation records.
    """

    @classmethod
    def record_join(cls, session: InterpretationSession, user_id: str, device_type: str = "web") -> SessionParticipant:
        now = timezone.now()
        account = Account.objects.filter(pk=user_id).first()

        # Check existing authorization or participation
        base_participant = SessionParticipant.objects.filter(session=session, user_id=user_id).first()
        if not base_participant:
            # Determine role from session or account
            role = SessionParticipant.ROLE_CUSTOMER
            if session.interpreter_id == user_id or (account and account.role == "interpreter"):
                role = SessionParticipant.ROLE_INTERPRETER
            elif account and account.role in ("supervisor", "platform_admin"):
                role = SessionParticipant.ROLE_COORDINATOR

            user_name = account.full_name if account else (session.customer_name if role == SessionParticipant.ROLE_CUSTOMER else "Participant")
        else:
            role = base_participant.role
            user_name = base_participant.user_name

        # Support multiple join/leave intervals:
        # Check if there's already an active (open) record with no leave_timestamp
        open_record = SessionParticipant.objects.filter(
            session=session,
            user_id=user_id,
            leave_timestamp__isnull=True,
            connection_status=SessionParticipant.STATUS_JOINED,
        ).first()

        if open_record:
            participant = open_record
        else:
            # Create a new historical participation interval record
            participant = SessionParticipant.objects.create(
                session=session,
                user_account=account,
                user_id=user_id,
                user_name=user_name,
                role=role,
                connection_status=SessionParticipant.STATUS_JOINED,
                join_timestamp=now,
                activity_info={"deviceType": device_type, "clientJoinedAt": now.isoformat()},
            )

        # Log specialized append-only events
        specific_event = (
            SessionEvent.EVENT_CUSTOMER_JOINED
            if role == SessionParticipant.ROLE_CUSTOMER
            else SessionEvent.EVENT_INTERPRETER_JOINED
            if role == SessionParticipant.ROLE_INTERPRETER
            else SessionEvent.EVENT_PARTICIPANT_JOINED
        )

        SessionEvent.objects.create(
            session=session,
            event_type=specific_event,
            description=f"{user_name} ({role}) joined session.",
            actor_account=account,
            actor_id=user_id,
            metadata={"role": role, "deviceType": device_type},
        )

        # Transition session to ACTIVE if both customer and interpreter are joined
        joined_roles = set(
            SessionParticipant.objects.filter(
                session=session, connection_status=SessionParticipant.STATUS_JOINED
            ).values_list("role", flat=True)
        )

        if (
            SessionParticipant.ROLE_CUSTOMER in joined_roles
            and SessionParticipant.ROLE_INTERPRETER in joined_roles
        ):
            SessionService.start_session(session)

        return participant

    @classmethod
    def record_leave(cls, session: InterpretationSession, user_id: str, reason: str = "User left call") -> Optional[SessionParticipant]:
        now = timezone.now()
        account = Account.objects.filter(pk=user_id).first()

        # Find open participation interval
        participant = SessionParticipant.objects.filter(
            session=session, user_id=user_id, leave_timestamp__isnull=True
        ).last()

        if not participant:
            participant = SessionParticipant.objects.filter(session=session, user_id=user_id).last()

        if participant:
            participant.connection_status = SessionParticipant.STATUS_LEFT
            participant.leave_timestamp = now
            participant.save(update_fields=["connection_status", "leave_timestamp"])

        user_name = participant.user_name if participant else user_id
        role = participant.role if participant else "participant"

        SessionEvent.objects.create(
            session=session,
            event_type=SessionEvent.EVENT_PARTICIPANT_LEFT,
            description=f"{user_name} left session.",
            actor_account=account,
            actor_id=user_id,
            metadata={"role": role, "reason": reason},
        )
        return participant

    @classmethod
    def record_disconnect(cls, session: InterpretationSession, user_id: str) -> Optional[SessionParticipant]:
        """Record participant disconnection without ending the session prematurely.

        Maintains room session integrity across temporary mobile / WebRTC network dropouts.
        """
        account = Account.objects.filter(pk=user_id).first()
        participant = SessionParticipant.objects.filter(
            session=session, user_id=user_id, leave_timestamp__isnull=True
        ).last()

        if participant:
            participant.connection_status = SessionParticipant.STATUS_DISCONNECTED
            participant.save(update_fields=["connection_status"])

        user_name = participant.user_name if participant else user_id
        SessionEvent.objects.create(
            session=session,
            event_type=SessionEvent.EVENT_PARTICIPANT_DISCONNECTED,
            description=f"{user_name} disconnected temporarily.",
            actor_account=account,
            actor_id=user_id,
            metadata={"role": participant.role if participant else "participant"},
        )
        return participant

    @classmethod
    def record_reconnect(cls, session: InterpretationSession, user_id: str) -> Optional[SessionParticipant]:
        account = Account.objects.filter(pk=user_id).first()
        participant = SessionParticipant.objects.filter(
            session=session, user_id=user_id
        ).last()

        if participant:
            participant.connection_status = SessionParticipant.STATUS_JOINED
            participant.save(update_fields=["connection_status"])

        user_name = participant.user_name if participant else user_id
        SessionEvent.objects.create(
            session=session,
            event_type=SessionEvent.EVENT_PARTICIPANT_RECONNECTED,
            description=f"{user_name} reconnected successfully.",
            actor_account=account,
            actor_id=user_id,
            metadata={"role": participant.role if participant else "participant"},
        )
        return participant
