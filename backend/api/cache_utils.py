"""
PHASE 4.9: Caching Layer Implementation
Redis-based caching for search results, analytics, and suggestions
"""

from django.core.cache import cache
from django.views.decorators.cache import cache_page
from functools import wraps
import hashlib
import json
from datetime import timedelta


class CacheConfig:
    """Cache configuration and timeouts"""
    
    # Cache timeout durations (in seconds)
    SEARCH_RESULTS_CACHE_TIMEOUT = 300  # 5 minutes
    SUGGESTIONS_CACHE_TIMEOUT = 600  # 10 minutes
    TRENDING_SEARCHES_CACHE_TIMEOUT = 900  # 15 minutes
    DASHBOARD_CACHE_TIMEOUT = 300  # 5 minutes
    ANALYTICS_SUMMARY_CACHE_TIMEOUT = 600  # 10 minutes
    CATEGORY_FILTER_CACHE_TIMEOUT = 3600  # 1 hour
    TEACHER_FILTER_CACHE_TIMEOUT = 3600  # 1 hour
    
    # Cache key prefixes
    SEARCH_PREFIX = "search:"
    SUGGESTION_PREFIX = "suggestion:"
    TRENDING_PREFIX = "trending:"
    DASHBOARD_PREFIX = "dashboard:"
    ANALYTICS_PREFIX = "analytics:"
    FILTER_PREFIX = "filter:"


def generate_cache_key(prefix, **kwargs):
    """
    Generate consistent cache key from parameters
    
    Args:
        prefix: Cache key prefix
        **kwargs: Parameters to include in key
    
    Returns:
        Unique cache key string
    """
    # Sort kwargs for consistent key generation
    sorted_params = sorted(kwargs.items())
    params_str = json.dumps(sorted_params, sort_keys=True, default=str)
    
    # Create hash to keep key length reasonable
    params_hash = hashlib.md5(params_str.encode()).hexdigest()
    
    return f"{prefix}{params_hash}"


def cache_search_results(timeout=None):
    """
    Decorator to cache search results
    
    Usage:
        @cache_search_results(timeout=300)
        def my_search_view(self, request):
            ...
    """
    if timeout is None:
        timeout = CacheConfig.SEARCH_RESULTS_CACHE_TIMEOUT
    
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            # Generate cache key from request parameters
            cache_key = generate_cache_key(
                CacheConfig.SEARCH_PREFIX,
                query=request.query_params.get('query'),
                category=request.query_params.get('category'),
                level=request.query_params.get('level'),
                rating=request.query_params.get('rating'),
                teacher=request.query_params.get('teacher'),
                page=request.query_params.get('page', 1)
            )
            
            # Try to get from cache
            cached_data = cache.get(cache_key)
            if cached_data is not None:
                return cached_data
            
            # Execute view
            response = view_func(self, request, *args, **kwargs)
            
            # Cache the response
            cache.set(cache_key, response, timeout)
            
            return response
        
        return wrapper
    return decorator


def cache_suggestions(timeout=None):
    """
    Decorator to cache autocomplete suggestions
    
    Usage:
        @cache_suggestions(timeout=600)
        def my_suggestions_view(self, request):
            ...
    """
    if timeout is None:
        timeout = CacheConfig.SUGGESTIONS_CACHE_TIMEOUT
    
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            query = request.query_params.get('q', '')
            
            # Only cache queries >= 2 characters
            if len(query) < 2:
                return view_func(self, request, *args, **kwargs)
            
            cache_key = generate_cache_key(
                CacheConfig.SUGGESTION_PREFIX,
                query=query.lower()
            )
            
            # Try to get from cache
            cached_data = cache.get(cache_key)
            if cached_data is not None:
                return cached_data
            
            # Execute view
            response = view_func(self, request, *args, **kwargs)
            
            # Cache the response
            cache.set(cache_key, response, timeout)
            
            return response
        
        return wrapper
    return decorator


class SearchCacheManager:
    """Manage search caching operations"""
    
    @staticmethod
    def get_cached_search(query, filters=None, page=1):
        """
        Retrieve cached search results
        
        Args:
            query: Search query string
            filters: Dictionary of filters
            page: Page number
        
        Returns:
            Cached data or None
        """
        cache_key = generate_cache_key(
            CacheConfig.SEARCH_PREFIX,
            query=query,
            filters=json.dumps(filters or {}),
            page=page
        )
        return cache.get(cache_key)
    
    @staticmethod
    def cache_search(query, data, filters=None, page=1, timeout=None):
        """
        Cache search results
        
        Args:
            query: Search query string
            data: Data to cache
            filters: Dictionary of filters
            page: Page number
            timeout: Cache timeout in seconds
        """
        if timeout is None:
            timeout = CacheConfig.SEARCH_RESULTS_CACHE_TIMEOUT
        
        cache_key = generate_cache_key(
            CacheConfig.SEARCH_PREFIX,
            query=query,
            filters=json.dumps(filters or {}),
            page=page
        )
        cache.set(cache_key, data, timeout)
    
    @staticmethod
    def invalidate_search_cache(query=None, filters=None):
        """
        Invalidate search cache
        
        Args:
            query: Specific query to invalidate (optional)
            filters: Specific filters to invalidate (optional)
        """
        if query and filters:
            # Invalidate specific search
            cache_key = generate_cache_key(
                CacheConfig.SEARCH_PREFIX,
                query=query,
                filters=json.dumps(filters)
            )
            cache.delete(cache_key)
        else:
            # Invalidate all search results (pattern delete)
            # Note: Redis KEYS pattern matching is used here
            cache.delete_many([
                key for key in cache.keys(f"{CacheConfig.SEARCH_PREFIX}*")
            ])


class TrendingCacheManager:
    """Manage trending searches caching"""
    
    @staticmethod
    def get_cached_trending(days=7, limit=10):
        """Get cached trending searches"""
        cache_key = generate_cache_key(
            CacheConfig.TRENDING_PREFIX,
            days=days,
            limit=limit
        )
        return cache.get(cache_key)
    
    @staticmethod
    def cache_trending(data, days=7, limit=10, timeout=None):
        """Cache trending searches"""
        if timeout is None:
            timeout = CacheConfig.TRENDING_SEARCHES_CACHE_TIMEOUT
        
        cache_key = generate_cache_key(
            CacheConfig.TRENDING_PREFIX,
            days=days,
            limit=limit
        )
        cache.set(cache_key, data, timeout)
    
    @staticmethod
    def invalidate_trending():
        """Clear all trending cache"""
        cache.delete_many([
            key for key in cache.keys(f"{CacheConfig.TRENDING_PREFIX}*")
        ])


class DashboardCacheManager:
    """Manage dashboard analytics caching"""
    
    @staticmethod
    def get_cached_dashboard(period='weekly', days=7):
        """Get cached dashboard data"""
        cache_key = generate_cache_key(
            CacheConfig.DASHBOARD_PREFIX,
            period=period,
            days=days
        )
        return cache.get(cache_key)
    
    @staticmethod
    def cache_dashboard(data, period='weekly', days=7, timeout=None):
        """Cache dashboard data"""
        if timeout is None:
            timeout = CacheConfig.DASHBOARD_CACHE_TIMEOUT
        
        cache_key = generate_cache_key(
            CacheConfig.DASHBOARD_PREFIX,
            period=period,
            days=days
        )
        cache.set(cache_key, data, timeout)
    
    @staticmethod
    def invalidate_dashboard():
        """Clear all dashboard cache"""
        cache.delete_many([
            key for key in cache.keys(f"{CacheConfig.DASHBOARD_PREFIX}*")
        ])


class FilterCacheManager:
    """Manage filter options caching"""
    
    @staticmethod
    def get_cached_categories():
        """Get cached category filter"""
        cache_key = f"{CacheConfig.FILTER_PREFIX}categories"
        return cache.get(cache_key)
    
    @staticmethod
    def cache_categories(data, timeout=None):
        """Cache category filters"""
        if timeout is None:
            timeout = CacheConfig.CATEGORY_FILTER_CACHE_TIMEOUT
        
        cache_key = f"{CacheConfig.FILTER_PREFIX}categories"
        cache.set(cache_key, data, timeout)
    
    @staticmethod
    def get_cached_teachers():
        """Get cached teacher filter"""
        cache_key = f"{CacheConfig.FILTER_PREFIX}teachers"
        return cache.get(cache_key)
    
    @staticmethod
    def cache_teachers(data, timeout=None):
        """Cache teacher filters"""
        if timeout is None:
            timeout = CacheConfig.TEACHER_FILTER_CACHE_TIMEOUT
        
        cache_key = f"{CacheConfig.FILTER_PREFIX}teachers"
        cache.set(cache_key, data, timeout)
    
    @staticmethod
    def invalidate_filters():
        """Clear all filter cache"""
        cache.delete_many([
            key for key in cache.keys(f"{CacheConfig.FILTER_PREFIX}*")
        ])


# Cache invalidation signals
def invalidate_search_on_course_change(sender, instance, **kwargs):
    """
    Signal handler to invalidate search cache when course is updated
    
    Usage:
        post_save.connect(invalidate_search_on_course_change, sender=Course)
    """
    SearchCacheManager.invalidate_search_cache()
    TrendingCacheManager.invalidate_trending()
    DashboardCacheManager.invalidate_dashboard()


def invalidate_filters_on_change(sender, instance, **kwargs):
    """
    Signal handler to invalidate filter cache when categories/teachers change
    """
    FilterCacheManager.invalidate_filters()
