# Generated migration for Phase 4.18: Video source type field
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0034_remove_review_unique_user_course_role_review_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='course',
            name='intro_video_source',
            field=models.CharField(
                blank=True,
                choices=[('upload', 'Upload File'), ('youtube', 'YouTube Link')],
                default='upload',
                max_length=20,
                null=True
            ),
        ),
    ]
