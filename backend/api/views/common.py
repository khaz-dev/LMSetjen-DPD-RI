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
import uuid
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


class TestimonialListAPIView(generics.GenericAPIView):
    """
    Testimonials List API - Returns top testimonials sorted by user's golongan (Government Rank)
    Used for homepage testimonials section
    
    Returns top 3 reviews sorted by golongan from highest (IV/e) to lowest (II/a)
    
    Filters testimonials by the role the user testified as, not by the user's current role flags.
    This allows multi-role users to have separate testimonials for each role.
    
    [*] PHASE 4.11: Updated to support multi-role testimonials using role field
    
    Returns:
    - List of reviews with user profile information and golongan
    """
    permission_classes = [AllowAny]
    
    def golongan_sort_key(self, golongan_str):
        """
        Convert golongan string to sortable tuple
        Format: "IV/e", "III/a", "II/c", etc.
        Returns: (roman_value, letter_value) for sorting
        
        Roman numerals: IV=4, III=3, II=2, I=1
        Letters: a=1, b=2, c=3, d=4, e=5, f=6
        """
        if not golongan_str:
            return (0, 0)
        
        try:
            parts = golongan_str.strip().split('/')
            if len(parts) != 2:
                return (0, 0)
            
            roman_part = parts[0].strip().upper()
            letter_part = parts[1].strip().lower()
            
            # Convert Roman numeral to integer
            roman_values = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5}
            roman_value = roman_values.get(roman_part, 0)
            
            # Convert letter to integer (a=1, b=2, etc.)
            letter_value = ord(letter_part) - ord('a') + 1 if letter_part else 0
            
            return (roman_value, -letter_value)  # Negative letter for descending order
        except:
            return (0, 0)
    
    def get(self, request):
        try:
            # [*] PHASE 4.11: Accept role parameter to filter testimonials by the role they testified as
            role = request.query_params.get('role', None)
            
            # ✨ PHASE 4.12.1: Fetch ONLY platform testimonials (course__isnull=True), NOT course reviews
            # Fetch all active reviews with related user and profile data
            reviews_query = api_models.Review.objects.filter(
                active=True,
                course__isnull=True  # ✨ PHASE 4.12.1: CRITICAL FIX - Only show platform testimonials, not course reviews
            ).select_related('user', 'user__profile').order_by('-date')
            
            # [*] PHASE 4.11: Filter by review role, NOT user role flags
            # This allows multi-role users to testify separately as student and instructor
            if role == 'student':
                reviews_query = reviews_query.filter(role='student')
            elif role == 'instructor':
                reviews_query = reviews_query.filter(role='instructor')
            # If no role specified or invalid role, return all reviews
            
            # Convert to list and sort by golongan (highest to lowest)
            reviews_list = list(reviews_query)
            reviews_list.sort(
                key=lambda r: self.golongan_sort_key(r.user.golongan if r.user else ''),
                reverse=True
            )
            
            # Get top 3
            top_reviews = reviews_list[:3]
            
            # Serialize the data
            testimonials_data = []
            for review in top_reviews:
                user = review.user
                profile = user.profile if user else None
                
                # ✨ PHASE 4.12.1: Fixed field references to correctly access organization_unit and position
                org_unit_name = 'Setjen DPD RI'
                position_name = ''
                
                if profile and profile.organization_unit:
                    org_unit_name = profile.organization_unit.name
                
                if profile and profile.position:
                    position_name = profile.position.name
                elif user and user.kelas_jabatan:
                    position_name = user.kelas_jabatan
                
                # ✨ PHASE 4.12.2: Determine if user is public (no NIP = not from Pegawai AWS Sync)
                is_public_user = not (user and user.nip)
                
                # ✨ PHASE 11.10: Convert relative image URLs to absolute + cache-busting
                image_url = None
                if profile and profile.image:
                    image_path = str(profile.image)
                    # Check if already absolute URL
                    if image_path.startswith('http://') or image_path.startswith('https://'):
                        image_url = image_path
                    else:
                        # Convert relative path to absolute URL with cache-busting timestamp
                        if not image_path.startswith('/'):
                            image_path = f"/media/{image_path}"
                        from datetime import datetime
                        timestamp = int(datetime.now().timestamp() * 1000) // 3600000  # Cache-bust per hour
                        absolute_url = request.build_absolute_uri(image_path)
                        image_url = f"{absolute_url}?v={timestamp}"
                
                testimonials_data.append({
                    'id': review.id,
                    'full_name': user.full_name if user else 'Anonymous',
                    'golongan': user.golongan if user else '',
                    'position': position_name,
                    'unit_organisasi': org_unit_name,  # ✨ PHASE 4.12.1: Renamed from 'organization' for clarity
                    'nip': user.nip if user else None,  # ✨ PHASE 4.12.2: Include NIP for public user distinction
                    'is_public_user': is_public_user,  # ✨ PHASE 4.12.2: Flag for public users (no NIP from Pegawai AWS)
                    'review': review.review,
                    'rating': review.rating,
                    'role': review.role,  # [*] PHASE 4.11: Include role in response
                    'image': image_url,  # ✨ PHASE 11.10: Now returns absolute URL with cache-busting
                    'date': review.date.isoformat()
                })
            
            return Response({
                'count': len(testimonials_data),
                'results': testimonials_data,
                'timestamp': timezone.now().isoformat()
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            # 🔒 SECURITY: Log error securely, return generic response
            import logging
            logger = logging.getLogger('security')
            logger.error(f"Error in TestimonialListAPIView: {str(e)}", exc_info=True)
            return Response({
                'error': 'An error occurred while fetching testimonials',
                'results': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class TestimonialCreateAPIView(generics.CreateAPIView):
    """
    Testimonial Submission API - Students/Instructors can submit general testimonials
    For the homepage testimonials section (not tied to specific courses)
    
    POST /api/v1/student/submit-testimonial/
    
    Request body:
    {
        "rating": 1-5,
        "review": "testimonial text...",
        "role": "student" or "instructor" (optional, defaults to current role)
    }
    
    Returns:
    - 201: Testimonial created successfully
    - 200: Testimonial updated successfully
    - 400: Missing fields or validation error
    - 401: Unauthorized (authentication required)
    - 500: Server error
    
    [*] PHASE 4.11: Updated to support multi-role testimonials
    """
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def create(self, request, *args, **kwargs):
        try:
            user = request.user
            rating = request.data.get('rating')
            review_text = request.data.get('review')
            role = request.data.get('role', 'student')  # [*] PHASE 4.11: Accept role parameter

            # Validation
            if not review_text or not review_text.strip():
                return Response(
                    {"error": "Testimoni harus diisi"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not rating or rating < 1 or rating > 5:
                return Response(
                    {"error": "Rating harus antara 1 dan 5"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # [*] PHASE 4.11: Validate role parameter
            valid_roles = ['student', 'instructor']
            if role not in valid_roles:
                return Response(
                    {"error": f"Role harus salah satu dari: {', '.join(valid_roles)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # [*] PHASE 4.11: Check user has the specified role
            if role == 'student' and not user.is_student:
                return Response(
                    {"error": "Anda tidak memiliki role sebagai student"}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            elif role == 'instructor' and not user.is_instructor:
                return Response(
                    {"error": "Anda tidak memiliki role sebagai instructor"}, 
                    status=status.HTTP_403_FORBIDDEN
                )

            # [*] PHASE 4.11: Check if user already has a testimonial for this specific role
            existing_testimonial = api_models.Review.objects.filter(
                user=user, 
                course__isnull=True,  # General testimonial (no course)
                role=role  # Specific role
            ).first()
            
            if existing_testimonial:
                # UPDATE existing testimonial
                existing_testimonial.review = review_text.strip()
                existing_testimonial.rating = int(rating)
                existing_testimonial.active = False  # [*] PHASE 4.12: Require admin approval after update
                existing_testimonial.reply = None  # [*] FIX 4.15: Clear rejection reason on resubmission
                existing_testimonial.save()

                return Response({
                    "message": f"Testimoni Anda sebagai {role} berhasil diperbarui! Testimoni akan ditampilkan setelah disetujui admin.",
                    "testimonial_id": existing_testimonial.id,
                    "status": "updated",
                    "role": role,
                    "requires_approval": True
                }, status=status.HTTP_200_OK)
            else:
                # CREATE new testimonial
                testimonial = api_models.Review.objects.create(
                    user=user,
                    course=None,  # General testimonial, not tied to specific course
                    role=role,  # [*] PHASE 4.11: Store the role
                    review=review_text.strip(),
                    rating=int(rating),
                    active=False,  # [*] PHASE 4.12: Require admin approval before showing on homepage
                )

                return Response({
                    "message": f"Testimoni Anda sebagai {role} berhasil dikirim! Testimoni akan ditampilkan setelah disetujui admin.",
                    "testimonial_id": testimonial.id,
                    "status": "pending_review",
                    "role": role,
                    "requires_approval": True
                }, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            return Response(
                {"error": f"Format data tidak valid: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except KeyError as e:
            return Response(
                {"error": f"Field yang diperlukan tidak ditemukan: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"Gagal menyimpan testimoni: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )




class TestimonialDetailAPIView(generics.GenericAPIView):
    """
    User's Testimonial Detail API - Get, Update, or Delete user's testimonial
    
    GET /api/v1/student/testimonial/?role=student   - Get user's student testimonial
    GET /api/v1/student/testimonial/?role=instructor - Get user's instructor testimonial
    DELETE /api/v1/student/testimonial/?role=student - Delete user's student testimonial
    
    Returns:
    - 200: Success (GET)
    - 204: Success (DELETE)
    - 404: Testimonial not found
    - 401: Unauthorized
    - 500: Server error
    
    [*] PHASE 4.11: Updated to support multi-role testimonials
    """
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_user_testimonial(self, role='student'):
        """Get the authenticated user's testimonial for a specific role"""
        try:
            return api_models.Review.objects.get(
                user=self.request.user,
                course__isnull=True,  # General testimonial only
                role=role  # [*] PHASE 4.11: Filter by role
            )
        except api_models.Review.DoesNotExist:
            return None

    def get(self, request, *args, **kwargs):
        """Get user's testimonial for a specific role"""
        # [*] PHASE 4.11: Accept role from query params
        role = request.query_params.get('role', 'student')
        
        if role not in ['student', 'instructor']:
            return Response(
                {"error": "Invalid role parameter"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        testimonial = self.get_user_testimonial(role=role)
        
        if not testimonial:
            # Return 200 OK with null data instead of 404
            # "No testimonial yet" is not an error, it's a normal empty state
            return Response(
                None,  # Return null instead of error message
                status=status.HTTP_200_OK
            )
        
        serializer = self.get_serializer(testimonial)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, *args, **kwargs):
        """Delete user's testimonial for a specific role"""
        # [*] PHASE 4.11: Accept role from query params
        role = request.query_params.get('role', 'student')
        
        if role not in ['student', 'instructor']:
            return Response(
                {"error": "Invalid role parameter"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        testimonial = self.get_user_testimonial(role=role)
        
        if not testimonial:
            return Response(
                {"error": "Testimoni tidak ditemukan"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        testimonial.delete()
        return Response({
            "message": "Testimoni Anda berhasil dihapus",
            "status": "deleted"
        }, status=status.HTTP_204_NO_CONTENT)




# [*] PHASE 4.13: User Testimonials List - Users can see all their submitted testimonials with status
class UserTestimonialsListAPIView(generics.ListAPIView):
    """
    User Testimonials List API - Get all user's submitted testimonials with status
    
    GET /api/v1/student/testimonials/list/?role=student
    
    Returns all user's testimonials (pending, approved, rejected) with rejection reasons if applicable
    
    Responses:
    - 200: List of user's testimonials
    - 401: Unauthorized
    """
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def get_queryset(self):
        """Get all testimonials for the authenticated user for their specified role"""
        user = self.request.user
        role = self.request.query_params.get('role', 'student')
        
        if role not in ['student', 'instructor']:
            role = 'student'
        
        # Get all testimonials (approved, pending, rejected) for this user and role
        return api_models.Review.objects.filter(
            user=user,
            role=role
        ).order_by('-date')
    
    def list(self, request, *args, **kwargs):
        """List user's testimonials with status information"""
        from django.db.models import Q
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # Enhance response with status information
        testimonials_data = []
        for review, data in zip(queryset, serializer.data):
            # [*] FIX 4.15: Differentiate pending vs rejected:
            # - Pending: active=False AND reply is empty/null (fresh submission awaiting admin review)
            # - Rejected: active=False AND reply has content (admin rejected with reason)
            # - Approved: active=True
            if review.active:
                status_val = 'approved'
                rejection_reason = None
                is_rejected = False
            elif review.reply and review.reply.strip():  # Has rejection reason
                status_val = 'rejected'
                rejection_reason = review.reply
                is_rejected = True
            else:  # active=False but reply is empty
                status_val = 'pending'
                rejection_reason = None
                is_rejected = False
            
            testimonial_info = {
                **data,
                'status': status_val,
                'rejection_reason': rejection_reason,
                'is_rejected': is_rejected,
                'can_resubmit': is_rejected  # Allow resubmission only if actually rejected
            }
            testimonials_data.append(testimonial_info)
        
        return Response({
            'count': len(testimonials_data),
            'results': testimonials_data
        }, status=status.HTTP_200_OK)




@method_decorator(csrf_exempt, name='dispatch')
class FileUploadAPIView(APIView):
    """
    File Upload API View (Mengatasi Temuan Pentest T-01)
    
    Security controls:
    1. Whitelist ekstensi ketat: hanya .pdf, .png, .jpg, .jpeg, .mp4.
    2. Tolak mentah-mentah file berbahaya: .html, .svg, .php, .exe, .js, dll.
    3. Validasi Content-Type / MIME Type dan inspeksi Magic Bytes / payload script.
    4. Ganti nama file menjadi acak menggunakan uuid4().hex untuk mencegah path traversal dan tebakan lokasi file.
    """
    permission_classes = [AllowAny]
    authentication_classes = []  # Explicitly disable authentication for this view
    parser_classes = (MultiPartParser, FormParser,)

    ALLOWED_EXTENSIONS = {'.pdf', '.png', '.jpg', '.jpeg', '.mp4'}
    DANGEROUS_EXTENSIONS = {
        '.html', '.htm', '.svg', '.php', '.phtml', '.php3', '.php4', '.php5',
        '.phps', '.phar', '.sh', '.bash', '.exe', '.bat', '.cmd', '.js',
        '.jsx', '.ts', '.tsx', '.py', '.pl', '.cgi', '.asp', '.aspx',
        '.jsp', '.jspx', '.htaccess', '.env', '.config', '.war'
    }
    ALLOWED_MIME_TYPES = {
        '.pdf': ['application/pdf'],
        '.png': ['image/png'],
        '.jpg': ['image/jpeg', 'image/pjpeg'],
        '.jpeg': ['image/jpeg', 'image/pjpeg'],
        '.mp4': ['video/mp4', 'application/mp4', 'video/x-m4v'],
    }

    @swagger_auto_schema(
        operation_description="Upload a file with strict security validation (T-01)",
        request_body=api_serializer.FileUploadSerializer,
        responses={
            200: openapi.Response('File uploaded successfully', openapi.Schema(type=openapi.TYPE_OBJECT)),
            400: openapi.Response('Disallowed or invalid file', openapi.Schema(type=openapi.TYPE_OBJECT)),
        }
    )
    def post(self, request):
        serializer = api_serializer.FileUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        file = serializer.validated_data.get("file")
        if not file:
            return Response({"error": "File tidak ditemukan."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. 🔒 Whitelist & Blacklist extension check (T-01)
        file_extension = os.path.splitext(file.name)[1].lower()
        if file_extension in self.DANGEROUS_EXTENSIONS or file_extension not in self.ALLOWED_EXTENSIONS:
            security_logger.warning(
                f"[FILE UPLOAD REJECTED] Disallowed extension '{file_extension}' for file '{file.name}'"
            )
            return Response(
                {"error": f"Format file '{file_extension}' tidak diizinkan. Hanya file .pdf, .png, .jpg, dan .mp4 yang diperbolehkan."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. 🔒 Content-Type / MIME Type check
        content_type = getattr(file, 'content_type', '').lower()
        if content_type:
            # Block dangerous content types
            if any(danger in content_type for danger in ['html', 'svg', 'php', 'javascript', 'x-sh', 'x-executable']):
                security_logger.warning(
                    f"[FILE UPLOAD REJECTED] Malicious content-type '{content_type}' for file '{file.name}'"
                )
                return Response(
                    {"error": "Tipe konten file tidak diizinkan."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verify content-type matches expected MIME types for the extension
            expected_types = self.ALLOWED_MIME_TYPES.get(file_extension, [])
            if expected_types and not any(exp in content_type for exp in expected_types):
                security_logger.warning(
                    f"[FILE UPLOAD REJECTED] MIME type mismatch '{content_type}' for extension '{file_extension}'"
                )
                return Response(
                    {"error": f"Tipe konten '{content_type}' tidak sesuai dengan ekstensi file '{file_extension}'."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # 3. 🔒 File Header & Script Signature Inspection (Magic Bytes)
        file_header = file.read(2048)
        file.seek(0)  # Reset pointer
        file_header_lower = file_header.lower()

        # Check for web shell / malicious script patterns
        script_signatures = [b'<?php', b'<html', b'<script', b'<svg', b'#!/bin', b'eval(', b'<%']
        if any(sig in file_header_lower for sig in script_signatures):
            security_logger.warning(
                f"[FILE UPLOAD REJECTED] Embedded script signature detected in file '{file.name}'"
            )
            return Response(
                {"error": "File terdeteksi mengandung konten atau skrip yang tidak diizinkan."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate magic bytes for common formats
        if file_extension == '.pdf' and not file_header.startswith(b'%PDF'):
            return Response({"error": "File PDF tidak valid (header rusak atau dimanipulasi)."}, status=status.HTTP_400_BAD_REQUEST)
        elif file_extension == '.png' and not file_header.startswith(b'\x89PNG\r\n\x1a\n'):
            return Response({"error": "File PNG tidak valid (header rusak atau dimanipulasi)."}, status=status.HTTP_400_BAD_REQUEST)
        elif file_extension in ['.jpg', '.jpeg'] and not file_header.startswith(b'\xff\xd8\xff'):
            return Response({"error": "File JPEG tidak valid (header rusak atau dimanipulasi)."}, status=status.HTTP_400_BAD_REQUEST)

        # 4. 🔒 Random File Naming using UUID (T-01)
        # Jangan simpan file dengan nama aslinya untuk mencegah tebakan lokasi file berbahaya
        random_name = f"{uuid.uuid4().hex}{file_extension}"
        upload_type = request.data.get('upload_type', 'course')
        
        if upload_type == 'curriculum':
            unique_filename = f"curriculum-media/{random_name}"
        else:
            unique_filename = f"course-file/{random_name}"

        # 5. 🗑️ Clean up previous file if old_file_url provided by frontend
        old_file_url = request.data.get('old_file_url')
        if old_file_url:
            try:
                old_path = urlparse(old_file_url).path
                if '/media/' in old_path:
                    rel_path = old_path.split('/media/', 1)[1]
                    # Secure check: ensure target is within allowed dirs and no directory traversal
                    if (rel_path.startswith('course-file/') or rel_path.startswith('curriculum-media/')) and '..' not in rel_path:
                        if default_storage.exists(rel_path):
                            default_storage.delete(rel_path)
                            print(f"[FileUploadAPIView] 🗑️ Deleted previous file: {rel_path}")
            except Exception as e:
                print(f"[FileUploadAPIView] ⚠️ Error cleaning up old file: {e}")

        # Save the file to storage with UUID-based name
        file_path = default_storage.save(unique_filename, ContentFile(file.read()))
        file_url = request.build_absolute_uri(default_storage.url(file_path))

        response_data = {
            "url": file_url,
            "file_name": file.name,
            "file_size": file.size,
            "file_type": self.determine_file_type(file_extension)
        }

        # Handle video duration metadata if it is an MP4 video
        if file_extension == '.mp4':
            file_full_path = os.path.join(default_storage.location, file_path)
            try:
                if VideoFileClip:
                    clip = VideoFileClip(file_full_path)
                    duration_seconds = clip.duration
                    clip.close()

                    minutes, remainder = divmod(duration_seconds, 60)
                    minutes = math.floor(minutes)
                    seconds = math.floor(remainder)
                    duration_text = f"{minutes}m {seconds}s"

                    response_data.update({
                        "duration_seconds": duration_seconds,
                        "video_duration": duration_text,
                        "is_video": True
                    })
            except Exception as e:
                print(f"[FileUploadAPIView] Error processing video metadata: {e}")
                response_data["duration_error"] = str(e)

        return Response(response_data, status=status.HTTP_200_OK)

    def determine_file_type(self, file_extension):
        """Determine file type category based on extension"""
        if file_extension == '.mp4':
            return "video"
        elif file_extension == '.pdf':
            return "document"
        elif file_extension in ['.jpg', '.jpeg', '.png']:
            return "image"
        return "other"




# ✨ PHASE 4.101.4: File Cleanup API
# Used when user switches image source without saving draft
# Example: User had uploaded file, now wants to set URL instead → delete old file immediately
@method_decorator(csrf_exempt, name='dispatch')
class FileCleanupAPIView(APIView):
    """
    Delete uploaded files on demand
    
    DELETE /api/v1/file-cleanup/
    Expects: { "file_url": "http://localhost:8001/media/course-file/abc.jpg" }
            OR: { "file_url": "http://localhost:8001/media/curriculum-media/271157-variant-221316-1.mp4" }
    
    GET /api/v1/file-cleanup/ for debugging - shows all course files
    Used when user switches image source (File → URL or URL → File)
    or deletes uploaded curriculum media files
    to ensure only ONE source exists at a time
    ✨ PHASE 4.167: Support both /media/course-file/ and /media/curriculum-media/ deletion
    """
    
    def get(self, request):
        """Debug endpoint to list all files in media/course-file/"""
        import os
        course_file_dir = os.path.join(settings.MEDIA_ROOT, 'course-file')
        
        print(f"\n[FileCleanupAPIView.get] 🔍 DEBUG: Listing all course files")
        print(f"[FileCleanupAPIView.get] Directory: {course_file_dir}")
        
        if not os.path.exists(course_file_dir):
            print(f"[FileCleanupAPIView.get] ❌ Directory doesn't exist!")
            return Response({"error": "course-file directory not found"}, status=400)
        
        files = os.listdir(course_file_dir)
        file_info = []
        for filename in files:
            filepath = os.path.join(course_file_dir, filename)
            size = os.path.getsize(filepath)
            mtime = os.path.getmtime(filepath)
            from datetime import datetime
            mod_time = datetime.fromtimestamp(mtime).isoformat()
            file_info.append({
                "name": filename,
                "size_bytes": size,
                "modified": mod_time
            })
            print(f"[FileCleanupAPIView.get]   - {filename} ({size} bytes)")
        
        return Response({
            "total_files": len(file_info),
            "files": file_info,
            "message": "Use DELETE endpoint with file_url to delete a file"
        }, status=200)
    
    def delete(self, request):
        file_url = request.data.get('file_url')
        
        print(f"\n[FileCleanupAPIView.delete] 🔍 DELETE REQUEST RECEIVED")
        print(f"[FileCleanupAPIView.delete] file_url parameter: {repr(file_url)}")
        print(f"[FileCleanupAPIView.delete] request.data: {request.data}")
        
        if not file_url:
            print(f"[FileCleanupAPIView.delete] ❌ ERROR: file_url is required")
            return Response(
                {"error": "file_url is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # ✨ PHASE 4.167: Allow deletion of local /media/course-file/ AND /media/curriculum-media/ files
        # Don't allow external URLs (Google Drive, etc.)
        is_local = (
            '/media/course-file/' in file_url or 'media/course-file/' in file_url or
            '/media/curriculum-media/' in file_url or 'media/curriculum-media/' in file_url
        )
        print(f"[FileCleanupAPIView.delete] is_local file: {is_local}")
        print(f"[FileCleanupAPIView.delete] Checking '/media/course-file/': {'/media/course-file/' in file_url}")
        print(f"[FileCleanupAPIView.delete] Checking 'media/course-file/': {'media/course-file/' in file_url}")
        print(f"[FileCleanupAPIView.delete] Checking '/media/curriculum-media/': {'/media/curriculum-media/' in file_url}")
        print(f"[FileCleanupAPIView.delete] Checking 'media/curriculum-media/': {'media/curriculum-media/' in file_url}")
        
        if not is_local:
            print(f"[FileCleanupAPIView.delete] ⏭️  SKIPPED: External URL (not local file): {file_url}")
            return Response(
                {"message": "External URLs not deleted"}, 
                status=status.HTTP_200_OK
            )
        
        try:
            print(f"[FileCleanupAPIView.delete] 🗑️  Attempting to delete file...")
            print(f"[FileCleanupAPIView.delete] delete_orphaned_file('{file_url}')")
            delete_orphaned_file(file_url)
            print(f"[FileCleanupAPIView.delete] ✅ Successfully deleted: {file_url}")
            return Response(
                {"message": "File deleted successfully"}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            print(f"[FileCleanupAPIView.delete] ❌ Error deleting file: {str(e)}")
            import traceback
            traceback.print_exc()
            # Return success anyway (file might not exist)
            return Response(
                {"message": "Deletion request processed"}, 
                status=status.HTTP_200_OK
            )




# ========== REACT SPA CATCH-ALL VIEW ==========

class ReactSPACatchAllView(APIView):
    """
    Catch-all view for React SPA routes.
    Serves the React app for certificate validation and other frontend routes.
    In production with nginx, this is not used (nginx handles routing).
    In development without Docker, this enables React Router to handle client-side routes.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get(self, request, *args, **kwargs):
        """
        Serve React app for all non-API routes.
        This enables certificate validation page at /certificate/validate/{token}/
        """
        try:
            # In development: return a redirect to frontend dev server if not in Docker
            # In production with Docker: nginx handles this, so this view won't be reached
            if settings.DEBUG:
                # Get the current host to determine which frontend to redirect to
                host = request.get_host()
                path = request.path
                
                # If localhost or 127.0.0.1, redirect to local React dev server (Vite runs on 5174)
                if 'localhost' in host or '127.0.0.1' in host:
                    frontend_url = 'http://localhost:5174'
                else:
                    # For other hosts (remote development), use FRONTEND_SITE_URL
                    frontend_url = settings.FRONTEND_SITE_URL
                
                # Redirect to frontend with the path
                return redirect(f"{frontend_url}{path}")
            else:
                # Fallback: return 404
                return Response(
                    {'error': 'Frontend not configured'},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            return Response(
                {'error': f'Error serving React app: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )




class ActivityFilterPreferencesAPIView(APIView):
    """
    PHASE 53: Get/update user's activity filter preferences
    
    GET /api/v1/student/activity-filter/
    - Get current user's activity filter preferences
    
    PUT /api/v1/student/activity-filter/
    - Update activity filter preferences
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get user's activity filter preferences"""
        try:
            activity_filter = api_models.ActivityFilter.objects.get(user=request.user)
            serializer = api_serializer.ActivityFilterSerializer(activity_filter)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except api_models.ActivityFilter.DoesNotExist:
            # Create default if doesn't exist
            activity_filter = api_models.ActivityFilter.objects.create(
                user=request.user,
                activity_types=[],
                include_system_activities=True,
                include_failed_activities=False,
                max_activities_display=10,
                sort_by='date'
            )
            serializer = api_serializer.ActivityFilterSerializer(activity_filter)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def put(self, request):
        """Update user's activity filter preferences"""
        try:
            activity_filter = api_models.ActivityFilter.objects.get(user=request.user)
        except api_models.ActivityFilter.DoesNotExist:
            activity_filter = api_models.ActivityFilter.objects.create(user=request.user)
        
        serializer = api_serializer.ActivityFilterSerializer(
            activity_filter, data=request.data, partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)  




# ==================== FEEDBACK API VIEWS ====================
# ✨ PHASE 11.1: User Feedback System Views

class FeedbackCreateAPIView(generics.CreateAPIView):
    """
    ✨ PHASE 11.1: Create feedback (user submission)
    POST /api/v1/feedback/create/ - Create new feedback
    """
    serializer_class = api_serializer.FeedbackCreateSerializer
    permission_classes = [IsAuthenticated]
    
    def perform_create(self, serializer):
        """Automatically set the current user as the feedback author"""
        serializer.save(user=self.request.user)




class FeedbackListAPIView(generics.ListAPIView):
    """
    ✨ PHASE 11.1: List feedback (admin dashboard)
    GET /api/v1/feedback/list/ - List all feedback with optional filtering
    """
    serializer_class = api_serializer.FeedbackListSerializer
    permission_classes = [IsAdminUser]
    pagination_class = None  # No pagination for admin dashboard
    
    def get_queryset(self):
        """Filter feedback by status, type, priority, affected_area, and search"""
        queryset = api_models.Feedback.objects.all().order_by('-created_at')
        
        # Filter by status
        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        # Filter by feedback type
        feedback_type = self.request.query_params.get('type', None)
        if feedback_type:
            queryset = queryset.filter(feedback_type=feedback_type)
        
        # Filter by priority
        priority = self.request.query_params.get('priority', None)
        if priority:
            queryset = queryset.filter(priority=priority)
        
        # Filter by affected area
        affected_area = self.request.query_params.get('affected_area', None)
        if affected_area:
            queryset = queryset.filter(affected_area=affected_area)
        
        # Search in title and description
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )
        
        return queryset




class FeedbackDetailAPIView(generics.RetrieveUpdateAPIView):
    """
    ✨ PHASE 11.1: Feedback detail view/editing (admin only)
    GET /api/v1/feedback/detail/<id>/ - Get feedback detail
    PUT /api/v1/feedback/detail/<id>/ - Update feedback status/priority/notes
    """
    queryset = api_models.Feedback.objects.all()
    serializer_class = api_serializer.FeedbackDetailSerializer
    permission_classes = [IsAdminUser]
    lookup_field = 'pk'
    
    def get_serializer_class(self):
        """Use different serializers for GET vs PUT"""
        if self.request.method in ['PUT', 'PATCH']:
            return api_serializer.FeedbackUpdateSerializer
        return api_serializer.FeedbackDetailSerializer




class FeedbackStatsAPIView(APIView):
    """
    ✨ PHASE 11.1: Get feedback statistics (admin dashboard)
    GET /api/v1/feedback/stats/ - Get feedback statistics
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request, *args, **kwargs):
        """Get feedback statistics"""
        try:
            # Count total feedback
            total_feedback = api_models.Feedback.objects.count()
            
            # Count by status
            open_count = api_models.Feedback.objects.filter(status='open').count()
            in_progress_count = api_models.Feedback.objects.filter(status='in_progress').count()
            resolved_count = api_models.Feedback.objects.filter(status='resolved').count()
            
            # Count by type
            bug_reports = api_models.Feedback.objects.filter(feedback_type='bug').count()
            feature_requests = api_models.Feedback.objects.filter(feedback_type='feature').count()
            
            # Count by priority
            critical_priority = api_models.Feedback.objects.filter(priority='critical').count()
            high_priority = api_models.Feedback.objects.filter(priority='high').count()
            
            # Calculate average resolution time (days)
            resolved_feedbacks = api_models.Feedback.objects.filter(
                status='resolved',
                resolved_at__isnull=False
            )
            
            avg_resolution_time_days = None
            if resolved_feedbacks.exists():
                total_days = sum([
                    (f.resolved_at - f.created_at).days 
                    for f in resolved_feedbacks
                ])
                avg_resolution_time_days = total_days / resolved_feedbacks.count()
            
            stats_data = {
                'total_feedback': total_feedback,
                'open_count': open_count,
                'in_progress_count': in_progress_count,
                'resolved_count': resolved_count,
                'bug_reports': bug_reports,
                'feature_requests': feature_requests,
                'critical_priority': critical_priority,
                'high_priority': high_priority,
                'avg_resolution_time_days': avg_resolution_time_days,
            }
            
            serializer = api_serializer.FeedbackStatsSerializer(stats_data)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class FeedbackMarkResolvedAPIView(generics.UpdateAPIView):
    """
    ✨ PHASE 11.1: Mark feedback as resolved
    POST /api/v1/feedback/mark-resolved/<id>/ - Mark feedback as resolved
    """
    queryset = api_models.Feedback.objects.all()
    serializer_class = api_serializer.FeedbackUpdateSerializer
    permission_classes = [IsAdminUser]
    lookup_field = 'pk'
    
    def update(self, request, *args, **kwargs):
        """Mark feedback as resolved with optional notes"""
        feedback = self.get_object()
        
        # Update status to resolved
        feedback.status = 'resolved'
        feedback.resolved_at = timezone.now()
        
        # Update admin notes if provided
        if 'admin_notes' in request.data:
            feedback.admin_notes = request.data['admin_notes']
        
        feedback.save()
        
        serializer = self.get_serializer(feedback)
        return Response(serializer.data, status=status.HTTP_200_OK)




class FeedbackMarkInProgressAPIView(generics.UpdateAPIView):
    """
    ✨ PHASE 11.1: Mark feedback as in progress
    POST /api/v1/feedback/mark-in-progress/<id>/ - Mark feedback as in progress
    """
    queryset = api_models.Feedback.objects.all()
    serializer_class = api_serializer.FeedbackUpdateSerializer
    permission_classes = [IsAdminUser]
    lookup_field = 'pk'
    
    def update(self, request, *args, **kwargs):
        """Mark feedback as in progress"""
        feedback = self.get_object()
        
        # Update status to in_progress
        feedback.status = 'in_progress'
        
        # Update admin notes if provided
        if 'admin_notes' in request.data:
            feedback.admin_notes = request.data['admin_notes']
        
        # Assign to admin if provided
        if 'assigned_to' in request.data:
            feedback.assigned_to_id = request.data['assigned_to']
        
        feedback.save()
        
        serializer = self.get_serializer(feedback)
        return Response(serializer.data, status=status.HTTP_200_OK)




class FeedbackMyFeedbackAPIView(generics.ListAPIView):
    """
    ✨ PHASE 11.1: Get user's own feedback submissions
    GET /api/v1/feedback/my-feedback/ - List feedback submitted by current user
    """
    serializer_class = api_serializer.FeedbackDetailSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    
    def get_queryset(self):
        """Return only feedback submitted by current user"""
        return api_models.Feedback.objects.filter(user=self.request.user).order_by('-created_at')


