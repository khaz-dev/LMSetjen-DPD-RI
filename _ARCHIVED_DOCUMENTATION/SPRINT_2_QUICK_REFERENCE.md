# SPRINT 2 QUICK REFERENCE GUIDE

**TL;DR:** 3 major refactoring tasks for admin users page

---

## TASK 1: MULTI-ROLE MIGRATION (6 hours)

### What's Wrong
- 4 different role systems: `role`, `current_role`, `roles` CSV, and boolean fields
- Confusing and error-prone

### What to Do
1. **Replace** all `role` field usage with boolean checks
2. **Update** forms from single-select dropdown to multiple checkboxes
3. **Create** data migration to sync existing data

### Key Files
- Backend: `userauths/models.py`, `api/views.py`, `api/serializer.py`
- Frontend: `frontend/src/views/admin/UsersAdmin.jsx`

### Search & Replace Patterns

**Backend (Python):**
```bash
# Find all instances
grep -r "user\.role ==" backend/
grep -r "user\.role =" backend/
grep -r "filter(role=" backend/

# Replace patterns
user.role == 'student'          → user.is_student
user.role == 'teacher'          → user.is_instructor
user.role == 'admin'            → user.is_admin
user.role = 'student'           → user.is_student = True
filter(role='student')          → filter(is_student=True)
```

**Frontend (JavaScript):**
```bash
# Find all instances
grep -r "formData.role" frontend/
grep -r "user.role" frontend/

# Replace with boolean checks
```

---

## TASK 2: AUDIT LOGGING (4 hours)

### What's Missing
- ActivityLog model exists but admin operations not logged
- Need to track: user create, update, delete, sync operations

### What to Do
1. **Add** new activity types to `ActivityLog.ACTIVITY_TYPE_CHOICES`
2. **Create** logging helper function in `api/views.py`
3. **Add** logging calls to all admin operations
4. **Create** frontend component to display audit trail

### New Activity Types
```python
ACTIVITY_TYPE_CHOICES additions:
('admin_user_created', 'Admin membuat pengguna'),
('admin_user_updated', 'Admin update pengguna'),
('admin_user_deleted', 'Admin hapus pengguna'),
('admin_user_role_changed', 'Admin ubah role pengguna'),
('admin_user_activated', 'Admin aktifkan pengguna'),
('admin_user_deactivated', 'Admin nonaktifkan pengguna'),
('admin_sync_started', 'Admin mulai sinkronisasi'),
('admin_sync_completed', 'Admin sinkronisasi selesai'),
('admin_sync_failed', 'Admin sinkronisasi gagal'),
('admin_bulk_operation', 'Admin bulk operation'),
```

### Logging Helper Function
```python
def log_admin_activity(admin_user, activity_type, description, metadata=None):
    """Log admin operation"""
    from api import models as api_models
    api_models.ActivityLog.objects.create(
        user=admin_user,
        activity_type=activity_type,
        role_at_time='admin',
        title=f"{activity_type}: {description}",
        description=description,
        success=True,
        metadata=metadata or {}
    )
```

### Where to Add Logging
- `SyncExternalUsersAPIView.post()` - sync operations
- `AdminUserManagementAPIView` - user CRUD operations
- User update/delete endpoints

---

## TASK 3: DATABASE-BACKED SYNC STATE (3 hours)

### What's Wrong
- Sync progress stored in-memory (lost on restart)
- No historical data
- Can't debug failed syncs

### What to Do
1. **Create/Verify** `SyncState` model (should exist)
2. **Replace** global `_SYNC_STATE` dict with database queries
3. **Add** sync history display to frontend
4. **Add** API endpoint to query sync history

### Model Structure
```python
class SyncState(models.Model):
    status = CharField()  # idle, initializing, syncing, completed, error
    is_syncing = BooleanField()
    total_users = IntegerField()
    created = IntegerField()
    updated = IntegerField()
    failed = IntegerField()
    errors = JSONField()
    completion_timestamp = DateTimeField()
    # ... etc
    
    @staticmethod
    def get_current():
        obj, _ = SyncState.objects.get_or_create(id=1)
        return obj
```

### Replace These Lines
**In `api/views.py` lines 73-118:**

```python
# REMOVE this entire block
_SYNC_STATE = { ... }
def reset_sync_state(): ...
def update_sync_state(**kwargs): ...
def get_sync_state(): ...

# REPLACE with
def reset_sync_state():
    state = SyncState.get_current()
    state.reset()

def update_sync_state(**kwargs):
    state = SyncState.get_current()
    for key, value in kwargs.items():
        if hasattr(state, key):
            setattr(state, key, value)
    state.save()

def get_sync_state():
    state = SyncState.get_current()
    return state.to_dict()
```

### Frontend Changes
- Add sync history table to admin users page
- Display: start_time, status, created, updated, failed
- Allow filtering by date/status

---

## TESTING CHECKLIST

```
Multi-Role Migration:
□ Create user with multiple roles (student + instructor)
□ User appears in role filter with correct roles
□ Update user roles (add/remove)
□ Frontend displays all roles (not just one)
□ Role-based access control still works

Audit Logging:
□ Create user → ActivityLog created
□ Update user → ActivityLog created
□ Delete user → ActivityLog created
□ Sync operation → ActivityLog created
□ Audit trail visible in admin UI

Database-Backed Sync:
□ Restart server during sync (progress persists)
□ View sync history in admin UI
□ All historical syncs display correctly
□ Sync state correctly shows idle after completion

Performance:
□ Admin users page loads in <2 seconds (Sprint 1 target)
□ No console errors
□ ActivityLog queries performant
□ No database query N+1 issues
```

---

## COMMON MISTAKES TO AVOID

❌ **Don't:**
- Forget to migrate existing data (users will have no roles!)
- Use both `role` and `is_student` checks (will be inconsistent)
- Forget to add admin parameter to logging calls
- Assume SyncState always exists (use `get_or_create`)

✅ **Do:**
- Create data migration for existing users
- Replace ALL role checks in one pass
- Always include admin user in audit logs
- Use SyncState.get_current() for singleton access

---

## ESTIMATED TIME BREAKDOWN

| Task | Backend | Frontend | Testing | Total |
|------|---------|----------|---------|-------|
| Multi-Role | 3h | 1h | 1h | 5h |
| Audit Log | 2h | 1h | 0.5h | 3.5h |
| Sync State | 1h | 0.5h | 0.5h | 2h |
| Integration | - | - | 1.5h | 1.5h |
| **TOTAL** | **6h** | **2.5h** | **3.5h** | **12h** |

---

## KEY MODELS REFERENCE

### User Model (userauths/models.py)
- `is_student` ✅ Keep
- `is_instructor` ✅ Keep
- `is_admin` ✅ Keep
- `role` ❌ Deprecate
- `current_role` ❌ Can remove
- `roles` ❌ Can remove

### ActivityLog Model (api/models.py)
- Already exists with signal handlers
- Need to add admin operation types
- Need manual logging in views

### SyncState Model (api/models.py)
- Should already exist (verify!)
- Replace in-memory _SYNC_STATE with DB calls

### SyncHistory Model (api/models.py)
- Already exists
- Link to SyncState for current sync tracking

---

**Version:** 1.0 | **Date:** May 5, 2026 | **Status:** Ready for Development
