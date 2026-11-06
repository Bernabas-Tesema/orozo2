# ORZO

Three separate products. They share the same service categories, and they do not replace each other.

| Product | Folder | Who uses it |
| --- | --- | --- |
| Field client | `app` | Hospital, court, and desk staff on a phone. Flutter. |
| Backend | `backend` | The API the Flutter app calls. Django. |
| Web portal | repository root `src/` | Interpreters, supervisors, admins, and organization consoles. React. Kept as-is. |

## Categories

Each service line has its own folder under `categories/`:

- `healthcare`
- `legal_court`
- `immigration`
- `public_services`
- `ngo_humanitarian`
- `education`
- `business`

Each folder has a `profile.json` and a `cover.jpg`. The Flutter intro animates those same images. Django reads `profile.json` from `GET /api/v1/categories`.

## Run the Django API

```bash
cd orozo/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

`migrate` also loads languages, desk accounts, and interpreters the first time.

## Run the Flutter client

```bash
cd orozo/app
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

Use `http://127.0.0.1:8000/api/v1` on a desktop run, and the computer's LAN address for a physical phone.

The first launch plays an intro: the ORZO mark, then one animated card for each category. Skip lands in intake with that category selected.

## Web portal

From the repository root, `npm run dev` still starts the staff console. The phone control in the header is only an on-screen preview. The field client is this Flutter app.
