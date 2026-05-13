#!/usr/bin/env python
"""
Comprehensive diagnostic script to trace avatar upload issues
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.contrib.auth import get_user_model
from userauths.models import Profile
from api.serializer import ProfileSerializer
from api.models import Teacher
from django.core.files.base import ContentFile
from io import BytesIO
from PIL import Image

User = get_user_model()

print("\n" + "="*80)
print("AVATAR UPLOAD SYSTEM DIAGNOSTIC")
print("="*80)

# Test 1: Check Profile Model Field
print("\n[TEST 1] Profile Model Field Type")
print("-" * 80)
profile_image_field = Profile._meta.get_field('image')
print(f"   Field name: {profile_image_field.name}")
print(f"   Field type: {profile_image_field.get_internal_type()}")
print(f"   Upload to: {getattr(profile_image_field, 'upload_to', 'N/A')}")
print(f"   Max length: {getattr(profile_image_field, 'max_length', 'N/A')}")
print(f"   Null allowed: {profile_image_field.null}")
print(f"   Blank allowed: {profile_image_field.blank}")

# Test 2: Check Teacher Model Field
print("\n[TEST 2] Teacher Model Field Type")
print("-" * 80)
teacher_image_field = Teacher._meta.get_field('image')
print(f"   Field name: {teacher_image_field.name}")
print(f"   Field type: {teacher_image_field.get_internal_type()}")
print(f"   Upload to: {getattr(teacher_image_field, 'upload_to', 'N/A')}")
print(f"   Max length: {getattr(teacher_image_field, 'max_length', 'N/A')}")
print(f"   Null allowed: {teacher_image_field.null}")
print(f"   Blank allowed: {teacher_image_field.blank}")

# Test 3: Check ProfileSerializer
print("\n[TEST 3] ProfileSerializer Configuration")
print("-" * 80)
print(f"   Serializer class: {ProfileSerializer}")
serializer_fields = ProfileSerializer().fields
print(f"   Image field in serializer: {'image' in serializer_fields}")
if 'image' in serializer_fields:
    image_field_serializer = serializer_fields['image']
    print(f"   Image serializer type: {type(image_field_serializer).__name__}")
    print(f"   Image serializer read_only: {getattr(image_field_serializer, 'read_only', 'N/A')}")

# Test 4: Check to_representation method
print("\n[TEST 4] ProfileSerializer.to_representation() Logic")
print("-" * 80)
# Get first user with a profile
try:
    user = User.objects.filter(profile__isnull=False).first()
    if user:
        profile = user.profile
        serializer = ProfileSerializer(profile)
        
        print(f"   Test user: {user.username}")
        print(f"   Profile exists: {profile is not None}")
        print(f"   Raw image value: {repr(profile.image)}")
        print(f"   Image type: {type(profile.image)}")
        print(f"   Image bool (is set): {bool(profile.image)}")
        
        if profile.image:
            print(f"   str(image): {str(profile.image)}")
            print(f"   hasattr 'url': {hasattr(profile.image, 'url')}")
            if hasattr(profile.image, 'url'):
                print(f"   image.url: {profile.image.url}")
        
        # Check serialized output
        serialized = serializer.data
        print(f"   Serialized image: {repr(serialized.get('image'))}")
    else:
        print("   No user with profile found for testing")
except Exception as e:
    print(f"   Error: {e}")

# Test 5: Check MEDIA_ROOT and MEDIA_URL settings
print("\n[TEST 5] Django Media Settings")
print("-" * 80)
from django.conf import settings
print(f"   MEDIA_ROOT: {settings.MEDIA_ROOT}")
print(f"   MEDIA_ROOT exists: {os.path.exists(settings.MEDIA_ROOT)}")
print(f"   MEDIA_URL: {settings.MEDIA_URL}")

media_images_dir = os.path.join(settings.MEDIA_ROOT, 'user_profile_images')
print(f"   User images dir exists: {os.path.exists(media_images_dir)}")
if os.path.exists(media_images_dir):
    files = os.listdir(media_images_dir)
    print(f"   Files in user_profile_images: {files}")

# Test 6: Simulate creation of a test image and save
print("\n[TEST 6] Test Image Upload Flow")
print("-" * 80)
try:
    # Create a dummy test user
    test_user, created = User.objects.get_or_create(
        username='test_avatar_upload',
        defaults={'email': 'test_avatar@example.com'}
    )
    
    # Get or create profile
    test_profile, created = Profile.objects.get_or_create(user=test_user)
    
    print(f"   Test user created: {created}")
    print(f"   Test profile exists: {test_profile is not None}")
    
    # Create a test image
    img = Image.new('RGB', (100, 100), color='red')
    img_io = BytesIO()
    img.save(img_io, format='JPEG')
    img_io.seek(0)
    
    # Save the image
    test_profile.image.save('test_avatar.jpg', ContentFile(img_io.getvalue()), save=True)
    
    print(f"   Image uploaded: {bool(test_profile.image)}")
    print(f"   Image path: {test_profile.image}")
    print(f"   Image URL: {test_profile.image.url}")
    print(f"   Image file exists: {test_profile.image.storage.exists(test_profile.image.name)}")
    
    # Serialize the profile
    serializer = ProfileSerializer(test_profile)
    serialized_image = serializer.data.get('image')
    print(f"   Serialized image value: {repr(serialized_image)}")
    
    # Clean up
    test_profile.image.delete()
    
except Exception as e:
    print(f"   Error during upload test: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80)
print("DIAGNOSTIC COMPLETE")
print("="*80 + "\n")
