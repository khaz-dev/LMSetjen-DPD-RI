# Instructor Rejected Request - Quick Reference & Testing Guide

---

## 🎯 The 3 Issues & Fixes at a Glance

| Issue | Cause | Fix | Result |
|-------|-------|-----|--------|
| "Tidak ada alasan yang diberikan" | rejection_reason not in API | Added field to serializer | Now shows actual reason |
| "Invalid Date" | reviewed_date missing + no null check | Added field to serializer + null check | Now shows formatted date |
| "Mendaftar Ulang" doesn't work | Missing onClose() call | Added onClose() | Button now closes modal |

---

## 📂 Files Changed

### Backend (1 file)
**`backend/api/serializer.py`**
- InstructorRequestCreateSerializer (lines 1704-1723)
  - Added: rejection_reason, reviewed_date, reviewed_by_name fields
- InstructorRequestDetailSerializer (lines 1727-1761)
  - Added: reviewed_date, reviewed_by_name fields

### Frontend (1 file)
**`frontend/src/components/InstructorRequestModal.jsx`**
- Lines 203-209: Added date null check
- Lines 211-215: Added reviewer name display
- Lines 227-239: Added onClose() to "Mendaftar Ulang" button

---

## 🧪 How to Test

### Prerequisites
- Backend running: `python manage.py runserver 0.0.0.0:8001`
- Frontend running: development server on 5174
- Rejected instructor request in database

### Test Steps

**1. Create a Test Rejection (if needed)**
```
1. Login as admin
2. Go to /admin/content-management/?tab=requests
3. Create or find a PENDING request
4. Click "Tolak" button
5. Enter reason: "Biografi terlalu singkat, gunakan minimal 20 karakter"
6. Click "Ya, Tolak"
```

**2. Test Rejection Display**
```
1. Logout from admin
2. Login as the student whose request was rejected
3. Go to /search/
4. Click "Mulai Mengajar" button
5. VERIFY - Modal shows:
   ✓ Title: "Permintaan Ditolak"
   ✓ Reason: Actual reason text (not "Tidak ada alasan...")
   ✓ Date: Actual date (not "Invalid Date")
   ✓ Reviewer: Admin name  (if available)
```

**3. Test "Mendaftar Ulang" Button**
```
1. Modal is still showing rejection
2. Click "Mendaftar Ulang" button
3. VERIFY:
   ✓ Modal closes (visible feedback!)
   ✓ No console errors (press F12 to check)
4. Click "Mulai Mengajar" again
5. VERIFY:
   ✓ Fresh form appears (not rejection message)
   ✓ Form fields are empty
```

**4. Test Form Submission**
```
1. With fresh form showing:
2. Fill in fields:
   - Bidang Keahlian: Python, Django
   - Tingkat Pengalaman: Lanjutan
   - Biografi: I have 5+ years of experience...
3. Click "Kirim Permintaan"
4. VERIFY:
   ✓ Success message appears
   ✓ Modal closes
   ✓ No duplicate request error
```

---

## 🔍 What to Check in Browser Developer Tools

### Console (F12 → Console tab)
- No errors shown
- No "Cannot read property 'reviewed_date' of undefined"
- No warnings about null values

### Network (F12 → Network tab)
**Check the `/instructor-request/` API call**:
- Response should include these fields:
  ```json
  {
    "id": 1,
    "status": "REJECTED",
    "rejection_reason": "...",
    "reviewed_date": "2026-02-21T...",
    "reviewed_by_name": "Admin..."
  }
  ```

### Application (F12 → Application tab)
- Check localStorage for user state
- Modal should fully close (disappear from DOM)

---

## 🛠️ Troubleshooting

### Problem: Still shows "Invalid Date"
**Cause**: Backend not restarted (old serializer)
**Solution**: 
```
Ctrl+C to stop backend
python manage.py runserver 0.0.0.0:8001
```

### Problem: Button still doesn't close modal  
**Cause**: Frontend not reloaded
**Solution**: 
```
Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
Or: Open DevTools → Settings → Disable cache (while open)
```

### Problem: Still shows "Tidak ada alasan yang diberikan"
**Cause**: Data not in API response or frontend not updated
**Solution**:
1. Check API response in Network tab (F12)
2. Verify rejection_reason field is in response
3. If not, restart backend
4. If yes, hard refresh frontend

### Problem: Form not showing after clicking "Mendaftar Ulang"
**Cause**: existingInstructorRequest still has old rejected data
**Solution**:
```
1. Click "Mulai Mengajar" again
2. It should fetch latest request from API
3. If new form appears → Working correctly
4. If rejection still shows → API endpoint broken
```

---

## ✅ Verification Checklist

Complete this before marking as "Fixed":

- [ ] Backend serializers updated with new fields
- [ ] Backend restarted after serializer changes
- [ ] API /instructor-request/ returns rejection_reason field
- [ ] API /instructor-request/ returns reviewed_date field
- [ ] API /instructor-request/ returns reviewed_by_name field
- [ ] Modal displays actual rejection reason (not fallback)
- [ ] Modal displays actual date (not "Invalid Date")
- [ ] Modal displays reviewer name (if available)
- [ ] "Mendaftar Ulang" button closes modal
- [ ] After button click, fresh form appears on reopen
- [ ] No console errors (F12 → Console)
- [ ] Can submit new request successfully
- [ ] New request status is PENDING

---

## 📡 API Expected Response

After fixes, this is what the API should return:

```json
{
  "id": 42,
  "expertise_areas": "Python, Django, Data Science",
  "bio": "I have 5+ years of experience in web development",
  "experience_level": "ADVANCED",
  "request_date": "2026-02-20T10:30:00Z",
  "status": "REJECTED",
  "rejection_reason": "Biografi terlalu singkat, gunakan minimal 20 karakter",
  "reviewed_date": "2026-02-21T14:22:00Z",
  "reviewed_by_name": "Admin Dashboard"
}
```

Key: ALL fields present (no null unless explicitly null):
- ✓ rejection_reason (not missing)
- ✓ reviewed_date (not missing) 
- ✓ reviewed_by_name (not missing)

---

## 🎬 Expected User Experience Flow

### Before Fix ❌
```
1. Click "Mulai Mengajar"
2. Modal opens showing rejection
3. Read: "Tidak ada alasan yang diberikan"
4. Read: "Tanggal Review: Invalid Date"
5. Click "Mendaftar Ulang"
6. Nothing happens
7. User confused: "Is the button broken?"
8. Click X to close
```

### After Fix ✅
```
1. Click "Mulai Mengajar"
2. Modal opens showing rejection with DETAILS:
   - Reason: "Biografi terlalu singkat..."
   - Date: "21 Februari 2026"
   - Reviewer: "Admin Dashboard"
3. Click "Mendaftar Ulang"
4. Modal closes with satisfying feedback
5. Click "Mulai Mengajar" again
6. Fresh form appears
7. Fix issues mentioned in rejection
8. Submit new request
9. Success!
```

---

## 🔗 Related Components

### Files That Use This Modal
- `frontend/src/views/base/Search.jsx`
  - Imports and displays InstructorRequestModal
  - Passes `existingInstructorRequest` as prop

### API Endpoints Used
- GET `/api/v1/instructor-request/` 
  - Returns latest request for current user
  - Uses InstructorRequestCreateSerializer
  
- POST `/api/v1/instructor-request/`
  - Creates new instructor request
  - Uses InstructorRequestCreateSerializer

### Related Models
- `api_models.InstructorRequest`
  - Fields: user, expertise_areas, bio, experience_level, request_date, status, rejection_reason, reviewed_date, reviewed_by

---

## 📞 Quick Diagnostic

If something still isn't working:

**1. Check Backend Serializer** (most common issue)
```python
# backend/api/serializer.py line 1718
fields = [
    'id', 'expertise_areas', 'bio', 'experience_level', 
    'request_date', 'status', 
    'rejection_reason',  # ← Should be here
    'reviewed_date',     # ← Should be here  
    'reviewed_by_name'   # ← Should be here
]
```

**2. Check API Response**
```
F12 → Network → Search for "instructor-request"
Click the /instructor-request/ request
Look at "Response" tab
Look for rejection_reason, reviewed_date, reviewed_by_name fields
```

**3. Check Console**
```
F12 → Console tab
Are there any red error messages?
Look for "Cannot read property" errors
```

**4. Check Frontend Modal**
```
frontend/src/components/InstructorRequestModal.jsx
Line 205-209: Should have date null check
Line 211-215: Should have reviewer name display
Line 234: Should have onClose() call
```

---

## 🚀 Once Tests Pass

1. ✅ Mark issue as "FIXED"
2. ✅ Update status to "Closed"
3. ✅ Document test results
4. ✅ Can now deploy to production
5. ✅ Monitor for edge cases

---

## 📝 Notes

- Fixes are backend + frontend (not just one)
- Both must be deployed together
- Backend: Update serializer fields
- Frontend: Update date null checks and button handler
- Test with ACTUAL rejected request data (not just code review)
- Phone/mobile testing recommended (responsive design)

---

**Ready to test? Follow the test steps above and let me know the results!**
