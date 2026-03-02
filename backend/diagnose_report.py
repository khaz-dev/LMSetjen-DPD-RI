#!/usr/bin/env python
"""
Deep database diagnostic to find the mismatch
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from api.models import Question_Answer, Question_Answer_Report

User = get_user_model()

print("\n" + "="*100)
print("DEEP DATABASE DIAGNOSTIC - FINDING THE REPORT MISMATCH")
print("="*100)

# Get user 776
try:
    user = User.objects.get(id=776)
    print(f"\n✅ User found: {user.username} (ID: 776)")
except:
    print("\n❌ User 776 not found!")
    exit(1)

# Get Q212915
try:
    question = Question_Answer.objects.get(qa_id='212915')
    print(f"\n✅ Question found: Q{question.qa_id}")
    print(f"   Title: {question.title[:60]}...")
    print(f"   Course ID: {question.course_id}")
    print(f"   Course Title: {question.course.title}")
except:
    print("\n❌ Question Q212915 not found!")
    exit(1)

# Check ALL reports for user 776
print(f"\n" + "-"*100)
print(f"[USER 776 - ALL REPORTS]")
user_reports = Question_Answer_Report.objects.filter(reported_by=user)
print(f"Total reports by user 776: {user_reports.count()}")

if user_reports.exists():
    for idx, report in enumerate(user_reports, 1):
        print(f"\n[Report {idx}] ID: {report.id}")
        print(f"  Question: Q{report.question.qa_id} - {report.question.title[:40]}...")
        print(f"  Question's Course: {report.question.course_id} ({report.question.course.title})")
        print(f"  Status: {report.status}")

# Check if report exists for THIS specific Q212915 by user 776
print(f"\n" + "-"*100)
print(f"[LOOKING FOR REPORT: User 776 + Q212915]")
specific_report = Question_Answer_Report.objects.filter(
    reported_by=user,
    question=question
).first()

if specific_report:
    print(f"✅ FOUND! Report ID: {specific_report.id}")
    print(f"   Status: {specific_report.status}")
    print(f"   Question Course ID: {specific_report.question.course_id}")
else:
    print(f"❌ NOT FOUND")

# Now let's test the exact API filter
print(f"\n" + "-"*100)
print(f"[TESTING API FILTER: user_id=776, course_id=168460]")
api_results = Question_Answer_Report.objects.filter(
    reported_by=776,
    question__course_id=168460
)
print(f"Results: {api_results.count()} reports")

if api_results.exists():
    for report in api_results:
        print(f"  - Report ID {report.id}: Q{report.question.qa_id}, Status {report.status}")
else:
    print("❌ EMPTY! This explains the API returning []")

# Let's check what courses have the question Q212915
print(f"\n" + "-"*100)
print(f"[QUESTION Q212915 DETAILED INFO]")
print(f"  Question ID (pk): {question.id}")
print(f"  Question qa_id: {question.qa_id}")
print(f"  Course: {question.course_id} - {question.course.title}")
print(f"  Course ID value: {question.course_id}")

# Double-check: is there maybe another question with same qa_id?
qa_matches = Question_Answer.objects.filter(qa_id='212915')
print(f"\n  Total questions with qa_id='212915': {qa_matches.count()}")

print("\n" + "="*100)
print("DIAGNOSIS:")
print("="*100)

if specific_report and specific_report.question.course_id == 168460:
    print("✅ Report EXISTS and BELONGS to course 168460")
    print("   Problem: API filter works, but maybe frontend not calling it right?")
elif specific_report and specific_report.question.course_id != 168460:
    print(f"⚠️  Report EXISTS but belongs to DIFFERENT COURSE: {specific_report.question.course_id}")
    print(f"   Frontend is querying course 168460, but question belongs to {specific_report.question.course_id}")
else:
    print("❌ Report DOES NOT EXIST for user 776 + question Q212915")
    print("   Need to check Django admin if report ID 3 is actually for this user/question")

print("\n" + "="*100 + "\n")
