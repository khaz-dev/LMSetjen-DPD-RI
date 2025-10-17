#!/usr/bin/env python
"""
Script to create a Django superuser for LMS
"""
from django.contrib.auth import get_user_model

User = get_user_model()

# Superuser credentials
USERNAME = 'admin'
EMAIL = 'admin@lmsetjen.dpd.go.id'
PASSWORD = 'Admin@LMS2025!'

# Create or update superuser
user, created = User.objects.get_or_create(
    username=USERNAME,
    defaults={
        'email': EMAIL,
        'is_staff': True,
        'is_superuser': True,
        'is_active': True,
    }
)

if created:
    user.set_password(PASSWORD)
    user.save()
    print(f"✅ Superuser '{USERNAME}' created successfully!")
    print(f"   Email: {EMAIL}")
    print(f"   Password: {PASSWORD}")
else:
    # Update password for existing user
    user.set_password(PASSWORD)
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    user.save()
    print(f"✅ Superuser '{USERNAME}' already exists - password updated!")
    print(f"   Email: {EMAIL}")
    print(f"   Password: {PASSWORD}")

print(f"\n🔗 Login at: http://16.79.83.21/admin/")
