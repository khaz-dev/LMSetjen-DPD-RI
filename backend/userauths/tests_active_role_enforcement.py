from django.test import TestCase
from rest_framework.test import APIRequestFactory
from userauths.models import User
from api.permissions import IsAdminUser, IsTeacherUser, IsStudentUser, IsTeacherOrAdmin, IsOwnerOrStaff


class ActiveRoleEnforcementTests(TestCase):
    """
    Test suite verifying strict active role enforcement:
    Multi-role users can ONLY access permissions of their currently active role.
    """
    def setUp(self):
        self.factory = APIRequestFactory()
        
        # User who has all 3 roles
        self.multi_user = User.objects.create_user(
            email='multi@example.com',
            username='multi',
            password='password123',
            full_name='Multi Role User'
        )
        self.multi_user.is_student = True
        self.multi_user.is_instructor = True
        self.multi_user.is_admin = True
        self.multi_user.roles = 'student,instructor,admin'
        self.multi_user.save()

        # Regular single-role student
        self.student_only = User.objects.create_user(
            email='student_only@example.com',
            username='student_only',
            password='password123',
            full_name='Student Only'
        )
        self.student_only.is_student = True
        self.student_only.is_instructor = False
        self.student_only.is_admin = False
        self.student_only.current_role = 'student'
        self.student_only.save()

    def test_multi_user_when_active_role_is_student(self):
        self.multi_user.current_role = 'student'
        self.multi_user.save()

        request = self.factory.get('/')
        request.user = self.multi_user

        self.assertTrue(IsStudentUser().has_permission(request, None), "Should pass IsStudentUser when active as student")
        self.assertFalse(IsTeacherUser().has_permission(request, None), "Should FAIL IsTeacherUser when active as student")
        self.assertFalse(IsAdminUser().has_permission(request, None), "Should FAIL IsAdminUser when active as student")
        self.assertFalse(IsTeacherOrAdmin().has_permission(request, None), "Should FAIL IsTeacherOrAdmin when active as student")

    def test_multi_user_when_active_role_is_instructor(self):
        self.multi_user.current_role = 'instructor'
        self.multi_user.save()

        request = self.factory.get('/')
        request.user = self.multi_user

        self.assertFalse(IsStudentUser().has_permission(request, None), "Should FAIL IsStudentUser when active as instructor")
        self.assertTrue(IsTeacherUser().has_permission(request, None), "Should pass IsTeacherUser when active as instructor")
        self.assertFalse(IsAdminUser().has_permission(request, None), "Should FAIL IsAdminUser when active as instructor")
        self.assertTrue(IsTeacherOrAdmin().has_permission(request, None), "Should pass IsTeacherOrAdmin when active as instructor")

    def test_multi_user_when_active_role_is_admin(self):
        self.multi_user.current_role = 'admin'
        self.multi_user.save()

        request = self.factory.get('/')
        request.user = self.multi_user

        self.assertFalse(IsStudentUser().has_permission(request, None), "Should FAIL IsStudentUser when active as admin")
        self.assertFalse(IsTeacherUser().has_permission(request, None), "Should FAIL IsTeacherUser when active as admin")
        self.assertTrue(IsAdminUser().has_permission(request, None), "Should pass IsAdminUser when active as admin")
        self.assertTrue(IsTeacherOrAdmin().has_permission(request, None), "Should pass IsTeacherOrAdmin when active as admin")

    def test_single_role_student_access(self):
        request = self.factory.get('/')
        request.user = self.student_only

        self.assertTrue(IsStudentUser().has_permission(request, None))
        self.assertFalse(IsTeacherUser().has_permission(request, None))
        self.assertFalse(IsAdminUser().has_permission(request, None))
