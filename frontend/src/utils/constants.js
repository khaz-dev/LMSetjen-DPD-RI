import UserData from "../views/plugin/UserData";

// Use environment variable for API URL, fallback to relative path
// In Docker: uses /api (nginx proxies to backend:8000 internally)
// In development: use environment variable or relative path
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

// Build the full API base URL
// If baseURL is already a full URL (http://...), use it as-is + /api/v1
// If baseURL is relative (/api), use it as-is + /v1 (baseURL already has /api)
export const API_BASE_URL = baseURL.startsWith('http')
  ? `${baseURL}/api/v1/`   // Full URL: append /api/v1/
  : `${baseURL}/v1/`;       // Relative: append /v1/ (baseURL already has /api)

// Default image URL for fallback cases
export const DEFAULT_IMAGE_URL = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";

// Helper function to get full media URL
// ✨ PHASE 4.30: Fixed to use correct backend origin for media files in development
// In development: points to http://127.0.0.1:9000/media/ (Django backend)
// In production: points to /media/ (nginx serves from same origin as frontend)
export const getMediaUrl = (path) => {
    if (!path) return '';
    
    // If it's already a full URL, return as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    
    // Get the backend base URL for media files
    // In development: use http://127.0.0.1:8000 (or whatever backend is configured)
    // In production: use relative /media/ (same origin as frontend via nginx)
    const getBackendMediaUrl = () => {
        // Extract backend origin from baseURL
        if (baseURL.startsWith('http')) {
            // Development mode: baseURL is full URL like http://127.0.0.1:9000
            const baseOrigin = baseURL.split('/api')[0]; // Remove /api/v1/ part
            return `${baseOrigin}/media/`;
        }
        // Production mode: relative path works (nginx serves both frontend and media)
        return '/media/';
    };
    
    const backendMediaUrl = getBackendMediaUrl();
    
    // Handle paths that already have /media/ prefix
    if (path.startsWith('/media/')) {
        return path; // Return as-is, it's already prefixed
    }
    
    // Handle absolute paths
    if (path.startsWith('/')) {
        return `${backendMediaUrl}${path.substring(1)}`;
    }
    
    // Handle relative paths (e.g., 'user_folder/pic.jpg')
    // This is the most common case from Django's str(FileField)
    return `${backendMediaUrl}${path}`;
};

// NOTE: Do NOT export userId or teacherId at module load time!
// These should be retrieved dynamically using UserData() when needed to ensure fresh token data
// export const userId = UserData()?.user_id;  // DEPRECATED - use UserData().user_id in component
// export const teacherId = UserData()?.teacher_id;  // DEPRECATED - use UserData().teacher_id in component

export const PAYPAL_CLIENT_ID = "AfgB8dQx5PP51IEnMoolGQtKKrMygi3aAZsg3-WNoi5esLsVUTTip1l-wC_l6on8RBBD6Rm2Npj4Ar7X"; 