import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Course
from django.db.models import Count, Q

print("=" * 70)
print("COMPLETE DATABASE STATUS ANALYSIS")
print("=" * 70)
print()

# Count by platform_status
print("Courses by platform_status:")
status_counts = Course.objects.values('platform_status').annotate(count=Count('id')).order_by('-count')
for item in status_counts:
    print(f"  {item['platform_status']}: {item['count']} courses")
print()

# Count by teacher_course_status
print("Courses by teacher_course_status:")
teacher_status_counts = Course.objects.values('teacher_course_status').annotate(count=Count('id')).order_by('-count')
for item in teacher_status_counts:
    print(f"  {item['teacher_course_status']}: {item['count']} courses")
print()

# Combination analysis
print("Status Combinations:")
print("-" * 70)
combinations = Course.objects.values('platform_status', 'teacher_course_status').annotate(count=Count('id')).order_by('-count')
for combo in combinations:
    print(f"  platform={combo['platform_status']}, teacher={combo['teacher_course_status']}: {combo['count']} courses")
print()

# Show what's visible to students (Published + Published)
visible_count = Course.objects.filter(
    platform_status="Published",
    teacher_course_status="Published"
).count()
print(f"Visible to students (platform=Published AND teacher=Published): {visible_count} 👨‍🎓")
print()

# Show what's NOT visible to students
not_visible = Course.objects.exclude(
    platform_status="Published",
    teacher_course_status="Published"
).count()
print(f"NOT visible to students (wrong status combination): {not_visible}")
if not_visible > 0:
    print("  These courses need fixing!")
    print()
    invisible = Course.objects.exclude(
        platform_status="Published",
        teacher_course_status="Published"
    ).values('course_id', 'title', 'platform_status', 'teacher_course_status')[:5]
    for course in invisible:
        print(f"    {course['title'][:50]}")
        print(f"      Status: {course['platform_status']} / {course['teacher_course_status']}")
