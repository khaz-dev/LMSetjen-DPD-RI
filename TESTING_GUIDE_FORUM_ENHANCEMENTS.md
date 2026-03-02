# Quick Start Testing Guide - Forum Enhancements PHASE 7.23

## Three Features Implemented

### 1️⃣ "Anda" Badge (You Created This)
**Location**: Original question header  
**When**: User viewing their own question  
**Verification**:
```
1. Log in as User A
2. Navigate to: http://localhost:5174/student/courses/124632/
3. Find a question you created
4. Click to open forum thread
5. ✅ Should see "Anda" badge on original question header
```

### 2️⃣ Visual Like Feedback  
**Location**: Like buttons (heart icon)  
**When**: User likes/unlikes any post  
**Visual Changes**:
- Empty heart `♡` → Filled red heart `♥` (when liked)
- Text changes from "Sukai" to "Batalkan suka"
- Heart fills with red color: `#ff4757`

**Verification**:
```
1. Open forum thread
2. Click heart icon on any post
3. ✅ Heart should fill red IMMEDIATELY (optimistic update)
4. Click again to unlike
5. ✅ Heart should empty immediately
```

**Locations**:
- Original question (top of thread)
- Reply messages (in conversation)
- Question list (back button view)

### 3️⃣ Live Updates (Polling Every 5 Seconds)
**What Updates**:
- Like counts ✓
- New reply messages ✓  
- Message author info ✓
- Report button status ✓

**Multi-Tab Test** (Best way to verify):
```
1. Open Firefox: http://localhost:5174/student/courses/124632/
2. Open Chrome: http://localhost:5174/student/courses/124632/
3. In Firefox: Open a forum thread
4. In Chrome: Open the SAME forum thread
5. Firefox: Click like on a post
   ✅ Heart fills red in Firefox (immediate)
6. Wait 5 seconds...
   ✅ Like count updates in Chrome (from polling)
7. Chrome: Post a reply
   ✅ New reply appears in Firefox within 5 seconds
```

---

## Debug Mode - Check Console Logs

**Enable Debug Output** (in browser console F12):
```javascript
// Should see logs like:
[handleConversationShow] 📌 === CONVERSATION OPENED ===
[Forum Polling] Starting 5-second polling...
[Forum Polling] Refreshing course data...
[Forum Polling] Error fetching updates: (only if error)
```

**Check Polling is Running**:
```
F12 → Network tab
Filter: "course-detail" 
Should see request every 5 seconds when forum is open
```

---

## Common Issues & Fixes

### ❌ Heart doesn't turn red when clicking
**Check**: 
- Is backend returning response with `likes_count`?
- Are `userLikedQuestions` and `userLikedMessages` state updating?
- Try refreshing page and clicking again

### ❌ Polling doesn't update like counts
**Check**:
- Console for `[Forum Polling]` logs
- Network tab for `course-detail` requests every 5 seconds
- Is forum thread still open? (Polling stops when closed)
- Try browser refresh to re-initialize

### ❌ "Anda" badge not appearing
**Check**:
- Are you the creator of this question?
- Does `User.user_id` match question `user_id`?
- Try logging out/in to refresh UserData()

### ❌ Can't like posts (API error)
**Check**:
- Backend is running on `:8001`
- Endpoints exist:
  - `POST /api/v1/student/question-answer-like/{qa_id}/`
  - `POST /api/v1/student/question-answer-message-like/{qa_id}/`
- Check backend logs: `python manage.py runserver`

### ❌ Memory leak warning
**Check**:
- Close forum thread → click X button
- Polling interval should stop
- DevTools → Performance → Memory should not spike
- Verify `handleConversationClose()` is called

---

## Step-by-Step Test Workflow

### Phase 1: Single User Visual Test (5 min)
```
1. Open Chrome DevTools (F12)
2. Navigate to course forum
3. Click on a question to open
4. Verify "Anda" badge (if your question)
5. Click like button → heart fills red immediately ✅
6. Click again → heart empties ✅
7. Close forum → Polling should stop (check Network tab cleared)
```

### Phase 2: Multi-User Live Update Test (10 min)
```
1. Open 2 browser windows side-by-side
2. Both navigate to same course forum
3. Both open same question
4. Window 1: Click like → heart fills immediately
5. Window 2: Wait 5 seconds → count should update (watch Network tab)
6. Window 1: Post new reply
7. Window 2: Wait 5 seconds → new reply appears
```

### Phase 3: Error Handling Test (5 min)
```
1. Open DevTools → Network tab
2. Set throttle to "Offline"
3. Try to like a post
4. ✅ Heart should fill (optimistic)
5. ✅ Error toast should appear
6. ✅ Heart should revert (empty)
7. Set throttle back to "Online"
8. Like again → Should work normally ✅
```

### Phase 4: Performance/Cleanup Test (5 min)
```
1. DevTools → Performance/Memory tab
2. Record memory before opening forum
3. Open forum thread
4. Wait 30 seconds (6 polling cycles)
5. Close forum (click X button)
6. Record memory after closing
7. ✅ Memory should be similar (no leak)
8. Open/close forum 5 times quickly
9. ✅ No duplicate intervals (check Network steady requests)
```

---

## Expected Network Requests

### When Opening Forum Thread
```
1x GET /api/v1/student/course-detail/{user_id}/{enrollment_id}/
   - Gets question + all messages + likes
   - Response: ~5-20 KB per 10 messages
```

### Every 5 Seconds (While Thread Open)
```
1x GET /api/v1/student/course-detail/{user_id}/{enrollment_id}/
   - Polls for fresh data
   - Response: Same structure, updated counts
```

### When Liking/Unliking
```
Immediate: 1x POST /api/v1/student/question-answer-like/{qa_id}/
Response: { "likes_count": 5, "liked": true }

Immediate: 1x POST /api/v1/student/question-answer-message-like/{qa_id}/
Response: { "likes_count": 3, "liked": false }
```

**Total Requests During 1-Min Survey**: ~12-13 requests (1 initial + 12 polling + likes)

---

## Success Criteria

### ✅ All 3 Features Working
- [ ] "Anda" badge appears for question creator
- [ ] Heart icon changes color (white→red) when liked
- [ ] Like count updates across browsers within 5 seconds
- [ ] New replies appear in other browsers within 5 seconds
- [ ] No console errors (only [Forum Polling] info logs)

### ✅ No Data Corruption
- [ ] Like counts match database
- [ ] No duplicate messages
- [ ] User's like state persists across tabs
- [ ] Can like/unlike multiple times without state confusion

### ✅ No Memory Leaks
- [ ] Memory usage stable over 5 min with forum open
- [ ] Memory returns to baseline after closing forum
- [ ] No warnings in console about memory

### ✅ Error Resilience
- [ ] Network error → Toast shown, UI reverted
- [ ] Polling failure → Silent retry (no UI impact)
- [ ] Rapid clicks → No race conditions, UI consistent

---

## Rollback Instructions

If testing fails, rollback is simple:

```bash
# Option 1: Git rollback
git checkout HEAD~1

# Option 2: Revert file
# Just replace CourseDetail.jsx with previous version
# (No database changes made)

# Restart frontend
npm run dev
```

---

## Support Information

**Implementation File**: `frontend/src/views/student/CourseDetail.jsx`  
**Lines Modified**: ~230 lines total  
**No Backend Changes**: ✅ Uses existing endpoints  
**No Database Changes**: ✅ No migrations needed  

**Key Functions Added**:
- `populateUserLikes(conversation)` - Line ~678
- `startForumPolling(qaId)` - Line ~694  
- `handleLikeQuestion()` - Enhanced ~2215
- `handleLikeMessage()` - Enhanced ~2265
- `handleConversationShow()` - Enhanced ~724
- `handleConversationClose()` - Enhanced ~641
- Cleanup useEffect - Line ~712

**Next Steps After Testing**:
1. ✅ Run test workflow (20-25 minutes)
2. Document any issues
3. Deploy to staging
4. Deploy to production
5. Monitor polling load for 1 week

---

**Created**: November 2025  
**Phase**: PHASE 7.23  
**Status**: ✅ READY FOR TESTING

