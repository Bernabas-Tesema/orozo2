from django.contrib import admin
from django.urls import include, path

from api.views import admin_login_redirect, home

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", admin_login_redirect),
    path("api", home),
    path("api/", home),
    path("api/v1/", include("api.urls")),
    path("api/sessions/", include("communications.urls_direct")),
    path("api/communications/", include("communications.urls")),
]
