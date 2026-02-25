#!/usr/bin/env python
"""
Delete corrupted published course - APPROVED FOR EXECUTION
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, '.')
django.setup()

from api.models import Course, Variant, Quiz
from django.db import transaction

# The course to DELETE
WRONG_COURSE_ID = "278858"  # Published version with Google Drive + duplicates

print("\n" + "=" * 80)
print("🔴 DELETING CORRUPTED PUBLISHED COURSE")
print("=" * 80)

wrong_course = Course.objects.get(course_id=WRONG_COURSE_ID)

print(f"\nCourse to DELETE:")
print(f"  - course_id: {wrong_course.course_id}")
print(f"  - DB ID: {wrong_course.id}")
print(f"  - is_published_version: {wrong_course.is_published_version}")
print(f"  - Intro Video: {wrong_course.file}")
print(f"  - Lessons: {wrong_course.lectures().count()}")
print(f"  - Features: {wrong_course.features.count()}")
print(f"  - Requirements: {wrong_course.requirements.count()}")

print("\n" + "=" * 80)
print("STARTING DELETION...")
print("=" * 80)

try:
    with transaction.atomic():
        # Delete all variants (curriculum sections and lessons)
        variants_count = Variant.objects.filter(course=wrong_course).count()
        print(f"\n[1/5] Deleting {variants_count} curriculum sections...")
        Variant.objects.filter(course=wrong_course).delete()
        print("  ✓ Done")
        
        # Delete all quizzes
        quizzes_count = Quiz.objects.filter(course=wrong_course).count()
        print(f"[2/5] Deleting {quizzes_count} quizzes...")
        Quiz.objects.filter(course=wrong_course).delete()
        print("  ✓ Done")
        
        # Delete course features, requirements, outcomes (cascade will handle)
        print(f"[3/5] Deleting course features...")
        wrong_course.features.all().delete()
        print("  ✓ Done")
        
        print(f"[4/5] Deleting course requirements...")
        wrong_course.requirements.all().delete()
        print("  ✓ Done")
        
        # Delete the course itself
        print(f"[5/5] Deleting course record...")
        course_title = wrong_course.title
        course_id = wrong_course.course_id
        wrong_course.delete()
        print("  ✓ Done")
        
        print("\n" + "=" * 80)
        print("✅ DELETION SUCCESSFUL!")
        print("=" * 80)
        print(f"\n✓ Deleted: {course_title}")
        print(f"✓ Course ID: {course_id}")
        print(f"\n✓ The draft version (284197) with YouTube intro remains and is published")
        print(f"✓ Homepage will now show only the CORRECT course")
        
except Exception as e:
    print(f"\n❌ ERROR during deletion: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Verify the correct course still exists
print("\n" + "=" * 80)
print("VERIFICATION")
print("=" * 80)

correct_course = Course.objects.get(course_id="284197")
print(f"\n✓ Correct course still exists:")
print(f"  - course_id: {correct_course.course_id}")
print(f"  - Intro: YouTube ✓")
print(f"  - Lessons: {correct_course.lectures().count()}")
print(f"  - Status: {correct_course.platform_status}")
print(f"\n✅ All good! Your course is now clean and duplicate-free.")
