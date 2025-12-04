import UserData from "../views/plugin/UserData";

// Use environment variable for API URL with smart fallback based on hostname
// On production, VITE_API_BASE_URL will be '/api' (relative path)
// On localhost development, it defaults to 'http://127.0.0.1:8000'
// The relative path is safer as it uses the same origin (http/https, domain, port)
const baseURL = import.meta.env.VITE_API_BASE_URL || (() => {
  // In development, use localhost. In production, use relative path
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://127.0.0.1:8000';
  }
  // In production, use relative path (no hardcoded domain)
  return '/api';
})();

// Build the full API base URL
// If baseURL is already a full URL (http://...), use it as-is + /api/v1
// If baseURL is relative (/api), use it as-is + /v1 (baseURL already has /api)
export const API_BASE_URL = baseURL.startsWith('http')
  ? `${baseURL}/api/v1/`   // Full URL: append /api/v1/
  : `${baseURL}/v1/`;       // Relative: append /v1/ (baseURL already has /api)

// Default image URL for fallback cases
export const DEFAULT_IMAGE_URL = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";

// Helper function to get full media URL
// ✨ PHASE 4.40: Fixed to return /media/ URLs directly (not /api/media/)
// Media files are served by nginx directly, not through Django API endpoints
export const getMediaUrl = (path) => {
    if (!path) return '';
    
    // If it's already a full URL, return as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    
    // Media files are served directly from /media/ path (root level)
    // NOT from /api/media/ - there is no /api/media/ endpoint
    // Nginx handles /media/ directly from the filesystem volume
    
    if (path.startsWith('/media/')) {
        // Already has correct /media/ prefix
        return path;
    }
    
    if (path.startsWith('/')) {
        // Add /media prefix (not /api/media)
        return `/media${path}`;
    }
    
    // Otherwise, add /media/ prefix (not /api/media/)
    return `/media/${path}`;
};

// NOTE: Do NOT export userId or teacherId at module load time!
// These should be retrieved dynamically using UserData() when needed to ensure fresh token data
// export const userId = UserData()?.user_id;  // DEPRECATED - use UserData().user_id in component
// export const teacherId = UserData()?.teacher_id;  // DEPRECATED - use UserData().teacher_id in component

export const PAYPAL_CLIENT_ID = "AfgB8dQx5PP51IEnMoolGQtKKrMygi3aAZsg3-WNoi5esLsVUTTip1l-wC_l6on8RBBD6Rm2Npj4Ar7X"; 