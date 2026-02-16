# Generated migration for Phase 4.10: Allow general testimonials without course
# Run: python manage.py migrate

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0018_alter_variant_course'),
    ]

    operations = [
        migrations.AlterField(
            model_name='review',
            name='course',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.course'),
        ),
    ]
