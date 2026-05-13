#!/usr/bin/env python
"""
✨ PHASE 10.3: Sample Data Generator for Testing Rankings

Creates mock student activity (completed lessons, quiz attempts, reviews)
so you can immediately test the ranking system.

Run: python manage.py shell < generate_test_rankings.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.utils import timezone
import random

print("=" * 70)
print("🧪 GENERATING SAMPLE DATA FOR RANKING SYSTEM TEST")
print("=" * 70)

# Get real objects from database
students = list(models.User.objects.filter(current_role='student')[:5])  # First 5 students
instructors = list(models.User.objects.filter(current_role__in=['teacher', 'instructor']))
courses = list(models.Course.objects.filter(is_published_version=True))
enrolled_courses = list(models.EnrolledCourse.objects.select_related('course', 'user')[:5])

if not students or not courses or not enrolled_courses:
    print("❌ Error: Not enough test data (need students, courses, enrollments)")
    print(f"   Students: {len(students)}, Courses: {len(courses)}, Enrollments: {len(enrolled_courses)}")
    exit(1)

print(f"\n✅ Found {len(students)} students, {len(courses)} courses, {len(enrolled_courses)} enrollments")

# 1. Create CompletedLesson records (simulates completing ALL lessons in a course)
print("\n📚 Creating CompletedLesson records (course completions)...")
completed_count = 0
for enrollment in enrolled_courses:
    # Get all lessons in the course
    lessons = models.VariantItem.objects.filter(variant__course=enrollment.course)
    
    if lessons.exists():
        for lesson in lessons:
            completed, created = models.CompletedLesson.objects.get_or_create(
                user=enrollment.user,
                course=enrollment.course,
                variant_item=lesson
            )
            if created:
                completed_count += 1
                # Verify enrollment is now marked as 100% complete
                if enrollment.is_course_completed():
                    print(f"  ✅ {enrollment.user.full_name} completed {enrollment.course.title[:30]}... (100%)")

print(f"  Created: {completed_count} lesson completion records")

# 2. Create QuizAttempt records (simulates taking quizzes with good scores)
print("\n🎯 Creating QuizAttempt records (quiz scores)...")
quiz_attempt_count = 0
for student in students[:3]:  # First 3 students
    quizzes = models.Quiz.objects.all()[:2]  # First 2 quizzes
    
    for quiz in quizzes:
        # Create attempt with random passing score (70-100%)
        score = random.randint(70, 100)
        total_q = quiz.questions.count() or 10  # Use actual question count or default to 10
        attempt, created = models.QuizAttempt.objects.get_or_create(
            user=student,
            quiz=quiz,
            defaults={
                'score': score,
                'total_questions': total_q,
                'is_passed': True,
                'date_attempted': timezone.now()
            }
        )
        if created:
            quiz_attempt_count += 1
            print(f"  ✅ {student.full_name} passed {quiz.title[:30]}... ({score}%)")

print(f"  Created: {quiz_attempt_count} quiz attempt records")

# 3. Create Review records (simulates submitting course ratings)
print("\n⭐ Creating Review records (ratings)...")
review_count = 0
for student in students[:3]:  # First 3 students
    for course in courses[:2]:  # Rate first 2 courses
        rating = random.randint(4, 5)  # 4-5 star ratings
        review, created = models.Review.objects.get_or_create(
            user=student,
            course=course,
            defaults={
                'rating': rating,
                'review': f"Great course! Really helpful and informative.",
                'active': True,  # Mark as approved
                'date': timezone.now()
            }
        )
        if created:
            review_count += 1
            print(f"  ✅ {student.full_name} rated {course.title[:30]}... ({rating}⭐ active review)")

print(f"  Created: {review_count} review records")

print("\n" + "=" * 70)
print("✨ SAMPLE DATA GENERATION COMPLETE")
print("=" * 70)
print("\n📊 Now run the ranking command to award points:")
print("   python manage.py update_rankings --verbose")
print("\n🎯 You should see points awarded for:")
print("   - Course completions: 100 points per course")
print("   - Quiz scores: 70-100 points per quiz")
print("   - Ratings: 50 points to student, 40-50 to instructor")
print("\n✅ Then check rankings at:")
print("   - Admin: http://localhost:8001/admin/api/studentpoints/")
print("   - API: http://localhost:8001/api/v1/rankings/students/lifetime/")
print("=" * 70 + "\n")
