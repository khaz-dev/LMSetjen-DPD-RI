import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Course

print("=" * 70)
print("FIXING: teacher_course_status for Published Courses")
print("=" * 70)

# Update all Published courses to also have teacher_course_status="Published"
updated = Course.objects.filter(
    platform_status="Published",
    teacher_course_status__in=["Draft", "Review", "Rejected"]
).update(teacher_course_status="Published")

print(f"✅ Updated {updated} courses to have correct teacher_course_status")
print()

# Verify
total_published = Course.objects.filter(
    platform_status="Published",
    teacher_course_status="Published"
).count()
print(f"ℹ️  Total published courses NOW: {total_published}")
print()

# Show all published courses
courses = Course.objects.filter(
    platform_status="Published",
    teacher_course_status="Published"
).values_list('course_id', 'title', 'platform_status', 'teacher_course_status')

print("Published Courses:")
print("-" * 70)
for course_id, title, platform, teacher_status in courses:
    print(f"  ID: {course_id}")
    print(f"  Title: {title}")
    print(f"  Status: {platform} / {teacher_status}")
    print()
