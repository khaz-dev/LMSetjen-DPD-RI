"""
Database Optimization and Maintenance Command
Usage: python manage.py optimize_database
"""
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.core.cache import cache
from django.apps import apps
from api.models import Course, Teacher, Category, EnrolledCourse, Review
import time

class Command(BaseCommand):
    help = 'Optimize database performance and update statistics'

    def add_arguments(self, parser):
        parser.add_argument(
            '--full',
            action='store_true',
            help='Run full optimization including VACUUM and REINDEX',
        )
        parser.add_argument(
            '--stats-only',
            action='store_true',
            help='Only update denormalized statistics',
        )
        parser.add_argument(
            '--clear-cache',
            action='store_true',
            help='Clear all cached data',
        )

    def handle(self, *args, **options):
        start_time = time.time()
        
        self.stdout.write(
            self.style.SUCCESS('🚀 Starting database optimization...')
        )

        if options['clear_cache']:
            self.clear_cache()

        if options['stats_only']:
            self.update_statistics()
        else:
            self.update_statistics()
            self.create_indexes()
            
            if options['full']:
                self.vacuum_analyze()
                self.reindex_tables()

        elapsed_time = time.time() - start_time
        self.stdout.write(
            self.style.SUCCESS(
                f'✅ Database optimization completed in {elapsed_time:.2f} seconds'
            )
        )

    def clear_cache(self):
        """Clear all cached data"""
        self.stdout.write('🔄 Clearing cache...')
        cache.clear()
        self.stdout.write(self.style.SUCCESS('✅ Cache cleared'))

    def update_statistics(self):
        """Update denormalized statistics"""
        self.stdout.write('🔄 Updating denormalized statistics...')
        
        # Update course statistics
        courses = Course.objects.filter(platform_status='Published')
        updated_courses = 0
        
        for course in courses.iterator(chunk_size=100):
            try:
                course.update_stats()
                updated_courses += 1
                if updated_courses % 50 == 0:
                    self.stdout.write(f'   Updated {updated_courses} courses...')
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'   Warning: Failed to update course {course.id}: {e}')
                )

        # Update teacher statistics
        teachers = Teacher.objects.all()
        updated_teachers = 0
        
        for teacher in teachers.iterator(chunk_size=100):
            try:
                teacher.update_stats()
                updated_teachers += 1
                if updated_teachers % 20 == 0:
                    self.stdout.write(f'   Updated {updated_teachers} teachers...')
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'   Warning: Failed to update teacher {teacher.id}: {e}')
                )

        # Update category course counts
        categories = Category.objects.all()
        for category in categories:
            try:
                category.update_course_count()
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'   Warning: Failed to update category {category.id}: {e}')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'✅ Updated statistics for {updated_courses} courses, {updated_teachers} teachers'
            )
        )

    def create_indexes(self):
        """Create or recreate performance indexes"""
        self.stdout.write('🔄 Creating performance indexes...')
        
        indexes = [
            # Full-text search indexes
            {
                'name': 'course_search_gin',
                'sql': """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS api_course_search_gin 
                ON api_course USING GIN(
                    to_tsvector('english', title || ' ' || COALESCE(description, ''))
                );
                """
            },
            {
                'name': 'teacher_search_gin',
                'sql': """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS api_teacher_search_gin 
                ON api_teacher USING GIN(
                    to_tsvector('english', full_name || ' ' || COALESCE(bio, ''))
                );
                """
            },
            # Performance indexes
            {
                'name': 'course_performance_idx',
                'sql': """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS api_course_performance_idx 
                ON api_course (platform_status, featured, average_rating DESC, student_count DESC)
                WHERE platform_status = 'Published';
                """
            },
            {
                'name': 'enrollment_user_course_idx',
                'sql': """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS api_enrollment_user_course_idx 
                ON api_enrolledcourse (user_id, course_id, date DESC);
                """
            },
            {
                'name': 'review_course_active_idx',
                'sql': """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS api_review_course_active_idx 
                ON api_review (course_id, active, rating DESC)
                WHERE active = true;
                """
            },
        ]

        with connection.cursor() as cursor:
            for index in indexes:
                try:
                    cursor.execute(index['sql'])
                    self.stdout.write(f'   ✅ Created index: {index["name"]}')
                except Exception as e:
                    self.stdout.write(
                        self.style.WARNING(f'   ⚠️  Index {index["name"]}: {e}')
                    )

    def vacuum_analyze(self):
        """Run VACUUM and ANALYZE on PostgreSQL"""
        self.stdout.write('🔄 Running VACUUM ANALYZE...')
        
        # Get all table names
        tables = []
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public' AND tablename LIKE 'api_%'
            """)
            tables = [row[0] for row in cursor.fetchall()]

        # Run VACUUM ANALYZE on each table
        with connection.cursor() as cursor:
            for table in tables:
                try:
                    cursor.execute(f'VACUUM ANALYZE {table};')
                    self.stdout.write(f'   ✅ Vacuumed: {table}')
                except Exception as e:
                    self.stdout.write(
                        self.style.WARNING(f'   ⚠️  Failed to vacuum {table}: {e}')
                    )

    def reindex_tables(self):
        """Reindex database tables"""
        self.stdout.write('🔄 Reindexing tables...')
        
        with connection.cursor() as cursor:
            try:
                cursor.execute('REINDEX DATABASE django_lms_db;')
                self.stdout.write('   ✅ Database reindexed')
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'   ⚠️  Reindex failed: {e}')
                )