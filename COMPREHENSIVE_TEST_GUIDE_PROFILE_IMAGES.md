# 🧪 Comprehensive Test Guide: Instructor Profile Image Fix

## Summary of Changes
✅ **Backend**: Fixed 3 serializers to return default image when user has no profile picture  
✅ **Frontend**: Added `/images/` path validation to imageUtils  
✅ **Default Avatar**: Uses existing `default-instructor.svg` (blue gradient with briefcase)  

---

## Test Environment Setup

### Prerequisites
- Django backend running on `http://127.0.0.1:8001`
- React frontend running on `http://localhost:5174` (dev) or `http://localhost:3000` (prod)
- Firefox or Chrome with developer tools

### Before Testing
```bash
# Backend terminal
cd backend
python manage.py runserver  # or already running

# Frontend terminal (separate terminal)
cd frontend
npm run dev  # or already running
```

---

## Manual Testing Scenarios

### Test Case 1: Instructor Without Profile Image

**Setup**:
1. Create a test instructor account (if not already exists)
2. DO NOT upload a profile image

**Test Steps**:

```
1. Navigate to: http://localhost:5174/instructor/dashboard/
   Expected: 
   ✅ Header shows BLUE GRADIENT SVG AVATAR (not blank)
   ✅ No console errors
   ✅ Briefcase icon visible in avatar

2. Navigate to another page and back to dashboard
   Expected:
   ✅ Avatar still shows correctly (no flashing to blank)

3. Open browser DevTools (F12)
   Expected:
   ✅ No warnings: "Invalid image URL detected"
   ✅ Network tab shows `/images/placeholders/default-instructor.svg` loaded
   ✅ Status 200 (not 404)
```

**API Test**:
```bash
# In terminal or Postman
curl http://127.0.0.1:8001/api/v1/teacher/profile/1/

Expected response:
{
  "id": 1,
  "image": "/images/placeholders/default-instructor.svg",  ✅ DEFAULT PATH
  "full_name": "Instructor Name",
  ...
}
```

---

### Test Case 2: Instructor With Profile Image (Custom URL)

**Setup**:
1. Create instructor with custom image URL
2. In Django shell: `Teacher.objects.create(user=user, image="https://example.com/avatar.jpg")`

**Test Steps**:

```
1. Navigate to: http://localhost:5174/instructor/dashboard/
   Expected:
   ✅ Shows custom image
   ✅ No fallback SVG visible

2. Open DevTools Network tab
   Expected:
   ✅ Request to https://example.com/avatar.jpg
   ✅ Status 200 (successful load)
```

**API Test**:
```bash
curl http://127.0.0.1:8001/api/v1/teacher/profile/1/

Expected response:
{
  "id": 1,
  "image": "https://example.com/avatar.jpg",  ✅ CUSTOM URL
  "full_name": "Instructor Name",
  ...
}
```

---

### Test Case 3: Course Instructor Card

**Setup**:
1. Navigate to course detail page with instructor info

**Test Steps**:

```
1. Scroll to "Instructor" section
   Expected:
   ✅ Shows instructor avatar (default SVG or custom image)
   ✅ Name displays correctly
   ✅ Stats display (students, rating, courses)

2. Click "View Profile"
   Expected:
   ✅ Navigates to instructor profile page
   ✅ Avatar displayed correctly
```

---

### Test Case 4: Instructor Profile Page

**Setup**:
1. Go to instructor profile page
2. Instructor without picture setup

**Test Steps**:

```
1. Load profile page: http://localhost:5174/instructor/profile/
   Expected:
   ✅ Avatar section shows DEFAULT SVG
   ✅ Text input field for avatar upload is visible
   ✅ "No profile image yet" message not shown (SVG is shown)

2. Click "Upload Photo"
   Expected:
   ✅ File picker opens
   ✅ Can select image file

3. Select an image file
   Expected:
   ✅ Image cropping modal appears
   ✅ Can crop and save image
   ✅ After saving, page shows uploaded image

4. Click "Delete Photo" (if visible)
   Expected:
   ✅ Reverts to DEFAULT SVG
   ✅ No console errors
```

**Console Check During These Steps**:
```
Expected in Console:
✅ No warnings about "Invalid image URL"
✅ No 404 errors for images
✅ No "Cannot read property 'url'" errors
```

---

### Test Case 5: Search Results

**Setup**:
1. Student searches for courses by instructor

**Test Steps**:

```
1. Navigate to: http://localhost:5174/courses/
2. View instructor cards in search results
   Expected:
   ✅ Each instructor card shows avatar (default or custom)
   ✅ No blank images
   ✅ Professional appearance
```

---

### Test Case 6: Browser Compatibility

**Test on Different Browsers**:

```
Chrome:      ✅ Test Case 1-5
Firefox:     ✅ Test Case 1-5
Safari:      ✅ Test Case 1-5
Edge:        ✅ Test Case 1-5
```

---

## Performance Tests

### Load Time Test
```
1. Open DevTools → Network tab
2. Load instructor dashboard
3. Check:
   ✅ SVG file size < 2KB (very fast)
   ✅ Load time < 100ms
   ✅ No waterfall cascades
```

### Multiple Instructor Load Test
```
1. Search results with 20+ instructor cards
   Expected:
   ✅ All avatars load correctly
   ✅ No 404 errors
   ✅ Page loads smoothly (< 2s)
```

---

## Edge Cases & Error Handling

### Edge Case 1: Empty Image Field
```python
# Database has empty image field
teacher.image = ""
```
**Expected**: Default SVG shown ✅

### Edge Case 2: Null Image Field
```python
# Database has null image
teacher.image = None
```
**Expected**: Default SVG shown ✅

### Edge Case 3: Whitespace Image Field
```python
# Database has only spaces
teacher.image = "   "
```
**Expected**: Default SVG shown ✅

### Edge Case 4: Broken Custom URL
```python
# Image URL points to missing resource
teacher.image = "https://example.com/missing.jpg"
```
**Expected**: Frontend tries to load, fails, shows fallback SVG in Header.jsx ✅

---

## Database Inspection

### Check Existing Teachers
```bash
# Django shell
python manage.py shell
from api.models import Teacher
from api.serializer import TeacherSerializer

# Find teacher with empty image
teacher = Teacher.objects.filter(image='').first()
if teacher:
    print(f"Teacher: {teacher.full_name}")
    print(f"Image field: {repr(teacher.image)}")
    
    # Test serializer
    serializer = TeacherSerializer(teacher)
    print(f"Serialized image: {serializer.data['image']}")

exit()
```

**Expected Output**:
```
Teacher: John Doe
Image field: ''
Serialized image: /images/placeholders/default-instructor.svg  ✅
```

---

## Console Error Checklist

### Errors That Should NOT Appear
- ❌ "Cannot read property 'url' of undefined"
- ❌ "Invalid image URL detected and blocked"
- ❌ 404 error for `/images/placeholders/default-instructor.svg`
- ❌ "Failed to load image"
- ❌ Any image-related errors

### Warnings That Are OK
- ✅ Network-related warnings (non-critical)
- ✅ Dev server hot reload messages

---

## Deployment Checklist

- [ ] Backend: All 3 serializer fixes applied
- [ ] Frontend: imageUtils.js updated with /images/ pattern
- [ ] Default avatar file exists: `/frontend/public/images/placeholders/default-instructor.svg`
- [ ] No uncommitted changes in these files
- [ ] All test cases pass
- [ ] Console is clean (no image-related errors)

---

## Rollback Plan

If anything breaks:

```bash
# Revert changes
git checkout -- backend/api/serializer.py frontend/src/utils/imageUtils.js

# Restart services
python manage.py runserver  # Backend
npm run dev               # Frontend (in new terminal)

# Test to verify rollback
```

---

## Success Criteria

✅ **All items below must be true**:

1. Instructor without profile picture shows DEFAULT SVG avatar
2. Instructor with custom image shows that image
3. No 404 errors for missing profile images
4. No console warnings about invalid image URLs
5. Default avatar is professional (blue gradient SVG)
6. Works on all pages (header, courses, profile)
7. Works in all browsers (Chrome, Firefox, Safari, Edge)
8. No performance degradation
9. Database queries unchanged (same load)
10. Backward compatible (custom URLs still work)

---

## Questions to Verify

| Question | Expected Answer | Status |
|----------|-----------------|--------|
| Does instructor without image show SVG? | Yes | ✅ |
| Does instructor with custom URL show image? | Yes | ✅ |
| Are there console errors? | No | ✅ |
| Is default avatar professional? | Yes | ✅ |
| Do all components show avatar? | Yes | ✅ |
| Is performance affected? | No | ✅ |
| Works on mobile? | Yes | ✅ |
| Backward compatible? | Yes | ✅ |

---

## Testing Sign-Off

**Tester**: [Your Name]  
**Date**: February 19, 2026  
**Status**: ✅ ALL TESTS PASSED / ⚠️ Issues Found

**Issues Found** (if any):
- [ ] Issue 1: [Description]
- [ ] Issue 2: [Description]

**Sign-Off**: _____________________

---

## Next Steps After Testing
1. ✅ Update version/changelog
2. ✅ Create deployment PR
3. ✅ Deploy to production
4. ✅ Monitor for issues in production
5. ✅ Announce fix to users
