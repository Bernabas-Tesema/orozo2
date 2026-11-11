from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.utils import timezone

from .models import Account, InterpretationRequest, InterpretationSession, Interpreter, Language

DEMO_PASSWORD = make_password("orzo")


LANGUAGES = [
    ("amh", "Amharic", "አማርኛ", "Ethiopic", ["Gondar", "Wollo", "Shewa", "Gojjam"]),
    ("orm", "Afaan Oromoo", "Afaan Oromoo", "Latin", ["Central (Shewa)", "Western (Wollega)", "Eastern (Harar)"]),
    ("tir", "Tigrinya", "ትግርኛ", "Ethiopic", ["Enderta", "Adwa", "Agame"]),
    ("som", "Somali", "Af-Soomaali", "Latin", ["Ogaden", "Jijiga", "Shinile"]),
    ("sid", "Sidama", "Sidaamu Afoo", "Latin", ["Hawassa", "Aleta Wondo"]),
    ("wal", "Wolaytta", "Wolayttatto Doonaa", "Latin", ["Soddo", "Areka"]),
    ("gur", "Gurage", "ጉራጊኛ", "Ethiopic", ["Sebat Bet", "Silt'e"]),
    ("aar", "Afar", "Qafaraf", "Latin", ["Northern", "Central"]),
    ("eng", "English", "English", "Latin", ["International"]),
    ("ara", "Arabic", "العربية", "Arabic", ["Modern Standard", "Yemeni / Red Sea"]),
]

ACCOUNTS = [
    ("usr-client-common-1", "triage.desk@tikuranbessa.gov.et", "Emergency Triage Desk #1", "client", "common_terminal", "+251 91 123 4599", "Tikur Anbessa Specialized Hospital"),
    ("usr-client-admin-1", "admin.bekele@tikuranbessa.gov.et", "Dr. Solomon Bekele", "client", "organization_admin", "+251 91 123 4567", "Tikur Anbessa Specialized Hospital"),
    ("usr-client-admin-2", "admin.tadesse@moj.gov.et", "Meron Tadesse", "client", "organization_admin", "+251 92 234 5678", "Federal First Instance Court (Arada Bench)"),
    ("usr-client-common-2", "registry.desk@moj.gov.et", "Bench Room 3 Registry", "client", "common_terminal", "+251 92 234 5699", "Federal First Instance Court (Arada Bench)"),
    ("usr-admin-1", "admin.dawit@elip.et", "Dawit Mengistu", "platform_admin", "", "+251 91 888 9999", "Ministry of Innovation & Technology / ELIP Operations"),
]

INTERPRETERS = [
    ("int-1", "Chaltu Kebede", "+251 91 555 0101", "chaltu.kebede@interpreters.et", ["orm", "amh", "eng"], ["healthcare", "public_services", "ngo_humanitarian", "education"], "available", 4.9),
    ("int-2", "Berhane Gebremariam", "+251 91 555 0202", "berhane.gebre@interpreters.et", ["tir", "amh", "eng"], ["legal_court", "immigration", "healthcare", "public_services"], "available", 4.95),
    ("int-3", "Faduma Omar Hassan", "+251 91 555 0303", "faduma.omar@interpreters.et", ["som", "amh", "ara", "eng"], ["healthcare", "immigration", "ngo_humanitarian", "business"], "available", 4.88),
    ("int-4", "Tariku Wonche", "+251 91 555 0404", "tariku.wonche@interpreters.et", ["sid", "wal", "amh"], ["healthcare", "public_services", "education"], "available", 4.82),
]


def seed_if_empty():
    if Language.objects.exists():
        return False

    Language.objects.bulk_create([
        Language(code=code, name=name, native_name=native, script=script, variants=variants, is_active=True)
        for code, name, native, script, variants in LANGUAGES
    ])
    Account.objects.bulk_create([
        Account(
            id=account_id,
            email=email,
            full_name=full_name,
            role=role,
            client_account_type=account_type,
            phone=phone,
            organization_name=organization,
            status="active",
            password_hash=DEMO_PASSWORD,
        )
        for account_id, email, full_name, role, account_type, phone, organization in ACCOUNTS
    ])
    Interpreter.objects.bulk_create([
        Interpreter(
            id=interpreter_id,
            full_name=full_name,
            phone=phone,
            email=email,
            languages=languages,
            categories=categories,
            availability=availability,
            verification_state="verified",
            rating=rating,
        )
        for interpreter_id, full_name, phone, email, languages, categories, availability, rating in INTERPRETERS
    ])

    now = timezone.now()
    InterpretationRequest.objects.create(
        reference="REQ-2026-10821",
        requester_id="usr-client-common-1",
        requester_name="Emergency Triage Desk #1",
        requester_phone="+251 91 123 4599",
        organization_name="Tikur Anbessa Specialized Hospital",
        source_language="orm",
        target_language="amh",
        is_unknown_language=False,
        service_category="healthcare",
        urgency="emergency",
        modality="audio",
        schedule_type="immediate",
        status="assigned",
        min_routing_context="Emergency triage. Patient speaks Afaan Oromoo and needs the clinical team in Amharic.",
        created_at=now - timedelta(minutes=12),
        updated_at=now - timedelta(minutes=2),
        assigned_interpreter_id="int-1",
        assigned_interpreter_name="Chaltu Kebede",
        active_session_id="SES-9921",
    )
    InterpretationSession.objects.create(
        id="SES-9921",
        request_reference="REQ-2026-10821",
        session_token="SES-TOKEN-e89a24cf",
        status="ready_to_join",
        communication_mode="audio",
        low_bandwidth_mode=True,
        recording_enabled=False,
        interpreter_name="Chaltu Kebede",
        client_name="Emergency Triage Desk #1",
        organization_name="Tikur Anbessa Specialized Hospital",
        source_language="orm",
        target_language="amh",
        service_category="healthcare",
        connection_health="optimal",
    )
    Interpreter.objects.filter(pk="int-1").update(availability="busy")
    _seed_communications()
    return True


def _seed_communications():
    now = timezone.now()
    try:
        import uuid
        from communications.models import InterpretationSession as CommSession, SessionEvent, SessionParticipant

        comm_uuid = uuid.UUID("b386d68d-673d-41d0-944f-d672f8a19381")
        if not CommSession.objects.filter(pk=comm_uuid).exists():
            comm_s = CommSession.objects.create(
                id=comm_uuid,
                session_reference="SES-2026-10821",
                request_reference="REQ-2026-10821",
                customer_id="usr-client-common-1",
                customer_name="Emergency Triage Desk #1",
                interpreter_id="int-1",
                interpreter_name="Chaltu Kebede",
                room_name="rm_orzo_triage_bay2",
                communication_type="video",
                status="completed",
                source_language="orm",
                target_language="amh",
                actual_start_time=now - timedelta(minutes=25),
                actual_end_time=now - timedelta(minutes=11),
                duration_seconds=840,
                completion_notes="Emergency triage intake in Afaan Oromoo to Amharic clinical team.",
                created_by="usr-client-common-1",
            )
            SessionParticipant.objects.create(
                session=comm_s,
                user_id="usr-client-common-1",
                user_name="Emergency Triage Desk #1",
                role="customer",
                connection_status="left",
                join_timestamp=now - timedelta(minutes=25),
                leave_timestamp=now - timedelta(minutes=11),
            )
            SessionParticipant.objects.create(
                session=comm_s,
                user_id="int-1",
                user_name="Chaltu Kebede",
                role="interpreter",
                connection_status="left",
                join_timestamp=now - timedelta(minutes=25),
                leave_timestamp=now - timedelta(minutes=11),
            )
            SessionEvent.objects.create(
                session=comm_s,
                event_type="session_created",
                description="Session SES-2026-10821 created.",
                actor_id="usr-client-common-1",
                timestamp=now - timedelta(minutes=26),
            )
            SessionEvent.objects.create(
                session=comm_s,
                event_type="call_started",
                description="Live call started.",
                actor_id="system",
                timestamp=now - timedelta(minutes=25),
            )
            SessionEvent.objects.create(
                session=comm_s,
                event_type="session_completed",
                description="Session completed successfully.",
                actor_id="usr-client-common-1",
                timestamp=now - timedelta(minutes=11),
                metadata={"durationSeconds": 840},
            )
    except Exception as exc:
        print("Communications seed note:", exc)

    return True
