# Multi-Role Switching - Quick Test Guide

## ⚡ Quick Test (2 minutes)

### Prerequisites
- ✅ Backend running: `python manage.py runserver`
- ✅ Frontend running: `npm run dev`
- ✅ User account with multiple roles (admin, instructor, student)

### Test Steps

#### Step 1: Initial Login
1. Go to http://localhost:5173/login/
2. Enter credentials for a user with multiple roles
3. Select **"Admin"** role
4. Click "Login"
5. **Expected:** ✅ Admin dashboard loads

**Console Check:**
```
PHASE 4: Available roles fetched: (3) ['student', 'instructor', 'admin']
✅ RoleRoute: User has permission!
```

---

#### Step 2: Switch Role (First Switch)
1. Look at top-right header
2. Click on role indicator (shows current role)
3. Select **"Instruktur"** (Instructor)
4. **Expected:** 
   - ✅ Success toast appears: "You are now in **Instruktur** mode"
   - ✅ Page reloads automatically
   - ✅ Instructor dashboard loads
   - ✅ NO "Akses ditolak" error ✅

**Console Check:**
```
PHASE 4.17: Switching to role: instructor
PHASE 4.17: Role switched successfully
PHASE 4.17: Auth tokens updated in cookies
PHASE 4.17: Zustand store updated
PHASE 4.17: Calling onRoleSwitch callback to refresh RolesContext
PHASE 4.17: Role switch callback triggered, refreshing RolesContext
```

---

#### Step 3: Switch Role (Second Switch)
1. Click role indicator again
2. Select **"Peserta"** (Student)
3. **Expected:**
   - ✅ Success toast: "You are now in **Peserta** mode"
   - ✅ Student dashboard loads
   - ✅ No permission errors
   - ✅ Student features visible

---

#### Step 4: Switch Back to Admin
1. Click role indicator
2. Select **"Administrator"** (Admin)
3. **Expected:**
   - ✅ Admin dashboard loads
   - ✅ Admin features visible
   - ✅ All roles accessible

---

## ✅ Success Criteria

All must be ✅ for fix to be complete:

- [ ] Initial login works with any role
- [ ] Role indicator visible in header
- [ ] First role switch succeeds (success toast appears)
- [ ] New dashboard loads after switch
- [ ] NO "Akses ditolak" error appears
- [ ] Second role switch also works
- [ ] Can switch between all available roles
- [ ] Console shows PHASE 4.17 logs
- [ ] No warnings or errors in console
- [ ] User can access all role features after switch

---

## 🔍 Console Output - Expected

### When switching to Instructor:

```javascript
// From switchRole function:
PHASE 4.17: Switching to role: instructor
PHASE 4.17: Role switched successfully
PHASE 4.17: Auth tokens updated in cookies
PHASE 4.17: Zustand store updated
PHASE 4.17: Calling onRoleSwitch callback to refresh RolesContext
PHASE 4.17: Role switch callback triggered, refreshing RolesContext

// From App reload:
PHASE 4: Available roles fetched: (3) ['student', 'instructor', 'admin']

// From RoleRoute check:
✅ RoleRoute: User logged in, checking role...
👤 RoleRoute: Using current_role from context: instructor
👤 RoleRoute: userRole = instructor allowedRoles = ['instructor']
✅ RoleRoute: User has permission!
```

### NOT Expected:

```javascript
❌ RoleRoute: Permission denied - user role doesn't match allowed roles
❌ Akses Ditolak (should NOT appear)
❌ 403 Forbidden errors
```

---

## 🐛 Troubleshooting

### Problem: "Akses ditolak" still appears after switch

**Solution 1: Clear browser cache**
```
Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
→ Clear cookies and site data
→ Refresh page
```

**Solution 2: Restart servers**
```bash
# Backend
Ctrl+C to stop
python manage.py runserver

# Frontend  
Ctrl+C to stop
npm run dev
```

**Solution 3: Check browser console (F12)**
- Look for error messages
- Verify "PHASE 4.17" logs appear
- Check network tab for 400/403 errors

---

### Problem: Role doesn't actually switch (still shows old role)

**Check 1: Verify JWT Token Updated**
```javascript
// In browser console (F12):
import Cookies from 'js-cookie'
import jwtDecode from 'jwt-decode'
let token = Cookies.get('refresh_token')
jwtDecode(token).current_role
// Should show: 'instructor' (or new role)
```

**Check 2: Backend logs**
```bash
# Look for in Django console:
POST /api/v1/auth/select-role/ 200
# Should see response with new role
```

**Check 3: API test**
```bash
curl -X POST http://localhost:8000/api/v1/auth/select-role/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "instructor"}'

# Should return:
{
  "success": true,
  "message": "Successfully switched to instructor role",
  "current_role": "instructor",
  "access_token": "...",
  "refresh_token": "..."
}
```

---

## 📊 Test Results Template

```
Test Date: ___________
Tester: ___________

Initial Login:
- Role selected: [ ] Admin  [ ] Instructor  [ ] Student
- Dashboard loaded: [ ] Yes  [ ] No

First Role Switch:
- From role: ___________
- To role: ___________
- Success toast appeared: [ ] Yes  [ ] No
- New dashboard loaded: [ ] Yes  [ ] No
- Errors: [ ] None  [ ] Yes (describe): ___________

Second Role Switch:
- From role: ___________
- To role: ___________
- Success: [ ] Yes  [ ] No
- Errors: [ ] None  [ ] Yes (describe): ___________

Overall Test:
- All role switches successful: [ ] Yes  [ ] No
- No "Akses ditolak" errors: [ ] Yes  [ ] No
- Console clean (no errors): [ ] Yes  [ ] No
- Ready for production: [ ] Yes  [ ] No

Notes: ___________________________________________
```

---

## 🚀 What to Test

| Item | Test | Result |
|------|------|--------|
| **Login** | Log in with admin role | ✅ Pass / ❌ Fail |
| **Initial Dashboard** | Admin dashboard loads | ✅ Pass / ❌ Fail |
| **Role Indicator** | Visible in header | ✅ Pass / ❌ Fail |
| **First Switch** | Switch to Instructor | ✅ Pass / ❌ Fail |
| **Toast Notification** | Success message appears | ✅ Pass / ❌ Fail |
| **New Dashboard** | Instructor dashboard loads | ✅ Pass / ❌ Fail |
| **Second Switch** | Switch to Student | ✅ Pass / ❌ Fail |
| **Student Dashboard** | Student dashboard loads | ✅ Pass / ❌ Fail |
| **Switch Back** | Switch back to Admin | ✅ Pass / ❌ Fail |
| **Final Dashboard** | Admin dashboard loads again | ✅ Pass / ❌ Fail |
| **Console Logs** | PHASE 4.17 logs present | ✅ Pass / ❌ Fail |
| **No Errors** | Console has no errors | ✅ Pass / ❌ Fail |

---

## 🎯 Expected Behavior Flow

```
User Login (Admin)
     ↓
Admin Dashboard ✅
     ↓
Click Role Indicator
     ↓
Select Instructor
     ↓
Success Toast ✅
     ↓
Page Reload
     ↓
Instructor Dashboard ✅
     ↓
Click Role Indicator
     ↓
Select Student
     ↓
Success Toast ✅
     ↓
Page Reload
     ↓
Student Dashboard ✅
```

---

## ✅ PASS Criteria

**Test PASSES if:**
- ✅ No "Akses ditolak" error when switching roles
- ✅ All dashboards load correctly after switch
- ✅ Role indicator shows correct current role
- ✅ Console logs show PHASE 4.17 messages
- ✅ All role features accessible after switch
- ✅ User can switch multiple times without issues

**Test FAILS if:**
- ❌ "Akses ditolak" appears during role switch
- ❌ Dashboard doesn't load after switch
- ❌ Old role shown in permission error
- ❌ Console shows errors or 403 responses
- ❌ Features not accessible for switched role

---

## 📞 If Tests Fail

1. Check documentation: [MULTI_ROLE_SYSTEM_SEAMLESS_SWITCHING_FIX.md](MULTI_ROLE_SYSTEM_SEAMLESS_SWITCHING_FIX.md)
2. Review console logs (F12)
3. Check network tab for API responses
4. Restart both servers
5. Clear browser cache completely
6. Try with different user account

---

**Test Version:** 1.0  
**Last Updated:** January 26, 2026  
**Status:** Ready for Testing
