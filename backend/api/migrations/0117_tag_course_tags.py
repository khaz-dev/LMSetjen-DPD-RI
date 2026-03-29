# Generated migration for adding Tag model and Course tags field

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0116_activity_logging_system"),
    ]

    operations = [
        # Create Tag model
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=100)),
                ('active', models.BooleanField(default=True)),
                ('slug', models.SlugField(blank=True, max_length=200, null=True, unique=True)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                'verbose_name_plural': 'Tags',
                'ordering': ['title'],
            },
        ),
        # Add ManyToMany relationship from Course to Tag
        migrations.AddField(
            model_name='course',
            name='tags',
            field=models.ManyToManyField(blank=True, related_name='courses', to='api.tag'),
        ),
    ]
