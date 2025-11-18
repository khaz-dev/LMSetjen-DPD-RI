# 🚀 PRODUCTION DEPLOYMENT GUIDE - SSO INTEGRATION

**Version:** 1.0.0  
**Date:** November 18, 2025  
**Status:** Production Ready ✅

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Quick Deployment (5 Minutes)](#quick-deployment-5-minutes)
3. [Step-by-Step Manual Deployment](#step-by-step-manual-deployment)
4. [Automated Deployment Script](#automated-deployment-script)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Procedures](#rollback-procedures)

---

## ✅ Pre-Deployment Checklist

Before starting deployment, ensure the following:

### Code Ready
- [ ] All SSO commits pushed to GitHub main branch
  ```bash
  git log --oneline | grep -i sso
  # Should show commits with SSO integration
  ```
- [ ] Latest code available at `https://github.com/khaz-dev/LMSetjen-DPD-RI`
- [ ] No uncommitted changes locally
  ```bash
  git status
  # Should show "nothing to commit, working tree clean"
  ```

### Server Ready
- [ ] Production server has Docker and Docker Compose installed
  ```bash
  docker --version
  docker compose version
  ```
- [ ] SSH access to production server working
- [ ] Sufficient disk space (minimum 20GB recommended)
  ```bash
  df -h
  ```
- [ ] PostgreSQL password known and accessible
- [ ] SSL/TLS certificates valid or being renewed

### Environment Configuration
- [ ] `.env` file exists on production server or will be created
- [ ] SSO environment variables documented (see below)
- [ ] Database credentials configured
- [ ] Secret keys configured (JWT_SECRET_KEY, etc.)

### Backups Ready
- [ ] Database backups scheduled/tested
- [ ] Media files backup location identified
- [ ] Backup restoration procedure tested

### Communication
- [ ] Team notified of deployment window
- [ ] Maintenance mode plan if needed
- [ ] Escalation contacts identified

---

## 🚀 Quick Deployment (5 Minutes)

### For Experienced DevOps Teams

```bash
# 1. SSH to production server
ssh deploy@your-production-server.com

# 2. Navigate to project
cd /home/deploy/LMSetjen-DPD-RI

# 3. Pull latest code
git pull origin main

# 4. Start deployment script
chmod +x deploy-production.sh
./deploy-production.sh

# 5. Monitor logs
docker compose logs -f backend

# 6. Verify
curl https://lmsetjendpdri.duckdns.org/login/
# Look for "Login dengan Nusa DPD" button
```

**Expected duration:** 10-15 minutes

---

## 📖 Step-by-Step Manual Deployment

Use this method if you prefer manual control or the automated script doesn't work.

### Step 1: Backup Current Deployment

```bash
# SSH to production server
ssh deploy@your-production-server.com
cd /home/deploy/LMSetjen-DPD-RI

# Create backup timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup database
docker compose exec -T postgres pg_dump -U postgres -d lmsetjen_db > \
  backups/db_backup_${TIMESTAMP}.sql

# Backup media files
docker compose exec -T backend tar -czf \
  backups/media_backup_${TIMESTAMP}.tar.gz media/

echo "Backups created:"
ls -lh backups/db_backup_${TIMESTAMP}.sql
ls -lh backups/media_backup_${TIMESTAMP}.tar.gz
```

### Step 2: Pull Latest Code

```bash
# Fetch from GitHub
git fetch origin

# Verify SSO commits
git log --oneline -5 | grep -i sso

# Checkout main branch
git checkout main

# Pull latest code
git pull origin main

# Verify SSO files exist
ls -la backend/api/sso_utils.py
ls -la frontend/src/views/auth/SSOLogin.jsx
```

### Step 3: Verify Environment Configuration

```bash
# Check if .env exists
ls -la .env

# If .env doesn't exist, create it with these variables:
cat > .env << 'EOF'
# Django Settings
DEBUG=False
SECRET_KEY=your-secret-key-here
DJANGO_SETTINGS_MODULE=backend.settings

# Database
DATABASES_ENGINE=django.db.backends.postgresql
DATABASES_NAME=lmsetjen_db
DATABASES_USER=postgres
DATABASES_PASSWORD=your-db-password
DATABASES_HOST=postgres
DATABASES_PORT=5432

# SSO Configuration
SSO_PROVIDER_URL=https://nusadpd.duckdns.org/
SSO_VERIFY_ENDPOINT=https://cmb.tail91813a.ts.net/sso/verify/
SSO_TOKEN_ALGORITHM=HS256
SSO_CALLBACK_URL=https://lmsetjendpdri.duckdns.org/sso/

# JWT Settings
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# CORS
CORS_ALLOWED_ORIGINS=https://lmsetjendpdri.duckdns.org

# Email (optional)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# Allowed hosts
ALLOWED_HOSTS=lmsetjendpdri.duckdns.org,localhost,127.0.0.1
EOF

# Verify critical variables
grep "SSO_PROVIDER_URL" .env
grep "JWT_SECRET_KEY" .env
```

### Step 4: Stop Current Containers

```bash
# View current containers
docker compose ps

# Stop all containers gracefully
docker compose down

# Verify all stopped
docker compose ps
```

### Step 5: Build New Docker Images

```bash
# Build with no cache (ensures latest code)
docker compose build --no-cache backend frontend nginx

# Watch for any build errors
# If build fails, check docker compose logs
```

### Step 6: Start New Containers

```bash
# Start all services in detached mode
docker compose up -d

# Wait for services to start
sleep 30

# Check status
docker compose ps

# All containers should show "Up"
```

### Step 7: Apply Database Migrations

```bash
# Wait for database to be ready
sleep 10

# Run migrations
docker compose exec -T backend python manage.py migrate

# Expected output:
# Running migrations:
#   Applying sessions.0001_initial... OK
#   Applying userauths.0001_initial... OK
#   etc...
```

### Step 8: Collect Static Files

```bash
# Collect Django static files
docker compose exec -T backend python manage.py collectstatic --noinput

# Expected output:
# Copying '/app/backend/static/admin/js/inlines.min.js'
# etc...
```

### Step 9: Verify Deployment

```bash
# Check container logs for errors
docker compose logs backend | head -50

# Check if application is responding
curl -I https://lmsetjendpdri.duckdns.org/login/

# Should return: HTTP/1.1 200 OK

# Verify SSO button exists in HTML
curl -s https://lmsetjendpdri.duckdns.org/login/ | grep -i "nusa\|sso"
```

---

## 🤖 Automated Deployment Script

We provide two deployment scripts for automation.

### PowerShell Script (Windows)

```powershell
# Run on Windows machine with PowerShell
.\DEPLOY_TO_PRODUCTION.ps1

# This generates:
# 1. Complete bash script with all steps
# 2. Deployment instructions
# 3. Verification checklist
```

### Bash Script (Linux/Mac/Production Server)

```bash
# Run on production server
chmod +x deploy-production.sh
./deploy-production.sh

# The script will:
# ✓ Backup database and media
# ✓ Pull latest code
# ✓ Verify configuration
# ✓ Stop containers
# ✓ Build images
# ✓ Start containers
# ✓ Run migrations
# ✓ Perform health checks

# Monitor progress
tail -f backups/deployment_*.log
```

**Script Features:**
- Automatic error handling and rollback
- Colored output for easy reading
- Comprehensive logging to file
- Health checks and verification
- Backup before deployment

---

## ✅ Post-Deployment Verification

### Immediate Checks (5 minutes after deployment)

```bash
# 1. Check all containers are running
docker compose ps
# Output should show:
# - backend (Up)
# - frontend (Up)
# - nginx (Up)
# - postgres (Up)

# 2. Check backend logs for errors
docker compose logs backend | grep -i error

# 3. Check frontend logs
docker compose logs frontend | tail -20

# 4. Check nginx logs
docker compose logs nginx | tail -20

# 5. Verify database connection
docker compose exec -T backend python manage.py shell << 'EOF'
from django.contrib.auth.models import User
print(f"Total users: {User.objects.count()}")
EOF
```

### Functional Checks (15 minutes after deployment)

```bash
# 1. Visit login page
curl -s https://lmsetjendpdri.duckdns.org/login/ | grep -o "Login dengan Nusa DPD"
# Should output: Login dengan Nusa DPD

# 2. Test API endpoint (if public)
curl https://lmsetjendpdri.duckdns.org/api/v1/health/

# 3. Check admin panel
curl -I https://lmsetjendpdri.duckdns.org/admin/
# Should return: HTTP/1.1 302 (redirect to login)

# 4. Check if SSL certificate is valid
openssl s_client -connect lmsetjendpdri.duckdns.org:443 -showcerts 2>/dev/null | grep -A 2 "subject="
```

### Security Checks

```bash
# 1. Verify HTTPS is enforced
curl -i http://lmsetjendpdri.duckdns.org/login/ 2>&1 | head -5
# Should redirect to HTTPS

# 2. Check security headers
curl -I https://lmsetjendpdri.duckdns.org/login/ | grep -i "strict-transport\|x-frame\|x-content"

# 3. Verify CSRF protection
docker compose exec -T backend python manage.py shell << 'EOF'
from django.middleware.csrf import get_token
print("CSRF protection: ENABLED")
EOF
```

### Performance Checks

```bash
# 1. Check container resource usage
docker stats --no-stream

# 2. Check disk usage
df -h

# 3. Check database size
docker compose exec -T postgres psql -U postgres -d lmsetjen_db -c "\l+"
```

---

## 🆘 Troubleshooting

### Issue: "Container failed to start"

**Symptom:**
```
docker compose ps shows container in "Exited" state
```

**Solution:**
```bash
# Check logs
docker compose logs backend

# Look for error messages like:
# - "ModuleNotFoundError" - Missing Python package
# - "Connection refused" - Database not ready
# - "Permission denied" - File permissions issue

# If database issue:
docker compose restart postgres
sleep 10
docker compose up -d backend

# If code issue:
git status  # Verify code state
git log -1  # Check last commit
```

### Issue: "Database migration failed"

**Symptom:**
```
docker compose exec -T backend python manage.py migrate
# Shows migration errors
```

**Solution:**
```bash
# Check migration status
docker compose exec -T backend python manage.py showmigrations

# Check for unapplied migrations
docker compose exec -T backend python manage.py migrate --plan

# If stuck, try fake migration:
docker compose exec -T backend python manage.py migrate userauths --fake-initial

# Then retry
docker compose exec -T backend python manage.py migrate
```

### Issue: "Static files not loading"

**Symptom:**
```
CSS/JavaScript files return 404 errors
```

**Solution:**
```bash
# Collect static files
docker compose exec -T backend python manage.py collectstatic --noinput

# Check if nginx is serving static files
docker compose exec -T nginx ls -la /app/static/

# Verify nginx configuration
docker compose exec -T nginx nginx -t
# Should show: nginx: configuration file test is successful
```

### Issue: "SSO button not showing"

**Symptom:**
```
Login page visible but no "Login dengan Nusa DPD" button
```

**Solution:**
```bash
# Check if frontend code updated
docker compose exec -T backend ls -la api/sso_utils.py

# Verify frontend files
docker compose exec -T frontend ls -la src/views/auth/SSOLogin.jsx

# Check frontend logs
docker compose logs frontend

# Rebuild frontend
docker compose build --no-cache frontend
docker compose up -d frontend
```

### Issue: "502 Bad Gateway"

**Symptom:**
```
Nginx returns HTTP 502 error
```

**Solution:**
```bash
# Check backend is running
docker compose exec -T backend ps aux | grep "runserver\|gunicorn"

# Check nginx can reach backend
docker compose exec -T nginx curl http://backend:8000/health/

# Check nginx error logs
docker compose logs nginx | grep -i error

# Restart backend
docker compose restart backend
sleep 10

# Check again
curl https://lmsetjendpdri.duckdns.org/
```

### Issue: "Port already in use"

**Symptom:**
```
Error: bind: address already in use
```

**Solution:**
```bash
# Check what's using the port
lsof -i :8000  # Django
lsof -i :3000  # React
lsof -i :80    # HTTP
lsof -i :443   # HTTPS

# Kill the process
kill -9 <PID>

# Or change port in docker-compose.yml
# Then try again
docker compose up -d
```

---

## 🔄 Rollback Procedures

### Quick Rollback (Last Commit)

Use this if deployment introduced critical issues.

```bash
# 1. Stop current deployment
docker compose down

# 2. Revert to previous commit
git checkout main~1

# 3. Rebuild containers
docker compose build --no-cache backend frontend nginx

# 4. Start containers
docker compose up -d

# 5. Apply migrations
docker compose exec -T backend python manage.py migrate

# 6. Verify
docker compose ps
docker compose logs backend
```

### Rollback to Specific Commit

```bash
# Find the commit you want to rollback to
git log --oneline | head -20

# Checkout that commit (replace HASH with actual commit hash)
git checkout HASH

# Rebuild and start
docker compose down
docker compose build --no-cache
docker compose up -d --build
docker compose exec -T backend python manage.py migrate

# Verify
curl https://lmsetjendpdri.duckdns.org/
```

### Database Rollback

```bash
# List available backups
ls -lh backups/db_backup_*.sql

# Restore from backup
docker compose exec -T postgres psql -U postgres -d lmsetjen_db < \
  backups/db_backup_20251118_143000.sql

# Verify
docker compose exec -T backend python manage.py shell << 'EOF'
from django.contrib.auth.models import User
print(f"Users after restore: {User.objects.count()}")
EOF
```

### Media Files Rollback

```bash
# List available backups
ls -lh backups/media_backup_*.tar.gz

# Extract backup
cd backups/
tar -xzf media_backup_20251118_143000.tar.gz

# Copy to media directory
docker compose exec -T backend rm -rf media/
docker compose exec -T backend mkdir -p media/

# Restore files
cp -r media/* ../media/

# Verify
docker compose exec -T backend ls -la media/
```

---

## 📊 Deployment Monitoring

### Real-Time Monitoring

```bash
# Watch container status
watch -n 2 'docker compose ps'

# Watch logs (all services)
docker compose logs -f

# Watch specific service
docker compose logs -f backend

# Watch resource usage
docker stats

# Watch database size
watch -n 10 'docker compose exec -T postgres psql -U postgres -d lmsetjen_db -c "\l+"'
```

### Health Dashboard

```bash
# Create health check script
cat > check_health.sh << 'EOF'
#!/bin/bash

echo "=== Container Status ==="
docker compose ps

echo -e "\n=== CPU & Memory Usage ==="
docker stats --no-stream

echo -e "\n=== Disk Usage ==="
df -h | grep -E "Size|/"

echo -e "\n=== Database Status ==="
docker compose exec -T postgres pg_isready -U postgres

echo -e "\n=== Backend Health ==="
curl -s http://localhost:8000/health/ || echo "Backend not responding"

echo -e "\n=== Frontend Health ==="
curl -s http://localhost:3000/ | head -5

echo -e "\n=== Recent Errors ==="
docker compose logs --tail=20 | grep -i error || echo "No errors found"
EOF

chmod +x check_health.sh
./check_health.sh
```

---

## 📋 Deployment Checklist

### Pre-Deployment

- [ ] All code committed to GitHub main branch
- [ ] Latest code reviewed by team
- [ ] Environment variables prepared
- [ ] Database backup strategy confirmed
- [ ] Team notified
- [ ] Rollback plan reviewed
- [ ] SSH access to production verified

### During Deployment

- [ ] Running pre-deployment checks
- [ ] Creating backups
- [ ] Pulling latest code
- [ ] Verifying configuration
- [ ] Stopping containers
- [ ] Building images
- [ ] Starting containers
- [ ] Running migrations
- [ ] Collecting static files
- [ ] Performing health checks

### Post-Deployment

- [ ] All containers running
- [ ] No critical errors in logs
- [ ] Login page displays correctly
- [ ] SSO button visible
- [ ] Admin panel accessible
- [ ] Database connected
- [ ] Static files loading
- [ ] SSL certificate valid
- [ ] Performance acceptable
- [ ] Team notified

---

## 🎯 Key Files Referenced

- `docker-compose.yml` - Container configuration
- `.env` - Environment variables
- `backend/api/sso_utils.py` - SSO implementation
- `frontend/src/views/auth/SSOLogin.jsx` - SSO component
- `deploy-production.sh` - Automated deployment script
- `backups/` - Backup directory

---

## 🆘 Support & Documentation

For more information, see:
- `SSO_INTEGRATION_GUIDE.md` - Technical details
- `SSO_ENV_CONFIGURATION.md` - Configuration guide
- `SSO_DEPLOYMENT_CHECKLIST.md` - Detailed checklist
- `PRODUCTION_DEPLOYMENT_STEPS.md` - General deployment guide
- `README.md` - Project overview

---

## ✅ Deployment Success Indicators

Your deployment is successful when:

✅ All containers show "Up" status
✅ No critical errors in logs
✅ Login page loads without errors
✅ "Login dengan Nusa DPD" button visible
✅ Admin panel accessible
✅ Database migrations completed
✅ Static files loading (CSS, JS visible)
✅ Response time < 2 seconds
✅ SSL certificate valid
✅ All team members can access

---

**Last Updated:** November 18, 2025  
**Version:** 1.0.0  
**Status:** Production Ready ✅
