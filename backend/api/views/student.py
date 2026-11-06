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
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
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


class StudentSummaryAPIView(generics.ListAPIView):
    """
    Student Academic Summary API (Mengatasi H-01 IDOR)
    
    Menampilkan ringkasan kursus yang diikuti, pelajaran selesai, dan sertifikat diraih.
    Secured with:
    - JWT authentication (IsAuthenticated)
    - Anti-IDOR Permission (IsOwnerOrStaff):
      Student hanya dapat melihat summary akademik miliknya sendiri,
      kecuali pengguna memiliki hak akses admin/staff.
    """
    serializer_class = api_serializer.StudentSummarySerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise Http404("User tidak ditemukan.")

        total_courses = api_models.EnrolledCourse.objects.filter(user=user, course__platform_status='Published').count()
        completed_lessons = api_models.CompletedLesson.objects.filter(user=user, course__platform_status='Published').count()
        achieved_certificates = api_models.Certificate.objects.filter(user=user).count()

        return [{
            "total_courses": total_courses,
            "completed_lessons": completed_lessons,
            "achieved_certificates": achieved_certificates,
        }]
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        user_id = self.kwargs.get('user_id')
        course_id = self.kwargs.get('course_id')
        is_pretest_locked = False
        if user_id and course_id:
            try:
                user = User.objects.get(id=user_id)
                course = api_models.Course.objects.filter(course_id=course_id).first()
                if course:
                    pre_post_quiz = api_models.Quiz.objects.filter(course=course, quiz_type='pre_post_test', is_active=True).first()
                    if pre_post_quiz:
                        has_pre = api_models.QuizAttempt.objects.filter(user=user, quiz=pre_post_quiz, attempt_type='pre_test').exists()
                        is_pretest_locked = not has_pre
            except Exception:
                pass

        data = list(serializer.data)
        for item in data:
            item['is_pretest_locked'] = is_pretest_locked
        return Response(data)
    



class StudentCourseListAPIView(generics.ListAPIView):
    """
    Student Enrolled Courses List API (Mengatasi Temuan Pentest H-01 IDOR)
    
    Secured with:
    - JWT authentication (IsAuthenticated)
    - Anti-IDOR Permission (IsOwnerOrStaff):
      Student hanya dapat melihat daftar kursus miliknya sendiri,
      kecuali pengguna memiliki hak akses admin/staff.
    """
    serializer_class = api_serializer.EnrolledCourseSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        user_id = self.kwargs.get('user_id')
        if not user_id:
            return api_models.EnrolledCourse.objects.none()
        try:
            user = User.objects.get(id=user_id)
            # [*] PHASE 4.71: Filter to show only enrollments in published courses
            # Prevents showing enrollments in draft versions or instructor copies
            return api_models.EnrolledCourse.objects.filter(
                user=user,
                course__platform_status='Published'
                # [*] PHASE 4.71: Removed is_published_version filter
            )
        except User.DoesNotExist:
            return api_models.EnrolledCourse.objects.none()



class StudentCourseDetailAPIView(generics.RetrieveAPIView):
    """
    Student Enrolled Course Detail API (Mengatasi Temuan Pentest H-01 IDOR)
    
    Secured with:
    - JWT authentication (IsAuthenticated)
    - Anti-IDOR Permission (IsOwnerOrStaff)
    """
    serializer_class = api_serializer.EnrolledCourseSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]
    lookup_field = 'enrollment_id'

    def get_object(self):
        user_id = self.kwargs.get('user_id')
        enrollment_id = self.kwargs.get('enrollment_id')
        
        if not user_id or not enrollment_id:
            raise Http404("User ID and Enrollment ID required")
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise Http404("User not found")
        
        # 1. Cari berdasarkan enrollment_id eksak
        enr = api_models.EnrolledCourse.objects.filter(user=user, enrollment_id=enrollment_id).first()
        if enr:
            return enr

        # 2. Cari jika parameter berupa course slug, course_id, atau id numerik
        course_query = Q(slug=enrollment_id) | Q(course_id=enrollment_id)
        if str(enrollment_id).isdigit():
            course_query |= Q(id=int(enrollment_id))

        matched_courses = api_models.Course.objects.filter(course_query)
        if matched_courses.exists():
            for c in matched_courses:
                related_ids = c.get_related_course_ids() if hasattr(c, 'get_related_course_ids') else {c.id}
                enr = api_models.EnrolledCourse.objects.filter(user=user, course_id__in=related_ids).first()
                if enr:
                    return enr

        raise Http404("Enrollment not found")
    
    # ✨ PHASE 7.24.3: Pass user to serializer context so get_user_liked can check likes
    def get_serializer_context(self):
        context = super().get_serializer_context()
        user_id = self.kwargs.get('user_id')
        
        if user_id:
            try:
                user = User.objects.get(id=user_id)
                context['user'] = user
                context['current_user'] = user
            except User.DoesNotExist:
                context['user'] = getattr(self.request, 'user', None)
                context['current_user'] = getattr(self.request, 'user', None)
        else:
            context['user'] = getattr(self.request, 'user', None)
            context['current_user'] = getattr(self.request, 'user', None)
        
        return context
        


@method_decorator(csrf_exempt, name='dispatch')
class StudentCourseCompletedCreateAPIView(generics.CreateAPIView):
    """
    Student Course Completion Tracking API
    
    CSRF exempt because:
    - Uses JWT authentication for student operations
    - Tracks course/lesson completion status
    - Data validated by serializer
    """
    serializer_class = api_serializer.CompletedLessonSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def create(self, request, *args, **kwargs):
        try:
            # 🔒 FIX IDOR: Gunakan user dari token JWT, abaikan user_id dari request.data
            user = request.user
            course_id = request.data['course_id']
            variant_item_id = request.data['variant_item_id']

            print(f"\n[StudentCourseCompletedCreateAPIView] 📥 Received request")
            print(f"   course_id: {course_id} (type: {type(course_id).__name__})")
            print(f"   variant_item_id: {variant_item_id} (type: {type(variant_item_id).__name__})")

            # Validate that course_id is actually a Course ID, not an enrollment ID
            # Enrollment IDs are usually short strings (ShortUUIDField), Course IDs are integers
            print(f"\n[StudentCourseCompletedCreateAPIView] 🔍 Validating IDs")
            if not str(course_id).isdigit():
                print(f"   ⚠️  WARNING: course_id '{course_id}' looks like an enrollment ID (not numeric)")
                print(f"   This suggests frontend sent course?.id instead of course?.course?.id")
            
            course = api_models.Course.objects.get(id=course_id)
            print(f"   ✅ Found course: {course.title}")
            
            variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)
            print(f"   ✅ Found variant_item: {variant_item.title}")

            # Check if course has a pre_post_test quiz and if student has completed pre-test
            pre_post_quiz = api_models.Quiz.objects.filter(course=course, quiz_type='pre_post_test', is_active=True).first()
            if pre_post_quiz:
                has_pre_test = api_models.QuizAttempt.objects.filter(user=user, quiz=pre_post_quiz).exists()
                if not has_pre_test:
                    return Response({
                        "error": "Akses materi terkunci. Anda harus menyelesaikan Pre-test terlebih dahulu sebelum menyelesaikan materi pelajaran.",
                        "is_pretest_required": True
                    }, status=status.HTTP_403_FORBIDDEN)

            # Check sequential progression: previous lesson in curriculum must be completed
            course_items = list(api_models.VariantItem.objects.filter(variant__course=course).order_by('variant__id', 'id'))
            try:
                curr_idx = next(i for i, item in enumerate(course_items) if item.variant_item_id == variant_item.variant_item_id)
                if curr_idx > 0:
                    prev_item = course_items[curr_idx - 1]
                    prev_completed = api_models.CompletedLesson.objects.filter(user=user, course=course, variant_item=prev_item).exists()
                    if not prev_completed:
                        return Response({
                            "error": f"Harap selesaikan materi pelajaran sebelumnya ({prev_item.title}) terlebih dahulu.",
                            "is_sequential_locked": True
                        }, status=status.HTTP_403_FORBIDDEN)
            except StopIteration:
                pass

            # ✨ PHASE 11.201: CRITICAL - Check if a verification question exists
            # If it does, ensure the student actually answered it correctly before marking complete
            verification_question = api_models.LessonCompletionQuestion.objects.filter(
                variant_item=variant_item
            ).first()
            
            if verification_question:
                print(f"\n[StudentCourseCompletedCreateAPIView] 📝 Verification question exists")
                
                # Check if there's a correct answer from this student for this question
                correct_answer = api_models.LessonCompletionQuestionAnswer.objects.filter(
                    user=user,
                    question=verification_question,
                    is_correct=True
                ).first()
                
                if not correct_answer:
                    print(f"   ❌ Student hasn't answered verification question correctly")
                    return Response({
                        "message": "Cannot mark lesson as completed - verification question must be answered correctly first",
                        "requires_verification": True
                    }, status=status.HTTP_403_FORBIDDEN)
                else:
                    print(f"   ✅ Student answered verification question correctly")
            else:
                print(f"\n[StudentCourseCompletedCreateAPIView] ✅ No verification question required")

            completed_lessons = api_models.CompletedLesson.objects.filter(user=user, course=course, variant_item=variant_item).first()

            if completed_lessons:
                # ✨ PHASE 19.1 FIX: Different behavior based on verification question
                if verification_question:
                    # HAS verification question → allow toggle/delete for lesson retakes
                    print(f"\n[StudentCourseCompletedCreateAPIView] 🔄 Lesson WITH verification question - TOGGLING (deleting) to allow retake")
                    print(f"   Record ID: {completed_lessons.id}")
                    completed_lessons.delete()
                    print(f"   ✅ Deleted - student can retake and answer verification question again")
                    return Response({"message": "Course marked as not completed - student can retake"}, status=status.HTTP_200_OK)
                else:
                    # NO verification question → once complete, stay complete (don't delete)
                    print(f"\n[StudentCourseCompletedCreateAPIView] ✅ Lesson WITHOUT verification question - already complete, staying complete")
                    print(f"   Record ID: {completed_lessons.id}")
                    print(f"   Note: Replaying video should NOT delete this record - lesson is permanently marked complete")
                    return Response({"message": "Course already marked as completed"}, status=status.HTTP_200_OK)
            else:
                print(f"\n[StudentCourseCompletedCreateAPIView] ✨ Creating new CompletedLesson record")
                new_record = api_models.CompletedLesson.objects.create(user=user, course=course, variant_item=variant_item)
                print(f"   ✅ Created with ID: {new_record.id}")
                print(f"   User: {user.username}, Course: {course.title}, Lesson: {variant_item.title}")
                return Response({"message": "Course marked as completed"}, status=status.HTTP_201_CREATED)
        except KeyError as e:
            print(f"\n[StudentCourseCompletedCreateAPIView] ❌ Missing required field: {str(e)}")
            print(f"   Available fields: {list(request.data.keys())}")
            return Response({"error": f"Missing required field: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            print(f"\n[StudentCourseCompletedCreateAPIView] ❌ User not found: {user}")
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Course.DoesNotExist:
            print(f"\n[StudentCourseCompletedCreateAPIView] ❌ Course not found: {course_id}")
            print(f"   This likely means frontend sent 'course?.id' (enrollment ID) instead of 'course?.course?.id' (course ID)")
            print(f"   Enrollment IDs are short strings, Course IDs are integers")
            return Response({"error": f"Course not found (ID: {course_id})"}, status=status.HTTP_404_NOT_FOUND)
        except api_models.VariantItem.DoesNotExist:
            print(f"\n[StudentCourseCompletedCreateAPIView] ❌ VariantItem not found: {variant_item_id}")
            return Response({"error": "VariantItem not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"\n[StudentCourseCompletedCreateAPIView] ❌ Unexpected error: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": f"Unexpected error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@method_decorator(csrf_exempt, name='dispatch')
class VideoProgressAPIView(generics.CreateAPIView):
    """
    Video Progress Tracking API
    
    CSRF exempt because:
    - Uses JWT authentication for student operations
    - Tracks video playback progress
    - Data validated by serializer
    """
    serializer_class = api_serializer.VideoProgressSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request, *args, **kwargs):
        # 🔒 FIX IDOR: Gunakan request.user, abaikan parameter user_id
        user = request.user
        course_id = request.GET.get('course_id')
        variant_item_id = request.GET.get('variant_item_id')
        
        import datetime
        timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
        
        if not all([user, course_id, variant_item_id]):
            print(f"[{timestamp}] 🎥 VideoProgress GET: Missing required parameters")
            return Response({
                "error": "Missing required parameters: user_id, course_id, variant_item_id"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = int(user)
            course_id = int(course_id)
            # ✨ PHASE 16: FIX - variant_item_id is a ShortUUID string, NOT an integer!
            # DO NOT convert to int - keep it as string for database lookup
            # variant_item_id = int(variant_item_id)  # REMOVED - This breaks the query!
            print(f"[{timestamp}] 🔍 VideoProgress GET: Looking up progress user_id={user_id}, course_id={course_id}, variant_item_id={variant_item_id}")
        except ValueError as e:
            print(f"[{timestamp}] ❌ VideoProgress GET: Parameter conversion error - {e}")
            return Response({
                "error": f"Invalid parameter format - user_id and course_id must be integers: {e}"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get progress using variant_item_id (ShortUUID field)
            progress = api_models.VideoProgress.objects.get(
                user=user,
                course_id=course_id,
                variant_item__variant_item_id=variant_item_id
            )
            
            print(f"[{timestamp}] ✅ VideoProgress GET: Found progress - {progress.progress_percentage}% complete")
            serializer = api_serializer.VideoProgressSerializer(progress)
            return Response({
                "message": "Video progress retrieved successfully",
                "data": serializer.data
            }, status=status.HTTP_200_OK)
            
        except api_models.VideoProgress.DoesNotExist:
            # Return default progress structure
            print(f"[{timestamp}] ℹ️ VideoProgress GET: No progress found (returning default)")
            return Response({
                "message": "No progress found",
                "data": {
                    "user": user_id,
                    "course": course_id,
                    "variant_item": variant_item_id,
                    "progress_percentage": "0.00",
                    "last_watched_position": "0.00",
                    "total_duration": "0.00",
                    "is_completed": False,
                    "is_in_progress": False
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"[{timestamp}] ❌ VideoProgress GET: Unexpected error - {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                "error": f"Failed to retrieve progress: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request, *args, **kwargs):
        import datetime
        timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
        
        # 🔒 FIX IDOR: Ambil user langsung dari JWT
        user = request.user
        course_id = request.data.get('course_id')
        variant_item_id = request.data.get('variant_item_id')
        progress_percentage = request.data.get('progress_percentage', 0)
        last_watched_position = request.data.get('last_watched_position', 0)
        total_duration = request.data.get('total_duration', 0)

        print(f"[{timestamp}] 🎥 VideoProgress CREATE: Received request for user={user}, variant_item_id={variant_item_id}")

        # Convert string values from FormData to proper numeric types
        try:
            progress_percentage = float(progress_percentage)
            last_watched_position = float(last_watched_position)
            total_duration = float(total_duration)
            course_id = int(course_id) if course_id else None
        except (TypeError, ValueError) as e:
            print(f"[{timestamp}] ❌ VideoProgress CREATE: Type conversion error - {e}")
            return Response({
                "error": f"Invalid numeric values provided: {e}"
            }, status=status.HTTP_400_BAD_REQUEST)

        print(f"[{timestamp}] 📊 VideoProgress CREATE: Progress: {progress_percentage:.1f}%, Position: {last_watched_position:.1f}s, Duration: {total_duration:.1f}s")

        try:
            # Validate and fetch objects with better error messages
            try:
                print(f"[{timestamp}] ✅ VideoProgress CREATE: Found user '{user.username}' (ID: {user})")
            except User.DoesNotExist:
                print(f"[{timestamp}] ❌ VideoProgress CREATE: User {user} not found")
                return Response({
                    "error": f"User with id {user} not found"
                }, status=status.HTTP_400_BAD_REQUEST)

            try:
                course = api_models.Course.objects.get(id=course_id)
                print(f"[{timestamp}] ✅ VideoProgress CREATE: Found course '{course.title}' (ID: {course_id})")
            except api_models.Course.DoesNotExist:
                print(f"[{timestamp}] ❌ VideoProgress CREATE: Course {course_id} not found")
                return Response({
                    "error": f"Course with id {course_id} not found"
                }, status=status.HTTP_400_BAD_REQUEST)

            try:
                # ✨ PHASE 4.145: Better debugging for variant_item lookup
                print(f"[{timestamp}] 🔍 VideoProgress CREATE: Looking up variant_item_id={variant_item_id}")
                variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)
                print(f"[{timestamp}] ✅ VideoProgress CREATE: Found variant item '{variant_item.title}'")
            except api_models.VariantItem.DoesNotExist:
                print(f"[{timestamp}] ❌ VideoProgress CREATE: VariantItem {variant_item_id} not found")
                # List available variant items for debugging
                available_items = list(api_models.VariantItem.objects.values_list('variant_item_id', flat=True)[:5])
                print(f"[{timestamp}] 📝 Sample variant items in DB: {available_items}")
                return Response({
                    "error": f"VariantItem with id {variant_item_id} not found"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create or update video progress
            print(f"[{timestamp}] 💾 VideoProgress CREATE: Saving progress to database...")
            video_progress, created = api_models.VideoProgress.objects.update_or_create(
                user=user,
                course=course,
                variant_item=variant_item,
                defaults={
                    'progress_percentage': progress_percentage,
                    'last_watched_position': last_watched_position,
                    'total_duration': total_duration
                }
            )
            
            # ✨ PHASE 11.178: Set is_fully_watched when progress reaches 95%+ (video fully watched)
            if progress_percentage >= 95.0 and not video_progress.is_fully_watched:
                print(f"[{timestamp}] 🎯 VideoProgress CREATE: Video watched {progress_percentage}% - marking as FULLY_WATCHED")
                video_progress.is_fully_watched = True
                video_progress.fully_watched_at = timezone.now()
                video_progress.save()

            action = "Created" if created else "Updated"
            print(f"[{timestamp}] ✅ VideoProgress CREATE: {action} progress for '{user.username}' - {progress_percentage:.1f}% complete")
            
            serializer = api_serializer.VideoProgressSerializer(video_progress)
            return Response({
                "message": "Video progress saved successfully",
                "data": serializer.data,
                "created": created
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"[{timestamp}] ❌ VideoProgress CREATE: Unexpected error - {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                "error": f"Error saving video progress: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)



@method_decorator(csrf_exempt, name='dispatch')
class VideoProgressDetailAPIView(generics.RetrieveUpdateAPIView):
    """
    Video Progress Detail API
    
    CSRF exempt because:
    - Uses JWT authentication for student operations
    - Updates video progress data
    - Data validated by serializer
    """
    serializer_class = api_serializer.VideoProgressSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_object(self):
        user_id = self.kwargs.get('user_id')
        variant_item_id = self.kwargs.get('variant_item_id')
        
        try:
            return api_models.VideoProgress.objects.get(
                user_id=user_id,
                variant_item__variant_item_id=variant_item_id
            )
        except api_models.VideoProgress.DoesNotExist:
            return None
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance is None:
            return Response({
                "message": "No progress found",
                "data": None
            }, status=status.HTTP_200_OK)
        
        serializer = self.get_serializer(instance)
        return Response({
            "message": "Video progress retrieved successfully",
            "data": serializer.data
        }, status=status.HTTP_200_OK)
    
    def post(self, request, *args, **kwargs):
        """Handle POST requests for updating/creating progress"""
        import datetime
        timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
        
        user_id_str = self.kwargs.get('user_id')
        variant_item_id = self.kwargs.get('variant_item_id')
        
        # Extract progress data from request
        progress_percentage = request.data.get('progress_percentage') or request.data.get('percentage', 0)
        last_watched_position = request.data.get('last_watched_position') or request.data.get('position', 0)
        total_duration = request.data.get('total_duration') or request.data.get('duration', 0)
        
        print(f"[{timestamp}] 🎥 VideoProgressDetail POST: Received update for user_id={user_id_str}, variant_item_id={variant_item_id}")
        
        try:
            # Convert to appropriate types
            progress_percentage = float(progress_percentage)
            last_watched_position = float(last_watched_position)
            total_duration = float(total_duration)
            user_id = int(user_id_str)
            # ✨ PHASE 16: FIX - variant_item_id is a ShortUUID string, NOT an integer!
            # DO NOT convert to int - keep it as string for database lookup
            # variant_item_id = int(variant_item_id)  # REMOVED - This breaks the query!
        except (ValueError, TypeError) as e:
            print(f"[{timestamp}] ❌ VideoProgressDetail POST: Type conversion error - {e}")
            return Response({
                "error": f"Invalid numeric values provided: {e}"
            }, status=status.HTTP_400_BAD_REQUEST)

        print(f"[{timestamp}] 📊 VideoProgressDetail POST: Progress: {progress_percentage:.1f}%, Position: {last_watched_position:.1f}s, Duration: {total_duration:.1f}s")

        try:
            # Get required objects
            user = User.objects.get(id=user_id)
            print(f"[{timestamp}] ✅ VideoProgressDetail POST: Found user '{user.username}'")
            
            variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)
            print(f"[{timestamp}] ✅ VideoProgressDetail POST: Found variant_item '{variant_item.title}'")
            
            # Get the course from request data or from variant_item
            course_id = request.data.get('course_id')
            if course_id:
                course = api_models.Course.objects.get(id=course_id)
            else:
                course = variant_item.variant.course
            print(f"[{timestamp}] ✅ VideoProgressDetail POST: Found course '{course.title}'")

            # Create or update video progress
            print(f"[{timestamp}] 💾 VideoProgressDetail POST: Saving progress...")
            video_progress, created = api_models.VideoProgress.objects.update_or_create(
                user=user,
                course=course,
                variant_item=variant_item,
                defaults={
                    'progress_percentage': progress_percentage,
                    'last_watched_position': last_watched_position,
                    'total_duration': total_duration
                }
            )

            action = "Created" if created else "Updated"
            print(f"[{timestamp}] ✅ VideoProgressDetail POST: {action} progress - {progress_percentage:.1f}% complete")
            
            # Return lightweight response to prevent broken pipe errors
            return Response({
                "message": "Video progress saved successfully",
                "progress_percentage": float(video_progress.progress_percentage),
                "last_watched_position": float(video_progress.last_watched_position),
                "total_duration": float(video_progress.total_duration),
                "is_completed": video_progress.is_completed,
                "is_in_progress": video_progress.is_in_progress,
                "created": created
            }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

        except User.DoesNotExist:
            print(f"[{timestamp}] ❌ VideoProgressDetail POST: User {user_id} not found")
            return Response({
                "error": f"User with id {user_id} not found"
            }, status=status.HTTP_400_BAD_REQUEST)
        except api_models.VariantItem.DoesNotExist:
            return Response({
                "error": f"VariantItem with id {variant_item_id} not found"
            }, status=status.HTTP_400_BAD_REQUEST)
        except api_models.Course.DoesNotExist:
            return Response({
                "error": f"Course not found"
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"[VideoProgressDetail] Unexpected error: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                "error": f"Error saving video progress: {str(e)}"
            }, status=status.HTTP_400_BAD_REQUEST)



@method_decorator(csrf_exempt, name='dispatch')
class VideoProgressDeleteAPIView(generics.DestroyAPIView):
    """
    Video Progress Delete API
    
    CSRF exempt because:
    - Uses JWT authentication for student operations
    - Deletes video progress records
    - Secured by user ID verification
    """
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_object(self):
        user_id = self.kwargs.get('user_id')
        variant_item_id = self.kwargs.get('variant_item_id')
        
        try:
            return api_models.VideoProgress.objects.get(
                user_id=user_id,
                variant_item__variant_item_id=variant_item_id
            )
        except api_models.VideoProgress.DoesNotExist:
            return None
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance is None:
            return Response({
                "message": "No progress found to delete",
                "success": True
            }, status=status.HTTP_200_OK)
        
        instance.delete()
        return Response({
            "message": "Video progress deleted successfully",
            "success": True
        }, status=status.HTTP_200_OK)



@method_decorator(csrf_exempt, name='dispatch')
class StudentNoteCreateAPIView(generics.ListCreateAPIView):
    """
    Student Notes API (List/Create)
    
    CSRF exempt because:
    - Uses JWT authentication for student operations
    - Creates and lists course notes
    - Data validated by serializer
    """
    serializer_class = api_serializer.NoteSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        user_id = self.kwargs.get('user_id')
        enrollment_id = self.kwargs.get('enrollment_id')
        
        if not user_id or not enrollment_id:
            return api_models.Note.objects.none()
        
        try:
            user = User.objects.get(id=user_id)
            enrolled = api_models.EnrolledCourse.objects.get(enrollment_id=enrollment_id)
            return api_models.Note.objects.filter(user=user, course=enrolled.course)
        except (User.DoesNotExist, api_models.EnrolledCourse.DoesNotExist):
            return api_models.Note.objects.none()

    def create(self, request, *args, **kwargs):
        user_id = request.data['user_id']
        enrollment_id = request.data['enrollment_id']
        title = request.data['title']
        note = request.data['note']
        color = request.data.get('color', '#f39c12')  # Default color if not provided
        # ✨ PHASE 11.160: Optional lesson context for notes
        variant_id = request.data.get('variant_id', None)
        variant_item_id = request.data.get('variant_item_id', None)

        user = User.objects.get(id=user_id)
        enrolled = api_models.EnrolledCourse.objects.get(enrollment_id=enrollment_id)
        
        # ✨ PHASE 11.161 FIX: Validate variant_id exists before saving to prevent FK constraint violation
        variant_obj = None
        if variant_id:
            try:
                # Try first by variant_id (ShortUUID field)
                variant_obj = api_models.Variant.objects.get(variant_id=variant_id, course=enrolled.course)
            except api_models.Variant.DoesNotExist:
                try:
                    # Fallback: try by primary key ID (numeric) in case frontend sent the ID instead of variant_id
                    variant_obj = api_models.Variant.objects.get(id=variant_id, course=enrolled.course)
                except (api_models.Variant.DoesNotExist, ValueError, TypeError):
                    # If not found by either method, silently ignore it (optional context)
                    # This prevents FK violations while still allowing notes without context
                    variant_obj = None
                    variant_id = None
                    variant_item_id = None
        
        # ✨ PHASE 11.161 FIX: Validate variant_item_id exists if variant_id is provided
        variant_item_obj = None
        if variant_item_id and variant_obj:
            try:
                # Try first by variant_item_id (ShortUUID field)
                variant_item_obj = api_models.VariantItem.objects.get(variant_item_id=variant_item_id, variant=variant_obj)
            except api_models.VariantItem.DoesNotExist:
                try:
                    # Fallback: try by primary key ID (numeric) in case frontend sent the ID instead of variant_item_id
                    variant_item_obj = api_models.VariantItem.objects.get(id=variant_item_id, variant=variant_obj)
                except (api_models.VariantItem.DoesNotExist, ValueError, TypeError):
                    # If not found, silently ignore it (optional context)
                    variant_item_obj = None
                    variant_item_id = None
        
        # ✨ PHASE 11.161 FIX: Use variant object (not just ID) to prevent FK violations
        # Create note with optional lesson context
        note_obj = api_models.Note.objects.create(
            user=user, 
            course=enrolled.course, 
            note=note, 
            title=title, 
            color=color,
            variant=variant_obj,  # Pass the object (or None), not the ID
            variant_item=variant_item_obj  # Pass the object (or None), not the ID
        )

        return Response({"message": "Note created successfullly"}, status=status.HTTP_201_CREATED)



@method_decorator(csrf_exempt, name='dispatch')
class StudentNoteDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    Student Note Detail API
    
    CSRF exempt because:
    - Uses JWT authentication for student operations
    - Updates/deletes individual notes
    - Secured by user ownership verification
    """
    serializer_class = api_serializer.NoteSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_object(self):
        user_id = self.kwargs.get('user_id')
        enrollment_id = self.kwargs.get('enrollment_id')
        note_id = self.kwargs.get('note_id')
        
        if not user_id or not enrollment_id or not note_id:
            raise Http404("User ID, Enrollment ID, and Note ID required")
        
        try:
            user = User.objects.get(id=user_id)
            enrolled = api_models.EnrolledCourse.objects.get(enrollment_id=enrollment_id)
            return api_models.Note.objects.get(user=user, course=enrolled.course, id=note_id)
        except (User.DoesNotExist, api_models.EnrolledCourse.DoesNotExist, api_models.Note.DoesNotExist):
            raise Http404("Resource not found")
    
    # ✨ PHASE 11.161 FIX: Override update to validate and set variant/variant_item before saving
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # ✨ PHASE 11.161 FIX: Handle variant/variant_item separately since they're read_only in serializer
        variant_obj = instance.variant
        variant_item_obj = instance.variant_item
        variant_was_updated = False
        
        # Check if variant_id is being updated
        if 'variant_id' in request.data:
            variant_was_updated = True
            if request.data['variant_id']:
                variant_id = request.data['variant_id']
                enrollment_id = self.kwargs.get('enrollment_id')
                try:
                    enrolled = api_models.EnrolledCourse.objects.get(enrollment_id=enrollment_id)
                    try:
                        # Try first by variant_id (ShortUUID field)
                        variant_obj = api_models.Variant.objects.get(variant_id=variant_id, course=enrolled.course)
                    except api_models.Variant.DoesNotExist:
                        # Fallback: try by primary key ID (numeric)
                        try:
                            variant_obj = api_models.Variant.objects.get(id=variant_id, course=enrolled.course)
                        except (api_models.Variant.DoesNotExist, ValueError, TypeError):
                            variant_obj = None
                except api_models.EnrolledCourse.DoesNotExist:
                    variant_obj = None
            else:
                # Explicitly clearing variant
                variant_obj = None
        
        # Check if variant_item_id is being updated
        if 'variant_item_id' in request.data:
            if request.data['variant_item_id'] and variant_obj:
                variant_item_id = request.data['variant_item_id']
                try:
                    # Try first by variant_item_id (ShortUUID field)
                    variant_item_obj = api_models.VariantItem.objects.get(variant_item_id=variant_item_id, variant=variant_obj)
                except api_models.VariantItem.DoesNotExist:
                    # Fallback: try by primary key ID (numeric)
                    try:
                        variant_item_obj = api_models.VariantItem.objects.get(id=variant_item_id, variant=variant_obj)
                    except (api_models.VariantItem.DoesNotExist, ValueError, TypeError):
                        variant_item_obj = None
            else:
                # Explicitly clearing variant_item
                variant_item_obj = None
        
        # Remove variant fields from request.data since they're read_only in serializer
        # ✨ PHASE 11.164 FIX: Create mutable copy before popping (FormData creates immutable QueryDict)
        mutable_data = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
        mutable_data.pop('variant_id', None)
        mutable_data.pop('variant_item_id', None)
        
        # Serialize and validate the rest of the data
        serializer = self.get_serializer(instance, data=mutable_data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Update the instance with the serializer data
        instance = serializer.save()
        
        # Now set the variant and variant_item directly if they were updated
        if variant_was_updated:
            instance.variant = variant_obj
            instance.variant_item = variant_item_obj
            instance.save()
        
        return Response(serializer.data)



@method_decorator(csrf_exempt, name='dispatch')
class StudentRateCourseCreateAPIView(generics.CreateAPIView):
    """
    Student Course Rating/Review API
    
    CSRF exempt because:
    - Uses JWT authentication for student operations
    - Creates course ratings and reviews
    - Data validated by ReviewSerializer
    """
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def create(self, request, *args, **kwargs):
        try:
            user_id = request.data['user']
            course_id = request.data['course']
            rating = request.data['rating']
            review = request.data['review']

            user = User.objects.get(id=user_id)
            course = api_models.Course.objects.get(id=course_id)

            # Check if user already has a review for this course
            existing_review = api_models.Review.objects.filter(user=user, course=course).first()
            if existing_review:
                return Response(
                    {"error": "You have already reviewed this course"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            api_models.Review.objects.create(
                user=user,
                course=course,
                review=review,
                rating=rating,
                active=True,
            )

            return Response({"message": "Review created successfully"}, status=status.HTTP_201_CREATED)
            
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)
        except KeyError as e:
            return Response({"error": f"Missing required field: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Internal server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@method_decorator(csrf_exempt, name='dispatch')
class StudentRateCourseUpdateAPIView(generics.RetrieveUpdateAPIView):
    """
    Student Course Rating Update API
    
    CSRF exempt because:
    - Uses JWT authentication for student operations
    - Updates existing course ratings/reviews
    - Data validated by ReviewSerializer
    """
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_object(self):
        user_id = self.kwargs.get('user_id')
        review_id = self.kwargs.get('review_id')
        
        if not user_id or not review_id:
            raise Http404("User ID and Review ID required")
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise Http404("User not found")
        
        try:
            return api_models.Review.objects.get(id=review_id, user=user)
        except api_models.Review.DoesNotExist:
            raise Http404("Review not found")



@method_decorator(csrf_exempt, name='dispatch')
class StudentWishListListCreateAPIView(generics.ListCreateAPIView):
    """
    Student Wishlist API (List/Create)
    
    CSRF exempt because:
    - Uses JWT authentication for student operations
    - Manages course wishlist items
    - Data validated by WishlistSerializer
    """
    serializer_class = api_serializer.WishlistSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        user_id = self.kwargs.get('user_id')
        if not user_id:
            return api_models.Wishlist.objects.none()
        
        try:
            user = User.objects.get(id=user_id)
            return api_models.Wishlist.objects.filter(user=user)
        except User.DoesNotExist:
            return api_models.Wishlist.objects.none()
    
    def create(self, request, *args, **kwargs):
        try:
            user_id = request.data.get('user_id')
            course_id = request.data.get('course_id')

            # Validate required fields
            if not user_id or not course_id:
                return Response(
                    {"message": "User ID and Course ID are required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 🔒 Validasi kepemilikan
            is_admin = getattr(request.user, 'is_admin', False) or getattr(request.user, 'is_staff', False)
            if str(request.user.id) != str(user_id) and not is_admin:
                return Response({"message": "Akses ditolak. Anda tidak berhak memodifikasi wishlist pengguna lain."}, status=status.HTTP_403_FORBIDDEN)

            # Get user and validate
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {"message": "User not found"}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            # Check if user is currently acting as a teacher (instructor)
            # Only block if they are actively in teacher role, not just if they have instructor capabilities
            if user.is_teacher_current():
                return Response(
                    {"message": "Teachers cannot add courses to wishlist"}, 
                    status=status.HTTP_403_FORBIDDEN
                )

            # Get course and validate
            try:
                course = api_models.Course.objects.get(id=course_id)
            except api_models.Course.DoesNotExist:
                return Response(
                    {"message": "Course not found"}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            # Check if wishlist item already exists
            wishlist = api_models.Wishlist.objects.filter(user=user, course=course).first()
            
            if wishlist:
                # Remove from wishlist
                wishlist.delete()
                return Response(
                    {"message": "Course removed from wishlist"}, 
                    status=status.HTTP_200_OK
                )
            else:
                # Add to wishlist
                api_models.Wishlist.objects.create(user=user, course=course)
                return Response(
                    {"message": "Course added to wishlist"}, 
                    status=status.HTTP_201_CREATED
                )
                
        except Exception as e:
            print(f"[Wishlist Error] {str(e)}")
            return Response(
                {"message": f"Error updating wishlist: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )



@method_decorator(csrf_exempt, name='dispatch')
class QuestionAnswerListCreateAPIView(generics.ListCreateAPIView):
    """
    Course Q&A API (List/Create)
    
    CSRF exempt because:
    - Uses JWT authentication for user operations
    - Creates and lists course questions
    - Data validated by Question_AnswerSerializer
    """
    serializer_class = api_serializer.Question_AnswerSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        course_id = self.kwargs.get('course_id')
        if not course_id:
            return api_models.Question_Answer.objects.none()
        try:
            course = api_models.Course.objects.get(id=course_id)
            return api_models.Question_Answer.objects.filter(course=course)
        except api_models.Course.DoesNotExist:
            return api_models.Question_Answer.objects.none()
    
    def create(self, request, *args, **kwargs):
        course_id = request.data['course_id']
        user_id = request.data['user_id']
        title = request.data['title']
        message = request.data['message']
        # ✨ PHASE 7.25: Require variant_item_id for proper lesson organization
        variant_item_id = request.data.get('variant_item_id', None)
        
        # Validate that variant_item_id is provided
        if not variant_item_id:
            return Response(
                {"error": "variant_item_id is required. Please select a lesson context for your question."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.get(id=user_id)
        course = api_models.Course.objects.get(id=course_id)
        
        # Get variant_item - should always exist since validation passed
        try:
            variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)
        except api_models.VariantItem.DoesNotExist:
            return Response(
                {"error": "Invalid variant_item_id. The selected lesson no longer exists."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # ✨ Video Timestamp (optional)
        video_timestamp = request.data.get('video_timestamp', None)
        if video_timestamp is not None and str(video_timestamp).strip() != '' and str(video_timestamp).strip() != 'null':
            try:
                video_timestamp = int(float(video_timestamp))
            except (ValueError, TypeError):
                video_timestamp = None
        else:
            video_timestamp = None

        # ✨ Handle optional file attachment with security and size validation
        attached_file = request.FILES.get('file', None)
        file_name = request.data.get('file_name', None)
        if attached_file:
            import os
            ext = os.path.splitext(attached_file.name)[1].lower()
            allowed_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.pdf'}
            if ext not in allowed_extensions:
                return Response(
                    {"error": f"Format file '{ext}' tidak didukung. Harap unggah gambar (PNG, JPG, WEBP) atau PDF."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if attached_file.size > 5 * 1024 * 1024:
                return Response(
                    {"error": "Ukuran file terlalu besar. Maksimal 5MB."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not file_name:
                file_name = attached_file.name

        question = api_models.Question_Answer.objects.create(
            course=course,
            user=user,
            title=title,
            variant_item=variant_item,  # Now guaranteed to have lesson context
            video_timestamp=video_timestamp,
            file=attached_file,
            file_name=file_name
        )

        api_models.Question_Answer_Message.objects.create(
            course=course,
            user=user,
            message=message or "",
            question=question,
            file=attached_file,
            file_name=file_name
        )
        
        return Response({"message": "Group conversation Started"}, status=status.HTTP_201_CREATED)



@method_decorator(csrf_exempt, name='dispatch')
class QuestionAnswerMessageSendAPIView(generics.CreateAPIView):
    """
    Q&A Message Send API
    
    CSRF exempt because:
    - Uses JWT authentication for user operations
    - Sends messages in course Q&A threads
    - Data validated by Question_Answer_MessageSerializer
    """
    serializer_class = api_serializer.Question_Answer_MessageSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def create(self, request, *args, **kwargs):
        print("=== DEBUG: QuestionAnswerMessageSendAPIView ===")
        print(f"Request data: {request.data}")
        
        try:
            course_id = request.data.get('course_id')
            qa_id = request.data.get('qa_id')
            # 🔒 FIX IDOR: Wajib gunakan user dari token
            user = request.user
            message = request.data.get('message')

            # ✨ Handle optional file attachment with security and size validation
            attached_file = request.FILES.get('file', None)
            file_name = request.data.get('file_name', None)
            if attached_file:
                import os
                ext = os.path.splitext(attached_file.name)[1].lower()
                allowed_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.pdf'}
                if ext not in allowed_extensions:
                    return Response(
                        {"error": f"Format file '{ext}' tidak didukung. Harap unggah gambar (PNG, JPG, WEBP) atau PDF."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if attached_file.size > 5 * 1024 * 1024:
                    return Response(
                        {"error": "Ukuran file terlalu besar. Maksimal 5MB."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                if not file_name:
                    file_name = attached_file.name

            print(f"Extracted data - course_id: {course_id}, qa_id: {qa_id}, user_id: {user}, message: {message}, file: {file_name}")

            # Validate required fields
            if not course_id or not qa_id or not user:
                return Response(
                    {"error": "Missing required fields: course_id, qa_id, or user"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not message and not attached_file:
                return Response(
                    {"error": "Pesan atau lampiran file harus diisi."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get related objects with error handling
            try:
                course = api_models.Course.objects.get(id=course_id)
                question = api_models.Question_Answer.objects.get(qa_id=qa_id)
            except api_models.Course.DoesNotExist:
                return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)
            except api_models.Question_Answer.DoesNotExist:
                return Response({"error": "Question not found"}, status=status.HTTP_404_NOT_FOUND)

            # Create the message
            message_obj = api_models.Question_Answer_Message.objects.create(
                course=course,
                user=user,
                message=message or "",
                question=question,
                file=attached_file,
                file_name=file_name
            )

            # Return the updated question with all messages
            question_serializer = api_serializer.Question_AnswerSerializer(question)
            return Response({"message": "Message Sent", "question": question_serializer.data})

        except Exception as e:
            return Response(
                {"error": f"Internal server error: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )




# ✨ PHASE 7.16: Q&A Like endpoint
class QuestionAnswerLikeAPIView(generics.CreateAPIView):
    """
    Q&A Like API - Toggle like on a question/answer
    
    POST /api/v1/student/question-answer-like/{qa_id}/
    Body: {user_id, course_id}
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, qa_id=None):
        try:
            user_id = request.data.get('user_id')
            course_id = request.data.get('course_id')

            if not all([user_id, course_id, qa_id]):
                return Response(
                    {"error": "Missing required fields: user_id, course_id, qa_id"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            user = User.objects.get(id=user_id)
            question = api_models.Question_Answer.objects.get(qa_id=qa_id)
            
            # Toggle like - if exists, delete it; if not, create it
            like_obj, created = api_models.Question_Answer_Like.objects.get_or_create(
                question=question,
                user=user
            )
            
            if not created:
                # Already liked, so unlike it
                like_obj.delete()
                message = "Tarik Suka berhasil"
            else:
                message = "Suka berhasil"
            
            # Count current likes
            likes_count = api_models.Question_Answer_Like.objects.filter(question=question).count()
            
            return Response({
                "message": message,
                "likes_count": likes_count,
                "liked": created
            }, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            return Response({"error": "User tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Question_Answer.DoesNotExist:
            return Response({"error": "Question tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ✨ PHASE 7.16: Q&A Message Like endpoint
class QuestionAnswerMessageLikeAPIView(generics.CreateAPIView):
    """
    Q&A Message Like API - Toggle like on a message/reply
    
    POST /api/v1/student/question-answer-message-like/{qa_id}/
    Body: {user_id, course_id, message_id}
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, qa_id=None):
        try:
            user_id = request.data.get('user_id')
            course_id = request.data.get('course_id')
            message_id = request.data.get('message_id')

            if not all([user_id, course_id, qa_id, message_id]):
                return Response(
                    {"error": "Missing required fields: user_id, course_id, qa_id, message_id"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            user = User.objects.get(id=user_id)
            # ✨ PHASE 7.16: Get message by ID and verify it belongs to the correct question (via question__qa_id)
            message = api_models.Question_Answer_Message.objects.get(id=message_id, question__qa_id=qa_id)
            
            # Toggle like - if exists, delete it; if not, create it
            like_obj, created = api_models.Question_Answer_Message_Like.objects.get_or_create(
                message=message,
                user=user
            )
            
            if not created:
                # Already liked, so unlike it
                like_obj.delete()
                message_text = "Tarik Suka berhasil"
            else:
                message_text = "Suka berhasil"
            
            # Count current likes
            likes_count = api_models.Question_Answer_Message_Like.objects.filter(message=message).count()
            
            return Response({
                "message": message_text,
                "likes_count": likes_count,
                "liked": created
            }, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            return Response({"error": "User tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Question_Answer_Message.DoesNotExist:
            return Response({"error": "Message tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ✨ Solved / Best Answer System - Toggle accepted solution on reply
class QuestionAnswerToggleSolutionAPIView(generics.CreateAPIView):
    """
    Q&A Toggle Solution API - Mark or unmark a reply as verified solution / best answer
    POST /api/v1/student/question-answer-toggle-solution/<qa_id>/
    Body: {user_id, message_id}
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, qa_id=None):
        try:
            user_id = request.data.get('user_id')
            message_id = request.data.get('message_id')

            if not all([user_id, qa_id, message_id]):
                return Response(
                    {"error": "Missing required fields: user_id, qa_id, message_id"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user = User.objects.get(id=user_id)
            question = api_models.Question_Answer.objects.get(qa_id=qa_id)
            
            # Lookup message by id or qam_id
            try:
                if str(message_id).isdigit():
                    message = api_models.Question_Answer_Message.objects.get(id=int(message_id), question=question)
                else:
                    message = api_models.Question_Answer_Message.objects.get(qam_id=message_id, question=question)
            except api_models.Question_Answer_Message.DoesNotExist:
                return Response({"error": "Pesan balasan tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)

            # Check permissions: question asker, course instructor, or staff/superuser
            is_asker = bool(question.user_id == user.id)
            is_instructor = bool(
                question.course and question.course.teacher and 
                (question.course.teacher.user_id == user.id)
            )
            is_admin = bool(user.is_staff or user.is_superuser)

            if not (is_asker or is_instructor or is_admin):
                return Response(
                    {"error": "Hanya penanya atau instruktur kursus yang berhak menandai solusi terverifikasi"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Toggle solution
            if message.is_solution:
                # Unmark
                message.is_solution = False
                message.save()
                
                # Check if any other reply is marked
                has_other_solution = question.reply_messages.filter(is_solution=True).exists()
                question.is_solved = has_other_solution
                question.save()
                
                return Response({
                    "message": "Status solusi berhasil dibatalkan",
                    "is_solution": False,
                    "is_solved": question.is_solved,
                    "message_id": message.id
                }, status=status.HTTP_200_OK)
            else:
                # Mark as solution - reset others for this question first
                question.reply_messages.filter(is_solution=True).update(is_solution=False)
                message.is_solution = True
                message.save()
                
                question.is_solved = True
                question.save()

                return Response({
                    "message": "Jawaban berhasil ditandai sebagai Solusi Terverifikasi",
                    "is_solution": True,
                    "is_solved": True,
                    "message_id": message.id
                }, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            return Response({"error": "User tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Question_Answer.DoesNotExist:
            return Response({"error": "Pertanyaan tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class QuestionAnswerTogglePinAPIView(generics.CreateAPIView):
    """
    Q&A Toggle Pin API - Pin or unpin a discussion to keep it at the top
    POST /api/v1/student/question-answer-toggle-pin/<qa_id>/
    Body: {user_id}
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, qa_id=None):
        try:
            user_id = request.data.get('user_id')
            if not all([user_id, qa_id]):
                return Response(
                    {"error": "Missing required fields: user_id, qa_id"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user = User.objects.get(id=user_id)
            question = api_models.Question_Answer.objects.get(qa_id=qa_id)

            # Check permissions: instructor of the course or staff/admin
            is_instructor = bool(
                question.course and question.course.teacher and 
                (question.course.teacher.user_id == user.id or question.course.teacher.user == user)
            )
            is_staff = bool(user.is_staff or user.is_superuser)

            if not (is_instructor or is_staff):
                return Response(
                    {"error": "Hanya instruktur kursus atau staf/pengelola yang berhak menyematkan diskusi."},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Toggle pin
            question.is_pinned = not question.is_pinned
            question.save(update_fields=['is_pinned'])

            serializer = api_serializer.Question_AnswerSerializer(question)
            action_text = "disematkan ke posisi teratas" if question.is_pinned else "batal disematkan"
            return Response({
                "message": f"Diskusi berhasil {action_text}",
                "is_pinned": question.is_pinned,
                "question": serializer.data
            }, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            return Response({"error": "Pengguna tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Question_Answer.DoesNotExist:
            return Response({"error": "Diskusi tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ✨ PHASE 7.16: Q&A Report endpoint
class QuestionAnswerReportAPIView(generics.CreateAPIView):
    """
    Q&A Report API - Report inappropriate question/answer
    
    POST /api/v1/student/question-answer-report/{qa_id}/
    Body: {user_id, reason, description}
    Reasons: spam, inappropriate, offensive, misinformation, other
    
    PUT /api/v1/student/question-answer-report/{report_id}/
    Body: {user_id, reason, description, status}
    Purpose: Update existing report (edit mode) and reset status to pending
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        try:
            qa_id = self.kwargs.get('qa_id')
            user_id = request.data.get('user_id')
            reason = request.data.get('reason', 'other')
            description = request.data.get('description', '')

            print(f"DEBUG: QuestionAnswerReportAPIView.create() called")
            print(f"  qa_id: {qa_id}")
            print(f"  user_id: {user_id}")
            print(f"  reason: {reason}")
            print(f"  description: {description}")

            if not all([user_id, qa_id]):
                return Response(
                    {"error": "Missing required fields: user_id, qa_id"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate reason choice
            valid_reasons = ['spam', 'inappropriate', 'offensive', 'misinformation', 'other']
            if reason not in valid_reasons:
                return Response(
                    {"error": f"Invalid reason. Valid options: {', '.join(valid_reasons)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            print(f"  Getting user with id={user_id}")
            user = User.objects.get(id=user_id)
            print(f"  User found: {user}")
            
            print(f"  Getting question with qa_id={qa_id}")
            question = api_models.Question_Answer.objects.get(qa_id=qa_id)
            print(f"  Question found: {question}")
            
            # Check if already reported by this user
            existing_report = api_models.Question_Answer_Report.objects.filter(
                question=question,
                reported_by=user
            ).first()
            
            if existing_report:
                return Response({
                    "error": "Anda sudah melaporkan pertanyaan ini sebelumnya",
                    "message": "Report sudah ada"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create report
            print(f"  Creating report...")
            report = api_models.Question_Answer_Report.objects.create(
                question=question,
                reported_by=user,
                reason=reason,
                description=description
            )
            print(f"  Report created: {report.id}")
            
            return Response({
                "message": "Laporan berhasil dikirim. Terima kasih atas laporannya.",
                "report_id": report.id
            }, status=status.HTTP_201_CREATED)

        except User.DoesNotExist:
            print(f"ERROR: User not found with id={user_id}")
            return Response({"error": "User tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Question_Answer.DoesNotExist:
            print(f"ERROR: Question not found with qa_id={qa_id}")
            return Response({"error": "Question tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"ERROR in QuestionAnswerReportAPIView: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request, *args, **kwargs):
        """
        ✨ PHASE 7.16+: Update existing Q&A report (edit mode)
        PUT /api/v1/student/question-answer-report/{report_id}/
        Body: {user_id, reason, description, status}
        """
        try:
            report_id = self.kwargs.get('qa_id')  # Note: URL param is qa_id but it's actually the report_id
            user_id = request.data.get('user_id')
            reason = request.data.get('reason', 'other')
            description = request.data.get('description', '')
            status_update = request.data.get('status', 'pending')

            print(f"DEBUG: QuestionAnswerReportAPIView.put() called")
            print(f"  report_id: {report_id}")
            print(f"  user_id: {user_id}")
            print(f"  reason: {reason}")
            print(f"  description: {description}")
            print(f"  status: {status_update}")

            if not all([user_id, report_id]):
                return Response(
                    {"error": "Missing required fields: user_id, report_id"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate reason choice
            valid_reasons = ['spam', 'inappropriate', 'offensive', 'misinformation', 'other']
            if reason not in valid_reasons:
                return Response(
                    {"error": f"Invalid reason. Valid options: {', '.join(valid_reasons)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get existing report
            print(f"  Getting report with id={report_id}")
            report = api_models.Question_Answer_Report.objects.get(id=report_id)
            print(f"  Report found: {report}")

            # Verify the user is the one who created this report
            if report.reported_by.id != int(user_id):
                return Response(
                    {"error": "Anda tidak memiliki izin untuk mengubah laporan ini"}, 
                    status=status.HTTP_403_FORBIDDEN
                )

            # Update report fields
            print(f"  Updating report...")
            report.reason = reason
            report.description = description
            # Always reset to pending when user re-applies
            report.status = 'pending'
            report.save()
            print(f"  Report updated: {report.id}")

            return Response({
                "message": "Laporan berhasil diperbarui. Laporan akan ditinjau ulang oleh Admin.",
                "report_id": report.id,
                "status": report.status
            }, status=status.HTTP_200_OK)

        except api_models.Question_Answer_Report.DoesNotExist:
            print(f"ERROR: Report not found with id={report_id}")
            return Response({"error": "Laporan tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except User.DoesNotExist:
            print(f"ERROR: User not found with id={user_id}")
            return Response({"error": "User tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"ERROR in QuestionAnswerReportAPIView.put: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ✨ PHASE 7.16: Q&A Message Report endpoint
class QuestionAnswerMessageReportAPIView(generics.CreateAPIView):
    """
    Q&A Message Report API - Report inappropriate message/reply
    
    POST /api/v1/student/question-answer-message-report/{qa_id}/
    Body: {user_id, reason, description}
    Reasons: spam, inappropriate, offensive, misinformation, other
    Note: qa_id here refers to the message qa_id (qam_id), not the question qa_id
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        try:
            qa_id = self.kwargs.get('qa_id')
            user_id = request.data.get('user_id')
            reason = request.data.get('reason', 'other')
            description = request.data.get('description', '')

            print(f"DEBUG: QuestionAnswerMessageReportAPIView.create() called")
            print(f"  qa_id: {qa_id}")
            print(f"  user_id: {user_id}")
            print(f"  reason: {reason}")
            print(f"  description: {description}")

            if not all([user_id, qa_id]):
                return Response(
                    {"error": "Missing required fields: user_id, qa_id"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate reason choice
            valid_reasons = ['spam', 'inappropriate', 'offensive', 'misinformation', 'other']
            if reason not in valid_reasons:
                return Response(
                    {"error": f"Invalid reason. Valid options: {', '.join(valid_reasons)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            print(f"  Getting user with id={user_id}")
            user = User.objects.get(id=user_id)
            print(f"  User found: {user}")
            
            print(f"  Getting message with qa_id={qa_id}")
            # qa_id here is actually the message qa_id (qam_id)
            message = api_models.Question_Answer_Message.objects.get(qa_id=qa_id)
            print(f"  Message found: {message}")
            
            # Check if already reported by this user
            existing_report = api_models.Question_Answer_Message_Report.objects.filter(
                message=message,
                reported_by=user
            ).first()
            
            if existing_report:
                return Response({
                    "error": "Anda sudah melaporkan pesan ini sebelumnya",
                    "message": "Report sudah ada"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create report
            print(f"  Creating message report...")
            report = api_models.Question_Answer_Message_Report.objects.create(
                message=message,
                reported_by=user,
                reason=reason,
                description=description
            )
            print(f"  Message report created: {report.id}")
            
            return Response({
                "message": "Laporan berhasil dikirim. Terima kasih atas laporannya.",
                "report_id": report.id
            }, status=status.HTTP_201_CREATED)

        except User.DoesNotExist:
            print(f"ERROR: User not found with id={user_id}")
            return Response({"error": "User tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Question_Answer_Message.DoesNotExist:
            print(f"ERROR: Message not found with qa_id={qa_id}")
            return Response({"error": "Message tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"ERROR in QuestionAnswerMessageReportAPIView: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request, *args, **kwargs):
        """
        ✨ PHASE 7.16+: Update existing Q&A message report (edit mode)
        PUT /api/v1/student/question-answer-message-report/{report_id}/
        Body: {user_id, reason, description, status}
        """
        try:
            report_id = self.kwargs.get('qa_id')  # Note: URL param is qa_id but it's actually the report_id
            user_id = request.data.get('user_id')
            reason = request.data.get('reason', 'other')
            description = request.data.get('description', '')
            status_update = request.data.get('status', 'pending')

            print(f"DEBUG: QuestionAnswerMessageReportAPIView.put() called")
            print(f"  report_id: {report_id}")
            print(f"  user_id: {user_id}")
            print(f"  reason: {reason}")
            print(f"  description: {description}")
            print(f"  status: {status_update}")

            if not all([user_id, report_id]):
                return Response(
                    {"error": "Missing required fields: user_id, report_id"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate reason choice
            valid_reasons = ['spam', 'inappropriate', 'offensive', 'misinformation', 'other']
            if reason not in valid_reasons:
                return Response(
                    {"error": f"Invalid reason. Valid options: {', '.join(valid_reasons)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get existing message report
            print(f"  Getting message report with id={report_id}")
            report = api_models.Question_Answer_Message_Report.objects.get(id=report_id)
            print(f"  Message report found: {report}")

            # Verify the user is the one who created this report
            if report.reported_by.id != int(user_id):
                return Response(
                    {"error": "Anda tidak memiliki izin untuk mengubah laporan ini"}, 
                    status=status.HTTP_403_FORBIDDEN
                )

            # Update report fields
            print(f"  Updating message report...")
            report.reason = reason
            report.description = description
            # Always reset to pending when user re-applies
            report.status = 'pending'
            report.save()
            print(f"  Message report updated: {report.id}")

            return Response({
                "message": "Laporan berhasil diperbarui. Laporan akan ditinjau ulang oleh Admin.",
                "report_id": report.id,
                "status": report.status
            }, status=status.HTTP_200_OK)

        except api_models.Question_Answer_Message_Report.DoesNotExist:
            print(f"ERROR: Message report not found with id={report_id}")
            return Response({"error": "Laporan tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except User.DoesNotExist:
            print(f"ERROR: User not found with id={user_id}")
            return Response({"error": "User tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"ERROR in QuestionAnswerMessageReportAPIView.put: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ✨ PHASE 7.16: Fetch Q&A Reports for User
class StudentQAReportsAPIView(generics.ListAPIView):
    """
    Get Q&A reports submitted by the current user for a course
    
    GET /api/v1/student/qa-reports/{course_id}/
    Returns: List of Q&A reports submitted by this user
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        try:
            user_id_str = request.query_params.get('user_id')
            course_id_str = self.kwargs.get('course_id')

            # ✨ Validate user_id
            try:
                user_id = int(user_id_str) if user_id_str else None
            except (ValueError, TypeError) as e:
                return Response(
                    {"error": f"Invalid user_id: {e}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ✨ PHASE 7.17+: Make course_id optional - get all user reports or filtered by course
            if not user_id:
                return Response(
                    {"error": "Missing user_id parameter"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ✨ PHASE 7.16+: Enhanced endpoint to include admin review feedback
            # Get Q&A reports for this user (all courses, or filtered by course if provided)
            
            # Build filter dynamically
            # ✨ PHASE 7.17+: FIX - course_id from frontend is ShortUUID, need to find actual course database id
            qa_filter = {'reported_by': user_id}
            actual_course_db_id = None
            
            if course_id_str:
                try:
                    # course_id_str is the Course.course_id field (ShortUUID), need to find Course database id
                    course_obj = api_models.Course.objects.get(course_id=course_id_str)
                    actual_course_db_id = course_obj.id
                    qa_filter['question__course_id'] = actual_course_db_id
                except api_models.Course.DoesNotExist:
                    pass
            
            question_reports = list(
                api_models.Question_Answer_Report.objects.filter(
                    **qa_filter
                ).values(
                    'id', 
                    'question__qa_id',
                    'question__course_id',  # Include course database id
                    'status', 
                    'reason', 
                    'reported_at',
                    'reviewed_at',  # When admin reviewed
                    'review_notes',  # Admin's decision/feedback
                    'reviewed_by__first_name',  # Admin's name
                    'reviewed_by__username',  # Admin's username as fallback
                    'description'  # Original report description
                )
            )
            

            
            # Build message filter dynamically
            msg_filter = {'reported_by': user_id}
            
            if actual_course_db_id:
                msg_filter['message__course_id'] = actual_course_db_id
            
            message_reports = list(
                api_models.Question_Answer_Message_Report.objects.filter(
                    **msg_filter
                ).values(
                    'id', 
                    'message__qa_id',
                    'message__course_id',  # Include course database id
                    'status', 
                    'reason', 
                    'reported_at',
                    'reviewed_at',  # When admin reviewed
                    'review_notes',  # Admin's decision/feedback
                    'reviewed_by__first_name',  # Admin's name
                    'reviewed_by__username',  # Admin's username as fallback
                    'description'  # Original report description
                )
            )
            
            # Format response
            reports = {
                'question_reports': question_reports,
                'message_reports': message_reports
            }

            return Response(reports, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"ERROR in StudentQAReportsAPIView: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# Student Quiz API Views
class StudentQuizListAPIView(generics.ListAPIView):
    """List all active quizzes for a specific course"""
    serializer_class = api_serializer.QuizSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]
    
    def get_queryset(self):
        course_id = self.kwargs['course_id']
        # Find the course by course_id field, then filter quizzes by the actual Course instance
        try:
            course = api_models.Course.objects.get(course_id=course_id)
            return api_models.Quiz.objects.filter(
                course=course,
                is_active=True
            ).prefetch_related('questions__choices')
        except api_models.Course.DoesNotExist:
            return api_models.Quiz.objects.none()

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # Add attempt information and sequential lock status for each quiz
        user_id = self.kwargs.get('user_id')
        if user_id:
            user = User.objects.get(id=user_id)
            course_id = self.kwargs.get('course_id')
            course = api_models.Course.objects.filter(course_id=course_id).first()
            
            # Check pre-test status for course
            pre_post_quiz = api_models.Quiz.objects.filter(course=course, quiz_type='pre_post_test', is_active=True).first() if course else None
            pre_test_completed = False
            pre_test_score = 0
            post_test_completed = False
            post_test_score = 0
            
            if pre_post_quiz:
                attempts = api_models.QuizAttempt.objects.filter(user=user, quiz=pre_post_quiz).order_by('date_attempted')
                pre_att = attempts.filter(attempt_type='pre_test').first()
                if pre_att:
                    pre_test_completed = True
                    pre_test_score = float(pre_att.score)
                post_att = attempts.filter(attempt_type='post_test').first()
                if post_att:
                    post_test_completed = True
                    post_test_score = float(post_att.score)

            enrollment = api_models.EnrolledCourse.objects.filter(user=user, course=course).first() if course else None
            all_lessons_completed = enrollment.is_course_completed() if enrollment else False
            all_regular_quizzes_passed = enrollment.are_all_quizzes_passed() if enrollment else False
            all_games_completed = enrollment.are_all_games_completed() if enrollment else True
            can_take_post_test = all_lessons_completed and all_regular_quizzes_passed and all_games_completed

            prev_regular_passed = True

            for quiz_data in serializer.data:
                quiz = api_models.Quiz.objects.get(quiz_id=quiz_data['quiz_id'])
                best_attempt = api_models.QuizAttempt.objects.filter(user=user, quiz=quiz).order_by('-score').first()

                if quiz.quiz_type == 'pre_post_test':
                    quiz_data['has_pre_test'] = pre_test_completed
                    quiz_data['pre_test_score'] = pre_test_score
                    quiz_data['has_post_test'] = post_test_completed
                    quiz_data['post_test_score'] = post_test_score
                    quiz_data['can_take_post_test'] = can_take_post_test
                    quiz_data['best_score'] = max(pre_test_score, post_test_score)
                    
                    if not pre_test_completed:
                        quiz_data['current_mode'] = 'pre_test'
                        quiz_data['is_locked'] = False
                        quiz_data['lock_reason'] = None
                        quiz_data['can_attempt'] = True
                        quiz_data['today_attempts'] = 0
                        quiz_data['is_passed'] = False
                    elif not post_test_completed:
                        quiz_data['current_mode'] = 'post_test'
                        quiz_data['today_attempts'] = 0
                        quiz_data['is_passed'] = False
                        if can_take_post_test:
                            quiz_data['is_locked'] = False
                            quiz_data['lock_reason'] = None
                            quiz_data['can_attempt'] = True
                        else:
                            quiz_data['is_locked'] = True
                            if not all_games_completed:
                                quiz_data['lock_reason'] = "Selesaikan seluruh mini-game pada tab Gamifikasi terlebih dahulu untuk membuka Post-test"
                            elif not all_lessons_completed:
                                quiz_data['lock_reason'] = "Selesaikan seluruh materi kurikulum kursus terlebih dahulu untuk membuka Post-test"
                            elif not all_regular_quizzes_passed:
                                quiz_data['lock_reason'] = "Selesaikan dan luluskan semua kuis materi terlebih dahulu untuk membuka Post-test"
                            else:
                                quiz_data['lock_reason'] = "Selesaikan seluruh materi kurikulum, kuis, dan gamifikasi kursus terlebih dahulu untuk membuka Post-test"
                            quiz_data['can_attempt'] = False
                    else:
                        quiz_data['current_mode'] = 'completed'
                        quiz_data['is_locked'] = True
                        quiz_data['lock_reason'] = "Pre-test dan Post-test telah selesai dikerjakan"
                        quiz_data['can_attempt'] = False
                        quiz_data['today_attempts'] = 1
                        quiz_data['is_passed'] = bool(post_att and post_att.is_passed)
                else:
                    today_attempts = api_models.QuizAttempt.get_daily_attempts_count(user, quiz, attempt_type='quiz')
                    can_attempt = api_models.QuizAttempt.can_attempt_quiz(user, quiz, attempt_type='quiz')
                    
                    quiz_data['today_attempts'] = today_attempts
                    quiz_data['can_attempt'] = can_attempt
                    quiz_data['best_score'] = best_attempt.score if best_attempt else 0
                    quiz_data['is_passed'] = best_attempt.is_passed if best_attempt else False
                    quiz_data['current_mode'] = 'quiz'
                    if pre_post_quiz and not pre_test_completed:
                        quiz_data['is_locked'] = True
                        quiz_data['lock_reason'] = "Selesaikan Pre-test terlebih dahulu untuk membuka kuis kursus"
                    elif not prev_regular_passed:
                        quiz_data['is_locked'] = True
                        quiz_data['lock_reason'] = "Selesaikan dan lulus kuis sebelumnya terlebih dahulu"
                    else:
                        quiz_data['is_locked'] = False
                        quiz_data['lock_reason'] = None
                    
                    prev_regular_passed = bool(best_attempt and best_attempt.is_passed)
        
        return Response(serializer.data)




class StudentQuizDetailAPIView(generics.RetrieveAPIView):
    """Get quiz details for taking the quiz"""
    serializer_class = api_serializer.QuizSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]
    lookup_field = 'quiz_id'
    
    def get_queryset(self):
        return api_models.Quiz.objects.filter(is_active=True).prefetch_related(
            'questions__choices'
        )
    
    def retrieve(self, request, *args, **kwargs):
        # Check if user can attempt this quiz
        user_id = kwargs.get('user_id')
        quiz = self.get_object()
        
        if user_id:
            try:
                user = User.objects.get(id=user_id)
                # Get the serialized data
                serializer = self.get_serializer(quiz)
                quiz_data = serializer.data
                
                # If presentation mode is random, shuffle questions for student
                if getattr(quiz, 'presentation_mode', 'ordered') == 'random' and 'questions' in quiz_data and isinstance(quiz_data['questions'], list):
                    import random
                    shuffled_questions = list(quiz_data['questions'])
                    random.shuffle(shuffled_questions)
                    quiz_data['questions'] = shuffled_questions

                # Add attempt information
                if quiz.quiz_type == 'pre_post_test':
                    pre_att = api_models.QuizAttempt.objects.filter(user=user, quiz=quiz, attempt_type='pre_test').first()
                    post_att = api_models.QuizAttempt.objects.filter(user=user, quiz=quiz, attempt_type='post_test').first()
                    has_pre = bool(pre_att)
                    has_post = bool(post_att)

                    enrollment = api_models.EnrolledCourse.objects.filter(user=user, course=quiz.course).first()
                    can_take_post = (enrollment.is_course_completed() and enrollment.are_all_quizzes_passed()) if enrollment else False

                    quiz_data['has_pre_test'] = has_pre
                    quiz_data['has_post_test'] = has_post
                    quiz_data['pre_test_score'] = float(pre_att.score) if pre_att else 0
                    quiz_data['post_test_score'] = float(post_att.score) if post_att else 0
                    quiz_data['can_take_post_test'] = can_take_post

                    if not has_pre:
                        quiz_data['current_mode'] = 'pre_test'
                        quiz_data['can_attempt'] = True
                        quiz_data['today_attempts'] = 0
                        quiz_data['is_locked'] = False
                        quiz_data['lock_reason'] = None
                        quiz_data['is_passed'] = False
                    elif not has_post:
                        quiz_data['current_mode'] = 'post_test'
                        quiz_data['can_attempt'] = can_take_post
                        quiz_data['today_attempts'] = 0
                        quiz_data['is_locked'] = not can_take_post
                        quiz_data['lock_reason'] = None if can_take_post else "Selesaikan seluruh materi kurikulum dan kuis kursus terlebih dahulu untuk membuka Post-test"
                        quiz_data['is_passed'] = False
                    else:
                        quiz_data['current_mode'] = 'completed'
                        quiz_data['can_attempt'] = False
                        quiz_data['today_attempts'] = 1
                        quiz_data['is_locked'] = True
                        quiz_data['lock_reason'] = "Pre-test dan Post-test telah selesai dikerjakan"
                        quiz_data['is_passed'] = bool(post_att and post_att.is_passed)

                    quiz_data['best_score'] = max(quiz_data['pre_test_score'], quiz_data['post_test_score'])
                else:
                    today_attempts = api_models.QuizAttempt.get_daily_attempts_count(user, quiz, attempt_type='quiz')
                    can_attempt = api_models.QuizAttempt.can_attempt_quiz(user, quiz, attempt_type='quiz')
                    best_attempt = api_models.QuizAttempt.objects.filter(
                        user=user, quiz=quiz
                    ).order_by('-score').first()

                    quiz_data['today_attempts'] = today_attempts
                    quiz_data['can_attempt'] = can_attempt
                    quiz_data['best_score'] = best_attempt.score if best_attempt else 0
                    quiz_data['is_passed'] = best_attempt.is_passed if best_attempt else False
                
                return Response(quiz_data)
                
            except User.DoesNotExist:
                return Response(
                    {"error": "User not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        return super().retrieve(request, *args, **kwargs)




@method_decorator(csrf_exempt, name='dispatch')
class StudentQuizSubmitAPIView(generics.CreateAPIView):
    """
    Student Quiz Submission API
    
    CSRF exempt because:
    - Uses JWT authentication for student operations
    - Submits quiz answers and calculates scores
    - Data validated by QuizSubmissionSerializer
    """
    serializer_class = api_serializer.QuizSubmissionSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]
    
    def create(self, request, *args, **kwargs):
        user_id = kwargs.get('user_id')
        print(f"Quiz submission received for user_id: {user_id}")
        print(f"Request data: {request.data}")
        
        serializer = self.get_serializer(data=request.data)
        
        if serializer.is_valid():
            quiz_id = serializer.validated_data['quiz_id']
            answers = serializer.validated_data['answers']
            time_taken = serializer.validated_data.get('time_taken')
            
            print(f"Validated data - quiz_id: {quiz_id}, answers: {answers}, time_taken: {time_taken}")
            
            try:
                user = User.objects.get(id=user_id)
                quiz = api_models.Quiz.objects.get(quiz_id=quiz_id)
                course = quiz.course
                
                # Determine attempt_type
                req_attempt_type = request.data.get('attempt_type')
                if quiz.quiz_type == 'pre_post_test':
                    has_pre = api_models.QuizAttempt.objects.filter(user=user, quiz=quiz, attempt_type='pre_test').exists()
                    if req_attempt_type == 'pre_test' or not has_pre:
                        final_attempt_type = 'pre_test'
                        is_pre_test = True
                    else:
                        final_attempt_type = 'post_test'
                        is_pre_test = False
                else:
                    final_attempt_type = 'quiz'
                    is_pre_test = False

                # Check prerequisites for post-test (lessons + quizzes + gamification)
                if final_attempt_type == 'post_test':
                    enrollment = api_models.EnrolledCourse.objects.filter(user=user, course=quiz.course).first()
                    if enrollment:
                        if not enrollment.are_all_games_completed():
                            return Response(
                                {"error": "Post-test terkunci. Anda harus menyelesaikan seluruh tantangan mini-game pada tab Gamifikasi terlebih dahulu."},
                                status=status.HTTP_403_FORBIDDEN
                            )
                        if not enrollment.is_course_completed():
                            return Response(
                                {"error": "Post-test terkunci. Anda harus menyelesaikan seluruh materi kurikulum terlebih dahulu."},
                                status=status.HTTP_403_FORBIDDEN
                            )
                        if not enrollment.are_all_quizzes_passed():
                            return Response(
                                {"error": "Post-test terkunci. Anda harus menyelesaikan dan lulus seluruh kuis materi terlebih dahulu."},
                                status=status.HTTP_403_FORBIDDEN
                            )

                # Check if user can attempt
                if not api_models.QuizAttempt.can_attempt_quiz(user, quiz, attempt_type=final_attempt_type):
                    err_msg = "Pre-test sudah pernah dikerjakan dan telah dikunci" if final_attempt_type == 'pre_test' else (
                        "Post-test sudah pernah dikerjakan dan telah dikunci" if final_attempt_type == 'post_test' else
                        "Batas maksimum 3 percobaan harian telah tercapai"
                    )
                    return Response(
                        {"error": err_msg},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # Calculate score
                total_questions = quiz.questions.count()
                correct_answers = 0
                
                print(f"Total questions in quiz: {total_questions}")
                
                for answer in answers:
                    question_id = answer.get('question_id')
                    choice_id = answer.get('choice_id')
                    
                    print(f"Processing answer - question_id: {question_id}, choice_id: {choice_id}")
                    
                    try:
                        choice = api_models.QuizChoice.objects.get(choice_id=choice_id)
                        if choice.is_correct:
                            correct_answers += 1
                            print(f"Correct answer found for question {question_id}")
                    except api_models.QuizChoice.DoesNotExist:
                        print(f"Choice {choice_id} not found")
                        continue
                
                # Calculate percentage score
                score = (correct_answers / total_questions * 100) if total_questions > 0 else 0
                print(f"Final score: {score}% ({correct_answers}/{total_questions})")
                print(f"Score type: {type(score)}, Score >= 80: {score >= 80}")
                
                # Anti-Cheat Verification: Validasi durasi manusiawi & pelanggaran tab switch
                tab_switch_violations = int(request.data.get('tab_switch_violations', 0))
                min_realistic_quiz_time = max(5, total_questions * 3)
                actual_quiz_time = int(time_taken) if time_taken else 0
                is_suspicious_quiz_speed = (actual_quiz_time < min_realistic_quiz_time and total_questions > 0)

                # Create quiz attempt record
                from datetime import timedelta
                from decimal import Decimal
                time_taken_duration = timedelta(seconds=time_taken) if time_taken else None

                attempt = api_models.QuizAttempt.objects.create(
                    user=user,
                    quiz=quiz,
                    score=Decimal(str(score)),
                    total_questions=total_questions,
                    correct_answers=correct_answers,
                    time_taken=time_taken_duration,
                    attempt_type=final_attempt_type,
                    _points_awarded=False
                )
                if is_pre_test:
                    attempt.is_passed = True
                    attempt.save()
                
                # Refresh the attempt from database
                attempt.refresh_from_db()
                
                print(f"Quiz attempt created - score: {attempt.score}, is_passed: {attempt.is_passed}, pass_status: {attempt.pass_status}")
                
                # Calculate updated attempt information after submission
                today_attempts = api_models.QuizAttempt.get_daily_attempts_count(user, quiz, attempt_type=final_attempt_type)
                can_attempt = api_models.QuizAttempt.can_attempt_quiz(user, quiz, attempt_type=final_attempt_type)
                attempts_left = max(0, 3 - today_attempts)
                
                print(f"After submission - today_attempts: {today_attempts}, can_attempt: {can_attempt}, attempts_left: {attempts_left}")
                
                # Check integrity status & learning comparison for student transparency
                enrollment = api_models.EnrolledCourse.objects.filter(user=user, course=quiz.course).first()
                integrity_info = enrollment.check_integrity_status() if enrollment else {"is_valid": True, "status": "verified", "reasons": []}

                learning_comparison = None
                if final_attempt_type == 'post_test' and getattr(quiz, 'quiz_type', '') == 'pre_post_test':
                    pre_att = api_models.QuizAttempt.objects.filter(
                        user=user, quiz=quiz, attempt_type='pre_test'
                    ).order_by('date_attempted').first()
                    if pre_att:
                        pre_sc = float(pre_att.score)
                        post_sc = float(score)
                        gain = round(post_sc - pre_sc, 1)
                        norm_gain = round((gain / (100.0 - pre_sc) * 100.0), 1) if pre_sc < 100 else 0.0
                        learning_comparison = {
                            "has_pre": True,
                            "pre_score": pre_sc,
                            "post_score": post_sc,
                            "improvement": gain,
                            "normalized_gain": norm_gain
                        }

                # ✨ Notifikasi otomatis saat post-test selesai
                if final_attempt_type == 'post_test':
                    try:
                        if integrity_info.get("status") == "pending_review":
                            # Notifikasi Instruktur
                            if course.teacher and course.teacher.user:
                                reasons_str = "; ".join(integrity_info.get("reasons", [])) or "Durasi atau perpindahan fokus tidak wajar"
                                api_models.Notification.objects.create(
                                    user=course.teacher.user,
                                    teacher=course.teacher,
                                    course=course,
                                    type="Exam Review Needed",
                                    title=f"Verifikasi Integritas Ujian: {user.full_name}",
                                    message=f"Peserta {user.full_name} telah menyelesaikan Post-Test pada materi '{course.title}' dengan indikasi anomali ({reasons_str}). Harap tinjau di Halaman Evaluasi Kursus.",
                                    seen=False
                                )
                            # Notifikasi Siswa
                            api_models.Notification.objects.create(
                                user=user,
                                course=course,
                                type="Exam Pending Review",
                                title=f"Ujian Selesai - Menunggu Peninjauan: {course.title}",
                                message=f"Pengerjaan Post-Test Anda untuk materi '{course.title}' telah dicatat dan saat ini memerlukan peninjauan integritas oleh Instruktur.",
                                seen=False
                            )
                        elif integrity_info.get("is_valid", True) and attempt.is_passed:
                            api_models.Notification.objects.create(
                                user=user,
                                course=course,
                                type="Exam Verified",
                                title=f"Selamat! Anda Lulus Ujian - {course.title}",
                                message=f"Selamat! Anda telah menyelesaikan dan lulus evaluasi Post-Test materi '{course.title}' dengan nilai {round(score, 1)}.",
                                seen=False
                            )
                    except Exception as notif_sub_err:
                        print(f"Error creating post-test notification: {notif_sub_err}")

                # Serialize the attempt
                attempt_serializer = api_serializer.QuizAttemptSerializer(attempt)
                
                return Response({
                    "message": "Quiz submitted successfully",
                    "attempt": attempt_serializer.data,
                    "score": score,
                    "correct_answers": correct_answers,
                    "total_questions": total_questions,
                    "is_passed": attempt.is_passed,
                    "passed": attempt.is_passed,  # Add this for frontend compatibility
                    "pass_status": attempt.pass_status,
                    "time_taken": time_taken,  # Add the original time_taken in seconds
                    "today_attempts": today_attempts,
                    "can_attempt": can_attempt,
                    "attempts_left": attempts_left,
                    "max_daily_attempts": 3,
                    "is_pre_test": final_attempt_type == 'pre_test',
                    "is_post_test": final_attempt_type == 'post_test',
                    "integrity": {
                        "is_valid": integrity_info.get("is_valid", True),
                        "status": integrity_info.get("status", "verified"),
                        "reasons": integrity_info.get("reasons", []),
                        "tab_switch_violations": tab_switch_violations,
                        "is_suspicious_quiz_speed": is_suspicious_quiz_speed
                    },
                    "learning_comparison": learning_comparison
                }, status=status.HTTP_201_CREATED)
                
            except api_models.Quiz.DoesNotExist:
                print(f"Quiz {quiz_id} not found")
                return Response(
                    {"error": "Quiz not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            except User.DoesNotExist:
                print(f"User {user_id} not found")
                return Response(
                    {"error": "User not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        print(f"Serializer errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)




class StudentQuizAttemptsAPIView(generics.ListAPIView):
    """List all quiz attempts by a user"""
    serializer_class = api_serializer.QuizAttemptSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]
    
    def get_queryset(self):
        user_id = self.kwargs['user_id']
        quiz_id = self.kwargs.get('quiz_id')

        queryset = api_models.QuizAttempt.objects.filter(user__id=user_id)

        if quiz_id:
            queryset = queryset.filter(quiz__quiz_id=quiz_id)

        return queryset.order_by('-date_attempted')




# Certificate API Views
@method_decorator(csrf_exempt, name='dispatch')
class StudentCertificateEligibilityAPIView(APIView):
    """Check if student is eligible for certificate and return certificate data (Mengatasi Pentest H-01 IDOR)"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    
    def get(self, request, user_id, course_id):
        try:
            # Get user and course
            user = User.objects.get(id=user_id)
            course = api_models.Course.objects.get(course_id=course_id)
            
            # Get enrollment
            enrollment = api_models.EnrolledCourse.objects.filter(
                user=user, course=course
            ).first()
            
            if not enrollment:
                return Response({
                    'is_eligible': False,
                    'message': 'Not enrolled in this course',
                    'certificate': None,
                    'quiz_results': []
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Get quiz results
            quiz_results = enrollment.quiz_results()
            
            # Check eligibility
            is_eligible = enrollment.is_certificate_eligible()
            
            # Get existing certificate if any
            certificate = None
            try:
                existing_cert = api_models.Certificate.objects.get(
                    course=course, user=user
                )
                certificate = api_serializer.CertificateSerializer(existing_cert, context={'request': request}).data
            except api_models.Certificate.DoesNotExist:
                pass
            
            # Check pre and post test info
            pre_post_quiz = api_models.Quiz.objects.filter(course=course, quiz_type='pre_post_test', is_active=True).first()
            has_pre_post_test = pre_post_quiz is not None
            pre_test_completed = False
            post_test_completed = False
            pre_test_score = 0
            post_test_score = 0
            
            if has_pre_post_test:
                attempts = api_models.QuizAttempt.objects.filter(user=user, quiz=pre_post_quiz).order_by('date_attempted')
                pre_att = attempts.filter(attempt_type='pre_test').first() or attempts.first()
                if pre_att:
                    pre_test_completed = True
                    pre_test_score = float(pre_att.score)
                post_att = attempts.filter(attempt_type='post_test').first()
                if not post_att and attempts.count() >= 2:
                    post_att = attempts.last()
                if post_att and post_att != pre_att:
                    post_test_completed = True
                    post_test_score = float(post_att.score)

            integrity_info = enrollment.check_integrity_status()
            return Response({
                'is_eligible': is_eligible,
                'completion_percentage': round(enrollment.completion_percentage()),
                'all_lessons_completed': enrollment.is_course_completed(),
                'all_quizzes_passed': enrollment.are_all_quizzes_passed(),
                'has_pre_post_test': has_pre_post_test,
                'pre_test_completed': pre_test_completed,
                'post_test_completed': post_test_completed,
                'pre_test_score': pre_test_score,
                'post_test_score': post_test_score,
                'learning_gain': round(post_test_score - pre_test_score, 1) if (pre_test_completed and post_test_completed) else 0,
                'integrity': integrity_info,
                'certificate': certificate,
                'quiz_results': quiz_results
            }, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




@method_decorator(csrf_exempt, name='dispatch')
class StudentCertificateGenerateAPIView(APIView):
    """Generate certificate for eligible student"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def post(self, request):
        try:
            user_id = request.data.get('user_id')
            course_id = request.data.get('course_id')
            enrollment_id = request.data.get('enrollment_id')
            
            # 🔒 Validasi kepemilikan
            is_admin = getattr(request.user, 'is_admin', False) or getattr(request.user, 'is_staff', False)
            if str(request.user.id) != str(user_id) and not is_admin:
                return Response({"error": "Akses ditolak. Anda tidak berhak menerbitkan sertifikat untuk pengguna lain."}, status=status.HTTP_403_FORBIDDEN)
            
            # Get user, course, and enrollment
            user = User.objects.get(id=user_id)
            course = api_models.Course.objects.get(course_id=course_id)
            enrollment = api_models.EnrolledCourse.objects.get(
                enrollment_id=enrollment_id, user=user, course=course
            )
            
            # Check eligibility and integrity status
            integrity_info = enrollment.check_integrity_status()
            if not enrollment.is_certificate_eligible():
                if not integrity_info.get('is_valid', True):
                    reasons_str = " ".join(integrity_info.get('reasons', []))
                    return Response({
                        'error': 'Penerbitan Sertifikat Ditangguhkan',
                        'detail': f'Sertifikat ditangguhkan karena anomali integritas ujian: {reasons_str} Silakan hubungi instruktur kursus Anda untuk verifikasi kelulusan.',
                        'integrity': integrity_info
                    }, status=status.HTTP_400_BAD_REQUEST)
                return Response({
                    'error': 'Not eligible for certificate',
                    'detail': 'Selesaikan seluruh materi pelajaran dan lulus seluruh kuis untuk menerbitkan sertifikat.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create or get existing certificate
            certificate, created = enrollment.get_or_create_certificate()
            
            if certificate:
                certificate_data = api_serializer.CertificateSerializer(certificate, context={'request': request}).data
                message = "Certificate generated successfully!" if created else "Certificate already exists"
                
                return Response({
                    'certificate': certificate_data,
                    'message': message,
                    'created': created
                }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'Failed to generate certificate'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
        except api_models.EnrolledCourse.DoesNotExist:
            return Response({'error': 'Enrollment not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ✨ PHASE 4.222: Save certificate image to server (filename format: course_id_user_id.png)
@method_decorator(csrf_exempt, name='dispatch')
class StudentCertificateSaveImageAPIView(APIView):
    """Save certificate image (PNG only) to server media directory with filename: course_id_user_id.png"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request):
        try:
            file = request.FILES.get('file')
            user_id = request.data.get('user_id')
            course_id = request.data.get('course_id')
            
            # 🔒 Validasi kepemilikan
            is_admin = getattr(request.user, 'is_admin', False) or getattr(request.user, 'is_staff', False)
            if str(request.user.id) != str(user_id) and not is_admin:
                return Response({"error": "Akses ditolak. Anda tidak berhak menyimpan gambar sertifikat pengguna lain."}, status=status.HTTP_403_FORBIDDEN)
            
            if not file:
                return Response({
                    'error': 'No image file provided'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if not user_id or not course_id:
                return Response({
                    'error': 'user_id and course_id are required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get or create certificate
            try:
                user = api_models.User.objects.get(id=user_id)
                course = api_models.Course.objects.get(course_id=course_id)
            except (api_models.User.DoesNotExist, api_models.Course.DoesNotExist):
                return Response({
                    'error': 'User or Course not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            certificate = api_models.Certificate.objects.filter(
                user=user, course=course
            ).first()
            
            if not certificate:
                return Response({
                    'error': 'Certificate not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # ✨ PHASE 4.222: Save image with filename format: {course_id}_{user_id}.png
            filename = f'{course_id}_{user_id}.png'
            certificate.image_file.save(filename, file, save=True)
            
            print(f"[CertificateSaveImage] Saved certificate image: {filename}")
            print(f"[CertificateSaveImage] File path: {certificate.image_file.path if certificate.image_file else 'N/A'}")
            
            return Response({
                'success': True,
                'message': 'Certificate image saved successfully',
                'image_file_url': certificate.image_file.url if certificate.image_file else '',
                'filename': filename
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ✨ PHASE 4.210: Save certificate PDF to server (DEPRECATED - kept for backward compatibility)
@method_decorator(csrf_exempt, name='dispatch')
class StudentCertificateSavePDFAPIView(APIView):
    """Save certificate files (image + PDF) to server media directory - DEPRECATED, use certificate-save-image instead"""
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request):
        try:
            # ✨ PHASE 4.222: Redirect to image endpoint if PNG is provided
            file = request.FILES.get('file')
            user_id = request.data.get('user_id')
            course_id = request.data.get('course_id')
            
            if not file:
                return Response({
                    'error': 'No file provided'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # If it's a PNG image, treat it as certificate image
            if file.content_type == 'image/png' or file.name.endswith('.png'):
                if user_id and course_id:
                    # Use new image endpoint
                    return StudentCertificateSaveImageAPIView().post(request)
                else:
                    return Response({
                        'error': 'user_id and course_id required for PNG files'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # For other file types, continue with old logic (backward compatibility)
            certificate_id = request.data.get('certificate_id')
            
            if not certificate_id:
                return Response({
                    'error': 'certificate_id required for PDF files'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            certificate = api_models.Certificate.objects.get(certificate_id=certificate_id)
            
            # Save as PDF (backward compatibility)
            if file and (file.content_type == 'application/pdf' or file.name.endswith('.pdf')):
                filename = f'Sertifikat_{certificate_id}.pdf'
                certificate.pdf_file.save(filename, file, save=True)
            
            return Response({
                'success': True,
                'message': 'Certificate file saved successfully (deprecated endpoint)'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(xframe_options_exempt, name='dispatch')
class StudentCertificateDownloadAPIView(APIView):
    """Download certificate image (PNG) from server using course_id and user_id (Mengatasi Pentest H-01 IDOR)"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    
    @xframe_options_exempt
    def get(self, request, course_id, user_id):
        try:
            # ✨ PHASE 4.222: Get certificate by course_id and user_id (new format)
            user = api_models.User.objects.get(id=user_id)
            course = api_models.Course.objects.get(course_id=course_id)
            certificate = api_models.Certificate.objects.get(user=user, course=course)
            
            if not certificate.is_valid:
                return Response({
                    'error': 'Certificate is not valid'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # ✨ PHASE 4.222: Serve the certificate image file
            if certificate.image_file:
                import os
                file_path = certificate.image_file.path
                
                if os.path.exists(file_path):
                    with open(file_path, 'rb') as image_file:
                        response = HttpResponse(image_file.read(), content_type='image/png')
                        # Use attachment disposition for download
                        filename = f'{course_id}_{user_id}.png'
                        response['Content-Disposition'] = f'attachment; filename="{filename}"'
                        response['Content-Type'] = 'image/png'
                        return response
            
            # Fallback: return JSON with message
            return Response({
                'error': 'Certificate image not available',
                'message': 'Certificate image has not been generated yet. Please generate certificate first.'
            }, status=status.HTTP_404_NOT_FOUND)
                
        except api_models.User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
        except api_models.Certificate.DoesNotExist:
            return Response({'error': 'Certificate not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ✨ PHASE 4.221: Certificate Image Display Endpoint
@method_decorator(xframe_options_exempt, name='dispatch')
class StudentCertificateImageAPIView(APIView):
    """Serve certificate image (PNG) for display in frontend - allows img tag embedding"""
    authentication_classes = []
    permission_classes = [AllowAny]  # Allow anyone with certificate ID to view
    
    @xframe_options_exempt
    def get(self, request, certificate_id):
        try:
            # Get certificate
            certificate = api_models.Certificate.objects.get(certificate_id=certificate_id)
            
            if not certificate.is_valid:
                return Response({
                    'error': 'Certificate is not valid'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # ✨ PHASE 4.221: Serve certificate image if available
            if certificate.image_file:
                import os
                file_path = certificate.image_file.path
                
                if os.path.exists(file_path):
                    with open(file_path, 'rb') as image_file:
                        response = HttpResponse(image_file.read(), content_type='image/png')
                        # Use inline disposition for img tag display
                        response['Content-Disposition'] = f'inline; filename="Sertifikat_{certificate.certificate_id}.png"'
                        response['Cache-Control'] = 'max-age=86400'  # Cache for 24 hours
                        return response
            
            # Fallback: return JSON with message
            return Response({
                'error': 'Certificate image not available',
                'message': 'Certificate image is being generated. Please refresh the page.'
            }, status=status.HTTP_404_NOT_FOUND)
                
        except api_models.Certificate.DoesNotExist:
            return Response({'error': 'Certificate not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ✨ PHASE 4.228: List all certificates for a student (new endpoint for "Sertifikat Kursus" page)
@method_decorator(csrf_exempt, name='dispatch')
class StudentCertificateListAPIView(APIView):
    """List all certificates for the current student (Mengatasi Temuan Pentest H-01 IDOR)"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    
    def get(self, request, user_id):
        """Get all certificates for a specific student"""
        try:
            # Get all certificates for the user
            certificates = api_models.Certificate.objects.filter(
                user_id=user_id,
                is_valid=True  # Only show valid certificates
            ).select_related('course', 'course__teacher', 'course__category', 'user').order_by('-created_at')
            
            if not certificates.exists():
                return Response({
                    'count': 0,
                    'results': [],
                    'message': 'Tidak ada sertifikat yang tersedia'
                }, status=status.HTTP_200_OK)
            
            # Serialize certificates
            certificate_data = api_serializer.CertificateSerializer(
                certificates,
                many=True,
                context={'request': request}
            ).data
            
            return Response({
                'count': len(certificate_data),
                'results': certificate_data,
                'message': 'Sertifikat berhasil diambil'
            }, status=status.HTTP_200_OK)
            
        except api_models.User.DoesNotExist:
            return Response({
                'count': 0,
                'results': [],
                'error': 'User tidak ditemukan'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'count': 0,
                'results': [],
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




@method_decorator(csrf_exempt, name='dispatch')
class CertificateValidationAPIView(APIView):
    """Validate certificate authenticity by validation token"""
    authentication_classes = []
    permission_classes = [AllowAny]  # Public certificate validation
    
    def get(self, request, validation_token):
        """Get certificate details for validation"""
        try:
            certificate = api_models.Certificate.objects.select_related(
                'user', 'course', 'course__teacher'
            ).get(validation_token=validation_token)
            
            if not certificate.is_valid:
                return Response({
                    'is_valid': False,
                    'status': 'invalid',
                    'message': 'This certificate has been marked as invalid',
                    'details': None
                }, status=status.HTTP_200_OK)
            
            # Certificate is valid - return full details
            certificate_details = {
                'certificate_id': certificate.certificate_id,
                'formatted_certificate_id': certificate.get_formatted_certificate_id(),  # ✨ PHASE 4.227: Professional certificate ID format
                'student_name': certificate.user.full_name if certificate.user else 'Unknown',
                'student_email': certificate.user.email if certificate.user else 'Unknown',
                'course_title': certificate.course.title,
                'course_slug': certificate.course.slug,
                'instructor_name': certificate.course.teacher.full_name if certificate.course.teacher else 'Unknown',
                'instructor_email': certificate.course.teacher.user.email if certificate.course.teacher and certificate.course.teacher.user else 'Unknown',
                'completion_date': certificate.date.strftime('%B %d, %Y'),
                'issued_date': certificate.created_at.strftime('%B %d, %Y'),
                'course_level': certificate.course.level,
                'course_category': certificate.course.category.title if certificate.course.category else 'General',
                'image_file_url': request.build_absolute_uri(f'/api/v1/student/certificate-image/{certificate.certificate_id}/') if certificate.image_file else None
            }
            
            return Response({
                'is_valid': True,
                'status': 'valid',
                'message': 'Certificate is authentic and valid',
                'details': certificate_details
            }, status=status.HTTP_200_OK)
                
        except api_models.Certificate.DoesNotExist:
            return Response({
                'is_valid': False,
                'status': 'not_found',
                'message': 'Certificate not found in our system',
                'details': None
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'is_valid': False,
                'status': 'error',
                'message': f'Error validating certificate: {str(e)}',
                'details': None
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




# ✨ PHASE 4.143: Lesson Completion Question Views
class LessonCompletionQuestionListCreateAPIView(generics.ListCreateAPIView):
    """
    ✨ PHASE 4.143: List or create lesson completion questions
    GET: Retrieve question for a specific variant item
    POST: Create a new completion question for a lesson
    """
    serializer_class = api_serializer.LessonCompletionQuestionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter questions by variant_item_id if provided"""
        variant_item_id = self.request.query_params.get('variant_item_id')
        if variant_item_id:
            return api_models.LessonCompletionQuestion.objects.filter(
                variant_item__variant_item_id=variant_item_id
            )
        return api_models.LessonCompletionQuestion.objects.all()
    
    def create(self, request, *args, **kwargs):
        """Create a new completion question with choices"""
        variant_item_id = request.data.get('variant_item_id')
        
        try:
            variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)
        except api_models.VariantItem.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Pelajaran tidak ditemukan'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Check if question already exists for this variant item
        if api_models.LessonCompletionQuestion.objects.filter(variant_item=variant_item).exists():
            return Response({
                'success': False,
                'error': 'Pertanyaan penyelesaian sudah ada untuk pelajaran ini'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        request.data['variant_item'] = variant_item.id
        serializer = api_serializer.LessonCompletionQuestionCreateUpdateSerializer(data=request.data)
        
        if serializer.is_valid():
            question = serializer.save(variant_item=variant_item)
            output_serializer = api_serializer.LessonCompletionQuestionSerializer(question)
            return Response({
                'success': True,
                'message': 'Pertanyaan penyelesaian pelajaran berhasil dibuat',
                'question': output_serializer.data
            }, status=status.HTTP_201_CREATED)
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)




class LessonCompletionQuestionDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    ✨ PHASE 4.143: Retrieve, update, or delete a lesson completion question
    """
    lookup_field = 'question_id'
    serializer_class = api_serializer.LessonCompletionQuestionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return api_models.LessonCompletionQuestion.objects.all()
    
    def update(self, request, *args, **kwargs):
        """Update an existing completion question"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = api_serializer.LessonCompletionQuestionCreateUpdateSerializer(
            instance, data=request.data, partial=partial
        )
        
        if serializer.is_valid():
            question = serializer.save()
            output_serializer = api_serializer.LessonCompletionQuestionSerializer(question)
            return Response({
                'success': True,
                'message': 'Pertanyaan berhasil diperbarui',
                'question': output_serializer.data
            }, status=status.HTTP_200_OK)
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, *args, **kwargs):
        """Delete a completion question"""
        instance = self.get_object()
        instance.delete()
        
        return Response({
            'success': True,
            'message': 'Pertanyaan berhasil dihapus'
        }, status=status.HTTP_204_NO_CONTENT)




class LessonCompletionQuestionAnswerAPIView(APIView):
    """
    ✨ PHASE 4.143: Check student's answer to completion question
    POST: Submit and validate student answer
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """
        Validate student's answer to a completion question
        
        Expected payload:
        {
            "question_id": "abc123",
            "answer": "Option text or short answer"
        }
        
        For multiple choice/multi-select:
        {
            "question_id": "abc123",
            "answer_choice_ids": ["choice_id_1", "choice_id_2"]  # For multi-select
        }
        
        ✨ PHASE 44: CRITICAL FIX - Wrap answer AND completion in same transaction
        This ensures both records are persisted together before response is sent,
        preventing race conditions where answer is not visible when completion is created.
        """
        from django.db import transaction
        
        try:
            question_id = request.data.get('question_id')
            print(f"[PHASE 12.16] 🎯 LessonCompletion ANSWER: Received question_id={question_id}, user={request.user.username}")
            
            question = api_models.LessonCompletionQuestion.objects.get(question_id=question_id)
            print(f"[PHASE 12.16] ✅ Question found: {question.question_text}, variant_item_id={question.variant_item.variant_item_id if question.variant_item else 'None'}")
            print(f"[PHASE 12.16] Question type: {question.question_type}")
            
            is_correct = False
            message = ''
            
            if question.question_type == 'multiple_choice':
                # Single select - check if the provided choice is correct
                answer_choice_id = request.data.get('answer_choice_id')
                print(f"[PHASE 12.16] 🔍 Multiple choice - answer_choice_id={answer_choice_id}")
                
                try:
                    answer_choice = question.choices.get(choice_id=answer_choice_id)
                    is_correct = answer_choice.is_correct
                    print(f"[PHASE 12.16] ✅ Choice found: {answer_choice.choice_text}, is_correct={is_correct}")
                except Exception as choice_error:
                    print(f"[PHASE 12.16] ❌ ERROR finding choice: {choice_error}")
                    is_correct = False
                
                message = 'Jawaban benar!' if is_correct else 'Jawaban salah, silakan coba lagi'
            
            elif question.question_type == 'multi_select':
                # Multi-select - check if all selected choices match correct answers
                answer_choice_ids = request.data.get('answer_choice_ids', [])
                print(f"[PHASE 12.16] 🔍 Multi-select - answer_choice_ids={answer_choice_ids}")
                
                correct_choices = set(
                    question.choices.filter(is_correct=True).values_list('choice_id', flat=True)
                )
                selected_choices = set(answer_choice_ids)
                is_correct = correct_choices == selected_choices
                print(f"[PHASE 12.16] Expected choices: {correct_choices}, Selected: {selected_choices}, is_correct={is_correct}")
                message = 'Jawaban benar!' if is_correct else 'Jawaban salah, silakan coba lagi'
            
            elif question.question_type in ['short_answer', 'fill_in_blank']:
                # Text-based answer - use the check_answer method
                student_answer = request.data.get('answer', '').strip()
                print(f"[PHASE 12.16] 🔍 Short answer - student_answer='{student_answer}'")
                print(f"[PHASE 12.16] Expected answer: '{question.correct_answer_text}', case_sensitive={question.case_sensitive}")
                
                is_correct = question.check_answer(student_answer)
                print(f"[PHASE 12.16] check_answer result: is_correct={is_correct}")
                message = 'Jawaban benar!' if is_correct else 'Jawaban salah, silakan coba lagi'
            
            print(f"[PHASE 12.16] 🎯 ANSWER VALIDATION RESULT: is_correct={is_correct}")
            
            # ✨ PHASE 45: CRITICAL FIX - Use explicit database operations with manual commit
            # With CONN_MAX_AGE=0, connections close immediately. Use explicit transaction control
            # and force database sync to ensure record persists before response
            from django.db import connection, transaction as tx
            
            completion_error = None
            completion_created = False
            completion_variant_item_id = None
            
            try:
                # ✨ PHASE 46: CRITICAL FIX - Removed nested transaction.atomic() wrapper
                # The wrapper was causing silent transaction rollbacks due to savepoint issues
                # when post_save signals were querying within the atomic block.
                # Solution: Use Django's default autocommit mode for safety.
                
                # ✨ PHASE 11.198: Save the answer to LessonCompletionQuestionAnswer model
                try:
                    answer_record = api_models.LessonCompletionQuestionAnswer.objects.create(
                        user=request.user,
                        question=question,
                        is_correct=is_correct
                    )
                    print(f"[PHASE 12.16] ✅ LessonCompletionQuestionAnswer created with is_correct={is_correct}")
                    
                    # Save answer based on question type
                    if question.question_type == 'multiple_choice':
                        answer_choice_id = request.data.get('answer_choice_id')
                        answer_choice = question.choices.get(choice_id=answer_choice_id)
                        answer_record.answer_choice = answer_choice
                        answer_record.save()
                    
                    elif question.question_type == 'multi_select':
                        answer_choice_ids = request.data.get('answer_choice_ids', [])
                        answer_choices = question.choices.filter(choice_id__in=answer_choice_ids)
                        answer_record.answer_choices.set(answer_choices)
                        # ✨ PHASE 44: Force save after M2M set to ensure persistence
                        answer_record.save()
                    
                    elif question.question_type in ['short_answer', 'fill_in_blank']:
                        student_answer = request.data.get('answer', '').strip()
                        answer_record.answer_text = student_answer
                        answer_record.save()
                    
                    print(f"[PHASE 12.16] ✅ Answer details saved. User: {request.user.username}, Q: {question.question_id}, Correct: {is_correct}")
                except Exception as e:
                    print(f"[PHASE 12.16] ❌ ERROR saving answer: {str(e)}")
                    print(f"[PHASE 12.16] Error type: {type(e).__name__}")
                    import traceback
                    traceback.print_exc()
                    raise
                
                # ✨ PHASE 12.16: When answer is correct, mark lesson as completed
                if is_correct:
                    print(f"[PHASE 12.16] 🎓 Answer is CORRECT - Attempting to mark lesson as completed...")
                    try:
                        variant_item = question.variant_item
                        if not variant_item:
                            completion_error = "variant_item is None"
                            print(f"[PHASE 12.16] ❌ ERROR: {completion_error}")
                            raise Exception(completion_error)
                        
                        completion_variant_item_id = variant_item.variant_item_id
                        print(f"[PHASE 12.16] ✅ variant_item: {variant_item.title} (PK: {variant_item.id}, ShortUUID: {variant_item.variant_item_id})")
                        
                        user = request.user
                        print(f"[PHASE 12.16] ✅ user: {user.username} (ID: {user.id})")
                        
                        course_obj = variant_item.variant
                        if not course_obj:
                            completion_error = "variant is None"
                            print(f"[PHASE 12.16] ❌ ERROR: {completion_error}")
                            raise Exception(completion_error)
                        
                        course = course_obj.course
                        if not course:
                            completion_error = "course is None"
                            print(f"[PHASE 12.16] ❌ ERROR: {completion_error}")
                            raise Exception(completion_error)
                        
                        print(f"[PHASE 12.16] ✅ course: {course.title} (ID: {course.id})")
                        
                        # ✨ PHASE 46: Create CompletedLesson WITHOUT nested atomic()
                        print(f"[PHASE 46] 🔍 Creating CompletedLesson with:")
                        print(f"   user_id={user.id}, course_id={course.id}, variant_item_id={variant_item.id}")
                        
                        completed_lesson, created = api_models.CompletedLesson.objects.get_or_create(
                            user_id=user.id,
                            course_id=course.id,
                            variant_item_id=variant_item.id
                        )
                        print(f"[PHASE 38.1] 🔒 CompletedLesson created/retrieved: ID={completed_lesson.id}, created={created}")
                        
                        action = "CREATED" if created else "ALREADY_EXISTS"
                        print(f"[PHASE 12.16] ✅ CompletedLesson {action}: {user.username} → {variant_item.title}")
                        print(f"[PHASE 12.16] CompletedLesson ID: {completed_lesson.id}")
                        print(f"[PHASE 12.16] CompletedLesson FK variant_item_id: {completed_lesson.variant_item_id}")
                        print(f"[PHASE 12.16] CompletedLesson course_id: {completed_lesson.course_id}")
                        print(f"[PHASE 12.16] CompletedLesson user_id: {completed_lesson.user_id}")
                        completion_created = created
                        
                    except Exception as e:
                        completion_error = str(e)
                        print(f"[PHASE 12.16] ❌ ERROR marking lesson as completed: {completion_error}")
                        print(f"[PHASE 12.16] Error type: {type(e).__name__}")
                        import traceback
                        traceback.print_exc()
                        raise
                else:
                    print(f"[PHASE 12.16] ⚠️ Answer is INCORRECT - NOT marking as completed")
                
                # ✨ PHASE 46: Force explicit database commit and verification
                print(f"[PHASE 46] 🔄 Forcing explicit database commit...")
                
                # ✨ PHASE 46: Ensure database connection is active
                from django.db import connection
                connection.ensure_connection()
                
                # Force a dummy query to ensure commits are flushed
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1;")
                print(f"[PHASE 46] ✅ Database commit forced and verified")
                
                # ✨ PHASE 46: Clear any ORM-level query caching to ensure fresh reads
                from django.db import reset_queries
                reset_queries()
                print(f"[PHASE 46] ✅ Cleared Django ORM query cache")
                print(f"[PHASE 45] ✅ Cleared Django ORM query cache")
                
            except Exception as outer_ex:
                print(f"[PHASE 45] ❌ CRITICAL: Transaction failed - {outer_ex}")
                completion_error = str(outer_ex)
                raise
            
            # ✨ PHASE 45: CRITICAL - Verify record actually persisted to database before response
            verification_data = {
                'completion_created': completion_created,
                'completion_error': completion_error,
                'completion_variant_item_id': completion_variant_item_id
            }
            
            if completion_created and not completion_error:
                try:
                    # ✨ PHASE 46: CRITICAL FIX - Use in-memory objects instead of ORM queries
                    # Don't try to fetch the record again - it was just created in this transaction
                    # and might not be immediately visible due to connection/transaction issues
                    # Instead, use the course and completed_lesson objects already in memory
                    
                    # Direct database query to verify persistence
                    from django.db import connection
                    cursor = connection.cursor()
                    cursor.execute("""
                        SELECT id, user_id, course_id, variant_item_id, created_at 
                        FROM api_completedlesson 
                        WHERE user_id = %s AND course_id = %s AND variant_item_id = %s
                        ORDER BY created_at DESC 
                        LIMIT 1
                    """, [request.user.id, 
                          course.id,  # ✨ PHASE 46: Use in-memory course.id instead of .get()
                          variant_item.id])  # ✨ PHASE 46: Use in-memory variant_item.id instead of completed_lesson.variant_item_id
                    
                    result = cursor.fetchone()
                    if result:
                        verification_data['database_verified'] = True
                        verification_data['db_record_id'] = result[0]
                        verification_data['db_verify_message'] = f"✅ Record ID={result[0]} found in database"
                        print(f"[PHASE 45] ✅ VERIFIED: CompletedLesson ID={result[0]} persisted in database")
                    else:
                        verification_data['database_verified'] = False
                        verification_data['db_verify_message'] = "❌ Record created but NOT found in database - PERSISTENCE FAILURE"
                        print(f"[PHASE 45] ❌ CRITICAL: Record NOT found in database despite create() success!")
                        
                except Exception as verify_ex:
                    verification_data['verification_error'] = str(verify_ex)
                    verification_data['db_verify_message'] = f"Verification check failed: {verify_ex}"
                    print(f"[PHASE 46] ⚠️ Verification query failed: {verify_ex}")
            
            return Response({
                'success': True,
                'is_correct': is_correct,
                'message': message,
                'question_type': question.question_type,
                'debug': verification_data
            }, status=status.HTTP_200_OK)
        
        except api_models.LessonCompletionQuestion.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Pertanyaan tidak ditemukan'
            }, status=status.HTTP_404_NOT_FOUND)
        
        except api_models.LessonCompletionQuestionChoice.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Pilihan jawaban tidak ditemukan'
            }, status=status.HTTP_404_NOT_FOUND)
        
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)




# ✨ PHASE 10.1: Ranking API Views
# Retrieve top ranked students and instructors by points

class RankedStudentsAPIView(generics.ListAPIView):
    """
    API endpoint to retrieve ranked students by points.
    Supports filtering by period: lifetime, yearly, monthly
    ✨ PHASE 10.1: Ranking component integration
    """
    serializer_class = api_serializer.RankedStudentSerializer
    permission_classes = [AllowAny]
    pagination_class = None
    
    def get_queryset(self):
        """Get top ranked students sorted by points"""
        period = self.kwargs.get('period', 'lifetime')
        from django.utils import timezone
        now = timezone.now()
        
        try:
            limit = int(self.request.query_params.get('limit', 25))
        except (TypeError, ValueError):
            limit = 25

        if period == 'yearly':
            queryset = api_models.StudentPoints.objects.filter(
                yearly_year=now.year,
                yearly_points__gt=0
            ).order_by('-yearly_points')[:limit]
        elif period == 'monthly':
            queryset = api_models.StudentPoints.objects.filter(
                monthly_year=now.year,
                monthly_month=now.month,
                monthly_points__gt=0
            ).order_by('-monthly_points')[:limit]
        else:  # lifetime
            queryset = api_models.StudentPoints.objects.filter(
                lifetime_points__gt=0
            ).order_by('-lifetime_points')[:limit]
        
        return queryset
    
    def list(self, request, *args, **kwargs):
        """Get ranked students with rank position"""
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


class StudentPointsBreakdownAPIView(APIView):
    """
    GET /api/v1/student/points-breakdown/
    GET /api/v1/student/points-breakdown/?student_id=<id>&user_id=<id>&period=<lifetime|yearly|monthly>
    
    Provides comprehensive breakdown of how a student earned points:
    - Lifetime, Yearly, and Monthly points
    - Categorized summary (completed courses, quiz passed/scores, student ratings/reviews given)
    - Full chronological history from PointsAuditLog
    - Clear rules explaining student point awards
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        user = request.user if request.user.is_authenticated else None
        
        student_id = request.query_params.get('student_id')
        user_id = request.query_params.get('user_id')
        period = request.query_params.get('period', 'lifetime')
        
        target_user = None
        
        # 1. Resolve by user_id
        if user_id:
            target_user = api_models.User.objects.filter(id=user_id).first()
            
        # 2. Resolve by student_id (StudentPoints.id or User.id)
        if not target_user and student_id:
            sp_rec = api_models.StudentPoints.objects.filter(id=student_id).first()
            if sp_rec and sp_rec.user:
                target_user = sp_rec.user
            else:
                target_user = api_models.User.objects.filter(id=student_id).first()
                
        # 3. Fallback to logged-in user
        if not target_user and user:
            target_user = user
            
        if not target_user:
            return Response(
                {"detail": "Siswa / Pengguna tidak ditemukan"},
                status=status.HTTP_404_NOT_FOUND
            )
            
        # Valid student point activity types in accordance with platform gamification rules
        VALID_STUDENT_ACTIVITIES = [
            'course_completion',
            'quiz_score',
            'rating_given',
            'platform_testimonial'
        ]
        
        from django.utils import timezone
        now = timezone.now()
        
        # Self-healing synchronization: Check if student completed courses not yet in PointsAuditLog
        certificates = api_models.Certificate.objects.filter(user=target_user, is_valid=True).select_related('course')
        for cert in certificates:
            if cert.course:
                has_audit = api_models.PointsAuditLog.objects.filter(
                    user=target_user,
                    points_type='student',
                    activity_type='course_completion',
                    course_id=cert.course_id
                ).exists()
                if not has_audit:
                    api_models.StudentPoints.add_points(
                        target_user,
                        100,
                        'course_completion',
                        course_id=cert.course_id,
                        description=f"Menyelesaikan Kursus: {cert.course.title}"
                    )
                
        # Menjalankan rekonsiliasi komprehensif & anti-redundansi (hanya skor kuis tertinggi, hapus duplikasi)
        points_record = api_models.StudentPoints.reconcile_points(target_user)
        
        # Base queryset for valid student logs after reconciliation
        student_logs_qs = api_models.PointsAuditLog.objects.filter(
            user=target_user,
            points_type='student',
            activity_type__in=VALID_STUDENT_ACTIVITIES
        )
        
        lifetime_points_actual = points_record.lifetime_points
        yearly_points_actual = points_record.yearly_points
        monthly_points_actual = points_record.monthly_points
        
        # Filter audit logs and points based on period (lifetime, yearly, monthly)
        if period == 'monthly':
            period_logs_qs = student_logs_qs.filter(
                awarded_at__year=now.year,
                awarded_at__month=now.month
            ).order_by('-awarded_at')
            current_period_points = monthly_points_actual
        elif period == 'yearly':
            period_logs_qs = student_logs_qs.filter(
                awarded_at__year=now.year
            ).order_by('-awarded_at')
            current_period_points = yearly_points_actual
        else:
            period = 'lifetime'
            period_logs_qs = student_logs_qs.order_by('-awarded_at')
            current_period_points = lifetime_points_actual
            
        all_logs = list(period_logs_qs)
        audit_logs = all_logs[:50]
        
        history = []
        for log in audit_logs:
            disp = log.get_activity_type_display()
            if log.activity_type == 'course_completion':
                disp = "Penyelesaian Kursus"
            elif log.activity_type == 'quiz_score':
                disp = "Kuis & Ujian"
            elif log.activity_type == 'rating_given':
                disp = "Ulasan & Rating Kursus"
            elif log.activity_type == 'platform_testimonial':
                disp = "Testimoni Platform"
                
            clean_desc = (log.description or '').strip()
            if not clean_desc:
                clean_desc = f"{disp}: Perolehan Poin Siswa"
                
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
            
        # Summary counts by activity_type for students
        summary = {
            'course_completion': {
                'points': sum(l.points_awarded for l in all_logs if l.activity_type == 'course_completion'),
                'count': sum(1 for l in all_logs if l.activity_type == 'course_completion')
            },
            'quiz_score': {
                'points': sum(l.points_awarded for l in all_logs if l.activity_type == 'quiz_score'),
                'count': sum(1 for l in all_logs if l.activity_type == 'quiz_score')
            },
            'rating_given': {
                'points': sum(l.points_awarded for l in all_logs if l.activity_type in ['rating_given', 'platform_testimonial']),
                'count': sum(1 for l in all_logs if l.activity_type in ['rating_given', 'platform_testimonial'])
            }
        }
        
        # Rank position in student rankings
        rank_pos = None
        if lifetime_points_actual > 0:
            rank_pos = api_models.StudentPoints.objects.filter(
                lifetime_points__gt=lifetime_points_actual
            ).count() + 1
            
        rules = [
            {
                'key': 'course_completion',
                'title': 'Menyelesaikan Kursus Penuh',
                'points_text': '+100 Poin',
                'description': 'Diberikan otomatis setelah menyelesaikan seluruh modul dan materi pada kursus.'
            },
            {
                'key': 'quiz_score',
                'title': 'Kelulusan Kuis & Ujian',
                'points_text': '+25 s/d +100 Poin',
                'description': 'Diberikan berdasarkan pencapaian skor nilai kuis dan tes kompetensi.'
            },
            {
                'key': 'rating_given',
                'title': 'Memberikan Ulasan & Rating',
                'points_text': '+50 Poin',
                'description': 'Diberikan saat Anda memberikan ulasan serta rating bintang terhadap kursus yang diikuti.'
            }
        ]
        
        return Response({
            'user_id': target_user.id,
            'student_name': target_user.get_full_name() or target_user.username,
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


# ==================== PHASE 53: ACTIVITY LOG API VIEWS ====================

class StudentActivityListAPIView(generics.ListAPIView):
    """
    PHASE 53: List activities for the current student
    
    GET /api/v1/student/activities/
    """
    serializer_class = api_serializer.ActivityLogListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination
    
    def get_queryset(self):
        """Filter activities for current student"""
        user = self.request.user
        
        # Self-healing synchronization on load
        try:
            api_models.StudentPoints.reconcile_points(user)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Error reconciling student points: {e}")
            
        queryset = api_models.ActivityLog.objects.filter(
            user=user
        ).filter(
            Q(role_at_time='student') | (Q(role_at_time__isnull=True) & ~Q(activity_type__startswith='course_') & ~Q(activity_type__startswith='quiz_created') & ~Q(activity_type__startswith='lesson_created'))
        ).exclude(role_at_time='instructor')
        
        # Filter by activity type
        activity_type = self.request.query_params.get('activity_type')
        if activity_type:
            if ',' in activity_type:
                types = [t.strip() for t in activity_type.split(',') if t.strip()]
                queryset = queryset.filter(activity_type__in=types)
            else:
                queryset = queryset.filter(activity_type=activity_type)
        
        # Filter by course
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        
        # Filter by success status
        success = self.request.query_params.get('success')
        if success:
            queryset = queryset.filter(success=success.lower() == 'true')
        
        # Filter by search keyword
        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(course__title__icontains=search) |
                Q(lesson__title__icontains=search) |
                Q(quiz__title__icontains=search)
            )
        
        return queryset.order_by('-activity_date')




class StudentActivityDetailAPIView(generics.RetrieveAPIView):
    """
    PHASE 53: Get detailed information about a specific activity
    
    GET /api/v1/student/activities/<activity_id>/
    """
    serializer_class = api_serializer.ActivityLogSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Only allow users to view their own activities"""
        return api_models.ActivityLog.objects.filter(user=self.request.user)




class StudentActivityStatsAPIView(APIView):
    """
    PHASE 53: Get activity statistics summary for current student
    
    GET /api/v1/student/activities/stats/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        now = timezone.now()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        
        # Run self-healing reconciliation
        try:
            api_models.StudentPoints.reconcile_points(user)
        except Exception:
            pass
            
        # Get all activities for student
        all_activities = api_models.ActivityLog.objects.filter(
            user=user
        ).filter(
            Q(role_at_time='student') | (Q(role_at_time__isnull=True) & ~Q(activity_type__startswith='course_'))
        ).exclude(role_at_time='instructor')
        
        # Calculate statistics
        total_activities = all_activities.count()
        activities_this_week = all_activities.filter(activity_date__gte=week_ago).count()
        activities_this_month = all_activities.filter(activity_date__gte=month_ago).count()
        
        sp = api_models.StudentPoints.objects.filter(user=user).first()
        points_earned = sp.lifetime_points if sp else 0
        
        # Get most active course
        most_active_course = None
        most_active_count = 0
        course_activities = all_activities.values('course').annotate(
            count=Count('id')
        ).order_by('-count').first()
        
        if course_activities:
            try:
                most_active_course = api_models.Course.objects.get(id=course_activities['course'])
                most_active_count = course_activities['count']
            except:
                pass
        
        # Get top activity types
        top_activity_types = list(
            all_activities.values('activity_type').annotate(
                count=Count('id')
            ).order_by('-count')[:5]
        )
        
        # Add display names
        for activity in top_activity_types:
            choices_dict = dict(api_models.ActivityLog.ACTIVITY_TYPE_CHOICES)
            activity['display'] = choices_dict.get(activity['activity_type'], activity['activity_type'])
        
        # Get recent student activities
        recent_activities = all_activities.order_by('-activity_date')[:10]
        
        data = {
            'total_activities': total_activities,
            'activities_this_week': activities_this_week,
            'activities_this_month': activities_this_month,
            'points_earned': points_earned,
            'most_active_course': most_active_course,
            'course_activity_count': most_active_count,
            'top_activity_types': top_activity_types,
            'recent_activities': recent_activities
        }
        
        serializer = api_serializer.ActivityStatsSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)






# =====================================================================
# Student Gamification API Views
# =====================================================================
class StudentCourseGameListAPIView(generics.ListAPIView):
    """List all active games for a specific course with user progress"""
    serializer_class = api_serializer.CourseGameSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]
    pagination_class = None

    def get_queryset(self):
        course_id = self.kwargs.get('course_id')
        return api_models.CourseGame.objects.filter(
            course__course_id=course_id,
            is_active=True
        ).order_by('order', 'date')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user_id = self.kwargs.get('user_id')
        if user_id:
            try:
                context['user'] = User.objects.get(id=user_id)
            except User.DoesNotExist:
                context['user'] = self.request.user
        else:
            context['user'] = self.request.user
        return context

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class StudentCourseGameDetailAPIView(generics.RetrieveAPIView):
    """Retrieve details for a specific game for student"""
    serializer_class = api_serializer.CourseGameSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]
    lookup_field = 'game_id'

    def get_queryset(self):
        return api_models.CourseGame.objects.filter(is_active=True)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user_id = self.kwargs.get('user_id')
        if user_id:
            try:
                context['user'] = User.objects.get(id=user_id)
            except User.DoesNotExist:
                context['user'] = self.request.user
        else:
            context['user'] = self.request.user
        return context


class StudentCourseGameSubmitAPIView(APIView):
    """Submit attempt for a course game"""
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def post(self, request, user_id):
        game_id = request.data.get('game_id')
        score = request.data.get('score', 0)
        time_taken = request.data.get('time_taken', 0)
        answers_data = request.data.get('answers_data', {})
        is_passed = request.data.get('is_passed', False)

        try:
            user = User.objects.get(id=user_id)
            game = api_models.CourseGame.objects.get(game_id=game_id)

            # Check if pre-test is completed for courses requiring pre-test
            pre_post_quiz = api_models.Quiz.objects.filter(course=game.course, quiz_type='pre_post_test', is_active=True).first()
            if pre_post_quiz:
                has_pre = api_models.QuizAttempt.objects.filter(user=user, quiz=pre_post_quiz, attempt_type='pre_test').exists()
                if not has_pre:
                    return Response(
                        {"error": "Gamifikasi terkunci. Anda harus menyelesaikan Pre-test Diagnostik terlebih dahulu."},
                        status=status.HTTP_403_FORBIDDEN
                    )

            attempts_count = game.get_user_attempts_count(user)
            if attempts_count >= game.max_attempts:
                return Response(
                    {"error": f"Batas maksimum {game.max_attempts} percobaan untuk game ini telah tercapai."},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Convert score to float / decimal
            score_val = float(score) if score is not None else 0.0
            if score_val < 0:
                score_val = 0.0
            elif score_val > 100:
                score_val = 100.0

            attempt_number = attempts_count + 1
            has_passed = is_passed or (score_val >= 70.0)

            # Anti-Cheat: Validasi batas waktu manusiawi pengerjaan game
            # Mini game dengan skor >= 70% mustahil diselesaikan manusia dalam < 8 detik
            actual_game_time = int(time_taken) if time_taken else 0
            is_game_speed_anomaly = (actual_game_time < 8 and score_val >= 70.0)

            # Check if this user has already earned points for this game
            already_passed = game.attempts.filter(user=user, is_passed=True).exists()
            points_awarded = 0
            if has_passed and not already_passed and not is_game_speed_anomaly:
                points_awarded = game.points_reward

            attempt = api_models.CourseGameAttempt.objects.create(
                user=user,
                game=game,
                attempt_number=attempt_number,
                score=score_val,
                is_passed=has_passed,
                time_taken=int(time_taken) if time_taken else 0,
                answers_data=answers_data if isinstance(answers_data, dict) else {},
                points_awarded=points_awarded
            )

            # Award student ranking points
            if points_awarded > 0:
                try:
                    api_models.StudentPoints.add_points(
                        user=user,
                        points=points_awarded,
                        category='points_earned',
                        course_id=game.course.course_id,
                        description=f"Menyelesaikan mini game {game.title} ({game.get_game_type_display()})"
                    )
                except Exception as e:
                    print(f"Error adding student points: {e}")

            today_attempts = attempts_count + 1
            attempts_left = max(0, game.max_attempts - today_attempts)
            can_attempt = attempts_left > 0

            return Response({
                "message": "Game attempt submitted successfully",
                "attempt": api_serializer.CourseGameAttemptSerializer(attempt).data,
                "score": score_val,
                "is_passed": has_passed,
                "points_awarded": points_awarded,
                "attempt_number": attempt_number,
                "attempts_left": attempts_left,
                "can_attempt": can_attempt,
                "max_attempts": game.max_attempts
            }, status=status.HTTP_201_CREATED)

        except User.DoesNotExist:
            return Response({"error": "User tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except api_models.CourseGame.DoesNotExist:
            return Response({"error": "Game tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# =====================================================================
# Course Leaderboard: Peringkat Siswa Per Kursus (Composite Mastery XP)
# =====================================================================

class CourseLeaderboardAPIView(APIView):
    """
    API endpoint untuk Papan Peringkat Peserta Kursus (Course Leaderboard).
    Menghitung skor gabungan (Composite Course Mastery XP) dari:
    1. Kuis Materi (Quiz Mastery Score) - Bobot 25% (0 - 250 XP)
    2. Efektivitas Pembelajaran (Learning Gain Pre-to-Post Test) - Bobot 35% (0 - 350 XP)
    3. Skor & Waktu Gamifikasi (Gamification Mastery & Speed) - Bobot 20% (0 - 200 XP)
    4. Kecepatan & Ketuntasan Kursus (Completion Pace) - Bobot 20% (0 - 200 XP)
    
    Total Course XP: 0 - 1.000 XP
    Terhubung langsung dengan StudentPoints & profil global siswa LMS Setjen DPD RI.
    """
    permission_classes = [AllowAny]

    def get(self, request, course_id):
        # 1. Resolusi course berdasarkan id, course_id (ShortUUID), slug, atau enrollment_id
        course = None
        if str(course_id).isdigit():
            course = api_models.Course.objects.filter(id=int(course_id)).first()
        if not course:
            course = api_models.Course.objects.filter(course_id=str(course_id)).first()
        if not course:
            course = api_models.Course.objects.filter(slug=str(course_id)).first()
        if not course:
            enr = api_models.EnrolledCourse.objects.filter(enrollment_id=str(course_id)).select_related('course').first()
            if enr:
                course = enr.course

        if not course:
            return Response(
                {"error": f"Kursus dengan ID '{course_id}' tidak ditemukan"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Current user resolution
        current_user = request.user if (request.user and request.user.is_authenticated) else None
        req_user_id = request.query_params.get('user_id')
        if req_user_id and not current_user:
            current_user = User.objects.filter(id=req_user_id).first()

        # Resolusi seluruh ID versi terkait dalam satu keluarga kursus (Draft & Published Copy)
        related_course_ids = course.get_related_course_ids() if hasattr(course, 'get_related_course_ids') else {course.id}

        # 2. Ambil seluruh peserta terdaftar di kursus ini (termasuk versi terbitan / salinan draft)
        enrollments = api_models.EnrolledCourse.objects.filter(course_id__in=related_course_ids).select_related('user', 'user__profile')
        enrolled_users_dict = {}
        for enr in enrollments:
            if enr.user and enr.user.id not in enrolled_users_dict:
                enrolled_users_dict[enr.user.id] = (enr.user, enr)

        # 3. Komponen pembelajaran kursus (representatif unik)
        all_regular = api_models.Quiz.objects.filter(course_id__in=related_course_ids, quiz_type='quiz', is_active=True)
        seen_quiz_titles = set()
        regular_quizzes = []
        for q in all_regular:
            if q.title not in seen_quiz_titles:
                seen_quiz_titles.add(q.title)
                regular_quizzes.append(q)

        pre_post_quiz = api_models.Quiz.objects.filter(course_id__in=related_course_ids, quiz_type='pre_post_test', is_active=True).first()

        # Modul E-Learning SCORM kurikulum kursus
        scorm_variant_items = api_models.VariantItem.objects.filter(
            variant__course_id__in=related_course_ids,
            learning_module__isnull=False
        ).select_related('learning_module')
        
        seen_scorm_ids = set()
        course_scorm_modules = []
        for it in scorm_variant_items:
            if it.learning_module_id and it.learning_module_id not in seen_scorm_ids:
                seen_scorm_ids.add(it.learning_module_id)
                course_scorm_modules.append(it.learning_module)
                
        # Jika tidak ada di variant item kurikulum, periksa di level Course
        if not course_scorm_modules:
            course_modules = api_models.Course.objects.filter(
                id__in=related_course_ids,
                learning_module__isnull=False
            ).values_list('learning_module_id', flat=True).distinct()
            for mid in course_modules:
                if mid and mid not in seen_scorm_ids:
                    lm = api_models.LearningModule.objects.filter(id=mid).first()
                    if lm:
                        seen_scorm_ids.add(mid)
                        course_scorm_modules.append(lm)

        all_games = api_models.CourseGame.objects.filter(course_id__in=related_course_ids, is_active=True)
        seen_game_keys = set()
        course_games = []
        for g in all_games:
            key = f"{g.game_type}:{g.title}"
            if key not in seen_game_keys:
                seen_game_keys.add(key)
                course_games.append(g)

        leaderboard_data = []

        for uid, (user, enr) in enrolled_users_dict.items():
            completion_pct = enr.completion_percentage()

            # A. Kuis Reguler & Evaluasi SCORM (Quiz Mastery)
            quiz_scores = []
            passed_quizzes_count = 0
            for q in regular_quizzes:
                best_att = api_models.QuizAttempt.objects.filter(user=user, quiz__course_id__in=related_course_ids, quiz__title=q.title).order_by('-score').first()
                if best_att:
                    s = float(best_att.score)
                    quiz_scores.append(s)
                    if best_att.is_passed:
                        passed_quizzes_count += 1
                else:
                    quiz_scores.append(0.0)

            # Sertakan skor tes/kuis dari paket SCORM
            scorm_scores = []
            passed_scorm_count = 0
            for sm in course_scorm_modules:
                sm_prog = api_models.UserProgress.objects.filter(user=user, learning_module=sm).first()
                if sm_prog:
                    s_score = float(sm_prog.score_raw or 0.0)
                    scorm_scores.append(s_score)
                    if sm_prog.lesson_status in ['passed', 'completed']:
                        passed_scorm_count += 1
                else:
                    scorm_scores.append(0.0)

            total_eval_items = len(regular_quizzes) + len(course_scorm_modules)
            all_eval_scores = quiz_scores + scorm_scores
            total_passed_eval = passed_quizzes_count + passed_scorm_count

            if total_eval_items > 0:
                avg_quiz_score = round(sum(all_eval_scores) / len(all_eval_scores), 1)
                quiz_points = round((avg_quiz_score / 100.0) * 250.0, 1)
            else:
                avg_quiz_score = 100.0 if enr.is_course_completed() else round(float(completion_pct), 1)
                quiz_points = 250.0 if enr.is_course_completed() else round((float(completion_pct) / 100.0) * 250.0, 1)

            # B. Efektivitas Pembelajaran (Learning Gain Pre-to-Post Test)
            pre_att = None
            post_att = None
            if pre_post_quiz:
                pre_att = api_models.QuizAttempt.objects.filter(user=user, quiz__course_id__in=related_course_ids, quiz__quiz_type='pre_post_test', attempt_type='pre_test').order_by('date_attempted').first()
                post_att = api_models.QuizAttempt.objects.filter(user=user, quiz__course_id__in=related_course_ids, quiz__quiz_type='pre_post_test', attempt_type='post_test').order_by('-score').first()

            has_pre = pre_att is not None
            has_post = post_att is not None
            pre_score = float(pre_att.score) if has_pre else None
            post_score = float(post_att.score) if has_post else None

            if has_pre and has_post:
                score_improvement = round(post_score - pre_score, 1)
                if pre_score < 100.0:
                    raw_gain = ((post_score - pre_score) / (100.0 - pre_score)) * 100.0
                    normalized_gain = round(max(0.0, min(100.0, raw_gain)), 1)
                else:
                    normalized_gain = 100.0 if post_score >= 100.0 else 0.0

                if normalized_gain >= 70.0 or score_improvement >= 40.0:
                    gain_status = "Efektivitas Sangat Tinggi"
                    gain_badge = "success"
                elif normalized_gain >= 30.0 or score_improvement >= 20.0:
                    gain_status = "Efektivitas Sedang"
                    gain_badge = "primary"
                else:
                    gain_status = "Peningkatan Stabil"
                    gain_badge = "info"

                post_comp = (post_score / 100.0) * 200.0
                gain_comp = (max(0.0, score_improvement) / 100.0) * 150.0
                learning_points = round(post_comp + gain_comp, 1)

            elif has_pre:
                score_improvement = 0.0
                normalized_gain = 0.0
                gain_status = "Sedang Belajar"
                gain_badge = "warning"
                learning_points = round((pre_score / 100.0) * 50.0, 1)
            else:
                score_improvement = 0.0
                normalized_gain = 0.0
                gain_status = "Belum Pre-test"
                gain_badge = "secondary"
                learning_points = 0.0

            # C. Gamifikasi (Skor & Waktu Game)
            completed_games_count = 0
            game_scores = []
            total_game_time = 0
            game_reward_points = 0

            for game in course_games:
                best_ga = api_models.CourseGameAttempt.objects.filter(user=user, game__course_id__in=related_course_ids, game__game_type=game.game_type).order_by('-score', 'time_taken').first()
                if best_ga:
                    completed_games_count += 1
                    game_scores.append(float(best_ga.score))
                    total_game_time += int(best_ga.time_taken)
                    game_reward_points += int(best_ga.points_awarded)

            if course_games:
                avg_game_score = round(sum(game_scores) / len(course_games), 1) if game_scores else 0.0
                game_base_xp = (avg_game_score / 100.0) * 160.0
                # Speed & completeness bonus
                completion_bonus = 40.0 if (completed_games_count == len(course_games) and len(course_games) > 0) else (completed_games_count * 8.0)
                gamification_points = round(min(200.0, game_base_xp + completion_bonus), 1)
            else:
                # Opsi A: Jika kursus tidak memiliki modul game tersendiri, poin gamifikasi (maks 200 XP)
                # diberikan/dinormalisasi bertahap mengikuti persentase ketuntasan materi kursus (0% = 0 XP, 100% = 200 XP)
                avg_game_score = 100.0 if enr.is_course_completed() else round(float(completion_pct), 1)
                gamification_points = 200.0 if enr.is_course_completed() else round((float(completion_pct) / 100.0) * 200.0, 1)

            # D. Kecepatan & Ketuntasan Kursus (Completion Pace)
            start_time = pre_att.date_attempted if pre_att else enr.date
            cert = api_models.Certificate.objects.filter(user=user, course_id__in=related_course_ids, is_valid=True).first()
            
            is_completed = False
            finish_time = None
            if post_att and post_att.is_passed:
                finish_time = post_att.date_attempted
                is_completed = True
            elif cert:
                finish_time = cert.date
                is_completed = True

            duration_seconds = None
            duration_human = "Sedang Belajar"
            if is_completed and finish_time and start_time:
                raw_diff = (finish_time - start_time).total_seconds()
                delta_sec = max(60, int(abs(raw_diff)))
                duration_seconds = delta_sec
                days = delta_sec // 86400
                hours = (delta_sec % 86400) // 3600
                minutes = (delta_sec % 3600) // 60
                seconds = delta_sec % 60
                if days > 0:
                    duration_human = f"{days}h {hours}j {minutes}m"
                elif hours > 0:
                    duration_human = f"{hours} jam {minutes} menit"
                elif minutes > 0:
                    duration_human = f"{minutes} menit {seconds} dtk"
                else:
                    duration_human = f"{seconds} detik"

                # Anti-Cheat: Verifikasi ambang batas waktu wajar ketuntasan kursus
                # Menyelesaikan seluruh materi kurikulum, kuis materi, game, dan post-test mustahil dilakukan manusia dalam < 3 menit (180 detik)
                MIN_COURSE_COMPLETION_SECONDS = 180
                is_pace_anomaly = (delta_sec < MIN_COURSE_COMPLETION_SECONDS)

                # Pace Score (120 XP base + up to 80 XP speed bonus)
                if is_pace_anomaly:
                    # Anomali kecepatan: gugurkan seluruh bonus kecepatan demi keabsahan peringkat
                    pace_bonus = 0.0
                    duration_human = f"{duration_human} (Diverifikasi)"
                elif delta_sec <= 3600:
                    pace_bonus = 80.0
                elif delta_sec <= 14400:
                    pace_bonus = 60.0
                elif delta_sec <= 86400:
                    pace_bonus = 45.0
                elif delta_sec <= 259200:
                    pace_bonus = 30.0
                elif delta_sec <= 604800:
                    pace_bonus = 20.0
                else:
                    pace_bonus = 10.0
                pace_points = round(120.0 + pace_bonus, 1)
            else:
                pace_points = round((float(completion_pct) / 100.0) * 100.0, 1)

            # E. Total Course Mastery XP (Maksimal 1.000 XP)
            total_course_xp = int(round(quiz_points + learning_points + gamification_points + pace_points))

            # F. Global Student Points & Profile Data
            sp = api_models.StudentPoints.objects.filter(user=user).first()
            lifetime_pts = sp.lifetime_points if sp else 0
            if lifetime_pts >= 2000:
                level_name = "Master DPD RI"
                level_icon = "fas fa-crown"
                level_color = "#f59e0b"
            elif lifetime_pts >= 1000:
                level_name = "Pakar Inovasi"
                level_icon = "fas fa-award"
                level_color = "#8b5cf6"
            elif lifetime_pts >= 500:
                level_name = "Pembelajar Unggul"
                level_icon = "fas fa-medal"
                level_color = "#06b6d4"
            elif lifetime_pts >= 100:
                level_name = "Siswa Aktif"
                level_icon = "fas fa-star"
                level_color = "#10b981"
            else:
                level_name = "Pemula"
                level_icon = "fas fa-seedling"
                level_color = "#64748b"

            avatar_url = None
            try:
                if hasattr(user, 'profile') and user.profile and user.profile.image:
                    avatar_url = user.profile.image.url if hasattr(user.profile.image, "url") else str(user.profile.image)
            except Exception:
                avatar_url = None

            full_display_name = user.get_full_name() or user.username
            is_me = (current_user and current_user.id == user.id)

            # Get employee / ASN profile metadata
            nip = "-"
            unit_kerja = "-"
            jabatan = "-"
            golongan = "-"
            try:
                prof = getattr(user, 'profile', None)
                if prof:
                    nip = prof.nip or "-"
                    if prof.organization_unit:
                        unit_kerja = getattr(prof.organization_unit, 'name', str(prof.organization_unit))
                    if prof.position:
                        jabatan = getattr(prof.position, 'name', str(prof.position))
                    golongan = prof.golongan or "-"
            except Exception:
                pass

            student_integrity = enr.check_integrity_status()
            leaderboard_data.append({
                "user_id": user.id,
                "username": user.username,
                "full_name": full_display_name,
                "avatar": avatar_url,
                "employee_info": {
                    "nip": nip,
                    "unit_kerja": unit_kerja,
                    "jabatan": jabatan,
                    "golongan": golongan
                },
                "is_current_user": is_me,
                "total_points": total_course_xp,
                "integrity_check": {
                    "is_valid": student_integrity["is_valid"],
                    "status": student_integrity["status"],
                    "is_manual_approved": student_integrity["is_manual_approved"],
                    "reasons": student_integrity["reasons"],
                    "has_certificate": cert is not None and cert.is_valid,
                    "certificate_id": cert.certificate_id if cert else None
                },
                "quiz_stats": {
                    "total_quizzes": total_eval_items,
                    "passed_quizzes": total_passed_eval,
                    "avg_score": avg_quiz_score,
                    "points": quiz_points
                },
                "learning_stats": {
                    "has_pre": has_pre,
                    "has_post": has_post,
                    "pre_score": pre_score,
                    "post_score": post_score,
                    "improvement": score_improvement,
                    "normalized_gain": normalized_gain,
                    "status": gain_status,
                    "badge": gain_badge,
                    "points": learning_points
                },
                "gamification_stats": {
                    "total_games": len(course_games),
                    "completed_games": completed_games_count,
                    "avg_score": avg_game_score,
                    "total_time_seconds": total_game_time,
                    "total_reward_points": game_reward_points,
                    "points": gamification_points
                },
                "completion_stats": {
                    "is_completed": is_completed,
                    "start_time": start_time,
                    "finish_time": finish_time,
                    "duration_seconds": duration_seconds,
                    "duration_human": duration_human,
                    "points": pace_points
                },
                "global_stats": {
                    "lifetime_points": lifetime_pts,
                    "level_name": level_name,
                    "level_icon": level_icon,
                    "level_color": level_color
                }
            })

        # 4. Urutkan Leaderboard:
        def sort_key(item):
            comp_order = 0 if item["completion_stats"]["is_completed"] else 1
            dur = item["completion_stats"]["duration_seconds"] if item["completion_stats"]["duration_seconds"] is not None else 99999999
            post_sc = item["learning_stats"]["post_score"] if item["learning_stats"]["post_score"] is not None else -1
            return (-item["total_points"], comp_order, -post_sc, dur)

        leaderboard_data.sort(key=sort_key)

        # Sematkan Rank Position & Badge Medali
        for idx, item in enumerate(leaderboard_data, start=1):
            item["rank"] = idx
            if idx == 1:
                item["medal"] = "gold"
            elif idx == 2:
                item["medal"] = "silver"
            elif idx == 3:
                item["medal"] = "bronze"
            else:
                item["medal"] = None

        # Ambil statistik user yang sedang login jika ada
        my_stats = None
        if current_user:
            for item in leaderboard_data:
                if item["user_id"] == current_user.id:
                    my_stats = item
                    break

        # Top 3 Podium
        podium = leaderboard_data[:3]

        # 5. Data Evaluasi & Ulasan Kursus (Level 1 Kirkpatrick - Kepuasan & Feedback Peserta)
        reviews_qs = api_models.Review.objects.filter(course_id__in=related_course_ids, active=True).select_related('user', 'user__profile').order_by('-date')
        reviews_list = []
        rating_dist = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
        total_rating_sum = 0
        for r in reviews_qs:
            rating = int(r.rating or 0)
            if rating in rating_dist:
                rating_dist[rating] += 1
            total_rating_sum += rating

            prof = getattr(r.user, 'profile', None)
            user_name = prof.full_name if (prof and prof.full_name) else (r.user.get_full_name() or r.user.username)
            avatar = None
            if prof and prof.image:
                avatar = prof.image.url if hasattr(prof.image, 'url') else str(prof.image)

            reviews_list.append({
                "id": r.id,
                "user_id": r.user.id,
                "full_name": user_name,
                "avatar": avatar,
                "rating": rating,
                "review": r.review,
                "reply": r.reply,
                "date": r.date.strftime("%d %b %Y") if r.date else "",
                "formatted_date": r.date.isoformat() if r.date else None
            })

        reviews_count = len(reviews_list)
        avg_rating = round(total_rating_sum / reviews_count, 1) if reviews_count > 0 else 0.0
        satisfaction_pct = round((sum(rating_dist[k] for k in [4, 5]) / reviews_count) * 100) if reviews_count > 0 else 0

        evaluation_data = {
            "total_reviews": reviews_count,
            "average_rating": avg_rating,
            "satisfaction_rate": satisfaction_pct,
            "rating_distribution": rating_dist,
            "reviews": reviews_list
        }

        return Response({
            "course": {
                "id": course.id,
                "course_id": course.course_id,
                "title": course.title,
                "image": (course.image.url if hasattr(course.image, "url") else str(course.image)) if course.image else None,
                "total_students": len(leaderboard_data)
            },
            "my_stats": my_stats,
            "podium": podium,
            "leaderboard": leaderboard_data,
            "evaluation": evaluation_data,
            "scoring_formula": {
                "quiz_weight": "25% (Maks 250 XP)",
                "learning_gain_weight": "35% (Maks 350 XP)",
                "gamification_weight": "20% (Maks 200 XP)",
                "completion_pace_weight": "20% (Maks 200 XP)",
                "total_max_xp": 1000
            }
        }, status=status.HTTP_200_OK)


# ==================== STUDENT NOTIFICATION API VIEWS ====================

class StudentNotificationListAPIView(generics.ListAPIView):
    """List notifikasi in-app untuk siswa (Anti-IDOR protected)"""
    serializer_class = api_serializer.NotificationSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_queryset(self):
        user_id = self.kwargs.get('user_id')
        if not self.request.user.is_staff and str(self.request.user.id) != str(user_id):
            return api_models.Notification.objects.none()
        return api_models.Notification.objects.filter(user_id=user_id, teacher__isnull=True).order_by('-date')


class StudentNotificationDetailAPIView(generics.RetrieveUpdateAPIView):
    """Detail dan update status seen notifikasi siswa"""
    serializer_class = api_serializer.NotificationSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_object(self):
        user_id = self.kwargs.get('user_id')
        noti_id = self.kwargs.get('noti_id')
        if not self.request.user.is_staff and str(self.request.user.id) != str(user_id):
            raise PermissionDenied("Akses ditolak")
        return api_models.Notification.objects.get(user_id=user_id, id=noti_id)


class StudentNotificationMarkAllReadAPIView(APIView):
    """Tandai seluruh notifikasi siswa sebagai telah dibaca"""
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request, user_id):
        if not request.user.is_staff and str(request.user.id) != str(user_id):
            return Response({"error": "Akses ditolak"}, status=status.HTTP_403_FORBIDDEN)
        updated = api_models.Notification.objects.filter(user_id=user_id, teacher__isnull=True, seen=False).update(seen=True)
        return Response({"success": True, "updated_count": updated}, status=status.HTTP_200_OK)
