#!/usr/bin/env python
"""Find where Review actions happen and where points should be awarded"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models

print("=" * 90)
print("REVIEW AUDIT: WHERE SHOULD POINTS BE AWARDED?")
print("=" * 90)

# Check all reviews and their point status
print("\nAll Reviews:")
print("-" * 90)

reviews = models.Review.objects.all().select_related('user', 'course')

for review in reviews:
    # Check for matching audit log entry
    audit = models.PointsAuditLog.objects.filter(
        review_id=review.id
    ).first()
    
    role_str = f"[{review.role}]" if review.role else ""
    course_str = f"- Course: {review.course.title}" if review.course else "- Platform Testimonial"
    
    print(f"\nReview ID {review.id}: {review.user.username if review.user else 'NO USER'} {role_str}")
    print(f"  {course_str}")
    print(f"  Rating: {review.rating}*, Active: {review.active}, _points_awarded: {review._points_awarded}")
    print(f"  Date: {review.date}")
    
    if audit:
        print(f"  ✓ AuditLog: {audit.activity_type} ({audit.points_awarded} pts) [{audit.points_type}]")
    else:
        print(f"  ✗ No AuditLog entry")

# Summary
print("\n" + "=" * 90)
print("SUMMARY")
print("=" * 90)

total_reviews = models.Review.objects.count()
active_reviews = models.Review.objects.filter(active=True).count()
reviews_with_audit = models.PointsAuditLog.objects.filter(
    review_id__isnull=False
).values_list('review_id', flat=True).distinct().count()

print(f"Total Reviews: {total_reviews}")
print(f"Active Reviews: {active_reviews}")
print(f"Reviews with AuditLog entries: {reviews_with_audit}")
print(f"Reviews missing AuditLog: {active_reviews - reviews_with_audit}")

# Check if there's a signal or something that should be awarding points
print("\n" + "=" * 90)
print("MODEL SIGNAL HANDLERS")
print("=" * 90)

# List all signal handlers from models.py
try:
    from django.db.models import signals
    from django.dispatch import receiver
    
    # This is hard to check dynamically, so let's just note what we know
    print("Checking models.py for Review-related signals...")
    
    # Read the file and search for signal handlers
    with open('/backend/api/models.py', 'r') as f:
        content = f.read()
        if '@receiver' in content or 'post_save.connect' in content:
            print("✓ Found signal handlers in models.py")
            
            # Check if any are for Review
            if 'Review' in content and ('post_save' in content or '@receiver' in content):
                print("✓ May have Review-related signal handlers")
            else:
                print("✗ No Review-specific signal handlers found")
        else:
            print("No signal handlers found in models.py")
except:
    print("Could not read models.py for signal analysis")

print("\n" + "=" * 90 + "\n")
