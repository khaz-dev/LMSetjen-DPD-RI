#!/usr/bin/env python
"""
Fix Script: Synchronize Boolean Role Fields
Purpose: Ensure all users have correct is_student, is_instructor, is_admin values
Phase: 4.15+
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, '/d/Project/LMSetjen DPD RI/backend')
django.setup()

from userauths.models import User
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()

print("\n" + "="*70)
print("ROLE SYNCHRONIZATION FIX")
print("="*70 + "\n")

# Step 1: Check current state
print("STEP 1: Checking current role synchronization...")
print("-" * 70)

users_with_issues = 0
total_users = User.objects.count()
print(f"Total users: {total_users}\n")

for user in User.objects.all():
    boolean_roles = set(user.get_available_boolean_roles())
    csv_roles = set(r.strip() for r in user.roles.split(',') if r.strip())
    
    # Check current_role validity
    available = user.get_available_boolean_roles()
    current_role_invalid = user.current_role not in available if available else False
    
    if boolean_roles != csv_roles or current_role_invalid:
        users_with_issues += 1
        print(f"❌ {user.email}")
        if boolean_roles != csv_roles:
            print(f"   Boolean: {boolean_roles} vs CSV: {csv_roles}")
        if current_role_invalid:
            print(f"   Invalid current_role: {user.current_role} (available: {available})")

if users_with_issues == 0:
    print("✅ All users have correct role synchronization!")
else:
    print(f"\n⚠️  Found {users_with_issues} users with issues")

# Step 2: Fix synchronization
print("\n\nSTEP 2: Fixing role synchronization...")
print("-" * 70)

fixed_count = 0
invalid_current_role_count = 0

for user in User.objects.all():
    original_state = {
        'is_student': user.is_student,
        'is_instructor': user.is_instructor,
        'is_admin': user.is_admin,
        'current_role': user.current_role
    }
    
    # Sync CSV roles from boolean fields
    user.set_roles_from_boolean()
    
    # Validate and fix current_role if needed
    available = user.get_available_boolean_roles()
    if user.current_role not in available:
        invalid_current_role_count += 1
        old_role = user.current_role
        user.current_role = available[0] if available else 'student'
        print(f"⚠️  Fixed current_role for {user.email}: {old_role} → {user.current_role}")
    
    # Save changes
    user.save()
    fixed_count += 1

print(f"\n✅ Updated {fixed_count} users")
if invalid_current_role_count > 0:
    print(f"⚠️  Fixed {invalid_current_role_count} users with invalid current_role")

# Step 3: Verify fix
print("\n\nSTEP 3: Verifying synchronization...")
print("-" * 70)

verification_issues = 0

for user in User.objects.all():
    boolean_roles = set(user.get_available_boolean_roles())
    csv_roles = set(r.strip() for r in user.roles.split(',') if r.strip())
    
    available = user.get_available_boolean_roles()
    current_role_invalid = user.current_role not in available if available else False
    
    if boolean_roles != csv_roles or current_role_invalid:
        verification_issues += 1
        print(f"❌ {user.email} - Still has issues!")

if verification_issues == 0:
    print(f"✅ All {total_users} users now have correct role synchronization!")
else:
    print(f"⚠️  {verification_issues} users still have issues")

# Step 4: Display sample of fixed data
print("\n\nSTEP 4: Sample of fixed user data...")
print("-" * 70)

for user in User.objects.all()[:3]:
    print(f"\n👤 {user.email}")
    print(f"   is_student: {user.is_student}")
    print(f"   is_instructor: {user.is_instructor}")
    print(f"   is_admin: {user.is_admin}")
    print(f"   current_role: {user.current_role}")
    print(f"   roles (CSV): {user.roles}")
    print(f"   available_roles: {user.get_available_boolean_roles()}")

print("\n" + "="*70)
print("SYNCHRONIZATION COMPLETE")
print("="*70 + "\n")

if verification_issues == 0:
    print("✅ SUCCESS: All users are now synchronized!")
    print("\nFrontend will now correctly check:")
    print("  - is_student boolean field for student access")
    print("  - is_instructor boolean field for instructor access")
    print("  - is_admin boolean field for admin access")
else:
    print(f"⚠️  WARNING: {verification_issues} users still have issues")
    print("Please review the system for consistency issues")

print("\n")
