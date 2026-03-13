#!/usr/bin/env python
"""Find all enrollments for user 3 and check each one"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models as api_models

print("\n" + "="*80)
print("ALL ENROLLMENTS FOR USER 3")
print("="*80)

target_item_id = 254517

try:
    enrollments = api_models.EnrolledCourse.objects.filter(user_id=3).select_related('course')
    
    print(f"\n✅ Found {enrollments.count()} enrollments for user 3:")
    
    for enrollment in enrollments:
        print(f"\n📚 {enrollment.course.title}")
        print(f"   Enrollment: {enrollment.enrollment_id}")
        
        # Check curriculum for this enrollment
        curriculum = enrollment.course.curriculum.all()
        item_count = 0
        found = False
        completed_count = 0
        
        for variant in curriculum:
            for item in variant.variant_items.all():
                item_count += 1
                if item.variant_item_id == target_item_id:
                    found = True
                    # Check if completed
                    is_completed = api_models.CompletedLesson.objects.filter(
                        user_id=3,
                        course=enrollment.course,
                        variant_item=item
                    ).exists()
                    print(f"   ✅ Contains target lesson! (is_completed={is_completed})")
                    
                # Count other completed lessons
                if api_models.CompletedLesson.objects.filter(
                    user_id=3,
                    course=enrollment.course,
                    variant_item=item
                ).exists():
                    completed_count += 1
        
        print(f"   Items: {item_count}, Completed: {completed_count}")
        
        if not found:
            print(f"   ❌ Does NOT contain target lesson")

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
