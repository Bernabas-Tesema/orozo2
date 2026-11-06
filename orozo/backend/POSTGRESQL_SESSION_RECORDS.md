# Orzo — PostgreSQL Interpretation Session Records Implementation

## Architecture & System Overview

In the Orzo Ethiopian Language Interpretation Platform, **PostgreSQL is the single source of truth** for all interpretation session metadata, participant states, timing logs, and append-only audit event histories. 

**LiveKit Cloud** (`wss://orozo-translation-8nvelq7r.livekit.cloud`) is solely responsible for WebRTC media plane transmission (microphone, camera audio/video frames) and never stores persistent database records or credentials.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT APPLICATIONS                               |
|   +------------------------------------+   +----------------------------------+   |
|   |    Orzo React / Web Triage Station |   |      Orzo Flutter Mobile App     |   |
|   +-----------------+------------------+   +-----------------+----------------+   |
+---------------------|----------------------------------------|--------------------+
                      |                                        |
                      | Authenticated REST API (JWT/X-Account) |
                      v                                        v
+-----------------------------------------------------------------------------------+
|                            ORZO DJANGO / DRF BACKEND                              |
|                                                                                   |
|   Endpoints:                                                                      |
|     * GET  /api/sessions/                 * POST /api/sessions/{id}/join/         |
|     * GET  /api/sessions/{id}/            * POST /api/sessions/{id}/leave/        |
|     * GET  /api/sessions/{id}/history/    * POST /api/sessions/{id}/complete/     |
|     * GET  /api/sessions/{id}/participants* POST /api/sessions/{id}/cancel/       |
|     * GET  /api/sessions/statistics/      * POST /api/sessions/{id}/token/        |
|                                                                                   |
|   Services & Security Layer:                                                      |
|     * SessionService: Atomic lifecycle transitions & server-duration computation  |
|     * ParticipantService: Multi-interval presence & reconnection tracking         |
|     * SessionStatisticsService: Aggregations by interpreter, customer, & language |
|     * Permissions: Strict IDOR prevention & Role-Based Access Control (RBAC)      |
+-----------------------------------------------------------------------------------+
           |                                                      |
           | PostgreSQL Database Driver                           | WebRTC Token Grant
           v                                                      v
+-----------------------------------+             +---------------------------------+
|        POSTGRESQL DATABASE        |             |       LIVEKIT CLOUD SFU         |
|  * InterpretationSession (UUID)   |             |  * Audio RTP / SRTP             |
|  * SessionParticipant (Multi-int) |             |  * Video RTP / SRTP             |
|  * SessionEvent (Append-Only)     |             |  * Ephemeral Room Plane         |
+-----------------------------------+             +---------------------------------+
```

---

## 1. PostgreSQL Data Models

### A. `InterpretationSession`
Persists the primary session record with UUID primary keys and operational metadata.

| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | `UUIDField` | `primary_key=True`, default=`uuid.uuid4` | Cryptographically random unique identifier |
| `session_reference` | `CharField(64)` | `unique=True`, `db_index=True` | Human-readable identifier (`SES-2026-XXXX`) |
| `request` | `ForeignKey(InterpretationRequest)` | `on_delete=CASCADE`, null=True | Linked clinical/legal interpretation request |
| `request_reference` | `CharField(64)` | `db_index=True` | Direct query reference |
| `customer` | `ForeignKey(Account)` | `on_delete=SET_NULL`, null=True | Authenticated customer account |
| `customer_id` | `CharField(64)` | `db_index=True` | Customer identity string |
| `customer_name` | `CharField(160)` | — | Display name |
| `interpreter` | `ForeignKey(Account)` | `on_delete=SET_NULL`, null=True | Certified interpreter account |
| `interpreter_id` | `CharField(64)` | `db_index=True`, null=True | Assigned interpreter identity string |
| `interpreter_name` | `CharField(160)` | — | Interpreter display name |
| `room_name` | `CharField(128)` | `unique=True`, `db_index=True` | Opaque LiveKit room identifier (`rm_orzo_*`) |
| `communication_type` | `CharField(24)` | Choices: `audio`, `video` | Modality |
| `status` | `CharField(32)` | Choices: `pending`, `ready`, `active`, `completed`, `cancelled`, `failed` | Lifecycle state |
| `source_language` | `CharField(16)` | `db_index=True` | ISO / vernacular code (e.g. `om`, `am`) |
| `target_language` | `CharField(16)` | `db_index=True` | Target code (e.g. `am`, `en`) |
| `scheduled_start_time`| `DateTimeField`| null=True, `db_index=True` | Planned booking time |
| `actual_start_time` | `DateTimeField` | null=True | Server timestamp when both parties joined |
| `actual_end_time` | `DateTimeField` | null=True | Server timestamp when session was ended |
| `duration_seconds` | `PositiveIntegerField`| default=0 | Server-authoritative elapsed duration |
| `cancellation_reason`| `TextField` | null=True, blank=True | Documented reason if cancelled |
| `completion_notes` | `TextField` | null=True, blank=True | Clinical or legal consultation notes |
| `created_at` | `DateTimeField` | `auto_now_add=True`, `db_index=True` | Session creation audit time |
| `updated_at` | `DateTimeField` | `auto_now=True` | Last modification timestamp |

#### PostgreSQL Indexing Strategy
```python
indexes = [
    models.Index(fields=["request_reference", "status"]),
    models.Index(fields=["customer_id", "status"]),
    models.Index(fields=["interpreter_id", "status"]),
    models.Index(fields=["source_language", "target_language"]),
    models.Index(fields=["status", "created_at"]),
    models.Index(fields=["scheduled_start_time"]),
    models.Index(fields=["created_at"]),
]
```

---

### B. `SessionParticipant`
Tracks participation intervals. Supports multiple join/leave/reconnect cycles without overwriting historical records.

| Field | Type | Description |
|---|---|---|
| `id` | `BigAutoField` | Primary key |
| `session` | `ForeignKey(InterpretationSession)` | Associated session |
| `user` | `ForeignKey(Account)` | Associated user account |
| `user_id` | `CharField(64)` | User identifier |
| `user_name` | `CharField(160)` | Display name |
| `role` | `CharField(32)` | `customer`, `interpreter`, or `coordinator` |
| `connection_status` | `CharField(32)` | `authorized`, `joined`, `disconnected`, `left` |
| `join_timestamp` | `DateTimeField` | Timestamp when user joined this interval |
| `leave_timestamp` | `DateTimeField` | Timestamp when user left this interval (null if joined) |
| `activity_info` | `JSONField` (JSONB) | Device type, client user agent, network state |

---

### C. `SessionEvent` (Strictly Append-Only)
Maintains an immutable audit history of session operations. Ordinary users and API endpoints are blocked from modifying or deleting records.

| Field | Type | Description |
|---|---|---|
| `id` | `BigAutoField` | Primary key |
| `session` | `ForeignKey(InterpretationSession)` | Associated session |
| `event_type` | `CharField(64)` | `session_created`, `interpreter_assigned`, `call_started`, `customer_joined`, `interpreter_joined`, `participant_disconnected`, `participant_reconnected`, `session_completed`, `session_cancelled`, etc. |
| `description` | `CharField(255)` | Human-readable event description |
| `actor` | `ForeignKey(Account)` | Responsible user |
| `actor_id` | `CharField(64)` | Identity string |
| `timestamp` | `DateTimeField` | Immutably stamped event time |
| `metadata` | `JSONField` (JSONB) | Structured context payload |

---

## 2. Role-Based Permissions (RBAC & IDOR Prevention)

The backend strictly enforces access rights based on the authenticated `Account`:

| Action | Customer (`client`) | Interpreter (`interpreter`) | Supervisor / Coordinator | Administrator |
|---|---|---|---|---|
| **List Sessions** | Only own customer sessions | Only assigned sessions | All in organization/region | All platform sessions |
| **Get Session Detail** | If `customer_id == self.id` | If `interpreter_id == self.id` | Authorized | Authorized |
| **Get Session History**| If `customer_id == self.id` | If `interpreter_id == self.id` | Authorized | Authorized |
| **Join Session** | If `customer_id == self.id` | If `interpreter_id == self.id` | Oversight join | Oversight join |
| **Leave Session** | Own session | Own session | Own session | Any |
| **Complete Session** | If assigned customer | If assigned interpreter | Authorized | Authorized |
| **Cancel Session** | If not completed | Blocked (contact coordinator) | Authorized | Authorized |
| **View Statistics** | Customer personal summary | Interpreter personal summary | Regional summary | Full platform statistics |

---

## 3. REST API Reference

All endpoints are mounted at `/api/sessions/` (and `/api/communications/sessions/`).

### 1. List Sessions: `GET /api/sessions/`
Query parameters: `status`, `sourceLanguage`, `targetLanguage`, `page`, `pageSize`.

**Response (HTTP 200)**:
```json
{
  "sessions": [
    {
      "id": "b386d68d-673d-41d0-944f-d672f8a19381",
      "sessionId": "b386d68d-673d-41d0-944f-d672f8a19381",
      "sessionReference": "SES-2026-A19F80",
      "requestReference": "REQ-2026-10821",
      "customerId": "usr-client-common-1",
      "customerName": "Tikur Anbessa ER Bay 2",
      "interpreterId": "int-1",
      "interpreterName": "Chaltu Kebede",
      "roomName": "rm_orzo_f19d2b821",
      "communicationType": "video",
      "communicationMode": "video",
      "status": "completed",
      "sourceLanguage": "om",
      "targetLanguage": "am",
      "scheduledStartTime": null,
      "actualStartTime": "2026-11-06T09:15:00Z",
      "actualEndTime": "2026-11-06T09:28:45Z",
      "durationSeconds": 825,
      "cancellationReason": null,
      "completionNotes": "Patient intake and triage assessment completed successfully.",
      "createdAt": "2026-11-06T09:14:30Z",
      "updatedAt": "2026-11-06T09:28:45Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 1,
    "totalPages": 1
  }
}
```

---

### 2. Session Event History: `GET /api/sessions/{id}/history/`
Returns the append-only audit trail for the session.

**Response (HTTP 200)**:
```json
{
  "sessionId": "b386d68d-673d-41d0-944f-d672f8a19381",
  "sessionReference": "SES-2026-A19F80",
  "history": [
    {
      "id": 101,
      "eventType": "session_created",
      "description": "Interpretation session SES-2026-A19F80 created for request REQ-2026-10821.",
      "actorId": "usr-client-common-1",
      "timestamp": "2026-11-06T09:14:30Z",
      "metadata": { "mode": "video", "sourceLanguage": "om", "targetLanguage": "am" }
    },
    {
      "id": 102,
      "eventType": "interpreter_assigned",
      "description": "Interpreter Chaltu Kebede assigned to session.",
      "actorId": "int-1",
      "timestamp": "2026-11-06T09:14:35Z",
      "metadata": { "interpreterId": "int-1" }
    },
    {
      "id": 103,
      "eventType": "customer_joined",
      "description": "Tikur Anbessa ER Bay 2 (customer) joined session.",
      "actorId": "usr-client-common-1",
      "timestamp": "2026-11-06T09:14:50Z",
      "metadata": { "role": "customer", "deviceType": "web" }
    },
    {
      "id": 104,
      "eventType": "interpreter_joined",
      "description": "Chaltu Kebede (interpreter) joined session.",
      "actorId": "int-1",
      "timestamp": "2026-11-06T09:15:00Z",
      "metadata": { "role": "interpreter", "deviceType": "flutter_android" }
    },
    {
      "id": 105,
      "eventType": "call_started",
      "description": "Live call started between customer and interpreter.",
      "actorId": "system",
      "timestamp": "2026-11-06T09:15:00Z",
      "metadata": { "actualStartTime": "2026-11-06T09:15:00Z" }
    },
    {
      "id": 106,
      "eventType": "session_completed",
      "description": "Session completed. Duration: 825s.",
      "actorId": "usr-client-common-1",
      "timestamp": "2026-11-06T09:28:45Z",
      "metadata": { "durationSeconds": 825 }
    }
  ]
}
```

---

### 3. Session Statistics: `GET /api/sessions/statistics/`

**Response (HTTP 200)**:
```json
{
  "success": true,
  "role": "platform_admin",
  "statistics": {
    "summary": {
      "totalSessions": 128,
      "activeSessions": 3,
      "completedSessions": 114,
      "cancelledSessions": 9,
      "failedSessions": 2,
      "pendingSessions": 0,
      "readySessions": 0,
      "totalDurationSeconds": 105420,
      "averageDurationSeconds": 924.7,
      "totalInterpretationMinutes": 1757.0
    },
    "byInterpreter": {
      "Chaltu Kebede": 42,
      "Tewodros Kassahun": 38,
      "Fatuma Ali": 34
    },
    "byCustomer": {
      "Tikur Anbessa Hospital": 68,
      "St. Paul's Hospital Millennium": 41,
      "Federal First Instance Court": 19
    },
    "byLanguagePair": {
      "OM -> AM": 54,
      "TI -> AM": 39,
      "SO -> AM": 23,
      "SID -> AM": 12
    },
    "timeline": [
      {
        "date": "2026-11-06",
        "counts": { "completed": 12, "active": 3, "cancelled": 1 },
        "total": 16
      }
    ]
  }
}
```

---

## 4. Applying PostgreSQL Database Migrations

To apply the migrations to your PostgreSQL database:

```bash
cd orozo/backend

# Ensure DATABASE_URL is set in .env:
# DATABASE_URL=postgres://orzo_user:orzo_pass@localhost:5432/orzo_db

# Run migrations
py manage.py migrate
# or on Linux / Docker:
python manage.py migrate
```

Or when running Docker:
```bash
docker compose up --build
```
Migrations apply automatically on container boot.
