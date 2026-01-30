# Production Deployment Simulation - Complete Setup Guide

## Overview

This guide shows how to simulate **production deployment** of LMSetjen DPD RI where:
- **PostgreSQL** runs on the HOST machine (port 5432) - NOT in Docker
- **Apache** is the reverse proxy (production server) - NOT Nginx in Docker
- **Backend & Frontend** run in Docker but connect to host services

---

## Quick Start

### 1. Ensure Host PostgreSQL is Running

**Windows:**
```powershell
# Check PostgreSQL service
Get-Service -Name "PostgreSQL*" | Select-Object Name, Status

# Start PostgreSQL if not running
Start-Service PostgreSQL-x64-15

# Verify connection
psql -U postgres -d postgres -c "SELECT version();"
```

**Mac/Linux:**
```bash
brew services start postgresql
# Or
sudo systemctl start postgresql

# Verify
pg_isready
```

### 2. Setup Production Environment

Copy the production environment file:

```bash
cd "D:\Project\LMSetjen DPD RI"
copy .env.prod.local .env
```

Or manually create `.env`:

```env
# Django  
SECRET_KEY=django-insecure-your-secret-key
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1

# Database - HOST PostgreSQL
DB_NAME=lmsdb
DB_USER=postgres
DB_PASSWORD=Okkdpdri2026
DB_HOST=host.docker.internal    # Windows/Mac Docker hostname
DB_PORT=5432

# Redis - Docker container
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_URL=redis://:redis_password@redis:6379/0

# URLs
FRONTEND_SITE_URL=http://localhost:3000
BACKEND_SITE_URL=http://localhost:9000
VITE_API_BASE_URL=/api
```

### 3. Start Production Simulation

```bash
# Stop any existing containers
docker-compose down

# Start production configuration
docker-compose -f docker-compose.production.yml up -d

# Watch logs
docker-compose -f docker-compose.production.yml logs -f backend
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:9000

---

## What's Different from Development

### Development Setup (Original docker-compose.yml)
```
┌──────────────────────────────┐
│   Your Computer              │
├──────────────────────────────┤
│ Docker:                      │
│  ├─ PostgreSQL (5433)  ✅    │
│  ├─ Redis (6380)       ✅    │
│  ├─ Backend (9000)     ✅    │
│  ├─ Frontend (3000)    ✅    │
│  └─ Nginx (proxy)      ✅    │
└──────────────────────────────┘
```

### Production Simulation (docker-compose.production.yml)
```
┌──────────────────────────────┐
│   Your Computer              │
├──────────────────────────────┤
│ PostgreSQL:5432 (HOST) ✅    │
│                              │
│ Docker:                      │
│  ├─ Redis (6380)       ✅    │
│  ├─ Backend (9000)     ✅    │
│  └─ Frontend (3000)    ✅    │
│                              │
│ NO Nginx (uses direct) ✅    │
└──────────────────────────────┘
```

### Real Production Server
```
┌──────────────────────────────┐
│   Production Server          │
├──────────────────────────────┤
│ PostgreSQL:5432 (HOST) ✅    │
│ Apache (reverse proxy) ✅    │
│                              │
│ Docker:                      │
│  ├─ Backend:8000       ✅    │
│  ├─ Frontend:5000      ✅    │
│  └─ Redis:6379         ✅    │
└──────────────────────────────┘
```

---

## Files Created

1. **docker-compose.production.yml**
   - Removes PostgreSQL service (uses HOST)
   - Removes Nginx (frontend runs directly)
   - Keeps Redis for caching
   - Connects backend to host PostgreSQL

2. **.env.production**
   - Database: host.docker.internal (Windows/Mac) or localhost (Linux)
   - Credentials: postgres / Okkdpdri2026
   - No hardcoded values

3. **PRODUCTION_SIMULATION_GUIDE.md**
   - Detailed setup instructions
   - Troubleshooting guide
   - Verification steps

4. **setup-production-local.ps1**
   - Windows PowerShell setup script
   - One-command initialization

5. **setup-production-local.sh**
   - Mac/Linux bash setup script
   - One-command initialization

---

## Detailed Configuration

### docker-compose.production.yml Structure

**Services:**
- **redis** - Docker container for caching (localhost:6380)
- **backend** - Django API server (localhost:9000 external, :8000 internal)
- **frontend** - React app with simple HTTP server (localhost:3000 external, :80 internal)

**Key Differences:**
- NO `postgres` service
- Backend uses `host.docker.internal` to access host PostgreSQL
- Frontend uses lightweight Node.js `serve` instead of Nginx
- No Nginx service for proxying

**Environment Variables:**
```yaml
backend:
  environment:
    # These come from .env file
    DB_HOST: ${DB_HOST:-host.docker.internal}
    DB_PORT: ${DB_PORT:-5432}
    DB_USER: ${DB_USER:-postgres}
    DB_PASSWORD: ${DB_PASSWORD:-Okkdpdri2026}
```

---

## Database Connection Details

### From Docker Container to Host PostgreSQL

**Windows/Mac:**
Use `host.docker.internal` as the hostname in Docker containers to reach the host machine.

```python
# Django settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': 'host.docker.internal',  # Special Docker hostname
        'PORT': '5432',
        'NAME': 'lmsdb',
        'USER': 'postgres',
        'PASSWORD': 'Okkdpdri2026',
    }
}
```

**Linux:**
Use the actual IP address or `gateway.docker.internal` (requires Docker configuration).

---

## Testing the Setup

### 1. Verify PostgreSQL Connection

```bash
# From your machine
psql -U postgres -h localhost -d postgres -c "SELECT version();"

# From within backend container
docker-compose -f docker-compose.production.yml exec backend bash
# Inside container:
psql -U postgres -h host.docker.internal -d postgres -c "SELECT version();"
```

### 2. Check Backend Logs

```bash
docker-compose -f docker-compose.production.yml logs -f backend

# Look for:
# - "Waiting for database..."
# - "Running migrations..."
# - "Starting Gunicorn server..."
```

### 3. Test API Health

```bash
# Should return: {"status": "healthy"}
curl http://localhost:9000/api/v1/health/
```

### 4. Test Frontend

```bash
# Browser or curl
curl http://localhost:3000/

# Should return HTML
```

### 5. Verify Database Migrations

```bash
docker-compose -f docker-compose.production.yml exec backend python manage.py showmigrations

# Should show all migrations as completed with [X]
```

---

## Useful Commands

### Container Management

```bash
# Start services
docker-compose -f docker-compose.production.yml up -d

# Stop services
docker-compose -f docker-compose.production.yml down

# View running services
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f backend
docker-compose -f docker-compose.production.yml logs -f frontend
docker-compose -f docker-compose.production.yml logs -f redis

# Enter container shell
docker-compose -f docker-compose.production.yml exec backend bash
```

### Django Management

```bash
# Run Django command
docker-compose -f docker-compose.production.yml exec backend python manage.py createsuperuser

# Database shell
docker-compose -f docker-compose.production.yml exec backend python manage.py dbshell

# Check migrations
docker-compose -f docker-compose.production.yml exec backend python manage.py showmigrations
```

---

## Troubleshooting

### Issue: Cannot Connect to PostgreSQL

**Error**: `psycopg2.OperationalError: could not connect to server`

**Solution**:
1. Check PostgreSQL is running:
   ```bash
   psql -U postgres -d postgres -c "SELECT 1"
   ```

2. Check credentials in .env match PostgreSQL setup

3. For Linux, update daemon.json and use correct hostname

### Issue: Port Already in Use

**Error**: `bind: address already in use`

**Solution**:
```bash
# Stop existing containers
docker-compose -f docker-compose.production.yml down

# Or change ports in docker-compose.production.yml:
# ports:
#   - "9001:8000"  # Use 9001 instead
#   - "3001:80"    # Use 3001 instead
```

### Issue: Frontend Cannot Reach Backend API

**Error**: `Failed to fetch http://localhost:9000/api/...`

**Solution**:
1. Ensure backend is healthy: `docker-compose ps`
2. Test directly: `curl http://localhost:9000/api/v1/health/`
3. Check VITE_API_BASE_URL in .env is `/api`

### Issue: Static Files Not Loading

**Error**: 404 for `/static/...` files

**Solution**:
```bash
# Rebuild frontend
docker-compose -f docker-compose.production.yml build frontend

# Or collect static files manually
docker-compose -f docker-compose.production.yml exec backend python manage.py collectstatic --noinput
```

---

## Production Server Deployment

When deploying to actual production server:

### 1. Update docker-compose.production.yml

```yaml
# Change DB_HOST from host.docker.internal to localhost
backend:
  environment:
    DB_HOST: localhost  # On production server
```

### 2. Configure Apache VirtualHost

```apache
<VirtualHost *:80>
    ServerName lmsetjen.example.com
    
    # Frontend proxy
    <Location />
        ProxyPass http://localhost:5000/
        ProxyPassReverse http://localhost:5000/
    </Location>
    
    # Backend API proxy
    <Location /api>
        ProxyPass http://localhost:8000/
        ProxyPassReverse http://localhost:8000/
    </Location>
    
    # Enable HTTPS redirect
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</VirtualHost>

<VirtualHost *:443>
    ServerName lmsetjen.example.com
    
    # SSL certificates
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/lmsetjen.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/lmsetjen.example.com/privkey.pem
    
    # Proxies same as above...
</VirtualHost>
```

### 3. Environment Variables

Update `.env` for production:

```env
SECRET_KEY=your-very-secure-random-key
DEBUG=False
ALLOWED_HOSTS=lmsetjen.example.com,www.lmsetjen.example.com
DB_HOST=localhost
DB_PASSWORD=your-actual-db-password
```

### 4. Start on Production

```bash
docker-compose -f docker-compose.production.yml up -d
```

---

## Monitoring and Maintenance

### Check Service Health

```bash
docker-compose -f docker-compose.production.yml ps
```

### View Logs

```bash
# Follow logs in real-time
docker-compose -f docker-compose.production.yml logs -f

# View specific service
docker-compose -f docker-compose.production.yml logs -f backend

# View only errors
docker-compose -f docker-compose.production.yml logs backend | grep -i error
```

### Backup Database

```bash
docker-compose -f docker-compose.production.yml exec backend pg_dump -U postgres lmsdb > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Database Cleanup

```bash
# Remove old media files
docker-compose -f docker-compose.production.yml exec backend python manage.py cleanupmedia

# Clear cache
docker-compose -f docker-compose.production.yml exec redis redis-cli FLUSHALL
```

---

## Summary

This production simulation allows you to:

✅ Test your application without modifying settings  
✅ Use external PostgreSQL (like production)  
✅ Remove Nginx dependency (like production with Apache)  
✅ Verify Docker containers work correctly  
✅ Prepare for actual production deployment  

All changes are isolated - your development setup remains unchanged!

---

**Created**: January 30, 2026  
**Version**: 1.0  
**Status**: Ready for Local Testing
