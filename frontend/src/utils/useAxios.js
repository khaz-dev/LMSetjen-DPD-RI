import axios from "axios";
import { setAuthUser, getRefreshToken, isAccessTokenExpired } from "./auth";
import Cookie from "js-cookie";
import { API_BASE_URL } from "./constants";

// Create an Axios instance with default settings
const useAxios = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000000,
    headers: {
        "Content-Type": "application/json",
    },
});

// Before checking if token is expired, ensure it exists
useAxios.interceptors.request.use(async (config) => {
    // Handle FormData - remove Content-Type header to let browser set it automatically
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }
    
    const access_token = Cookie.get("access_token");
    
    // Only proceed with token validation if token exists and is not empty
    if (access_token && access_token.trim() !== "") {
        if (isAccessTokenExpired(access_token)) {
            try {
                const response = await getRefreshToken();
                setAuthUser(response.data.access, response.data.refresh);
                config.headers.Authorization = `Bearer ${response.data.access}`;
            } catch (error) {
                console.error("Token refresh failed:", error);
                return Promise.reject(error);
            }
        } else {
            config.headers.Authorization = `Bearer ${access_token}`;
        }
    }
    
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response interceptor for handling errors
useAxios.interceptors.response.use(
    (response) => response,
    (error) => {
        // Check if this is a password validation request
        const isPasswordValidation = error.config?.url?.includes('user/token/') && 
                                    error.config?.data?.includes('password');
        
        // Only log errors that are not from password validation
        if (error.response && error.response.status === 401 && !isPasswordValidation) {
            console.error("Unauthorized access - you may need to log in:", error);
        } else if (error.response && error.response.status >= 500) {
            console.error("Server error:", error);
        } else if (!error.response && !isPasswordValidation) {
            console.error("Network error:", error);
        }

        return Promise.reject(error);
    }
);

export default useAxios;