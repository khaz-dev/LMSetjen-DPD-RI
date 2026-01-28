# Complete Testing Guide - Role Switch Permission Fix

## Quick Summary
**Issue Fixed:** Permission denied error ("Akses ditolak") when accessing instructor dashboard after switching role
**Root Cause:** Frontend `redirectUserByRole()` function couldn't handle string role arguments
**Status:** ✅ FIXED AND VERIFIED

---

## Pre-Testing Checklist

### Backend Requirements
- [ ] Django server running: `python manage.py runserver`
- [ ] PostgreSQL database available
- [ ] Redis running (optional, for caching)
- [ ] User with multi-role (student + instructor) exists in database

### Frontend Requirements
- [ ] React dev server running: `npm run dev`
- [ ] Vite is serving on http://localhost:5173
- [ ] Node modules installed: `npm install`

### Browser Requirements
- [ ] Developer console open (F12)
- [ ] DevTools Network tab visible (to inspect JWT tokens)
- [ ] Cookies accessible (Console tab)

---

## Manual Test Steps

### Test 1: Initial Login as Student
**Expected:** User logs in and sees student dashboard

```
1. Navigate to http://localhost:5173/login
2. Enter credentials for multi-role user:
   - Email: testuser@example.com (or any multi-role user)
   - Password: [password]
3. Click "Login"
4. VERIFY: Redirected to /student/dashboard/
5. VERIFY: Console shows "PHASE 4: Redirecting student to /student/dashboard/"
6. VERIFY: User panel shows "Peran Saat Ini: Student" or similar
```

### Test 2: Open Role Selector
**Expected:** Role selector shows available roles (student, instructor)

```
1. Look for role selector in user menu or header
2. Click on role/profile dropdown
3. VERIFY: See option "Instruktur" or "Instructor"
4. VERIFY: Current role shown as "Student"
```

### Test 3: Switch to Instructor Role ⭐ CRITICAL TEST
**Expected:** User switches to instructor role WITHOUT "Akses ditolak" error

```
1. In role selector, click "Instruktur" / "Instructor"
2. Modal may appear asking to confirm
3. Click "Konfirmasi" / "Confirm" or close modal
4. CRITICAL: Check browser console for logs:
   
   ✅ GOOD LOG:
   "PHASE 4: Redirect by role string: instructor"
   "PHASE 4: Redirecting instructor/teacher to /instructor/dashboard/"
   (URL should change to /instructor/dashboard/)
   
   ❌ BAD LOG:
   "PHASE 4: Redirecting student to /student/dashboard/"
   (This means redirectUserByRole failed)

5. VERIFY: Page redirects to /instructor/dashboard/
6. VERIFY: NO "Akses ditolak" error message appears
7. VERIFY: Dashboard loads successfully with instructor content
8. VERIFY: User menu shows "Peran Saat Ini: Instruktur"
```

### Test 4: Verify JWT Token Content
**Expected:** JWT token contains current_role='instructor'

```
1. Open DevTools Console (F12)
2. Run command to extract JWT:
   ```javascript
   // Get JWT from cookies
   const jwt = document.cookie.split('; ')
     .find(row => row.startsWith('access_token='))
     ?.split('=')[1];
   
   // Decode JWT (without verification)
   const decoded = JSON.parse(
     atob(jwt.split('.')[1])
   );
   
   console.log('JWT current_role:', decoded.current_role);
   console.log('Full JWT:', decoded);
   ```

3. VERIFY OUTPUT should show:
   ```
   JWT current_role: instructor
   Full JWT: {
       user_id: 123,
       email: "user@example.com",
       current_role: "instructor",
       available_roles: ["student", "instructor"],
       ...
   }
   ```
```

### Test 5: Verify RolesContext Update
**Expected:** React Context has updated currentRole

```
1. In React DevTools or Console, verify RolesContext state:
   ```javascript
   // If using React DevTools, inspect App component
   // Look for RolesContext.Provider with value:
   {
     availableRoles: ["student", "instructor"],
     currentRole: "instructor",
     rolesLoading: false
   }
   ```
```

### Test 6: Test Permission Check (RoleRoute)
**Expected:** RoleRoute grants access with instructor role

```
1. You should already be on instructor dashboard from Test 3
2. If accessing /instructor/dashboard/ directly with instructor JWT:
   - Open Console and look for RoleRoute logs:
   
   ✅ GOOD:
   "✅ RoleRoute: User logged in, checking role..."
   "👤 RoleRoute: Using current_role from context: instructor"
   "👤 RoleRoute: userRole = instructor allowedRoles = teacher,instructor"
   "✅ RoleRoute: User has permission!"
   
   ❌ BAD:
   "❌ RoleRoute: Permission denied - user role doesn't match"
   (This shows permission check failed)
```

### Test 7: Switch Back to Student
**Expected:** User can switch back to student role

```
1. In role selector, click "Student"
2. VERIFY: Redirects to /student/dashboard/
3. VERIFY: Console shows correct redirect logs
4. VERIFY: RoleRoute checks pass
5. VERIFY: Student dashboard loads
```

### Test 8: Invalid Role Rejection
**Expected:** Attempting to switch to a role user doesn't have shows error

```
1. In role selector, try to find/select "Admin"
2. If user is only student+instructor (not admin):
   - Should show error: "User does not have admin role"
   - Should show available roles: ["student", "instructor"]
   - Should NOT redirect
3. VERIFY: Still on current dashboard (not switched)
```

### Test 9: Page Reload After Role Switch
**Expected:** Role persists after page reload

```
1. Switch to instructor (Test 3)
2. Press F5 or Ctrl+R to refresh page
3. VERIFY: Still on /instructor/dashboard/
4. VERIFY: JWT still has current_role='instructor'
5. VERIFY: No "Akses ditolak" error
6. Note: May see brief loading state while app fetches roles
```

### Test 10: Browser Back/Forward Navigation
**Expected:** Role persists when navigating with browser buttons

```
1. Login as student, navigate to /student/dashboard/
2. Switch to instructor, should be at /instructor/dashboard/
3. Click browser back button
4. VERIFY: Returns to /student/dashboard/ with correct role
5. Click browser forward button
6. VERIFY: Returns to /instructor/dashboard/ with correct role
```

---

## Automated Testing

### Run Backend Tests
```bash
cd backend
python ../test_role_switch_complete_flow.py
```

**Expected Output:**
```
✅ TEST 1: Initial Login as Student - PASSED
✅ TEST 2: Switch Role to Instructor - PASSED
✅ TEST 3: RoleRoute Permission Check - PASSED
✅ TEST 4: Switch Back to Student - PASSED
✅ TEST 5: Invalid Role Rejection - PASSED
✅ TEST 6: Frontend Redirect Logic - PASSED

═══════════════════════════════════════════════════════════
              TEST SUMMARY
PASSED: 6  FAILED: 0  TOTAL: 6
═══════════════════════════════════════════════════════════

✅ All tests passed! Role switching is working correctly.
```

---

## Browser Console Error Reference

### Error 1: Type Mismatch (BEFORE FIX)
```
❌ PHASE 4: Redirect by user object role: undefined
❌ PHASE 4: No role found, redirecting to student dashboard
```
**Cause:** redirectUserByRole() received string but expected object
**Status:** FIXED ✅

### Error 2: Missing Instructor Support (BEFORE FIX)
```
❌ PHASE 4: Redirecting student to /student/dashboard/
```
**Cause:** No 'case' for 'instructor' role
**Status:** FIXED ✅

### Error 3: Missing Role Data
```
❌ RoleRoute: No role data found!
```
**Cause:** User has no current_role in JWT or context
**Status:** Should not occur if backend properly generated JWT

### Error 4: Permission Denied (EXPECTED FOR SOME CASES)
```
❌ RoleRoute: Permission denied - user role doesn't match
Toast: "Akses ditolak - Anda tidak memiliki izin untuk mengakses halaman ini"
```
**Cause:** User role not in allowed roles for route
**Status:** Normal when accessing route user doesn't have permission for
**Workaround:** Switch to allowed role first

---

## API Endpoints Reference

### 1. Login Endpoint
```
POST /api/v1/auth/login/
Request: { username, password }
Response: {
  access: "jwt_token",
  refresh: "refresh_token",
  current_role: "student",
  available_roles: ["student", "instructor"],
  user_id: 123
}
```

### 2. Select Role Endpoint ⭐ CRITICAL
```
POST /api/v1/auth/select-role/
Headers: Authorization: Bearer {access_token}
Request: { role: "instructor" }
Response: {
  success: true,
  current_role: "instructor",
  available_roles: ["student", "instructor"],
  access_token: "new_jwt_with_updated_role",
  refresh_token: "new_refresh_token"
}
```

### 3. Available Roles Endpoint
```
GET /api/v1/auth/available-roles/
Headers: Authorization: Bearer {access_token}
Response: {
  current_role: "instructor",
  available_roles: ["student", "instructor"],
  roles: "student,instructor"
}
```

---

## Debugging Checklist

If tests fail, check:

### Backend Issues
- [ ] SelectRoleAPIView receives request with correct role
- [ ] Backend validates user has the role
- [ ] New JWT is generated with updated current_role
- [ ] Tokens are returned in response
- [ ] Database user.current_role is updated

### Frontend Issues
- [ ] redirectUserByRole() receives string role
- [ ] Function detects string type correctly
- [ ] Role mapping includes 'instructor' case
- [ ] Window redirect happens to correct URL
- [ ] JWT is stored in cookies after role switch
- [ ] RolesContext is updated via fetchAvailableRoles
- [ ] RoleRoute reads currentRole from context

### Network Issues
- [ ] Check Network tab in DevTools
- [ ] Verify POST to /api/v1/auth/select-role/ returns 200
- [ ] Check response includes new tokens
- [ ] Verify Authorization header includes JWT

### Session/Cookie Issues
- [ ] Check DevTools Storage → Cookies
- [ ] Verify access_token cookie exists
- [ ] Verify refresh_token cookie exists
- [ ] Check cookie expiration dates
- [ ] Check cookie domain and path

---

## Success Criteria

**Test is successful when:**
1. ✅ User can login with multi-role account
2. ✅ User can select different role from selector
3. ✅ Correct dashboard loads for selected role (NO "Akses ditolak" error)
4. ✅ Browser console shows correct redirect logs
5. ✅ JWT token contains updated current_role
6. ✅ RoleRoute grants access with correct role
7. ✅ Role persists after page reload
8. ✅ User can switch back to previous role
9. ✅ Invalid role switch shows error
10. ✅ All 3 roles work (student, instructor, admin)

**If all criteria pass:** ✅ Fix verified and ready for production

---

## Regression Testing

After deploying, verify no regressions:

### Single-Role Users
- [ ] Student-only users still access student dashboard
- [ ] Teacher-only users still access instructor dashboard
- [ ] Admin-only users still access admin dashboard

### Multi-Role Users
- [ ] Can switch between available roles
- [ ] Cannot switch to unavailable roles
- [ ] Role persists across page refreshes

### Edge Cases
- [ ] Logout clears role selection
- [ ] Fresh login restores default role
- [ ] Expired JWT handled gracefully
- [ ] Invalid role in database doesn't break app

---

## Support & Troubleshooting

### Common Issues & Solutions

**Issue:** Page redirects to student dashboard instead of instructor
- **Solution:** Check browser console for redirectUserByRole logs
- **Check:** redirectUserByRole() receiving string vs object

**Issue:** "Akses ditolak" error on instructor dashboard
- **Solution:** Check RoleRoute permission logs
- **Check:** JWT has current_role='instructor'

**Issue:** Role doesn't update after switch
- **Solution:** Check Network tab for /select-role/ response
- **Check:** Verify tokens updated in cookies

**Issue:** RolesContext not updating
- **Solution:** Check if fetchAvailableRoles() called
- **Check:** Verify App.jsx useEffect fires

---

*Test Documentation Complete*
*Phase: Phase 4.15+ Multi-Role System*
