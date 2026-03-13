#!/usr/bin/env python3
import os
import sys
import django
from io import BytesIO

os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.contrib.auth import get_user_model
from userauths.models import Profile
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile

User = get_user_model()

print("=" * 80)
print("QUICK AVATAR SAVE TEST")
print("=" * 80)

# Get test user
user = User.objects.filter(username='testuser').first()
if not user:
    print("❌ No testuser found!")
    sys.exit(1)

print(f"✅ Found user: {user.username} (ID: {user.id})")

# Get profile
profile = Profile.objects.get(user=user)
print(f"✅ Profile: ID {profile.id}")
print(f"   Current image: {profile.image if profile.image else 'NONE'}")

# Create image
img = Image.new('RGB', (100, 100), color='blue')
img_bytes = BytesIO()
img.save(img_bytes, format='JPEG')
img_bytes.seek(0)

test_image = SimpleUploadedFile('test.jpg', img_bytes.getvalue(), content_type='image/jpeg')

# Direct save
print("\n📥 Attempting to save image directly...")
try:
    profile.image = test_image
    profile.save()
    print(f"✅ SAVED! Image field now: {profile.image}")
    
    if profile.image and profile.image.path:
        exists = os.path.exists(profile.image.path)
        print(f"   File exists on disk: {exists}")
        if exists:
            size = os.path.getsize(profile.image.path)
            print(f"   File size: {size} bytes")
    else:
        print(f"   ⚠️  No file path available")
        
except Exception as e:
    print(f"❌ FAILED: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
