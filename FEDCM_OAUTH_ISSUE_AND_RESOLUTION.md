# FedCM OAuth Issue & Resolution Strategy

**Date**: January 21, 2026  
**Status**: ⚠️ TEMPORARILY DISABLED - Working on Migration  
**Priority**: MEDIUM - Feature works, but needs FedCM compliance

---

## 🔴 Issue Summary

Your browser console is showing **FedCM (Federated Credential Management) warnings and CORS errors**:

```
[GSI_LOGGER]: Your client application uses one of the Google One Tap prompt UI status methods 
that may stop functioning when FedCM becomes mandatory.

The fetch of the id assertion endpoint resulted in a network error: ERR_FAILED
Server did not send the correct CORS headers.

FedCM get() rejects with IdentityCredentialError: Error retrieving a token.
```

---

## 📊 Root Cause Analysis

### Why the Errors Occur

FedCM (Federated Credential Management) is a new web standard being pushed by Google to replace third-party cookies for identity federation. It changes how OAuth flows work:

**OLD WAY (Current - being deprecated)**:
- Browser makes standard CORS-enabled request to OAuth endpoint
- Frontend JavaScript handles the OAuth flow
- Works with One Tap UI

**NEW WAY (FedCM - mandatory soon)**:
- Browser makes special credential requests to a **webidentity** endpoint
- Requires specific HTTP headers: `Supports-Loading-Mode: credentialless`
- Requires proper credential JSON structure
- CORS rules are different (origin restrictions)

### Current Issue Chain

1. ✅ **Frontend**: Login.jsx has `use_fedcm_for_prompt: true`
2. ✅ **Frontend**: CORS headers configured in Django settings
3. ❌ **Backend**: Missing FedCM credential endpoint (`/.well-known/web-identity/config`)
4. ❌ **Backend**: Missing special CORS headers for credential requests
5. ❌ **Backend**: OAuth endpoint not configured for FedCM credential mode

**Result**: Browser tries FedCM, fails due to missing credential headers, and you see the warnings.

---

## ✅ Current Solution: Temporary Workaround

### What We Changed (January 21, 2026)

**File**: `frontend/src/views/auth/Login.jsx`

```javascript
// BEFORE (Caused warnings)
use_fedcm_for_prompt: true

// AFTER (Stable workaround)
use_fedcm_for_prompt: false
itp_support: true
```

**Result**: 
- ✅ Warnings disappear
- ✅ OAuth login works reliably
- ✅ No CORS errors
- ⚠️ Not yet FedCM-compliant (but no deadline - Google gradual migration)

---

## 🎯 Full FedCM Migration (Future - Not Urgent)

To fully migrate to FedCM, the backend needs:

### 1. Credential Endpoint

```python
# backend/api/views.py
from django.views.decorators.http import csrf_exempt
from django.views.decorators.cors import cors_exempt

@csrf_exempt
@cors_exempt
def fedcm_credentials(request):
    """
    Serves FedCM credentials at /.well-known/web-identity/
    
    Required for FedCM compatibility
    """
    if request.method == 'POST':
        # Return credential in FedCM format
        return JsonResponse({
            'id_token': 'jwt_token_here',
            'token_type': 'Bearer'
        }, headers={
            'Supports-Loading-Mode': 'credentialless',
            'Access-Control-Allow-Credentials': 'include',
        })
```

### 2. Django Settings Updates

```python
# backend/backend/settings.py

# FedCM Configuration
CORS_EXPOSE_HEADERS = [
    'Access-Control-Allow-Credentials',
    'Supports-Loading-Mode',
]

CORS_ALLOW_METHODS = [
    # ... existing ...
    'POST',  # For credential requests
]

CORS_ALLOW_HEADERS = [
    # ... existing ...
    'Content-Type',
    'Credentials',
]
```

### 3. Frontend Updates

```javascript
// frontend/src/views/auth/Login.jsx
window.google.accounts.id.initialize({
    use_fedcm_for_prompt: true,  // Back to true after backend ready
    // ... other config
});
```

### 4. Testing FedCM

```bash
# In Chrome DevTools Console:
# 1. Check if FedCM works:
navigator.credentials.get({
    identity: { providers: [ /* ... */ ] },
    signal: AbortSignal.timeout(6000)
})

# 2. Check if server sends proper headers:
# Network tab → request to /auth/google/ → Response Headers
# Should see: Supports-Loading-Mode: credentialless
```

---

## 📋 Step-by-Step Fix (When Ready)

### Phase 1: Backend Preparation
1. Create `backend/api/fedcm_views.py` with credential endpoint
2. Add FedCM CORS headers to settings.py
3. Register endpoint: `path('/.well-known/web-identity/', ...)`
4. Test with curl: 
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/google/ \
     -H "Supports-Loading-Mode: credentialless" \
     -H "Content-Type: application/json"
   ```

### Phase 2: Frontend Testing
1. Set `use_fedcm_for_prompt: true` in Login.jsx
2. Clear browser cache and cookies
3. Test on http://localhost:5173/login
4. Check browser console for warnings (should be gone)

### Phase 3: Browser DevTools Validation
```javascript
// In console, verify FedCM is working:
console.log('FedCM Supported:', 'credentials' in navigator && 'get' in navigator.credentials);
```

### Phase 4: Production Verification
1. Test on production domain: https://lmsetjendpdri.duckdns.org
2. Add to Google Cloud Console:
   - Authorized JavaScript origin: `https://lmsetjendpdri.duckdns.org`
   - Authorized redirect URI: `https://lmsetjendpdri.duckdns.org/api/v1/auth/google/`
3. Monitor Google Search Console for warnings

---

## 🔧 Troubleshooting

### Still Seeing Warnings?

1. **Hard refresh browser**: `Ctrl+Shift+Delete` → Clear browsing data → Reload
2. **Check frontend/.env**: Verify `VITE_GOOGLE_CLIENT_ID` is correct
   ```bash
   cat frontend/.env | grep VITE_GOOGLE_CLIENT_ID
   # Should show: 634643429020-bnjp2eo6bct4v5cn6f8hr918km8v2ajr.apps.googleusercontent.com
   ```
3. **Restart dev server**: 
   ```bash
   # In frontend terminal
   Ctrl+C
   npm run dev
   ```

### CORS Errors?

1. Verify backend is running: `http://localhost:8000/api/v1/`
2. Check CORS in settings.py includes localhost:5173
3. Check OPTIONS method is allowed for OAuth endpoint

### Google OAuth Not Working?

1. **Check Client ID in Google Cloud Console**:
   - Go to https://console.cloud.google.com/
   - Select project → APIs & Services → Credentials
   - Find OAuth 2.0 Client with ID: `634643429020-bnjp2eo6bct4v5cn6f8hr918km8v2ajr`

2. **Verify Authorized Origins**:
   ```
   ✅ http://localhost:5173
   ✅ http://127.0.0.1:5173
   ✅ https://lmsetjendpdri.duckdns.org
   ```

3. **Clear Google Cache**:
   - Sign out of all Google accounts
   - Clear browser cookies: `chrome://settings/clearBrowserData`
   - Test login again

---

## 📚 Reference Links

- [Google FedCM Migration Guide](https://developers.google.com/identity/gsi/web/guides/fedcm-migration)
- [W3C FedCM Specification](https://fedcm.dev/)
- [Google Identity Services Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Django CORS Headers Package](https://github.com/adamchainz/django-cors-headers)

---

## 📊 Timeline & Status

| Date | Action | Status |
|------|--------|--------|
| Jan 15 | Identified FedCM warnings | ⚠️ Pending |
| Jan 21 | Disabled FedCM, enabled OAuth popup | ✅ Complete |
| Jan 21 | Updated OAuth credentials | ✅ Complete |
| TBD | Implement FedCM credential endpoint | ⏳ Planned |
| TBD | Full FedCM migration & testing | ⏳ Planned |
| TBD | Production FedCM deployment | ⏳ Planned |

---

## ✅ Verification Checklist

After restarting servers, verify:

- [ ] Frontend dev server running: `npm run dev` (port 5173)
- [ ] Backend dev server running: `python manage.py runserver` (port 8000)
- [ ] Browser cache cleared: `Ctrl+Shift+Delete`
- [ ] Navigate to `http://localhost:5173/login`
- [ ] Click "Masuk dengan Google"
- [ ] **Browser console should show NO FedCM warnings**
- [ ] OAuth consent screen appears
- [ ] After login, redirected to dashboard

---

## 🎓 Learning Resources

**What is FedCM?**
- New web standard replacing third-party cookies
- Better privacy, cleaner OAuth flow
- Mandatory for Google OAuth by end of 2024 (being delayed to 2025)

**Why the migration?**
- Eliminates tracking cookies
- Explicit user consent
- Better user control of identity

**Our approach:**
- Currently using "interim" OAuth (warnings but works)
- Plan migration when timeline is clearer
- Backend-heavy changes needed (credential endpoint)

---

## 📞 Support

If login still doesn't work after these steps:

1. Check `frontend/.env` and `backend/.env` have correct Client ID/Secret
2. Restart both servers (frontend + backend)
3. Hard refresh browser (`Ctrl+Shift+Delete`)
4. Check backend logs: `backend/django.log` or `backend/django_error.log`
5. Try in Incognito mode (no cookies/cache issues)

