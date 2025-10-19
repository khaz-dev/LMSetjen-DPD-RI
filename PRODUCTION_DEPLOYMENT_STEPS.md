# CSS Fix Deployment Guide - Production Server

## 🔴 Problem
Your server is running the **old Docker image** that still has the integrity mismatch issue.

## ✅ Solution
Pull latest code and rebuild the frontend container.

---

## 📋 Commands to Run on Server

### Step 1: Connect to Server
```bash
ssh -i "D:\Project\lms-server-key.pem" ubuntu@16.79.83.21
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
remote: Enumerating objects: X, done.
remote: Counting objects: 100% (X/X), done.
Updating xxxxx..yyyyy
Fast-forward
 frontend/index.html | XX +++++++++++++++++
 1 file changed, XX insertions(+), XX deletions(-)
```

---

### Step 4: Verify Changes Were Pulled
```bash
grep "Critical Admin Styles" frontend/index.html
```

**Expected Output:**
```
      /* Critical Admin Styles - Prevent FOUC (Flash of Unstyled Content) */
```

✅ If you see this, changes are present!  
❌ If nothing appears, the pull didn't work - check git status

---

### Step 5: Stop and Remove Old Container
```bash
docker compose down frontend
```

**Expected Output:**
```
[+] Running 1/1
 ✔ Container lms_frontend_prod  Removed
```

---

### Step 6: Rebuild Frontend Container (No Cache!)
```bash
docker compose build --no-cache frontend
```

**This is CRITICAL!** The `--no-cache` flag forces Docker to rebuild from scratch.

**Expected Output:**
```
[+] Building XX.Xs (10/10) FINISHED
 => [internal] load build definition
 => [internal] load .dockerignore
 => [internal] load metadata for docker.io/library/node:18-alpine
 ...
 => => naming to docker.io/library/lmsetjen-dpd-ri-frontend
```

⏱️ **This will take 2-5 minutes** (rebuilding Node.js app)

---

### Step 7: Start Frontend Container
```bash
docker compose up -d frontend
```

**Expected Output:**
```
[+] Running 1/1
 ✔ Container lms_frontend_prod  Started
```

---

### Step 8: Verify Container is Running
```bash
docker compose ps
```

**Expected Output:**
```
NAME                 IMAGE                          STATUS
lms_frontend_prod    lmsetjen-dpd-ri-frontend      Up X seconds
```

---

### Step 9: Verify Changes Inside Container
```bash
docker exec lms_frontend_prod cat /usr/share/nginx/html/index.html | grep -A 10 "Critical Admin Styles"
```

**Expected Output:**
```html
      /* Critical Admin Styles - Prevent FOUC (Flash of Unstyled Content) */
      .admin-header {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        border-bottom: 2px solid #f39c12;
        ...
```

✅ If you see this, the new `index.html` is deployed!

---

### Step 10: Check Container Logs (Optional)
```bash
docker logs lms_frontend_prod --tail 50
```

Should show nginx access logs, no errors.

---

## 🧪 Testing in Browser

### 1. Clear Browser Cache
- **Chrome/Edge:** Ctrl+Shift+Delete → "Cached images and files" → Clear data
- **Firefox:** Ctrl+Shift+Delete → "Cache" → Clear Now

### 2. Test Admin Dashboard
1. Navigate to: `https://lmsetjendpdri.duckdns.org/admin/dashboard/`
2. Open DevTools (F12) → Console tab
3. **Look for the integrity warning:**

**Before Fix (❌ Should NOT see this anymore):**
```
A preload for 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css' 
is found, but is not used due to an integrity mismatch.
```

**After Fix (✅ Should see this):**
```
(Clean console, or only expected logs - NO integrity warnings)
```

### 3. Check Network Tab
1. DevTools → Network tab
2. Refresh page (Ctrl+R)
3. Filter by "CSS"
4. Find `bootstrap.min.css`:
   - ✅ Should load **once**
   - ✅ Status: `200 OK`
   - ✅ Size: ~59 KB

### 4. Visual Test
- ✅ Page should display correctly **immediately**
- ✅ No layout shift or flicker
- ✅ Admin header visible with correct colors
- ✅ Dashboard cards properly styled

---

## 🐛 Troubleshooting

### Issue: "git pull" says "Already up to date"
**Cause:** Changes not pushed to GitHub yet

**Solution:**
```bash
# On your local machine (Windows):
cd "d:\Project\LMSetjen DPD RI"
git add frontend/index.html
git commit -m "Fix CSS loading integrity mismatch and FOUC"
git push origin main

# Then on server, try git pull again
```

---

### Issue: Still seeing integrity warning after rebuild
**Cause:** Browser cache not cleared

**Solution:**
1. Hard refresh: Ctrl+F5
2. Clear browser cache completely
3. Try incognito/private window
4. Clear site data: DevTools → Application → Clear storage

---

### Issue: Container won't start
**Check logs:**
```bash
docker logs lms_frontend_prod
```

**Check all containers:**
```bash
docker compose ps -a
```

**Restart all:**
```bash
docker compose restart
```

---

## 📊 Verification Checklist

After deployment, verify:

- [ ] `git pull` shows updated files
- [ ] `grep "Critical Admin Styles" frontend/index.html` returns results
- [ ] `docker compose build --no-cache frontend` completes successfully
- [ ] `docker compose ps` shows frontend container running
- [ ] `docker exec` shows new HTML inside container
- [ ] Browser console shows NO integrity mismatch warning
- [ ] Network tab shows single Bootstrap CSS request
- [ ] Admin dashboard displays correctly on load
- [ ] No FOUC (flash of unstyled content)

---

## ⏱️ Estimated Time
- Git pull: 10 seconds
- Docker rebuild: 2-5 minutes
- Container restart: 5 seconds
- Browser testing: 2 minutes

**Total: ~10 minutes**

---

## 🔄 Quick Command Summary

```bash
# Run all at once:
cd ~/LMSetjen-DPD-RI && \
git pull origin main && \
grep "Critical Admin Styles" frontend/index.html && \
docker compose down frontend && \
docker compose build --no-cache frontend && \
docker compose up -d frontend && \
docker compose ps && \
docker exec lms_frontend_prod cat /usr/share/nginx/html/index.html | grep -A 5 "Critical Admin Styles"
```

Then clear browser cache and test!

---

## ✅ Success Indicators

You'll know it worked when:
1. ✅ No console warnings about integrity mismatch
2. ✅ Page loads with correct styling immediately
3. ✅ Network tab shows single Bootstrap CSS load
4. ✅ No layout shift or flicker on navigation
