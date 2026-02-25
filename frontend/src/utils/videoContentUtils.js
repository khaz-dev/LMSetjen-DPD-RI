// ✨ PHASE 4.85: Shared video content utilities
// Extracted from LecturesTab to be reusable across components

import { getMediaUrl } from "./constants";

/**
 * Check if a URL is a video file
 * @param {string} fileUrl - The file URL to check
 * @returns {boolean} True if the URL points to a video file
 */
export const isVideoFile = (fileUrl) => {
    if (!fileUrl) return false;
    
    const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm', 'ogg'];
    const url = fileUrl.toLowerCase();
    
    for (const ext of videoExtensions) {
        if (url.includes(`.${ext}`) || url.includes(`.${ext}?`)) {
            return true;
        }
    }
    
    return false;
};

/**
 * Extract Google Drive file ID from various URL formats
 * @param {string} url - The Google Drive URL
 * @returns {string|null} The file ID or null if not found
 */
export const extractGoogleDriveFileId = (url) => {
    if (!url) return null;
    
    const regexps = [
        /drive\.google\.com\/open\?id=([a-zA-Z0-9-_]+)/,
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/,
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)\/view/,
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)\/preview/,
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)\/edit/,
        /docs\.google\.com\/presentation\/d\/([a-zA-Z0-9-_]+)/,
        /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
        /docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/
    ];
    
    try {
        for (const regex of regexps) {
            const match = url.match(regex);
            if (match?.[1]) return match[1];
        }
        return null;
    } catch {
        return null;
    }
};

/**
 * Check if variant item contains any video content
 * @param {object} variantItem - The variant item object
 * @returns {boolean} True if the item contains video content
 */
export const isVideoContent = (variantItem) => {
    if (!variantItem) return false;
    
    const fileUrl = variantItem.file || '';
    
    // Check uploaded video files
    if (isVideoFile(fileUrl)) {
        return true;
    }
    
    // Check Google Drive links
    if (fileUrl.includes('drive.google.com')) {
        return true;
    }
    
    // Check YouTube links
    if (
        fileUrl.includes('youtube.com') || 
        fileUrl.includes('youtu.be') ||
        fileUrl.includes('youtube-nocookie.com')
    ) {
        return true;
    }
    
    return false;
};

/**
 * Get the playable video URL from variant item
 * @param {object} variantItem - The variant item object
 * @returns {string|null} The playable video URL
 */
export const getVideoUrl = (variantItem) => {
    if (!variantItem) return null;
    
    const fileUrl = variantItem.file || '';
    
    // Priority 1: Uploaded video file
    if (isVideoFile(fileUrl)) {
        return fileUrl.startsWith("http") 
            ? fileUrl 
            : getMediaUrl(fileUrl);
    }
    
    // Priority 2: Google Drive link - convert to direct download/stream format
    // ✨ PHASE 4.86: Convert share link to direct stream URL (preview doesn't support video playback)
    if (fileUrl.includes('drive.google.com')) {
        const fileId = extractGoogleDriveFileId(fileUrl);
        if (fileId) {
            // Use /uc?export=download endpoint which serves the file directly
            // This works with ReactPlayer for video streaming from Google Drive
            return `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
        return fileUrl; // Fallback to original link
    }
    
    // Priority 3: YouTube link
    if (fileUrl.includes('youtube.com') || fileUrl.includes('youtu.be') || fileUrl.includes('youtube-nocookie.com')) {
        return fileUrl;
    }
    
    return null;
};

/**
 * Get file type icon based on file URL
 * @param {string} fileUrl - The file URL
 * @param {object} variantItem - The variant item for additional context
 * @returns {string} Font Awesome icon class
 */
export const getFileTypeIcon = (fileUrl, variantItem = null) => {
    if (variantItem && isVideoContent(variantItem)) {
        return "fas fa-play";
    }
    
    if (!fileUrl) return "fas fa-file";
    
    const extension = fileUrl.toLowerCase().split(".").pop().split("?")[0];
    const iconMap = {
        "mp4": "fas fa-play", "avi": "fas fa-play", "mov": "fas fa-play",
        "mkv": "fas fa-play", "webm": "fas fa-play", "ogg": "fas fa-play",
        "pdf": "fas fa-file-pdf", "doc": "fas fa-file-word", "docx": "fas fa-file-word",
        "txt": "fas fa-file-alt", "ppt": "fas fa-file-powerpoint", "pptx": "fas fa-file-powerpoint",
        "jpg": "fas fa-image", "jpeg": "fas fa-image", "png": "fas fa-image",
        "gif": "fas fa-image", "bmp": "fas fa-image"
    };
    
    return iconMap[extension] || "fas fa-file";
};

/**
 * Get file type label for display
 * @param {string} fileUrl - The file URL
 * @param {object} variantItem - The variant item for additional context
 * @returns {string} Human-readable file type label
 */
export const getFileTypeLabel = (fileUrl, variantItem = null) => {
    if (variantItem && isVideoContent(variantItem)) {
        return "Video";
    }
    
    if (!fileUrl) return "File";
    
    const extension = fileUrl.toLowerCase().split(".").pop().split("?")[0];
    const labelMap = {
        "mp4": "Video", "avi": "Video", "mov": "Video", "mkv": "Video",
        "webm": "Video", "ogg": "Video",
        "pdf": "PDF", "doc": "Dokumen", "docx": "Dokumen", "txt": "Teks",
        "ppt": "Presentasi", "pptx": "Presentasi",
        "jpg": "Gambar", "jpeg": "Gambar", "png": "Gambar", "gif": "Gambar", "bmp": "Gambar"
    };
    
    return labelMap[extension] || "File";
};

/**
 * Get file type title for tooltip/aria-label
 * @param {string} fileUrl - The file URL
 * @param {object} variantItem - The variant item for additional context
 * @returns {string} Tooltip text
 */
export const getFileTypeTitle = (fileUrl, variantItem = null) => {
    if (variantItem && isVideoContent(variantItem)) {
        return "Putar video";
    }
    
    const type = getFileTypeLabel(fileUrl, variantItem);
    return type === "Video" ? "Putar video" : `Buka ${type.toLowerCase()}`;
};
