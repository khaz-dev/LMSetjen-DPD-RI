"""
Enhanced File Management Models
Tracks file metadata and provides better organization
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
import os

class FileCategory(models.Model):
    """Categories for organizing files"""
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    max_size = models.BigIntegerField(help_text="Maximum file size in bytes")
    allowed_extensions = models.TextField(help_text="Comma-separated list of allowed extensions")
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        verbose_name_plural = "File Categories"
    
    def __str__(self):
        return self.name

class FileMetadata(models.Model):
    """Store detailed metadata about uploaded files"""
    
    # File identification
    file_hash = models.CharField(max_length=64, unique=True, help_text="SHA-256 hash of file")
    original_name = models.CharField(max_length=255)
    stored_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    
    # File properties
    file_size = models.BigIntegerField()
    mime_type = models.CharField(max_length=100, blank=True)
    category = models.ForeignKey(FileCategory, on_delete=models.CASCADE, null=True, blank=True)
    
    # URLs
    file_url = models.URLField(max_length=500)
    thumbnail_url = models.URLField(max_length=500, blank=True)
    
    # Video-specific metadata
    duration_seconds = models.FloatField(null=True, blank=True)
    video_width = models.IntegerField(null=True, blank=True)
    video_height = models.IntegerField(null=True, blank=True)
    video_bitrate = models.IntegerField(null=True, blank=True)
    
    # Image-specific metadata
    image_width = models.IntegerField(null=True, blank=True)
    image_height = models.IntegerField(null=True, blank=True)
    
    # Upload information
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    upload_context = models.CharField(max_length=50, default='general')  # course, profile, lesson, etc.
    upload_timestamp = models.DateTimeField(default=timezone.now)
    last_accessed = models.DateTimeField(auto_now=True)
    access_count = models.PositiveIntegerField(default=0)
    
    # Storage optimization
    is_optimized = models.BooleanField(default=False)
    compression_ratio = models.FloatField(null=True, blank=True)
    has_backup = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-upload_timestamp']
        indexes = [
            models.Index(fields=['file_hash']),
            models.Index(fields=['upload_context']),
            models.Index(fields=['category']),
        ]
    
    def __str__(self):
        return f"{self.original_name} ({self.file_size} bytes)"
    
    @property
    def file_size_mb(self):
        """Get file size in MB"""
        return round(self.file_size / 1024 / 1024, 2)
    
    @property
    def duration_formatted(self):
        """Get formatted duration for videos"""
        if not self.duration_seconds:
            return None
        
        minutes, remainder = divmod(self.duration_seconds, 60)
        return f"{int(minutes)}m {int(remainder)}s"
    
    def file_exists(self):
        """Check if the physical file still exists"""
        full_path = os.path.join(settings.MEDIA_ROOT, self.file_path)
        return os.path.exists(full_path)
    
    def increment_access_count(self):
        """Increment access counter"""
        self.access_count += 1
        self.last_accessed = timezone.now()
        self.save(update_fields=['access_count', 'last_accessed'])

class FileUsage(models.Model):
    """Track where files are being used"""
    
    file_metadata = models.ForeignKey(FileMetadata, on_delete=models.CASCADE, related_name='usages')
    
    # Content type tracking (which model uses this file)
    content_type = models.CharField(max_length=100)  # 'course', 'variant_item', 'profile', etc.
    object_id = models.PositiveIntegerField()
    field_name = models.CharField(max_length=50)  # 'image', 'file', etc.
    
    created_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ['file_metadata', 'content_type', 'object_id', 'field_name']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
        ]
    
    def __str__(self):
        return f"{self.file_metadata.original_name} used in {self.content_type}:{self.object_id}"

class StorageStatistics(models.Model):
    """Daily storage statistics"""
    
    date = models.DateField(unique=True, default=timezone.now)
    
    # File counts by category
    total_files = models.PositiveIntegerField(default=0)
    video_files = models.PositiveIntegerField(default=0)
    image_files = models.PositiveIntegerField(default=0)
    document_files = models.PositiveIntegerField(default=0)
    
    # Storage usage (in bytes)
    total_storage_used = models.BigIntegerField(default=0)
    video_storage_used = models.BigIntegerField(default=0)
    image_storage_used = models.BigIntegerField(default=0)
    document_storage_used = models.BigIntegerField(default=0)
    
    # Performance metrics
    avg_file_size = models.FloatField(default=0)
    largest_file_size = models.BigIntegerField(default=0)
    total_uploads_today = models.PositiveIntegerField(default=0)
    
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        ordering = ['-date']
    
    def __str__(self):
        return f"Storage stats for {self.date}"
    
    @property
    def total_storage_gb(self):
        """Get total storage in GB"""
        return round(self.total_storage_used / 1024 / 1024 / 1024, 2)

# Create default file categories
def create_default_categories():
    """Create default file categories"""
    categories = [
        {
            'name': 'video',
            'description': 'Video files for courses and lessons',
            'max_size': 524288001,  # 500MB
            'allowed_extensions': '.mp4,.avi,.mov,.mkv,.webm,.ogg'
        },
        {
            'name': 'image',
            'description': 'Images for courses, profiles, and thumbnails',
            'max_size': 52428800,  # 50MB
            'allowed_extensions': '.jpg,.jpeg,.png,.gif,.bmp,.webp'
        },
        {
            'name': 'document',
            'description': 'Documents and presentations',
            'max_size': 104857600,  # 100MB
            'allowed_extensions': '.pdf,.doc,.docx,.txt,.ppt,.pptx'
        },
        {
            'name': 'audio',
            'description': 'Audio files',
            'max_size': 104857600,  # 100MB
            'allowed_extensions': '.mp3,.wav,.ogg,.m4a,.aac'
        }
    ]
    
    for cat_data in categories:
        FileCategory.objects.get_or_create(
            name=cat_data['name'],
            defaults=cat_data
        )