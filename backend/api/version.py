"""
LMSetjen DPD RI - Application Version
Single source of truth for the app version, read from the root VERSION file.
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
        return "unknown"


APP_VERSION: str = _read_version()
APP_NAME: str = "LMSetjen DPD RI"
