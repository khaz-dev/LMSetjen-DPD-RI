"""
Enhanced Local File Storage Utilities for LMSetjen DPD RI
Provides optimized file handling, compression, and organization
"""

import os
import hashlib
import mimetypes
from datetime import datetime
from PIL import Image
import uuid
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from typing import Dict, Tuple, Optional

class OptimizedLocalStorage:
    """Enhanced local file storage with optimization and organization"""
    
    def __init__(self):
        self.media_root = settings.MEDIA_ROOT
        self.media_subdirs = getattr(settings, 'MEDIA_SUBDIRS', {})
    
    def get_file_category(self, file_name: str) -> str:
        """Determine file category based on extension"""
        extension = os.path.splitext(file_name)[1].lower()
        
        video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.ogg', '.flv']
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
        document_extensions = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt']
        audio_extensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac']
        
        if extension in video_extensions:
            return 'video'
        elif extension in image_extensions:
            return 'image'
        elif extension in document_extensions:
            return 'document'
        elif extension in audio_extensions:
            return 'audio'
        else:
            return 'other'
    
    def generate_optimized_filename(self, original_name: str, category: str) -> str:
        """Generate organized filename with UUID and timestamp"""
        extension = os.path.splitext(original_name)[1].lower()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        
        # Create organized filename
        safe_name = f"{category}_{timestamp}_{unique_id}{extension}"
        return safe_name
    
    def get_storage_path(self, category: str, filename: str) -> str:
        """Get organized storage path based on file category"""
        if category == 'video':
            return os.path.join('videos', filename)
        elif category == 'image':
            return os.path.join('images', filename)
        elif category == 'document':
            return os.path.join('documents', filename)
        elif category in ['course', 'lesson']:
            return os.path.join('courses', filename)
        elif category == 'profile':
            return os.path.join('profiles', filename)
        else:
            return filename
    
    def optimize_image(self, image_file, max_width=1920, max_height=1080, quality=85):
        """Optimize image for web delivery"""
        try:
            with Image.open(image_file) as img:
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                
                # Resize if too large
                if img.width > max_width or img.height > max_height:
                    img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
                
                # Save optimized image
                from io import BytesIO
                output = BytesIO()
                img.save(output, format='JPEG', quality=quality, optimize=True)
                output.seek(0)
                
                return ContentFile(output.getvalue())
        except Exception as e:
            print(f"Image optimization failed: {e}")
            return image_file
    
    def create_thumbnail(self, image_file, size=(300, 300)):
        """Create thumbnail for images"""
        try:
            with Image.open(image_file) as img:
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                
                # Create thumbnail
                img.thumbnail(size, Image.Resampling.LANCZOS)
                
                # Save thumbnail
                from io import BytesIO
                output = BytesIO()
                img.save(output, format='JPEG', quality=90, optimize=True)
                output.seek(0)
                
                return ContentFile(output.getvalue())
        except Exception as e:
            print(f"Thumbnail creation failed: {e}")
            return None
    
    def validate_file_size(self, file, category: str) -> Tuple[bool, str]:
        """Validate file size based on category limits"""
        max_sizes = getattr(settings, 'MAX_FILE_SIZES', {})
        max_size = max_sizes.get(category, 104857600)  # Default 100MB
        
        if file.size > max_size:
            max_size_mb = max_size / 1024 / 1024
            return False, f"File size exceeds {max_size_mb:.1f}MB limit for {category} files"
        
        return True, "File size is acceptable"
    
    def get_file_hash(self, file) -> str:
        """Generate SHA-256 hash of file for deduplication"""
        hasher = hashlib.sha256()
        for chunk in file.chunks():
            hasher.update(chunk)
        return hasher.hexdigest()
    
    def save_file_optimized(self, file, category='other', context='general'):
        """Save file with optimization and organization"""
        try:
            # Validate file size
            is_valid, message = self.validate_file_size(file, category)
            if not is_valid:
                return None, message
            
            # Generate optimized filename
            filename = self.generate_optimized_filename(file.name, category)
            storage_path = self.get_storage_path(context, filename)
            
            # Optimize image if applicable
            file_to_save = file
            if category == 'image' and getattr(settings, 'ENABLE_IMAGE_OPTIMIZATION', True):
                file_to_save = self.optimize_image(file)
            
            # Save the file
            saved_path = default_storage.save(storage_path, file_to_save)
            file_url = default_storage.url(saved_path)
            
            # Create thumbnail for images
            thumbnail_url = None
            if category == 'image':
                thumbnail = self.create_thumbnail(file)
                if thumbnail:
                    thumb_path = self.get_storage_path('thumbnails', f"thumb_{filename}")
                    thumb_saved_path = default_storage.save(thumb_path, thumbnail)
                    thumbnail_url = default_storage.url(thumb_saved_path)
            
            # Get file info
            file_info = {
                'url': file_url,
                'thumbnail_url': thumbnail_url,
                'filename': filename,
                'original_name': file.name,
                'size': file.size,
                'category': category,
                'file_hash': self.get_file_hash(file),
                'mime_type': mimetypes.guess_type(file.name)[0],
                'saved_path': saved_path
            }
            
            return file_info, "File saved successfully"
            
        except Exception as e:
            return None, f"Error saving file: {str(e)}"

def get_file_storage():
    """Get the optimized file storage instance"""
    return OptimizedLocalStorage()

# Utility functions for easy access
def save_course_file(file):
    """Save course-related file"""
    storage = get_file_storage()
    return storage.save_file_optimized(file, 
                                     category=storage.get_file_category(file.name),
                                     context='course')

def save_profile_image(file):
    """Save user profile image"""
    storage = get_file_storage()
    return storage.save_file_optimized(file, category='image', context='profile')

def save_lesson_video(file):
    """Save lesson video file"""
    storage = get_file_storage()
    return storage.save_file_optimized(file, category='video', context='course')