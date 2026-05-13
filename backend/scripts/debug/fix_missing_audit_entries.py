#!/usr/bin/env python
"""Fix: Award points to reviews that have _points_awarded=True but no PointsAuditLog"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db.models import Sum

print("=" * 90)
print("FIX: AWARD MISSING POINTS FOR TESTIMONIALS & REVIEWS")
print("=" * 90)

# Find all reviews with _points_awarded=True but NO PointsAuditLog entry
print("\n1. IDENTIFY REVIEWS MISSING AUDIT LOG ENTRIES:")
print("-" * 90)

all_flagged_reviews = models.Review.objects.filter(_points_awarded=True)
print(f"Reviews with _points_awarded=True: {all_flagged_reviews.count()}")

missing_audit = []
for review in all_flagged_reviews:
    audit = models.PointsAuditLog.objects.filter(review_id=review.id).first()
    if not audit:
        missing_audit.append(review)
        course_str = review.course.title[:50] if review.course else "[PLATFORM TESTIMONIAL]"
        print(f"\n❌ Review {review.id}: {course_str}")
        print(f"   Active: {review.active}, Role: {review.role}, Rating: {review.rating}*")
        print(f"   User: {review.user.username if review.user else 'NO USER'}")

print(f"\n\nTotal reviews missing audit entries: {len(missing_audit)}")

# Award points for each missing one
print("\n\n2. AWARD POINTS FOR MISSING REVIEWS:")
print("-" * 90)

awarded_count = 0

for review in missing_audit:
    if not review.user or not review.active:
        print(f"\n⏭️  Review {review.id}: Skipping (no user or not active)")
        continue
    
    course_str = review.course.title[:50] if review.course else f"[PLATFORM TESTIMONIAL as {review.role}]"
    
    try:
        # Award 50 points for the review
        models.StudentPoints.add_points(
            review.user,
            50,
            'rating_given',
            review_id=review.id,
            course_id=review.course.id if review.course else None,
            description=f"Review: {review.rating}* on {course_str}"
        )
        
        print(f"\n✅ Review {review.id}: Awarded 50 points")
        print(f"   To: {review.user.username}")
        print(f"   For: {course_str}")
        
        awarded_count += 1
        
    except Exception as e:
        print(f"\n❌ Review {review.id}: ERROR - {str(e)}")

# Verify
print("\n\n3. VERIFICATION:")
print("-" * 90)

# Recheck all flagged reviews
still_missing = 0
for review in models.Review.objects.filter(_points_awarded=True):
    audit = models.PointsAuditLog.objects.filter(review_id=review.id).first()
    if not audit:
        still_missing += 1
        print(f"⚠️  Review {review.id}: Still has no audit entry")

if still_missing == 0:
    print("✅ All flagged reviews now have audit entries!")

# Check StudentPoints totals
print("\n\n4. STUDENT POINTS VERIFICATION:")
print("-" * 90)

for user in models.User.objects.filter(review__isnull=False).distinct():
    sp = models.StudentPoints.objects.filter(user=user).first()
    sp_points = sp.lifetime_points if sp else 0
    
    audit_total = models.PointsAuditLog.objects.filter(
        user=user,
        points_type='student'
    ).aggregate(total=Sum('points_awarded'))['total'] or 0
    
    match = "✅" if sp_points == audit_total else "❌"
    print(f"{match} {user.username}: StudentPoints={sp_points}, AuditLog={audit_total}")

print("\n\n5. SUMMARY:")
print("-" * 90)

total_student_points = models.StudentPoints.objects.aggregate(
    total=Sum('lifetime_points')
)['total'] or 0

total_audit = models.PointsAuditLog.objects.filter(
    points_type='student'
).aggregate(
    total=Sum('points_awarded')
)['total'] or 0

print(f"\nTotal StudentPoints: {total_student_points}")
print(f"Total AuditLog: {total_audit}")
print(f"Match: {'✅ YES' if total_student_points == total_audit else '❌ NO'}")

print(f"\nPoints awarded in this fix: {awarded_count}")
print(f"Reviews still missing audits: {still_missing}")

if awarded_count > 0 and still_missing == 0:
    print("\n✨ FIX SUCCESSFUL! All testimonial points are now in the audit log.")
else:
    print("\n⚠️  Some issues remain - investigate further")

print("\n" + "=" * 90 + "\n")
