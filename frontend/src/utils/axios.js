import axios from "axios";
import Cookie from "js-cookie";

// Get API URL from environment variable, fallback to relative path
// In Docker: uses /api (nginx proxies to backend:8001 internally)
// In development: use environment variable or relative path
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

// Build the full API base URL
// If baseURL is already a full URL (http://...), use it as-is + /v1
// If baseURL is relative (/api), use it as-is + /v1
const API_BASE_URL = baseURL.startsWith('http') 
  ? `${baseURL}/v1/`  // Full URL: append /v1/
  : `${baseURL}/v1/`;      // Relative: append /v1/ (baseURL already has /api)

// Create an Axios instance with default settings
const apiInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 51740,  // Increased from 10s to 30s to handle slower connections and large responses
    headers: {
        "Content-Type": "application/json",
    },
});

// Request interceptor for adding authentication token if available
apiInstance.interceptors.request.use(
    async (config) => {
        const accessToken = Cookie.get("access_token");

        // If the access token exists, add it to the Authorization header
        if (accessToken && accessToken.trim() !== "") {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - suppress console logging for expected errors
apiInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        // Completely suppress console logging for authentication-related endpoints
        const isAuthEndpoint = error.config?.url?.includes('user/token/') || 
                               error.config?.url?.includes('user/register/') ||
                               error.config?.url?.includes('user/change-password/');
        
        // Only log unexpected errors (server errors or network issues)
        if (!isAuthEndpoint && error.response && error.response.status >= 500) {
            console.error("Server error:", error.response.status, error.response.data);
        } else if (!error.response && !isAuthEndpoint) {
            console.error("Network error:", error.message);
        }

        // Don't log anything for authentication endpoints - handle silently
        return Promise.reject(error);
    }
);

// Helper function to get media/static URLs
export const getMediaURL = (path) => {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

export { API_BASE_URL };
export default apiInstance;