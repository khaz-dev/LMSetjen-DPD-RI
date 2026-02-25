# Quick Testing Guide: Google Drive Video Duration Extraction (PHASE 4.43.10)

## Prerequisites
1. Backend running: `python manage.py runserver`
2. Frontend running: `npm run dev`
3. A Google Drive video link (ensure it's shared with "Anyone with link" access)
4. Instructor/Teacher account

## Test Setup

Get a Google Drive Video URL:
1. Go to Google Drive
2. Find or upload a video file (MP4, WebM, etc.)
3. Right-click → Share → Copy link
4. Ensure sharing is set to "Anyone with link can view"
5. Example format: `https://drive.google.com/file/d/FILE_ID/view`

## Quick Test #1: Direct API Testing (2 minutes)

### Using Browser Console
```javascript
// In browser console (F12), while logged in as instructor:
fetch('/api/v1/media/video-metadata/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('access_token')
    },
    body: JSON.stringify({
        url: 'https://drive.google.com/file/d/YOUR_FILE_ID/view'
    })
})
.then(r => r.json())
.then(d => console.log('Duration:', d.duration_formatted, '(' + d.duration_seconds + 's)'))
```

**Expected Output:**
```
Duration: 1m 44s (104s)
```

### Using curl (Backend Terminal)
```bash
curl -X POST http://localhost:8001/api/v1/media/video-metadata/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"url": "https://drive.google.com/file/d/FILE_ID/view"}'
```

**Expected Response:**
```json
{
    "duration_seconds": 104.5,
    "duration_formatted": "1m 44s",
    "error": null
}
```

---

## Quick Test #2: Automatic Duration Extraction (5 minutes)

### Step-by-step Instructor Test

1. **Login as Instructor**
   - Go to `http://localhost:5174`
   - Login with instructor account

2. **Navigate to Course Edit**
   - Go to Instructor Dashboard
   - Find a course (or create one if testing)
   - Click "Edit Curriculum"

3. **Add Lesson with Google Drive Link**
   - Click "Tambah Pelajaran" (Add Lesson) button
   - Fill in lesson title: "Test Lesson"
   - In "Link Google Drive" field, paste your Google Drive video URL
   - Press Tab or Enter

4. **Observe**
   - After 2-3 seconds, a toast should appear:
     ```
     ✅ Durasi Video Diekstrak
     Durasi: 1m 44s
     ```
   - The field shows the duration has been extracted

5. **Save Curriculum**
   - Click "Simpan Kurikulum" button
   - Wait for success message

6. **Verify**
   - Refresh the page
   - Go back to course edit
   - Duration should still show "1m 44s"

---

## Quick Test #3: Course Detail Display (3 minutes)

1. **View Course Detail Page**
   - Go to course detail: `http://localhost:5174/course-detail/[course-slug]/`
   - Click "Kurikulum" tab

2. **Check Duration Display**
   - **Expected:** Each lesson shows duration (e.g., "1m 44s")
   - **NOT expected:** "0m" or "N/A" for video lessons

3. **Verify Multiple Lessons**
   - Add 3-4 lessons with different Google Drive videos
   - Verify each shows correct duration

---

## Advanced Test: YouTube Video (Optional)

### Test with YouTube Link
1. Go to YouTube video
2. Copy share URL: `https://www.youtube.com/watch?v=VIDEO_ID`
3. In curriculum editor, paste YouTube URL
4. **Expected:** Duration extracts (e.g., "10m 22s")

---

## Debugging If Duration Doesn't Extract

### Check Backend Logs
```bash
# Terminal running Django server should show:
[VideoMetadata] Extracted duration from https://drive.google.com/file/d/xxx: 104.5s (1m 44s)
```

### Check Browser Console (F12)
Look for messages like:
```javascript
[Curriculum] Extracting duration from link: https://drive.google.com/file/d/...
[Curriculum] Extracted duration: 104s (1m 44s)
```

### Test API Directly
1. Open Browser DevTools (F12)
2. Go to Network tab
3. Add a Google Drive link to curriculum
4. Look for request to `/api/v1/media/video-metadata/`
5. Check response is `200` and includes `duration_seconds`

### Common Issues

**Issue: "Failed to extract metadata: Connection timeout"**
- Video link may be inaccessible
- Check URL is correct
- Verify "Anyone with link" sharing is enabled
- Try a different video

**Issue: Duration not extracted, no error shown**
- Check if yt-dlp is installed: `pip list | grep yt-dlp`
- If missing: `pip install yt-dlp`
- Restart backend server

**Issue: API endpoint not found (404)**
- Verify URL import in `backend/api/urls.py`
- Check `video_metadata_view.py` exists
- Restart backend server

---

## Full Integration Test (10 minutes)

### Complete Workflow
1. **Create New Course** with video lessons
2. **Add Lessons** with Google Drive links
3. **Save Curriculum** (verify duration extraction)
4. **Reload Page** (verify duration persists)
5. **Edit Lesson** (change title, save again)
6. **View Course Detail** (check duration displays)
7. **Enroll as Student** (view course, see durations)

---

## Expected Behavior Summary

| Action | Before Fix | After Fix |
|--------|-----------|-----------|
| Add Google Drive video link | Shows "N/A" | Shows "1m 44s" |
| Edit lesson (keep video) | Duration lost → "0m" | Duration preserved |
| Save curriculum | No duration sent | Duration sent to backend |
| View course detail | Shows "0m" | Shows "1m 44s" |
| Reload page | Still "0m" | Still "1m 44s" |

---

## Success Criteria

✅ **All of the following should be true:**

1. API endpoint `/api/v1/media/video-metadata/` responds with duration
2. Pasting Google Drive URL auto-extracts duration
3. Toast shows extracted duration
4. Duration persists after saving curriculum
5. Course detail shows correct duration in Kurikulum tab
6. Duration doesn't reset when editing lessons

---

## Cleanup After Testing

```bash
# If you created test data:
# Delete test lessons/curriculum from Django admin
# Or delete entire test course

# Optional: Check database
SELECT * FROM api_variantitem WHERE duration IS NOT NULL LIMIT 10;
```

---

## Support

If duration extraction fails:
1. Check Google Drive URL format
2. Verify file is accessible ("Anyone with link")
3. Check yt-dlp is installed: `pip show yt-dlp`
4. Restart backend: `python manage.py runserver`
5. Check Django error logs for details

