# Instructor Rejected Request Display - Root Cause Analysis
**Date**: February 22, 2026
**Phase**: 4.78
**Status**: Issue Identified & Fixes Ready

---

## 🎯 User-Reported Issues

1. ❌ **"Tidak ada alasan yang diberikan"** - Shows even when rejection reason exists
2. ❌ **"Invalid Date"** - Date field shows this instead of actual rejection date
3. ❌ **"Mendaftar Ulang" button doesn't work** - Clicking it does nothing

---

## 🔍 Deep Scan Results

### Issue Root Causes Found

#### **Problem 1: Missing Serializer Fields**

**Location**: `backend/api/serializer.py` lines 1704-1723

**InstructorRequestCreateSerializer** (Used by GET `/instructor-request/`):
```python
class InstructorRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = api_models.InstructorRequest
        fields = ['id', 'expertise_areas', 'bio', 'experience_level', 'request_date', 'status']
        # ❌ MISSING: 'rejection_reason', 'reviewed_date', 'reviewed_by_name'
```

**Why it matters**:
- When Search.jsx calls `GET /api/v1/instructor-request/`, it gets limited data
- Rejected requests need rejection_reason, reviewed_date, and reviewed_by_name
- Frontend modal receives `undefined` values → Shows defaults/errors

**InstructorRequestDetailSerializer** (Not used by Search):
```python
fields = [
    'id', 'user_id', 'user_name', 'user_email', 'user_image',
    'expertise_areas', 'bio', 'experience_level',
    'request_date', 'status', 'rejection_reason'
    # ❌ MISSING: 'reviewed_date', 'reviewed_by_name'
]
```

---

#### **Problem 2: Frontend Date Handling**

**Location**: `frontend/src/components/InstructorRequestModal.jsx` line 207

**Current Code**:
```jsx
<p className="text-muted small mt-3">
    <strong>Tanggal Review:</strong> {new Date(existingRequest.reviewed_date).toLocaleDateString('id-ID')}
</p>
```

**Issues**:
- When `reviewed_date` is `null` or `undefined`:
  - `new Date(null)` → returns epoch date → "Invalid Date"
  - `new Date(undefined)` → returns epoch date → "Invalid Date"
- No fallback handling for missing data

---

#### **Problem 3: "Mendaftar Ulang" Button Non-functional**

**Location**: `frontend/src/components/InstructorRequestModal.jsx` lines 231-244

**Current Code**:
```jsx
<button 
    type="button" 
    className="btn btn-primary" 
    onClick={() => {
        // Reset form to reapply
        setFormData({
            expertise_areas: '',
            bio: '',
            experience_level: 'BEGINNER'
        });
        setErrors({});
    }}
>
    Mendaftar Ulang
</button>
```

**Problems**:
- Only resets form state
- Doesn't close modal → Modal still shows rejection message
- Doesn't trigger form display → User doesn't see the form to fill
- User clicks button → Form resets in background → Modal still shows rejection → Nothing appears to happen

---

## 📊 Data Flow Analysis

```
User on Search page
       ↓
Click "Mulai Mengajar" button
       ↓
Call: GET /api/v1/instructor-request/
       ↓
Backend returns InstructorRequestCreateSerializer data:
  - ✅ id, expertise_areas, bio, experience_level, request_date, status
  - ❌ rejection_reason = UNDEFINED
  - ❌ reviewed_date = UNDEFINED
  - ❌ reviewed_by_name = UNDEFINED
       ↓
Frontend sets existingInstructorRequest = {
  status: "REJECTED",
  rejection_reason: undefined,  // ← PROBLEM
  reviewed_date: undefined      // ← PROBLEM
}
       ↓
Modal renders REJECTED state (line 176-211):
  ✓ Shows "Permintaan Ditolak"
  ✗ Shows "Tidak ada alasan yang diberikan" (no fallback)
  ✗ Shows "Invalid Date" (undefined date)
  ✗ "Mendaftar Ulang" button doesn't work
```

---

## ✅ Fixes Required

### Fix 1: Update InstructorRequestCreateSerializer
**File**: `backend/api/serializer.py`
**Change**: Add missing fields to serializer
```python
fields = [
    'id', 'expertise_areas', 'bio', 'experience_level', 
    'request_date', 'status', 
    'rejection_reason',  # ← ADD
    'reviewed_date',     # ← ADD
    'reviewed_by_name'   # ← ADD (new field via SerializerMethodField)
]
```

### Fix 2: Update InstructorRequestDetailSerializer
**File**: `backend/api/serializer.py`
**Change**: Add missing fields
```python
fields = [
    'id', 'user_id', 'user_name', 'user_email', 'user_image',
    'expertise_areas', 'bio', 'experience_level',
    'request_date', 'status', 'rejection_reason',
    'reviewed_date',      # ← ADD
    'reviewed_by_name'    # ← ADD
]
```

### Fix 3: Add reviewed_by_name Field to Serializers
**File**: `backend/api/serializer.py`
**In both serializers**:
```python
reviewed_by_name = serializers.CharField(
    source='reviewed_by.full_name', 
    read_only=True, 
    allow_null=True
)
```

### Fix 4: Fix Modal Date Handling
**File**: `frontend/src/components/InstructorRequestModal.jsx`
**Line 207**: Add null/undefined check
```jsx
<p className="text-muted small mt-3">
    <strong>Tanggal Review:</strong> {
        existingRequest.reviewed_date 
            ? new Date(existingRequest.reviewed_date).toLocaleDateString('id-ID')
            : 'Tanggal tidak tersedia'
    }
</p>
```

### Fix 5: Fix "Mendaftar Ulang" Button
**File**: `frontend/src/components/InstructorRequestModal.jsx`
**Lines 231-244**: Make button properly trigger form display
```jsx
<button 
    type="button" 
    className="btn btn-primary" 
    onClick={() => {
        // Reset form and close modal
        setFormData({
            expertise_areas: '',
            bio: '',
            experience_level: 'BEGINNER'
        });
        setErrors({});
        onClose();  // Close modal - user can re-open to see form
    }}
>
    Mendaftar Ulang
</button>
```

---

## 🔧 Implementation Summary

| Issue | Root Cause | Fix | File(s) |
|-------|-----------|-----|---------|
| "Tidak ada alasan yang diberikan" | rejection_reason not in serializer | Add rejection_reason to InstructorRequestCreateSerializer | backend/api/serializer.py |
| "Invalid Date" | reviewed_date not in serializer, no null check | Add reviewed_date to serializer + add null check in JSX | backend/api/serializer.py + frontend/src/components/InstructorRequestModal.jsx |
| "Mendaftar Ulang" doesn't work | Button only resets state, doesn't close modal | Add onClose() call to button handler | frontend/src/components/InstructorRequestModal.jsx |
| Missing reviewer name | reviewed_by_name not in serializer | Add reviewed_by_name SerializerMethodField | backend/api/serializer.py |

---

## 📈 Expected Results After Fix

```
User on Search page
       ↓
Click "Mulai Mengajar" (has rejected request)
       ↓
GET /api/v1/instructor-request/ returns:
  ✅ rejection_reason = "Biografi terlalu singkat"
  ✅ reviewed_date = "2026-02-20T10:30:00Z"
  ✅ reviewed_by_name = "Admin Dashboard"
       ↓
Modal renders:
  ✅ "Alasan Penolakan: Biografi terlalu singkat"
  ✅ "Tanggal Review: 20 Februari 2026"
  ✅ "Mendaftar Ulang" button closes modal
       ↓
User clicks "Mendaftar Ulang"
  ✅ Modal closes
  ✅ Form is reset
  ✅ User can click "Mulai Mengajar" again to see form
```

---

## 🧪 Verification Steps

After applying fixes:

1. **Create rejected instructor request** (via admin panel)
2. **Login as that student**
3. **Visit search page**
4. **Click "Mulai Mengajar"**
   - [ ] Modal shows actual rejection reason (not "Tidak ada alasan...")
   - [ ] Modal shows actual rejection date (not "Invalid Date")
   - [ ] Reviewer name displays if available
5. **Click "Mendaftar Ulang"**
   - [ ] Modal closes
   - [ ] No errors in console
6. **Click "Mulai Mengajar" again**
   - [ ] Fresh form appears (not rejection message)
   - [ ] Can fill and submit new request

---

**Next Step**: Apply all fixes to resolve the issues
