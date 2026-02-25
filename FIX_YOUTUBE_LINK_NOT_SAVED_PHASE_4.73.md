# Fix: YouTube Link Not Being Saved in Curriculum Draft - PHASE 4.73

## Problem Summary

When instructors click "Link YouTube" and enter a YouTube URL in the curriculum edit page, clicking "Simpan Draf" (Save Draft) does not save the YouTube link. The link disappears after save, even though the page shows it as entered.

### Root Cause

The backend's `CourseUpdateAPIView.update_variant()` method was **only handling the `file` field** from FormData, but ignoring the `youtube_link` field.

**Frontend sends:**
```javascript
// Line 2700-2701 in CourseEditCurriculum.jsx
if (item.youtubeLink) {
    formData.append(`variants[${variantIndex}][items][${itemIndex}][youtube_link]`, item.youtubeLink);
}
```

**Backend expected:**
The backend only extracted and checked `item_data.get("file", "")` but never checked for `item_data.get("youtube_link", "")`

## Solution

Modified `backend/api/views.py` in the `CourseUpdateAPIView.update_variant()` method to:

1. **Extract `youtube_link` field** from request data
2. **Prioritize YouTube links** - if a YouTube link is provided, use it as the file URL
3. **Fall back to regular file field** - if no YouTube link, check for regular file/Google Drive links
4. **Store in same field** - Both YouTube and Google Drive links go into the `VariantItem.file` field (URLField)

### Code Change

**Location:** `backend/api/views.py` lines 3755-3783 (in `update_variant` method)

**Before:**
```python
item_file = item_data.get("file", "")
# ... no youtube_link handling

# Handle file data
if item_file and str(item_file) not in ["null", "undefined", ""]:
    if str(item_file).startswith(("http://", "https://")):
        file = item_file  # URL from file-upload API
    else:
        file = item_file  # Direct file upload
else:
    file = None
```

**After:**
```python
item_file = item_data.get("file", "")
item_youtube_link = item_data.get("youtube_link", "")  # ✨ PHASE 4.73: Handle YouTube link separately

# ... rest of code ...

# ✨ PHASE 4.73: Handle file data - prioritize YouTube link if present
file = None
if item_youtube_link and str(item_youtube_link) not in ["null", "undefined", ""]:
    # YouTube link provided - use it as the file URL
    file = item_youtube_link
    print(f"[Curriculum Update] Using YouTube link for item: {item_youtube_link[:50]}...")
elif item_file and str(item_file) not in ["null", "undefined", ""]:
    # Regular file or Google Drive link
    if str(item_file).startswith(("http://", "https://")):
        file = item_file  # URL from file-upload API
    else:
        file = item_file  # Direct file upload
    print(f"[Curriculum Update] Using file/Google Drive link for item: {item_file[:50]}...")
else:
    file = None
```

## How It Works

### Storage Architecture

Both **YouTube links** and **Google Drive links** are stored in the same `VariantItem.file` field:
- YouTube: `https://www.youtube.com/watch?v=jEQHYSdzEdg`
- Google Drive: `https://drive.google.com/file/d/FILE_ID/view`

### Detection on Load

When loading curriculum, the frontend detects the link type:

```javascript
// Line 2760-2772 in CourseEditCurriculum.jsx
const isYouTubeLink = fileUrl.includes('youtube.com') || fileUrl.includes('youtu.be');

return {
    // ... other fields ...
    gdriveLink: !isYouTubeLink ? fileUrl : '',  // Non-YouTube files
    youtubeLink: isYouTubeLink ? fileUrl : '',  // YouTube URLs
};
```

### Priority Logic

When both fields are present (edge case), **YouTube link takes priority**:
```
If youtube_link is provided → use youtube_link
Else if file is provided → use file  
Else → No media link
```

## Testing Steps

### Test 1: Save YouTube Link in Draft

**Steps:**
1. Go to `http://localhost:5174/instructor/edit-course/[course_id]/curriculum/`
2. In a lesson, click "Link YouTube" button
3. Enter a YouTube URL: `https://www.youtube.com/watch?v=jEQHYSdzEdg`
4. Click "Simpan Draf" (Save Draft) button
5. Wait for success message
6. Refresh the page (F5)

**Expected Result:**
- ✅ YouTube link is shown in the lesson after refresh
- ✅ The preview card shows the YouTube link with "Buka di YouTube" button
- ✅ Duration is extracted automatically (e.g., "11m 22s")

**Console Output (Backend):**
```
[Curriculum Update] Using YouTube link for item: https://www.youtube.com/watch?v=...
```

### Test 2: Mix YouTube and Google Drive Links

**Steps:**
1. Create multiple lessons:
   - Lesson 1: YouTube link `https://youtu.be/VIDEO_ID`
   - Lesson 2: Google Drive link `https://drive.google.com/file/d/FILE_ID/view`
   - Lesson 3: Both (only YouTube should be used)
2. Save draft
3. Refresh the page

**Expected Result:**
- ✅ Lesson 1: Shows YouTube link
- ✅ Lesson 2: Shows Google Drive link
- ✅ Lesson 3: Shows YouTube link (takes priority)

### Test 3: Edit Existing YouTube Lesson

**Steps:**
1. Open a lesson that already has a YouTube link saved from Test 1
2. Change the YouTube URL to a different video
3. Click "Simpan Draf"
4. Refresh the page

**Expected Result:**
- ✅ New YouTube URL is saved
- ✅ Old URL is replaced (not duplicated)

### Test 4: Remove YouTube Link

**Steps:**
1. Open a lesson with a YouTube link
2. Click "Hapus Link" (Delete Link) button
3. Click "Simpan Draf"
4. Refresh the page

**Expected Result:**
- ✅ YouTube link is removed
- ✅ Preview card disappears
- ✅ Media source selector shows no selection

### Test 5: Draft vs Published Course

**Steps:**
1. Save curriculum as draft for an unpublished course
2. Add YouTube link, save draft, refresh - Should work ✅
3. Request admin review (go to main course edit, click "Ajukan Review")
4. **NOTE:** Do NOT test published course editing yet - that requires admin approval flow

**Expected Result:**
- ✅ YouTube links saved in draft courses
- ✅ YouTube links preserved when moving to "Review" status

## Browser Console Validation

When save succeeds, you should see in browser console:

```javascript
// FormData being sent (line 2726 in CourseEditCurriculum.jsx)
FormData entries: [
  ["variants[0][items][0][title]", "Test Lesson"],
  ["variants[0][items][0][description]", "..."],
  ["variants[0][items][0][youtube_link]", "https://www.youtube.com/watch?v=jEQHYSdzEdg"],
  // ... other fields ...
]
```

## Database Verification

After saving, verify the database:

```bash
# SSH into backend container or Django shell
python manage.py shell

from api.models import VariantItem
item = VariantItem.objects.filter(title='Your Test Lesson').first()
print(item.file)  # Should show the YouTube link
```

## Backward Compatibility

✅ **Fully backward compatible** - No database migrations needed
- Existing Google Drive links stored in `file` field work unchanged
- New YouTube links also stored in `file` field
- Frontend auto-detects link type on load

## Performance Impact

✅ **No performance impact**
- Only added one extra `item_data.get("youtube_link", "")` call
- No additional database queries
- No additional API calls

## Related Files Modified

| File | Change | Type |
|------|--------|------|
| `backend/api/views.py` | Added `youtube_link` field handling in `update_variant()` | ✨ PHASE 4.73 |
| `frontend/src/views/instructor/CourseEditCurriculum.jsx` | No change needed (already sends `youtube_link`) | Existing |
| `backend/api/models.py` | No change needed (uses single `file` field) | Existing |
| `backend/api/serializer.py` | No change needed (returns `file` field) | Existing |

## Deployment Notes

1. **No database migrations** - No schema changes
2. **Backend-only fix** - Frontend code already correct
3. **Testing needed** - Follow testing steps above before production deployment
4. **Backward safe** - Existing courses unaffected

## Future Improvements (Optional)

Consider for future phases:
- Add separate `youtube_link` field to VariantItem model for clarity
- Add `file_type` field to distinguish YouTube/Google Drive/Local
- Enhanced duration extraction for YouTube (already works via `extract_video_duration_from_url`)

---

**Status:** FIXED ✅  
**Phase:** 4.73  
**Date:** February 22, 2026  
**Severity:** Medium (Feature doesn't work)  
**Impact:** All instructors using YouTube links in curriculum
