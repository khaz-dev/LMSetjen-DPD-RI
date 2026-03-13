"""
✨ PHASE 10.1: Django Signals for Automatic Point Calculation
Automatically updates StudentPoints and InstructorPoints when:
- Student completes a course
- Student takes a quiz
- Student submits a rating/review
- Instructor publishes a course
- Student enrolls in a course
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
from decimal import Decimal

from . import models as api_models


@receiver(post_save, sender=api_models.CompletedLesson)
def award_points_on_course_completion(sender, instance, created, **kwargs):
    """
    Award student points when they complete ALL lessons in a course.
    Points awarded: 100 points (lifetime, yearly, monthly)
    Triggered when: CompletedLesson is saved and course reaches 100% completion
    
    NOTE: This signal handles course completion by checking CompletedLesson records,
    which is required because CompletedLesson is what's actually saved when a
    student marks lessons as complete (not EnrolledCourse).
    """
    try:
        # Only process if this is a new CompletedLesson being created
        if not created:
            return
        
        # Get the enrollment for this user and course
        enrollment = api_models.EnrolledCourse.objects.filter(
            user=instance.user,
            course=instance.course
        ).first()
        
        if not enrollment:
            return
        
        # Check if course is now completed
        if not enrollment.is_course_completed():
            return  # Course not fully completed yet
        
        # Check if we've already awarded points for this enrollment to prevent duplicates
        existing_points = api_models.StudentPoints.objects.filter(
            user=instance.user
        ).exists()
        
        # Only award if StudentPoints record exists with 0 points for completion
        # (avoid duplicate awards if signal runs multiple times)
        student_points, _ = api_models.StudentPoints.objects.get_or_create(
            user=instance.user
        )
        
        # Award 100 points for course completion
        # ✨ PHASE 10.4: Include audit information
        student_points.add_points(
            instance.user, 
            100, 
            'course_completion',
            course_id=enrollment.course.id,
            description=f"Completed course: {enrollment.course.title}"
        )
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error awarding course completion points: {str(e)}")


@receiver(post_save, sender=api_models.QuizAttempt)
def award_points_on_quiz_completion(sender, instance, created, **kwargs):
    """
    Award student points based on quiz score - HIGHEST SCORE ONLY.
    Points awarded: 0-100 points based on quiz score (0-100%)
    Example: 85% score = 85 points
    
    ✨ PHASE 10.5: Only award points once for the highest score on each quiz per student
    Triggered when: New QuizAttempt is created and is_passed=True
    """
    try:
        # Only award points if quiz is passed
        if not instance.is_passed:
            return
        
        # Check if points already awarded for this attempt
        if instance._points_awarded:
            return
        
        # ✨ PHASE 10.5: Check if this student has a better score already awarded for this quiz
        better_attempts = api_models.QuizAttempt.objects.filter(
            user=instance.user,
            quiz=instance.quiz,
            is_passed=True,
            _points_awarded=True,
            score__gt=instance.score  # Find attempts with higher score that were already awarded
        ).exists()
        
        if better_attempts:
            # This is not the best score, don't award points
            instance._points_awarded = True  # Mark as "processed" but points not awarded
            instance.save(update_fields=['_points_awarded'])
            return
        
        # ✨ PHASE 10.5: If a better score exists but wasn't awarded yet, skip those too
        better_future_attempts = api_models.QuizAttempt.objects.filter(
            user=instance.user,
            quiz=instance.quiz,
            is_passed=True,
            score__gt=instance.score
        ).exists()
        
        if better_future_attempts:
            # Better attempt exists, don't award points yet
            instance._points_awarded = True  # Mark as processed
            instance.save(update_fields=['_points_awarded'])
            return
        
        # This IS the best score - award points
        # Get the score as integer (0-100)
        score_points = int(instance.score) if instance.score else 0
        
        # Ensure points don't exceed 100
        score_points = min(score_points, 100)
        
        if score_points > 0:
            # Get or create StudentPoints
            student_points, _ = api_models.StudentPoints.objects.get_or_create(
                user=instance.user
            )
            
            # Award points based on quiz score
            # ✨ PHASE 10.4: Include audit information
            student_points.add_points(
                instance.user, 
                score_points, 
                'quiz_score',
                quiz_id=instance.quiz.id,
                course_id=instance.quiz.course.id if instance.quiz.course else None,
                description=f"Quiz score {score_points}% on: {instance.quiz.title}"
            )
        
        # Mark points as awarded
        instance._points_awarded = True
        instance.save(update_fields=['_points_awarded'])
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error awarding quiz completion points: {str(e)}")


@receiver(post_save, sender=api_models.Review)
def award_points_on_course_rating(sender, instance, created, **kwargs):
    """
    ✨ PHASE 10.8: Award RATING-BASED POINTS to officers based on course review ratings!
    
    Points awarded:
    - STUDENT (reviewer): Fixed 50 points for submitting any review
    - INSTRUCTOR (course owner): rating * 10 points (capped at 50 for 5-star)
      • 1⭐ = 10 points
      • 2⭐ = 20 points
      • 3⭐ = 30 points
      • 4⭐ = 40 points
      • 5⭐ = 50 points
    
    Triggered when: Review.active=True (approved by admin)
    Works for: Course reviews (course_id not null) AND platform testimonials
    
    ✨ PHASE 10.5: Only award points ONCE via _points_awarded flag
    """
    try:
        # Only process active (approved) reviews
        if not instance.active:
            return
        
        # ✨ PHASE 10.5: Check if points already awarded to prevent duplicates
        if instance._points_awarded:
            return
        
        # ✨ PHASE 4.11: Only award student points if reviewing as student
        if instance.role == 'student' and instance.user:
            # Award points to the student who submitted the review (student gives 50 points)
            student_points, _ = api_models.StudentPoints.objects.get_or_create(
                user=instance.user
            )
            # ✨ PHASE 10.8: Include audit information
            student_points.add_points(
                instance.user, 
                50, 
                'rating_given',
                review_id=instance.id,
                course_id=instance.course.id if instance.course else None,
                description=f"Submitted {instance.rating}★ review for: {instance.course.title if instance.course else 'Testimonial'}"
            )
        
        # ✨ PHASE 4.11: Award instructor points only if course exists
        # Instructor gets RATING-BASED points for receiving ratings on their courses
        if instance.course and instance.course.teacher:
            rating_points = min(int(instance.rating) * 10, 50)  # ✨ PHASE 10.8: rating * 10, capped at 50
            
            instructor_points, _ = api_models.InstructorPoints.objects.get_or_create(
                user=instance.course.teacher.user,
                teacher=instance.course.teacher
            )
            # ✨ PHASE 10.8: Include rating-based calculation in audit
            instructor_points.add_points(
                instance.course.teacher.user, 
                rating_points,  # ✨ PHASE 10.8: rating-based (1★=10, 2★=20, 3★=30, 4★=40, 5★=50)
                'student_rating',
                review_id=instance.id,
                course_id=instance.course.id,
                description=f"Received {instance.rating}★ rating ({rating_points}pts) from {instance.user.full_name if instance.user else 'Learner'} on: {instance.course.title}"
            )
        
        # ✨ PHASE 10.5: Mark points as awarded to prevent duplicates
        instance._points_awarded = True
        instance.save(update_fields=['_points_awarded'])
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error awarding rating points: {str(e)}")


@receiver(post_save, sender=api_models.Course)
def award_points_on_course_publishing(sender, instance, created, **kwargs):
    """
    Award instructor points when course is published.
    Points awarded: 50 points per published course (lifetime, yearly, monthly)
    Triggered when: Course.is_published_version=True AND platform_status='Published'
    
    NOTE: Only processes published version (is_published_version=True) to avoid
    awarding points for draft versions.
    """
    try:
        # Only process if course is a published version
        if not instance.is_published_version:
            return
        
        # Only process if course has Published status
        if instance.platform_status != 'Published':
            return
        
        # Check if we've already awarded points for this publication
        # (to avoid duplicate awards on multiple saves)
        if hasattr(instance, '_publication_points_awarded'):
            return
        
        # Get or create InstructorPoints for the teacher
        if instance.teacher:
            instructor_points, _ = api_models.InstructorPoints.objects.get_or_create(
                user=instance.teacher.user,
                teacher=instance.teacher
            )
            
            # Award 50 points for publishing a new course
            # ✨ PHASE 10.4: Include audit information
            instructor_points.add_points(
                instance.teacher.user, 
                50, 
                'course_published',
                course_id=instance.id,
                description=f"Published course: {instance.title}"
            )
            
            # Mark as processed
            instance._publication_points_awarded = True
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error awarding course publication points: {str(e)}")


@receiver(post_save, sender=api_models.EnrolledCourse)
def award_points_on_student_enrollment(sender, instance, created, **kwargs):
    """
    Award instructor points when a student enrolls in their course.
    Points awarded: 10 points per enrolled student (lifetime, yearly, monthly)
    Triggered when: New EnrolledCourse is created (enrollment happens)
    """
    try:
        # Only process new enrollments
        if not created:
            return
        
        # Get the course teacher and award points
        if instance.course and instance.course.teacher:
            instructor_points, _ = api_models.InstructorPoints.objects.get_or_create(
                user=instance.course.teacher.user,
                teacher=instance.course.teacher
            )
            
            # Award 10 points per student enrollment
            # ✨ PHASE 10.4: Include audit information
            instructor_points.add_points(
                instance.course.teacher.user, 
                10, 
                'student_enrollment',
                course_id=instance.course.id,
                description=f"Student {instance.user.full_name if instance.user else 'Learner'} enrolled in: {instance.course.title}"
            )
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error awarding enrollment points: {str(e)}")
