# SSO Login Test Guide - Role Verification Fix

## ✅ What Was Fixed

The SSO login flow was successfully storing tokens in cookies but the JWT tokens didn't include the `role` field. This caused `RoleRoute` to reject users with "Unable to verify user role" error.

### Changes Made:

1. **Backend Refactoring** (`backend/api/serializer.py`):
   - Extracted token field logic into reusable `_add_user_fields()` static method
   - Ensures both normal login and SSO use identical token field structure

2. **Backend SSO View** (`backend/api/views.py`):
   - Updated `SSOTokenVerifyAPIView` to use `_add_user_fields()` method
   - Adds all user fields (role, full_name, nip, teacher_id, admin_id, is_active) to both access_token and refresh_token
   - Ensures tokens are properly encoded with all necessary fields

3. **Frontend UserData Plugin** (`frontend/src/views/plugin/UserData.js`):
   - Enhanced to check both access_token and refresh_token for user data
   - Added detailed console logging to show which fields are present in tokens
   - Proper fallback to Zustand store if tokens are unavailable
   - Better error handling for token decode failures

## 🧪 Testing Steps

### Step 1: Clear Browser Cache
1. Open browser DevTools (F12)
2. Go to Application → Cookies → Delete all LMS cookies
3. Clear Local Storage and Session Storage
4. Clear Browser Cache (Ctrl+Shift+Delete)

### Step 2: Open Console
1. Keep DevTools open on Console tab
2. Make sure you can see all console.log output

### Step 3: Test SSO Login
1. Navigate to the login page
2. Click "Login dengan SSO" button
3. This will redirect to SSO provider and back to: `http://localhost:5174/sso/{token}/`
4. Watch the console for these messages (in order):

```
✅ Backend response received: 200
💾 Storing tokens in cookies...
🍪 Tokens stored successfully
Access token cookie: eyJ...
Refresh token cookie: eyJ...
📝 Updating auth store with user data...
✅ Auth store updated successfully
👤 User data: {user_id, username, email, full_name, role, nip, is_active}
User role: student
Redirecting to: /student/dashboard/
```

### Step 4: Verify Token Fields
After redirect to dashboard, look for:

```
🔍 UserData() called - checking for tokens...
Access token exists: true
Refresh token exists: true
✅ UserData: Decoded from refresh_token
   Fields in refresh_token: user_id, exp, iat, jti, token_type, full_name, email, username, role, nip, is_active, teacher_id, admin_id, is_super_admin
   role = student
✅ RoleRoute: User logged in, checking role...
👤 RoleRoute: userData = {all fields including role}
👤 RoleRoute: userData.role = student
✅ RoleRoute: User has permission!
```

### Step 5: Verify Dashboard Access
- Dashboard should load without "Access Denied" error
- You should see the student dashboard with your name and data
- If it shows "Access Denied", check console for error details

## 🔍 Debugging Checklist

### ✅ If Test Passes
- SSO login works identically to normal login
- User can access dashboard with their role
- All role-based features work correctly

### ❌ If Test Fails - Check These Console Messages

#### Issue: "Access token exists: false, Refresh token exists: false"
- **Cause**: Cookies not being set from backend response
- **Fix**: Check browser cookie settings
- **Backend Check**: Verify SSOTokenVerifyAPIView returns proper `access` and `refresh` fields

#### Issue: "Fields in refresh_token: user_id, exp, iat..." (missing role)
- **Cause**: Backend didn't add role field to token
- **Fix**: Restart Django backend (`python manage.py runserver`)
- **Verify**: Check backend console for "✅ JWT tokens generated successfully" message

#### Issue: "role = undefined" despite cookies existing
- **Cause**: Token encoding issue
- **Fix**: 
  1. Check if jwt-decode library is working
  2. Try accessing token directly in console: `jwtDecode(Cookie.get('refresh_token'))`
  3. Look for error messages in console

#### Issue: RoleRoute still shows "Access Denied"
- **Cause**: Multiple possible
- **Debug Steps**:
  1. Check if userData is retrieved: `console.log(UserData())`
  2. Check if role exists: `console.log(UserData().role)`
  3. Check allowed roles: Search RoleRoute console for "allowedRoles ="

## 📊 Comparison: SSO vs Normal Login

| Feature | SSO Login | Normal Login |
|---------|-----------|--------------|
| Token Generation | RefreshToken.for_user() + _add_user_fields() | MyTokenObtainPairSerializer |
| JWT Fields | role, full_name, nip, teacher_id, admin_id, is_active | role, full_name, nip, teacher_id, admin_id, is_active |
| Cookie Storage | Both tokens in cookies | Both tokens in cookies |
| Zustand Store | User data from backend response | User data from decoded token |
| RoleRoute Verification | UserData() from cookies → Zustand fallback | UserData() from cookies → Zustand fallback |
| Dashboard Access | ✅ Should work identically | ✅ Should work identically |

## 📝 Console Log Reference

### SSOLogin.jsx Logs
```
🔐 SSO Login Started
📤 Sending SSO token to backend...
✅ Backend response received: 200
💾 Storing tokens in cookies...
🍪 Tokens stored successfully
📝 Updating auth store with user data...
✅ Auth store updated successfully
👤 User data: {user info}
User role: student
Final user role for redirect: student
Redirecting to: /student/dashboard/
```

### UserData.js Logs
```
🔍 UserData() called - checking for tokens...
Access token exists: true/false
Refresh token exists: true/false
✅ UserData: Decoded from refresh_token (or access_token)
   Fields in refresh_token: [list of fields]
   role = student
✅ UserData: Using Zustand store, role = student
❌ UserData: No user data found in cookies or store
```

### RoleRoute.jsx Logs
```
✅ RoleRoute: User logged in, checking role...
👤 RoleRoute: userData = {user data}
👤 RoleRoute: userData.role = student
✅ RoleRoute: User has permission!
❌ RoleRoute: Permission denied - user role doesn't match allowed roles
❌ RoleRoute: No role data found!
```

## 🚀 Next Steps If Issue Persists

1. **Check Backend Logs**:
   ```
   python manage.py runserver
   Look for: "✅ JWT tokens generated successfully"
   Look for: "🎉 SSO login successful for user: [email]"
   ```

2. **Decode Token Manually**:
   - Open browser console
   - Run: `jwtDecode(Cookie.get('refresh_token'))`
   - Verify role field is present and has correct value

3. **Check Network Request**:
   - Open DevTools → Network tab
   - Look for `/api/v1/sso/verify/` request
   - Check Response → Verify `access` and `refresh` fields exist

4. **Verify Zustand Store**:
   - Open browser console
   - Run: `JSON.stringify(useAuthStore.getState().allUserData, null, 2)`
   - Verify role is present after SSO login

## ✅ Success Criteria

- ✅ SSO login completes successfully
- ✅ Tokens stored in cookies with role field
- ✅ UserData() returns object with role field
- ✅ RoleRoute allows access to dashboard
- ✅ Dashboard loads without "Access Denied" error
- ✅ All role-based features work (student dashboard, etc.)
- ✅ No console errors related to role verification

