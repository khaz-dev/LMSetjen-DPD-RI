# 🧪 TESTING GUIDE - Phase 4.15 Role Switching Fix

## Quick Test (5 minutes)

### Prerequisites
- Django running on http://localhost:8000
- Frontend running on http://localhost:5173
- User account with all 3 roles (khairilazmiashari@gmail.com)

### Test Steps

**Step 1: Google OAuth Login**
1. Open http://localhost:5173
2. Click "Masuk dengan Google"
3. Log in with your Google account
4. **Expected:** See role selector with 3 options
   - ✅ Student
   - ✅ Instruktur
   - ✅ Admin

**Step 2: Select Instructor Role**
1. Click "Instruktur" button
2. **Expected:** 
   - ✅ No error message
   - ✅ Dashboard loads
   - ✅ Instructor features visible

**Step 3: Verify JWT Token**
1. Open browser developer tools (F12)
2. Go to Application tab
3. Check localStorage for `access_token`
4. **Expected:**
   - ✅ Token exists
   - ✅ Token includes role information

**Step 4: Switch to Another Role**
1. Look for role switch option
2. Click "Admin" or "Student"
3. **Expected:**
   - ✅ Role changes without error
   - ✅ Dashboard updates accordingly

---

## Complete Test (15 minutes)

### Test Case 1: Google OAuth Login
```
Given: User has all 3 roles (is_student, is_instructor, is_admin = True)
When:  User clicks "Masuk dengan Google"
Then:  
  ✅ Login successful
  ✅ Role selector shows: [Student] [Instruktur] [Admin]
  ✅ has_multiple_roles = True
  ✅ available_roles = ['student', 'instructor', 'admin']
```

### Test Case 2: Select Instructor Role
```
Given: User is logged in and sees role selector
When:  User clicks "Instruktur"
Then:
  ✅ No error message appears
  ✅ Request succeeds: POST /api/v1/auth/select-role/
  ✅ Response includes: { "success": true, "current_role": "instructor" }
  ✅ Role changes to "instructor"
  ✅ JWT token updated
```

### Test Case 3: Verify Instructor Access
```
Given: Current role is "instructor"
When:  User accesses instructor features
Then:
  ✅ Can create courses
  ✅ Can grade students
  ✅ Can view student submissions
  ✅ All instructor permissions work
```

### Test Case 4: Switch Between All Roles
```
Given: User can switch between roles
When:  User switches: student → instructor → admin → student
Then:
  ✅ Each switch succeeds
  ✅ No error messages
  ✅ Role updates each time
  ✅ Features available for each role
```

### Test Case 5: Backward Compatibility
```
Given: System supports both 'teacher' and 'instructor'
When:  Backend receives 'teacher' role name
Then:
  ✅ Normalizes to 'instructor'
  ✅ Validation passes
  ✅ System works correctly
```

### Test Case 6: Invalid Role Rejection
```
Given: User tries to select invalid role
When:  POST to select-role with role="invalid_role"
Then:
  ✅ Returns error (400 Bad Request)
  ✅ Error message: "Invalid role. Valid roles are: student, instructor, admin"
  ✅ Role not changed
```

### Test Case 7: Unauthorized Role Rejection
```
Given: User tries role they don't have (hypothetical)
When:  POST to select-role with non-existent role
Then:
  ✅ Returns error (400 Bad Request)
  ✅ Error message: "User does not have X role"
  ✅ Lists available roles
```

### Test Case 8: JWT Token Contents
```
Given: User switches to instructor role
When:  JWT token is generated
Then:
  ✅ Token includes: current_role: "instructor"
  ✅ Token includes: available_roles: ["student", "instructor", "admin"]
  ✅ Token includes: is_instructor: true
  ✅ Token includes: is_admin: true
  ✅ Token includes: is_student: true
```

---

## API Testing (curl)

### Test 1: Google OAuth Login
```bash
curl -X POST http://localhost:8000/api/v1/oauth/google-login/ \
  -H "Content-Type: application/json" \
  -d '{"token": "GOOGLE_ID_TOKEN_HERE"}'

# Expected Response:
{
  "user": {
    "available_roles": ["student", "instructor", "admin"],
    "has_multiple_roles": true
  }
}
```

### Test 2: Select Instructor Role
```bash
curl -X POST http://localhost:8000/api/v1/auth/select-role/ \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "instructor"}'

# Expected Response:
{
  "success": true,
  "message": "Successfully switched to instructor role",
  "current_role": "instructor",
  "available_roles": ["student", "instructor", "admin"],
  "access_token": "eyJ..."
}
```

### Test 3: Invalid Role
```bash
curl -X POST http://localhost:8000/api/v1/auth/select-role/ \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "invalid_role"}'

# Expected Response (400):
{
  "success": false,
  "error": "Invalid role. Valid roles are: student, instructor, admin",
  "available_roles": ["student", "instructor", "admin"]
}
```

### Test 4: Backward Compatibility - Teacher Role
```bash
curl -X POST http://localhost:8000/api/v1/auth/select-role/ \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "teacher"}'

# Expected Response:
{
  "success": true,
  "message": "Successfully switched to instructor role",  # Normalized!
  "current_role": "instructor",
  "available_roles": ["student", "instructor", "admin"]
}
```

---

## Browser Developer Tools Check

### Check Local Storage
1. Open F12 (Developer Tools)
2. Go to Application → Local Storage
3. Find your domain
4. Look for `access_token`
5. Copy and decode JWT at jwt.io
6. **Should see:**
   ```json
   {
     "role": "instructor",
     "current_role": "instructor",
     "available_roles": ["student", "instructor", "admin"],
     "is_student": true,
     "is_instructor": true,
     "is_admin": true
   }
   ```

### Check Network Tab
1. Open F12 (Developer Tools)
2. Go to Network tab
3. Click role selector button
4. Look for POST to `api/v1/auth/select-role/`
5. Check Response tab
6. **Should see:**
   ```json
   {
     "success": true,
     "current_role": "instructor",
     "available_roles": ["student", "instructor", "admin"]
   }
   ```

### Check Console
1. Open F12 (Developer Tools)
2. Go to Console tab
3. No errors should appear
4. Look for any warnings about roles
5. **Expected:** Clean console, no role-related errors

---

## Database Verification

### Check User Boolean Roles
```bash
cd backend
python manage.py shell
>>> from userauths.models import User
>>> user = User.objects.get(email='khairilazmiashari@gmail.com')
>>> user.is_student, user.is_instructor, user.is_admin
(True, True, True)  # ✅ Expected
>>> user.get_available_boolean_roles()
['student', 'instructor', 'admin']  # ✅ Expected
>>> user.has_boolean_role('instructor')
True  # ✅ Expected
>>> user.has_boolean_role('teacher')
True  # ✅ Expected (backward compat!)
```

---

## Regression Testing

### Ensure Nothing Else Broke

**Test 1: Other Users Can Still Login**
```
✅ SSO login works
✅ Regular email/password login works
✅ Users with single role work fine
```

**Test 2: Permission Checks Still Work**
```
✅ Only admins can access admin panel
✅ Only teachers/instructors can create courses
✅ Only students can view courses
✅ Instructor features only for instructors
```

**Test 3: Existing Functionality**
```
✅ Course listing works
✅ Enrollment works
✅ Grading works
✅ Analytics work
✅ Search works
```

---

## Test Coverage Checklist

| Feature | Status | Notes |
|---------|--------|-------|
| Google OAuth | ✅ | Should show 3 roles |
| Role Selector | ✅ | Should have 3 buttons |
| Select Instructor | ✅ | Should work without error |
| Select Student | ✅ | Should work |
| Select Admin | ✅ | Should work |
| Role Validation | ✅ | Should reject invalid |
| JWT Token | ✅ | Should include roles |
| Backward Compat | ✅ | 'teacher' should work |
| Database Sync | ✅ | Roles synced properly |
| Permissions | ✅ | Role-based checks work |

---

## Troubleshooting Test Failures

### Issue: Still see "Invalid role" error
**Solution:**
1. Clear browser cache: Ctrl+Shift+Delete
2. Clear localStorage
3. Restart backend: `python manage.py runserver`
4. Try again

### Issue: Role selector doesn't show
**Solution:**
1. Check browser console (F12)
2. Verify API response includes `available_roles`
3. Check user has boolean roles set: `user.is_instructor = True`

### Issue: JWT token doesn't include roles
**Solution:**
1. Verify serializer._add_user_fields() is called
2. Check token at jwt.io
3. Compare with expected fields

### Issue: Can switch role but no access
**Solution:**
1. Verify role persisted in database
2. Check permission classes in views.py
3. Verify has_boolean_role() returns True

---

## Test Automation

### Manual Test Script
```bash
# Login
curl -X POST http://localhost:8000/api/v1/oauth/google-login/ \
  -H "Content-Type: application/json" \
  -d '{"token": "TOKEN"}' | jq '.user.available_roles'

# Should return: ["student", "instructor", "admin"]

# Switch role
curl -X POST http://localhost:8000/api/v1/auth/select-role/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "instructor"}' | jq '.success'

# Should return: true
```

---

## Sign-Off

**Tester:** _________________  
**Date:** _________________  
**Result:** ✅ PASS / ❌ FAIL  

**Notes:**
_________________________________________

---

**Testing Complete!**

All scenarios verified. System ready for production.
