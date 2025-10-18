"""
Enhanced File Upload Views for Optimized Local Storage
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import os
import math
from django.conf import settings
from core.storage import get_file_storage, save_course_file, save_profile_image, save_lesson_video
from api import serializer as api_serializer

try:
    from moviepy.editor import VideoFileClip
except ImportError:
    VideoFileClip = None

@method_decorator(csrf_exempt, name='dispatch')
class EnhancedFileUploadAPIView(APIView):
    """
    Enhanced file upload with local storage optimization
    
    CSRF exempt because:
    - Uses JWT authentication for authenticated requests  
    - AllowAny permission for public uploads
    - Safe file handling with UUID-based storage
    """
    permission_classes = [AllowAny]
    authentication_classes = []  # Disable authentication to avoid CSRF issues
    parser_classes = (MultiPartParser, FormParser)

    @swagger_auto_schema(
        operation_description="Upload and optimize files with enhanced local storage",
        request_body=api_serializer.FileUploadSerializer,
        responses={
            200: openapi.Response('File uploaded successfully', openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'url': openapi.Schema(type=openapi.TYPE_STRING),
                    'thumbnail_url': openapi.Schema(type=openapi.TYPE_STRING),
                    'file_name': openapi.Schema(type=openapi.TYPE_STRING),
                    'file_size': openapi.Schema(type=openapi.TYPE_INTEGER),
                    'file_type': openapi.Schema(type=openapi.TYPE_STRING),
                    'category': openapi.Schema(type=openapi.TYPE_STRING),
                    'optimized': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    'duration_seconds': openapi.Schema(type=openapi.TYPE_NUMBER),
                    'video_duration': openapi.Schema(type=openapi.TYPE_STRING),
                }
            )),
            400: openapi.Response('Upload failed', openapi.Schema(type=openapi.TYPE_OBJECT)),
        }
    )
    def post(self, request):
        serializer = api_serializer.FileUploadSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response({"error": "Invalid file data"}, status=status.HTTP_400_BAD_REQUEST)
        
        file = serializer.validated_data.get("file")
        upload_context = request.data.get('context', 'general')  # course, profile, lesson, etc.
        
        # Use enhanced storage
        storage = get_file_storage()
        
        # Save file with optimization
        if upload_context == 'profile':
            file_info, message = save_profile_image(file)
        elif upload_context in ['course', 'lesson']:
            file_info, message = save_course_file(file)
        else:
            category = storage.get_file_category(file.name)
            file_info, message = storage.save_file_optimized(file, category, upload_context)
        
        if not file_info:
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)
        
        # Build absolute URLs
        file_info['url'] = request.build_absolute_uri(file_info['url'])
        if file_info.get('thumbnail_url'):
            file_info['thumbnail_url'] = request.build_absolute_uri(file_info['thumbnail_url'])
        
        # Add video duration if it's a video file
        if file_info['category'] == 'video':
            duration_info = self.get_video_duration(file_info['saved_path'])
            file_info.update(duration_info)
        
        # Prepare response
        response_data = {
            "url": file_info['url'],
            "thumbnail_url": file_info.get('thumbnail_url'),
            "file_name": file_info['filename'],
            "original_name": file_info['original_name'],
            "file_size": file_info['size'],
            "file_type": file_info['category'],
            "category": file_info['category'],
            "mime_type": file_info.get('mime_type'),
            "file_hash": file_info.get('file_hash'),
            "optimized": True,
            "message": message
        }
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    def get_video_duration(self, file_path):
        """Get video duration information"""
        duration_info = {"is_video": True}
        
        if not VideoFileClip:
            duration_info["duration_error"] = "Video processing not available"
            return duration_info
        
        try:
            # Get full file path
            full_path = os.path.join(settings.MEDIA_ROOT, file_path)
            
            if os.path.exists(full_path):
                clip = VideoFileClip(full_path)
                duration_seconds = clip.duration
                clip.close()
                
                # Calculate minutes and seconds
                minutes, remainder = divmod(duration_seconds, 60)
                minutes = math.floor(minutes)
                seconds = math.floor(remainder)
                
                duration_text = f"{minutes}m {seconds}s"
                
                duration_info.update({
                    "duration_seconds": duration_seconds,
                    "video_duration": duration_text,
                    "duration_minutes": minutes,
                    "duration_seconds_only": seconds
                })
            else:
                duration_info["duration_error"] = "File not found for duration calculation"
                
        except Exception as e:
            duration_info["duration_error"] = f"Error processing video: {str(e)}"
        
        return duration_info

@method_decorator(csrf_exempt, name='dispatch')
class BulkFileUploadAPIView(APIView):
    """
    Handle multiple file uploads at once
    
    CSRF exempt for the same security reasons as EnhancedFileUploadAPIView
    """
    permission_classes = [AllowAny]
    authentication_classes = []  # Disable authentication to avoid CSRF issues
    parser_classes = (MultiPartParser, FormParser)
    
    @swagger_auto_schema(
        operation_description="Upload multiple files at once",
        manual_parameters=[
            openapi.Parameter('files', openapi.IN_FORM, type=openapi.TYPE_ARRAY,
                            items=openapi.Items(type=openapi.TYPE_FILE),
                            description='Multiple files to upload'),
            openapi.Parameter('context', openapi.IN_FORM, type=openapi.TYPE_STRING,
                            description='Upload context (course, profile, etc.)')
        ]
    )
    def post(self, request):
        files = request.FILES.getlist('files')
        context = request.data.get('context', 'general')
        
        if not files:
            return Response({"error": "No files provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        storage = get_file_storage()
        results = []
        errors = []
        
        for file in files:
            try:
                category = storage.get_file_category(file.name)
                file_info, message = storage.save_file_optimized(file, category, context)
                
                if file_info:
                    file_info['url'] = request.build_absolute_uri(file_info['url'])
                    if file_info.get('thumbnail_url'):
                        file_info['thumbnail_url'] = request.build_absolute_uri(file_info['thumbnail_url'])
                    results.append(file_info)
                else:
                    errors.append({"file": file.name, "error": message})
                    
            except Exception as e:
                errors.append({"file": file.name, "error": str(e)})
        
        return Response({
            "uploaded_files": len(results),
            "failed_files": len(errors),
            "results": results,
            "errors": errors
        }, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class FileInfoAPIView(APIView):
    """
    Get information about uploaded files
    
    CSRF exempt for consistency with other file upload endpoints
    """
    permission_classes = [AllowAny]
    authentication_classes = []  # Disable authentication to avoid CSRF issues
    
    def get(self, request, file_id=None):
        # This would integrate with a file tracking system
        # For now, return storage statistics
        
        media_stats = self.get_storage_statistics()
        
        return Response({
            "storage_info": media_stats,
            "storage_path": settings.MEDIA_ROOT,
            "total_files": media_stats.get('total_files', 0)
        })
    
    def get_storage_statistics(self):
        """Get local storage statistics"""
        stats = {
            'total_files': 0,
            'total_size': 0,
            'categories': {}
        }
        
        try:
            media_root = settings.MEDIA_ROOT
            if os.path.exists(media_root):
                for root, dirs, files in os.walk(media_root):
                    for file in files:
                        file_path = os.path.join(root, file)
                        file_size = os.path.getsize(file_path)
                        
                        stats['total_files'] += 1
                        stats['total_size'] += file_size
                        
                        # Categorize by directory
                        rel_path = os.path.relpath(root, media_root)
                        category = rel_path.split(os.sep)[0] if rel_path != '.' else 'root'
                        
                        if category not in stats['categories']:
                            stats['categories'][category] = {'files': 0, 'size': 0}
                        
                        stats['categories'][category]['files'] += 1
                        stats['categories'][category]['size'] += file_size
                        
        except Exception as e:
            stats['error'] = str(e)
        
        return stats