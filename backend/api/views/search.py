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




class EmployeeInfoOptionsAPIView(generics.GenericAPIView):
    """
    GET /api/v1/employee/options/
    Get dropdown options for employee information (organizations, positions, golongan, jenis_jabatan)
    Used for employee profile editing
    
    ✨ PHASE 5.2: Reads actual values from database to ensure options match real data
    
    Returns:
    {
        "organizations": [{"id": 1, "name": "Bidang Humas"}, ...],  // From OrganizationUnit table
        "positions": [{"id": 1, "name": "Kepala Bagian"}, ...],     // From Position table
        "golongan": ["I/a", "II/a", "III/c", ...],                 // Distinct values from User.golongan
        "jenis_jabatan": ["Struktural", "Fungsional", ...]         // Distinct values from User.jenis_jabatan
    }
    
    Note: golongan and jenis_jabatan lists are dynamically generated from database values,
    not hardcoded. This ensures dropdown options always match the actual user data.
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        try:
            # ✨ PHASE 4.12.3: Get all organization units
            from userauths.models import OrganizationUnit, Position
            
            organizations = OrganizationUnit.objects.all().values('id', 'name').order_by('name')
            positions = Position.objects.all().values('id', 'name').order_by('name')
            
            # ✨ PHASE 5.2: Read actual golongan values from database instead of hardcoded list
            # This ensures dropdown options match the actual data in the system
            golongan_choices = list(
                User.objects.filter(
                    golongan__isnull=False
                ).exclude(
                    golongan=''
                ).values_list('golongan', flat=True).distinct().order_by('golongan')
            )
            
            # Fallback to standard government golongan if no data in database
            if not golongan_choices:
                golongan_choices = [
                    "I/a", "I/b", "I/c", "I/d",
                    "II/a", "II/b", "II/c", "II/d",
                    "III/a", "III/b", "III/c", "III/d",
                    "IV/a", "IV/b", "IV/c", "IV/d", "IV/e"
                ]
            
            # ✨ PHASE 5.2: Read actual jenis_jabatan values from database instead of hardcoded list
            # This ensures dropdown options match the actual data in the system
            jenis_jabatan_choices = list(
                User.objects.filter(
                    jenis_jabatan__isnull=False
                ).exclude(
                    jenis_jabatan=''
                ).values_list('jenis_jabatan', flat=True).distinct().order_by('jenis_jabatan')
            )
            
            # Fallback to standard position types if no data in database
            if not jenis_jabatan_choices:
                jenis_jabatan_choices = [
                    "Struktural",      # Structural position
                    "Fungsional",      # Functional position
                    "Ahli",            # Expert/Specialist position
                    "Reguler"          # Regular position
                ]
            
            print(f"📊 Employee info options loaded from database:")
            print(f"   - Golongan: {len(golongan_choices)} unique values")
            print(f"   - Jenis Jabatan: {len(jenis_jabatan_choices)} unique values")
            
            return Response({
                'organizations': list(organizations),
                'positions': list(positions),
                'golongan': golongan_choices,
                'jenis_jabatan': jenis_jabatan_choices
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"Error in EmployeeInfoOptionsAPIView: {str(e)}")
            return Response({
                'error': str(e),
                'organizations': [],
                'positions': [],
                'golongan': [],
                'jenis_jabatan': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




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




