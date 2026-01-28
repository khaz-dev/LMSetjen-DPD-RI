# Google OAuth End-to-End Testing Guide

## Quick Test Checklist

Before testing, run the diagnostic script:
```bash
# On Windows PowerShell
.\check-google-oauth.ps1

# On Mac/Linux bash
bash check-google-oauth.sh
```

---

## Step 1: Verify Basic Setup

### 1.1 Frontend Environment Variables
```bash
cd frontend
cat .env
```

Expected output:
```dotenv
VITE_GOOGLE_CLIENT_ID=634643429020-fqsklueemda8b84085nhmracbkamtrip.apps.googleusercontent.com
VITE_API_URL=http://localhost:8000
```

### 1.2 Backend Environment Variables
```bash
cd backend
cat .env
```

Expected to contain:
```dotenv
GOOGLE_CLIENT_ID=634643429020-fqsklueemda8b84085nhmracbkamtrip.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

---

## Step 2: Start Development Servers

### 2.1 Start Backend
```bash
cd backend
python manage.py runserver
```

Expected output:
```
Starting development server at http://127.0.0.1:8000/
```

### 2.2 Start Frontend (NEW TERMINAL)
```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v4.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

---

## Step 3: Test CORS Configuration

### 3.1 Browser Console Test
1. Open http://localhost:5173/login in browser
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. You should see:
   - ✅ No CORS errors
   - ✅ No import errors
   - ✅ Google Sign-In script loading messages (may not be visible, but check for errors)

### 3.2 Network Tab Test
1. In Developer Tools, go to **Network** tab
2. Filter to `localhost:8000` or `Auth`
3. Click **"Masuk dengan Google"** button
4. Look for request to `/api/v1/auth/google/`
5. Check **Request Headers** should show:
   ```
   Origin: http://localhost:5173
   Content-Type: application/json
   ```
6. Check **Response Headers** should show:
   ```
   Access-Control-Allow-Origin: http://localhost:5173
   Access-Control-Allow-Credentials: true
   ```

### 3.3 CORS Preflight Test (curl/PowerShell)
```bash
# Test OPTIONS request (CORS preflight)
curl -X OPTIONS http://localhost:8000/api/v1/auth/google/ \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -v
```

Expected response headers:
```
< HTTP/1.1 200 OK
< Access-Control-Allow-Origin: http://localhost:5173
< Access-Control-Allow-Methods: POST, OPTIONS
< Access-Control-Allow-Headers: ...
```

---

## Step 4: Test Google Sign-In Flow

### 4.1 Click Login Button
1. Go to http://localhost:5173/login
2. Look for **"Masuk dengan Google"** button
3. Button should be clickable (not grayed out)

### 4.2 Check Console Logs
After clicking button, watch the browser console (F12 → Console):

**Expected logs (in order):**
```
✅ 🔍 DEBUG: Google Login initiated
✅ 🔍 DEBUG: Client ID: 634643429020-fqsklueemda8b84085nhmracbkamtrip.apps.googleusercontent.com
✅ 🔍 DEBUG: window.google available: true
✅ 🔍 DEBUG: window.google.accounts available: true
✅ ✅ Google API is available, initializing...
✅ ✅ Google initialized successfully
```

**If you see errors instead:**
- ❌ `Google Sign-In API not loaded` → Check if Google script is in index.html
- ❌ `Client ID not configured` → Check frontend/.env for VITE_GOOGLE_CLIENT_ID
- ❌ `Network errors` → Check browser console for details

### 4.3 Complete Google Sign-In
1. A Google popup/prompt should appear
2. Select your Google account
3. Browser console should show:
   ```
   ✅ 📨 handleGoogleResponse called with response: {...}
   ✅ ✅ Google credential received, token length: 2847
   ✅ 📤 Sending token to backend at /auth/google/
   ```

### 4.4 Check Backend Response
In **Network tab** → find POST request to `/api/v1/auth/google/`:

**Expected Response (200 OK):**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5...",
  "user": {
    "id": 1,
    "email": "yourname@gmail.com",
    "full_name": "Your Name",
    "role": "student"
  },
  "created": true,
  "message": "Google OAuth login successful"
}
```

---

## Step 5: Check Backend Logs

While testing, monitor backend terminal (where `python manage.py runserver` is running):

**Expected sequence:**
```
🔐 Google OAuth Verification Started
📤 Verifying Google token...
✅ Google token verified successfully
📊 Extracting user data from Google token...
👤 Getting or creating user from Google data...
✅ User found/created: {user_id}, created=True
🔑 Generating JWT tokens for LMS...
✅ JWT tokens generated successfully
🎉 Google OAuth login successful for user: yourname@gmail.com
```

**If you see errors:**
- ❌ `Invalid Google token` → Client ID mismatch or token expired
- ❌ `Invalid client ID in token` → Check GOOGLE_CLIENT_ID in backend/.env
- ❌ `User creation failed` → Check database/user model

---

## Step 6: Verify User Created in Database

### 6.1 Django Admin Check
```bash
cd backend
python manage.py shell
```

```python
from userauths.models import User

# List all users
User.objects.all().values('id', 'email', 'full_name', 'role')

# Check specific user
user = User.objects.get(email='yourname@gmail.com')
print(f"User: {user.email}, Role: {user.role}, Created: {user.date_joined}")
```

**Expected:**
- User exists with email from Google account
- role = 'student' (default for new users)
- Profile created with Google data

### 6.2 Database Query
```bash
# If using PostgreSQL
psql -U lms_user -d django_lms_db -c "SELECT id, email, full_name, role FROM userauths_user ORDER BY date_joined DESC LIMIT 5;"
```

---

## Step 7: Verify Token Storage

### 7.1 Check Browser Storage
1. In Developer Tools, go to **Application** tab
2. Check **Cookies** → Look for:
   - `access_token` → Should contain JWT token (starts with `eyJh...`)
   - `refresh_token` → Should contain JWT refresh token
3. Check **localStorage** → Look for auth-related data

### 7.2 Check Token Validity (Optional)
```bash
# Decode JWT token (use JWT.io or online decoder)
# Take the access_token from console logs and decode it to verify:
# - exp: expiration time
# - aud: audience (should match your app)
# - user_id: ID of logged-in user
```

---

## Step 8: Verify Dashboard Redirect

### 8.1 After Successful Login
1. Should redirect to dashboard based on user role
2. See success toast: "Login Berhasil! Selamat datang, [Your Name]!"
3. Dashboard should load with user data

### 8.2 Verify User Info is Available
Check that the dashboard shows your:
- Name
- Email
- Role
- Profile info

---

## Common Issues & Quick Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Client ID not configured" | VITE_GOOGLE_CLIENT_ID missing | Add to frontend/.env and restart npm |
| "Google API not loaded" | Script not in index.html | Check frontend/index.html has Google script |
| CORS 403 error | Backend CORS_ALLOWED_ORIGINS missing localhost:5173 | Add to backend/settings.py |
| "Invalid client ID" | GOOGLE_CLIENT_ID in backend/.env wrong | Verify matches Google Cloud credentials |
| "Network error" | Backend not running | Start backend: `python manage.py runserver` |
| "No credentials received" | Google popup blocked or dismissed | Check browser permissions, try again |

---

## Production Considerations

### When Moving to Production:

1. **Update Google Cloud Console:**
   - Add production domain to Authorized JavaScript Origins
   - Add production redirect URIs

2. **Update Environment Variables:**
   - `VITE_GOOGLE_CLIENT_ID` → Use production client ID
   - `GOOGLE_CLIENT_ID` → Use production client ID
   - `VITE_API_URL` → Use production backend URL

3. **Update CORS Configuration:**
   ```python
   CORS_ALLOWED_ORIGINS = [
       "https://yourdomain.com",
       "https://api.yourdomain.com",
       # ... production origins
   ]
   ```

4. **Enable HTTPS:**
   - Google OAuth requires HTTPS for production
   - Configure SSL certificates in nginx

---

## Troubleshooting Checklist

```
☐ Browser console shows no errors
☐ Network tab shows 200 OK for /api/v1/auth/google/
☐ Response headers include Access-Control-Allow-Origin
☐ Backend logs show successful verification
☐ User created in database
☐ JWT tokens stored in cookies/localStorage
☐ Redirected to dashboard after login
☐ Dashboard shows user info correctly
☐ Logout works and clears tokens
```

---

## Next Steps After Successful Test

1. **Implement Nusa DPD SSO** - Follow similar pattern
2. **Add Role-Based Redirects** - Redirect by user.role
3. **Test Multiple Users** - Sign out, sign in with different Google account
4. **User Profile Management** - Update profile after OAuth login
5. **Deployment** - Follow production deployment guide

---

## Support Resources

- **Google OAuth Docs**: https://developers.google.com/identity/protocols/oauth2
- **Django CORS**: https://github.com/adamchainz/django-cors-headers
- **DRF Auth**: https://www.django-rest-framework.org/api-guide/authentication/
- **Project Docs**: See GOOGLE_OAUTH_CORS_TROUBLESHOOTING_GUIDE.md

---

**Last Updated**: December 2024
**Status**: Ready for Testing ✅
