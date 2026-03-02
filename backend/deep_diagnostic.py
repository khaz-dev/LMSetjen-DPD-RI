#!/usr/bin/env python
"""
Deep diagnostic to find the ID mismatch issue
Checks:
1. What questions exist in each course
2. What reports exist and which questions they reference
3. What the API is returning 
4. Type mismatches (string vs int)
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Question_Answer, Question_Answer_Report, Question_Answer_Message_Report, Course
from django.contrib.auth import get_user_model

User = get_user_model()

print("\n" + "="*100)
print("SUPER COMPREHENSIVE DIAGNOSTIC FOR REPORT ID MISMATCH")
print("="*100)

# Test User: robertparker13183@gmail.com (ID: 776)
try:
    user = User.objects.get(id=776)
    print(f"\n✅ Found user: {user} (ID: {user.id})\n")
except User.DoesNotExist:
    print(f"\n❌ User 776 not found\n")
    exit(1)

# ===== SECTION 1: All Reports in Database =====
print("\n" + "-"*100)
print("SECTION 1: ALL REPORTS IN DATABASE")
print("-"*100)

all_qa_reports = Question_Answer_Report.objects.all()
print(f"\nTotal Question_Answer_Report records: {all_qa_reports.count()}")
for report in all_qa_reports[:20]:
    print(f"  Report ID {report.id}:")
    print(f"    - question: {report.question}")
    print(f"    - question.id (DB): {report.question.id}")
    print(f"    - question.qa_id (ShortUUID): {report.question.qa_id} (type: {type(report.question.qa_id).__name__})")
    print(f"    - reported_by: {report.reported_by}")
    print(f"    - status: {report.status}")
    print(f"    - created_at: {report.created_at if hasattr(report, 'created_at') else 'N/A'}")

# ===== SECTION 2: Reports by User 776 =====
print("\n" + "-"*100)
print("SECTION 2: REPORTS SUBMITTED BY USER 776")
print("-"*100)

user_reports = Question_Answer_Report.objects.filter(reported_by=776)
print(f"\nReports by user 776: {user_reports.count()}")
for report in user_reports:
    print(f"  Report ID {report.id}:")
    print(f"    - Question qa_id: {report.question.qa_id} (type: {type(report.question.qa_id).__name__})")
    print(f"    - Question course_id: {report.question.course_id}")
    print(f"    - Status: {report.status}")

# ===== SECTION 3: What API Would Return =====
print("\n" + "-"*100)
print("SECTION 3: WHAT API RETURNS FOR USER 776")
print("-"*100)

# Simulate API call with course_id=168460
print(f"\n[Simulating API endpoint: GET /api/v1/student/qa-reports/168460/?user_id=776]")

question_reports = list(
    Question_Answer_Report.objects.filter(
        reported_by=776
    ).values(
        'id', 
        'question__qa_id',
        'question__course_id',
        'status', 
        'reason', 
        'reported_at'
    )
)

print(f"\nAPI Response - Question Reports: {len(question_reports)}")
if question_reports:
    for r in question_reports:
        print(f"  Report ID {r['id']}:")
        print(f"    - question__qa_id: {r['question__qa_id']} (type: {type(r['question__qa_id']).__name__})")
        print(f"    - question__course_id: {r['question__course_id']}")
        print(f"    - status: {r['status']}")

# ===== SECTION 4: Questions in Course 47 and 168460 =====
print("\n" + "-"*100)
print("SECTION 4: QUESTIONS IN RELEVANT COURSES")
print("-"*100)

for course_id in [47, 168460]:
    try:
        course = Course.objects.get(id=course_id)
        print(f"\nCourse {course_id}: {course.title}")
        
        questions = Question_Answer.objects.filter(course_id=course_id)
        print(f"  Total questions: {questions.count()}")
        
        for q in questions[:5]:
            print(f"    - qa_id: {q.qa_id} (type: {type(q.qa_id).__name__}), id: {q.id}, user: {q.user}")
            
    except Course.DoesNotExist:
        print(f"\nCourse {course_id}: NOT FOUND")

# ===== SECTION 5: Type Analysis =====
print("\n" + "-"*100)
print("SECTION 5: TYPE ANALYSIS - POTENTIAL MISMATCH")
print("-"*100)

if user_reports.exists():
    first_report = user_reports.first()
    qa_id_from_db = first_report.question.qa_id
    
    print(f"\nFrom database Question_Answer object:")
    print(f"  qa_id = {qa_id_from_db}")
    print(f"  type = {type(qa_id_from_db).__name__}")
    print(f"  repr = {repr(qa_id_from_db)}")
    
    print(f"\nType conversions:")
    print(f"  str(qa_id) = {str(qa_id_from_db)}")
    print(f"  int(qa_id) = ???")  # This will fail if qa_id is not numeric
    try:
        print(f"  int(qa_id) = {int(qa_id_from_db)}")
    except ValueError:
        print(f"  int(qa_id) = ERROR - cannot convert to int (expected, qa_id is ShortUUID string)")

print("\n" + "="*100)
print("END OF DIAGNOSTIC")
print("="*100 + "\n")
