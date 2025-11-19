# SSO Production Deployment - Critical Checklist

## ⚠️ BEFORE YOU DEPLOY - COMPLETE THESE STEPS

### Step 1: Verify SSO Provider Configuration ✅ REQUIRED
- [ ] Login to Nusa DPD SSO admin panel
- [ ] Find Application/Callback settings
- [ ] Update callback URL to: `https://lmsetjendpdri.duckdns.org/sso/{token}/`
- [ ] Save and note the SSO Token Endpoint
- [ ] Test SSO login still works with new callback URL

**⚠️ CRITICAL**: If SSO provider isn't updated, users will get redirected to wrong URL

---

### Step 2: Backup Production Database ✅ REQUIRED
```bash
# SSH to production server
ssh your-user@16.79.83.21

# Backup database
docker-compose exec postgres pg_dump -U lms_user django_lms_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_*.sql
```

**⚠️ CRITICAL**: Never deploy without backup!

---

### Step 3: Create Frontend .env.production File ✅ REQUIRED

```bash
# Create on your local machine or production server
cat > frontend/.env.production << 'EOF'
VITE_API_BASE_URL=https://lmsetjendpdri.duckdns.org
EOF
```

This ensures frontend uses HTTPS in production build.

---

### Step 4: Build Frontend Locally ✅ RECOMMENDED

```bash
# Test production build works before deploying
cd frontend
npm ci
npm run build

# Check output
ls -la dist/

# Should contain index.html and bundled assets
```

**⚠️ WARNING**: If build fails, don't deploy

---

### Step 5: Verify SSL Certificate ✅ REQUIRED

```bash
# SSH to production server
ssh your-user@16.79.83.21

# Check certificate
sudo certbot certificates

# Should show:
# - Certificate Name: lmsetjendpdri.duckdns.org
# - Expiry: more than 30 days away
```

**⚠️ CRITICAL**: Without SSL, SSO and cookies won't work!

---

### Step 6: Verify Current Backend Version ✅ IMPORTANT

```bash
# SSH to production server
ssh your-user@16.79.83.21

# Check current commit
cd /path/to/LMSetjen-DPD-RI
git log --oneline -1

# Should show SSO fix commit (ce6bf40 or later)
```

---

### Step 7: Check Disk Space ✅ REQUIRED

```bash
# SSH to production server
ssh your-user@16.79.83.21

# Check available space
df -h

# Need at least 5GB free
```

**⚠️ CRITICAL**: Docker pull and build need space!

---

### Step 8: Verify .env Production Settings ✅ REQUIRED

```bash
# SSH to production server
ssh your-user@16.79.83.21

# Check settings
grep -E "DEBUG|FRONTEND_SITE_URL|BACKEND_SITE_URL" /path/to/LMSetjen-DPD-RI/.env

# Should show:
# DEBUG=False
# FRONTEND_SITE_URL=https://lmsetjendpdri.duckdns.org
# BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org
```

**⚠️ CRITICAL**: Wrong URLs break SSO!

---

### Step 9: Plan Maintenance Window ✅ REQUIRED

- Deployment typically takes 5-10 minutes
- Plan downtime during low-traffic hours
- Notify users if needed
- Have rollback plan ready

---

### Step 10: Test Locally One More Time ✅ RECOMMENDED

```bash
# Local machine
cd /path/to/LMSetjen-DPD-RI

# Verify SSO works on localhost
npm run dev  # frontend on port 5174
python manage.py runserver  # backend on port 8000

# Test SSO login
# - Should see proper console logs
# - Should see role in tokens
# - Should access dashboard without errors
```

---

## 🚀 DEPLOYMENT PROCEDURE

Once all checklist items complete, follow this order:

### 1. Backup (Do This First!)
```bash
ssh your-user@16.79.83.21
cd /path/to/LMSetjen-DPD-RI
docker-compose exec postgres pg_dump -U lms_user django_lms_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Pull Latest Code
```bash
git pull origin main
# Verify you get SSO fix commit
```

### 3. Create Frontend .env
```bash
cat > frontend/.env.production << 'EOF'
VITE_API_BASE_URL=https://lmsetjendpdri.duckdns.org
EOF
```

### 4. Stop Services
```bash
docker-compose down
```

### 5. Build and Start
```bash
docker-compose up -d --build
```

### 6. Run Migrations
```bash
docker-compose exec backend python manage.py migrate
```

### 7. Collect Static Files
```bash
docker-compose exec backend python manage.py collectstatic --noinput
```

### 8. Check Logs
```bash
docker-compose logs -f backend
# Wait 1-2 minutes, check for errors
# Should see: "Starting development server at..."
```

---

## 🧪 POST-DEPLOYMENT TESTING

### Test 1: Frontend Accessible
```bash
curl -I https://lmsetjendpdri.duckdns.org
# Should return: HTTP/2 200
```

### Test 2: Backend API Works
```bash
curl https://lmsetjendpdri.duckdns.org/api/v1/
# Should return JSON (not 404 or 500)
```

### Test 3: SSL Certificate Valid
```bash
openssl s_client -connect lmsetjendpdri.duckdns.org:443
# Should show certificate details, not errors
```

### Test 4: SSO Login Works
1. Open browser: https://lmsetjendpdri.duckdns.org
2. Click "Login dengan SSO"
3. Authenticate with SSO provider
4. Watch browser console (F12)
5. Should see: `role = student` (not `undefined`)
6. Dashboard should load
7. No "Access Denied" error

### Test 5: Check Cookies
1. Open DevTools: F12 → Application → Cookies
2. Should see: `access_token` and `refresh_token`
3. Both should have `Secure` flag (HTTPS only)
4. Both should have `SameSite=Strict`

---

## ❌ IF DEPLOYMENT FAILS

### Immediate Rollback
```bash
# Stop everything
docker-compose down

# Revert code
git revert HEAD
git pull origin main

# Restore from backup (if needed)
# Contact your database admin

# Restart
docker-compose up -d
```

### Common Errors & Fixes

**Error: "Module not found" in backend**
- Solution: `docker-compose exec backend pip install -r requirements.txt`

**Error: "cannot bind to port 8000"**
- Solution: `docker-compose down` then `docker-compose up -d`

**Error: "database connection refused"**
- Solution: Check PostgreSQL container is running: `docker ps`

**Error: SSO login redirects to wrong URL**
- Solution: Check SSO provider callback is updated to production URL

**Error: "Access Denied" after SSO login**
- Solution: Check backend logs for JWT token errors
- Run: `docker-compose logs backend | grep "JWT\|role"`

---

## 📋 CRITICAL ITEMS - DON'T MISS

| Item | Why Important | Status |
|------|---------------|--------|
| Update SSO Provider | Users can't login if callback URL wrong | ⚠️ MUST DO |
| Backup Database | Protection against data loss | ⚠️ MUST DO |
| Build Frontend .env.production | Production URLs must be HTTPS | ⚠️ MUST DO |
| Verify SSL Certificate | HTTPS required for cookies & security | ⚠️ MUST DO |
| Test Locally First | Catch bugs before production | ⚠️ SHOULD DO |

---

## 📞 During Deployment

Have this information ready:

- Production server IP: `16.79.83.21`
- Domain: `lmsetjendpdri.duckdns.org`
- Your SSH key for server access
- Database backup location
- Git commit hash of SSO fix
- SSO provider admin contact info

---

## ✅ SUCCESS INDICATORS

After deployment, you should see:

- ✅ https://lmsetjendpdri.duckdns.org loads
- ✅ SSO login button works
- ✅ Can login with SSO provider
- ✅ Dashboard loads without "Access Denied"
- ✅ Console shows `role = student` (not undefined)
- ✅ Cookies set with Secure flag
- ✅ SSL certificate shows valid
- ✅ No errors in backend logs
- ✅ Users can access all features

---

## 🎓 Understanding the Deployment

### What Gets Deployed
1. Backend code with SSO fix (JWT tokens now include role)
2. Frontend code with enhanced UserData plugin
3. Static files and assets
4. Docker containers with new images

### Why It Matters
- SSO login had a bug: role field missing from JWT
- This prevented RoleRoute from verifying users
- Fix ensures SSO works identically to normal login
- Production deployment makes it live for all users

### Verification Methods
- Browser console shows token details
- Backend logs show JWT generation
- Cookies tab shows secure flags
- Network tab shows HTTP/2 + SSL

---

**READY FOR PRODUCTION?** Once you complete the checklist above, run the deployment procedure. 🚀

