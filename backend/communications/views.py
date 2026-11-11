import json
import logging
import uuid
from typing import Optional

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from api.models import Account, InterpretationRequest
from communications.models import InterpretationSession, SessionEvent, SessionParticipant
from communications.permissions import check_session_permission, get_authenticated_account
from communications.services.participant_service import ParticipantService
from communications.services.session_service import SessionLifecycleException, SessionService
from communications.services.statistics_service import SessionStatisticsService
from communications.services.token_service import TokenSecurityException, TokenService
from communications.webhooks.livekit_webhook import LiveKitWebhookHandler

logger = logging.getLogger(__name__)


def _error(message: str, status: int = 400) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def _json_body(request: HttpRequest) -> dict:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return None


def _get_session(identifier: str) -> Optional[InterpretationSession]:
    """Retrieve session by UUID pk, session_reference, request_reference, or room_name."""
    if not identifier:
        return None

    # Try UUID lookup
    try:
        parsed_uuid = uuid.UUID(identifier)
        s = InterpretationSession.objects.filter(pk=parsed_uuid).first()
        if s:
            return s
    except (ValueError, AttributeError):
        pass

    # Try session_reference
    s = InterpretationSession.objects.filter(session_reference=identifier).first()
    if s:
        return s

    # Fallback to string matching or request reference
    s = InterpretationSession.objects.filter(request_reference=identifier).first()
    if s:
        return s

    return InterpretationSession.objects.filter(room_name=identifier).first()


# ============================================================================
# 1. SESSIONS COLLECTION: GET /api/sessions/ & POST /api/sessions/
# ============================================================================


@csrf_exempt
@require_http_methods(["GET", "POST"])
def sessions_collection(request: HttpRequest) -> JsonResponse:
    account = get_authenticated_account(request)
    if not account:
        return _error("Authentication required. Set X-Account-Id or Authorization header.", 401)

    if request.method == "POST":
        body = _json_body(request)
        if body is None:
            return _error("Invalid JSON body", 400)

        request_reference = body.get("requestReference")
        if not request_reference:
            return _error("Field 'requestReference' is required", 400)

        # Validate that the interpretation request exists
        interp_req = InterpretationRequest.objects.filter(reference=request_reference).first()
        if not interp_req:
            return _error(f"Interpretation request '{request_reference}' not found", 404)

        # RBAC Check: Customers can only initiate sessions for their own request
        if account.role == "client" and interp_req.requester_id != account.id:
            return _error("Access denied: You cannot create sessions for another customer's request.", 403)

        mode = body.get("communicationMode") or body.get("communicationType") or interp_req.modality or "audio"

        session = SessionService.create_or_activate_session(
            request_reference=request_reference,
            customer_id=interp_req.requester_id,
            customer_name=interp_req.requester_name,
            interpreter_id=interp_req.assigned_interpreter_id,
            interpreter_name=interp_req.assigned_interpreter_name,
            communication_mode=mode,
            source_language=interp_req.source_language,
            target_language=interp_req.target_language,
            created_by=account.id,
        )

        return JsonResponse({"session": session.to_api()}, status=201)

    # GET: List authorized sessions with role-based scoping, filtering & pagination
    qs = InterpretationSession.objects.all()

    # Apply strict role scoping
    if account.role == "client":
        qs = qs.filter(customer_id=account.id)
    elif account.role == "interpreter":
        qs = qs.filter(interpreter_id=account.id)
    # Supervisors and Admins see all platform sessions

    # Optional status filter
    status_filter = request.GET.get("status")
    if status_filter:
        qs = qs.filter(status=status_filter)

    # Optional language filter
    source_lang = request.GET.get("sourceLanguage")
    if source_lang:
        qs = qs.filter(source_language__iexact=source_lang)
    target_lang = request.GET.get("targetLanguage")
    if target_lang:
        qs = qs.filter(target_language__iexact=target_lang)

    # Pagination
    try:
        page = max(1, int(request.GET.get("page", 1)))
        page_size = max(1, min(100, int(request.GET.get("pageSize", 20))))
    except ValueError:
        page, page_size = 1, 20

    all_sessions = list(qs)
    total_count = len(all_sessions)
    offset = (page - 1) * page_size
    page_items = all_sessions[offset : offset + page_size]

    return JsonResponse({
        "sessions": [s.to_api() for s in page_items],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalCount": total_count,
            "totalPages": (total_count + page_size - 1) // page_size if total_count > 0 else 1,
        },
    }, status=200)


# ============================================================================
# 2. SESSION DETAIL: GET /api/sessions/{id}/
# ============================================================================


@csrf_exempt
@require_http_methods(["GET"])
def session_detail(request: HttpRequest, session_id: str) -> JsonResponse:
    account = get_authenticated_account(request)
    if not account:
        return _error("Authentication required", 401)

    session = _get_session(session_id)
    if not session:
        return _error(f"Session '{session_id}' not found", 404)

    is_allowed, err = check_session_permission(session, account)
    if not is_allowed:
        return _error(err, 403)

    participants = session.participants.all()
    events = session.events.all()[:10]

    return JsonResponse({
        "session": session.to_api(),
        "participants": [p.to_api() for p in participants],
        "recentEvents": [e.to_api() for e in events],
    }, status=200)


# ============================================================================
# 3. SESSION HISTORY: GET /api/sessions/{id}/history/
# ============================================================================


@csrf_exempt
@require_http_methods(["GET"])
def session_history(request: HttpRequest, session_id: str) -> JsonResponse:
    account = get_authenticated_account(request)
    if not account:
        return _error("Authentication required", 401)

    session = _get_session(session_id)
    if not session:
        return _error(f"Session '{session_id}' not found", 404)

    is_allowed, err = check_session_permission(session, account)
    if not is_allowed:
        return _error(err, 403)

    events_qs = session.events.all()

    # Optional event_type filter
    event_filter = request.GET.get("eventType")
    if event_filter:
        events_qs = events_qs.filter(event_type=event_filter)

    try:
        page = max(1, int(request.GET.get("page", 1)))
        page_size = max(1, min(100, int(request.GET.get("pageSize", 50))))
    except ValueError:
        page, page_size = 1, 50

    all_events = list(events_qs)
    total_count = len(all_events)
    offset = (page - 1) * page_size
    page_items = all_events[offset : offset + page_size]

    return JsonResponse({
        "sessionId": str(session.id),
        "sessionReference": session.session_reference,
        "history": [e.to_api() for e in page_items],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalCount": total_count,
            "totalPages": (total_count + page_size - 1) // page_size if total_count > 0 else 1,
        },
    }, status=200)


# ============================================================================
# 4. SESSION PARTICIPANTS: GET /api/sessions/{id}/participants/
# ============================================================================


@csrf_exempt
@require_http_methods(["GET"])
def session_participants(request: HttpRequest, session_id: str) -> JsonResponse:
    account = get_authenticated_account(request)
    if not account:
        return _error("Authentication required", 401)

    session = _get_session(session_id)
    if not session:
        return _error(f"Session '{session_id}' not found", 404)

    is_allowed, err = check_session_permission(session, account)
    if not is_allowed:
        return _error(err, 403)

    participants = session.participants.all()
    return JsonResponse({
        "sessionId": str(session.id),
        "sessionReference": session.session_reference,
        "participants": [p.to_api() for p in participants],
    }, status=200)


# ============================================================================
# 5. SESSION JOIN: POST /api/sessions/{id}/join/
# ============================================================================


@csrf_exempt
@require_http_methods(["POST"])
def session_join(request: HttpRequest, session_id: str) -> JsonResponse:
    account = get_authenticated_account(request)
    if not account:
        return _error("Authentication required to join session", 401)

    session = _get_session(session_id)
    if not session:
        return _error(f"Session '{session_id}' not found", 404)

    is_allowed, err = check_session_permission(session, account)
    if not is_allowed:
        return _error(err, 403)

    if session.status in (InterpretationSession.STATUS_COMPLETED, InterpretationSession.STATUS_CANCELLED, InterpretationSession.STATUS_FAILED):
        return _error(f"Cannot join session in '{session.status}' state", 409)

    body = _json_body(request) or {}
    device_type = body.get("deviceType") or "web"

    try:
        participant = ParticipantService.record_join(session, user_id=account.id, device_type=device_type)
        return JsonResponse({
            "success": True,
            "message": "Joined session successfully",
            "participant": participant.to_api(),
            "session": session.to_api(),
        }, status=200)
    except Exception as exc:
        logger.error("Error joining session %s: %s", session.session_reference, exc)
        return _error(f"Failed to record join: {str(exc)}", 500)


# ============================================================================
# 6. SESSION LEAVE: POST /api/sessions/{id}/leave/
# ============================================================================


@csrf_exempt
@require_http_methods(["POST"])
def session_leave(request: HttpRequest, session_id: str) -> JsonResponse:
    account = get_authenticated_account(request)
    if not account:
        return _error("Authentication required", 401)

    session = _get_session(session_id)
    if not session:
        return _error(f"Session '{session_id}' not found", 404)

    is_allowed, err = check_session_permission(session, account)
    if not is_allowed:
        return _error(err, 403)

    body = _json_body(request) or {}
    reason = body.get("reason") or "Participant left session"

    participant = ParticipantService.record_leave(session, user_id=account.id, reason=reason)
    return JsonResponse({
        "success": True,
        "message": "Left session successfully",
        "participant": participant.to_api() if participant else None,
    }, status=200)


# ============================================================================
# 7. SESSION COMPLETE: POST /api/sessions/{id}/complete/ (or /end/)
# ============================================================================


@csrf_exempt
@require_http_methods(["POST"])
def session_complete(request: HttpRequest, session_id: str) -> JsonResponse:
    account = get_authenticated_account(request)
    if not account:
        return _error("Authentication required", 401)

    session = _get_session(session_id)
    if not session:
        return _error(f"Session '{session_id}' not found", 404)

    is_allowed, err = check_session_permission(session, account)
    if not is_allowed:
        return _error(err, 403)

    body = _json_body(request) or {}
    reason = body.get("reason") or "Completed by authorized participant"
    completion_notes = body.get("completionNotes") or body.get("notes") or ""

    updated_session = SessionService.end_session(
        session, user_id=account.id, reason=reason, completion_notes=completion_notes
    )

    return JsonResponse({
        "success": True,
        "message": "Session completed successfully",
        "session": updated_session.to_api(),
        "durationSeconds": updated_session.duration_seconds,
    }, status=200)


# ============================================================================
# 8. SESSION CANCEL: POST /api/sessions/{id}/cancel/
# ============================================================================


@csrf_exempt
@require_http_methods(["POST"])
def session_cancel(request: HttpRequest, session_id: str) -> JsonResponse:
    account = get_authenticated_account(request)
    if not account:
        return _error("Authentication required", 401)

    session = _get_session(session_id)
    if not session:
        return _error(f"Session '{session_id}' not found", 404)

    is_allowed, err = check_session_permission(session, account)
    if not is_allowed:
        return _error(err, 403)

    # Interpreters cannot arbitrarily cancel customer requests unless supervisor
    if account.role == "interpreter":
        return _error("Interpreters cannot cancel interpretation sessions directly. Contact supervisor.", 403)

    body = _json_body(request) or {}
    reason = body.get("reason") or "Cancelled by user"

    try:
        updated_session = SessionService.cancel_session(session, user_id=account.id, reason=reason)
        return JsonResponse({
            "success": True,
            "message": "Session cancelled successfully",
            "session": updated_session.to_api(),
        }, status=200)
    except SessionLifecycleException as exc:
        return _error(exc.message, exc.status_code)


# ============================================================================
# 9. SESSION STATISTICS: GET /api/sessions/statistics/
# ============================================================================


@csrf_exempt
@require_http_methods(["GET"])
def session_statistics(request: HttpRequest) -> JsonResponse:
    account = get_authenticated_account(request)
    if not account:
        return _error("Authentication required", 401)

    stats = SessionStatisticsService.get_statistics(account)
    return JsonResponse({
        "success": True,
        "role": account.role,
        "statistics": stats,
    }, status=200)


# ============================================================================
# 10. LIVEKIT TOKEN GENERATION: POST /api/sessions/{id}/token/
# ============================================================================


@csrf_exempt
@require_http_methods(["POST"])
def session_token(request: HttpRequest, session_id: str) -> JsonResponse:
    account = get_authenticated_account(request)
    if not account:
        return _error("Authentication required to request LiveKit token", 401)

    session = _get_session(session_id)
    if not session:
        return _error(f"Session '{session_id}' not found", 404)

    token_service = TokenService()
    try:
        token_payload = token_service.generate_participant_token(
            session=session,
            user_id=account.id,
            user_name=account.full_name,
            user_role=account.role,
        )
        return JsonResponse(token_payload, status=200)
    except TokenSecurityException as exc:
        return _error(exc.message, exc.status_code)


# ============================================================================
# 11. LIVEKIT WEBHOOK: POST /api/communications/webhooks/livekit/
# ============================================================================


@csrf_exempt
@require_http_methods(["POST"])
def livekit_webhook(request: HttpRequest) -> JsonResponse:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return _error("Missing Authorization header in webhook request", 401)

    handler = LiveKitWebhookHandler()
    success, msg, status_code = handler.process_webhook(auth_header, request.body)

    if not success:
        return _error(msg, status_code)

    return JsonResponse({"status": "received", "message": msg}, status=status_code)
