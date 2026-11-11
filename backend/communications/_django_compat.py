"""Django & DRF compatibility shim for environments where Django is not yet installed.
Allows communications domain services, models, tokens, and webhooks to be tested
and executed standalone without external dependencies.
"""

import sys
from datetime import datetime, timezone as py_timezone
from types import ModuleType
from typing import Any, Dict, List, Optional


def setup_django_compat():
    if "django" in sys.modules and hasattr(sys.modules["django"], "db"):
        return

    try:
        import django  # type: ignore # noqa: F401
        import django.db.models  # type: ignore # noqa: F401
        return
    except (ImportError, AttributeError):
        pass

    # Build dummy django module hierarchy
    django_mod = ModuleType("django")
    django_mod.__path__ = []
    sys.modules["django"] = django_mod

    # django.utils and django.utils.timezone
    utils_mod = ModuleType("django.utils")
    utils_mod.__path__ = []
    tz_mod = ModuleType("django.utils.timezone")
    class _Timezone:
        @staticmethod
        def now():
            return datetime.now(py_timezone.utc)
    tz_mod.now = _Timezone.now
    tz_mod.utc = py_timezone.utc
    utils_mod.timezone = tz_mod
    django_mod.utils = utils_mod
    sys.modules["django.utils"] = utils_mod
    sys.modules["django.utils.timezone"] = tz_mod

    # django.db and django.db.models
    db_mod = ModuleType("django.db")
    db_mod.__path__ = []
    models_mod = ModuleType("django.db.models")
    models_mod.__path__ = []

    class _QuerySet:
        def __init__(self, items=None):
            self._items = items or []
        def filter(self, *args, **kwargs):
            return self
        def exclude(self, *args, **kwargs):
            return self
        def order_by(self, *args, **kwargs):
            return self
        def select_related(self, *args, **kwargs):
            return self
        def distinct(self, *args, **kwargs):
            return self
        def values(self, *args, **kwargs):
            return self
        def values_list(self, *args, **kwargs):
            return []
        def exists(self):
            return len(self._items) > 0
        def first(self):
            return self._items[0] if self._items else None
        def last(self):
            return self._items[-1] if self._items else None
        def count(self):
            return len(self._items)
        def aggregate(self, *args, **kwargs):
            return {}
        def annotate(self, *args, **kwargs):
            return self
        def create(self, **kwargs):
            return ModelBase(**kwargs)
        def get_or_create(self, **kwargs):
            defaults = kwargs.pop("defaults", {})
            return ModelBase(**{**kwargs, **defaults}), True
        def __iter__(self):
            return iter(self._items)
        def __getitem__(self, item):
            if isinstance(item, slice):
                return self._items[item]
            return self._items[item]
        def __len__(self):
            return len(self._items)

    class _Manager:
        def filter(self, *args, **kwargs):
            return _QuerySet()
        def first(self):
            return None
        def last(self):
            return None
        def create(self, **kwargs):
            return ModelBase(**kwargs)
        def get_or_create(self, **kwargs):
            defaults = kwargs.pop("defaults", {})
            return ModelBase(**{**kwargs, **defaults}), True
        def all(self):
            return _QuerySet()
        def count(self):
            return 0

    class ModelBase:
        objects = _Manager()
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def save(self, *args, **kwargs):
            pass
        def delete(self, *args, **kwargs):
            pass

    class Field:
        def __init__(self, *args, **kwargs):
            self.default = kwargs.get("default", None)
            self.primary_key = kwargs.get("primary_key", False)
            self.choices = kwargs.get("choices", [])
            self.null = kwargs.get("null", False)
            self.blank = kwargs.get("blank", False)

        def __set_name__(self, owner, name):
            self.name = name

        def __get__(self, instance, owner):
            if instance is None:
                return self
            return instance.__dict__.get(self.name, self.default)

        def __set__(self, instance, value):
            instance.__dict__[self.name] = value

    class Q:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs
        def __or__(self, other):
            return self
        def __and__(self, other):
            return self
        def __invert__(self):
            return self

    models_mod.Model = ModelBase
    models_mod.CharField = Field
    models_mod.UUIDField = Field
    models_mod.TextField = Field
    models_mod.BooleanField = Field
    models_mod.FloatField = Field
    models_mod.EmailField = Field
    models_mod.PositiveIntegerField = Field
    models_mod.PositiveSmallIntegerField = Field
    models_mod.DateTimeField = Field
    models_mod.JSONField = Field
    models_mod.ForeignKey = Field
    models_mod.CASCADE = "CASCADE"
    models_mod.SET_NULL = "SET_NULL"
    models_mod.Index = lambda **kw: None
    models_mod.Q = Q

    db_mod.models = models_mod
    django_mod.db = db_mod

    # django.db.transaction
    tx_mod = ModuleType("django.db.transaction")
    def atomic(func):
        return func
    tx_mod.atomic = atomic
    db_mod.transaction = tx_mod

    sys.modules["django.db"] = db_mod
    sys.modules["django.db.models"] = models_mod
    sys.modules["django.db.transaction"] = tx_mod

    # django.http
    import json as py_json
    http_mod = ModuleType("django.http")
    class JsonResponse:
        def __init__(self, data=None, status=200):
            self.data = data
            self.status_code = status
            self.content = py_json.dumps(data).encode("utf-8") if data is not None else b""
    class HttpRequest:
        pass
    http_mod.JsonResponse = JsonResponse
    http_mod.HttpRequest = HttpRequest
    django_mod.http = http_mod
    sys.modules["django.http"] = http_mod

    # django.views.decorators
    views_mod = ModuleType("django.views")
    views_mod.__path__ = []
    decorators_mod = ModuleType("django.views.decorators")
    decorators_mod.__path__ = []
    csrf_mod = ModuleType("django.views.decorators.csrf")
    csrf_mod.csrf_exempt = lambda f: f
    http_dec_mod = ModuleType("django.views.decorators.http")
    http_dec_mod.require_http_methods = lambda methods: (lambda f: f)

    decorators_mod.csrf = csrf_mod
    decorators_mod.http = http_dec_mod
    views_mod.decorators = decorators_mod
    django_mod.views = views_mod
    sys.modules["django.views"] = views_mod
    sys.modules["django.views.decorators"] = decorators_mod
    sys.modules["django.views.decorators.csrf"] = csrf_mod
    sys.modules["django.views.decorators.http"] = http_dec_mod

    # rest_framework dummy
    rf_mod = ModuleType("rest_framework")
    rf_views = ModuleType("rest_framework.views")
    class APIView:
        pass
    rf_views.APIView = APIView

    rf_response = ModuleType("rest_framework.response")
    class Response:
        def __init__(self, data=None, status=200):
            self.data = data
            self.status_code = status
    rf_response.Response = Response

    rf_permissions = ModuleType("rest_framework.permissions")
    class BasePermission:
        pass
    class AllowAny:
        pass
    class IsAuthenticated:
        pass
    rf_permissions.BasePermission = BasePermission
    rf_permissions.AllowAny = AllowAny
    rf_permissions.IsAuthenticated = IsAuthenticated

    rf_status = ModuleType("rest_framework.status")
    rf_status.HTTP_200_OK = 200
    rf_status.HTTP_201_CREATED = 201
    rf_status.HTTP_400_BAD_REQUEST = 400
    rf_status.HTTP_401_UNAUTHORIZED = 401
    rf_status.HTTP_403_FORBIDDEN = 403
    rf_status.HTTP_404_NOT_FOUND = 404
    rf_status.HTTP_500_INTERNAL_SERVER_ERROR = 500

    sys.modules["rest_framework"] = rf_mod
    sys.modules["rest_framework.views"] = rf_views
    sys.modules["rest_framework.response"] = rf_response
    sys.modules["rest_framework.permissions"] = rf_permissions
    sys.modules["rest_framework.status"] = rf_status
