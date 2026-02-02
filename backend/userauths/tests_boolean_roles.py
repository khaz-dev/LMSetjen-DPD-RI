"""
✨ PHASE 4.10: Boolean Role System - Test Suite
Tests for the new boolean-based multi-role system
"""

from django.test import TestCase, Client
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from userauths.models import User
from rest_framework_simplejwt.tokens import RefreshToken


class BooleanRoleSystemTests(APITestCase):
    """Test boolean role system functionality"""
    
    def setUp(self):
        """Set up test users with boolean roles"""
        self.client = APIClient()
        
        # Create a multi-role user
        self.multi_role_user = User.objects.create_user(
            email='multirole@example.com',
            username='multirole',
            password='testpass123',
            full_name='Multi Role User'
        )
        # Grant all roles
        self.multi_role_user.is_student = True
        self.multi_role_user.is_instructor = True
        self.multi_role_user.is_admin = True
        self.multi_role_user.current_role = 'student'
        self.multi_role_user.roles = 'student,instructor,admin'
        self.multi_role_user.role = 'student'
        self.multi_role_user.save()
        
        # Create a student-only user
        self.student_user = User.objects.create_user(
            email='student@example.com',
            username='student',
            password='testpass123',
            full_name='Student User'
        )
        self.student_user.is_student = True
        self.student_user.is_instructor = False
        self.student_user.is_admin = False
        self.student_user.current_role = 'student'
        self.student_user.roles = 'student'
        self.student_user.role = 'student'
        self.student_user.save()
        
        # Create an instructor user
        self.instructor_user = User.objects.create_user(
            email='instructor@example.com',
            username='instructor',
            password='testpass123',
            full_name='Instructor User'
        )
        self.instructor_user.is_student = False
        self.instructor_user.is_instructor = True
        self.instructor_user.is_admin = False
        self.instructor_user.current_role = 'instructor'
        self.instructor_user.roles = 'instructor'
        self.instructor_user.role = 'instructor'
        self.instructor_user.save()
    
    def test_boolean_role_fields_exist(self):
        """Test that boolean role fields exist and are accessible"""
        user = User.objects.get(email='multirole@example.com')
        
        # Should have all roles as booleans
        self.assertTrue(isinstance(user.is_student, bool))
        self.assertTrue(isinstance(user.is_instructor, bool))
        self.assertTrue(isinstance(user.is_admin, bool))
        
        self.assertTrue(user.is_student)
        self.assertTrue(user.is_instructor)
        self.assertTrue(user.is_admin)
    
    def test_get_available_boolean_roles(self):
        """Test get_available_boolean_roles() method"""
        multi_user = self.multi_role_user
        student_user = self.student_user
        instructor_user = self.instructor_user
        
        # Multi-role user should have all roles
        roles = multi_user.get_available_boolean_roles()
        self.assertEqual(set(roles), {'student', 'instructor', 'admin'})
        
        # Student user should only have student role
        roles = student_user.get_available_boolean_roles()
        self.assertEqual(roles, ['student'])
        
        # Instructor user should only have instructor role
        roles = instructor_user.get_available_boolean_roles()
        self.assertEqual(roles, ['instructor'])
    
    def test_has_boolean_role(self):
        """Test has_boolean_role() method"""
        user = self.multi_role_user
        
        # Should have all roles
        self.assertTrue(user.has_boolean_role('student'))
        self.assertTrue(user.has_boolean_role('instructor'))
        self.assertTrue(user.has_boolean_role('teacher'))  # teacher = instructor
        self.assertTrue(user.has_boolean_role('admin'))
        
        # Student user shouldn't have instructor role
        student = self.student_user
        self.assertTrue(student.has_boolean_role('student'))
        self.assertFalse(student.has_boolean_role('instructor'))
        self.assertFalse(student.has_boolean_role('admin'))
    
    def test_grant_role(self):
        """Test grant_role() method"""
        user = self.student_user
        
        # Initially only a student
        self.assertTrue(user.is_student)
        self.assertFalse(user.is_instructor)
        
        # Grant instructor role
        user.grant_role('instructor')
        user.refresh_from_db()
        
        # Now should have both roles
        self.assertTrue(user.is_student)
        self.assertTrue(user.is_instructor)
        self.assertIn('instructor', user.roles)
    
    def test_revoke_role(self):
        """Test revoke_role() method"""
        user = self.multi_role_user
        user.refresh_from_db()
        
        # Initially has all roles
        self.assertTrue(user.is_admin)
        
        # Revoke admin role
        user.revoke_role('admin')
        user.refresh_from_db()
        
        # Admin should be gone, but others should remain
        self.assertFalse(user.is_admin)
        self.assertTrue(user.is_student)
        self.assertTrue(user.is_instructor)
    
    def test_jwt_token_includes_boolean_roles(self):
        """Test that JWT tokens include boolean role fields"""
        user = self.multi_role_user
        
        # Generate token
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token
        
        # Decode and check fields
        token_data = dict(access_token)
        
        self.assertTrue(token_data['is_student'])
        self.assertTrue(token_data['is_instructor'])
        self.assertTrue(token_data['is_admin'])
        self.assertIn('available_roles', token_data)
        self.assertTrue(token_data['has_multiple_roles'])
        self.assertEqual(
            set(token_data['available_roles']),
            {'student', 'instructor', 'admin'}
        )
    
    def test_jwt_token_single_role(self):
        """Test JWT token for single-role user"""
        user = self.student_user
        
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token
        token_data = dict(access_token)
        
        # Should only have student role
        self.assertTrue(token_data['is_student'])
        self.assertFalse(token_data['is_instructor'])
        self.assertFalse(token_data['is_admin'])
        self.assertFalse(token_data['has_multiple_roles'])
        self.assertEqual(token_data['available_roles'], ['student'])
    
    def test_permission_check_is_admin_user(self):
        """Test IsAdminUser permission with boolean roles"""
        from api.permissions import IsAdminUser
        from rest_framework.test import APIRequestFactory
        
        factory = APIRequestFactory()
        
        # Admin user should pass
        request = factory.get('/')
        request.user = self.multi_role_user
        self.multi_role_user.current_role = 'admin'
        
        permission = IsAdminUser()
        self.assertTrue(permission.has_permission(request, None))
        
        # Student user should fail
        request.user = self.student_user
        self.assertFalse(permission.has_permission(request, None))
    
    def test_permission_check_is_instructor_user(self):
        """Test IsTeacherUser permission with boolean roles"""
        from api.permissions import IsTeacherUser
        from rest_framework.test import APIRequestFactory
        
        factory = APIRequestFactory()
        
        # Instructor user should pass
        request = factory.get('/')
        request.user = self.instructor_user
        
        permission = IsTeacherUser()
        self.assertTrue(permission.has_permission(request, None))
        
        # Student user should fail
        request.user = self.student_user
        self.assertFalse(permission.has_permission(request, None))
    
    def test_permission_check_is_student_user(self):
        """Test IsStudentUser permission with boolean roles"""
        from api.permissions import IsStudentUser
        from rest_framework.test import APIRequestFactory
        
        factory = APIRequestFactory()
        
        # Student user should pass
        request = factory.get('/')
        request.user = self.student_user
        
        permission = IsStudentUser()
        self.assertTrue(permission.has_permission(request, None))
        
        # Instructor user without student role should fail
        request.user = self.instructor_user
        self.assertFalse(permission.has_permission(request, None))


class MultiRoleLoginTests(APITestCase):
    """Test multi-role login and role switching"""
    
    def setUp(self):
        """Set up test user"""
        self.user = User.objects.create_user(
            email='khairil@example.com',
            username='khairil',
            password='testpass123',
            full_name='Khairil Test User'
        )
        # Grant all roles
        self.user.is_student = True
        self.user.is_instructor = True
        self.user.is_admin = True
        self.user.current_role = 'student'
        self.user.roles = 'student,instructor,admin'
        self.user.role = 'student'
        self.user.save()
    
    def test_login_returns_available_roles(self):
        """Test that login response includes available roles"""
        response = self.client.post('/api/v1/token/', {
            'email': 'khairil@example.com',
            'password': 'testpass123'
        }, format='json')
        
        # Should have successful response
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        
        # Check user data includes role info
        if 'user' in response.data:
            user_data = response.data['user']
            self.assertIn('is_student', user_data)
            self.assertIn('is_instructor', user_data)
            self.assertIn('is_admin', user_data)
    
    def test_role_switching_preserves_other_roles(self):
        """Test that switching current role doesn't remove other roles"""
        user = self.user
        
        # Start as student
        self.assertEqual(user.current_role, 'student')
        
        # Switch to instructor
        user.current_role = 'instructor'
        user.save()
        
        # Should still have all roles
        user.refresh_from_db()
        self.assertTrue(user.is_student)
        self.assertTrue(user.is_instructor)
        self.assertTrue(user.is_admin)
        self.assertEqual(user.current_role, 'instructor')


class RoleMigrationTests(TestCase):
    """Test that old string-based roles are migrated to boolean fields"""
    
    def test_migration_sets_all_roles_for_multi_role_user(self):
        """Test that migration correctly sets boolean fields"""
        # This test would run after migration
        # Verify a multi-role user has all boolean fields set
        
        user = User.objects.create_user(
            email='test@example.com',
            username='test',
            password='testpass123'
        )
        
        # Before setting, should have defaults
        self.assertTrue(user.is_student)  # default=True
        self.assertFalse(user.is_instructor)  # default=False
        self.assertFalse(user.is_admin)  # default=False
        
        # Manually set like migration would
        user.is_admin = True
        user.is_instructor = True
        user.save()
        
        user.refresh_from_db()
        self.assertTrue(user.is_student)
        self.assertTrue(user.is_instructor)
        self.assertTrue(user.is_admin)


if __name__ == '__main__':
    import unittest
    unittest.main()
