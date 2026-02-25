# CRITICAL BUG FIX: Unreview Courses Showing on Homepage - PHASE 4.85

## Problem Report
**User Report**: Course in "Review by Admin" status on `/instructor/edit-course/120485/` is appearing on the homepage at `http://localhost:5174/`, even though course was never published before ("Kursus never been Dipublikasikan sebelumnya")

**Severity**: CRITICAL - Logic Bug affecting visibility rules

## Root Cause Analysis

### The Bug Location
**File**: `backend/api/models.py`  
**Method**: `Course.create_published_copy()`  
**Line**: 282

### What's Happening

#### Workflow for NEW Course Submission:
1. **Instructor creates course** → `platform_status="Draft"`, `is_published_version=False` (Draft)
2. **Instructor submits for review** → `save_and_submit()` called:
   - Check if published copies exist → **NO** (first submission)
   - Call `create_published_copy()` → Creates published copy with:
     ```python
     platform_status="Published"  # ❌ WRONG! Created before admin approval
     is_published_version=True
     ```
   - Set draft to `platform_status="Review"`
3. **Result: 2 Copies Created**:
   - **Draft Course**: `platform_status="Review"`, `is_published_version=False`
   - **Published Copy**: `platform_status="Published"`, `is_published_version=True` ← Shows on homepage!
4. **Admin Review** → Hasn't even looked at it yet, but it's already visible to students!

### Why It Appears on Homepage

**Homepage API Endpoint**: `GET /api/v1/course/course-list/`

**Filtering Logic** (backend/api/views.py, line 700):
```python
class CourseListAPIView(generics.ListAPIView):
    queryset = api_models.Course.objects.filter(
        platform_status="Published",        # ← Published copy matches this
        teacher_course_status="Published",  # ← Matches (inherited from draft)
        is_published_version=True           # ← Published copy matches this
    )
```

**The published copy matches ALL filters**, so it appears on homepage even though admin never approved it!

### The Fatal Logic Flaw
```
Intended Flow:
  Draft Submitted (Review) → Published Copy Hidden → Admin Approves → Published Copy Visible

Actual Flow (BROKEN):
  Draft Submitted (Review) → Published Copy VISIBLE → Admin Approves → Published Copy Visible
  
Result: Courses appear BEFORE admin approval! ⚠️
```

## The Solution

### What Should Happen
When a course is submitted for review:
1. Draft course: `platform_status="Review"` ✅ (correct)
2. Published copy: `platform_status="Review"` ← Should also be "Review" until approved!
3. When admin approves: Both become `platform_status="Published"` ✅

### The Fix
**File**: `backend/api/models.py`  
**Method**: `Course.create_published_copy()`  
**Line**: 282

**Change from:**
```python
platform_status="Published",  # ❌ WRONG
```

**Change to:**
```python
platform_status="Review",     # ✅ CORRECT - Inherit draft status, will be approved later
```

### Why This Works
1. When instructor submits NEW course for first time:
   - Published copy created with `platform_status="Review"`
   - Same as draft course's status
   - Students DON'T see it (CourseListAPIView only shows "Published" status)

2. When admin approves:
   - CourseApprovalAPIView sets both to `platform_status="Published"` (line 4386-4388)
   - Now it appears on homepage ✅

3. When instructor edits published course:
   - Draft created with `platform_status="Review"` (create_draft_version, line 324)
   - Submitted draft creates published copy with... wait, let me check that

Actually, looking at the save_and_submit logic (line 540):
```python
if published_copies.exists():
    # ALREADY PUBLISHED: Do NOT update! Admin will do that on approval
    published = published_copies.first()
    print(f"[Submit] [OK] Found existing published copy (ID: {published.id})")
    print(f"[Submit] [WARN] IMPORTANT: Published version NOT updated. Admin will approve changes.")
    is_new = False
else:
    # FIRST TIME PUBLISHING: Create initial published copy
    published = self.create_published_copy()
```

So the issue ONLY affects new courses being submitted for the first time. When resubmitting changes, it keeps the existing published copy unchanged.

## Impact Assessment

### Current State (BROKEN)
- ❌ New courses appear on homepage immediately when submitted for review
- ❌ Students can see courses admin hasn't approved yet
- ❌ Violates platform review workflow

### After Fix (CORRECT)
- ✅ New courses hidden from students until admin approves
- ✅ Proper review gate in place
- ✅ Follows intended workflow: Submit → Review → Approve → Publish

## Testing Checklist
1. ✅ Create new course and submit for review
2. ✅ Course should NOT appear on homepage
3. ✅ Course should show in admin review queue
4. ✅ Admin approves course
5. ✅ Course NOW appears on homepage
6. ✅ Course edit page shows "Review by Admin" correctly

## Affected Endpoints
- `GET /api/v1/course/course-list/` - Homepage course listing
- `GET /api/v1/student/course-list/{user_id}/` - Student enrolled courses (filtered correctly already)
- `GET /api/v1/admin/courses-pending-review/` - Admin review queue

## Related Code References
- **Submission Logic**: `backend/api/models.py` line 530 (save_and_submit)
- **Approval Logic**: `backend/api/views.py` line 4333 (CourseApprovalAPIView)
- **Course List Display**: `backend/api/views.py` line 699 (CourseListAPIView)

## Version Info
- **Phase**: 4.85 (Authentication Fix + Logic Bug Fix)
- **Date**: 2026-02-23
- **Priority**: CRITICAL
- **Type**: Logic Bug
