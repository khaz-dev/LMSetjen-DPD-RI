# Deep Diagnostic Guide: Avatar Crop Auto-Save Flow

## Status: DEEP DIAGNOSTIC IN PROGRESS

**Issue**: After crop, nothing happens (no toast, no save, no update)

**Root Cause**: Unknown - Added comprehensive logging to trace entire flow

---

## What Was Added

### 1. Detailed Console Logging

Added console.log statements throughout the entire crop and auto-save flow in:
- `frontend/src/views/student/Profile.jsx`
- `frontend/src/views/instructor/Profile.jsx`

### 2. Logging Points

#### In `getCroppedImage()`:
```
🔍 getCroppedImage CALLED with: { crop, fileName }
📐 Canvas prepared: { width, height, scaleX, scaleY }
🎨 Image drawn to canvas
📦 canvas.toBlob callback received, blob: ...
❌ CRITICAL: Blob is null/undefined! ← If this appears, blob creation failed
✅ Blob resolved: { name, size, type }
```

#### In `handleCropComplete()`:
```
🎬 handleCropComplete CALLED
   cropState: { ... }
   imgRef.current exists?: true/false
⚠️ Early return: completedCrop missing or no imgRef
🔄 Starting crop process...
✅ Crop completed, blob received: Blob { ... }
🖼️ Setting image preview...
📢 Showing success toast...
⏰ Setting setTimeout for submitImageOnly...
⏰ setTimeout fired! Calling submitImageOnly()...
```

#### In `submitImageOnly()`:
```
📤 submitImageOnly CALLED
👤 userId from UserData(): 123
🔄 Fetching current profile from /user/profile/123/
✅ Profile fetched: { ... }
📝 Creating FormData...
📝 FormData created with: { fileName, blobSize }
📡 Sending PATCH to /user/profile/123/
✅ API Response received: { ... }
✅ ProfileContext updated
✅ Local profileData updated
✅ Image preview updated: /media/user_profile_images/file.jpg
📢 Showing success toast...
❌ Error saving image: { message, response, status }
```

---

## How To Diagnose

### Step 1: Start Servers

```bash
# Terminal 1 - Backend
cd backend
python manage.py runserver 0.0.0.0:8001

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Step 2: Open Browser Console

1. Open browser to `http://localhost:5176/` (or 5174/5175 if those are in use)
2. Press F12 to open Developer Tools
3. Click "Console" tab
4. **Leave console open during testing**

### Step 3: Test the Crop Flow

1. Navigate to Student Profile or Instructor Profile
2. Click "Pilih File" to select an image
3. Crop modal should appear
4. **Watch console as you do this** - you should see:
   ```
   🔍 getCroppedImage CALLED with: ...
   📐 Canvas prepared: ...
   ```

5. Adjust crop area by dragging the circle
6. Click "Apply Crop" button
7. **Watch console closely** - you should see logs starting with:
   ```
   🎬 handleCropComplete CALLED
   cropState: { ...
   ```

### Step 4: Analyze Console Output

#### If you see "🎬 handleCropComplete CALLED":
- ✅ Button click is working
- ✅ Function is being called
- Continue to next step

#### If you DON'T see "🎬 handleCropComplete CALLED":
- ❌ **PROBLEM**: Button click isn't triggering the function
- **Check**: Is the button disabled/greyed out?
- **Check**: Is there a JavaScript error in console?
- **Action**: Look for red error messages in console

#### If you see "⚠️ Early return: completedCrop missing or no imgRef":
- ❌ **PROBLEM**: Crop state not properly updated
- **Issue**: `cropState.completedCrop` is null/falsy
- **Why**: ReactCrop.onComplete() not being called
- **Action**: Check if you're actually dragging/resizing the crop area

#### If you see "✅ Crop completed, blob received: Blob { ... }":
- ✅ Cropping is working
- ✅ Canvas created blob successfully
- Continue to next step

#### If you see "❌ CRITICAL: Blob is null/undefined!":
- ❌ **PROBLEM**: Canvas.toBlob() returned null
- **Rare**: This shouldn't happen in normal conditions
- **Possible cause**: Canvas context issue or memory problem
- **Try**: Crop a different image or clear browser cache

#### If you see "⏰ setTimeout fired! Calling submitImageOnly()...":
- ✅ Async callback working
- ✅ Auto-save is being triggered
- Continue to next step

#### If you DON'T see "⏰ setTimeout fired!":
- ❌ **PROBLEM**: setTimeout callback never fires
- **Why**: Page might be navigating away or component unmounting
- **Check**: Are you clicking something else or refreshing?

#### If you see "📤 submitImageOnly CALLED":
- ✅ Auto-save function is executing
- Continue to next step

#### If you see  "👤 userId from UserData(): undefined":
- ❌ **PROBLEM**: User not logged in or UserData() returning null
- **Action**: Log out and log back in
- **Action**: Check if session expired

#### If you see "❌ Error saving image: { message, ... }":
- ❌ **PROBLEM**: API call failed
- **Details**: Check the `message` and `response` fields
- **Common errors**:
  - 401 Unauthorized - session expired
  - 400 Bad Request - malformed image
  - 500 Server Error - backend issue
  - Network Error - backend not running

#### If you see "✅ Image preview updated: /media/...":
- ✅ **SUCCESS**: Image saved to backend!
- ✅ Check page - avatar should update
- ✅ Look for "Foto Profil Berhasil Disimpan" toast

---

## Console Log Timeline

### Expected Success Flow

```
🔍 getCroppedImage CALLED with: { crop, fileName }
📐 Canvas prepared: { width, height, scaleX, scaleY }
🎨 Image drawn to canvas
📦 canvas.toBlob callback received, blob: Blob { }
✅ Blob resolved: { name, size, type }

🎬 handleCropComplete CALLED
   cropState: { completedCrop: {...} }
   imgRef.current exists?: true
🔄 Starting crop process...
✅ Crop completed, blob received: Blob { ... }
🖼️ Setting image preview...
📢 Showing success toast...
⏰ Setting setTimeout for submitImageOnly...

⏰ setTimeout fired! Calling submitImageOnly()...
📤 submitImageOnly CALLED
👤 userId from UserData(): 5
🔄 Fetching current profile from /user/profile/5/
✅ Profile fetched: { image: "...", ... }
📝 Creating FormData...
📝 FormData created with: { fileName: "image.jpg", blobSize: 45234 }
📡 Sending PATCH to /user/profile/5/
✅ API Response received: { image: "/media/user_profile_images/abc123.jpg", ... }
✅ ProfileContext updated
✅ Local profileData updated
✅ Image preview updated: /media/user_profile_images/abc123.jpg
📢 Showing success toast...
```

### Problem Scenarios

#### Scenario A: Crop Button Not Working
```
(no console output at all when button clicked)
→ Check if button is disabled
→ Check for red errors in console
```

#### Scenario B: Crop Not Detected
```
🎬 handleCropComplete CALLED
   cropState: { completedCrop: null }  ← ❌ NULL!
   imgRef.current exists?: true
⚠️ Early return: completedCrop missing or no imgRef
→ User didn't actually crop the image
→ ReactCrop event not firing
```

#### Scenario C: Blob Creation Failed
```
🔍 getCroppedImage CALLED with: { crop, fileName }
📐 Canvas prepared: { width, height, scaleX, scaleY }
🎨 Image drawn to canvas
📦 canvas.toBlob callback received, blob: null ← ❌ NULL!
❌ CRITICAL: Blob is null/undefined!
→ Canvas issue or memory problem
→ Clear cache and try again
```

#### Scenario D: Auto-Save Function Not Triggering
```
⏰ Setting setTimeout for submitImageOnly...
(no "setTimeout fired" message appears)
→ Page is being navigated away
→ Component unmounting
→ Check browser tabs
```

#### Scenario E: API Call Failed
```
⏰ setTimeout fired! Calling submitImageOnly()...
📤 submitImageOnly CALLED
👤 userId from UserData(): 5
🔄 Fetching current profile from /user/profile/5/
❌ Error saving image: { 
    message: "Request failed with status 401",
    response: { status: 401 },
    status: 401
}
→ User session expired
→ Log out and log back in
```

#### Scenario F: Backend Not Running
```
⏰ setTimeout fired! Calling submitImageOnly()...
📤 submitImageOnly CALLED
👤 userId from UserData(): 5
🔄 Fetching current profile from /user/profile/5/
❌ Error saving image: { 
    message: "Network Error",
    response: undefined,
    status: undefined
}
→ Backend server not running
→ Start backend: python manage.py runserver 0.0.0.0:8001
```

---

## Quick Troubleshooting Checklist

- [ ] Both servers running (backend port 8001, frontend port 5176+)?
- [ ] Logged in to the system?
- [ ] Browser console is open and visible?
- [ ] Actually dragging/resizing the crop circle?
- [ ] "Apply Crop" button is enabled (not greyed out)?
- [ ] No red errors in console?
- [ ] Toast notifications appearing for other actions?

---

## Next Steps

1. **Start both servers** as shown above
2. **Open browser console** (F12)
3. **Test the crop flow** and watch console
4. **Note the first log line that DOESN'T appear**
5. **That's where the problem is**
6. Share the console output with all the log messages you see

---

## Files Modified

✨ **Added detailed logging to**:
- `frontend/src/views/student/Profile.jsx`
  - `getCroppedImage()` function (line 114)
  - `handleCropComplete()` function (line 504)
  - `submitImageOnly()` function (line 320)

- `frontend/src/views/instructor/Profile.jsx`
  - `getCroppedImage()` function (line 105)
  - `handleCropComplete()` function (line 421)
  - `submitImageOnly()` function (line 243)

✨ **Also fixed**:
- `getCroppedImage()` now properly rejects the promise if blob is null (instead of silently hanging)
- Added detailed error information in catch blocks

---

## Testing Commands

```bash
# Start backend
cd backend && python manage.py runserver 0.0.0.0:8001

# Start frontend (in another terminal)
cd frontend && npm run dev

# Open in browser
# http://localhost:5176 (or whatever port was shown)

# Then test the crop flow and watch console logs
```

---

**Status**: Diagnostic logging complete - awaiting console output from testing
