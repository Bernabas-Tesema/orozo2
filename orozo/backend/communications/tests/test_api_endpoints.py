import json
import unittest
import uuid
from types import SimpleNamespace

import communications
from api.models import Account, InterpretationRequest
from communications.models import InterpretationSession, SessionEvent, SessionParticipant
from communications.views import (
    session_cancel,
    session_complete,
    session_detail,
    session_history,
    session_join,
    session_leave,
    session_participants,
    session_statistics,
    sessions_collection,
)


class MockRequest:
    def __init__(self, method="GET", body=None, headers=None, GET=None):
        self.method = method
        self.headers = headers or {}
        self.GET = GET or {}
        if body:
            self.body = json.dumps(body).encode("utf-8")
        else:
            self.body = b""


class TestApiEndpoints(unittest.TestCase):
    def setUp(self):
        self.customer = Account(id="cust-er-10", role="client", full_name="Abebe Bikila", organization_name="Tikur Anbessa")
        self.interpreter = Account(id="int-er-20", role="interpreter", full_name="Chaltu Kebede", organization_name="Tikur Anbessa")
        self.admin = Account(id="admin-er-30", role="platform_admin", full_name="Dr. Bekele", organization_name="Tikur Anbessa")

        self.session_id = uuid.uuid4()
        self.session = InterpretationSession(
            id=self.session_id,
            session_reference="SES-2026-EP01",
            request_reference="REQ-EP-01",
            customer_id="cust-er-10",
            customer_name="Abebe Bikila",
            interpreter_id="int-er-20",
            interpreter_name="Chaltu Kebede",
            room_name="rm_orzo_endpoint_test",
            communication_type="audio",
            status=InterpretationSession.STATUS_READY,
            source_language="om",
            target_language="am",
        )

    def test_sessions_collection_unauthenticated(self):
        req = MockRequest(method="GET", headers={})
        resp = sessions_collection(req)
        self.assertEqual(resp.status_code, 401)

    def test_session_detail_forbidden_for_stranger(self):
        req = MockRequest(method="GET", headers={"X-Account-Id": "cust-unauthorized-99"})
        resp = session_detail(req, session_id=str(self.session_id))
        self.assertIn(resp.status_code, [401, 403, 404])

    def test_statistics_endpoint_authorized(self):
        req = MockRequest(method="GET", headers={"X-Account-Id": "admin-er-30"})
        req.account = self.admin
        resp = session_statistics(req)
        self.assertEqual(resp.status_code, 200)
        data = json.loads(resp.content.decode("utf-8"))
        self.assertTrue(data.get("success"))
        self.assertIn("statistics", data)


if __name__ == "__main__":
    unittest.main()
