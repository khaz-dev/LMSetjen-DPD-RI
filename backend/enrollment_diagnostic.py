#!/usr/bin/env python
"""
Check what's wrong with course enrollment and question loading
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import (
    Question_Answer, Question_Answer_Report, EnrolledCourse, VariantItem, 
    Course
)
from django.contrib.auth import get_user_model
from userauths.models import Profile

User = get_user_model()

print("\n" + "="*100)
print("ENROLLMENT & QUESTION LOADING DIAGNOSTIC")
print("="*100)

# Check user 776
try:
    user = User.objects.get(id=776)
    print(f"\n✅ User found: {user.email} (ID: {user.id})\n")
except:
    print("❌ User not found\n")
    exit(1)

# ===== Check enrollments for this user =====
print("\n" + "-"*100)
print("SECTION 1: USER ENROLLMENTS")
print("-"*100)

enrollments = EnrolledCourse.objects.filter(user=user)
print(f"\nEnrolledCourse records for user {user.email}: {enrollments.count()}")
for ec in enrollments[:10]:
    print(f"\n  EnrolledCourse ID {ec.id}:")
    print(f"    - enrollment_id: {ec.enrollment_id}")
    print(f"    - course: {ec.course}")
    print(f"    - course.id: {ec.course.id if ec.course else 'None'}")
    print(f"    - date: {ec.date}")

# Also check Enrollment model
# (Enrollment model doesn't exist, only EnrolledCourse)

# ===== Check what questions are returned when frontend calls the list API =====
print("\n" + "-"*100)
print("SECTION 2: QUESTION LIST FOR DIFFERENT COURSES")
print("-"*100)

# The CourseDetail.jsx calls: GET /api/v1/question-answer-list-create/{course_id}/
# It gets questions for the course
for course_id in [47, 168460]:
    try:
        questions = Question_Answer.objects.filter(course_id=course_id)
        print(f"\nQuestions in course_id={course_id}: {questions.count()}")
        if questions.exists():
            for q in questions[:5]:
                print(f"  - qa_id: {q.qa_id}, title: {q.title}, user: {q.user}")
    except:
        print(f"\nCourse_id={course_id}: Error fetching questions")

# ===== Check questions the user can see =====
print("\n" + "-"*100)
print("SECTION 3: ALL QUESTIONS IN DATABASE")
print("-"*100)

all_questions = Question_Answer.objects.all()
print(f"\nTotal questions in database: {all_questions.count()}")
print("\nAll questions:")
for q in all_questions:
    print(f"  - qa_id: {q.qa_id}, course_id: {q.course_id}, user: {q.user.username if q.user else 'None'}")

# ===== Final analysis =====
print("\n" + "-"*100)
print("SECTION 4: ANALYSIS")
print("-"*100)

print("\n🔍 Key findings:")
print("1. User is enrolled in which course IDs?")
for ec in EnrolledCourse.objects.filter(user=user):
    print(f"   - Course {ec.course.id}: {ec.course.title}")

print("\n2. What questions can the user see?")
user_enrollments = EnrolledCourse.objects.filter(user=user).values_list('course_id', flat=True)
visible_questions = Question_Answer.objects.filter(course_id__in=user_enrollments)
print(f"   Total visible questions: {visible_questions.count()}")
for q in visible_questions:
    print(f"   - qa_id: {q.qa_id}, course_id: {q.course_id}")

print("\n3. Where is the reported question?")
report = Question_Answer_Report.objects.filter(reported_by=user).first()
if report:
    print(f"   - Report exists for qa_id: {report.question.qa_id}")
    print(f"   - In course_id: {report.question.course_id}")
    print(f"   - Can user see this question? {report.question.course_id in user_enrollments}")
else:
    print("   - No reports found")

print("\n" + "="*100 + "\n")
