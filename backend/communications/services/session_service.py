import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from django.db import transaction
from django.utils import timezone

from api.models import Account, InterpretationRequest
from communications.models import InterpretationSession, SessionEvent, SessionParticipant
from .room_service import RoomService

logger = logging.getLogger(__name__)


class SessionLifecycleException(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class SessionService:
    """Manages the full lifecycle of interpretation sessions in PostgreSQL.

    Ensures atomic transitions, prevents duplicate active sessions, enforces server-authoritative
    duration calculations, and records an append-only audit trail in SessionEvent.
    """

    @classmethod
    @transaction.atomic
    def create_or_activate_session(
        cls,
        request_reference: str,
        customer_id: str,
        customer_name: str,
        interpreter_id: Optional[str] = None,
        interpreter_name: Optional[str] = None,
        communication_mode: str = "audio",
        source_language: str = "",
        target_language: str = "",
        scheduled_start_time: Optional[datetime] = None,
        created_by: str = "",
    ) -> InterpretationSession:
        """Create or activate an authorized LiveKit-integrated session for an interpretation request."""

        # Fetch underlying InterpretationRequest if exists
        interp_req = InterpretationRequest.objects.filter(reference=request_reference).first()
        customer_acc = Account.objects.filter(pk=customer_id).first()
        interpreter_acc = Account.objects.filter(pk=interpreter_id).first() if interpreter_id else None

        if interp_req:
            source_language = source_language or interp_req.source_language
            target_language = target_language or interp_req.target_language
            customer_name = customer_name or interp_req.requester_name

        # Prevent duplicate active sessions for the same request
        existing = InterpretationSession.objects.filter(
            request_reference=request_reference,
            status__in=[
                InterpretationSession.STATUS_PENDING,
                InterpretationSession.STATUS_READY,
                InterpretationSession.STATUS_ACTIVE,
            ],
        ).first()

        if existing:
            logger.info("Found existing active session %s for request %s", existing.session_reference, request_reference)
            # Update interpreter if newly assigned
            if interpreter_id and not existing.interpreter_id:
                existing.interpreter_id = interpreter_id
                existing.interpreter_name = interpreter_name or (interpreter_acc.full_name if interpreter_acc else "Assigned Interpreter")
                existing.interpreter_account = interpreter_acc
                existing.save(update_fields=["interpreter_id", "interpreter_name", "interpreter", "updated_at"])

                # Authorize interpreter participant
                SessionParticipant.objects.get_or_create(
                    session=existing,
                    user_id=interpreter_id,
                    defaults={
                        "user": interpreter_acc,
                        "user_name": existing.interpreter_name,
                        "role": SessionParticipant.ROLE_INTERPRETER,
                        "connection_status": SessionParticipant.STATUS_AUTHORIZED,
                    },
                )
                SessionEvent.objects.create(
                    session=existing,
                    event_type=SessionEvent.EVENT_INTERPRETER_ASSIGNED,
                    description=f"Interpreter {existing.interpreter_name} assigned to session.",
                    actor_account=interpreter_acc,
                    actor_id=interpreter_id,
                    metadata={"interpreterId": interpreter_id},
                )
            return existing

        # Generate unique room name and session reference
        room_name = RoomService.generate_room_name()
        RoomService.create_room(room_name)

        session_uuid = uuid.uuid4()
        session_reference = f"SES-{datetime.now().year}-{session_uuid.hex[:6].upper()}"

        session = InterpretationSession.objects.create(
            id=session_uuid,
            session_reference=session_reference,
            request=interp_req,
            request_reference=request_reference,
            customer_account=customer_acc,
            customer_id=customer_id,
            customer_name=customer_name,
            interpreter_account=interpreter_acc,
            interpreter_id=interpreter_id,
            interpreter_name=interpreter_name or (interpreter_acc.full_name if interpreter_acc else ""),
            room_name=room_name,
            communication_type=communication_mode,
            status=InterpretationSession.STATUS_READY,
            source_language=source_language,
            target_language=target_language,
            scheduled_start_time=scheduled_start_time,
            created_by=created_by or customer_id,
        )

        # Authorize Customer
        SessionParticipant.objects.create(
            session=session,
            user_account=customer_acc,
            user_id=customer_id,
            user_name=customer_name,
            role=SessionParticipant.ROLE_CUSTOMER,
            connection_status=SessionParticipant.STATUS_AUTHORIZED,
        )

        # Authorize Interpreter if assigned
        if interpreter_id:
            SessionParticipant.objects.create(
                session=session,
                user_account=interpreter_acc,
                user_id=interpreter_id,
                user_name=session.interpreter_name,
                role=SessionParticipant.ROLE_INTERPRETER,
                connection_status=SessionParticipant.STATUS_AUTHORIZED,
            )

        # Log session creation events
        SessionEvent.objects.create(
            session=session,
            event_type=SessionEvent.EVENT_SESSION_CREATED,
            description=f"Interpretation session {session_reference} created for request {request_reference}.",
            actor_account=customer_acc,
            actor_id=created_by or customer_id,
            metadata={
                "requestReference": request_reference,
                "mode": communication_mode,
                "sourceLanguage": source_language,
                "targetLanguage": target_language,
            },
        )
        SessionEvent.objects.create(
            session=session,
            event_type=SessionEvent.EVENT_ROOM_CREATED,
            description=f"LiveKit room {room_name} allocated.",
            actor_id="system",
            metadata={"roomName": room_name},
        )

        if interpreter_id:
            SessionEvent.objects.create(
                session=session,
                event_type=SessionEvent.EVENT_INTERPRETER_ASSIGNED,
                description=f"Interpreter {session.interpreter_name} assigned.",
                actor_account=interpreter_acc,
                actor_id=interpreter_id,
                metadata={"interpreterId": interpreter_id},
            )

        # Update InterpretationRequest status if present
        if interp_req:
            interp_req.active_session_id = session_reference
            interp_req.status = "in_session"
            interp_req.save(update_fields=["active_session_id", "status", "updated_at"])

        logger.info("Created InterpretationSession %s (room=%s)", session.session_reference, room_name)
        return session

    @classmethod
    @transaction.atomic
    def start_session(cls, session: InterpretationSession) -> InterpretationSession:
        """Mark session ACTIVE once participants have joined."""
        if session.status in (InterpretationSession.STATUS_COMPLETED, InterpretationSession.STATUS_CANCELLED, InterpretationSession.STATUS_FAILED):
            raise SessionLifecycleException(f"Cannot start session in '{session.status}' state.", status_code=409)

        if session.status != InterpretationSession.STATUS_ACTIVE:
            session.status = InterpretationSession.STATUS_ACTIVE
            if not session.actual_start_time or not hasattr(session.actual_start_time, "isoformat"):
                session.actual_start_time = timezone.now()
            session.save(update_fields=["status", "actual_start_time", "updated_at"])

            SessionEvent.objects.create(
                session=session,
                event_type=SessionEvent.EVENT_CALL_STARTED,
                description="Live call started between customer and interpreter.",
                timestamp=session.actual_start_time,
                metadata={"actualStartTime": session.actual_start_time.isoformat() if hasattr(session.actual_start_time, "isoformat") else str(session.actual_start_time)},
            )
            SessionEvent.objects.create(
                session=session,
                event_type=SessionEvent.EVENT_SESSION_STARTED,
                description="Session status changed to ACTIVE.",
                timestamp=session.actual_start_time,
            )
            logger.info("Session %s transitioned to ACTIVE", session.session_reference)
        return session

    @classmethod
    @transaction.atomic
    def end_session(
        cls,
        session: InterpretationSession,
        user_id: str,
        reason: str = "Completed by user",
        completion_notes: str = "",
    ) -> InterpretationSession:
        """Complete an interpretation session and compute server-authoritative duration."""
        if session.status in (InterpretationSession.STATUS_COMPLETED, InterpretationSession.STATUS_CANCELLED):
            return session

        now = timezone.now()
        session.status = InterpretationSession.STATUS_COMPLETED
        session.actual_end_time = now
        if completion_notes:
            session.completion_notes = completion_notes

        # Calculate duration using server-side timestamps strictly (anti-tampering)
        if session.actual_start_time:
            delta = (now - session.actual_start_time).total_seconds()
            session.duration_seconds = max(1, int(delta))
        else:
            session.duration_seconds = 0

        session.save(update_fields=["status", "actual_end_time", "duration_seconds", "completion_notes", "updated_at"])

        # Release interpreter and close room on LiveKit
        RoomService.close_room(session.room_name)

        actor_acc = Account.objects.filter(pk=user_id).first()

        SessionEvent.objects.create(
            session=session,
            event_type=SessionEvent.EVENT_SESSION_COMPLETED,
            description=f"Session completed. Duration: {session.duration_seconds}s.",
            actor_account=actor_acc,
            actor_id=user_id,
            metadata={
                "reason": reason,
                "durationSeconds": session.duration_seconds,
                "completionNotes": completion_notes,
            },
        )
        SessionEvent.objects.create(
            session=session,
            event_type=SessionEvent.EVENT_ROOM_CLOSED,
            description=f"LiveKit room {session.room_name} terminated.",
            actor_id="system",
            metadata={"roomName": session.room_name},
        )

        # Update related InterpretationRequest if linked
        if session.request:
            session.request.status = "completed"
            session.request.save(update_fields=["status", "updated_at"])

        logger.info("Session %s completed (duration=%ds)", session.session_reference, session.duration_seconds)
        return session

    @classmethod
    @transaction.atomic
    def cancel_session(
        cls, session: InterpretationSession, user_id: str, reason: str = "Cancelled by user"
    ) -> InterpretationSession:
        """Cancel an eligible interpretation session."""
        if session.status == InterpretationSession.STATUS_COMPLETED:
            raise SessionLifecycleException("Cannot cancel an already completed session.", status_code=400)
        if session.status == InterpretationSession.STATUS_CANCELLED:
            return session

        now = timezone.now()
        session.status = InterpretationSession.STATUS_CANCELLED
        session.actual_end_time = now
        session.cancellation_reason = reason
        session.save(update_fields=["status", "actual_end_time", "cancellation_reason", "updated_at"])

        RoomService.close_room(session.room_name)

        actor_acc = Account.objects.filter(pk=user_id).first()

        SessionEvent.objects.create(
            session=session,
            event_type=SessionEvent.EVENT_SESSION_CANCELLED,
            description=f"Session cancelled by {user_id}. Reason: {reason}",
            actor_account=actor_acc,
            actor_id=user_id,
            metadata={"reason": reason},
        )

        # Update request if linked
        if session.request:
            session.request.status = "cancelled"
            session.request.cancellation_reason = reason
            session.request.save(update_fields=["status", "cancellation_reason", "updated_at"])

        logger.info("Session %s cancelled by %s (reason: %s)", session.session_reference, user_id, reason)
        return session
