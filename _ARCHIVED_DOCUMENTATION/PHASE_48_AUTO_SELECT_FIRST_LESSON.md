# PHASE 48: Auto-Select First Lesson on Page Load

## Problem

When a user visits a course page for the first time (or when no lesson is selected), the video player area is empty with no lesson loaded. The student must manually click on a lesson to see the video player and start learning. This creates friction in the learning experience.

## Solution

Automatically select and load the first lesson from Bagian 1 (first curriculum section) when:
1. Course page loads with course data
2. No lesson is currently selected (`variantItem` is null)
3. No saved lesson exists in localStorage (not a resumed session)

When these conditions are met, the first lesson automatically displays in the video player with autoplay enabled.

## Implementation

### Code Added

**File**: `frontend/src/views/student/CourseDetail.jsx`  
**Location**: After main useEffect that calls `fetchCourseDetail()` (around line 2572)  
**Lines**: New useEffect block

```javascript
// ✨ PHASE 48 FIX: Auto-select first lesson from Bagian 1 on page load if no lesson selected
// When course data loads and user hasn't selected or resumed a lesson, automatically load the first lesson
useEffect(() => {
    // ✨ PHASE 48: Only auto-select if:
    // 1. Course data has loaded
    // 2. No lesson is currently selected (variantItem is null)
    // 3. No saved lesson in localStorage (not a resumed session)
    if (!course || variantItem) {
        return;  // Skip if no course data or lesson already selected
    }

    try {
        const savedData = localStorage.getItem("lms_current_lesson");
        if (savedData) {
            return;  // Skip if there's a saved lesson (user is resuming)
        }

        // Get first section (Bagian 1) from curriculum
        if (!course.curriculum || !Array.isArray(course.curriculum) || course.curriculum.length === 0) {
            return;  // No curriculum available
        }

        const firstSection = course.curriculum[0];
        const sectionItems = firstSection.variant_items || firstSection.items || [];
        
        if (sectionItems.length === 0) {
            return;  // No lessons in first section
        }

        const firstLesson = sectionItems[0];
        
        if (firstLesson && firstLesson.variant_item_id) {
            console.log(`[CourseDetail.PHASE_48] 🎬 Auto-selecting first lesson: ${firstLesson.title}`);
            handlePlayLessonWithAutoplay(firstLesson);
        }
    } catch (error) {
        console.warn('[CourseDetail.PHASE_48] Error auto-selecting first lesson:', error);
        // Silently continue - this is not critical functionality
    }
}, [course]);  // Only re-run when course data arrives
```

## How It Works

### Step-by-Step Execution

1. **Page Load**:
   - Course detail page mounts
   - `fetchCourseDetail()` is called in initial useEffect
   - Course data loads from API

2. **Auto-Select Trigger**:
   - New useEffect watches `course` state
   - When course data arrives, effect executes

3. **Guard Checks**:
   - Verify course data exists (`!course` returns if null)
   - Verify no lesson already selected (`variantItem` returns if not null)
   - Check localStorage for saved lesson (returns if found - user is resuming)

4. **Get First Lesson**:
   - Access `course.curriculum[0]` (first section/Bagian)
   - Get `variant_items` or `items` from first section
   - Extract `sectionItems[0]` (first lesson)

5. **Auto-Load**:
   - Call `handlePlayLessonWithAutoplay(firstLesson)`
   - This sets:
     - `variantItem` = first lesson data
     - `autoplayVideo` = true
     - Saves to localStorage for resume
   - Video player displays immediately with autoplay

### Guard Conditions

The implementation has safety guards to prevent unintended behavior:

```
Condition 1: !course → Skip (no data yet)
Condition 2: variantItem → Skip (lesson already selected)
Condition 3: localStorage has saved lesson → Skip (user resuming)
Condition 4: !curriculum or empty → Skip (no lessons available)
Condition 5: !variant_item_id → Skip (invalid lesson)
```

All conditions must pass for auto-selection to occur.

## Behavior

### Before Fix

- Page loads with empty video player area
- No lesson selected
- User must click a lesson to start
- Confusing for first-time users

### After Fix

- Page loads with first lesson auto-selected
- Video player displays immediately
- Video shows first lesson title and content
- Autoplay starts (depending on browser policy)
- User can click other lessons to switch
- Resume functionality still works (saved lessons not overwritten)

## Edge Cases Handled

### 1. Hard Refresh (Resume Session)
```javascript
// User watches lesson, hard refreshes page
// localStorage has "lms_current_lesson"
const savedData = localStorage.getItem("lms_current_lesson");
if (savedData) {
    return;  // ✅ Skip auto-select, restore saved lesson instead
}
```

### 2. No Lessons Available
```javascript
if (!course.curriculum || course.curriculum.length === 0) {
    return;  // ✅ Skip if no curriculum
}

if (sectionItems.length === 0) {
    return;  // ✅ Skip if first section has no lessons
}
```

### 3. Lesson Already Selected by User
```javascript
if (variantItem) {
    return;  // ✅ Skip if user manually selected a lesson
}
```

### 4. Invalid Lesson Data
```javascript
if (firstLesson && firstLesson.variant_item_id) {
    handlePlayLessonWithAutoplay(firstLesson);
} else {
    return;  // ✅ Skip if no variant_item_id
}
```

## Testing

### Test Case 1: First Page Load (Fresh Enrollment)

**Setup**:
1. Login as student
2. Clear localStorage: `localStorage.clear()`
3. Navigate to course page: `http://localhost:5174/student/courses/124632/`

**Expected Result** ✅:
- Page loads
- Video player visible with first lesson title
- First lesson from Bagian 1 displayed
- Timer shows 00:00 (ready to play)
- Browser console shows: `🎬 Auto-selecting first lesson: [Lesson Title]`

### Test Case 2: Manual Lesson Selection

**Steps**:
1. From Test Case 1, click on a different lesson in the list
2. Observe video player updates

**Expected Result** ✅:
- Video player switches to selected lesson
- No double-loading or conflicts
- Manual selection overrides auto-selection

### Test Case 3: Hard Refresh (Resume)

**Setup**:
1. Navigate to course and let first lesson play for 5+ seconds
2. Hard refresh page (Ctrl+F5)

**Expected Result** ✅:
- Page loads
- Same lesson restored from localStorage
- Video resumes from saved position (not restarted)
- No auto-reselection to new first lesson

### Test Case 4: Multiple Bagian/Variants

**Setup**:
1. Course has multiple Bagian (sections)
2. Each Bagian has multiple lessons
3. Fresh page load

**Expected Result** ✅:
- First lesson of first Bagian selected (curriculum[0].variant_items[0])
- Not first lesson of second Bagian
- Not last lesson of first Bagian

### Test Case 5: Empty First Bagian

**Setup**:
1. Course where first Bagian has 0 lessons
2. Second Bagian has lessons
3. Fresh page load

**Expected Result** ✅:
- No auto-selection (first Bagian empty)
- Video player remains empty
- User can manually select from other Bagian

## Browser Console Log

When auto-selection occurs:

```
[CourseDetail.PHASE_48] 🎬 Auto-selecting first lesson: Pengenalan Design Thinking
```

If error occurs (rare):

```
[CourseDetail.PHASE_48] Error auto-selecting first lesson: [error details]
```

## Performance Impact

**Minimal**:
- One additional useEffect watching `course` state (lightweight)
- Executes only when course data arrives (not on every render)
- Uses existing `handlePlayLessonWithAutoplay()` function (no new API calls)
- Simple guard checks (O(1) complexity)

## Backward Compatibility

✅ **Fully backward compatible**:
- Resume functionality unaffected (localStorage check prevents override)
- Manual lesson selection unaffected (variantItem check prevents override)
- Existing lessons/progress data preserved
- No database changes
- No API changes

## Benefits

1. **Better UX**: First lesson immediately visible on page load
2. **Lower Friction**: No empty state - student can see content immediately
3. **Engagement**: Auto-play encourages student to start learning
4. **Accessibility**: Clearer for new students where to start
5. **Smart**: Respects saved sessions (doesn't override resume)

## Related Code

- **handlePlayLessonWithAutoplay()**: Line 985 - Sets lesson with autoplay
- **Course data structure**: `course.curriculum[].variant_items[]` - Array of lessons
- **localStorage**: "lms_current_lesson" - Saved lesson for resume
- **variantItem state**: Tracks currently selected lesson

## Technical Details

### Dependency Array
```javascript
}, [course]);  // Only re-run when course data arrives
```
- Watches only `course` state
- Re-evaluates when course data refreshed
- No unnecessary re-evaluations

### Safe Data Access
```javascript
const sectionItems = firstSection.variant_items || firstSection.items || [];
```
- Supports both `variant_items` and `items` field names
- Gracefully handles missing data
- No undefined access errors

### Error Handling
```javascript
try {
    // Auto-select logic
} catch (error) {
    console.warn('[...] Error auto-selecting first lesson:', error);
    // Silently continue - not critical
}
```
- Wrapped in try-catch
- Logs errors for debugging
- Doesn't break if error occurs

## Files Modified

1. **frontend/src/views/student/CourseDetail.jsx**
   - Added useEffect after line 2572
   - No modifications to existing code
   - ~40 lines of new code with comments

## Success Criteria

✅ **Phase 48 is complete when**:
- [x] Identified need for auto-selection logic
- [x] Implemented useEffect to auto-select first lesson
- [x] Added guard conditions for edge cases
- [x] Respects saved lessons (resume functionality)
- [x] Respects manual selection
- [x] Handles empty curriculum gracefully
- [x] Has comprehensive logging
- [x] No errors in console
- [x] Backward compatible

---

**Phase**: 48  
**Status**: ✅ COMPLETE  
**Feature**: Auto-select first lesson on page load  
**Complexity**: LOW (lightweight useEffect)  
**Risk**: MINIMAL (guarded, non-intrusive)  
**Lines Added**: ~40 (including comments)
