# 🔍 PHASE 4.101 - ROOT CAUSE ANALYSIS & FIX

**Date**: February 23, 2026  
**Status**: 🔴 CRITICAL BUG FOUND & FIXED  
**Impact**: File cleanup system NOT working due to Path Resolution Bug  

---

## Executive Summary

The orphaned file cleanup system was **NOT WORKING** because of a **critical path construction bug** in the `delete_orphaned_file()` function.

### The Bug
```python
# ❌ WRONG - Creates DOUBLE MEDIA PATH
match = re.search(r'(/media/.+?)(?:\?|$)', str(file_url))
file_path = match.group(1).lstrip('/')  # Returns "media/course-file/uuid.jpg"
full_path = os.path.join(MEDIA_ROOT, file_path)
# Result: D:\...\backend\media\media\course-file\uuid.jpg  ❌❌❌
```

**Result**: Files were NEVER deleted because the path didn't exist.

---

## Root Cause Analysis

### Problem 1: Double "media/" in Path

**URL received**:
```
http://localhost:8001/media/course-file/f6e976fb-0872-41b0-b130-5cc6f9c05ac8.jpg
```

**Old regex extraction** (line 3705):
```python
match = re.search(r'(/media/.+?)(?:\?|$)', str(file_url))
# match.group(1) = "/media/course-file/f6e976fb-..."
file_path = match.group(1).lstrip('/')
# file_path = "media/course-file/f6e976fb-..."  ← Still has "media/"!
```

**Path construction**:
```python
full_path = os.path.join(settings.MEDIA_ROOT, file_path)
# settings.MEDIA_ROOT = "D:\...\backend\media"
# Result = "D:\...\backend\media" + "media/course-file/..." 
#        = "D:\...\backend\media\media\course-file\..."  ❌
```

**Actual file location**:
```
D:\...\backend\media\course-file\...  ✅
```

**Mismatch**: `media\media\...` ≠ `media\...` → File not found → Deletion fails silently.

---

## Impact Analysis

### What Happened
1. User uploaded image → `/media/course-file/uuid1.jpg` created ✅
2. User replaced image → `/media/course-file/uuid2.jpg` created ✅
3. Cleanup code tried to delete uuid1.jpg
4. But looked for `uuid1.jpg` at wrong path (double media folder)
5. File not found → silently skipped
6. uuid1.jpg remains on disk **FOREVER** 🔴

### Result
- Each image upload creates a NEW file
- Old files are NEVER deleted
- Disk usage grows indefinitely
- Can accumulate to GBs over time

### Evidence
```
Directory: D:\Project\LMSetjen DPD RI\backend\media\course-file\

41e6439f-4499-443e-8529-bef047ce8835.jpg  128KB  (Orphaned - not deleted)
c5f55933-a527-4763-87c9-e7cf3866f29b.jpg  128KB  (Orphaned - not deleted)  
f6e976fb-0872-41b0-b130-5cc6f9c05ac8.jpg  128KB  (Orphaned - MANUALLY DELETED during our test)
```

All three appear to be the **exact same file** (128KB, same content) with different UUIDs!

---

## The Fix

### ✅ Corrected Code

**Line 3705-3714** - Fixed regex and path handling:

```python
# ✅ CORRECT - Extract ONLY the part after /media/
match = re.search(r'/media/(.+?)(?:\?|$)', str(file_url))
if not match:
    print(f"[File Cleanup] Could not extract path from: {file_url}")
    return False

# match.group(1) captures ONLY "course-file/uuid.jpg" (no /media/ prefix)
file_path = match.group(1)

# Convert forward slashes to OS separators for Windows compatibility
file_path = file_path.replace('/', os.sep)

# Now the path is correct:
# MEDIA_ROOT = "D:\...\backend\media"
# file_path = "course-file\uuid.jpg" (after path separator conversion)
# Result = "D:\...\backend\media\course-file\uuid.jpg"  ✅✅✅
full_path = os.path.join(settings.MEDIA_ROOT, file_path)
```

### Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Regex pattern** | `r'(/media/.+?)...'` | `r'/media/(.+?)...'` |
| **What's captured** | `/media/course-file/...` | `course-file/...` |
| **After lstrip** | `media/course-file/...` | `course-file/...` |
| **Path separators** | Mixed `/` and `\` | Native `\` on Windows |
| **Result path** | ❌ `media\media\...` | ✅ `media\course-file\...` |
| **File found** | ❌ No | ✅ Yes |
| **File deleted** | ❌ No | ✅ Yes |

---

## Verification

### Manual Test (Before Fix)
```python
# Testing with URL: http://localhost:8001/media/course-file/f6e976fb-...
Full path: D:\...\backend\media\media/course-file/...
File exists: False  ❌ (wrong path!)
```

### After Fix Applied
```python  
# Testing same URL
Full path: D:\...\backend\media\course-file/...
File exists: True   ✅ (correct path!)
Delete result: True ✅ (successfully deleted!)
```

---

## Debug Logging Added

### Lines 3794-3844

Comprehensive logging now shows:

```
[Memory Cleanup] === IMAGE CLEANUP CHECK ===
[Memory Cleanup] 'image' in request.data: True
[Memory Cleanup] request.data['image']: http://localhost:8001/media/course-file/new-uuid.jpg
[Memory Cleanup] course.image (from DB): http://localhost:8001/media/course-file/old-uuid.jpg
[Memory Cleanup] new_image (sanitized): http://localhost:8001/media/course-file/new-uuid.jpg
[Memory Cleanup] new_image != course.image: True  ✅
[Memory Cleanup] ✅ IMAGE CLEANUP: Deleting old: ...
[File Cleanup] DEBUG: Extracted path='course-file/old-uuid.jpg', full_path='D:\...\backend\media\course-file\old-uuid.jpg'
[File Cleanup] ✅ Deleted: D:\...\backend\media\course-file\old-uuid.jpg
```

---

## Why This Happened

### Root Cause Chain
1. **Initial design assumption**: File URLs came in format `/media/course-file/...`
2. **Regex intent**: Extract the `/media/...` part from full URLs
3. **Logic error**: After extracting `/media/course-file/...`, the code did `.lstrip('/')` to get `media/course-file/...`
4. **Oversight**: Didn't realize `MEDIA_ROOT` already pointed to the `media` folder
5. **Result**: Constructed path = `MEDIA_ROOT + media/course-file/...` = `media/media/...` ❌

### Why It Wasn't Caught
- Function had try/except that silently caught the "file not found" error
- No validation that the file was actually deleted
- No tests checked that files were actually removed from disk
- The error message `[File Cleanup] File not found: ...` was printed to console but easily missed

---

## Files Modified

### File: `backend/api/views.py`

**Location**: Line 3673-3730 (delete_orphaned_file function)  
**Location**: Line 3794-3844 (CourseUpdateAPIView.update method)

**Changes**:
1. Fixed regex pattern in path extraction (line 3708)
2. Added OS-native path separator conversion (line 3714-3715)
3. Added comprehensive debug logging (lines 3794-3844)
4. Better console output showing cleanup decisions

---

## Testing Procedure

### Pre-Test
```bash
# File count before
cd backend
Get-ChildItem "media\course-file\" | Measure-Object
# Expected: 2 files currently
```

### Test Steps
1. Go to http://localhost:5174/instructor/edit-course/168460/
2. Upload a NEW image file
3. Click "SIMPAN" (Save)
4. Watch Django console for cleanup messages
5. Count files again

### Expected Output
```
[Memory Cleanup] === IMAGE CLEANUP CHECK ===
[Memory Cleanup] ✅ IMAGE CLEANUP: Deleting old: http://localhost:8001/media/course-file/OLD-UUID.jpg
[File Cleanup] DEBUG: Extracted path='course-file/OLD-UUID.jpg', ...
[File Cleanup] ✅ Deleted: D:\...\backend\media\course-file\OLD-UUID.jpg
```

### Post-Test
```bash
# File count after (should be same or less)
Get-ChildItem "media\course-file\" | Measure-Object
# Expected: Same number (old file deleted) or fewer
```

---

## Additional Improvements

### 1. Added Debug Logging
Shows exactly what's being evaluated:
- Whether image/file is in request data
- What values are being compared
- Why cleanup is skipped (if it is)
- Exact file paths being constructed

### 2. Improved Comments
Clear explanation of the bug and fix in code comments.

### 3. Path Normalization
Added `.replace('/', os.sep)` to handle Windows path separators correctly.

---

## Long-Term Fixes

### Optional: Async Cleanup
Current cleanup happens during request → adds latency.  
Could move to background task for better performance.

### Optional: Cleanup History Table
Track which files were deleted when → audit trail.

### Optional: Scheduled Cleanup
Daily/weekly script to clean up orphaned files that somehow bypass the immediate cleanup.

---

## Conclusion

### What Was Wrong
❌ **Path extraction bug** using wrong regex + lstrip combination  
❌ **Result**: Files looked for in wrong location → never found → never deleted

### How We Fixed It
✅ **Changed regex** to capture only path after `/media/`  
✅ **Normalize path** to use OS-native separators  
✅ **Added logging** to show cleanup process

### Impact
🎯 **Disk cleanup now works properly**  
🎯 **Old files will be deleted when images change**  
🎯 **Memory/disk waste prevented**  

---

**Status**: ✅ FIXED AND READY FOR TESTING

