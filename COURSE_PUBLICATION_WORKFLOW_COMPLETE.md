# Complete Course Publication Workflow - Fixed & Verified

## Issues Fixed

### Issue #1: Missing `fetchCourseData()` Function ✅
**Problem**: CourseEdit.jsx was calling `fetchCourseData()` to refresh course status after submission, but this function wasn't exported from the hook.

**Solution**: 
- Refactored `useCourseData` hook to expose `fetchCourseData` function
- Updated CourseEdit.jsx to destructure `fetchCourseData` from the hook
- Now correctly refreshes course data after successful review submission

**Files**:
- [frontend/src/views/instructor/hooks/useCourse.js](frontend/src/views/instructor/hooks/useCourse.js#L6-L52) - Added fetchCourseData export
- [frontend/src/views/instructor/CourseEdit.jsx](frontend/src/views/instructor/CourseEdit.jsx#L64) - Added fetchCourseData to destructuring

---

### Issue #2: AdminCourseListAPIView Missing Pagination Handling ✅
**Problem**: ListAPIView uses pagination by default, but the response format wasn't clearly defined, potentially causing data deserialization issues in the frontend.

**Solution**:
- Added `pagination_class = None` to disable pagination for admin course list
- Returns data as a simple array instead of paginated response
- Added debug logging to track query execution and filtering

**Files**:
- [backend/api/views.py](backend/api/views.py#L3927-3959) - Added pagination_class, debug logging

---

### Issue #3: CourseReviewAdmin Response Handling ✅
**Problem**: Component wasn't handling different response formats robustly.

**Solution**:
- Improved response parsing to handle both array and paginated formats
- Added console logging to debug API responses
- Made parsing more explicit and error-resistant

**Files**:
- [frontend/src/views/admin/CourseReviewAdmin.jsx](frontend/src/views/admin/CourseReviewAdmin.jsx#L24-48) - Improved response handling

---

## Complete Course Publication Workflow

### Step 1: Instructor Creates Course
```
Status: Draft
platform_status = "Draft"
teacher_course_status = "Draft" (default)
On page: /instructor/edit-course/{id}/
```

### Step 2: Instructor Fills Course Details
- Add title, description, level, category
- Upload thumbnail image
- Create curriculum sections
- Add lessons with videos
- Create quiz questions
```
Status still: Draft
No changes to status fields
```

### Step 3: Instructor Clicks "Ajukan untuk Review Admin"
```
Endpoint: POST /api/v1/teacher/course-publish/{course_id}/

Backend executes:
- Validates course completeness
- Sets: platform_status = "Review"
- Sets: review_submitted_date = NOW
- Clears: rejection_reason (if any)
- Saves to database

Returns:
{
  "success": true,
  "message": "Kursus Anda telah diajukan untuk review admin...",
  "course": {
    "course_id": "...",
    "platform_status": "Review",
    "review_submitted_date": "2026-02-17T..."
  }
}

Frontend:
- Shows success dialog: "Kursus Diajukan untuk Review!"
- Calls fetchCourseData() to refresh
- Displays alert: "⏳ Menunggu Persetujuan Admin"
- Hides submit button
```

### Step 4a: Instructor Updates Course Details (e.g., Title)
```
Endpoint: PATCH /api/v1/teacher/course-update/{teacher_id}/{course_id}/

Request data:
{
  "title": "New Title",
  "description": "...",
  etc.
  // ❌ NO platform_status or variants[] included
}

Backend processes update:
- Updates: title, description, level, category, image
- PRESERVES: platform_status = "Review" (not in request, so unchanged)
- SKIPS: curriculum update (no variants[] data)
- Returns: refreshed course with all fields including platform_status

Frontend displays:
- Title updated ✅
- Status STILL shows: "⏳ Menunggu Persetujuan Admin" ✅
- This is EXPECTED - status only changes when admin approves/rejects
```

### Step 4b: Admin Reviews Pending Courses
```
Endpoint: GET /api/v1/admin/courses-pending-review/?status=Review

Backend:
- Checks: user.is_staff or user.is_superuser
- If not admin: returns empty list
- If admin: filters Course.objects.filter(platform_status="Review")
- Orders by: -review_submitted_date (newest first)
- Returns: Array of courses awaiting review

Example response:
[
  {
    "course_id": "168075",
    "title": "Kursus XYZ",
    "platform_status": "Review",
    "review_submitted_date": "2026-02-17T10:30:00Z",
    "teacher": {...},
    "category": {...},
    "curriculum": [...],
    "lectures": [...]
  },
  // ... more courses
]

Frontend displays:
- Card for each course
- Shows: title, instructor, category, level
- Shows stats: # sections, # lessons, # quizzes
- Shows submission date
- Approve / Reject buttons
```

### Step 5a: Admin Approves Course
```
Endpoint: POST /api/v1/admin/course-approval/{course_id}/

Request body:
{
  "action": "approve"
}

Backend:
- Sets: platform_status = "Published"
- Sets: approved_by = current admin user
- Sets: approval_date = NOW
- Clears: rejection_reason
- Saves to database
- Returns: updated course

Response:
{
  "success": true,
  "message": "Kursus 'XYZ' telah disetujui dan dipublikasikan",
  "course": {
    "course_id": "...",
    "platform_status": "Published",
    "approved_by": "Admin Name",
    "approval_date": "2026-02-17T11:00:00Z"
  }
}

Results:
✅ Course moves from Review to Published
✅ Course now visible to all students on homepage
✅ Course removed from pending review list
✅ Instructor receives notification (future feature)
```

### Step 5b: Admin Rejects Course with Feedback
```
Endpoint: POST /api/v1/admin/course-approval/{course_id}/

Request body:
{
  "action": "reject",
  "rejection_reason": "Pelajaran belum lengkap. Tambahkan minimal 5 pelajaran per bagian."
}

Backend:
- Sets: platform_status = "Rejected"
- Sets: rejection_reason = provided text
- Saves to database
- Returns: updated course

Response:
{
  "success": true,
  "message": "Kursus 'XYZ' telah ditolak",
  "course": {
    "course_id": "...",
    "platform_status": "Rejected",
    "rejection_reason": "Pelajaran belum lengkap..."
  }
}

Results:
✅ Course reverts to "Rejected"  status
✅ Course removed from pending review list
✅ Instructor sees red alert with feedback
✅ "Ajukan Ulang untuk Review" button appears
✅ Instructor can fix and resubmit
```

### Step 6: Instructor Fixes and Resubmits
```
Instructor sees:
- Red alert: "Kursus Ditolak - Silakan Perbaiki"
- Admin's reason: "Pelajaran belum lengkap..."
- Button: "Ajukan Ulang untuk Review"

Instructor:
1. Fixes curriculum (adds more lessons)
2. Updates curriculum (platform_status preserved)
3. Clicks "Ajukan Ulang untuk Review"
4. Back to Step 3 (submission flow)

Cycle repeats until approved ✅
```

---

## Important Notes

### Two Status Fields - Know the Difference
- **platform_status**: "Draft" → "Review" → "Published"|"Rejected"  
  - Tracks PUBLICATION approval status
  - Set by: System (on submission) + Admin (on decision)
  - Shown to: Instructors + Admins
  
- **teacher_course_status**: "Draft" ↔ "Published" ↔ "Disabled"
  - Tracks instructor's PREFERENCE for visibility
  - Set by: Instructor editing course
  - Shown to: Instructors only in a form field

### What Updates Course But Preserves Status

When instructor clicks "Perbarui Kursus" (regular update):
```
✅ UPDATES:
- Title, description, level
- Category, image, file
- Teacher course status (desired state)

✅ PRESERVES:
- platform_status (doesn't change)
- rejection_reason (if rejected)
- approved_by / approval_date (if approved)
- review_submitted_date

❌ DOESN'T TOUCH:
- Curriculum sections (separate update path)
- Lessons (separate update path)
- Quizzes (separate update path)
```

### What Updates Curriculum

When instructor edits curriculum:
```
✅ UPDATES:
- Variant sections (add/edit/delete)
- VariantItems (lessons - add/edit/delete)

✅ PRESERVES:
- All course approval workflow fields
- All course basic info fields

WHEN platform_status might reset:
- If curriculum is completely deleted while status="Review"
- Backend cleanup logic removes orphaned variants
```

---

## Debugging Commands

### Check Course Status in Database
```bash
# Via Django shell
python manage.py shell
from api.models import Course
course = Course.objects.get(course_id="168075")
print(f"Platform Status: {course.platform_status}")
print(f"Review Submitted: {course.review_submitted_date}")
print(f"Rejection Reason: {course.rejection_reason}")
print(f"Approved By: {course.approved_by}")
```

### Check Admin Permissions
```javascript
// In browser console
const userData = JSON.parse(localStorage.getItem('user') || '{}');
console.log("User role:", userData.role);
console.log("Is staff:", userData.is_staff);
console.log("Is superuser:", userData.is_superuser);
```

### Monitor API Calls
```javascript
// In browser F12 console
// Filter Network tab for: "admin/courses-pending-review"
// Check request headers: Authorization Bearer token
// Check response: Should be array of courses or error message
```

---

## Test Scenarios

### Scenario 1: Submit, Approve, Verify
1. ✅ Create course with all required content
2. ✅ Click "Ajukan untuk Review Admin"
3. ✅ Go to `/admin/review-courses/`
4. ✅ See course in pending list
5. ✅ Click "Setujui"
6. ✅ Verify course status changes to "✓ Kursus Dipublikasikan"
7. ✅ Verify course appears on student homepage

### Scenario 2: Submit, Reject with Feedback, Resubmit
1. ✅ Create course and submit for review
2. ✅ Admin clicks "Tolak" and provides reason
3. ✅ Instructor sees red alert with exact feedback
4. ✅ Instructor fixes issues (adds content)
5. ✅ Instructor clicks "Ajukan Ulang untuk Review"
6. ✅ Course returns to "Menunggu Persetujuan Admin"
7. ✅ Course reappears on admin review list
8. ✅ Admin approves second submission

### Scenario 3: Update Course Info While Pending
1. ✅ Course submitted for review (status="Review")
2. ✅ Instructor goes to course edit page
3. ✅ Instructor changes title
4. ✅ Instructor clicks "Perbarui Kursus"
5. ✅ Status STILL shows "Menunggu Persetujuan Admin"
6. ✅ Course STILL appears on admin review list
7. ✅ Curriculum STILL intact

---

**Date Updated**: February 17, 2026  
**Status**: ✅ All issues fixed and verified  
**Phase**: 4.36+
