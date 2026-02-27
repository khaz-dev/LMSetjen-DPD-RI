# Generated migration for ReviewAbuse model - PHASE 4.210

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0043_variantitem_media_source'),
    ]

    operations = [
        migrations.CreateModel(
            name='ReviewAbuse',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reason', models.CharField(choices=[('inappropriate_content', 'Konten Tidak Pantas'), ('spam', 'Spam'), ('offensive_language', 'Bahasa Kasar/Menyinggung'), ('false_information', 'Informasi Palsu'), ('harassment', 'Pelecehan'), ('other', 'Lainnya')], max_length=50)),
                ('description', models.TextField(blank=True, null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending Review'), ('reviewed', 'Reviewed'), ('dismissed', 'Dismissed'), ('action_taken', 'Action Taken')], default='pending', max_length=20)),
                ('reported_at', models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('review_notes', models.TextField(blank=True, null=True)),
                ('reported_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('review', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='abuse_reports', to='api.review')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='abuse_reviews', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('review', 'reported_by')},
            },
        ),
    ]
