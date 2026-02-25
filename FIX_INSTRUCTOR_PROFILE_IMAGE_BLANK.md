# Fix: Blank Instructor Profile Images

## Root Cause Analysis

**Problem**: Instructor profile images show as blank/broken when users don't have a profile picture uploaded.

### Issue #1: Backend Serializer Bug (Primary Culprit)
**Location**: `backend/api/serializer.py` lines 422-429 (TeacherSerializer.get_image())
- The `image` field in Teacher model is a URLField (not FileField)
- Serializer tries to access `.url` attribute which doesn't exist on URLField
- Returns `None` instead of the actual URL string
```python
# WRONG CODE:
def get_image(self, obj):
    if obj.image and hasattr(obj.image, 'url'):  # URLField has no .url!
        return request.build_absolute_uri(obj.image.url)  
    return None
```

### Issue #2: Similar Problem in ProfileSerializer
**Location**: `backend/api/serializer.py` lines 221-230
- Same issue: trying to access `.url` on URLField

### Issue #3: Frontend Missing Default Fallback
**Location**: `frontend/src/views/instructor/Partials/Header.jsx` line 196
- When image URL is empty string or null, frontend SVG fallback displays
- But improved default image would be better

## Solution

### Step 1: Fix Backend Serializers
- Allow URLField values to pass through directly (they're already URLs)
- Add default profile image URL when image is empty/null
- Create a proper mechanism to serve default avatars

### Step 2: Create Default Profile Image Endpoint  
- Backend endpoint to serve default profile images by role
- Frontend can use this endpoint as fallback

### Step 3: Update Frontend
- Ensure proper fallback handling
- Use default image URL from backend when image is missing
- Already has SVG fallback, but can be improved

## Files to Modify
1. `backend/api/serializer.py` - TeacherSerializer (line 422)
2. `backend/api/serializer.py` - ProfileSerializer (line 221)
3. `backend/api/models.py` - Add default image URL helper
4. `frontend/src/views/instructor/Partials/Header.jsx` - Already has fallback
5. `frontend/src/views/base/components/CourseInstructor.jsx` - Already has fallback

## Implementation Priority
1. **HIGH**: Fix serializers to return actual URL strings
2. **HIGH**: Add default profile image logic
3. **MEDIUM**: Add backend endpoint for default images
4. **LOW**: Enhance frontend display
