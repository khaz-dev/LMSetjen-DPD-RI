# Published Course Editing Support - PHASE 4.76

## Problem Solved

**Issue**: Published courses were not visible in the instructor dashboard (`/instructor/dashboard/`) or courses list (`/instructor/courses/`), and there was no way for instructors to edit published courses without creating entirely new courses.

### Root Cause
The system implements a **dual-copy versioning architecture**:
- When a course is published, a **published copy** is created (`is_published_version=True`)
- The published copy is shown to students
- But the instructor dashboard query only showed **draft courses** (`is_published_version=False` AND `parent_course__isnull=True`)
- This meant published courses were hidden from instructors!

## Solution Implemented

### 1. Backend Changes (✨ PHASE 4.76)

#### New API Endpoint: `CourseEditPublishedAPIView`
- **Location**: `backend/api/views.py` (~line 4088)
- **URL**: `POST /api/v1/teacher/course-edit-published/<course_id>/`
- **Purpose**: Creates a draft version from a published course for editing

**Workflow**:
```python
1. Instructor clicks "Edit Versi Terbaru" button on published course
2. API endpoint is called
3. System checks if draft already exists (by `parent_course=published`)
4. If no draft: Creates new draft using `course.create_draft_version()`
5. If draft exists: Returns existing draft (prevents duplicates)
6. Response includes draft course_id for redirect
```

**Response Example**:
```json
{
  "success": true,
  "message": "Draft versi kursus 'Judul Kursus' berhasil dibuat...",
  "is_new": true,
  "course": {
    "course_id": "939531",
    "title": "...",
    "slug": "...",
    "platform_status": "Review"
  }
}
```

#### Updated Course Query: `TeacherCourseListAPIView`
- **Location**: `backend/api/views.py` (~line 3020)
- **What Changed**: Query now returns BOTH draft AND published courses
- **Logic**:
  ```python
  Filter: (parent_course__isnull=True) OR (is_published_version=True)
  Exclude: (parent_course NOT NULL AND is_published_version=False)
  ```
- **Result**: Instructors see their draft courses + published versions (but not draft revisions still being edited)

### 2. Frontend Changes (✨ PHASE 4.76)

#### Enhanced CourseCard Component
- **Location**: `frontend/src/components/CourseCard.jsx`
- **New Imports**: `useState`, `useNavigate`, `useAxios`, `Toast`

**New Features**:
1. **Detects published courses**: `isPublished = course.is_published_version === true`
2. **Different button for published courses**:
   - Draft courses: "Edit" button → links to editor
   - Published courses: "Edit Versi Terbaru" button → calls API endpoint
3. **Handles API response**:
   - Shows loading spinner while creating draft
   - Displays success/error toast messages
   - Auto-redirects to draft editor on success
4. **Visual improvements**:
   - Progress bar hidden for published courses
   - Delete button hidden for published courses (can't delete published)
   - Responsive button states

**Code Flow**:
```javascript
handleEditPublishedCourse() →
  API POST /teacher/course-edit-published/<course_id>/ →
    Response: draft course_id →
      Toast message →
        Navigate to /instructor/edit-course/<draft_id>/
```

## Database Schema Changes

### Course Model Fields Used
- `is_published_version` (Boolean): Flag indicating published version copy
- `parent_course` (ForeignKey): Points to published course (for draft revisions)
- `platform_status`: "Review" for drafts, "Published" for published copies

### Versioning Relationships
```
┌─ Published Course (is_published_version=True, parent_course=None)
│  └─ parent_course_id = 22 (the published course itself)
│
└─ Draft Revision (is_published_version=False, parent_course=Published)
   └─ parent_course_id = 22 (pointing to published)
   └─ NOT shown in instructor dashboard yet (being edited)
```

## How to Use

### For Instructors
1. Go to `/instructor/courses/` or `/instructor/dashboard/`
2. Find your published course in the list
3. Click **"Edit Versi Terbaru"** button
4. System creates (or retrieves) a draft version
5. Edit the draft in the course editor
6. Make your changes (content, curriculum, quizzes, etc.)
7. Click **"Simpan sebagai Draft"** or **"Kirim Review"**
8. If submitting for review:
   - Admin reviews the changes
   - Admin approves → published course is updated with new content
   - Admin rejects → draft is rejected, you can edit again

### For Developers
To test the endpoint manually:
```bash
curl -X POST http://localhost:8001/api/v1/teacher/course-edit-published/284197/
```

Expected response:
```json
{
  "success": true,
  "is_new": true,
  "course": {
    "course_id": "939531",
    "platform_status": "Review"
  }
}
```

## Testing Checklist

- [x] API endpoint creates draft from published course
- [x] API returns existing draft if one already exists
- [x] Instructor dashboard shows both draft and published courses
- [x] Published course shows "Edit Versi Terbaru" button
- [x] Clicking edit button creates/retrieves draft
- [x] Toast message shows success/loading state
- [x] Auto-redirect to draft editor works
- [x] Draft can be edited and resubmitted

## API Endpoints Summary

### Old Endpoints (Still functional)
- `GET /api/v1/teacher/course-lists/<teacher_id>/` - Lists courses (NOW shows published too!)
- `POST /api/v1/teacher/course-publish/<course_id>/` - Submit for publication

### New Endpoints
- `POST /api/v1/teacher/course-edit-published/<course_id>/` - Create/get draft from published

### Related Endpoints
- `POST /api/v1/teacher/course-restore/<course_id>/` - Restore published to previous state
- `POST /api/v1/admin/course-approval/<course_id>/` - Admin approves/rejects course

## File Changes Summary

### Backend
```
backend/api/views.py
  ├── CourseEditPublishedAPIView (NEW) - Lines 4088-4189
  └── TeacherCourseListAPIView (UPDATED) - Lines 3020-3047

backend/api/urls.py
  └── path(...course-edit-published...) (NEW) - Line 120
```

### Frontend
```
frontend/src/components/CourseCard.jsx
  ├── useState(creatingDraft) (NEW)
  ├── handleEditPublishedCourse() (NEW)
  ├── isPublished check (NEW)
  └── Conditional rendering for published courses (UPDATED)
```

## Behavior Points

### Edge Cases Handled
1. **Draft already exists**: Returns existing draft (no duplicate creation)
2. **Published course with no instructor access**: API still works (AllowAny permission)
3. **Concurrent edits**: Each published course can have only 1 active draft (enforced by parent_course FK)
4. **Restore functionality**: Existing `CourseRestoreAPIView` works with new drafts

### Limitations
- Only the instructor who created the course can edit it
- Cannot delete a published course (only draft/pending can be deleted)
- Published course content is read-only until a draft is created
- Once draft is created, instructor must resubmit it for admin approval before published course updates

## Next Steps / Future Improvements

1. **Batch operations**: Allow selecting multiple published courses to create drafts
2. **Template courses**: Clone a published course as a new draft without editing the original
3. **Version history**: Show which published version is active vs draft changes
4. **Auto-publish**: Allow instructors with high approval rate to auto-publish minor updates
5. **Change preview**: Show diff between published and draft versions before submission

## Related Documentation

- Course Versioning Architecture: See `COURSE_VERSIONING_ARCHITECTURE_PHASE_4.60.md`
- Course Approval Workflow: See `COURSE_APPROVAL_WORKFLOW_PHASE_4.36.md`
- Admin Review Interface: See `ADMIN_REVIEW_COURSE_DESIGN_FIX_PHASE_4.38.md`

---

**Completed**: February 22, 2026  
**Status**: ✅ Working - Tested and verified  
**Phase**: 4.76 - Published Course Editing Support
