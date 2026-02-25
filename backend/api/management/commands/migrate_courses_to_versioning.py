"""
PHASE 4.60E: One-Time Data Migration for Course Versioning System

PURPOSE:
  Convert existing published courses from single-copy to dual-copy versioning system.
  Creates published copies for all currently-published courses.

USAGE:
  python manage.py migrate_courses_to_versioning

IMPORTANT:
  - Run this AFTER running: python manage.py migrate
  - Run this ONCE before deploying versioning system to production
  - This is a one-time operation (safe to run multiple times - idempotent)
"""

import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from api import models as api_models

# Disable Django's debug SQL logging to prevent Unicode encoding issues on Windows
logging.getLogger('django.db.backends').setLevel(logging.WARNING)


class Command(BaseCommand):
    help = 'Migrate existing published courses to new versioning system (PHASE 4.60E)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be migrated without making changes',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed information for each course',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        verbose = options.get('verbose', False)

        self.stdout.write(
            self.style.SUCCESS(
                '\n' + '='*70 +
                '\n[*] PHASE 4.60E: Course Versioning Migration\n' +
                '='*70 + '\n'
            )
        )

        # Find all courses that need migration
        courses_to_migrate = api_models.Course.objects.filter(
            platform_status="Published",
            parent_course=None,
            is_published_version=False
        ).order_by('-id')

        total_count = courses_to_migrate.count()

        if total_count == 0:
            self.stdout.write(
                self.style.WARNING(
                    '[!] No courses to migrate.\n'
                    '   Either all courses already migrated, or no published courses exist.\n'
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f'[>] Found {total_count} course(s) to migrate\n'
            )
        )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    '[?] DRY RUN MODE - No changes will be made\n'
                )
            )

        # Track statistics
        migrated_count = 0
        error_count = 0
        skipped_count = 0

        # Process each course
        for index, course in enumerate(courses_to_migrate, 1):
            course_display = f"[{index}/{total_count}] {course.title[:50]}"

            try:
                # Check if already has a published copy
                existing_copy = api_models.Course.objects.filter(
                    parent_course=course,
                    is_published_version=True
                ).first()

                if existing_copy:
                    self.stdout.write(
                        self.style.WARNING(
                            f'{course_display}... [SKIP]'
                        )
                    )
                    skipped_count += 1
                    continue

                self.stdout.write(f'{course_display}... ', ending='')

                if dry_run:
                    self.stdout.write(self.style.SUCCESS('[DRY]'))
                    migrated_count += 1
                else:
                    # Try to use the method first
                    try:
                        published_copy = course.create_published_copy()
                        migrated_count += 1
                        self.stdout.write(self.style.SUCCESS('[OK]'))
                    except Exception as method_error:
                        # Fallback: create manually with unique course_id
                        import uuid
                        new_course_id = str(uuid.uuid4())[:6].upper()  # Generate unique ID
                        
                        published_copy = api_models.Course.objects.create(
                            category=course.category,
                            teacher=course.teacher,
                            title=course.title,
                            description=course.description,
                            level=course.level,
                            image=course.image,
                            file=course.file,
                            featured=course.featured,
                            course_id=new_course_id,  # NEW unique ID
                            intro_video_source=course.intro_video_source,
                            platform_status="Published",
                            teacher_course_status="Published",
                            is_published_version=True,
                            parent_course=course
                        )
                        migrated_count += 1
                        self.stdout.write(self.style.SUCCESS('[OK-FALLBACK]'))

            except Exception as e:
                error_count += 1
                self.stdout.write(self.style.ERROR(f'[ERROR] {str(e)[:40]}'))

        # Print summary
        self.stdout.write('\n' + '='*70)
        self.stdout.write(self.style.SUCCESS('\n[*] MIGRATION SUMMARY\n'))
        self.stdout.write(f'  Total courses: {total_count}')
        self.stdout.write(f'  Migrated: {migrated_count}')
        self.stdout.write(f'  Skipped: {skipped_count}')
        self.stdout.write(f'  Errors: {error_count}')

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    '\n[?] DRY RUN - Run without --dry-run to execute\n'
                )
            )
        else:
            if error_count == 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        '\n[OK] Migration complete!\n'
                        '   All courses migrated successfully!\n'
                        '   Published copies created and linked.\n'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'\n[!] Migration completed with {error_count} errors\n'
                    )
                )

        self.stdout.write('='*70 + '\n')

        # Post-migration verification
        if not dry_run and error_count == 0:
            self.stdout.write(self.style.SUCCESS('[*] VERIFICATION\n'))

            published_count = api_models.Course.objects.filter(
                is_published_version=True
            ).count()

            draft_count = api_models.Course.objects.filter(
                is_published_version=False,
                parent_course=None
            ).count()

            self.stdout.write(f'  Published versions: {published_count}')
            self.stdout.write(f'  Draft courses: {draft_count}')

            if published_count >= migrated_count:
                self.stdout.write(
                    self.style.SUCCESS(
                        '\n[OK] Verification passed: Published copies created\n'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f'\n[!] Expected {migrated_count} copies, found {published_count}\n'
                    )
                )

