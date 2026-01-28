# Multi-Role Implementation - Detailed Step-by-Step Guide

## PHASE 1: BACKEND MODEL CHANGES (CRITICAL)

### Step 1.1: Update User Model
**File**: `backend/userauths/models.py`

Replace the single `role` field with:

```python
# KEEP existing role field for backward compatibility during migration
role = models.CharField(max_length=10, choices=USER_ROLE_CHOICES, default='student', null=True, blank=True, help_text="DEPRECATED: Use roles field instead")

# NEW: Multiple roles support
roles = models.CharField(
    max_length=50, 
    default='student', 
    help_text="Comma-separated roles: student,teacher,admin"
)

# NEW: Current active role
current_role = models.CharField(
    max_length=10, 
    choices=USER_ROLE_CHOICES, 
    default='student',
    help_text="Currently active role for this session"
)
```

### Step 1.2: Update User Model Methods

Replace existing methods:

```python
# OLD METHOD - DEPRECATED
def is_admin(self):
    return self.role == 'admin'

# NEW METHOD - Check current active role
def is_admin_current(self):
    return self.current_role == 'admin'

# NEW METHOD - Check if user has admin role (in any role)
def has_admin_role(self):
    return 'admin' in self.roles.split(',')

# Similar for other roles
def is_teacher_current(self):
    return self.current_role == 'teacher'

def has_teacher_role(self):
    return 'teacher' in self.roles.split(',')

def is_student_current(self):
    return self.current_role == 'student'

def has_student_role(self):
    return 'student' in self.roles.split(',')

# NEW: Get list of available roles
def get_available_roles(self):
    return [r.strip() for r in self.roles.split(',') if r.strip()]

# NEW: Check if role is available
def has_role(self, role):
    return role in self.get_available_roles()

# NEW: Set current role (with validation)
def set_current_role(self, role):
    if role not in self.get_available_roles():
        raise ValueError(f"User does not have {role} role")
    self.current_role = role
    self.save()
```

---

## PHASE 2: UPDATE PERMISSION CLASSES

### Step 2.1: Update permissions.py

Replace role checks to use `current_role`:

```python
# OLD
class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return hasattr(request.user, 'role') and request.user.role == 'admin'

# NEW - Check current role
class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Check current_role first (new system)
        if hasattr(request.user, 'current_role') and request.user.current_role == 'admin':
            return True
        # Fallback to role (old system during migration)
        if hasattr(request.user, 'role') and request.user.role == 'admin':
            return True
        return False

# NEW: Flexible role permission - user must have at least one of the roles
class HasAnyRole(permissions.BasePermission):
    required_roles = []  # Override in subclass
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.has_role(self.required_roles[0]) if self.required_roles else False

# Apply same pattern to IsTeacherUser and IsStudentUser
```

---

## PHASE 3: UPDATE AUTHENTICATION ENDPOINTS

### Step 3.1: Create New Endpoints in urls.py

```python
# Add to backend/api/urls.py
path('auth/select-role/', views.SelectRoleAPIView.as_view(), name='select-role'),
path('user/available-roles/', views.AvailableRolesAPIView.as_view(), name='available-roles'),
```

### Step 3.2: Create New Views in views.py

Add to `backend/api/views.py`:

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

class SelectRoleAPIView(APIView):
    """
    Endpoint to select/switch user's current role
    POST /api/v1/auth/select-role/
    {
        "role": "teacher"
    }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        role = request.data.get('role')
        
        if not role:
            return Response(
                {"error": "Role is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        available_roles = user.get_available_roles()
        
        if role not in available_roles:
            return Response(
                {
                    "error": f"You don't have {role} role. Available roles: {', '.join(available_roles)}",
                    "available_roles": available_roles
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update current role
        user.set_current_role(role)
        
        # Generate new JWT token with updated role
        refresh = RefreshToken.for_user(user)
        refresh.access_token['current_role'] = role
        
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "current_role": role,
            "message": f"Switched to {role} role"
        })

class AvailableRolesAPIView(APIView):
    """
    Endpoint to get user's available roles
    GET /api/v1/auth/available-roles/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        return Response({
            "available_roles": user.get_available_roles(),
            "current_role": user.current_role
        })
```

### Step 3.3: Update Login Response

Modify the login endpoint to return roles:

```python
# In your login serializer or view
def update_response_with_roles(user, refresh_token_obj):
    return {
        "access": str(refresh_token_obj.access_token),
        "refresh": str(refresh_token_obj),
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "available_roles": user.get_available_roles(),  # NEW
            "current_role": user.current_role,  # NEW
        }
    }
```

---

## PHASE 4: JWT TOKEN UPDATES

### Step 4.1: Update Token Serializer

In `backend/api/serializer.py`:

```python
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # OLD: Add role
        token['role'] = user.role
        
        # NEW: Add multiple roles
        token['available_roles'] = user.get_available_roles()
        token['current_role'] = user.current_role
        
        return token
    
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Add roles to response
        data['available_roles'] = self.user.get_available_roles()
        data['current_role'] = self.user.current_role
        
        return data
```

---

## PHASE 5: FRONTEND - STATE MANAGEMENT

### Step 5.1: Update UserData.js Context

In `frontend/src/views/plugin/UserData.js`:

```javascript
// ADD to store state:
available_roles: [],  // NEW: List of roles user has
current_role: 'student',  // NEW: Currently active role

// UPDATE: Extract from localStorage
const allUserData = {
    // ... existing fields
    available_roles: JSON.parse(localStorage.getItem("available_roles") || "['student']"),
    current_role: localStorage.getItem("current_role") || "student"
};

// ADD: Method to update roles
setUserRoles: (roles) => set({
    available_roles: roles,
    current_role: roles[0] || 'student'
}),

// ADD: Method to set current role
setCurrentRole: (role) => set({ current_role: role }),
```

### Step 5.2: Update useAxios Interceptor

Add current_role to all API requests:

```javascript
// In frontend/src/utils/useAxios.js or apiInstance.js
axiosInstance.interceptors.request.use(
    config => {
        const token = localStorage.getItem('auth_token');
        const currentRole = localStorage.getItem('current_role');
        
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        // NEW: Add current role to headers
        if (currentRole) {
            config.headers['X-Current-Role'] = currentRole;
        }
        
        return config;
    }
);
```

---

## PHASE 6: FRONTEND - LOGIN FLOW

### Step 6.1: Create RoleSelectionModal Component

**File**: `frontend/src/components/RoleSelectionModal.jsx`

```javascript
import React, { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';

function RoleSelectionModal({ show, availableRoles, onSelectRole }) {
  const [selectedRole, setSelectedRole] = useState(availableRoles[0] || 'student');

  const handleConfirm = () => {
    onSelectRole(selectedRole);
  };

  return (
    <Modal show={show} backdrop="static" keyboard={false} centered>
      <Modal.Header>
        <Modal.Title>Select Your Role</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-3">You have access to multiple roles. Please select which role you'd like to use:</p>
        <div className="d-flex flex-column gap-2">
          {availableRoles.map(role => (
            <div key={role} className="form-check">
              <input
                className="form-check-input"
                type="radio"
                id={`role_${role}`}
                value={role}
                checked={selectedRole === role}
                onChange={(e) => setSelectedRole(e.target.value)}
              />
              <label className="form-check-label" htmlFor={`role_${role}`}>
                <strong>{role.charAt(0).toUpperCase() + role.slice(1)}</strong>
                {role === 'admin' && ' - System Administration'}
                {role === 'teacher' && ' - Course Creation & Management'}
                {role === 'student' && ' - Course Learning'}
              </label>
            </div>
          ))}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={handleConfirm}>
          Continue as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default RoleSelectionModal;
```

### Step 6.2: Update Login.jsx

Add role selection logic after successful login:

```javascript
// In Login.jsx - after successful login response
const handleLoginSuccess = (response) => {
    // ... existing login code
    
    // NEW: Check if user has multiple roles
    const availableRoles = response.data?.available_roles || [response.data?.role];
    
    if (availableRoles.length > 1) {
        // Show role selection modal
        setAvailableRoles(availableRoles);
        setShowRoleSelection(true);
    } else {
        // Single role - proceed directly
        proceedAfterRoleSelection(availableRoles[0]);
    }
};

const proceedAfterRoleSelection = (selectedRole) => {
    localStorage.setItem('current_role', selectedRole);
    localStorage.setItem('available_roles', JSON.stringify(availableRoles));
    
    // Redirect based on role
    navigate(getRoleRedirectPath(selectedRole));
};
```

---

## PHASE 7: FRONTEND - PROFILE PAGE

### Step 7.1: Add Role Selector on Profile Page

In `frontend/src/views/student/Profile.jsx` (or equivalent):

```javascript
const handleRoleChange = async (newRole) => {
    try {
        const response = await useAxios.post('auth/select-role/', {
            role: newRole
        });
        
        localStorage.setItem('auth_token', response.data.access);
        localStorage.setItem('current_role', newRole);
        
        // Update context
        UserData.setCurrentRole(newRole);
        
        Toast.fire({
            title: 'Success',
            text: `Switched to ${newRole} role`,
            icon: 'success'
        });
        
        // Redirect to appropriate dashboard
        navigate(getRoleRedirectPath(newRole));
    } catch (error) {
        Toast.fire({
            title: 'Error',
            text: error.response?.data?.error || 'Failed to switch role',
            icon: 'error'
        });
    }
};

// In JSX:
<div className="mb-3">
    <label>Current Role</label>
    <select 
        className="form-control"
        value={userData.current_role}
        onChange={(e) => handleRoleChange(e.target.value)}
    >
        {userData.available_roles.map(role => (
            <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
            </option>
        ))}
    </select>
</div>
```

---

## PHASE 8: DATABASE MIGRATION

### Step 8.1: Create Migration

```bash
python manage.py makemigrations userauths
```

### Step 8.2: Data Migration Script

Create `backend/userauths/migrations/0XXX_migrate_to_multirole.py`:

```python
from django.db import migrations

def migrate_to_multirole(apps, schema_editor):
    User = apps.get_model('userauths', 'User')
    
    # Migrate existing single roles to multiple roles
    for user in User.objects.all():
        if user.role:
            user.roles = user.role  # Set roles to current role
            user.current_role = user.role
            user.save()

def reverse_migration(apps, schema_editor):
    # Revert back if needed
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('userauths', 'XXXX_previous_migration'),
    ]

    operations = [
        migrations.RunPython(migrate_to_multirole, reverse_migration),
    ]
```

---

## PHASE 9: TESTING CHECKLIST

- [ ] Create test user with roles: 'student,teacher'
- [ ] Login and verify role selection modal appears
- [ ] Select 'teacher' role and verify current_role changes
- [ ] Check JWT token includes current_role
- [ ] Test teacher endpoint access after role selection
- [ ] Test student endpoint access after switching back to student
- [ ] Verify role persists after page reload
- [ ] Test role switching from profile page
- [ ] Verify permission classes check current_role correctly
- [ ] Test backward compatibility with existing single-role users

---

## IMPORTANT NOTES

1. **Backward Compatibility**: Keep `role` field during migration, remove after 1-2 releases
2. **Token Refresh**: Ensure current_role persists on token refresh
3. **Database**: Will need migration and data cleanup
4. **Testing**: Thoroughly test all role combinations
5. **Rollout**: Consider phased rollout to catch issues early

---

**This guide provides the complete architecture. Implement in phases: Backend Model → Permissions → Endpoints → Frontend State → UI Components → Testing**
