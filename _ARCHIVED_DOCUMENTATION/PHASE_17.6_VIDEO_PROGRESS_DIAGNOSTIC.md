# PHASE 17.6: VIDEO PROGRESS DIAGNOSTIC GUIDE

**Date**: March 10, 2026  
**Status**: 🔍 DEEP DIAGNOSTIC IN PROGRESS  

---

## KEY FINDING: Backend API is Working ✅

I performed a comprehensive test of the backend API endpoint and **confirmed it is working perfectly**:

```
✅ POST /api/v1/student/video-progress/ → Status 201 CREATED
✅ Data saved to database successfully
✅ VideoProgress record created with all fields populated
```

**This means the issue is NOT in the backend.** The problem must be in the frontend preventing requests from being sent OR in the data being sent.

---

## New AGGRESSIVE Logging Added (PHASE 17.6)

I've updated `frontend/src/views/student/CourseDetail.jsx` with **ALWAYS-ON** comprehensive logging that tracks:

### Logged Events
1. ✅ Progress callback received
2. ✅ Early returns (isResuming, missing variantItem, missing itemId)
3. ✅ Throttle check (1000ms minimum between saves)
4. ✅ courseId lookup (from course.course.id vs localStorage fallback)
5. ✅ userId verification
6. ✅ API request details (full payload)
7. ✅ API response (status + data)
8. ✅ Lecture tab callback invocation
9. ❌ All errors with full context

### Log Output Examples

When progress save is ATTEMPTED:
```
[CourseDetail] 💾 ATTEMPT #1615892 Progress save: {
    itemId: "258650",
    currentTime: "125.30s",
    duration: "480.00s",
    percentage: "26.1%",
    ...
}
```

When courseId is RESOLVED:
```
[CourseDetail] ✓ SUCCESS: courseId from course.course.id: 47
// OR
[CourseDetail] 📦 SUCCESS: courseId from localStorage: 47
```

When API REQUEST is SENT:
```
[CourseDetail] 🔵 SENDING API REQUEST with: {
    endpoint: "/api/v1/student/video-progress/",
    user_id: 3,
    course_id: 47,
    variant_item_id: "258650",
    ...
}
```

When API SUCCEEDS:
```
[CourseDetail] ✅ API RESPONSE SUCCESS: {
    responseStatus: 201,
    responseData: {...},
    ...
}
```

When API FAILS:
```
[CourseDetail] ❌ API REQUEST FAILED: {
    errorMessage: "...",
    errorStatus: 403/401/400/500,
    errorData: {...},
    ...
}
```

---

## Step-by-Step Diagnostic Testing

### Test 1: Enable Console Logging

1. Open browser DevTools: **F12**
2. Go to **Console**tab
3. Leave DevTools open
4. Start playing a video lesson
5. **Watch the console for logs** like above

### Test 2: Play Video and Look For

1. **First 5 seconds of playing:**
   - Should see: `[CourseDetail] 💾 ATTEMPT #...` logs appearing
   - Should see courseId and userId logs
   - Should see API REQUEST log being sent

2. **If NOT seeing any logs:**
   - ❌ handleVideoProgress is NOT being called
   - ❌ Something is preventing callbacks from video player
   - Check: Is video actually playing? Can you see progress bar moving?

3. **If seeing logs but API FAILS:**
   - Check error message in `❌ API REQUEST FAILED` log
   - Look at `errorStatus` (401=auth, 403=permission, 400=validation, 500=server)
   - Look at `errorData.detail` for specific error message

4. **If API succeeds but database has no record:**
   - Check admin panel: http://localhost:8001/admin/api/videoprogress/
   - Filter by your user ID
   - Should see NEW records appearing as you play video

### Test 3: Verify Lesson Item Data

1. Open browser DevTools → **Network** tab
2. Filter for requests to: `student/course-detail`
3. Find that request, click the **Response** tab
4. Look for structure:
   ```json
   {
       "course": {
           "id": 47,
           ...
       },
       "curriculum": [
           {
               "variant_id": "...",
               "variant_items": [
                   {
                       "variant_item_id": "258650",  // <- This is key!
                       "title": "Pengenalan Design Thinking",
                       ...
                   }
               ]
           }
       ]
   }
   ```

5. **Key things to verify:**
   - ✅ "curriculum" array is not empty
   - ✅ Each curriculum item has "variant_items" array
   - ✅ Each variant_item has "variant_item_id" (string like "258650")
   - ❌ If "curriculum" is missing or empty → course data not loading properly

### Test 4: Check localStorage

1. Open browser DevTools → **Application** tab
2. Go to **Local Storage** → select your site
3. Look for: `lms_current_lesson`
4. Value should look like:
   ```json
   {
       "courseId": 47,
       "lessonId": "258650",
       "lessonData": {...},
       "savedAt": "2026-03-10T12:30:00Z"
   }
   ```

5. **If lessonId is wrong or courseId is missing:**
   - localStorage fallback won't work
   - Must use course.course.id from API

---

## Likely Root Causes (In Order of Probability)

### Cause #1: Course Data Not Loading (60% probability)
**Symptom**: Course structure is broken or curriculum is empty
**Evidence**: `course?.course?.id` is undefined AND localStorage is empty

**Test**: Check Network tab response for course-detail endpoint
**Fix**: Debug why course.course.id is undefined

### Cause #2: VariantItem ID Format Mismatch (20% probability)
**Symptom**: API returns 400 "VariantItem not found"
**Evidence**: Console shows `[CourseDetail] ❌ ERROR saving progress` with status 400

**Test**: Check console for `errorMsg.includes('not found')`
**Fix**: Ensure variant_item_id is string format like "258650", not integer

### Cause #3: Authentication/CORS Issue (10% probability)
**Symptom**: API returns 401 or 403 errors
**Evidence**: Console shows 401/403 in error logs

**Test**: Check Network tab for 401/403 responses
**Fix**: Verify JWT token is set in axios headers

### Cause #4: courseId is null from API Response (10% probability)
**Symptom**: Both `course?.course?.id` and localStorage fail
**Evidence**: `❌ CRITICAL: courseId is missing!` warning in console

**Test**: Check API response structure (Test 3 above)
**Fix**: Ensure course object structure from API is correct

---

## What to Report Back

When you test, please report:

1. **The EXACT console logs you see** (copy/paste from console)
2. **Whether API request is being sent** (check Network tab)
3. **If API fails, what error status** (401/400/500/etc)
4. **Course data structure** (check Response tab from course-detail request)
5. **Admin panel status** (any new VideoProgress records created?)

---

## Expected Behavior (After Fix)

1. Play video for 10+ seconds
2. Console shows logs like:
   ```
   [CourseDetail] 💾 ATTEMPT #... Progress save: {...percentage: "10.5%"...}
   [CourseDetail] 🔵 SENDING API REQUEST with: {...}
   [CourseDetail] ✅ API RESPONSE SUCCESS: {...}
   ```
3. Admin panel shows new VideoProgress records with progress_percentage: 10.5%
4. Lesson-item UI shows "in-progress" badge with progress bar

---

## Build Status
✅ Frontend built successfully with new logging  
✅ Ready for testing  

