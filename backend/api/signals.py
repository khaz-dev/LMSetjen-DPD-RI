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
    """Log when student completes a lesson (0 gamification points; course completion awards 100 points)"""
    if not created:
        return
    
    try:
        # Check if already logged for this lesson to prevent duplicates
        existing = api_models.ActivityLog.objects.filter(
            user=instance.user,
            activity_type='lesson_completed',
            lesson=instance.variant_item,
            course=instance.course
        ).exists()
        if existing:
            return

        api_models.ActivityLog.objects.create(
            user=instance.user,
            activity_type='lesson_completed',
            role_at_time='student',
            course=instance.course,
            lesson=instance.variant_item,
            title=f"Selesaikan Pelajaran: {instance.variant_item.title if instance.variant_item else ''}",
            description=f"Menyelesaikan pelajaran '{instance.variant_item.title if instance.variant_item else ''}' dari kursus {instance.course.title if instance.course else ''}",
            points_awarded=0,
            success=True,
            metadata={
                'completed_lesson_id': instance.id,
                'variant_item_id': instance.variant_item.variant_item_id if instance.variant_item else None,
                'lesson_title': instance.variant_item.title if instance.variant_item else '',
                'course_id': instance.course.id if instance.course else None,
                'course_title': instance.course.title if instance.course else ''
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
    """Log when student attempts or completes a quiz. 0 global points (quiz mastery is measured on Course Leaderboard)."""
    try:
        act_type = 'quiz_passed' if instance.is_passed else 'quiz_attempted'
        q_title = instance.quiz.title if instance.quiz else ''
        title = f"{'Lulus' if instance.is_passed else 'Kerjakan'} Kuis: {q_title}"
        desc = f"{'Lulus' if instance.is_passed else 'Mengerjakan'} kuis '{q_title}' dengan skor {instance.score}%"
        
        if created:
            api_models.ActivityLog.objects.create(
                user=instance.user,
                activity_type=act_type,
                role_at_time='student',
                course=instance.quiz.course if instance.quiz and instance.quiz.course else None,
                quiz=instance.quiz,
                title=title,
                description=desc,
                points_awarded=0,
                duration_seconds=int(instance.time_taken.total_seconds()) if instance.time_taken else 0,
                success=instance.is_passed,
                metadata={
                    'quiz_attempt_id': instance.id,
                    'quiz_id': instance.quiz.id if instance.quiz else None,
                    'quiz_title': q_title,
                    'score': float(instance.score),
                    'is_passed': instance.is_passed,
                    'course_id': instance.quiz.course.id if instance.quiz and instance.quiz.course else None
                }
            )
        else:
            existing_al = api_models.ActivityLog.objects.filter(
                user=instance.user,
                metadata__quiz_attempt_id=instance.id
            ).first()
            if existing_al:
                existing_al.activity_type = act_type
                existing_al.title = title
                existing_al.description = desc
                existing_al.points_awarded = 0
                existing_al.success = instance.is_passed
                existing_al.save(update_fields=['activity_type', 'title', 'description', 'points_awarded', 'success'])
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging quiz activity: {str(e)}")


@receiver(post_save, sender=api_models.Certificate)
def log_certificate_earned(sender, instance, created, **kwargs):
    """Log when student earns a certificate and synchronize points"""
    if not created or not instance.is_valid:
        return
    
    try:
        has_existing = api_models.ActivityLog.objects.filter(
            user=instance.user,
            activity_type='certificate_earned',
            course=instance.course,
            role_at_time='student'
        ).exists()
        
        pts = 100 if not has_existing else 0
        c_title = instance.course.title if instance.course else ''
        
        api_models.ActivityLog.objects.create(
            user=instance.user,
            activity_type='certificate_earned',
            role_at_time='student',
            course=instance.course,
            title=f"Raih Sertifikat: {c_title}",
            description=f"Berhasil meraih sertifikat untuk kursus {c_title}",
            success=True,
            points_awarded=pts,
            metadata={
                'certificate_id': instance.id,
                'certificate_code': getattr(instance, 'certificate_id', None) or getattr(instance, 'certificate_number', ''),
                'course_id': instance.course.id if instance.course else None,
                'course_title': c_title,
                'issue_date': str(instance.date if hasattr(instance, 'date') else instance.issue_date if hasattr(instance, 'issue_date') else '')
            }
        )
        if instance.user:
            api_models.StudentPoints.reconcile_points(instance.user)

        # ✨ PHASE 10+: Award +20 points to the course instructor when a student graduates & earns certificate
        if instance.course and instance.course.teacher and instance.course.teacher.user:
            teacher_user = instance.course.teacher.user
            # Avoid self-completion farming if instructor tests their own course
            if instance.user and instance.user != teacher_user:
                already_rewarded = api_models.PointsAuditLog.objects.filter(
                    user=teacher_user,
                    points_type='instructor',
                    activity_type='student_completion',
                    course_id=instance.course.id,
                    description__icontains=f"User #{instance.user.id}"
                ).exists()
                if not already_rewarded:
                    inst_pts, _ = api_models.InstructorPoints.objects.get_or_create(
                        user=teacher_user,
                        defaults={'teacher': instance.course.teacher}
                    )
                    std_name = instance.user.full_name or instance.user.username or f"User #{instance.user.id}"
                    inst_pts.add_points(
                        teacher_user,
                        20,
                        'student_completion',
                        course_id=instance.course.id,
                        description=f"Peserta {std_name} (User #{instance.user.id}) menyelesaikan kursus: {c_title}"
                    )
                    api_models.InstructorPoints.reconcile_points(teacher_user)

                    # Log into ActivityLog for instructor teaching reward feed
                    api_models.ActivityLog.objects.create(
                        user=teacher_user,
                        activity_type='points_earned',
                        role_at_time='instructor',
                        course=instance.course,
                        title=f"Insentif Kelulusan: {std_name}",
                        description=f"Peserta {std_name} berhasil menyelesaikan kursus '{c_title}' (+20 Poin)",
                        points_awarded=20,
                        success=True,
                        metadata={
                            'student_id': instance.user.id if instance.user else None,
                            'student_name': std_name,
                            'course_id': instance.course.id,
                            'certificate_id': instance.id,
                            'reward_type': 'student_completion'
                        }
                    )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error logging certificate: {str(e)}")


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
    Kelulusan Kuis / Ujian difokuskan khusus untuk pemeringkatan dalam kursus (Course Leaderboard),
    bukan untuk poin global platform (karena poin pencapaian belajar sudah diperoleh saat menyelesaikan Kursus Penuh).
    """
    return


@receiver(post_save, sender=api_models.Review)
def award_points_on_course_rating(sender, instance, created, **kwargs):
    """
    ✨ PHASE 10.8: Award RATING-BASED POINTS to officers based on course review ratings!
    
    Points awarded:
    - STUDENT (reviewer):
      • Course Review: +15 points per course
      • Platform Testimonial: +20 points per student
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
        if not instance.active or not instance.user:
            return
        
        # Check if points already awarded to prevent duplicates
        if api_models.PointsAuditLog.objects.filter(review_id=instance.id).exists():
            return
        
        # Only award student points if reviewing as student
        if instance.role == 'student':
            student_points, _ = api_models.StudentPoints.objects.get_or_create(
                user=instance.user
            )
            pts = 15 if instance.course else 20
            cat = 'rating_given' if instance.course else 'platform_testimonial'
            desc = f"Submitted {instance.rating}★ review for: {instance.course.title if instance.course else 'Testimonial'} (+{pts} Poin)"
            student_points.add_points(
                instance.user, 
                pts, 
                cat,
                review_id=instance.id,
                course_id=instance.course.id if instance.course else None,
                description=desc
            )
            api_models.StudentPoints.reconcile_points(instance.user)
        
        # Award instructor points only if course exists
        if instance.course and instance.course.teacher and instance.course.teacher.user:
            rating_points = min(int(instance.rating) * 10, 50)
            
            instructor_points, _ = api_models.InstructorPoints.objects.get_or_create(
                user=instance.course.teacher.user,
                defaults={'teacher': instance.course.teacher}
            )
            instructor_points.add_points(
                instance.course.teacher.user, 
                rating_points,
                'student_rating',
                review_id=instance.id,
                course_id=instance.course.id,
                description=f"Received {instance.rating}★ rating ({rating_points}pts) from {instance.user.full_name if instance.user else 'Learner'} on: {instance.course.title}"
            )
        elif instance.role == 'instructor' and not instance.course and instance.user:
            # Award points to instructor for contributing a platform testimonial (+20 points)
            instructor_points, _ = api_models.InstructorPoints.objects.get_or_create(
                user=instance.user
            )
            instructor_points.add_points(
                instance.user,
                20,
                'platform_testimonial',
                review_id=instance.id,
                description=f"Testimoni Platform sebagai Instruktur ({instance.rating}★)"
            )
            api_models.InstructorPoints.reconcile_points(instance.user)
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error awarding rating points: {str(e)}")


@receiver(post_save, sender=api_models.Course)
def award_points_on_course_publishing(sender, instance, created, **kwargs):
    """
    Award instructor points when course is published.
    Points awarded: 100 points per published course (lifetime, yearly, monthly)
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
        
        # Award 100 points for publishing a new course
        # ✨ PHASE 10.4: Include audit information
        instructor_points.add_points(
            instance.teacher.user, 
            100, 
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
            std_name = instance.user.full_name if instance.user else 'Peserta Baru'
            instructor_points.add_points(
                instance.course.teacher.user, 
                10, 
                'student_enrollment',
                course_id=instance.course.id,
                description=f"Student {std_name} enrolled in: {instance.course.title}"
            )

            # Log into ActivityLog for instructor teaching reward feed
            api_models.ActivityLog.objects.create(
                user=instance.course.teacher.user,
                activity_type='points_earned',
                role_at_time='instructor',
                course=instance.course,
                title=f"Insentif Pendaftaran: {std_name}",
                description=f"Peserta {std_name} terdaftar pada kursus '{instance.course.title}' (+10 Poin)",
                points_awarded=10,
                success=True,
                metadata={
                    'enrollment_id': instance.id,
                    'student_id': instance.user.id if instance.user else None,
                    'student_name': std_name,
                    'course_id': instance.course.id,
                    'reward_type': 'student_enrollment'
                }
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
                # Check if publication points have already been granted for this course
                already_awarded = api_models.PointsAuditLog.objects.filter(
                    user=instructor,
                    points_type='instructor',
                    activity_type='course_published',
                    course_id=instance.id
                ).exists() or api_models.ActivityLog.objects.filter(
                    user=instructor,
                    activity_type='course_published',
                    course=instance,
                    points_awarded__gt=0
                ).exists()

                pts_to_award = 0 if already_awarded else 100
                desc_text = f"Mempublikasikan kursus '{instance.title}' untuk peserta" + (f" (+{pts_to_award} Poin)" if pts_to_award > 0 else " (Pembaruan Publikasi)")

                api_models.ActivityLog.objects.create(
                    user=instructor,
                    activity_type='course_published',
                    role_at_time='instructor',
                    course=instance,
                    title=f"Publikasikan Kursus: {instance.title}",
                    description=desc_text,
                    points_awarded=pts_to_award,
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
            title=f"Peserta Dihapus: {student_name}",
            description=f"Menghapus peserta '{student_name}' dari kursus '{course.title}'",
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


# ✨ PHASE 65: Log saat instruktur mengunggah modul atau berkas materi tambahan
@receiver(post_save, sender=api_models.CourseResource)
def log_instructor_resource_activities(sender, instance, created, **kwargs):
    """
    Log saat instruktur mengunggah modul atau berkas lampiran materi ke kursus.
    """
    if not created or not instance.course or not instance.course.teacher:
        return
    try:
        instructor = instance.course.teacher.user
        if not instructor:
            return
        api_models.ActivityLog.objects.create(
            user=instructor,
            activity_type='resource_uploaded',
            role_at_time='instructor',
            course=instance.course,
            title=f"Unggah Modul: {instance.name}",
            description=f"Mengunggah berkas materi '{instance.name}' ({instance.file_type or 'Dokumen'}) untuk kursus '{instance.course.title}'",
            success=True,
            metadata={
                'resource_id': instance.id,
                'resource_name': instance.name,
                'file_type': instance.file_type,
                'file_size': instance.file_size,
                'course_id': str(instance.course.id),
                'course_title': instance.course.title
            }
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error logging resource upload: {str(e)}")


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
        role = getattr(instance, 'role', None) or ('instructor' if hasattr(user, 'teacher') else 'student')
        is_testimonial = (instance.course is None)
        
        if created:
            if is_testimonial:
                act_type = 'testimonial_posted'
                title = "Kirim Testimoni Platform"
                pts = 20 if (instance.active and role == 'student') else 0
                desc = f"Mengirimkan testimoni platform ({instance.rating}/5 bintang)"
                if pts > 0:
                    desc += f" (+{pts} Poin)"
            else:
                act_type = 'review_posted'
                c_title = instance.course.title if instance.course else 'kursus'
                title = f"Posting Review: {c_title}"
                pts = 15 if (instance.active and role == 'student') else 0
                desc = f"Memberikan ulasan {instance.rating}/5 bintang untuk {c_title}"
                if pts > 0:
                    desc += f" (+{pts} Poin)"
            
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
            if role == 'student' and pts > 0:
                api_models.StudentPoints.reconcile_points(user)
            return
        
        previous = getattr(instance, '_previous_instance', None)
        if not previous:
            return
            
        # Check if review became active (admin approved)
        if not previous.active and instance.active:
            pts = (20 if is_testimonial else 15) if role == 'student' else 0
            recent_log = api_models.ActivityLog.objects.filter(
                user=user,
                activity_type='testimonial_posted' if is_testimonial else 'review_posted',
                metadata__review_id=instance.id
            ).first()
            if recent_log:
                recent_log.points_awarded = pts
                recent_log.save(update_fields=['points_awarded'])
            if role == 'student':
                api_models.StudentPoints.reconcile_points(user)
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
        api_models.ActivityLog.objects.filter(metadata__review_id=instance.id).update(points_awarded=0)
        
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
            api_models.ActivityLog.objects.filter(
                user=instance.user,
                activity_type='certificate_earned',
                course_id=instance.course_id
            ).update(points_awarded=0)
            api_models.StudentPoints.reconcile_points(instance.user)

            # Reconcile instructor points if course belongs to a teacher
            if instance.course and instance.course.teacher and instance.course.teacher.user:
                t_user = instance.course.teacher.user
                api_models.PointsAuditLog.objects.filter(
                    user=t_user,
                    points_type='instructor',
                    activity_type='student_completion',
                    course_id=instance.course_id,
                    description__icontains=f"User #{instance.user.id}"
                ).delete()
                api_models.InstructorPoints.reconcile_points(t_user)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error handling certificate deletion: {str(e)}")


@receiver(post_save, sender=api_models.Wishlist)
def log_wishlist_added(sender, instance, created, **kwargs):
    """Log when student saves a course to wishlist (0 points)"""
    if not created or not instance.user or not instance.course:
        return
    try:
        api_models.ActivityLog.objects.create(
            user=instance.user,
            activity_type='wishlist_added',
            role_at_time='student',
            course=instance.course,
            title=f"Simpan Kursus: {instance.course.title}",
            description=f"Menambahkan kursus '{instance.course.title}' ke daftar kursus yang ingin dipelajari",
            points_awarded=0,
            success=True,
            metadata={
                'wishlist_id': instance.id,
                'course_id': instance.course.id,
                'course_title': instance.course.title
            }
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error logging wishlist added: {str(e)}")


@receiver(post_save, sender=api_models.Question_Answer_Message)
def log_question_answered(sender, instance, created, **kwargs):
    """Log when student or instructor posts a reply in Q&A (+5 points for instructor with daily cap of 30 pts)"""
    if not created or not instance.user or not instance.question:
        return
    try:
        user_role = 'instructor' if hasattr(instance.user, 'teacher') else 'student'
        c_title = instance.course.title if instance.course else (instance.question.course.title if instance.question and instance.question.course else '')
        q_title = instance.question.title if instance.question else ''
        
        pts = 0
        desc = f"Mengirimkan tanggapan untuk diskusi '{q_title[:50]}' pada kursus {c_title}"
        if user_role == 'instructor':
            course_obj = instance.course or (instance.question.course if instance.question else None)
            if course_obj and course_obj.teacher and course_obj.teacher.user == instance.user:
                today = timezone.now().date()
                today_qa_pts = sum(
                    l.points_awarded for l in api_models.PointsAuditLog.objects.filter(
                        user=instance.user,
                        points_type='instructor',
                        activity_type='qa_answer',
                        awarded_at__date=today
                    )
                )
                if today_qa_pts < 30:  # Daily limit: max 30 points (6 answers) per day
                    pts = 5
                    desc += " (+5 Poin)"
                    inst_pts, _ = api_models.InstructorPoints.objects.get_or_create(
                        user=instance.user,
                        defaults={'teacher': course_obj.teacher}
                    )
                    inst_pts.add_points(
                        instance.user,
                        5,
                        'qa_answer',
                        course_id=course_obj.id,
                        description=f"Menjawab diskusi '{q_title[:40]}' pada kursus {c_title}"
                    )
                    api_models.InstructorPoints.reconcile_points(instance.user)

        api_models.ActivityLog.objects.create(
            user=instance.user,
            activity_type='question_answered',
            role_at_time=user_role,
            course=instance.course or (instance.question.course if instance.question else None),
            title=f"Jawab Pertanyaan: {q_title[:50]}",
            description=desc,
            points_awarded=pts,
            success=True,
            metadata={
                'message_id': instance.id,
                'question_id': instance.question.qa_id if instance.question else None,
                'course_id': instance.course.id if instance.course else None,
                'is_solution': getattr(instance, 'is_solution', False)
            }
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error logging question answered: {str(e)}")



