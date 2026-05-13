#!/usr/bin/env python
"""Diagnostic script to check PointsAuditLog course_id values"""

import os
import django
from django.db.models import Q

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models

print("=" * 70)
print("POINTS AUDIT LOG - COURSE_ID DIAGNOSTIC")
print("=" * 70)

# Check total audit log records
total_records = models.PointsAuditLog.objects.count()
print(f"\nTotal PointsAuditLog records: {total_records}")

# Breakdown by activity type
print("\n1. BREAKDOWN BY ACTIVITY TYPE:")
print("-" * 70)
for activity_type, activity_label in models.PointsAuditLog.ACTIVITY_TYPE_CHOICES:
    count = models.PointsAuditLog.objects.filter(activity_type=activity_type).count()
    records = models.PointsAuditLog.objects.filter(activity_type=activity_type)
    
    # Check how many have course_id
    with_course = records.filter(course_id__isnull=False).exclude(course_id=0).count()
    without_course = records.exclude(course_id__isnull=False) | records.filter(course_id=0)
    without_course = without_course.count()
    
    print(f"\n{activity_label} ({activity_type}):")
    print(f"  Total: {count}")
    print(f"  With course_id: {with_course}")
    print(f"  Without course_id: {without_course}")

# Check course_id values
print("\n2. COURSE_ID VALUES ANALYSIS:")
print("-" * 70)
audit_logs = models.PointsAuditLog.objects.all()

course_ids_found = set()
course_ids_invalid = set()

for log in audit_logs:
    if log.course_id:
        course_ids_found.add(log.course_id)
        # Try to find the course
        try:
            course = models.Course.objects.get(id=log.course_id)
        except models.Course.DoesNotExist:
            course_ids_invalid.add(log.course_id)
        except Exception as e:
            print(f"Error looking up course {log.course_id}: {e}")

print(f"Unique course_ids in audit log: {len(course_ids_found)}")
print(f"Valid (existing) course_ids: {len(course_ids_found) - len(course_ids_invalid)}")
print(f"Invalid (deleted?) course_ids: {len(course_ids_invalid)}")

if course_ids_invalid:
    print(f"\nInvalid course_ids: {list(course_ids_invalid)[:10]}")

# Check if courses exist
print("\n3. COURSE EXISTENCE CHECK:")
print("-" * 70)
total_courses = models.Course.objects.count()
print(f"Total courses in database: {total_courses}")

# Sample some audit logs
print("\n4. SAMPLE AUDIT LOG ENTRIES:")
print("-" * 70)
samples = models.PointsAuditLog.objects.all()[:5]
for log in samples:
    print(f"\nUser: {log.user.full_name}")
    print(f"  Points: {log.points_awarded}")
    print(f"  Activity: {log.activity_type}")
    print(f"  Course ID: {log.course_id}")
    if log.course_id:
        try:
            course = models.Course.objects.get(id=log.course_id)
            print(f"  Course Title: {course.title}")
        except:
            print(f"  ❌ Course NOT FOUND")
    else:
        print(f"  Course ID: <EMPTY>")
    print(f"  Description: {log.description}")

# Test admin method simulation
print("\n5. ADMIN METHOD TEST:")
print("-" * 70)

def test_get_course(obj):
    """Simulate the admin get_course method"""
    if obj.course_id:
        try:
            course = models.Course.objects.get(id=obj.course_id)
            return course.title[:30] + ("..." if len(course.title) > 30 else "")
        except Exception as e:
            return f"Course #{obj.course_id} (Error: {str(e)[:20]})"
    return "-"

# Test on some audit logs
logs_with_course_id = models.PointsAuditLog.objects.exclude(course_id__isnull=True).exclude(course_id=0)[:5]
print(f"\nTesting get_course method on {logs_with_course_id.count()} logs with course_id:")
for log in logs_with_course_id:
    result = test_get_course(log)
    print(f"  Log {log.id}: course_id={log.course_id} -> result='{result}'")

# Check for issues
print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)

issues = []
if len(course_ids_invalid) > 0:
    issues.append(f"❌ {len(course_ids_invalid)} audit log entries reference deleted courses")
if total_courses == 0:
    issues.append("❌ No courses exist in database")

logs_without_course = models.PointsAuditLog.objects.filter(
    Q(course_id__isnull=True) | Q(course_id=0)
).count()
if logs_without_course > 0:
    issues.append(f"⚠️  {logs_without_course} audit log entries have no course_id")

if issues:
    print("\nIssues Found:")
    for issue in issues:
        print(f"  {issue}")
else:
    print("\n✅ All audit logs have valid course references!")

print("\n" + "=" * 70)
