# 🎯 EXECUTIVE SUMMARY: Course Edit Button Workflow Update

## What Was Changed And Why

### The Problem You Identified
On the instructor course edit page (`/instructor/edit-course/168075/`), the button labels were confusing:
- **"Perbarui Kursus"** made it seem like the course was being updated/published when it only saved as draft
- **"Ajukan untuk Review Admin"** was vague - users didn't understand they were submitting for PUBLICATION approval
- **No way to undo/restore** if the instructor made unwanted changes to a published course

### The Solution Delivered

#### 1️⃣ **Button Label: "Simpan Draf" (Save Draft)**
- **Was:** "Perbarui Kursus" (Update Course)
- **Now:** "Simpan Draf" (Save Draft)  
- **Impact:** Crystal clear - this saves the course as a DRAFT, doesn't publish it
- **Success message:** "Draf Tersimpan!" instead of "Berhasil Diperbarui!"

#### 2️⃣ **Button Label: "Ajukan Publikasi Kursus" (Submit for Publication)**
- **Was:** "Ajukan untuk Review Admin" (Submit for Admin Review)
- **Now:** "Ajukan Publikasi Kursus" (Submit for Publication approval)
- **Updated Dialog:** Now clearly explains "persetujuan publikasi" (publication approval)
- **Impact:** Users understand they're submitting to get their course PUBLISHED, not just reviewed
- **For Rejected Status:** "Ajukan Ulang Publikasi Kursus" (Resubmit for Publication)

#### 3️⃣ **New Button: "Restore Kursus" (Restore Course)**
- **Shows:** Only when course is Published AND has unsaved changes
- **Function:** Reverts the course back to its published version, undoing all local changes
- **Visual:** Orange button with undo icon (↶)
- **Dialog:** Asks for confirmation before restoring
- **Impact:** Instructors can safely make changes knowing they can always restore to the published version

---

## How It Works (Complete Workflow)

### Creating a New Course
```
Draft → Add Curriculum → Click "Simpan Draf" → Click "Ajukan Publikasi Kursus" 
→ Admin Reviews → Approved → Published (Students see it)
```

### Editing a Published Course
```
Published Course:
├─ Click "Simpan Draf" → Saves changes locally
├─ Changes accumulate (isDirty = true)
├─ Two options appear:
│  ├─ Option A: Click "Ajukan Publikasi Kursus"
│  │  └─ Admin reviews changes → Approves → Students see updated version
│  │
│  └─ Option B: Click "Restore Kursus" 
│     └─ Undo all changes → Course returns to published version
│        → "Restore" button disappears (isDirty = false)
```

### Course Gets Rejected
```
Published → (Changes made) → Submit for Publication "Ajukan Publikasi Kursus"
→ Admin Rejects with Reason
→ Status becomes "Rejected"
→ Instructor sees reason and fixes issues
→ Click "Ajukan Ulang Publikasi Kursus" to resubmit
→ Admin reviews again → Approved → Published
```

---

## Technical Implementation Details

### Files Modified

#### Frontend
- **`frontend/src/views/instructor/CourseEdit.jsx`**
  - Changed button labels (lines 978, 1046, 1088, 1208)
  - Updated dialog text (lines 427-521, 473-498)
  - Added `handleRestoreCourse()` function (lines 384-442)
  - Added Restore button UI (lines 1038-1087)

#### Backend  
- **`backend/api/views.py`**
  - Added `CourseRestoreAPIView` class (lines 3949-4055)
  - Endpoint: `POST /api/v1/teacher/course-restore/<course_id>/`
  - Handles restoring course from published version

- **`backend/api/urls.py`**
  - Added URL route: `path("teacher/course-restore/<course_id>/", ...)`

### Button Visibility Logic

| Course Status | isDirty | Simpan Draf | Ajukan Publikasi | Restore Kursus |
|---|---|---|---|---|
| Draft | ✓ | ✅ Enabled | ✅ | ❌ |
| Draft | ✗ | ❌ Disabled | ✅ | ❌ |
| Review | any | ✅ | ❌ Waiting | ❌ |
| Rejected | ✓ | ✅ Enabled | ✅ | ❌ |
| Rejected | ✗ | ❌ Disabled | ✅ | ❌ |
| Published | ✓ | ✅ Enabled | ❌ | ✅ |
| Published | ✗ | ❌ Disabled | ❌ | ❌ |

---

## What Actually Happens Behind The Scenes

### When User Clicks "Simpan Draf"
1. Frontend validates all fields
2. Sends PUT request to `/api/v1/teacher/course-edit/<course_id>/`
3. Backend saves: title, description, category, level, image, intro video
4. If course was Published → automatically creates draft copy for editing
5. Clears isDirty flag (button becomes disabled)
6. Shows success: "Draf Tersimpan!"

### When User Clicks "Ajukan Publikasi Kursus"
1. Frontend shows confirmation dialog
2. Validates course has curriculum + lessons
3. Sends POST request to `/api/v1/teacher/course-publish/<course_id>/`
4. Backend sets `platform_status = "Review"` (waiting for admin)
5. Shows success: "Kursus Diajukan untuk Publikasi!"
6. Submit button becomes disabled (Admin must approve/reject)

### When User Clicks "Restore Kursus"
1. Frontend shows confirmation dialog with warning
2. Sends POST request to `/api/v1/teacher/course-restore/<course_id>/`
3. Backend copies data from published version back to draft
4. Frontend receives restored course data
5. Clears isDirty flag
6. Shows success: "Kursus Berhasil Dikembalikan!"
7. Restore button disappears

---

## Status Terminology Clarified

The system uses two status fields:

### platform_status (Admin-controlled)
- **Draft** → Not ready for publication
- **Review** → Waiting for admin approval (student cannot see)
- **Published** → Approved, students can see (instructor cannot edit directly)
- **Rejected** → Needs fixes, instructor can improve and resubmit

### teacher_course_status (Instructor-controlled)  
- **Draft** → Course is incomplete
- **Published** → Instructor wants to publish (once admin approves)
- **Disabled** → Instructor disabled the course

---

## Quick Reference for Instructors

### "Simpan Draf" = Save as Draft Draft
- ✅ Saves course information
- ❌ Does NOT publish to students
- ❌ Does NOT submit to admin
- ✅ Can be done repeatedly, no limit
- Response: "Draf Tersimpan!"

### "Ajukan Publikasi Kursus" = Submit for Publication
- ✅ Asks admin to review and publish
- ❌ Does NOT immediately publish
- ✅ Admin can approve (then students see it)
- ✅ Admin can reject (then instructor fixes and resubmits)
- Response: "Kursus Diajukan untuk Publikasi!"

### "Restore Kursus" = Undo & Restore to Published
- ✅ Undoes all local changes
- ✅ Reverts to published version (what students see)
- ❌ Cannot be undone (be careful!)
- ✅ Only available when changes exist on published course
- Response: "Kursus Berhasil Dikembalikan!"

---

## Impact Summary

✅ **Clearer User Intent** - Labels now match what actually happens
✅ **Reduced Confusion** - Users understand publication approval vs. simple save
✅ **Safety Feature** - Can restore published version if changes go wrong
✅ **No Workflow Changes** - Admin approval workflow remains same
✅ **Backward Compatible** - Works with existing course versioning system

---

## Testing Verification

✅ Frontend changes verified (all labels match)
✅ Backend endpoint verified (syntax error checks passed)
✅ URL routing verified (new endpoint properly configured)
✅ No conflicts with existing code
✅ Maintains compatibility with course versioning (PHASE 4.60)

---

**Implementation Date:** February 21, 2026  
**Status:** ✅ COMPLETE AND READY FOR TESTING  
**Phase:** 4.60D (Course UI/UX Improvements)
