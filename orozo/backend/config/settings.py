"""ORZO client API settings. Development & Docker production-ready."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Auto-load .env file if present
env_file = BASE_DIR / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip("'\"")
            if k and k not in os.environ:
                os.environ[k] = v

SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-orzo-change-before-any-real-deployment")
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1")
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",")
APPEND_SLASH = False

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "corsheaders",
    "api",
    "communications",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Database Configuration: PostgreSQL (via DB_* env vars or DATABASE_URL) or SQLite fallback
db_name = os.getenv("DB_NAME", "")
db_user = os.getenv("DB_USER", "")
db_password = os.getenv("DB_PASSWORD", "")
db_host = os.getenv("DB_HOST", "")
db_port = os.getenv("DB_PORT", "5432")
database_url = os.getenv("DATABASE_URL", "")

if db_name:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": db_name,
            "USER": db_user or "postgres",
            "PASSWORD": db_password,
            "HOST": db_host or "localhost",
            "PORT": int(db_port) if db_port else 5432,
        }
    }
elif database_url.startswith("postgres://") or database_url.startswith("postgresql://"):
    import urllib.parse
    parsed = urllib.parse.urlparse(database_url)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": parsed.path.lstrip("/"),
            "USER": parsed.username or "postgres",
            "PASSWORD": urllib.parse.unquote(parsed.password or ""),
            "HOST": parsed.hostname or "localhost",
            "PORT": parsed.port or 5432,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Addis_Ababa"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOW_ALL_ORIGINS = True
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = "ORZO <noreply@orzo.et>"

CORS_ALLOW_HEADERS = [
    "accept",
    "authorization",
    "content-type",
    "origin",
    "x-account-id",
    "x-csrftoken",
    "x-requested-with",
]

# LiveKit WebRTC Configuration
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://orozo-translation-8nvelq7r.livekit.cloud")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "API7DMjTx8g4u3b")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "nKCl9pHbPDW5ek50BJRQX55NWTcA4WV5eDegI5RAOsUA")
LIVEKIT_TOKEN_TTL_SECONDS = int(os.getenv("LIVEKIT_TOKEN_TTL_SECONDS", "1800"))
