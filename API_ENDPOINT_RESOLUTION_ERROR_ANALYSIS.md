# API Endpoint Resolution Error - Deep Analysis

## 🚨 Critical Issue

**Error:** `ERR_NAME_NOT_RESOLVED` when accessing admin dashboard endpoints

**Failed Endpoints:**
- `/api/v1/admin/dashboard-summary/`
- `/api/v1/admin/enrollment-analytics/`
- `/api/v1/admin/system-health/`

**Error Type:** DNS/Network resolution failure - the browser cannot resolve the hostname

---

## 🔍 Root Cause Analysis

### Problem Identification

The frontend is making API calls with **relative URLs** that are not being properly resolved. This happens because:

1. **Frontend uses `apiInstance`** from `axios.js`
2. **`apiInstance` baseURL**` is set from `VITE_API_BASE_URL` environment variable
3. **Build-time environment variable** is baked into the JavaScript bundle during `docker compose build`
4. **If `VITE_API_BASE_URL` is incorrect or missing**, the frontend will use the default fallback: `http://127.0.0.1:8000`

### Evidence Chain

**File: `frontend/src/utils/axios.js` (Lines 4-9):**
```javascript
// Get API URL from environment variable, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// Create an Axios instance with default settings
const apiInstance = axios.create({
    baseURL: `${API_BASE_URL}/api/v1/`,
    // ...
});
```

**File: `frontend/Dockerfile` (Lines 23-24):**
```dockerfile
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
```

**File: `docker-compose.yml` (Line 120):**
```yaml
args:
  VITE_API_BASE_URL: ${BACKEND_SITE_URL:-http://localhost:8000}
```

**File: `.env` (on server):**
```bash
BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org
```

---

## 🎯 Why This Happens

### Vite Environment Variables Are Build-Time Only

Unlike runtime environment variables, **Vite environment variables** (`import.meta.env.VITE_*`) are:

1. ✅ **Replaced at BUILD time** by Vite
2. ❌ **NOT available at RUNTIME** in the browser
3. ✅ **Baked into the JavaScript bundles** as string literals

**This means:**
- When `docker compose build frontend` runs, it reads `VITE_API_BASE_URL`
- Vite replaces ALL occurrences of `import.meta.env.VITE_API_BASE_URL` with the actual value
- The compiled JavaScript contains the hardcoded URL
- **If the URL is wrong at build time, it's wrong forever until you rebuild**

---

## 🐛 Likely Causes

### Scenario 1: Build Cache Issue ⚠️ **MOST LIKELY**

**Symptom:** The frontend was built before `.env` was updated

**Evidence:**
- Previous builds may have used `http://localhost:8000`
- Docker caching preserved the old build
- New `.env` changes weren't picked up because the build was cached

**Solution:** Force rebuild without cache

---

### Scenario 2: Wrong Environment Variable Format

**Problem:** `${BACKEND_SITE_URL}` not expanded correctly

**Check:**
```bash
# On server, verify .env is loaded
docker compose config | grep VITE_API_BASE_URL
```

**Should output:**
```
VITE_API_BASE_URL: https://lmsetjendpdri.duckdns.org
```

---

### Scenario 3: CORS / Mixed Content

**Problem:** Browser blocks HTTP→HTTPS or vice versa

**Symptom:** Network tab shows "blocked" instead of "failed to load resource"

**Not applicable here** - Error is `ERR_NAME_NOT_RESOLVED`, not CORS

---

## ✅ Solution Steps

### Step 1: Verify Environment Variable (5 min)

```bash
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21

# Check .env file
cat ~/LMSetjen-DPD-RI/.env | grep BACKEND_SITE_URL

# Expected: BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org

# Verify docker-compose resolves it correctly
cd ~/LMSetjen-DPD-RI
docker compose config | grep VITE_API_BASE_URL

# Expected: VITE_API_BASE_URL: https://lmsetjendpdri.duckdns.org
```

---

### Step 2: Complete Frontend Rebuild (10 min) ⭐ **RECOMMENDED**

Force a complete rebuild to ensure the correct URL is baked in:

```bash
cd ~/LMSetjen-DPD-RI

# Pull latest code
git pull origin main

# Remove old frontend image and build cache
docker compose down frontend
docker image rm lmsetjen-dpd-ri-frontend 2>/dev/null || true
docker builder prune -f

# Rebuild frontend WITHOUT cache
docker compose build --no-cache frontend

# Verify build used correct URL (check build logs)
# Should see: "Building with VITE_API_BASE_URL: https://lmsetjendpdri.duckdns.org"

# Start frontend
docker compose up -d frontend
```

---

### Step 3: Verify the Fix

**Browser Test:**
1. Open DevTools → Network tab
2. Navigate to `https://lmsetjendpdri.duckdns.org/admin/dashboard/`
3. Check API requests:
   - ✅ Should show: `https://lmsetjendpdri.duckdns.org/api/v1/admin/dashboard-summary/`
   - ❌ Should NOT show: `http://localhost:8000/api/v1/...`
   - ❌ Should NOT show: `http://127.0.0.1:8000/api/v1/...`

**Command Line Test:**
```bash
# Extract compiled baseURL from JavaScript
docker compose exec frontend sh -c 'cat /usr/share/nginx/html/assets/*.js' | \
    grep -o 'baseURL:"[^"]*"' | head -1

# Expected: baseURL:"https://lmsetjendpdri.duckdns.org/api/v1/"
# Wrong if: baseURL:"http://localhost:8000/api/v1/" or baseURL:"http://127.0.0.1:8000/api/v1/"
```

---

## 🔒 Permanent Prevention

### Option 1: Add Build Verification (Recommended)

Add to `frontend/Dockerfile` after line 29:

```dockerfile
# Verify the correct URL is being used
RUN echo "🔍 Verifying VITE_API_BASE_URL..." && \
    if [ "$VITE_API_BASE_URL" = "http://localhost:8000" ] || [ "$VITE_API_BASE_URL" = "http://127.0.0.1:8000" ]; then \
        echo "❌ ERROR: Building with localhost URL! This will break in production." && \
        echo "ℹ️  Set BACKEND_SITE_URL in .env file before building." && \
        exit 1; \
    fi && \
    echo "✅ Using production URL: $VITE_API_BASE_URL"
```

**Benefits:**
- ✅ Build fails early if wrong URL is used
- ✅ Prevents accidental localhost builds
- ✅ Clear error message for developers

---

### Option 2: Runtime Configuration (Advanced)

Instead of build-time variables, use runtime configuration:

**Create `public/config.js`:**
```javascript
window.ENV = {
    API_BASE_URL: 'https://lmsetjendpdri.duckdns.org'
};
```

**Update `axios.js`:**
```javascript
const API_BASE_URL = window.ENV?.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
```

**Benefits:**
- ✅ Can change URL without rebuilding
- ✅ Better for multi-environment deployments

**Drawbacks:**
- ⚠️ Requires nginx to serve config.js
- ⚠️ More complex setup

---

### Option 3: Add Build Tag with URL

Verify build includes correct URL in image metadata:

**Add to `docker-compose.yml`:**
```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    target: production
    args:
      VITE_API_BASE_URL: ${BACKEND_SITE_URL:-http://localhost:8000}
    labels:
      com.lmsetjen.api_url: ${BACKEND_SITE_URL}
```

**Check after build:**
```bash
docker inspect lmsetjen-dpd-ri-frontend | grep com.lmsetjen.api_url
```

---

## 📋 Deployment Checklist

Before every frontend deployment:

- [ ] **.env file** has `BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org`
- [ ] **docker-compose.yml** passes `${BACKEND_SITE_URL}` as build arg
- [ ] **Build logs** show correct URL: `Building with VITE_API_BASE_URL: https://lmsetjendpdri.duckdns.org`
- [ ] **Use `--no-cache`** for frontend rebuild if .env changed
- [ ] **Browser DevTools** Network tab shows correct API URLs
- [ ] **No 127.0.0.1 or localhost** in any API request URLs

---

## 🧪 Testing Commands

### Verify Current Configuration

```bash
# 1. Check .env
cat .env | grep BACKEND_SITE_URL

# 2. Check docker-compose resolves it
docker compose config | grep -A 2 "VITE_API_BASE_URL"

# 3. Check what's compiled in the running container
docker compose exec frontend sh -c 'cat /usr/share/nginx/html/assets/*.js | grep -o "baseURL:\"[^\"]*\"" | sort -u'

# 4. Test API endpoint directly
curl -I https://lmsetjendpdri.duckdns.org/api/v1/admin/dashboard-summary/
```

### Force Clean Rebuild

```bash
# Complete cleanup
docker compose down
docker system prune -a -f
docker volume prune -f
docker builder prune -a -f

# Rebuild everything
docker compose build --no-cache
docker compose up -d
```

---

## 📊 Error Comparison

| Error Type | Symptom | Cause | Solution |
|------------|---------|-------|----------|
| `ERR_NAME_NOT_RESOLVED` | DNS lookup failed | Wrong domain/localhost in compiled JS | Rebuild with correct URL |
| `ERR_CONNECTION_REFUSED` | Server unreachable | Backend down or wrong port | Check backend container |
| `403 Forbidden` | Authentication failed | Missing auth classes | Add JWTAuthentication |
| `CORS Error` | Cross-origin blocked | Wrong CORS settings | Update CORS_ALLOWED_ORIGINS |
| `Mixed Content` | HTTP→HTTPS blocked | HTTP URL in HTTPS page | Use HTTPS for API_BASE_URL |

**Current Error: `ERR_NAME_NOT_RESOLVED`** → **Frontend compiled with wrong URL**

---

## 🎯 Quick Fix Command

Run this single command to fix everything:

```bash
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21 "cd ~/LMSetjen-DPD-RI && \
  echo '🔍 Checking .env...' && \
  grep BACKEND_SITE_URL .env && \
  echo '🧹 Cleaning old build...' && \
  docker compose down frontend && \
  docker image rm lmsetjen-dpd-ri-frontend 2>/dev/null || true && \
  echo '🔨 Rebuilding frontend (this takes ~2 minutes)...' && \
  docker compose build --no-cache frontend && \
  echo '🚀 Starting frontend...' && \
  docker compose up -d frontend && \
  echo '✅ Done! Wait 10 seconds then test: https://lmsetjendpdri.duckdns.org/admin/dashboard/'"
```

---

## 💡 Key Insights

1. **Vite env vars are build-time**, not runtime
2. **Docker caching** can preserve old builds even after code changes
3. **Always use `--no-cache`** when changing environment variables
4. **Verify build logs** to confirm correct URL was used
5. **Test in browser DevTools** to see actual API request URLs

---

## 🔗 Related Documentation

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Docker Build Cache](https://docs.docker.com/build/cache/)
- [Axios Configuration](https://axios-http.com/docs/req_config)

---

**Status:** Ready to fix - run Step 2 (Complete Frontend Rebuild)
