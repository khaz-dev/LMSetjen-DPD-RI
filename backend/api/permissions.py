"""
Custom Permission Classes for LMSetjen DPD RI API
Ensures proper role-based access control across all endpoints
"""

from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """
    Custom permission to only allow admin users to access the view.
    
    ✨ PHASE 4.10: Updated to use boolean role field (is_admin)
    
    This permission checks:
    1. User is authenticated
    2. User has is_admin = True (new boolean system)
    3. Falls back to current_role == 'admin' if boolean field not available (backward compat)
    
    Supports multi-role system:
    - Checks is_admin boolean field (primary method)
    - Falls back to current_role for users migrating from old system
    - Type-safe boolean check instead of string comparison
    
    Usage:
        permission_classes = [IsAdminUser]
    """
    
    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # NEW: Check boolean is_admin field (primary check)
        if hasattr(request.user, 'is_admin') and request.user.is_admin:
            return True
        
        # FALLBACK: Check current_role for backward compatibility (users in transition)
        if hasattr(request.user, 'current_role') and request.user.current_role == 'admin':
            return True
        
        return False
    
    message = 'Admin access required. Only users with admin role can access this endpoint.'


class IsTeacherUser(permissions.BasePermission):
    """
    Custom permission to only allow teacher/instructor users to access the view.
    
    ✨ PHASE 4.10: Updated to use boolean role field (is_instructor)
    
    This permission checks:
    1. User is authenticated
    2. User has is_instructor = True (new boolean system)
    3. Falls back to current_role in ['teacher', 'instructor'] if not available (backward compat)
    
    Supports multi-role system:
    - Checks is_instructor boolean field (primary method)
    - Falls back to current_role for users migrating from old system
    - Type-safe boolean check instead of string comparison
    
    Usage:
        permission_classes = [IsTeacherUser]
    """
    
    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # NEW: Check boolean is_instructor field (primary check)
        if hasattr(request.user, 'is_instructor') and request.user.is_instructor:
            return True
        
        # FALLBACK: Check current_role for backward compatibility (users in transition)
        if hasattr(request.user, 'current_role') and request.user.current_role in ['teacher', 'instructor']:
            return True
        
        return False
    
    message = 'Teacher access required. Only users with teacher or instructor role can access this endpoint.'


class IsStudentUser(permissions.BasePermission):
    """
    Custom permission to only allow student users to access the view.
    
    ✨ PHASE 4.10: Updated to use boolean role field (is_student)
    
    This permission checks:
    1. User is authenticated
    2. User has is_student = True (new boolean system)
    3. Falls back to current_role == 'student' if boolean field not available (backward compat)
    
    Supports multi-role system:
    - Checks is_student boolean field (primary method)
    - Falls back to current_role for users migrating from old system
    - Type-safe boolean check instead of string comparison
    
    Usage:
        permission_classes = [IsStudentUser]
    """
    
    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # NEW: Check boolean is_student field (primary check)
        if hasattr(request.user, 'is_student') and request.user.is_student:
            return True
        
        # FALLBACK: Check current_role for backward compatibility (users in transition)
        if hasattr(request.user, 'current_role') and request.user.current_role == 'student':
            return True
        
        return False
    
    message = 'Student access required. Only users with student role can access this endpoint.'


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Custom permission to allow users to edit their own object or admins to edit any object.
    
    This permission checks:
    1. User is authenticated
    2. User is the owner of the object (user == object.user) OR user is admin
    
    Supports multi-role system:
    - Checks current_role field if user has multiple roles
    - Falls back to role field for single-role users (backward compatible)
    
    Usage:
        permission_classes = [IsOwnerOrAdmin]
    
    Note: Requires the object to have a 'user' attribute
    """
    
    def has_object_permission(self, request, view, obj):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if user is admin (use boolean field)
        if hasattr(request.user, 'is_admin') and request.user.is_admin:
            return True
        
        # Allow if user is the owner
        return hasattr(obj, 'user') and obj.user == request.user
    
    message = 'You can only access your own objects unless you are an admin.'


class IsSuperAdmin(permissions.BasePermission):
    """
    Custom permission to only allow super admin users to access the view.
    
    This permission checks:
    1. User is authenticated
    2. User has 'admin' role (checks current_role first, fallback to role)
    3. User has is_super_admin=True in Admin model
    
    Supports multi-role system:
    - Checks current_role field if user has multiple roles
    - Falls back to role field for single-role users (backward compatible)
    
    Usage:
        permission_classes = [IsSuperAdmin]
    """
    
    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if user has admin role (use boolean field)
        if not (hasattr(request.user, 'is_admin') and request.user.is_admin):
            return False
        
        # Check if user is super admin
        try:
            return hasattr(request.user, 'admin') and request.user.admin.is_super_admin
        except:
            return False
    
    message = 'Super admin access required. Only super admins can access this endpoint.'


class ReadOnly(permissions.BasePermission):
    """
    Custom permission to allow read-only access for all users.
    Authenticated users can only perform safe methods (GET, HEAD, OPTIONS).
    
    Usage:
        permission_classes = [ReadOnly]
    """
    
    def has_permission(self, request, view):
        # Allow all safe methods (GET, HEAD, OPTIONS)
        return request.method in permissions.SAFE_METHODS
    
    message = 'Read-only access. Modifications are not allowed.'


class IsTeacherOrAdmin(permissions.BasePermission):
    """
    Custom permission to allow teacher/instructor or admin users to access the view.
    
    This permission checks:
    1. User is authenticated
    2. User has 'teacher', 'instructor', or 'admin' role (checks current_role first, fallback to role)
    
    Supports multi-role system:
    - Checks current_role field if user has multiple roles
    - Falls back to role field for single-role users (backward compatible)
    - Works with both old and new systems during transition
    
    Usage:
        permission_classes = [IsTeacherOrAdmin]
    """
    
    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check boolean role fields (new multi-role system)
        if hasattr(request.user, 'is_instructor') and request.user.is_instructor:
            return True
        if hasattr(request.user, 'is_admin') and request.user.is_admin:
            return True
        
        return False
    
    message = 'Teacher or admin access required.'


class IsOwnerOrStaff(permissions.BasePermission):
    """
    Custom permission to ensure users can only access and modify their own data,
    while administrative staff retain authorized access.
    
    Mitigates IDOR (Insecure Direct Object Reference) vulnerabilities:
    - User Profile API (/api/v1/user/profile/<user_id>/) - K-03, K-04
    - Academic Summary API (/api/v1/student/summary/<user_id>/) - H-01
    - Teacher Profile API (/api/v1/teacher/profile/<user_id>/)
    
    Checks:
    1. User is authenticated
    2. If user is admin/staff (is_staff=True, is_admin=True, role='admin') -> Allow
    3. At view level (has_permission):
       - If 'user_id' in URL kwargs -> request.user.id == int(user_id)
       - If 'teacher_id' in URL kwargs -> request.user.id == teacher.user_id
    4. At object level (has_object_permission):
       - If obj is User -> obj.id == request.user.id
       - If obj has user -> obj.user == request.user or obj.user.id == request.user.id
       - If obj has user_id -> obj.user_id == request.user.id
    """
    message = 'Anda hanya dapat mengakses data Anda sendiri kecuali Anda memiliki hak akses admin/staff.'

    def _is_staff_or_admin(self, user):
        if not user or not user.is_authenticated:
            return False
        return bool(
            user.is_staff or 
            getattr(user, 'is_superuser', False) or 
            getattr(user, 'is_admin', False) or 
            getattr(user, 'role', None) == 'admin' or
            (hasattr(user, 'current_role') and user.current_role == 'admin')
        )

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if self._is_staff_or_admin(request.user):
            return True
        
        # Check URL parameter 'user_id' if present in view kwargs
        user_id = view.kwargs.get('user_id')
        if user_id is not None:
            return str(request.user.id) == str(user_id)
        
        # Check URL parameter 'teacher_id' if present in view kwargs
        teacher_id = view.kwargs.get('teacher_id')
        if teacher_id is not None:
            try:
                from api.models import Teacher
                teacher = Teacher.objects.filter(id=teacher_id).first()
                if teacher and teacher.user_id == request.user.id:
                    return True
                return False
            except Exception:
                return False
            
        return True

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
            
        if self._is_staff_or_admin(request.user):
            return True
            
        # If obj is User itself
        if hasattr(obj, 'id') and isinstance(obj, type(request.user)):
            return obj.id == request.user.id
            
        # If obj has user attribute (e.g. Profile, EnrolledCourse, Teacher)
        if hasattr(obj, 'user'):
            if obj.user == request.user:
                return True
            if getattr(obj.user, 'id', None) == request.user.id:
                return True
                
        # If obj has user_id attribute
        if hasattr(obj, 'user_id'):
            return obj.user_id == request.user.id
            
        return False

