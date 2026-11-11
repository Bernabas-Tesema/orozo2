import json
import logging
from typing import Any, Dict, Tuple

from communications.models import CommunicationSession, SessionEvent
from communications.services.livekit_service import LiveKitWebhookVerifier
from communications.services.participant_service import ParticipantService
from communications.services.session_service import SessionService

logger = logging.getLogger(__name__)


class LiveKitWebhookHandler:
    """Processes incoming LiveKit Webhooks securely with HMAC-SHA256 signature verification."""

    def __init__(self):
        self.verifier = LiveKitWebhookVerifier()

    def process_webhook(self, auth_header: str, body_bytes: bytes) -> Tuple[bool, str, int]:
        # 1. Verify signature
        if not self.verifier.verify(auth_header, body_bytes):
            logger.warning("Rejected LiveKit webhook: invalid signature or authorization header.")
            return False, "Invalid webhook authorization signature", 401

        # 2. Parse payload
        try:
            payload = json.loads(body_bytes.decode("utf-8"))
        except Exception as exc:
            logger.error("Failed to parse LiveKit webhook JSON: %s", exc)
            return False, "Malformed JSON payload", 400

        event_name = payload.get("event")
        room_info = payload.get("room") or {}
        room_name = room_info.get("name") or payload.get("room_name")
        participant_info = payload.get("participant") or {}
        participant_id = participant_info.get("identity")

        if not room_name:
            return True, "Acknowledged (no room target)", 200

        # Look up session by room name
        session = CommunicationSession.objects.filter(room_name=room_name).first()
        if not session:
            logger.info("Webhook event %s for non-tracked or archived room: %s", event_name, room_name)
            return True, "Room not tracked in active database", 200

        # Idempotent Event Dispatching
        try:
            if event_name == "room_started":
                # Ensure session is marked active
                SessionService.start_session(session)

            elif event_name == "room_finished":
                # Complete session if not already completed
                SessionService.end_session(session, user_id="livekit_webhook", reason="LiveKit room finished")

            elif event_name == "participant_joined" and participant_id:
                ParticipantService.record_join(session, participant_id)

            elif event_name in ("participant_left",) and participant_id:
                ParticipantService.record_leave(session, participant_id)

            elif event_name in ("participant_disconnected", "participant_connection_aborted") and participant_id:
                ParticipantService.record_disconnect(session, participant_id)

            elif event_name == "track_published" and participant_id:
                track_info = payload.get("track") or {}
                SessionEvent.objects.create(
                    session=session,
                    event_type=SessionEvent.EVENT_TRACK_PUBLISHED,
                    participant_id=participant_id,
                    metadata={
                        "trackSource": track_info.get("source"),
                        "trackType": track_info.get("type"),
                        "trackSid": track_info.get("sid"),
                    },
                )

            elif event_name == "track_unpublished" and participant_id:
                track_info = payload.get("track") or {}
                SessionEvent.objects.create(
                    session=session,
                    event_type=SessionEvent.EVENT_TRACK_UNPUBLISHED,
                    participant_id=participant_id,
                    metadata={"trackSid": track_info.get("sid")},
                )

            else:
                logger.debug("Received unhandled LiveKit event: %s", event_name)

        except Exception as exc:
            logger.error("Error processing event %s on session %s: %s", event_name, session.session_id, exc)
            return False, "Error processing event", 500

        return True, "Event processed successfully", 200
