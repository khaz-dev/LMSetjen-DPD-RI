#!/usr/bin/env python
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.db import connection
from django.conf import settings
import glob

def check_database_tables():
    print("="*60)
    print("📊 DATABASE ANALYSIS REPORT")
    print("="*60)
    
    # Database connection info
    db_config = settings.DATABASES['default']
    print(f"🗄️  Database Engine: {db_config['ENGINE']}")
    print(f"🗄️  Database Name: {db_config['NAME']}")
    print(f"🗄️  Database Host: {db_config['HOST']}")
    print(f"🗄️  Database Port: {db_config['PORT']}")
    print(f"🗄️  Database User: {db_config['USER']}")
    
    # Get all tables
    with connection.cursor() as cursor:
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
        tables = cursor.fetchall()
        
    print(f"\n📋 TOTAL TABLES: {len(tables)}")
    print("-" * 40)
    
    for table in sorted(tables):
        table_name = table[0]
        # Get row count for each table
        try:
            with connection.cursor() as cursor:
                cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
                count = cursor.fetchone()[0]
            print(f"• {table_name:<35} ({count} records)")
        except Exception as e:
            print(f"• {table_name:<35} (Error: {str(e)[:30]})")

def check_file_storage():
    print("\n" + "="*60)
    print("📁 FILE STORAGE ANALYSIS")
    print("="*60)
    
    # Media settings
    print(f"📂 MEDIA_ROOT: {settings.MEDIA_ROOT}")
    print(f"🌐 MEDIA_URL: {settings.MEDIA_URL}")
    print(f"📂 STATIC_ROOT: {settings.STATIC_ROOT}")
    print(f"🌐 STATIC_URL: {settings.STATIC_URL}")
    
    # Check if media directory exists
    media_exists = os.path.exists(settings.MEDIA_ROOT)
    print(f"📁 Media Directory Exists: {media_exists}")
    
    if media_exists:
        # Count files in media directory
        media_files = glob.glob(os.path.join(settings.MEDIA_ROOT, "**", "*"), recursive=True)
        media_files = [f for f in media_files if os.path.isfile(f)]
        print(f"📄 Files in Media Directory: {len(media_files)}")
        
        if media_files:
            print("\n📋 Media Files Found:")
            for file in media_files[:10]:  # Show first 10 files
                rel_path = os.path.relpath(file, settings.MEDIA_ROOT)
                file_size = os.path.getsize(file)
                print(f"  • {rel_path} ({file_size} bytes)")
            if len(media_files) > 10:
                print(f"  ... and {len(media_files) - 10} more files")
    
    # Check static files
    if hasattr(settings, 'STATICFILES_DIRS'):
        for static_dir in settings.STATICFILES_DIRS:
            if os.path.exists(static_dir):
                static_files = glob.glob(os.path.join(static_dir, "**", "*"), recursive=True)
                static_files = [f for f in static_files if os.path.isfile(f)]
                print(f"📄 Files in {static_dir}: {len(static_files)}")

def check_file_models():
    print("\n" + "="*60)
    print("💾 FILE-RELATED DATABASE RECORDS")
    print("="*60)
    
    from django.apps import apps
    
    # Check for file-related models
    file_fields_found = []
    
    for model in apps.get_models():
        model_name = f"{model._meta.app_label}.{model.__name__}"
        
        for field in model._meta.fields:
            field_type = type(field).__name__
            if any(x in field_type.lower() for x in ['file', 'image', 'url']):
                file_fields_found.append({
                    'model': model_name,
                    'field': field.name,
                    'type': field_type
                })
    
    print("🔍 File/Image/URL Fields Found:")
    for item in file_fields_found:
        print(f"  • {item['model']}.{item['field']} ({item['type']})")
    
    # Check specific models for file data
    try:
        from api.models import Course, VariantItem, Teacher
        from userauths.models import User, Profile
        
        print(f"\n📊 Records with Files:")
        
        # Courses with files
        courses_with_files = Course.objects.exclude(file__isnull=True).exclude(file__exact='')
        courses_with_images = Course.objects.exclude(image__isnull=True).exclude(image__exact='')
        print(f"  • Courses with files: {courses_with_files.count()}")
        print(f"  • Courses with images: {courses_with_images.count()}")
        
        # Variant Items with files  
        variants_with_files = VariantItem.objects.exclude(file__isnull=True).exclude(file__exact='')
        print(f"  • Variant Items with files: {variants_with_files.count()}")
        
        # Users/Profiles with images
        profiles_with_images = Profile.objects.exclude(image__isnull=True).exclude(image__exact='')
        print(f"  • User profiles with images: {profiles_with_images.count()}")
        
        # Show some example URLs
        if courses_with_files.exists():
            print(f"\n📋 Sample Course File URLs:")
            for course in courses_with_files[:5]:
                print(f"  • Course: {course.title[:30]}...")
                print(f"    File: {course.file}")
                if course.image:
                    print(f"    Image: {course.image}")
        
    except Exception as e:
        print(f"❌ Error checking models: {e}")

if __name__ == '__main__':
    try:
        check_database_tables()
        check_file_storage()
        check_file_models()
        
        print("\n" + "="*60)
        print("✅ ANALYSIS COMPLETE")
        print("="*60)
        
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()