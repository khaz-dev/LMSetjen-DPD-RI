"""
Management command to grant multi-role access to a user
✨ PHASE 4.10: Boolean Role System

Usage:
    python manage.py grant_multi_roles user@example.com student instructor admin
"""

from django.core.management.base import BaseCommand, CommandError
from userauths.models import User, Profile


class Command(BaseCommand):
    help = 'Grant multiple roles to a user using the boolean role system'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='User email address')
        parser.add_argument(
            'roles', 
            nargs='+',
            help='Roles to grant: student, instructor (or teacher), admin'
        )
        parser.add_argument(
            '--set-current-role',
            type=str,
            default=None,
            help='Set the current active role (must be one of the granted roles)'
        )

    def handle(self, *args, **options):
        email = options['email']
        role_list = options['roles']
        current_role = options.get('set_current_role')
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f'User with email {email} not found')
        
        # Validate roles
        valid_roles = {'student', 'instructor', 'teacher', 'admin'}
        for role in role_list:
            if role not in valid_roles:
                raise CommandError(
                    f'Invalid role: {role}. '
                    f'Valid roles are: {", ".join(valid_roles)}'
                )
        
        # Grant each role using the new boolean system
        for role in role_list:
            user.grant_role(role)
            self.stdout.write(
                self.style.SUCCESS(f'✓ Granted {role} role to {email}')
            )
        
        # Set current role if specified
        if current_role:
            if current_role not in role_list:
                raise CommandError(
                    f'Current role {current_role} not in granted roles: '
                    f'{", ".join(role_list)}'
                )
            user.current_role = current_role
            user.save(update_fields=['current_role'])
            self.stdout.write(
                self.style.SUCCESS(f'✓ Set current role to {current_role}')
            )
        else:
            # Default to first role
            user.current_role = role_list[0]
            user.save(update_fields=['current_role'])
            self.stdout.write(
                self.style.SUCCESS(f'✓ Set current role to {role_list[0]} (default)')
            )
        
        # Display final user state
        self.stdout.write(self.style.SUCCESS('\n=== User Configuration Complete ==='))
        self.stdout.write(f'Email: {user.email}')
        self.stdout.write(f'Username: {user.username}')
        self.stdout.write(f'Full Name: {user.full_name}')
        self.stdout.write(f'Is Student: {user.is_student}')
        self.stdout.write(f'Is Instructor: {user.is_instructor}')
        self.stdout.write(f'Is Admin: {user.is_admin}')
        self.stdout.write(f'Available Roles: {", ".join(user.get_available_boolean_roles())}')
        self.stdout.write(f'Current Role: {user.current_role}')
        self.stdout.write(f'CSV Roles: {user.roles}')
        self.stdout.write(self.style.SUCCESS('✓ User is ready for multi-role login!'))
