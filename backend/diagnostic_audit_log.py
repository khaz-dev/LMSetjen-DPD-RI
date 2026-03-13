#!/usr/bin/env python
"""Diagnostic script to check PointsAuditLog admin visibility"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from api import admin as api_admin
from django.contrib import admin as django_admin

print("=" * 70)
print("POINTS AUDIT LOG ADMIN ACCESSIBILITY DIAGNOSTIC")
print("=" * 70)

# 1. Check if model exists
print("\n1. MODEL EXISTENCE CHECK:")
print("-" * 70)
try:
    print(f"✅ PointsAuditLog model found: {models.PointsAuditLog}")
    print(f"   Model app: {models.PointsAuditLog._meta.app_label}")
    print(f"   Model name: {models.PointsAuditLog._meta.model_name}")
    print(f"   Model verbose name: {models.PointsAuditLog._meta.verbose_name_plural}")
except AttributeError as e:
    print(f"❌ PointsAuditLog model NOT found: {e}")

# 2. Check if PointsAuditLogAdmin class exists
print("\n2. ADMIN CLASS EXISTENCE CHECK:")
print("-" * 70)
try:
    print(f"✅ PointsAuditLogAdmin class found: {api_admin.PointsAuditLogAdmin}")
except AttributeError as e:
    print(f"❌ PointsAuditLogAdmin class NOT found: {e}")

# 3. Check if model is registered with admin site
print("\n3. ADMIN REGISTRATION CHECK:")
print("-" * 70)
registered_models = django_admin.site._registry
print(f"Total registered models: {len(registered_models)}\n")

audit_log_registered = models.PointsAuditLog in registered_models
print(f"PointsAuditLog registered? {audit_log_registered}")

if audit_log_registered:
    print(f"✅ PointsAuditLog IS registered")
    admin_class = registered_models[models.PointsAuditLog]
    print(f"   Admin class: {admin_class.__class__.__name__}")
else:
    print(f"❌ PointsAuditLog IS NOT registered")
    print(f"\n   Registered models include:")
    for model in list(registered_models.keys())[:10]:
        print(f"     - {model._meta.app_label}.{model._meta.model_name}")

# 4. Check data exists
print("\n4. DATA EXISTENCE CHECK:")
print("-" * 70)
audit_log_count = models.PointsAuditLog.objects.count()
print(f"PointsAuditLog records in database: {audit_log_count}")

if audit_log_count > 0:
    print(f"✅ Data exists, accessible at: /admin/api/pointsauditlog/")
    
    # Show sample
    sample = models.PointsAuditLog.objects.first()
    print(f"\nSample record:")
    print(f"  - User: {sample.user.full_name}")
    print(f"  - Points: {sample.points_awarded}")
    print(f"  - Activity: {sample.activity_type}")
    print(f"  - Description: {sample.description}")
else:
    print(f"❌ No data in PointsAuditLog")

# 5. Check for permission issues
print("\n5. PERMISSION INFO:")
print("-" * 70)
try:
    from django.contrib.contenttypes.models import ContentType
    ct = ContentType.objects.get_for_model(models.PointsAuditLog)
    print(f"✅ ContentType for PointsAuditLog found:")
    print(f"   App: {ct.app_label}")
    print(f"   Model: {ct.model}")
    
    # Check if any permissions exist
    from django.contrib.auth.models import Permission
    perms = Permission.objects.filter(content_type=ct)
    print(f"   Permissions: {perms.count()}")
    for perm in perms:
        print(f"     - {perm.codename}: {perm.name}")
except Exception as e:
    print(f"❌ Error checking permissions: {e}")

# 6. Check if it appears in admin site urls
print("\n6. ADMIN URLS CHECK:")
print("-" * 70)

from django.contrib.admin.sites import AdminSite
if hasattr(django_admin.site, 'get_urls'):
    try:
        urls = django_admin.site.get_urls()
        audit_log_urls = [u for u in urls if 'pointsauditlog' in str(u.pattern)]
        if audit_log_urls:
            print(f"✅ Audit log URLs found in admin site")
            for url in audit_log_urls:
                print(f"   - {url.pattern}")
        else:
            print(f"❌ No audit log URLs found in admin site")
    except Exception as e:
        print(f"❌ Error checking URLs: {e}")

print("\n" + "=" * 70)
print("DIAGNOSTIC SUMMARY")
print("=" * 70)

if audit_log_registered and audit_log_count > 0:
    print("✅ AUDIT LOG SHOULD BE VISIBLE IN ADMIN")
    print("\n👉 Access at: http://localhost:8001/admin/api/pointsauditlog/")
    print("\nIf you still can't see it:")
    print("  1. Make sure you're logged in as admin/superuser")
    print("  2. Check browser cache (hard refresh: Ctrl+Shift+R)")
    print("  3. Check that the app 'api' is in INSTALLED_APPS")
    print("  4. Restart Django server")
else:
    print("❌ AUDIT LOG NOT PROPERLY REGISTERED")
    print("\nPossible causes:")
    if not audit_log_registered:
        print("  - Model not registered in admin.site.register()")
        print("  - Admin.py not loaded properly")
        print("  - Django admin autodiscover() not called")
    if audit_log_count == 0:
        print("  - No data generated yet")

print("=" * 70 + "\n")
