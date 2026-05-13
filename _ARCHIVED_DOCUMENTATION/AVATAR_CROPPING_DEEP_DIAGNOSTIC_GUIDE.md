# Avatar Cropping Deep Diagnostic Guide - Phase 11.4+

## Objective
Trace **exactly where** the cropped image blob disappears and gets replaced with the full uncropped image.

## Critical Question Being Investigated
**Why is the full uncropped image being saved to backend instead of the cropped blob?**

Possible scenarios:
1. ❌ Cropped blob is NULL (never created by canvas.toBlob)
2. ❌ Cropped blob exists but contains FULL image (canvas drawing wrong area)
3. ❌ Cropped blob is cleared before submitImageOnly is called
4. ❌ submitImageOnly is using profileData.image instead of imageState.croppedBlob
5. ❌ Race condition: setState not finished when setTimeout calls submitImageOnly

---

## Enhanced Diagnostics Locations

### A. getCroppedImage() - Canvas Generation
**File**: `frontend/src/views/student/Profile.jsx` (lines 130-169)

**What to watch for**:
- Canvas dimensions being set correctly
- Crop region coordinates being passed correctly
- Image scaling calculations (scaleX, scaleY)
- Final blob size in KB

**Expected logs**:
```
📍 Crop region being extracted: { sourceX: 150, sourceY: 100, ... }
Canvas prepared: { canvasWidth: 300, canvasHeight: 300, scaleX: 2, scaleY: 2 }
Cropped blob size: 45.23 KB
```

**What indicates a problem**:
- Canvas size = 0
- sourceX/sourceY are wrong (negative or too large)
- Blob size is the SAME as original image
- Blob size is very small (indicates only small part captured)

---

### B. handleCropComplete() - State Update
**File**: `frontend/src/views/student/Profile.jsx` (lines 576-630)

**What to watch for**:
- When getCroppedImage() is called
- When the blob is received
- When imageState.croppedBlob is set
- When submitImageOnly() is called

**Expected logs**:
```
🎬 handleCropComplete STARTED - cropping image
📝 Awaiting getCroppedImage() result...
✅ Cropped blob received: 45.23 KB
💾 imageState.croppedBlob SET in state
📤 calling submitImageOnly() via setTimeout...
```

**What indicates a problem**:
- getCroppedImage shows blob size = original size
- submitImageOnly is called but logs below don't show cropped blob existing

---

### C. submitImageOnly() - State Check at Entry
**File**: `frontend/src/views/student/Profile.jsx` (lines 344-371)

**NEW: IMMEDIATE STATE CHECK** - First thing logged when function is called:
```
💾 IMMEDIATE STATE CHECK (before any async operations):
   imageState.croppedBlob: {
     exists: true/false,
     isBlob: true/false,
     size: "45.23 KB" or "NULL",
     type: "image/jpeg"
   }
   profileData.image: {
     exists: true/false,
     isBlob: true/false,
     size: "2048.50 KB" or "Not a Blob",
     type: "typeof profileData.image"
   }
   imageState.selected: {
     exists: true/false,
     type: "string" (usually it's a blob URL)
   }
```

**NEW: ABOUT TO SUBMIT - Final state check**:
```
🔍 ABOUT TO SUBMIT - Final state check:
   imageState.croppedBlob exists?: true/false
   imageState.croppedBlob size: 45.23 KB or NOT SET
   profileData.image type: object/Blob/undefined
```

**Critical indicators**:
- If `imageState.croppedBlob exists: false` → Issue is STATE NOT BEING SET
- If size is same as original → Issue is CROPPING CANVAS LOGIC
- If type is not Blob → Issue is BLOB CREATION FAILURE

---

### D. createFormData() - Branch Decision Logic
**File**: `frontend/src/views/student/Profile.jsx` (lines 91-124)

**What to watch for**:
- Which branch is being EXECUTED

**Expected logs**:
```
📝 createFormData CALLED with: {
  croppedImageBlobExists: true,
  croppedImageBlobSize: "45.23 KB"
}
```

Then ONE of these three branches:
```
Branch 1: profileData.image === null → Deleting image
Branch 2 ✅: Using CROPPED blob → "45.23 KB"
Branch 3 ❌: Using profileData.image (UNCROPPED!) → "2048.50 KB"
```

**Critical finding**:
- If seeing "Branch 3" → cropped blob is NULL and it's falling back to uncropped
- If seeing "Branch 2" but file size in backend is large → Canvas drawing wrong area
- If seeing "Branch 1" → That's deletion mode

---

## Step-by-Step Testing Instructions

### Test 1: Canvas Cropping Works
1. **Open DevTools** (F12) → Console tab
2. **Navigate to Student Profile**
3. **Select a LARGE image** (2MB+ if possible, at least 1000x1000 px)
4. **Watch for these logs**:
   ```
   getCroppedImage() logs showing canvas dimensions
   Cropped blob size should be MUCH SMALLER than original
   ```
5. **In the crop modal**:
   - Draw a crop box that covers only PART of the image
   - Click "Apply Crop"
6. **Check console output**:
   - Document the exact blob size from getCroppedImage logs
   - Document the original file size

### Test 2: State Being Preserved
1. **Continue in same console session**
2. **Before crop modal closes**, write down:
   - Time when handleCropComplete STARTS
   - Cropped blob size shown
3. **Immediately after modal closes**, check:
   - First log from submitImageOnly should show `exists: true`
   - The size should match what getCroppedImage reported
4. **If size doesn't match**:
   - There's a state management issue
   - Focus on handleCropComplete → state update timing

### Test 3: FormData Branch Selection
1. **Look for this specific log output**:
   ```
   🔀 createFormData: Branch [1/2/3]
   ```
2. **Document which branch**:
   - Branch 1 = First condition triggered
   - Branch 2 = Using cropped blob ✅
   - Branch 3 = Using uncropped image ❌
3. **If Branch 3**:
   - uploadImageOnly shows cropped blob exists
   - But createFormData shows it as NULL
   - This means the parameter isn't being passed correctly

### Test 4: Backend File Size Inspection
1. **After upload completes**:
   - Navigate to `backend/media/user_profile_images/`
   - Find your avatar file (should be named `user_[ID].[ext]`)
   - Check file size in bytes:
     - Small (50-200 KB) = Cropping worked ✅
     - Large (>1000 KB) = Full image was saved ❌
2. **In browser DevTools Network tab**:
   - Find the PATCH request to `/user/profile/[ID]/`
   - Check "Request Payload" → look for image FormData value
   - The size shown should match cropped size

---

## Likely Root Causes & How to Identify Them

### Scenario 1: Canvas Not Creating Cropped Blob
**Symptoms**:
- getCroppedImage logs show `Cropped blob size: NULL` or same as original
- Canvas logs show wrong dimensions

**Verification**:
```javascript
// In console, after clicking crop but before modal closes:
console.log(imageState.croppedBlob);
// Should be a Blob, not NULL
// Should have smaller size than screen size
```

**Fix location**: `getCroppedImage()` function - check canvas.drawImage call

---

### Scenario 2: State Update Race Condition
**Symptoms**:
- getCroppedImage creates small blob (correct)
- handleCropComplete receives blob (logs show it)
- But submitImageOnly shows `exists: false`

**Why**: setTimeout runs before setState completes (React batching)

**Verification**:
- handleCropComplete logs show blob size
- submitImageOnly IMMEDIATE STATE CHECK shows `exists: false`

**Fix location**: Increase setTimeout delay or use state callback

---

### Scenario 3: Branch 3 Being Taken
**Symptoms**:
- submitImageOnly shows `croppedBlob exists: true`
- But createFormData shows `Branch 3 - Using profileData.image`

**Why**: Parameter not passed correctly to createFormData

**Verification**:
- Blob sizes in submitImageOnly logs vs createFormData logs differ
- Branch 3 message appears in console

**Fix location**: submitImageOnly parameter passing to createFormData

---

### Scenario 4: Cropped Blob Contains Full Image
**Symptoms**:
- All logs show proper sizes
- But backend file is large (full image)
- Canvas dimensions appear correct

**Why**: Canvas.drawImage() drawing wrong source region

**Verification**:
- getCroppedImage shows blob size matches cropped area size mathematically
- But actual image saved is full image
- Crop coordinates shown in logs don't match crop box drawn

**Fix location**: Canvas drawing logic in getCroppedImage

---

## Detailed Log Output Reference

When everything is working correctly, you should see this sequence:

```
// 1. User selects file
📂 handleFileChange CALLED - file selected
   file.name: [filename]
   file.size: [bytes]
   File stored in profileData.image

// 2. User draws crop and clicks "Apply Crop"
🎬 handleCropComplete STARTED
📝 Awaiting getCroppedImage() result...

// 3. Canvas generates cropped blob
📍 Crop region: { sourceX: 150, sourceY: 100, ... }
Canvas: { width: 300, height: 300, scaleX: 2, scaleY: 2 }
Cropped blob size: 45.23 KB              ← Should be MUCH smaller

// 4. State is updated with blob
💾 imageState.croppedBlob SET in state
✅ Cropped blob stored: 45.23 KB

// 5. Auto-submit starts (after 100ms)
📤 submitImageOnly CALLED

// 6. IMMEDIATE STATE CHECK (critical for diagnosis)
💾 IMMEDIATE STATE CHECK:
   imageState.croppedBlob: { exists: true, size: "45.23 KB" }
                                          ↑ Should say TRUE
   
// 7. Before submission
🔍 ABOUT TO SUBMIT:
   imageState.croppedBlob exists?: true
   imageState.croppedBlob size: 45.23 KB

// 8. FormData creation decides which to use
🔀 createFormData: Branch 2 - Using CROPPED blob
   Blob size: 45.23 KB                   ← Should be CROPPED size

// 9. Sent to backend
✅ Image saved successfully
```

---

## What to Do With Your Findings

**If you see**:

1. **Canvas shows small blob, but submitImageOnly shows `exists: false`**
   → State update timing issue, need to increase setTimeout or use state callback

2. **submitImageOnly shows blob exists, but createFormData shows Branch 3**
   → Parameter passing issue between functions

3. **Canvas shows blob size = original size**
   → Canvas.drawImage() is drawing wrong area, check getDCroppedImage calculations

4. **All logs are correct, but backend file is large**
   → Backend is receiving the full image somehow, check server-side or request

5. **All logs show correct sizes, backend file is correct size**
   → SUCCESS! Cropping is working, test completed

---

## Sample Test Session Output

Here's what a successful test should look like:

```
Profile.jsx:100 📂 handleFileChange CALLED
Profile.jsx:150 getCroppedImage STARTED
Profile.jsx:160 📍 Crop region: {sourceX: 0, sourceY: 50, width: 400, height: 300}
Profile.jsx:165 Canvas prepared: {width: 400, height: 300, scaleX: 1, scaleY: 1}
Profile.jsx:168 Cropped blob size: 82.45 KB
Profile.jsx:580 🎬 handleCropComplete STARTED
Profile.jsx:600 ✅ Cropped blob received: 82.45 KB
Profile.jsx:620 💾 imageState.croppedBlob SET
Profile.jsx:625 📤 calling submitImageOnly() after 100ms
Profile.jsx:350 📤 submitImageOnly CALLED - AUTO-SAVE STARTING
Profile.jsx:352 💾 IMMEDIATE STATE CHECK:
   imageState.croppedBlob: {exists: true, size: "82.45 KB", isBlob: true}
   profileData.image: {exists: true, size: "2048.50 KB", type: "File"}
Profile.jsx:400 🔍 ABOUT TO SUBMIT - Final state check:
   imageState.croppedBlob exists?: true
   imageState.croppedBlob size: 82.45 KB
Profile.jsx:410 📝 Creating FormData with createFormData()...
Profile.jsx:100 🔀 createFormData: Branch 2 - Using CROPPED blob
   croppedImageBlob size: 82.45 KB ✅ CROPPED
   profileData.image size: 2048.50 KB (not used)
Profile.jsx:420 ✅ Image saved successfully
```

---

## Next Steps After Collecting Data

**Once you run these tests and collect the console output**:

1. **Copy & paste the entire console output** showing:
   - File selection
   - Crop completion
   - submitImageOnly execution
   - createFormData branch selection

2. **Report**:
   - Which branch createFormData is taking
   - If cropped blob sizes match across functions
   - Backend file size after upload

3. **I will analyze** and identify the exact issue based on the logs

---

## Quick Reference: Critical Log Keywords to Search

- **Canvas issue**: Look for "Canvas prepared" entries with dimensions
- **Blob missing**: Search for "exists: false" in IMMEDIATE STATE CHECK
- **Size mismatch**: Compare all blob sizes shown in logs
- **Branch decision**: Search for "Branch [1/2/3]"
- **State issues**: Search for "SET in state" and check next entry in submitImageOnly
- **Timing issue**: Check gap between "SET in state" and "CALLED - AUTO-SAVE STARTING"
