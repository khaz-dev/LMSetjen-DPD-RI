# Fix: Related Models Status Reset Detection (PHASE 4.56) ✅

## Problem Statement

When an instructor updated a published course by making changes to:
- **"Kursus ini termasuk"** (Course Features)
- **"Persyaratan"** (Course Requirements)  
- **"Hasil Pembelajaran"** (Learning Outcomes)

Then clicked **"Perbarui Kursus"** (Update Course), the **course status was NOT reset from Published to Review**.

Expected Behavior: ✅ Course should be reset to "Menunggu Persetujuan Admin" (Awaiting Admin Review) for re-verification.

Actual Behavior: ❌ Course remained "Dipublikasikan" (Published) and did not go to admin review queue.

---

## Root Cause Analysis 🔍

### The Issue

These three forms save data via **separate API endpoints**:
- Features: `POST/PATCH /api/v1/teacher/course-features/{courseId}/`
- Requirements: `POST/PATCH /api/v1/teacher/course-requirements/{courseId}/`
- Learning Outcomes: `POST/PATCH /api/v1/teacher/course-learning-outcomes/{courseId}/`

They are stored in **separate database models**:
```python
class CourseFeature(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='features')

class CourseRequirement(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='requirements')

class CourseLearningOutcome(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='learning_outcomes')
```

### Why Status Isn't Reset

When "Perbarui Kursus" is clicked, the backend `CourseUpdateAPIView.update()` method checks:

```python
has_basic_info_changes = any(
    k in request.data and request.data[k] != getattr(course, k, None)
    for k in ['title', 'description', 'level', 'category', 'image', 'file', 'intro_video_source']
)

if has_curriculum_changes or has_basic_info_changes:
    # Reset status to Review
    course.platform_status = "Review"
```

**Problem**: Features, requirements, and learning outcomes are NOT in the list of monitored fields, and they're NOT in `request.data` (they're saved via separate endpoints). Therefore:

1. ❌ Backend doesn't detect changes to these related models
2. ❌ Backend doesn't trigger status reset to Review
3. ❌ Course stays Published
4. ❌ Course doesn't appear in admin review queue

---

## Solution Implementation 🛠️

### Frontend Changes

**File**: `frontend/src/views/instructor/CourseEdit.jsx`

#### 1. Added State Tracking (Line 58)
```javascript
const [hasRelatedChanges, setHasRelatedChanges] = useState(false);
```

#### 2. Updated Form Callbacks (Lines 795-823)
Modified the callbacks for all three forms to track when they're updated:

```javascript
<CourseFeaturesForm 
    courseId={param?.course_id}
    onFeaturesUpdate={() => {
        setIsDirty(true);
        setHasRelatedChanges(true);  // ← NEW: Track update
    }}
/>

<CourseRequirementsForm 
    courseId={param?.course_id}
    onRequirementsUpdate={() => {
        setIsDirty(true);
        setHasRelatedChanges(true);  // ← NEW: Track update
    }}
/>

<CourseLearningOutcomesForm 
    courseId={param?.course_id}
    onOutcomesUpdate={() => {
        setIsDirty(true);
        setHasRelatedChanges(true);  // ← NEW: Track update
    }}
/>
```

#### 3. Updated Success Callback (Line 285)
```javascript
const statusChanged = data?.platform_status === "Review" && courseData?.platform_status === "Published";

if (statusChanged) {
    Toast().fire({
        icon: "info",
        title: "Status Diubah ke Menunggu Review",
        text: "Kursus Anda yang telah dipublikasikan telah kembali ke status 'Menunggu Review dari Admin'...",
    });
    setHasRelatedChanges(false);  // ← NEW: Reset flag
}
```

#### 4. Updated submitCourse Call (Line 356)
```javascript
await submitCourse(
    courseData, 
    param?.course_id,
    successCallback,
    errorCallback,
    hasRelatedChanges  // ← NEW: Pass flag to backend
);
```

### useCourse.js Hook Changes

**File**: `frontend/src/views/instructor/hooks/useCourse.js`

#### 1. Updated Function Signature (Line 177)
```javascript
const submitCourse = async (
    courseData, 
    courseId, 
    onSuccess, 
    onError, 
    hasRelatedChanges = false  // ← NEW: Add parameter
) => {
```

#### 2. Added Flag to Request (Line 219-222)
```javascript
// ✨ PHASE 4.56: Pass flag to backend
if (hasRelatedChanges) {
    formattedData.has_related_changes = true;
}
```

### Backend Changes

**File**: `backend/api/views.py` in `CourseUpdateAPIView.update()` method

#### 1. Added Flag Detection (Lines 3578-3581)
```python
# ✨ PHASE 4.56: Check if frontend flagged that features/requirements/learning_outcomes were updated
has_related_changes_flag = request.data.get('has_related_changes', False)

if has_curriculum_changes or has_basic_info_changes or has_related_changes_flag:
    print(f"[Course Update] Curriculum changes: {has_curriculum_changes}, ...")
    print(f"[Course Update] Related changes: {has_related_changes_flag}")
    course.platform_status = "Review"
    status_was_reset = True
```

#### 2. Added Flag Cleanup (Lines 3594-3603)
```python
# ✨ PHASE 4.56: Remove has_related_changes flag from request data
# This is not a valid Course model field
if 'has_related_changes' in request.data:
    if isinstance(request.data, dict):
        request.data = dict(request.data)
        del request.data['has_related_changes']
```

---

## How It Works (Step-by-Step) 🎬

### User Journey

```
1. Instructor opens published course
2. Navigates to Features/Requirements/Learning Outcomes section
3. Adds/edits/deletes items in ANY of these forms
   ↓
   → Frontend receives onFeaturesUpdate() / onRequirementsUpdate() / onOutcomesUpdate()
   → setHasRelatedChanges(true) is called
   → Form is marked isDirty = true
   
4. Instructor clicks "Perbarui Kursus"
   ↓
   → CourseEdit.jsx calls submitCourse(..., hasRelatedChanges)
   
5. useCourse.js hook adds flag to request:
   {
     "title": "...",
     "category": "...",
     "has_related_changes": true  ← Flag included
   }
   
6. Backend receives request in CourseUpdateAPIView.update()
   ↓
   → Detects has_related_changes_flag = true
   → Checks if course.platform_status == "Published"
   → Sets course.platform_status = "Review"
   → Removes flag before serializer processes data
   
7. Response returns with new status:
   {
     "platform_status": "Review",
     "review_submitted_date": "2026-02-20T...",
     ...
   }
   
8. Frontend detects statusChanged = true
   ↓
   → Shows interactive toast: "Status Diubah ke Menunggu Review"
   → Resets hasRelatedChanges = false
   
9. Admin sees course in review queue ✅
```

---

## Testing Checklist ☑️

### Test Case 1: Update Features Only
- [ ] Log in as instructor
- [ ] Open published course at `/instructor/edit-course/168075/`
- [ ] Go to "Kursus ini termasuk" section
- [ ] Add a new feature (e.g., "Video lessons")
- [ ] Verify form shows success toast
- [ ] Click "Perbarui Kursus" button
- **Expected**: Status changes to "Menunggu Persetujuan Admin" (Review)
- **Expected**: Course moves to admin review queue

### Test Case 2: Update Requirements Only
- [ ] Open published course
- [ ] Go to "Persyaratan" section
- [ ] Add/edit/delete a requirement
- [ ] Click "Perbarui Kursus"
- **Expected**: Status resets to Review ✅

### Test Case 3: Update Learning Outcomes Only
- [ ] Open published course
- [ ] Go to "Hasil Pembelajaran" section
- [ ] Add/edit a learning outcome
- [ ] Click "Perbarui Kursus"
- **Expected**: Status resets to Review ✅

### Test Case 4: Multiple Form Updates
- [ ] Open published course
- [ ] Update features + requirements + learning outcomes
- [ ] Click "Perbarui Kursus"
- **Expected**: Status resets to Review (one reset, not multiple) ✅

### Test Case 5: Mixed Updates (Basic Info + Related Models)
- [ ] Open published course
- [ ] Change title (basic info)
- [ ] Add a feature (related model)
- [ ] Click "Perbarui Kursus"
- **Expected**: Status resets to Review ✅
- **Expected**: Toast shows correct message

### Test Case 6: Update Draft Course (Should NOT Change)
- [ ] Create new course (status = Draft)
- [ ] Update features
- [ ] Click "Perbarui Kursus"
- **Expected**: Status stays Draft (no unwanted status changes) ✅

### Test Case 7: Update Rejected Course (Should NOT Change)
- [ ] Create course, submit for review, admin rejects it
- [ ] Update features
- [ ] Click "Perbarui Kursus"
- **Expected**: Status stays Rejected (only "Ajukan Ulang" changes it) ✅

### Database Verification
```sql
-- After updating a published course's features/requirements/outcomes:
SELECT 
    course_id, 
    title,
    platform_status,       -- Should be "Review" ✅
    review_submitted_date  -- Should be current timestamp ✅
FROM api_course 
WHERE course_id = 168075;
```

### Backend Log Verification
Watch Django console for:
```
[Course Update] Course 'Course Name' is being updated while Published...
[Course Update] Curriculum changes: False, Basic info changes: False, Related changes: True
[Course Update] Re-applying status reset after serializer update...
[Course Update] Status confirmed as 'Review' for course 'Course Name'
```

---

## Admin Review Queue Verification ✅

After instructor updates published course features/requirements/outcomes:

1. **Admin View**: Navigate to `/admin/review-courses/`
2. **Expected**: Updated course appears in pending review list
3. **Course Card Shows**:
   - Course title
   - Instructor name
   - Submission date (updated to current time)
   - "Setujui" and "Tolak" buttons

---

## FAQ

### Q: Will this affect curriculum/quiz updates?
**A**: No. Those already had detection. This only adds support for features/requirements/learning_outcomes.

### Q: What if only the main form fields change, not the related models?
**A**: Works as before - will reset based on basic_info_changes detection.

### Q: Does this work for Draft courses?
**A**: No. Draft courses stay Draft (status reset only applies to Published courses).

### Q: What about the feedback loop?
**A**: When the toast message shows, the course is already in Review status and in admin queue. Perfect!

---

## Performance Impact

- **Frontend**: Minimal - one extra boolean state variable
- **Backend**: Minimal - one extra boolean check in already-existing logic
- **Database**: No change - no new fields added to Course model

---

## Deployment Notes

1. Deploy backend changes first
2. Then deploy frontend changes
3. No database migrations needed
4. No configuration changes needed
5. Works with existing code automatically

---

## Related Issues Fixed

This fix addresses:
- ✅ Features not triggering status reset
- ✅ Requirements not triggering status reset  
- ✅ Learning outcomes not triggering status reset
- ✅ Published course staying visible to students after related model updates
- ✅ Course not appearing in admin review queue after related model updates

---

## Version History

| Phase | Change | Date |
|-------|--------|------|
| 4.36 | Initial course approval workflow | Feb 17, 2026 |
| 4.43.11 | Added status reset for published course updates | Feb 18, 2026 |
| 4.56 | Added detection for related model changes | Feb 20, 2026 |

---

**Status**: ✅ Ready for Testing & Deployment  
**Last Updated**: February 20, 2026  
**Impact**: HIGH - Fixes critical approval workflow for content updates

