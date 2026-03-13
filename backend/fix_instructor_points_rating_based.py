#!/usr/bin/env python
"""
Recalculate instructor points from course reviews using RATING-BASED system.
Fix any reviews that were awarded incorrect points.

System:
- 1★ = 10 points
- 2★ = 20 points
- 3★ = 30 points
- 4★ = 40 points
- 5★ = 50 points (capped)
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db.models import Q, Sum

print("=" * 120)
print("RECALCULATE INSTRUCTOR POINTS - RATING-BASED SYSTEM")
print("=" * 120)

# Get all course reviews
course_reviews = models.Review.objects.filter(
    course__isnull=False,
    role='student',
    _points_awarded=True
).select_related('user', 'course', 'course__teacher')

print(f"\nTotal course reviews found: {course_reviews.count()}")

if course_reviews.count() == 0:
    print("No reviews to process")
    exit(0)

fixes_applied = 0
reviews_checked = 0

print("\n" + "-" * 120)
print("CHECKING EACH REVIEW")
print("-" * 120)

for review in course_reviews:
    reviews_checked += 1
    rating = review.rating
    expected_points = min(int(rating) * 10, 50)
    instructor = review.course.teacher.user if review.course.teacher else None
    
    if not instructor:
        print(f"\n❌ Review #{review.id}: No instructor assigned")
        continue
    
    # Find the actual audit entry for this review
    actual_audit = models.PointsAuditLog.objects.filter(
        review_id=review.id,
        activity_type='student_rating',
        user=instructor
    ).first()
    
    if not actual_audit:
        print(f"\n⚠️  Review #{review.id}: No audit entry found for instructor")
        print(f"   Rating: {rating}★ (Expected: {expected_points} points)")
        
        # Create missing audit entry
        print(f"   → Creating missing audit entry...")
        try:
            new_audit = models.PointsAuditLog.objects.create(
                user=instructor,
                review_id=review.id,
                activity_type='student_rating',
                points_type='instructor',
                points_awarded=expected_points,
                course_id=review.course.id,
                description=f"Received {rating}★ rating from {review.user.full_name if review.user else 'Learner'} on: {review.course.title}"
            )
            print(f"   ✅ Created audit entry #{new_audit.id} with {expected_points} points")
            
            # Update instructor points
            instructor_points = models.InstructorPoints.objects.get(user=instructor)
            instructor_points.lifetime_points += expected_points
            instructor_points.yearly_points += expected_points
            instructor_points.monthly_points += expected_points
            instructor_points.save()
            print(f"   ✅ Updated InstructorPoints: +{expected_points} points")
            
            fixes_applied += 1
        except Exception as e:
            print(f"   ❌ Error creating audit entry: {e}")
    else:
        actual_points = actual_audit.points_awarded
        
        if actual_points == expected_points:
            status = "✅"
            message = f"CORRECT - {actual_points} points"
        else:
            status = "❌"
            difference = expected_points - actual_points
            message = f"MISMATCH - Got {actual_points}, Expected {expected_points} (diff: {difference:+d})"
            
            print(f"\n{status} Review #{review.id} - {rating}★ rating")
            print(f"   Reviewer: {review.user.username}")
            print(f"   Instructor: {instructor.username}")
            print(f"   Course: {review.course.title[:50]}")
            print(f"   Points: {message}")
            
            if difference != 0:
                print(f"   → Fixing mismatch...")
                try:
                    # Update the audit entry
                    actual_audit.points_awarded = expected_points
                    actual_audit.save()
                    
                    # Adjust instructor points
                    instructor_points = models.InstructorPoints.objects.get(user=instructor)
                    instructor_points.lifetime_points += difference
                    instructor_points.yearly_points += difference
                    instructor_points.monthly_points += difference
                    instructor_points.save()
                    
                    print(f"   ✅ Updated audit entry #{actual_audit.id}: {actual_points} → {expected_points} points")
                    print(f"   ✅ Updated InstructorPoints: {difference:+d} points")
                    
                    fixes_applied += 1
                except Exception as e:
                    print(f"   ❌ Error fixing mismatch: {e}")
            else:
                print(f"\n{status} Review #{review.id} - {rating}★ rating")
                print(f"   Status: {message}")

print("\n" + "=" * 120)
print("SUMMARY")
print("=" * 120)

print(f"\nReviews checked: {reviews_checked}")
print(f"Fixes applied: {fixes_applied}")

# Final verification
print("\n" + "-" * 120)
print("FINAL VERIFICATION")
print("-" * 120)

print("\nCourse Reviews by Rating:")

for rating in sorted(set(r.rating for r in course_reviews), reverse=True):
    reviews_with_rating = course_reviews.filter(rating=rating)
    expected_per_review = min(int(rating) * 10, 50)
    
    total_actual = 0
    count = reviews_with_rating.count()
    
    for review in reviews_with_rating:
        audit = models.PointsAuditLog.objects.filter(
            review_id=review.id,
            activity_type='student_rating'
        ).first()
        
        if audit:
            total_actual += audit.points_awarded
    
    total_expected = expected_per_review * count
    status = "✅" if total_actual == total_expected else "❌"
    
    print(f"\n{status} {rating}★ Reviews: {count}")
    print(f"   Expected: {expected_per_review} pts each = {total_expected} total")
    print(f"   Actual: {total_actual} total")
    
    if total_actual != total_expected:
        difference = total_expected - total_actual
        if difference > 0:
            print(f"   ⚠️  Missing: {difference} points")
        else:
            print(f"   ⚠️  Excess: {-difference} points")

# Verify instructor totals match audit log
print("\n" + "-" * 120)
print("INSTRUCTOR TOTALS VERIFICATION")
print("-" * 120)

instructors = models.Teacher.objects.filter(
    course__review__role='student',
    course__review___points_awarded=True
).distinct()

for teacher in instructors:
    user = teacher.user
    
    # Get actual instructor points
    instructor_points_obj = models.InstructorPoints.objects.filter(user=user).first()
    actual_lifetime = instructor_points_obj.lifetime_points if instructor_points_obj else 0
    
    # Calculate expected from audit log (student_rating activity only from course reviews)
    expected_from_reviews = models.PointsAuditLog.objects.filter(
        user=user,
        activity_type='student_rating',
        review_id__isnull=False,  # Has review_id
        course_id__isnull=False   # Is from course (not platform testimonial)
    ).aggregate(total=Sum('points_awarded'))['total'] or 0
    
    # Also include other instructor point sources (testimonials, course publishing, etc)
    expected_total = models.PointsAuditLog.objects.filter(
        user=user,
        points_type='instructor'
    ).aggregate(total=Sum('points_awarded'))['total'] or 0
    
    status = "✅" if actual_lifetime == expected_total else "❌"
    
    print(f"\n{status} {user.username} (Instructor)")
    print(f"   InstructorPoints.lifetime: {actual_lifetime}")
    print(f"   PointsAuditLog (instructor) total: {expected_total}")
    
    if actual_lifetime != expected_total:
        print(f"   ⚠️  MISMATCH: {actual_lifetime - expected_total:+d} points")
    
    print(f"   From course reviews: {expected_from_reviews} points")

print("\n" + "=" * 120)
print("RATING-BASED POINTS SYSTEM ACTIVE ✅")
print("=" * 120)
print("""
From now on, instructor points are calculated as:
  1★ = 10 points
  2★ = 20 points
  3★ = 30 points
  4★ = 40 points
  5★ = 50 points

Previous reviews have been adjusted to match this new system.
""")
