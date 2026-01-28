#!/usr/bin/env python
"""
Multi-Role System Fix Script
Fixes user accounts that have is_student=True but missing is_admin/is_instructor roles
This script ensures all multi-role users have proper boolean role fields configured.

PROBLEM IDENTIFIED:
- User account (khairilazmiashari@gmail.com) has role='student' in deprecated field
- User has is_student=True but is_admin=False, is_instructor=False
- When user tries to switch to admin role, SelectRoleAPIView checks has_boolean_role('admin')
- Check fails because is_admin=False, so role switch is blocked with "User does not have admin role"

SOLUTION:
- Add all boolean roles (is_admin, is_instructor) to users who should have multi-role access
- Update 'roles' field to reflect available boolean roles
- Ensure current_role is set to a valid available role
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from userauths.models import User
from django.utils import timezone

def diagnose_user(email):
    """Diagnose a specific user's role configuration"""
    print(f"\n{'='*80}")
    print(f"DIAGNOSING USER: {email}")
    print('='*80)
    
    user = User.objects.filter(email=email).first()
    if not user:
        print(f"❌ User not found: {email}")
        return None
    
    print(f"\n📊 CURRENT CONFIGURATION:")
    print(f"  Email: {user.email}")
    print(f"  Username: {user.username}")
    print(f"  ID: {user.id}")
    print(f"\n🔵 DEPRECATED FIELDS (old system):")
    print(f"  role: '{user.role}'")
    print(f"\n🟢 PRIMARY FIELDS (new system):")
    print(f"  roles: '{user.roles}'")
    print(f"  current_role: '{user.current_role}'")
    print(f"\n🟣 BOOLEAN ROLE FIELDS (PHASE 4.10):")
    print(f"  is_student: {user.is_student}")
    print(f"  is_instructor: {user.is_instructor}")
    print(f"  is_admin: {user.is_admin}")
    
    available_roles = user.get_available_boolean_roles()
    print(f"\n📋 AVAILABLE ROLES (from boolean fields): {available_roles}")
    
    return user

def fix_user_multirole(email, roles_to_add):
    """
    Fix a user's role configuration to enable multi-role access
    
    Args:
        email: User email
        roles_to_add: List of roles to add (e.g., ['admin', 'instructor', 'student'])
    """
    print(f"\n{'='*80}")
    print(f"FIXING USER ROLES: {email}")
    print(f"Roles to add: {roles_to_add}")
    print('='*80)
    
    user = User.objects.filter(email=email).first()
    if not user:
        print(f"❌ User not found: {email}")
        return False
    
    print(f"\n🔧 BEFORE FIX:")
    print(f"  is_student: {user.is_student}")
    print(f"  is_instructor: {user.is_instructor}")
    print(f"  is_admin: {user.is_admin}")
    print(f"  roles: '{user.roles}'")
    print(f"  current_role: '{user.current_role}'")
    
    try:
        # Grant each role using the grant_role method
        for role in roles_to_add:
            print(f"\n  ➡️ Granting role: {role}")
            user.grant_role(role)
        
        # Refresh from database to get updated values
        user.refresh_from_db()
        
        print(f"\n✅ AFTER FIX:")
        print(f"  is_student: {user.is_student}")
        print(f"  is_instructor: {user.is_instructor}")
        print(f"  is_admin: {user.is_admin}")
        print(f"  roles: '{user.roles}'")
        print(f"  current_role: '{user.current_role}'")
        
        available_roles = user.get_available_boolean_roles()
        print(f"\n✅ AVAILABLE ROLES: {available_roles}")
        
        # Test can switch roles
        print(f"\n🧪 TESTING ROLE SWITCHING:")
        for test_role in available_roles:
            has_role = user.has_boolean_role(test_role)
            print(f"  ✓ Can switch to '{test_role}': {has_role}")
        
        print(f"\n✅ USER ROLE FIX SUCCESSFUL!")
        return True
        
    except Exception as e:
        print(f"❌ Error fixing user roles: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def check_all_users_multirole():
    """Check all users for multi-role configuration status"""
    print(f"\n{'='*80}")
    print("CHECKING ALL USERS FOR MULTI-ROLE STATUS")
    print('='*80)
    
    all_users = User.objects.all()
    
    issues = []
    
    for user in all_users:
        available_boolean_roles = user.get_available_boolean_roles()
        if len(available_boolean_roles) == 1:
            # Single role user - might need to be multi-role
            issues.append({
                'email': user.email,
                'roles': available_boolean_roles,
                'current_role': user.current_role,
                'status': 'Single-role user'
            })
        elif len(available_boolean_roles) > 1:
            # Multi-role user - check if can actually switch
            print(f"✅ {user.email}: Multi-role ({available_boolean_roles})")
        else:
            # No roles - critical issue
            issues.append({
                'email': user.email,
                'roles': available_boolean_roles,
                'current_role': user.current_role,
                'status': 'NO ROLES - Critical!'
            })
    
    if issues:
        print(f"\n⚠️  USERS WITH POTENTIAL ISSUES:")
        for issue in issues:
            print(f"\n  📌 {issue['email']}")
            print(f"    Roles: {issue['roles']}")
            print(f"    Current role: {issue['current_role']}")
            print(f"    Status: {issue['status']}")
    
    return len(issues) == 0

def main():
    """Main diagnostic and fix routine"""
    
    print("\n" + "="*80)
    print("MULTI-ROLE SYSTEM DIAGNOSTIC & FIX SCRIPT")
    print("="*80)
    
    # Target user
    target_email = 'khairilazmiashari@gmail.com'
    
    # Step 1: Diagnose current state
    print("\n[STEP 1] Diagnosing current state...")
    user = diagnose_user(target_email)
    
    if not user:
        print("❌ Cannot proceed - user not found")
        return False
    
    # Step 2: Check if user needs fixing
    available_roles = user.get_available_boolean_roles()
    print(f"\n[STEP 2] Checking if user needs fixing...")
    print(f"  Current available roles: {available_roles}")
    
    if len(available_roles) == 1 and 'student' in available_roles:
        print(f"  ⚠️ User only has student role - needs multi-role fix")
        
        # Step 3: Fix user to have all roles
        print(f"\n[STEP 3] Applying multi-role fix...")
        roles_to_add = ['student', 'instructor', 'admin']
        
        success = fix_user_multirole(target_email, roles_to_add)
        
        if success:
            # Step 4: Verify fix
            print(f"\n[STEP 4] Verifying fix...")
            verify_user = diagnose_user(target_email)
            verify_roles = verify_user.get_available_boolean_roles()
            
            if set(verify_roles) == set(roles_to_add):
                print(f"✅ FIX VERIFIED: User now has all roles: {verify_roles}")
                print(f"\n📝 USER CAN NOW:")
                print(f"  ✓ Log in as student")
                print(f"  ✓ Switch to instructor role")
                print(f"  ✓ Switch to admin role")
                print(f"  ✓ Seamlessly switch between any role")
                return True
            else:
                print(f"❌ Fix verification failed - roles don't match")
                return False
        else:
            print(f"❌ Fix failed")
            return False
    else:
        print(f"  ✅ User already has multiple roles: {available_roles}")
        print(f"  No fix needed")
        return True

if __name__ == '__main__':
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
