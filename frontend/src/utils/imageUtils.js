/**
 * Image Utilities
 * Centralized image handling to prevent 404 errors and improve error handling
 */

/**
 * Common invalid image placeholders that should be silently ignored
 */
const INVALID_PLACEHOLDERS = [
  'default-user.jpg',
  'default.jpg',
  'placeholder.jpg',
  'no-image.jpg',
  'default-avatar.jpg',
  'default-profile.jpg',
];

/**
 * Validates if a given URL is a valid image URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Silently reject known invalid placeholders
  if (INVALID_PLACEHOLDERS.includes(url) || INVALID_PLACEHOLDERS.includes(url.replace(/^['"]|['"]$/g, ''))) {
    return false;
  }

  // Check for valid URL patterns
  const validPatterns = [
    /^https?:\/\/.+/i,           // Full HTTP/HTTPS URLs
    /^\/media\/.+/i,             // Django media URLs
    /^\/static\/.+/i,            // Django static URLs
    /^data:image\/.+/i,          // Base64 data URLs
  ];

  return validPatterns.some(pattern => pattern.test(url));
};

/**
 * Gets a safe image URL or returns null if invalid
 * @param {string} imageUrl - The image URL to validate
 * @returns {string|null} - Safe URL or null
 */
export const getSafeImageUrl = (imageUrl) => {
  if (!imageUrl) {
    return null;
  }

  if (isValidImageUrl(imageUrl)) {
    return imageUrl;
  }

  // Only log warning once per unique invalid URL (reduce console spam)
  if (!getSafeImageUrl._loggedUrls) {
    getSafeImageUrl._loggedUrls = new Set();
  }
  
  if (!getSafeImageUrl._loggedUrls.has(imageUrl)) {
    getSafeImageUrl._loggedUrls.add(imageUrl);
    console.warn('[Image Utils] Invalid image URL detected and blocked:', imageUrl);
  }

  return null;
};

/**
 * Gets the first valid image URL from multiple sources
 * @param {...string} urls - Multiple image URLs to check
 * @returns {string|null} - First valid URL or null
 */
export const getFirstValidImageUrl = (...urls) => {
  for (const url of urls) {
    const safeUrl = getSafeImageUrl(url);
    if (safeUrl) {
      return safeUrl;
    }
  }
  return null;
};

/**
 * Handles image load errors with fallback display
 * @param {Event} e - The error event
 * @param {Object} options - Options for error handling
 * @param {string} options.fallbackSelector - CSS selector for fallback element
 * @param {boolean} options.logError - Whether to log the error
 */
export const handleImageError = (e, options = {}) => {
  const {
    fallbackSelector = '.fallback-avatar',
    logError = true,
  } = options;

  if (logError) {
    console.error('[Image Utils] Image failed to load:', e.target.src);
  }

  // Hide the failed image
  e.target.style.display = 'none';

  // Show fallback if it exists
  const wrapper = e.target.parentElement;
  if (wrapper) {
    const fallback = wrapper.querySelector(fallbackSelector);
    if (fallback) {
      fallback.style.display = 'flex';
    }
  }
};

/**
 * Preloads an image to check if it exists
 * @param {string} url - The image URL to preload
 * @returns {Promise<boolean>} - Resolves to true if image loads successfully
 */
export const preloadImage = (url) => {
  return new Promise((resolve) => {
    if (!isValidImageUrl(url)) {
      resolve(false);
      return;
    }

    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
};

/**
 * Gets image URL with proper base path handling
 * @param {string} imagePath - The image path from backend
 * @param {string} baseUrl - The base URL (default: import.meta.env.VITE_SERVER_URL)
 * @returns {string|null} - Full image URL or null
 */
export const getImageUrl = (imagePath, baseUrl = null) => {
  if (!imagePath) {
    return null;
  }

  // If it's already a full URL, validate and return
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return getSafeImageUrl(imagePath);
  }

  // If it's a data URL, return it
  if (imagePath.startsWith('data:image/')) {
    return imagePath;
  }

  // For relative paths, prepend the base URL
  const base = baseUrl || import.meta.env.VITE_SERVER_URL || 'http://127.0.0.1:8000';
  
  // Remove leading slash if base URL ends with slash
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  const fullUrl = `${base.replace(/\/$/, '')}${cleanPath}`;

  return getSafeImageUrl(fullUrl);
};

/**
 * Default fallback icons for different entity types
 */
export const FALLBACK_ICONS = {
  user: 'fas fa-user-circle',
  instructor: 'fas fa-chalkboard-teacher',
  student: 'fas fa-user-graduate',
  course: 'fas fa-book',
  default: 'fas fa-image',
};

/**
 * Gets fallback icon class based on type
 * @param {string} type - The entity type (user, instructor, student, course)
 * @returns {string} - Font Awesome icon class
 */
export const getFallbackIcon = (type = 'default') => {
  return FALLBACK_ICONS[type] || FALLBACK_ICONS.default;
};

/**
 * React hook-friendly image error handler
 * @param {string} type - Entity type for fallback icon
 * @returns {Function} - Error handler function
 */
export const createImageErrorHandler = (type = 'default') => {
  return (e) => {
    handleImageError(e, {
      fallbackSelector: `.instructor-default-avatar, .fallback-avatar, .default-avatar`,
      logError: true,
    });
  };
};

/**
 * Validates and returns safe image source with fallback
 * @param {Object} options - Configuration options
 * @param {string} options.primary - Primary image source
 * @param {string} options.secondary - Secondary image source
 * @param {string} options.fallback - Fallback image source
 * @returns {string|null} - Safe image URL
 */
export const getImageSource = ({ primary, secondary, fallback }) => {
  return getFirstValidImageUrl(primary, secondary, fallback);
};

/**
 * Get valid profile image URL with comprehensive validation
 * Specifically for user profile/avatar images from backend
 * @param {*} imageUrl - Image URL from backend (can be null, string, or invalid)
 * @param {string} fallback - Fallback value (default: empty string for default avatar)
 * @returns {string} Valid image URL or fallback
 */
export const getValidProfileImageUrl = (imageUrl, fallback = "") => {
  // Handle null/undefined
  if (imageUrl == null) {
    return fallback;
  }
  
  // Type check
  if (typeof imageUrl !== 'string') {
    return fallback;
  }
  
  // Trim and check empty
  const trimmedUrl = imageUrl.trim();
  if (trimmedUrl === '') {
    return fallback;
  }
  
  // Check against invalid placeholders
  if (INVALID_PLACEHOLDERS.includes(trimmedUrl) ||
      trimmedUrl === '/media/default-user.jpg' ||
      trimmedUrl === 'media/default-user.jpg') {
    return fallback;
  }
  
  // Validate URL pattern
  if (isValidImageUrl(trimmedUrl)) {
    return trimmedUrl;
  }
  
  return fallback;
};

export default {
  isValidImageUrl,
  getSafeImageUrl,
  getFirstValidImageUrl,
  handleImageError,
  preloadImage,
  getImageUrl,
  getFallbackIcon,
  createImageErrorHandler,
  getImageSource,
  getValidProfileImageUrl,
  FALLBACK_ICONS,
  INVALID_PLACEHOLDERS,
};
