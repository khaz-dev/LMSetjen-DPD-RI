from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from api.models import Teacher, Category

User = get_user_model()

class Command(BaseCommand):
    help = 'Create initial test data for course creation'

    def handle(self, *args, **options):
        # Create a test user if it doesn't exist
        user, created = User.objects.get_or_create(
            email='teacher@test.com',
            defaults={
                'full_name': 'Test Teacher',
                'username': 'teacher',
                'is_active': True
            }
        )
        
        if created:
            user.set_password('testpass123')
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Created test user: {user.email}'))
        
        # Create a teacher profile if it doesn't exist
        teacher, created = Teacher.objects.get_or_create(
            user=user,
            defaults={
                'full_name': user.full_name,
                'bio': 'Test teacher for course creation',
                'country': 'Indonesia'
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created teacher profile for: {user.full_name}'))
        
        # Create some test categories
        categories = [
            {'title': 'Programming', 'slug': 'programming'},
            {'title': 'Design', 'slug': 'design'},
            {'title': 'Business', 'slug': 'business'},
            {'title': 'Marketing', 'slug': 'marketing'},
        ]
        
        for cat_data in categories:
            category, created = Category.objects.get_or_create(
                title=cat_data['title'],
                defaults={'slug': cat_data['slug']}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created category: {category.title}'))
        
        self.stdout.write(self.style.SUCCESS('Initial test data created successfully!'))