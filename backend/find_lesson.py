#!/usr/bin/env python
"""Find which course/enrollment contains the target lesson"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models as api_models

print("\n" + "="*80)
print("FIND TARGET LESSON")
print("="*80)

target_id = 254517
try:
    variant_item = api_models.VariantItem.objects.get(variant_item_id=target_id)
    print(f"\n✅ Found lesson: {variant_item.title}")
    print(f"   Variant Item ID: {variant_item.variant_item_id}")
    
    # Find the variant (section) it belongs to
    variant = variant_item.variant
    if variant:
        print(f"   Section: {variant.title}")
        
        # Find the course it belongs to
        course = variant.course
        if course:
            print(f"   Course: {course.title}")
            print(f"   Course ID: {course.course_id}")
            
            # Find all enrollments for user 3 in this course
            user_id = 3
            enrollments = api_models.EnrolledCourse.objects.filter(
                user_id=user_id,
                course=course
            )
            
            if enrollments.exists():
                print(f"\n   ✅ User 3 has {enrollments.count()} enrollment(s) in this course")
                for enrollment in enrollments:
                    print(f"      - Enrollment ID: {enrollment.enrollment_id}")
            else:
                print(f"\n   ❌ User 3 does NOT have an enrollment in this course")

except api_models.VariantItem.DoesNotExist:
    print(f"\n❌ Lesson {target_id} not found")
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
