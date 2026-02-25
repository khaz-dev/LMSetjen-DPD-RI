# PHASE 4.60: Course Versioning Architecture - Dual-Copy System

## 🔴 CRITICAL ISSUE IDENTIFIED

**Problem**: When instructors edit a PUBLISHED course, students see changes immediately because both use the SAME Course record.

**Impact**:
- Students in progress lose curriculum items that instructor deleted
- Videos/lessons disappear mid-learning
- Features/requirements change without warning
- System integrity compromised

**Root Cause**:
```
Single Course Record
├─ Instructor edits → Platform_status = "Review"
├─ Same data for students
└─ Students affected immediately ❌
```

---

## ✅ SOLUTION: Dual-Copy System (PHASE 4.60)

Instead of editing the published course directly, use a **branching model**:

```
Instructor Creates Course
    ↓
Instructor Edits (Instructor Draft) ← instructors work on this
    ↓
Status: Draft/Review
    ↓
IF Admin Approves ⇒ Copy to Published Version (Students see this)
    ↓
Status: Published
```

### Implementation Strategy

#### 1. New Database Field
Add to Course model:
- `parent_course` (ForeignKey) - Points to instructor's draft if this is published version
- `is_published_version` (BooleanField) - Flag indicating this is the student-facing version

#### 2. Logic Flow

**Creating a Course**:
```
1. Instructor creates → Course created with is_published_version=False
2. Normal editing → No changes
```

**Submitting for Review (First Time)**:
```
1. Instructor clicks "Submit"
2. Backend creates a COPY of the course with is_published_version=True
3. Sets original: platform_status = "Review"
4. Sets copy: platform_status = "Published"
5. Links them: copy.parent_course = original
```

**Editing Published Course**:
```
1. Instructor edits already-published course
2. Backend detects: platform_status is "Published"
3. Creates a new "Review" copy from current published version
4. Instructor edits the new copy (parent_course points to it)
5. Sets status to "Review"
6. Students still see old published version
```

**Admin Approves Updates**:
```
1. Admin approves the new version (in Review)
2. Backend:
   a. Updates the old published version's data
   OR creates new published copy
   b. Links to instructor's draft (parent_course)
   c. Deletes old published version
3. Students seamlessly see new version
```

#### 3. Student Access

Students ALWAYS see:
```
Course.objects.filter(
    is_published_version=True,
    platform_status="Published"
)
```

Instructors ALWAYS see (for editing):
```
Course.objects.filter(
    parent_course=None,  # Their draft
    teacher=current_teacher
)
```

---

## Current State Analysis

### Problematic Code Locations

**[backend/api/views.py Line 695]** - Students see all courses
```python
queryset = api_models.Course.objects.filter(
    platform_status="Published", 
    teacher_course_status="Published"
)
```
❌ This mixes instructor drafts and published versions

**[backend/api/views.py Line 3551]** - Course update
```python
# Instructor edits course directly
# Changes affect students immediately
def update(self, request, *args, **kwargs):
    course = self.get_object()
    # Updates SAME record students are viewing
    serializer.update(course, validated_data)
```

**[backend/api/models.py]** - No versioning concept
- Variant, VariantItem all point to single Course
- No separation between draft and published

---

## ✨ RECOMMENDED IMPLEMENTATION (PHASE 4.60)

### Step 1: Database Migration
```python
class Migration(migrations.Migration):
    operations = [
        migrations.AddField(
            model_name='course',
            name='is_published_version',
            field=models.BooleanField(default=False)
        ),
        migrations.AddField(
            model_name='course',
            name='parent_course',
            field=models.ForeignKey(
                Course, 
                on_delete=models.CASCADE,
                null=True, 
                blank=True,
                related_name='published_copies'
            )
        ),
    ]
```

### Step 2: Course Update Logic (Simplified)
```python
def update_course(request, course_id):
    instructor_draft = Course.objects.get(
        course_id=course_id,
        parent_course=None,  # Original, not a published copy
        teacher=request.user.teacher
    )
    
    # Check if course is currently published
    if instructor_draft.platform_status == "Published":
        # Create a new draft version for editing
        new_draft = Course.objects.create(
            title=instructor_draft.title,
            description=instructor_draft.description,
            # ... copy all fields ...
            parent_course=instructor_draft,  # Link to original
            platform_status="Review",
            is_published_version=False
        )
        # Copy all related records (curriculum, features, etc.)
        _copy_course_content(instructor_draft, new_draft)
        
        # Now edit the new draft
        course_to_edit = new_draft
    else:
        # Editing a draft, no copy needed
        course_to_edit = instructor_draft
    
    # Apply changes
    course_to_edit.title = request.data.get('title')
    # ... other updates ...
    course_to_edit.save()
    
    return course_to_edit
```

### Step 3: Student View Filter
```python
# Students ONLY see published, approved versions
class StudentCourseListAPIView(generics.ListAPIView):
    queryset = Course.objects.filter(
        platform_status="Published",
        is_published_version=True  # ✨ NEW: Only published copies
    )
```

### Step 4: Instructor View Filter  
```python
# Instructors see their drafts for editing
class TeacherCourseListAPIView(generics.ListAPIView):
    def get_queryset(self):
        return Course.objects.filter(
            teacher=self.request.user.teacher,
            parent_course=None  # ✨ NEW: Only their originals, not copies
        )
```

---

## Benefits of Dual-Copy System

| Aspect | Before | After |
|--------|--------|-------|
| **Data Safety** | ❌ Students affected by edits | ✅ Students see stable version |
| **Learning Integrity** | ❌ Curriculum can vanish mid-course | ✅ Same curriculum throughout |
| **Progress Tracking** | ❌ Unreliable (content changes) | ✅ Reliable (stable version) |
| **Edit Approval** | ❌ Changes immediate | ✅ Only approved changes go live |
| **Rollback** | ❌ Not possible | ✅ Keep old published version |
| **Migration Complexity** | N/A | ⚠️ Medium (but worth it) |

---

## Migration Path (No Data Loss)

```python
# Existing courses get:
for course in Course.objects.all():
    if course.platform_status == "Published":
        # Split into instructor draft + published copy
        
        # Create published copy
        published_copy = course.create_copy(
            is_published_version=True,
            parent_course=course
        )
        
        # Set original as draft
        course.is_published_version = False
        course.save()
```

---

## Testing Strategy

**Test 1: Editing Published Course**
```
1. Instructor: Open published course
2. Instructor: Change title + add feature
3. Assert: Original course unchanged (students not affected)
4. Assert: New draft created with status=Review
5. Assert: Student still sees original title
6. Admin: Approve changes
7. Assert: Published version updated with new title
8. Assert: Student now sees new title
```

**Test 2: Data Integrity**
```
1. Student: Start course (100 lessons)
2. Instructor: Delete 20 lessons
3. Assert: Student still sees 100 lessons
4. Admin: Reject changes
5. Assert: Deleted lessons gone from draft
6. Student: Still sees 100 lessons ✅
```

---

## Files to Modify

1. `backend/api/models.py` - Add 2 fields to Course
2. `backend/api/migrations/` - New migration
3. `backend/api/views.py` - Update logic (CourseUpdateAPIView)
4. `backend/api/serializer.py` - Add filtering
5. `frontend/src/views/instructor/CourseEdit.jsx` - Handle new flow
6. Management command - One-time migration script

---

## Estimated Implementation

- **Complexity**: Medium
- **Time**: 2-3 days
- **Risk**: Low (non-breaking if done carefully)
- **Benefit**: High (data integrity guaranteed)

---

## Phase Sequence

- **PHASE 4.60A**: Database migration + model changes
- **PHASE 4.60B**: View/permission layer updates
- **PHASE 4.60C**: Frontend logic updates
- **PHASE 4.60D**: Data migration + testing
- **PHASE 4.60E**: Rollout + monitoring

