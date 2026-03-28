# Activity API Endpoints - Phase 53 Implementation

## Overview

Comprehensive activity tracking system for the LMS. Unified API for logging and analyzing user activities (lessons, videos, quizzes, certificates, etc.) across all roles.

## Implementation Summary

### 1. **Models** (Already defined in backend/api/models.py)
- `ActivityLog` - Centralized activity tracking
- `ActivityFilter` - User activity filter preferences
- `ActivityAggregate` - Daily/monthly activity analytics

### 2. **Serializers** (Added to backend/api/serializer.py)
- `ActivityLogSerializer` - Full activity details
- `ActivityLogListSerializer` - Lightweight list view
- `ActivityFilterSerializer` - User preferences
- `ActivityAggregateSerializer` - Analytics data
- `ActivityStatsSerializer` - User activity summary
- `InstructorActivityStatsSerializer` - Instructor analytics

### 3. **Views** (Added to backend/api/views.py)

#### Student Activity Endpoints
- `StudentActivityListAPIView` - List user activities
- `StudentActivityDetailAPIView` - Get specific activity details
- `StudentActivityStatsAPIView` - User activity statistics
- `ActivityFilterPreferencesAPIView` - Get/update activity preferences

#### Instructor Analytics Endpoints
- `InstructorCourseActivitiesAPIView` - List student activities in course
- `InstructorActivityAnalyticsAPIView` - Instructor dashboard analytics

#### Admin Analytics Endpoints
- `AdminActivityAnalyticsAPIView` - Platform-wide activity analytics

### 4. **Admin Interfaces** (Added to backend/api/admin.py)
- `ActivityLogAdmin` - Manage activity logs
- `ActivityFilterAdmin` - Manage user preferences
- `ActivityAggregateAdmin` - View analytics aggregates

### 5. **URL Routes** (Added to backend/api/urls.py)

## API Endpoints

### Student Endpoints

#### 1. List Student Activities
```
GET /api/v1/student/activities/
```
**Query Parameters:**
- `activity_type`: Filter by activity type (enrollment, lesson_completed, quiz_passed, etc.)
- `course_id`: Filter by specific course
- `success`: Filter by success status (true/false)
- `limit`: Results per page (default: 20)
- `offset`: Pagination offset

**Response:**
```json
{
    "count": 50,
    "next": "...",
    "previous": "...",
    "results": [
        {
            "id": 1,
            "user": 1,
            "user_name": "John Doe",
            "activity_type": "quiz_passed",
            "activity_type_display": "Lulus Kuis",
            "title": "Quiz - Advanced Django",
            "description": "Successfully completed quiz with 85% score",
            "course": 1,
            "course_title": "Django Advanced",
            "points_awarded": 50,
            "success": true,
            "activity_score": 80,
            "activity_date": "2025-03-14T10:30:00Z",
            "created_at": "2025-03-14T10:30:00Z"
        }
    ]
}
```

#### 2. Get Activity Details
```
GET /api/v1/student/activities/<activity_id>/
```

**Response:**
```json
{
    "id": 1,
    "user": 1,
    "user_name": "John Doe",
    "activity_type": "quiz_passed",
    "activity_type_display": "Lulus Kuis",
    "role_at_time": "student",
    "role_display": "Siswa",
    "course": 1,
    "course_title": "Django Advanced",
    "lesson": 5,
    "lesson_title": "Advanced Models",
    "quiz": 10,
    "quiz_title": "Models Quiz",
    "title": "Quiz - Advanced Django",
    "description": "Successfully completed quiz",
    "metadata": {
        "score": 85,
        "total_questions": 20,
        "attempts": 1,
        "time_taken_seconds": 1200
    },
    "duration_seconds": 1200,
    "points_awarded": 50,
    "success": true,
    "is_verified": true,
    "activity_score": 80,
    "activity_date": "2025-03-14T10:30:00Z",
    "created_at": "2025-03-14T10:30:00Z",
    "updated_at": "2025-03-14T10:30:00Z",
    "related_content_id": "quiz_10"
}
```

#### 3. Get Activity Statistics
```
GET /api/v1/student/activities/stats/
```

**Response:**
```json
{
    "total_activities": 150,
    "activities_this_week": 25,
    "activities_this_month": 85,
    "points_earned": 1250,
    "most_active_course": {
        "id": 1,
        "title": "Django Advanced",
        "activity_count": 45
    },
    "top_activity_types": [
        {
            "activity_type": "lesson_completed",
            "count": 30,
            "display": "Selesaikan Pelajaran"
        },
        {
            "activity_type": "video_completed",
            "count": 25,
            "display": "Video Selesai (95%+)"
        }
    ],
    "recent_activities": [...]
}
```

#### 4. Get/Update Activity Filter Preferences
```
GET /api/v1/student/activity-filter/
PUT /api/v1/student/activity-filter/
```

**Request Body (PUT):**
```json
{
    "activity_types": ["lesson_completed", "quiz_passed", "certificate_earned"],
    "include_system_activities": true,
    "include_failed_activities": false,
    "max_activities_display": 20,
    "sort_by": "date"
}
```

**Response:**
```json
{
    "id": 1,
    "user": 1,
    "activity_types": ["lesson_completed", "quiz_passed", "certificate_earned"],
    "include_system_activities": true,
    "include_failed_activities": false,
    "max_activities_display": 20,
    "sort_by": "date",
    "created_at": "2025-01-01T10:00:00Z",
    "updated_at": "2025-03-14T15:30:00Z"
}
```

---

### Instructor Endpoints

#### 1. List Student Activities in Course
```
GET /api/v1/instructor/course/<course_id>/activities/
```

**Query Parameters:**
- `activity_type`: Filter by activity type
- `user_id`: Filter by specific student
- `limit`: Results per page
- `offset`: Pagination offset

**Response:** Same as student activity list

#### 2. Get Instructor Activity Analytics
```
GET /api/v1/instructor/activities/analytics/
```

**Response:**
```json
{
    "total_student_activities": 500,
    "activities_this_week": 120,
    "avg_engagement_score": 65.5,
    "students_active_today": 15,
    "completion_rate": 78.5,
    "course_activity_breakdown": [
        {
            "course_id": 1,
            "course_title": "Django Advanced",
            "total_activities": 250,
            "enrolled_students": 30,
            "active_students": 25,
            "avg_engagement": 70.5
        }
    ],
    "recent_student_activities": [...]
}
```

---

### Admin Endpoints

#### 1. Get Platform-Wide Activity Analytics
```
GET /api/v1/admin/activities/analytics/
```

**Query Parameters:**
- `period`: daily, weekly, monthly (default: daily)
- `days`: Number of days to analyze (default: 30)

**Response:**
```json
{
    "period": "daily",
    "total_activities": 5000,
    "total_users": 200,
    "active_users_today": 45,
    "avg_engagement_score": 65.5,
    "daily_metrics": [
        {
            "date": "2025-03-14",
            "activity_count": 150,
            "unique_users": 40,
            "avg_engagement": 65.0
        }
    ],
    "activity_type_breakdown": [
        {
            "activity_type": "lesson_completed",
            "count": 1500,
            "percentage": 30.0,
            "display": "Selesaikan Pelajaran"
        }
    ],
    "top_courses_by_activity": [
        {
            "course_id": 1,
            "course_title": "Django Advanced",
            "activity_count": 500,
            "unique_students": 50
        }
    ]
}
```

---

## Activity Types

The system tracks the following activity types:

| Activity Type | Display Name | Points | Score |
|---|---|---|---|
| `enrollment` | Pendaftaran Kursus | - | - |
| `lesson_started` | Mulai Pelajaran | - | 20 |
| `lesson_completed` | Selesaikan Pelajaran | 70 | 70 |
| `video_watched` | Tonton Video | - | 60 |
| `video_completed` | Video Selesai (95%+) | 30 | 60 |
| `quiz_attempted` | Kerjakan Kuis | - | 30 |
| `quiz_passed` | Lulus Kuis | 50 | 80 |
| `quiz_failed` | Tidak Lulus Kuis | - | - |
| `certificate_earned` | Raih Sertifikat | 100 | 100 |
| `course_completed` | Selesaikan Kursus | 100 | 100 |
| `question_asked` | Buat Pertanyaan | - | 30 |
| `question_answered` | Jawab Pertanyaan | 25 | 50 |
| `review_posted` | Posting Review | 20 | 40 |
| `points_earned` | Dapatkan Poin | - | - |
| `search_query` | Cari Kursus | - | 5 |
| `content_liked` | Sukai Konten | - | 20 |
| `wishlist_added` | Tambah Wishlist | - | 10 |
| `discussion_participated` | Ikut Diskusi | - | 30 |

---

## Usage Examples

### Example 1: Get student's recent activities
```bash
curl -X GET "http://localhost:8001/api/v1/student/activities/?limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Example 2: Filter by activity type
```bash
curl -X GET "http://localhost:8001/api/v1/student/activities/?activity_type=quiz_passed" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Example 3: Get activity statistics
```bash
curl -X GET "http://localhost:8001/api/v1/student/activities/stats/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Example 4: Update activity filter preferences
```bash
curl -X PUT "http://localhost:8001/api/v1/student/activity-filter/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_types": ["lesson_completed", "quiz_passed"],
    "include_system_activities": true,
    "max_activities_display": 15,
    "sort_by": "date"
  }'
```

### Example 5: Get instructor analytics
```bash
curl -X GET "http://localhost:8001/api/v1/instructor/activities/analytics/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Example 6: Get admin platform analytics
```bash
curl -X GET "http://localhost:8001/api/v1/admin/activities/analytics/?days=7" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Authentication & Permissions

All endpoints require authentication (JWT token) except:
- Health check endpoints

Permissions:
- **Student endpoints**: Require `IsAuthenticated`, user can only access own activities
- **Instructor endpoints**: Require `IsAuthenticated` + teacher/instructor role
- **Admin endpoints**: Require `IsAuthenticated` + `IsAdminUser` permission

---

## Database Schema

### ActivityLog Table (`api_activitylog`)
- `id` - Primary key
- `user_id` - Foreign key to User
- `activity_type` - Choice field (18 activity types)
- `role_at_time` - Role when activity occurred
- `course_id` - Foreign key to Course (nullable)
- `lesson_id` - Foreign key to VariantItem (nullable)
- `quiz_id` - Foreign key to Quiz (nullable)
- `title` - Human-readable title
- `description` - Full description
- `metadata` - JSON field for additional data
- `duration_seconds` - How long activity took
- `points_awarded` - Points earned
- `success` - Whether activity succeeded
- `is_verified` - Whether verified by system
- `created_at` - When logged
- `updated_at` - Last updated
- `activity_date` - When activity occurred
- `related_content_id` - Related content ID

**Indexes:**
- `(user, -activity_date)`
- `(user, activity_type)`
- `(course, -activity_date)`
- `(activity_type, -activity_date)`
- `(-activity_date)`

### ActivityFilter Table (`api_activityfilter`)
- `id` - Primary key
- `user_id` - Unique foreign key to User
- `activity_types` - JSON list of activity types to display
- `include_system_activities` - Boolean
- `include_failed_activities` - Boolean
- `max_activities_display` - Max activities to show
- `sort_by` - Sort order (date or engagement)
- `created_at` - When created
- `updated_at` - Last updated

### ActivityAggregate Table (`api_activityaggregate`)
- `id` - Primary key
- `date` - Date (indexed)
- `period` - daily or monthly (indexed)
- `user_id` - Foreign key (nullable)
- `course_id` - Foreign key (nullable)
- `activity_type` - Activity type
- `count` - Number of activities
- `total_points` - Total points earned
- `total_duration_seconds` - Total duration
- `success_rate` - Success percentage
- `updated_at` - Last updated

**Indexes:**
- `(date, period)`

---

## Performance Considerations

1. **Pagination**: All list endpoints are paginated (default 20 items/page)
2. **Filtering**: Query parameters are indexed for fast filtering
3. **Aggregation**: Use ActivityAggregate for analytics instead of real-time calculations
4. **Read-only Fields**: Most timestamp fields are read-only to ensure data integrity

---

## Future Enhancements

1. **Bulk Activity Logging**: Support batch logging of activities
2. **Activity Webhooks**: Send webhooks for specific activity types
3. **Export Analytics**: CSV/PDF export of activity data
4. **Real-time Notifications**: Notify instructors of student activities
5. **Activity Goals**: Set and track activity goals
6. **Performance Metrics**: Track performance trends over time

---

**Last Updated**: March 14, 2025
**Phase**: Phase 53
**Status**: Implemented and tested
