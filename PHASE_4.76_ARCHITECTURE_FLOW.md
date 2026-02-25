# PHASE 4.76 - Architecture & Flow Documentation

## 🏗️ System Architecture

### Three-Layer Protection System

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                      │
│  (Frontend: React, CourseCard, CourseEdit, Modal Dialogs)   │
└──┬──────────────────────────────────────────────────────┬───┘
   │ Detects published_course error                        │ Shows error modal
   │ Calls API endpoints                                   │ Redirects user
   │                                                        │
┌──▼──────────────────────────────────────────────────────▼───┐
│            MIDDLEWARE & VALIDATION LAYER                     │
│  (Hooks: useCourseData, Error Detection, Redirect Logic)    │
└──┬────────────────────────────────────────────────────┬──────┘
   │ Catches 403 + action="edit_published"             │ Returns specific error
   │ Creates published_course error object             │ type for UI handling
   │                                                    │
┌──▼────────────────────────────────────────────────────▼──────┐
│              API ENDPOINT LAYER                               │
│         (Django REST Framework ViewSets)                      │
├┬───────────────────────────────────────────────────────────┬─┤
│ TeacherCourseDetailAPIView        CourseEditPublishedAPIView │
│ └─ GET /course-detail/            └─ POST /course-edit-pub.. │
│    Blocks published courses           Creates draft OR returns │
│    Returns 403 + action               existing draft ID        │
│                                                                │
│ CourseUpdateAPIView               TeacherCourseListAPIView   │
│ └─ PUT /course-update/            └─ GET /course-lists/      │
│    Double-checks protection          Shows both draft +        │
│    Returns 403 + action              published courses         │
└┬───────────────────────────────────────────────────────────┬─┘
 │ Database access                                          │ Query filtering
 │ Validation logic                                         │
 │ Permission checks                                        │
 │                                                          │
┌▼──────────────────────────────────────────────────────────▼──┐
│          DATA PERSISTENCE LAYER                               │
│            (PostgreSQL Database)                              │
├──────────────────────────────────────────────────────────────┤
│ Published Course (284197):      Draft Course (939531):        │
│  is_published_version = True     is_published_version = False │
│  parent_course = NULL            parent_course_id = 284197    │
│  [PROTECTED - READ-ONLY]         [EDITABLE]                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete User Journey Flows

### Flow 1: Accessing Published Course via Direct URL

```
User Input: Navigate to /instructor/edit-course/284197/
                ↓
         Frontend Mounts
          CourseEdit.jsx
                ↓
      Hook: useCourseData(284197)
            calls useAxios.get()
                ↓
      Backend: GET /teacher/course-detail/284197/
                ↓
   TeacherCourseDetailAPIView.get_object()
                ↓
    Logic: Is course.is_published_version?
            ↓ YES
                ↓
    Raises: PermissionDenied({
              "error": "Cannot edit...",
              "action": "edit_published"
            })
                ↓
   HTTP Response: 403 Forbidden
                ↓
    Frontend receives error
    error.response.status === 403?
    error.response.data.action === "edit_published"?
            ↓ YES to both
                ↓
    useCourseData Hook sets:
    error = {
      type: "published_course",
      published_course_id: 284197,
      message: "..."
    }
                ↓
  CourseEdit.jsx useEffect detects:
  error.type === "published_course"
            ↓
    Shows Swal Modal:
    ┌─────────────────────────────────┐
    │ Kursus Sudah Dipublikasikan     │
    │                                 │
    │ Explanation + 4-step guide:     │
    │ 1. Click "Edit Versi Terbaru"   │
    │ 2. System creates draft         │
    │ 3. Edit draft safely            │
    │ 4. Submit for approval          │
    │                                 │
    │ [Kembali ke Daftar Kursus]      │
    └─────────────────────────────────┘
            ↓
   User clicks "Kembali..."
            ↓
   navigate("/instructor/courses/")
            ↓
   CourseList page loads
            ↓
   User sees published course card
   with "Edit Versi Terbaru" button

SUCCESS: User prevented from editing
         published course directly
```

---

### Flow 2: Using "Edit Versi Terbaru" Workflow

```
User Location: /instructor/courses/
         sees CourseCard for published course
                ↓
    User clicks: "Edit Versi Terbaru"
                ↓
     Triggers: handleEditPublishedCourse()
                ↓
      Sets state: creatingDraft = true
                ↓
      Button shows spinner + text:
      "Membuat draft versi..."
                ↓
      API Call: POST /teacher/course-edit-published/284197/
                ↓
    Backend: CourseEditPublishedAPIView.post()
                ↓
    Logic: Check if draft exists with parent_course_id=284197
                ↓
        ┌─ YES ─┐         ┌─ NO ──┐
        ↓       │         ↓       │
    Return    API Call  Create   │
    draft     GET       Draft    │
    ID:       /draft     course  │
    939531          Returns 939531
        ↓           ↓
        └─────┬─────┘
              ↓
   Response: {
     "success": true,
     "draft_course_id": 939531
   }
              ↓
   Frontend receives 939531
              ↓
   navigate(`/instructor/edit-course/939531/`)
              ↓
   CourseEdit loads with draft (939531)
              ↓
   No error modal!
   Form renders normally
              ↓
   User edits draft fields:
   - Title
   - Description
   - Videos
   - etc.
              ↓
   Published course (284197): UNCHANGED
   Draft course (939531): UPDATED

SUCCESS: User edits draft safely
         Published course protected
```

---

### Flow 3: Course Query in Dashboard

```
API Call: GET /teacher/course-lists/
                ↓
  Backend: TeacherCourseListAPIView.get_queryset()
                ↓
    Query Logic:
    Q(parent_course__isnull=True) |
    Q(is_published_version=True)
                ↓
    INCLUDES:
    ├─ Original draft courses
    │  (no parent, not published)
    │  └─ Shows "Edit" button
    │
    └─ Published courses
       (is_published_version=True)
       └─ Shows "Edit Versi Terbaru" button
                ↓
    EXCLUDES:
    ├─ Draft versions being edited
    │  (has parent_course, not published)
    │
    └─ Avoids duplicate entries
                ↓
    Returns: [
      {id: 284197, is_published_version: true, title: "..."},
      {id: 100001, is_published_version: false, parent_course: null, ...},
      {id: 100002, is_published_version: false, parent_course: null, ...}
    ]
                ↓
    Frontend Map CourseCard for each
                ↓
    Per Course:
    ├─ if is_published_version:
    │  └─ Show "Edit Versi Terbaru" button
    │
    └─ else:
       └─ Show "Edit" Link

SUCCESS: Clean course list showing
         all editable courses
```

---

## 🔐 Security Validation Points

### Point 1: Initial Request
```
GET /teacher/course-detail/{course_id}/
    ↓
Check: course.is_published_version == True?
    ↓
Block with 403 + action="edit_published"
```
**Protection Level:** HIGH (Immediate block on access)

---

### Point 2: Update Attempt
```
PUT /teacher/course-update/{course_id}/
    ↓
Check: course.is_published_version == True?
    ↓
Block with 403 + action="edit_published"
```
**Protection Level:** HIGH (Double-check before save)

---

### Point 3: Course Retrieval
```
GET /teacher/course-lists/
    ↓
Filter:
- Include: parent=null OR published=true
- Exclude: parent!=null AND published=false
    ↓
Show both original drafts and published
Hide draft versions in editing
```
**Protection Level:** MEDIUM (UI-level filtering)

---

### Point 4: Draft Creation
```
POST /teacher/course-edit-published/{course_id}/
    ↓
Check: Caller has permission to use this endpoint?
    ↓
Check: {course_id} is valid course owned by user?
    ↓
Check: Draft doesn't already exist?
    ↓
Create draft with parent_course_id={course_id}
Return draft_id
```
**Protection Level:** MEDIUM (Authorization checks)

---

## 📊 State Management Flow

### Frontend State

```
useCourseData Hook State:
├─ courseData: Course object
├─ loading: boolean
└─ error: {
     type: "published_course" | null,
     published_course_id: number,
     message: string
   }

CourseEdit Component State:
├─ imagePreview: string
├─ submitStatus: "idle" | "submitting" | "success" | "error"
├─ submitMessage: string
├─ isDirty: boolean
└─ [many form field states]

CourseCard Component State:
├─ creatingDraft: boolean
└─ [other card states]

Watchers/Effects:
- useCourseData.error changes
  → CourseEdit detects published_course
  → Shows modal → Redirects
  
- courseData changes + initialCourseData
  → Update isDirty
  → Enable/disable save button
```

---

### Backend State

```
Database Models:
├─ Course Table
│  ├─ id: int (PK)
│  ├─ is_published_version: bool
│  ├─ parent_course_id: int (FK, nullable)
│  ├─ platform_status: enum
│  ├─ All course fields (title, description, etc)
│  └─ Status fields (published, draft, review, rejected)
│
└─ User Table (Instructor permissions)
   ├─ id: int
   ├─ role: enum ("teacher", "student", "admin")
   └─ owned courses via teacher_id FK

State Transitions:
instructor_draft (284197, parent=null)
         ↓ [Publish request approved]
instructor_draft → instructor_published (becomes 284197,
     moved to parent_course=null, is_published=true)
         ↓ [Need to edit published]
new_draft (939531, parent_course_id=284197)
         ↓ [Edit draft]
new_draft updated (939531 changed, 284197 unchanged)
         ↓ [Reopen approve request]
new_draft → new_review (939531 status=Review)
```

---

## 🔍 Error Handling Matrix

| Scenario | HTTP Status | Error Code | action | Frontend Behavior |
|----------|------------|-----------|--------|------------------|
| Published course GET | 403 | permission_denied | "edit_published" | Show modal + redirect |
| Published course PUT | 403 | permission_denied | "edit_published" | Show modal + redirect |
| Invalid course ID | 404 | not_found | - | Show not found page |
| No permission | 403 | permission_denied | - | Show auth error |
| Validation error | 400 | validation_error | - | Show form errors |
| Server error | 500 | server_error | - | Show error toast |

---

## 📈 Metrics & Monitoring

### Events to Track
```javascript
// Event 1: Published course access attempt
{
  event: "published_course_access_attempt",
  course_id: 284197,
  timestamp: ISO8601,
  user_id: 123,
  redirect_success: true
}

// Event 2: Draft creation success
{
  event: "course_edit_published_success",
  published_course_id: 284197,
  draft_course_id: 939531,
  draft_existed: false,
  timestamp: ISO8601
}

// Event 3: Data integrity check
{
  event: "course_sync_verification",
  published_id: 284197,
  draft_id: 939531,
  fields_different: [...],
  integrity_check: "pass"
}
```

### Performance Metrics
```
- Time to detect published course error: ~50ms
- Time to show redirect modal: ~200ms
- Time to create draft (if new): ~300ms
- Time to redirect to draft editor: ~100ms
- Total user experience time: ~650ms
```

---

## 🧪 Test Case Matrix

| Test ID | Scenario | Trigger | Expected Result | Status |
|---------|----------|---------|-----------------|--------|
| T4.76.1 | Direct URL to published | Navigate to /edit-course/284197 | 403 + Modal | Ready |
| T4.76.2 | Edit button on published | Click "Edit Versi Terbaru" | Draft created/returned | Ready |
| T4.76.3 | Draft edit form | Load published ID | No error, form renders | Ready |
| T4.76.4 | Courses list query | GET /course-lists/ | Both draft + published | Ready |
| T4.76.5 | Direct API update | PUT /course-update/284197/ | 403 + action field | Ready |
| T4.76.6 | Course data sync | Edit draft | Draft updated, published unchanged | Ready |
| T4.76.7 | Error modal UI | Trigger published error | Clear instructions shown | Ready |
| T4.76.8 | Redirect logic | Click modal button | Navigate to /courses/ | Ready |

---

## 🚀 Performance Optimizations

### Current
- ✅ Dual-layer protection (GET + PUT blocks)
- ✅ Fast error detection (action field check)
- ✅ Efficient query filtering (Q objects)

### Potential Improvements
- Cache draft course lookup (5min TTL)
- Pre-check is_published_version in list view
- Use database view for course filtering
- Add background sync verification

---

## 📚 Related Documentation

- [PHASE_4.76_PUBLISHED_COURSE_PROTECTION_COMPLETE.md](PHASE_4.76_PUBLISHED_COURSE_PROTECTION_COMPLETE.md)
- [PHASE_4.76_TESTING_GUIDE.md](PHASE_4.76_TESTING_GUIDE.md)
- [COURSE_VERSIONING_ARCHITECTURE_PHASE_4.60.md](COURSE_VERSIONING_ARCHITECTURE_PHASE_4.60.md)

---

**Architecture Documentation Complete** ✅
