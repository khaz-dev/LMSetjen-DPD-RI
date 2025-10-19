# Quick Deployment Guide - CSS Loading Fix

## 🚀 Deployment Steps

### 1. Restart Frontend Container
```powershell
cd "d:\Project\LMSetjen DPD RI"
docker-compose restart frontend
```

**Expected Output:**
```
Restarting lmsetjen_dpd_ri_frontend_1 ... done
```

### 2. Verify Container Health
```powershell
docker-compose ps
```

**Expected Output:**
```
Name                           State    Ports
lmsetjen_dpd_ri_frontend_1     Up       0.0.0.0:3000->80/tcp
```

---

## ✅ Testing Checklist (5 Minutes)

### Test 1: Admin Dashboard Load
1. **Clear browser cache** (Ctrl+Shift+Delete → "Cached images and files")
2. Navigate to: `https://lmsetjendpdri.duckdns.org/admin/dashboard/`
3. **Open DevTools Console** (F12)
4. **Check for warnings:**
   - ❌ Should NOT see: "integrity mismatch" warning
   - ✅ Should see: Clean console (or only expected warnings)

### Test 2: Network Requests
1. Open **DevTools Network tab** (F12 → Network)
2. Refresh page (Ctrl+R)
3. **Check Bootstrap CSS:**
   - ✅ Should load **once** from `cdn.jsdelivr.net`
   - ✅ Status: `200 OK` (not `304 Not Modified` on first load)
   - ❌ Should NOT see multiple requests for same CSS file

### Test 3: Visual Consistency
1. Load `/admin/dashboard/` - **page should display correctly immediately**
2. Navigate to `/admin/users/` - **should remain consistent**
3. Go back to `/admin/dashboard/` - **should still be correct**
4. **Hard refresh** (Ctrl+F5) - **should not flicker or shift layout**

### Test 4: Incognito Mode
1. Open **Incognito/Private window**
2. Navigate to: `https://lmsetjendpdri.duckdns.org/admin/dashboard/`
3. **Verify:** Page displays correctly on **first load** (no FOUC)

---

## 🐛 Troubleshooting

### Issue: Container won't restart
**Solution:**
```powershell
docker-compose down
docker-compose up -d
```

### Issue: Still seeing integrity warnings
**Solution:**
1. Clear browser cache completely (not just "reload")
2. Check if old `index.html` is cached:
```powershell
docker exec lmsetjen_dpd_ri_frontend_1 cat /usr/share/nginx/html/index.html | Select-String -Pattern "integrity"
```
Expected: Should see integrity attribute on `rel="stylesheet"` link

### Issue: CSS still loading incorrectly
**Solution:**
1. Check if component CSS files are being blocked:
```powershell
docker logs lmsetjen_dpd_ri_frontend_1 --tail 50
```
2. Verify nginx is serving static files correctly
3. Check browser DevTools → Sources tab → verify `DashboardAdmin.css` and `AdminHeader.css` are loaded

---

## 📝 Rollback Plan (If Needed)

### If issues occur, revert changes:
```powershell
cd "d:\Project\LMSetjen DPD RI"
git checkout frontend/index.html
docker-compose restart frontend
```

**Note:** This will restore previous version with integrity mismatch (but page will still work)

---

## ✨ Success Indicators

After deployment, you should see:

✅ **No browser console warnings** about integrity mismatch  
✅ **Single Bootstrap CSS request** in Network tab  
✅ **Immediate correct layout** on page load (no flicker)  
✅ **Consistent appearance** across navigation  
✅ **Faster perceived performance** (no CSS loading delay)

---

## 📞 Support

If issues persist after deployment:
1. Capture screenshot of DevTools Console errors
2. Capture screenshot of Network tab (filter: CSS)
3. Note exact steps to reproduce
4. Check `CSS_LOADING_INTEGRITY_FIX.md` for detailed explanation

---

**Estimated Deployment Time:** < 5 minutes  
**Risk Level:** Low (only CSS loading changes, no backend/API changes)  
**Rollback Time:** < 2 minutes
