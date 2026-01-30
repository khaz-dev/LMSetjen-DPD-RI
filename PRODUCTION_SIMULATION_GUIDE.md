# Production Deployment Simulation Guide

## Overview

This guide helps you simulate the **production deployment** of LMSetjen DPD RI on your local machine without Docker PostgreSQL or Nginx.

### Production Server Setup (Target)
- **PostgreSQL**: Already running on host machine (port 5432)
  - Username: `postgres`
  - Password: `Okkdpdri2026`
- **Apache**: Used as reverse proxy (not Nginx)
- **Backend**: Direct access on port 9000
- **Frontend**: Direct access on port 3000

---

## Step 1: Verify Host PostgreSQL Setup

### Windows - Check if PostgreSQL is running

```powershell
# Check if PostgreSQL service is running
Get-Service -Name postgres* | Select-Object Name, Status

# Or connect to PostgreSQL
psql -U postgres -d postgres -c "SELECT version();"
```

If not running:
```powershell
# Start PostgreSQL service
Start-Service PostgreSQL-x64-15
```

### Verify Connection

```bash
# Test connection
psql -h localhost -U postgres -d postgres -c "SELECT version();"
```

---

## Step 2: Set Up Environment Variables

Create `.env` in project root with production settings:

```env
# Django
SECRET_KEY=django-insecure-change-this-in-production
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com

# URLs
FRONTEND_SITE_URL=http://localhost:3000
BACKEND_SITE_URL=http://localhost:9000

# PostgreSQL on HOST (not Docker)
DB_ENGINE=django.db.backends.postgresql
DB_NAME=lmsdb
DB_USER=postgres
DB_PASSWORD=Okkdpdri2026
DB_HOST=host.docker.internal
DB_PORT=5432

# Redis in Docker
REDIS_URL=redis://:redis_password@redis:6379/0
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Email & OAuth
SENDGRID_API_KEY=your-key
FROM_EMAIL=noreply@example.com
GOOGLE_CLIENT_ID=your-id
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/login

# Logging
DJANGO_LOG_LEVEL=INFO
VITE_API_BASE_URL=/api
```

---

## Step 3: Start Production-Like Deployment

```bash
cd "D:\Project\LMSetjen DPD RI"

# Stop any existing containers
docker-compose down

# Start with production configuration
docker-compose -f docker-compose.production.yml up -d

# Watch logs
docker-compose -f docker-compose.production.yml logs -f
```

---

## Step 4: Verify Deployment

### Check Services Status

```bash
# List running containers
docker-compose -f docker-compose.production.yml ps
```

### Test Backend

```bash
curl http://localhost:9000/api/v1/health/
```

### Test Frontend

```bash
# Browser: http://localhost:3000
curl http://localhost:3000/
```

---

## Step 5: Monitor and Debug

```bash
# Backend logs
docker-compose -f docker-compose.production.yml logs -f backend

# Check database connection
docker-compose -f docker-compose.production.yml exec backend python manage.py dbshell
```

---

## Troubleshooting

### Cannot Connect to PostgreSQL

**Solution**: Ensure PostgreSQL is running on localhost:5432

```powershell
# Windows
Start-Service PostgreSQL-x64-15

# Verify
psql -U postgres -d postgres -c "SELECT 1"
```

### Port Already in Use

```bash
# Stop containers
docker-compose down

# Or change ports in docker-compose.production.yml
```

### Static Files Not Found

```bash
# Rebuild frontend
docker-compose -f docker-compose.production.yml build frontend
```

---

## Key Differences

### This Simulation (No Postgres/Nginx in Docker)

```
PostgreSQL:5432 (HOST) ✅
Docker:
  ├─ Backend:9000
  ├─ Frontend:3000
  └─ Redis:6380
No Nginx ✅
```

### Production Setup (Same as Simulation)

```
PostgreSQL:5432 (HOST) ✅
Docker:
  ├─ Backend:8000
  ├─ Frontend:5000
  └─ Redis:6379
Apache Proxy ✅
```

---

Next: Test thoroughly, then deploy to production! 🚀
