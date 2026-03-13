# PHASE 42.3 - YouTube Player Race Condition Fix - Functional Test Guide

## Test Environment
- **Backend**: http://localhost:8001
- **Frontend**: http://localhost:5175
- **Test Date**: March 12, 2026
- **Test Phase**: PHASE 42.3 - Execution

## Root Cause Fix Summary

### The Problem
- Untracked `setTimeout` callbacks in `waitForApi()` function were firing AFTER component unmount
- Old callbacks attempted to create players on recycled DOM container refs
- Resulted in `NotFoundError: Failed to execute 'insertBefore'` crash
- Two YouTube players created for same videoId during rapid lesson switches

### The Fix
1. **Added timeout tracking refs**:
   - `pendingTimeoutRef`: Track pending setTimeout callbacks
   - `currentVideoIdRef`: Detect stale calls that shouldn't execute

2. **Enhanced unmount cleanup**:
   - Cancel pending timeouts before component unmounts
   - Clear `currentVideoId` to prevent stale callbacks

3. **Stale call prevention in waitForApi**:
   - Store timeout ID when scheduling
   - Check `currentVideoIdRef.current !== videoId` before creating player
   - Skip creation if videoId no longer matches current

## Test Scenarios

### Test 1: YouTube-to-YouTube Lesson Switch (Critical)
**Objective**: Verify smooth transition between YouTube lesson videos without crashes

**Steps**:
1. Login with student account and navigate to course with YouTube lessons
2. Find a course with at least 2 YouTube videos (e.g., lesson 1 and lesson 2)
3. Start playing first lesson (e.g., variant_item_id=126107)
4. Wait for full load and playback to be smooth
5. Complete the lesson (if modal appears, submit answer)
6. **IMMEDIATELY** switch to another YouTube lesson (e.g., variant_item_id=268450)
7. Monitor browser console (F12) for any errors
8. Verify second video loads cleanly

**Expected Results**:
- ✅ No `NotFoundError: insertBefore` error in console
- ✅ No `Uncaught` errors related to DOM manipulation
- ✅ Second video loads and is playable immediately
- ✅ No visual glitches or double player instances
- ✅ No blank/black video container
- ✅ Player controls work on second video

**Pass Criteria**: Complete transition without any JavaScript errors in browser console

---

### Test 2: Rapid Lesson Switching (Stress Test)
**Objective**: Verify fix handles rapid, continuous lesson switches

**Steps**:
1. Login and navigate to course with 3+ YouTube lessons
2. Click through lessons in quick succession (click 3+ different lessons within 5 seconds)
3. Do NOT wait for each to fully load before clicking next
4. Monitor console for errors during rapid switching
5. After rapid switching, verify one lesson loads correctly
6. Try playing video - verify it's responsive

**Expected Results**:
- ✅ No crash or freeze during rapid clicking
- ✅ Final lesson that loads is stable and playable
- ✅ No lingering timeout callbacks creating players
- ✅ Console shows clean state (no pending errors)
- ✅ Page doesn't become unresponsive

**Pass Criteria**: No crashes, final page state is clean and functional

---

### Test 3: Wrong Answer + Lesson Switch (Modal Interaction)
**Objective**: Verify interaction between completion modal and lesson switching

**Steps**:
1. Find a lesson with a completion question
2. Play through the lesson completely
3. When completion modal appears with question, submit **WRONG** answer
4. When error modal shows ("Answer incorrect, try again"), **IMMEDIATELY** click to switch to different lesson
5. Verify lesson switch happens without crashes
6. Navigate back to original lesson
7. Complete it with correct answer

**Expected Results**:
- ✅ No crash when switching during modal state
- ✅ Original lesson is properly abandoned (not both players loading)
- ✅ New lesson loads cleanly
- ✅ Can return to original lesson and complete successfully
- ✅ No double-player creation when re-visiting original lesson

**Pass Criteria**: Smooth transition even when switching during modal interactions

---

### Test 4: Lesson Resumption (State Persistence)
**Objective**: Verify seek positions and player states don't cross-contaminate

**Steps**:
1. Play lesson A, seek to position 2:30
2. Switch to lesson B, seek to position 4:15
3. Go back to lesson A (via browser or navigation)
4. Verify lesson A is at 2:30 (not 4:15)
5. Switch to lesson B again
6. Verify lesson B is at 4:15 (not back to start)

**Expected Results**:
- ✅ Lesson A maintains 2:30 position when returning
- ✅ Lesson B maintains 4:15 position (or resumes from last position)
- ✅ No seek position cross-contamination between lessons
- ✅ Player state is properly isolated per lesson

**Pass Criteria**: Seek positions remain accurate and don't bleed between lessons

---

## Browser Console Monitoring

During all tests, keep browser console open (F12) and watch for:

### ❌ FAIL - These errors mean fix didn't work:
```
NotFoundError: Failed to execute 'insertBefore' on 'Node'
Uncaught TypeError: Cannot set property of undefined
Uncaught RangeError: Maximum call stack exceeded
Cannot read property 'insertBefore' of null
```

### ✅ PASS - These messages are expected (informational only):
```
Skipping stale player creation for videoId: [videoId]
Player destroyed for variant_item_id: [id]
YouTube API ready, creating player
```

### ⚠️ WARNING - Investigate but not necessarily a fail:
```
Failed to load resource: net::ERR_...
CORS errors (if not related to YouTube API)
```

---

## Test Execution Checklist

- [ ] Test 1 Complete: YouTube-to-YouTube Switch
  - [ ] No insertBefore errors
  - [ ] Video plays cleanly on switch
  - [ ] Console is clean
  
- [ ] Test 2 Complete: Rapid Switching
  - [ ] No crashes during rapid clicks
  - [ ] Final lesson is stable
  - [ ] No zombie timeouts
  
- [ ] Test 3 Complete: Wrong Answer + Switch
  - [ ] Modal doesn't block switching
  - [ ] No double player creation
  - [ ] Can return and complete lesson
  
- [ ] Test 4 Complete: Seek Position Isolation
  - [ ] Positions maintained correctly
  - [ ] No cross-contamination
  - [ ] State properly isolated

---

## Test Results Log

### Date: March 12, 2026
### Tester: AI Agent (Automated)

#### Test 1: YouTube-to-YouTube Switch
- Status: [PENDING]
- Notes: 

#### Test 2: Rapid Lesson Switching
- Status: [PENDING]
- Notes: 

#### Test 3: Wrong Answer + Switch
- Status: [PENDING]
- Notes: 

#### Test 4: Lesson Resumption
- Status: [PENDING]
- Notes: 

---

## Deployment Readiness

Once all tests pass:
1. ✅ Code compiled without errors (COMPLETE)
2. ⏳ Functional tests pass (IN PROGRESS)
3. Deploy to staging environment
4. Team review and sign-off
5. Deploy to production

---

## Additional Debug Commands

If issues arise during testing:

```bash
# Clear browser cache and local storage
localStorage.clear()
sessionStorage.clear()

# Check for pending timeouts (in browser console)
console.log('Pending timeouts:', pendingTimeoutRef)

# Monitor YouTube API readiness
console.log('YT API Ready:', window.YT && window.YT.Player)
```

---

## References
- **Root Cause**: Recursive setTimeout race condition in VideoPlayerYoutubeSimplified.jsx
- **File Modified**: frontend/src/views/partials/VideoPlayerYoutubeSimplified.jsx
- **Previous Phases**: 42.1 (player cleanup), 42.2 (key prop + ref reset)
- **Current Phase**: 42.3 (timeout tracking + stale call prevention)
