# Multi-Role Architecture - Deep Scan Report

**Date**: January 25, 2026  
**System**: LMSetjen DPD RI  
**Scope**: Complete frontend and backend role implementation analysis

---

## CURRENT SYSTEM ANALYSIS

### Backend Role Implementation (CURRENT STATE)

**File**: `backend/userauths/models.py`

```python
# Current: Single role per user
role = models.CharField(max_length=10, choices=USER_ROLE_CHOICES, default='student')

# Available roles:
USER_ROLE_CHOICES = (
    ('student', 'Student'),
    ('teacher', 'Teacher'),
    ('admin', 'Admin'),
)
```

**Limitation**: User can only have ONE role at a time

### Backend Permission Classes (CURRENT STATE)

**File**: `backend/api/permissions.py`

Three main permission classes:
- `IsAdminUser` - Checks if `user.role == 'admin'`
- `IsTeacherUser` - Checks if `user.role in ['teacher', 'instructor']`
- `IsStudentUser` - Checks if `user.role == 'student'`

**Impact**: ~50+ API endpoints use these permission classes

### Frontend Role Detection (CURRENT STATE)

**File**: `frontend/src/views/plugin/UserData.js`

```javascript
role: string  // Single role stored from JWT token
```

**Usage Patterns Found**:
- `UserData().role` checked in ~8 major locations
- `RoleRoute` component redirects based on single role
- `Login.jsx` authenticates and sets single role
- All admin/instructor/student views assume single role

### Role-Based Routing (CURRENT STATE)

**File**: `frontend/src/layouts/RoleRoute.jsx`

```javascript
switch(userData.role.toLowerCase()) {
    case 'admin': return <Route path="/admin/*" />;
    case 'teacher': return <Route path="/instructor/*" />;
    case 'student': return <Route path="/student/*" />;
}
```

**Limitation**: User redirected to ONE role area only

---

## AFFECTED COMPONENTS (COMPREHENSIVE SCAN)

### Backend Files Requiring Changes (~20 files)

1. **Models** (2 files)
   - `backend/userauths/models.py` - User model
   - Need: `roles`, `current_role` fields

2. **Permissions** (1 file)
   - `backend/api/permissions.py` - Update all checks

3. **Serializers** (1 file)
   - `backend/api/serializer.py` - Include roles in responses

4. **Views** (3 files)
   - `backend/api/views.py` - All views checking `request.user.role`
   - `backend/userauths/views.py` - Auth views
   - New: `role-selection` views

5. **URLs** (1 file)
   - `backend/api/urls.py` - Add new endpoints

6. **OAuth/SSO** (1 file)
   - `backend/api/sso_utils.py` - Create users with role

7. **Migrations** (1 file)
   - `backend/userauths/migrations/` - Data migration

8. **Signals/Handlers** (1 file)
   - Role update handlers if any

### Frontend Files Requiring Changes (~25-30 files)

1. **State Management** (2 files)
   - `frontend/src/views/plugin/UserData.js` - Add roles, current_role
   - `frontend/src/views/plugin/Context.jsx` - Update ProfileContext

2. **Authentication** (3 files)
   - `frontend/src/views/auth/Login.jsx` - Add role selection modal
   - `frontend/src/views/auth/Register.jsx` - Handle role assignment
   - New: `RoleSelectionModal.jsx` component

3. **Routing** (2 files)
   - `frontend/src/layouts/RoleRoute.jsx` - Support multi-role routing
   - `frontend/src/layouts/PrivateRoute.jsx` - Role checking

4. **Components** (5 files)
   - `frontend/src/views/student/Partials/Header.jsx` - Add role indicator
   - `frontend/src/views/instructor/Partials/Header.jsx` - Similar
   - `frontend/src/views/admin/Partials/Header.jsx` - Similar
   - Any navbar/header component
   - New: `RoleSwitcher.jsx` component

5. **Pages** (8-10 files)
   - `frontend/src/views/student/Profile.jsx` - Add role selector
   - `frontend/src/views/instructor/Profile.jsx` - Same
   - `frontend/src/views/admin/Profile.jsx` - Same
   - All dashboard pages (need to verify current_role)

6. **Utilities** (2 files)
   - `frontend/src/utils/useAxios.js` - Add current_role header
   - `frontend/src/utils/auth.js` - Role checking helpers

7. **Hooks** (1 file)
   - New: `useRoleSelection.js` - Custom hook for role management

---

## DETAILED SCAN RESULTS

### Backend: Permission Classes Usage

**Files with permission checks found**:
- `backend/api/views.py` (~50+ viewsets)
- `backend/userauths/views.py` (~5 viewsets)
- Total impact: ~55+ permission checks

**Pattern**:
```python
permission_classes = [IsAdminUser]  # ~20 endpoints
permission_classes = [IsTeacherUser]  # ~20 endpoints
permission_classes = [IsStudentUser]  # ~15 endpoints
```

### Frontend: Role Checks Found

**Current usage patterns**:
```javascript
userData.role === 'admin'   // Admin-only components
userData.role === 'teacher' // Teacher-only components
userData.role === 'student' // Student-only components
```

**Components checking role**:
- RoleRoute.jsx - Main routing
- Login.jsx - Redirect after login
- Header components - Role display
- NavBar/Sidebar - Role-based menu items
- Dashboard pages - Role indicators

---

## IMPLEMENTATION COMPLEXITY ASSESSMENT

### Backend Complexity: **HIGH**
- 1 model change (but significant)
- 1 permission file update (extensive)
- 3 serializer updates
- 20+ view updates
- Database migration with data transformation

**Estimated Time**: 3-4 hours

### Frontend Complexity: **HIGH**
- 1 major state management change
- 1 new component (RoleSelectionModal)
- 3 authentication flow updates
- 2 routing logic updates
- 5+ component updates
- 10+ page updates
- 2 utility updates

**Estimated Time**: 4-5 hours

### Testing Complexity: **VERY HIGH**
- Multi-role scenarios (2, 3+ roles)
- Role switching validation
- Permission enforcement per role
- JWT token updates
- Session persistence
- Cross-browser compatibility
- Old single-role user compatibility

**Estimated Time**: 3-4 hours

---

## CRITICAL IMPLEMENTATION STEPS (PRIORITY ORDER)

### PRIORITY 1: Backend Foundation (DO FIRST)
1. Update User model - add `roles`, `current_role` fields
2. Create data migration
3. Add helper methods to User model

### PRIORITY 2: Authentication
4. Update JWT token serializer
5. Create role selection endpoint
6. Update login endpoint response

### PRIORITY 3: Permissions
7. Update permission classes (IsAdminUser, etc.)
8. Update all ~55 view permission checks
9. Test backward compatibility

### PRIORITY 4: Frontend State
10. Update UserData() context store
11. Add roles to localStorage
12. Create role management hooks

### PRIORITY 5: Frontend UI
13. Create RoleSelectionModal component
14. Update Login.jsx with role selection
15. Update Profile pages with role selector
16. Add role indicator in headers

### PRIORITY 6: Integration
17. Update routing logic (RoleRoute.jsx)
18. Update all permission checks in components
19. Add role switcher in navbar

### PRIORITY 7: Testing
20. Test all role combinations
21. Test role switching
22. Test permission enforcement
23. Test backward compatibility

---

## RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Database migration fails | Data loss | Test on copy, backup before migration, rollback plan |
| Old role field breaks | API errors | Keep old `role` field, map to new system |
| JWT token invalid | Auth fails | Version tokens, handle token refresh |
| Permission checks miss cases | Security issue | Comprehensive testing of all endpoints |
| Role persistence issues | User confusion | Test localStorage, session, token refresh |
| Backward compatibility breaks | Old users locked out | Support both old single-role and new multi-role during transition |

---

## FILES TO CREATE

### Backend
1. `backend/api/views/RoleSelectionView.py` - New role selection endpoint
2. `backend/api/migrations/000X_add_multi_role_support.py` - Migration

### Frontend  
1. `frontend/src/components/RoleSelectionModal.jsx` - Modal component
2. `frontend/src/hooks/useRoleSelection.js` - Custom hook
3. `frontend/src/components/RoleSwitcher.jsx` - Role switcher component

---

## FILES TO MODIFY

### Backend (~20 files)
- `userauths/models.py` - User model
- `userauths/admin.py` - Admin interface
- `api/permissions.py` - Permission classes
- `api/serializer.py` - Serializers
- `api/views.py` - ~50+ viewsets
- `api/urls.py` - New endpoints
- `api/sso_utils.py` - OAuth user creation
- All relevant views with permission checks

### Frontend (~30 files)
- `views/plugin/UserData.js` - Context store
- `views/plugin/Context.jsx` - ProfileContext
- `views/auth/Login.jsx` - Login flow
- `layouts/RoleRoute.jsx` - Routing logic
- `utils/useAxios.js` - API interceptor
- All header/navbar components
- All profile/dashboard pages
- All admin/instructor/student main components

---

## TESTING MATRIX

### Test Scenarios (30+ test cases)

1. **Role Selection on Login**
   - User with 1 role → No modal, direct redirect
   - User with 2 roles → Modal appears, selection works
   - User with 3 roles → Modal shows all, selection works

2. **Permission Enforcement**
   - Admin endpoints → Only accessible with admin current_role
   - Teacher endpoints → Only accessible with teacher current_role
   - Student endpoints → Only accessible with student current_role

3. **Role Switching**
   - Switch from student to teacher → Endpoints change
   - Switch from teacher to admin → Permissions update
   - Switch back → Original restrictions apply

4. **Persistence**
   - Role persists after page reload
   - Role persists after logout/login
   - Role in JWT token matches current_role

5. **Backward Compatibility**
   - Existing single-role users still work
   - Old role field not breaking
   - Migration preserves user data

---

## SUCCESS CRITERIA

- ✅ User can have multiple roles
- ✅ User selects role on login (if multiple)
- ✅ User can switch roles on profile page
- ✅ Permissions enforced based on current_role
- ✅ Role persists across page reloads
- ✅ Backward compatible with existing data
- ✅ No API errors for old single-role users
- ✅ All tests pass
- ✅ No performance degradation

---

## ESTIMATED TIMELINE

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Backend Model | 1 hour | Day 1 | Day 1 |
| Permissions | 1.5 hours | Day 1 | Day 1 |
| Auth Endpoints | 1.5 hours | Day 1 | Day 1 |
| Frontend State | 1 hour | Day 2 | Day 2 |
| Frontend UI | 2 hours | Day 2 | Day 2 |
| Testing | 3 hours | Day 2 | Day 3 |
| **TOTAL** | **~10 hours** | | |

---

**RECOMMENDATION**: Implement in phases. Start with backend model and permissions, then frontend state management, then UI components. This ensures solid foundation before UI work.
