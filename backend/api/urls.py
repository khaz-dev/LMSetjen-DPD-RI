from api import views as api_views
from api import enhanced_upload_views
from api.video_metadata_view import VideoMetadataAPIView
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
    path("user/password-reset/<email>/", api_views.PasswordResetEmailVerifyAPIView.as_view()),
    path("user/password-change/", api_views.PasswordChangeAPIView.as_view()),
    path("user/profile/<user_id>/", api_views.ProfileAPIView.as_view()),
    path("user/change-password/", api_views.ChangePasswordAPIView.as_view()),
    
    # SSO (Single Sign-On) Endpoints
    path("sso/verify/", api_views.SSOTokenVerifyAPIView.as_view(), name="sso-verify"),
    path("sso/login/<str:sso_token>/", api_views.SSOLoginRedirectAPIView.as_view(), name="sso-login"),
    path("auth/google/", api_views.GoogleOAuthAPIView.as_view(), name="google-oauth"),  # ✨ PHASE 4.16: Google OAuth

    # Core Endpoints
    path("course/category/", api_views.CategoryListAPIView.as_view()),
    path("course/course-list/", api_views.CourseListAPIView.as_view()),
    path("course/search/", api_views.SearchCourseAPIView.as_view()),
    path("course/full-text-search/", api_views.FullTextSearchAPIView.as_view()),  # ✨ PHASE 4: FTS endpoint
    path("course/trending-searches/", api_views.TrendingSearchesAPIView.as_view()),
    path("course/course-detail/<slug>/", api_views.CourseDetailAPIView.as_view()),
    path("statistics/public-stats/", api_views.PublicStatsAPIView.as_view()),
    path("statistics/testimonials/", api_views.TestimonialListAPIView.as_view()),  # ✨ PHASE 4: Testimonials endpoint
    path("student/submit-testimonial/", api_views.TestimonialCreateAPIView.as_view()),  # ✨ PHASE 4.10: Testimonial submission endpoint
    path("student/testimonial/", api_views.TestimonialDetailAPIView.as_view()),  # ✨ PHASE 4.10: Testimonial detail (get/delete)
    path("student/testimonials/list/", api_views.UserTestimonialsListAPIView.as_view()),  # ✨ PHASE 4.13: User testimonials list with status
    
    # ✨ PHASE 4.3: Analytics Endpoints
    path("analytics/trending-searches/", api_views.TrendingSearchesAnalyticsAPIView.as_view()),
    path("analytics/failed-searches/", api_views.FailedSearchesAnalyticsAPIView.as_view()),
    path("analytics/search-volume/", api_views.SearchVolumeAnalyticsAPIView.as_view()),
    path("analytics/search-stats/", api_views.SearchStatsAPIView.as_view()),
    path("analytics/course-search-metrics/", api_views.CourseSearchMetricsAPIView.as_view()),
    
    # ✨ PHASE 4.4: Dashboard Endpoints
    path("analytics/dashboard/", api_views.SearchAnalyticsDashboardAPIView.as_view()),
    path("analytics/summary/", api_views.SearchAnalyticsSummaryAPIView.as_view()),
    path("analytics/trend/", api_views.SearchAnalyticsTrendAPIView.as_view()),
    
    # ✨ PHASE 4.5: Advanced Filters Endpoints
    path("filters/options/", api_views.FilterOptionsAPIView.as_view()),
    path("filters/categories/", api_views.CategoryFilterAPIView.as_view()),
    path("filters/levels/", api_views.LevelFilterAPIView.as_view()),
    path("filters/ratings/", api_views.RatingFilterAPIView.as_view()),
    path("filters/teachers/", api_views.TeacherFilterAPIView.as_view()),
    path("employee/options/", api_views.EmployeeInfoOptionsAPIView.as_view()),  # ✨ PHASE 4.12.3: Employee info options
    
    # ✨ PHASE 4.6: Integrated Search Endpoints
    path("search/advanced/", api_views.AdvancedSearchAPIView.as_view()),
    path("search/suggestions/", api_views.AdvancedSearchSuggestionsAPIView.as_view()),
    
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
    # ✨ PHASE 7.16: Q&A Like and Report endpoints
    path("student/question-answer-like/<qa_id>/", api_views.QuestionAnswerLikeAPIView.as_view()),
    path("student/question-answer-message-like/<qa_id>/", api_views.QuestionAnswerMessageLikeAPIView.as_view()),
    path("student/question-answer-report/<qa_id>/", api_views.QuestionAnswerReportAPIView.as_view()),
    path("student/question-answer-message-report/<qa_id>/", api_views.QuestionAnswerMessageReportAPIView.as_view()),
    path("student/qa-reports/<course_id>/", api_views.StudentQAReportsAPIView.as_view()),

    # Student Quiz Endpoints
    path("student/quiz-list/<user_id>/<course_id>/", api_views.StudentQuizListAPIView.as_view()),
    path("student/quiz-detail/<user_id>/<quiz_id>/", api_views.StudentQuizDetailAPIView.as_view()),
    path("student/quiz-submit/<user_id>/", api_views.StudentQuizSubmitAPIView.as_view()),
    path("student/quiz-attempts/<user_id>/", api_views.StudentQuizAttemptsAPIView.as_view()),
    path("student/quiz-attempts/<user_id>/<quiz_id>/", api_views.StudentQuizAttemptsAPIView.as_view()),

    # Certificate Endpoints
    path("student/certificate-eligibility/<user_id>/<course_id>/", api_views.StudentCertificateEligibilityAPIView.as_view()),
    path("student/certificate-generate/", api_views.StudentCertificateGenerateAPIView.as_view()),
    path("student/certificate-save-image/", api_views.StudentCertificateSaveImageAPIView.as_view()),  # ✨ PHASE 4.222: Save certificate image with filename format: course_id_user_id.png
    path("student/certificate-save-pdf/", api_views.StudentCertificateSavePDFAPIView.as_view()),  # ✨ PHASE 4.210: Deprecated - kept for backward compatibility
    path("student/certificate-image/<certificate_id>/", api_views.StudentCertificateImageAPIView.as_view()),  # ✨ PHASE 4.221: Serve certificate image by certificate_id
    path("student/certificate-download/<course_id>/<user_id>/", api_views.StudentCertificateDownloadAPIView.as_view()),  # ✨ PHASE 4.222: Download certificate image by course_id and user_id
    path("student/certificates/<user_id>/", api_views.StudentCertificateListAPIView.as_view()),  # ✨ PHASE 4.228: List all student certificates for "Sertifikat Kursus" page
    path("certificate/validate/<validation_token>/", api_views.CertificateValidationAPIView.as_view(), name="certificate-validate"),


    # Teacher Routes
    path("teacher/summary/<teacher_id>/", api_views.TeacherSummaryAPIView.as_view()),
    path("teacher/detail/<teacher_id>/", api_views.TeacherDetailAPIView.as_view()),  # ✨ PHASE 4.43: Public teacher detail endpoint
    path("teacher/profile/<user_id>/", api_views.TeacherProfileAPIView.as_view()),
    path("teacher/create-from-profile/", api_views.TeacherCreateFromProfileAPIView.as_view()),
    path("teacher/profile-update/<user_id>/", api_views.TeacherProfileUpdateAPIView.as_view()),
    path("teacher/course-lists/<teacher_id>/", api_views.TeacherCourseListAPIView.as_view()),
    path("teacher/student-lists/<teacher_id>/", api_views.TeacherStudentsListAPIView.as_view({'get': 'list'})),  # ✨ PHASE 4.X: Students enrolled in teacher's courses
    path("teacher/published-courses/<teacher_id>/", api_views.TeacherPublishedCoursesAPIView.as_view()),  # ✨ PHASE 4.77: Public profile courses
    path("teacher/review-lists/<teacher_id>/", api_views.TeacherReviewListAPIView.as_view()),
    path("teacher/review-detail/<teacher_id>/<review_id>/", api_views.TeacherReviewDetailAPIView.as_view()),
    path("teacher/review-report-abuse/<int:review_id>/", api_views.ReviewAbuseReportAPIView.as_view()),  # ✨ PHASE 4.210: Report review abuse
    path("teacher/abuse-reports/<teacher_id>/", api_views.TeacherAbuseReportsAPIView.as_view()),  # ✨ PHASE 4.210: View submitted abuse reports
    path("teacher/abuse-reports/<int:id>/update/", api_views.TeacherAbuseReportDetailAPIView.as_view()),  # ✨ PHASE 4.210: Update own abuse reports
    path("teacher/abuse-reports/<int:id>/close/", api_views.TeacherAbuseReportCloseAPIView.as_view()),  # ✨ PHASE 4.210: Close own abuse reports
    # Admin Routes - Abuse Reports
    path("admin/abuse-reports/", api_views.AdminAbuseReportsListAPIView.as_view()),  # ✨ PHASE 4.210: List all abuse reports
    path("admin/abuse-reports/<int:report_id>/", api_views.AdminAbuseReportDetailAPIView.as_view()),  # ✨ PHASE 4.210: Review/update abuse report
    # ✨ PHASE 7.16: Admin Routes - Q&A Reports
    path("admin/qa-reports/", api_views.AdminQAReportsListAPIView.as_view()),  # List all Q&A reports
    path("admin/qa-reports/<int:report_id>/", api_views.AdminQAReportDetailAPIView.as_view()),  # Review/update Q&A report
    path("teacher/best-course-earning/<teacher_id>/", api_views.TeacherBestSellingCourseAPIView.as_view({'get': 'list'})),
    path("teacher/course-order-list/<teacher_id>/", api_views.TeacherCourseOrdersListAPIView.as_view()),
    path("teacher/question-answer-list/<teacher_id>/", api_views.TeacherQuestionAnswerListAPIView.as_view()),
    path("teacher/noti-list/<teacher_id>/", api_views.TeacherNotificationListAPIView.as_view()),
    path("teacher/noti-detail/<teacher_id>/<noti_id>", api_views.TeacherNotificationDetailAPIView.as_view()),
    path("teacher/course-create/", api_views.CourseCreateAPIView.as_view()),
    path("teacher/course-update/<teacher_id>/<course_id>/", api_views.CourseUpdateAPIView.as_view()),
    path("teacher/course-detail/<course_id>/", api_views.TeacherCourseDetailAPIView.as_view()),
    path("teacher/course-publish/<course_id>/", api_views.CoursePublishAPIView.as_view()),
    path("teacher/course-restore/<course_id>/", api_views.CourseRestoreAPIView.as_view()),  # ✨ PHASE 4.60D: Restore from published version
    path("teacher/course-edit-published/<course_id>/", api_views.CourseEditPublishedAPIView.as_view()),  # ✨ PHASE 4.76: Edit published courses
    
    # ✨ PHASE 4.36: Course approval workflow endpoints
    path("admin/course-approval/<course_id>/", api_views.CourseApprovalAPIView.as_view()),
    path("admin/courses-pending-review/", api_views.AdminCourseListAPIView.as_view()),
    
    path("teacher/course/variant-delete/<variant_id>/<teacher_id>/<course_id>/", api_views.CourseVariantDeleteAPIView.as_view()),
    path("teacher/course/variant-item-delete/<variant_id>/<variant_item_id>/<teacher_id>/<course_id>/", api_views.CourseVariantItemDeleteAPIVIew.as_view()),

    # Quiz Management API Endpoints
    path("quiz/list-create/", api_views.QuizListCreateAPIView.as_view()),
    path("quiz/detail/<quiz_id>/", api_views.QuizDetailAPIView.as_view()),
    path("quiz/question/list-create/", api_views.QuizQuestionListCreateAPIView.as_view()),
    path("quiz/question/detail/<question_id>/", api_views.QuizQuestionDetailAPIView.as_view()),
    path("quiz/choice/list-create/", api_views.QuizChoiceListCreateAPIView.as_view()),
    path("quiz/choice/detail/<choice_id>/", api_views.QuizChoiceDetailAPIView.as_view()),

    # ⚠️ DEPRECATED (Phase 3): File Upload APIs - Server-side file storage no longer used
    # Kept for backward compatibility only. Will be removed in a future version.
    # Images and videos now handled via external URLs (Google Drive, YouTube, CDNs)
    path("file-upload/", api_views.FileUploadAPIView.as_view()),  # DEPRECATED - Use external URLs instead
    path("file-cleanup/", api_views.FileCleanupAPIView.as_view()),  # ✨ PHASE 4.101.4: Delete files when switching sources
    
    # ⚠️ DEPRECATED (Phase 3): Enhanced Local Storage APIs - No longer needed
    # Will be removed when all clients migrate to external URL-based approach
    path("upload/enhanced/", enhanced_upload_views.EnhancedFileUploadAPIView.as_view()),  # DEPRECATED
    path("upload/bulk/", enhanced_upload_views.BulkFileUploadAPIView.as_view()),  # DEPRECATED
    path("storage/info/", enhanced_upload_views.FileInfoAPIView.as_view()),  # DEPRECATED
    
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
    
    # ✨ PHASE 4.11: Admin Category Management URLs
    path("admin/category/", api_views.AdminCategoryListCreateAPIView.as_view()),
    path("admin/category/<int:id>/", api_views.AdminCategoryDetailAPIView.as_view()),

    # ✨ PHASE 4.12: Admin Testimonial Management URLs (Curation)
    path("admin/testimonials/pending/", api_views.AdminPendingTestimonialsListAPIView.as_view()),
    path("admin/testimonials/approved/", api_views.AdminApprovedTestimonialsListAPIView.as_view()),
    path("admin/testimonials/<int:testimonial_id>/approve-reject/", api_views.AdminApproveRejectTestimonialAPIView.as_view()),

    # ✨ TIER 1: Content Gap Analysis
    path("analytics/content-gaps/", api_views.ContentGapAnalysisView.as_view()),
    path("analytics/content-gaps/<int:pk>/", api_views.ContentGapDetailView.as_view()),

    # ✨ TIER 1: At-Risk Student Detection
    path("analytics/at-risk-students/", api_views.StudentRiskAssessmentView.as_view()),
    path("analytics/at-risk-students/<int:pk>/", api_views.StudentRiskAssessmentDetailView.as_view()),
    path("analytics/at-risk-students/trigger-assessment/", api_views.StudentRiskAssessmentTriggerView.as_view()),
    path("analytics/at-risk-summary/", api_views.StudentRiskSummaryView.as_view()),

    # ✨ TIER 1: Course Recommendations
    path("analytics/recommendations/", api_views.CourseRecommendationView.as_view()),
    path("analytics/recommendations/<int:pk>/", api_views.CourseRecommendationDetailView.as_view()),
    path("analytics/recommendations/<int:pk>/click/", api_views.RecommendationClickTrackView.as_view()),
    path("analytics/recommendations/<int:pk>/enroll/", api_views.RecommendationConversionTrackView.as_view()),
    path("analytics/recommendations/stats/", api_views.RecommendationStatsView.as_view()),

    # ✨ PHASE 4.10: Search Quality Metrics Dashboard
    path("analytics/search-quality/", api_views.SearchQualityMetricsView.as_view()),
    path("analytics/search-quality/courses/", api_views.CourseSearchQualityListView.as_view()),
    path("analytics/search-quality/courses/<int:course_id>/", api_views.CourseSearchQualityDetailView.as_view()),

    # ✨ PHASE 4.10 TIER 1.2: Search Query Taxonomy Analytics
    path("analytics/search-taxonomy/report/", api_views.SearchQueryTaxonomyReportView.as_view()),
    path("analytics/search-taxonomy/categories/", api_views.SearchQueryCategoryListView.as_view()),
    path("analytics/search-taxonomy/queries/", api_views.SearchQueryTaxonomyListView.as_view()),
    path("analytics/search-taxonomy/category-analytics/", api_views.SearchTaxonomyAnalyticsView.as_view()),
    path("analytics/search-taxonomy/trending/", api_views.TrendingCategoriesView.as_view()),
    path("analytics/search-taxonomy/timeline/", api_views.QueryAnalysisByTimeView.as_view()),

    # ✨ PHASE 3: MULTI-ROLE AUTHENTICATION ENDPOINTS
    path("auth/available-roles/", api_views.AvailableRolesAPIView.as_view()),
    path("auth/select-role/", api_views.SelectRoleAPIView.as_view()),
    
    # ✨ PHASE 4.43.10: Video Metadata Extraction API
    path("media/video-metadata/", VideoMetadataAPIView.as_view()),

    # ✨ PHASE 4.45: Course Features, Requirements, and Learning Outcomes Management
    path("teacher/course-features/<course_id>/", api_views.CourseFeatureListCreateAPIView.as_view()),
    path("teacher/course-features/<course_id>/<feature_id>/", api_views.CourseFeatureDetailAPIView.as_view()),
    path("teacher/course-requirements/<course_id>/", api_views.CourseRequirementListCreateAPIView.as_view()),
    path("teacher/course-requirements/<course_id>/<requirement_id>/", api_views.CourseRequirementDetailAPIView.as_view()),
    path("teacher/course-learning-outcomes/<course_id>/", api_views.CourseLearningOutcomeListCreateAPIView.as_view()),
    path("teacher/course-learning-outcomes/<course_id>/<outcome_id>/", api_views.CourseLearningOutcomeDetailAPIView.as_view()),
    
    # ✨ PHASE 4.78: Instructor Request System endpoints
    path("instructor-request/", api_views.InstructorRequestCreateAPIView.as_view()),
    path("instructor-request/<int:request_id>/", api_views.InstructorRequestDetailAPIView.as_view()),
    path("admin/instructor-requests/", api_views.AdminInstructorRequestListAPIView.as_view()),
    path("admin/instructor-request/<int:request_id>/approve/", api_views.AdminInstructorRequestApproveAPIView.as_view()),
    path("admin/instructor-request/<int:request_id>/reject/", api_views.AdminInstructorRequestRejectAPIView.as_view()),

    # ✨ PHASE 4.143: Lesson Completion Question endpoints
    path("lesson-completion-question/", api_views.LessonCompletionQuestionListCreateAPIView.as_view()),
    path("lesson-completion-question/<question_id>/", api_views.LessonCompletionQuestionDetailAPIView.as_view()),
    path("lesson-completion-question/answer/", api_views.LessonCompletionQuestionAnswerAPIView.as_view()),
]
