# Generated migration for adding role field to Review model
# ✨ PHASE 4.11: Adds testimonial role field for multi-role user support

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_alter_review_course'),
    ]

    operations = [
        # Add role field to Review model
        migrations.AddField(
            model_name='review',
            name='role',
            field=models.CharField(
                choices=[('student', 'Student'), ('instructor', 'Instructor')],
                default='student',
                help_text='Role the user is testifying as (student or instructor)',
                max_length=20
            ),
        ),
        
        # Add new unique constraint for user + course + role
        migrations.AddConstraint(
            model_name='review',
            constraint=models.UniqueConstraint(
                fields=('user', 'course', 'role'),
                name='unique_user_course_role_review'
            ),
        ),
        
        # Add index for role filtering
        migrations.AddIndex(
            model_name='review',
            index=models.Index(fields=['role'], name='api_review_role_idx'),
        ),
        migrations.AddIndex(
            model_name='review',
            index=models.Index(fields=['user', 'role'], name='api_review_user_role_idx'),
        ),
    ]

