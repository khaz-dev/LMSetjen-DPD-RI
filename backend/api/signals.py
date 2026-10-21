"""
✨ PHASE 10.1: Django Signals for Automatic Point Calculation
Automatically updates StudentPoints and InstructorPoints when:
- Student completes a course
- Student takes a quiz
- Student submits a rating/review
- Instructor publishes a course
- Student enrolls in a course
"""

from django.db.models.signals import post_save, post_delete, pre_save
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
    
    Anti-redundancy:
    - Hanya 1 skor tertinggi yang dihitung per kuis (berdasarkan quiz_id atau judul kuis).
    - Jika siswa retake kuis dengan skor lebih rendah, poin tidak berubah.
    - Jika siswa retake kuis dengan skor lebih tinggi, entri log lama diperbarui ke nilai tertinggi
      dan total poin disinkronkan tanpa menduplikasi perolehan.
    """
    try:
        # Only award points if quiz is passed
        if not instance.is_passed or not instance.user or not instance.quiz:
            return
        
        # Check if points already awarded for this specific attempt
        if instance._points_awarded:
            return
            
        score_points = int(instance.score) if instance.score else 0
        score_points = min(max(score_points, 0), 100)
        
        quiz_title = instance.quiz.title.strip() if instance.quiz.title else ""
        norm_title = quiz_title.lower()
        
        # Cari log kuis yang sudah ada untuk kuis ini (by quiz_id atau normalized title)
        existing_logs = api_models.PointsAuditLog.objects.filter(
            user=instance.user,
            points_type='student',
            activity_type='quiz_score'
        )
        matching_logs = []
        for l in existing_logs:
            if l.quiz_id == instance.quiz.id:
                matching_logs.append(l)
            elif norm_title and ('on: ' + norm_title) in (l.description or '').strip().lower():
                matching_logs.append(l)
                
        if matching_logs:
            # Urutkan berdasarkan skor tertinggi yang sudah dicatat
            matching_logs.sort(key=lambda x: (x.points_awarded, x.awarded_at), reverse=True)
            prev_max = matching_logs[0].points_awarded
            
            if score_points <= prev_max:
                # Siswa sudah memiliki skor lebih baik atau sama, tidak ada penambahan poin
                instance._points_awarded = True
                instance.save(update_fields=['_points_awarded'])
                return
            else:
                # Skor baru LEBIH TINGGI dari skor sebelumnya!
                # Perbarui log terbaik ke nilai baru yang lebih tinggi
                primary_log = matching_logs[0]
                primary_log.points_awarded = score_points
                primary_log.quiz_id = instance.quiz.id
                primary_log.course_id = instance.quiz.course.id if instance.quiz.course else None
                primary_log.description = f"Quiz score {score_points}% on: {quiz_title}"
                primary_log.save()
                
                # Hapus log lain yang redundan jika ada
                for other_log in matching_logs[1:]:
                    other_log.delete()
                    
                # Rekonsiliasi total poin siswa
                api_models.StudentPoints.reconcile_points(instance.user)
                instance._points_awarded = True
                instance.save(update_fields=['_points_awarded'])
                return
        else:
            # Belum ada log kuis untuk kuis ini, tambahkan poin baru jika > 0
            if score_points > 0:
                api_models.StudentPoints.add_points(
                    instance.user,
                    score_points,
                    'quiz_score',
                    quiz_id=instance.quiz.id,
                    course_id=instance.quiz.course.id if instance.quiz.course else None,
                    description=f"Quiz score {score_points}% on: {quiz_title}"
                )
                api_models.StudentPoints.reconcile_points(instance.user)
                
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
        elif instance.role == 'instructor' and not instance.course and instance.user:
            # Award points to instructor for contributing a platform testimonial (+50 points)
            instructor_points, _ = api_models.InstructorPoints.objects.get_or_create(
                user=instance.user
            )
            instructor_points.add_points(
                instance.user,
                50,
                'platform_testimonial',
                review_id=instance.id,
                description=f"Testimoni Platform sebagai Instruktur ({instance.rating}★)"
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
            
        if not instance.teacher or not instance.teacher.user:
            return
            
        # Check database to prevent duplicate awards across server restarts
        if api_models.PointsAuditLog.objects.filter(
            user=instance.teacher.user,
            points_type='instructor',
            activity_type='course_published',
            course_id=instance.id
        ).exists():
            return
        
        # Get or create InstructorPoints for the teacher
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
            description=f"Publikasi Kursus: {instance.title}"
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


@receiver(pre_save, sender=api_models.Course)
def track_course_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._previous_instance = api_models.Course.objects.get(pk=instance.pk)
        except api_models.Course.DoesNotExist:
            instance._previous_instance = None
    else:
        instance._previous_instance = None


@receiver(post_save, sender=api_models.Course)
def log_instructor_course_activities(sender, instance, created, **kwargs):
    """
    Log instructor activities when course is created, updated, or published.
    
    Activity types logged:
    - 'course_created': When a new draft course is first saved (not published clones)
    - 'course_updated': When course metadata is updated
    - 'course_published': When course.platform_status changes to 'Published'
    """
    try:
        if not instance.teacher or not instance.teacher.user:
            return
        
        # [!] CRITICAL: Do NOT log internal snapshot clones as new courses
        if instance.is_published_version and created:
            return
        
        instructor = instance.teacher.user
        
        # Log when course is first created
        if created:
            recent = api_models.ActivityLog.objects.filter(
                user=instructor,
                activity_type='course_created',
                course=instance,
                activity_date__gte=timezone.now() - timezone.timedelta(minutes=2)
            ).exists()
            if not recent:
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
            return

        previous = getattr(instance, '_previous_instance', None)
        if not previous:
            return

        # Log when course is published
        if previous.platform_status != 'Published' and instance.platform_status == 'Published':
            recent_pub = api_models.ActivityLog.objects.filter(
                user=instructor,
                activity_type='course_published',
                course=instance,
                activity_date__gte=timezone.now() - timezone.timedelta(minutes=2)
            ).exists()
            if not recent_pub:
                api_models.ActivityLog.objects.create(
                    user=instructor,
                    activity_type='course_published',
                    role_at_time='instructor',
                    course=instance,
                    title=f"Publikasikan Kursus: {instance.title}",
                    description=f"Mempublikasikan kursus '{instance.title}' untuk siswa (+50 Poin)",
                    points_awarded=50,
                    success=True,
                    metadata={
                        'course_id': instance.course_id if hasattr(instance, 'course_id') else str(instance.id),
                        'course_title': instance.title,
                        'published_at': str(timezone.now()),
                        'is_published_version': instance.is_published_version
                    }
                )
        elif previous.platform_status == instance.platform_status and not instance.is_published_version:
            # Check if significant fields changed
            significant_fields = {'title', 'description', 'level', 'category_id'}
            changed = any(getattr(previous, f, None) != getattr(instance, f, None) for f in significant_fields)
            if changed:
                recent_upd = api_models.ActivityLog.objects.filter(
                    user=instructor,
                    activity_type='course_updated',
                    course=instance,
                    activity_date__gte=timezone.now() - timezone.timedelta(minutes=2)
                ).exists()
                if not recent_upd:
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
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging instructor course activities: {str(e)}")


@receiver(post_delete, sender=api_models.Course)
def log_instructor_course_deletion(sender, instance, **kwargs):
    """Log when a course is deleted"""
    try:
        if not instance.teacher or not instance.teacher.user or instance.is_published_version:
            return
        instructor = instance.teacher.user
        api_models.ActivityLog.objects.create(
            user=instructor,
            activity_type='course_deleted',
            role_at_time='instructor',
            course=None,
            title=f"Hapus Kursus: {instance.title}",
            description=f"Menghapus kursus '{instance.title}'",
            success=True,
            metadata={
                'course_title': instance.title,
                'course_id': instance.course_id if hasattr(instance, 'course_id') else str(instance.id)
            }
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging course deletion: {str(e)}")


@receiver(pre_save, sender=api_models.VariantItem)
def track_variant_item_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._previous_instance = api_models.VariantItem.objects.get(pk=instance.pk)
        except api_models.VariantItem.DoesNotExist:
            instance._previous_instance = None
    else:
        instance._previous_instance = None


@receiver(post_save, sender=api_models.VariantItem)
def log_instructor_lesson_activities(sender, instance, created, **kwargs):
    """
    Log instructor activities when lessons (variant items) are created or updated.
    Does NOT log internal clones created during course publishing.
    """
    try:
        if not instance.variant or not instance.variant.course or not instance.variant.course.teacher:
            return
        
        course = instance.variant.course
        # Do not log variant items created on published snapshot clone!
        if course.is_published_version:
            return
        
        instructor = course.teacher.user
        
        if created:
            recent_exists = api_models.ActivityLog.objects.filter(
                user=instructor,
                activity_type='lesson_created',
                course=course,
                title=f"Tambah Pelajaran: {instance.title}",
                activity_date__gte=timezone.now() - timezone.timedelta(minutes=2)
            ).exists()
            if not recent_exists:
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
                        'variant_id': str(instance.variant_id) if hasattr(instance, 'variant_id') else str(instance.variant.id),
                        'variant_title': instance.variant.title if hasattr(instance.variant, 'title') else 'Variant'
                    }
                )
        else:
            previous = getattr(instance, '_previous_instance', None)
            if previous:
                changed = (
                    previous.title != instance.title or 
                    previous.description != instance.description or
                    previous.file != instance.file
                )
                if changed:
                    recent_exists = api_models.ActivityLog.objects.filter(
                        user=instructor,
                        activity_type='lesson_updated',
                        course=course,
                        title=f"Update Pelajaran: {instance.title}",
                        activity_date__gte=timezone.now() - timezone.timedelta(minutes=2)
                    ).exists()
                    if not recent_exists:
                        api_models.ActivityLog.objects.create(
                            user=instructor,
                            activity_type='lesson_updated',
                            role_at_time='instructor',
                            course=course,
                            lesson=instance,
                            title=f"Update Pelajaran: {instance.title}",
                            description=f"Memperbarui materi pelajaran '{instance.title}' di kursus '{course.title}'",
                            success=True,
                            metadata={
                                'variant_item_id': str(instance.variant_item_id) if hasattr(instance, 'variant_item_id') else str(instance.id),
                                'lesson_title': instance.title,
                                'course_id': str(course.id),
                                'course_title': course.title
                            }
                        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging instructor lesson activities: {str(e)}")


@receiver(post_delete, sender=api_models.VariantItem)
def log_instructor_lesson_deletion(sender, instance, **kwargs):
    """Log when a lesson (variant item) is deleted"""
    try:
        if not instance.variant or not instance.variant.course or not instance.variant.course.teacher:
            return
        course = instance.variant.course
        if course.is_published_version:
            return
        instructor = course.teacher.user
        api_models.ActivityLog.objects.create(
            user=instructor,
            activity_type='lesson_deleted',
            role_at_time='instructor',
            course=course,
            title=f"Hapus Pelajaran: {instance.title}",
            description=f"Menghapus pelajaran '{instance.title}' dari kursus '{course.title}'",
            success=True,
            metadata={
                'lesson_title': instance.title,
                'course_id': str(course.id),
                'course_title': course.title,
            }
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging lesson deletion: {str(e)}")


@receiver(pre_save, sender=api_models.Quiz)
def track_quiz_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._previous_instance = api_models.Quiz.objects.get(pk=instance.pk)
        except api_models.Quiz.DoesNotExist:
            instance._previous_instance = None
    else:
        instance._previous_instance = None


@receiver(post_save, sender=api_models.Quiz)
def log_instructor_quiz_activities(sender, instance, created, **kwargs):
    """
    Log instructor activities when quizzes are created or updated.
    Does NOT log quizzes cloned during course publication.
    """
    try:
        if not instance.course or not instance.course.teacher:
            return
        
        course = instance.course
        if course.is_published_version:
            return
        
        instructor = course.teacher.user
        
        if created:
            recent_exists = api_models.ActivityLog.objects.filter(
                user=instructor,
                activity_type='quiz_created',
                course=course,
                title=f"Buat Kuis: {instance.title}",
                activity_date__gte=timezone.now() - timezone.timedelta(minutes=2)
            ).exists()
            if not recent_exists:
                api_models.ActivityLog.objects.create(
                    user=instructor,
                    activity_type='quiz_created',
                    role_at_time='instructor',
                    course=course,
                    quiz=instance,
                    title=f"Buat Kuis: {instance.title}",
                    description=f"Membuat kuis baru '{instance.title}' untuk kursus '{course.title}'",
                    success=True,
                    metadata={
                        'quiz_id': str(instance.id),
                        'quiz_title': instance.title,
                        'course_id': str(course.id),
                        'course_title': course.title,
                    }
                )
        else:
            previous = getattr(instance, '_previous_instance', None)
            if previous and (previous.title != instance.title or previous.description != instance.description):
                recent_exists = api_models.ActivityLog.objects.filter(
                    user=instructor,
                    activity_type='quiz_updated',
                    course=course,
                    title=f"Update Kuis: {instance.title}",
                    activity_date__gte=timezone.now() - timezone.timedelta(minutes=2)
                ).exists()
                if not recent_exists:
                    api_models.ActivityLog.objects.create(
                        user=instructor,
                        activity_type='quiz_updated',
                        role_at_time='instructor',
                        course=course,
                        quiz=instance,
                        title=f"Update Kuis: {instance.title}",
                        description=f"Memperbarui kuis '{instance.title}' di kursus '{course.title}'",
                        success=True,
                        metadata={
                            'quiz_id': str(instance.id),
                            'quiz_title': instance.title,
                            'course_id': str(course.id),
                            'course_title': course.title,
                        }
                    )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging instructor quiz activities: {str(e)}")


@receiver(post_delete, sender=api_models.Quiz)
def log_instructor_quiz_deletion(sender, instance, **kwargs):
    """Log when a quiz is deleted"""
    try:
        if not instance.course or not instance.course.teacher:
            return
        course = instance.course
        if course.is_published_version:
            return
        instructor = course.teacher.user
        api_models.ActivityLog.objects.create(
            user=instructor,
            activity_type='quiz_deleted',
            role_at_time='instructor',
            course=course,
            title=f"Hapus Kuis: {instance.title}",
            description=f"Menghapus kuis '{instance.title}' dari kursus '{course.title}'",
            success=True,
            metadata={
                'quiz_title': instance.title,
                'course_id': str(course.id),
                'course_title': course.title,
            }
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging quiz deletion: {str(e)}")


# ✨ PHASE 64: Additional instructor activity signals for complete tracking


@receiver(post_delete, sender=api_models.EnrolledCourse)
def log_student_unenrolled(sender, instance, **kwargs):
    """
    Log instructor activity when student is unenrolled from a course.
    
    Activity type logged:
    - 'student_unenrolled': When an enrollment is deleted/cancelled
    
    Note: This captures when an EnrolledCourse record is deleted,
    which could be from manual removal or course deletion.
    """
    try:
        if not instance.course or not instance.course.teacher:
            return
        
        course = instance.course
        teacher = instance.course.teacher
        instructor = teacher.user if teacher else None
        
        if not instructor:
            return
        
        # Get student info (may be limited if student was already deleted)
        student_name = instance.user.full_name if instance.user else "Unknown Student"
        student_id = instance.user.id if instance.user else None
        
        api_models.ActivityLog.objects.create(
            user=instructor,
            activity_type='student_unenrolled',
            role_at_time='instructor',
            course=course,
            title=f"Siswa Dihapus: {student_name}",
            description=f"Menghapus siswa '{student_name}' dari kursus '{course.title}'",
            success=True,
            metadata={
                'enrollment_id': str(instance.enrollment_id) if hasattr(instance, 'enrollment_id') else str(instance.id),
                'student_id': student_id,
                'student_name': student_name,
                'course_id': str(course.id),
                'course_title': course.title
            }
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging student unenrollment: {str(e)}")


@receiver(post_save, sender=api_models.EnrolledCourse)
def log_student_enrolled_manual(sender, instance, created, **kwargs):
    """
    Log instructor activity when instructor manually enrolls a student.
    
    ✨ PHASE 64 NOTE: This signal currently cannot distinguish between:
    - Automatic enrollment (student self-enrolls): Should log as 'enrollment' (already handled)
    - Manual enrollment (instructor enrolls): Should log as 'student_enrolled_manual'
    
    To properly distinguish, we would need:
    1. Add is_manual_enrollment BooleanField to EnrolledCourse model
    2. Or add manual_enrolled_by ForeignKey to track who enrolled the student
    3. Or check request context in view to set a flag
    
    For now, this signal is a placeholder for the manual enrollment logging.
    The actual manual enrollment should be logged in the view when the API endpoint
    is called by an instructor.
    
    FUTURE: Implement this properly after adding the necessary model fields.
    """
    # Currently, we rely on view-level logging for manual enrollment
    # until the model is updated to track this distinction.
    pass


# ==================== REVIEW & TESTIMONIAL SIGNALS ====================

@receiver(pre_save, sender=api_models.Review)
def track_review_pre_save(sender, instance, **kwargs):
    """
    Store previous review state to track review edits.
    """
    if instance.id:
        try:
            instance._previous_instance = api_models.Review.objects.get(id=instance.id)
        except api_models.Review.DoesNotExist:
            instance._previous_instance = None
    else:
        instance._previous_instance = None


@receiver(post_save, sender=api_models.Review)
def log_review_activity(sender, instance, created, **kwargs):
    """
    Log review/testimonial creation and updates into ActivityLog.
    """
    try:
        if not instance.user:
            return
        
        user = instance.user
        role = getattr(instance, 'role', 'instructor' if hasattr(user, 'teacher') else 'student')
        is_testimonial = (instance.course is None)
        
        if created:
            if is_testimonial:
                act_type = 'testimonial_posted'
                title = "Kirim Testimoni Platform"
                pts = 50 if instance.active else 0
                desc = f"Mengirimkan testimoni platform ({instance.rating}/5 bintang)"
                if pts > 0:
                    desc += f" (+{pts} Poin)"
            else:
                act_type = 'review_posted'
                title = f"Posting Review: {instance.course.title}"
                pts = 0
                desc = f"Memberikan ulasan {instance.rating}/5 bintang untuk {instance.course.title}"
            
            api_models.ActivityLog.objects.create(
                user=user,
                activity_type=act_type,
                role_at_time=role,
                course=instance.course,
                title=title,
                description=desc,
                points_awarded=pts,
                success=True,
                metadata={
                    'review_id': instance.id,
                    'rating': instance.rating,
                    'is_testimonial': is_testimonial,
                    'review_excerpt': (instance.review or '')[:100],
                    'active': instance.active
                }
            )
            return
        
        previous = getattr(instance, '_previous_instance', None)
        if not previous:
            return
            
        # Check if review became active (admin approved)
        if not previous.active and instance.active:
            if is_testimonial:
                recent_log = api_models.ActivityLog.objects.filter(
                    user=user,
                    activity_type='testimonial_posted',
                    metadata__review_id=instance.id
                ).first()
                if recent_log and recent_log.points_awarded == 0:
                    recent_log.points_awarded = 50
                    recent_log.description = f"Mengirimkan testimoni platform ({instance.rating}/5 bintang) (+50 Poin)"
                    recent_log.save(update_fields=['points_awarded', 'description'])
            return
        
        # Check if content/rating updated
        if previous.review != instance.review or previous.rating != instance.rating:
            if is_testimonial:
                act_type = 'testimonial_updated'
                title = "Perbarui Testimoni Platform"
                desc = f"Memperbarui testimoni platform ({instance.rating}/5 bintang)"
            else:
                act_type = 'review_updated'
                title = f"Perbarui Review: {instance.course.title}"
                desc = f"Memperbarui ulasan untuk {instance.course.title} ({instance.rating}/5 bintang)"
                
            api_models.ActivityLog.objects.create(
                user=user,
                activity_type=act_type,
                role_at_time=role,
                course=instance.course,
                title=title,
                description=desc,
                points_awarded=0,
                success=True,
                metadata={
                    'review_id': instance.id,
                    'rating': instance.rating,
                    'is_testimonial': is_testimonial
                }
            )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error logging review activity: {str(e)}")


@receiver(post_delete, sender=api_models.Review)
def log_review_deletion(sender, instance, **kwargs):
    """
    Log review/testimonial deletion into ActivityLog.
    """
    try:
        if not instance.user:
            return
            
        user = instance.user
        role = getattr(instance, 'role', 'instructor' if hasattr(user, 'teacher') else 'student')
        is_testimonial = (instance.course is None)
        
        if is_testimonial:
            act_type = 'testimonial_deleted'
            title = "Hapus Testimoni Platform"
            desc = "Menghapus testimoni platform"
        else:
            act_type = 'review_deleted'
            title = f"Hapus Review: {instance.course.title if instance.course else ''}"
            desc = f"Menghapus ulasan untuk {instance.course.title if instance.course else 'kursus'}"
            
        api_models.ActivityLog.objects.create(
            user=user,
            activity_type=act_type,
            role_at_time=role,
            course=instance.course,
            title=title,
            description=desc,
            points_awarded=0,
            success=True,
            metadata={
                'review_id': instance.id,
                'is_testimonial': is_testimonial
            }
        )
        
        # Hapus audit log perolehan poin yang berkaitan dengan review/testimoni ini
        api_models.PointsAuditLog.objects.filter(review_id=instance.id).delete()
        
        # Rekonsiliasi poin siswa
        if role == 'student' or not hasattr(user, 'teacher'):
            api_models.StudentPoints.reconcile_points(user)
            
        # Rekonsiliasi poin instruktur jika ulasan kursus dihapus
        if instance.course and instance.course.teacher and instance.course.teacher.user:
            t_user = instance.course.teacher.user
            inst_pts = api_models.InstructorPoints.objects.filter(user=t_user).first()
            if inst_pts:
                from django.utils import timezone
                now = timezone.now()
                inst_logs = api_models.PointsAuditLog.objects.filter(user=t_user, points_type='instructor')
                inst_pts.lifetime_points = sum(l.points_awarded for l in inst_logs)
                inst_pts.yearly_points = sum(l.points_awarded for l in inst_logs.filter(awarded_at__year=now.year))
                inst_pts.monthly_points = sum(l.points_awarded for l in inst_logs.filter(awarded_at__year=now.year, awarded_at__month=now.month))
                inst_pts.save()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error logging review deletion: {str(e)}")


@receiver(post_delete, sender=api_models.QuizAttempt)
def handle_quiz_attempt_deletion(sender, instance, **kwargs):
    """
    Antisipasi penghapusan QuizAttempt:
    Ketika attempt kuis dihapus, lakukan rekonsiliasi poin siswa agar perolehan poin
    hanya mencerminkan attempt terbaik yang tersisa.
    """
    try:
        if not instance.user:
            return
        api_models.StudentPoints.reconcile_points(instance.user)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error handling quiz attempt deletion: {str(e)}")


@receiver(post_delete, sender=api_models.Certificate)
def handle_certificate_deletion(sender, instance, **kwargs):
    """
    Antisipasi penghapusan/pembatalan sertifikat:
    Jika sertifikat dihapus dan siswa tidak lagi memiliki bukti kelulusan yang valid untuk kursus tersebut,
    hapus log penyelesaian kursus dan rekonsiliasi poin siswa.
    """
    try:
        if not instance.user or not instance.course_id:
            return
        has_other_cert = api_models.Certificate.objects.filter(
            user=instance.user,
            course_id=instance.course_id,
            is_valid=True
        ).exists()
        if not has_other_cert:
            api_models.PointsAuditLog.objects.filter(
                user=instance.user,
                points_type='student',
                activity_type='course_completion',
                course_id=instance.course_id
            ).delete()
            api_models.StudentPoints.reconcile_points(instance.user)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error handling certificate deletion: {str(e)}")


