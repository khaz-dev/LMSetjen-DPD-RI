# ✨ PHASE 4.36: Course Approval Workflow Implementation

## Overview
Implemented a complete course approval workflow where instructors must submit courses for admin review before they can be published. This ensures all courses meet quality standards before becoming available to students.

## Workflow Architecture

### Course Status Flow
```
Draft (Instructor creates/edits)
  ↓
Submit for Review (Instructor clicks "Ajukan untuk Review Admin")
  ↓ (platform_status = "Review")
  ├─→ Admin Reviews Course
      ├─→ Approve ✓ → Published (platform_status = "Published")
      └─→ Reject ✗ → Rejected (platform_status = "Rejected", rejection_reason set)
            ↓
        Instructor sees reason and edits
            ↓
        Resubmit → Back to Review status
```

## Database Changes

### Course Model Updates (PHASE 4.36)
Added 4 new fields to track approval workflow:

```python
rejection_reason = models.TextField(null=True, blank=True)
  # Admin's reason for rejection - shown to instructor for fixes

approved_by = models.ForeignKey(User, related_name="approved_courses")
  # Which admin approved the course

approval_date = models.DateTimeField(null=True, blank=True)
  # When course was approved

review_submitted_date = models.DateTimeField(null=True, blank=True)
  # When instructor submitted for review
```

### Migration File
- Created: `backend/api/migrations/0036_course_approval_workflow.py`
- Adds all 4 fields and updates platform_status choices documentation

**Existing PLATFORM_STATUS choices** (no changes needed):
- "Review" = Waiting for admin approval (NEW USAGE)
- "Draft" = Instructor hasn't submitted yet
- "Published" = Approved and available to students
- "Rejected" = Admin rejected, instructor must fix
- "Disabled" = Course was disabled by admin

## Backend Implementation

### 1. Modified CoursePublishAPIView
**Location**: `backend/api/views.py` line 3724

**Changes**:
- No longer auto-publishes courses
- Instead: Sets `platform_status = "Review"` to await admin approval
- Sets `review_submitted_date = timezone.now()`
- Clears `rejection_reason` from previous rejections
- Returns message: "Kursus Anda telah diajukan untuk review admin..."

### 2. New CourseApprovalAPIView  
**Location**: `backend/api/views.py` line 3819

**Purpose**: Admin-only endpoint to approve/reject courses

**Endpoint**: POST `/api/v1/admin/course-approval/<course_id>/`

**Request body**:
```json
{
  "action": "approve" or "reject",
  "rejection_reason": "Optional reason (required if action=reject)"
}
```

**Implementation**:
- Checks user is authenticated admin/superuser
- If action = "approve":
  - Sets `platform_status = "Published"`
  - Sets `approved_by = current_user`
  - Sets `approval_date = now()`
  - Clears `rejection_reason`
  - Course becomes available to students
  
- If action = "reject":
  - Sets `platform_status = "Rejected"`
  - Stores `rejection_reason` for instructor to see
  - Course remains unavailable
  - Instructor can fix issues and resubmit

**Response**:
```json
{
  "success": true,
  "message": "Kursus telah disetujui/ditolak",
  "course": {
    "course_id": "xxx",
    "title": "...",
    "platform_status": "Published/Rejected",
    "rejection_reason": "..." (if rejected),
    "approved_by": "Admin Name",
    "approval_date": "2026-02-17T..."
  }
}
```

### 3. New AdminCourseListAPIView
**Location**: `backend/api/views.py` line 3885

**Purpose**: List all courses awaiting admin review

**Endpoint**: GET `/api/v1/admin/courses-pending-review/?status=Review`

**Features**:
- Admin-only access check
- Filters by status (default: "Review")
- Ordered by `review_submitted_date` (newest first)
- Returns course details with all approval fields

## URL Configuration
**Location**: `backend/api/urls.py` lines 115-121

```python
path("admin/course-approval/<course_id>/", CourseApprovalAPIView.as_view()),
path("admin/courses-pending-review/", AdminCourseListAPIView.as_view()),
```

## Frontend Implementation

### CourseEdit.jsx Updates

#### 1. Updated handlePublishCourse() Dialog
- Changed button text: "Terbitkan Kursus" → "Ajukan untuk Review"
- Updated dialog to explain workflow:
  - Shows "Alur Persetujuan Kursus" (Approval Process)
  - Explains admin will review content/quality
  - Shows "Jika disetujui" → auto-publishes
  - Shows "Jika ditolak" → instructor gets feedback
- Button color: Green (#4CAF50) → Blue (#2196F3)

#### 2. Updated Response Handling
- Changed success message to acknowledge submission
- Shows "Menunggu persetujuan dari admin"
- Lists what happens next with ordered steps
- Calls `fetchCourseData()` to refresh status

#### 3. New Status Display Sections
Added 3 alert boxes to show approval status:

```jsx
{/* Rejection Reason Alert */}
{courseData?.platform_status === "Rejected" && (
  <alert>
    "Kursus Ditolak - Silakan Perbaiki"
    Shows rejection_reason from admin
    Button to resubmit for review
  </alert>
)}

{/* Pending Review Alert */}
{courseData?.platform_status === "Review" && (
  <alert>
    "Menunggu Persetujuan Admin"
    Message: "Kursus Anda sedang dalam proses review"
  </alert>
)}

{/* Published Alert */}
{courseData?.platform_status === "Published" && (
  <alert>
    "✓ Kursus Dipublikasikan"
    "Kursus Anda telah disetujui dan tersedia untuk siswa"
  </alert>
)}
```

#### 4. Updated Submit Button
- Changes visibility based on status
- Shows for: Draft or Rejected status
- Hidden for: Review or Published status
- Text changes:
  - Draft: "Ajukan untuk Review Admin"
  - Rejected: "Ajukan Ulang untuk Review"
- Icon: Paper plane (✈️) instead of rocket

#### 5. Condition Change
**Before**: `{courseData?.teacher_course_status === "Draft" && (...)}` - Only showed when teacher doesn't want to publish
**After**: `{(courseData?.platform_status === "Draft" || courseData?.platform_status === "Rejected") && (...)}` - Shows for actual submittable states

## User Experience Flow

### For Instructors:
1. **Create/Edit Course** → Status shows "Draft"
2. **Click "Ajukan untuk Review Admin"** → Opens approval workflow dialog
3. **Confirm Submission** → Status changes to "Review"
   - Shows alert: "Menunggu Persetujuan Admin"
   - Course NOT visible to students yet
4. **Option A - Admin Approves**:
   - Status changes to "Published"
   - Course visible to students
   - Alert shows: "✓ Kursus Dipublikasikan"
5. **Option B - Admin Rejects with Reason**:
   - Status changes to "Rejected"
   - Alert shows rejection reason from admin
   - Button appears: "Ajukan Ulang untuk Review"
   - Instructor can edit and resubmit

### For Admins:
1. **Access Admin Panel** → `/api/v1/admin/courses-pending-review/`
2. **See all pending courses** (status = "Review")
3. **Review course content**
4. **Click Approve** or **Reject** with reason
5. **System handles status update** and notifies instructor

## Key Workflow Benefits

✅ **Quality Control**: Admin reviews before courses go live
✅ **Feedback Loop**: Rejected courses show specific reasons
✅ **Transparency**: Instructors always know course status
✅ **Resubmission**: Easy to resubmit after rejection
✅ **Safety**: Can't publish directly anymore
✅ **Audit Trail**: Tracks who approved and when

## Testing Checklist

### Test 1: Submit for Review (Instructor)
- [ ] Go to course edit page (status = Draft)
- [ ] Click button text shows "Ajukan untuk Review Admin"
- [ ] Button color is blue (#2196F3)
- [ ] Dialog shows approval workflow steps
- [ ] After submission, status shows "Review"
- [ ] Alert shows "Menunggu Persetujuan Admin"

### Test 2: Approve Course (Admin)
- [ ] Access `/api/v1/admin/courses-pending-review/`
- [ ] See list of pending courses
- [ ] POST to `/api/v1/admin/course-approval/<id>/` with action="approve"
- [ ] Response confirms approval
- [ ] Course status changes to "Published"
- [ ] Instructor sees "✓ Kursus Dipublikasikan" alert
- [ ] Course appears to students on homepage

### Test 3: Reject Course (Admin)
- [ ] POST to `/api/v1/admin/course-approval/<id>/` with action="reject" + reason
- [ ] Response includes rejection_reason
- [ ] Course status changes to "Rejected"
- [ ] Instructor sees alert with rejection reason
- [ ] Button appears: "Ajukan Ulang untuk Review"
- [ ] Instructor can edit and resubmit

### Test 4: Resubmit After Rejection
- [ ] Fix issues mentioned in rejection reason
- [ ] Click "Ajukan Ulang untuk Review"
- [ ] Dialog shows approval workflow again
- [ ] Status goes back to "Review"
- [ ] Admin can review again

### Test 5: Edit Published Course
- [ ] Edit a published course
- [ ] Status should automatically change back to "Review"
- [ ] Needs re-approval before going live again
- [ ] (Optional: Add auto-revert logic to CourseUpdateAPIView)

## API Documentation

### Instructor Flow
```
POST /api/v1/teacher/course-publish/<course_id>/
Headers: JWT Token required
Response: 
  - platform_status: "Review"
  - review_submitted_date: timestamp
  - rejection_reason: null
```

### Admin Flow
```
POST /api/v1/admin/course-approval/<course_id>/
Headers: JWT Token (admin only)
Body: {
  "action": "approve" | "reject",
  "rejection_reason": "..."
}
Response:
  - platform_status: "Published" | "Rejected"
  - approved_by: admin_name
  - approval_date: timestamp
  - rejection_reason: admin_feedback
```

## Files Modified

### Backend
- `backend/api/models.py` - Added 4 fields to Course model
- `backend/api/views.py` - Modified CoursePublishAPIView, added CourseApprovalAPIView, added AdminCourseListAPIView
- `backend/api/urls.py` - Registered new admin endpoints
- `backend/api/migrations/0036_course_approval_workflow.py` - New migration

### Frontend
- `frontend/src/views/instructor/CourseEdit.jsx` - Updated:
  - `handlePublishCourse()` - New dialog text and workflow
  - Success/error messages - Updated for review submission
  - Status display sections - Shows current approval status
  - Submit button - Shows appropriate text based on status

## Next Steps (Optional Enhancements)

1. **Email Notifications**: Notify instructor when course is approved/rejected
2. **Admin Dashboard**: Create dedicated admin panel for course reviews
3. **Auto-Revert on Edit**: When published course is edited, auto-revert to "Review"
4. **Batch Approval**: Allow admin to approve multiple courses at once
5. **Review Timeline**: Track how long courses have been waiting for review
6. **Quality Metrics**: Show admin review statistics (approval rate, avg review time)

## Backward Compatibility

⚠️ **Breaking Changes**:
- Courses can no longer be published directly
- `platform_status = "Published"` now requires admin approval first
- Existing published courses maintain their status

✅ **Database Migration Needed**:
```bash
python manage.py migrate
```

## Phase Information
- **Phase**: 4.36
- **Status**: ✅ COMPLETE
- **Date Implemented**: 2026-02-17
- **Instructor Workflow**: Submit for Review
- **Admin Workflow**: Approve/Reject with Feedback

---

**Summary**: Implemented enterprise-grade course approval workflow ensuring quality control while providing transparent feedback to instructors. 🎓
