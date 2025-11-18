# SSO Login Debugging & Verification Guide

## Quick Verification Steps

### 1. Check Backend Token Fields
**Expected:** JWT token includes all user data fields

**How to Verify:**
```bash
# 1. Go to browser console (F12)
# 2. Trigger SSO login
# 3. Look for this log line:
👤 Setting auth user from decoded token: {
  token_type: "access",
  exp: 1763734429,
  iat: 1763475229,
  jti: "85ed4b21adc343d98d7fbd6f56c35553",
  user_id: 54,
  username: "user@email.com",
  email: "user@email.com",
  full_name: "KHAIRIL AZMI ASHARI, S.Kom",  ← ✅ MUST BE PRESENT
  role: "student",                          ← ✅ MUST BE PRESENT
  nip: "199701182025061001",                ← ✅ MUST BE PRESENT
  teacher_id: 0,
  admin_id: 0,
  is_super_admin: false,
  is_active: true
}
```

**✅ Success:** If you see `full_name`, `role`, `nip` fields with values
**❌ Failure:** If only see `{token_type, exp, iat, jti, user_id}`

---

### 2. Check Auth Store State
**Expected:** Auth store has complete user data

**How to Verify:**
```bash
# 1. Open Browser DevTools (F12)
# 2. Look for "Simple Zustand DevTools" (bottom right)
# 3. Click on it to expand
# 4. Find "Store" tab
# 5. Look for `allUserData` object
# 6. Expand it - should have:

allUserData: {
  user_id: 54,
  username: "user@email.com",
  email: "user@email.com",
  full_name: "KHAIRIL AZMI ASHARI, S.Kom",  ← ✅ MUST BE PRESENT
  role: "student",                          ← ✅ MUST BE PRESENT
  nip: "199701182025061001",                ← ✅ MUST BE PRESENT
  token_type: "access",
  exp: 1763734429,
  iat: 1763475229,
  jti: "85ed4b21...",
  teacher_id: 0,
  admin_id: 0,
  is_super_admin: false,
  is_active: true
}
```

**✅ Success:** If allUserData has all these fields
**❌ Failure:** If allUserData only has user_id and token fields

---

### 3. Check Header Display
**Expected:** Dashboard header shows user's actual name

**How to Verify:**
```bash
# 1. After SSO login, dashboard should load
# 2. Look at top-right corner header
# 3. Should show:
   - Profile picture (if available)
   - User's name: "KHAIRIL AZMI ASHARI, S.Kom"  ← ✅ MUST SEE THIS
   - NOT: "Peserta" ❌

# 4. If it shows something, check sidebar too
# 5. Sidebar should also show same name
```

**✅ Success:** Header shows "KHAIRIL AZMI..." or first 3 words of name
**❌ Failure:** Header shows "Peserta" or blank

---

### 4. Check Dashboard Access
**Expected:** Student dashboard loads without Access Denied error

**How to Verify:**
```bash
# 1. After SSO login, you should be on dashboard
# 2. Dashboard should show:
   - Course statistics
   - Recent activity
   - Progress bars
   - NO error notifications

# 3. NO notification should say:
   ❌ "Access Denied"
   ❌ "Unable to verify user role"
   ❌ "Please log in again"

# 4. If you see any error:
   - Check console for error messages
   - Verify role is "student"
```

**✅ Success:** Dashboard loads with all content visible
**❌ Failure:** Toast notification with "Access Denied" error

---

## Detailed Debugging Steps

### If Token Still Missing Fields

**Step 1:** Check Backend Response
```bash
# Open Network tab (F12 → Network)
# Trigger SSO login
# Find request to: /api/v1/sso/verify/
# Look at Response tab
# Should see JSON with "user" object:

{
  "access": "eyJ0eXAi...",
  "refresh": "eyJ0eXAi...",
  "user": {
    "id": 54,
    "email": "user@email.com",
    "full_name": "KHAIRIL AZMI ASHARI, S.Kom",  ← ✅ Must be here
    "role": "student",                          ← ✅ Must be here
    "nip": "199701182025061001",                ← ✅ Must be here
    "is_active": true
  }
}
```

**✅ If "user" object has all fields:** Backend is correct, problem is frontend
**❌ If "user" object missing fields:** Problem is in backend/api/views.py SSO endpoint

---

**Step 2:** Check JWT Token Content
```bash
# 1. Copy the "access" token value from above
# 2. Go to https://jwt.io/
# 3. Paste the token in the left side under "Encoded"
# 4. Look at the Payload (middle section)
# 5. Should show:

{
  "token_type": "access",
  "exp": 1763734429,
  "iat": 1763475229,
  "jti": "...",
  "user_id": 54,
  "full_name": "KHAIRIL AZMI ASHARI, S.Kom",  ← ✅ Must be here
  "email": "user@email.com",                  ← ✅ Must be here
  "username": "user@email.com",               ← ✅ Must be here
  "role": "student",                          ← ✅ Must be here
  "nip": "199701182025061001",                ← ✅ Must be here
  "is_active": true                           ← ✅ Must be here
}
```

**✅ If token has all fields:** Backend is working correctly
**❌ If token missing fields:** Backend SSO endpoint not adding them (check backend/api/views.py line 260-288)

---

### If Role Still Undefined in Store

**Step 1:** Check if UserData() Works
```bash
# In browser console, type:
UserData()

# Should return object with role:
{
  ...,
  role: "student",
  full_name: "KHAIRIL AZMI ASHARI, S.Kom",
  ...
}

# NOT undefined, NOT {}, NOT null
```

**Step 2:** Check Cookies
```bash
# In browser console, type:
document.cookie

# Should show:
access_token=eyJ0eXAi...;
refresh_token=eyJ0eXAi...;
```

**Step 3:** If Cookies Empty
```bash
# Check Zustand store directly:
# 1. Use Zustand DevTools (bottom right)
# 2. Look at allUserData
# 3. Should have role: "student"
```

---

### If Header Still Shows "Peserta"

**Step 1:** Check getDisplayName() Function
```bash
# In browser console, go to BaseHeader component
# Check what getDisplayName() returns:

# It should do:
const displayName = 
  allUserData?.full_name ||      // Try this first
  userData?.full_name ||          // Try this second
  user()?.full_name ||            // Try this third
  '';                             // Finally empty string

# So should get "KHAIRIL AZMI ASHARI, S.Kom"
```

**Step 2:** Debug allUserData in BaseHeader
```bash
# In browser DevTools Components tab
# Find BaseHeader component
# Look at props/state:
  allUserData: {
    full_name: "KHAIRIL AZMI ASHARI, S.Kom",  ← ✅ Must be here
    ...
  }
```

---

## Common Issues & Solutions

### Issue 1: Token Only Has {user_id}
```
Symptom: Console shows:
👤 Setting auth user from decoded token: {
  token_type: "access",
  exp: ...,
  iat: ...,
  jti: "...",
  user_id: 54
}
(No full_name, role, nip)
```

**Solution:**
1. Check backend/api/views.py lines 260-288
2. Verify these lines exist:
   ```python
   refresh.access_token['full_name'] = user.full_name
   refresh.access_token['email'] = user.email
   refresh.access_token['role'] = user.role
   refresh.access_token['nip'] = user.nip
   ```
3. If missing, add them
4. Restart backend server
5. Try SSO login again

---

### Issue 2: Header Shows "Peserta" Instead of Name
```
Symptom:
- Console shows full_name is present
- But header still displays "Peserta"
```

**Solution:**
1. Hard refresh page (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Check BaseHeader.jsx lines 108-117
4. Verify getDisplayName() function logic
5. Check allUserData in Zustand DevTools

---

### Issue 3: "Access Denied - Unable to verify user role"
```
Symptom:
- Toast notification appears
- Dashboard doesn't load
- Console shows error
```

**Solution:**
1. Check RoleRoute.jsx receives userData with role
2. Verify role === "student" or correct value
3. Check that auth store has role field
4. Check UserData() returns role
5. Verify user in database has role field set

**Debug Code:**
```bash
# In console:
const userData = UserData();
console.log("UserData:", userData);
console.log("Role:", userData?.role);

# Should show:
UserData: { ..., role: "student", ... }
Role: "student"
```

---

### Issue 4: Zustand DevTools Not Showing Store
```
Symptom:
- Can't see Simple Zustand DevTools at bottom
```

**Solution:**
1. Page must be in development mode
2. Check vite.config.js has Zustand plugin
3. Look bottom-right corner of page
4. Should see circular icon
5. Click to expand store

---

## Console Log Trace

### Complete Successful Flow

```javascript
// 1. SSO Login started
🔐 SSO Login Started
SSO Token: eyJ0eXAi...
API Base URL: http://localhost:8000/api/v1/

// 2. Sending to backend
📤 Sending SSO token to backend...

// 3. Backend response received
✅ Backend response received: 200
Response data: {
  access: "eyJ0eXAi...",
  refresh: "eyJ0eXAi...",
  user: { id, email, full_name, role, nip },
  ...
}

// 4. Auth store updated with response
📝 Updating auth store with user data...
✅ Auth store updated successfully

// 5. Tokens stored in cookies
💾 Storing tokens in cookies...
🍪 Tokens stored successfully

// 6. setAuthUser called
🔐 Auth tokens set with options: { expires: 1, secure: false, sameSite: 'Lax' }
👤 Setting auth user from decoded token: { ..., full_name, role, nip, ... }
📦 Merged user data: { ..., full_name, role, nip, ... }

// 7. Toast shown
[Success Toast displayed]

// 8. Redirect
Redirecting to: /student/dashboard/

// 9. Dashboard page
[Dashboard loads with user data, header shows name, no errors]
```

---

## Testing Checklist

- [ ] SSO login triggered
- [ ] Token in console has all fields (full_name, role, nip, email)
- [ ] Auth store shows all fields in Zustand DevTools
- [ ] Header displays user's full name (not "Peserta")
- [ ] Dashboard loads without errors
- [ ] No "Access Denied" notification
- [ ] Sidebar shows correct user name
- [ ] UserData() returns complete object with role
- [ ] Cookies set correctly (check Application tab)
- [ ] No console errors

---

## If All Tests Pass ✅

Congratulations! SSO login is working seamlessly:
- ✅ User can login via SSO
- ✅ Full name displays correctly
- ✅ Dashboard accessible
- ✅ Role verification works
- ✅ Tokens stored properly
- ✅ All fields available to components

---

## If Issues Remain ❌

1. Clear browser data completely:
   - DevTools → Application → Clear all
   - Restart browser
   - Try SSO login again

2. Restart backend server:
   - Stop Django dev server
   - Stop Node dev server
   - Start both fresh

3. Check git status:
   - Verify all changes are committed
   - Check backend/api/views.py has the token field additions
   - Check frontend/src/utils/auth.js has the merge logic

4. Check database:
   - Verify user record exists with NIP
   - Verify role field is set
   - Verify is_active = True

5. Final verification:
   - Compare your code with commit b4367f3
   - Look for differences
   - Apply any missing changes manually

---

**Version:** 1.0
**Last Updated:** November 18, 2025
**Status:** Complete
