# AVATAR CROPPING VERIFICATION GUIDE

**Purpose**: Verify that the "Apply Crop" button is correctly cropping images before saving to database

---

## 🧪 HOW TO TEST THE CROPPING

### **Setup**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Navigate to student or instructor profile
4. Keep the console open so you can see the logs

---

## **Test 1: Verify Crop Creates Smaller File**

### **Steps**
1. Click "Pilih File" and select an image (preferably a large one, like 5MB+)
2. Watch the console for logs

Expected console output:
```
🔍 getCroppedImage CALLED with: { crop: {...}, fileName: "photo.jpg" }
📐 Canvas prepared: { canvasWidth: 300, canvasHeight: 300, ... }
📍 Crop region being extracted: { sourceX: 150, sourceY: 200, ... }
🎨 Image drawn to canvas - CROPPING COMPLETE
📦 canvas.toBlob callback received
   Cropped blob details: { 
     size: 45000,          ← CROPPED SIZE (bytes)
     sizeInKB: "43.95 KB"
   }
```

3. Click "Apply Crop"
4. Watch for this line:
```
✅ CROP COMPLETED! Blob received: { size: 45000, sizeInKB: "43.95 KB" }
```

5. **CRITICAL**: Check the file size in the cropped blob vs original
   - If original was 500KB but cropped is 45KB → ✅ CROPPING WORKED
   - If cropped is 500KB → ❌ CROPPING FAILED (still full image)

---

## **Test 2: Verify Cropped Image is Submitted (Auto-Save)**

### **Steps**
1. Select image and click "Apply Crop" in the modal
2. Watch console for this sequence:

```
🎬 handleCropComplete CALLED
🔄 Starting crop process...
✅ CROP COMPLETED! Blob received: { size: 45000, sizeInKB: "43.95 KB" }
✅ Updated imageState.croppedBlob - cropped image is now ready to be submitted!
⏰ Setting setTimeout for submitImageOnly...
⏰ setTimeout fired! Calling submitImageOnly()...
🔍 CRITICAL CHECK - Image submission details:
   imageState.croppedBlob exists?: true       ← ✅ CROPPED BLOB EXISTS
   imageState.croppedBlob size: 43.95 KB     ← ✅ SAME SIZE AS CROPPED
📡 Sending PATCH to /user/profile/{id}/
✅ API Response received: { image: "user_profile_images/user_123.jpg", ... }
```

3. **Critical check**: Look for `imageState.croppedBlob exists?: true`
   - If TRUE → ✅ Cropped blob is being submitted
   - If FALSE → ❌ Cropping failed or blob not saved to state

---

## **Test 3: Verify Saved Image Dimensions (In Browser)**

### **Steps**
1. After cropping and uploading, right-click your avatar
2. Click "Open Image in New Tab"
3. Check the image dimensions in your browser

**Expected**:
- Cropped image: Should be SQUARE (e.g., 300x300px or 400x400px)
- **NOT** larger rectangular dimensions

**How to verify**:
- Firefox: Right-click → "Properties" → look for Image dimensions
- Chrome: Right-click → "View Image Info" → look for dimensions
- Or check file size: Cropped should be smaller than original

---

## **Test 4: Verify File Size in Backend**

### **Steps**
1. Open terminal/console
2. Navigate to media folder:
   ```bash
   ls -lah backend/media/user_profile_images/
   ```

3. Look for your user's avatar file (e.g., `user_123.jpg`)
4. Check file size:
   ```
   -rw-r--r--  1 user  group  43K Mar  8 15:30 user_123.jpg
   ```

**Expected**:
- Original selected image: 500KB
- After cropping and saving: ~43KB (much smaller)
- Filename: `user_123.jpg` (not original filename)

**If file size is still 500KB**: ❌ Cropping is NOT working

---

## **What the Logs Tell You**

### **Log: `Canvas prepared`**
```
canvasWidth: 300          ← The crop area is 300x300 pixels
canvasHeight: 300
scaleX: 2                 ← Image is 2x the displayed size
scaleY: 2
```

### **Log: `Crop region being extracted`**
```
sourceX: 150              ← Starting at pixel 150 from left
sourceY: 200              ← Starting at pixel 200 from top
sourceWidth: 600          ← Extracting 600 pixels wide (300 displayed * 2 scale)
sourceHeight: 600         ← Extracting 600 pixels tall
```

If these numbers look reasonable, cropping IS happening!

### **Log: `Cropped blob details`**
```
size: 45000               ← File size in bytes!
sizeInKB: "43.95 KB"      ← Compare to original
```

**Rule of thumb**: Cropped image should be 10-20% of original size

---

## 🔴 **If Cropping is NOT Working**

If you see one of these symptoms:

### **Symptom 1: Cropped blob size equals original**
```
Original: 500KB
Cropped blob size: 500KB   ← SAME SIZE = NOT CROPPED
```

**Problem**: Canvas drawing might be including the full image
**Solution**: Check if crop dimensions are being passed correctly

### **Symptom 2: Canvas dimensions are huge**
```
canvasWidth: 2000
canvasHeight: 2000
```

**Problem**: Crop area is too large or scale factor is wrong
**Solution**: Check the crop coordinates being passed from ReactCrop

### **Symptom 3: Cropped blob is null**
```
❌ CRITICAL: Blob is null/undefined!
```

**Problem**: canvas.toBlob failed to generate blob
**Solution**: Image might not have loaded, or format might be unsupported

---

## 📊 **Complete Expected Flow**

```
1. User selects image (500KB)
   └→ handleFileChange called
   └→ Crop modal shows with selected image

2. User adjusts crop circle
   └→ onCropChange updates crop coordinates
   └→ onCropComplete saves completedCrop to state

3. User clicks "Apply Crop" button
   └→ handleCropComplete called
   └→ getCroppedImage creates canvas (300x300)
   └→ canvas.drawImage() draws cropped area ONLY
   └→ canvas.toBlob() converts to blob (43KB)
   └→ imageState.croppedBlob = 43KB blob ← CRITICAL
   └→ imagePreview updates to show cropped version
   └→ Crop modal closes

4. setTimeout fires after 100ms
   └→ submitImageOnly called
   └→ Checks: imageState.croppedBlob exists? YES ✅
   └→ createFormData with croppedBlob (43KB)
   └→ PATCH to /api/v1/user/profile/{id}/
   └→ Backend saves the 43KB cropped image

5. Success!
   └→ File stored: user_123.jpg (43KB) ✅
   └→ Avatar preview updated

```

---

## ✅ **Checklist**

- [ ] Console shows "CROP COMPLETED" message
- [ ] Console shows cropped blob size (should be smaller than original)
- [ ] Console shows `imageState.croppedBlob exists?: true`
- [ ] Avatar preview updates after clicking Apply Crop
- [ ] Saved file in `backend/media/user_profile_images/` is smaller than original
- [ ] Assuming everything works, avatar should display as circular (cropped) image

---

## 📝 **Summary**

The "Apply Crop" button's function:
1. ✅ Creates a canvas of the crop area size
2. ✅ Draws ONLY the cropped region from the selected image
3. ✅ Converts that canvas to a BLOB (binary data)
4. ✅ Stores the blob in `imageState.croppedBlob`
5. ✅ Uses that blob for auto-save submission (not original image)
6. ✅ Saves the **small cropped file** to database (not full 500KB image)

If the saved image file is still the full size, the cropping logic is not working correctly.
