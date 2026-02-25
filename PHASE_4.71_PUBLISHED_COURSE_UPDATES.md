# PHASE 4.71: Published Course Updates & Republication Workflow

## Overview
Enhanced the course edit page to allow instructors to always restore and resubmit published courses for updates, enabling a workflow where published courses can be modified without creating new course versions.

## Changes Made

### Frontend Changes (CourseEdit.jsx)

#### 1. **Always Show "Restore Kursus" Button for Published Courses**
   - **Location**: Lines 1147-1203
   - **Change**: Removed `&& isDirty` condition
   - **Before**: `courseData?.platform_status === "Published" && isDirty`
   - **After**: `courseData?.platform_status === "Published"`
   - **Effect**: Button now always shows for published courses, allowing restore even without unsaved changes
   - **Helper Text**: Only shows "Anda memiliki perubahan yang belum disimpan" when `isDirty` is true

#### 2. **Always Show "Ajukan Review Admin untuk Publikasi Kursus" Button for Published Courses**
   - **Location**: Lines 1205-1277
   - **Change**: Added `courseData?.platform_status === "Published"` to status condition
   - **Before**: `(courseData?.platform_status === "Draft" || courseData?.platform_status === "Rejected" || courseData?.platform_status === "Review")`
   - **After**: `(courseData?.platform_status === "Draft" || courseData?.platform_status === "Rejected" || courseData?.platform_status === "Review" || courseData?.platform_status === "Published")`
   - **Button Text Change**: Dynamic text based on status
     - For Published: "Ajukan Review Admin untuk Publikasi Kursus"
     - For Rejected: "Ajukan Ulang Publikasi Kursus"
     - Otherwise: "Ajukan Publikasi Kursus"

#### 3. **Enhanced Confirmation Dialog for Republication**
   - **Location**: Lines 458-509
   - **Added**: `isRepublication` variable to detect if course is already published
   - **Changes**:
     - Title changes based on status (Republication vs. Initial Publication)
     - Dialog shows appropriate message for different statuses
     - Explains that published courses stay accessible during review
     - Button text changes: "Ajukan Perubahan untuk Publikasi" for republication

#### 4. **Enhanced Success Message for Republication**
   - **Location**: Lines 581-633
   - **Changes**:
     - Success message differs for initial publication vs. republication
     - Republication message emphasizes that:
       - Perubahan sedang ditinjau oleh admin
       - Kursus tetap dapat diakses siswa selama review
       - Perubahan akan langsung diterapkan jika disetujui

### Backend Changes (views.py)

#### 1. **Updated CoursePublishAPIView Documentation**
   - **Location**: Lines 3878-3896
   - **Enhancement**: Added note about PHASE 4.71 republication support
   - **Changes**:
     - Documented that published courses can now be resubmitted
     - Clarified that instructor can modify and resubmit without creating new courses
     - Noted that admin review process is same as initial publication

#### 2. **No Logic Changes Needed**
   - The API already supports republication because:
     - No status pre-check before accepting submissions
     - Validation same for all submission types
     - `platform_status` is set to "Review" for all new submissions
     - Backend doesn't prevent Published courses from resubmitting

### User Workflows

#### Workflow 1: Restore Published Course to Last Published Version
```
1. Instructor visits edit page of published course
2. Sees "✓ Kursus Dipublikasikan" alert
3. Clicks "Restore Kursus" button (always available)
4. Confirms action in dialog
5. Course reverts to published version
6. All unsaved changes discarded
7. isDirty flag clears, helper text disappears
```

#### Workflow 2: Update Published Course
```
1. Instructor visits edit page of published course
2. Makes changes to course content
3. Saves changes via "Simpan Draf" button
4. Sees "Anda memiliki perubahan yang belum disimpan"
5. Clicks "Ajukan Review Admin untuk Publikasi Kursus" button
6. Confirms action in republication dialog
7. Changes submitted to admin for review
8. Course stays published and accessible to students
9. If approved: updates apply immediately
10. If rejected: receives feedback to revise
```

#### Workflow 3: Make Mistake, Immediately Restore
```
1. Published course accidentally gets wrong content
2. Instructor doesn't save (or saves by mistake)
3. Instantly clicks "Restore Kursus"
4. Course reverted to published version
5. Mistake undone
```

## Key Features

### Flexibility
- ✅ Instructors can modify published courses without creating new versions
- ✅ Can restore published course anytime as safety net
- ✅ Can submit updates for admin review while course stays live
- ✅ Published courses now have same edit capabilities as draft courses

### User Experience
- ✅ Clear dialog messages for different scenarios
- ✅ Dynamic button text reflects current action
- ✅ Helper text shows only when relevant
- ✅ Confirmation dialogs prevent accidental actions

### Safety
- ✅ Restore button always available for quick recovery
- ✅ Changes stay in draft until admin approval
- ✅ Validation same for all publication types
- ✅ Admin review required for any changes to published courses

## Button Visibility Matrix

| Course Status | Show "Simpan Draf" | Show "Restore Kursus" | Show "Ajukan Review" |
|---|---|---|---|
| Draft | ✓ | ✗ | ✓ |
| Review | ✓ | ✗ | ✓ |
| Rejected | ✓ | ✗ | ✓ |
| Published | ✓ | ✓ (NEW) | ✓ (NEW) |

## Testing Checklist

- [ ] Visit /instructor/edit-course/[id]/ with Published course
- [ ] Verify "✓ Kursus Dipublikasikan" alert shows
- [ ] Verify "Restore Kursus" button always visible
- [ ] Verify "Ajukan Review Admin untuk Publikasi Kursus" button visible
- [ ] Click "Restore Kursus" without making changes → dialog appears
- [ ] Make changes → Click "Restore Kursus" → helper text shows
- [ ] Make changes → Click "Simpan Draf" → changes saved
- [ ] Click "Ajukan Review Admin untuk Publikasi Kursus" → special dialog for republication
- [ ] Verify button text shows "Ajukan Review Admin untuk Publikasi Kursus" (not "Ajukan Publikasi Kursus")
- [ ] Submit for republication → verify API call succeeds
- [ ] Check success message differentiates republication
- [ ] Verify button names in Indonesian and context-aware

## API Behavior

**POST /api/v1/teacher/course-publish/<course_id>/**
- Accepts: Draft, Review, Rejected, Published courses
- Validation: Same for all (title, description, category, curriculum, lessons)
- Result: Sets `platform_status = "Review"`
- Effect: Course goes into admin review queue
- Note: Works for both initial and republication submissions

## Related Files Modified

1. `frontend/src/views/instructor/CourseEdit.jsx` (Lines 458-509, 1147-1203, 1205-1277)
2. `backend/api/views.py` (Lines 3878-3896)

## Phase Notes
- ✨ PHASE 4.71: Published course republication support
- Part of ongoing course management enhancement
- Enables more flexible course update workflow
- Reduces need for creating new course versions

