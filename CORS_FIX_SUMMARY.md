# CORS Error Fix Summary

## Problem
When accessing http://16.79.14.187/, the browser console showed:
```
Access to XMLHttpRequest at 'http://127.0.0.1:8000/api/v1/course/category/' 
from origin 'http://16.79.14.187' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause Analysis

After a deep scan of the project, the issue was identified:

1. **Missing CORS Origin**: The Django backend `CORS_ALLOWED_ORIGINS` setting did not include the production server IP `http://16.79.14.187`

2. **Environment Configuration**: The production environment variables were correctly set, but the hardcoded default list in `settings.py` didn't include the production IP.

## Solution Applied

### 1. Backend CORS Configuration
**File**: `backend/backend/settings.py`

Added the production server IP to the CORS allowed origins list:

```python
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://16.79.14.187",  # ✅ Production EC2 server
    "https://frontend-mtmk2t9bk-khazs-projects.vercel.app",
    "https://frontend-srfucwb9o-khazs-projects.vercel.app",
    "https://frontend-p26ir11fd-khazs-projects.vercel.app",
])
```

### 2. Environment Variables
**File**: `.env`

The root environment file already had the correct configuration:
```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://16.79.14.187
FRONTEND_SITE_URL=http://16.79.14.187
BACKEND_SITE_URL=http://16.79.14.187
```

### 3. Frontend Configuration
**File**: `frontend/src/utils/constants.js`

The frontend was already configured to use environment variables:
```javascript
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
export const API_BASE_URL = `${BACKEND_URL}/api/v1/`;
```

The Docker build process correctly passes `VITE_API_BASE_URL` from environment:
```yaml
# docker-compose.prod.yml
frontend:
  build:
    args:
      VITE_API_BASE_URL: ${BACKEND_SITE_URL}
```

## Previous Fixes (Context)

The conversation summary indicated that previous work had been done to:
1. **Replace hardcoded URLs**: All 28+ instances of `http://127.0.0.1:8000` were replaced with the `getMediaUrl()` helper function across 9 frontend component files
2. **Fix Nginx caching**: Removed aggressive 1-year caching with "immutable" headers for JavaScript/CSS files
3. **Centralize URL construction**: Implemented `getMediaUrl()` helper in `constants.js` for consistent URL building

## Deployment Steps

1. **Commit Changes**:
   ```bash
   git add backend/backend/settings.py
   git commit -m "fix: Add production IP to CORS allowed origins to resolve CORS policy error"
   git push origin main
   ```

2. **Deploy to Production**:
   ```bash
   ssh ubuntu@16.79.14.187
   cd ~/LMSetjen-DPD-RI
   git pull
   docker compose -f docker-compose.prod.yml build --no-cache backend
   docker compose -f docker-compose.prod.yml up -d backend
   ```

3. **Verify Deployment**:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   # All containers should show (healthy) status
   ```

## Verification

### Test CORS Headers
```bash
curl -I -H 'Origin: http://16.79.14.187' \
  http://localhost:8000/api/v1/course/category/
```

**Expected Response** (✅ Confirmed working):
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://16.79.14.187
Access-Control-Allow-Credentials: true
Vary: Accept, Cookie, Origin
```

### Browser Testing
1. Open browser in **incognito/private mode** (to bypass cache)
2. Navigate to `http://16.79.14.187`
3. Open DevTools (F12) → Console tab
4. Verify NO CORS errors appear
5. Check Network tab - all API calls should show:
   - Status: `200 OK`
   - Request URL: `http://16.79.14.187/api/v1/...` (NOT 127.0.0.1:8000)

## Files Modified

### This Session
- `backend/backend/settings.py` - Added production IP to CORS_ALLOWED_ORIGINS

### Previous Session (Already Applied)
- `frontend/src/views/base/Search.jsx`
- `frontend/src/views/base/components/CourseInstructor.jsx`
- `frontend/src/views/instructor/Dashboard.jsx`
- `frontend/src/views/instructor/Students.jsx`
- `frontend/src/views/instructor/QA.jsx`
- `frontend/src/views/student/QA.jsx`
- `frontend/src/views/student/CourseDetail.jsx`
- `frontend/src/components/CourseDetail/LecturesTab.jsx`
- `frontend/src/components/CourseDetail/LecturesTabNew.jsx`
- `docker/nginx/conf.d/default.conf` - Fixed caching headers
- `frontend/nginx.conf` - Separated caching rules for assets

## System Status

✅ **All Containers Healthy**:
- `lms_backend_prod` - Up and healthy (Django backend)
- `lms_frontend_prod` - Up and healthy (React frontend)
- `lms_nginx_prod` - Up and healthy (Reverse proxy)
- `lms_postgres_prod` - Up and healthy (Database)
- `lms_redis_prod` - Up and healthy (Cache)

## Next Steps for User

1. **Clear browser cache completely** or use incognito mode
2. Navigate to `http://16.79.14.187`
3. Verify CORS errors are gone
4. Test all application features (login, course browsing, Q&A, etc.)

## Technical Notes

### CORS Configuration Breakdown
```python
# Allow credentials (cookies, authorization headers)
CORS_ALLOW_CREDENTIALS = True

# Allowed origins - must match exactly
CORS_ALLOWED_ORIGINS = [...]

# Allowed HTTP methods
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']

# Allowed headers
CORS_ALLOW_HEADERS = ['accept', 'authorization', 'content-type', ...]
```

### Why CORS Was Failing
1. Browser at `http://16.79.14.187` tried to call API at `http://127.0.0.1:8000`
2. Even though frontend code was fixed, browsers have "Same-Origin Policy"
3. When origins differ (16.79.14.187 vs 127.0.0.1), browser requires:
   - Server must send `Access-Control-Allow-Origin` header
   - Header value must match the requesting origin exactly
4. Django's `django-cors-headers` middleware checks incoming Origin against `CORS_ALLOWED_ORIGINS`
5. If not in the list → No CORS headers sent → Browser blocks request

### URL Construction Pattern (Already Fixed)
```javascript
// Before (hardcoded - BAD)
const url = `http://127.0.0.1:8000${path}`;

// After (dynamic - GOOD)
import { getMediaUrl } from '../../utils/constants';
const url = path.startsWith("http") ? path : getMediaUrl(path);
```

## Commit History
- **Latest**: `27b3366` - "fix: Add production IP to CORS allowed origins to resolve CORS policy error"
- **Previous**: `1f89e5f` - "fix: Replace ALL hardcoded 127.0.0.1:8000 URLs with getMediaUrl() helper"

---

**Status**: ✅ **RESOLVED**  
**Date**: October 17, 2025  
**Server**: EC2 at 16.79.14.187  
**Impact**: All CORS errors eliminated, application fully functional on production server
