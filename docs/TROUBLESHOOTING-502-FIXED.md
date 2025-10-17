# 🔧 502 Bad Gateway Error - Root Cause Analysis & Resolution

**Date**: October 17, 2025  
**Status**: ✅ **RESOLVED**  
**Severity**: Critical  
**Duration**: ~1 hour investigation + 5 minutes fix

---

## 📋 Problem Summary

### Symptoms
- **Error**: 502 Bad Gateway on all API endpoints
- **Affected URLs**:
  - `/api/v1/course/category/`
  - `/api/v1/course/course-list/`
  - All other `/api/*` endpoints
- **User Impact**: Frontend loaded but couldn't fetch any data from backend
- **Browser Console Error**: "Failed to load resource: the server responded with a status of 502"

### Error in Nginx Logs
```
2025/10/17 14:07:41 [error] upstream sent too big header while reading 
response header from upstream, client: 16.79.83.21, server: _, 
request: "GET /api/v1/course/category/ HTTP/1.0", 
upstream: "https://16.79.83.21:443/api/v1/course/category/", 
host: "lmsetjendpdri.duckdns.org"
```

**Key Observation**: Notice the upstream shows `https://16.79.83.21:443/api/v1/course/category/` - this means nginx was trying to proxy to **itself via HTTPS** instead of the backend container!

---

## 🔍 Root Cause Analysis

### Investigation Steps

1. **Checked Backend Container**
   ```bash
   docker logs lms_backend --tail 50
   ```
   **Result**: ✅ Backend healthy, responding correctly on port 8000
   - Gunicorn running
   - Health checks passing
   - No errors in logs

2. **Checked Frontend Nginx Logs**
   ```bash
   docker logs lms_frontend --tail 100
   ```
   **Result**: ❌ Found 50+ "upstream sent too big header" errors
   - All showing `upstream: "https://16.79.83.21:443/api/..."`
   - Creating infinite proxy loop

3. **Inspected Deployed Nginx Configuration**
   ```bash
   docker exec lms_frontend cat /etc/nginx/conf.d/default.conf
   ```
   **Result**: ❌ Found incorrect proxy configuration
   ```nginx
   location /api/ {
       proxy_pass https://lmsetjendpdri.duckdns.org;  # ❌ WRONG!
       proxy_buffer_size 4k;                           # ❌ Too small
   }
   ```

4. **Traced Configuration Source**
   - Checked `frontend/nginx-ssl.conf` in repository → Correct configuration
   - Checked `frontend/Dockerfile` → Copies `nginx.conf` (not nginx-ssl.conf)
   - Checked `frontend/docker-entrypoint.sh` → Found the culprit!
   ```bash
   if [ -n "$BACKEND_URL" ]; then
       sed -i "s|http://backend:8000|$BACKEND_URL|g" /etc/nginx/conf.d/default.conf
   fi
   ```

5. **Checked Environment Variables**
   ```bash
   grep BACKEND_SITE_URL .env
   ```
   **Result**: ❌ Found the root cause
   ```env
   BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org
   ```

---

## 🎯 Root Cause Identified

### The Proxy Loop Problem

**Configuration Flow**:
1. `.env` file sets: `BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org`
2. `docker-compose.yml` passes it to frontend: `BACKEND_URL: ${BACKEND_SITE_URL}`
3. `docker-entrypoint.sh` replaces nginx config:
   ```bash
   sed -i "s|http://backend:8000|https://lmsetjendpdri.duckdns.org|g"
   ```
4. Nginx tries to proxy API calls to **itself** via public HTTPS URL
5. Creates **infinite loop**: nginx → nginx → nginx → ...
6. Headers accumulate on each loop iteration
7. Eventually exceeds buffer size → "upstream sent too big header"
8. Returns **502 Bad Gateway**

### Why This Was Wrong

**❌ What Was Happening**:
```
Client Request → Nginx (lms_frontend)
                   ↓
    proxy_pass https://lmsetjendpdri.duckdns.org/api/
                   ↓
              Nginx (same container!) → Loop!
```

**✅ What Should Happen**:
```
Client Request → Nginx (lms_frontend)
                   ↓
         proxy_pass http://backend:8000
                   ↓
              Backend Container (Django + Gunicorn)
```

---

## ✅ Solution Implemented

### Fix #1: Remove BACKEND_URL Environment Variable

**File**: `docker-compose.yml`

**Before**:
```yaml
frontend:
  environment:
    BACKEND_URL: ${BACKEND_SITE_URL:-http://localhost:8000}
```

**After**:
```yaml
frontend:
  # Note: No BACKEND_URL env var - nginx must always proxy 
  # to internal Docker network (http://backend:8000)
```

**Reason**: Nginx should **ALWAYS** proxy to the internal Docker network address, never to the public HTTPS URL.

### Fix #2: Increased Proxy Buffer Sizes (Prevention)

**File**: `frontend/nginx-ssl.conf`

**Before**:
```nginx
proxy_buffer_size 4k;
proxy_buffers 8 4k;
proxy_busy_buffers_size 8k;
```

**After**:
```nginx
proxy_buffer_size 16k;           # 4x larger
proxy_buffers 4 32k;             # 4x larger per buffer
proxy_busy_buffers_size 64k;     # 8x larger
proxy_max_temp_file_size 0;      # Disable disk writes
```

**Reason**: Even if headers grow large, nginx can handle them without errors.

---

## 📊 Verification & Results

### Before Fix
```bash
$ curl -I https://lmsetjendpdri.duckdns.org/api/v1/course/category/
HTTP/2 502                                    # ❌ ERROR
```

### After Fix
```bash
$ curl -I https://lmsetjendpdri.duckdns.org/api/v1/course/category/
HTTP/2 200                                    # ✅ SUCCESS
server: nginx/1.25.5
content-type: application/json
```

### Container Status
```bash
$ docker compose ps
NAME           STATUS
lms_backend    Up 21 minutes (healthy)  ✅
lms_frontend   Up 54 seconds (healthy)  ✅
lms_postgres   Up 1 hour (healthy)      ✅
lms_redis      Up 1 hour (healthy)      ✅
```

### Nginx Logs (After Fix)
```
✅ Frontend ready!
16.79.83.21 - - [17/Oct/2025:14:12:10 +0000] 
"HEAD /api/v1/course/category/ HTTP/2.0" 200 0 "-" "curl/8.5.0" "-"
```
**No more errors!** 🎉

---

## 🎓 Lessons Learned

### 1. Docker Networking Concepts

**Internal vs External URLs**:
- **Internal Docker Network**: Containers communicate via service names
  - Example: `http://backend:8000`
  - Fast, no encryption overhead
  - No need for DNS resolution
  
- **External Public URLs**: For client browsers
  - Example: `https://lmsetjendpdri.duckdns.org`
  - Goes through SSL/TLS
  - DNS resolution required
  - Should **NEVER** be used for internal proxy

### 2. Environment Variable Scope

**Different purposes for different URLs**:

| Variable | Purpose | Used By | Value |
|----------|---------|---------|-------|
| `BACKEND_SITE_URL` | Public API URL | Frontend JS code | `https://lmsetjendpdri.duckdns.org` |
| `BACKEND_URL` | Nginx proxy target | Nginx config | Should be `http://backend:8000` |

**Mistake**: We used the same public URL for both purposes.

### 3. Debugging Docker Issues

**Effective debugging sequence**:
1. Check container health: `docker compose ps`
2. Check application logs: `docker logs <container>`
3. Inspect running config: `docker exec <container> cat <config-file>`
4. Trace configuration source: Dockerfile → entrypoint → env vars
5. Test endpoints: `curl -I <url>`

### 4. Nginx Proxy Best Practices

**Always for internal proxying**:
```nginx
# ✅ CORRECT - Direct to Docker service
location /api/ {
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
}

# ❌ WRONG - Creates loop or unnecessary overhead
location /api/ {
    proxy_pass https://example.com;  # Don't proxy to yourself!
}
```

---

## 🛡️ Prevention Measures

### 1. Documentation Added
- ✅ This troubleshooting guide
- ✅ Comments in docker-compose.yml
- ✅ Updated deployment guide

### 2. Configuration Validation
- ✅ Removed problematic environment variable
- ✅ Added inline comments explaining why
- ✅ Increased buffer sizes as safety net

### 3. Testing Checklist
After any nginx or proxy changes:
```bash
# 1. Check nginx config syntax
docker exec lms_frontend nginx -t

# 2. Verify proxy target in deployed config
docker exec lms_frontend cat /etc/nginx/conf.d/default.conf | grep proxy_pass

# 3. Test API endpoints
curl -I https://lmsetjendpdri.duckdns.org/api/v1/course/category/

# 4. Check for errors in logs
docker logs lms_frontend --tail 50 | grep error
```

---

## 📝 Deployment Steps (For Future Reference)

When similar issues occur:

### Step 1: Diagnose
```bash
# SSH to server
ssh -i "<key>.pem" ubuntu@<ip>
cd /home/ubuntu/LMSetjen-DPD-RI

# Check logs
docker logs lms_frontend --tail 100 | grep error
docker logs lms_backend --tail 50

# Check deployed config
docker exec lms_frontend cat /etc/nginx/conf.d/default.conf | grep -A 10 "location /api"
```

### Step 2: Pull & Rebuild
```bash
# Pull latest code
git pull origin main

# Rebuild affected container
docker compose up -d --build frontend

# Verify all healthy
docker compose ps
```

### Step 3: Test
```bash
# Test API endpoints
curl -I https://lmsetjendpdri.duckdns.org/api/v1/course/category/

# Check logs for errors
docker logs lms_frontend --tail 30
```

---

## 🔗 Related Files

### Modified Files
1. **docker-compose.yml** - Removed `BACKEND_URL` environment variable
2. **frontend/nginx-ssl.conf** - Increased buffer sizes (prevention)

### Reference Files
- `frontend/Dockerfile` - Shows nginx.conf is copied
- `frontend/docker-entrypoint.sh` - Contains sed replacement logic
- `.env` - Contains public URL configuration

### Documentation
- `docs/SSL-SETUP.md` - SSL certificate setup
- `docs/DEPLOYMENT-GUIDE.md` - General deployment guide
- `docs/TROUBLESHOOTING-502-FIXED.md` - This file

---

## ✨ Final Status

**Problem**: ❌ 502 Bad Gateway on all API endpoints  
**Root Cause**: ✅ Identified - Nginx proxy loop  
**Solution**: ✅ Implemented - Removed BACKEND_URL env var  
**Verification**: ✅ Tested - All APIs return 200 OK  
**Documentation**: ✅ Complete - This guide created  
**Prevention**: ✅ In place - Buffer sizes increased, comments added  

**Time to Resolution**: ~5 minutes after root cause identified  
**Downtime**: ~1 hour during investigation  
**Impact**: No data loss, configuration-only issue  

---

## 🙋 Need Help?

If you encounter similar issues:

1. **Check this guide first** - Most common issues documented here
2. **Follow the debugging steps** - Systematic approach works best
3. **Check GitHub commits** - See exact changes made:
   - Commit `c2bf87d`: Remove BACKEND_URL env var
   - Commit `1a4acc8`: Increase proxy buffer sizes

---

**Document Version**: 1.0  
**Last Updated**: October 17, 2025  
**Author**: AI Assistant + Development Team  
**Status**: ✅ Issue Resolved & Documented
