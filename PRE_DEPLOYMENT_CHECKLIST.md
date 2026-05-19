# 🎯 Deployment Checklist - Ready to Deploy!

## Status: ✅ READY FOR DEPLOYMENT

All configurations have been prepared and tested. Follow this checklist to deploy the LMS project to staging.

---

## 📋 Pre-Deployment Requirements

### On Your Local Machine (Windows)

- [ ] SSH key exists: `c:\Users\khair\khaz`
- [ ] PowerShell available and SSH working
- [ ] Project directory: `D:\Project\LMSetjen DPD RI`
- [ ] All files updated (see changes below)
- [ ] Test SSH connection: `ssh -i c:\Users\khair\khaz root@165.245.191.216`

### On Staging Server (165.245.191.216)

- [ ] Nginx is running and working
- [ ] KMS project at `/var/www/html/kms` is working
- [ ] Directory `/var/www/html` exists and writable
- [ ] Docker and Docker Compose installed
- [ ] Ports 8001 and 5174 are available (for Docker containers)
- [ ] DNS configured: `lms.khaz.app` → `165.245.191.216`

---

## 🔄 Changes Made to Your Project

### 1. Deploy Script Updated ✅
- **File**: `deploy-to-staging.ps1`
- **Change**: Updated project path from `/root/lmsetjendpdri` → `/var/www/html/lms`
- **Impact**: Now matches existing KMS project structure

### 2. CSRF Configuration Fixed ✅
- **File**: `backend/backend/settings.py`
- **Changes**:
  - `localhost:8001` → `http://localhost:8001`
  - `127.0.0.1:8001` → `http://127.0.0.1:8001`
  - `lms.khaz.app` → `https://lms.khaz.app`
  - All entries now include required scheme (http:// or https://)

### 3. Environment Configuration Updated ✅
- **File**: `.env.staging`
- **Changes**:
  - Updated ALLOWED_HOSTS and domains
  - Updated CORS_TRUSTED_ORIGINS with schemes
  - Updated CSRF_TRUSTED_ORIGINS with schemes
  - Added helpful comments for staging deployment

### 4. Nginx Configuration Created ✅
- **File**: `nginx-lms.conf` (NEW)
- **Purpose**: Reverse proxy configuration for lms.khaz.app
- **Routes**:
  - `/api/` → Backend (port 8001)
  - `/admin/` → Backend (port 8001)
  - `/static/`, `/media/` → Backend
  - `/` → Frontend (port 5174)

### 5. Setup Script Created ✅
- **File**: `setup-staging.sh` (NEW)
- **Purpose**: Interactive server setup that:
  - Generates secure secrets automatically
  - Creates .env file with credentials
  - Starts Docker containers
  - Runs migrations
  - Initializes database

### 6. Deployment Guide Created ✅
- **File**: `STAGING_DEPLOYMENT_GUIDE_MAY_2026.md` (NEW)
- **Purpose**: Complete step-by-step guide for deployment

---

## 🚀 Deployment Steps (Easy Mode)

### Step 1: Copy Files to Staging Server

```powershell
# From your local machine
cd "D:\Project\LMSetjen DPD RI"

# Run the deployment script
.\deploy-to-staging.ps1 -Mode update-with-data-copy -Verbose
```

**This will automatically:**
- Connect to staging server via SSH
- Backup remote database
- Sync project files
- Extract to `/var/www/html/lms`
- Start Docker Compose

### Step 2: Run Setup on Staging Server

```bash
# SSH into staging server
ssh -i c:\Users\khair\khaz root@165.245.191.216

# Navigate to project
cd /var/www/html/lms

# Run setup script
bash setup-staging.sh
```

**This will automatically:**
- Generate secure secrets
- Create .env file
- Build Docker images
- Start containers
- Run migrations
- Initialize database

### Step 3: Configure Nginx

```bash
# Still on staging server
# Copy nginx config
sudo cp nginx-lms.conf /etc/nginx/sites-available/lms

# Enable the site
sudo ln -s /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/lms

# Test nginx
sudo nginx -t

# Set up SSL with Let's Encrypt
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d lms.khaz.app -d www.lms.khaz.app

# Reload nginx
sudo systemctl reload nginx
```

### Step 4: Verify Everything Works

```bash
# Test from your local machine

# 1. Frontend
curl https://lms.khaz.app

# 2. API
curl https://lms.khaz.app/api/v1/health/

# 3. Admin
curl https://lms.khaz.app/admin/

# 4. Open in browser
# Frontend: https://lms.khaz.app
# API Docs: https://lms.khaz.app/api/v1/swagger/
# Admin: https://lms.khaz.app/admin/
```

---

## 📊 Expected Results After Deployment

### Docker Containers Running ✅
```
NAME              STATUS              PORTS
lms_redis         Up 2 minutes        
lms_postgres      Up 2 minutes        5432/tcp
lms_backend       Up 1 minute         0.0.0.0:8001->8001/tcp
lms_frontend      Up 1 minute         0.0.0.0:5174->5173/tcp
```

### Project Structure on Staging ✅
```
/var/www/html/lms/
├── backend/
├── frontend/
├── docker-compose.yml
├── .env (with secrets)
├── nginx-lms.conf
└── setup-staging.sh
```

### Both Projects Working ✅
- **kms.khaz.app** - KMS project (existing, unchanged)
- **lms.khaz.app** - LMS project (newly deployed)

### Web Access ✅
| URL | Expected Response |
|-----|-------------------|
| https://lms.khaz.app | React app loads |
| https://lms.khaz.app/api/v1/health/ | `{"status": "ok"}` |
| https://lms.khaz.app/api/v1/swagger/ | API documentation |
| https://lms.khaz.app/admin/ | Django admin login |
| https://kms.khaz.app | KMS app still works |

---

## ⚠️ Important Notes

### Security
- All database credentials are generated automatically and stored in `.env`
- `.env` file has restricted permissions (600)
- Backups are created before deployment
- SSL certificates managed by Let's Encrypt via Nginx

### Database
- PostgreSQL runs in Docker container
- Database name: `lmsdb_staging`
- User: `lms_user_staging`
- Accessible via hostname: `postgres:5432`

### Redis
- Redis runs in Docker container
- Port: 6381 (different from default to avoid conflicts)
- Accessible via hostname: `redis:6381`

### Nginx
- Reverse proxies requests from `lms.khaz.app`
- Forwards to Docker containers internally
- Handles SSL/HTTPS
- Logs at: `/var/log/nginx/lms_*.log`

### Docker
- All containers run on `lms_network` bridge
- Containers don't expose ports directly (only via Nginx)
- Volumes: `redis_data`, `media_files`, `static_files`, `backend_logs`

---

## 🔍 Troubleshooting Quick Links

### Issue: Cannot SSH to server
```bash
# On your local machine
ssh -i c:\Users\khair\khaz root@165.245.191.216 -vvv
# The -vvv shows verbose debugging output
```

### Issue: Deploy script fails
```bash
# Run with verbose output
.\deploy-to-staging.ps1 -Mode update-with-data-copy -Verbose

# Check detailed error messages
```

### Issue: Setup script fails
```bash
# Check if in correct directory
cd /var/www/html/lms
pwd  # Should show /var/www/html/lms

# Check Docker
docker-compose ps
docker-compose logs -f
```

### Issue: 502 Bad Gateway from Nginx
```bash
# On staging server
docker-compose logs backend
docker-compose ps

# Restart Docker containers
docker-compose restart
```

### Issue: Static files not loading
```bash
# On staging server
docker-compose exec backend python manage.py collectstatic --noinput --clear
docker-compose restart backend
```

---

## 📝 Next Steps

1. **Review this checklist** ← You are here
2. **Run the deployment script** from your local PowerShell
3. **SSH to staging server** and run `bash setup-staging.sh`
4. **Configure Nginx** with SSL certificates
5. **Verify deployment** by testing endpoints
6. **Test both projects** (KMS and LMS)
7. **Celebrate! 🎉**

---

## 🎓 What Happens During Deployment

### Phase 1: File Sync (PowerShell Script)
1. Tests SSH connection to staging server
2. Backs up remote database
3. Creates tarball of project (excludes: node_modules, venv, __pycache__)
4. Uploads tarball to staging server
5. Extracts files to `/var/www/html/lms`

### Phase 2: Docker Setup (setup-staging.sh)
1. Generates secure secrets (SECRET_KEY, DB_PASSWORD, REDIS_PASSWORD)
2. Creates .env file with all configuration
3. Builds Docker images for backend, frontend, database, Redis
4. Starts all containers
5. Waits for services to be ready

### Phase 3: Database Initialization
1. Runs Django migrations
2. Creates default data
3. Collects static files
4. Sets up admin user

### Phase 4: Nginx Configuration (Manual)
1. Copy nginx config to sites-available
2. Enable site with symlink
3. Get SSL certificate with Let's Encrypt
4. Reload Nginx

---

## ✅ Final Verification

After all steps complete, verify:

```bash
# From your local machine

# 1. Check LMS is accessible
curl -I https://lms.khaz.app/

# 2. Check KMS still works (shouldn't be affected)
curl -I https://kms.khaz.app/

# 3. Check API
curl https://lms.khaz.app/api/v1/health/

# 4. Check SSL certificate
curl -v https://lms.khaz.app 2>&1 | grep -i "ssl\|tls\|certificate"
```

---

**Status**: ✅ Ready for Deployment  
**Last Updated**: May 19, 2026  
**Project Path**: `/var/www/html/lms`  
**Domain**: `lms.khaz.app`
