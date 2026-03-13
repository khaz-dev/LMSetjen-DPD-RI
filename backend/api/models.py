from django.db import models
from django.utils.text import slugify
from django.utils import timezone
from django.db.models.signals import post_save
from django.contrib.postgres.search import SearchVectorField
from django.contrib.postgres.indexes import GinIndex

from userauths.models import User, Profile
from shortuuid.django_fields import ShortUUIDField
try:
    from moviepy.editor import VideoFileClip
except ImportError:
    VideoFileClip = None  # Fallback if moviepy not installed
import math

LEVEL = (
    ("Beginner", "Beginner"),
    ("Intermediate", "Intermediate"),
    ("Advanced", "Advanced"),
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
            
class Course(models.Model):
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, blank=True, null=True)
    file = models.URLField(max_length=500, blank=True, null=True)  # Changed to URLField for file-upload API
    image = models.URLField(max_length=500, blank=True, null=True)  # Changed to URLField for file-upload API
    title = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(null=True, blank=True)
    level = models.CharField(choices=LEVEL, default="Beginner", max_length=100, blank=True, null=True)
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
    # Used to restore published course if instructor makes mistakes during edit
    # Format: {"title": "...", "description": "...", "image": "...", etc}
    published_snapshot = models.JSONField(
        null=True,
        blank=True,
        help_text="JSON snapshot of course state when published (for restore functionality)"
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

    def students(self):
        return EnrolledCourse.objects.filter(course=self)
    
    def curriculum(self):
        return Variant.objects.filter(course=self)
    
    def lectures(self):
        return VariantItem.objects.filter(variant__course=self)
    
    def average_rating(self):
        average_rating = Review.objects.filter(course=self, active=True).aggregate(avg_rating=models.Avg('rating'))
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
        Called when course is first published or when published changes are approved
        
        Used for restore functionality - allows instructors to undo changes
        if they make mistakes while editing a published course
        """
        self.published_snapshot = {
            "title": self.title,
            "description": self.description,
            "level": self.level,
            "image": self.image,
            "file": self.file,
            "featured": self.featured,
            "category_id": self.category.id if self.category else None,
        }
        self.save()
    
    def restore_from_published_snapshot(self):
        """
        ✨ PHASE 4.72: Restore course to its last published state from snapshot
        
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
                pass  # Keep existing category if not found
        
        # Reset status back to Published (it was changed to Review during edit)
        self.platform_status = "Published"
        
        self.save()
        return True
    
    def _copy_content_to(self, target_course, clear_target=True):
        """
        ✨ PHASE 4.74: Enhanced method to copy ALL course-related content to target course.
        ✨ PHASE 4.77 FIXED: Now also copies course metadata (image, title, description, level, etc.)
        
        Copies: course metadata + curriculum, features, requirements, learning outcomes, AND quizzes with questions/choices
        Used by: submit_for_publication, admin approval, restore operations
        
        This is the PRIMARY method for versioning - ensures complete content sync
        
        Args:
            target_course: The course to copy content to
            clear_target: If True, delete all existing content in target before copying (prevents duplicates)
        """
        from django.db import transaction
        
        with transaction.atomic():
            print(f"[Content Copy] Starting copy from {self.title} to {target_course.title}")
            
            # ✨ PHASE 4.77 FIXED: Copy core course metadata first
            print(f"[Content Copy] Syncing course metadata (title, description, image, level, etc.)...")
            target_course.title = self.title
            target_course.description = self.description
            target_course.level = self.level
            target_course.image = self.image
            target_course.file = self.file
            target_course.featured = self.featured
            target_course.save()
            print(f"[Content Copy] [OK] Course metadata synced")
            
            # ✨ PHASE 4.77: Clear existing content BEFORE copying to prevent duplicates
            if clear_target:
                print(f"[Content Copy] Clearing existing content from target course...")
                target_course.curriculum.all().delete()
                target_course.quizzes.all().delete()
                target_course.features.all().delete()
                target_course.requirements.all().delete()
                target_course.learning_outcomes.all().delete()
                print(f"[Content Copy] [OK] Target course content cleared")
            
            try:
                # STEP 1: Copy curriculum variants (Bagian)
                print("[Content Copy] Copying curriculum sections (Bagian)...")
                variant_map = {}  # Map old variant IDs to new ones
                for variant in self.curriculum.all():
                    new_variant = Variant.objects.create(
                        course=target_course,
                        title=variant.title,
                        order=variant.order,
                    )
                    variant_map[variant.id] = new_variant
                    
                    # Copy variant items (Pelajaran - lessons)
                    print(f"[Content Copy] Copying lessons for section: {variant.title}")
                    for item in variant.variant_items.all():
                        new_item = VariantItem.objects.create(
                            variant=new_variant,
                            title=item.title,
                            description=item.description,
                            file=item.file,
                            duration=item.duration,
                            preview=item.preview,
                            order=item.order,
                        )
                        
                        # ✨ NEW FIX: Copy lesson completion questions (Pertanyaan Penyelesaian Pelajaran)
                        if hasattr(item, 'completion_question') and item.completion_question:
                            original_question = item.completion_question
                            print(f"[Content Copy] Copying completion question for lesson: {item.title}")
                            
                            # Create new completion question linked to new variant item
                            new_question = LessonCompletionQuestion.objects.create(
                                variant_item=new_item,
                                question_text=original_question.question_text,
                                question_type=original_question.question_type,
                                correct_answer_text=original_question.correct_answer_text,
                                case_sensitive=original_question.case_sensitive,
                            )
                            
                            # Copy all question choices (for multiple choice/multi-select)
                            for choice in original_question.choices.all():
                                LessonCompletionQuestionChoice.objects.create(
                                    question=new_question,
                                    choice_text=choice.choice_text,
                                    is_correct=choice.is_correct,
                                    order=choice.order,
                                )
                            
                            print(f"[Content Copy] [OK] Copied completion question with {original_question.choices.count()} choices")
                    
                    print(f"[Content Copy] [OK] Copied {variant.variant_items.count()} lessons (including completion questions)")
                
                print(f"[Content Copy] [OK] Copied {len(variant_map)} curriculum sections")
                
                # STEP 2: Copy quizzes (Kuis) with all questions and choices
                print("[Content Copy] Copying quizzes (Kuis) with questions and choices...")
                quiz_map = {}  # Map old quiz IDs to new ones
                for quiz in self.quizzes.all():
                    new_quiz = Quiz.objects.create(
                        course=target_course,
                        title=quiz.title,
                        description=quiz.description,
                        is_active=quiz.is_active,
                    )
                    quiz_map[quiz.id] = new_quiz
                    
                    # Copy quiz questions and their choices
                    print(f"[Content Copy] Copying questions for quiz: {quiz.title}")
                    question_map = {}
                    for question in quiz.questions.all():
                        new_question = QuizQuestion.objects.create(
                            quiz=new_quiz,
                            question_text=question.question_text,
                            order=question.order,
                        )
                        question_map[question.id] = new_question
                        
                        # Copy quiz choices (answers) for this question
                        for choice in question.choices.all():
                            QuizChoice.objects.create(
                                question=new_question,
                                choice_text=choice.choice_text,
                                is_correct=choice.is_correct,
                                order=choice.order,
                            )
                    
                    print(f"[Content Copy] [OK] Copied {quiz.questions.count()} questions with choices")
                
                print(f"[Content Copy] [OK] Copied {len(quiz_map)} quizzes")
                
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
                self.platform_status = "Published"
                self.save()
            
            print(f"[Restore] [DONE] Course successfully restored to published state")
            return True, "Kursus berhasil dikembalikan ke versi yang dipublikasikan"
    
    def rating_count(self):
        return Review.objects.filter(course=self, active=True).count()
    
    def reviews(self):
        return Review.objects.filter(course=self, active=True)
    
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
    variant = models.ForeignKey(Variant, on_delete=models.CASCADE, related_name="variant_items")
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
        """Determine file type based on URL extension"""
        if not self.file:
            return "unknown"
        
        file_url = self.file.lower()
        if any(ext in file_url for ext in ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.ogg']):
            return "video"
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
            "pdf": "fas fa-file-pdf",
            "document": "fas fa-file-word",
            "presentation": "fas fa-file-powerpoint",
            "image": "fas fa-image",
            "file": "fas fa-file"
        }
        return icon_map.get(file_type, "fas fa-file")
    
    def clean(self):
        """✨ PHASE 4.170: Validate that duration is cleared when file is empty"""
        from django.core.exceptions import ValidationError
        
        # If file is empty, duration should also be empty
        if not self.file and self.duration:
            raise ValidationError({
                'duration': 'Durasi harus kosong ketika File field kosong. Silakan bersihkan field durasi.',
            })
    
    def save(self, *args, **kwargs):
        # ✨ PHASE 4.170: Auto-clear duration when file is removed
        if not self.file:
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
        """
        if self.question_type in ['short_answer', 'fill_in_blank']:
            correct_text = self.correct_answer_text.strip()
            student_text = student_answer.strip()
            
            if not self.case_sensitive:
                correct_text = correct_text.lower()
                student_text = student_text.lower()
            
            return student_text == correct_text
        
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

    def __str__(self):
        return f"{self.user.username} - {self.course.title}"
    
    class Meta:
        ordering = ['-date']

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
    
class CompletedLesson(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    variant_item = models.ForeignKey(VariantItem, on_delete=models.CASCADE)
    date = models.DateTimeField(default=timezone.now)

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
    
class EnrolledCourse(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True)
    # Removed order_item reference to CartOrderItem
    enrollment_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.course.title
    
    def lectures(self):
        return VariantItem.objects.filter(variant__course=self.course)
    
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
        """Calculate completion percentage for this enrollment"""
        total_lessons = self.lectures().count()
        completed_lessons = self.completed_lesson().count()
        
        if total_lessons == 0:
            return 100  # No lessons means 100% complete
        
        return min(100, (completed_lessons / total_lessons) * 100)
    
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
    
    def are_all_quizzes_passed(self):
        """Check if all quizzes are passed with 70% or higher"""
        quiz_results = self.quiz_results()
        
        if not quiz_results:
            return True  # No quizzes means requirement is met
        
        return all(result['passed'] and result['percentage'] >= 70 for result in quiz_results)
    
    def is_certificate_eligible(self):
        """Check if user is eligible for certificate"""
        return self.is_course_completed() and self.are_all_quizzes_passed()
    
    def get_or_create_certificate(self):
        """Get existing certificate or create new one if eligible"""
        if not self.is_certificate_eligible():
            return None, False
        
        certificate, created = Certificate.objects.get_or_create(
            course=self.course,
            user=self.user,
            enrollment=self,
            defaults={'is_valid': True}
        )
        return certificate, created
    
class Note(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    title = models.CharField(max_length=1000, null=True, blank=True)
    note = models.TextField()
    color = models.CharField(max_length=10, default="#f39c12", help_text="Hex color code for the note")
    note_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    # ✨ PHASE 11.160: Optional lesson/section context for notes
    variant = models.ForeignKey('Variant', on_delete=models.SET_NULL, null=True, blank=True, help_text="Course section (bagian) this note relates to")
    variant_item = models.ForeignKey('VariantItem', on_delete=models.SET_NULL, null=True, blank=True, help_text="Lesson (pelajaran) this note relates to")
    date = models.DateTimeField(default=timezone.now)   

    def __str__(self):
        return self.title
    
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
    # Removed order and order_item references
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
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="quizzes")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    quiz_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
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

    class Meta:
        ordering = ['-date_attempted']

    def __str__(self):
        return f"{self.user.full_name} - {self.quiz.title} - {self.score}%"

    @property
    def pass_status(self):
        return "PASSED" if self.is_passed else "FAILED"

    def save(self, *args, **kwargs):
        # Calculate if passed (score >= 70%)
        from decimal import Decimal
        self.is_passed = Decimal(str(self.score)) >= Decimal('70.00')
        super().save(*args, **kwargs)

    @classmethod
    def get_daily_attempts_count(cls, user, quiz, date=None):
        """Get the number of attempts by a user for a specific quiz on a given date"""
        if date is None:
            date = timezone.now().date()
        
        return cls.objects.filter(
            user=user,
            quiz=quiz,
            date_attempted__date=date
        ).count()

    @classmethod
    def can_attempt_quiz(cls, user, quiz):
        """Check if user can attempt the quiz (max 3 attempts per day)"""
        today = timezone.now().date()
        attempts_today = cls.get_daily_attempts_count(user, quiz, today)
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
    - Quiz passed: 0-100 points (based on score %)
    - Course rating: 50 points
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
                points=points,
                category=category,
                role='student',
                metadata=kwargs
            )
        except:
            pass  # Audit logging is optional
        
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
                points=points,
                category=category,
                role='instructor',
                metadata=kwargs
            )
        except:
            pass  # Audit logging is optional
        
        return obj


class PointsAuditLog(models.Model):
    """
    Audit trail for all point awards to track and verify ranking calculations.
    
    ✨ PHASE 10.1: Ranking system integration
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='points_audit_logs')
    points = models.IntegerField()
    category = models.CharField(
        max_length=50,
        choices=[
            ('course_completion', 'Course Completion'),
            ('quiz_score', 'Quiz Score'),
            ('rating_given', 'Rating Given'),
            ('course_published', 'Course Published'),
            ('student_enrollment', 'Student Enrollment'),
            ('testimonial_given', 'Testimonial Given'),
            ('manual_adjustment', 'Manual Adjustment'),
        ],
        default='manual_adjustment'
    )
    role = models.CharField(
        max_length=20,
        choices=[('student', 'Student'), ('instructor', 'Instructor')]
    )
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'api_pointsauditlog'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['category', '-created_at']),
            models.Index(fields=['role']),
        ]
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.points} points ({self.get_category_display()})"


# Connect the signals
post_save.connect(sync_teacher_with_profile, sender=Teacher)
post_save.connect(track_course_click, sender=SearchLog)
post_save.connect(update_search_taxonomy, sender=SearchLog)