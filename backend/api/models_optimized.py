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
import uuid
import json
from decimal import Decimal

# Constants remain the same
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

NOTI_TYPE = (
    ("New Order", "New Order"),
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
        from api.models import Course, EnrolledCourse, Review
        
        self.total_courses = Course.objects.filter(teacher=self, platform_status='Published').count()
        self.total_students = EnrolledCourse.objects.filter(course__teacher=self).values('user').distinct().count()
        
        avg_rating = Review.objects.filter(
            course__teacher=self, active=True
        ).aggregate(avg=Avg('rating'))['avg']
        self.average_rating = avg_rating or 0.00
        
        self.save(update_fields=['total_courses', 'total_students', 'average_rating'])
    
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
        from api.models import Course
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

class Course(BaseModel):
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, db_index=True)
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, blank=True, null=True, db_index=True)
    
    # Media fields
    file = models.URLField(max_length=500, blank=True, null=True)
    image = models.URLField(max_length=500, blank=True, null=True)
    
    # Basic info
    title = models.CharField(max_length=200, blank=True, null=True, db_index=True)
    description = models.TextField(null=True, blank=True)
    short_description = models.CharField(max_length=500, null=True, blank=True)
    
    # Course attributes
    level = models.CharField(choices=LEVEL, default="Beginner", max_length=100, blank=True, null=True, db_index=True)
    platform_status = models.CharField(choices=PLATFORM_STATUS, default="Published", max_length=100, blank=True, null=True, db_index=True)
    teacher_course_status = models.CharField(choices=TEACHER_STATUS, default="Published", max_length=100, db_index=True)
    featured = models.BooleanField(default=False, db_index=True)
    
    # Identifiers
    course_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890", db_index=True)
    slug = models.SlugField(unique=True, null=True, blank=True, db_index=True)
    
    # Pricing and enrollment
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, db_index=True)
    discount_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # Performance metrics (denormalized for speed)
    student_count = models.PositiveIntegerField(default=0, db_index=True)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00, db_index=True)
    review_count = models.PositiveIntegerField(default=0, db_index=True)
    lecture_count = models.PositiveIntegerField(default=0)
    total_duration = models.DurationField(null=True, blank=True)
    
    # Course metadata and settings
    course_metadata = JSONField(default=dict, help_text="Additional course settings and metadata")
    requirements = ArrayField(models.CharField(max_length=200), default=list, blank=True)
    what_you_learn = ArrayField(models.CharField(max_length=200), default=list, blank=True)
    tags = ArrayField(models.CharField(max_length=50), default=list, blank=True, db_index=True)
    
    # Full-text search
    search_vector = SearchVectorField(null=True, blank=True)
    
    # Timestamps
    date = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        indexes = [
            # Primary lookup indexes
            models.Index(fields=['platform_status', 'featured', '-date']),
            models.Index(fields=['category', 'platform_status']),
            models.Index(fields=['teacher', 'teacher_course_status']),
            
            # Performance indexes
            models.Index(fields=['student_count', 'average_rating']),
            models.Index(fields=['price', 'discount_price']),
            models.Index(fields=['level', 'platform_status']),
            
            # Search indexes
            GinIndex(fields=['search_vector']),
            GinIndex(fields=['tags']),
            
            # Composite indexes
            models.Index(fields=['featured', 'platform_status', '-average_rating']),
            models.Index(fields=['category', 'level', 'platform_status']),
        ]
        db_table = 'api_course'

    def __str__(self):
        return self.title or f"Course {self.course_id}"
    
    def save(self, *args, **kwargs):
        if not self.slug and self.title:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    @classmethod
    def get_featured_courses(cls, limit=10):
        """Get featured courses with caching"""
        cache_key = f"featured_courses_{limit}"
        courses = cache.get(cache_key)
        if not courses:
            courses = cls.objects.filter(
                featured=True, 
                platform_status='Published'
            ).select_related('teacher', 'category').order_by('-average_rating')[:limit]
            cache.set(cache_key, courses, 1800)  # Cache for 30 minutes
        return courses

    @classmethod
    def search_courses(cls, query, filters=None):
        """Advanced course search with full-text search"""
        if not query:
            qs = cls.objects.filter(platform_status='Published')
        else:
            qs = cls.objects.filter(
                platform_status='Published'
            ).filter(
                Q(search_vector=SearchVector(query)) |
                Q(title__icontains=query) |
                Q(description__icontains=query) |
                Q(tags__contains=[query])
            )
        
        if filters:
            if filters.get('category'):
                qs = qs.filter(category__slug=filters['category'])
            if filters.get('level'):
                qs = qs.filter(level=filters['level'])
            if filters.get('price_range'):
                min_price, max_price = filters['price_range']
                qs = qs.filter(price__gte=min_price, price__lte=max_price)
        
        return qs.select_related('teacher', 'category').order_by('-average_rating', '-student_count')

    def update_stats(self):
        """Update course statistics"""
        from api.models import EnrolledCourse, Review, VariantItem
        
        # Update student count
        self.student_count = EnrolledCourse.objects.filter(course=self).count()
        
        # Update review stats
        reviews = Review.objects.filter(course=self, active=True)
        self.review_count = reviews.count()
        avg_rating = reviews.aggregate(avg=Avg('rating'))['avg']
        self.average_rating = avg_rating or 0.00
        
        # Update lecture count and total duration
        lectures = VariantItem.objects.filter(variant__course=self)
        self.lecture_count = lectures.count()
        
        total_duration = lectures.filter(
            duration__isnull=False
        ).aggregate(total=Sum('duration'))['total']
        self.total_duration = total_duration
        
        self.save(update_fields=[
            'student_count', 'review_count', 'average_rating', 
            'lecture_count', 'total_duration'
        ])
    
    def clear_cache(self):
        cache.delete_many([
            f"course_{self.slug}",
            f"course_lectures_{self.id}",
            f"course_reviews_{self.id}",
            "featured_courses_10"
        ])

class Variant(BaseModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='variants', db_index=True)
    title = models.CharField(max_length=1000)
    description = models.TextField(null=True, blank=True)
    variant_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890", db_index=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    
    # Performance tracking
    item_count = models.PositiveIntegerField(default=0)
    total_duration = models.DurationField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['course', 'order']),
            models.Index(fields=['variant_id']),
        ]
        ordering = ['order', 'created_at']
        db_table = 'api_variant'

    def __str__(self):
        return f"{self.course.title} - {self.title}"
    
    def update_stats(self):
        """Update variant statistics"""
        items = self.variant_items.all()
        self.item_count = items.count()
        
        total_duration = items.filter(
            duration__isnull=False
        ).aggregate(total=Sum('duration'))['total']
        self.total_duration = total_duration
        
        self.save(update_fields=['item_count', 'total_duration'])

class VariantItem(BaseModel):
    variant = models.ForeignKey(Variant, on_delete=models.CASCADE, related_name="variant_items", db_index=True)
    title = models.CharField(max_length=1000)
    description = models.TextField(null=True, blank=True)
    
    # Media and content
    file = models.URLField(max_length=500, blank=True, null=True)
    file_type = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    file_size = models.BigIntegerField(null=True, blank=True)  # in bytes
    duration = models.DurationField(null=True, blank=True, db_index=True)
    
    # Settings
    preview = models.BooleanField(default=False, db_index=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    
    # Metadata
    content_metadata = JSONField(default=dict, help_text="Additional content metadata")
    
    # Identifiers
    variant_item_id = ShortUUIDField(unique=True, length=6, max_length=20, alphabet="1234567890", db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['variant', 'order']),
            models.Index(fields=['file_type', 'preview']),
            models.Index(fields=['variant_item_id']),
        ]
        ordering = ['order', 'created_at']
        db_table = 'api_variant_item'

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
    def file_icon(self):
        """Return appropriate icon based on file type"""
        if not self.file_type:
            return "fa-file"
        
        icon_map = {
            'video': 'fa-video',
            'audio': 'fa-music',
            'pdf': 'fa-file-pdf',
            'doc': 'fa-file-word',
            'image': 'fa-image',
            'zip': 'fa-file-archive',
        }
        return icon_map.get(self.file_type.lower(), 'fa-file')

# Continue with other optimized models...
# (The remaining models would follow similar optimization patterns)