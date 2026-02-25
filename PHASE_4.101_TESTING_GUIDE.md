# 🧪 Testing Guide - PHASE 4.101: Memory Cleanup

## Overview
This guide helps verify that the memory cleanup system is working correctly.

---

## Manual Testing (Frontend)

### Test 1: Replace Course Image (File Upload)

**Steps**:
1. Go to: `http://localhost:5174/instructor/edit-course/271157/`
2. Scroll to **"Gambar Kursus"** section
3. Click **"Unggah File"** button
4. Upload an image (e.g., `image1.jpg`)
5. ✅ Verify image appears in preview
6. **Click "Unggah File"** again
7. Upload a different image (e.g., `image2.jpg`)
8. ✅ Verify new image appears in preview

**Expected Behavior**:
- ❌ Old `image1.jpg` should be deleted from `/media/course-file/`
- ✅ Only `image2.jpg` should remain
- Console should show: `[Memory Cleanup] Image changed...` and `[File Cleanup] ✅ Deleted: ...`

**Check Console**:
```bash
# Django console output:
[Memory Cleanup] Image changed, deleting old: /media/course-file/uuid1.jpg
[File Cleanup] ✅ Deleted: /backend/media/course-file/uuid1.jpg
```

---

### Test 2: Replace Course Image (URL Method)

**Steps**:
1. Go to: `http://localhost:5174/instructor/edit-course/271157/`
2. Scroll to **"Gambar Kursus"** section
3. Click **"Dari URL"** button
4. Enter a Google Drive image URL
5. Click **"Tambahkan"**
6. ✅ Verify URL-based image appears
7. **Click "Unggah File"** button
8. Upload an image to replace the URL
9. ✅ Verify uploaded image appears

**Expected Behavior**:
- URL-based images are NOT deleted (external, can't be deleted)
- Uploaded file is successfully added
- Console should NOT show deletion for Google Drive URL

---

### Test 3: Delete Course

**Steps**:
1. Go to: `http://localhost:5174/instructor/courses/`
2. Find a test course
3. Click **Delete** button
4. Confirm deletion
5. ✅ Verify course removed from list

**Expected Behavior**:
- All course files deleted from `/media/course-file/`
- Console shows: `[Memory Cleanup] Deleting course image: ...`
- Database no longer has course record

---

### Test 4: Remove Lesson from Curriculum

**Steps**:
1. Go to: `http://localhost:5174/instructor/edit-course/271157/curriculum/`
2. Find a section with a lesson that has a video file
3. Click **Delete** on that lesson
4. Confirm deletion
5. Save curriculum changes
6. ✅ Verify lesson removed

**Expected Behavior**:
- Old lesson video file deleted from `/media/course-file/`
- Console shows: `[Curriculum Cleanup] Deleting orphaned item ...`
- Only 1 deleted log per lesson

---

## Backend Verification

### Check 1: Verify File Deletion in Console

**Run Django shell**:
```bash
cd backend
python manage.py shell
```

**Monitor file deletion**:
```python
import os
from django.conf import settings

media_path = settings.MEDIA_ROOT
course_files = f"{media_path}/course-file/"

# Count files before action
initial_count = len(os.listdir(course_files))
print(f"Files before: {initial_count}")

# (User performs action in browser)
# Check again after action
new_count = len(os.listdir(course_files))
print(f"Files after: {new_count}")
print(f"Deleted: {initial_count - new_count} files")

# List remaining files
for f in sorted(os.listdir(course_files)):
    size_mb = os.path.getsize(f"{course_files}{f}") / (1024*1024)
    print(f"  {f}: {size_mb:.2f} MB")
```

---

### Check 2: Monitor Disk Usage

**Before testing**:
```bash
du -sh /backend/media/course-file/
# Example: 150M
```

**After testing (multiple changes/deletions)**:
```bash
du -sh /backend/media/course-file/
# Should be smaller than before (not larger)
```

---

### Check 3: Verify Logs in Django

**Look for these patterns** in Django console:
```
✅ OLD FILE REPLACED - Should see:
[Memory Cleanup] Image changed, deleting old: /media/course-file/...
[File Cleanup] ✅ Deleted: /backend/media/course-file/...

✅ COURSE DELETED - Should see:
[Memory Cleanup] Deleting course image: /media/course-file/...
[Memory Cleanup] Deleting course file: /media/course-file/...
[File Cleanup] ✅ Deleted: ...

✅ CURRICULUM MODIFIED - Should see:
[Curriculum Cleanup] Deleting orphaned item ...
[File Cleanup] ✅ Deleted: /backend/media/course-file/...

❌ EXTERNAL URL - Should see:
[File Cleanup] Skipping external file: https://drive.google.com/...
```

---

### Check 4: Database Consistency

**Verify no broken references**:
```python
from api.models import Course, VariantItem
import os
from django.conf import settings

# Get all course images in DB
db_images = set()
for course in Course.objects.all():
    if course.image and course.image.startswith('/media/'):
        db_images.add(course.image.split('/media/')[-1])

# Get all actual files
actual_files = set(os.listdir(f"{settings.MEDIA_ROOT}/course-file/"))

# Check for orphaned files (in disk but not in DB)
orphaned = actual_files - db_images
if orphaned:
    print(f"⚠️ Found {len(orphaned)} orphaned files (these should be deleted)")
    for f in list(orphaned)[:10]:  # Show first 10
        print(f"  - {f}")
else:
    print(f"✅ No orphaned files! Database and disk are in sync.")

print(f"Total: {len(actual_files)} files on disk, {len(db_images)} in database")
```

---

## Automated Test Script

**Create `test_cleanup.py`**:
```python
#!/usr/bin/env python
"""
Test script to verify PHASE 4.101 memory cleanup
Run: python test_cleanup.py
"""

import os
import sys
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Course, VariantItem

def test_orphaned_files():
    """Check for orphaned files in storage"""
    media_root = settings.MEDIA_ROOT
    course_files_dir = os.path.join(media_root, 'course-file')
    
    if not os.path.exists(course_files_dir):
        print("✅ course-file directory doesn't exist (clean)")
        return True
    
    # Get all files on disk
    actual_files = set(f for f in os.listdir(course_files_dir))
    
    # Get all files referenced in DB
    db_files = set()
    for course in Course.objects.all():
        if course.image and 'course-file' in course.image:
            db_files.add(os.path.basename(course.image))
        if course.file and 'course-file' in course.file:
            db_files.add(os.path.basename(course.file))
    
    for item in VariantItem.objects.all():
        if item.file and 'course-file' in item.file:
            db_files.add(os.path.basename(item.file))
    
    # Check for orphans
    orphaned = actual_files - db_files
    
    print(f"Files on disk: {len(actual_files)}")
    print(f"Files in database: {len(db_files)}")
    print(f"Orphaned files: {len(orphaned)}")
    
    if orphaned:
        print("\n❌ FOUND ORPHANED FILES:")
        for f in sorted(orphaned)[:20]:
            size_mb = os.path.getsize(os.path.join(course_files_dir, f)) / (1024*1024)
            print(f"  - {f}: {size_mb:.2f} MB")
        return False
    else:
        print("\n✅ NO ORPHANED FILES FOUND - Cleanup working correctly!")
        return True

if __name__ == '__main__':
    success = test_orphaned_files()
    sys.exit(0 if success else 1)
```

**Run it**:
```bash
cd backend
python test_cleanup.py
```

**Expected Output**:
```
Files on disk: 12
Files in database: 12
Orphaned files: 0

✅ NO ORPHANED FILES FOUND - Cleanup working correctly!
```

---

## Troubleshooting

### Problem: Files not being deleted

**Check 1: Verify cleanup function is being called**
- Look for console output: `[Memory Cleanup]` messages
- If not showing, restart Django

**Check 2: Check permissions**
```bash
ls -la /backend/media/course-file/
# Should be readable/writable by Django user
```

**Check 3: Verify file paths**
```python
from api.models import Course
c = Course.objects.first()
print(c.image)  # Should be like: /media/course-file/uuid.jpg
```

### Problem: External URLs being deleted

**Check**: Function should skip Google Drive, YouTube URLs
- Look for logs: `[File Cleanup] Skipping external file:`
- If not present, verify `delete_orphaned_file()` has external URL check

### Problem: Disk usage not decreasing

**Check**:
1. Restart Django - old processes might hold file handles
2. Check if cascade delete happening - variant/item deletion might not trigger cleanup
3. Run manual check: Do deleted files exist in DB still?

---

## Regression Tests

### Ensure No Breaks

- [ ] Courses can still be created ✅
- [ ] Images can still be uploaded ✅
- [ ] Files can still be updated ✅
- [ ] Google Drive images still work ✅
- [ ] YouTube videos still work ✅
- [ ] Curriculum still updatable ✅
- [ ] Courses can be deleted ✅

---

## Performance Tests

**Before deploying, verify no slowdown**:
```python
import time
from api.views import delete_orphaned_file

# Test deletion speed
file_url = "/media/course-file/test.jpg"
start = time.time()
delete_orphaned_file(file_url)
elapsed = time.time() - start

print(f"Deletion time: {elapsed*1000:.1f}ms")
# Should be < 10ms
```

---

## Sign-off

- [ ] Manual frontend tests pass
- [ ] Backend verification shows cleanup working
- [ ] No orphaned files found
- [ ] Storage usage stable
- [ ] Console logs showing cleanup
- [ ] Performance acceptable
- [ ] No regression issues

**✅ Ready for Production!**

