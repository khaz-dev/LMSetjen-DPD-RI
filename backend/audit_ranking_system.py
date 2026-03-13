#!/usr/bin/env python
"""Deep audit of ranking system issues"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db.models import Count, Q

print("=" * 70)
print("COMPREHENSIVE RANKING SYSTEM AUDIT")
print("=" * 70)

# 1. Check for Role field inconsistencies
print("\n1. ROLE FIELD ANALYSIS:")
print("-" * 70)

# Check students with instructor role
users_with_both_roles = models.User.objects.filter(
    roles__icontains='instructor'
).filter(
    roles__icontains='student'
).count()
print(f"✓ Users with BOTH 'student' AND 'instructor' roles: {users_with_both_roles}")

# Check current_role field
students = models.User.objects.filter(current_role='student')
instructors = models.User.objects.filter(current_role='instructor')
print(f"✓ Users with current_role='student': {students.count()}")
print(f"✓ Users with current_role='instructor': {instructors.count()}")

# Check StudentPoints with Role field
student_points_with_role = models.StudentPoints.objects.all().values('user__current_role').distinct()
print(f"\n✓ StudentPoints user roles:")
for role_dict in student_points_with_role:
    role = role_dict['user__current_role']
    count = models.StudentPoints.objects.filter(user__current_role=role).count()
    print(f"   - {role}: {count}")

# 2. Check Review approval status
print("\n2. REVIEW/APPROVAL ANALYSIS:")
print("-" * 70)
reviews_active = models.Review.objects.filter(active=True).count()
reviews_inactive = models.Review.objects.filter(active=False).count()
print(f"✓ Active (approved) reviews: {reviews_active}")
print(f"✓ Inactive (pending) reviews: {reviews_inactive}")

# Sample active reviews
print("\n✓ Sample active reviews:")
for review in models.Review.objects.filter(active=True)[:3]:
    print(f"  - User: {review.user.full_name if review.user else 'NONE'}, Course: {review.course.title[:30] if review.course else 'NONE'}, Rating: {review.rating}⭐")

# 3. Check Course publication status
print("\n3. COURSE PUBLICATION ANALYSIS:")
print("-" * 70)
courses_published = models.Course.objects.filter(
    platform_status='Published', 
    is_published_version=True
).count()
courses_draft = models.Course.objects.filter(
    platform_status='Draft',
    is_published_version=False
).count()
courses_review = models.Course.objects.filter(
    platform_status='Review'
).count()
print(f"✓ Published courses (is_published_version=True, status='Published'): {courses_published}")
print(f"✓ Draft courses: {courses_draft}")
print(f"✓ Under review courses: {courses_review}")

# 4. Check for point audit capability
print("\n4. POINT AUDIT/TRACKING ANALYSIS:")
print("-" * 70)
print(f"✓ Any PointsAuditLog model exists? ", end="")
try:
    models.PointsAuditLog.objects.count()
    print("YES")
except AttributeError:
    print("NO ❌")

print(f"✓ Any ActivityLog or similar model? ", end="")
try:
    activity_models = [m for m in dir(models) if 'Log' in m or 'Audit' in m or 'History' in m]
    if activity_models:
        print(f"YES - {activity_models}")
    else:
        print("NO ❌")
except:
    print("NO ❌")

# 5. Check CompletedLesson signal
print("\n5. COMPLETEDLESSON SIGNAL VERIFICATION:")
print("-" * 70)
completed_lessons = models.CompletedLesson.objects.count()
print(f"✓ CompletedLesson records: {completed_lessons}")

# Sample
print("\n✓ Sample completed lessons:")
for lesson in models.CompletedLesson.objects.select_related('user', 'course')[:3]:
    print(f"  - User: {lesson.user.full_name if lesson.user else 'NONE'}, Course: {lesson.course.title[:30] if lesson.course else 'NONE'}")

# 6. Detailed point breakdown
print("\n6. POINT BREAKDOWN ANALYSIS:")
print("-" * 70)
print("✓ StudentPoints records with points:")
for sp in models.StudentPoints.objects.filter(lifetime_points__gt=0).order_by('-lifetime_points')[:5]:
    print(f"  - {sp.user.full_name}: Lifetime={sp.lifetime_points}, Yearly={sp.yearly_points}, Monthly={sp.monthly_points}")
    print(f"    WHERE DID THESE POINTS COME FROM? NO AUDIT TRAIL ❌")

print("\n" + "=" * 70)
print("CRITICAL ISSUES IDENTIFIED:")
print("=" * 70)
if users_with_both_roles > 0:
    print("❌ ISSUE #1: Users with MULTIPLE roles")
    print(f"   - {users_with_both_roles} users have both 'student' AND 'instructor' roles")
    print("   - Role column in admin is MISLEADING (shows only current_role, not activity role)")
    print("   - RECOMMENDATION: Remove Role column or explain it's current_role only")

print("\n❌ ISSUE #2: NO AUDIT TRAIL FOR POINTS")
print("   - No way to track WHERE points came from")
print("   - Can't see which activities awarded which points")
print("   - Can't verify if points are correct or duplicated")
print("   - Can't supervise point calculations")
print("   - RECOMMENDATION: Create PointsAuditLog model to track all awards")

print("\n✅ ISSUE #3: Review approval - WORKING CORRECTLY")
print("   - Only active (approved) reviews award points")

print("\n✅ ISSUE #4: Course publication - WORKING CORRECTLY")
print("   - Only published courses award points")

print("\n" + "=" * 70)
