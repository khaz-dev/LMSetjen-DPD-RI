# Publish Versioning Flow Diagram - PHASE 4.75

## Before Fix (WRONG BEHAVIOR) ❌

```
┌─────────────────────────────────────────────────────┐
│  INSTRUCTOR: Edit Course 284197                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Change media: Google Drive → YouTube             │
│     ├─ Draft (284197): YouTube ✓                    │
│     └─ Published (278858): Google Drive ✓           │
│                                                      │
│  2. Click "Simpan Draf"                             │
│     ├─ Draft saved with YouTube                     │
│     └─ Published stays with Google Drive ✓          │
│                                                      │
│  3. Click "Ajukan Publikasi Kursus"                │
│     ├─ submit_for_publication() RUNS               │
│     ├─ DELETES all published curriculum ❌          │
│     ├─ COPIES draft to published ❌                 │
│     └─ Published NOW HAS YouTube ❌                 │
│                                                      │
│  4. Status → "Menunggu Persetujuan Admin"          │
│     ├─ Draft: YouTube                              │
│     └─ Published: YouTube (WRONG! Before approval!) │
│                                                      │
└─────────────────────────────────────────────────────┘
         ↓↓↓ PROBLEM: Published shows new content! ↓↓↓
┌─────────────────────────────────────────────────────┐
│  ADMIN: Review Course 284197                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Opens AdminCourseReviewDetail                   │
│     ├─ Sees Draft: YouTube                         │
│     ├─ Sees Published: YouTube (same as draft!)    │
│     └─ CANNOT see what changes need approval ❌    │
│                                                      │
│  2. Click "Setujui" (Approve)                      │
│     ├─ Published already has YouTube               │
│     ├─ No changes to apply                         │
│     └─ Course marked Published                     │
│                                                      │
└─────────────────────────────────────────────────────┘
         ↓↓↓ Appears to work but timing is wrong ↓↓↓
┌─────────────────────────────────────────────────────┐
│  STUDENT: Sees Course                               │
├─────────────────────────────────────────────────────┤
│  YouTube (happens to be correct, but for wrong!)   │
└─────────────────────────────────────────────────────┘
```

---

## After Fix (CORRECT BEHAVIOR) ✅

```
┌─────────────────────────────────────────────────────┐
│  INSTRUCTOR: Edit Course 284197                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Change media: Google Drive → YouTube             │
│     ├─ Draft (284197): YouTube ✓                    │
│     └─ Published (278858): Google Drive ✓           │
│                                                      │
│  2. Click "Simpan Draf"                             │
│     ├─ Draft saved with YouTube                     │
│     └─ Published stays with Google Drive ✓          │
│                                                      │
│  3. Click "Ajukan Publikasi Kursus"                │
│     ├─ submit_for_publication() RUNS               │
│     ├─ FINDS existing published copy                │
│     ├─ DO NOT update anything ✓ (NEW FIX!)         │
│     ├─ Published STAYS with Google Drive ✓         │
│     └─ Status → "Review"                           │
│                                                      │
│  4. Status → "Menunggu Persetujuan Admin"          │
│     ├─ Draft: YouTube                              │
│     └─ Published: Google Drive (preserved!) ✓      │
│     └─ Ready for admin comparison ✓                │
│                                                      │
└─────────────────────────────────────────────────────┘
    ↓↓↓ GOOD: Published untouched, ready for review ↓↓↓
┌─────────────────────────────────────────────────────┐
│  ADMIN: Review Course 284197                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Opens AdminCourseReviewDetail                   │
│     ├─ Sees Draft: YouTube (what instructor sent) │
│     ├─ Sees Published: Google Drive (what students) │
│     └─ Can clearly see WHAT changed ✓              │
│                                                      │
│  2. Click "Setujui" (Approve)                      │
│     ├─ CourseApprovalAPIView.post() RUNS           │
│     ├─ COPIES draft content to published ✓         │
│     ├─ Published NOW HAS YouTube ✓                 │
│     ├─ Marked as "Published" ✓                     │
│     └─ Students see updated version ✓              │
│                                                      │
└─────────────────────────────────────────────────────┘
    ↓↓↓ GOOD: All changes properly approved first ↓↓↓
┌─────────────────────────────────────────────────────┐
│  STUDENT: Sees Course                               │
├─────────────────────────────────────────────────────┤
│  YouTube (AFTER approval, correct timing!) ✓       │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### BEFORE FIX ❌

```
INSTRUCTOR  DRAFT COURSE         PUBLISHED COURSE    ADMIN REVIEW    STUDENTS
┌─────┐    ┌──────────┐         ┌──────────┐        ┌──────────┐    ┌─────┐
│Edit │───→│YouTube   │    🔴   │YouTube   │ ❌────→│Can't see │───→│See  │
└─────┘    │(SAVED)   │    copy │(MODIFIED)│        │original │    │new  │
           └──────────┘         │before    │        │content  │    │data │
                                │approval  │        └──────────┘    └─────┘
                                └──────────┘           ▲
                                   ▲ WRONG!            │
                           Published changed          OLD
                           BEFORE admin review        DATA
                                                     LOST!
```

### AFTER FIX ✅

```
INSTRUCTOR  DRAFT COURSE         PUBLISHED COURSE    ADMIN REVIEW    STUDENTS
┌─────┐    ┌──────────┐         ┌──────────┐        ┌──────────┐    ┌─────┐
│Edit │───→│YouTube   │    🟢   │Google    │ ✅────→│Compare  │───→│See  │
└─────┘    │(SAVED)   │    keep │Drive     │        │Old vs   │    │new  │
           └──────────┘         │(OLD)     │        │New ✓    │    │data │
                    │            └──────────┘        └──────────┘    └─────┘
                    │                │                    │ After
                    │                │ (PRESERVED)        │approval: copy
                    └────────────────┼───────────────────→│
                    Only when admin  │ COPY ON APPROVAL    │
                    approves         │                     ▼
                                     └─→ UPDATES PUBLISHED (only here!)
```

---

## Data Consistency Timeline

### Course State Over Time

```
TIME  OPERATION                  DRAFT (284197)    PUBLISHED (278858)   STATUS
─────────────────────────────────────────────────────────────────────────────
T0    Initial state              Google Drive      Google Drive         Published
      (course published)

T1    Instructor changes          YouTube ready    Google Drive         Published
      to YouTube                  (not saved)      (unchanged)           (from T0)

T2    "Simpan Draf"              YouTube saved    Google Drive         Published
                                 ✓                (unchanged)           ✓

T3    "Ajukan Publikasi"         YouTube          Google Drive         Review
      (submit)                   ✓                (preserved!) ✓        (waiting)

      🔴 BEFORE FIX:
      Would copy YouTube to Published here ❌

      🟢 AFTER FIX:
      Published stays Google Drive ✅

T4    Admin reviews              YouTube          Google Drive         Review
                                 (draft)          (published)          (visible)
                                                                       both ✓

T5    "Setujui" (approve)        YouTube          YouTube              Published
      After approval             ✓                (updated now) ✓      

T6    Students view              YouTube          YouTube              Published
                                 ✓                ✓                    ✓
```

---

## State Machine Diagram

```
                    ┌──────────────────────────────┐
                    │     Student Perspective      │
                    │     (Sees Published Only)    │
                    └──────────────────────────────┘
                              △
                              │ Approved
                              │
                    ┌─────────┴──────────┐
                    │   Admin Reviews    │
                    │   (Can see both)   │
                    └────────┬───────────┘
                             │ Approves
                             │
    ┌──────────────────────────────────────┐
    │   SUBMIT FOR REVIEW                  │
    │   (instructor clicks button)          │
    │                                       │
    │   🟢 FIX: Preserves published here!  │
    │   (doesn't modify published)          │
    │                                       │
    └──────────────┬───────────────────────┘
                   │
             ✓ "Menunggu Persetujuan"
             ✓ Draft: New changes
             ✓ Published: Old data
             ✓ Both visible to admin
                   │
                   ▼
    ┌──────────────────────────────────────┐
    │   DRAFT EDITING                      │
    │   (instructor changes media)          │
    │                                       │
    │   ✓ Draft updated immediately        │
    │   ✓ Published stays old              │
    │   ✓ Students don't see changes       │
    │                                       │
    └──────────────────────────────────────┘
```

---

## Fix Location Summary

```
Course Request Flow:
FRONTEND                 BACKEND
   │                       │
   ├─ Edit Curriculum ───→─┤ CourseUpdateAPIView
   │                       │ - Updates draft only ✓
   │                       │
   ├─ Save Draft ────────→─┤ No special handling
   │                       │ (draft already saved) ✓
   │                       │
   ├─ Submit for Review ──→─┤ CoursePublishAPIView
   │                       │ ├─ FIXED: Don't copy to published ✓
   │                       │ └─ Set status = "Review" ✓
   │                       │
   ├─ Fetch for Review ──→─┤ TeacherCourseDetailAPIView
   │                       │ ├─ CourseEditSerializer
   │                       │ └─ ADDED: published_version field ✓
   │                       │
   └─ Admin Approves ────→─┤ CourseApprovalAPIView
                          │ ├─ FIXED: Copy draft to published ✓
                          │ └─ Mark as "Published" ✓
```

---

## Phase 4.75 Checklist

- [x] Identified root cause (premature copy in submit_for_publication)
- [x] Fixed submit_for_publication() - now preserves published version
- [x] Fixed CourseApprovalAPIView - now copies on approval
- [x] Added published_version field to serializer
- [x] Tested serializer works without errors
- [x] Verified published and draft are separate
- [x] Updated documentation
- [x] Created visual diagrams

---

**Status:** ✅ COMPLETE  
**Priority:** CRITICAL (affects workflow integrity)  
**Tested:** YES - All fixes validated
