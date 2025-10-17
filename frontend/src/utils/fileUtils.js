// Utility functions for handling file URLs from the file-upload API
import { getMediaUrl, DEFAULT_IMAGE_URL } from './constants';

/**
 * Helper function to get proper image URL
 * Handles both new file-upload API URLs and legacy relative URLs
 */
export const getImageUrl = (imageUrl) => {
    if (!imageUrl) {
        return DEFAULT_IMAGE_URL;
    }
    
    // If it's already a complete URL from file-upload API, return as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }
    
    // Use getMediaUrl from constants.js for proper URL construction
    return getMediaUrl(imageUrl);
};

/**
 * Helper function to get proper video URL
 * Handles both new file-upload API URLs and legacy relative URLs
 */
export const getVideoUrl = (videoUrl) => {
    if (!videoUrl) {
        return "";
    }
    
    // If it's already a complete URL from file-upload API, return as is
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
        return videoUrl;
    }
    
    // Use getMediaUrl from constants.js for proper URL construction
    return getMediaUrl(videoUrl);
};

/**
 * Helper function to get proper file URL for any file type
 */
export const getFileUrl = (fileUrl) => {
    if (!fileUrl) {
        return "";
    }
    
    // If it's already a complete URL from file-upload API, return as is
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        return fileUrl;
    }
    
    // Use getMediaUrl from constants.js for proper URL construction
    return getMediaUrl(fileUrl);
};

/**
 * Default image URL for fallback cases
 */
export { DEFAULT_IMAGE_URL };
