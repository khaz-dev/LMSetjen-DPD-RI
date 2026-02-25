# 🧪 PHASE 4.101.2 - TESTING & VERIFICATION GUIDE

**Date**: February 23, 2026  
**Components Modified**: 3 (Frontend + Backend)  
**Impact Level**: Critical Memory Issue  

---

## Quick Test (5 minutes)

### Setup
```bash
# Terminal 1 - Django Backend
cd "d:\Project\LMSetjen DPD RI\backend"
python manage.py runserver 8001

# Terminal 2 - React Frontend  
cd "d:\Project\LMSetjen DPD RI\frontend"
npm run dev
```

### Test Steps

#### Step 1: Check File Count Before Test
```powershell
cd "d:\Project\LMSetjen DPD RI\backend"
(Get-ChildItem "media\course-file\" | Measure-Object).Count
# Note this number: e.g., 2
```

#### Step 2: Open Course Editor
- **Go to**: http://localhost:5174/instructor/edit-course/271157/
- **Scroll to**: "Gambar Kursus" section
- **Current image**: Note what's displayed

#### Step 3: Upload Multiple Times (NO SAVE)
```
1. Click upload button → Select image1.jpg → Wait for complete
   Console shows: "Gambar Berhasil Diunggah" ✅
   
2. Click upload button → Select image2.jpg → Wait for complete
   Console shows: "Gambar Berhasil Diunggah" ✅
   
3. Click upload button → Select image3.jpg → Wait for complete
   Console shows: "Gambar Berhasil Diunggah" ✅
```

#### Step 4: Check Django Console
**Watch terminal where Django is running** for messages like:
```
[ImageUpload] Tracking unsaved upload for cleanup: http://localhost:8001/media/course-file/UUID1.jpg
[ImageUpload] Previous unsaved uploads now: ['http://...UUID1.jpg']

[ImageUpload] Tracking unsaved upload for cleanup: http://localhost:8001/media/course-file/UUID2.jpg
[ImageUpload] Previous unsaved uploads now: ['http://...UUID1.jpg', 'http://...UUID2.jpg']
```

**If you see these** → Frontend tracking is working! ✅

#### Step 5: Click SIMPAN DRAF (Save)
- Click the "SIMPAN DRAF" button
- Wait for success message
- Watch Django console for cleanup messages

#### Step 6: Check Django Console for Cleanup
**Expected to see**:
```
[Memory Cleanup] === IMAGE CLEANUP CHECK ===
[Memory Cleanup] 'image' in request.data: True
[Memory Cleanup] request.data['image']: http://localhost:8001/media/course-file/UUID3.jpg
[Memory Cleanup] course.image (from DB): https://drive.google.com/...
[Memory Cleanup] ✅ IMAGE CLEANUP: Deleting old: https://drive.google.com/...
[File Cleanup] Skipping external file: https://drive.google.com/...

[Memory Cleanup] === UNSAVED UPLOADS CLEANUP CHECK ===
[Memory Cleanup] Found 2 unsaved uploads to clean
[Memory Cleanup] ✅ DELETING UNSAVED UPLOAD: http://localhost:8001/media/course-file/UUID1.jpg
[File Cleanup] ✅ Deleted: D:\...\media\course-file/UUID1.jpg

[Memory Cleanup] ✅ DELETING UNSAVED UPLOAD: http://localhost:8001/media/course-file/UUID2.jpg  
[File Cleanup] ✅ Deleted: D:\...\media\course-file/UUID2.jpg
```

**If you see these** → Backend cleanup is working! ✅

#### Step 7: Check File Count After Save
```powershell
cd "d:\Project\LMSetjen DPD RI\backend"
(Get-ChildItem "media\course-file\" | Measure-Object).Count
# Should be SAME or FEWER than before test
# Example: Was 2 before → Should be ~2 after (not 5)
```

---

## Detailed Test Cases

### Test Case 1: Multiple Uploads → Save
**Expected**: All intermediate uploads deleted

```
BEFORE:
  media/course-file/
  ├── existing1.jpg (from previous test)
  └── existing2.jpg (from previous test)
  Count: 2

ACTIONS:
  1. Upload new1.jpg (count becomes 3)
  2. Upload new2.jpg (count becomes 4) 
  3. Upload new3.jpg (count becomes 5)
  4. Click Save

AFTER:
  media/course-file/
  ├── existing1.jpg
  ├── existing2.jpg
  └── new3.jpg (only the final one!)
  Count: 3 ✅ (new1 and new2 deleted!)

DJANGO CONSOLE:
  ✅ DELETING UNSAVED UPLOAD: .../new1.jpg
  ✅ Deleted: ...
  ✅ DELETING UNSAVED UPLOAD: .../new2.jpg
  ✅ Deleted: ...
```

### Test Case 2: Upload, Save, Upload Again, Save

```
BEFORE: media/course-file/ has 2 files

ACTION 1: Upload new1.jpg → Save
  - new1.jpg saved to DB
  - Count: 3 (added 1)
  
ACTION 2: Upload new2.jpg → Save
  - new1.jpg not deleted (still in DB from previous save!)
  - new2.jpg saved to DB
  - Cleanup deletes old DB value (nothing since new1 is it)
  - Count: 4 (added 1)

EXPECTED: This is normal! ✅
  - No unsaved intermediates → nothing to clean
  - Only deletes when image field CHANGES
```

### Test Case 3: Upload Via URL (Google Drive) Instead

```
BEFORE: media/course-file/ has 3 files

ACTION: 
  1. Paste Google Drive URL → Save

DJANGO CONSOLE:
  ✅ IMAGE CLEANUP: Deleting old: http://localhost:8001/media/course-file/...
  [File Cleanup] ✅ Deleted: ...
  (No unsaved uploads, so UNSAVED UPLOADS check skipped)

AFTER: media/course-file/ has 2 files ✅
  - Old local upload deleted
  - Google Drive URL doesn't create a file
```

### Test Case 4: Delete Course

```
BEFORE: media/course-file/ has 5 files
  Some referenced in courses, some orphaned

ACTION:
  1. Delete entire course

DJANGO CONSOLE:
  [Memory Cleanup] Deleting old: http://localhost:8001/media/course-file/course-image.jpg
  [File Cleanup] ✅ Deleted: ...

AFTER: media/course-file/ has 4 files ✅
  - Course image deleted
```

---

## Cleanup Command Testing

### Dry Run (Safe - Doesn't Delete)
```bash
cd backend
python manage.py cleanup_orphaned_files --dry-run

# Example output:
# [Cleanup] Scanning Course.image field...
# [Cleanup] Total referenced files in database: 3
# [Cleanup] Total files on disk: 8
# ⚠️  Found 5 orphaned files:
#   🗑️  orphan1.jpg (0.13MB)
#      (would be deleted in --dry-run mode)
#   🗑️  orphan2.jpg (0.13MB)
#      (would be deleted in --dry-run mode)
# 🔍 DRY RUN - No files actually deleted
```

### Actual Cleanup
```bash
python manage.py cleanup_orphaned_files

# Example output:
# Found 5 orphaned files
# [proceeding...]
# ✅ Cleanup complete! Freed 0.65MB
```

### Verify Cleanup Worked
```bash
# Run again - should show 0 orphaned files
python manage.py cleanup_orphaned_files --dry-run
# [Cleanup] No orphaned files found!
```

---

## Browser Console Checks

### Open Browser DevTools (F12)

#### Check Frontend Console
```javascript
// Should see tracking messages:
[ImageUpload] Tracking unsaved upload for cleanup: http://localhost:8001/media/course-file/UUID1.jpg
[ImageUpload] Previous unsaved uploads now: [...]

// When saving:
[useCourse.submitCourse] ✅ Unsaved uploads to clean up: [...]
[useCourse.submitCourse] Full Request Data:
  unsaved_image_uploads: [...]
```

#### Check Network Tab
- **XHR/Fetch** tab
- Look for **PATCH** to `/teacher/course-update/.../`
- **Payload** should include `unsaved_image_uploads`: [...]

---

## Troubleshooting

### Issue: Console doesn't show cleanup messages

**Diagnosis**:
```bash
# Check Django is running with latest code
ps aux | grep "python manage.py runserver"

# Should see output like:
# D:\...\backend\manage.py runserver 8001
```

**Fix**:
1. Kill Django process
2. Pull latest code
3. Restart: `python manage.py runserver 8001`

### Issue: Files still accumulating despite cleanup messages

**Diagnosis**:
```python
# Check if cleanup actually ran
from api.models import Course
course = Course.objects.get(course_id=271157)
print(f"Image in DB: {course.image}")

# List files on disk
import os
files = os.listdir("path/media/course-file/")
print(f"Files on disk: {files}")
```

**Possible Causes**:
1. **External URLs**: Google Drive URLs won't leave files on disk (normal!)
2. **Permission issue**: Django user can't delete (check file permissions)
3. **Path mismatch**: File has different path format (check logs)

### Issue: `cleanup_orphaned_files` command not found

**Fix**:
```bash
# Verify file exists
ls backend/api/management/commands/cleanup_orphaned_files.py

# Verify __init__.py files exist
ls backend/api/management/__init__.py
ls backend/api/management/commands/__init__.py

# Restart Django
python manage.py cleanup_orphaned_files --help
# Should show help text
```

---

## Performance Check

### Disk Usage Before/After

```bash
# Before fix
du -sh "d:\Project\LMSetjen DPD RI\backend\media\course-file\"
# Example: 125MB (lots of orphans)

# Week later (with fix running)
du -sh "d:\Project\LMSetjen DPD RI\backend\media\course-file\"
# Example: 42MB (cleaned up and stable!)
```

### API Performance

**Save endpoint should NOT be slower**:
- Delete operations are fast (files are small)
- No noticeable increase in save time
- If save time > 2 seconds, something else is wrong

---

## Success Criteria

✅ **All required to PASS**:

| Test | Status | Evidence |
|------|--------|----------|
| Multiple uploads tracked | ✅ | Console shows tracking messages |
| Unsaved uploads sent to backend | ✅ | Network tab shows field in payload |
| Cleanup executes on save | ✅ | Console shows deletion messages |
| Files actually deleted from disk | ✅ | File count decreases |
| Old orphans can be cleaned | ✅ | `cleanup_orphaned_files` works |
| No new orphans created | ✅ | File count stable over week |

---

## Quick Checklist

- [ ] Django running on http://localhost:8001
- [ ] Frontend running on http://localhost:5174
- [ ] Able to access course editor
- [ ] Can upload images
- [ ] Console output visible
- [ ] Can save course
- [ ] Console shows cleanup messages
- [ ] File count matches expectations
- [ ] Management command works
- [ ] Tests pass without errors

---

## Rollback Plan (If Issues)

```bash
# If files are being deleted when they shouldn't be:
# 1. Stop Django
# 2. Restore previous version of views.py
# 3. Comment out unsaved_image_uploads handling
# 4. Restart

# Files won't be cleaned but system will be stable
```

---

## Final Verification

Run all tests:
```bash
# Terminal 1 - Django
cd backend
python manage.py runserver 8001

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Manual testing
cd "d:\Project\LMSetjen DPD RI\backend"

# Before
(Get-ChildItem "media\course-file\" | Measure-Object).Count

# [Do test case 1: Upload 3 times, save]

# After
(Get-ChildItem "media\course-file\" | Measure-Object).Count

# Should be same or lower ✅
```

---

**Status**: Ready for testing! 

