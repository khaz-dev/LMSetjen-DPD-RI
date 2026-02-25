"""
URL Utility Functions
Handles conversion of various URL formats to direct access URLs
Includes video duration extraction from external sources
"""

import re
import logging
import socket

logger = logging.getLogger(__name__)

# Try to import pytube for YouTube video extraction
try:
    from pytube import YouTube
    PYTUBE_AVAILABLE = True
    logger.info("[OK] [url_utils.py] pytube successfully imported at module load time")
except ImportError as e:
    PYTUBE_AVAILABLE = False
    logger.warning(f"[WARN] [url_utils.py] pytube import failed: {str(e)}")
    logger.warning("[WARN] pytube is optional - fallback methods still available")

# Try to import yt-dlp for video metadata extraction
try:
    import yt_dlp
    YT_DLP_AVAILABLE = True
    logger.info("[OK] [url_utils.py] yt-dlp successfully imported at module load time")
except ImportError as e:
    YT_DLP_AVAILABLE = False
    logger.warning(f"[WARN] [url_utils.py] yt-dlp import failed: {str(e)}")
    logger.warning("[WARN] yt-dlp is optional - fallback methods still available")


def convert_google_drive_url_to_direct_image(url):
    """
    Convert Google Drive share link to direct image URL
    
    Converts:
        https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    To:
        https://drive.google.com/uc?export=view&id=FILE_ID
    
    Also handles:
        - Already converted URLs (returns as-is)
        - Invalid URLs (returns original)
        
    Args:
        url (str): Google Drive URL or any URL
        
    Returns:
        str: Direct access image URL or original URL
    """
    if not url:
        return url
    
    # If it's not a Google Drive URL, return as-is
    if 'drive.google.com' not in url:
        return url
    
    # If it's already in the uc?export=view format, return as-is
    if 'uc?export=view' in url or 'uc?id=' in url:
        return url
    
    # Extract FILE_ID from: https://drive.google.com/file/d/FILE_ID/view...
    # Pattern matches: /d/[alphanumeric-_]+
    match = re.search(r'/d/([a-zA-Z0-9-_]+)', url)
    
    if match:
        file_id = match.group(1)
        # Return direct access URL for images
        return f'https://drive.google.com/uc?export=view&id={file_id}'
    
    # If we can't extract FILE_ID, return original URL
    return url


def clean_and_process_image_url(image_url):
    """
    Process image URL for safe use in API responses
    
    Args:
        image_url: Image URL from Course model
        
    Returns:
        str: Processed image URL or empty string
    """
    if not image_url:
        return ''
    
    # Convert string to handle file objects
    image_url = str(image_url).strip()
    
    if not image_url:
        return ''
    
    # If it's a Google Drive link, convert it
    if 'drive.google.com' in image_url:
        return convert_google_drive_url_to_direct_image(image_url)
    
    return image_url

def _format_duration(duration_seconds):
    """Helper funtion to format duration seconds to string"""
    if not duration_seconds:
        return None
    
    hours = int(duration_seconds // 3600)
    minutes = int((duration_seconds % 3600) // 60)
    seconds = int(duration_seconds % 60)
    
    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if minutes > 0 or hours > 0:
        parts.append(f"{minutes}m")
    if seconds > 0 or (hours == 0 and minutes == 0):
        parts.append(f"{seconds}s")
    
    return " ".join(parts)


def _extract_youtube_video_id(url):
    """Extract YouTube video ID from various URL formats"""
    import re
    
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&/?\s]+)',
        r'youtube\.com\/watch\?v=([^\&]+)',
        r'youtu\.be\/([^\?]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None


def _extract_youtube_duration_from_noembed(video_url):
    """
    ✨ PHASE 4.62: Try noembed.com API for YouTube metadata
    Note: noembed doesn't always return duration, but we try it
    """
    try:
        import requests
        
        logger.info(f"[YouTube Duration] Attempting extraction via noembed.com")
        noembed_url = f"https://noembed.com/embed?url={video_url}"
        response = requests.get(noembed_url, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        logger.info(f"[YouTube Duration] noembed returned: {list(data.keys())}")
        
        # noembed has 'duration' field for some services but not YouTube
        if 'duration' in data and data['duration']:
            duration_seconds = data['duration']
            duration_formatted = _format_duration(duration_seconds)
            logger.info(f"[YouTube Duration] Got duration from noembed: {duration_formatted}")
            return {
                'duration_seconds': duration_seconds,
                'duration_formatted': duration_formatted,
            }
        
        return None
    
    except Exception as e:
        logger.warning(f"[YouTube Duration] noembed API failed: {str(e)}")
        return None


def _extract_youtube_duration_from_pytube(video_url):
    """
    ✨ PHASE 4.62: Extract YouTube duration using pytube
    Lightweight library specifically for YouTube
    """
    if not PYTUBE_AVAILABLE:
        logger.info(f"[YouTube Duration] pytube not available")
        return None
    
    try:
        logger.info(f"[YouTube Duration] Attempting extraction with pytube")
        
        yt = YouTube(video_url)
        duration_seconds = yt.length  # Duration in seconds
        
        if duration_seconds:
            duration_formatted = _format_duration(duration_seconds)
            logger.info(f"[YouTube Duration] pytube success: {duration_formatted}")
            return {
                'duration_seconds': duration_seconds,
                'duration_formatted': duration_formatted,
            }
        
        return None
    
    except Exception as e:
        logger.warning(f"[YouTube Duration] pytube extraction failed: {str(e)}")
        return None


def extract_video_duration_from_url(video_url):
    """
    ✨ PHASE 4.65: Extract video duration with smart fallback strategy
    
    For YouTube videos: Try multiple methods (prioritize yt-dlp for reliability)
    1. yt-dlp (most reliable, handles YouTube's strict requirements)
    2. noembed API (public, no auth needed - faster but less reliable)
    3. pytube (lightweight but often fails with modern YouTube)
    4. Graceful fallback to manual entry
    
    For Google Drive: Skip auto-extraction (doesn't expose metadata)
    
    Args:
        video_url (str): URL to video source
        
    Returns:
        dict: {
            'duration_seconds': float or None,
            'duration_formatted': str,  # e.g. "1m 44s"
            'error': str or None
        }
    """
    logger.info(f"[extract_video_duration_from_url] Called with URL: {video_url[:100]}...")
    
    if not video_url or not isinstance(video_url, str):
        return {
            'duration_seconds': None,
            'duration_formatted': None,
            'error': 'Invalid URL provided'
        }
    
    is_youtube = 'youtube.com' in video_url or 'youtu.be' in video_url
    is_google_drive = 'drive.google.com' in video_url
    
    # ✨ PHASE 4.65: For YouTube, try multiple methods (prioritize yt-dlp)
    if is_youtube:
        logger.info(f"[extract_video_duration_from_url] YouTube detected")
        
        # Method 1: Try yt-dlp FIRST (most reliable, handles YouTube's strict requirements)
        if YT_DLP_AVAILABLE:
            logger.info(f"[extract_video_duration_from_url] Trying yt-dlp (PRIMARY METHOD)")
            try:
                ydl_opts = {
                    'quiet': True,
                    'no_warnings': True,
                    'socket_timeout': 15,  # Increased timeout from 10s to 15s
                    'extract_flat': False,
                    'skip_unavailable_fragments': False,
                    'http_headers': {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                }
                
                logger.debug(f"[extract_video_duration_from_url] yt-dlp options: {ydl_opts}")
                
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    logger.debug(f"[extract_video_duration_from_url] Calling extract_info for: {video_url[:80]}")
                    info = ydl.extract_info(video_url, download=False)
                    
                    logger.debug(f"[extract_video_duration_from_url] extract_info returned: {type(info)}")
                    
                    if info and 'duration' in info:
                        duration_seconds = info.get('duration')
                        logger.debug(f"[extract_video_duration_from_url] duration value: {duration_seconds} (type: {type(duration_seconds)})")
                        
                        if duration_seconds and duration_seconds > 0:
                            duration_formatted = _format_duration(duration_seconds)
                            logger.info(f"[extract_video_duration_from_url] yt-dlp SUCCESS: {duration_formatted} ({duration_seconds}s)")
                            return {
                                'duration_seconds': duration_seconds,
                                'duration_formatted': duration_formatted,
                                'error': None
                            }
                        else:
                            logger.warning(f"[extract_video_duration_from_url] yt-dlp returned duration of 0 or None: {duration_seconds}")
                    else:
                        logger.warning(f"[extract_video_duration_from_url] yt-dlp returned no duration field. Available keys: {list(info.keys()) if info else 'None'}")
            except socket.timeout as e:
                logger.error(f"[extract_video_duration_from_url] yt-dlp TIMEOUT (socket): {str(e)}")
            except TimeoutError as e:
                logger.error(f"[extract_video_duration_from_url] yt-dlp TIMEOUT: {str(e)}")
            except Exception as e:
                logger.warning(f"[extract_video_duration_from_url] yt-dlp FAILED: {type(e).__name__}: {str(e)}")
                # Still continue to next method instead of failing
        else:
            logger.warning(f"[extract_video_duration_from_url] yt-dlp is NOT available")
        
        # Method 2: Try noembed API (faster but less reliable for YouTube)
        logger.info(f"[extract_video_duration_from_url] Trying noembed API (FALLBACK)")
        result = _extract_youtube_duration_from_noembed(video_url)
        if result:
            logger.info(f"[extract_video_duration_from_url] noembed SUCCESS: {result.get('duration_formatted')}")
            return {
                'duration_seconds': result['duration_seconds'],
                'duration_formatted': result['duration_formatted'],
                'error': None
            }
        else:
            logger.warning(f"[extract_video_duration_from_url] noembed returned no duration")
        
        # Method 3: Try pytube (fallback, often fails with modern YouTube)
        if PYTUBE_AVAILABLE:
            logger.info(f"[extract_video_duration_from_url] Trying pytube (LAST RESORT)")
            result = _extract_youtube_duration_from_pytube(video_url)
            if result:
                logger.info(f"[extract_video_duration_from_url] pytube SUCCESS: {result.get('duration_formatted')}")
                return {
                    'duration_seconds': result['duration_seconds'],
                    'duration_formatted': result['duration_formatted'],
                    'error': None
                }
            else:
                logger.warning(f"[extract_video_duration_from_url] pytube returned no duration")
        else:
            logger.info(f"[extract_video_duration_from_url] pytube not available, skipping")
        
        # Method 4: Graceful fallback
        logger.warning(f"[extract_video_duration_from_url] All YouTube extraction methods failed - returning manual entry prompt")
        return {
            'duration_seconds': None,
            'duration_formatted': None,
            'error': 'Could not auto-extract duration. Please set manually using the Edit button.'
        }
    
    # ✨ PHASE 4.65: Google Drive videos CAN be extracted with yt-dlp
    # Try yt-dlp for Google Drive links as well
    if is_google_drive:
        logger.info(f"[extract_video_duration_from_url] Google Drive detected - attempting extraction with yt-dlp")
        
        if YT_DLP_AVAILABLE:
            logger.info(f"[extract_video_duration_from_url] Trying yt-dlp for Google Drive")
            try:
                ydl_opts = {
                    'quiet': True,
                    'no_warnings': True,
                    'socket_timeout': 15,
                    'extract_flat': False,
                    'skip_unavailable_fragments': False,
                }
                
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(video_url, download=False)
                    
                    if info and 'duration' in info:
                        duration_seconds = info.get('duration')
                        
                        if duration_seconds and duration_seconds > 0:
                            duration_formatted = _format_duration(duration_seconds)
                            logger.info(f"[extract_video_duration_from_url] Google Drive yt-dlp SUCCESS: {duration_formatted}")
                            return {
                                'duration_seconds': duration_seconds,
                                'duration_formatted': duration_formatted,
                                'error': None
                            }
                        else:
                            logger.warning(f"[extract_video_duration_from_url] Google Drive returned duration of 0 or None")
                    else:
                        logger.warning(f"[extract_video_duration_from_url] Google Drive returned no duration field")
            except Exception as e:
                logger.warning(f"[extract_video_duration_from_url] Google Drive yt-dlp failed: {type(e).__name__}: {str(e)}")
        
        # If yt-dlp fails, fall back to manual entry
        logger.warning(f"[extract_video_duration_from_url] Google Drive extraction failed - returning manual entry prompt")
        return {
            'duration_seconds': None,
            'duration_formatted': None,
            'error': 'Could not auto-extract duration from Google Drive. Please set manually using the Edit button.'
        }
    
    # Unknown URL type
    logger.warning(f"[extract_video_duration_from_url] Unknown video source type")
    return {
        'duration_seconds': None,
        'duration_formatted': None,
        'error': 'Could not determine video source type'
    }