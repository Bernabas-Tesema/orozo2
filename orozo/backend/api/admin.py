import json

from django.contrib import admin, messages
from django.db import connection
from django.shortcuts import redirect, render
from django.urls import path
from django.utils.html import format_html
from import_export import resources
from import_export.admin import ImportExportModelAdmin

from .models import Account, InterpretationRequest, InterpretationSession, Interpreter, Language

BADGE_COLORS = {
    "active": "#168b91",
    "available": "#168b91",
    "verified": "#155b86",
    "submitted": "#155b86",
    "assigned": "#155b86",
    "in_progress": "#0e7490",
    "urgent": "#b45309",
    "emergency": "#b91c1c",
    "high": "#b45309",
    "completed": "#15803d",
    "cancelled": "#6b7280",
    "offline": "#6b7280",
    "pending": "#b45309",
}


def badge(value):
    if not value:
        return "—"
    color = BADGE_COLORS.get(str(value).lower(), "#0e2a3a")
    return format_html(
        '<span style="background:{};color:#fff;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;">{}</span>',
        color,
        value,
    )


class AccountResource(resources.ModelResource):
    class Meta:
        model = Account
        exclude = ("password_hash",)


class LanguageResource(resources.ModelResource):
    class Meta:
        model = Language


class InterpreterResource(resources.ModelResource):
    class Meta:
        model = Interpreter


class InterpretationRequestResource(resources.ModelResource):
    class Meta:
        model = InterpretationRequest


class InterpretationSessionResource(resources.ModelResource):
    class Meta:
        model = InterpretationSession


@admin.register(Account)
class AccountAdmin(ImportExportModelAdmin):
    resource_classes = [AccountResource]
    list_display = ("email", "full_name", "role_badge", "organization_name", "status_badge")
    search_fields = ("email", "full_name", "organization_name")
    list_filter = ("role", "status")
    list_per_page = 25

    @admin.display(description="Role", ordering="role")
    def role_badge(self, obj):
        return badge(obj.role)

    @admin.display(description="Status", ordering="status")
    def status_badge(self, obj):
        return badge(obj.status)


@admin.register(Language)
class LanguageAdmin(ImportExportModelAdmin):
    resource_classes = [LanguageResource]
    list_display = ("code", "name", "native_name", "script", "active_badge")
    search_fields = ("code", "name", "native_name")
    list_filter = ("is_active", "script")
    list_per_page = 40

    @admin.display(description="Active", boolean=True, ordering="is_active")
    def active_badge(self, obj):
        return obj.is_active


@admin.register(Interpreter)
class InterpreterAdmin(ImportExportModelAdmin):
    resource_classes = [InterpreterResource]
    list_display = ("full_name", "email", "availability_badge", "verification_badge", "rating")
    list_filter = ("availability", "verification_state")
    search_fields = ("full_name", "email")
    list_per_page = 25

    @admin.display(description="Availability", ordering="availability")
    def availability_badge(self, obj):
        return badge(obj.availability)

    @admin.display(description="Verification", ordering="verification_state")
    def verification_badge(self, obj):
        return badge(obj.verification_state)


@admin.register(InterpretationRequest)
class InterpretationRequestAdmin(ImportExportModelAdmin):
    resource_classes = [InterpretationRequestResource]
    list_display = ("reference", "organization_name", "source_language", "target_language", "status_badge", "urgency_badge")
    list_filter = ("status", "service_category", "urgency")
    search_fields = ("reference", "organization_name", "requester_name")
    list_per_page = 25

    @admin.display(description="Status", ordering="status")
    def status_badge(self, obj):
        return badge(obj.status)

    @admin.display(description="Urgency", ordering="urgency")
    def urgency_badge(self, obj):
        return badge(obj.urgency)


@admin.register(InterpretationSession)
class InterpretationSessionAdmin(ImportExportModelAdmin):
    resource_classes = [InterpretationSessionResource]
    list_display = ("id", "request_reference", "status_badge", "client_name", "interpreter_name")
    list_filter = ("status", "service_category")
    search_fields = ("id", "request_reference", "client_name", "interpreter_name")
    list_per_page = 25

    @admin.display(description="Status", ordering="status")
    def status_badge(self, obj):
        return badge(obj.status)


def portal_document(key):
    with connection.cursor() as cursor:
        cursor.execute("SELECT payload FROM portal_document WHERE key = %s", [key])
        row = cursor.fetchone()
    if not row:
        return None
    payload = row[0]
    if isinstance(payload, str):
        return json.loads(payload)
    return payload


def save_portal_document(key, payload):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO portal_document (key, payload)
            VALUES (%s, %s::jsonb)
            ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload
            """,
            [key, json.dumps(payload)],
        )


def platform_configuration(request):
    settings_doc = portal_document("settings") or {}
    if request.method == "POST":
        settings_doc.update(
            {
                "assignmentTimeoutSeconds": int(request.POST.get("assignmentTimeoutSeconds") or 45),
                "maxAutoRetries": int(request.POST.get("maxAutoRetries") or 3),
                "emergencyPriorityBypass": request.POST.get("emergencyPriorityBypass") == "on",
                "telecomLowBandwidthPreset": request.POST.get("telecomLowBandwidthPreset") == "on",
                "allowDirectRecording": request.POST.get("allowDirectRecording") == "on",
                "systemBannerNotice": request.POST.get("systemBannerNotice") or "",
            }
        )
        save_portal_document("settings", settings_doc)
        messages.success(request, "Platform configuration saved to the shared ORZO database.")
        return redirect("admin:platform-configuration")
    return render(
        request,
        "admin/platform_configuration.html",
        {**admin.site.each_context(request), "settings_doc": settings_doc, "title": "Platform configuration"},
    )


def security_audit(request):
    query = (request.GET.get("q") or "").strip().lower()
    logs = portal_document("auditLogs") or []
    if not isinstance(logs, list):
        logs = []
    if query:
        logs = [
            log
            for log in logs
            if query in str(log.get("action", "")).lower()
            or query in str(log.get("actorName", "")).lower()
            or query in str(log.get("resourceId", "")).lower()
        ]
    return render(
        request,
        "admin/security_audit.html",
        {**admin.site.each_context(request), "logs": logs[:200], "query": request.GET.get("q") or "", "title": "Security audit logs"},
    )


def admin_index(request, extra_context=None):
    extra = extra_context or {}
    extra.update(
        {
            "organization_count": Account.objects.filter(role="client").count(),
            "language_count": Language.objects.count(),
            "interpreter_count": Interpreter.objects.count(),
            "request_count": InterpretationRequest.objects.count(),
            "audit_count": len(portal_document("auditLogs") or []),
        }
    )
    return admin.site.__class__.index(admin.site, request, extra)


admin.site.site_header = "ORZO"
admin.site.site_title = "ORZO Admin"
admin.site.index_title = "Platform Administration & Audit"
admin.site.index_template = "admin/orzo_index.html"
admin.site.index = admin_index

_original_get_urls = admin.site.get_urls


def _orzo_admin_urls():
    return [
        path("platform-configuration/", admin.site.admin_view(platform_configuration), name="platform-configuration"),
        path("security-audit/", admin.site.admin_view(security_audit), name="security-audit"),
    ] + _original_get_urls()


admin.site.get_urls = _orzo_admin_urls
