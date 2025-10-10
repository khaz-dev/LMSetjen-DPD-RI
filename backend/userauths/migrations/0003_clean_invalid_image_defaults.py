# Generated manually to clean up invalid image defaults

from django.db import migrations


def clean_invalid_images(apps, schema_editor):
    """Remove invalid 'default-user.jpg' placeholder from image fields"""
    Profile = apps.get_model('userauths', 'Profile')
    Admin = apps.get_model('userauths', 'Admin')
    
    # Clean Profile images
    invalid_profiles = Profile.objects.filter(image='default-user.jpg')
    count_profiles = invalid_profiles.count()
    invalid_profiles.update(image='')
    print(f"Cleaned {count_profiles} Profile records with invalid image defaults")
    
    # Clean Admin images
    invalid_admins = Admin.objects.filter(image='default-user.jpg')
    count_admins = invalid_admins.count()
    invalid_admins.update(image='')
    print(f"Cleaned {count_admins} Admin records with invalid image defaults")


def reverse_clean(apps, schema_editor):
    """Reverse operation - restore default-user.jpg (not recommended)"""
    pass  # We don't want to restore invalid data


class Migration(migrations.Migration):

    dependencies = [
        ('userauths', '0002_alter_admin_image_alter_profile_image'),
    ]

    operations = [
        migrations.RunPython(clean_invalid_images, reverse_clean),
    ]
