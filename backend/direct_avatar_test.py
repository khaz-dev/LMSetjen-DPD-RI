#!/usr/bin/env python3
"""
DIRECT TEST: Avatar upload flow
This tests the EXACT endpoint that the frontend is calling
"""

import os
import sys
import django
from io import BytesIO
from PIL import Image

os.environ['DJANGO_SETTINGS_MODULE'] = 'backend.settings'
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from userauths.models import Profile

User = get_user_model()

print("=" * 80)
print("DIRECT AVATAR UPLOAD TEST")
print("=" * 80)

# Get or create a test user
print("\n1️⃣ Getting test user...")
user = User.objects.filter(username='testuser').first()
if not user:
    print("   ❌ No testuser found!")
    sys.exit(1)

print(f"   ✅ User: {user.username} (ID: {user.id})")

# Get or create profile
print(f"\n2️⃣ Checking profile for user {user.id}...")
profile = Profile.objects.get(user=user)
print(f"   ✅ Profile found (ID: {profile.id})")
print(f"   Current image: {profile.image if profile.image else 'NONE'}")

# Create a test image
print("\n3️⃣ Creating test image...")
img = Image.new('RGB', (200, 200), color='green')
img_bytes = BytesIO()
img.save(img_bytes, format='JPEG')
img_bytes.seek(0)

test_image = SimpleUploadedFile(
    name='test_crop.jpg',
    content=img_bytes.getvalue(),
    content_type='image/jpeg'
)
print(f"   ✅ Test image created: {test_image.name} ({test_image.size} bytes)")

# Make the PATCH request using Django test client
print(f"\n4️⃣ Sending PATCH to /api/v1/user/profile/{user.id}/...")
client = Client()

patch_data = {
    'full_name': user.full_name,
    'about': profile.about or '',
    'country': profile.country or '',
    'image': test_image
}

response = client.patch(
    f'/api/v1/user/profile/{user.id}/',
    data=patch_data
)

print(f"   Status code: {response.status_code}")
if response.status_code in [200, 201]:
    print("   ✅ Request succeeded!")
    print(f"   Response: {response.json()}")
else:
    print(f"   ❌ Request FAILED!")
    print(f"   Response: {response.content.decode()}")

# Check if file was actually saved
print("\n5️⃣ Checking if file is in media folder...")
media_path = "d:\\Project\\LMSetjen DPD RI\\backend\\media\\user_profile_images"
if os.path.exists(media_path):
    files = os.listdir(media_path)
    print(f"   Files in {media_path}:")
    if files:
        for f in files:
            full_path = os.path.join(media_path, f)
            size = os.path.getsize(full_path)
            print(f"      - {f} ({size} bytes)")
    else:
        print("      (folder is empty)")
else:
    print(f"   ❌ Folder doesn't exist: {media_path}")

# Refetch profile to check if image URL is in database
print("\n6️⃣ Refetching profile from database...")
profile.refresh_from_db()
print(f"   Image field value: {profile.image}")
print(f"   Image field exists: {os.path.exists(profile.image.path) if profile.image else 'N/A'}")

print("\n" + "=" * 80)
print("TEST COMPLETE")
print("=" * 80)

# Summary
if response.status_code in [200, 201]:
    if profile.image:
        print("\n✅ SUCCESS: Image was saved to database!")
        print(f"   Path: {profile.image}")
        if profile.image.path and os.path.exists(profile.image.path):
            print("   ✅ File actually exists on disk!")
        else:
            print("   ❌ File doesn't exist on disk (saved to DB but not file system)")
    else:
        print("\n❌ PARTIAL FAIL: API succeeded but no image in profile")
else:
    print("\n❌ COMPLETE FAIL: API request failed")
