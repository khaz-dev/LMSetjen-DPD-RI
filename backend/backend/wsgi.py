"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# Try to use dj_static for production, but fall back to basic WSGI for development
try:
    from static_ranges import Ranges
    from dj_static import Cling, MediaCling
    application = Ranges(Cling(MediaCling(get_wsgi_application())))
except ImportError:
    # dj_static not installed - use basic WSGI (fine for development)
    application = get_wsgi_application()
