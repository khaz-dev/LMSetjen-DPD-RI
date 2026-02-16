"""
Management command to fix boolean role flags in the User model
This fixes the issue where instructor users have is_student=True as well

✨ PHASE 4.10: Boolean role system fix
"""

from django.core.management.base import BaseCommand
from django.db.models import Q
from userauths.models import User


class Command(BaseCommand):
    help = 'Fix boolean role flags to have exclusive roles where applicable'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix-multi-role',
            action='store_true',
            help='Fix multi-role users by setting them to their current_role',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be fixed without actually fixing',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        fix_multi_role = options.get('fix_multi_role', False)

        self.stdout.write(self.style.SUCCESS('=' * 80))
        self.stdout.write(self.style.SUCCESS('BOOLEAN ROLE FLAGS FIX'))
        self.stdout.write(self.style.SUCCESS('=' * 80))

        # Analyze current state
        self.stdout.write('\n📊 CURRENT STATE:')
        student_only = User.objects.filter(is_student=True, is_instructor=False).count()
        instructor_only = User.objects.filter(is_student=False, is_instructor=True).count()
        both_roles = User.objects.filter(is_student=True, is_instructor=True).count()
        admin_only = User.objects.filter(is_admin=True).count()

        self.stdout.write(f'  Student only: {student_only}')
        self.stdout.write(f'  Instructor only: {instructor_only}')
        self.stdout.write(f'  Both roles (is_student=T, is_instructor=T): {both_roles}')
        self.stdout.write(f'  Admins: {admin_only}')

        # Show multi-role users
        if both_roles > 0:
            self.stdout.write(self.style.WARNING(f'\n⚠️  MULTI-ROLE USERS ({both_roles}):'))
            multi_role_users = User.objects.filter(is_student=True, is_instructor=True)[:5]
            for user in multi_role_users:
                self.stdout.write(
                    f'  - {user.email} | current_role={user.current_role} | role={user.role} | roles={user.roles}'
                )
            if both_roles > 5:
                self.stdout.write(f'  ... and {both_roles - 5} more')

        # Fix multi-role users if requested
        if fix_multi_role and both_roles > 0:
            self.stdout.write(self.style.WARNING(f'\n🔧 FIXING MULTI-ROLE USERS...'))
            
            multi_role_users = User.objects.filter(is_student=True, is_instructor=True)
            fixed_count = 0
            
            for user in multi_role_users:
                # Determine primary role from current_role or role field
                primary_role = user.current_role or user.role or 'student'
                
                # Reset flags
                user.is_student = False
                user.is_instructor = False
                user.is_admin = False
                
                # Set appropriate flag based on primary role
                if primary_role.lower() in ['teacher', 'instructor']:
                    user.is_instructor = True
                elif primary_role.lower() == 'admin':
                    user.is_admin = True
                else:  # default to student
                    user.is_student = True
                
                if dry_run:
                    self.stdout.write(
                        f'  [DRY RUN] Would fix {user.email}: '
                        f'is_student={user.is_student}, is_instructor={user.is_instructor}'
                    )
                else:
                    user.save(update_fields=['is_student', 'is_instructor', 'is_admin'])
                    fixed_count += 1
            
            if dry_run:
                self.stdout.write(self.style.WARNING(f'  [DRY RUN] Would fix {fixed_count} users'))
            else:
                self.stdout.write(self.style.SUCCESS(f'  ✅ Fixed {fixed_count} users'))

        # Show final state
        self.stdout.write('\n📊 FINAL STATE:')
        student_only = User.objects.filter(is_student=True, is_instructor=False).count()
        instructor_only = User.objects.filter(is_student=False, is_instructor=True).count()
        both_roles = User.objects.filter(is_student=True, is_instructor=True).count()

        self.stdout.write(f'  Student only: {student_only}')
        self.stdout.write(f'  Instructor only: {instructor_only}')
        self.stdout.write(f'  Both roles: {both_roles}')

        if dry_run:
            self.stdout.write(self.style.WARNING('\n⚠️  DRY RUN - No changes were made'))
            self.stdout.write('Run with --fix-multi-role to apply fixes')
        else:
            self.stdout.write(self.style.SUCCESS('\n✅ Fix complete!'))

        self.stdout.write(self.style.SUCCESS('=' * 80))
