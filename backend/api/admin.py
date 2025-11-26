from django.contrib import admin
from api import models 

admin.site.register(models.Teacher)
admin.site.register(models.Category)
admin.site.register(models.Course)
admin.site.register(models.Variant)
admin.site.register(models.VariantItem)
admin.site.register(models.Question_Answer)
admin.site.register(models.Question_Answer_Message)
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
