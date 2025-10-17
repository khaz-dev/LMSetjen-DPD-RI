import axios from "axios";
import { API_BASE_URL } from "./constants";

// Create a silent axios instance specifically for authentication/validation
const silentAxios = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
    },
    // Accept all status codes to handle errors manually
    validateStatus: function (status) {
        return status < 600; // Accept all status codes, handle errors manually
    }
});

// No interceptors - handle everything manually to avoid console logging
export default silentAxios;