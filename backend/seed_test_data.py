"""Seed test data for SearchLog and SearchQueryTaxonomy"""
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import SearchLog, SearchQueryTaxonomy, SearchQueryCategory
from django.utils import timezone
from datetime import timedelta
import random

# Create sample search logs and taxonomy entries
categories = list(SearchQueryCategory.objects.all())
search_terms = [
    'python tutorial', 'python basics', 'django framework', 'python loops',
    'html css', 'react tutorial', 'javascript', 'web development',
    'data science', 'machine learning', 'pandas', 'data analysis',
    'cloud computing', 'aws tutorial', 'kubernetes', 'docker basics',
    'leadership skills', 'communication course', 'project management'
]

# Create SearchLog entries (what searches happened)
print("Creating SearchLog entries...")
start_count = SearchLog.objects.count()
for i in range(50):
    search_term = random.choice(search_terms)
    log = SearchLog.objects.create(
        query=search_term,
        results_count=random.randint(0, 50),
        clicked_result=None,  # No course clicked
        user=None,  # Anonymous user
        created_at=timezone.now() - timedelta(days=random.randint(0, 7))
    )
print(f"Created {SearchLog.objects.count() - start_count} SearchLog entries (total: {SearchLog.objects.count()})")

# Create SearchQueryTaxonomy entries
print("\nCreating SearchQueryTaxonomy entries...")
start_count = SearchQueryTaxonomy.objects.count()
for i in range(20):
    category = random.choice(categories)
    search_query = random.choice(search_terms)
    
    taxonomy, created = SearchQueryTaxonomy.objects.get_or_create(
        search_query=search_query,
        category=category,
        defaults={
            'search_count': random.randint(1, 100),
            'click_through_count': random.randint(0, 50),
            'failed_count': random.randint(0, 20),
            'unique_users': random.randint(1, 10),
        }
    )
    if created:
        print(f"  ✓ {search_query} → {category.category_name}")

print(f"\n✓ SearchQueryTaxonomy count: {SearchQueryTaxonomy.objects.count() - start_count} created (total: {SearchQueryTaxonomy.objects.count()})")
