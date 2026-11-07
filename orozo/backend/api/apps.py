from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"
    verbose_name = "Platform administration"

    def ready(self):
        from django.db.models.signals import post_migrate

        def seed(sender, **kwargs):
            if getattr(sender, "name", None) not in {"api", "communications"}:
                return
            from .seed_data import seed_if_empty

            seed_if_empty()

        post_migrate.connect(seed, dispatch_uid="orzo-api-seed")
