// Utility functions for handling file URLs from the file-upload API

/**
 * Helper function to get proper image URL
 * Handles both new file-upload API URLs and legacy relative URLs
 */
export const getImageUrl = (imageUrl) => {
    if (!imageUrl) {
        return "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
    }
    
    // If it's already a complete URL from file-upload API, return as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }
    
    // Legacy support for relative URLs
    if (imageUrl.startsWith('/media/')) {
        return `http://127.0.0.1:8000${imageUrl}`;
    }
    
    if (imageUrl.startsWith('media/')) {
        return `http://127.0.0.1:8000/${imageUrl}`;
    }
    
    // Default case - construct the URL with /media/ prefix
    return `http://127.0.0.1:8000/media/${imageUrl}`;
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
    
    // Legacy support for relative URLs
    if (videoUrl.startsWith('/media/')) {
        return `http://127.0.0.1:8000${videoUrl}`;
    }
    
    if (videoUrl.startsWith('media/')) {
        return `http://127.0.0.1:8000/${videoUrl}`;
    }
    
    // Default case - construct the URL with /media/ prefix
    return `http://127.0.0.1:8000/media/${videoUrl}`;
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
    
    // Legacy support for relative URLs
    if (fileUrl.startsWith('/media/')) {
        return `http://127.0.0.1:8000${fileUrl}`;
    }
    
    if (fileUrl.startsWith('media/')) {
        return `http://127.0.0.1:8000/${fileUrl}`;
    }
    
    // Default case - construct the URL with /media/ prefix
    return `http://127.0.0.1:8000/media/${fileUrl}`;
};

/**
 * Default image URL for fallback cases
 */
export const DEFAULT_IMAGE_URL = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
