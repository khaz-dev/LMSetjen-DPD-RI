# 🔍 Deep Analysis: Instructor Course Edit Buttons & Workflow

## Current System Architecture (PHASE 4.36+)

### 1️⃣ **Frontend Button Structure** (`frontend/src/views/instructor/CourseEdit.jsx`)

#### Button 1: "Perbarui Kursus" (Line 978)
- **Location:** Main form submit button
- **Function:** Saves course basic info (title, description, category, level, image, videos, etc.)
- **Behavior:** 
  - Enabled when `isDirty = true` (user made changes)
  - Shows spinner while submitting
  - Calls `handleCourseSubmit()` → `submitCourse()` API
  - **Backend Endpoint:** `PUT /api/v1/teacher/course-edit/<course_id>/`
  - **Status Change:** If course was Published → automatically resets to Review (requires re-approval)
  
#### Button 2: "Ajukan untuk Review" / "Ajukan Ulang untuk Review" (Line 1078)
- **Location:** Below status alerts section
- **Function:** Submits course for admin approval
- **Behavior:**
  - Only shows when: `platform_status === "Draft" || platform_status === "Rejected"`
  - Validates curriculum exists (at least 1 chapter)
  - Calls `handlePublishCourse()` → `POST teacher/course-publish/<course_id>/`
  - **Backend Endpoint:** `POST /api/v1/teacher/course-publish/<course_id>/`
  - **Status Change:** Draft/Rejected → Review (waiting for admin approval)
  - **User Intent:** "Submit my course to admin for approval"

---

### 2️⃣ **Backend Status State Machine** (`backend/api/models.py` + `backend/api/views.py`)

```
Course Model Fields:
├── platform_status (admin-controlled)
│   ├── "Draft" → Initial state
│   ├── "Review" → Waiting for admin approval (instructor submitted for review)
│   ├── "Published" → Admin approved, visible to students
│   ├── "Rejected" → Admin rejected, instructor can edit and resubmit
│   └── "Disabled" → Admin disabled
│   
└── teacher_course_status (instructor-controlled)
    ├── "Draft" → Incomplete course
    ├── "Published" → Instructor wants to publish
    └── "Disabled" → Instructor disabled

Workflow:
1. Instructor creates course → platform_status="Draft", teacher_course_status="Draft"
2. Instructor adds curriculum/lessons/quizzes
3. Instructor clicks "Ajukan untuk Review" → platform_status="Review"
4. Admin reviews:
   - ✅ Approves → platform_status="Published" (visible to students)
   - ❌ Rejects → platform_status="Rejected" (shows rejection reason)
5. If instructor edits published course:
   - Changes made → platform_status resets to "Review" (auto-rejection)
   - Protects students from seeing half-edited courses
```

---

### 3️⃣ **The Problem: Button Labels vs Intent Mismatch**

**Current Labels:**
1. "Perbarui Kursus" (Update Course) → But it actually saves as DRAFT, not publishes
2. "Ajukan untuk Review" (Submit for Review) → User thinks it submits to admin, not clear it's for publication approval

**Why This Is Confusing:**
- Users might think "Perbarui Kursus" makes the course visible to students (it doesn't)
- "Ajukan untuk Review" doesn't clearly indicate it's submitting for PUBLICATION approval
- No button to restore/revert to a previously published version

**What User Wants:**
1. "Simpan Draf" (Save Draft) → Clear it's just saving, no publication happening
2. "Ajukan Publikasi Kursus" (Submit for Publication) → Clear intent: submit FOR publication
3. "Restore Kursus" button → Revert to last published version if changes were made

---

### 4️⃣ **Button Visibility Logic**

**"Perbarui Kursus" shown when:**
```javascript
// Always visible for editing
// Disabled when: isDirty=false OR submitStatus=submitting OR validationErrors > 0
```

**"Ajukan untuk Review" shown when:**
```javascript
// Only when: platform_status === "Draft" OR platform_status === "Rejected"
// Disabled when: canPublish=false (no curriculum/lessons)
```

**"Restore Kursus" should show when:**
```javascript
// Only when: platform_status === "Published" AND changes detected
// OR: parent_course exists (is a draft version of published course)
```

---

### 5️⃣ **Key Files Involved**

#### Frontend:
- **CourseEdit.jsx** (Main component)
  - Line 978: "Perbarui Kursus" button text
  - Line 1078: "Ajukan untuk Review" / "Ajukan Ulang untuk Review" button text
  - Line 1044-1061: Button styling & hover effects
  - Line 383-515: handlePublishCourse() function
  - Line 217-365: handleCourseSubmit() function

#### Backend:
- **api/views.py**
  - Line 3854-3940: CoursePublishAPIView (handles "Ajukan untuk Review")
  - Line ~2300+: CourseUpdateAPIView (handles "Perbarui Kursus" save)
  
- **api/models.py**
  - Line 154-250: Course model (status fields & versioning)
  - Line 260-330: create_published_copy() and create_draft_version() methods

#### Constants:
- **frontend/src/views/instructor/constants/courseConstants.js**
  - May have button text constants

---

### 6️⃣ **Versioning System (PHASE 4.60)**

The system uses a dual-copy versioning approach:
```
Original Course (Instructor's Working Draft)
├── is_published_version = False
├── parent_course = None (root course)
└── Can be edited freely

Published Copy (Student-Facing Version)
├── is_published_version = True
├── parent_course = Original Course ID
└── Read-only for students, controlled by admin approval

When instructor edits published course:
1. Creates a new draft version (copy of published)
2. Instructor edits the draft
3. Admin reviews and approves/rejects
4. If approved, the published copy is updated
5. Original draft remains as backup
```

---

## 🎯 **What Needs to Change**

### Change 1: "Perbarui Kursus" → "Simpan Draf"
- **File:** `frontend/src/views/instructor/CourseEdit.jsx`
- **Line:** 978
- **Impact:** Label change only, function remains same
- **Rationale:** Clearer that this action SAVES AS DRAFT, doesn't publish

### Change 2: "Ajukan untuk Review" → "Ajukan Publikasi Kursus"
- **File:** `frontend/src/views/instructor/CourseEdit.jsx`
- **Lines:** 1078, 1088
- **Impact:** Label change, clarifies this is for publication approval
- **Rationale:** User understands they're submitting for publication, not general review

### Change 3: Add "Restore Kursus" Button
- **File:** `frontend/src/views/instructor/CourseEdit.jsx`
- **Location:** Beside "Ajukan Publikasi Kursus" or in status alert
- **Function:** Revert to last published version if changes made
- **Logic:**
  - Show only when: platform_status === "Published" AND isDirty === true
  - OR: parent_course exists (is draft of published version)
  - Backend method needed to revert changes

### Backend Changes Needed:
1. **CourseRevertAPIView** - New endpoint to restore from published version
2. **Endpoint:** `POST /api/v1/teacher/course-revert/<course_id>/`
3. **Action:** 
   - Get parent course (published version)
   - Copy data back to draft version
   - Reset isDirty flag
   - Return success message

---

## 📝 **Complete Workflow After Changes**

```
Draft Course State:
1. Instructor clicks "Simpan Draf" → Saves basic info
2. Adds curriculum, lessons, quizzes
3. Clicks "Ajukan Publikasi Kursus" → Sends to admin for publication approval

Published Course State:
4. Students see published course
5. Instructor makes changes, clicks "Simpan Draf"
6. Now has unsaved changes AND published course exists
7. Option A: Click "Restore Kursus" → Revert to published version (undo changes)
8. Option B: Click "Ajukan Publikasi Kursus" → Send updated version for re-approval

Admin Approval:
9. Admin approves → Course published, students see new version
10. Admin rejects → Course rejected, instructor sees reason and can fix
```

---

This completes the deep analysis! The changes are purely UI/UX clarifications plus one new feature (Restore button).
