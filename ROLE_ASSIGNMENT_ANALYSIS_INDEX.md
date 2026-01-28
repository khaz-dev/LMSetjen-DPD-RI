# 📑 ROLE ASSIGNMENT ANALYSIS - COMPLETE DOCUMENTATION INDEX

## 🎯 Quick Summary

**Your Email:** `khairilazmiashari@gmail.com`  
**Current Status:** ✅ **ALL 3 ROLES ASSIGNED** (student, teacher, admin)  
**Ready to Test:** YES - Start at http://localhost:5173

---

## 📚 Documentation Files Created

### 1. **USER_MULTI_ROLE_TESTING_CARD.txt** ⭐ START HERE
   - **Purpose:** Quick visual reference card
   - **Contains:** Status, culprits summary, quick test workflow
   - **Read Time:** 5 minutes
   - **Best For:** Quick overview before testing

### 2. **DEEP_ROLE_ASSIGNMENT_SCAN.md** 🔬 DETAILED ANALYSIS
   - **Purpose:** Comprehensive technical deep-dive
   - **Contains:** All culprits, architecture details, file references
   - **Read Time:** 15-20 minutes
   - **Best For:** Understanding the system architecture

### 3. **ROLE_TESTING_SETUP_VISUAL.txt** 🧪 PRACTICAL GUIDE
   - **Purpose:** Step-by-step testing workflow
   - **Contains:** API calls, frontend interactions, test scenarios
   - **Read Time:** 10-15 minutes
   - **Best For:** Running tests and validating features

### 4. **ROLE_ASSIGNMENT_SUMMARY.md** 📋 EXECUTIVE SUMMARY
   - **Purpose:** Concise reference document
   - **Contains:** Key points, file locations, getting started
   - **Read Time:** 5-10 minutes
   - **Best For:** Quick reference while developing

---

## 🔍 The Culprits (Where Roles Are Assigned)

| # | Culprit | File | Lines | Status | Impact |
|---|---------|------|-------|--------|--------|
| 1 | RegisterSerializer | `backend/api/serializer.py` | 64-124 | 🔴 Issue | New users get 'student' only |
| 2 | User Model Default | `backend/userauths/models.py` | 48-66 | 🔴 Issue | Hardcoded defaults |
| 3 | AdminUserCreateAPIView | `backend/api/views.py` | 4703-4750 | 🟢 OK | Correctly assigns roles |
| 4 | SwitchRoleAPIView | `backend/api/views.py` | 4729+, 4793+ | 🟢 OK | Switches roles properly |
| 5 | SSO Creation | `backend/api/sso_utils.py` | 135+ | 🟠 Check | Needs verification |

---

## 📊 Current User Status

```
User: khairilazmiashari@gmail.com (ID: 4)

┌─────────────────────────────────────────────┐
│ ROLE CONFIGURATION                          │
├─────────────────────────────────────────────┤
│ user.role (deprecated)     = 'student'      │
│ user.roles (primary)       = 'student,      │
│                              teacher,       │
│                              admin'         │
│ user.current_role (session)= 'student'      │
│                              (can switch)   │
└─────────────────────────────────────────────┘

✅ CAN ACCESS:
   • Student features (always)
   • Teacher features (after switching)
   • Admin features (after switching)

✅ CAN TEST:
   • Multi-role switching
   • Role-specific endpoints
   • JWT token updates
   • UI role indicator
```

---

## 🎓 Understanding the 3 Role Fields

### user.role (DEPRECATED)
- **Type:** CharField with choices
- **Values:** 'student', 'teacher', 'admin'
- **Purpose:** Legacy field for old system
- **Current:** 'student'
- **Used By:** Old permission checks (fallback)

### user.roles (PRIMARY)
- **Type:** CharField (comma-separated)
- **Values:** 'student,teacher,admin'
- **Purpose:** List of roles user has access to
- **Current:** 'student,teacher,admin' ✅
- **Used By:** Permission validation (user has role?)

### user.current_role (SESSION)
- **Type:** CharField with choices
- **Values:** 'student', 'teacher', 'admin'
- **Purpose:** Currently active role for this session
- **Current:** 'student' (default on login)
- **Used By:** API endpoints (check current_role)
- **Can Change:** Via /api/v1/roles/switch-role/

---

## 🔄 Role Switching Flow

```
1. User logged in with JWT token
   └─ JWT includes: current_role='student'

2. Frontend shows role dropdown in header
   └─ Available roles from user.roles field

3. User clicks to switch role
   └─ Frontend calls POST /api/v1/roles/switch-role/
   └─ Body: {"role": "teacher"}

4. Backend validates role
   └─ Is 'teacher' in user.roles? YES ✅
   └─ Is 'teacher' in choices? YES ✅

5. Backend updates user.current_role
   └─ user.current_role = 'teacher'
   └─ user.save()

6. Backend returns new JWT
   └─ Token includes: current_role='teacher'

7. Frontend updates state
   └─ Sidebar changes to teacher menu
   └─ Routes update to teacher pages
   └─ API calls now use teacher permissions

8. User accesses teacher features
   └─ API checks: current_role == 'teacher'? YES ✅
   └─ Permission granted
```

---

## 📂 Key Backend Files

### Model Definition
- **File:** `backend/userauths/models.py` (lines 48-66)
- **Contains:** User model with role fields
- **Key:** Define role defaults, choices, and fields

### Serializers
- **File:** `backend/api/serializer.py` (lines 64-124)
- **Contains:** RegisterSerializer for user creation
- **Key:** Where roles SHOULD be assigned but aren't (culprit)

### Views/API Endpoints
- **File:** `backend/api/views.py`
- **Lines 4703-4750:** AdminUserCreateAPIView (role assignment)
- **Lines 4729+:** SwitchRoleAPIView (role switching)
- **Lines 4793+:** Additional role switching logic

### Permission Classes
- **File:** `backend/api/permissions.py`
- **Contains:** IsStudentUser, IsTeacherUser, IsAdminUser
- **How:** Check request.user.current_role == role

### SSO Integration
- **File:** `backend/api/sso_utils.py` (lines 135+)
- **Contains:** create_user_from_sso, create_user_from_google
- **Note:** Should assign roles during SSO user creation

---

## 📂 Key Frontend Files

### Role Utilities
- **File:** `frontend/src/utils/roleUtils.js`
- **Contains:** Functions to check user roles
- **Functions:** hasRole, isCurrentRole, switchRole, getAvailableRoles

### Role Selector Component
- **File:** `frontend/src/components/RoleSelectionModal.jsx`
- **Contains:** Dropdown UI for role switching
- **Location:** Header (top-right)

### Page Organization
- **Directory:** `frontend/src/views/`
- **Structure:**
  - `admin/` → Admin-only pages
  - `instructor/` → Teacher-only pages
  - `student/` → Student-only pages
  - `base/` → Common pages

---

## 🧪 How to Test

### Method 1: Frontend UI (Easiest)
1. Open http://localhost:5173
2. Login with khairilazmiashari@gmail.com
3. Click username in header → Select role from dropdown
4. Observe UI changes for each role
5. Test role-specific features

### Method 2: API Testing (Postman/cURL)
```bash
# 1. Login
POST http://localhost:8000/api/v1/auth/login/
Content-Type: application/json
{
  "email": "khairilazmiashari@gmail.com",
  "password": "your_password"
}
# Response: {"tokens": {...}, "user": {...}}

# 2. Copy access token from response

# 3. Switch Role
POST http://localhost:8000/api/v1/roles/switch-role/
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
{
  "role": "teacher"
}
# Response: {"message": "Role switched", "current_role": "teacher", "tokens": {...}}

# 4. Test Endpoint with New Role
GET http://localhost:8000/api/v1/course/create-course/
Authorization: Bearer <NEW_ACCESS_TOKEN>
# Should work because current_role='teacher'
```

### Method 3: Django Shell
```bash
cd backend
python manage.py shell
```

```python
from userauths.models import User
from api.models import Teacher

# Check user
user = User.objects.get(email='khairilazmiashari@gmail.com')
print(f"Roles: {user.roles}")
print(f"Current: {user.current_role}")

# Switch role (simulating what API does)
user.current_role = 'teacher'
user.save()
print(f"Switched to: {user.current_role}")

# Create Teacher profile if needed
teacher, created = Teacher.objects.get_or_create(
    user=user,
    defaults={'full_name': user.full_name}
)
print(f"Teacher profile: {'created' if created else 'exists'}")
```

---

## ✅ Verification Checklist

Before starting testing, verify:

```
Database:
  ☑ User exists: khairilazmiashari@gmail.com
  ☑ All 3 roles assigned: student, teacher, admin
  ☑ current_role is 'student' (default)
  ☑ Changes saved in database

Backend:
  ☑ Django running: localhost:8000
  ☑ /api/v1/auth/login/ working
  ☑ /api/v1/roles/switch-role/ working
  ☑ Permission classes checking current_role

Frontend:
  ☑ React running: localhost:5173
  ☑ Login page loads
  ☑ Role dropdown visible in header
  ☑ Can switch roles without error

JWT Token:
  ☑ Token includes current_role field
  ☑ Role updates when switching
  ☑ Backend validates role from token
```

---

## 🚀 Next Steps

1. **Read:** Start with `USER_MULTI_ROLE_TESTING_CARD.txt` (5 min)
2. **Understand:** Read `DEEP_ROLE_ASSIGNMENT_SCAN.md` (15 min)
3. **Test:** Follow `ROLE_TESTING_SETUP_VISUAL.txt` guide
4. **Reference:** Use `ROLE_ASSIGNMENT_SUMMARY.md` while developing
5. **Replicate:** Use `check_and_update_user_roles.py` for other test users

---

## 📞 Quick Reference

**Your Testing Account:**
- Email: `khairilazmiashari@gmail.com`
- Status: ✅ All roles configured
- Available Roles: student, teacher, admin
- Can Switch: ✅ YES

**API Endpoints:**
- Login: `POST /api/v1/auth/login/`
- Switch Role: `POST /api/v1/roles/switch-role/`
- Check Roles: `GET /api/v1/user/me/`

**Frontend:**
- Login: http://localhost:5173/login/
- Role Switch: Header dropdown (username)
- Admin Panel: Only visible in admin mode
- Teacher Panel: Only visible in teacher mode

---

## 🎉 Ready to Begin!

Everything is set up and verified. You now have:

✅ A user account with all 3 roles
✅ Complete understanding of role system
✅ Multiple testing guides
✅ API examples ready to use
✅ Frontend ready for interactive testing

**Start testing now!** 🚀

---

**Index Created:** January 25, 2026  
**All Files Verified:** ✅ YES  
**Status:** Complete and Ready
