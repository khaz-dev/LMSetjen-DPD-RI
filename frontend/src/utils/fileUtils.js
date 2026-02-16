// ✨ PHASE 2: Simplified utility functions for external URL handling
// Removed: Legacy file-upload API URL construction (no longer uploading files)
// Updated: Now handles only direct external URLs (Google Drive, YouTube, image CDNs, etc.)

import { DEFAULT_IMAGE_URL } from './constants';

/**
 * Helper function to handle image URLs
 * Now expects complete external URLs (HTTP/HTTPS)
 * Example: https://drive.google.com/uc?id=... or https://picsum.photos/...
 */
export const getImageUrl = (imageUrl) => {
    if (!imageUrl) {
        return DEFAULT_IMAGE_URL;
    }
    
    // Return URL as-is (user provides complete external URL)
    return imageUrl;
};

/**
 * Helper function to handle YouTube URLs
 * Example: https://www.youtube.com/embed/dQw4w9WgXcQ
 */
export const getVideoUrl = (videoUrl) => {
    if (!videoUrl) {
        return "";
    }
    
    // Return URL as-is (already validated and extracted by VideoUpload component)
    return videoUrl;
};

/**
 * Default image URL for fallback cases
 */
export { DEFAULT_IMAGE_URL };
