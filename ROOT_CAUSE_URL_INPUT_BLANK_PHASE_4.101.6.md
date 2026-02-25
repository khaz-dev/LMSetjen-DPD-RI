# PHASE 4.101.5-4.101.6: Root Cause Analysis - URL Input Field Always Blank

## The Problem
**User's observation**: "Masukkan URL Gambar input always blank even previously we already fill the URL Gambar"

**Impact**: 
- When user switches tabs or page reloads, the URL input field empties
- File deletion doesn't happen because `courseData.image` doesn't sync with input
- User has to re-enter URL repeatedly

---

## Root Cause

### Issue #1: No State Sync Between courseData and Input Field (CRITICAL)

**Location**: `ImageUpload.jsx`, state initialization
```javascript
const [imageUrl, setImageUrl] = useState("");  // ← Always starts EMPTY
```

**Problem**: 
- React component has TWO separate "sources of truth":
  - `courseData.image` - Persisted to database (from parent)
  - `imageUrl` - Local input field state (in ImageUpload)
- When component loads, `imageUrl` is always `""` regardless of what's in `courseData.image`
- They never sync!

**Example Flow**:
```
1. Page loads
   courseData.image = "https://drive.google.com/file/...abc123..." (from DB)
   imageUrl = ""  ← DISCONNECTED!
   
2. User clicks on "Dari URL" tab
   Input field shows: [         ] ← blank!
   
3. User sees blank field and must re-enter URL
```

### Issue #2: No Restoration After Clearing

**Location**: `ImageUpload.jsx` lines 266 & 306
```javascript
// After successful URL submission:
setImageUrl("");  // ← Clears input field
```

**Problem**:
- After user submits a URL successfully, code clears the input field (good UX - shows "done")
- But if user navigates away and back, `imageUrl` is still `""` forever
- `courseData.image` has the URL, but input field doesn't restore it

**Example Flow**:
```
1. User enters URL and clicks "Tambahkan"
2. setImageUrl("") clears the field ← ✓ Good for showing action accepted
3. courseData.image is updated ← ✓ Saved to DB
4. User navigates to another page then back
5. Component remounts with imageUrl = "" ← ✗ Lost!
6. User sees blank field again
```

### Issue #3: Upload Method Not Auto-Selected

**Location**: `ImageUpload.jsx` - no initialization logic
```javascript
const [uploadMethod, setUploadMethod] = useState(null);  // ← Never auto-selected!
```

**Problem**:
- If `courseData.image` is a URL, the "Dari URL" tab should be pre-selected
- But `uploadMethod` starts as `null` and only changes when user clicks
- So user lands on a neutral state with no input fields visible
- User must manually click "Dari URL" tab to see the input field

**Example Flow**:
```
1. Page loads, courseData.image = "https://..." (URL from DB)
2. uploadMethod = null ← no tab selected
3. No input fields visible yet
4. User must click "Dari URL" to see the input field
5. But field is still blank because imageUrl is empty
```

---

## The Solution (PHASE 4.101.6)

### Fix #1: Auto-Sync URL Input on Tab Switch

**Added**: `useEffect` that watches for `uploadMethod` changes
```javascript
useEffect(() => {
  if (uploadMethod === 'url' && courseData?.image) {
    const isLocalFile = courseData.image.includes('/media/course-file/');
    if (!isLocalFile) {
      // Restore URL from courseData.image into input field!
      setImageUrl(courseData.image);
    }
  }
}, [uploadMethod, courseData?.image]);
```

**How it works**:
- Whenever user switches to URL tab, restores the URL from `courseData.image`
- Checks if it's a local file first (won't show uploaded files in URL tab)

### Fix #2: Auto-Detect & Pre-Select Tab

**Added**: Initialization `useEffect`
```javascript
useEffect(() => {
  if (uploadMethod === null && courseData?.image) {
    const isLocalFile = courseData.image.includes('/media/course-file/');
    if (isLocalFile) {
      setUploadMethod('file');  // Auto-select file tab
    } else {
      setUploadMethod('url');   // Auto-select URL tab
    }
  }
}, [courseData?.image]);
```

**How it works**:
- On first load, auto-detects if image is URL or file
- Pre-selects the appropriate tab
- Runs whenever `courseData.image` loads (handles async loading)

### Fix #3: Added Debug Logging

**Logs show**:
- When courseData.image changes (monitoring)
- When tab switches (uploadMethod changes)
- When input field gets restored
- File deletion checks

---

## Result: How Data Now Flows

### Before (BROKEN):
```
User enters URL
    ↓
setCourseData.image = URL
    ↓
setImageUrl("") clears input
    ↓
User switches tabs
    ↓
Input field shown: [ EMPTY ]  ← No sync!
    ↓
File deletion fails (courseData.image not in input)
```

### After (FIXED):
```
User enters URL
    ↓
setCourseData.image = URL
    ↓
setImageUrl("") clears input temporarily
    ↓
useEffect runs → setImageUrl(courseData.image)
    ↓
Input field restored with URL!
    ↓
User switches tabs
    ↓
uploadMethod changes → useEffect runs
    ↓
setImageUrl(courseData.image)
    ↓
Input field shown: [ https://... ]  ← Synced!
    ↓
deleteOldFileIfLocal() sees the URL
    ↓
File deletion succeeds!
```

---

## Testing the Fix

### Test 1: Initial Load with URL Image
1. Create/edit course with URL image already set
2. Page loads
3. ✅ "Dari URL" tab should be auto-selected
4. ✅ Input field should show the URL

### Test 2: URL Submission and Retrieval
1. Enter URL in "Dari URL" tab
2. Click "Tambahkan"
3. Input field clears (shows success)
4. ✅ After ~100ms, input field shows URL again (restored by useEffect)
5. Switch to "Unggah File" tab
6. Switch back to "Dari URL" tab
7. ✅ URL should still be in input field

### Test 3: File to URL Switching
1. Upload a file (icon will be in "Unggah File" tab)
2. Click "Dari URL" tab
3. Enter a Google Drive URL
4. Click "Tambahkan"
5. ✅ Uploaded file should be deleted (deleteOldFileIfLocal sees courseData.image)
6. Switch away and back to "Dari URL"
7. ✅ URL should be in input field

### Test 4: URL to File Switching  
1. Set URL image (input shows the URL)
2. Switch to "Unggah File" tab
3. Upload a new file
4. ✅ URL should be replaced with file URL in courseData.image
5. Switch to "Dari URL" tab
6. ✅ Input field should be blank (local files don't show in URL tab)
7. Switch back to "Unggah File" tab
8. ✅ File should be visible as preview

---

## Code Changes Summary

| File | Change | Why |
|------|--------|-----|
| `ImageUpload.jsx` | Added useEffect for URL tab sync | Restore URL from courseData when switching tabs |
| `ImageUpload.jsx` | Added useEffect for auto-detection | Auto-select correct tab on first load |
| `ImageUpload.jsx` | Added monitoring useEffect | Debug logging for state changes |
| `FileUploadAPIView.post()` | Enhanced debug logging | See upload requests received |
| `FileCleanupAPIView.delete()` | Enhanced debug logging & GET endpoint | Debug file deletion, list all files |

---

## Why This Fixes the File Deletion Issue

### The Chain Reaction:
1. ✅ courseData.image syncs with input field
2. ✅ When user switches to URL tab, input field shows the file URL
3. ✅ When user clicks "Tambahkan" on new URL, deleteOldFileIfLocal() sees courseData.image
4. ✅ It detects the old file and sends DELETE request
5. ✅ Backend deletes the file!

### Before the fix:
- courseData.image = local file URL
- Input field = empty
- deleteOldFileIfLocal sees empty input (course

Data.image), thinks there's nothing to delete
- File stays on disk

---

## One-Time Setup (Debug)

To verify everything is working, test the new debug endpoint:
```bash
# See all files in media/course-file/
curl http://localhost:8001/api/v1/file-cleanup/
```

Should return:
```json
{
  "total_files": 2,
  "files": [
    {"name": "xyz123.jpg", "size_bytes": 45000, "modified": "2026-02-23T..."},
    {"name": "abc456.jpg", "size_bytes": 32000, "modified": "2026-02-23T..."}
  ]
}
```

Then watch the deletion in action - all intermediate files should disappear!

---

## Summary

**Root Cause**: Input field state (`imageUrl`) and data state (`courseData.image`) were disconnected

**Solution**: Added two `useEffect` hooks to keep them synced:
1. When user switches to URL tab, restore URL from courseData.image
2. When component loads with courseData, auto-select the correct tab

**Result**: URL stays visible, file deletion works, user experience improved!

---

**Phase**: 4.101.6 | **Status**: ✅ Complete | **Type**: Critical Bug Fix
