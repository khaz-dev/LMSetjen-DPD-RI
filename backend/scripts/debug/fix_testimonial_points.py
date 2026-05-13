#!/usr/bin/env python
"""Fix testimonial points issue - award points for platform testimonials"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db.models import Sum, Count

print("=" * 90)
print("TESTIMONIAL POINTS FIX")
print("=" * 90)

print("\nPhase 1: IDENTIFY MISSING TESTIMONIAL POINTS")
print("-" * 90)

# Find platform testimonials (course__isnull=True) that are active but have no points
missing_testimonials = models.Review.objects.filter(
    course__isnull=True,
    active=True
).exclude(
    id__in=models.PointsAuditLog.objects.filter(
        review_id__isnull=False
    ).values_list('review_id', flat=True)
)

print(f"Found {missing_testimonials.count()} active testimonials with no AuditLog entry:")

for review in missing_testimonials:
    print(f"\n  Review ID {review.id}:")
    print(f"    User: {review.user.username if review.user else 'NO USER'}")
    print(f"    Role: {review.role}")
    print(f"    Rating: {review.rating}*")
    print(f"    Date: {review.date}")
    print(f"    Active: {review.active}")


print("\n\nPhase 2: AWARD POINTS FOR TESTIMONIALS")
print("-" * 90)

testimonials_fixed = 0
users_affected = set()

for review in missing_testimonials:
    if not review.user:
        print(f"⚠️  Review ID {review.id} has no user, skipping")
        continue
    
    # Check if this user already has points from any testimonial
    # by checking if they have ANY rating_given audit log entry
    existing_testimonial_points = models.PointsAuditLog.objects.filter(
        user=review.user,
        activity_type='rating_given'
    ).exclude(
        review_id__isnull=True  # Exclude course reviews, we only want testimonials
    ).exists()
    
    if existing_testimonial_points:
        print(f"\n⚠️  Review ID {review.id} ({review.user.username} as {review.role}):")
        print(f"    User already has testimonial points, skipping")
        print(f"    (Only one testimony per user should earn points)")
    else:
        # Award points for this testimonial
        try:
            models.StudentPoints.add_points(
                review.user,
                50,
                'rating_given',
                review_id=review.id,
                description=f"Platform testimonial as {review.role}: {review.rating}* rating"
            )
            
            # Mark as awarded
            review._points_awarded = True
            review.save(update_fields=['_points_awarded'])
            
            print(f"\n✅ Review ID {review.id} ({review.user.username} as {review.role}):")
            print(f"    Awarded 50 points")
            
            testimonials_fixed += 1
            users_affected.add(review.user.username)
            
        except Exception as e:
            print(f"\n❌ Review ID {review.id} ({review.user.username}):")
            print(f"    Error: {str(e)}")


print("\n\nPhase 3: VERIFY POINTS")
print("-" * 90)

# Verify StudentPoints now match AuditLog
for username in users_affected:
    user = models.User.objects.get(username=username)
    
    sp_total = models.StudentPoints.objects.filter(user=user).aggregate(
        total=Sum('lifetime_points')
    )['total'] or 0
    
    audit_total = models.PointsAuditLog.objects.filter(
        user=user,
        points_type='student'
    ).aggregate(
        total=Sum('points_awarded')
    )['total'] or 0
    
    match = "✅" if sp_total == audit_total else "❌"
    print(f"{match} {username}: StudentPoints={sp_total}, AuditLog={audit_total}")


print("\n\nPhase 4: SUMMARY")
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

print(f"\nTestimonials fixed: {testimonials_fixed}")
print(f"Users affected: {len(users_affected)}")

if testimonials_fixed > 0:
    print("\n✨ Testimonial points have been awarded!")
else:
    print("\n✓ No testimonials needed fixing")

print("\n" + "=" * 90 + "\n")
