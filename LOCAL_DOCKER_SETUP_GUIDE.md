# 🐳 LMSetjen DPD RI - Local Docker Setup Guide

**Complete Guide for Running the Full Stack on Local Docker**

---

## 📋 Table of Contents
1. [System Requirements](#-system-requirements)
2. [Project Architecture Overview](#-project-architecture-overview)
3. [Pre-Setup Checklist](#-pre-setup-checklist)
4. [Environment Configuration](#-environment-configuration)
5. [Docker Startup Procedure](#-docker-startup-procedure)
6. [Verification & Testing](#-verification--testing)
7. [Common Issues & Troubleshooting](#-common-issues--troubleshooting)
8. [Database Management](#-database-management)
9. [Useful Docker Commands](#-useful-docker-commands)
10. [Performance Optimization](#-performance-optimization)

---

## 💻 System Requirements

### Minimum Requirements
- **Docker Desktop**: 4.0+ (Windows/macOS) or Docker Engine 20.0+ (Linux)
- **Docker Compose**: 2.0+
- **Disk Space**: 20GB (images + volumes)
- **RAM**: 8GB minimum, 16GB recommended
- **CPU**: 4+ cores recommended

### Installation
- **Windows**: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
- **macOS**: [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
- **Linux**: [Docker Engine](https://docs.docker.com/engine/install/)

**Verify Installation:**
```bash
docker --version
docker-compose --version
docker ps  # Should show no errors
```

---

## 🏗️ Project Architecture Overview

### Services Deployed
```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network: lms_network               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Frontend   │  │   Backend    │  │  PostgreSQL  │      │
│  │   (nginx)    │  │  (gunicorn)  │  │   (DB)       │      │
│  │  :80, :443   │  │   :8000      │  │   :5432      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ▲                  ▲                  ▲              │
│         │ requests         │ API calls        │ migrations  │
│         └──────────────────┴──────────────────┘             │
│                                                              │
│  ┌──────────────┐                                           │
│  │    Redis     │  Cache & Session Store                   │
│  │   :6379      │                                           │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Volumes:
├── postgres_data      → PostgreSQL database files
├── redis_data        → Redis persistence
├── media_files       → User uploads (shared with nginx)
├── static_files      → Django static files (shared with nginx)
└── backend_logs      → Application logs
```

### Tech Stack Summary
- **Frontend**: React 18 + Vite + Bootstrap 5
- **Backend**: Django 4.2 + DRF + PostgreSQL
- **Cache**: Redis 7
- **Web Server**: nginx 1.25
- **Database**: PostgreSQL 15

---

## ✅ Pre-Setup Checklist

- [ ] Docker Desktop running (check system tray)
- [ ] No services running on ports: 80, 443, 8000, 5432, 6379
- [ ] 20GB free disk space available
- [ ] `.env` file exists in project root
- [ ] Project cloned with Git
- [ ] Node.js environment (backend independent)

**Check Port Availability** (Linux/macOS):
```bash
netstat -tuln | grep -E ':(80|443|8000|5432|6379)'
# Should return nothing if ports are free
```

**Check Port Availability** (Windows PowerShell):
```powershell
Get-NetTCPConnection -State Listen | Select-Object LocalPort | findstr "80 443 8000 5432 6379"
# Should return nothing if ports are free
```

---

## 🔧 Environment Configuration

### Step 1: Verify `.env` File

The `.env` file in the project root is **critical**. Check it contains:

```dotenv
# Django Settings
SECRET_KEY=<your-secret-key>
DEBUG=False
DJANGO_LOG_LEVEL=INFO

# Database
DB_NAME=lms_db
DB_USER=lms_user
DB_PASSWORD=secure_password
DB_HOST=postgres
DB_PORT=5432

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=YqNYfeHpLMIk7x01YqqEje08jLgHjj3Y

# Allowed Hosts (LOCAL DEVELOPMENT)
ALLOWED_HOSTS=localhost,127.0.0.1,backend

# CORS Settings (LOCAL DEVELOPMENT)
CORS_ALLOWED_ORIGINS=http://localhost:80,http://localhost:3000,http://127.0.0.1

# Site URLs (LOCAL)
FRONTEND_SITE_URL=http://localhost
BACKEND_SITE_URL=http://localhost:8000

# Email (Optional for local testing)
SENDGRID_API_KEY=
FROM_EMAIL=noreply@localhost
```

### Step 2: Adjust for Local Development

If running on local network (other machines accessing):

```bash
# Get your machine IP
# Windows: ipconfig | findstr IPv4
# macOS/Linux: ifconfig | grep inet

# Update ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS
ALLOWED_HOSTS=localhost,127.0.0.1,backend,192.168.x.x
CORS_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://192.168.x.x
```

---

## 🚀 Docker Startup Procedure

### Option 1: Full Automated Startup (Recommended)

**Step 1: Clean Previous Containers** (if any)
```bash
cd "d:\Project\LMSetjen DPD RI"

# PowerShell
docker-compose down -v
```

**Step 2: Start All Services**
```bash
# Build and start everything in one command
docker-compose up -d

# This will:
# 1. Create lms_network
# 2. Create volumes (postgres_data, redis_data, etc.)
# 3. Start PostgreSQL (waits for health check)
# 4. Start Redis
# 5. Build and start Backend (runs migrations + init_db)
# 6. Build and start Frontend (builds React assets)
```

**Step 3: Monitor Startup**
```bash
# Watch logs in real-time
docker-compose logs -f

# Stop watching (press Ctrl+C)
```

**Step 4: Verify Services**
```bash
# Check running containers
docker ps

# Expected output:
# CONTAINER ID   IMAGE          STATUS
# <id>           lms_backend    Up 2 minutes
# <id>           lms_frontend   Up 1 minute
# <id>           lms_postgres   Up 3 minutes
# <id>           lms_redis      Up 3 minutes
```

### Option 2: Step-by-Step Startup (Debugging)

```bash
# Start database only
docker-compose up -d postgres
# Wait for health check: docker logs lms_postgres

# Start Redis
docker-compose up -d redis

# Start Backend
docker-compose up -d backend
# Monitor: docker logs -f lms_backend

# Start Frontend
docker-compose up -d frontend
# Monitor: docker logs -f lms_frontend
```

---

## 🧪 Verification & Testing

### 1. Check Backend API

```bash
# Direct curl (Linux/macOS)
curl -s http://localhost:8000/api/v1/healthz/ | jq

# PowerShell
Invoke-WebRequest -Uri http://localhost:8000/api/v1/healthz/ | ConvertTo-Json

# Expected response:
# {
#   "status": "ok",
#   "database": "connected",
#   "redis": "connected"
# }
```

### 2. Check Frontend

```bash
# Navigate to http://localhost in browser
# You should see the LMSetjen login page

# Check network tab in DevTools:
# - API calls should go to http://localhost:8000/api/
# - No 404 errors on static assets
```

### 3. Test Database Connection

```bash
# Enter PostgreSQL container
docker exec -it lms_postgres psql -U lms_user -d lms_db

# Inside psql:
\dt  # List tables (should show Django tables)
\q   # Exit
```

### 4. Test Redis Connection

```bash
# Enter Redis container
docker exec -it lms_redis redis-cli -a YqNYfeHpLMIk7x01YqqEje08jLgHjj3Y

# Inside redis-cli:
PING  # Should return PONG
KEYS * # Check stored keys
EXIT  # Exit
```

### 5. Create Test Admin User (If Needed)

```bash
# Inside backend container
docker exec -it lms_backend python manage.py createsuperuser

# Follow prompts:
# Username: admin
# Email: admin@localhost
# Password: <your-password>
# Superuser: y
```

---

## 🆘 Common Issues & Troubleshooting

### Issue 1: "Port Already in Use"
```
Error: bind: address already in use
```
**Solution:**
```bash
# Find what's using the port (Linux/macOS)
lsof -i :8000
lsof -i :80

# Kill the process
kill -9 <PID>

# OR change ports in docker-compose.yml:
# ports:
#   - "8001:8000"  # Use 8001 instead of 8000
```

### Issue 2: "Cannot connect to Docker daemon"
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```
**Solution:**
- Start Docker Desktop (macOS/Windows)
- For Linux: `sudo systemctl start docker`
- Or run: `sudo dockerd` in separate terminal

### Issue 3: "Out of memory"
```
ERROR: Could not write json...
```
**Solution:**
- Increase Docker Desktop RAM allocation
  - Windows/macOS: Docker Desktop → Settings → Resources → Memory (set to 8GB+)
- Or reduce container count

### Issue 4: Backend Container Exits Immediately
```
docker logs lms_backend
# Shows: ModuleNotFoundError or ImportError
```
**Solution:**
```bash
# Rebuild backend without cache
docker-compose build --no-cache backend

# Then restart
docker-compose up -d backend
```

### Issue 5: "Connection refused" to Database

```
psycopg2.OperationalError: could not connect to server
```
**Solution:**
```bash
# Check PostgreSQL is running
docker ps | grep lms_postgres

# Check logs
docker logs lms_postgres

# If not running, start it
docker-compose up -d postgres

# Wait for health check (up to 30 seconds)
docker-compose logs postgres
```

### Issue 6: Static Files Not Loading (nginx)

```
GET http://localhost/static/... 404 Not Found
```
**Solution:**
```bash
# Collect static files
docker exec -it lms_backend python manage.py collectstatic --noinput --clear

# Restart frontend
docker-compose restart frontend

# Check volume is mounted
docker inspect lms_frontend | grep -A 5 Mounts
```

### Issue 7: Frontend Showing Blank Page

```
JavaScript error in console
```
**Solution:**
```bash
# Check frontend logs
docker logs lms_frontend

# Rebuild frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend

# Clear browser cache (Ctrl+Shift+Delete)
```

### Issue 8: Redis Connection Failures

```
ConnectionError: Error -1 connecting to 127.0.0.1:6379
```
**Solution:**
```bash
# Check Redis password in .env matches docker-compose.yml
# REDIS_PASSWORD must be identical

# Restart Redis
docker-compose down redis
docker-compose up -d redis

# Test connection
docker exec lms_backend python -c "import redis; r = redis.from_url('redis://:YqNYfeHpLMIk7x01YqqEje08jLgHjj3Y@redis:6379/0'); print(r.ping())"
```

---

## 📊 Database Management

### Backup Database

```bash
# Create backup
docker exec lms_postgres pg_dump -U lms_user lms_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Check size
ls -lh backup_*.sql
```

### Restore Database

```bash
# Stop backend to avoid conflicts
docker-compose stop backend

# Restore from backup
docker exec -i lms_postgres psql -U lms_user lms_db < backup_20240129_143022.sql

# Start backend
docker-compose up -d backend
```

### Reset Database (⚠️ Warning: Deletes All Data)

```bash
# Remove PostgreSQL volume
docker-compose down postgres
docker volume rm lms_postgres_data

# Start fresh
docker-compose up -d postgres

# Backend will auto-migrate on startup
docker-compose up -d backend
```

### Run Django Migrations Manually

```bash
# Apply pending migrations
docker exec lms_backend python manage.py migrate

# Check migration status
docker exec lms_backend python manage.py showmigrations

# Rollback specific migration (if needed)
docker exec lms_backend python manage.py migrate api 0001_initial
```

---

## 🛠️ Useful Docker Commands

### Container Management
```bash
# Start all services
docker-compose up -d

# Stop all services (keeps data)
docker-compose stop

# Stop and remove containers (keeps volumes)
docker-compose down

# Stop everything and remove volumes (⚠️ DELETES DATA)
docker-compose down -v

# Restart specific service
docker-compose restart backend

# Rebuild specific service
docker-compose build backend
```

### Logging & Monitoring
```bash
# View logs for all services
docker-compose logs

# Follow logs (real-time)
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend

# Last 50 lines
docker-compose logs --tail 50 backend

# Search logs
docker-compose logs | grep "ERROR"
```

### Execute Commands in Containers
```bash
# Run Django shell
docker exec -it lms_backend python manage.py shell

# Run management command
docker exec lms_backend python manage.py <command>

# Get interactive bash
docker exec -it lms_backend /bin/bash

# Check disk usage
docker exec lms_backend du -sh /app
```

### Cleanup & Maintenance
```bash
# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Full cleanup (⚠️ aggressive)
docker system prune -a

# Check disk usage
docker system df
```

---

## ⚡ Performance Optimization

### 1. Enable Docker Resource Limits

Edit `docker-compose.yml`:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### 2. Redis Optimization

```bash
# Monitor Redis memory
docker exec lms_redis redis-cli -a <password> INFO memory

# Enable persistence (default)
# Redis already configured with `--appendonly yes`

# Check persistence file size
docker exec lms_redis ls -lh /data/
```

### 3. PostgreSQL Optimization

```bash
# Check connection count
docker exec lms_postgres psql -U lms_user -c "SELECT count(*) FROM pg_stat_activity;"

# Monitor slow queries (already logged)
docker logs lms_postgres | grep "duration:"
```

### 4. Frontend Build Optimization

The frontend build is already optimized with:
- Code splitting (chunks)
- Gzip compression
- Image optimization (prebuild)
- CSS minification

To see bundle stats:
```bash
docker exec lms_frontend cat dist/dist/index.html | grep -o "<script[^>]*src="
```

---

## 📝 Quick Reference Commands

| Task | Command |
|------|---------|
| Start all services | `docker-compose up -d` |
| Stop all services | `docker-compose down` |
| View logs | `docker-compose logs -f backend` |
| Enter backend shell | `docker exec -it lms_backend bash` |
| Create superuser | `docker exec -it lms_backend python manage.py createsuperuser` |
| Run migrations | `docker exec lms_backend python manage.py migrate` |
| Backup database | `docker exec lms_postgres pg_dump -U lms_user lms_db > backup.sql` |
| Check container status | `docker ps` |
| Remove all containers | `docker-compose down -v` |
| Rebuild frontend | `docker-compose build --no-cache frontend` |
| Check API health | `curl http://localhost:8000/api/v1/healthz/` |

---

## 🎯 Next Steps After Startup

1. **Access Application**
   - Frontend: http://localhost
   - Admin: http://localhost/admin/ (if superuser created)

2. **Verify Database**
   ```bash
   docker exec lms_backend python manage.py showmigrations
   ```

3. **Test API Endpoints**
   ```bash
   curl http://localhost:8000/api/v1/course/course-list/
   ```

4. **Monitor Performance**
   ```bash
   docker stats
   ```

5. **Set Up IDE Debugger** (Optional)
   - Connect to backend container on port 5678 (pdb)
   - Or use `docker exec -it lms_backend python manage.py shell`

---

## 📞 Support & Documentation

- **Docker Documentation**: https://docs.docker.com
- **Docker Compose Ref**: https://docs.docker.com/compose/compose-file/
- **Django Documentation**: https://docs.djangoproject.com/en/4.2/
- **React Documentation**: https://react.dev
- **PostgreSQL Docs**: https://www.postgresql.org/docs/15/

---

## ✅ Completion Checklist

- [ ] Docker Desktop installed and running
- [ ] All ports 80, 443, 8000, 5432, 6379 are free
- [ ] `.env` file configured correctly
- [ ] `docker-compose up -d` runs without errors
- [ ] All 4 containers show as "Up" in `docker ps`
- [ ] Frontend loads at http://localhost
- [ ] Backend API responds at http://localhost:8000/api/v1/healthz/
- [ ] Database tables created (checked with psql)
- [ ] Redis connected (checked with redis-cli)
- [ ] Admin user created (if needed)

---

**Last Updated**: January 29, 2026  
**Project**: LMSetjen DPD RI v2.0  
**Status**: ✅ Production-Ready Docker Setup

