#!/usr/bin/env python
"""Find which users have this lesson enrolled"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models as api_models

print("\n" + "="*80)
print("FIND USERS WITH LESSON 254517")
print("="*80)

target_item_id = 254517

try:
    # Find the variant item
    variant_item = api_models.VariantItem.objects.get(variant_item_id=target_item_id)
    course = variant_item.variant.course
    
    # Find all enrollments in this course
    enrollments = api_models.EnrolledCourse.objects.filter(course=course)
    
    print(f"\n✅ Lesson: {variant_item.title}")
    print(f"✅ Course: {course.title}")
    print(f"✅ Course ID: {course.course_id}")
    
    print(f"\n📚 Enrollments in this course: {enrollments.count()}")
    
    for enrollment in enrollments[:10]:  # Show first 10
        user = enrollment.user
        print(f"\n   User: {user.username} (ID={user.id})")
        print(f"   Enrollment: {enrollment.enrollment_id}")
        
        # Check if completed
        completed = api_models.CompletedLesson.objects.filter(
            user=user,
            course=course,
            variant_item=variant_item
        )
        
        if completed.exists():
            print(f"   ❌ Has ORPHANED CompletedLesson record for this lesson!")
            for cl in completed:
                print(f"      Created: {cl.created_at}")
        else:
            print(f"   ✅ No CompletedLesson record")

except api_models.VariantItem.DoesNotExist:
    print(f"\n❌ Lesson {target_item_id} not found")
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
