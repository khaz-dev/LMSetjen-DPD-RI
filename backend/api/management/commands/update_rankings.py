"""
✨ PHASE 10.2: Management Command to Update and Verify Rankings

This command:
1. Creates StudentPoints/InstructorPoints records for users without them
2. Recalculates ranking points based on course completions, quiz scores, ratings
3. Provides summary statistics
4. Can be scheduled as a periodic task to maintain rankings

Usage:
    python manage.py update_rankings
    python manage.py update_rankings --recalculate  # Full recalculation
    python manage.py update_rankings --verbose  # Detailed output
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.db.models import Count, Sum, Avg, Q, F
from api import models
from datetime import datetime, timedelta


class Command(BaseCommand):
    help = 'Update and verify student and instructor rankings'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--recalculate',
            action='store_true',
            help='Recalculate all rankings from scratch'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed output'
        )
    
    def handle(self, *args, **options):
        """Main command logic"""
        # ✨ PHASE 10.1: Check if ranking system models exist before proceeding
        # The ranking system (StudentPoints, InstructorPoints) was planned but never fully implemented
        # The models don't exist in the database, so this command gracefully skips execution
        try:
            # Try to access the models - they may not exist yet
            _ = models.StudentPoints
            _ = models.InstructorPoints
        except AttributeError:
            self.stdout.write(self.style.WARNING(
                '⚠️  Ranking System Not Implemented\n'
                '✨ The ranking system (StudentPoints, InstructorPoints models) has not been implemented yet.\n'
                'To enable rankings, you need to:\n'
                '1. Create StudentPoints and InstructorPoints models in api/models.py\n'
                '2. Create and run migrations: python manage.py makemigrations && python manage.py migrate\n'
                '3. Run this command again: python manage.py update_rankings\n'
            ))
            return
        
        recalculate = options.get('recalculate', False)
        verbose = options.get('verbose', False)
        
        self.stdout.write(self.style.SUCCESS(
            '✨ Starting Ranking System Update...\n'
        ))
        
        try:
            # Initialize StudentPoints for all students without ranking records
            self.initialize_student_rankings()
            
            # Initialize InstructorPoints for all instructors without ranking records
            self.initialize_instructor_rankings()
            
            # Get current statistics
            stats = self.get_ranking_stats()
            self._print_stats(stats, verbose)
            
            if recalculate:
                self.stdout.write(self.style.WARNING(
                    '\n⚠️  Recalculating all rankings from scratch...\n'
                ))
                self.recalculate_all_rankings()
            
            self.stdout.write(self.style.SUCCESS(
                '\n✅ Ranking system updated successfully!\n'
            ))
            
        except Exception as e:
            raise CommandError(f'Error updating rankings: {str(e)}')
    
    def initialize_student_rankings(self):
        """Create StudentPoints records for students without them"""
        students = models.User.objects.filter(
            Q(current_role='student') | Q(roles__icontains='student')
        )
        
        created_count = 0
        existing_count = 0
        
        for student in students:
            points, created = models.StudentPoints.objects.get_or_create(
                user=student
            )
            if created:
                created_count += 1
            else:
                existing_count += 1
        
        self.stdout.write(
            f'StudentPoints: {created_count} created, {existing_count} existing'
        )
    
    def initialize_instructor_rankings(self):
        """Create InstructorPoints records for instructors without them"""
        instructors = models.User.objects.filter(
            Q(current_role__in=['teacher', 'instructor']) | 
            Q(roles__icontains='teacher') |
            Q(roles__icontains='instructor')
        )
        
        created_count = 0
        existing_count = 0
        
        for instructor in instructors:
            points, created = models.InstructorPoints.objects.get_or_create(
                user=instructor
            )
            if created:
                created_count += 1
            else:
                existing_count += 1
        
        self.stdout.write(
            f'InstructorPoints: {created_count} created, {existing_count} existing'
        )
    
    def recalculate_all_rankings(self):
        """
        Recalculate all ranking points from source data.
        
        Student Points:
        - Course completion: 100 points each
        - Quiz passed: 0-100 points (based on score %)
        - Course rating: 50 points each
        
        Instructor Points:
        - Published courses: 100 points each
        - Student enrollments: 10 points each
        """
        now = timezone.now()
        current_year = now.year
        current_month = now.month
        
        # Reset all StudentPoints to zero
        models.StudentPoints.objects.all().update(
            lifetime_points=0,
            yearly_points=0,
            monthly_points=0,
            yearly_year=current_year,
            monthly_year=current_year,
            monthly_month=current_month
        )
        
        # Recalculate from EnrolledCourse completions
        # Check each enrollment's completion percentage from CompletedLesson records
        self.stdout.write('  Processing course completions...')
        all_enrollments = models.EnrolledCourse.objects.select_related('user').all()
        
        for enrollment in all_enrollments:
            # Use the is_course_completed() method to check completion
            if enrollment.is_course_completed():
                models.StudentPoints.add_points(
                    enrollment.user, 100, 'course_completion',
                    course_id=enrollment.course.id,
                    description=f"Completed course: {enrollment.course.title}"
                )
        
        # Recalculate from QuizAttempt scores
        # ✨ PHASE 10.5: Only award points for HIGHEST score per student-quiz
        self.stdout.write('  Processing quiz attempts...')
        
        # Get unique student-quiz combinations
        from django.db.models import Max
        best_attempts = models.QuizAttempt.objects.filter(
            is_passed=True
        ).values('user_id', 'quiz_id').annotate(
            best_score=Max('score')
        )
        
        quiz_count = 0
        for attempt_combo in best_attempts:
            # Get the best attempt(s) for this student-quiz combo
            best_attempt = models.QuizAttempt.objects.filter(
                user_id=attempt_combo['user_id'],
                quiz_id=attempt_combo['quiz_id'],
                is_passed=True,
                score=attempt_combo['best_score']
            ).first()
            
            if best_attempt and not best_attempt._points_awarded:
                score_points = int(best_attempt.score) if best_attempt.score else 0
                score_points = min(score_points, 100)
                if score_points > 0:
                    models.StudentPoints.add_points(
                        best_attempt.user, score_points, 'quiz_score',
                        quiz_id=best_attempt.quiz.id if best_attempt.quiz else None,
                        course_id=best_attempt.quiz.course.id if best_attempt.quiz and best_attempt.quiz.course else None,
                        description=f"Quiz attempt on {best_attempt.quiz.title if best_attempt.quiz else 'Unknown'}: {int(best_attempt.score)}%"
                    )
                    quiz_count += 1
        
        self.stdout.write(f'  ✅ Processed {quiz_count} best quiz attempts (highest score only)')
        
        # Recalculate from Review ratings
        self.stdout.write('  Processing course ratings...')
        # ✨ PHASE 10.5: Only process active reviews that haven't been awarded yet
        reviews = models.Review.objects.filter(
            active=True,
            _points_awarded=False
        ).select_related('user', 'course')
        
        review_count = 0
        for review in reviews:
            if review.user and review.role == 'student':
                models.StudentPoints.add_points(
                    review.user, 50, 'rating_given',
                    review_id=review.id,
                    course_id=review.course.id if review.course else None,
                    description=f"Gave {review.rating}* rating on: {review.course.title if review.course else 'Course'}"
                )
                review_count += 1
        
        self.stdout.write(f'  ✅ Processed {review_count} course ratings')
        
        # Reset all InstructorPoints to zero
        models.InstructorPoints.objects.all().update(
            lifetime_points=0,
            yearly_points=0,
            monthly_points=0,
            yearly_year=current_year,
            monthly_year=current_year,
            monthly_month=current_month
        )
        
        # Recalculate from published courses
        self.stdout.write('  Processing published courses...')
        published_courses = models.Course.objects.filter(
            is_published_version=True
        ).select_related('teacher', 'teacher__user')
        
        for course in published_courses:
            if course.teacher and course.teacher.user:
                models.InstructorPoints.add_points(
                    course.teacher.user, 100, 'course_published',
                    course_id=course.id,
                    description=f"Published course: {course.title}"
                )
        
        # Recalculate from student enrollments
        self.stdout.write('  Processing student enrollments...')
        enrollments = models.EnrolledCourse.objects.select_related(
            'course', 'course__teacher', 'course__teacher__user'
        )
        
        for enrollment in enrollments:
            if enrollment.course.teacher and enrollment.course.teacher.user:
                models.InstructorPoints.add_points(
                    enrollment.course.teacher.user, 10, 'student_enrollment',
                    course_id=enrollment.course.id,
                    description=f"Student enrolled in: {enrollment.course.title}"
                )
        
        self.stdout.write('  ✅ Ranking recalculation complete')
    
    def get_ranking_stats(self):
        """Get comprehensive ranking statistics"""
        return {
            'total_students_ranked': models.StudentPoints.objects.count(),
            'students_with_points': models.StudentPoints.objects.filter(
                lifetime_points__gt=0
            ).count(),
            'avg_student_points': models.StudentPoints.objects.aggregate(
                avg=Avg('lifetime_points')
            )['avg'] or 0,
            'total_student_points': models.StudentPoints.objects.aggregate(
                total=Sum('lifetime_points')
            )['total'] or 0,
            'top_student': models.StudentPoints.objects.order_by(
                '-lifetime_points'
            ).first(),
            
            'total_instructors_ranked': models.InstructorPoints.objects.count(),
            'instructors_with_points': models.InstructorPoints.objects.filter(
                lifetime_points__gt=0
            ).count(),
            'avg_instructor_points': models.InstructorPoints.objects.aggregate(
                avg=Avg('lifetime_points')
            )['avg'] or 0,
            'total_instructor_points': models.InstructorPoints.objects.aggregate(
                total=Sum('lifetime_points')
            )['total'] or 0,
            'top_instructor': models.InstructorPoints.objects.order_by(
                '-lifetime_points'
            ).first(),
        }
    
    def _print_stats(self, stats, verbose):
        """Print ranking statistics"""
        self.stdout.write(self.style.SUCCESS('\n📊 Ranking Statistics:\n'))
        
        self.stdout.write(f"  Students Ranked: {stats['total_students_ranked']}")
        self.stdout.write(f"  Students with Points: {stats['students_with_points']}")
        self.stdout.write(
            f"  Average Points: {stats['avg_student_points']:.1f}"
        )
        self.stdout.write(
            f"  Total Points Awarded: {stats['total_student_points']:,}"
        )
        
        if stats['top_student']:
            self.stdout.write(
                f"  Top Student: {stats['top_student'].user.full_name} "
                f"({stats['top_student'].lifetime_points} points)"
            )
        
        self.stdout.write('')
        
        self.stdout.write(f"  Instructors Ranked: {stats['total_instructors_ranked']}")
        self.stdout.write(
            f"  Instructors with Points: {stats['instructors_with_points']}"
        )
        self.stdout.write(
            f"  Average Points: {stats['avg_instructor_points']:.1f}"
        )
        self.stdout.write(
            f"  Total Points Awarded: {stats['total_instructor_points']:,}"
        )
        
        if stats['top_instructor']:
            self.stdout.write(
                f"  Top Instructor: {stats['top_instructor'].user.full_name} "
                f"({stats['top_instructor'].lifetime_points} points)"
            )
