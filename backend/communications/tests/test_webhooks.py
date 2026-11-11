import base64
import hashlib
import json
import unittest

from communications.services.livekit_service import LiveKitTokenBuilder, LiveKitWebhookVerifier
from communications.webhooks.livekit_webhook import LiveKitWebhookHandler


class TestLiveKitWebhook(unittest.TestCase):
    def setUp(self):
        self.api_key = "test_key"
        self.api_secret = "test_secret_for_hmac_signing_123"
        self.verifier = LiveKitWebhookVerifier(self.api_key, self.api_secret)
        self.handler = LiveKitWebhookHandler()
        self.handler.verifier = self.verifier

    def _create_signed_header(self, body_bytes: bytes) -> str:
        sha = hashlib.sha256(body_bytes).digest()
        sha_b64 = base64.b64encode(sha).decode("utf-8")

        builder = LiveKitTokenBuilder(self.api_key, self.api_secret)
        # Create token with sha256 claim
        token = builder.create_token(
            identity="livekit-server",
            name="LiveKit",
            room_name="test",
            metadata={"sha256": sha_b64},
        )
        # Inject sha256 into claims for LiveKit webhook verification standard
        header_b64, payload_b64, _ = token.split(".")
        payload = json.loads(builder._base64url_decode(payload_b64).decode("utf-8"))
        payload["sha256"] = sha_b64
        new_payload_b64 = builder._base64url_encode(json.dumps(payload).encode("utf-8"))
        signing_input = f"{header_b64}.{new_payload_b64}".encode("utf-8")
        import hmac
        sig = builder._base64url_encode(hmac.new(self.api_secret.encode("utf-8"), signing_input, hashlib.sha256).digest())
        return f"{header_b64}.{new_payload_b64}.{sig}"

    def test_signature_verification_succeeds_with_valid_token(self):
        body = json.dumps({"event": "participant_joined", "room": {"name": "rm_orzo_123"}}).encode("utf-8")
        header = self._create_signed_header(body)

        is_valid = self.verifier.verify(header, body)
        self.assertTrue(is_valid)

    def test_invalid_signature_is_rejected(self):
        body = b'{"event": "room_finished"}'
        fake_header = "invalid.bearer.signature"

        is_valid = self.verifier.verify(fake_header, body)
        self.assertFalse(is_valid)

        success, msg, code = self.handler.process_webhook(fake_header, body)
        self.assertFalse(success)
        self.assertEqual(code, 401)

    def test_body_tampering_fails_verification(self):
        body = b'{"event": "room_finished", "room": {"name": "rm_1"}}'
        header = self._create_signed_header(body)

        # Alter body
        tampered_body = b'{"event": "room_finished", "room": {"name": "rm_tampered"}}'
        is_valid = self.verifier.verify(header, tampered_body)
        self.assertFalse(is_valid)


if __name__ == "__main__":
    unittest.main()
