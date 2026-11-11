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
APPEND_SLASH = True

INSTALLED_APPS = [
    "jazzmin",
    "import_export",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "api",
    "communications",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Database Configuration: PostgreSQL (via DB_* env vars or DATABASE_URL) or SQLite fallback
db_name = os.getenv("DB_NAME", "orzo_db")
db_user = os.getenv("DB_USER", "postgres")
db_password = os.getenv("DB_PASSWORD", "")
db_host = os.getenv("DB_HOST", "localhost")
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
STATICFILES_DIRS = [BASE_DIR / "static"]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LOGIN_REDIRECT_URL = "/admin/"
LOGOUT_REDIRECT_URL = "/admin/login/"

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
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
LIVEKIT_TOKEN_TTL_SECONDS = int(os.getenv("LIVEKIT_TOKEN_TTL_SECONDS", "1800"))

JAZZMIN_SETTINGS = {
    "site_title": "ORZO Admin",
    "site_header": "ORZO",
    "site_brand": "Platform admin",
    "site_logo": "admin/orzo-logo.png",
    "login_logo": "admin/orzo-logo.png",
    "site_logo_classes": "img-circle elevation-2",
    "site_icon": "admin/orzo-logo.png",
    "welcome_sign": "Platform Administration & Audit",
    "copyright": "ORZO Translation & Interpretation",
    "search_model": ["api.Account", "api.InterpretationRequest", "api.Interpreter"],
    "user_avatar": None,
    "topmenu_links": [
        {"name": "Web platform admin", "url": "http://localhost:3000", "new_window": True},
        {"name": "Organizations", "url": "/admin/api/account/?role__exact=client"},
        {"name": "Languages", "url": "/admin/api/language/"},
        {"name": "Accreditation", "url": "/admin/api/interpreter/"},
        {"name": "Configuration", "url": "/admin/platform-configuration/"},
        {"name": "Audit logs", "url": "/admin/security-audit/"},
    ],
    "show_sidebar": True,
    "navigation_expanded": True,
    "hide_apps": ["communications"],
    "hide_models": ["auth.group"],
    "order_with_respect_to": ["api", "communications", "auth"],
    "icons": {
        "auth": "fas fa-users-cog",
        "auth.user": "fas fa-user-shield",
        "auth.group": "fas fa-users",
        "api.account": "fas fa-id-badge",
        "api.language": "fas fa-language",
        "api.interpreter": "fas fa-headset",
        "api.interpretationrequest": "fas fa-notes-medical",
        "api.interpretationsession": "fas fa-video",
        "communications.interpretationsession": "fas fa-broadcast-tower",
        "communications.sessionparticipant": "fas fa-user-friends",
        "communications.sessionevent": "fas fa-stream",
    },
    "default_icon_parents": "fas fa-folder",
    "default_icon_children": "fas fa-circle",
    "related_modal_active": True,
    "custom_css": "admin/orzo-admin.css",
    "custom_js": None,
    "use_google_fonts_cdn": True,
    "show_ui_builder": False,
    "changeform_format": "horizontal_tabs",
    "changeform_format_overrides": {
        "auth.user": "collapsible",
        "auth.group": "vertical_tabs",
    },
}

JAZZMIN_UI_TWEAKS = {
    "navbar_small_text": False,
    "footer_small_text": False,
    "body_small_text": False,
    "brand_small_text": False,
    "brand_colour": "navbar-primary",
    "accent": "accent-primary",
    "navbar": "navbar-dark",
    "no_navbar_border": True,
    "navbar_fixed": True,
    "layout_boxed": False,
    "footer_fixed": False,
    "sidebar_fixed": True,
    "sidebar": "sidebar-dark-primary",
    "sidebar_nav_small_text": False,
    "sidebar_disable_expand": False,
    "sidebar_nav_child_indent": True,
    "sidebar_nav_compact_style": False,
    "sidebar_nav_legacy_style": False,
    "sidebar_nav_flat_style": True,
    "theme": "flatly",
    "dark_mode_theme": "darkly",
    "button_classes": {
        "primary": "btn-primary",
        "secondary": "btn-outline-secondary",
        "info": "btn-info",
        "warning": "btn-warning",
        "danger": "btn-danger",
        "success": "btn-success",
    },
    "actions_sticky_top": True,
}
