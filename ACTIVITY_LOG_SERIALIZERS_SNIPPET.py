# ActivityLog Serializers - To be appended to serializer.py

# ==================== PHASE 53: ACTIVITY LOG SERIALIZERS ====================

class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializer for ActivityLog with related object details"""
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    role_display = serializers.CharField(source='get_role_at_time_display', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True, allow_null=True)
    lesson_title = serializers.CharField(source='lesson.title', read_only=True, allow_null=True)
    quiz_title = serializers.CharField(source='quiz.title', read_only=True, allow_null=True)
    
    class Meta:
        model = api_models.ActivityLog
        fields = [
            'id', 'user', 'user_name', 'activity_type', 'activity_type_display',
            'role_at_time', 'role_display', 'course', 'course_title',
            'lesson', 'lesson_title', 'quiz', 'quiz_title',
            'title', 'description', 'metadata', 'duration_seconds',
            'points_awarded', 'success', 'is_verified', 'activity_score',
            'created_at', 'updated_at', 'activity_date', 'related_content_id'
        ]
        read_only_fields = [
            'id', 'user_name', 'course_title', 'lesson_title', 'quiz_title',
            'activity_type_display', 'role_display', 'activity_score',
            'created_at', 'updated_at'
        ]


class ActivityLogListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for activity list views (Dashboard)"""
    activity_type_display = serializers.CharField(source='get_activity_type_display', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    
    class Meta:
        model = api_models.ActivityLog
        fields = [
            'id', 'user_name', 'activity_type', 'activity_type_display',
            'title', 'points_awarded', 'success', 'activity_score',
            'activity_date'
        ]


class ActivityFilterSerializer(serializers.ModelSerializer):
    """Serializer for ActivityFilter user preferences"""
    
    class Meta:
        model = api_models.ActivityFilter
        fields = [
            'id', 'user', 'activity_types', 'include_system_activities',
            'include_failed_activities', 'max_activities_display',
            'sort_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class ActivityAggregateSerializer(serializers.ModelSerializer):
    """Serializer for ActivityAggregate analytics data"""
    
    class Meta:
        model = api_models.ActivityAggregate
        fields = [
            'id', 'date', 'period', 'user', 'course',
            'activity_type', 'count', 'total_points',
            'total_duration_seconds', 'success_rate', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']
