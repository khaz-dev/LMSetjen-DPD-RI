import React, { useState, useEffect, useContext, useRef } from "react";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LoadingSpinner from "./Partials/LoadingSpinner";
import ProfilePictureCropModal from "../../components/ProfilePictureCropModal/ProfilePictureCropModal";
import CountrySelector from "../../components/CountrySelector/CountrySelector";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { ProfileContext } from "../plugin/Context";
import "./Profile.css";

// Constants
const AVATAR_SIZE = {
    DESKTOP: {
        width: "120px",
        height: "120px"
    },
    MOBILE: {
        width: "100px", 
        height: "100px"
    }
};

const IMAGE_CONFIG = {
    QUALITY: 0.8,
    FORMAT: 'image/jpeg',
    MAX_SIZE: '5MB'
};

const CROP_CONFIG = {
    INITIAL: {
        unit: '%',
        width: 50,
        height: 50,
        x: 25,
        y: 25,
        aspect: 1
    }
};

const VALIDATION_MESSAGES = {
    PROFILE_LOAD_ERROR: "Failed to load profile",
    PROFILE_UPDATE_SUCCESS: "Profile updated successfully!",
    PROFILE_UPDATE_ERROR: "Failed to update profile",
    TEACHER_UPDATE_WARNING: "Profile updated, but teacher data update failed",
    TEACHER_EXISTS: "Teacher instance might already exist",
    IMAGE_CROP_SUCCESS: "Image cropped successfully!",
    IMAGE_CROP_ERROR: "Failed to crop image",
    PICTURE_REMOVED: "Profile picture removed!",
    CANVAS_EMPTY: "Canvas is empty"
};

const SOCIAL_PLATFORMS = {
    FACEBOOK: 'facebook',
    TWITTER: 'twitter',
    LINKEDIN: 'linkedin'
};

// Utility Functions
const validateUrl = (url) => {
    const urlPattern = /^https?:\/\/.+/;
    return urlPattern.test(url);
};

const formatUrl = (url) => {
    if (!url) return url;
    if (validateUrl(url)) return url;
    return url.startsWith('www.') || url.includes('.') ? `https://${url}` : url;
};

const createFormData = (profileData, croppedImageBlob, fileName, originalImage) => {
    const formdata = new FormData();
    
    // Handle image upload/deletion logic
    if (profileData.image === null) {
        // Image deletion - send empty string
        formdata.append("image", "");
    } else if (croppedImageBlob) {
        // New cropped image
        formdata.append("image", croppedImageBlob, fileName);
    } else if (profileData.image && profileData.image !== originalImage) {
        // New uncropped image (fallback)
        formdata.append("image", profileData.image);
    }

    // Profile fields
    formdata.append("full_name", profileData.full_name || "");
    formdata.append("about", profileData.about || "");
    formdata.append("country", profileData.country || "");

    return formdata;
};

const extractFileName = (imagePath) => {
    if (!imagePath) return "";
    return imagePath.split('/').pop() || "profile-picture";
};

const getCroppedImage = (image, crop, fileName) => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width,
        crop.height,
    );

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                console.error(VALIDATION_MESSAGES.CANVAS_EMPTY);
                return;
            }
            blob.name = fileName;
            resolve(blob);
        }, IMAGE_CONFIG.FORMAT, IMAGE_CONFIG.QUALITY);
    });
};

const createTeacherData = (profileData) => ({
    bio: profileData.bio || "",
    facebook: profileData.facebook || "",
    twitter: profileData.twitter || "",
    linkedin: profileData.linkedin || "",
});

const hasTeacherData = (profileData) => {
    return !!(profileData.bio || profileData.facebook || profileData.twitter || profileData.linkedin);
};

const createImagePreview = (file) => {
    const reader = new FileReader();
    return new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
};

function Profile() {
    // Context and State Management
    const profileContext = useContext(ProfileContext);
    const [profile, setProfile] = profileContext || [null, () => {}];
    
    const [profileData, setProfileData] = useState({
        image: "",
        full_name: "",
        about: "",
        country: "",
        // Teacher-specific fields
        bio: "",
        facebook: "",
        twitter: "",
        linkedin: "",
    });
    
    const [uiState, setUiState] = useState({
        loading: false,
        imagePreview: "",
        showCropModal: false
    });
    
    const [imageState, setImageState] = useState({
        selected: null,
        croppedBlob: null,
        fileName: ""
    });
    
    const [cropState, setCropState] = useState({
        crop: CROP_CONFIG.INITIAL,
        completedCrop: null
    });
    
    const imgRef = useRef(null);
    
    const [teacherData, setTeacherData] = useState(null);

    // API Functions
    const fetchProfile = async () => {
        setUiState(prev => ({ ...prev, loading: true }));
        
        try {
            // Fetch profile data
            const profileRes = await useAxios.get(`user/profile/${UserData()?.user_id}/`);
            setProfile(profileRes.data);
            
            // Try to fetch teacher data if user is an instructor
            let mergedData = { ...profileRes.data };
            try {
                const teacherRes = await useAxios.get(`teacher/profile/${UserData()?.user_id}/`);
                if (teacherRes.data) {
                    // If teacher data exists, merge it with profile data
                    const teacher = teacherRes.data;
                    setTeacherData(teacher);
                    mergedData = {
                        ...mergedData,
                        bio: teacher.bio || "",
                        facebook: teacher.facebook || "",
                        twitter: teacher.twitter || "",
                        linkedin: teacher.linkedin || "",
                    };
                }
            } catch (teacherError) {
                // This is fine, user might not be an instructor yet
            }
            
            setProfileData(mergedData);
            setUiState(prev => ({ ...prev, imagePreview: mergedData.image }));
            setImageState(prev => ({
                ...prev,
                fileName: extractFileName(mergedData.image)
            }));
            
        } catch (error) {
            console.error("Error fetching profile:", error);
            Toast().fire({
                icon: "error",
                title: VALIDATION_MESSAGES.PROFILE_LOAD_ERROR
            });
        } finally {
            setUiState(prev => ({ ...prev, loading: false }));
        }
    };

    const submitProfile = async (e) => {
        e.preventDefault();
        setUiState(prev => ({ ...prev, loading: true }));

        try {
            // Update Profile data
            const res = await useAxios.get(`user/profile/${UserData()?.user_id}/`);
            
            const formdata = createFormData(
                profileData, 
                imageState.croppedBlob, 
                imageState.fileName, 
                res.data.image
            );

            // Update profile
            const updateRes = await useAxios.patch(`user/profile/${UserData()?.user_id}/`, formdata, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });
            setProfile(updateRes.data);

            // Update or create Teacher data if teacher-specific fields are provided
            if (hasTeacherData(profileData)) {
                try {
                    // First, try to create Teacher instance if it doesn't exist
                    await useAxios.post(`teacher/create-from-profile/`, {
                        user_id: UserData()?.user_id
                    });
                } catch (createError) {
                    // Teacher might already exist, that's fine
                }

                // Update teacher data
                try {
                    const teacherDataPayload = createTeacherData(profileData);
                    await useAxios.patch(`teacher/profile-update/${UserData()?.user_id}/`, teacherDataPayload);
                } catch (teacherUpdateError) {
                    console.error("Error updating teacher data:", teacherUpdateError);
                    // Don't fail the entire operation if teacher update fails
                    Toast().fire({
                        icon: "warning",
                        title: VALIDATION_MESSAGES.TEACHER_UPDATE_WARNING
                    });
                }
            }
            
            Toast().fire({
                icon: "success",
                title: VALIDATION_MESSAGES.PROFILE_UPDATE_SUCCESS
            });

            // Refresh data
            fetchProfile();
            
        } catch (error) {
            console.error("[Profile] Error updating profile:", error);
            console.error("[Profile] Error response:", error.response?.data);
            Toast().fire({
                icon: "error",
                title: error.response?.data?.message || VALIDATION_MESSAGES.PROFILE_UPDATE_ERROR
            });
        } finally {
            setUiState(prev => ({ ...prev, loading: false }));
        }
    };

    // Event Handlers
    const handleProfileChange = (event) => {
        const { name, value } = event.target;
        
        // Validate URL fields for social media
        if (Object.values(SOCIAL_PLATFORMS).includes(name) && value) {
            const formattedValue = formatUrl(value);
            setProfileData(prev => ({
                ...prev,
                [name]: formattedValue,
            }));
            return;
        }

        setProfileData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;
        
        // Clean up previous object URL to prevent memory leaks
        if (imageState.selected) {
            URL.revokeObjectURL(imageState.selected);
        }
        
        const newImageUrl = URL.createObjectURL(selectedFile);
        
        setProfileData(prev => ({
            ...prev,
            [event.target.name]: selectedFile,
        }));

        setImageState(prev => ({
            ...prev,
            fileName: selectedFile.name,
            selected: newImageUrl
        }));
        
        // Reset crop state for new image
        setCropState({
            crop: CROP_CONFIG.INITIAL,
            completedCrop: null
        });
        
        setUiState(prev => ({ ...prev, showCropModal: true }));
    };

    const handleCropComplete = async () => {
        if (!cropState.completedCrop || !imgRef.current) return;

        try {
            const croppedBlob = await getCroppedImage(
                imgRef.current,
                cropState.completedCrop,
                imageState.fileName
            );
            
            setImageState(prev => ({
                ...prev,
                croppedBlob,
            }));
            
            const previewUrl = URL.createObjectURL(croppedBlob);
            
            setUiState(prev => ({ 
                ...prev, 
                imagePreview: previewUrl,
                showCropModal: false 
            }));
            
            setProfileData(prev => ({
                ...prev,
                image: croppedBlob,
            }));
            
            Toast().fire({
                icon: "success",
                title: VALIDATION_MESSAGES.IMAGE_CROP_SUCCESS
            });
        } catch (error) {
            console.error('[Profile] Error cropping image:', error);
            Toast().fire({
                icon: "error",
                title: VALIDATION_MESSAGES.IMAGE_CROP_ERROR
            });
        }
    };

    const handleDeleteProfilePicture = () => {
        setProfileData(prev => ({ ...prev, image: null }));
        setUiState(prev => ({ ...prev, imagePreview: "" }));
        setImageState({
            selected: null,
            croppedBlob: null,
            fileName: ""
        });
        
        Toast().fire({
            icon: "success",
            title: VALIDATION_MESSAGES.PICTURE_REMOVED
        });
    };

    const handleCropCancel = () => {
        // Clean up object URL to prevent memory leaks
        if (imageState.selected) {
            URL.revokeObjectURL(imageState.selected);
        }
        
        // Reset all crop-related states
        setUiState(prev => ({ ...prev, showCropModal: false }));
        setImageState({
            selected: null,
            croppedBlob: null,
            fileName: ""
        });
        setCropState({
            crop: CROP_CONFIG.INITIAL,
            completedCrop: null
        });
        
        // Reset file input to allow selecting the same file again
        const fileInput = document.getElementById('profileImage');
        if (fileInput) {
            fileInput.value = '';
        }
    };

    // Effects
    useEffect(() => {
        fetchProfile();
    }, []);

    // Component Rendering Functions
    const renderLoadingAvatar = () => (
        <div className="loading-avatar">
            <div className="custom-spinner-wrapper">
                <div className="custom-spinner"></div>
            </div>
            <small className="loading-text">Loading...</small>
        </div>
    );

    const renderDefaultAvatar = () => (
        <div className="default-avatar-modern">
            <i className="fas fa-user default-avatar-icon"></i>
        </div>
    );

    const renderProfileAvatar = () => (
        <div style={{ position: 'relative' }}>
            <img
                src={uiState.imagePreview}
                className="modern-avatar"
                alt="Profile"
                onError={(e) => {
                    e.target.style.display = 'none';
                    setUiState(prev => ({ ...prev, imagePreview: "" }));
                }}
            />
            <div className="avatar-badge">
                <i className="fas fa-check avatar-badge-icon"></i>
            </div>
        </div>
    );

    const renderAvatarSection = () => (
        <div className="modern-form-section">
            <h4 className="form-section-title">
                <i className="fas fa-camera form-section-icon"></i>
                Profile Picture
            </h4>
            
            <div className="d-flex align-items-center">
                <div className="modern-avatar-container">
                    {uiState.loading ? renderLoadingAvatar() : 
                     uiState.imagePreview ? renderProfileAvatar() : renderDefaultAvatar()}
                </div>
                
                <div className="avatar-content-section">
                    <h5 className="avatar-section-title">Choose Your Avatar</h5>
                    <p className="avatar-section-description">
                        Upload a professional photo for your instructor profile
                    </p>
                    <div className="modern-file-upload">
                        <input 
                            type="file" 
                            className="form-control modern-file-input" 
                            name="image" 
                            id="profileImage"
                            onChange={handleFileChange} 
                            accept="image/*"
                            disabled={uiState.loading}
                        />
                        <small className="file-help-text">PNG or JPG, max {IMAGE_CONFIG.MAX_SIZE}</small>
                    </div>
                    
                    {(imageState.fileName || uiState.imagePreview) && (
                        <div className="file-info">
                            <p className="file-info-text">
                                <i className="fas fa-image file-info-icon"></i>
                                <strong>Current Picture:</strong> {imageState.fileName || "Existing profile picture"}
                            </p>
                        </div>
                    )}
                    
                    {uiState.imagePreview && (
                        <div className="profile-picture-actions">
                            <button 
                                type="button"
                                className="btn btn-delete-picture"
                                onClick={handleDeleteProfilePicture}
                                disabled={uiState.loading}
                            >
                                <i className="fas fa-trash-alt me-1"></i>
                                Remove Picture
                            </button>
                            <small className="picture-action-text">
                                This will remove your current profile picture
                            </small>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderFormField = (name, label, icon, type = "text", placeholder = "", rows = null, required = true) => (
        <div className="col-12 form-field-container">
            <label className="form-label modern-label" htmlFor={name}>
                <i className={`${icon} form-label-icon`}></i>
                {label} {required && <span className="required-asterisk">*</span>}
            </label>
            {type === "textarea" ? (
                <textarea 
                    id={name}
                    name={name} 
                    className="form-control modern-input modern-textarea" 
                    rows={rows || 4} 
                    value={profileData[name] || ""}
                    placeholder={placeholder}
                    onChange={handleProfileChange}
                    disabled={uiState.loading}
                />
            ) : (
                <input 
                    type={type} 
                    id={name} 
                    name={name}
                    className="form-control modern-input" 
                    placeholder={placeholder} 
                    required={required}
                    value={profileData[name] || ""} 
                    onChange={handleProfileChange} 
                    disabled={uiState.loading}
                />
            )}
        </div>
    );

    const renderSocialField = (name, label, icon, placeholder, platform) => (
        <div className="col-md-4 col-12">
            <label className="form-label modern-label" htmlFor={name}>
                <i className={`${icon} social-icon-${platform}`}></i> {label}
            </label>
            <input 
                type="url" 
                id={name} 
                name={name}
                className={`form-control modern-input social-input-${platform}`}
                placeholder={placeholder} 
                value={profileData[name] || ""} 
                onChange={handleProfileChange} 
                disabled={uiState.loading}
            />
        </div>
    );

    const renderPersonalDetails = () => (
        <div className="modern-form-section">
            <h4 className="form-section-title">
                <i className="fas fa-info-circle form-section-icon"></i>
                Personal Information
            </h4>
            
            <div className="row g-3">
                {renderFormField("full_name", "Full Name", "fas fa-user", "text", "Enter your full name")}
                {renderFormField("about", "About Me", "fas fa-edit", "textarea", "Tell us about yourself and your background...", 4)}
                
                {/* Country Selector with Search */}
                <div className="col-12 form-field-container">
                    <CountrySelector
                        value={profileData.country || ""}
                        onChange={handleProfileChange}
                        onBlur={handleProfileChange}
                        name="country"
                        id="country"
                        required={true}
                        disabled={uiState.loading}
                        placeholder="Search for your country..."
                        label="Country"
                        icon="fas fa-globe"
                    />
                </div>
            </div>
        </div>
    );

    const renderInstructorDetails = () => (
        <div className="modern-form-section">
            <h4 className="form-section-title">
                <i className="fas fa-chalkboard-teacher form-section-icon"></i>
                Instructor Profile
            </h4>
            
            <div className="row">
                {renderFormField("bio", "Professional Bio", false, "textarea", "Describe your professional background, experience, and teaching expertise...", 4)}
            </div>
            <small className="field-help-text">Help students learn about your expertise and teaching style</small>
        </div>
    );

    const renderSocialMediaSection = () => (
        <div className="modern-form-section">
            <h4 className="form-section-title">
                <i className="fas fa-share-alt form-section-icon"></i>
                Social Media Links
                <small className="text-muted ms-2">(Optional)</small>
            </h4>
            
            <div className="row g-3">
                {renderSocialField("facebook", "Facebook", "fab fa-facebook", "https://facebook.com/yourprofile", "facebook")}
                {renderSocialField("twitter", "Twitter", "fab fa-twitter", "https://twitter.com/yourhandle", "twitter")}
                {renderSocialField("linkedin", "LinkedIn", "fab fa-linkedin", "https://linkedin.com/in/yourprofile", "linkedin")}
            </div>
        </div>
    );

    const renderSubmitButton = () => (
        <div className="form-actions">
            <button 
                className="btn modern-submit-btn" 
                type="submit"
                disabled={uiState.loading}
            >
                {uiState.loading ? (
                    <>
                        <span 
                            className="spinner-border spinner-border-sm loading-spinner-sm" 
                            role="status" 
                            aria-hidden="true"
                            style={{
                                flexShrink: 0,
                                aspectRatio: "1 / 1"
                            }}
                        ></span>
                        Updating Profile...
                    </>
                ) : (
                    <>
                        <i className="fas fa-save submit-icon"></i>
                        Update Profile
                    </>
                )}
            </button>
        </div>
    );

    // Show full-page loading spinner on initial load
    if (uiState.loading && !profile) {
        return <LoadingSpinner fullPage={true} message="Loading Profile..." />;
    }

    return (
        <>
            <BaseHeader />

            <section className="instructor-profile-page modern-profile-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Modern Header Section */}
                            <div className="modern-header-section">
                                <div className="header-decoration"></div>
                                <div className="instructor-header-content">
                                    <h1 className="page-header-title">
                                        <i className="fas fa-user-edit page-header-title-icon"></i>
                                        Profile Settings
                                    </h1>
                                    <p className="page-header-subtitle">
                                        Manage your account information and instructor profile
                                    </p>
                                </div>
                            </div>

                            {/* Modern Profile Form */}
                            <form onSubmit={submitProfile}>
                                {/* Avatar Section */}
                                {renderAvatarSection()}

                                {/* Personal Details Section */}
                                {renderPersonalDetails()}

                                {/* Instructor Details Section */}
                                {renderInstructorDetails()}

                                {/* Social Media Section */}
                                {renderSocialMediaSection()}

                                {/* Submit Section */}
                                {renderSubmitButton()}
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            {/* Image Cropping Modal - Reusable Component */}
            <ProfilePictureCropModal
                show={uiState.showCropModal}
                imageSrc={imageState.selected}
                crop={cropState.crop}
                completedCrop={cropState.completedCrop}
                onCropChange={(c) => setCropState(prev => ({ ...prev, crop: c }))}
                onCropComplete={(c) => setCropState(prev => ({ ...prev, completedCrop: c }))}
                onApplyCrop={handleCropComplete}
                onCancel={handleCropCancel}
                imgRef={imgRef}
                onImageLoad={(e) => {
                    // Calculate centered crop area based on actual rendered dimensions
                    const img = e.currentTarget;
                    const { width, height } = img;
                    const size = Math.min(width, height);
                    const cropSize = size * 0.7;
                    const x = (width - cropSize) / 2;
                    const y = (height - cropSize) / 2;
                    
                    const initialCrop = {
                        unit: 'px',
                        width: cropSize,
                        height: cropSize,
                        x: x,
                        y: y
                    };
                    
                    setCropState({
                        crop: initialCrop,
                        completedCrop: initialCrop
                    });
                }}
                variant="instructor"
            />

            <Footer />
        </>
    );
}

export default React.memo(Profile);