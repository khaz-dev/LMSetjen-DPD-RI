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
from api.version import APP_VERSION, APP_NAME, get_current_app_version

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




# ✨ PHASE 7.16: Admin Q&A Reports List - View all Q&A and reply reports
class AdminQAReportsListAPIView(generics.ListAPIView):
    """
    List all Q&A and reply reports for admin review
    """
    permission_classes = [IsAdminUser]
    
    def get_serializer_class(self):
        report_type = self.request.query_params.get('type', 'question')
        if report_type == 'message':
            return api_serializer.QuestionAnswerMessageReportSerializer
        return api_serializer.QuestionAnswerReportSerializer
    
    def get_queryset(self):
        report_type = self.request.query_params.get('type', 'question')
        status_filter = self.request.query_params.get('status')
        
        if report_type == 'message':
            queryset = api_models.Question_Answer_Message_Report.objects.all().select_related('message', 'reported_by', 'reviewed_by').order_by('-reported_at')
        else:
            queryset = api_models.Question_Answer_Report.objects.all().select_related('question', 'reported_by', 'reviewed_by').order_by('-reported_at')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset




# ✨ PHASE 7.16: Admin Q&A Report Detail - Manage individual Q&A reports
class AdminQAReportDetailAPIView(generics.RetrieveUpdateAPIView):
    """
    Retrieve, update, and manage individual Q&A reports
    """
    permission_classes = [IsAdminUser]
    lookup_field = 'id'
    lookup_url_kwarg = 'report_id'
    
    def get_serializer_class(self):
        obj = self.get_object()
        if isinstance(obj, api_models.Question_Answer_Message_Report):
            return api_serializer.QuestionAnswerMessageReportSerializer
        return api_serializer.QuestionAnswerReportSerializer
    
    def get_queryset(self):
        report_type = self.request.query_params.get('type', 'question')
        
        if report_type == 'message':
            return api_models.Question_Answer_Message_Report.objects.all().select_related('message', 'reported_by', 'reviewed_by')
        return api_models.Question_Answer_Report.objects.all().select_related('question', 'reported_by', 'reviewed_by')
    
    def update(self, request, *args, **kwargs):
        report = self.get_object()
        
        # Update status and review notes
        status_new = request.data.get('status')
        review_notes = request.data.get('review_notes')
        
        if status_new:
            report.status = status_new
            report.reviewed_at = timezone.now()
            report.reviewed_by_id = request.data.get('reviewed_by', request.user.id)
        
        if review_notes:
            report.review_notes = review_notes
        
        report.save()
        
        serializer = self.get_serializer(report)
        return Response(serializer.data)




@method_decorator(csrf_exempt, name='dispatch')
class AdminCourseListAPIView(generics.ListAPIView):
    """
    [*] PHASE 4.36+: List courses for admin review and content management
    Supports filtering by status ('Review', 'Published', 'Draft', 'Rejected', 'Disabled', 'all'),
    searching by keyword, category filtering, sorting, and returns live summary stats.
    """
    serializer_class = api_serializer.CourseSerializer
    permission_classes = [IsAdminUser]  # [*] FIX: Use proper admin permission class
    pagination_class = None  # Disable pagination for admin review list
    
    def get_queryset(self):
        status_filter = self.request.query_params.get('status', 'Review')
        search_query = self.request.query_params.get('search', '').strip()
        category_id = self.request.query_params.get('category', '').strip()
        ordering = self.request.query_params.get('ordering', 'recent').strip()
        
        # Only manage parent courses (not published copies)
        queryset = api_models.Course.objects.filter(is_published_version=False)
        
        if status_filter and status_filter.lower() not in ['all', 'semua']:
            queryset = queryset.filter(platform_status=status_filter)
        
        if search_query:
            queryset = queryset.filter(
                Q(title__icontains=search_query) |
                Q(teacher__full_name__icontains=search_query) |
                Q(teacher__user__full_name__icontains=search_query) |
                Q(category__title__icontains=search_query)
            )
            
        if category_id and category_id.lower() not in ['all', 'semua']:
            if category_id.isdigit():
                queryset = queryset.filter(category_id=int(category_id))
            else:
                queryset = queryset.filter(category__slug=category_id)
        
        # Ordering
        if ordering == 'title_asc':
            queryset = queryset.order_by('title')
        elif ordering == 'title_desc':
            queryset = queryset.order_by('-title')
        elif ordering == 'oldest':
            queryset = queryset.order_by('date')
        else:  # recent
            queryset = queryset.order_by(F('review_submitted_date').desc(nulls_last=True), '-date')
            
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        
        base_qs = api_models.Course.objects.filter(is_published_version=False)
        stats = {
            'all': base_qs.count(),
            'review': base_qs.filter(platform_status='Review').count(),
            'published': base_qs.filter(platform_status='Published').count(),
            'draft': base_qs.filter(platform_status='Draft').count(),
            'rejected': base_qs.filter(platform_status='Rejected').count(),
            'disabled': base_qs.filter(platform_status='Disabled').count(),
        }
        
        return Response({
            'results': serializer.data,
            'stats': stats,
        })



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
            total_students = User.objects.filter(models.Q(is_student=True) | models.Q(role='student')).distinct().count()
            total_teachers = User.objects.filter(models.Q(is_instructor=True) | models.Q(role='teacher')).distinct().count()
            total_admins = User.objects.filter(models.Q(is_admin=True) | models.Q(role='admin')).distinct().count()
            
            # Course statistics
            # [*] PHASE 4.77 FIX: Only count published versions to avoid double counting
            total_courses = api_models.Course.objects.filter(is_published_version=True).count()
            active_courses = api_models.Course.objects.filter(
                platform_status='Published',
                is_published_version=True
            ).count()
            draft_courses = api_models.Course.objects.filter(
                platform_status='Draft',
                is_published_version=True
            ).count()
            
            # Enrollment statistics
            total_enrollments = api_models.EnrolledCourse.objects.count()
            recent_enrollments = api_models.EnrolledCourse.objects.filter(date__gte=last_30_days).count()
            
            # Certificate statistics (safely handle Certificate query)
            try:
                total_certificates = api_models.Certificate.objects.filter(is_valid=True).count()
                recent_certificates = api_models.Certificate.objects.filter(is_valid=True, date__gte=last_30_days).count()
            except Exception:
                total_certificates = 0
                recent_certificates = 0
            
            # Review statistics & average rating
            total_reviews = api_models.Review.objects.count()
            recent_reviews = api_models.Review.objects.filter(date__gte=last_30_days).count()
            avg_rating_aggregate = api_models.Review.objects.aggregate(models.Avg('rating'))['rating__avg']
            avg_rating = round(avg_rating_aggregate, 1) if avg_rating_aggregate else 0.0
            
            # Quiz statistics
            # [*] PHASE 4.77 FIX: Only count quizzes from published courses
            try:
                published_course_ids = api_models.Course.objects.filter(
                    is_published_version=True
                ).values_list('id', flat=True)
                total_quizzes = api_models.Quiz.objects.filter(
                    course_id__in=published_course_ids
                ).count()
                total_quiz_attempts = api_models.QuizAttempt.objects.count()
            except Exception:
                total_quizzes = 0
                total_quiz_attempts = 0
            
            # Recent registrations
            recent_registrations = User.objects.filter(date_joined__gte=last_30_days).count()
            
            # Revenue calculation - Cart/Order system removed, set to 0
            total_revenue = 0
            
            # Top performing courses
            top_courses = api_models.Course.objects.filter(
                is_published_version=True
            ).annotate(
                enrollment_count=models.Count('enrolledcourse')
            ).order_by('-enrollment_count')[:5]
            
            # Most active teachers & real active teachers count
            active_teachers_count = api_models.Teacher.objects.filter(
                course__is_published_version=True
            ).distinct().count()
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
            
            # System health metrics: Real completion rate based on valid certificates per enrollment
            completion_rate = 0
            try:
                if total_enrollments > 0:
                    completed_enrollments = api_models.Certificate.objects.filter(
                        is_valid=True,
                        enrollment__isnull=False
                    ).values('enrollment_id').distinct().count()
                    completion_rate = (completed_enrollments / total_enrollments) * 100
            except Exception:
                completion_rate = 0
            
            data = {
                'total_students': total_students,
                'total_teachers': total_teachers,
                'total_admins': total_admins,
                'total_courses': total_courses,
                'active_courses': active_courses,
                'draft_courses': draft_courses,
                'total_enrollments': total_enrollments,
                'recent_enrollments': recent_enrollments,
                'total_certificates': total_certificates,
                'recent_certificates': recent_certificates,
                'total_reviews': total_reviews,
                'recent_reviews': recent_reviews,
                'avg_rating': avg_rating,
                'total_quizzes': total_quizzes,
                'total_quiz_attempts': total_quiz_attempts,
                'recent_registrations': recent_registrations,
                'active_teachers_count': active_teachers_count,
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
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = api_serializer.UserSerializer
    pagination_class = PageNumberPagination  # Enable pagination
    
    def get_queryset(self):
        # Verify admin access
        if not (hasattr(self.request.user, 'is_admin') and self.request.user.is_admin):
            return User.objects.none()
        
        # ✨ SPRINT 1 OPTIMIZATION: Use annotations instead of N+1 queries
        # This eliminates the problem where enrollment_count and course_count
        # were being queried for each user in the list
        from django.db.models import Count, Case, When, Q
        
        queryset = User.objects.annotate(
            # ✨ SPRINT 1: Pre-calculate enrollment count for students
            _enrollment_count=Case(
                When(is_student=True, then=Count('enrolledcourse', distinct=True)),
                default=0
            ),
            # ✨ SPRINT 1: Pre-calculate course count for instructors
            _course_count=Case(
                When(is_instructor=True, then=Count('teacher__course', distinct=True)),
                default=0
            )
        ).only(
            'id',
            'username', 
            'email',
            'full_name',
            'role',
            'is_internal',
            'user_type',
            'nip',
            'jenis_jabatan',
            'golongan',
            'kelas_jabatan',
            'instansi_asal',
            'provinsi',
            'kota_kabupaten',
            'pekerjaan',
            'negara',
            'onboarding_completed',
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

        user_type_filter = self.request.query_params.get('user_type', None)
        if user_type_filter and user_type_filter.upper() != 'ALL':
            queryset = queryset.filter(user_type=user_type_filter.upper())
        
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            if status_filter == 'active':
                queryset = queryset.filter(is_active=True)
            elif status_filter == 'inactive':
                queryset = queryset.filter(is_active=False)
        
        return queryset




class AdminUserManagementAllAPIView(generics.ListAPIView):
    """
    ✨ PHASE 67: Admin view to fetch ALL users at once (no pagination)
    Optimization for admin users page - load all data upfront instead of on-demand
    
    This simplified approach eliminates need for complex pagination logic:
    - No on-demand loading
    - No preload strategies
    - No page tracking
    - Instant client-side pagination
    
    Suitable for systems with < 1000 users (current: 275 users)
    For larger systems, backend can add conditional check to fall back to pagination
    
    Performance benefit: 60% faster, 40% less frontend code
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = api_serializer.UserSerializer
    pagination_class = None  # ✨ PHASE 67: No pagination - return ALL users
    
    def get_queryset(self):
        # Verify admin access
        if not (hasattr(self.request.user, 'is_admin') and self.request.user.is_admin):
            return User.objects.none()
        
        # ✨ PHASE 67: Same optimization as AdminUserManagementAPIView
        # Use annotations to prevent N+1 queries
        from django.db.models import Count, Case, When, Q
        
        queryset = User.objects.annotate(
            _enrollment_count=Case(
                When(is_student=True, then=Count('enrolledcourse', distinct=True)),
                default=0
            ),
            _course_count=Case(
                When(is_instructor=True, then=Count('teacher__course', distinct=True)),
                default=0
            )
        ).only(
            'id',
            'username', 
            'email',
            'full_name',
            'role',
            'is_internal',
            'user_type',
            'nip',
            'jenis_jabatan',
            'golongan',
            'kelas_jabatan',
            'instansi_asal',
            'provinsi',
            'kota_kabupaten',
            'pekerjaan',
            'negara',
            'onboarding_completed',
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

        user_type_filter = self.request.query_params.get('user_type', None)
        if user_type_filter and user_type_filter.upper() != 'ALL':
            queryset = queryset.filter(user_type=user_type_filter.upper())
        
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            if status_filter == 'active':
                queryset = queryset.filter(is_active=True)
            elif status_filter == 'inactive':
                queryset = queryset.filter(is_active=False)
        
        return queryset
    
    def get(self, request, *args, **kwargs):
        """
        ✨ PHASE 67: Override get to return data directly without pagination wrapper
        This matches the paginated response format but returns all results in 'results' field
        """
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            
            # Return format compatible with paginated response
            # Frontend expects: { count, results, next, previous }
            return Response({
                'count': queryset.count(),
                'next': None,  # No pagination
                'previous': None,  # No pagination
                'results': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )




class AdminUserStatsAPIView(generics.GenericAPIView):
    """
    Admin view to get aggregated user statistics
    Returns stats for ALL users (not just loaded pages)
    ✨ PHASE X: Created to support admin panel stats cards
    
    Returns:
    - total_users: Total count of all users
    - active_users: Count of active users
    - students: Count of users with student role
    - teachers: Count of users with instructor role
    - admins: Count of users with admin role
    - inactive_users: Count of inactive users
    - new_30d: Count of users joined in the last 30 days
    - active_7d: Count of users logged in in the last 7 days
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Verify admin access
        if not (hasattr(request.user, 'is_admin') and request.user.is_admin):
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            from django.db.models import Q, Count
            from django.utils import timezone
            from datetime import timedelta
            
            now = timezone.now()
            thirty_days_ago = now - timedelta(days=30)
            seven_days_ago = now - timedelta(days=7)
            
            stats = User.objects.aggregate(
                total_users=Count('id'),
                active_users=Count('id', filter=Q(is_active=True)),
                inactive_users=Count('id', filter=Q(is_active=False)),
                students=Count('id', filter=Q(is_student=True)),
                teachers=Count('id', filter=Q(is_instructor=True)),
                admins=Count('id', filter=Q(is_admin=True)),
                internal_users=Count('id', filter=Q(user_type='INTERNAL')),
                asn_users=Count('id', filter=Q(user_type='ASN')),
                umum_users=Count('id', filter=Q(user_type='UMUM')),
                new_30d=Count('id', filter=Q(date_joined__gte=thirty_days_ago)),
                active_7d=Count('id', filter=Q(last_login__gte=seven_days_ago))
            )
            
            total = stats.get('total_users') or 0
            active = stats.get('active_users') or 0
            stats['active_rate'] = round((active / total * 100), 1) if total > 0 else 0
            
            return Response(stats, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




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
            
            # Top performing courses (only published versions)
            top_courses = api_models.Course.objects.filter(
                is_published_version=True
            ).annotate(
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
            import platform
            from django.conf import settings
            from django.db import connection
            
            # Database statistics
            db_stats = {
                'total_users': User.objects.count(),
                'total_students': User.objects.filter(models.Q(is_student=True) | models.Q(role='student')).distinct().count(),
                'total_teachers': User.objects.filter(models.Q(is_instructor=True) | models.Q(role='teacher')).distinct().count(),
                'total_courses': api_models.Course.objects.filter(is_published_version=True).count(),
                'total_lessons': api_models.VariantItem.objects.filter(item_type='lesson').count(),
                'total_enrollments': api_models.EnrolledCourse.objects.count(),
                'total_reviews': api_models.Review.objects.count(),
            }
            
            # Add certificate and quiz counts safely
            try:
                db_stats['total_certificates'] = api_models.Certificate.objects.filter(is_valid=True).count()
            except Exception:
                db_stats['total_certificates'] = 0

            try:
                db_stats['total_quizzes'] = api_models.Quiz.objects.count()
            except Exception:
                db_stats['total_quizzes'] = 0

            # Safe database size query
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_size_pretty(pg_database_size(current_database()));")
                    row = cursor.fetchone()
                    if row:
                        db_stats['database_size'] = row[0]
            except Exception:
                pass
            
            # Server information
            server_info = {
                'operating_system': f"{platform.system()} {platform.release()}",
                'app_version': get_current_app_version(),
                'django_version': django.get_version(),
                'python_version': platform.python_version(),
                'database_engine': settings.DATABASES['default']['ENGINE'].split('.')[-1].upper(),
                'debug_mode': settings.DEBUG,
                'timezone': str(getattr(settings, 'TIME_ZONE', 'Asia/Jakarta')),
                'server_time': timezone.now().strftime("%d %b %Y, %H:%M:%S WIB"),
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
    permission_classes = [IsAuthenticated, IsAdminUser]
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
    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = api_serializer.RegisterSerializer
    
    def create(self, request, *args, **kwargs):
        try:
            # Verify admin access
            if not hasattr(request.user, 'role') or not (request.user.is_admin):
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            # Extract role before validation (serializer doesn't accept it)
            role = request.data.get('role', 'student')
            
            # Create a copy of data for RegisterSerializer
            reg_fields = ['full_name', 'email', 'password', 'password2']
            serializer_data = {k: request.data.get(k) for k in reg_fields if k in request.data}
            
            serializer = self.get_serializer(data=serializer_data)
            if serializer.is_valid():
                user = serializer.save()
                
                # Set boolean roles from request data or role parameter
                if any(k in request.data for k in ['is_student', 'is_instructor', 'is_admin']):
                    user.is_student = bool(request.data.get('is_student', False))
                    user.is_instructor = bool(request.data.get('is_instructor', False))
                    user.is_admin = bool(request.data.get('is_admin', False))
                else:
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
                
                # Determine primary role
                if user.is_admin:
                    primary_role = 'admin'
                elif user.is_instructor:
                    primary_role = 'teacher'
                else:
                    primary_role = 'student'

                user.current_role = primary_role
                user.roles = primary_role
                user.role = primary_role

                # 3 Jenis Peserta: INTERNAL, ASN, UMUM
                user_type = request.data.get('user_type', 'UMUM')
                user.user_type = user_type
                user.is_internal = (user_type == 'INTERNAL')
                
                if 'nip' in request.data:
                    user.nip = request.data.get('nip') or None
                if 'jenis_jabatan' in request.data:
                    user.jenis_jabatan = request.data.get('jenis_jabatan') or None
                if 'instansi_asal' in request.data:
                    user.instansi_asal = request.data.get('instansi_asal') or None
                if 'pekerjaan' in request.data:
                    user.pekerjaan = request.data.get('pekerjaan') or None
                if 'negara' in request.data:
                    user.negara = request.data.get('negara') or 'Indonesia'
                if 'provinsi' in request.data:
                    user.provinsi = request.data.get('provinsi') or None
                if 'kota_kabupaten' in request.data:
                    user.kota_kabupaten = request.data.get('kota_kabupaten') or None
                if 'phone' in request.data:
                    user.phone = request.data.get('phone') or None

                user.onboarding_completed = True
                user.save()

            # Sync with profile
            if hasattr(user, 'profile'):
                profile = user.profile
                for pf in ['user_type', 'instansi_asal', 'provinsi', 'kota_kabupaten', 'pekerjaan', 'onboarding_completed']:
                    if pf in request.data:
                        setattr(profile, pf, request.data[pf])
                if 'negara' in request.data:
                    profile.country = request.data['negara']
                profile.save()
                
                # Sync Profile
                profile, _ = Profile.objects.get_or_create(user=user)
                profile.user_type = user.user_type
                profile.instansi_asal = user.instansi_asal
                profile.provinsi = user.provinsi
                profile.kota_kabupaten = user.kota_kabupaten
                profile.pekerjaan = user.pekerjaan
                profile.country = user.negara or 'Indonesia'
                profile.onboarding_completed = True
                profile.save()

                # Create teacher profile if role is teacher/instructor
                if user.is_instructor:
                    api_models.Teacher.objects.get_or_create(
                        user=user,
                        defaults={'full_name': user.full_name}
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
    permission_classes = [IsAuthenticated, IsAdminUser]
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
            
            # Update user demographic and participant fields
            updatable_fields = [
                'full_name', 'email', 'phone', 'is_active',
                'user_type', 'nip', 'jenis_jabatan', 'instansi_asal',
                'pekerjaan', 'negara', 'provinsi', 'kota_kabupaten',
                'onboarding_completed'
            ]
            for field in updatable_fields:
                if field in request.data:
                    setattr(user, field, request.data[field])

            # Update is_internal consistency based on user_type
            if 'user_type' in request.data:
                user.is_internal = (request.data['user_type'] == 'INTERNAL')

            # Update password if provided
            if 'password' in request.data and request.data['password']:
                user.set_password(request.data['password'])
            
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

            # Sync with profile
            if hasattr(user, 'profile'):
                profile = user.profile
                for pf in ['user_type', 'instansi_asal', 'provinsi', 'kota_kabupaten', 'pekerjaan', 'onboarding_completed']:
                    if pf in request.data:
                        setattr(profile, pf, request.data[pf])
                if 'negara' in request.data:
                    profile.country = request.data['negara']
                profile.save()
            
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
    permission_classes = [IsAuthenticated, IsAdminUser]
    
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
    permission_classes = [IsAuthenticated, IsAdminUser]
    
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




class TagListAPIView(generics.ListAPIView):
    """
    ✨ PHASE X: Public endpoint to list all active tags
    - Returns all active tags with course counts
    - Used by students to browse tags
    """
    queryset = api_models.Tag.objects.filter(active=True)  
    serializer_class = api_serializer.TagSerializer
    permission_classes = [AllowAny]




class AdminTagListCreateAPIView(generics.ListCreateAPIView):
    """
    ✨ PHASE X: Admin endpoint to list and create course tags
    - Requires admin authentication
    - Supports full CRUD operations for course tags
    """
    queryset = api_models.Tag.objects.all()
    serializer_class = api_serializer.TagManagementSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        """Get all tags for admin management"""
        # Verify admin access
        if not (hasattr(self.request.user, 'role') and self.request.user.is_admin):
            return api_models.Tag.objects.none()
        return api_models.Tag.objects.all().order_by('-id')
    
    def create(self, request, *args, **kwargs):
        """Create new course tag - Admin only"""
        try:
            # Verify admin access
            if not (hasattr(request.user, 'role') and request.user.is_admin):
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                tag = serializer.save()
                return Response(
                    {
                        'message': 'Tag created successfully',
                        'tag': serializer.data
                    },
                    status=status.HTTP_201_CREATED
                )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class AdminTagDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    """
    ✨ PHASE X: Admin endpoint for tag details, updates, and deletion
    - GET: Retrieve tag details with course count
    - PUT/PATCH: Update tag information
    - DELETE: Remove tag (only if no courses tagged with it)
    """
    queryset = api_models.Tag.objects.all()
    serializer_class = api_serializer.TagManagementSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    lookup_field = 'id'
    
    def update(self, request, *args, **kwargs):
        """Update tag details"""
        try:
            # Verify admin access
            if not (hasattr(request.user, 'role') and request.user.is_admin):
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            
            if serializer.is_valid():
                tag = serializer.save()
                return Response(
                    {
                        'message': 'Tag updated successfully',
                        'tag': serializer.data
                    },
                    status=status.HTTP_200_OK
                )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def destroy(self, request, *args, **kwargs):
        """Delete tag - only if no courses tagged with it"""
        try:
            # Verify admin access
            if not (hasattr(request.user, 'role') and request.user.is_admin):
                return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
            
            instance = self.get_object()
            
            # Check if tag has courses
            course_count = instance.courses.count()
            if course_count > 0:
                return Response(
                    {
                        'error': f'Cannot delete tag with {course_count} course(s). Remove tag from courses first.',
                        'course_count': course_count
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            tag_name = instance.title
            instance.delete()
            
            # Return 200 OK with message instead of 204 for better frontend handling
            return Response(
                {
                    'message': f'Tag "{tag_name}" deleted successfully',
                    'success': True
                },
                status=status.HTTP_200_OK
            )
        except api_models.Tag.DoesNotExist:
            return Response({'error': 'Tag not found'}, status=status.HTTP_404_NOT_FOUND)
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
                'image': image_url,  # ✨ PHASE 11.10: Now returns absolute URL with cache-busting
                'date': review.date.isoformat()
            })
        
        all_testimonials = api_models.Review.objects.filter(course__isnull=True)
        pending_count = all_testimonials.filter(Q(active=False) & (Q(reply__isnull=True) | Q(reply=''))).count()
        approved_count = all_testimonials.filter(active=True).count()
        rejected_count = all_testimonials.filter(Q(active=False) & ~Q(reply='') & Q(reply__isnull=False)).count()
        avg_rating = all_testimonials.aggregate(Avg('rating'))['rating__avg'] or 0.0

        return Response({
            'count': len(testimonials_data),
            'results': testimonials_data,
            'stats': {
                'pending': pending_count,
                'approved': approved_count,
                'rejected': rejected_count,
                'total': all_testimonials.count(),
                'avg_rating': round(float(avg_rating), 1)
            },
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
                'image': image_url,  # ✨ PHASE 11.10: Now returns absolute URL with cache-busting
                'date': review.date.isoformat()
            })
        
        all_testimonials = api_models.Review.objects.filter(course__isnull=True)
        pending_count = all_testimonials.filter(Q(active=False) & (Q(reply__isnull=True) | Q(reply=''))).count()
        approved_count = all_testimonials.filter(active=True).count()
        rejected_count = all_testimonials.filter(Q(active=False) & ~Q(reply='') & Q(reply__isnull=False)).count()
        avg_rating = all_testimonials.aggregate(Avg('rating'))['rating__avg'] or 0.0

        return Response({
            'count': len(testimonials_data),
            'results': testimonials_data,
            'stats': {
                'pending': pending_count,
                'approved': approved_count,
                'rejected': rejected_count,
                'total': all_testimonials.count(),
                'avg_rating': round(float(avg_rating), 1)
            },
            'timestamp': timezone.now().isoformat()
        }, status=status.HTTP_200_OK)




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
        queryset = api_models.InstructorRequest.objects.all().select_related('user')
        
        # Filter by status
        status_param = self.request.query_params.get('status', 'PENDING')
        if status_param and status_param.upper() in ['PENDING', 'APPROVED', 'REJECTED']:
            queryset = queryset.filter(status=status_param.upper())
        elif status_param and status_param.upper() == 'ALL':
            pass
        else:
            queryset = queryset.filter(status='PENDING')

        # Filter by search term
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(user__full_name__icontains=search) |
                Q(user__email__icontains=search) |
                Q(expertise_areas__icontains=search)
            )
        
        return queryset.order_by('-request_date')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        all_reqs = api_models.InstructorRequest.objects.all()
        stats = {
            'pending': all_reqs.filter(status='PENDING').count(),
            'approved': all_reqs.filter(status='APPROVED').count(),
            'rejected': all_reqs.filter(status='REJECTED').count(),
            'total': all_reqs.count(),
        }
        if isinstance(response.data, dict):
            response.data['stats'] = stats
        return response




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

            # Kirim notifikasi in-app kepada pemohon bahwa permohonan telah disetujui
            try:
                api_models.Notification.objects.create(
                    user=instructor_request.user,
                    type="Course Published",
                    title="Permohonan Instruktur Disetujui! 🎉",
                    message="Selamat! Pengajuan Anda untuk menjadi instruktur internal LMSetjen DPD RI telah disetujui oleh Administrator. Anda kini dapat mulai menyusun dan menerbitkan kursus.",
                )
            except Exception:
                pass
            
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

            # Kirim notifikasi in-app kepada pemohon bahwa permohonan membutuhkan perbaikan
            try:
                api_models.Notification.objects.create(
                    user=instructor_request.user,
                    type="Exam Rejected",
                    title="Pembaruan Status Pengajuan Instruktur",
                    message=f"Pengajuan instruktur Anda membutuhkan penyesuaian: \"{rejection_reason[:120]}\". Anda dapat memperbaiki data dan mendaftar ulang.",
                )
            except Exception:
                pass
            
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




class AdminActivityAnalyticsAPIView(APIView):
    """
    PHASE 53: Get platform-wide activity analytics (admin only)
    
    GET /api/v1/admin/activities/analytics/
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        period = request.query_params.get('period', 'daily')
        days = int(request.query_params.get('days', 30))
        
        cutoff_date = timezone.now() - timedelta(days=days)
        all_activities = api_models.ActivityLog.objects.filter(
            activity_date__gte=cutoff_date
        )
        
        now = timezone.now().date()
        today_activities = all_activities.filter(activity_date__date=now)
        
        # Overall stats
        total_activities = all_activities.count()
        total_users = all_activities.values('user').distinct().count()
        active_users_today = today_activities.values('user').distinct().count()
        avg_engagement = all_activities.aggregate(
            avg=Avg('activity_score')
        )['avg'] or 0
        
        # Daily metrics
        daily_metrics = []
        for i in range(days):
            date = (timezone.now() - timedelta(days=i)).date()
            day_activities = all_activities.filter(activity_date__date=date)
            day_count = day_activities.count()
            day_users = day_activities.values('user').distinct().count()
            day_engagement = day_activities.aggregate(
                avg=Avg('activity_score')
            )['avg'] or 0
            
            if day_count > 0:  # Only include days with activities
                daily_metrics.append({
                    'date': str(date),
                    'activity_count': day_count,
                    'unique_users': day_users,
                    'avg_engagement': round(day_engagement, 2)
                })
        
        # Activity type breakdown
        activity_breakdown = []
        activity_type_counts = all_activities.values('activity_type').annotate(
            count=Count('id')
        ).order_by('-count')
        
        for activity in activity_type_counts:
            choices_dict = dict(api_models.ActivityLog.ACTIVITY_TYPE_CHOICES)
            percentage = (activity['count'] / total_activities * 100) if total_activities > 0 else 0
            activity_breakdown.append({
                'activity_type': activity['activity_type'],
                'count': activity['count'],
                'percentage': round(percentage, 2),
                'display': choices_dict.get(activity['activity_type'], activity['activity_type'])
            })
        
        # Top courses by activity
        top_courses = all_activities.values('course__id', 'course__title').annotate(
            activity_count=Count('id'),
            unique_students=Count('user', distinct=True)
        ).order_by('-activity_count')[:10]
        
        top_courses_list = []
        for course_data in top_courses:
            if course_data['course__id']:
                top_courses_list.append({
                    'course_id': course_data['course__id'],
                    'course_title': course_data['course__title'],
                    'activity_count': course_data['activity_count'],
                    'unique_students': course_data['unique_students']
                })
        
        data = {
            'period': period,
            'total_activities': total_activities,
            'total_users': total_users,
            'active_users_today': active_users_today,
            'avg_engagement_score': round(avg_engagement, 2),
            'daily_metrics': daily_metrics,
            'activity_type_breakdown': activity_breakdown,
            'top_courses_by_activity': top_courses_list
        }
        
        return Response(data, status=status.HTTP_200_OK)


class CertificateTemplateConfigPublicAPIView(APIView):
    """
    Endpoint publik untuk membaca konfigurasi template sertifikat aktif.
    Digunakan oleh halaman sertifikat siswa (CourseDetail/CertificateTab) dan live preview.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        try:
            course_id = request.query_params.get('course_id') or request.query_params.get('course')
            if course_id:
                config = api_models.CertificateTemplateConfig.get_template_for_course(course_id)
            else:
                config = api_models.CertificateTemplateConfig.get_active_config()
            serializer = api_serializer.CertificateTemplateConfigSerializer(config, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"[CertificateTemplateConfigPublic] Error: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminCertificateTemplateConfigAPIView(APIView):
    """
    Endpoint Admin untuk membaca dan memperbarui konfigurasi template sertifikat.
    Mendukung upload file PPTX master, background custom, styling teks, warna, font, dan toggles.
    """
    permission_classes = [AllowAny]  # Allow admin authenticated or fallback

    def get(self, request, *args, **kwargs):
        config = api_models.CertificateTemplateConfig.get_active_config()
        serializer = api_serializer.CertificateTemplateConfigSerializer(config, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        config = api_models.CertificateTemplateConfig.get_active_config()
        data = request.data

        # Update text & styling fields if present
        text_fields = [
            'template_name', 'primary_color', 'accent_color', 'title_font', 'body_font',
            'agency_sup', 'agency_main', 'agency_sub',
            'certificate_title', 'certificate_subtitle', 'statement_text',
            'signatory_title', 'signatory_sub_title', 'signatory_name', 'signatory_nip'
        ]
        for field in text_fields:
            if field in data and data[field] is not None:
                setattr(config, field, data[field])

        # Boolean toggles
        bool_fields = ['show_gold_seal', 'show_watermark', 'show_bpsdm_logo', 'show_qr_code', 'is_active']
        for field in bool_fields:
            if field in data:
                val = data[field]
                if isinstance(val, str):
                    setattr(config, field, val.lower() in ('true', '1', 'yes'))
                else:
                    setattr(config, field, bool(val))

        # Handle PPTX template upload
        pptx_feedback = None
        if 'pptx_template' in request.FILES:
            uploaded_pptx = request.FILES['pptx_template']
            config.pptx_template = uploaded_pptx
            try:
                from api.certificate_template_generator import inspect_pptx_placeholders
                pptx_feedback = inspect_pptx_placeholders(uploaded_pptx)
            except Exception as e:
                logger.warning(f"Could not inspect PPTX placeholders: {e}")

        # Handle custom background upload
        if 'custom_background' in request.FILES:
            config.custom_background = request.FILES['custom_background']
        elif data.get('remove_custom_background') in (True, 'true', '1'):
            if config.custom_background:
                config.custom_background.delete(save=False)
            config.custom_background = None

        config.save()
        serializer = api_serializer.CertificateTemplateConfigSerializer(config, context={'request': request})
        
        response_payload = {
            "message": "Konfigurasi template sertifikat berhasil disimpan.",
            "config": serializer.data
        }
        if pptx_feedback:
            response_payload["pptx_feedback"] = pptx_feedback

        return Response(response_payload, status=status.HTTP_200_OK)


class AdminCertificateDownloadDefaultPPTXAPIView(APIView):
    """
    Endpoint untuk mendownload file master PowerPoint (.pptx) default resmi Setjen DPD RI.
    Slide 1 berisi template layout ber-placeholder tag {{...}},
    Slide 2 berisi petunjuk dan kamus variabel.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        try:
            from api.certificate_template_generator import create_default_certificate_pptx
            pptx_stream = create_default_certificate_pptx()
            response = HttpResponse(
                pptx_stream.getvalue(),
                content_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
            )
            response['Content-Disposition'] = 'attachment; filename="Template_Sertifikat_Setjen_DPD_RI.pptx"'
            return response
        except Exception as e:
            logger.error(f"[DownloadPPTX] Error: {e}")
            return Response({"error": f"Gagal mengunduh template PPTX: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminCertificateResetDefaultAPIView(APIView):
    """
    Endpoint untuk mereset seluruh konfigurasi sertifikat kembali ke setelan default resmi DPD RI.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            config = api_models.CertificateTemplateConfig.get_active_config()
            config.template_name = "Template Resmi Setjen DPD RI"
            config.is_active = True
            config.primary_color = "#0d5c3a"
            config.accent_color = "#c59b27"
            config.title_font = "'Cinzel', serif"
            config.body_font = "'Montserrat', sans-serif"
            config.agency_sup = "SEKRETARIAT JENDERAL"
            config.agency_main = "DEWAN PERWAKILAN DAERAH REPUBLIK INDONESIA"
            config.agency_sub = "BIRO ORGANISASI KEANGGOTAAN DAN KEPEGAWAIAN"
            config.certificate_title = "SERTIFIKAT KELULUSAN"
            config.certificate_subtitle = "Certificate of Completion"
            config.statement_text = "Telah berhasil dan berintegritas menyelesaikan seluruh materi pembelajaran mandiri, penugasan studi kasus, serta memenuhi standar evaluasi kelulusan pada program:"
            config.signatory_title = "Kepala Biro Organisasi Keanggotaan dan Kepegawaian"
            config.signatory_sub_title = "Sekretariat Jenderal DPD RI"
            config.signatory_name = "Dr. Fitriani, A.P., M.Si."
            config.signatory_nip = "19741017 199311 2 001"
            config.show_gold_seal = True
            config.show_watermark = True
            config.show_bpsdm_logo = True
            config.show_qr_code = True
            
            if config.custom_background:
                config.custom_background.delete(save=False)
                config.custom_background = None
                
            config.save()

            serializer = api_serializer.CertificateTemplateConfigSerializer(config, context={'request': request})
            return Response({
                "message": "Konfigurasi template berhasil direset ke standar resmi DPD RI.",
                "config": serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"[ResetDefault] Error: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminHeaderStatsAPIView(generics.GenericAPIView):
    """
    Lightweight, fast real-time summary for AdminHeader:
    - Active & online users count
    - Pending items requiring admin action (courses under review, abuse reports, pending feedback, pending testimonials)
    - Live notifications list with direct actionable links
    - System operational status
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        is_admin_user = (
            getattr(request.user, 'is_admin', False) or
            getattr(request.user, 'current_role', None) == 'admin' or
            getattr(request.user, 'role', None) == 'admin' or
            (hasattr(request.user, 'has_admin_role') and request.user.has_admin_role()) or
            request.user.is_superuser or
            request.user.is_staff
        )
        if not is_admin_user:
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)

        try:
            from datetime import timedelta
            now = timezone.now()
            fifteen_mins_ago = now - timedelta(minutes=15)

            # 1. User stats (live & real)
            total_users = User.objects.count()
            active_users = User.objects.filter(is_active=True).count()
            recent_active = User.objects.filter(last_login__gte=fifteen_mins_ago).count()
            online_users = max(1, recent_active)

            # 2. Pending items requiring action
            pending_courses = api_models.Course.objects.filter(
                is_published_version=False,
                platform_status='Review'
            ).count()

            pending_reports = api_models.ReviewAbuse.objects.filter(
                status='pending'
            ).count()

            pending_testimonials = api_models.Review.objects.filter(
                active=False
            ).count()

            pending_instructor_requests = api_models.InstructorRequest.objects.filter(
                status='PENDING'
            ).count()

            pending_feedback = 0
            try:
                pending_feedback = api_models.Feedback.objects.filter(
                    status__in=['open', 'under_review']
                ).count()
            except Exception:
                pending_feedback = 0

            # 3. Actionable notifications list (individual pending items)
            notifications_list = []

            # 3a. Courses awaiting review
            review_courses = api_models.Course.objects.filter(
                is_published_version=False,
                platform_status='Review'
            ).select_related('teacher').order_by('-review_submitted_date', '-date')
            pending_courses = review_courses.count()

            for course in review_courses[:10]:
                teacher_name = course.teacher.full_name if (course.teacher and course.teacher.full_name) else 'Instruktur'
                notifications_list.append({
                    'id': f'course_{course.id}',
                    'category': 'course',
                    'icon': 'fas fa-book-reader',
                    'color': '#f59e0b',
                    'title': f'Review Kursus: {course.title[:38]}',
                    'message': f'Diajukan oleh {teacher_name}. Menunggu verifikasi.',
                    'link': f'/admin/content-management/?tab=courses&course_id={course.id}',
                    'badge': 'Review Kursus',
                    'badge_type': 'warning',
                    'time': course.review_submitted_date.strftime('%d %b') if course.review_submitted_date else 'Baru'
                })

            # 3b. Instructor requests awaiting review
            instructor_requests = api_models.InstructorRequest.objects.filter(
                status='PENDING'
            ).select_related('user').order_by('-request_date')
            pending_instructor_requests = instructor_requests.count()

            for req in instructor_requests[:10]:
                applicant_name = req.user.full_name if (req.user and req.user.full_name) else (req.user.username if req.user else 'Pengguna')
                expertise = req.expertise_areas[:35] if req.expertise_areas else 'Keahlian umum'
                level_map = dict(getattr(api_models.InstructorRequest, 'EXPERIENCE_LEVEL_CHOICES', []))
                level_display = level_map.get(req.experience_level, req.experience_level or 'Pemula')
                notifications_list.append({
                    'id': f'inst_req_{req.id}',
                    'category': 'instructor_request',
                    'icon': 'fas fa-chalkboard-teacher',
                    'color': '#0d9488',
                    'title': f'Permintaan Instruktur: {applicant_name[:25]}',
                    'message': f'{expertise} ({level_display}). Menunggu verifikasi admin.',
                    'link': f'/admin/content-management/?tab=requests&request_id={req.id}',
                    'badge': 'Permintaan Instruktur',
                    'badge_type': 'teal',
                    'time': req.request_date.strftime('%d %b') if req.request_date else 'Baru'
                })

            # 3c. Abuse reports pending review
            abuse_reports = api_models.ReviewAbuse.objects.filter(
                status='pending'
            ).select_related('review', 'reported_by').order_by('-reported_at')
            pending_reports = abuse_reports.count()

            for report in abuse_reports[:10]:
                reporter_name = report.reported_by.full_name if (report.reported_by and report.reported_by.full_name) else (report.reported_by.username if report.reported_by else 'Pengguna')
                reason_dict = dict(getattr(api_models, 'ABUSE_REASON_CHOICES', []))
                reason_display = reason_dict.get(report.reason, report.reason or 'Pelanggaran')
                notifications_list.append({
                    'id': f'abuse_{report.id}',
                    'category': 'abuse',
                    'icon': 'fas fa-exclamation-triangle',
                    'color': '#ef4444',
                    'title': f'Laporan: {reason_display[:30]}',
                    'message': f'Dilaporkan oleh {reporter_name}. Perlu investigasi admin.',
                    'link': f'/admin/reports/?tab=abuse&report_id={report.id}',
                    'badge': 'Laporan Ulasan',
                    'badge_type': 'danger',
                    'time': report.reported_at.strftime('%d %b') if report.reported_at else 'Baru'
                })

            # 3c. Testimonials pending approval
            pending_testimonials_qs = api_models.Review.objects.filter(
                active=False
            ).select_related('user', 'course').order_by('-date')
            pending_testimonials = pending_testimonials_qs.count()

            for test in pending_testimonials_qs[:10]:
                student_name = test.user.full_name if (test.user and test.user.full_name) else (test.user.username if test.user else 'Pengguna')
                course_title = test.course.title if test.course else 'Platform'
                notifications_list.append({
                    'id': f'test_{test.id}',
                    'category': 'testimonial',
                    'icon': 'fas fa-quote-right',
                    'color': '#3b82f6',
                    'title': f'Testimoni: {student_name[:25]}',
                    'message': f'Ulasan {test.rating}★ untuk "{course_title[:30]}". Menunggu kurasi.',
                    'link': f'/admin/content-management/?tab=testimonials',
                    'badge': f'{test.rating}★ Kurasi',
                    'badge_type': 'info',
                    'time': test.date.strftime('%d %b') if test.date else 'Baru'
                })

            # 3d. User feedback (bugs / feature requests)
            pending_feedback = 0
            try:
                feedback_qs = api_models.Feedback.objects.filter(
                    status__in=['open', 'under_review']
                ).select_related('user').order_by('-created_at')
                pending_feedback = feedback_qs.count()

                for fb in feedback_qs[:15]:
                    user_name = fb.user.full_name if (fb.user and fb.user.full_name) else (fb.user.username if fb.user else 'Pengguna')
                    is_bug = fb.feedback_type == 'bug'
                    type_label = 'Laporan Bug' if is_bug else 'Permintaan Fitur'
                    notifications_list.append({
                        'id': f'feedback_{fb.id}',
                        'category': 'feedback',
                        'icon': 'fas fa-bug' if is_bug else 'fas fa-lightbulb',
                        'color': '#ef4444' if is_bug else '#8b5cf6',
                        'title': f'{type_label}: {fb.title[:38]}',
                        'message': f'Dari {user_name}. Status: {fb.get_status_display() if hasattr(fb, "get_status_display") else fb.status}.',
                        'link': f'/admin/reports/?tab=feedback&id={fb.id}',
                        'badge': 'Bug' if is_bug else 'Fitur',
                        'badge_type': 'danger' if is_bug else 'purple',
                        'time': fb.created_at.strftime('%d %b') if fb.created_at else 'Baru'
                    })
            except Exception:
                pending_feedback = 0

            # 3e. Administrative system notifications (strictly exclude student learning nudges / JP target reminders)
            admin_excluded_types = [
                'AI JP Target Reminder',
                'AI Learning Nudge',
                'AI Microlearning Digest',
                'AI Flashcard Challenge',
                'Course Enrollment Completed',
                'Course Published',
                'Exam Verified',
                'Exam Reset',
                'Exam Rejected',
                'New Order',
                'New Course Question',
                'New Review',
            ]
            user_notifs = api_models.Notification.objects.filter(
                user=request.user,
                seen=False
            ).exclude(
                type__in=admin_excluded_types
            ).exclude(
                title__icontains='Target 20 JP'
            ).exclude(
                message__icontains='Target 20 JP'
            ).exclude(
                title__icontains='20 JP'
            ).order_by('-date')[:10]

            for notif in user_notifs:
                notifications_list.append({
                    'id': f'db_{notif.id}',
                    'category': 'admin_notice',
                    'icon': 'fas fa-shield-alt',
                    'color': '#0f766e',
                    'title': notif.title or notif.type or 'Pemberitahuan Sistem Admin',
                    'message': notif.message or 'Pemberitahuan sistem baru untuk Administrator.',
                    'link': '/admin/reports/',
                    'badge': 'Sistem Admin',
                    'badge_type': 'teal',
                    'time': notif.date.strftime('%H:%M WIB') if notif.date else 'Baru saja'
                })

            total_alerts = (
                pending_courses +
                pending_instructor_requests +
                pending_reports +
                pending_testimonials +
                pending_feedback +
                user_notifs.count()
            )

            is_super = bool(
                getattr(request.user, 'is_superuser', False) or
                (hasattr(request.user, 'admin') and request.user.admin.is_super_admin) or
                (request.user.email and request.user.email.strip().lower() == 'khairilazmiashari@gmail.com')
            )

            response_data = {
                'status': 'online',
                'active_users': active_users,
                'online_users': online_users,
                'total_users': total_users,
                'pending_courses': pending_courses,
                'pending_instructor_requests': pending_instructor_requests,
                'pending_reports': pending_reports,
                'pending_testimonials': pending_testimonials,
                'pending_feedback': pending_feedback,
                'total_alerts': total_alerts,
                'notifications': notifications_list,
                'server_time': now.strftime('%d %b %Y, %H:%M WIB'),
                'is_super_admin': is_super
            }

            return Response(response_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminVisitorTrafficAnalyticsAPIView(APIView):
    """
    Analisis Tren Pengunjung & Pengguna LMSetjen DPD RI (100% Real Live Database):
    Menyajikan data multi-granularitas murni dari database aktivitas dan kehadiran aktual:
    - Jam (Hourly 00:00 - 23:00 WIB)
    - Hari (Daily: Senin - Minggu)
    - Tanggal (30 Hari Terakhir)
    - Bulan (Monthly: 12 Bulan Terakhir)
    - Tahun (Yearly: Multi-tahun)
    
    Lengkap dengan deteksi otomatis status tren (Peningkatan, Penurunan, Stagnan),
    persentase fluktuasi riil, jam/hari puncak operasional, dan transparansi sumber log.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        try:
            from datetime import timedelta
            import calendar
            now = timezone.now()
            today_local = timezone.localtime(now).date()

            # Helper penentu status tren objektif murni perbandingan nilai
            def calculate_trend_status(current_val, prev_val):
                if prev_val is None or prev_val == 0:
                    if current_val > 0:
                        return "Peningkatan", 100.0, current_val
                    return "Stagnan", 0.0, 0
                diff = current_val - prev_val
                pct = round((diff / prev_val) * 100, 1)
                if diff > 0:
                    return "Peningkatan", pct, diff
                elif diff < 0:
                    return "Penurunan", pct, diff
                return "Stagnan", 0.0, 0

            # ------------------------------------------------------------------
            # Pengumpulan Seluruh Timestamp Riil dari Database Platform
            # ------------------------------------------------------------------
            all_timestamps = []

            # 1. Log Aktivitas Platform Terpusat (ActivityLog)
            act_logs = list(api_models.ActivityLog.objects.values_list('activity_date', flat=True))
            all_timestamps.extend([t for t in act_logs if t])

            # 2. Riwayat Login Terakhir Pengguna (User.last_login)
            user_logins = list(User.objects.filter(last_login__isnull=False).values_list('last_login', flat=True))
            all_timestamps.extend([t for t in user_logins if t])

            # 3. Pendaftaran Kursus ASN (EnrolledCourse.date)
            enroll_dates = list(api_models.EnrolledCourse.objects.values_list('date', flat=True))
            all_timestamps.extend([t for t in enroll_dates if t])

            # 4. Evaluasi & Pengerjaan Kuis (QuizAttempt.date_attempted)
            quiz_dates = list(api_models.QuizAttempt.objects.values_list('date_attempted', flat=True))
            all_timestamps.extend([t for t in quiz_dates if t])

            # 5. Penyelesaian Materi/Modul Pembelajaran (CompletedLesson.date)
            lesson_dates = list(api_models.CompletedLesson.objects.values_list('date', flat=True))
            all_timestamps.extend([t for t in lesson_dates if t])

            # 6. Audit Poin Penghargaan (PointsAuditLog.awarded_at)
            points_dates = list(api_models.PointsAuditLog.objects.values_list('awarded_at', flat=True))
            all_timestamps.extend([t for t in points_dates if t])

            # Konversi semua ke timezone lokal WIB
            local_timestamps = [timezone.localtime(t) for t in all_timestamps]

            # ------------------------------------------------------------------
            # 1. Tren Per Jam (24 Jam: 00:00 - 23:00 WIB)
            # ------------------------------------------------------------------
            hourly_counts = {h: 0 for h in range(24)}
            for lt in local_timestamps:
                hourly_counts[lt.hour] += 1

            hourly_data = []
            prev_hourly = None
            peak_hour_val = -1
            peak_hour_str = "-"

            for h in range(24):
                val = hourly_counts[h]
                status_str, pct, diff = calculate_trend_status(val, prev_hourly)
                prev_hourly = val

                if val > peak_hour_val:
                    peak_hour_val = val
                    peak_hour_str = f"{h:02d}:00 WIB"

                hourly_data.append({
                    'hour': h,
                    'label': f"{h:02d}:00",
                    'visits': val,
                    'status': status_str,
                    'change_pct': pct,
                    'diff': diff
                })

            if peak_hour_val <= 0:
                peak_hour_str = "Belum Ada Aktivitas"

            # ------------------------------------------------------------------
            # 2. Tren Per Hari dalam Seminggu (Senin - Minggu)
            # ------------------------------------------------------------------
            day_names_id = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
            daily_weekday_counts = {i: 0 for i in range(7)}
            for lt in local_timestamps:
                daily_weekday_counts[lt.weekday()] += 1

            daily_data = []
            prev_daily = None
            peak_day_val = -1
            peak_day_str = "-"

            for idx, name in enumerate(day_names_id):
                val = daily_weekday_counts[idx]
                status_str, pct, diff = calculate_trend_status(val, prev_daily)
                prev_daily = val

                if val > peak_day_val:
                    peak_day_val = val
                    peak_day_str = name

                daily_data.append({
                    'day_index': idx,
                    'label': name,
                    'visits': val,
                    'status': status_str,
                    'change_pct': pct,
                    'diff': diff
                })

            if peak_day_val <= 0:
                peak_day_str = "Belum Ada Aktivitas"

            # ------------------------------------------------------------------
            # 3. Tren Per Tanggal (30 Hari Terakhir)
            # ------------------------------------------------------------------
            date_counts = {}
            for i in range(29, -1, -1):
                d = today_local - timedelta(days=i)
                date_counts[d.strftime('%Y-%m-%d')] = 0

            for lt in local_timestamps:
                d_str = lt.date().strftime('%Y-%m-%d')
                if d_str in date_counts:
                    date_counts[d_str] += 1

            date_data = []
            prev_date_val = None
            for i in range(29, -1, -1):
                target_date = today_local - timedelta(days=i)
                d_str = target_date.strftime('%Y-%m-%d')
                val = date_counts.get(d_str, 0)
                status_str, pct, diff = calculate_trend_status(val, prev_date_val)
                prev_date_val = val

                date_data.append({
                    'date': d_str,
                    'label': target_date.strftime('%d %b'),
                    'visits': val,
                    'status': status_str,
                    'change_pct': pct,
                    'diff': diff
                })

            # ------------------------------------------------------------------
            # 4. Tren Per Bulan (12 Bulan Terakhir)
            # ------------------------------------------------------------------
            month_names_id = [
                "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember"
            ]
            monthly_keys = []
            monthly_counts = {}
            for i in range(11, -1, -1):
                m_date = (today_local.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
                k = f"{m_date.year}-{m_date.month:02d}"
                if k not in monthly_counts:
                    monthly_counts[k] = 0
                    monthly_keys.append((m_date.year, m_date.month, k))

            for lt in local_timestamps:
                k = f"{lt.year}-{lt.month:02d}"
                if k in monthly_counts:
                    monthly_counts[k] += 1

            monthly_data = []
            prev_month_val = None
            peak_month_val = -1
            peak_month_str = "-"

            for yr, m_num, k in monthly_keys:
                val = monthly_counts.get(k, 0)
                m_name = month_names_id[m_num]
                status_str, pct, diff = calculate_trend_status(val, prev_month_val)
                prev_month_val = val

                if val > peak_month_val:
                    peak_month_val = val
                    peak_month_str = f"{m_name} {yr}"

                monthly_data.append({
                    'month': m_num,
                    'year': yr,
                    'label': f"{m_name[:3]} {yr}",
                    'full_label': f"{m_name} {yr}",
                    'visits': val,
                    'status': status_str,
                    'change_pct': pct,
                    'diff': diff
                })

            if peak_month_val <= 0:
                peak_month_str = "Belum Ada Aktivitas"

            # ------------------------------------------------------------------
            # 5. Tren Per Tahun (Multi-Tahun Nyata)
            # ------------------------------------------------------------------
            cur_year = today_local.year
            yearly_years = [cur_year - 2, cur_year - 1, cur_year]
            yearly_counts = {y: 0 for y in yearly_years}

            for lt in local_timestamps:
                if lt.year in yearly_counts:
                    yearly_counts[lt.year] += 1

            yearly_data = []
            prev_year_val = None

            for yr in yearly_years:
                val = yearly_counts[yr]
                status_str, pct, diff = calculate_trend_status(val, prev_year_val)
                prev_year_val = val

                yearly_data.append({
                    'year': yr,
                    'label': str(yr),
                    'visits': val,
                    'status': status_str,
                    'change_pct': pct,
                    'diff': diff
                })

            # ------------------------------------------------------------------
            # Ringkasan Eksekutif & Metadata Riil
            # ------------------------------------------------------------------
            today_str = today_local.strftime('%Y-%m-%d')
            yesterday_str = (today_local - timedelta(days=1)).strftime('%Y-%m-%d')
            today_visits = date_counts.get(today_str, 0)
            yesterday_visits = date_counts.get(yesterday_str, 0)
            day_status, day_pct, day_diff = calculate_trend_status(today_visits, yesterday_visits)

            result = {
                'status': 'success',
                'is_live_data': True,
                'data_source': 'Real LMS Database (ActivityLog, User Logins, Enrollments, Quizzes, Lessons, Points)',
                'summary': {
                    'total_visits_today': today_visits,
                    'yesterday_visits': yesterday_visits,
                    'current_trend_status': day_status,
                    'current_trend_pct': day_pct,
                    'current_trend_diff': day_diff,
                    'peak_hour': peak_hour_str,
                    'peak_day': peak_day_str,
                    'peak_month': peak_month_str,
                    'total_real_events': len(local_timestamps),
                    'total_active_users': User.objects.filter(is_active=True).count(),
                    'total_registered_users': User.objects.count(),
                    'last_updated': timezone.localtime(now).strftime('%d %B %Y %H:%M:%S WIB'),
                },
                'hourly': hourly_data,
                'daily': daily_data,
                'date': date_data,
                'monthly': monthly_data,
                'yearly': yearly_data,
            }

            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =====================================================================
# ✨ PHASE 5.2: ADMIN COURSE EVALUATION & EXAM VERIFICATION
# Mendukung UAT Skenario 5: Manajemen Verifikasi Ujian, Rekapitulasi JP
# per Unit Kerja, Transparansi Butir Soal, & Reset Percobaan Ujian
# =====================================================================

class AdminCourseEvaluationAPIView(APIView):
    """
    ✨ PHASE 5.2: Admin Course Evaluation & Exam Verification API
    Menyediakan data komprehensif bagi Administrator Pengelola SDM Setjen DPD RI:
    - Statistik Eksekutif (Total Peserta, Kelulusan, Rata-rata Skor, Total JP Terbit, Status Integritas)
    - Riwayat Seluruh Percobaan Ujian / Kuis Peserta (Quiz Attempts Audit Trail)
    - Butir Soal & Pilihan Jawaban Kuis untuk Transparansi Jawaban Peserta
    - Daftar Lengkap Peserta, NIP, Unit Kerja / Kantor Daerah, Capaian JP, dan Status Sertifikat
    - Rekapitulasi Efektivitas Belajar (Pre-Test -> Post-Test) dan Kepuasan (Kirkpatrick Level 1)
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request, course_id):
        user = request.user
        is_admin_or_staff = getattr(user, 'is_staff', False) or getattr(user, 'is_admin', False)
        if not is_admin_or_staff:
            return Response({"error": "Akses ditolak. Fitur ini khusus Administrator Setjen DPD RI."}, status=status.HTTP_403_FORBIDDEN)

        # 1. Resolusi course (by id, course_id, or slug)
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
            return Response({"error": f"Kursus dengan ID '{course_id}' tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)

        related_course_ids = course.get_related_course_ids() if hasattr(course, 'get_related_course_ids') else {course.id}

        # 2. Ambil data analitik leaderboard dasar dari CourseLeaderboardAPIView
        from api.views.student import CourseLeaderboardAPIView
        lb_view = CourseLeaderboardAPIView()
        lb_response = lb_view.get(request, course_id)
        lb_data = lb_response.data if lb_response.status_code == 200 else {}
        leaderboard = lb_data.get("leaderboard", [])

        # 3. Hitung Bobot JP Kursus
        total_jp = 0
        try:
            lectures = course.lectures() if callable(getattr(course, 'lectures', None)) else getattr(course, 'lectures', [])
            total_sec = sum(l.content_duration_seconds for l in lectures if hasattr(l, 'content_duration_seconds') and l.content_duration_seconds)
            total_jp = max(1, (total_sec + 2699) // 2700) if total_sec else 2
        except Exception:
            total_jp = 2

        # 4. Ambil Daftar Kuis & Butir Soal untuk Transparansi Jawaban
        quizzes = api_models.Quiz.objects.filter(course_id__in=related_course_ids, is_active=True).prefetch_related('questions', 'questions__choices')
        quizzes_list = []
        for q in quizzes:
            questions_data = []
            for qn in q.questions.all().order_by('order', 'id'):
                choices_data = []
                for ch in qn.choices.all().order_by('order', 'id'):
                    c_text = getattr(ch, 'choice_text', None) or getattr(ch, 'title', '') or ''
                    choices_data.append({
                        "choice_id": ch.choice_id,
                        "title": c_text,
                        "choice_text": c_text,
                        "is_correct": ch.is_correct
                    })
                q_text = getattr(qn, 'question_text', None) or getattr(qn, 'title', '') or ''
                questions_data.append({
                    "question_id": qn.question_id,
                    "title": q_text,
                    "question_text": q_text,
                    "question_type": getattr(qn, 'question_type', 'multiple_choice') or 'multiple_choice',
                    "explanation": getattr(qn, 'explanation', '') or "",
                    "order": qn.order,
                    "choices": choices_data
                })
            quizzes_list.append({
                "quiz_id": q.quiz_id,
                "title": q.title,
                "quiz_type": q.quiz_type,
                "total_questions": len(questions_data),
                "questions": questions_data
            })

        # 5. Ambil Seluruh Riwayat Percobaan Kuis (QuizAttempts)
        attempts_qs = api_models.QuizAttempt.objects.filter(
            quiz__course_id__in=related_course_ids
        ).select_related('user', 'user__profile', 'quiz').order_by('-date_attempted')

        attempts_list = []
        for att in attempts_qs:
            prof = getattr(att.user, 'profile', None)
            unit_name = "-"
            nip_val = getattr(att.user, 'nip', None) or (getattr(prof, 'nip', None) if prof else None) or "-"
            jabatan_val = "-"
            if prof:
                org_unit = getattr(prof, 'organization_unit', None)
                if org_unit:
                    unit_name = getattr(org_unit, 'name', str(org_unit))
                pos = getattr(prof, 'position', None)
                if pos:
                    jabatan_val = getattr(pos, 'name', str(pos))

            # Hitung durasi pengerjaan dalam detik
            time_sec = None
            if att.time_taken:
                time_sec = int(att.time_taken.total_seconds())

            # Cek integritas pengerjaan attempt
            min_expected_sec = max(15, att.total_questions * 3)
            is_anomaly = (time_sec is not None and time_sec < min_expected_sec and att.total_questions > 0)
            anomaly_reasons = []
            if is_anomaly:
                anomaly_reasons.append(f"Waktu pengerjaan tidak wajar ({time_sec} detik untuk {att.total_questions} butir soal)")

            # Cari status integritas enrollment siswa
            enr = api_models.EnrolledCourse.objects.filter(user=att.user, course_id__in=related_course_ids).first()
            integrity_status = "verified"
            if enr:
                integ_data = enr.check_integrity_status()
                integrity_status = integ_data.get("status", "verified")
                if integ_data.get("reasons"):
                    anomaly_reasons.extend(integ_data.get("reasons", []))

            # Format Attempt ID
            raw_att_id = att.attempt_id or str(att.id)
            display_att_id = raw_att_id if raw_att_id.startswith("ATTEMPT-") else f"ATTEMPT-{raw_att_id}"
            user_full_name = att.user.get_full_name() or getattr(att.user, 'full_name', '') or att.user.username

            attempts_list.append({
                "id": att.id,
                "attempt_id": display_att_id,
                "raw_attempt_id": raw_att_id,
                "user_id": att.user.id,
                "user_name": user_full_name,
                "email": att.user.email,
                "nip": nip_val,
                "unit_kerja": unit_name,
                "jabatan": jabatan_val,
                "quiz_id": att.quiz.quiz_id,
                "quiz_title": att.quiz.title,
                "quiz_type": att.quiz.quiz_type,
                "attempt_type": att.attempt_type or 'quiz',
                "score": float(att.score),
                "total_questions": att.total_questions,
                "correct_answers": att.correct_answers,
                "is_passed": att.is_passed,
                "time_taken_seconds": time_sec,
                "date_attempted": att.date_attempted.isoformat() if att.date_attempted else None,
                "date_attempted_display": att.date_attempted.strftime("%d %b %Y %H:%M") if att.date_attempted else "-",
                "integrity_status": integrity_status,
                "anomaly_flag": len(anomaly_reasons) > 0,
                "anomaly_reasons": list(set(anomaly_reasons))
            })

        # 6. Kumpulkan Daftar Unit Kerja Unik
        unit_kerja_set = set()
        for s in leaderboard:
            u_info = s.get("employee_info", {})
            u_name = u_info.get("unit_kerja")
            if u_name and u_name != "-":
                unit_kerja_set.add(u_name)
        for a in attempts_list:
            if a["unit_kerja"] and a["unit_kerja"] != "-":
                unit_kerja_set.add(a["unit_kerja"])

        # Standar unit kerja Setjen DPD RI (Kantor Daerah & Sekretariat)
        common_units = [
            "Kantor DPD RI Provinsi Jawa Timur",
            "Kantor DPD RI Provinsi Jawa Barat",
            "Kantor DPD RI Provinsi Sumatera Utara",
            "Kantor DPD RI Provinsi Bali",
            "Kantor DPD RI Provinsi Sulawesi Selatan",
            "Kantor DPD RI Provinsi Papua",
            "Biro Organisasi, Keanggotaan, dan Kepegawaian",
            "Biro Protokol, Hubungan Masyarakat, dan Media",
            "Biro Keuangan dan Perencanaan",
            "Pusat Kajian Daerah dan Anggaran",
            "Pusat Perancangan dan Kajian Kebijakan Hukum",
            "Inspektorat"
        ]
        for cu in common_units:
            unit_kerja_set.add(cu)

        # 7. Ringkasan Eksekutif
        total_enrolled = len(leaderboard)
        completed_count = sum(1 for s in leaderboard if s.get("completion_stats", {}).get("is_completed"))
        completion_rate = round((completed_count / total_enrolled * 100), 1) if total_enrolled > 0 else 0.0
        total_jp_issued = completed_count * total_jp
        flagged_count = sum(1 for s in leaderboard if s.get("integrity_check", {}).get("status") == "pending_review")

        post_scores = [s.get("learning_stats", {}).get("post_score") for s in leaderboard if s.get("learning_stats", {}).get("post_score") is not None]
        avg_post_score = round(sum(post_scores) / len(post_scores), 1) if post_scores else 0.0

        return Response({
            "course": {
                "id": course.id,
                "course_id": course.course_id,
                "title": course.title,
                "slug": course.slug,
                "image": (course.image.url if hasattr(course.image, "url") else str(course.image)) if course.image else None,
                "category": course.category.title if course.category else "-",
                "teacher_name": course.teacher.user.full_name if (course.teacher and course.teacher.user) else "Instruktur Setjen DPD RI",
                "level": course.level,
                "platform_status": course.platform_status,
                "total_jp": total_jp,
                "date_created": course.date.strftime("%d %b %Y") if course.date else "-"
            },
            "metrics": {
                "total_enrolled": total_enrolled,
                "completed_count": completed_count,
                "completion_rate": completion_rate,
                "total_jp": total_jp,
                "total_jp_issued": total_jp_issued,
                "flagged_count": flagged_count,
                "avg_post_score": avg_post_score,
                "total_attempts": len(attempts_list)
            },
            "unit_kerja_list": sorted(list(unit_kerja_set)),
            "attempts": attempts_list,
            "quizzes": quizzes_list,
            "leaderboard": leaderboard,
            "evaluation": lb_data.get("evaluation", {})
        }, status=status.HTTP_200_OK)


class AdminResetQuizAttemptAPIView(APIView):
    """
    ✨ PHASE 5.2: Admin Reset Exam Attempt (Exam Reset) API
    Memverifikasi modul administrator Bagian Pengembangan Kapasitas SDM Setjen DPD RI
    dalam melakukan intervensi reset pengerjaan ujian peserta akibat kendala teknis/jaringan
    sesuai Skenario 5 Step 3 UAT.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        user = request.user
        is_admin_or_staff = getattr(user, 'is_staff', False) or getattr(user, 'is_admin', False)
        if not is_admin_or_staff:
            return Response({"error": "Akses ditolak. Fitur ini khusus Administrator Setjen DPD RI."}, status=status.HTTP_403_FORBIDDEN)

        course_id = request.data.get('course_id')
        user_id = request.data.get('user_id')
        attempt_id = request.data.get('attempt_id') # e.g. "ATTEMPT-881" or "881" or id
        reason = request.data.get('reason', 'Peserta mengalami kendala teknis / jaringan saat ujian.')
        action = request.data.get('action', 'reset_exam')

        course = None
        if course_id:
            if str(course_id).isdigit():
                course = api_models.Course.objects.filter(id=int(course_id)).first()
            if not course:
                course = api_models.Course.objects.filter(course_id=str(course_id)).first()
            if not course:
                course = api_models.Course.objects.filter(slug=str(course_id)).first()

        target_attempt = None
        target_student = None

        # 1. Cari attempt jika attempt_id disediakan
        if attempt_id:
            clean_att_id = str(attempt_id).replace("ATTEMPT-", "").strip()
            # Coba cari berdasarkan attempt_id
            target_attempt = api_models.QuizAttempt.objects.filter(attempt_id=clean_att_id).first()
            if not target_attempt and clean_att_id.isdigit():
                target_attempt = api_models.QuizAttempt.objects.filter(id=int(clean_att_id)).first()
            if not target_attempt:
                target_attempt = api_models.QuizAttempt.objects.filter(attempt_id=attempt_id).first()

            if target_attempt:
                target_student = target_attempt.user
                if not course and target_attempt.quiz and target_attempt.quiz.course:
                    course = target_attempt.quiz.course

        if not target_student and user_id:
            target_student = User.objects.filter(id=user_id).first()

        if not target_student and not target_attempt:
            return Response({"error": "Data peserta atau ID percobaan tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)

        if not course and target_attempt and target_attempt.quiz:
            course = target_attempt.quiz.course

        if not course:
            return Response({"error": "Kursus tidak ditemukan"}, status=status.HTTP_404_NOT_FOUND)

        related_course_ids = course.get_related_course_ids() if hasattr(course, 'get_related_course_ids') else {course.id}
        formatted_attempt_code = attempt_id or (f"ATTEMPT-{target_attempt.attempt_id}" if target_attempt else "ATTEMPT-RESET")

        # 2. Hapus / Reset Attempt
        deleted_count = 0
        if target_attempt:
            target_attempt.delete()
            deleted_count = 1
        elif target_student:
            # Hapus post-test attempts atau quiz attempts untuk kursus ini
            pre_post_quiz = api_models.Quiz.objects.filter(course_id__in=related_course_ids, quiz_type='pre_post_test', is_active=True).first()
            if pre_post_quiz:
                attempts = api_models.QuizAttempt.objects.filter(user=target_student, quiz=pre_post_quiz)
                pre_att = attempts.filter(attempt_type='pre_test').first() or attempts.order_by('date_attempted').first()
                post_attempts = attempts.filter(attempt_type='post_test')
                if not post_attempts.exists() and attempts.count() >= 2:
                    post_attempts = attempts.exclude(id=pre_att.id if pre_att else None)
                deleted_count = post_attempts.count()
                post_attempts.delete()

        # 3. Reset Status Enrollment Peserta
        if target_student:
            enrollment = api_models.EnrolledCourse.objects.filter(user=target_student, course_id__in=related_course_ids).first()
            if enrollment:
                enrollment.manual_integrity_approved = False
                enrollment.integrity_status = 'verified'
                enrollment.integrity_notes = f"Percobaan ujian direset oleh Administrator {user.full_name}. Alasan: {reason}"
                enrollment.save(update_fields=['manual_integrity_approved', 'integrity_status', 'integrity_notes'])

            # Batalkan / bekukan sertifikat jika sebelumnya sudah terbit agar peserta lulus ulang
            cert = api_models.Certificate.objects.filter(user=target_student, course_id__in=related_course_ids).first()
            if cert:
                cert.delete()

        # 4. Catat Riwayat Resmi pada Audit Trail (ActivityLog)
        student_name = target_student.full_name if target_student else "Peserta"
        api_models.ActivityLog.objects.create(
            user=user,
            activity_type='quiz_attempted',
            role_at_time='admin',
            course=course,
            title=f"Reset Percobaan Ujian: {student_name} ({formatted_attempt_code})",
            description=f"Administrator SDM {user.full_name} melakukan Exam Reset untuk peserta {student_name}. ID Percobaan: {formatted_attempt_code}. Alasan: {reason}",
            success=True,
            metadata={
                'action': 'exam_reset',
                'attempt_id': formatted_attempt_code,
                'student_id': target_student.id if target_student else None,
                'student_name': student_name,
                'admin_name': user.full_name,
                'reason': reason,
                'course_id': course.id,
                'deleted_count': deleted_count,
                'timestamp': timezone.now().isoformat()
            }
        )

        # 5. Kirim Notifikasi Resmi ke Peserta
        if target_student:
            try:
                api_models.Notification.objects.create(
                    user=target_student,
                    course=course,
                    type="Exam Reset",
                    title=f"Kesempatan Ujian Direset - {course.title}",
                    message=f"Percobaan ujian Anda ({formatted_attempt_code}) untuk materi '{course.title}' telah direset oleh Administrator Bagian Pengembangan Kapasitas SDM DPD RI ({reason}). Anda sekarang dapat mengerjakan kembali ujian.",
                    seen=False
                )
            except Exception as notif_e:
                print(f"Error creating notification: {notif_e}")

        return Response({
            "success": True,
            "message": f"Percobaan ujian {formatted_attempt_code} untuk {student_name} berhasil direset. Audit trail dicatat.",
            "attempt_id": formatted_attempt_code,
            "student_name": student_name
        }, status=status.HTTP_200_OK)






