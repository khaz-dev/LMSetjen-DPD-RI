#!/usr/bin/env python
"""
Fix: Award missing instructor points for all course reviews
When a student reviews an instructor's course, the instructor should get points
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db import transaction

print("=" * 120)
print(" " * 20 + "FIX: AWARD MISSING INSTRUCTOR POINTS FOR COURSE REVIEWS")
print("=" * 120)

print(f"\n🔍 PHASE: Identifying all student reviews of instructor courses")
print("-" * 120)

# Get all course reviews (reviews with a course and role='student')
course_reviews = models.Review.objects.filter(
    course__isnull=False,
    role='student',
    _points_awarded=True
).select_related('user', 'course', 'course__teacher')

print(f"\nTotal student reviews on courses: {course_reviews.count()}")

missing_count = 0
already_awarded = 0
courses_missing = 0

for review in course_reviews:
    if not review.course.teacher:
        continue
    
    # Check if instructor already got points for this review
    instructor_audit = models.PointsAuditLog.objects.filter(
        review_id=review.id,
        user=review.course.teacher.user,
        activity_type='student_rating'
    ).first()
    
    if instructor_audit:
        already_awarded += 1
    else:
        missing_count += 1
        if courses_missing == 0:
            print(f"\n❌ INSTRUCTORS MISSING POINTS:\n")
        courses_missing += 1
        print(f"  Review {review.id}: {review.user.username} → {review.course.title[:50]}")
        print(f"    Teacher: {review.course.teacher.full_name}")
        print(f"    Missing: +50 points (student_rating on course)")

print(f"\n\nSUMMARY OF MISSING INSTRUCTOR POINTS:")
print(f"  Total course reviews: {course_reviews.count()}")
print(f"  With instructor points: {already_awarded}")
print(f"  Missing instructor points: {missing_count}")

if missing_count == 0:
    print(f"\n✅ All instructors already have points for course reviews! No fix needed.")
else:
    print(f"\n🔧 APPLYING FIX: Award points to {missing_count} review(s)...")
    print("-" * 120)
    
    with transaction.atomic():
        fixed_count = 0
        
        for review in course_reviews:
            if not review.course.teacher:
                continue
            
            # Check if instructor already got points
            instructor_audit = models.PointsAuditLog.objects.filter(
                review_id=review.id,
                user=review.course.teacher.user,
                activity_type='student_rating'
            ).first()
            
            if instructor_audit:
                continue  # Already has points, skip
            
            # Award points to the instructor
            try:
                models.InstructorPoints.add_points(
                    review.course.teacher.user,
                    50,
                    'student_rating',
                    review_id=review.id,
                    course_id=review.course.id,
                    description=f"Course review from student: {review.course.title[:40]}"
                )
                fixed_count += 1
                print(f"  ✅ Review {review.id}: Awarded +50 to {review.course.teacher.full_name}")
            except Exception as e:
                print(f"  ❌ Review {review.id}: ERROR - {str(e)}")

print(f"\n{fixed_count} instructor point awards completed!")

print(f"\n" + "=" * 120)
print("VERIFICATION")
print("=" * 120)

# Re-check all teachers
teachers = models.Teacher.objects.filter(course__isnull=False).distinct()
print(f"\n✓ Teacher Point Status:\n")

for teacher in teachers:
    courses = models.Course.objects.filter(teacher=teacher)
    course_reviews = models.Review.objects.filter(course__in=courses, role='student', _points_awarded=True)
    instructor_audits = models.PointsAuditLog.objects.filter(
        user=teacher.user,
        activity_type='student_rating'
    )
    
    ip = models.InstructorPoints.objects.filter(user=teacher.user).first()
    
    print(f"{teacher.full_name} ({teacher.user.username}):")
    print(f"  Course reviews expected to award: {course_reviews.count()}")
    print(f"  Audit entries for 'student_rating': {instructor_audits.count()}")
    print(f"  InstructorPoints: {ip.lifetime_points if ip else 0}")
    
    if course_reviews.count() == instructor_audits.count():
        print(f"  ✅ MATCH - All course reviews awarded!")
    else:
        print(f"  ❌ MISMATCH - {course_reviews.count() - instructor_audits.count()} still missing")
    print()

# Overall verification
print(f"\n" + "=" * 120)
print("OVERALL VERIFICATION")
print("=" * 120)

all_course_reviews = models.Review.objects.filter(course__isnull=False, role='student', _points_awarded=True)
reviewers_paid = models.PointsAuditLog.objects.filter(activity_type='rating_given').count()
instructors_paid = models.PointsAuditLog.objects.filter(activity_type='student_rating').count()

print(f"\nCourse Reviews (student role): {all_course_reviews.count()}")
print(f"Audit entries for 'rating_given' (reviewers paid): {reviewers_paid}")
print(f"Audit entries for 'student_rating' (instructors paid): {instructors_paid}")

if reviewers_paid == all_course_reviews.count() and instructors_paid >= all_course_reviews.count():
    print(f"\n✅ VERIFICATION PASSED - All reviewers and instructors are paid!")
else:
    print(f"\n⚠️  WARNING - Some payments might be missing")

print("\n" + "=" * 120 + "\n")
