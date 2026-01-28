#!/usr/bin/env python
"""
Diagnostic Script: Role Switching System Tests
Purpose: Verify boolean role fields are working correctly
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

User = get_user_model()

print("\n" + "="*70)
print("ROLE SWITCHING SYSTEM - DIAGNOSTIC TEST")
print("="*70 + "\n")

# Test 1: Check if boolean fields exist and are set correctly
print("TEST 1: Boolean Role Fields")
print("-" * 70)

try:
    users = User.objects.all()[:5]
    for user in users:
        print(f"\n👤 User: {user.email}")
        print(f"   is_student: {user.is_student}")
        print(f"   is_instructor: {user.is_instructor}")
        print(f"   is_admin: {user.is_admin}")
        print(f"   current_role: {user.current_role}")
        print(f"   roles (CSV): {user.roles}")
        print(f"   get_available_boolean_roles(): {user.get_available_boolean_roles()}")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 2: Check if get_available_boolean_roles works
print("\n\nTEST 2: get_available_boolean_roles() Method")
print("-" * 70)

try:
    test_user = User.objects.first()
    if test_user:
        boolean_roles = test_user.get_available_boolean_roles()
        print(f"✅ get_available_boolean_roles() works: {boolean_roles}")
    else:
        print("⚠️  No users found in database")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 3: Check if has_boolean_role works
print("\n\nTEST 3: has_boolean_role() Method")
print("-" * 70)

try:
    test_user = User.objects.first()
    if test_user:
        print(f"User: {test_user.email}")
        print(f"   has_boolean_role('student'): {test_user.has_boolean_role('student')}")
        print(f"   has_boolean_role('instructor'): {test_user.has_boolean_role('instructor')}")
        print(f"   has_boolean_role('teacher'): {test_user.has_boolean_role('teacher')}")
        print(f"   has_boolean_role('admin'): {test_user.has_boolean_role('admin')}")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 4: Check if users with multiple roles work
print("\n\nTEST 4: Multi-Role Users")
print("-" * 70)

try:
    multi_role_users = User.objects.filter(is_student=True, is_instructor=True)
    if multi_role_users.exists():
        print(f"✅ Found {multi_role_users.count()} multi-role users:")
        for user in multi_role_users[:3]:
            print(f"\n   📧 {user.email}")
            print(f"      is_student: {user.is_student}")
            print(f"      is_instructor: {user.is_instructor}")
            print(f"      is_admin: {user.is_admin}")
            print(f"      available_roles: {user.get_available_boolean_roles()}")
    else:
        print("ℹ️  No multi-role users found yet")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 5: Check if AvailableRolesAPIView response format is correct
print("\n\nTEST 5: API Response Format")
print("-" * 70)

try:
    test_user = User.objects.first()
    if test_user:
        # Simulate what AvailableRolesAPIView returns
        api_response = {
            'available_roles': test_user.get_available_boolean_roles(),
            'is_student': test_user.is_student,
            'is_instructor': test_user.is_instructor,
            'is_admin': test_user.is_admin,
            'current_role': test_user.current_role,
        }
        print("✅ API Response format:")
        for key, value in api_response.items():
            print(f"   {key}: {value}")
except Exception as e:
    print(f"❌ Error: {e}")

# Test 6: Check for issues
print("\n\nTEST 6: Potential Issues Detection")
print("-" * 70)

issues = []

try:
    # Check if any users have mismatched boolean fields and roles CSV
    users_with_issues = []
    for user in User.objects.all():
        boolean_roles = set(user.get_available_boolean_roles())
        csv_roles = set(r.strip() for r in user.roles.split(',') if r.strip())
        
        if boolean_roles != csv_roles:
            users_with_issues.append({
                'email': user.email,
                'boolean_roles': boolean_roles,
                'csv_roles': csv_roles
            })
    
    if users_with_issues:
        print(f"⚠️  Found {len(users_with_issues)} users with mismatched role data:")
        for user_issue in users_with_issues[:5]:
            print(f"\n   📧 {user_issue['email']}")
            print(f"      Boolean roles: {user_issue['boolean_roles']}")
            print(f"      CSV roles: {user_issue['csv_roles']}")
            issues.append(user_issue)
    else:
        print("✅ All users have consistent role data")
        
except Exception as e:
    print(f"❌ Error checking for issues: {e}")

# Test 7: Verify current_role is in available roles
print("\n\nTEST 7: Current Role Validation")
print("-" * 70)

try:
    invalid_current_roles = []
    for user in User.objects.all():
        available = user.get_available_boolean_roles()
        if user.current_role not in available:
            invalid_current_roles.append({
                'email': user.email,
                'current_role': user.current_role,
                'available': available
            })
    
    if invalid_current_roles:
        print(f"⚠️  Found {len(invalid_current_roles)} users with invalid current_role:")
        for user_issue in invalid_current_roles[:5]:
            print(f"\n   📧 {user_issue['email']}")
            print(f"      current_role: {user_issue['current_role']}")
            print(f"      available: {user_issue['available']}")
            issues.append(user_issue)
    else:
        print("✅ All users have valid current_role")
        
except Exception as e:
    print(f"❌ Error validating current_role: {e}")

# Summary
print("\n\n" + "="*70)
print("DIAGNOSTIC SUMMARY")
print("="*70)

if not issues:
    print("\n✅ ALL TESTS PASSED - Role system is working correctly!")
else:
    print(f"\n⚠️  FOUND {len(issues)} ISSUE(S):")
    print("\nRecommendation: Run the fix script to synchronize boolean fields with CSV roles")

print("\n" + "="*70 + "\n")
