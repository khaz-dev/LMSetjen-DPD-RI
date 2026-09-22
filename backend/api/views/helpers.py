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
    'comparison_complete': False,
    'current_page': 0,  # Current page being fetched
    'total_pages': 0  # Total pages to fetch
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
        'comparison_complete': False,
        'current_page': 0,
        'total_pages': 0
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




def csrf_failure(request, reason=""):
    """Custom CSRF failure handler used by settings.CSRF_FAILURE_VIEW."""
    payload = {
        "detail": "CSRF verification failed.",
        "reason": reason or "CSRF token missing or incorrect.",
    }

    if request.path.startswith("/api/"):
        return JsonResponse(payload, status=403)

    return HttpResponse("CSRF verification failed.", status=403)




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




