# API Endpoint Resolution - Fix Verification

## Issue Resolution Summary

**Date:** 2025-10-20  
**Issue:** Admin dashboard API endpoints failing with `ERR_NAME_NOT_RESOLVED`  
**Root Cause:** Docker build cache contained old frontend image with `http://127.0.0.1:8000` hardcoded  
**Solution:** Complete rebuild with `--no-cache` to bake production URL into JavaScript

---

## Fix Applied

### 1. Complete Frontend Rebuild (Executed)

```bash
# Removed old images and cache
docker compose down frontend
docker image rm lmsetjen-dpd-ri-frontend
docker builder prune -f

# Rebuilt with correct production URL
docker compose build --no-cache frontend
docker compose up -d frontend
```

### 2. Build Verification

✅ **Build logs confirmed correct URL:**
```
Building with VITE_API_BASE_URL: https://lmsetjendpdri.duckdns.org
VITE_API_BASE_URL=https://lmsetjendpdri.duckdns.org
```

✅ **Build completed successfully:**
- Build time: ~130 seconds
- All assets generated
- Compression (gzip + brotli) applied
- Container started successfully

---

## Verification Steps

### Browser Testing (REQUIRED)

**1. Clear Browser Cache:**
```
- Press Ctrl+Shift+Delete
- Clear "Cached images and files"
- Time range: "All time"
```

**2. Open Admin Dashboard:**
```
URL: https://lmsetjendpdri.duckdns.org/admin/dashboard/
```

**3. Check Network Requests (DevTools → Network Tab):**

Expected API calls (should all use `https://lmsetjendpdri.duckdns.org`):
- ✅ `/api/v1/admin/dashboard-summary/` → Status 200
- ✅ `/api/v1/admin/enrollment-analytics/` → Status 200
- ✅ `/api/v1/admin/system-health/` → Status 200

**What to verify:**
- Request URLs start with `https://lmsetjendpdri.duckdns.org`
- NO requests to `http://127.0.0.1:8000`
- NO requests to `http://localhost:8000`
- Status codes are 200 (not ERR_NAME_NOT_RESOLVED)

### Console Check (DevTools → Console)

**Before fix:**
```
GET http://127.0.0.1:8000/api/v1/admin/dashboard-summary/ net::ERR_NAME_NOT_RESOLVED
```

**After fix (expected):**
```
No errors, or authentication errors (401/403) if not logged in
```

---

## Technical Details

### Why `--no-cache` Was Required

**Vite Environment Variables = Build-Time Only:**
```javascript
// Before compilation (source code):
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// After compilation (in browser):
const API_BASE_URL = "https://lmsetjendpdri.duckdns.org";  // ✅ Now correct
```

**Problem with Docker cache:**
1. First build ran before `.env` was properly configured
2. Docker cached the build layer with `VITE_API_BASE_URL=http://localhost:8000`
3. Even after fixing `.env`, Docker reused cached layer
4. Result: Old URL baked into JavaScript bundles

**Solution:**
- `--no-cache` forces Docker to re-execute all build steps
- Fresh npm install, fresh Vite build
- Reads current `.env` value: `BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org`
- Correctly passes to `docker-compose.yml`: `VITE_API_BASE_URL: ${BACKEND_SITE_URL}`
- Vite replaces all `import.meta.env.VITE_API_BASE_URL` with production URL during compilation

### Files Affected

**JavaScript bundles containing baseURL:**
- `DashboardAdmin-49df2e1b.js` - Main dashboard component
- `axios-*.js` (bundled in main chunks) - HTTP client configuration
- All API-calling components inherit this baseURL

**Previous issue (cached build):**
```javascript
// Old bundles had:
baseURL: "http://127.0.0.1:8000/api/v1/"
```

**Current state (after rebuild):**
```javascript
// New bundles should have:
baseURL: "https://lmsetjendpdri.duckdns.org/api/v1/"
```

---

## Prevention Measures

### 1. Dockerfile Validation (RECOMMENDED)

Add to `frontend/Dockerfile` after line 29:

```dockerfile
# Verify production URL is being used
RUN echo "🔍 Verifying VITE_API_BASE_URL..." && \
    if [ "$VITE_API_BASE_URL" = "http://localhost:8000" ] || \
       [ "$VITE_API_BASE_URL" = "http://127.0.0.1:8000" ] || \
       [ -z "$VITE_API_BASE_URL" ]; then \
        echo "❌ ERROR: Building with localhost/empty URL!" && \
        echo "ℹ️  This will break API calls in production." && \
        echo "ℹ️  Set BACKEND_SITE_URL in .env before building." && \
        exit 1; \
    fi && \
    echo "✅ Using production URL: $VITE_API_BASE_URL"
```

**Benefits:**
- Build fails immediately if wrong URL detected
- Clear error message guides developers
- Prevents accidental localhost builds

### 2. Deployment Checklist

When `.env` changes or first deployment:

```bash
# Always use --no-cache for environment changes
docker compose build --no-cache frontend
docker compose up -d frontend

# Verify build logs show correct URL
docker compose logs frontend --tail=100 | grep VITE_API_BASE_URL
```

### 3. Runtime Verification Script

Create `scripts/verify-api-url.sh`:

```bash
#!/bin/bash
echo "🔍 Checking compiled API URL in frontend container..."

# Extract baseURL from JavaScript bundle
COMPILED_URL=$(docker compose exec -T frontend sh -c 'cat /usr/share/nginx/html/assets/*.js' | \
               grep -o 'baseURL:"[^"]*"' | head -1)

echo "Compiled baseURL: $COMPILED_URL"

if echo "$COMPILED_URL" | grep -q "127.0.0.1\|localhost"; then
    echo "❌ ERROR: Frontend built with localhost URL!"
    echo "Run: docker compose build --no-cache frontend"
    exit 1
else
    echo "✅ Frontend using production URL"
fi
```

---

## Testing Checklist

After this fix, verify:

- [ ] Browser cache cleared
- [ ] Admin dashboard loads without errors
- [ ] Network tab shows requests to `https://lmsetjendpdri.duckdns.org/api/v1/...`
- [ ] No `ERR_NAME_NOT_RESOLVED` errors in console
- [ ] Dashboard data loads successfully (if authenticated)
- [ ] No requests to `127.0.0.1` or `localhost` in Network tab
- [ ] All three endpoints return data:
  - [ ] `/api/v1/admin/dashboard-summary/`
  - [ ] `/api/v1/admin/enrollment-analytics/`
  - [ ] `/api/v1/admin/system-health/`

---

## Related Issues

**Issue #1 (Resolved):** Dashboard header CSS not loading on first visit
- **Cause:** Lazy-loaded CSS dependency issue
- **Fix:** Added `.dashboard-header-modern` styles to `DashboardAdmin.css`
- **Commit:** 6a4da9e
- **Documentation:** `CSS_LOADING_ISSUE_ANALYSIS.md`

**Issue #2 (This Fix):** API endpoints failing with `ERR_NAME_NOT_RESOLVED`
- **Cause:** Docker cache with localhost URL
- **Fix:** Complete rebuild with `--no-cache`
- **Documentation:** `API_ENDPOINT_RESOLUTION_ERROR_ANALYSIS.md` + This file

---

## Summary

**Both issues had the same root cause category: Build-time configuration problems**

1. **CSS Issue:** Component CSS not self-contained during lazy loading
2. **API Issue:** Environment variable not properly baked into build due to Docker cache

**Key Lesson:**
When working with Vite's build-time environment variables:
- Changes to `.env` require `--no-cache` rebuild
- Docker cache can preserve old builds indefinitely
- Always verify build logs show correct values
- Browser cache must be cleared after frontend updates

**Fix Status:** ✅ **COMPLETED**
**Next Step:** User verification in browser

---

## Contact

If API errors persist after clearing browser cache:
1. Check browser Network tab for actual request URLs
2. Verify `.env` has: `BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org`
3. Check backend is accessible: `curl https://lmsetjendpdri.duckdns.org/api/v1/`
4. Review backend logs: `docker compose logs backend --tail=100`
