# Fix: Duration Display Showing "0m" Instead of Actual Duration (PHASE 4.43.9)

## Problem Description
On the Course Detail page's Kurikulum (Curriculum) Tab, lesson durations were displaying as "0m" or "0m 0s" instead of showing the correct duration (e.g., "1m 44s"), even though the video files were uploaded with duration metadata.

The issue appeared in **2 locations**:
1. **CurriculumTab.jsx** (line 57): Displaying `lesson.content_duration || "N/A"`
2. **CourseDetail.jsx** (lines 561, 859): Displaying `item.content_duration` in various contexts

## Root Cause Analysis

### Backend Flow
1. VariantItem model has a `duration` field (DurationField) that stores the video duration
2. `content_duration` property converts this to a formatted string like "1m 44s"
3. VariantItemSerializer includes the duration field but doesn't explicitly expose `duration_seconds` needed by frontend

### Frontend Flow (Broken)
1. CourseEditCurriculum.jsx loads the curriculum but **doesn't extract/map duration_seconds**
2. When curriculum is saved, if duration_seconds is not provided in request, backend doesn't update the duration field
3. Existing items keep null duration, showing "0m 0s"
4. Result: Any curriculum item updated without new video keeps showing "0m 0s"

## Solution Implemented

### Backend Changes (api/serializer.py)

**Added `duration_seconds` SerializerMethodField to VariantItemSerializer:**

```python
class VariantItemSerializer(serializers.ModelSerializer):
    content_duration = serializers.ReadOnlyField()  # Include the property method
    file_type = serializers.ReadOnlyField()         # Include file type property
    file_icon = serializers.ReadOnlyField()         # Include file icon property
    duration_seconds = serializers.SerializerMethodField()  # ✨ PHASE 4.43.9: Extract duration in seconds for frontend
    
    def get_duration_seconds(self, obj):
        """✨ PHASE 4.43.9: Extract duration in seconds from DurationField for frontend"""
        if obj.duration:
            return int(obj.duration.total_seconds())
        return None
```

**Benefits:**
- Backend now returns both `duration` (raw field) and `duration_seconds` (for frontend)
- Frontend can easily calculate duration without parsing complex formats
- Maintains backward compatibility by keeping all existing fields

### Frontend Changes (CourseEditCurriculum.jsx)

#### 1. **Load curriculum with duration mapping** (line ~1467)
```jsx
duration_seconds: item.duration_seconds || null,  // ✨ PHASE 4.43.9: Preserve duration_seconds from backend
duration_formatted: item.content_duration || null // ✨ PHASE 4.43.9: Also preserve formatted duration for display
```

#### 2. **Initialize new items with duration_seconds** (line ~1477, ~1872, ~1967)
```jsx
duration_seconds: null  // ✨ PHASE 4.43.9: Initialize duration_seconds for new items
```

#### 3. **Update freshVariants after submit** (line ~2374)
```jsx
duration_seconds: item.duration_seconds,  // ✨ PHASE 4.43.9: Store duration in seconds
duration_formatted: item.content_duration  // Store formatted duration for potential display
```

#### 4. **Send duration_seconds with form data** (line ~2323)
Already implemented - just requires duration_seconds to be in state:
```jsx
if (item.duration_seconds) {
    formData.append(`variants[${variantIndex}][items][${itemIndex}][duration_seconds]`, item.duration_seconds);
}
```

**Bonus:**
- handleLessonChange (line 1764) already preserves all item properties via spread operator, so duration_seconds survives any field changes

## Why This Fixes the Issue

1. **Loads duration from backend**: When curriculum items are fetched, duration_seconds is now extracted and stored in the item state
2. **Preserves during updates**: When lessons are edited, duration_seconds stays in the state because spread operator preserves it
3. **Sends to backend**: When curriculum is saved, duration_seconds is included in the form data
4. **Backend stores it**: Backend converts duration_seconds to DurationField and stores it
5. **Display shows correct value**: When course is displayed again, content_duration property calculates correct formatted string from non-null duration

## Files Modified

1. **backend/api/serializer.py** - Added `duration_seconds` field to VariantItemSerializer
2. **frontend/src/views/instructor/CourseEditCurriculum.jsx** - Updated to map, preserve, and restore duration_seconds

## Testing

To verify the fix:

1. Open the course at `http://localhost:5174/course-detail/[course-slug]`
2. Click the Kurikulum tab
3. Verify lesson durations show correct values (e.g., "1m 44s") instead of "0m"
4. Edit a lesson (change title only, don't update video)
5. Save the curriculum
6. Refresh the page
7. Verify duration still shows correctly and wasn't reset to "0m"

## API Response Example

**Before Fix:**
```json
{
  "variant_items": [{
    "id": 1,
    "title": "Lesson 1",
    "duration": "0:01:44",
    "content_duration": "1m 44s"
    // duration_seconds NOT included
  }]
}
```

**After Fix:**
```json
{
  "variant_items": [{
    "id": 1,
    "title": "Lesson 1",
    "duration": "0:01:44",
    "duration_seconds": 104,  // ← NEW: Easy for frontend to use
    "content_duration": "1m 44s"
  }]
}
```

## Related Issues Fixed
- Curriculum items losing duration when edited
- Duration showing "0m 0s" for lessons with actual videos
- Frontend unable to preserve video duration metadata

## Phase Classification
✨ **PHASE 4.43.9**: Data Integrity - Duration Metadata Preservation

---
**Status:** ✅ Implementation Complete
**Last Updated:** February 19, 2026
