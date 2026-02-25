# Comprehensive File Upload & Deletion Logic Analysis
## LMSetjen DPD RI Backend

**Date**: February 23, 2026  
**Status**: CRITICAL - Orphaned Files Issue Identified  
**Severity**: High (File System Cleanup Never Occurs)

---

## Executive Summary

The Django backend **DOES NOT HAVE ANY FILE DELETION LOGIC**. When course images or files are updated, the old files remain permanently on disk, creating an ever-growing accumulation of orphaned files that:
- Waste disk space
- Pollute the media directory structure
- Are never cleaned up (even when courses are deleted from the database)
- Must be manually deleted from the filesystem

### Key Findings at a Glance

| Aspect | Status | Details |
|--------|--------|---------|
| **File Upload** | ✅ Working | Files upload via `FileUploadAPIView` to `/media/course-file/` with UUID names |
| **File Deletion on Update** | ❌ MISSING | Old files NOT deleted when course.image or course.file updated |
| **Database Record Deletion** | ✅ Cascading | Database records delete via `on_delete=models.CASCADE` only |
| **Signal Handlers for Cleanup** | ❌ NONE | No `post_delete` or `pre_delete` signal handlers exist |
| **Storage Configuration** | ✅ LocalFileSystem | MEDIA_ROOT = `backend/media`, URLField stores external URLs |
| **File Tracking** | ❌ MISSING | No system to track which files are orphaned or referenced |

---

## 1. File Upload Configuration

### 1.1 Media Root Settings
**File**: `backend/backend/settings.py` (Lines 215-216)

```python
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
```

**Current State**: Uses local filesystem storage at `backend/media/`

### 1.2 Course Model - URLField Instead of FileField
**File**: `backend/api/models.py` (Lines 167-168)

```python
class Course(models.Model):
    file = models.URLField(max_length=500, blank=True, null=True)    # URLField - NOT FileField!
    image = models.URLField(max_length=500, blank=True, null=True)   # URLField - NOT FileField!
```

**Critical Implication**: 
- By using `URLField` instead of `FileField`, Django doesn't track file relationships
- There's no `FieldFile` object to handle automatic deletion
- Manual deletion logic is required but **COMPLETELY MISSING**

### 1.3 File Upload Endpoint
**File**: `backend/api/views.py` (Lines 4647-4730)

```python
class FileUploadAPIView(APIView):
    """File Upload API View"""
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser,)

    def post(self, request):
        serializer = api_serializer.FileUploadSerializer(data=request.data)
        
        if serializer.is_valid():
            file = serializer.validated_data.get("file")
            
            # Create a more organized file path
            import uuid
            file_extension = os.path.splitext(file.name)[1].lower()
            unique_filename = f"course-file/{uuid.uuid4()}{file_extension}"
            
            # ✅ File is saved with unique UUID filename
            file_path = default_storage.save(unique_filename, ContentFile(file.read()))
            file_url = request.build_absolute_uri(default_storage.url(file_path))
            
            # ❌ PROBLEM: Only returns URL, doesn't track old files for deletion
            response_data = {
                "url": file_url,        # e.g., http://localhost:8001/media/course-file/abc123.mp4
                "file_name": file.name,
                "file_size": file.size,
                "file_type": self.determine_file_type(file_extension)
            }
            
            return Response(response_data)
```

**Files Generated**:
- Path: `backend/media/course-file/{uuid}.{extension}`
- Example: `backend/media/course-file/a1b2c3d4-e5f6-47g8-h9i0.mp4`
- **Stored in DB as**: Full URL (e.g., `http://localhost:8001/media/course-file/a1b2c3d4...`)

---

## 2. Course Update Logic - WHERE FILES BECOME ORPHANED

### 2.1 CourseUpdateAPIView - File Update Handling
**File**: `backend/api/views.py` (Lines 3662-3850)

```python
class CourseUpdateAPIView(generics.RetrieveUpdateAPIView):
    """Course Update API"""
    
    def update(self, request, *args, **kwargs):
        course = self.get_object()
        
        # ✅ HANDLES IMAGE UPDATE
        if "image" in request.data:
            if isinstance(request.data['image'], InMemoryUploadedFile):
                course.image = request.data['image']
            elif request.data['image'] and str(request.data['image']) != "No File":
                course.image = request.data['image']      # ❌ Just overwrites URL
            elif str(request.data['image']) == "No File":
                course.image = None
        
        # ✅ HANDLES FILE UPDATE
        if 'file' in request.data:
            if isinstance(request.data['file'], InMemoryUploadedFile):
                course.file = request.data['file']
            elif request.data['file'] and not str(request.data['file']).startswith("http://"):
                course.file = request.data['file']        # ❌ Just overwrites URL
            elif str(request.data['file']).startswith(("http://", "https://")):
                course.file = request.data['file']        # ❌ Just overwrites URL
        
        # ❌ NO CODE TO DELETE OLD FILES
        # When image/file URL is replaced above, old file remains on disk
        
        course.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
```

**What Happens**:
1. Admin/Instructor uploads new image → gets URL: `http://localhost:8001/media/course-file/NEW_UUID.jpg`
2. `CourseUpdateAPIView.update()` receives this URL
3. Code: `course.image = request.data['image']` → Overwrites old URL with new one
4. ❌ **Old file at `backend/media/course-file/OLD_UUID.jpg` is NEVER deleted**
5. Old file remains on disk, orphaned

---

## 3. File Deletion Code Audit

### 3.1 DeleteMethod Analysis - TeacherCourseDetailAPIView
**File**: `backend/api/views.py` (Lines 1309-1340)

When a course is deleted:

```python
class TeacherCourseDetailAPIView(generics.RetrieveDestroyAPIView):
    def destroy(self, request, *args, **kwargs):
        course = self.get_object()
        course_title = course.title
        course_id = course.course_id
        
        # Log the deletion
        print(f"Deleting course: {course_title}")
        
        # ✅ Delete database record
        course.delete()  # ← Triggers CASCADE deletes on related models
        
        # ❌ NO CODE TO DELETE ACTUAL FILES ON DISK
        # course.image file at /media/course-file/ is NEVER deleted
        # course.file file at /media/course-file/ is NEVER deleted
        
        return Response({
            "success": True,
            "message": f"Course '{course_title}' has been successfully deleted",
            "course_id": str(course_id)
        }, status=status.HTTP_200_OK)
```

**Result**: 
- Database record deleted ✅
- All related course lessons, quizzes, etc. deleted ✅  
- **Physical files on disk remain** ❌

### 3.2 Signal Handlers - No Cleanup Logic
**File**: `backend/api/models.py` (Lines 2855+)

```python
# Connect the signals
post_save.connect(sync_teacher_with_profile, sender=Teacher)
post_save.connect(track_course_click, sender=SearchLog)
post_save.connect(update_search_taxonomy, sender=SearchLog)

# ❌ NO post_delete signal for Course model cleanup!
# ❌ NO pre_delete signal to clean up files before deletion!
```

**Missing Signal Handler**:
```python
# THIS DOES NOT EXIST IN THE CODE:
@receiver(post_delete, sender=Course)
def cleanup_course_files(sender, instance, **kwargs):
    """Delete course files when course is deleted"""
    # Delete image file from storage
    if instance.image:
        # Extract path from URL
        # Delete from filesystem
    
    # Delete file from storage
    if instance.file:
        # Extract path from URL
        # Delete from filesystem
```

### 3.3 Admin Interface - No Delete Handlers
**File**: `backend/api/admin.py` (Lines 8-76)

```python
class CourseAdmin(admin.ModelAdmin):
    """Admin interface for Course model"""
    list_display = (...)
    list_filter = (...)
    search_fields = (...)
    readonly_fields = (...)
    
    # ❌ NO delete_model() override
    # ❌ NO delete_queryset() override
    # When admin deletes courses, files are NOT deleted from disk
```

---

## 4. Where Orphaned Files Accumulate

### 4.1 Directory Structure
```
backend/media/
├── certificate/
├── course-file/          ← ⚠️ MAIN ACCUMULATION POINT
│   ├── a1b2c3d4-e5f6...mp4    (OLD - Orphaned)
│   ├── b5c6d7e8-f9a0...jpg    (OLD - Orphaned)
│   ├── c9d0e1f2-a3b4...pdf    (CURRENT - In Use)
│   └── [... hundreds more ...]
├── courses/
├── documents/
├── images/
├── profiles/              ← Also vulnerable to accumulation
├── thumbnails/           ← Also vulnerable to accumulation
├── user_folder/
└── videos/
```

### 4.2 File Accumulation Scenarios

**Scenario 1: Image Replacement** (MOST COMMON)
```
1. Course created: image = http://localhost:8001/media/course-file/initial.jpg
2. Instructor edits course: image = http://localhost:8001/media/course-file/v2.jpg
3. OLD FILE: backend/media/course-file/initial.jpg ← LEFT ON DISK
4. Same for updates #3, #4, #5, etc.
5. After 100 edits: 100 orphaned image files accumulate
```

**Scenario 2: File Replacement**
```
1. Course has video: file = http://localhost:8001/media/course-file/lesson1.mp4
2. Instructor updates: file = http://localhost:8001/media/course-file/lesson1-v2.mp4
3. OLD FILE: backend/media/course-file/lesson1.mp4 ← LEFT ON DISK
```

**Scenario 3: Course Deletion**
```
1. Instructor publishes course with image & video files
2. Admin deletes course from database
3. Files on disk:
   - backend/media/course-file/image1.jpg ← ORPHANED
   - backend/media/course-file/video1.mp4 ← ORPHANED
   - NO CODE TO DELETE THESE
```

**Scenario 4: Draft → Publish → Edit Cycle**
```
[PHASE 4.60 Versioning Context]
1. Draft course created: image = http://localhost/media/course-file/draft1.jpg
2. Published copy created: image = http://localhost/media/course-file/draft1.jpg (same file)
3. Instructor edits draft: image = http://localhost/media/course-file/draft2.jpg
4. Publish draft for review: create another copy
5. OLD FILES: draft1.jpg, draft2.jpg MAY ALL remain orphaned
```

---

## 5. Storage Configuration Details

### 5.1 OptimizedLocalStorage Class (Unused)
**File**: `backend/core/storage.py` (Lines 1-200)

Despite existing, this class is **never actually integrated** with file uploads:

```python
class OptimizedLocalStorage:
    """Enhanced local file storage with optimization and organization"""
    
    def get_storage_path(self, category: str, filename: str) -> str:
        """Get organized storage path based on file category"""
        if category == 'video':
            return os.path.join('videos', filename)
        elif category == 'image':
            return os.path.join('images', filename)
        elif category == 'document':
            return os.path.join('documents', filename)
        # ...
    
    def save_file_optimized(self, file, category='other', context='general'):
        """Save file with optimization - NOT USED IN PRODUCTION"""
        # This has cleanup capability but is never called!
```

**Problem**: 
- This better storage system exists but is **not used** by `FileUploadAPIView`
- All files go to `course-file/` instead of properly organized folders
- No cleanup mechanism is integrated

### 5.2 EnhancedFileUploadAPIView (Also Unused)
**File**: `backend/api/enhanced_upload_views.py`

```python
class EnhancedFileUploadAPIView(APIView):
    """Enhanced file upload with local storage optimization"""
    # ✨ This is better than FileUploadAPIView but NOT USED
    # Routes still use FileUploadAPIView instead
```

---

## 6. Signal Handlers - What's Missing

### 6.1 Existing Signals (backend/api/models.py)
```python
@receiver(post_save, sender=Teacher)
def sync_teacher_with_profile(sender, instance, created, **kwargs):
    """Called when Teacher is saved"""
    # Syncs teacher data with profile

@receiver(post_save, sender=SearchLog)
def track_course_click(sender, instance, created, **kwargs):
    """Called when SearchLog is created"""
    # Tracks search analytics

@receiver(post_save, sender=SearchLog)
def update_search_taxonomy(sender, instance, created, **kwargs):
    """Called when SearchLog is created"""
    # Updates search taxonomy
```

### 6.2 MISSING Signal Handlers

**Signal 1: Course Image Update - Cleanup Old File**
```python
# THIS DOES NOT EXIST:
@receiver(pre_save, sender=Course)
def cleanup_old_course_image(sender, instance, **kwargs):
    """Delete old image when course image is updated"""
    try:
        old_instance = Course.objects.get(pk=instance.pk)
        if old_instance.image != instance.image:
            # Extract filename from old URL
            # Delete old file from storage
            pass
    except Course.DoesNotExist:
        pass
```

**Signal 2: Course File Update - Cleanup Old File**
```python
# THIS DOES NOT EXIST:
@receiver(pre_save, sender=Course)
def cleanup_old_course_file(sender, instance, **kwargs):
    """Delete old file when course file is updated"""
    try:
        old_instance = Course.objects.get(pk=instance.pk)
        if old_instance.file != instance.file:
            # Extract filename from old URL
            # Delete old file from storage
            pass
    except Course.DoesNotExist:
        pass
```

**Signal 3: Course Deletion - Cleanup All Files**
```python
# THIS DOES NOT EXIST:
@receiver(post_delete, sender=Course)
def cleanup_course_files(sender, instance, **kwargs):
    """Delete course files when course is deleted"""
    if instance.image:
        # Delete image file
        pass
    if instance.file:
        # Delete file
        pass
```

---

## 7. Database Cascade Delete Behavior

**File**: `backend/api/models.py` (Foreign Key Definitions)

```python
class Course(models.Model):
    category = models.ForeignKey(Category, on_delete=models.SET_NULL)
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL)
    parent_course = models.ForeignKey('self', on_delete=models.CASCADE)

class Variant(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)  # ← Cascades delete

class VariantItem(models.Model):
    variant = models.ForeignKey(Variant, on_delete=models.CASCADE)  # ← Cascades delete

class EnrolledCourse(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)  # ← Cascades delete

class Review(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)  # ← Cascades delete

class Quiz(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)  # ← Cascades delete
```

**What Cascades**: Database records only  
**What Doesn't Cascade**: Physical files on disk ❌

---

## 8. Current File Count Analysis

**Actual File System State** (as of scan):
```
backend/media/course-file/        2 files
backend/media/images/             0 files
backend/media/videos/             0 files
```

**But Wait...** The system IS working but at small scale. The problem will compound:
- Every image update = +1 orphaned file
- Every lesson update = +1 orphaned file  
- Every course deletion = +2+ orphaned files
- With 100+ courses that have multiple revisions = THOUSANDS of orphaned files

---

## 9. Root Cause Summary

| Component | Issue | Impact |
|-----------|-------|--------|
| `FileUploadAPIView` | Uploads with UUID names, returns URL | Files have unique names, hard to track |
| `CourseUpdateAPIView` | Overwrites URL without deleting old file | **Orphaned files accumulate** |
| `TeacherCourseDetailAPIView.destroy()` | Deletes DB record but not files | **Orphaned files on disk** |
| `Signals` | No cleanup handlers exist | No automatic cleanup |
| `URLField` (instead of FileField) | No Django file tracking | Manual deletion required |
| `Storage` (LocalFileSystem) | No cleanup logic | Files stay forever |
| No Admin Delete Override | Django admin has default behavior | **Orphaned files when admin deletes** |

---

## 10. Recommended Solutions

### Solution 1: Add Signal Handlers (RECOMMENDED - Quick Fix)
```python
# Add to backend/api/models.py

from django.dispatch import receiver
from django.db.models.signals import pre_save, post_delete
from django.core.files.storage import default_storage
from urllib.parse import urlparse

@receiver(pre_save, sender=Course)
def cleanup_old_course_files_on_update(sender, instance, **kwargs):
    """Delete old image/file when course is updated"""
    if not instance.pk:
        return  # Skip for new instances
    
    try:
        old_instance = Course.objects.get(pk=instance.pk)
        
        # Check if image changed
        if old_instance.image and old_instance.image != instance.image:
            # Extract file path from URL
            path = urlparse(old_instance.image).path
            if '/media/' in path:
                file_path = path.split('/media/')[-1]
                try:
                    default_storage.delete(file_path)
                except:
                    pass
        
        # Check if file changed
        if old_instance.file and old_instance.file != instance.file:
            path = urlparse(old_instance.file).path
            if '/media/' in path:
                file_path = path.split('/media/')[-1]
                try:
                    default_storage.delete(file_path)
                except:
                    pass
    except Course.DoesNotExist:
        pass

@receiver(post_delete, sender=Course)
def cleanup_course_files_on_delete(sender, instance, **kwargs):
    """Delete image and file when course is deleted"""
    # Delete image
    if instance.image:
        path = urlparse(instance.image).path
        if '/media/' in path:
            file_path = path.split('/media/')[-1]
            try:
                default_storage.delete(file_path)
            except:
                pass
    
    # Delete file
    if instance.file:
        path = urlparse(instance.file).path
        if '/media/' in path:
            file_path = path.split('/media/')[-1]
            try:
                default_storage.delete(file_path)
            except:
                pass

# Register signal
post_delete.connect(cleanup_course_files_on_delete, sender=Course)
```

### Solution 2: Management Command to Clean Orphaned Files
```python
# backend/api/management/commands/cleanup_orphaned_files.py

from django.core.management.base import BaseCommand
from api.models import Course
import os
from django.conf import settings
from urllib.parse import urlparse

class Command(BaseCommand):
    help = 'Remove orphaned files that are no longer referenced in database'
    
    def handle(self, *args, **options):
        media_root = settings.MEDIA_ROOT
        referenced_files = set()
        
        # Collect all referenced files
        for course in Course.objects.all():
            if course.image:
                path = urlparse(course.image).path
                if '/media/' in path:
                    file_path = path.split('/media/')[-1]
                    referenced_files.add(file_path)
            
            if course.file:
                path = urlparse(course.file).path
                if '/media/' in path:
                    file_path = path.split('/media/')[-1]
                    referenced_files.add(file_path)
        
        # Find and delete orphaned files
        deleted_count = 0
        for root, dirs, files in os.walk(media_root):
            for file in files:
                full_path = os.path.join(root, file)
                relative_path = os.path.relpath(full_path, media_root)
                
                if relative_path not in referenced_files:
                    try:
                        os.remove(full_path)
                        deleted_count += 1
                        self.stdout.write(f"Deleted: {relative_path}")
                    except Exception as e:
                        self.stdout.write(f"Error deleting {relative_path}: {e}")
        
        self.stdout.write(f"Total files deleted: {deleted_count}")
```

### Solution 3: Use FileField Instead of URLField
This requires database migration but provides automatic Django file cleanup.

---

## 11. Implementation Priority

**URGENT (Week 1)**:
- [ ] Add signal handlers to cleanup old files on update
- [ ] Add signal handler to cleanup files on course deletion  
- [ ] Test with course image/file updates

**IMPORTANT (Week 2)**:
- [ ] Add management command to scan for orphaned files
- [ ] Run cleanup on existing files
- [ ] Document cleanup process for admins

**NICE-TO-HAVE (Week 3+)**:
- [ ] Migrate to FileField for better tracking
- [ ] Rework enhanced upload system integration
- [ ] Add file usage dashboard to admin

---

## 12. Verification Checklist

When implementing solutions, verify:

- [ ] New course creation stores URL correctly
- [ ] Course image update deletes old file from disk
- [ ] Course file update deletes old file from disk
- [ ] Course deletion deletes both image and file from disk
- [ ] Management command finds and removes orphaned files
- [ ] No "file not found" errors in logs
- [ ] Storage space freed after cleanup

---

## 13. Conclusion

The system uploads files correctly but **has zero cleanup logic**. This creates a "one-way ratchet" where files accumulate indefinitely. The problem is solvable with signal handlers (quick fix) or by rearchitecting to use `FileField` instead of `URLField` (better long-term).

**Time to fix**: ~2-4 hours for signal handler implementation
**Estimated Orphaned Files (if system runs for 1 year)**: 1,000+
**Estimated Storage Impact**: 10-500GB depending on file sizes

