# 🚀 LMS Deployment to Staging Server - Complete Guide

## 📋 Environment Overview

- **Staging Server**: `165.245.191.216`
- **LMS Domain**: `lms.khaz.app`
- **KMS Domain**: `kms.khaz.app` (existing project)
- **LMS Project Path**: `/var/www/html/lms`
- **SSH Access**: `ssh -i c:\Users\khair\khaz root@165.245.191.216`

---

## ⚠️ CRITICAL CHANGES (May 2026)

### Updated Project Structure
- Old path: `/root/lmsetjendpdri` ❌
- **New path: `/var/www/html/lms`** ✅
- Matches existing KMS structure at `/var/www/html/kms`
- Allows both projects to coexist with same nginx server

### Fixed CSRF Configuration
All `CSRF_TRUSTED_ORIGINS` now include schemes (http:// or https://):
- ✅ `https://lms.khaz.app` (was ❌ `lms.khaz.app`)
- ✅ `http://localhost:8001` (was ❌ `localhost:8001`)

---

## 📝 Pre-Deployment Checklist

- [ ] SSH key exists at `c:\Users\khair\khaz`
- [ ] SSH access verified to `165.245.191.216`
- [ ] Nginx is running on staging server
- [ ] Nginx config directory: `/etc/nginx/sites-available/`
- [ ] KMS project is at `/var/www/html/kms` and working
- [ ] Domains configured in DNS:
  - `lms.khaz.app` → `165.245.191.216`
  - `kms.khaz.app` → `165.245.191.216` (already working)

---

## 🔧 Step 1: Prepare Environment Variables

### Generate Required Secrets (on your local machine)

```powershell
# Generate new Django SECRET_KEY
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Example output: django-insecure-abc123xyz...

# Generate strong password (use one of these)
# PowerShell:
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Or use an online generator and choose a strong password like:
# P@ssw0rd!Secure2024#Random$Value
```

### Edit `.env.staging` with Real Values

In the project root, edit `.env.staging`:

```bash
# 1. SECURITY KEY (REQUIRED)
SECRET_KEY=django-insecure-YOUR_NEW_SECRET_KEY_HERE

# 2. DATABASE PASSWORD (REQUIRED)
DB_PASSWORD=your-very-strong-db-password-here

# 3. REDIS PASSWORD (REQUIRED)
REDIS_PASSWORD=your-very-strong-redis-password-here

# 4. GOOGLE OAUTH (Optional - leave as-is for now)
GOOGLE_CLIENT_ID=your-staging-google-client-id-here
GOOGLE_CLIENT_SECRET=your-staging-google-client-secret-here

# Rest of the file is already configured
```

---

## 🚀 Step 2: Deploy Using PowerShell Script

### Run Deployment

```powershell
cd "D:\Project\LMSetjen DPD RI"

# Deploy with data copy (recommended for first deployment)
.\deploy-to-staging.ps1 -Mode update-with-data-copy -Verbose

# Or choose your deployment mode:
# Full clean build (removes all data): 
#   .\deploy-to-staging.ps1 -Mode full-clean-build -Verbose
# 
# Update only (keeps existing data):
#   .\deploy-to-staging.ps1 -Mode update-only -Verbose
```

### What the Script Does

1. **Tests SSH connection** to staging server
2. **Backs up remote database** (safety measure)
3. **Backs up local database** (if available)
4. **Creates tarball** of project (excludes: node_modules, venv, .git, etc.)
5. **Uploads tarball** to staging server
6. **Extracts files** to `/var/www/html/lms`
7. **Runs Docker Compose** setup
8. **Runs migrations** and initializes database
9. **Collects static files** for Django

---

## 📋 Step 3: Configure Nginx (On Staging Server)

### SSH into Staging Server

```bash
ssh -i c:\Users\khair\khaz root@165.245.191.216
```

### Copy Nginx Configuration

```bash
# Copy the nginx config from your local machine to staging
# First, you need to upload it. On your local machine:
scp -i c:\Users\khair\khaz nginx-lms.conf root@165.245.191.216:/tmp/

# Then on the staging server:
ssh -i c:\Users\khair\khaz root@165.245.191.216

# Copy to nginx sites-available
sudo cp /tmp/nginx-lms.conf /etc/nginx/sites-available/lms

# Create symlink to sites-enabled
sudo ln -s /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/lms

# Test nginx configuration
sudo nginx -t

# If OK, reload nginx
sudo systemctl reload nginx
```

### Update SSL Certificates (First Time)

```bash
# On staging server, use Let's Encrypt
sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate for lms.khaz.app
sudo certbot certonly --nginx -d lms.khaz.app -d www.lms.khaz.app

# Verify certificate was created
ls -la /etc/letsencrypt/live/lms.khaz.app/

# The nginx config already references these paths
sudo systemctl reload nginx
```

---

## ✅ Step 4: Verify Deployment

### Check Docker Containers (On Staging Server)

```bash
cd /var/www/html/lms

# Check container status
docker-compose ps

# Expected output:
# NAME            STATUS              PORTS
# lms_redis       Up 2 minutes        
# lms_postgres    Up 2 minutes        5432/tcp
# lms_backend     Up 1 minute         0.0.0.0:8001->8001/tcp
# lms_frontend    Up 1 minute         0.0.0.0:5174->5173/tcp
```

### Check Logs (On Staging Server)

```bash
cd /var/www/html/lms

# Backend logs
docker-compose logs backend | tail -50

# Frontend logs
docker-compose logs frontend | tail -50

# All logs
docker-compose logs -f  # Press Ctrl+C to exit

# Look for these success indicators:
# ✓ "Running migrations..." - OK
# ✓ "Starting Gunicorn server" - Backend ready
# ✓ "Local:" with dev server URL - Frontend ready
```

### Test Endpoints (From Your Local Machine)

```bash
# Test API health
curl https://lms.khaz.app/api/v1/health/

# Expected response: {"status": "ok"}

# Test frontend
curl -I https://lms.khaz.app/

# Expected: HTTP/1.1 200 OK

# Test admin panel
curl -I https://lms.khaz.app/admin/

# Expected: HTTP/1.1 200 OK
```

### Browser Test

Open these URLs in your browser:

1. **Frontend**: https://lms.khaz.app/
   - Should see the React app (or loading page)
   
2. **API Docs**: https://lms.khaz.app/api/v1/swagger/
   - Should see interactive API documentation
   
3. **Admin Panel**: https://lms.khaz.app/admin/
   - Should see Django admin login

---

## 🔍 Step 5: Verify Both Projects Work

### Test KMS Project (Should Still Work)

```bash
# In your browser
https://kms.khaz.app

# Should work normally without any changes
```

### Test LMS Project

```bash
# In your browser
https://lms.khaz.app

# Should show the LMS application
```

### Check Nginx is Routing Correctly

On staging server:

```bash
# Check nginx error log for issues
sudo tail -f /var/log/nginx/lms_error.log

# Monitor access log in real-time
sudo tail -f /var/log/nginx/lms_access.log

# Check nginx status
sudo systemctl status nginx
```

---

## 🐛 Troubleshooting

### Issue: Connection Refused (Cannot access lms.khaz.app)

```bash
# Check if containers are running
docker-compose ps

# Check if backend container is healthy
docker-compose logs backend

# Check if ports are exposed
netstat -tlnp | grep 8001

# Restart containers
docker-compose restart
```

### Issue: 502 Bad Gateway from Nginx

```bash
# Nginx cannot reach Docker containers
# Check if docker-compose is running
docker-compose ps

# Check Docker logs
docker-compose logs backend

# Restart all services
docker-compose down
docker-compose up -d
docker-compose logs -f

# Wait 30 seconds for services to start
```

### Issue: Database Errors

```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Run migrations again
docker-compose exec backend python manage.py migrate --noinput

# Check database exists
docker-compose exec postgres psql -U lms_user_staging -d lmsdb_staging -c "SELECT 1;"
```

### Issue: Static Files Not Loading

```bash
# Collect static files
docker-compose exec backend python manage.py collectstatic --noinput --clear

# Check if files were collected
ls -la /var/www/html/lms/backend/staticfiles/

# Restart backend
docker-compose restart backend
```

---

## 📊 Access Points After Successful Deployment

| Component | URL | Purpose |
|-----------|-----|---------|
| Frontend | https://lms.khaz.app | Main application |
| Backend API | https://lms.khaz.app/api/v1/ | REST API endpoints |
| API Docs | https://lms.khaz.app/api/v1/swagger/ | Interactive API documentation |
| Admin Panel | https://lms.khaz.app/admin/ | Django admin |
| Health Check | https://lms.khaz.app/health | Simple health check |

---

## 🔄 Updating Deployment Later

To deploy updates later:

```powershell
# On your local machine
cd "D:\Project\LMSetjen DPD RI"

# Update with new code but keep data
.\deploy-to-staging.ps1 -Mode update-only -Verbose

# OR update with data copy
.\deploy-to-staging.ps1 -Mode update-with-data-copy -Verbose
```

---

## 📝 Important Notes

1. **Docker Network**: All containers communicate via `lms_network`
2. **Database**: PostgreSQL runs in Docker, NOT on host machine
3. **Redis**: Cache runs in Docker, accessible via `redis` hostname
4. **Nginx**: Reverse proxies requests to Docker containers
5. **SSL**: Managed by Let's Encrypt and Nginx (not Docker)
6. **Backups**: Created automatically before each deployment

---

## ❓ Support

If issues occur:

1. Check logs: `docker-compose logs -f`
2. SSH to server: `ssh -i c:\Users\khair\khaz root@165.245.191.216`
3. Navigate to project: `cd /var/www/html/lms`
4. Review Docker status: `docker-compose ps`
5. Check nginx: `sudo nginx -t && sudo systemctl reload nginx`

---

**Last Updated**: May 19, 2026  
**Deployment Mode**: Docker Compose with Nginx Reverse Proxy  
**Project Path**: `/var/www/html/lms`
