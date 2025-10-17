"""
Django management command to initialize the database with default data
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()

class Command(BaseCommand):
    help = 'Initialize database with default superuser and test accounts'

    def add_arguments(self, parser):
        parser.add_argument(
            '--skip-if-exists',
            action='store_true',
            help='Skip initialization if users already exist',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('🔧 Initializing database...'))
        
        # Check if users already exist
        user_count = User.objects.count()
        if user_count > 0 and options['skip_if_exists']:
            self.stdout.write(self.style.SUCCESS(
                f'✅ Database already initialized ({user_count} users exist). Skipping.'
            ))
            return
        
        try:
            with transaction.atomic():
                # Create superuser admin account
                admin_user, admin_created = User.objects.get_or_create(
                    email='admin@lmsetjen.dpd.go.id',
                    defaults={
                        'username': 'admin',
                        'full_name': 'System Administrator',
                        'role': 'admin',
                        'is_staff': True,
                        'is_superuser': True,
                        'is_active': True,
                    }
                )
                
                if admin_created:
                    admin_user.set_password('Admin@LMS2025!')
                    admin_user.save()
                    self.stdout.write(self.style.SUCCESS(
                        f'✅ Created superuser: {admin_user.email}'
                    ))
                else:
                    # Update password if user exists
                    admin_user.set_password('Admin@LMS2025!')
                    admin_user.is_staff = True
                    admin_user.is_superuser = True
                    admin_user.is_active = True
                    admin_user.role = 'admin'
                    admin_user.save()
                    self.stdout.write(self.style.WARNING(
                        f'⚠️  Updated existing superuser: {admin_user.email}'
                    ))
                
                # Create default user account (lmsetjendpdri@gmail.com)
                default_user, user_created = User.objects.get_or_create(
                    email='lmsetjendpdri@gmail.com',
                    defaults={
                        'username': 'lmsetjendpdri',
                        'full_name': 'LMSetjen DPD RI',
                        'role': 'student',
                        'is_staff': False,
                        'is_superuser': False,
                        'is_active': True,
                    }
                )
                
                if user_created:
                    default_user.set_password('Admin@LMS2025!')
                    default_user.save()
                    self.stdout.write(self.style.SUCCESS(
                        f'✅ Created default user: {default_user.email}'
                    ))
                else:
                    # Update password if user exists
                    default_user.set_password('Admin@LMS2025!')
                    default_user.is_active = True
                    default_user.save()
                    self.stdout.write(self.style.WARNING(
                        f'⚠️  Updated existing user: {default_user.email}'
                    ))
                
                # Summary
                total_users = User.objects.count()
                self.stdout.write(self.style.SUCCESS(
                    f'\n🎉 Database initialization complete!'
                ))
                self.stdout.write(self.style.SUCCESS(
                    f'   Total users in database: {total_users}'
                ))
                self.stdout.write(self.style.SUCCESS(
                    f'\n📝 Default Credentials:'
                ))
                self.stdout.write(self.style.SUCCESS(
                    f'   Superuser: admin@lmsetjen.dpd.go.id / Admin@LMS2025!'
                ))
                self.stdout.write(self.style.SUCCESS(
                    f'   User: lmsetjendpdri@gmail.com / Admin@LMS2025!'
                ))
                self.stdout.write(self.style.SUCCESS(
                    f'\n🔗 Login at: https://lmsetjendpdri.duckdns.org/login/'
                ))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'❌ Error initializing database: {str(e)}'
            ))
            raise
