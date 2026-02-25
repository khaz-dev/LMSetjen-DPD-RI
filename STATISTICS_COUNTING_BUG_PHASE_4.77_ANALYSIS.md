# Statistics Counting Bug - Deep Analysis (PHASE 4.77+)

**Status**: 🔴 BUG IDENTIFIED & READY FOR FIX  
**Date**: February 22, 2026  
**Severity**: 🟡 MEDIUM (Incorrect statistics display on homepage)  
**URLs Affected**: `http://localhost:5174/` - Beranda/Homepage

---

## 🎯 Problem Summary

The homepage statistics dashboard is showing **double counts** for:

1. **"Video Pembelajaran"** shows `2+` when there's only `1` published video
2. **"Kategori Kursus" - "Individu"** shows `2 kursus` when there's only `1` published course per category

This is happening because after PHASE 4.60 introduced the dual-copy versioning system, both the draft course AND its published copy are being counted together.

---

## 🔍 Root Cause Analysis

### PHASE 4.60 Dual-Copy Versioning System

When an instructor publishes a course, the system creates TWO records:

1. **Draft Course** (Instructor edits this)
   - `course_id`: Shared UUID
   - `is_published_version`: `False`
   - `platform_status`: `"Published"`
   - `parent_course`: `NULL`

2. **Published Copy** (Students see this)
   - `course_id`: Same as draft
   - `is_published_version`: `True`
   - `platform_status`: `"Published"`
   - `parent_course`: `FK to draft course`

### The Bug

Multiple parts of the code filter by `platform_status="Published"` but **DO NOT** add `is_published_version=True`:

This counts BOTH the draft and published copy = **Double counting**

---

## 🐛 Bug Locations

### BUG #1: PublicStatsAPIView.get() - Line 768-773

**File**: `backend/api/views.py`

**Current Code** (WRONG):
```python
# 6. Total course lessons/materials (using VariantItem for lessons)
total_materials = VariantItem.objects.filter(
    variant__course__platform_status="Published"
).count()
```

**Problem**: 
- Counts materials from both draft AND published courses
- Missing `is_published_version=True` filter
- Shows "2+" when there's only 1 published video

**Should Be**:
```python
# 6. Total course lessons/materials (using VariantItem for lessons)
total_materials = VariantItem.objects.filter(
    variant__course__platform_status="Published",
    variant__course__is_published_version=True  # ✨ ADD THIS
).count()
```

---

### BUG #2: Category.course_count() Method - Line 145-147

**File**: `backend/api/models.py`

**Current Code** (WRONG):
```python
def course_count(self):
    # ✨ PHASE 4+: Only count published courses for public display
    # Excludes courses in "Review", "Draft", or "Rejected" status
    return Course.objects.filter(category=self, platform_status="Published").count()
```

**Problem**:
- Counts draft AND published copies
- Shows 2 courses when there's only 1 published
- Used by CategorySerializer for homepage display
- Affects "Kategori Kursus" section

**Should Be**:
```python
def course_count(self):
    # ✨ PHASE 4+: Only count published courses for public display
    # Excludes courses in "Review", "Draft", or "Rejected" status
    # [*] PHASE 4.77: Also filter by is_published_version=True to avoid double counting
    return Course.objects.filter(
        category=self, 
        platform_status="Published",
        is_published_version=True  # ✨ ADD THIS
    ).count()
```

---

### BUG #3: CategoryManagementSerializer.get_course_count() - Line 367-369

**File**: `backend/api/serializer.py`

**Current Code** (WRONG):
```python
def get_course_count(self, obj):
    """Get count of published courses in this category
    ✨ PHASE 4+: Only count published courses for public consistency"""
    return api_models.Course.objects.filter(
        category=obj, 
        platform_status="Published"
    ).count()
```

**Problem**:
- Counts draft AND published copies
- Used by admin material management pages
- Missing `is_published_version=True` filter

**Should Be**:
```python
def get_course_count(self, obj):
    """Get count of published courses in this category
    ✨ PHASE 4+: Only count published courses for public consistency
    [*] PHASE 4.77: Filter by is_published_version=True to avoid double counting"""
    return api_models.Course.objects.filter(
        category=obj, 
        platform_status="Published",
        is_published_version=True  # ✨ ADD THIS
    ).count()
```

---

## 📊 Impact Analysis

### What's Displaying Wrong

| Section | Field | Current Display | Expected | Bug |
|---------|-------|-----------------|----------|-----|
| Statistik Platform | Video Pembelajaran | `2+` | `1+` | ✅ |
| Kategori Kursus → Individu | course_count | `2 kursus` | `1 kursus` | ✅ |

### Where Statistics Are Used

1. **Frontend - homepage homepage (`/` - Index.jsx)**
   - Line 1186: `{stats.total_materials}+` displays video count
   - Line 1415: `{category.course_count} kursus` displays per-category count

2. **Backend - PublicStatsAPIView** 
   - Line 707-815: Returns statistics for public display
   - Called via `/statistics/public-stats/` endpoint

3. **Admin Pages**
   - Materials management uses course_count
   - Affects delete functionality (`title="Tidak dapat menghapus kategori yang memiliki kursus"`)

---

## 🔗 Affected Data Flow

```
Homepage (Index.jsx)
├── Endpoint 1: GET /course/category/
│   └── CategoryListAPIView
│       └── CategorySerializer
│           └── Category.course_count()  ❌ BUG #2
│
└── Endpoint 2: GET /statistics/public-stats/
    └── PublicStatsAPIView
        └── Line 768: total_materials filter  ❌ BUG #1
```

---

## 📝 Verification Steps

### Step 1: Check Database
```bash
# SSH into Django shell
python manage.py shell

from api.models import Course, Category, VariantItem

# Check draft courses
draft = Course.objects.filter(is_published_version=False, platform_status="Published").first()
print(f"Draft: {draft.title}, is_published_version={draft.is_published_version}")

# Check published copies
published = Course.objects.filter(is_published_version=True, platform_status="Published").first()
print(f"Published: {published.title}, is_published_version={published.is_published_version}")

# Check category count
category = Category.objects.first()
print(f"Category course_count: {category.course_count()}")  # Should equal number of published copies, not draft+published

# Check total materials
total = VariantItem.objects.filter(variant__course__platform_status="Published").count()
print(f"Total materials (ALL): {total}")

total_published = VariantItem.objects.filter(
    variant__course__platform_status="Published",
    variant__course__is_published_version=True
).count()
print(f"Total materials (Published only): {total_published}")
```

### Step 2: Check Frontend
1. Go to `http://localhost:5174/` (homepage)
2. Scroll to "Statistik Platform" section
3. Check "Video Pembelajaran" count
4. Scroll to "Kategori Kursus" section
5. Check course count per category

### Step 3: Verify Fix
1. After applying fixes, run database check
2. Restart frontend (npm run dev)
3. Clear browser cache
4. Verify statistics changed to correct counts

---

## 🔧 Fix Strategy

### Approach
- Add `is_published_version=True` filter to all course counting queries
- Maintains consistency with PHASE 4.77 versioning system
- Minimal code changes (3 locations)
- No database migration needed
- Backward compatible

### Files to Modify
1. `backend/api/views.py` - Line ~771
2. `backend/api/models.py` - Line ~145
3. `backend/api/serializer.py` - Line ~369

### Testing After Fix
- ✅ Homepage shows correct statistics
- ✅ Admin pages show correct counts
- ✅ No double counting
- ✅ Only published courses counted
- ✅ Draft courses excluded

---

## 📌 Phase Information

**Phase**: ✨ PHASE 4.77+ (Continuation of PHASE 4.77 Versioning System)

**Related**:
- PHASE 4.60: Introduced dual-copy versioning
- PHASE 4.77: Fixed course duplication in UI
- PHASE 4.77+: Fixing statistics counting

**Category**: Data Integrity & Statistics Accuracy

---

## 🎓 Lessons Learned

1. When implementing versioning systems, ALL counting queries must include the version filter
2. Search for all `platform_status` filters and check if `is_published_version` should also be included
3. Statistics should only count public-facing records, not internal drafts
4. Test with real published courses before declaring PHASE complete

---

## 🚀 Next Steps

1. ✅ Identify bugs (THIS DOCUMENT)
2. ⏳ Apply fixes to 3 locations
3. ⏳ Test on localhost
4. ⏳ Verify statistics display correctly
5. ⏳ Deploy to production

