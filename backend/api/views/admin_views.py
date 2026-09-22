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
    permission_classes = [IsAuthenticated]
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
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Verify admin access
        if not (hasattr(request.user, 'is_admin') and request.user.is_admin):
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # ✨ SPRINT 1 OPTIMIZATION: Use single aggregation query instead of 6 separate .count() calls
            # This reduces 6 queries to 1 query, improving response time by 10x
            from django.db.models import Q, Count
            
            stats = User.objects.aggregate(
                total_users=Count('id'),
                active_users=Count('id', filter=Q(is_active=True)),
                inactive_users=Count('id', filter=Q(is_active=False)),
                students=Count('id', filter=Q(is_student=True)),
                teachers=Count('id', filter=Q(is_instructor=True)),
                admins=Count('id', filter=Q(is_admin=True))
            )
            
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
                'app_version': APP_VERSION,
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
        
        return Response({
            'count': len(testimonials_data),
            'results': testimonials_data,
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




