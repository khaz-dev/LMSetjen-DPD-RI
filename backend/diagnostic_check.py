#!/usr/bin/env python
"""Diagnostic check for lesson completion issue"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models as api_models

# Get user ID 3 and find the lesson with variant_item_id 254517
# Check if there's a CompletedLesson record for it
user_id = 3
variant_item_id = 254517

print("\n" + "="*80)
print("DIAGNOSTIC: Lesson Completion Status Check")
print("="*80)

try:
    variant_item = api_models.VariantItem.objects.get(variant_item_id=variant_item_id)
    print(f"\n✅ Found VariantItem: {variant_item.title}")
    print(f"   ID: {variant_item.variant_item_id}")
    
    # Check for verification question
    question = api_models.LessonCompletionQuestion.objects.filter(variant_item=variant_item).first()
    if question:
        print(f"   ✅ Has verification question: ID={question.id}, Type={question.question_type}")
        print(f"      Text: {question.question_text[:80]}...")
    else:
        print(f"   ❌ NO verification question")
    
    # Check for CompletedLesson record
    completed = api_models.CompletedLesson.objects.filter(user_id=user_id, variant_item=variant_item).first()
    if completed:
        print(f"\n   ⚠️ CompletedLesson record EXISTS")
        print(f"      created_at: {completed.created_at}")
        
        # Check if student answered the question correctly
        if question:
            answer = api_models.LessonCompletionQuestionAnswer.objects.filter(
                user_id=user_id,
                question=question,
                is_correct=True
            ).first()
            if answer:
                print(f"       ✅ Student answered CORRECTLY (VALID completion)")
            else:
                print(f"       ❌ Student has NOT answered correctly (ORPHANED/INVALID completion!)")
                print(f"          This is the CULPRIT! ⚠️ ⚠️ ⚠️")
        else:
            print(f"       ✅ No question, so AUTO-COMPLETE is valid")
    else:
        print(f"\n   ✅ No CompletedLesson record (lesson not completed)")
        
except api_models.VariantItem.DoesNotExist:
    print(f"\n❌ VariantItem {variant_item_id} not found")
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
