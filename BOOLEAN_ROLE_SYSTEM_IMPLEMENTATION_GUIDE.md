═══════════════════════════════════════════════════════════════════════════════
  BOOLEAN ROLE SYSTEM IMPLEMENTATION GUIDE
  ✨ PHASE 4.10 - LMSetjen DPD RI Multi-Role System Redesign
═══════════════════════════════════════════════════════════════════════════════

## PROBLEM STATEMENT
═════════════════════════════════════════════════════════════════════════════

You could only login as student despite having multi-role configuration because:

BEFORE (String-Based System - BROKEN):
├── User.role = CharField(choices=['student', 'teacher', 'admin'])
│   └── Problem: Only ONE role value allowed
├── User.roles = CharField (CSV: "student,teacher,admin")
│   └── Problem: Just a text field, no enforcement
└── User.current_role = CharField
    └── Problem: Even if changed, login restricted by role string field

Result: Your account had role='student', so permission checks always failed for
        admin/instructor features because they checked role='admin' string match.


## SOLUTION - BOOLEAN ROLE SYSTEM
═════════════════════════════════════════════════════════════════════════════

AFTER (Boolean-Based System - WORKING):
├── User.is_student = BooleanField(default=False)
├── User.is_instructor = BooleanField(default=False)
└── User.is_admin = BooleanField(default=False)

Benefits:
✅ Users can have MULTIPLE roles simultaneously
✅ is_student=True AND is_instructor=True AND is_admin=True (all at once!)
✅ Simple boolean checks: if user.is_admin:
✅ Type-safe, no string parsing errors
✅ Easy to audit: just check the boolean field
✅ Direct Django integration: uses native BooleanField
✅ No backward compatibility issues: old string fields still exist


## WHAT HAS BEEN CHANGED
═════════════════════════════════════════════════════════════════════════════

1. USER MODEL (backend/userauths/models.py)
   ✅ Added 3 new BooleanField fields:
      - is_student: BooleanField(default=True)
      - is_instructor: BooleanField(default=False)
      - is_admin: BooleanField(default=False)
   
   ✅ Added 4 new helper methods:
      - get_available_boolean_roles(): Returns list of role names
      - has_boolean_role(role_name): Check if user has a specific role
      - grant_role(role_name): Grant a role to user
      - revoke_role(role_name): Revoke a role from user
   
   ✅ Added database indexes for query performance:
      - index on is_student
      - index on is_instructor
      - index on is_admin
      - compound indexes with is_active


2. PERMISSION CLASSES (backend/api/permissions.py)
   ✅ Updated IsAdminUser permission:
      - Now checks: if user.is_admin (boolean)
      - Fallback to: current_role == 'admin' (backward compat)
   
   ✅ Updated IsTeacherUser permission:
      - Now checks: if user.is_instructor (boolean)
      - Fallback to: current_role in ['teacher', 'instructor']
   
   ✅ Updated IsStudentUser permission:
      - Now checks: if user.is_student (boolean)
      - Fallback to: current_role == 'student'


3. JWT SERIALIZER (backend/api/serializer.py)
   ✅ Updated MyTokenObtainPairSerializer._add_user_fields():
      - Now adds to JWT token:
        * is_student: True/False
        * is_instructor: True/False
        * is_admin: True/False
        * available_roles: ['student', 'instructor', 'admin']
        * has_multiple_roles: True (if len(available_roles) > 1)
      
   ✅ Updated UserSerializer:
      - Now includes boolean role fields in API responses


4. DATABASE MIGRATION (backend/userauths/migrations/0006_add_boolean_role_fields.py)
   ✅ Adds 3 new BooleanField columns to users table
   ✅ Adds 6 new database indexes
   ✅ Automatically migrates existing users:
      - If user had role='admin' → sets is_admin=True
      - If user had role='teacher' → sets is_instructor=True
      - If user had role='student' → sets is_student=True
      - Users with multiple roles get ALL boolean fields set


5. MANAGEMENT COMMAND (backend/userauths/management/commands/grant_multi_roles.py)
   ✅ New command to grant multi-role access:
      Usage: python manage.py grant_multi_roles email@example.com student instructor admin


## WHAT IS NOT CHANGED (Backward Compatibility)
═════════════════════════════════════════════════════════════════════════════

These fields still exist and work (for backward compatibility):
├── User.role (CharField) - auto-synced from boolean fields
├── User.roles (CharField CSV) - auto-synced from boolean fields
└── User.current_role (CharField) - still used for "active role" context

When you grant/revoke roles via boolean fields, these are automatically synced.


## STEP-BY-STEP SETUP INSTRUCTIONS
═════════════════════════════════════════════════════════════════════════════

### Step 1: Apply Database Migration
────────────────────────────────────────

In terminal/PowerShell, navigate to backend folder and run:

Windows (PowerShell):
    cd backend
    python manage.py migrate

Linux/Mac:
    cd backend
    python manage.py migrate

What it does:
  ✓ Adds 3 new boolean columns to users table
  ✓ Adds 6 new indexes
  ✓ Migrates all existing users based on their current roles
  ✓ Sets is_student=True for all users (baseline)


### Step 2: Grant Your User All Roles
────────────────────────────────────────

In terminal/PowerShell:

Windows (PowerShell):
    python manage.py grant_multi_roles khairilazmiashari@gmail.com student instructor admin --set-current-role student

Linux/Mac:
    python manage.py grant_multi_roles khairilazmiashari@gmail.com student instructor admin --set-current-role student

What it does:
  ✓ Sets is_student=True
  ✓ Sets is_instructor=True
  ✓ Sets is_admin=True
  ✓ Sets current_role='student' (for first login)
  ✓ Syncs CSV roles field to "student,instructor,admin"
  ✓ Displays final user configuration

Expected output:
    ✓ Granted student role to khairilazmiashari@gmail.com
    ✓ Granted instructor role to khairilazmiashari@gmail.com
    ✓ Granted admin role to khairilazmiashari@gmail.com
    ✓ Set current role to student (default)

    === User Configuration Complete ===
    Email: khairilazmiashari@gmail.com
    Username: khairilazmiashari
    Full Name: Khairil Azmi Ashari
    Is Student: True
    Is Instructor: True
    Is Admin: True
    Available Roles: student, instructor, admin
    Current Role: student
    CSV Roles: student,instructor,admin
    ✓ User is ready for multi-role login!


### Step 3: Test Multi-Role Login
────────────────────────────────────────

1. Navigate to frontend: http://localhost:5173 (or production URL)
2. Click "Login"
3. Enter email: khairilazmiashari@gmail.com
4. Enter password: (your password)
5. Click "Login"

Expected result:
  ✓ See role selector modal showing: [Student] [Instructor] [Admin]
  ✓ Can select any role to login
  ✓ After login, can see role selector in profile menu
  ✓ Can switch between roles without re-logging in

Testing role switching:
  1. After login, look for role selector in header/profile menu
  2. Click on current role name or "Switch Role" button
  3. Select a different role
  4. System should reload with new role context
  5. Verify you can access features for that role


### Step 4: Verify Permission System
────────────────────────────────────────

To verify permission system is working correctly:

Windows (PowerShell):
    python manage.py shell
    >>> from userauths.models import User
    >>> user = User.objects.get(email='khairilazmiashari@gmail.com')
    >>> print(f"is_student: {user.is_student}")
    >>> print(f"is_instructor: {user.is_instructor}")
    >>> print(f"is_admin: {user.is_admin}")
    >>> print(f"available_roles: {user.get_available_boolean_roles()}")
    >>> exit()

Expected output:
    is_student: True
    is_instructor: True
    is_admin: True
    available_roles: ['student', 'instructor', 'admin']


## HOW THE NEW SYSTEM WORKS
═════════════════════════════════════════════════════════════════════════════

### Login Flow:
    1. User enters email/password
    2. Backend checks email exists and password matches
    3. Backend looks at boolean fields: is_student, is_instructor, is_admin
    4. If multiple are True, backend returns "available_roles"
    5. Frontend detects multiple roles and shows selector modal
    6. User picks a role (e.g., "Admin")
    7. Backend generates JWT with all role info:
       ├── role: "admin" (current role)
       ├── is_student: True
       ├── is_instructor: True
       ├── is_admin: True
       └── available_roles: ['student', 'instructor', 'admin']
    8. Frontend stores JWT and logs in as "admin"


### Permission Check:
    Endpoint: POST /api/v1/admin/users/
    Permission: [IsAdminUser]
    
    OLD (String-based - Broken):
    ────────────────────────────
    if request.user.current_role == 'admin':  # String comparison (error-prone)
        return True
    return False
    
    Result: FAILS if user not initialized properly
    
    
    NEW (Boolean-based - Fixed):
    ──────────────────────────
    if request.user.is_admin:  # Simple boolean check
        return True
    if request.user.current_role == 'admin':  # Fallback for migration
        return True
    return False
    
    Result: PASSES because user.is_admin = True
            Even if current_role not set, boolean field works


### Role Switching:
    1. Frontend detects current_role change request
    2. Validates against available_roles list
    3. Backend generates new JWT with:
       ├── role: "instructor" (NEW)
       └── current_role: "instructor" (NEW)
    4. Frontend uses new JWT
    5. All permission checks use new current_role
    6. No re-login needed


## FRONTEND INTEGRATION
═════════════════════════════════════════════════════════════════════════════

The frontend was already updated to handle the new boolean roles system via
the JWT token fields. The following exist in the codebase:

frontend/src/utils/UserData.js:
  - Decodes JWT and extracts:
    ✓ role (current role)
    ✓ is_student, is_instructor, is_admin (boolean fields from JWT)
    ✓ available_roles (array of roles user has)
    ✓ has_multiple_roles (boolean)

frontend/src/components/RoleSelectionModal.jsx:
  - Shows role selector if has_multiple_roles = True
  - Allows user to switch between available_roles
  - Updates current_role in JWT

frontend/src/views/ (all components):
  - Role checks: const userData = UserData(); if (userData.role === 'admin')
  - These checks already work with the new system


## TROUBLESHOOTING
═════════════════════════════════════════════════════════════════════════════

Issue: Migration fails with error about index names
─────────────────────────────────────────────────
Solution: Django may have auto-generated different index names
  → Delete the migration file and regenerate: python manage.py makemigrations
  → Or manually edit index names in migration to be unique

Issue: Still can't login as admin/instructor
──────────────────────────────────────────────
Debug steps:
  1. Check user boolean fields in Django shell:
     python manage.py shell
     >>> user = User.objects.get(email='...')
     >>> print(user.is_admin, user.is_instructor)
  
  2. Check JWT token includes the fields:
     • After login, open browser DevTools
     • Go to Application → Cookies/LocalStorage
     • Find jwt token and copy it
     • Decode at jwt.io to see token contents
     • Should show: is_admin: True, is_instructor: True
  
  3. Check frontend is reading token correctly:
     • In browser console: localStorage.getItem('access_token')
     • Should show the full JWT

Issue: Role selector modal doesn't appear after login
───────────────────────────────────────────────────────
Solution:
  1. Verify available_roles in JWT is an array: ["student", "instructor", "admin"]
  2. Verify has_multiple_roles = True
  3. Check frontend component RoleSelectionModal is imported in App.jsx
  4. Check browser console for errors (F12 → Console)


## PERFORMANCE OPTIMIZATION
═════════════════════════════════════════════════════════════════════════════

The new system includes database indexes for fast role queries:

SELECT * FROM userauths_user WHERE is_admin = True;        ← Fast (indexed)
SELECT * FROM userauths_user WHERE is_student = True;      ← Fast (indexed)
SELECT * FROM userauths_user WHERE is_instructor = True;   ← Fast (indexed)

Without indexes, these would be slow on large databases (1M+ users).


## MIGRATION STRATEGY FOR EXISTING SYSTEMS
═════════════════════════════════════════════════════════════════════════════

For systems with multiple users already:

1. Migration automatically processes all users:
   - Admin users: role='admin' → is_admin=True
   - Instructors: role='teacher' → is_instructor=True
   - Students: role='student' → is_student=True
   - Multi-role users: get ALL applicable boolean fields

2. No manual work needed for existing users

3. New users created after migration:
   - Default: is_student=True, is_instructor=False, is_admin=False
   - Grant additional roles via:
     python manage.py grant_multi_roles user@example.com instructor admin


## REFERENCE: API ENDPOINTS
═════════════════════════════════════════════════════════════════════════════

Login endpoint returns:
  POST /api/v1/token/
  
  Response:
  {
    "access": "eyJ0eXAiOiJKV1QiLCJhbGci...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGci...",
    "user": {
      "id": 1,
      "email": "khairilazmiashari@gmail.com",
      "full_name": "Khairil Azmi Ashari",
      "role": "student",
      "is_student": True,
      "is_instructor": True,
      "is_admin": True,
      "available_roles": ["student", "instructor", "admin"],
      "has_multiple_roles": True,
      "current_role": "student"
    }
  }

Admin list endpoint (requires is_admin):
  GET /api/v1/admin/users/
  
  Permission check:
    if request.user.is_admin:  ← New boolean check (preferred)
        # Allow access
    elif request.user.current_role == 'admin':  ← Fallback
        # Allow access


## NEXT STEPS
═════════════════════════════════════════════════════════════════════════════

After setup:

1. ✅ Test login with all 3 roles
2. ✅ Test role switching in UI
3. ✅ Test accessing role-specific features
4. ✅ Monitor Django logs for any permission errors
5. ✅ Create test suite for role system (optional)
6. ✅ Update documentation with new role system

For additional users needing multi-role:
  python manage.py grant_multi_roles user@example.com student instructor admin


═══════════════════════════════════════════════════════════════════════════════
                          Implementation Complete
                    Version 4.10 - Boolean Role System
═══════════════════════════════════════════════════════════════════════════════
