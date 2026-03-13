#!/usr/bin/env python
"""Investigate points mismatch - corrected"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db.models import Sum, Count

print("=" * 70)
print("POINTS MISMATCH INVESTIGATION")
print("=" * 70)

# Get breakdown by StudentPoints
print("\nSTUDENT POINTS BREAKDOWN:")
print("-" * 70)

student_breakdown = models.StudentPoints.objects.values('user__username').annotate(
    total=Sum('lifetime_points')
).order_by('-total')

for stat in student_breakdown:
    print(f"{stat['user__username']}: {stat['total']} points")

total_student_points = sum(s['total'] for s in student_breakdown)
print(f"\nTotal from StudentPoints: {total_student_points}")

# Get ONLY STUDENT audit entries
print("\n\nSTUDENT AUDIT LOG (points_type='student'):")
print("-" * 70)

student_audit = models.PointsAuditLog.objects.filter(
    points_type='student'
).values('user__username', 'activity_type').annotate(
    total=Sum('points_awarded'),
    count=Count('id')
).order_by('user__username', 'activity_type')

current_user = None
user_total = 0
for entry in student_audit:
    if current_user != entry['user__username']:
        if current_user:
            print(f"  TOTAL: {user_total}\n")
        current_user = entry['user__username']
        user_total = 0
        print(f"{current_user}:")
    
    print(f"  {entry['activity_type']}: {entry['total']} pts ({entry['count']} entries)")
    user_total += entry['total']

if current_user:
    print(f"  TOTAL: {user_total}")

# Just student points in audit log
student_audit_total = models.PointsAuditLog.objects.filter(
    points_type='student'
).aggregate(
    total=Sum('points_awarded')
)['total'] or 0
print(f"\nTotal STUDENT audit: {student_audit_total}")

# Check for other points types
print("\n\nNON-STUDENT AUDIT LOG ENTRIES:")
print("-" * 70)

other_audit = models.PointsAuditLog.objects.exclude(
    points_type='student'
).values('points_type').annotate(
    count=Count('id'),
    total=Sum('points_awarded')
).order_by('points_type')

for entry in other_audit:
    print(f"{entry['points_type']}: {entry['count']} entries, {entry['total']} total points")

other_total = models.PointsAuditLog.objects.exclude(
    points_type='student'
).aggregate(
    total=Sum('points_awarded')
)['total'] or 0
print(f"\nTotal OTHER points: {other_total}")

# Debug single student to check consistency
print("\n\nDETAIL CHECK - robertparker13183:")
print("-" * 70)

user = models.User.objects.filter(username='robertparker13183').first()
if user:
    sp_total = models.StudentPoints.objects.filter(user=user).aggregate(
        total=Sum('lifetime_points')
    )['total'] or 0
    print(f"StudentPoints total: {sp_total}")
    
    audit_total = models.PointsAuditLog.objects.filter(
        user=user, points_type='student'
    ).aggregate(
        total=Sum('points_awarded')
    )['total'] or 0
    print(f"AuditLog total: {audit_total}")
    
    # Count records in each
    sp_count = models.StudentPoints.objects.filter(user=user).count()
    audit_count = models.PointsAuditLog.objects.filter(user=user, points_type='student').count()
    
    print(f"\nStudentPoints records: {sp_count}")
    print(f"AuditLog records: {audit_count}")
    
    if sp_total != audit_total:
        print(f"\n⚠️  MISMATCH: {sp_total} vs {audit_total}")
        print("\nAuditLog details:")
        for al in models.PointsAuditLog.objects.filter(user=user, points_type='student').order_by('created_at'):
            print(f"  {al.activity_type}: {al.points_awarded} on {al.created_at}")

print("\n" + "=" * 70 + "\n")
