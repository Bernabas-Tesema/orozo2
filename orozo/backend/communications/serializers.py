"""DRF Serializers for PostgreSQL Interpretation Session Records."""

try:
    from rest_framework import serializers

    from .models import InterpretationSession, SessionEvent, SessionParticipant

    class SessionParticipantSerializer(serializers.ModelSerializer):
        joinedAt = serializers.DateTimeField(source="join_timestamp", read_only=True)
        leftAt = serializers.DateTimeField(source="leave_timestamp", read_only=True)
        status = serializers.CharField(source="connection_status", read_only=True)

        class Meta:
            model = SessionParticipant
            fields = [
                "id",
                "session_id",
                "user_id",
                "user_name",
                "role",
                "status",
                "connection_status",
                "join_timestamp",
                "leave_timestamp",
                "joinedAt",
                "leftAt",
                "activity_info",
                "created_at",
            ]
            read_only_fields = ["id", "created_at"]

    class SessionEventSerializer(serializers.ModelSerializer):
        eventType = serializers.CharField(source="event_type", read_only=True)
        actorId = serializers.CharField(source="actor_id", read_only=True)

        class Meta:
            model = SessionEvent
            fields = [
                "id",
                "session_id",
                "event_type",
                "eventType",
                "description",
                "actor_id",
                "actorId",
                "timestamp",
                "metadata",
            ]
            read_only_fields = ["id", "timestamp"]

    class InterpretationSessionSerializer(serializers.ModelSerializer):
        sessionId = serializers.UUIDField(source="id", read_only=True)
        sessionReference = serializers.CharField(source="session_reference", read_only=True)
        requestReference = serializers.CharField(source="request_reference")
        customerId = serializers.CharField(source="customer_id")
        customerName = serializers.CharField(source="customer_name")
        interpreterId = serializers.CharField(source="interpreter_id", allow_null=True, required=False)
        interpreterName = serializers.CharField(source="interpreter_name", allow_null=True, required=False)
        roomName = serializers.CharField(source="room_name", read_only=True)
        communicationType = serializers.CharField(source="communication_type")
        sourceLanguage = serializers.CharField(source="source_language")
        targetLanguage = serializers.CharField(source="target_language")
        scheduledStartTime = serializers.DateTimeField(source="scheduled_start_time", allow_null=True, required=False)
        actualStartTime = serializers.DateTimeField(source="actual_start_time", read_only=True)
        actualEndTime = serializers.DateTimeField(source="actual_end_time", read_only=True)
        durationSeconds = serializers.IntegerField(source="duration_seconds", read_only=True)
        cancellationReason = serializers.CharField(source="cancellation_reason", allow_null=True, required=False)
        completionNotes = serializers.CharField(source="completion_notes", allow_null=True, required=False)
        createdAt = serializers.DateTimeField(source="created_at", read_only=True)
        updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

        participants = SessionParticipantSerializer(many=True, read_only=True)
        events = SessionEventSerializer(many=True, read_only=True)

        class Meta:
            model = InterpretationSession
            fields = [
                "id",
                "sessionId",
                "sessionReference",
                "requestReference",
                "customerId",
                "customerName",
                "interpreterId",
                "interpreterName",
                "roomName",
                "communicationType",
                "status",
                "sourceLanguage",
                "targetLanguage",
                "scheduledStartTime",
                "actualStartTime",
                "actualEndTime",
                "durationSeconds",
                "cancellationReason",
                "completionNotes",
                "createdAt",
                "updatedAt",
                "participants",
                "events",
            ]
            read_only_fields = ["id", "sessionReference", "roomName", "actualStartTime", "actualEndTime", "durationSeconds", "createdAt", "updatedAt"]

except ImportError:
    # Standalone mock fallback
    class SessionParticipantSerializer:
        def __init__(self, *args, **kwargs):
            pass
        def to_representation(self, instance):
            return instance.to_api()

    class SessionEventSerializer:
        def __init__(self, *args, **kwargs):
            pass
        def to_representation(self, instance):
            return instance.to_api()

    class InterpretationSessionSerializer:
        def __init__(self, *args, **kwargs):
            pass
        def to_representation(self, instance):
            return instance.to_api()
