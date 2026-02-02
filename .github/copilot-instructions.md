# AI Agent Instructions for LMSetjen DPD RI

## Architecture Overview

**LMSetjen DPD RI** is a full-stack Learning Management System (LMS) built with **Django REST Framework** (backend) and **React 18** (frontend). The system serves Indonesian government employees with course management, enrollment, analytics, and certification features.

### Tech Stack
- **Backend**: Django 4.2, DRF, PostgreSQL, Redis, JWT authentication
- **Frontend**: React 18, Vite, Bootstrap 5, React Router v6
- **Deployment**: Docker Compose, nginx
- **Key Features**: Full-text search, advanced filtering, SSO integration, RBAC

## Critical Architecture Patterns

### Backend Structure (`backend/api/`)
- **models.py** (~1797 lines): Core data models (Course, Teacher, Student, SearchLog, etc.)
- **views.py** (~5619 lines): API viewsets organized by feature (search, analytics, enrollment, admin)
- **permissions.py**: Custom RBAC - `IsAdminUser`, `IsTeacherUser`, `IsStudentUser`, `IsSuperAdmin`
- **serializer.py**: Request/response serialization with validation
- **urls.py**: RESTful endpoint routing with PHASE markers (Phase 4.x = recent features)

### Frontend Structure (`frontend/src/`)
- **views/**: Page components organized by role (admin, instructor, student, base)
- **components/**: Reusable UI (SearchResultsDisplay, CourseCard, ErrorBoundary, Skeletons)
- **utils/**: axios wrapper (`apiInstance`), hooks (`useAxios`, `UserData`), helpers
- **store/**: Global state via `ProfileContext`, `WishlistContext`
- **Lazy loading**: All route components lazy-loaded for performance (see `App.jsx` line 24+)

## Role-Based Access Control (RBAC)

User roles in `User.role` field:
- **student**: Enrolled courses, Q&A, wishlist, certificates
- **teacher/instructor**: Course creation, student management, grading
- **admin**: System management, user management, analytics
- **super_admin**: Admin feature flag (`Admin.is_super_admin`)

Check permissions in frontend: `UserData().role`, in backend: `request.user.role`

**Key Permission Classes:**
```python
# Backend - api/permissions.py
permission_classes = [IsAdminUser]  # Require admin
permission_classes = [IsTeacherUser]  # Require teacher/instructor
permission_classes = [IsStudentUser]  # Require student
```

## Search & Analytics Architecture

### Search Implementation (PHASE 4+)
1. **Full-Text Search**: `FullTextSearchAPIView` uses PostgreSQL `SearchVector` with rank weighting
   - Endpoint: `GET /api/v1/course/full-text-search/`
   - Supports websearch syntax (quotes, boolean operators)
   - Cache layer: `SearchCacheManager` (backend/api/cache_utils.py)

2. **Basic Search**: `SearchCourseAPIView` - simpler, ranked by title/description relevance
   - Endpoint: `GET /api/v1/course/search/?search=query`

3. **Advanced Search**: `AdvancedSearchAPIView` - FTS + filter support
   - Endpoint: `POST /api/v1/search/advanced/`
   - Filters: category_id, level, min_rating, teacher_id
   - See `api/serializer.py` AdvancedSearchRequestSerializer for schema

4. **Search Logging**: `SearchLog` model tracks all queries for analytics
   - Used by trending searches, failed searches analysis
   - Methods: `.trending_searches()`, `.failed_searches()`

### Analytics Endpoints
- `GET /api/v1/analytics/trending-searches/` - Popular search terms
- `GET /api/v1/analytics/failed-searches/` - Zero-result queries
- `GET /api/v1/analytics/dashboard/` - Comprehensive dashboard data
- `GET /api/v1/filters/options/` - Available filter options

## Frontend Component Patterns

### Custom Hooks
```javascript
// useAxios - authenticated API calls with error handling
const response = useAxios().get('/api/v1/course/course-list/')

// UserData - current user info, includes role/permissions
const userData = UserData();
if (userData.role !== 'admin') return <NotFound />

// useComingSoon - modal for not-yet-implemented features
const handleClick = useComingSoon('Feature Name')
```

### Memoization & Performance
```jsx
// Always wrap components with React.memo to prevent unnecessary re-renders
function MyComponent() { /* ... */ }
export default React.memo(MyComponent);

// Lazy load heavy components, especially charts
const Line = lazy(() => import('react-chartjs-2').then(m => ({ default: m.Line })));
```

### Skeleton Loading
```javascript
// Import and use skeleton loaders for async operations
import { SkeletonPage, SkeletonStatCard } from '../../components/skeletons/SkeletonComponents';

// Never show "loading..." text - use visual skeletons instead
```

### Context & Global State
```javascript
// ProfileContext - current user profile updates
const { profile } = useContext(ProfileContext);

// WishlistContext - track wishlist state
const { wishlist } = useContext(WishlistContext);
```

## API Response Patterns

### Success Response
```json
{
  "count": 10,
  "results": [ { ... } ],
  "execution_time_ms": 45.2
}
```

### Pagination
- Default page size: 20 items (set in `backend/backend/settings.py` REST_FRAMEWORK)
- Use: `?page=1&limit=10` or built-in pagination
- Disable pagination in search endpoints with `pagination_class = None`

### Error Handling
- **Frontend**: Use `Toast().fire()` for user-facing errors (imported from `views/plugin/Toast`)
- **Backend**: DRF returns standard HTTP status codes + detail
- Always include try-catch with fallback UI in React components

## Development Workflows

### Local Development
```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python manage.py runserver  # https://lms.dpd.go.id/api

# Frontend
cd frontend
npm install
npm run dev  # http://localhost:5174
```

### Database
- Uses PostgreSQL (Docker: `lms_postgres`)
- Migrations: `python manage.py makemigrations && python manage.py migrate`
- Search indexing: `Course.search_vector` (SearchVectorField) auto-updated via signals
- Redis cache for search results (Docker: `lms_redis`)

### Testing
- Backend: `test_*.py` files (integration tests, analytics tests)
- Frontend: ESLint configured, no Jest tests currently
- Manual testing guides in documentation

### Deployment
- Docker Compose orchestrates PostgreSQL, Redis, Django, Nginx
- Environment variables in `.env` file (copy from `.env.example`)
- Production scripts: `DEPLOY_TO_PRODUCTION.ps1`, `deploy-production.sh`

## Common Modifications

### Adding a New API Endpoint
1. Create model in `backend/api/models.py` if needed
2. Create serializer in `backend/api/serializer.py`
3. Create view in `backend/api/views.py` (extend `generics.ListAPIView`, etc.)
4. Add permission class (e.g., `permission_classes = [IsTeacherUser]`)
5. Register URL in `backend/api/urls.py`
6. Mark with `# ✨ PHASE X` comment if feature-complete

### Adding a New React Page
1. Create component in `frontend/src/views/` (by role: admin, instructor, student, base)
2. Lazy import in `frontend/src/App.jsx` line 24+
3. Add route in App.jsx with `<Route path="..." element={<LazyComponent />} />`
4. Use `<PrivateRoute>` wrapper for authenticated-only pages
5. Use `<RoleRoute>` wrapper for role-specific pages
6. Create associated CSS file (same name, .css extension)

### Modifying Search Logic
- **Backend**: Edit `SearchCourseAPIView.get_queryset()` or `FullTextSearchAPIView`
- **Frontend**: Edit `SearchResultsDisplay.jsx` or `AdvancedSearchForm.jsx`
- Always test with caching disabled: clear Redis or comment out `@cache_search_results` decorator
- Update `SearchLog` filtering if changing search types

## File Organization Notes

### Important Directories
- `backend/core/` - Django settings, URL routing (note: settings in backend/backend/)
- `backend/userauths/` - User model, authentication, profile
- `frontend/src/components/Analytics/` - Dashboard charts and analytics UI
- `frontend/src/utils/` - axios wrapper, constants, image utilities
- `docs/` - Architecture documentation for reference

### Configuration Files
- `docker-compose.yml` - Development environment setup
- `frontend/vite.config.js` - Vite build config, chunk splitting for vendors
- `backend/requirements.txt` - Python dependencies
- `frontend/package.json` - npm dependencies

## Debugging Tips

1. **API Errors**: Check `backend/django_error.log` or `django.log`
2. **Frontend Errors**: Check browser console (F12) and look for ErrorBoundary catches
3. **Search Not Working**: Verify PostgreSQL full-text search index via `Course.search_vector`
4. **Authentication Issues**: Verify JWT token in browser cookies/localStorage
5. **Performance**: Check `performance_monitor.py` backend metrics

## SSO & External Integration

- SSO endpoint: `POST /api/v1/sso/verify/` - validates external SSO tokens
- Token format includes `nip` field for government employee ID
- Fallback: JWT refresh tokens for session persistence
- SSO utils in `backend/api/sso_utils.py`

---

**Last Updated**: November 2025 | **Current Phase**: Phase 4.9+ (Performance Optimization)
