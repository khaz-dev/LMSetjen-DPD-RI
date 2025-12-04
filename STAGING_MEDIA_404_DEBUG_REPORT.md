# Staging Media 404 Error - Deep Debug Report
**Date**: December 4, 2025  
**Status**: ROOT CAUSE IDENTIFIED & SOLUTION PROVIDED  
**Severity**: CRITICAL - Images not loading on instructor dashboard

---

## Error Evidence

```
GET https://lmsetjendpdri.duckdns.org/api/media/course-file/5116d29b-762b-44b7-91bb-8e6a884e4dbb.png 404 (Not Found)
```

---

## Investigation Summary

### 1. Staging Deployment Status
- **Deployed Commit**: `c30d126` (Phase 4.38) ❌ NOT Phase 4.39!
- **Frontend Build**: December 4, 03:14 UTC (Phase 4.38)
- **Expected**: `b60820f` (Phase 4.39)
- **Finding**: Phase 4.39 has NOT been deployed to staging yet

### 2. Media File Accessibility

| Test URL | Result | Status |
|----------|--------|--------|
| `/media/course-file/5116d29b...png` | 200 OK | ✅ Working |
| `/api/media/course-file/5116d29b...png` | 404 Not Found | ❌ Broken |

- **File Exists**: YES - confirmed in `/app/media/course-file/` container directory
- **Volume Mounted**: YES - nginx container has `/usr/share/nginx/html/media:ro`
- **Nginx Serving**: YES - direct `/media/` URLs work perfectly

### 3. Root Cause Analysis

**The Problem Chain:**

```
1. API returns: https://lmsetjendpdri.duckdns.org/media/course-file/5116d29b...png
   ✅ This is correct (full absolute URL)

2. courseUtils.js getImageUrl() extracts path:
   - Input: https://lmsetjendpdri.duckdns.org/media/course-file/5116d29b...png
   - Splits by "/media/" → parts = ["...duckdns.org", "course-file/5116d29b...png"]
   - Extracts: cleanUrl = "course-file/5116d29b...png" 
   - Problem: STRIPS the "/media/" prefix!

3. Then calls getMediaUrl(cleanUrl):
   - Input: "course-file/5116d29b...png" (relative path)
   - const getMediaUrl = (path) => `${baseURL}/media/${cleanUrl}`
   - baseURL = "/api" (in production)
   - Output: "/api/media/course-file/5116d29b...png"
   - Result: 404 ❌

3. Expected Path: "/media/course-file/5116d29b...png" ✅
```

**File**: `frontend/src/utils/courseUtils.js` lines 23-30

```javascript
// BUGGY CODE:
const mediaPattern = /\/media\//;
if (mediaPattern.test(cleanUrl)) {
    const parts = cleanUrl.split('/media/');
    if (parts.length > 1) {
        cleanUrl = parts[parts.length - 1];  // ❌ Strips "/media/" prefix!
    }
}
```

---

## Backend URL Configuration (Verified)

### Django Settings
```python
MEDIA_URL = '/media/'  # ✅ Correct
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')  # ✅ Correct
```

### URL Routing
```python
# backend/backend/urls.py
urlpatterns += [
    re_path(r'^media/(?P<path>.*\.(mp4|webm|...)', VideoStreamView.as_view()),
    re_path(r'^media/(?P<path>.*)', EnhancedMediaView.as_view()),
]
# ✅ Routes: /media/... (NOT /api/media/)
```

### Nginx Configuration
```nginx
# /etc/nginx/conf.d/default.conf
location /media/ {
    alias /usr/share/nginx/html/media/;
    expires 1y;
    # Fallback to @backend_media for processing
    try_files $uri @backend_media;
}

location @backend_media {
    proxy_pass http://lms_backend:8000;
    # Proxies to backend's /media/ endpoint
}
```

✅ **Nginx correctly serves `/media/` directly from filesystem**

---

## Solution: Fix courseUtils.js

### The Issue
When the API returns a full URL with `/media/`, courseUtils extracts just the filename and passes it to `getMediaUrl()`, which then adds the wrong prefix `/api/media/`.

### The Fix
Preserve the `/media/` part when extracting the path:

**Before (Buggy)**:
```javascript
const mediaPattern = /\/media\//;
if (mediaPattern.test(cleanUrl)) {
    const parts = cleanUrl.split('/media/');
    if (parts.length > 1) {
        cleanUrl = parts[parts.length - 1];  // Strips /media/ ❌
    }
}
return getMediaUrl(cleanUrl);  // Adds /api/media/ ❌
```

**After (Fixed)**:
```javascript
const mediaPattern = /\/media\//;
if (mediaPattern.test(cleanUrl)) {
    const parts = cleanUrl.split('/media/');
    if (parts.length > 1) {
        cleanUrl = '/media/' + parts[parts.length - 1];  // Keep /media/ ✅
    }
}
return getMediaUrl(cleanUrl);  // Will correctly handle it
```

### How getMediaUrl() Handles It
```javascript
export const getMediaUrl = (path) => {
    if (path.startsWith('/media/')) {
        // Already has the correct path structure
        return `${baseURL}${path}`;  // /api + /media/... = /api/media/... ❌
        // Still wrong! Need to handle this case
    }
    // ...rest of logic
};
```

**WAIT - There's a deeper issue in getMediaUrl()!**

### The Real Fix Required

`getMediaUrl()` in constants.js needs to return `/media/...` not `/api/media/...`:

**Current Logic**:
```javascript
export const getMediaUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;  // ✅ Full URLs bypass everything
    }
    
    if (path.startsWith('/media/')) {
        return `${baseURL}${path}`;  // /api + /media/ = /api/media/ ❌
    }
    
    if (path.startsWith('/')) {
        return `${baseURL}/media${path}`;
    }
    
    return `${baseURL}/media/${path}`;  // /api + /media/ + path = /api/media/... ❌
};
```

**All paths are being routed through `/api/` but the media endpoint is at `/media/` (root level), not `/api/media/`!**

### Correct Fix

```javascript
export const getMediaUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    
    // Media files are served directly from /media/, not /api/media/
    // They are NOT part of the API, they are served by nginx
    if (path.startsWith('/media/')) {
        return path;  // Already correct path
    }
    
    if (path.startsWith('/')) {
        return `/media${path}`;  // Add /media prefix (not /api/media)
    }
    
    return `/media/${path}`;  // Add /media/ prefix (not /api/media/)
};
```

---

## Files Requiring Changes

### 1. `frontend/src/utils/constants.js`
**Issue**: `getMediaUrl()` returns `/api/media/...` instead of `/media/...`

**Fix**: Remove `baseURL` logic for media paths, return direct `/media/` URLs

---

## Nginx Configuration Verification

✅ **Direct `/media/` serving works**:
- Location block exists: `location /media/`
- Volume mounted: `media_files:/usr/share/nginx/html/media:ro`
- Try_files: Falls back to `@backend_media` proxy if file not found
- Files exist: Confirmed 6 media files in container

✅ **Nginx routes to backend's `/media/` endpoints**:
- Backend has proper media URL routing
- VideoStreamView handles `.mp4`, `.webm`, etc.
- EnhancedMediaView handles all other media types

---

## Verification Tests

### Test 1: Direct Media URL ✅ WORKS
```bash
curl -I https://lmsetjendpdri.duckdns.org/media/course-file/5116d29b-762b-44b7-91bb-8e6a884e4dbb.png
# Result: HTTP/2 200 OK, content-type: image/png
```

### Test 2: API Media URL ❌ BROKEN
```bash
curl -I https://lmsetjendpdri.duckdns.org/api/media/course-file/5116d29b-762b-44b7-91bb-8e6a884e4dbb.png
# Result: HTTP/2 404 Not Found
```

### Test 3: Media File In Container ✅ EXISTS
```bash
docker exec lms_backend ls -la /app/media/course-file/5116d29b-762b-44b7-91bb-8e6a884e4dbb.png
# Result: -rw-r--r-- 1 appuser appuser 256500
```

---

## Deployment Status

### Current Staging
- Commit: `c30d126` (Phase 4.38)
- Build Date: Dec 4, 03:14 UTC
- Phase 4.39: NOT DEPLOYED ❌

### What Phase 4.39 Should Fix
Phase 4.39 (locally present in `b60820f`) claims to fix this exact issue with courseUtils.js, but:
- Fix is committed locally ✅
- Fix is pushed to GitHub ✅  
- Fix is NOT deployed to staging ❌

### The Real Problem
1. Constants.js is returning wrong URL format (`/api/media/` instead of `/media/`)
2. Phase 4.39 only fixed courseUtils.js (not constants.js)
3. Phase 4.39 was never deployed to staging

---

## Complete Solution Checklist

- [ ] Fix `frontend/src/utils/constants.js` - getMediaUrl() function
- [ ] Rebuild frontend: `npm run build`
- [ ] Deploy to staging: Git pull + docker rebuild
- [ ] Test direct `/media/` URL: ✅ Already works
- [ ] Test image loading on instructor dashboard
- [ ] Verify no 404 errors in browser console
- [ ] Test with Phase 4.39 code (if deploying that version)
- [ ] Document media URL architecture for future reference

---

## Architecture Reference

### Media URL Path Decision Tree
```
Input URL to Frontend Component
    ↓
Is it absolute (http://...)?  
    YES → Return as-is ✅
    NO ↓
Does it start with /media/?
    YES → Return as-is ✅
    NO ↓
Does it contain /media/ somewhere?
    YES → Extract path INCLUDING /media/ prefix ✅
    NO ↓
Is it relative (course-file/...)?
    YES → Return /media/ + path ✅
```

### Serving Architecture
```
Frontend Request
    ↓
Browser GET /media/course-file/...
    ↓
Nginx (port 443)
    ↓
Try local filesystem /usr/share/nginx/html/media/
    YES → Return file directly (200 OK) ✅
    NO ↓
Fallback to @backend_media proxy
    ↓
Backend Django /media/ endpoint
    ↓
Return file with streaming support
```

**NOTE**: There is NO `/api/media/` endpoint anywhere in the system!

---

## Staging Server Details

- **Hostname**: lmsetjendpdri.duckdns.org
- **IP**: 16.78.84.41
- **User**: ubuntu
- **Key**: D:\Project\lms-server-key.pem
- **Containers**: 4 (frontend, backend, postgres, redis)
- **Volumes**: Named volumes for persistence
- **SSL**: Let's Encrypt HTTPS (valid)

---

## Commands for Quick Testing

### SSH to Staging
```bash
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.78.84.41
```

### Check Git Commit
```bash
cd /home/ubuntu/LMSetjen-DPD-RI && git log -1 --oneline
```

### Test Media URL
```bash
curl -I https://lmsetjendpdri.duckdns.org/media/course-file/5116d29b-762b-44b7-91bb-8e6a884e4dbb.png
```

### Check Container Media
```bash
docker exec lms_backend ls -la /app/media/course-file/ | head -10
```

### View Nginx Config
```bash
docker exec lms_frontend cat /etc/nginx/conf.d/default.conf | grep -A 10 "location /media"
```

---

## Next Steps

1. **CRITICAL**: Fix `constants.js` getMediaUrl() function
2. **IMPORTANT**: Deploy Phase 4.39 to staging (includes courseUtils fix)
3. **VERIFY**: Test all media endpoints work correctly
4. **MONITOR**: Check staging console for any remaining 404 errors
5. **DOCUMENT**: Update media serving documentation

---

## Root Cause Summary

| Component | Issue | Status |
|-----------|-------|--------|
| Backend `/media/` routes | ✅ Correctly configured | OK |
| Nginx `/media/` serving | ✅ Working (200 OK) | OK |
| Docker volumes | ✅ Properly mounted | OK |
| Media file storage | ✅ Files exist | OK |
| **Frontend getMediaUrl()** | ❌ Returns `/api/media/...` | **BROKEN** |
| Phase 4.39 deployment | ❌ Not deployed to staging | **NOT DEPLOYED** |

**Bottom Line**: The frontend is constructing URLs with an endpoint that doesn't exist (`/api/media/`). The fix is to make `getMediaUrl()` return `/media/...` instead of `/api/media/...`.
