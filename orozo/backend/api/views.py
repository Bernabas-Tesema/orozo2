import json
import secrets
from pathlib import Path

from django.contrib.auth.hashers import check_password
from django.http import HttpRequest, HttpResponseRedirect, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .models import Account, InterpretationRequest, InterpretationSession, Language


def home(request: HttpRequest) -> JsonResponse:
    return JsonResponse({"service": "ORZO", "status": "ok"})


def admin_login_redirect(request: HttpRequest) -> HttpResponseRedirect:
    return HttpResponseRedirect("/admin/login/")


def _request_json(request: InterpretationRequest) -> dict:
    return {
        "reference": request.reference,
        "requesterId": request.requester_id,
        "requesterName": request.requester_name,
        "organizationName": request.organization_name,
        "sourceLanguage": request.source_language,
        "targetLanguage": request.target_language,
        "isUnknownLanguage": request.is_unknown_language,
        "unknownLanguageNotes": request.unknown_language_notes,
        "serviceCategory": request.service_category,
        "urgency": request.urgency,
        "modality": request.modality,
        "scheduleType": request.schedule_type,
        "scheduledTime": request.scheduled_time.isoformat() if request.scheduled_time else None,
        "status": request.status,
        "minRoutingContext": request.min_routing_context,
        "createdAt": request.created_at.isoformat(),
        "assignedInterpreterName": request.assigned_interpreter_name,
        "activeSessionId": request.active_session_id,
        "escalationReason": request.escalation_reason,
    }


def _session_json(session: InterpretationSession) -> dict:
    return {
        "id": session.id,
        "requestReference": session.request_reference,
        "sessionToken": session.session_token,
        "status": session.status,
        "communicationMode": session.communication_mode,
        "lowBandwidthMode": session.low_bandwidth_mode,
        "recordingEnabled": session.recording_enabled,
        "durationSeconds": session.duration_seconds,
        "interpreterName": session.interpreter_name,
        "clientName": session.client_name,
        "organizationName": session.organization_name,
        "sourceLanguage": session.source_language,
        "targetLanguage": session.target_language,
        "serviceCategory": session.service_category,
        "connectionHealth": session.connection_health,
    }


def _body(request: HttpRequest) -> dict:
    if not request.body:
        return {}
    try:
        data = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


@require_http_methods(["GET"])
def categories(request: HttpRequest) -> JsonResponse:
    root = Path(__file__).resolve().parents[2] / "categories"
    items = []
    if root.is_dir():
        for profile in sorted(root.glob("*/profile.json")):
            try:
                items.append(json.loads(profile.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                continue
    return JsonResponse({"categories": items})


@require_http_methods(["POST"])
def login(request: HttpRequest) -> JsonResponse:
    data = _body(request)
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    account = Account.objects.filter(email__iexact=email).first()
    if account is None or account.status != "active" or not check_password(password, account.password_hash):
        return JsonResponse({"error": "Sign in failed"}, status=401)
    return JsonResponse({
        "user": {
            "id": account.id,
            "email": account.email,
            "fullName": account.full_name,
            "role": account.role,
            "organizationName": account.organization_name,
        }
    })


@require_http_methods(["GET"])
def languages(request: HttpRequest) -> JsonResponse:
    payload = [
        {
            "code": language.code,
            "name": language.name,
            "nativeName": language.native_name,
            "script": language.script,
            "variants": language.variants,
            "isActive": language.is_active,
        }
        for language in Language.objects.filter(is_active=True).order_by("name")
    ]
    return JsonResponse({"languages": payload})


@require_http_methods(["GET", "POST"])
def requests_collection(request: HttpRequest) -> JsonResponse:
    if request.method == "GET":
        account_id = request.headers.get("X-Account-Id")
        queryset = InterpretationRequest.objects.all().order_by("-created_at")
        if account_id:
            queryset = queryset.filter(requester_id=account_id)
        return JsonResponse({"requests": [_request_json(item) for item in queryset]})

    data = _body(request)
    account_id = request.headers.get("X-Account-Id") or ""
    account = Account.objects.filter(pk=account_id).first()
    if account is None:
        return JsonResponse({"error": "Sign in required"}, status=401)
    now = timezone.now()
    item = InterpretationRequest.objects.create(
        reference=f"REQ-{now.year}-{secrets.token_hex(3).upper()}",
        requester_id=account.id,
        requester_name=account.full_name,
        requester_phone=account.phone,
        organization_name=account.organization_name,
        source_language=data.get("sourceLanguage") or "unknown",
        target_language=data.get("targetLanguage") or "amh",
        is_unknown_language=bool(data.get("isUnknownLanguage")),
        unknown_language_notes=data.get("unknownLanguageNotes") or "",
        service_category=data.get("serviceCategory") or "healthcare",
        urgency=data.get("urgency") or "standard",
        modality=data.get("modality") or "audio",
        schedule_type=data.get("scheduleType") or "immediate",
        status="submitted",
        min_routing_context=data.get("minRoutingContext") or "",
        created_at=now,
        updated_at=now,
    )
    return JsonResponse({"request": _request_json(item)}, status=201)


@require_http_methods(["POST"])
def cancel_request(request: HttpRequest, reference: str) -> JsonResponse:
    item = InterpretationRequest.objects.filter(pk=reference).first()
    if item is None:
        return JsonResponse({"error": "Request not found"}, status=404)
    account_id = request.headers.get("X-Account-Id")
    if account_id and item.requester_id != account_id:
        return JsonResponse({"error": "Request not found"}, status=404)
    item.status = "cancelled"
    item.cancellation_reason = str(_body(request).get("reason") or "")
    item.updated_at = timezone.now()
    item.save(update_fields=["status", "cancellation_reason", "updated_at"])
    return JsonResponse({"request": _request_json(item)})


@require_http_methods(["GET"])
def session_detail(request: HttpRequest, session_id: str) -> JsonResponse:
    session = InterpretationSession.objects.filter(pk=session_id).first()
    if session is None:
        return JsonResponse({"error": "Session not found"}, status=404)
    return JsonResponse({"session": _session_json(session)})


@require_http_methods(["POST"])
def end_session(request: HttpRequest, session_id: str) -> JsonResponse:
    session = InterpretationSession.objects.filter(pk=session_id).first()
    if session is None:
        return JsonResponse({"error": "Session not found"}, status=404)
    session.status = "completed"
    session.save(update_fields=["status"])
    InterpretationRequest.objects.filter(active_session_id=session.id).update(status="completed", updated_at=timezone.now())
    return JsonResponse({"session": _session_json(session)})


@require_http_methods(["POST"])
def feedback(request: HttpRequest) -> JsonResponse:
    data = _body(request)
    if not data.get("sessionId"):
        return JsonResponse({"error": "sessionId is required"}, status=400)
    return JsonResponse({"success": True})
