#!/usr/bin/env python
"""
Create sample ranking data for StudentPoints and InstructorPoints tables.

This script generates realistic ranking data to test the ranking widgets.
The points are calculated using the signal logic:
- Course enrollment: +10 points to instructor
- Course completion: +100 points to student
- Quiz passing: 0-100 points based on score
- Course review: +50 points to student, +rating*10 to instructor (max 50)
"""

import os
import sys
import django
from datetime import datetime, timedelta

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from api.models import StudentPoints, InstructorPoints, User, Teacher, EnrolledCourse, Review
from userauths.models import Profile
from django.utils import timezone

print("=" * 60)
print("Creating Sample Ranking Data")
print("=" * 60)

# Get or create sample users
print("\n1. Setting up sample users...")

# Find students for rankings
students = User.objects.filter(is_student=True).exclude(is_instructor=True)[:5]
if len(students) < 5:
    # Create additional students
    for i in range(5 - len(students)):
        user, created = User.objects.get_or_create(
            email=f'student{i}@test.com',
            defaults={
                'username': f'student{i}',
                'full_name': f'Student {i + 1}',
                'is_active': True,
                'is_student': True
            }
        )
        if created:
            # Create profile
            profile, _ = Profile.objects.get_or_create(user=user)
            print(f"   ✓ Created student: {user.full_name}")
        students = list(students) + [user]

# Find teachers for rankings
teachers = Teacher.objects.all()[:5]
if not teachers:
    print("   ! Warning: No teachers found. Creating sample teachers...")
    teacher_users = User.objects.filter(is_teacher=True)[:5]
    for user in teacher_users:
        teacher, created = Teacher.objects.get_or_create(
            user=user,
            defaults={
                'full_name': user.full_name,
            }
        )
        if created:
            print(f"   ✓ Created teacher: {teacher.full_name}")
        teachers = list(teachers) + [teacher]

print(f"   ✓ Found {len(students)} students and {len(teachers)} teachers")

# Create StudentPoints records
print("\n2. Creating StudentPoints records...")
student_points_created = 0

for idx, student in enumerate(students, 1):
    # Skip if already exists
    if StudentPoints.objects.filter(user=student).exists():
        print(f"   ⏭️  Student {student.full_name} already has ranking data, skipping...")
        continue
    
    # Generate realistic points
    # Students with higher ranks have much higher points
    lifetime_base = 100 * (len(students) - idx + 1)  # 500, 400, 300, 200, 100
    yearly_base = int(lifetime_base * 0.6)
    monthly_base = int(yearly_base * 0.4)
    
    # Add some variation to make it more realistic
    import random
    lifetime = lifetime_base + random.randint(0, 50)
    yearly = yearly_base + random.randint(0, 30)
    monthly = monthly_base + random.randint(0, 20)
    
    sp = StudentPoints.objects.create(
        user=student,
        lifetime_points=lifetime,
        yearly_points=yearly,
        monthly_points=monthly,
        yearly_year=timezone.now().year,
        monthly_year=timezone.now().year,
        monthly_month=timezone.now().month
    )
    
    print(f"   ✓ {idx}. {student.full_name}: {lifetime} lifetime, {yearly} yearly, {monthly} monthly")
    student_points_created += 1

# Create InstructorPoints records
print("\n3. Creating InstructorPoints records...")
instructor_points_created = 0

for idx, teacher in enumerate(teachers, 1):
    # Get the user associated with this teacher
    user = teacher.user if teacher else None
    if not user:
        print(f"   ⏭️  Teacher {teacher.full_name} has no associated user, skipping...")
        continue
    
    # Skip if already exists
    if InstructorPoints.objects.filter(user=user).exists():
        print(f"   ⏭️  Teacher {teacher.full_name} already has ranking data, skipping...")
        continue
    
    # Generate realistic points
    # Instructors with higher ranks have much higher points
    lifetime_base = 150 * (len(teachers) - idx + 1)  # 750, 600, 450, 300, 150
    yearly_base = int(lifetime_base * 0.65)
    monthly_base = int(yearly_base * 0.35)
    
    # Add some variation
    import random
    lifetime = lifetime_base + random.randint(0, 75)
    yearly = yearly_base + random.randint(0, 45)
    monthly = monthly_base + random.randint(0, 25)
    
    ip = InstructorPoints.objects.create(
        user=user,  # Must provide user field (not nullable)
        teacher=teacher,  # Also provide teacher reference
        lifetime_points=lifetime,
        yearly_points=yearly,
        monthly_points=monthly,
        yearly_year=timezone.now().year,
        monthly_year=timezone.now().year,
        monthly_month=timezone.now().month
    )
    
    print(f"   ✓ {idx}. {teacher.full_name}: {lifetime} lifetime, {yearly} yearly, {monthly} monthly")
    instructor_points_created += 1

# Verify the data was created
print("\n4. Verifying created data...")
sp_count = StudentPoints.objects.count()
ip_count = InstructorPoints.objects.count()

print(f"\n✅ Total StudentPoints: {sp_count}")
print(f"✅ Total InstructorPoints: {ip_count}")

# Show top rankings
print("\n5. Top Rankings:")
print("\n   Students (by lifetime points):")
for sp in StudentPoints.objects.order_by('-lifetime_points')[:5]:
    print(f"   🥇 {sp.user.full_name}: {sp.lifetime_points} lifetime points")

print("\n   Instructors (by lifetime points):")
for ip in InstructorPoints.objects.order_by('-lifetime_points')[:5]:
    print(f"   🥇 {ip.teacher.full_name}: {ip.lifetime_points} lifetime points")

print("\n" + "=" * 60)
print("✅ Sample ranking data created successfully!")
print("=" * 60)
print("\nNote: The ranking widgets should now display this data.")
print("If the frontend still shows no data:")
print("1. Clear browser cache (Ctrl+Shift+Delete)")
print("2. Hard refresh the page (Ctrl+Shift+R)")
print("3. Check browser console for API errors")
