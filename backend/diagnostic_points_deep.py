#!/usr/bin/env python
"""Deep diagnostic: Check quiz attempts and ratings duplication"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db.models import Count, Max

print("=" * 70)
print("POINTS SYSTEM - DEEP DIAGNOSTIC")
print("=" * 70)

# 1. Check for multiple quiz attempts by same student on same quiz
print("\n1. MULTIPLE QUIZ ATTEMPTS ANALYSIS:")
print("-" * 70)

quiz_attempts = models.QuizAttempt.objects.values(
    'user_id', 'quiz_id'
).annotate(
    attempt_count=Count('id'),
    max_score=Max('score')
).filter(
    attempt_count__gt=1
)

print(f"Student-Quiz combinations with multiple attempts: {quiz_attempts.count()}")

if quiz_attempts.exists():
    for attempt in quiz_attempts[:5]:
        user = models.User.objects.get(id=attempt['user_id'])
        quiz = models.Course.objects.get(id=attempt['quiz_id']) if attempt['quiz_id'] else None
        quiz_title = quiz.title if quiz else f"ID {attempt['quiz_id']}"
        print(f"\n  User: {user.full_name}")
        print(f"  Quiz: {quiz_title}")
        print(f"  Attempts: {attempt['attempt_count']}")
        print(f"  Max Score: {attempt['max_score']}")
        
        # Show all attempts
        attempts = models.QuizAttempt.objects.filter(
            user_id=attempt['user_id'],
            quiz_id=attempt['quiz_id']
        ).order_by('-score')
        
        for i, att in enumerate(attempts):
            print(f"    Attempt {i+1}: Score={att.score}%, is_passed={att.is_passed}")

# 2. Check audit log for duplicate quiz point awards
print("\n\n2. QUIZ POINTS IN AUDIT LOG:")
print("-" * 70)

quiz_audit_logs = models.PointsAuditLog.objects.filter(
    activity_type='quiz_score'
).select_related('user').order_by('user_id', '-points_awarded')

print(f"Total quiz point awards: {quiz_audit_logs.count()}")

# Group by user to see if same user has multiple entries
from django.db.models import Count as DjangoCount
user_quiz_counts = quiz_audit_logs.values('user_id').annotate(
    count=DjangoCount('id')
).filter(count__gt=1)

print(f"Users with multiple quiz point awards: {user_quiz_counts.count()}")

if user_quiz_counts.exists():
    for entry in user_quiz_counts[:3]:
        user = models.User.objects.get(id=entry['user_id'])
        user_logs = quiz_audit_logs.filter(user_id=entry['user_id'])
        print(f"\n  User: {user.full_name}")
        print(f"  Total quiz awards: {entry['count']}")
        total_points = sum(log.points_awarded for log in user_logs)
        print(f"  Total points awarded: {total_points}")
        for log in user_logs[:3]:
            print(f"    - {log.points_awarded} points: {log.description}")

# 3. Check testimonials and ratings
print("\n\n3. TESTIMONIALS/RATINGS ROLE ANALYSIS:")
print("-" * 70)

reviews = models.Review.objects.all()
print(f"Total reviews in system: {reviews.count()}")

# Check users who gave multiple testimonials on same course
user_course_reviews = reviews.values('user_id', 'course_id').annotate(
    count=DjangoCount('id')
).filter(count__gt=1)

print(f"User-Course combinations with multiple reviews: {user_course_reviews.count()}")

if user_course_reviews.exists():
    for entry in user_course_reviews[:5]:
        user = models.User.objects.get(id=entry['user_id'])
        try:
            course = models.Course.objects.get(id=entry['course_id'])
            course_title = course.title[:40]
        except:
            course_title = f"ID {entry['course_id']} (Not Found)"
        
        user_reviews = reviews.filter(user_id=entry['user_id'], course_id=entry['course_id'])
        
        print(f"\n  User: {user.full_name} (Role: {user.current_role})")
        print(f"  Course: {course_title}")
        print(f"  Reviews: {entry['count']}")
        for review in user_reviews:
            print(f"    - Rating: {review.rating}*, Date: {review.date.strftime('%Y-%m-%d')}")

# 4. Check rating point awards in audit log
print("\n\n4. RATING POINTS IN AUDIT LOG:")
print("-" * 70)

rating_audit_logs = models.PointsAuditLog.objects.filter(
    activity_type='rating_given'
).select_related('user')

print(f"Total rating point awards: {rating_audit_logs.count()}")

user_rating_counts = rating_audit_logs.values('user_id').annotate(
    count=DjangoCount('id')
).filter(count__gt=1)

print(f"Users with multiple rating point awards: {user_rating_counts.count()}")

if user_rating_counts.exists():
    for entry in user_rating_counts[:3]:
        user = models.User.objects.get(id=entry['user_id'])
        user_logs = rating_audit_logs.filter(user_id=entry['user_id'])
        print(f"\n  User: {user.full_name}")
        print(f"  Role: {user.current_role}")
        print(f"  Rating awards: {entry['count']}")
        total_points = sum(log.points_awarded for log in user_logs)
        print(f"  Total points: {total_points}")
        for log in user_logs:
            print(f"    - {log.points_awarded} points: {log.description}")

# 5. Check for students with both student and instructor ratings
print("\n\n5. DUAL-ROLE ANALYSIS:")
print("-" * 70)

users_with_multiple_reviews = (
    reviews
    .values('user_id')
    .annotate(count=DjangoCount('id'))
    .filter(count__gt=1)
)

dual_role_issues = []
for entry in users_with_multiple_reviews:
    user = models.User.objects.get(id=entry['user_id'])
    user_reviews = reviews.filter(user_id=entry['user_id'])
    
    # Check if user has both student and instructor roles
    has_student = 'student' in (user.current_role or '') or 'student' in (user.roles or '')
    has_instructor = 'instructor' in (user.current_role or '') or 'teacher' in (user.current_role or '') or 'instructor' in (user.roles or '')
    
    if has_student and has_instructor:
        dual_role_issues.append({
            'user': user,
            'reviews': user_reviews.count(),
            'roles': f"Student + Instructor"
        })

print(f"Users with dual roles AND multiple reviews: {len(dual_role_issues)}")
for issue in dual_role_issues[:3]:
    print(f"  - {issue['user'].full_name}: {issue['reviews']} reviews ({issue['roles']})")

print("\n" + "=" * 70)
print("ISSUES SUMMARY")
print("=" * 70)

issues = []

# Check for quiz award duplicates
if quiz_audit_logs.count() > 0:
    unique_quizzes = models.QuizAttempt.objects.values('user_id', 'quiz_id').distinct().count()
    if quiz_audit_logs.count() > unique_quizzes:
        issues.append(f"❌ Quiz Points: {quiz_audit_logs.count()} awards for {unique_quizzes} user-quiz combos (DUPLICATES)")

if rating_audit_logs.count() > reviews.count():
    issues.append(f"❌ Rating Points: {rating_audit_logs.count()} awards for {reviews.count()} reviews (DUPLICATES)")

if len(dual_role_issues) > 0:
    issues.append(f"❌ Dual Role: {len(dual_role_issues)} users with multiple reviews and dual roles (AMBIGUITY)")

if issues:
    print("\nProblems Found:")
    for issue in issues:
        print(f"  {issue}")
else:
    print("\n✅ No major issues detected")

print("=" * 70 + "\n")
