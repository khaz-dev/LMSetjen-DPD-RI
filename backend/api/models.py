import os
import zipfile
import datetime
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.text import slugify
from django.utils import timezone
from django.db.models.signals import post_save
from django.contrib.postgres.search import SearchVectorField
from django.contrib.postgres.indexes import GinIndex

from userauths.models import User, Profile, USER_ROLE_CHOICES
from shortuuid.django_fields import ShortUUIDField
try:
    from moviepy.editor import VideoFileClip
except ImportError:
    VideoFileClip = None  # Fallback if moviepy not installed
import math

def validate_scorm_or_h5p_extension(value):
    ext = os.path.splitext(value.name)[1].lower()
    if ext not in ['.zip', '.h5p']:
        raise ValidationError('Format file tidak didukung. Harap unggah paket zip SCORM (.zip) atau paket H5P (.h5p).')

def scorm_upload_path(instance, filename):
    return f'learning_modules/packages/{timezone.now().strftime("%Y/%m")}/{instance.pk or "temp"}_{filename}'


LEVEL = (
    ("Beginner", "Beginner"),
    ("Intermediate", "Intermediate"),
    ("Advanced", "Advanced"),
)

TARGET_AUDIENCE = (
    ("internal", "Khusus Internal Setjen DPD RI"),
    ("asn", "Khusus ASN"),
    ("umum", "Terbuka untuk Umum"),
    ("pegawai", "Khusus Pegawai Setjen DPD RI"),  # Legacy compatibility
)


TEACHER_STATUS = (
    ("Draft", "Draft"),
    ("Disabled", "Disabled"),
    ("Published", "Published"),
)

PAYMENT_STATUS = (
    ("Paid", "Paid"),
    ("Processing", "Processing"),
    ("Failed", "Failed"),
)


PLATFORM_STATUS = (
    ("Review", "Review"),
    ("Disabled", "Disabled"),
    ("Rejected", "Rejected"),
    ("Draft", "Draft"),
    ("Published", "Published"),
)

RATING = (
    (1, "1 Star"),
    (2, "2 Star"),
    (3, "3 Star"),
    (4, "4 Star"),
    (5, "5 Star"),
)

# ✨ PHASE 4.11: Testimonial role choices for multi-role users
TESTIMONIAL_ROLES = (
    ("student", "Student"),
    ("instructor", "Instructor"),
)

NOTI_TYPE = (
    ("New Order", "New Order"),
    ("New Review", "New Review"),
    ("New Course Question", "New Course Question"),
    ("Draft", "Draft"),
    ("Course Published", "Course Published"),
    ("Course Enrollment Completed", "Course Enrollment Completed"),
    ("Exam Verified", "Exam Verified"),
    ("Exam Reset", "Exam Reset"),
    ("Exam Rejected", "Exam Rejected"),
    ("Exam Review Needed", "Exam Review Needed"),
    ("Exam Pending Review", "Exam Pending Review"),
    ("AI Learning Nudge", "AI Learning Nudge"),
    ("AI JP Target Reminder", "AI JP Target Reminder"),
    ("AI Microlearning Digest", "AI Microlearning Digest"),
    ("AI Flashcard Challenge", "AI Flashcard Challenge"),
    ("Forum Reply", "Forum Reply"),
    ("Forum Solution", "Forum Solution"),
)

# ✨ PHASE 4.18: Video source types for course intro videos
# REMOVED: YouTube video support (Upload only system now)
# Original choices: ("upload", "Upload File"), ("youtube", "YouTube Link")

class Teacher(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    image = models.FileField(upload_to='teacher_profile_images/', null=True, blank=True)
    full_name = models.CharField(max_length=100)
    bio = models.CharField(max_length=100, null=True, blank=True)
    facebook = models.URLField(null=True, blank=True)
    twitter = models.URLField(null=True, blank=True)
    linkedin = models.URLField(null=True, blank=True)
    youtube = models.URLField(null=True, blank=True)
    instagram = models.URLField(null=True, blank=True)
    tiktok = models.URLField(null=True, blank=True)
    about = models.TextField(null=True, blank=True)
    country = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return self.full_name
    
    def save(self, *args, **kwargs):
        """
        ✨ PHASE 4.39: Auto-sync full_name from user.full_name to ensure it's always correct
        Teacher.full_name should always reflect User.full_name as the source of truth
        """
        # Always ensure full_name is synced from the user's full_name
        if self.user and self.user.full_name:
            self.full_name = self.user.full_name
        super().save(*args, **kwargs)
    
    @classmethod
    def create_from_profile(cls, user):
        """
        Create a Teacher instance from an existing Profile.
        This method ensures data consistency between Profile and Teacher.
        """
        try:
            profile = Profile.objects.get(user=user)
            teacher, created = cls.objects.get_or_create(
                user=user,
                defaults={
                    'image': profile.image,
                    'full_name': profile.full_name,
                    'country': profile.country,
                    'about': profile.about,
                    'bio': '',  # Teacher-specific field, can be updated later
                }
            )
            return teacher
        except Profile.DoesNotExist:
            raise ValueError(f"No Profile exists for user {user}")
    
    def students(self):
        # Get unique students from enrolled courses
        return EnrolledCourse.objects.filter(course__teacher=self).values_list('user', flat=True).distinct().count()
    
    def courses(self):
        return Course.objects.filter(teacher=self)
    
    def review(self):
        return Course.objects.filter(teacher=self).count()
    
class Category(models.Model):
    title = models.CharField(max_length=100)
    image = models.URLField(max_length=500, default="", null=True, blank=True)
    active = models.BooleanField(default=True)
    slug = models.SlugField(max_length=200, unique=True, null=True, blank=True)

    class Meta:
        verbose_name_plural = "Category"
        ordering = ['title']

    def __str__(self):
        return self.title
    
    def course_count(self):
        # ✨ PHASE 4+: Only count published courses for public display
        # Excludes courses in "Review", "Draft", or "Rejected" status
        # [*] PHASE 4.77 FIX: Also filter by is_published_version=True to avoid double counting
        # In dual-copy versioning system: draft has is_published_version=False, published copy has is_published_version=True
        return Course.objects.filter(
            category=self,
            platform_status="Published",
            is_published_version=True  # [*] PHASE 4.77: Count only published copies, not drafts
        ).count()
    
    def save(self, *args, **kwargs):
        if self.slug == "" or self.slug == None:
            self.slug = slugify(self.title) 
        super(Category, self).save(*args, **kwargs)

class Tag(models.Model):
    """
    ✨ PHASE X: Course Tags for fine-grained content categorization
    - Allows instructors to tag courses with multiple labels
    - Separate from Category for flexible organization
    - Can be empty (null=True, blank=True for courses)
    """
    title = models.CharField(max_length=100)
    active = models.BooleanField(default=True)
    slug = models.SlugField(max_length=200, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name_plural = "Tags"
        ordering = ['title']

    def __str__(self):
        return self.title
    
    def course_count(self):
        """Count published courses tagged with this tag"""
        return self.courses.filter(
            platform_status="Published",
            is_published_version=True
        ).count()
    
    def save(self, *args, **kwargs):
        if self.slug == "" or self.slug == None:
            self.slug = slugify(self.title) 
        super(Tag, self).save(*args, **kwargs)
            
class Course(models.Model):
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name='courses')
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, blank=True, null=True)
    file = models.URLField(max_length=500, blank=True, null=True)  # Changed to URLField for file-upload API
    image = models.URLField(max_length=500, blank=True, null=True)  # Changed to URLField for file-upload API
    title = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(null=True, blank=True)
    level = models.CharField(choices=LEVEL, default="Beginner", max_length=100, blank=True, null=True)
    target_audience = models.CharField(choices=TARGET_AUDIENCE, default="pegawai", max_length=50, blank=True, null=True, verbose_name="Target Peserta")
    platform_status = models.CharField(choices=PLATFORM_STATUS, default="Draft", max_length=100, blank=True, null=True)
    teacher_course_status = models.CharField(choices=TEACHER_STATUS, default="Draft", max_length=100)
    featured = models.BooleanField(default=False)
    course_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    slug = models.SlugField(max_length=200, unique=True, null=True, blank=True)
    date = models.DateTimeField(default=timezone.now)
    
    # ✨ PHASE 4.18: Intro video source type
    # REMOVED: YouTube video support - only uploaded videos
    # OLD FIELD: intro_video_source (removed)
    
    # ✨ PHASE 4: PostgreSQL Full-Text Search field
    search_vector = SearchVectorField(null=True, blank=True)
    
    # ✨ PHASE 4.36: Course approval workflow
    # When instructor submits for review, platform_status = "Review"
    # When admin approves, platform_status = "Published"
    # When admin rejects, platform_status = "Rejected" and rejection_reason is set
    rejection_reason = models.TextField(null=True, blank=True)  # Admin's reason for rejection
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_courses")  # Admin who approved
    approval_date = models.DateTimeField(null=True, blank=True)  # When course was approved
    review_submitted_date = models.DateTimeField(null=True, blank=True)  # When instructor submitted for review
    
    # ✨ PHASE 4.60: Course Versioning - Dual-Copy System
    # Prevents instructor edits from affecting students' learning experience
    is_published_version = models.BooleanField(
        default=False,
        help_text="Flag indicating this is the student-facing published version"
    )
    parent_course = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='published_copies',
        help_text="Points to instructor's draft if this is a published version copy"
    )
    
    # ✨ PHASE 4.72: Published Snapshot for Restore Functionality
    # Stores a JSON snapshot of the course data when it's published
    published_snapshot = models.JSONField(
        null=True,
        blank=True,
        help_text="JSON snapshot of course state when published (for restore functionality)"
    )
    
    # E-Learning SCORM 1.2 & H5P integration fields
    course_type = models.CharField(
        max_length=20,
        choices=(
            ('standard', 'Standar (Video/Materi)'),
            ('scorm_12', 'SCORM 1.2'),
            ('h5p', 'H5P Interactive Content'),
        ),
        default='standard',
        verbose_name="Tipe Kursus"
    )
    learning_module = models.ForeignKey(
        'LearningModule',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_courses',
        verbose_name="Modul E-Learning Utama"
    )


    class Meta:
        # ✨ PHASE 4: GIN index for fast full-text search queries
        indexes = [
            GinIndex(fields=['search_vector']),
        ]

    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        # Generate slug if it's empty or None
        if not self.slug:
            # First save to get pk if creating new instance
            if not self.pk:
                # Generate base slug from title
                base_slug = slugify(self.title) if self.title else 'course'
                # Save first to get pk
                super(Course, self).save(*args, **kwargs)
                # Now update slug with pk
                self.slug = f"{base_slug}-{self.pk}"
                # Update without calling save again
                kwargs['force_insert'] = False
        
        super(Course, self).save(*args, **kwargs)

    def get_related_course_ids(self):
        """
        Returns all course IDs associated with this course family
        (self, parent draft course, and all published/draft copies).
        """
        related = {self.id}
        if self.parent_course_id:
            related.add(self.parent_course_id)
            related.update(
                Course.objects.filter(parent_course_id=self.parent_course_id).values_list('id', flat=True)
            )
        related.update(
            Course.objects.filter(parent_course=self).values_list('id', flat=True)
        )
        return related

    def students(self):
        related_ids = self.get_related_course_ids()
        return EnrolledCourse.objects.filter(course_id__in=related_ids)
    
    def curriculum(self):
        return Variant.objects.filter(course=self)
    
    def lectures(self):
        return VariantItem.objects.filter(variant__course=self).exclude(item_type='quiz')
    
    def average_rating(self):
        related_ids = self.get_related_course_ids()
        average_rating = Review.objects.filter(course_id__in=related_ids, active=True).aggregate(avg_rating=models.Avg('rating'))
        return average_rating['avg_rating']
    
    # ✨ PHASE 4.60: Versioning support methods
    def create_published_copy(self):
        """
        Creates a published copy of this course for student viewing.
        Used when instructor submits course for the first time or when admin approves changes.
        
        [*] PHASE 4.85 FIX: Initial status is "Review" (not "Published")
        - When instructor submits NEW course, published copy created with platform_status="Review"
        - Published copy hidden from students until admin approves
        - When admin approves, status changed to "Published" by CourseApprovalAPIView
        - This prevents unreview courses from appearing on homepage
        
        Returns: The newly created published course copy
        """
        from django.db import transaction
        from shortuuid import ShortUUID
        
        with transaction.atomic():
            # Generate unique course_id for published copy
            su = ShortUUID(alphabet="0123456789")
            unique_course_id = su.random(6)
            
            # Create copy of this course
            published_copy = Course.objects.create(
                teacher=self.teacher,
                category=self.category,
                file=self.file,
                image=self.image,
                title=self.title,
                description=self.description,
                level=self.level,
                target_audience=self.target_audience,
                course_id=unique_course_id,  # Unique ID for published copy
                
                # Status fields
                # [*] PHASE 4.85 FIX: Start as "Review" (will become "Published" when admin approves)
                # This prevents new courses from appearing on homepage before admin review complete
                platform_status="Review",
                teacher_course_status=self.teacher_course_status,
                
                # Versioning
                parent_course=self,
                is_published_version=True,
                
                # Meta
                featured=self.featured,
            )
            
            # Copy all course content
            self._copy_content_to(published_copy)
            
            return published_copy
    
    def create_draft_version(self):
        """
        Creates a new draft version of a published course for editing.
        Used when instructor edits an already-published course.
        
        Returns: The newly created draft course
        """
        from django.db import transaction
        
        with transaction.atomic():
            # Create copy of this course with Review status
            draft_copy = Course.objects.create(
                teacher=self.teacher,
                category=self.category,
                file=self.file,
                image=self.image,
                title=self.title,
                description=self.description,
                level=self.level,
                target_audience=self.target_audience,
                
                # Status fields
                platform_status="Review",
                teacher_course_status=self.teacher_course_status,
                
                # Versioning
                parent_course=self,
                is_published_version=False,
                
                # Meta
                featured=self.featured,
            )
            
            # Copy all course content
            self._copy_content_to(draft_copy)
            
            return draft_copy
    
    def save_published_snapshot(self):
        """
        ✨ PHASE 4.72: Save a JSON snapshot of the course's current state
        ✨ PHASE 7.5k FIX: Include tags in snapshot for restoration
        
        Called when course is first published or when published changes are approved
        
        Used for restore functionality - allows instructors to undo changes
        if they make mistakes while editing a published course
        """
        self.published_snapshot = {
            "title": self.title,
            "description": self.description,
            "level": self.level,
            "target_audience": self.target_audience,
            "image": self.image,
            "file": self.file,
            "featured": self.featured,
            "category_id": self.category.id if self.category else None,
            "tag_ids": list(self.tags.values_list('id', flat=True)),
        }
        self.save()
    
    def restore_from_published_snapshot(self):
        """
        ✨ PHASE 4.72: Restore course to its last published state from snapshot
        ✨ PHASE 7.5k FIX: Include tags restoration from snapshot
        
        Used when instructor clicks "Restore Kursus" button
        Returns True if restore was successful, False if no snapshot available
        """
        if not self.published_snapshot:
            return False
        
        snapshot = self.published_snapshot
        
        # Restore all fields from snapshot
        self.title = snapshot.get("title", self.title)
        self.description = snapshot.get("description", self.description)
        self.level = snapshot.get("level", self.level)
        self.image = snapshot.get("image", self.image)
        self.file = snapshot.get("file", self.file)
        self.featured = snapshot.get("featured", self.featured)
        
        # Restore category
        category_id = snapshot.get("category_id")
        if category_id:
            try:
                self.category = Category.objects.get(id=category_id)
            except Category.DoesNotExist:
                pass
        
        # ✨ PHASE 7.5k FIX: Restore tags from snapshot
        tag_ids = snapshot.get("tag_ids", [])
        if tag_ids:
            try:
                tags = Tag.objects.filter(id__in=tag_ids)
                self.tags.set(tags)
                print(f"[Restore Snapshot] Restored {len(tag_ids)} tags")
            except Exception as e:
                print(f"[Restore Snapshot] Error restoring tags: {str(e)}")
        else:
            self.tags.clear()
        
        # Reset status back to Published (it was changed to Review during edit)
        self.platform_status = "Published"
        
        self.save()
        return True
    
    def _copy_content_to(self, target_course, clear_target=True):
        """
        ✨ PHASE 4.74: Enhanced method to copy ALL course-related content to target course.
        ✨ PHASE 4.77 FIXED: Now also copies course metadata (image, title, description, level, etc.)
        ✨ PHASE 7.5i CRITICAL: Understand implications of clear_target parameter!
        
        Copies: course metadata + curriculum, features, requirements, learning outcomes, AND quizzes with questions/choices
        Used by: submit_for_publication, admin approval, restore operations
        
        This is the PRIMARY method for versioning - ensures complete content sync
        
        Args:
            target_course: The course to copy content to
            clear_target: 
                - TRUE: Delete ALL existing content before copying (creates fresh copy, ERASES student progress!)
                  Use for: Fresh published copies, restoring from published (confirm no active enrollments)
                - FALSE: Keep existing content, only add/update new items (PRESERVES student progress!)
                  Use for: Re-publishing with active student enrollments (prevents data loss)
        
        ⚠️ CRITICAL: If target_course has student enrollments:
           - clear_target=True WILL cascade-delete all CompletedLesson and VideoProgress records!
           - Always use clear_target=False when target_course is PUBLISHED version with active enrollments!
        """
        from django.db import transaction
        
        with transaction.atomic():
            print(f"[Content Copy] Starting copy from {self.title} to {target_course.title}")
            
            # ✨ PHASE 4.77 FIXED: Copy core course metadata first
            print(f"[Content Copy] Syncing course metadata (title, description, image, level, etc.)...")
            target_course.title = self.title
            target_course.description = self.description
            target_course.level = self.level
            target_course.target_audience = self.target_audience
            target_course.course_type = self.course_type
            target_course.image = self.image
            target_course.file = self.file
            target_course.featured = self.featured
            # ✨ PHASE 7.5g FIX: Copy category (was missing, causing N/A on published preview)
            target_course.category = self.category
            target_course.save()
            print(f"[Content Copy] [OK] Course metadata synced")
            
            # ✨ Smart Content Synchronization: Clear non-progress items or full wipe if requested
            if clear_target:
                print(f"[Content Copy] Full clearing existing content from target course...")
                target_course.curriculum.all().delete()
                target_course.quizzes.all().delete()
                target_course.features.all().delete()
                target_course.requirements.all().delete()
                target_course.learning_outcomes.all().delete()
                print(f"[Content Copy] [OK] Target course content fully cleared")
            else:
                # Features, requirements, and outcomes have no student progress - clean refresh prevents duplicates
                target_course.features.all().delete()
                target_course.requirements.all().delete()
                target_course.learning_outcomes.all().delete()
                print(f"[Content Copy] [OK] Non-progress metadata items refreshed")
            
            try:
                # STEP 1: Sync quizzes (Kuis, Pre-test, Post-test) intelligently to preserve QuizAttempts
                print("[Content Copy] Syncing quizzes (Kuis, Pre-test, Post-test)...")
                quiz_map = {}  # Map old quiz IDs to new/updated ones
                existing_target_quizzes = list(target_course.quizzes.all())
                used_target_quiz_ids = set()

                for quiz in self.quizzes.all():
                    target_quiz = None
                    if quiz.quiz_type == 'pre_post_test':
                        # Match pre_post_test by quiz_type
                        target_quiz = next((q for q in existing_target_quizzes if q.quiz_type == 'pre_post_test' and q.id not in used_target_quiz_ids), None)
                    
                    if not target_quiz:
                        # Match by title
                        target_quiz = next((q for q in existing_target_quizzes if q.title == quiz.title and q.id not in used_target_quiz_ids), None)

                    if not target_quiz:
                        # Match by quiz_type if any unused
                        target_quiz = next((q for q in existing_target_quizzes if q.quiz_type == quiz.quiz_type and q.id not in used_target_quiz_ids), None)

                    if target_quiz:
                        used_target_quiz_ids.add(target_quiz.id)
                        target_quiz.title = quiz.title
                        target_quiz.description = quiz.description
                        target_quiz.quiz_type = quiz.quiz_type
                        target_quiz.presentation_mode = quiz.presentation_mode
                        target_quiz.is_active = quiz.is_active
                        target_quiz.save()
                        print(f"[Content Copy] [OK] Updated existing quiz '{target_quiz.title}' (ID: {target_quiz.id}, preserving student QuizAttempts)")

                        # Sync questions & choices for this quiz
                        target_quiz.questions.all().delete()
                        for question in quiz.questions.all():
                            new_q = QuizQuestion.objects.create(
                                quiz=target_quiz,
                                question_text=question.question_text,
                                order=question.order,
                            )
                            for choice in question.choices.all():
                                QuizChoice.objects.create(
                                    question=new_q,
                                    choice_text=choice.choice_text,
                                    is_correct=choice.is_correct,
                                    order=choice.order,
                                )
                        quiz_map[quiz.id] = target_quiz
                    else:
                        new_quiz = Quiz.objects.create(
                            course=target_course,
                            title=quiz.title,
                            description=quiz.description,
                            quiz_type=quiz.quiz_type,
                            presentation_mode=quiz.presentation_mode,
                            is_active=quiz.is_active,
                        )
                        used_target_quiz_ids.add(new_quiz.id)
                        for question in quiz.questions.all():
                            new_q = QuizQuestion.objects.create(
                                quiz=new_quiz,
                                question_text=question.question_text,
                                order=question.order,
                            )
                            for choice in question.choices.all():
                                QuizChoice.objects.create(
                                    question=new_q,
                                    choice_text=choice.choice_text,
                                    is_correct=choice.is_correct,
                                    order=choice.order,
                                )
                        quiz_map[quiz.id] = new_quiz
                        print(f"[Content Copy] [OK] Created new quiz '{new_quiz.title}' (ID: {new_quiz.id})")

                # Handle obsolete target quizzes no longer in draft
                for obsolete_quiz in target_course.quizzes.exclude(id__in=used_target_quiz_ids):
                    if obsolete_quiz.attempts.exists():
                        obsolete_quiz.is_active = False
                        obsolete_quiz.save()
                        print(f"[Content Copy] [OK] Deactivated obsolete quiz with attempts: '{obsolete_quiz.title}' (ID: {obsolete_quiz.id})")
                    else:
                        obsolete_quiz.delete()
                        print(f"[Content Copy] [OK] Deleted obsolete quiz with no attempts: '{obsolete_quiz.title}' (ID: {obsolete_quiz.id})")

                print(f"[Content Copy] [OK] Synced {len(quiz_map)} quizzes")

                # STEP 2: Sync curriculum sections (Bagian) & lessons (Pelajaran) intelligently
                print("[Content Copy] Syncing curriculum sections & lessons...")
                variant_map = {}
                existing_target_variants = list(target_course.curriculum.all())
                used_target_variant_ids = set()

                for variant in self.curriculum.all():
                    # Match existing variant by order or title
                    target_variant = next((v for v in existing_target_variants if (v.order == variant.order or v.title == variant.title) and v.id not in used_target_variant_ids), None)
                    if not target_variant and existing_target_variants:
                        target_variant = next((v for v in existing_target_variants if v.id not in used_target_variant_ids), None)

                    if target_variant:
                        used_target_variant_ids.add(target_variant.id)
                        target_variant.title = variant.title
                        target_variant.order = variant.order
                        target_variant.save()
                    else:
                        target_variant = Variant.objects.create(
                            course=target_course,
                            title=variant.title,
                            order=variant.order,
                        )
                        used_target_variant_ids.add(target_variant.id)
                    variant_map[variant.id] = target_variant

                    existing_target_items = list(target_variant.variant_items.all())
                    used_target_item_ids = set()

                    for item in variant.variant_items.all():
                        target_item = None
                        target_quiz_for_item = quiz_map.get(item.quiz_id) if getattr(item, 'quiz_id', None) else None

                        # Match quiz items by quiz
                        if getattr(item, 'item_type', 'lesson') == 'quiz' and target_quiz_for_item:
                            target_item = next((ti for ti in existing_target_items if ti.quiz_id == target_quiz_for_item.id and ti.id not in used_target_item_ids), None)

                        # Match lesson items by order + title, or order, or title
                        if not target_item:
                            target_item = next((ti for ti in existing_target_items if ti.order == item.order and ti.title == item.title and ti.id not in used_target_item_ids), None)
                        if not target_item:
                            target_item = next((ti for ti in existing_target_items if ti.order == item.order and ti.id not in used_target_item_ids), None)
                        if not target_item:
                            target_item = next((ti for ti in existing_target_items if ti.title == item.title and ti.id not in used_target_item_ids), None)

                        if target_item:
                            used_target_item_ids.add(target_item.id)
                            target_item.title = item.title
                            target_item.description = item.description
                            target_item.file = item.file
                            target_item.duration = item.duration
                            target_item.preview = item.preview
                            target_item.order = item.order
                            target_item.item_type = getattr(item, 'item_type', 'lesson')
                            target_item.quiz = target_quiz_for_item
                            target_item.learning_module = item.learning_module
                            target_item.save()
                            print(f"[Content Copy] [OK] Updated existing lesson '{target_item.title}' (ID: {target_item.id}, preserving CompletedLesson/VideoProgress)")

                            # Sync completion question
                            if hasattr(item, 'completion_question') and item.completion_question:
                                orig_q = item.completion_question
                                if hasattr(target_item, 'completion_question') and target_item.completion_question:
                                    tq = target_item.completion_question
                                    tq.question_text = orig_q.question_text
                                    tq.question_type = orig_q.question_type
                                    tq.correct_answer_text = orig_q.correct_answer_text
                                    tq.case_sensitive = orig_q.case_sensitive
                                    tq.save()
                                    tq.choices.all().delete()
                                    for choice in orig_q.choices.all():
                                        LessonCompletionQuestionChoice.objects.create(
                                            question=tq,
                                            choice_text=choice.choice_text,
                                            is_correct=choice.is_correct,
                                            order=choice.order,
                                        )
                                else:
                                    new_q = LessonCompletionQuestion.objects.create(
                                        variant_item=target_item,
                                        question_text=orig_q.question_text,
                                        question_type=orig_q.question_type,
                                        correct_answer_text=orig_q.correct_answer_text,
                                        case_sensitive=orig_q.case_sensitive,
                                    )
                                    for choice in orig_q.choices.all():
                                        LessonCompletionQuestionChoice.objects.create(
                                            question=new_q,
                                            choice_text=choice.choice_text,
                                            is_correct=choice.is_correct,
                                            order=choice.order,
                                        )
                            elif hasattr(target_item, 'completion_question') and target_item.completion_question:
                                target_item.completion_question.delete()
                        else:
                            new_item = VariantItem.objects.create(
                                variant=target_variant,
                                title=item.title,
                                description=item.description,
                                file=item.file,
                                duration=item.duration,
                                preview=item.preview,
                                order=item.order,
                                item_type=getattr(item, 'item_type', 'lesson'),
                                quiz=target_quiz_for_item,
                                learning_module=item.learning_module,
                            )
                            used_target_item_ids.add(new_item.id)
                            print(f"[Content Copy] [OK] Created new lesson '{new_item.title}' (ID: {new_item.id})")

                            if hasattr(item, 'completion_question') and item.completion_question:
                                orig_q = item.completion_question
                                new_q = LessonCompletionQuestion.objects.create(
                                    variant_item=new_item,
                                    question_text=orig_q.question_text,
                                    question_type=orig_q.question_type,
                                    correct_answer_text=orig_q.correct_answer_text,
                                    case_sensitive=orig_q.case_sensitive,
                                )
                                for choice in orig_q.choices.all():
                                    LessonCompletionQuestionChoice.objects.create(
                                        question=new_q,
                                        choice_text=choice.choice_text,
                                        is_correct=choice.is_correct,
                                        order=choice.order,
                                    )

                    # Obsolete items in target variant
                    for obsolete_item in target_variant.variant_items.exclude(id__in=used_target_item_ids):
                        has_progress = (
                            CompletedLesson.objects.filter(variant_item=obsolete_item).exists() or
                            VideoProgress.objects.filter(variant_item=obsolete_item).exists()
                        )
                        if not has_progress:
                            obsolete_item.delete()
                            print(f"[Content Copy] [OK] Deleted obsolete lesson '{obsolete_item.title}' with no progress")
                        else:
                            print(f"[Content Copy] [OK] Preserved obsolete lesson '{obsolete_item.title}' with active student progress")

                # Obsolete variants in target course
                for obsolete_variant in target_course.curriculum.exclude(id__in=used_target_variant_ids):
                    has_progress = (
                        CompletedLesson.objects.filter(variant_item__variant=obsolete_variant).exists() or
                        VideoProgress.objects.filter(variant_item__variant=obsolete_variant).exists()
                    )
                    if not has_progress:
                        obsolete_variant.delete()
                        print(f"[Content Copy] [OK] Deleted obsolete section '{obsolete_variant.title}' with no progress")
                    else:
                        print(f"[Content Copy] [OK] Preserved obsolete section '{obsolete_variant.title}' with active student progress")

                print(f"[Content Copy] [OK] Synced {len(variant_map)} curriculum sections")
                # STEP 3: Copy course features (Fitur)
                print("[Content Copy] Copying course features (Fitur)...")
                for feature in self.features.all():
                    CourseFeature.objects.create(
                        course=target_course,
                        icon=feature.icon,
                        text=feature.text,
                        highlight=feature.highlight,
                        order=feature.order,
                    )
                print(f"[Content Copy] [OK] Copied {self.features.count()} features")
                
                # STEP 4: Copy course requirements (Persyaratan)
                print("[Content Copy] Copying course requirements (Persyaratan)...")
                for req in self.requirements.all():
                    CourseRequirement.objects.create(
                        course=target_course,
                        requirement=req.requirement,
                        order=req.order,
                    )
                print(f"[Content Copy] [OK] Copied {self.requirements.count()} requirements")
                
                # STEP 5: Copy learning outcomes (Hasil Pembelajaran)
                print("[Content Copy] Copying learning outcomes (Hasil Pembelajaran)...")
                for outcome in self.learning_outcomes.all():
                    CourseLearningOutcome.objects.create(
                        course=target_course,
                        outcome=outcome.outcome,
                        order=outcome.order,
                    )
                print(f"[Content Copy] [OK] Copied {self.learning_outcomes.count()} learning outcomes")
                
                # STEP 6: Sync course games (Gamifikasi) intelligently
                print("[Content Copy] Syncing course games (Gamifikasi)...")
                existing_target_games = {}
                for tg in target_course.games.all():
                    existing_target_games.setdefault(tg.game_type, []).append(tg)
                
                synced_target_game_ids = set()

                for game in self.games.all():
                    matching_target_games = existing_target_games.get(game.game_type, [])
                    if matching_target_games:
                        # Prefer target game that already has student attempts, or the first one
                        primary_game = next((g for g in matching_target_games if g.attempts.exists()), matching_target_games[0])
                        primary_game.title = game.title
                        primary_game.description = game.description
                        primary_game.game_data = game.game_data
                        primary_game.max_attempts = game.max_attempts
                        primary_game.points_reward = game.points_reward
                        primary_game.time_limit_seconds = game.time_limit_seconds
                        primary_game.is_active = game.is_active
                        primary_game.order = game.order
                        primary_game.save()
                        synced_target_game_ids.add(primary_game.id)
                        print(f"[Content Copy] [OK] Updated existing game '{primary_game.title}' (ID: {primary_game.id}, type: {game.game_type})")

                        # If there are duplicate games for this game_type in target_course (from past bugs):
                        for extra_game in matching_target_games:
                            if extra_game.id != primary_game.id:
                                if extra_game.attempts.exists():
                                    extra_game.is_active = False
                                    extra_game.save()
                                    print(f"[Content Copy] [OK] Deactivated duplicate game with attempts ID {extra_game.id}")
                                else:
                                    extra_game.delete()
                                    print(f"[Content Copy] [OK] Cleaned up duplicate game ID {extra_game.id}")
                    else:
                        new_game = CourseGame.objects.create(
                            course=target_course,
                            title=game.title,
                            description=game.description,
                            game_type=game.game_type,
                            game_data=game.game_data,
                            max_attempts=game.max_attempts,
                            points_reward=game.points_reward,
                            time_limit_seconds=game.time_limit_seconds,
                            is_active=game.is_active,
                            order=game.order,
                        )
                        synced_target_game_ids.add(new_game.id)
                        print(f"[Content Copy] [OK] Created new game '{new_game.title}' (ID: {new_game.id}, type: {game.game_type})")

                # Handle target games no longer present in draft
                for obsolete_game in target_course.games.exclude(id__in=synced_target_game_ids):
                    if obsolete_game.attempts.exists():
                        obsolete_game.is_active = False
                        obsolete_game.save()
                        print(f"[Content Copy] [OK] Deactivated obsolete game with attempts: '{obsolete_game.title}' (ID: {obsolete_game.id})")
                    else:
                        obsolete_game.delete()
                        print(f"[Content Copy] [OK] Deleted obsolete game with no attempts: '{obsolete_game.title}' (ID: {obsolete_game.id})")

                print(f"[Content Copy] [OK] Synced {self.games.count()} games")

                # ✨ PHASE 7.5 FIX: Copy tags (course categorization metadata)
                print("[Content Copy] Copying course tags...")
                target_course.tags.set(self.tags.all())
                print(f"[Content Copy] [OK] Copied {self.tags.count()} tags")
                
                print("[Content Copy] [DONE] ALL CONTENT COPIED SUCCESSFULLY")
                
            except Exception as e:
                print(f"[Content Copy] [FAIL] ERROR during content copy: {str(e)}")
                import traceback
                traceback.print_exc()
                raise
    
    def submit_for_publication(self):
        """
        ✨ PHASE 4.74 FIXED (PHASE 4.75): When instructor clicks "Ajukan Publikasi Kursus"
        
        KEY FIX: NEVER update published version before admin approval!
        - If NEVER published: Creates new published course copy with all content
        - If ALREADY published: DO NOT update here - wait for admin approval via CourseApprovalAPIView
        
        Published version only changes when:
        1. Admin clicks "Approve" → CourseApprovalAPIView._get_or_create_published_copy() updates it
        2. OR course never existed → create initial published copy
        
        Returns: (published_course, is_new)
        """
        from django.db import transaction
        
        with transaction.atomic():
            print(f"[Submit] Processing submission for: {self.title}")
            
            # Get existing published copy if any
            published_copies = self.published_copies.filter(
                is_published_version=True
            )
            
            if published_copies.exists():
                # ALREADY PUBLISHED: Do NOT update! Admin will do that on approval
                published = published_copies.first()
                print(f"[Submit] [OK] Found existing published copy (ID: {published.id})")
                print(f"[Submit] [WARN]  IMPORTANT: Published version NOT updated. Admin will approve changes.")
                is_new = False
            else:
                # FIRST TIME PUBLISHING: Create initial published copy with current draft content
                published = self.create_published_copy()
                print(f"[Submit] [OK] Created new published copy (ID: {published.id})")
                is_new = True
            
            # Set status to Review (waiting for admin approval)
            self.platform_status = "Review"
            self.review_submitted_date = timezone.now()
            self.rejection_reason = None
            self.save()
            print(f"[Submit] [OK] Course status set to Review, awaiting admin approval")
            print(f"[Submit] [OK] Published version remains UNCHANGED. Students see old content until admin approves.")
            
            return published, is_new
    
    def restore_to_published(self):
        """
        ✨ PHASE 4.74: Restore draft course to published state
        
        Called when instructor clicks "Restore Kursus" button
        - Deletes all draft content
        - Re-copies everything from published version
        - Restores metadata from published_snapshot
        
        Returns: (success, message)
        """
        from django.db import transaction
        
        with transaction.atomic():
            print(f"[Restore] Starting restore for: {self.title}")
            
            # Get published version
            published_copies = self.published_copies.filter(
                is_published_version=True,
                platform_status="Published"
            )
            
            if not published_copies.exists():
                msg = "Tidak ada versi terpublikasi untuk dikembalikan"
                print(f"[Restore] [FAIL] {msg}")
                return False, msg
            
            published = published_copies.first()
            
            # Delete all draft content
            print(f"[Restore] Deleting draft content...")
            self.curriculum.all().delete()
            self.quizzes.all().delete()
            self.features.all().delete()
            self.requirements.all().delete()
            self.learning_outcomes.all().delete()
            self.games.all().delete()
            print(f"[Restore] [OK] Deleted draft content")
            
            # Re-copy from published version (clear_target=False since we already deleted above)
            print(f"[Restore] Re-copying from published version...")
            published._copy_content_to(self, clear_target=False)
            
            # Restore metadata from snapshot
            if self.published_snapshot:
                print(f"[Restore] Restoring metadata from snapshot...")
                self.restore_from_published_snapshot()
            else:
                # No snapshot, just copy metadata from published
                self.title = published.title
                self.description = published.description
                self.level = published.level
                self.image = published.image
                self.file = published.file
                self.featured = published.featured
                if published.category:
                    self.category = published.category
                # ✨ PHASE 7.5k FIX: Also restore tags when no snapshot available
                self.tags.set(published.tags.all())
                self.platform_status = "Published"
                self.save()
            
            print(f"[Restore] [DONE] Course successfully restored to published state")
            return True, "Kursus berhasil dikembalikan ke versi yang dipublikasikan"
    
    def rating_count(self):
        related_ids = self.get_related_course_ids()
        return Review.objects.filter(course_id__in=related_ids, active=True).count()
    
    def reviews(self):
        related_ids = self.get_related_course_ids()
        return Review.objects.filter(course_id__in=related_ids, active=True)
    
class Variant(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="curriculum")
    title = models.CharField(max_length=1000)
    variant_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    order = models.IntegerField(default=0, db_index=True)  # For consistent ordering
    date = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['order', 'date']  # Ensure consistent retrieval order
        verbose_name = "Bagian"  # Section in Indonesian
        verbose_name_plural = "Bagian-Bagian"

    def __str__(self):
        return self.title
    
    def variant_items(self):
        return VariantItem.objects.filter(variant=self).order_by('order', 'date')
    
    def items(self):
        return VariantItem.objects.filter(variant=self).order_by('order', 'date')
    
    
class VariantItem(models.Model):
    ITEM_TYPE_CHOICES = (
        ('lesson', 'Pelajaran'),
        ('quiz', 'Kuis'),
    )

    variant = models.ForeignKey(Variant, on_delete=models.CASCADE, related_name="variant_items")
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES, default='lesson', db_index=True)
    quiz = models.ForeignKey(
        'Quiz',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='variant_items',
        verbose_name="Kuis Terkait"
    )
    learning_module = models.ForeignKey(
        'LearningModule',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='variant_items',
        verbose_name="Modul E-Learning (SCORM/H5P)"
    )
    title = models.CharField(max_length=1000)
    description = models.TextField(null=True, blank=True)
    file = models.URLField(max_length=500, blank=True, null=True)  # Changed to URLField for file-upload API
    duration = models.DurationField(null=True, blank=True)  # Store precise duration for videos
    preview = models.BooleanField(default=False)
    variant_item_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    order = models.IntegerField(default=0, db_index=True)  # For consistent ordering
    date = models.DateTimeField(default=timezone.now)
    # ✨ PHASE 4.187: Store lesson media source
    # REMOVED: YouTube video support - only uploaded videos
    # OLD FIELD: media_source (removed)

    class Meta:
        ordering = ['order', 'date']  # Ensure consistent retrieval order
        verbose_name = "Pelajaran"  # Lesson in Indonesian
        verbose_name_plural = "Pelajaran-Pelajaran"
    
    @property
    def content_duration(self):
        """Convert duration to human-readable format"""
        if self.duration:
            total_seconds = int(self.duration.total_seconds())
            minutes, seconds = divmod(total_seconds, 60)
            return f"{minutes}m {seconds}s"
        return "0m 0s"
    
    @property
    def file_type(self):
        """Determine file type based on item_type, URL extension or linked learning_module"""
        if self.item_type == 'quiz' or self.quiz_id:
            return "quiz"
        if self.learning_module_id:
            return "h5p" if self.learning_module.module_type == "h5p" else "scorm"
        if not self.file:
            return "unknown"
        
        file_url = self.file.lower()
        if any(ext in file_url for ext in ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.ogv']):
            return "video"
        elif any(ext in file_url for ext in ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg']):
            return "audio"
        elif any(ext in file_url for ext in ['.zip']) and 'scorm' in file_url:
            return "scorm"
        elif any(ext in file_url for ext in ['.h5p']):
            return "h5p"
        elif any(ext in file_url for ext in ['.pdf']):
            return "pdf"
        elif any(ext in file_url for ext in ['.doc', '.docx']):
            return "document"
        elif any(ext in file_url for ext in ['.ppt', '.pptx']):
            return "presentation"
        elif any(ext in file_url for ext in ['.jpg', '.jpeg', '.png', '.gif']):
            return "image"
        else:
            return "file"
    
    @property
    def file_icon(self):
        """Return appropriate icon class for file type"""
        file_type = self.file_type
        icon_map = {
            "video": "fas fa-play-circle",
            "audio": "fas fa-headphones",
            "scorm": "fas fa-cubes",
            "h5p": "fas fa-puzzle-piece",
            "pdf": "fas fa-file-pdf",
            "document": "fas fa-file-word",
            "presentation": "fas fa-file-powerpoint",
            "image": "fas fa-image",
            "file": "fas fa-file"
        }
        return icon_map.get(file_type, "fas fa-file")
    
    def clean(self):
        """✨ PHASE 4.170: Validate that duration is cleared when file and learning module are empty"""
        from django.core.exceptions import ValidationError
        
        # If both file and learning_module are empty, duration should also be empty
        if not self.file and not self.learning_module_id and self.duration:
            raise ValidationError({
                'duration': 'Durasi harus kosong ketika File dan Modul E-Learning kosong. Silakan bersihkan field durasi.',
            })
    
    def save(self, *args, **kwargs):
        # ✨ PHASE 4.170: Auto-clear duration when both file and learning module are empty
        if not self.file and not self.learning_module_id:
            self.duration = None
        
        super().save(*args, **kwargs)

        # Note: Video duration extraction is now handled by the file-upload API
        # The duration information is returned when uploading the video file


# ✨ PHASE 4.143: Lesson Completion Verification System
# Questions students must answer before marking lesson as complete
QUESTION_TYPE_CHOICES = (
    ('multiple_choice', 'Multiple Choice (Single Select)'),
    ('multi_select', 'Multi-Select'),
    ('short_answer', 'Short Answer'),
    ('fill_in_blank', 'Fill in the Blank'),
)

class LessonCompletionQuestion(models.Model):
    """
    Question displayed when student finishes watching a lesson (100% duration).
    Student must answer correctly before lesson is marked as complete.
    """
    variant_item = models.OneToOneField(VariantItem, on_delete=models.CASCADE, related_name='completion_question')
    question_text = models.TextField(help_text="The question that will be displayed to the student")
    question_type = models.CharField(
        max_length=20,
        choices=QUESTION_TYPE_CHOICES,
        default='multiple_choice',
        help_text="Type of question: multiple choice, multi-select, short answer, or fill in blank"
    )
    
    # For short answer and fill in blank - the correct answer text
    correct_answer_text = models.TextField(
        blank=True,
        null=True,
        help_text="For short answer/fill in blank: the correct answer text"
    )
    
    # Case sensitivity for text-based answers
    case_sensitive = models.BooleanField(
        default=False,
        help_text="For short answer/fill in blank: whether answer is case-sensitive"
    )
    
    question_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Lesson Completion Question"
        verbose_name_plural = "Lesson Completion Questions"
    
    def __str__(self):
        return f"{self.variant_item.title} - {self.get_question_type_display()}"
    
    def check_answer(self, student_answer):
        """
        Check if student's answer is correct.
        Returns True if correct, False otherwise.
        Supports multiple acceptable answers separated by semicolons (;) or commas (,) or newlines (\n).
        """
        if self.question_type in ['short_answer', 'fill_in_blank']:
            if not self.correct_answer_text:
                return False

            raw_student_text = (student_answer or "").strip()
            if not raw_student_text:
                return False

            # Support multiple valid keys separated by semicolon, comma, or newline
            # Example: "Jakarta; DKI Jakarta; Daerah Khusus Ibukota"
            import re
            valid_keys = [
                k.strip() for k in re.split(r'[;\n\r]+', self.correct_answer_text)
                if k.strip()
            ]

            # If no semicolon/newline split happened, also try comma if user typed commas
            if len(valid_keys) <= 1 and ',' in self.correct_answer_text:
                valid_keys = [k.strip() for k in self.correct_answer_text.split(',') if k.strip()]

            # Fallback to entire text if empty
            if not valid_keys:
                valid_keys = [self.correct_answer_text.strip()]

            if not self.case_sensitive:
                raw_student_text = raw_student_text.lower()
                valid_keys = [k.lower() for k in valid_keys]

            return raw_student_text in valid_keys

        # For multiple choice and multi-select, checking done via choices
        return False


class LessonCompletionQuestionChoice(models.Model):
    """
    Choices for multiple choice and multi-select completion questions
    """
    question = models.ForeignKey(
        LessonCompletionQuestion,
        on_delete=models.CASCADE,
        related_name='choices',
        limit_choices_to={'question_type__in': ['multiple_choice', 'multi_select']}
    )
    choice_text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    choice_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    
    class Meta:
        ordering = ['order']
        verbose_name = "Lesson Completion Question Choice"
        verbose_name_plural = "Lesson Completion Question Choices"
    
    def __str__(self):
        status = "[✓]" if self.is_correct else "[ ]"
        return f"{status} {self.choice_text[:50]}"
    
    def save(self, *args, **kwargs):
        # For single-select multiple choice, ensure only one correct answer
        if self.is_correct and self.question.question_type == 'multiple_choice':
            LessonCompletionQuestionChoice.objects.filter(
                question=self.question,
                is_correct=True
            ).exclude(pk=self.pk).update(is_correct=False)
        super().save(*args, **kwargs)


# ✨ PHASE 11.198: Store student answers to lesson completion questions for tracking and reporting
class LessonCompletionQuestionAnswer(models.Model):
    """
    Stores student answers to lesson completion verification questions
    This allows tracking which students answered correctly/incorrectly
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lesson_completion_answers')
    question = models.ForeignKey(LessonCompletionQuestion, on_delete=models.CASCADE, related_name='student_answers')
    
    # For multiple choice or multi-select - the selected choice(s)
    answer_choice = models.ForeignKey(
        LessonCompletionQuestionChoice, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        help_text="For single-select questions"
    )
    answer_choices = models.ManyToManyField(
        LessonCompletionQuestionChoice,
        blank=True,
        related_name='student_multi_select_answers',
        help_text="For multi-select questions"
    )
    
    # For short answer or fill in blank
    answer_text = models.TextField(blank=True, null=True, help_text="For text-based answers")
    
    # Result tracking
    is_correct = models.BooleanField(default=False)
    answered_at = models.DateTimeField(auto_now_add=True)
    
    # Unique constraint to track latest answer per user per question
    class Meta:
        ordering = ['-answered_at']
        indexes = [
            models.Index(fields=['user', 'question', '-answered_at']),
        ]
    
    def __str__(self):
        status = "✓ Benar" if self.is_correct else "✗ Salah"
        return f"{self.user.username} - {self.question.variant_item.title} [{status}]"


class Question_Answer(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=1000, null=True, blank=True)
    qa_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    date = models.DateTimeField(default=timezone.now)
    # ✨ PHASE 7.7: Store lesson context (Bagian/Pelajaran) for better organization
    variant_item = models.ForeignKey(VariantItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="questions")
    is_solved = models.BooleanField(default=False)
    video_timestamp = models.IntegerField(null=True, blank=True, help_text="Timestamp in seconds for video playback")
    is_pinned = models.BooleanField(default=False, help_text="Pinned discussion to appear at the top")
    file = models.FileField(upload_to="qa_attachments/", null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.course.title}"
    
    class Meta:
        ordering = ['-is_pinned', '-date']

    def messages(self):
        return Question_Answer_Message.objects.filter(question=self)
    
    def profile(self):
        return Profile.objects.get(user=self.user)
    
class Question_Answer_Message(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    question = models.ForeignKey(Question_Answer, on_delete=models.CASCADE, related_name='reply_messages')  # ✨ PHASE 7.20: Changed from 'messages' to avoid conflict with messages() method
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    message = models.TextField(null=True, blank=True)
    qam_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    qa_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    date = models.DateTimeField(default=timezone.now)
    is_solution = models.BooleanField(default=False)
    file = models.FileField(upload_to="qa_attachments/", null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.course.title}"
    
    class Meta:
        ordering = ['date']

    def profile(self):
        return Profile.objects.get(user=self.user)
    

# ✨ PHASE 7.16: Q&A Like System - Track user likes on questions and replies
class Question_Answer_Like(models.Model):
    question = models.ForeignKey(Question_Answer, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('question', 'user')  # Prevent duplicate likes from same user
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} liked Q&A {self.question.qa_id}"


# ✨ PHASE 7.16: Q&A Message Like System - Track user likes on replies
class Question_Answer_Message_Like(models.Model):
    message = models.ForeignKey(Question_Answer_Message, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('message', 'user')  # Prevent duplicate likes from same user
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} liked reply {self.message.qa_id}"


# ✨ PHASE 7.16: Q&A Report System - Track reports on inappropriate Q&A content
class Question_Answer_Report(models.Model):
    REPORT_REASONS = [
        ('spam', 'Spam'),
        ('inappropriate', 'Konten Tidak Pantas'),
        ('offensive', 'Konten Menyinggung'),
        ('misinformation', 'Informasi Salah'),
        ('other', 'Lainnya'),
    ]
    
    question = models.ForeignKey(Question_Answer, on_delete=models.CASCADE, related_name='reports')
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)  # User who reported
    reason = models.CharField(max_length=50, choices=REPORT_REASONS, default='other')
    description = models.TextField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Review'),
            ('reviewed', 'Reviewed'),
            ('dismissed', 'Dismissed'),
            ('action_taken', 'Action Taken'),
        ],
        default='pending'
    )
    reported_at = models.DateTimeField(default=timezone.now)
    reviewed_at = models.DateTimeField(null=True, blank=True)  # When admin reviewed
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='qa_report_reviews')  # Admin who reviewed
    review_notes = models.TextField(blank=True, null=True)  # Admin notes on review
    
    class Meta:
        unique_together = ('question', 'reported_by')  # Prevent duplicate reports from same user
        ordering = ['-reported_at']
    
    def __str__(self):
        return f"Report for Q&A {self.question.qa_id} - {self.status}"


# ✨ PHASE 7.16: Q&A Message Report System - Track reports on inappropriate replies
class Question_Answer_Message_Report(models.Model):
    REPORT_REASONS = [
        ('spam', 'Spam'),
        ('inappropriate', 'Konten Tidak Pantas'),
        ('offensive', 'Konten Menyinggung'),
        ('misinformation', 'Informasi Salah'),
        ('other', 'Lainnya'),
    ]
    
    message = models.ForeignKey(Question_Answer_Message, on_delete=models.CASCADE, related_name='reports')
    reported_by = models.ForeignKey(User, on_delete=models.CASCADE)  # User who reported
    reason = models.CharField(max_length=50, choices=REPORT_REASONS, default='other')
    description = models.TextField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Review'),
            ('reviewed', 'Reviewed'),
            ('dismissed', 'Dismissed'),
            ('action_taken', 'Action Taken'),
        ],
        default='pending'
    )
    reported_at = models.DateTimeField(default=timezone.now)
    reviewed_at = models.DateTimeField(null=True, blank=True)  # When admin reviewed
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='qa_message_report_reviews')  # Admin who reviewed
    review_notes = models.TextField(blank=True, null=True)  # Admin notes on review
    
    class Meta:
        unique_together = ('message', 'reported_by')  # Prevent duplicate reports from same user
        ordering = ['-reported_at']
    
    def __str__(self):
        return f"Report for Reply {self.message.qa_id} - {self.status}"
    
# Cart, CartOrder, and CartOrderItem models removed - not used in this LMS
    
class Certificate(models.Model):
    # ✨ PHASE 4.227: Convert month number to Roman numerals for certificate ID format
    MONTH_ROMAN = {
        1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI',
        7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII'
    }
    
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    enrollment = models.ForeignKey('EnrolledCourse', on_delete=models.CASCADE, null=True, blank=True)
    certificate_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    validation_token = ShortUUIDField(unique=True, length=12, max_length=20, alphabet="abcdefghijklmnopqrstuvwxyz0123456789", editable=False)
    is_valid = models.BooleanField(default=True)
    INTEGRITY_CHOICES = (
        ('verified', 'Terverifikasi Valid'),
        ('pending_review', 'Menunggu Verifikasi Instruktur'),
        ('rejected', 'Ditolak / Terindikasi Curang'),
    )
    integrity_status = models.CharField(max_length=30, choices=INTEGRITY_CHOICES, default='verified')
    integrity_verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_certificates')
    integrity_verified_at = models.DateTimeField(null=True, blank=True)
    date = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    image_file = models.FileField(upload_to='certificates/images/', null=True, blank=True)  # ✨ PHASE 4.221: Store certificate image for display
    pdf_file = models.FileField(upload_to='certificates/', null=True, blank=True)  # ✨ PHASE 4.210: Store PDF file (kept for download)

    def __str__(self):
        return f"{self.course.title} - {self.user.full_name if self.user else 'Unknown'}"
    
    def get_formatted_certificate_id(self):
        """
        ✨ PHASE 4.227: Generate professional certificate ID format
        Format: KP.04/LMS/{certificate_id}/DPDRI/{month_roman}/{year}
        Example: KP.04/LMS/123456/DPDRI/II/2026
        """
        created_month = self.created_at.month if self.created_at else self.date.month
        created_year = self.created_at.year if self.created_at else self.date.year
        month_roman = self.MONTH_ROMAN.get(created_month, 'I')
        
        return f"KP.04/LMS/{self.certificate_id}/DPDRI/{month_roman}/{created_year}"
    
    class Meta:
        unique_together = ['course', 'user']  # One certificate per user per course
        indexes = [
            models.Index(fields=['validation_token']),
            models.Index(fields=['certificate_id']),
            models.Index(fields=['user', 'course']),
        ]

class CertificateTemplateConfig(models.Model):
    """
    Model konfigurasi template sertifikat dinamis untuk Admin LMSetjen DPD RI dan Instruktur Kursus.
    Mendukung master PPTX, background kustom, palet warna, tipografi, dan teks kop/pengesahan.
    Hierarki: Jika course terisi dan use_system_default=False, maka kursus menggunakan template kustom ini.
    Jika tidak, kursus otomatis fallback ke template default sistem LMSetjen DPD RI.
    """
    course = models.OneToOneField(
        'Course',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='certificate_template',
        help_text="Jika diisi, template ini khusus untuk kursus bersangkutan. Jika null, template ini adalah default global sistem."
    )
    use_system_default = models.BooleanField(
        default=True,
        help_text="Jika True pada level kursus, kursus menggunakan default sistem LMSetjen DPD RI."
    )
    template_name = models.CharField(max_length=150, default="Template Resmi Setjen DPD RI")
    is_active = models.BooleanField(default=True)
    pptx_template = models.FileField(upload_to='certificates/templates/pptx/', null=True, blank=True)
    custom_background = models.FileField(upload_to='certificates/templates/backgrounds/', null=True, blank=True)
    
    # Styling Palettes & Fonts
    primary_color = models.CharField(max_length=25, default="#0d5c3a")
    accent_color = models.CharField(max_length=25, default="#c59b27")
    title_font = models.CharField(max_length=100, default="'Cinzel', serif")
    body_font = models.CharField(max_length=100, default="'Montserrat', sans-serif")
    
    # Lembaga & Kop
    agency_sup = models.CharField(max_length=255, default="SEKRETARIAT JENDERAL")
    agency_main = models.CharField(max_length=255, default="DEWAN PERWAKILAN DAERAH REPUBLIK INDONESIA")
    agency_sub = models.CharField(max_length=255, default="BIRO ORGANISASI KEANGGOTAAN DAN KEPEGAWAIAN")
    
    # Judul Sertifikat & Pernyataan
    certificate_title = models.CharField(max_length=150, default="SERTIFIKAT KELULUSAN")
    certificate_subtitle = models.CharField(max_length=255, default="Certificate of Completion")
    statement_text = models.TextField(
        default="Telah berhasil dan berintegritas menyelesaikan seluruh materi pembelajaran mandiri, penugasan studi kasus, serta memenuhi standar evaluasi kelulusan pada program:"
    )
    
    # Pengesahan Penandatangan Resmi (Biro OKK)
    signatory_title = models.CharField(max_length=255, default="Kepala Biro Organisasi Keanggotaan dan Kepegawaian")
    signatory_sub_title = models.CharField(max_length=255, default="Sekretariat Jenderal DPD RI")
    signatory_name = models.CharField(max_length=255, default="Dr. Fitriani, A.P., M.Si.")
    signatory_nip = models.CharField(max_length=100, default="19741017 199311 2 001")
    
    # Kustomisasi Instruktur (Opsional pada level kursus)
    instructor_signature_image = models.FileField(upload_to='certificates/templates/signatures/', null=True, blank=True, help_text="Tanda tangan digital instruktur pengampu")
    instructor_title = models.CharField(max_length=255, default="Instruktur Pengampu Kursus", null=True, blank=True, help_text="Gelar / Peran instruktur pada sertifikat")
    show_instructor_signature = models.BooleanField(default=False, help_text="Tampilkan tanda tangan instruktur pengampu bersanding dengan pejabat pengesah")

    # Elemen Visual Toggles
    show_gold_seal = models.BooleanField(default=True)
    show_watermark = models.BooleanField(default=True)
    show_bpsdm_logo = models.BooleanField(default=True)
    show_qr_code = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        verbose_name = "Certificate Template Config"
        verbose_name_plural = "Certificate Template Configs"

    def __str__(self):
        prefix = f"[{self.course.title[:30]}] " if self.course else "[SISTEM DEFAULT] "
        status_str = "Default Sistem" if (self.course and self.use_system_default) else ("Aktif" if self.is_active else "Non-aktif")
        return f"{prefix}{self.template_name} ({status_str})"

    @classmethod
    def get_active_config(cls):
        """Ambil template default global sistem LMSetjen DPD RI."""
        config = cls.objects.filter(course__isnull=True, is_active=True).first()
        if not config:
            config = cls.objects.create(
                template_name="Template Resmi Setjen DPD RI",
                is_active=True,
                signatory_title="Kepala Biro Organisasi Keanggotaan dan Kepegawaian",
                signatory_sub_title="Sekretariat Jenderal DPD RI",
                signatory_name="Dr. Fitriani, A.P., M.Si.",
                signatory_nip="19741017 199311 2 001",
                agency_sub="BIRO ORGANISASI KEANGGOTAAN DAN KEPEGAWAIAN",
                statement_text="Telah berhasil dan berintegritas menyelesaikan seluruh materi pembelajaran mandiri, penugasan studi kasus, serta memenuhi standar evaluasi kelulusan pada program:"
            )
        return config

    @classmethod
    def get_template_for_course(cls, course_or_id):
        """
        Resolusi cerdas berjenjang:
        1. Cek apakah kursus memiliki kustomisasi template spesifik dengan use_system_default=False dan is_active=True.
        2. Jika ada, gunakan template khusus kursus tersebut.
        3. Jika tidak ada / use_system_default=True, fallback otomatis ke template default sistem LMSetjen DPD RI.
        """
        if not course_or_id:
            return cls.get_active_config()
            
        course = None
        if isinstance(course_or_id, Course):
            course = course_or_id
        else:
            try:
                course = Course.objects.filter(course_id=str(course_or_id)).first() or Course.objects.filter(id=course_or_id).first()
            except Exception:
                pass
                
        if course:
            try:
                template = getattr(course, 'certificate_template', None)
                if template and not template.use_system_default and template.is_active:
                    return template
            except Exception:
                pass
                
        return cls.get_active_config()

    
class CompletedLesson(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    variant_item = models.ForeignKey(VariantItem, on_delete=models.CASCADE)
    date = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('user', 'course', 'variant_item')

    def __str__(self):
        return self.course.title

class VideoProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    variant_item = models.ForeignKey(VariantItem, on_delete=models.CASCADE)
    progress_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)  # 0.00 to 100.00
    last_watched_position = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)  # Time in seconds
    total_duration = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)  # Total video duration in seconds
    is_fully_watched = models.BooleanField(default=False)  # ✨ PHASE 11.178: Track when student watched 100% of video
    fully_watched_at = models.DateTimeField(null=True, blank=True)  # ✨ PHASE 11.178: Timestamp when video was fully watched
    last_updated = models.DateTimeField(auto_now=True)
    date_created = models.DateTimeField(default=timezone.now)
    
    class Meta:
        unique_together = ['user', 'course', 'variant_item']
        ordering = ['-last_updated']
    
    def __str__(self):
        return f"{self.user.username} - {self.variant_item.title} ({self.progress_percentage}%)"
    
    @property
    def is_completed(self):
        try:
            return float(self.progress_percentage) >= 95.0
        except (TypeError, ValueError):
            return False
    
    @property
    def is_in_progress(self):
        try:
            progress = float(self.progress_percentage)
            return progress > 0 and progress < 95.0
        except (TypeError, ValueError):
            return False
    
    @property
    def formatted_position(self):
        """Convert seconds to MM:SS format"""
        minutes = int(self.last_watched_position) // 60
        seconds = int(self.last_watched_position) % 60
        return f"{minutes:02d}:{seconds:02d}"
    
    @property
    def formatted_duration(self):
        """Convert total duration to MM:SS format"""
        minutes = int(self.total_duration) // 60
        seconds = int(self.total_duration) % 60
        return f"{minutes:02d}:{seconds:02d}"


class LearningModule(models.Model):
    MODULE_TYPE_CHOICES = (
        ('scorm_12', 'SCORM 1.2'),
        ('h5p', 'H5P Interactive Content'),
    )

    judul = models.CharField(max_length=255, verbose_name="Judul Modul")
    deskripsi = models.TextField(blank=True, null=True, verbose_name="Deskripsi Modul")
    module_type = models.CharField(
        max_length=20,
        choices=MODULE_TYPE_CHOICES,
        default='scorm_12',
        verbose_name="Tipe Modul"
    )
    file_zip = models.FileField(
        upload_to=scorm_upload_path,
        max_length=500,
        validators=[validate_scorm_or_h5p_extension],
        verbose_name="File Paket Modul (ZIP / H5P)",
        help_text="Unggah file .zip (SCORM 1.2) atau .h5p maksimal 500MB."
    )
    extracted_path = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name="Direktori Ekstraksi"
    )
    entry_file = models.CharField(
        max_length=255,
        default='index.html',
        verbose_name="Entry File Player"
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='learning_modules',
        verbose_name="Kursus Terkait"
    )
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_learning_modules',
        verbose_name="Pembuat Modul"
    )
    tanggal_dibuat = models.DateTimeField(auto_now_add=True, verbose_name="Tanggal Dibuat")
    tanggal_diperbarui = models.DateTimeField(auto_now=True, verbose_name="Terakhir Diperbarui")

    class Meta:
        db_table = 'learning_modules'
        verbose_name = 'Learning Module'
        verbose_name_plural = 'Learning Modules'
        ordering = ['-tanggal_dibuat']

    def __str__(self):
        return f"{self.judul} ({self.get_module_type_display()})"

    def extract_package(self):
        """
        Mengekstrak paket ZIP/H5P ke direktori media yang terisolasi dengan
        proteksi penuh terhadap kerentanan Zip-Slip (Path Traversal).
        Mendukung:
        1. Standar SCORM 1.2 / 2004 dengan membaca resource launch dari imsmanifest.xml
        2. Paket SCORM di dalam subfolder atau arsip bundle berisi nested zip
        3. Paket H5P dengan h5p.json
        4. Fallback deteksi launcher HTML standar dan fallback index generator (Zero 404)
        """
        if not self.file_zip:
            return

        file_path = getattr(self.file_zip, 'path', None)
        if not file_path or not os.path.exists(file_path):
            return

        extract_dir_name = f'extracted_{self.pk}'
        extract_full_path = os.path.join(settings.MEDIA_ROOT, 'learning_modules', extract_dir_name)
        os.makedirs(extract_full_path, exist_ok=True)

        def safe_extract_zip(source_zip_path, target_dir):
            with zipfile.ZipFile(source_zip_path, 'r') as zip_ref:
                for member in zip_ref.namelist():
                    member_path = os.path.abspath(os.path.join(target_dir, member))
                    if not member_path.startswith(os.path.abspath(target_dir)):
                        raise ValidationError(f"File zip berbahaya terdeteksi (Zip Slip attack): {member}")
                zip_ref.extractall(target_dir)

        # 1. Ekstrak file zip utama
        safe_extract_zip(file_path, extract_full_path)

        # 2. Cek apakah ini bundle arsip yang berisi nested zip (misal xtoscorm sample packages / zip dalam zip)
        has_root_manifest = any(
            'imsmanifest.xml' in files or 'h5p.json' in files or 'index.html' in files
            for _, _, files in os.walk(extract_full_path)
        )
        if not has_root_manifest:
            nested_zips = [f for f in os.listdir(extract_full_path) if f.lower().endswith('.zip')]
            if nested_zips:
                # Prioritaskan zip bertipe SCORM 1.2 jika tipe modul scorm_12
                chosen_zip = None
                for nz in nested_zips:
                    nl = nz.lower()
                    if 'scorm12' in nl or 'scorm1.2' in nl or 'scorm_12' in nl:
                        chosen_zip = nz
                        break
                if not chosen_zip:
                    # Cari zip yang mengandung imsmanifest.xml
                    for nz in nested_zips:
                        try:
                            with zipfile.ZipFile(os.path.join(extract_full_path, nz)) as test_z:
                                if 'imsmanifest.xml' in test_z.namelist():
                                    chosen_zip = nz
                                    break
                        except Exception:
                            continue
                if not chosen_zip:
                    chosen_zip = nested_zips[0]

                nested_zip_path = os.path.join(extract_full_path, chosen_zip)
                try:
                    safe_extract_zip(nested_zip_path, extract_full_path)
                except Exception as e:
                    print(f"[LearningModule] Warning extracting nested zip {chosen_zip}: {e}")

        self.extracted_path = os.path.join('learning_modules', extract_dir_name).replace('\\', '/')

        found_entry = None

        # 3. Prioritas 1: Parse imsmanifest.xml jika ada
        manifest_paths = []
        for root, _, files in os.walk(extract_full_path):
            if 'imsmanifest.xml' in files:
                manifest_paths.append(os.path.join(root, 'imsmanifest.xml'))

        if manifest_paths:
            manifest_paths.sort(key=lambda p: len(p.split(os.sep)))
            for mp in manifest_paths:
                try:
                    import xml.etree.ElementTree as ET
                    tree = ET.parse(mp)
                    root_elem = tree.getroot()
                    clean = lambda t: t.split('}')[-1] if '}' in t else t
                    
                    manifest_dir = os.path.dirname(mp)
                    default_org = None
                    for elem in root_elem.iter():
                        if clean(elem.tag) == 'organizations':
                            default_org = elem.attrib.get('default')
                            break

                    target_res_id = None
                    for elem in root_elem.iter():
                        if clean(elem.tag) == 'organization':
                            if not default_org or elem.attrib.get('identifier') == default_org:
                                for item in elem.iter():
                                    if clean(item.tag) == 'item' and item.attrib.get('identifierref'):
                                        target_res_id = item.attrib.get('identifierref')
                                        break
                                if target_res_id:
                                    break

                    candidate_href = None
                    if target_res_id:
                        for elem in root_elem.iter():
                            if clean(elem.tag) == 'resource' and elem.attrib.get('identifier') == target_res_id:
                                candidate_href = elem.attrib.get('href')
                                break

                    if not candidate_href:
                        for elem in root_elem.iter():
                            if clean(elem.tag) == 'resource' and 'href' in elem.attrib:
                                href = elem.attrib.get('href', '').strip()
                                if href:
                                    candidate_href = href
                                    break

                    if candidate_href:
                        candidate_clean = candidate_href.split('?')[0].split('#')[0].strip()
                        abs_candidate = os.path.normpath(os.path.join(manifest_dir, candidate_clean))
                        if os.path.exists(abs_candidate):
                            rel_entry = os.path.relpath(abs_candidate, extract_full_path)
                            found_entry = rel_entry.replace('\\', '/')
                            break
                except Exception as e:
                    print(f"[LearningModule] Manifest parse error in {mp}: {e}")

        # 4. Prioritas 2: H5P
        if not found_entry:
            if self.module_type == 'h5p' and os.path.exists(os.path.join(extract_full_path, 'h5p.json')):
                found_entry = 'h5p.json'

        # 5. Prioritas 3: Standar HTML Entrypoint
        if not found_entry:
            common_entry_files = [
                'index.html', 'index.htm', 'story.html', 'index_lms.html',
                'player.html', 'launcher.html', 'default.htm', 'default.html'
            ]
            for root, _, files in os.walk(extract_full_path):
                file_lower_map = {f.lower(): f for f in files}
                for ce in common_entry_files:
                    if ce in file_lower_map:
                        actual_file = file_lower_map[ce]
                        rel_path = os.path.relpath(os.path.join(root, actual_file), extract_full_path)
                        found_entry = rel_path.replace('\\', '/')
                        break
                if found_entry:
                    break

        # 6. Prioritas 4: Fallback HTML Launcher jika tidak ada file index standar
        if not found_entry:
            fallback_index_path = os.path.join(extract_full_path, 'index.html')
            if not os.path.exists(fallback_index_path):
                html_candidates = []
                for root, _, files in os.walk(extract_full_path):
                    for f in files:
                        if f.lower().endswith(('.html', '.htm')):
                            rel = os.path.relpath(os.path.join(root, f), extract_full_path).replace('\\', '/')
                            html_candidates.append(rel)
                
                links_html = "".join([
                    f'<li class="mb-2"><a href="{h}" class="btn btn-outline-primary btn-sm px-3"><i class="fas fa-play-circle me-1"></i> Buka {h}</a></li>'
                    for h in html_candidates[:10]
                ]) or '<p class="text-muted">Modul berhasil diekstrak dan siap digunakan.</p>'

                fallback_content = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>{self.judul}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body {{ background: #f8fafc; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }}
    .card {{ border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); max-width: 600px; width: 100%; border: none; }}
  </style>
</head>
<body>
  <div class="card p-4 text-center">
    <div class="mb-3 text-teal"><i class="fas fa-box-open fa-3x" style="color:#0f766e;"></i></div>
    <h4 class="fw-bold mb-2">{self.judul}</h4>
    <p class="text-secondary small mb-4">Paket modul e-learning telah berhasil diekstrak.</p>
    <div class="text-start">
      <h6 class="fw-semibold mb-2">Pilih unit / materi untuk mulai:</h6>
      <ul class="list-unstyled">
        {links_html}
      </ul>
    </div>
  </div>
</body>
</html>"""
                try:
                    with open(fallback_index_path, 'w', encoding='utf-8') as f:
                        f.write(fallback_content)
                    found_entry = 'index.html'
                except Exception as e:
                    print(f"[LearningModule] Fallback index write error: {e}")

        if found_entry:
            self.entry_file = found_entry
            root_index_path = os.path.join(extract_full_path, 'index.html')
            if found_entry != 'index.html' and not os.path.exists(root_index_path):
                try:
                    with open(root_index_path, 'w', encoding='utf-8') as f:
                        f.write(f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url={found_entry}">
  <title>Mengarahkan...</title>
  <script>window.location.replace("{found_entry}");</script>
</head>
<body>
  <p>Mengarahkan ke modul: <a href="{found_entry}">{found_entry}</a></p>
</body>
</html>""")
                except Exception as e:
                    print(f"[LearningModule] Root redirect index creation error: {e}")

        LearningModule.objects.filter(pk=self.pk).update(
            extracted_path=self.extracted_path,
            entry_file=self.entry_file
        )

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new or not self.extracted_path:
            try:
                self.extract_package()
            except Exception as e:
                print(f"[LearningModule] Error extracting package: {e}")

    @property
    def player_url(self):
        if self.extracted_path and self.entry_file:
            media_url = getattr(settings, 'MEDIA_URL', '/media/')
            return f"{media_url.rstrip('/')}/{self.extracted_path.strip('/')}/{self.entry_file.lstrip('/')}"
        return None


class UserProgress(models.Model):
    LESSON_STATUS_CHOICES = (
        ('passed', 'Passed'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('incomplete', 'Incomplete'),
        ('browsed', 'Browsed'),
        ('not attempted', 'Not Attempted'),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='scorm_progress_set',
        verbose_name="ASN / Pegawai"
    )
    learning_module = models.ForeignKey(
        LearningModule,
        on_delete=models.CASCADE,
        related_name='user_progress_set',
        verbose_name="Modul E-Learning"
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='scorm_user_progress',
        verbose_name="Kursus Terkait"
    )
    variant_item = models.ForeignKey(
        VariantItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scorm_user_progress',
        verbose_name="Pelajaran Terkait"
    )
    lesson_status = models.CharField(
        max_length=20,
        choices=LESSON_STATUS_CHOICES,
        default='not attempted',
        db_index=True,
        verbose_name="Status Modul (cmi.core.lesson_status)"
    )
    score_raw = models.FloatField(
        default=0.0,
        verbose_name="Nilai Raw (cmi.core.score.raw)"
    )
    lesson_location = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Titik Resume (cmi.core.lesson_location)"
    )
    session_time = models.CharField(
        max_length=50,
        default='00:00:00',
        verbose_name="Durasi Sesi Terakhir (cmi.core.session_time)"
    )
    suspend_data = models.TextField(
        blank=True,
        null=True,
        verbose_name="Suspend Data (cmi.suspend_data)"
    )
    last_accessed = models.DateTimeField(auto_now=True, verbose_name="Akses Terakhir")
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Waktu Selesai")
    last_reset_date = models.DateField(blank=True, null=True, verbose_name="Tanggal Reset Terakhir")
    reset_count_today = models.IntegerField(default=0, verbose_name="Jumlah Reset Hari Ini")

    class Meta:
        db_table = 'scorm_user_progress'
        verbose_name = 'Progress E-Learning ASN'
        verbose_name_plural = 'Progress E-Learning ASN'
        unique_together = ('user', 'learning_module')
        indexes = [
            models.Index(fields=['user', 'learning_module'], name='idx_scorm_user_mod'),
            models.Index(fields=['lesson_status'], name='idx_scorm_status'),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.learning_module.judul} [{self.lesson_status}]"


class EnrolledCourse(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True)
    # Removed order_item reference to CartOrderItem
    enrollment_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    date = models.DateTimeField(default=timezone.now)
    INTEGRITY_CHOICES = (
        ('verified', 'Terverifikasi Valid'),
        ('pending_review', 'Menunggu Verifikasi Instruktur'),
        ('rejected', 'Ditolak / Terindikasi Curang'),
    )
    integrity_status = models.CharField(max_length=30, choices=INTEGRITY_CHOICES, default='verified')
    manual_integrity_approved = models.BooleanField(default=False, help_text="Verifikasi manual oleh instruktur untuk mengizinkan penerbitan sertifikat")
    integrity_notes = models.TextField(blank=True, null=True, help_text="Catatan atau alasan anomali integritas")

    def __str__(self):
        return self.course.title
    
    def lectures(self):
        return VariantItem.objects.filter(variant__course=self.course, item_type='lesson')
    
    def completed_lesson(self):
        return CompletedLesson.objects.filter(course=self.course, user=self.user)
    
    def curriculum(self):
        return Variant.objects.filter(course=self.course)
    
    def note(self):
        return Note.objects.filter(course=self.course, user=self.user)
    
    def question_answer(self):
        return Question_Answer.objects.filter(course=self.course)
    
    def review(self):
        return Review.objects.filter(course=self.course, user=self.user).first()
    
    def completion_percentage(self):
        """Calculate comprehensive completion percentage including lessons, regular quizzes, pre-post test, and games"""
        return self.completion_metrics()['progress']

    def completion_metrics(self):
        """Detailed breakdown of completion items for frontend synchronization"""
        total_lessons = self.lectures().count()
        completed_lessons = self.completed_lesson().values('variant_item').distinct().count()
        
        # 1. Kuis Reguler Kursus
        quizzes = Quiz.objects.filter(course=self.course, is_active=True)
        regular_quizzes = quizzes.filter(quiz_type='quiz')
        total_reg_quizzes = regular_quizzes.count()
        passed_reg_quizzes = sum(
            1 for q in regular_quizzes 
            if QuizAttempt.objects.filter(user=self.user, quiz=q, is_passed=True).exists()
        )
                
        # 2. Pre-Test & Post-Test (jika ada kuis pre_post_test pada kursus)
        pre_post_quiz = quizzes.filter(quiz_type='pre_post_test').first()
        pre_test_total = 1 if pre_post_quiz else 0
        pre_test_completed = 1 if (pre_post_quiz and self.has_completed_pre_test()) else 0
        
        post_test_total = 1 if pre_post_quiz else 0
        post_test_completed = 1 if (pre_post_quiz and self.has_completed_post_test()) else 0
        
        # 3. Gamifikasi (mini-games aktif pada kursus)
        active_games = self.course.games.filter(is_active=True)
        total_games = active_games.count()
        completed_games = sum(
            1 for g in active_games 
            if g.attempts.filter(user=self.user).exists()
        )
                
        # Total bobot seluruh aktivitas pembelajaran
        total_items = total_lessons + total_reg_quizzes + pre_test_total + post_test_total + total_games
        completed_items = completed_lessons + passed_reg_quizzes + pre_test_completed + post_test_completed + completed_games
        
        # Guarantee completed_items never exceeds total_items
        if total_items > 0:
            completed_items = min(total_items, completed_items)
            progress = min(100, round((completed_items / total_items) * 100))
        else:
            progress = 100
        
        return {
            'progress': progress,
            'total_items': total_items,
            'completed_items': completed_items,
            'total_lessons': total_lessons,
            'completed_lessons': completed_lessons,
            'total_quizzes': total_reg_quizzes,
            'passed_quizzes': passed_reg_quizzes,
            'has_pre_post': bool(pre_post_quiz),
            'pre_test_completed': bool(pre_test_completed),
            'post_test_completed': bool(post_test_completed),
            'total_games': total_games,
            'completed_games': completed_games,
        }
    
    def is_course_completed(self):
        """Check if all lessons are completed"""
        return self.completion_percentage() == 100
    
    def quiz_results(self):
        """Get all quiz results for this course"""
        quizzes = Quiz.objects.filter(course=self.course)
        results = []
        
        for quiz in quizzes:
            # Get the best attempt for each quiz
            best_attempt = QuizAttempt.objects.filter(
                user=self.user, 
                quiz=quiz
            ).order_by('-score').first()
            
            if best_attempt:
                results.append({
                    'quiz_id': quiz.id,
                    'title': quiz.title,
                    'score': best_attempt.score,
                    'total_questions': quiz.questions.count(),
                    'percentage': best_attempt.score,
                    'passed': best_attempt.is_passed,
                    'date_attempted': best_attempt.date_attempted
                })
            else:
                results.append({
                    'quiz_id': quiz.id,
                    'title': quiz.title,
                    'score': 0,
                    'total_questions': quiz.questions.count(),
                    'percentage': 0,
                    'passed': False,
                    'date_attempted': None
                })
        
        return results
    
    def are_all_lessons_completed(self):
        """Check if all curriculum lessons are completed by the student"""
        total = self.lectures().count()
        if total == 0:
            return True
        completed = self.completed_lesson().values('variant_item').distinct().count()
        return completed >= total

    def are_all_quizzes_passed(self):
        """Check if all regular quizzes are passed with 70% or higher"""
        quizzes = Quiz.objects.filter(course=self.course, quiz_type='quiz', is_active=True)
        if not quizzes.exists():
            return True
        for quiz in quizzes:
            best_attempt = QuizAttempt.objects.filter(user=self.user, quiz=quiz).order_by('-score').first()
            if not best_attempt or not best_attempt.is_passed or best_attempt.score < 70:
                return False
        return True

    def has_completed_pre_test(self):
        """Check if pre-test has been completed (if course has pre_post_test)"""
        pre_post_quiz = Quiz.objects.filter(course=self.course, quiz_type='pre_post_test', is_active=True).first()
        if not pre_post_quiz:
            return True
        return QuizAttempt.objects.filter(user=self.user, quiz=pre_post_quiz, attempt_type='pre_test').exists()

    def has_completed_post_test(self):
        """Check if post-test has been completed (if course has pre_post_test)"""
        pre_post_quiz = Quiz.objects.filter(course=self.course, quiz_type='pre_post_test', is_active=True).first()
        if not pre_post_quiz:
            return True
        return QuizAttempt.objects.filter(user=self.user, quiz=pre_post_quiz, attempt_type='post_test').exists()

    def are_all_games_completed(self):
        """Check if all active course games have been completed (attempted) by the student"""
        related_ids = self.course.get_related_course_ids() if hasattr(self.course, 'get_related_course_ids') else {self.course.id}
        active_games = CourseGame.objects.filter(course_id__in=related_ids, is_active=True)
        if not active_games.exists():
            return True
        seen_keys = set()
        for game in active_games:
            key = f"{game.game_type}:{game.title}"
            if key not in seen_keys:
                seen_keys.add(key)
                has_attempt = CourseGameAttempt.objects.filter(
                    user=self.user,
                    game__course_id__in=related_ids,
                    game__game_type=game.game_type,
                    game__title=game.title
                ).exists()
                if not has_attempt:
                    return False
        return True

    def check_integrity_status(self):
        """
        Evaluasi integritas pengerjaan kuis/ujian dan durasi ketuntasan kursus.
        Returns dict:
        {
            'is_valid': bool,
            'status': 'verified' | 'pending_review' | 'rejected',
            'is_manual_approved': bool,
            'reasons': list of str,
            'duration_seconds': int | None,
            'post_test_duration_seconds': int | None
        }
        """
        if self.integrity_status == 'rejected':
            return {
                'is_valid': False,
                'status': 'rejected',
                'is_manual_approved': False,
                'reasons': [self.integrity_notes or "Ujian ditandai tidak sah oleh instruktur karena indikasi kecurangan."],
                'duration_seconds': None,
                'post_test_duration_seconds': None
            }

        if self.manual_integrity_approved:
            return {
                'is_valid': True,
                'status': 'verified',
                'is_manual_approved': True,
                'reasons': ["Telah diverifikasi dan disahkan secara manual oleh Instruktur."],
                'duration_seconds': None,
                'post_test_duration_seconds': None
            }

        reasons = []
        is_suspicious = False

        # 1. Cek Post-Test attempt
        pre_post_quiz = Quiz.objects.filter(course=self.course, quiz_type='pre_post_test', is_active=True).first()
        post_att = None
        pre_att = None
        if pre_post_quiz:
            attempts = QuizAttempt.objects.filter(user=self.user, quiz=pre_post_quiz).order_by('date_attempted')
            pre_att = attempts.filter(attempt_type='pre_test').first() or attempts.first()
            post_att = attempts.filter(attempt_type='post_test').first()
            if not post_att and attempts.count() >= 2:
                post_att = attempts.last()

        post_test_sec = None
        if post_att and post_att != pre_att:
            if post_att.time_taken:
                post_test_sec = int(post_att.time_taken.total_seconds())
                min_realistic_post_time = max(15, post_att.total_questions * 3)
                if post_test_sec < min_realistic_post_time and post_att.total_questions > 0:
                    is_suspicious = True
                    reasons.append(f"Kecepatan pengerjaan Post-Test tidak wajar ({post_test_sec} detik untuk {post_att.total_questions} butir soal).")

        # 2. Cek Total Ketuntasan Kursus (Completion Pace)
        start_time = pre_att.date_attempted if pre_att else self.date
        finish_time = post_att.date_attempted if (post_att and post_att.is_passed) else None
        delta_sec = None
        if start_time and finish_time:
            raw_diff = (finish_time - start_time).total_seconds()
            delta_sec = max(0, int(abs(raw_diff)))
            # Ambang batas wajar ketuntasan materi + ujian minimal 3 menit (180 detik)
            if delta_sec < 180 and self.course.lectures().count() > 0:
                is_suspicious = True
                reasons.append(f"Ketuntasan seluruh materi & ujian selesai dalam waktu {delta_sec} detik (< 3 menit).")

        if is_suspicious:
            return {
                'is_valid': False,
                'status': 'pending_review',
                'is_manual_approved': False,
                'reasons': reasons,
                'duration_seconds': delta_sec,
                'post_test_duration_seconds': post_test_sec
            }

        return {
            'is_valid': True,
            'status': 'verified',
            'is_manual_approved': False,
            'reasons': ["Hasil ujian dan ketuntasan materi terverifikasi sah dan berintegritas."],
            'duration_seconds': delta_sec,
            'post_test_duration_seconds': post_test_sec
        }

    def is_certificate_eligible(self):
        """Check if user is eligible for certificate (lessons complete + regular quizzes passed + post-test complete + integrity check passed)"""
        base_eligible = self.is_course_completed() and self.are_all_quizzes_passed() and self.has_completed_post_test()
        if not base_eligible:
            return False
        integrity = self.check_integrity_status()
        return integrity['is_valid']
    
    def get_or_create_certificate(self):
        """Get existing certificate or create new one if eligible and integrity check passed"""
        integrity = self.check_integrity_status()
        if not self.is_certificate_eligible():
            return None, False
        
        certificate, created = Certificate.objects.get_or_create(
            course=self.course,
            user=self.user,
            enrollment=self,
            defaults={
                'is_valid': True,
                'integrity_status': 'verified' if integrity['is_valid'] else 'pending_review'
            }
        )
        if not created and certificate:
            if not integrity['is_valid'] and not self.manual_integrity_approved:
                if certificate.is_valid:
                    certificate.is_valid = False
                    certificate.integrity_status = 'pending_review'
                    certificate.save(update_fields=['is_valid', 'integrity_status'])
            elif self.manual_integrity_approved and not certificate.is_valid:
                certificate.is_valid = True
                certificate.integrity_status = 'verified'
                certificate.save(update_fields=['is_valid', 'integrity_status'])

        return certificate, created
    
class Note(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=1000, null=True, blank=True)
    note = models.TextField()
    color = models.CharField(max_length=10, default="#f39c12", help_text="Hex color code for the note")
    note_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    # ✨ PHASE 11.160: Optional lesson/section context for notes
    variant = models.ForeignKey('Variant', on_delete=models.SET_NULL, null=True, blank=True, help_text="Course section (bagian) this note relates to")
    variant_item = models.ForeignKey('VariantItem', on_delete=models.SET_NULL, null=True, blank=True, help_text="Lesson (pelajaran) this note relates to")
    is_pinned = models.BooleanField(default=False, help_text="Pin note to top of list")
    date = models.DateTimeField(default=timezone.now)   

    def __str__(self):
        return self.title or f"Note #{self.id}"
    
class Review(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, null=True, blank=True)  # ✨ PHASE 4.10: Allow general testimonials without course
    # ✨ PHASE 4.11: Role field for multi-role testimonials (student/instructor)
    role = models.CharField(
        max_length=20,
        choices=TESTIMONIAL_ROLES,
        default="student",
        help_text="Role the user is testifying as (student or instructor)"
    )
    review = models.TextField(blank=True, null=True)
    rating = models.IntegerField(choices=RATING, default=1)
    reply = models.CharField(null=True, blank=True, max_length=1000)
    active = models.BooleanField(default=False)
    date = models.DateTimeField(default=timezone.now)   

    def __str__(self):
        return self.course.title if self.course else f"General Testimonial ({self.role})"
    
    def profile(self):
        return Profile.objects.get(user=self.user)
    
class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    review = models.ForeignKey(Review, on_delete=models.SET_NULL, null=True, blank=True)
    type = models.CharField(max_length=100, choices=NOTI_TYPE)
    title = models.CharField(max_length=1000, null=True, blank=True)  # Phase 4.36 - notification title
    message = models.TextField(null=True, blank=True)  # Phase 4.36 - notification message/description
    seen = models.BooleanField(default=False)
    date = models.DateTimeField(default=timezone.now)  

    def __str__(self):
        return self.type

class Wishlist(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    
    class Meta:
        verbose_name = "Kursus yang Ingin Dipelajari"
        verbose_name_plural = "Kursus yang Ingin Dipelajari"

    def __str__(self):
        return str(self.course.title)

# ✨ PHASE 4.210: Review Abuse Report System
ABUSE_REASON_CHOICES = [
    ('inappropriate_content', 'Konten Tidak Pantas'),
    ('spam', 'Spam'),
    ('offensive_language', 'Bahasa Kasar/Menyinggung'),
    ('false_information', 'Informasi Palsu'),
    ('harassment', 'Pelecehan'),
    ('other', 'Lainnya'),
]

class ReviewAbuse(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name='abuse_reports')
    reported_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)  # Teacher who reported
    reason = models.CharField(max_length=50, choices=ABUSE_REASON_CHOICES)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Review'),
            ('reviewed', 'Reviewed'),
            ('dismissed', 'Dismissed'),
            ('action_taken', 'Action Taken'),
        ],
        default='pending'
    )
    reported_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='abuse_reviews')  # Admin who reviewed
    review_notes = models.TextField(blank=True, null=True)
    closed_by_reporter = models.BooleanField(default=False)  # ✨ PHASE 4.210: Whether reporter marked it as resolved
    closed_by_reporter_at = models.DateTimeField(null=True, blank=True)  # ✨ PHASE 4.210: When reporter closed it

    class Meta:
        unique_together = ('review', 'reported_by')  # Prevent duplicate reports from same user

    def __str__(self):
        return f"Abuse Report for Review {self.review.id} - {self.status}"

    
class Country(models.Model):
    name = models.CharField(max_length=100)
    tax_rate = models.IntegerField(default=5)
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class Quiz(models.Model):
    QUIZ_TYPE_CHOICES = (
        ('quiz', 'Kuis'),
        ('pre_post_test', 'Pre & Post-test'),
    )
    PRESENTATION_MODE_CHOICES = (
        ('ordered', 'Sesuai Urutan'),
        ('random', 'Acak'),
    )

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="quizzes")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    quiz_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    quiz_type = models.CharField(max_length=30, choices=QUIZ_TYPE_CHOICES, default='quiz')
    presentation_mode = models.CharField(max_length=30, choices=PRESENTATION_MODE_CHOICES, default='ordered')
    is_active = models.BooleanField(default=True)
    date = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "Quiz"
        verbose_name_plural = "Quizzes"
        ordering = ['-date']

    def __str__(self):
        return f"{self.course.title} - {self.title}"

    def total_questions(self):
        return self.questions.count()

class QuizQuestion(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    question_text = models.CharField(max_length=1000)
    question_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    order = models.PositiveIntegerField(default=1)
    date = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['order', 'date']

    def __str__(self):
        return f"Q{self.order}: {self.question_text[:50]}..."

    def correct_answer(self):
        return self.choices.filter(is_correct=True).first()

class QuizChoice(models.Model):
    question = models.ForeignKey(QuizQuestion, on_delete=models.CASCADE, related_name="choices")
    choice_text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)
    choice_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order']

    def __str__(self):
        status = "[OK]" if self.is_correct else "✗"
        return f"{status} {self.choice_text}"

    def save(self, *args, **kwargs):
        # Ensure only one correct answer per question
        if self.is_correct:
            QuizChoice.objects.filter(question=self.question, is_correct=True).update(is_correct=False)
        super().save(*args, **kwargs)


class QuizAttempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="attempts")
    score = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)  # Score out of 100
    total_questions = models.PositiveIntegerField()
    correct_answers = models.PositiveIntegerField(default=0)
    is_passed = models.BooleanField(default=False)  # True if score >= 80
    time_taken = models.DurationField(null=True, blank=True)  # Time taken to complete
    attempt_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    date_attempted = models.DateTimeField(default=timezone.now)
    _points_awarded = models.BooleanField(default=False, db_index=True, editable=False, help_text="Points awarded for this attempt")  # ✨ PHASE 11.169: Add missing field from migration
    ATTEMPT_TYPE_CHOICES = (
        ('pre_test', 'Pre-test'),
        ('post_test', 'Post-test'),
        ('quiz', 'Kuis'),
    )
    attempt_type = models.CharField(max_length=20, choices=ATTEMPT_TYPE_CHOICES, default='quiz', blank=True, null=True)

    class Meta:
        ordering = ['-date_attempted']

    def __str__(self):
        return f"{self.user.full_name} - {self.quiz.title} - {self.score}%"

    @property
    def pass_status(self):
        return "PASSED" if self.is_passed else "FAILED"

    def save(self, *args, **kwargs):
        # Calculate if passed (Pre-test has no minimum passing score requirement)
        from decimal import Decimal
        if (self.quiz and getattr(self.quiz, 'quiz_type', '') == 'pre_post_test' and self.attempt_type == 'pre_test') or getattr(self, '_is_pre_test', False):
            self.is_passed = True
        else:
            self.is_passed = Decimal(str(self.score)) >= Decimal('70.00')
        super().save(*args, **kwargs)

    @classmethod
    def get_daily_attempts_count(cls, user, quiz, date=None, attempt_type=None):
        """Get the number of attempts by a user for a specific quiz on a given date"""
        if date is None:
            date = timezone.now().date()
        
        qs = cls.objects.filter(
            user=user,
            quiz=quiz,
            date_attempted__date=date
        )
        if attempt_type:
            qs = qs.filter(attempt_type=attempt_type)
        return qs.count()

    @classmethod
    def can_attempt_quiz(cls, user, quiz, attempt_type=None):
        """
        Check if user can attempt the quiz:
        - For pre_post_test: Pre-test and Post-test are each taken ONLY ONCE.
          They are only locked once submitted (QuizAttempt exists).
          Before submission, user can attempt and retry freely until clicking submit.
        - For regular quiz: max 3 attempts per day.
        """
        if getattr(quiz, 'quiz_type', '') == 'pre_post_test':
            if attempt_type == 'pre_test':
                return not cls.objects.filter(user=user, quiz=quiz, attempt_type='pre_test').exists()
            elif attempt_type == 'post_test':
                return not cls.objects.filter(user=user, quiz=quiz, attempt_type='post_test').exists()
            else:
                has_pre = cls.objects.filter(user=user, quiz=quiz, attempt_type='pre_test').exists()
                has_post = cls.objects.filter(user=user, quiz=quiz, attempt_type='post_test').exists()
                return not (has_pre and has_post)

        today = timezone.now().date()
        attempts_today = cls.get_daily_attempts_count(user, quiz, today, attempt_type='quiz')
        return attempts_today < 3

    @property
    def percentage_display(self):
        return f"{self.score}%"


# ==================== NEW MODELS FOR COURSE DETAIL ENHANCEMENTS ====================

class CourseFeature(models.Model):
    """Features/highlights of a course (e.g., video count, downloads, lifetime access)"""
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='features')
    icon = models.CharField(max_length=100, help_text="FontAwesome icon class (e.g., 'fas fa-video')")
    text = models.CharField(max_length=200, help_text="Feature description")
    order = models.IntegerField(default=0, help_text="Display order")
    highlight = models.BooleanField(default=False, help_text="Highlight this feature")
    
    class Meta:
        ordering = ['order', 'id']
        verbose_name = "Course Feature"
        verbose_name_plural = "Course Features"
    
    def __str__(self):
        return f"{self.course.title} - {self.text}"


class CourseRequirement(models.Model):
    """Prerequisites or requirements for taking a course"""
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='requirements')
    requirement = models.TextField(help_text="Requirement description")
    order = models.IntegerField(default=0, help_text="Display order")
    
    class Meta:
        ordering = ['order', 'id']
        verbose_name = "Course Requirement"
        verbose_name_plural = "Course Requirements"
    
    def __str__(self):
        return f"{self.course.title} - {self.requirement[:50]}"


class CourseLearningOutcome(models.Model):
    """What students will learn/achieve by completing this course"""
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='learning_outcomes')
    outcome = models.TextField(help_text="Learning outcome description")
    order = models.IntegerField(default=0, help_text="Display order")
    
    class Meta:
        ordering = ['order', 'id']
        verbose_name = "Learning Outcome"
        verbose_name_plural = "Learning Outcomes"
    
    def __str__(self):
        return f"{self.course.title} - {self.outcome[:50]}"


class CourseResource(models.Model):
    """Downloadable resources for a course (PDFs, source code, templates, etc.)"""
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='resources')
    name = models.CharField(max_length=200, help_text="Resource name")
    file_type = models.CharField(max_length=50, help_text="File type (e.g., PDF, ZIP)")
    file_size = models.CharField(max_length=50, help_text="File size (e.g., 2.3 MB)")
    file_url = models.URLField(max_length=500, help_text="URL to download the resource")
    order = models.IntegerField(default=0, help_text="Display order")
    
    class Meta:
        ordering = ['order', 'id']
        verbose_name = "Course Resource"
        verbose_name_plural = "Course Resources"
    
    def __str__(self):
        return f"{self.course.title} - {self.name}"


class TeacherExpertise(models.Model):
    """Skills and expertise areas of a teacher"""
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE, related_name='expertise')
    skill = models.CharField(max_length=100, help_text="Skill or expertise area")
    proficiency_level = models.CharField(
        max_length=50,
        choices=[
            ('Beginner', 'Beginner'),
            ('Intermediate', 'Intermediate'),
            ('Advanced', 'Advanced'),
            ('Expert', 'Expert')
        ],
        default='Advanced',
        help_text="Proficiency level"
    )
    color_gradient = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text="CSS gradient for badge (e.g., 'rgba(102, 126, 234, 0.1)')"
    )
    text_color = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Text color for badge (e.g., '#667eea')"
    )
    border_color = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Border color for badge (e.g., 'rgba(102, 126, 234, 0.2)')"
    )
    order = models.IntegerField(default=0, help_text="Display order")
    
    class Meta:
        ordering = ['order', 'id']
        verbose_name = "Teacher Expertise"
        verbose_name_plural = "Teacher Expertise"
    
    def __str__(self):
        return f"{self.teacher.full_name} - {self.skill}"

# ==================== END NEW MODELS ====================


# ==================== SYNC HISTORY MODEL ====================

class SyncHistory(models.Model):
    """
    Track synchronization history of external user data.
    Stores information about when syncs occur and sync statistics.
    """
    sync_type = models.CharField(
        max_length=50,
        default='external_users',
        help_text="Type of sync operation (e.g., external_users, courses, etc.)"
    )
    started_at = models.DateTimeField(auto_now_add=True, help_text="When the sync started")
    completed_at = models.DateTimeField(null=True, blank=True, help_text="When the sync completed")
    status = models.CharField(
        max_length=20,
        choices=[
            ('in_progress', 'In Progress'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
            ('cancelled', 'Cancelled')
        ],
        default='in_progress',
        help_text="Current status of the sync"
    )
    
    # Sync statistics
    total_records = models.IntegerField(default=0, help_text="Total records processed")
    created_records = models.IntegerField(default=0, help_text="New records created")
    updated_records = models.IntegerField(default=0, help_text="Existing records updated")
    failed_records = models.IntegerField(default=0, help_text="Records that failed to sync")
    
    # Additional info
    error_message = models.TextField(blank=True, null=True, help_text="Error message if sync failed")
    notes = models.TextField(blank=True, null=True, help_text="Additional notes about the sync")
    
    class Meta:
        ordering = ['-started_at']
        verbose_name = "Sync History"
        verbose_name_plural = "Sync Histories"
        indexes = [
            models.Index(fields=['-started_at']),
            models.Index(fields=['status', '-started_at']),
        ]
    
    def __str__(self):
        return f"{self.sync_type} - {self.started_at.strftime('%Y-%m-%d %H:%M:%S')} ({self.status})"
    
    @property
    def duration(self):
        """Calculate sync duration if completed"""
        if self.completed_at:
            delta = self.completed_at - self.started_at
            return delta
        return None
    
    @property
    def duration_seconds(self):
        """Get duration in seconds"""
        if self.duration:
            return int(self.duration.total_seconds())
        return None
    
    @property
    def total_changed(self):
        """Total number of records that were created or updated"""
        return self.created_records + self.updated_records
    
    @classmethod
    def get_last_successful_sync(cls, sync_type='external_users'):
        """Get the last successful sync record"""
        return cls.objects.filter(
            sync_type=sync_type,
            status='completed'
        ).first()
    
    @classmethod
    def get_last_sync_time(cls, sync_type='external_users'):
        """Get the last successful sync timestamp"""
        last_sync = cls.get_last_successful_sync(sync_type)
        if last_sync and last_sync.completed_at:
            return last_sync.completed_at
        return None
    
    @classmethod
    def start_sync(cls, sync_type='external_users'):
        """Create a new sync history record"""
        return cls.objects.create(
            sync_type=sync_type,
            status='in_progress'
        )
    
    def complete_sync(self, created=0, updated=0, failed=0, total=0, notes=None):
        """Mark sync as completed with statistics"""
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.created_records = created
        self.updated_records = updated
        self.failed_records = failed
        self.total_records = total
        if notes:
            self.notes = notes
        self.save()
    
    def fail_sync(self, error_message, notes=None):
        """Mark sync as failed"""
        self.status = 'failed'
        self.completed_at = timezone.now()
        self.error_message = error_message
        if notes:
            self.notes = notes
        self.save()
    
    def cancel_sync(self, notes=None):
        """Mark sync as cancelled"""
        self.status = 'cancelled'
        self.completed_at = timezone.now()
        if notes:
            self.notes = notes
        self.save()

# ==================== END SYNC HISTORY MODEL ====================


# Signal handlers for Profile-Teacher synchronization
def sync_teacher_with_profile(sender, instance, **kwargs):
    """
    Synchronize Teacher updates with Profile model when teacher is saved.
    This ensures that teacher data stays in sync with instructor profiles.
    """
    # Prevent infinite loops by checking if this is a sync operation
    if getattr(instance, '_syncing', False):
        return
        
    try:
        # Check if a Profile instance exists for this user
        profile_instance = Profile.objects.filter(user=instance.user).first()
        
        if profile_instance:
            # Set sync flag to prevent recursive updates
            profile_instance._syncing = True
            
            # Update Profile fields with Teacher data (only common fields)
            profile_instance.image = instance.image
            profile_instance.full_name = instance.full_name
            profile_instance.country = instance.country
            profile_instance.about = instance.about
            
            # Save the profile instance
            profile_instance.save()
            
    except Exception as e:
        # Silently fail - teacher save operation should not break
        pass

class SearchAnalytics(models.Model):
    """
    Track search queries to identify trending/popular searches.
    Helps understand what courses/content users are looking for.
    """
    query = models.CharField(max_length=255, unique=True, db_index=True)
    search_count = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-search_count', '-updated_at']
        verbose_name_plural = "Search Analytics"
        indexes = [
            models.Index(fields=['-search_count']),
            models.Index(fields=['-updated_at']),
        ]
    
    def __str__(self):
        return f"{self.query} ({self.search_count} searches)"
    
    @classmethod
    def track_search(cls, query):
        """
        Track a search query. If it already exists, increment the count.
        Otherwise, create a new entry.
        """
        if not query or len(query.strip()) < 2:
            return None
        
        query = query.strip()
        analytics, created = cls.objects.get_or_create(
            query=query,
            defaults={'search_count': 1}
        )
        
        if not created:
            analytics.search_count += 1
            analytics.save(update_fields=['search_count', 'updated_at'])
        
        return analytics
    
    @classmethod
    def get_trending(cls, limit=10):
        """Get the top trending searches."""
        return cls.objects.all()[:limit]


# ✨ PHASE 4: Manager for SearchLog analytics queries
class SearchLogManager(models.Manager):
    """Manager with methods for search analytics aggregations"""
    
    def trending_searches(self, days=7, limit=10):
        """Get top searches by frequency in last N days"""
        from django.utils.timezone import now
        from datetime import timedelta
        from django.db.models import Count, Avg, Q
        
        cutoff_date = now() - timedelta(days=days)
        return self.filter(
            created_at__gte=cutoff_date
        ).values('query').annotate(
            count=Count('id'),
            unique_users=Count('user', distinct=True),
            avg_results=Avg('results_count')
        ).order_by('-count')[:limit]
    
    def failed_searches(self, days=7, limit=10):
        """Get searches with zero results in last N days"""
        from django.utils.timezone import now
        from datetime import timedelta
        from django.db.models import Count, Max
        
        cutoff_date = now() - timedelta(days=days)
        return self.filter(
            results_count=0,
            created_at__gte=cutoff_date
        ).values('query').annotate(
            attempt_count=Count('id'),
            last_attempted=Max('created_at')
        ).order_by('-attempt_count')[:limit]
    
    def search_volume_daily(self, start_date, end_date):
        """Get daily search volume for charting"""
        from django.db.models.functions import TruncDate
        from django.db.models import Count
        
        return self.filter(
            created_at__date__range=[start_date, end_date]
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            count=Count('id')
        ).order_by('date')
    
    def search_stats(self, start_date, end_date):
        """Get aggregate search statistics"""
        from django.db.models import Count, Avg
        
        stats = self.filter(
            created_at__date__range=[start_date, end_date]
        ).aggregate(
            total_searches=Count('id'),
            unique_searchers=Count('user', distinct=True),
            avg_results=Avg('results_count'),
            unique_queries=Count('query', distinct=True)
        )
        return stats


# ✨ PHASE 4: Detailed search logging for analytics
class SearchLog(models.Model):
    """
    Detailed log of every search for analytics purposes.
    Tracks what was searched, results count, and whether user clicked a result.
    """
    query = models.CharField(max_length=255, db_index=True)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    results_count = models.IntegerField(default=0)
    clicked_result = models.ForeignKey(Course, null=True, blank=True, on_delete=models.SET_NULL)
    session_id = models.CharField(max_length=100, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    objects = SearchLogManager()
    
    class Meta:
        indexes = [
            models.Index(fields=['query', 'created_at']),
            models.Index(fields=['user', 'created_at']),
        ]
        verbose_name_plural = "Search Logs"
    
    def __str__(self):
        return f"{self.query} ({self.results_count} results) - {self.created_at}"
    
    @classmethod
    def log_search(cls, query, results_count, user=None, session_id=''):
        """Log a search query with results count"""
        if not query or len(query.strip()) < 2:
            return None
        
        return cls.objects.create(
            query=query.strip(),
            results_count=results_count,
            user=user,
            session_id=session_id
        )


# ✨ PHASE 4: Manager for CourseSearchAnalytics
class CourseSearchAnalyticsManager(models.Manager):
    """Manager with methods for course search analytics"""
    
    def get_top_courses(self, limit=10, sort_by='impressions'):
        """Get most searched courses"""
        if sort_by == 'clicks':
            return self.order_by('-search_clicks')[:limit]
        elif sort_by == 'ctr':
            return self.order_by('-click_through_rate')[:limit]
        else:  # impressions
            return self.order_by('-search_impressions')[:limit]
    
    def get_by_ctr_range(self, min_ctr, max_ctr):
        """Get courses within CTR range"""
        return self.filter(
            click_through_rate__gte=min_ctr,
            click_through_rate__lte=max_ctr
        )
    
    def get_average_metrics(self):
        """Get average metrics across all courses"""
        from django.db.models import Avg
        
        return self.aggregate(
            avg_impressions=Avg('search_impressions'),
            avg_clicks=Avg('search_clicks'),
            avg_ctr=Avg('click_through_rate')
        )
    
    def get_quality_report(self):
        """
        ✨ PHASE 4.10: Generate comprehensive search quality report.
        Returns aggregated metrics with distribution analysis for Super Admin dashboard.
        """
        from django.db.models import Avg, Count, Q, F, Case, When
        
        total_courses = self.count()
        total_impressions = sum(a.search_impressions for a in self.all())
        total_clicks = sum(a.search_clicks for a in self.all())
        
        # Courses with no impressions (hidden search results)
        no_impression_courses = self.filter(search_impressions=0).count()
        
        # High performers (CTR > 5%)
        high_performers = self.filter(click_through_rate__gt=5.0).count()
        
        # Low performers (CTR < 1%)
        low_performers = self.filter(
            Q(click_through_rate__lt=1.0) & 
            Q(search_impressions__gt=10)  # Must have impressions
        ).count()
        
        avg_metrics = self.get_average_metrics()
        
        return {
            'total_courses': total_courses,
            'total_impressions': total_impressions,
            'total_clicks': total_clicks,
            'avg_impressions': avg_metrics['avg_impressions'] or 0,
            'avg_clicks': avg_metrics['avg_clicks'] or 0,
            'avg_ctr': round(avg_metrics['avg_ctr'] or 0, 2),
            'no_impression_courses': no_impression_courses,
            'high_performers': high_performers,
            'low_performers': low_performers,
            'overall_ctr': round((total_clicks / total_impressions * 100) if total_impressions > 0 else 0, 2)
        }
    
    def get_ctr_distribution(self):
        """
        ✨ PHASE 4.10: Get CTR distribution for quality analysis.
        Returns courses grouped by CTR ranges for histogram visualization.
        """
        from django.db.models import Count
        
        distribution = {
            '0-1%': self.filter(click_through_rate__gte=0, click_through_rate__lt=1).count(),
            '1-3%': self.filter(click_through_rate__gte=1, click_through_rate__lt=3).count(),
            '3-5%': self.filter(click_through_rate__gte=3, click_through_rate__lt=5).count(),
            '5-10%': self.filter(click_through_rate__gte=5, click_through_rate__lt=10).count(),
            '10%+': self.filter(click_through_rate__gte=10).count(),
        }
        return distribution
    
    def get_quality_recommendations(self):
        """
        ✨ PHASE 4.10: Generate actionable recommendations based on quality metrics.
        Returns list of priority-ranked improvement opportunities.
        """
        recommendations = []
        low_performers = self.filter(
            click_through_rate__lt=1.0,
            search_impressions__gt=10
        ).order_by('-search_impressions')[:5]
        
        if low_performers.exists():
            recommendations.append({
                'priority': 'HIGH',
                'action': 'Review low-performing courses',
                'description': f'{low_performers.count()} courses have < 1% CTR despite high impressions. Review course titles, descriptions, and search ranking.',
                'affected_count': low_performers.count()
            })
        
        no_impressions = self.filter(search_impressions=0).count()
        if no_impressions > 0:
            recommendations.append({
                'priority': 'MEDIUM',
                'action': 'Boost hidden courses',
                'description': f'{no_impressions} courses never appear in search results. Review search algorithm or boost course visibility.',
                'affected_count': no_impressions
            })
        
        return recommendations


# ✨ PHASE 4: Per-course search analytics
class CourseSearchAnalytics(models.Model):
    """
    Track search-related metrics for each course.
    How many times it appears in search results and gets clicked.
    """
    course = models.OneToOneField(Course, on_delete=models.CASCADE, related_name='search_analytics')
    search_impressions = models.IntegerField(default=0)  # Times appeared in search results
    search_clicks = models.IntegerField(default=0)  # Times clicked from search results
    click_through_rate = models.FloatField(default=0.0)  # Percentage of clicks vs impressions
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = CourseSearchAnalyticsManager()
    
    class Meta:
        verbose_name_plural = "Course Search Analytics"
    
    def __str__(self):
        return f"{self.course.title} - CTR: {self.click_through_rate}%"
    
    def calculate_ctr(self):
        """Calculate click-through rate"""
        if self.search_impressions == 0:
            self.click_through_rate = 0.0
        else:
            self.click_through_rate = (self.search_clicks / self.search_impressions) * 100
        self.save(update_fields=['click_through_rate', 'updated_at'])
        return self.click_through_rate


# ✨ PHASE 4.3: Signal handler for click tracking
def track_course_click(sender, instance, created, **kwargs):
    """
    Update CourseSearchAnalytics when a course is clicked from search results.
    Called when a SearchLog is created with a clicked_result.
    """
    if created and instance.clicked_result:
        try:
            analytics, _ = CourseSearchAnalytics.objects.get_or_create(
                course=instance.clicked_result
            )
            analytics.search_clicks += 1
            analytics.calculate_ctr()
        except Exception as e:
            # Silently fail - search tracking should not break the app
            pass


# ==================== TIER 1: QUICK WINS MODELS ====================

class ContentGap(models.Model):
    """
    Analyze failed searches to identify content creation gaps.
    Tracks searches with zero results to show demand for missing courses.
    """
    search_query = models.CharField(max_length=255, unique=True, db_index=True)
    attempt_count = models.IntegerField(default=1, help_text="Number of times searched")
    unique_users = models.IntegerField(default=1, help_text="Number of unique users searching")
    priority_score = models.FloatField(default=0, help_text="Calculated priority (0-100)")
    suggested_course_title = models.CharField(max_length=255, blank=True, null=True)
    suggested_category = models.ForeignKey(
        'Category', on_delete=models.SET_NULL, null=True, blank=True,
        help_text="Suggested category for the course"
    )
    last_searched = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-priority_score', '-attempt_count']
        indexes = [
            models.Index(fields=['-priority_score']),
            models.Index(fields=['-attempt_count']),
        ]
    
    def __str__(self):
        return f"{self.search_query} ({self.attempt_count} attempts)"
    
    @classmethod
    def calculate_priority_score(cls, attempt_count, unique_users):
        """Priority = (attempts × 0.6) + (unique_users × 0.4)"""
        return (attempt_count * 0.6) + (unique_users * 0.4)
    
    @classmethod
    def update_from_failed_searches(cls, days=30):
        """Analyze failed searches and update content gaps"""
        from datetime import timedelta
        from django.utils.timezone import now
        from django.db.models import Count
        
        cutoff_date = now() - timedelta(days=days)
        
        # Get failed searches (0 results)
        failed_searches = SearchLog.objects.filter(
            results_count=0,
            created_at__gte=cutoff_date
        ).values('query').annotate(
            attempts=Count('id'),
            unique=Count('user', distinct=True)
        ).order_by('-attempts')[:30]  # Top 30 gaps
        
        for search in failed_searches:
            query = search['query']
            attempts = search['attempts']
            unique = search['unique']
            priority = cls.calculate_priority_score(attempts, unique)
            
            gap, created = cls.objects.update_or_create(
                search_query=query,
                defaults={
                    'attempt_count': attempts,
                    'unique_users': unique,
                    'priority_score': priority,
                    'suggested_course_title': query.title(),
                }
            )


# ✨ PHASE 4.10 TIER 1.2: Search Query Taxonomy Models

class SearchQueryCategory(models.Model):
    """
    Categorize search queries for better understanding of user intent.
    Maps search patterns to semantic categories (skill, course type, level, etc.)
    """
    CATEGORY_TYPES = [
        ('SKILL', 'Technical Skill'),
        ('COURSE_TYPE', 'Course Type'),
        ('LEVEL', 'Proficiency Level'),
        ('TOPIC', 'Subject Topic'),
        ('TOOL', 'Tool/Framework'),
        ('DOMAIN', 'Business Domain'),
        ('OTHER', 'Other'),
    ]
    
    category_type = models.CharField(max_length=20, choices=CATEGORY_TYPES, db_index=True)
    category_name = models.CharField(max_length=100, db_index=True)
    query_patterns = models.JSONField(
        default=list,
        help_text="List of keywords or regex patterns that match this category"
    )
    description = models.TextField(blank=True, null=True)
    trending = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('category_type', 'category_name')
        indexes = [
            models.Index(fields=['category_type', 'trending']),
        ]
    
    def __str__(self):
        return f"{self.get_category_type_display()} - {self.category_name}"


class SearchQueryTaxonomyManager(models.Manager):
    """Manager for search query taxonomy analytics"""
    
    def get_by_category(self, start_date=None, end_date=None):
        """
        ✨ PHASE 4.10: Analyze search queries grouped by category.
        Returns aggregated metrics per category.
        """
        from django.db.models import Count, Q, F, Avg
        from django.utils import timezone
        from datetime import timedelta
        
        if not start_date:
            start_date = timezone.now() - timedelta(days=7)
        if not end_date:
            end_date = timezone.now()
        
        # Get all search logs in period
        logs = SearchLog.objects.filter(
            created_at__range=[start_date, end_date]
        )
        
        categories = SearchQueryCategory.objects.all()
        results = {}
        
        for category in categories:
            category_key = f"{category.category_type}_{category.category_name}"
            
            # Match logs to this category
            category_logs = logs.none()
            for pattern in category.query_patterns:
                pattern_lower = pattern.lower()
                category_logs |= logs.filter(query__icontains=pattern_lower)
            
            if category_logs.exists():
                stats = category_logs.aggregate(
                    search_volume=Count('id'),
                    avg_results=Avg('results_count'),
                    failed_searches=Count('id', filter=Q(results_count=0)),
                    unique_users=Count('user', distinct=True),
                )
                
                # Calculate failed rate
                failed_rate = (stats['failed_searches'] / stats['search_volume'] * 100) if stats['search_volume'] > 0 else 0
                
                # Get top queries in this category
                top_queries = category_logs.values('query').annotate(
                    count=Count('id')
                ).order_by('-count')[:5]
                
                results[category_key] = {
                    'category_type': category.category_type,
                    'category_name': category.category_name,
                    'search_volume': stats['search_volume'],
                    'avg_results': round(stats['avg_results'] or 0, 1),
                    'failed_searches': stats['failed_searches'],
                    'failed_rate': round(failed_rate, 1),
                    'unique_users': stats['unique_users'],
                    'trending': category.trending,
                    'top_queries': list(top_queries)
                }
        
        return results
    
    def get_trending_categories(self, limit=10):
        """Get trending search categories"""
        from datetime import timedelta
        from django.utils import timezone
        
        cutoff = timezone.now() - timedelta(days=7)
        categories = SearchQueryCategory.objects.filter(trending=True)
        
        results = {}
        for cat in categories[:limit]:
            cat_key = f"{cat.category_type}_{cat.category_name}"
            volume = SearchLog.objects.filter(
                created_at__gte=cutoff
            ).filter(
                query__in=cat.query_patterns
            ).count()
            results[cat_key] = volume
        
        return dict(sorted(results.items(), key=lambda x: x[1], reverse=True))


class SearchQueryTaxonomy(models.Model):
    """
    ✨ PHASE 4.10 TIER 1.2: Track categorized search query analytics.
    Uses SearchQueryCategory to organize and understand search patterns.
    """
    search_query = models.CharField(max_length=255, db_index=True)
    category = models.ForeignKey(
        SearchQueryCategory, on_delete=models.SET_NULL, 
        null=True, blank=True, related_name='search_queries'
    )
    search_count = models.IntegerField(default=1, help_text="Total times this query was searched")
    click_through_count = models.IntegerField(default=0, help_text="Times a result was clicked")
    failed_count = models.IntegerField(default=0, help_text="Times it returned 0 results")
    unique_users = models.IntegerField(default=1, help_text="Unique users who searched this")
    last_searched = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    objects = SearchQueryTaxonomyManager()
    
    class Meta:
        verbose_name_plural = "Search Query Taxonomies"
        indexes = [
            models.Index(fields=['category', 'search_count']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.search_query} ({self.category})"
    
    def calculate_metrics(self):
        """Recalculate metrics from SearchLog"""
        from django.db.models import Count, Q
        
        logs = api_models.SearchLog.objects.filter(query=self.search_query)
        
        self.search_count = logs.count()
        self.click_through_count = logs.filter(clicked_result__isnull=False).count()
        self.failed_count = logs.filter(results_count=0).count()
        self.unique_users = logs.values('user').distinct().count()
        self.save(update_fields=[
            'search_count', 'click_through_count', 'failed_count', 'unique_users'
        ])


class SearchTaxonomyAnalyticsManager(models.Manager):
    """Manager for advanced analytics on search taxonomy"""
    
    def get_taxonomy_report(self, category_type=None, start_date=None, end_date=None):
        """
        ✨ PHASE 4.10: Generate comprehensive taxonomy report.
        """
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Count, Sum, Avg
        
        if not start_date:
            start_date = timezone.now() - timedelta(days=30)
        if not end_date:
            end_date = timezone.now()
        
        queryset = self.filter(created_at__range=[start_date, end_date])
        
        if category_type:
            queryset = queryset.filter(category__category_type=category_type)
        
        return queryset.aggregate(
            total_searches=Sum('search_count'),
            total_clicks=Sum('click_through_count'),
            total_failures=Sum('failed_count'),
            unique_queries=Count('id'),
            avg_ctr=Avg('click_through_count'),
            avg_users_per_query=Avg('unique_users')
        )


class SearchTaxonomyAnalytics(models.Model):
    """
    ✨ PHASE 4.10: Aggregated analytics for search taxonomy.
    Tracks patterns and trends across all categorized searches.
    """
    category = models.OneToOneField(
        SearchQueryCategory, on_delete=models.CASCADE,
        related_name='analytics'
    )
    total_searches = models.IntegerField(default=0)
    total_clicks = models.IntegerField(default=0)
    total_failures = models.IntegerField(default=0)
    unique_queries = models.IntegerField(default=0)
    unique_users = models.IntegerField(default=0)
    avg_ctr = models.FloatField(default=0.0)
    failed_rate = models.FloatField(default=0.0)
    trending_score = models.FloatField(default=0.0, help_text="0-100 trending indicator")
    last_updated = models.DateTimeField(auto_now=True)
    
    objects = SearchTaxonomyAnalyticsManager()
    
    class Meta:
        verbose_name_plural = "Search Taxonomy Analytics"
    
    def __str__(self):
        return f"Analytics for {self.category.category_name}"
    
    def calculate_metrics(self):
        """Recalculate metrics from SearchQueryTaxonomy"""
        from django.db.models import Count, Sum, Avg
        
        queries = SearchQueryTaxonomy.objects.filter(category=self.category)
        
        agg = queries.aggregate(
            total_searches=Sum('search_count'),
            total_clicks=Sum('click_through_count'),
            total_failures=Sum('failed_count'),
            unique_queries=Count('id'),
            unique_users=Sum('unique_users')
        )
        
        self.total_searches = agg['total_searches'] or 0
        self.total_clicks = agg['total_clicks'] or 0
        self.total_failures = agg['total_failures'] or 0
        self.unique_queries = agg['unique_queries'] or 0
        self.unique_users = agg['unique_users'] or 0
        
        # Calculate CTR
        if self.total_searches > 0:
            self.avg_ctr = (self.total_clicks / self.total_searches) * 100
            self.failed_rate = (self.total_failures / self.total_searches) * 100
        else:
            self.avg_ctr = 0
            self.failed_rate = 0
        
        # Calculate trending score (recent activity weighted)
        from django.utils import timezone
        from datetime import timedelta
        
        week_ago = timezone.now() - timedelta(days=7)
        recent_queries = queries.filter(last_searched__gte=week_ago).count()
        self.trending_score = min((recent_queries / max(self.unique_queries, 1)) * 100, 100)
        
        self.save(update_fields=[
            'total_searches', 'total_clicks', 'total_failures',
            'unique_queries', 'unique_users', 'avg_ctr', 'failed_rate', 'trending_score'
        ])


class StudentRiskAssessment(models.Model):
    """
    Identify at-risk students likely to drop out before they do.
    Uses 4-factor scoring: completion, quizzes, engagement, video progress.
    """
    RISK_LEVELS = [
        ('LOW', 'Low Risk'),
        ('MEDIUM', 'Medium Risk'),
        ('HIGH', 'High Risk'),
    ]
    
    enrollment = models.OneToOneField(
        'EnrolledCourse', on_delete=models.CASCADE, related_name='risk_assessment'
    )
    risk_score = models.FloatField(default=0, help_text="Risk score 0-100")
    risk_level = models.CharField(max_length=10, choices=RISK_LEVELS, default='LOW')
    indicators = models.JSONField(
        default=dict,
        help_text="Risk factors: low_completion, quiz_failures, inactive_days, low_video_progress"
    )
    last_assessed = models.DateTimeField(auto_now=True)
    intervention_sent = models.BooleanField(default=False)
    intervention_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-risk_score']
        indexes = [
            models.Index(fields=['-risk_score']),
            models.Index(fields=['risk_level']),
        ]
    
    def __str__(self):
        return f"{self.enrollment.user.full_name} - {self.risk_level} ({self.risk_score:.1f})"
    
    @classmethod
    def calculate_risk_score(cls, enrollment):
        """
        Calculate risk score using 4 factors:
        - Completion rate: 30% weight
        - Quiz performance: 25% weight
        - Engagement (days inactive): 25% weight
        - Video progress: 20% weight
        """
        score = 0
        indicators = {}
        
        # Factor 1: Completion rate (30%)
        completion = enrollment.completion_percentage()
        if completion < 25:
            score += 30
            indicators['low_completion'] = f"{completion:.1f}%"
        elif completion < 50:
            score += 15
            indicators['low_completion'] = f"{completion:.1f}%"
        
        # Factor 2: Quiz performance (25%)
        quiz_results = enrollment.quiz_results()
        if quiz_results:
            passed = sum(1 for q in quiz_results if q.get('passed', False))
            pass_rate = (passed / len(quiz_results) * 100) if quiz_results else 0
            if pass_rate < 50:
                score += 25
                indicators['quiz_failures'] = f"{pass_rate:.0f}% pass rate"
            elif pass_rate < 70:
                score += 12
                indicators['low_quiz_scores'] = f"{pass_rate:.0f}% pass rate"
        
        # Factor 3: Engagement (25%)
        from datetime import timedelta
        from django.utils.timezone import now
        days_inactive = (now() - (enrollment.user.last_login or now())).days
        if days_inactive > 14:
            score += 25
            indicators['inactive_days'] = days_inactive
        elif days_inactive > 7:
            score += 12
            indicators['inactive_days'] = days_inactive
        
        # Factor 4: Video progress (20%)
        video_progress = VideoProgress.objects.filter(
            user=enrollment.user,
            course=enrollment.course
        ).aggregate(avg=models.Avg('progress_percentage'))
        avg_video = video_progress.get('avg') or 0
        if avg_video < 30:
            score += 20
            indicators['low_video_progress'] = f"{avg_video:.1f}%"
        elif avg_video < 60:
            score += 10
            indicators['low_video_progress'] = f"{avg_video:.1f}%"
        
        # Determine risk level
        if score >= 75:
            risk_level = 'HIGH'
        elif score >= 50:
            risk_level = 'MEDIUM'
        else:
            risk_level = 'LOW'
        
        return min(100, score), risk_level, indicators
    
    @classmethod
    def assess_all_students(cls):
        """Daily background job to assess all enrolled students"""
        from django.utils.timezone import now
        
        enrollments = EnrolledCourse.objects.all()
        updated_count = 0
        
        for enrollment in enrollments:
            score, level, indicators = cls.calculate_risk_score(enrollment)
            assessment, created = cls.objects.update_or_create(
                enrollment=enrollment,
                defaults={
                    'risk_score': score,
                    'risk_level': level,
                    'indicators': indicators,
                }
            )
            updated_count += 1
        
        return updated_count


class CourseRecommendation(models.Model):
    """
    Personalized course recommendations using content-based and collaborative filtering.
    Tracks recommendations and their effectiveness (clicks/conversions).
    """
    RECOMMENDATION_REASONS = [
        ('similar_search', 'Similar to your search'),
        ('similar_course', 'Similar to completed course'),
        ('trending_category', 'Trending in your category'),
        ('collaborative', 'Users like you enrolled'),
        ('skill_progression', 'Next skill to learn'),
    ]
    
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='course_recommendations'
    )
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name='recommended_to_users'
    )
    score = models.FloatField(help_text="Recommendation score 0-100")
    reason = models.CharField(max_length=50, choices=RECOMMENDATION_REASONS)
    clicked = models.BooleanField(default=False)
    enrolled = models.BooleanField(default=False)
    click_date = models.DateTimeField(null=True, blank=True)
    enroll_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['user', 'course']
        ordering = ['-score']
        indexes = [
            models.Index(fields=['user', '-score']),
            models.Index(fields=['reason']),
        ]
    
    def __str__(self):
        return f"{self.user.full_name} → {self.course.title} ({self.score:.1f})"
    
    def mark_clicked(self):
        """Track when user clicks recommendation"""
        from django.utils.timezone import now
        self.clicked = True
        self.click_date = now()
        self.save()
    
    def mark_enrolled(self):
        """Track when user enrolls from recommendation"""
        from django.utils.timezone import now
        self.enrolled = True
        self.enroll_date = now()
        self.save()
    
    @property
    def conversion_rate(self):
        """Calculate conversion from recommendation to enrollment"""
        if self.clicked:
            return 100 if self.enrolled else 0
        return None


# ==================== TIER 2: CORE FEATURES MODELS ====================

class InstructorPerformance(models.Model):
    """
    Comprehensive instructor performance analytics.
    Scores based on: ratings (40%), completion (30%), Q&A (15%), sentiment (15%).
    """
    teacher = models.OneToOneField(
        Teacher, on_delete=models.CASCADE, related_name='performance_metrics'
    )
    
    # Rating metrics
    avg_rating = models.FloatField(default=0, help_text="Average course rating 1-5")
    total_ratings = models.IntegerField(default=0)
    
    # Course metrics
    course_count = models.IntegerField(default=0)
    total_students = models.IntegerField(default=0)
    avg_completion_rate = models.FloatField(default=0, help_text="Average completion % across courses")
    
    # Engagement metrics
    avg_qa_response_time_hours = models.FloatField(default=0, help_text="Hours to respond to Q&A")
    qa_response_rate = models.FloatField(default=0, help_text="% of questions answered")
    
    # Review sentiment
    positive_reviews_pct = models.FloatField(default=0, help_text="% of positive reviews")
    
    # Composite scores
    teaching_effectiveness_score = models.FloatField(default=0, help_text="0-100 composite score")
    
    # Period tracking
    period_start = models.DateField(auto_now_add=True)
    period_end = models.DateField(auto_now=True)
    
    class Meta:
        ordering = ['-teaching_effectiveness_score']
        indexes = [
            models.Index(fields=['-teaching_effectiveness_score']),
        ]
    
    def __str__(self):
        return f"{self.teacher.full_name} - {self.teaching_effectiveness_score:.1f}"
    
    def calculate_effectiveness_score(self):
        """
        Calculate teaching effectiveness score (0-100):
        - Ratings: 40%
        - Completion: 30%
        - Q&A: 15%
        - Sentiment: 15%
        """
        score = (
            (self.avg_rating / 5.0) * 40 +  # Rating 0-40
            (self.avg_completion_rate / 100.0) * 30 +  # Completion 0-30
            (self.qa_response_rate / 100.0) * 15 +  # Q&A 0-15
            (self.positive_reviews_pct / 100.0) * 15  # Sentiment 0-15
        )
        return min(100, max(0, score))
    
    def save(self, *args, **kwargs):
        """Auto-calculate effectiveness score before saving"""
        self.teaching_effectiveness_score = self.calculate_effectiveness_score()
        super().save(*args, **kwargs)
    
    @classmethod
    def recalculate_for_instructor(cls, teacher):
        """Recalculate all metrics for an instructor"""
        from django.db.models import Avg, Count
        
        # Get courses
        courses = Course.objects.filter(teacher=teacher)
        
        # Calculate metrics
        avg_rating = Review.objects.filter(
            course__in=courses, active=True
        ).aggregate(avg=Avg('rating'))['avg'] or 0
        
        total_ratings = Review.objects.filter(
            course__in=courses, active=True
        ).count()
        
        course_count = courses.count()
        
        total_students = EnrolledCourse.objects.filter(
            course__in=courses
        ).values('user').distinct().count()
        
        avg_completion = EnrolledCourse.objects.filter(
            course__in=courses
        ).aggregate(avg=Avg('completion_percentage'))['avg'] or 0
        
        positive_reviews = Review.objects.filter(
            course__in=courses,
            rating__gte=4,
            active=True
        ).count()
        
        positive_pct = (positive_reviews / total_ratings * 100) if total_ratings > 0 else 0
        
        # Update or create
        perf, created = cls.objects.update_or_create(
            teacher=teacher,
            defaults={
                'avg_rating': avg_rating,
                'total_ratings': total_ratings,
                'course_count': course_count,
                'total_students': total_students,
                'avg_completion_rate': avg_completion,
                'positive_reviews_pct': positive_pct,
            }
        )
        
        return perf


class LearningPath(models.Model):
    """
    Personalized learning paths for students.
    Includes course sequence, difficulty progression, and success tracking.
    """
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='learning_paths'
    )
    title = models.CharField(max_length=255, help_text="Path title (e.g., 'Python Master')")
    description = models.TextField(blank=True, null=True)
    
    # Path configuration
    difficulty_progression = models.CharField(
        max_length=50,
        choices=[
            ('beginner', 'Beginner → Intermediate → Advanced'),
            ('mixed', 'Mixed Difficulty'),
            ('advanced', 'Advanced Only'),
        ],
        default='beginner'
    )
    
    estimated_duration_hours = models.IntegerField(
        help_text="Total estimated hours to complete"
    )
    
    # Progress tracking
    completion_percentage = models.FloatField(default=0)
    courses_completed = models.IntegerField(default=0)
    courses_total = models.IntegerField(default=1)
    
    # Effectiveness
    effectiveness_score = models.FloatField(
        default=0, help_text="0-100 how well path matches student"
    )
    success_probability = models.FloatField(
        default=0, help_text="Estimated % chance to complete all"
    )
    
    # Timeline
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    estimated_completion = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.full_name} - {self.title}"


class ChurnPrediction(models.Model):
    """
    ML-ready churn prediction model.
    Identifies users likely to stop using platform in next 30 days.
    """
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='churn_prediction'
    )
    
    # Prediction metrics
    churn_probability = models.FloatField(help_text="0-100 probability of churn")
    risk_signals = models.JSONField(
        default=dict,
        help_text="Individual risk factors: days_inactive, courses_in_progress, quiz_failures, negative_reviews, engagement_trend"
    )
    
    # Intervention tracking
    intervention_status = models.CharField(
        max_length=50,
        choices=[
            ('none', 'No Intervention'),
            ('email_sent', 'Email Sent'),
            ('message_sent', 'Message Sent'),
            ('mentor_assigned', 'Mentor Assigned'),
            ('re_engaged', 'Re-engaged'),
        ],
        default='none'
    )
    intervention_date = models.DateTimeField(null=True, blank=True)
    
    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-churn_probability']
        indexes = [
            models.Index(fields=['-churn_probability']),
        ]
    
    def __str__(self):
        return f"{self.user.full_name} - {self.churn_probability:.1f}% churn risk"


# ==================== TIER 3: OPTIMIZATION MODELS ====================

class SearchIntent(models.Model):
    """
    Classify search queries by intent for better ranking.
    Intents: skill_learning, problem_solving, career_change, general.
    """
    INTENT_TYPES = [
        ('skill_learning', 'Learning a Skill'),
        ('problem_solving', 'Solving a Problem'),
        ('career_change', 'Career Change'),
        ('general', 'General Interest'),
    ]
    
    query = models.CharField(max_length=255, unique=True, db_index=True)
    intent_type = models.CharField(max_length=50, choices=INTENT_TYPES, default='general')
    related_keywords = models.JSONField(
        default=list,
        help_text="Keywords associated with this intent"
    )
    
    # Course associations
    best_courses = models.ManyToManyField(
        Course,
        related_name='search_intents',
        blank=True,
        help_text="Courses matching this intent"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['query']
        indexes = [
            models.Index(fields=['intent_type']),
        ]
    
    def __str__(self):
        return f"{self.query} - {self.intent_type}"
    
    @classmethod
    def classify_intent(cls, query):
        """Classify search query by intent"""
        query_lower = query.lower()
        
        # Skill learning keywords
        if any(kw in query_lower for kw in ['learn', 'tutorial', 'course', 'beginner', 'intro', 'basics']):
            return 'skill_learning'
        
        # Problem solving keywords
        elif any(kw in query_lower for kw in ['how to', 'fix', 'solve', 'debug', 'error', 'issue', 'problem']):
            return 'problem_solving'
        
        # Career change keywords
        elif any(kw in query_lower for kw in ['career', 'job', 'transition', 'become', 'switch', 'bootcamp']):
            return 'career_change'
        
        return 'general'


class QuizMetrics(models.Model):
    """
    Track quiz quality metrics and auto-calibrate difficulty.
    Provides recommendations for improvement.
    """
    DIFFICULTY_RATINGS = [
        ('too_easy', 'Too Easy'),
        ('appropriate', 'Appropriate'),
        ('too_hard', 'Too Hard'),
    ]
    
    quiz = models.OneToOneField(
        Quiz, on_delete=models.CASCADE, related_name='metrics'
    )
    
    # Difficulty metrics
    avg_score = models.FloatField(default=0, help_text="Average score across attempts")
    pass_rate = models.FloatField(default=0, help_text="% of attempts that passed (>=70%)")
    
    # Quality metrics
    discrimination_index = models.FloatField(
        default=0,
        help_text="0-1: ability to distinguish high/low performers"
    )
    difficulty_rating = models.CharField(
        max_length=20,
        choices=DIFFICULTY_RATINGS,
        default='appropriate'
    )
    
    # Timing
    avg_time_minutes = models.FloatField(default=0, help_text="Average time to complete")
    
    last_calibrated = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['quiz']
    
    def __str__(self):
        return f"{self.quiz.title} - {self.difficulty_rating}"
    
    def get_calibration_recommendations(self):
        """Get recommendations for improving quiz"""
        recommendations = []
        
        if self.pass_rate > 80:
            recommendations.append({
                'action': 'INCREASE_DIFFICULTY',
                'reason': 'Quiz is too easy (>80% pass rate)',
                'suggestions': [
                    'Add more advanced questions',
                    'Increase passing score requirement',
                    'Add time constraints',
                ]
            })
        elif self.pass_rate < 50:
            recommendations.append({
                'action': 'DECREASE_DIFFICULTY',
                'reason': 'Quiz is too hard (<50% pass rate)',
                'suggestions': [
                    'Review question clarity',
                    'Add more basic questions',
                    'Increase time limits',
                    'Add helpful hints',
                ]
            })
        
        if self.discrimination_index < 0.2:
            recommendations.append({
                'action': 'REVIEW_QUESTIONS',
                'reason': 'Questions not differentiating skill levels',
                'suggestions': [
                    'Review question wording',
                    'Ensure correct answers are clear',
                    'Add distractors for multiple choice',
                ]
            })
        
        return recommendations
    
    @classmethod
    def analyze_quiz(cls, quiz):
        """Analyze quiz performance and update metrics"""
        from django.db.models import Avg, Count
        
        attempts = QuizAttempt.objects.filter(quiz=quiz)
        
        if not attempts.exists():
            return None
        
        avg_score = attempts.aggregate(avg=Avg('score'))['avg'] or 0
        passed = attempts.filter(is_passed=True).count()
        pass_rate = (passed / attempts.count()) if attempts.count() > 0 else 0
        
        # Determine difficulty
        if pass_rate > 0.8:
            difficulty = 'too_easy'
        elif pass_rate < 0.5:
            difficulty = 'too_hard'
        else:
            difficulty = 'appropriate'
        
        metrics, created = cls.objects.update_or_create(
            quiz=quiz,
            defaults={
                'avg_score': avg_score,
                'pass_rate': pass_rate * 100,
                'difficulty_rating': difficulty,
            }
        )
        
        return metrics


# ✨ PHASE 4.78: Instructor Request Model for role request workflow
class InstructorRequest(models.Model):
    """
    ✨ PHASE 4.78: Instructor role request system
    Allows students to request instructor/teacher role with admin approval workflow
    
    Workflow:
    1. Student submits request with details about expertise
    2. Request status: PENDING
    3. Admin reviews request
    4. Admin approves (status=APPROVED) → User gets instructor role + Teacher object
    5. Admin rejects (status=REJECTED) → Stores rejection reason, user can reapply
    """
    
    REQUEST_STATUS_CHOICES = [
        ('PENDING', 'Menunggu Review Admin'),
        ('APPROVED', 'Disetujui'),
        ('REJECTED', 'Ditolak'),
    ]
    
    EXPERIENCE_LEVEL_CHOICES = [
        ('BEGINNER', 'Pemula (0-2 tahun)'),
        ('INTERMEDIATE', 'Menengah (2-5 tahun)'),
        ('ADVANCED', 'Lanjutan (5+ tahun)'),
    ]
    
    # Request Information
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='instructor_requests')
    expertise_areas = models.CharField(
        max_length=500,
        help_text="Bidang keahlian yang ingin diajarkan (pisahkan dengan koma)"
    )
    bio = models.TextField(help_text="Pengenalan singkat tentang Anda dan pengalaman mengajar")
    experience_level = models.CharField(
        max_length=20,
        choices=EXPERIENCE_LEVEL_CHOICES,
        default='BEGINNER'
    )
    
    # Status and Timeline
    status = models.CharField(
        max_length=20,
        choices=REQUEST_STATUS_CHOICES,
        default='PENDING',
        db_index=True
    )
    request_date = models.DateTimeField(auto_now_add=True, db_index=True)
    
    # Admin Review Information
    reviewed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='instructor_requests_reviewed'
    )
    reviewed_date = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Alasan penolakan (jika status=REJECTED)"
    )
    
    class Meta:
        ordering = ['-request_date']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['status', '-request_date']),
            models.Index(fields=['reviewed_date']),
        ]
        verbose_name = "Instructor Request"
        verbose_name_plural = "Instructor Requests"
    
    def __str__(self):
        return f"{self.user.full_name} - {self.get_status_display()} ({self.request_date.strftime('%Y-%m-%d')})"
    
    def approve(self, reviewed_by):
        """
        Admin approve instructor request
        - Sets status to APPROVED
        - Creates Teacher object if not exists
        - Grants instructor role to user
        - Records admin who approved
        """
        # Create or get Teacher object
        teacher, created = Teacher.objects.get_or_create(
            user=self.user,
            defaults={
                'full_name': self.user.full_name,
                'image': '',
            }
        )
        
        # Grant instructor role
        self.user.is_instructor = True
        self.user.roles = 'student,teacher'  # Add teacher to roles
        # ✨ PHASE 4.81: Set current_role to 'teacher' so JWT token is updated correctly
        # This ensures that when user logs in next time or refreshes, they get 'teacher' role
        self.user.current_role = 'teacher'
        self.user.save()
        
        # Update request
        self.status = 'APPROVED'
        self.reviewed_by = reviewed_by
        self.reviewed_date = timezone.now()
        self.rejection_reason = None
        self.save()
        
        return True
    
    def reject(self, reviewed_by, reason):
        """
        Admin reject instructor request
        - Sets status to REJECTED
        - Records rejection reason
        - User can see reason and reapply later
        """
        self.status = 'REJECTED'
        self.reviewed_by = reviewed_by
        self.reviewed_date = timezone.now()
        self.rejection_reason = reason
        self.save()
        
        return True
    
    @classmethod
    def can_user_request(cls, user):
        """
        Check if user can submit a new request
        Returns: (can_request: bool, reason: str)
        
        ✨ PHASE 4.79: Allows reapplication on rejected requests
        - Blocks if user already is instructor
        - Blocks if user has pending request
        - Allows if previous request was rejected (can reapply)
        """
        # Check if user is already instructor
        if user.is_instructor:
            return False, "Anda sudah menjadi instruktur"
        
        # Check if user already has pending request
        pending = cls.objects.filter(user=user, status='PENDING').exists()
        if pending:
            return False, "Anda sudah memiliki permintaan yang menunggu review"
        
        # Allow reapplication on rejected requests (no block here)
        return True, ""
    
    @classmethod
    def get_or_create_for_user(cls, user):
        """
        ✨ PHASE 4.79: Get or create instructor request for user
        
        Handles both new requests and reapplication on rejected requests:
        - If no request exists: Create new PENDING request
        - If REJECTED request exists: Return existing (will be updated)
        - If PENDING request exists: Raises error (handled by can_user_request)
        
        Returns: (request, created: bool)
        """
        # Try to get existing rejected request (for reapplication)
        rejected = cls.objects.filter(user=user, status='REJECTED').first()
        if rejected:
            # Return existing rejected request to be updated
            return rejected, False
        
        # No rejected request, create new one
        new_request = cls.objects.create(user=user)
        return new_request, True


# ✨ PHASE 4.10: Signal handler for taxonomy updates
def update_search_taxonomy(sender, instance, created, **kwargs):
    """
    Update SearchQueryTaxonomy when a search occurs.
    Called when a SearchLog is created.
    """
    if created and instance.query:
        try:
            query_lower = instance.query.lower()
            
            # Find matching category
            category = None
            categories = SearchQueryCategory.objects.all()
            for cat in categories:
                for pattern in cat.query_patterns:
                    if pattern.lower() in query_lower or query_lower in pattern.lower():
                        category = cat
                        break
                if category:
                    break
            
            # Get or create taxonomy entry
            taxonomy, created_new = SearchQueryTaxonomy.objects.get_or_create(
                search_query=instance.query,
                defaults={'category': category}
            )
            
            # Update counts if existing
            if not created_new:
                taxonomy.search_count += 1
                if instance.clicked_result:
                    taxonomy.click_through_count += 1
                if instance.results_count == 0:
                    taxonomy.failed_count += 1
                
                # Increment unique users if different
                if instance.user and instance.user.id not in [
                    log.user_id for log in api_models.SearchLog.objects.filter(
                        query=instance.query
                    ).values_list('user_id', flat=True).distinct()
                ]:
                    taxonomy.unique_users += 1
                
                taxonomy.save(update_fields=[
                    'search_count', 'click_through_count', 'failed_count', 'unique_users'
                ])
            
            # Update analytics if category exists
            if category:
                analytics, _ = SearchTaxonomyAnalytics.objects.get_or_create(
                    category=category
                )
                analytics.calculate_metrics()
        
        except Exception as e:
            # Silently fail - taxonomy updates should not break search
            pass


# ✨ PHASE 10.1: Student and Instructor Points Ranking System

class StudentPoints(models.Model):
    """
    Tracks student ranking points across lifetime, yearly, and monthly periods.
    
    ✨ PHASE 10.1: Ranking system integration
    Points awarded for:
    - Course completion: 100 points
    - Course rating: 15 points
    - Platform testimonial: 20 points
    (Quiz mastery points are allocated to Course-specific Leaderboard)
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_points')
    
    # Lifetime points (never resets)
    lifetime_points = models.IntegerField(default=0, db_index=True)
    lifetime_updated = models.DateTimeField(auto_now=True)
    
    # Yearly points (resets on Jan 1)
    yearly_points = models.IntegerField(default=0)
    yearly_year = models.IntegerField(default=0, help_text="Year for yearly ranking")
    yearly_updated = models.DateTimeField(auto_now=True)
    
    # Monthly points (resets on 1st of month)
    monthly_points = models.IntegerField(default=0)
    monthly_year = models.IntegerField(default=0, help_text="Year for monthly ranking")
    monthly_month = models.IntegerField(default=0, help_text="Month (1-12) for monthly ranking")
    monthly_updated = models.DateTimeField(auto_now=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Student Points"
        verbose_name_plural = "Student Points"
        ordering = ["-lifetime_points"]
        indexes = [
            models.Index(fields=["-lifetime_points"]),
            models.Index(fields=["-yearly_points"]),
            models.Index(fields=["-monthly_points"]),
        ]
    
    def __str__(self):
        return f"{self.user.full_name or self.user.username} - {self.lifetime_points} points"
    
    @classmethod
    def add_points(cls, user, points, category, **kwargs):
        """
        Add points to a student with automatic period bucketing.
        
        Args:
            user: User instance
            points: Number of points to add
            category: Type of point award (course_completion, quiz_score, rating_given, etc.)
            **kwargs: Additional metadata (course_id, quiz_id, review_id, description)
        """
        now = timezone.now()
        current_year = now.year
        current_month = now.month
        
        obj, created = cls.objects.get_or_create(user=user)
        
        # Add to all buckets
        obj.lifetime_points += points
        obj.yearly_points += points
        obj.monthly_points += points
        
        # Reset yearly if year has changed
        if obj.yearly_year != current_year:
            obj.yearly_year = current_year
            obj.yearly_points = points
        
        # Reset monthly if month has changed
        if obj.monthly_year != current_year or obj.monthly_month != current_month:
            obj.monthly_year = current_year
            obj.monthly_month = current_month
            obj.monthly_points = points
        
        obj.save()
        
        # Create audit log if needed
        try:
            PointsAuditLog.objects.create(
                user=user,
                points_type='student',
                activity_type=category,
                points_awarded=points,
                course_id=kwargs.get('course_id'),
                quiz_id=kwargs.get('quiz_id'),
                review_id=kwargs.get('review_id'),
                description=kwargs.get('description', '')
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Error creating student PointsAuditLog: {e}")
        
        return obj

    @classmethod
    def reconcile_points(cls, user):
        """
        Anti-redundansi, Sinkronisasi Komprehensif, dan Adaptasi Perubahan Data Poin Peserta:
        1. Kuis & Ujian (quiz_score):
           - Evaluasi QuizAttempt user yang lulus (is_passed=True).
           - Ambil attempt terbaik (skor tertinggi) untuk setiap kuis.
           - Sinkronkan PointsAuditLog (+skor tertinggi pt) dan hapus entri jika attempt dihapus.
        2. Penyelesaian Kursus / Sertifikat (course_completion):
           - Evaluasi Certificate valid (is_valid=True) user.
           - Sinkronkan PointsAuditLog (+100 pt per kursus) dan hapus entri jika sertifikat dihapus / tidak valid.
        3. Ulasan Kursus (rating_given):
           - Evaluasi Review aktif (active=True, role='student', course__isnull=False).
           - Sinkronkan PointsAuditLog (+50 pt per kursus) dan hapus entri jika review dihapus / dinonaktifkan.
        4. Testimoni Platform (platform_testimonial):
           - Evaluasi Review aktif testimoni platform (active=True, role='student', course__isnull=True).
           - Sinkronkan PointsAuditLog (+50 pt per peserta) dan hapus jika dihapus / dinonaktifkan.
        5. Rekalkulasi StudentPoints:
           - Hitung total aktual lifetime, yearly, dan monthly points.
        6. Sinkronisasi ActivityLog:
           - Set points_awarded = 0 untuk seluruh aktivitas non-poin (lesson_completed, video_*, enrollment, question_*).
           - Bersihkan duplikasi ActivityLog pada lesson_completed dan question_asked.
           - Pastikan points_awarded pada log aktivitas perolehan poin (certificate_earned, quiz_passed, review_posted, testimonial_posted)
             persis sama dengan PointsAuditLog sehingga total poin di timeline tepat sama dengan StudentPoints.lifetime_points.
        """
        from collections import defaultdict
        from django.db.models import Max, Q
        now = timezone.now()
        current_year = now.year
        current_month = now.month

        # 1. Kursus & Sertifikat: sinkronisasi dari Certificate valid
        valid_certs = Certificate.objects.filter(user=user, is_valid=True).select_related('course')
        valid_cert_courses = set()
        for cert in valid_certs:
            if cert.course_id:
                valid_cert_courses.add(cert.course_id)
                has_pal = PointsAuditLog.objects.filter(
                    user=user,
                    points_type='student',
                    activity_type='course_completion',
                    course_id=cert.course_id
                ).exists()
                if not has_pal:
                    c_title = cert.course.title if cert.course else f"Kursus #{cert.course_id}"
                    PointsAuditLog.objects.create(
                        user=user,
                        points_type='student',
                        activity_type='course_completion',
                        points_awarded=100,
                        course_id=cert.course_id,
                        description=f"Completed course: {c_title}"
                    )

        # Hapus audit log course_completion yang sertifikatnya sudah dihapus / tidak valid
        for c_log in PointsAuditLog.objects.filter(user=user, points_type='student', activity_type='course_completion'):
            if c_log.course_id not in valid_cert_courses:
                c_log.delete()

        # Deduplikasi course_completion (maksimal 1 per kursus)
        seen_courses = set()
        for c_log in PointsAuditLog.objects.filter(user=user, points_type='student', activity_type='course_completion').order_by('-awarded_at'):
            if c_log.course_id in seen_courses:
                c_log.delete()
            else:
                seen_courses.add(c_log.course_id)

        # 2. Pembersihan Poin Non-Global: Kuis, MantaType, & Mini-Game Kursus
        # Sesuai kebijakan tata kelola kompetensi ASN Setjen DPD RI:
        # - Kelulusan Kuis/Ujian difokuskan murni untuk pemeringkatan dalam kursus (Course Leaderboard).
        # - Poin mini game edukasi kursus (TTS, Anagram, Word Search, dsb) dialokasikan untuk Course Leaderboard.
        # - MantaType difokuskan murni untuk permainan arcade ketangkasan (tidak menambah XP global).
        # Hapus seluruh audit log kuis, mantatype, dan points_earned siswa agar tidak masuk ke akumulasi StudentPoints global.
        PointsAuditLog.objects.filter(
            user=user,
            points_type='student',
            activity_type__in=['quiz_score', 'mantatype_reward', 'points_earned']
        ).delete()

        # 3. Ulasan / Rating Kursus: dari Review aktif siswa per kursus (+15 Poin)
        active_course_reviews = Review.objects.filter(
            user=user,
            active=True,
            course__isnull=False
        ).select_related('course')
        reviewed_course_ids = set()
        for rev in active_course_reviews:
            if getattr(rev, 'role', 'student') == 'student':
                reviewed_course_ids.add(rev.course_id)
                has_pal = PointsAuditLog.objects.filter(
                    user=user,
                    points_type='student',
                    activity_type='rating_given',
                    course_id=rev.course_id
                ).exists()
                if not has_pal:
                    c_title = rev.course.title if rev.course else f"Kursus #{rev.course_id}"
                    PointsAuditLog.objects.create(
                        user=user,
                        points_type='student',
                        activity_type='rating_given',
                        points_awarded=15,
                        course_id=rev.course_id,
                        review_id=rev.id,
                        description=f"Gave {rev.rating}* rating on: {c_title}"
                    )
                else:
                    # Sinkronkan poin ulasan lama ke bobot baru (+15 Poin)
                    PointsAuditLog.objects.filter(
                        user=user,
                        points_type='student',
                        activity_type='rating_given',
                        course_id=rev.course_id
                    ).exclude(points_awarded=15).update(points_awarded=15)

        # Hapus audit log ulasan yang review-nya dihapus atau dinonaktifkan
        for r_log in PointsAuditLog.objects.filter(user=user, points_type='student', activity_type='rating_given', course_id__isnull=False):
            if r_log.course_id not in reviewed_course_ids:
                r_log.delete()

        # Deduplikasi ulasan kursus (maksimal 1 per kursus)
        seen_reviews = set()
        for r_log in PointsAuditLog.objects.filter(user=user, points_type='student', activity_type='rating_given', course_id__isnull=False).order_by('-awarded_at'):
            if r_log.course_id in seen_reviews:
                r_log.delete()
            else:
                seen_reviews.add(r_log.course_id)

        # 4. Testimoni Platform: maksimal 1 per siswa dari Review aktif testimoni (+20 Poin)
        active_testi = Review.objects.filter(
            user=user,
            active=True,
            course__isnull=True,
            role='student'
        ).first()

        testi_logs = PointsAuditLog.objects.filter(
            user=user,
            points_type='student',
            activity_type__in=['platform_testimonial', 'rating_given'],
            course_id__isnull=True
        ).order_by('-awarded_at')

        if active_testi:
            if testi_logs.exists():
                primary = testi_logs.first()
                if primary.points_awarded != 20:
                    primary.points_awarded = 20
                    primary.save(update_fields=['points_awarded'])
                for red in testi_logs[1:]:
                    red.delete()
            else:
                PointsAuditLog.objects.create(
                    user=user,
                    points_type='student',
                    activity_type='platform_testimonial',
                    points_awarded=20,
                    review_id=active_testi.id,
                    description=f"Review: {active_testi.rating}* on [PLATFORM TESTIMONIAL as student]"
                )
        else:
            for red in testi_logs:
                red.delete()

        # 5. Hitung total aktual StudentPoints dari PointsAuditLog
        valid_activities = ['course_completion', 'rating_given', 'platform_testimonial']
        valid_logs = PointsAuditLog.objects.filter(
            user=user,
            points_type='student',
            activity_type__in=valid_activities
        )

        lifetime_total = sum(l.points_awarded for l in valid_logs)
        yearly_total = sum(l.points_awarded for l in valid_logs.filter(awarded_at__year=current_year))
        monthly_total = sum(l.points_awarded for l in valid_logs.filter(
            awarded_at__year=current_year,
            awarded_at__month=current_month
        ))

        obj, _ = cls.objects.get_or_create(user=user)
        obj.lifetime_points = lifetime_total
        obj.yearly_points = yearly_total
        obj.yearly_year = current_year
        obj.monthly_points = monthly_total
        obj.monthly_year = current_year
        obj.monthly_month = current_month
        obj.save()

        # 6. Sinkronisasi ActivityLog agar konsisten 100% dengan StudentPoints
        try:
            # a. Nol-kan poin pada aktivitas yang bukan perolehan poin gamifikasi global resmi platform
            non_point_types = [
                'lesson_completed', 'lesson_started', 'video_watched', 'video_completed',
                'enrollment', 'question_asked', 'question_answered', 'search_query',
                'content_liked', 'wishlist_added', 'discussion_participated',
                'quiz_attempted', 'quiz_passed', 'quiz_failed', 'points_earned'
            ]
            ActivityLog.objects.filter(
                user=user,
                role_at_time='student',
                activity_type__in=non_point_types,
                points_awarded__gt=0
            ).update(points_awarded=0)

            # Nol-kan seluruh poin MantaType dari ActivityLog
            ActivityLog.objects.filter(
                user=user,
                role_at_time='student'
            ).filter(
                Q(title__icontains='MantaType') |
                Q(description__icontains='MantaType')
            ).update(points_awarded=0)

            # b. Deduplikasi lesson_completed berulang
            lesson_logs = ActivityLog.objects.filter(
                user=user,
                activity_type='lesson_completed'
            ).order_by('activity_date')
            seen_lessons = set()
            for ll in lesson_logs:
                key = (ll.lesson_id or ll.title, ll.course_id)
                if key in seen_lessons:
                    ll.delete()
                else:
                    seen_lessons.add(key)

            # c. Deduplikasi question_asked berulang
            q_logs = ActivityLog.objects.filter(
                user=user,
                activity_type='question_asked'
            ).order_by('activity_date')
            seen_q = set()
            for ql in q_logs:
                q_id = ql.metadata.get('question_id') or ql.metadata.get('qa_id') or ql.title
                if q_id in seen_q:
                    ql.delete()
                else:
                    seen_q.add(q_id)

            # d. Sinkronkan ActivityLog Certificate / Course Completion
            for c_id in valid_cert_courses:
                has_pt = valid_logs.filter(activity_type='course_completion', course_id=c_id).exists()
                c_logs = ActivityLog.objects.filter(
                    user=user,
                    activity_type='certificate_earned',
                    course_id=c_id,
                    role_at_time='student'
                ).order_by('activity_date')
                if c_logs.exists():
                    primary = c_logs.first()
                    pts = 100 if has_pt else 0
                    if primary.points_awarded != pts:
                        primary.points_awarded = pts
                        primary.save(update_fields=['points_awarded'])
                    for red in c_logs[1:]:
                        if red.points_awarded != 0:
                            red.points_awarded = 0
                            red.save(update_fields=['points_awarded'])
                elif has_pt:
                    c_obj = Certificate.objects.filter(user=user, course_id=c_id, is_valid=True).first()
                    c_title = c_obj.course.title if c_obj and c_obj.course else f"Kursus #{c_id}"
                    ActivityLog.objects.create(
                        user=user,
                        activity_type='certificate_earned',
                        role_at_time='student',
                        course_id=c_id,
                        title=f"Raih Sertifikat: {c_title}",
                        description=f"Berhasil meraih sertifikat untuk kursus {c_title}",
                        success=True,
                        points_awarded=100,
                        activity_date=c_obj.date if c_obj else now,
                        metadata={'course_id': c_id}
                    )

            # Nol-kan poin certificate_earned yang tidak lagi memiliki bukti kelulusan valid
            ActivityLog.objects.filter(
                user=user,
                activity_type='certificate_earned',
                role_at_time='student'
            ).exclude(course_id__in=valid_cert_courses).update(points_awarded=0)

            # e. Nol-kan poin ActivityLog Kuis (kuis khusus digunakan di Course Leaderboard, bukan poin global platform)
            ActivityLog.objects.filter(
                user=user,
                activity_type__in=['quiz_passed', 'quiz_attempted', 'quiz_failed'],
                role_at_time='student',
                points_awarded__gt=0
            ).update(points_awarded=0)

            # f. Sinkronkan ActivityLog Ulasan Kursus (+15 Poin)
            for c_id in reviewed_course_ids:
                r_obj = active_course_reviews.filter(course_id=c_id, role='student').first()
                if r_obj:
                    r_logs = ActivityLog.objects.filter(
                        user=user,
                        activity_type='review_posted',
                        course_id=c_id,
                        role_at_time='student'
                    ).order_by('activity_date')
                    if r_logs.exists():
                        primary = r_logs.first()
                        if primary.points_awarded != 15:
                            primary.points_awarded = 15
                            primary.save(update_fields=['points_awarded'])
                        for red in r_logs[1:]:
                            if red.points_awarded != 0:
                                red.points_awarded = 0
                                red.save(update_fields=['points_awarded'])
                    else:
                        c_title = r_obj.course.title if r_obj.course else f"Kursus #{c_id}"
                        ActivityLog.objects.create(
                            user=user,
                            activity_type='review_posted',
                            role_at_time='student',
                            course_id=c_id,
                            title=f"Posting Review: {c_title}",
                            description=f"Memberikan ulasan {r_obj.rating}/5 bintang untuk {c_title}",
                            success=True,
                            points_awarded=15,
                            activity_date=r_obj.date,
                            metadata={'review_id': r_obj.id, 'course_id': c_id, 'rating': r_obj.rating}
                        )

            # Nol-kan ulasan yang dihapus / dinonaktifkan
            ActivityLog.objects.filter(
                user=user,
                activity_type='review_posted',
                role_at_time='student'
            ).exclude(course_id__in=reviewed_course_ids).update(points_awarded=0)

            # g. Sinkronkan ActivityLog Testimoni Platform (+20 Poin)
            if active_testi:
                t_logs = ActivityLog.objects.filter(
                    user=user,
                    activity_type='testimonial_posted',
                    role_at_time='student'
                ).order_by('activity_date')
                if t_logs.exists():
                    primary = t_logs.first()
                    if primary.points_awarded != 20:
                        primary.points_awarded = 20
                        primary.save(update_fields=['points_awarded'])
                    for red in t_logs[1:]:
                        if red.points_awarded != 0:
                            red.points_awarded = 0
                            red.save(update_fields=['points_awarded'])
                else:
                    ActivityLog.objects.create(
                        user=user,
                        activity_type='testimonial_posted',
                        role_at_time='student',
                        title="Kirim Testimoni Platform",
                        description=f"Mengirimkan testimoni platform ({active_testi.rating}/5 bintang)",
                        success=True,
                        points_awarded=20,
                        activity_date=active_testi.date,
                        metadata={'review_id': active_testi.id, 'rating': active_testi.rating}
                    )
            else:
                ActivityLog.objects.filter(
                    user=user,
                    activity_type='testimonial_posted',
                    role_at_time='student'
                ).update(points_awarded=0)

        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Error synchronizing ActivityLog in reconcile_points: {e}")

        return obj


class InstructorPoints(models.Model):
    """
    Tracks instructor ranking points across lifetime, yearly, and monthly periods.
    
    ✨ PHASE 10.1: Ranking system integration
    Points awarded for:
    - Course published: 100 points
    - Student enrollment: 10 points per student
    - Rating received: Variable (from course reviews)
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='instructor_points')
    teacher = models.OneToOneField(Teacher, on_delete=models.CASCADE, related_name='points', null=True, blank=True)
    
    # Lifetime points (never resets)
    lifetime_points = models.IntegerField(default=0, db_index=True)
    lifetime_updated = models.DateTimeField(auto_now=True)
    
    # Yearly points (resets on Jan 1)
    yearly_points = models.IntegerField(default=0)
    yearly_year = models.IntegerField(default=0, help_text="Year for yearly ranking")
    yearly_updated = models.DateTimeField(auto_now=True)
    
    # Monthly points (resets on 1st of month)
    monthly_points = models.IntegerField(default=0)
    monthly_year = models.IntegerField(default=0, help_text="Year for monthly ranking")
    monthly_month = models.IntegerField(default=0, help_text="Month (1-12) for monthly ranking")
    monthly_updated = models.DateTimeField(auto_now=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Instructor Points"
        verbose_name_plural = "Instructor Points"
        ordering = ["-lifetime_points"]
        indexes = [
            models.Index(fields=["-lifetime_points"]),
            models.Index(fields=["-yearly_points"]),
            models.Index(fields=["-monthly_points"]),
        ]
    
    def __str__(self):
        return f"{self.user.full_name or self.user.username} - {self.lifetime_points} points"
    
    @classmethod
    def add_points(cls, user, points, category, **kwargs):
        """
        Add points to an instructor with automatic period bucketing.
        
        Args:
            user: User instance
            points: Number of points to add
            category: Type of point award (course_published, student_enrollment, rating_received, etc.)
            **kwargs: Additional metadata (course_id, description)
        """
        now = timezone.now()
        current_year = now.year
        current_month = now.month
        
        obj, created = cls.objects.get_or_create(user=user)
        
        # Add to all buckets
        obj.lifetime_points += points
        obj.yearly_points += points
        obj.monthly_points += points
        
        # Reset yearly if year has changed
        if obj.yearly_year != current_year:
            obj.yearly_year = current_year
            obj.yearly_points = points
        
        # Reset monthly if month has changed
        if obj.monthly_year != current_year or obj.monthly_month != current_month:
            obj.monthly_year = current_year
            obj.monthly_month = current_month
            obj.monthly_points = points
        
        obj.save()
        
        # Create audit log if needed
        try:
            PointsAuditLog.objects.create(
                user=user,
                points_type='instructor',
                activity_type=category,
                points_awarded=points,
                course_id=kwargs.get('course_id'),
                quiz_id=kwargs.get('quiz_id'),
                review_id=kwargs.get('review_id'),
                description=kwargs.get('description', '')
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Error creating instructor PointsAuditLog: {e}")
        
        return obj
    
    @classmethod
    def reconcile_points(cls, user):
        """
        Recalculate and synchronize InstructorPoints for a user based on valid PointsAuditLog records.
        """
        now = timezone.now()
        obj, _ = cls.objects.get_or_create(user=user)
        
        VALID_ACTS = [
            'course_published',
            'student_enrollment',
            'student_rating',
            'platform_testimonial',
            'student_completion',
            'qa_answer',
            'exam_verification',
        ]
        
        logs = PointsAuditLog.objects.filter(
            user=user,
            points_type='instructor',
            activity_type__in=VALID_ACTS
        )
        
        obj.lifetime_points = sum(l.points_awarded for l in logs)
        obj.yearly_points = sum(l.points_awarded for l in logs.filter(awarded_at__year=now.year))
        obj.yearly_year = now.year
        obj.monthly_points = sum(l.points_awarded for l in logs.filter(awarded_at__year=now.year, awarded_at__month=now.month))
        obj.monthly_year = now.year
        obj.monthly_month = now.month
        obj.save()
        return obj


class PointsAuditLog(models.Model):
    """
    Audit trail for all point awards to track and verify ranking calculations.
    
    ✨ PHASE 10.1: Ranking system integration
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='points_audit_log')
    
    points_type = models.CharField(
        max_length=20,
        choices=[
            ('student', 'Student Points'),
            ('instructor', 'Instructor Points'),
        ],
        help_text='Whether this is StudentPoints or InstructorPoints'
    )
    
    activity_type = models.CharField(
        max_length=30,
        choices=[
            ('course_completion', 'Course Completion'),
            ('quiz_score', 'Quiz Score'),
            ('rating_given', 'Rating Given by Student'),
            ('student_rating', 'Rating Received by Instructor'),
            ('course_published', 'Course Published'),
            ('student_enrollment', 'Student Enrollment'),
            ('platform_testimonial', 'Platform Testimonial'),
            ('mantatype_reward', 'MantaType Game Reward'),
            ('student_completion', 'Student Course Completion'),
            ('qa_answer', 'Q&A Discussion Answer'),
            ('exam_verification', 'Exam Integrity Verification'),
        ]
    )
    
    points_awarded = models.IntegerField()
    
    course_id = models.IntegerField(
        blank=True,
        null=True,
        help_text='Course ID if related to course activity'
    )
    
    quiz_id = models.IntegerField(
        blank=True,
        null=True,
        help_text='Quiz ID if related to quiz'
    )
    
    review_id = models.IntegerField(
        blank=True,
        null=True,
        help_text='Review ID if related to review'
    )
    
    description = models.CharField(
        max_length=500,
        help_text='Human readable explanation of what earned these points'
    )
    
    awarded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'api_pointsauditlog'
        verbose_name = 'Points Audit Log'
        verbose_name_plural = 'Points Audit Logs'
        ordering = ['-awarded_at']
        indexes = [
            models.Index(fields=['user', '-awarded_at'], name='api_pointsa_user_id_f3b453_idx'),
            models.Index(fields=['activity_type', '-awarded_at'], name='api_pointsa_activit_c05845_idx'),
            models.Index(fields=['points_type', '-awarded_at'], name='api_pointsa_points__544663_idx'),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.points_awarded} points ({self.get_activity_type_display()})"


# ==================== ACTIVITY LOG MODELS (PHASE 53) ====================

class ActivityLog(models.Model):
    """✨ PHASE 53: Centralized Activity Logging System
    
    Unified activity tracking for all student/instructor/admin actions.
    Consolidates: VideoProgress, CompletedLesson, QuizAttempt, Certificate,
    SearchLog, QuestionAnswer, ReviewPosted, PointsAwarded, etc.
    
    Benefits:
    - Single dashboard query instead of N model queries
    - Unified filtering, sorting, pagination
    - Better analytics and reporting
    - Easier to add new activity types
    - Cleaner API response structure
    """
    
    ACTIVITY_TYPE_CHOICES = [
        # ✨ PHASE 53+: Student Learning Activities (18 types)
        ('enrollment', 'Pendaftaran Kursus'),
        ('lesson_started', 'Mulai Pelajaran'),
        ('lesson_completed', 'Selesaikan Pelajaran'),
        ('video_watched', 'Tonton Video'),
        ('video_completed', 'Video Selesai (95%+)'),
        ('quiz_attempted', 'Kerjakan Kuis'),
        ('quiz_passed', 'Lulus Kuis'),
        ('quiz_failed', 'Tidak Lulus Kuis'),
        ('certificate_earned', 'Raih Sertifikat'),
        ('course_completed', 'Selesaikan Kursus'),
        ('question_asked', 'Buat Pertanyaan'),
        ('question_answered', 'Jawab Pertanyaan'),
        ('review_posted', 'Posting Review'),
        ('points_earned', 'Dapatkan Poin'),
        ('search_query', 'Cari Kursus'),
        ('content_liked', 'Sukai Konten'),
        ('wishlist_added', 'Simpan Kursus yang Ingin Dipelajari'),
        ('discussion_participated', 'Ikut Diskusi'),
        # ✨ PHASE 53+: Instructor Teaching Activities
        ('course_created', 'Buat Kursus'),
        ('course_updated', 'Update Kursus'),
        ('course_deleted', 'Hapus Kursus'),
        ('course_published', 'Publikasikan Kursus'),
        ('lesson_created', 'Tambah Pelajaran'),
        ('lesson_updated', 'Update Pelajaran'),
        ('lesson_deleted', 'Hapus Pelajaran'),
        ('quiz_created', 'Buat Kuis'),
        ('quiz_updated', 'Update Kuis'),
        ('quiz_deleted', 'Hapus Kuis'),
        ('student_enrolled_manual', 'Daftar Peserta Secara Manual'),
        ('student_unenrolled', 'Hapus Peserta'),
        ('announcement_posted', 'Posting Pengumuman'),
        ('grade_recorded', 'Berikan Nilai'),
        ('exam_verified', 'Pengesahan Integritas Ujian'),
        ('exam_reset', 'Reset Ujian Post-Test'),
        ('grades_exported', 'Ekspor Rekapitulasi Nilai & Pelatihan'),
        ('resource_uploaded', 'Unggah Modul / Berkas Materi'),
        # ✨ Reviews & Testimonials
        ('review_updated', 'Update Review'),
        ('review_deleted', 'Hapus Review'),
        ('testimonial_posted', 'Kirim Testimoni Platform'),
        ('testimonial_updated', 'Update Testimoni Platform'),
        ('testimonial_deleted', 'Hapus Testimoni Platform'),
    ]
    
    ROLE_CHOICES = [
        ('student', 'Peserta'),
        ('instructor', 'Instruktur'),
        ('admin', 'Admin'),
        ('system', 'Sistem'),
    ]
    
    # Primary Fields
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=30, choices=ACTIVITY_TYPE_CHOICES, db_index=True)
    role_at_time = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    
    # Content Context
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True, related_name='activity_logs')
    lesson = models.ForeignKey(VariantItem, on_delete=models.SET_NULL, null=True, blank=True, help_text="Lesson involved in activity")
    quiz = models.ForeignKey(Quiz, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Activity Data
    title = models.CharField(max_length=255, help_text="Human-readable activity title")
    description = models.TextField(blank=True, help_text="Full description of activity")
    
    # Structured Data (JSON for flexibility)
    metadata = models.JSONField(default=dict, blank=True, help_text="Activity-specific data")
    
    # Engagement Metrics
    duration_seconds = models.IntegerField(null=True, blank=True, help_text="How long activity took")
    points_awarded = models.IntegerField(default=0, help_text="Points awarded for this activity")
    
    # Status
    success = models.BooleanField(default=True, help_text="Did activity succeed or fail")
    is_verified = models.BooleanField(default=False, help_text="Has activity been verified")
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    activity_date = models.DateTimeField(default=timezone.now, db_index=True, help_text="When activity occurred")
    
    # Relations
    related_content_id = models.CharField(max_length=100, blank=True, help_text="ID of related content")
    
    class Meta:
        db_table = 'api_activitylog'
        indexes = [
            models.Index(fields=['user', '-activity_date']),
            models.Index(fields=['user', 'activity_type']),
            models.Index(fields=['course', '-activity_date']),
            models.Index(fields=['activity_type', '-activity_date']),
            models.Index(fields=['-activity_date']),
        ]
        ordering = ['-activity_date']
    
    def __str__(self):
        return f"{self.user.username} - {self.get_activity_type_display()} - {self.activity_date.strftime('%Y-%m-%d %H:%M')}"
    
    @property
    def is_recent(self):
        """Activity from today"""
        return self.activity_date.date() == timezone.now().date()
    
    @property
    def is_this_week(self):
        """Activity from this week"""
        return (timezone.now() - self.activity_date).days < 7
    
    @property
    def activity_score(self):
        """Engagement score (0-100) based on activity type"""
        score_map = {
            'course_completed': 100,
            'quiz_passed': 80,
            'lesson_completed': 70,
            'video_completed': 60,
            'question_answered': 50,
            'quiz_attempted': 30,
            'lesson_started': 20,
            'search_query': 5,
        }
        return score_map.get(self.activity_type, 10)


class ActivityFilter(models.Model):
    """✨ PHASE 53: User preferences for activity filtering on Dashboard"""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='activity_filter')
    activity_types = models.JSONField(
        default=list,
        help_text="List of activity types to display"
    )
    include_system_activities = models.BooleanField(default=True)
    include_failed_activities = models.BooleanField(default=False)
    max_activities_display = models.IntegerField(default=10)
    sort_by = models.CharField(
        max_length=20,
        choices=[('date', 'Terbaru'), ('engagement', 'Paling Engaging')],
        default='date'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'api_activityfilter'
    
    def __str__(self):
        return f"{self.user.username} - Activity Preferences"


class ActivityAggregate(models.Model):
    """✨ PHASE 53: Daily/monthly aggregates for analytics"""
    
    PERIOD_CHOICES = [
        ('daily', 'Daily'),
        ('monthly', 'Monthly'),
    ]
    
    date = models.DateField(db_index=True)
    period = models.CharField(max_length=10, choices=PERIOD_CHOICES, db_index=True)
    
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.SET_NULL, null=True, blank=True)
    
    activity_type = models.CharField(max_length=30, choices=ActivityLog.ACTIVITY_TYPE_CHOICES)
    
    count = models.IntegerField(default=0)
    total_points = models.IntegerField(default=0)
    total_duration_seconds = models.IntegerField(default=0)
    success_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'api_activityaggregate'
        indexes = [
            models.Index(fields=['date', 'period']),
            models.Index(fields=['user', 'date']),
            models.Index(fields=['course', 'date']),
        ]
        unique_together = ['date', 'period', 'user', 'course', 'activity_type']
    
    def __str__(self):
        return f"{self.get_period_display()} {self.date} - {self.activity_type}"


# ==================== FEEDBACK MODEL ====================
# ✨ PHASE 11.1: User Feedback System - Allows users to report bugs and request features

FEEDBACK_TYPE_CHOICES = (
    ('bug', 'Bug Report'),
    ('feature', 'Feature Request'),
)

FEEDBACK_STATUS_CHOICES = (
    ('open', 'Terbuka'),
    ('under_review', 'Dalam Tinjauan'),
    ('in_progress', 'Sedang Dikerjakan'),
    ('resolved', 'Diselesaikan'),
    ('wont_fix', 'Tidak Akan Diperbaiki'),
    ('closed', 'Ditutup'),
)

FEEDBACK_PRIORITY_CHOICES = (
    ('low', 'Rendah'),
    ('medium', 'Sedang'),
    ('high', 'Tinggi'),
    ('critical', 'Kritis'),
)

AFFECTED_AREA_CHOICES = (
    ('course', 'Kursus'),
    ('video', 'Video'),
    ('quiz', 'Kuis'),
    ('forum', 'Forum'),
    ('ui', 'Antarmuka Pengguna'),
    ('account', 'Akun'),
    ('other', 'Lainnya'),
)


class Feedback(models.Model):
    """
    ✨ PHASE 11.1: User Feedback Model
    Stores feedback from users (bug reports and feature requests)
    """
    # Requester information
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedbacks')
    
    # Feedback type and content
    feedback_type = models.CharField(
        max_length=20,
        choices=FEEDBACK_TYPE_CHOICES,
        help_text='Type of feedback: bug report or feature request',
        db_index=True
    )
    title = models.CharField(
        max_length=200,
        help_text='Brief summary of the feedback'
    )
    description = models.TextField(
        max_length=5000,
        help_text='Detailed description of the issue or feature request'
    )
    
    # Context
    related_course = models.ForeignKey(
        Course,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='feedback_items',
        help_text='Related course if applicable'
    )
    related_url = models.URLField(
        blank=True,
        null=True,
        help_text='URL where the issue occurred'
    )
    affected_area = models.CharField(
        max_length=20,
        choices=AFFECTED_AREA_CHOICES,
        default='other',
        help_text='Component or area affected',
        db_index=True
    )
    
    # Feedback attachment
    attachments = models.URLField(
        blank=True,
        null=True,
        help_text='Screenshot or document URL'
    )
    
    # Status and priority
    status = models.CharField(
        max_length=20,
        choices=FEEDBACK_STATUS_CHOICES,
        default='open',
        db_index=True,
        help_text='Current status of the feedback'
    )
    priority = models.CharField(
        max_length=20,
        choices=FEEDBACK_PRIORITY_CHOICES,
        default='medium',
        db_index=True,
        help_text='Priority level for resolution'
    )
    
    # ✨ PHASE 11.2: User role at submission time (capture role when feedback is created)
    # This prevents role change from affecting previous feedback submissions
    user_role_at_submission = models.CharField(
        max_length=20,
        choices=USER_ROLE_CHOICES,
        default='student',
        help_text='User role captured at the time feedback was submitted (immutable)',
        editable=False  # Prevent manual editing after creation
    )
    
    # Admin management
    admin_notes = models.TextField(
        blank=True,
        null=True,
        help_text='Internal notes from admins'
    )
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_feedbacks',
        help_text='Admin assigned to handle this feedback'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'api_feedback'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['feedback_type']),
            models.Index(fields=['priority']),
            models.Index(fields=['user']),
        ]
    
    def __str__(self):
        return f"[{self.get_feedback_type_display()}] {self.title} - {self.get_status_display()}"
    
    def get_user_role(self):
        """
        Get the role of the user who submitted feedback
        ✨ PHASE 11.2: Returns the role captured at submission time (immutable)
        This prevents role changes from affecting past feedback submissions
        """
        # Return the stored role from submission time (never changes after creation)
        if self.user_role_at_submission:
            return self.user_role_at_submission
        # Fallback for old records (before migration)
        if self.user:
            if hasattr(self.user, 'current_role') and self.user.current_role:
                return self.user.current_role
            if hasattr(self.user, 'role') and self.user.role:
                return self.user.role
        return 'unknown'


# ==================== UPLOADED FILE MODEL (PENTEST T-02) ====================

class UploadedFile(models.Model):
    """
    Model pelacakan file yang diunggah ke server (Mengatasi Pentest T-02)
    Digunakan untuk memvalidasi kepemilikan file sebelum penghapusan di /api/v1/file-cleanup/
    serta mencegah kerentanan Arbitrary File Deletion / IDOR.
    """
    file_id = ShortUUIDField(
        unique=True,
        length=12,
        max_length=25,
        alphabet="abcdefghijklmnopqrstuvwxyz1234567890",
        help_text="Public identifier for file operations"
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='uploaded_files',
        help_text="User yang mengunggah file"
    )
    file_name = models.CharField(
        max_length=255,
        help_text="Nama asli file dari klien"
    )
    file_path = models.CharField(
        max_length=500,
        help_text="Path relatif penyimpanan di storage (misal: course-file/uuid.png)"
    )
    file_url = models.CharField(
        max_length=1000,
        db_index=True,
        help_text="URL publik file"
    )
    file_size = models.BigIntegerField(
        default=0,
        help_text="Ukuran file dalam bytes"
    )
    file_type = models.CharField(
        max_length=50,
        default='other',
        help_text="Kategori file (image, video, document, other)"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True
    )

    class Meta:
        db_table = 'api_uploadedfile'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['uploaded_by', '-created_at']),
            models.Index(fields=['file_url']),
            models.Index(fields=['file_id']),
        ]

    def __str__(self):
        return f"File {self.file_id} ({self.file_name}) by {self.uploaded_by.username}"



# =====================================================================
# Gamification System: Course Games & Student Attempts
# =====================================================================

class CourseGame(models.Model):
    GAME_TYPE_CHOICES = (
        ('crossword', 'Teka Teki Silang'),
        ('word_search', 'Word Search'),
        ('anagram', 'Anagram'),
        ('memory_match', 'Memory Match'),
    )

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="games")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    game_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    game_type = models.CharField(max_length=30, choices=GAME_TYPE_CHOICES)
    game_data = models.JSONField(default=dict, blank=True, help_text="Konfigurasi game (kata, clue, pairs, dll)")
    max_attempts = models.PositiveIntegerField(default=3)
    points_reward = models.PositiveIntegerField(default=50)
    time_limit_seconds = models.PositiveIntegerField(default=0, help_text="Batas waktu pengerjaan dalam detik (0 = tanpa batas)")
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=1)
    date = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "Course Game"
        verbose_name_plural = "Course Games"
        ordering = ['order', 'date']

    def __str__(self):
        return f"{self.course.title} - {self.get_game_type_display()}: {self.title}"

    def get_user_attempts_count(self, user):
        return self.attempts.filter(user=user).count()

    def can_user_attempt(self, user):
        return self.get_user_attempts_count(user) < self.max_attempts

    def get_user_best_attempt(self, user):
        return self.attempts.filter(user=user).order_by('-score', 'time_taken').first()


class CourseGameAttempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="game_attempts")
    game = models.ForeignKey(CourseGame, on_delete=models.CASCADE, related_name="attempts")
    attempt_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    attempt_number = models.PositiveIntegerField(default=1)
    score = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)  # Skala 0 - 100
    is_passed = models.BooleanField(default=False)
    time_taken = models.PositiveIntegerField(default=0, help_text="Waktu pengerjaan dalam detik")
    answers_data = models.JSONField(default=dict, blank=True)
    points_awarded = models.PositiveIntegerField(default=0)
    date_attempted = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = "Course Game Attempt"
        verbose_name_plural = "Course Game Attempts"
        ordering = ['-date_attempted']

    def __str__(self):
        return f"{self.user.username} - {self.game.title} - Attempt #{self.attempt_number} ({self.score}%)"


# =====================================================================
# 🎮 MantaType Arcade Typing Game Models
# =====================================================================

class MantaTypeLeaderboard(models.Model):
    """
    Papan peringkat (Ranked Top 10) Game MantaType arcade.
    Mendukung pencatatan pemain terautentikasi (LMS user) maupun guest (arcade initials).
    """
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="mantatype_scores")
    player_name = models.CharField(max_length=60, help_text="Nama tampilan pemain (Guest atau akun LMS)")
    avatar_url = models.CharField(max_length=500, blank=True, null=True, help_text="URL avatar pemain jika ada")
    score = models.PositiveIntegerField(default=0, db_index=True)
    words_typed = models.PositiveIntegerField(default=0)
    accuracy = models.DecimalField(max_digits=5, decimal_places=2, default=100.00)
    wpm = models.PositiveIntegerField(default=0)
    wave_reached = models.PositiveIntegerField(default=1)
    is_guest = models.BooleanField(default=False)
    season_number = models.PositiveIntegerField(default=1, db_index=True, help_text="Nomor musim saat skor dicatat")
    season_label = models.CharField(max_length=60, blank=True, default="", help_text="Label musim, misal: Musim Triwulan IV 2026")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        verbose_name = "MantaType Leaderboard"
        verbose_name_plural = "MantaType Leaderboard"
        ordering = ['-score', '-accuracy', '-wpm', 'created_at']

    def __str__(self):
        return f"{self.player_name} - Skor: {self.score} (Wave {self.wave_reached})"


class MantaTypeDailyReward(models.Model):
    """
    🎁 Catatan Klaim Bonus XP Harian MantaType Arcade
    Menghubungkan pencapaian MantaType dengan sistem perolehan poin (StudentPoints),
    jenjang kompetensi (Leveling ASN), dan profil pegawai LMS Setjen DPD RI.
    Dibatasi 1 kali klaim per hari kalender per pengguna.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="mantatype_daily_rewards")
    claim_date = models.DateField(default=timezone.now, db_index=True)
    points_awarded = models.PositiveIntegerField(default=50)
    score = models.PositiveIntegerField(default=0)
    words_typed = models.PositiveIntegerField(default=0)
    accuracy = models.DecimalField(max_digits=5, decimal_places=2, default=100.00)
    wpm = models.PositiveIntegerField(default=0)
    wave_reached = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Klaim Reward Harian MantaType"
        verbose_name_plural = "Klaim Reward Harian MantaType"
        unique_together = ('user', 'claim_date')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.points_awarded} XP ({self.claim_date})"


class MantaTypeSetting(models.Model):
    """
    ⚙️ Pengaturan Global & Jam Operasional MantaType Arcade
    Dapat diatur langsung oleh Admin di https://lms.dpd.go.id/admin/system/
    """
    is_enabled = models.BooleanField(default=True, help_text="Status aktif MantaType secara global")
    restrict_to_break_hours = models.BooleanField(
        default=True, 
        help_text="Batasi akses MantaType hanya di luar jam kerja (jam istirahat & di luar jam kantor)"
    )
    work_start = models.TimeField(default=datetime.time(8, 0), help_text="Jam mulai jam dinas kantor")
    break_start = models.TimeField(default=datetime.time(12, 0), help_text="Jam mulai istirahat siang")
    break_end = models.TimeField(default=datetime.time(13, 0), help_text="Jam selesai istirahat siang")
    after_work_start = models.TimeField(default=datetime.time(16, 30), help_text="Jam selesai jam dinas kantor")
    allow_weekend = models.BooleanField(default=True, help_text="Izinkan akses bebas 24 jam pada hari Sabtu dan Minggu")
    daily_play_limit = models.PositiveIntegerField(default=5, help_text="Batas sesi bermain harian per pengguna (0 jika tanpa batas)")
    offline_custom_message = models.TextField(
        blank=True, 
        null=True, 
        default="Saat ini MantaType sedang tidak dapat diakses sesuai jadwal jam kerja kedinasan.",
        help_text="Pesan ramah jika MantaType sedang di luar jam operasional"
    )
    # 🏆 Reset Musim Papan Peringkat (Per 3 Bulan / Triwulan)
    auto_season_reset = models.BooleanField(
        default=True,
        help_text="Reset otomatis papan peringkat setiap pergantian musim 3 bulan (Triwulan)"
    )
    season_interval_months = models.PositiveIntegerField(
        default=3,
        help_text="Durasi periode musim dalam bulan (default: 3 bulan)"
    )
    last_season_reset_at = models.DateTimeField(
        null=True, 
        blank=True, 
        help_text="Waktu pencatatan reset musim terakhir"
    )
    season_number = models.PositiveIntegerField(
        default=1,
        help_text="Nomor musim kompetisi MantaType saat ini"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Pengaturan MantaType"
        verbose_name_plural = "Pengaturan MantaType"

    def __str__(self):
        return f"Pengaturan MantaType (Aktif: {self.is_enabled})"

    @classmethod
    def get_settings(cls):
        settings_obj, _ = cls.objects.get_or_create(id=1)
        return settings_obj


class MantaTypeWord(models.Model):
    """
    📚 Bank Kosakata Dinamis MantaType Arcade
    Dapat dikelola (CRUD & Bulk Import) oleh Admin
    """
    DIFFICULTY_CHOICES = (
        ('easy', 'Wave 1: Mudah (3-4 Huruf)'),
        ('medium', 'Wave 2-3: Menengah (5-7 Huruf)'),
        ('hard', 'Wave 4+: Mahir (8+ Huruf)'),
    )

    CATEGORY_CHOICES = (
        ('berakhlak', 'Core Values BerAKHLAK'),
        ('keparlemenan', 'Keparlemenan DPD RI'),
        ('lms', 'LMS & Literasi Digital'),
        ('umum', 'Kosakata Umum / Budaya Kerja'),
    )

    word = models.CharField(max_length=60, unique=True, db_index=True, help_text="Kata utuh tanpa spasi")
    difficulty = models.CharField(max_length=15, choices=DIFFICULTY_CHOICES, default='easy', db_index=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='umum')
    meaning = models.CharField(max_length=255, blank=True, null=True, help_text="Penjelasan/arti edukatif singkat")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Kosakata MantaType"
        verbose_name_plural = "Bank Kosakata MantaType"
        ordering = ['difficulty', 'word']

    def clean(self):
        if self.word:
            self.word = self.word.strip().replace(' ', '').upper()

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.word} ({self.difficulty}) - {self.category}"


class SystemRelease(models.Model):
    """
    ✨ System Versioning & Update Log (Release Notes)
    Tracks version bumps, release titles, dates, categorized changes, and historical logs
    for LMSetjen DPD RI.
    """
    VERSION_TYPE_CHOICES = (
        ('major', 'Major Update'),
        ('minor', 'Minor Update'),
        ('patch', 'Patch / Perbaikan'),
    )

    version = models.CharField(max_length=50, unique=True, db_index=True, help_text="Nomor versi (misal: 1.0.2)")
    title = models.CharField(max_length=255, help_text="Judul rilis atau ringkasan pembaruan")
    version_type = models.CharField(max_length=20, choices=VERSION_TYPE_CHOICES, default='patch')
    release_date = models.DateTimeField(default=timezone.now, db_index=True)
    is_current = models.BooleanField(default=False, db_index=True, help_text="Menandai apakah ini versi aktif LMS saat ini")
    summary = models.TextField(blank=True, default="", help_text="Ringkasan pembaruan yang dapat dibaca pengguna")
    changes = models.JSONField(
        default=list, 
        blank=True, 
        help_text="Daftar item pembaruan [{'category': 'feature'|'improvement'|'bugfix'|'security'|'ui', 'title': '', 'description': '', 'module': ''}]"
    )
    raw_notes = models.TextField(blank=True, default="", help_text="Catatan rilis teknis atau format teks/markdown")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_releases")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-release_date', '-created_at']
        verbose_name = "System Release & Update Log"
        verbose_name_plural = "System Releases & Update Logs"

    def __str__(self):
        return f"v{self.version} - {self.title} ({'Versi Aktif' if self.is_current else 'Riwayat'})"

    def save(self, *args, **kwargs):
        if self.is_current:
            # Pastikan versi aktif lainnya dinonaktifkan
            SystemRelease.objects.filter(is_current=True).exclude(pk=self.pk).update(is_current=False)

            # Sinkronkan file root VERSION
            try:
                import os
                base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                version_file = os.path.join(base_dir, "VERSION")
                with open(version_file, "w", encoding="utf-8") as f:
                    f.write(self.version.strip())
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to sync VERSION file: {e}")

            # Sinkronkan juga file frontend/src/utils/version.js
            try:
                import os, re
                base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                fe_version_file = os.path.join(base_dir, "frontend", "src", "utils", "version.js")
                if os.path.exists(fe_version_file):
                    with open(fe_version_file, "r", encoding="utf-8") as f:
                        fe_content = f.read()
                    new_fe_content = re.sub(
                        r'export const APP_VERSION = "[^"]+";',
                        f'export const APP_VERSION = "{self.version.strip()}";',
                        fe_content
                    )
                    with open(fe_version_file, "w", encoding="utf-8") as f:
                        f.write(new_fe_content)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to sync frontend version.js: {e}")

        super().save(*args, **kwargs)


# ============================================================================
# FORUM PEMBELAJARAN (COMMUNITY OF PRACTICE / RUMPUN JABATAN & KOMPETENSI)
# ============================================================================

class ForumCategory(models.Model):
    """
    Rumpun Jabatan / Rumpun Kompetensi / Kategori Forum Pembelajaran
    """
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150, unique=True)
    description = models.TextField(null=True, blank=True)
    icon = models.CharField(max_length=100, default='fas fa-comments', help_text="FontAwesome icon class")
    badge_color = models.CharField(max_length=50, default='#0d9488', help_text="Badge color hex or CSS class")
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name = "Forum Category"
        verbose_name_plural = "Forum Categories"

    def __str__(self):
        return self.name

    @property
    def topics_count(self):
        return self.topics.count()

    @property
    def posts_count(self):
        return ForumTopicMessage.objects.filter(topic__category=self).count()


class ForumTopic(models.Model):
    """
    Topik / Thread Diskusi dalam Forum Pembelajaran
    """
    topic_id = ShortUUIDField(unique=True, length=8, max_length=25, alphabet="1234567890abcdef")
    category = models.ForeignKey(ForumCategory, on_delete=models.CASCADE, related_name='topics')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='forum_topics')
    title = models.CharField(max_length=500)
    content = models.TextField()
    views_count = models.PositiveIntegerField(default=0)
    is_pinned = models.BooleanField(default=False, help_text="Pinned topic will appear at the top")
    is_solved = models.BooleanField(default=False, help_text="Marked as solved when an answer resolves the question")
    is_locked = models.BooleanField(default=False, help_text="Locked topic cannot receive new replies")
    FORUM_VISIBILITY_CHOICES = (
        ('public', 'Publik (Semua Pengguna)'),
        ('internal_setjen', 'Khusus Pegawai Setjen DPD RI'),
    )
    visibility = models.CharField(
        max_length=30,
        choices=FORUM_VISIBILITY_CHOICES,
        default='public',
        db_index=True,
        help_text="Visibilitas topik: publik atau khusus internal Setjen DPD RI"
    )
    file = models.FileField(upload_to="forum_attachments/", null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-updated_at', '-created_at']
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['topic_id']),
            models.Index(fields=['is_pinned']),
            models.Index(fields=['is_solved']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"[{self.category.name}] {self.title}"

    @property
    def replies_count(self):
        return self.replies.count()

    @property
    def likes_count(self):
        return self.likes.count()

    @property
    def bookmarks_count(self):
        return self.bookmarks.count()


class ForumTopicMessage(models.Model):
    """
    Tanggapan / Balasan pesan pada Topik Forum Pembelajaran
    """
    message_id = ShortUUIDField(unique=True, length=8, max_length=25, alphabet="1234567890abcdef")
    topic = models.ForeignKey(ForumTopic, on_delete=models.CASCADE, related_name='replies')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='forum_replies')
    message = models.TextField()
    is_solution = models.BooleanField(default=False, help_text="Designated as the accepted answer/solution")
    file = models.FileField(upload_to="forum_attachments/", null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['topic']),
            models.Index(fields=['is_solution']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Reply to {self.topic.title} by {self.user.username if self.user else 'Anonim'}"

    @property
    def likes_count(self):
        return self.likes.count()

    @property
    def bookmarks_count(self):
        return self.bookmarks.count()


class ForumTopicLike(models.Model):
    """
    Like tracker untuk Topik Forum Pembelajaran
    """
    topic = models.ForeignKey(ForumTopic, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forum_topic_likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('topic', 'user')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} liked topic {self.topic.topic_id}"


class ForumTopicMessageLike(models.Model):
    """
    Like tracker untuk Balasan Topik Forum Pembelajaran
    """
    message = models.ForeignKey(ForumTopicMessage, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forum_message_likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('message', 'user')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} liked message {self.message.message_id}"


class ForumTopicBookmark(models.Model):
    """
    Bookmark / Simpan Topik Favorit Forum Pembelajaran oleh Pengguna
    """
    topic = models.ForeignKey(ForumTopic, on_delete=models.CASCADE, related_name='bookmarks')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forum_topic_bookmarks')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('topic', 'user')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} bookmarked topic {self.topic.topic_id}"


class ForumReport(models.Model):
    """
    Pelaporan topik atau balasan forum yang melanggar etika ASN, spam, atau hoaks
    """
    REPORT_REASON_CHOICES = (
        ('spam', 'Spam / Iklan Tidak Relevan'),
        ('inappropriate', 'Bahasa Tidak Pantas / Pelanggaran Etika ASN'),
        ('misleading', 'Informasi Menyesatkan / Hoaks'),
        ('harassment', 'Pelecehan / Ujaran Kebencian'),
        ('other', 'Lainnya'),
    )
    REPORT_STATUS_CHOICES = (
        ('pending', 'Menunggu Tinjauan'),
        ('reviewed', 'Telah Ditinjau'),
        ('resolved', 'Terselesaikan (Tindakan Diambil)'),
        ('dismissed', 'Ditolak (Tidak Melanggar)'),
    )
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forum_reports_filed')
    topic = models.ForeignKey(ForumTopic, on_delete=models.CASCADE, null=True, blank=True, related_name='reports')
    message = models.ForeignKey(ForumTopicMessage, on_delete=models.CASCADE, null=True, blank=True, related_name='reports')
    reason = models.CharField(max_length=50, choices=REPORT_REASON_CHOICES)
    description = models.TextField(null=True, blank=True, help_text="Catatan atau rincian tambahan dari pelapor")
    status = models.CharField(max_length=20, choices=REPORT_STATUS_CHOICES, default='pending')
    admin_notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        target = f"Topik #{self.topic.topic_id}" if self.topic else f"Balasan #{self.message.message_id}"
        return f"Laporan {self.get_reason_display()} pada {target} oleh {self.reporter.username}"


class ForumPoll(models.Model):
    """
    Mini-polling / Jajak Pendapat yang terpasang pada Topik Forum Pembelajaran
    """
    topic = models.OneToOneField(ForumTopic, on_delete=models.CASCADE, related_name='poll')
    question = models.CharField(max_length=500, help_text="Pertanyaan jajak pendapat")
    is_closed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Poll for Topic {self.topic.topic_id}: {self.question}"

    @property
    def total_votes(self):
        return ForumPollVote.objects.filter(poll=self).count()


class ForumPollOption(models.Model):
    """
    Opsi pilihan pada Mini-polling
    """
    poll = models.ForeignKey(ForumPoll, on_delete=models.CASCADE, related_name='options')
    option_text = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.option_text

    @property
    def votes_count(self):
        return self.votes.count()


class ForumPollVote(models.Model):
    """
    Pencatatan suara pemilih (1 suara per user per poll)
    """
    poll = models.ForeignKey(ForumPoll, on_delete=models.CASCADE, related_name='votes')
    option = models.ForeignKey(ForumPollOption, on_delete=models.CASCADE, related_name='votes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='forum_poll_votes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('poll', 'user')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} voted on poll {self.poll.id}"



# Connect the signals
post_save.connect(sync_teacher_with_profile, sender=Teacher)
post_save.connect(track_course_click, sender=SearchLog)
post_save.connect(update_search_taxonomy, sender=SearchLog)
