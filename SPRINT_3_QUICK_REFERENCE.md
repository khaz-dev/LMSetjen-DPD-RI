# ⚡ SPRINT 3: QUICK REFERENCE
**Fast Copy-Paste Code Snippets**

---

## 🔒 TRANSACTIONS - Quick Snippets

### Decorator Import
```python
# backend/api/decorators.py
from functools import wraps
from django.db import transaction

def atomic_operation(using=None):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            with transaction.atomic(using=using):
                return func(*args, **kwargs)
        return wrapper
    return decorator
```

### Apply to Create/Update/Delete
```python
from api.decorators import atomic_operation

class AdminUserManagementAPIView(generics.ListAPIView):
    
    @atomic_operation()
    def create(self, request, *args, **kwargs):
        # User creation automatically wrapped in transaction
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @atomic_operation()
    def update(self, request, *args, **kwargs):
        # User update automatically wrapped in transaction
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    
    @atomic_operation()
    def destroy(self, request, *args, **kwargs):
        # User delete automatically wrapped in transaction
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
```

---

## 💾 CACHING - Quick Snippets

### Cache Manager
```python
# backend/api/cache_utils.py - ADD THIS CLASS

class AdminCacheManager:
    USER_LIST_PREFIX = 'admin:users'
    USER_STATS_PREFIX = 'admin:stats'
    USERS_TIMEOUT = 300
    STATS_TIMEOUT = 600
    
    @staticmethod
    def generate_users_cache_key(page=1, role=None, status=None):
        key_parts = [AdminCacheManager.USER_LIST_PREFIX, f'page:{page}']
        if role: key_parts.append(f'role:{role}')
        if status: key_parts.append(f'status:{status}')
        return ':'.join(key_parts)
    
    @staticmethod
    def get_cached_users(page=1, role=None, status=None):
        cache_key = AdminCacheManager.generate_users_cache_key(page, role, status)
        return cache.get(cache_key)
    
    @staticmethod
    def cache_users(data, page=1, role=None, status=None):
        cache_key = AdminCacheManager.generate_users_cache_key(page, role, status)
        cache.set(cache_key, data, AdminCacheManager.USERS_TIMEOUT)
    
    @staticmethod
    def invalidate_users_cache(page=None):
        if page is None:
            from django.core.cache.backends.redis import RedisCache
            client = cache._cache
            keys = client.keys(f"{AdminCacheManager.USER_LIST_PREFIX}:*")
            if keys: client.delete(*keys)
        else:
            cache.delete(AdminCacheManager.generate_users_cache_key(page))
    
    @staticmethod
    def get_cached_stats():
        return cache.get(AdminCacheManager.USER_STATS_PREFIX)
    
    @staticmethod
    def cache_stats(data):
        cache.set(AdminCacheManager.USER_STATS_PREFIX, data, AdminCacheManager.STATS_TIMEOUT)
    
    @staticmethod
    def invalidate_stats_cache():
        cache.delete(AdminCacheManager.USER_STATS_PREFIX)
```

### Cache Decorators
```python
# backend/api/cache_utils.py - ADD THESE DECORATORS

def cache_admin_users(timeout=None):
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            page = request.query_params.get('page', 1)
            role = request.query_params.get('role')
            status = request.query_params.get('status')
            
            cached = AdminCacheManager.get_cached_users(page, role, status)
            if cached:
                return Response(cached)
            
            response = view_func(self, request, *args, **kwargs)
            if response.status_code == 200:
                AdminCacheManager.cache_users(response.data, page, role, status)
            return response
        return wrapper
    return decorator

def cache_admin_stats(timeout=None):
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(self, request, *args, **kwargs):
            cached = AdminCacheManager.get_cached_stats()
            if cached:
                return Response(cached)
            
            response = view_func(self, request, *args, **kwargs)
            if response.status_code == 200:
                AdminCacheManager.cache_stats(response.data)
            return response
        return wrapper
    return decorator
```

### Apply to Views
```python
from api.cache_utils import AdminCacheManager, cache_admin_users, cache_admin_stats

class AdminUserManagementAPIView(generics.ListAPIView):
    
    @cache_admin_users()
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    def create(self, request, *args, **kwargs):
        AdminCacheManager.invalidate_users_cache()
        AdminCacheManager.invalidate_stats_cache()
        # ... rest of create logic

class AdminUserStatsAPIView(generics.GenericAPIView):
    
    @cache_admin_stats()
    def get(self, request):
        stats = User.objects.aggregate(
            total_users=Count('id'),
            active_users=Count('id', filter=Q(is_active=True)),
            # ...
        )
        return Response(stats)
```

### Signal-Based Invalidation
```python
# backend/api/signals.py

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from userauths.models import User
from api.cache_utils import AdminCacheManager

@receiver(post_save, sender=User)
def invalidate_user_cache_on_save(sender, instance, created, **kwargs):
    AdminCacheManager.invalidate_users_cache()
    AdminCacheManager.invalidate_stats_cache()
    print(f"[Signal] User {'created' if created else 'updated'}: cache invalidated")

@receiver(post_delete, sender=User)
def invalidate_user_cache_on_delete(sender, instance, **kwargs):
    AdminCacheManager.invalidate_users_cache()
    AdminCacheManager.invalidate_stats_cache()
    print(f"[Signal] User deleted: cache invalidated")

# In apps.py:
# class ApiConfig(AppConfig):
#     def ready(self):
#         from . import signals
```

---

## ⚛️ FRONTEND STATE - Quick Snippets

### useReducer Hook
```javascript
// frontend/src/hooks/useUsersAdmin.js

export const ACTIONS = {
  SET_USERS: 'SET_USERS',
  SET_STATS: 'SET_STATS',
  SET_CURRENT_PAGE: 'SET_CURRENT_PAGE',
  SET_SEARCH_TERM: 'SET_SEARCH_TERM',
  SET_ROLE_FILTER: 'SET_ROLE_FILTER',
  SET_STATUS_FILTER: 'SET_STATUS_FILTER',
  OPEN_MODAL: 'OPEN_MODAL',
  CLOSE_MODAL: 'CLOSE_MODAL',
};

function usersAdminReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_USERS:
      return { ...state, data: { ...state.data, users: action.payload } };
    case ACTIONS.SET_STATS:
      return { ...state, data: { ...state.data, backendStats: action.payload } };
    case ACTIONS.SET_CURRENT_PAGE:
      return { ...state, ui: { ...state.ui, currentPage: action.payload } };
    case ACTIONS.SET_SEARCH_TERM:
      return { ...state, filters: { ...state.filters, searchTerm: action.payload } };
    case ACTIONS.OPEN_MODAL:
      return { ...state, modal: { isOpen: true, selectedUser: action.payload } };
    case ACTIONS.CLOSE_MODAL:
      return { ...state, modal: { isOpen: false, selectedUser: null } };
    default:
      return state;
  }
}

export function useUsersAdmin() {
  const [state, dispatch] = useReducer(usersAdminReducer, initialState);
  return { state, dispatch };
}
```

### Usage in Component
```javascript
// frontend/src/views/admin/UsersAdmin.jsx

function UsersAdmin() {
  const { state, dispatch } = useUsersAdmin();
  
  const handlePageChange = (page) => {
    dispatch({ type: ACTIONS.SET_CURRENT_PAGE, payload: page });
  };
  
  const handleSearch = (term) => {
    dispatch({ type: ACTIONS.SET_SEARCH_TERM, payload: term });
  };
  
  const handleOpenModal = (user) => {
    dispatch({ type: ACTIONS.OPEN_MODAL, payload: user });
  };
  
  return (
    <div>
      <input onChange={(e) => handleSearch(e.target.value)} />
      <button onClick={() => handleOpenModal(null)}>Create</button>
      {/* ... JSX ... */}
    </div>
  );
}
```

---

## 🧪 TESTING - Quick Commands

### Run All Tests
```bash
# Backend - Transactions
pytest backend/api/tests.py::TransactionRollbackTests -v

# Backend - Caching
pytest backend/api/tests.py::AdminCachePerformanceTest -v

# Frontend - State
npm test -- UsersAdmin.test.jsx
```

### Redis Commands
```bash
# Check cache
redis-cli
> KEYS admin:*
> GET admin:stats
> TTL admin:stats

# Clear cache
> FLUSHDB

# Monitor cache activity
> MONITOR
```

---

## 📊 VERIFICATION CHECKLIST

### ✅ Transactions
- [ ] All user create/update/delete wrapped with @atomic_operation
- [ ] Student completion marking is atomic
- [ ] Run transaction tests: `pytest backend/api/tests.py::TransactionRollbackTests`
- [ ] No partial update bugs reported

### ✅ Caching
- [ ] AdminCacheManager created and working
- [ ] Cache decorators applied to list() and get()
- [ ] Signal-based invalidation working
- [ ] Performance test shows 5x+ improvement on cached requests
- [ ] Cache invalidates on create/update/delete

### ✅ Frontend State
- [ ] useUsersAdmin hook created
- [ ] useReducer integrated into UsersAdmin component
- [ ] No behavioral changes in UI
- [ ] Console shows no warnings/errors
- [ ] State transitions easier to debug

---

## 🚀 DEPLOYMENT CHECKLIST

```bash
# 1. Create decorators file
touch backend/api/decorators.py

# 2. Update cache_utils.py
# - Add AdminCacheManager class
# - Add cache decorators

# 3. Create/Update signals.py
# - Register signal handlers

# 4. Update views.py
# - Add @atomic_operation to critical views
# - Add @cache_admin_users/@cache_admin_stats decorators
# - Call AdminCacheManager.invalidate_*() on modifications

# 5. Create custom hook
mkdir -p frontend/src/hooks
touch frontend/src/hooks/useUsersAdmin.js

# 6. Update UsersAdmin.jsx
# - Import useUsersAdmin
# - Replace useState with dispatch calls
# - Update JSX to use state from hook

# 7. Test everything
pytest backend/api/tests.py -v
npm test

# 8. Verify performance
# First request (uncached): ~200ms
# Second request (cached): <50ms
# Expected improvement: 5x+

# 9. Deploy to production
git add .
git commit -m "Sprint 3: Transactions + Caching + Frontend State"
git push origin main
```

---

**Time to Implement**: ~18-20 hours  
**Difficulty**: Medium-High  
**Recommended Order**: Transactions → Caching → Frontend State

See [Comprehensive Guide](SPRINT_3_COMPREHENSIVE_IMPLEMENTATION_GUIDE.md) for detailed explanations.
