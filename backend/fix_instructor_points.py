#!/usr/bin/env python
"""Fix: Correct the instructor testimonial points to use InstructorPoints instead of StudentPoints"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db import transaction
from django.db.models import Sum

print("=" * 100)
print("FIX: CORRECT INSTRUCTOR TESTIMONIAL POINTS TYPE")
print("=" * 100)

# Get the problematic review and user
review = models.Review.objects.get(id=7)
user = review.user

print(f"\n🔍 IDENTIFIED ISSUE:")
print(f"   Review 7 (instructor testimonial)")
print(f"   User: {user.username}")
print(f"   Role: {review.role}")
print(f"   Status: Points awarded to WRONG system (StudentPoints instead of InstructorPoints)")

# Get current audit entry
audit_wrong = models.PointsAuditLog.objects.get(id=64)

print(f"\n❌ WRONG ENTRY (to delete):")
print(f"   ID: {audit_wrong.id}")
print(f"   Points Type: {audit_wrong.points_type} (WRONG - should be 'instructor')")
print(f"   Activity Type: {audit_wrong.activity_type} (WRONG - should be 'student_rating')")
print(f"   Points: {audit_wrong.points_awarded}")

print(f"\n✓ CURRENT STUDENT POINTS: {user.student_points.lifetime_points if hasattr(user, 'student_points') else 'N/A'}")
print(f"✓ CURRENT INSTRUCTOR POINTS: {user.instructor_points.lifetime_points if hasattr(user, 'instructor_points') else 'N/A'}")

# Perform the fix in a transaction
with transaction.atomic():
    print(f"\n🔧 FIXING...")
    
    # Step 1: Delete the wrong audit entry
    audit_wrong.delete()
    print(f"   ✓ Deleted wrong PointsAuditLog entry (ID 64)")
    
    # Step 2: Subtract points from StudentPoints
    sp = models.StudentPoints.objects.get(user=user)
    sp_before = sp.lifetime_points
    sp.lifetime_points -= 50
    sp.yearly_points -= 50
    sp.monthly_points -= 50
    sp.save()
    print(f"   ✓ Updated StudentPoints: {sp_before} → {sp.lifetime_points}")
    
    # Step 3: Award points to InstructorPoints with CORRECT activity type
    ip = models.InstructorPoints.add_points(
        user,
        50,
        'student_rating',  # CORRECT: instructor receives a rating
        review_id=7,
        course_id=None,  # Platform testimonial
        description="Platform testimonial as instructor"
    )
    print(f"   ✓ Added 50 points to InstructorPoints (with correct activity type)")
    
    # Verify the new audit entry
    audit_correct = models.PointsAuditLog.objects.filter(review_id=7).first()
    print(f"\n✓ NEW ENTRY (created automatically):")
    print(f"   ID: {audit_correct.id}")
    print(f"   Points Type: {audit_correct.points_type} (correct!)")
    print(f"   Activity Type: {audit_correct.activity_type} (correct!)")

# Verify final state
sp_final = models.StudentPoints.objects.get(user=user)
ip_final = models.InstructorPoints.objects.get(user=user)

print(f"\n📊 FINAL STATE:")
print(f"   StudentPoints: {sp_final.lifetime_points} (was 250, now correct)")
print(f"   InstructorPoints: {ip_final.lifetime_points} (was 0, now 50 from instructor testimonial)")

# List all review points for user
print(f"\n📋 ALL AUDIT ENTRIES FOR khairilazmiashari:")
audits = models.PointsAuditLog.objects.filter(user=user).order_by('id')
for audit in audits:
    review_id = f"Review {audit.review_id}" if audit.review_id else "—"
    print(f"   {audit.id}: {audit.activity_type} ({audit.points_type}) → +{audit.points_awarded} pts")

# Final verification
student_total = models.StudentPoints.objects.filter(user=user).first()
instructor_total = models.InstructorPoints.objects.filter(user=user).first()

audit_student_sum = models.PointsAuditLog.objects.filter(
    user=user, points_type='student'
).aggregate(total=Sum('points_awarded'))['total'] or 0

audit_instructor_sum = models.PointsAuditLog.objects.filter(
    user=user, points_type='instructor'
).aggregate(total=Sum('points_awarded'))['total'] or 0

print(f"\n✅ CONSISTENCY CHECK:")
print(f"   StudentPoints total: {student_total.lifetime_points} = AuditLog sum: {audit_student_sum} ? {student_total.lifetime_points == audit_student_sum}")
print(f"   InstructorPoints total: {instructor_total.lifetime_points} = AuditLog sum: {audit_instructor_sum} ? {instructor_total.lifetime_points == audit_instructor_sum}")

if student_total.lifetime_points == audit_student_sum and instructor_total.lifetime_points == audit_instructor_sum:
    print(f"\n✨ FIX SUCCESSFUL! All point systems are now consistent and using correct types.")
else:
    print(f"\n❌ WARNING: Point systems are not balanced!")

print("\n" + "=" * 100 + "\n")
