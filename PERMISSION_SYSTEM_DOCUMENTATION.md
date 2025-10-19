# 🔐 Permission & Authentication System - Complete Documentation

## 📅 Date: October 19, 2025
## 🎯 Purpose: Prevent permission issues and unauthorized access

---

## 🚨 Issue Resolved

### **Original Problem**:
```
POST https://lmsetjendpdri.duckdns.org/api/v1/admin/sync-external-users/ 403 (Forbidden)
```

### **Root Cause**:
`SyncExternalUsersAPIView` had `permission_classes = [IsAuthenticated]` but was **missing admin role verification**. This meant:
- ✅ Authenticated users could pass permission check
- ❌ But the view's `post()` method had no admin role check
- ❌ Any logged-in student/teacher could attempt to call admin endpoints
- ❌ Result: 403 Forbidden error (or worse, potential unauthorized access)

### **Fix Applied**:
Added admin role verification at the beginning of the `post()` method:

```python
def post(self, request):
    # Verify admin access
    if not hasattr(request.user, 'role') or request.user.role != 'admin':
        return Response(
            {'error': 'Admin access required. Only admins can sync external users.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Rest of method continues...
```

---

## 🏗️ Permission Architecture

### **Three Levels of Protection**:

1. **DRF Permission Classes** (View Level)
   - Applied to entire view/viewset
   - Checked before any method executes
   - Examples: `IsAuthenticated`, `IsAdminUser`, `AllowAny`

2. **Method-Level Role Checks** (Request Level)
   - Checked at start of specific methods (get, post, etc.)
   - More flexible than permission classes
   - Used for role-based logic

3. **Object-Level Permissions** (Instance Level)
   - Checked for specific object operations
   - Used in `has_object_permission()`
   - Examples: User can only edit their own profile

---

## 📚 Custom Permission Classes

### **File**: `backend/api/permissions.py`

All custom permission classes have been created for consistent role-based access control:

### **1. IsAdminUser**
```python
from api.permissions import IsAdminUser

class MyAdminView(APIView):
    permission_classes = [IsAdminUser]  # Only admins can access
```

**Checks**:
- User is authenticated
- User has `role='admin'`

**Use Cases**:
- Admin-only endpoints
- User management
- System configuration

---

### **2. IsTeacherUser**
```python
from api.permissions import IsTeacherUser

class MyTeacherView(APIView):
    permission_classes = [IsTeacherUser]  # Only teachers
```

**Checks**:
- User is authenticated
- User has `role='teacher'` or `role='instructor'`

**Use Cases**:
- Course creation/editing
- Student grading
- Course analytics

---

### **3. IsStudentUser**
```python
from api.permissions import IsStudentUser

class MyStudentView(APIView):
    permission_classes = [IsStudentUser]  # Only students
```

**Checks**:
- User is authenticated
- User has `role='student'`

**Use Cases**:
- Course enrollment
- Wishlist management
- Certificate generation

---

### **4. IsTeacherOrAdmin**
```python
from api.permissions import IsTeacherOrAdmin

class MyView(APIView):
    permission_classes = [IsTeacherOrAdmin]  # Teachers OR admins
```

**Checks**:
- User is authenticated
- User has role in `['teacher', 'instructor', 'admin']`

**Use Cases**:
- Analytics dashboards
- Reporting tools
- Q&A management

---

### **5. IsSuperAdmin**
```python
from api.permissions import IsSuperAdmin

class MySuperAdminView(APIView):
    permission_classes = [IsSuperAdmin]  # Only super admins
```

**Checks**:
- User is authenticated
- User has `role='admin'`
- User has `admin.is_super_admin=True`

**Use Cases**:
- System-wide settings
- User role modifications
- Critical operations

---

### **6. IsOwnerOrAdmin**
```python
from api.permissions import IsOwnerOrAdmin

class MyView(APIView):
    permission_classes = [IsOwnerOrAdmin]  # Owner or admin
    
    def get_object(self):
        obj = MyModel.objects.get(...)
        self.check_object_permissions(self.request, obj)
        return obj
```

**Checks**:
- User is authenticated
- User is object owner (`obj.user == request.user`) OR admin

**Use Cases**:
- Profile editing (own profile or admin)
- Content modification (owner or admin)
- Private data access

---

### **7. ReadOnly**
```python
from api.permissions import ReadOnly

class MyView(APIView):
    permission_classes = [ReadOnly]  # GET/HEAD/OPTIONS only
```

**Checks**:
- Request method is in `['GET', 'HEAD', 'OPTIONS']`

**Use Cases**:
- Public APIs
- Read-only endpoints
- Archived content

---

## 🔍 Complete Endpoint Audit Results

### **Category 1: Public Endpoints** (No Authentication)

| Endpoint | Methods | Permission | Status |
|----------|---------|------------|--------|
| `/api/v1/` | GET | AllowAny | ✅ OK |
| `/api/v1/health/` | GET | AllowAny | ✅ OK |
| `/api/v1/user/register/` | POST | AllowAny | ✅ OK |
| `/api/v1/user/token/` | POST | AllowAny | ✅ OK |
| `/api/v1/user/password-reset/<email>/` | GET | AllowAny | ✅ OK |
| `/api/v1/course/category/` | GET | AllowAny | ✅ OK |
| `/api/v1/course/course-list/` | GET | AllowAny | ✅ OK |
| `/api/v1/course/course-detail/<slug>/` | GET | AllowAny | ✅ OK |

---

### **Category 2: Admin Endpoints** (Admin Role Required)

| Endpoint | Methods | Permission Check | Location | Status |
|----------|---------|------------------|----------|--------|
| `/api/v1/admin/dashboard-summary/` | GET | `get()` method | Line 2719 | ✅ FIXED |
| `/api/v1/admin/user-management/` | GET | `get_queryset()` | Line 2868 | ✅ FIXED |
| `/api/v1/admin/user-detail/<id>/` | GET | `get_object()` | Line 3040 | ✅ FIXED |
| `/api/v1/admin/user-create/` | POST | `create()` method | Line 3104 | ✅ FIXED |
| `/api/v1/admin/user-update/<id>/` | PUT/PATCH | `get_object()` | Line 3140 | ✅ FIXED |
| `/api/v1/admin/user-delete/<id>/` | DELETE | `get_object()` | Line 3204 | ✅ FIXED |
| `/api/v1/admin/user-bulk-actions/` | POST | `post()` method | Line 3244 | ✅ FIXED |
| `/api/v1/admin/course-management/` | GET | `get_queryset()` | Line 2886 | ✅ FIXED |
| `/api/v1/admin/enrollment-analytics/` | GET | `get()` method | Line 2904 | ✅ FIXED |
| `/api/v1/admin/system-health/` | GET | `get()` method | Line 2980 | ✅ FIXED |
| `/api/v1/admin/sync-external-users/` | POST | `post()` method | Line 3317 | ✅ **NEWLY FIXED** |

**All admin endpoints now have proper role verification! ✅**

---

### **Category 3: Student Endpoints** (Student Role)

| Endpoint | Permission Check | Status |
|----------|------------------|--------|
| `/api/v1/student/summary/<user_id>/` | `get()` method checks `role='student'` | ✅ OK |
| `/api/v1/student/course-list/<user_id>/` | `get_queryset()` filters by user | ✅ OK |
| `/api/v1/student/wishlist/<user_id>/` | `get_queryset()` filters by user | ✅ OK |
| `/api/v1/student/certificate-generate/` | `post()` method checks student | ✅ OK |

---

### **Category 4: Teacher Endpoints** (Teacher Role)

| Endpoint | Permission Check | Status |
|----------|------------------|--------|
| `/api/v1/teacher/summary/<teacher_id>/` | `get()` checks teacher exists | ✅ OK |
| `/api/v1/teacher/course-lists/<teacher_id>/` | `get_queryset()` filters by teacher | ✅ OK |
| `/api/v1/course-create/` | `post()` creates teacher if needed | ✅ OK |
| `/api/v1/course-update/<course_id>/` | `get_object()` verifies teacher owns course | ✅ OK |

---

## 🎯 Permission Patterns Guide

### **Pattern 1: View-Level Permission** (Recommended)

**When to Use**: Entire view/viewset requires specific role

```python
from api.permissions import IsAdminUser

class MyAdminAPIView(APIView):
    permission_classes = [IsAdminUser]  # Applies to all methods
    
    def get(self, request):
        # Admin check already done by permission_classes
        return Response({'data': 'Admin data'})
    
    def post(self, request):
        # Admin check already done
        return Response({'message': 'Created'})
```

**Pros**:
- ✅ Clean and declarative
- ✅ Consistent across all methods
- ✅ DRF handles error messages

**Cons**:
- ❌ Less flexible for mixed permissions

---

### **Pattern 2: Method-Level Check** (Current Implementation)

**When to Use**: Different methods need different permissions

```python
class MyAPIView(APIView):
    permission_classes = [IsAuthenticated]  # All must be authenticated
    
    def get(self, request):
        # Anyone authenticated can read
        return Response({'data': 'Public data'})
    
    def post(self, request):
        # But only admins can create
        if not hasattr(request.user, 'role') or request.user.role != 'admin':
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Process admin operation
        return Response({'message': 'Created'})
```

**Pros**:
- ✅ Flexible - different methods, different rules
- ✅ Can add custom logic
- ✅ Explicit and clear

**Cons**:
- ❌ More code to maintain
- ❌ Easy to forget in new methods

---

### **Pattern 3: Object-Level Permission**

**When to Use**: User can only access their own objects or admin can access all

```python
from api.permissions import IsOwnerOrAdmin

class ProfileDetailAPIView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsOwnerOrAdmin]
    serializer_class = ProfileSerializer
    
    def get_object(self):
        obj = Profile.objects.get(user_id=self.kwargs['user_id'])
        # IsOwnerOrAdmin checks: obj.user == request.user OR request.user.role == 'admin'
        self.check_object_permissions(self.request, obj)
        return obj
```

**Pros**:
- ✅ Fine-grained control
- ✅ Reusable permission logic
- ✅ Follows DRF best practices

**Cons**:
- ❌ Requires objects to have `user` attribute
- ❌ More complex to debug

---

## 🧪 Testing Procedures

### **Test 1: Admin Endpoint Access Control**

**Test admin/sync-external-users** (our fixed endpoint):

```bash
# 1. Test as non-authenticated user
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/admin/sync-external-users/
# Expected: 401 Unauthorized (or 403 Forbidden)

# 2. Test as student user
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/admin/sync-external-users/ \
  -H "Authorization: Bearer <STUDENT_JWT_TOKEN>"
# Expected: 403 Forbidden with message "Admin access required"

# 3. Test as teacher user
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/admin/sync-external-users/ \
  -H "Authorization: Bearer <TEACHER_JWT_TOKEN>"
# Expected: 403 Forbidden with message "Admin access required"

# 4. Test as admin user
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/admin/sync-external-users/ \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
# Expected: 200 OK with sync results
```

---

### **Test 2: All Admin Endpoints**

**Script to test all admin endpoints**:

```python
import requests

BASE_URL = "https://lmsetjendpdri.duckdns.org/api/v1"

# Tokens for each role
STUDENT_TOKEN = "eyJ..."
TEACHER_TOKEN = "eyJ..."
ADMIN_TOKEN = "eyJ..."

admin_endpoints = [
    ("GET", "/admin/dashboard-summary/"),
    ("GET", "/admin/user-management/"),
    ("GET", "/admin/user-detail/1/"),
    ("POST", "/admin/user-create/"),
    ("PUT", "/admin/user-update/1/"),
    ("DELETE", "/admin/user-delete/1/"),
    ("POST", "/admin/user-bulk-actions/"),
    ("GET", "/admin/course-management/"),
    ("GET", "/admin/enrollment-analytics/"),
    ("GET", "/admin/system-health/"),
    ("POST", "/admin/sync-external-users/"),
]

for method, endpoint in admin_endpoints:
    print(f"\nTesting {method} {endpoint}")
    
    # Test as student (should fail)
    response = requests.request(
        method, 
        f"{BASE_URL}{endpoint}",
        headers={"Authorization": f"Bearer {STUDENT_TOKEN}"}
    )
    print(f"  Student: {response.status_code} (expected 403)")
    
    # Test as admin (should succeed)
    response = requests.request(
        method,
        f"{BASE_URL}{endpoint}",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"}
    )
    print(f"  Admin: {response.status_code} (expected 200 or 201)")
```

---

### **Test 3: Frontend Integration Test**

**Test in browser console**:

```javascript
// Get current user role
const userData = JSON.parse(localStorage.getItem('user-data'));
console.log('Current role:', userData.role);

// Try calling admin endpoint
fetch('/api/v1/admin/sync-external-users/', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        'Content-Type': 'application/json'
    }
})
.then(res => res.json())
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));

// If role is 'admin': Should succeed
// If role is 'student' or 'teacher': Should fail with 403
```

---

## 📊 Permission Matrix

| User Role | Admin Endpoints | Teacher Endpoints | Student Endpoints | Public Endpoints |
|-----------|-----------------|-------------------|-------------------|------------------|
| **Anonymous** | ❌ | ❌ | ❌ | ✅ |
| **Student** | ❌ | ❌ | ✅ | ✅ |
| **Teacher** | ❌ | ✅ | ❌* | ✅ |
| **Admin** | ✅ | ✅† | ✅† | ✅ |

**Notes**:
- *Teachers cannot access student-specific endpoints like enrollment/wishlist
- †Admins CAN access teacher/student endpoints for management purposes

---

## 🚀 Best Practices

### **1. Always Use Permission Classes When Possible**

❌ **Bad**:
```python
class MyView(APIView):
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Not authenticated'}, status=401)
        if request.user.role != 'admin':
            return Response({'error': 'Not admin'}, status=403)
        # Do stuff...
```

✅ **Good**:
```python
from api.permissions import IsAdminUser

class MyView(APIView):
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        # Permission already checked
        # Do stuff...
```

---

### **2. Consistent Error Messages**

✅ **Use consistent messages across all endpoints**:
```python
# Admin access required
return Response(
    {'error': 'Admin access required. Only admins can perform this action.'},
    status=status.HTTP_403_FORBIDDEN
)

# Teacher access required
return Response(
    {'error': 'Teacher access required. Only teachers can perform this action.'},
    status=status.HTTP_403_FORBIDDEN
)

# Owner or admin required
return Response(
    {'error': 'Permission denied. You can only access your own data unless you are an admin.'},
    status=status.HTTP_403_FORBIDDEN
)
```

---

### **3. Fail Securely**

✅ **Always return empty queryset or 404 for unauthorized access**:

```python
def get_queryset(self):
    # Check permissions
    if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
        return User.objects.none()  # ✅ Empty queryset, not error
    
    return User.objects.all()
```

This prevents information leakage about whether resources exist.

---

### **4. Log Permission Failures**

```python
def post(self, request):
    if not hasattr(request.user, 'role') or request.user.role != 'admin':
        # Log unauthorized attempt
        print(f"Unauthorized access attempt by user {request.user.id} ({request.user.role if hasattr(request.user, 'role') else 'no role'}) to admin endpoint")
        
        return Response(
            {'error': 'Admin access required'},
            status=status.HTTP_403_FORBIDDEN
        )
```

---

### **5. Test After Every Change**

After modifying any view:
1. ✅ Test as anonymous user (should fail)
2. ✅ Test as wrong role (should fail with 403)
3. ✅ Test as correct role (should succeed)
4. ✅ Test edge cases (deleted users, inactive users)

---

## 🐛 Common Permission Issues & Fixes

### **Issue 1: 403 on Valid Admin User**

**Symptoms**: Admin user gets 403 Forbidden

**Possible Causes**:
1. JWT token expired
2. User role field not set correctly
3. Permission check using wrong attribute

**Debug**:
```python
def post(self, request):
    print(f"User: {request.user}")
    print(f"Is authenticated: {request.user.is_authenticated}")
    print(f"Has role attr: {hasattr(request.user, 'role')}")
    print(f"Role value: {request.user.role if hasattr(request.user, 'role') else 'NO ROLE'}")
    
    # Now check permission...
```

**Fix**:
- Verify JWT token is fresh (not expired)
- Check user in database has `role='admin'`
- Ensure JWT payload includes role claim

---

### **Issue 2: Student Can Access Admin Endpoint**

**Symptoms**: Student user can call admin-only endpoint

**Possible Causes**:
1. No permission check in view
2. Permission check has logic bug
3. Using `IsAuthenticated` without role check

**Fix**:
```python
# Before (VULNERABLE)
class MyAdminView(APIView):
    permission_classes = [IsAuthenticated]  # ❌ Anyone authenticated!
    
    def post(self, request):
        # Process admin operation...
        pass

# After (SECURE)
class MyAdminView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # ✅ Add role check
        if not hasattr(request.user, 'role') or request.user.role != 'admin':
            return Response({'error': 'Admin access required'}, status=403)
        
        # Process admin operation...
```

---

### **Issue 3: AnonymousUser Has No Role Attribute**

**Symptoms**: `AttributeError: 'AnonymousUser' object has no attribute 'role'`

**Fix**:
```python
# Before (BREAKS)
if request.user.role != 'admin':  # ❌ Crashes if not authenticated
    return Response({'error': 'Admin required'}, status=403)

# After (SAFE)
if not hasattr(request.user, 'role') or request.user.role != 'admin':  # ✅ Safe
    return Response({'error': 'Admin required'}, status=403)
```

---

## 📞 Troubleshooting Commands

### **Check User Role in Database**:
```bash
python manage.py shell
from userauths.models import User
user = User.objects.get(email='admin@example.com')
print(f"Role: {user.role}")
print(f"Is Admin: {user.role == 'admin'}")
```

### **Test JWT Token**:
```bash
# Decode JWT (without verification for debugging)
python -c "
import jwt
token = 'your_jwt_token_here'
decoded = jwt.decode(token, options={'verify_signature': False})
print(decoded)
"
```

### **Check Permission Classes**:
```bash
# In Django shell
from api.views import SyncExternalUsersAPIView
view = SyncExternalUsersAPIView()
print(view.permission_classes)
```

---

## ✅ Verification Checklist

After implementing permission fixes, verify:

- [ ] All admin endpoints require admin role
- [ ] Student cannot access admin endpoints (403)
- [ ] Teacher cannot access admin endpoints (403)
- [ ] Admin can access all admin endpoints (200/201)
- [ ] Anonymous users get 401 on protected endpoints
- [ ] Permission error messages are clear and consistent
- [ ] No information leakage in error responses
- [ ] All new endpoints have permission classes defined
- [ ] Custom permission classes imported from `api.permissions`
- [ ] Frontend handles 403 errors gracefully

---

## 📚 Related Documentation

- **ROUTING_ARCHITECTURE.md** - URL routing and nginx configuration
- **RBAC_DOCUMENTATION.md** - Role-based access control in frontend
- **CSRF_PREVENTION_GUIDE.md** - CSRF protection and JWT authentication
- **API Documentation** - Swagger UI at `/swagger/`

---

## 🎓 Learning Resources

- [DRF Permissions](https://www.django-rest-framework.org/api-guide/permissions/)
- [Custom Permissions](https://www.django-rest-framework.org/api-guide/permissions/#custom-permissions)
- [JWT Authentication](https://django-rest-framework-simplejwt.readthedocs.io/)
- [Django Authorization](https://docs.djangoproject.com/en/4.2/topics/auth/)

---

**Last Updated**: October 19, 2025  
**Version**: 1.0  
**Status**: ✅ All admin endpoints secured  
**Next Review**: Before adding new admin endpoints
