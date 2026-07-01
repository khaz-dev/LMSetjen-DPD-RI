#!/usr/bin/env python
"""
🔒 SECURITY HARDENING VALIDATION SCRIPT
Validates all penetration test security fixes are in place
Run before deployment to staging server
"""

import os
import sys
import django
from pathlib import Path

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.conf import settings
from rest_framework.throttling import BaseThrottle
import logging

logger = logging.getLogger(__name__)
print("=" * 80)
print("🔒 SECURITY HARDENING VALIDATION")
print("=" * 80)

PASS = "✅"
FAIL = "❌"
WARN = "⚠️"

total_checks = 0
passed_checks = 0
failed_checks = 0

def check(name, condition, critical=False):
    """Check a security setting"""
    global total_checks, passed_checks, failed_checks
    total_checks += 1
    
    if condition:
        passed_checks += 1
        print(f"{PASS} {name}")
        return True
    else:
        failed_checks += 1
        severity = "CRITICAL" if critical else "WARNING"
        print(f"{FAIL} {name} [{severity}]")
        return False

print("\n1️⃣ DJANGO CORE SETTINGS")
print("-" * 80)

# Check SECRET_KEY
if hasattr(settings, 'SECRET_KEY'):
    is_default_secret = settings.SECRET_KEY == 'django-insecure-+c@7t#q96f*r#f-@ss1$2r5a3!xi59@8(o21u-8x%s%vmh4#tc'
    is_empty = not settings.SECRET_KEY or len(settings.SECRET_KEY) < 50
    check("SECRET_KEY is strong and unique", not is_default_secret and not is_empty, critical=True)
else:
    check("SECRET_KEY is defined", False, critical=True)

# Check DEBUG
check("DEBUG is False", settings.DEBUG == False, critical=True)

# Check ALLOWED_HOSTS
check("ALLOWED_HOSTS is configured", 
      isinstance(settings.ALLOWED_HOSTS, list) and len(settings.ALLOWED_HOSTS) > 0,
      critical=True)

print("\n2️⃣ DATABASE SECURITY")
print("-" * 80)

db_config = settings.DATABASES.get('default', {})
check("Database ENGINE is PostgreSQL", 
      'postgresql' in db_config.get('ENGINE', ''),
      critical=True)
check("Database NAME is not default", 
      db_config.get('NAME') and db_config.get('NAME') != 'lms_db',
      critical=True)
check("Database USER is not default", 
      db_config.get('USER') and db_config.get('USER') != 'lms_user',
      critical=True)
check("Database PASSWORD is not default", 
      db_config.get('PASSWORD') and db_config.get('PASSWORD') != 'secure_password',
      critical=True)

# Check SSL mode
ssl_mode = db_config.get('OPTIONS', {}).get('sslmode', 'disable')
check("Database SSL/TLS enabled for production", 
      ssl_mode in ['allow', 'prefer', 'require'] or settings.DEBUG,
      critical=not settings.DEBUG)

print("\n3️⃣ SECURITY HEADERS")
print("-" * 80)

check("SECURE_SSL_REDIRECT enabled", getattr(settings, 'SECURE_SSL_REDIRECT', False) or settings.DEBUG)
check("SECURE_HSTS_SECONDS configured", getattr(settings, 'SECURE_HSTS_SECONDS', 0) > 0 or settings.DEBUG)
check("SECURE_CONTENT_TYPE_NOSNIFF enabled", getattr(settings, 'SECURE_CONTENT_TYPE_NOSNIFF', False))
check("SECURE_BROWSER_XSS_FILTER enabled", getattr(settings, 'SECURE_BROWSER_XSS_FILTER', False))
check("X_FRAME_OPTIONS is DENY", getattr(settings, 'X_FRAME_OPTIONS', '') == 'DENY')

print("\n4️⃣ SESSION & COOKIE SECURITY")
print("-" * 80)

check("SESSION_COOKIE_SECURE enabled", 
      getattr(settings, 'SESSION_COOKIE_SECURE', False) or settings.DEBUG)
check("SESSION_COOKIE_HTTPONLY enabled", getattr(settings, 'SESSION_COOKIE_HTTPONLY', False))
check("SESSION_COOKIE_SAMESITE configured", 
      getattr(settings, 'SESSION_COOKIE_SAMESITE', None) in ['Strict', 'Lax'])
check("CSRF_COOKIE_SECURE enabled", 
      getattr(settings, 'CSRF_COOKIE_SECURE', False) or settings.DEBUG)
check("CSRF_COOKIE_HTTPONLY enabled", getattr(settings, 'CSRF_COOKIE_HTTPONLY', False))

print("\n5️⃣ CORS & CSRF PROTECTION")
print("-" * 80)

cors_allow_all = getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', False)
check("CORS_ALLOW_ALL_ORIGINS is False", cors_allow_all == False, critical=True)
check("CORS_ALLOWED_ORIGINS configured", 
      isinstance(getattr(settings, 'CORS_ALLOWED_ORIGINS', []), list) and len(settings.CORS_ALLOWED_ORIGINS) > 0,
      critical=True)
check("CSRF_TRUSTED_ORIGINS configured",
      isinstance(getattr(settings, 'CSRF_TRUSTED_ORIGINS', []), list) and len(settings.CSRF_TRUSTED_ORIGINS) > 0,
      critical=True)

print("\n6️⃣ JWT TOKEN SECURITY")
print("-" * 80)

simple_jwt = getattr(settings, 'SIMPLE_JWT', {})
access_lifetime = simple_jwt.get('ACCESS_TOKEN_LIFETIME')
refresh_lifetime = simple_jwt.get('REFRESH_TOKEN_LIFETIME')

# Check access token lifetime (should be 15 minutes = 900 seconds)
if access_lifetime:
    access_seconds = int(access_lifetime.total_seconds())
    check("Access token lifetime <= 15 minutes", access_seconds <= 900, critical=True)
else:
    check("Access token lifetime configured", False, critical=True)

# Check refresh token lifetime (should be 7 days max)
if refresh_lifetime:
    refresh_seconds = int(refresh_lifetime.total_seconds())
    check("Refresh token lifetime <= 7 days", refresh_seconds <= 604800, critical=True)
else:
    check("Refresh token lifetime configured", False, critical=True)

print("\n7️⃣ PASSWORD SECURITY")
print("-" * 80)

validators = getattr(settings, 'AUTH_PASSWORD_VALIDATORS', [])
has_min_length = any('MinimumLength' in v.get('NAME', '') for v in validators)
check("Password minimum length validator enabled", has_min_length)
check("Password validators configured", len(validators) >= 2)

print("\n8️⃣ RATE LIMITING")
print("-" * 80)

throttle_classes = getattr(settings, 'DEFAULT_THROTTLE_CLASSES', [])
has_throttling = len(throttle_classes) > 0
check("DRF rate limiting configured", has_throttling)

throttle_rates = settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {})
check("Anonymous user throttling configured", 'anon' in throttle_rates)
check("Authenticated user throttling configured", 'user' in throttle_rates)

print("\n9️⃣ LOGGING")
print("-" * 80)

logging_config = getattr(settings, 'LOGGING', {})
check("Logging configuration defined", len(logging_config) > 0)
check("Security logger configured", 'security' in logging_config.get('loggers', {}))
check("Error logging configured", 'django' in logging_config.get('loggers', {}))

print("\n🔟 FILE UPLOAD SECURITY")
print("-" * 80)

data_upload_max = getattr(settings, 'DATA_UPLOAD_MAX_MEMORY_SIZE', 0)
file_upload_max = getattr(settings, 'FILE_UPLOAD_MAX_MEMORY_SIZE', 0)

check("Data upload max memory configured", data_upload_max > 0)
check("Data upload max memory <= 5MB", data_upload_max <= 5242880)
check("File upload max memory configured", file_upload_max > 0)
check("File upload max memory <= 10MB", file_upload_max <= 10485760)

print("\n" + "=" * 80)
print(f"📊 SECURITY VALIDATION RESULTS")
print("=" * 80)
print(f"Total Checks: {total_checks}")
print(f"{PASS} Passed: {passed_checks}")
print(f"{FAIL} Failed: {failed_checks}")
print(f"Success Rate: {(passed_checks/total_checks*100):.1f}%")

if failed_checks == 0:
    print(f"\n{PASS} ALL SECURITY CHECKS PASSED!")
    print("\n✅ Ready for penetration testing on staging server")
    print("Server: https://lms.khaz.app/")
    sys.exit(0)
else:
    print(f"\n{FAIL} {failed_checks} SECURITY CHECKS FAILED")
    print("\n❌ Fix all failures before deployment")
    sys.exit(1)
