# Production Deployment Guide: Placeholder Image Fix

**Issue**: via.placeholder.com errors appearing in production  
**Root Cause**: Old frontend bundle still being served  
**Solution**: Deploy new frontend build with local placeholder SVGs  

---

## ⚠️ CRITICAL: Why You're Still Seeing Errors

The error you're seeing references `CourseDetail-b0d1ce79.js`, but the NEW build created `CourseDetail-940154e5.js`.

**This means your production server is serving OLD cached bundle files.**

---

## 🚀 Deployment Steps

### Step 1: Connect to Production Server

```bash
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21
```

### Step 2: Navigate to Project Directory

```bash
cd /home/ubuntu/LMSetjen-DPD-RI
```

### Step 3: Pull Latest Code

```bash
git pull origin main
```

**Expected Output:**
```
From https://github.com/khaz-dev/LMSetjen-DPD-RI
 * branch            main       -> FETCH_HEAD
Updating b26f2ac..13dd4e0
Fast-forward
 backend/api/migrations/0008_fix_course_slugs_with_none.py | ...
 backend/api/migrations/0009_fix_existing_course_slugs.py | ...
 backend/api/models.py | ...
 frontend/public/images/placeholders/... | ...
 frontend/src/views/base/components/CourseInstructor.jsx | ...
 frontend/src/views/base/components/CourseSidebar.jsx | ...
```

### Step 4: Run Backend Migrations

```bash
# Option A: If using Docker
docker compose exec backend python manage.py migrate api

# Option B: If running directly
cd backend
source venv/bin/activate  # if using venv
python manage.py migrate api
cd ..
```

**Expected Output:**
```
Running migrations:
  Applying api.0008_fix_course_slugs_with_none... OK
  Applying api.0009_fix_existing_course_slugs...
Fixed course 4: Rabuan III - Public Speaking... -> slug: rabuan-iii-public-speaking-...-4
Total courses fixed: X
 OK
```

### Step 5: Rebuild Frontend (CRITICAL!)

**This is the most important step to fix the via.placeholder.com errors!**

```bash
cd frontend

# Install dependencies if needed (first time only)
# npm install

# Build frontend with latest changes
npm run build
```

**Expected Output:**
```
✓ 1738 modules transformed.
...
dist/assets/CourseDetail-940154e5.js    103.39 kB
...
✓ built in ~20s
```

**Verify placeholder images copied:**
```bash
ls -la dist/images/placeholders/
```

**Expected:**
```
default-avatar.svg
default-course.svg
default-instructor.svg
README.md
```

### Step 6: Deploy New Build

#### If Using Docker with nginx:

```bash
# Copy new build to nginx volume or update nginx config
cd ..

# Restart services to pick up new build
docker compose restart frontend
docker compose restart nginx  # if separate nginx container
```

#### If Using Static File Serving:

```bash
# Copy dist folder to web server location
sudo cp -r frontend/dist/* /var/www/lms/frontend/

# Or if nginx serves from project directory
# Just restart nginx to clear cache
sudo systemctl reload nginx
```

### Step 7: Clear Browser Cache

**VERY IMPORTANT**: Old JavaScript bundles are cached in users' browsers!

#### Option A: Hard Cache Clear (Recommended)
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

#### Option B: Force New Cache with Version Parameter
Add version query to index.html:
```html
<script src="/assets/index-e80f0983.js?v=2"></script>
```

#### Option C: Update Nginx Cache Headers
```nginx
location /assets/ {
    expires -1;
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
}
```

### Step 8: Verify Deployment

#### Check Backend Logs:
```bash
# Docker
docker logs lms_backend --tail 50

# Direct
tail -f backend/logs/django.log
```

#### Check Frontend Build Files:
```bash
ls -lh frontend/dist/assets/ | grep CourseDetail
```

**Expected**: Should show `CourseDetail-940154e5.js` (NEW version)

#### Test in Browser:
1. Open: https://lmsetjendpdri.duckdns.org/course-detail/rabuan-iii-public-speaking-...-4/
2. Click "Instructor" tab
3. Open DevTools → Console
4. **Expected**: NO via.placeholder.com errors!
5. **Expected**: Instructor avatar shows green gradient SVG if image missing

#### Check Network Tab:
1. Open DevTools → Network tab
2. Filter: "placeholder"
3. **Expected**: Requests to `/images/placeholders/default-instructor.svg` (200 OK)
4. **Expected**: NO requests to `via.placeholder.com`

---

## 🔍 Troubleshooting

### Still Seeing Old Bundle?

**Problem**: Browser or CDN is caching old JavaScript files

**Solutions**:

1. **Clear ALL caches**:
```bash
# On server
sudo systemctl reload nginx
docker compose restart frontend

# In browser
Ctrl+Shift+Delete → Clear all cache
```

2. **Check what bundle is actually loading**:
```bash
# In browser DevTools → Network tab
# Look for CourseDetail-*.js
# Should be CourseDetail-940154e5.js (NEW)
# NOT CourseDetail-b0d1ce79.js (OLD)
```

3. **Force cache busting in nginx**:
```nginx
# /etc/nginx/sites-available/lms
location ~* \.(js|css)$ {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### Still Seeing via.placeholder.com Errors?

**Problem**: Old bundle still loaded in browser

**Check**:
```javascript
// In browser console
console.log(document.querySelector('script[src*="CourseDetail"]').src);
// Should show: .../CourseDetail-940154e5.js
// NOT: .../CourseDetail-b0d1ce79.js
```

**Fix**:
1. Hard refresh: `Ctrl+Shift+R`
2. Clear site data: DevTools → Application → Clear Storage → Clear site data
3. Incognito mode test: Open in new incognito window

### Images Still Not Loading?

**Check placeholder files exist**:
```bash
ls -la frontend/dist/images/placeholders/
```

**Check nginx serves static files**:
```nginx
location /images/ {
    alias /path/to/frontend/dist/images/;
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

---

## 📊 Verification Checklist

After deployment, verify:

- [ ] Git pulled latest code (commit 13dd4e0 or later)
- [ ] Backend migrations ran successfully
- [ ] Course slugs fixed (no more "None" in database)
- [ ] Frontend built successfully
- [ ] New bundle files exist in dist/assets/
- [ ] Placeholder SVGs exist in dist/images/placeholders/
- [ ] Nginx/web server restarted
- [ ] Browser cache cleared
- [ ] Course detail page loads
- [ ] Instructor tab shows WITHOUT via.placeholder.com errors
- [ ] DevTools console shows NO ERR_NAME_NOT_RESOLVED
- [ ] Network tab shows local placeholder images loading

---

## 🎯 Success Criteria

**Before Fix**:
```
❌ GET https://via.placeholder.com/150 net::ERR_NAME_NOT_RESOLVED
❌ GET https://via.placeholder.com/150 net::ERR_NAME_NOT_RESOLVED
❌ GET https://via.placeholder.com/150 net::ERR_NAME_NOT_RESOLVED
(Repeated infinitely...)
```

**After Fix**:
```
✅ GET /images/placeholders/default-instructor.svg 200 OK
✅ No console errors
✅ Instructor avatar shows (gradient SVG if no image)
✅ Clean URLs: /course-detail/title-4/ (no "None")
```

---

## 🛠️ Quick Deploy Script

Save this as `deploy.sh` on the server:

```bash
#!/bin/bash
set -e

echo "🚀 Deploying Placeholder Image Fix..."

# Navigate to project
cd /home/ubuntu/LMSetjen-DPD-RI

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Run migrations
echo "🗄️  Running migrations..."
docker compose exec backend python manage.py migrate api

# Rebuild frontend
echo "🏗️  Building frontend..."
cd frontend
npm run build
cd ..

# Restart services
echo "🔄 Restarting services..."
docker compose restart backend
docker compose restart frontend

echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Clear browser cache (Ctrl+Shift+R)"
echo "  2. Test: https://lmsetjendpdri.duckdns.org/course-detail/rabuan-iii-public-speaking-dan-storytelling-untuk-asn-menyampaikan-pesan-dengan-berdampak-4/"
echo "  3. Verify NO via.placeholder.com errors in console"
```

**Run it**:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 📚 Related Documentation

- Main fix summary: `SLUG_AND_PLACEHOLDER_FIX_SUMMARY.md`
- CSRF audit: `COMPLETE_CSRF_AUDIT_FINAL.md`
- Placeholder README: `frontend/public/images/placeholders/README.md`

---

**Deployment Date**: October 18, 2025  
**Fix Version**: commit 13dd4e0  
**Bundle Version**: CourseDetail-940154e5.js  
