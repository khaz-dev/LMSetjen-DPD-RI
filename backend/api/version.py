"""
LMSetjen DPD RI - Application Version
Single source of truth for the app version, read from database or the root VERSION file.
"""
import os

def _read_version() -> str:
    """Read version from the root VERSION file."""
    try:
        # Go up from backend/api/ → backend/ → project root
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        version_file = os.path.join(base_dir, "VERSION")
        with open(version_file, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return "1.0.1"


def get_current_app_version() -> str:
    """Get active version from database or fallback to file."""
    try:
        from api.models import SystemRelease
        current = SystemRelease.objects.filter(is_current=True).first()
        if current and current.version:
            return current.version
    except Exception:
        pass
    return _read_version()


APP_VERSION: str = _read_version()
APP_NAME: str = "LMSetjen DPD RI"
