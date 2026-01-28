# Generated migration for Phase 4.10 - Boolean Role System
# ✨ Adds is_student, is_instructor, is_admin boolean fields to User model
# This migration converts string-based roles to boolean-based multi-role system

from django.db import migrations, models


def migrate_string_roles_to_boolean(apps, schema_editor):
    """
    Migrate existing string-based roles to boolean fields
    
    Logic:
    - If role or current_role contains 'admin' → is_admin = True
    - If role or current_role contains 'teacher'/'instructor' → is_instructor = True
    - If role or current_role contains 'student' or is None → is_student = True (keep default)
    - If roles CSV contains multiple roles, set all corresponding boolean fields
    
    This ensures ALL users can access their current role while supporting multi-role access.
    """
    User = apps.get_model('userauths', 'User')
    
    for user in User.objects.all():
        # Check both role and current_role fields
        roles_to_check = []
        
        if user.role:
            roles_to_check.append(user.role.lower().strip())
        if user.current_role:
            roles_to_check.append(user.current_role.lower().strip())
        
        # Also check the CSV roles field
        if user.roles:
            csv_roles = [r.strip().lower() for r in user.roles.split(',')]
            roles_to_check.extend(csv_roles)
        
        # Remove duplicates
        roles_to_check = list(set(roles_to_check))
        
        # Set boolean fields based on roles found
        for role in roles_to_check:
            if role == 'admin':
                user.is_admin = True
            elif role in ['teacher', 'instructor']:
                user.is_instructor = True
            elif role == 'student':
                user.is_student = True
        
        # Special case: If no roles found, keep default (is_student=True)
        if not roles_to_check:
            user.is_student = True
        
        user.save(update_fields=['is_student', 'is_instructor', 'is_admin'])


class Migration(migrations.Migration):

    dependencies = [
        ('userauths', '0005_user_current_role_user_roles_alter_user_role_and_more'),
    ]

    operations = [
        # Add new boolean role fields with defaults
        migrations.AddField(
            model_name='user',
            name='is_student',
            field=models.BooleanField(default=True, help_text='User can access student role features'),
        ),
        migrations.AddField(
            model_name='user',
            name='is_instructor',
            field=models.BooleanField(default=False, help_text='User can access instructor/teacher role features'),
        ),
        migrations.AddField(
            model_name='user',
            name='is_admin',
            field=models.BooleanField(default=False, help_text='User can access admin role features'),
        ),
        
        # Add indexes for new boolean fields
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['is_student'], name='userauths_u_is_stu_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['is_instructor'], name='userauths_u_is_ins_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['is_admin'], name='userauths_u_is_adm_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['is_student', 'is_active'], name='userauths_u_is_stu_active_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['is_instructor', 'is_active'], name='userauths_u_is_ins_active_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['is_admin', 'is_active'], name='userauths_u_is_adm_active_idx'),
        ),
        
        # Run Python function to migrate existing users based on their roles
        migrations.RunPython(
            code=migrate_string_roles_to_boolean,
            reverse_code=migrations.RunPython.noop,  # No need to reverse
        ),
    ]
