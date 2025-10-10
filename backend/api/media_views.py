"""
Enhanced Media Serving Views for Better Video Streaming
"""

import os
import re
import mimetypes
from django.http import HttpResponse, Http404, HttpResponseNotModified
from django.views.generic import View
from django.conf import settings
from django.utils.http import http_date
from django.views.decorators.cache import cache_control
from django.utils.decorators import method_decorator
from django.views.decorators.http import condition
import stat
from email.utils import parsedate_to_datetime


class EnhancedMediaView(View):
    """
    Enhanced media serving with range request support for better video seeking
    """
    
    @method_decorator(cache_control(max_age=3600, public=True))
    def get(self, request, path):
        """
        Serve media files with range request support for video streaming
        """
        # Security: ensure path doesn't escape media directory
        if '..' in path or path.startswith('/'):
            raise Http404("Invalid path")
            
        # Construct full file path
        full_path = os.path.join(settings.MEDIA_ROOT, path)
        
        # Check if file exists
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            raise Http404("File not found")
        
        # Get file stats
        stat_obj = os.stat(full_path)
        
        # Determine content type
        content_type, encoding = mimetypes.guess_type(full_path)
        if content_type is None:
            content_type = 'application/octet-stream'
        
        # Get file size
        file_size = stat_obj.st_size
        
        # Check if client supports range requests
        range_header = request.META.get('HTTP_RANGE')
        
        if range_header:
            # Handle range request for video seeking
            return self._handle_range_request(full_path, file_size, range_header, content_type)
        else:
            # Serve complete file
            return self._serve_complete_file(full_path, file_size, content_type)
    
    def _handle_range_request(self, file_path, file_size, range_header, content_type):
        """
        Handle HTTP Range requests for video seeking support
        """
        # Parse range header (e.g., "bytes=0-1023")
        range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)
        
        if not range_match:
            # Invalid range header
            response = HttpResponse(status=416)  # Range Not Satisfiable
            response['Content-Range'] = f'bytes */{file_size}'
            return response
        
        start = int(range_match.group(1))
        end = range_match.group(2)
        
        if end:
            end = int(end)
        else:
            end = file_size - 1
        
        # Validate range
        if start >= file_size or end >= file_size or start > end:
            response = HttpResponse(status=416)  # Range Not Satisfiable
            response['Content-Range'] = f'bytes */{file_size}'
            return response
        
        # Calculate content length
        content_length = end - start + 1
        
        # Open file and seek to start position
        try:
            with open(file_path, 'rb') as f:
                f.seek(start)
                content = f.read(content_length)
        except (OSError, IOError):
            raise Http404("Error reading file")
        
        # Create partial content response
        response = HttpResponse(
            content,
            status=206,  # Partial Content
            content_type=content_type
        )
        
        # Set required headers for range requests
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
        response['Content-Length'] = str(content_length)
        response['Accept-Ranges'] = 'bytes'
        
        # Add caching headers
        response['Cache-Control'] = 'public, max-age=3600'
        response['ETag'] = f'"{file_size}-{os.path.getmtime(file_path)}"'
        
        return response
    
    def _serve_complete_file(self, file_path, file_size, content_type):
        """
        Serve complete file for non-range requests
        """
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
        except (OSError, IOError):
            raise Http404("Error reading file")
        
        response = HttpResponse(content, content_type=content_type)
        response['Content-Length'] = str(file_size)
        response['Accept-Ranges'] = 'bytes'
        
        # Add caching headers
        response['Cache-Control'] = 'public, max-age=3600'
        response['ETag'] = f'"{file_size}-{os.path.getmtime(file_path)}"'
        
        return response


class VideoStreamView(EnhancedMediaView):
    """
    Specialized view for video streaming with optimized buffering
    """
    
    def get(self, request, path):
        """
        Enhanced video serving with optimized headers and range support
        """
        # Security check
        if '..' in path or path.startswith('/'):
            raise Http404("Invalid path")
            
        full_path = os.path.join(settings.MEDIA_ROOT, path)
        
        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            raise Http404("Video file not found")
        
        # Ensure it's a video file
        content_type, _ = mimetypes.guess_type(full_path)
        if not content_type or not content_type.startswith('video/'):
            # Fallback to enhanced media view for non-video files
            return super().get(request, path)
        
        file_size = os.path.getsize(full_path)
        range_header = request.META.get('HTTP_RANGE')
        
        if range_header:
            return self._handle_video_range_request(full_path, file_size, range_header, content_type)
        else:
            return self._serve_video_file(full_path, file_size, content_type)
    
    def _handle_video_range_request(self, file_path, file_size, range_header, content_type):
        """
        Optimized range request handling for video streaming
        """
        range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)
        
        if not range_match:
            response = HttpResponse(status=416)
            response['Content-Range'] = f'bytes */{file_size}'
            return response
        
        start = int(range_match.group(1))
        end = range_match.group(2)
        
        if end:
            end = int(end)
        else:
            # For video streaming, limit chunk size to improve seeking performance
            chunk_size = min(1024 * 1024, file_size - start)  # 1MB chunks
            end = min(start + chunk_size - 1, file_size - 1)
        
        if start >= file_size or end >= file_size or start > end:
            response = HttpResponse(status=416)
            response['Content-Range'] = f'bytes */{file_size}'
            return response
        
        content_length = end - start + 1
        
        try:
            with open(file_path, 'rb') as f:
                f.seek(start)
                content = f.read(content_length)
        except (OSError, IOError):
            raise Http404("Error reading video file")
        
        response = HttpResponse(content, status=206, content_type=content_type)
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
        response['Content-Length'] = str(content_length)
        response['Accept-Ranges'] = 'bytes'
        
        # Video-specific headers for better streaming
        response['Cache-Control'] = 'public, max-age=3600, immutable'
        response['X-Content-Type-Options'] = 'nosniff'
        
        return response
    
    def _serve_video_file(self, file_path, file_size, content_type):
        """
        Serve complete video file with streaming-optimized headers
        """
        def file_iterator(file_path, chunk_size=8192):
            with open(file_path, 'rb') as f:
                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    yield chunk
        
        response = HttpResponse(file_iterator(file_path), content_type=content_type)
        response['Content-Length'] = str(file_size)
        response['Accept-Ranges'] = 'bytes'
        
        # Optimized headers for video streaming
        response['Cache-Control'] = 'public, max-age=3600, immutable'
        response['X-Content-Type-Options'] = 'nosniff'
        
        return response