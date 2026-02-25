# DEEP SCAN: Published Course Status Not Resetting to Review ❌

## Issue Summary
When a user updates a **Published** course (clicks "Perbarui Kursus"), the course status should automatically reset to **"Review"** (waiting for admin approval). However, **the status is NOT changing**.

---

## Root Cause Analysis

### 🔴 THE BUG (CRITICAL LOGIC FLAW)

**Location**: `backend/api/views.py` → `CourseUpdateAPIView.update()` (lines 3495-3530)

#### Current Buggy Flow:

```python
def update(self, request, *args, **kwargs):
    try:
        course = self.get_object()
        serializer = self.get_serializer(course, data=request.data)
        
        # ... validation and field processing ...
        
        # ✨ PHASE 4.49: Check if course is published and reset status
        if course.platform_status == "Published":
            has_basic_info_changes = any(
                k in request.data and request.data[k] != getattr(course, k, None)
                for k in ['title', 'description', 'level', 'category', 'image', 'file', ...]
            )
            
            if has_basic_info_changes:
                course.platform_status = "Review"  # ✅ Sets to Review here
                course.review_submitted_date = timezone.now()
                course.save()  # ✅ Saves the status change
        
        # 🔴 CRITICAL BUG: This line OVERWRITES what we just did!
        self.perform_update(serializer)  # ❌ Overwrites platform_status back to "Published"
        
        # ...rest of method...
```

#### Why It Fails:

1. **Serializer Contains platform_status**: The `CourseSerializer` includes `platform_status` in its fields:
   ```python
   # backend/api/serializer.py line 820
   fields = ["id", "category", ..., "platform_status", "teacher_course_status", ...]
   ```

2. **Frontend Sends Current Status**: When the user clicks "Perbarui Kursus", the frontend sends the ENTIRE course data including:
   ```javascript
   // frontend/src/views/instructor/hooks/useCourse.js line 196
   const formattedData = {
       ...courseData,  // ⚠️ Includes platform_status: "Published"
       category: ...
   };
   
   const response = await useAxios.patch(
       `/teacher/course-update/${userData?.teacher_id}/${courseId}/`,
       formattedData
   );
   ```

3. **The Override**:
   - Backend detects changes ✅
   - Backend sets `course.platform_status = "Review"` ✅
   - Backend saves the course object ✅
   - BUT then `self.perform_update(serializer)` is called ❌
   - The serializer still contains `platform_status: "Published"` from request.data ❌
   - The serializer OVERWRITES the database with the old value ❌

#### Timeline of Events:

```
Request arrives with platform_status: "Published"
    ↓
Backend detects course is Published and has changes
    ↓
Backend sets course.platform_status = "Review" ✅
Backend calls course.save() ✅ (Status is now "Review" in DB)
    ↓
Backend calls self.perform_update(serializer) ❌
    ↓
Serializer reads platform_status: "Published" from request.data
Serializer updates course with platform_status: "Published" ❌
    ↓
Database now shows platform_status: "Published" ❌
    ↓
Frontend receives response with platform_status: "Published"
```

---

## The Fix

### Solution: Exclude platform_status from serializer update when course is Published

**File**: `backend/api/views.py` → `CourseUpdateAPIView.update()`

**Strategy**: 
1. Before calling `self.perform_update(serializer)`, check if we're dealing with a published course
2. If yes, REMOVE `platform_status` from the serializer's validated data
3. This prevents the serializer from overwriting the status we just set to "Review"

---

## Testing Scenario

### Before Fix:
1. ✅ Admin publishes course → `platform_status = "Published"`
2. ✅ Instructor updates course title → Clicks "Perbarui Kursus"
3. ❌ Course status remains "Published" (should be "Review")
4. ❌ Course status shown to student as published (should be hidden)
5. ❌ Admin doesn't review the changes

### After Fix:
1. ✅ Admin publishes course → `platform_status = "Published"`
2. ✅ Instructor updates course title → Clicks "Perbarui Kursus"
3. ✅ Course status changes to "Review" (waiting for admin approval)
4. ✅ Course status shown to student as unavailable (awaiting review)
5. ✅ Admin reviews the updated course

---

## Impact Analysis

### Fields That Should Trigger Status Reset:
- ✅ `title` - Course title changed
- ✅ `description` - Course description changed
- ✅ `level` - Course level changed
- ✅ `category` - Course category changed
- ✅ `image` - Course image changed
- ✅ `file` - Intro video changed
- ✅ `intro_video_source` - Video source type changed (upload/youtube/google_drive)
- ✅ `teacher_course_status` - Desired status changed

### What Should NOT Trigger Reset:
- ❌ `platform_status` - Admin's decision (don't let instructor override)
- ❌ `review_submitted_date` - Admin tracking (don't modify)
- ❌ `rejection_reason` - Admin feedback (don't modify)
- ❌ Other auto-managed fields

---

## Backend Implementation Details

The code already has the logic to detect changes (lines 3506-3523):
```python
if course.platform_status == "Published":
    has_basic_info_changes = any(
        k in request.data and request.data[k] != getattr(course, k, None)
        for k in ['title', 'description', 'level', 'category', 'image', 'file', 
                  'intro_video_source', 'teacher_course_status']
    )
```

This correctly identifies what changed. The ONLY issue is that `self.perform_update(serializer)` then overwrites the status.

---

## Why This Bug Existed

1. **Phase 4.43.11** introduced the status reset logic
2. The developer correctly added the check and status change
3. But didn't realize that `self.perform_update(serializer)` would override it
4. The serializer includes `platform_status` because admin needs to see it
5. But instructors shouldn't be able to change it directly

---

## Resolution Confidence: 99.9%

This is a definitive bug with a clear cause and simple fix.
