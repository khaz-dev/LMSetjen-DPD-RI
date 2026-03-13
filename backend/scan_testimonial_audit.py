#!/usr/bin/env python
"""Deep scan to find where testimonial points are NOT being awarded"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db.models import Sum, Q

print("=" * 90)
print("DEEP SCAN: WHERE ARE TESTIMONIAL POINTS?")
print("=" * 90)

# Get all reviews
print("\n1. REVIEW OBJECTS STATUS:")
print("-" * 90)

all_reviews = models.Review.objects.all().order_by('id')
print(f"\nTotal Review objects: {all_reviews.count()}\n")

for review in all_reviews:
    user_str = f"{review.user.username}" if review.user else "NO USER"
    course_str = f"{review.course.title[:40]}" if review.course else "[PLATFORM TESTIMONIAL]"
    
    # Check if there's an AuditLog entry for this review
    audit = models.PointsAuditLog.objects.filter(review_id=review.id).first()
    
    print(f"Review {review.id}: {user_str} {course_str}")
    print(f"  Role: {review.role}, Rating: {review.rating}*, Active: {review.active}, _points_awarded: {review._points_awarded}")
    
    if audit:
        print(f"  ✅ AuditLog: {audit.activity_type} ({audit.points_awarded} pts) - ID: {audit.id}")
    else:
        print(f"  ❌ NO AuditLog entry")
    print()

# Get all AuditLog entries related to reviews
print("\n2. AUDIT LOG ENTRIES WITH review_id:")
print("-" * 90)

review_audits = models.PointsAuditLog.objects.filter(review_id__isnull=False)
print(f"\nTotal PointsAuditLog entries with review_id: {review_audits.count()}\n")

for audit in review_audits.order_by('review_id'):
    user_str = f"{audit.user.username}" if audit.user else "NO USER"
    print(f"AuditLog {audit.id}: {user_str}")
    print(f"  Activity: {audit.activity_type}, Points: {audit.points_awarded}, Type: {audit.points_type}")
    print(f"  Review ID: {audit.review_id}")
    
    # Verify the review exists
    try:
        review = models.Review.objects.get(id=audit.review_id)
        course_str = f"{review.course.title[:40]}" if review.course else "[Platform]"
        print(f"  Review: {course_str}, Role: {review.role}")
    except models.Review.DoesNotExist:
        print(f"  Review: ❌ DELETED (ID: {audit.review_id})")
    print()

# Get all rating_given activities
print("\n3. ALL 'rating_given' AUDIT ENTRIES:")
print("-" * 90)

rating_audits = models.PointsAuditLog.objects.filter(activity_type='rating_given').order_by('awarded_at')
print(f"\nTotal 'rating_given' entries: {rating_audits.count()}\n")

for audit in rating_audits:
    user_str = f"{audit.user.username}" if audit.user else "NO USER"
    print(f"AuditLog {audit.id}: {user_str}")
    print(f"  Points: {audit.points_awarded}, Type: {audit.points_type}, Review ID: {audit.review_id}")
    
    if audit.review_id:
        try:
            review = models.Review.objects.get(id=audit.review_id)
            course_str = f"Course: {review.course.title[:40]}" if review.course else "[Platform Testimonial]"
            print(f"  {course_str}")
        except models.Review.DoesNotExist:
            print(f"  Review: ❌ DELETED")
    print()

# Check platform testimonials specifically
print("\n4. PLATFORM TESTIMONIALS (course__isnull=True):")
print("-" * 90)

platform_testimonials = models.Review.objects.filter(course__isnull=True)
print(f"\nTotal platform testimonials: {platform_testimonials.count()}\n")

for review in platform_testimonials.order_by('id'):
    user_str = f"{review.user.username}" if review.user else "NO USER"
    print(f"Review {review.id}: {user_str} as {review.role}")
    print(f"  Rating: {review.rating}*, Active: {review.active}, _points_awarded: {review._points_awarded}")
    
    # Check for audit entry
    audit = models.PointsAuditLog.objects.filter(review_id=review.id).first()
    if audit:
        print(f"  ✅ AuditLog: {audit.activity_type} ({audit.points_awarded} pts)")
    else:
        print(f"  ❌ NO AuditLog entry")
    print()

# Summary by user
print("\n5. POINTS SUMMARY BY USER:")
print("-" * 90)

for user in models.User.objects.all():
    sp = models.StudentPoints.objects.filter(user=user).first()
    sp_points = sp.lifetime_points if sp else 0
    
    ip = models.InstructorPoints.objects.filter(user=user).first()
    ip_points = ip.lifetime_points if ip else 0
    
    # Get audit totals
    student_audit_total = models.PointsAuditLog.objects.filter(
        user=user, points_type='student'
    ).aggregate(total=Sum('points_awarded'))['total'] or 0
    
    instructor_audit_total = models.PointsAuditLog.objects.filter(
        user=user, points_type='instructor'
    ).aggregate(total=Sum('points_awarded'))['total'] or 0
    
    # Check for active reviews
    active_reviews = models.Review.objects.filter(user=user, active=True).count()
    
    print(f"\n{user.username}:")
    print(f"  StudentPoints: {sp_points} | AuditLog: {student_audit_total} {'✅' if sp_points == student_audit_total else '❌'}")
    print(f"  InstructorPoints: {ip_points} | AuditLog: {instructor_audit_total} {'✅' if ip_points == instructor_audit_total else '❌'}")
    print(f"  Active Reviews: {active_reviews}")

print("\n" + "=" * 90 + "\n")
