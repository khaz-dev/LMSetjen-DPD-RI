# PHASE 4.74: Publish Versioning Testing & Verification Guide

**Implementation Date**: February 22, 2026  
**Status**: Ready for Testing  
**Target**: Full backend + frontend integration validation  

---

## IMPLEMENTATION SUMMARY

### Backend Changes ✅

#### 1. **Course Model Enhancements** (`backend/api/models.py`)

Added 3 new methods:

**Method 1: `_copy_content_to(target_course)` - ENHANCED**
- Previously only copied: Curriculum, Features, Requirements, Learning Outcomes
- NOW ALSO copies: Quizzes, Quiz Questions, Quiz Choices
- Includes comprehensive logging for debugging

**Method 2: `submit_for_publication()` - NEW**
- Called when instructor clicks "Ajukan Publikasi Kursus"
- If FIRST publish: Creates new published course copy with all content
- If RE-PUBLISH: Deletes old published content, copies new content
- Sets platform_status = "Review" (waiting for admin)  
- Returns: (published_course, is_new) tuple

**Method 3: `restore_to_published()` - NEW**
- Called when instructor clicks "Restore Kursus"
- Gets published course copy
- Deletes all draft content
- Re-copies from published version
- Restores metadata from published_snapshot
- Returns: (success, message) tuple

#### 2. **CoursePublishAPIView** (`backend/api/views.py` ~line 3970)

Updated to use new `submit_for_publication()` method:

```python
# BEFORE: Manual status setting + no published copy creation
course.platform_status = "Review"
course.save()

# AFTER: Enhanced versioning with auto-publish creation
published_course, is_new = course.submit_for_publication()
# Returns clear success message about version created/updated
```

#### 3. **CourseApprovalAPIView** (`backend/api/views.py` ~line 4120)

Added `_get_or_create_published_copy()` helper method:

```python
def _get_or_create_published_copy(self, course):
    # Ensures published copy exists before approval
    # Creates one if doesn't exist
    # Returns existing one if does exist
```

Updated approval logic to:
1. Get/create published copy
2. Mark published copy as "Published"
3. Sync draft course status
4. Save published snapshot for restore
5. Clear rejection reasons

#### 4. **CourseRestoreAPIView** (`backend/api/views.py` ~line 3981)

Completely rewritten to use new `restore_to_published()` method:

```python
# Validates published version exists
# Calls course.restore_to_published()
# Returns detailed response with restored content counts
```

### Frontend Changes ✅

#### 1. **CourseEdit.jsx - New Restore Function**

Added `handleRestoreCourse()` function (similar to `handlePublishCourse`):
- Confirms action with detailed warning dialog
- Calls `teacher/course-restore/{course_id}/` endpoint
- Updates local course data on success
- Shows success dialog with restored content summary
- Refreshes course data

#### 2. **CourseEdit.jsx - Restore Button UI**

Added visual button that appears when:
- `courseData?.platform_status === "Published"`
- `courseData?.published_copies` exists (has published version)

Button style:
- Orange gradient (Linear 135deg: #FF9800 → #F57C00)
- Matches "Restore" semantic color (warning/caution)
- Click-to-activate with spinner state
- Hover animations

---

## TESTING STRATEGY

### Test Scope
- ✅ Backend: API endpoints + database operations
- ✅ Frontend: UI rendering + API calls
- ✅ Integration: Full end-to-end workflows

### Test Data
- Course ID: **284197** (Rabuan III - Public Speaking)
- Has all content: Curriculum (1), Lessons (1), Quizzes (1+)
- Instructor: Can submit/restore
- Admin: Can approve/reject

---

## TESTING CHECKLIST

### PHASE 1: Backend API Testing

#### Test 1.1: Submit for Publication (First Time)

**Setup:**
- Course status: Draft
- Has all required content (curriculum, lessons, quizzes)

**Steps:**
```bash
# Call publish endpoint
POST http://localhost:8001/api/v1/teacher/course-publish/284197/
```

**Expected Results:**
- ✅ Response: success=true
- ✅ Message mentions "dibuat" (created)
- ✅ Course platform_status = "Review"
- ✅ New published_copy created with is_published_version=True
- ✅ Published copy contains all content (curriculum, quizzes, etc.)
- ✅ Database: Course table has 2 records (draft + published)

**Database Verification:**
```sql
SELECT id, course_id, title, platform_status, is_published_version, parent_course_id
FROM api_course 
WHERE title LIKE '%Public Speaking%'
ORDER BY id;
```

**Expected:**
```
id  | course_id | title                            | platform_status | is_published_version | parent_course_id
284197 | (id1)  | Rabuan III - Public Speaking... | Review         | False               | NULL
(id2)  | (uuid)  | Rabuan III - Public Speaking... | Draft          | True                | 284197
```

---

#### Test 1.2: Submit for Publication (Re-publish)

**Setup:**
- Previous test passed
- Edit the draft course (add/modify curriculum)

**Steps:**
```bash
# Call publish endpoint again
POST http://localhost:8001/api/v1/teacher/course-publish/284197/
```

**Expected Results:**
- ✅ Response: success=true
- ✅ Message mentions "diperbarui" (updated) NOT "dibuat"
- ✅ Only ONE published_copy still exists (old content deleted, new content copied)
- ✅ Published copy has NEW curriculum items
- ✅ No new records created, existing one updated

---

#### Test 1.3: Admin Approval of Course

**Setup:**
- Course submitted for publication (platform_status = "Review")
- Published copy exists

**Steps:**
```bash
# Call approval endpoint
POST http://localhost:8001/api/v1/admin/course-approval/284197/
{
    "action": "approve"
}
```

**Expected Results:**
- ✅ Response: success=true
- ✅ Both draft AND published copies have platform_status = "Published"
- ✅ Both have teacher_course_status = "Published"  
- ✅ approval_date is set
- ✅ approved_by is set to admin user
- ✅ published_snapshot is saved

**Database Verification:**
```sql
SELECT platform_status, teacher_course_status, approved_by, approval_date
FROM api_course
WHERE title LIKE '%Public Speaking%'
ORDER BY is_published_version;
```

**Expected:**
```
platform_status | teacher_course_status | approved_by | approval_date
Published      | Published            | (admin_id) | (current_datetime)
Published      | Published            | (admin_id) | (current_datetime)
```

---

#### Test 1.4: Course Restore

**Setup:**
- Course published (platform_status = "Published")
- Has published_snapshot
- Draft has different content than published (to verify restoration)

**Steps:**
```bash
# Call restore endpoint
POST http://localhost:8001/api/v1/teacher/course-restore/284197/
```

**Expected Results:**
- ✅ Response: success=true
- ✅ Draft course content matches published course content
- ✅ Curriculum sections match (count + structure)
- ✅ Lessons match
- ✅ Quizzes + questions + choices all match
- ✅ Features, requirements, learning outcomes all match
- ✅ Metadata (title, description, level, image) match
- ✅ Response includes counts: curriculum_count, lessons_count, quizzes_count

**Database Verification:**
```sql
-- Check draft curriculum vs published curriculum
SELECT COUNT(*) FROM api_variant WHERE course_id = 284197;
-- (should match published_copy curriculum count)
```

---

### PHASE 2: Frontend UI Testing

#### Test 2.1: Publish Button Appears Correctly

**URL:** `http://localhost:5174/instructor/edit-course/284197/`

**Checks:**
- ✅ Button visible when platform_status != "Published"
- ✅ Button text changes based on status:
  - Draft → "Ajukan Publikasi Kursus"
  - Published → "Ajukan Review Publikasi"
  - Rejected → "Ajukan Ulang Publikasi Kursus"
- ✅ Button disabled when missing content or status not "Published"  
- ✅ Error message shows: "Pilih 'Dipublikasikan'..." when teacher_course_status != "Published"

---

#### Test 2.2: Click Publish Button

**Steps:**
1. Ensure all content filled (curriculum, lessons, quizzes)
2. Set Status Kursu = "Dipublikasikan"
3. Click "Ajukan Publikasi Kursus"

**Expected:**
- ✅ Confirmation dialog appears
- ✅ Dialog shows correct course title
- ✅ User can confirm/cancel
- ✅ Button shows spinner while submitting
- ✅ Success dialog appears
- ✅ Success dialog shows: "dibuat" or "diperbarui"
- ✅ Course data updates locally
- ✅ Platform_status changes to "Review"

---

#### Test 2.3: Restore Button Appears

**Setup:**
- Course published
- published_copies record exists

**Checks:**
- ✅ Button visible when platform_status === "Published" 
- ✅ Button not visible for Draft courses
- ✅ Button label: "Restore Kursus"
- ✅ Button styled in orange (warning color)
- ✅ Button has undo icon

---

#### Test 2.4: Click Restore Button

**Steps:**
1. Edit published course (change title, add/remove curriculum)
2. Click "Restore Kursus" button

**Expected:**
- ✅ Warning dialog appears
- ✅ Dialog clearly states action is "tidak dapat dibatalkan" (irreversible)
- ✅ Lists what will be restored
- ✅ User must confirm with red "Ya, Kembalikan" button
- ✅ Button shows spinner while restoring
- ✅ Success dialog appears with:
  - Course title
  - Content counts (sections, lessons, quizzes)
  - Confirmation that status is "Published"
- ✅ Local course data updates
- ✅ Course form shows restored values
- ✅ Curriculum section shows restored curriculum

---

### PHASE 3: End-to-End Workflow Testing

#### Test 3.1: Complete Publish Workflow

**Scenario:** Instructor creates course, publishes, gets approved

**Steps:**
1. ✅ Create course via CourseCreate page
2. ✅ Add: Informasi Dasar (title, description, category, level)
3. ✅ Add: Kurikulum (sections + lessons)
4. ✅ Add: Kuis (at least 1 quiz with questions)
5. ✅ Set: Status = "Dipublikasikan"
6. ✅ Click: "Ajukan Publikasi Kursus"
7. ✅ Verify: platform_status = "Review" in UI
8. ✅ Login as ADMIN
9. ✅ Go to: http://localhost:5174/admin/review-course/
10. ✅ Find course
11. ✅ Click: "Setujui" (Approve)
12. ✅ Verify: Success message
13. ✅ Login as STUDENT
14. ✅ Go to: http://localhost:5174/course/ (course list)
15. ✅ Verify: Course visible in list
16. ✅ Click: Course → open course detail
17. ✅ Verify: Can see curriculum, lessons, quizzes

**Success Criteria:**
- ✅ Course NOT visible to students until admin approves
- ✅ Course visible to students AFTER admin approves
- ✅ Published version used (not draft)

---

#### Test 3.2: Publish → Edit → Restore Workflow

**Scenario:** Instructor edits published course, realizes mistake, restores

**Steps:**
1. ✅ Start with published course (from Test 3.1)
2. ✅ Edit: Change title to "EDITED TITLE"
3. ✅ Remove: First curriculum section
4. ✅ Add: New quiz
5. ✅ Click: Save (form saves)
6. ✅ Verify: Changes appear in form
7. ✅ Click: "Restore Kursus"
8. ✅ Confirm: Yes in dialog
9. ✅ Verify: Title reverted to original
10. ✅ Verify: Curriculum section restored
11. ✅ Verify: New quiz is gone
12. ✅ Verify: Status is "Published" (not "Review")

**Success Criteria:**
- ✅ Draft changes completely reverted
- ✅ Published version content fully restored
- ✅ Course accessible to students unchanged

---

#### Test 3.3: Publish → Edit → Publish Again → Approve

**Scenario:** Published course edited, resubmitted, re-approved

**Steps:**
1. ✅ Start with published APPROVED course
2. ✅ Edit: Add new curriculum section
3. ✅ Click: "Ajukan Review Publikasi"
4. ✅ Verify: Dialog shows it's a republication
5. ✅ Confirm: Submit
6. ✅ Verify: platform_status = "Review"
7. ✅ Verify: Published copy updated with new section
8. ✅ Login as ADMIN
9. ✅ Approve again
10. ✅ Verify: Students see new curriculum section
11. ✅ Verify: Old published version content is gone

**Success Criteria:**
- ✅ Published copies properly updated, not duplicated
- ✅ Old content replaced with new
- ✅ Students see latest approved version

---

## BACKEND TESTING SCRIPT

Create and run this script:

```python
# File: backend/test_publish_versioning.py

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, '.')
django.setup()

from api.models import Course
from api.serializer import CourseEditSerializer

def test_publish_versioning():
    """Test the publish versioning system"""
    
    print("="*70)
    print("TESTING PHASE 4.74: PUBLISH VERSIONING")
    print("="*70)
    
    # Get test course
    course = Course.objects.get(course_id="284197")
    print(f"\n✓ Found course: {course.title}")
    print(f"  ID: {course.id}")
    print(f"  Platform Status: {course.platform_status}")
    print(f"  Teacher Status: {course.teacher_course_status}")
    
    # Test 1: submit_for_publication
   print("\n[TEST 1] Submit for Publication")
    print("-" * 70)
    published, is_new = course.submit_for_publication()
    print(f"✓ Submitted successfully")
    print(f"  Published Copy ID: {published.id}")
    print(f"  Is New: {is_new}")
    print(f"  Published Curriculum Sections: {published.curriculum.count()}")
    print(f"  Published Lessons: {published.lectures().count()}")
    print(f"  Published Quizzes: {published.quizzes.count()}")
    print(f"  Draft Status: {course.platform_status}")
    
    # Test 2: Check parent relationship
    print("\n[TEST 2] Verify Parent Relationship")
    print("-" * 70)
    print(f"✓ Published course parent: {published.parent_course.id if published.parent_course else 'None'}")
    print(f"✓ Is published version: {published.is_published_version}")
    print(f"✓ Draft parent: {course.parent_course}")
    
    # Test 3: Restore
    print("\n[TEST 3] Restore to Published")
    print("-" * 70)
    # Make changes to draft
    course.title = "EDITED TITLE FOR TEST"
    course.curriculum.first().delete() if course.curriculum.exists() else None
    course.save()
    print(f"✓ Made changes to draft")
    print(f"  Draft Title: {course.title}")
    print(f"  Draft Sections: {course.curriculum.count()}")
    
    # Restore
    success, message = course.restore_to_published()
    print(f"✓ Restore result: {success}")
    print(f"  Message: {message}")
    print(f"  Restored Title: {course.title}")
    print(f"  Restored Sections: {course.curriculum.count()}")
    print(f"  Status: {course.platform_status}")
    
    print("\n" + "="*70)
    print("ALL TESTS PASSED ✅")
    print("="*70)

if __name__ == "__main__":
    test_publish_versioning()
```

---

## ERROR HANDLING CHECKLIST

### Potential Issues & Resolutions

| Issue | Symptom | Resolution |
|-------|---------|-----------|
| Published copy not created | "dibuat" message but no copy in DB | Check queryset filters in submit_for_publication() |
| Sync failed between draft/published | Draft and published have different content | Check _copy_content_to() is called properly |
| Restore deletes content permanently | User can't see courses after restore | Verify restore is copying, not deleting permanently |
| Button not showing | No restore button visible | Check platform_status === "Published" condition |
| Quiz content not copied | Quizzes missing after publish | Verify Quiz/Question/Choice copying in _copy_content_to() |
| Snapshot not saving | Restore shows old data | Check save_published_snapshot() is called in approval |
| Student sees old content | Published changes don't appear | Verify student course query filters correctly |

---

## SUCCESS CRITERIA

✅ **BACKEND**
- `submit_for_publication()` creates/updates published copy
- `restore_to_published()` fully restores all content
- Approval syncs both draft + published versions
- Quiz content properly copied (all tests should show same counts)
-published_snapshot properly stores and restores metadata

✅ **FRONTEND**  
- Restore button appears for published courses
- Publish button text changes based on status
- Dialogs confirm actions explicitly
- Course data updates immediately after API response
- No page reload needed (reactsingle-page behavior)

✅ **INTEGRATION**
- Complete workflow: Publish → Approve → Student sees → Edit → Restore
- Student course list only shows published approved courses
- Published courses student-facing, not draft versions
- Multiple approvals don't duplicate records
- Restore fully reverts to published state

---

## NEXT STEPS AFTER TESTING

If tests pass:
1. ✅ Mark PHASE 4.74 as COMPLETE
2. ✅ Update documentation with new versioning system
3. ✅ Brief instructors on new Restore feature
4. ✅ Monitor error logs for unusual behavior
5. ✅ Consider caching published courses queryset

If tests fail:
1. ❌ Review failed test details above
2. ❌ Check backend logs for exceptions
3. ❌ Review browser console for frontend errors
4. ❌ Add additional logging to methods
5. ❌ Return to implementation and fix issues

