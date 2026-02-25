#!/usr/bin/env python
import sys, os
sys.path.insert(0, '.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()

from api import models
from collections import Counter

print('='*80)
print('AUDIT: Finding courses with duplicate content')
print('='*80)

# Find all published courses
published_courses = models.Course.objects.filter(is_published_version=True).order_by('-date')[:5]

for pub_course in published_courses:
    print(f'\nPublished Course: {pub_course.title} (ID: {pub_course.course_id})')
    print(f'  Created: {pub_course.date}')
    print(f'  Parent Course ID: {pub_course.parent_course_id}')
    
    # Count content
    variants_count = pub_course.curriculum.count()
    features_count = pub_course.features.count()
    req_count = pub_course.requirements.count()
    outcome_count = pub_course.learning_outcomes.count()
    quiz_count = pub_course.quizzes.count()
    
    print(f'\n  Content Item Counts:')
    print(f'    - Variants (Bagian): {variants_count}')
    print(f'    - Features (Fitur): {features_count}')
    print(f'    - Requirements (Persyaratan): {req_count}')
    print(f'    - Learning Outcomes (Hasil Pembelajaran): {outcome_count}')
    print(f'    - Quizzes (Kuis): {quiz_count}')
    
    # Check for duplicates in features
    if features_count > 0:
        all_features = list(pub_course.features.all().values_list('text', flat=True))
        unique_features = set(all_features)
        if len(all_features) != len(unique_features):
            print(f'\n  [WARNING] DUPLICATE FEATURES: Total={len(all_features)}, Unique={len(unique_features)}')
            counts = Counter(all_features)
            for text, count in counts.items():
                if count > 1:
                    print(f'     - "{text[:50]}": {count} copies')
    
    # Check for duplicates in variants
    if variants_count > 0:
        all_variants = list(pub_course.curriculum.all().values_list('title', flat=True))
        unique_variants = set(all_variants)
        if len(all_variants) != len(unique_variants):
            print(f'\n  [WARNING] DUPLICATE VARIANTS: Total={len(all_variants)}, Unique={len(unique_variants)}')
            counts = Counter(all_variants)
            for title, count in counts.items():
                if count > 1:
                    print(f'     - "{title}": {count} copies')
    
    # Check for duplicates in requirements
    if req_count > 0:
        all_reqs = list(pub_course.requirements.all().values_list('requirement', flat=True))
        unique_reqs = set(all_reqs)
        if len(all_reqs) != len(unique_reqs):
            print(f'\n  [WARNING] DUPLICATE REQUIREMENTS: Total={len(all_reqs)}, Unique={len(unique_reqs)}')
            counts = Counter(all_reqs)
            for req, count in counts.items():
                if count > 1:
                    print(f'     - "{req[:50]}": {count} copies')
    
    # Check for duplicates in outcomes
    if outcome_count > 0:
        all_outcomes = list(pub_course.learning_outcomes.all().values_list('outcome', flat=True))
        unique_outcomes = set(all_outcomes)
        if len(all_outcomes) != len(unique_outcomes):
            print(f'\n  [WARNING] DUPLICATE OUTCOMES: Total={len(all_outcomes)}, Unique={len(unique_outcomes)}')
            counts = Counter(all_outcomes)
            for outcome, count in counts.items():
                if count > 1:
                    print(f'     - "{outcome[:50]}": {count} copies')
    
    print('\n' + '-'*80)

print('\nAuditing complete!')
