#!/usr/bin/env python
"""Check what the API actually returns for course detail"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models as api_models
from api import serializer as api_serializer
from userauths.models import User

print("\n" + "="*80)
print("API Response Check - student/course-detail/")
print("="*80)

try:
    user = User.objects.get(id=3)
    print(f"\n✅ Found user: {user.username} (ID={user.id})")
    
    # Find an enrollment for this user
    enrollment = api_models.EnrolledCourse.objects.filter(user=user).first()
    if not enrollment:
        print(f"❌ No enrollment found for user")
    else:
        print(f"✅ Found enrollment: {enrollment.enrollment_id}")
        
        # Serialize using the same serializer as the API
        serializer = api_serializer.EnrolledCourseSerializer(
            enrollment,
            context={'request': None, 'current_user': user}
        )
        
        data = serializer.data
        
        print(f"\n📊 Response structure:")
        print(f"   - completed_lesson count: {len(data.get('completed_lesson', []))}")
        
        # Show completed lessons
        if data.get('completed_lesson'):
            print(f"\n   ✅ Completed lessons in API response:")
            for cl in data.get('completed_lesson', [])[:5]:  # Show first 5
                variant_item_id = cl.get('variant_item', {}).get('variant_item_id')
                title = cl.get('variant_item', {}).get('title')
                print(f"      - {title} (ID={variant_item_id})")
        
        # Check curriculum
        curriculum = data.get('curriculum', [])
        print(f"\n   📚 Curriculum sections: {len(curriculum)}")
        
        # Look for the specific lesson
        target_id = 254517
        target_found = False
        for variant in curriculum:
            variant_items = variant.get('variant_items', []) or variant.get('items', [])
            for item in variant_items:
                if item.get('variant_item_id') == target_id:
                    target_found = True
                    print(f"\n   🎯 Found target lesson in curriculum:")
                    print(f"      Title: {item.get('title')}")
                    print(f"      is_completed: {item.get('is_completed')}")
                    print(f"      is_fully_watched: {item.get('is_fully_watched')}")
                    
        if not target_found:
            print(f"\n   ❌ Target lesson {target_id} not found in curriculum")
        
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
