# 🔍 ROLE ASSIGNMENT DEEP SCAN REPORT

## Executive Summary
✅ **User Status:** `khairilazmiashari@gmail.com` **NOW HAS ALL ROLES**
- **Previous Status:** Only `student` role
- **Current Status:** `student,teacher,admin` (all roles assigned)
- **Role Switching:** Now functional for testing all features

---

## 🎯 Current User Configuration

**User ID:** 4
**Email:** khairilazmiashari@gmail.com
**Username:** khairilazmiashari

### Role Fields Status
```
┌─ Deprecated Field (for backward compatibility)
│  └─ user.role = 'student'  ✓ Updated
├─ New Multi-Role Field
│  └─ user.roles = 'student,teacher,admin'  ✓ Updated (ALL ROLES)
└─ Active Role Field
   └─ user.current_role = 'student'  ✓ (Can switch via API)
```

---

## 🔎 THE CULPRITS - Where Roles Are Assigned

### 1. **User Registration** - RegisterSerializer (MAIN CULPRIT)
**File:** `backend/api/serializer.py` (Lines 64-124)

**Problem:** When users register, **NO ROLES ARE SET** - defaults to Django User model defaults.

```python
class RegisterSerializer(serializers.ModelSerializer):
    # ...
    def create(self, validated_data):
        user = User.objects.create(
            full_name=full_name or email_username,
            email=email,
            username=email_username,
        )
        user.set_password(password)
        user.save()
        # ❌ NO ROLE IS SET HERE! Falls back to model default: 'student'
        return user
```

**Impact:** New users get hardcoded `role='student'` because `User.role` has `default='student'` in the model.

**Fix Needed:** Add role assignment during registration:
```python
user.role = 'student'  # Or allow role selection
user.roles = 'student'
user.current_role = 'student'
user.save()
```

---

### 2. **Admin User Creation** - AdminUserCreateAPIView (CONTROLLED)
**File:** `backend/api/views.py` (Lines 4703-4750)

**How it works:**
```python
class AdminUserCreateAPIView(generics.CreateAPIView):
    def create(self, request, *args, **kwargs):
        # ✅ CORRECTLY ASSIGNS ROLE FROM REQUEST
        role = request.data.get('role', 'student')  # Accepts from API
        
        user.role = role  # ✅ Sets role
        user.save()
        
        # ✅ Creates Teacher profile if needed
        if role == 'teacher':
            Teacher.objects.create(user=user, full_name=user.full_name)
```

**Status:** ✅ Working correctly for admin-created users.

---

### 3. **SSO User Creation** - create_user_from_sso (SSO INTEGRATION)
**File:** `backend/api/sso_utils.py` (Lines 135+)

**Problem:** Users created via SSO may have limited role assignment.

**Recommendation:** Check SSO implementation for role assignment.

---

### 4. **Model Default** - User Model Definition
**File:** `backend/userauths/models.py` (Lines 48-66)

```python
class User(AbstractUser):
    role = models.CharField(
        max_length=10, 
        choices=USER_ROLE_CHOICES, 
        default='student',  # ❌ CULPRIT: Always defaults to 'student'
        null=True, 
        blank=True
    )
    
    roles = models.CharField(
        max_length=50, 
        default='student',  # ❌ CULPRIT: Also defaults to 'student'
        help_text="Comma-separated roles: student,teacher,admin"
    )
    
    current_role = models.CharField(
        max_length=10, 
        choices=USER_ROLE_CHOICES, 
        default='student',  # ❌ CULPRIT: Default only 'student'
        help_text="Currently active role for this session"
    )
```

**Impact:** Model design forces new users to single `'student'` role. Would need migration to change.

---

### 5. **Role Switching** - SwitchRoleAPIView (WORKING)
**File:** `backend/api/views.py` (Lines 4729+ and 4793+)

**How it works:**
```python
def post(self, request):
    role = request.data.get('role')
    # Validates role is in user.roles
    if role not in user.roles.split(','):
        return Error
    
    user.current_role = role  # ✅ Switches active role
    user.save()
    # Returns new JWT with updated current_role
```

**Status:** ✅ Correctly validates and switches roles.

---

## 📋 Role Assignment Flowchart

```
User Registration
    ↓
RegisterSerializer.create()
    ├─ user.role = 'student'  (default from model)
    ├─ user.roles = 'student'  (default from model)
    └─ user.current_role = 'student'  (default from model)
    ↓
User Logs In
    ↓
Generate JWT with current_role = 'student'
    ↓
User Calls /api/v1/roles/switch-role/ (IF user has multiple roles)
    ├─ Validates new_role is in user.roles
    └─ Updates user.current_role = new_role
    ↓
New JWT generated with updated current_role
```

---

## 🚀 Testing Workflow (Your Account Now)

Since your account now has all 3 roles, here's what you can test:

### Step 1: Login
```
POST /api/v1/auth/login/
{
    "email": "khairilazmiashari@gmail.com",
    "password": "your_password"
}
```

**Returns JWT with:** `current_role: 'student'`

### Step 2: Switch to Teacher Role
```
POST /api/v1/roles/switch-role/
{
    "role": "teacher"
}
(Header: Authorization: Bearer <JWT>)
```

**Returns new JWT with:** `current_role: 'teacher'`

### Step 3: Switch to Admin Role
```
POST /api/v1/roles/switch-role/
{
    "role": "admin"
}
```

**Returns JWT with:** `current_role: 'admin'`

### Step 4: Test Role-Specific Features

**As Student:**
- View course catalog
- Enroll in courses
- Access Q&A section
- View wishlist
- Request certificates

**As Teacher:**
- Create courses
- View student enrollments
- Grade assignments
- View course analytics

**As Admin:**
- Access admin dashboard
- Manage users
- View system analytics
- Manage content
- View search analytics

---

## 🔧 How to Give Other Users All Roles

Run the same script for other users:

```bash
cd backend
python manage.py shell
```

Then execute:
```python
from userauths.models import User

# Find user
user = User.objects.get(email='other_user@example.com')

# Give all roles
user.roles = 'student,teacher,admin'
user.current_role = 'student'
user.role = 'student'
user.save()

print(f"✅ Updated {user.email} with all roles")
```

---

## 📊 All Users in System

To see all users and their current roles:

```bash
python manage.py shell
```

```python
from userauths.models import User

for user in User.objects.all():
    print(f"📧 {user.email}")
    print(f"   role: {user.role}")
    print(f"   roles: {user.roles}")
    print(f"   current_role: {user.current_role}")
    print()
```

---

## 🔑 Key Architecture Points

### Three Role Fields (Legacy + New System)

1. **`user.role`** (DEPRECATED)
   - Single role (string): 'student', 'teacher', or 'admin'
   - Used in old permission checks
   - Being phased out

2. **`user.roles`** (NEW PRIMARY)
   - Multiple roles (comma-separated string): 'student,teacher,admin'
   - Supports multi-role users
   - Checked by permission classes

3. **`user.current_role`** (SESSION ROLE)
   - Currently active role (string)
   - Must be one of the roles in `user.roles`
   - Updated when user switches roles
   - Included in JWT token

### Permission Classes Check Logic

```python
# IsStudentUser
if hasattr(request.user, 'current_role') and request.user.current_role == 'student':
    return True  # Allow
elif hasattr(request.user, 'role') and request.user.role == 'student':
    return True  # Fallback for old system
return False

# Similar for IsTeacherUser and IsAdminUser
```

---

## 🎉 SUCCESS!

✅ **User `khairilazmiashari@gmail.com` is now fully configured for testing:**
- ✅ Has all 3 roles: student, teacher, admin
- ✅ Can switch between roles via `/api/v1/roles/switch-role/`
- ✅ All feature testing paths available
- ✅ Frontend role selector will show all 3 options in dropdown

---

## 📁 Related Files

| File | Purpose | Lines |
|------|---------|-------|
| `backend/userauths/models.py` | User model definition | 1-308 |
| `backend/api/serializer.py` | RegisterSerializer | 64-124 |
| `backend/api/views.py` | AdminUserCreateAPIView | 4703-4750 |
| `backend/api/views.py` | SwitchRoleAPIView | 4729+, 4793+ |
| `backend/api/permissions.py` | Permission classes | Various |
| `frontend/src/utils/roleUtils.js` | Role checking utilities | Various |
| `frontend/src/components/RoleSelectionModal.jsx` | Role switcher UI | Various |

---

**Generated:** January 25, 2026
**Status:** ✅ Complete and Verified
