from django.urls import path

from . import views

urlpatterns = [
    # Statistics must come before <str:session_id> to avoid capture
    path("sessions/statistics/", views.session_statistics, name="sessions_statistics"),
    path("statistics/", views.session_statistics, name="communications_statistics"),

    # Session Management
    path("sessions/", views.sessions_collection, name="sessions_collection"),
    path("sessions/<str:session_id>/", views.session_detail, name="session_detail"),
    path("sessions/<str:session_id>/status/", views.session_detail, name="session_status"),

    # History & Audit Trail (Append-Only)
    path("sessions/<str:session_id>/history/", views.session_history, name="session_history"),

    # Participant Management & Presence
    path("sessions/<str:session_id>/participants/", views.session_participants, name="session_participants"),
    path("sessions/<str:session_id>/join/", views.session_join, name="session_join"),
    path("sessions/<str:session_id>/leave/", views.session_leave, name="session_leave"),

    # Termination (both /complete/ and /end/ supported)
    path("sessions/<str:session_id>/complete/", views.session_complete, name="session_complete"),
    path("sessions/<str:session_id>/end/", views.session_complete, name="session_end"),
    path("sessions/<str:session_id>/cancel/", views.session_cancel, name="session_cancel"),

    # LiveKit Access & Token Generation
    path("sessions/<str:session_id>/token/", views.session_token, name="session_token"),

    # LiveKit Webhook Endpoint
    path("webhooks/livekit/", views.livekit_webhook, name="communications_livekit_webhook"),
]
