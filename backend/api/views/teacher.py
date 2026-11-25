# Trigger auto-reload for in-memory throttle cache reset
from urllib3.exceptions import InsecureRequestWarning
from django.shortcuts import render, redirect
from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.db import models
from django.db.models import Q, F, Value, Count, Sum, Avg, Max
from django.db.models.functions import ExtractMonth
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.http import Http404, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.clickjacking import xframe_options_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
from django.views.decorators.cache import cache_page
from django.core.cache import cache

try:
    from api.cache_utils import cache_search_results, cache_suggestions, SearchCacheManager, TrendingCacheManager
except ImportError:
    def cache_search_results(timeout=300):
        return lambda f: f
    def cache_suggestions(timeout=600):
        return lambda f: f

from api import serializer as api_serializer
from api import models as api_models
from userauths.models import User, Profile, OrganizationUnit, Position, UsedSSOToken

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, APIView
from rest_framework.pagination import PageNumberPagination

from api.permissions import IsAdminUser, IsOwnerOrStaff
from api.serializer import MyTokenObtainPairSerializer
from api.version import APP_VERSION, APP_NAME

import random
from decimal import Decimal
import requests

import logging
logger = logging.getLogger('api')
security_logger = logging.getLogger('security')
from datetime import datetime, timedelta
from django.utils.dateparse import parse_datetime
import base64
import hashlib
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding

from django.core.files.storage import default_storage
import os
import re
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
try:
    from moviepy.editor import VideoFileClip
except ImportError:
    VideoFileClip = None
from django.core.files.base import ContentFile
import math
from rest_framework.parsers import MultiPartParser, FormParser
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from api.views.helpers import _SYNC_STATE, reset_sync_state, update_sync_state, get_sync_state, csrf_failure, generate_tokens_with_role


@method_decorator(csrf_exempt, name='dispatch')
class TeacherCourseDetailAPIView(generics.RetrieveDestroyAPIView):
    """
    Teacher Course Detail API (Retrieve/Delete)
    
    [*] PHASE 4.76 FIX: Enforces draft-only editing for published courses
    
    When instructor tries to edit a published course:
    1. Returns draft version info if it exists
    2. Creates draft version if it doesn't exist
    3. Returns error if trying to edit published course directly
    
    This ensures published courses are always read-only at the database level.
    """
    serializer_class = api_serializer.CourseEditSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_object(self):
        course_id = self.kwargs['course_id']
        try:
            course = api_models.Course.objects.get(course_id=course_id)
            
            # 🔒 FIX: Pastikan user yang login adalah pemilik kursus ini (atau admin)
            user = self.request.user
            is_admin = (
                getattr(user, 'is_admin', False) or 
                getattr(user, 'is_staff', False) or 
                getattr(user, 'current_role', '') == 'admin' or 
                getattr(user, 'role', '') == 'admin'
            )
            if course.teacher.user != user and not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Akses ditolak. Anda tidak memiliki izin memodifikasi kursus ini.")

            # [*] PHASE 4.76: CRITICAL - Enforce draft-only editing
            # If trying to edit a published course, return error
            # Instructor must use "Edit Versi Terbaru" to create a draft first
            if course.is_published_version:
                # 🔒 SECURITY: Use logging instead of print
                is_for_edit = self.request.query_params.get('for_edit') == 'true'
                import logging
                logger = logging.getLogger('api')
                if is_for_edit:
                    logger.warning(f"[Teacher Course Detail] [FAIL] Attempt to edit published course directly: {course.title}")
                else:
                    logger.info(f"[Teacher Course Detail] [OK] Loading published course for viewing/evaluation: {course.title}")
                # Return course with signal (will be handled in get method)
                setattr(course, '_is_published_version_attempt', True)
                return course
            
            # Check if this is a draft of a published course
            if course.parent_course and course.parent_course.is_published_version:
                # 🔒 SECURITY: Use logging instead of print
                import logging
                logger = logging.getLogger('api')
                logger.info(f"[Teacher Course Detail] [OK] Loading draft revision for editing: {course.title}")
                return course
            
            # Regular draft course
            return course
            
        except api_models.Course.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound(f"Course with ID {course_id} does not exist")
    
    def get(self, request, *args, **kwargs):
        """[*] PHASE 4.76: Override get to handle published course error properly"""
        try:
            course = self.get_object()
            
            # Check if this is a published course access attempt for editing
            is_view_mode = (
                request.query_params.get('mode') in ['view', 'readonly', 'evaluation']
                or request.query_params.get('readonly') == 'true'
                or request.query_params.get('view_only') == 'true'
            )
            is_for_edit = request.query_params.get('for_edit') == 'true'
            
            # Block direct editing of published course (instructors must create draft)
            # Allow read-only operations such as course evaluation, gamification preview, review, etc.
            if hasattr(course, '_is_published_version_attempt') and course._is_published_version_attempt:
                if is_for_edit:
                    return Response({
                        "detail": {
                            "error": "Cannot edit published course directly",
                            "message": "Untuk mengedit kursus yang sudah dipublikasikan, gunakan tombol 'Edit Versi Terbaru' untuk membuat draft editing.",
                            "action": "edit_published",
                            "published_course_id": str(course.course_id)
                        }
                    }, status=status.HTTP_403_FORBIDDEN)
            
            serializer = self.get_serializer(course)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error in TeacherCourseDetailAPIView.get: {e}")
            import traceback
            traceback.print_exc()
            
            if hasattr(e, 'detail'):
                return Response(
                    {"detail": e.detail}, 
                    status=getattr(e, 'status_code', status.HTTP_400_BAD_REQUEST)
                )
            
            return Response(
                {"detail": "Failed to retrieve course"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def destroy(self, request, *args, **kwargs):
        """[*] PHASE 4.76: Prevent direct deletion of published courses"""
        course = self.get_object()
        if course.is_published_version:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Kursus yang sudah dipublikasikan tidak dapat dihapus secara langsung.")
        return super().destroy(request, *args, **kwargs)
            
    def retrieve(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            print(f"Error retrieving course {self.kwargs.get('course_id')}: {e}")
            import traceback
            traceback.print_exc()
            
            # If it's a permission denied error, return the custom error response
            if hasattr(e, 'detail') and isinstance(e.detail, dict):
                return Response(e.detail, status=status.HTTP_403_FORBIDDEN)
            
            return Response(
                {"error": f"Failed to retrieve course: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def destroy(self, request, *args, **kwargs):
        try:
            course = self.get_object()
            course_title = course.title
            course_id = course.course_id
            
            # Log the deletion
            print(f"Deleting course: {course_title} (ID: {course_id})")
            
            # ✨ PHASE 4.101: DELETE COURSE FILES BEFORE DELETING COURSE
            # Prevent orphaned files in storage
            if course.image:
                print(f"[Memory Cleanup] Deleting course image: {course.image}")
                delete_orphaned_file(course.image)
            
            if course.file:
                print(f"[Memory Cleanup] Deleting course file: {course.file}")
                delete_orphaned_file(course.file)
            
            # Delete the course (this will cascade delete related objects due to model relationships)
            course.delete()
            
            return Response({
                "success": True,
                "message": f"Course '{course_title}' has been successfully deleted",
                "course_id": str(course_id)
            }, status=status.HTTP_200_OK)
            
        except api_models.Course.DoesNotExist:
            return Response({
                "success": False,
                "error": "Course not found. It may have already been deleted."
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error deleting course {self.kwargs.get('course_id')}: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                "success": False,
                "error": f"Failed to delete course: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    


class TeacherSummaryAPIView(generics.ListAPIView):
    """
    Teacher Summary API (Mengatasi Temuan Pentest H-01 IDOR)
    
    Secured with:
    - JWT authentication (IsAuthenticated)
    - Anti-IDOR Permission (IsOwnerOrStaff):
      Teacher hanya dapat melihat ringkasan performa/siswa miliknya sendiri,
      kecuali pengguna memiliki hak akses admin/staff.
    """
    serializer_class = api_serializer.TeacherSummarySerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        
        # Handle case where teacher_id is 0 or invalid
        if not teacher_id or teacher_id == 0:
            return [{
                "total_courses": 0,
                "total_students": 0,
            }]
        
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
        except api_models.Teacher.DoesNotExist:
            return [{
                "total_courses": 0,
                "total_students": 0,
            }]

        one_month_ago = datetime.today() - timedelta(days=28)

        # [*] PHASE 4.60C: Filter to only top-level parent courses
        # is_published_version=False: Exclude student-facing published versions
        # parent_course__isnull=True: Exclude draft revisions of published courses
        total_courses = api_models.Course.objects.filter(
            teacher=teacher, 
            is_published_version=False,
            parent_course__isnull=True
        ).count()

        enrolled_courses = api_models.EnrolledCourse.objects.filter(teacher=teacher)
        unique_student_ids = set()
        students = []

        for course in enrolled_courses:
            if course.user_id not in unique_student_ids:
                user = User.objects.get(id=course.user_id)
                student = {
                    "full_name": user.profile.full_name,
                    "image": user.profile.image.url if user.profile.image else None,
                    "country": user.profile.country,
                    "date": course.date
                }

                students.append(student)
                unique_student_ids.add(course.user_id)

        return [{
            "total_courses": total_courses,
            "total_students": len(students),
        }]
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)



class TeacherCourseListAPIView(generics.ListAPIView):
    """
    Teacher Draft Course List API (Mengatasi Temuan Pentest H-01 IDOR)
    
    Secured with:
    - JWT authentication (IsAuthenticated)
    - Anti-IDOR Permission (IsOwnerOrStaff)
    """
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]
    pagination_class = None  # [*] PHASE 4 - Disable pagination for direct array response

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        
        # Handle case where teacher_id is 0 or invalid
        if not teacher_id or teacher_id == 0:
            return api_models.Course.objects.none()
        
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            # [*] PHASE 4.77 FIXED: Show ONLY draft courses (not published or draft revisions)
            # Instructor should only see courses they can edit
            # - is_published_version=False: Exclude student-facing published copies
            # - parent_course__isnull=True: Show only original drafts (not revisions)
            return api_models.Course.objects.filter(
                teacher=teacher,
                is_published_version=False,  # Only drafts
                parent_course__isnull=True   # Only original courses (not revisions)
            ).order_by('-date')
        except api_models.Teacher.DoesNotExist:
            return api_models.Course.objects.none()



# ✨ PHASE 4.77+: New endpoint for public instructor profile page
class TeacherPublishedCoursesAPIView(generics.ListAPIView):
    """
    Returns PUBLISHED courses for a teacher (for public profile display)
    
    Different from TeacherCourseListAPIView which returns draft courses for instructor dashboard.
    This endpoint is specifically for the public instructor profile page.
    """
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [AllowAny]
    pagination_class = None  # Direct array response

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        
        # Handle case where teacher_id is 0 or invalid
        if not teacher_id or teacher_id == 0:
            return api_models.Course.objects.none()
        
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            # ✨ PHASE 4.77: Return PUBLISHED courses (visible to students)
            # - is_published_version=True: Only published versions
            # These are the courses students can enroll in and see on the public profile
            return api_models.Course.objects.filter(
                teacher=teacher,
                is_published_version=True,  # Only published courses
                platform_status='Published'  # Ensure they're actually published
            ).order_by('-date')
        except api_models.Teacher.DoesNotExist:
            return api_models.Course.objects.none()



class TeacherReviewListAPIView(generics.ListAPIView):
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        
        # Handle case where teacher_id is 0 or invalid
        if not teacher_id or teacher_id == 0:
            return api_models.Review.objects.none()
        
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            return api_models.Review.objects.filter(course__teacher=teacher)
        except api_models.Teacher.DoesNotExist:
            return api_models.Review.objects.none()
    


@method_decorator(csrf_exempt, name='dispatch')
class TeacherReviewDetailAPIView(generics.RetrieveUpdateAPIView):
    """
    Teacher Review Detail API
    
    CSRF exempt because:
    - Uses JWT authentication for teacher operations
    - Review updates validated by serializer
    - Public endpoint for teacher dashboard
    """
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_object(self):
        teacher_id = self.kwargs['teacher_id']
        review_id = self.kwargs['review_id']
        
        # Handle case where teacher_id is 0 or invalid
        if not teacher_id or teacher_id == 0:
            from rest_framework.exceptions import NotFound
            raise NotFound('Teacher not found')
        
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            return api_models.Review.objects.get(course__teacher=teacher, id=review_id)
        except api_models.Teacher.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Teacher not found')



# ✨ PHASE 4.210: Review Abuse Report API
class ReviewAbuseReportAPIView(generics.CreateAPIView):
    """
    Report a review for abuse
    
    Allows instructors to report inappropriate student reviews to admins
    """
    serializer_class = api_serializer.ReviewAbuseSerializer
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        try:
            review_id = self.kwargs.get('review_id')
            
            try:
                review = api_models.Review.objects.get(id=review_id)
            except api_models.Review.DoesNotExist:
                return Response(
                    {'error': 'Ulasan tidak ditemukan'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get the current user (teacher)
            user_id = request.data.get('reported_by')
            
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {'error': 'Pengguna tidak ditemukan'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if user already reported this review
            existing_report = api_models.ReviewAbuse.objects.filter(
                review=review,
                reported_by=user
            ).exists()
            
            if existing_report:
                return Response(
                    {'error': 'Anda sudah melaporkan review ini sebelumnya'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create the abuse report
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(review=review, reported_by=user)
            
            return Response(
                {
                    'success': True,
                    'message': 'Laporan penyalahgunaan berhasil dikirim ke Admin',
                    'data': serializer.data
                },
                status=status.HTTP_201_CREATED
            )
        except api_models.ReviewAbuse.DoesNotExist:
            return Response(
                {'error': 'Database belum siap. Hubungi Administrator.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {'error': f'Terjadi kesalahan server: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



# ✨ PHASE 4.210: Teacher Abuse Reports - View submitted abuse reports
class TeacherAbuseReportsAPIView(generics.ListAPIView):
    """
    List all abuse reports submitted by a teacher
    """
    serializer_class = api_serializer.ReviewAbuseSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        teacher_id = self.kwargs.get('teacher_id')
        
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            user = teacher.user
            return api_models.ReviewAbuse.objects.filter(reported_by=user).select_related('review', 'reviewed_by')
        except api_models.Teacher.DoesNotExist:
            return api_models.ReviewAbuse.objects.none()



# ✨ PHASE 4.210: Teacher Update Abuse Report - Allow instructors to update their own reports
class TeacherAbuseReportDetailAPIView(generics.UpdateAPIView):
    """
    Allow teachers to update their own abuse reports
    """
    serializer_class = api_serializer.ReviewAbuseSerializer
    permission_classes = [IsAuthenticated]  # Require authentication
    lookup_field = 'id'
    
    def get_queryset(self):
        # Only allow teachers to update their own reports
        return api_models.ReviewAbuse.objects.filter(reported_by=self.request.user).select_related('review', 'reported_by', 'reviewed_by')
    
    def update(self, request, *args, **kwargs):
        report = self.get_object()
        
        # Allow updating reason and description if status is pending, reviewed, or dismissed
        # Teachers can update their report at any stage except if action was already taken
        if report.status not in ['pending', 'dismissed', 'reviewed']:
            return Response(
                {"error": "Laporan dengan status 'Action Taken' tidak dapat diperbarui. Hubungi admin untuk informasi lebih lanjut."},
                status=400
            )
        
        # Update only allowed fields
        reason = request.data.get('reason')
        description = request.data.get('description')
        
        if reason:
            report.reason = reason
        if description is not None:
            report.description = description
        
        # Reset status to pending when resubmitting
        report.status = 'pending'
        report.reviewed_by = None
        report.reviewed_at = None
        report.review_notes = ''
        
        report.save()
        
        serializer = self.get_serializer(report)
        return Response(serializer.data)



# ✨ PHASE 4.210: Teacher Close Abuse Report - Allow instructors to mark report as resolved
class TeacherAbuseReportCloseAPIView(generics.UpdateAPIView):
    """
    Allow teachers to mark their abuse reports as resolved/closed
    """
    serializer_class = api_serializer.ReviewAbuseSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_queryset(self):
        # Only allow teachers to close their own reports
        return api_models.ReviewAbuse.objects.filter(reported_by=self.request.user).select_related('review', 'reported_by', 'reviewed_by')
    
    def update(self, request, *args, **kwargs):
        from django.utils import timezone
        from rest_framework.response import Response
        
        report = self.get_object()
        
        # Check if already closed
        if report.closed_by_reporter:
            return Response(
                {"error": "Laporan ini sudah ditandai sebagai selesai"},
                status=400
            )
        
        # Mark as closed
        report.closed_by_reporter = True
        report.closed_by_reporter_at = timezone.now()
        report.save()
        
        serializer = self.get_serializer(report)
        return Response(serializer.data)



class TeacherStudentsListAPIView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]
    
    def list(self, request, teacher_id=None):
        try:
            # Handle case where teacher_id is 0 or invalid
            if not teacher_id or teacher_id == 0:
                return Response([])
            
            teacher = api_models.Teacher.objects.get(id=teacher_id)

            enrolled_courses = (
                api_models.EnrolledCourse.objects
                .filter(Q(teacher=teacher) | Q(course__teacher=teacher))
                .select_related('course', 'user', 'user__profile', 'user__profile__organization_unit', 'user__profile__position')
                .order_by('-date')
            )
            
            students_map = {}
            for ec in enrolled_courses:
                if not ec.user_id:
                    continue
                user = ec.user
                if not user:
                    continue
                
                uid = user.id
                if uid not in students_map:
                    # Resolve full name
                    full_name = None
                    image_url = None
                    country = None
                    unit_kerja = None
                    position_name = None
                    
                    profile = getattr(user, 'profile', None)
                    if profile:
                        full_name = profile.full_name or None
                        country = profile.country or None
                        if profile.image:
                            try:
                                image_url = str(profile.image)
                            except Exception:
                                image_url = None
                        if getattr(profile, 'organization_unit', None):
                            unit_kerja = profile.organization_unit.name
                        if getattr(profile, 'position', None):
                            position_name = profile.position.name
                    
                    if not full_name:
                        if getattr(user, 'full_name', None):
                            full_name = user.full_name
                        elif getattr(user, 'username', None):
                            full_name = user.username
                        elif user.first_name or user.last_name:
                            full_name = f"{user.first_name} {user.last_name}".strip()
                        elif user.email:
                            full_name = user.email.split('@')[0]
                        else:
                            full_name = f"Student {user.id}"
                    
                    students_map[uid] = {
                        "user_id": user.id,
                        "full_name": full_name,
                        "image": image_url,
                        "country": country,
                        "unit_kerja": unit_kerja or country,
                        "position": position_name,
                        "nip": getattr(user, 'nip', None),
                        "date": ec.date,
                        "email": user.email if getattr(user, 'email', None) else None,
                        "courses": []
                    }
                
                # Append course if not already added
                if ec.course:
                    if not any(c.get('id') == ec.course.id for c in students_map[uid]['courses']):
                        students_map[uid]['courses'].append({
                            "id": ec.course.id,
                            "title": ec.course.title,
                            "date": ec.date,
                            "enrollment_id": ec.enrollment_id
                        })

            students = list(students_map.values())
            for s in students:
                s['courses_count'] = len(s['courses'])

            return Response(students)
        except api_models.Teacher.DoesNotExist:
            return Response({'error': 'Teacher not found'}, status=404)
        except Exception as e:
            print(f"Error in TeacherStudentsListAPIView: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=500)



class TeacherBestSellingCourseAPIView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def list(self, request, teacher_id=None):
        try:
            # Handle case where teacher_id is 0 or invalid
            if not teacher_id or teacher_id == 0:
                return Response([])
            
            from api.url_utils import clean_and_process_image_url
            
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            courses_with_sales = []
            # [*] PHASE 4.60C: Filter to only top-level parent courses
            # is_published_version=False: Exclude student-facing published versions  
            # parent_course__isnull=True: Exclude draft revisions of published courses
            courses = api_models.Course.objects.filter(
                teacher=teacher, 
                is_published_version=False,
                parent_course__isnull=True
            )

            for course in courses:
                sales = course.enrolledcourse_set.count()

                # Get average rating safely
                try:
                    avg_rating = course.average_rating()
                    if avg_rating is None:
                        avg_rating = 0
                except:
                    avg_rating = 0

                # ✨ PHASE 4.77+: Include lectures/materials for JP calculation
                lectures_data = []
                try:
                    variant_items = api_models.VariantItem.objects.filter(variant__course=course)
                    for item in variant_items:
                        lectures_data.append({
                            'content_duration': item.content_duration,
                        })
                except:
                    lectures_data = []

                courses_with_sales.append({
                    'id': course.id,  # Database PK
                    'course_id': course.course_id,  # Course unique identifier string for routing
                    'image': clean_and_process_image_url(course.image),
                    'title': course.title if course.title else 'Untitled Course',
                    'sales': sales,
                    'students': {'length': sales},  # Frontend expects students.length
                    'average_rating': avg_rating,
                    'lectures': lectures_data,  # ✨ PHASE 4.77+: Include lectures for JP calculation
                })

            # Sort by sales (descending) to show best selling courses first
            courses_with_sales.sort(key=lambda x: x['sales'], reverse=True)

            return Response(courses_with_sales)
        except api_models.Teacher.DoesNotExist:
            return Response({'error': 'Teacher not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    


class TeacherCourseOrdersListAPIView(generics.ListAPIView):
    # Changed to use EnrolledCourse instead of CartOrder
    serializer_class = api_serializer.EnrolledCourseSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        
        # Handle case where teacher_id is 0 or invalid
        if not teacher_id or teacher_id == 0:
            return api_models.EnrolledCourse.objects.none()
        
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            return api_models.EnrolledCourse.objects.filter(teacher=teacher)
        except api_models.Teacher.DoesNotExist:
            return api_models.EnrolledCourse.objects.none()



class TeacherQuestionAnswerListAPIView(generics.ListAPIView):
    serializer_class = api_serializer.Question_AnswerSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        
        # Handle case where teacher_id is 0 or invalid
        if not teacher_id or teacher_id == 0:
            return api_models.Question_Answer.objects.none()
        
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            # ✨ PHASE 7.10+: Handle dual-copy versioning system
            # Questions can be associated with EITHER:
            # 1. Draft courses (is_published_version=False, parent_course__isnull=True)
            # 2. Published versions (is_published_version=True, parent_course__isnull=False)
            # We need to return questions from both to show all discussions to instructor
            from django.db.models import Q
            return api_models.Question_Answer.objects.filter(
                Q(course__teacher=teacher) &  # All courses for this teacher
                (Q(course__is_published_version=False) | Q(course__is_published_version=True))  # Both draft and published
            ).order_by('-date')
        except api_models.Teacher.DoesNotExist:
            return api_models.Question_Answer.objects.none()
    


class TeacherNotificationListAPIView(generics.ListAPIView):
    serializer_class = api_serializer.NotificationSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        
        # Handle case where teacher_id is 0 or invalid
        if not teacher_id or teacher_id == 0:
            return api_models.Notification.objects.none()
        
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            # Return ALL notifications (both seen and unseen) - Phase 4.36
            return api_models.Notification.objects.filter(teacher=teacher).order_by('-date')
        except api_models.Teacher.DoesNotExist:
            return api_models.Notification.objects.none()
    


@method_decorator(csrf_exempt, name='dispatch')
class TeacherNotificationDetailAPIView(generics.RetrieveUpdateAPIView):
    """
    Teacher Notification Detail API
    
    CSRF exempt because:
    - Uses JWT authentication for teacher operations
    - Notification updates (mark as read) validated by serializer
    - Public endpoint for teacher dashboard
    """
    serializer_class = api_serializer.NotificationSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_object(self):
        teacher_id = self.kwargs['teacher_id']
        noti_id = self.kwargs['noti_id']
        teacher = api_models.Teacher.objects.get(id=teacher_id)
        return api_models.Notification.objects.get(teacher=teacher, id=noti_id)




@method_decorator(csrf_exempt, name='dispatch')
class TeacherCreateFromProfileAPIView(APIView):
    """
    Teacher Profile Creation API
    
    Secured by JWT authentication and ownership validation
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def post(self, request):
        try:
            user_id = request.data.get('user_id')
            if not user_id:
                return Response({'error': 'User ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # 🔒 Validasi kepemilikan
            is_admin = getattr(request.user, 'is_admin', False) or getattr(request.user, 'is_staff', False)
            if str(request.user.id) != str(user_id) and not is_admin:
                return Response({'error': 'Akses ditolak. Anda tidak berhak membuat profil instruktur untuk user lain.'}, status=status.HTTP_403_FORBIDDEN)
            
            # Check if teacher already exists
            existing_teacher = api_models.Teacher.objects.filter(user_id=user_id).first()
            if existing_teacher:
                teacher_data = api_serializer.BasicTeacherSerializer(existing_teacher).data
                return Response({'teacher': teacher_data}, status=status.HTTP_200_OK)
            
            # Get user profile
            try:
                from userauths.models import Profile
                profile = Profile.objects.get(user_id=user_id)
            except Profile.DoesNotExist:
                return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Create teacher from profile
            teacher = api_models.Teacher.create_from_profile(profile.user)
            teacher_data = api_serializer.BasicTeacherSerializer(teacher).data
            
            return Response({
                'message': 'Teacher created successfully',
                'teacher': teacher_data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class TeacherProfileAPIView(generics.RetrieveAPIView):
    """
    Teacher Profile API (Private Dashboard)
    
    Secured with:
    - JWT authentication (IsAuthenticated)
    - Anti-IDOR Object-Level Authorization:
      Hanya pemilik akun instruktur atau admin/staff yang berhak melihat profil internal instruktur.
    """
    serializer_class = api_serializer.BasicTeacherSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]
    
    def get_object(self):
        user_id = self.kwargs.get('user_id')
        request_user = self.request.user
        
        # 🔒 Anti-IDOR Check:
        # Hanya izinkan akses jika user mengakses profilnya sendiri atau admin/staff
        is_admin_or_staff = (
            request_user.is_staff or 
            getattr(request_user, 'is_admin', False) or 
            getattr(request_user, 'role', None) == 'admin'
        )
        if str(request_user.id) != str(user_id) and not is_admin_or_staff:
            security_logger.warning(
                f"[IDOR ATTEMPT] User {request_user.id} ({request_user.email}) "
                f"attempted unauthorized access to teacher profile of user_id={user_id}"
            )
            raise PermissionDenied("Anda tidak memiliki izin untuk mengakses profil instruktur ini.")
        
        teacher = api_models.Teacher.objects.filter(user_id=user_id).first()
        if not teacher:
            # If teacher doesn't exist, create one from profile
            try:
                from userauths.models import Profile
                profile = Profile.objects.get(user_id=user_id)
                teacher = api_models.Teacher.create_from_profile(profile.user)
            except Profile.DoesNotExist:
                raise Http404("Data instruktur tidak ditemukan.")
        return teacher




# [*] PHASE 4.43: Public Teacher Detail API - Get teacher by teacher_id (not user_id)
# This endpoint returns full teacher data including expertise for public instructor profiles
class TeacherDetailAPIView(generics.RetrieveAPIView):
    """
    Public Teacher Detail API
    
    URL: GET /api/v1/teacher/detail/<teacher_id>/
    Usage: Fetch teacher data including expertise for public instructor profiles
    Serializer: TeacherSerializer (includes expertise)
    Permission: AllowAny (public access)
    
    [*] PHASE 4.43: Added for public profile page to show expertise section
    """
    serializer_class = api_serializer.TeacherSerializer
    permission_classes = [AllowAny]
    
    def get_object(self):
        teacher_id = self.kwargs['teacher_id']
        
        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
            return teacher
        except api_models.Teacher.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound(detail=f"Teacher with ID {teacher_id} not found")




@method_decorator(csrf_exempt, name='dispatch')
class TeacherProfileUpdateAPIView(APIView):
    """
    Teacher Profile Update API
    
    CSRF exempt because:
    - Uses JWT authentication for teacher operations
    - Secured by JWT token validation (IsAuthenticated)
    - Anti-IDOR Object-Level Authorization (IsOwnerOrStaff):
      Hanya pemilik akun instruktur atau admin/staff yang dapat mengubah data profil.
    """
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]
    
    def patch(self, request, user_id):
        try:
            if not user_id:
                return Response({'error': 'User ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            request_user = request.user
            is_admin_or_staff = (
                request_user.is_staff or 
                getattr(request_user, 'is_admin', False) or 
                getattr(request_user, 'role', None) == 'admin'
            )
            if str(request_user.id) != str(user_id) and not is_admin_or_staff:
                security_logger.warning(
                    f"[IDOR ATTEMPT] User {request_user.id} ({request_user.email}) "
                    f"attempted unauthorized patch on teacher profile of user_id={user_id}"
                )
                return Response(
                    {'error': 'Anda tidak memiliki izin untuk mengubah profil instruktur ini.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get user to fetch actual full_name
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # [*] PHASE 4.39: Get or create teacher with correct full_name from user
            teacher, created = api_models.Teacher.objects.get_or_create(
                user_id=user_id,
                defaults={'full_name': user.full_name}  # Get actual user's full_name, not placeholder
            )
            
            # Update teacher fields
            teacher_fields = ['bio', 'facebook', 'twitter', 'linkedin', 'youtube', 'instagram', 'tiktok', 'about']
            for field in teacher_fields:
                if field in request.data:
                    setattr(teacher, field, request.data[field])
            
            if 'country' in request.data and request.data['country'] is not None:
                setattr(teacher, 'country', request.data['country'])
            
            teacher.save()
            
            # Demographic and user fields update
            user_updated = False
            for u_field in ['full_name', 'phone', 'instansi_asal', 'pekerjaan', 'provinsi', 'kota_kabupaten']:
                if u_field in request.data and request.data[u_field] is not None:
                    setattr(user, u_field, request.data[u_field])
                    user_updated = True
            
            if 'country' in request.data and request.data['country'] is not None:
                user.negara = request.data['country']
                user_updated = True
                
            if user_updated:
                user.save()
            
            # ✨ Synchronize with userauths Profile to prevent data divergence
            try:
                from userauths.models import Profile
                user_profile = Profile.objects.filter(user=user).first()
                if user_profile:
                    user_profile._syncing = True
                    for field in teacher_fields:
                        if field in request.data:
                            setattr(user_profile, field, request.data[field])
                    for field in ['instansi_asal', 'pekerjaan', 'provinsi', 'kota_kabupaten']:
                        if field in request.data:
                            setattr(user_profile, field, request.data[field])
                    if 'country' in request.data:
                        user_profile.country = request.data['country']
                    user_profile.save()
            except Exception as pe:
                print(f"Error syncing Teacher update to Profile: {pe}")
            
            teacher_data = api_serializer.BasicTeacherSerializer(teacher).data
            
            return Response({
                'message': 'Teacher profile updated successfully',
                'teacher': teacher_data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    



# ✨ PHASE 4.78: Instructor Request API Views
# Handles requests from students to become instructors, with admin approval workflow

class InstructorRequestCreateAPIView(generics.ListCreateAPIView):
    """
    ✨ PHASE 4.78: Student submit request to become instructor & check pending requests
    
    GET /api/v1/instructor-request/
    - Returns current user's pending/latest instructor request
    - Returns empty if no request exists
    
    POST /api/v1/instructor-request/
    - Creates new instructor request
    
    Request Body (POST):
    {
        "expertise_areas": "Python, Web Development, Data Science",
        "bio": "I have 5 years of experience as a full stack developer...",
        "experience_level": "ADVANCED"
    }
    
    Response (both GET and POST):
    {
        "id": 1,
        "expertise_areas": "...",
        "bio": "...",
        "experience_level": "ADVANCED",
        "request_date": "2026-02-22T...",
        "status": "PENDING"
    }
    """
    serializer_class = api_serializer.InstructorRequestCreateSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # Disable pagination for single request
    
    def get_queryset(self):
        """Get current user's instructor requests, ordered by status then most recent first
        
        ✨ PHASE 4.79: Returns PENDING first, then REJECTED (for reapply workflow)
        ✨ PHASE 4.81: Also returns APPROVED requests (for completeness)
        This ensures we get the current active request, not old historical requests
        """
        return api_models.InstructorRequest.objects.filter(
            user=self.request.user,
            status__in=['PENDING', 'REJECTED', 'APPROVED']  # ✨ PHASE 4.81: Added APPROVED
        ).order_by('-status', '-request_date')  # REJECTED before PENDING before APPROVED, then by date
    
    def list(self, request, *args, **kwargs):
        """Override list to return only the latest request or object details
        
        ✨ PHASE 4.79: Updated to work with reapply workflow
        - Returns PENDING request if exists (user is currently applying)
        - Returns REJECTED request if exists (user can reapply)
        - Returns None if no active request
        """
        queryset = self.get_queryset()
        
        # Prefer PENDING over REJECTED (PENDING means currently reviewing)
        active_request = queryset.filter(status='PENDING').first()
        if not active_request:
            # No PENDING, check for REJECTED (user can reapply)
            active_request = queryset.filter(status='REJECTED').first()
        
        if active_request:
            serializer = self.get_serializer(active_request)
            return Response(serializer.data)
        else:
            # No active request found - return empty response
            return Response(None)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def perform_create(self, serializer):
        serializer.save()


        # Optionally send notification email to admin
        # from django.core.mail import send_mail
        # send_mail(
        #     "Permintaan Instructor Baru",
        #     f"User {self.request.user.full_name} mengajukan permintaan menjadi instructor",
        #     "system@lmsetjen.id",
        #     ["admin@lmsetjen.id"]
        # )


class InstructorRequestDetailAPIView(generics.RetrieveAPIView):
    """
    ✨ PHASE 4.78: Student view their own request status
    
    GET /api/v1/instructor-request/{request_id}/
    """
    serializer_class = api_serializer.InstructorRequestDetailSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Students can only see their own requests
        return api_models.InstructorRequest.objects.filter(user=self.request.user)
    
    def get_object(self):
        request_id = self.kwargs.get('request_id')
        queryset = self.get_queryset()
        return generics.get_object_or_404(queryset, id=request_id)




class RankedInstructorsAPIView(generics.ListAPIView):
    """
    API endpoint to retrieve ranked instructors by points.
    Supports filtering by period: lifetime, yearly, monthly
    ✨ PHASE 10.1: Ranking component integration
    """
    serializer_class = api_serializer.RankedInstructorSerializer
    permission_classes = [AllowAny]
    pagination_class = None
    
    def get_queryset(self):
        """Get top ranked instructors sorted by points"""
        period = self.kwargs.get('period', 'lifetime')
        from django.utils import timezone
        now = timezone.now()
        
        try:
            limit = int(self.request.query_params.get('limit', 25))
        except (TypeError, ValueError):
            limit = 25

        if period == 'yearly':
            queryset = api_models.InstructorPoints.objects.filter(
                yearly_year=now.year,
                yearly_points__gt=0
            ).order_by('-yearly_points')[:limit]
        elif period == 'monthly':
            queryset = api_models.InstructorPoints.objects.filter(
                monthly_year=now.year,
                monthly_month=now.month,
                monthly_points__gt=0
            ).order_by('-monthly_points')[:limit]
        else:  # lifetime
            queryset = api_models.InstructorPoints.objects.filter(
                lifetime_points__gt=0
            ).order_by('-lifetime_points')[:limit]
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        """Get ranked instructors with rank position"""
        period = self.kwargs.get('period', 'lifetime')
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # Add rank position to each result
        data = serializer.data
        for idx, item in enumerate(data, start=1):
            item['rank_position'] = idx
            if period == 'yearly':
                item['points'] = item.get('yearly_points', 0)
            elif period == 'monthly':
                item['points'] = item.get('monthly_points', 0)
            else:
                item['points'] = item.get('lifetime_points', 0)
            item['period'] = period
            
            # Determine rank badge
            if idx == 1:
                item['rank'] = "🥇"
            elif idx == 2:
                item['rank'] = "🥈"
            elif idx == 3:
                item['rank'] = "🥉"
            else:
                item['rank'] = f"#{idx}"
        
        return Response(data, status=status.HTTP_200_OK)





# ✨ PHASE 53 EXTENDED: Instructor Activities for Dashboard
class InstructorActivityPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_page_size(self, request):
        if 'page_size' in request.query_params:
            return super().get_page_size(request)
        # Fallback support for 'limit' query parameter
        if 'limit' in request.query_params:
            try:
                limit = int(request.query_params['limit'])
                if limit > 0:
                    return min(limit, self.max_page_size)
            except (ValueError, TypeError):
                pass
        return super().get_page_size(request)

    def get_page_number(self, request, paginator):
        if self.page_query_param in request.query_params:
            return super().get_page_number(request, paginator)
        # Fallback support for 'offset' query parameter when 'page' is not provided
        if 'offset' in request.query_params:
            try:
                offset = int(request.query_params['offset'])
                limit = self.get_page_size(request) or self.page_size
                if limit > 0 and offset >= 0:
                    return (offset // limit) + 1
            except (ValueError, TypeError):
                pass
        return super().get_page_number(request, paginator)

class InstructorActivitiesAPIView(generics.ListAPIView):
    """
    PHASE 53+: Hybrid Aktivitas Terbaru - Student + Instructor Activities
    
    GET /api/v1/instructor/activities/
    Dashboard endpoint showing BOTH instructor teaching activities AND student learning activities
    from all instructor's courses in chronological order
    
    Permissions:
    - Requires instructor/teacher role
    - Only shows activities from their own courses
    
    ✨ PHASE 53+ HYBRID UPDATE:
    - Shows student activities (role_at_time='student') - what students do
    - Shows instructor teaching activities (role_at_time='instructor') - what instructor creates/manages
    - Merged chronologically and visually distinguished in frontend
    """
    serializer_class = api_serializer.ActivityLogListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = InstructorActivityPagination
    
    def get_queryset(self):
        """Filter activities for instructor's courses - BOTH student and instructor activities"""
        user = self.request.user
        
        # Get all courses taught by this instructor
        courses = api_models.Course.objects.filter(teacher__user=user)
        
        # Get ALL activities in instructor's courses (REMOVED .exclude(user=user))
        # ✨ PHASE 53+ FIX: Show both:
        #   1. Student activities in these courses
        #   2. Instructor's own teaching activities for these courses
        # The role_at_time field distinguishes them at database level
        from django.db.models import Q
        queryset = api_models.ActivityLog.objects.filter(
            Q(course__in=courses) | Q(user=user, role_at_time='instructor')
        )
        
        # Filter by activity type
        activity_type = self.request.query_params.get('activity_type')
        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)
        
        # Filter by specific course
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        
        # Filter by specific user (for finding specific student or instructor activities)
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by success status
        success = self.request.query_params.get('success')
        if success:
            queryset = queryset.filter(success=success.lower() == 'true')
        
        # Filter by role (optional - can show only student or only instructor activities)
        role_filter = self.request.query_params.get('role')
        if role_filter and role_filter in ['student', 'instructor', 'admin', 'system']:
            queryset = queryset.filter(role_at_time=role_filter)

        # Filter by points awarded
        has_points = self.request.query_params.get('has_points')
        if has_points and has_points.lower() == 'true':
            queryset = queryset.filter(points_awarded__gt=0)

        # Filter by actionable (exam / integrity / quiz pending)
        actionable = self.request.query_params.get('actionable')
        if actionable and actionable.lower() == 'true':
            queryset = queryset.filter(
                Q(activity_type__in=['quiz_attempted', 'quiz_passed', 'exam_verified', 'grade_recorded']) |
                Q(title__icontains='ujian') |
                Q(description__icontains='ujian') |
                Q(title__icontains='integritas')
            )

        # Filter by search keyword
        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(course__title__icontains=search) |
                Q(user__full_name__icontains=search)
            )

        return queryset.order_by('-activity_date')





class InstructorCourseActivitiesAPIView(generics.ListAPIView):
    """
    PHASE 53+: Hybrid course activities - Student + Instructor activities for specific course
    
    GET /api/v1/instructor/course/<course_id>/activities/
    Shows BOTH student and instructor activities for a specific course
    """
    serializer_class = api_serializer.ActivityLogListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = InstructorActivityPagination
    
    def get_queryset(self):
        """Get both student and instructor activities for instructor's course"""
        course_id = self.kwargs.get('course_id')
        user = self.request.user
        
        try:
            # Get the course and verify instructor owns it
            course = api_models.Course.objects.get(id=course_id)
            # Verify current user is the teacher of this course
            if course.teacher and course.teacher.user != user:
                # Instructor doesn't own this course, return empty
                return api_models.ActivityLog.objects.none()
        except api_models.Course.DoesNotExist:
            return api_models.ActivityLog.objects.none()
        
        # Get ALL activities for this course (REMOVED .exclude(user=user))
        # ✨ PHASE 53+ FIX: Show both student and instructor teaching activities
        queryset = api_models.ActivityLog.objects.filter(
            course_id=course_id
        )
        
        # Filter by activity type
        activity_type = self.request.query_params.get('activity_type')
        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)
        
        # Filter by specific user (student or instructor)
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by role (optional)
        role_filter = self.request.query_params.get('role')
        if role_filter and role_filter in ['student', 'instructor', 'admin', 'system']:
            queryset = queryset.filter(role_at_time=role_filter)
        
        return queryset.order_by('-activity_date')





class InstructorActivityAnalyticsAPIView(APIView):
    """
    PHASE 53: Get activity analytics for instructor dashboard
    
    GET /api/v1/instructor/activities/analytics/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Verify user is instructor
        if not (user.role in ['instructor', 'teacher'] or getattr(user, 'is_instructor', False)):
            return Response({
                'error': 'Only instructors can access activity analytics'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get all courses taught by this instructor
        courses = api_models.Course.objects.filter(teacher__user=user)
        
        # Get activities for all courses taught
        all_activities = api_models.ActivityLog.objects.filter(course__in=courses)
        
        now = timezone.now()
        week_ago = now - timedelta(days=7)
        today = now.date()
        
        # Calculate overall stats
        total_student_activities = all_activities.count()
        activities_this_week = all_activities.filter(activity_date__gte=week_ago).count()
        
        # Average engagement score
        avg_engagement = all_activities.aggregate(
            avg=Avg('activity_score')
        )['avg'] or 0
        
        # Students active today
        students_active_today = all_activities.filter(
            activity_date__date=today
        ).values('user').distinct().count()
        
        # Completion rate (% of lessons/quizzes completed)
        total_completion_activities = all_activities.filter(
            activity_type__in=['lesson_completed', 'quiz_passed', 'course_completed']
        ).count()
        completion_rate = (total_completion_activities / total_student_activities * 100) if total_student_activities > 0 else 0
        
        # Course breakdown
        course_breakdown = []
        for course in courses:
            course_activities = all_activities.filter(course=course)
            enrollments = api_models.StudentCourseEnrollment.objects.filter(course=course)
            enrolled_count = enrollments.count()
            active_students = course_activities.values('user').distinct().count()
            
            course_avg_engagement = course_activities.aggregate(
                avg=Avg('activity_score')
            )['avg'] or 0
            
            course_breakdown.append({
                'course_id': course.id,
                'course_title': course.title,
                'total_activities': course_activities.count(),
                'enrolled_students': enrolled_count,
                'active_students': active_students,
                'avg_engagement': round(course_avg_engagement, 2)
            })
        
        # Recent student activities
        recent_activities = all_activities.order_by('-activity_date')[:10]
        
        data = {
            'total_student_activities': total_student_activities,
            'activities_this_week': activities_this_week,
            'avg_engagement_score': round(avg_engagement, 2),
            'students_active_today': students_active_today,
            'completion_rate': round(completion_rate, 2),
            'course_activity_breakdown': course_breakdown,
            'recent_student_activities': recent_activities
        }
        
        serializer = api_serializer.InstructorActivityStatsSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class InstructorPointsBreakdownAPIView(APIView):
    """
    GET /api/v1/instructor/points-breakdown/
    GET /api/v1/instructor/points-breakdown/?teacher_id=<id>&user_id=<id>
    
    Provides comprehensive breakdown of how an instructor earned points:
    - Lifetime, Yearly, and Monthly points
    - Categorized summary (published courses, student enrollments, student ratings/testimonials)
    - Full chronological history from PointsAuditLog
    - Clear rules explaining point awards
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        user = request.user if request.user.is_authenticated else None
        
        teacher_id = request.query_params.get('teacher_id')
        user_id = request.query_params.get('user_id')
        
        target_user = None
        target_teacher = None
        
        # Resolve target_user: check user_id first, then teacher_id (Teacher or InstructorPoints id), then request.user
        if user_id:
            target_user = api_models.User.objects.filter(id=user_id).first()
            if target_user:
                target_teacher = api_models.Teacher.objects.filter(user=target_user).first()
                
        if not target_user and teacher_id:
            target_teacher = api_models.Teacher.objects.filter(id=teacher_id).first()
            if target_teacher:
                target_user = target_teacher.user
            else:
                ip_rec = api_models.InstructorPoints.objects.filter(id=teacher_id).first()
                if ip_rec and ip_rec.user:
                    target_user = ip_rec.user
                    target_teacher = api_models.Teacher.objects.filter(user=target_user).first()
                    
        if not target_user and user:
            target_user = user
            target_teacher = api_models.Teacher.objects.filter(user=user).first()
            
        if not target_user:
            return Response(
                {"detail": "Instruktur / Pengguna tidak ditemukan"},
                status=status.HTTP_404_NOT_FOUND
            )
            
        # Self-healing synchronization: Check if teacher has published courses not yet in PointsAuditLog
        if target_user:
            published_courses = api_models.Course.objects.filter(
                teacher__user=target_user,
                is_published_version=True,
                platform_status='Published'
            )
            for pub_course in published_courses:
                has_audit = api_models.PointsAuditLog.objects.filter(
                    user=target_user,
                    points_type='instructor',
                    activity_type='course_published',
                    course_id=pub_course.id
                ).exists()
                if not has_audit:
                    api_models.InstructorPoints.add_points(
                        target_user,
                        100,
                        'course_published',
                        course_id=pub_course.id,
                        description=f"Publikasi Kursus: {pub_course.title}"
                    )
                    
        points_record = api_models.InstructorPoints.objects.filter(user=target_user).first()
        
        # Valid instructor point activity types in accordance with platform gamification rules
        VALID_INSTRUCTOR_ACTIVITIES = [
            'course_published',
            'student_enrollment',
            'student_rating',
            'platform_testimonial',
            'student_completion',
            'qa_answer',
            'exam_verification',
        ]
        
        from django.utils import timezone
        now = timezone.now()
        
        # Base queryset for valid instructor logs
        instructor_logs_qs = api_models.PointsAuditLog.objects.filter(
            user=target_user,
            points_type='instructor',
            activity_type__in=VALID_INSTRUCTOR_ACTIVITIES
        )
        
        # Self-healing synchronization: compute actual totals from audit logs
        lifetime_points_actual = sum(
            l.points_awarded for l in instructor_logs_qs
        )
        yearly_points_actual = sum(
            l.points_awarded for l in instructor_logs_qs.filter(awarded_at__year=now.year)
        )
        monthly_points_actual = sum(
            l.points_awarded for l in instructor_logs_qs.filter(
                awarded_at__year=now.year,
                awarded_at__month=now.month
            )
        )
        
        if points_record:
            if (points_record.lifetime_points != lifetime_points_actual or 
                points_record.yearly_points != yearly_points_actual or 
                points_record.monthly_points != monthly_points_actual):
                points_record.lifetime_points = lifetime_points_actual
                points_record.yearly_points = yearly_points_actual
                points_record.yearly_year = now.year
                points_record.monthly_points = monthly_points_actual
                points_record.monthly_year = now.year
                points_record.monthly_month = now.month
                points_record.save()
        
        # Filter audit logs and points based on period (lifetime, yearly, monthly)
        period = request.query_params.get('period', 'lifetime')
        
        if period == 'monthly':
            period_logs_qs = instructor_logs_qs.filter(
                awarded_at__year=now.year,
                awarded_at__month=now.month
            ).order_by('-awarded_at')
            current_period_points = monthly_points_actual
        elif period == 'yearly':
            period_logs_qs = instructor_logs_qs.filter(
                awarded_at__year=now.year
            ).order_by('-awarded_at')
            current_period_points = yearly_points_actual
        else:
            period = 'lifetime'
            period_logs_qs = instructor_logs_qs.order_by('-awarded_at')
            current_period_points = lifetime_points_actual
        
        # Get logs for the selected period
        all_logs = list(period_logs_qs)
        audit_logs = all_logs[:50]
        
        history = []
        for log in audit_logs:
            # Format friendly activity type display
            disp = log.get_activity_type_display()
            if log.activity_type == 'student_rating' and 'testimonial' in (log.description or '').lower():
                disp = "Testimoni Platform"
            elif log.activity_type == 'platform_testimonial':
                disp = "Testimoni Platform"
                
            clean_desc = (log.description or '').strip()
            if not clean_desc:
                clean_desc = f"{disp}: Perolehan Poin"

            history.append({
                'id': log.id,
                'activity_type': log.activity_type,
                'activity_type_display': disp,
                'points_awarded': log.points_awarded,
                'description': clean_desc,
                'course_id': log.course_id,
                'quiz_id': log.quiz_id,
                'review_id': log.review_id,
                'awarded_at': log.awarded_at,
            })
            
        # Summary counts by activity_type computed over audit logs of the selected period
        summary = {
            'course_published': {
                'points': sum(l.points_awarded for l in all_logs if l.activity_type == 'course_published'),
                'count': sum(1 for l in all_logs if l.activity_type == 'course_published')
            },
            'student_completion': {
                'points': sum(l.points_awarded for l in all_logs if l.activity_type == 'student_completion'),
                'count': sum(1 for l in all_logs if l.activity_type == 'student_completion')
            },
            'student_enrollment': {
                'points': sum(l.points_awarded for l in all_logs if l.activity_type == 'student_enrollment'),
                'count': sum(1 for l in all_logs if l.activity_type == 'student_enrollment')
            },
            'student_rating': {
                'points': sum(l.points_awarded for l in all_logs if l.activity_type == 'student_rating' and 'testimonial' not in (l.description or '').lower()),
                'count': sum(1 for l in all_logs if l.activity_type == 'student_rating' and 'testimonial' not in (l.description or '').lower())
            },
            'exam_verification': {
                'points': sum(l.points_awarded for l in all_logs if l.activity_type == 'exam_verification'),
                'count': sum(1 for l in all_logs if l.activity_type == 'exam_verification')
            },
            'qa_answer': {
                'points': sum(l.points_awarded for l in all_logs if l.activity_type == 'qa_answer'),
                'count': sum(1 for l in all_logs if l.activity_type == 'qa_answer')
            },
            'platform_testimonial': {
                'points': sum(l.points_awarded for l in all_logs if l.activity_type == 'platform_testimonial' or (l.activity_type == 'student_rating' and 'testimonial' in (l.description or '').lower())),
                'count': sum(1 for l in all_logs if l.activity_type == 'platform_testimonial' or (l.activity_type == 'student_rating' and 'testimonial' in (l.description or '').lower()))
            }
        }
        
        # Rank position in rankings
        rank_pos = None
        if lifetime_points_actual > 0:
            rank_pos = api_models.InstructorPoints.objects.filter(
                lifetime_points__gt=lifetime_points_actual
            ).count() + 1
            
        rules = [
            {
                'key': 'course_published',
                'title': 'Publikasi Kursus Baru',
                'points_text': '+100 Poin',
                'description': 'Diberikan otomatis setiap kursus Anda berhasil dipublikasikan untuk peserta.'
            },
            {
                'key': 'student_completion',
                'title': 'Kelulusan Peserta Kursus',
                'points_text': '+20 Poin / Peserta Lulus',
                'description': 'Diberikan setiap kali peserta berhasil menyelesaikan kursus Anda dan meraih sertifikat kompetensi.'
            },
            {
                'key': 'student_enrollment',
                'title': 'Pendaftaran Peserta Baru',
                'points_text': '+10 Poin',
                'description': 'Diberikan setiap kali seorang peserta mendaftar ke kursus yang Anda ajar.'
            },
            {
                'key': 'student_rating',
                'title': 'Ulasan & Rating Bintang',
                'points_text': '+10 s/d +50 Poin',
                'description': 'Diberikan saat peserta memberikan ulasan pada kursus Anda (1★ = 10 pt, 2★ = 20 pt, 3★ = 30 pt, 4★ = 40 pt, 5★ = 50 pt).'
            },
            {
                'key': 'exam_verification',
                'title': 'Pengesahan Integritas Ujian',
                'points_text': '+5 Poin',
                'description': 'Diberikan saat Anda memverifikasi dan mengesahkan rekaman integritas hasil ujian peserta.'
            },
            {
                'key': 'qa_answer',
                'title': 'Menjawab Diskusi Q&A',
                'points_text': '+5 Poin (Maks 30 pt/hari)',
                'description': 'Diberikan saat Anda aktif membimbing dan menjawab pertanyaan peserta di ruang diskusi materi.'
            },
            {
                'key': 'platform_contribution',
                'title': 'Testimoni & Kontribusi Platform',
                'points_text': '+20 Poin',
                'description': 'Diberikan sebagai apresiasi kontribusi testimoni dan feedback instruktur pada platform.'
            }
        ]
        
        return Response({
            'user_id': target_user.id,
            'teacher_name': target_user.get_full_name() or target_user.username,
            'period': period,
            'period_points': current_period_points,
            'lifetime_points': lifetime_points_actual,
            'yearly_points': yearly_points_actual,
            'monthly_points': monthly_points_actual,
            'rank_position': rank_pos,
            'summary': summary,
            'history': history,
            'rules': rules
        }, status=status.HTTP_200_OK)






class TeacherVerifyStudentIntegrityAPIView(APIView):
    """
    Instruktur memverifikasi atau menganulir status integritas ujian peserta kursus,
    serta memberikan izin penerbitan sertifikat atau mereset pengerjaan Post-Test yang terindikasi curang.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        try:
            course_id = request.data.get('course_id')
            user_id = request.data.get('user_id')
            action = request.data.get('action') # 'approve' | 'reject' | 'reset_post_test'
            notes = request.data.get('notes', '')

            user = request.user
            is_staff = getattr(user, 'is_staff', False) or getattr(user, 'is_admin', False)
            teacher = api_models.Teacher.objects.filter(user=user).first()

            course = api_models.Course.objects.filter(course_id=course_id).first()
            if not course:
                return Response({"error": "Kursus tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)

            related_course_ids = course.get_related_course_ids()
            if not is_staff and (not teacher or (course.teacher != teacher and not api_models.Course.objects.filter(id__in=related_course_ids, teacher=teacher).exists())):
                return Response({"error": "Akses ditolak. Anda bukan instruktur untuk kursus ini."}, status=status.HTTP_403_FORBIDDEN)

            target_student = User.objects.filter(id=user_id).first()
            if not target_student:
                return Response({"error": "Peserta tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)

            enrollment = api_models.EnrolledCourse.objects.filter(user=target_student, course_id__in=related_course_ids).first()
            if not enrollment:
                return Response({"error": "Data enrollment peserta tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)

            if action == 'approve':
                enrollment.manual_integrity_approved = True
                enrollment.integrity_status = 'verified'
                enrollment.integrity_notes = notes or f"Disahkan dan diverifikasi secara manual oleh Instruktur {user.full_name}."
                enrollment.save(update_fields=['manual_integrity_approved', 'integrity_status', 'integrity_notes'])

                # Update or validate existing certificate
                cert = api_models.Certificate.objects.filter(user=target_student, course_id__in=related_course_ids).first()
                if cert:
                    cert.is_valid = True
                    cert.integrity_status = 'verified'
                    cert.integrity_verified_by = user
                    cert.integrity_verified_at = timezone.now()
                    cert.save(update_fields=['is_valid', 'integrity_status', 'integrity_verified_by', 'integrity_verified_at'])

                # ✨ Notifikasi Otomatis ke Siswa & Instruktur
                try:
                    # 1. Notifikasi Siswa
                    api_models.Notification.objects.create(
                        user=target_student,
                        course=course,
                        type="Exam Verified", 
                        title=f"Hasil Ujian Disahkan - {course.title}",
                        message=f"Selamat! Hasil evaluasi ujian Anda untuk materi '{course.title}' telah diverifikasi dan disahkan oleh Instruktur {user.full_name}. Hak penerbitan sertifikat kelulusan telah dibuka.",
                        seen=False
                    )
                    api_models.ActivityLog.objects.create(
                        user=target_student,
                        activity_type='quiz_passed',
                        role_at_time='student',
                        course=course,
                        title=f"Hasil Ujian Disahkan: {course.title}",
                        description=f"Integritas ujian Post-Test telah disahkan secara resmi oleh Instruktur {user.full_name}.",
                        success=True,
                        metadata={'verified_by': user.full_name, 'action': 'approve', 'course_id': course.id}
                    )
                    # 2. Notifikasi & Log Instruktur
                    if teacher:
                        api_models.Notification.objects.create(
                            user=user,
                            teacher=teacher,
                            course=course,
                            type="Exam Verified", 
                            title=f"Pengesahan Ujian Berhasil: {target_student.full_name}",
                            message=f"Anda telah memverifikasi dan mengesahkan integritas hasil ujian peserta {target_student.full_name} pada materi '{course.title}'.",
                            seen=False
                        )
                    # Award +5 points to the instructor for exam verification
                    already_awarded = api_models.PointsAuditLog.objects.filter(
                        user=user,
                        points_type='instructor',
                        activity_type='exam_verification',
                        course_id=course.id,
                        description__icontains=f"User #{target_student.id}"
                    ).exists()
                    if not already_awarded:
                        inst_pts, _ = api_models.InstructorPoints.objects.get_or_create(
                            user=user,
                            defaults={'teacher': teacher}
                        )
                        inst_pts.add_points(
                            user,
                            5,
                            'exam_verification',
                            course_id=course.id,
                            description=f"Pengesahan integritas ujian peserta: {target_student.full_name} (User #{target_student.id}) pada {course.title}"
                        )
                        api_models.InstructorPoints.reconcile_points(user)

                    api_models.ActivityLog.objects.create(
                        user=user,
                        activity_type='grade_recorded',
                        role_at_time='instructor',
                        course=course,
                        title=f"Mengesahkan Ujian Peserta: {target_student.full_name}",
                        description=f"Memverifikasi integritas ujian {target_student.full_name} untuk kursus {course.title} (+5 Poin).",
                        points_awarded=5,
                        success=True,
                        metadata={'student_name': target_student.full_name, 'student_id': target_student.id, 'action': 'approve', 'course_id': course.id}
                    )
                except Exception as notif_e:
                    print(f"Error creating notification: {notif_e}")

                return Response({
                    "success": True,
                    "message": f"Hasil ujian {target_student.full_name} berhasil diverifikasi dan disahkan. Peserta kini berhak menerbitkan sertifikat.",
                    "integrity_status": "verified"
                }, status=status.HTTP_200_OK)

            elif action == 'reject':
                enrollment.manual_integrity_approved = False
                enrollment.integrity_status = 'rejected'
                enrollment.integrity_notes = notes or f"Dibatalkan oleh instruktur {user.full_name} karena indikasi pelanggaran integritas ujian."
                enrollment.save(update_fields=['manual_integrity_approved', 'integrity_status', 'integrity_notes'])

                cert = api_models.Certificate.objects.filter(user=target_student, course_id__in=related_course_ids).first()
                if cert:
                    cert.is_valid = False
                    cert.integrity_status = 'rejected'
                    cert.integrity_verified_by = user
                    cert.integrity_verified_at = timezone.now()
                    cert.save(update_fields=['is_valid', 'integrity_status', 'integrity_verified_by', 'integrity_verified_at'])

                # ✨ Notifikasi Otomatis Penolakan
                try:
                    api_models.Notification.objects.create(
                        user=target_student,
                        course=course,
                        type="Exam Rejected", 
                        title=f"Hasil Ujian Tidak Disahkan - {course.title}",
                        message=f"Hasil evaluasi ujian Anda untuk materi '{course.title}' tidak disahkan oleh Instruktur {user.full_name}. Catatan: {enrollment.integrity_notes}",
                        seen=False
                    )
                    if teacher:
                        api_models.Notification.objects.create(
                            user=user,
                            teacher=teacher,
                            course=course,
                            type="Exam Rejected", 
                            title=f"Penolakan Ujian: {target_student.full_name}",
                            message=f"Anda telah menolak integritas hasil ujian peserta {target_student.full_name} pada materi '{course.title}'.",
                            seen=False
                        )
                except Exception as notif_e:
                    print(f"Error creating notification: {notif_e}")

                return Response({
                    "success": True,
                    "message": f"Hasil ujian {target_student.full_name} ditolak. Sertifikat dibekukan.",
                    "integrity_status": "rejected"
                }, status=status.HTTP_200_OK)

            elif action == 'reset_post_test':
                pre_post_quiz = api_models.Quiz.objects.filter(course_id__in=related_course_ids, quiz_type='pre_post_test', is_active=True).first()
                if pre_post_quiz:
                    attempts = api_models.QuizAttempt.objects.filter(user=target_student, quiz=pre_post_quiz)
                    pre_att = attempts.filter(attempt_type='pre_test').first() or attempts.order_by('date_attempted').first()
                    post_attempts = attempts.filter(attempt_type='post_test')
                    if not post_attempts.exists() and attempts.count() >= 2:
                        post_attempts = attempts.exclude(id=pre_att.id if pre_att else None)
                    post_attempts.delete()

                enrollment.manual_integrity_approved = False
                enrollment.integrity_status = 'verified'
                enrollment.integrity_notes = "Ujian Post-test telah di-reset oleh Instruktur untuk kesempatan ujian ulang."
                enrollment.save(update_fields=['manual_integrity_approved', 'integrity_status', 'integrity_notes'])

                # Hapus sertifikat lama jika ada agar siswa harus lulus ulang
                api_models.Certificate.objects.filter(user=target_student, course_id__in=related_course_ids).delete()

                # ✨ Notifikasi Otomatis Reset Ujian
                try:
                    # 1. Notifikasi Siswa
                    api_models.Notification.objects.create(
                        user=target_student,
                        course=course,
                        type="Exam Reset", 
                        title=f"Ujian Post-Test Di-reset - {course.title}",
                        message=f"Ujian Post-Test Anda untuk materi '{course.title}' telah di-reset oleh Instruktur {user.full_name}. Kesempatan ujian ulang telah dibuka, silakan kerjakan kembali dengan tertib dan jujur.",
                        seen=False
                    )
                    api_models.ActivityLog.objects.create(
                        user=target_student,
                        activity_type='quiz_attempted',
                        role_at_time='student',
                        course=course,
                        title=f"Ujian Post-Test Di-reset: {course.title}",
                        description=f"Post-Test di-reset oleh Instruktur {user.full_name} untuk kesempatan ujian ulang.",
                        success=True,
                        metadata={'reset_by': user.full_name, 'action': 'reset_post_test', 'course_id': course.id}
                    )
                    # 2. Notifikasi & Log Instruktur
                    if teacher:
                        api_models.Notification.objects.create(
                            user=user,
                            teacher=teacher,
                            course=course,
                            type="Exam Reset", 
                            title=f"Reset Ujian: {target_student.full_name}",
                            message=f"Anda telah mereset percobaan Post-Test peserta {target_student.full_name} pada materi '{course.title}'.",
                            seen=False
                        )
                    api_models.ActivityLog.objects.create(
                        user=user,
                        activity_type='quiz_updated',
                        role_at_time='instructor',
                        course=course,
                        title=f"Reset Ujian Peserta: {target_student.full_name}",
                        description=f"Mereset percobaan Post-Test peserta {target_student.full_name} untuk kursus {course.title}.",
                        success=True,
                        metadata={'student_name': target_student.full_name, 'student_id': target_student.id, 'action': 'reset_post_test', 'course_id': course.id}
                    )
                except Exception as notif_e:
                    print(f"Error creating notification: {notif_e}")

                return Response({
                    "success": True,
                    "message": f"Ujian Post-Test {target_student.full_name} berhasil di-reset. Peserta kini dapat mengerjakan ulang tes dengan benar.",
                    "integrity_status": "reset"
                }, status=status.HTTP_200_OK)

            else:
                return Response({"error": "Aksi tidak dikenal (pilihan: approve, reject, reset_post_test)"}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({"error": f"Terjadi kesalahan: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TeacherNotificationMarkAllReadAPIView(APIView):
    """Tandai semua notifikasi instruktur sebagai telah dibaca (Anti-IDOR protected)"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request, teacher_id):
        try:
            teacher = api_models.Teacher.objects.filter(id=teacher_id).first()
            if not teacher:
                return Response({"error": "Instruktur tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
            
            if not request.user.is_staff and teacher.user != request.user:
                return Response({"error": "Akses ditolak"}, status=status.HTTP_403_FORBIDDEN)

            updated = api_models.Notification.objects.filter(teacher=teacher, seen=False).update(seen=True)
            return Response({"success": True, "updated_count": updated}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TeacherPendingVerificationsAPIView(APIView):
    """
    GET /api/v1/teacher/pending-verifications/<teacher_id>/
    
    Mengambil daftar ujian peserta yang menunggu verifikasi integritas oleh instruktur
    (integrity_status='pending_review' and manual_integrity_approved=False).
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request, teacher_id):
        user = request.user
        teacher = api_models.Teacher.objects.filter(id=teacher_id).first()
        if not teacher:
            teacher = api_models.Teacher.objects.filter(user=user).first()

        if not teacher:
            return Response({"pending_count": 0, "results": []}, status=status.HTTP_200_OK)

        is_staff = getattr(user, 'is_staff', False) or getattr(user, 'is_admin', False)
        if teacher.user != user and not is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Akses ditolak.")

        # Ambil kursus yang diampu instruktur ini
        courses = api_models.Course.objects.filter(teacher=teacher)
        
        # Ambil peserta yang berstatus pending_review integritas ujian
        pending_enrollments = api_models.EnrolledCourse.objects.filter(
            course__in=courses,
            integrity_status='pending_review',
            manual_integrity_approved=False
        ).select_related('user', 'course', 'user__profile').order_by('-date')

        results = []
        for e in pending_enrollments:
            std = e.user
            results.append({
                'enrollment_id': e.id,
                'user_id': std.id if std else None,
                'student_name': std.full_name or std.username if std else "Peserta",
                'student_email': std.email if std else "",
                'student_image': std.profile.image.url if (std and hasattr(std, 'profile') and std.profile and std.profile.image) else None,
                'course_id': e.course.course_id or str(e.course.id),
                'course_title': e.course.title,
                'integrity_status': e.integrity_status,
                'integrity_notes': e.integrity_notes or "Terdeteksi anomali pada rekaman ujian post-test",
                'date': e.date,
                'evaluation_url': f"/instructor/courses/{e.course.course_id or e.course.id}/evaluation/"
            })

        return Response({
            "pending_count": len(results),
            "results": results
        }, status=status.HTTP_200_OK)


class TeacherCourseExportRecapAPIView(APIView):
    """
    Ekspor Laporan Rekapitulasi Pelatihan & Kehadiran Pegawai/Peserta ke file Excel (.xlsx).
    Kop Dokumen Resmi Sekretariat Jenderal DPD RI dengan statistik evaluasi, efektivitas belajar,
    status integritas ujian, dan lembar evaluasi kepuasan peserta.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request, course_id):
        import io
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
        from api.views.student import CourseLeaderboardAPIView

        # 1. Resolusi course & validasi hak akses
        course = None
        if str(course_id).isdigit():
            course = api_models.Course.objects.filter(id=int(course_id)).first()
        if not course:
            course = api_models.Course.objects.filter(course_id=str(course_id)).first()
        if not course:
            course = api_models.Course.objects.filter(slug=str(course_id)).first()

        if not course:
            return Response({"error": "Kursus tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_staff = getattr(user, 'is_staff', False) or getattr(user, 'is_admin', False)
        teacher = api_models.Teacher.objects.filter(user=user).first()
        related_course_ids = course.get_related_course_ids() if hasattr(course, 'get_related_course_ids') else {course.id}

        if not is_staff and (not teacher or (course.teacher != teacher and not api_models.Course.objects.filter(id__in=related_course_ids, teacher=teacher).exists())):
            return Response({"error": "Akses ditolak. Anda bukan instruktur untuk kursus ini."}, status=status.HTTP_403_FORBIDDEN)

        # 2. Ambil data analitik & leaderboard dari CourseLeaderboardAPIView
        lb_view = CourseLeaderboardAPIView()
        lb_response = lb_view.get(request, course_id)
        if lb_response.status_code != 200:
            return Response({"error": "Gagal mengagregasi data rekapitulasi kursus"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        data = lb_response.data
        leaderboard = data.get("leaderboard", [])
        evaluation = data.get("evaluation", {})
        total_students = len(leaderboard)
        completed_students = sum(1 for s in leaderboard if s.get("completion_stats", {}).get("is_completed"))
        completion_pct = round((completed_students / total_students * 100), 1) if total_students > 0 else 0.0

        # Hitung JP
        total_jp = 0
        try:
            lectures = course.lectures() if callable(getattr(course, 'lectures', None)) else getattr(course, 'lectures', [])
            total_sec = sum(l.content_duration_seconds for l in lectures if hasattr(l, 'content_duration_seconds') and l.content_duration_seconds)
            total_jp = max(1, (total_sec + 2699) // 2700) if total_sec else 2
        except Exception:
            total_jp = 2

        # 3. Bangun Workbook Excel
        wb = openpyxl.Workbook()
        
        # Styles
        font_header_title = Font(name="Calibri", size=13, bold=True, color="0F766E")
        font_instansi = Font(name="Calibri", size=11, bold=True, color="1E293B")
        font_meta_lbl = Font(name="Calibri", size=10, bold=True, color="334155")
        font_meta_val = Font(name="Calibri", size=10, color="0F172A")
        
        font_th = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
        fill_th = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")
        fill_alt = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
        fill_white = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
        
        border_thin = Border(
            left=Side(style='thin', color='CBD5E1'),
            right=Side(style='thin', color='CBD5E1'),
            top=Side(style='thin', color='CBD5E1'),
            bottom=Side(style='thin', color='CBD5E1')
        )
        border_th = Border(
            left=Side(style='thin', color='0D665F'),
            right=Side(style='thin', color='0D665F'),
            top=Side(style='medium', color='0D665F'),
            bottom=Side(style='medium', color='0D665F')
        )
        
        align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
        align_left = Alignment(horizontal="left", vertical="center")
        align_right = Alignment(horizontal="right", vertical="center")

        # ----------------- SHEET 1: REKAPITULASI PELATIHAN -----------------
        ws1 = wb.active
        ws1.title = "Rekapitulasi Pelatihan"
        ws1.views.sheetView[0].showGridLines = True

        # Kop Instansi
        ws1.merge_cells("A1:U1")
        ws1["A1"] = "SEKRETARIAT JENDERAL DEWAN PERWAKILAN DAERAH REPUBLIK INDONESIA"
        ws1["A1"].font = font_instansi
        ws1["A1"].alignment = align_center

        ws1.merge_cells("A2:U2")
        ws1["A2"] = "BIRO ORGANISASI KEANGGOTAAN DAN KEPEGAWAIAN (LMS SETJEN DPD RI)"
        ws1["A2"].font = Font(name="Calibri", size=10, bold=True, color="475569")
        ws1["A2"].alignment = align_center

        ws1.merge_cells("A3:U3")
        ws1["A3"] = "LAPORAN REKAPITULASI EVALUASI PELATIHAN & KEHADIRAN PEGAWAI"
        ws1["A3"].font = font_header_title
        ws1["A3"].alignment = align_center

        # Metadata Kursus
        ws1["A5"] = "Judul Pelatihan:"
        ws1["A5"].font = font_meta_lbl
        ws1["B5"] = course.title
        ws1["B5"].font = Font(name="Calibri", size=10, bold=True)

        ws1["A6"] = "Instruktur:"
        ws1["A6"].font = font_meta_lbl
        ws1["B6"] = course.teacher.user.get_full_name() if (course.teacher and course.teacher.user) else "-"
        ws1["B6"].font = font_meta_val

        ws1["A7"] = "Beban Jam Pelajaran:"
        ws1["A7"].font = font_meta_lbl
        ws1["B7"] = f"{total_jp} JP"
        ws1["B7"].font = font_meta_val

        ws1["G5"] = "Kategori / Tingkat:"
        ws1["G5"].font = font_meta_lbl
        ws1["H5"] = f"{getattr(course.category, 'title', '-')} ({course.level or 'Semua Tingkat'})"
        ws1["H5"].font = font_meta_val

        ws1["G6"] = "Total Peserta / Kelulusan:"
        ws1["G6"].font = font_meta_lbl
        ws1["H6"] = f"{total_students} Pegawai ({completed_students} Tuntas - {completion_pct}%)"
        ws1["H6"].font = font_meta_val

        ws1["G7"] = "Waktu Unduh Rekap:"
        ws1["G7"].font = font_meta_lbl
        ws1["H7"] = timezone.now().strftime("%d %B %Y %H:%M WIB")
        ws1["H7"].font = font_meta_val

        # Headers Tabel Peserta
        headers1 = [
            "No", "Peringkat", "NIP", "Nama Pegawai", "Unit Kerja", "Jabatan", "Gol.",
            "Tgl Terdaftar", "Tgl Selesai", "Durasi Belajar", "Status Ketuntasan",
            "Pre-Test", "Post-Test", "Peningkatan", "N-Gain (%)", "Efektivitas Belajar",
            "Rata-rata Kuis", "Skor Gamifikasi", "Total Poin (XP)", "Status Integritas Ujian", "No. Sertifikat"
        ]

        row_th = 9
        for col_idx, h in enumerate(headers1, start=1):
            cell = ws1.cell(row=row_th, column=col_idx, value=h)
            cell.font = font_th
            cell.fill = fill_th
            cell.alignment = align_center
            cell.border = border_th
        ws1.row_dimensions[row_th].height = 28

        # Isi Baris Data Peserta
        for idx, s in enumerate(leaderboard, start=1):
            r_idx = row_th + idx
            emp = s.get("employee_info", {})
            ls = s.get("learning_stats", {})
            cs = s.get("completion_stats", {})
            qs = s.get("quiz_stats", {})
            gs = s.get("gamification_stats", {})
            integ = s.get("integrity_check", {})

            # Dates
            st_date = cs.get("start_time")
            st_fmt = st_date[:10] if isinstance(st_date, str) and len(st_date) >= 10 else "-"
            fn_date = cs.get("finish_time")
            fn_fmt = fn_date[:10] if isinstance(fn_date, str) and len(fn_date) >= 10 else ("-" if not cs.get("is_completed") else "Tuntas")

            # Status Ketuntasan
            status_tuntas = "Tuntas" if cs.get("is_completed") else "Sedang Belajar"

            # Integritas
            is_valid_int = integ.get("is_valid", True)
            is_manual = integ.get("is_manual_approved", False)
            if is_manual:
                integ_txt = "Disahkan Manual"
            elif is_valid_int:
                integ_txt = "Valid"
            else:
                integ_txt = "Perlu Investigasi"

            row_vals = [
                idx,
                f"#{idx}",
                emp.get("nip", "-"),
                s.get("full_name", s.get("username", "-")),
                emp.get("unit_kerja", "-"),
                emp.get("jabatan", "-"),
                emp.get("golongan", "-"),
                st_fmt,
                fn_fmt,
                cs.get("duration_human", "-"),
                status_tuntas,
                ls.get("pre_score") if ls.get("pre_score") is not None else "-",
                ls.get("post_score") if ls.get("post_score") is not None else "-",
                f"+{ls.get('improvement', 0)}" if ls.get("has_pre") and ls.get("has_post") else "-",
                f"{ls.get('normalized_gain', 0)}%" if ls.get("has_pre") and ls.get("has_post") else "-",
                ls.get("status", "-"),
                qs.get("avg_score", 0),
                gs.get("points", 0),
                s.get("total_points", 0),
                integ_txt,
                integ.get("certificate_id") or "-"
            ]

            fill_row = fill_white if idx % 2 == 0 else fill_alt
            for col_idx, val in enumerate(row_vals, start=1):
                cell = ws1.cell(row=r_idx, column=col_idx, value=val)
                cell.font = Font(name="Calibri", size=9.5)
                cell.fill = fill_row
                cell.border = border_thin
                
                # Alignments
                if col_idx in [1, 2, 8, 9, 10, 11, 12, 13, 14, 15, 20]:
                    cell.alignment = align_center
                elif col_idx in [17, 18, 19]:
                    cell.alignment = align_right
                else:
                    cell.alignment = align_left

            ws1.row_dimensions[r_idx].height = 20

        # Freeze Panes
        ws1.freeze_panes = "A10"

        # Auto-adjust column widths
        for col in ws1.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                # ignore merged title rows
                if cell.row < 9:
                    continue
                val_str = str(cell.value or "")
                if len(val_str) > max_len:
                    max_len = len(val_str)
            ws1.column_dimensions[col_letter].width = max(max_len + 4, 12)

        # ----------------- SHEET 2: EVALUASI KEPUASAN & REVIEW -----------------
        ws2 = wb.create_sheet(title="Evaluasi Kepuasan")
        ws2.views.sheetView[0].showGridLines = True

        ws2.merge_cells("A1:E1")
        ws2["A1"] = "EVALUASI KEPUASAN & MASUKAN PESERTA PELATIHAN"
        ws2["A1"].font = font_header_title
        ws2["A1"].alignment = align_center

        ws2["A3"] = "Rata-rata Penilaian:"
        ws2["A3"].font = font_meta_lbl
        ws2["B3"] = f"{evaluation.get('average_rating', 0)} / 5.0 Bintang"
        ws2["B3"].font = font_meta_val

        ws2["A4"] = "Tingkat Kepuasan Peserta:"
        ws2["A4"].font = font_meta_lbl
        ws2["B4"] = f"{evaluation.get('satisfaction_rate', 0)}%"
        ws2["B4"].font = font_meta_val

        ws2["A5"] = "Total Masukan Masuk:"
        ws2["A5"].font = font_meta_lbl
        ws2["B5"] = f"{evaluation.get('total_reviews', 0)} Ulasan"
        ws2["B5"].font = font_meta_val

        headers2 = ["No", "Nama Peserta", "Rating (Bintang)", "Tanggal", "Ulasan & Masukan Pegawai"]
        row_th2 = 7
        for col_idx, h in enumerate(headers2, start=1):
            cell = ws2.cell(row=row_th2, column=col_idx, value=h)
            cell.font = font_th
            cell.fill = fill_th
            cell.alignment = align_center
            cell.border = border_th
        ws2.row_dimensions[row_th2].height = 26

        reviews = evaluation.get("reviews", [])
        for idx, rev in enumerate(reviews, start=1):
            r_idx = row_th2 + idx
            r_vals = [
                idx,
                rev.get("full_name", "-"),
                f"{rev.get('rating', 0)} Bintang",
                rev.get("date", "-"),
                rev.get("review", "-")
            ]
            fill_row = fill_white if idx % 2 == 0 else fill_alt
            for col_idx, val in enumerate(r_vals, start=1):
                cell = ws2.cell(row=r_idx, column=col_idx, value=val)
                cell.font = Font(name="Calibri", size=9.5)
                cell.fill = fill_row
                cell.border = border_thin
                if col_idx in [1, 3, 4]:
                    cell.alignment = align_center
                else:
                    cell.alignment = align_left

            ws2.row_dimensions[r_idx].height = 22

        for col in ws2.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                if cell.row < 7:
                    continue
                val_str = str(cell.value or "")
                if len(val_str) > max_len:
                    max_len = len(val_str)
            ws2.column_dimensions[col_letter].width = min(max(max_len + 4, 12), 60)

        # 4. Generate Output Buffer
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        clean_title = "".join(c for c in course.title if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')[:35]
        timestamp = timezone.now().strftime("%Y%m%d_%H%M")
        filename = f"Rekapitulasi_Pelatihan_{clean_title}_{timestamp}.xlsx"

        # ✨ PHASE 65: Catat Log Ekspor Rekapitulasi Nilai & Kehadiran Excel
        try:
            api_models.ActivityLog.objects.create(
                user=request.user,
                activity_type='grades_exported',
                role_at_time='instructor',
                course=course,
                title=f"Ekspor Rekap Nilai: {course.title}",
                description=f"Mengunduh rekapitulasi nilai dan kehadiran pelatihan '{course.title}' ke format Excel ({filename}).",
                success=True,
                metadata={
                    'course_id': str(course.id),
                    'course_title': course.title,
                    'filename': filename,
                    'exported_at': str(timezone.now())
                }
            )
        except Exception as log_e:
            print(f"[ActivityLog] Error logging grade export: {log_e}")

        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


# ============================================================================
# ✨ INSTRUCTOR COURSE CERTIFICATE TEMPLATE MANAGEMENT
# ============================================================================

@method_decorator(csrf_exempt, name='dispatch')
class TeacherCourseCertificateTemplateAPIView(APIView):
    """
    Endpoint Instruktur untuk membaca dan mengelola template sertifikat khusus per kursus.
    Jika 'use_system_default' bernilai True, kursus otomatis menggunakan sertifikat default sistem LMSetjen DPD RI.
    Jika 'use_system_default' bernilai False, kursus menggunakan kustomisasi yang dibuat instruktur.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def _get_course_and_verify(self, request, course_id):
        try:
            course = api_models.Course.objects.get(course_id=course_id)
        except api_models.Course.DoesNotExist:
            return None, Response({'error': 'Kursus tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        is_admin = getattr(request.user, 'is_admin', False) or getattr(request.user, 'is_staff', False)
        if course.teacher.user != request.user and not is_admin:
            return None, Response({'error': 'Akses ditolak. Anda bukan instruktur pengampu kursus ini.'}, status=status.HTTP_403_FORBIDDEN)

        return course, None

    def get(self, request, course_id):
        course, err_response = self._get_course_and_verify(request, course_id)
        if err_response:
            return err_response

        template = getattr(course, 'certificate_template', None)
        system_default = api_models.CertificateTemplateConfig.get_active_config()
        effective_template = api_models.CertificateTemplateConfig.get_template_for_course(course)

        data = {
            'use_system_default': template.use_system_default if template else True,
            'template': api_serializer.CertificateTemplateConfigSerializer(template, context={'request': request}).data if template else None,
            'effective_template': api_serializer.CertificateTemplateConfigSerializer(effective_template, context={'request': request}).data,
            'system_default': api_serializer.CertificateTemplateConfigSerializer(system_default, context={'request': request}).data,
            'course': {
                'id': course.id,
                'course_id': course.course_id,
                'title': course.title,
                'slug': course.slug,
                'level': course.level,
                'category': course.category.title if course.category else 'Umum',
                'teacher_name': course.teacher.full_name if course.teacher else '',
            }
        }
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request, course_id):
        course, err_response = self._get_course_and_verify(request, course_id)
        if err_response:
            return err_response

        template, created = api_models.CertificateTemplateConfig.objects.get_or_create(
            course=course,
            defaults={
                'template_name': f"Template Khusus - {course.title[:40]}",
                'use_system_default': False,
                'is_active': True,
            }
        )

        data = request.data
        use_default_val = data.get('use_system_default')
        if use_default_val is not None:
            if isinstance(use_default_val, str):
                template.use_system_default = use_default_val.lower() in ('true', '1', 'yes')
            else:
                template.use_system_default = bool(use_default_val)

        # Update styling fields
        text_fields = [
            'template_name', 'primary_color', 'accent_color', 'title_font', 'body_font',
            'agency_sup', 'agency_main', 'agency_sub',
            'certificate_title', 'certificate_subtitle', 'statement_text',
            'signatory_title', 'signatory_sub_title', 'signatory_name', 'signatory_nip',
            'instructor_title'
        ]
        for f in text_fields:
            if f in data and data[f] is not None:
                setattr(template, f, data[f])

        # Boolean toggles
        bool_fields = ['show_gold_seal', 'show_watermark', 'show_bpsdm_logo', 'show_qr_code', 'show_instructor_signature', 'is_active']
        for f in bool_fields:
            if f in data:
                val = data[f]
                if isinstance(val, str):
                    setattr(template, f, val.lower() in ('true', '1', 'yes'))
                else:
                    setattr(template, f, bool(val))

        # Handle PPTX template upload
        pptx_feedback = None
        if 'pptx_template' in request.FILES:
            uploaded_pptx = request.FILES['pptx_template']
            template.pptx_template = uploaded_pptx
            try:
                from api.certificate_template_generator import inspect_pptx_placeholders
                pptx_feedback = inspect_pptx_placeholders(uploaded_pptx)
            except Exception as e:
                logger.warning(f"Could not inspect PPTX placeholders: {e}")

        # Handle custom background upload
        if 'custom_background' in request.FILES:
            template.custom_background = request.FILES['custom_background']
        elif data.get('remove_custom_background') in (True, 'true', '1'):
            if template.custom_background:
                template.custom_background.delete(save=False)
            template.custom_background = None

        # Handle instructor signature upload
        if 'instructor_signature_image' in request.FILES:
            template.instructor_signature_image = request.FILES['instructor_signature_image']
        elif data.get('remove_instructor_signature') in (True, 'true', '1'):
            if template.instructor_signature_image:
                template.instructor_signature_image.delete(save=False)
            template.instructor_signature_image = None

        template.save()

        effective = api_models.CertificateTemplateConfig.get_template_for_course(course)
        return Response({
            'message': 'Konfigurasi template sertifikat kursus berhasil disimpan.',
            'use_system_default': template.use_system_default,
            'template': api_serializer.CertificateTemplateConfigSerializer(template, context={'request': request}).data,
            'effective_template': api_serializer.CertificateTemplateConfigSerializer(effective, context={'request': request}).data,
            'pptx_feedback': pptx_feedback
        }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class TeacherCourseCertificateTemplateResetAPIView(APIView):
    """Reset template sertifikat kursus agar kembali menggunakan default sistem LMSetjen DPD RI."""
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request, course_id):
        try:
            course = api_models.Course.objects.get(course_id=course_id)
        except api_models.Course.DoesNotExist:
            return Response({'error': 'Kursus tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        is_admin = getattr(request.user, 'is_admin', False) or getattr(request.user, 'is_staff', False)
        if course.teacher.user != request.user and not is_admin:
            return Response({'error': 'Akses ditolak.'}, status=status.HTTP_403_FORBIDDEN)

        template = getattr(course, 'certificate_template', None)
        if template:
            template.use_system_default = True
            template.save()

        default_config = api_models.CertificateTemplateConfig.get_active_config()
        return Response({
            'message': 'Template sertifikat kursus berhasil di-reset ke Default Sistem LMSetjen DPD RI.',
            'use_system_default': True,
            'effective_template': api_serializer.CertificateTemplateConfigSerializer(default_config, context={'request': request}).data
        }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class TeacherCourseCertificateTemplateDownloadPPTXAPIView(APIView):
    """Download master PowerPoint (.pptx) template yang disesuaikan untuk kursus ini."""
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request, course_id):
        try:
            course = api_models.Course.objects.get(course_id=course_id)
        except api_models.Course.DoesNotExist:
            return Response({'error': 'Kursus tidak ditemukan'}, status=status.HTTP_404_NOT_FOUND)

        try:
            from api.certificate_template_generator import create_default_certificate_pptx
            effective_config = api_models.CertificateTemplateConfig.get_template_for_course(course)
            pptx_stream = create_default_certificate_pptx(config=effective_config, course=course)

            clean_title = "".join(c for c in course.title if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')[:30]
            filename = f"Master_Template_Sertifikat_{clean_title}_{course.course_id}.pptx"

            response = HttpResponse(
                pptx_stream.getvalue(),
                content_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response
        except Exception as e:
            logger.error(f"[TeacherCourseCertificatePPTX] Error generating PPTX: {e}")
            return Response({'error': f'Gagal menghasilkan master PPTX: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
