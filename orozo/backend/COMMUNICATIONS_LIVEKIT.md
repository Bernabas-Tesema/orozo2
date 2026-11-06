# ORZO Ethiopian Language Interpretation Platform
## Secure LiveKit Audio & Video Real-Time Communication Integration Specification

### 1. Architecture Overview

The `communications` application provides secure, production-grade WebRTC audio and video calling between healthcare clients (or field customers) and certified Ethiopian language interpreters (Afaan Oromoo, Amharic, Tigrinya, Somali, Sidama, Wolaytta, etc.).

```
+--------------------------------------------------------------------------------+
|                                    CLIENTS                                     |
|   +------------------------------------+   +-------------------------------+   |
|   |  React Web Client (Triage Terminal)|   | Flutter Field App (Interpreter)|  |
|   +-----------------+------------------+   +---------------+---------------+   |
+---------------------|--------------------------------------|-------------------+
                      |                                      |
                      | 1. Authenticated REST Requests        |
                      v                                      v
+--------------------------------------------------------------------------------+
|                             ORZO DJANGO BACKEND                                |
|                                                                                |
|   +------------------------------------------------------------------------+   |
|   | URL Routing: /api/communications/                                      |   |
|   +------------------------------------+-----------------------------------+   |
|                                        |                                       |
|                                        v                                       |
|   +------------------------------------------------------------------------+   |
|   | Views & Permissions (RBAC, IDOR Prevention, Token Request Validation)   |   |
|   +------------------------------------+-----------------------------------+   |
|                                        |                                       |
|                                        v                                       |
|   +------------------------------------------------------------------------+   |
|   | Domain Services:                                                       |   |
|   |   * TokenService: 9-step security verification & JWT VideoGrants       |   |
|   |   * SessionService: Atomic transitions & server duration calculation   |   |
|   |   * RoomService: Opaque unique room names (rm_orzo_*) & room controls  |   |
|   |   * ParticipantService: Join/leave/disconnect tracking                 |   |
|   |   * LiveKitService: RFC 7519 JWT generator & HMAC-SHA256 verifier      |   |
|   +------------------------------------+-----------------------------------+   |
|                                        |                                       |
|                                        v                                       |
|   +------------------------------------------------------------------------+   |
|   | Database Persistence (PostgreSQL):                                     |   |
|   |   * CommunicationSession                                               |   |
|   |   * SessionParticipant                                                 |   |
|   |   * SessionEvent (Comprehensive Audit Trail)                           |   |
|   +------------------------------------+-----------------------------------+   |
+----------------------------------------|---------------------------------------+
                                         |
                                         | 2. Webhook Event Stream (Signed)
                                         v
+--------------------------------------------------------------------------------+
|                             LIVEKIT SERVER CLOUD                               |
|   * WebRTC SFU Media Plane (Microphone & Camera RTP/SRTP)                      |
|   * Room Lifecycle Management & Participant Sync                               |
+--------------------------------------------------------------------------------+
```

---

### 2. LiveKit Configuration

Configure the following environment variables in `.env` (derived from `.env.example`):

```bash
LIVEKIT_URL=wss://livekit.orzo.et
LIVEKIT_API_KEY=dev_orzo_key
LIVEKIT_API_SECRET=dev_orzo_secret
LIVEKIT_TOKEN_TTL_SECONDS=1800
```

> **Security Guardrail**: Never expose `LIVEKIT_API_SECRET` or the API Key to client-side code (React or Flutter). Tokens are issued solely by the Django backend upon successful authorization.

---

### 3. Data Models

#### `CommunicationSession`
- `session_id`: Unique identifier (e.g. `SES-ABCD1234`).
- `request_reference`: Related `InterpretationRequest` reference.
- `room_name`: Opaque random string (e.g. `rm_orzo_7c19a0e67fb64023`). Never leaks internal IDs.
- `communication_mode`: `audio` (audio-only) or `video` (two-way video).
- `status`: `pending` -> `ready` -> `active` -> `completed` / `cancelled` / `failed`.
- `scheduled_start_time`, `actual_start_time`, `actual_end_time`.
- `duration_seconds`: **Server-authoritative** duration calculated from timestamps upon completion.
- `created_by`, `created_at`, `updated_at`.

#### `SessionParticipant`
- `session`: Foreign key to `CommunicationSession`.
- `user_id`: Unique identifier of the authenticated user.
- `user_name`: Display name of user.
- `role`: `customer`, `interpreter`, or `coordinator`.
- `status`: `authorized`, `joined`, `disconnected`, `left`.
- `joined_at`, `left_at`, `created_at`.
- Constraint: `unique_together = ("session", "user_id")`.

#### `SessionEvent`
- `session`: Foreign key to `CommunicationSession`.
- `event_type`: Audit type (`session_created`, `room_created`, `participant_authorized`, `participant_joined`, `participant_left`, `participant_disconnected`, `track_published`, `track_unpublished`, `session_started`, `session_completed`, `session_cancelled`, `room_closed`, `provider_error`).
- `participant_id`: User identifier.
- `timestamp`: Server timestamp.
- `metadata`: JSON payload containing context (never logs raw JWT secrets).

---

### 4. Nine-Step Security Verification Rules for Token Generation

Before `TokenService.generate_participant_token()` issues a LiveKit JWT token, all 9 security checks are strictly enforced in sequence:

1. **Authentication Check**: Requester has a valid authenticated session (`user_id` is present).
2. **Session Validity**: The session exists and contains a valid identifier.
3. **Participant Membership**: Requester is an authorized participant in the session (or a platform supervisor/coordinator).
4. **Role Integrity**: Requester's claims match their assigned role (`customer` vs `interpreter`).
5. **Request Eligibility**: Session is tied to an active, valid interpretation request reference.
6. **Session State Check**: Session is in `ready` or `active` status.
7. **Terminal State Guard**: Rejects token requests if session is `completed`, `cancelled`, or `failed` (HTTP 409 Conflict).
8. **User Blocking & Sanctions**: Ensures user is not restricted or blocked.
9. **Modality & Media Restriction**: Restricts media publish permissions based on `communication_mode` (in `audio` mode, only `microphone` is granted; `camera` is restricted unless `video` mode was agreed upon).

---

### 5. API Reference

All communication endpoints are mounted at `/api/communications/`.

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/sessions/` | `POST` | Customer / Coord | Create or retrieve an active communication session |
| `/sessions/<id>/status/` | `GET` | Participants | Get live session status and participant states |
| `/sessions/<id>/token/` | `POST` | Participants | Validate and obtain cryptographic LiveKit access token |
| `/sessions/<id>/join/` | `POST` | Participants | Mark participant as joined and transition session to `active` |
| `/sessions/<id>/leave/` | `POST` | Participants | Mark participant as left |
| `/sessions/<id>/end/` | `POST` | Assigned / Coord | Complete session, compute duration, and close room |
| `/sessions/<id>/cancel/` | `POST` | Creator / Coord | Cancel session and close room |
| `/sessions/<id>/participants/` | `GET` | Participants | List all participants and their current states |
| `/webhooks/livekit/` | `POST` | LiveKit Server | Ingest signed LiveKit events with HMAC-SHA256 verification |

#### Token Generation Response
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "url": "wss://livekit.orzo.et",
  "room": "rm_orzo_7c19a0e67fb64023",
  "sessionId": "SES-ABCD1234",
  "identity": "usr-client-ER2",
  "role": "customer",
  "communicationMode": "audio",
  "expiresInSeconds": 1800
}
```

---

### 6. Webhook Signature Verification

The webhook receiver at `/api/communications/webhooks/livekit/` performs:
1. Extraction of the `Authorization` header bearer token containing the SHA-256 digest claim of the body.
2. Verification of HMAC-SHA256 signature using `LIVEKIT_API_SECRET`.
3. Strict comparison between computed SHA-256 digest of the raw body bytes and the payload claim.
4. Idempotent dispatching to `SessionService` and `ParticipantService`.

---

### 7. Client Integration Guides

#### React Web Application (e.g. Triage Terminal)
```typescript
import { Room, RoomEvent } from "livekit-client";

// 1. Fetch token from backend
const response = await fetch(`/api/communications/sessions/${sessionId}/token/`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${userJwt}` }
});
const { token, url, room } = await response.json();

// 2. Connect to LiveKit SFU
const roomInstance = new Room({
  adaptiveStream: true,
  dynacast: true,
});

await roomInstance.connect(url, token);

// 3. Publish local tracks
if (communicationMode === "video") {
  await roomInstance.localParticipant.enableCameraAndMicrophone();
} else {
  await roomInstance.localParticipant.setMicrophoneEnabled(true);
}
```

#### Flutter Field Client
```dart
import 'package:livekit_client/livekit_client.dart';

// Connect using received token
final room = Room();
final listener = room.createListener();

await room.connect(serverUrl, token);
await room.localParticipant?.setMicrophoneEnabled(true);
if (communicationMode == 'video') {
  await room.localParticipant?.setCameraEnabled(true);
}
```
