# Google OAuth CORS & Integration Troubleshooting Guide

## Problem Summary

Users encountering CORS errors when attempting Google OAuth login:
- Error: "The fetch of the id assertion endpoint resulted in a network error: ERR_FAILED"
- Error: "Server did not send the correct CORS headers"
- Error: "FedCM get() rejects with IdentityCredentialError"

## Root Causes & Solutions

### 1. Google Cloud Console Configuration Issues

**Problem:** Client ID not properly whitelisted for your domain/port

**Check:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **LMSetjen DPD RI**
3. Go to **Credentials** → **OAuth 2.0 Client IDs**
4. Click the web application credentials

**Verify Authorized Redirect URIs include:**
```
http://localhost:5173
http://localhost:5173/login
http://localhost:8000
http://localhost:8000/api/v1/auth/google/
http://localhost:3000
```

**Verify Authorized JavaScript Origins include:**
```
http://localhost:5173
http://localhost:8000
http://localhost:3000
http://127.0.0.1:5173
http://127.0.0.1:8000
```

**Fix:** If missing, click **ADD URI** and add the missing URLs

---

### 2. Frontend Environment Variable Not Set

**Problem:** `VITE_GOOGLE_CLIENT_ID` not configured or incorrect

**Check Frontend:**
```bash
cd frontend
cat .env | grep VITE_GOOGLE_CLIENT_ID
```

**Expected:**
```dotenv
VITE_GOOGLE_CLIENT_ID=634643429020-fqsklueemda8b84085nhmracbkamtrip.apps.googleusercontent.com
```

**Fix if missing/incorrect:**
```bash
# Open frontend/.env
VITE_GOOGLE_CLIENT_ID=634643429020-fqsklueemda8b84085nhmracbkamtrip.apps.googleusercontent.com
```

**Important:** Restart frontend dev server after changing .env:
```bash
npm run dev  # This reloads env variables
```

---

### 3. Backend CORS Configuration Incomplete

**Problem:** Backend not sending proper CORS response headers

**Check Backend Settings:**
```python
# File: backend/backend/settings.py

# Should have:
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # ... other origins
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

CORS_EXPOSE_HEADERS = [
    'content-type',
    'x-csrftoken',
    'authorization',
]

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]
```

**Fix:** If `CORS_EXPOSE_HEADERS` or `CORS_ALLOW_METHODS` missing, add them as shown above

---

### 4. Django Middleware Order Issue

**Problem:** CORS middleware not in correct position

**Check:**
```python
# File: backend/backend/settings.py line ~81

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',  # ← Must be EARLY
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    # ...
]
```

**Fix:** If `corsheaders.middleware.CorsMiddleware` is not #2, move it right after SecurityMiddleware

---

### 5. GoogleOAuthAPIView Not Handling OPTIONS Requests

**Problem:** Browser preflight OPTIONS request failing

**Check Backend View:**
```python
# File: backend/api/views.py line ~374

@method_decorator(csrf_exempt, name='dispatch')
class GoogleOAuthAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    
    def options(self, request, *args, **kwargs):
        """Handle CORS preflight requests"""
        return Response(status=status.HTTP_200_OK)
    
    def post(self, request):
        # ... authentication logic
```

**Fix:** If `options()` method missing, add it exactly as shown above

---

### 6. Backend Not Running or Connection Issues

**Problem:** Frontend can't reach backend at all

**Check Backend Status:**
```bash
# Check if Django is running
curl http://localhost:8000/api/v1/auth/google/

# Expected response: 405 Method Not Allowed (POST required)
# Or check if backend is running at all
```

**If not running:**
```bash
cd backend
python manage.py runserver
# Should show: Starting development server at http://127.0.0.1:8000/
```

---

### 7. Frontend Not Using Correct API Instance

**Problem:** Frontend not sending requests to correct backend URL

**Check Frontend Code:**
```javascript
// File: frontend/src/views/auth/Login.jsx

import apiInstance from "../../utils/useAxios";

// In handleGoogleResponse function:
const result = await apiInstance.post('/auth/google/', {
    token: response.credential,
    token_type: 'id_token'
});
```

**Verify apiInstance Configuration:**
```javascript
// File: frontend/src/utils/useAxios.js

const apiInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    // ... other config
});
```

**Check Frontend .env:**
```dotenv
VITE_API_URL=http://localhost:8000
```

---

## Debugging Steps

### Step 1: Check Browser Console
1. Open frontend at http://localhost:5173/login
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Click **"Masuk dengan Google"** button
5. Look for debug messages:
   - ✅ Good: `🔍 DEBUG: Google Login initiated`
   - ✅ Good: `✅ Google API is available, initializing...`
   - ❌ Bad: `Google Sign-In API not loaded` (script not loaded)

### Step 2: Check Network Tab
1. In Developer Tools, go to **Network** tab
2. Filter to show only requests to `localhost:8000`
3. Look for request to `/api/v1/auth/google/`
4. Check request headers:
   ```
   Request Method: OPTIONS (first preflight) or POST
   Status: 200 (OPTIONS) or 200 (POST success)
   Response Headers should include:
   - Access-Control-Allow-Origin: http://localhost:5173
   - Access-Control-Allow-Methods: POST, OPTIONS
   - Access-Control-Allow-Headers: authorization, content-type, ...
   ```

### Step 3: Check Backend Logs
1. In terminal running backend (django runserver)
2. Look for logs like:
   ```
   🔐 Google OAuth Verification Started
   ✅ Google token verified successfully
   📊 Extracting user data from Google token...
   ✅ JWT tokens generated successfully
   ```

### Step 4: Test CORS Manually
```bash
# Test if backend accepts OPTIONS request
curl -X OPTIONS http://localhost:8000/api/v1/auth/google/ \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Should see in response headers:
# Access-Control-Allow-Origin: http://localhost:5173
# Access-Control-Allow-Methods: POST, OPTIONS
```

---

## Common Solutions Checklist

- [ ] **Google Client ID is correct** and in frontend/.env
- [ ] **Redirect URIs added** in Google Cloud Console for localhost:5173 and :8000
- [ ] **JavaScript Origins added** in Google Cloud Console for localhost:5173
- [ ] **Backend .env has valid Google credentials** (check backend/.env)
- [ ] **Django settings has CORS_EXPOSE_HEADERS** defined
- [ ] **CorsMiddleware is early in MIDDLEWARE list** (position 2)
- [ ] **GoogleOAuthAPIView has OPTIONS method** defined
- [ ] **Frontend dev server restarted** after .env changes
- [ ] **Backend dev server running** on port 8000
- [ ] **Google Sign-In script loaded** in frontend/index.html

---

## If All Else Fails: Reset Configuration

### 1. Clear Frontend Cache
```bash
cd frontend
rm -rf node_modules/.vite  # or node_modules on Windows
npm run dev  # Fresh start
```

### 2. Verify Backend Server Health
```bash
cd backend
python manage.py check  # Check for config issues
python manage.py runserver  # Fresh start
```

### 3. Test Direct Backend Connection
```bash
# From terminal
curl http://localhost:8000/api/v1/auth/google/

# Should return 405 Method Not Allowed (since GET is not supported)
# This means backend is running and endpoint is accessible
```

### 4. Check Django Error Logs
```bash
# If using Docker:
docker logs lms_backend

# Or check for log files:
ls backend/logs/
cat backend/django_error.log
```

---

## Related Files Modified This Session

- `backend/backend/settings.py` - Added CORS_EXPOSE_HEADERS
- `backend/api/views.py` - Added OPTIONS method to GoogleOAuthAPIView (already present)
- `frontend/src/views/auth/Login.jsx` - Enhanced error logging and validation

---

## Quick Reference: Critical Configuration

### Frontend (.env)
```dotenv
VITE_GOOGLE_CLIENT_ID=634643429020-fqsklueemda8b84085nhmracbkamtrip.apps.googleusercontent.com
VITE_API_URL=http://localhost:8000
```

### Backend (.env)
```dotenv
GOOGLE_CLIENT_ID=634643429020-fqsklueemda8b84085nhmracbkamtrip.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

### Backend (Django Settings)
```python
CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:8000"]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']
CORS_ALLOW_HEADERS = ['accept', 'accept-encoding', 'authorization', 'content-type', ...]
CORS_EXPOSE_HEADERS = ['content-type', 'x-csrftoken', 'authorization']
```

### Google Cloud OAuth Settings
**Authorized Redirect URIs:**
- http://localhost:5173
- http://localhost:8000/api/v1/auth/google/

**Authorized JavaScript Origins:**
- http://localhost:5173
- http://localhost:8000

---

## Still Having Issues?

1. **Check token validity:** Tokens expire, refresh them if needed
2. **Check user permissions:** Ensure user.role is set correctly in database
3. **Check database:** Verify User model is correctly updated with Google data
4. **Check logs:** Backend logs show detailed error messages with 🔐 and ✅ prefixes

**For production deployment:** See NGINX_CONFIGURATION_DIAGNOSTIC_REPORT.md for production CORS setup
