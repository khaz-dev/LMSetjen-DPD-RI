import axios from "axios";
import Cookie from "js-cookie";

// Create an Axios instance with default settings
const apiInstance = axios.create({
    baseURL: "http://127.0.0.1:8000/api/v1/",
    timeout: 10000,
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

export default apiInstance;