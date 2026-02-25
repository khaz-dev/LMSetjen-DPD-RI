# Duration Display Fix - Before & After Comparison

## The Problem (BEFORE FIX)

### Duration Display Section
```
┌─────────────────────────────────────────┐
│ 📺 Durasi Video                   [Edit]│
├─────────────────────────────────────────┤
│ ✅ 5m 20s  (green badge)                │
│ Durasi terekstrak: 5m 20s (gray text)  │
└─────────────────────────────────────────┘
```

### The Issue
When extraction succeeds AND user manually edits duration:

**Scenario**: YouTube link extracted as 5m, user edits to 10m

BEFORE (WRONG):
```
┌─────────────────────────────────────────┐
│ 📺 Durasi Video                   [Edit]│
├─────────────────────────────────────────┤
│ ✅ 10m 30s  (green badge) ← User edit  │
│ Durasi terekstrak: 10m 30s ← SAME! ❌  │
└─────────────────────────────────────────┘

Problem: Both show the same duration, 
impossible to see what was extracted 
vs what user edited
```

---

## The Solution (AFTER FIX)

### Added Separate State Tracking

```javascript
// ✨ PHASE 4.204: Two independent tracking systems

// 1. User's saved/edited duration (in item state)
item.duration_formatted = "10m 30s"

// 2. Auto-extracted duration (in extractedDuration state)
extractedDuration[`${variantIndex}_${itemIndex}`] = 300 // 5m in seconds
```

### Display Now Shows Different Values

AFTER (CORRECT):
```
┌─────────────────────────────────────────┐
│ 📺 Durasi Video                   [Edit]│
├─────────────────────────────────────────┤
│ ✅ 10m 30s (green badge)                │
│   └─ User's saved duration              │
│                                         │
│ Durasi terekstrak: 5m 00s (gray text)  │
│ └─ What was actually extracted ✅      │
└─────────────────────────────────────────┘

Result: Clear distinction between:
- What system extracted (5m)
- What user saved/edited (10m 30s)
```

---

## Different Scenarios After Fix

### Scenario 1: User Accepts Extracted Duration (No Edit)

**Step 1**: Add YouTube link
```
👤: Adds YouTube link → API extracts 5m
```

**Display**:
```
┌─────────────────────────────────────────┐
│ ✅ 5m 00s  (green badge - saved)       │
│ Durasi terekstrak: 5m 00s (extracted)  │
└─────────────────────────────────────────┘
✅ Both show same → No manual edit made
```

---

### Scenario 2: User Edits Extracted Duration

**Step 1**: Add YouTube link
```
👤: Adds YouTube link → API extracts 5m
```

**Step 2**: Click Edit, change to 10m 30s
```
👤: Manually changes duration to 10m 30s
```

**Display**:
```
┌─────────────────────────────────────────┐
│ ✅ 10m 30s (green badge - EDITED) ←───┐│
│ Durasi terekstrak: 5m 00s (extracted)  │
└─────────────────────────────────────────┘
✅ Different values → Shows editing happened
```

---

### Scenario 3: Extraction Failed

**Step 1**: Add invalid YouTube link
```
👤: Adds invalid link
👥 API: Extraction failed ❌
```

**Display**:
```
┌─────────────────────────────────────────┐
│ ⏱️ 00:00 (gray badge - empty)          │
│                                         │
│ "Klik Edit untuk memasukkan durasi..."  │
│                                         │
│ Durasi terekstrak: 0:00:00 (failed)    │
└─────────────────────────────────────────┘
✅ Shows extraction failed - user can manually set
```

---

### Scenario 4: Upload Video File

**Step 1**: Upload MP4 file
```
👤: Uploads video.mp4
👥 Backend: Extracts duration 7m 45s
```

**Display**:
```
┌─────────────────────────────────────────┐
│ ✅ 7m 45s (green badge - from upload)  │
│ Durasi terekstrak: 7m 45s (extracted)  │
└─────────────────────────────────────────┘
✅ Both match - extraction successful, user hasn't edited
```

---

## Code Changes Summary

### Before: Single Field for Both
```javascript
// ❌ OLD - Using same field for both
if (extraction_success) {
    item.duration_seconds = 300;      // Extracted
    item.duration_formatted = "5m";   // Extracted
}

if (user_edits) {
    item.duration_seconds = 600;      // Now OVERWRITES extracted
    item.duration_formatted = "10m";  // Now OVERWRITES extracted
}

// Display reads same field for both:
// Badge: item.duration_formatted → "10m"
// Text: item.duration_seconds → "10m" ❌ Same!
```

### After: Separate Fields
```javascript
// ✅ NEW - Two independent tracking systems

// Track extracted (never touched by edits)
extractedDuration[key] = 300;  // 5m

// Track saved/edited (never touched by extraction)
item.duration_seconds = 600;   // User's edit
item.duration_formatted = "10m";

// Display reads both:
// Badge: item.duration_formatted → "10m" (saved)
// Text: extractedDuration[key] → "5m" (extracted) ✅ Different!
```

---

## State Management Architecture

### Data Flow: Extraction Only
```
User adds YouTube link
        ↓
Extraction API ("/media/video-metadata/")
        ↓
If Success:
  extractedDuration[key] = response.duration_seconds
  
If Failed:
  extractedDuration[key] = 0
```

### Data Flow: Manual Edit
```
User clicks Edit → changes hours/minutes/seconds
        ↓
handleDurationInput() called
        ↓
Updates:
  item.duration_seconds = new_value
  item.duration_formatted = "formatted"
  
extractedDuration remains unchanged
```

### Data Flow: Display
```
Render Duration Display
  ├─ Badge: item.duration_formatted (user saved/edited)
  └─ Small text: extractedDuration[key] (auto extracted)
```

---

## Testing Guide

### Test 1: YouTube Extraction
1. Navigate to curriculum edit
2. Add valid YouTube link (e.g., https://www.youtube.com/watch?v=...)
3. **Expected**: 
   - Toast: "Durasi Berhasil Diekstrak: [duration]"
   - Badge shows: extracted duration
   - Small text shows: same extracted duration

### Test 2: Extraction + Manual Edit
1. Complete Test 1 (extraction succeeds)
2. Click [Edit] button
3. Change duration manually
4. Click [✓ Selesai] button
5. **Expected**:
   - Badge shows: NEW duration (your edit)
   - Small text shows: OLD extracted duration ← Different! ✅

### Test 3: Failed Extraction
1. Add invalid YouTube link
2. **Expected**:
   - Toast: "Gagal Mengekstrak Durasi"
   - Badge shows: empty (00:00)
   - Small text shows: "Klik Edit untuk memasukkan durasi..."

### Test 4: File Upload
1. Upload video file (MP4/WebM)
2. **Expected**:
   - Toast: "File Berhasil Diunggah! Durasi: [duration]"
   - Badge shows: extracted duration
   - Small text shows: same extracted duration

### Test 5: Page Reload
1. Complete Test 2
2. Reload page (F5)
3. **Expected**:
   - Badge shows: YOUR edited duration ✅
   - Small text shows: extracted duration ✅
   - Both values persisted correctly

---

## Technical Details

### Files Modified
1. **frontend/src/views/instructor/CourseEditCurriculum.jsx**
   - NEW: `extractedDuration` state (line ~1638)
   - UPDATED: Extraction logic (3 locations)
   - UPDATED: Display logic (line ~916)
   - UPDATED: Data loading (line ~2195)

### No Database Changes
- Backend schema unchanged
- `duration` field in VariantItem model unchanged
- Extraction API (`/media/video-metadata/`) unchanged

### No API Changes
- All existing endpoints work as before
- New feature is purely frontend-side state management

---

## Key Points

✅ **Extracted Duration** = What was auto-extracted from media  
✅ **Saved Duration** = What user has set through Edit button  
✅ **Both tracked independently** = No mutual interference  
✅ **Display shows distinction** = User sees both values clearly  
✅ **Backward compatible** = No breaking changes  
✅ **No database migration** = Works with existing data  

---

**PHASE 4.204** - Duration Extraction Separation
**Date**: February 26, 2026
**Status**: ✅ Complete and Tested
