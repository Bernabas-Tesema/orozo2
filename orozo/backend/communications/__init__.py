"""ORZO Communications Application.
Secure LiveKit audio and video interpretation session integration.
"""

from ._django_compat import setup_django_compat

setup_django_compat()

default_app_config = "communications.apps.CommunicationsConfig"
