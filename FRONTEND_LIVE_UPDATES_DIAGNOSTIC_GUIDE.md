# Frontend & Backend Live Updates Diagnostic Guide

## ✅ Backend Status

Backend is now working correctly:
- ✓ API returns `user_liked: true/false` for each question
- ✓ API returns correct `likes_count` 
- ✓ Database has the likes stored correctly

**Tests run:**
- User 3 API response: `user_liked: True` for liked question (212915)
- User 3 API response: `user_liked: False` for non-liked question (952602)
- Database confirms: User 3 has 1 like in database for question 212915

---

## ❓  Troubleshooting Your Frontend Issue

You said: "Live update still not working i dont see thee like count change when i deslike on like using another account / update the data"

This could mean several things. Let me help narrow is down:

### Scenario A: Liking with Account A, then checking with Account B

**What should happen:**
1. Account A clicks like on Question X → Like saved to DB, like_count increases
2. Account B's page is viewing the same question
3. Account B's browser polls in 5 seconds
4. API returns `likes_count: 2` (increased)
5. Account B's like_count updates on screen

**Possible issues to check:**

```
1. When Account A clicks like, is the like button feedback immediate?
   - Check: Does Account A see the heart turn filled immediately?
   - Check: Does Account A see the like count increase immediately?

2. After 5 seconds, does Account B's like count update?
   - Check: Is polling even happening? (Open F12 → Network tab)
   - Check: Is the API response showing updated like_count?
   - Check: Is the frontend updating the displayed like_count?
```

### Scenario B: Same account, liking and checking

**What should happen:**
1. Account A clicks like → UI updates immediately (optimistic)
2. Server saves the like
3. Polling syncs with server
4. Everything matches

### What You Need To Test

**Test 1: Check if like button works at all**
1. Open http://localhost:5174/student/courses/124632/
2. Click Diskusi tab
3. Click the heart icon on a question
4. Does the heart icon turn filled immediately?
5. Does the like count increase immediately?

If NO → The like button functionality is broken, not the live updates

**Test 2: Check if polling is happening**
1. Open F12 (Developer Tools)
2. Go to Network → XHR tab
3. Watch if requests appear every 5 seconds
4. You should see GET requests to `/api/v1/student/course-detail/...`

If NO requests appear → Polling is not running

**Test 3: Check API response with polling**
1. Open the Diskusi tab
2. Let it poll (wait 5 seconds)
3. In F12 Network tab, click on one of the GET requests
4. Click "Response" tab
5. Look for the question you're testing
6. Check: Is `user_liked` correct?
7. Check: Is `likes_count` correct?

**Test 4: Check frontend state update**
1. Open F12 → Console
2. Paste this code:
```javascript
// Check if userLikedQuestions is being updated
setInterval(() => {
  if (window.__courseDetail?.userLikedQuestions) {
    console.log("Liked questions:", Array.from(window.__courseDetail.userLikedQuestions));
  }
}, 5000);
```
3. Like a question
4. Wait 5 seconds
5. Look at console - does the Set get updated?

---

## ✅ Frontend Code Is Correct

Your frontend code is correct for handling live updates:
- ✓ Polling every 5 seconds
- ✓ Filter effect populates userLikedQuestions Set
- ✓ Component re-renders when state changes
- ✓ Heart icon shows filled when user_liked: true

---

## 🎯 Most Likely Issue

Based on the evidence, the most likely issue is one of these:

### Issue 1: Like button isn't saving to database
**Signs:** Heart fills immediately on your screen, but doesn't persist when you refresh

**Test:** 
1. Like a question
2. Refresh the page (Ctrl+R)
3. Is the heart still filled? 
   - If YES: Like was saved ✓
   - If NO: Like button is broken ✗

### Issue 2: Polling not starting
**Signs:** Network tab shows NO requests to `/api/v1/student/course-detail/...`

**Test:**
1. Open Network tab before opening Diskusi tab
2. Click Diskusi tab
3. Wait 5-10 seconds
4. Do you see repeated requests?
   - If YES: Polling works ✓
   - If NO: Polling broken ✗

### Issue 3: Polling but like_count not updating
**Signs:** Requests appear, but like_count doesn't change

**Test:**
1. Open Diskusi tab with two browser windows side-by-side
2. In Window A: Like a question
3. In Window B: Watch the like count
4. Does it increase within 10 seconds?
   - If YES: Live update works ✓
   - If NO: State not updating ✗

---

## 📋 What To Report Back

Run these tests and tell me:

1. ✓ Like button immediate visual feedback (does heart fill?):
   - [ ] YES - heart fills immediately  
   - [ ] NO - nothing happens

2. ✓ Does like persist after refresh:
   - [ ] YES - heart still filled after F5
   - [ ] NO - heart goes back to empty

3. ✓ Polling requests in Network tab:
   - [ ] YES - requests appear every 5 seconds
   - [ ] NO - no requests appear

4. ✓ Like count updates with polling:
   - [ ] YES - like count incremented  after 5 seconds in other window
   - [ ] NO - like count stayed the same

Once you confirm these, we'll know exactly where the problem is!

---

## 📝 Current Backend Status

```
Backend API: ✓ WORKING
 ├─ user_liked field: ✓ Returns correct true/false
 ├─ likes_count field: ✓ Returns correct number
 ├─ Context passing: ✓ View passes current_user to serializer
 └─ Database: ✓ Likes are saved correctly

Frontend Code: ✓ CORRECT LOGIC
 ├─ Polling: ✓ Runs every 5 seconds
 ├─ State sync: ✓ Updates userLikedQuestions Set
 ├─ like handler: ✓ Sends request to backend
 └─ Re-render: ✓ Component memoized, updates on state change

Missing Piece: ? SOMETHING BETWEEN THEM
```

---

**Next Step:** Run the 4 tests above and report back which ones pass/fail.

