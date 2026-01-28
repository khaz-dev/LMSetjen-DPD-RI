# Google OAuth Setup - Quick Reference (5 Minute Guide)

## What Was Done (✅ Already Implemented)

### Backend Changes
- ✅ Added `GoogleOAuthVerifier` class in `backend/api/sso_utils.py` (token verification)
- ✅ Added `GoogleOAuthUserManager` class in `backend/api/sso_utils.py` (user management)
- ✅ Created `GoogleOAuthAPIView` in `backend/api/views.py` (API endpoint)
- ✅ Added `/api/v1/auth/google/` route in `backend/api/urls.py`
- ✅ Added Google config to `backend/backend/settings.py`
- ✅ Created `backend/.env.example` with all variables

### Frontend Changes
- ✅ Complete rewrite of `frontend/src/views/auth/Login.jsx` with OAuth flow
- ✅ Added Google Sign-In script to `frontend/index.html`
- ✅ Created `frontend/.env` with VITE_GOOGLE_CLIENT_ID
- ✅ Created `frontend/.env.example` with all variables

### Documentation
- ✅ Created `GOOGLE_OAUTH_INTEGRATION_GUIDE.md` (comprehensive 300+ line guide)
- ✅ Created this quick reference file

---

## What YOU Need To Do (4 Steps)

### Step 1: Get Google Credentials (5 minutes)

1. Go to https://console.cloud.google.com/
2. Create new project named "LMSetjen DPD RI"
3. Search for and enable "Google+ API"
4. Go to Credentials → Create OAuth 2.0 Web Client
5. Add these Redirect URIs:
   - http://localhost:5173
   - http://localhost:5173/login
   - http://localhost:8000/api/v1/auth/google/
6. Copy **Client ID** and **Client Secret**

### Step 2: Update Backend .env (1 minute)

Edit `backend/.env`:
```
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5173/login
```

### Step 3: Update Frontend .env (1 minute)

Edit `frontend/.env`:
```
VITE_GOOGLE_CLIENT_ID=your-client-id-here
VITE_API_URL=http://localhost:8000
```

### Step 4: Test (2 minutes)

```bash
# Terminal 1: Frontend (from project root)
cd frontend
npm run dev
# Goes to http://localhost:5173

# Terminal 2: Backend (from project root)
cd backend
venv\Scripts\activate  # Windows
python manage.py runserver
# Goes to http://localhost:8000

# Then:
# 1. Open http://localhost:5173/login
# 2. Click "Masuk dengan Google"
# 3. Select Google account
# 4. You should be logged in!
```

---

## API Reference

### Backend Endpoint

```
POST /api/v1/auth/google/
```

**Request (using ID token):**
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ...",
  "token_type": "id_token"
}
```

**Request (using access token):**
```json
{
  "access_token": "ya29.a0AfH6SMBx...",
  "token_type": "access_token"
}
```

**Response (Success):**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "email": "user@gmail.com",
    "full_name": "John Doe",
    "role": "student",
    "is_active": true
  },
  "created": true,
  "message": "Google OAuth login successful"
}
```

**Response (Error):**
```json
{
  "error": "Invalid Google token: Token has expired"
}
```

---

## File Locations

| File | Change |
|------|--------|
| `backend/api/sso_utils.py` | Added GoogleOAuthVerifier + GoogleOAuthUserManager (~150 lines) |
| `backend/api/views.py` | Added GoogleOAuthAPIView (~100 lines) |
| `backend/api/urls.py` | Added auth/google/ route |
| `backend/backend/settings.py` | Added GOOGLE_CLIENT_ID config |
| `backend/.env` | Added Google OAuth variables |
| `frontend/index.html` | Added Google Sign-In script |
| `frontend/src/views/auth/Login.jsx` | Complete OAuth implementation (~250 lines) |
| `frontend/.env` | Added VITE_GOOGLE_CLIENT_ID |
| `GOOGLE_OAUTH_INTEGRATION_GUIDE.md` | Full documentation |

---

## Troubleshooting

### Issue: "Google client ID is required"
- Check `.env` has VITE_GOOGLE_CLIENT_ID
- Make sure it's your actual Client ID from Google Console
- Make sure NO extra spaces or quotes

### Issue: "Token verification failed"
- Check backend `.env` has GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
- Verify these match your Google Console exactly
- Check backend logs: `python manage.py runserver` output

### Issue: "Redirect URI mismatch"
- Add `http://localhost:5173/login` to Google Console OAuth settings
- Also add `http://localhost:8000/api/v1/auth/google/`

### Issue: "Failed to initiate Google login"
- Make sure `https://accounts.google.com/gsi/client` is accessible
- Check browser console for network errors
- Try disabling browser extensions

### Issue: "User not created in database"
- Check backend logs for detailed error
- Verify PostgreSQL is running
- Check database migrations: `python manage.py migrate`

---

## Deployment Notes

### For Production (https://lmsetjendpdri.duckdns.org)

1. Add to Google Console OAuth settings:
   - https://lmsetjendpdri.duckdns.org/login
   - https://lmsetjendpdri.duckdns.org/api/v1/auth/google/

2. Update backend `.env`:
   ```
   DEBUG=False
   FRONTEND_SITE_URL=https://lmsetjendpdri.duckdns.org
   BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org
   GOOGLE_OAUTH_REDIRECT_URI=https://lmsetjendpdri.duckdns.org/login
   ```

3. Update frontend `.env`:
   ```
   VITE_API_URL=https://lmsetjendpdri.duckdns.org
   ```

---

## Security Notes

⚠️ **CRITICAL:**
- `.env` files contain secrets - NEVER commit them to git
- Already in `.gitignore`, but verify before pushing
- `GOOGLE_CLIENT_SECRET` - keep it private, backend-only
- Rotate credentials periodically

---

## For More Details

See the full guide: [GOOGLE_OAUTH_INTEGRATION_GUIDE.md](./GOOGLE_OAUTH_INTEGRATION_GUIDE.md)

---

**Status**: ✅ Complete - Ready for configuration with Google credentials  
**Time to Setup**: ~10 minutes (most of which is getting Google credentials)  
**Estimated Testing Time**: ~5 minutes
