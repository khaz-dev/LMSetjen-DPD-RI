from api import views as api_views
from api import enhanced_upload_views
from django.urls import path

from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # API Root (no authentication required)
    path("", api_views.APIRootView.as_view(), name="api-root"),
    
    # Health Check (no authentication required)
    path("health/", api_views.HealthCheckAPIView.as_view()),
    
    # Authentication Endpoints

    path("user/token/", api_views.MyTokenObtainPairView.as_view()),
    path("user/token/refresh/", TokenRefreshView.as_view()),
    path("user/register/", api_views.RegisterView.as_view()),
    path("user/password-reset/<email>/", api_views.PasswordResetEmailVerifyAPIView.as_view()),
    path("user/password-change/", api_views.PasswordChangeAPIView.as_view()),
    path("user/profile/<user_id>/", api_views.ProfileAPIView.as_view()),
    path("user/change-password/", api_views.ChangePasswordAPIView.as_view()),
    
    # SSO (Single Sign-On) Endpoints
    path("sso/verify/", api_views.SSOTokenVerifyAPIView.as_view(), name="sso-verify"),
    path("sso/login/<str:sso_token>/", api_views.SSOLoginRedirectAPIView.as_view(), name="sso-login"),

    # Core Endpoints
    path("course/category/", api_views.CategoryListAPIView.as_view()),
    path("course/course-list/", api_views.CourseListAPIView.as_view()),
    path("course/search/", api_views.SearchCourseAPIView.as_view()),
    path("course/course-detail/<slug>/", api_views.CourseDetailAPIView.as_view()),
    path("statistics/public-stats/", api_views.PublicStatsAPIView.as_view()),
    
    # Enrollment API Endpoints
    path("course/enroll/", api_views.CourseEnrollmentAPIView.as_view()),
    path("course/check-enrollment/<course_id>/<user_id>/", api_views.CheckEnrollmentStatusAPIView.as_view()),


    # Student API Endpoints
    path("student/summary/<user_id>/", api_views.StudentSummaryAPIView.as_view()),
    path("student/course-list/<user_id>/", api_views.StudentCourseListAPIView.as_view()),
    path("student/course-detail/<user_id>/<enrollment_id>/", api_views.StudentCourseDetailAPIView.as_view()),
    path("student/course-completed/", api_views.StudentCourseCompletedCreateAPIView.as_view()),
    path("student/video-progress/", api_views.VideoProgressAPIView.as_view()),
    path("student/video-progress/<user_id>/<variant_item_id>/", api_views.VideoProgressDetailAPIView.as_view()),
    path("student/video-progress-delete/<user_id>/<variant_item_id>/", api_views.VideoProgressDeleteAPIView.as_view()),
    path("student/course-note/<user_id>/<enrollment_id>/", api_views.StudentNoteCreateAPIView.as_view()),
    path("student/course-note-detail/<user_id>/<enrollment_id>/<note_id>/", api_views.StudentNoteDetailAPIView.as_view()),
    path("student/rate-course/", api_views.StudentRateCourseCreateAPIView.as_view()),
    path("student/review-detail/<user_id>/<review_id>/", api_views.StudentRateCourseUpdateAPIView.as_view()),
    path("student/wishlist/<user_id>/", api_views.StudentWishListListCreateAPIView.as_view()),
    path("student/question-answer-list-create/<course_id>/", api_views.QuestionAnswerListCreateAPIView.as_view()),
    path("student/question-answer-message-create/", api_views.QuestionAnswerMessageSendAPIView.as_view()),

    # Student Quiz Endpoints
    path("student/quiz-list/<user_id>/<course_id>/", api_views.StudentQuizListAPIView.as_view()),
    path("student/quiz-detail/<user_id>/<quiz_id>/", api_views.StudentQuizDetailAPIView.as_view()),
    path("student/quiz-submit/<user_id>/", api_views.StudentQuizSubmitAPIView.as_view()),
    path("student/quiz-attempts/<user_id>/", api_views.StudentQuizAttemptsAPIView.as_view()),
    path("student/quiz-attempts/<user_id>/<quiz_id>/", api_views.StudentQuizAttemptsAPIView.as_view()),

    # Certificate Endpoints
    path("student/certificate-eligibility/<user_id>/<course_id>/", api_views.StudentCertificateEligibilityAPIView.as_view()),
    path("student/certificate-generate/", api_views.StudentCertificateGenerateAPIView.as_view()),
    path("student/certificate-download/<certificate_id>/", api_views.StudentCertificateDownloadAPIView.as_view()),
    path("certificate/validate/<validation_token>/", api_views.CertificateValidationAPIView.as_view(), name="certificate-validate"),


    # Teacher Routes
    path("teacher/summary/<teacher_id>/", api_views.TeacherSummaryAPIView.as_view()),
    path("teacher/profile/<user_id>/", api_views.TeacherProfileAPIView.as_view()),
    path("teacher/create-from-profile/", api_views.TeacherCreateFromProfileAPIView.as_view()),
    path("teacher/profile-update/<user_id>/", api_views.TeacherProfileUpdateAPIView.as_view()),
    path("teacher/course-lists/<teacher_id>/", api_views.TeacherCourseListAPIView.as_view()),
    path("teacher/review-lists/<teacher_id>/", api_views.TeacherReviewListAPIView.as_view()),
    path("teacher/review-detail/<teacher_id>/<review_id>/", api_views.TeacherReviewDetailAPIView.as_view()),
    path("teacher/student-lists/<teacher_id>/", api_views.TeacherStudentsListAPIView.as_view({'get': 'list'})),
    path("teacher/best-course-earning/<teacher_id>/", api_views.TeacherBestSellingCourseAPIView.as_view({'get': 'list'})),
    path("teacher/course-order-list/<teacher_id>/", api_views.TeacherCourseOrdersListAPIView.as_view()),
    path("teacher/question-answer-list/<teacher_id>/", api_views.TeacherQuestionAnswerListAPIView.as_view()),
    path("teacher/noti-list/<teacher_id>/", api_views.TeacherNotificationListAPIView.as_view()),
    path("teacher/noti-detail/<teacher_id>/<noti_id>", api_views.TeacherNotificationDetailAPIView.as_view()),
    path("teacher/course-create/", api_views.CourseCreateAPIView.as_view()),
    path("teacher/course-update/<teacher_id>/<course_id>/", api_views.CourseUpdateAPIView.as_view()),
    path("teacher/course-detail/<course_id>/", api_views.TeacherCourseDetailAPIView.as_view()),
    path("teacher/course-publish/<course_id>/", api_views.CoursePublishAPIView.as_view()),
    path("teacher/course/variant-delete/<variant_id>/<teacher_id>/<course_id>/", api_views.CourseVariantDeleteAPIView.as_view()),
    path("teacher/course/variant-item-delete/<variant_id>/<variant_item_id>/<teacher_id>/<course_id>/", api_views.CourseVariantItemDeleteAPIVIew.as_view()),

    # Quiz Management API Endpoints
    path("quiz/list-create/", api_views.QuizListCreateAPIView.as_view()),
    path("quiz/detail/<quiz_id>/", api_views.QuizDetailAPIView.as_view()),
    path("quiz/question/list-create/", api_views.QuizQuestionListCreateAPIView.as_view()),
    path("quiz/question/detail/<question_id>/", api_views.QuizQuestionDetailAPIView.as_view()),
    path("quiz/choice/list-create/", api_views.QuizChoiceListCreateAPIView.as_view()),
    path("quiz/choice/detail/<choice_id>/", api_views.QuizChoiceDetailAPIView.as_view()),

    # File Upload APIs - Original and Enhanced
    path("file-upload/", api_views.FileUploadAPIView.as_view()),  # Keep original for compatibility
    
    # Enhanced Local Storage APIs
    path("upload/enhanced/", enhanced_upload_views.EnhancedFileUploadAPIView.as_view()),
    path("upload/bulk/", enhanced_upload_views.BulkFileUploadAPIView.as_view()),
    path("storage/info/", enhanced_upload_views.FileInfoAPIView.as_view()),
    
    # Admin API URLs
    path("admin/dashboard-summary/", api_views.AdminSummaryAPIView.as_view()),
    path("admin/user-management/", api_views.AdminUserManagementAPIView.as_view()),
    path("admin/user-detail/<user_id>/", api_views.AdminUserDetailAPIView.as_view()),
    path("admin/user-create/", api_views.AdminUserCreateAPIView.as_view()),
    path("admin/user-update/<user_id>/", api_views.AdminUserUpdateAPIView.as_view()),
    path("admin/user-delete/<user_id>/", api_views.AdminUserDeleteAPIView.as_view()),
    path("admin/user-bulk-actions/", api_views.AdminUserBulkActionsAPIView.as_view()),
    path("admin/course-management/", api_views.AdminCourseManagementAPIView.as_view()),
    path("admin/enrollment-analytics/", api_views.AdminEnrollmentAnalyticsAPIView.as_view()),
    path("admin/system-health/", api_views.AdminSystemHealthAPIView.as_view()),
    path("admin/sync-external-users/", api_views.SyncExternalUsersAPIView.as_view()),
    path("admin/sync-progress/", api_views.SyncProgressAPIView.as_view()),
    path("admin/last-sync-info/", api_views.LastSyncInfoAPIView.as_view()),

]


