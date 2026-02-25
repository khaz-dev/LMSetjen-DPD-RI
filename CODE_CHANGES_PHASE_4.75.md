# Code Changes Summary - PHASE 4.75: Publish Versioning Fix

## Files Modified

1. **backend/api/models.py** - Fixed submit_for_publication() method
2. **backend/api/views.py** - Fixed CourseApprovalAPIView approval logic
3. **backend/api/serializer.py** - Added published_version field

---

## 1. backend/api/models.py (Lines 503-549)

### Change: Fixed `submit_for_publication()` Method

**Location:** `Course.submit_for_publication()` (PHASE 4.74 method, now corrected)

**OLD CODE (WRONG - Deleted content prematurely):**
```python
if published_copies.exists():
    # UPDATE EXISTING: Delete old content and replace with new
    published = published_copies.first()
    print(f"[Submit] Found existing published copy (ID: {published.id}), updating...")
    
    # Delete all old published content
    published.curriculum.all().delete()
    published.quizzes.all().delete()
    published.features.all().delete()
    published.requirements.all().delete()
    published.learning_outcomes.all().delete()
    print(f"[Submit] ✓ Deleted old published content")
    
    # Copy fresh content from draft 🔴 WRONG! BEFORE ADMIN APPROVAL
    self._copy_content_to(published)
    published.save()
    
    print(f"[Submit] ✓ Updated published copy with latest content")
    is_new = False
```

**NEW CODE (CORRECT - Preserves published version):**
```python
if published_copies.exists():
    # ALREADY PUBLISHED: Do NOT update! Admin will do that on approval
    published = published_copies.first()
    print(f"[Submit] ✓ Found existing published copy (ID: {published.id})")
    print(f"[Submit] ⚠️  IMPORTANT: Published version NOT updated. Admin will approve changes.")
    is_new = False
```

**WHY THIS MATTERS:**
- ❌ OLD: Copies draft content to published BEFORE admin reviews/approves
- ✅ NEW: Preserves published version as-is, forces admin to approve first
- Admin now reviews "draft changes" against "published original"
- Students don't see changes until admin explicitly approves them

**When Used:** When instructor clicks "Ajukan Publikasi Kursus"

---

## 2. backend/api/views.py (Lines 4147-4159)

### Change: Added Content Copy Step in Approval Logic

**Location:** `CourseApprovalAPIView.post()` - approval action handler

**NEW CODE ADDED (was missing):**
```python
if action == "approve":
    # ✨ PHASE 4.74 FIXED (PHASE 4.75): Enhanced approval with versioning
    print(f"[Admin Approval] Processing approval for course: {course.title}")
    
    # Step 1: Ensure published copy exists
    published = self._get_or_create_published_copy(course)
    print(f"[Admin Approval] Working with published copy ID: {published.id}")
    
    # ✨ PHASE 4.75 FIX: Update published version with latest draft content
    # This step was missing - now we copy draft changes to published before marking as approved
    print(f"[Admin Approval] Copying latest draft content to published version...")
    course._copy_content_to(published)  # 🟢 NEW LINE
    print(f"[Admin Approval] ✓ Draft content copied to published version")
    
    # Step 2: Approve the published version
    published.platform_status = "Published"
    published.teacher_course_status = "Published"
    published.approved_by = user
    published.approval_date = timezone.now()
    published.rejection_reason = None
    published.save()
    print(f"[Admin Approval] ✓ Set published copy to Published")
    
    # ... rest of approval logic
```

**LINES CHANGED:**
- Line 4147: Comment updated with "FIXED (PHASE 4.75)"
- **Lines 4154-4157:** 🟢 NEW - Copy draft content to published
- Line 4158: Print confirmation

**WHY THIS MATTERS:**
- When admin approves, we now COPY the draft changes to published
- This happens ONLY when admin clicks "Approve" (not before!)
- Ensures published version only updates with admin-approved changes
- Students see updated content immediately after approval

**When Used:** When admin clicks "Setujui" (Approve) on a course in Review status

---

## 3. backend/api/serializer.py (Lines 909, 930-975)

### Changes: Added `published_version` Field to CourseEditSerializer

**Location:** `CourseEditSerializer` class

**Line 909 - Added to class definition:**
```python
class CourseEditSerializer(serializers.ModelSerializer):
    """
    Simplified course serializer for editing operations to avoid circular references
    and improve performance
    
    ✨ PHASE 4.75: Publish versioning fix
    - Now includes published_version data so frontend can show "what's published to students"
    - When course.platform_status="Review", published_version contains the current published curriculum
    - This prevents draft changes from appearing as published before admin approval
    """
    # ... existing fields ...
    published_version = serializers.SerializerMethodField()  # 🟢 NEW FIELD
```

**Lines 912 - Updated Meta.fields:**
```python
class Meta:
    fields = [
        "id", "category", "teacher", "file", "image", "title", "description", 
        "level", "platform_status", "teacher_course_status", "featured", 
        "course_id", "slug", "date", "curriculum", "lectures", "quizzes", 
        "average_rating", "rating_count", "intro_video_source", "rejection_reason", 
        "approved_by", "approved_by_name", "approval_date", "review_submitted_date",
        "published_version"  # 🟢 NEW FIELD
    ]
    model = api_models.Course
```

**Lines 930-975 - NEW METHOD:**
```python
def get_published_version(self, obj):
    """
    ✨ PHASE 4.75: Return the published version of this course if it exists
    
    This is used by the frontend to show:
    1. For draft in Review status: what's CURRENTLY published to students
    2. For normal viewing: null (no published version)
    3. For admins reviewing: the current live version to compare with draft
    
    Returns: Full serialized published course data or None
    """
    # Check if this is a draft course with published copies
    if not obj.is_published_version:
        published_copies = obj.published_copies.filter(is_published_version=True).first()
        if published_copies:
            # Return full published version data including curriculum
            from . import serializer as ser
            from api.models import VariantItem
            
            # Get lectures using the model method
            published_lectures = VariantItem.objects.filter(variant__course=published_copies)
            
            return {
                'id': published_copies.id,
                'course_id': published_copies.course_id,
                'title': published_copies.title,
                'description': published_copies.description,
                'file': published_copies.file,
                'image': published_copies.image,
                'platform_status': published_copies.platform_status,
                'teacher_course_status': published_copies.teacher_course_status,
                'intro_video_source': published_copies.intro_video_source,
                'level': published_copies.level,
                'curriculum': ser.VariantSerializer(
                    published_copies.curriculum.all(), 
                    many=True, 
                    read_only=True
                ).data,
                'lectures': ser.VariantItemSerializer(
                    published_lectures,
                    many=True,
                    read_only=True
                ).data,
                # Include quiz count so frontend knows it exists
                'quizzes_count': published_copies.quizzes.count()
            }
    return None
```

**WHY THIS MATTERS:**
- Frontend can now display "what's published to students" as a separate section
- Admin can compare "Draft changes" against "Published version" side-by-side
- Includes full curriculum, lectures, and metadata
- Returns None for courses without a published copy
- Enables visual "Preview Pelajaran" showing published vs draft differences

**When Used:** When API endpoint `/api/v1/teacher/course-detail/{course_id}/` is called

---

## Testing the Changes

### Test 1: Verify Serializer Works
```bash
cd backend
python manage.py shell
```

```python
from api.models import Course
from api.serializer import CourseEditSerializer

draft = Course.objects.get(id=22)  # Draft course
serializer = CourseEditSerializer(draft)
data = serializer.data

# Should have published_version field
assert 'published_version' in data
print("✓ Serializer works")

# For course with published copy, should return data
if data['published_version']:
    assert data['published_version']['course_id'] == '278858'
    assert len(data['published_version']['curriculum']) > 0
    print("✓ Published version data included")
else:
    print("! No published version found")
```

### Test 2: Verify Workflow During Submission
```bash
cd backend
python manage.py shell
```

```python
from api.models import Course
from django.utils import timezone

# Get draft course
draft = Course.objects.get(id=22)

# Before submission
print("Before submit_for_publication():")
print(f"  Draft curriculum: {draft.curriculum.count()} sections")
published = draft.published_copies.filter(is_published_version=True).first()
if published:
    print(f"  Published curriculum: {published.curriculum.count()} sections")

# Make changes
for variant in draft.curriculum.all():
    variant.title = f"MODIFIED - {variant.title}"
    variant.save()

# Submit
published_copy, is_new = draft.submit_for_publication()

# After submission
print("\nAfter submit_for_publication():")
print(f"  Draft curriculum: {draft.curriculum.count()} sections")
published_fresh = draft.published_copies.filter(is_published_version=True).first()
if published_fresh:
    print(f"  Published curriculum: {published_fresh.curriculum.count()} sections")
    
# Verify they're different (published should not have "MODIFIED")
first_pub = published_fresh.curriculum.first()
if "MODIFIED" not in first_pub.title:
    print("\n✓ SUCCESS: Published version was NOT updated on submission")
else:
    print("\n❌ FAIL: Published version was incorrectly updated")
```

### Test 3: Verify Approval Updates Published
```python
from api.models import Course
from userauths.models import User

# Get draft course
draft = Course.objects.get(id=22)

# Get admin user
admin = User.objects.filter(is_superuser=True).first()

# Before approval
published_before = draft.published_copies.filter(is_published_version=True).first()
draft_lesson_file = draft.lectures.first().file
pub_lesson_file_before = published_before.lectures.first().file

print("Before approval:")
print(f"  Draft lesson: {draft_lesson_file[:50]}...")
print(f"  Published lesson: {pub_lesson_file_before[:50]}...")

# Call approval (simulating admin approval)
from api.views import CourseApprovalAPIView
from unittest.mock import Mock

view = CourseApprovalAPIView()
request = Mock()
request.user = admin
request.data = {'action': 'approve'}

view.post(request, course_id=draft.course_id)

# After approval
published_after = draft.published_copies.filter(is_published_version=True).first()
pub_lesson_file_after = published_after.lectures.first().file

print("\nAfter approval:")
print(f"  Draft lesson: {draft_lesson_file[:50]}...")
print(f"  Published lesson: {pub_lesson_file_after[:50]}...")

if draft_lesson_file == pub_lesson_file_after:
    print("\n✓ SUCCESS: Published version WAS updated on approval")
else:
    print("\n❌ FAIL: Published version was NOT updated on approval")
```

---

## Deployment Checklist

- [ ] Review all three file changes above
- [ ] Run migrations (none needed - model fields already exist)
- [ ] Test serializer with real data
- [ ] Test workflow: Edit → Submit → Review → Approve
- [ ] Verify students see old version during admin review
- [ ] Verify students see new version after admin approval
- [ ] Test with AdminCourseReviewDetail page

---

## Backwards Compatibility

✅ **FULLY COMPATIBLE** - No breaking changes:
- Model fields unchanged (already had versioning structure)
- New serializer field is optional (added to Meta.fields)
- Old code that doesn't use published_version still works
- API responses include new field without breaking existing clients

---

## Documentation References

- Full fix documentation: `PUBLISH_VERSIONING_CRITICAL_FIX_PHASE_4.75.md`
- Visual diagrams: `PUBLISH_VERSIONING_VISUAL_GUIDE_PHASE_4.75.md`
- Original architecture: `COURSE_VERSIONING_ARCHITECTURE_PHASE_4.60.md`

---

**Date:** February 22, 2026  
**Status:** ✅ Ready for Deployment  
**Phase:** 4.75 (Critical Fix)
