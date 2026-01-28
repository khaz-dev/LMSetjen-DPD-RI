# Multi-Role Implementation Plan for LMSetjen DPD RI

**Date**: January 25, 2026  
**Phase**: Phase 4.22 - Multi-Role Support Architecture  
**Objective**: Enable users to have multiple roles and select their active role on login and profile page

## Executive Summary

Current system: **Single role per user** (student, teacher, or admin)  
Target system: **Multiple roles per user** with dynamic role selection

### Key Changes Required

#### Backend
1. Modify `User` model to support multiple roles via `ManyToManyField`
2. Add `current_role` field to track the active role per session
3. Update permission classes to check multiple roles
4. Modify login endpoints to return available roles and handle role selection
5. Update all views to respect `current_role` instead of just `role`
6. Update JWT token generation to include current_role

#### Frontend
1. Add role selection modal on login for users with multiple roles
2. Add role selector on profile edit page
3. Update `UserData()` context to include available roles and current role
4. Update all permission checks to use current_role
5. Add role switcher in header/navbar
6. Update localStorage to save current_role per user

### Database Schema Changes

```
OLD:
User.role = CharField (single role)

NEW:
User.roles = ManyToManyField(Role)
User.current_role = CharField (active role, must be in roles)
Session.current_role = CharField (backup: save role in session/JWT)
```

### API Endpoint Changes

**Login Response (Before)**
```json
{
  "access": "token",
  "refresh": "token",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "student"
  }
}
```

**Login Response (After)**
```json
{
  "access": "token",
  "refresh": "token",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "available_roles": ["student", "teacher"],
    "current_role": "student"
  }
}
```

**New Endpoint: Role Selection**
```
POST /api/v1/auth/select-role/
{
  "role": "teacher"
}

Response:
{
  "access": "new_token_with_new_role",
  "current_role": "teacher"
}
```

### Frontend Storage

**localStorage keys:**
```
auth_token: "..."
refresh_token: "..."
user_id: "1"
email: "user@example.com"
available_roles: ["student", "teacher"]  // NEW
current_role: "student"                  // NEW
```

## Implementation Stages

### Stage 1: Database & Backend (Priority: HIGH)
- [ ] Create UserRole model or use ManyToMany
- [ ] Add data migration to convert existing single roles to multiple
- [ ] Add current_role field to User model
- [ ] Update User model methods (is_admin, is_teacher, etc.)
- [ ] Update permission classes for multi-role checks
- [ ] Update JWT token serializer to include current_role
- [ ] Create role selection endpoint
- [ ] Update login endpoints

### Stage 2: Backend API Views (Priority: HIGH)
- [ ] Update all permission_classes checks
- [ ] Update views using request.user.role to check current_role
- [ ] Add role validation on all endpoints
- [ ] Test permission enforcement

### Stage 3: Frontend State Management (Priority: HIGH)
- [ ] Update UserData() store to include roles and current_role
- [ ] Update ProfileContext
- [ ] Add RoleSelectionModal component
- [ ] Update login flow to show role selection

### Stage 4: Frontend UI (Priority: MEDIUM)
- [ ] Add role selector on Profile page
- [ ] Add role indicator in Header
- [ ] Add role switcher in NavBar
- [ ] Update all role-based navigation

### Stage 5: Testing (Priority: HIGH)
- [ ] Create test user with multiple roles
- [ ] Test role selection on login
- [ ] Test role switching on profile page
- [ ] Test permission enforcement for each role
- [ ] Test JWT token refresh with current_role

## Affected Files (Estimated ~40-50 files)

### Backend Files (~20 files)
1. `userauths/models.py` - User model changes
2. `userauths/admin.py` - Admin interface
3. `api/permissions.py` - Permission classes
4. `api/serializer.py` - User/Profile serializers
5. `api/views.py` - All views with permission checks
6. `api/urls.py` - New endpoints
7. Various view files with role checks

### Frontend Files (~20-30 files)
1. `utils/UserData.js` - Context store
2. `views/auth/Login.jsx` - Login flow
3. `views/plugin/Context.jsx` - ProfileContext
4. `layouts/RoleRoute.jsx` - Role-based routing
5. `views/student/Partials/Header.jsx` - Header with role
6. `views/admin/` - All admin views
7. `views/instructor/` - All instructor views
8. All permission checks in components

## Risks & Considerations

1. **Data Migration**: Must safely convert existing single roles to multiple
2. **Backward Compatibility**: Some views may need to handle both old and new role systems
3. **Session Management**: Role needs to persist across page reloads
4. **Performance**: May need to optimize ManyToMany queries
5. **Testing**: Extensive testing required for all role combinations

## Timeline Estimate

- **Stage 1**: 2-3 hours (database + models)
- **Stage 2**: 2-3 hours (backend API updates)
- **Stage 3**: 2-3 hours (frontend state)
- **Stage 4**: 2-3 hours (frontend UI)
- **Stage 5**: 2-3 hours (testing)
- **Total**: ~10-15 hours for full implementation

---

**Next Step**: Begin with Stage 1 - Database & Backend Model Changes
