# QUICKLINK: Direct URLs for Google Cloud Console

## What You Need to Fix

Google's OAuth Consent Screen is NOT configured. This is why FedCM fails.

---

## DIRECT LINK (Easiest)

**Click this link to go directly to OAuth Consent Screen:**

👉 **https://console.cloud.google.com/apis/consent**

Then:
1. Select project: **LMSetjen DPD RI**
2. If you see "Create Consent Screen" → Click **CREATE**
3. Select: **External** 
4. Fill form with your details
5. Add your Gmail as Test User
6. Save

---

## Alternative: Step-by-Step Links

**If the direct link doesn't work, use these steps:**

1. **Google Cloud Console home:**
   https://console.cloud.google.com/

2. **Select Project:** LMSetjen DPD RI (at top dropdown)

3. **APIs & Services:**
   https://console.cloud.google.com/apis/

4. **Credentials:**
   https://console.cloud.google.com/apis/credentials

5. **OAuth Consent Screen:**
   https://console.cloud.google.com/apis/consent

---

## What to Do

### COPY & PASTE THIS:
1. Open browser
2. Paste this URL: `https://console.cloud.google.com/apis/consent`
3. Press Enter
4. Select project if prompted
5. Follow the form
6. **CRITICAL: Add your Gmail to Test Users**
7. Save
8. Come back here and test login

---

## Already Did This?

If you already configured the consent screen:

1. Go back to test: http://localhost:5173/login
2. Click "Masuk dengan Google"
3. **Google popup should appear**
4. Select your Gmail account
5. **Should redirect to dashboard**

If not working, check:
- [ ] Your Gmail is in Test Users list
- [ ] Cleared browser cookies
- [ ] Restarted frontend (npm run dev)

---

## Simplified: What's Wrong

```
Current State:
Google OAuth Consent Screen: ❌ NOT CONFIGURED

Fix:
1. Go to: https://console.cloud.google.com/apis/consent
2. Create consent screen
3. Add your Gmail to test users
4. Save
5. Test login again ✅
```

---

## Estimated Time: 5 Minutes

- 1 min: Open URL
- 2 min: Create consent screen & fill form
- 1 min: Add Gmail to test users
- 1 min: Test login

---

## Troubleshooting

**"I can't find the OAuth Consent Screen option"**
- Make sure you selected the right project: **LMSetjen DPD RI**
- At the top of Google Cloud Console, there's a project dropdown

**"It says my project doesn't have OAuth set up"**
- That's okay, that's what we're fixing
- Click "Create" to set it up

**"Still not working after configuration"**
- Check: https://console.cloud.google.com/apis/credentials
- Find your Web application credentials
- Make sure "Authorized redirect URIs" includes: http://localhost:5173
- Make sure "Authorized JavaScript origins" includes: http://localhost:5173

---

## Next Steps After Configuration

1. ✅ Configure consent screen (DO THIS NOW)
2. ✅ Add test user (DO THIS NOW)  
3. ✅ Test login at http://localhost:5173/login (DO THIS AFTER STEPS 1-2)
4. ✅ Report if still failing (IF STILL NOT WORKING)

---

**Status**: Critical configuration identified  
**Solution**: Configure OAuth Consent Screen  
**Instructions**: STEP_BY_STEP_CONSENT_SCREEN_CONFIG.md  
**Quick Link**: https://console.cloud.google.com/apis/consent

---

**ACTION REQUIRED**: Go to the link above and complete the 5-minute configuration!
