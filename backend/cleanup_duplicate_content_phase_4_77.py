#!/usr/bin/env python
"""
PHASE 4.77: Cleanup script to remove duplicate content from existing published courses

This script identifies published courses with duplicate content and removes the duplicates
while keeping exactly ONE copy of each item.
"""
import sys, os
sys.path.insert(0, '.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()

from api import models as api_models
from collections import Counter
from django.db import transaction

def clean_duplicates(course):
    """
    Remove duplicate content from a published course
    
    For each type of content (variants, features, requirements, outcomes),
    keep only the FIRST occurrence and delete all duplicates.
    
    Returns: count of items deleted
    """
    total_deleted = 0
    
    # Clean duplicate variants
    variants_by_title = {}
    for variant in course.curriculum.all().order_by('id'):
        if variant.title not in variants_by_title:
            # Keep the first one
            variants_by_title[variant.title] = variant
        else:
            # Delete the duplicate
            print(f"  [DELETE] Variant '{variant.title}' (ID: {variant.id})")
            VariantItem_count = variant.variant_items.count()
            variant.delete()
            total_deleted += 1
            if VariantItem_count > 0:
                print(f"         -> Also deleted {VariantItem_count} lessons")
    
    # Clean duplicate features
    features_by_text = {}
    for feature in course.features.all().order_by('id'):
        if feature.text not in features_by_text:
            features_by_text[feature.text] = feature
        else:
            print(f"  [DELETE] Feature '{feature.text[:50]}' (ID: {feature.id})")
            feature.delete()
            total_deleted += 1
    
    # Clean duplicate requirements
    reqs_by_text = {}
    for req in course.requirements.all().order_by('id'):
        if req.requirement not in reqs_by_text:
            reqs_by_text[req.requirement] = req
        else:
            print(f"  [DELETE] Requirement '{req.requirement[:50]}' (ID: {req.id})")
            req.delete()
            total_deleted += 1
    
    # Clean duplicate learning outcomes
    outcomes_by_text = {}
    for outcome in course.learning_outcomes.all().order_by('id'):
        if outcome.outcome not in outcomes_by_text:
            outcomes_by_text[outcome.outcome] = outcome
        else:
            print(f"  [DELETE] Outcome '{outcome.outcome[:50]}' (ID: {outcome.id})")
            outcome.delete()
            total_deleted += 1
    
    # Clean duplicate quizzes
    quizzes_by_title = {}
    for quiz in course.quizzes.all().order_by('id'):
        if quiz.title not in quizzes_by_title:
            quizzes_by_title[quiz.title] = quiz
        else:
            print(f"  [DELETE] Quiz '{quiz.title}' (ID: {quiz.id})")
            quiz.delete()
            total_deleted += 1
    
    return total_deleted

def main():
    print('='*80)
    print(' PHASE 4.77: Cleanup Duplicate Content in Published Courses')
    print('='*80)
    
    # Find all published courses with duplicates
    published_courses = api_models.Course.objects.filter(is_published_version=True)
    print(f'\nScanning {published_courses.count()} published courses...\n')
    
    courses_with_duplicates = []
    total_duplicates = 0
    
    for course in published_courses:
        # Check each type of content for duplicates
        has_duplicates = False
        
        # Check variants
        variant_titles = list(course.curriculum.values_list('title', flat=True))
        if len(variant_titles) != len(set(variant_titles)):
            has_duplicates = True
        
        # Check features
        feature_texts = list(course.features.values_list('text', flat=True))
        if len(feature_texts) != len(set(feature_texts)):
            has_duplicates = True
        
        # Check requirements
        req_texts = list(course.requirements.values_list('requirement', flat=True))
        if len(req_texts) != len(set(req_texts)):
            has_duplicates = True
        
        # Check outcomes
        outcome_texts = list(course.learning_outcomes.values_list('outcome', flat=True))
        if len(outcome_texts) != len(set(outcome_texts)):
            has_duplicates = True
        
        # Check quizzes
        quiz_titles = list(course.quizzes.values_list('title', flat=True))
        if len(quiz_titles) != len(set(quiz_titles)):
            has_duplicates = True
        
        if has_duplicates:
            courses_with_duplicates.append(course)
    
    print(f'[FOUND] {len(courses_with_duplicates)} published courses with duplicate content\n')
    
    if len(courses_with_duplicates) == 0:
        print('[INFO] No duplicates found. All published courses are clean!')
        return
    
    # Show summary of duplicates
    print('Courses with duplicates:')
    print('-'*80)
    for course in courses_with_duplicates:
        variant_titles = list(course.curriculum.values_list('title', flat=True))
        feature_texts = list(course.features.values_list('text', flat=True))
        
        print(f'\n{course.title[:60]}')
        print(f'  Course ID: {course.course_id}')
        print(f'  Parent: {course.parent_course_id}')
        
        if len(variant_titles) != len(set(variant_titles)):
            counts = Counter(variant_titles)
            dups = sum(1 for c in counts.values() if c > 1)
            total_items = sum(c-1 for c in counts.values() if c > 1)
            print(f'  - Variants: {dups} duplicated items ({total_items} extra copies)')
        
        if len(feature_texts) != len(set(feature_texts)):
            counts = Counter(feature_texts)
            dups = sum(1 for c in counts.values() if c > 1)
            total_items = sum(c-1 for c in counts.values() if c > 1)
            print(f'  - Features: {dups} duplicated items ({total_items} extra copies)')
        
        if len(set(course.requirements.values_list('requirement', flat=True))) != course.requirements.count():
            print(f'  - Requirements: {course.requirements.count() - len(set(course.requirements.values_list("requirement", flat=True)))} duplicates')
        
        if len(set(course.learning_outcomes.values_list('outcome', flat=True))) != course.learning_outcomes.count():
            print(f'  - Outcomes: {course.learning_outcomes.count() - len(set(course.learning_outcomes.values_list("outcome", flat=True)))} duplicates')
    
    # Ask for confirmation
    print('\n' + '='*80)
    print('CLEANUP PLAN:')
    print('='*80)
    print(f'\nWill remove duplicate items from {len(courses_with_duplicates)} published courses')
    print('keeping ONLY the first occurrence of each item\n')
    
    response = input('Continue with cleanup? (yes/no): ').strip().lower()
    if response != 'yes':
        print('[CANCELLED] Cleanup aborted')
        return
    
    # Clean up duplicates
    print('\n' + '='*80)
    print('CLEANING UP DUPLICATES')
    print('='*80 + '\n')
    
    with transaction.atomic():
        for course in courses_with_duplicates:
            print(f'Cleaning: {course.title[:60]}...')
            deleted_count = clean_duplicates(course)
            if deleted_count > 0:
                total_duplicates += deleted_count
                print(f'  [DONE] Deleted {deleted_count} duplicate items\n')
            else:
                print(f'  [OK] No duplicates to clean\n')
    
    print('='*80)
    print('CLEANUP COMPLETE')
    print('='*80)
    print(f'\nTotal duplicate items removed: {total_duplicates}')
    print(f'Published courses cleaned: {len(courses_with_duplicates)}')
    print('\nAll published courses now have single copies of their content!')

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\n[ERROR] Cleanup failed: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
