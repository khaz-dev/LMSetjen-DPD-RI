import { useAuthStore } from "../store/auth";
import apiInstance from "./axios";
import jwt_decode from "jwt-decode";
import Cookie from "js-cookie";

export const login = async (email, password) => {
    try {
        const { data, status } = await apiInstance.post(`user/token/`, {
            email,
            password,
        });

        if (status === 200) {
            setAuthUser(data.access, data.refresh);
        }

        return { data, error: null, errorDetails: null };
    } catch (error) {
        console.error("Login error:", error);
        let errorMessage = "Login failed. Please try again.";
        let errorDetails = {};
        
        if (error.response) {
            const { status, data } = error.response;
            
            if (status === 401) {
                errorMessage = data?.detail || "Invalid email or password. Please check your credentials.";
                errorDetails = {
                    status: 401,
                    detail: data?.detail,
                    rawData: data
                };
            } else if (status === 400) {
                errorMessage = data?.detail || data?.message || "Invalid login credentials.";
                errorDetails = {
                    status: 400,
                    detail: data?.detail,
                    message: data?.message,
                    rawData: data
                };
            } else if (status === 403) {
                errorMessage = "Account access denied. Please contact support.";
            } else if (status >= 500) {
                errorMessage = "Server error. Please try again later.";
            } else {
                errorMessage = data?.detail || data?.message || errorMessage;
            }
        } else if (error.request) {
            errorMessage = "Network error. Please check your connection and try again.";
        } else {
            errorMessage = "An unexpected error occurred. Please try again.";
        }
        
        return { data: null, error: errorMessage, errorDetails };
    }
};

export const redirectUserByRole = (userData) => {
    try {
        if (!userData || !userData.role) {
            // Default redirect for users without role
            window.location.href = '/student/dashboard/';
            return;
        }

        switch (userData.role) {
            case 'admin':
                window.location.href = '/admin/dashboard/';
                break;
            case 'teacher':
                window.location.href = '/instructor/dashboard/';
                break;
            case 'student':
            default:
                window.location.href = '/student/dashboard/';
                break;
        }
    } catch (error) {
        // Fallback redirect
        window.location.href = '/student/dashboard/';
    }
};

export const register = async (full_name, email, password, password2) => {
    try {
        const { data } = await apiInstance.post(`user/register/`, {
            full_name,
            email,
            password,
            password2,
        });

        await login(email, password);
        return { data, error: null };
    } catch (error) {
        console.error("Registration error in auth.js:", error);
        let errorMessage = "Registration failed. Please try again.";
        
        if (error.response?.data) {
            const errorData = error.response.data;
            console.error("Backend error data:", errorData);
            
            // Handle field-specific errors
            if (errorData.full_name) {
                errorMessage = `Nama: ${Array.isArray(errorData.full_name) ? errorData.full_name.join(', ') : errorData.full_name}`;
            } else if (errorData.email) {
                errorMessage = `Email: ${Array.isArray(errorData.email) ? errorData.email.join(', ') : errorData.email}`;
            } else if (errorData.password) {
                errorMessage = `Password: ${Array.isArray(errorData.password) ? errorData.password.join(', ') : errorData.password}`;
            } else if (errorData.password2) {
                errorMessage = `Konfirmasi Password: ${Array.isArray(errorData.password2) ? errorData.password2.join(', ') : errorData.password2}`;
            } else if (errorData.non_field_errors) {
                errorMessage = Array.isArray(errorData.non_field_errors) ? errorData.non_field_errors.join(', ') : errorData.non_field_errors;
            } else if (errorData.detail) {
                errorMessage = errorData.detail;
            } else if (errorData.message) {
                errorMessage = errorData.message;
            } else {
                // If there are any other field errors, display them
                const fieldErrors = Object.keys(errorData).map(field => {
                    const errors = Array.isArray(errorData[field]) ? errorData[field].join(', ') : errorData[field];
                    return `${field}: ${errors}`;
                });
                if (fieldErrors.length > 0) {
                    errorMessage = fieldErrors.join('; ');
                }
            }
        }
        
        return {
            data: null,
            error: errorMessage,
        };
    }
};

export const logout = () => {
    try {
        // Set a flag to indicate we're logging out to prevent auth redirects
        sessionStorage.setItem('logging_out', 'true');
        
        // Clear cookies first - with proper error handling
        try {
            Cookie.remove("access_token");
            Cookie.remove("refresh_token");
        } catch (cookieError) {
            // Silent fail
        }
        
        // Clear user state immediately
        const authStore = useAuthStore.getState();
        authStore.setUser(null);
        authStore.setLoading(false);
        
        // Clear any cached tokens in localStorage if they exist
        const itemsToRemove = [
            "access_token", "refresh_token", "user", "userData", 
            "profile", "wishlist", "cart"
        ];
        
        itemsToRemove.forEach(item => {
            try {
                localStorage.removeItem(item);
            } catch (e) {
                // Silent fail
            }
        });
        
        // Clear sessionStorage except our logout flag
        const loggingOut = sessionStorage.getItem('logging_out');
        try {
            sessionStorage.clear();
            if (loggingOut) {
                sessionStorage.setItem('logging_out', 'true');
            }
        } catch (e) {
            // Silent fail
        }
        
        // Enhanced redirect logic for better mobile/throttling support
        const performRedirect = () => {
            try {
                sessionStorage.removeItem('logging_out');
                // Use multiple fallback methods for better compatibility
                if (window.location.replace) {
                    window.location.replace('/');
                } else {
                    window.location.href = '/';
                }
            } catch (redirectError) {
                // Final fallback
                window.location.href = '/';
            }
        };
        
        // Adaptive timing based on connection speed
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        let delay = 100; // Default delay
        
        if (connection) {
            // Adjust delay based on connection speed
            if (connection.effectiveType === 'slow-2g') {
                delay = 500;
            } else if (connection.effectiveType === '2g') {
                delay = 300;
            } else if (connection.effectiveType === '3g') {
                delay = 200;
            }
        }
        
        // Use requestAnimationFrame for better timing
        requestAnimationFrame(() => {
            setTimeout(performRedirect, delay);
        });
        
    } catch (error) {
        console.error("Logout error:", error);
        // Emergency fallback - just redirect immediately
        try {
            sessionStorage.clear();
            window.location.href = '/';
        } catch (fallbackError) {
            console.error("Emergency logout fallback failed:", fallbackError);
        }
    }
};

export const setUser = async () => {
    // Don't process auth if we're in the middle of logging out
    if (sessionStorage.getItem('logging_out') === 'true') {
        return;
    }
    
    const access_token = Cookie.get("access_token");
    const refresh_token = Cookie.get("refresh_token");

    if (!access_token || !refresh_token) {
        // Clear everything if no tokens
        useAuthStore.getState().setUser(null);
        useAuthStore.getState().setLoading(false);
        localStorage.clear();
        sessionStorage.clear();
        return;
    }

    if (isAccessTokenExpired(access_token)) {
        try {
            const response = await getRefreshToken(refresh_token);
            setAuthUser(response.data.access, response.data.refresh);
        } catch (error) {
            // Only logout if we're not already logging out
            if (sessionStorage.getItem('logging_out') !== 'true') {
                logout();
            }
        }
    } else {
        setAuthUser(access_token, refresh_token);
    }
};

export const setAuthUser = (access_token, refresh_token) => {
    // Don't set auth if we're in the middle of logging out
    if (sessionStorage.getItem('logging_out') === 'true') {
        return;
    }
    
    if (access_token && refresh_token) {
        Cookie.set("access_token", access_token, {
            expires: 1,
            secure: true,
        });

        Cookie.set("refresh_token", refresh_token, {
            expires: 7,
            secure: true,
        });

        try {
            const user = jwt_decode(access_token);
            if (user) {
                useAuthStore.getState().setUser(user);
            }
        } catch (error) {
            console.error("Token decode error:", error);
            // Only logout if we're not already logging out
            if (sessionStorage.getItem('logging_out') !== 'true') {
                logout();
            }
        }
    } else {
        // Only logout if we're not already logging out
        if (sessionStorage.getItem('logging_out') !== 'true') {
            logout();
        }
    }
    useAuthStore.getState().setLoading(false);
};

export const getRefreshToken = async () => {
    try {
        const refresh_token = Cookie.get("refresh_token");
        
        if (!refresh_token) {
            throw new Error("No refresh token available");
        }
        
        const response = await apiInstance.post(`user/token/refresh/`, {
            refresh: refresh_token,
        });
        return response;
    } catch (error) {
        logout();
        throw error;
    }
};

export const isAccessTokenExpired = (access_token) => {
    // Check if token exists and is not empty
    if (!access_token || access_token.trim() === "") {
        return true;
    }

    try {
        const decodedToken = jwt_decode(access_token);
        const isExpired = decodedToken.exp < Date.now() / 1000;
        return isExpired;
    } catch (error) {
        return true; // Consider token expired if decoding fails
    }
};