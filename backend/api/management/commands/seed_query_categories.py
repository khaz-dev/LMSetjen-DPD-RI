"""
Seed SearchQueryCategory with sample data for taxonomy analysis
"""
from django.core.management.base import BaseCommand
from api.models import SearchQueryCategory


class Command(BaseCommand):
    help = 'Seed SearchQueryCategory with sample data'

    def handle(self, *args, **options):
        # Define sample categories
        categories_data = [
            {
                'category_type': 'SKILL',
                'category_name': 'Python Programming',
                'query_patterns': ['python', 'django', 'fastapi', 'flask', 'pandas', 'numpy'],
                'description': 'Searches related to Python programming',
                'trending': True,
            },
            {
                'category_type': 'SKILL',
                'category_name': 'Web Development',
                'query_patterns': ['html', 'css', 'javascript', 'react', 'vue', 'angular', 'web development'],
                'description': 'Web development related searches',
                'trending': True,
            },
            {
                'category_type': 'SKILL',
                'category_name': 'Data Science',
                'query_patterns': ['data science', 'machine learning', 'ai', 'deep learning', 'tensorflow', 'pytorch'],
                'description': 'Data science and machine learning searches',
                'trending': True,
            },
            {
                'category_type': 'COURSE_TYPE',
                'category_name': 'Beginner Courses',
                'query_patterns': ['beginner', 'introduction', 'intro', 'start', 'learn basics'],
                'description': 'Beginner level course searches',
                'trending': False,
            },
            {
                'category_type': 'COURSE_TYPE',
                'category_name': 'Advanced Courses',
                'query_patterns': ['advanced', 'expert', 'professional', 'master', 'intermediate'],
                'description': 'Advanced level course searches',
                'trending': False,
            },
            {
                'category_type': 'LEVEL',
                'category_name': 'Certification Programs',
                'query_patterns': ['certification', 'certified', 'exam', 'credential', 'certificate'],
                'description': 'Certification program searches',
                'trending': True,
            },
            {
                'category_type': 'TOPIC',
                'category_name': 'Cloud Computing',
                'query_patterns': ['aws', 'azure', 'gcp', 'cloud', 'kubernetes', 'docker'],
                'description': 'Cloud computing and DevOps searches',
                'trending': True,
            },
            {
                'category_type': 'TOOL',
                'category_name': 'Development Tools',
                'query_patterns': ['git', 'github', 'vscode', 'ide', 'terminal', 'command line'],
                'description': 'Development tools and utilities',
                'trending': False,
            },
            {
                'category_type': 'DOMAIN',
                'category_name': 'Government Affairs',
                'query_patterns': ['government', 'policy', 'legislation', 'public sector', 'dpd'],
                'description': 'Government and public policy related searches',
                'trending': False,
            },
            {
                'category_type': 'OTHER',
                'category_name': 'Soft Skills',
                'query_patterns': ['communication', 'leadership', 'management', 'teamwork', 'soft skills'],
                'description': 'Soft skills and professional development',
                'trending': False,
            },
        ]

        created_count = 0
        skipped_count = 0

        for cat_data in categories_data:
            try:
                category, created = SearchQueryCategory.objects.get_or_create(
                    category_type=cat_data['category_type'],
                    category_name=cat_data['category_name'],
                    defaults={
                        'query_patterns': cat_data['query_patterns'],
                        'description': cat_data['description'],
                        'trending': cat_data['trending'],
                    }
                )
                if created:
                    created_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f"✓ Created: {category.category_name}")
                    )
                else:
                    skipped_count += 1
                    self.stdout.write(
                        self.style.WARNING(f"~ Already exists: {category.category_name}")
                    )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"✗ Error creating {cat_data['category_name']}: {str(e)}")
                )

        self.stdout.write(
            self.style.SUCCESS(f"\n✓ Seeding complete! Created: {created_count}, Skipped: {skipped_count}")
        )
