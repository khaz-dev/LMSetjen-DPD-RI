═══════════════════════════════════════════════════════════════════════════════
  BOOLEAN ROLE SYSTEM - QUICK START GUIDE
  ✨ Phase 4.10 - 5 Minute Setup
═══════════════════════════════════════════════════════════════════════════════

YOUR STATUS
═════════════════════════════════════════════════════════════════════════════

✅ Migration applied
✅ Your user has all 3 roles (student, instructor, admin)
✅ System ready to test

User: khairilazmiashari@gmail.com
  - is_student: True ✅
  - is_instructor: True ✅
  - is_admin: True ✅


STEP 1: START BACKEND
═════════════════════════════════════════════════════════════════════════════

Windows (PowerShell):
  cd "d:\Project\LMSetjen DPD RI\backend"
  python manage.py runserver

Expected output:
  Starting development server at http://127.0.0.1:8000/


STEP 2: START FRONTEND
═════════════════════════════════════════════════════════════════════════════

Open new terminal/PowerShell:
  cd "d:\Project\LMSetjen DPD RI\frontend"
  npm run dev

Expected output:
  ➜ Local: http://localhost:5173


STEP 3: TEST LOGIN
═════════════════════════════════════════════════════════════════════════════

1. Open: http://localhost:5173
2. Click "Login"
3. Enter:
   Email: khairilazmiashari@gmail.com
   Password: (your password)
4. Click "Login"
5. Should see ROLE SELECTOR with 3 options:
   [Student] [Instructor] [Admin]


STEP 4: TEST ROLE SWITCHING
═════════════════════════════════════════════════════════════════════════════

After login:
  1. Click on role name in header
  2. See role switcher dropdown
  3. Select different role
  4. Page reloads with new role context
  5. Can access that role's features


COMMON TASKS
═════════════════════════════════════════════════════════════════════════════

Grant Multi-Role to User:
  python manage.py grant_multi_roles email@example.com student instructor admin

Check User's Roles:
  python manage.py shell
  >>> from userauths.models import User
  >>> u = User.objects.get(email='...')
  >>> print(f"Roles: {u.get_available_boolean_roles()}")
  >>> print(f"Student: {u.is_student}, Instructor: {u.is_instructor}, Admin: {u.is_admin}")

Run Tests:
  python manage.py test userauths.tests_boolean_roles

View Database:
  sqlite3 db.sqlite3
  SELECT email, is_student, is_instructor, is_admin FROM userauths_user WHERE email='...';


WHAT'S DIFFERENT NOW
═════════════════════════════════════════════════════════════════════════════

OLD SYSTEM (String-Based):
  role = CharField(choices=['student', 'teacher', 'admin'])
  ❌ Only 1 role at a time
  ❌ Permission checks: if user.role == 'admin'
  ❌ Fragile string comparisons

NEW SYSTEM (Boolean-Based):
  is_student = BooleanField()
  is_instructor = BooleanField()
  is_admin = BooleanField()
  ✅ Multiple roles simultaneously
  ✅ Permission checks: if user.is_admin
  ✅ Type-safe, no string errors


KEY METHODS
═════════════════════════════════════════════════════════════════════════════

User Model Methods:

  user.get_available_boolean_roles()
    → Returns: ['student', 'instructor', 'admin']
    → Use when: Need list of all roles user has

  user.has_boolean_role('admin')
    → Returns: True/False
    → Use when: Checking if user has specific role

  user.grant_role('instructor')
    → Sets is_instructor=True
    → Auto-syncs CSV fields
    → Use when: Adding a role to user

  user.revoke_role('admin')
    → Sets is_admin=False
    → Updates current_role if needed
    → Use when: Removing a role from user

  user.set_roles_from_boolean()
    → Auto-syncs CSV fields from boolean fields
    → Called automatically by grant_role/revoke_role
    → Use when: Manual updates needed


PERMISSION CHECKS
═════════════════════════════════════════════════════════════════════════════

In Views:
  from api.permissions import IsAdminUser, IsTeacherUser

  class MyAdminView(APIView):
      permission_classes = [IsAdminUser]
      # Now checks: if request.user.is_admin

In Serializers:
  def validate(self, data):
      if self.context['request'].user.is_instructor:
          # Allow instructor-specific validation

In Templates/Frontend:
  const userData = UserData();
  if (userData.is_admin) {
      // Show admin features


JWT TOKEN FIELDS
═════════════════════════════════════════════════════════════════════════════

After login, JWT includes:
  
  token.is_student: true
  token.is_instructor: true
  token.is_admin: true
  token.available_roles: ['student', 'instructor', 'admin']
  token.has_multiple_roles: true
  
Frontend reads with:
  const userData = UserData();
  userData.is_admin        → Check admin access
  userData.available_roles → Show role selector
  userData.role            → Get current role


TROUBLESHOOTING
═════════════════════════════════════════════════════════════════════════════

Not seeing role selector after login?
  → Check browser console (F12) for errors
  → Verify JWT contains available_roles
  → Clear cache: Ctrl+Shift+Delete

Permission denied errors?
  → Check user's boolean fields in database
  → Verify current_role is set
  → Restart Django server

Can't grant roles to user?
  → Verify email is correct
  → Check user exists in database
  → Verify syntax: python manage.py grant_multi_roles email role1 role2


NEXT STEPS
═════════════════════════════════════════════════════════════════════════════

After testing:
  1. Test with other users
  2. Run full test suite
  3. Deploy to staging
  4. Monitor logs for permission errors
  5. Deploy to production


FILES TO REVIEW
═════════════════════════════════════════════════════════════════════════════

Implementation:
  - backend/userauths/models.py (User model with new fields)
  - backend/api/permissions.py (Updated permission classes)
  - backend/api/serializer.py (JWT token fields)

Documentation:
  - BOOLEAN_ROLE_SYSTEM_IMPLEMENTATION_GUIDE.md (detailed guide)
  - BOOLEAN_ROLE_SYSTEM_COMPLETE.md (complete summary)

Testing:
  - backend/userauths/tests_boolean_roles.py (test suite)

Management:
  - backend/userauths/management/commands/grant_multi_roles.py (command)


═══════════════════════════════════════════════════════════════════════════════
                         Ready to Test - Go Live!
═══════════════════════════════════════════════════════════════════════════════
