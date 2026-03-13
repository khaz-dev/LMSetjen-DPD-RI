#!/usr/bin/env python
"""Deep analysis of points issues - Quiz and Testimonial"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db.models import Sum, Count, Max, Q
from userauths.models import User

print("=" * 90)
print("DEEP ANALYSIS: POINTS ISSUES")
print("=" * 90)

# ISSUE 1: QUIZ POINTS - Check if highest score is being used
print("\n\n1. QUIZ SCORING ANALYSIS:")
print("=" * 90)
print("Issue: Student should earn points based on HIGHEST score, not first passing attempt")
print("-" * 90)

quiz_attempts = models.QuizAttempt.objects.filter(is_passed=True).values(
    'user_id', 'quiz_id'
).annotate(
    count=Count('id'),
    max_score=Max('score')
).filter(count__gt=1)

print(f"Total user-quiz combinations with multiple passing attempts: {quiz_attempts.count()}")

for combo in quiz_attempts[:10]:  # Show first 10
    attempts = models.QuizAttempt.objects.filter(
        user_id=combo['user_id'],
        quiz_id=combo['quiz_id'],
        is_passed=True
    ).order_by('score')
    
    user = models.User.objects.get(id=combo['user_id'])
    quiz = models.Quiz.objects.get(id=combo['quiz_id'])
    
    scores = [int(a.score) for a in attempts]
    highest_score = max(scores)
    first_score = scores[0]
    
    print(f"\n  {user.username} on Quiz '{quiz.title}':")
    print(f"    Scores: {scores}")
    print(f"    Highest: {highest_score}, First: {first_score}")
    print(f"    Difference: {highest_score - first_score} points lost" if highest_score != first_score else "    ✓ Same")
    
    # Check what's in AuditLog
    audit_total = models.PointsAuditLog.objects.filter(
        user_id=combo['user_id'],
        activity_type='quiz_score'
    ).aggregate(total=Sum('points_awarded'))['total'] or 0
    
    print(f"    AuditLog total: {audit_total} (should be {highest_score})")
    if audit_total != highest_score:
        print(f"    ⚠️  MISMATCH!")


# ISSUE 2: TESTIMONIAL POINTS - Check for multi-role duplicates
print("\n\n2. TESTIMONIAL/REVIEW MULTI-ROLE ANALYSIS:")
print("=" * 90)
print("Issue: User giving testimonial as 'student' AND as 'instructor' should not get duplicate points")
print("-" * 90)

# Find users with both student and instructor testimonials
users_with_both = models.Review.objects.filter(
    course__isnull=True,  # Platform testimonials only
    active=True
).values('user').annotate(
    role_count=Count('role', distinct=True),
    total_reviews=Count('id')
).filter(role_count__gt=1)

print(f"Users with multiple role testimonials: {users_with_both.count()}")

for combo in users_with_both:
    user = models.User.objects.get(id=combo['user'])
    reviews = models.Review.objects.filter(
        user=user,
        course__isnull=True,
        active=True
    ).order_by('role')
    
    print(f"\n  {user.username}:")
    
    for review in reviews:
        print(f"    - Role: {review.role}, Rating: {review.rating}*, Date: {review.date.date()}, Active: {review.active}")
        
        # Check audit log for this review
        audit = models.PointsAuditLog.objects.filter(
            user=user,
            review_id=review.id
        ).first()
        
        if audit:
            print(f"      ✓ AuditLog: {audit.activity_type} ({audit.points_awarded} pts) - {audit.points_type}")
        else:
            print(f"      ✗ No AuditLog entry found")
    
    # Check total points from testimonials
    total_review_points = models.PointsAuditLog.objects.filter(
        user=user,
        activity_type='rating_given'
    ).aggregate(total=Sum('points_awarded'))['total'] or 0
    
    print(f"    Total rating_given points: {total_review_points}")
    print(f"    Should be: 50 (only first/primary role)")


# ISSUE 3: Check InstructorPoints for instructor roles
print("\n\n3. INSTRUCTOR POINTS ANALYSIS:")
print("=" * 90)
print("Issue: When instructor gives a testimonial, check if they get InstructorPoints too")
print("-" * 90)

instructor_testimonials = models.Review.objects.filter(
    course__isnull=True,
    active=True,
    role='instructor'
).select_related('user')

print(f"Active instructor testimonials: {instructor_testimonials.count()}")

for review in instructor_testimonials:
    user = review.user
    print(f"\n  {user.username}:")
    print(f"    Rating: {review.rating}*, Date: {review.date.date()}")
    
    # Check StudentPoints
    student_points = models.StudentPoints.objects.filter(user=user).first()
    if student_points:
        print(f"    StudentPoints: {student_points.lifetime_points}")
    else:
        print(f"    StudentPoints: None")
    
    # Check InstructorPoints
    instructor_points = models.InstructorPoints.objects.filter(user=user).first()
    if instructor_points:
        print(f"    InstructorPoints: {instructor_points.lifetime_points}")
    else:
        print(f"    InstructorPoints: None")
    
    # Check AuditLog
    student_audit = models.PointsAuditLog.objects.filter(
        user=user,
        review_id=review.id,
        points_type='student'
    ).aggregate(total=Sum('points_awarded'))['total'] or 0
    
    instructor_audit = models.PointsAuditLog.objects.filter(
        user=user,
        review_id=review.id,
        points_type='instructor'
    ).aggregate(total=Sum('points_awarded'))['total'] or 0
    
    print(f"    AuditLog - Student: {student_audit}, Instructor: {instructor_audit}")
    
    if student_audit > 0 and instructor_audit > 0:
        print(f"    ⚠️  BOTH student and instructor points awarded for same testimonial!")


# ISSUE 4: Check for _points_awarded flags
print("\n\n4. DEDUPLICATION FLAG CHECK:")
print("=" * 90)
print("Status of _points_awarded flags on reviews")
print("-" * 90)

reviews_with_flag = models.Review.objects.filter(
    active=True,
    _points_awarded=True
).count()

reviews_without_flag = models.Review.objects.filter(
    active=True,
    _points_awarded=False
).count()

print(f"Active reviews with _points_awarded=True: {reviews_with_flag}")
print(f"Active reviews with _points_awarded=False: {reviews_without_flag}")

# Show some details
unflaged_reviews = models.Review.objects.filter(
    active=True,
    _points_awarded=False
)[:5]

if unflaged_reviews.exists():
    print(f"\nUnflagged active reviews (first 5):")
    for review in unflaged_reviews:
        print(f"  - {review.user.username}: Role={review.role}, Rating={review.rating}*, Course={review.course}")


print("\n" + "=" * 90)
print("ANALYSIS COMPLETE")
print("=" * 90 + "\n")
