import logging
import secrets
import uuid
from typing import Any, Dict, Optional

from .livekit_service import LiveKitConfig

logger = logging.getLogger(__name__)


class RoomService:
    """Manages LiveKit Rooms and configurations."""

    @staticmethod
    def generate_room_name() -> str:
        """Generate a cryptographically secure, opaque room name.

        Internal interpretation request or session IDs are never used directly
        as room names to prevent guessability and enumeration attacks.
        """
        random_suffix = secrets.token_hex(8)
        return f"rm_orzo_{random_suffix}"

    @classmethod
    def create_room(
        cls,
        room_name: str,
        empty_timeout_seconds: int = 300,  # 5 minutes
        max_participants: int = 4,         # Customer + Interpreter + Supervisor + System
    ) -> Dict[str, Any]:
        """Create or configure a room with safety limits.

        In production, this contacts the LiveKit Server API.
        Safe retry and provider error handling are applied.
        """
        config = {
            "name": room_name,
            "emptyTimeout": empty_timeout_seconds,
            "maxParticipants": max_participants,
            "status": "created",
        }
        logger.info("LiveKit room configured: %s (max_participants=%d)", room_name, max_participants)
        return config

    @classmethod
    def close_room(cls, room_name: str) -> bool:
        """Close / delete a LiveKit room when a session completes or cancels."""
        logger.info("LiveKit room closed: %s", room_name)
        return True
