# Quick Reference: Changes Made (Phase 7.13 Final)

## Backend Changes

### File: `backend/api/serializer.py`

#### Change 1: CourseSerializer.get_qa_count() (~line 1085)

**BEFORE:**
```python
def get_qa_count(self, obj):
    """✨ PHASE 4.16: Count total questions for this course"""
    return api_models.Question_Answer.objects.filter(course=obj).count()
```

**AFTER:**
```python
def get_qa_count(self, obj):
    """✨ PHASE 4.16 + PHASE 7.13 FIX: Count total questions from published version if exists
    
    CRITICAL FIX: When returning draft courses, check if published version exists.
    If yes, count questions from published version (where they're actually stored).
    This ensures instructor Q&A shows correct question counts even for draft courses.
    
    Logic:
    1. If this is a draft course with published copies → count from published
    2. If this is a published course → count from this course
    3. If this is draft with no published yet → count from draft (0)
    """
    # Check if this course has published copies
    if not obj.is_published_version:
        published_copy = obj.published_copies.filter(is_published_version=True).first()
        if published_copy:
            # Count questions from the published version
            return api_models.Question_Answer.objects.filter(course=published_copy).count()
    
    # Either it's a published course, or draft with no published copies yet
    return api_models.Question_Answer.objects.filter(course=obj).count()
```

---

#### Change 2: CourseEditSerializer Field Declaration (~line 1223)

**BEFORE:**
```python
class CourseEditSerializer(serializers.ModelSerializer):
    # ... other fields ...
    published_version = serializers.SerializerMethodField()  # ✨ PHASE 4.75
    
    class Meta:
```

**AFTER:**
```python
class CourseEditSerializer(serializers.ModelSerializer):
    # ... other fields ...
    published_version = serializers.SerializerMethodField()  # ✨ PHASE 4.75
    qa_count = serializers.SerializerMethodField()  # ✨ PHASE 7.13: Add QA count
    
    class Meta:
```

---

#### Change 3: CourseEditSerializer Meta.fields (~line 1227)

**BEFORE:**
```python
class Meta:
    fields = ["id", "category", "teacher", ..., "published_version"]
    model = api_models.Course
```

**AFTER:**
```python
class Meta:
    # ✨ PHASE 7.13: Added "qa_count" to CourseEditSerializer
    fields = ["id", "category", "teacher", ..., "published_version", "qa_count"]
    model = api_models.Course
```

---

#### Change 4: CourseEditSerializer.get_qa_count() Method (NEW - after get_published_version)

**ADDED:**
```python
def get_qa_count(self, obj):
    """✨ PHASE 7.13: Count total questions from published version if exists
    
    Same logic as CourseSerializer but for course detail/editing pages.
    Ensures instructor sees correct question counts when editing draft courses.
    """
    # Check if this course has published copies
    if not obj.is_published_version:
        published_copy = obj.published_copies.filter(is_published_version=True).first()
        if published_copy:
            # Count questions from the published version
            return api_models.Question_Answer.objects.filter(course=published_copy).count()
    
    # Either it's a published course, or draft with no published copies yet
    return api_models.Question_Answer.objects.filter(course=obj).count()
```

---

## Frontend Changes

### File: `frontend/src/views/instructor/QA.jsx`

#### Change: handleCourseSelect() Function (~line 203)

**BEFORE:**
```javascript
// ✨ PHASE 7.11+: Handle course selection...
// ✨ PHASE 7.12: CRITICAL FIX...
// ✨ PHASE 7.13: Use published version's qa_count for correct badge display
const handleCourseSelect = async (course) => {
    try {
        const response = await useAxios.get(`teacher/course-detail/${course.course_id}/`);
        const enrichedCourse = response.data;
        
        if (enrichedCourse?.published_version?.course_id) {
            enrichedCourse.course_id = enrichedCourse.published_version.course_id;
            enrichedCourse.curriculum = enrichedCourse.published_version.curriculum;
            enrichedCourse.qa_count = enrichedCourse.published_version.qa_count;  // ← Manual override
            console.log(`[Course Select] Using published version...`);
        }
        
        setSelectedCourse(enrichedCourse);
        fetchCourseQuestions(enrichedCourse);
    } catch (error) {
        // fallback code
    }
};
```

**AFTER:**
```javascript
// ✨ PHASE 7.11+: Handle course selection...
// ✨ PHASE 7.12: CRITICAL FIX...
// ✨ PHASE 7.13 FINAL FIX: Backend returns correct qa_count, no manual override needed
const handleCourseSelect = async (course) => {
    try {
        // Fetch full course details - backend now returns correct qa_count
        const response = await useAxios.get(`teacher/course-detail/${course.course_id}/`);
        const enrichedCourse = response.data;
        
        if (enrichedCourse?.published_version?.course_id) {
            enrichedCourse.course_id = enrichedCourse.published_version.course_id;
            enrichedCourse.curriculum = enrichedCourse.published_version.curriculum;
            // ✨ Backend now returns correct qa_count - no manual override needed!
            console.log(`[Course Select] Using published version - course_id: ${enrichedCourse.published_version.course_id}, qa_count: ${enrichedCourse.qa_count}`);
            console.log(`[Course Select] Draft course_id was: ${course.course_id}, draft qa_count: ${course.qa_count}`);
        }
        
        setSelectedCourse(enrichedCourse);
        fetchCourseQuestions(enrichedCourse);
    } catch (error) {
        setSelectedCourse(course);
        fetchCourseQuestions(course);
    }
};
```

---

## What's Different

### Logic Changes
- ✅ Both serializers now check for published version and count from it
- ✅ Consistent logic across all endpoints
- ✅ Frontend no longer needs workarounds

### Response Structure

**From teacher/course-lists:**
```json
{
  "id": 46,
  "course_id": "271157",
  "qa_count": 2,  ← Calculated from published version
  ...
}
```

**From teacher/course-detail:**
```json
{
  "id": 46,
  "course_id": "271157",
  "qa_count": 2,  ← Calculated from published version (main level) ✨ NEW
  "published_version": {
    "course_id": "168460",
    "qa_count": 2,
    ...
  }
}
```

---

## Verification

### Test in Browser Console

```javascript
// After page loads, check console
console.log("Draft course qa_count:", window.courseData?.qa_count);
console.log("Published version:", window.courseData?.published_version?.qa_count);

// They should match!
// And both should match the actual question count displayed
```

### Network DevTools Check

```
Look for XHR requests:
1. GET /api/v1/teacher/course-lists/{id}/
   → Response: qa_count should be 2+ (published version count)

2. GET /api/v1/teacher/course-detail/{id}/
   → Response: qa_count at top level should be 2+ (published version count)
```

---

## Summary

| Component | Change | Impact |
|-----------|--------|--------|
| CourseSerializer.get_qa_count() | Smart logic added | Lists show correct count |
| CourseEditSerializer.qa_count | Field added | Detail endpoint can return it |
| CourseEditSerializer.get_qa_count() | Method added | Detail endpoint calculates correctly |
| Frontend handleCourseSelect() | Removed override | Cleaner, more reliable |

**Result: Both endpoints return correct qa_count consistently** ✅

