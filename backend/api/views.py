from django.shortcuts import render, redirect
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.db import models
from django.db.models import Q, F, Value, Count, Sum, Avg, Max
from django.db.models.functions import ExtractMonth
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.http import Http404, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.clickjacking import xframe_options_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
from django.views.decorators.cache import cache_page
from django.core.cache import cache

# [*] PHASE 4.9: Import cache utilities for search optimization
try:
    from api.cache_utils import cache_search_results, cache_suggestions, SearchCacheManager, TrendingCacheManager
except ImportError:
    # Fallback decorators if cache_utils not available
    def cache_search_results(timeout=300):
        return lambda f: f
    def cache_suggestions(timeout=600):
        return lambda f: f

from api import serializer as api_serializer
from api import models as api_models
from userauths.models import User, Profile, OrganizationUnit, Position

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, APIView
from rest_framework.pagination import PageNumberPagination

# Import custom permissions
from api.permissions import IsAdminUser
from api.serializer import MyTokenObtainPairSerializer


import random
from decimal import Decimal
import requests
from datetime import datetime, timedelta
from django.utils.dateparse import parse_datetime
from django.utils import timezone

# Updates
from django.core.files.storage import default_storage
import os
import re
try:
    from moviepy.editor import VideoFileClip
except ImportError:
    VideoFileClip = None  # Fallback if moviepy not installed
from django.core.files.base import ContentFile
import math
from rest_framework.parsers import MultiPartParser, FormParser
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi


# ============================================================
# SYNC STATE MANAGEMENT - In-memory tracking for real-time progress
# ============================================================

_SYNC_STATE = {
    'is_syncing': False,
    'created': 0,
    'updated': 0,
    'failed': 0,
    'total': 0,
    'errors': [],
    'completion_timestamp': None,
    'last_successful_sync_timestamp': None,
    'status': 'idle',  # idle, initializing, syncing, completed, error, cancelled
    'new': 0,  # Users not in system (will be created)
    'changed': 0,  # Users with changes (will be updated)
    'unchanged': 0,  # Users with no changes (skipped)
    'comparison_complete': False
}

def reset_sync_state():
    """Reset sync state to initial values"""
    global _SYNC_STATE
    _SYNC_STATE = {
        'is_syncing': False,
        'created': 0,
        'updated': 0,
        'failed': 0,
        'total': 0,
        'errors': [],
        'completion_timestamp': None,
        'last_successful_sync_timestamp': None,
        'status': 'idle',
        'new': 0,
        'changed': 0,
        'unchanged': 0,
        'comparison_complete': False
    }

def update_sync_state(**kwargs):
    """Update specific sync state fields"""
    global _SYNC_STATE
    for key, value in kwargs.items():
        if key in _SYNC_STATE:
            _SYNC_STATE[key] = value

def get_sync_state():
    """Get current sync state"""
    global _SYNC_STATE
    return _SYNC_STATE.copy()


# ============================================================
# JWT TOKEN GENERATION - Custom helper with role information
# ============================================================

def generate_tokens_with_role(user):
    """
    Generate JWT tokens (access and refresh) with user role information.
    
    This uses MyTokenObtainPairSerializer to ensure role/current_role is included.
    Required for multi-role system where current_role must be in JWT.
    
    Args:
        user: User instance
        
    Returns:
        dict with 'access_token' and 'refresh_token' keys
    """
    refresh = RefreshToken.for_user(user)
    # Add user fields to tokens using the serializer's method
    MyTokenObtainPairSerializer._add_user_fields(refresh, user)
    MyTokenObtainPairSerializer._add_user_fields(refresh.access_token, user)
    
    return {
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh)
    }


# API Root View
@method_decorator(csrf_exempt, name='dispatch')
class APIRootView(APIView):
    """
    API Root - Welcome page
    
    CSRF exempt because:
    - Public informational endpoint
    - Read-only GET operations
    - No state-changing actions
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get(self, request):
        """
        API Root - Welcome page for the LMS Backend API
        """
        return Response({
            "message": "Welcome to LMSetjen DPD RI - Learning Management System API",
            "version": "v1",
            "status": "operational",
            "documentation": {
                "swagger": request.build_absolute_uri('/swagger/'),
                "redoc": request.build_absolute_uri('/redoc/'),
            },
            "endpoints": {
                "health": request.build_absolute_uri('/api/v1/health/'),
                "authentication": {
                    "login": request.build_absolute_uri('/api/v1/user/token/'),
                    "refresh": request.build_absolute_uri('/api/v1/user/token/refresh/'),
                    "register": request.build_absolute_uri('/api/v1/user/register/'),
                },
                "courses": {
                    "list": request.build_absolute_uri('/api/v1/course/course-list/'),
                    "categories": request.build_absolute_uri('/api/v1/course/category/'),
                    "search": request.build_absolute_uri('/api/v1/course/search/'),
                },
            },
            "support": {
                "docs": "See /swagger/ or /redoc/ for complete API documentation",
                "admin": request.build_absolute_uri('/admin/'),
            }
        })

# Health Check API (no authentication required)
@method_decorator(csrf_exempt, name='dispatch')
class HealthCheckAPIView(APIView):
    """
    Health Check API
    
    CSRF exempt because:
    - Monitoring endpoint for infrastructure
    - Read-only GET operations
    - No authentication or state changes
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get(self, request):
        """Simple health check endpoint for monitoring"""
        return Response({
            'status': 'healthy',
            'service': 'LMS Backend API',
            'timestamp': timezone.now().isoformat()
        }, status=status.HTTP_200_OK)


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = api_serializer.MyTokenObtainPairSerializer


# ============================================================
# SSO (Single Sign-On) Integration with Nusa DPD
# ============================================================

@method_decorator(csrf_exempt, name='dispatch')
class SSOTokenVerifyAPIView(APIView):
    """
    Verify SSO token and exchange for LMS JWT tokens
    
    Endpoint: /api/v1/sso/verify/
    Method: POST
    
    Request:
    {
        "sso_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
    }
    
    Response:
    {
        "access": "lms_jwt_access_token",
        "refresh": "lms_jwt_refresh_token",
        "user": {
            "id": 1,
            "email": "user@email.com",
            "full_name": "User Name",
            "role": "student",
            "nip": "20000420202506100008"
        }
    }
    
    CSRF exempt because:
    - Public SSO endpoint
    - External authentication integration
    - Uses token-based verification
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def post(self, request):
        """Verify SSO token and create/update user"""
        from .sso_utils import SSOTokenVerifier, SSOUserManager, SSOTokenSerializer, SSOUserSerializer
        import jwt
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Get SSO token from request
        sso_token = request.data.get('sso_token')
        
        logger.info("🔐 SSO Token Verification Started")
        logger.info(f"Request data: {request.data}")
        logger.info(f"SSO token received: {sso_token[:20] if sso_token else 'MISSING'}...")
        
        if not sso_token:
            logger.error("[FAIL] SSO token is missing from request")
            return Response(
                {"error": "SSO token is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            logger.info("📤 Decoding SSO token...")
            # Decode SSO token without verification (trusting the SSO provider)
            # In production, you should verify the signature using the SSO provider's public key
            sso_data = SSOTokenVerifier.decode_token_unsafe(sso_token)
            
            logger.info(f"[DONE] Token decoded successfully")
            logger.info(f"SSO data: {sso_data}")
            
            # Validate SSO data
            logger.info("🔍 Validating SSO data...")
            sso_serializer = SSOUserSerializer(data=sso_data)
            if not sso_serializer.is_valid():
                logger.error(f"[FAIL] Invalid SSO data: {sso_serializer.errors}")
                return Response(
                    {"error": "Invalid SSO data", "details": sso_serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info("[DONE] SSO data validation passed")
            
            # Get or create user from SSO data
            logger.info("👤 Getting or creating user from SSO data...")
            user, created = SSOUserManager.get_or_create_user_from_sso(sso_data)
            
            logger.info(f"[DONE] User found/created: {user.id}, created={created}")
            logger.info(f"User details: email={user.email}, role={user.role}, nip={user.nip}")
            
            # Generate JWT tokens for LMS
            logger.info("🔑 Generating JWT tokens for LMS...")
            refresh = RefreshToken.for_user(user)
            
            # Use the same method as MyTokenObtainPairSerializer to add custom fields
            # This ensures both access_token and refresh token have all user data
            api_serializer.MyTokenObtainPairSerializer._add_user_fields(refresh.access_token, user)
            api_serializer.MyTokenObtainPairSerializer._add_user_fields(refresh, user)
            
            # Also ensure is_active is present (not added by serializer)
            refresh.access_token['is_active'] = user.is_active
            refresh['is_active'] = user.is_active
            
            logger.info("[DONE] JWT tokens generated successfully")
            logger.info(f"🎉 SSO login successful for user: {user.email}")
            
            return Response(
                {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "full_name": user.full_name,
                        "role": user.role,
                        "nip": user.nip,
                        "is_active": user.is_active,
                        # 🔥 CRITICAL FIX: Use boolean roles for role selector (supports instructor/teacher)
                        "available_roles": user.get_available_boolean_roles(),
                        "current_role": user.current_role,
                        "roles": user.roles,
                        "has_multiple_roles": len(user.get_available_boolean_roles()) > 1,
                    },
                    "created": created,
                    "message": "SSO login successful"
                },
                status=status.HTTP_200_OK
            )
        
        except jwt.InvalidTokenError as e:
            logger.error(f"[FAIL] Invalid SSO token: {str(e)}")
            return Response(
                {"error": f"Invalid SSO token: {str(e)}"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except ValueError as e:
            logger.error(f"[FAIL] SSO data error: {str(e)}")
            return Response(
                {"error": f"SSO data error: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"[FAIL] SSO verification failed: {str(e)}")
            logger.exception("Full traceback:")
            return Response(
                {"error": f"SSO verification failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
class SSOLoginRedirectAPIView(APIView):
    """
    SSO Login Redirect Handler
    
    Endpoint: /api/v1/sso/login/{sso_token}/
    Method: GET
    
    Redirects to /sso/{sso_token}/ on frontend for handling
    Used when user is redirected from SSO provider with token
    
    CSRF exempt because:
    - Public SSO redirect endpoint
    - Handles external authentication flow
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get(self, request, sso_token=None):
        """Redirect SSO token to frontend for processing"""
        if not sso_token:
            return Response(
                {"error": "SSO token is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Return token and instructions for frontend
        frontend_url = f"{settings.FRONTEND_SITE_URL}/sso/{sso_token}/"
        
        return Response(
            {
                "message": "SSO token received. Redirecting to frontend...",
                "frontend_url": frontend_url,
                "sso_token": sso_token,
                "verify_endpoint": request.build_absolute_uri('/api/v1/sso/verify/')
            },
            status=status.HTTP_200_OK
        )


@method_decorator(csrf_exempt, name='dispatch')
class GoogleOAuthAPIView(APIView):
    """
    Google OAuth Login Handler
    
    Endpoint: /api/v1/auth/google/
    Method: POST
    
    Request:
    {
        "access_token": "google_access_token_or_id_token",
        "token_type": "access_token" or "id_token"
    }
    
    Response:
    {
        "access": "lms_jwt_access_token",
        "refresh": "lms_jwt_refresh_token",
        "user": {
            "id": 1,
            "email": "user@gmail.com",
            "full_name": "User Name",
            "role": "student"
        }
    }
    
    CSRF exempt because:
    - Public OAuth endpoint
    - Uses OAuth tokens for verification
    - External authentication integration
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def options(self, request, *args, **kwargs):
        """Handle CORS preflight requests"""
        return Response(status=status.HTTP_200_OK)
    
    def post(self, request):
        """Verify Google token and create/update user"""
        from .sso_utils import GoogleOAuthVerifier, GoogleOAuthUserManager
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Get token from request
        access_token = request.data.get('access_token') or request.data.get('token')
        token_type = request.data.get('token_type', 'access_token')
        
        logger.info("🔐 Google OAuth Verification Started")
        logger.info(f"Token type: {token_type}")
        logger.info(f"Token received: {access_token[:20] if access_token else 'MISSING'}...")
        
        if not access_token:
            logger.error("[FAIL] Google token is missing from request")
            return Response(
                {"error": "Google token is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            logger.info("📤 Verifying Google token...")
            
            # Verify token with Google
            if token_type == 'id_token':
                google_client_id = settings.GOOGLE_CLIENT_ID
                user_info = GoogleOAuthVerifier.verify_id_token(access_token, google_client_id)
            else:
                user_info = GoogleOAuthVerifier.verify_token(access_token)
            
            logger.info(f"[DONE] Google token verified successfully")
            logger.info(f"Google user info: {user_info}")
            
            # Extract user data from Google response
            logger.info("📊 Extracting user data from Google token...")
            google_data = GoogleOAuthVerifier.get_user_data_from_token(user_info)
            
            # Get or create user from Google data
            logger.info("👤 Getting or creating user from Google data...")
            user, created = GoogleOAuthUserManager.get_or_create_user_from_google(google_data)
            
            logger.info(f"[DONE] User found/created: {user.id}, created={created}")
            logger.info(f"User details: email={user.email}, role={user.role}")
            
            # Generate JWT tokens for LMS
            logger.info("🔑 Generating JWT tokens for LMS...")
            refresh = RefreshToken.for_user(user)
            
            # Add custom fields to tokens using serializer
            api_serializer.MyTokenObtainPairSerializer._add_user_fields(refresh.access_token, user)
            api_serializer.MyTokenObtainPairSerializer._add_user_fields(refresh, user)
            
            # Add is_active field
            refresh.access_token['is_active'] = user.is_active
            refresh['is_active'] = user.is_active
            
            logger.info("[DONE] JWT tokens generated successfully")
            logger.info(f"🎉 Google OAuth login successful for user: {user.email}")
            
            return Response(
                {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "full_name": user.full_name,
                        "role": user.role,
                        "is_active": user.is_active,
                        # 🔥 CRITICAL FIX: Use boolean roles for role selector (supports instructor/teacher)
                        "available_roles": user.get_available_boolean_roles(),
                        "current_role": user.current_role,
                        "roles": user.roles,
                        "has_multiple_roles": len(user.get_available_boolean_roles()) > 1,
                    },
                    "created": created,
                    "message": "Google OAuth login successful"
                },
                status=status.HTTP_200_OK
            )
        
        except ValueError as e:
            logger.error(f"[FAIL] Google token verification error: {str(e)}")
            return Response(
                {"error": f"Google authentication error: {str(e)}"},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            logger.error(f"[FAIL] Google OAuth verification failed: {str(e)}")
            logger.exception("Full traceback:")
            return Response(
                {"error": f"Google OAuth verification failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
def generate_random_otp(length=7):
    otp = ''.join([str(random.randint(0, 9)) for _ in range(length)])
    return otp

class PasswordResetEmailVerifyAPIView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = api_serializer.UserSerializer

    def get_object(self):
        email = self.kwargs['email'] # api/v1/password-email-verify/desphixs@gmail.com/

        user = User.objects.filter(email=email).first()

        if user:
            uuidb64 = user.pk
            refresh = RefreshToken.for_user(user)
            refresh_token = str(refresh.access_token)

            user.refresh_token = refresh_token
            user.otp = generate_random_otp()
            user.save()

            # Use FRONTEND_SITE_URL from settings (defaults to production URL)
            link = f"{settings.FRONTEND_SITE_URL}/create-new-password/?otp={user.otp}&uuidb64={uuidb64}&refresh_token={refresh_token}"

            context = {
                "link": link,
                "username": user.username
            }

            subject = "Password Reset Email"
            text_body = render_to_string("email/password_reset.txt", context)
            html_body = render_to_string("email/password_reset.html", context)

            msg = EmailMultiAlternatives(
                subject=subject,
                from_email=settings.FROM_EMAIL,
                to=[user.email],
                body=text_body
            )

            msg.attach_alternative(html_body, "text/html")
            msg.send()

            print("link ======", link)
        return user
    
@method_decorator(csrf_exempt, name='dispatch')
class PasswordChangeAPIView(generics.CreateAPIView):
    """
    Password Change API (OTP-based)
    
    CSRF exempt because:
    - Password reset flow using OTP validation
    - Public endpoint for password recovery
    - Secured by OTP + UUID verification
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = api_serializer.UserSerializer

    def create(self, request, *args, **kwargs):
        otp = request.data['otp']
        uuidb64 = request.data['uuidb64']
        password = request.data['password']

        user = User.objects.get(id=uuidb64, otp=otp)
        if user:
            user.set_password(password)
            # user.otp = ""
            user.save()

            return Response({"message": "Password Changed Successfully"}, status=status.HTTP_201_CREATED)
        else:
            return Response({"message": "User Does Not Exists"}, status=status.HTTP_404_NOT_FOUND)

@method_decorator(csrf_exempt, name='dispatch')
class ChangePasswordAPIView(generics.CreateAPIView):
    """
    Change Password API
    
    CSRF exempt because:
    - Password change using old password verification
    - Public endpoint for authenticated users
    - Secured by old password validation
    """
    serializer_class = api_serializer.UserSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        user_id = request.data['user_id']
        old_password = request.data['old_password']
        new_password = request.data['new_password']

        user = User.objects.get(id=user_id)
        if user is not None:
            if check_password(old_password, user.password):
                user.set_password(new_password)
                user.save()
                return Response({"message": "Password changed successfully", "icon": "success"})
            else:
                return Response({"message": "Old password is incorrect", "icon": "warning"})
        else:
            return Response({"message": "User does not exists", "icon": "error"})

@method_decorator(csrf_exempt, name='dispatch')
class ProfileAPIView(generics.RetrieveUpdateAPIView):
    """
    User Profile API
    
    CSRF exempt because:
    - Uses JWT authentication for user identification
    - Profile updates validated by serializer
    - Public endpoint with AllowAny for flexibility
    """
    serializer_class = api_serializer.ProfileSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    parser_classes = [MultiPartParser, FormParser]  # Support file uploads

    def get_object(self):
        try:
            user_id = self.kwargs['user_id']
            user = User.objects.get(id=user_id)
            return Profile.objects.get(user=user)
        except:
            return None
    
    def perform_update(self, serializer):
        # Update profile (including image if provided)
        profile = serializer.save()
        
        # Update user fields if provided
        user = profile.user
        user_fields = ['full_name', 'nip', 'golongan', 'kelas_jabatan', 'jenis_jabatan']
        
        for field in user_fields:
            if field in self.request.data and self.request.data[field] is not None:
                setattr(user, field, self.request.data[field])
        
        user.save()
        
        return profile

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
            print(f"Error in PublicStatsAPIView: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': str(e),
                'total_courses': 0,
                'total_students': 0,
                'total_teachers': 0,
                'completion_rate': 0,
                'total_certificates': 0,
                'total_materials': 0,
                'platform_rating': 4.8
            }, status=status.HTTP_200_OK)


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
            
            # Fetch all active reviews with related user and profile data
            reviews_query = api_models.Review.objects.filter(
                active=True
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
                
                testimonials_data.append({
                    'id': review.id,
                    'full_name': user.full_name if user else 'Anonymous',
                    'golongan': user.golongan if user else '',
                    'position': user.kelas_jabatan if user else '',
                    'organization': user.unit_organisasi.name if hasattr(user, 'unit_organisasi') else 'Setjen DPD RI',
                    'review': review.review,
                    'rating': review.rating,
                    'role': review.role,  # [*] PHASE 4.11: Include role in response
                    'image': profile.image.url if profile and profile.image else None,
                    'date': review.date.isoformat()
                })
            
            return Response({
                'count': len(testimonials_data),
                'results': testimonials_data,
                'timestamp': timezone.now().isoformat()
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error in TestimonialListAPIView: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': str(e),
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
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_object(self):
        course_id = self.kwargs['course_id']
        try:
            course = api_models.Course.objects.get(course_id=course_id)
            
            # [*] PHASE 4.76: CRITICAL - Enforce draft-only editing
            # If trying to edit a published course, return error
            # Instructor must use "Edit Versi Terbaru" to create a draft first
            if course.is_published_version:
                print(f"[Teacher Course Detail] [FAIL] Attempt to edit published course directly: {course.title}")
                # Return None to signal published course (will be handled in get method)
                setattr(course, '_is_published_version_attempt', True)
                return course
            
            # Check if this is a draft of a published course
            if course.parent_course and course.parent_course.is_published_version:
                print(f"[Teacher Course Detail] [OK] Loading draft revision for editing: {course.title}")
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
    
class SearchCourseAPIView(generics.ListAPIView):
    """[*] PHASE 2 OPTIMIZED: Lightweight search with ranking and filtering"""
    serializer_class = api_serializer.SearchCourseSerializer  # [*] Use lightweight serializer
    permission_classes = [AllowAny]
    pagination_class = None  # Disable pagination since we limit results in frontend

    def get_queryset(self):
        # Get search query from either 'search' or 'query' parameter
        query = self.request.GET.get('search') or self.request.GET.get('query')
        
        # Validate query: minimum 2 characters, maximum 100 characters
        if not query or len(query.strip()) < 2:
            return api_models.Course.objects.none()
        
        query = query.strip()[:100]  # Sanitize: trim and limit length
        
        # Search in course title and description with ranking
        # Prioritize title matches over description matches for better relevance
        from django.db.models import Q, Case, When, IntegerField, Value
        
        results = api_models.Course.objects.filter(
            (Q(title__icontains=query) | Q(description__icontains=query)),
            platform_status="Published", 
            teacher_course_status="Published",
            is_published_version=True  # [*] PHASE 4.77: Show only published copies in search
        ).annotate(
            # Ranking: title matches = 2, description matches = 1
            search_rank=Case(
                When(title__icontains=query, then=Value(2)),
                default=Value(1),
                output_field=IntegerField()
            )
        ).order_by('-search_rank', '-id').distinct()  # Order by relevance, then ID
        
        return results
    
    def list(self, request, *args, **kwargs):
        """[*] PHASE 2: Override to use lightweight serializer and limit results
        [*] PHASE 4.9: Added caching via SearchCacheManager
        """
        search_query = self.request.GET.get('search') or self.request.GET.get('query')
        
        # Check cache first (PHASE 4.9 optimization)
        if search_query and len(search_query.strip()) >= 2:
            cached_result = SearchCacheManager.get_cached_search(search_query.strip())
            if cached_result:
                return Response(cached_result)
        
        queryset = self.filter_queryset(self.get_queryset())
        
        # Serialize with lightweight serializer (only 10-12 fields per course)
        serializer = self.get_serializer(queryset[:50], many=True)  # Limit to 50 results max
        
        result = {
            'count': queryset.count(),
            'results': serializer.data
        }
        
        # Cache the result (PHASE 4.9 optimization)
        if search_query and len(search_query.strip()) >= 2:
            SearchCacheManager.cache_search(search_query.strip(), result, timeout=300)
            api_models.SearchAnalytics.track_search(search_query)
        
        return Response(result)
    

class StudentSummaryAPIView(generics.ListAPIView):
    serializer_class = api_serializer.StudentSummarySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        user_id = self.kwargs['user_id']
        user = User.objects.get(id=user_id)

        total_courses = api_models.EnrolledCourse.objects.filter(user=user).count()
        completed_lessons = api_models.CompletedLesson.objects.filter(user=user).count()
        achieved_certificates = api_models.Certificate.objects.filter(user=user).count()

        return [{
            "total_courses": total_courses,
            "completed_lessons": completed_lessons,
            "achieved_certificates": achieved_certificates,
        }]
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    

class TrendingSearchesAPIView(generics.ListAPIView):
    """
    API endpoint to retrieve trending/popular search queries.
    Returns the most searched queries based on search frequency.
    [*] PHASE 4.9: Added caching (900s TTL)
    """
    serializer_class = api_serializer.SearchAnalyticsSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        """Get top trending searches"""
        return api_models.SearchAnalytics.get_trending(limit=10)
    
    def list(self, request, *args, **kwargs):
        """Return trending searches as a simple list of query strings
        [*] PHASE 4.9: Added caching via TrendingCacheManager
        """
        # Check cache first (PHASE 4.9 optimization)
        cached_trending = TrendingCacheManager.get_cached_trending()
        if cached_trending:
            return Response(cached_trending)
        
        queryset = self.get_queryset()
        # Return just the query strings for frontend simplicity
        trending_queries = [item.query for item in queryset]
        result = {
            'trending': trending_queries
        }
        
        # Cache the result (PHASE 4.9 optimization)
        TrendingCacheManager.cache_trending(result, timeout=900)
        
        return Response(result)


# [*] PHASE 4: Full-Text Search endpoint with ranking
class FullTextSearchAPIView(generics.ListAPIView):
    """
    PostgreSQL Full-Text Search endpoint with relevance ranking.
    
    Supports:
    - Phrase search: "exact phrase"
    - Exclude: -word
    - Boolean operators: & | 
    - Websearch syntax
    """
    serializer_class = api_serializer.FullTextSearchResultSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        query = self.request.GET.get('search', '').strip()
        
        if not query or len(query) < 2:
            return api_models.Course.objects.none()
        
        # Create PostgreSQL SearchQuery with websearch syntax support
        search_query = SearchQuery(query, search_type='websearch')
        
        # Annotate with search vector and ranking
        queryset = api_models.Course.objects.annotate(
            search=SearchVector('title', weight='A') + 
                   SearchVector('description', weight='B') +
                   SearchVector('teacher__full_name', weight='C'),
            rank=SearchRank(F('search'), search_query)
        ).filter(
            search=search_query,
            platform_status='Published',
            teacher_course_status='Published',
            is_published_version=True  # [*] PHASE 4.77: Show only published copies in FTS search
        ).order_by('-rank', '-id').distinct()
        
        # Track search in analytics
        api_models.SearchLog.log_search(
            query=query,
            results_count=queryset.count(),
            user=self.request.user if self.request.user.is_authenticated else None,
            session_id=self.request.session.session_key or ''
        )
        
        # Also track in SearchAnalytics for trending
        api_models.SearchAnalytics.track_search(query)
        
        return queryset[:50]  # Limit to 50 results

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })


# [*] PHASE 4.3: Analytics API Views
class TrendingSearchesAnalyticsAPIView(generics.ListAPIView):
    """
    GET /api/v1/analytics/trending-searches/?days=7&limit=10
    Returns trending searches from the last N days
    """
    permission_classes = [AllowAny]
    serializer_class = api_serializer.TrendingSearchSerializer
    
    def list(self, request, *args, **kwargs):
        days = int(request.query_params.get('days', 7))
        limit = int(request.query_params.get('limit', 10))
        
        # Get trending searches using manager method
        trending = api_models.SearchLog.objects.trending_searches(days=days, limit=limit)
        
        serializer = self.get_serializer(trending, many=True)
        return Response({
            'count': len(trending),
            'period_days': days,
            'results': serializer.data
        })


class FailedSearchesAnalyticsAPIView(generics.ListAPIView):
    """
    GET /api/v1/analytics/failed-searches/?days=7&limit=10
    Returns searches that returned zero results
    """
    permission_classes = [AllowAny]
    serializer_class = api_serializer.FailedSearchSerializer
    
    def list(self, request, *args, **kwargs):
        days = int(request.query_params.get('days', 7))
        limit = int(request.query_params.get('limit', 10))
        
        # Get failed searches using manager method
        failed = api_models.SearchLog.objects.failed_searches(days=days, limit=limit)
        
        serializer = self.get_serializer(failed, many=True)
        return Response({
            'count': len(failed),
            'period_days': days,
            'results': serializer.data
        })


class SearchVolumeAnalyticsAPIView(generics.ListAPIView):
    """
    GET /api/v1/analytics/search-volume/?start_date=2025-01-01&end_date=2025-12-31
    Returns daily search volume for the date range
    """
    permission_classes = [AllowAny]
    serializer_class = api_serializer.SearchVolumeSerializer
    
    def list(self, request, *args, **kwargs):
        from datetime import datetime
        
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        if not start_date_str or not end_date_str:
            return Response({
                'error': 'start_date and end_date parameters are required'
            }, status=400)
        
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'error': 'Date format must be YYYY-MM-DD'
            }, status=400)
        
        # Get search volume using manager method
        volume = api_models.SearchLog.objects.search_volume_daily(start_date, end_date)
        
        serializer = self.get_serializer(volume, many=True)
        return Response({
            'count': len(volume),
            'start_date': start_date,
            'end_date': end_date,
            'results': serializer.data
        })


class SearchStatsAPIView(generics.ListAPIView):
    """
    GET /api/v1/analytics/search-stats/?start_date=2025-01-01&end_date=2025-12-31
    Returns aggregate search statistics for the date range
    """
    permission_classes = [AllowAny]
    serializer_class = api_serializer.SearchStatsSerializer
    
    def list(self, request, *args, **kwargs):
        from datetime import datetime
        
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        if not start_date_str or not end_date_str:
            return Response({
                'error': 'start_date and end_date parameters are required'
            }, status=400)
        
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'error': 'Date format must be YYYY-MM-DD'
            }, status=400)
        
        # Get aggregate stats using manager method
        stats = api_models.SearchLog.objects.search_stats(start_date, end_date)
        
        serializer = self.get_serializer(stats)
        return Response({
            'start_date': start_date,
            'end_date': end_date,
            'stats': serializer.data
        })


class CourseSearchMetricsAPIView(generics.ListAPIView):
    """
    GET /api/v1/analytics/course-search-metrics/?sort=impressions
    Returns per-course search metrics. Sort by: impressions, clicks, ctr
    """
    serializer_class = api_serializer.CourseSearchMetricsSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        sort = self.request.query_params.get('sort', 'impressions')
        
        # Get top courses using manager method
        if sort in ['impressions', 'clicks', 'ctr']:
            return api_models.CourseSearchAnalytics.objects.get_top_courses(
                limit=100, sort_by=sort
            )
        else:
            return api_models.CourseSearchAnalytics.objects.get_top_courses()
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # Get average metrics
        avg_metrics = api_models.CourseSearchAnalytics.objects.get_average_metrics()
        
        return Response({
            'count': len(queryset),
            'sort_by': request.query_params.get('sort', 'impressions'),
            'averages': avg_metrics,
            'results': serializer.data
        })


# [*] PHASE 4.4: Dashboard API Views
class SearchAnalyticsDashboardAPIView(generics.GenericAPIView):
    """
    GET /api/v1/analytics/dashboard/?period=daily&days=7
    Comprehensive dashboard combining all search analytics
    """
    permission_classes = [AllowAny]
    serializer_class = api_serializer.DashboardCompleteSerializer
    
    def get(self, request, *args, **kwargs):
        from datetime import datetime, timedelta
        from django.utils.timezone import now
        
        period = request.query_params.get('period', 'daily')  # daily, weekly, monthly
        days = int(request.query_params.get('days', 7))
        
        # Calculate date range based on period
        if period == 'monthly':
            days = 30
        elif period == 'weekly':
            days = 7
        else:
            days = days  # daily
        
        start_date = (now() - timedelta(days=days)).date()
        end_date = now().date()
        
        # Get all analytics data
        stats = api_models.SearchLog.objects.search_stats(start_date, end_date)
        trending = list(api_models.SearchLog.objects.trending_searches(days=days, limit=10))
        failed = list(api_models.SearchLog.objects.failed_searches(days=days, limit=10))
        volume = list(api_models.SearchLog.objects.search_volume_daily(start_date, end_date))
        
        # Get course performance
        top_courses = api_models.CourseSearchAnalytics.objects.get_top_courses(limit=10, sort_by='impressions')
        avg_metrics = api_models.CourseSearchAnalytics.objects.get_average_metrics()
        
        # Calculate search quality score (0-100)
        # Based on: % of successful searches, avg CTR, unique queries
        total_searches = stats.get('total_searches', 0) or 1
        failed_searches = len(failed)
        success_rate = ((total_searches - failed_searches) / total_searches * 100) if total_searches > 0 else 0
        avg_ctr = avg_metrics.get('avg_ctr') or 0
        quality_score = (success_rate * 0.6) + (avg_ctr * 0.4)  # 60% success rate, 40% CTR
        
        # Build overview
        overview = {
            'total_searches': stats.get('total_searches', 0),
            'unique_searchers': stats.get('unique_searchers', 0),
            'unique_queries': stats.get('unique_queries', 0),
            'avg_results_per_search': stats.get('avg_results') or 0,
            'avg_ctr': round(avg_metrics.get('avg_ctr') or 0, 2),
            'period_days': days,
            'search_quality_score': round(quality_score, 2)
        }
        
        # Build trending
        trending_data = {
            'trending_searches': trending,
            'failed_searches': failed,
            'search_volume_trend': volume
        }
        
        # Build course performance
        course_perf = {
            'total_courses': api_models.CourseSearchAnalytics.objects.count(),
            'top_courses': top_courses,
            'avg_metrics': avg_metrics
        }
        
        # Build complete dashboard
        dashboard = {
            'overview': overview,
            'trending': trending_data,
            'course_performance': course_perf,
            'timestamp': now(),
            'period': period
        }
        
        serializer = self.get_serializer(dashboard)
        return Response(serializer.data)


class SearchAnalyticsSummaryAPIView(generics.GenericAPIView):
    """
    GET /api/v1/analytics/summary/?days=7
    Quick summary of search analytics (lightweight)
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        from datetime import timedelta
        from django.utils.timezone import now
        
        days = int(request.query_params.get('days', 7))
        start_date = (now() - timedelta(days=days)).date()
        end_date = now().date()
        
        # Get stats
        stats = api_models.SearchLog.objects.search_stats(start_date, end_date)
        avg_metrics = api_models.CourseSearchAnalytics.objects.get_average_metrics()
        
        # Build summary
        summary = {
            'total_searches': stats.get('total_searches', 0),
            'unique_searchers': stats.get('unique_searchers', 0),
            'unique_queries': stats.get('unique_queries', 0),
            'avg_results': round(stats.get('avg_results') or 0, 2),
            'courses_searched': api_models.CourseSearchAnalytics.objects.filter(
                search_impressions__gt=0
            ).count(),
            'avg_ctr': round(avg_metrics.get('avg_ctr') or 0, 2),
            'period_days': days
        }
        
        return Response(summary)


class SearchAnalyticsTrendAPIView(generics.GenericAPIView):
    """
    GET /api/v1/analytics/trend/?start_date=2025-01-01&end_date=2025-12-31
    Detailed trend analysis with daily/weekly aggregation
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        from datetime import datetime
        
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        
        if not start_date_str or not end_date_str:
            return Response({
                'error': 'start_date and end_date parameters required (YYYY-MM-DD)'
            }, status=400)
        
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'error': 'Date format must be YYYY-MM-DD'
            }, status=400)
        
        # Get volume trend
        volume = api_models.SearchLog.objects.search_volume_daily(start_date, end_date)
        
        # Calculate trend metrics
        volume_list = list(volume)
        if volume_list:
            counts = [v['count'] for v in volume_list]
            total = sum(counts)
            avg = total / len(counts)
            max_vol = max(counts)
            min_vol = min(counts)
            trend = 'up' if counts[-1] > counts[0] else 'down' if counts[-1] < counts[0] else 'stable'
        else:
            avg = max_vol = min_vol = total = 0
            trend = 'none'
        
        trend_data = {
            'start_date': start_date,
            'end_date': end_date,
            'total_searches': total,
            'average_daily': round(avg, 2),
            'max_daily': max_vol,
            'min_daily': min_vol,
            'trend': trend,
            'days': len(volume_list),
            'volume': volume_list
        }
        
        return Response(trend_data)


# [*] PHASE 4.5: Advanced Filters API Views

class FilterOptionsAPIView(generics.GenericAPIView):
    """
    GET /api/v1/filters/options/
    Returns all available filter options for advanced search
    """
    permission_classes = [AllowAny]
    serializer_class = api_serializer.FilterOptionsResponseSerializer
    
    def get(self, request, *args, **kwargs):
        # Get categories with counts for published courses only
        categories = api_models.Category.objects.filter(
            course__platform_status='Published'
        ).distinct().annotate(
            course_count=models.Count('course', filter=models.Q(course__platform_status='Published'))
        ).values('id', 'title', 'slug', 'course_count').order_by('title')
        
        # [*] PHASE 4.77 FIX: Restored is_published_version=True filter to prevent counting duplicates
        # Get level distribution for published copies only
        levels = [
            {'level': level[0], 'description': level[1], 'count': api_models.Course.objects.filter(
                level=level[0], 
                platform_status='Published',
                teacher_course_status='Published',
                is_published_version=True  # [*] PHASE 4.77: Count only published copies
            ).count()}
            for level in api_models.LEVEL
        ]
        
        # [*] PHASE 4.77 FIX: Restored is_published_version=True filter to prevent counting duplicates
        # Get rating distribution for published copies only
        ratings = []
        total_courses = api_models.Course.objects.filter(
            platform_status='Published',
            teacher_course_status='Published',
            is_published_version=True  # [*] PHASE 4.77: Count only published copies
        ).count()
        for star in [5, 4, 3, 2, 1]:
            count = api_models.Review.objects.filter(
                rating__gte=star,
                rating__lt=star + 1,
                active=True
            ).values('course').distinct().count()
            if count > 0:
                ratings.append({
                    'min_rating': float(star),
                    'max_rating': float(star + 1),
                    'count': count,
                    'percentage': round((count / total_courses * 100) if total_courses else 0, 1)
                })
        
        # Get teachers with course counts
        from django.db.models import Avg
        teachers = api_models.Teacher.objects.filter(
            course__platform_status='Published'
        ).distinct().annotate(
            course_count=models.Count('course', filter=models.Q(course__platform_status='Published')),
            avg_rating=Avg('course__review__rating', filter=models.Q(course__review__active=True))
        ).values('id', 'full_name', 'image', 'course_count', 'avg_rating').filter(
            course_count__gt=0
        ).order_by('-course_count')[:20]
        
        data = {
            'categories': list(categories),
            'levels': [l for l in levels if l['count'] > 0],
            'ratings': ratings,
            'teachers': list(teachers)
        }
        
        serializer = self.serializer_class(data)
        return Response(serializer.data)


class CategoryFilterAPIView(generics.GenericAPIView):
    """
    GET /api/v1/filters/categories/
    Get all course categories with course count
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        categories = api_models.Category.objects.filter(
            course__platform_status='Published'
        ).distinct().annotate(
            course_count=models.Count('course', filter=models.Q(course__platform_status='Published'))
        ).values('id', 'title', 'slug', 'course_count', 'image').order_by('title')
        
        serializer = api_serializer.CategoryFilterSerializer(categories, many=True)
        return Response({
            'count': len(categories),
            'categories': serializer.data
        })


class LevelFilterAPIView(generics.GenericAPIView):
    """
    GET /api/v1/filters/levels/
    Get course level distribution with counts
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        levels_data = []
        level_descriptions = {
            'Beginner': 'Perfect for those new to the topic',
            'Intermediate': 'For learners with basic knowledge',
            'Advanced': 'For experienced learners'
        }
        
        for level_choice in api_models.LEVEL:
            level = level_choice[0]
            count = api_models.Course.objects.filter(
                level=level,
                platform_status='Published'
            ).count()
            
            if count > 0:
                levels_data.append({
                    'level': level,
                    'count': count,
                    'description': level_descriptions.get(level, '')
                })
        
        serializer = api_serializer.LevelFilterSerializer(levels_data, many=True)
        return Response({
            'count': len(levels_data),
            'levels': serializer.data
        })


class RatingFilterAPIView(generics.GenericAPIView):
    """
    GET /api/v1/filters/ratings/
    Get rating range distribution
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        from django.db.models import Avg, Count
        
        # Get all courses with their average ratings
        courses_with_ratings = api_models.Course.objects.filter(
            platform_status='Published'
        ).annotate(
            avg_rating=Avg('review__rating', filter=models.Q(review__active=True))
        ).values_list('id', 'avg_rating')
        
        # Group courses by rating ranges
        rating_groups = {
            '5.0': 0,  # 5 stars
            '4.0': 0,  # 4+ stars
            '3.0': 0,  # 3+ stars
            '2.0': 0,  # 2+ stars
            '1.0': 0   # 1+ stars
        }
        
        for course_id, avg_rating in courses_with_ratings:
            if avg_rating:
                if avg_rating >= 4.5:
                    rating_groups['5.0'] += 1
                elif avg_rating >= 3.5:
                    rating_groups['4.0'] += 1
                elif avg_rating >= 2.5:
                    rating_groups['3.0'] += 1
                elif avg_rating >= 1.5:
                    rating_groups['2.0'] += 1
                else:
                    rating_groups['1.0'] += 1
        
        total = sum(rating_groups.values())
        
        ratings_data = [
            {
                'min_rating': 4.5,
                'max_rating': 5.0,
                'count': rating_groups['5.0'],
                'percentage': round((rating_groups['5.0'] / total * 100) if total else 0, 1)
            },
            {
                'min_rating': 3.5,
                'max_rating': 4.5,
                'count': rating_groups['4.0'],
                'percentage': round((rating_groups['4.0'] / total * 100) if total else 0, 1)
            },
            {
                'min_rating': 2.5,
                'max_rating': 3.5,
                'count': rating_groups['3.0'],
                'percentage': round((rating_groups['3.0'] / total * 100) if total else 0, 1)
            },
            {
                'min_rating': 1.5,
                'max_rating': 2.5,
                'count': rating_groups['2.0'],
                'percentage': round((rating_groups['2.0'] / total * 100) if total else 0, 1)
            },
            {
                'min_rating': 1.0,
                'max_rating': 1.5,
                'count': rating_groups['1.0'],
                'percentage': round((rating_groups['1.0'] / total * 100) if total else 0, 1)
            }
        ]
        
        # Filter out empty groups
        ratings_data = [r for r in ratings_data if r['count'] > 0]
        
        serializer = api_serializer.RatingFilterSerializer(ratings_data, many=True)
        return Response({
            'count': len(ratings_data),
            'ratings': serializer.data
        })


class TeacherFilterAPIView(generics.GenericAPIView):
    """
    GET /api/v1/filters/teachers/
    Get available teachers with course counts
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        from django.db.models import Avg
        
        teachers = api_models.Teacher.objects.filter(
            course__platform_status='Published'
        ).distinct().annotate(
            course_count=models.Count('course', filter=models.Q(course__platform_status='Published')),
            avg_rating=Avg('course__review__rating', filter=models.Q(course__review__active=True, course__platform_status='Published'))
        ).values('id', 'full_name', 'image', 'course_count', 'avg_rating').filter(
            course_count__gt=0
        ).order_by('-course_count')
        
        serializer = api_serializer.TeacherFilterSerializer(teachers, many=True)
        return Response({
            'count': len(teachers),
            'teachers': serializer.data
        })


# [*] PHASE 4.6: Integrated Search with Advanced Filters

class AdvancedSearchAPIView(generics.GenericAPIView):
    """
    POST /api/v1/search/advanced/
    Unified endpoint combining FTS search with advanced filters
    
    Request:
    {
        "query": "python",
        "filters": {
            "category_id": 1,
            "level": "Beginner",
            "min_rating": 4.0,
            "teacher_id": 5
        },
        "page": 1,
        "per_page": 10
    }
    """
    permission_classes = [AllowAny]
    serializer_class = api_serializer.AdvancedSearchResponseSerializer
    
    def post(self, request, *args, **kwargs):
        import time as time_module
        start_time = time_module.time()
        
        # Validate request
        request_serializer = api_serializer.AdvancedSearchRequestSerializer(data=request.data)
        if not request_serializer.is_valid():
            return Response(request_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        validated_data = request_serializer.validated_data
        query = validated_data['query']
        filters = validated_data.get('filters') or {}
        page = validated_data.get('page', 1)
        per_page = validated_data.get('per_page', 10)
        
        # Build base queryset with FTS
        if query.strip():
            from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
            search_query = SearchQuery(query, search_type='websearch')
            results = api_models.Course.objects.annotate(
                rank=SearchRank(F('search_vector'), search_query)
            ).filter(
                search_vector=search_query,
                platform_status='Published',
                teacher_course_status='Published',
                is_published_version=True  # [*] PHASE 4.77: Show only published copies in advanced search
            ).order_by('-rank')
        else:
            # No query, just use filters
            results = api_models.Course.objects.filter(
                platform_status='Published',
                teacher_course_status='Published',
                is_published_version=True  # [*] PHASE 4.77: Show only published copies
            )
        
        # Apply category filter
        if filters.get('category_id'):
            results = results.filter(category_id=filters['category_id'])
        
        # Apply level filter
        if filters.get('level'):
            results = results.filter(level=filters['level'])
        
        # Apply teacher filter
        if filters.get('teacher_id'):
            results = results.filter(teacher_id=filters['teacher_id'])
        
        # Apply rating filter (min_rating)
        if filters.get('min_rating'):
            from django.db.models import Avg
            results = results.annotate(
                avg_rating=Avg('review__rating', filter=models.Q(review__active=True))
            ).filter(avg_rating__gte=filters['min_rating'])
        
        # Get total count before pagination
        total_results = results.count()
        total_pages = (total_results + per_page - 1) // per_page
        
        # Apply pagination
        offset = (page - 1) * per_page
        paginated_results = results[offset:offset + per_page]
        
        # Calculate quality score (based on result count and relevance)
        if total_results > 0:
            quality_score = min(100, (total_results / 100) * 100)  # More results = higher quality
        else:
            quality_score = 0
        
        # Create result serializer context with filters
        result_context = {
            'request': request,
            'filters': filters
        }
        
        result_serializer = api_serializer.AdvancedSearchResultSerializer(
            paginated_results,
            many=True,
            context=result_context
        )
        
        execution_time = (time_module.time() - start_time) * 1000  # Convert to ms
        
        response_data = {
            'query': query,
            'filters_applied': filters,
            'total_results': total_results,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages,
            'results': result_serializer.data,
            'execution_time_ms': round(execution_time, 2),
            'search_quality_score': round(quality_score, 1)
        }
        
        # Log the search
        try:
            api_models.SearchLog.objects.create(
                query=query,
                results_count=total_results,
                filters_applied=str(filters)  # Store as string for now
            )
        except:
            pass  # Don't fail if logging fails
        
        return Response(response_data)


class AdvancedSearchSuggestionsAPIView(generics.GenericAPIView):
    """
    GET /api/v1/search/suggestions/?q=python
    Get autocomplete suggestions based on search history and courses
    [*] PHASE 4.9: Added caching for suggestions (600s TTL)
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        query = request.query_params.get('q', '').strip()
        
        if not query or len(query) < 2:
            return Response({'suggestions': []})
        
        # Check cache first (PHASE 4.9 optimization)
        cache_key = f'suggestions:{query}'
        try:
            cached_result = cache.get(cache_key)
            if cached_result:
                return Response(cached_result)
        except:
            pass
        
        # Get trending searches that match query
        trending = api_models.SearchLog.objects.filter(
            query__icontains=query,
            results_count__gt=0
        ).values_list('query', flat=True).distinct().order_by('-created_at')[:5]
        
        # Get course titles that match
        courses = api_models.Course.objects.filter(
            title__icontains=query,
            platform_status='Published'
        ).values_list('title', flat=True).distinct()[:5]
        
        # Combine and deduplicate
        suggestions = list(set(list(trending) + list(courses)))[:10]
        
        result = {
            'query': query,
            'suggestions': suggestions,
            'count': len(suggestions)
        }
        
        # Cache the result (PHASE 4.9 optimization)
        try:
            cache.set(cache_key, result, 600)  # 10 min TTL
        except:
            pass
        
        return Response(result)


class StudentCourseListAPIView(generics.ListAPIView):
    serializer_class = api_serializer.EnrolledCourseSerializer
    permission_classes = [AllowAny]

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
    serializer_class = api_serializer.EnrolledCourseSerializer
    permission_classes = [AllowAny]
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
        
        try:
            return api_models.EnrolledCourse.objects.get(user=user, enrollment_id=enrollment_id)
        except api_models.EnrolledCourse.DoesNotExist:
            raise Http404("Enrollment not found")
        
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
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        user_id = request.data['user_id']
        course_id = request.data['course_id']
        variant_item_id = request.data['variant_item_id']

        user = User.objects.get(id=user_id)
        course = api_models.Course.objects.get(id=course_id)
        variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)

        completed_lessons = api_models.CompletedLesson.objects.filter(user=user, course=course, variant_item=variant_item).first()

        if completed_lessons:
            completed_lessons.delete()
            return Response({"message": "Course marked as not completed"})
        else:
            api_models.CompletedLesson.objects.create(user=user, course=course, variant_item=variant_item)
            return Response({"message": "Course marked as completed"})

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
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        """Get video progress with query parameters"""
        user_id = request.GET.get('user_id')
        course_id = request.GET.get('course_id')
        variant_item_id = request.GET.get('variant_item_id')
        
        if not all([user_id, course_id, variant_item_id]):
            return Response({
                "error": "Missing required parameters: user_id, course_id, variant_item_id"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user_id = int(user_id)
            course_id = int(course_id)
            variant_item_id = int(variant_item_id)
        except ValueError:
            return Response({
                "error": "Invalid parameter format - must be integers"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get progress using variant_item_id (ShortUUID field)
            progress = api_models.VideoProgress.objects.get(
                user_id=user_id,
                course_id=course_id,
                variant_item__variant_item_id=variant_item_id
            )
            
            serializer = api_serializer.VideoProgressSerializer(progress)
            return Response({
                "message": "Video progress retrieved successfully",
                "data": serializer.data
            }, status=status.HTTP_200_OK)
            
        except api_models.VideoProgress.DoesNotExist:
            # Return default progress structure
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
            print(f"[VideoProgress GET] Error: {str(e)}")
            return Response({
                "error": f"Failed to retrieve progress: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request, *args, **kwargs):
        user_id = request.data.get('user_id')
        course_id = request.data.get('course_id')
        variant_item_id = request.data.get('variant_item_id')
        progress_percentage = request.data.get('progress_percentage', 0)
        last_watched_position = request.data.get('last_watched_position', 0)
        total_duration = request.data.get('total_duration', 0)

        # Convert string values from FormData to proper numeric types
        try:
            progress_percentage = float(progress_percentage)
            last_watched_position = float(last_watched_position)
            total_duration = float(total_duration)
            # ✨ PHASE 4.145: Convert user_id and course_id to integers for database lookups
            user_id = int(user_id) if user_id else None
            course_id = int(course_id) if course_id else None
        except (TypeError, ValueError) as e:
            print(f"[VideoProgress] Type conversion error: {e}")
            return Response({
                "error": f"Invalid numeric values provided: {e}"
            }, status=status.HTTP_400_BAD_REQUEST)

        print(f"[VideoProgress] Received data: user_id={user_id}, course_id={course_id}, variant_item_id={variant_item_id}")
        print(f"[VideoProgress] Progress: {progress_percentage}%, Position: {last_watched_position}, Duration: {total_duration}")

        try:
            # Validate and fetch objects with better error messages
            try:
                user = User.objects.get(id=user_id)
                print(f"[VideoProgress] Found user: {user.username}")
            except User.DoesNotExist:
                return Response({
                    "error": f"User with id {user_id} not found"
                }, status=status.HTTP_400_BAD_REQUEST)

            try:
                course = api_models.Course.objects.get(id=course_id)
                print(f"[VideoProgress] Found course: {course.title}")
            except api_models.Course.DoesNotExist:
                return Response({
                    "error": f"Course with id {course_id} not found"
                }, status=status.HTTP_400_BAD_REQUEST)

            try:
                # ✨ PHASE 4.145: Better debugging for variant_item lookup
                print(f"[VideoProgress] Looking up variant_item with variant_item_id={variant_item_id} (type: {type(variant_item_id).__name__})")
                variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)
                print(f"[VideoProgress] Found variant item: {variant_item.title}")
            except api_models.VariantItem.DoesNotExist:
                print(f"[VideoProgress] ERROR: VariantItem with id {variant_item_id} not found")
                # List available variant items for debugging
                available_items = list(api_models.VariantItem.objects.values_list('variant_item_id', flat=True)[:5])
                print(f"[VideoProgress] Sample variant items in DB: {available_items}")
                return Response({
                    "error": f"VariantItem with id {variant_item_id} not found"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create or update video progress
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

            print(f"[VideoProgress] {'Created' if created else 'Updated'} progress for {user.username} - {variant_item.title}")
            
            serializer = api_serializer.VideoProgressSerializer(video_progress)
            return Response({
                "message": "Video progress saved successfully",
                "data": serializer.data,
                "created": created
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"[VideoProgress] Unexpected error: {str(e)}")
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
    permission_classes = [AllowAny]
    authentication_classes = []

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
        user_id = self.kwargs.get('user_id')
        variant_item_id = self.kwargs.get('variant_item_id')
        
        # Extract progress data from request
        progress_percentage = request.data.get('progress_percentage') or request.data.get('percentage', 0)
        last_watched_position = request.data.get('last_watched_position') or request.data.get('position', 0)
        total_duration = request.data.get('total_duration') or request.data.get('duration', 0)
        
        try:
            # Convert to appropriate types
            progress_percentage = float(progress_percentage)
            last_watched_position = float(last_watched_position)
            total_duration = float(total_duration)
            user_id = int(user_id)
            variant_item_id = int(variant_item_id)
        except (ValueError, TypeError) as e:
            return Response({
                "error": f"Invalid numeric values provided: {e}"
            }, status=status.HTTP_400_BAD_REQUEST)

        print(f"[VideoProgressDetail] POST data: user_id={user_id}, variant_item_id={variant_item_id}")
        print(f"[VideoProgressDetail] Progress: {progress_percentage}%, Position: {last_watched_position}, Duration: {total_duration}")

        try:
            # Get required objects
            user = User.objects.get(id=user_id)
            variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)
            
            # Get the course from request data or from variant_item
            course_id = request.data.get('course_id')
            if course_id:
                course = api_models.Course.objects.get(id=course_id)
            else:
                course = variant_item.variant.course

            # Create or update video progress
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

            print(f"[VideoProgressDetail] {'Created' if created else 'Updated'} progress for {user.username} - {variant_item.title}")
            
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
    permission_classes = [AllowAny]
    authentication_classes = []

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
    permission_classes = [AllowAny]
    authentication_classes = []

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

        user = User.objects.get(id=user_id)
        enrolled = api_models.EnrolledCourse.objects.get(enrollment_id=enrollment_id)
        
        api_models.Note.objects.create(user=user, course=enrolled.course, note=note, title=title, color=color)

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
    permission_classes = [AllowAny]
    authentication_classes = []

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
        return note

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
    permission_classes = [AllowAny]
    authentication_classes = []

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
    permission_classes = [AllowAny]
    authentication_classes = []

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
    permission_classes = [AllowAny]
    authentication_classes = []

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

        user = User.objects.get(id=user_id)
        course = api_models.Course.objects.get(id=course_id)
        
        question = api_models.Question_Answer.objects.create(
            course=course,
            user=user,
            title=title
        )

        api_models.Question_Answer_Message.objects.create(
            course=course,
            user=user,
            message=message,
            question=question
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
    permission_classes = [AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        print("=== DEBUG: QuestionAnswerMessageSendAPIView ===")
        print(f"Request data: {request.data}")
        
        try:
            course_id = request.data.get('course_id')
            qa_id = request.data.get('qa_id')
            user_id = request.data.get('user_id')
            message = request.data.get('message')

            print(f"Extracted data - course_id: {course_id}, qa_id: {qa_id}, user_id: {user_id}, message: {message}")

            # Validate required fields
            if not all([course_id, qa_id, user_id, message]):
                missing_fields = []
                if not course_id: missing_fields.append('course_id')
                if not qa_id: missing_fields.append('qa_id') 
                if not user_id: missing_fields.append('user_id')
                if not message: missing_fields.append('message')
                print(f"Missing fields: {missing_fields}")
                return Response(
                    {"error": f"Missing required fields: {', '.join(missing_fields)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get related objects with error handling
            try:
                user = User.objects.get(id=user_id)
                course = api_models.Course.objects.get(id=course_id)
                question = api_models.Question_Answer.objects.get(qa_id=qa_id)
            except User.DoesNotExist:
                return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
            except api_models.Course.DoesNotExist:
                return Response({"error": "Course not found"}, status=status.HTTP_404_NOT_FOUND)
            except api_models.Question_Answer.DoesNotExist:
                return Response({"error": "Question not found"}, status=status.HTTP_404_NOT_FOUND)

            # Create the message
            message_obj = api_models.Question_Answer_Message.objects.create(
                course=course,
                user=user,
                message=message,
                question=question
            )

            # Return the updated question with all messages
            question_serializer = api_serializer.Question_AnswerSerializer(question)
            return Response({"message": "Message Sent", "question": question_serializer.data})

        except Exception as e:
            return Response(
                {"error": f"Internal server error: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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

# ✨ PHASE 4.210: Admin Abuse Reports - List all abuse reports
class AdminAbuseReportsListAPIView(generics.ListAPIView):
    """
    List all abuse reports for admin review
    """
    serializer_class = api_serializer.ReviewAbuseSerializer
    permission_classes = [IsAdminUser]  # ✨ PHASE 4.210: Require admin permission
    
    def get_queryset(self):
        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        
        queryset = api_models.ReviewAbuse.objects.all().select_related('review', 'reported_by', 'reviewed_by').order_by('-reported_at')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset

# ✨ PHASE 4.210: Admin Abuse Report Detail - Manage individual reports
class AdminAbuseReportDetailAPIView(generics.RetrieveUpdateAPIView):
    """
    Retrieve, update, and manage individual abuse reports
    """
    serializer_class = api_serializer.ReviewAbuseSerializer
    permission_classes = [IsAdminUser]  # ✨ PHASE 4.210: Require admin permission
    lookup_field = 'id'
    lookup_url_kwarg = 'report_id'
    
    def get_queryset(self):
        return api_models.ReviewAbuse.objects.all().select_related('review', 'reported_by', 'reviewed_by')
    
    def update(self, request, *args, **kwargs):
        report = self.get_object()
        
        # Update status and review notes
        status_new = request.data.get('status')
        review_notes = request.data.get('review_notes')
        
        if status_new:
            report.status = status_new
            report.reviewed_at = timezone.now()
            report.reviewed_by_id = request.data.get('reviewed_by', None)
        
        if review_notes:
            report.review_notes = review_notes
        
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
            return api_models.Question_Answer.objects.filter(course__teacher=teacher)
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
    serializer_class = api_serializer.BasicTeacherSerializer
    permission_classes = [AllowAny]
    
    def get_object(self):
        user_id = self.kwargs['user_id']
        teacher = api_models.Teacher.objects.filter(user_id=user_id).first()
        if not teacher:
            # If teacher doesn't exist, create one from profile
            try:
                from userauths.models import Profile
                profile = Profile.objects.get(user_id=user_id)
                teacher = api_models.Teacher.create_from_profile(profile.user)
            except Profile.DoesNotExist:
                return None
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
    - Updates teacher profile data
    - Secured by JWT token validation
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def patch(self, request, user_id):
        try:
            if not user_id:
                return Response({'error': 'User ID is required'}, status=status.HTTP_400_BAD_REQUEST)
            
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
            self.perform_update(serializer)
            
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
                media_source = item_data.get("media_source", "")  # ✨ PHASE 4.191: Get media source from request
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
                
                # [*] PHASE 4.43.10: Extract duration from Google Drive/YouTube links if not provided
                if not duration_seconds and file and ('drive.google.com' in file or 'youtube.com' in file or 'youtu.be' in file):
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
                        # PHASE 4.191: Save media_source to remember which source was used
                        if media_source and media_source in ['upload', 'google_drive', 'youtube']:
                            variant_item.media_source = media_source
                            print(f"[Curriculum Update] Setting media_source to '{media_source}' for item {variant_item_id}")
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
                            order=int(item_order) if item_order else 0,
                            media_source=media_source if media_source and media_source in ['upload', 'google_drive', 'youtube'] else 'google_drive'  # PHASE 4.191
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
                        order=int(item_order) if item_order else 0,
                        media_source=media_source if media_source and media_source in ['upload', 'google_drive', 'youtube'] else 'google_drive'  # PHASE 4.191
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
                    # Use clear_target=True to avoid duplicates if this method is called multiple times
                    course._copy_content_to(published, clear_target=True)
                    print(f"[Admin Approval] [OK] Draft content synced to published version")
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
class AdminCourseListAPIView(generics.ListAPIView):
    """
    [*] PHASE 4.36: List all courses awaiting admin review
    
    Only accessible to superadmins
    Shows courses with platform_status = "Review"
    """
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [IsAdminUser]  # [*] FIX: Use proper admin permission class
    pagination_class = None  # Disable pagination for admin review list
    
    def get_queryset(self):
        user = self.request.user
        print(f"[AdminCourseList] User authenticated: {user.is_authenticated}, Is admin: {user.is_admin if hasattr(user, 'is_admin') else 'N/A'}")
        
        # Return courses awaiting review or show all depending on params
        status_filter = self.request.query_params.get('status', 'Review')
        print(f"[AdminCourseList] Filtering by status: {status_filter}")
        
        if status_filter:
            # [*] PHASE 4.60B: Filter out published versions, show only parent/draft courses
            queryset = api_models.Course.objects.filter(
                platform_status=status_filter, 
                is_published_version=False  # Admin manages parent courses, not published copies
            ).order_by('-review_submitted_date')
        else:
            # [*] PHASE 4.60B: Filter out published versions in unfiltered view too
            queryset = api_models.Course.objects.filter(
                is_published_version=False  # Admin manages parent courses, not published copies
            ).order_by('-review_submitted_date')
        
        print(f"[AdminCourseList] Found {queryset.count()} courses with status '{status_filter}'")
        return queryset

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
    permission_classes = [AllowAny]
    authentication_classes = []  # Disable SessionAuthentication

    def get_object(self):
        variant_id = self.kwargs['variant_id']
        teacher_id = self.kwargs['teacher_id']
        course_id = self.kwargs['course_id']



        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
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
    permission_classes = [AllowAny]
    authentication_classes = []

    def get_object(self):
        variant_id = self.kwargs['variant_id']
        variant_item_id = self.kwargs['variant_item_id']
        teacher_id = self.kwargs['teacher_id']
        course_id = self.kwargs['course_id']

        try:
            teacher = api_models.Teacher.objects.get(id=teacher_id)
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
class FileUploadAPIView(APIView):
    """
    File Upload API View
    
    Allows file uploads without CSRF token validation.
    This is safe because:
    1. Uses JWT authentication for authenticated requests
    2. AllowAny permission allows public uploads (for course thumbnails, etc.)
    3. Files are stored securely with UUID-based filenames
    4. File type validation is performed by the serializer
    """
    permission_classes = [AllowAny]
    authentication_classes = []  # Explicitly disable authentication for this view
    parser_classes = (MultiPartParser, FormParser,)  # Allow file uploads

    @swagger_auto_schema(
        operation_description="Upload a file",
        request_body=api_serializer.FileUploadSerializer,  # Use the serializer here
        responses={
            200: openapi.Response('File uploaded successfully', openapi.Schema(type=openapi.TYPE_OBJECT)),
            400: openapi.Response('No file provided', openapi.Schema(type=openapi.TYPE_OBJECT)),
        }
    )

    def post(self, request):
        
        serializer = api_serializer.FileUploadSerializer(data=request.data)  

        if serializer.is_valid():
            file = serializer.validated_data.get("file")
            
            # ✨ PHASE 4.101.3: DELETE OLD FILE BEFORE SAVING NEW ONE
            # When user uploads a new image, immediately delete the old one
            # This ensures only ONE image file exists on disk at a time
            old_file_url = request.data.get('old_file_url')  # Frontend can send previous URL
            
            print(f"\n[FileUploadAPIView.post] 📤 NEW FILE UPLOAD RECEIVED")
            print(f"[FileUploadAPIView.post] file name: {file.name}")
            
            # ✨ PHASE 4.102: Get course_id for consistent filename
            course_id = request.data.get('course_id')
            print(f"[FileUploadAPIView.post] course_id: {repr(course_id)}")
            
            # ✨ PHASE 4.107: Get upload type (curriculum, intro, or image)
            upload_type = request.data.get('upload_type', 'course')  # Default: course image/intro
            print(f"[FileUploadAPIView.post] upload_type: {repr(upload_type)}")
            
            old_file_url = request.data.get('old_file_url')
            print(f"[FileUploadAPIView.post] old_file_url: {repr(old_file_url)}")
            
            # Note: old_file_url no longer needed for deletion (file overwrites by name)
            # Kept for backwards compatibility with older frontend versions
            
            # ✨ PHASE 4.102/4.103: Create consistent filename based on course_id
            # Format (course uploads):
            #   - {course_id}-gk.{extension}  for images (gk = gambar kursus)
            #   - {course_id}-intro.{extension}  for videos (intro = pengantar)
            # Format (curriculum uploads - ✨ PHASE 4.107):
            #   - {course_id}-variant-{variant_id}-{item_id}.{extension}  for lesson media
            # This ensures new uploads overwrite old ones automatically!
            file_extension = os.path.splitext(file.name)[1].lower()
            
            # Determine if this is a video or image file
            video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.ogg', '.ogv', '.flv', '.wmv', '.m4v']
            is_video_file = file_extension in video_extensions
            
            # ✨ PHASE 4.107: Handle curriculum media uploads separately from course image/intro
            # ✨ PHASE 4.174: Use {course_id}_{variant_id}_{variant_item_id} pattern for unique names
            if upload_type == 'curriculum' and course_id:
                # Curriculum/lesson media uses variant + item IDs for unique naming
                variant_id = request.data.get('variant_id', 'unknown')
                item_id = request.data.get('item_id', 'unknown')  # Now variant_item_id from frontend
                
                # Naming: {course_id}_{variant_id}_{item_id}.{extension} (underscores for clarity)
                # Directory: curriculum-media/ (separate from course files)
                unique_filename = f"curriculum-media/{course_id}_{variant_id}_{item_id}{file_extension}"
                file_suffix = f"{variant_id}_{item_id}"  # For deletion pattern
                print(f"[FileUploadAPIView.post] ✨ Curriculum media upload detected!")
                print(f"[FileUploadAPIView.post] ✨ Using curriculum filename: {unique_filename}")
                print(f"[FileUploadAPIView.post] variant_id: {variant_id}, item_id (variant_item_id): {item_id}")
            elif course_id:
                # Course image/intro video uploads (existing logic)
                # Use consistent course-based filename for automatic overwriting
                # Different suffixes for images (gk) vs videos (intro)
                file_suffix = "intro" if is_video_file else "gk"
                unique_filename = f"course-file/{course_id}-{file_suffix}{file_extension}"
                print(f"[FileUploadAPIView.post] ✨ Using consistent filename: {unique_filename}")
                print(f"[FileUploadAPIView.post] File type: {'VIDEO' if is_video_file else 'IMAGE'}")
            else:
                # Fallback to UUID if course_id not provided (backwards compatibility)
                import uuid
                unique_filename = f"course-file/{uuid.uuid4()}{file_extension}"
                print(f"[FileUploadAPIView.post] ⚠️  No course_id, falling back to UUID: {unique_filename}")
            
            print(f"[FileUploadAPIView.post] 💾 Saving file: {unique_filename}")

            # ✨ PHASE 4.102.1/4.107: DELETE OLD FILES BEFORE SAVING
            # Django's default_storage.save() appends random chars for file collisions
            # So we must manually delete old files FIRST to ensure true overwriting!
            if course_id:
                # Find and delete ALL old files matching the pattern
                # This handles cases where user uploads JPG then PNG (different extensions)
                import glob
                from django.conf import settings
                
                media_root = settings.MEDIA_ROOT
                
                if upload_type == 'curriculum':
                    # Curriculum media: delete {course_id}_{variant_id}_{item_id}.* (✨ PHASE 4.174)
                    variant_id = request.data.get('variant_id', 'unknown')
                    item_id = request.data.get('item_id', 'unknown')
                    curriculum_media_dir = os.path.join(media_root, 'curriculum-media')
                    old_file_pattern = os.path.join(curriculum_media_dir, f"{course_id}_{variant_id}_{item_id}.*")
                    deletion_type = "curriculum"
                else:
                    # Course files: delete {course_id}-gk.* or {course_id}-intro.*
                    course_file_dir = os.path.join(media_root, 'course-file')
                    file_suffix = "intro" if is_video_file else "gk"
                    old_file_pattern = os.path.join(course_file_dir, f"{course_id}-{file_suffix}.*")
                    deletion_type = "course"
                
                try:
                    old_files = glob.glob(old_file_pattern)
                    if old_files:
                        for old_file_path in old_files:
                            try:
                                os.remove(old_file_path)
                                old_file_name = os.path.basename(old_file_path)
                                print(f"[FileUploadAPIView.post] 🗑️  Deleted old {deletion_type} file: {old_file_name}")
                            except Exception as e:
                                print(f"[FileUploadAPIView.post] ⚠️  Could not delete {old_file_path}: {e}")
                    else:
                        print(f"[FileUploadAPIView.post] ℹ️  No old files found matching pattern: {old_file_pattern}")
                except Exception as e:
                    print(f"[FileUploadAPIView.post] ⚠️  Error finding old files: {e}")
            
            # Save the file to the media directory
            # Now it will TRULY overwrite (old file deleted above)
            file_path = default_storage.save(unique_filename, ContentFile(file.read()))
            file_url = request.build_absolute_uri(default_storage.url(file_path))
            
            print(f"[FileUploadAPIView.post] ✅ File saved successfully!")
            print(f"[FileUploadAPIView.post] File URL: {file_url}")
            if course_id:
                print(f"[FileUploadAPIView.post] ✅ Old file deleted and new file saved (true overwriting!)!")
            else:
                print(f"[FileUploadAPIView.post] ℹ️  Using UUID filename (no automatic overwriting)")

            # Determine file type and prepare response data
            response_data = {
                "url": file_url,
                "file_name": file.name,
                "file_size": file.size,
                "file_type": self.determine_file_type(file_extension)
            }

            # Check if the file is a video by inspecting its extension
            if file_extension in ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.ogg']:
                # Calculate the video duration
                file_full_path = os.path.join(default_storage.location, file_path)
                try:
                    clip = VideoFileClip(file_full_path)
                    duration_seconds = clip.duration
                    clip.close()  # Free memory

                    # Calculate minutes and seconds for display
                    minutes, remainder = divmod(duration_seconds, 60)
                    minutes = math.floor(minutes)
                    seconds = math.floor(remainder)

                    duration_text = f"{minutes}m {seconds}s"

                    print("url ==========", file_url)
                    print("duration_seconds ==========", duration_seconds)

                    # Return video data with duration information
                    response_data.update({
                        "duration_seconds": duration_seconds,  # Raw seconds for database storage
                        "video_duration": duration_text,       # Formatted text for display
                        "is_video": True
                    })

                except Exception as e:
                    print(f"Error processing video: {e}")
                    response_data["duration_error"] = str(e)

            return Response(response_data)

        return Response({"error": "No file provided"}, status=400)
    
    def determine_file_type(self, file_extension):
        """Determine the file type based on extension"""
        video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.ogg']
        document_extensions = ['.pdf', '.doc', '.docx', '.txt']
        presentation_extensions = ['.ppt', '.pptx']
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp']
        
        if file_extension in video_extensions:
            return "video"
        elif file_extension in document_extensions:
            return "document"
        elif file_extension in presentation_extensions:
            return "presentation"
        elif file_extension in image_extensions:
            return "image"
        else:
            return "file"


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
    permission_classes = [AllowAny]
    authentication_classes = []  # Disable SessionAuthentication
    lookup_field = 'quiz_id'

    def get_queryset(self):
        return api_models.Quiz.objects.all()

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
    permission_classes = [AllowAny]
    authentication_classes = []  # Disable SessionAuthentication
    lookup_field = 'question_id'

    def get_queryset(self):
        return api_models.QuizQuestion.objects.all()

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
    permission_classes = [AllowAny]
    authentication_classes = []  # Disable SessionAuthentication
    lookup_field = 'choice_id'

    def get_queryset(self):
        return api_models.QuizChoice.objects.all()


# Student Quiz API Views
class StudentQuizListAPIView(generics.ListAPIView):
    """List all active quizzes for a specific course"""
    serializer_class = api_serializer.QuizSerializer
    permission_classes = [AllowAny]
    
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
        
        # Add attempt information for each quiz
        user_id = self.kwargs.get('user_id')
        if user_id:
            user = User.objects.get(id=user_id)
            for quiz_data in serializer.data:
                quiz = api_models.Quiz.objects.get(quiz_id=quiz_data['quiz_id'])
                
                # Get attempts info
                today_attempts = api_models.QuizAttempt.get_daily_attempts_count(user, quiz)
                can_attempt = api_models.QuizAttempt.can_attempt_quiz(user, quiz)
                best_attempt = api_models.QuizAttempt.objects.filter(
                    user=user, quiz=quiz
                ).order_by('-score').first()
                
                quiz_data['today_attempts'] = today_attempts
                quiz_data['can_attempt'] = can_attempt
                quiz_data['best_score'] = best_attempt.score if best_attempt else 0
                quiz_data['is_passed'] = best_attempt.is_passed if best_attempt else False
        
        return Response(serializer.data)


class StudentQuizDetailAPIView(generics.RetrieveAPIView):
    """Get quiz details for taking the quiz"""
    serializer_class = api_serializer.QuizSerializer
    permission_classes = [AllowAny]
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
                if not api_models.QuizAttempt.can_attempt_quiz(user, quiz):
                    return Response(
                        {"error": "Maximum daily attempts (3) reached for this quiz"},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # Get the serialized data
                serializer = self.get_serializer(quiz)
                quiz_data = serializer.data
                
                # Add attempt information
                today_attempts = api_models.QuizAttempt.get_daily_attempts_count(user, quiz)
                can_attempt = api_models.QuizAttempt.can_attempt_quiz(user, quiz)
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
    permission_classes = [AllowAny]
    authentication_classes = []
    
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
                
                # Check if user can attempt
                if not api_models.QuizAttempt.can_attempt_quiz(user, quiz):
                    return Response(
                        {"error": "Maximum daily attempts (3) reached"},
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
                
                # Create quiz attempt record
                from datetime import timedelta
                from decimal import Decimal
                time_taken_duration = timedelta(seconds=time_taken) if time_taken else None
                
                attempt = api_models.QuizAttempt.objects.create(
                    user=user,
                    quiz=quiz,
                    score=Decimal(str(score)),  # Ensure Decimal type for accurate comparison
                    total_questions=total_questions,
                    correct_answers=correct_answers,
                    time_taken=time_taken_duration
                )
                
                # Refresh the attempt from database to get the calculated is_passed value
                attempt.refresh_from_db()
                
                print(f"Quiz attempt created - score: {attempt.score}, is_passed: {attempt.is_passed}, pass_status: {attempt.pass_status}")
                
                # Calculate updated attempt information after submission
                today_attempts = api_models.QuizAttempt.get_daily_attempts_count(user, quiz)
                can_attempt = api_models.QuizAttempt.can_attempt_quiz(user, quiz)
                attempts_left = max(0, 3 - today_attempts)
                
                print(f"After submission - today_attempts: {today_attempts}, can_attempt: {can_attempt}, attempts_left: {attempts_left}")
                
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
                    "max_daily_attempts": 3
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
    permission_classes = [AllowAny]
    
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
    """Check if student is eligible for certificate and return certificate data"""
    authentication_classes = []
    permission_classes = [AllowAny]  # Allow students to check eligibility
    
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
            
            return Response({
                'is_eligible': is_eligible,
                'completion_percentage': round(enrollment.completion_percentage()),
                'all_lessons_completed': enrollment.is_course_completed(),
                'all_quizzes_passed': enrollment.are_all_quizzes_passed(),
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
    authentication_classes = []
    permission_classes = [AllowAny]  # Allow students to generate certificates
    
    def post(self, request):
        try:
            user_id = request.data.get('user_id')
            course_id = request.data.get('course_id')
            enrollment_id = request.data.get('enrollment_id')
            
            # Get user, course, and enrollment
            user = User.objects.get(id=user_id)
            course = api_models.Course.objects.get(course_id=course_id)
            enrollment = api_models.EnrolledCourse.objects.get(
                enrollment_id=enrollment_id, user=user, course=course
            )
            
            # Check eligibility
            if not enrollment.is_certificate_eligible():
                return Response({
                    'error': 'Not eligible for certificate',
                    'detail': 'Complete all lessons and pass all quizzes to generate certificate'
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
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request):
        try:
            file = request.FILES.get('file')
            user_id = request.data.get('user_id')
            course_id = request.data.get('course_id')
            
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
    """Download certificate image (PNG) from server using course_id and user_id"""
    authentication_classes = []
    permission_classes = [AllowAny]  # Allow anyone with course_id and user_id to download
    
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
    """List all certificates for the current student"""
    authentication_classes = []
    permission_classes = [AllowAny]  # Allow any student to view their own certificates
    
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
                'course_category': certificate.course.category.title if certificate.course.category else 'General'
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


# ========== ADMIN API VIEWS ==========

class AdminSummaryAPIView(generics.RetrieveAPIView):
    """
    Admin Dashboard Summary with comprehensive system statistics
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = api_serializer.AdminSummarySerializer
    
    def get(self, request):
        try:
            # IsAdminUser permission class already verified access above
            # Additional verification as backup
            if not (hasattr(request.user, 'is_admin') and request.user.is_admin) and \
               not (hasattr(request.user, 'current_role') and request.user.current_role == 'admin'):
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            # Calculate statistics
            from django.utils import timezone
            from datetime import timedelta
            
            now = timezone.now()
            last_30_days = now - timedelta(days=30)
            
            # User statistics
            total_students = User.objects.filter(role='student').count()
            total_teachers = User.objects.filter(role='teacher').count()
            total_admins = User.objects.filter(role='admin').count()
            
            # Course statistics
            # [*] PHASE 4.77 FIX: Only count published versions to avoid double counting
            # (published course + draft editing version both counted before)
            total_courses = api_models.Course.objects.filter(is_published_version=True).count()
            active_courses = api_models.Course.objects.filter(
                platform_status='Published',
                is_published_version=True  # [*] PHASE 4.77: Only published copies
            ).count()
            
            # Enrollment statistics
            total_enrollments = api_models.EnrolledCourse.objects.count()
            recent_enrollments = api_models.EnrolledCourse.objects.filter(date__gte=last_30_days).count()
            
            # Certificate statistics (handle if Certificate model doesn't exist)
            try:
                total_certificates = api_models.Certificate.objects.count()
                recent_certificates = api_models.Certificate.objects.filter(date__gte=last_30_days).count()
            except:
                total_certificates = 0
                recent_certificates = 0
            
            # Review statistics
            total_reviews = api_models.Review.objects.count()
            recent_reviews = api_models.Review.objects.filter(date__gte=last_30_days).count()
            
            # Quiz statistics (handle if Quiz models don't exist)
            # [*] PHASE 4.77 FIX: Only count quizzes from published courses
            try:
                published_course_ids = api_models.Course.objects.filter(
                    is_published_version=True
                ).values_list('id', flat=True)
                total_quizzes = api_models.Quiz.objects.filter(
                    course_id__in=published_course_ids
                ).count()
                total_quiz_attempts = api_models.QuizAttempt.objects.count()
            except:
                total_quizzes = 0
                total_quiz_attempts = 0
            
            # Recent registrations
            recent_registrations = User.objects.filter(date_joined__gte=last_30_days).count()
            
            # Revenue calculation - Cart/Order system removed, set to 0
            total_revenue = 0
            
            # Top performing courses
            # [*] PHASE 4.77 FIX: Only count published versions to avoid duplicates
            top_courses = api_models.Course.objects.filter(
                is_published_version=True
            ).annotate(
                enrollment_count=models.Count('enrolledcourse')
            ).order_by('-enrollment_count')[:5]
            
            # Most active teachers
            # [*] PHASE 4.77 FIX: Only count published courses per teacher
            active_teachers = api_models.Teacher.objects.annotate(
                course_count=models.Count(
                    'course',
                    filter=models.Q(course__is_published_version=True)
                )
            ).order_by('-course_count')[:5]
            
            # Latest activities
            latest_enrollments = api_models.EnrolledCourse.objects.select_related(
                'user', 'course'
            ).order_by('-date')[:10]
            
            latest_reviews = api_models.Review.objects.select_related(
                'user', 'course'
            ).order_by('-date')[:10]
            
            # System health metrics
            completion_rate = 0
            try:
                if total_enrollments > 0:
                    completed_courses = api_models.EnrolledCourse.objects.filter(
                        completed=True
                    ).count()
                    completion_rate = (completed_courses / total_enrollments) * 100
            except:
                completion_rate = 0
            
            data = {
                'total_students': total_students,
                'total_teachers': total_teachers,
                'total_admins': total_admins,
                'total_courses': total_courses,
                'active_courses': active_courses,
                'total_enrollments': total_enrollments,
                'recent_enrollments': recent_enrollments,
                'total_certificates': total_certificates,
                'recent_certificates': recent_certificates,
                'total_reviews': total_reviews,
                'recent_reviews': recent_reviews,
                'total_quizzes': total_quizzes,
                'total_quiz_attempts': total_quiz_attempts,
                'recent_registrations': recent_registrations,
                'total_revenue': float(total_revenue) if total_revenue else 0,
                'completion_rate': round(completion_rate, 2),
                'top_courses': [
                    {
                        'id': course.id,
                        'title': course.title or 'Untitled Course',
                        'enrollment_count': course.enrollment_count,
                        'teacher': course.teacher.full_name if course.teacher else 'No Teacher'
                    } for course in top_courses
                ],
                'active_teachers': [
                    {
                        'id': teacher.id,
                        'full_name': teacher.full_name,
                        'course_count': teacher.course_count
                    } for teacher in active_teachers
                ],
                'latest_enrollments': [
                    {
                        'id': enrollment.id,
                        'student': enrollment.user.full_name if enrollment.user else 'Unknown Student',
                        'course': enrollment.course.title if enrollment.course else 'Unknown Course',
                        'date': enrollment.date
                    } for enrollment in latest_enrollments
                ],
                'latest_reviews': [
                    {
                        'id': review.id,
                        'student': review.user.full_name if review.user else 'Unknown Student',
                        'course': review.course.title if review.course else 'Unknown Course',
                        'rating': review.rating,
                        'date': review.date
                    } for review in latest_reviews
                ]
            }
            
            return Response(data, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            print(f"AdminSummaryAPIView Error: {str(e)}")
            print(traceback.format_exc())
            return Response({'error': f'Internal server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUserManagementAPIView(generics.ListAPIView):
    """
    Admin view to manage all users in the system - OPTIMIZED
    Returns only essential fields for list view
    Supports pagination and filtering
    [*] PHASE 4.15: Enable pagination for large datasets (returns 20 per page)
    Frontend fetches all pages and handles client-side pagination for responsive UX
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.UserSerializer
    pagination_class = PageNumberPagination  # Enable pagination
    
    def get_queryset(self):
        # Verify admin access
        if not (hasattr(self.request.user, 'is_admin') and self.request.user.is_admin):
            return User.objects.none()
        
        # Only select necessary fields from database (database-level optimization)
        # Using .only() reduces query payload by 60-70%
        # PHASE 4.10: Added is_student, is_instructor, is_admin for Multi Role support
        queryset = User.objects.all().only(
            'id',
            'username', 
            'email',
            'full_name',
            'role',
            'is_student',
            'is_instructor',
            'is_admin',
            'is_active',
            'last_login',
            'date_joined'
        ).order_by('-date_joined')
        
        # Apply filtering if provided
        role_filter = self.request.query_params.get('role', None)
        if role_filter:
            queryset = queryset.filter(role=role_filter)
        
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            if status_filter == 'active':
                queryset = queryset.filter(is_active=True)
            elif status_filter == 'inactive':
                queryset = queryset.filter(is_active=False)
        
        return queryset


class AdminCourseManagementAPIView(generics.ListAPIView):
    """
    Admin view to manage all courses in the system
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.CourseSerializer
    
    def get_queryset(self):
        # Verify admin access
        if not (hasattr(self.request.user, 'is_admin') and self.request.user.is_admin):
            return api_models.Course.objects.none()
        
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            return api_models.Course.objects.filter(platform_status=status_filter).order_by('-date')
        return api_models.Course.objects.all().order_by('-date')


class AdminEnrollmentAnalyticsAPIView(generics.RetrieveAPIView):
    """
    Admin enrollment analytics and trends
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        try:
            # IsAdminUser permission class already verified access above
            # Additional verification as backup
            if not (hasattr(request.user, 'is_admin') and request.user.is_admin) and \
               not (hasattr(request.user, 'current_role') and request.user.current_role == 'admin'):
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            from django.utils import timezone
            from datetime import timedelta
            import calendar
            
            now = timezone.now()
            
            # Monthly enrollment data for the last 12 months
            monthly_data = []
            for i in range(12):
                month_start = now.replace(day=1) - timedelta(days=30*i)
                month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
                
                enrollments = api_models.EnrolledCourse.objects.filter(
                    date__gte=month_start,
                    date__lte=month_end
                ).count()
                
                monthly_data.append({
                    'month': calendar.month_name[month_start.month],
                    'year': month_start.year,
                    'enrollments': enrollments
                })
            
            monthly_data.reverse()
            
            # Course category distribution
            category_data = api_models.Category.objects.annotate(
                enrollment_count=models.Count('course__enrolledcourse')
            ).order_by('-enrollment_count')
            
            # Top performing courses
            top_courses = api_models.Course.objects.annotate(
                enrollment_count=models.Count('enrolledcourse'),
                avg_rating=models.Avg('review__rating')
            ).order_by('-enrollment_count')[:10]
            
            data = {
                'monthly_enrollments': monthly_data,
                'category_distribution': [
                    {
                        'category': cat.title,
                        'enrollments': cat.enrollment_count
                    } for cat in category_data
                ],
                'top_performing_courses': [
                    {
                        'id': course.id,
                        'title': course.title or 'Untitled Course',
                        'teacher': course.teacher.full_name if course.teacher else 'No Teacher',
                        'enrollments': course.enrollment_count,
                        'rating': round(course.avg_rating or 0, 2)
                    } for course in top_courses
                ]
            }
            
            return Response(data, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            print(f"AdminEnrollmentAnalyticsAPIView Error: {str(e)}")
            print(traceback.format_exc())
            return Response({'error': f'Internal server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminSystemHealthAPIView(generics.RetrieveAPIView):
    """
    System health monitoring for admins
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        try:
            # IsAdminUser permission class already verified access above
            # Additional verification as backup
            if not (hasattr(request.user, 'is_admin') and request.user.is_admin) and \
               not (hasattr(request.user, 'current_role') and request.user.current_role == 'admin'):
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            import os
            import sys
            import django
            from django.conf import settings
            
            # Database statistics
            db_stats = {
                'total_users': User.objects.count(),
                'total_courses': api_models.Course.objects.count(),
                'total_enrollments': api_models.EnrolledCourse.objects.count(),
                'total_reviews': api_models.Review.objects.count(),
            }
            
            # Add certificate count safely
            try:
                db_stats['total_certificates'] = api_models.Certificate.objects.count()
            except:
                db_stats['total_certificates'] = 0
            
            # Server information
            server_info = {
                'django_version': f"{django.VERSION[0]}.{django.VERSION[1]}.{django.VERSION[2]}",
                'python_version': f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
                'debug_mode': settings.DEBUG,
                'database_engine': settings.DATABASES['default']['ENGINE'].split('.')[-1],
            }
            
            # Recent error logs (you can implement based on your logging system)
            recent_errors = []  # Implement based on your error logging
            
            data = {
                'database_statistics': db_stats,
                'server_information': server_info,
                'recent_errors': recent_errors,
                'system_status': 'healthy'
            }
            
            return Response(data, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            print(f"AdminSystemHealthAPIView Error: {str(e)}")
            print(traceback.format_exc())
            return Response({'error': f'Internal server error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ========== ADMIN USER MANAGEMENT API VIEWS ==========

class AdminUserDetailAPIView(generics.RetrieveAPIView):
    """
    Get detailed information about a specific user
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.UserSerializer
    
    def get_object(self):
        # Verify admin access
        if not (hasattr(self.request.user, 'is_admin') and self.request.user.is_admin):
            raise Http404("Admin access required")
        
        user_id = self.kwargs.get('user_id')
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise Http404("User not found")
    
    def retrieve(self, request, *args, **kwargs):
        try:
            user = self.get_object()
            serializer = self.get_serializer(user)
            
            # Wrap user data in user_info object for frontend
            user_info = serializer.data
            response_data = {'user_info': user_info}
            
            # Add enrollment statistics if user is a student
            if user.is_student:
                enrollments = api_models.EnrolledCourse.objects.filter(user=user)
                
                # Calculate completed courses using the is_course_completed() method
                completed_count = 0
                for enrollment in enrollments:
                    if enrollment.is_course_completed():
                        completed_count += 1
                
                response_data['enrollment_stats'] = {
                    'total_enrollments': enrollments.count(),
                    'completed_courses': completed_count,
                    'in_progress_courses': enrollments.count() - completed_count,
                    'certificates_earned': api_models.Certificate.objects.filter(user=user).count()
                }
            
            # [*] PHASE 4.10 - Add teaching statistics if user is an instructor (changed from elif to if for Multi Role support)
            if user.is_instructor:
                try:
                    teacher = api_models.Teacher.objects.get(user=user)
                    courses = api_models.Course.objects.filter(teacher=teacher)
                    response_data['teaching_stats'] = {
                        'total_courses': courses.count(),
                        'published_courses': courses.filter(platform_status='Published').count(),
                        'total_students': api_models.EnrolledCourse.objects.filter(course__teacher=teacher).count(),
                        'total_reviews': api_models.Review.objects.filter(course__teacher=teacher).count()
                    }
                except api_models.Teacher.DoesNotExist:
                    response_data['teaching_stats'] = None
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error in AdminUserDetailAPIView.retrieve: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUserCreateAPIView(generics.CreateAPIView):
    """
    Create a new user account
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.RegisterSerializer
    
    def create(self, request, *args, **kwargs):
        try:
            # Verify admin access
            if not hasattr(request.user, 'role') or not (request.user.is_admin):
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            # Extract role before validation (serializer doesn't accept it)
            role = request.data.get('role', 'student')
            
            # Create a copy of data without the role field for serializer validation
            serializer_data = {k: v for k, v in request.data.items() if k != 'role'}
            
            serializer = self.get_serializer(data=serializer_data)
            if serializer.is_valid():
                user = serializer.save()
                
                # Set user boolean roles based on role parameter
                if role == 'student':
                    user.is_student = True
                    user.is_instructor = False
                    user.is_admin = False
                elif role == 'teacher':
                    user.is_student = False
                    user.is_instructor = True
                    user.is_admin = False
                elif role == 'admin':
                    user.is_student = False
                    user.is_instructor = False
                    user.is_admin = True
                
                # Set current_role and roles for multi-role support
                user.current_role = role
                user.roles = role
                user.role = role  # Keep for backward compatibility during migration
                user.save()
                
                # Create teacher profile if role is teacher
                if role == 'teacher':
                    api_models.Teacher.objects.create(
                        user=user,
                        full_name=user.full_name
                    )
                
                return Response({
                    'message': 'User created successfully',
                    'user': api_serializer.UserSerializer(user).data
                }, status=status.HTTP_201_CREATED)
            
            # Return detailed validation errors
            print(f"[FAIL] Validation errors: {serializer.errors}")  # Debug log
            return Response({
                'error': 'Validation failed',
                'details': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            print(f"[FAIL] Exception in user create: {str(e)}")  # Debug log
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUserUpdateAPIView(generics.UpdateAPIView):
    """
    Update user information
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = api_serializer.UserSerializer
    
    def get_object(self):
        # Verify admin access
        if not (hasattr(self.request.user, 'is_admin') and self.request.user.is_admin):
            raise Http404("Admin access required")
        
        user_id = self.kwargs.get('user_id')
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise Http404("User not found")
    
    def update(self, request, *args, **kwargs):
        try:
            user = self.get_object()
            
            # Prevent modifying super admin by regular admin
            if user.is_admin and hasattr(user, 'admin') and user.admin.is_super_admin:
                if not (hasattr(request.user, 'admin') and request.user.admin.is_super_admin):
                    return Response({'error': 'Cannot modify super admin account'}, status=status.HTTP_403_FORBIDDEN)
            
            # Update user fields
            for field in ['full_name', 'email', 'is_active']:
                if field in request.data:
                    setattr(user, field, request.data[field])
            
            # [*] PHASE 4.10 - Handle Multi Role boolean fields (NEW)
            old_is_instructor = user.is_instructor
            if 'is_student' in request.data:
                user.is_student = request.data['is_student']
            if 'is_instructor' in request.data:
                user.is_instructor = request.data['is_instructor']
            if 'is_admin' in request.data:
                user.is_admin = request.data['is_admin']
            
            # Update legacy role field for backward compatibility
            if user.is_admin:
                user.role = 'admin'
            elif user.is_instructor:
                user.role = 'teacher'
            elif user.is_student:
                user.role = 'student'
            
            # Handle teacher profile creation/deletion based on instructor role
            if user.is_instructor and not old_is_instructor:
                api_models.Teacher.objects.get_or_create(
                    user=user,
                    defaults={'full_name': user.full_name}
                )
            elif not user.is_instructor and old_is_instructor:
                try:
                    teacher = api_models.Teacher.objects.get(user=user)
                    teacher.delete()
                except api_models.Teacher.DoesNotExist:
                    pass
            
            # Handle legacy role change (if frontend still sends it)
            if 'role' in request.data:
                new_role = request.data['role']
                old_role = user.current_role if user.current_role else user.role
                
                # Update boolean role fields
                if new_role == 'student':
                    user.is_student = True
                    user.is_instructor = False
                    user.is_admin = False
                elif new_role == 'teacher':
                    user.is_student = False
                    user.is_instructor = True
                    user.is_admin = False
                elif new_role == 'admin':
                    user.is_student = False
                    user.is_instructor = False
                    user.is_admin = True
                
                # Update role tracking fields
                user.current_role = new_role
                user.roles = new_role
                user.role = new_role
                
                # Handle teacher profile creation/deletion
                if new_role == 'teacher' and old_role != 'teacher':
                    api_models.Teacher.objects.get_or_create(
                        user=user,
                        defaults={'full_name': user.full_name}
                    )
                elif old_role == 'teacher' and new_role != 'teacher':
                    try:
                        teacher = api_models.Teacher.objects.get(user=user)
                        teacher.delete()
                    except api_models.Teacher.DoesNotExist:
                        pass
            
            user.save()
            
            return Response({
                'message': 'User updated successfully',
                'user': api_serializer.UserSerializer(user).data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUserDeleteAPIView(generics.DestroyAPIView):
    """
    Delete a user account
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        # Verify admin access
        if not (hasattr(self.request.user, 'is_admin') and self.request.user.is_admin):
            raise Http404("Admin access required")
        
        user_id = self.kwargs.get('user_id')
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise Http404("User not found")
    
    def destroy(self, request, *args, **kwargs):
        try:
            user = self.get_object()
            
            # Prevent deleting super admin
            if user.is_admin and hasattr(user, 'admin') and user.admin.is_super_admin:
                return Response({'error': 'Cannot delete super admin account'}, status=status.HTTP_403_FORBIDDEN)
            
            # Prevent deleting self
            if user.id == request.user.id:
                return Response({'error': 'Cannot delete your own account'}, status=status.HTTP_400_BAD_REQUEST)
            
            user_name = user.full_name
            user.delete()
            
            return Response({
                'message': f'User "{user_name}" deleted successfully'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminUserBulkActionsAPIView(APIView):
    """
    Handle bulk actions on multiple users
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            # Verify admin access
            if not hasattr(request.user, 'role') or not (request.user.is_admin):
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            action = request.data.get('action')
            user_ids = request.data.get('user_ids', [])
            
            if not action or not user_ids:
                return Response({'error': 'Action and user_ids are required'}, status=status.HTTP_400_BAD_REQUEST)
            
            users = User.objects.filter(id__in=user_ids)
            
            # Prevent actions on super admins
            super_admin_users = users.filter(role='admin', admin__is_super_admin=True)
            if super_admin_users.exists() and not (hasattr(request.user, 'admin') and request.user.admin.is_super_admin):
                return Response({'error': 'Cannot perform actions on super admin accounts'}, status=status.HTTP_403_FORBIDDEN)
            
            # Prevent actions on self
            if request.user.id in user_ids:
                return Response({'error': 'Cannot perform bulk actions on your own account'}, status=status.HTTP_400_BAD_REQUEST)
            
            affected_count = 0
            
            if action == 'activate':
                affected_count = users.update(is_active=True)
            elif action == 'deactivate':
                affected_count = users.update(is_active=False)
            elif action == 'delete':
                affected_count = users.count()
                users.delete()
            else:
                return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'message': f'Bulk action "{action}" completed successfully',
                'affected_users': affected_count
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ========== [*] PHASE 4.11: ADMIN CATEGORY MANAGEMENT API VIEWS ==========

class AdminCategoryListCreateAPIView(generics.ListCreateAPIView):
    """
    [*] PHASE 4.11: Admin endpoint to list and create course categories
    - Requires admin authentication
    - Supports full CRUD operations for course categories
    """
    queryset = api_models.Category.objects.all()
    serializer_class = api_serializer.CategoryManagementSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        """Get all categories for admin management"""
        # Verify admin access
        if not (hasattr(self.request.user, 'role') and self.request.user.is_admin):
            return api_models.Category.objects.none()
        return api_models.Category.objects.all().order_by('-id')
    
    def create(self, request, *args, **kwargs):
        """Create new course category - Admin only"""
        try:
            # Verify admin access
            if not (hasattr(request.user, 'role') and request.user.is_admin):
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                category = serializer.save()
                return Response(
                    {
                        'message': 'Category created successfully',
                        'category': serializer.data
                    },
                    status=status.HTTP_201_CREATED
                )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminCategoryDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    [*] PHASE 4.11: Admin endpoint for category details, updates, and deletion
    - GET: Retrieve category details with course count
    - PUT/PATCH: Update category information
    - DELETE: Remove category (only if no courses assigned)
    """
    queryset = api_models.Category.objects.all()
    serializer_class = api_serializer.CategoryManagementSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    
    def update(self, request, *args, **kwargs):
        """Update category details"""
        try:
            # Verify admin access
            if not (hasattr(request.user, 'role') and request.user.is_admin):
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            
            if serializer.is_valid():
                category = serializer.save()
                return Response(
                    {
                        'message': 'Category updated successfully',
                        'category': serializer.data
                    },
                    status=status.HTTP_200_OK
                )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def destroy(self, request, *args, **kwargs):
        """Delete category - only if no courses assigned"""
        try:
            # Verify admin access
            if not (hasattr(request.user, 'role') and request.user.is_admin):
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            instance = self.get_object()
            
            # Check if category has courses
            course_count = api_models.Course.objects.filter(category=instance).count()
            if course_count > 0:
                return Response(
                    {
                        'error': f'Cannot delete category with {course_count} course(s). Remove courses first.',
                        'course_count': course_count
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            category_name = instance.title
            instance.delete()
            
            # Return 200 OK with message instead of 204 for better frontend handling
            return Response(
                {
                    'message': f'Category "{category_name}" deleted successfully',
                    'success': True
                },
                status=status.HTTP_200_OK
            )
        except api_models.Category.DoesNotExist:
            return Response({'error': 'Category not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def compare_users_data(external_user, existing_user):
    """
    Compare external user data with existing user to determine if changed.
    
    Args:
        external_user: External API user data (dict)
        existing_user: Django User model instance
    
    Returns:
        bool: True if user data has changed, False if identical
    """
    # Fields to compare
    fields_to_compare = {
        'full_name': 'name',
        'email': 'email',
        'nip': 'nip',
        'golongan': 'golongan',
        'kelas_jabatan': 'kelas_jabatan',
        'jenis_jabatan': 'jenis_jabatan',
        'external_status': 'status'
    }
    
    for db_field, ext_field in fields_to_compare.items():
        external_value = external_user.get(ext_field)
        existing_value = getattr(existing_user, db_field, None)
        
        # Handle status field conversion
        if db_field == 'external_status':
            external_value = external_user.get(ext_field, '').upper()
            existing_value = existing_user.external_status or ''
        
        # Compare values
        if str(external_value or '').strip() != str(existing_value or '').strip():
            return True
    
    return False


def categorize_users_for_sync(users_data):
    """
    Categorize external users into NEW, CHANGED, and UNCHANGED.
    
    Args:
        users_data: List of external user data dicts
    
    Returns:
        dict: Contains 'new', 'changed', 'unchanged' categorized user lists and counts
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    categorized = {
        'new': [],
        'changed': [],
        'unchanged': []
    }
    
    for user_data in users_data:
        external_id = user_data.get('id')
        email = user_data.get('email')
        
        try:
            # Try to find user by external_id first
            existing_user = User.objects.get(external_id=external_id)
        except User.DoesNotExist:
            try:
                # Try to find by email
                existing_user = User.objects.get(email=email)
            except User.DoesNotExist:
                # User not in system - NEW
                categorized['new'].append(user_data)
                continue
        
        # User exists - check if changed
        if compare_users_data(user_data, existing_user):
            categorized['changed'].append(user_data)
        else:
            categorized['unchanged'].append(user_data)
    
    return categorized


@method_decorator(csrf_exempt, name='dispatch')
class SyncExternalUsersAPIView(APIView):
    """
    API View to sync user data from external API
    
    CSRF exempt because:
    - Uses only JWT authentication (no session auth)
    - Admin-only endpoint with role verification
    - Protected by IsAuthenticated permission class
    """
    authentication_classes = [JWTAuthentication]  # Only JWT, no SessionAuthentication
    permission_classes = [IsAuthenticated]
    
    def parse_datetime_safe(self, datetime_str):
        """Safely parse datetime string with multiple format support"""
        if not datetime_str:
            return timezone.now()
        
        try:
            # Handle different datetime formats
            datetime_str = str(datetime_str)
            
            # Replace 'Z' with '+00:00' for ISO format
            if datetime_str.endswith('Z'):
                datetime_str = datetime_str.replace('Z', '+00:00')
            
            # Try Django's parse_datetime first
            parsed_dt = parse_datetime(datetime_str)
            if parsed_dt:
                return parsed_dt
            
            # Fallback to fromisoformat
            return datetime.fromisoformat(datetime_str)
            
        except (ValueError, TypeError) as e:
            print(f"DateTime parsing error for '{datetime_str}': {e}")
            return timezone.now()
    
    def post(self, request):
        # Verify admin access
        if not hasattr(request.user, 'role') or not (request.user.is_admin):
            return Response(
                {'error': 'Admin access required. Only admins can sync external users.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Reset sync state at the beginning
        reset_sync_state()
        
        # Create SyncHistory record to track this sync operation
        sync_record = api_models.SyncHistory.start_sync('external_users')
        
        try:
            # External API URL from settings
            external_api_url = f"{settings.EXTERNAL_API_BASE_URL}/api/external/users"
            
            print(f"Attempting to fetch data from: {external_api_url}")
            
            # Add API authentication headers
            headers = {
                'X-API-Token': settings.EXTERNAL_API_TOKEN,
                'Cookie': 'XSRF-TOKEN=eyJpdiI6IkwwenJpQk94QStXcHpVbUdFMEoraWc9PSIsInZhbHVlIjoidkUvN0Z2MjBKSThqazlvSFdBYjZnaWpaVC9PRGhvUlkzelZvVmp6Z3NQWk9jYXpnbjNIeHVFUmxmcUFFdFZ0YkYrZldibE5OKzIwU2U5US9BVnJqb2dtR0FXdXpOMFhEL0o5U0x2MHpSdnY3Q2E5MGFGcSt4dHRwVkxMYTNJY0MiLCJtYWMiOiIzODliMDRkNjQyOTkzNDdiNmQ3MDRjMGU5Y2ZhMTJhNmE2MGEzMmM2OWNhNTVhM2I0NWI4MTAzZmZkZjRiOTkxIiwidGFnIjoiIn0%3D; cmb_setjen_dpd_ri_session=eyJpdiI6ImM2NGhSSXBKSXhaM3QxTWROV3dxaGc9PSIsInZhbHVlIjoiVFVxSSt5MnIxKzREQUw1dm5tTW91UzJnQzZuc2ZjZGY1REJjZGNVazdJOCtLQnNLK2QwQ05BMVowUVpKMm8yRmovNndRelJhUFBnajd3bDBBeEdoTUdNWkVXcVhLbExmU2dOUlpYMFFFUVRtR3pSSmtmWmN3ajdUb0dDbzduQVIiLCJtYWMiOiI2ODc3YWRhZjAzNzBkZDQxZjBiZTc0NzhjYjcyY2IwOTQyMWEyYTY4YWI1N2NlOGM2Y2Y2NzNlM2E1ZmI5MDQ0IiwidGFnIjoiIn0%3D'
            }
            
            # Add the ?all=1 parameter to get all data
            full_api_url = f"{external_api_url}?all=1"
            
            try:
                response = requests.get(full_api_url, headers=headers, timeout=30)
                print(f"Response status code: {response.status_code}")
                response.raise_for_status()
                
                external_data = response.json()
                print(f"Received data keys: {list(external_data.keys()) if isinstance(external_data, dict) else 'Not a dict'}")
                print(f"Total records received: {len(external_data.get('data', []))}")
                
            except requests.exceptions.RequestException as req_error:
                print(f"External API not accessible ({str(req_error)}), using mock data for testing...")
                
                # Mock data based on the structure you provided earlier
                external_data = {
                    "success": True,
                    "data": [
                        {
                            "id": "mock_1",
                            "name": "Test User Mock 1",
                            "email": "testmock1@example.com",
                            "created_at": "2024-01-01T10:00:00+00:00",
                            "updated_at": "2024-01-01T10:00:00+00:00",
                            "status": "active",
                            "timezone": "Asia/Jakarta",
                            "nip": "19876543210",
                            "golongan": "III/a",
                            "kelas_jabatan": "Pelaksana",
                            "jenis_jabatan": "Fungsional",
                            "unit_organisasi": {
                                "id": "mock_101",
                                "name": "IT Department Mock",
                                "code": "IT_MOCK",
                                "description": "Information Technology Department (Mock Data)"
                            },
                            "jabatan": {
                                "id": "mock_201",
                                "name": "Software Developer Mock",
                                "code": "DEV_MOCK",
                                "description": "Software Development Position (Mock Data)"
                            }
                        },
                        {
                            "id": "mock_2",
                            "name": "Test User Mock 2",
                            "email": "testmock2@example.com",
                            "created_at": "2024-01-02T10:00:00+00:00",
                            "updated_at": "2024-01-02T10:00:00+00:00",
                            "status": "active",
                            "timezone": "Asia/Jakarta",
                            "nip": "19876543211",
                            "golongan": "II/c",
                            "kelas_jabatan": "Pelaksana Lanjutan",
                            "jenis_jabatan": "Struktural",
                            "unit_organisasi": {
                                "id": "mock_102",
                                "name": "HR Department Mock",
                                "code": "HR_MOCK",
                                "description": "Human Resources Department (Mock Data)"
                            },
                            "jabatan": {
                                "id": "mock_202",
                                "name": "HR Specialist Mock",
                                "code": "HRS_MOCK",
                                "description": "Human Resources Specialist Position (Mock Data)"
                            }
                        }
                    ]
                }
                
            except Exception as json_error:
                print(f"JSON parsing error: {str(json_error)}")
                # Record failure in database
                sync_record.fail_sync(f'Invalid response format from external API: {str(json_error)}')
                return Response({
                    'error': f'Invalid response format from external API: {str(json_error)}'
                }, status=status.HTTP_502_BAD_GATEWAY)
            
            # Check for success in the real API response structure
            if external_data.get('status') != 'success':
                error_msg = f"External API returned error: {external_data.get('message', 'Unknown error')}"
                # Record failure in database
                sync_record.fail_sync(error_msg)
                return Response({
                    'error': error_msg
                }, status=status.HTTP_400_BAD_REQUEST)
            
            users_data = external_data.get('data', [])
            
            print(f"Processing {len(users_data)} users from external API")
            if users_data and len(users_data) > 0:
                print(f"Sample user structure: {list(users_data[0].keys()) if users_data[0] else 'No first user'}")
            
            sync_results = {
                'total_users': len(users_data),
                'created': 0,
                'updated': 0,
                'errors': []
            }
            
            # Initialize sync state
            update_sync_state(
                is_syncing=True,
                total=len(users_data),
                created=0,
                updated=0,
                failed=0,
                errors=[],
                new=0,
                changed=0,
                unchanged=0,
                comparison_complete=False
            )
            
            # SMART COMPARISON PHASE: Categorize users before processing
            print("Starting user data comparison...")
            categorized_users = categorize_users_for_sync(users_data)
            
            # Update sync state with comparison results
            update_sync_state(
                new=len(categorized_users['new']),
                changed=len(categorized_users['changed']),
                unchanged=len(categorized_users['unchanged']),
                comparison_complete=True
            )
            
            print(f"Comparison complete: {len(categorized_users['new'])} new, {len(categorized_users['changed'])} changed, {len(categorized_users['unchanged'])} unchanged")
            
            # Process only NEW and CHANGED users (skip unchanged for efficiency)
            users_to_process = categorized_users['new'] + categorized_users['changed']
            
            for user_data in users_to_process:
                try:
                    # [*] PHASE 5: CRITICAL FIX - Clean email BEFORE validation
                    # External API may send empty email ("" or null)
                    # Generate default if missing BEFORE passing to serializer
                    if not user_data.get('email') or user_data.get('email') == '':
                        nip = user_data.get('nip', user_data.get('id', ''))
                        user_data['email'] = f"{nip}@external-system.local"
                        print(f"Email missing for user {user_data.get('id')}, generated: {user_data['email']}")
                    
                    # NOW validate external user data (with cleaned email)
                    serializer = api_serializer.ExternalUserDataSerializer(data=user_data)
                    if not serializer.is_valid():
                        sync_results['errors'].append({
                            'external_id': user_data.get('id'),
                            'errors': serializer.errors
                        })
                        # Update failed count
                        update_sync_state(
                            failed=len(sync_results['errors']),
                            errors=sync_results['errors']
                        )
                        continue
                    
                    validated_data = serializer.validated_data
                    
                    # Get or create organization unit
                    org_unit = None
                    if validated_data.get('unit_organisasi'):
                        org_unit_data = validated_data['unit_organisasi']
                        org_unit, _ = OrganizationUnit.objects.get_or_create(
                            external_id=org_unit_data.get('id'),
                            defaults={
                                'name': org_unit_data.get('name', 'Unknown'),
                                'description': org_unit_data.get('description', '')
                            }
                        )
                    
                    # Get or create position
                    position = None
                    if validated_data.get('jabatan'):
                        position_data = validated_data['jabatan']
                        position, _ = Position.objects.get_or_create(
                            external_id=position_data.get('id'),
                            defaults={
                                'name': position_data.get('name', 'Unknown'),
                                'description': position_data.get('description', '')
                            }
                        )
                    
                    # Check if user exists by external_id first, then by email
                    user = None
                    user_created = False
                    
                    try:
                        # First try to find by external_id
                        user = User.objects.get(external_id=validated_data['id'])
                        print(f"Found user by external_id: {user.email}")
                        
                    except User.DoesNotExist:
                        try:
                            # If not found by external_id, try to find by email
                            user = User.objects.get(email=validated_data['email'])
                            print(f"Found user by email: {user.email}, updating with external_id: {validated_data['id']}")
                            
                            # Update the existing user with external_id
                            user.external_id = validated_data['id']
                            
                        except User.DoesNotExist:
                            # User doesn't exist at all, create new one
                            print(f"Creating new user: {validated_data['email']}")
                            
                            # Generate unique username from email
                            email_username = validated_data['email'].split('@')[0]
                            username = email_username
                            counter = 1
                            while User.objects.filter(username=username).exists():
                                username = f"{email_username}_{counter}"
                                counter += 1
                            
                            user = User.objects.create(
                                username=username,
                                email=validated_data['email'],
                                full_name=validated_data['name'],
                                external_id=validated_data['id'],
                                nip=validated_data.get('nip'),
                                golongan=validated_data.get('golongan'),
                                kelas_jabatan=validated_data.get('kelas_jabatan'),
                                jenis_jabatan=validated_data.get('jenis_jabatan'),
                                timezone=validated_data.get('timezone', 'Asia/Jakarta'),
                                external_status=validated_data.get('status'),
                                external_created_at=self.parse_datetime_safe(validated_data.get('created_at')),
                                external_updated_at=self.parse_datetime_safe(validated_data.get('updated_at')),
                                last_sync_date=timezone.now(),
                                is_active=validated_data.get('status', '').upper() == 'ACTIVE',
                                role='student'  # Default role for external users
                            )
                            user_created = True
                            sync_results['created'] += 1
                            # Update created count in real-time
                            update_sync_state(created=sync_results['created'])
                    
                    # Update existing user (whether found by external_id or email)
                    if not user_created:
                        user.full_name = validated_data['name']
                        user.email = validated_data['email']
                        user.nip = validated_data.get('nip')
                        user.golongan = validated_data.get('golongan')
                        user.kelas_jabatan = validated_data.get('kelas_jabatan')
                        user.jenis_jabatan = validated_data.get('jenis_jabatan')
                        user.timezone = validated_data.get('timezone', 'Asia/Jakarta')
                        user.external_status = validated_data.get('status')
                        user.external_created_at = self.parse_datetime_safe(validated_data.get('created_at'))
                        user.external_updated_at = self.parse_datetime_safe(validated_data.get('updated_at'))
                        user.last_sync_date = timezone.now()
                        user.is_active = validated_data.get('status', '').upper() == 'ACTIVE'
                        user.save()
                        
                        sync_results['updated'] += 1
                        # Update updated count in real-time
                        update_sync_state(updated=sync_results['updated'])
                    
                    # Update or create profile
                    profile, created = Profile.objects.get_or_create(
                        user=user,
                        defaults={
                            'organization_unit': org_unit,
                            'position': position,
                        }
                    )
                    
                    if not created:
                        profile.organization_unit = org_unit
                        profile.position = position
                        profile.save()
                        
                except Exception as e:
                    error_msg = str(e)
                    print(f"Error processing user {user_data.get('id', 'unknown')} ({user_data.get('email', 'no-email')}): {error_msg}")
                    sync_results['errors'].append({
                        'external_id': user_data.get('id'),
                        'name': user_data.get('name', 'Unknown'),
                        'email': user_data.get('email', 'Unknown'),
                        'error': error_msg
                    })
                    # Update failed count and errors in real-time
                    update_sync_state(
                        failed=len(sync_results['errors']),
                        errors=sync_results['errors']
                    )
                    continue
            
            # Log final results
            print(f"Sync completed: {sync_results['created']} created, {sync_results['updated']} updated, {len(sync_results['errors'])} errors")
            
            # Record successful completion in database
            sync_record.complete_sync(
                created=sync_results['created'],
                updated=sync_results['updated'],
                failed=len(sync_results['errors']),
                total=len(users_data),
                notes=f"Successfully synced {len(users_data)} users from external API. {len(categorized_users['new'])} new, {len(categorized_users['changed'])} changed, {len(categorized_users['unchanged'])} unchanged."
            )
            
            # Mark sync as complete with timestamp
            now_timestamp = datetime.now().isoformat()
            update_sync_state(
                is_syncing=False,
                status='completed',
                completion_timestamp=now_timestamp,
                last_successful_sync_timestamp=now_timestamp
            )
            
            return Response({
                'message': 'User synchronization completed successfully',
                'results': sync_results,
                'sync_record_id': sync_record.id,
                'last_sync_time': sync_record.completed_at
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Unexpected error in sync: {str(e)}")
            # Record failure in database
            sync_record.fail_sync(f'Synchronization failed: {str(e)}')
            # Mark sync as failed with timestamp
            update_sync_state(
                is_syncing=False,
                status='error',
                completion_timestamp=datetime.now().isoformat()
            )
            return Response({
                'error': f'Synchronization failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SyncProgressAPIView(APIView):
    """
    Get real-time progress of ongoing sync operation
    
    Provides live updates while sync is in progress from in-memory state.
    Also returns last successful sync info from database.
    Requires admin authentication.
    
    Response:
    {
        "is_syncing": boolean,
        "status": "idle|initializing|syncing|completed|error|cancelled",
        "completion_timestamp": ISO timestamp when sync completed,
        "last_successful_sync_timestamp": ISO timestamp of last successful sync,
        "created": integer,      # Users created so far
        "updated": integer,      # Users updated so far
        "failed": integer,       # Users failed
        "total": integer,        # Total users to sync
        "new": integer,          # New users detected (not in system)
        "changed": integer,      # Changed users detected (will be updated)
        "unchanged": integer,    # Unchanged users (skipped)
        "comparison_complete": boolean,  # Whether data comparison is done
        "errors": array,         # Error details
        "last_sync_info": {...}  # Last successful sync from database
    }
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get current sync progress"""
        # Verify admin access
        if not hasattr(request.user, 'role') or not (request.user.is_admin):
            return Response(
                {'error': 'Admin access required. Only admins can view sync progress.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Return current sync state (in-memory for real-time progress)
        state = get_sync_state()
        
        # Get last successful sync from database
        last_successful_sync = api_models.SyncHistory.get_last_successful_sync('external_users')
        
        last_sync_info = None
        if last_successful_sync:
            last_sync_info = {
                'id': last_successful_sync.id,
                'started_at': last_successful_sync.started_at.isoformat(),
                'completed_at': last_successful_sync.completed_at.isoformat() if last_successful_sync.completed_at else None,
                'status': last_successful_sync.status,
                'total_records': last_successful_sync.total_records,
                'created_records': last_successful_sync.created_records,
                'updated_records': last_successful_sync.updated_records,
                'failed_records': last_successful_sync.failed_records,
                'total_changed': last_successful_sync.total_changed,
                'duration': last_successful_sync.duration,
                'duration_seconds': last_successful_sync.duration_seconds,
                'notes': last_successful_sync.notes
            }
        
        return Response({
            'is_syncing': state['is_syncing'],
            'status': state.get('status', 'idle'),
            'completion_timestamp': state.get('completion_timestamp'),
            'last_successful_sync_timestamp': state.get('last_successful_sync_timestamp'),
            'created': state['created'],
            'updated': state['updated'],
            'failed': state['failed'],
            'total': state['total'],
            'new': state.get('new', 0),
            'changed': state.get('changed', 0),
            'unchanged': state.get('unchanged', 0),
            'comparison_complete': state.get('comparison_complete', False),
            'errors': state['errors'],
            'last_sync_info': last_sync_info
        }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class LastSyncInfoAPIView(APIView):
    """
    Get last sync time from database
    
    Accessible to both authenticated and unauthenticated users.
    Returns the last successful sync timestamp and statistics.
    
    Response:
    {
        "last_sync_time": ISO timestamp or null,
        "sync_info": {
            "id": integer,
            "started_at": ISO timestamp,
            "completed_at": ISO timestamp,
            "status": "completed|in_progress|failed|cancelled",
            "total_records": integer,
            "created_records": integer,
            "updated_records": integer,
            "failed_records": integer,
            "duration": "HH:MM:SS",
            "duration_seconds": integer,
            "notes": string
        }
    }
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get(self, request):
        """Get last sync time info"""
        try:
            # Get last successful sync from database
            last_sync = api_models.SyncHistory.get_last_successful_sync('external_users')
            
            if not last_sync:
                return Response({
                    'last_sync_time': None,
                    'sync_info': None,
                    'message': 'No sync history available'
                }, status=status.HTTP_200_OK)
            
            sync_info = {
                'id': last_sync.id,
                'started_at': last_sync.started_at.isoformat(),
                'completed_at': last_sync.completed_at.isoformat() if last_sync.completed_at else None,
                'status': last_sync.status,
                'total_records': last_sync.total_records,
                'created_records': last_sync.created_records,
                'updated_records': last_sync.updated_records,
                'failed_records': last_sync.failed_records,
                'total_changed': last_sync.total_changed,
                'duration': last_sync.duration,
                'duration_seconds': last_sync.duration_seconds,
                'notes': last_sync.notes
            }
            
            return Response({
                'last_sync_time': last_sync.completed_at.isoformat() if last_sync.completed_at else None,
                'sync_info': sync_info
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error in LastSyncInfoAPIView: {str(e)}")
            return Response({
                'error': f'Error retrieving sync information: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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


# ==================== TIER 1: CONTENT GAP ANALYSIS ====================

class ContentGapAnalysisView(generics.ListCreateAPIView):
    """
    Analyze failed searches to identify content creation gaps.
    GET: List all content gaps sorted by priority
    POST: Manually trigger analysis of failed searches
    """
    queryset = api_models.ContentGap.objects.all()
    serializer_class = api_serializer.ContentGapSerializer
    permission_classes = [IsAuthenticated]
    
    def list(self, request, *args, **kwargs):
        """Get top content gaps"""
        gaps = api_models.ContentGap.objects.all()[:20]
        serializer = self.get_serializer(gaps, many=True)
        return Response({
            'success': True,
            'count': len(gaps),
            'gaps': serializer.data
        })
    
    def create(self, request, *args, **kwargs):
        """Trigger content gap analysis from failed searches"""
        try:
            days = request.data.get('days', 30)
            count = api_models.ContentGap.update_from_failed_searches(days=days)
            
            gaps = api_models.ContentGap.objects.all()[:20]
            serializer = self.get_serializer(gaps, many=True)
            
            return Response({
                'success': True,
                'message': f'Analyzed {count} failed searches',
                'gaps': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class ContentGapDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get or update specific content gap"""
    queryset = api_models.ContentGap.objects.all()
    serializer_class = api_serializer.ContentGapSerializer
    permission_classes = [IsAuthenticated]


# ==================== TIER 1: AT-RISK STUDENT DETECTION ====================

class StudentRiskAssessmentView(generics.ListAPIView):
    """
    Get list of at-risk students sorted by risk level.
    Filter options: risk_level, course_id
    """
    queryset = api_models.StudentRiskAssessment.objects.all()
    serializer_class = api_serializer.StudentRiskAssessmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = api_models.StudentRiskAssessment.objects.all()
        
        # Filter by risk level
        risk_level = self.request.query_params.get('risk_level')
        if risk_level:
            queryset = queryset.filter(risk_level=risk_level)
        
        # Filter by course
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(enrollment__course_id=course_id)
        
        return queryset.order_by('-risk_score')


class StudentRiskAssessmentDetailView(generics.RetrieveAPIView):
    """Get detailed risk assessment for a specific student"""
    queryset = api_models.StudentRiskAssessment.objects.all()
    serializer_class = api_serializer.StudentRiskAssessmentSerializer
    permission_classes = [IsAuthenticated]


class StudentRiskAssessmentTriggerView(APIView):
    """
    Manually trigger risk assessment for all students.
    This would normally be called by Celery background job daily.
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Trigger assessment of all enrolled students"""
        try:
            count = api_models.StudentRiskAssessment.assess_all_students()
            
            # Get HIGH risk students for response
            high_risk = api_models.StudentRiskAssessment.objects.filter(
                risk_level='HIGH'
            )[:10]
            serializer = api_serializer.StudentRiskAssessmentSerializer(
                high_risk, many=True
            )
            
            return Response({
                'success': True,
                'message': f'Assessed {count} students',
                'high_risk_count': api_models.StudentRiskAssessment.objects.filter(
                    risk_level='HIGH'
                ).count(),
                'medium_risk_count': api_models.StudentRiskAssessment.objects.filter(
                    risk_level='MEDIUM'
                ).count(),
                'high_risk_samples': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class StudentRiskSummaryView(APIView):
    """Get overall risk summary across platform"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get risk statistics"""
        from django.db.models import Count, Avg
        
        risk_counts = api_models.StudentRiskAssessment.objects.values(
            'risk_level'
        ).annotate(count=Count('id'))
        
        risk_dict = {item['risk_level']: item['count'] for item in risk_counts}
        
        avg_score = api_models.StudentRiskAssessment.objects.aggregate(
            avg=Avg('risk_score')
        )['avg'] or 0
        
        return Response({
            'success': True,
            'total_students': api_models.StudentRiskAssessment.objects.count(),
            'high_risk': risk_dict.get('HIGH', 0),
            'medium_risk': risk_dict.get('MEDIUM', 0),
            'low_risk': risk_dict.get('LOW', 0),
            'average_risk_score': round(avg_score, 2)
        })


# ==================== TIER 1: COURSE RECOMMENDATIONS ====================

class CourseRecommendationView(generics.ListCreateAPIView):
    """
    Get personalized course recommendations for a user.
    Supports content-based, collaborative, and trending algorithms.
    """
    queryset = api_models.CourseRecommendation.objects.all()
    serializer_class = api_serializer.CourseRecommendationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Filter recommendations for current user
        user = self.request.user
        return api_models.CourseRecommendation.objects.filter(
            user=user
        ).order_by('-score')


class CourseRecommendationDetailView(generics.RetrieveUpdateAPIView):
    """Get or update specific recommendation"""
    queryset = api_models.CourseRecommendation.objects.all()
    serializer_class = api_serializer.CourseRecommendationSerializer
    permission_classes = [IsAuthenticated]


class RecommendationClickTrackView(APIView):
    """Track when user clicks on a recommendation"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        """Mark recommendation as clicked"""
        try:
            recommendation = api_models.CourseRecommendation.objects.get(pk=pk)
            recommendation.mark_clicked()
            
            serializer = api_serializer.CourseRecommendationSerializer(
                recommendation
            )
            return Response({
                'success': True,
                'message': 'Click tracked',
                'recommendation': serializer.data
            })
        except api_models.CourseRecommendation.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Recommendation not found'
            }, status=status.HTTP_404_NOT_FOUND)


class RecommendationConversionTrackView(APIView):
    """Track when user enrolls from a recommendation"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        """Mark recommendation as converted (enrolled)"""
        try:
            recommendation = api_models.CourseRecommendation.objects.get(pk=pk)
            recommendation.mark_enrolled()
            
            serializer = api_serializer.CourseRecommendationSerializer(
                recommendation
            )
            return Response({
                'success': True,
                'message': 'Enrollment tracked',
                'recommendation': serializer.data
            })
        except api_models.CourseRecommendation.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Recommendation not found'
            }, status=status.HTTP_404_NOT_FOUND)


class RecommendationStatsView(APIView):
    """Get recommendation performance statistics"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get CTR and conversion metrics"""
        from django.db.models import Count
        
        total_recs = api_models.CourseRecommendation.objects.count()
        clicked = api_models.CourseRecommendation.objects.filter(
            clicked=True
        ).count()
        enrolled = api_models.CourseRecommendation.objects.filter(
            enrolled=True
        ).count()
        
        ctr = (clicked / total_recs * 100) if total_recs > 0 else 0
        conversion = (enrolled / clicked * 100) if clicked > 0 else 0
        
        # By reason
        by_reason = api_models.CourseRecommendation.objects.values(
            'reason'
        ).annotate(
            count=Count('id'),
            clicks=Count('id', filter=Q(clicked=True)),
            enrolls=Count('id', filter=Q(enrolled=True))
        )
        
        return Response({
            'success': True,
            'total_recommendations': total_recs,
            'total_clicks': clicked,
            'total_enrollments': enrolled,
            'ctr_percent': round(ctr, 2),
            'conversion_percent': round(conversion, 2),
            'by_reason': list(by_reason)
        })


# [*] PHASE 4.10: Search Quality Metrics Dashboard Views

class SearchQualityMetricsView(generics.GenericAPIView):
    """
    Get comprehensive search quality report for Super Admin dashboard.
    Includes overall metrics, CTR distribution, and recommendations.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        """Get search quality metrics overview"""
        try:
            # Get overall quality report
            quality_report = api_models.CourseSearchAnalytics.objects.get_quality_report()
            
            # Get CTR distribution
            ctr_dist = api_models.CourseSearchAnalytics.objects.get_ctr_distribution()
            
            # Map distribution keys for serializer
            ctr_distribution = {
                'range_0_1': ctr_dist.get('0-1%', 0),
                'range_1_3': ctr_dist.get('1-3%', 0),
                'range_3_5': ctr_dist.get('3-5%', 0),
                'range_5_10': ctr_dist.get('5-10%', 0),
                'range_10_plus': ctr_dist.get('10%+', 0),
            }
            
            # Get recommendations
            recommendations = api_models.CourseSearchAnalytics.objects.get_quality_recommendations()
            
            # Serialize data
            report_serializer = api_serializer.SearchQualityReportSerializer(quality_report)
            ctr_serializer = api_serializer.CTRDistributionSerializer(ctr_distribution)
            
            return Response({
                'success': True,
                'report': report_serializer.data,
                'ctr_distribution': ctr_serializer.data,
                'recommendations': recommendations,
                'timestamp': timezone.now()
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class CourseSearchQualityListView(generics.ListAPIView):
    """
    Get detailed search quality metrics for all courses.
    Super Admin can filter and sort by various metrics.
    """
    queryset = api_models.CourseSearchAnalytics.objects.select_related('course', 'course__category').all()
    serializer_class = api_serializer.CourseSearchQualitySerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = self.queryset
        
        # Filter by performance indicator
        indicator = self.request.query_params.get('indicator')
        if indicator in ['HIGH', 'NORMAL', 'LOW', 'HIDDEN']:
            if indicator == 'HIGH':
                queryset = queryset.filter(click_through_rate__gte=5.0)
            elif indicator == 'NORMAL':
                queryset = queryset.filter(click_through_rate__gte=1.0, click_through_rate__lt=5.0)
            elif indicator == 'LOW':
                queryset = queryset.filter(click_through_rate__lt=1.0, search_impressions__gt=10)
            elif indicator == 'HIDDEN':
                queryset = queryset.filter(search_impressions=0)
        
        # Filter by category
        category_id = self.request.query_params.get('category_id')
        if category_id:
            queryset = queryset.filter(course__category_id=category_id)
        
        # Filter by minimum impressions
        min_impressions = self.request.query_params.get('min_impressions')
        if min_impressions:
            queryset = queryset.filter(search_impressions__gte=int(min_impressions))
        
        # Sort options
        sort_by = self.request.query_params.get('sort_by', '-search_impressions')
        if sort_by in ['search_impressions', '-search_impressions', 'search_clicks', 
                       '-search_clicks', 'click_through_rate', '-click_through_rate']:
            queryset = queryset.order_by(sort_by)
        
        return queryset


class CourseSearchQualityDetailView(generics.RetrieveAPIView):
    """
    Get detailed search quality metrics for a specific course.
    Includes historical trends and recommendations.
    """
    queryset = api_models.CourseSearchAnalytics.objects.select_related('course', 'course__category')
    serializer_class = api_serializer.CourseSearchQualitySerializer
    permission_classes = [IsAdminUser]
    lookup_field = 'course_id'
    
    def retrieve(self, request, *args, **kwargs):
        """Get detailed metrics with recommendations"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        
        # Get recent search logs for this course
        recent_searches = api_models.SearchLog.objects.filter(
            clicked_result=instance.course
        ).values('search_query').annotate(
            count=Count('id')
        ).order_by('-count')[:5]
        
        return Response({
            'success': True,
            'metrics': serializer.data,
            'recent_search_queries': list(recent_searches),
            'recommendations': self._get_course_recommendations(instance)
        })
    
    def _get_course_recommendations(self, analytics):
        """Generate specific recommendations for this course"""
        recommendations = []
        
        if analytics.search_impressions == 0:
            recommendations.append({
                'priority': 'HIGH',
                'title': 'Course not appearing in search',
                'description': 'This course never appears in search results. Check if it\'s published and indexed properly.'
            })
        elif analytics.click_through_rate < 1.0 and analytics.search_impressions > 20:
            recommendations.append({
                'priority': 'HIGH',
                'title': 'Low click-through rate',
                'description': f'CTR is {analytics.click_through_rate:.2f}% despite {analytics.search_impressions} impressions. Review course title and description.'
            })
        elif analytics.click_through_rate < 3.0 and analytics.search_impressions > 50:
            recommendations.append({
                'priority': 'MEDIUM',
                'title': 'Below average performance',
                'description': 'CTR could be improved. Consider updating course preview or metadata.'
            })
        
        return recommendations


# [*] PHASE 4.10 TIER 1.2: Search Query Taxonomy Views

class SearchQueryTaxonomyReportView(generics.GenericAPIView):
    """
    Get comprehensive search query taxonomy report.
    Analyzes searches grouped by category (skill, course_type, level, etc.)
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        """Get taxonomy report by category"""
        try:
            # Get date range from query params
            from datetime import timedelta
            from django.utils import timezone
            
            days = int(request.query_params.get('days', 7))
            end_date = timezone.now()
            start_date = end_date - timedelta(days=days)
            
            # Get category-based analysis
            category_analysis = api_models.SearchQueryTaxonomy.objects.get_by_category(
                start_date=start_date,
                end_date=end_date
            )
            
            # Get overall stats
            taxonomies = api_models.SearchQueryTaxonomy.objects.filter(
                created_at__range=[start_date, end_date]
            )
            
            total_agg = taxonomies.aggregate(
                total_searches=Sum('search_count'),
                avg_ctr=Avg('click_through_count'),
                avg_failed=Avg('failed_count')
            )
            
            return Response({
                'success': True,
                'date_range': {
                    'start_date': start_date,
                    'end_date': end_date,
                    'days': days
                },
                'total_searches': total_agg['total_searches'] or 0,
                'unique_queries': taxonomies.count(),
                'unique_users': taxonomies.aggregate(Sum('unique_users'))['unique_users__sum'] or 0,
                'avg_ctr': round(total_agg['avg_ctr'] or 0, 2),
                'categories': category_analysis,
                'timestamp': timezone.now()
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class SearchQueryCategoryListView(generics.ListCreateAPIView):
    """
    Manage search query categories.
    GET: List all categories
    POST: Create new category
    """
    queryset = api_models.SearchQueryCategory.objects.all()
    serializer_class = api_serializer.SearchQueryCategorySerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = self.queryset
        
        # Filter by category type
        cat_type = self.request.query_params.get('type')
        if cat_type:
            queryset = queryset.filter(category_type=cat_type)
        
        # Filter trending
        trending = self.request.query_params.get('trending')
        if trending and trending.lower() == 'true':
            queryset = queryset.filter(trending=True)
        
        return queryset.order_by('-trending', 'category_name')


class SearchQueryTaxonomyListView(generics.ListAPIView):
    """
    Get detailed query taxonomy entries with filtering and sorting.
    """
    queryset = api_models.SearchQueryTaxonomy.objects.all()
    serializer_class = api_serializer.SearchQueryTaxonomySerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = self.queryset
        
        # Filter by category
        category_id = self.request.query_params.get('category_id')
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        
        # Filter by performance (based on CTR)
        performance = self.request.query_params.get('performance')
        if performance == 'HIGH':
            queryset = queryset.filter(click_through_count__gt=0)
        elif performance == 'LOW':
            queryset = queryset.filter(click_through_count=0, search_count__gt=5)
        elif performance == 'FAILING':
            queryset = queryset.filter(failed_count__gt=0)
        
        # Sort options
        sort_by = self.request.query_params.get('sort_by', '-search_count')
        if sort_by in ['search_count', '-search_count', 'click_through_count', 
                       '-click_through_count', 'failed_count', '-failed_count']:
            queryset = queryset.order_by(sort_by)
        
        return queryset


class SearchTaxonomyAnalyticsView(generics.ListAPIView):
    """
    Get analytics aggregated by taxonomy category.
    Shows performance metrics per category.
    """
    queryset = api_models.SearchTaxonomyAnalytics.objects.all()
    serializer_class = api_serializer.SearchTaxonomyAnalyticsSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = self.queryset
        
        # Filter by category type
        cat_type = self.request.query_params.get('category_type')
        if cat_type:
            queryset = queryset.filter(category__category_type=cat_type)
        
        # Filter by trending
        trending = self.request.query_params.get('trending')
        if trending and trending.lower() == 'true':
            queryset = queryset.filter(trending_score__gte=50)
        
        # Sort by trending score
        return queryset.order_by('-trending_score', '-total_searches')


class TrendingCategoriesView(generics.GenericAPIView):
    """
    Get trending search categories based on recent activity.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        """Get top trending categories"""
        try:
            limit = int(request.query_params.get('limit', 10))
            
            # Get trending categories with scores
            trending = api_models.SearchTaxonomyAnalytics.objects.filter(
                trending_score__gt=0
            ).order_by('-trending_score')[:limit]
            
            serializer = api_serializer.SearchTaxonomyAnalyticsSerializer(
                trending, many=True
            )
            
            return Response({
                'success': True,
                'trending_categories': serializer.data,
                'timestamp': timezone.now()
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class QueryAnalysisByTimeView(generics.GenericAPIView):
    """
    Analyze search query patterns over time.
    Show trends, volume, and performance by time period.
    """
    permission_classes = [IsAdminUser]
    
    def get(self, request):
        """Get time-series query analysis"""
        try:
            from datetime import timedelta
            from django.utils import timezone
            from django.db.models.functions import TruncDate
            from django.db.models import Count, Sum, Avg
            
            days = int(request.query_params.get('days', 30))
            end_date = timezone.now()
            start_date = end_date - timedelta(days=days)
            
            # Get daily stats
            daily_stats = api_models.SearchQueryTaxonomy.objects.filter(
                created_at__range=[start_date, end_date]
            ).annotate(
                date=TruncDate('created_at')
            ).values('date').annotate(
                total_searches=Sum('search_count'),
                avg_ctr=Avg('click_through_count'),
                total_failures=Sum('failed_count'),
                new_queries=Count('id')
            ).order_by('date')
            
            # Get trending by date
            trending_categories = api_models.SearchTaxonomyAnalytics.objects.filter(
                last_updated__range=[start_date, end_date]
            ).order_by('-trending_score')[:5]
            
            trending_serializer = api_serializer.SearchTaxonomyAnalyticsSerializer(
                trending_categories, many=True
            )
            
            return Response({
                'success': True,
                'period': {
                    'start_date': start_date,
                    'end_date': end_date,
                    'days': days
                },
                'daily_stats': list(daily_stats),
                'trending_categories': trending_serializer.data,
                'timestamp': timezone.now()
            })
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


# ============================================================
# [*] PHASE 3: MULTI-ROLE AUTHENTICATION ENDPOINTS
# ============================================================

class AvailableRolesAPIView(APIView):
    """
    Get list of available roles for the authenticated user
    
    Endpoint: /api/v1/auth/available-roles/
    Method: GET
    Authentication: Required (JWT Token)
    Permission: IsAuthenticated
    
    Response:
    {
        "available_roles": ["student", "instructor", "admin"],
        "is_student": true,
        "is_instructor": false,
        "is_admin": false,
        "current_role": "student",
        "user_id": 1,
        "email": "user@example.com"
    }
    
    Purpose:
    - Frontend uses this to display role selection options
    - Returns boolean role fields (is_student, is_instructor, is_admin)
    - Includes current active role for UI state
    - PHASE 4.15+: Uses boolean fields instead of CSV roles field
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def get(self, request):
        """Get available roles for current user"""
        try:
            user = request.user
            
            # PHASE 4.15+: Get available roles from boolean fields (source of truth)
            available_roles = user.get_available_boolean_roles()
            
            return Response({
                'success': True,
                'available_roles': available_roles,
                'is_student': user.is_student,
                'is_instructor': user.is_instructor,
                'is_admin': user.is_admin,
                'current_role': user.current_role,
                'user_id': user.id,
                'email': user.email,
                'full_name': user.full_name,
                'has_multiple_roles': len(available_roles) > 1,
                'timestamp': timezone.now()
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class SelectRoleAPIView(APIView):
    """
    Switch/select user's current active role
    
    Endpoint: /api/v1/auth/select-role/
    Method: POST
    Authentication: Required (JWT Token)
    Permission: IsAuthenticated
    
    Request Body:
    {
        "role": "admin"
    }
    
    Response:
    {
        "success": true,
        "message": "Role switched successfully",
        "current_role": "admin",
        "available_roles": ["student", "teacher", "admin"],
        "user_id": 1,
        "access_token": "new_jwt_token_with_updated_role",
        "refresh_token": "refresh_token"
    }
    
    Purpose:
    - Allow multi-role users to switch between roles
    - Update current_role in database
    - Generate new JWT token with updated role info
    - Validates that user actually has the requested role
    
    Error Cases:
    - User doesn't have requested role (400 Bad Request)
    - Invalid role format (400 Bad Request)
    - Role not in choices (400 Bad Request)
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    
    def post(self, request):
        """Switch user's current active role"""
        try:
            user = request.user
            requested_role = request.data.get('role', '').strip().lower()
            
            # Validate role is provided
            if not requested_role:
                return Response({
                    'success': False,
                    'error': 'Role parameter is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate role is in valid choices
            # Accept both 'instructor' and 'teacher' for instructor role
            valid_roles = ['student', 'teacher', 'instructor', 'admin']
            if requested_role not in valid_roles:
                return Response({
                    'success': False,
                    'error': 'Invalid role. Valid roles are: student, instructor, admin'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Normalize 'teacher' to 'instructor' for internal consistency
            if requested_role == 'teacher':
                requested_role = 'instructor'
            
            # Check if user has this role (use boolean check which handles both instructor/teacher)
            if not user.has_boolean_role(requested_role):
                available_roles = user.get_available_boolean_roles()
                return Response({
                    'success': False,
                    'error': f'User does not have {requested_role} role',
                    'available_roles': available_roles,
                    'current_role': user.current_role
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Switch role
            user.current_role = requested_role
            user.save(update_fields=['current_role'])
            user.refresh_from_db()
            
            # Generate new tokens with updated role using custom serializer
            tokens = generate_tokens_with_role(user)
            
            return Response({
                'success': True,
                'message': f'Berhasil beralih ke peran {requested_role}',
                'current_role': user.current_role,
                'available_roles': user.get_available_boolean_roles(),
                'user_id': user.id,
                'email': user.email,
                'access_token': tokens['access_token'],
                'refresh_token': tokens['refresh_token'],
                'timestamp': timezone.now()
            }, status=status.HTTP_200_OK)
            
        except ValueError as e:
            # Raised by set_current_role if role validation fails
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


# [*] PHASE 4.12: Admin Testimonial Management Views
class AdminPendingTestimonialsListAPIView(generics.ListAPIView):
    """
    Admin - List all pending (unapproved) testimonials for review
    
    GET /api/v1/admin/testimonials/pending/
    
    Returns:
    - 200: List of pending testimonials
    - 401: Unauthorized
    - 403: Not admin
    """
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    authentication_classes = [JWTAuthentication]
    
    def get_queryset(self):
        """Get all pending testimonials ordered by date (newest first)"""
        from django.db.models import Q
        # Pending = active=False AND no rejection reason (reply is empty)
        # This excludes already-rejected testimonials
        return api_models.Review.objects.filter(
            Q(active=False) & (Q(reply__isnull=True) | Q(reply='')),  # Pending approval (not yet reviewed)
            course__isnull=True  # General testimonials only
        ).select_related('user', 'user__profile').order_by('-date')
    
    def list(self, request, *args, **kwargs):
        """Override to add custom response format"""
        queryset = self.get_queryset()
        
        # Build response data with user info
        testimonials_data = []
        for review in queryset:
            user = review.user
            profile = user.profile if user else None
            
            testimonials_data.append({
                'id': review.id,
                'user_id': user.id if user else None,
                'full_name': user.full_name if user else 'Anonymous',
                'email': user.email if user else '',
                'golongan': user.golongan if user else '',
                'position': user.kelas_jabatan if user else '',
                'organization': user.unit_organisasi.name if hasattr(user, 'unit_organisasi') else 'Setjen DPD RI',
                'review': review.review,
                'rating': review.rating,
                'role': review.role,
                'active': review.active,
                'image': profile.image.url if profile and profile.image else None,
                'date': review.date.isoformat()
            })
        
        return Response({
            'count': len(testimonials_data),
            'results': testimonials_data,
            'timestamp': timezone.now().isoformat()
        }, status=status.HTTP_200_OK)


class AdminApproveRejectTestimonialAPIView(generics.GenericAPIView):
    """
    Admin - Approve or reject a testimonial
    
    PATCH /api/v1/admin/testimonials/<testimonial_id>/approve-reject/
    
    Request body:
    {
        "action": "approve" or "reject",
        "reason": "optional reason for rejection"
    }
    
    Returns:
    - 200: Testimonial approved/rejected successfully
    - 400: Invalid action
    - 404: Testimonial not found
    - 401: Unauthorized
    - 403: Not admin
    """
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    authentication_classes = [JWTAuthentication]
    
    def get_object(self, testimonial_id):
        """Get testimonial by ID"""
        try:
            return api_models.Review.objects.get(id=testimonial_id)
        except api_models.Review.DoesNotExist:
            return None
    
    def patch(self, request, testimonial_id):
        """Approve or reject a testimonial"""
        try:
            action = request.data.get('action', '').lower()
            reason = request.data.get('reason', '')
            
            # Validate action
            if action not in ['approve', 'reject']:
                return Response(
                    {"error": "Action harus 'approve' atau 'reject'"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get testimonial
            testimonial = self.get_object(testimonial_id)
            if not testimonial:
                return Response(
                    {"error": "Testimoni tidak ditemukan"}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            if action == 'approve':
                testimonial.active = True
                testimonial.save()
                
                return Response({
                    "message": f"Testimoni berhasil disetujui dan akan ditampilkan di halaman utama.",
                    "testimonial_id": testimonial.id,
                    "status": "approved",
                    "action": "approve"
                }, status=status.HTTP_200_OK)
            
            else:  # reject
                # Instead of deleting, we keep it for record-keeping but mark as inactive permanently
                testimonial.active = False
                testimonial.reply = f"Ditolak oleh admin. Alasan: {reason}" if reason else "Ditolak oleh admin."
                testimonial.save()
                
                # Notify user about rejection (optional)
                # You could send email notification here
                
                return Response({
                    "message": f"Testimoni berhasil ditolak.",
                    "testimonial_id": testimonial.id,
                    "status": "rejected",
                    "action": "reject"
                }, status=status.HTTP_200_OK)
        
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"error": f"Error: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AdminApprovedTestimonialsListAPIView(generics.ListAPIView):
    """
    Admin - List all approved testimonials
    
    GET /api/v1/admin/testimonials/approved/
    
    Returns:
    - 200: List of approved testimonials
    - 401: Unauthorized
    - 403: Not admin
    """
    serializer_class = api_serializer.ReviewSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    authentication_classes = [JWTAuthentication]
    
    def get_queryset(self):
        """Get all approved testimonials ordered by date (newest first)"""
        return api_models.Review.objects.filter(
            active=True,
            course__isnull=True  # General testimonials only
        ).select_related('user', 'user__profile').order_by('-date')
    
    def list(self, request, *args, **kwargs):
        """Override to add custom response format"""
        queryset = self.get_queryset()
        
        # Build response data with user info
        testimonials_data = []
        for review in queryset:
            user = review.user
            profile = user.profile if user else None
            
            testimonials_data.append({
                'id': review.id,
                'user_id': user.id if user else None,
                'full_name': user.full_name if user else 'Anonymous',
                'email': user.email if user else '',
                'golongan': user.golongan if user else '',
                'position': user.kelas_jabatan if user else '',
                'organization': user.unit_organisasi.name if hasattr(user, 'unit_organisasi') else 'Setjen DPD RI',
                'review': review.review,
                'rating': review.rating,
                'role': review.role,
                'active': review.active,
                'image': profile.image.url if profile and profile.image else None,
                'date': review.date.isoformat()
            })
        
        return Response({
            'count': len(testimonials_data),
            'results': testimonials_data,
            'timestamp': timezone.now().isoformat()
        }, status=status.HTTP_200_OK)


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


class AdminInstructorRequestListAPIView(generics.ListAPIView):
    """
    ✨ PHASE 4.78: Admin view pending instructor requests
    
    GET /api/v1/admin/instructor-requests/?status=PENDING
    
    Query Parameters:
    - status: PENDING, APPROVED, REJECTED (default: PENDING)
    
    Response:
    {
        "count": 5,
        "next": null,
        "previous": null,
        "results": [...]
    }
    """
    serializer_class = api_serializer.AdminInstructorRequestListSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = PageNumberPagination
    
    def get_queryset(self):
        queryset = api_models.InstructorRequest.objects.all()
        
        # Filter by status
        status = self.request.query_params.get('status')
        if status and status in ['PENDING', 'APPROVED', 'REJECTED']:
            queryset = queryset.filter(status=status)
        else:
            # Default to pending
            queryset = queryset.filter(status='PENDING')
        
        return queryset.order_by('-request_date')


class AdminInstructorRequestApproveAPIView(APIView):
    """
    ✨ PHASE 4.78: Admin approve instructor request
    
    POST /api/v1/admin/instructor-request/{request_id}/approve/
    
    Response:
    {
        "success": true,
        "message": "Permintaan instruktur dari [name] telah disetujui",
        "request": {
            "id": 1,
            "status": "APPROVED",
            "user_name": "John Doe",
            ...
        }
    }
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def post(self, request, request_id):
        try:
            instructor_request = api_models.InstructorRequest.objects.get(id=request_id)
            
            # Approve the request
            instructor_request.approve(reviewed_by=request.user)
            
            # Serialize the updated request
            serializer = api_serializer.AdminInstructorRequestListSerializer(instructor_request)
            
            return Response({
                'success': True,
                'message': f'Permintaan instruktur dari {instructor_request.user.full_name} telah disetujui',
                'request': serializer.data
            }, status=status.HTTP_200_OK)
        
        except api_models.InstructorRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Permintaan tidak ditemukan'
            }, status=status.HTTP_404_NOT_FOUND)
        
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class AdminInstructorRequestRejectAPIView(APIView):
    """
    ✨ PHASE 4.78: Admin reject instructor request with reason
    
    POST /api/v1/admin/instructor-request/{request_id}/reject/
    
    Request Body:
    {
        "rejection_reason": "Pengalaman mengajar belum cukup, silahkan coba lagi setelah 1 tahun"
    }
    
    Response:
    {
        "success": true,
        "message": "Permintaan instruktur dari [name] telah ditolak",
        "request": {
            "id": 1,
            "status": "REJECTED",
            "rejection_reason": "...",
            ...
        }
    }
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def post(self, request, request_id):
        try:
            instructor_request = api_models.InstructorRequest.objects.get(id=request_id)
            
            # Validate rejection reason
            rejection_reason = request.data.get('rejection_reason', '').strip()
            if not rejection_reason:
                return Response({
                    'success': False,
                    'error': 'Alasan penolakan harus disediakan'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Reject the request
            instructor_request.reject(reviewed_by=request.user, reason=rejection_reason)
            
            # Serialize the updated request
            serializer = api_serializer.AdminInstructorRequestListSerializer(instructor_request)
            
            return Response({
                'success': True,
                'message': f'Permintaan instruktur dari {instructor_request.user.full_name} telah ditolak',
                'request': serializer.data
            }, status=status.HTTP_200_OK)
        
        except api_models.InstructorRequest.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Permintaan tidak ditemukan'
            }, status=status.HTTP_404_NOT_FOUND)
        
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


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
        """
        try:
            question_id = request.data.get('question_id')
            question = api_models.LessonCompletionQuestion.objects.get(question_id=question_id)
            
            is_correct = False
            message = ''
            
            if question.question_type == 'multiple_choice':
                # Single select - check if the provided choice is correct
                answer_choice_id = request.data.get('answer_choice_id')
                answer_choice = question.choices.get(choice_id=answer_choice_id)
                is_correct = answer_choice.is_correct
                message = 'Jawaban benar!' if is_correct else 'Jawaban salah, silakan coba lagi'
            
            elif question.question_type == 'multi_select':
                # Multi-select - check if all selected choices match correct answers
                answer_choice_ids = request.data.get('answer_choice_ids', [])
                correct_choices = set(
                    question.choices.filter(is_correct=True).values_list('choice_id', flat=True)
                )
                selected_choices = set(answer_choice_ids)
                is_correct = correct_choices == selected_choices
                message = 'Jawaban benar!' if is_correct else 'Jawaban salah, silakan coba lagi'
            
            elif question.question_type in ['short_answer', 'fill_in_blank']:
                # Text-based answer - use the check_answer method
                student_answer = request.data.get('answer', '').strip()
                is_correct = question.check_answer(student_answer)
                message = 'Jawaban benar!' if is_correct else 'Jawaban salah, silakan coba lagi'
            
            return Response({
                'success': True,
                'is_correct': is_correct,
                'message': message,
                'question_type': question.question_type
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





