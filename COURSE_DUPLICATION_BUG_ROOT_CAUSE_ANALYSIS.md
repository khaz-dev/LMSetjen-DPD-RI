# CRITICAL BUG FIX: Course Duplication on Homepage - Root Cause Analysis

**Date**: February 22, 2026  
**Severity**: 🔴 CRITICAL - Users seeing duplicate courses with incorrect content  
**Status**: ROOT CAUSE IDENTIFIED + SOLUTION READY

---

## Problem Statement

On the homepage (http://localhost:5174/), courses are appearing **TWICE** with the same title:

1. **Right version**: 
   - Preview Kursus using YouTube Link
   - 1 Preview Pelajaran using Google Drive link
   - Correctly approved and published

2. **Wrong version**:
   - Preview Kursus using Google Drive Link (outdated)
   - 2 Preview Pelajaran (YouTube + Google Drive)
   - Duplicated content sections (Kursus ini termasuk, Persyaratan, Hasil Pembelajaran)

This creates confusion and shows outdated course information to students.

---

## Root Cause (THE BUG)

### 1. The Versioning Architecture (By Design)

The system uses a **dual-copy versioning model** (PHASE 4.60+):

- **Draft Course** (`is_published_version=False`, `parent_course=None`)
  - What the instructor edits in the editor
  - Has status "Draft", "Review", "Rejected", or "Published"

- **Published Copy** (`is_published_version=True`, `parent_course=<draft_course_id>`)
  - What students are meant to see
  - Created when admin approves the course
  - Synced with draft content at approval time

**Intended Student View**: Only published copies (`is_published_version=True`)

### 2. Where the Bug Occurs

**File**: [backend/api/views.py](backend/api/views.py#L696-L703)  
**Class**: `CourseListAPIView` (Homepage course listing)

```python
class CourseListAPIView(generics.ListAPIView):
    # ✨ PHASE 4.71: Filter by platform_status for published courses
    # Removed is_published_version=True dependency since the versioning system creates copies on demand
    queryset = api_models.Course.objects.filter(
        platform_status="Published",
        teacher_course_status="Published"
        # Note: is_published_version flag is not required - courses approved by admin will show
    )
```

**THE PROBLEM**: Missing `is_published_version=True` filter!

This query returns **BOTH**:
- Draft course with `platform_status="Published"`
- Published copy with `platform_status="Published"`

### 3. How Both Get Status="Published"

When admin approves a course ([backend/api/views.py](backend/api/views.py#L4157-L4187)):

```python
# Step 1: Ensure published copy exists
published = self._get_or_create_published_copy(course)

# Step 2: Approve the published version
published.platform_status = "Published"
published.teacher_course_status = "Published"
published.approved_by = user
published.approval_date = timezone.now()
published.save()
print(f"[Admin Approval] ✓ Set published copy to Published")

# Step 4: Sync draft course status ← THIS IS THE ISSUE
course.platform_status = "Published"    # ← Draft now matches filter
course.teacher_course_status = "Published"    # ← Draft now matches filter
course.approved_by = user
course.approval_date = timezone.now()
course.save()
```

**Result**:
```
Draft Course Entry in Database:
  - course_id: "abc123"
  - title: "Public Speaking"
  - platform_status: "Published" ✓ MATCHES FILTER
  - teacher_course_status: "Published" ✓ MATCHES FILTER
  - is_published_version: False ← NOT CHECKED
  → INCORRECTLY SHOWN ON HOMEPAGE

Published Copy Entry in Database:
  - course_id: "xyz789" (different!)
  - title: "Public Speaking"
  - platform_status: "Published" ✓ MATCHES FILTER
  - teacher_course_status: "Published" ✓ MATCHES FILTER
  - is_published_version: True ← NOT CHECKED
  → CORRECTLY SHOWN ON HOMEPAGE

Homepage Result: SAME COURSE APPEARS TWICE (with 2 different course_ids)
```

### 4. Why Content Is Different Between the Two Versions

The draft course and published copy might have different content because:

1. **Published Copy Created**: At approval time, with content from draft
2. **Draft Course Updated**: Instructor edits the draft after approval
3. **Published Copy NOT Updated**: Unless instructor resubmits and admin re-approves
4. **Content Duplication**: If instructor accidentally duplicated sections before approval

For your specific case:
- Draft course: Still has old Google Drive intro video + old lesson structure
- Published copy: Has the approved YouTube intro video + correct lesson structure ✓

---

## Solution

### The Fix

Add `is_published_version=True` filter to show **ONLY** published copies to students:

**File**: [backend/api/views.py](backend/api/views.py#L696-L703) - `CourseListAPIView`

```python
class CourseListAPIView(generics.ListAPIView):
    # ✨ PHASE 4.77 FIX: Filter by is_published_version=True
    # Show ONLY published copies to students, never show draft courses
    # This prevents duplication where both draft and published versions appear
    queryset = api_models.Course.objects.filter(
        platform_status="Published",
        teacher_course_status="Published",
        is_published_version=True  # ← ADD THIS LINE
    )
```

### Why This Works

- **Draft courses** have `is_published_version=False` → Filtered out ✓
- **Published copies** have `is_published_version=True` → Shown to students ✓
- **Duplicates removed** ✓
- **Students see latest approved content** ✓

### Similar Fixes Needed

Search through `backend/api/views.py` for other views that list courses publicly and apply the same fix:

1. `PublicStatsAPIView` (lines 715-728)
2. Any other student-facing course list endpoints

---

## Why This Bug Happened

The comment on line 696 says:
> "Removed is_published_version=True dependency since the versioning system creates copies on demand"

**This was a MISTAKE**. The system DOES create published copies, and we MUST distinguish them from drafts when showing to students.

The `is_published_version` flag exists specifically for this purpose and should ALWAYS be used when filtering for public/student-facing course lists.

---

## Testing After Fix

### Test 1: Course Still Appears (Count Check)
```
Before Fix:
- Homepage shows: 2 kursus 
- Database has: 2 Course records with same title
- Statistics show: 2+ Kursus

After Fix:
- Homepage shows: 1 kursus ✓
- Database still has: 2 Course records (draft + published)
- Statistics show: 1 Kursus ✓
```

### Test 2: Correct Version Shown
```
After clicking into course:
- Course intro video: YouTube ✓
- Lesson preview 1: Google Drive ✓
- No duplicated sections ✓
```

### Test 3: Category Count Correct
```
Before: "Kategori Kursus Individu show 2 kursus"
After: Show 1 kursus per category ✓
```

### Test 4: Statistics Updated
```
Before: Statistik Platform said 2+ Kursus, 3+ Video Pembelajaran
After: Correct counts (1 Kursus, correct video count) ✓
```

---

## Implementation Notes

**Priority**: 🔴 CRITICAL - Apply immediately  
**Files to Change**: 
- `backend/api/views.py` (at least 2-3 locations)

**Backward Compatibility**: ✅ Safe
- Only affects student-facing views
- Draft courses still queryable by instructors
- Published copies still created normally

**Data Migration**: ❌ Not needed
- No database schema changes
- Only a filter logic change
- Existing data is compatible

---

## Related Areas to Review

1. **AdminCourseListAPIView** - Does admin see both versions? (Should see draft + published)
2. **Search endpoints** - Do they filter correctly?
3. **Category.published_course_count()** - Uses same filter, will be fixed automatically

---

## Phase Tag

✨ **PHASE 4.77**: Critical Fix for Course Duplication - Restored `is_published_version` filter

