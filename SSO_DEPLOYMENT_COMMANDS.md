# SSO Production Deployment - Command Reference

## Quick Copy-Paste Commands for Deployment

### Prerequisites
```bash
# SSH to production server
ssh your-user@16.79.83.21

# Navigate to project
cd /path/to/LMSetjen-DPD-RI

# Verify you're in the right place
pwd
ls -la docker-compose.yml
```

---

## 1️⃣ BACKUP (Do This First!)
```bash
# Create timestamped backup
docker-compose exec postgres pg_dump -U lms_user django_lms_db > backup_production_$(date +%Y%m%d_%H%M%S).sql

# Verify backup exists
ls -lh backup_production_*.sql

# Show file size (should be > 1MB)
du -h backup_production_*.sql
```

---

## 2️⃣ PULL LATEST CODE
```bash
# Update code from git
git pull origin main

# Verify commit is SSO fix (should show ce6bf40 or later)
git log --oneline -1

# Show what changed
git log --oneline -5
```

---

## 3️⃣ CREATE FRONTEND PRODUCTION ENV
```bash
# Create .env.production for frontend
cat > frontend/.env.production << 'EOF'
VITE_API_BASE_URL=https://lmsetjendpdri.duckdns.org
EOF

# Verify file created
cat frontend/.env.production
```

---

## 4️⃣ STOP CURRENT SERVICES
```bash
# Stop all running containers
docker-compose down

# Verify containers stopped
docker ps

# Should show empty list (no containers)
```

---

## 5️⃣ BUILD AND START NEW VERSION
```bash
# Build images and start containers
docker-compose up -d --build

# Watch it building (takes 2-5 minutes)
# This will:
# - Pull base images
# - Build backend image
# - Build frontend image
# - Start all services

# Check status
docker ps

# Should show 3 containers running:
# - lms_backend
# - lms_postgres
# - lms_redis
```

---

## 6️⃣ RUN DATABASE MIGRATIONS
```bash
# Apply any pending migrations
docker-compose exec backend python manage.py migrate

# Output should show:
# - Operations to perform
# - Running migrations
# - "No migrations to apply" (if DB is current)
```

---

## 7️⃣ COLLECT STATIC FILES
```bash
# Collect static files for production serving
docker-compose exec backend python manage.py collectstatic --noinput

# Output should show:
# - Number of files collected
# - Copy to location
```

---

## 8️⃣ VERIFY DEPLOYMENT
```bash
# Check backend logs (should see no errors)
docker-compose logs backend | tail -20

# Check frontend logs
docker-compose logs frontend | tail -20

# Test backend API
curl -s https://lmsetjendpdri.duckdns.org/api/v1/ | head -20

# Test frontend
curl -s https://lmsetjendpdri.duckdns.org | grep -o "<title>.*</title>"
```

---

## 9️⃣ PRODUCTION VERIFICATION COMMANDS

### Check Services Running
```bash
# Show all running containers
docker ps

# Show container status
docker-compose ps
```

### Check Logs for Errors
```bash
# Backend logs (last 50 lines)
docker-compose logs --tail=50 backend

# Frontend logs
docker-compose logs --tail=50 frontend

# All logs
docker-compose logs --tail=50

# Follow logs in real-time (Ctrl+C to exit)
docker-compose logs -f backend
```

### Test API Endpoints
```bash
# Test backend health
curl -v https://lmsetjendpdri.duckdns.org/api/v1/

# Test frontend
curl -v https://lmsetjendpdri.duckdns.org

# Test SSO endpoint (will fail with test token, but proves endpoint exists)
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/sso/verify/ \
  -H "Content-Type: application/json" \
  -d '{"sso_token":"test"}'
```

---

## ⚠️ IF SOMETHING GOES WRONG

### View Full Error Logs
```bash
# See all backend logs from deployment
docker-compose logs backend

# Find specific errors
docker-compose logs backend | grep -i error

# See Django errors in detail
docker-compose logs backend | grep -A 5 "Traceback"
```

### Stop Services
```bash
# Stop everything
docker-compose down

# Kill all containers forcefully if needed
docker-compose kill

# Remove everything (careful!)
docker-compose down -v
```

### Rollback to Previous Version
```bash
# Stop services
docker-compose down

# Revert to previous commit
git revert HEAD

# Or just go back to previous version
git checkout HEAD~1

# Rebuild and restart
docker-compose up -d --build

# Check logs
docker-compose logs -f backend
```

### Restore from Backup (If Database Corrupted)
```bash
# Stop database container
docker-compose down

# Restore backup (DANGEROUS - will overwrite current DB)
docker-compose up -d postgres
sleep 5

# Restore from backup file
docker-compose exec -T postgres psql -U lms_user -d django_lms_db < backup_production_YYYYMMDD_HHMMSS.sql

# Restart all services
docker-compose up -d
```

---

## 🧪 MANUAL TESTING COMMANDS

### Test SSO Login (Browser)
```bash
# Open in browser
https://lmsetjendpdri.duckdns.org

# Open DevTools: F12
# Go to Console tab
# Click "Login dengan SSO" button
# Watch console for:
# - "✅ UserData: Decoded from refresh_token"
# - "role = student" (or appropriate role)
```

### Test Via curl (Backend)
```bash
# Get CSRF token
curl -s https://lmsetjendpdri.duckdns.org/api/v1/csrf/ -c cookies.txt

# Get cookies
cat cookies.txt

# Test normal login
curl -X POST https://lmsetjendpdri.duckdns.org/api/v1/user/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -b cookies.txt
```

---

## 📊 MONITORING COMMANDS

### Check Database
```bash
# Connect to database
docker-compose exec postgres psql -U lms_user django_lms_db

# Common queries:
# SELECT COUNT(*) FROM userauths_user;
# SELECT * FROM userauths_user LIMIT 5;
# \dt  (list tables)
# \q   (quit)
```

### Check Redis
```bash
# Connect to Redis cache
docker-compose exec redis redis-cli

# Commands:
# PING  (should return PONG)
# KEYS "*"  (see all keys)
# GET {key}  (get value)
# FLUSHDB  (clear cache - use carefully!)
# exit  (quit)
```

### Check Disk Usage
```bash
# Overall disk usage
df -h

# Docker storage
du -sh /var/lib/docker/*

# Project storage
du -sh /path/to/LMSetjen-DPD-RI/*
```

---

## 🔐 SECURITY CHECKS POST-DEPLOYMENT

### Verify SSL Certificate
```bash
# Check certificate details
echo | openssl s_client -connect lmsetjendpdri.duckdns.org:443

# Check expiry
openssl s_client -connect lmsetjendpdri.duckdns.org:443 </dev/null | \
  openssl x509 -noout -dates
```

### Verify HTTPS Only
```bash
# HTTP should redirect to HTTPS
curl -v http://lmsetjendpdri.duckdns.org

# Should get: "301 Moved Permanently"
# Location: https://...
```

### Check Security Headers
```bash
# View all headers
curl -I https://lmsetjendpdri.duckdns.org

# Should see:
# - Strict-Transport-Security
# - X-Frame-Options
# - X-Content-Type-Options
# - Content-Security-Policy
```

---

## 📝 COMMON COMMANDS QUICK REFERENCE

```bash
# View status
docker-compose ps

# View logs
docker-compose logs -f backend

# Stop all
docker-compose down

# Start all
docker-compose up -d

# Build and start
docker-compose up -d --build

# Rebuild images
docker-compose build --no-cache

# Prune unused images (clean up)
docker image prune -a

# Exec bash in container
docker-compose exec backend bash

# Run single command in container
docker-compose exec backend python manage.py shell

# Scale service (e.g., 3 backend instances)
docker-compose up -d --scale backend=3

# Update containers
docker-compose pull
docker-compose up -d

# Force recreate containers
docker-compose up -d --force-recreate
```

---

## 📋 DEPLOYMENT CHECKLIST (Copy to Terminal)

```bash
# 1. Backup
docker-compose exec postgres pg_dump -U lms_user django_lms_db > backup_$(date +%Y%m%d_%H%M%S).sql
echo "✅ Backup created"

# 2. Pull latest code
git pull origin main
echo "✅ Code updated"

# 3. Create frontend .env
cat > frontend/.env.production << 'EOF'
VITE_API_BASE_URL=https://lmsetjendpdri.duckdns.org
EOF
echo "✅ Frontend env created"

# 4. Stop services
docker-compose down
echo "✅ Services stopped"

# 5. Build and start
docker-compose up -d --build
echo "✅ Services started"

# 6. Run migrations
docker-compose exec backend python manage.py migrate
echo "✅ Migrations complete"

# 7. Collect static
docker-compose exec backend python manage.py collectstatic --noinput
echo "✅ Static files collected"

# 8. Check status
docker-compose ps
echo "✅ Deployment complete!"
```

---

## 🎯 Success Criteria

After running all commands, check:

```bash
# Should see 3 containers running
docker ps | grep lms_

# Should show no errors
docker-compose logs backend | grep -i error

# Should return 200
curl -s -o /dev/null -w "%{http_code}" https://lmsetjendpdri.duckdns.org

# Should show valid certificate
echo | openssl s_client -connect lmsetjendpdri.duckdns.org:443 2>/dev/null | \
  grep -A 2 "Certificate chain"
```

All showing good results? ✅ Deployment successful!

---

**Need help?** Check logs with: `docker-compose logs -f backend`

