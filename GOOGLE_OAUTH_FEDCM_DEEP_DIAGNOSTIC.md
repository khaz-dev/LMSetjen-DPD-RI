# Google OAuth FedCM Configuration - Deep Diagnostic

## Current Error Analysis

**Error Message**: "Can't continue with google.com Something went wrong"  
**Underlying Issue**: FedCM get() rejects with IdentityCredentialError: Error retrieving a token

This indicates that Google's Federated Credential Management (FedCM) system is unable to complete authentication.

---

## Root Cause: Google Cloud Console OAuth Consent Screen

The most likely culprit is that the **OAuth Consent Screen is not properly configured** in Google Cloud Console. FedCM requires explicit configuration.

### REQUIRED: Configure OAuth Consent Screen

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select Project**: "LMSetjen DPD RI"
3. **Navigate to**: APIs & Services → OAuth consent screen
4. **Configure the following:**

#### User Type (CRITICAL)
- Select: **External** (for development/testing)
- Click "CREATE"

#### App Information
- **App name**: LMSetjen DPD RI
- **User support email**: your-email@gmail.com (use a real Gmail account)
- **Developer contact**: your-email@gmail.com

#### Scopes (leave as default for now)
- Click "SAVE AND CONTINUE"

#### Test Users (CRITICAL FOR FedCM)
1. Click "ADD USERS"
2. Add your Google account email (the one you're trying to login with)
3. This is REQUIRED for FedCM to work in development

---

## Step-by-Step Fix

### Step 1: Verify OAuth Consent Screen Configuration
```
[ ] Project selected: LMSetjen DPD RI
[ ] User type: External
[ ] App name: LMSetjen DPD RI
[ ] Support email: Configured
[ ] Developer contact: Configured
[ ] Test users: At least one Google account added
```

### Step 2: Verify OAuth Credentials
Go to: APIs & Services → Credentials
- [ ] Web application OAuth 2.0 credentials exist
- [ ] Client ID: 634643429020-fqsklueemda8b84085nhmracbkamtrip.apps.googleusercontent.com
- [ ] Click the pencil icon to edit

### Step 3: Verify Authorized Redirect URIs
In the OAuth credentials, check **Authorized redirect URIs** includes:
```
http://localhost:5173
http://localhost:5173/login
http://localhost:8000
http://localhost:8000/api/v1/auth/google/
```

If missing, add them:
1. Click pencil icon on credentials
2. Add under "Authorized redirect URIs"
3. Click SAVE

### Step 4: Verify Authorized JavaScript Origins
In the same credentials, check **Authorized JavaScript origins** includes:
```
http://localhost:5173
http://localhost:8000
http://127.0.0.1:5173
http://127.0.0.1:8000
```

---

## FedCM Configuration on Backend (Optional but Recommended)

If Google Cloud Console is configured correctly but still failing, we may need to add FedCM support to the backend. This involves serving a `.well-known/web-identity` file.

### Add FedCM Configuration to Django

1. **Create file**: `backend/api/views.py` → Add new view:

```python
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

@require_http_methods(["GET"])
def fedcm_web_identity_config(request):
    """
    FedCM Web Identity Configuration
    Serves the web-identity endpoint for Federated Credential Management
    """
    return JsonResponse({
        "provider_urls": [
            f"{settings.BACKEND_SITE_URL}/.well-known/web-identity"
        ]
    })

@require_http_methods(["GET"])
def fedcm_web_identity(request):
    """
    FedCM Web Identity Provider Configuration
    """
    return JsonResponse({
        "accounts_endpoint": f"{settings.BACKEND_SITE_URL}/api/v1/auth/google/accounts",
        "assertion_endpoint": f"{settings.BACKEND_SITE_URL}/api/v1/auth/google/assertion",
        "branding": {
            "logo_url": f"{settings.BACKEND_SITE_URL}/static/logo.png",
            "background_color": "rgb(255, 255, 255)"
        }
    })
```

2. **Add URLs**: `backend/api/urls.py`:

```python
path('fedcm/config.json', views.fedcm_web_identity_config, name='fedcm_config'),
path('.well-known/web-identity', views.fedcm_web_identity, name='fedcm_identity'),
```

3. **Add nginx configuration** (if using Docker):

```nginx
location /.well-known/web-identity {
    proxy_pass http://backend:8000/.well-known/web-identity;
}
```

---

## Immediate Testing Steps

1. **Don't need FedCM right now** - disable it temporarily:
   
   In `frontend/src/views/auth/Login.jsx`, change:
   ```javascript
   window.google.accounts.id.initialize({
     client_id: clientId,
     callback: handleGoogleResponse,
     ux_mode: 'popup',
     auto_select: false,
     use_fedcm_for_prompt: false, // Disable FedCM
   });
   ```

2. **Test if OAuth Consent Screen is the issue**:
   - Go to Google Cloud Console
   - OAuth consent screen
   - Check "External" is selected
   - Check test users include your Google account
   - Save

3. **Refresh and test again**:
   ```bash
   cd frontend
   npm run dev  # Restart frontend to clear cache
   ```
   Then go to http://localhost:5173/login and try again

---

## What Each Configuration Does

| Configuration | Purpose | Impact |
|--|--|--|
| OAuth Consent Screen | Tells Google this app is legitimate | Without this, FedCM fails |
| Test Users | Whitelist accounts for development | Without this, your account can't auth |
| Redirect URIs | Where Google sends user after auth | Without this, auth fails |
| JavaScript Origins | Where the app is hosted | Required for CORS with Google |

---

## Common FedCM Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "FedCM get() rejects" | Consent screen not configured | Configure OAuth Consent Screen |
| "Account not available" | Your account not in test users | Add email to test users |
| "Wrong origin" | JavaScript origin not whitelisted | Add to Authorized JavaScript origins |
| "Invalid credentials" | Client ID mismatch | Check GOOGLE_CLIENT_ID in .env |

---

## Verification Checklist

Before you test:

- [ ] Google Cloud Project exists: "LMSetjen DPD RI"
- [ ] OAuth Consent Screen: Configured with user type "External"
- [ ] Test Users: Contains your Google account email
- [ ] OAuth Credentials: Web application type
- [ ] Client ID: 634643429020-fqsklueemda8b84085nhmracbkamtrip.apps.googleusercontent.com
- [ ] Authorized Redirect URIs: Include http://localhost:5173 and http://localhost:8000/api/v1/auth/google/
- [ ] Authorized JavaScript Origins: Include http://localhost:5173 and http://localhost:8000
- [ ] Frontend .env: VITE_GOOGLE_CLIENT_ID matches
- [ ] Backend .env: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET match
- [ ] Frontend running: npm run dev
- [ ] Backend running: python manage.py runserver

---

## Next Steps

1. **Check Google Cloud Console** - especially OAuth Consent Screen
2. **Add your Google account to Test Users** - CRITICAL for FedCM
3. **Verify all URIs are configured** - redirect URIs and JavaScript origins
4. **Restart frontend** - `npm run dev`
5. **Test login again** - http://localhost:5173/login

If still failing after these steps, we may need to temporarily disable FedCM and use the older One Tap method.

---

## Alternative: Use Non-FedCM OAuth Flow

If FedCM continues to fail, we can switch to the standard OAuth 2.0 Authorization Code Flow:

1. Frontend redirects to Google OAuth endpoint
2. Google redirects back to your app with authorization code
3. Backend exchanges code for tokens
4. Backend returns JWT tokens to frontend

This is more reliable but requires more setup. Let me know if you need this implemented.

---

**Status**: Investigating FedCM configuration issues  
**Last Updated**: January 21, 2026
