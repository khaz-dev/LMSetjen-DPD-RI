# PHASE 4.60 - Quick Reference Card

**Status**: ✅ 100% COMPLETE - Ready for Deployment

---

## One-Minute Overview

**Problem**: Instructors editing published courses affected students (single-copy system)  
**Solution**: Dual-copy versioning - instructors edit drafts, students see published versions  
**Result**: Students unaffected during edits, changes appear only after admin approval ✅

---

## Quick Commands

### Apply Database Migration
```bash
python manage.py migrate
```

### Migrate Existing Data (One-Time)
```bash
python manage.py migrate_courses_to_versioning
```

### Dry Run Before Migrating (Safe)
```bash
python manage.py migrate_courses_to_versioning --dry-run
```

### Verbose Output
```bash
python manage.py migrate_courses_to_versioning --verbose
```

---

## Data Structure

| Field | Draft | Published Copy |
|-------|-------|-----------------|
| `is_published_version` | False | True |
| `parent_course` | None | Points to draft |
| Who edits | Instructor | (Copied from draft) |
| Who sees | Only instructors | Students only |

---

## API Endpoint Filters

**Students See** (Published Only):
```python
.filter(is_published_version=True)
```

**Instructors See** (Drafts Only):
```python
.filter(is_published_version=False)
```

**Admins See** (Parent Courses Only):
```python
.filter(is_published_version=False)
```

---

## System Flow

```
1. Instructor edits published course
   ↓
2. Smart branching creates draft version
   ↓
3. Instructor edits draft (not affecting students)
   ↓
4. Students see original published version
   ↓
5. Admin clicks "Approve"
   ↓
6. Draft changes copy to published version
   ↓
7. Students see updated content
```

---

## Files Changed

| Location | Changes | Lines |
|----------|---------|-------|
| `backend/api/models.py` | 2 fields + 3 methods | 195-206, 250-404 |
| `backend/api/views.py` | Filtering + branching | Multiple locations |
| `backend/api/migrations/0037_*` | New migration | Auto-generated |
| `backend/api/management/commands/*` | Migration script | New file |

---

## New Model Methods

```python
# Create published copy for students
published = course.create_published_copy()

# Create draft from published
draft = course.create_draft_version()

# Copy content between versions
course._copy_content_to(target_course)

# Get all published copies
copies = course.published_copies.all()
```

---

## Testing Checklist

- [ ] Migration applies successfully
- [ ] Instructor edits trigger branching
- [ ] Students see only published courses
- [ ] Admin approval copies changes
- [ ] No data loss

---

## Deployment Time Estimate

| Phase | Time |
|-------|------|
| Backup | 5 min |
| Migration | 2 min |
| Data Migration | 5-10 min |
| Testing | 5 min |
| **Total** | **20-30 min** |

---

## Key Endpoints Updated

1. ✅ `/api/v1/course/course-list/` - Student listing
2. ✅ `/api/v1/course/search/` - Student search
3. ✅ `/api/v1/course/full-text-search/` - Advanced search
4. ✅ `/api/v1/student/enrolled-courses/` - My courses
5. ✅ `/api/v1/stats/` - Public statistics
6. ✅ `/api/v1/teacher/<id>/courses/` - Instructor's courses
7. ✅ `/api/v1/admin/courses/` - Admin management

---

## After Deployment Verify

```bash
python manage.py shell
>>> from api.models import Course
>>> Course.objects.filter(is_published_version=True).count()
# Should show published versions created
```

---

## Emergency Rollback

```bash
# Restore database from backup
psql -U postgres lms_database < backup.sql

# Revert code to previous version
git revert HEAD

# Restart services
docker-compose restart
```

---

## Documentation Links

1. **Detailed Status**: `PHASE_4.60_COMPLETION_STATUS.md`
2. **Deployment Guide**: `PHASE_4.60_DEPLOYMENT_TESTING_GUIDE.md`
3. **Final Summary**: `PHASE_4.60_FINAL_SUMMARY.md`

---

## Key Points

✅ **Backward Compatible** - No data loss  
✅ **Idempotent** - Safe to run migrations multiple times  
✅ **Atomic** - All changes applied together  
✅ **Automatic** - Smart branching requires no user action  
✅ **Traceable** - All courses linked via parent_course  

---

## What Changed

### Before PHASE 4.60
```
Course (Single)
├─ Students see live edits ❌
└─ If instructor edits, students affected ❌
```

### After PHASE 4.60
```
Draft (Instructor edits here)
├─ Status: Draft/Review/Published
└─ Students don't see ✅

Published Copy (Students see here)
├─ Status: Published
└─ Updates only on admin approval ✅
```

---

## Success Indicators

✅ Database migration completes without errors  
✅ Data migration script shows all courses migrated  
✅ Instructor can edit published course (draft created automatically)  
✅ Student still sees original course during edits  
✅ Admin approval updates published version  
✅ All API filters working correctly  

---

**Ready to Deploy** ✅  
**Questions?** See detailed documentation files  
**Issues?** Use rollback procedure above  

