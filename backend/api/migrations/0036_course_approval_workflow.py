# Generated migration for course approval workflow - PHASE 4.36
# ✨ PHASE 4.36: Course approval workflow fields

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0035_course_intro_video_source'),
    ]

    operations = [
        migrations.AddField(
            model_name='course',
            name='rejection_reason',
            field=models.TextField(blank=True, null=True, help_text="Admin's reason for rejecting the course"),
        ),
        migrations.AddField(
            model_name='course',
            name='approved_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_courses', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='course',
            name='approval_date',
            field=models.DateTimeField(blank=True, null=True, help_text="When course was approved by admin"),
        ),
        migrations.AddField(
            model_name='course',
            name='review_submitted_date',
            field=models.DateTimeField(blank=True, null=True, help_text="When instructor submitted course for review"),
        ),
        migrations.AlterField(
            model_name='course',
            name='platform_status',
            field=models.CharField(
                blank=True,
                choices=[('Review', 'Review'), ('Disabled', 'Disabled'), ('Rejected', 'Rejected'), ('Draft', 'Draft'), ('Published', 'Published')],
                default='Draft',
                max_length=100,
                null=True,
                help_text='Review=Awaiting admin approval, Published=Admin approved'
            ),
        ),
    ]
