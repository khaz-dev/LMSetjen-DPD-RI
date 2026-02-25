# YouTube Link Save Fix - QA Testing Checklist (PHASE 4.73)

## Pre-Test Setup

- [ ] Backend is running on `http://localhost:8001`
- [ ] Frontend is running on `http://localhost:5174`
- [ ] Logged in as an instructor with at least one course
- [ ] Browser DevTools open (F12) for console monitoring
- [ ] Django log file monitoring (optional but helpful)

---

## Test Suite 1: Basic YouTube Link Save ✅

### Test 1.1: Save YouTube Link (watch?v= format)

**Preconditions:**
- Course exists (draft status)
- Curriculum has at least one section and lesson

**Steps:**
1. Navigate to `http://localhost:5174/instructor/edit-course/[ID]/curriculum/`
2. Click **"Link YouTube"** button on a lesson
3. Enter: `https://www.youtube.com/watch?v=dQw4w9WgXcQ` (Rick Roll)
4. Click **"Simpan Draf"** button
5. Wait for success toast notification
6. **Refresh page** (F5)

**Expected Results:**
- [ ] Success toast appears: "Kurikulum Disimpan!"
- [ ] Console shows: `[Curriculum Update] Using YouTube link for item: https://www.youtube.com/...`
- [ ] After refresh, YouTube link appears in the lesson
- [ ] Preview card shows YouTube icon and link
- [ ] Duration auto-extracts (e.g., "11m 22s")
- [ ] "Buka di YouTube" button appears and is clickable

**Actual Results:**
- Link appears after refresh: YES / NO / PARTIAL
- Duration extracted: YES / NO
- Console messages correct: YES / NO


### Test 1.2: Save YouTube Link (youtu.be format)

**Steps:**
1. Open different lesson in same course
2. Click **"Link YouTube"**
3. Enter: `https://youtu.be/dQw4w9WgXcQ`
4. Click **"Simpan Draf"**
5. Wait for toast → **Refresh page**

**Expected Results:**
- [ ] Short URL (youtu.be) also works
- [ ] Link persists after refresh
- [ ] Preview card displays correctly
- [ ] Duration extracts

**Actual Results:**
- Works as expected: YES / NO


### Test 1.3: Save Empty YouTube Link (should skip)

**Steps:**
1. Add new lesson with title
2. Click **"Link YouTube"** but leave empty
3. Click **"Simpan Draf"**
4. Refresh

**Expected Results:**
- [ ] Lesson is still created
- [ ] No YouTube link saved
- [ ] No error messages
- [ ] Console: `[Curriculum Update] Skipping empty item...`

**Actual Results:**
- Handled correctly: YES / NO

---

## Test Suite 2: Google Drive Link (Regression Testing) ✓️

### Test 2.1: Save Google Drive Link Still Works

**Steps:**
1. Open lesson
2. Click **"Link Google Drive"**
3. Enter: `https://drive.google.com/file/d/1-2-3-4-5/view`
4. Click **"Simpan Draf"**
5. Refresh

**Expected Results:**
- [ ] Google Drive links still work (no regression)
- [ ] Preview shows Google Drive icon
- [ ] Duration extracts

**Actual Results:**
- Google Drive still works: YES / NO


### Test 2.2: Mixed Media in Same Course

**Steps:**
1. Add 3 lessons:
   - Lesson 1: YouTube link
   - Lesson 2: Google Drive link
   - Lesson 3: No link
2. Save draft
3. Refresh

**Expected Results:**
- [ ] YouTube lesson shows YouTube preview
- [ ] Google Drive lesson shows Google Drive preview
- [ ] No link lesson shows no preview
- [ ] All data persists

**Actual Results:**
- Mixed media works: YES / NO

---

## Test Suite 3: Link Modification ✏️

### Test 3.1: Edit Existing YouTube Link

**Steps:**
1. Find lesson with existing YouTube link
2. Click **"Link YouTube"** field
3. Change URL to: `https://www.youtube.com/watch?v=gZL1VVJbBqI`
4. Click **"Simpan Draf"**
5. Refresh

**Expected Results:**
- [ ] New YouTube URL replaces old one
- [ ] Old link not duplicated
- [ ] Preview shows new video duration

**Actual Results:**
- Link updated correctly: YES / NO


### Test 3.2: Delete YouTube Link

**Steps:**
1. Find lesson with YouTube link
2. Click **"Hapus Link"** button
3. Click **"Simpan Draf"**
4. Refresh

**Expected Results:**
- [ ] YouTube preview card disappears
- [ ] Link is removed (not set to empty string)
- [ ] Lesson still exists

**Actual Results:**
- Link deleted: YES / NO


### Test 3.3: Switch from Google Drive to YouTube

**Steps:**
1. Find lesson with Google Drive link
2. Click **"Link YouTube"** button (switches media source)
3. Enter YouTube URL
4. Click **"Simpan Draf"**
5. Refresh

**Expected Results:**
- [ ] YouTube link replaces Google Drive link
- [ ] Only YouTube preview shows
- [ ] Old Google Drive link removed

**Actual Results:**
- Switch works: YES / NO

---

## Test Suite 4: Duration Extraction 🎬

### Test 4.1: YouTube Duration Auto-Extract

**Steps:**
1. Add lesson with YouTube link
2. Save draft
3. Check duration displayed

**Expected Results:**
- [ ] Duration appears (e.g., "11m 22s")
- [ ] Not "0m 0s" (which means extraction failed)
- [ ] Console logs: `[Curriculum Update] Extracted duration XXs from URL`

**Actual Results:**
- Duration extracted: YES / NO
- Correct value: YES / NO


### Test 4.2: Duration Persists Across Page Load

**Steps:**
1. Note duration displayed for YouTube lesson
2. Refresh page
3. Check duration still shows

**Expected Results:**
- [ ] Duration value persists
- [ ] No need to re-calculate

**Actual Results:**
- Duration persists: YES / NO

---

## Test Suite 5: Draft vs Published Flow 📋

### Test 5.1: Draft Course YouTube Links

**Preconditions:**
- Course is in "Draft" status

**Steps:**
1. Add YouTube link to lesson
2. Save draft
3. Refresh
4. Check link persists

**Expected Results:**
- [ ] YouTube links work in draft courses
- [ ] No special handling needed for draft

**Actual Results:**
- Works in draft: YES / NO


### Test 5.2: Submit Draft to Review

**Preconditions:**
- Course has curriculum with YouTube lessons
- Course ready for review

**Steps:**
1. Complete curriculum with YouTube lessons
2. Go back to main course edit page
3. Click **"Ajukan Review"**
4. Complete review submission
5. After admin approval, check curriculum

**Expected Results:**
- [ ] YouTube links preserved in review process
- [ ] Links appear in published course
- [ ] No data loss in workflow

**Actual Results:**
- Preserved in workflow: YES / NO

---

## Test Suite 6: Error Cases 🚫

### Test 6.1: Invalid YouTube URL

**Steps:**
1. Try to save with invalid YouTube URL: `not-a-youtube-link`
2. Save draft

**Expected Results:**
- [ ] Either accepted and stored as-is (for custom URLs)
- [ ] Or validation error shown
- [ ] Consistent behavior documented

**Actual Results:**
- Handled as: STORED / REJECTED
- Behavior: EXPECTED / UNEXPECTED


### Test 6.2: YouTube Link with Query Parameters

**Steps:**
1. Enter: `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PLxxx`
2. Save draft
3. Refresh

**Expected Results:**
- [ ] Full URL with parameters preserved
- [ ] All query params saved
- [ ] Still recognized as YouTube link

**Actual Results:**
- Parameters preserved: YES / NO
- Still recognized as YouTube: YES / NO

---

## Test Suite 7: UI/UX Validation 🎨

### Test 7.1: YouTube Preview Card Rendering

**Steps:**
1. Add lesson with YouTube link
2. Save and refresh
3. Check preview card appearance

**Expected Results:**
- [ ] YouTube icon displays (red YT logo)
- [ ] Link text is readable and truncated nicely
- [ ] "Buka di YouTube" button visible
- [ ] "Hapus Link" button visible
- [ ] Preview card has proper styling

**Actual Results:**
- Rendering correct: YES / NO


### Test 7.2: Form State During Save

**Steps:**
1. Enter YouTube link
2. Click "Simpan Draf"
3. Watch UI during save

**Expected Results:**
- [ ] Button shows loading spinner
- [ ] Button text changes to "Menyimpan Draf..."
- [ ] Button is disabled during save
- [ ] Reverts to normal after success

**Actual Results:**
- Form state correct: YES / NO

---

## Test Suite 8: Browser Compatibility ✔️

### Test 8.1: Chrome/Edge

**Browser:** Chrome / Edge (latest)

**Steps:**
1. Perform Test 1.1 basic save test

**Result:**
- Works: YES / NO

### Test 8.2: Firefox

**Browser:** Firefox (latest)

**Steps:**
1. Perform Test 1.1 basic save test

**Result:**
- Works: YES / NO

---

## Console Validation Checklist ✓

After each save, console should show:

```
[Curriculum Update] Request data keys: ['variants[...', ...]
[Curriculum Update] Curriculum-related keys found: ['variants[...', ...]
[Curriculum Update] Processing 1 variants for course: ...
[Curriculum Update] Using YouTube link for item: https://www.youtube.com/watch?v=...
[Curriculum Update] Extracted duration 671s from URL
```

- [ ] "Using YouTube link" message present
- [ ] Duration extraction message present
- [ ] No error messages
- [ ] Curriculum update completes

---

## Final Verification Checklist ✔

### Frontend Indicators
- [ ] YouTube link visible after save and refresh
- [ ] Preview card rendering correctly
- [ ] All UI interactions work
- [ ] No console errors
- [ ] No browser warnings

### Backend Indicators
- [ ] Correct console logs in terminal
- [ ] No database errors in Django logs
- [ ] HTTP 200 response on save
- [ ] Response includes updated curriculum data

### Database Verification (Optional)
```bash
# From Django shell
from api.models import VariantItem
item = VariantItem.objects.get(title="Your Lesson")
print(item.file)  # Should output YouTube URL
print(item.duration)  # Should output duration
```

- [ ] YouTube URL stored in `file` field
- [ ] Duration stored in `duration` field
- [ ] No duplicate entries

---

## Summary Stats

| Category | Expected | Pass | Fail | Notes |
|----------|----------|------|------|-------|
| Basic Save | 3 | _ | _ | |
| Regression | 2 | _ | _ | |
| Modification | 3 | _ | _ | |
| Duration | 2 | _ | _ | |
| Draft Flow | 2 | _ | _ | |
| Error Cases | 2 | _ | _ | |
| UI/UX | 2 | _ | _ | |
| Browser Compat | 2 | _ | _ | |
| **TOTAL** | **18** | **_** | **_** | |

---

## Test Execution Log

**Date:** _____________  
**Tester:** _____________  
**Build Version:** _____________  
**Backend Version:** 4.73  

### Issues Found

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

## Final Approval

- [ ] All critical tests pass
- [ ] No regressions detected  
- [ ] Console logs show correct behavior
- [ ] Ready for production deployment

**QA Sign-off:** _____ **Date:** _____________

---

**PHASE 4.73 - YouTube Link Draft Save Fix**
