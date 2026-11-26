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
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from api.views.helpers import _SYNC_STATE, reset_sync_state, update_sync_state, get_sync_state, csrf_failure, generate_tokens_with_role


# API Root View
# 🔒 SECURITY FIX (Mengatasi Temuan Pentest T-01):
# Jangan ekspos peta endpoint (reconnaissance surface) kepada pengguna anonim/publik.
@method_decorator(csrf_exempt, name='dispatch')
class APIRootView(APIView):
    """
    API Root - Generic operational status
    CSRF exempt read-only status endpoint.
    Katalog endpoint hanya ditampilkan untuk Administrator terotentikasi.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get(self, request):
        """API Root - Minimal status for public, detailed catalog only for staff/admin"""
        data = {
            "name": "LMSetjen DPD RI API",
            "status": "operational",
        }

        # 🔒 SECURITY: Sembunyikan seluruh peta endpoint & dokumentasi kecuali untuk Admin terotentikasi
        if request.user and request.user.is_authenticated and (
            getattr(request.user, 'is_staff', False) or 
            getattr(request.user, 'is_superuser', False) or 
            getattr(request.user, 'is_admin', False) or 
            getattr(request.user, 'role', '') == 'admin' or 
            getattr(request.user, 'current_role', '') == 'admin'
        ):
            data["version"] = "v1"
            data["endpoints"] = {
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
            }
            data["documentation"] = {
                "swagger": request.build_absolute_uri('/swagger/'),
                "redoc": request.build_absolute_uri('/redoc/'),
            }
            data["support"] = {
                "admin": request.build_absolute_uri('/admin/'),
            }

        return Response(data)



# Health Check API
# 🔒 SECURITY FIX (Mengatasi Temuan Pentest I-01):
# Minimalisasi respons health check (jangan bocorkan versi, nama aplikasi internal, dll)
@method_decorator(csrf_exempt, name='dispatch')
class HealthCheckAPIView(APIView):
    """
    Health Check API
    Minimal status check for container orchestration and internal monitoring.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def get(self, request):
        """Minimal health check response without version or metadata disclosure"""
        allowed_ips = getattr(settings, 'HEALTH_CHECK_ALLOWED_IPS', None)
        if allowed_ips:
            try:
                from api.throttling import get_real_client_ip
                client_ip = get_real_client_ip(request)
                from api.middleware import AdminAccessControlMiddleware
                checker = AdminAccessControlMiddleware(None)
                if not checker._is_ip_allowed(client_ip, allowed_ips):
                    return Response({"status": "forbidden"}, status=status.HTTP_403_FORBIDDEN)
            except Exception:
                pass

        return Response({'status': 'ok'}, status=status.HTTP_200_OK)




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
    # 🔒 RATE LIMITING (Mengatasi Temuan Pentest H-01 & K-02)
    # Maksimal 5 permintaan per menit per IP (Cegah account factory & spam)
    from api.throttling import SSOVerifyRateThrottle
    throttle_classes = [SSOVerifyRateThrottle]
    
    def post(self, request):
        """Verify SSO token and create/update user"""
        from api.sso_utils import SSOTokenVerifier, SSOUserManager, SSOTokenSerializer, SSOUserSerializer
        import jwt
        import logging
        
        logger = logging.getLogger(__name__)
        
        # 1. Ambil token dari request (dukung parameter 'sso_token' maupun 'token')
        sso_token = request.data.get('sso_token') or request.data.get('token')
        
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
        from api.sso_utils import GoogleOAuthVerifier, GoogleOAuthUserManager
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Get token from request
        access_token = request.data.get('access_token') or request.data.get('token')
        token_type = request.data.get('token_type', 'access_token')
        
        logger.info("[AUTH] Google OAuth Verification Started")
        logger.info(f"Token type: {token_type}")
        logger.info(f"Token received: {access_token[:20] if access_token else 'MISSING'}...")
        
        if not access_token:
            logger.error("[FAIL] Google token is missing from request")
            return Response(
                {"error": "Google token is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            logger.info("[AUTH] Verifying Google token...")
            
            # Verify token with Google
            if token_type == 'id_token':
                google_client_id = settings.GOOGLE_CLIENT_ID
                user_info = GoogleOAuthVerifier.verify_id_token(access_token, google_client_id)
            else:
                user_info = GoogleOAuthVerifier.verify_token(access_token)
            
            logger.info(f"[DONE] Google token verified successfully")
            logger.info(f"Google user info: {user_info}")
            
            # Extract user data from Google response
            logger.info("[INFO] Extracting user data from Google token...")
            google_data = GoogleOAuthVerifier.get_user_data_from_token(user_info)
            
            # Get or create user from Google data
            logger.info("[INFO] Getting or creating user from Google data...")
            user, created = GoogleOAuthUserManager.get_or_create_user_from_google(google_data)
            
            logger.info(f"[DONE] User found/created: {user.id}, created={created}")
            logger.info(f"User details: email={user.email}, role={user.role}")
            
            # Generate JWT tokens for LMS
            logger.info("[INFO] Generating JWT tokens for LMS...")
            refresh = RefreshToken.for_user(user)
            
            # Add custom fields to tokens using serializer
            api_serializer.MyTokenObtainPairSerializer._add_user_fields(refresh.access_token, user)
            api_serializer.MyTokenObtainPairSerializer._add_user_fields(refresh, user)
            
            # Add is_active field
            refresh.access_token['is_active'] = user.is_active
            refresh['is_active'] = user.is_active
            
            logger.info("[DONE] JWT tokens generated successfully")
            logger.info(f"[SUCCESS] Google OAuth login successful for user: {user.email}")
            
            return Response(
                {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "onboarding_required": not getattr(user, 'onboarding_completed', False),
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "full_name": user.full_name,
                        "role": user.role,
                        "is_active": user.is_active,
                        "user_type": getattr(user, 'user_type', 'UMUM'),
                        "onboarding_completed": getattr(user, 'onboarding_completed', False),
                        "nip": user.nip,
                        "instansi_asal": getattr(user, 'instansi_asal', ''),
                        "provinsi": getattr(user, 'provinsi', ''),
                        "kota_kabupaten": getattr(user, 'kota_kabupaten', ''),
                        "pekerjaan": getattr(user, 'pekerjaan', ''),
                        "negara": getattr(user, 'negara', 'Indonesia'),
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
    parser_classes = [MultiPartParser, FormParser, JSONParser]  # Support file uploads and JSON payloads

    def permission_denied(self, request, message=None, code=None):
        """
        🔒 ANTI-ENUMERATION (Mengatasi Temuan Pentest S-01):
        Kembalikan HTTP 404 daripada 403 jika pengguna mencoba mengakses ID pengguna lain.
        Ini memastikan penyerang tidak dapat membedakan antara ID yang ada (403) vs tidak ada (404).
        """
        if request.user and request.user.is_authenticated:
            raise Http404("User tidak ditemukan.")
        super().permission_denied(request, message, code)

    def get_object(self):
        user_id = self.kwargs.get('user_id')
        request_user = self.request.user
        
        # 🔒 Anti-IDOR & Anti-Enumeration (K-03, K-04, S-01):
        # Hanya izinkan akses jika mengakses profil sendiri atau admin/staff.
        # Jika bukan haknya, selalu kembalikan 404 Not Found secara seragam.
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
            raise Http404("User tidak ditemukan.")
            
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
        # Fields like 'role', 'is_admin', 'is_super_admin', 'email' are strictly protected
        user = profile.user
        allowed_user_fields = [
            'full_name', 'phone', 'golongan', 'kelas_jabatan', 'jenis_jabatan',
            'instansi_asal', 'pekerjaan', 'provinsi', 'kota_kabupaten'
        ]
        
        # If user is ASN (and not internal), allow updating NIP as well
        if user.user_type == 'ASN' and not user.is_internal:
            allowed_user_fields.append('nip')
        
        profile_needs_save = False
        for field in allowed_user_fields:
            if field in self.request.data and self.request.data[field] is not None:
                val = self.request.data[field]
                setattr(user, field, val)
                if hasattr(profile, field):
                    setattr(profile, field, val)
                    profile_needs_save = True
        
        if 'country' in self.request.data and self.request.data['country'] is not None:
            c_val = self.request.data['country']
            user.negara = c_val
            profile.country = c_val
            profile_needs_save = True

        if 'negara' in self.request.data and self.request.data['negara'] is not None:
            n_val = self.request.data['negara']
            user.negara = n_val
            profile.country = n_val
            profile_needs_save = True
        
        user.save()
        
        # Link organization unit and position if provided
        from userauths.models import OrganizationUnit, Position
        if 'organization_unit_name' in self.request.data:
            org_name = self.request.data['organization_unit_name']
            if org_name:
                org = OrganizationUnit.objects.filter(name=org_name).first()
                if org and profile.organization_unit != org:
                    profile.organization_unit = org
                    profile_needs_save = True
            elif profile.organization_unit is not None:
                profile.organization_unit = None
                profile_needs_save = True

        if 'position_name' in self.request.data:
            pos_name = self.request.data['position_name']
            if pos_name:
                pos = Position.objects.filter(name=pos_name).first()
                if pos and profile.position != pos:
                    profile.position = pos
                    profile_needs_save = True
            elif profile.position is not None:
                profile.position = None
                profile_needs_save = True

        if profile_needs_save:
            profile.save()
        
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


class CompleteOnboardingAPIView(APIView):
    """
    Onboarding completion endpoint for first-time Google users.
    Allows user to select:
    - ASN (requires nip, jabatan, instansi_asal)
    - UMUM (requires pekerjaan, negara, provinsi, kota_kabupaten)
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user_type = str(request.data.get('user_type', '')).strip().upper()

        if user_type not in ['ASN', 'UMUM']:
            return Response(
                {"error": "Pilihan tipe peserta tidak valid. Harus 'ASN' atau 'UMUM'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if user_type == 'ASN':
            nip_raw = str(request.data.get('nip', '')).strip()
            jabatan = str(request.data.get('jabatan', '')).strip()
            instansi_asal = str(request.data.get('instansi_asal', '')).strip()

            if not nip_raw or not instansi_asal or not jabatan:
                return Response(
                    {"error": "NIP, Jabatan, dan Asal Instansi wajib diisi untuk kategori ASN."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validasi NIP standar BKN Republik Indonesia
            import datetime
            clean_nip = nip_raw.replace(" ", "").replace("-", "")
            if not clean_nip.isdigit() or len(clean_nip) != 18:
                return Response(
                    {"error": f"NIP harus terdiri dari tepat 18 digit angka (saat ini {len(clean_nip)} digit)."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 1. Validasi Tanggal Lahir (YYYYMMDD)
            try:
                birth_year = int(clean_nip[0:4])
                birth_month = int(clean_nip[4:6])
                birth_day = int(clean_nip[6:8])
                datetime.date(birth_year, birth_month, birth_day)
            except ValueError:
                return Response(
                    {"error": "Format tanggal lahir pada NIP (8 digit pertama) tidak valid."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            current_year = datetime.date.today().year
            if birth_year < 1940 or birth_year > current_year - 17:
                return Response(
                    {"error": f"Tahun lahir pada NIP ({birth_year}) tidak realistis untuk pegawai aktif."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 2. Validasi Pengangkatan CPNS (YYYYMM)
            try:
                cpns_year = int(clean_nip[8:12])
                cpns_month = int(clean_nip[12:14])
                if cpns_month < 1 or cpns_month > 12:
                    raise ValueError()
            except ValueError:
                return Response(
                    {"error": "Bulan pengangkatan CPNS pada NIP tidak valid (harus 01-12)."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if cpns_year < birth_year + 17 or cpns_year > current_year:
                return Response(
                    {"error": f"Tahun pengangkatan CPNS ({cpns_year}) tidak valid (minimal 17 tahun setelah lahir)."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 3. Validasi Jenis Kelamin (1 = Pria, 2 = Wanita)
            if clean_nip[14] not in ['1', '2']:
                return Response(
                    {"error": "Digit ke-15 NIP (jenis kelamin) harus angka 1 (Pria) atau 2 (Wanita)."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 4. Validasi Nomor Urut
            if clean_nip[15:18] == '000':
                return Response(
                    {"error": "Tiga digit terakhir NIP (nomor urut) tidak boleh 000."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Cek keunikan NIP
            if User.objects.filter(nip=clean_nip).exclude(id=user.id).exists():
                return Response(
                    {"error": f"NIP {clean_nip} telah terdaftar pada akun lain di sistem LMS Setjen DPD RI."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user.user_type = 'ASN'
            user.nip = clean_nip
            user.jenis_jabatan = jabatan
            user.instansi_asal = instansi_asal
            user.onboarding_completed = True
            user.save()

            profile, _ = Profile.objects.get_or_create(user=user)
            profile.user_type = 'ASN'
            profile.instansi_asal = instansi_asal
            profile.onboarding_completed = True
            profile.save()

        elif user_type == 'UMUM':
            pekerjaan = str(request.data.get('pekerjaan', '')).strip()
            negara = str(request.data.get('negara', 'Indonesia')).strip() or 'Indonesia'
            provinsi = str(request.data.get('provinsi', '')).strip()
            kota_kabupaten = str(request.data.get('kota_kabupaten', '')).strip()

            if not pekerjaan:
                return Response(
                    {"error": "Pekerjaan / Profesi wajib dipilih untuk kategori Masyarakat Umum."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if negara == 'Indonesia' and (not provinsi or not kota_kabupaten):
                return Response(
                    {"error": "Provinsi Asal dan Kota/Kabupaten wajib dipilih untuk wilayah Indonesia."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user.user_type = 'UMUM'
            user.pekerjaan = pekerjaan
            user.negara = negara
            user.provinsi = provinsi
            user.kota_kabupaten = kota_kabupaten
            user.onboarding_completed = True
            user.save()

            profile, _ = Profile.objects.get_or_create(user=user)
            profile.user_type = 'UMUM'
            profile.pekerjaan = pekerjaan
            profile.country = negara
            profile.provinsi = provinsi
            profile.kota_kabupaten = kota_kabupaten
            profile.onboarding_completed = True
            profile.save()

        # Generate fresh JWT tokens with updated user information
        refresh = RefreshToken.for_user(user)
        api_serializer.MyTokenObtainPairSerializer._add_user_fields(refresh.access_token, user)
        api_serializer.MyTokenObtainPairSerializer._add_user_fields(refresh, user)

        return Response({
            "message": "Profil berhasil dilengkapi! Selamat datang di LMS Setjen DPD RI.",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "user_type": user.user_type,
                "onboarding_completed": True,
                "nip": user.nip,
                "instansi_asal": user.instansi_asal,
                "provinsi": user.provinsi,
                "kota_kabupaten": user.kota_kabupaten,
                "pekerjaan": user.pekerjaan,
                "negara": user.negara,
                "role": user.role,
                "current_role": user.current_role,
                "available_roles": user.get_available_boolean_roles(),
            }
        }, status=status.HTTP_200_OK)


class UserRoleNotificationCountsAPIView(APIView):
    """
    ✨ ROLE-NOTIF: Mengembalikan hitungan notifikasi aktif / belum dibaca
    untuk setiap peran yang dimiliki pengguna yang sedang login.
    Digunakan oleh indikator peran (RoleIndicator / Ubah Peran dropdown).
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        user = request.user
        available_roles = (
            user.get_available_boolean_roles()
            if hasattr(user, 'get_available_boolean_roles')
            else ['student']
        )

        counts = {
            'student': 0,
            'instructor': 0,
            'teacher': 0,
            'admin': 0,
        }

        # 1. Notifikasi Siswa / Peserta (hanya notifikasi siswa murni yang belum dibaca)
        if 'student' in available_roles:
            counts['student'] = api_models.Notification.objects.filter(
                user=user,
                teacher__isnull=True,
                seen=False
            ).exclude(type__in=['Course Under Review']).count()

        # 2. Notifikasi Instruktur / Pengajar (notifikasi pengajar yang belum dibaca)
        if 'instructor' in available_roles or 'teacher' in available_roles:
            teacher = api_models.Teacher.objects.filter(user=user).first()
            if teacher:
                inst_count = api_models.Notification.objects.filter(
                    teacher=teacher,
                    seen=False
                ).count()
                counts['instructor'] = inst_count
                counts['teacher'] = inst_count

        # 3. Notifikasi Administrator (Tugas moderasi / review / telaah kursus yang menunggu aksi)
        is_admin_user = (
            getattr(user, 'is_admin', False) or
            getattr(user, 'role', None) == 'admin' or
            (hasattr(user, 'has_admin_role') and user.has_admin_role()) or
            user.is_superuser or
            user.is_staff
        )
        if is_admin_user:
            try:
                pending_courses = api_models.Course.objects.filter(
                    is_published_version=False,
                    platform_status='Review'
                ).count()
            except Exception:
                pending_courses = 0

            try:
                pending_instructor_requests = api_models.InstructorRequest.objects.filter(
                    status='PENDING'
                ).count()
            except Exception:
                pending_instructor_requests = 0

            try:
                pending_reports = api_models.ReviewAbuse.objects.filter(
                    status='pending'
                ).count()
            except Exception:
                pending_reports = 0

            counts['admin'] = pending_courses + pending_instructor_requests + pending_reports

        return Response({
            'success': True,
            'counts': counts,
            'total': counts['student'] + counts['instructor'] + counts['admin']
        }, status=status.HTTP_200_OK)






