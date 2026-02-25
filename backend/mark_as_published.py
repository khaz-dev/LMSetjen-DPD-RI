#!/usr/bin/env python
"""
Mark the remaining course as the published version
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, '.')
django.setup()

from api.models import Course

print("\n" + "=" * 80)
print("MARKING REMAINING COURSE AS PUBLISHED VERSION")
print("=" * 80)

# The remaining correct course
correct_course = Course.objects.get(course_id="284197")

print(f"\nBefore update:")
print(f"  - course_id: {correct_course.course_id}")
print(f"  - is_published_version: {correct_course.is_published_version}")
print(f"  - platform_status: {correct_course.platform_status}")
print(f"  - Intro: {correct_course.file}")

# Update to mark as published version
correct_course.is_published_version = True
correct_course.parent_course = None  # This is now the main published version
correct_course.save()

print(f"\nAfter update:")
print(f"  - is_published_version: {correct_course.is_published_version} ✓")
print(f"  - parent_course: None (this is the main version)")

print("\n✅ Course marked as published version!")
