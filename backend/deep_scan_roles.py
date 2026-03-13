#!/usr/bin/env python
"""Deep scan: Identify dual-role testimonial points issues"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db.models import Q

print("=" * 100)
print("DEEP SCAN: DUAL-ROLE TESTIMONIAL POINTS SYSTEM")
print("=" * 100)

# ============================================================================
# PART 1: UNDERSTAND SYSTEM ARCHITECTURE
# ============================================================================

print("\n\n1. SYSTEM ARCHITECTURE:")
print("-" * 100)
print("\n✓ User Role System:")
print("  - Users have: is_student, is_instructor, is_admin booleans")
print("  - Users currently_role field to track active role in session")
print("  - Separate ranking systems: StudentPoints vs InstructorPoints")

print("\n✓ Review.role field:")
print("  - When user submits a testimonial, they specify ROLE they're testifying AS")
print("  - Review.role='student' → User acting as student → Points should go to StudentPoints")
print("  - Review.role='instructor' → User acting as instructor → Points should go to InstructorPoints")

print("\n✓ PointsAuditLog:")
print("  - points_type field: 'student' or 'instructor'")
print("  - activity_type field: 'rating_given' (for students giving reviews)")
print("                         'student_rating' (for instructors receiving ratings)")

print("\n✓ EXPECTED BEHAVIOR:")
print("  - Review with role='student':   uses StudentPoints.add_points()   → points_type='student'   → activity_type='rating_given'")
print("  - Review with role='instructor': uses InstructorPoints.add_points() → points_type='instructor' → activity_type='student_rating'")

# ============================================================================
# PART 2: SCAN ALL REVIEWS FOR MISMATCHES
# ============================================================================

print("\n\n2. SCAN ALL REVIEWS WITH POINTS:")
print("-" * 100)

reviews_with_audits = models.Review.objects.filter(_points_awarded=True).select_related('user')
print(f"\nTotal active reviews with _points_awarded=True: {reviews_with_audits.count()}")

issues_found = []

for review in reviews_with_audits:
    # Find matching audit entry
    audit = models.PointsAuditLog.objects.filter(review_id=review.id).first()
    
    if not audit:
        print(f"\n❌ Review {review.id}: NO AUDIT ENTRY")
        print(f"   Role: {review.role}")
        print(f"   User: {review.user.username if review.user else 'NO USER'}")
        issues_found.append(('missing_audit', review))
    else:
        # Check if points_type matches review.role
        expected_points_type = 'student' if review.role == 'student' else 'instructor'
        expected_activity_type = 'rating_given' if review.role == 'student' else 'student_rating'
        
        match = audit.points_type == expected_points_type and audit.activity_type == expected_activity_type
        status = "✓" if match else "❌"
        
        print(f"\n{status} Review {review.id}: {review.role.upper()}")
        print(f"   User: {review.user.username if review.user else 'NO USER'}")
        print(f"   Course: {review.course.title if review.course else '[PLATFORM TESTIMONIAL]'}")
        print(f"   Audit Points Type: {audit.points_type} (expected: {expected_points_type})")
        print(f"   Audit Activity Type: {audit.activity_type} (expected: {expected_activity_type})")
        
        if not match:
            issues_found.append(('wrong_type', review, audit))
            print(f"   ❌ MISMATCH! Role='{review.role}' but audit says {audit.points_type}/{audit.activity_type}")

# ============================================================================
# PART 3: ANALYZE SPECIFIC ISSUE
# ============================================================================

print("\n\n3. SPECIFIC ISSUE ANALYSIS (khairilazmiashari):")
print("-" * 100)

try:
    user = models.User.objects.get(username='khairilazmiashari')
    reviews = models.Review.objects.filter(user=user, _points_awarded=True).order_by('id')
    
    for review in reviews:
        print(f"\nReview {review.id}:")
        print(f"  Role: {review.role}")
        
        audit = models.PointsAuditLog.objects.filter(review_id=review.id).first()
        if audit:
            print(f"  ✓ Audit Entry {audit.id}:")
            print(f"    - Activity Type: {audit.activity_type}")
            print(f"    - Points Type: {audit.points_type}")
            print(f"    - Points Awarded: {audit.points_awarded}")
            
            expected_pt = 'student' if review.role == 'student' else 'instructor'
            if audit.points_type != expected_pt:
                print(f"    🚨 WRONG! Should be '{expected_pt}' not '{audit.points_type}'")
        else:
            print(f"  ❌ NO AUDIT ENTRY")
        
        # Check StudentPoints
        sp = models.StudentPoints.objects.filter(user=user).first()
        if sp:
            print(f"  StudentPoints: {sp.lifetime_points} pts")
        
        # Check InstructorPoints
        ip = models.InstructorPoints.objects.filter(user=user).first()
        if ip:
            print(f"  InstructorPoints: {ip.lifetime_points} pts")

except models.User.DoesNotExist:
    print("❌ User 'khairilazmiashari' not found")

# ============================================================================
# PART 4: CHECK USERS WITH BOTH ROLES
# ============================================================================

print("\n\n4. USERS WITH BOTH STUDENT AND INSTRUCTOR ROLES:")
print("-" * 100)

dual_role_users = models.User.objects.filter(is_student=True, is_instructor=True)
print(f"Total users with both roles: {dual_role_users.count()}\n")

for user in dual_role_users[:10]:  # Show first 10
    sp = models.StudentPoints.objects.filter(user=user).first()
    ip = models.InstructorPoints.objects.filter(user=user).first()
    
    reviews_student = models.Review.objects.filter(user=user, role='student', _points_awarded=True).count()
    reviews_instructor = models.Review.objects.filter(user=user, role='instructor', _points_awarded=True).count()
    
    print(f"\n{user.username}:")
    print(f"  Student Reviews: {reviews_student}")
    print(f"  Instructor Reviews: {reviews_instructor}")
    print(f"  StudentPoints: {sp.lifetime_points if sp else 0} pts")
    print(f"  InstructorPoints: {ip.lifetime_points if ip else 0} pts")

# ============================================================================
# PART 5: SUMMARY
# ============================================================================

print("\n\n5. SUMMARY OF ISSUES FOUND:")
print("-" * 100)

if not issues_found:
    print("✓ NO ISSUES FOUND - All reviews have correct points types!")
else:
    print(f"\n❌ {len(issues_found)} ISSUES FOUND:\n")
    
    missing = [i for i in issues_found if i[0] == 'missing_audit']
    wrong = [i for i in issues_found if i[0] == 'wrong_type']
    
    if missing:
        print(f"  1. Missing Audit Entries ({len(missing)}):")
        for issue in missing:
            review = issue[1]
            print(f"     - Review {review.id} ({review.role})")
    
    if wrong:
        print(f"  2. Wrong Points Type ({len(wrong)}):")
        for issue in wrong:
            review, audit = issue[1], issue[2]
            print(f"     - Review {review.id} ({review.role}): audit says {audit.points_type}/{audit.activity_type}")

print("\n\n" + "=" * 100 + "\n")
