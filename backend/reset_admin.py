#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.contrib.auth import get_user_model

def main():
    User = get_user_model()
    
    print("=== CURRENT SUPERUSER ACCOUNTS ===")
    admin_users = User.objects.filter(is_superuser=True)
    
    if admin_users.exists():
        for user in admin_users:
            print(f"- Username: {user.username}")
            print(f"  Email: {user.email}")
            print(f"  Active: {user.is_active}")
            print(f"  Last Login: {user.last_login}")
            print("")
    else:
        print("No superuser accounts found.")
    
    print("=== RESETTING/CREATING ADMIN USER ===")
    
    # Get or create admin user
    admin, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@localhost',
            'is_staff': True,
            'is_superuser': True,
        }
    )
    
    # Set password
    admin.set_password('admin123')
    admin.email = 'admin@localhost'
    admin.is_staff = True
    admin.is_superuser = True
    admin.is_active = True
    admin.save()
    
    if created:
        print("✅ New admin user created successfully!")
    else:
        print("✅ Existing admin user updated successfully!")
    
    print("\n" + "="*50)
    print("🔑 ADMIN LOGIN CREDENTIALS:")
    print("="*50)
    print(f"🌐 Admin URL: http://127.0.0.1:8000/admin/")
    print(f"👤 Username: admin")
    print(f"🔒 Password: admin123")
    print(f"📧 Email: admin@localhost")
    print("="*50)
    print("\nYou can now login to the Django Admin Panel!")

if __name__ == '__main__':
    main()