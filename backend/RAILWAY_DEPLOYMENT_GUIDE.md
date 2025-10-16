# 🚂 Railway Deployment Guide (FREE - No Credit Card Required)

## Why Railway?

✅ **$5 free credit** - No credit card needed initially  
✅ **Easy deployment** - Connect GitHub and deploy  
✅ **PostgreSQL included** - Free database  
✅ **Automatic HTTPS** - SSL certificates included  
✅ **Great for testing** - Perfect for this project  

---

## 🚀 Step-by-Step Deployment

### Step 1: Create Railway Account

1. Go to: https://railway.app/
2. Click **"Start a New Project"**
3. Sign up with:
   - **GitHub** (recommended - easiest)
   - Or Email
4. You'll get **$5 free credit** automatically

---

### Step 2: Create New Project

1. After login, click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Connect your GitHub account if not connected
4. Select repository: **`khaz-dev/LMSetjen-DPD-RI`**
5. Railway will detect your Django app

---

### Step 3: Configure Root Directory

Since your backend is in a subdirectory:

1. Click on your service
2. Go to **"Settings"** tab
3. Find **"Root Directory"**
4. Set to: `backend`
5. Click **"Save"**

---

### Step 4: Add PostgreSQL Database

1. In your project, click **"New"** button
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will create a database and provide `DATABASE_URL`
4. Copy the **`DATABASE_URL`** (you'll need it)

---

### Step 5: Add Environment Variables

Click on your service → **"Variables"** tab → Add these:

```bash
# Django Core (REQUIRED)
SECRET_KEY=django-insecure-6ghjc7M1&q!NKIWIPR3*#rck)&H4%jp2)!!oF9ltPG$10jHJsA
DEBUG=False
DJANGO_LOG_LEVEL=INFO

# Database (Railway provides this automatically)
DATABASE_URL=${{DATABASE_URL}}
USE_SQLITE_FALLBACK=False

# Allowed Hosts
ALLOWED_HOSTS=.railway.app,.vercel.app,localhost

# Frontend
FRONTEND_SITE_URL=https://frontend-mtmk2t9bk-khazs-projects.vercel.app

# CORS
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=https://frontend-mtmk2t9bk-khazs-projects.vercel.app

# Email (Optional - skip if you don't have SendGrid)
FROM_EMAIL=sdm@dpd.go.id
# SENDGRID_API_KEY=your_key_here  (leave blank if you don't have)

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

**💡 TIP**: Railway automatically provides `DATABASE_URL` from the PostgreSQL service, so you don't need to manually copy it if services are linked!

---

### Step 6: Configure Build & Start Commands

In **Settings** tab:

**Build Command:**
```bash
pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
```

**Start Command:**
```bash
gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT --workers 4 --timeout 120
```

**💡 NOTE**: Railway automatically sets `$PORT` - don't hardcode it!

---

### Step 7: Deploy!

1. Click **"Deploy"** or push to GitHub (auto-deploys)
2. Watch the deployment logs
3. Wait for status to show **"Success"** (~5-10 minutes)
4. Copy your app URL (e.g., `https://your-app.railway.app`)

---

### Step 8: Test Your Backend

```bash
# Test health endpoint
curl https://your-app.railway.app/api/health/

# Expected response:
# {"status":"healthy","service":"LMS Backend API","timestamp":"..."}
```

---

## 🔗 Connect Frontend (Phase 3)

Once Railway deployment is complete:

```powershell
cd "d:\Project\LMSetjen DPD RI"

# Run Phase 3 script with your Railway URL
.\run-phase-3.ps1 -BackendURL "https://your-app.railway.app"
```

---

## ✅ Verification Checklist

- [ ] Railway account created ($5 credit received)
- [ ] Project created from GitHub repo
- [ ] Root directory set to `backend`
- [ ] PostgreSQL database added
- [ ] Environment variables configured
- [ ] Build & start commands set
- [ ] Deployment successful (shows "Success")
- [ ] Health endpoint responding
- [ ] Backend URL copied

---

## 💰 Free Tier Limits

**Railway Free Trial:**
- **$5 credit** (lasts ~1-2 months for small projects)
- **512MB RAM** per service
- **1GB storage** for database
- **100GB bandwidth** per month

**Perfect for:**
- Testing & development
- Small production apps
- Learning & demos

**After free credit:**
- Pay-as-you-go (only pay for what you use)
- ~$5-10/month for small apps
- Can add credit card later if you want to continue

---

## 🐛 Troubleshooting

### Issue: "Build failed"
**Solution:**
- Check build logs for specific error
- Verify `requirements.txt` is in backend/ directory
- Ensure root directory is set to `backend`

### Issue: "Health check failed"
**Solution:**
- Verify `/api/health/` endpoint exists
- Check start command uses `$PORT` not hardcoded port
- Review deployment logs

### Issue: "Database connection error"
**Solution:**
- Ensure PostgreSQL service is created
- Verify `DATABASE_URL` is set in variables
- Check both services are in same project

### Issue: "Static files not loading"
**Solution:**
- Verify `collectstatic` in build command
- Check `STATIC_ROOT` in settings.py

---

## 📊 Cost Comparison

| Platform | Free Tier | Card Required | Best For |
|----------|-----------|---------------|----------|
| **Railway** | $5 credit | ❌ No | Quick start, testing |
| **Render** | Free forever | ✅ Yes | Long-term free hosting |
| **Heroku** | $5/month | ✅ Yes | Enterprise apps |
| **Vercel** | Free (frontend) | ❌ No | Frontend only |

**Recommendation**: Use Railway for now (no card), migrate to Render later if you want long-term free hosting!

---

## 🎯 Alternative: Other Free Options

### Option 2: PythonAnywhere (Limited but Free)
- **Free tier**: Always free with limitations
- **No card required**: True free account
- **Limitations**: 
  - Daily API quota
  - No HTTPS on free tier
  - Limited packages
  - Only Python 3.10

### Option 3: Fly.io
- **Free tier**: 3 VMs free
- **Card required**: Yes
- **Good for**: Django apps

### Option 4: Local + Ngrok (Temporary Testing)
- **Completely free**: No sign-up
- **Use**: For quick testing only
- **Not recommended**: Not stable for production

---

## 🚀 Quick Railway Setup (TL;DR)

```bash
1. https://railway.app/ → Sign up with GitHub
2. New Project → Deploy from GitHub → Select repo
3. Settings → Root Directory → "backend"
4. New → Database → PostgreSQL
5. Variables → Add all environment variables (see Step 5)
6. Settings → Build Command + Start Command (see Step 6)
7. Deploy → Wait → Copy URL
8. Test: curl https://your-app.railway.app/api/health/
9. Run: .\run-phase-3.ps1 -BackendURL "https://your-app.railway.app"
10. Run: .\run-final-audit.ps1
11. Celebrate 97-99/100! 🎉
```

---

## 📞 Support

- **Railway Docs**: https://docs.railway.app/
- **Railway Discord**: https://discord.gg/railway
- **Railway Status**: https://status.railway.app/

---

## 💡 Pro Tips

1. **Use GitHub auto-deploy**: Push to main branch = auto deploy
2. **Watch logs**: Monitor deployment in real-time
3. **Start small**: Free tier is enough for this project
4. **Upgrade later**: Add card when you need more resources
5. **Use Railway CLI**: `npm install -g @railway/cli` for advanced features

---

**Created**: October 16, 2025  
**Target**: 97-99/100 Lighthouse Score  
**Cost**: $0 (using free $5 credit)  
**Time**: ~15 minutes  

🚂 **Railway is perfect for your needs - no card required!** 🎉
