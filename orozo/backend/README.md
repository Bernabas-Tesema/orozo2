# ORZO Django API & Real-Time LiveKit Communications

Client backend supporting the web triage portal and Flutter field apps with secure WebRTC audio and video calling powered by LiveKit Cloud.

---

### Configured LiveKit Cloud Credentials

The following credentials are fully configured in `.env` and `docker-compose.yml`:
- **WebSocket URL**: `wss://orozo-translation-8nvelq7r.livekit.cloud`
- **API Key**: `API7DMjTx8g4u3b`
- **API Secret**: `nKCl9pHbPDW5ek50BJRQX55NWTcA4WV5eDegI5RAOsUA`

---

### Option A: Run Using Python (`py` / `python manage.py runserver`)

1. **Install Dependencies**:
   ```bash
   cd orozo/backend
   pip install -r requirements.txt
   ```

2. **Apply Database Migrations**:
   ```bash
   py manage.py migrate
   # or on macOS / Linux:
   python manage.py migrate
   ```

3. **Start the Development Server**:
   ```bash
   py manage.py runserver 0.0.0.0:8000
   # or on macOS / Linux:
   python manage.py runserver 0.0.0.0:8000
   ```

4. **Run Communications Unit Tests**:
   ```bash
   python communications/tests/run_tests.py
   ```

---

### Option B: Run Using Docker (`docker compose`)

1. **Start the Container**:
   ```bash
   cd orozo/backend
   docker compose up --build
   ```
   *(Or from the repository root: `docker compose up --build`)*

2. **Run in Background**:
   ```bash
   docker compose up -d
   ```

3. **Stop the Container**:
   ```bash
   docker compose down
   ```

---

### Available Endpoints

- Home / Health: `GET http://localhost:8000/`
- API v1: `http://localhost:8000/api/v1/`
- LiveKit Sessions & Tokens: `http://localhost:8000/api/communications/sessions/`
- LiveKit Webhooks: `POST http://localhost:8000/api/communications/webhooks/livekit/`
