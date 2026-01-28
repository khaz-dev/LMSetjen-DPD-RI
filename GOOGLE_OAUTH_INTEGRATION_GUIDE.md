# Google OAuth Integration Guide - LMSetjen DPD RI

Complete guide to implement and configure Google OAuth 2.0 for the LMS system.

## Overview

This guide covers:
1. Creating a Google Cloud Console project
2. Obtaining OAuth credentials (Client ID & Secret)
3. Configuring backend with Google OAuth
4. Configuring frontend with Google Sign-In
5. Testing the integration

---

## Part 1: Google Cloud Console Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. If you don't have an account, create one
3. Click on the project dropdown at the top
4. Click "NEW PROJECT"
5. Fill in:
   - **Project name**: `LMSetjen DPD RI` (or your preference)
   - **Organization**: Leave blank or select if you have one
6. Click "CREATE"
7. Wait for the project to be created (takes ~2-3 minutes)

### Step 2: Enable OAuth 2.0 API

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for **"Google+ API"** or **"Identity"**
3. Click on "Google+ API"
4. Click **ENABLE**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type (for external users)
3. Click **CREATE**
4. Fill in the consent screen:
   - **App name**: `LMSetjen DPD RI`
   - **User support email**: Your email address
   - **App logo**: (Optional) Upload the logo from `frontend/src/assets/logo/logo-192.png`
   - **Authorized domains**: Leave empty for now (development)
5. In **Scopes** section, add these scopes:
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
6. In **Test users**, add your test email addresses
7. Click **SAVE AND CONTINUE**

### Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **CREATE CREDENTIALS** → **OAuth client ID**
3. For **Application type**, select **Web application**
4. Add a name: `LMSetjen DPD RI Web Client`
5. Under **Authorized redirect URIs**, add these:
   ```
   http://localhost:5173
   http://localhost:5173/login
   http://localhost:5173/sso/callback
   http://localhost:8000/api/v1/auth/google/callback/
   http://localhost:8000/api/v1/auth/google/
   ```
   
   For production, also add:
   ```
   https://lmsetjendpdri.duckdns.org
   https://lmsetjendpdri.duckdns.org/login
   https://your-production-domain.com/login
   ```

6. Click **CREATE**
7. A dialog will appear with:
   - **Client ID**: Copy this
   - **Client Secret**: Copy this

   ⚠️ **IMPORTANT**: Save these securely. The Client Secret should NEVER be committed to git.

---

## Part 2: Backend Configuration

### Step 1: Set Environment Variables

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your Google OAuth credentials:
   ```
   GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5173/login
   ```

### Step 2: Backend is Already Configured

The backend has been automatically updated with:

✅ **New files/changes:**
- `backend/api/sso_utils.py` - Added `GoogleOAuthVerifier` and `GoogleOAuthUserManager` classes
- `backend/api/views.py` - Added `GoogleOAuthAPIView` endpoint
- `backend/api/urls.py` - Added `/api/v1/auth/google/` route
- `backend/backend/settings.py` - Added Google OAuth configuration

✅ **New API Endpoint:**
```
POST /api/v1/auth/google/
```

Request format:
```json
{
  "token": "google_id_token_here",
  "token_type": "id_token"
}
```

OR

```json
{
  "access_token": "google_access_token_here",
  "token_type": "access_token"
}
```

Response format:
```json
{
  "access": "lms_jwt_access_token",
  "refresh": "lms_jwt_refresh_token",
  "user": {
    "id": 1,
    "email": "user@gmail.com",
    "full_name": "User Name",
    "role": "student",
    "is_active": true
  },
  "created": true,
  "message": "Google OAuth login successful"
}
```

---

## Part 3: Frontend Configuration

### Step 1: Set Environment Variables

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your Google Client ID:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   ```

### Step 2: Frontend is Already Configured

The frontend has been automatically updated with:

✅ **New files/changes:**
- `frontend/index.html` - Added Google Sign-In script
- `frontend/src/views/auth/Login.jsx` - Complete OAuth integration

✅ **New Login Features:**
- Google Sign-In button with official branding
- Automatic token verification with backend
- Error handling and loading states
- User automatic redirect based on role

---

## Part 4: Testing the Integration

### Prerequisite: Start Services

Make sure these are running:

```bash
# Terminal 1: Frontend
cd frontend
npm run dev
# Frontend will be at: http://localhost:5173

# Terminal 2: Backend
cd backend
venv\Scripts\activate  # Windows
python manage.py runserver
# Backend will be at: http://localhost:8000

# Terminal 3: Docker services (in project root)
docker-compose up
# PostgreSQL on 5432, Redis on 6379
```

### Test Steps

1. **Visit Login Page**
   - Open: http://localhost:5173/login
   - You should see two buttons:
     - "Masuk dengan Google" (Google button)
     - "Login dengan Nusa DPD" (Nusa DPD button)

2. **Test Google Login**
   - Click "Masuk dengan Google"
   - Select your Google account (or sign in if needed)
   - Grant permissions if prompted
   - You should be redirected to dashboard

3. **Check Backend Logs**
   ```
   [*] Google OAuth Verification Started
   [✓] Google token verified successfully
   [✓] User found/created: {user_id}
   [✓] JWT tokens generated successfully
   [✓] Google OAuth login successful for user: {email}
   ```

4. **Check Frontend Console**
   - Open DevTools (F12)
   - Check Console tab for any errors
   - Verify localStorage has JWT tokens:
     ```javascript
     localStorage.getItem('access_token')
     localStorage.getItem('refresh_token')
     ```

---

## Part 5: Production Deployment

### Backend Production Setup

1. Update `.env` with production values:
   ```
   DEBUG=False
   ALLOWED_HOSTS=lmsetjendpdri.duckdns.org
   FRONTEND_SITE_URL=https://lmsetjendpdri.duckdns.org
   BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org
   GOOGLE_OAUTH_REDIRECT_URI=https://lmsetjendpdri.duckdns.org/login
   ```

2. Add production redirect URI in Google Cloud Console:
   ```
   https://lmsetjendpdri.duckdns.org/login
   ```

### Frontend Production Setup

1. Update `.env` with production values:
   ```
   VITE_API_URL=https://lmsetjendpdri.duckdns.org/api/v1
   ```

2. Build for production:
   ```bash
   npm run build
   npm run preview  # Test the build
   ```

---

## Troubleshooting

### Issue: "Google Sign-In script not loaded"
**Solution**: Make sure `https://accounts.google.com/gsi/client` is accessible
- Check internet connection
- Check if Google's CDN is accessible in your region
- Check browser console for CORS errors

### Issue: "Invalid Client ID"
**Solution**:
- Verify VITE_GOOGLE_CLIENT_ID matches your Google Cloud credentials exactly
- Check for extra spaces or wrong client ID
- Regenerate credentials if unsure

### Issue: "Token verification failed"
**Solution**:
- Check backend logs for detailed error
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in backend `.env`
- Check token type matches what backend expects
- Verify Google API is enabled in Cloud Console

### Issue: "Redirect URI mismatch"
**Solution**:
- Add ALL URIs you're using to Google Cloud Console
- Include both http and https versions
- Include all domain variations (with/without www)
- For development, include localhost and 127.0.0.1

### Issue: "User not created, showing error in backend"
**Solution**:
- Check backend logs for detailed error message
- Verify User model has required fields
- Check database connection is working
- Verify Profile model exists

---

## Code Architecture

### Backend Flow

```
Login Form
    ↓
Frontend sends Google token
    ↓
GoogleOAuthAPIView receives token
    ↓
GoogleOAuthVerifier.verify_token()
    ↓
Verify with Google API (verify_token or verify_id_token)
    ↓
Extract user data (email, name, picture, google_id)
    ↓
GoogleOAuthUserManager.get_or_create_user_from_google()
    ↓
Create/Update User & Profile in database
    ↓
Generate JWT tokens (access + refresh)
    ↓
Return tokens to frontend
    ↓
Frontend stores tokens + redirects to dashboard
```

### Frontend Flow

```
Click Google Login Button
    ↓
Google Sign-In library initializes
    ↓
User selects Google account
    ↓
Google returns ID token / access token
    ↓
handleGoogleResponse() function triggers
    ↓
Send token to backend /api/v1/auth/google/
    ↓
Backend verifies and returns JWT tokens
    ↓
setAuthToken() stores tokens in localStorage
    ↓
redirectUserByRole() sends user to appropriate dashboard
```

---

## File Locations

### Backend Modified Files
- `backend/api/sso_utils.py` - Added GoogleOAuthVerifier & GoogleOAuthUserManager classes (~120 lines)
- `backend/api/views.py` - Added GoogleOAuthAPIView (~80 lines)
- `backend/api/urls.py` - Added /api/v1/auth/google/ route
- `backend/backend/settings.py` - Added GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET config
- `backend/.env.example` - Created with all required variables

### Frontend Modified Files
- `frontend/src/views/auth/Login.jsx` - Complete rewrite with OAuth integration (~200 lines)
- `frontend/index.html` - Added Google Sign-In script
- `frontend/.env.example` - Created with VITE_GOOGLE_CLIENT_ID

### New Created Files
- `backend/.env.example` - Backend environment template
- `frontend/.env.example` - Frontend environment template
- `GOOGLE_OAUTH_INTEGRATION_GUIDE.md` - This file

---

## Security Considerations

1. **Never commit `.env` files** - They contain secrets
   ```
   # Already in .gitignore
   .env
   .env.local
   .env.production
   ```

2. **Client Secret is backend-only** - Never expose to frontend
   - Frontend uses Client ID only
   - Backend verifies token with Client Secret

3. **Use HTTPS in production** - Google requires secure connections
   - OAuth will fail on HTTP in production
   - Update all URIs to https:// in Google Cloud Console

4. **Rotate credentials regularly** - Best practice security
   - Delete old credentials
   - Create new ones
   - Update .env files

---

## Next Steps

1. Get Google Cloud credentials (see Part 1)
2. Update backend `.env` with Google credentials
3. Update frontend `.env` with Google Client ID
4. Test in development (see Part 4)
5. Deploy to production with proper configuration
6. Monitor logs for any issues

---

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Sign-In for Web](https://developers.google.com/identity/sign-in/web)
- [Django Social Auth](https://python-social-auth.readthedocs.io/)
- [Project Architecture](./PROJECT_ARCHITECTURE.md)
- [Backend Setup Guide](./QUICK_START.md)

---

**Last Updated**: January 21, 2026  
**Status**: ✅ Implementation Complete (Phase 4.16)
