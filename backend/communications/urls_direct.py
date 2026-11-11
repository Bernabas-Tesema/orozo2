from django.urls import path

from . import views

urlpatterns = [
    # Top-level statistics
    path("statistics/", views.session_statistics, name="direct_sessions_statistics"),

    # Collection
    path("", views.sessions_collection, name="direct_sessions_collection"),

    # Item detail & status
    path("<str:session_id>/", views.session_detail, name="direct_session_detail"),
    path("<str:session_id>/status/", views.session_detail, name="direct_session_status"),

    # History & Audit Trail
    path("<str:session_id>/history/", views.session_history, name="direct_session_history"),

    # Participants
    path("<str:session_id>/participants/", views.session_participants, name="direct_session_participants"),
    path("<str:session_id>/join/", views.session_join, name="direct_session_join"),
    path("<str:session_id>/leave/", views.session_leave, name="direct_session_leave"),

    # Completion & Cancellation
    path("<str:session_id>/complete/", views.session_complete, name="direct_session_complete"),
    path("<str:session_id>/end/", views.session_complete, name="direct_session_end"),
    path("<str:session_id>/cancel/", views.session_cancel, name="direct_session_cancel"),

    # LiveKit Token
    path("<str:session_id>/token/", views.session_token, name="direct_session_token"),
]
