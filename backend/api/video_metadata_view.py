# ✨ PHASE 4.43.10: Video Metadata Extraction API
# This file contains the VideoMetadataAPIView class
# It should be imported in views.py and registered in urls.py

from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import APIView
from rest_framework.permissions import IsAuthenticated
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
import logging

logger = logging.getLogger(__name__)


class VideoMetadataAPIView(APIView):
    """
    Extract metadata (duration, title, etc.) from video URLs
    
    Supports:
    - Google Drive videos
    - YouTube videos
    - Generic video URLs
    
    Usage:
        POST /api/v1/media/video-metadata/
        Body: {"url": "https://drive.google.com/file/d/FILE_ID/view"}
        
    Response:
        {
            "duration_seconds": 104.5,
            "duration_formatted": "1m 44s",
            "error": null
        }
    """
    permission_classes = [IsAuthenticated]
    
    @swagger_auto_schema(
        operation_description="Extract metadata from video URLs",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'url': openapi.Schema(type=openapi.TYPE_STRING, description='Video URL (Google Drive, YouTube, etc.)')
            },
            required=['url']
        ),
        responses={
            200: openapi.Response('Metadata extracted successfully', openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'duration_seconds': openapi.Schema(type=openapi.TYPE_NUMBER),
                    'duration_formatted': openapi.Schema(type=openapi.TYPE_STRING),
                    'error': openapi.Schema(type=openapi.TYPE_STRING),
                }
            ))
        }
    )
    def post(self, request):
        """Extract video metadata from URL"""
        video_url = request.data.get('url', '').strip()
        
        logger.info(f"[VideoMetadataAPIView] POST request received")
        logger.info(f"[VideoMetadataAPIView] URL: {video_url[:100] if video_url else 'None'}...")
        
        if not video_url:
            logger.warning(f"[VideoMetadataAPIView] URL is empty")
            return Response({
                'error': 'URL is required',
                'duration_seconds': None,
                'duration_formatted': None,
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Import the utility function
        from .url_utils import extract_video_duration_from_url
        
        logger.info(f"[VideoMetadataAPIView] Calling extract_video_duration_from_url")
        
        try:
            metadata = extract_video_duration_from_url(video_url)
            logger.info(f"[VideoMetadataAPIView] Result: {metadata}")
            
            if metadata.get('error'):
                logger.warning(f"[VideoMetadataAPIView] Extraction failed: {metadata['error']}")
                return Response({
                    'error': metadata['error'],
                    'duration_seconds': None,
                    'duration_formatted': None,
                }, status=status.HTTP_200_OK)
            
            logger.info(f"[VideoMetadataAPIView] Success: {metadata.get('duration_formatted')}")
            return Response({
                'duration_seconds': metadata.get('duration_seconds'),
                'duration_formatted': metadata.get('duration_formatted'),
                'error': None,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': f'Failed to extract metadata: {str(e)}',
                'duration_seconds': None,
                'duration_formatted': None,
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
