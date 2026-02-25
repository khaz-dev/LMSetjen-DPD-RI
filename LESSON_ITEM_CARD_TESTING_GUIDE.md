# Lesson Item Card Video Detection - Testing Guide

## Quick Test (5 minutes)

### URL to Test
Go to: **http://localhost:5174/student/courses/124632/**

### Step 1: Verify Lesson Icons
Look at the "Pelajaran Tab" (Lessons Tab)

**Check for Google Drive lesson:**
```
Expected BEFORE fix: File icon [📄]
Expected AFTER fix:  Play icon [▶]  ✅
```

**Check for YouTube lesson:**
```
Expected BEFORE fix: File icon [📄]
Expected AFTER fix:  Play icon [▶]  ✅
```

**Check for uploaded MP4 lesson:**
```
Expected: Play icon [▶]  ✅ (should still work)
```

### Step 2: Verify Lesson Labels
Look at the lesson-meta text under each lesson

**Check for Google Drive lesson:**
```
Expected BEFORE fix: "File"
Expected AFTER fix:  "Video"  ✅
```

**Check for YouTube lesson:**
```
Expected BEFORE fix: "File"
Expected AFTER fix:  "Video"  ✅
```

**Check for uploaded MP4 lesson:**
```
Expected: "Video"  ✅ (should still work)
```

### Step 3: Click and Play
Click a Google Drive lesson
```
Expected BEFORE fix: File preview dialog appears ❌
Expected AFTER fix:  Video player opens ✅
```

Click a YouTube lesson
```
Expected BEFORE fix: File preview dialog appears ❌
Expected AFTER fix:  Video player opens ✅
```

Click uploaded MP4
```
Expected: Video player opens ✅ (should still work)
```

---

## Complete Test Checklist

### Test 1: Lesson Card Visual Icons

**Test 1.1 - Google Drive Video**
- [ ] Find lesson with Google Drive link
- [ ] Verify icon is [▶] play icon (not file icon)
- [ ] Hover over button, tooltip says "Putar video" (Play video)
- [ ] Not showing file icon [📄]

**Test 1.2 - YouTube Video**
- [ ] Find lesson with YouTube link
- [ ] Verify icon is [▶] play icon (not file icon)
- [ ] Hover over button, tooltip says "Putar video"
- [ ] Not showing file icon [📄]

**Test 1.3 - Uploaded MP4**
- [ ] Find lesson with uploaded video file
- [ ] Verify icon is [▶] play icon (regression test)
- [ ] Hover over button, tooltip says "Putar video"
- [ ] Should work exactly as before

**Test 1.4 - PDF/Document File**
- [ ] Find lesson with PDF or document file
- [ ] Verify icon is appropriate file icon [📄] or [📕]
- [ ] Hover over button, tooltip says "Buka dokumen"
- [ ] Should work exactly as before

### Test 2: Lesson Metadata Labels

**Test 2.1 - Google Drive Video Label**
- [ ] Find lesson with Google Drive link
- [ ] Icon next to title shows video icon (not file icon)
- [ ] Text reads "Video" (not "File")
- [ ] Duration shows correctly (e.g., "10 min")

**Test 2.2 - YouTube Video Label**
- [ ] Find lesson with YouTube link
- [ ] Icon next to title shows video icon (not file icon)
- [ ] Text reads "Video" (not "File")
- [ ] Duration shows correctly

**Test 2.3 - Uploaded Video Label**
- [ ] Find lesson with uploaded video
- [ ] Icon shows video icon
- [ ] Text reads "Video"
- [ ] Duration shows correctly
- [ ] (Regression test - should work as before)

**Test 2.4 - Document Label**
- [ ] Find lesson with PDF/document
- [ ] Icon shows file type icon (PDF, Word, etc)
- [ ] Text reads correct type ("PDF", "Dokumen", etc)
- [ ] Duration shows correctly
- [ ] (Regression test - should work as before)

### Test 3: Click Behavior

**Test 3.1 - Google Drive Video Playback**
- [ ] Click Google Drive lesson with play icon
- [ ] Modal opens (not alert, not file dialog)
- [ ] Modal title shows "Video" icon
- [ ] Video player appears (ReactPlayer with play controls)
- [ ] Play button works
- [ ] Progress bar works
- [ ] Can drag progress bar
- [ ] Fullscreen button visible
- [ ] Volume control visible

**Test 3.2 - YouTube Video Playback**
- [ ] Click YouTube lesson with play icon
- [ ] Modal opens (not alert, not file dialog)
- [ ] Modal title shows "Video" icon
- [ ] Video player appears with YouTube controls
- [ ] Play button works
- [ ] Progress bar works
- [ ] Fullscreen works
- [ ] YouTube player controls appear (quality, speed, etc)

**Test 3.3 - Uploaded Video Playback**
- [ ] Click uploaded MP4 with play icon
- [ ] Modal opens (not alert, not file dialog)
- [ ] Video player appears
- [ ] All controls work
- [ ] (Regression test - should work exactly as before)

**Test 3.4 - PDF/Document**
- [ ] Click PDF/document lesson
- [ ] DOES NOT open video modal
- [ ] File preview dialog or [Open File] [Download] buttons appear
- [ ] Can open or download file
- [ ] (Regression test - should work as before)

### Test 4: Modal Header Display

**Test 4.1 - Google Drive Video Modal**
- [ ] Modal title area shows video icon (not file icon)
- [ ] Title shows video icon + lesson title
- [ ] Metadata shows "Video • Duration"
- [ ] NOT showing "File • Duration"

**Test 4.2 - YouTube Video Modal**
- [ ] Modal title shows video icon
- [ ] Metadata shows "Video • Duration"
- [ ] NOT showing "File • Duration"

**Test 4.3 - Uploaded Video Modal**
- [ ] Modal title shows video icon
- [ ] Metadata shows "Video • Duration"
- [ ] (Regression test)

**Test 4.4 - Document File Modal**
- [ ] File preview shows appropriate file icon
- [ ] Metadata shows file type (PDF, Dokumen, etc)
- [ ] Shows "File" not "Video"

### Test 5: Progress Tracking

**Test 5.1 - Google Drive Video Progress**
- [ ] Play Google Drive video
- [ ] Progress badge appears in top-right (X% ditonton)
- [ ] Pause video
- [ ] Close modal
- [ ] Reopen same lesson
- [ ] Progress is saved and shows previous % watched

**Test 5.2 - YouTube Video Progress**
- [ ] Play YouTube video
- [ ] Progress badge appears
- [ ] Pause and close
- [ ] Reopen lesson
- [ ] Progress is saved

**Test 5.3 - Completion Status**
- [ ] Play any video
- [ ] Watch until completion (or close at 99%+)
- [ ] Lesson shows "Diselesaikan" (Completed) status
- [ ] Play button changes to checkmark
- [ ] Progress badge shows "100% ditonton"

### Test 6: Status Indicators

**Test 6.1 - Not Started Status**
- [ ] Find unwatched lesson with Google Drive video
- [ ] Lesson card shows "not-started" class (grayed out appearance)
- [ ] Play icon shows clear (not playing state)

**Test 6.2 - In Progress Status**
- [ ] Play Google Drive/YouTube video
- [ ] Close modal (without completing)
- [ ] Reopen lessons tab
- [ ] Lesson shows yellow play circle icon
- [ ] Shows as "in-progress" with progress % displayed
- [ ] Can see the yellow highlight on card

**Test 6.3 - Completed Status**
- [ ] Complete any video
- [ ] Lesson shows checkmark icon [✓]
- [ ] Shows "Diselesaikan" badge
- [ ] Shows "100% ditonton"

### Test 7: Browser Console

**Test 7.1 - No Console Errors**
- [ ] Open browser console (F12)
- [ ] Click through lessons
- [ ] Click Google Drive video
- [ ] Click YouTube video
- [ ] Check Console tab: No red error messages ✅
- [ ] Can ignore yellow warnings (pre-existing)

**Test 7.2 - No Networking Errors**
- [ ] Open Network tab
- [ ] Click Google Drive video
- [ ] Check requests: No 404 errors for image/video
- [ ] Playlist data loads (GET /api/course-detail/)

### Test 8: Responsive/Mobile

**Test 8.1 - Desktop View**
- [ ] All icons and labels visible
- [ ] Layout not broken
- [ ] Click still works

**Test 8.2 - Tablet View**
- [ ] Resize browser to ~800px width
- [ ] Lesson cards still show play icons
- [ ] Labels still readable
- [ ] Click and play works

**Test 8.3 - Mobile View**
- [ ] Resize browser to ~400px width
- [ ] Lesson cards stack/adjust properly
- [ ] Play icons still visible
- [ ] Able to click and play videos

### Test 9: Regression Tests

**Test 9.1 - Regular Uploaded MP4 Videos**
- [ ] All previously working MP4 lessons still work
- [ ] Icons still show correctly
- [ ] Labels still show "Video"
- [ ] Can play without issues
- [ ] Progress tracking works

**Test 9.2 - PDF/Document Lessons**
- [ ] All PDF lessons still show file icon
- [ ] All document lessons still show doc icon
- [ ] NOT showing as videos
- [ ] File preview dialog still works
- [ ] Download link works

**Test 9.3 - Completed Lessons**
- [ ] Previously completed lessons still show checkmark
- [ ] Status still shows "100% ditonton"
- [ ] Can still play again if needed

**Test 9.4 - Mixed Course**
- [ ] Course with mixed content (video + doc + pdf)
- [ ] Each type shows correct icon
- [ ] Can play videos
- [ ] Can download files
- [ ] No mixing of behaviors

---

## Expected Results Summary

### For Google Drive Lessons
| Item | Before | After |
|------|--------|-------|
| Icon | [📄] File | [▶] Play |
| Label | "File" | "Video" |
| Click Result | File dialog | Video player |
| Modal Icon | File icon | Video icon |

### For YouTube Lessons
| Item | Before | After |
|------|--------|-------|
| Icon | [📄] File | [▶] Play |
| Label | "File" | "Video" |
| Click Result | File dialog | Video player |
| Modal Icon | File icon | Video icon |

### For Uploaded Videos (No Change - Regression)
| Item | Before | After |
|------|--------|-------|
| Icon | [▶] Play | [▶] Play |
| Label | "Video" | "Video" |
| Click Result | Video player | Video player |
| Modal Icon | Video icon | Video icon |

### For Files (No Change - Regression)
| Item | Before | After |
|------|--------|-------|
| Icon | [📄] File | [📄] File |
| Label | "File" / "PDF" | "File" / "PDF" |
| Click Result | File dialog | File dialog |
| Modal Icon | File icon | File icon |

---

## Troubleshooting

### Issue: Still showing file icon for Google Drive/YouTube

**Check**:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh page (Ctrl+Shift+R)
3. Close and reopen browser tab
4. Check if lesson actually has gdriveLink or youtubeLink in data

### Issue: Video player not opening

**Check**:
1. Open browser console (F12)
2. Check for errors with message like "Error loading video"
3. Try in incognito/private mode
4. Check if video URL is accessible from your network

### Issue: Progress not saving

**Check**:
1. Browser console shows no save errors
2. API endpoint `/api/v1/student/video-progress/` is responding
3. User is logged in and has valid token
4. Try clearing localStorage: DevTools > Application > localStorage > clear

### Issue: Icons show but behaviors wrong

**Check**:
1. Verify Modal.Body JSX uses `isVideoContent()` check
2. Verify `getVideoUrl()` is being used for source
3. Check ReactPlayer is properly configured
4. Console errors about missing video sources

---

## Sign-Off Checklist

- [ ] All lesson icons correct (play for video, file for docs)
- [ ] All lesson labels correct (Video vs File)
- [ ] Google Drive videos play in player (not file dialog)
- [ ] YouTube videos play in player (not file dialog)
- [ ] Uploaded videos still work (regression test)
- [ ] Files still show file dialog (regression test)
- [ ] Progress tracking works
- [ ] Status indicators correct (not-started, in-progress, completed)
- [ ] No console errors
- [ ] Works on mobile/tablet
- [ ] Full integration test passed

---

**Testing Date**: _______________
**Tested By**: _______________
**Result**: ☐ PASS ☐ FAIL
**Notes**: _________________________________________________________________
