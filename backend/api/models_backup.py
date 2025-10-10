# Enhanced PostgreSQL-Optimized Models for LMS System
from django.db import models
from django.utils.text import slugify
from django.utils import timezone
from django.db.models.signals import post_save
from django.contrib.postgres.fields import JSONField, ArrayField
from django.contrib.postgres.indexes import GinIndex, BTreeIndex, HashIndex
from django.contrib.postgres.search import SearchVectorField, SearchVector
from django.core.cache import cache
from django.db.models import Q, Avg, Count, Sum, F
from django.db.models.functions import Coalesce

from userauths.models import User, Profile
from shortuuid.django_fields import ShortUUIDField
from moviepy.editor import VideoFileClip
import math
import random
from decimal import Decimal

# Constants - removed PAYMENT_STATUS as all courses are free
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

NOTI_TYPE = (
    ("New Review", "New Review"),
    ("New Course Question", "New Course Question"),
    ("Draft", "Draft"),
    ("Course Published", "Course Published"),
    ("Course Enrollment Completed", "Course Enrollment Completed"),
)

class BaseModel(models.Model):
    """Base model with common fields and optimizations"""
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)
    
    class Meta:
        abstract = True
        
    def save(self, *args, **kwargs):
        """Clear relevant cache on save"""
        super().save(*args, **kwargs)
        self.clear_cache()
    
    def clear_cache(self):
        """Override in subclasses to clear specific cache keys"""
        pass

class Teacher(BaseModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, db_index=True)
    image = models.URLField(max_length=500, default="default-user.jpg", null=True, blank=True)
    full_name = models.CharField(max_length=100, db_index=True)
    bio = models.CharField(max_length=500, null=True, blank=True)
    social_links = JSONField(default=dict, help_text="Store social media links as JSON")
    about = models.TextField(null=True, blank=True)
    country = models.CharField(max_length=100, null=True, blank=True, db_index=True)
    
    # Performance tracking fields
    total_students = models.PositiveIntegerField(default=0, db_index=True)
    total_courses = models.PositiveIntegerField(default=0, db_index=True)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00, db_index=True)
    
    # Full-text search
    search_vector = SearchVectorField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['country', 'average_rating']),
            GinIndex(fields=['search_vector']),
            models.Index(fields=['total_students', 'total_courses']),
        ]
        db_table = 'api_teacher'

    def __str__(self):
        return self.full_name

    @classmethod
    def create_from_profile(cls, user):
        """Create a Teacher instance from an existing Profile."""
        try:
            profile = Profile.objects.get(user=user)
            teacher, created = cls.objects.get_or_create(
                user=user,
                defaults={
                    'image': profile.image.url if profile.image else "default-user.jpg",
                    'full_name': profile.full_name,
                    'country': profile.country,
                    'about': profile.about,
                    'bio': '',
                }
            )
            return teacher
        except Profile.DoesNotExist:
            raise ValueError(f"No Profile exists for user {user}")

    @classmethod
    def get_top_teachers(cls, limit=10):
        """Get top teachers by rating and student count"""
        cache_key = f"top_teachers_{limit}"
        teachers = cache.get(cache_key)
        if not teachers:
            teachers = cls.objects.filter(
                total_students__gt=0
            ).order_by('-average_rating', '-total_students')[:limit]
            cache.set(cache_key, teachers, 3600)  # Cache for 1 hour
        return teachers
    
    def update_stats(self):
        """Update teacher statistics"""
        self.total_courses = Course.objects.filter(teacher=self, platform_status='Published').count()
        self.total_students = EnrolledCourse.objects.filter(course__teacher=self).values('user').distinct().count()
        
        avg_rating = Review.objects.filter(
            course__teacher=self, active=True
        ).aggregate(avg=Avg('rating'))['avg']
        self.average_rating = avg_rating or 0.00
        
        self.save(update_fields=['total_courses', 'total_students', 'average_rating'])
    
    def students(self):
        """Get enrolled students for this teacher"""
        return EnrolledCourse.objects.filter(course__teacher=self)
    
    def courses(self):
        """Get courses for this teacher"""
        return Course.objects.filter(teacher=self)
    
    def review_count(self):
        """Get total review count for this teacher"""
        return Review.objects.filter(course__teacher=self, active=True).count()
    
    def clear_cache(self):
        cache.delete_many([
            f"teacher_profile_{self.id}",
            f"teacher_courses_{self.id}",
            "top_teachers_10"
        ])
    
class Category(BaseModel):
    title = models.CharField(max_length=100, unique=True)
    image = models.URLField(max_length=500, default="category.jpg", null=True, blank=True)
    active = models.BooleanField(default=True, db_index=True)
    slug = models.SlugField(unique=True, null=True, blank=True, db_index=True)
    
    # Denormalized fields for performance
    course_count = models.PositiveIntegerField(default=0, db_index=True)
    description = models.TextField(null=True, blank=True)
    
    # SEO and metadata
    meta_data = JSONField(default=dict, help_text="SEO metadata and additional category info")
    
    # Full-text search
    search_vector = SearchVectorField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "Categories"
        indexes = [
            models.Index(fields=['active', 'course_count']),
            models.Index(fields=['slug']),
            GinIndex(fields=['search_vector']),
        ]
        db_table = 'api_category'

    def __str__(self):
        return self.title
    
    def update_course_count(self):
        """Update course count for this category"""
        self.course_count = Course.objects.filter(category=self, platform_status='Published').count()
        self.save(update_fields=['course_count'])
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)
    
    def clear_cache(self):
        cache.delete_many([
            "categories_active",
            f"category_{self.slug}",
            f"category_courses_{self.id}"
        ])
            
class Course(models.Model):
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, blank=True, null=True)
    file = models.URLField(max_length=500, blank=True, null=True)  # Changed to URLField for file-upload API
    image = models.URLField(max_length=500, blank=True, null=True)  # Changed to URLField for file-upload API
    title = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(null=True, blank=True)
    level = models.CharField(choices=LEVEL, default="Beginner", max_length=100, blank=True, null=True)
    platform_status = models.CharField(choices=PLATFORM_STATUS, default="Published", max_length=100, blank=True, null=True)
    teacher_course_status = models.CharField(choices=TEACHER_STATUS, default="Published", max_length=100)
    featured = models.BooleanField(default=False)
    course_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    slug = models.SlugField(unique=True, null=True, blank=True)
    date = models.DateTimeField(default=timezone.now)


    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        if self.slug == "" or self.slug == None:
            self.slug = slugify(self.title) + str(self.pk)
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
    
    def rating_count(self):
        return Review.objects.filter(course=self, active=True).count()
    
    def reviews(self):
        return Review.objects.filter(course=self, active=True)
    
class Variant(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    title = models.CharField(max_length=1000)
    variant_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.title
    
    def variant_items(self):
        return VariantItem.objects.filter(variant=self)
    
    def items(self):
        return VariantItem.objects.filter(variant=self)
    
    
class VariantItem(models.Model):
    variant = models.ForeignKey(Variant, on_delete=models.CASCADE, related_name="variant_items")
    title = models.CharField(max_length=1000)
    description = models.TextField(null=True, blank=True)
    file = models.URLField(max_length=500, blank=True, null=True)  # Changed to URLField for file-upload API
    duration = models.DurationField(null=True, blank=True)  # Store precise duration for videos
    preview = models.BooleanField(default=False)
    variant_item_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.variant.title} - {self.title}"
    
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
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        # Note: Video duration extraction is now handled by the file-upload API
        # The duration information is returned when uploading the video file

class Question_Answer(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=1000, null=True, blank=True)
    qa_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    date = models.DateTimeField(default=timezone.now)

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
    question = models.ForeignKey(Question_Answer, on_delete=models.CASCADE)
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
    
class Cart(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    price = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    tax_fee = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    total = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    country = models.CharField(max_length=100, null=True, blank=True)
    cart_id = ShortUUIDField(length=6, max_length=20, alphabet="1234567890")
    date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.course.title
    
class CartOrder(models.Model):
    student = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    teachers = models.ManyToManyField(Teacher, blank=True)
    sub_total = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    tax_fee = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    total = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    initial_total = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    saved = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    payment_status = models.CharField(choices=PAYMENT_STATUS, default="Processing", max_length=100)
    full_name = models.CharField(max_length=100, null=True, blank=True)
    email = models.CharField(max_length=100, null=True, blank=True)
    country = models.CharField(max_length=100, null=True, blank=True)
    stripe_session_id = models.CharField(max_length=1000, null=True, blank=True)
    oid = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    date = models.DateTimeField(default=timezone.now)


    class Meta:
        ordering = ['-date']
    
    def order_items(self):
        return CartOrderItem.objects.filter(order=self)
    
    def __str__(self):
        return self.oid
    
class CartOrderItem(models.Model):
    order = models.ForeignKey(CartOrder, on_delete=models.CASCADE, related_name="orderitem")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="order_item")
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE)
    price = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    tax_fee = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    total = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    initial_total = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    saved = models.DecimalField(max_digits=12, default=0.00, decimal_places=2)
    oid = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    date = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-date']
    
    def order_id(self):
        return f"Order ID #{self.order.oid}"
    
    def payment_status(self):
        return f"{self.order.payment_status}"
    
    def __str__(self):
        return self.oid
    
class Certificate(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    enrollment = models.ForeignKey('EnrolledCourse', on_delete=models.CASCADE, null=True, blank=True)
    certificate_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890")
    is_valid = models.BooleanField(default=True)
    date = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.course.title} - {self.user.full_name if self.user else 'Unknown'}"
    
    class Meta:
        unique_together = ['course', 'user']  # One certificate per user per course
    
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
    order_item = models.ForeignKey(CartOrderItem, on_delete=models.CASCADE, null=True, blank=True)
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
    date = models.DateTimeField(default=timezone.now)   

    def __str__(self):
        return self.title
    
class Review(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    review = models.TextField(blank=True, null=True)
    rating = models.IntegerField(choices=RATING, default=1)
    reply = models.CharField(null=True, blank=True, max_length=1000)
    active = models.BooleanField(default=False)
    date = models.DateTimeField(default=timezone.now)   

    def __str__(self):
        return self.course.title
    
    def profile(self):
        return Profile.objects.get(user=self.user)
    
class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, blank=True)
    order = models.ForeignKey(CartOrder, on_delete=models.SET_NULL, null=True, blank=True)
    order_item = models.ForeignKey(CartOrderItem, on_delete=models.SET_NULL, null=True, blank=True)
    review = models.ForeignKey(Review, on_delete=models.SET_NULL, null=True, blank=True)
    type = models.CharField(max_length=100, choices=NOTI_TYPE)
    seen = models.BooleanField(default=False)
    date = models.DateTimeField(default=timezone.now)  

    def __str__(self):
        return self.type

class Wishlist(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    
    def __str__(self):
        return str(self.course.title)
    
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
        status = "✓" if self.is_correct else "✗"
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
        # Log the error but don't break the teacher save operation
        print(f"Error syncing Teacher with Profile: {e}")

# Connect the signal
post_save.connect(sync_teacher_with_profile, sender=Teacher)