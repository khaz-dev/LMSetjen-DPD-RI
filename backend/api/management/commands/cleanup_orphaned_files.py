"""
✨ PHASE 4.101.2: Management Command for Cleaning Up Orphaned Files

This command scans the /media/course-file/ directory and deletes files that are
NOT referenced in any Course.image, Course.file, or VariantItem.file field.

Usage:
    python manage.py cleanup_orphaned_files [--dry-run] [--verbose]

Arguments:
    --dry-run: Show what would be deleted without actually deleting
    --verbose: Show detail for each file checked

Why this is needed:
    - Old orphaned files from before Phase 4.101 fix
    - Edge cases where unsaved uploads cleanup didn't run
    - Files uploaded but never saved to database
"""

import os
import sys
from django.core.management.base import BaseCommand
from django.conf import settings
from api.models import Course, VariantItem


class Command(BaseCommand):
    help = 'Clean up orphaned files not referenced in the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed output for each file',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        verbose = options.get('verbose', False)
        
        course_file_path = os.path.join(settings.MEDIA_ROOT, 'course-file')
        
        # Check if directory exists
        if not os.path.exists(course_file_path):
            self.stdout.write(self.style.WARNING(f'❌ Directory not found: {course_file_path}'))
            return
        
        # Collect all file references from database
        referenced_files = set()
        
        # Collect from Course.image
        print('[Cleanup] Scanning Course.image field...')
        for course in Course.objects.all():
            if course.image and 'media/course-file/' in str(course.image):
                # Extract filename from URL
                file_name = os.path.basename(str(course.image).split('?')[0])
                referenced_files.add(file_name)
                if verbose:
                    print(f'  ✅ Referenced: {file_name} (Course: {course.title})')
        
        # Collect from Course.file
        print('[Cleanup] Scanning Course.file field...')
        for course in Course.objects.all():
            if course.file and 'media/course-file/' in str(course.file):
                file_name = os.path.basename(str(course.file).split('?')[0])
                referenced_files.add(file_name)
                if verbose:
                    print(f'  ✅ Referenced: {file_name} (Course: {course.title})')
        
        # Collect from VariantItem.file
        print('[Cleanup] Scanning VariantItem.file field...')
        for item in VariantItem.objects.all():
            if item.file and 'media/course-file/' in str(item.file):
                file_name = os.path.basename(str(item.file).split('?')[0])
                referenced_files.add(file_name)
                if verbose:
                    print(f'  ✅ Referenced: {file_name} (Item: {item.title})')
        
        print(f'\n[Cleanup] Total referenced files in database: {len(referenced_files)}')
        
        # Scan filesystem
        print('[Cleanup] Scanning filesystem...')
        actual_files = set(os.listdir(course_file_path))
        print(f'[Cleanup] Total files on disk: {len(actual_files)}')
        
        # Find orphaned files
        orphaned_files = actual_files - referenced_files
        
        if not orphaned_files:
            self.stdout.write(self.style.SUCCESS('✅ No orphaned files found!'))
            return
        
        self.stdout.write(self.style.WARNING(f'⚠️  Found {len(orphaned_files)} orphaned files:'))
        
        total_size = 0
        deleted_count = 0
        
        for file_name in sorted(orphaned_files):
            file_path = os.path.join(course_file_path, file_name)
            try:
                file_size = os.path.getsize(file_path)
                total_size += file_size
                size_mb = file_size / (1024 * 1024)
                
                self.stdout.write(f'  🗑️  {file_name} ({size_mb:.2f}MB)')
                
                if not dry_run:
                    os.remove(file_path)
                    deleted_count += 1
                    self.stdout.write(self.style.SUCCESS(f'     ✅ DELETED'))
                else:
                    self.stdout.write(self.style.WARNING(f'     (would be deleted in --dry-run mode)'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  ❌ Error processing {file_name}: {e}'))
        
        # Summary
        print('\n' + '='*60)
        print(f'[Cleanup Summary]')
        print(f'  Orphaned files found: {len(orphaned_files)}')
        print(f'  Total size: {total_size / (1024 * 1024):.2f}MB')
        if not dry_run:
            print(f'  Files deleted: {deleted_count}')
            self.stdout.write(self.style.SUCCESS(f'✅ Cleanup complete! Freed {total_size / (1024 * 1024):.2f}MB'))
        else:
            print(f'  Files would be deleted: {len(orphaned_files)}')
            print(f'  Space would be freed: {total_size / (1024 * 1024):.2f}MB')
            self.stdout.write(self.style.WARNING(f'🔍 DRY RUN - No files actually deleted. Run without --dry-run to delete.'))
