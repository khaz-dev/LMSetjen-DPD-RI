# CRITICAL: Avatar Crop Auto-Save Debugging Instructions

## Status: Comprehensive Logging Added - Need Browser Console Output

---

## TL;DR - What To Do Now

### 1. Start the servers (if not already running):
```bash
# Terminal 1
cd backend
python manage.py runserver 0.0.0.0:8001

# Terminal 2  
cd frontend
npm run dev
```

### 2. Open browser and navigate to: `http://localhost:5176`

### 3. **CRITICAL**: Open the browser console:
- Press **F12** (or Ctrl+Shift+I)
- Click the **Console** tab
- Keep the console visible

### 4. Test the avatar crop:
1. Log in
2. Go to Student or Instructor Profile
3. Click "Pilih File" to select an image
4. Wait for crop modal to appear
5. **IMPORTANT**: Drag the white circle (the crop area) to adjust/move it
6. Click "Apply Crop" button
7. **WATCH THE CONSOLE** and screenshot/note what appears

### 5. Report exactly what you see in the console

---

##  What We're Looking For

### SCENARIO A: SUCCESS (You should see this)
```
🔍 getCroppedImage CALLED with: { crop: {...}, fileName: "..." }
📐 Canvas prepared: { width: 200, height: 200, scaleX: 1.5, scaleY: 1.5 }
🎨 Image drawn to canvas
📦 canvas.toBlob callback received, blob: Blob { size: 12345, type: 'image/jpeg' }
✅ Blob resolved: { name: "image.jpg", size: 12345, type: 'image/jpeg' }
🎬 handleCropComplete CALLED
   cropState: { completedCrop: { x: 50, y: 50, width: 200, height: 200 }, ... }
   imgRef.current exists?: true
🔄 Starting crop process...
✅ Crop completed, blob received: Blob { size: 12345 }
🖼️ Setting image preview...
📢 Showing success toast...
⏰ Setting setTimeout for submitImageOnly...
⏰ setTimeout fired! Calling submitImageOnly()...
📤 submitImageOnly CALLED
👤 userId from UserData(): 5
🔄 Fetching current profile from /user/profile/5/
✅ Profile fetched: { full_name: "...", image: "...", ... }
📝 Creating FormData...
📝 FormData created with: { fileName: "image_abc123.jpg", blobSize: 12345 }
📡 Sending PATCH to /user/profile/5/
✅ API Response received: { full_name: "...", image: "/media/user_profile_images/file.jpg", ... }
✅ ProfileContext updated
✅ Local profileData updated
✅ Image preview updated: /media/user_profile_images/file.jpg
📢 Showing success toast...
```
✅ **EXPECTED**: Avatar updates + Toast appears "Foto Profil Berhasil Disimpan"

---

### SCENARIO B: Button Might Be Disabled (You might see nothing)
```
(no console output at all when you click "Apply Crop")
```
**LIKELY CAUSE**: The "Apply Crop" button is disabled because you haven't dragged the crop circle.  
**FIX**: Click and drag the white circle in the crop modal to move/resize it, then click "Apply Crop"

---

### SCENARIO C: Early Return (Crop incomplete)
```
🎬 handleCropComplete CALLED
   cropState: { completedCrop: null }  ← ⚠️ MISSING!
   imgRef.current exists?: true
⚠️ Early return: completedCrop missing or no imgRef
```
**LIKELY CAUSE**: ReactCrop didn't register your crop action  
**FIX**: Make sure you're actually dragging/resizing the crop circle visibly

---

### SCENARIO D: Crop Error
```
🎬 handleCropComplete CALLED
...
❌ Error cropping image: DOMException: Canvas error
Toast: "Gagal memotong gambar"
```
**LIKELY CAUSE**: Canvas issue or image corruption  
**FIX**: Try a different image or refresh the page

---

### SCENARIO E: API Error (Network/Backend)
```
...
⏰ setTimeout fired! Calling submitImageOnly()...
📤 submitImageOnly CALLED
👤 userId from UserData(): 5
🔄 Fetching current profile from /user/profile/5/
❌ Error saving image: { 
    message: "Request failed with status 401",
    response: { status: 401 },
    status: 401
}
Toast: "Gagal Menyimpan Foto"
```
**LIKELY CAUSE**: Session expired or backend not running  
**FIX**: 
- Log out and log back in
- Check if backend is actually running (`python manage.py runserver 0.0.0.0:8001`)
- Check for network errors in "Network" tab of DevTools

---

### SCENARIO F: API Error, Backend Not Running
```
...
🔄 Fetching current profile from /user/profile/5/
❌ Error saving image: { 
    message: "Network Error",  ← Network issue!
    response: undefined,
    status: undefined
}
```
**LIKELY CAUSE**: Backend server not running on port 8001  
**FIX**: 
```bash
cd backend
python manage.py runserver 0.0.0.0:8001
```

---

## What Changed in Code

### Added comprehensive logging to:
✨ `frontend/src/views/student/Profile.jsx`
- `getCroppedImage()` function with 5 log points
- `handleCropComplete()` function with 10 log points  
- `submitImageOnly()` function with 15 log points

✨ `frontend/src/views/instructor/Profile.jsx`
- Same logging added for consistency

### Also fixed:
✨ `getCroppedImage()` now properly rejects promise if blob is null (instead of hanging silently)

✨ Detailed error information in catch blocks

---

## If You Don't See Any Console Logs At All

1. **Check if the button is clickable**:
   - If greyed out: You need to drag the crop circle first
   - If not greyed out: Click it and watch the console

2. **Check for JavaScript errors in console**:
   - Look for red text (errors)  
   - These would appear even if our logging doesn't

3. **Check if you're in the right browser tab**:
   - Make sure DevTools is open on the same browser tab with the form

---

## Quick Verification Checklist

Before testing, verify:
- [ ] Backend running? (`python manage.py runserver 0.0.0.0:8001`)
- [ ] Frontend running? (`npm run dev`)
- [ ] Logged in to the system?
- [ ] Browser console is open (F12)?
- [ ] Console is visible while you're testing?
- [ ] You're dragging the crop circle (not just clicking)?
- [ ] The "Apply Crop" button is NOT greyed out?

---

## How To Share The Logs

When you test and see the console output:
1. **Screenshot the console** showing all the log messages, OR
2. **Copy-paste the console text** starting from "🔍" or "🎬" all the way down

This will help us identify exactly where the problem is!

---

## Expected Result (Success Case)

When you successfully crop an image:

1. **Modal closes** (crop window disappears)
2. **Avatar preview updates** (you see the cropped image)
3. **Toast appears** for ~2-3 seconds: "Foto Profil Berhasil Disimpan"
4. **BaseHeader updates** automatically (avatar in top-right updates)
5. **Page refresh** keeps the avatar (it was saved to backend)

Any of these not happening = pinpoint the issue from the console logs.

---

## Next Step For You

👉 **Open browser console and test the crop flow, then share what you see!**

Once you share the console logs, we'll immediately know what's wrong and fix it.
