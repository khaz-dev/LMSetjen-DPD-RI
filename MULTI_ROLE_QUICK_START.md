# MULTI-ROLE IMPLEMENTATION - QUICK START GUIDE

**Created**: January 25, 2026  
**Scope**: Complete system implementation for multiple roles per user  
**Estimated Effort**: 10-15 hours for full implementation

---

## 📋 EXECUTIVE SUMMARY

**Current State**: Each user has exactly ONE role (student, teacher, or admin)  
**Target State**: Each user can have MULTIPLE roles and select which role to use

**Benefits**:
- ✅ One account for all roles (instructor who is also admin)
- ✅ Easy testing (one account can test all features)
- ✅ Flexible team structures
- ✅ Reduced account management overhead

---

## 🏗️ ARCHITECTURE OVERVIEW

### Data Model Changes

```
BEFORE:
┌─────────────┐
│   User      │
├─────────────┤
│ role: "student" OR "teacher" OR "admin"
└─────────────┘

AFTER:
┌─────────────────────────┐
│   User                  │
├─────────────────────────┤
│ roles: "student,teacher"    (NEW)
│ current_role: "student"     (NEW - active role)
│ role: "student"             (deprecated, for compatibility)
└─────────────────────────┘
```

### Login Flow Changes

```
BEFORE:
User clicks Login → API validates → Returns JWT with role → Redirect to dashboard

AFTER:
User clicks Login → API validates → Check available_roles
  ├─ If 1 role: Return JWT, redirect to dashboard
  └─ If 2+ roles: Show "Select Your Role" modal
                ├ User selects role → Returns new JWT with current_role
                └─ Redirect to appropriate dashboard
```

### Role Switching

```
User can switch roles from Profile page:
Profile Page → Role Selector Dropdown → Select new role
             → API updates current_role → New JWT token
             → Redirect to new role's dashboard
```

---

## 📂 IMPLEMENTATION CHECKLIST

### PHASE 1: Backend Model (1-2 hours)
- [ ] Update `User` model in `backend/userauths/models.py`
  - [ ] Keep existing `role` field for backward compatibility
  - [ ] Add `roles` field (comma-separated string)
  - [ ] Add `current_role` field
  - [ ] Add helper methods (get_available_roles, has_role, set_current_role)
  - [ ] Update existing methods (is_admin, is_teacher, is_student)
  
- [ ] Create data migration
  - [ ] `python manage.py makemigrations userauths`
  - [ ] Update existing users: migrate single role to `roles` field
  - [ ] Set `current_role` = existing `role`

### PHASE 2: Backend Permissions (1-1.5 hours)
- [ ] Update `backend/api/permissions.py`
  - [ ] Modify `IsAdminUser` to check `current_role`
  - [ ] Modify `IsTeacherUser` to check `current_role`
  - [ ] Modify `IsStudentUser` to check `current_role`
  - [ ] Add backward compatibility fallback to old `role` field
  
- [ ] Update all views using permission checks
  - [ ] Search for `permission_classes = [IsAdminUser]` (~20 occurrences)
  - [ ] Search for `permission_classes = [IsTeacherUser]` (~20 occurrences)
  - [ ] Search for `permission_classes = [IsStudentUser]` (~15 occurrences)
  - [ ] No code changes needed (permissions handle it)

### PHASE 3: Backend Authentication (1-1.5 hours)
- [ ] Update JWT token serializer
  - [ ] File: `backend/api/serializer.py`
  - [ ] Add `available_roles` to token payload
  - [ ] Add `current_role` to token payload
  - [ ] Update login response to include both fields

- [ ] Create new endpoints
  - [ ] File: `backend/api/views.py`
  - [ ] POST `/api/v1/auth/select-role/` - Switch role
  - [ ] GET `/api/v1/auth/available-roles/` - Get user's roles
  - [ ] Update login response format

- [ ] Create new URLs
  - [ ] File: `backend/api/urls.py`
  - [ ] Add new endpoint paths

### PHASE 4: Frontend State (1-1.5 hours)
- [ ] Update `UserData.js` context
  - [ ] File: `frontend/src/views/plugin/UserData.js`
  - [ ] Add `available_roles` state
  - [ ] Add `current_role` state
  - [ ] Add methods: `setUserRoles()`, `setCurrentRole()`
  - [ ] Update localStorage keys

- [ ] Update API interceptor
  - [ ] File: `frontend/src/utils/useAxios.js` (or `apiInstance.js`)
  - [ ] Add `current_role` to request headers
  - [ ] Handle role updates on token refresh

### PHASE 5: Frontend Components (2-3 hours)
- [ ] Create RoleSelectionModal component
  - [ ] File: `frontend/src/components/RoleSelectionModal.jsx`
  - [ ] Display available roles as radio buttons
  - [ ] Handle role selection
  - [ ] Show role descriptions

- [ ] Update Login.jsx
  - [ ] Show modal if multiple roles
  - [ ] Handle role selection
  - [ ] Update JWT token with selected role
  - [ ] Redirect to appropriate dashboard

- [ ] Update Profile pages
  - [ ] All: `frontend/src/views/student|instructor|admin/Profile.jsx`
  - [ ] Add role selector dropdown
  - [ ] Handle role change API call
  - [ ] Update localStorage and context
  - [ ] Redirect after role change

- [ ] Update Header/Navbar components
  - [ ] Show current role indicator
  - [ ] Add role switcher menu (optional)
  - [ ] Update permission checks

### PHASE 6: Routing Updates (30-45 minutes)
- [ ] Update `RoleRoute.jsx`
  - [ ] Support multiple routes (not just one per role)
  - [ ] Check `current_role` not just `role`
  - [ ] Handle multi-role navigation

### PHASE 7: Testing (2-3 hours)
- [ ] Unit tests
  - [ ] User model methods
  - [ ] Permission classes
  - [ ] Role selection logic

- [ ] Integration tests
  - [ ] Login with multiple roles
  - [ ] Role selection modal
  - [ ] Role switching
  - [ ] Permission enforcement

- [ ] Manual testing
  - [ ] Create test user with 2 roles
  - [ ] Test role selection on login
  - [ ] Test role switching on profile
  - [ ] Test access to endpoints for each role
  - [ ] Test backward compatibility with single-role users

---

## 🔑 KEY CODE CHANGES (SUMMARY)

### Backend Model Change
```python
# ADD to User model:
roles = models.CharField(max_length=50, default='student')
current_role = models.CharField(max_length=10, default='student', choices=USER_ROLE_CHOICES)

# ADD methods:
def get_available_roles(self):
    return [r.strip() for r in self.roles.split(',') if r.strip()]

def set_current_role(self, role):
    if role not in self.get_available_roles():
        raise ValueError(f"User does not have {role} role")
    self.current_role = role
    self.save()
```

### Permission Class Change
```python
# UPDATE IsAdminUser (similar for others):
def has_permission(self, request, view):
    if not request.user or not request.user.is_authenticated:
        return False
    # Check current_role first
    if hasattr(request.user, 'current_role') and request.user.current_role == 'admin':
        return True
    # Fallback to role (backward compatibility)
    if hasattr(request.user, 'role') and request.user.role == 'admin':
        return True
    return False
```

### Frontend State Change
```javascript
// UPDATE UserData.js:
available_roles: JSON.parse(localStorage.getItem("available_roles") || "['student']"),
current_role: localStorage.getItem("current_role") || "student",

// ADD methods:
setUserRoles: (roles) => set({ available_roles: roles, current_role: roles[0] }),
setCurrentRole: (role) => set({ current_role: role }),
```

### Login Flow Change
```javascript
// IN Login.jsx - after successful login:
const availableRoles = response.data?.available_roles || [response.data?.role];

if (availableRoles.length > 1) {
    // Show role selection modal
    setAvailableRoles(availableRoles);
    setShowRoleSelection(true);
} else {
    // Single role - proceed
    proceedWithRole(availableRoles[0]);
}
```

---

## 🚀 QUICK START (Step-by-Step for First-Time Implementation)

### Day 1: Backend Setup

**Step 1**: Update User model (30 min)
```bash
# Edit backend/userauths/models.py
# Add roles, current_role fields and methods
# Run: python manage.py makemigrations userauths
# Run: python manage.py migrate
```

**Step 2**: Update Permissions (30 min)
```bash
# Edit backend/api/permissions.py
# Update IsAdminUser, IsTeacherUser, IsStudentUser
# No changes needed to individual views (permission classes handle it)
```

**Step 3**: Update Auth (1 hour)
```bash
# Edit backend/api/serializer.py - update token generation
# Edit backend/api/views.py - add SelectRoleAPIView, AvailableRolesAPIView
# Edit backend/api/urls.py - add new paths
# Test: python manage.py runserver
# Verify: POST http://localhost:8000/api/v1/auth/login/
```

### Day 2: Frontend Setup

**Step 4**: Update State (1 hour)
```bash
# Edit frontend/src/views/plugin/UserData.js
# Add available_roles, current_role to state
# Add setUserRoles, setCurrentRole methods

# Edit frontend/src/utils/useAxios.js
# Add current_role to request headers
```

**Step 5**: Create Components (1 hour)
```bash
# Create frontend/src/components/RoleSelectionModal.jsx
# Edit frontend/src/views/auth/Login.jsx - add modal trigger
# Test: npm run dev, login with multi-role user
```

**Step 6**: Update Pages (1-2 hours)
```bash
# Edit Profile pages to add role selector
# Update Header components
# Test role selection and switching
```

### Day 3: Testing

**Step 7**: Create Test User (30 min)
```python
# In Django shell:
user = User.objects.get(email="test@example.com")
user.roles = "student,teacher"
user.current_role = "student"
user.save()
```

**Step 8**: Comprehensive Testing (2-3 hours)
- [ ] Login with multi-role user → Modal appears
- [ ] Select teacher role → JWT token updated
- [ ] Access teacher endpoints → Works
- [ ] Switch to student → Redirects to student dashboard
- [ ] Verify backward compat with single-role users

---

## ✅ VALIDATION CHECKLIST

- [ ] User with 1 role: No modal, direct redirect
- [ ] User with 2+ roles: Modal appears, can select role
- [ ] Admin endpoints return 403 if current_role ≠ admin
- [ ] Teacher endpoints return 403 if current_role ≠ teacher
- [ ] Student endpoints return 403 if current_role ≠ student
- [ ] Role persists after page reload
- [ ] Role persists after logout/login
- [ ] Role updates in JWT token
- [ ] Old single-role users still work
- [ ] Role can be changed from profile page
- [ ] Appropriate dashboard shown for each role

---

## 🆘 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| "Role not found" error | Check roles field is comma-separated and valid |
| Permission denied after role switch | Clear localStorage and JWT cache |
| Modal not showing on login | Check available_roles returned in login response |
| Role doesn't persist | Verify localStorage saving current_role |
| Old users can't login | Ensure backward compat fallback to role field |
| API returns 403 for valid role | Check current_role in JWT token matches permission check |

---

## 📚 DOCUMENTATION CREATED

1. **MULTI_ROLE_IMPLEMENTATION_PLAN.md** - High-level plan
2. **MULTI_ROLE_DETAILED_IMPLEMENTATION.md** - Phase-by-phase code guide
3. **MULTI_ROLE_DEEP_SCAN_REPORT.md** - Comprehensive technical analysis
4. **This file** - Quick start reference

---

## 🎯 SUCCESS METRICS

- ✅ Users can have multiple roles
- ✅ Role selection on login works
- ✅ Role switching on profile works
- ✅ Permissions enforced per role
- ✅ No breaking changes to existing single-role users
- ✅ System performance unchanged
- ✅ All tests passing

---

## 📞 SUPPORT

For implementation questions, refer to the detailed documents created:
- Architecture: `MULTI_ROLE_DEEP_SCAN_REPORT.md`
- Code: `MULTI_ROLE_DETAILED_IMPLEMENTATION.md`
- Planning: `MULTI_ROLE_IMPLEMENTATION_PLAN.md`

**Ready to begin implementation? Start with PHASE 1 (Backend Model) on Day 1!**
