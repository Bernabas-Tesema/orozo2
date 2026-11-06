import unittest
import uuid
from datetime import timedelta

from django.utils import timezone

from api.models import Account
from communications.models import (
    CommunicationSession,
    InterpretationSession,
    SessionEvent,
    SessionParticipant,
)
from communications.permissions import check_session_permission
from communications.services.participant_service import ParticipantService
from communications.services.session_service import SessionLifecycleException, SessionService
from communications.services.statistics_service import SessionStatisticsService


class TestSessionLifecycle(unittest.TestCase):
    def setUp(self):
        self.session_id = uuid.uuid4()
        self.session = InterpretationSession(
            id=self.session_id,
            session_reference="SES-2026-TEST01",
            request_reference="REQ-TEST-100",
            customer_id="cust-01",
            customer_name="Abebe Bikila",
            interpreter_id="int-01",
            interpreter_name="Chaltu Kebede",
            room_name="rm_orzo_test_room",
            communication_type="video",
            status=InterpretationSession.STATUS_READY,
            source_language="om",
            target_language="am",
        )

    def test_duration_calculation_server_authoritative(self):
        start = timezone.now()
        end = start + timedelta(minutes=14, seconds=35)

        self.session.actual_start_time = start
        self.session.actual_end_time = end
        self.session.status = InterpretationSession.STATUS_COMPLETED

        duration = self.session.calculate_duration()
        self.assertEqual(duration, 14 * 60 + 35)

    def test_status_choices(self):
        valid_statuses = [
            InterpretationSession.STATUS_PENDING,
            InterpretationSession.STATUS_READY,
            InterpretationSession.STATUS_ACTIVE,
            InterpretationSession.STATUS_COMPLETED,
            InterpretationSession.STATUS_CANCELLED,
            InterpretationSession.STATUS_FAILED,
        ]
        self.assertEqual(len(valid_statuses), 6)

    def test_role_based_permissions(self):
        customer = Account(id="cust-01", role="client", full_name="Abebe Bikila")
        interpreter = Account(id="int-01", role="interpreter", full_name="Chaltu Kebede")
        stranger = Account(id="cust-99", role="client", full_name="Unauthorized User")
        admin = Account(id="admin-01", role="platform_admin", full_name="System Admin")

        # Customer allowed
        allowed, msg = check_session_permission(self.session, customer)
        self.assertTrue(allowed)

        # Interpreter allowed
        allowed, msg = check_session_permission(self.session, interpreter)
        self.assertTrue(allowed)

        # Admin allowed
        allowed, msg = check_session_permission(self.session, admin)
        self.assertTrue(allowed)

        # Stranger denied
        allowed, msg = check_session_permission(self.session, stranger)
        self.assertFalse(allowed)

    def test_append_only_event_history(self):
        event = SessionEvent(
            session=self.session,
            event_type=SessionEvent.EVENT_SESSION_CREATED,
            description="Initial creation",
            actor_id="cust-01",
        )
        self.assertEqual(event.event_type, SessionEvent.EVENT_SESSION_CREATED)

        # Attempting to delete or update in append-only system raises ValueError
        with self.assertRaises(ValueError):
            event.delete()

    def test_session_lifecycle_transitions(self):
        # Start session
        active_session = SessionService.start_session(self.session)
        self.assertEqual(active_session.status, InterpretationSession.STATUS_ACTIVE)
        self.assertIsNotNone(active_session.actual_start_time)

        # End session
        completed = SessionService.end_session(self.session, user_id="cust-01", completion_notes="Successful consult")
        self.assertEqual(completed.status, InterpretationSession.STATUS_COMPLETED)
        self.assertEqual(completed.completion_notes, "Successful consult")

        # Cannot cancel an already completed session
        with self.assertRaises(SessionLifecycleException):
            SessionService.cancel_session(self.session, user_id="cust-01")

    def test_statistics_aggregation(self):
        stats = SessionStatisticsService.get_statistics()
        self.assertIn("summary", stats)
        self.assertIn("totalSessions", stats["summary"])
        self.assertIn("byInterpreter", stats)
        self.assertIn("byCustomer", stats)
        self.assertIn("byLanguagePair", stats)


if __name__ == "__main__":
    unittest.main()
