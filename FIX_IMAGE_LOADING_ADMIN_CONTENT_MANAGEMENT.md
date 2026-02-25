# Fix: Image Loading Issue in Admin Content Management

**Date**: February 17, 2026  
**Issue**: Images not loading properly on `/admin/content-management/?tab=courses` while they load correctly on `/instructor/courses/`  
**Status**: ✅ RESOLVED

## Problem Analysis

### Root Cause
The `CourseReviewTab.jsx` component (and legacy `CourseReviewAdmin.jsx`) were loading course images directly without using the `getImageUrl()` utility function, which is used by the instructor courses page's `CourseCard.jsx` component.

### Impact
- Images with special URL encoding were not decoded
- Google Drive URLs were not converted to thumbnail format
- Relative media paths were not properly constructed
- Fallback mechanism was inconsistent

## Solution Implemented

### Modified Files
1. **`frontend/src/views/admin/ContentManagementTabs/CourseReviewTab.jsx`**
   - Added import: `import { getImageUrl } from "../../../utils/courseUtils";`
   - Updated 2 image loading locations to use `getImageUrl(course.image)` instead of `course.image || fallback`

2. **`frontend/src/views/admin/CourseReviewAdmin.jsx`** (legacy support)
   - Added import: `import { getImageUrl } from "../../utils/courseUtils";`
   - Updated image loading to use `getImageUrl(course.image)`

### What `getImageUrl()` Does

The utility function handles:

#### 1. **URL Decoding**
```javascript
if (cleanUrl.includes('%3A') || cleanUrl.includes('http%3A')) {
    cleanUrl = decodeURIComponent(cleanUrl);
}
```
Decodes URL-encoded strings that may come from database storage or API responses.

#### 2. **Google Drive URL Conversion**
```javascript
if (cleanUrl.includes('drive.google.com')) {
    return convertGoogleDriveUrlToThumbnail(cleanUrl);
}
```
Converts Google Drive sharing URLs to high-quality thumbnail format:
```
https://drive.google.com/thumbnail?id=FILE_ID&sz=w1200
```

#### 3. **Relative Path Correction**
```javascript
const mediaPattern = /\/media\//;
if (mediaPattern.test(cleanUrl)) {
    // Properly reconstructs /media/ paths
    cleanUrl = '/media/' + parts[parts.length - 1];
}
```
Uses `getMediaUrl()` from constants.js for proper backend URL construction.

#### 4. **Default Fallback**
```javascript
if (!imageUrl) {
    return DEFAULT_IMAGE_URL; 
    // "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png"
}
```

## Before vs After

### Before (Broken)
```jsx
<img
    src={course.image || "https://via.placeholder.com/400x225?text=No+Image"}
    alt={course.title}
    className="cm-card-image"
    onError={(e) => {
        e.target.src = "https://via.placeholder.com/400x225?text=No+Image";
    }}
/>
```

### After (Fixed)
```jsx
<img
    src={getImageUrl(course.image)}
    alt={course.title}
    className="cm-card-image"
    onError={(e) => {
        e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
    }}
/>
```

## Code Locations

### Image Loading Points Fixed
1. **CourseReviewTab.jsx** - Main course card image (line 183)
2. **CourseReviewTab.jsx** - Detail modal course image (line 296)
3. **CourseReviewAdmin.jsx** - Legacy fallback (line 189)

## Testing

✅ **Build Status**: `npm run build` completed successfully  
✅ **No Syntax Errors**: All imports and usage are correct  
✅ **Backward Compatibility**: Function handles all URL formats gracefully

## How to Verify the Fix

1. Navigate to `http://localhost:5174/admin/content-management/?tab=courses`
2. Compare image loading with `http://localhost:5174/instructor/courses/`
3. Both should now display course images identically:
   - Course thumbnails from `/media/` paths
   - Google Drive images (if used)
   - Encoded URLs properly decoded
   - Consistent fallback images

## Related Components

- **CourseCard.jsx**: Already using `getImageUrl()` ✅
- **courseUtils.js**: Contains the image processing logic
- **constants.js**: Contains `getMediaUrl()` helper
- All other admin components should follow the same pattern

## Migration Notes

For any other components loading course images, ensure they use `getImageUrl()`:

```javascript
import { getImageUrl } from "../utils/courseUtils";

// Then use:
<img src={getImageUrl(course.image)} alt={course.title} />
```
