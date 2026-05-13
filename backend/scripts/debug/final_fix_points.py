#!/usr/bin/env python
"""Final fix - align StudentPoints with PointsAuditLog"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db.models import Sum

print("=" * 70)
print("FINAL FIX - ALIGN STUDENTPOINTS WITH AUDITLOG")
print("=" * 70)

# Step 1: Remove duplicate audit log entries (keep newer ones)
print("\n1. REMOVING DUPLICATE AUDIT LOG ENTRIES:")
print("-" * 70)

total_deleted = 0

# For each user, activity_type, and related object combination
from django.db.models import Window, F
from django.db.models.functions import RowNumber

# Group by user, activity_type, and related objects
# Keep only the latest entry for each combo
from datetime import datetime

duplicates_found = models.PointsAuditLog.objects.filter(
    points_type='student'
).values('user_id', 'activity_type', 'course_id', 'quiz_id', 'review_id').annotate(
    count=__import__('django.db.models', fromlist=['Count']).Count('id')
).filter(count__gt=1)

print(f"Found {duplicates_found.count()} duplicate activity combinations")

for combo in duplicates_found:
    # Find all entries with this combo
    entries = models.PointsAuditLog.objects.filter(
        user_id=combo['user_id'],
        activity_type=combo['activity_type'],
        course_id=combo['course_id'],
        quiz_id=combo['quiz_id'],
        review_id=combo['review_id'],
        points_type='student'
    ).order_by('-awarded_at')
    
    if entries.count() > 1:
        # Keep the newest, delete the rest
        newest = entries.first()
        for entry in entries[1:]:
            entry.delete()
            total_deleted += 1

print(f"✅ Deleted {total_deleted} old duplicate entries")

# Step 2: Recalculate StudentPoints from scratch based on cleaned AuditLog
print("\n2. RECALCULATING STUDENTPOINTS:")
print("-" * 70)

models.StudentPoints.objects.all().delete()
print("Deleted old StudentPoints")

# Regenerate from AuditLog
for user in models.User.objects.filter(student_points__isnull=True):
    audit_total = models.PointsAuditLog.objects.filter(
        user=user, points_type='student'
    ).aggregate(
        total=Sum('points_awarded')
    )['total'] or 0
    
    if audit_total > 0:
        # Create StudentPoints record
        sp = models.StudentPoints.objects.create(
            user=user,
            lifetime_points=audit_total
        )
        sp.yearly_points = audit_total
        sp.yearly_year = 2026
        sp.monthly_points = audit_total
        sp.monthly_year = 2026
        sp.monthly_month = 3
        sp.save()

print(f"✅ Created/updated StudentPoints records")

# Step 3: Verify
print("\n3. VERIFICATION:")
print("-" * 70)

mismatches = 0
for sp in models.StudentPoints.objects.all():
    audit_total = models.PointsAuditLog.objects.filter(
        user=sp.user, points_type='student'
    ).aggregate(
        total=Sum('points_awarded')
    )['total'] or 0
    
    if sp.lifetime_points == audit_total:
        print(f"✅ {sp.user.username}: {sp.lifetime_points} points (matches)")
    else:
        print(f"❌ {sp.user.username}: {sp.lifetime_points} != {audit_total}")
        mismatches += 1

overall_student = models.StudentPoints.objects.aggregate(
    total=Sum('lifetime_points')
)['total'] or 0

overall_audit = models.PointsAuditLog.objects.filter(
    points_type='student'
).aggregate(
    total=Sum('points_awarded')
)['total'] or 0

print(f"\nOverall StudentPoints Total: {overall_student}")
print(f"Overall AuditLog Total: {overall_audit}")

if overall_student == overall_audit:
    print("✅ ALL SYSTEMS ALIGNED!")
else:
    print(f"⚠️  Still misaligned by {abs(overall_student - overall_audit)} points")

print("\n" + "=" * 70 + "\n")
