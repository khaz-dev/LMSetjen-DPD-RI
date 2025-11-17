# 🚀 Production Deployment Guide

**Target Server:** lmsetjendpdri.duckdns.org (AWS EC2 at 16.79.83.21)  
**Date:** November 17, 2025  
**Changes:** QR Code visibility fix + recent security updates

---

## 📋 Quick Summary

Your code is ready to deploy. The following changes will be deployed:
- ✅ All previous QR code fixes (migration, token generation, API)
- ✅ Recent security updates (sensitive credentials moved to .env)
- ✅ All bug fixes and improvements

---

## 🔧 Deployment Steps

### Step 1: SSH into the Production Server

```bash
ssh -i "YOUR_KEY_PATH" ubuntu@16.79.83.21
```

Or if you have DuckDNS configured:
```bash
ssh -i "YOUR_KEY_PATH" ubuntu@lmsetjendpdri.duckdns.org
```

---

### Step 2: Navigate to Project Directory

```bash
cd ~/LMSetjen-DPD-RI
```

---

### Step 3: Pull Latest Code from GitHub

```bash
git pull origin main
```

**Expected Output:**
```
Already up to date.
```
OR if there are new changes:
```
Updating xxxxx..yyyyy
Fast-forward
 X files changed, XX insertions(+), X deletions(-)
```

---

### Step 4: Verify Environment Variables

Check that `.env` file exists in the project root:

```bash
ls -la .env
```

If it doesn't exist, create it with your production settings:

```bash
cat > .env << 'EOF'
# Database
DB_NAME=django_lms_db
DB_USER=lms_user
DB_PASSWORD=your_secure_password

# Redis
REDIS_PASSWORD=your_redis_password

# Django
SECRET_KEY=your_django_secret_key
DEBUG=False
ALLOWED_HOSTS=lmsetjendpdri.duckdns.org,16.79.83.21

# Email (SendGrid)
SENDGRID_API_KEY=your_sendgrid_key

# Frontend
FRONTEND_SITE_URL=https://lmsetjendpdri.duckdns.org

# SSL
USE_SSL=True

# API
API_BASE_URL=https://lmsetjendpdri.duckdns.org/api
EOF
```

---

### Step 5: Stop Current Containers

```bash
docker compose down
```

---

### Step 6: Rebuild and Start Containers

```bash
docker compose up -d --build
```

This will:
1. ✅ Pull latest code
2. ✅ Rebuild backend Docker image
3. ✅ Rebuild frontend Docker image  
4. ✅ Start all containers (postgres, redis, backend, frontend, nginx)
5. ✅ Apply any pending database migrations automatically

---

### Step 7: Wait for Services to Start

```bash
sleep 5 && docker compose logs -f
```

Press `Ctrl+C` when you see:
```
backend_1   | Starting development server at http://0.0.0.0:8000/
frontend_1  | Local:   http://localhost:3000
nginx_1     | Listening on port 80
```

---

### Step 8: Verify Deployment

Check container status:
```bash
docker compose ps
```

All containers should show `Up` status:
```
NAME              STATUS
lms_postgres      Up 2 minutes (healthy)
lms_redis         Up 2 minutes (healthy)
backend           Up 1 minute
frontend          Up 1 minute
nginx             Up 1 minute
```

---

### Step 9: Test the Application

1. **Open your browser** to https://lmsetjendpdri.duckdns.org

2. **Log in** with your credentials

3. **Navigate to:** Student Dashboard → Courses → Any Course → Certificate Tab

4. **Verify:** You should see the **QR Code** with "Scan to Verify" label

---

### Step 10: Run Certificate Validation Token Script (if needed)

If certificates still don't show validation tokens, run:

```bash
bash run_certificate_fix.sh
```

This will:
1. Apply database migrations
2. Generate validation tokens for all certificates
3. Verify all checks pass

---

## ✅ Verification Checklist

- [ ] All 5 containers running (`docker compose ps`)
- [ ] No error messages in logs (`docker compose logs`)
- [ ] Website loads at https://lmsetjendpdri.duckdns.org
- [ ] Can log in successfully
- [ ] QR code visible on certificate tab
- [ ] QR code is scannable

---

## 🔧 Troubleshooting

### Containers won't start?
```bash
docker compose logs backend
docker compose logs frontend
```

Check for error messages and fix accordingly.

### Port already in use?
```bash
docker compose down --remove-orphans
```

Then rebuild and restart.

### Database migration errors?
```bash
docker compose exec backend python manage.py migrate
```

### Frontend showing old cache?
```bash
# On your local browser
- Windows: Ctrl + Shift + Delete (opens clear browsing data)
- Mac: Cmd + Shift + Delete (or Cmd + Y on Chrome)
- Linux: Ctrl + Shift + Delete
```

Select "All time" and clear cache, then reload page.

---

## 📞 Need Help?

If something goes wrong:

1. Check logs: `docker compose logs -f`
2. Verify containers: `docker compose ps`
3. Restart everything: `docker compose down && docker compose up -d --build`
4. Check the specific service logs for details

---

## 🎯 Expected Outcomes After Deployment

✅ Website accessible at https://lmsetjendpdri.duckdns.org  
✅ All users can log in  
✅ Certificate tab shows QR codes  
✅ QR codes are scannable and link to validation page  
✅ All previous functionality maintained  

---

**Status:** ✨ Ready for production deployment

