# Role Field Deprecation - Quick Reference Guide

## What Was Done

The deprecated `User.role` field has been removed from all permission checks and replaced with boolean fields:
- `is_student` (BooleanField)
- `is_instructor` (BooleanField)  
- `is_admin` (BooleanField)

## What Changed

### Backend
| Component | Before | After |
|-----------|--------|-------|
| Permission Classes | Check `role` field | Check `is_admin`, `is_instructor` booleans |
| Django Admin | Show `role` column | Show `current_role`, boolean role fields |
| User Creation | Set `role` field | Set boolean fields + `current_role` |
| Permission Checks | `request.user.role == 'admin'` | `request.user.is_admin` |
| Role Logic | Check `role` field | Check `is_student`, `is_instructor` booleans |

### Frontend
| Component | Status |
|-----------|--------|
| UserData.js | ✅ No changes needed |
| Login.jsx | ✅ No changes needed |
| UsersAdmin.jsx | ✅ No changes needed |
| All other components | ✅ No changes needed |

## Files Modified

```
backend/
├── userauths/
│   └── admin.py                 # Updated UserAdmin (list_display, list_filter)
├── api/
│   ├── permissions.py           # Updated 3 permission classes
│   ├── views.py                 # Updated permission checks & role logic
│   └── serializer.py            # ✅ Already correct (no changes needed)
└── (no other changes needed)

frontend/
├── src/
│   ├── views/auth/
│   │   ├── Login.jsx            # ✅ No changes needed
│   │   └── SSOLogin.jsx         # ✅ No changes needed
│   ├── views/admin/
│   │   └── UsersAdmin.jsx       # ✅ No changes needed
│   ├── views/plugin/
│   │   └── UserData.js          # ✅ No changes needed
│   ├── utils/
│   │   └── auth.js              # ✅ No changes needed
│   └── (no other changes needed)
└── (no other changes needed)
```

## How It Works Now

### Permission Flow
```
API Request
    ↓
Permission Class checks:
  - request.user.is_admin → boolean check
  - request.user.is_instructor → boolean check
  - request.user.is_student → boolean check
    ↓
✅ Allow OR ❌ Deny
```

### Role Information
```
User Model has:
├── is_student (boolean)      ← Used for permission checks
├── is_instructor (boolean)   ← Used for permission checks
├── is_admin (boolean)        ← Used for permission checks
├── current_role (string)     ← Active role in session
├── roles (CSV string)        ← All available roles
└── role (deprecated)         ← For backward compatibility only
```

### Frontend Receives
```
JWT Token contains:
├── role              ← For backward compatibility
├── current_role      ← Primary role info
├── available_roles   ← Array of available roles
├── is_student        ← Boolean
├── is_instructor     ← Boolean
└── is_admin          ← Boolean
```

## Backward Compatibility

✅ **100% Backward Compatible**
- API responses still include `role` field
- JWT tokens still include `role` field
- Existing frontend code works unchanged
- External integrations continue working
- No breaking changes

## Migration Strategy

1. **Phase 1 (Current):** Use boolean fields for permission checks
   - Status: ✅ COMPLETE
   
2. **Phase 2 (Future):** Remove `role` from API responses
   - Timeline: 6+ months from Phase 1
   
3. **Phase 3 (Future):** Remove `role` from database
   - Timeline: After Phase 2
   
4. **Phase 4 (Future):** Clean up deprecated references
   - Timeline: After Phase 3

## How to Use

### Django Admin
```
1. Go to http://localhost:8000/admin/
2. Click "Users"
3. Now shows: current_role, is_admin, is_instructor, is_student
4. Old "role" column is gone ✅
```

### API Endpoints
```python
# Backend Permission Check
@permission_classes([IsAdminUser])
def some_admin_endpoint(request):
    # Automatically checks request.user.is_admin (boolean)
    pass

# Manual Check (if needed)
if request.user.is_admin:
    # Admin-only logic
    pass
```

### Frontend Role Detection
```javascript
// UserData.js already handles this
const userData = UserData();
console.log(userData.role);           // backward compat
console.log(userData.current_role);   // primary
console.log(userData.available_roles); // array of roles
```

## Testing Permission Checks

```python
# Test: Admin-only endpoint
from rest_framework.test import APIClient

client = APIClient()
response = client.get('/api/v1/admin/users/', HTTP_AUTHORIZATION=f'Bearer {token}')

# Should return 403 if user.is_admin is False
# Should return 200 if user.is_admin is True
```

## Debugging

### If you see "role" in logs
```
❌ OLD: "User role: student"
✅ NEW: Check is_student boolean instead
```

### If permission check fails unexpectedly
```python
# Debug: Check boolean fields
user = User.objects.get(id=1)
print(f"is_admin: {user.is_admin}")
print(f"is_instructor: {user.is_instructor}")
print(f"is_student: {user.is_student}")
print(f"current_role: {user.current_role}")
```

### If frontend doesn't detect role
```javascript
// Check JWT token content
const userData = UserData();
console.log("Available roles:", userData.available_roles);
console.log("Current role:", userData.current_role);
console.log("Is admin:", userData.is_admin);
```

## Remaining `role` References

All remaining references are **intentional and non-critical**:
- Logging statements (info-only)
- API responses for backward compatibility
- User update logic to maintain field
- Database for reference during migration

**None of these affect permission checks** ✅

## Important: Do NOT

❌ Do NOT: `if user.role == 'admin':`  
✅ Do: `if user.is_admin:`

❌ Do NOT: Check deprecated role field in permission logic  
✅ Do: Use boolean fields in permission classes

❌ Do NOT: Assign `user.role = 'teacher'` for permission checks  
✅ Do: Set `user.is_instructor = True` for permissions

## Success Indicators

- [x] Django admin shows boolean role fields
- [x] Permission classes use boolean checks
- [x] User creation sets boolean fields
- [x] Role switching updates boolean fields
- [x] Frontend works without changes
- [x] API returns role for backward compatibility
- [x] Multi-role users work correctly

## Questions?

See `ROLE_FIELD_DEPRECATION_SUMMARY.md` for detailed documentation.
