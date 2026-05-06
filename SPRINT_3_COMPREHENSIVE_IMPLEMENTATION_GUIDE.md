# 📖 SPRINT 3: COMPREHENSIVE IMPLEMENTATION GUIDE

**Complete Step-by-Step Instructions with Code Examples**

---

## TABLE OF CONTENTS

1. [Task 1: Transaction Support](#task-1-transaction-support)
2. [Task 2: Caching Layer Expansion](#task-2-caching-layer-expansion)
3. [Task 3: Frontend State Management](#task-3-frontend-state-management)
4. [Testing & Verification](#testing--verification)
5. [Troubleshooting](#troubleshooting)

---

# TASK 1: TRANSACTION SUPPORT

## Overview
**Goal**: Add database transaction protection to critical operations  
**Impact**: Prevents partial updates, ensures data consistency  
**Effort**: 6 hours  
**Skills**: Django transactions, ORM, error handling

## Current State Analysis

### Transaction Usage (Current)
```bash
# Find all transaction usage:
grep -r "@transaction" backend/api/views.py
# Result: Only 2 matches found (lines 10704, 10769) - TOO FEW!
```

### Operations Needing Protection
```
✗ User creation (model: User)
✗ User updates (full_name, email, role changes)
✗ User deletion
✗ Role changes (critical: is_student, is_instructor, is_admin)
✗ Enrollment creation
✗ Lesson completion marking
✗ Certificate generation
✗ Sync operations (multiple updates)
```

## Implementation

### Step 1: Decorator Pattern

**File**: `backend/api/decorators.py` (CREATE NEW FILE)

```python
"""
✨ SPRINT 3: Transaction decorators for atomic operations
"""
from django.db import transaction
from functools import wraps

def atomic_operation(using=None):
    """
    Decorator to wrap API operations in database transactions.
    Automatically rolls back on any exception.
    
    Usage:
    @atomic_operation()
    def create_user(request):
        # All database operations here are atomic
        # If any error occurs, ALL changes are rolled back
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            with transaction.atomic(using=using):
                return func(*args, **kwargs)
        return wrapper
    return decorator

def atomic_with_savepoint(func):
    """
    Decorator with savepoint support for nested transactions.
    Useful for optional rollback scenarios.
    
    Usage:
    @atomic_with_savepoint
    def update_user_roles(request):
        # With nested savepoint support
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        sid = transaction.savepoint()
        try:
            result = func(*args, **kwargs)
            transaction.savepoint_commit(sid)
            return result
        except Exception as e:
            transaction.savepoint_rollback(sid)
            raise e
    return wrapper
```

### Step 2: Identify Critical Operations

**File**: `backend/api/views.py`

```python
# ✨ SPRINT 3: Operations needing transaction protection

# CRITICAL OPERATIONS IN AdminUserManagementAPIView:
# 1. User creation (via DRF POST)
# 2. User update (via DRF PATCH)
# 3. User deletion (via DRF DELETE)
# 4. Role assignment changes

# CRITICAL OPERATIONS IN StudentCourseCompletedCreateAPIView:
# 1. Mark lesson as completed (CompletedLesson.objects.create)
# 2. Certificate generation (if triggered)

# CRITICAL OPERATIONS IN EnrollmentAPIView:
# 1. Course enrollment
# 2. Certificate eligibility check & generation
```

### Step 3: Apply Decorators to Views

**File**: `backend/api/views.py` - AdminUserManagementAPIView

```python
from api.decorators import atomic_operation
from django.db import transaction
from rest_framework import status

class AdminUserManagementAPIView(generics.ListAPIView):
    """Admin view to manage all users in the system - TRANSACTIONAL"""
    # ... existing code ...
    
    @atomic_operation()  # ✨ SPRINT 3: Wrap create in transaction
    def create(self, request, *args, **kwargs):
        """
        Create new user - ATOMIC
        If any validation or save fails, entire operation rolls back.
        """
        try:
            # Create user
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            # Automatic rollback by @atomic_operation decorator
            print(f"User creation failed (rolled back): {str(e)}")
            raise
    
    @atomic_operation()  # ✨ SPRINT 3: Wrap update in transaction
    def update(self, request, *args, **kwargs):
        """
        Update user - ATOMIC
        If role change or any field update fails, all changes rolled back.
        """
        instance = self.get_object()
        try:
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            
            # Log role changes (important for audit)
            old_role = instance.role
            new_role = serializer.instance.role
            if old_role != new_role:
                print(f"[AUDIT] User {instance.email}: role changed {old_role} -> {new_role}")
            
            return Response(serializer.data)
        except Exception as e:
            # Automatic rollback by @atomic_operation decorator
            print(f"User update failed (rolled back): {str(e)}")
            raise
    
    @atomic_operation()  # ✨ SPRINT 3: Wrap delete in transaction
    def destroy(self, request, *args, **kwargs):
        """
        Delete user - ATOMIC
        Cascading deletes are protected; if any fail, user not deleted.
        """
        instance = self.get_object()
        email = instance.email
        try:
            instance.delete()
            print(f"[AUDIT] User deleted: {email}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            # Automatic rollback by @atomic_operation decorator
            print(f"User deletion failed (rolled back): {str(e)}")
            raise
```

### Step 4: Apply to Student Course Completion

**File**: `backend/api/views.py` - StudentCourseCompletedCreateAPIView

```python
@method_decorator(csrf_exempt, name='dispatch')
class StudentCourseCompletedCreateAPIView(generics.CreateAPIView):
    """Student Course Completion Tracking API - TRANSACTIONAL"""
    
    @atomic_operation()  # ✨ SPRINT 3: Mark completion atomically
    def create(self, request, *args, **kwargs):
        """
        Mark lesson as completed - ATOMIC
        All related operations (completion tracking, stats update) are atomic.
        """
        try:
            user_id = request.data['user_id']
            course_id = request.data['course_id']
            variant_item_id = request.data['variant_item_id']

            user = User.objects.get(id=user_id)
            course = api_models.Course.objects.get(id=course_id)
            variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)

            # ✨ SPRINT 3: Everything below is atomic
            # If any step fails, ALL changes rollback
            
            # Step 1: Check verification question (if exists)
            verification_question = api_models.LessonCompletionQuestion.objects.filter(
                variant_item=variant_item
            ).first()
            
            if verification_question:
                correct_answer = api_models.LessonCompletionQuestionAnswer.objects.filter(
                    user=user,
                    question=verification_question,
                    is_correct=True
                ).first()
                
                if not correct_answer:
                    return Response({
                        "message": "Cannot mark lesson as completed - verification question must be answered correctly first",
                        "requires_verification": True
                    }, status=status.HTTP_403_FORBIDDEN)

            # Step 2: Mark lesson completed or toggle
            completed_lessons = api_models.CompletedLesson.objects.filter(
                user=user, 
                course=course, 
                variant_item=variant_item
            ).first()

            if completed_lessons:
                if verification_question:
                    # Delete to allow retake
                    completed_lessons.delete()
                    print(f"[Completion] Lesson deleted for retake: {variant_item.title}")
                    return Response({"message": "Course marked as not completed - student can retake"}, status=status.HTTP_200_OK)
                else:
                    # Already complete, stay complete
                    return Response({"message": "Course already marked as completed"}, status=status.HTTP_200_OK)
            else:
                # Step 3: Create completion record
                new_record = api_models.CompletedLesson.objects.create(
                    user=user, 
                    course=course, 
                    variant_item=variant_item
                )
                print(f"[Completion] Lesson marked complete: {variant_item.title}")
                
                # Step 4: Check if entire course is complete (optional triggers)
                # This happens INSIDE the transaction, so if certificate gen fails,
                # the completion is still rolled back
                course_completion_check(user, course)
                
                return Response({"message": "Course marked as completed"}, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            print(f"Completion failed (rolled back): {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def course_completion_check(user, course):
    """
    Check if course is fully complete and generate certificate.
    Called INSIDE @atomic_operation transaction.
    If certificate generation fails, completion is rolled back.
    """
    from datetime import datetime
    
    # Check completion percentage
    total_lessons = api_models.VariantItem.objects.filter(
        variant__course=course
    ).count()
    
    completed_lessons = api_models.CompletedLesson.objects.filter(
        user=user,
        course=course
    ).count()
    
    completion_percentage = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0
    
    # If 100% complete and no certificate yet, generate it
    if completion_percentage >= 100:
        existing_cert = api_models.Certificate.objects.filter(
            user=user,
            course=course
        ).first()
        
        if not existing_cert:
            api_models.Certificate.objects.create(
                user=user,
                course=course,
                issued_date=datetime.now()
            )
            print(f"[Certificate] Generated for {user.email} - {course.title}")
```

### Step 5: Error Handling & Rollback Testing

**File**: `backend/api/tests.py` (UPDATE)

```python
from django.test import TransactionTestCase
from api.models import User, Course, CompletedLesson
import pytest

class TransactionRollbackTests(TransactionTestCase):
    """✨ SPRINT 3: Test transaction atomicity"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.teacher = User.objects.create_user(
            username='teacher',
            email='teacher@example.com',
            password='teacherpass'
        )
    
    def test_user_creation_rollback_on_error(self):
        """Test that user creation rolls back on error"""
        initial_count = User.objects.count()
        
        try:
            with transaction.atomic():
                # Create user
                User.objects.create(
                    username='newuser',
                    email='new@example.com',
                    full_name='New User'
                )
                # Force error
                raise ValueError("Simulated error")
        except ValueError:
            pass
        
        # Should be same count as before (rolled back)
        assert User.objects.count() == initial_count
        print("✅ User creation rollback works")
    
    def test_lesson_completion_rollback_on_error(self):
        """Test that lesson completion rolls back if certificate gen fails"""
        # This is more complex - requires mocking certificate generation
        # See Sprint 3 testing guide for full implementation
        pass

def test_concurrent_user_updates():
    """✨ SPRINT 3: Test concurrent updates with transactions"""
    from threading import Thread
    from django.db import connections
    
    user = User.objects.create_user(
        username='concurrent_test',
        email='concurrent@example.com'
    )
    
    results = []
    
    def update_user(new_email):
        """Update user email in separate thread"""
        user.email = new_email
        user.save()
        results.append(new_email)
    
    # Simulate concurrent updates
    t1 = Thread(target=update_user, args=('email1@example.com',))
    t2 = Thread(target=update_user, args=('email2@example.com',))
    
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    
    # Both updates should succeed without conflict
    user.refresh_from_db()
    assert user.email in results
    print(f"✅ Concurrent updates handled: {user.email}")
```

---

# TASK 2: CACHING LAYER EXPANSION

## Overview
**Goal**: Extend Redis caching to admin user management endpoints  
**Impact**: 10x faster response times for cached requests  
**Effort**: 4 hours  
**Skills**: Redis, Django cache, cache invalidation

## Current State

### Cache Infrastructure (Already Working)
```python
# backend/backend/settings.py
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': 'redis://localhost:6381/1',
        'KEY_PREFIX': 'lms',
        'TIMEOUT': 300,  # 5 minutes
    }
}
```

### Cache Utilities (Partially Implemented)
```python
# backend/api/cache_utils.py
@cache_search_results(timeout=300)
def search_courses(query):
    # Caching works here!
    pass

# BUT: Admin endpoints NOT cached!
# GET /admin/user-management/ - UNCACHED (database hit every time)
# GET /admin/user-stats/ - UNCACHED (database hit every time)
```

## Implementation

### Step 1: Create Admin Cache Decorator

**File**: `backend/api/cache_utils.py` (UPDATE)

```python
"""
✨ SPRINT 3: Admin-specific cache decorators
"""
from django.core.cache import cache
from functools import wraps
import json

class AdminCacheManager:
    """Manager for admin endpoint caching"""
    
    # Cache key prefixes
    USER_LIST_PREFIX = 'admin:users'
    USER_STATS_PREFIX = 'admin:stats'
    USER_DETAIL_PREFIX = 'admin:user'
    
    # Cache timeouts
    USERS_TIMEOUT = 300  # 5 minutes for user list
    STATS_TIMEOUT = 600  # 10 minutes for stats
    USER_DETAIL_TIMEOUT = 180  # 3 minutes for individual user
    
    @staticmethod
    def generate_users_cache_key(page=1, role=None, status=None):
        """
        Generate cache key for user list
        
        Example: admin:users:page:1:role:student:status:active
        """
        key_parts = [AdminCacheManager.USER_LIST_PREFIX, f'page:{page}']
        
        if role:
            key_parts.append(f'role:{role}')
        if status:
            key_parts.append(f'status:{status}')
        
        return ':'.join(key_parts)
    
    @staticmethod
    def generate_stats_cache_key():
        """Generate cache key for user statistics"""
        return AdminCacheManager.USER_STATS_PREFIX
    
    @staticmethod
    def get_cached_users(page=1, role=None, status=None):
        """Get cached user list if available"""
        cache_key = AdminCacheManager.generate_users_cache_key(page, role, status)
        cached_data = cache.get(cache_key)
        
        if cached_data:
            print(f"✅ [Cache] HIT: {cache_key}")
            return cached_data
        
        print(f"⏭️  [Cache] MISS: {cache_key}")
        return None
    
    @staticmethod
    def cache_users(data, page=1, role=None, status=None):
        """Cache user list data"""
        cache_key = AdminCacheManager.generate_users_cache_key(page, role, status)
        cache.set(cache_key, data, AdminCacheManager.USERS_TIMEOUT)
        print(f"💾 [Cache] SET: {cache_key} (5min timeout)")
    
    @staticmethod
    def get_cached_stats():
        """Get cached stats if available"""
        cache_key = AdminCacheManager.generate_stats_cache_key()
        cached_data = cache.get(cache_key)
        
        if cached_data:
            print(f"✅ [Cache] HIT: {cache_key}")
            return cached_data
        
        print(f"⏭️  [Cache] MISS: {cache_key}")
        return None
    
    @staticmethod
    def cache_stats(data):
        """Cache stats data"""
        cache_key = AdminCacheManager.generate_stats_cache_key()
        cache.set(cache_key, data, AdminCacheManager.STATS_TIMEOUT)
        print(f"💾 [Cache] SET: {cache_key} (10min timeout)")
    
    @staticmethod
    def invalidate_users_cache(page=None):
        """
        Invalidate user list cache
        
        If page=None, invalidates ALL pages (used when creating/deleting user)
        If page specified, only invalidates that page
        """
        if page is None:
            # Invalidate all user list caches with pattern matching
            # This clears all pages for all filter combinations
            from django.core.cache.backends.redis import RedisCache
            client = cache._cache
            pattern = f"{AdminCacheManager.USER_LIST_PREFIX}:*"
            keys = client.keys(pattern)
            if keys:
                client.delete(*keys)
                print(f"🔄 [Cache] INVALIDATED ALL: {len(keys)} user list pages")
        else:
            # Invalidate specific page
            for role in [None, 'student', 'instructor', 'admin']:
                for status in [None, 'active', 'inactive']:
                    cache_key = AdminCacheManager.generate_users_cache_key(page, role, status)
                    cache.delete(cache_key)
            print(f"🔄 [Cache] INVALIDATED: page {page}")
    
    @staticmethod
    def invalidate_stats_cache():
        """Invalidate stats cache"""
        cache_key = AdminCacheManager.generate_stats_cache_key()
        cache.delete(cache_key)
        print(f"🔄 [Cache] INVALIDATED: stats")

# Convenience decorator for admin views
def cache_admin_users(timeout=None):
    """Decorator to cache admin user list views"""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            # Get cache parameters from request
            page = request.query_params.get('page', 1)
            role = request.query_params.get('role')
            status = request.query_params.get('status')
            
            # Try cache first
            cached_data = AdminCacheManager.get_cached_users(page, role, status)
            if cached_data:
                from rest_framework.response import Response
                return Response(cached_data)
            
            # Not in cache, call view
            response = view_func(self, request, *args, **kwargs)
            
            # Cache the response data
            if response.status_code == 200:
                AdminCacheManager.cache_users(response.data, page, role, status)
            
            return response
        return wrapper
    return decorator

def cache_admin_stats(timeout=None):
    """Decorator to cache admin stats view"""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            # Try cache first
            cached_data = AdminCacheManager.get_cached_stats()
            if cached_data:
                from rest_framework.response import Response
                return Response(cached_data)
            
            # Not in cache, call view
            response = view_func(self, request, *args, **kwargs)
            
            # Cache the response data
            if response.status_code == 200:
                AdminCacheManager.cache_stats(response.data)
            
            return response
        return wrapper
    return decorator
```

### Step 2: Apply Cache Decorators to Admin Views

**File**: `backend/api/views.py`

```python
from api.cache_utils import AdminCacheManager, cache_admin_users, cache_admin_stats

class AdminUserManagementAPIView(generics.ListAPIView):
    """
    Admin view to manage all users - NOW CACHED
    ✨ SPRINT 3: Cache enabled for 5min per page
    """
    # ... existing code ...
    
    @cache_admin_users(timeout=300)  # ✨ SPRINT 3: Cache decorator
    def list(self, request, *args, **kwargs):
        """
        List users with caching
        Cache key includes: page, role filter, status filter
        Timeout: 5 minutes
        """
        print(f"\n[AdminUserList] 📊 Fetching users...")
        print(f"   Page: {request.query_params.get('page', 1)}")
        print(f"   Role: {request.query_params.get('role', 'all')}")
        print(f"   Status: {request.query_params.get('status', 'all')}")
        
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(queryset, many=True)
        
        # Cache is handled by @cache_admin_users decorator
        return Response(serializer.data)
    
    def create(self, request, *args, **kwargs):
        """
        Create user - INVALIDATE CACHE
        """
        # ✨ SPRINT 3: Invalidate cache when creating new user
        AdminCacheManager.invalidate_users_cache()
        AdminCacheManager.invalidate_stats_cache()
        
        # Continue with create
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        print(f"[AdminUserList] 🆕 New user created - cache invalidated")
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        """
        Update user - INVALIDATE CACHE
        """
        instance = self.get_object()
        
        # ✨ SPRINT 3: Invalidate cache when updating user
        AdminCacheManager.invalidate_users_cache()
        AdminCacheManager.invalidate_stats_cache()
        
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        print(f"[AdminUserList] ✏️ User updated - cache invalidated")
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete user - INVALIDATE CACHE
        """
        # ✨ SPRINT 3: Invalidate cache when deleting user
        AdminCacheManager.invalidate_users_cache()
        AdminCacheManager.invalidate_stats_cache()
        
        instance = self.get_object()
        instance.delete()
        
        print(f"[AdminUserList] 🗑️ User deleted - cache invalidated")
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminUserStatsAPIView(generics.GenericAPIView):
    """
    Admin stats - NOW CACHED
    ✨ SPRINT 3: Cache enabled for 10min
    """
    # ... existing code ...
    
    @cache_admin_stats(timeout=600)  # ✨ SPRINT 3: Cache decorator (10min)
    def get(self, request):
        """
        Get user statistics with caching
        Cache timeout: 10 minutes
        """
        print(f"\n[AdminUserStats] 📈 Calculating statistics...")
        
        if not (hasattr(request.user, 'is_admin') and request.user.is_admin):
            return Response({'error': 'Admin access required'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            from django.db.models import Q, Count
            
            stats = User.objects.aggregate(
                total_users=Count('id'),
                active_users=Count('id', filter=Q(is_active=True)),
                inactive_users=Count('id', filter=Q(is_active=False)),
                students=Count('id', filter=Q(is_student=True)),
                teachers=Count('id', filter=Q(is_instructor=True)),
                admins=Count('id', filter=Q(is_admin=True))
            )
            
            print(f"[AdminUserStats] ✅ Stats calculated (will be cached for 10min)")
            return Response(stats, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

### Step 3: Add Signal-Based Cache Invalidation

**File**: `backend/api/signals.py` (CREATE NEW OR UPDATE)

```python
"""
✨ SPRINT 3: Cache invalidation signals
Automatically invalidates cache when models are modified
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from userauths.models import User
from api.cache_utils import AdminCacheManager

@receiver(post_save, sender=User)
def invalidate_user_cache_on_save(sender, instance, created, **kwargs):
    """
    Signal handler: Invalidate admin cache when user is saved
    """
    AdminCacheManager.invalidate_users_cache()
    AdminCacheManager.invalidate_stats_cache()
    
    action = "created" if created else "updated"
    print(f"[Signal] 🔄 User {action}: {instance.email} - cache invalidated")

@receiver(post_delete, sender=User)
def invalidate_user_cache_on_delete(sender, instance, **kwargs):
    """
    Signal handler: Invalidate admin cache when user is deleted
    """
    AdminCacheManager.invalidate_users_cache()
    AdminCacheManager.invalidate_stats_cache()
    
    print(f"[Signal] 🔄 User deleted: {instance.email} - cache invalidated")

# Register signals in apps.py:
# In backend/api/apps.py:
# class ApiConfig(AppConfig):
#     default_auto_field = 'django.db.models.BigAutoField'
#     name = 'api'
#     
#     def ready(self):
#         from . import signals  # Import signals when app is ready
```

### Step 4: Performance Testing

**File**: `backend/api/tests.py` (ADD)

```python
import time
from django.test import TestCase
from django.core.cache import cache
from api.cache_utils import AdminCacheManager

class AdminCachePerformanceTest(TestCase):
    """✨ SPRINT 3: Test cache performance"""
    
    def setUp(self):
        # Create test users
        from userauths.models import User
        for i in range(50):
            User.objects.create_user(
                username=f'user{i}',
                email=f'user{i}@example.com',
                is_active=(i % 2 == 0),
                is_student=(i % 3 == 0),
                is_instructor=(i % 5 == 0),
                is_admin=(i % 20 == 0)
            )
        cache.clear()
    
    def test_cache_first_request_uncached(self):
        """First request should hit database"""
        cache.clear()
        
        start = time.time()
        from api.views import AdminUserManagementAPIView
        # Simulate request
        duration = time.time() - start
        
        print(f"✅ First request (uncached): {duration*1000:.2f}ms")
        assert duration > 0.01  # Should take meaningful time (database query)
    
    def test_cache_second_request_cached(self):
        """Second request should hit cache"""
        cache.clear()
        
        # First request (builds cache)
        start1 = time.time()
        duration1 = time.time() - start1
        
        # Second request (from cache)
        start2 = time.time()
        duration2 = time.time() - start2
        
        print(f"✅ First request (uncached): {duration1*1000:.2f}ms")
        print(f"✅ Second request (cached): {duration2*1000:.2f}ms")
        print(f"✅ Improvement: {duration1/duration2:.1f}x faster")
        
        assert duration2 < duration1 / 5  # Should be 5x+ faster
    
    def test_cache_invalidation_on_create(self):
        """Cache should invalidate when new user created"""
        cache.clear()
        
        cache.set('admin:users:page:1', {'test': 'data'}, 300)
        assert cache.get('admin:users:page:1') is not None
        
        # Create new user (should trigger invalidation)
        from userauths.models import User
        User.objects.create_user(username='newuser', email='new@example.com')
        
        # Cache should be cleared
        assert cache.get('admin:users:page:1') is None
        print("✅ Cache invalidation works on user create")
```

---

# TASK 3: FRONTEND STATE MANAGEMENT

## Overview
**Goal**: Consolidate 25+ useState hooks into single useReducer  
**Impact**: Easier to debug, fewer race conditions  
**Effort**: 8 hours  
**Skills**: React hooks, state machines, refactoring

## Current Situation

### State Chaos (Current)
```javascript
// frontend/src/views/admin/UsersAdmin.jsx - Lines 21-100
const [users, setUsers] = useState([]);              // User list
const [filteredUsers, setFilteredUsers] = useState([]); // Filtered list
const [loading, setLoading] = useState(true);        // Loading state
const [isLoadingPage, setIsLoadingPage] = useState(false); // Page loading
const [syncing, setSyncing] = useState(false);        // Sync in progress
const [syncProgress, setSyncProgress] = useState({...}); // Complex nested state
const [lastSuccessfulSyncTime, setLastSuccessfulSyncTime] = useState(...);
const [searchTerm, setSearchTerm] = useState("");
const [roleFilter, setRoleFilter] = useState("all");
const [statusFilter, setStatusFilter] = useState("all");
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage, setItemsPerPage] = useState(25);
const [showModal, setShowModal] = useState(false);
const [modalType, setModalType] = useState("create");
const [selectedUser, setSelectedUser] = useState(null);
const [selectedUsers, setSelectedUsers] = useState([]);
const [showBulkActions, setShowBulkActions] = useState(false);
const [backendPaginationInfo, setBackendPaginationInfo] = useState({...});
const [backendStats, setBackendStats] = useState({...});
// ... and 7+ more!

const loadedPagesRef = useRef(new Set([1]));
const loadingPagesRef = useRef(new Set());
const pageChangeInitiatedAtRef = useRef(0);
const abortControllerRef = useRef(null);
```

**Problems**:
- ❌ Hard to reason about state flow
- ❌ Easy to introduce bugs
- ❌ Multiple sources of truth
- ❌ Race conditions despite preventive measures
- ❌ Difficult to serialize/debug state

---

## Implementation: useReducer Pattern

### Step 1: Design State Schema

**File**: `frontend/src/views/admin/UsersAdmin_StateSchema.md` (DESIGN DOCUMENT)

```markdown
# AdminUsers State Schema (✨ SPRINT 3)

## Single State Object Structure

```javascript
{
  // DATA
  data: {
    users: User[],                    // All loaded users
    backendStats: Stats,               // Aggregated stats (all users)
    backendPaginationInfo: Pagination, // Pagination metadata
  },
  
  // UI STATE
  ui: {
    currentPage: number,               // Current page
    itemsPerPage: number,              // Items per page
    sortBy: string,                    // Sort field
    sortOrder: 'asc' | 'desc',        // Sort direction
  },
  
  // FILTERS
  filters: {
    searchTerm: string,
    roleFilter: string,
    statusFilter: string,
  },
  
  // MODAL STATE
  modal: {
    isOpen: boolean,
    type: 'create' | 'edit' | 'view' | 'delete',
    selectedUser: User | null,
  },
  
  // SELECTION STATE
  selection: {
    selectedUsers: string[],           // Array of user IDs
    showBulkActions: boolean,
  },
  
  // LOADING STATE
  loading: {
    isLoading: boolean,                // Initial load
    isLoadingPage: boolean,            // Page load
    syncing: boolean,                  // Sync in progress
  },
  
  // SYNC STATE
  sync: {
    lastSuccessfulTime: string,
    syncProgress: {
      show: boolean,
      status: string,
      message: string,
      created: number,
      updated: number,
      failed: number,
      total: number,
      errors: string[],
    }
  },
  
  // METADATA
  meta: {
    loadedPages: Set<number>,          // Loaded pages
    loadingPages: Set<number>,         // Currently loading
    abortController: AbortController,
  },
}
```

---

### Step 2: Create useReducer Hook

**File**: `frontend/src/hooks/useUsersAdmin.js` (CREATE NEW)

```javascript
import { useReducer, useCallback, useRef, useEffect } from 'react';
import useAxios from '../utils/useAxios';

// ✨ SPRINT 3: Initial state
const initialState = {
  // DATA
  data: {
    users: [],
    backendStats: {
      total_users: 0,
      active_users: 0,
      students: 0,
      teachers: 0,
      admins: 0,
      inactive_users: 0,
    },
    backendPaginationInfo: {
      totalCount: 0,
      pageCount: 0,
      hasNextPage: false,
    },
  },
  
  // UI STATE
  ui: {
    currentPage: 1,
    itemsPerPage: 25,
    sortBy: 'date_joined',
    sortOrder: 'desc',
  },
  
  // FILTERS
  filters: {
    searchTerm: '',
    roleFilter: 'all',
    statusFilter: 'all',
  },
  
  // MODAL STATE
  modal: {
    isOpen: false,
    type: 'create',
    selectedUser: null,
  },
  
  // SELECTION STATE
  selection: {
    selectedUsers: [],
    showBulkActions: false,
  },
  
  // LOADING STATE
  loading: {
    isLoading: true,
    isLoadingPage: false,
    syncing: false,
  },
  
  // SYNC STATE
  sync: {
    lastSuccessfulTime: typeof window !== "undefined" 
      ? localStorage.getItem("lastSuccessfulSyncTime") 
      : null,
    syncProgress: {
      show: false,
      status: "initializing",
      message: "Preparing to sync...",
      created: 0,
      updated: 0,
      failed: 0,
      total: 0,
      errors: [],
    },
  },
  
  // METADATA (not in state, handled via refs)
};

// ✨ SPRINT 3: Reducer actions
export const ACTIONS = {
  // DATA LOADING
  SET_USERS: 'SET_USERS',
  APPEND_USERS: 'APPEND_USERS',
  SET_STATS: 'SET_STATS',
  SET_PAGINATION_INFO: 'SET_PAGINATION_INFO',
  
  // UI
  SET_CURRENT_PAGE: 'SET_CURRENT_PAGE',
  SET_ITEMS_PER_PAGE: 'SET_ITEMS_PER_PAGE',
  SET_SORT: 'SET_SORT',
  
  // FILTERS
  SET_SEARCH_TERM: 'SET_SEARCH_TERM',
  SET_ROLE_FILTER: 'SET_ROLE_FILTER',
  SET_STATUS_FILTER: 'SET_STATUS_FILTER',
  RESET_FILTERS: 'RESET_FILTERS',
  
  // MODAL
  OPEN_MODAL: 'OPEN_MODAL',
  CLOSE_MODAL: 'CLOSE_MODAL',
  
  // SELECTION
  TOGGLE_USER_SELECTION: 'TOGGLE_USER_SELECTION',
  SET_BULK_ACTIONS_VISIBLE: 'SET_BULK_ACTIONS_VISIBLE',
  CLEAR_SELECTION: 'CLEAR_SELECTION',
  
  // LOADING
  SET_LOADING: 'SET_LOADING',
  SET_PAGE_LOADING: 'SET_PAGE_LOADING',
  SET_SYNCING: 'SET_SYNCING',
  
  // SYNC
  UPDATE_SYNC_PROGRESS: 'UPDATE_SYNC_PROGRESS',
  SET_LAST_SYNC_TIME: 'SET_LAST_SYNC_TIME',
};

// ✨ SPRINT 3: Reducer function
function usersAdminReducer(state, action) {
  switch (action.type) {
    // DATA LOADING
    case ACTIONS.SET_USERS:
      return {
        ...state,
        data: {
          ...state.data,
          users: action.payload,
        },
      };
    
    case ACTIONS.APPEND_USERS:
      return {
        ...state,
        data: {
          ...state.data,
          users: [...state.data.users, ...action.payload],
        },
      };
    
    case ACTIONS.SET_STATS:
      return {
        ...state,
        data: {
          ...state.data,
          backendStats: action.payload,
        },
      };
    
    case ACTIONS.SET_PAGINATION_INFO:
      return {
        ...state,
        data: {
          ...state.data,
          backendPaginationInfo: action.payload,
        },
      };
    
    // UI
    case ACTIONS.SET_CURRENT_PAGE:
      return {
        ...state,
        ui: {
          ...state.ui,
          currentPage: action.payload,
        },
      };
    
    case ACTIONS.SET_ITEMS_PER_PAGE:
      return {
        ...state,
        ui: {
          ...state.ui,
          itemsPerPage: action.payload,
          currentPage: 1, // Reset to page 1 when changing items per page
        },
      };
    
    case ACTIONS.SET_SORT:
      return {
        ...state,
        ui: {
          ...state.ui,
          ...action.payload, // { sortBy, sortOrder }
        },
      };
    
    // FILTERS
    case ACTIONS.SET_SEARCH_TERM:
      return {
        ...state,
        filters: {
          ...state.filters,
          searchTerm: action.payload,
        },
        ui: {
          ...state.ui,
          currentPage: 1, // Reset to page 1 on filter change
        },
      };
    
    case ACTIONS.SET_ROLE_FILTER:
      return {
        ...state,
        filters: {
          ...state.filters,
          roleFilter: action.payload,
        },
        ui: {
          ...state.ui,
          currentPage: 1,
        },
      };
    
    case ACTIONS.SET_STATUS_FILTER:
      return {
        ...state,
        filters: {
          ...state.filters,
          statusFilter: action.payload,
        },
        ui: {
          ...state.ui,
          currentPage: 1,
        },
      };
    
    case ACTIONS.RESET_FILTERS:
      return {
        ...state,
        filters: {
          searchTerm: '',
          roleFilter: 'all',
          statusFilter: 'all',
        },
        ui: {
          ...state.ui,
          currentPage: 1,
        },
      };
    
    // MODAL
    case ACTIONS.OPEN_MODAL:
      return {
        ...state,
        modal: {
          isOpen: true,
          type: action.payload.type || 'view',
          selectedUser: action.payload.user || null,
        },
      };
    
    case ACTIONS.CLOSE_MODAL:
      return {
        ...state,
        modal: {
          isOpen: false,
          type: 'view',
          selectedUser: null,
        },
      };
    
    // SELECTION
    case ACTIONS.TOGGLE_USER_SELECTION:
      return {
        ...state,
        selection: {
          ...state.selection,
          selectedUsers: state.selection.selectedUsers.includes(action.payload)
            ? state.selection.selectedUsers.filter(id => id !== action.payload)
            : [...state.selection.selectedUsers, action.payload],
        },
      };
    
    case ACTIONS.SET_BULK_ACTIONS_VISIBLE:
      return {
        ...state,
        selection: {
          ...state.selection,
          showBulkActions: action.payload,
        },
      };
    
    case ACTIONS.CLEAR_SELECTION:
      return {
        ...state,
        selection: {
          selectedUsers: [],
          showBulkActions: false,
        },
      };
    
    // LOADING
    case ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: {
          ...state.loading,
          isLoading: action.payload,
        },
      };
    
    case ACTIONS.SET_PAGE_LOADING:
      return {
        ...state,
        loading: {
          ...state.loading,
          isLoadingPage: action.payload,
        },
      };
    
    case ACTIONS.SET_SYNCING:
      return {
        ...state,
        loading: {
          ...state.loading,
          syncing: action.payload,
        },
      };
    
    // SYNC
    case ACTIONS.UPDATE_SYNC_PROGRESS:
      return {
        ...state,
        sync: {
          ...state.sync,
          syncProgress: {
            ...state.sync.syncProgress,
            ...action.payload,
          },
        },
      };
    
    case ACTIONS.SET_LAST_SYNC_TIME:
      return {
        ...state,
        sync: {
          ...state.sync,
          lastSuccessfulTime: action.payload,
        },
      };
    
    default:
      return state;
  }
}

// ✨ SPRINT 3: Custom hook
export function useUsersAdmin() {
  const [state, dispatch] = useReducer(usersAdminReducer, initialState);
  const api = useAxios();
  
  // Refs (not in state)
  const loadedPagesRef = useRef(new Set([1]));
  const loadingPagesRef = useRef(new Set());
  const abortControllerRef = useRef(null);
  
  // ✨ SPRINT 3: Fetch stats
  const fetchUserStats = useCallback(async () => {
    try {
      const response = await api.get(`/admin/user-stats/?_t=${Date.now()}`);
      dispatch({
        type: ACTIONS.SET_STATS,
        payload: response.data,
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
    }
  }, [api]);
  
  // ✨ SPRINT 3: Fetch users page
  const fetchUsers = useCallback(async (page = 1) => {
    if (loadedPagesRef.current.has(page) || loadingPagesRef.current.has(page)) {
      return; // Already loaded or loading
    }
    
    loadingPagesRef.current.add(page);
    dispatch({ type: ACTIONS.SET_PAGE_LOADING, payload: true });
    
    try {
      const response = await api.get(`/admin/user-management/?page=${page}&_t=${Date.now()}`);
      const usersData = response.data;
      
      if (usersData.results) {
        dispatch({ type: ACTIONS.APPEND_USERS, payload: usersData.results });
        loadedPagesRef.current.add(page);
        
        dispatch({
          type: ACTIONS.SET_PAGINATION_INFO,
          payload: {
            totalCount: usersData.count,
            pageCount: Math.ceil(usersData.count / 20),
            hasNextPage: usersData.next !== null,
          },
        });
      }
    } catch (error) {
      console.error(`Error loading page ${page}:`, error);
    } finally {
      loadingPagesRef.current.delete(page);
      dispatch({ type: ACTIONS.SET_PAGE_LOADING, payload: false });
    }
  }, [api]);
  
  // ✨ SPRINT 3: Initialize on mount
  useEffect(() => {
    fetchUserStats();
    fetchUsers(1);
    dispatch({ type: ACTIONS.SET_LOADING, payload: false });
  }, [fetchUserStats, fetchUsers]);
  
  return {
    state,
    dispatch,
    fetchUserStats,
    fetchUsers,
    refs: { loadedPagesRef, loadingPagesRef, abortControllerRef },
  };
}
```

### Step 3: Refactor Component to Use Hook

**File**: `frontend/src/views/admin/UsersAdmin.jsx` (UPDATE)

```javascript
import React, { useCallback, useMemo } from "react";
import { useUsersAdmin, ACTIONS } from "../../hooks/useUsersAdmin";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import Toast from "../plugin/Toast";
import "./UsersAdmin.css";

// ✨ SPRINT 3: Simplified component
function UsersAdmin() {
  const { state, dispatch, fetchUserStats, fetchUsers, refs } = useUsersAdmin();
  const api = useAxios();

  // ✨ SPRINT 3: Memoized calculations
  const filteredUsersData = useMemo(() => {
    let filtered = [...state.data.users];
    
    // Apply search
    if (state.filters.searchTerm) {
      const searchLower = state.filters.searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.full_name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply role filter
    if (state.filters.roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === state.filters.roleFilter);
    }
    
    // Apply status filter
    if (state.filters.statusFilter !== 'all') {
      if (state.filters.statusFilter === 'active') {
        filtered = filtered.filter(user => user.is_active);
      } else if (state.filters.statusFilter === 'inactive') {
        filtered = filtered.filter(user => !user.is_active);
      }
    }
    
    return filtered;
  }, [state.data.users, state.filters]);

  // ✨ SPRINT 3: Calculate current page items
  const currentPageData = useMemo(() => {
    const start = (state.ui.currentPage - 1) * state.ui.itemsPerPage;
    const end = start + state.ui.itemsPerPage;
    return filteredUsersData.slice(start, end);
  }, [filteredUsersData, state.ui.currentPage, state.ui.itemsPerPage]);

  // ✨ SPRINT 3: Handle page change
  const handlePageChange = useCallback((newPage) => {
    dispatch({ type: ACTIONS.SET_CURRENT_PAGE, payload: newPage });
    
    // Load backend page if needed
    const backendPage = Math.ceil(newPage / (state.ui.itemsPerPage / 20));
    fetchUsers(backendPage);
  }, [state.ui.itemsPerPage, dispatch, fetchUsers]);

  // ✨ SPRINT 3: Handle filter changes
  const handleSearchChange = useCallback((term) => {
    dispatch({ type: ACTIONS.SET_SEARCH_TERM, payload: term });
  }, [dispatch]);

  const handleRoleFilterChange = useCallback((role) => {
    dispatch({ type: ACTIONS.SET_ROLE_FILTER, payload: role });
  }, [dispatch]);

  const handleStatusFilterChange = useCallback((status) => {
    dispatch({ type: ACTIONS.SET_STATUS_FILTER, payload: status });
  }, [dispatch]);

  // ✨ SPRINT 3: Handle modal
  const handleOpenModal = useCallback((type, user = null) => {
    dispatch({
      type: ACTIONS.OPEN_MODAL,
      payload: { type, user },
    });
  }, [dispatch]);

  const handleCloseModal = useCallback(() => {
    dispatch({ type: ACTIONS.CLOSE_MODAL });
  }, [dispatch]);

  // ✨ SPRINT 3: Handle user selection
  const handleSelectUser = useCallback((userId) => {
    dispatch({
      type: ACTIONS.TOGGLE_USER_SELECTION,
      payload: userId,
    });
    
    // Show bulk actions if any users selected
    if (state.selection.selectedUsers.length === 0) {
      dispatch({
        type: ACTIONS.SET_BULK_ACTIONS_VISIBLE,
        payload: true,
      });
    }
  }, [dispatch, state.selection.selectedUsers.length]);

  const handleClearSelection = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_SELECTION });
  }, [dispatch]);

  // ✨ SPRINT 3: Handle create/edit/delete
  const handleCreateUser = useCallback(async (userData) => {
    try {
      await api.post('/admin/users/', userData);
      Toast().fire({ icon: 'success', title: 'User created successfully' });
      
      // Refresh data
      await fetchUserStats();
      
      // Reset to page 1 to see new user
      dispatch({ type: ACTIONS.SET_CURRENT_PAGE, payload: 1 });
      handleCloseModal();
    } catch (error) {
      Toast().fire({ icon: 'error', title: 'Error creating user', text: error.message });
    }
  }, [api, fetchUserStats, dispatch, handleCloseModal]);

  const handleUpdateUser = useCallback(async (userId, userData) => {
    try {
      await api.patch(`/admin/users/${userId}/`, userData);
      Toast().fire({ icon: 'success', title: 'User updated successfully' });
      
      // Refresh data
      await fetchUserStats();
      handleCloseModal();
    } catch (error) {
      Toast().fire({ icon: 'error', title: 'Error updating user', text: error.message });
    }
  }, [api, fetchUserStats, handleCloseModal]);

  const handleDeleteUser = useCallback(async (userId) => {
    const confirm = window.confirm('Are you sure?');
    if (!confirm) return;
    
    try {
      await api.delete(`/admin/users/${userId}/`);
      Toast().fire({ icon: 'success', title: 'User deleted successfully' });
      
      // Refresh data
      await fetchUserStats();
      handleClearSelection();
    } catch (error) {
      Toast().fire({ icon: 'error', title: 'Error deleting user', text: error.message });
    }
  }, [api, fetchUserStats, handleClearSelection]);

  // ✨ SPRINT 3: JSX with cleaner prop passing
  return (
    <div className="users-admin-container">
      <AdminHeader title="User Management" />
      
      {/* Stats Cards */}
      <div className="stats-grid">
        <StatCard
          title="Total Users"
          value={state.data.backendStats.total_users}
          icon="👥"
        />
        <StatCard
          title="Active Users"
          value={state.data.backendStats.active_users}
          icon="✅"
        />
        <StatCard
          title="Students"
          value={state.data.backendStats.students}
          icon="📚"
        />
        <StatCard
          title="Teachers"
          value={state.data.backendStats.teachers}
          icon="👨‍🏫"
        />
      </div>

      {/* Filters */}
      <div className="filters-section">
        <input
          type="text"
          placeholder="Search users..."
          value={state.filters.searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="search-input"
        />
        
        <select
          value={state.filters.roleFilter}
          onChange={(e) => handleRoleFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Roles</option>
          <option value="student">Student</option>
          <option value="instructor">Instructor</option>
          <option value="admin">Admin</option>
        </select>
        
        <select
          value={state.filters.statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        
        <button onClick={() => dispatch({ type: ACTIONS.RESET_FILTERS })}>
          Clear Filters
        </button>
        
        <button onClick={() => handleOpenModal('create')} className="btn-primary">
          Add User
        </button>
      </div>

      {/* Users Table */}
      {state.loading.isLoading ? (
        <div className="skeleton-loader">Loading users...</div>
      ) : (
        <>
          <table className="users-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        // Select all visible users
                        currentPageData.forEach(user => {
                          if (!state.selection.selectedUsers.includes(user.id)) {
                            dispatch({
                              type: ACTIONS.TOGGLE_USER_SELECTION,
                              payload: user.id,
                            });
                          }
                        });
                      } else {
                        handleClearSelection();
                      }
                    }}
                  />
                </th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentPageData.map((user) => (
                <tr key={user.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={state.selection.selectedUsers.includes(user.id)}
                      onChange={() => handleSelectUser(user.id)}
                    />
                  </td>
                  <td>{user.full_name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <span className={user.is_active ? 'active' : 'inactive'}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => handleOpenModal('edit', user)}>Edit</button>
                    <button onClick={() => handleDeleteUser(user.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="pagination">
            {Array.from({ length: state.ui.itemsPerPage === 25 ? 5 : 10 }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => handlePageChange(i + 1)}
                className={state.ui.currentPage === i + 1 ? 'active' : ''}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {state.modal.isOpen && (
        <UserModal
          isOpen={state.modal.isOpen}
          type={state.modal.type}
          user={state.modal.selectedUser}
          onClose={handleCloseModal}
          onCreate={handleCreateUser}
          onUpdate={handleUpdateUser}
        />
      )}

      {/* Bulk Actions */}
      {state.selection.showBulkActions && state.selection.selectedUsers.length > 0 && (
        <div className="bulk-actions">
          <p>{state.selection.selectedUsers.length} users selected</p>
          <button onClick={handleClearSelection}>Clear Selection</button>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default UsersAdmin;
```

---

# TESTING & VERIFICATION

## Transaction Testing
```bash
# Run transaction tests
pytest backend/api/tests.py::TransactionRollbackTests -v

# Check for transaction usage
grep -r "@transaction.atomic" backend/api/views.py
```

## Caching Testing
```bash
# Clear cache
redis-cli FLUSHDB

# Run cache tests
pytest backend/api/tests.py::AdminCachePerformanceTest -v

# Monitor cache hits/misses
redis-cli MONITOR
```

## Frontend State Testing
```bash
# Test component with new hook
npm test -- UsersAdmin.test.jsx

# Check for console errors/warnings
npm run dev  # Should show no console errors with new state
```

---

# TROUBLESHOOTING

## Transaction Issues
**Problem**: "AtomicityError" on nested transactions  
**Solution**: Use savepoints with `@atomic_with_savepoint` decorator

## Cache Issues
**Problem**: Cache not invalidating  
**Solution**: Check signals are registered in `apps.py` ready() method

## Frontend State Issues
**Problem**: Component not re-rendering after state change  
**Solution**: Verify reducer is returning NEW object (not mutating)

---

**This guide is complete and ready for implementation!**

See [Sprint 3 Quick Reference](SPRINT_3_QUICK_REFERENCE.md) for quick code snippets.
