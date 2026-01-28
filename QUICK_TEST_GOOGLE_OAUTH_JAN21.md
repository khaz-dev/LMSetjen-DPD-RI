# 🚀 Quick Test: Google OAuth Login - January 21, 2026

**Status**: ✅ OAuth Login Ready to Test  
**Last Updated**: January 21, 2026  
**Changes Made**: 
- ✅ Updated Client ID and Secret in .env files
- ✅ Disabled FedCM (using standard OAuth popup)
- ✅ Improved error handling

---

## 🎯 Test Steps

### Step 1: Restart Servers

**Terminal 1 - Backend**:
```bash
cd backend
# If Python env isn't active:
# venv\Scripts\activate  (Windows)
# source venv/bin/activate  (Mac/Linux)

python manage.py runserver
# Expected output: Starting development server at http://127.0.0.1:8000/
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
# Expected output: Local: http://localhost:5173/
```

### Step 2: Clear Browser Cache

In your browser:
- Press: `Ctrl+Shift+Delete` (or `Cmd+Shift+Delete` on Mac)
- Check: "Cookies and other site data"
- Check: "Cached images and files"
- Click: "Clear data"

### Step 3: Navigate to Login

```
http://localhost:5173/login
```

### Step 4: Test Google Login

1. Click button: **"Masuk dengan Google"**
2. Expected flow:
   - Google OAuth popup appears
   - Select your Google account
   - Accept permissions
   - Return to application dashboard
3. Verify:
   - ✅ **NO FedCM warnings in console**
   - ✅ **NO CORS errors**
   - ✅ Successfully logged in
   - ✅ Redirected to correct dashboard (admin/teacher/student)

### Step 5: Check Console (F12)

Open Developer Tools → Console tab:

**Look for**:
```
✅ Google Sign-In initialized successfully
🔍 Google login button clicked - opening OAuth popup...
📱 Opening Google Sign-In popup with client ID: 634643429020-bnjp2...
✅ Google credential received, token length: 1234
📤 Sending token to backend at /auth/google/
✅ Backend authentication successful
📊 User data received: { email: "user@example.com", ... }
```

**Should NOT see**:
```
❌ [GSI_LOGGER]: Your client application uses one of the Google One Tap...
❌ The fetch of the id assertion endpoint resulted in a network error
❌ Server did not send the correct CORS headers
```

---

## 🐛 Troubleshooting

### Issue: OAuth Button Not Working

**Solution 1**: Check browser console for errors
- F12 → Console tab
- Look for red error messages
- Screenshot error and check FEDCM_OAUTH_ISSUE_AND_RESOLUTION.md

**Solution 2**: Verify Client ID
```bash
# Terminal - check frontend .env
cat frontend/.env | grep VITE_GOOGLE_CLIENT_ID

# Should show:
# VITE_GOOGLE_CLIENT_ID=634643429020-bnjp2eo6bct4v5cn6f8hr918km8v2ajr.apps.googleusercontent.com
```

**Solution 3**: Verify backend .env
```bash
# Terminal - check backend .env
cat backend/.env | grep GOOGLE_CLIENT_ID

# Should show:
# GOOGLE_CLIENT_ID=634643429020-bnjp2eo6bct4v5cn6f8hr918km8v2ajr.apps.googleusercontent.com
```

### Issue: "Login Failed - No credentials received"

**Solution**:
1. Hard refresh: `Ctrl+Shift+F5`
2. Clear cookies: `Ctrl+Shift+Delete`
3. Try in Incognito mode: `Ctrl+Shift+N`
4. Check if Google API script loaded: F12 → Network tab → search for "accounts"

### Issue: CORS Error in Console

**Solution**:
1. Backend must be running: `python manage.py runserver`
2. Verify backend CORS includes localhost:5173:
   ```bash
   grep -n "CORS_ALLOWED_ORIGINS" backend/backend/settings.py
   # Should include "http://localhost:5173"
   ```

### Issue: Wrong User Profile After Login

**Solution**:
1. Sign out completely
2. Clear browser cache: `Ctrl+Shift+Delete`
3. Make sure you're testing with the CORRECT Google account
4. Check that account exists in LMS backend database

---

## 📊 Test Results Template

| Test Item | Expected | Result | Notes |
|-----------|----------|--------|-------|
| Frontend dev server | Running on 5173 | ✅ / ❌ | |
| Backend dev server | Running on 8000 | ✅ / ❌ | |
| Browser cache cleared | Yes | ✅ / ❌ | |
| Google button visible | Yes | ✅ / ❌ | |
| OAuth popup opens | Yes | ✅ / ❌ | |
| Can select Google account | Yes | ✅ / ❌ | |
| Permissions dialog appears | Yes | ✅ / ❌ | |
| Successfully logs in | Yes | ✅ / ❌ | |
| No FedCM warnings | True | ✅ / ❌ | |
| No CORS errors | True | ✅ / ❌ | |
| Correct dashboard shown | Yes | ✅ / ❌ | |

---

## 🔍 Advanced Debugging

### Check API Response

In browser console:
```javascript
// This will help debug the backend response
// Open DevTools → Network tab
// Click "Masuk dengan Google"
// Find POST request to /api/v1/auth/google/
// Click it, go to "Response" tab
// Should show: { access: "...", refresh: "...", user: {...} }
```

### Check Backend Logs

```bash
# In backend terminal, look for auth logs:
# Should show messages like:
# "🔐 Google OAuth Verification Started"
# "✅ Google token verified successfully"
# "👤 User authenticated: user@example.com"
```

### Test Backend Directly

```bash
# Get your Google ID token first (from browser console after clicking button)
# Then test backend endpoint directly:

curl -X POST http://localhost:8000/api/v1/auth/google/ \
  -H "Content-Type: application/json" \
  -d '{"token": "PASTE_YOUR_ID_TOKEN_HERE", "token_type": "id_token"}'

# Expected response:
# {"access": "jwt_token...", "refresh": "jwt_token...", "user": {...}}
```

---

## ✅ Success Criteria

Test is ✅ **PASS** when:

1. ✅ Google OAuth button exists and is clickable
2. ✅ Google login popup opens when clicked
3. ✅ Can select a Google account and approve permissions
4. ✅ Successfully logs in without errors
5. ✅ Redirected to correct dashboard (admin/student/teacher)
6. ✅ Browser console shows NO warnings or CORS errors
7. ✅ Can perform basic actions (view courses, etc.)
8. ✅ Logout works properly
9. ✅ Login after logout works again

---

## 📝 Documentation References

For more details, see:
- [FEDCM_OAUTH_ISSUE_AND_RESOLUTION.md](FEDCM_OAUTH_ISSUE_AND_RESOLUTION.md) - Full technical breakdown
- [frontend/.env](frontend/.env) - Frontend configuration
- [backend/.env](backend/.env) - Backend configuration
- [frontend/src/views/auth/Login.jsx](frontend/src/views/auth/Login.jsx) - Login component code

---

## 🎓 Next Steps

After testing:

1. **If successful**: Create test account checklist for different roles (admin, teacher, student)
2. **If failed**: Check troubleshooting section or detailed FEDCM guide
3. **Production readiness**: Plan deployment after full testing

---

**Last Updated**: January 21, 2026 at 10:30 AM  
**Next Review**: After successful testing  

