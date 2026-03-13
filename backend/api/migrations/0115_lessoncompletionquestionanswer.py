# Generated migration for PHASE 11.198: Student answer storage for lesson completion questions

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("api", "0114_videoprogress_is_fully_watched"),
    ]

    operations = [
        migrations.CreateModel(
            name='LessonCompletionQuestionAnswer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('answer_text', models.TextField(blank=True, null=True)),
                ('is_correct', models.BooleanField(default=False)),
                ('answered_at', models.DateTimeField(auto_now_add=True)),
                ('answer_choice', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.lessoncompletionquestionchoice')),
                ('answer_choices', models.ManyToManyField(blank=True, to='api.lessoncompletionquestionchoice')),
                ('question', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.lessoncompletionquestion')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-answered_at'],
            },
        ),
    ]
