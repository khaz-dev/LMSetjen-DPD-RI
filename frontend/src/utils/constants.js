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
export const getMediaUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    
    // Clean the path
    let cleanPath = path;
    
    // If path already starts with /media/, use it as-is
    if (cleanPath.startsWith('/media/')) {
        return `${baseURL}${cleanPath}`;
    }
    
    // If path starts with /, add /media prefix
    if (cleanPath.startsWith('/')) {
        return `${baseURL}/media${cleanPath}`;
    }
    
    // Otherwise, add /media/ prefix
    return `${baseURL}/media/${cleanPath}`;
};

// NOTE: Do NOT export userId or teacherId at module load time!
// These should be retrieved dynamically using UserData() when needed to ensure fresh token data
// export const userId = UserData()?.user_id;  // DEPRECATED - use UserData().user_id in component
// export const teacherId = UserData()?.teacher_id;  // DEPRECATED - use UserData().teacher_id in component

export const PAYPAL_CLIENT_ID = "AfgB8dQx5PP51IEnMoolGQtKKrMygi3aAZsg3-WNoi5esLsVUTTip1l-wC_l6on8RBBD6Rm2Npj4Ar7X"; 