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
            'service': APP_NAME,
            'version': APP_VERSION,
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
        from api.sso_utils import SSOTokenVerifier, SSOUserManager, SSOTokenSerializer, SSOUserSerializer
        import jwt
        import logging
        
        logger = logging.getLogger(__name__)
        
        # 1. Ambil token dari request
        sso_token = request.data.get('sso_token')
        
        logger.info("[AUTH] SSO Token Verification Started")
        logger.info(f"Request data: {request.data}")
        logger.info(f"SSO token received: {sso_token[:20] if sso_token else 'MISSING'}...")
        
        if not sso_token:
            logger.error("[FAIL] SSO token is missing from request")
            return Response(
                {"error": "SSO token is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # ==========================================
        # 2. EKSTRAKSI SIGNATURE TOKEN
        # ==========================================
        try:
            token_parts = sso_token.split('.')
            if len(token_parts) != 3:
                raise ValueError("Format JWT tidak lengkap")
            signature = token_parts[2]
            if not signature:
                raise ValueError("Signature JWT kosong")
        except Exception:
            logger.error("[FAIL] Format token SSO tidak valid.")
            return Response({"error": "Format token tidak valid."}, status=status.HTTP_400_BAD_REQUEST)

        # ========================================================
        # 3. CEK APAKAH TOKEN SUDAH PERNAH DIPAKAI (ANTI-REPLAY K-02)
        # ========================================================
        if UsedSSOToken.objects.filter(token_signature=signature).exists():
            logger.warning("[FAIL] Akses ditolak: Token SSO sudah pernah digunakan (Replay detected).")
            return Response(
                {"error": "Akses ditolak: Token sudah kadaluarsa atau pernah digunakan."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # ==========================================================
        # 4. VERIFIKASI & DECODE TOKEN SSO (SIGNATURE & EXP VALIDATION)
        # ==========================================================
        try:
            logger.info("[AUTH] Verifying & decoding SSO token...")
            # Menggunakan verifikasi standar (memvalidasi signature & exp)
            sso_data = SSOTokenVerifier.verify_token(sso_token)
            
            logger.info("[DONE] Token decoded and verified successfully")
            
            # Validate SSO data
            logger.info("[AUTH] Validating SSO data...")
            sso_serializer = SSOUserSerializer(data=sso_data)
            if not sso_serializer.is_valid():
                logger.error(f"[FAIL] Invalid SSO data: {sso_serializer.errors}")
                return Response(
                    {"error": "Invalid SSO data", "details": sso_serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info("[DONE] SSO data validation passed")
            
            # ==========================================================
            # 5. ATOMIC RESERVATION (CEGAH RACE CONDITION / CONCURRENCY REPLAY)
            # ==========================================================
            from django.db import IntegrityError, transaction
            try:
                with transaction.atomic():
                    UsedSSOToken.objects.create(token_signature=signature)
            except IntegrityError:
                logger.warning("[FAIL] Concurrency Replay: Token SSO sedang/sudah diproses oleh request paralel.")
                return Response(
                    {"error": "Akses ditolak: Token sudah kadaluarsa atau pernah digunakan."},
                    status=status.HTTP_401_UNAUTHORIZED
                )

            # Get or create user from SSO data
            logger.info("[AUTH] Getting or creating user from SSO data...")
            user, created = SSOUserManager.get_or_create_user_from_sso(sso_data)
            
            logger.info(f"[DONE] User found/created: {user.id}, created={created}")
            
            # Generate JWT tokens for LMS
            logger.info("[AUTH] Generating JWT tokens for LMS...")
            refresh = RefreshToken.for_user(user)
            
            # Use the same method as MyTokenObtainPairSerializer to add custom fields
            api_serializer.MyTokenObtainPairSerializer._add_user_fields(refresh.access_token, user)
            api_serializer.MyTokenObtainPairSerializer._add_user_fields(refresh, user)
            
            # Also ensure is_active is present
            refresh.access_token['is_active'] = user.is_active
            refresh['is_active'] = user.is_active
            
            logger.info("[DONE] JWT tokens generated successfully")
            logger.info(f"[AUTH] SSO login successful for user: {user.email}")
            
            # 6. KEMBALIKAN RESPONSE SUKSES
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
class ProfileAPIView(generics.RetrieveUpdateAPIView):
    """
    User Profile API
    
    Secured with:
    - JWT authentication (IsAuthenticated)
    - Anti-IDOR Object-Level Authorization (K-03, K-04):
      Pengguna hanya dapat melihat dan memperbarui profil mereka sendiri,
      kecuali pengguna tersebut memiliki hak akses admin/staff.
    """
    serializer_class = api_serializer.ProfileSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrStaff]
    authentication_classes = [JWTAuthentication]
    parser_classes = [MultiPartParser, FormParser]  # Support file uploads

    def get_object(self):
        user_id = self.kwargs.get('user_id')
        request_user = self.request.user
        
        # 🔒 Anti-IDOR Check (K-03 & K-04):
        # Hanya izinkan akses jika mengakses profil sendiri atau admin/staff
        is_admin_or_staff = (
            request_user.is_staff or 
            getattr(request_user, 'is_admin', False) or 
            getattr(request_user, 'role', None) == 'admin'
        )
        if str(request_user.id) != str(user_id) and not is_admin_or_staff:
            security_logger.warning(
                f"[IDOR ATTEMPT] User {request_user.id} ({request_user.email}) "
                f"attempted unauthorized access to profile of user_id={user_id}"
            )
            raise PermissionDenied("Anda tidak memiliki izin untuk mengakses atau mengubah profil ini.")
            
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise Http404("User tidak ditemukan.")
            
        profile, _ = Profile.objects.get_or_create(user=user)
        return profile
    
    def perform_update(self, serializer):
        # Update profile (including image if provided)
        profile = serializer.save()
        
        # 🔒 Anti-Mass-Assignment: Only allow non-sensitive user fields to be updated
        # Fields like 'role', 'is_admin', 'is_super_admin', 'nip', 'email' are strictly protected
        user = profile.user
        allowed_user_fields = ['full_name', 'golongan', 'kelas_jabatan', 'jenis_jabatan']
        
        for field in allowed_user_fields:
            if field in self.request.data and self.request.data[field] is not None:
                setattr(user, field, self.request.data[field])
        
        user.save()
        
        return profile



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




