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

from api.permissions import IsAdminUser
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
            is_admin = getattr(self.request.user, 'is_admin', False)
            if course.teacher.user != self.request.user and not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Akses ditolak. Anda tidak memiliki izin memodifikasi kursus ini.")

            # [*] PHASE 4.76: CRITICAL - Enforce draft-only editing
            # If trying to edit a published course, return error
            # Instructor must use "Edit Versi Terbaru" to create a draft first
            if course.is_published_version:
                # 🔒 SECURITY: Use logging instead of print
                import logging
                logger = logging.getLogger('api')
                logger.warning(f"[Teacher Course Detail] [FAIL] Attempt to edit published course directly: {course.title}")
                # Return None to signal published course (will be handled in get method)
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
            
            # Check if this is a published course access attempt
            if hasattr(course, '_is_published_version_attempt') and course._is_published_version_attempt:
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
    serializer_class = api_serializer.TeacherSummarySerializer
    permission_classes = [AllowAny]

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
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [AllowAny]
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
    permission_classes = [AllowAny]
    authentication_classes = []

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
    permission_classes = [AllowAny]
    
    def list(self, request, teacher_id=None):
        try:
            # Handle case where teacher_id is 0 or invalid
            if not teacher_id or teacher_id == 0:
                return Response([])
            
            teacher = api_models.Teacher.objects.get(id=teacher_id)

            enrolled_courses = api_models.EnrolledCourse.objects.filter(teacher=teacher)
            unique_student_ids = set()
            students = []

            for course in enrolled_courses:
                if course.user_id not in unique_student_ids:
                    try:
                        user = User.objects.get(id=course.user_id)
                        
                        # Safely get profile data with fallbacks
                        full_name = None
                        image_url = None
                        country = None
                        
                        # Try to get profile, handle if it doesn't exist
                        if hasattr(user, 'profile'):
                            profile = user.profile
                            full_name = profile.full_name if profile.full_name else None
                            country = profile.country if profile.country else None
                            
                            # Safely get image path (not .url to avoid double /media/ prefix)
                            if profile.image:
                                try:
                                    # Return just the path (e.g., 'user_folder/pic.jpg')
                                    # Frontend's getMediaUrl() will add /media/ prefix
                                    image_url = str(profile.image)
                                except:
                                    image_url = None
                        
                        # Fallback to User model fields if profile doesn't have data
                        if not full_name:
                            if hasattr(user, 'full_name') and user.full_name:
                                full_name = user.full_name
                            elif hasattr(user, 'username') and user.username:
                                full_name = user.username
                            else:
                                # Last resort: use first name + last name or email
                                if user.first_name or user.last_name:
                                    full_name = f"{user.first_name} {user.last_name}".strip()
                                elif user.email:
                                    full_name = user.email.split('@')[0]
                                else:
                                    full_name = f"Student {user.id}"
                        
                        student = {
                            "user_id": user.id,
                            "full_name": full_name,
                            "image": image_url,
                            "country": country,
                            "date": course.date,
                            "email": user.email if hasattr(user, 'email') else None
                        }

                        students.append(student)
                        unique_student_ids.add(course.user_id)
                    except User.DoesNotExist:
                        print(f"User with ID {course.user_id} not found")
                        continue
                    except Exception as e:
                        print(f"Error processing student {course.user_id}: {str(e)}")
                        continue

            return Response(students)
        except api_models.Teacher.DoesNotExist:
            return Response({'error': 'Teacher not found'}, status=404)
        except Exception as e:
            print(f"Error in TeacherStudentsListAPIView: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=500)



class TeacherBestSellingCourseAPIView(viewsets.ViewSet):
    permission_classes = [AllowAny]

    def list(self, request, teacher_id=None):
        try:
            # Handle case where teacher_id is 0 or invalid
            if not teacher_id or teacher_id == 0:
                return Response([])
            
            from .url_utils import clean_and_process_image_url
            
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
                    'id': course.id,  # ✨ Add ID for identification
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
    permission_classes = [AllowAny]

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
    permission_classes = [AllowAny]

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
    permission_classes = [AllowAny]

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
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_object(self):
        teacher_id = self.kwargs['teacher_id']
        noti_id = self.kwargs['noti_id']
        teacher = api_models.Teacher.objects.get(id=teacher_id)
        return api_models.Notification.objects.get(teacher=teacher, id=noti_id)




@method_decorator(csrf_exempt, name='dispatch')
class TeacherCreateFromProfileAPIView(APIView):
    """
    Teacher Profile Creation API
    
    CSRF exempt because:
    - Uses JWT authentication for teacher operations
    - Creates teacher profile from user profile
    - Secured by JWT token validation
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        try:
            user_id = request.data.get('user_id')
            if not user_id:
                return Response({'error': 'User ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
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
      Hanya pemilik akun guru atau admin/staff yang berhak melihat profil internal pengajar.
    """
    serializer_class = api_serializer.BasicTeacherSerializer
    permission_classes = [IsAuthenticated]
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
            raise PermissionDenied("Anda tidak memiliki izin untuk mengakses profil pengajar ini.")
        
        teacher = api_models.Teacher.objects.filter(user_id=user_id).first()
        if not teacher:
            # If teacher doesn't exist, create one from profile
            try:
                from userauths.models import Profile
                profile = Profile.objects.get(user_id=user_id)
                teacher = api_models.Teacher.create_from_profile(profile.user)
            except Profile.DoesNotExist:
                raise Http404("Data pengajar tidak ditemukan.")
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
    - Anti-IDOR Object-Level Authorization:
      Hanya pemilik akun pengajar atau admin/staff yang dapat mengubah data profil.
    """
    permission_classes = [IsAuthenticated]
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
                    {'error': 'Anda tidak memiliki izin untuk mengubah profil pengajar ini.'},
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
            teacher_fields = ['bio', 'facebook', 'twitter', 'linkedin']
            for field in teacher_fields:
                if field in request.data:
                    setattr(teacher, field, request.data[field])
            
            teacher.save()
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
        
        if period == 'yearly':
            queryset = api_models.InstructorPoints.objects.filter(
                yearly_points__gt=0
            ).order_by('-yearly_points')[:10]
        elif period == 'monthly':
            queryset = api_models.InstructorPoints.objects.filter(
                monthly_points__gt=0
            ).order_by('-monthly_points')[:10]
        else:  # lifetime
            queryset = api_models.InstructorPoints.objects.filter(
                lifetime_points__gt=0
            ).order_by('-lifetime_points')[:10]
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        """Get ranked instructors with rank position"""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # Add rank position to each result
        data = serializer.data
        for idx, item in enumerate(data, start=1):
            item['rank_position'] = idx
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
    pagination_class = PageNumberPagination
    
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
        queryset = api_models.ActivityLog.objects.filter(
            course__in=courses
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
        
        return queryset.order_by('-activity_date')





class InstructorCourseActivitiesAPIView(generics.ListAPIView):
    """
    PHASE 53+: Hybrid course activities - Student + Instructor activities for specific course
    
    GET /api/v1/instructor/course/<course_id>/activities/
    Shows BOTH student and instructor activities for a specific course
    """
    serializer_class = api_serializer.ActivityLogListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination
    
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




