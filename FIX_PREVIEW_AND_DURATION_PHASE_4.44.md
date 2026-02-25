# Fix: Preview Pelajaran and Total Duration Display - PHASE 4.44

**Date**: February 20, 2026
**Status**: COMPLETE
**Issue**: Preview button not appearing and total duration showing "0m 0s" when viewing course without login

## Problem Summary

When accessing the course detail page at `/course-detail/rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif-1/` **without being logged in**, two issues were observed:

1. **"Preview Pelajaran" button not appearing** in the curriculum section
2. **Total duration showing "0m 0s"** instead of the actual video duration

## Root Cause Analysis

### Issue 1: Preview Button Not Appearing

**Frontend Code** (`CourseDetail.jsx` line 564):
```jsx
{item.preview && (
  <small 
    className="badge bg-primary ms-2"
    role="button"
    onClick={() => handlePreviewClick(item)}
  >
    <i className="fas fa-eye me-1"></i>
    Preview
  </small>
)}
```

The button only renders when `item.preview === true`.

**Database Issue Found**:
- VariantItem with ID `272613` (lesson "Pengenalan Design Thinking") had `preview = False` in the database
- Result: Preview button was never rendered, even for preview-enabled courses

**Database Query Results**:
```
Course: Rabuan IV - Design Thinking...
Variant: Pengantar Kursus (Section)
  VariantItem: Pengenalan Design Thinking
    preview (in DB): False  <-- ROOT CAUSE
    duration (in DB): None  <-- ROOT CAUSE #2
```

### Issue 2: Total Duration Showing "0m 0s"

**Frontend Code** (`CourseDetail.jsx` line 503):
```jsx
<h6 className="fw-bold mb-1" style={{ color: "#ffc107", fontSize: "0.95rem" }}>
  {calculateTotalDuration(course?.lectures || []).formatted}
</h6>
```

Duration calculation uses the `content_duration` property, which depends on the `duration` field.

**Duration Utils** (`durationUtils.js`):
```javascript
export const calculateTotalDuration = (items, durationKey = 'content_duration') => {
    if (!items || !Array.isArray(items) || items.length === 0) {
        return {
            formatted: "0m 0s",  // Default when no items
            withJP: "0m 0s (0JP)"
        };
    }
    // ... calculate from items with content_duration property
};
```

**VariantItem Model** (`models.py`):
```python
@property
def content_duration(self):
    """Convert duration to human-readable format"""
    if self.duration:
        total_seconds = int(self.duration.total_seconds())
        minutes, seconds = divmod(total_seconds, 60)
        return f"{minutes}m {seconds}s"
    return "0m 0s"  # <-- Returns "0m 0s" when duration is None
```

**Database Issue Found**:
- VariantItem `duration` field was `None` (null)
- Result: `content_duration` property returns "0m 0s" instead of actual duration

## Solutions Applied

### Fix 1: Enable Preview for First Lesson

Updated the VariantItem in the database:
```python
variant_item.preview = True
variant_item.save()
```

**Result**: Preview flag now returns `True` in API response, enabling the frontend button to render.

### Fix 2: Extract and Set Video Duration from Google Drive URL

Used `extract_video_duration_from_url()` utility to extract video metadata:

```python
from datetime import timedelta
from api.url_utils import extract_video_duration_from_url

duration_info = extract_video_duration_from_url(
    "https://drive.google.com/file/d/10laEVwlMKifam8s1jpMmf0GLhaIFap4k/view?usp=sharing"
)
# Result: {'duration_seconds': 104.066, 'error': None}

variant_item.duration = timedelta(seconds=104.066)
variant_item.save()
```

**Result**: VariantItem now has `duration: 1m 44s`, so total course duration displays correctly.

### Fix 3: Unicode Logging Issue

Fixed logging error in `url_utils.py` that was causing encoding issues:

**Before** (line 16):
```python
logger.info("✓ [url_utils.py] yt-dlp successfully imported at module load time")
logger.warning(f"✗ [url_utils.py] yt-dlp not installed: ...")
```

**After**:
```python
logger.info("[OK] [url_utils.py] yt-dlp successfully imported at module load time")
logger.warning(f"[FAIL] [url_utils.py] yt-dlp not installed: ...")
```

**Reason**: Windows PowerShell console (cp1252 encoding) couldn't handle Unicode checkmark characters. Replaced with ASCII alternatives.

## Verification Results

### API Response Test
```
GET /api/v1/course/course-detail/rabuan-iv-design-thinking-kunci-asn-inovatif-dan-birokrasi-yang-lebih-adaptif-1/

Response:
{
  "curriculum": [
    {
      "title": "Pengantar Kursus",
      "variant_items": [
        {
          "title": "Pengenalan Design Thinking",
          "preview": true,           <-- FIXED: was False
          "content_duration": "1m 44s"  <-- FIXED: was "0m 0s"
        }
      ]
    }
  ],
  "lectures": [
    {
      "title": "Pengenalan Design Thinking",
      "preview": true,              <-- FIXED
      "content_duration": "1m 44s"  <-- FIXED
    }
  ]
}
```

### Frontend Display Test

**Before Fix**:
- Preview button: NOT VISIBLE ❌
- Total Duration: "0m 0s" ❌

**After Fix**:
- Preview button: VISIBLE ✅
- Duration in badge: "1m 44s" ✅
- Total course duration: "1m 44s" ✅

## Files Modified

### 1. Database Updates (Direct SQL/ORM)
- **Model**: `api.models.VariantItem` (ID: 272613)
  - `preview`: False → True
  - `duration`: None → timedelta(seconds=104.066)

### 2. Code Changes
- **File**: [backend/api/url_utils.py](backend/api/url_utils.py)
  - **Lines**: 16-17
  - **Change**: Replaced Unicode checkmark (✓✗) with ASCII ([OK]/[FAIL])
  - **Reason**: Windows encoding compatibility

### 3. No Frontend Code Changes Needed
The frontend code was already correct - it was just waiting for the `preview=True` flag and valid duration data from the API.

## How This Works (System Design)

1. **Database Layer**: VariantItem stores `preview` boolean and `duration` DurationField
2. **Serialization Layer**: CourseSerializer includes VariantItem fields via VariantSerializer
3. **API Response**: Returns `preview` and `content_duration` (property) in JSON
4. **Frontend** (`CourseDetail.jsx`):
   - Checks `if (item.preview)` to conditionally render preview button
   - Uses `calculateTotalDuration(course?.lectures)` to aggregate course duration

## Lessons Learned

### For Other Courses

If other courses have the same issue:

1. **Check database** for lessons with `preview=False` that should be accessible to non-logged-in users
2. **Set preview=True** for at least the first lesson or any demo content
3. **Extract duration** using:
   ```python
   from api.url_utils import extract_video_duration_from_url
   duration_info = extract_video_duration_from_url(url)
   ```

### Recommended Practice

When creating lessons via admin panel or API:
1. Mark at least one lesson as `preview=True` to show preview button
2. Always extract/set `duration` field for accurate total course time display
3. Use `extract_video_duration_from_url()` for YouTube, Google Drive, and other video URLs

## Implementation Notes

- **yt-dlp** is used for video metadata extraction and was already working correctly
- Duration extraction supports: YouTube, Google Drive, direct video files (MP4, WebM, etc.)
- The fix is backwards compatible - no API schema changes needed
- No database migrations needed - fields already exist

## Testing Checklist

- [x] Preview button appears when `preview=True`
- [x] Total duration displays correctly (not "0m 0s")
- [x] Duration extracts automatically from Google Drive URL
- [x] API returns correct data for unauthenticated users
- [x] No console errors (fixed Unicode issue)
- [x] Frontend renders without issues

---

**Status**: ✅ COMPLETE AND VERIFIED

The course now displays properly without authentication, showing:
- Preview Pelajaran button in the curriculum
- Correct total duration (1m 44s)
- All content accessible to public viewers
