# Statistics Bug Quick Reference Guide

## The Problem (In Plain Language)

**User Issue**: "Video Pembelajaran shows 2+ but I only have 1 published video. Kategori Kursus shows 2 courses but I only published 1."

**Why It Happened**: When you publish a course, the system keeps TWO copies in the database:
1. **Draft copy** - You edit this
2. **Published copy** - Students see this

The statistics code was counting BOTH copies as if they were separate courses = double the count

---

## Visual Comparison

### Before Fix ❌

```
Homepage Statistics Section

┌─────────────────────────────────────┐
│ Statistik Platform                  │
├─────────────────────────────────────┤
│ 📊 2+ Video Pembelajaran            │ ← WRONG (should be 1+)
│ 👨‍🎓 1 Peserta                        │ ← Correct
│ 👨‍🏫 1 Instruktur                     │ ← Correct
│ ⭐ 4.8/5 Rating Platform            │ ← Correct
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Kategori Kursus                     │
├─────────────────────────────────────┤
│ □ Individu                          │
│   2 kursus ❌                       │ ← WRONG (should be 1)
│
│ □ Inovasi                           │
│   0 kursus ✓                        │ ← Correct (empty category)
└─────────────────────────────────────┘
```

### After Fix ✅

```
Homepage Statistics Section

┌─────────────────────────────────────┐
│ Statistik Platform                  │
├─────────────────────────────────────┤
│ 📊 1+ Video Pembelajaran            │ ← CORRECT
│ 👨‍🎓 1 Peserta                        │ ← Correct
│ 👨‍🏫 1 Instruktur                     │ ← Correct
│ ⭐ 4.8/5 Rating Platform            │ ← Correct
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Kategori Kursus                     │
├─────────────────────────────────────┤
│ □ Individu                          │
│   1 kursus ✓                        │ ← CORRECT
│
│ □ Inovasi                           │
│   0 kursus ✓                        │ ← Correct (empty category)
└─────────────────────────────────────┘
```

---

## What Was Fixed

### Location 1: Backend Statistics API
**File**: `backend/api/views.py` Line 768-773

**What**: Total video count for "Video Pembelajaran" statistic

**Change**: Added filter to only count videos from published-version courses, not draft copies

```python
# BEFORE (counts both draft and published)
VariantItem.objects.filter(variant__course__platform_status="Published")

# AFTER (counts only published copies)
VariantItem.objects.filter(
    variant__course__platform_status="Published",
    variant__course__is_published_version=True  # ← This line added
)
```

### Location 2: Category Model
**File**: `backend/api/models.py` Line 145

**What**: Course count per category (shown in "Kategori Kursus" section)

**Change**: Added filter to count only published-version courses

```python
# BEFORE (counts both draft and published = 2)
return Course.objects.filter(category=self, platform_status="Published").count()

# AFTER (counts only published copies = 1)
return Course.objects.filter(
    category=self,
    platform_status="Published",
    is_published_version=True  # ← This line added
).count()
```

### Location 3: Admin Category Serializer
**File**: `backend/api/serializer.py` Line 367

**What**: Course count in admin material management page

**Change**: Added filter to count only published-version courses

```python
# BEFORE (counts both draft and published = 2)
return api_models.Course.objects.filter(category=obj, platform_status="Published").count()

# AFTER (counts only published copies = 1)
return api_models.Course.objects.filter(
    category=obj,
    platform_status="Published",
    is_published_version=True  # ← This line added
).count()
```

---

## Database Verification

### What's in the Database

```
Courses Table:
┌────┬─────────────┬──────────────┬────────────────────┬────────────────┐
│ ID │ course_id   │ is_published │ platform_status    │ parent_course  │
├────┼─────────────┼──────────────┼────────────────────┼────────────────┤
│ 1  │ abc123      │ False        │ Published          │ NULL           │ ← Draft (you edit)
│ 2  │ abc123      │ True         │ Published          │ 1              │ ← Published (students see)
└────┴─────────────┴──────────────┴────────────────────┴────────────────┘

OLD Query Result (WRONG - counts both):
SELECT COUNT(*) FROM courses WHERE platform_status='Published'
Result: 2 ❌

NEW Query Result (CORRECT - counts only published):
SELECT COUNT(*) FROM courses WHERE platform_status='Published' AND is_published_version=True
Result: 1 ✓
```

---

## Timeline of the Bug

```
1. PHASE 4.60  → Introduced dual-copy versioning
                 (each published course now has 2 DB records)

2. PHASE 4.77  → Fixed course lists to filter by is_published_version=True
                 (prevented showing duplicate courses)

3. PHASE 4.77+ → Fixed statistics to filter by is_published_version=True
                 (prevented double-counting courses)
                 ← YOU ARE HERE ✅
```

---

## How to Verify the Fix

### Step 1: Check Homepage
1. Open `http://localhost:5174/` (or production URL)
2. Scroll to "Statistik Platform"
3. Check "Video Pembelajaran" count
   - Should show `1+` (not `2+`)
4. Scroll to "Kategori Kursus"
5. Check "Individu" category
   - Should show `1 kursus` (not `2 kursus`)

### Step 2: Check Admin Pages
1. Go to `/admin/content-management/` (if accessible)
2. Click "Materi" (Materials) tab
3. Check "Kategori Kursus" stats
4. "Individu" should show `1` (not `2`)

### Step 3: Run Database Query
```bash
cd backend
python manage.py shell

from api.models import Category, Course, VariantItem

# Check specific category
cat = Category.objects.get(title="Individu")
print(f"Individu courses: {cat.course_count()}")  # Should be 1

# Check total materials
from api.models import VariantItem
total = VariantItem.objects.filter(
    variant__course__platform_status='Published',
    variant__course__is_published_version=True
).count()
print(f"Total materials: {total}")  # Should be 1
```

---

## Key Concept: is_published_version Field

**This is the key to understanding the fix:**

```
When instructor publishes a course:
├─ System stores original as Draft
│  ├─ is_published_version = False
│  ├─ platform_status = "Published"
│  └─ parent_course = NULL
│
└─ System creates Published Copy
   ├─ is_published_version = True    ← KEY FIELD
   ├─ platform_status = "Published"
   └─ parent_course = Draft ID

Filter Rule:
- To count published courses → ALWAYS use is_published_version=True
- Without it → Counts both draft and published copy
```

---

## Files Modified Summary

| File | What Changed | Why | Status |
|------|-------------|-----|--------|
| `backend/api/views.py` | Added is_published_version filter to total_materials count | Fix video pembelajaran double counting | ✅ |
| `backend/api/models.py` | Added is_published_version filter to course_count method | Fix kategori kursus double counting | ✅ |
| `backend/api/serializer.py` | Added is_published_version filter to get_course_count | Fix admin page double counting | ✅ |

**Total Changes**: 3 files, 3 small filter additions, 0 breaking changes

---

## Django Check Result

```
✓ System check identified no issues (0 silenced)
```

✅ All code is valid and syntactically correct

---

## Next Steps

1. **Verify on Browser** → Go to homepage and check statistics
2. **Check Admin Pages** → Verify material management pages
3. **Deploy to Production** → Roll out the fix
4. **Monitor** → Watch for any issues

---

