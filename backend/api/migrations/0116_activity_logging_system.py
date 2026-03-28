# Generated migration for PHASE 53: Activity Logging System

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("api", "0115_lessoncompletionquestionanswer"),
    ]

    operations = [
        migrations.CreateModel(
            name='ActivityLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('activity_type', models.CharField(choices=[('enrollment', 'Pendaftaran Kursus'), ('lesson_started', 'Mulai Pelajaran'), ('lesson_completed', 'Selesaikan Pelajaran'), ('video_watched', 'Tonton Video'), ('video_completed', 'Video Selesai (95%+)'), ('quiz_attempted', 'Kerjakan Kuis'), ('quiz_passed', 'Lulus Kuis'), ('quiz_failed', 'Tidak Lulus Kuis'), ('certificate_earned', 'Raih Sertifikat'), ('course_completed', 'Selesaikan Kursus'), ('question_asked', 'Buat Pertanyaan'), ('question_answered', 'Jawab Pertanyaan'), ('review_posted', 'Posting Review'), ('points_earned', 'Dapatkan Poin'), ('search_query', 'Cari Kursus'), ('content_liked', 'Sukai Konten'), ('wishlist_added', 'Tambah Wishlist'), ('discussion_participated', 'Ikut Diskusi')], db_index=True, max_length=30)),
                ('role_at_time', models.CharField(choices=[('student', 'Siswa'), ('instructor', 'Pengajar'), ('admin', 'Admin'), ('system', 'Sistem')], default='student', max_length=20)),
                ('title', models.CharField(help_text='Human-readable activity title', max_length=255)),
                ('description', models.TextField(blank=True, help_text='Full description of activity')),
                ('metadata', models.JSONField(blank=True, default=dict, help_text='Activity-specific data')),
                ('duration_seconds', models.IntegerField(blank=True, help_text='How long activity took', null=True)),
                ('points_awarded', models.IntegerField(default=0, help_text='Points awarded for this activity')),
                ('success', models.BooleanField(default=True, help_text='Did activity succeed or fail')),
                ('is_verified', models.BooleanField(default=False, help_text='Has activity been verified')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('activity_date', models.DateTimeField(db_index=True, default=django.utils.timezone.now, help_text='When activity occurred')),
                ('related_content_id', models.CharField(blank=True, help_text='ID of related content', max_length=100)),
                ('course', models.ForeignKey(blank=True, help_text='Course involved in activity', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='activity_logs', to='api.course')),
                ('lesson', models.ForeignKey(blank=True, help_text='Lesson involved in activity', null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.variantitem')),
                ('quiz', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.quiz')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='activities', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'api_activitylog',
                'ordering': ['-activity_date'],
                'indexes': [
                    models.Index(fields=['user', '-activity_date'], name='api_activi_user_id_act_idx'),
                    models.Index(fields=['user', 'activity_type'], name='api_activi_user_id_act_type_idx'),
                    models.Index(fields=['course', '-activity_date'], name='api_activi_course_act_date_idx'),
                    models.Index(fields=['activity_type', '-activity_date'], name='api_activi_act_type_date_idx'),
                    models.Index(fields=['-activity_date'], name='api_activi_act_date_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='ActivityFilter',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('activity_types', models.JSONField(blank=True, default=list, help_text='Selected activity types to track')),
                ('include_system_activities', models.BooleanField(default=True, help_text='Include system-initiated activities')),
                ('include_failed_activities', models.BooleanField(default=False, help_text='Include failed activities')),
                ('max_activities_display', models.IntegerField(default=20, help_text='Max activities to show')),
                ('sort_by', models.CharField(choices=[('recent', 'Most Recent'), ('points', 'Points Earned'), ('type', 'Activity Type')], default='recent', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='activity_filter_prefs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'api_activityfilter',
            },
        ),
        migrations.CreateModel(
            name='ActivityAggregate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(db_index=True)),
                ('period', models.CharField(choices=[('daily', 'Daily'), ('monthly', 'Monthly')], db_index=True, max_length=10)),
                ('activity_type', models.CharField(choices=[('enrollment', 'Pendaftaran Kursus'), ('lesson_started', 'Mulai Pelajaran'), ('lesson_completed', 'Selesaikan Pelajaran'), ('video_watched', 'Tonton Video'), ('video_completed', 'Video Selesai (95%+)'), ('quiz_attempted', 'Kerjakan Kuis'), ('quiz_passed', 'Lulus Kuis'), ('quiz_failed', 'Tidak Lulus Kuis'), ('certificate_earned', 'Raih Sertifikat'), ('course_completed', 'Selesaikan Kursus'), ('question_asked', 'Buat Pertanyaan'), ('question_answered', 'Jawab Pertanyaan'), ('review_posted', 'Posting Review'), ('points_earned', 'Dapatkan Poin'), ('search_query', 'Cari Kursus'), ('content_liked', 'Sukai Konten'), ('wishlist_added', 'Tambah Wishlist'), ('discussion_participated', 'Ikut Diskusi')], max_length=30)),
                ('count', models.IntegerField(default=0)),
                ('total_points', models.IntegerField(default=0)),
                ('total_duration_seconds', models.IntegerField(default=0)),
                ('success_rate', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('course', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.course')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'api_activityaggregate',
                'indexes': [
                    models.Index(fields=['date', 'period'], name='api_activi_date_period_idx'),
                    models.Index(fields=['user', 'date'], name='api_activi_user_date_idx'),
                    models.Index(fields=['course', 'date'], name='api_activi_course_date_idx'),
                ],
                'unique_together': {('date', 'period', 'user', 'course', 'activity_type')},
            },
        ),
    ]
