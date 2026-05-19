# 🚀 LMSetjen DPD RI - Staging Deployment Guide
# For: lms.khaz.app (165.245.191.216)
# Status: Ready for Final Configuration

## ✅ COMPLETION STATUS

- ✓ Pre-deployment scan completed
- ✓ All 6 CRITICAL issues fixed
- ✓ SSH connection tested and verified
- ✓ Project uploaded to staging server
- ✓ docker-compose.yml ready
- ✓ .env.staging template uploaded
- ⏳ AWAITING: Configure .env.staging with actual values
- ⏳ AWAITING: Run final deployment

---

## 📋 NEXT STEPS - CONFIGURE & DEPLOY

### Step 1: SSH into Staging Server
```powershell
ssh -i c:\Users\khair\khaz root@165.245.191.216
cd /root/lmsetjendpdri
```

### Step 2: Configure Environment Variables

Edit the .env file on the server and set the following:

```bash
# On staging server:
nano .env.staging
# OR
vim .env.staging
```

**REQUIRED VALUES TO REPLACE:**

```env
# ============================================================
# 1. SECURITY KEYS (GENERATE NEW ONES)
# ============================================================

# Generate new SECRET_KEY:
SECRET_KEY=[your-new-django-secret-key]

# Example generation on server:
# python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# ============================================================
# 2. DATABASE CREDENTIALS
# ============================================================
DB_PASSWORD=[your-secure-db-password]
# Make this strong! Example: $(openssl rand -base64 32)

# ============================================================
# 3. REDIS PASSWORD
# ============================================================
REDIS_PASSWORD=[your-secure-redis-password]
# Make this strong! Example: $(openssl rand -base64 32)

# ============================================================
# 4. GOOGLE OAUTH (if needed for authentication)
# ============================================================
# Register at: https://console.cloud.google.com/
# Callback URL: https://lms.khaz.app/login

GOOGLE_CLIENT_ID=[your-staging-google-client-id]
GOOGLE_CLIENT_SECRET=[your-staging-google-client-secret]

# ============================================================
# 5. EXTERNAL API TOKEN (if needed)
# ============================================================
EXTERNAL_API_TOKEN=[your-api-token]
```

### Step 3: Copy .env.staging to .env

```bash
cd /root/lmsetjendpdri
cp .env.staging .env
nano .env  # Update all [placeholder] values
```

### Step 4: Initialize Git Repository

```bash
cd /root/lmsetjendpdri
git init
git remote add origin https://github.com/khaz-dev/LMSetjen-DPD-RI.git
git pull origin main
```

### Step 5: Deploy with Docker Compose

```bash
cd /root/lmsetjendpdri

# Build images (first time only, takes 5-10 minutes)
docker-compose build

# Start services
docker-compose up -d

# Wait for services to start
sleep 30

# Run migrations
docker-compose exec backend python manage.py migrate --noinput

# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput

# Create superuser (optional)
docker-compose exec backend python manage.py createsuperuser

# Check status
docker-compose ps
```

### Step 6: Verify Deployment

```bash
# Check container logs
docker-compose logs -f

# Test API health check
curl https://lms.khaz.app/api/v1/health/

# Test frontend
curl -I https://lms.khaz.app/
```

### Step 7: Configure nginx SSL (if needed)

If nginx needs SSL certificate, use Let's Encrypt:

```bash
# Install certbot
apt-get update && apt-get install -y certbot python3-certbot-nginx

# Get certificate
certbot certonly --manual --preferred-challenges=dns -d lms.khaz.app

# Or use existing certificate in nginx config
# Update nginx config at: /etc/nginx/sites-available/lms.khaz.app
```

---

## 🔧 MANUAL DEPLOYMENT COMMANDS

If you prefer to deploy manually without the script:

```bash
# SSH into server
ssh -i c:\Users\khair\khaz root@165.245.191.216

# Navigate to project
cd /root/lmsetjendpdri

# Pull latest code
git pull origin main

# Build images
docker-compose build --no-cache

# Start containers
docker-compose up -d

# Run setup commands
docker-compose exec backend python manage.py migrate --noinput
docker-compose exec backend python manage.py collectstatic --noinput --clear

# View logs
docker-compose logs backend    # Django logs
docker-compose logs frontend   # React build logs
docker-compose logs redis      # Redis logs
docker-compose logs postgres   # Database logs
```

---

## 📊 ACCESS AFTER DEPLOYMENT

Once deployed, your application will be accessible at:

- **Frontend**: https://lms.khaz.app
- **Backend API**: https://lms.khaz.app/api/v1/
- **Admin Panel**: https://lms.khaz.app/admin/
- **API Documentation**: https://lms.khaz.app/api/v1/swagger/

---

## ✅ VERIFICATION CHECKLIST

After deployment, verify these endpoints:

```bash
# Health check
curl https://lms.khaz.app/api/v1/health/

# Course list
curl https://lms.khaz.app/api/v1/course/course-list/ \
  -H "Authorization: Bearer {access_token}"

# Static files (CSS/JS)
curl -I https://lms.khaz.app/static/index.css

# Admin login
# Visit: https://lms.khaz.app/admin/
# Use superuser credentials created in Step 5
```

---

## 🐛 TROUBLESHOOTING

### If containers don't start:
```bash
# Check logs
docker-compose logs

# Stop all containers
docker-compose down

# Remove volumes and rebuild
docker-compose down -v
docker-compose up -d
```

### If migrations fail:
```bash
# Check database connection
docker-compose exec backend python manage.py dbshell

# Re-run migrations
docker-compose exec backend python manage.py migrate --noinput

# Check migration status
docker-compose exec backend python manage.py showmigrations
```

### If API returns 502 Bad Gateway:
```bash
# Check backend logs
docker-compose logs backend

# Restart backend container
docker-compose restart backend
```

### If frontend shows blank page:
```bash
# Check frontend logs
docker-compose logs frontend

# Verify nginx is running
docker-compose ps

# Check nginx config
docker-compose exec nginx nginx -t
```

---

## 📝 IMPORTANT NOTES

### Security
- ✓ DEBUG is set to False in staging
- ✓ All secrets should be strong random passwords
- ✓ Don't commit .env to git
- ✓ Use HTTPS everywhere

### Database
- First deployment will auto-create database tables
- Existing data from production can be restored from backup
- Use pg_dump for backup: `docker-compose exec postgres pg_dump -U postgres lmsdb > backup.sql`

### Performance
- Redis caching is enabled for optimal performance
- Static files are served by nginx
- Database connections are pooled (conn_max_age=600)

### Monitoring
- Check container logs regularly: `docker-compose logs -f`
- Monitor disk space for media uploads
- Set up automated backups for PostgreSQL

---

## 🎯 WHAT'S BEEN FIXED FOR YOU

✅ **6 Critical Issues Fixed:**
1. ✓ Debug print statements removed from Django settings
2. ✓ CSRF_TRUSTED_ORIGINS added for lms.khaz.app
3. ✓ CORS_ALLOWED_ORIGINS updated for staging domain
4. ✓ Hardcoded secrets removed and replaced with env variables
5. ✓ Frontend API URL fixed (no localhost defaults)
6. ✓ Environment configuration templates created

✅ **5 High Priority Issues Addressed:**
1. ✓ Old EC2 IP references removed from CORS defaults
2. ✓ Hardcoded API tokens replaced with env variables
3. ✓ Redis port configuration aligned
4. ✓ Vite frontend build configuration verified
5. ✓ Google OAuth configuration ready for staging creds

✅ **4 Medium Priority Items Handled:**
1. ✓ Debug toolbar properly configured
2. ✓ SSL/HTTPS settings ready to enable
3. ✓ Development defaults in docker-compose reviewed
4. ✓ Database connection configuration verified

---

## 🚀 YOU'RE READY TO DEPLOY!

Your project is production-ready. Follow the steps above to complete the deployment.

**Questions?** Check the troubleshooting section or review the logs.

---

**Last Updated**: May 13, 2026  
**Next Steps**: Configure .env.staging → Deploy with Docker Compose → Test at lms.khaz.app
