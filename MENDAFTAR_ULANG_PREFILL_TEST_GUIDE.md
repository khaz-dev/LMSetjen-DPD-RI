# Mendaftar Ulang Pre-fill Data - Quick Test Guide

## 🎯 What Was Fixed

When clicking "Mendaftar Ulang" on a rejected instructor request, the form now **appears with your previously submitted data pre-filled** instead of blank.

---

## ✅ How to Test

### Step 1: Navigate to Search Page
```
Go to: http://localhost:5174/search/
```

### Step 2: Open Instructor Modal
```
Click: "Mulai Mengajar" button (top right area)
```

### Step 3: Check Existing Request Status

**If you see "Permintaan Tertunda"**: 
- Your request is PENDING (waiting for review)
- Skip to manual testing section below

**If you see "Permintaan Ditolak"**: ← This is what we're testing!
- Your request was REJECTED
- You should see the rejection reason
- Continue below

### Step 4: Click "Mendaftar Ulang" Button

In the rejection modal, click the **"Mendaftar Ulang"** button

### Step 5: 🔍 VERIFY THE FIX

The form should now appear with your **previous submission data**:

#### Check These Fields:

| Field | Should Contain | Example |
|-------|----------------|---------|
| **Bidang Keahlian** | Your previous expertise areas | "Python, Django, Web Development" |
| **Tingkat Pengalaman** | Your previous experience level | "Lanjutan" (Advanced) |
| **Biografi Singkat** | Your previous biography text | "I have 10 years of experience..." |

#### ✅ Success if:
- [ ] Form appears (not blank!)
- [ ] Bidang Keahlian field is filled with your text
- [ ] Bio field shows your full bio paragraph
- [ ] Experience level dropdown shows your previous selection
- [ ] All fields are editable (can click and type)

#### ❌ Problem if:
- [ ] Form appears completely blank
- [ ] Fields are empty
- [ ] Data from API not loading

---

## 🧪 Detailed Test: Edit and Resubmit

If you want to test the full workflow:

### 1. Edit the Form
Make a small change to the bio, for example:
- **Original**: "I have 5 years of experience in web development"
- **Updated**: "I have 5 years of professional experience in full-stack web development and database design"

### 2. Submit the Form
Click: **"Kirim Permintaan"**

### 3. Verify Success
You should see:
- ✅ Green success toast: "Permintaan Dikirim"
- ✅ Success text: "Permintaan Anda telah dikirim. Admin akan meninjau dalam 1-2 hari kerja."
- ✅ Modal closes automatically

### 4. Verify Status Changed
Click "Mulai Mengajar" again:
- Should show **"Permintaan Tertunda"** (PENDING status)
- This confirms a NEW request was created

---

## 🐛 Troubleshooting

### Problem: Form still appears blank

**Solution 1**: Hard refresh the page
```
Press: Ctrl + Shift + R  (or Cmd + Shift + R on Mac)
```
This clears browser cache and reloads JavaScript.

**Solution 2**: Check browser console for errors
```
Press: F12 (Open Developer Tools)
Click: Console tab
Look for any red error messages
Screenshot errors and report
```

**Solution 3**: Verify API is returning data
```
In console, execute:
fetch('/api/v1/instructor-request/')
  .then(r => r.json())
  .then(d => console.log(d))
```
Should print your request data with expertise_areas, bio, experience_level

### Problem: Form appears but fields are still blank in modal

This could mean:
1. API didn't return the data properly
2. Wrong request is being fetched
3. Backend serializer isn't including the fields

**Debug**: Check Network tab in DevTools
```
1. Press F12
2. Click "Network" tab
3. Click "Mulai Mengajar"
4. Find request: /instructor-request/
5. Click it and view "Response"
6. Should show: expertise_areas, bio, experience_level fields
```

### Problem: Edit works but form goes blank after clicking button

This could be a state issue.

**Solution**:
1. Hard refresh (Ctrl+Shift+R)
2. Close modal and reopen
3. Check console for errors

---

## 📊 Expected Behavior Summary

### Rejection Modal (With Pre-fill Fix)

```
┌─────────────────────────────────────────┐
│  ❌ Permintaan Ditolak                 │  ← Rejection view
│                                          │
│  Alasan Penolakan:                      │
│  "Biografi Anda terlalu singkat"        │
│                                          │
│  Tanggal Review: 22 Februari 2026       │
│  Ditinjau oleh: Admin Utama             │
│                                          │
│  💡 Anda dapat mendaftar ulang setelah  │
│     memperbaiki kekurangan...           │
│                                          │
│  [Tutup]  [Mendaftar Ulang]  ← Button   │
└─────────────────────────────────────────┘
```

### Form View (After Clicking "Mendaftar Ulang")

```
┌────────────────────────────────────────────┐
│  👨‍🏫 Jadilah Instruktur                    │ ← Form appears
│                                             │
│  Bidang Keahlian *                         │
│  [Python, Web Development, Data Science]   │ ← PRE-FILLED! ✅
│  Pisahkan dengan koma jika lebih dari satu │
│                                             │
│  Tingkat Pengalaman *                      │
│  [Lanjutan                               ▼] │ ← Dropdown pre-selected! ✅
│                                             │
│  Biografi Singkat *                        │
│  [I have 10 years of experience in...]  │  │ ← PRE-FILLED! ✅
│  │ web development, with expertise in      │
│  │ Python, Django, PostgreSQL...          │
│                                             │
│  🔒 Admin kami akan meninjau aplikasi...  │
│                                             │
│  [Batal]  [Kirim Permintaan]               │
└────────────────────────────────────────────┘
```

---

## ✨ What Changed

### Code Change (Frontend)

**File**: `frontend/src/components/InstructorRequestModal.jsx` (Line 240-248)

**Before** (❌ Bug):
```javascript
// Reset form and show form view
setFormData({
  expertise_areas: '',            // Empty!
  bio: '',                        // Empty!
  experience_level: 'BEGINNER'    // Default!
});
```

**After** (✅ Fix):
```javascript
// Pre-fill form with previous submission data
setFormData({
  expertise_areas: existingRequest?.expertise_areas || '',
  bio: existingRequest?.bio || '',
  experience_level: existingRequest?.experience_level || 'BEGINNER'
});
```

**What it does**:
- `existingRequest?.expertise_areas` - Gets the field from the API response (pre-filled)
- `|| ''` - Falls back to empty string if field is missing (safe)
- Same pattern for `bio` and `experience_level`

---

## 📱 Expected User Flow

```
┌──────────────────────────────────────────────────┐
│ Student clicks "Mulai Mengajar"                 │
└──────────────────────────┬──────────────────────┘
                           ↓
        ┌─────────────────────────────────┐
        │ API returns rejected request    │
        │ WITH previous submission data   │
        └─────────────────┬───────────────┘
                          ↓
        ┌─────────────────────────────────┐
        │ Modal shows rejection view:     │
        │ - Reason why rejected           │
        │ - Date reviewed                 │
        │ - Who reviewed it               │
        │ - "Mendaftar Ulang" button      │
        └─────────────────┬───────────────┘
                          ↓
        ┌─────────────────────────────────┐
        │ Student clicks                  │
        │ "Mendaftar Ulang"               │
        └─────────────────┬───────────────┘
                          ↓
        ┌─────────────────────────────────┐
        │ Form appears with PREFILLED     │
        │ data from previous submission   │
        │ - expertise_areas ✅ Pre-filled  │
        │ - bio ✅ Pre-filled              │
        │ - experience_level ✅ Pre-filled │
        └─────────────────┬───────────────┘
                          ↓
        ┌─────────────────────────────────┐
        │ Student edits based on feedback │
        │ "Oh, my bio was too short..."   │
        └─────────────────┬───────────────┘
                          ↓
        ┌─────────────────────────────────┐
        │ Student clicks "Kirim Permintaan"│
        └─────────────────┬───────────────┘
                          ↓
        ┌─────────────────────────────────┐
        │ New request created             │
        │ ✅ Success message shown         │
        │ ✅ Modal closes                  │
        └─────────────────────────────────┘
```

---

## 🎓 What You're Testing

This test verifies:

1. **Data Persistence** - Previous submission is saved in API
2. **Pre-fill Logic** - Frontend correctly pulls data from API response
3. **State Management** - Form state properly updates from props
4. **User Experience** - User sees their data and can iterate on feedback

---

## 📞 Report Issues

If the form still appears blank:

1. **Take a screenshot** of:
   - The blank form
   - Browser console (F12 → Console tab)
   - Network response (F12 → Network tab → /instructor-request/ → Response)

2. **Check the fix was deployed**:
   - Edit `frontend/src/components/InstructorRequestModal.jsx`
   - Look for line ~242: should have `existingRequest?.expertise_areas`
   - If you see empty string `''` instead, the fix didn't apply

3. **Clear cache and refresh**:
   ```
   Ctrl + Shift + R  (or Cmd + Shift + R on Mac)
   ```

---

**Last Updated**: February 22, 2026 | **Phase**: 4.79 | Status: Ready for Testing ✅
