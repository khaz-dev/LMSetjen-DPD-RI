# Forum Live Updates Testing Guide - Phase 7.24.3

## 🎯 Summary of Changes

All three issues in the Diskusi tab have been systematically fixed:

### Backend Changes (Phase 7.24.3) ✅
1. **StudentCourseDetailAPIView** (line 2425-2453)
   - Added `get_serializer_context()` override
   - Passes current user to serializer context
   - Extracts user_id from URL kwargs and loads User object

2. **Question_Answer_MessageSerializer** (line 551-574)
   - Updated `get_user_liked()` to check context['current_user'] first
   - Fallback: request.user, then query_params
   - Now correctly identifies which user is viewing

3. **Question_AnswerSerializer** (line 594-627)
   - Updated `get_user_liked()` with same three-level user detection
   - Returns true/false for each question's user_liked field

### Frontend Changes (Already Applied - Phase 7.24) ✅
1. **Refs-based polling** - Prevents stale closure issues
2. **populateUserLikes** - Uses correct `user_liked` field
3. **userLikedQuestions Set** - Populated from filtered questions
4. **State synchronization** - Both questions and filteredQuestions updated
5. **Filter effect** - Extracts user_liked for each question from API

---

## 📋 Step-by-Step Testing

### STEP 1: Restart Django Backend

**Critical:** The backend changes won't take effect until you restart the server.

```bash
cd backend
# Kill existing Python process (if running)
# Option A: Press Ctrl+C in the terminal where it's running
# Option B: In PowerShell, use: Get-Process python | Stop-Process -Force

# Verify no processes are running
Get-Process python -ErrorAction SilentlyContinue

# Start fresh backend
python manage.py runserver
```

**Expected Output:**
```
Watching for file changes with StatReloader
Django version 4.2, using settings 'backend.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CTRL-BREAK.
```

Wait 5-10 seconds for the server to fully initialize.

---

### STEP 2: Clear Browser Cache

To ensure fresh API responses, clear the browser cache and cookies:

**Chrome/Edge:**
1. Press `Ctrl + Shift + Delete`
2. Select "All time" → "Clear data"
3. Check: Cookies and cached images
4. Click "Clear data"

**Or Use GitHub Codespaces:**
```bash
# If using browser cache issues persist
curl -X GET "http://localhost:8001/api/v1/student/course-detail/3/124632/" \
  -H "Cache-Control: no-cache, no-store, must-revalidate"
```

---

### STEP 3: Open the Diskusi Tab

1. Navigate to: **http://localhost:5174/student/courses/124632/**
2. Click on the **Diskusi** tab
3. Wait for the question list to load
4. **Check Browser Console** (F12 → Console)

---

### STEP 4: Verify Question List Shows Correct Like Status

**What to check:**
- Open the question list view (not the detail/forum-thread)
- Look for questions you've already liked
- **Expected:** Heart icon should be filled ❤️ (red) if you liked it
- **Is showing?** ✅ YES → Live update system is working!
- **Is showing?** ❌ NO → Check diagnos steps below

**Console check:**
```javascript
// Paste this in browser console (F12)
// Should show questions with user_liked: true in the response
document.querySelector('.question-list')?.innerText
```

---

### STEP 5: Test Live Like Count Update (5-second polling)

1. **Open two browser windows:**
   - Window A: http://localhost:5174/student/courses/124632/ (Diskusi tab)
   - Window B: Same URL

2. **In Window B:** Click the heart icon to like/unlike a question
3. **In Window A:** Wait up to 5 seconds
4. **Expected:** Like count updates automatically without refresh

**Console logs to watch for:**
```
[Forum Polling] ✅ Live data refreshed - questions, likes, and reports updated
[CourseDetail] 📋 Populated user likes from question list
```

---

### STEP 6: Test Report Status Live Update

1. **Click a question** to open the detail view (forum-thread)
2. **Click "Laporkan"** button to submit a report
3. **Go back to list view** (click Diskusi tab)
4. **Check the report badge** on the question card
5. **Expected:** Badge shows updated count (or changes to "Dalam Proses")

---

## 🔍 Diagnostic Steps

### Issue: Heart icons not showing filled after restart

**Check 1: Is the API returning user_liked field?**
```bash
# Open developer tools (F12) → Network tab
# Make a request to the Diskusi tab
# Find the request: GET /api/v1/student/course-detail/...
# Click it and look at the Response JSON

# You should see in each question object:
{
  "qa_id": 123,
  "title": "...",
  "user_liked": true,  # ← THIS FIELD MUST BE HERE
  "likes_count": 5,
  ...
}
```

**If `user_liked` is missing or always false:**
1. Backend changes might not have taken effect
2. Try: Hard refresh (Ctrl+Shift+R)
3. Try: Clear browser cache completely
4. Try: Restart Django with fresh Python process

**Check 2: Is the frontend receiving the data?**
```javascript
// Paste in console while Diskusi tab is loading
localStorage.setItem('debug', 'CourseDetail,Forum Polling');
// Then reload the page and watch console logs
```

Expected logs:
```
[CourseDetail] 📋 Populated user likes from question list: {
  "totalQuestions": 8,
  "likedCount": 2,
  "likedIds": ["qa_id_1", "qa_id_5"]
}
```

### Issue: Live updates not refreshing every 5 seconds

**Check 1: Is polling running?**
```javascript
// Paste in console
// Look for these lines in console every 5 seconds:
[Forum Polling] ✅ Live data refreshed
```

If not appearing:
1. Check that you're on the Diskusi tab
2. Check console for JavaScript errors
3. Verify tab is not minimized/backgrounded (browsers pause timers)

**Check 2: View open browser console while polling**
- You should see polling logs every 5 seconds
- If logs stop, polling may have been cleared (tab switch?)

---

## 📊 API Response Verification

### Expected API Response Structure

```json
{
  "qa_id": 124632,
  "title": "Bagaimana cara menggunakan...",
  "message": "...",
  "likes_count": 3,
  "user_liked": true,    // ✨ KEY: Should be true/false based on current user
  "reports_count": 0,
  "profile": {"full_name": "John Doe"},
  "messages": [
    {
      "id": 456,
      "text": "Jawabannya adalah...",
      "likes_count": 1,
      "user_liked": false,   // ✨ Also checks for messages
      "created_at": "2025-02-23T10:00:00"
    }
  ]
}
```

### Test API Response Directly

```bash
# PowerShell: Test the API endpoint directly
# Note: Replace 3 with your actual user_id and 124632 with your course

$response = Invoke-WebRequest `
  -Uri "http://localhost:8001/api/v1/student/course-detail/3/124632/" `
  -Headers @{"Cache-Control"="no-cache"}

$json = $response.Content | ConvertFrom-Json

# Check if user_liked is present and correct
$json.question_answer[0] | Select-Object -Property qa_id, title, user_liked, likes_count
```

---

## ✅ Validation Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Backend restarted | ⬜ | Django runserver showing "Ready to handle requests" |
| Browser cache cleared | ⬜ | Ctrl+Shift+Delete|
| API returns user_liked field | ⬜ | Check Network tab JSON response |
| Heart icon shows filled for liked Q | ⬜ | Visual inspection |
| Like count updates live in 5 sec | ⬜ | Two windows test |
| Polling logs appear in console | ⬜ | "[Forum Polling] ✅ Live data refreshed" |
| Report badge updates live | ⬜ | Submit report, go back to list |
| No JavaScript errors in console | ⬜ | F12 → Console |

---

## 🐛 Common Issues & Solutions

### "user_liked field still false for likes I made"

**Root Cause:** Serializer losing user context
**Fix:**
1. Confirm `StudentCourseDetailAPIView.get_serializer_context()` is in code
2. Restart Django: `python manage.py runserver`
3. Hard refresh browser: `Ctrl+Shift+R`
4. Check network response has `user_liked: true`

### "Polling logs don't appear for 5 seconds"

**Root Cause:** Polling not running or browser tab in background
**Fix:**
1. Keep browser window in foreground
2. Confirm Diskusi tab is active
3. Wait 5-10 seconds for first poll
4. Check console for error messages

### "Like count shows but heart icon is empty"

**Root Cause:** Frontend state not syncing
**Fix:**
1. Open browser console
2. Paste: `localStorage.removeItem('userLikedQuestions')`
3. Reload page
4. Check Network tab shows `user_liked: true` in response

---

## 📝 Phase 7.24.3 Changes Summary

### Files Modified
- ✅ `backend/api/views.py` - Added context passing
- ✅ `backend/api/serializer.py` - Updated both Question serializers
- ✅ `frontend/src/views/student/CourseDetail.jsx` - Already fixed (Phase 7.24)

### Root Causes Fixed
1. **Backend serializer couldn't identify current user** → Now passes user via context
2. **Frontend polling used stale functions** → Now uses refs (already fixed)
3. **State not syncing between list/detail views** → Now syncs both (already fixed)

### Expected Outcome
- Question-cards show filled ❤️ for already-liked questions
- Like counts update live within 5 seconds of polling
- Report status badge updates automatically
- All changes persist when opening detail view

---

## 🚀 Next Steps if Issues Persist

1. **Check Django logs:**
   ```bash
   tail -f backend/django_error.log
   # Look for any exceptions in Question_AnswerSerializer.get_user_liked()
   ```

2. **Check if User object is being found:**
   ```python
   # Add temporary debug logging in views.py get_serializer_context()
   print(f"DEBUG: user_id={user_id}, context['current_user']={context.get('current_user')}")
   ```

3. **Verify database has the likes:**
   ```bash
   cd backend
   python manage.py shell
   >>> from api.models import Question_Answer_Like, User
   >>> user = User.objects.get(id=3)
   >>> likes = Question_Answer_Like.objects.filter(user=user)
   >>> likes.count()  # Should show number of likes
   ```

---

**Status:** All backend + frontend changes applied ✅
**Backend Status:** Awaiting restart and test
**Frontend Status:** Ready for live polling tests

