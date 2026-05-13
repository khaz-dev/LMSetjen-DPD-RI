# PHASE 47: Quick Testing Guide - VideoPlayer Autoplay Fix

## Summary
Fixed video player autoplaying when no lesson selected. The fix ensures that `isPlaying` state is only true when a valid lesson with video file exists, preventing the "phantom autoplay" behavior.

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

### 2. Test Scenario: Page First Load (No Previous Lesson)

**Action**:
1. Open browser DevTools (F12)
2. Go to Application → Local Storage → http://localhost:5174
3. Delete `lms_current_lesson` key (clear saved lesson)
4. Navigate to: http://localhost:5174/student/courses/124632/
5. Page loads with course lessons visible

**Expected Result** ✅:
- Video player area NOT visible (display: none)
- NO audio playing in background
- NO timer/progress visible
- Lesson list clearly visible on page

**Wrong Result** ❌:
- Hear audio playing despite no lesson selected
- See timer showing progress (00:xx)
- Video player showing despite no lesson selected

---

### 3. Test Scenario: User Clicks Lesson (Autoplay)

**Action**:
1. From page above, click any lesson in the lessons list
2. Wait for video to load

**Expected Result** ✅:
- Video player appears (display: block)
- Video automatically plays
- Audio/video playing correctly
- Can hear sound and see video

---

### 4. Test Scenario: Close Video Player

**Action**:
1. While video playing, click X button to close video player
2. Wait 1-2 seconds after close
3. **Listen carefully** - should hear NO audio in background

**Expected Result** ✅:
- Video player hidden
- NO audio playing in background
- NO timer running
- Lesson list visible again
- Can click another lesson

**Wrong Result** ❌:
- Audio continues after closing video
- Stale timer still counting
- Video player reappears unexpectedly

---

### 5. Test Scenario: Hard Refresh with Saved Lesson (Resume)

**Action**:
1. Click any lesson to load it
2. Let it play for a few seconds (video shows progress)
3. Hard refresh page (Ctrl+F5)
4. Wait for course to load

**Expected Result** ✅:
- Course page loads
- Same lesson is automatically restored (from localStorage)
- Video autoplay starts
- Video resumes from previous position (not from start)

---

## Console Logging (Debug)

Open browser console (F12) to see debug messages:

### VideoPlayerUnggah.jsx Messages
When lesson is selected, you'll see state initialization messages.
When lesson is cleared, console is silent (no extra logging).

### VideoPlayer_OLD_MONOLITHIC_PHASE4141.jsx Messages
When legacy player is used, you might see:
```
📴 [VideoPlayer] variantItem cleared - resetting isPlaying to false
```

---

## Quick Validation Checklist

- [ ] Page first load: No audio playing in background
- [ ] Click lesson: Video plays and audio/video works
- [ ] Close video: No audio continues in background
- [ ] Hard refresh: Saved lesson resumes correctly
- [ ] Switch lessons: Each lesson plays without audio bleed
- [ ] Console: No error messages related to VideoPlayer

---

## If Something Goes Wrong

### Issue: Still hearing audio when no lesson selected

1. **Clear cache & localStorage**:
   - DevTools → Application → Local Storage → Delete lms_current_lesson
   - DevTools → Application → Cache → Clear

2. **Hard refresh**: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

3. **Check files modified**:
   ```bash
   git diff frontend/src/components/CourseDetail/VideoPlayerUnggah.jsx
   git diff frontend/src/components/CourseDetail/VideoPlayer_OLD_MONOLITHIC_PHASE4141.jsx
   ```

4. **Verify fix applied**:
   - Search for "PHASE 47 FIX" in both files
   - Should see comments at initialization line
   - Should see new useEffect after variant_item_id effect

### Issue: Video not autoplaying when lesson selected

1. Check browser console for errors
2. Verify autoplay permission (some browsers block autoplay)
3. Try muting video (toggle mute button) then unmute

### Issue: Video stuck in "playing" state after close

1. Navigate to different lesson or page to clear state
2. Check browser Storage: Clear all site data
3. Verify `handleVideoPlayerClose` is called (check CourseDetail.jsx line 764)

---

## Success Indicator

✅ **Phase 47 is successful when**:
- No autoplay sound when page first loads with no lesson selected
- Selecting a lesson plays video correctly
- Closing video stops all audio/playback
- Each lesson plays independently without audio bleed
- Resume functionality works (hard refresh)

---

**Test Date**: ____________
**Tester**: ____________
**Result**: ✅ PASS / ❌ FAIL

