# ==================== PHASE 53: ACTIVITY LOG API VIEWS ====================

class StudentActivityListAPIView(generics.ListAPIView):
    """
    PHASE 53: List activities for the current student
    
    GET /api/v1/student/activities/
    """
    serializer_class = api_serializer.ActivityLogListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination
    
    def get_queryset(self):
        """Filter activities for current user"""
        queryset = api_models.ActivityLog.objects.filter(user=self.request.user)
        
        # Filter by activity type
        activity_type = self.request.query_params.get('activity_type')
        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)
        
        # Filter by course
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        
        # Filter by success status
        success = self.request.query_params.get('success')
        if success:
            queryset = queryset.filter(success=success.lower() == 'true')
        
        return queryset.order_by('-activity_date')


class StudentActivityDetailAPIView(generics.RetrieveAPIView):
    """
    PHASE 53: Get detailed information about a specific activity
    
    GET /api/v1/student/activities/<activity_id>/
    """
    serializer_class = api_serializer.ActivityLogSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Only allow users to view their own activities"""
        return api_models.ActivityLog.objects.filter(user=self.request.user)


class StudentActivityStatsAPIView(APIView):
    """
    PHASE 53: Get activity statistics summary for current student
    
    GET /api/v1/student/activities/stats/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        now = timezone.now()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        
        # Get all activities
        all_activities = api_models.ActivityLog.objects.filter(user=user)
        
        # Calculate statistics
        total_activities = all_activities.count()
        activities_this_week = all_activities.filter(activity_date__gte=week_ago).count()
        activities_this_month = all_activities.filter(activity_date__gte=month_ago).count()
        points_earned = all_activities.aggregate(Sum('points_awarded'))['points_awarded__sum'] or 0
        
        # Get most active course
        most_active_course = None
        most_active_count = 0
        course_activities = all_activities.values('course').annotate(
            count=Count('id')
        ).order_by('-count').first()
        
        if course_activities:
            try:
                most_active_course = api_models.Course.objects.get(id=course_activities['course'])
                most_active_count = course_activities['count']
            except:
                pass
        
        # Get top activity types
        top_activity_types = list(
            all_activities.values('activity_type').annotate(
                count=Count('id')
            ).order_by('-count')[:5]
        )
        
        # Add display names
        for activity in top_activity_types:
            choices_dict = dict(api_models.ActivityLog.ACTIVITY_TYPE_CHOICES)
            activity['display'] = choices_dict.get(activity['activity_type'], activity['activity_type'])
        
        # Get recent activities
        recent_activities = api_models.ActivityLog.objects.filter(user=user).order_by('-activity_date')[:10]
        
        data = {
            'total_activities': total_activities,
            'activities_this_week': activities_this_week,
            'activities_this_month': activities_this_month,
            'points_earned': points_earned,
            'most_active_course': most_active_course,
            'course_activity_count': most_active_count,
            'top_activity_types': top_activity_types,
            'recent_activities': recent_activities
        }
        
        serializer = api_serializer.ActivityStatsSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class InstructorCourseActivitiesAPIView(generics.ListAPIView):
    """
    PHASE 53: List all student activities in a course (instructor only)
    
    GET /api/v1/instructor/course/<course_id>/activities/
    """
    serializer_class = api_serializer.ActivityLogListSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination
    
    def get_queryset(self):
        """Get activities for students in instructor's course"""
        course_id = self.kwargs.get('course_id')
        
        # Get only activities for this course
        queryset = api_models.ActivityLog.objects.filter(course_id=course_id)
        
        # Filter by activity type
        activity_type = self.request.query_params.get('activity_type')
        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)
        
        # Filter by specific student
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        return queryset.order_by('-activity_date')


class InstructorActivityAnalyticsAPIView(APIView):
    """
    PHASE 53: Get activity analytics for instructor dashboard
    
    GET /api/v1/instructor/activities/analytics/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Verify user is instructor
        if not (user.role in ['instructor', 'teacher'] or getattr(user, 'is_instructor', False)):
            return Response({
                'error': 'Only instructors can access activity analytics'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get all courses taught by this instructor
        courses = api_models.Course.objects.filter(teacher__user=user)
        
        # Get activities for all courses taught
        all_activities = api_models.ActivityLog.objects.filter(course__in=courses)
        
        now = timezone.now()
        week_ago = now - timedelta(days=7)
        today = now.date()
        
        # Calculate overall stats
        total_student_activities = all_activities.count()
        activities_this_week = all_activities.filter(activity_date__gte=week_ago).count()
        
        # Average engagement score
        avg_engagement = all_activities.aggregate(
            avg=Avg('activity_score')
        )['avg'] or 0
        
        # Students active today
        students_active_today = all_activities.filter(
            activity_date__date=today
        ).values('user').distinct().count()
        
        # Completion rate (% of lessons/quizzes completed)
        total_completion_activities = all_activities.filter(
            activity_type__in=['lesson_completed', 'quiz_passed', 'course_completed']
        ).count()
        completion_rate = (total_completion_activities / total_student_activities * 100) if total_student_activities > 0 else 0
        
        # Course breakdown
        course_breakdown = []
        for course in courses:
            course_activities = all_activities.filter(course=course)
            enrollments = api_models.StudentCourseEnrollment.objects.filter(course=course)
            enrolled_count = enrollments.count()
            active_students = course_activities.values('user').distinct().count()
            
            course_avg_engagement = course_activities.aggregate(
                avg=Avg('activity_score')
            )['avg'] or 0
            
            course_breakdown.append({
                'course_id': course.id,
                'course_title': course.title,
                'total_activities': course_activities.count(),
                'enrolled_students': enrolled_count,
                'active_students': active_students,
                'avg_engagement': round(course_avg_engagement, 2)
            })
        
        # Recent student activities
        recent_activities = all_activities.order_by('-activity_date')[:10]
        
        data = {
            'total_student_activities': total_student_activities,
            'activities_this_week': activities_this_week,
            'avg_engagement_score': round(avg_engagement, 2),
            'students_active_today': students_active_today,
            'completion_rate': round(completion_rate, 2),
            'course_activity_breakdown': course_breakdown,
            'recent_student_activities': recent_activities
        }
        
        serializer = api_serializer.InstructorActivityStatsSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminActivityAnalyticsAPIView(APIView):
    """
    PHASE 53: Get platform-wide activity analytics (admin only)
    
    GET /api/v1/admin/activities/analytics/
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        period = request.query_params.get('period', 'daily')
        days = int(request.query_params.get('days', 30))
        
        cutoff_date = timezone.now() - timedelta(days=days)
        all_activities = api_models.ActivityLog.objects.filter(
            activity_date__gte=cutoff_date
        )
        
        now = timezone.now().date()
        today_activities = all_activities.filter(activity_date__date=now)
        
        # Overall stats
        total_activities = all_activities.count()
        total_users = all_activities.values('user').distinct().count()
        active_users_today = today_activities.values('user').distinct().count()
        avg_engagement = all_activities.aggregate(
            avg=Avg('activity_score')
        )['avg'] or 0
        
        # Daily metrics
        daily_metrics = []
        for i in range(days):
            date = (timezone.now() - timedelta(days=i)).date()
            day_activities = all_activities.filter(activity_date__date=date)
            day_count = day_activities.count()
            day_users = day_activities.values('user').distinct().count()
            day_engagement = day_activities.aggregate(
                avg=Avg('activity_score')
            )['avg'] or 0
            
            if day_count > 0:  # Only include days with activities
                daily_metrics.append({
                    'date': str(date),
                    'activity_count': day_count,
                    'unique_users': day_users,
                    'avg_engagement': round(day_engagement, 2)
                })
        
        # Activity type breakdown
        activity_breakdown = []
        activity_type_counts = all_activities.values('activity_type').annotate(
            count=Count('id')
        ).order_by('-count')
        
        for activity in activity_type_counts:
            choices_dict = dict(api_models.ActivityLog.ACTIVITY_TYPE_CHOICES)
            percentage = (activity['count'] / total_activities * 100) if total_activities > 0 else 0
            activity_breakdown.append({
                'activity_type': activity['activity_type'],
                'count': activity['count'],
                'percentage': round(percentage, 2),
                'display': choices_dict.get(activity['activity_type'], activity['activity_type'])
            })
        
        # Top courses by activity
        top_courses = all_activities.values('course__id', 'course__title').annotate(
            activity_count=Count('id'),
            unique_students=Count('user', distinct=True)
        ).order_by('-activity_count')[:10]
        
        top_courses_list = []
        for course_data in top_courses:
            if course_data['course__id']:
                top_courses_list.append({
                    'course_id': course_data['course__id'],
                    'course_title': course_data['course__title'],
                    'activity_count': course_data['activity_count'],
                    'unique_students': course_data['unique_students']
                })
        
        data = {
            'period': period,
            'total_activities': total_activities,
            'total_users': total_users,
            'active_users_today': active_users_today,
            'avg_engagement_score': round(avg_engagement, 2),
            'daily_metrics': daily_metrics,
            'activity_type_breakdown': activity_breakdown,
            'top_courses_by_activity': top_courses_list
        }
        
        return Response(data, status=status.HTTP_200_OK)


class ActivityFilterPreferencesAPIView(APIView):
    """
    PHASE 53: Get/update user's activity filter preferences
    
    GET /api/v1/student/activity-filter/
    - Get current user's activity filter preferences
    
    PUT /api/v1/student/activity-filter/
    - Update activity filter preferences
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get user's activity filter preferences"""
        try:
            activity_filter = api_models.ActivityFilter.objects.get(user=request.user)
            serializer = api_serializer.ActivityFilterSerializer(activity_filter)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except api_models.ActivityFilter.DoesNotExist:
            # Create default if doesn't exist
            activity_filter = api_models.ActivityFilter.objects.create(
                user=request.user,
                activity_types=[],
                include_system_activities=True,
                include_failed_activities=False,
                max_activities_display=10,
                sort_by='date'
            )
            serializer = api_serializer.ActivityFilterSerializer(activity_filter)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def put(self, request):
        """Update user's activity filter preferences"""
        try:
            activity_filter = api_models.ActivityFilter.objects.get(user=request.user)
        except api_models.ActivityFilter.DoesNotExist:
            activity_filter = api_models.ActivityFilter.objects.create(user=request.user)
        
        serializer = api_serializer.ActivityFilterSerializer(
            activity_filter, data=request.data, partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
