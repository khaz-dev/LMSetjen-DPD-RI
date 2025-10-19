"""
Custom Permission Classes for LMSetjen DPD RI API
Ensures proper role-based access control across all endpoints
"""

from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """
    Custom permission to only allow admin users to access the view.
    
    This permission checks:
    1. User is authenticated
    2. User has 'admin' role
    
    Usage:
        permission_classes = [IsAdminUser]
    """
    
    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if user has admin role
        return hasattr(request.user, 'role') and request.user.role == 'admin'
    
    message = 'Admin access required. Only users with admin role can access this endpoint.'


class IsTeacherUser(permissions.BasePermission):
    """
    Custom permission to only allow teacher/instructor users to access the view.
    
    This permission checks:
    1. User is authenticated
    2. User has 'teacher' or 'instructor' role
    
    Usage:
        permission_classes = [IsTeacherUser]
    """
    
    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if user has teacher or instructor role
        return hasattr(request.user, 'role') and request.user.role in ['teacher', 'instructor']
    
    message = 'Teacher access required. Only users with teacher or instructor role can access this endpoint.'


class IsStudentUser(permissions.BasePermission):
    """
    Custom permission to only allow student users to access the view.
    
    This permission checks:
    1. User is authenticated
    2. User has 'student' role
    
    Usage:
        permission_classes = [IsStudentUser]
    """
    
    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if user has student role
        return hasattr(request.user, 'role') and request.user.role == 'student'
    
    message = 'Student access required. Only users with student role can access this endpoint.'


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Custom permission to allow users to edit their own object or admins to edit any object.
    
    This permission checks:
    1. User is authenticated
    2. User is the owner of the object (user == object.user) OR user is admin
    
    Usage:
        permission_classes = [IsOwnerOrAdmin]
    
    Note: Requires the object to have a 'user' attribute
    """
    
    def has_object_permission(self, request, view, obj):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Allow if user is admin
        if hasattr(request.user, 'role') and request.user.role == 'admin':
            return True
        
        # Allow if user is the owner
        return hasattr(obj, 'user') and obj.user == request.user
    
    message = 'You can only access your own objects unless you are an admin.'


class IsSuperAdmin(permissions.BasePermission):
    """
    Custom permission to only allow super admin users to access the view.
    
    This permission checks:
    1. User is authenticated
    2. User has 'admin' role
    3. User has is_super_admin=True in Admin model
    
    Usage:
        permission_classes = [IsSuperAdmin]
    """
    
    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if user has admin role
        if not (hasattr(request.user, 'role') and request.user.role == 'admin'):
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
    2. User has 'teacher', 'instructor', or 'admin' role
    
    Usage:
        permission_classes = [IsTeacherOrAdmin]
    """
    
    def has_permission(self, request, view):
        # Check if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if user has teacher, instructor, or admin role
        return hasattr(request.user, 'role') and request.user.role in ['teacher', 'instructor', 'admin']
    
    message = 'Teacher or admin access required.'
