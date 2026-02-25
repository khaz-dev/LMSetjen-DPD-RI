# Instructor Profile - Published Courses Not Showing Bug Analysis

**URL**: `http://localhost:5174/instructor-profile/1/`  
**Issue**: Section title shows "Kursus Instruktur (1)" but no courses are displayed  
**Severity**: 🔴 HIGH - Core functionality broken  
**Date**: February 22, 2026

---

## 1. Root Cause Analysis

### The Problem Description
- When visiting instructor profile page: `/instructor-profile/{teacher_id}/`
- The courses section header says: **"Kursus Instruktur (1)"** - showing 1 course exists
- But **NO COURSES ARE DISPLAYED** in the grid below

### Why This Happens - Data Flow Mismatch

**Frontend Flow** (Line 291 in InstructorProfilePage.jsx):
```jsx
{courses.filter(course => course.platform_status === 'Published').map((course) => (
    // Display course
))}
```

**What Frontend Expects**:
- Courses with `platform_status === 'Published'`

**What Backend Returns** (TeacherCourseListAPIView):
```python
return api_models.Course.objects.filter(
    teacher=teacher,
    is_published_version=False,  # ← ONLY DRAFT COURSES
    parent_course__isnull=True
).order_by('-date')
```

### The Mismatch Explained

| Component | What It Has | What It Expects |
|-----------|------------|-----------------|
| **Backend API** | Draft courses (`is_published_version=False`) | Actually correct for instructor dashboard |
| **Frontend Component** | Draft courses from API (e.g., `platform_status='Draft'`) | Published courses (`platform_status='Published'`) |
| **Result** | Empty list (0 courses match filter) | ❌ No courses displayed |

### Scenario Example

```
Teacher "Budi" has:
  - Draft Course:     "Python Basics" (is_published_version=False, platform_status='Draft')
  - Published Course: "Python Basics" (is_published_version=True, platform_status='Published')

1. Frontend calls: GET /teacher/course-lists/budi/
2. Backend returns: [Draft Course] (because is_published_version=False)
3. Frontend receives: [{id: 1, platform_status: 'Draft', ...}]
4. Frontend tries to filter: .filter(c => c.platform_status === 'Published')
5. Result: [] (empty array)
6. Display: "Kursus Instruktur (1)" but 0 courses shown ❌
```

---

## 2. Root Cause Location

### Backend Endpoint
**File**: `backend/api/views.py`  
**Class**: `TeacherCourseListAPIView` (Line 3080)  
**URL**: `GET /api/v1/teacher/course-lists/{teacher_id}/`

```python
def get_queryset(self):
    teacher_id = self.kwargs['teacher_id']
    try:
        teacher = api_models.Teacher.objects.get(id=teacher_id)
        # [*] PHASE 4.77: Returns ONLY draft courses
        return api_models.Course.objects.filter(
            teacher=teacher,
            is_published_version=False,  # ← PROBLEM: Only returns drafts
            parent_course__isnull=True
        ).order_by('-date')
```

**Issue**: This endpoint was designed for instructor dashboard (shows editable drafts), not for public profile (should show published courses).

### Frontend Component
**File**: `frontend/src/views/base/InstructorProfilePage.jsx`  
**Lines**: 287-291  
**Code**:
```jsx
{courses.length > 0 && (
    <div className="instructor-profile-courses mb-5">
        <h2 className="section-title">
            <i className="fas fa-book section-icon"></i>
            Kursus Instruktur ({courses.length})  {/* ← Shows ALL courses count */}
        </h2>
        <div className="courses-grid">
            {courses.filter(course => course.platform_status === 'Published').map((course) => (
                                    {/* ← But only displays PUBLISHED courses */}
```

**Issues**:
1. Title shows total count: `{courses.length}`
2. Display filters by `platform_status === 'Published'`
3. But API returns draft courses with `platform_status !== 'Published'`
4. Result: Title shows count, grid shows nothing

---

## 3. Why PHASE 4.77 Changed It

From the code comment, we can see:
```python
# [*] PHASE 4.77 FIXED: Show ONLY draft courses (not published or draft revisions)
# Instructor should only see courses they can edit
```

**Context**: PHASE 4.77 was fixing the instructor dashboard to show only editable courses. This was correct for `/instructor/courses/` (dashboard) but broke the public profile page.

---

## 4. Two Different Use Cases

### Use Case 1: Instructor Dashboard (`/instructor/courses/`)
- **What should show**: Draft courses (what instructor can edit)
- **Query needed**: `is_published_version=False`
- **Public**: No (requires authentication as instructor)
- **Current endpoint**: ✅ Correct - returns drafts

### Use Case 2: Public Instructor Profile (`/instructor-profile/{teacher_id}/`)
- **What should show**: Published courses (what students see)
- **Query needed**: `is_published_version=True`
- **Public**: Yes (anyone can view, no authentication needed)
- **Current endpoint**: ❌ Wrong - returns drafts instead of published

---

## 5. The Fix Required

### Option A: Create Separate Endpoint (Recommended)
Create a new endpoint specifically for public published courses:

**New Endpoint**: `GET /api/v1/teacher/published-courses/{teacher_id}/`

```python
class TeacherPublishedCoursesAPIView(generics.ListAPIView):
    serializer_class = CourseSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        teacher_id = self.kwargs['teacher_id']
        try:
            teacher = Teacher.objects.get(id=teacher_id)
            # Return published courses (what students see)
            return Course.objects.filter(
                teacher=teacher,
                is_published_version=True  # Published courses only
            ).order_by('-date')
        except Teacher.DoesNotExist:
            return Course.objects.none()
```

**Frontend Change**: Line 52 in InstructorProfilePage.jsx
```javascript
// OLD
useAxios.get(`teacher/course-lists/${teacher_id}/`)

// NEW
useAxios.get(`teacher/published-courses/${teacher_id}/`)
```

### Option B: Add Query Parameter Filter
Modify existing endpoint to accept a filter parameter:

```python
def get_queryset(self):
    is_published = self.request.query_params.get('published', 'false').lower() == 'true'
    
    if is_published:
        return Course.objects.filter(is_published_version=True)
    else:
        return Course.objects.filter(is_published_version=False)
```

---

## 6. Additional Issues Found

### Issue 1: Title Shows Wrong Count
**File**: InstructorProfilePage.jsx Line 290
```jsx
Kursus Instruktur ({courses.length})  // Shows ALL courses, including non-published
```

**Should be**:
```jsx
Kursus Instruktur ({courses.filter(c => c.platform_status === 'Published').length})
```

---

## 7. Testing Strategy

### Manual Test Verification

**Step 1**: Create a course as instructor
- Go to: `/instructor/create-course/`
- Create course "Test Course"
- Verify it shows in `/instructor/courses/` ✓

**Step 2**: Submit for approval
- Click "Perbarui Kursus" → Submit button
- Course status changes to "Review"

**Step 3**: Admin approves the course
- Admin goes to course review page
- Clicks "Setujui" (Approve)
- Course is now published

**Step 4**: Check instructor profile page
- Go to: `/instructor-profile/{teacher_id}/`
- ❌ BUG: Title shows "Kursus Instruktur (1)" but no courses
- ✅ AFTER FIX: Title shows "Kursus Instruktur (1)" and course is displayed

### Database Verification Query

```sql
-- Check what the current endpoint returns
SELECT course_id, title, is_published_version, platform_status, teacher_id
FROM api_course
WHERE teacher_id = 1
ORDER BY is_published_version DESC;

-- Expected output (simplified):
-- course_id | title       | is_published_version | platform_status
-- --------  | ----------- | -------------------- | ---------------
-- 100       | Test Course | t                    | Published
-- 1         | Test Course | f                    | Review/Draft
```

---

## 8. Files Affected

### Backend
- **File**: `backend/api/views.py`
- **Action**: Create new endpoint OR modify existing one
- **Impact**: 1 new endpoint or 1 modified view

### Frontend
- **File**: `frontend/src/views/base/InstructorProfilePage.jsx`
- **Lines**: 52 (API call) and 290 (title count)
- **Impact**: 2 minor changes

### URLs
- **File**: `backend/api/urls.py`
- **Action**: Add new URL pattern (if Option A chosen)
- **Impact**: 1 new URL pattern

---

## 9. Why Profile Page Shows Draft Courses

The root cause traces back to:

1. **PHASE 4.77 Change**: Modified `TeacherCourseListAPIView` to show only draft courses
   - Reason: Fix double-listing in instructor dashboard
   - Correct for: `/instructor/courses/` (instructor dashboard)
   - Wrong for: `/instructor-profile/` (public profile)

2. **Code Reuse**: Same endpoint used for both purposes
   - No separation between "what instructor edits" vs "what students see"
   - No public vs private distinction in endpoint design

3. **Frontend Filtering**: Frontend tries to filter by `platform_status === 'Published'`
   - Assumes API returns mixed status courses
   - But API only returns drafts, so filter returns empty

---

## 10. Impact Summary

| Aspect | Impact |
|--------|--------|
| **User Impact** | 🔴 Critical - Instructor profiles appear empty |
| **Business Impact** | 🔴 Critical - Can't showcase instructor courses |
| **Data Integrity** | 🟢 OK - No data loss, just filtering issue |
| **Performance** | 🟢 OK - No performance impact |
| **Security** | 🟢 OK - No security issues |

---

## 11. Recommended Solution

**Best Approach**: Create separate endpoint for published courses

**Pros**:
- ✅ Clean separation of concerns
- ✅ Clear API intent
- ✅ Better for future features
- ✅ Explicit and maintainable

**Cons**:
- ⚠️ Requires backend change
- ⚠️ Adds new endpoint

**Alternative**: Use query parameter (simpler but less clean)

---

## 12. Quick Reference

### The Mismatch in One Table

| Endpoint | Returns | For | Uses |
|----------|---------|-----|------|
| `teacher/course-lists/{id}/` | Draft courses only | Instructor dashboard | `/instructor/courses/` |
| (same endpoint) | Draft courses only | Public profile profile | `/instructor-profile/{id}/` ❌ |
| **Needed**: `teacher/published-courses/{id}/` | Published courses only | **Public profile** | `/instructor-profile/{id}/` ✅ |

---

**Status**: Ready for implementation  
**Complexity**: Low (straightforward endpoint creation or parameter addition)  
**Time to Fix**: ~15 minutes

