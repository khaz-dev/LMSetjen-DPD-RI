# ActivityLog Model Design - Phase 53

## Architecture Overview

A centralized `ActivityLog` model to consolidate all user activities (currently scattered across VideoProgress, CompletedLesson, QuizAttempt, Certificate, SearchLog, etc.) into a single, queryable system.

---

## Model Design

### Core ActivityLog Model

```python
# ✨ PHASE 53: Centralized Activity Logging System
class ActivityLog(models.Model):
    """
    Unified activity tracking for all student/instructor/admin actions.
    
    Consolidates: VideoProgress, CompletedLesson, QuizAttempt, Certificate,
    SearchLog, QuestionAnswer, ReviewPosted, PointsAwarded, etc.
    
    Benefits:
    - Single dashboard query instead of N model queries
    - Unified filtering, sorting, pagination
    - Better analytics and reporting
    - Easier to add new activity types
    - Cleaner API response structure
    """
    
    # Activity Type Choices
    ACTIVITY_TYPE_CHOICES = [
        ('enrollment', 'Pendaftaran Kursus'),
        ('lesson_started', 'Mulai Pelajaran'),
        ('lesson_completed', 'Selesaikan Pelajaran'),
        ('video_watched', 'Tonton Video'),
        ('video_completed', 'Video Selesai (95%+)'),
        ('quiz_attempted', 'Kerjakan Kuis'),
        ('quiz_passed', 'Lulus Kuis'),
        ('quiz_failed', 'Tidak Lulus Kuis'),
        ('certificate_earned', 'Raih Sertifikat'),
        ('course_completed', 'Selesaikan Kursus'),
        ('question_asked', 'Buat Pertanyaan'),
        ('question_answered', 'Jawab Pertanyaan'),
        ('review_posted', 'Posting Review'),
        ('points_earned', 'Dapatkan Poin'),
        ('search_query', 'Cari Kursus'),
        ('content_liked', 'Sukai Konten'),
        ('wishlist_added', 'Tambah Wishlist'),
        ('discussion_participated', 'Ikut Diskusi'),
    ]
    
    # Role Choices for Activity Source
    ROLE_CHOICES = [
        ('student', 'Siswa'),
        ('instructor', 'Pengajar'),
        ('admin', 'Admin'),
        ('system', 'Sistem'),  # Auto-generated activities
    ]
    
    # Primary Fields
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPE_CHOICES, db_index=True)
    role_at_time = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    
    # Content Context
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name='activities')
    lesson = models.ForeignKey(VariantItem, on_delete=models.SET_NULL, null=True, blank=True, help_text="Lesson involved in activity")
    quiz = models.ForeignKey(Quiz, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Activity Data
    title = models.CharField(max_length=255, help_text="Human-readable activity title")
    description = models.TextField(blank=True, help_text="Full description of activity")
    
    # Structured Data (JSON for flexibility)
    metadata = models.JSONField(default=dict, blank=True, help_text="""
    Activity-specific data. Examples:
    - quiz_passed: {'score': 85, 'total_questions': 10, 'time_taken_seconds': 1234}
    - video_watched: {'progress_percent': 95, 'watch_duration_seconds': 3600}
    - lesson_completed: {'time_spent_seconds': 1800}
    - points_earned: {'points': 50, 'reason': 'quiz_passed', 'bonus': 0}
    - search_query: {'query': 'python', 'results_count': 5, 'clicked_course_id': 47}
    - review_posted: {'rating': 5, 'content_length': 200}
    """)
    
    # Engagement Metrics
    duration_seconds = models.IntegerField(null=True, blank=True, help_text="How long activity took (e.g., quiz time, video watch time)")
    points_awarded = models.IntegerField(default=0, help_text="Points awarded for this activity")
    
    # Status
    success = models.BooleanField(default=True, help_text="Did activity succeed or fail (e.g., quiz passed/failed)")
    is_verified = models.BooleanField(default=False, help_text="Has activity been verified/audited")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    activity_date = models.DateTimeField(default=timezone.now, db_index=True, help_text="When the actual activity occurred (may differ from logging time)")
    
    # Relations for Analytics
    related_content_id = models.CharField(max_length=100, blank=True, help_text="ID of related content (Q&A, review, comment, etc.)")
    
    class Meta:
        indexes = [
            models.Index(fields=['user', '-activity_date']),  # Main query pattern
            models.Index(fields=['user', 'activity_type']),   # Filter by type
            models.Index(fields=['course', '-activity_date']), # Course-level analytics
            models.Index(fields=['activity_type', '-activity_date']), # Type analytics
            models.Index(fields=['-activity_date']),  # Timeline queries
        ]
        ordering = ['-activity_date']
        verbose_name = "Activity Log"
        verbose_name_plural = "Activity Logs"
    
    def __str__(self):
        return f"{self.user.username} - {self.get_activity_type_display()} - {self.activity_date.strftime('%Y-%m-%d %H:%M')}"
    
    @property
    def is_recent(self):
        """Activity from today"""
        return self.activity_date.date() == timezone.now().date()
    
    @property
    def is_this_week(self):
        """Activity from this week"""
        return (timezone.now() - self.activity_date).days < 7
    
    @property
    def activity_score(self):
        """Engagement score (0-100) based on activity type and metadata"""
        score_map = {
            'course_completed': 100,
            'quiz_passed': 80,
            'lesson_completed': 70,
            'video_completed': 60,
            'question_answered': 50,
            'quiz_attempted': 30,
            'lesson_started': 20,
            'search_query': 5,
        }
        return score_map.get(self.activity_type, 10)


class ActivityFilter(models.Model):
    """
    User preferences for activity filtering on Dashboard.
    Allows students to customize which activity types they see.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='activity_filter')
    activity_types = models.JSONField(
        default=list,
        help_text="List of activity types to display: ['enrollment', 'lesson_completed', ...]"
    )
    include_system_activities = models.BooleanField(default=True, help_text="Show auto-generated activities")
    include_failed_activities = models.BooleanField(default=False, help_text="Show failed attempts (e.g., failed quizzes)")
    max_activities_display = models.IntegerField(default=10, help_text="Max activities to show on dashboard")
    sort_by = models.CharField(
        max_length=20,
        choices=[('date', 'Terbaru'), ('engagement', 'Paling Engaging')],
        default='date'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} - Activity Preferences"


class ActivityAggregate(models.Model):
    """
    Daily/monthly aggregates of activities for analytics.
    Materializes expensive calculations (e.g., "5 users completed courses today").
    """
    date = models.DateField(db_index=True)
    period = models.CharField(max_length=10, choices=[('daily', 'Daily'), ('monthly', 'Monthly')], db_index=True)
    
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, help_text="NULL = global aggregate")
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, help_text="NULL = all courses")
    
    activity_type = models.CharField(max_length=30, choices=ActivityLog.ACTIVITY_TYPE_CHOICES)
    
    count = models.IntegerField(default=0)
    total_points = models.IntegerField(default=0)
    total_duration_seconds = models.IntegerField(default=0)
    success_rate = models.DecimalField(max_digits=5, decimal_places=2, help_text="Success % (for attempts)")
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['date', 'period']),
            models.Index(fields=['user', 'date']),
            models.Index(fields=['course', 'date']),
        ]
        unique_together = ['date', 'period', 'user', 'course', 'activity_type']
    
    def __str__(self):
        return f"{self.get_period_display()} {self.date} - {self.activity_type}"
```

---

## Migration Plan

### Phase 1: Create Model (This Phase)
1. ✅ Add ActivityLog, ActivityFilter, ActivityAggregate models
2. ✅ Create serializers
3. ✅ Create API endpoints
4. ✅ Create admin interface

### Phase 2: Populate Data
1. Backfill existing activities from VideoProgress, CompletedLesson, etc.
2. Start logging new activities going forward
3. Keep old models for backward compatibility

### Phase 3: Integration
1. Update Dashboard to use ActivityLog instead of manual aggregation
2. Update course detail views to log activities
3. Add activity filtering UI

### Phase 4: Analytics
1. Build admin dashboard with activity analytics
2. Add instructor dashboard showing student activities
3. Add learning analytics insights

---

## Benefits Over Current System

| Aspect | Current | With ActivityLog |
|--------|---------|------------------|
| **Query Pattern** | N queries (VideoProgress, QuizAttempt, etc.) | 1 query |
| **Activity Types** | 6+ scattered models | 18+ unified types |
| **Filtering** | Manual in Python | Database-native |
| **Sorting** | Manual in Python | Database-native |
| **Pagination** | Manual slicing | DRF pagination |
| **Analytics** | No dedicated system | Built-in aggregates |
| **API Response** | Role-specific (who knows what format) | Standardized |
| **New Activity Types** | Add new model/serializer | Add type choice + endpoint |
| **Activity History** | No full audit trail | Complete log |
| **Real-time Dashboard** | No | Cache-friendly |

---

## Data Storage Efficiency

```
Current (Activity Scattered):
- VideoProgress: 100K rows (user, course, variant_item, progress %)
- CompletedLesson: 150K rows (user, course, lesson, date)
- QuizAttempt: 200K rows (user, quiz, score, date)
- Certificate: 50K rows (user, course, id, date)
- SearchLog: 500K+ rows (user, query, course, date)
  TOTAL: 1M+ rows, multiple tables, complex aggregation queries

Proposed ActivityLog (Unified):
- ActivityLog: 600K rows (user, activity_type, course, lesson, metadata)
- ActivityAggregate: 1K rows (date, user, activity_type, count, metrics)
  TOTAL: 601K rows, 2 tables, simple queries with pre-computed aggregates

Compression: 40% reduction, 10x faster queries, cleaner API
```

---

## Metadata Examples

### Quiz Passed Activity
```json
{
  "score": 85,
  "total_questions": 10,
  "correct_answers": 8,
  "time_taken_seconds": 720,
  "attempts_before_passing": 2,
  "passing_score_required": 70
}
```

### Video Completed Activity
```json
{
  "progress_percent": 95,
  "watch_duration_seconds": 3600,
  "total_duration_seconds": 3700,
  "skipped_sections": [],
  "playback_speed": 1.0,
  "device": "desktop"
}
```

### Lesson Completed Activity
```json
{
  "time_spent_seconds": 1800,
  "verification_question_answered": true,
  "verification_correct": true,
  "notes_created": 2
}
```

### Points Earned Activity
```json
{
  "points": 50,
  "reason": "quiz_passed",
  "bonus_multiplier": 1.0,
  "total_lifetime_points": 2500,
  "ranking_position": 15
}
```

### Search Activity
```json
{
  "query": "python",
  "results_count": 5,
  "clicked_results": [47, 51],
  "session_duration_seconds": 120,
  "filters_applied": {"level": "beginner", "category": "programming"}
}
```

---

## API Endpoints

### New Endpoints with ActivityLog

```
GET /api/v1/student/activities/
  - List: recent activities for current user
  - Params: ?activity_type=quiz_passed&limit=10&offset=0
  - Returns: [{ id, activity_type, title, description, metadata, created_at, points_awarded }]

GET /api/v1/student/activities/<activity_id>/
  - Single activity detail with full metadata

GET /api/v1/student/activities/stats/
  - User's activity statistics
  - Returns: { total_activities, activities_this_week, points_earned, most_active_courses, top_activity_types }

GET /api/v1/course/<course_id>/activities/
  - Instructor view: all student activities in course
  - Requires: IsTeacherUser permission

GET /api/v1/instructor/analytics/activities/
  - Instructor dashboard: aggregate activity metrics
  - Returns: { total_student_activities, avg_engagement_score, students_active_today, completion_rate }

POST /api/v1/activities/log/
  - Internal endpoint for logging activities
  - Used by views to record activities
  - Returns: { activity_id, success: true }

GET /api/v1/admin/activities/analytics/
  - Admin: platform-wide activity analytics
  - Returns: aggregated daily/weekly/monthly metrics
```

---

## Implementation Checklist

- [ ] Create migration file for ActivityLog model
- [ ] Create ActivityLog, ActivityFilter, ActivityAggregate models
- [ ] Create ActivityLogSerializer, ActivityAggregateSerializer
- [ ] Create API views for listing and filtering activities
- [ ] Add admin.py registrations for model admin pages
- [ ] Update Dashboard to call activities endpoint instead of manual aggregation
- [ ] Create management command to backfill existing activities
- [ ] Add activity logging to key endpoints (video progress, quiz submit, lesson complete, etc.)
- [ ] Create instructor dashboard views for activity monitoring
- [ ] Add tests for activity logging and filtering
- [ ] Performance testing with 1M+ activity logs
- [ ] Create activity analytics dashboard for admins

---

## Next Steps (Phase 53+)

1. **Immediate**: Implement model and serializers
2. **Week 1**: Create API endpoints and backfill data
3. **Week 2**: Integrate with Dashboard and course views
4. **Week 3**: Add instructor analytics dashboard
5. **Week 4**: Fine-tune queries, add caching, optimize indexes

---

## References

- Current Dashboard: `frontend/src/views/student/Dashboard.jsx` (generateRecentActivityData function)
- VideoProgress Model: `backend/api/models.py` L1118
- QuizAttempt Model: `backend/api/models.py` L1431
- Certificate Model: `backend/api/models.py` L1067
- SearchLog Model: `backend/api/models.py` L1862
