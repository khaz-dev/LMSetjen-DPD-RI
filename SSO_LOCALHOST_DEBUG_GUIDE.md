# 🔧 SSO Integration - Localhost Debugging Guide

**Status:** Development/Testing on Localhost  
**Date:** November 18, 2025  
**Focus:** Fixing SSO integration for localhost testing

---

## 📋 Overview

You're receiving an SSO token from Nusa DPD but the frontend isn't processing it correctly on localhost. This guide helps debug and fix the issue.

### Your Test Link
```
http://localhost:5173/sso/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJuaXAiOiIxOTk3MDExODIwMjUwNjEwMDEiLCJpYXQiOjE3NjM0NTA5MzgsImV4cCI6MTc2MzQ1NDUzOH0.KdOc7e7wnGSfQTQBSA_ebElA7s9KmDltREOpAiMoa5A
```

---

## 🔍 Debugging Steps

### Step 1: Check Browser Console

**Open DevTools (F12) and go to Console tab**

You should see these logs:

```
🔐 SSO Login Started
SSO Token: eyJ0eXAiOiJKV1QiL...
API Base URL: http://127.0.0.1:8000
Full endpoint URL: http://127.0.0.1:8000/api/v1/sso/verify/
📤 Sending SSO token to backend...
```

**Issues to look for:**
- ❌ "MISSING" SSO token → Token not in URL
- ❌ "Network Error" → Backend not running
- ❌ CORS error → Backend CORS misconfigured

### Step 2: Check Backend Logs

**Open terminal where Django is running:**

```bash
# In your backend terminal, look for:
🔐 SSO Token Verification Started
✅ Token decoded successfully
👤 Getting or creating user from SSO data...
✅ User found/created
🎉 SSO login successful
```

**If you don't see these:**

```bash
# Check Django server is running
docker compose ps
# Backend should show "Up"

# View logs in real-time
docker compose logs -f backend

# Or if running locally:
python manage.py runserver 0.0.0.0:8000
```

### Step 3: Test Token Manually

**In terminal, test the backend directly:**

```bash
# Your token from the link
SSO_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJuaXAiOiIxOTk3MDExODIwMjUwNjEwMDEiLCJpYXQiOjE3NjM0NTA5MzgsImV4cCI6MTc2MzQ1NDUzOH0.KdOc7e7wnGSfQTQBSA_ebElA7s9KmDltREOpAiMoa5A"

# Test backend endpoint
curl -X POST http://127.0.0.1:8000/api/v1/sso/verify/ \
  -H "Content-Type: application/json" \
  -d "{\"sso_token\": \"$SSO_TOKEN\"}"

# Should return:
{
  "access": "eyJ0eXA...",
  "refresh": "eyJ0eXA...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "User Name",
    "role": "student",
    "nip": "19970118202506100001"
  },
  "created": true,
  "message": "SSO login successful"
}
```

**If this fails, check:**
1. Backend is running on port 8000
2. Token is not expired
3. Database is accessible

### Step 4: Check Cookies

**In Browser Console (DevTools):**

```javascript
// Check if cookies are being set
document.cookie

// Should show:
// access_token=eyJ0eXA...; refresh_token=eyJ0eXA...

// Check individual cookies
console.log(document.cookie);
```

**Common issues:**
- Cookies not appearing → Backend not returning tokens
- Secure flag issues → Using `secure: false` for localhost (fixed in updated code)
- SameSite=Strict → Changed to `Lax` for localhost

### Step 5: Network Tab Inspection

**In DevTools, go to Network tab:**

1. **Clear storage first:**
   - Go to Application → Cookies → Delete all
   - Go to Application → Local Storage → Delete all

2. **Reload page with SSO token**

3. **Look for POST request to `/api/v1/sso/verify/`:**
   - **Status:** Should be 200 OK
   - **Request:** Contains `sso_token`
   - **Response:** Contains `access` and `refresh` tokens

**If request shows:**
- **404:** Endpoint doesn't exist
- **400:** Invalid token format
- **401:** Token verification failed
- **500:** Backend error (check logs)
- **CORS error:** Backend CORS misconfigured

---

## ⚡ Quick Fixes

### Fix 1: Cookie Settings for Localhost

**Already applied in updated code:**

```javascript
// OLD (doesn't work on localhost)
Cookie.default.set('access_token', access, {
  expires: 7,
  secure: true,
  sameSite: 'Strict',
});

// NEW (works on localhost)
Cookie.default.set('access_token', access, {
  expires: 7,
  secure: false,  // Allow localhost HTTP
  sameSite: 'Lax', // More permissive for localhost
});
```

### Fix 2: Backend CORS Configuration

**Check `backend/backend/settings.py`:**

```python
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",      # ← Must include your frontend port
    "http://127.0.0.1:5173",      # ← Both localhost and 127.0.0.1
    # ... other domains
])
```

**Status:** ✅ Already configured

### Fix 3: API Base URL

**Check `frontend/src/utils/axios.js`:**

```javascript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
```

**Or set environment variable in `.env`:**

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Fix 4: Frontend Route Registration

**Check `frontend/src/App.jsx`:**

```jsx
// Should have:
<Route path="/sso/:sso_token/" element={<SSOLogin />} />
```

**Status:** ✅ Already configured

---

## 🛠️ Troubleshooting Common Issues

### ❌ Token expires immediately

**Problem:** Token shows as expired in console

**Solution:**
```bash
# Check token expiration
python manage.py shell
>>> import jwt
>>> from datetime import datetime
>>> token = "eyJ0eXAi..."
>>> decoded = jwt.decode(token, options={"verify_signature": False})
>>> print(datetime.fromtimestamp(decoded['exp']))
# If time is in past, token is expired

# Get new token from Nusa DPD
```

### ❌ "Network Error" in browser

**Problem:** Can't reach backend

**Solution:**
```bash
# Check if backend is running
curl http://127.0.0.1:8000/api/v1/health/

# Should return 200 OK

# If using Docker:
docker compose logs backend
docker compose restart backend
```

### ❌ CORS Error

**Problem:** "Access to XMLHttpRequest blocked by CORS policy"

**Solution:**
```python
# In backend/backend/settings.py, ensure:
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # ... add your frontend URL
]
```

### ❌ Cookies not being set

**Problem:** Tokens generated but cookies empty

**Solution:**
```javascript
// Check console for cookie errors
console.log(document.cookie);

// If empty, the issue is likely:
// 1. Response didn't contain tokens
// 2. js-cookie not imported correctly
// 3. Cookie settings too restrictive

// Verify backend returned tokens
// Check Network tab, Response should have: "access", "refresh"
```

### ❌ Redirect not working

**Problem:** Logged in but not redirected to dashboard

**Solution:**
```javascript
// Check console logs
// Look for "👤 User data:" and "Redirecting based on role:"

// If role is null:
// - User might not have role set
// - Database user record incomplete
// - Check backend logs

// Manual check:
// Go to Application → Cookies → access_token
// Copy token
// Go to https://jwt.io/
// Paste token to decode
// Check user data is present
```

---

## 📊 Complete Debug Checklist

- [ ] Browser console shows SSO logs (🔐 SSO Login Started)
- [ ] Backend logs show "SSO Token Verification Started"
- [ ] Manual curl test returns tokens (HTTP 200)
- [ ] Cookies appear in DevTools (access_token, refresh_token)
- [ ] Network tab shows POST /api/v1/sso/verify/ with status 200
- [ ] No CORS errors in console
- [ ] No JavaScript errors in console
- [ ] User redirects to dashboard after login
- [ ] Login persists (tokens in cookies)

---

## 🔄 Complete Testing Flow

### 1. Start Services

```bash
# Terminal 1: Backend
cd backend
python manage.py runserver 0.0.0.0:8000

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Monitor backend
docker compose logs -f backend
```

### 2. Get SSO Token

Visit Nusa DPD and get the SSO token:
```
https://nusadpd.duckdns.org/...
# Gets redirected with token in URL
```

### 3. Test on Localhost

Open browser and visit:
```
http://localhost:5173/sso/{your_sso_token_here}
```

### 4. Monitor

Open DevTools (F12) and watch:
- Console tab → SSO debug logs
- Network tab → POST request to sso/verify/
- Application → Cookies → Token storage
- Backend terminal → SSO processing logs

### 5. Verify Success

You should see:
- ✅ Console: "🎉 SSO login successful for user"
- ✅ Network: POST sso/verify/ returns 200
- ✅ Cookies: access_token and refresh_token set
- ✅ Redirect: Automatically goes to /student/dashboard/

---

## 📝 Logging Output Examples

### ✅ Successful SSO Login Flow

**Browser Console:**
```
🔐 SSO Login Started
SSO Token: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
API Base URL: http://127.0.0.1:8000
Full endpoint URL: http://127.0.0.1:8000/api/v1/sso/verify/
📤 Sending SSO token to backend...
✅ Backend response received: 200
Response data: {
  access: "eyJ0eXAiOi...",
  refresh: "eyJ0eXAiOi...",
  user: {...},
  created: true
}
💾 Storing tokens in cookies...
🍪 Tokens stored successfully
Access token cookie: eyJ0eXAiOiJKV1QiLCJh...
Refresh token cookie: eyJ0eXAiOiJKV1QiLCJh...
👤 User data: {id: 1, email: "...", role: "student", ...}
User role: student
Redirecting based on role: student
```

**Backend Logs:**
```
🔐 SSO Token Verification Started
Request data: {'sso_token': 'eyJ0eXAi...'}
SSO token received: eyJ0eXAiOiJKV1QiLCJh...
📤 Decoding SSO token...
✅ Token decoded successfully
SSO data: {'nip': '19970118202506100001', 'iat': 1763450938, 'exp': 1763454538}
🔍 Validating SSO data...
✅ SSO data validation passed
👤 Getting or creating user from SSO data...
✅ User found/created: 1, created=True
User details: email=user@example.com, role=student, nip=19970118202506100001
🔑 Generating JWT tokens for LMS...
✅ JWT tokens generated successfully
🎉 SSO login successful for user: user@example.com
```

### ❌ Common Error Cases

**Case 1: Token Expired**
```
❌ SSO login error: Error: InvalidTokenError
Error response: {"error": "Invalid SSO token: Signature has expired"}
Error status: 401
```

**Case 2: Invalid Token Format**
```
❌ SSO login error: Error: InvalidTokenError
Error response: {"error": "Invalid SSO token: Not enough segments"}
Error status: 401
```

**Case 3: Network Error**
```
❌ SSO login error: Error: Network Error
Error message: "Network error. Please check your connection."
```

**Case 4: CORS Error**
```
Access to XMLHttpRequest at 'http://127.0.0.1:8000/api/v1/sso/verify/' from origin 'http://localhost:5173' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

---

## 🎯 Next Steps After Fix

1. **Test on Localhost** → Use this guide to verify SSO works
2. **Check User Creation** → Verify user created in database with correct NIP
3. **Test Dashboard Access** → Verify redirect to correct dashboard
4. **Test Persistence** → Refresh page, should stay logged in
5. **Test Multiple Logins** → Create multiple SSO users, verify all work
6. **Deploy to Production** → Once localhost works, deploy as documented

---

## 📞 Additional Resources

- **Token Inspector:** https://jwt.io
- **Backend SSO Implementation:** `backend/api/sso_utils.py`
- **Frontend SSO Component:** `frontend/src/views/auth/SSOLogin.jsx`
- **Full SSO Guide:** `SSO_INTEGRATION_GUIDE.md`

---

**Last Updated:** November 18, 2025  
**Version:** 1.0.0 (Localhost Debugging)
