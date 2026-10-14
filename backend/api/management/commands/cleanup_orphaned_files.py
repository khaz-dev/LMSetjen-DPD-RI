"""
✨ PHASE 4.101.2: Management Command for Cleaning Up Orphaned Files

This command scans:
1. /media/course-file/ directory and deletes files that are NOT referenced in any Course.image, Course.file, or VariantItem.file field.
2. /media/learning_modules/ directory and deletes orphaned extracted folders and abandoned LearningModule packages not linked to any course.

Usage:
    python manage.py cleanup_orphaned_files [--dry-run] [--verbose] [--hours-threshold=24]

Arguments:
    --dry-run: Show what would be deleted without actually deleting
    --verbose: Show detail for each file checked
    --hours-threshold: Minimum age in hours for unlinked LearningModule instances to be cleaned (default: 24)
"""

import os
import sys
import shutil
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
from api.models import Course, VariantItem, LearningModule


class Command(BaseCommand):
    help = 'Clean up orphaned files and unlinked learning modules not referenced in the database'

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
        parser.add_argument(
            '--hours-threshold',
            type=int,
            default=24,
            help='Age threshold in hours for abandoned modules (default: 24)',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        verbose = options.get('verbose', False)
        hours_threshold = options.get('hours_threshold', 24)
        
        total_size = 0
        deleted_count = 0
        
        # =====================================================================
        # 1. CLEANUP ORPHANED COURSE FILES (/media/course-file/)
        # =====================================================================
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== [1/2] Scanning /media/course-file/ ==='))
        course_file_path = os.path.join(settings.MEDIA_ROOT, 'course-file')
        
        if os.path.exists(course_file_path):
            referenced_files = set()
            
            for course in Course.objects.all():
                if course.image and 'media/course-file/' in str(course.image):
                    file_name = os.path.basename(str(course.image).split('?')[0])
                    referenced_files.add(file_name)
                    if verbose:
                        self.stdout.write(f'  [OK] Referenced (Course image): {file_name}')
                if course.file and 'media/course-file/' in str(course.file):
                    file_name = os.path.basename(str(course.file).split('?')[0])
                    referenced_files.add(file_name)
                    if verbose:
                        self.stdout.write(f'  [OK] Referenced (Course file): {file_name}')
            
            for item in VariantItem.objects.all():
                if item.file and 'media/course-file/' in str(item.file):
                    file_name = os.path.basename(str(item.file).split('?')[0])
                    referenced_files.add(file_name)
                    if verbose:
                        self.stdout.write(f'  [OK] Referenced (VariantItem file): {file_name}')
            
            self.stdout.write(f'  Referenced files in database: {len(referenced_files)}')
            actual_files = set(os.listdir(course_file_path))
            orphaned_files = actual_files - referenced_files
            
            if orphaned_files:
                self.stdout.write(self.style.WARNING(f'  [WARN] Found {len(orphaned_files)} orphaned course files:'))
                for file_name in sorted(orphaned_files):
                    file_path = os.path.join(course_file_path, file_name)
                    try:
                        file_size = os.path.getsize(file_path)
                        total_size += file_size
                        size_mb = file_size / (1024 * 1024)
                        self.stdout.write(f'    [-] {file_name} ({size_mb:.2f}MB)')
                        
                        if not dry_run:
                            os.remove(file_path)
                            deleted_count += 1
                            self.stdout.write(self.style.SUCCESS(f'       [DELETED]'))
                        else:
                            self.stdout.write(self.style.WARNING(f'       (would be deleted in --dry-run)'))
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'    [ERROR] {e}'))
            else:
                self.stdout.write(self.style.SUCCESS('  [OK] No orphaned course files found.'))
        else:
            self.stdout.write(self.style.WARNING(f'  Directory not found: {course_file_path}'))

        # =====================================================================
        # 2. CLEANUP UNLINKED / ABANDONED LEARNING MODULES & EXTRACTED DIRS
        # =====================================================================
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== [2/2] Scanning /media/learning_modules/ & LearningModule DB ==='))
        cutoff_time = timezone.now() - timedelta(hours=hours_threshold)
        
        # A. Find abandoned LearningModule records (no course attached and older than threshold)
        abandoned_modules = LearningModule.objects.filter(
            course__isnull=True,
            assigned_courses__isnull=True,
            variant_items__isnull=True,
            tanggal_dibuat__lt=cutoff_time
        )
        
        if abandoned_modules.exists():
            self.stdout.write(self.style.WARNING(f'  [WARN] Found {abandoned_modules.count()} abandoned LearningModule records (> {hours_threshold}h unlinked):'))
            for mod in abandoned_modules:
                self.stdout.write(f'    [-] Module #{mod.id}: "{mod.judul}" (Created: {mod.tanggal_dibuat.strftime("%Y-%m-%d %H:%M")})')
                
                # Check package file size
                if mod.file_zip and os.path.exists(mod.file_zip.path):
                    try:
                        fsize = os.path.getsize(mod.file_zip.path)
                        total_size += fsize
                        if not dry_run:
                            os.remove(mod.file_zip.path)
                            self.stdout.write(self.style.SUCCESS(f'       [DELETED] Package file ({fsize / (1024*1024):.2f}MB)'))
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'       [ERROR] deleting package file: {e}'))
                
                # Check extracted folder
                extracted_dir = os.path.join(settings.MEDIA_ROOT, 'learning_modules', f'extracted_{mod.id}')
                if os.path.exists(extracted_dir):
                    try:
                        dir_size = sum(os.path.getsize(os.path.join(dirpath, f)) for dirpath, _, filenames in os.walk(extracted_dir) for f in filenames)
                        total_size += dir_size
                        if not dry_run:
                            shutil.rmtree(extracted_dir, ignore_errors=True)
                            self.stdout.write(self.style.SUCCESS(f'       [DELETED] Extracted dir ({dir_size / (1024*1024):.2f}MB)'))
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'       [ERROR] deleting extracted dir: {e}'))
                
                if not dry_run:
                    mod.delete()
                    deleted_count += 1
                    self.stdout.write(self.style.SUCCESS(f'       [DELETED] Database record'))
                else:
                    self.stdout.write(self.style.WARNING(f'       (would delete DB record and files in --dry-run)'))
        else:
            self.stdout.write(self.style.SUCCESS('  [OK] No abandoned unlinked LearningModule records found.'))
            
        # B. Check for orphaned extracted_* folders whose module ID no longer exists in DB
        lm_dir = os.path.join(settings.MEDIA_ROOT, 'learning_modules')
        if os.path.exists(lm_dir):
            all_module_ids = set(LearningModule.objects.values_list('id', flat=True))
            for entry in os.listdir(lm_dir):
                if entry.startswith('extracted_'):
                    try:
                        mod_id = int(entry.replace('extracted_', ''))
                        if mod_id not in all_module_ids:
                            folder_path = os.path.join(lm_dir, entry)
                            dir_size = sum(os.path.getsize(os.path.join(dirpath, f)) for dirpath, _, filenames in os.walk(folder_path) for f in filenames)
                            total_size += dir_size
                            self.stdout.write(self.style.WARNING(f'    [-] Orphaned extracted folder: {entry} ({dir_size / (1024*1024):.2f}MB)'))
                            if not dry_run:
                                shutil.rmtree(folder_path, ignore_errors=True)
                                deleted_count += 1
                                self.stdout.write(self.style.SUCCESS('       [DELETED]'))
                            else:
                                self.stdout.write(self.style.WARNING('       (would delete folder in --dry-run)'))
                    except ValueError:
                        continue
        
        # =====================================================================
        # SUMMARY
        # =====================================================================
        self.stdout.write('\n' + '='*60)
        self.stdout.write('[Cleanup Summary]')
        self.stdout.write(f'  Total space: {total_size / (1024 * 1024):.2f}MB')
        if not dry_run:
            self.stdout.write(f'  Items deleted: {deleted_count}')
            self.stdout.write(self.style.SUCCESS(f'[OK] Cleanup complete! Freed {total_size / (1024 * 1024):.2f}MB'))
        else:
            self.stdout.write(self.style.WARNING(f'[INFO] DRY RUN - No files actually deleted. Run without --dry-run to delete.'))
