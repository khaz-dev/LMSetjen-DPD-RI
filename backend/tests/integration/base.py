"""
Base Integration Test Case for LMSetjen DPD RI.
Provides shared fixtures, pre-authenticated role-based API clients,
and entity factories with full database transaction rollback.
"""

from rest_framework.test import APITestCase, APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils.text import slugify
import shortuuid

from userauths.models import User, Profile, Admin
from api.models import (
    Teacher, Category, Tag, Course, Variant, VariantItem,
    EnrolledCourse, CompletedLesson, Quiz, QuizQuestion, QuizChoice,
    Certificate, CertificateTemplateConfig
)


class BaseIntegrationTestCase(APITestCase):
    """
    Base test case providing pre-configured clients and factory helpers.
    Each test is executed inside an atomic transaction that rolls back automatically.
    """

    def setUp(self):
        super().setUp()

        # 1. Create Student User & Client
        self.student_user = User.objects.create_user(
            email='student_test@example.com',
            username='student_test',
            password='Password123!',
            full_name='Test Student'
        )
        self.student_user.is_student = True
        self.student_user.is_instructor = False
        self.student_user.is_admin = False
        self.student_user.current_role = 'student'
        self.student_user.roles = 'student'
        self.student_user.role = 'student'
        self.student_user.save()

        self.client_student = APIClient()
        self.authenticate_client(self.client_student, self.student_user)

        # 2. Create Instructor User, Teacher Record & Client
        self.instructor_user = User.objects.create_user(
            email='instructor_test@example.com',
            username='instructor_test',
            password='Password123!',
            full_name='Test Instructor'
        )
        self.instructor_user.is_student = False
        self.instructor_user.is_instructor = True
        self.instructor_user.is_admin = False
        self.instructor_user.current_role = 'instructor'
        self.instructor_user.roles = 'instructor'
        self.instructor_user.role = 'instructor'
        self.instructor_user.save()

        self.teacher_profile, _ = Teacher.objects.get_or_create(
            user=self.instructor_user,
            defaults={'full_name': self.instructor_user.full_name, 'bio': 'Certified Trainer'}
        )

        self.client_instructor = APIClient()
        self.authenticate_client(self.client_instructor, self.instructor_user)

        # 3. Create Admin User, Admin Record & Client
        self.admin_user = User.objects.create_user(
            email='admin_test@example.com',
            username='admin_test',
            password='Password123!',
            full_name='Test Administrator',
            is_staff=True,
            is_superuser=True
        )
        self.admin_user.is_student = False
        self.admin_user.is_instructor = False
        self.admin_user.is_admin = True
        self.admin_user.current_role = 'admin'
        self.admin_user.roles = 'admin'
        self.admin_user.role = 'admin'
        self.admin_user.save()

        self.admin_record, _ = Admin.objects.get_or_create(
            user=self.admin_user,
            defaults={'full_name': self.admin_user.full_name, 'is_super_admin': True}
        )

        self.client_admin = APIClient()
        self.authenticate_client(self.client_admin, self.admin_user)

        # 4. Multi-Role User (Has all 3 roles, active initially as student)
        self.multi_user = User.objects.create_user(
            email='multirole_test@example.com',
            username='multirole_test',
            password='Password123!',
            full_name='Multi Role User'
        )
        self.multi_user.is_student = True
        self.multi_user.is_instructor = True
        self.multi_user.is_admin = True
        self.multi_user.current_role = 'student'
        self.multi_user.roles = 'student,instructor,admin'
        self.multi_user.role = 'student'
        self.multi_user.save()

        self.multi_teacher, _ = Teacher.objects.get_or_create(
            user=self.multi_user,
            defaults={'full_name': self.multi_user.full_name}
        )
        self.multi_admin, _ = Admin.objects.get_or_create(
            user=self.multi_user,
            defaults={'full_name': self.multi_user.full_name, 'is_super_admin': True}
        )

        self.client_multi = APIClient()
        self.authenticate_client(self.client_multi, self.multi_user)

        # 5. Anonymous Client
        self.client_anonymous = APIClient()

    def get_jwt_token(self, user):
        """Generate JWT token embedding role claims for active role enforcement."""
        refresh = RefreshToken.for_user(user)
        refresh['role'] = user.current_role
        refresh['current_role'] = user.current_role
        refresh['roles'] = user.roles
        return str(refresh.access_token)

    def authenticate_client(self, client, user):
        """Attaches Bearer JWT authorization header to the specified client."""
        token = self.get_jwt_token(user)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return token

    # ================= FACTORY HELPERS =================

    def create_category(self, title=None):
        if not title:
            title = f"Category {shortuuid.uuid()[:6]}"
        return Category.objects.create(
            title=title,
            slug=slugify(title),
            active=True
        )

    def create_course(self, teacher=None, category=None, title=None, teacher_course_status="Published", course_type="internal"):
        if teacher is None:
            teacher = self.teacher_profile
        if category is None:
            category = self.create_category()
        if not title:
            title = f"Course {shortuuid.uuid()[:6]}"

        course_id = f"CRS-{shortuuid.uuid()[:8].upper()}"
        slug = f"{slugify(title)}-{shortuuid.uuid()[:4].lower()}"

        return Course.objects.create(
            teacher=teacher,
            category=category,
            title=title,
            description="Test course description with extensive curriculum.",
            level="Beginner",
            teacher_course_status=teacher_course_status,
            platform_status="Published" if teacher_course_status == "Published" else "Draft",
            course_id=course_id,
            slug=slug,
            course_type=course_type,
            is_published_version=(teacher_course_status == "Published")
        )

    def create_variant(self, course, title=None):
        if not title:
            title = f"Module {shortuuid.uuid()[:4]}"
        variant_id = f"VAR-{shortuuid.uuid()[:6].upper()}"
        return Variant.objects.create(
            course=course,
            title=title,
            variant_id=variant_id
        )

    def create_variant_item(self, variant, title=None, description="Lesson details"):
        if not title:
            title = f"Lesson {shortuuid.uuid()[:4]}"
        variant_item_id = f"ITM-{shortuuid.uuid()[:6].upper()}"
        return VariantItem.objects.create(
            variant=variant,
            title=title,
            description=description,
            variant_item_id=variant_item_id,
            duration="10m"
        )

    def create_enrollment(self, user=None, course=None):
        if user is None:
            user = self.student_user
        if course is None:
            course = self.create_course()
        enrollment_id = f"ENR-{shortuuid.uuid()[:8].upper()}"
        return EnrolledCourse.objects.create(
            user=user,
            course=course,
            teacher=course.teacher,
            enrollment_id=enrollment_id
        )

    def create_quiz(self, course, title=None, passing_score=70):
        if not title:
            title = f"Quiz {shortuuid.uuid()[:4]}"
        quiz_id = f"QZ-{shortuuid.uuid()[:6].upper()}"
        return Quiz.objects.create(
            course=course,
            title=title,
            description="Knowledge check",
            quiz_id=quiz_id
        )
