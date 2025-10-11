import React, { useState } from "react";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";

import useAxios from "../../utils/useAxios";
import silentAxios from "../../utils/silentAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import "./ChangePassword.css";

// Constants
const PASSWORD_MIN_LENGTH = 6;
const VALIDATION_MESSAGES = {
    OLD_PASSWORD_REQUIRED: "Old password is required",
    NEW_PASSWORD_REQUIRED: "New password is required",
    CONFIRM_PASSWORD_REQUIRED: "Please confirm your new password",
    PASSWORD_TOO_SHORT: `New password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
    PASSWORDS_DONT_MATCH: "Passwords do not match",
    SAME_PASSWORD: "New password must be different from old password",
    FORM_VALIDATION_ERROR: "Please fix the errors in the form",
    INCORRECT_OLD_PASSWORD: "Incorrect old password",
    NETWORK_ERROR: "Network error. Please check your connection",
    PASSWORD_CHANGE_SUCCESS: "Password changed successfully!",
    PASSWORD_CHANGE_ERROR: "Failed to change password. Please try again.",
    UNABLE_TO_VERIFY: "Unable to verify password. Please login again."
};

const INITIAL_PASSWORD_STATE = {
    old_password: "",
    new_password: "",
    confirm_new_password: "",
};

const INITIAL_VISIBILITY_STATE = {
    old_password: false,
    new_password: false,
    confirm_new_password: false,
};

// Utility Functions
const createFormData = (userData, passwords) => {
    const formData = new FormData();
    formData.append("user_id", userData?.user_id);
    formData.append("old_password", passwords.old_password);
    formData.append("new_password", passwords.new_password);
    return formData;
};

const extractErrorMessage = (error) => {
    if (!error.response?.data) {
        return VALIDATION_MESSAGES.PASSWORD_CHANGE_ERROR;
    }
    
    const { message, error: errorField, detail } = error.response.data;
    return message || errorField || detail || VALIDATION_MESSAGES.PASSWORD_CHANGE_ERROR;
};

const isValidPassword = (password) => {
    return password && password.trim().length >= PASSWORD_MIN_LENGTH;
};

const arePasswordsMatching = (password, confirmPassword) => {
    return password === confirmPassword;
};

const arePasswordsDifferent = (oldPassword, newPassword) => {
    return oldPassword !== newPassword;
};

// Password strength checker
const getPasswordStrength = (password) => {
    if (!password) return '';
    if (password.length < 6) return 'weak';
    if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return 'medium';
    return 'strong';
};

function ChangePassword() {
    // State Management
    const [passwords, setPasswords] = useState(INITIAL_PASSWORD_STATE);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [isValidatingOldPassword, setIsValidatingOldPassword] = useState(false);
    const [showPasswords, setShowPasswords] = useState(INITIAL_VISIBILITY_STATE);

    // Event Handlers
    const handlePasswordChange = (event) => {
        const { name, value } = event.target;
        
        setPasswords(prev => ({
            ...prev,
            [name]: value,
        }));
        
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ""
            }));
        }
    };

    const togglePasswordVisibility = (field) => {
        setShowPasswords(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    // Validation Functions
    const validateOldPassword = async (oldPassword) => {
        try {
            setIsValidatingOldPassword(true);
            
            const userEmail = UserData()?.email;
            
            if (!userEmail) {
                return { 
                    isValid: false, 
                    error: VALIDATION_MESSAGES.UNABLE_TO_VERIFY 
                };
            }
            
            const response = await silentAxios.post(`user/token/`, {
                email: userEmail,
                password: oldPassword
            });
            
            if (response.status === 200) {
                return { isValid: true, error: null };
            }
            
            if (response.status === 401) {
                return { 
                    isValid: false, 
                    error: VALIDATION_MESSAGES.INCORRECT_OLD_PASSWORD 
                };
            }
            
            return { 
                isValid: false, 
                error: VALIDATION_MESSAGES.PASSWORD_CHANGE_ERROR 
            };
            
        } catch (error) {
            return { 
                isValid: false, 
                error: VALIDATION_MESSAGES.NETWORK_ERROR 
            };
        } finally {
            setIsValidatingOldPassword(false);
        }
    };

    const validatePasswordForm = () => {
        const newErrors = {};
        const { old_password, new_password, confirm_new_password } = passwords;

        // Required field validation
        if (!old_password.trim()) {
            newErrors.old_password = VALIDATION_MESSAGES.OLD_PASSWORD_REQUIRED;
        }

        if (!new_password.trim()) {
            newErrors.new_password = VALIDATION_MESSAGES.NEW_PASSWORD_REQUIRED;
        }

        if (!confirm_new_password.trim()) {
            newErrors.confirm_new_password = VALIDATION_MESSAGES.CONFIRM_PASSWORD_REQUIRED;
        }

        // Password strength validation
        if (new_password && !isValidPassword(new_password)) {
            newErrors.new_password = VALIDATION_MESSAGES.PASSWORD_TOO_SHORT;
        }

        // Password match validation
        if (new_password && confirm_new_password && 
            !arePasswordsMatching(new_password, confirm_new_password)) {
            newErrors.confirm_new_password = VALIDATION_MESSAGES.PASSWORDS_DONT_MATCH;
        }

        // Different password validation
        if (old_password && new_password && 
            !arePasswordsDifferent(old_password, new_password)) {
            newErrors.new_password = VALIDATION_MESSAGES.SAME_PASSWORD;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Form Reset Function
    const resetForm = () => {
        setPasswords(INITIAL_PASSWORD_STATE);
        setErrors({});
        setShowPasswords(INITIAL_VISIBILITY_STATE);
    };

    // Main Submit Handler
    const handleSubmit = async (event) => {
        event.preventDefault();
        
        if (!validatePasswordForm()) {
            Toast().fire({
                icon: "error",
                title: VALIDATION_MESSAGES.FORM_VALIDATION_ERROR,
            });
            return;
        }

        setLoading(true);

        try {
            // Validate old password first
            const oldPasswordValidation = await validateOldPassword(passwords.old_password);
            
            if (!oldPasswordValidation.isValid) {
                setErrors({ old_password: VALIDATION_MESSAGES.INCORRECT_OLD_PASSWORD });
                
                Toast().fire({
                    icon: "error",
                    title: oldPasswordValidation.error,
                });
                
                return;
            }

            // Proceed with password change
            const formData = createFormData(UserData(), passwords);
            const response = await useAxios.post(`user/change-password/`, formData);
            
            Toast().fire({
                icon: "success",
                title: response.data.message || VALIDATION_MESSAGES.PASSWORD_CHANGE_SUCCESS,
            });

            resetForm();

        } catch (error) {
            const errorMessage = extractErrorMessage(error);
            
            Toast().fire({
                icon: "error",
                title: errorMessage,
            });
        } finally {
            setLoading(false);
        }
    };

    // Component Rendering Functions
    const renderPasswordField = (field, icon, label, placeholder) => (
        <div className="instructor-password-field-container">
            <label className="instructor-password-label" htmlFor={field}>
                <i className={`${icon} instructor-password-label-icon`}></i>
                {label} <span className="text-danger">*</span>
            </label>
            <div className="instructor-password-input-wrapper">
                <i className={`fas fa-lock instructor-password-icon`}></i>
                <input
                    type={showPasswords[field] ? "text" : "password"}
                    className={`instructor-password-input ${errors[field] ? 'is-invalid' : ''}`}
                    id={field}
                    name={field}
                    value={passwords[field]}
                    onChange={handlePasswordChange}
                    placeholder={placeholder}
                    autoComplete="new-password"
                    aria-invalid={errors[field] ? 'true' : 'false'}
                />
                <button
                    type="button"
                    className="instructor-password-toggle"
                    onClick={() => togglePasswordVisibility(field)}
                    aria-label={`Toggle ${label.toLowerCase()} visibility`}
                    aria-expanded={showPasswords[field]}
                >
                    <i className={showPasswords[field] ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                </button>
                {/* Password Strength Indicator for new password */}
                {field === 'new_password' && passwords[field] && (
                    <div className={`instructor-password-strength-indicator instructor-password-strength-${getPasswordStrength(passwords[field])}`}></div>
                )}
                {/* Real-time password mismatch warning */}
                {field === 'confirm_new_password' && passwords[field] && passwords.new_password !== passwords[field] && (
                    <small className="instructor-password-mismatch-warning">
                        <i className="fas fa-exclamation-triangle me-1"></i>
                        Passwords do not match
                    </small>
                )}
                {errors[field] && (
                    <div className="instructor-password-error">
                        <i className="fas fa-exclamation-circle"></i>
                        {errors[field]}
                    </div>
                )}
            </div>
        </div>
    );

    const renderSecurityTips = () => (
        <div className="instructor-security-tips">
            <h6 className="instructor-security-tips-title">
                <i className="instructor-security-tips-icon fas fa-lightbulb"></i>
                Password Security Tips
            </h6>
            <div className="instructor-security-tips-grid">
                <div className="instructor-security-tip-item">
                    <i className="instructor-security-tip-icon fas fa-check-circle"></i>
                    <span>At least {PASSWORD_MIN_LENGTH} characters long</span>
                </div>
                <div className="instructor-security-tip-item">
                    <i className="instructor-security-tip-icon fas fa-check-circle"></i>
                    <span>Mix of letters and numbers</span>
                </div>
                <div className="instructor-security-tip-item">
                    <i className="instructor-security-tip-icon fas fa-check-circle"></i>
                    <span>Include special characters</span>
                </div>
            </div>
        </div>
    );

    const renderSubmitButton = () => (
        <div className="col-12">
            <div className="d-flex justify-content-end">
                <button 
                    className="instructor-submit-button" 
                    type="submit"
                    disabled={loading || isValidatingOldPassword}
                >
                    {loading ? (
                        <>
                            <span 
                                className="spinner-border spinner-border-sm" 
                                role="status" 
                                aria-hidden="true"
                            ></span>
                            {isValidatingOldPassword ? "Verifying Password..." : "Updating Password..."}
                        </>
                    ) : (
                        <>
                            <i className="fas fa-shield-alt"></i>
                            Change Password
                        </>
                    )}
                </button>
            </div>
        </div>
        
    );

    return (
        <>
            <BaseHeader />
            <section className="instructor-password-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Page Header */}
                            <div className="instructor-password-header mb-4">
                                <div></div>
                                <div className="position-relative">
                                    <h1 className="instructor-password-title mb-2">
                                        <i className="fas fa-shield-alt me-3"></i>Change Password
                                    </h1>
                                    <p className="instructor-password-subtitle text-muted">
                                        Keep your account secure with a strong password
                                    </p>
                                </div>
                            </div>

                            {/* Security Tips */}
                            {renderSecurityTips()}

                            {/* Password Change Form */}
                            <div className="instructor-password-form-container">
                                <form onSubmit={handleSubmit} autoComplete="off" noValidate>
                                    <div className="row g-4">
                                        {/* Password Fields */}
                                        {renderPasswordField(
                                            "old_password", 
                                            "fas fa-lock", 
                                            "Current Password", 
                                            "Enter your current password"
                                        )}
                                        
                                        {renderPasswordField(
                                            "new_password", 
                                            "fas fa-key", 
                                            "New Password", 
                                            `Enter new password (min ${PASSWORD_MIN_LENGTH} characters)`
                                        )}
                                        
                                        {renderPasswordField(
                                            "confirm_new_password", 
                                            "fas fa-check-double", 
                                            "Confirm New Password", 
                                            "Confirm your new password"
                                        )}

                                        {/* Submit Button */}
                                        {renderSubmitButton()}
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </>
    );
}

export default ChangePassword;