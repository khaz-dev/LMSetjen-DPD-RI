# PHASE 4.60 Implementation - Complete Deployment & Testing Guide

**Status**: ✅ 100% COMPLETE - Ready for Testing & Deployment  
**Document Version**: Final - 2024  
**Last Updated**: End of PHASE 4.60E Implementation Session

---

## Table of Contents
1. [Implementation Summary](#implementation-summary)
2. [What's Changed](#whats-changed)
3. [Testing Guide](#testing-guide)
4. [Deployment Steps](#deployment-steps)
5. [Rollback Procedure](#rollback-procedure)
6. [Troubleshooting](#troubleshooting)
7. [Quick Reference](#quick-reference)

---

## Implementation Summary

### Problem Solved
**Before PHASE 4.60**: When instructors edited a published course, students immediately saw the changes because they used the same database record. This caused:
- Students lost curriculum mid-course
- Features disappeared unexpectedly
- Progress tracking became unreliable
- No safe way to edit published courses

**After PHASE 4.60**: Courses use a dual-copy system where:
- Instructors edit a draft version
- Students always see a published copy (unchanged during edits)
- Admin approval copies changes to the published version
- Students see updates only after admin approval

### Architecture
```
Single-Copy (OLD) → Dual-Copy (NEW)

OLD:                          NEW:
Course (Single)              Draft (is_published_version=False)
├─ Students see              ├─ Instructors edit here
├─ Instructors edit          ├─ Status can be Draft/Review/Published
└─ Both affected ❌          ├─ Has curriculum, features, etc.
                             │
                             └─→ Published Copy (is_published_version=True)
                                 ├─ Students see here (unchanged)
                                 ├─ Status: Published
                                 └─ Updates only on admin approval
```

---

## What's Changed

### 1. Database Schema (Migration 0037)
**New Fields Added to Course Model**:
- `is_published_version` (Boolean, default=False)
  - True: This is a student-facing published copy
  - False: This is an instructor-editable draft
  
- `parent_course` (ForeignKey to self, nullable)
  - Points to instructor's draft (if this is a published copy)
  - Null: This is the original draft (not a copy)

**No Removed Fields** - Completely backward compatible

### 2. New Model Methods (Course class)
```python
# Creates exact copy for students
course.create_published_copy()
  → Returns: Published copy with is_published_version=True
  → Sets: parent_course → original course
  → Copies: Curriculum, features, requirements, outcomes

# Creates draft from published
course.create_draft_version()
  → Returns: Draft with is_published_version=False
  → Sets: platform_status → "Review"
  → Copies: All content from original

# Helper: Deep copy content
course._copy_content_to(target_course)
  → Copies: Variants (chapters), items, features, requirements, outcomes
  → Recursive: Handles nested relationships
```

### 3. API Endpoint Changes

**Student-Facing (now filter `is_published_version=True`)**:
- `/api/v1/course/course-list/` - Main course listing
- `/api/v1/course/search/` - Course search
- `/api/v1/course/full-text-search/` - Advanced search
- `/api/v1/student/enrolled-courses/` - Student's enrolled courses
- `/api/v1/stats/` - Public statistics

**Instructor-Facing (now filter `is_published_version=False`)**:
- `/api/v1/teacher/<id>/courses/` - Teacher's course list

**Admin-Facing (now filter `is_published_version=False`)**:
- `/api/v1/admin/courses/` - Admin course management

### 4. Smart Branching Logic
**Location**: `CourseUpdateAPIView.update()` (Lines 3513-3525)

```python
# When instructor tries to edit published course:
if course.platform_status == "Published" and course.parent_course is None:
    course = course.create_draft_version()
    # Instructor now edits new draft, students see original
```

**What This Means**:
- Instructor navigates to edit published course
- System automatically creates a draft version
- Instructor edits the draft (not affecting students)
- Students continue seeing the original
- Changes only appear after admin approval

### 5. Admin Approval with Copy
**Location**: `CourseApprovalAPIView.post()` (Lines 3985-3998)

```python
if action == "approve":
    # Find published copies of this draft
    published_copies = course.published_copies.all()
    if published_copies.exists():
        # Copy changes from draft to published
        for published_copy in published_copies:
            course._copy_content_to(published_copy)
            published_copy.save()
    
    # Mark draft as published
    course.platform_status = "Published"
```

**What This Means**:
- Admin reviews draft course
- Admin clicks "Approve"
- System copies all changes from draft to published copy
- Students immediately see updated content
- Curriculum, features, requirements all updated atomically

### 6. Data Migration Script (PHASE 4.60E)
**Command**: `python manage.py migrate_courses_to_versioning`

- Converts existing published courses to new system
- Creates published copies for all current published courses
- One-time operation (idempotent - safe to run multiple times)
- Includes dry-run mode for verification

---

## Testing Guide

### Pre-Deployment Testing

#### 1. Database Migration Test
```bash
# In staging environment, on fresh database:
python manage.py migrate

# Expected output:
# Running migrations:
#   Applying api.0037_course_versioning_phase_4_60... OK
```

**Verify Migration**:
```bash
python manage.py shell
>>> from api.models import Course
>>> # Should not error - new fields exist
>>> Course.objects.filter(is_published_version=True).count()
0  # No published copies yet (expected on fresh DB)
```

#### 2. Model Methods Test
```bash
python manage.py shell
>>> from api.models import Course
>>> 
>>> # Get a published test course (or create one)
>>> test_course = Course.objects.filter(platform_status="Published").first()
>>> 
>>> # Test 1: Create published copy
>>> published = test_course.create_published_copy()
>>> print(f"Published ID: {published.course_id}, is_published={published.is_published_version}")
Published ID: 456, is_published=True
>>> 
>>> # Test 2: Verify content copied
>>> print(f"Original curriculum: {test_course.curriculum().count()}")
Original curriculum: 3
>>> print(f"Copy curriculum: {published.curriculum().count()}")
Copy curriculum: 3  # Same amount
>>> 
>>> # Test 3: Create draft
>>> draft = published.create_draft_version()
>>> print(f"Draft status: {draft.platform_status}, is_published={draft.is_published_version}")
Draft status: Review, is_published=False
```

#### 3. Smart Branching Test
```bash
# 1. Create published course + enroll student
# 2. Simulate instructor edit:
POST /api/v1/teacher/1/course/123/update/
{
  "title": "Updated Title",
  ...
}

# 3. Verify branching occurred:
python manage.py shell
>>> from api.models import Course
>>> course = Course.objects.get(course_id=123)
>>> print(f"Status: {course.platform_status}, Parent: {course.parent_course}")
Status: Review, Parent: None  # ✅ Drafted!
>>>
>>> # Verify original published copy still exists
>>> original = Course.objects.filter(parent_course=course).first()
>>> print(f"Original exists: {original is not None}, Status: {original.platform_status}")
Original exists: True, Status: Published  # ✅ Unaffected!
```

#### 4. Endpoint Filtering Test
```bash
# Setup:
# - Create 2 courses: A (published) and B (draft)
# - Create enrolled student in course A

# Test 1: Student list sees only published
GET /api/v1/student/1/enrolled-courses/
# Response: [Course A] ✅ (Course B not listed)

# Test 2: Search returns only published
GET /api/v1/course/search/?search=test
# Response: Only courses with is_published_version=True ✅

# Test 3: Teacher sees only their drafts
GET /api/v1/teacher/1/courses/
# Response: Only non-published courses ✅

# Test 4: Admin sees only non-published
GET /api/v1/admin/courses/?status=Review
# Response: Only courses with is_published_version=False ✅
```

#### 5. Admin Approval Test
```bash
# Setup: Have pending review course with draft edits

# Test approval:
POST /api/v1/admin/course/123/approve/
{
  "action": "approve"
}

# Verify in database:
python manage.py shell
>>> from api.models import Course
>>> draft = Course.objects.get(course_id=123)
>>> published = Course.objects.filter(parent_course=draft).first()
>>> 
>>> # Check if content was copied
>>> draft_items = draft.curriculum().count()
>>> pub_items = published.curriculum().count()
>>> print(f"Draft items: {draft_items}, Published items: {pub_items}")
Draft items: 5, Published items: 5  # ✅ Copied!
```

#### 6. End-to-End Scenario Test
```
Step 1: Admin publishes "Python Basics" course
  - Course ID: A23
  - Status: Published
  - Students: 10 enrolled
  - Curriculum: 5 chapters

Step 2: Student enrolls in course
  - Student: John
  - Sees: Course A23 (published version)

Step 3: Instructor edits course
  - Action: Click "Edit Course"
  - System creates: Draft version (ID: B24)
  - Instructor: Now editing B24 (not A23)
  - Student John: Still sees A23 (unchanged)

Step 4: Instructor adds new chapter
  - Adds: Chapter 6
  - Draft B24: Now has 6 chapters
  - Published A23: Still has 5 chapters (student sees original)

Step 5: Admin approves draft
  - Action: Click "Approve" on B24
  - System calls: B24._copy_content_to(A23)
  - Published A23: Now has 6 chapters
  - Student John: Sees 6 chapters (if he refreshes)

RESULT: ✅ Instructor edits didn't interrupt student's course
```

---

## Deployment Steps

### Phase 1: Pre-Deployment (24 hours before)

#### 1. Backup Database
```bash
# PostgreSQL backup
pg_dump -U postgres lms_database > lms_backup_2024.sql
gz lms_backup_2024.sql
# Store safely in backup location
```

#### 2. Test Migration Script on Staging
```bash
# On staging environment with copy of production data
cd backend
python manage.py migrate 0037_course_versioning_phase_4_60

# Dry-run the data migration
python manage.py migrate_courses_to_versioning --dry-run
# Should show what would be migrated without making changes
```

#### 3. Review Test Results
- [ ] Database migration applies cleanly
- [ ] No SQL errors in logs
- [ ] Migration script shows all courses would be migrated
- [ ] Query filters working correctly on staging

### Phase 2: Deployment (Maintenance Window)

#### 1. Stop Application Services
```bash
# Stop web server
docker-compose down

# OR if using systemd
systemctl stop lms-backend lms-frontend
```

#### 2. Deploy New Code
```bash
# Update code
git pull origin main
# OR unzip new code

# Update dependencies if needed
pip install -r requirements.txt
```

#### 3. Run Database Migration
```bash
cd backend
python manage.py migrate

# Expected output:
# Running migrations:
#   Applying api.0037_course_versioning_phase_4_60... OK
```

**If migration fails**:
```bash
# Restore from backup
psql -U postgres lms_database < lms_backup_2024.sql
# STOP - investigate error before proceeding
```

#### 4. Run Data Migration Script
```bash
python manage.py migrate_courses_to_versioning

# For first-time verification, use --verbose:
python manage.py migrate_courses_to_versioning --verbose

# Expected output shows each course migrated with published copy created
```

**If data migration fails**:
```bash
# The script is idempotent - safe to run again
# First check what went wrong:
python manage.py migrate_courses_to_versioning --dry-run

# Fix issues, then run again
python manage.py migrate_courses_to_versioning
```

#### 5. Restart Application Services
```bash
# Start services
docker-compose up -d

# OR
systemctl start lms-backend lms-frontend
```

#### 6. Verify Deployment
```bash
# Check application is running
curl http://localhost:8001/api/v1/health/
# Should return 200 OK

# Check migration was applied
python manage.py showmigrations api | grep "0037"
# Should show: [X] 0037_course_versioning_phase_4_60

# Verify data migrated
python manage.py shell
>>> from api.models import Course
>>> published_count = Course.objects.filter(is_published_version=True).count()
>>> draft_count = Course.objects.filter(is_published_version=False, parent_course=None).count()
>>> print(f"Published: {published_count}, Drafts: {draft_count}")
# Should show published courses were created as copies
```

### Phase 3: Post-Deployment (First 24 hours)

#### 1. Monitor Logs
```bash
# Watch for any errors
tail -f /var/log/lms/django.log
# OR
docker logs -f lms-backend

# Look for any exceptions, especially:
# - "Error in course update"
# - "Serializer errors"
# - "Course not found"
```

#### 2. Functional Testing
- [ ] Teacher can list their courses (only drafts shown)
- [ ] Student can search courses (only published shown)
- [ ] Teacher can edit published course (branching creates draft)
- [ ] Admin can approve pending courses (copies to published)
- [ ] Student sees updated content after approval

#### 3. Performance Check
```bash
# Verify no new query N+1 issues
# Check database connection pool
# Monitor CPU/Memory usage
# Should be similar to before - two simple filters added
```

#### 4. User Communication
- [ ] Notify instructors: "Course editing now uses draft system"
- [ ] Notify admins: "New approval flow - copies changes to published"
- [ ] Notify students: "No changes - improvement under the hood"

---

## Rollback Procedure

**If Critical Issues Occur**:

### Option 1: Revert Code Only (Database Stays)
```bash
# Revert to previous version
git revert HEAD  # Or checkout previous tag

# Restart application
docker-compose restart lms-backend

# ⚠️  NOTE: Database still has new fields (won't cause issues - ignored)
# Students won't see published copies, but old courses still accessible
```

### Option 2: Full Rollback (Recommended)
```bash
# Stop application
docker-compose down

# Restore database from backup
psql -U postgres lms_database < lms_backup_2024.sql

# Revert code
git checkout previous-tag

# Restart
docker-compose up -d
```

### Option 3: Keep Database, Remove Features (Safest)
```bash
# If only specific issues:
# Keep the database with new fields (safe - backward compatible)
# 
# To disable new features without code revert:
# 1. Revert filter changes in views.py
# 2. Set all is_published_version=False (treats as all drafts)
# 3. Manually handle published copies separately
```

**Recovery Verification**:
```bash
# After rollback
python manage.py runserver

# Test endpoints - should work as before
# Database has new fields but they're not used
# No data loss occurs
```

---

## Troubleshooting

### Issue 1: "Column 'is_published_version' does not exist"
**Cause**: Migration not run  
**Solution**:
```bash
python manage.py migrate
python manage.py migrate_courses_to_versioning
```

### Issue 2: "Parent course not found" errors
**Cause**: Data migration script not run, or courses created after migration but before script  
**Solution**:
```bash
# Run data migration
python manage.py migrate_courses_to_versioning

# Manually for single course:
python manage.py shell
>>> from api.models import Course
>>> course = Course.objects.get(course_id=123)
>>> if course.platform_status == "Published":
>>>     published = course.create_published_copy()
```

### Issue 3: Students not seeing courses
**Cause**: Filter too strict, or courses not marked correctly  
**Solution**:
```bash
# Check filter in StudentCourseListAPIView
# Should be: course__is_published_version=True
# Not: is_published_version=True (would search wrong table)

# Verify enrolled courses
python manage.py shell
>>> from api.models import EnrolledCourse, Course
>>> e = EnrolledCourse.objects.first()
>>> print(f"Course ID: {e.course.course_id}, is_published: {e.course.is_published_version}")
```

### Issue 4: Admin can't see courses waiting for approval
**Cause**: Filter set too strict  
**Solution**:
```bash
# AdminCourseListAPIView should show:
# .filter(platform_status="Review", is_published_version=False)
# 
# Not: is_published_version=True (would be wrong courses)

# Test:
python manage.py shell
>>> from api.models import Course
>>> review_courses = Course.objects.filter(platform_status="Review", is_published_version=False)
>>> print(f"Found {review_courses.count()} courses awaiting approval")
```

### Issue 5: "create_draft_version() method not found"
**Cause**: Model method not saved / migration not applied  
**Solution**:
```bash
# Verify migration applied
python manage.py showmigrations | grep 0037

# Verify method defined
python manage.py shell
>>> from api.models import Course
>>> print(hasattr(Course, 'create_draft_version'))
True  # Should be True
```

### Issue 6: Duplicate courses appearing
**Cause**: Accidentally running data migration twice  
**Solution**:
```bash
# The script is idempotent - it checks for existing copies
# Should automatically skip already-migrated courses

# To verify:
python manage.py shell
>>> from api.models import Course
>>> # Should have only 1 published copy per draft
>>> draft = Course.objects.filter(platform_status="Published", is_published_version=False).first()
>>> copies = Course.objects.filter(parent_course=draft)
>>> print(f"Copies of draft: {copies.count()}")
1  # Should be exactly 1
```

---

## Quick Reference

### Database Schema
```sql
-- New fields in Course model
ALTER TABLE api_course ADD COLUMN is_published_version BOOLEAN DEFAULT FALSE;
ALTER TABLE api_course ADD COLUMN parent_course_id UUID NULL;

-- New foreign key
ALTER TABLE api_course 
  ADD CONSTRAINT api_course_parent_fk 
  FOREIGN KEY (parent_course_id) 
  REFERENCES api_course(course_id);
```

### API Filters
```python
# Student endpoints (see published only)
.filter(is_published_version=True)

# Instructor endpoints (see drafts only)
.filter(is_published_version=False)

# Admin endpoints (see parent courses only)
.filter(is_published_version=False)

# Enrollment endpoints
.filter(course__is_published_version=True)
```

### Model Methods
```python
course.create_published_copy()     # → Published copy
course.create_draft_version()      # → New draft
course._copy_content_to(target)   # → Copy content
course.published_copies.all()      # → Get published copies
```

### Management Commands
```bash
# Apply database migration
python manage.py migrate

# Run data migration (one-time)
python manage.py migrate_courses_to_versioning

# Dry run first
python manage.py migrate_courses_to_versioning --dry-run

# Verbose output
python manage.py migrate_courses_to_versioning --verbose
```

### Verification Queries
```python
# Check migration passed
python manage.py shell
>>> from api.models import Course
>>> Course.objects.filter(is_published_version=True).count()

# Check data migrated
>>> c = Course.objects.filter(platform_status="Published").first()
>>> c.published_copies.count()  # Should be > 0

# Check no orphans
>>> Course.objects.filter(parent_course!=None, is_published_version=False)  # Should be 0
```

---

## Key Files Modified

| File | Lines | Purpose |
|------|-------|---------|
| `backend/api/models.py` | 195-206, 250-404 | New fields and methods |
| `backend/api/migrations/0037_*.py` | All | Database migration |
| `backend/api/views.py` | Multiple locations | Endpoint filtering and branching |
| `backend/api/management/commands/migrate_courses_to_versioning.py` | New file | Data migration script |

---

## Support & Contact

For issues during deployment:
1. Check [Troubleshooting](#troubleshooting) section
2. Review deployment logs in `/var/log/lms/`
3. Verify database backup is available before attempting fixes
4. Consider full rollback if issue is critical

**Do not ignore warnings** in the migration script output - they indicate potential data issues.

---

**Status**: ✅ PHASE 4.60 COMPLETE - Ready for deployment  
**Next Steps**: Execute deployment steps above  
**Estimated Deployment Time**: 30-45 minutes (including testing)

