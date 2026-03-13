# Generated migration for PHASE 11.178: VideoProgress completion tracking fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0113_alter_teacher_image_alter_pointsauditlog_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name='videoprogress',
            name='is_fully_watched',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='videoprogress',
            name='fully_watched_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
