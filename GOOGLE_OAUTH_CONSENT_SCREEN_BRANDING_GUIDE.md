# Google OAuth Consent Screen - Branding Configuration Guide
## LMSetjen DPD RI Platform

**Document Purpose**: Step-by-step guide for configuring the Google OAuth Consent Screen branding section.

**Last Updated**: January 21, 2026  
**Status**: ✅ Ready for Configuration  
**Priority**: 🔴 CRITICAL - Required for OAuth login to work

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [App Information](#app-information)
3. [App Logo](#app-logo)
4. [App Domain](#app-domain)
5. [Authorized Domains](#authorized-domains)
6. [Developer Contact](#developer-contact)
7. [Verification Status](#verification-status)
8. [Summary](#summary)

---

## Overview

The **Branding** section of the Google OAuth Consent Screen displays information to users about your application. This is what appears when users see the "Masuk dengan Google" button and authenticate.

**Direct Link**: https://console.cloud.google.com/apis/consent

---

## App Information

### App Name
**Value to Enter**: `LMSetjen DPD RI`

**Purpose**: This is the official name of your application as shown to users on the consent screen.

**What Users See**: 
- Appears as: "LMSetjen DPD RI wants access to your Google Account"
- Located at top of consent screen popup

**Configuration Steps**:
1. In Branding section, find "App name" field
2. Enter: `LMSetjen DPD RI`
3. Keep it clear and recognizable
4. **Do NOT change**: This must match your official organization name

---

### User Support Email

**Value to Enter**: `sdm@dpd.go.id`

**Purpose**: Users contact this email if they have questions about your app or their consent.

**What Users See**:
- "For users to contact you with questions about their consent"
- Often appears as clickable link on consent screen
- Users can report issues or ask permission questions

**Configuration Steps**:
1. In Branding section, find "User support email" field
2. Enter: `sdm@dpd.go.id`
3. Ensure this email is actively monitored
4. Use official organizational email (not personal)
5. **Important**: This should have:
   - Active mailbox (not alias only)
   - Monitored daily for support requests
   - Ability to respond to user questions about privacy/permissions

**What This Email Receives**:
- User consent questions (e.g., "Why does this app need my calendar?")
- Privacy concerns
- Technical issues during authentication
- Feedback about the app's permissions

---

## App Logo

### Overview

The logo helps users recognize your application. It displays on the OAuth consent screen to build trust and provide visual context.

**Size Requirements**:
- **Dimensions**: 120px × 120px (square)
- **File Size**: Maximum 1MB
- **Formats Allowed**: JPG, PNG, BMP
- **Best Practice**: PNG with transparency for cleaner look

### Recommended Logo Options

Your project has **multiple logo options** available:

```
📁 frontend/src/assets/logo/
├── logo-512.png    (512×512) ← USE THIS SOURCE
├── logo-192.png    (192×192)
└── logo-180.png    (180×180)

📁 backend/static/
├── logo.png

📁 frontend/src/assets/
└── LMSetjen-DPD-RI.jpg
```

### **Recommended Choice**: 

**Use**: `logo-512.png` (resized to 120×120px)
- **Path**: `frontend/src/assets/logo/logo-512.png`
- **Original Size**: 512×512 pixels
- **Action**: Resize to 120×120px using image editor
- **Format**: PNG with transparent background

### How to Prepare the Logo

**Option 1: Using Online Image Resizer**
1. Go to: https://www.photoresizer.com/ or https://pixlr.com/
2. Upload: `frontend/src/assets/logo/logo-512.png`
3. Resize to: **120 × 120 pixels**
4. Export as: PNG
5. Save to desktop
6. Upload to Google Cloud Console

**Option 2: Using Windows Built-in Tools**
1. Right-click logo-512.png → "Edit"
2. Image → Resize → Set to 120×120
3. File → Export As → Save as PNG
4. Upload to Google Cloud Console

**Option 3: Using Online Tool**
1. Visit: https://www.iloveimg.com/resize-image
2. Upload logo-512.png
3. Set size to 120×120
4. Download resized PNG
5. Upload to Google Cloud Console

### Upload Instructions

**In Google Cloud Console**:
1. Navigate to: **APIs & Services** → **OAuth Consent Screen**
2. Click **Edit app**
3. Go to **Branding** section
4. Find **App logo** field with "Upload an image" button
5. Click **CHOOSE FILE**
6. Select your resized 120×120px PNG
7. Click **OPEN**
8. Google will show preview
9. Verify size and appearance
10. Click **SAVE AND CONTINUE**

### Logo Preview Expectations

After upload, you should see:
- ✅ Logo displays correctly at 120×120px
- ✅ No "File too large" error (max 1MB)
- ✅ Image is clear and recognizable
- ✅ Colors are accurate
- ✅ Transparency appears correctly (if PNG with transparency)

---

## App Domain

This section protects users and your app by requiring registered domains.

### Application Home Page

**Value to Enter**: `https://lmsetjendpdri.duckdns.org`

**Purpose**: Users can visit your app's home page to verify legitimacy

**What Users See**:
- "Provide users a link to your home page"
- Often clickable on consent screen or consent preferences page

**Configuration Steps**:
1. In Branding section, find "Application home page" field
2. Enter: `https://lmsetjendpdri.duckdns.org`
3. Must start with `https://`
4. **Verify**: This URL must:
   - ✅ Actually work and load your app
   - ✅ Be publicly accessible
   - ✅ Match your domain exactly (case-sensitive for some parts)
   - ✅ Load your LMS homepage

**Verification Check**:
- Open https://lmsetjendpdri.duckdns.org in browser
- Confirm it loads your LMS homepage
- If it shows error, fix domain issue first

---

### Application Privacy Policy Link

**Value to Enter**: `https://lmsetjendpdri.duckdns.org/privacy-policy`

**Purpose**: Users can read your privacy practices before consenting

**What Users See**:
- "Provide users a link to your public privacy policy"
- Clickable link on consent screen
- Users review before granting permissions

**Configuration Steps**:
1. In Branding section, find "Application privacy policy link" field
2. Enter: `https://lmsetjendpdri.duckdns.org/privacy-policy`
3. Must start with `https://`

**Current Status**: ❌ **Privacy policy page needs to be created**

**Action Required**:
1. Create privacy policy page at `/privacy-policy` route
2. Include:
   - What data you collect
   - How you use it
   - How long you keep it
   - User rights
   - Contact information
3. Make publicly accessible
4. Keep it updated

**Temporary Option** (if not ready):
- Create simple page with basic info
- Link to `https://lmsetjendpdri.duckdns.org/user-guide/`
- Later update with complete privacy policy

---

### Application Terms of Service Link

**Value to Enter**: `https://lmsetjendpdri.duckdns.org/terms-of-service`

**Purpose**: Users understand rules and conditions before using app

**What Users See**:
- "Provide users a link to your public terms of service"
- Clickable link on consent screen
- Users must review to consent

**Configuration Steps**:
1. In Branding section, find "Application terms of service link" field
2. Enter: `https://lmsetjendpdri.duckdns.org/terms-of-service`
3. Must start with `https://`

**Current Status**: ❌ **Terms of Service page needs to be created**

**Action Required**:
1. Create terms page at `/terms-of-service` route
2. Include:
   - Acceptable use policy
   - User responsibilities
   - Liability disclaimers
   - Service limitations
   - Termination clauses
   - Contact information
3. Make publicly accessible
4. Keep it updated

**Temporary Option** (if not ready):
- Create simple page with basic terms
- Link to existing documentation
- Later update with complete terms

---

## Authorized Domains

Google requires pre-registration of domains used in OAuth to prevent impersonation and phishing.

### Required Authorized Domains

**Domain 1: Production Domain**
```
Domain: lmsetjendpdri.duckdns.org
Status: ✅ MUST BE ADDED
Purpose: Production environment where users authenticate
```

**Domain 2: Local Development (Optional)**
```
Domain: localhost
Status: ⏳ Optional for local testing
Purpose: Development environment
Note: Usually not added to production OAuth apps
```

### Add Authorized Domain - Step by Step

**In Google Cloud Console**:

1. **Navigate to Authorized Domains section**
   - Go to: https://console.cloud.google.com/apis/consent
   - Click **Edit App**
   - Scroll to **Authorized Domains** section

2. **Click "Add Domain"**
   - Find the input field
   - Click the **ADD** or **+** button

3. **Enter Domain**
   - Type: `lmsetjendpdri.duckdns.org`
   - Do NOT include `https://` prefix
   - Do NOT include path like `/api`
   - Just: `lmsetjendpdri.duckdns.org`

4. **Verify Ownership (if prompted)**
   - Google may ask you to verify domain ownership
   - This is usually done via:
     - DNS TXT record
     - HTML file in root directory
     - Domain registrar verification
   - **For DuckDNS**: See DuckDNS verification section below

5. **Click Save**
   - Domain appears in authorized list
   - Status shows "Verified" or "Pending Verification"

### DuckDNS Domain Verification

**If Google asks for verification**:

1. **Go to DuckDNS**
   - Visit: https://www.duckdns.org/
   - Login with your account

2. **Add TXT Record**
   - In your domain settings
   - Add DNS TXT record (if prompted by Google)
   - Google will provide the verification code

3. **Wait for Verification**
   - Can take 24-48 hours
   - Google will notify when complete
   - Status changes from "Pending" to "Verified"

**Note**: Most DuckDNS domains auto-verify. If issues occur, check Google Search Console.

---

## Developer Contact Information

### Email Addresses for Google Notifications

**Purpose**: Google uses these emails to notify you about:
- Security issues
- API deprecations
- Policy violations
- Account changes
- Service updates

### Recommended Setup

**Primary Email**: `sdm@dpd.go.id`

**Configuration Steps**:
1. In Branding section, find "Developer contact information" field
2. Find "Email addresses" input
3. Enter: `sdm@dpd.go.id`
4. Click **ADD** to add email
5. Multiple emails can be added:
   - Primary: sdm@dpd.go.id
   - Secondary (optional): Additional admin email
   - Tertiary (optional): Technical lead email

### What Google Sends to This Email

**Security & Compliance**:
- ❌ "Your OAuth app was detected with security vulnerability"
- 🔄 "Please update your consent screen before [date]"
- 🔒 "Unusual API activity detected"

**Administrative**:
- 📢 "API will be deprecated on [date]"
- 🛠️ "Service maintenance scheduled"
- 📊 "Monthly usage report"

**Important**: Ensure this email is:
- ✅ Actively monitored
- ✅ Receives notifications
- ✅ Can be replied to
- ✅ Official organization email
- ✅ Not spam-filtered

---

## Verification Status

### Current Status

**Your App Status**: Testing

**What This Means**:
- ✅ No verification required for internal testing
- ✅ Up to 100 test users can use the app
- ✅ Suitable for development and staging
- ⏸️ Cannot be used by general public
- ⏸️ Limited to test users you add

### When Verification Is Required

**You must submit for verification when**:
- Changing from "Testing" to "Production"
- Publishing app for general user access
- Integrating OAuth with external systems

**For Now**: 
- ✅ Testing status is appropriate
- ✅ No verification needed yet
- ⏳ Can switch to Production later (requires additional security review)

---

## Summary Checklist

### ✅ Quick Configuration Checklist

**App Information**:
- [ ] App name: `LMSetjen DPD RI`
- [ ] User support email: `sdm@dpd.go.id`

**Logo**:
- [ ] Resized logo to 120×120px
- [ ] Format: PNG (recommended)
- [ ] File size: < 1MB
- [ ] Logo uploaded and preview verified

**App Domain**:
- [ ] Home page: `https://lmsetjendpdri.duckdns.org`
- [ ] Privacy policy: `https://lmsetjendpdri.duckdns.org/privacy-policy` (or placeholder)
- [ ] Terms of service: `https://lmsetjendpdri.duckdns.org/terms-of-service` (or placeholder)

**Authorized Domains**:
- [ ] Domain added: `lmsetjendpdri.duckdns.org`
- [ ] Domain verified (or verification in progress)

**Developer Contact**:
- [ ] Email added: `sdm@dpd.go.id`
- [ ] Email is monitored

**Verification**:
- [ ] Confirmed: Testing status is appropriate
- [ ] Noted: No verification needed for now

---

## Configuration Order (Recommended)

**Step 1**: Fill in App Information (2 minutes)
- ✅ App name
- ✅ User support email

**Step 2**: Prepare Logo (5 minutes)
- ✅ Resize logo-512.png to 120×120px
- ✅ Save as PNG

**Step 3**: Upload Logo (2 minutes)
- ✅ Upload resized logo
- ✅ Verify preview

**Step 4**: Configure App Domain (3 minutes)
- ✅ Add home page URL
- ✅ Add privacy policy URL (or placeholder)
- ✅ Add terms of service URL (or placeholder)

**Step 5**: Add Authorized Domain (2 minutes)
- ✅ Add lmsetjendpdri.duckdns.org
- ✅ Initiate verification

**Step 6**: Add Developer Contact (1 minute)
- ✅ Add email address

**Step 7**: Verify Settings (2 minutes)
- ✅ Review all entries
- ✅ Save configuration

**Total Time**: Approximately 15 minutes

---

## Troubleshooting

### Issue: "Logo file too large"
**Solution**: Ensure file is < 1MB. If 120×120px PNG is still too large:
1. Open in image editor
2. Reduce quality to 80%
3. Export and try again

### Issue: "Invalid URL format"
**Solution**: Make sure URLs:
- Start with `https://` (not http://)
- Have no trailing spaces
- Don't include `/` at the end (e.g., use `domain.com` not `domain.com/`)
- Are properly spelled

### Issue: "Domain verification pending"
**Solution**: 
- Google usually auto-verifies within 24-48 hours
- If longer, check Google Search Console
- May need to add DNS TXT record
- Contact Google Cloud support if stuck

### Issue: "Email address not accepted"
**Solution**:
- Make sure email format is correct (example@domain.com)
- Check for extra spaces
- Verify email is valid and active
- Ensure it's not spam-filtered in Google Admin

---

## Next Steps After Configuration

1. **Test OAuth Login**
   - Go to: http://localhost:5173/login
   - Click "Masuk dengan Google"
   - Verify consent screen shows your branding

2. **Add Test Users**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Find your OAuth client
   - Go to "Test Users" section
   - Add your Gmail account
   - You can then test login

3. **Monitor Email**
   - Ensure `sdm@dpd.go.id` is monitored
   - Watch for Google notifications
   - Address any security alerts

4. **Create Privacy/Terms Pages**
   - Create proper privacy policy
   - Create proper terms of service
   - Update URLs in consent screen later
   - **Important for compliance**: Do this before production launch

5. **When Ready for Production**
   - Change status from "Testing" to "Production"
   - Submit for Google verification
   - Provide security documentation
   - May take 1-3 weeks for review

---

## Important Notes

### Security Reminders

⚠️ **Do**:
- ✅ Use HTTPS URLs only
- ✅ Keep support email monitored
- ✅ Use official organization email
- ✅ Test with real users before launch
- ✅ Maintain accurate privacy/terms pages

⚠️ **Don't**:
- ❌ Use test URLs or localhost
- ❌ Use personal email for support
- ❌ Leave privacy/terms pages blank
- ❌ Share OAuth credentials
- ❌ Use "Testing" status for real users

### Compliance Notes

- 🇮🇩 For Indonesian Government (DPD RI):
  - Ensure privacy policy complies with Indonesian law
  - Include data residency information
  - Consider PDP (Personal Data Protection) requirements
  - Get approval from organizational security team

---

## Support Resources

**Google OAuth Documentation**: https://support.google.com/cloud/answer/6158849

**Google Cloud Consent Screen Help**: https://support.google.com/cloud/answer/10311614

**Troubleshooting Guide**: https://support.google.com/cloud/answer/6158849#consent-screen

---

## Quick Reference

| Field | Value | Status |
|-------|-------|--------|
| App Name | LMSetjen DPD RI | ✅ Ready |
| Support Email | sdm@dpd.go.id | ✅ Ready |
| Logo | 120×120px PNG | ⏳ Needs Preparation |
| Home Page | https://lmsetjendpdri.duckdns.org | ✅ Ready |
| Privacy Policy | https://lmsetjendpdri.duckdns.org/privacy-policy | ⏳ Needs URL |
| Terms of Service | https://lmsetjendpdri.duckdns.org/terms-of-service | ⏳ Needs URL |
| Authorized Domain | lmsetjendpdri.duckdns.org | ✅ Ready |
| Dev Contact Email | sdm@dpd.go.id | ✅ Ready |

---

**Configuration Guide Created**: January 21, 2026  
**Last Updated**: January 21, 2026  
**Status**: ✅ Complete and Ready for Use  
**Next Action**: Follow checklist above and configure consent screen
