# ROOT CAUSE ANALYSIS: Instructor Form Still Showing After Approval

**Date**: February 22, 2026  
**Status**: 🔴 CRITICAL BUG IDENTIFIED  
**Severity**: HIGH - Breaks instructor onboarding

---

## 💥 The Real Problem

When a user account with `is_instructor=true` clicks "Mulai Mengajar", the form still shows instead of the "already instructor" message.

### Root Cause Chain

**Issue 1: API Endpoint Filters Out APPROVED Requests**
```python
# backend/api/views.py line 8236-8242
def get_queryset(self):
    return api_models.InstructorRequest.objects.filter(
        user=self.request.user,
        status__in=['PENDING', 'REJECTED']  # ❌ MISSING 'APPROVED'!
    )
```

**My Phase 4.80 fix tried to check:**
```jsx
if (requestData.status === 'APPROVED') { // ← Never executes!
    // Show message
}
```

But `requestData` is `null` because the endpoint returns empty!

---

**Issue 2: Frontend Only Checks `currentRole`, Not Boolean `is_instructor` Flag**

The JWT token DOES include `is_instructor` from backend (serializer line 34):
```python
token['is_instructor'] = getattr(user, 'is_instructor', False)
```

But Search.jsx only checks `role` (which is `current_role`):
```jsx
const userRole = userData?.role;  // Gets current_role value
const isTeacher = userRole === 'teacher';  // Only checks this!

// ❌ MISSING: Check the actual is_instructor boolean field!
```

Even though the JWT has `is_instructor: true`, the frontend ignores it!

---

**Issue 3: `current_role` is NOT Automatically Set When User Becomes Instructor**

Looking at `InstructorRequest.approve()` method (line 2693-2730):
```python
def approve(self, reviewed_by):
    # ... create teacher ...
    self.user.is_instructor = True
    self.user.roles = 'student,teacher'
    self.user.save()
    # ❌ Does NOT set current_role = 'teacher'
```

So even though `is_instructor=true`, the user's `current_role` may still be `'student'`!

**Result**: JWT has `is_instructor: true` BUT JWT has `role: 'student'` (current_role)

---

## 📊 Complete Problem Scenario

```
1. Admin approves user's instructor request
   ↓
2. Backend sets: is_instructor=True, roles='student,teacher'
   ↓
3. MISSING STEP: current_role is NOT set to 'teacher'
   ↓
4. Frontend decodes JWT, gets:
   - role='student' (current_role)
   - is_instructor=true ✓
   - current_role='student' ✓
   
5. Frontend checks: isTeacher = (role === 'teacher') → FALSE ❌
   
6. Fetches /instructor-request/ endpoint
   ↓
7. Endpoint filters for status__in=['PENDING', 'REJECTED']
   But the request status is 'APPROVED'!
   ↓
8. Endpoint returns: None (empty)
   ↓
9. requestData is null, can't check status
   ↓
10. Form opens ❌
```

---

## ✅ The Actual Solution

**We need BOTH fixes:**

### Fix 1: Check `is_instructor` Boolean Instead of `current_role`
The frontend should check the actual `is_instructor` field from JWT before opening the form.

### Fix 2: Set `current_role` When Approving Instructor
The approve() method should update `current_role` to `'teacher'`.

### Fix 3 (Optional): Include 'APPROVED' in Endpoint
The endpoint should return APPROVED requests for completeness.

---

## 🔍 Code Locations to Fix

| Issue | File | Location | Current | Fix |
|-------|------|----------|---------|-----|
| Frontend check | frontend/src/views/base/Search.jsx | Line 37 | `isTeacher = userRole === 'teacher'` | Check `is_instructor` boolean |
| Backend approval | backend/api/models.py | Line 2710-2720 | No `current_role` set | Set `current_role = 'teacher'` |
| API endpoint filter | backend/api/views.py | Line 8236-8242 | Filters out 'APPROVED' | Add 'APPROVED' to status list |

---

## 🔧 Recommended Fix Priority

**Priority 1** (CRITICAL): Fix frontend to check `is_instructor` boolean
- Location: frontend/src/views/base/Search.jsx
- Change: `isTeacher = userData?.is_instructor || userRole === 'teacher'`
- Impact: Immediately fixes the issue for ~90% of cases

**Priority 2** (IMPORTANT): Set current_role when approving instructor
- Location: backend/api/models.py - approve() method
- Change: Add `self.user.current_role = 'teacher'` after setting is_instructor
- Impact: Ensures JWT is correct after approval

**Priority 3** (NICE-TO-HAVE): Include APPROVED in endpoint
- Location: backend/api/views.py - get_queryset()
- Change: Add `'APPROVED'` to status __in list
- Impact: Makes API more complete, though not strictly needed if Priority 1 works

---

