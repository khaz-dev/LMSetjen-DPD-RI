#!/usr/bin/env python
"""Clear old audit logs and regenerate with course_id data"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models

print("=" * 70)
print("CLEARING AND REGENERATING POINTS AUDIT LOG")
print("=" * 70)

# Count current records
old_count = models.PointsAuditLog.objects.count()
print(f"\nOld audit log entries to delete: {old_count}")

# Delete all audit logs
models.PointsAuditLog.objects.all().delete()
print(f"✅ Deleted {old_count} audit log entries")

# Reset StudentPoints and InstructorPoints
print("\nResetting point records...")
models.StudentPoints.objects.all().delete()
models.InstructorPoints.objects.all().delete()
print("✅ StudentPoints and InstructorPoints reset")

# Now regenerate by running the recalculate logic inline
print("\nRegenerating points from source data...\n")

from django.utils import timezone
from django.db.models import Q, Sum

now = timezone.now()
current_year = now.year
current_month = now.month

# Initialize StudentPoints for all students
students = models.User.objects.filter(
    Q(current_role='student') | Q(roles__icontains='student')
)
for student in students:
    models.StudentPoints.objects.get_or_create(user=student)
print(f"✅ Created StudentPoints for {students.count()} students")

# Initialize InstructorPoints for all instructors
instructors = models.User.objects.filter(
    Q(current_role__in=['teacher', 'instructor']) | 
    Q(roles__icontains='teacher') |
    Q(roles__icontains='instructor')
)
for instructor in instructors:
    models.InstructorPoints.objects.get_or_create(user=instructor)
print(f"✅ Created InstructorPoints for {instructors.count()} instructors")

# Recalculate from enrollments
print("\nProcessing course completions...")
enrollments = models.EnrolledCourse.objects.select_related('course', 'user').all()
completion_count = 0
for enrollment in enrollments:
    if enrollment.is_course_completed():
        models.StudentPoints.add_points(
            enrollment.user, 100, 'course_completion',
            course_id=enrollment.course.id,
            description=f"Completed course: {enrollment.course.title}"
        )
        completion_count += 1
print(f"✅ Processed {completion_count} course completions")

# Recalculate from quiz attempts
print("Processing quiz attempts...")
quiz_attempts = models.QuizAttempt.objects.filter(
    is_passed=True
).select_related('user', 'quiz', 'quiz__course').all()
quiz_count = 0
for attempt in quiz_attempts:
    score_points = int(attempt.score) if attempt.score else 0
    score_points = min(score_points, 100)
    if score_points > 0:
        models.StudentPoints.add_points(
            attempt.user, score_points, 'quiz_score',
            quiz_id=attempt.quiz.id if attempt.quiz else None,
            course_id=attempt.quiz.course.id if attempt.quiz and attempt.quiz.course else None,
            description=f"Quiz attempt on {attempt.quiz.title if attempt.quiz else 'Unknown'}: {int(attempt.score)}%"
        )
        quiz_count += 1
print(f"✅ Processed {quiz_count} quiz attempts")

# Recalculate from reviews
print("Processing course ratings...")
reviews = models.Review.objects.select_related('user', 'course').all()
review_count = 0
for review in reviews:
    models.StudentPoints.add_points(
        review.user, 50, 'rating_given',
        review_id=review.id,
        course_id=review.course.id if review.course else None,
        description=f"Gave {review.rating}* rating on: {review.course.title if review.course else 'Course'}"
    )
    review_count += 1
print(f"✅ Processed {review_count} course ratings")

# Recalculate instructor points from published courses
print("Processing published courses...")
published_courses = models.Course.objects.filter(
    is_published_version=True
).select_related('teacher', 'teacher__user').all()
published_count = 0
for course in published_courses:
    if course.teacher and course.teacher.user:
        models.InstructorPoints.add_points(
            course.teacher.user, 100, 'course_published',
            course_id=course.id,
            description=f"Published course: {course.title}"
        )
        published_count += 1
print(f"✅ Processed {published_count} published courses")

# Recalculate from student enrollments (for instructor points)
print("Processing student enrollments...")
all_enrollments = models.EnrolledCourse.objects.select_related(
    'course', 'course__teacher', 'course__teacher__user'
).all()
enrollment_count = 0
for enrollment in all_enrollments:
    if enrollment.course.teacher and enrollment.course.teacher.user:
        models.InstructorPoints.add_points(
            enrollment.course.teacher.user, 10, 'student_enrollment',
            course_id=enrollment.course.id,
            description=f"Student enrolled in: {enrollment.course.title}"
        )
        enrollment_count += 1
print(f"✅ Processed {enrollment_count} student enrollments")

# Summary
print("\n" + "=" * 70)
print("REGENERATION COMPLETE")
print("=" * 70)

new_count = models.PointsAuditLog.objects.count()
with_course = models.PointsAuditLog.objects.exclude(course_id__isnull=True).exclude(course_id=0).count()
without_course = models.PointsAuditLog.objects.filter(Q(course_id__isnull=True) | Q(course_id=0)).count()

print(f"\nNew audit log entries: {new_count}")
print(f"  With course_id: {with_course}")
print(f"  Without course_id: {without_course}")

student_points_total = models.StudentPoints.objects.aggregate(
    total=Sum('lifetime_points')
)['total'] or 0
instructor_points_total = models.InstructorPoints.objects.aggregate(
    total=Sum('lifetime_points')
)['total'] or 0

print(f"\nStudent points total: {student_points_total}")
print(f"Instructor points total: {instructor_points_total}")

print("\n✅ Audit log has been regenerated with course data!")
print("=" * 70)
