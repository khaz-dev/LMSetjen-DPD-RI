# Publish Versioning Architecture - Deep Analysis & Implementation Guide

**Analysis Date**: February 22, 2026  
**Scope**: Course publishing, admin approval, and restore functionality  
**Request**: Implement comprehensive publish versioning with snapshot-based restore

---

## 1. Current Architecture Overview

### Current Status
The system has **PARTIAL implementation** of a versioning system across two phases:
- **PHASE 4.60**: Dual-copy versioning (parent_course + is_published_version)
- **PHASE 4.72**: Snapshot-based restore (published_snapshot JSONField)

### Problem with Current Implementation
The current code has **TWO CONFLICTING APPROACHES**:

1. **Dual-Copy System (PHASE 4.60)**:
   - Course has `parent_course` ForeignKey pointing to original
   - `is_published_version` boolean flag
   - `create_published_copy()` method creates full course copies
   - Problem: Creates separate Course records (confusing for instructors seeing multiple courses)

2. **Snapshot System (PHASE 4.72)**:
   - Course has `published_snapshot` JSONField
   - `save_published_snapshot()` saves JSON of course metadata only
   - `restore_from_published_snapshot()` restores from JSON
   - Problem: Only stores course attributes, NOT related content (curriculum, quizzes, etc.)

### Current Data Model (Course)

```python
class Course:
    # Status fields (TWO independent status fields)
    platform_status = "Draft"|"Review"|"Rejected"|"Published"  # Admin's approval status
    teacher_course_status = "Draft"|"Published"  # Instructor's intent
    
    # Versioning fields (PHASE 4.60)
    is_published_version: Boolean  # Is this a published copy?
    parent_course: ForeignKey  # Points to draft if published copy
    
    # Snapshot field (PHASE 4.72)  
    published_snapshot: JSONField  # Metadata only: {title, description, level, image, etc}
    
    # Approval tracking
    platform_status, rejection_reason, approved_by, approval_date, review_submitted_date
```

### Related Models That Need Versioning

```
Course:
├── Variant (curriculum sections) - related_name: "curriculum"
│   └── VariantItem (lessons) - related_name: "variant_items"
├── CourseFeature - related_name: "features"
├── CourseRequirement - related_name: "requirements"
├── CourseLearningOutcome - related_name: "learning_outcomes"
├── Quiz - related_name: "quizzes"
│   ├── QuizQuestion - related_name: "questions"
│   └── QuizChoice (via question) - related_name: "choices"
```

---

## 2. What User Wants (Your Request Analysis)

You want this workflow:

```
Instructor Actions:
1. Edits course → All in DRAFT records
2. Clicks "Ajukan Publikasi Kursus"
   ↓
   If NEVER published before:
     → Create PUBLISHED versions of all records
   If ALREADY published:
     → Update existing PUBLISHED records with new draft content
   ↓
   Sets: platform_status = "Review" (waiting for admin)

Admin Actions:
3. Reviews in /instructor/review-course/{course_id}/
4. Clicks "Setujui" (Approve)
   ↓
   → Activates PUBLISHED versions (or marks them as live)
   → Sets: platform_status = "Published"
   → Students can now see the published version

Student View:
   → Only sees PUBLISHED versions of courses

Instructor Recovery:
5. If makes mistakes while editing PUBLISHED course:
   → Clicks "Restore Kursus (Restore Course)"
   ↓
   → Copies all PUBLISHED records back to DRAFT records
   → Undoes all unsaved changes
```

---

## 3. Two Architecture Approaches

### APPROACH A: Dual-Copy System (Like PHASE 4.60)

**Concept**: Maintain TWO separate Course records + child records

```
Draft Course (ID: 1)          Published Course (ID: 2)
├── Variant                   ├── Variant (copy)
│   └── VariantItem          │   └── VariantItem (copy)
├── CourseFeature            ├── CourseFeature (copy)
├── CourseRequirement        ├── CourseRequirement (copy)
├── CourseLearningOutcome    ├── CourseLearningOutcome (copy)
└── Quiz                     └── Quiz (copy)
    ├── QuizQuestion             ├── QuizQuestion (copy)
    └── QuizChoice               └── QuizChoice (copy)

Link: Draft.id <-> Published.parent_course
```

**Pros**:
- ✅ Complete separation of draft/published (safer)
- ✅ Easy rollback (just copy from published to draft)
- ✅ Students see completely separate course
- ✅ No need for JSONField snapshots

**Cons**:
- ❌ Confusing for instructors (see 2 courses in their list)
- ❌ Database duplication (2x storage)
- ❌ Sync complexity (content must be kept in sync)
- ❌ Admin review shows "duplicate" looking UI

---

### APPROACH B: Single-Record + Publishing Flag System

**Concept**: ONE Course record with `publication_state` field + Archive content when publishing

```
Course (ID: 1)
├── platform_status = "Review"
├── publication_state = "Draft" | "Published"
├── Variant (DRAFT version)
│   └── VariantItem (DRAFT)
├── Variant__Published (version_of = Variant1)  [Auto-created when published]
│   └── VariantItem__Published (version_of = VariantItem1)
└── ... (similar for all related models)

When published:
- Archive/Lock all draft records
- Create Published versions
- Keep references via version_of ForeignKey
- When restoring: Copy Published back to Draft
```

**Pros**:
- ✅ Single course visible to instructor
- ✅ Clear version tracking
- ✅ No UI confusion
- ✅ Archive trail for compliance

**Cons**:
- ❌ More complex data model (need version tables)
- ❌ Requires new models for versioned content
- ❌ More database migrations

---

### APPROACH C: JSONField Snapshot (Current PHASE 4.72)

**Concept**: Store JSON snapshots of all content, restore from JSON

```
Course (ID: 1)
├── platform_status = "Review"
├── published_snapshot = {
│     "title": "...",
│     "curriculum": [
│       {"id": 1, "title": "Section 1", "items": [...]}
│     ],
│     "features": [...],
│     "quizzes": [
│       {"id": 1, "title": "Quiz 1", "questions": [...]}
│     ]
│   }
├── Variant (DRAFT)
└── Quiz (DRAFT)

Restore Flow:
- Delete all DRAFT content
- Create new Variant/Quiz/etc from JSON snapshot
```

**Pros**:
- ✅ Simple (single JSONField)
- ✅ No new database tables
- ✅ Good for small content
- ✅ PostgreSQL JSON search capable

**Cons**:
- ❌ Difficult to diff changes
- ❌ Students might see inconsistency during restore
- ❌ JSON versioning issues (nested data)
- ❌ Hard to implement progressive restore

---

## 4. RECOMMENDED APPROACH: Hybrid Dual-Copy with Smart UI

**Recommendation**: Use Approach A (Dual-Copy) BUT with modifications to UX:

### Hidden Published Copies

1. **Draft Course** (Visible in instructor's course list)
   - What instructor edits
   - ID: Always visible to instructor
   - UI shows: "Draft", "Under Review", "Rejected", etc.

2. **Published Course** (Hidden from instructor)
   - Students see this
   - Parent Course Reference: Hidden, no UI exposure
   - Same `teacher` so instructor can restore

### Restore Mechanism

Instead of copying Published → Draft, use **content deletion + re-copy**:

```python
def restore_course_to_published():
    # Get the PUBLISHED version
    published_course = self.published_copies.filter(
        is_published_version=True
    ).first()
    
    if published_course:
        # Delete all draft content
        self.curriculum.all().delete()
        self.quizzes.all().delete()
        self.features.all().delete()
        self.requirements.all().delete()
        self.learning_outcomes.all().delete()
        
        # Re-copy from published
        published_course._copy_content_to(self)
        
        # Revert metadata
        self.title = published_course.title
        self.description = published_course.description
        # ... other fields
        self.platform_status = "Published"
        self.save()
```

---

## 5. Implementation Steps (Recommended: Approach A + Hybrid UI)

### Step 1: Enhance Course Model (Add Publishing Methods)

Add to `Course` model:

```python
def submit_for_publication(self):
    """
    When instructor clicks "Ajukan Publikasi"
    - If never published: Create new published copy
    - If already published: Update existing published copy
    """
    # Check if published version exists
    published_copies = self.published_copies.filter(
        is_published_version=True
    )
    
    if published_copies.exists():
        # Update existing published copy
        published = published_copies.first()
        # Copy all content
        self._copy_content_to(published)
        published.save()
    else:
        # Create new published copy
        published = self.create_published_copy()
    
    # Set status to Review
    self.platform_status = "Review"
    self.review_submitted_date = timezone.now()
    self.save()
    
    return published
```

### Step 2: Update Approval Workflow

Modify `CourseApprovalAPIView.post()`:

```python
if action == "approve":
    # Get/create published copy
    published = course.submit_for_publication()
    
    # If no published copy yet, create one
    if not published:
        published = course.create_published_copy()
    
    # Mark PUBLISHED copy as approved
    published.platform_status = "Published"
    published.teacher_course_status = "Published"
    published.approved_by = user
    published.approval_date = timezone.now()
    published.save_published_snapshot()  # Save snapshot
    published.save()
    
    # Mark DRAFT as Published too (synced)
    course.platform_status = "Published"
    course.teacher_course_status = "Published"
    course.approved_by = user
    course.approval_date = timezone.now()
    course.save()
```

### Step 3: Add Restore Endpoint

Create new method:

```python
def restore_from_published():
    """Restore draft course to published state"""
    published_copies = self.published_copies.filter(
        is_published_version=True,
        platform_status="Published"
    )
    
    if not published_copies.exists():
        return False, "Tidak ada versi terpublikasi untuk dikembalikan"
    
    published = published_copies.first()
    
    # Delete draft content
    self.curriculum.all().delete()
    self.quizzes.all().delete()
    # ... other content
    
    # Copy from published
    published._copy_content_to(self)
    
    # Restore metadata from snapshot
    if self.published_snapshot:
        self.restore_from_published_snapshot()
    
    return True, "Kursus berhasil dikembalikan ke versi terpublikasi"
```

### Step 4: Update Frontend UI

Modify course list:
- Filter out `is_published_version=True` courses
- Only show instructor's draft courses
- Display status: "Draft", "Review Pending", "Published", "Rejected"

Modify CourseEdit page:
- Add "Restore Kursus" button (only when published)
- Show which version instructor is editing

---

## 6. Data Flow Diagrams

### Current State (Broken):
```
Instructor submits → platform_status="Review"
                  → No published copy created yet ❌
                  
Admin approves → Tries to copy to published_copies
              → But no published copy exists ❌
              → Code fails or creates on the fly
```

### After Implementation:
```
1. Instructor submits:
   Draft Course → _copy_content_to() → Published Copy
   platform_status = "Review"

2. Admin approves:
   Published Copy.platform_status = "Published"
   Draft.platform_status = "Published" (synced)

3. Students fetch:
   WHERE platform_status="Published" AND is_published_version=True
   → See published course with all content

4. Instructor needs restore:
   Restore endpoint → delete Draft content
                   → re-copy from Published
                   → reset Draft metadata
```

---

## 7. Database Impact

### New/Modified Models

**No new models needed** - use existing structure:

```python
# Already exists
class Course(models.Model):
    is_published_version = Boolean  # Already there
    parent_course = ForeignKey  # Already there
    published_snapshot = JSONField  # Already there
```

### Modifications Needed

1. **Course Model** - Add 3 methods:
   - `submit_for_publication()` 
   - `restore_from_published()`
   - Enhanced `_copy_content_to()`

2. **Views** - Modify:
   - `CoursePublishAPIView` - Call new method
   - `CourseApprovalAPIView` - Handle published copies
   - `CourseRestoreAPIView` - Enhanced restore logic
   - `TeacherCourseListAPIView` - Filter out published copies

3. **Frontend** - Modify:
   - CourseEdit.jsx - Add Restore button
   - CourseList - Filter and display

---

## 8. Possible Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Published course not showing to students after approval | API filters not updated | Update queryset: `filter(is_published_version=True, platform_status="Published")` |
| Duplicate courses in instructor list | Published copies showing | Filter: `filter(is_published_version=False)` in course list |
| Restore deletes content during restore | Cascade on delete | Use `on_delete=models.SET_NULL` for published copy links |
| Admin sees duplicates in review | Shows both draft & published | Filter: Only show `is_published_version=False` in admin review list |
| Sync issues between draft & published | Manual changes to one | Keep published read-only until next approval |

---

## 9. SUMMARY: What to Do Next

### Phase 1: Understanding ✅ (DONE)
- [x] Scanned all models
- [x] Understood current flow
- [x] Identified dual-system conflict

### Phase 2: Implementation (TO DO)
1. **Update Course Model**
   - Add `submit_for_publication()` method
   - Enhance `_copy_content_to()` to handle all related models properly
   - Add `restore_from_published()` method

2. **Update Views**
   - `CoursePublishAPIView.post()` - Call submit_for_publication()
   - `CourseApprovalAPIView.post()` - Sync published copies correctly
   - `CourseRestoreAPIView.post()` - Implement full restore
   - Add filter in `TeacherCourseListAPIView` to exclude published copies

3. **Update Frontend**
   - Add Restore button in CourseEdit.jsx
   - Add Restore endpoint call
   - Filter published courses from course list

4. **Add Tests**
   - Test submit → creates published copy
   - Test approve → syncs both versions
   - Test restore → copies published back to draft

---

## Next Action: Ready to Implement?

Should I proceed with implementing this Hybrid Dual-Copy approach? 

**Files to modify**:
- `backend/api/models.py` (Course model - add 3 methods)
- `backend/api/views.py` (3-4 view modifications)
- `frontend/src/views/instructor/CourseEdit.jsx` (UI updates)
- `backend/api/urls.py` (if adding new endpoints)

**Estimated changes**: ~300-400 lines
**Risk level**: Low (uses existing fields, no migrations needed)
**Time to implement**: 1-2 hours

