"""
Diagnostic script to test /admin/user-detail/<id>/ endpoint
"""

import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from api import models as api_models
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

print("=" * 80)
print("DIAGNOSTIC: AdminUserDetailAPIView 500 Error")
print("=" * 80)

# Check if test user exists
try:
    user = User.objects.get(id=2)
    print(f"✅ User 2 exists: {user.username}")
except User.DoesNotExist:
    print("❌ User 2 does not exist")
    exit(1)

# Test Teacher access
print("\n--- Testing Teacher Access ---")
try:
    teacher = api_models.Teacher.objects.get(user=user)
    print(f"✅ Teacher found for user: {teacher.full_name}")
    
    # Test courses access
    courses = api_models.Course.objects.filter(teacher=teacher)
    print(f"✅ Courses count: {courses.count()}")
    
    # Test published courses
    published = courses.filter(platform_status='Published').count()
    print(f"✅ Published courses: {published}")
    
    # Test enrolled courses
    enrolled = api_models.EnrolledCourse.objects.filter(course__teacher=teacher)
    print(f"✅ Enrolled courses count: {enrolled.count()}")
    
    # Test reviews
    reviews = api_models.Review.objects.filter(course__teacher=teacher)
    print(f"✅ Reviews count: {reviews.count()}")
    
except api_models.Teacher.DoesNotExist:
    print(f"ℹ️  No Teacher record (expected if user is student)")
except Exception as e:
    print(f"❌ Error accessing teacher data: {type(e).__name__}: {e}")

# Test Student access
print("\n--- Testing Student Access ---")
try:
    # Test enrollments
    enrollments = api_models.EnrolledCourse.objects.filter(user=user)
    print(f"✅ Enrollments count: {enrollments.count()}")
    
    # Test completed courses
    completed = enrollments.filter(completed=True).count()
    print(f"✅ Completed courses: {completed}")
    
    # Test in-progress courses
    in_progress = enrollments.filter(completed=False).count()
    print(f"✅ In-progress courses: {in_progress}")
    
    # Test certificates
    try:
        certs = api_models.Certificate.objects.filter(user=user).count()
        print(f"✅ Certificates: {certs}")
    except Exception as cert_error:
        print(f"⚠️  Certificate error: {type(cert_error).__name__}: {cert_error}")
        
except Exception as e:
    print(f"❌ Error accessing student data: {type(e).__name__}: {e}")

# Test serializer
print("\n--- Testing UserSerializer ---")
try:
    from api.serializer import UserSerializer
    serializer = UserSerializer(user)
    print(f"✅ Serializer data keys: {list(serializer.data.keys())}")
    print(f"   Data: {serializer.data}")
except Exception as e:
    print(f"❌ Serializer error: {type(e).__name__}: {e}")

# Test the full retrieve logic
print("\n--- Testing Full Retrieve Logic ---")
try:
    from api.serializer import UserSerializer
    from api import models as api_models
    
    serializer = UserSerializer(user)
    user_data = serializer.data.copy()
    
    # Add enrollment statistics if student
    if user.role == 'student':
        enrollments = api_models.EnrolledCourse.objects.filter(user=user)
        
        # Calculate completed courses using the is_course_completed() method
        completed_count = 0
        for enrollment in enrollments:
            if enrollment.is_course_completed():
                completed_count += 1
        
        user_data['enrollment_stats'] = {
            'total_enrollments': enrollments.count(),
            'completed_courses': completed_count,
            'in_progress_courses': enrollments.count() - completed_count,
            'certificates_earned': api_models.Certificate.objects.filter(user=user).count()
        }
        print(f"✅ Student stats added: {user_data['enrollment_stats']}")
    
    # Add teaching statistics if teacher
    elif user.role == 'teacher':
        try:
            teacher = api_models.Teacher.objects.get(user=user)
            courses = api_models.Course.objects.filter(teacher=teacher)
            user_data['teaching_stats'] = {
                'total_courses': courses.count(),
                'published_courses': courses.filter(platform_status='Published').count(),
                'total_students': api_models.EnrolledCourse.objects.filter(course__teacher=teacher).count(),
                'total_reviews': api_models.Review.objects.filter(course__teacher=teacher).count()
            }
            print(f"✅ Teacher stats added: {user_data['teaching_stats']}")
        except api_models.Teacher.DoesNotExist:
            user_data['teaching_stats'] = None
            print(f"ℹ️  No teacher record found (user may not have teacher profile)")
    
    print(f"✅ Full user_data keys: {list(user_data.keys())}")
    
except Exception as e:
    print(f"❌ Retrieve logic error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("DIAGNOSTIC COMPLETE")
print("=" * 80)
