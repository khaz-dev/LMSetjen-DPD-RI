#!/usr/bin/env python
"""
Deep Scan: Find all course reviews where instructor didn't get points
Identifies which instructors are missing points from student reviews
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api import models
from django.db.models import Q, Sum

print("=" * 120)
print(" " * 30 + "DEEP SCAN: INSTRUCTOR POINTS FROM COURSE REVIEWS")
print("=" * 120)

print("\n📚 SYSTEM EXPECTATION:")
print("-" * 120)
print("""
When a STUDENT reviews an INSTRUCTOR'S COURSE:

✓ Student should get: +50 points (rating_given) → StudentPoints
✓ Instructor should get: +50 points (student_rating) → InstructorPoints

This means BOTH users get points from the same review!
Review with role='student' and course_id!=NULL:
  - Reviewer (student): StudentPoints + 50 (they gave a rating)
  - Course Teacher (instructor): InstructorPoints + 50 (they received a rating)
""")

print("\n" + "=" * 120)
print("SCAN: ALL COURSE REVIEWS (reviews with course_id is not NULL)")
print("=" * 120)

# Get all reviews that have a course (not NULL)
course_reviews = models.Review.objects.filter(course__isnull=False, _points_awarded=True).select_related('user', 'course', 'course__teacher')
print(f"\nTotal course reviews with _points_awarded=True: {course_reviews.count()}\n")

issues_found = []
results = {}

for review in course_reviews:
    course = review.course
    teacher = course.teacher
    reviewer = review.user
    
    if not teacher:
        print(f"⚠️  Review {review.id}: Course has no teacher (skipped)")
        continue
    
    review_role = review.role
    
    # Get audit entries
    reviewer_audit = models.PointsAuditLog.objects.filter(review_id=review.id, user=reviewer).first()
    teacher_audit = models.PointsAuditLog.objects.filter(review_id=review.id, user=teacher.user).first()
    
    print(f"\n📌 Review #{review.id}:")
    print(f"   Course: {course.title[:60]}")
    print(f"   Reviewer: {reviewer.username} ({review_role})")
    print(f"   Teacher: {teacher.user.username}")
    print(f"   Rating: {review.rating}⭐")
    
    # Check reviewer (student) got points
    reviewer_got_points = reviewer_audit is not None
    if reviewer_got_points:
        print(f"   ✅ Reviewer got: {reviewer_audit.activity_type} (+{reviewer_audit.points_awarded})")
    else:
        print(f"   ❌ Reviewer: NO POINTS")
        issues_found.append(('reviewer_missing', review))
    
    # Check teacher (instructor) got points
    teacher_got_points = teacher_audit is not None
    if teacher_got_points:
        print(f"   ✅ Teacher got: {teacher_audit.activity_type} (+{teacher_audit.points_awarded})")
    else:
        print(f"   ❌ Teacher: NO POINTS")
        issues_found.append(('teacher_missing', review))
    
    # Store result
    if course.id not in results:
        results[course.id] = {
            'title': course.title,
            'teacher': teacher.user.username,
            'reviews': []
        }
    
    results[course.id]['reviews'].append({
        'reviewer': reviewer.username,
        'reviewer_got_points': reviewer_got_points,
        'teacher_got_points': teacher_got_points,
    })

print("\n\n" + "=" * 120)
print("SUMMARY BY COURSE")
print("=" * 120)

for course_id, data in results.items():
    title = data['title'][:50]
    teacher = data['teacher']
    
    # Count by status
    both_got = sum(1 for r in data['reviews'] if r['reviewer_got_points'] and r['teacher_got_points'])
    only_reviewer = sum(1 for r in data['reviews'] if r['reviewer_got_points'] and not r['teacher_got_points'])
    only_teacher = sum(1 for r in data['reviews'] if not r['reviewer_got_points'] and r['teacher_got_points'])
    neither = sum(1 for r in data['reviews'] if not r['reviewer_got_points'] and not r['teacher_got_points'])
    
    status = "✅" if neither == 0 and only_reviewer == 0 and only_teacher == 0 else "❌"
    print(f"\n{status} {title}...")
    print(f"   Teacher: {teacher}")
    print(f"   Reviews: total={len(data['reviews'])}, both_awarded={both_got}, only_reviewer={only_reviewer}, only_teacher={only_teacher}, neither={neither}")
    
    if only_reviewer > 0:
        print(f"   🚨 {only_reviewer} review(s) where teacher MISSING points")

print("\n\n" + "=" * 120)
print("DETAILED ISSUES FOUND")
print("=" * 120)

if not issues_found:
    print("\n✅ NO ISSUES - All teachers got points for all reviews!")
else:
    print(f"\n❌ {len(issues_found)} ISSUES FOUND:\n")
    
    # Group by issue type
    reviewer_missing = [i for i in issues_found if i[0] == 'reviewer_missing']
    teacher_missing = [i for i in issues_found if i[0] == 'teacher_missing']
    
    if teacher_missing:
        print(f"CRITICAL: {len(teacher_missing)} review(s) where INSTRUCTOR got NO POINTS:\n")
        
        # Group by teacher
        by_teacher = {}
        for issue in teacher_missing:
            review = issue[1]
            teacher = review.course.teacher
            if teacher.id not in by_teacher:
                by_teacher[teacher.id] = {
                    'name': teacher.full_name,
                    'user': teacher.user.username,
                    'reviews': []
                }
            by_teacher[teacher.id]['reviews'].append(review)
        
        for teacher_id, data in by_teacher.items():
            print(f"  Teacher: {data['name']} ({data['user']})")
            print(f"  Missing points from {len(data['reviews'])} review(s):")
            for review in data['reviews']:
                print(f"    - Review {review.id}: {review.course.title[:50]}... (by {review.user.username}, {review.rating}⭐)")
            print()
    
    if reviewer_missing:
        print(f"CRITICAL: {len(reviewer_missing)} review(s) where STUDENT got NO POINTS:\n")
        for issue in reviewer_missing:
            review = issue[1]
            print(f"  Review {review.id}: {review.user.username} reviewed {review.course.title[:50]}...")

print("\n\n" + "=" * 120)
print("INSTRUCTOR POINTS ANALYSIS")
print("=" * 120)

# For each instructor with at least one course
teachers = models.Teacher.objects.filter(course__isnull=False).distinct()
print(f"\nTeachers with courses: {teachers.count()}\n")

for teacher in teachers[:20]:  # Show first 20
    user = teacher.user
    
    # Count their courses
    courses = models.Course.objects.filter(teacher=teacher)
    course_reviews = models.Review.objects.filter(course__in=courses, _points_awarded=True)
    
    # Count how many reviews they got points from
    points_audits = models.PointsAuditLog.objects.filter(user=user, activity_type='student_rating')
    
    ip = models.InstructorPoints.objects.filter(user=user).first()
    
    print(f"{teacher.full_name} ({user.username}):")
    print(f"  Courses: {courses.count()}")
    print(f"  Course Reviews (active): {course_reviews.count()}")
    print(f"  Audit entries for 'student_rating': {points_audits.count()}")
    print(f"  InstructorPoints: {ip.lifetime_points if ip else 0}")
    
    if course_reviews.count() != points_audits.count():
        print(f"  🚨 MISMATCH: {course_reviews.count() - points_audits.count()} review(s) missing instructor points!")
    print()

print("=" * 120 + "\n")
