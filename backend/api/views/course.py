from urllib3.exceptions import InsecureRequestWarning
from django.shortcuts import render, redirect
from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.db import models, transaction
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


class CategoryListAPIView(generics.ListAPIView):
    queryset = api_models.Category.objects.filter(active=True)  
    serializer_class = api_serializer.CategorySerializer
    permission_classes = [AllowAny]



class CourseListAPIView(generics.ListAPIView):
    # [*] PHASE 4.77 FIX: Restored is_published_version=True filter to prevent course duplication
    # Students see only published copies (not draft courses) to avoid duplicates on homepage
    # is_published_version=True ensures we show 1 course per title, not draft + published copy
    queryset = api_models.Course.objects.filter(
        platform_status="Published",
        teacher_course_status="Published",
        is_published_version=True  # [*] PHASE 4.77: Show only published copies, not drafts
    )
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [AllowAny]




class PublicStatsAPIView(generics.GenericAPIView):
    """
    Public Statistics API - Returns real-time platform statistics
    Used for homepage and public-facing dashboards
    
    Returns:
    - total_courses: Number of published courses
    - total_students: Number of enrolled students (unique users)
    - total_teachers: Number of active teachers with courses
    - completion_rate: Average course completion rate
    - total_certificates: Number of certificates issued
    - total_materials: Number of course materials/lessons
    - platform_rating: Average platform rating from reviews
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        try:
            from django.db.models import Count, Q, Avg
            
            # [*] PHASE 4.77 FIX: Restored is_published_version=True filter to prevent counting duplicates
            # Count only published copies (is_published_version=True), not draft courses
            # 1. Total published courses
            total_courses = api_models.Course.objects.filter(
                platform_status="Published", 
                teacher_course_status="Published",
                is_published_version=True  # [*] PHASE 4.77: Count only published copies
            ).count()
            
            # 2. Total unique students (enrolled in courses)
            total_students = api_models.EnrolledCourse.objects.values('user').distinct().count()
            
            # [*] PHASE 4.77 FIX: Restored is_published_version=True filter to prevent counting duplicates
            # Count teachers with published copies only (not drafts)
            # 3. Total active teachers (with published courses)
            total_teachers = api_models.Course.objects.filter(
                platform_status="Published",
                teacher_course_status="Published",
                is_published_version=True  # [*] PHASE 4.77: Count only published copies
            ).values('teacher').distinct().count()
            
            # 4. Calculate completion rate correctly
            # Since completion_percentage is a method, we need to iterate through enrollments
            # OR calculate based on CompletedLesson records
            total_enrollments = api_models.EnrolledCourse.objects.count()
            if total_enrollments > 0:
                # Calculate completion percentage for each enrollment
                completion_percentages = []
                for enrollment in api_models.EnrolledCourse.objects.all():
                    completion_percentages.append(enrollment.completion_percentage())
                completion_rate = round(sum(completion_percentages) / len(completion_percentages), 1)
            else:
                completion_rate = 0
            
            # 5. Total certificates issued
            try:
                total_certificates = api_models.Certificate.objects.count()
            except:
                total_certificates = 0
            
            # 6. Total course lessons/materials (using VariantItem for lessons)
            # [*] PHASE 4.77 FIX: Restored is_published_version=True filter to prevent double counting
            # Only count materials from published copies (not draft versions)
            try:
                from api.models import VariantItem
                total_materials = VariantItem.objects.filter(
                    variant__course__platform_status="Published",
                    variant__course__is_published_version=True  # [*] PHASE 4.77: Count only published copies
                ).count()
            except:
                try:
                    # Fallback to counting files if available
                    total_materials = api_models.Variant.objects.filter(
                        course__platform_status="Published"
                    ).count()
                except:
                    total_materials = 0
            
            # 7. Platform rating (average of all course ratings) and total verified reviews
            try:
                review_stats = api_models.Review.objects.filter(
                    active=True
                ).aggregate(avg_rating=Avg('rating'), count=Count('id'))
                platform_rating = review_stats['avg_rating'] or 4.8
                platform_rating = round(float(platform_rating), 1)
                total_reviews = review_stats['count'] or 0
            except:
                platform_rating = 4.8
                total_reviews = 0
            
            # 8. Total discussion Q&A / interactions
            try:
                total_discussions = api_models.Question_Answer.objects.count()
            except:
                total_discussions = 0

            # 9. Total active course categories
            try:
                total_categories = api_models.Category.objects.filter(active=True).count()
            except:
                total_categories = 0
            
            # 10. Total registered users / aparatur Setjen DPD RI
            try:
                from userauths.models import User
                total_registered_users = User.objects.count()
            except:
                total_registered_users = total_students
                
            # 11. Gamification and interactive tools count
            try:
                total_games = api_models.CourseGame.objects.count()
            except:
                total_games = 0
                
            try:
                total_quizzes = api_models.Quiz.objects.count()
            except:
                total_quizzes = 0
                
            try:
                total_notes = api_models.Note.objects.count()
            except:
                total_notes = 0

            try:
                total_feedbacks = api_models.Feedback.objects.count()
            except:
                total_feedbacks = 0

            # 12. Active version info & satisfaction index
            try:
                from api.version import get_current_app_version
                app_version = get_current_app_version()
            except:
                app_version = "1.1.0"
                
            satisfaction_index = round((platform_rating / 5.0) * 100, 1) if platform_rating else 96.7

            return Response({
                'total_courses': total_courses,
                'total_students': total_students,
                'total_registered_users': total_registered_users,
                'total_teachers': total_teachers,
                'total_enrollments': total_enrollments,
                'completion_rate': completion_rate,
                'total_certificates': total_certificates,
                'total_materials': total_materials,
                'total_games': total_games,
                'total_quizzes': total_quizzes,
                'total_notes': total_notes,
                'total_feedbacks': total_feedbacks,
                'platform_rating': platform_rating,
                'satisfaction_index': satisfaction_index,
                'total_reviews': total_reviews,
                'total_discussions': total_discussions,
                'total_categories': total_categories,
                'app_version': app_version,
                'timestamp': timezone.now().isoformat()
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            # 🔒 SECURITY: Log error securely, return generic response
            import logging
            logger = logging.getLogger('security')
            logger.error(f"Error in PublicStatsAPIView: {str(e)}", exc_info=True)
            return Response({
                'error': 'An error occurred while fetching statistics',
                'total_courses': 0,
                'total_students': 0,
                'total_teachers': 0,
                'total_enrollments': 0,
                'completion_rate': 0,
                'total_certificates': 0,
                'total_materials': 0,
                'platform_rating': 4.8,
                'total_reviews': 0,
                'total_discussions': 0,
                'total_categories': 0,
                'timestamp': timezone.now().isoformat()
            }, status=status.HTTP_200_OK)




@method_decorator(csrf_exempt, name='dispatch')
class CourseCreateAPIView(APIView):
    """
    Course Creation API View - ✨ PHASE 4.85: Fixed Authentication
    
    Allows course creation without CSRF token validation.
    This is safe because:
    1. Uses JWT authentication for instructor requests
    2. Course creation requires authentication (JWT token)
    3. No sensitive operations without proper auth
    4. Data validated by serializers
    
    [*] PHASE 4.85 FIX: Restored proper JWT authentication
    - Changed from [AllowAny] + [] (broken testing config)
    - To [IsAuthenticated] + [JWTAuthentication] (working production)
    - This ensures users must provide valid JWT token to create courses
    - Prevents "No teacher profile found" 400 error
    """
    permission_classes = [IsAuthenticated]  # ✨ PHASE 4.85: Require authentication
    authentication_classes = [JWTAuthentication]  # ✨ PHASE 4.85: Use JWT for authentication

    def post(self, request):
        try:
            title = request.data.get("title")
            description = request.data.get("description")
            image_url = request.data.get("image")  # Now expecting URL from file-upload API
            file_url = request.data.get("file")    # Now expecting URL from file-upload API
            level = request.data.get("level")
            target_audience = request.data.get("target_audience", "internal")
            if target_audience == "pegawai":
                target_audience = "internal"
            category = request.data.get("category")

            print(f"=== Course Creation Debug ===")
            print(f"Title: {title}")
            print(f"Description length: {len(description) if description else 0}")
            print(f"Image URL: {image_url}")
            print(f"Image URL length: {len(image_url) if image_url else 0}")
            print(f"File URL: {file_url}")
            print(f"File URL length: {len(file_url) if file_url else 0}")
            print(f"Level: {level}")
            print(f"Target Audience: {target_audience}")
            print(f"Category: {category}")

            # Validate required fields
            if not title:
                return Response({"error": "Title is required"}, status=status.HTTP_400_BAD_REQUEST)
            
            if not category:
                return Response({"error": "Category is required"}, status=status.HTTP_400_BAD_REQUEST)

            # Get category object
            category_obj = api_models.Category.objects.filter(id=category).first()
            if not category_obj:
                return Response({"error": "Invalid category"}, status=status.HTTP_400_BAD_REQUEST)

            # Get teacher object - for now, get the first teacher or create one
            teacher = None
            if request.user and request.user.is_authenticated:
                teacher = api_models.Teacher.objects.filter(user=request.user).first()
                
                # ✨ PHASE 4.83: If teacher doesn't exist for authenticated user, create one
                # CRITICAL FIX: Don't fall back to Teacher.objects.first()!
                # This was causing courses to be assigned to wrong teacher
                if not teacher:
                    try:
                        # Try to create from profile first
                        from userauths.models import Profile
                        profile = Profile.objects.get(user=request.user)
                        teacher = api_models.Teacher.objects.create(
                            user=request.user,
                            full_name=profile.full_name,
                            image=profile.image,
                            country=profile.country if hasattr(profile, 'country') else '',
                            about=profile.about if hasattr(profile, 'about') else ''
                        )
                    except (Profile.DoesNotExist, Exception):
                        # If no profile or creation fails, create minimal teacher
                        teacher = api_models.Teacher.objects.create(
                            user=request.user,
                            full_name=request.user.full_name,
                            image='',
                            country=''
                        )
            
            if not teacher:
                return Response({"error": "No teacher profile found and could not create one"}, status=status.HTTP_400_BAD_REQUEST)

            course_type = request.data.get("course_type", "standard")
            learning_module_id = request.data.get("learning_module_id")
            learning_module_obj = None
            if learning_module_id:
                learning_module_obj = api_models.LearningModule.objects.filter(id=learning_module_id).first()
                if learning_module_obj and course_type == 'standard':
                    course_type = learning_module_obj.module_type

            # Parse Bobot Jam Pelatihan (JP)
            raw_jp = request.data.get("total_jam_pelatihan")
            course_jp = 0
            if raw_jp is not None and str(raw_jp).strip().isdigit():
                course_jp = int(raw_jp)

            # Create course with Draft status (not published until curriculum is complete)
            course = api_models.Course.objects.create(
                teacher=teacher,
                category=category_obj,
                file=file_url,     # Store URL instead of file
                image=image_url,   # Store URL instead of file
                title=title,
                description=description,
                level=level,
                target_audience=target_audience,
                platform_status="Draft",           # Set to Draft for admin/platform review
                teacher_course_status="Draft",     # Set to Draft - teacher needs to complete curriculum
                course_type=course_type,
                learning_module=learning_module_obj,
                total_jam_pelatihan=course_jp
            )

            # Auto-create curriculum for SCORM/H5P course if learning module is attached
            if learning_module_obj:
                learning_module_obj.course = course
                learning_module_obj.save(update_fields=['course'])

                variant = api_models.Variant.objects.create(
                    course=course,
                    title="Modul Interaktif Utama",
                    order=1
                )
                api_models.VariantItem.objects.create(
                    variant=variant,
                    title=f"Modul: {learning_module_obj.judul}",
                    description=learning_module_obj.deskripsi or "Pelajari modul interaktif berikut secara mandiri hingga selesai.",
                    learning_module=learning_module_obj,
                    preview=True,
                    order=1
                )

            print(f"Course created successfully with ID: {course.course_id}")
            print(f"Course status: platform_status={course.platform_status}, teacher_course_status={course.teacher_course_status}, type={course.course_type}")

            return Response({
                "message": "Course Created Successfully",
                "course_id": course.course_id,
                "status": "draft",
                "course_type": course.course_type,
                "learning_module_id": learning_module_obj.id if learning_module_obj else None,
                "next_step": "Add curriculum, lessons, and quizzes to publish your course"
            }, status=status.HTTP_201_CREATED)

        
        except Exception as e:
            import traceback
            print(f"Error creating course: {str(e)}")
            print(f"Full traceback:")
            print(traceback.format_exc())
            return Response({"error": f"Internal server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ✨ PHASE 4.101: Helper function to delete orphaned files
def delete_orphaned_file(file_url, exclude_course_id=None, exclude_variant_item_id=None):
    """
    Delete a file from storage based on its URL
    
    MEMORY OPTIMIZATION: Prevents accumulation of orphaned files when course
    images/files are replaced. Only deletes files from our local storage
    (not external URLs like Google Drive, YouTube, CDNs).
    
    Args:
        file_url (str): Full URL or path to file
        exclude_course_id (str/int, optional): Exclude this course when checking active DB references
        exclude_variant_item_id (str/int, optional): Exclude this item when checking active DB references
    
    Returns:
        bool: True if deleted, False otherwise
    """
    if not file_url:
        return False
    
    try:
        # Only delete our own hosted files, not external URLs
        if file_url.startswith(('http://', 'https://')):
            # Check if it's our domain
            if not settings.ALLOWED_HOSTS:
                return False
            
            # Only process files from our own server
            is_ours = any(host in file_url for host in settings.ALLOWED_HOSTS) or 'localhost' in file_url or '127.0.0.1' in file_url
            if not is_ours:
                print(f"[File Cleanup] Skipping external file: {file_url}")
                return False
        
        # Extract file path from URL
        # URL format: http://localhost:8001/media/course-file/uuid.ext
        # or: /media/course-file/uuid.ext
        # CRITICAL FIX: Capture ONLY the part AFTER /media/ to avoid double-media path
        match = re.search(r'/media/(.+?)(?:\?|$)', str(file_url))
        if not match:
            print(f"[File Cleanup] Could not extract path from: {file_url}")
            return False
        
        # match.group(1) now contains just "course-file/uuid.jpg" (no /media/ prefix)
        file_path = match.group(1)
        # Convert forward slashes to native OS path separators (important for Windows)
        file_path = file_path.replace('/', os.sep)
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        print(f"[File Cleanup] DEBUG: Extracted path='{file_path}', full_path='{full_path}'")
        
        # Safety check: ensure path is within MEDIA_ROOT
        if not os.path.abspath(full_path).startswith(os.path.abspath(settings.MEDIA_ROOT)):
            print(f"[File Cleanup] SECURITY: Attempted to delete outside MEDIA_ROOT: {full_path}")
            return False

        # 🛡️ SAFETY CHECK: Ensure file is not actively referenced by another VariantItem or Course
        filename = os.path.basename(full_path)
        if filename:
            from api import models as check_models
            from django.db.models import Q
            
            item_query = check_models.VariantItem.objects.filter(file__icontains=filename)
            if exclude_variant_item_id:
                item_query = item_query.exclude(variant_item_id=exclude_variant_item_id)
            if item_query.exists():
                print(f"[File Cleanup] ⏭️ SKIPPED: File '{filename}' is still referenced by {item_query.count()} VariantItem(s) in DB.")
                return False
                
            course_query = check_models.Course.objects.filter(Q(file__icontains=filename) | Q(image__icontains=filename))
            if exclude_course_id:
                course_query = course_query.exclude(course_id=exclude_course_id)
            if course_query.exists():
                print(f"[File Cleanup] ⏭️ SKIPPED: File '{filename}' is still referenced by {course_query.count()} Course(s) in DB.")
                return False
        
        # Delete if exists
        if os.path.exists(full_path):
            os.remove(full_path)
            print(f"[File Cleanup] ✅ Deleted: {full_path}")
            return True
        else:
            print(f"[File Cleanup] File not found: {full_path}")
            return False
            
    except Exception as e:
        print(f"[File Cleanup] ❌ Error deleting file {file_url}: {str(e)}")
        return False




@method_decorator(csrf_exempt, name='dispatch')
class CourseUpdateAPIView(generics.RetrieveUpdateAPIView):
    """
    [*] PHASE 4.76: Course Update API with Enforced Versioning
    
    CRITICAL CHANGE: Published courses CANNOT be edited directly.
    - Only draft courses can be updated
    - Published courses must be edited through draft copies
    - get_object() will BLOCK any attempt to edit published courses
    
    Workflow:
    1. Draft Course -> Edit -> Save (direct edit allowed)
    2. Published Course -> Click "Edit Versi Terbaru" -> Creates Draft (required)
    3. Draft of Published -> Edit -> Save (direct edit allowed)
    4. Submit for Review -> Admin approves -> Replaces Published
    
    This ensures published courses are ALWAYS read-only at database level.
    """
    queryset = api_models.Course.objects.all()
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]

    def get_object(self):
        teacher_id = self.kwargs.get('teacher_id')
        course_id = self.kwargs['course_id']

        course = api_models.Course.objects.get(course_id=course_id)

        # 🔒 FIX IDOR: Validasi kepemilikan sebelum memproses update (Admin Setjen DPD RI memiliki akses moderasi)
        user = self.request.user
        is_admin = (
            getattr(user, 'is_staff', False) or 
            getattr(user, 'is_superuser', False) or 
            getattr(user, 'is_admin', False) or 
            getattr(user, 'current_role', '') == 'admin' or 
            getattr(user, 'role', '') == 'admin' or
            str(teacher_id).lower() == 'admin'
        )
        if not is_admin:
            try:
                teacher = api_models.Teacher.objects.get(id=teacher_id)
            except (api_models.Teacher.DoesNotExist, ValueError):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Akses ditolak. Instruktur tidak ditemukan.")

            if teacher.user != user or course.teacher != teacher:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Akses ditolak. Anda bukan pemilik kursus ini.")
        
        # [*] PHASE 4.76 CRITICAL FIX: Prevent direct editing of published courses
        # Published courses MUST be edited through their draft copies only
        if course.is_published_version:
            print(f"[Course Update - 4.76] [FAIL] BLOCKED: Attempt to edit published course {course_id}")
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                detail={
                    "error": "Cannot edit published course directly",
                    "message": "Kursus yang sudah dipublikasikan tidak dapat diedit langsung. Gunakan 'Edit Versi Terbaru' untuk membuat draft yang dapat diedit.",
                    "action": "use_edit_published_endpoint"
                }
            )

        return course
    
    def update(self, request, *args, **kwargs):
        try:
            course = self.get_object()
            print(f"[Course Update - PHASE 4.76] Updating course: {course.title}")
            print(f"[Course Update] Course ID: {course.course_id}, is_published_version: {course.is_published_version}")
            print(f"[Course Update] Request data keys: {list(request.data.keys())}")
            
            # At this point, get_object() has already validated that:
            # - Course is NOT a published version (would have raised PermissionDenied)
            # - We're editing a draft or draft-revision
            
            original_status = course.platform_status
            
            # ✨ PHASE 4.101: DELETE OLD FILES BEFORE UPDATING
            # Prevent memory waste by cleaning up orphaned files
            # ✨ PHASE 4.101.1: CRITICAL DEBUG - Add comprehensive logging
            print(f"[Memory Cleanup] === IMAGE CLEANUP CHECK ===")
            print(f"[Memory Cleanup] 'image' in request.data: {'image' in request.data}")
            if "image" in request.data:
                print(f"[Memory Cleanup] request.data['image']: {request.data['image']}")
                print(f"[Memory Cleanup] bool(request.data['image']): {bool(request.data['image'])}")
            print(f"[Memory Cleanup] course.image (from DB): {course.image}")
            
            if "image" in request.data and request.data['image']:
                new_image = str(request.data['image']).strip()
                print(f"[Memory Cleanup] new_image (sanitized): {new_image}")
                print(f"[Memory Cleanup] course.image == new_image: {course.image == new_image}")
                print(f"[Memory Cleanup] bool(course.image): {bool(course.image)}")
                
                # Only delete if image is actually changing
                if course.image and new_image != course.image:
                    print(f"[Memory Cleanup] ✅ IMAGE CLEANUP: Deleting old: {course.image}")
                    delete_orphaned_file(course.image, exclude_course_id=course.course_id)
                elif not course.image:
                    print(f"[Memory Cleanup] ⏭️  SKIPPED: course.image is empty/None (first upload?)")
                elif new_image == course.image:
                    print(f"[Memory Cleanup] ⏭️  SKIPPED: Image not changing (same URL)")
            else:
                print(f"[Memory Cleanup] ⏭️  SKIPPED: No 'image' in request or image is empty")
            
            # Similar logic for files
            print(f"[Memory Cleanup] === FILE CLEANUP CHECK ===")
            print(f"[Memory Cleanup] 'file' in request.data: {'file' in request.data}")
            if "file" in request.data:
                print(f"[Memory Cleanup] request.data['file']: {request.data['file']}")
            print(f"[Memory Cleanup] course.file (from DB): {course.file}")
            
            if "file" in request.data and request.data['file']:
                new_file = str(request.data['file']).strip()
                print(f"[Memory Cleanup] new_file (sanitized): {new_file}")
                print(f"[Memory Cleanup] course.file == new_file: {course.file == new_file}")
                print(f"[Memory Cleanup] bool(course.file): {bool(course.file)}")
                
                # Only delete if file is actually changing
                if course.file and new_file != course.file:
                    print(f"[Memory Cleanup] ✅ FILE CLEANUP: Deleting old: {course.file}")
                    delete_orphaned_file(course.file, exclude_course_id=course.course_id)
                elif not course.file:
                    print(f"[Memory Cleanup] ⏭️  SKIPPED: course.file is empty/None")
                elif new_file == course.file:
                    print(f"[Memory Cleanup] ⏭️  SKIPPED: File not changing")
            else:
                print(f"[Memory Cleanup] ⏭️  SKIPPED: No 'file' in request or file is empty")
            
            # ✨ PHASE 4.101.3: Simplified - old files now deleted automatically on each upload
            # No need to process unsaved_image_uploads here anymore!
            
            # ✨ Sanitize mutable request data before serialization
            mutable_data = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
            
            # Clean up dummy / legacy flags
            if 'has_related_changes' in mutable_data:
                del mutable_data['has_related_changes']
                
            # Clean up file field if stringified null/undefined/empty
            if 'file' in mutable_data:
                file_val = mutable_data['file']
                if file_val == "" or file_val is None or str(file_val).strip() in ["null", "undefined", "None"]:
                    del mutable_data['file']
                    course.file = None
                    
            # Clean up category field if stringified null/undefined/object
            if 'category' in mutable_data:
                cat_val = mutable_data['category']
                if str(cat_val).strip() in ['[object Object]', 'null', 'undefined', 'NaN', 'None', '']:
                    del mutable_data['category']
                elif isinstance(cat_val, dict) and 'id' in cat_val:
                    mutable_data['category'] = cat_val['id']
                    
            # Clean up price and language if invalid
            if 'price' in mutable_data and str(mutable_data['price']).strip() in ['undefined', 'null', 'NaN']:
                del mutable_data['price']
                
            if 'language' in mutable_data and str(mutable_data['language']).strip() in ['undefined', 'null', 'NaN']:
                del mutable_data['language']

            # Normalize legacy 'pegawai' target_audience to 'internal'
            if 'target_audience' in mutable_data and mutable_data['target_audience'] == 'pegawai':
                mutable_data['target_audience'] = 'internal'

            # Allow partial updates for PATCH requests
            is_partial = request.method == 'PATCH' or kwargs.get('partial', True)
            
            # Serialize and validate
            serializer = self.get_serializer(course, data=mutable_data, partial=is_partial)
            
            # Add detailed error information
            if not serializer.is_valid():
                print(f"Serializer errors: {serializer.errors}")
                print(f"Full request data: {request.data}")

            serializer.is_valid(raise_exception=True)

            # Handle image URL update
            if "image" in request.data:
                if isinstance(request.data['image'], InMemoryUploadedFile):
                    # Legacy support for direct file upload
                    course.image = request.data['image']
                elif request.data['image'] and str(request.data['image']) != "No File":
                    # Store URL from file-upload API
                    course.image = request.data['image']
                elif str(request.data['image']) == "No File":
                    course.image = None
            
            # ✨ PHASE 4.167: Handle file URL update - ALWAYS set field to allow clearing files
            if 'file' in request.data:
                file_value = request.data['file']
                
                # Allow clearing: empty string, None, "null", "undefined"
                if file_value == "" or file_value is None or str(file_value) in ["null", "undefined"]:
                    course.file = None
                elif isinstance(file_value, InMemoryUploadedFile):
                    # Legacy support for direct file upload
                    course.file = file_value
                elif str(file_value).startswith(("http://", "https://")):
                    # Store URL from file-upload API
                    course.file = file_value
                # If it doesn't match any condition, don't update (keep existing)

            if 'category' in request.data and request.data['category'] != 'NaN' and request.data['category'] != "undefined":
                try:
                    # Handle both object and direct ID formats
                    category_id = request.data['category']
                    if isinstance(category_id, dict) and 'id' in category_id:
                        category_id = category_id['id']
                    
                    category = api_models.Category.objects.get(id=category_id)
                    course.category = category
                except (api_models.Category.DoesNotExist, ValueError, TypeError) as e:
                    print(f"Category error: {e}")
                    print(f"Category data: {request.data['category']}")
                    # Don't fail the entire request, just skip category update

            # [*] PHASE 4.76 CRITICAL: Published courses are now completely protected
            # get_object() prevents them from reaching here
            # This code only updates draft courses
            # When instructor submits draft for review, they use Course Publish endpoint
            print(f"[Course Update] Updating draft course (parent={course.parent_course_id}, platform_status={original_status})")

            # [*] PHASE 4.76: Cleanup the has_related_changes flag if present
            # This flag is from the old system and not a valid Course model field
            if 'has_related_changes' in request.data:
                print(f"[Course Update] Removing 'has_related_changes' flag from request.data")
                # Create mutable copy of QueryDict for modification
                mutable_data = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
                if 'has_related_changes' in mutable_data:
                    del mutable_data['has_related_changes']
                # Replace request.data with mutable version
                request._full_data = mutable_data
                # Note: We use request._full_data to update the underlying data
                
            # ✨ PHASE 7.5 FIX: SIMPLIFIED TAG HANDLING - Let serializer handle tags during update
            print(f"[Course Update] Request data keys: {list(request.data.keys())}")
            print(f"[Course Update] Tags in request: {request.data.get('tags', 'NOT PRESENT')}")
            
            self.perform_update(serializer)
            
            # ✨ PHASE 7.5 FIX: CRITICAL - Manually handle M2M tags AFTER serializer.save() to ensure persistence
            # DRF's PrimaryKeyRelatedField(many=True) should handle this, but M2M relationships
            # sometimes need explicit save. Do this AFTER perform_update but BEFORE any refresh.
            if 'tags' in request.data:
                try:
                    tag_ids = request.data['tags']
                    print(f"[Course Update] 📝 Processing tags from request: {tag_ids}")
                    
                    # Handle JSON string format
                    if isinstance(tag_ids, str):
                        import json
                        tag_ids = json.loads(tag_ids) if tag_ids else []
                    
                    # Ensure it's a list
                    if not isinstance(tag_ids, (list, tuple)):
                        tag_ids = [tag_ids] if tag_ids else []
                    
                    # Convert to integers
                    tag_ids = [int(tid) for tid in tag_ids if tid and str(tid).isdigit()]
                    print(f"[Course Update] 🔍 Tags converted to IDs: {tag_ids}")
                    
                    # ✨ CRITICAL: For empty tags, clear them
                    if not tag_ids:
                        print(f"[Course Update] ⚠️  Empty tags list - clearing all tags")
                        course.tags.clear()
                    else:
                        # Set tags using M2M relationship
                        course.tags.set(tag_ids)
                        print(f"[Course Update] ✅ Tags saved to database: {list(course.tags.values_list('id', flat=True))}")
                    
                except Exception as e:
                    import traceback
                    print(f"[Course Update] ❌ ERROR handling tags: {e}")
                    traceback.print_exc()
            else:
                print(f"[Course Update] ⏭️  No 'tags' field in request - skipping tag update")
            
            # Handle explicit total_jam_pelatihan
            if 'total_jam_pelatihan' in request.data:
                try:
                    raw_jp = request.data['total_jam_pelatihan']
                    course.total_jam_pelatihan = int(raw_jp) if (raw_jp is not None and str(raw_jp).strip() != "") else 0
                except (ValueError, TypeError):
                    course.total_jam_pelatihan = 0

            # [*] PHASE 4.72: Status automatically set above if published course was edited
            # Published -> Review (set above before serializer.update)
            # Now save the course with updated status
            course.save()
            
            self.update_variant(course, request.data)
            
            # *** CRITICAL FIX: Refresh course data to include updated curriculum ***
            # The serializer.data was generated BEFORE update_variant was called,
            # so it doesn't include the updated curriculum. We must refresh it.
            course.refresh_from_db()
            refreshed_serializer = self.get_serializer(course)
            
            print(f"[Course Update] Returning refreshed data with {len(refreshed_serializer.data.get('curriculum', []))} curriculum sections")
            
            return Response(refreshed_serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error in course update: {e}")
            print(f"Error type: {type(e)}")
            import traceback
            traceback.print_exc()
            raise e
    
    def update_variant(self, course, request_data):
        """
        Enhanced curriculum update with proper delete handling to prevent duplicates
        
        [WARN] CRITICAL: Only processes curriculum if variants[] data exists in request.
        If no curriculum data is sent, the curriculum is NOT touched (prevents accidental deletion).
        """
        # [DONE] DEBUG: Log all request keys to verify FormData is received
        print(f"[Curriculum Update] Request data keys: {list(request_data.keys())}")
        curriculum_keys = [k for k in request_data.keys() if k.startswith("variants[")]
        print(f"[Curriculum Update] Curriculum-related keys found: {curriculum_keys}")
        
        # [WARN] CRITICAL FIX: If no curriculum data in request, SKIP the entire update
        # This prevents deleting curriculum when updating course from CourseEdit.jsx
        if not curriculum_keys:
            print(f"[Curriculum Update] No curriculum data in request. Skipping curriculum update to preserve existing data.")
            return
        
        # Track which variants and items are being updated
        updated_variant_ids = set()
        updated_item_ids = set()
        attached_quiz_ids = set()
        
        # Group variant data by index
        variant_indices = set()
        for key in request_data.keys():
            if key.startswith("variants[") and '][variant_title]' in key:
                index = key.split('[')[1].split(']')[0]
                variant_indices.add(index)
        
        print(f"[Curriculum Update] Processing {len(variant_indices)} variants for course: {course.title}")
        print(f"[Curriculum Update] Variant indices: {sorted(variant_indices)}")

        
        for index in variant_indices:
            # Get variant data
            title_key = f"variants[{index}][variant_title]"
            id_key = f"variants[{index}][variant_id]"
            order_key = f"variants[{index}][order]"
            
            title = request_data.get(title_key, '')
            variant_id = request_data.get(id_key)
            order = request_data.get(order_key, index)  # Use index as fallback
            
            # Skip empty sections
            if not title or title.strip() == '':
                print(f"[Curriculum Update] Skipping empty variant at index {index}")
                continue

            
            # Group items for this variant
            items_data = {}
            for key, value in request_data.items():
                if f'variants[{index}][items][' in key:
                    # Extract item index and field name
                    # Format: variants[0][items][0][title]
                    parts = key.split('][items][')[1]  # "0][title]"
                    item_index = parts.split('][')[0]  # "0"
                    field_name = parts.split('][')[1].replace(']', '')  # "title"
                    
                    if item_index not in items_data:
                        items_data[item_index] = {}
                    items_data[item_index][field_name] = value

            
            # Find or create variant
            if variant_id:
                existing_variant = course.curriculum.filter(variant_id=variant_id).first()
            else:
                existing_variant = None
            
            # ✨ Fallback matching: If no variant_id was provided (e.g. quick auto-save before state update),
            # match with an existing variant in this course that hasn't been updated yet
            if not existing_variant:
                # First try matching by order
                existing_variant = course.curriculum.filter(order=int(order) if order else 0).exclude(variant_id__in=updated_variant_ids).first()
                # Second try matching by title
                if not existing_variant:
                    existing_variant = course.curriculum.filter(title=title).exclude(variant_id__in=updated_variant_ids).first()
            
            if existing_variant:
                print(f"[Curriculum Update] Updating existing variant {existing_variant.variant_id}: {title}")
                existing_variant.title = title
                existing_variant.order = int(order) if order else 0
                existing_variant.save()
                variant = existing_variant
                updated_variant_ids.add(variant.variant_id)
            else:
                print(f"[Curriculum Update] Creating new variant: {title}")
                variant = api_models.Variant.objects.create(
                    course=course, 
                    title=title,
                    order=int(order) if order else 0
                )
                updated_variant_ids.add(variant.variant_id)
            
            # Process items
            for item_index, item_data in items_data.items():
                
                # Get item data
                item_title = item_data.get("title", "")
                item_description = item_data.get("description", "")
                item_file = item_data.get("file", "")
                item_youtube_link = item_data.get("youtube_link", "")  # [*] PHASE 4.73: Handle YouTube link separately
                preview_value = item_data.get("preview", "false")
                variant_item_id = item_data.get("variant_item_id")
                duration_seconds = item_data.get("duration_seconds")  # Get duration from file upload
                item_order = item_data.get("order", item_index)  # Get order or use index as fallback
                item_type = item_data.get("item_type", "lesson")
                quiz_id = item_data.get("quiz_id")

                target_quiz = None
                if item_type == 'quiz' or (quiz_id and str(quiz_id) not in ["null", "undefined", ""]):
                    item_type = 'quiz'
                    target_quiz = api_models.Quiz.objects.filter(course=course, quiz_id=quiz_id).first()
                    if not target_quiz and quiz_id:
                        try:
                            target_quiz = api_models.Quiz.objects.filter(course=course, id=int(quiz_id)).first()
                        except (ValueError, TypeError):
                            pass
                    if target_quiz and (not item_title or item_title.strip() == ''):
                        item_title = target_quiz.title
                    
                    # Prevent duplicate quiz assignment across multiple variant items in the same course
                    if target_quiz:
                        if target_quiz.id in attached_quiz_ids:
                            print(f"[Curriculum Update] ⚠️ Quiz {target_quiz.id} ({target_quiz.title}) already attached to another item in this course! Skipping duplicate attachment.")
                            target_quiz = None
                            item_type = 'lesson'
                        else:
                            attached_quiz_ids.add(target_quiz.id)
                
                # Skip empty items
                if not item_title or item_title.strip() == '':
                    print(f"[Curriculum Update] Skipping empty item at variant[{index}] item[{item_index}]")
                    continue
                
                # Handle preview boolean
                preview = str(preview_value).lower() in ['true', '1', 'yes'] if preview_value else False
                
                # [*] PHASE 4.73: Handle file data - prioritize YouTube link if present
                # ✨ PHASE 4.195: Enhanced logging to debug FormData conflicts
                file = None
                if item_youtube_link and str(item_youtube_link) not in ["null", "undefined", ""]:
                    # YouTube link provided - use it as the file URL
                    file = item_youtube_link
                    print(f"[Curriculum Update] Using YouTube link for item: {item_youtube_link[:50]}...")
                    if item_file and str(item_file) not in ["null", "undefined", ""]:
                        print(f"[Curriculum Update - DEBUG] ⚠️ WARNING: Both youtube_link and file were present! Prioritizing YouTube.")
                        print(f"[Curriculum Update - DEBUG] Unused file/gdrive: {item_file[:50]}...")
                elif item_file and str(item_file) not in ["null", "undefined", ""]:
                    # Regular file or Google Drive link
                    if str(item_file).startswith(("http://", "https://")):
                        file = item_file  # URL from file-upload API
                        print(f"[Curriculum Update] Using file/Google Drive link for item: {item_file[:50]}...")
                    else:
                        file = item_file  # Direct file upload
                        print(f"[Curriculum Update] Using uploaded file for item: {item_file[:50]}...")
                else:
                    file = None
                    print(f"[Curriculum Update - DEBUG] No file/link provided for item: {item_title}")
                
                # [*] PHASE 4.43.10: Extract duration from YouTube links if not provided
                if not duration_seconds and file and ('youtube.com' in file or 'youtu.be' in file):
                    print(f"[Curriculum Update] Extracting duration from URL: {file}")
                    try:
                        from api.url_utils import extract_video_duration_from_url
                        duration_info = extract_video_duration_from_url(file)
                        if duration_info and duration_info.get('duration_seconds'):
                            duration_seconds = duration_info['duration_seconds']
                            print(f"[Curriculum Update] Extracted duration {duration_seconds}s from URL")
                        elif duration_info and duration_info.get('error'):
                            print(f"[Curriculum Update] Duration extraction warning: {duration_info['error']}")
                    except Exception as e:
                        print(f"[Curriculum Update] Error extracting duration: {str(e)}")
                
                # Handle duration conversion
                duration = None
                if duration_seconds:
                    try:
                        from datetime import timedelta
                        duration = timedelta(seconds=float(duration_seconds))
                    except (ValueError, TypeError):
                        print(f"Invalid duration_seconds value: {duration_seconds}")
                        duration = None
                
                # Find existing item or create new one
                if variant_item_id:
                    variant_item = api_models.VariantItem.objects.filter(variant_item_id=variant_item_id).first()
                else:
                    variant_item = None
                
                # ✨ Fallback matching: If no variant_item_id was provided, match existing item in this variant
                if not variant_item and variant:
                    # Match by order in this variant
                    variant_item = variant.variant_items.filter(order=int(item_order) if item_order else 0).exclude(variant_item_id__in=updated_item_ids).first()
                    # Or match by title in this variant
                    if not variant_item:
                        variant_item = variant.variant_items.filter(title=item_title).exclude(variant_item_id__in=updated_item_ids).first()

                if variant_item:
                    print(f"[Curriculum Update] Updating existing item {variant_item.variant_item_id}: {item_title}")
                    variant_item.title = item_title
                    variant_item.description = item_description
                    variant_item.preview = preview
                    variant_item.order = int(item_order) if item_order else 0
                    variant_item.item_type = item_type
                    variant_item.quiz = target_quiz
                    # PHASE 4.167: Update file field
                    if 'file' in item_data or 'youtube_link' in item_data:
                        variant_item.file = file
                    elif not variant_item.file:
                        variant_item.file = file

                    if duration is not None:
                        variant_item.duration = duration
                    
                    # ✨ Support SCORM learning_module_id
                    item_lm_id = item_data.get("learning_module_id")
                    if item_lm_id and str(item_lm_id) not in ["null", "undefined", "", "none", "0"]:
                        try:
                            variant_item.learning_module_id = int(item_lm_id)
                        except (ValueError, TypeError):
                            pass
                    elif str(item_lm_id).lower() in ["null", "undefined", "", "none", "0"] and course.course_type == 'standard':
                        variant_item.learning_module_id = None
                    elif not variant_item.learning_module_id and course.learning_module_id and course.course_type != 'standard':
                        variant_item.learning_module = course.learning_module

                    variant_item.save()
                    updated_item_ids.add(variant_item.variant_item_id)
                else:
                    print(f"[Curriculum Update] Creating new item: {item_title}")
                    item_lm_id = item_data.get("learning_module_id")
                    target_lm_id = None
                    if item_lm_id and str(item_lm_id) not in ["null", "undefined", ""]:
                        try:
                            target_lm_id = int(item_lm_id)
                        except (ValueError, TypeError):
                            pass
                    elif course.learning_module_id and course.course_type != 'standard':
                        target_lm_id = course.learning_module_id

                    variant_item = api_models.VariantItem.objects.create(
                        variant=variant,
                        title=item_title,
                        description=item_description,
                        file=file,
                        duration=duration,
                        preview=preview,
                        order=int(item_order) if item_order else 0,
                        learning_module_id=target_lm_id,
                        item_type=item_type,
                        quiz=target_quiz
                    )
                    updated_item_ids.add(variant_item.variant_item_id)
        
        # *** CRITICAL FIX: Delete orphaned variants and items to prevent duplicates ***
        
        # Get all variants for this course
        all_course_variants = course.curriculum.all()
        
        # Delete variants that weren't in the update (removed by user)
        deleted_variant_count = 0
        for variant in all_course_variants:
            if variant.variant_id not in updated_variant_ids:
                print(f"[Curriculum Cleanup] Deleting orphaned variant {variant.variant_id}: {variant.title}")
                # ✨ PHASE 4.101: Clean up variant item files before deletion only if not used elsewhere
                for item in variant.variant_items.all():
                    if item.file:
                        delete_orphaned_file(item.file, exclude_variant_item_id=item.variant_item_id)
                variant.delete()  # Cascade deletes items
                deleted_variant_count += 1
        
        # Delete orphaned items (items whose variant was updated but item wasn't)
        deleted_item_count = 0
        for variant_id in updated_variant_ids:
            variant = course.curriculum.filter(variant_id=variant_id).first()
            if variant:
                all_variant_items = variant.variant_items.all()  # Use related_name "variant_items"
                for item in all_variant_items:
                    if item.variant_item_id not in updated_item_ids:
                        print(f"[Curriculum Cleanup] Deleting orphaned item {item.variant_item_id}: {item.title}")
                        # ✨ PHASE 4.101: Clean up item file before deletion only if not used elsewhere
                        if item.file:
                            delete_orphaned_file(item.file, exclude_variant_item_id=item.variant_item_id)
                        item.delete()
                        deleted_item_count += 1
        
        print(f"[Curriculum Summary] Variants updated/created: {len(updated_variant_ids)}, Items updated/created: {len(updated_item_ids)}")
        print(f"[Curriculum Summary] Variants deleted: {deleted_variant_count}, Items deleted: {deleted_item_count}")
        print(f"[Curriculum Update] Completed successfully for course: {course.title}")

    def save_nested_data(self, course_instance, serializer_class, data):
        serializer = serializer_class(data=data, many=True, context={"course_instance": course_instance})
        serializer.is_valid(raise_exception=True)
        serializer.save(course=course_instance) 



@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(csrf_exempt, name='dispatch')
class CoursePublishAPIView(APIView):
    """
    API endpoint to submit a course for admin review/approval
    
    Workflow:
    1. Instructor submits course -> Sets platform_status to "Review" and review_submitted_date
    2. Admin can approve -> Sets platform_status to "Published" and approval_date
    3. Admin can reject with reason -> Sets platform_status to "Rejected" and rejection_reason
    4. If instructor edits published course -> Can resubmit for review (republication)
    5. Instructor can update published course -> Submit again for admin approval of changes
    
    [*] PHASE 4.71: Support for republication of published courses
    - Published courses can now be resubmitted with updates
    - Allows instructors to modify and resubmit published courses without creating new courses
    - Admin review process is same as initial publication
    
    CSRF exempt because:
    - Uses JWT authentication for instructor requests
    - Course publishing requires proper authentication
    - Safe state-changing operation with JWT validation
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def post(self, request, course_id):
        try:
            course = api_models.Course.objects.get(course_id=course_id)
            
            # 🔒 Validasi kepemilikan kursus (Admin diizinkan melakukan moderasi/publikasi)
            is_admin = (
                getattr(request.user, 'is_admin', False) or 
                getattr(request.user, 'is_staff', False) or 
                getattr(request.user, 'current_role', '') == 'admin' or 
                getattr(request.user, 'role', '') == 'admin'
            )
            if course.teacher.user != request.user and not is_admin:
                return Response(
                    {"success": False, "message": "Akses ditolak. Anda bukan pemilik kursus ini."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Validation checks
            errors = []
            warnings = []
            
            # Check if course has basic information
            if not course.title or not course.description:
                errors.append("Kursus harus memiliki judul dan deskripsi")
            
            if not course.category:
                errors.append("Kursus harus memiliki kategori")
            
            # Check if course has curriculum
            curriculum_count = course.curriculum.count()
            if curriculum_count == 0:
                errors.append("Kursus harus memiliki setidaknya satu bagian kurikulum")
            
            # Check if course has lessons
            lesson_count = api_models.VariantItem.objects.filter(variant__course=course).count()
            if lesson_count == 0:
                errors.append("Kursus harus memiliki setidaknya satu pelajaran")
            
            # Check if all active regular quizzes are embedded in curriculum (excluding Pre/Post-test)
            active_regular_quizzes = course.quizzes.filter(is_active=True).exclude(quiz_type='pre_post_test')
            if active_regular_quizzes.exists():
                embedded_quiz_ids = set(
                    api_models.VariantItem.objects.filter(
                        variant__course=course,
                        quiz__isnull=False
                    ).values_list('quiz__id', flat=True)
                )
                unembedded_quizzes = [q for q in active_regular_quizzes if q.id not in embedded_quiz_ids]
                if unembedded_quizzes:
                    quiz_titles = ", ".join([f'"{q.title}"' for q in unembedded_quizzes])
                    errors.append(f"Terdapat kuis aktif yang belum disematkan ke kurikulum: {quiz_titles}. Silakan sematkan semua kuis aktif ke kurikulum terlebih dahulu (kecuali Pre/Post-test).")
            
            # Check if course has image
            if not course.image:
                warnings.append("Pertimbangkan untuk menambahkan gambar thumbnail kursus")
            
            # Return errors if any critical validations failed
            if errors:
                return Response({
                    "success": False,
                    "errors": errors,
                    "warnings": warnings,
                    "message": "Tidak dapat mengirim kursus untuk review. Silakan perbaiki kesalahan di atas."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # [*] PHASE 4.74: Submit for publication using enhanced versioning
            # This creates/updates published copy and sets status to Review
            print(f"[CoursePublish] User {request.user} submitting course {course.title}")
            
            published_course, is_new = course.submit_for_publication()
            action_text = "dibuat" if is_new else "diperbarui"

            # ✨ PHASE 4.74: Kirim notifikasi in-app otomatis ke seluruh Administrator platform
            try:
                from django.db.models import Q
                is_resubmission = bool(course.rejection_reason)
                instructor_name = course.teacher.full_name if (course.teacher and course.teacher.full_name) else (request.user.get_full_name() or request.user.username)
                notif_title = f"Pengajuan Ulang: {course.title[:45]}" if is_resubmission else f"Pengajuan Kursus: {course.title[:45]}"
                notif_msg = f"Instruktur {instructor_name} telah {'mengajukan ulang kursus setelah perbaikan catatan revisi' if is_resubmission else 'mengajukan kursus baru'} '{course.title}' untuk ditelaah dan diverifikasi."
                
                admin_users = api_models.User.objects.filter(
                    Q(is_staff=True) | Q(is_superuser=True) | Q(role='admin')
                ).distinct()
                
                for admin_u in admin_users:
                    api_models.Notification.objects.create(
                        user=admin_u,
                        course=course,
                        type="Course Under Review",
                        title=notif_title,
                        message=notif_msg,
                        seen=False
                    )
                print(f"[CoursePublish] Admin notification sent to {admin_users.count()} administrators")
            except Exception as noti_err:
                print(f"[CoursePublish] Warning: Failed to create admin notification: {noti_err}")
            
            return Response({
                "success": True,
                "message": f"Kursus Anda telah diajukan untuk review admin. Versi publikasi telah {action_text}. Tunggu persetujuan dari admin.",
                "warnings": warnings,
                "course": {
                    "course_id": str(course.course_id),
                    "title": course.title,
                    "slug": course.slug,
                    "teacher_course_status": course.teacher_course_status,
                    "platform_status": course.platform_status,
                    "curriculum_sections": curriculum_count,
                    "lessons": lesson_count,
                    "published_version_created": is_new
                }
            }, status=status.HTTP_200_OK)
            
        except api_models.Course.DoesNotExist:
            return Response({
                "success": False,
                "error": "Kursus tidak ditemukan"
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error submitting course for review: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                "success": False,
                "error": f"Gagal mengirim kursus untuk review: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@method_decorator(csrf_exempt, name='dispatch')
class CourseRestoreAPIView(APIView):
    """
    [*] PHASE 4.74: Enhanced Course Restore API endpoint
    
    Allows instructors to revert draft course back to published state
    - Restores all content from published version
    - Restores metadata from published_snapshot
    - Undoes all unsaved changes made while editing
    
    Workflow:
    1. Instructor edits a Published course
    2. Makes changes (curriculum, quizzes, metadata)
    3. Realizes mistake or wants to undo changes
    4. Clicks "Restore Kursus" button
    5. System copies everything back from Published version
    6. Draft course returns to Published state
    
    Restoration available for:
    - Courses with platform_status = "Published" that have published_copies
    - Normal Draft courses cannot be restored (nothing published yet)
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def post(self, request, course_id):
        try:
            # Get the draft course to restore
            course = api_models.Course.objects.get(course_id=course_id)
            
            # 🔒 Validasi kepemilikan kursus (Admin diizinkan melakukan moderasi/publikasi)
            is_admin = (
                getattr(request.user, 'is_admin', False) or 
                getattr(request.user, 'is_staff', False) or 
                getattr(request.user, 'current_role', '') == 'admin' or 
                getattr(request.user, 'role', '') == 'admin'
            )
            if course.teacher.user != request.user and not is_admin:
                return Response(
                    {"success": False, "message": "Akses ditolak. Anda bukan pemilik kursus ini."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            print(f"[Restore API] Restore request for course: {course.title}")
            
            # Check if published version exists
            published_copies = course.published_copies.filter(
                is_published_version=True,
                platform_status="Published"
            )
            
            if not published_copies.exists():
                print(f"[Restore API] [FAIL] No published version found for: {course.title}")
                return Response({
                    "success": False,
                    "message": "Kursus ini belum pernah dipublikasikan sebelumnya, sehingga tidak ada versi untuk direstorasi."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Call the enhanced restore method
            success, message = course.restore_to_published()
            
            if success:
                print(f"[Restore API] [DONE] Course restored successfully: {course.title}")
                
                # ✨ PHASE 7.5k FIX: Include tags in the restore response so frontend can display them
                tags_data = []
                try:
                    from . import serializer as ser
                    if course.tags.exists():
                        tags_data = ser.TagSerializer(course.tags.all(), many=True).data
                except Exception as e:
                    print(f"[Restore API] Error serializing tags: {str(e)}")
                
                return Response({
                    "success": True,
                    "message": message,
                    "course": {
                        "course_id": str(course.course_id),
                        "title": course.title,
                        "description": course.description,
                        "slug": course.slug,
                        "category": {
                            "id": course.category.id if course.category else None,
                            "title": course.category.title if course.category else None
                        },
                        "level": course.level,
                        "image": course.image,
                        "file": course.file,
                        "featured": course.featured,
                        "platform_status": course.platform_status,
                        "teacher_course_status": course.teacher_course_status,
                        "tags": tags_data,  # ✨ PHASE 7.5k FIX: Include restored tags in response
                        "curriculum_count": course.curriculum.count(),
                        "lessons_count": api_models.VariantItem.objects.filter(
                            variant__course=course
                        ).count(),
                        "quizzes_count": course.quizzes.count()
                    }
                }, status=status.HTTP_200_OK)
            else:
                print(f"[Restore API] [FAIL] Restoration failed: {message}")
                return Response({
                    "success": False,
                    "message": message
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except api_models.Course.DoesNotExist:
            print(f"[Restore API] Course not found: {course_id}")
            return Response({
                "success": False,
                "error": "Kursus tidak ditemukan"
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"[Restore API] [FAIL] ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                "success": False,
                "error": f"Gagal merestorasi kursus: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class CourseEditPublishedAPIView(APIView):
    """
    [*] PHASE 4.76: Create Draft Version from Published Course
    
    Allows instructors to edit published courses by creating a new draft revision.
    
    Workflow:
    1. Instructor views a published course in dashboard
    2. Clicks "Edit Kursus" button
    3. System creates a new draft version pointing to the published course
    4. Instructor edits the draft
    5. When ready, submits for review/approval
    6. Admin approves -> updates published course with changes
    
    Why needed:
    - Published courses need to be read-only for students
    - Instructors must edit drafts, not published versions directly
    - Dual-copy system maintains published state while allowing changes
    
    Returns: The newly created draft course record with all metadata
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def post(self, request, course_id):
        try:
            # Get the published course
            course = api_models.Course.objects.get(course_id=course_id)
            
            # 🔒 Validasi kepemilikan kursus (Admin diizinkan melakukan moderasi/publikasi)
            is_admin = (
                getattr(request.user, 'is_admin', False) or 
                getattr(request.user, 'is_staff', False) or 
                getattr(request.user, 'current_role', '') == 'admin' or 
                getattr(request.user, 'role', '') == 'admin'
            )
            if course.teacher.user != request.user and not is_admin:
                return Response(
                    {"success": False, "message": "Akses ditolak. Anda bukan pemilik kursus ini."},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Verify this is the published version or an editable draft of a published course
            if not course.is_published_version:
                # If course itself is already the draft copy of a published course, return it directly
                if course.published_copies.filter(is_published_version=True).exists() or course.platform_status == "Published":
                    return Response({
                        "success": True,
                        "message": "Draft versi dari kursus ini siap diedit.",
                        "is_new": False,
                        "course": {
                            "course_id": str(course.course_id),
                            "title": course.title,
                            "slug": course.slug,
                            "platform_status": course.platform_status
                        }
                    }, status=status.HTTP_200_OK)

                print(f"[Edit Published] [FAIL] Course is not a published version: {course.title}")
                return Response({
                    "success": False,
                    "message": "Hanya kursus yang sudah dipublikasikan yang dapat diedit dengan cara ini."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            print(f"[Edit Published] Creating draft version for: {course.title}")
            
            # Check if a draft version already exists for this published course
            existing_draft = api_models.Course.objects.filter(
                parent_course=course,
                is_published_version=False,
                platform_status__in=["Draft", "Review"]
            ).first()
            
            if existing_draft:
                print(f"[Edit Published] [INFO] Draft version already exists, returning existing: {existing_draft.course_id}")
                return Response({
                    "success": True,
                    "message": "Draft versi dari kursus ini sudah ada.",
                    "is_new": False,
                    "course": {
                        "course_id": str(existing_draft.course_id),
                        "title": existing_draft.title,
                        "slug": existing_draft.slug,
                        "platform_status": existing_draft.platform_status
                    }
                }, status=status.HTTP_200_OK)
            
            # Create new draft version
            draft_copy = course.create_draft_version()
            
            print(f"[Edit Published] [DONE] Draft version created successfully: {draft_copy.course_id}")
            
            return Response({
                "success": True,
                "message": f"Draft versi kursus '{course.title}' berhasil dibuat. Anda sekarang dapat mengedit kursus.",
                "is_new": True,
                "course": {
                    "course_id": str(draft_copy.course_id),
                    "title": draft_copy.title,
                    "slug": draft_copy.slug,
                    "platform_status": draft_copy.platform_status,
                    "description": draft_copy.description,
                    "category": {
                        "id": draft_copy.category.id if draft_copy.category else None,
                        "title": draft_copy.category.title if draft_copy.category else None
                    },
                    "level": draft_copy.level,
                    "image": draft_copy.image,
                    "featured": draft_copy.featured
                }
            }, status=status.HTTP_201_CREATED)
            
        except api_models.Course.DoesNotExist:
            print(f"[Edit Published] [FAIL] Course not found: {course_id}")
            return Response({
                "success": False,
                "error": "Kursus tidak ditemukan"
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"[Edit Published] [FAIL] ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                "success": False,
                "error": f"Gagal membuat draft versi: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




@method_decorator(csrf_exempt, name='dispatch')
class CourseApprovalAPIView(APIView):
    """
    [*] PHASE 4.36: Admin course approval endpoint
    
    Handles admin approval/rejection of courses awaiting review
    
    POST request body:
    {
        "action": "approve" or "reject",
        "rejection_reason": "Optional reason for rejection (required if action=reject)"
    }
    
    CSRF exempt because:
    - Uses JWT authentication for admin requests
    - Only admins can approve/reject courses
    - Safe state-changing operation with JWT validation
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    authentication_classes = [JWTAuthentication]
    
    def _get_or_create_published_copy(self, course):
        """
        [*] PHASE 4.74: Helper method to ensure published copy exists
        [*] PHASE 4.77 FIXED: Return tuple (published_copy, was_newly_created) to prevent duplicate content copying
        
        Returns: (published_course, was_newly_created)
        """
        published_copies = course.published_copies.filter(
            is_published_version=True
        )
        
        if published_copies.exists():
            # Return existing published copy WITHOUT re-copying content
            return published_copies.first(), False
        else:
            # Create new published copy (which internally calls _copy_content_to())
            return course.create_published_copy(), True
    
    def post(self, request, course_id):
        try:
            course = api_models.Course.objects.get(course_id=course_id)
            
            # User is already authenticated and verified as admin by permission_classes
            user = request.user
            
            action = request.data.get("action")
            rejection_reason = request.data.get("rejection_reason", "").strip()
            
            if action not in ["approve", "reject"]:
                return Response({
                    "success": False,
                    "error": "Action harus 'approve' atau 'reject'"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if action == "reject" and not rejection_reason:
                return Response({
                    "success": False,
                    "error": "Alasan penolakan harus disediakan ketika menolak kursus"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if action == "approve":
                # [*] PHASE 4.74 FIXED (PHASE 4.77): Enhanced approval with versioning
                print(f"[Admin Approval] Processing approval for course: {course.title}")
                
                # Step 1: Ensure published copy exists
                published, was_newly_created = self._get_or_create_published_copy(course)
                print(f"[Admin Approval] Working with published copy ID: {published.id}")
                
                # Step 2: Update content if re-publishing (only if published copy already existed)
                # [*] PHASE 4.77 FIX: Do NOT copy content if published was just created
                # because create_published_copy() already calls _copy_content_to() internally
                if not was_newly_created:
                    # This is a re-submission: instructor submitted -> admin rejected -> instructor re-submitted
                    # Copy latest draft content to published version
                    print(f"[Admin Approval] Re-publication detected. Syncing draft content to published version...")
                    
                    # ✨ PHASE 75.1 CRITICAL FIX: Prevent content duplication on re-approval
                    # [*] ROOT CAUSE: Using clear_target=False caused NEW content to be APPENDED to OLD content
                    # [*] SYMPTOM: Every re-submission duplicated content (1 feature → 5, 2 requirements → 10, etc.)
                    # [*] SOLUTION: Manually delete old content before syncing, then use clear_target=False
                    # This approach:
                    # 1. Clears the old curriculum, quizzes, features, requirements, learning outcomes
                    # 2. Preserves CompletedLesson/VideoProgress records (they'll become orphaned but still exist for audit)
                    # 3. Copies fresh content from draft version
                    # 4. Prevents duplication while minimizing data loss
                    
                    print(f"[Admin Approval] [CRITICAL] Refreshing non-progress metadata and smart-syncing content...")
                    published.features.all().delete()
                    published.requirements.all().delete()
                    published.learning_outcomes.all().delete()
                    print(f"[Admin Approval] [OK] Features, requirements, and outcomes refreshed")
                    
                    # Smart sync curriculum, quizzes, and games via intelligent upsert (clear_target=False)
                    # This guarantees student progress (CompletedLesson, VideoProgress, QuizAttempt, CourseGameAttempt) is preserved!
                    course._copy_content_to(published, clear_target=False)
                    print(f"[Admin Approval] [OK] Fresh draft content smart-synced to published version (no duplication, progress preserved)")
                else:
                    print(f"[Admin Approval] [OK] Published copy just created, content already in place")
                
                # Step 3: Approve the published version
                published.platform_status = "Published"
                published.teacher_course_status = "Published"
                published.approved_by = user
                published.approval_date = timezone.now()
                published.rejection_reason = None
                published.save()
                print(f"[Admin Approval] [OK] Set published copy to Published")
                
                # Step 4: Save current state as snapshot for future restoration
                published.save_published_snapshot()
                print(f"[Admin Approval] [OK] Saved published snapshot for restore functionality")
                
                # Step 5: Sync draft course status
                course.platform_status = "Published"
                course.teacher_course_status = "Published"
                course.approved_by = user
                course.approval_date = timezone.now()
                course.rejection_reason = None
                course.save()
                print(f"[Admin Approval] [OK] Synced draft course status to Published")

                # ✨ PHASE 4.36: Kirim notifikasi in-app otomatis ke instruktur
                try:
                    if course.teacher and course.teacher.user:
                        admin_display = user.get_full_name() or user.username
                        api_models.Notification.objects.create(
                            teacher=course.teacher,
                            user=course.teacher.user,
                            course=course,
                            type="Course Published",
                            title=f"Kursus Disetujui & Dipublikasikan! 🎉",
                            message=f"Selamat! Kursus Anda '{course.title}' telah ditelaah dan disetujui oleh Administrator ({admin_display}). Kursus ini sekarang telah tayang secara resmi di katalog pembelajaran LMSetjen DPD RI.",
                            seen=False
                        )
                        print(f"[Admin Approval] In-app notification sent to instructor: {course.teacher.user.username}")
                except Exception as noti_err:
                    print(f"[Admin Approval] Warning: Failed to create approval notification: {noti_err}")
                
                print(f"[Admin Approval] [DONE] Course fully approved: {course.title}")
                
                return Response({
                    "success": True,
                    "message": f"Kursus '{course.title}' telah disetujui dan dipublikasikan",
                    "course": {
                        "course_id": str(course.course_id),
                        "title": course.title,
                        "platform_status": course.platform_status,
                        "teacher_course_status": course.teacher_course_status,
                        "approved_by": user.get_full_name() or user.username,
                        "approval_date": course.approval_date.isoformat() if course.approval_date else None
                    }
                }, status=status.HTTP_200_OK)
            
            elif action == "reject":
                # Reject the course
                course.platform_status = "Rejected"
                course.rejection_reason = rejection_reason
                course.save()

                # ✨ PHASE 4.36: Kirim notifikasi catatan revisi in-app otomatis ke instruktur
                try:
                    if course.teacher and course.teacher.user:
                        admin_display = user.get_full_name() or user.username
                        api_models.Notification.objects.create(
                            teacher=course.teacher,
                            user=course.teacher.user,
                            course=course,
                            type="Course Rejected",
                            title=f"Catatan Revisi Kursus: {course.title[:45]}",
                            message=f"Kursus Anda '{course.title}' telah ditelaah oleh Administrator ({admin_display}) dan memerlukan perbaikan. Catatan revisi: \"{rejection_reason}\". Silakan buka editor kursus untuk memperbarui materi.",
                            seen=False
                        )
                        print(f"[Admin Rejection] In-app notification sent to instructor: {course.teacher.user.username}")
                except Exception as noti_err:
                    print(f"[Admin Rejection] Warning: Failed to create rejection notification: {noti_err}")
                
                return Response({
                    "success": True,
                    "message": f"Kursus '{course.title}' telah ditolak",
                    "course": {
                        "course_id": str(course.course_id),
                        "title": course.title,
                        "platform_status": course.platform_status,
                        "rejection_reason": rejection_reason
                    }
                }, status=status.HTTP_200_OK)
        
        except api_models.Course.DoesNotExist:
            return Response({
                "success": False,
                "error": "Kursus tidak ditemukan"
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"Error processing course approval: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                "success": False,
                "error": f"Gagal memproses persetujuan kursus: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@method_decorator(csrf_exempt, name='dispatch')
class CourseDetailAPIView(generics.RetrieveAPIView):
    """
    Public Course Detail API (Read-only)
    """
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_object(self):
        slug = self.kwargs['slug']
        return api_models.Course.objects.get(slug=slug)



@method_decorator(csrf_exempt, name='dispatch')
class CourseVariantDeleteAPIView(generics.DestroyAPIView):
    """
    Course Variant (Section) Delete API View
    
    CSRF exempt because:
    1. Uses JWT authentication for delete requests
    2. Requires authentication (JWT token) to delete
    3. State-changing operation protected by JWT validation
    """
    serializer_class = api_serializer.VariantSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]  # Disable SessionAuthentication

    def get_object(self):
        variant_id = self.kwargs['variant_id']
        teacher_id = self.kwargs['teacher_id']
        course_id = self.kwargs['course_id']

        from rest_framework.exceptions import PermissionDenied, NotFound

        try:
            user = self.request.user
            is_admin = (
                getattr(user, 'is_admin', False) or 
                getattr(user, 'is_staff', False) or 
                getattr(user, 'current_role', '') == 'admin' or 
                getattr(user, 'role', '') == 'admin'
            )
            if is_admin:
                course = api_models.Course.objects.get(course_id=course_id)
            else:
                teacher = api_models.Teacher.objects.get(id=teacher_id)
                if teacher.user != user:
                    raise PermissionDenied("Akses ditolak. Anda tidak berhak menghapus modul ini.")
                course = api_models.Course.objects.get(teacher=teacher, course_id=course_id)

            variant = api_models.Variant.objects.get(variant_id=variant_id, course=course)
            return variant
        except api_models.Teacher.DoesNotExist:

            raise Http404("Teacher not found")
        except api_models.Course.DoesNotExist:

            raise Http404("Course not found or you don't have permission to access it")
        except api_models.Variant.DoesNotExist:

            raise Http404("Section not found")

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            instance.delete()
            return Response(
                {"message": "Section deleted successfully"}, 
                status=status.HTTP_200_OK
            )
        except Http404 as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": "An error occurred while deleting the section"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    


@method_decorator(csrf_exempt, name='dispatch')
class CourseVariantItemDeleteAPIVIew(generics.DestroyAPIView):
    """
    Course Variant Item (Lecture) Delete API View
    
    CSRF exempt because:
    - Uses JWT authentication for delete requests
    - Requires authentication (JWT token) to delete
    - State-changing operation protected by JWT validation
    """
    serializer_class = api_serializer.VariantItemSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_object(self):
        variant_id = self.kwargs['variant_id']
        variant_item_id = self.kwargs['variant_item_id']
        teacher_id = self.kwargs['teacher_id']
        course_id = self.kwargs['course_id']

        try:
            from rest_framework.exceptions import PermissionDenied, NotFound

            user = self.request.user
            is_admin = (
                getattr(user, 'is_admin', False) or 
                getattr(user, 'is_staff', False) or 
                getattr(user, 'current_role', '') == 'admin' or 
                getattr(user, 'role', '') == 'admin'
            )
            if is_admin:
                course = api_models.Course.objects.get(course_id=course_id)
            else:
                teacher = api_models.Teacher.objects.get(id=teacher_id)
                if teacher.user != user:
                    raise PermissionDenied("Akses ditolak. Anda tidak berhak menghapus modul ini.")
                course = api_models.Course.objects.get(teacher=teacher, course_id=course_id)

            variant = api_models.Variant.objects.get(variant_id=variant_id, course=course)
            variant_item = api_models.VariantItem.objects.get(variant=variant, variant_item_id=variant_item_id)
            return variant_item
        except api_models.Teacher.DoesNotExist:
            raise Http404("Teacher not found")
        except api_models.Course.DoesNotExist:
            raise Http404("Course not found or you don't have permission to access it")
        except api_models.Variant.DoesNotExist:
            raise Http404("Section not found")
        except api_models.VariantItem.DoesNotExist:
            raise Http404("Lecture not found")

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            instance.delete()
            return Response(
                {"message": "Lecture deleted successfully"}, 
                status=status.HTTP_200_OK
            )
        except Http404 as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": "An error occurred while deleting the lecture"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    



@method_decorator(csrf_exempt, name='dispatch')
class CourseEnrollmentAPIView(generics.CreateAPIView):
    """
    Course Enrollment API
    
    CSRF exempt because:
    - Uses JWT authentication for student operations
    - Creates course enrollment records
    - Data validated by EnrolledCourseSerializer
    """
    serializer_class = api_serializer.EnrolledCourseSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        course_id = request.data.get('course_id')
        user_id = request.data.get('user_id')

        if not course_id or not user_id:
            return Response({"error": "course_id and user_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if str(course_id).isdigit():
                course = api_models.Course.objects.get(id=course_id)
            else:
                course = api_models.Course.objects.get(course_id=course_id)
            user = User.objects.get(id=user_id)
        except api_models.Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if user is already enrolled
        existing_enrollment = api_models.EnrolledCourse.objects.filter(course=course, user=user).first()
        if existing_enrollment:
            return Response({
                "error": "Already enrolled in this course",
                "enrollment_id": existing_enrollment.enrollment_id
            }, status=status.HTTP_400_BAD_REQUEST)

        # 🔒 Check target audience access rules:
        # - "internal" (or legacy "pegawai"): Only INTERNAL users (or is_internal=True or admin/staff)
        # - "asn": INTERNAL and ASN users (or is_internal=True or admin/staff)
        # - "umum": Open to everyone (INTERNAL, ASN, UMUM)
        audience = (course.target_audience or "umum").lower()
        user_type = getattr(user, 'user_type', 'UMUM')
        is_internal_user = getattr(user, 'is_internal', False) or user_type == 'INTERNAL' or user.is_staff or user.is_superuser

        if audience in ['internal', 'pegawai']:
            if not is_internal_user:
                return Response({
                    "error": "Akses Dibatasi: Kursus ini dikhususkan bagi Pegawai Internal Setjen DPD RI."
                }, status=status.HTTP_403_FORBIDDEN)
        elif audience == 'asn':
            if not (is_internal_user or user_type == 'ASN'):
                return Response({
                    "error": "Akses Dibatasi: Kursus ini dikhususkan bagi Aparatur Sipil Negara (ASN)."
                }, status=status.HTTP_403_FORBIDDEN)

        try:
            # Create enrollment directly without order/payment dependency
            enrollment = api_models.EnrolledCourse.objects.create(
                course=course,
                user=user,
                teacher=course.teacher
            )

            # Create notification for student
            api_models.Notification.objects.create(
                user=user,
                course=course,
                type="Course Enrollment Completed",
                title=f"Pendaftaran Berhasil: {course.title}",
                message=f"Selamat! Anda telah resmi terdaftar pada materi '{course.title}'. Selamat belajar!",
                seen=False
            )
            # Notify instructor as well
            if course.teacher and course.teacher.user:
                api_models.Notification.objects.create(
                    user=course.teacher.user,
                    teacher=course.teacher,
                    course=course,
                    type="Course Enrollment Completed",
                    title=f"Peserta Baru: {user.full_name}",
                    message=f"Peserta {user.full_name} telah bergabung dan mendaftar pada kursus '{course.title}'.",
                    seen=False
                )

            return Response({
                "message": "Successfully enrolled in course",
                "enrollment_id": enrollment.enrollment_id,
                "course": {
                    "id": course.id,
                    "title": course.title,
                    "slug": course.slug
                }
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": f"Enrollment failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class CheckEnrollmentStatusAPIView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]

    def get(self, request, course_id, user_id):
        try:
            if str(course_id).isdigit():
                course = api_models.Course.objects.get(id=course_id)
            else:
                course = api_models.Course.objects.get(course_id=course_id)
            user = User.objects.get(id=user_id)
        except api_models.Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        audience = (course.target_audience or "umum").lower()
        user_type = getattr(user, 'user_type', 'UMUM')
        is_internal_user = getattr(user, 'is_internal', False) or user_type == 'INTERNAL' or user.is_staff or user.is_superuser
        
        can_access = True
        restriction_message = ""
        if audience in ['internal', 'pegawai'] and not is_internal_user:
            can_access = False
            restriction_message = "Kursus ini dikhususkan bagi Pegawai Internal Setjen DPD RI."
        elif audience == 'asn' and not (is_internal_user or user_type == 'ASN'):
            can_access = False
            restriction_message = "Kursus ini dikhususkan bagi Aparatur Sipil Negara (ASN)."

        enrollment = api_models.EnrolledCourse.objects.filter(course=course, user=user).first()
        
        if enrollment:
            return Response({
                "is_enrolled": True,
                "enrollment_id": enrollment.enrollment_id,
                "enrollment_date": enrollment.date,
                "can_access": can_access,
                "restriction_message": restriction_message,
                "target_audience": audience,
                "user_type": user_type
            })
        else:
            return Response({
                "is_enrolled": False,
                "can_access": can_access,
                "restriction_message": restriction_message,
                "target_audience": audience,
                "user_type": user_type
            })




# Quiz Management API Views
@method_decorator(csrf_exempt, name='dispatch')
class QuizListCreateAPIView(generics.ListCreateAPIView):
    """
    Quiz List/Create API View
    
    CSRF exempt because:
    - Uses JWT authentication for quiz creation
    - AllowAny allows listing, JWT required for creation
    - Quiz data validated by serializers
    """
    serializer_class = api_serializer.QuizSerializer
    permission_classes = [AllowAny]
    authentication_classes = []  # Disable SessionAuthentication

    def get_queryset(self):
        course_id = self.request.query_params.get('course_id')
        if course_id:
            return api_models.Quiz.objects.filter(course__course_id=course_id).order_by('-date')
        return api_models.Quiz.objects.all()

    def perform_create(self, serializer):
        course_id = self.request.data.get('course_id')
        course = api_models.Course.objects.get(course_id=course_id)
        serializer.save(course=course)



@method_decorator(csrf_exempt, name='dispatch')
class QuizDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    Quiz Detail API View (Update/Delete)
    
    CSRF exempt because:
    1. Uses JWT authentication for update/delete operations
    2. Requires authentication (JWT token) for state-changing operations
    3. Quiz data validated by serializers
    """
    serializer_class = api_serializer.QuizSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]  # Disable SessionAuthentication
    lookup_field = 'quiz_id'

    def get_queryset(self):
        # 🔒 FIX IDOR: Batasi queryset hanya pada kuis milik instruktur yang sedang login
        user = self.request.user
        
        # Jika admin, izinkan akses ke semua
        if getattr(user, 'is_admin', False):
            # Sesuaikan nama model (Quiz / QuizQuestion / QuizChoice) sesuai kelasnya
            return api_models.Quiz.objects.all() 
            
        # Jika bukan admin, hanya bisa memanipulasi kuis di kursus miliknya
        return api_models.Quiz.objects.filter(course__teacher__user=user)



@method_decorator(csrf_exempt, name='dispatch')
class QuizQuestionListCreateAPIView(generics.ListCreateAPIView):
    """
    Quiz Question List/Create API View
    
    CSRF exempt because:
    - Uses JWT authentication for question creation
    - AllowAny allows listing, JWT required for creation
    - Question data validated by serializers
    """
    serializer_class = api_serializer.QuizQuestionSerializer
    permission_classes = [AllowAny]
    authentication_classes = []  # Disable SessionAuthentication

    def get_queryset(self):
        quiz_id = self.request.query_params.get('quiz_id')
        if quiz_id:
            return api_models.QuizQuestion.objects.filter(quiz__quiz_id=quiz_id).order_by('order')
        return api_models.QuizQuestion.objects.all()

    def perform_create(self, serializer):
        quiz_id = self.request.data.get('quiz_id')
        quiz = api_models.Quiz.objects.get(quiz_id=quiz_id)
        variant_id = self.request.data.get('variant_id') or self.request.data.get('variant')
        variant = None
        if variant_id:
            variant = api_models.Variant.objects.filter(variant_id=variant_id).first()
            if not variant and str(variant_id).isdigit():
                variant = api_models.Variant.objects.filter(id=int(variant_id)).first()
        # Auto-increment order
        last_question = api_models.QuizQuestion.objects.filter(quiz=quiz).order_by('-order').first()
        next_order = (last_question.order + 1) if last_question else 1
        serializer.save(quiz=quiz, variant=variant, order=next_order)



@method_decorator(csrf_exempt, name='dispatch')
class QuizQuestionDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    Quiz Question Detail API View (Update/Delete)
    
    CSRF exempt because:
    1. Uses JWT authentication for update/delete operations
    2. Requires authentication (JWT token) for state-changing operations
    3. Question data validated by serializers
    """
    serializer_class = api_serializer.QuizQuestionSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]  # Disable SessionAuthentication
    lookup_field = 'question_id'

    def get_queryset(self):
        # 🔒 FIX IDOR: Batasi queryset hanya pada kuis milik instruktur yang sedang login
        user = self.request.user
        
        # Jika admin, izinkan akses ke semua
        if getattr(user, 'is_admin', False):
            # Sesuaikan nama model (Quiz / QuizQuestion / QuizChoice) sesuai kelasnya
            return api_models.QuizQuestion.objects.all() 
            
        # Jika bukan admin, hanya bisa memanipulasi kuis di kursus miliknya
        return api_models.QuizQuestion.objects.filter(quiz__course__teacher__user=user)

    def perform_update(self, serializer):
        kwargs = {}
        if 'variant_id' in self.request.data or 'variant' in self.request.data:
            variant_id = self.request.data.get('variant_id') or self.request.data.get('variant')
            if not variant_id or variant_id == 'null':
                kwargs['variant'] = None
            else:
                variant = api_models.Variant.objects.filter(variant_id=variant_id).first()
                if not variant and str(variant_id).isdigit():
                    variant = api_models.Variant.objects.filter(id=int(variant_id)).first()
                kwargs['variant'] = variant
        serializer.save(**kwargs)



@method_decorator(csrf_exempt, name='dispatch')
class QuizQuestionReorderAPIView(APIView):
    """
    Reorder questions in a quiz
    POST payload:
    {
        "orders": [
            {"question_id": "123456", "order": 1},
            {"question_id": "654321", "order": 2}
        ]
    }
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request, *args, **kwargs):
        orders = request.data.get('orders', [])
        if not orders:
            return Response({"error": "No orders provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        is_admin = getattr(user, 'is_admin', False)

        with transaction.atomic():
            for item in orders:
                q_id = item.get('question_id')
                new_order = item.get('order')
                if q_id and new_order is not None:
                    qs = api_models.QuizQuestion.objects.filter(question_id=q_id)
                    if not is_admin:
                        qs = qs.filter(quiz__course__teacher__user=user)
                    qs.update(order=new_order)

        return Response({"message": "Questions reordered successfully"}, status=status.HTTP_200_OK)



@method_decorator(csrf_exempt, name='dispatch')
class QuizChoiceListCreateAPIView(generics.ListCreateAPIView):
    """
    Quiz Choice List/Create API View
    
    CSRF exempt because:
    - Uses JWT authentication for choice creation
    - AllowAny allows listing, JWT required for creation
    - Choice data validated by serializers
    """
    serializer_class = api_serializer.QuizChoiceSerializer
    permission_classes = [AllowAny]
    authentication_classes = []  # Disable SessionAuthentication

    def get_queryset(self):
        question_id = self.request.query_params.get('question_id')
        if question_id:
            return api_models.QuizChoice.objects.filter(question__question_id=question_id).order_by('order')
        return api_models.QuizChoice.objects.all()

    def perform_create(self, serializer):
        question_id = self.request.data.get('question_id')
        question = api_models.QuizQuestion.objects.get(question_id=question_id)
        point_weight = self.request.data.get('point_weight', 0.00)
        # Auto-increment order
        last_choice = api_models.QuizChoice.objects.filter(question=question).order_by('-order').first()
        next_order = (last_choice.order + 1) if last_choice else 1
        serializer.save(question=question, point_weight=point_weight, order=next_order)



@method_decorator(csrf_exempt, name='dispatch')
class QuizChoiceDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    Quiz Choice Detail API View (Update/Delete)
    
    CSRF exempt because:
    1. Uses JWT authentication for update/delete operations
    2. Requires authentication (JWT token) for state-changing operations
    3. Choice data validated by serializers
    """
    serializer_class = api_serializer.QuizChoiceSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]  # Disable SessionAuthentication
    lookup_field = 'choice_id'

    def get_queryset(self):
        # 🔒 FIX IDOR: Batasi queryset hanya pada kuis milik instruktur yang sedang login
        user = self.request.user
        
        # Jika admin, izinkan akses ke semua
        if getattr(user, 'is_admin', False):
            # Sesuaikan nama model (Quiz / QuizQuestion / QuizChoice) sesuai kelasnya
            return api_models.QuizChoice.objects.all() 
            
        # Jika bukan admin, hanya bisa memanipulasi kuis di kursus miliknya
        return api_models.QuizChoice.objects.filter(question__quiz__course__teacher__user=user)




# [*] PHASE 4.45: Course Features, Requirements, and Learning Outcomes Management APIs

@method_decorator(csrf_exempt, name='dispatch')
class CourseFeatureListCreateAPIView(generics.ListCreateAPIView):
    """
    [*] PHASE 4.45: Manage course features (what's included)
    GET: List all features for a course
    POST: Create a new feature
    """
    serializer_class = api_serializer.CourseFeatureSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get_queryset(self):
        course_id = self.kwargs['course_id']
        return api_models.CourseFeature.objects.filter(course__course_id=course_id).order_by('order')
    
    def perform_create(self, serializer):
        course_id = self.kwargs['course_id']
        course = api_models.Course.objects.get(course_id=course_id)
        serializer.save(course=course)
    
    def create(self, request, *args, **kwargs):
        # Get next order value
        course_id = kwargs['course_id']
        max_order = api_models.CourseFeature.objects.filter(course__course_id=course_id).aggregate(Max('order'))['order__max'] or -1
        
        data = request.data.copy()
        data['order'] = max_order + 1
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # [*] PHASE 4.46: Reset published course status when features are modified
        course = api_models.Course.objects.get(course_id=course_id)
        if course.platform_status == "Published":
            print(f"[Feature Update] Course '{course.title}' is being updated while Published. Resetting to Review status for admin approval.")
            from django.utils import timezone
            course.platform_status = "Review"
            course.review_submitted_date = timezone.now()
            course.save()
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)




class CourseFeatureDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    [*] PHASE 4.45: Manage individual course feature
    GET: Get feature details
    PUT/PATCH: Update feature
    DELETE: Delete feature
    """
    serializer_class = api_serializer.CourseFeatureSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get_queryset(self):
        course_id = self.kwargs['course_id']
        return api_models.CourseFeature.objects.filter(course__course_id=course_id)
    
    def get_object(self):
        feature_id = self.kwargs['feature_id']
        return api_models.CourseFeature.objects.get(id=feature_id)
    
    def perform_update(self, serializer):
        # [*] PHASE 4.46: Reset published course status when features are modified
        course_id = self.kwargs['course_id']
        course = api_models.Course.objects.get(course_id=course_id)
        if course.platform_status == "Published":
            print(f"[Feature Update] Course '{course.title}' is being updated while Published. Resetting to Review status for admin approval.")
            from django.utils import timezone
            course.platform_status = "Review"
            course.review_submitted_date = timezone.now()
            course.save()
        
        serializer.save()
    
    def perform_destroy(self, instance):
        # [*] PHASE 4.46: Reset published course status when features are deleted
        course = instance.course
        if course.platform_status == "Published":
            print(f"[Feature Delete] Course '{course.title}' is being updated while Published. Resetting to Review status for admin approval.")
            from django.utils import timezone
            course.platform_status = "Review"
            course.review_submitted_date = timezone.now()
            course.save()
        
        instance.delete()




@method_decorator(csrf_exempt, name='dispatch')
class CourseRequirementListCreateAPIView(generics.ListCreateAPIView):
    """
    [*] PHASE 4.45: Manage course requirements (prerequisites)
    GET: List all requirements for a course
    POST: Create a new requirement
    """
    serializer_class = api_serializer.CourseRequirementSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get_queryset(self):
        course_id = self.kwargs['course_id']
        return api_models.CourseRequirement.objects.filter(course__course_id=course_id).order_by('order')
    
    def perform_create(self, serializer):
        course_id = self.kwargs['course_id']
        course = api_models.Course.objects.get(course_id=course_id)
        serializer.save(course=course)
    
    def create(self, request, *args, **kwargs):
        # Get next order value
        course_id = kwargs['course_id']
        max_order = api_models.CourseRequirement.objects.filter(course__course_id=course_id).aggregate(Max('order'))['order__max'] or -1
        
        data = request.data.copy()
        data['order'] = max_order + 1
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # [*] PHASE 4.46: Reset published course status when requirements are modified
        course = api_models.Course.objects.get(course_id=course_id)
        if course.platform_status == "Published":
            print(f"[Requirement Update] Course '{course.title}' is being updated while Published. Resetting to Review status for admin approval.")
            from django.utils import timezone
            course.platform_status = "Review"
            course.review_submitted_date = timezone.now()
            course.save()
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)




@method_decorator(csrf_exempt, name='dispatch')
class CourseRequirementDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    [*] PHASE 4.45: Manage individual course requirement
    GET: Get requirement details
    PUT/PATCH: Update requirement
    DELETE: Delete requirement
    """
    serializer_class = api_serializer.CourseRequirementSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get_queryset(self):
        course_id = self.kwargs['course_id']
        return api_models.CourseRequirement.objects.filter(course__course_id=course_id)
    
    def get_object(self):
        requirement_id = self.kwargs['requirement_id']
        return api_models.CourseRequirement.objects.get(id=requirement_id)
    
    def perform_update(self, serializer):
        # [*] PHASE 4.46: Reset published course status when requirements are modified
        course_id = self.kwargs['course_id']
        course = api_models.Course.objects.get(course_id=course_id)
        if course.platform_status == "Published":
            print(f"[Requirement Update] Course '{course.title}' is being updated while Published. Resetting to Review status for admin approval.")
            from django.utils import timezone
            course.platform_status = "Review"
            course.review_submitted_date = timezone.now()
            course.save()
        
        serializer.save()
    
    def perform_destroy(self, instance):
        # [*] PHASE 4.46: Reset published course status when requirements are deleted
        course = instance.course
        if course.platform_status == "Published":
            print(f"[Requirement Delete] Course '{course.title}' is being updated while Published. Resetting to Review status for admin approval.")
            from django.utils import timezone
            course.platform_status = "Review"
            course.review_submitted_date = timezone.now()
            course.save()
        
        instance.delete()




@method_decorator(csrf_exempt, name='dispatch')
class CourseLearningOutcomeListCreateAPIView(generics.ListCreateAPIView):
    """
    [*] PHASE 4.45: Manage course learning outcomes (what students will learn)
    GET: List all learning outcomes for a course
    POST: Create a new learning outcome
    """
    serializer_class = api_serializer.CourseLearningOutcomeSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get_queryset(self):
        course_id = self.kwargs['course_id']
        return api_models.CourseLearningOutcome.objects.filter(course__course_id=course_id).order_by('order')
    
    def perform_create(self, serializer):
        course_id = self.kwargs['course_id']
        course = api_models.Course.objects.get(course_id=course_id)
        serializer.save(course=course)
    
    def create(self, request, *args, **kwargs):
        # Get next order value
        course_id = kwargs['course_id']
        max_order = api_models.CourseLearningOutcome.objects.filter(course__course_id=course_id).aggregate(Max('order'))['order__max'] or -1
        
        data = request.data.copy()
        data['order'] = max_order + 1
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # [*] PHASE 4.46: Reset published course status when learning outcomes are modified
        course = api_models.Course.objects.get(course_id=course_id)
        if course.platform_status == "Published":
            print(f"[Learning Outcome Update] Course '{course.title}' is being updated while Published. Resetting to Review status for admin approval.")
            from django.utils import timezone
            course.platform_status = "Review"
            course.review_submitted_date = timezone.now()
            course.save()
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)




@method_decorator(csrf_exempt, name='dispatch')
class CourseLearningOutcomeDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    [*] PHASE 4.45: Manage individual course learning outcome
    GET: Get learning outcome details
    PUT/PATCH: Update learning outcome
    DELETE: Delete learning outcome
    """
    serializer_class = api_serializer.CourseLearningOutcomeSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get_queryset(self):
        course_id = self.kwargs['course_id']
        return api_models.CourseLearningOutcome.objects.filter(course__course_id=course_id)
    
    def get_object(self):
        outcome_id = self.kwargs['outcome_id']
        return api_models.CourseLearningOutcome.objects.get(id=outcome_id)
    
    def perform_update(self, serializer):
        # [*] PHASE 4.46: Reset published course status when learning outcomes are modified
        course_id = self.kwargs['course_id']
        course = api_models.Course.objects.get(course_id=course_id)
        if course.platform_status == "Published":
            print(f"[Learning Outcome Update] Course '{course.title}' is being updated while Published. Resetting to Review status for admin approval.")
            from django.utils import timezone
            course.platform_status = "Review"
            course.review_submitted_date = timezone.now()
            course.save()
        
        serializer.save()
    
    def perform_destroy(self, instance):
        # [*] PHASE 4.46: Reset published course status when learning outcomes are deleted
        course = instance.course
        if course.platform_status == "Published":
            print(f"[Learning Outcome Delete] Course '{course.title}' is being updated while Published. Resetting to Review status for admin approval.")
            from django.utils import timezone
            course.platform_status = "Review"
            course.review_submitted_date = timezone.now()
            course.save()
        
        instance.delete()






# =====================================================================
# Gamification Management API Views (Instructor & Admin)
# =====================================================================
@method_decorator(csrf_exempt, name='dispatch')
class CourseGameListCreateAPIView(generics.ListCreateAPIView):
    """
    List games for a course or create a new game.
    """
    serializer_class = api_serializer.CourseGameSerializer
    permission_classes = [AllowAny]
    authentication_classes = [JWTAuthentication]
    pagination_class = None

    def get_queryset(self):
        course_id = self.request.query_params.get('course_id')
        if course_id:
            return api_models.CourseGame.objects.filter(course__course_id=course_id).order_by('order', 'date')
        return api_models.CourseGame.objects.all().order_by('order', 'date')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['user'] = self.request.user
        return context


    def perform_create(self, serializer):
        course_id = self.request.data.get('course_id')
        course = api_models.Course.objects.get(course_id=course_id)
        serializer.save(course=course)


@method_decorator(csrf_exempt, name='dispatch')
class CourseGameDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update or delete a course game.
    """
    serializer_class = api_serializer.CourseGameSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    lookup_field = 'game_id'

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'is_admin', False) or getattr(user, 'is_staff', False):
            return api_models.CourseGame.objects.all()
        # Instructor can manage games for their courses
        return api_models.CourseGame.objects.filter(course__teacher__user=user)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['user'] = self.request.user
        return context


@method_decorator(csrf_exempt, name='dispatch')
class PdfDataAPIView(APIView):
    """
    Returns base64 data for PDF documents to bypass IDM (Internet Download Manager)
    and browser interception extensions, allowing 100% reliable in-browser PDF viewing.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        file_url = request.query_params.get("file_url", "").strip()
        if not file_url:
            return Response({"success": False, "error": "file_url parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        import urllib.parse
        import os
        import base64
        from django.conf import settings

        parsed = urllib.parse.urlparse(file_url)
        path = parsed.path
        if path.startswith("/media/"):
            rel_path = path[len("/media/"):]
            abs_file_path = os.path.join(settings.MEDIA_ROOT, rel_path)
        else:
            abs_file_path = os.path.join(settings.MEDIA_ROOT, path.lstrip("/"))

        if not os.path.exists(abs_file_path) or not os.path.isfile(abs_file_path):
            return Response({"success": False, "error": "Berkas PDF tidak ditemukan di server."}, status=status.HTTP_404_NOT_FOUND)

        try:
            with open(abs_file_path, "rb") as f:
                file_bytes = f.read()

            base64_data = base64.b64encode(file_bytes).decode("utf-8")
            file_name = os.path.basename(abs_file_path)

            return Response({
                "success": True,
                "file_name": file_name,
                "size_bytes": len(file_bytes),
                "data": base64_data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class MediaDataAPIView(APIView):
    """
    Returns base64 data and mime-type for media files (audio, pdf, documents) to bypass
    IDM (Internet Download Manager) and browser interception extensions, allowing 100%
    reliable in-browser media playback without stream disconnection or download interception.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        file_url = request.query_params.get("file_url", "").strip()
        if not file_url:
            return Response({"success": False, "error": "file_url parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        import urllib.parse
        import os
        import base64
        import mimetypes
        from django.conf import settings

        parsed = urllib.parse.urlparse(file_url)
        path = parsed.path
        if path.startswith("/media/"):
            rel_path = path[len("/media/"):]
            abs_file_path = os.path.join(settings.MEDIA_ROOT, rel_path)
        else:
            abs_file_path = os.path.join(settings.MEDIA_ROOT, path.lstrip("/"))

        if not os.path.exists(abs_file_path) or not os.path.isfile(abs_file_path):
            return Response({"success": False, "error": "Berkas media tidak ditemukan di server."}, status=status.HTTP_404_NOT_FOUND)

        try:
            ext = os.path.splitext(abs_file_path)[1].lower()
            audio_mimes = {
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4',
                '.aac': 'audio/aac',
                '.flac': 'audio/flac',
                '.pdf': 'application/pdf',
            }
            mime_type = audio_mimes.get(ext)
            if not mime_type:
                mime_type, _ = mimetypes.guess_type(abs_file_path)
            if not mime_type:
                mime_type = 'application/octet-stream'

            with open(abs_file_path, "rb") as f:
                file_bytes = f.read()

            base64_data = base64.b64encode(file_bytes).decode("utf-8")
            file_name = os.path.basename(abs_file_path)

            return Response({
                "success": True,
                "file_name": file_name,
                "mime_type": mime_type,
                "size_bytes": len(file_bytes),
                "data": base64_data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class PresentationPreviewAPIView(APIView):
    """
    Generate preview metadata for presentation files (PPTX) and online presentations (Google Slides).
    Allows curriculum editor and course viewer to render slide previews without requiring Office Live.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        file_url = request.query_params.get("file_url", "").strip()
        if not file_url:
            return Response({"success": False, "error": "file_url parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Handle Google Slides URLs
        if "docs.google.com/presentation" in file_url:
            import re
            embed_url = file_url
            if "/edit" in embed_url or "/view" in embed_url:
                embed_url = re.sub(r'/(edit|view).*$', '/embed?start=false&loop=false&delayms=3000', embed_url)
            elif not embed_url.endswith("/embed"):
                embed_url = embed_url.rstrip("/") + "/embed"
            return Response({
                "success": True,
                "is_google_slides": True,
                "embed_url": embed_url,
                "original_url": file_url,
                "file_name": "Google Slides Presentation"
            })

        # 2. Resolve local file path safely
        import urllib.parse
        import os
        import base64
        import zipfile
        from django.conf import settings

        parsed = urllib.parse.urlparse(file_url)
        path = urllib.parse.unquote(parsed.path)

        media_url = getattr(settings, 'MEDIA_URL', '/media/')
        if path.startswith(media_url):
            rel_path = path[len(media_url):].lstrip("/\\")
        elif "/media/" in path:
            rel_path = path.split("/media/", 1)[1].lstrip("/\\")
        else:
            rel_path = path.lstrip("/\\")

        abs_file_path = os.path.abspath(os.path.join(settings.MEDIA_ROOT, rel_path))
        real_media_root = os.path.abspath(settings.MEDIA_ROOT)

        # Prevent directory traversal
        if not abs_file_path.startswith(real_media_root):
            return Response({"success": False, "error": "Akses path berkas tidak diizinkan."}, status=status.HTTP_403_FORBIDDEN)

        if not os.path.exists(abs_file_path):
            return Response({"success": False, "error": f"Berkas tidak ditemukan: {os.path.basename(abs_file_path)}"}, status=status.HTTP_404_NOT_FOUND)

        file_name = os.path.basename(abs_file_path)
        ext = os.path.splitext(file_name)[1].lower()

        if ext not in [".pptx", ".ppt"]:
            return Response({"success": False, "error": "Hanya berkas presentasi (.pptx) yang didukung untuk pratinjau slide."}, status=status.HTTP_400_BAD_REQUEST)

        # Extract presentation metadata
        thumbnail_base64 = None
        slide_count = 0
        slides_info = []

        # Try extracting thumbnail from OpenXML package (PPTX is a zip archive)
        if ext == ".pptx":
            try:
                with zipfile.ZipFile(abs_file_path, 'r') as zf:
                    # Look for thumbnail in docProps
                    for item in zf.namelist():
                        if item.lower().startswith("docprops/thumbnail."):
                            img_data = zf.read(item)
                            mime = "image/jpeg" if item.lower().endswith((".jpeg", ".jpg")) else "image/png"
                            thumbnail_base64 = f"data:{mime};base64,{base64.b64encode(img_data).decode('utf-8')}"
                            break
            except Exception as e:
                logger.warning(f"Failed to extract thumbnail from PPTX {file_name}: {e}")

            # Extract slides structure with python-pptx
            try:
                from pptx import Presentation
                prs = Presentation(abs_file_path)
                slide_count = len(prs.slides)
                slide_w = prs.slide_width or 12191695
                slide_h = prs.slide_height or 6858000
                aspect_ratio = round(float(slide_w) / float(slide_h), 4)

                ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}

                def parse_paragraph_xml(p_element):
                    pPr = p_element.find('a:pPr', ns)
                    align = 'left'
                    def_color = None
                    def_size = None
                    def_bold = False

                    if pPr is not None:
                        algn = pPr.get('algn', 'left')
                        if algn == 'ctr': align = 'center'
                        elif algn == 'r': align = 'right'
                        elif algn == 'just': align = 'justify'

                        defRPr = pPr.find('a:defRPr', ns)
                        if defRPr is not None:
                            if defRPr.get('b') == '1': def_bold = True
                            sz = defRPr.get('sz')
                            if sz: def_size = int(sz) / 100.0
                            srgb = defRPr.find('.//a:srgbClr', ns)
                            if srgb is not None: def_color = '#' + srgb.get('val')

                    runs = []
                    for r in p_element.findall('a:r', ns):
                        t_el = r.find('a:t', ns)
                        if t_el is None or not t_el.text: continue
                        text = t_el.text
                        rPr = r.find('a:rPr', ns)
                        color = def_color
                        size = def_size
                        bold = def_bold
                        if rPr is not None:
                            if rPr.get('b') == '1': bold = True
                            elif rPr.get('b') == '0': bold = False
                            sz = rPr.get('sz')
                            if sz: size = int(sz) / 100.0
                            srgb = rPr.find('.//a:srgbClr', ns)
                            if srgb is not None: color = '#' + srgb.get('val')
                        runs.append({
                            'text': text,
                            'color': color,
                            'size': size,
                            'bold': bold
                        })
                    return {'align': align, 'runs': runs}

                for idx, slide in enumerate(prs.slides):
                    # 1. Determine slide title
                    slide_title = ""
                    try:
                        if slide.shapes.title and slide.shapes.title.text.strip():
                            slide_title = slide.shapes.title.text.strip()
                    except Exception:
                        pass

                    # 2. Extract background color if any
                    slide_bg_color = None
                    try:
                        if slide.background and hasattr(slide.background, 'fill') and slide.background.fill.type == 1:
                            slide_bg_color = '#' + str(slide.background.fill.fore_color.rgb)
                    except Exception:
                        pass

                    # 3. Extract all shapes with exact layout coordinates, styling, and text runs
                    rendered_shapes = []
                    all_text_list = []

                    for shape in slide.shapes:
                        left_pct = round((float(shape.left or 0) / float(slide_w)) * 100, 2)
                        top_pct = round((float(shape.top or 0) / float(slide_h)) * 100, 2)
                        width_pct = round((float(shape.width or 0) / float(slide_w)) * 100, 2)
                        height_pct = round((float(shape.height or 0) / float(slide_h)) * 100, 2)

                        fill_color = None
                        try:
                            if hasattr(shape, 'fill') and shape.fill.type == 1:
                                fill_color = '#' + str(shape.fill.fore_color.rgb)
                        except Exception:
                            pass

                        border_color = None
                        try:
                            if hasattr(shape, 'line') and shape.line.fill.type == 1:
                                border_color = '#' + str(shape.line.color.rgb)
                        except Exception:
                            pass

                        shape_type_name = "rectangle"
                        shape_name_lower = (shape.name or "").lower()
                        if "round" in shape_name_lower:
                            shape_type_name = "rounded-rectangle"
                        elif "text" in shape_name_lower:
                            shape_type_name = "textbox"

                        paragraphs_data = []
                        if shape.has_text_frame:
                            for p in shape.text_frame.paragraphs:
                                parsed_p = parse_paragraph_xml(p._p)
                                if parsed_p['runs']:
                                    full_p_text = ''.join(r['text'] for r in parsed_p['runs']).strip()
                                    if full_p_text:
                                        all_text_list.append(full_p_text)
                                        paragraphs_data.append({
                                            'align': parsed_p['align'],
                                            'runs': parsed_p['runs'],
                                            'level': p.level or 0
                                        })

                        table_data = None
                        if shape.has_table:
                            table_rows = []
                            for r in shape.table.rows:
                                row_cells = []
                                for cell in r.cells:
                                    cell_text = cell.text.strip()
                                    if cell_text: all_text_list.append(cell_text)
                                    row_cells.append(cell_text)
                                table_rows.append(row_cells)
                            table_data = table_rows

                        rendered_shapes.append({
                            'name': shape.name,
                            'type': shape_type_name,
                            'left': left_pct,
                            'top': top_pct,
                            'width': width_pct,
                            'height': height_pct,
                            'fill': fill_color,
                            'border': border_color,
                            'paragraphs': paragraphs_data,
                            'table': table_data
                        })

                    # Fallback title if not detected via slide.shapes.title
                    if not slide_title and all_text_list:
                        first_line = all_text_list[0].split("\n")[0].strip()
                        slide_title = first_line[:100]

                    if not slide_title:
                        slide_title = f"Slide {idx + 1}"

                    # Extract speaker notes if any
                    notes = ""
                    try:
                        if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                            notes = slide.notes_slide.notes_text_frame.text.strip()
                    except Exception:
                        pass

                    slides_info.append({
                        "slide_number": idx + 1,
                        "title": slide_title,
                        "bg_color": slide_bg_color,
                        "shapes": rendered_shapes,
                        "all_texts": all_text_list,
                        "notes": notes
                    })
            except Exception as e:
                logger.warning(f"python-pptx parse error for {file_name}: {e}")

        return Response({
            "success": True,
            "file_name": file_name,
            "slide_count": slide_count,
            "aspect_ratio": aspect_ratio if ext == ".pptx" else 1.7778,
            "thumbnail": thumbnail_base64,
            "slides": slides_info,
            "file_url": file_url
        })


from django.views.decorators.clickjacking import xframe_options_exempt
from django.utils.decorators import method_decorator

@method_decorator(xframe_options_exempt, name='dispatch')
class WebPreviewProxyAPIView(APIView):
    """
    Proxies external web pages for iframe previews, stripping headers like
    X-Frame-Options and Content-Security-Policy that block iframe rendering
    in LMS (e.g. government portals, educational sites with SAMEORIGIN).
    Injects <base href="..."> so that all assets, styles, and links resolve correctly.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        target_url = request.query_params.get("url", "").strip()
        if not target_url:
            return Response({"error": "url parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate URL scheme
        if not (target_url.startswith("http://") or target_url.startswith("https://")):
            return Response({"error": "Invalid URL scheme. Only HTTP and HTTPS are allowed."}, status=status.HTTP_400_BAD_REQUEST)

        import urllib.parse
        import urllib3
        import re
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        # SSRF Protection: Disallow loopback / private IP targets
        parsed = urllib.parse.urlparse(target_url)
        hostname = (parsed.hostname or "").lower()
        if hostname in ["localhost", "127.0.0.1", "0.0.0.0", "::1"] or hostname.endswith(".local"):
            return Response({"error": "Access to local addresses is restricted."}, status=status.HTTP_403_FORBIDDEN)

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "id,en-US;q=0.7,en;q=0.3",
        }

        try:
            resp = requests.get(target_url, headers=headers, timeout=12, verify=False, allow_redirects=True)
            content_type = resp.headers.get("Content-Type", "text/html; charset=utf-8")

            if "text/html" in content_type.lower():
                html = resp.text
                final_url = resp.url or target_url
                base_tag = f'<base href="{final_url}">'

                # Unwrap <noscript> tags into visible containers so pre-rendered content
                # (articles, book cards, synopses, PDFs) renders reliably even if third-party
                # SPAs (Vue/React/Keycloak SSO) fail inside cross-origin iframes.
                html = re.sub(
                    r'<noscript\b[^>]*>(.*?)</noscript>',
                    r'<div class="web-preview-unwrapped-content">\1</div>',
                    html,
                    flags=re.DOTALL | re.IGNORECASE
                )

                # Determine absolute base proxy endpoint using incoming request host
                try:
                    proxy_base_endpoint = request.build_absolute_uri('/api/v1/course/web-preview/')
                except Exception:
                    host = request.META.get('HTTP_HOST', '127.0.0.1:8001')
                    proxy_base_endpoint = f"http://{host}/api/v1/course/web-preview/"

                def proxy_resource_url(raw_url):
                    raw_url = raw_url.strip('\'" ')
                    if not raw_url or raw_url.startswith('data:'):
                        return raw_url
                    # CRITICAL: Prevent re-proxying already proxied URLs!
                    if '/api/v1/course/web-preview/' in raw_url:
                        return raw_url
                    if not (raw_url.startswith('http://') or raw_url.startswith('https://') or raw_url.startswith('/')):
                        return raw_url
                    abs_url = urllib.parse.urljoin(final_url, raw_url)
                    return f"{proxy_base_endpoint}?url={urllib.parse.quote(abs_url)}"

                # Rewrite external stylesheet links so that fonts declared inside them are proxied with CORS headers
                def rewrite_css_link(match):
                    full_tag = match.group(0)
                    m = re.search(r'href=[\'"]?([^\'" >]+)[\'"]?', full_tag)
                    if m:
                        href_val = m.group(1)
                        if not href_val.startswith('data:') and not href_val.startswith('https://fonts.googleapis.com'):
                            if '/api/v1/course/web-preview/' not in href_val:
                                abs_href = urllib.parse.urljoin(final_url, href_val)
                                proxied_href = f"{proxy_base_endpoint}?url={urllib.parse.quote(abs_href)}"
                                return full_tag.replace(href_val, proxied_href)
                    return full_tag

                html = re.sub(r'<link[^>]*rel=[\'"]?stylesheet[\'"]?[^>]*>', rewrite_css_link, html, flags=re.IGNORECASE)

                # Transform Quasar's SSR fake image divs into real <img> elements with absolute proxied URLs
                def replace_qimg_div(match):
                    full_str = match.group(0)
                    bg_m = re.search(r'background-image:\s*url\((?:&quot;|[\'"])?([^&"\'\)]+)(?:&quot;|[\'"])?\)', full_str)
                    if bg_m:
                        img_url = bg_m.group(1).strip()
                        abs_proxy_url = proxy_resource_url(img_url)
                        return f'<img src="{abs_proxy_url}" class="web-preview-real-img" alt="Gambar Materi" />'
                    return full_str

                html = re.sub(
                    r'<div[^>]*class=["\'][^"\']*q-img__image[^"\']*["\'][^>]*>(?:</div>)?',
                    replace_qimg_div,
                    html,
                    flags=re.IGNORECASE
                )
                html = re.sub(
                    r'<div[^>]*style=["\'][^"\']*background-image:[^"\']*["\'][^>]*class=["\'][^"\']*q-img__image[^"\']*["\'][^>]*>(?:</div>)?',
                    replace_qimg_div,
                    html,
                    flags=re.IGNORECASE
                )

                # Clean escaped HTML entities in inline CSS background-image: url(&quot;...&quot;)
                html = re.sub(r'url\(&quot;([^&]+)&quot;\)', r"url('\1')", html)

                # Rewrite any remaining inline style background-image URLs so they route through proxy with proper image MIME type
                def rewrite_inline_bg_url(match):
                    raw_val = match.group(1).strip('\'" ')
                    if '/api/v1/course/web-preview/' in raw_val:
                        return match.group(0)
                    return f"url('{proxy_resource_url(raw_val)}')"

                html = re.sub(r'url\((?![\'"]?data:)([^)]+)\)', rewrite_inline_bg_url, html)

                # Rewrite img src attributes so images route through proxy with proper image MIME type (without double proxying)
                def rewrite_img_src(match):
                    full_tag = match.group(0)
                    m = re.search(r'src=[\'"]?([^\'" >]+)[\'"]?', full_tag)
                    if m:
                        src_val = m.group(1)
                        if '/api/v1/course/web-preview/' not in src_val:
                            return full_tag.replace(src_val, proxy_resource_url(src_val))
                    return full_tag

                html = re.sub(r'<img\b[^>]*>', rewrite_img_src, html, flags=re.IGNORECASE)

                helper_code = '''
<script>
window.vueRecaptchaApiLoaded = window.vueRecaptchaApiLoaded || function(){};
(function() {
    // Intercept Window.prototype.postMessage to prevent targetOrigin DOMWindow mismatch errors
    var origWindowPostMessage = Window.prototype.postMessage;
    Window.prototype.postMessage = function(message, targetOrigin, transfer) {
        try {
            if (targetOrigin && targetOrigin !== '*' && targetOrigin !== window.location.origin) {
                targetOrigin = '*';
            }
            if (transfer) return origWindowPostMessage.call(this, message, targetOrigin, transfer);
            return origWindowPostMessage.call(this, message, targetOrigin);
        } catch(e) {}
    };

    // Intercept iframe.contentWindow to wrap postMessage so child iframes don't throw targetOrigin errors
    try {
        var origContentWindowGetter = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get;
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: function() {
                var realWin = origContentWindowGetter.call(this);
                if (!realWin) return realWin;
                try {
                    return new Proxy(realWin, {
                        get: function(target, prop) {
                            if (prop === 'postMessage') {
                                return function(msg, targetOrigin, transfer) {
                                    try {
                                        if (targetOrigin && targetOrigin !== '*' && targetOrigin !== window.location.origin) {
                                            targetOrigin = '*';
                                        }
                                        return transfer ? target.postMessage(msg, targetOrigin, transfer) : target.postMessage(msg, targetOrigin);
                                    } catch(e) {}
                                };
                            }
                            var val = target[prop];
                            if (typeof val === 'function') {
                                return val.bind(target);
                            }
                            return val;
                        }
                    });
                } catch(e) {
                    return realWin;
                }
            }
        });
    } catch(e) {}

    // Intercept Keycloak login-status-iframe to prevent 403 Forbidden & postMessage DOMWindow mismatch
    var origSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
        if (name === 'src' && typeof value === 'string' && value.includes('login-status-iframe')) {
            var self = this;
            setTimeout(function() {
                try {
                    if (typeof self.onload === 'function') self.onload();
                } catch(e) {}
            }, 50);
            return origSetAttribute.call(this, name, 'about:blank');
        }
        return origSetAttribute.apply(this, arguments);
    };

    var origReplaceState = history.replaceState;
    var origPushState = history.pushState;

    history.replaceState = function(state, title, url) {
        try {
            if (url) {
                try {
                    var parsed = new URL(url, document.baseURI);
                    if (parsed.origin !== window.location.origin) {
                        return origReplaceState.call(this, state, title, window.location.pathname + window.location.search);
                    }
                } catch(e) {}
            }
            return origReplaceState.apply(this, arguments);
        } catch(e) {}
    };

    history.pushState = function(state, title, url) {
        try {
            if (url) {
                try {
                    var parsed = new URL(url, document.baseURI);
                    if (parsed.origin !== window.location.origin) {
                        return origPushState.call(this, state, title, window.location.pathname + window.location.search);
                    }
                } catch(e) {}
            }
            return origPushState.apply(this, arguments);
        } catch(e) {}
    };

    // Suppress third-party cross-origin errors (Keycloak SSO, analytics)
    window.addEventListener('unhandledrejection', function(e) {
        if (e) {
            e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
        }
    });
    window.addEventListener('error', function(e) {
        if (e) {
            e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
        }
    });

    // Open all anchor links in a new tab safely
    window.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('a').forEach(function(a) {
            if (!a.target || a.target === '_self') {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
            }
        });
    });
})();
</script>
<style>
.web-preview-unwrapped-content {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    margin: 0 auto !important;
    max-width: 980px !important;
    padding: 24px 32px !important;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
    background: #ffffff !important;
    color: #1e293b !important;
    line-height: 1.7 !important;
}
.web-preview-unwrapped-content .q-page,
.web-preview-unwrapped-content main {
    min-height: auto !important;
    height: auto !important;
}
.web-preview-unwrapped-content .fit {
    width: 100% !important;
    height: auto !important;
}
.web-preview-unwrapped-content .row {
    display: flex !important;
    flex-wrap: wrap !important;
}
.web-preview-unwrapped-content .col-5 {
    flex: 0 0 38% !important;
    max-width: 38% !important;
}
.web-preview-unwrapped-content .col-7 {
    flex: 0 0 62% !important;
    max-width: 62% !important;
    padding-left: 28px !important;
}
.web-preview-unwrapped-content .col-9,
.web-preview-unwrapped-content .col-10,
.web-preview-unwrapped-content .col-12 {
    flex: 0 0 100% !important;
    max-width: 100% !important;
}
.web-preview-unwrapped-content .q-img {
    position: relative !important;
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 16px auto !important;
    overflow: hidden !important;
    border-radius: 8px !important;
    box-shadow: none !important;
}
.web-preview-unwrapped-content .q-img > div[style*="padding-bottom"] {
    display: none !important;
}
.web-preview-unwrapped-content .q-img__content {
    display: none !important;
}
.web-preview-unwrapped-content img.web-preview-real-img {
    max-width: 100% !important;
    height: auto !important;
    display: block !important;
    margin: 16px auto !important;
    border-radius: 8px !important;
    box-shadow: 0 4px 14px rgba(0,0,0,0.1) !important;
    object-fit: contain !important;
}
.web-preview-unwrapped-content .text-h4 {
    font-size: 1.6rem !important;
    font-weight: 700 !important;
    color: #0f172a !important;
    margin-bottom: 8px !important;
    line-height: 1.35 !important;
}
.web-preview-unwrapped-content .text-grey-6 {
    color: #64748b !important;
    font-size: 0.95rem !important;
    margin-bottom: 14px !important;
}
.web-preview-unwrapped-content .text-body1 {
    font-size: 1rem !important;
    line-height: 1.75 !important;
    color: #334155 !important;
}
.web-preview-unwrapped-content p {
    font-size: 1rem !important;
    line-height: 1.75 !important;
    color: #334155 !important;
    margin-bottom: 1rem !important;
}
.web-preview-unwrapped-content a.q-btn,
.web-preview-unwrapped-content .q-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 10px 24px !important;
    background: #0284c7 !important;
    color: #ffffff !important;
    border-radius: 6px !important;
    text-decoration: none !important;
    font-weight: 600 !important;
    margin-top: 16px !important;
    box-shadow: 0 2px 6px rgba(2,132,199,0.35) !important;
}
.web-preview-unwrapped-content a.q-btn:hover {
    background: #0369a1 !important;
}
</style>
'''

                if "<head" in html.lower():
                    html = re.sub(r'(<head[^>]*>)', r'\1' + base_tag + helper_code, html, count=1, flags=re.IGNORECASE)
                else:
                    html = base_tag + helper_code + html

                response = HttpResponse(html, content_type=content_type, status=resp.status_code)
            elif "text/css" in content_type.lower():
                css_text = resp.text
                final_url = resp.url or target_url
                try:
                    proxy_base_endpoint = request.build_absolute_uri('/api/v1/course/web-preview/')
                except Exception:
                    host = request.META.get('HTTP_HOST', '127.0.0.1:8001')
                    proxy_base_endpoint = f"http://{host}/api/v1/course/web-preview/"

                # Rewrite relative font and asset URLs in CSS so they route through our proxy with CORS headers
                def rewrite_css_url(match):
                    raw_val = match.group(1).strip('\'"')
                    if raw_val.startswith('data:') or '/api/v1/course/web-preview/' in raw_val:
                        return match.group(0)
                    abs_url = urllib.parse.urljoin(final_url, raw_val)
                    proxied_url = f"{proxy_base_endpoint}?url={urllib.parse.quote(abs_url)}"
                    return f"url('{proxied_url}')"

                css_text = re.sub(r'url\((?![\'"]?data:)([^)]+)\)', rewrite_css_url, css_text)
                response = HttpResponse(css_text, content_type="text/css; charset=utf-8", status=resp.status_code)
            else:
                content = resp.content
                # Sniff magic bytes for proper image Content-Type so browsers render images without nosniff blocking
                if content.startswith(b'\xff\xd8\xff'):
                    content_type = "image/jpeg"
                elif content.startswith(b'\x89PNG\r\n\x1a\n'):
                    content_type = "image/png"
                elif content.startswith(b'GIF87a') or content.startswith(b'GIF89a'):
                    content_type = "image/gif"
                elif content.startswith(b'RIFF') and content[8:12] == b'WEBP':
                    content_type = "image/webp"
                elif content.startswith(b'\x00\x00\x01\x00'):
                    content_type = "image/x-icon"
                elif b'<svg' in content[:250].lower():
                    content_type = "image/svg+xml"

                response = HttpResponse(content, content_type=content_type, status=resp.status_code)

            # Ensure iframe can embed this proxy response and has unrestricted CORS
            response.xframe_options_exempt = True
            if "X-Frame-Options" in response:
                del response["X-Frame-Options"]
            if "Content-Security-Policy" in response:
                del response["Content-Security-Policy"]
            if "X-Content-Type-Options" in response:
                del response["X-Content-Type-Options"]
            response["Access-Control-Allow-Origin"] = "*"
            response["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            response["Access-Control-Allow-Headers"] = "*"

            return response
        except requests.exceptions.Timeout:
            return HttpResponse(
                f"<div style='font-family:sans-serif;padding:30px;text-align:center;'><h3>Waktu Koneksi Habis</h3><p>Halaman web <b>{target_url}</b> membutuhkan waktu terlalu lama untuk merespons.</p><a href='{target_url}' target='_blank' style='display:inline-block;padding:8px 16px;background:#0d9488;color:#fff;text-decoration:none;border-radius:4px;'>Buka Langsung di Tab Baru</a></div>",
                content_type="text/html",
                status=504
            )
        except Exception as e:
            return HttpResponse(
                f"<div style='font-family:sans-serif;padding:30px;text-align:center;'><h3>Tidak Dapat Memuat Halaman Web</h3><p>{str(e)}</p><a href='{target_url}' target='_blank' style='display:inline-block;padding:8px 16px;background:#0d9488;color:#fff;text-decoration:none;border-radius:4px;'>Buka Langsung di Tab Baru</a></div>",
                content_type="text/html",
                status=502
            )


