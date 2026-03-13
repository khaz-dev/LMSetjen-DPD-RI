# PHASE 48: Quick Testing Guide - Auto-Select First Lesson

## Summary
First lesson from Bagian 1 now automatically loads when page first opens (if no lesson is selected or saved). This improves UX by showing content immediately instead of empty player.

## Quick Start

### 1. Restart Servers
```bash
# Terminal 1: Backend
cd "d:\Project\LMSetjen DPD RI\backend"
python manage.py runserver

# Terminal 2: Frontend
cd "d:\Project\LMSetjen DPD RI\frontend"
npm run dev
```

### 2. Test Scenario: Fresh Page Load (No Saved Lesson)

**Action**:
1. Open browser DevTools (F12)
2. Go to Application → Storage → Local Storage
3. Delete `lms_current_lesson` key if it exists
4. Navigate to: http://localhost:5174/student/courses/124632/
5. Wait for page to load

**Expected Result** ✅:
- Video player area visible (not empty)
- First lesson title displayed in video player header
- Video player shows first lesson content
- Browser console shows: `🎬 Auto-selecting first lesson: [Lesson Name]`
- Timer shows 00:00 (ready to play or paused)

**Wrong Result** ❌:
- Video player area empty
- No lesson selected
- No message in console
- Black/blank player area

---

### 3. Test Scenario: Click Different Lesson

**Action**:
1. From above, click a different lesson in the lessons list (e.g., 2nd or 3rd lesson)
2. Observe player update

**Expected Result** ✅:
- Video player switches to selected lesson
- New lesson title displayed
- No errors in console
- Can freely select any lesson

---

### 4. Test Scenario: Hard Refresh (Resume Previous Lesson)

**Setup**:
1. Navigate to course page (auto-selects first lesson)
2. Let it play for a few seconds
3. Hard refresh page (Ctrl+F5)

**Expected Behavior** ✅:
- Page loads
- SAME lesson is restored (not reset to first lesson)
- Video resumes from saved position
- Browser console shows NO auto-select message (because saved lesson takes priority)
- This is CORRECT - saved session takes priority

---

### 5. Test Scenario: Page Refresh (Not Hard)

**Action**:
1. On course page with auto-selected first lesson
2. Regular refresh (Ctrl+R or F5)
3. Observe what loads

**Expected Behavior** ✅:
- Can go either way depending on cache:
  - If localStorage data still there: Resume that lesson ✅
  - If localStorage cleared: Re-auto-select first lesson ✅
- Either behavior is acceptable

---

## Console Logs to Check

**Successful Auto-Select**:
```
[CourseDetail.PHASE_48] 🎬 Auto-selecting first lesson: Pengenalan Design Thinking
```

**Skipped (Lesson Already Selected)**:
```
(No message - function returns early)
```

**Skipped (Resume Previous Lesson)**:
```
(No message - function returns early, localStorage check)
```

**Error (Rare)**:
```
[CourseDetail.PHASE_48] Error auto-selecting first lesson: [error details]
```

---

## Quick Validation Checklist

- [ ] Page first load: First lesson auto-selected (visible in player)
- [ ] Console shows auto-select message
- [ ] Can click different lesson: Player updates correctly
- [ ] Hard refresh: OLD lesson restored (not reset to first)
- [ ] No console errors related to PHASE_48
- [ ] Multiple page visits work consistently
- [ ] Works with different courses

---

## If Something Goes Wrong

### Issue: Video player still empty on page load

1. **Check console** (F12):
   - Is `[CourseDetail.PHASE_48]` message appearing?
   - Are there any red errors?

2. **Check localStorage**:
   - DevTools → Application → Local Storage
   - Delete `lms_current_lesson` key
   - Refresh page

3. **Check course data**:
   - Is curriculum loading? (Check Network tab)
   - Does course have lessons? (Check course page in admin)

4. **Verify fix applied**:
   - Search for "PHASE 48 FIX" in CourseDetail.jsx
   - Verify useEffect exists with auto-select logic

### Issue: Wrong lesson auto-selected

1. Verify it's selecting first lesson from FIRST Bagian (curriculum[0])
2. Check browser console - which lesson was selected?
3. Check course structure - what should first lesson be?

### Issue: Old lesson overwritten on page reload

1. **This is wrong** - should preserve saved lesson
2. Check if `localStorage.getItem("lms_current_lesson")` check is in code
3. Verify localStorage has the saved lesson (DevTools → Application)
4. Check if hard refresh is clearing localStorage (browser setting)

### Issue: Can't manually select lessons anymore

1. This would indicate auto-selection logic is too aggressive
2. Verify that `if (variantItem)` guard check is working
3. Try clearing page cache and localStorage
4. Check console for PHASE_48 errors

---

## Deep Dive: Testing with Multiple Bagian

If your course has multiple sections (Bagian):

**Setup**:
1. Course with Bagian 1, Bagian 2, Bagian 3
2. Each Bagian has multiple lessons
3. Fresh page load

**Test**:
1. Navigate to course
2. Observe which lesson auto-selected

**Expected**:
- Should auto-select: **Bagian 1, Lesson 1** ✅
- Should NOT auto-select: Bagian 2 or Bagian 3
- Should NOT auto-select: Bagian 1 Lesson 2, 3, 4, etc.

---

## Deep Dive: Testing Empty First Bagian

If somehow first Bagian has 0 lessons:

**Setup**:
1. Abnormal course with Bagian 1 empty
2. Bagian 2+ have lessons

**Expected Behavior**:
- Auto-selection skipped (first Bagian has no lessons)
- Video player stays empty
- User must manually select from Bagian 2
- No errors in console ✅

---

## Success Indicator

✅ **Phase 48 is successful when**:
- First lesson auto-loads on fresh page visit
- Console shows auto-select message
- Can manually select other lessons
- Hard refresh preserves saved lesson
- No console errors

---

**Test Date**: ____________  
**Tester**: ____________  
**Result**: ✅ PASS / ❌ FAIL  

**Notes**:
_______________________________________________________________________
_______________________________________________________________________
