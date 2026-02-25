# 🔴 CRITICAL: Delete Corrupted Published Course - Step-by-Step Guide

**Date**: February 22, 2026  
**Issue**: Corrupted published course with wrong data (Google Drive intro + duplicated sections)  
**Solution**: Delete the wrong published copy, keep the correct one

---

## What Happened

When admin approved the course, there were actually **TWO different published copies created**:

```
Scenario 1: You approved the WRONG version (old data with Google Drive)
├─ Published Copy 1 (WRONG - has Google Drive intro + duplicates)
│  ├─ course_id: "???" 
│  ├─ file: "https://drive.google.com/..." (WRONG!)
│  ├─ lessons: 2 (mixed - YouTube + Google Drive)
│  └─ features: Duplicated sections ❌
│
└─ Published Copy 2 / or Draft (RIGHT - has YouTube intro + 1 lesson)
   ├─ course_id: "???"
   ├─ file: "https://www.youtube.com/embed/..." (CORRECT!)
   ├─ lessons: 1 (clean)
   └─ features: Clean sections ✓

We need to delete Published Copy 1 (the wrong one)!
```

---

## Step 1: Identify the Wrong Course

### Find the Course Title
Course title: **"Rabuan III Public Speaking dan Storytelling untuk ASN Menyampaikan Pesan dengan Berdampak"**

### Find its Course IDs
We need to find **both** the course_id values:

```bash
# SSH into database or run Django shell
cd backend
python manage.py shell
```

Then run:

```python
from api.models import Course

# Find all versions of this course
course_title = "Rabuan III Public Speaking dan Storytelling untuk ASN Menyampaikan Pesan dengan Berdampak"
courses = Course.objects.filter(title__icontains="Rabuan III")

for course in courses:
    print(f"\nCourse ID: {course.course_id}")
    print(f"  - DB ID: {course.id}")
    print(f"  - Title: {course.title}")
    print(f"  - is_published_version: {course.is_published_version}")
    print(f"  - platform_status: {course.platform_status}")
    print(f"  - teacher_course_status: {course.teacher_course_status}")
    print(f"  - Intro Video: {course.file}")
    print(f"  - Lessons count: {course.lectures().count()}")
    print(f"  - Features count: {course.features.count()}")
    print(f"  - Requirements count: {course.requirements.count()}")
    print(f"  - Learning Outcomes count: {course.learning_outcomes.count()}")
```

**Output will show you:**
- Which one is the draft (`is_published_version=False`)
- Which one is the published copy (`is_published_version=True`)
- Which one has the correct data (YouTube intro, 1 lesson)
- Which one has the wrong data (Google Drive intro, duplicated sections)

---

## Step 2: Identify the WRONG Published Copy

Look at the output and identify:

```
❌ WRONG Version to Delete:
  - course_id: "???" ← WRITE DOWN THIS VALUE
  - Intro Video: "https://drive.google.com/..." ← Google Drive (WRONG)
  - Lessons: 2 or more
  - Features: Duplicated (appears multiple times)

✓ CORRECT Version to Keep:
  - course_id: "???" ← WRITE DOWN THIS VALUE
  - Intro Video: "https://www.youtube.com/..." ← YouTube (CORRECT)
  - Lessons: 1
  - Features: Clean (no duplicates)
```

---

## Step 3: Delete the Wrong Published Copy

**IMPORTANT**: Make a backup first!

```bash
# Still in Django shell
from api.models import Course, Variant, VariantItem, CourseFeature, CourseRequirement, CourseLearningOutcome, Quiz

# Set these to the WRONG course's ID
WRONG_COURSE_ID = "xyz789"  # Replace with actual course_id

# Get the wrong course
wrong_course = Course.objects.get(course_id=WRONG_COURSE_ID)

print(f"Deleting wrong course: {wrong_course.title}")
print(f"Intro video: {wrong_course.file}")
print(f"Lessons: {wrong_course.lectures().count()}")

# First, delete all related content
print("\n[Deleting] Variants (curriculum sections)...")
Variant.objects.filter(course=wrong_course).delete()

print("[Deleting] Quiz questions and choices...")
Quiz.objects.filter(course=wrong_course).delete()

print("[Deleting] Course features...")
CourseFeature.objects.filter(course=wrong_course).delete()

print("[Deleting] Course requirements...")
CourseRequirement.objects.filter(course=wrong_course).delete()

print("[Deleting] Learning outcomes...")
CourseLearningOutcome.objects.filter(course=wrong_course).delete()

# Finally, delete the course itself
print("[Deleting] Course record...")
wrong_course.delete()

print("\n✅ Wrong course deleted successfully!")
```

---

## Step 4: Verify the Correct Course Remains

```python
from api.models import Course

# Check that only ONE version remains
CORRECT_COURSE_ID = "abc123"  # Replace with actual course_id
correct_course = Course.objects.get(course_id=CORRECT_COURSE_ID)

print(f"✓ Remaining course:")
print(f"  - Title: {correct_course.title}")
print(f"  - is_published_version: {correct_course.is_published_version}")
print(f"  - Intro Video: {correct_course.file}")
print(f"  - Lessons: {correct_course.lectures().count()}")
print(f"  - Features: {correct_course.features.count()}")
print(f"  - Requirements: {correct_course.requirements.count()}")
print(f"  - Learning Outcomes: {correct_course.learning_outcomes.count()}")

# Verify intro video is YouTube
if "youtube.com" in correct_course.file or "youtu.be" in correct_course.file:
    print("\n✅ Intro video is YouTube ✓")
else:
    print("\n❌ ERROR: Intro video is NOT YouTube!")

# Verify lessons
lessons = correct_course.lectures()
print(f"\n✅ Lessons ({lessons.count()}):")
for lesson in lessons:
    print(f"   - {lesson.title}")
    if "youtube" in (lesson.file or "").lower() or "youtu.be" in (lesson.file or "").lower():
        print(f"     Source: YouTube")
    elif "drive.google.com" in (lesson.file or "").lower():
        print(f"     Source: Google Drive")
    else:
        print(f"     Source: {lesson.file}")
```

---

## Step 5: Verify on Homepage

After deletion, restart the backend:

```bash
# In terminal, restart Django
Ctrl+C  (if running)
python manage.py runserver 0.0.0.0:8001
```

Then check:

1. **Homepage** - Course should appear ONCE
   - Should show: YouTube intro + 1 Google Drive lesson
   - Should NOT have duplicated sections

2. **Statistics** - Should show correct counts
   - "1+ Kursus" (not 2+)
   - Correct lesson count (1, not 2+)

3. **Category** - Should show 1 course (not 2)
   - "Kategori Kursus Individu" → Shows 1 kursus

4. **Kursus Populer** - Should show correct data
   - YouTube intro video ✓
   - 1 Google Drive lesson ✓
   - No duplicated sections ✓

---

## Python Script (Automated)

If you want a script to do this automatically, here's a complete version:

```python
#!/usr/bin/env python
"""
Script to delete corrupted published course
Run: python delete_bad_course.py
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, '.')
django.setup()

from api.models import Course, Variant, Quiz
from django.db import transaction

def delete_corrupted_course():
    """Delete the corrupted published course"""
    
    # Find all versions of the course
    courses = Course.objects.filter(title__icontains="Rabuan III")
    
    print("=" * 70)
    print("CORRUPTED COURSE DELETION TOOL")
    print("=" * 70)
    
    if courses.count() == 0:
        print("❌ No courses found with 'Rabuan III' in title")
        return
    
    print(f"\n✓ Found {courses.count()} versions of this course\n")
    
    # Identify which is wrong and which is right
    draft_course = None
    published_course = None
    
    for course in courses:
        if course.is_published_version == False:
            draft_course = course
        else:
            published_course = course
    
    if not draft_course or not published_course:
        print("❌ ERROR: Could not find both draft and published versions!")
        return
    
    print("DRAFT VERSION:")
    print(f"  - course_id: {draft_course.course_id}")
    print(f"  - Intro: {draft_course.file}")
    print(f"  - Lessons: {draft_course.lectures().count()}")
    
    print("\nPUBLISHED VERSION:")
    print(f"  - course_id: {published_course.course_id}")
    print(f"  - Intro: {published_course.file}")
    print(f"  - Lessons: {published_course.lectures().count()}")
    
    # Determine which is wrong
    draft_has_google_drive = "drive.google.com" in (draft_course.file or "")
    published_has_google_drive = "drive.google.com" in (published_course.file or "")
    
    wrong_course = None
    if draft_has_google_drive and not published_has_google_drive:
        print("\n✓ Draft has Google Drive (WRONG), Published has YouTube (RIGHT)")
        print("→ Will delete DRAFT version")
        wrong_course = draft_course
    elif published_has_google_drive and not draft_has_google_drive:
        print("\n✓ Published has Google Drive (WRONG), Draft has YouTube (RIGHT)")
        print("→ Will delete PUBLISHED version")
        wrong_course = published_course
    else:
        print("\n⚠️  WARNING: Both or neither have Google Drive!")
        print("→ Checking lesson counts instead...")
        
        draft_lessons = draft_course.lectures().count()
        published_lessons = published_course.lectures().count()
        
        if draft_lessons > published_lessons:
            print(f"→ Draft has more lessons ({draft_lessons} vs {published_lessons})")
            print("→ Will delete DRAFT version")
            wrong_course = draft_course
        elif published_lessons > draft_lessons:
            print(f"→ Published has more lessons ({published_lessons} vs {draft_lessons})")
            print("→ Will delete PUBLISHED version")
            wrong_course = published_course
    
    if not wrong_course:
        print("\n❌ Could not determine which version is wrong!")
        return
    
    # Confirm deletion
    print(f"\n" + "=" * 70)
    print(f"ABOUT TO DELETE:")
    print(f"  - Title: {wrong_course.title}")
    print(f"  - course_id: {wrong_course.course_id}")
    print(f"  - Intro: {wrong_course.file}")
    print(f"  - is_published_version: {wrong_course.is_published_version}")
    print("=" * 70)
    
    confirm = input("\nAre you SURE you want to delete this course? Type 'YES' to confirm: ")
    
    if confirm != "YES":
        print("❌ Deletion cancelled!")
        return
    
    # Delete with transaction
    try:
        with transaction.atomic():
            print("\n[Deleting] Related content...")
            Variant.objects.filter(course=wrong_course).delete()
            Quiz.objects.filter(course=wrong_course).delete()
            
            print("[Deleting] Course record...")
            wrong_course.delete()
            
            print("\n✅ Deletion completed successfully!")
    except Exception as e:
        print(f"\n❌ ERROR during deletion: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    delete_corrupted_course()
```

Save as `backend/delete_bad_course.py` and run:

```bash
cd backend
python delete_bad_course.py
```

---

## Checklist After Deletion

- [ ] Wrong course deleted from database
- [ ] Restart Django backend
- [ ] Homepage shows course ONCE (not twice)
- [ ] Course data is correct (YouTube intro, 1 Google Drive lesson)
- [ ] No duplicated sections
- [ ] Statistics show correct counts
- [ ] Category shows 1 course (not 2)
- [ ] All other courses still work

---

## If Something Goes Wrong

If you accidentally deleted the wrong one:

1. **Restore from backup** (if you made one)
2. **Or re-approve the course**:
   - Find the draft course in admin panel
   - Reject it first
   - Instructor resubmits
   - Admin approves again (should create correct published copy)

---

## Summary

1. Use Django shell to find course IDs
2. Identify which published copy is corrupted (Google Drive intro + duplicates)
3. Delete the corrupted version completely
4. Keep the correct version
5. Restart backend and verify on homepage

This will eliminate the duplication and ensure students only see the correct course data.
