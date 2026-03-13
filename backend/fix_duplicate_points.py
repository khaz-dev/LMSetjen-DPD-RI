#!/usr/bin/env python
"""Fix duplicate points from multiple quiz attempts and ratings"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db.models import Count, Max, Sum
from django.utils import timezone

print("=" * 70)
print("POINTS SYSTEM - DEDUPLICATION & FIX")
print("=" * 70)

# 1. Fix Quiz Attempts - keep only highest score per student-quiz
print("\n1. FIXING QUIZ ATTEMPT DUPLICATES:")
print("-" * 70)

# Get all student-quiz combinations with multiple attempts
duplicate_attempts = models.QuizAttempt.objects.values(
    'user_id', 'quiz_id'
).annotate(
    count=Count('id'),
    max_score=Max('score')
).filter(count__gt=1)

total_quiz_fixes = 0
for combo in duplicate_attempts:
    # Find all attempts for this combo
    attempts = models.QuizAttempt.objects.filter(
        user_id=combo['user_id'],
        quiz_id=combo['quiz_id'],
        is_passed=True
    ).order_by('-score')
    
    if attempts.exists():
        best_attempt = attempts.first()
        # Mark only the best one for points
        best_attempt._points_awarded = True
        best_attempt.save(update_fields=['_points_awarded'])
        
        # Mark all others as processed but no points
        for attempt in attempts[1:]:
            attempt._points_awarded = True
            attempt.save(update_fields=['_points_awarded'])
        
        total_quiz_fixes += 1

print(f"Fixed {total_quiz_fixes} student-quiz combinations")

# 2. Clear old quiz points that were duplicates
print("\n2. REMOVING DUPLICATE QUIZ POINTS FROM AUDIT LOG:")
print("-" * 70)

# Find users who got points for multiple quiz attempts on same quiz
quiz_point_stats = models.PointsAuditLog.objects.filter(
    activity_type='quiz_score'
).values('user_id', 'quiz_id').annotate(
    count=Count('id'),
    total_points=Sum('points_awarded')
).filter(count__gt=1)

print(f"Users with duplicate quiz point awards: {quiz_point_stats.count()}")

# Delete the old quiz audit logs (we'll regenerate)
old_quiz_count = models.PointsAuditLog.objects.filter(
    activity_type='quiz_score'
).count()

print(f"Deleting {old_quiz_count} old quiz point audit entries...")
models.PointsAuditLog.objects.filter(
    activity_type='quiz_score'
).delete()
print("✅ Deleted old quiz audit log")

# 3. Fix Reviews - keep only one per user-course, no duplicates
print("\n3. FIXING REVIEW DUPLICATES:")
print("-" * 70)

# Get reviews with duplicate user-course combos
duplicate_reviews = models.Review.objects.values(
    'user_id', 'course_id'
).annotate(
    count=Count('id')
).filter(count__gt=1)

print(f"User-Course combos with multiple reviews: {duplicate_reviews.count()}")

total_review_fixes = 0
for combo in duplicate_reviews:
    reviews = models.Review.objects.filter(
        user_id=combo['user_id'],
        course_id=combo['course_id']
    ).order_by('-date')
    
    if reviews.exists():
        # Mark only the first/latest one for points
        best_review = reviews.first()
        best_review._points_awarded = False  # Reset, will be recalculated
        best_review.save(update_fields=['_points_awarded'])
        
        # Mark all others as processed
        for review in reviews[1:]:
            review._points_awarded = True  # Don't award points
            review.save(update_fields=['_points_awarded'])
        
        total_review_fixes += 1

print(f"Fixed {total_review_fixes} user-course review combinations")

# 4. Clear old rating points from audit
print("\n4. REMOVING DUPLICATE RATING POINTS FROM AUDIT LOG:")
print("-" * 70)

old_rating_count = models.PointsAuditLog.objects.filter(
    activity_type='rating_given'
).count()

print(f"Deleting {old_rating_count} old rating point audit entries...")
models.PointsAuditLog.objects.filter(
    activity_type='rating_given'
).delete()
print("✅ Deleted old rating audit log")

# 5. Reset StudentPoints and recalculate from scratch
print("\n5. RESETTING AND RECALCULATING POINTS:")
print("-" * 70)

print("Resetting StudentPoints...")
models.StudentPoints.objects.all().delete()

# Regenerate points from course completions
completion_count = 0
for enrollment in models.EnrolledCourse.objects.select_related('user', 'course').all():
    if enrollment.is_course_completed():
        models.StudentPoints.add_points(
            enrollment.user, 100, 'course_completion',
            course_id=enrollment.course.id,
            description=f"Completed course: {enrollment.course.title}"
        )
        completion_count += 1

print(f"✅ {completion_count} course completions")

# Regenerate points from best quiz attempts only
quiz_count = 0
from django.db.models import Max
best_attempts = models.QuizAttempt.objects.filter(
    is_passed=True
).values('user_id', 'quiz_id').annotate(
    best_score=Max('score')
)

for combo in best_attempts:
    best_attempt = models.QuizAttempt.objects.filter(
        user_id=combo['user_id'],
        quiz_id=combo['quiz_id'],
        is_passed=True,
        score=combo['best_score']
    ).first()
    
    if best_attempt:
        score_points = min(int(best_attempt.score), 100)
        if score_points > 0:
            models.StudentPoints.add_points(
                best_attempt.user, score_points, 'quiz_score',
                quiz_id=best_attempt.quiz.id,
                course_id=best_attempt.quiz.course.id if best_attempt.quiz.course else None,
                description=f"Quiz score {score_points}% on: {best_attempt.quiz.title}"
            )
            quiz_count += 1

print(f"✅ {quiz_count} best quiz attempts (highest score only)")

# Regenerate points from active reviews (newest only per user-course)
review_count = 0
# For each user-course combo with reviews, only award for the newest one
for combo in models.Review.objects.filter(active=True, _points_awarded=False).values('user_id', 'course_id').distinct():
    newest_review = models.Review.objects.filter(
        user_id=combo['user_id'],
        course_id=combo['course_id'],
        active=True
    ).order_by('-date').first()
    
    if newest_review and newest_review.user and newest_review.role == 'student':
        models.StudentPoints.add_points(
            newest_review.user, 50, 'rating_given',
            review_id=newest_review.id,
            course_id=newest_review.course.id if newest_review.course else None,
            description=f"Gave {newest_review.rating}* rating on: {newest_review.course.title if newest_review.course else 'Course'}"
        )
        review_count += 1

print(f"✅ {review_count} course ratings (newest only per combo)")

# Summary
print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)

student_total = models.StudentPoints.objects.aggregate(
    total=__import__('django.db.models', fromlist=['Sum']).Sum('lifetime_points')
)['total'] or 0

audit_total = models.PointsAuditLog.objects.filter(
    points_type='student'
).aggregate(
    total=__import__('django.db.models', fromlist=['Sum']).Sum('points_awarded')
)['total'] or 0

print(f"\nStudent Points Total: {student_total}")
print(f"Audit Log Total: {audit_total}")
print(f"Match: {'✅ YES' if student_total == audit_total else '❌ NO'}")

audit_entries = models.PointsAuditLog.objects.filter(activity_type='quiz_score').count()
audit_ratings = models.PointsAuditLog.objects.filter(activity_type='rating_given').count()

print(f"\nAudit Log Breakdown:")
print(f"  - Quiz points: {audit_entries}")
print(f"  - Rating points: {audit_ratings}")

print("\n✅ Points system deduplication complete!")
print("=" * 70 + "\n")
