import UserData from "../views/plugin/UserData";

// Use environment variable for API URL, fallback to localhost for development
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
export const API_BASE_URL = `${BACKEND_URL}/api/v1/`;

// Helper function to get full media URL
export const getMediaUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${BACKEND_URL}${cleanPath}`;
};

export const userId = UserData()?.user_id;
export const PAYPAL_CLIENT_ID = "AfgB8dQx5PP51IEnMoolGQtKKrMygi3aAZsg3-WNoi5esLsVUTTip1l-wC_l6on8RBBD6Rm2Npj4Ar7X";
export const teacherId = UserData()?.teacher_id; 