from django.contrib import admin
from django.utils.html import format_html
from import_export import resources
from import_export.admin import ImportExportModelAdmin

from .models import InterpretationSession, SessionEvent, SessionParticipant

BADGE_COLORS = {
    "active": "#168b91",
    "connected": "#168b91",
    "created": "#155b86",
    "in_progress": "#0e7490",
    "completed": "#15803d",
    "ended": "#15803d",
    "cancelled": "#6b7280",
    "disconnected": "#6b7280",
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


class CommunicationsSessionResource(resources.ModelResource):
    class Meta:
        model = InterpretationSession


class SessionParticipantResource(resources.ModelResource):
    class Meta:
        model = SessionParticipant


class SessionEventResource(resources.ModelResource):
    class Meta:
        model = SessionEvent


@admin.register(InterpretationSession)
class CommunicationsSessionAdmin(ImportExportModelAdmin):
    resource_classes = [CommunicationsSessionResource]
    list_display = ("session_reference", "request_reference", "status_badge", "customer_name", "interpreter_name")
    search_fields = ("session_reference", "request_reference", "room_name")
    list_filter = ("status", "communication_type")
    list_per_page = 25

    @admin.display(description="Status", ordering="status")
    def status_badge(self, obj):
        return badge(obj.status)


@admin.register(SessionParticipant)
class SessionParticipantAdmin(ImportExportModelAdmin):
    resource_classes = [SessionParticipantResource]
    list_display = ("user_name", "role_badge", "connection_badge", "session")
    list_filter = ("role", "connection_status")
    search_fields = ("user_name",)
    list_per_page = 25

    @admin.display(description="Role", ordering="role")
    def role_badge(self, obj):
        return badge(obj.role)

    @admin.display(description="Connection", ordering="connection_status")
    def connection_badge(self, obj):
        return badge(obj.connection_status)


@admin.register(SessionEvent)
class SessionEventAdmin(ImportExportModelAdmin):
    resource_classes = [SessionEventResource]
    list_display = ("event_type_badge", "session", "actor_id", "timestamp")
    list_filter = ("event_type",)
    list_per_page = 40

    @admin.display(description="Event", ordering="event_type")
    def event_type_badge(self, obj):
        return badge(obj.event_type)
