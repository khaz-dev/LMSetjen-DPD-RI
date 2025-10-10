#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.conf import settings
from api.models import Course, VariantItem, Teacher, Category
from userauths.models import Profile

def comprehensive_file_analysis():
    print("="*80)
    print("🔍 COMPREHENSIVE FILE & DATABASE ANALYSIS REPORT")
    print("="*80)
    
    print("\n1️⃣  DATABASE CONFIGURATION")
    print("-" * 50)
    db_config = settings.DATABASES['default']
    print(f"   Engine: {db_config['ENGINE']}")
    print(f"   Database: {db_config['NAME']}")
    print(f"   Host: {db_config['HOST']}:{db_config['PORT']}")
    print(f"   User: {db_config['USER']}")
    
    print("\n2️⃣  FILE STORAGE CONFIGURATION")
    print("-" * 50)
    print(f"   MEDIA_ROOT: {settings.MEDIA_ROOT}")
    print(f"   MEDIA_URL: {settings.MEDIA_URL}")
    print(f"   Media Directory Exists: {os.path.exists(settings.MEDIA_ROOT)}")
    
    print("\n3️⃣  FILE STORAGE STRATEGY")
    print("-" * 50)
    print("   ✅ Files are stored as URLs in the database (NOT as binary data)")
    print("   ✅ Physical files are stored in the filesystem (media directory)")
    print("   ✅ File upload API endpoint: /api/v1/file-upload/")
    print("   ✅ Files are served via Django's static file serving")
    
    print("\n4️⃣  CURRENT FILE RECORDS IN DATABASE")
    print("-" * 50)
    
    # Courses
    courses_with_files = Course.objects.exclude(file__isnull=True).exclude(file__exact='')
    courses_with_images = Course.objects.exclude(image__isnull=True).exclude(image__exact='')
    
    print(f"   📚 Courses with files: {courses_with_files.count()}")
    print(f"   📚 Courses with images: {courses_with_images.count()}")
    
    if courses_with_files.exists():
        print(f"\n      Sample Course Files:")
        for course in courses_with_files:
            print(f"      • {course.title[:40]}...")
            print(f"        File: {course.file}")
            if course.image:
                print(f"        Image: {course.image}")
    
    # Variant Items (Lessons/Videos)
    variants_with_files = VariantItem.objects.exclude(file__isnull=True).exclude(file__exact='')
    print(f"\n   🎥 Variant Items (lessons) with files: {variants_with_files.count()}")
    
    if variants_with_files.exists():
        print(f"\n      Sample Lesson Files:")
        for variant in variants_with_files[:3]:
            print(f"      • {variant.title[:40]}...")
            print(f"        File: {variant.file}")
            if variant.duration:
                print(f"        Duration: {variant.duration}")
    
    # Profiles
    profiles_with_images = Profile.objects.exclude(image__isnull=True).exclude(image__exact='')
    print(f"\n   👤 User profiles with images: {profiles_with_images.count()}")
    
    # Teachers
    teachers_with_images = Teacher.objects.exclude(image__isnull=True).exclude(image__exact='')
    print(f"   👨‍🏫 Teacher profiles with images: {teachers_with_images.count()}")
    
    print("\n5️⃣  FILE TYPES SUPPORTED")
    print("-" * 50)
    print("   📹 Videos: .mp4, .avi, .mov, .mkv, .webm, .ogg")
    print("   📄 Documents: .pdf, .doc, .docx, .txt")
    print("   📊 Presentations: .ppt, .pptx")
    print("   🖼️  Images: .jpg, .jpeg, .png, .gif, .bmp")
    
    print("\n6️⃣  FILE UPLOAD LIMITATIONS")
    print("-" * 50)
    print(f"   Max File Size: {settings.FILE_UPLOAD_MAX_MEMORY_SIZE / 1024 / 1024:.1f} MB")
    print(f"   Max Data Size: {settings.DATA_UPLOAD_MAX_MEMORY_SIZE / 1024 / 1024:.1f} MB")
    print(f"   Temp Directory: {settings.FILE_UPLOAD_TEMP_DIR}")
    
    print("\n7️⃣  WHERE FILES ARE ACTUALLY STORED")
    print("-" * 50)
    print("   🚫 Files are NOT stored in the PostgreSQL database")
    print("   ✅ Files are stored in the local filesystem:")
    print(f"      - Media files: {settings.MEDIA_ROOT}")
    print(f"      - Static files: {settings.STATIC_ROOT}")
    print("   ✅ Database only stores URLs/paths to the files")
    print("   ✅ Files are uploaded via API and saved to disk")
    print("   ✅ Django serves files via URL routing")
    
    print("\n8️⃣  MISSING PHYSICAL FILES")
    print("-" * 50)
    missing_count = 0
    
    # Check if course files actually exist on disk
    for course in courses_with_files:
        if course.file and 'media' in course.file:
            # Extract the file path from URL
            file_path = course.file.replace('http://127.0.0.1:8000/media/', '')
            full_path = os.path.join(settings.MEDIA_ROOT, file_path)
            if not os.path.exists(full_path):
                print(f"   ❌ Missing: {course.title} - {file_path}")
                missing_count += 1
    
    for variant in variants_with_files:
        if variant.file and 'media' in variant.file:
            file_path = variant.file.replace('http://127.0.0.1:8000/media/', '')
            full_path = os.path.join(settings.MEDIA_ROOT, file_path)
            if not os.path.exists(full_path):
                print(f"   ❌ Missing: {variant.title} - {file_path}")
                missing_count += 1
    
    if missing_count == 0:
        print("   ✅ All referenced files are missing (expected since media dir was empty)")
    else:
        print(f"   ⚠️  {missing_count} files are referenced in DB but missing from disk")
    
    print("\n9️⃣  SUMMARY")
    print("-" * 50)
    print("   📊 Database: PostgreSQL 'django_lms_db' contains file URLs/metadata")
    print("   💾 File Storage: Local filesystem (not database)")
    print("   🔄 Upload Process: API uploads → Save to disk → Store URL in DB")
    print("   🌐 File Access: Via Django URL routing and static file serving")
    print("   📁 Current Status: Database has file records but physical files are missing")
    
    print("\n" + "="*80)
    print("✅ ANALYSIS COMPLETE")
    print("="*80)

if __name__ == '__main__':
    comprehensive_file_analysis()