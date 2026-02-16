#!/usr/bin/env python
"""
Quick setup script for local development
Initializes database and creates superuser
"""

import os
import sys
from pathlib import Path

# Set up path to find Django settings
backend_path = str(Path(__file__).parent / 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

import django
django.setup()

from django.core.management import call_command
from django.contrib.auth import get_user_model

User = get_user_model()

print("\n" + "=" * 80)
print("🚀 LMSetjen DPD RI - Local Development Setup")
print("=" * 80 + "\n")

# 1. Run migrations
print("📦 Running database migrations...")
try:
    call_command('migrate', verbosity=1)
    print("✅ Migrations completed\n")
except Exception as e:
    print(f"❌ Migration error: {e}\n")
    sys.exit(1)

# 2. Create superuser if doesn't exist
print("👤 Creating admin account...")
try:
    admin_user, created = User.objects.get_or_create(
        email='admin@lmsetjen.dpd.go.id',
        defaults={
            'username': 'admin',
            'full_name': 'System Administrator',
            'is_staff': True,
            'is_superuser': True,
            'is_active': True,
        }
    )
    
    if created:
        admin_user.set_password('Admin@LMS2025!')
        admin_user.save()
        print(f"✅ Created admin: admin@lmsetjen.dpd.go.id / Admin@LMS2025!\n")
    else:
        print(f"ℹ️  Admin already exists: {admin_user.email}\n")
        
except Exception as e:
    print(f"⚠️  Admin creation skipped: {e}\n")

# 3. Collect static files (optional, but good to do)
print("📁 Collecting static files...")
try:
    call_command('collectstatic', interactive=False, verbosity=0)
    print("✅ Static files collected\n")
except Exception as e:
    print(f"⚠️  Static files warning: {e}\n")

print("=" * 80)
print("✅ SETUP COMPLETE!")
print("=" * 80)
print("\n🔗 Next steps:")
print("   cd backend")
print("   python manage.py runserver")
print("   Open http://localhost:8001/admin")
print("   Login with: admin@lmsetjen.dpd.go.id / Admin@LMS2025!")
print("\n")
