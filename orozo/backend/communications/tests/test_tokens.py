import time
import unittest
from communications.services.livekit_service import LiveKitTokenBuilder


class TestTokenService(unittest.TestCase):
    def setUp(self):
        self.api_key = "test_key"
        self.api_secret = "test_secret_for_hmac_signing_123"
        self.builder = LiveKitTokenBuilder(
            api_key=self.api_key,
            api_secret=self.api_secret,
            ttl_seconds=600,
        )

    def test_token_creation_and_verification(self):
        token = self.builder.create_token(
            identity="usr-client-01",
            name="Abebe Bikila",
            room_name="rm_orzo_room123",
            communication_mode="audio",
            participant_role="customer",
        )

        self.assertIsInstance(token, str)
        self.assertEqual(len(token.split(".")), 3)

        # Decode and verify signature
        claims = self.builder.decode_and_verify(token)
        self.assertEqual(claims["sub"], "usr-client-01")
        self.assertEqual(claims["name"], "Abebe Bikila")
        self.assertEqual(claims["iss"], self.api_key)

        video_grant = claims.get("video", {})
        self.assertEqual(video_grant["room"], "rm_orzo_room123")
        self.assertTrue(video_grant["roomJoin"])
        self.assertTrue(video_grant["canPublish"])
        self.assertTrue(video_grant["canSubscribe"])
        self.assertFalse(video_grant["roomAdmin"])

        # In audio mode, camera is not in publish sources
        self.assertEqual(video_grant["canPublishSources"], ["microphone"])

    def test_video_mode_grants_camera(self):
        token = self.builder.create_token(
            identity="usr-interp-01",
            name="Chaltu Kebede",
            room_name="rm_orzo_room123",
            communication_mode="video",
            participant_role="interpreter",
        )

        claims = self.builder.decode_and_verify(token)
        video_grant = claims.get("video", {})
        self.assertIn("camera", video_grant["canPublishSources"])
        self.assertIn("microphone", video_grant["canPublishSources"])

    def test_tampered_token_rejected(self):
        token = self.builder.create_token(
            identity="usr-client-01",
            name="Abebe Bikila",
            room_name="rm_orzo_room123",
        )
        parts = token.split(".")
        # Tamper payload
        tampered_token = f"{parts[0]}.eyJuYW1lIjoiSGFja2VyIn0.{parts[2]}"

        with self.assertRaises(ValueError):
            self.builder.decode_and_verify(tampered_token)

    def test_expired_token_rejected(self):
        short_builder = LiveKitTokenBuilder(
            api_key=self.api_key,
            api_secret=self.api_secret,
            ttl_seconds=-10,  # Expired in past
        )
        token = short_builder.create_token(
            identity="usr-client-01",
            name="Abebe Bikila",
            room_name="rm_orzo_room123",
        )

        with self.assertRaises(ValueError):
            short_builder.decode_and_verify(token)

    def test_token_service_nine_step_verification(self):
        from communications.models import CommunicationSession, SessionParticipant
        from communications.services.token_service import TokenSecurityException, TokenService

        session = CommunicationSession(
            session_id="SES-CHECK-9",
            request_reference="REQ-VALID-01",
            room_name="rm_orzo_check",
            communication_mode="audio",
            status=CommunicationSession.STATUS_READY,
        )

        service = TokenService(token_ttl_seconds=900)

        # 1. Unauthenticated / missing user_id
        with self.assertRaises(TokenSecurityException) as ctx:
            service.generate_participant_token(session, user_id="", user_name="Guest", user_role="customer")
        self.assertEqual(ctx.exception.status_code, 401)

        # 2. Missing or unlinked session
        broken_session = CommunicationSession(session_id="", request_reference="")
        with self.assertRaises(TokenSecurityException) as ctx:
            service.generate_participant_token(broken_session, user_id="u1", user_name="Abebe", user_role="customer")
        self.assertEqual(ctx.exception.status_code, 404)

        # 3. Completed session cannot issue tokens
        completed_session = CommunicationSession(
            session_id="SES-COMP",
            request_reference="REQ-1",
            room_name="rm_orzo_comp",
            status=CommunicationSession.STATUS_COMPLETED,
        )
        with self.assertRaises(TokenSecurityException) as ctx:
            service.generate_participant_token(
                completed_session, user_id="admin-01", user_name="Admin", user_role="supervisor"
            )
        self.assertEqual(ctx.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
