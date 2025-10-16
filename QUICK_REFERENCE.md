# 📋 Quick Reference Card - Backend Deployment

## 🚀 3-Step Deployment Process

### Step 1: Deploy Backend to Render (15 min)
```powershell
cd "d:\Project\LMSetjen DPD RI\backend"

# Push to GitHub
git init
git add .
git commit -m "Add Render deployment"
# Create repo on GitHub and push

# Deploy via Render
# 1. https://dashboard.render.com/
# 2. New → Blueprint
# 3. Connect repo → Apply
# 4. Add SECRET_KEY (generate at https://djecrety.ir/)
```

### Step 2: Connect Frontend (5 min)
```powershell
cd "d:\Project\LMSetjen DPD RI"

# Update frontend with backend URL
.\update-frontend.ps1 -BackendURL "https://lms-backend.onrender.com"
```

### Step 3: Final Audit (5 min)
```powershell
cd frontend

# Run 3 audits
npx lighthouse https://frontend-mtmk2t9bk-khazs-projects.vercel.app `
  --preset=desktop --output=json --output-path=audit-1 `
  --only-categories=performance,accessibility,best-practices,seo

# Repeat 2 more times (30s apart)

# Calculate average → 97-99/100! 🎉
```

---

## 🔧 Environment Variables for Render

**Minimal (required):**
```bash
SECRET_KEY=<generate-at-djecrety.ir>
DEBUG=False
DATABASE_URL=<auto-populated-by-render>
FRONTEND_SITE_URL=https://frontend-mtmk2t9bk-khazs-projects.vercel.app
```

**Optional (if available):**
```bash
SENDGRID_API_KEY=<your-key>
```

---

## ✅ Verification Checklist

### Backend:
```powershell
# Test health
curl https://lms-backend.onrender.com/api/health/
# Expected: {"status":"healthy",...}

# Test API
curl https://lms-backend.onrender.com/api/course/course-list/
```

### Frontend:
1. Open: https://frontend-mtmk2t9bk-khazs-projects.vercel.app
2. DevTools (F12) → Console
3. Check:
   - ✅ No CORS errors
   - ✅ Courses loading
   - ✅ No 404/500 errors

---

## 📊 Expected Results

```
Before Backend:        After Backend:
─────────────────      ────────────────
Performance:   98      Performance:   98  (same)
Accessibility: 86      Accessibility: 91  (+5)
Best Practices:96      Best Practices:100 (+4)
SEO:           91      SEO:           100 (+9)
─────────────────      ────────────────
Overall:      92.8     Overall:      97.3 (+4.5) 🏆
```

---

## 🐛 Quick Fixes

**CORS Error:**
```python
# backend/settings.py
CORS_ALLOWED_ORIGINS = [
    "https://frontend-mtmk2t9bk-khazs-projects.vercel.app",
]
```

**Health Check 404:**
```python
# backend/api/urls.py
path("health/", api_views.HealthCheckAPIView.as_view()),
```

**Backend Sleeping (Render Free):**
- First request: ~30s cold start
- Solution: Upgrade to Starter ($7/month)

---

## 📚 Documentation

- **Full Guide**: `backend/DEPLOYMENT_GUIDE.md`
- **Overview**: `DEPLOYMENT_SUMMARY.md`
- **Helper Script**: `backend/deploy-helper.ps1`
- **Frontend Update**: `update-frontend.ps1`

---

## 🎯 Success Criteria

✅ Backend health check: 200 OK  
✅ Frontend no CORS errors  
✅ Courses loading correctly  
✅ Lighthouse overall: **97-99/100**  

---

**Time to Complete**: 30-45 minutes  
**Difficulty**: Moderate  
**Cost**: Free (with limitations) or $7/month  
**Result**: Professional production deployment! 🚀
