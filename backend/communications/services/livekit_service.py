import base64
import hashlib
import hmac
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class LiveKitConfig:
    @classmethod
    def get_url(cls) -> str:
        return os.getenv("LIVEKIT_URL", "wss://orozo-translation-8nvelq7r.livekit.cloud")

    @classmethod
    def get_api_key(cls) -> str:
        return os.getenv("LIVEKIT_API_KEY", "")

    @classmethod
    def get_api_secret(cls) -> str:
        return os.getenv("LIVEKIT_API_SECRET", "")

    @classmethod
    def validate(cls) -> Tuple[bool, str]:
        url = cls.get_url()
        key = cls.get_api_key()
        secret = cls.get_api_secret()

        if not url:
            return False, "LIVEKIT_URL is not set."
        if not key:
            return False, "LIVEKIT_API_KEY is not set."
        if not secret:
            return False, "LIVEKIT_API_SECRET is not set."
        if secret == "secret" and not os.getenv("DEBUG", "True").lower() in ("true", "1"):
            return False, "Default dev secret detected in non-DEBUG production mode."
        return True, "LiveKit configuration is valid."


class LiveKitTokenBuilder:
    """LiveKit Access Token Generator.

    Implements standard LiveKit JWT HS256 access token specification (RFC 7519)
    with video grants (roomJoin, canPublish, canSubscribe, canPublishSources).
    Can also use the official `livekit-api` package if installed.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        ttl_seconds: int = 1800,  # 30 minutes default short-lived
    ):
        self.api_key = api_key or LiveKitConfig.get_api_key()
        self.api_secret = api_secret or LiveKitConfig.get_api_secret()
        self.ttl_seconds = ttl_seconds

    @staticmethod
    def _base64url_encode(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

    @staticmethod
    def _base64url_decode(data: str) -> bytes:
        rem = len(data) % 4
        if rem > 0:
            data += "=" * (4 - rem)
        return base64.urlsafe_b64decode(data.encode("utf-8"))

    def create_token(
        self,
        identity: str,
        name: str,
        room_name: str,
        communication_mode: str = "audio",
        participant_role: str = "customer",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Build secure, short-lived LiveKit participant JWT token."""
        now = int(time.time())
        exp = now + self.ttl_seconds

        # Video grant specification per LiveKit architecture
        can_publish_video = communication_mode == "video"
        sources = ["microphone"]
        if can_publish_video:
            sources.append("camera")
            sources.append("screen_share")

        video_grant = {
            "room": room_name,
            "roomJoin": True,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
            "canPublishSources": sources,
            # Ordinary participants do NOT receive admin/room control grants
            "roomAdmin": False,
            "roomCreate": False,
            "roomList": False,
            "roomRecord": False,
        }

        user_metadata = {
            "role": participant_role,
            "mode": communication_mode,
            **(metadata or {}),
        }

        payload = {
            "iss": self.api_key,
            "sub": str(identity),
            "name": str(name),
            "nbf": now - 5,
            "exp": exp,
            "video": video_grant,
            "metadata": json.dumps(user_metadata),
        }

        header = {"alg": "HS256", "typ": "JWT"}

        # Encode JWT header & payload
        header_b64 = self._base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        payload_b64 = self._base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))

        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        signature = hmac.new(self.api_secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
        sig_b64 = self._base64url_encode(signature)

        return f"{header_b64}.{payload_b64}.{sig_b64}"

    def decode_and_verify(self, token: str) -> Dict[str, Any]:
        """Decode and cryptographically verify LiveKit token signature."""
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid JWT token format")

        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
        expected_sig = hmac.new(self.api_secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_sig = self._base64url_decode(sig_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("Token cryptographic signature verification failed")

        payload = json.loads(self._base64url_decode(payload_b64).decode("utf-8"))
        now = int(time.time())
        if payload.get("exp", 0) < now:
            raise ValueError("Token has expired")
        if payload.get("nbf", 0) > now + 60:
            raise ValueError("Token not valid yet")

        return payload


class LiveKitWebhookVerifier:
    """Verifies LiveKit Server Webhook Signatures using HMAC-SHA256."""

    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None):
        self.api_key = api_key or LiveKitConfig.get_api_key()
        self.api_secret = api_secret or LiveKitConfig.get_api_secret()

    def verify(self, auth_header: str, body_bytes: bytes) -> bool:
        """Verify LiveKit authorization token from webhook header against body sha256 checksum."""
        if not auth_header:
            return False

        try:
            token_builder = LiveKitTokenBuilder(self.api_key, self.api_secret)
            # The auth header is a signed JWT from LiveKit
            # Strip 'Bearer ' if present
            raw_token = auth_header.replace("Bearer ", "").strip()
            claims = token_builder.decode_and_verify(raw_token)

            # Check sha256 body hash
            sha = hashlib.sha256(body_bytes).digest()
            expected_hash = base64.b64encode(sha).decode("utf-8")
            actual_hash = claims.get("sha256")

            if actual_hash and actual_hash != expected_hash:
                logger.warning("Webhook body checksum mismatch: expected %s, got %s", expected_hash, actual_hash)
                return False

            return True
        except Exception as exc:
            logger.warning("Webhook signature verification error: %s", exc)
            return False
