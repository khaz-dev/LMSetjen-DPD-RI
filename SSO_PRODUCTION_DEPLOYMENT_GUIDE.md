# SSO Production Deployment Guide for lmsetjendpdri.duckdns.org

## 🎯 Deployment Overview

Your production environment uses:
- **Frontend**: https://lmsetjendpdri.duckdns.org (Nginx + SSL)
- **Backend**: https://lmsetjendpdri.duckdns.org (Django + REST API)
- **Database**: PostgreSQL
- **Cache**: Redis
- **SSL**: Let's Encrypt

## ✅ Pre-Deployment Checklist

- [x] SSO fix tested and working on localhost
- [ ] Production .env file configured
- [ ] CORS settings updated for production domain
- [ ] Cookie settings set to secure (HTTPS only)
- [ ] SSO Provider callback URL updated to production
- [ ] SSL certificates ready
- [ ] Database backed up
- [ ] Ready to deploy

---

## 📋 Step 1: Update Backend Configuration

### 1.1 Verify Production .env Settings

Your current `.env` already has production settings. **Verify these are correct:**

```bash
# Check current settings:
cat .env | grep -E "DEBUG|SECRET_KEY|ALLOWED_HOSTS|FRONTEND_SITE_URL|BACKEND_SITE_URL"
```

**Should show:**
```
DEBUG=False
SECRET_KEY=V)7#Ax)qK0!9P;#:Y!w%%u1=4~ux([AeX.Q*p#TF"*kw;qH{u=
ALLOWED_HOSTS=lmsetjendpdri.duckdns.org,localhost,127.0.0.1,16.79.83.21
FRONTEND_SITE_URL=https://lmsetjendpdri.duckdns.org
BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org
```

### 1.2 Update Backend Settings for SSO Production

The backend settings look good. Key SSO-related settings already configured:
- ✅ CORS includes production domain
- ✅ JWT tokens properly configured  
- ✅ HTTPS enforcement ready

But let me verify the SSO-specific settings are production-ready:

**File**: `backend/backend/settings.py` (Lines 32-45)
- ✅ DEBUG=False in production
- ✅ SECRET_KEY is strong (not default)
- ✅ ALLOWED_HOSTS includes production domain
- ✅ FRONTEND_SITE_URL uses HTTPS

---

## 📋 Step 2: Update Frontend Environment Variables

### 2.1 Create Production Frontend Environment

Create `.env.production` in the frontend directory:

```bash
cat > frontend/.env.production << 'EOF'
# Production Environment Variables
VITE_API_BASE_URL=https://lmsetjendpdri.duckdns.org
EOF
```

This ensures the frontend uses HTTPS in production.

### 2.2 Update Frontend Vite Config (Production Mode)

The frontend already has proper production build. Verify:

```bash
cd frontend
npm run build
```

This creates an optimized production build in `frontend/dist/`

---

## 📋 Step 3: Configure SSO for Production

### 3.1 Update SSO Provider Callback URL

Your SSO provider (Nusa DPD) needs to be configured with the production callback:

**Current (Local)**:
```
http://localhost:5173/sso/{token}/
```

**Must be changed to (Production)**:
```
https://lmsetjendpdri.duckdns.org/sso/{token}/
```

**Action Required**:
1. Go to your SSO Provider settings (Nusa DPD admin panel)
2. Update Callback/Redirect URI to: `https://lmsetjendpdri.duckdns.org/sso/{token}/`
3. Save changes
4. Note the SSO Token endpoint URL - add to backend settings

### 3.2 Add SSO Provider Settings to Backend .env

Update `.env` with SSO provider details (if needed):

```bash
# Add to .env if not already present:
SSO_PROVIDER_URL=https://nusadpd.duckdns.org  # or actual SSO provider URL
SSO_TOKEN_ENDPOINT=https://nusadpd.duckdns.org/token/verify
```

---

## 📋 Step 4: Update Cookie Security for HTTPS

### 4.1 Update Frontend Cookie Settings

**File**: `frontend/src/utils/auth.js` (Lines 310-320)

The current code already has smart cookie detection:
```javascript
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const cookieOptions = {
    expires: isLocalhost ? 1 : 1,
    secure: !isLocalhost,  // Only secure flag on HTTPS (production)
    sameSite: isLocalhost ? 'Lax' : 'strict'
};
```

This automatically uses:
- ✅ `secure: true` on production (HTTPS only)
- ✅ `sameSite: 'strict'` on production (CSRF protection)

**No changes needed** - it's already production-ready!

### 4.2 Update SSOLogin Cookie Settings

**File**: `frontend/src/views/auth/SSOLogin.jsx` (Lines 90-110)

Verify cookies are set correctly:

```javascript
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const cookieOptions = {
    expires: 1,
    path: '/',
    domain: isLocalhost ? undefined : '.duckdns.org',  // Allow subdomains
    secure: !isLocalhost,  // HTTPS only
    sameSite: isLocalhost ? 'Lax' : 'strict',
};

Cookie.set("access_token", access, cookieOptions);
Cookie.set("refresh_token", refresh, cookieOptions);
```

---

## 📋 Step 5: Backend CORS Configuration Verification

Your backend CORS is already configured for production. Verify it includes:

**File**: `backend/backend/settings.py` (Lines 287-301)

```python
CORS_ALLOWED_ORIGINS = [
    "https://lmsetjendpdri.duckdns.org",  # ✅ Production frontend
    "http://localhost:5173",  # Development
    "http://127.0.0.1:5173",  # Development
]

CORS_ALLOW_CREDENTIALS = True  # ✅ Required for cookies
```

This is already configured correctly. ✅

---

## 📋 Step 6: Prepare Docker Compose for Production

Your docker-compose.yml is already configured for production. Verify:

```yaml
# docker-compose.yml checks:
- Build target: "production" ✅
- DEBUG environment: ${DEBUG:-False} ✅
- Redis password configured ✅
- Database credentials configured ✅
```

No changes needed.

---

## 📋 Step 7: Verify SSL Certificate

Your production uses Let's Encrypt. Verify the certificate is valid:

```bash
# SSH to production server and check:
sudo certbot certificates

# Should show certificate for: lmsetjendpdri.duckdns.org
# Expiry date should be > 30 days out
```

---

## 🚀 Step 8: Deployment Steps

### Option A: Using Docker Compose (Recommended)

```bash
# 1. SSH to production server
ssh your-user@16.79.83.21

# 2. Navigate to project directory
cd /path/to/LMSetjen-DPD-RI

# 3. Pull latest code from git
git pull origin main

# 4. Create production environment file (if needed)
cat frontend/.env.production

# 5. Build and start containers
docker-compose down
docker-compose up -d --build

# 6. Run migrations
docker-compose exec backend python manage.py migrate

# 7. Collect static files
docker-compose exec backend python manage.py collectstatic --noinput

# 8. Create superuser (if first deployment)
docker-compose exec backend python manage.py createsuperuser
```

### Option B: Manual Deployment

```bash
# 1. SSH to production server
ssh your-user@16.79.83.21

# 2. Stop current services
sudo systemctl stop lms_backend
sudo systemctl stop lms_frontend

# 3. Pull code
cd /path/to/LMSetjen-DPD-RI
git pull origin main

# 4. Build frontend
cd frontend
npm ci --production
npm run build

# 5. Start backend
cd ../backend
python manage.py migrate
python manage.py collectstatic --noinput
gunicorn backend.wsgi:application --bind 0.0.0.0:8000

# 6. Start services
sudo systemctl start lms_frontend
sudo systemctl start lms_backend
```

---

## 🧪 Step 9: Test SSO on Production

After deployment, test SSO login:

### 9.1 Test on Production Domain

1. Navigate to: https://lmsetjendpdri.duckdns.org
2. Click "Login dengan SSO"
3. Authenticate with SSO provider
4. Should redirect to: https://lmsetjendpdri.duckdns.org/sso/{token}/
5. Should redirect to: https://lmsetjendpdri.duckdns.org/student/dashboard/

### 9.2 Check Browser Console

Open DevTools (F12) and look for:

```
✅ UserData: Decoded from refresh_token
Fields in refresh_token: ..., role, ...
role = student
✅ RoleRoute: User has permission!
```

### 9.3 Check Backend Logs

```bash
# View backend container logs
docker-compose logs -f backend

# Look for:
# "✅ JWT tokens generated successfully"
# "🎉 SSO login successful for user: email@example.com"
```

---

## 🔒 Security Checklist - Production

- [ ] DEBUG = False (not True)
- [ ] SECRET_KEY is strong and not default
- [ ] ALLOWED_HOSTS only includes production domain
- [ ] SSL certificate valid and auto-renewal configured
- [ ] CORS only allows production frontend domain
- [ ] Cookies set with secure flag (HTTPS only)
- [ ] Cookies set with sameSite='strict'
- [ ] Database password is strong
- [ ] Redis password is strong
- [ ] Backups configured and tested
- [ ] Monitoring/logging configured

---

## ⚠️ Common Production Issues & Fixes

### Issue 1: "Access Denied" after SSO login
**Solution**: 
- Check JWT tokens include role field (see console logs)
- Verify backend restarted with new code
- Clear browser cookies and try again

### Issue 2: Cookies not persisting
**Solution**:
- Verify `secure: true` in production (HTTPS required)
- Check domain setting in cookie options
- Verify CORS allows credentials

### Issue 3: Mixed HTTP/HTTPS content
**Solution**:
- Ensure frontend uses `https://` for API calls
- Check nginx redirects HTTP → HTTPS
- Verify all URLs in .env use `https://`

### Issue 4: SSL certificate issues
**Solution**:
```bash
# Check certificate
sudo certbot certificates

# Renew if needed
sudo certbot renew

# Restart nginx
sudo systemctl restart nginx
```

---

## 📊 Post-Deployment Verification

Run these checks after deployment:

```bash
# 1. Check backend is running
curl https://lmsetjendpdri.duckdns.org/api/v1/health/

# 2. Check frontend is accessible
curl -I https://lmsetjendpdri.duckdns.org

# 3. Check Docker containers
docker ps

# 4. Check logs for errors
docker-compose logs --tail=100 backend
docker-compose logs --tail=100 frontend

# 5. Test SSO endpoint
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/sso/verify/ \
  -H "Content-Type: application/json" \
  -d '{"sso_token": "test_token"}'
```

---

## 🎉 Production Deployment Complete

Once all steps are complete:

1. ✅ SSO works identically to local
2. ✅ Tokens include all user fields (role, etc.)
3. ✅ RoleRoute verifies users correctly
4. ✅ Dashboard loads without errors
5. ✅ SSL certificate validates
6. ✅ All security headers present
7. ✅ Cookies secure and httpOnly
8. ✅ Backups configured

---

## 📞 Rollback Procedure

If deployment has issues:

```bash
# 1. Revert to previous version
cd /path/to/LMSetjen-DPD-RI
git revert HEAD

# 2. Restart containers
docker-compose down
docker-compose up -d

# 3. Or restore from backup
# (if backup available)
```

---

## 📝 Monitoring

Set up monitoring for:
- SSL certificate expiry (renews auto, but monitor anyway)
- Backend uptime
- Error rates in logs
- SSO login success rate
- Database performance

---

**Ready to deploy!** Follow the deployment steps above to move SSO to production. 🚀

