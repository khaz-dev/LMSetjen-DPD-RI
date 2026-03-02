#!/usr/bin/env python
"""
Find the actual course_id for course with id=47
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Course

print("\n" + "="*100)
print("FINDING ACTUAL course_id FOR COURSE ID=47")
print("="*100 + "\n")

try:
    course = Course.objects.get(id=47)
    print(f"✅ Course found!")
    print(f"  - id: {course.id}")
    print(f"  - course_id (ShortUUID): {course.course_id}")
    print(f"  - title: {course.title}")
except Course.DoesNotExist:
    print(f"❌ Course with id=47 not found")

print("\n" + "="*100 + "\n")
