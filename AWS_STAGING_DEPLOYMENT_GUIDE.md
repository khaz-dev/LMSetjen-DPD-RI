# AWS Staging Deployment Guide - LMSetjen DPD RI

**Date**: November 26, 2025  
**Server**: AWS EC2 (Ubuntu 20.04 LTS)  
**New IP**: 43.218.109.238  
**Domain**: https://lmsetjendpdri.duckdns.org  
**Status**: Ready for Deployment

---

## 🎯 Quick Summary

Your LMS is a **Docker-based full-stack application**:
- **Backend**: Django 4.2 REST API (port 8000)
- **Frontend**: React 18 SPA (nginx proxy on port 80/443)
- **Database**: PostgreSQL 15 (port 5432, internal only)
- **Cache**: Redis 7 (port 6379, internal only)
- **Proxy**: Nginx reverse proxy serving both frontend and backend

### Architecture
```
Internet (https://lmsetjendpdri.duckdns.org)
    ↓
Nginx (Port 80/443) - Reverse Proxy
    ├─→ /api/* → Django Backend (8000)
    ├─→ /static/* → Nginx serves static files
    ├─→ /media/* → Nginx serves media files
    └─→ /* → React Frontend (compiled SPA)
        ├─→ PostgreSQL (5432, internal Docker network)
        └─→ Redis (6379, internal Docker network)
```

---

## 🔴 Current Issue: "Connection Refused"

**Cause**: The old server IP (16.79.83.21) is in your system but DuckDNS hasn't been updated with the new IP (43.218.109.238).

**Solution Steps**:

### Step 1: Update DuckDNS with New IP

1. Go to https://www.duckdns.org
2. Login with your credentials
3. Find your "lmsetjendpdri" domain
4. Change the IP address to: **43.218.109.238**
5. Click "Update" button
6. Wait 5-10 minutes for DNS propagation

**Verify DNS Update**:
```bash
# Run this command to check DNS resolution
nslookup lmsetjendpdri.duckdns.org
# Should show: 43.218.109.238
```

### Step 2: Update Django ALLOWED_HOSTS

Edit `backend/backend/settings.py`:

```python
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[
    'localhost',
    '127.0.0.1',
    'testserver',
    '43.218.109.238',  # ← Update from old IP to new IP
    'lmsetjendpdri.duckdns.org',
    '.onrender.com',
    '.railway.app',
    '.vercel.app'
])
```

### Step 3: Deploy to Server

---

## 📋 Complete Deployment Steps

### Step 1: Connect to Server via SSH

```bash
ssh -i "D:\Project\lms-server-key.pem" ubuntu@43.218.109.238
```

### Step 2: Check Server Status

```bash
# Check if Docker is running
docker --version
docker ps

# Check if application is running
docker-compose -f ~/lmsetjen-app/docker-compose.yml ps

# Check logs
docker-compose -f ~/lmsetjen-app/docker-compose.yml logs -f backend
```

### Step 3: Update Code on Server

```bash
cd ~/lmsetjen-app
git pull origin main
```

### Step 4: Create/Update .env File

```bash
# Create production .env
cat > .env << 'EOF'
# Django
SECRET_KEY=your-super-secret-key-here-use-strong-random-value
DEBUG=False
DJANGO_LOG_LEVEL=INFO

# Database
DB_NAME=lms_prod_db
DB_USER=lms_prod_user
DB_PASSWORD=use_a_strong_random_password_here
DB_HOST=postgres
DB_PORT=5432

# Redis
REDIS_PASSWORD=use_another_strong_random_password_here
REDIS_HOST=redis
REDIS_PORT=6379

# Allowed Hosts (CRITICAL!)
ALLOWED_HOSTS=localhost,127.0.0.1,43.218.109.238,lmsetjendpdri.duckdns.org,www.lmsetjendpdri.duckdns.org

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://43.218.109.238,https://lmsetjendpdri.duckdns.org,https://www.lmsetjendpdri.duckdns.org

# Site URLs
FRONTEND_SITE_URL=https://lmsetjendpdri.duckdns.org
BACKEND_SITE_URL=https://lmsetjendpdri.duckdns.org

# Email
SENDGRID_API_KEY=your-sendgrid-key-here
FROM_EMAIL=noreply@lmsetjendpdri.duckdns.org

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=7
EOF
```

### Step 5: Build and Deploy

```bash
# Build Docker images
docker-compose build

# Start all services
docker-compose up -d

# Wait for database
sleep 30

# Run migrations
docker-compose exec -T backend python manage.py migrate --noinput

# Collect static files
docker-compose exec -T backend python manage.py collectstatic --noinput --clear

# Check status
docker-compose ps
```

### Step 6: Setup SSL with Let's Encrypt

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot certbot certonly --standalone \
    -d lmsetjendpdri.duckdns.org \
    -d www.lmsetjendpdri.duckdns.org \
    --non-interactive --agree-tos --email admin@lmsetjendpdri.duckdns.org

# Restart containers to apply SSL
docker-compose restart frontend
```

### Step 7: Verify Everything Works

```bash
# Check containers are running
docker-compose ps
# Output should show all services UP and healthy

# Check backend API
curl http://localhost:8000/api/v1/health/
# Should return: {"status": "ok"}

# Check frontend health
curl http://localhost/health
# Should return: healthy

# Check domain (from local machine)
curl -I https://lmsetjendpdri.duckdns.org
# Should return: HTTP/1.1 200 OK with SSL certificate
```

---

## 🔧 Troubleshooting

### Issue: "Connection Refused" on Domain

**Symptoms**:
```
ERR_CONNECTION_REFUSED
```

**Causes & Solutions**:

1. **DNS not updated**:
   ```bash
   # Check DNS
   nslookup lmsetjendpdri.duckdns.org
   # If not showing 43.218.109.238, update DuckDNS
   ```

2. **Containers not running**:
   ```bash
   # Check status
   docker-compose ps
   
   # If showing "Exit" or "Exited", restart
   docker-compose restart
   
   # Check logs for errors
   docker-compose logs backend | tail -50
   docker-compose logs frontend | tail -50
   ```

3. **Nginx not listening on ports**:
   ```bash
   # Check if ports are open
   sudo netstat -tuln | grep LISTEN
   # Should show ports 80 and 443 listening
   ```

4. **Firewall blocking ports**:
   ```bash
   # Check AWS security group allows ports 80 and 443
   # Go to EC2 Dashboard → Security Groups → Check inbound rules
   # Should allow:
   # - Port 80 (HTTP) from 0.0.0.0/0
   # - Port 443 (HTTPS) from 0.0.0.0/0
   ```

### Issue: API Errors (500 Internal Server Error)

**Solution**:
```bash
# Check backend logs
docker-compose logs backend

# Common fixes:
# 1. Run migrations again
docker-compose exec -T backend python manage.py migrate

# 2. Collect static files
docker-compose exec -T backend python manage.py collectstatic --noinput

# 3. Restart backend
docker-compose restart backend
```

### Issue: Frontend Not Loading (Blank Page)

**Solution**:
```bash
# Check frontend logs
docker-compose logs frontend

# Verify nginx config
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf | grep -A5 location

# Rebuild frontend
docker-compose build frontend
docker-compose restart frontend
```

### Issue: Database Connection Error

**Solution**:
```bash
# Check PostgreSQL is running
docker-compose ps | grep postgres

# Check database connection
docker-compose exec -T backend python manage.py dbshell

# If fails, restart database
docker-compose restart postgres
sleep 30
docker-compose up -d
```

### Issue: SSL Certificate Error

**Solution**:
```bash
# Check certificate exists
sudo ls -la /etc/letsencrypt/live/lmsetjendpdri.duckdns.org/

# If not, regenerate
sudo certbot certonly --standalone \
    -d lmsetjendpdri.duckdns.org \
    --non-interactive --agree-tos --email admin@example.com

# Restart nginx
docker-compose restart frontend
```

---

## 📊 Monitoring & Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend    # Django logs
docker-compose logs -f frontend   # Nginx logs
docker-compose logs -f postgres   # Database logs
docker-compose logs -f redis      # Cache logs

# Last N lines
docker-compose logs --tail=50 backend
```

### Check Container Health

```bash
# Overall status
docker-compose ps

# Detailed health
docker inspect lms_backend | grep -A10 "Health"

# Real-time stats
docker stats
```

### Access Django Admin

```bash
# URL (after deployment)
https://lmsetjendpdri.duckdns.org/admin

# Create superuser
docker-compose exec -T backend python manage.py createsuperuser
```

---

## 🔐 Security Checklist

- [ ] Update DuckDNS with new IP (43.218.109.238)
- [ ] Update Django ALLOWED_HOSTS to include new IP and domain
- [ ] Generate strong SECRET_KEY for production
- [ ] Use strong database password
- [ ] Use strong Redis password
- [ ] Setup SSL certificate (Let's Encrypt)
- [ ] Configure AWS security groups to allow only needed ports
- [ ] Backup database regularly
- [ ] Monitor logs for suspicious activity

---

## 📝 File Locations

On server (`~/lmsetjen-app/`):

```
├── .env                           # Production environment variables
├── docker-compose.yml             # Docker services configuration
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── backend/settings.py        # Django configuration
│   └── Dockerfile
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── docker/
│   ├── nginx/conf.d/default.conf  # Nginx configuration
│   └── postgres/init.sql
└── scripts/
    └── deploy-ssl.sh
```

---

## 🚀 Quick Command Reference

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View status
docker-compose ps

# View logs
docker-compose logs -f

# Rebuild and restart
docker-compose build
docker-compose up -d

# Run Django commands
docker-compose exec -T backend python manage.py [command]

# Access database
docker-compose exec postgres psql -U lms_prod_user -d lms_prod_db

# Create superuser
docker-compose exec -T backend python manage.py createsuperuser

# Migrate database
docker-compose exec -T backend python manage.py migrate

# Collect static
docker-compose exec -T backend python manage.py collectstatic --noinput

# Check if running on new IP
curl -I http://43.218.109.238
```

---

## ✅ Final Verification Checklist

After deployment, verify:

- [ ] Domain resolves: `nslookup lmsetjendpdri.duckdns.org` → 43.218.109.238
- [ ] HTTPS works: `curl -I https://lmsetjendpdri.duckdns.org` → 200 OK
- [ ] API responds: `curl https://lmsetjendpdri.duckdns.org/api/v1/health/` → ok
- [ ] Frontend loads: Browser → https://lmsetjendpdri.duckdns.org
- [ ] Admin panel: https://lmsetjendpdri.duckdns.org/admin
- [ ] SSL certificate valid: Check browser SSL indicator
- [ ] Containers healthy: `docker-compose ps` → all UP
- [ ] No error logs: `docker-compose logs | grep -i error`

---

## 📞 Support

If you encounter issues:

1. Check the logs: `docker-compose logs -f`
2. Verify containers are running: `docker-compose ps`
3. Verify DNS resolution: `nslookup lmsetjendpdri.duckdns.org`
4. Check AWS security groups allow ports 80/443
5. Restart services: `docker-compose restart`

---

**Deployment Guide Complete!** 🎉

Good luck with your deployment! 🚀
