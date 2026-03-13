#!/usr/bin/env python
"""Check what the API returns for the specific enrollment ID"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models as api_models
from api import serializer as api_serializer
from userauths.models import User

print("\n" + "="*80)
print("API Response Check for enrollment 124632")
print("="*80)

try:
    user = User.objects.get(id=3)
    enrollment = api_models.EnrolledCourse.objects.get(enrollment_id=124632)
    
    print(f"\n✅ User: {user.username}")
    print(f"✅ Enrollment: {enrollment.enrollment_id}")
    print(f"✅ Course: {enrollment.course.title}")
    
    # Serialize using the same serializer as the API
    print(f"\n📋 Calling EnrolledCourseSerializer.get_completed_lesson()...")
    serializer = api_serializer.EnrolledCourseSerializer(
        enrollment,
        context={'request': None, 'current_user': user}
    )
    
    data = serializer.data
    
    print(f"\n📊 Completed lessons in response: {len(data.get('completed_lesson', []))}")
    for cl in data.get('completed_lesson', []):
        print(f"   - {cl.get('variant_item', {}).get('title')} (ID={cl.get('variant_item', {}).get('variant_item_id')})")
    
    # Now check the curriculum for the specific lesson
    print(f"\n📚 Checking curriculum...")
    found_in_curriculum = False
    total_items = 0
    
    for variant in data.get('curriculum', []):
        items = variant.get('variant_items', []) or variant.get('items', [])
        for item in items:
            total_items += 1
            if item.get('variant_item_id') == 254517:
                found_in_curriculum = True
                print(f"\n   🎯 FOUND TARGET LESSON in curriculum!")
                print(f"      Title: {item.get('title')}")
                print(f"      is_completed: {item.get('is_completed')}")  
                print(f"      is_fully_watched: {item.get('is_fully_watched')}")
    
    print(f"\n   Total items in curriculum: {total_items}")
    if not found_in_curriculum:
        print(f"   ❌ Target lesson NOT found in curriculum")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
