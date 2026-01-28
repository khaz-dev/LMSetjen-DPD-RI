# Multi-Role System API Documentation

**Version:** 2.0  
**Release Date:** January 25, 2026  
**Status:** ✅ Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Role Management](#role-management)
5. [Error Handling](#error-handling)
6. [Examples](#examples)
7. [Migration Guide](#migration-guide)

---

## Overview

The LMSetjen DPD RI system now supports **multi-role users**. Users can have multiple roles (student, teacher, admin) and switch between them seamlessly.

### Key Features

- **Multi-role support**: Users can hold multiple roles simultaneously
- **Current role context**: One role is "active" at a time (current_role)
- **Role switching**: Users can switch active role without logging out
- **Role-based access**: All endpoints check the current_role for authorization
- **Backward compatible**: Single-role users work exactly as before

### Role Types

| Role | Use Cases | Permissions |
|------|-----------|-------------|
| `student` | Enroll in courses, view grades | Access student endpoints |
| `teacher` | Create courses, grade students | Access instructor endpoints |
| `instructor` | Same as teacher | Access instructor endpoints |
| `admin` | System management | All endpoints |

---

## Authentication

### JWT Token Structure

All tokens now include `current_role`:

```json
{
  "user_id": 123,
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "student",                    // Deprecated (kept for compatibility)
  "current_role": "student",             // NEW: Currently active role
  "available_roles": ["student", "teacher"],  // NEW: All available roles
  "is_staff": false,
  "is_superuser": false,
  "exp": 1234567890
}
```

### Token Usage

Include in request header:

```bash
curl -H "Authorization: Bearer <access_token>" \
     https://api.example.com/api/v1/course/course-list/
```

---

## API Endpoints

### Available Roles

**Endpoint:** `GET /api/v1/auth/available-roles/`

Get all roles available to the current user and the currently active role.

**Authentication:** Required  
**Permission:** Any authenticated user

**Response:**
```json
{
  "available_roles": ["student", "teacher"],
  "current_role": "student",
  "success": true
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Not logged in
- `500 Server Error` - Database error

---

### Select Role

**Endpoint:** `POST /api/v1/auth/select-role/`

Switch to a different role. Returns new JWT tokens.

**Authentication:** Required  
**Permission:** User must have the requested role

**Request Body:**
```json
{
  "role": "teacher"
}
```

**Response (Success):**
```json
{
  "success": true,
  "current_role": "teacher",
  "available_roles": ["student", "teacher"],
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "message": "Role switched successfully"
}
```

**Response (Error - Invalid Role):**
```json
{
  "success": false,
  "error": "You do not have the 'admin' role"
}
```

**Response (Error - Missing Role):**
```json
{
  "success": false,
  "error": "Role field is required"
}
```

**Status Codes:**
- `200 OK` - Role switched successfully
- `400 Bad Request` - Invalid role or user doesn't have role
- `401 Unauthorized` - Not logged in
- `500 Server Error` - Database error

---

## Role Management

### User Model Changes

The `User` model now includes:

```python
class User(AbstractUser):
    # New fields for multi-role support
    roles = JSONField(default=list)           # List of available roles
    current_role = CharField(
        max_length=50,
        default='student',
        choices=ROLE_CHOICES
    )
    
    def get_available_roles(self):
        """Get all roles this user has"""
        return self.roles
    
    def has_role(self, role):
        """Check if user has a specific role"""
        return role in self.roles
    
    def set_current_role(self, role):
        """Change current active role"""
        if role in self.roles:
            self.current_role = role
            self.save()
            return True
        return False
```

### Permission Classes

All permission classes now check `current_role`:

```python
class IsStudentUser(permissions.BasePermission):
    """Check if user's current role is student"""
    
    def has_permission(self, request, view):
        # Check current_role (not deprecated 'role' field)
        current_role = getattr(request.user, 'current_role', None)
        return current_role == 'student'
```

### Endpoint Protection

```python
from api.permissions import IsStudentUser, IsTeacherUser

class StudentCourseListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsStudentUser]
    # Only accessible when current_role is 'student'

class TeacherCourseListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsTeacherUser]
    # Only accessible when current_role is 'teacher' or 'instructor'
```

---

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": "Descriptive error message",
  "error_code": "INVALID_ROLE"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `INVALID_ROLE` | Requested role doesn't exist | Check available roles first |
| `NO_SUCH_ROLE` | User doesn't have requested role | Check available roles first |
| `NOT_AUTHENTICATED` | No valid token provided | Login first |
| `ROLE_SWITCH_FAILED` | Database error during switch | Retry the request |

### Error Handling in Frontend

```javascript
import Toast from '../views/plugin/Toast';

const handleRoleSwitch = async (role) => {
  try {
    const result = await switchRole(role);
    
    if (result.success) {
      Toast().fire({
        icon: 'success',
        title: 'Role Switched',
        text: `You are now in ${role} mode`,
        timer: 3000
      });
      window.location.reload();
    } else {
      Toast().fire({
        icon: 'error',
        title: 'Error',
        text: result.error || 'Failed to switch role',
        timer: 3000
      });
    }
  } catch (error) {
    Toast().fire({
      icon: 'error',
      title: 'Error',
      text: 'An error occurred',
      timer: 3000
    });
  }
};
```

---

## Examples

### Example 1: Get Available Roles

```bash
# Request
curl -X GET 'https://api.example.com/api/v1/auth/available-roles/' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...'

# Response
{
  "available_roles": ["student", "teacher"],
  "current_role": "student",
  "success": true
}
```

### Example 2: Switch Roles

```bash
# Request
curl -X POST 'https://api.example.com/api/v1/auth/select-role/' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs...' \
  -H 'Content-Type: application/json' \
  -d '{"role": "teacher"}'

# Response
{
  "success": true,
  "current_role": "teacher",
  "available_roles": ["student", "teacher"],
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Example 3: Access Endpoint with New Role

```bash
# Use new token from role switch
curl -X GET 'https://api.example.com/api/v1/instructor/courses/' \
  -H 'Authorization: Bearer <new_access_token_from_role_switch>'

# Now has access to teacher endpoints
```

### Example 4: Frontend Component

```jsx
import RoleIndicator from '@/components/RoleIndicator';
import { useRoles } from '@/utils/useRoles';

function Dashboard() {
  const { currentRole, availableRoles, rolesLoading } = useRoles();

  if (rolesLoading) return <Spinner />;

  return (
    <div>
      <h1>Dashboard</h1>
      
      {/* Role indicator with dropdown switcher */}
      <RoleIndicator compact={true} />
      
      {/* Content based on current role */}
      {currentRole === 'student' && <StudentContent />}
      {currentRole === 'teacher' && <TeacherContent />}
      {currentRole === 'admin' && <AdminContent />}
    </div>
  );
}
```

---

## Migration Guide

### For Developers

#### 1. Update User Model (Completed in Phase 1)

```python
# Already done - User model has roles and current_role fields
```

#### 2. Update Permission Classes (Completed in Phase 2)

```python
# All permission classes updated to use current_role
# Example:
class IsStudentUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.current_role == 'student'
```

#### 3. Add Role Endpoints (Completed in Phase 3)

```python
# Backend already has:
# GET /api/v1/auth/available-roles/
# POST /api/v1/auth/select-role/
```

#### 4. Update Frontend State (Completed in Phase 4)

```javascript
// RolesContext and useRoles hook already available
import { useRoles } from '@/utils/useRoles';
const { currentRole, availableRoles } = useRoles();
```

#### 5. Add Role Selection UI (Completed in Phase 5)

```jsx
// RoleSelectionModal already in Login/SSOLogin flows
// Shows for multi-role users
```

#### 6. Protect Routes (Completed in Phase 6)

```jsx
// All routes already wrapped with RoleRoute
<RoleRoute allowedRoles={["student"]}>
  <StudentDashboard />
</RoleRoute>
```

#### 7. Add Header UI (Completed in Phase 7)

```jsx
// RoleIndicator already in all headers
<RoleIndicator compact={true} />
```

### For System Administrators

#### 1. Create Multi-Role Users

```python
# In Django shell
from userauths.models import User

user = User.objects.create_user(
    email='multirole@example.com',
    password='secure_password',
    full_name='John Doe',
    roles=['student', 'teacher']  # Multiple roles
)
user.current_role = 'student'  # Set initial active role
user.save()
```

#### 2. Migrate Existing Users

Single-role users automatically work - they have one role in the `roles` list.

#### 3. Monitor Role Switches

Check `SearchLog` for role-switching analytics:

```python
# View role switches (if logged)
from api.models import SearchLog

role_switches = SearchLog.objects.filter(
    search_query__contains='select-role'
).order_by('-created_at')
```

---

## Backend Testing

Run the comprehensive test suite:

```bash
# All tests
python manage.py test api.tests.test_multi_role_integration

# Specific test class
python manage.py test api.tests.test_multi_role_integration.AuthEndpointsTestCase

# Specific test
python manage.py test api.tests.test_multi_role_integration.AuthEndpointsTestCase.test_select_role_endpoint
```

---

## Frontend Testing

Run Jest tests:

```bash
# All tests
npm test

# Specific test file
npm test RoleIndicator.integration.test.js

# Watch mode
npm test -- --watch
```

---

## Deployment Checklist

- [x] Backend migrations applied
- [x] API endpoints tested
- [x] Permission classes updated
- [x] Frontend components created
- [x] Routes protected
- [x] Headers updated with UI
- [x] Tests created
- [ ] Documentation complete (this document)
- [ ] Release tagged (v2.0)
- [ ] Production deployment

---

## Support & Troubleshooting

### Issue: User can't switch roles

**Symptom:** Role switch returns 400 error  
**Cause:** User doesn't have the requested role  
**Solution:** Check available_roles endpoint first

```bash
# Check what roles user has
curl -X GET 'https://api.example.com/api/v1/auth/available-roles/' \
  -H 'Authorization: Bearer <token>'
```

### Issue: Route still protected after role switch

**Symptom:** User switches role but still can't access new role's pages  
**Cause:** Frontend hasn't reloaded to apply new JWT  
**Solution:** Page reload is automatic after 500ms. If stuck, manually refresh.

### Issue: JWT token doesn't have current_role

**Symptom:** Decoded JWT missing current_role field  
**Cause:** Token generated before Phase 3 deployment  
**Solution:** Logout and login again to get new token

### Issue: Permission denied on previously accessible endpoint

**Symptom:** Endpoint that worked now returns 403  
**Cause:** User's current_role changed, doesn't have permission  
**Solution:** Check current active role and switch if needed

---

## API Rate Limiting

- No special rate limits for multi-role endpoints
- Same as other endpoints (if configured)
- Role switch API: 10 requests per minute per user (recommended)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Previous | Single-role system |
| 2.0 | Jan 25, 2026 | Multi-role system with UI |

---

## Contact & Support

For issues or questions:
- Create GitHub issue with `[multi-role]` tag
- Email: admin@example.com
- Documentation: https://docs.example.com/multi-role

---

**Last Updated:** January 25, 2026  
**Status:** ✅ Production Ready
