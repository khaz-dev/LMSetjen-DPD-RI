# SSO Data Flow Diagrams

## Complete SSO Login Flow - Visual Representation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER CLICKS SSO LINK                                │
│                    /sso/eyJ0eXAi...KpDGrIMqIdrXj...                        │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND: SSOLogin Component                             │
│                                                                              │
│  1. Extract SSO token from URL parameter                                    │
│  2. Send POST /api/v1/sso/verify/ {sso_token}                               │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND: SSOTokenVerifyAPIView                           │
│                                                                              │
│  1. Decode SSO token (external provider JWT)                                │
│  2. Extract NIP from token                                                  │
│  3. Find or create user by NIP                                              │
│  4. Generate RefreshToken.for_user(user)                                    │
│  5. ✅ NEW: Add all fields to access_token:                                 │
│     ├─ full_name: "KHAIRIL AZMI ASHARI, S.Kom"                             │
│     ├─ email: "khairil@email.com"                                          │
│     ├─ role: "student"                                                      │
│     ├─ nip: "199701182025061001"                                           │
│     ├─ teacher_id: 0                                                        │
│     ├─ admin_id: 0                                                          │
│     ├─ is_super_admin: false                                                │
│     └─ is_active: true                                                      │
│                                                                              │
│  6. Return Response with:                                                   │
│     ├─ access: JWT string (with ALL fields above)                           │
│     ├─ refresh: JWT string (with ALL fields above)                          │
│     └─ user: {id, email, full_name, role, nip, is_active}                 │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
              Backend Response over HTTP
┌──────────────────────────────────────────────────────────────────────┐
│ {                                                                     │
│   "access": "eyJ0eXAi.eyJu...bHQ=",   (Contains full_name, role...│
│   "refresh": "eyJ0eXAi.eyJu...bHQ=",  (Contains full_name, role...│
│   "user": {                                                           │
│     "id": 54,                                                         │
│     "email": "khairil@email.com",                                    │
│     "full_name": "KHAIRIL AZMI ASHARI, S.Kom",                       │
│     "role": "student",                                                │
│     "nip": "199701182025061001",                                     │
│     "is_active": true                                                 │
│   }                                                                   │
│ }                                                                     │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND: SSOLogin Processes Response                    │
│                                                                              │
│  Step 1: Extract tokens and user object                                     │
│  ├─ const { access, refresh, user } = response.data                        │
│  └─ user = {id, email, full_name, role, nip, is_active}                    │
│                                                                              │
│  Step 2: Update Auth Store ✅ (with response user object)                   │
│  ├─ useAuthStore.setUser({                                                 │
│  │   user_id: 54,                                                           │
│  │   username: "khairil@email.com",                                        │
│  │   email: "khairil@email.com",                                           │
│  │   full_name: "KHAIRIL AZMI ASHARI, S.Kom",  ✅ STORED HERE             │
│  │   role: "student",                            ✅ STORED HERE             │
│  │   nip: "199701182025061001",                 ✅ STORED HERE             │
│  │   is_active: true                                                        │
│  │ })                                                                        │
│  └─ Auth Store now: {full_name, role, nip, email, user_id}                │
│                                                                              │
│  Step 3: Store Tokens in Cookies ✅                                         │
│  ├─ Cookie.set('access_token', access)    (Has full_name, role, nip)      │
│  └─ Cookie.set('refresh_token', refresh)  (Has full_name, role, nip)      │
│                                                                              │
│  Step 4: Call setAuthUser(access, refresh) ✅                              │
│  └─ This MERGES token data with existing store (NEW BEHAVIOR)              │
│     Current Store: {full_name, role, nip, ...}                             │
│     + Decoded Token: {user_id, exp, iat, ...}                              │
│     = Result: {full_name, role, nip, user_id, exp, iat, ...}              │
│                                                                              │
│  Step 5: Show Success Toast                                                 │
│  └─ "Welcome! You are logged in via SSO."                                  │
│                                                                              │
│  Step 6: Navigate to Dashboard                                              │
│  └─ navigate('/student/dashboard/')                                        │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND: Route Verification                             │
│                                                                              │
│  PrivateRoute Check:                                                        │
│  ├─ Is user logged in?                                                     │
│  ├─ useAuthStore.isLoggedIn() → allUserData !== null                       │
│  └─ ✅ PASS (has data)                                                      │
│                                                                              │
│  RoleRoute Check (if route restricted):                                     │
│  ├─ Get user role: userData = UserData()                                   │
│  │  └─ UserData() reads from cookie → decode JWT → all fields ✅           │
│  │  └─ Fallback to Zustand store if needed ✅                              │
│  ├─ Check if role matches: userData.role === 'student'                     │
│  │  └─ role = "student" (from token or store)                              │
│  └─ ✅ PASS (role matches)                                                  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DASHBOARD PAGE RENDERS ✅                                │
│                                                                              │
│  Header Component:                                                          │
│  ├─ Reads: allUserData.full_name → "KHAIRIL AZMI ASHARI, S.Kom"           │
│  ├─ Extracts first 3 words → "KHAIRIL AZMI ASHARI"                         │
│  └─ Displays ✅ (NOT "Peserta")                                             │
│                                                                              │
│  Sidebar Component:                                                         │
│  ├─ Reads: userData?.full_name → "KHAIRIL AZMI ASHARI, S.Kom"             │
│  └─ Displays ✅                                                              │
│                                                                              │
│  Dashboard Content:                                                         │
│  ├─ Fetches: student/summary/{user_id}/                                    │
│  ├─ Fetches: student/course-list/{user_id}/                                │
│  └─ Displays: Statistics, progress, recent activity ✅                      │
│                                                                              │
│  Error Status: NONE ✅                                                       │
│  └─ No "Access Denied" notification                                         │
│  └─ No permission errors                                                    │
│  └─ All content visible                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Auth Store State Before & After Fixes

### ❌ BEFORE FIX: Data Loss During Flow

```
Timeline: SSO Login → Dashboard

[Initial]
Auth Store: empty → null

[After SSO Response]
Auth Store: {
  user_id: 54,
  full_name: "KHAIRIL AZMI ASHARI, S.Kom",  ← Got from response ✅
  role: "student",                          ← Got from response ✅
  nip: "199701182025061001",                ← Got from response ✅
  email: "khairil@email.com"
}

[After setAuthUser() - OLD BEHAVIOR]
Auth Store: {
  user_id: 54,
  token_type: "access",
  exp: 1763734429,
  iat: 1763475229,
  jti: "85ed4b21..."
  
  ❌ full_name: LOST! (was replaced)
  ❌ role: LOST! (was replaced)
  ❌ nip: LOST! (was replaced)
}

[Result on Dashboard]
- Header shows "Peserta" (no full_name) ❌
- RoleRoute fails (no role) ❌
- "Access Denied" error ❌
```

### ✅ AFTER FIX: Data Preserved

```
Timeline: SSO Login → Dashboard

[Initial]
Auth Store: empty → null

[After SSO Response]
Auth Store: {
  user_id: 54,
  full_name: "KHAIRIL AZMI ASHARI, S.Kom",
  role: "student",
  nip: "199701182025061001",
  email: "khairil@email.com"
}

[After setAuthUser() - NEW BEHAVIOR (Merge)]
Auth Store: {
  ... (keeps all above fields)
  user_id: 54,
  full_name: "KHAIRIL AZMI ASHARI, S.Kom",  ← KEPT! ✅
  role: "student",                          ← KEPT! ✅
  nip: "199701182025061001",                ← KEPT! ✅
  email: "khairil@email.com",
  
  ... (adds token fields)
  token_type: "access",
  exp: 1763734429,
  iat: 1763475229,
  jti: "85ed4b21..."
}

[Result on Dashboard]
- Header shows "KHAIRIL AZMI ASHARI" ✅
- RoleRoute passes (has role) ✅
- Dashboard loads successfully ✅
```

---

## JWT Token Content Comparison

### ❌ BEFORE FIX: JWT Minimal Fields

```javascript
// What Old Backend Generated
const refresh = RefreshToken.for_user(user);  // Default JWT

// Decoded Token Payload:
{
  "token_type": "access",
  "exp": 1763734429,
  "iat": 1763475229,
  "jti": "85ed4b21adc343d98d7fbd6f56c35553",
  "user_id": 54
  
  // ❌ Missing from token:
  // - full_name
  // - email
  // - role
  // - nip
  // - teacher_id
  // - admin_id
  // - is_active
}

// Console Result:
👤 Setting auth user from decoded token: {
  token_type: "access",
  exp: 1763734429,
  iat: 1763475229,
  jti: "85ed4b21...",
  user_id: 54
}
// Missing: full_name, role, nip ❌
```

### ✅ AFTER FIX: JWT Complete Fields

```javascript
// What New Backend Generates
const refresh = RefreshToken.for_user(user);

// NEW: Add all user fields to token
refresh.access_token['full_name'] = user.full_name;
refresh.access_token['email'] = user.email;
refresh.access_token['role'] = user.role;
refresh.access_token['nip'] = user.nip;
refresh.access_token['teacher_id'] = user.teacher.id;
refresh.access_token['admin_id'] = user.admin.id;
refresh.access_token['is_active'] = user.is_active;

// Decoded Token Payload:
{
  "token_type": "access",
  "exp": 1763734429,
  "iat": 1763475229,
  "jti": "85ed4b21adc343d98d7fbd6f56c35553",
  "user_id": 54,
  
  // ✅ Now includes:
  "full_name": "KHAIRIL AZMI ASHARI, S.Kom",
  "email": "khairil@email.com",
  "role": "student",
  "nip": "199701182025061001",
  "teacher_id": 0,
  "admin_id": 0,
  "is_active": true
}

// Console Result:
👤 Setting auth user from decoded token: {
  token_type: "access",
  exp: 1763734429,
  iat: 1763475229,
  jti: "85ed4b21...",
  user_id: 54,
  full_name: "KHAIRIL AZMI ASHARI, S.Kom",  ✅
  email: "khairil@email.com",               ✅
  role: "student",                          ✅
  nip: "199701182025061001",                ✅
  teacher_id: 0,                            ✅
  admin_id: 0,                              ✅
  is_active: true                           ✅
}
// All fields present! ✅
```

---

## Component Data Flow

```
┌──────────────────────────┐
│   Auth Store (Zustand)   │
│   ==================     │
│   allUserData: {         │
│     user_id: 54          │
│     full_name: "K..."    │
│     role: "student"      │
│     nip: "1997..."       │
│   }                      │
└───────┬────────┬─────────┘
        │        │
        │        └──────────────────┐
        │                           │
        ▼                           ▼
┌──────────────────┐     ┌──────────────────┐
│ UserData() Plugin│     │  useAuthStore    │
│ ============     │     │  ============    │
│ Reads from:      │     │  Reads from:     │
│ 1. Cookie/JWT    │     │  Store directly  │
│ 2. Zustand store │     │  (fallback)      │
│    (fallback)    │     │                  │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         └────────┬───────────────┘
                  │
        ┌─────────▼──────────┐
        │ Components Access  │
        │ ==================│
        │ BaseHeader         │
        │ RoleRoute          │
        │ Dashboard          │
        │ Sidebar            │
        │ etc.               │
        └────────────────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │ Display User Data:  │
        │ ✅ Full Name       │
        │ ✅ Role            │
        │ ✅ NIP             │
        │ ✅ Email           │
        │ No errors ✅       │
        └─────────────────────┘
```

---

## Error Prevention - Multiple Redundancy

```
Get User's Role (for RoleRoute Check)
═════════════════════════════════════

Path 1: Primary - Cookie/JWT (most common)
├─ Cookie.get('refresh_token')
├─ jwt_decode(token)
└─ Payload has: role: "student" ✅

Path 2: Fallback - Zustand Store (timing issues)
├─ useAuthStore.getState().allUserData
└─ Has: role: "student" ✅

Path 3: Fallback - User function (aggregator)
├─ useAuthStore.getState().user()
└─ Returns: {role: "student", ...} ✅

Result: RoleRoute ALWAYS gets user role ✅
        No "Access Denied" errors ✅
```

---

## Complete User Data Journey

```
STEP 1: Backend Generates JWT
┌─────────────────────────────────────┐
│ RefreshToken.for_user(user)         │
│ + Add all fields:                   │
│   ├─ full_name                      │
│   ├─ email                          │
│   ├─ role                           │
│   ├─ nip                            │
│   ├─ teacher_id                     │
│   ├─ admin_id                       │
│   └─ is_active                      │
│ = Complete JWT ✅                    │
└──────────────┬──────────────────────┘
               │
STEP 2: Frontend Stores JWT
┌──────────────▼──────────────────────┐
│ Cookies:                            │
│ ├─ access_token = JWT (all fields)  │
│ ├─ refresh_token = JWT (all fields) │
│ └─ Expiry: 7 days ✅               │
└──────────────┬──────────────────────┘
               │
STEP 3: Auth Store Updated
┌──────────────▼──────────────────────┐
│ setUser() with:                     │
│ ├─ From response: full_name, role   │
│ ├─ From JWT: user_id, exp           │
│ ├─ Merge: All combined ✅           │
│ └─ Result: Complete user object     │
└──────────────┬──────────────────────┘
               │
STEP 4: Components Access Data
┌──────────────▼──────────────────────┐
│ BaseHeader:                         │
│ ├─ allUserData.full_name = "K..."   │
│ ├─ Display: "KHAIRIL AZMI ASHARI"   │
│ └─ ✅ Success                       │
│                                      │
│ RoleRoute:                          │
│ ├─ UserData() returns role          │
│ ├─ role === "student" ✅            │
│ └─ Dashboard accessible ✅          │
│                                      │
│ Dashboard:                          │
│ ├─ Loads student courses ✅         │
│ ├─ Shows progress ✅                │
│ └─ No errors ✅                     │
└─────────────────────────────────────┘
```

---

**Visual Reference Complete** ✅  
**Ready for Implementation & Testing**
