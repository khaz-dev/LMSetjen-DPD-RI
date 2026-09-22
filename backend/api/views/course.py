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
            
            # 7. Platform rating (average of all course ratings)
            try:
                platform_rating = api_models.Review.objects.filter(
                    active=True
                ).aggregate(avg_rating=Avg('rating'))['avg_rating'] or 4.8
                platform_rating = round(float(platform_rating), 1)
            except:
                platform_rating = 4.8
            
            return Response({
                'total_courses': total_courses,
                'total_students': total_students,
                'total_teachers': total_teachers,
                'completion_rate': completion_rate,
                'total_certificates': total_certificates,
                'total_materials': total_materials,
                'platform_rating': platform_rating,
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
                'completion_rate': 0,
                'total_certificates': 0,
                'total_materials': 0,
                'platform_rating': 4.8
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
            category = request.data.get("category")

            print(f"=== Course Creation Debug ===")
            print(f"Title: {title}")
            print(f"Description length: {len(description) if description else 0}")
            print(f"Image URL: {image_url}")
            print(f"Image URL length: {len(image_url) if image_url else 0}")
            print(f"File URL: {file_url}")
            print(f"File URL length: {len(file_url) if file_url else 0}")
            print(f"Level: {level}")
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

            # Create course with Draft status (not published until curriculum is complete)
            course = api_models.Course.objects.create(
                teacher=teacher,
                category=category_obj,
                file=file_url,     # Store URL instead of file
                image=image_url,   # Store URL instead of file
                title=title,
                description=description,
                level=level,
                platform_status="Draft",           # Set to Draft for admin/platform review
                teacher_course_status="Draft"      # Set to Draft - teacher needs to complete curriculum
            )

            print(f"Course created successfully with ID: {course.course_id}")
            print(f"Course status: platform_status={course.platform_status}, teacher_course_status={course.teacher_course_status}")

            return Response({
                "message": "Course Created Successfully",
                "course_id": course.course_id,
                "status": "draft",
                "next_step": "Add curriculum, lessons, and quizzes to publish your course"
            }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import traceback
            print(f"Error creating course: {str(e)}")
            print(f"Full traceback:")
            print(traceback.format_exc())
            return Response({"error": f"Internal server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ✨ PHASE 4.101: Helper function to delete orphaned files
def delete_orphaned_file(file_url):
    """
    Delete a file from storage based on its URL
    
    MEMORY OPTIMIZATION: Prevents accumulation of orphaned files when course
    images/files are replaced. Only deletes files from our local storage
    (not external URLs like Google Drive, YouTube, CDNs).
    
    Args:
        file_url (str): Full URL or path to file
    
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
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_object(self):
        teacher_id = self.kwargs['teacher_id']
        course_id = self.kwargs['course_id']

        teacher = api_models.Teacher.objects.get(id=teacher_id)

        # 🔒 FIX IDOR: Validasi kepemilikan sebelum memproses update
        is_admin = getattr(self.request.user, 'is_admin', False)
        if teacher.user != self.request.user and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Akses ditolak. Anda bukan pemilik kursus ini.")

        course = api_models.Course.objects.get(course_id=course_id)
        
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
                    delete_orphaned_file(course.image)
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
                    delete_orphaned_file(course.file)
                elif not course.file:
                    print(f"[Memory Cleanup] ⏭️  SKIPPED: course.file is empty/None")
                elif new_file == course.file:
                    print(f"[Memory Cleanup] ⏭️  SKIPPED: File not changing")
            else:
                print(f"[Memory Cleanup] ⏭️  SKIPPED: No 'file' in request or file is empty")
            
            # ✨ PHASE 4.101.3: Simplified - old files now deleted automatically on each upload
            # No need to process unsaved_image_uploads here anymore!
            
            # Serialize and validate
            serializer = self.get_serializer(course, data=request.data)
            
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
                        from .url_utils import extract_video_duration_from_url
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
                    if variant_item:
                        print(f"[Curriculum Update] Updating existing item {variant_item.variant_item_id}: {item_title}")
                        variant_item.title = item_title
                        variant_item.description = item_description
                        variant_item.preview = preview
                        variant_item.order = int(item_order) if item_order else 0
                        # PHASE 4.167: Always set file field (None if empty) to allow clearing files
                        # This ensures deleted files are properly removed from the database
                        variant_item.file = file
                        if duration is not None:
                            variant_item.duration = duration
                        variant_item.save()
                        updated_item_ids.add(variant_item.variant_item_id)
                    else:
                        print(f"[Curriculum Update] Item ID {variant_item_id} not found, creating new item: {item_title}")
                        variant_item = api_models.VariantItem.objects.create(
                            variant=variant,
                            title=item_title,
                            description=item_description,
                            file=file,
                            duration=duration,
                            preview=preview,
                            order=int(item_order) if item_order else 0
                        )
                        updated_item_ids.add(variant_item.variant_item_id)
                else:
                    print(f"[Curriculum Update] Creating new item: {item_title}")
                    variant_item = api_models.VariantItem.objects.create(
                        variant=variant,
                        title=item_title,
                        description=item_description,
                        file=file,
                        duration=duration,
                        preview=preview,
                        order=int(item_order) if item_order else 0
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
                # ✨ PHASE 4.101: Clean up variant item files before deletion
                for item in variant.variant_items.all():
                    if item.file:
                        delete_orphaned_file(item.file)
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
                        # ✨ PHASE 4.101: Clean up item file before deletion
                        if item.file:
                            delete_orphaned_file(item.file)
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
    permission_classes = [AllowAny]
    authentication_classes = []  # Disable SessionAuthentication to prevent CSRF enforcement
    
    def post(self, request, course_id):
        try:
            course = api_models.Course.objects.get(course_id=course_id)
            
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
    permission_classes = [AllowAny]
    authentication_classes = []  # Will check authentication in post method
    
    def post(self, request, course_id):
        try:
            # Get the draft course to restore
            course = api_models.Course.objects.get(course_id=course_id)
            
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
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request, course_id):
        try:
            # Get the published course
            course = api_models.Course.objects.get(course_id=course_id)
            
            # Verify this is the published version
            if not course.is_published_version:
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
                    
                    print(f"[Admin Approval] [CRITICAL] Deleting old published version content to prevent duplication...")
                    published.curriculum.all().delete()
                    published.quizzes.all().delete()
                    published.features.all().delete()
                    published.requirements.all().delete()
                    published.learning_outcomes.all().delete()
                    print(f"[Admin Approval] [OK] Old content deleted from published version")
                    
                    # Now sync fresh content from draft (clear_target=False since we already deleted manually)
                    course._copy_content_to(published, clear_target=False)
                    print(f"[Admin Approval] [OK] Fresh draft content synced to published version (no duplication)")
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
class CourseDetailAPIView(generics.RetrieveDestroyAPIView):
    """
    Course Detail API (Retrieve/Delete)
    
    CSRF exempt because:
    - Uses JWT authentication for course operations
    - Public endpoint for course viewing
    - Course deletion secured by ownership verification
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
            teacher = api_models.Teacher.objects.get(id=teacher_id)

            # 🔒 FIX IDOR: Validasi kepemilikan
            is_admin = getattr(self.request.user, 'is_admin', False)
            if teacher.user != self.request.user and not is_admin:
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
            teacher = api_models.Teacher.objects.get(id=teacher_id)

            from rest_framework.exceptions import PermissionDenied, NotFound

            # 🔒 FIX IDOR: Validasi kepemilikan
            is_admin = getattr(self.request.user, 'is_admin', False)
            if teacher.user != self.request.user and not is_admin:
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
            course = api_models.Course.objects.get(id=course_id)
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

        try:
            # Create enrollment directly without order/payment dependency
            enrollment = api_models.EnrolledCourse.objects.create(
                course=course,
                user=user,
                teacher=course.teacher
            )

            # Create notification
            api_models.Notification.objects.create(
                user=user,
                type="Course Enrollment Completed"
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
            course = api_models.Course.objects.get(id=course_id)
            user = User.objects.get(id=user_id)
        except api_models.Course.DoesNotExist:
            return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        enrollment = api_models.EnrolledCourse.objects.filter(course=course, user=user).first()
        
        if enrollment:
            return Response({
                "is_enrolled": True,
                "enrollment_id": enrollment.enrollment_id,
                "enrollment_date": enrollment.date
            })
        else:
            return Response({
                "is_enrolled": False
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
        # Auto-increment order
        last_question = api_models.QuizQuestion.objects.filter(quiz=quiz).order_by('-order').first()
        next_order = (last_question.order + 1) if last_question else 1
        serializer.save(quiz=quiz, order=next_order)



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
        return api_models.QuizQuestion.objects.filter(course__teacher__user=user)



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
        # Auto-increment order
        last_choice = api_models.QuizChoice.objects.filter(question=question).order_by('-order').first()
        next_order = (last_choice.order + 1) if last_choice else 1
        serializer.save(question=question, order=next_order)



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




