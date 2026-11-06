from django.apps import AppConfig


class CommunicationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "communications"
    verbose_name = "LiveKit Real-Time Communications"

    def ready(self):
        # Validate LiveKit environment configuration on startup
        from .services.livekit_service import LiveKitConfig
        is_valid, msg = LiveKitConfig.validate()
        if not is_valid:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("LiveKit configuration warning: %s", msg)
