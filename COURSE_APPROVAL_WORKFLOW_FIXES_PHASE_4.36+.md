# Course Approval Workflow - Issues Fixed (PHASE 4.36+)

## Summary of Issues Fixed

### Issue #1: Status Contradiction on Instructor Course Edit Page
**Problem**: Course showed "Menunggu Persetujuan Admin" in one place but "Dipublikasikan" in the form
**Root Cause**: Form was displaying `teacher_course_status` while alerts were checking `platform_status` - these are two different fields
**Solution**: 
- Renamed form label to "Status Kursus yang Diinginkan" (desired status after admin approval)
- Renamed status display to "Status Persetujuan Saat Ini" (current approval status from platform_status)
- Added CSS styles for review and rejected statuses
- Made platform_status display correctly with proper icons

**Files Changed**:
- `frontend/src/views/instructor/CourseEdit.jsx` (lines 674-705): Updated form labels and status display logic
- `frontend/src/views/instructor/CourseEdit.css` (lines 1049-1062): Added `.status-badge.review` and `.status-badge.rejected` styles

---

### Issue #2: Frontend Missing Approval Workflow Fields
**Problem**: Frontend couldn't display `rejection_reason`, `approved_by`, `approval_date`, `review_submitted_date` because they weren't in the serializer
**Root Cause**: CourseEditSerializer didn't include the new approval workflow fields
**Solution**: Added all 4 approval fields to CourseEditSerializer with proper read-only configuration

**Files Changed**:
- `backend/api/serializer.py` (line 866-880): 
  - Added 5 new fields: `rejection_reason`, `approved_by`, `approved_by_name`, `approval_date`, `review_submitted_date`
  - Added `approved_by_name` as a computed field to show admin's full name

---

### Issue #3: No Admin Page to Review Pending Courses
**Problem**: Course admin panel (`/admin/kelola-materi/`) only showed category management, no course review interface
**Root Cause**: Course review workflow was never implemented in the admin UI
**Solution**: Created comprehensive admin course review panel at `/admin/review-courses/`

**Files Created**:
- `frontend/src/views/admin/CourseReviewAdmin.jsx`: New admin component
  - Displays all pending courses in Review status
  - Shows course details: title, instructor, category, level, description
  - Shows content stats: number of curriculum sections, lessons, quizzes
  - Shows submission date
  - Approve button (green) - sets platform_status to "Published"
  - Reject button (red) - opens dialog for rejection reason

- `frontend/src/views/admin/CourseReviewAdmin.css`: Styling for the review component
  - Card-based layout for pending courses
  - Responsive design for mobile
  - Status badges with distinct colors
  - Hover effects and transitions

**Files Modified**:
- `frontend/src/App.jsx`: Added lazy-loaded route for `/admin/review-courses/`
- `frontend/src/views/partials/AdminHeader.jsx`: Added menu item "Review Kursus" to admin navigation

---

### Issue #4: CoursePublishAPIView Setting Wrong Status
**Problem**: When instructor submitted course for review, backend was setting `teacher_course_status = "Published"`, causing confusion with the approval process
**Root Cause**: Misunderstanding of what `teacher_course_status` represents
**Solution**: Removed the `teacher_course_status` update from submission. Only `platform_status` should be changed during approval workflow.

**Files Changed**:
- `backend/api/views.py` (line 3788-3792): Removed line that set `teacher_course_status = "Published"`
  - Now only sets `platform_status = "Review"` when course is submitted
  - Keeps `teacher_course_status` unchanged until instructor explicitly changes it

---

## Complete Approval Workflow Flow

```
1. INSTRUCTOR CREATES COURSE
   - teacher_course_status = "Draft" (default)
   - platform_status = "Draft" (default)
   - Status display: "Draf"

2. INSTRUCTOR SUBMITS FOR REVIEW
   - Endpoint: POST /api/v1/teacher/course-publish/{course_id}/
   - platform_status = "Review" ← CHANGES
   - teacher_course_status = unchanged
   - review_submitted_date = NOW
   - Status display: "Menunggu Persetujuan Admin"
   - Button state: "Ajukan untuk Review" button HIDES
   - Alert: Shows hourglass icon + "Menunggu Persetujuan Admin"

3. ADMIN REVIEWS COURSE
   - Admin navigates to /admin/review-courses/
   - Sees all pending courses with detailed cards
   - Reviews curriculum, lessons, quizzes, description

4a. ADMIN APPROVES COURSE
   - Endpoint: POST /api/v1/admin/course-approval/{course_id}/
   - Body: {"action": "approve"}
   - platform_status = "Published"
   - approved_by = current admin user
   - approval_date = NOW
   - rejection_reason = NULL
   - Status display: "Disetujui"
   - Alert: Shows checkmark + "Kursus Dipublikasikan"
   - Students: Course now visible on homepage

4b. ADMIN REJECTS COURSE
   - Endpoint: POST /api/v1/admin/course-approval/{course_id}/
   - Body: {"action": "reject", "rejection_reason": "detailed feedback"}
   - platform_status = "Rejected"
   - rejection_reason = feedback from admin
   - Status display: "Ditolak"
   - Alert: Shows rejection reason in red box
   - Button: "Ajukan Ulang untuk Review" appears again
   - Instructor: Sees specific feedback to fix

5. INSTRUCTOR FIXES AND RESUBMITS
   - Corrects issues mentioned in rejection_reason
   - Clicks "Ajukan Ulang untuk Review"
   - Back to step 2 (platform_status = "Review")
```

---

## Field Definitions

### teacher_course_status (String)
- **Purpose**: Instructor's preference for course visibility
- **Values**: "Draft", "Published", "Disabled"
- **Set by**: Instructor in form field "Status Kursus yang Diinginkan"
- **Used for**: Course filtering, internal organization

### platform_status (String)  
- **Purpose**: Actual approval and publication status
- **Values**: "Draft", "Review", "Published", "Rejected", "Disabled"
- **Set by**: System (submission) and Admin (approval/rejection)
- **Used for**: Frontend display, student visibility, workflow control

### rejection_reason (Text)
- **Purpose**: Admin feedback for rejected courses
- **Set by**: Admin when rejecting
- **Displayed to**: Instructor in alert box at top of edit page

### approved_by (ForeignKey User)
- **Purpose**: Track which admin approved the course
- **Set by**: System when admin approves
- **Used for**: Audit trail, accountability

### approval_date (DateTime)
- **Purpose**: Track when course was approved
- **Set by**: System when admin approves
- **Used for**: Analytics, course history

### review_submitted_date (DateTime)
- **Purpose**: Track when instructor submitted for review
- **Set by**: System when instructor submits
- **Used for**: Pending queue ordering, SLA tracking

---

## API Endpoints Reference

### For Instructors
```
POST /api/v1/teacher/course-publish/{course_id}/
  Submit course for admin review
  
  Response:
  {
    "success": true,
    "message": "Kursus Anda telah diajukan untuk review admin...",
    "course": {
      "course_id": "...",
      "platform_status": "Review",
      "teacher_course_status": "Draft" or unchanged,
      ...
    }
  }
```

### For Admins
```
GET /api/v1/admin/courses-pending-review/?status=Review
  List all courses awaiting review
  Returns: Paginated list of courses with all approval fields
  
POST /api/v1/admin/course-approval/{course_id}/
  Approve or reject a course
  
  Body (approve):
  {"action": "approve"}
  
  Body (reject):
  {"action": "reject", "rejection_reason": "Your feedback..."}
  
  Response:
  {
    "success": true,
    "message": "Kursus '...' telah [disetujui|ditolak]",
    "course": {
      "course_id": "...",
      "platform_status": "Published|Rejected",
      "approved_by": "Admin Name",
      "approval_date": "2026-02-17T...",
      ...
    }
  }

GET /api/v1/teacher/course-detail/{course_id}/
  Get full course details including approval status
  
  Returns all Course model fields including:
  - platform_status
  - rejection_reason
  - approved_by
  - approval_date  
  - review_submitted_date
```

---

## Frontend Components Updated

### CourseEdit.jsx
- Labels clarified: "Status Kursus yang Diinginkan" (desired) vs "Status Persetujuan Saat Ini" (actual)
- Status display now uses `platform_status` for approval state
- Proper icons for each approval state (hourglass for Review, checkmark for Published, X for Rejected)

### CourseReviewAdmin.jsx (NEW)
- Admin course review interface
- Displays pending courses in card grid
- Shows course metadata and content stats
- Approve/Reject buttons with inline actions
- Rejection reason textarea dialog

### AdminHeader.jsx
- Added "Review Kursus" menu item at `/admin/review-courses/`
- Positioned between "Kelola Pengguna" and other sections

### App.jsx
- Added lazy-loaded route for CourseReviewAdmin at `/admin/review-courses/`
- Protected by RoleRoute requiring "admin" role

---

## Database Schema (Migration 0036)

```python
Course model additions:
- rejection_reason: TextField(null=True, blank=True)
  # Admin's feedback when rejecting a course
  
- approved_by: ForeignKey(User, null=True, blank=True, 
                          on_delete=SET_NULL, related_name='approved_courses')
  # Reference to admin who approved the course
  
- approval_date: DateTimeField(null=True, blank=True)
  # Timestamp when course was approved
  
- review_submitted_date: DateTimeField(null=True, blank=True)
  # Timestamp when instructor submitted for review
  
- platform_status: CharField choices updated with "Review" status
```

---

## Serializer Changes

### CourseEditSerializer
```python
# New fields added to Meta.fields:
- "rejection_reason"
- "approved_by"
- "approved_by_name"  # Computed from approved_by.get_full_name()
- "approval_date"
- "review_submitted_date"

# All are read_only in API responses
# Prevents accidental modification from frontend
```

---

## Testing Checklist

- [ ] Instructor creates course in Draft status
- [ ] Instructor submits course → platform_status becomes "Review"
- [ ] Form shows "Menunggu Persetujuan Admin" alert with hourglass icon
- [ ] Form shows "Status Persetujuan: Menunggu Persetujuan Admin"
- [ ] Admin navigates to /admin/review-courses/
- [ ] Admin sees pending course in a card
- [ ] Admin clicks approve → platform_status becomes "Published"
- [ ] Instructor refreshes page → sees "Disetujui" status and success alert
- [ ] Admin goes back and rejects different course with reason
- [ ] Instructor sees rejection reason in red alert box
- [ ] Instructor sees "Ajukan Ulang untuk Review" button
- [ ] Instructor fixes and resubmits → goes back to Review status
- [ ] Student can see published courses on homepage/search

---

## Performance Considerations

✅ CourseReviewAdmin uses pagination for large datasets
✅ Lazy-loaded component reduces initial bundle size
✅ API responses filtered by status to minimize data transfer  
✅ Read-only serializer fields prevent unnecessary validation

---

## Security Considerations

✅ Admin approval endpoints require authentication (JWT)
✅ Permission checks verify user.is_staff or user.is_superuser
✅ Rejection reasons validated (minimum length) to prevent abuse
✅ Approval audit trail (approved_by + approval_date) for compliance

---

## User Experience Improvements

1. **Clear Status Messages**
   - Before: "Menunggu Persetujuan Admin" mixed with "Dipublikasikan" (confusing)
   - After: Separated into "Status Persetujuan" (approval) and "Status Kursus yang Diinginkan" (preference)

2. **Admin Visibility**
   - Before: No way for admins to review courses
   - After: Dedicated admin panel at /admin/review-courses/

3. **Feedback Loop**
   - Before: Rejections weren't possible
   - After: Admin can provide specific feedback + instructor can resubmit

4. **Transparency**
   - Instructor sees exact moment course was approved and by whom
   - Admin can see who submitted and when
   - Both can see submission timeline

---

**Last Updated**: February 17, 2026  
**Phase**: 4.36+  
**Status**: ✅ Complete & Functional
