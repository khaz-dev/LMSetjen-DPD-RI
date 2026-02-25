import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Course, EnrolledCourse

print("=" * 70)
print("REMOVING DUPLICATE COURSES (PHASE 4.73)")
print("=" * 70)
print()

# Find the duplicate courses to keep and delete
# Keep DB ID 20 (most recent), delete IDs 18 and 19
courses_to_delete = Course.objects.filter(id__in=[18, 19])
course_to_keep = Course.objects.get(id=20)

print(f"🎯 KEEPING: DB ID 20 (Course ID: {course_to_keep.course_id})")
print(f"   Title: {course_to_keep.title[:60]}")
print()
print(f"🗑️  DELETING: DB IDs 18, 19 (duplicates)")
print()

# Before deletion, check if any students are enrolled
enrollment_count = EnrolledCourse.objects.filter(
    course__id__in=[18, 19]
).count()

if enrollment_count > 0:
    print(f"⚠️  WARNING: {enrollment_count} students enrolled in duplicate courses")
    print("   These enrollments will also be deleted!")
    print()

# Move any enrollments (if any) to the kept course
enrolled_in_duplicates = EnrolledCourse.objects.filter(course__id__in=[18, 19])
if enrolled_in_duplicates.exists():
    print(f"Moving {enrolled_in_duplicates.count()} enrollments to kept course...")
    enrolled_in_duplicates.update(course=course_to_keep)

# Delete the duplicate courses
print("⏳ Deleting duplicate courses...")
deleted_count, _ = courses_to_delete.delete()
print(f"✅ Deleted {deleted_count} duplicate course(s)")
print()

# Show remaining courses
remaining = Course.objects.all().count()
print(f"ℹ️  Total courses in database NOW: {remaining}")
print()

# Show that statistics are now accurate
published = Course.objects.filter(
    platform_status="Published",
    teacher_course_status="Published"
).count()
print(f"📊 Published courses: {published}")
print()
print("=" * 70)
print("✅ Database cleanup complete!")
print("=" * 70)
