#!/usr/bin/env python
"""
Create test Q&A reports for demonstration
Usage: python create_test_qa_reports.py
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from api.models import Question_Answer, Question_Answer_Report, Course

User = get_user_model()

print("\n" + "="*80)
print("CREATING TEST Q&A REPORTS")
print("="*80)

# Get user 776 (the test user from the logs)
try:
    test_user = User.objects.get(id=776)
    print(f"\n✅ Found test user: {test_user.username} (ID: {test_user.id})")
except User.DoesNotExist:
    print("\n❌ User 776 not found. Using first available user...")
    test_user = User.objects.first()
    if not test_user:
        print("❌ No users in database!")
        exit(1)
    print(f"✅ Using: {test_user.username} (ID: {test_user.id})")

# Get course 168460 (from the logs)
try:
    course = Course.objects.get(course_id=168460)
    print(f"✅ Found course: {course.title} (ID: {course.course_id})")
except Course.DoesNotExist:
    print("\n⚠️  Course 168460 not found. Finding first course with Q&A...")
    questions = Question_Answer.objects.all()
    if questions.exists():
        course = questions.first().course
        print(f"✅ Using course: {course.title} (ID: {course.course_id})")
    else:
        print("❌ No questions/courses found!")
        exit(1)

# Get questions from this course
questions = Question_Answer.objects.filter(course=course)[:3]

if not questions.exists():
    print(f"❌ No Q&A questions found in course {course.course_id}")
    exit(1)

print(f"\n✅ Found {questions.count()} questions in course")

# Create test reports
created_count = 0
for idx, question in enumerate(questions, 1):
    # Check if report already exists
    existing = Question_Answer_Report.objects.filter(
        question=question,
        reported_by=test_user
    ).exists()
    
    if existing:
        print(f"\n⏭️  [{idx}] Skipping Q{question.qa_id} - already reported by {test_user.username}")
        continue
    
    # Create new report
    reasons = ['spam', 'inappropriate', 'offensive', 'misinformation', 'other']
    reason = reasons[idx % len(reasons)]
    
    report = Question_Answer_Report.objects.create(
        question=question,
        reported_by=test_user,
        reason=reason,
        description=f"Test report #{idx} - {reason}"
    )
    
    created_count += 1
    print(f"\n✅ [{idx}] Created report for Q{question.qa_id}")
    print(f"    Question: {question.title[:50]}...")
    print(f"    Reason: {reason}")
    print(f"    Report ID: {report.id}")

print("\n" + "="*80)
print(f"SUMMARY: Created {created_count} test reports")
print("="*80)

if created_count > 0:
    print(f"""
Now test the system:
1. Go to: http://localhost:5174/student/courses/{course.course_id}/
2. Scroll to Q&A Forum
3. Click the flag icon on any question
4. You should see:
   - Status badge showing "Menunggu Tinjauan" (Pending Review)
   - Your report details (reason, description)
   - When submitted again, it shows previous reports

Endpoints to test:
- Retrieve reports: GET /api/v1/student/qa-reports/{course.course_id}/?user_id={test_user.id}
- Django Admin: http://localhost:8001/admin/api/question_answer_report/
""")
else:
    print("\n⚠️  All questions already have reports from this user.")

print("\n" + "="*80 + "\n")
