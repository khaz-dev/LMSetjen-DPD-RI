from django.contrib import admin
from api import models 

admin.site.register(models.Teacher)
admin.site.register(models.Category)

# ✨ PHASE 4.76: Custom Course Admin to distinguish draft vs published versions
class CourseAdmin(admin.ModelAdmin):
    """Admin interface for Course model with versioning support"""
    list_display = (
        'title_with_status',  # Custom method to show title + status
        'get_course_type',    # Shows "PUBLISHED" or "DRAFT"
        'teacher',
        'platform_status',
        'get_parent_course',  # Shows if this is a revision of another course
        'is_published_version',
        'date'
    )
    list_filter = ('is_published_version', 'platform_status', 'teacher', 'category', 'date')
    search_fields = ('title', 'teacher__user__first_name', 'course_id')
    readonly_fields = ('course_id', 'slug', 'search_vector', 'is_published_version', 'parent_course', 'published_snapshot')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'description', 'course_id', 'slug', 'teacher', 'category', 'level')
        }),
        ('Media', {
            'fields': ('image', 'file')  # ✨ PHASE X.X: Removed intro_video_source (upload-only system)
        }),
        ('✨ Versioning & Status', {
            'fields': ('is_published_version', 'parent_course', 'platform_status', 'teacher_course_status'),
            'description': 'is_published_version=True: This is the published copy (student-facing). parent_course=not empty: This is a draft revision of a published course.'
        }),
        ('Approval & Publishing', {
            'fields': ('approval_date', 'approved_by', 'review_submitted_date', 'rejection_reason', 'published_snapshot'),
            'classes': ('collapse',)
        }),
        ('Meta', {
            'fields': ('featured', 'date', 'search_vector'),
            'classes': ('collapse',)
        })
    )
    
    ordering = ('-date',)
    
    def title_with_status(self, obj):
        """Display title with inline status indicator"""
        if obj.is_published_version:
            return f"{obj.title} [PUBLISHED ✓]"
        elif obj.parent_course:
            return f"{obj.title} [DRAFT - Editing Published ✎]"
        else:
            return f"{obj.title} [DRAFT]"
    title_with_status.short_description = "Course Title"
    
    def get_course_type(self, obj):
        """Show whether this is PUBLISHED or DRAFT"""
        if obj.is_published_version:
            return "✓ PUBLISHED"
        elif obj.parent_course:
            return "✎ DRAFT (Editing)"
        else:
            return "📝 DRAFT"
    get_course_type.short_description = "Type"
    
    def get_parent_course(self, obj):
        """Show parent course if this is a revision"""
        if obj.parent_course:
            return f"{obj.parent_course.title} (ID: {obj.parent_course.id})"
        return "—"
    get_parent_course.short_description = "Parent Course (Revision of)"

admin.site.register(models.Course, CourseAdmin)
# ==================== CURRICULUM MANAGEMENT ====================
class VariantAdmin(admin.ModelAdmin):
    """Admin interface for Bagian (Sections/Variants)"""
    list_display = ('title', 'course', 'order', 'date')
    search_fields = ('title', 'course__title')
    list_filter = ('course', 'date')
    ordering = ('-date',)

class VariantItemAdmin(admin.ModelAdmin):
    """Admin interface for Pelajaran (Lessons/Variant Items)"""
    list_display = ('title', 'variant', 'duration', 'preview', 'order', 'date')  # ✨ PHASE X.X: Removed media_source (upload-only system)
    search_fields = ('title', 'variant__title', 'variant__course__title')
    list_filter = ('variant__course', 'preview', 'date')
    ordering = ('-date',)
    
    fieldsets = (
        ('Informasi Pelajaran', {
            'fields': ('variant', 'title', 'description', 'preview', 'order'),
        }),
        ('File Media', {
            'fields': ('file',),  # ✨ PHASE X.X: Removed media_source (upload-only system)
            'description': '✨ Masukkan URL file (video, PDF, atau dokumen lainnya). Durasi akan otomatis dihitung ketika file diunggah.',
        }),
        ('Durasi Video', {
            'fields': ('duration',),
            'description': '⏱️ Durasi otomatis dikosongkan ketika field File dikosongkan. Jangan isi field ini secara manual - biarkan sistem otomatis menghitung durasi saat file diunggah.',
        }),
        ('Metadata', {
            'fields': ('variant_item_id', 'date'),
            'classes': ('collapse',),
        }),
    )
    
    def get_readonly_fields(self, request, obj=None):
        """Make ID and date read-only"""
        if obj:  # Editing existing object
            return self.readonly_fields + ('variant_item_id', 'date')
        return self.readonly_fields

admin.site.register(models.Variant, VariantAdmin)
admin.site.register(models.VariantItem, VariantItemAdmin)
admin.site.register(models.Question_Answer)
admin.site.register(models.Question_Answer_Message)

# ✨ PHASE 7.16: Q&A Report System Admin
class QuestionAnswerReportAdmin(admin.ModelAdmin):
    """Admin interface for Q&A report management"""
    list_display = ('id', 'qa_id', 'reported_by_name', 'reason', 'status', 'reported_at', 'reviewed_at', 'reviewed_by_name')
    list_filter = ('status', 'reason', 'reported_at', 'reviewed_at')
    search_fields = ('question__qa_id', 'reported_by__user__first_name', 'reported_by__user__last_name', 'reason', 'description')
    readonly_fields = ('question', 'reported_by', 'reported_at')
    
    fieldsets = (
        ('Report Information', {
            'fields': ('question', 'reported_by', 'reported_at', 'reason', 'description')
        }),
        ('Review Status', {
            'fields': ('status', 'reviewed_by', 'reviewed_at', 'review_notes')
        })
    )
    
    ordering = ('-reported_at',)
    
    def qa_id(self, obj):
        """Display the Q&A ID for easier identification"""
        return obj.question.qa_id if obj.question else '-'
    qa_id.short_description = 'Q&A ID'
    
    def reported_by_name(self, obj):
        """Display the name of the person who reported"""
        if obj.reported_by and hasattr(obj.reported_by, 'get_full_name'):
            return obj.reported_by.get_full_name() or obj.reported_by.username
        return '-'
    reported_by_name.short_description = 'Reported By'
    
    def reviewed_by_name(self, obj):
        """Display the name of the admin who reviewed"""
        if obj.reviewed_by and hasattr(obj.reviewed_by, 'get_full_name'):
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return '-'
    reviewed_by_name.short_description = 'Reviewed By'

class QuestionAnswerMessageReportAdmin(admin.ModelAdmin):
    """Admin interface for Q&A message report management"""
    list_display = ('id', 'qa_id', 'reported_by_name', 'reason', 'status', 'reported_at', 'reviewed_at', 'reviewed_by_name')
    list_filter = ('status', 'reason', 'reported_at', 'reviewed_at')
    search_fields = ('message__qa_id', 'reported_by__user__first_name', 'reported_by__user__last_name', 'reason', 'description')
    readonly_fields = ('message', 'reported_by', 'reported_at')
    
    fieldsets = (
        ('Report Information', {
            'fields': ('message', 'reported_by', 'reported_at', 'reason', 'description')
        }),
        ('Review Status', {
            'fields': ('status', 'reviewed_by', 'reviewed_at', 'review_notes')
        })
    )
    
    ordering = ('-reported_at',)
    
    def qa_id(self, obj):
        """Display the Q&A message ID for easier identification"""
        return obj.message.qa_id if obj.message else '-'
    qa_id.short_description = 'Message QA ID'
    
    def reported_by_name(self, obj):
        """Display the name of the person who reported"""
        if obj.reported_by and hasattr(obj.reported_by, 'get_full_name'):
            return obj.reported_by.get_full_name() or obj.reported_by.username
        return '-'
    reported_by_name.short_description = 'Reported By'
    
    def reviewed_by_name(self, obj):
        """Display the name of the admin who reviewed"""
        if obj.reviewed_by and hasattr(obj.reviewed_by, 'get_full_name'):
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return '-'
    reviewed_by_name.short_description = 'Reviewed By'

admin.site.register(models.Question_Answer_Report, QuestionAnswerReportAdmin)
admin.site.register(models.Question_Answer_Message_Report, QuestionAnswerMessageReportAdmin)

# ✨ PHASE 7.16: Q&A Like System
admin.site.register(models.Question_Answer_Like)
admin.site.register(models.Question_Answer_Message_Like)

admin.site.register(models.Certificate)
admin.site.register(models.CompletedLesson)
admin.site.register(models.VideoProgress)
admin.site.register(models.EnrolledCourse)
admin.site.register(models.Note)
admin.site.register(models.Review)
admin.site.register(models.Notification)
admin.site.register(models.Wishlist)
admin.site.register(models.Country)

# Quiz System
admin.site.register(models.Quiz)
admin.site.register(models.QuizQuestion)
admin.site.register(models.QuizChoice)
admin.site.register(models.QuizAttempt)

# Course Detail Enhancements
admin.site.register(models.CourseFeature)
admin.site.register(models.CourseRequirement)
admin.site.register(models.CourseLearningOutcome)
admin.site.register(models.CourseResource)
admin.site.register(models.TeacherExpertise)

# ✨ PHASE 3-4: Search and Analytics
admin.site.register(models.SearchAnalytics)
admin.site.register(models.SearchLog)
admin.site.register(models.CourseSearchAnalytics)

# ✨ TIER 1: Quick Wins (Content Gap, At-Risk, Recommendations)
admin.site.register(models.ContentGap)
admin.site.register(models.StudentRiskAssessment)
admin.site.register(models.CourseRecommendation)

# ✨ TIER 2: Core Features (Performance, Learning Paths, Churn)
admin.site.register(models.InstructorPerformance)
admin.site.register(models.LearningPath)
admin.site.register(models.ChurnPrediction)

# ✨ TIER 3: Optimizations (Intent Classification, Quiz Calibration)
admin.site.register(models.SearchIntent)
admin.site.register(models.QuizMetrics)

# ✨ PHASE 4.143: Lesson Completion Question System
admin.site.register(models.LessonCompletionQuestion)
admin.site.register(models.LessonCompletionQuestionChoice)
# ✨ PHASE 11.198: Student answers to completion questions
admin.site.register(models.LessonCompletionQuestionAnswer)

# ✨ PHASE 4.210: Review Abuse Reporting System
class ReviewAbuseAdmin(admin.ModelAdmin):
    """Admin interface for managing review abuse reports"""
    list_display = ('id', 'review_id', 'reported_by_name', 'reason', 'status', 'reported_at', 'reviewed_at')
    list_filter = ('status', 'reason', 'reported_at', 'reviewed_at')
    search_fields = ('review__id', 'reported_by__user__first_name', 'reported_by__user__last_name', 'reason', 'description')
    readonly_fields = ('review', 'reported_by', 'reported_at', 'reviewed_at')
    
    fieldsets = (
        ('Report Information', {
            'fields': ('review', 'reported_by', 'reported_at', 'reason', 'description')
        }),
        ('Review Status', {
            'fields': ('status', 'reviewed_by', 'reviewed_at', 'review_notes')
        })
    )
    
    ordering = ('-reported_at',)
    
    def review_id(self, obj):
        """Display review ID for easier identification"""
        return obj.review.id if obj.review else '-'
    review_id.short_description = 'Review ID'
    
    def reported_by_name(self, obj):
        """Display the name of the person who reported"""
        return obj.reported_by.get_full_name() if obj.reported_by else '-'
    reported_by_name.short_description = 'Reported By'

# ✨ PHASE 10.1: Ranking System Admin
# NOTE: StudentPoints, InstructorPoints, and PointsAuditLog models not currently implemented
# These admin classes are kept for future implementation when the models are added to models.py
# 
class StudentPointsAdmin(admin.ModelAdmin):
    """
    Admin interface for StudentPoints ranking system.
    
    Points are automatically awarded via Django signals when:
    - Course completion: 100 points
    - Quiz passed: 0-100 points (based on score %)
    - Course rating given: 50 points
    
    NOTE: Removed 'Role' column (it was just current_role, misleading since users
    can have multiple roles). View PointsAuditLog to see which activities earned points.
    """
    list_display = (
        'get_full_name', 
        'lifetime_points', 'yearly_points', 'monthly_points',
        'yearly_year', 'monthly_month',
        'created_at'
    )
    list_filter = ('lifetime_points', 'yearly_year', 'monthly_month', 'created_at')
    search_fields = ('user__full_name', 'user__email', 'user__username')
    readonly_fields = ('created_at', 'lifetime_updated', 'yearly_updated', 'monthly_updated')
    
    fieldsets = (
        ('Student Information', {
            'fields': ('user',)
        }),
        ('Lifetime Points', {
            'fields': ('lifetime_points', 'lifetime_updated')
        }),
        ('Yearly Points', {
            'fields': ('yearly_points', 'yearly_year', 'yearly_updated')
        }),
        ('Monthly Points', {
            'fields': ('monthly_points', 'monthly_year', 'monthly_month', 'monthly_updated')
        }),
        ('Meta', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        })
    )
    
    ordering = ('-lifetime_points',)
    
    def get_full_name(self, obj):
        return obj.user.full_name if obj.user else '-'
    get_full_name.short_description = 'Student Name'


class InstructorPointsAdmin(admin.ModelAdmin):
    """
    Admin interface for InstructorPoints ranking system.
    
    Points are automatically awarded via Django signals when:
    - Course published: 50 points
    - Student enrollment: 10 points per student
    - Rating received: 10-50 points per rating
    
    NOTE: Removed 'Role' column (it was just current_role, misleading). 
    View PointsAuditLog to see which activities earned points.
    """
    list_display = (
        'get_full_name',
        'lifetime_points', 'yearly_points', 'monthly_points',
        'yearly_year', 'monthly_month',
        'created_at'
    )
    list_filter = ('lifetime_points', 'yearly_year', 'monthly_month', 'created_at')
    search_fields = ('user__full_name', 'user__email', 'user__username')
    readonly_fields = ('created_at', 'lifetime_updated', 'yearly_updated', 'monthly_updated')
    
    fieldsets = (
        ('Instructor Information', {
            'fields': ('user',)
        }),
        ('Lifetime Points', {
            'fields': ('lifetime_points', 'lifetime_updated')
        }),
        ('Yearly Points', {
            'fields': ('yearly_points', 'yearly_year', 'yearly_updated')
        }),
        ('Monthly Points', {
            'fields': ('monthly_points', 'monthly_year', 'monthly_month', 'monthly_updated')
        }),
        ('Meta', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        })
    )
    
    ordering = ('-lifetime_points',)
    
    def get_full_name(self, obj):
        return obj.user.full_name if obj.user else '-'
    get_full_name.short_description = 'Instructor Name'


class PointsAuditLogAdmin(admin.ModelAdmin):
    """
    ✨ PHASE 10.4: Audit log for all point awards.
    
    Complete transparency - see exactly where each point came from and verify calculations.
    Use this to:
    - Audit point awards
    - Find which activities earned which points
    - Detect duplicates or errors
    - Supervise ranking point validity
    """
    list_display = (
        'get_user_name', 'points', 'category', 'role', 'created_at'
    )
    list_filter = ('category', 'role', 'created_at')
    search_fields = ('user__full_name', 'user__email')
    readonly_fields = ('user', 'points', 'category', 'role', 'metadata', 'created_at')
    
    fieldsets = (
        ('Audit Information', {
            'fields': ('user', 'points', 'category', 'role')
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('wide',)
        }),
        ('Timestamp', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        })
    )
    
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    
    def get_user_name(self, obj):
        return obj.user.full_name if obj.user else '-'
    get_user_name.short_description = 'User'


admin.site.register(models.StudentPoints, StudentPointsAdmin)
admin.site.register(models.InstructorPoints, InstructorPointsAdmin)
admin.site.register(models.PointsAuditLog, PointsAuditLogAdmin)
admin.site.register(models.ReviewAbuse, ReviewAbuseAdmin)


# ==================== PHASE 53: ACTIVITY LOG ADMIN ====================

class ActivityLogAdmin(admin.ModelAdmin):
    """Admin interface for ActivityLog - centralized activity tracking"""
    list_display = (
        'user_name', 'activity_type_display', 'course_title', 
        'points_awarded', 'success', 'activity_date'
    )
    list_filter = ('activity_type', 'role_at_time', 'success', 'activity_date', 'course')
    search_fields = ('user__full_name', 'user__email', 'course__title', 'title')
    readonly_fields = ('id', 'user', 'created_at', 'updated_at', 'activity_score')
    
    fieldsets = (
        ('Activity Information', {
            'fields': ('user', 'activity_type', 'role_at_time', 'title', 'description')
        }),
        ('Related Content', {
            'fields': ('course', 'lesson', 'quiz', 'related_content_id')
        }),
        ('Metrics', {
            'fields': ('duration_seconds', 'points_awarded', 'activity_score')
        }),
        ('Status', {
            'fields': ('success', 'is_verified', 'metadata')
        }),
        ('Timestamps', {
            'fields': ('activity_date', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    ordering = ('-activity_date',)
    date_hierarchy = 'activity_date'
    
    def user_name(self, obj):
        return obj.user.full_name if obj.user else '-'
    user_name.short_description = 'User'
    
    def activity_type_display(self, obj):
        return obj.get_activity_type_display()
    activity_type_display.short_description = 'Activity Type'
    
    def course_title(self, obj):
        return obj.course.title if obj.course else '-'
    course_title.short_description = 'Course'


class ActivityFilterAdmin(admin.ModelAdmin):
    """Admin interface for ActivityFilter - user activity preferences"""
    list_display = ('user_full_name', 'sort_by', 'max_activities_display', 'updated_at')
    list_filter = ('sort_by', 'include_system_activities', 'include_failed_activities', 'updated_at')
    search_fields = ('user__full_name', 'user__email')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Activity Type Preferences', {
            'fields': ('activity_types', 'include_system_activities', 'include_failed_activities')
        }),
        ('Display Preferences', {
            'fields': ('max_activities_display', 'sort_by')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    
    ordering = ('-updated_at',)
    
    def user_full_name(self, obj):
        return obj.user.full_name if obj.user else '-'
    user_full_name.short_description = 'User'


class ActivityAggregateAdmin(admin.ModelAdmin):
    """Admin interface for ActivityAggregate - daily/monthly analytics"""
    list_display = (
        'date', 'period', 'user_name', 'course_title', 
        'activity_type_display', 'count', 'total_points',
        'success_rate'
    )
    list_filter = ('period', 'activity_type', 'date', 'course')
    search_fields = ('user__full_name', 'course__title')
    readonly_fields = ('updated_at',)
    
    fieldsets = (
        ('Period Information', {
            'fields': ('date', 'period')
        }),
        ('Scope', {
            'fields': ('user', 'course')
        }),
        ('Activity Data', {
            'fields': ('activity_type', 'count', 'total_points', 'total_duration_seconds', 'success_rate')
        }),
        ('Metadata', {
            'fields': ('updated_at',),
            'classes': ('collapse',)
        })
    )
    
    ordering = ('-date',)
    date_hierarchy = 'date'
    
    def user_name(self, obj):
        return obj.user.full_name if obj.user else 'All Users'
    user_name.short_description = 'User'
    
    def course_title(self, obj):
        return obj.course.title if obj.course else 'All Courses'
    course_title.short_description = 'Course'
    
    def activity_type_display(self, obj):
        return obj.get_activity_type_display()
    activity_type_display.short_description = 'Activity Type'


admin.site.register(models.ActivityLog, ActivityLogAdmin)
admin.site.register(models.ActivityFilter, ActivityFilterAdmin)
admin.site.register(models.ActivityAggregate, ActivityAggregateAdmin)

