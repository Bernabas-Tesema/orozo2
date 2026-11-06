import uuid
from django.db import models
from django.utils import timezone


class InterpretationSession(models.Model):
    """PostgreSQL Interpretation Session Record Model.

    Stores all persistent interpretation session metadata, historical records,
    timings, language pairs, and participant associations.
    """

    STATUS_PENDING = "pending"
    STATUS_READY = "ready"
    STATUS_ACTIVE = "active"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_READY, "Ready to Join"),
        (STATUS_ACTIVE, "Active Call"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_FAILED, "Failed"),
    ]

    MODE_AUDIO = "audio"
    MODE_VIDEO = "video"
    MODE_CHOICES = [
        (MODE_AUDIO, "Audio Only"),
        (MODE_VIDEO, "Two-Way Video"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session_reference = models.CharField(max_length=64, unique=True, db_index=True)
    request = models.ForeignKey(
        "api.InterpretationRequest",
        on_delete=models.CASCADE,
        related_name="interpretation_sessions",
        null=True,
        blank=True,
    )
    request_reference = models.CharField(max_length=64, db_index=True)

    customer = models.ForeignKey(
        "api.Account",
        on_delete=models.SET_NULL,
        related_name="customer_sessions",
        null=True,
        blank=True,
    )
    customer_id = models.CharField(max_length=64, db_index=True, blank=True)
    customer_name = models.CharField(max_length=160, blank=True)

    interpreter = models.ForeignKey(
        "api.Account",
        on_delete=models.SET_NULL,
        related_name="interpreter_sessions",
        null=True,
        blank=True,
    )
    interpreter_id = models.CharField(max_length=64, db_index=True, blank=True, null=True)
    interpreter_name = models.CharField(max_length=160, blank=True)

    room_name = models.CharField(max_length=128, unique=True, db_index=True)
    communication_type = models.CharField(max_length=24, choices=MODE_CHOICES, default=MODE_AUDIO)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_READY, db_index=True)

    source_language = models.CharField(max_length=16, blank=True, db_index=True)
    target_language = models.CharField(max_length=16, blank=True, db_index=True)

    scheduled_start_time = models.DateTimeField(null=True, blank=True, db_index=True)
    actual_start_time = models.DateTimeField(null=True, blank=True)
    actual_end_time = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)

    cancellation_reason = models.TextField(blank=True, null=True)
    completion_notes = models.TextField(blank=True, null=True)

    created_by = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["request_reference", "status"]),
            models.Index(fields=["customer_id", "status"]),
            models.Index(fields=["interpreter_id", "status"]),
            models.Index(fields=["source_language", "target_language"]),
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["scheduled_start_time"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"InterpretationSession({self.session_reference}, req={self.request_reference}, status={self.status})"

    @property
    def session_id(self) -> str:
        """String session identifier for API and LiveKit compatibility."""
        return str(self.id) if self.id else ""

    @session_id.setter
    def session_id(self, val):
        if val:
            try:
                self.id = uuid.UUID(str(val))
            except (ValueError, AttributeError):
                self.id = val
        else:
            self.id = None

    @property
    def communication_mode(self) -> str:
        """Alias for communication_type for backwards compatibility."""
        return self.communication_type

    @communication_mode.setter
    def communication_mode(self, value: str):
        self.communication_type = value

    def calculate_duration(self) -> int:
        """Calculate duration from server-side timestamps strictly (anti-tampering)."""
        if self.actual_start_time and self.actual_end_time:
            delta = (self.actual_end_time - self.actual_start_time).total_seconds()
            return max(0, int(delta))
        return self.duration_seconds

    def to_api(self):
        return {
            "id": str(self.id),
            "sessionId": str(self.id),
            "sessionReference": self.session_reference or f"SES-{str(self.id)[:8].upper()}",
            "requestReference": self.request_reference,
            "customerId": self.customer_id,
            "customerName": self.customer_name,
            "interpreterId": self.interpreter_id,
            "interpreterName": self.interpreter_name or None,
            "roomName": self.room_name,
            "communicationType": self.communication_type,
            "communicationMode": self.communication_type,
            "status": self.status,
            "sourceLanguage": self.source_language,
            "targetLanguage": self.target_language,
            "scheduledStartTime": self.scheduled_start_time.isoformat() if self.scheduled_start_time else None,
            "actualStartTime": self.actual_start_time.isoformat() if self.actual_start_time else None,
            "actualEndTime": self.actual_end_time.isoformat() if self.actual_end_time else None,
            "durationSeconds": self.calculate_duration(),
            "cancellationReason": self.cancellation_reason,
            "completionNotes": self.completion_notes,
            "createdBy": self.created_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


# Backwards compatibility alias for existing modules
CommunicationSession = InterpretationSession


class SessionParticipant(models.Model):
    """Participant participation interval in an interpretation session.

    Supports multiple join/leave/reconnect intervals for the same user without
    overwriting historical events.
    """

    ROLE_CUSTOMER = "customer"
    ROLE_INTERPRETER = "interpreter"
    ROLE_COORDINATOR = "coordinator"

    ROLE_CHOICES = [
        (ROLE_CUSTOMER, "Customer / Client"),
        (ROLE_INTERPRETER, "Assigned Interpreter"),
        (ROLE_COORDINATOR, "Supervisor / Coordinator"),
    ]

    STATUS_AUTHORIZED = "authorized"
    STATUS_JOINED = "joined"
    STATUS_DISCONNECTED = "disconnected"
    STATUS_LEFT = "left"

    STATUS_CHOICES = [
        (STATUS_AUTHORIZED, "Authorized"),
        (STATUS_JOINED, "Joined"),
        (STATUS_DISCONNECTED, "Disconnected"),
        (STATUS_LEFT, "Left"),
    ]

    session = models.ForeignKey(InterpretationSession, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey("api.Account", on_delete=models.SET_NULL, null=True, blank=True, related_name="session_participations")
    user_id = models.CharField(max_length=64, db_index=True)
    user_name = models.CharField(max_length=160)
    role = models.CharField(max_length=32, choices=ROLE_CHOICES)
    connection_status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_AUTHORIZED)

    join_timestamp = models.DateTimeField(null=True, blank=True)
    leave_timestamp = models.DateTimeField(null=True, blank=True)
    activity_info = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["session", "user_id"]),
            models.Index(fields=["user_id", "role"]),
        ]

    def __str__(self):
        return f"Participant({self.user_name}, role={self.role}, status={self.connection_status})"

    @property
    def status(self) -> str:
        return self.connection_status

    @status.setter
    def status(self, val: str):
        self.connection_status = val

    @property
    def joined_at(self):
        return self.join_timestamp

    @joined_at.setter
    def joined_at(self, val):
        self.join_timestamp = val

    @property
    def left_at(self):
        return self.leave_timestamp

    @left_at.setter
    def left_at(self, val):
        self.leave_timestamp = val

    def to_api(self):
        return {
            "id": self.id,
            "sessionId": str(self.session_id),
            "userId": self.user_id,
            "userName": self.user_name,
            "role": self.role,
            "status": self.connection_status,
            "connectionStatus": self.connection_status,
            "joinTimestamp": self.join_timestamp.isoformat() if self.join_timestamp else None,
            "leaveTimestamp": self.leave_timestamp.isoformat() if self.leave_timestamp else None,
            "joinedAt": self.join_timestamp.isoformat() if self.join_timestamp else None,
            "leftAt": self.leave_timestamp.isoformat() if self.leave_timestamp else None,
            "activityInfo": self.activity_info,
        }


class SessionEvent(models.Model):
    """Append-only audit trail and lifecycle activity history for interpretation sessions."""

    EVENT_SESSION_CREATED = "session_created"
    EVENT_INTERPRETER_ASSIGNED = "interpreter_assigned"
    EVENT_SESSION_ACCEPTED = "session_accepted"
    EVENT_ROOM_CREATED = "room_created"
    EVENT_PARTICIPANT_AUTHORIZED = "participant_authorized"
    EVENT_CUSTOMER_JOINED = "customer_joined"
    EVENT_INTERPRETER_JOINED = "interpreter_joined"
    EVENT_PARTICIPANT_JOINED = "participant_joined"
    EVENT_CALL_STARTED = "call_started"
    EVENT_SESSION_STARTED = "session_started"
    EVENT_PARTICIPANT_DISCONNECTED = "participant_disconnected"
    EVENT_PARTICIPANT_RECONNECTED = "participant_reconnected"
    EVENT_PARTICIPANT_LEFT = "participant_left"
    EVENT_TRACK_PUBLISHED = "track_published"
    EVENT_TRACK_UNPUBLISHED = "track_unpublished"
    EVENT_SESSION_COMPLETED = "session_completed"
    EVENT_SESSION_CANCELLED = "session_cancelled"
    EVENT_ROOM_CLOSED = "room_closed"
    EVENT_PROVIDER_ERROR = "provider_error"

    session = models.ForeignKey(InterpretationSession, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=64, db_index=True)
    description = models.CharField(max_length=255, blank=True)
    actor = models.ForeignKey("api.Account", on_delete=models.SET_NULL, null=True, blank=True)
    actor_id = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["session", "timestamp"]),
            models.Index(fields=["event_type", "timestamp"]),
        ]

    def __str__(self):
        return f"SessionEvent({self.event_type} at {self.timestamp})"

    @property
    def participant_id(self) -> str:
        return self.actor_id or ""

    @participant_id.setter
    def participant_id(self, val: str):
        self.actor_id = val

    def save(self, *args, **kwargs):
        """Enforce strict append-only immutability: once written, events cannot be modified."""
        if getattr(self, "id", None) or getattr(self, "pk", None):
            if hasattr(self, "_state") and not self._state.adding:
                raise ValueError("SessionEvent audit history is strictly append-only and cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Enforce strict append-only immutability: events cannot be deleted."""
        raise ValueError("SessionEvent audit records are strictly append-only and cannot be deleted.")

    def to_api(self):
        return {
            "id": self.id,
            "sessionId": str(self.session_id),
            "eventType": self.event_type,
            "description": self.description or self.event_type.replace("_", " ").title(),
            "actorId": self.actor_id,
            "participantId": self.actor_id,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }
