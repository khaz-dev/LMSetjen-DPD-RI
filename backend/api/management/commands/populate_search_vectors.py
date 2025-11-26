from django.core.management.base import BaseCommand
from django.db import connection
from api.models import Course


class Command(BaseCommand):
    help = 'Populate search_vector field for all courses'

    def handle(self, *args, **options):
        total_courses = Course.objects.count()
        self.stdout.write(f'Found {total_courses} courses to process')
        
        # Use raw SQL to populate search vectors with joined fields
        with connection.cursor() as cursor:
            # This SQL command updates search_vector for all courses
            # combining title (weight A), description (weight B), and teacher name (weight C)
            sql = """
            UPDATE api_course 
            SET search_vector = 
                setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
                setweight(to_tsvector('english', 
                    COALESCE((
                        SELECT full_name FROM userauths_user 
                        WHERE userauths_user.id = api_course.teacher_id
                    ), '')
                ), 'C')
            WHERE search_vector IS NULL OR search_vector = '';
            """
            cursor.execute(sql)
            rows_updated = cursor.rowcount
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully updated search vectors for {rows_updated} courses'
            )
        )
