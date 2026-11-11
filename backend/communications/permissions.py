import logging
from typing import Optional, Tuple

from api.models import Account
from communications.models import InterpretationSession, SessionParticipant

logger = logging.getLogger(__name__)


def get_authenticated_account(request) -> Optional[Account]:
    """Retrieve authenticated Account from headers (X-Account-Id, Authorization, or Session)."""
    # 0. Check pre-attached account (e.g. from middleware or test fixtures)
    if hasattr(request, "account") and request.account:
        return request.account

    # 1. Check custom X-Account-Id header (used by Flutter and React client proxy)
    account_id = request.headers.get("X-Account-Id")

    # 2. Check Bearer token in Authorization header
    if not account_id and "Authorization" in request.headers:
        auth_header = request.headers["Authorization"].strip()
        if auth_header.startswith("Bearer "):
            account_id = auth_header[7:].strip()
        else:
            account_id = auth_header

    # 3. Fallback for query param (used in testing and explicit requests)
    if not account_id and hasattr(request, "GET") and "accountId" in request.GET:
        account_id = request.GET.get("accountId")

    if not account_id:
        return None

    return Account.objects.filter(pk=account_id).first()


def check_session_permission(
    session: InterpretationSession, account: Account, required_role: Optional[str] = None
) -> Tuple[bool, str]:
    """Verify role-based access control for an interpretation session.

    Enforces strict IDOR prevention:
    - Customer can access only their own sessions.
    - Interpreter can access only sessions assigned to them.
    - Supervisor / Coordinator / Administrator has oversight permissions.
    """
    if not account:
        return False, "Authentication required"

    # Administrators and Supervisors have full platform oversight permissions
    if account.role in ("supervisor", "platform_admin", "admin", "coordinator"):
        return True, "Authorized (Administrator/Supervisor)"

    # Check direct assignment on session record
    if account.role == "client" and session.customer_id == account.id:
        if required_role and required_role != SessionParticipant.ROLE_CUSTOMER:
            return False, f"Access denied: Operation requires {required_role} role."
        return True, "Authorized (Customer)"

    if account.role == "interpreter" and session.interpreter_id == account.id:
        if required_role and required_role != SessionParticipant.ROLE_INTERPRETER:
            return False, f"Access denied: Operation requires {required_role} role."
        return True, "Authorized (Interpreter)"

    # Check participant table records
    participant = SessionParticipant.objects.filter(session=session, user_id=account.id).first()
    if participant:
        if required_role and participant.role != required_role:
            return False, f"Access denied: Operation requires {required_role} role."
        return True, "Authorized (Participant)"

    return False, "Access denied: You are not an assigned participant in this session."
