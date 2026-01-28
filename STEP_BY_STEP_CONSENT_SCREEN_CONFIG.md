# STEP-BY-STEP: Google Cloud Console OAuth Consent Screen Configuration

**ESTIMATED TIME: 5 minutes**

---

## STEP 1: Open Google Cloud Console

1. Open browser
2. Go to: **https://console.cloud.google.com/**
3. Sign in with your Google account

---

## STEP 2: Select Your Project

1. At the top, click the **Project Selector**
2. Search for: **LMSetjen DPD RI**
3. Click on it to select

**Screenshot should show:**
```
┌─────────────────────────────┐
│ Project: LMSetjen DPD RI    │
└─────────────────────────────┘
```

---

## STEP 3: Navigate to OAuth Consent Screen

1. In the left sidebar, click: **APIs & Services**
2. Then click: **OAuth consent screen**

**You should see one of two screens:**

### IF you see "Create Consent Screen" button:
- Click **CREATE**
- Select: **External**
- Click **CREATE** again

### IF you already have a consent screen:
- Go to **STEP 6** (Verify Test Users)

---

## STEP 4: Fill in App Information

**On the "OAuth consent screen" form, fill in:**

| Field | Value |
|-------|-------|
| App name | `LMSetjen DPD RI` |
| User support email | *(Your Gmail address)* |
| App logo | *(Leave blank)* |
| Developer contact email | *(Your Gmail address)* |

**Example:**
```
App name: LMSetjen DPD RI
User support email: yourname@gmail.com
Developer contact email: yourname@gmail.com
```

**Then click: SAVE AND CONTINUE**

---

## STEP 5: Configure Scopes (Leave Default)

On the "Scopes" page:
- You'll see some scopes listed
- **Don't add any new scopes**
- Just click: **SAVE AND CONTINUE**

---

## STEP 6: Add Test Users (CRITICAL!)

You should now see a **"Test users"** section.

**Do this:**

1. Click: **ADD USERS** button (or **+ ADD USERS**)
2. **In the popup:**
   - **Email addresses field:** Enter your Gmail address
   - Example: `yourname@gmail.com`
3. Click: **ADD** button
4. You should see your email listed below

**Visual:**
```
┌─────────────────────────────────┐
│ Test Users                      │
├─────────────────────────────────┤
│ [+ ADD USERS]                   │
│                                 │
│ Added users:                    │
│ • yourname@gmail.com            │
└─────────────────────────────────┘
```

---

## STEP 7: Review and Save

1. Scroll down and click: **SAVE AND CONTINUE** or just **BACK TO DASHBOARD**

**Congratulations!** Your consent screen is configured.

---

## STEP 8: Verify Your Credentials

Now verify your OAuth 2.0 credentials are correct.

1. In left sidebar: **APIs & Services** → **Credentials**
2. Find your **Web application** credentials
3. Click the pencil icon to edit it
4. Scroll down to check:

### Authorized redirect URIs - Should include:
```
http://localhost:5173
http://localhost:5173/login
http://localhost:8000
http://localhost:8000/api/v1/auth/google/
```

If missing, add them:
- Click **ADD URI** button
- Paste each URL
- Click **SAVE**

### Authorized JavaScript origins - Should include:
```
http://localhost:5173
http://localhost:8000
http://127.0.0.1:5173
http://127.0.0.1:8000
```

If missing, add them:
- Click **ADD URI** button  
- Paste each URL
- Click **SAVE**

---

## STEP 9: Test the Login

Now go back to test the login:

1. Open browser
2. Go to: **http://localhost:5173/login**
3. Click: **"Masuk dengan Google"** button
4. **Expected:**
   - Google popup appears
   - Select your Gmail account
   - Login succeeds

---

## Verification Checklist

Before testing, verify you completed:

- [ ] Went to https://console.cloud.google.com/
- [ ] Selected project: LMSetjen DPD RI
- [ ] Went to APIs & Services → OAuth consent screen
- [ ] Created consent screen (External)
- [ ] Filled in: App name, Support email, Developer contact
- [ ] **Added test user with your Gmail address** ← CRITICAL!
- [ ] Went to Credentials
- [ ] Verified Authorized redirect URIs include localhost URLs
- [ ] Verified Authorized JavaScript origins include localhost URLs
- [ ] Cleared browser cache/cookies
- [ ] Restarted frontend: npm run dev
- [ ] Hard refresh browser: Ctrl+Shift+R

---

## Common Issues

### "Still getting the same error"
- Did you actually ADD your Gmail to Test Users?
- Check: APIs & Services → OAuth consent screen → Test users section
- Your email should be listed there

### "Still not working after all steps"
- Try: **Clear cookies in browser settings**
- Close browser completely
- Clear cache
- Restart browser
- Go to http://localhost:5173/login again

### "Don't see OAuth consent screen option"
- Make sure you selected the right project: "LMSetjen DPD RI"
- You should see it under: APIs & Services

---

## What Each Step Does

| Step | Purpose |
|------|---------|
| Create Consent Screen | Tells Google this app is legitimate |
| Select External | Allows testing with your own account |
| Fill App Info | Google needs basic app details |
| Add Test Users | Whitelists your Gmail to authenticate |
| Configure Redirect URIs | Tells Google where to send users after login |
| Configure Origins | Tells Google where the app is hosted |

---

## After Configuration

Your system will now:
1. Allow FedCM to authenticate users
2. Accept credentials from your Gmail account
3. Redirect properly after authentication
4. Generate JWT tokens for your app

---

## Quick Video Summary

If you need clarification, the steps are:

1. Google Cloud Console → Your Project
2. APIs & Services → OAuth consent screen
3. Create (if needed) → External
4. Fill form → Save
5. Add test users → Your Gmail → Save
6. Verify credentials → Redirect URIs & Origins
7. Test login again

**Time needed**: ~5 minutes

---

## Support

If you get stuck:
1. Check CRITICAL_FIX_OAUTH_CONSENT_SCREEN.md for details
2. Check your browser console (F12) for error messages
3. Verify test user was actually added (refresh the page)
4. Try clearing browser cookies completely

---

**Status**: Step-by-step guide provided ✅  
**Next**: Complete the steps above and test login again  
**Time**: 5 minutes
