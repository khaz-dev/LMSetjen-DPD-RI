#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
import warnings

# Suppress pkg_resources deprecation warnings from rest_framework_simplejwt
warnings.filterwarnings("ignore", category=UserWarning, module="rest_framework_simplejwt")


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    
    # Auto-configure runserver port from DJANGO_PORT env var (defaults to 8001)
    if len(sys.argv) > 1 and sys.argv[1] == 'runserver':
        django_port = os.environ.get('DJANGO_PORT', '8001')
        # Only add port if not already specified in command line
        if len(sys.argv) == 2 or (len(sys.argv) > 2 and not sys.argv[2].replace('.', '').replace(':', '').replace('0-9', '').isdigit()):
            sys.argv.insert(2, f'0.0.0.0:{django_port}')
    
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
