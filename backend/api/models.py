from django.db import models
from django.utils import timezone


class Account(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=160)
    role = models.CharField(max_length=32)
    client_account_type = models.CharField(max_length=32, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    organization_name = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=32, default="active")
    password_hash = models.CharField(max_length=256)

    class Meta:
        verbose_name = "Organization account"
        verbose_name_plural = "Organizations"

    def __str__(self):
        return self.email


class Language(models.Model):
    code = models.CharField(primary_key=True, max_length=16)
    name = models.CharField(max_length=80)
    native_name = models.CharField(max_length=80)
    script = models.CharField(max_length=32)
    variants = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Supported language"
        verbose_name_plural = "Supported languages"


class Interpreter(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    full_name = models.CharField(max_length=160)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField()
    languages = models.JSONField(default=list)
    categories = models.JSONField(default=list)
    availability = models.CharField(max_length=32, default="offline")
    verification_state = models.CharField(max_length=32, default="pending")
    rating = models.FloatField(default=0)

    class Meta:
        verbose_name = "Accredited interpreter"
        verbose_name_plural = "Interpreter accreditation registry"


class InterpretationRequest(models.Model):
    reference = models.CharField(primary_key=True, max_length=64)
    requester_id = models.CharField(max_length=64, db_index=True)
    requester_name = models.CharField(max_length=160)
    requester_phone = models.CharField(max_length=32, blank=True)
    organization_name = models.CharField(max_length=200, blank=True)
    source_language = models.CharField(max_length=16)
    target_language = models.CharField(max_length=16)
    is_unknown_language = models.BooleanField(default=False)
    unknown_language_notes = models.TextField(blank=True, null=True)
    service_category = models.CharField(max_length=64)
    urgency = models.CharField(max_length=32)
    modality = models.CharField(max_length=32)
    schedule_type = models.CharField(max_length=32)
    scheduled_time = models.CharField(max_length=40, blank=True, null=True)
    status = models.CharField(max_length=32, default="submitted", db_index=True)
    min_routing_context = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    assigned_interpreter_id = models.CharField(max_length=64, blank=True, null=True)
    assigned_interpreter_name = models.CharField(max_length=160, blank=True, null=True)
    active_session_id = models.CharField(max_length=64, blank=True, null=True)
    escalation_reason = models.TextField(blank=True, null=True)
    cancellation_reason = models.TextField(blank=True, null=True)


class InterpretationSession(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    request_reference = models.CharField(max_length=64, db_index=True)
    session_token = models.CharField(max_length=128)
    status = models.CharField(max_length=32, default="created")
    communication_mode = models.CharField(max_length=32, default="audio")
    low_bandwidth_mode = models.BooleanField(default=True)
    recording_enabled = models.BooleanField(default=False)
    duration_seconds = models.PositiveIntegerField(default=0)
    interpreter_name = models.CharField(max_length=160, blank=True, null=True)
    client_name = models.CharField(max_length=160, blank=True)
    organization_name = models.CharField(max_length=200, blank=True)
    source_language = models.CharField(max_length=16, blank=True)
    target_language = models.CharField(max_length=16, blank=True)
    service_category = models.CharField(max_length=64, blank=True)
    connection_health = models.CharField(max_length=32, default="optimal")
