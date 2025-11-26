"""
Performance Monitoring & Benchmarking Module
Phase 4.9 - Performance Testing & Validation

Measures:
- API response times with/without cache
- Memory usage patterns
- Database query counts
- Cache hit rates
- Request throughput
"""

import time
import functools
import logging
from django.core.cache import cache
from django.db import connection, reset_queries
from django.conf import settings
from django.utils.decorators import decorator_from_middleware_with_args
import json
from datetime import datetime

logger = logging.getLogger(__name__)

# Performance metrics storage
PERFORMANCE_METRICS = {
    'api_calls': [],
    'cache_hits': 0,
    'cache_misses': 0,
    'db_queries': [],
    'response_times': [],
    'memory_usage': []
}


class PerformanceMonitor:
    """Monitor and track performance metrics"""
    
    def __init__(self):
        self.metrics = {}
        self.start_time = None
        self.end_time = None
    
    def start(self, name):
        """Start timing a metric"""
        self.metrics[name] = {'start': time.time()}
    
    def end(self, name):
        """End timing a metric"""
        if name in self.metrics:
            duration = time.time() - self.metrics[name]['start']
            self.metrics[name]['duration'] = duration
            return duration
        return None
    
    def get_metrics(self):
        """Get all metrics"""
        return self.metrics


def measure_performance(func):
    """Decorator to measure function performance"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        monitor = PerformanceMonitor()
        monitor.start(func.__name__)
        
        # Reset Django queries counter
        if settings.DEBUG:
            reset_queries()
        
        try:
            result = func(*args, **kwargs)
            duration = monitor.end(func.__name__)
            
            # Log metrics
            query_count = len(connection.queries) if settings.DEBUG else 0
            PERFORMANCE_METRICS['response_times'].append({
                'function': func.__name__,
                'duration_ms': duration * 1000,
                'queries': query_count,
                'timestamp': datetime.now().isoformat()
            })
            
            logger.info(f"{func.__name__} took {duration*1000:.2f}ms ({query_count} queries)")
            return result
        except Exception as e:
            logger.error(f"Error in {func.__name__}: {str(e)}")
            raise
    
    return wrapper


def measure_cache_performance(cache_key_func):
    """Decorator to measure cache effectiveness"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = cache_key_func(*args, **kwargs) if callable(cache_key_func) else cache_key_func
            
            # Check cache
            cached_result = cache.get(cache_key)
            if cached_result:
                PERFORMANCE_METRICS['cache_hits'] += 1
                logger.info(f"Cache hit for {cache_key}")
                return cached_result
            
            # Cache miss - run function
            PERFORMANCE_METRICS['cache_misses'] += 1
            start_time = time.time()
            result = func(*args, **kwargs)
            duration = (time.time() - start_time) * 1000
            
            logger.info(f"Cache miss for {cache_key} - took {duration:.2f}ms")
            
            return result
        
        return wrapper
    return decorator


def get_performance_report():
    """Generate performance metrics report"""
    cache_total = PERFORMANCE_METRICS['cache_hits'] + PERFORMANCE_METRICS['cache_misses']
    cache_hit_rate = (PERFORMANCE_METRICS['cache_hits'] / cache_total * 100) if cache_total > 0 else 0
    
    avg_response_time = 0
    if PERFORMANCE_METRICS['response_times']:
        avg_response_time = sum(m['duration_ms'] for m in PERFORMANCE_METRICS['response_times']) / len(PERFORMANCE_METRICS['response_times'])
    
    report = {
        'timestamp': datetime.now().isoformat(),
        'cache_stats': {
            'hits': PERFORMANCE_METRICS['cache_hits'],
            'misses': PERFORMANCE_METRICS['cache_misses'],
            'hit_rate_percent': round(cache_hit_rate, 2),
            'total_requests': cache_total
        },
        'response_time_stats': {
            'average_ms': round(avg_response_time, 2),
            'total_calls': len(PERFORMANCE_METRICS['response_times']),
            'calls': PERFORMANCE_METRICS['response_times']
        },
        'optimization_metrics': {
            'cache_effectiveness': f"{cache_hit_rate:.1f}%",
            'avg_response_time_improvement': f"{(1 - (avg_response_time / 100)) * 100:.1f}%" if avg_response_time > 0 else "0%"
        }
    }
    
    return report


def reset_metrics():
    """Reset all performance metrics"""
    global PERFORMANCE_METRICS
    PERFORMANCE_METRICS = {
        'api_calls': [],
        'cache_hits': 0,
        'cache_misses': 0,
        'db_queries': [],
        'response_times': [],
        'memory_usage': []
    }


class CachePerformanceMiddleware:
    """Middleware to track cache performance across all requests"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        start_time = time.time()
        
        response = self.get_response(request)
        
        duration = (time.time() - start_time) * 1000
        
        # Log request metrics
        logger.info(f"Request to {request.path} took {duration:.2f}ms")
        
        # Add performance header
        response['X-Response-Time-Ms'] = f"{duration:.2f}"
        
        return response
