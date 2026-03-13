#!/usr/bin/env python
"""Quick check: Do the platform testimonials have audit entries?"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models

# Focus on khairilazmiashari
user = models.User.objects.get(username='khairilazmiashari')

print("=" * 90)
print(f"FOCUS: khairilazmiashari")
print("=" * 90)

# Get all their reviews
all_reviews = models.Review.objects.filter(user=user)
print(f"\nTotal reviews: {all_reviews.count()}")

for review in all_reviews:
    course_str = review.course.title[:50] if review.course else "[PLATFORM TESTIMONIAL]"
    print(f"\nReview {review.id}: {course_str}")
    print(f"  Role: {review.role}, Rating: {review.rating}*, Active: {review.active}")
    print(f"  _points_awarded: {review._points_awarded}")
    
    # Check audit log
    audits = models.PointsAuditLog.objects.filter(review_id=review.id)
    if audits.exists():
        for audit in audits:
            print(f"  ✅ AuditLog {audit.id}: {audit.activity_type} ({audit.points_awarded} pts)")
    else:
        print(f"  ❌ NO AuditLog entry for this review")

# Check all rating_given entries for this user
print("\n\nAll 'rating_given' entries for khairilazmiashari:")
print("-" * 90)

rating_entries = models.PointsAuditLog.objects.filter(
    user=user,
    activity_type='rating_given'
)

print(f"Total 'rating_given' entries: {rating_entries.count()}")

for entry in rating_entries:
    print(f"\nAuditLog {entry.id}:")
    print(f"  Activity: {entry.activity_type}")
    print(f"  Points: {entry.points_awarded}")
    print(f"  Points Type: {entry.points_type}")
    print(f"  Review ID: {entry.review_id}")
    print(f"  Course ID: {entry.course_id}")
    print(f"  Description: {entry.description}")
    
    if entry.review_id:
        try:
            rev = models.Review.objects.get(id=entry.review_id)
            print(f"  Related Review {entry.review_id}: Course={rev.course.title if rev.course else '[Platform]'}, Role={rev.role}")
        except:
            print(f"  Related Review: NOT FOUND")

# Check StudentPoints
print("\n\nStudentPoints for khairilazmiashari:")
print("-" * 90)

sp = models.StudentPoints.objects.filter(user=user).first()
if sp:
    print(f"Lifetime: {sp.lifetime_points}")
    print(f"Yearly: {sp.yearly_points}")
    print(f"Monthly: {sp.monthly_points}")
else:
    print("NO StudentPoints object")

print("\n" + "=" * 90 + "\n")
