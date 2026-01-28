# Admin Dashboard Fixes - Quick Testing Guide

## Executive Summary
✅ **2 Critical Issues Fixed**
1. DOM nesting warning (nested `<button>` elements)
2. 403 Forbidden errors on admin API endpoints

---

## Issue #1: DOM Nesting Warning - FIXED ✅

### What Was Wrong
```
Warning: validateDOMNesting(...): <button> cannot appear as a descendant of <button>.
```

**Location:** [AdminHeader.jsx](frontend/src/views/partials/AdminHeader.jsx) line 205

### What Changed
```jsx
// BEFORE (line 205)
<div style={{marginTop: '2px'}}>
  <RoleIndicator compact={true} />
</div>

// AFTER (line 205)
<span style={{marginTop: '2px', display: 'inline-flex', alignItems: 'center'}}>
  <RoleIndicator compact={true} />
</span>
```

### How to Verify
1. Open http://localhost:5173/admin/dashboard/
2. Open browser DevTools (F12)
3. Go to Console tab
4. **Expected:** No "nested button" warning ✅
5. **Previously:** Warning about button nesting ❌

---

## Issue #2: 403 Forbidden Errors - FIXED ✅

### What Was Wrong
```
GET http://127.0.0.1:8000/api/v1/admin/dashboard-summary/ 403 (Forbidden)
GET http://127.0.0.1:8000/api/v1/admin/enrollment-analytics/ 403 (Forbidden)
GET http://127.0.0.1:8000/api/v1/admin/system-health/ 403 (Forbidden)
```

**Cause:** Views used manual role check instead of permission class

### What Changed
**File:** [backend/api/views.py](backend/api/views.py)

**3 Views Updated:**
1. **Line 4328:** `AdminSummaryAPIView`
2. **Line 4543:** `AdminEnrollmentAnalyticsAPIView`
3. **Line 4620:** `AdminSystemHealthAPIView`

**Before:**
```python
permission_classes = [IsAuthenticated]  # ❌ Missing IsAdminUser!
```

**After:**
```python
permission_classes = [IsAuthenticated, IsAdminUser]  # ✅ Proper permission check
```

### How to Verify
1. Open admin dashboard: http://localhost:5173/admin/dashboard/
2. Open browser DevTools (F12)
3. Go to Console tab
4. **Expected Results:**
   - ✅ No 403 errors for admin endpoints
   - ✅ Dashboard data loads (GET 200 responses)
   - ✅ Enrollment analytics loads
   - ✅ System health loads

5. **Previously Seen (Now Fixed):**
   - ❌ Multiple 403 Forbidden errors
   - ❌ Dashboard data blank
   - ❌ AxiosError messages in console

---

## Full Testing Procedure

### Prerequisites
- [ ] Backend running: `python manage.py runserver` (port 8000)
- [ ] Frontend running: `npm run dev` (port 5173)
- [ ] Logged in as admin user

### Step 1: Clear Browser Cache
```
F12 → Application → Clear all
Refresh page (Ctrl+Shift+R or Cmd+Shift+R)
```

### Step 2: Check Console for Warnings
1. Open http://localhost:5173/admin/dashboard/
2. Press F12 → Console tab
3. Verify:
   - ✅ No "validateDOMNesting" warnings
   - ✅ No "nested button" errors
   - ✅ RoleRoute logs show: "✅ User has permission!"

**Expected Console Output:**
```
✅ RoleRoute: User logged in, checking role...
👤 RoleRoute: Using current_role from context: admin
👤 RoleRoute: userRole = admin allowedRoles = ['admin']
✅ RoleRoute: User has permission!
PHASE 4: Available roles fetched: (3) ['student', 'instructor', 'admin']
```

**NOT Expected:**
```
❌ Warning: validateDOMNesting(...): <button> cannot appear as a descendant of <button>
❌ GET .../api/v1/admin/dashboard-summary/ 403 (Forbidden)
❌ AxiosError {message: 'Request failed with status code 403'}
```

### Step 3: Verify Dashboard Data Loads

1. **Dashboard Summary Should Show:**
   - Total Students
   - Total Teachers
   - Total Admins
   - Total Courses
   - Active Courses
   - Total Enrollments
   - Recent Enrollments
   - Total Certificates
   - Recent Certificates
   - Total Reviews

2. **API Calls Should Succeed:**
   ```
   ✅ GET http://127.0.0.1:8000/api/v1/admin/dashboard-summary/ 200 OK
   ✅ GET http://127.0.0.1:8000/api/v1/admin/enrollment-analytics/ 200 OK
   ✅ GET http://127.0.0.1:8000/api/v1/admin/system-health/ 200 OK
   ```

### Step 4: Check Admin Header

1. Look for role indicator in top-right corner
2. Should show current role badge (e.g., "Administrator")
3. Should NOT show any visual errors
4. Role indicator should be clickable to switch roles

### Step 5: Test Role Switching

1. Click on admin role badge in header
2. Select "Peserta" (Student) role
3. Verify page redirects to `/student/dashboard/`
4. Switch back to admin role
5. Verify dashboard loads again correctly

### Step 6: Verify Non-Admin Access Denied

Test with a student account:
1. Log out from admin account
2. Log in as student
3. Manually navigate to: http://localhost:5173/admin/dashboard/
4. **Expected:** Should see "Akses ditolak" (Access Denied) message
5. **Should NOT:** Show 403 errors in console (React error boundary handles it)

---

## Troubleshooting

### Still Seeing 403 Errors?

**1. Check Backend Server Status**
```bash
# Verify Django is running
curl http://127.0.0.1:8000/api/v1/admin/dashboard-summary/
# Should prompt authentication, not give 403
```

**2. Restart Backend**
```bash
# Kill and restart Django server
cd backend
python manage.py runserver
```

**3. Check User Permissions**
```bash
# In Django shell
python manage.py shell
>>> from userauths.models import User
>>> u = User.objects.get(username='your_admin_username')
>>> u.is_admin  # Should be True
>>> u.role  # Should be 'admin'
>>> u.current_role  # Should be 'admin'
```

### Still Seeing Nested Button Warning?

**1. Clear Cache Completely**
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or manually: F12 → Application → Clear all storage
- Close browser tab and reopen

**2. Check Frontend Code**
- Verify [AdminHeader.jsx](frontend/src/views/partials/AdminHeader.jsx) line 205 shows `<span>` not `<div>`

**3. Rebuild Frontend**
```bash
cd frontend
npm run build
npm run dev
```

---

## Expected vs Actual

### Before Fixes ❌
```
Console Errors:
- Warning: validateDOMNesting(...): <button> cannot appear as a descendant of <button>
- GET http://127.0.0.1:8000/api/v1/admin/dashboard-summary/ 403 (Forbidden)
- GET http://127.0.0.1:8000/api/v1/admin/enrollment-analytics/ 403 (Forbidden)
- GET http://127.0.0.1:8000/api/v1/admin/system-health/ 403 (Forbidden)
- Error fetching dashboard data: AxiosError {...}

Dashboard Display:
- Loading spinner never completes
- Dashboard cards empty
- No statistics displayed
```

### After Fixes ✅
```
Console Output:
✅ RoleRoute: User logged in, checking role...
👤 RoleRoute: Using current_role from context: admin
✅ RoleRoute: User has permission!
PHASE 4: Available roles fetched: (3) ['student', 'instructor', 'admin']
(No DOM nesting warnings)
(No 403 errors)

Dashboard Display:
- Dashboard statistics load correctly
- All charts and cards populate with data
- Role indicator shows in header
- Role switching works
```

---

## API Endpoint Testing

### Test Admin Dashboard Summary
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://127.0.0.1:8000/api/v1/admin/dashboard-summary/
  
# Expected: 200 OK with dashboard data
# Before fix: 403 Forbidden
```

### Test Enrollment Analytics
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://127.0.0.1:8000/api/v1/admin/enrollment-analytics/
  
# Expected: 200 OK with analytics data
# Before fix: 403 Forbidden
```

### Test System Health
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://127.0.0.1:8000/api/v1/admin/system-health/
  
# Expected: 200 OK with system health data
# Before fix: 403 Forbidden
```

---

## Rollback Instructions (If Needed)

If for any reason you need to revert these changes:

### Revert Frontend
**File:** [frontend/src/views/partials/AdminHeader.jsx](frontend/src/views/partials/AdminHeader.jsx)

**Restore line 205:**
```jsx
// Change this:
<span style={{marginTop: '2px', display: 'inline-flex', alignItems: 'center'}}>

// Back to:
<div style={{marginTop: '2px'}}>
```

### Revert Backend
**File:** [backend/api/views.py](backend/api/views.py)

**For each of 3 views:**
1. Line 4328: Remove `IsAdminUser` from permission_classes
2. Line 4543: Remove `IsAdminUser` from permission_classes
3. Line 4620: Remove `IsAdminUser` from permission_classes

**From:**
```python
permission_classes = [IsAuthenticated, IsAdminUser]
```

**Back to:**
```python
permission_classes = [IsAuthenticated]
```

**Then restart server:**
```bash
# Backend
python manage.py runserver

# Or full rebuild if needed
docker-compose restart
```

---

## Success Criteria

All items must be ✅ for fixes to be considered complete:

- [ ] No "nested button" warnings in console
- [ ] No 403 errors for admin API endpoints
- [ ] Dashboard loads and displays data
- [ ] Role indicator visible and functional
- [ ] Role switching works
- [ ] Non-admin users still denied access
- [ ] All 3 admin API endpoints return 200 OK
- [ ] System health shows correct data
- [ ] Enrollment analytics loads

---

## Verification Complete When:
✅ Dashboard loads without errors  
✅ All 3 API endpoints return 200 OK  
✅ Console shows no warnings  
✅ Role indicator renders correctly  
✅ Role switching functional  

---

## Questions?

Refer to main documentation: [ADMIN_DASHBOARD_FIXES_PHASE_4_17.md](ADMIN_DASHBOARD_FIXES_PHASE_4_17.md)

---

**Test Version:** 1.0  
**Last Updated:** January 26, 2026  
**Status:** Ready for Testing
