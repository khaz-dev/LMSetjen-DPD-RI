# Quick Reference: Instructor Badge Fix Testing (PHASE 7.22)

## What Was Fixed
Changed the teacher data path from `course.teacher` to `course.course.teacher` in the student forum view to match the actual API response structure.

## Where to Test
1. **Student Forum**: `http://localhost:5174/student/courses/124632/` → Discussions tab
2. **Instructor QA**: No changes (already working) can verify consistency

## Quick Test (5 minutes)

### Step 1: Open Forum
```
URL: http://localhost:5174/student/courses/124632/
Tab: Diskusi Kursus
Action: Click on any question thread
```

### Step 2: Check Original Question
```
Look for the question asker's name at the top
If asker is course instructor:
  ✓ Should show: [Name] [Penanya badge] [Instruktur badge]
If asker is student:
  ✓ Should show: [Name] [Penanya badge] (no Instruktur badge)
```

### Step 3: Check Replies
```
For each reply/comment:
If reply is from course instructor:
  ✓ Should show: [Name] [Instruktur badge]
If reply is from student:
  ✓ Should show: [Name] (no badge)
```

### Step 4: Verify Console (Optional)
```
Press F12 → Console tab → Look for PHASE 7.22 messages:

[CourseDetail] ✨ PHASE 7.22: Verifying teacher data structure:
[CourseDetail]   Teacher user_id: 42

When viewing thread replies:
[CourseDetail.Forum] Message 1:
  - isInstructor: true/false (should match expectations)
```

## Expected Behavior

### ✓ Correct After Fix:
- Instructor's original question shows badge
- Instructor's replies show badge
- Student replies do NOT show badge
- Consistent badge styling and visibility

### ✗ Before Fix (Broken):
- No badges appeared at all
- Badge logic never evaluated to true
- All posts looked the same

## Rollback (If Needed)
```
Revert these 3 changes in CourseDetail.jsx:
1. Line 3123: course?.teacher → course?.course?.teacher (original question)
2. Line 3197: course?.teacher → course?.course?.teacher (message badge)
3. Lines 3205,3209-3210: Fix debug logs
```

## Files Changed
- `frontend/src/views/student/CourseDetail.jsx` (3 locations)

## Deployment
- Backend: No changes needed
- Frontend: Deploy only

---

**Quick Fix Summary**: Changed `course.teacher` → `course.course.teacher` in student forum badge logic
