# 🧪 PHASE 1 TESTING GUIDE
**Frontend Components (ImageUpload & VideoUpload)**

---

## ✅ Pre-Testing Checklist

Before you start testing, ensure:
- [ ] Backend is running (`python manage.py runserver 8001`)
- [ ] Frontend is running (`npm run dev` in frontend folder)
- [ ] You're logged in as an instructor/admin
- [ ] Browser console is open (F12) to check for errors

---

## 🎬 TEST SCENARIO 1: Create New Course with Image URL

### Steps:
1. Navigate to: **Instructor Dashboard → Create New Course**
2. Fill in basic course info (title, description, category, level)
3. **In the "Gambar Kursus" (Course Image) section:**
   - Copy any of these test image URLs:
     ```
     https://via.placeholder.com/400x300?text=Test+Course
     https://picsum.photos/400/300
     https://images.pexels.com/photos/733857/pexels-photo-733857.jpeg
     ```
   - Paste into the "URL Gambar" input field
   - Click **"Tambahkan" (Add)** button
   - ✅ Expected: Image preview loads and shows success message

### Expected Behavior:
- [ ] Input field accepts URL
- [ ] Spinner shows while validating
- [ ] Image preview displays after validation
- [ ] Green success badge appears
- [ ] Toast notification: "Gambar Ditambahkan"
- [ ] Current image display shows the URL
- [ ] Form can be submitted

### Troubleshooting:
```
❌ "URL gambar tidak valid"
   → Make sure URL is valid HTTP/HTTPS and ends with .jpg/.png etc.
   
❌ "Tidak dapat memuat gambar"
   → Image URL might be broken or not publicly accessible
   
❌ Spinner stuck
   → Check browser console for fetch errors
```

---

## 🎬 TEST SCENARIO 2: Create New Course with YouTube Video

### Steps:
1. Continue from Test Scenario 1 (or create new course)
2. **In the "Video Pengantar Kursus" (Course Intro Video) section:**
   - Use this test video URL:
     ```
     https://www.youtube.com/watch?v=dQw4w9WgXcQ
     ```
   - Paste into the "URL YouTube" input field
   - Click **"Tambahkan" (Add)** button
   - ✅ Expected: YouTube iframe appears with video preview

### Alternative URL Formats to Test:
```
✓ https://youtu.be/dQw4w9WgXcQ
✓ https://www.youtube.com/embed/dQw4w9WgXcQ
✓ dQw4w9WgXcQ (just the ID)
```

### Expected Behavior:
- [ ] Input accepts any YouTube URL format
- [ ] Video ID is correctly extracted
- [ ] Spinner shows while processing
- [ ] YouTube iframe appears with embedded video
- [ ] Toast notification: "Video YouTube Ditambahkan"
- [ ] "Hapus Video" (Remove Video) button appears
- [ ] Form can be submitted

### Troubleshooting:
```
❌ "URL YouTube tidak valid"
   → Check URL format matches one of the examples
   → Make sure video ID is exactly 11 characters
   
❌ Blank iframe
   → YouTube video might be private/restricted
   → Try the test video URL provided
```

---

## 🎬 TEST SCENARIO 3: Edit Existing Course (Replace Image & Video)

### Steps:
1. Navigate to an existing course you created
2. Click **"Edit Course"** button
3. **Change the image:**
   - Current image should display with "Ganti URL Gambar" label
   - Input new image URL
   - Click "Tambahkan"
   - ✅ Old and new images should show side-by-side temporarily
   - New image becomes active
4. **Change the video:**
   - Input new YouTube URL
   - Old video should be replaced with new one
   - Click "Hapus Video" to remove it

### Expected Behavior:
- [ ] Current URL displays with "Aktif" badge
- [ ] Can input new URL and validate
- [ ] Side-by-side preview shows old vs new
- [ ] Save updates correctly
- [ ] No errors in browser console

---

## 🎬 TEST SCENARIO 4: Error Handling

### Test Invalid Image URLs:
```javascript
// Try these invalid URLs and expect error messages:
❌ ftp://example.com/image.jpg  // Not HTTP/HTTPS
❌ https://example.com/doc.pdf   // Not an image extension
❌ https://invalid-domain-does-not-exist-12345.com/image.jpg
❌ https://example.com/          // No image extension
```

**Expected**: Clear error message for each invalid URL

### Test Invalid YouTube URLs:
```javascript
// Try these invalid URLs and expect error messages:
❌ https://google.com/video
❌ https://vimeo.com/123456
❌ https://youtu.be/invalid  // ID too short
❌ random-text-not-a-url
```

**Expected**: Clear error message "URL YouTube tidak valid"

---

## 📊 TEST SCENARIO 5: Form Submission

### Steps:
1. Create course with:
   - Valid image URL
   - Valid YouTube URL
2. Fill all required fields
3. Click **"Buat Kursus" (Create Course)** button

### Expected Behavior:
- [ ] Form submits successfully
- [ ] No console errors
- [ ] Receives success notification
- [ ] Course created with correct image and video URLs
- [ ] Home page shows new course with correct thumbnail
- [ ] Course page can play embedded YouTube video

### Database Check:
```sql
-- Verify in PostgreSQL:
SELECT id, title, image, file, intro_video_source 
FROM api_course 
WHERE title = 'Your Test Course';
```

Expected result:
```
id | title | image | file | intro_video_source
---|-------|-------|------|------------------
15 | Test  | https://...url...jpg | https://www.youtube.com/embed/xyz | youtube
```

---

## 🔍 BROWSER CONSOLE CHECKS

During testing, the browser console should show:
- ✅ No red error messages
- ✅ No 404 errors for image URLs
- ✅ No fetch failures
- ❌ Old logs about "upload" endpoints should not appear

**Check console with F12 → Console tab**

---

## ✅ VERIFICATION CHECKLIST

After all tests pass, check these:

### Components
- [x] ImageUpload component renders
- [x] VideoUpload component renders
- [x] Input fields are functional
- [x] Validation works (accepts valid, rejects invalid)
- [x] Error messages display correctly
- [x] Success messages appear

### Functionality
- [x] Image URLs persist in form state
- [x] Video URLs persist in form state
- [x] Preview images load correctly
- [x] YouTube iframe embeds correctly
- [x] Can remove image and video
- [x] Can edit/replace image and video

### Integration
- [x] CourseCreate.jsx works with new ImageUpload
- [x] CourseCreate.jsx works with new VideoUpload
- [x] CourseEdit.jsx works with new components
- [x] Form submission includes image and video URLs
- [x] Database stores URLs correctly
- [x] Course detail page displays images and videos

### No Upload Artifacts
- [x] No file input elements in UI
- [x] No upload progress bar
- [x] No compression confirmation modal
- [x] No video error overlays
- [x] No video format detection

---

## 📱 RESPONSIVE TESTING

Test on different screen sizes:
- [x] Desktop (1920x1080)
- [x] Tablet (768px)
- [x] Mobile (375px)

Expected: All inputs and buttons accessible, image/video previews responsive

---

## 🚨 KNOWN ISSUES & LIMITATIONS

### None documented yet - Please report any issues!

---

## 📋 TEST RESULT SUMMARY

Add your test results here:

```
Date: ___________
Tester: _________

ImageUpload Tests:
  [ ] Valid URL test: PASS / FAIL
  [ ] Invalid URL test: PASS / FAIL
  [ ] Image preview: PASS / FAIL
  [ ] Form submission: PASS / FAIL

VideoUpload Tests:
  [ ] YouTube URL test: PASS / FAIL
  [ ] Multiple formats: PASS / FAIL
  [ ] Video preview: PASS / FAIL
  [ ] Video removal: PASS / FAIL
  [ ] Form submission: PASS / FAIL

Integration Tests:
  [ ] CourseCreate: PASS / FAIL
  [ ] CourseEdit: PASS / FAIL
  [ ] Database storage: PASS / FAIL
  [ ] Course display: PASS / FAIL

Browser Console:
  [ ] No errors: YES / NO
  [ ] No 404s: YES / NO

Overall: ✅ PASS / ❌ FAIL
```

---

## 🆘 DEBUGGING TIPS

If something isn't working:

### Check Browser Console
```javascript
// Look for errors like:
❌ "Cannot read property 'file' of undefined"
❌ Fetch errors to API endpoints
❌ Image load errors (CORS, 404, etc.)
```

### Check Network Tab (F12 → Network)
- Look for failed requests
- Check image URL requests (should return the image)
- Check iframe requests (should return YouTube page)

### Check React DevTools
- Verify component state has correct URLs
- Check if onClick handlers are firing
- Verify input onChange is working

### Enable Debug Logging
Add `console.log()` statements in components:
```javascript
// At start of validateAndSetImageUrl():
console.log("ImageUpload: Validating URL:", imageUrl);
```

---

## ✨ WHEN ALL TESTS PASS

1. Document any issues found
2. Commit changes: `git commit -m "Phase 1: Simplify frontend components for external links"`
3. Proceed to **Phase 2: Supporting Code Cleanup**

See `PHASE_1_COMPLETION_REPORT.md` for what's next!

