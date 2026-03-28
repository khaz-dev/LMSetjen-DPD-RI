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


# ✨ PHASE 53.1: CREATE ACTIVITY LOG ENTRIES - THE CULPRIT!
# These signal handlers actually create ActivityLog entries when activities happen


@receiver(post_save, sender=api_models.EnrolledCourse)
def log_course_enrollment(sender, instance, created, **kwargs):
    """Log when student enrolls in a course"""
    if not created:
        return
    
    try:
        api_models.ActivityLog.objects.create(
            user=instance.user,
            activity_type='enrollment',
            role_at_time='student',
            course=instance.course,
            title=f"Pendaftaran Kursus: {instance.course.title}",
            description=f"Berhasil mendaftar untuk kursus {instance.course.title}",
            success=True,
            metadata={
                'enrollment_id': instance.id,
                'course_id': instance.course.id,
                'course_title': instance.course.title
            }
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging course enrollment: {str(e)}")


@receiver(post_save, sender=api_models.CompletedLesson)
def log_lesson_completion(sender, instance, created, **kwargs):
    """Log when student completes a lesson"""
    if not created:
        return
    
    try:
        api_models.ActivityLog.objects.create(
            user=instance.user,
            activity_type='lesson_completed',
            role_at_time='student',
            course=instance.course,
            lesson=instance.variant_item,
            title=f"Selesaikan Pelajaran: {instance.variant_item.title}",
            description=f"Menyelesaikan pelajaran '{instance.variant_item.title}' dari kursus {instance.course.title}",
            success=True,
            metadata={
                'completed_lesson_id': instance.id,
                'variant_item_id': instance.variant_item.variant_item_id,
                'lesson_title': instance.variant_item.title,
                'course_id': instance.course.id,
                'course_title': instance.course.title
            }
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging lesson completion: {str(e)}")


@receiver(post_save, sender=api_models.VideoProgress)
def log_video_completion(sender, instance, created, **kwargs):
    """Log when student watches video and reaches 95% completion"""
    # Only log if just updated (not created) and reached 95%
    if created:
        return
    
    try:
        # Check if this is the first time reaching 95%
        # Use a flag to ensure we only log once per video per user
        progress_percent = float(instance.progress_percentage or 0)
        
        if progress_percent >= 95.0:
            # Check if we already logged video completion for this video
            existing_log = api_models.ActivityLog.objects.filter(
                user=instance.user,
                activity_type='video_completed',
                lesson=instance.variant_item,
                course=instance.course
            ).exists()
            
            if existing_log:
                return  # Already logged
            
            # Log video completion
            api_models.ActivityLog.objects.create(
                user=instance.user,
                activity_type='video_completed',
                role_at_time='student',
                course=instance.course,
                lesson=instance.variant_item,
                title=f"Video Selesai: {instance.variant_item.title}",
                description=f"Menonton video '{instance.variant_item.title}' hingga {int(progress_percent)}%",
                duration_seconds=instance.duration_seconds,
                success=True,
                metadata={
                    'video_progress_id': instance.id,
                    'progress_percentage': progress_percent,
                    'variant_item_id': instance.variant_item.variant_item_id,
                    'lesson_title': instance.variant_item.title,
                    'course_id': instance.course.id,
                    'course_title': instance.course.title
                }
            )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging video completion: {str(e)}")


@receiver(post_save, sender=api_models.QuizAttempt)
def log_quiz_activity(sender, instance, created, **kwargs):
    """Log when student attempts or completes a quiz"""
    try:
        if created:
            # Log quiz attempt
            api_models.ActivityLog.objects.create(
                user=instance.user,
                activity_type='quiz_attempted',
                role_at_time='student',
                course=instance.quiz.course if instance.quiz.course else None,
                quiz=instance.quiz,
                title=f"Kerjakan Kuis: {instance.quiz.title}",
                description=f"Mengerjakan kuis '{instance.quiz.title}' dengan skor {instance.score}%",
                points_awarded=int(instance.score) if instance.score else 0,
                success=instance.is_passed,
                metadata={
                    'quiz_attempt_id': instance.id,
                    'quiz_id': instance.quiz.id,
                    'quiz_title': instance.quiz.title,
                    'score': instance.score,
                    'is_passed': instance.is_passed,
                    'course_id': instance.quiz.course.id if instance.quiz.course else None
                }
            )
        else:
            # Log quiz result change if status changed
            # Check if we need to create a quiz_passed or quiz_failed log
            activity_type = 'quiz_passed' if instance.is_passed else 'quiz_failed'
            
            # Check if already logged
            existing_log = api_models.ActivityLog.objects.filter(
                user=instance.user,
                activity_type=activity_type,
                quiz=instance.quiz,
                metadata__quiz_attempt_id=instance.id
            ).exists()
            
            if not existing_log:
                api_models.ActivityLog.objects.create(
                    user=instance.user,
                    activity_type=activity_type,
                    role_at_time='student',
                    course=instance.quiz.course if instance.quiz.course else None,
                    quiz=instance.quiz,
                    title=f"{'Lulus' if instance.is_passed else 'Gagal'} Kuis: {instance.quiz.title}",
                    description=f"{'Lulus' if instance.is_passed else 'Gagal'} kuis '{instance.quiz.title}' dengan skor {instance.score}%",
                    points_awarded=int(instance.score) if instance.is_passed and instance.score else 0,
                    success=instance.is_passed,
                    metadata={
                        'quiz_attempt_id': instance.id,
                        'quiz_id': instance.quiz.id,
                        'quiz_title': instance.quiz.title,
                        'score': instance.score,
                        'is_passed': instance.is_passed,
                        'course_id': instance.quiz.course.id if instance.quiz.course else None
                    }
                )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging quiz activity: {str(e)}")


@receiver(post_save, sender=api_models.Certificate)
def log_certificate_earned(sender, instance, created, **kwargs):
    """Log when student earns a certificate"""
    if not created:
        return
    
    try:
        api_models.ActivityLog.objects.create(
            user=instance.user,
            activity_type='certificate_earned',
            role_at_time='student',
            course=instance.course,
            title=f"Raih Sertifikat: {instance.course.title}",
            description=f"Berhasil meraih sertifikat untuk kursus {instance.course.title}",
            success=True,
            points_awarded=100,
            metadata={
                'certificate_id': instance.id,
                'certificate_number': instance.certificate_number,
                'course_id': instance.course.id,
                'course_title': instance.course.title,
                'issue_date': str(instance.issue_date)
            }
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging certificate: {str(e)}")


@receiver(post_save, sender=api_models.Review)
def log_review_posted(sender, instance, created, **kwargs):
    """Log when student posts a review (already has review posting in signals)"""
    if not created:
        return
    
    # Only log approved reviews
    if not instance.active:
        return
    
    try:
        api_models.ActivityLog.objects.create(
            user=instance.user,
            activity_type='review_posted' if instance.course else 'discussion_participated',
            role_at_time='student',
            course=instance.course,
            title=f"Posting Review: {instance.course.title if instance.course else 'Testimoni'}",
            description=f"Meninggalkan review dari {instance.rating}★ untuk {instance.course.title if instance.course else 'platform'}",
            success=True,
            points_awarded=50,
            metadata={
                'review_id': instance.id,
                'rating': instance.rating,
                'course_id': instance.course.id if instance.course else None,
                'review_text': instance.review[:100] if instance.review else ""
            }
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging review: {str(e)}")


@receiver(post_save, sender=api_models.Question_Answer)
def log_question_asked(sender, instance, created, **kwargs):
    """Log when student asks a question"""
    if not created:
        return
    
    try:
        api_models.ActivityLog.objects.create(
            user=instance.user,
            activity_type='question_asked',
            role_at_time='student',
            course=instance.course,
            title=f"Buat Pertanyaan: {instance.title[:50]}",
            description=f"Mengajukan pertanyaan di {instance.course.title}",
            success=True,
            metadata={
                'question_id': instance.qa_id,
                'question_title': instance.title,
                'course_id': instance.course.id,
                'course_title': instance.course.title
            }
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging question asked: {str(e)}")


@receiver(post_save, sender=api_models.CompletedLesson)
def award_points_on_course_completion(sender, instance, created, **kwargs):
    """
    Award student points when they complete ALL lessons in a course.
    Points awarded: 100 points (lifetime, yearly, monthly)
    Triggered when: CompletedLesson is saved and course reaches 100% completion
    
    NOTE: This signal handles course completion by checking CompletedLesson records,
    which is required because CompletedLesson is what's actually saved when a
    student marks lessons as complete (not EnrolledCourse).
    
    ✨ PHASE 46: CRITICAL - Temporarily DISABLED this signal due to transaction rollback issues
    The signal calls enrollment.is_course_completed() which queries CompletedLesson records
    WITHIN the atomic() block, potentially causing issues with nested transactions.
    """
    # ✨ PHASE 46: Temporarily disable signal to fix lesson completion
    return  # EXIT EARLY - DISABLE ALL LOGIC BELOW
    
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


# ✨ PHASE 53+: LOG INSTRUCTOR ACTIVITIES
# Track all teaching-related actions in ActivityLog with role_at_time='instructor'


@receiver(post_save, sender=api_models.Course)
def log_instructor_course_activities(sender, instance, created, **kwargs):
    """
    Log instructor activities when course is created, updated, or published.
    
    Activity types logged:
    - 'course_created': When a new course is first saved
    - 'course_updated': When course metadata is updated  
    - 'course_published': When course.platform_status changes to 'Published'
    """
    try:
        if not instance.teacher or not instance.teacher.user:
            return
        
        instructor = instance.teacher.user
        
        # Log when course is first created
        if created:
            api_models.ActivityLog.objects.create(
                user=instructor,
                activity_type='course_created',
                role_at_time='instructor',
                course=instance,
                title=f"Membuat Kursus: {instance.title}",
                description=f"Membuat kursus baru '{instance.title}' dalam kategori {instance.category.title if instance.category else 'Tidak ditentukan'}",
                success=True,
                metadata={
                    'course_id': instance.course_id if hasattr(instance, 'course_id') else str(instance.id),
                    'course_title': instance.title,
                    'category_id': instance.category.id if instance.category else None,
                    'category_title': instance.category.title if instance.category else None,
                    'level': instance.level
                }
            )
            return  # Don't process further on creation
        
        # Log when course is published for the first time or republished
        # Check if platform_status changed to Published
        # Get the previous instance from database to compare
        try:
            previous = api_models.Course.objects.get(pk=instance.pk)
            # If status changed to Published, log it
            if previous.platform_status != 'Published' and instance.platform_status == 'Published':
                api_models.ActivityLog.objects.create(
                    user=instructor,
                    activity_type='course_published',
                    role_at_time='instructor',
                    course=instance,
                    title=f"Publikasikan Kursus: {instance.title}",
                    description=f"Mempublikasikan kursus '{instance.title}' untuk siswa",
                    success=True,
                    metadata={
                        'course_id': instance.course_id if hasattr(instance, 'course_id') else str(instance.id),
                        'course_title': instance.title,
                        'published_at': str(timezone.now()),
                        'is_published_version': instance.is_published_version
                    }
                )
            # Log general course updates (but not publish events, which are logged above)
            elif previous.platform_status == instance.platform_status and previous != instance:
                # Only log if significant fields changed
                significant_fields = {'title', 'description', 'level', 'category_id'}
                changed = False
                for field in significant_fields:
                    if getattr(previous, field, None) != getattr(instance, field, None):
                        changed = True
                        break
                
                if changed:
                    api_models.ActivityLog.objects.create(
                        user=instructor,
                        activity_type='course_updated',
                        role_at_time='instructor',
                        course=instance,
                        title=f"Update Kursus: {instance.title}",
                        description=f"Memperbarui detail kursus '{instance.title}'",
                        success=True,
                        metadata={
                            'course_id': instance.course_id if hasattr(instance, 'course_id') else str(instance.id),
                            'course_title': instance.title,
                            'updated_at': str(timezone.now())
                        }
                    )
        except api_models.Course.DoesNotExist:
            pass  # Course was deleted, don't log
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging instructor course activities: {str(e)}")


@receiver(post_save, sender=api_models.VariantItem)
def log_instructor_lesson_activities(sender, instance, created, **kwargs):
    """
    Log instructor activities when lessons (variant items) are created or updated.
    
    Activity types logged:
    - 'lesson_created': When a new lesson is added to a course
    - 'lesson_updated': When lesson content is updated
    """
    try:
        if not instance.variant or not instance.variant.course or not instance.variant.course.teacher:
            return
        
        course = instance.variant.course
        instructor = course.teacher.user
        
        if created:
            api_models.ActivityLog.objects.create(
                user=instructor,
                activity_type='lesson_created',
                role_at_time='instructor',
                course=course,
                lesson=instance,
                title=f"Tambah Pelajaran: {instance.title}",
                description=f"Menambahkan pelajaran baru '{instance.title}' ke kursus '{course.title}'",
                success=True,
                metadata={
                    'variant_item_id': str(instance.variant_item_id) if hasattr(instance, 'variant_item_id') else str(instance.id),
                    'lesson_title': instance.title,
                    'course_id': str(course.id),
                    'course_title': course.title,
                    'variant_id': str(instance.variant_id) if hasattr(instance.variant_id) else str(instance.variant.id),
                    'variant_title': instance.variant.title if hasattr(instance.variant, 'title') else 'Variant'
                }
            )
        else:
            # Log updates (but not every save, only significant changes)
            # To avoid logging after every tiny update, check if content changed
            try:
                previous = api_models.VariantItem.objects.get(pk=instance.pk)
                # Check if significant fields changed
                significant_changes = (
                    previous.title != instance.title or 
                    previous.description != instance.description or
                    previous.file != instance.file or
                    previous.preview != instance.preview
                )
                
                if significant_changes:
                    api_models.ActivityLog.objects.create(
                        user=instructor,
                        activity_type='lesson_updated',
                        role_at_time='instructor',
                        course=course,
                        lesson=instance,
                        title=f"Update Pelajaran: {instance.title}",
                        description=f"Memperbarui pelajaran '{instance.title}' di kursus '{course.title}'",
                        success=True,
                        metadata={
                            'variant_item_id': str(instance.variant_item_id) if hasattr(instance, 'variant_item_id') else str(instance.id),
                            'lesson_title': instance.title,
                            'course_id': str(course.id),
                            'course_title': course.title
                        }
                    )
            except api_models.VariantItem.DoesNotExist:
                pass
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging instructor lesson activities: {str(e)}")


@receiver(post_save, sender=api_models.Quiz)
def log_instructor_quiz_activities(sender, instance, created, **kwargs):
    """
    Log instructor activities when quizzes are created.
    
    Activity types logged:
    - 'quiz_created': When a new quiz is created
    """
    try:
        if not instance.course or not instance.course.teacher:
            return
        
        course = instance.course
        instructor = course.teacher.user
        
        if created:
            api_models.ActivityLog.objects.create(
                user=instructor,
                activity_type='quiz_created',
                role_at_time='instructor',
                course=course,
                title=f"Buat Kuis: {instance.title}",
                description=f"Membuat kuis baru '{instance.title}' untuk kursus '{course.title}'",
                success=True,
                metadata={
                    'quiz_id': str(instance.id),
                    'quiz_title': instance.title,
                    'course_id': str(course.id),
                    'course_title': course.title,
                    'question_count': instance.question_set.count() if hasattr(instance, 'question_set') else 0
                }
            )
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging instructor quiz activities: {str(e)}")
