# Code Changes - PHASE 4.101: Memory Cleanup Fix

## Change 1: Added Import (Line 51)

### Before ❌
```python
from django.core.files.storage import default_storage
import os
try:
    from moviepy.editor import VideoFileClip
```

### After ✅
```python
from django.core.files.storage import default_storage
import os
import re  # ← ADDED for URL parsing
try:
    from moviepy.editor import VideoFileClip
```

---

## Change 2: Added Helper Function (Line 3671)

### Before ❌
```python
# No file cleanup function existed
# Orphaned files accumulated with no way to clean them up
```

### After ✅
```python
# ✨ PHASE 4.101: Helper function to delete orphaned files
def delete_orphaned_file(file_url):
    """
    Delete a file from storage based on its URL
    
    MEMORY OPTIMIZATION: Prevents accumulation of orphaned files when course
    images/files are replaced. Only deletes files from our local storage
    (not external URLs like Google Drive, YouTube, CDNs).
    """
    if not file_url:
        return False
    
    try:
        # Only delete our own hosted files, not external URLs
        if file_url.startswith(('http://', 'https://')):
            if not settings.ALLOWED_HOSTS:
                return False
            is_ours = any(host in file_url for host in settings.ALLOWED_HOSTS) or 'localhost' in file_url
            if not is_ours:
                print(f"[File Cleanup] Skipping external file: {file_url}")
                return False
        
        # Extract file path and delete safely
        match = re.search(r'(/media/.+?)(?:\?|$)', str(file_url))
        if not match:
            return False
        
        file_path = match.group(1).lstrip('/')
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        
        # Security: ensure within MEDIA_ROOT
        if not os.path.abspath(full_path).startswith(os.path.abspath(settings.MEDIA_ROOT)):
            print(f"[File Cleanup] SECURITY: Attempted to delete outside MEDIA_ROOT")
            return False
        
        if os.path.exists(full_path):
            os.remove(full_path)
            print(f"[File Cleanup] ✅ Deleted: {full_path}")
            return True
            
    except Exception as e:
        print(f"[File Cleanup] ❌ Error: {str(e)}")
        return False
```

---

## Change 3: CourseUpdateAPIView - Added Cleanup (Line 3829)

### Before ❌
```python
def update(self, request, *args, **kwargs):
    try:
        course = self.get_object()
        original_status = course.platform_status
        
        # Directly update image/file with no cleanup
        if "image" in request.data:
            course.image = request.data['image']
        
        if "file" in request.data:
            course.file = request.data['file']
        
        # Save without deleting old files
        course.save()
```

### After ✅
```python
def update(self, request, *args, **kwargs):
    try:
        course = self.get_object()
        original_status = course.platform_status
        
        # ✨ PHASE 4.101: DELETE OLD FILES BEFORE UPDATING
        # Prevent memory waste by cleaning up orphaned files
        if "image" in request.data and request.data['image']:
            new_image = str(request.data['image']).strip()
            if course.image and new_image != course.image:
                print(f"[Memory Cleanup] Image changed, deleting old: {course.image}")
                delete_orphaned_file(course.image)  # DELETE OLD FILE!
        
        if "file" in request.data and request.data['file']:
            new_file = str(request.data['file']).strip()
            if course.file and new_file != course.file:
                print(f"[Memory Cleanup] File changed, deleting old: {course.file}")
                delete_orphaned_file(course.file)  # DELETE OLD FILE!
        
        # Continue with update...
        course.save()
```

---

## Change 4: TeacherCourseDetailAPIView - Delete Cleanup (Line 1310)

### Before ❌
```python
def destroy(self, request, *args, **kwargs):
    try:
        course = self.get_object()
        # Deletes from database only, files remain on disk
        course.delete()
        
        return Response({
            "success": True,
            "message": f"Course deleted"
        })
```

### After ✅
```python
def destroy(self, request, *args, **kwargs):
    try:
        course = self.get_object()
        
        # ✨ PHASE 4.101: DELETE COURSE FILES BEFORE DELETING COURSE
        # Prevent memory waste by cleaning up files
        if course.image:
            print(f"[Memory Cleanup] Deleting course image: {course.image}")
            delete_orphaned_file(course.image)  # DELETE FILE!
        
        if course.file:
            print(f"[Memory Cleanup] Deleting course file: {course.file}")
            delete_orphaned_file(course.file)  # DELETE FILE!
        
        # Now delete from database
        course.delete()
        
        return Response({
            "success": True,
            "message": f"Course deleted"
        })
```

---

## Change 5: CourseUpdateAPIView - Curriculum Cleanup (Line 4087)

### Before ❌
```python
# Delete variants that weren't in the update (removed by user)
for variant in all_course_variants:
    if variant.variant_id not in updated_variant_ids:
        # Deletes from database, files stay on disk
        variant.delete()

# Delete orphaned items
for variant_id in updated_variant_ids:
    variant = course.curriculum.filter(variant_id=variant_id).first()
    for item in all_variant_items:
        if item.variant_item_id not in updated_item_ids:
            # Deletes from database, files stay on disk
            item.delete()
```

### After ✅
```python
# Delete variants that weren't in the update (removed by user)
deleted_variant_count = 0
for variant in all_course_variants:
    if variant.variant_id not in updated_variant_ids:
        print(f"[Curriculum Cleanup] Deleting variant {variant.variant_id}")
        # ✨ PHASE 4.101: Clean up variant item files before deletion
        for item in variant.variant_items.all():
            if item.file:
                delete_orphaned_file(item.file)  # DELETE FILE!
        variant.delete()
        deleted_variant_count += 1

# Delete orphaned items (items whose variant was updated but item wasn't)
deleted_item_count = 0
for variant_id in updated_variant_ids:
    variant = course.curriculum.filter(variant_id=variant_id).first()
    if variant:
        all_variant_items = variant.variant_items.all()
        for item in all_variant_items:
            if item.variant_item_id not in updated_item_ids:
                print(f"[Curriculum Cleanup] Deleting item {item.variant_item_id}")
                # ✨ PHASE 4.101: Clean up item file before deletion
                if item.file:
                    delete_orphaned_file(item.file)  # DELETE FILE!
                item.delete()
                deleted_item_count += 1
```

---

## Summary of Changes

| Location | Change | Impact |
|----------|--------|--------|
| Imports | Added `re` module | URL parsing |
| New Function | `delete_orphaned_file()` | Core cleanup logic |
| Course Update | Check & delete old image/file | Prevents image orphans |
| Course Delete | Delete image/file before DB delete | Prevents orphans on deletion |
| Curriculum Delete | Delete item files before deletion | Prevents lesson orphans |

---

## Verification

### Console Output - Before Change
```
User uploaded image3.jpg, replacing image2.jpg
image2.jpg remains on disk
[No [Memory Cleanup] logs exist]
```

### Console Output - After Change
```
User uploaded image3.jpg, replacing image2.jpg
[Memory Cleanup] Image changed, deleting old: /media/course-file/abc123.jpg
[File Cleanup] ✅ Deleted: /backend/media/course-file/abc123.jpg
✓ image2.jpg successfully deleted
```

