#!/usr/bin/env python
"""
Deep diagnostic script to analyze ActivityLog API response structure and identify issues
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.contrib.auth import get_user_model
from api.models import ActivityLog

User = get_user_model()

user = User.objects.filter(id=3).first()
if not user:
    print("User not found")
    sys.exit(1)

# Get recent activities
activities = ActivityLog.objects.filter(user=user).order_by('-activity_date')[:10]

print("\n" + "="*80)
print("ACTIVITYLOG RESPONSE STRUCTURE ANALYSIS")
print("="*80)

print(f"\nTotal activities for {user.full_name}: {ActivityLog.objects.filter(user=user).count()}")
print(f"\nRecent activities (first 10):")

for activity in activities:
    print(f"\n[ID: {activity.id}]")
    print(f"  Type: {activity.activity_type} ({activity.get_activity_type_display()})")
    print(f"  Title: {activity.title}")
    print(f"  Course: {activity.course.title if activity.course else 'None'}")
    print(f"  Lesson: {activity.lesson.title if activity.lesson else 'None'}")
    print(f"  Success: {activity.success}")
    print(f"  Points: {activity.points_awarded}")
    print(f"  Date: {activity.activity_date}")
    print(f"  Metadata: {activity.metadata}")

# Check what the API would return
from api.serializers import ActivityLogListSerializer

print(f"\n\n" + "="*80)
print("SERIALIZED API RESPONSE CHECK")
print("="*80)

if activities.exists():
    serializer = ActivityLogListSerializer(activities[:3], many=True)
    import json
    print("\nExample API response format:")
    print(json.dumps(serializer.data, indent=2, default=str))
