# Generated migration for PHASE 4.60: Course Versioning

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0036_course_approval_workflow'),  # Assuming this is the latest migration
    ]

    operations = [
        migrations.AddField(
            model_name='course',
            name='is_published_version',
            field=models.BooleanField(
                default=False,
                help_text='Flag indicating this is the student-facing published version'
            ),
        ),
        migrations.AddField(
            model_name='course',
            name='parent_course',
            field=models.ForeignKey(
                blank=True,
                help_text="Points to instructor's draft if this is a published version copy",
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='published_copies',
                to='api.course'
            ),
        ),
    ]
