# Generated migration for changing Teacher.image from URLField to FileField

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0112_feedback"),
    ]

    operations = [
        migrations.AlterField(
            model_name="teacher",
            name="image",
            field=models.FileField(blank=True, null=True, upload_to="teacher_profile_images/"),
        ),
    ]
