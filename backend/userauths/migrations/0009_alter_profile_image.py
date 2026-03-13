# Generated migration for changing Profile.image from URLField to FileField

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("userauths", "0008_alter_admin_image_alter_profile_image"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="image",
            field=models.FileField(blank=True, null=True, upload_to="user_profile_images/"),
        ),
    ]
