# ORZO field client

Flutter app for desk and field staff. It is the client. The staff web portal stays in the repository root, and this app talks to the Django API in `orozo/backend`.

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

The intro uses the category images from `assets/intro/`, which match `orozo/categories/*/cover.jpg`.
