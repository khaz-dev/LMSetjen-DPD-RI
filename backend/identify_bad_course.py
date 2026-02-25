#!/usr/bin/env python
"""
Script to identify corrupted published course
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, '.')
django.setup()

from api.models import Course

# Find all versions of this course
courses = Course.objects.filter(title__icontains="Rabuan III")

print("\n" + "=" * 80)
print("COURSE VERSIONS FOUND:")
print("=" * 80)

for course in courses:
    print(f"\nCourse ID: {course.course_id}")
    print(f"  DB ID: {course.id}")
    print(f"  Title: {course.title}")
    print(f"  is_published_version: {course.is_published_version}")
    print(f"  platform_status: {course.platform_status}")
    print(f"  teacher_course_status: {course.teacher_course_status}")
    print(f"  Intro Video URL: {course.file}")
    
    # Check if Google Drive or YouTube
    if course.file:
        if "drive.google.com" in course.file:
            print(f"    → Intro Source: GOOGLE DRIVE (outdated?)")
        elif "youtube" in course.file or "youtu.be" in course.file:
            print(f"    → Intro Source: YOUTUBE (correct)")
        else:
            print(f"    → Intro Source: OTHER")
    
    print(f"  Lessons count: {course.lectures().count()}")
    print(f"  Features count: {course.features.count()}")
    print(f"  Requirements count: {course.requirements.count()}")
    
    # List lessons
    lessons = course.lectures()
    if lessons:
        print(f"  Lessons:")
        for lesson in lessons:
            print(f"    - {lesson.title}")

print("\n" + "=" * 80)
print("ANALYSIS:")
print("=" * 80 + "\n")

# Separate by version type
drafts = courses.filter(is_published_version=False)
published = courses.filter(is_published_version=True)

if drafts.count() > 0:
    print(f"✓ Draft version(s): {drafts.count()}")
    for d in drafts:
        print(f"  - course_id: {d.course_id} (DB ID: {d.id})")

if published.count() > 0:
    print(f"✓ Published version(s): {published.count()}")
    for p in published:
        print(f"  - course_id: {p.course_id} (DB ID: {p.id})")
