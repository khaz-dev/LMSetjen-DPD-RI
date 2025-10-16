# 🚀 Backend Deployment Guide - Django to Render

## Overview

This guide will walk you through deploying the Django backend to **Render.com**, configuring the database, and connecting it with the Vercel frontend to achieve **97-99/100 Lighthouse scores**.

---

## 📋 Prerequisites

- ✅ Render account (free): https://render.com/
- ✅ GitHub repository with backend code
- ✅ Frontend deployed on Vercel: `https://frontend-mtmk2t9bk-khazs-projects.vercel.app`

---

## 🎯 Deployment Options

### Option 1: Blueprint Deployment (Recommended - Fastest)
Uses the `render.yaml` configuration file to deploy everything in one click.

### Option 2: Manual Deployment (More Control)
Step-by-step manual configuration through Render dashboard.

---

## 🚀 Option 1: Blueprint Deployment (Recommended)

### Step 1: Push Code to GitHub

```powershell
# Navigate to backend directory
cd "d:\Project\LMSetjen DPD RI\backend"

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Add Render deployment configuration"

# Create GitHub repository and push
# Follow GitHub instructions to create remote and push
```

### Step 2: Deploy with Blueprint

1. **Go to Render Dashboard**: https://dashboard.render.com/
2. **Click "New" → "Blueprint"**
3. **Connect your GitHub repository**
4. **Select the backend repository**
5. **Render will detect `render.yaml`**
6. **Click "Apply"**

✅ **Render will automatically:**
- Create PostgreSQL database
- Build Docker image
- Run migrations
- Deploy the web service
- Configure environment variables

### Step 3: Configure Sensitive Environment Variables

After blueprint deployment, add these manually in Render dashboard:

1. **Go to your service** → "Environment"
2. **Add these variables:**

```bash
# SendGrid Email (if you have it)
SENDGRID_API_KEY=your_sendgrid_api_key_here

# Django Secret Key (generate new one for production)
# Visit: https://djecrety.ir/ to generate
SECRET_KEY=your_generated_secret_key_here
```

3. **Click "Save Changes"** - service will redeploy automatically

### Step 4: Get Your Backend URL

After deployment completes:
- Your backend URL will be: `https://lms-backend.onrender.com`
- Or similar (Render will show you the exact URL)

---

## 🔧 Option 2: Manual Deployment

### Step 1: Create PostgreSQL Database

1. **Go to Render Dashboard** → "New" → "PostgreSQL"
2. **Configure:**
   - Name: `lms-database`
   - Database: `django_lms_db`
   - User: `lms_user`
   - Region: `Singapore` (closest to your users)
   - Plan: `Free` (or upgrade if needed)
3. **Click "Create Database"**
4. **Save these credentials** (shown once):
   - Internal Database URL
   - External Database URL
   - Host, Port, Database Name, Username, Password

### Step 2: Create Web Service

1. **Go to Render Dashboard** → "New" → "Web Service"
2. **Connect GitHub Repository**
3. **Configure Service:**

```
Name: lms-backend
Region: Singapore
Branch: main
Root Directory: backend (if in subfolder) or leave blank
Environment: Docker
Dockerfile Path: ./Dockerfile
```

4. **Build Settings:**

```bash
# Build Command (if not using Dockerfile)
pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate

# Start Command
gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT --workers 4 --threads 2 --timeout 120 --access-logfile - --error-logfile -
```

5. **Health Check Path:**
```
/api/health/
```

6. **Plan:** Select `Free` (or upgrade if needed)

### Step 3: Configure Environment Variables

Add these in the "Environment" section:

```bash
# Django Core
SECRET_KEY=your_generated_secret_key_here  # Generate at https://djecrety.ir/
DEBUG=False
DJANGO_LOG_LEVEL=INFO
ALLOWED_HOSTS=.onrender.com,.vercel.app

# Database (from Step 1)
DB_NAME=django_lms_db
DB_USER=lms_user
DB_PASSWORD=your_database_password
DB_HOST=your_database_host.oregon-postgres.render.com
DB_PORT=5432
DATABASE_URL=your_internal_database_url
USE_SQLITE_FALLBACK=False

# Frontend Configuration
FRONTEND_SITE_URL=https://frontend-mtmk2t9bk-khazs-projects.vercel.app
BACKEND_SITE_URL=https://lms-backend.onrender.com

# CORS Configuration
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://frontend-mtmk2t9bk-khazs-projects.vercel.app,http://localhost:5173

# Email Configuration
SENDGRID_API_KEY=your_sendgrid_api_key  # If you have one
FROM_EMAIL=sdm@dpd.go.id

# Security (Production)
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

# Performance
DATABASE_QUERY_CACHE_TIMEOUT=300
CACHE_MIDDLEWARE_SECONDS=300

# File Upload
FILE_UPLOAD_MAX_MEMORY_SIZE=104857600
DATA_UPLOAD_MAX_MEMORY_SIZE=104857600

# Storage
USE_LOCAL_OPTIMIZATION=True
ENABLE_FILE_COMPRESSION=True
ENABLE_IMAGE_OPTIMIZATION=True
ENABLE_VIDEO_COMPRESSION=False
```

### Step 4: Add Persistent Disk (Optional - for media files)

1. **In your service** → "Disks" → "Add Disk"
2. **Configure:**
   - Name: `media-files`
   - Mount Path: `/app/media`
   - Size: `1 GB` (free tier) or more
3. **Save**

### Step 5: Deploy

1. **Click "Create Web Service"**
2. **Wait for deployment** (~5-10 minutes)
3. **Monitor logs** for any errors
4. **Verify deployment** at `https://your-service.onrender.com/api/health/`

---

## 🔗 Connect Frontend to Backend

### Step 1: Update Frontend Environment Variable

```powershell
# Navigate to frontend directory
cd "d:\Project\LMSetjen DPD RI\frontend"

# Add production API URL to Vercel
vercel env add VITE_API_URL production

# When prompted, enter:
https://lms-backend.onrender.com

# Confirm for all environments
```

### Step 2: Update Frontend Code (if needed)

Check `frontend/src/` for API configuration:

```javascript
// Should be using environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
```

### Step 3: Redeploy Frontend

```powershell
# Still in frontend directory
vercel --prod
```

---

## ✅ Verification Checklist

### Backend Health Check

```powershell
# Test health endpoint
curl https://lms-backend.onrender.com/api/health/
# Should return: {"status":"healthy","service":"LMS Backend API","timestamp":"..."}
```

### Test API Endpoints

```powershell
# Test category list
curl https://lms-backend.onrender.com/api/course/category/

# Test course list
curl https://lms-backend.onrender.com/api/course/course-list/
```

### Browser Console Check

1. Open `https://frontend-mtmk2t9bk-khazs-projects.vercel.app`
2. Open DevTools (F12) → Console
3. **Verify:**
   - ✅ No CORS errors
   - ✅ API calls successful
   - ✅ Courses loading
   - ✅ No 404/500 errors

### Database Check

```powershell
# Connect to Render database (use PSQL Shell from Render dashboard)
psql your_internal_database_url

# Check tables
\dt

# Check data
SELECT COUNT(*) FROM core_course;
```

---

## 🎯 Run Final Lighthouse Audit

### Step 1: Run 3 Audits (30 seconds apart)

```powershell
# Audit 1
npx lighthouse https://frontend-mtmk2t9bk-khazs-projects.vercel.app `
  --preset=desktop --output=html --output=json `
  --output-path=lighthouse-fullstack-1 `
  --chrome-flags=--incognito `
  --only-categories=performance,accessibility,best-practices,seo

# Wait 30 seconds
Start-Sleep -Seconds 30

# Audit 2
npx lighthouse https://frontend-mtmk2t9bk-khazs-projects.vercel.app `
  --preset=desktop --output=html --output=json `
  --output-path=lighthouse-fullstack-2 `
  --chrome-flags=--incognito `
  --only-categories=performance,accessibility,best-practices,seo

# Wait 30 seconds
Start-Sleep -Seconds 30

# Audit 3
npx lighthouse https://frontend-mtmk2t9bk-khazs-projects.vercel.app `
  --preset=desktop --output=html --output=json `
  --output-path=lighthouse-fullstack-3 `
  --chrome-flags=--incognito `
  --only-categories=performance,accessibility,best-practices,seo
```

### Step 2: Calculate Average Scores

```powershell
# Parse all 3 audits and calculate averages
$audits = 1..3 | ForEach-Object {
    $json = Get-Content "lighthouse-fullstack-$_.report.json" | ConvertFrom-Json
    [PSCustomObject]@{
        Performance = [math]::Round($json.categories.performance.score * 100, 1)
        Accessibility = [math]::Round($json.categories.accessibility.score * 100, 1)
        BestPractices = [math]::Round($json.categories.'best-practices'.score * 100, 1)
        SEO = [math]::Round($json.categories.seo.score * 100, 1)
    }
}

$avg = $audits | Measure-Object -Property Performance,Accessibility,BestPractices,SEO -Average

Write-Host "`n🎯 FINAL LIGHTHOUSE SCORES (Average of 3 Audits):" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "Performance:    $([math]::Round(($avg | Where-Object {$_.Property -eq 'Performance'}).Average, 1))/100" -ForegroundColor Cyan
Write-Host "Accessibility:  $([math]::Round(($avg | Where-Object {$_.Property -eq 'Accessibility'}).Average, 1))/100" -ForegroundColor Cyan
Write-Host "Best Practices: $([math]::Round(($avg | Where-Object {$_.Property -eq 'BestPractices'}).Average, 1))/100" -ForegroundColor Cyan
Write-Host "SEO:            $([math]::Round(($avg | Where-Object {$_.Property -eq 'SEO'}).Average, 1))/100" -ForegroundColor Cyan
$overall = [math]::Round((($avg | Where-Object {$_.Property -eq 'Performance'}).Average + 
                          ($avg | Where-Object {$_.Property -eq 'Accessibility'}).Average + 
                          ($avg | Where-Object {$_.Property -eq 'BestPractices'}).Average + 
                          ($avg | Where-Object {$_.Property -eq 'SEO'}).Average) / 4, 1)
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "Overall Score:  $overall/100" -ForegroundColor Yellow -BackgroundColor DarkGreen
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Green
```

---

## 📊 Expected Results

### With Full-Stack Deployment:

```
Performance:    98/100  ✅ (already achieved)
Accessibility:  91/100  ✅ (+5 from backend)
Best Practices: 100/100 ✅ (+4 from backend)
SEO:            100/100 ✅ (+9 from backend)
────────────────────────────────────────
Overall:        97.3/100 🏆
```

---

## 🐛 Troubleshooting

### Issue: CORS Errors

**Solution:**
```python
# In backend/settings.py, verify:
CORS_ALLOWED_ORIGINS = [
    "https://frontend-mtmk2t9bk-khazs-projects.vercel.app",
]
```

### Issue: Database Connection Failed

**Solution:**
1. Check `DATABASE_URL` in Render environment variables
2. Verify database is running in Render dashboard
3. Check logs: `Render Dashboard → Service → Logs`

### Issue: Static Files Not Loading

**Solution:**
```bash
# In Render, add build command:
python manage.py collectstatic --noinput
```

### Issue: Health Check Failing

**Solution:**
1. Verify `/api/health/` endpoint is accessible
2. Check Render logs for errors
3. Test locally first: `python manage.py runserver`

### Issue: 502 Bad Gateway

**Solution:**
1. Check if service is still deploying (wait 5-10 minutes)
2. Verify `PORT` environment variable is used correctly
3. Check gunicorn is binding to `0.0.0.0:$PORT`

---

## 🎉 Success Criteria

✅ Backend health check returns 200 OK  
✅ Frontend loads without CORS errors  
✅ Courses visible on homepage  
✅ User authentication working  
✅ No console errors in browser  
✅ Lighthouse scores: **97-99/100**  

---

## 📝 Notes

### Free Tier Limitations (Render)
- ⏱️ **Cold starts**: Service may sleep after 15 minutes of inactivity
- 💾 **Database**: 1GB storage limit
- 🌐 **Bandwidth**: Limited egress
- ⚡ **Performance**: Shared resources

### Recommended Upgrades
- **Starter Plan ($7/month)**: No cold starts, better performance
- **Database**: More storage and backups
- **CDN**: Add Cloudflare for static/media files

### Production Checklist
- [ ] Generate new `SECRET_KEY` for production
- [ ] Enable database backups
- [ ] Set up monitoring (Sentry, New Relic)
- [ ] Configure custom domain
- [ ] Add SSL certificate (automatic with Render)
- [ ] Set up CI/CD pipeline
- [ ] Configure logging and alerting

---

## 🔗 Useful Links

- **Render Dashboard**: https://dashboard.render.com/
- **Django Secret Key Generator**: https://djecrety.ir/
- **Render Docs**: https://render.com/docs
- **PostgreSQL Shell**: Available in Render dashboard
- **Service Logs**: Render dashboard → Your service → Logs

---

## 📧 Support

If you encounter issues:
1. Check Render service logs
2. Verify environment variables
3. Test endpoints with curl/Postman
4. Check browser console for errors
5. Review CORS configuration

---

**Created**: 2024  
**Target**: 97-99/100 Lighthouse Score  
**Status**: Ready for deployment 🚀
