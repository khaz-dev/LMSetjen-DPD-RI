# ✅ STAGING DEPLOYMENT - READY FOR FINAL STEPS

## 🎯 WHAT HAS BEEN COMPLETED

### ✅ Pre-Deployment Fixes (100% Complete)
1. **Removed all debug print statements** from Django settings that exposed sensitive database credentials
2. **Added CSRF_TRUSTED_ORIGINS** configuration for lms.khaz.app domain
3. **Updated CORS_ALLOWED_ORIGINS** to include staging domain (removed old EC2 IP references)
4. **Removed hardcoded secrets** - all replaced with environment variables
5. **Created .env.staging template** with placeholders for sensitive values
6. **Created .env.example** as documentation template
7. **Added CSRF/CORS security headers** for staging domain

### ✅ Server Preparation (100% Complete)
1. **SSH connection verified** to 165.245.191.216 ✓
2. **Project directory created** at /root/lmsetjendpdri ✓
3. **All project files uploaded** (620MB tarball extracted) ✓
4. **docker-compose.yml ready** for deployment ✓
5. **Backend & frontend code deployed** ✓
6. **.env.staging template uploaded** (awaiting configuration) ✓

### ✅ Code Changes Applied
- Django settings.py: CSRF_TRUSTED_ORIGINS added
- Django settings.py: CORS_ALLOWED_ORIGINS updated
- Django settings.py: All debug print statements removed
- Django settings.py: Hardcoded secrets replaced with env variables
- All critical security issues resolved
- No breaking changes to active code

---

## 🚀 FINAL DEPLOYMENT STEPS (READY TO EXECUTE)

### Step 1: Connect to Staging Server
```bash
ssh -i c:\Users\khair\khaz root@165.245.191.216
cd /root/lmsetjendpdri
```

### Step 2: Configure Environment Variables

Copy the .env.staging template to .env and fill in your actual values:

```bash
cp .env.staging .env
nano .env
```

**Update these required values:**

```env
# Security
SECRET_KEY=your-new-django-secret-key-here
DEBUG=False

# Database
DB_PASSWORD=your-secure-db-password-at-least-32-chars

# Redis
REDIS_PASSWORD=your-secure-redis-password-at-least-32-chars

# Google OAuth (if using login)
GOOGLE_CLIENT_ID=your-staging-oauth-client-id
GOOGLE_CLIENT_SECRET=your-staging-oauth-client-secret

# External API (if needed)
EXTERNAL_API_TOKEN=your-api-token
```

**Generate secure passwords:**
```bash
# On server, generate random password
openssl rand -base64 32
```

### Step 3: Deploy with Docker Compose

```bash
# Build Docker images
docker-compose build --no-cache

# Start all services (backend, frontend, postgres, redis, nginx)
docker-compose up -d

# Wait for services to be ready
sleep 30

# Check status
docker-compose ps
```

### Step 4: Initialize Database

```bash
# Run migrations
docker-compose exec backend python manage.py migrate --noinput

# Collect static files for frontend
docker-compose exec backend python manage.py collectstatic --noinput --clear

# Create superuser for admin panel
docker-compose exec backend python manage.py createsuperuser
```

### Step 5: Verify Deployment

Test these URLs:

```bash
# API Health check
curl https://lms.khaz.app/api/v1/health/

# Frontend
curl -I https://lms.khaz.app/

# Admin panel
# Visit: https://lms.khaz.app/admin/
```

---

## 📋 DEPLOYMENT CHECKLIST

Before running `docker-compose up -d`, ensure:

- [ ] SSH connected to 165.245.191.216
- [ ] Working directory is `/root/lmsetjendpdri`
- [ ] `.env` file created from `.env.staging`
- [ ] All placeholder values replaced with actual values
- [ ] SECRET_KEY is strong and unique
- [ ] DB_PASSWORD is secure
- [ ] REDIS_PASSWORD is secure
- [ ] DEBUG=False (production mode)
- [ ] ALLOWED_HOSTS includes lms.khaz.app
- [ ] CSRF_TRUSTED_ORIGINS includes lms.khaz.app
- [ ] CORS_ALLOWED_ORIGINS includes lms.khaz.app

---

## 📊 SERVICE CONFIGURATION

### PostgreSQL Database
- **Image**: postgres:15
- **Port**: 5432 (internal, not exposed)
- **Database**: lmsdb
- **User**: Set in .env (DB_USER)
- **Password**: Set in .env (DB_PASSWORD)
- **Volume**: postgres_data (persisted on server)

### Redis Cache
- **Image**: redis:7-alpine
- **Port**: 6381
- **Password**: Set in .env (REDIS_PASSWORD)
- **Used for**: Sessions, caching, background tasks

### Django Backend
- **Image**: Custom (built from backend/)
- **Port**: 8001 (internal, behind nginx)
- **Framework**: Django REST Framework
- **Serves**: API endpoints, admin panel

### React Frontend
- **Image**: Custom (built from frontend/)
- **Port**: 5174 (internal, behind nginx)
- **Framework**: React 18 + Vite
- **Serves**: Web application

### Nginx Reverse Proxy
- **Port**: 80, 443 (HTTP/HTTPS)
- **Routes**: Frontend → localhost:5174, API → localhost:8001
- **SSL**: Configure with your certificate

---

## 🔗 ACCESS POINTS AFTER DEPLOYMENT

| Component | URL | Purpose |
|-----------|-----|---------|
| **Frontend** | https://lms.khaz.app | Student/Instructor portal |
| **API** | https://lms.khaz.app/api/v1/ | REST API endpoints |
| **Admin** | https://lms.khaz.app/admin/ | Django admin panel |
| **API Docs** | https://lms.khaz.app/api/v1/swagger/ | Swagger documentation |

---

## 🐛 QUICK TROUBLESHOOTING

### Containers won't start
```bash
docker-compose logs          # See error details
docker-compose down -v       # Clean up and retry
docker-compose up -d         # Start fresh
```

### Database connection error
```bash
docker-compose exec postgres psql -U postgres -d lmsdb  # Test connection
docker-compose logs postgres                            # Check postgres logs
```

### Frontend shows blank page
```bash
docker-compose logs frontend  # Check React build errors
docker-compose restart frontend
```

### API returns 502 Bad Gateway
```bash
docker-compose logs backend  # Check Django errors
docker-compose restart backend
```

---

## 📝 IMPORTANT REMINDERS

✅ **Security**
- All debug statements removed
- DEBUG=False in staging
- All secrets must be strong random values
- Don't commit .env to git
- Use HTTPS everywhere

✅ **Data**
- First deployment will create fresh database
- Use pg_dump to backup and restore data
- Media uploads stored in volumes

✅ **Monitoring**
- Check logs regularly: `docker-compose logs -f`
- Monitor disk space for uploads
- Set up automated backups

✅ **Future Updates**
- Pull latest code: `git pull origin main`
- Rebuild images: `docker-compose build`
- Restart services: `docker-compose up -d`

---

## 🎉 YOU'RE READY TO DEPLOY!

All critical issues have been fixed. Your project is production-ready for staging.

**Next Action**: Follow Step 1-5 above to complete the deployment.

---

**Status**: ✅ Ready for Deployment  
**Last Updated**: May 13, 2026  
**Target**: lms.khaz.app (165.245.191.216)  
**Support**: Check STAGING_DEPLOYMENT_GUIDE.md for detailed instructions
