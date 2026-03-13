import React, { useState, useEffect, useContext, useRef } from "react";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LoadingSpinner from "./Partials/LoadingSpinner";
import MinimalLoader from "./Partials/MinimalLoader";
import ProfilePictureCropModal from "../../components/ProfilePictureCropModal/ProfilePictureCropModal";
import CountrySelector from "../../components/CountrySelector/CountrySelector";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { ProfileContext } from "../plugin/Context";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
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
    PROFILE_LOAD_ERROR: "Gagal memuat profil",
    PROFILE_UPDATE_SUCCESS: "Profil berhasil diperbarui!",
    PROFILE_UPDATE_ERROR: "Gagal memperbarui profil",
    TEACHER_UPDATE_WARNING: "Profil diperbarui, tetapi pembaruan data instruktur gagal",
    TEACHER_EXISTS: "Instans instruktur mungkin sudah ada",
    IMAGE_CROP_SUCCESS: "Gambar berhasil dipotong!",
    IMAGE_CROP_ERROR: "Gagal memotong gambar",
    PICTURE_REMOVED: "Foto profil dihapus!",
    CANVAS_EMPTY: "Kanvas kosong"
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

// ✨ PHASE 11.6: Generate unique filename based on user ID to prevent overwrites
const generateUniqueFilename = (userId, originalFilename = "") => {
    // Extract file extension from original filename or default to jpg
    let extension = "jpg";
    if (originalFilename && originalFilename.includes(".")) {
        extension = originalFilename.split(".").pop().toLowerCase();
        // Validate extension to prevent abuse
        const validExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
        if (!validExtensions.includes(extension)) {
            extension = "jpg";
        }
    }
    // Generate unique filename: user_{id}.{extension}
    return `user_${userId}.${extension}`;
};

const createFormData = (profileData, croppedImageBlob, fileName, originalImage) => {
    const formdata = new FormData();
    
    console.log('📝 createFormData CALLED with:', {
        profileDataImageType: typeof profileData.image,
        profileDataImageSize: profileData.image instanceof Blob ? (profileData.image.size / 1024).toFixed(2) + ' KB' : 'Not a Blob',
        croppedImageBlobExists: !!croppedImageBlob,
        croppedImageBlobSize: croppedImageBlob ? (croppedImageBlob.size / 1024).toFixed(2) + ' KB' : 'NULL',
        fileName,
        originalImageType: typeof originalImage
    });
    
    // Handle image upload/deletion logic
    if (profileData.image === null) {
        // Image deletion - send empty string
        console.log('🔀 createFormData: Branch 1 - profileData.image is NULL → appending empty string');
        formdata.append("image", "");
    } else if (croppedImageBlob) {
        // New cropped image
        console.log('🔀 createFormData: Branch 2 - Using CROPPED blob');
        console.log('   Appending croppedImageBlob, size:', (croppedImageBlob.size / 1024).toFixed(2) + ' KB');
        formdata.append("image", croppedImageBlob, fileName);
    } else if (profileData.image && profileData.image !== originalImage) {
        // New uncropped image (fallback)
        console.log('🔀 createFormData: Branch 3 - Using profileData.image (UNCROPPED!)');
        console.log('   profileData.image size:', profileData.image instanceof Blob ? (profileData.image.size / 1024).toFixed(2) + ' KB' : 'Not a Blob');
        formdata.append("image", profileData.image);
    } else {
        console.log('🔀 createFormData: No branch matched - NO IMAGE APPENDED!');
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
    console.log('🔍 getCroppedImage CALLED with:', { crop, fileName });
    
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    console.log('📐 Canvas prepared:', { width: canvas.width, height: canvas.height, scaleX, scaleY });

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
    
    console.log('🎨 Image drawn to canvas');

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            console.log('📦 canvas.toBlob callback received, blob:', blob);
            
            if (!blob) {
                console.error('❌ CRITICAL: Blob is null/undefined!', VALIDATION_MESSAGES.CANVAS_EMPTY);
                reject(new Error(VALIDATION_MESSAGES.CANVAS_EMPTY));
                return;
            }
            blob.name = fileName;
            console.log('✅ Blob resolved:', { name: blob.name, size: blob.size, type: blob.type });
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
    const isCollapsed = useInstructorSidebarCollapse();
    
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
    const croppedBlobRef = useRef(null);  // ✨ PHASE 11.7: Persistent ref for cropped blob (survives state closure)
    
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

    // ✨ PHASE 11.4: Auto-submit image after crop completes
    const submitImageOnly = async () => {
        console.log('📤 submitImageOnly CALLED - AUTO-SAVE STARTING');
        console.log('💾 IMMEDIATE STATE CHECK (before any async operations):');
        console.log('   imageState.croppedBlob:', {
            exists: !!imageState.croppedBlob,
            isBlob: imageState.croppedBlob instanceof Blob,
            size: imageState.croppedBlob ? (imageState.croppedBlob.size / 1024).toFixed(2) + ' KB' : 'NULL',
            type: imageState.croppedBlob ? imageState.croppedBlob.type : 'N/A'
        });
        console.log('   profileData.image:', {
            exists: !!profileData.image,
            isBlob: profileData.image instanceof Blob,
            size: profileData.image instanceof Blob ? (profileData.image.size / 1024).toFixed(2) + ' KB' : 'Not a Blob',
            type: typeof profileData.image
        });
        console.log('   imageState.selected:', {
            exists: !!imageState.selected,
            type: typeof imageState.selected
        });
        
        try {
            setUiState(prev => ({ ...prev, loading: true }));
            
            const userId = UserData()?.user_id;
            console.log('👤 userId from UserData():', userId);
            if (!userId) throw new Error("User ID not found");
            
            // Get current profile to pass existing image
            console.log(`🔄 Fetching current profile from /user/profile/${userId}/`);
            const res = await useAxios.get(`user/profile/${userId}/`);
            console.log('✅ Profile fetched:', res.data);
            
            // ✨ PHASE 11.6: Generate unique filename to prevent overwrites between users
            const uniqueFilename = generateUniqueFilename(userId, imageState.fileName);
            console.log(`📝 Generated unique filename: ${uniqueFilename}`);
            
            // ✨ PHASE 11.6 CRITICAL CHECK: Verify we have the cropped blob!
            console.log('🔍 ABOUT TO SUBMIT - Final check (STATE vs REF):');
            console.log('   imageState.croppedBlob exists?:', !!imageState.croppedBlob);
            console.log('   imageState.croppedBlob size:', imageState.croppedBlob ? (imageState.croppedBlob.size / 1024).toFixed(2) + ' KB' : 'NOT SET');
            console.log('   croppedBlobRef.current exists?:', !!croppedBlobRef.current);
            console.log('   croppedBlobRef.current size:', croppedBlobRef.current ? (croppedBlobRef.current.size / 1024).toFixed(2) + ' KB' : 'NOT SET');
            console.log('   profileData.image type:', typeof profileData.image);
            
            // ✨ PHASE 11.7: Use REF instead of STATE to avoid closure issues
            const blobToUse = croppedBlobRef.current || imageState.croppedBlob;
            console.log('🔗 Using blob from:', croppedBlobRef.current ? 'REF (persistent)' : 'STATE (may be lost)');
            console.log('   Final blob to submit - size:', blobToUse ? (blobToUse.size / 1024).toFixed(2) + ' KB' : 'NONE!');
            
            // Create form data using the proven createFormData function with unique filename
            console.log('📝 Creating FormData with createFormData()...');
            const formdata = createFormData(
                profileData,
                blobToUse,  // ← Use REF-backed blob to survive closure
                uniqueFilename,  // ✨ Use unique filename instead of original
                res.data.image
            );
            console.log('📝 FormData created with unique filename:', uniqueFilename);
            console.log('✅ This FormData contains the cropped image (verify with logs above)');

            console.log(`📡 Sending PATCH to /user/profile/${userId}/`);
            // ✨ PHASE 11.5: FIX - Do NOT set Content-Type header for FormData!
            // useAxios interceptor will handle it correctly by removing it and letting browser add boundary
            const updateRes = await useAxios.patch(`user/profile/${userId}/`, formdata);
            console.log('✅ API Response received:', updateRes.data);
            
            // ✨ PHASE 11.8: Cache-bust image URL to force browser reload (fixes BOTH navbar AND profile form avatars)
            // Problem: Same filename means same URL, browser won't fetch new image from cache
            // Solution: Add timestamp parameter to force fresh fetch
            const cacheBustedImageUrl = updateRes.data.image 
                ? `${updateRes.data.image}?v=${Date.now()}` 
                : updateRes.data.image;
            console.log('🔄 Cache-busting: Added timestamp to image URL:', cacheBustedImageUrl);
            
            // ✅ Update context immediately with cache-busted image URL
            const dataToUpdateContext = { ...updateRes.data, image: cacheBustedImageUrl };
            setProfile(dataToUpdateContext);
            console.log('✅ ProfileContext updated with cache-busted image URL');
            
            // ✅ Update local state with fresh data
            setProfileData(updateRes.data);
            console.log('✅ Local profileData updated');
            
            // ✅ Update image preview with the CACHE-BUSTED image URL (fixes profile form avatar!)
            const validImageUrl = getValidProfileImageUrl(cacheBustedImageUrl, "");
            console.log('✅ Image preview updated with cache-busted URL:', validImageUrl);
            setUiState(prev => ({ ...prev, imagePreview: validImageUrl }));
            
            // ✅ Update filename and clear cropped blob
            setImageState(prev => ({
                ...prev,
                fileName: extractFileName(updateRes.data.image),
                croppedBlob: null,
                selected: null  // ✨ Also clear selected to allow new file selection
            }));
            
            console.log('📢 Showing success toast...');
            Toast().fire({
                icon: "success",
                title: "Foto Profil Berhasil Disimpan",
                text: "Avatar Anda telah diperbarui"
            });
            
            // ✨ PHASE 11.6 FIX: Reset file input to allow re-selecting new avatar
            // This fixes the issue where crop modal doesn't reappear after successful upload
            console.log('🔄 Resetting file input for next upload...');
            const fileInput = document.getElementById("profileImage");
            if (fileInput) {
                fileInput.value = "";
            }
            
        } catch (error) {
            console.error("❌ Error saving image:", error);
            console.error("   Error details:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            Toast().fire({
                icon: "error",
                title: "Gagal Menyimpan Foto",
                text: error.response?.data?.message || "Terjadi kesalahan saat menyimpan foto profil"
            });
        } finally {
            setUiState(prev => ({ ...prev, loading: false }));
        }
    };

    const submitProfile = async (e) => {
        e.preventDefault();
        setUiState(prev => ({ ...prev, loading: true }));

        try {
            const userId = UserData()?.user_id;
            if (!userId) throw new Error("User ID not found");
            
            // ✨ PHASE 11.6 CRITICAL CHECK: Prevent submitting uncropped image
            // If user selected a NEW image but hasn't clicked "Apply Crop", warn them
            if (imageState.selected && !imageState.croppedBlob) {
                console.warn('⚠️  User selected image but did not crop it!');
                Toast().fire({
                    icon: "warning",
                    title: "Gambar Belum Dipotong",
                    text: "Silakan klik 'Apply Crop' di modal pemotongan sebelum menyimpan"
                });
                setUiState(prev => ({ ...prev, loading: false }));
                return;  // Prevent submission
            }
            
            // Update Profile data
            const res = await useAxios.get(`user/profile/${userId}/`);
            
            // ✨ PHASE 11.6 CRITICAL FIX: Generate unique filename in manual submission too!
            // Without this, submitProfile would use the original filename when user clicks Simpan
            const uniqueFilename = imageState.fileName ? generateUniqueFilename(userId, imageState.fileName) : imageState.fileName;
            
            const formdata = createFormData(
                profileData, 
                imageState.croppedBlob, 
                uniqueFilename,  // ✨ Use unique filename instead of original
                res.data.image
            );

            // Update profile
            const updateRes = await useAxios.patch(`user/profile/${userId}/`, formdata);
            
            // ✨ PHASE 11.8: Cache-bust image URL to force browser reload (fixes BOTH navbar AND profile form avatars)
            // Problem: Same filename means same URL, browser won't fetch new image from cache
            // Solution: Add timestamp parameter to force fresh fetch
            const cacheBustedImageUrl = updateRes.data.image 
                ? `${updateRes.data.image}?v=${Date.now()}` 
                : updateRes.data.image;
            console.log('🔄 Cache-busting: Added timestamp to image URL:', cacheBustedImageUrl);
            
            // ✅ Update context with cache-busted image URL
            const dataToUpdateContext = { ...updateRes.data, image: cacheBustedImageUrl };
            setProfile(dataToUpdateContext);

            // Update or create Teacher data if teacher-specific fields are provided
            if (hasTeacherData(profileData)) {
                try {
                    // First, try to create Teacher instance if it doesn't exist
                    await useAxios.post(`teacher/create-from-profile/`, {
                        user_id: userId
                    });
                } catch (createError) {
                    // Teacher might already exist, that's fine
                }

                // Update teacher data
                try {
                    const teacherDataPayload = createTeacherData(profileData);
                    await useAxios.patch(`teacher/profile-update/${userId}/`, teacherDataPayload);
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
        console.log('🎬 handleCropComplete CALLED');
        console.log('   cropState:', cropState);
        console.log('   imgRef.current exists?:', !!imgRef.current);
        
        if (!cropState.completedCrop || !imgRef.current) {
            console.warn('⚠️ Early return: completedCrop missing or no imgRef');
            return;
        }

        try {
            console.log('🔄 Starting crop process...');
            const croppedBlob = await getCroppedImage(
                imgRef.current,
                cropState.completedCrop,
                imageState.fileName
            );
            
            console.log('✅ Crop completed, blob received:', croppedBlob);
            
            // ✨ STORE BLOB IN REF IMMEDIATELY - survives state closure issues
            croppedBlobRef.current = croppedBlob;
            console.log('🔗 croppedBlobRef.current SET to blob:', { size: croppedBlob.size, refHasData: !!croppedBlobRef.current });
            
            setImageState(prev => ({
                ...prev,
                croppedBlob,
            }));
            
            const previewUrl = URL.createObjectURL(croppedBlob);
            
            console.log('🖼️ Setting image preview...');
            setUiState(prev => ({ 
                ...prev, 
                imagePreview: previewUrl,
                showCropModal: false 
            }));
            
            setProfileData(prev => ({
                ...prev,
                image: croppedBlob,
            }));
            
            console.log('📢 Showing success toast...');
            Toast().fire({
                icon: "success",
                title: VALIDATION_MESSAGES.IMAGE_CROP_SUCCESS
            });
            
            // ✨ PHASE 11.4: Auto-save image immediately after successful crop
            // Schedule the submit to run after state updates are complete
            console.log('⏰ Setting setTimeout for submitImageOnly...');
            setTimeout(async () => {
                console.log('⏰ setTimeout fired! Calling submitImageOnly()...');
                await submitImageOnly();
            }, 100);
            
        } catch (error) {
            console.error('❌ Error cropping image:', error);
            Toast().fire({
                icon: "error",
                title: VALIDATION_MESSAGES.IMAGE_CROP_ERROR
            });
        }
    };

    const handleDeleteProfilePicture = async () => {
        try {
            setUiState(prev => ({ ...prev, loading: true }));
            
            const userId = UserData()?.user_id;
            if (!userId) throw new Error("User ID not found");
            
            console.log('🗑️ Deleting profile picture...');
            
            // ✨ PHASE 11.6 FIX: Submit image deletion to backend to clean up orphaned files
            const formdata = new FormData();
            formdata.append("image", "");  // Empty string signals deletion
            formdata.append("full_name", profileData.full_name || "");
            
            const updateRes = await useAxios.patch(`user/profile/${userId}/`, formdata);
            console.log('✅ Image deleted from server');
            
            // Update frontend state with response from server
            setProfile(updateRes.data);
            setProfileData(updateRes.data);
            setUiState(prev => ({ ...prev, imagePreview: "" }));
            setImageState({
                selected: null,
                croppedBlob: null,
                fileName: ""
            });
            
            // Reset file input
            const fileInput = document.getElementById("profileImage");
            if (fileInput) {
                fileInput.value = "";
            }
            
            Toast().fire({
                icon: "success",
                title: VALIDATION_MESSAGES.PICTURE_REMOVED
            });
        } catch (error) {
            console.error("❌ Error deleting image:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal Menghapus Foto",
                text: error.response?.data?.message || "Terjadi kesalahan saat menghapus foto profil"
            });
        } finally {
            setUiState(prev => ({ ...prev, loading: false }));
        }
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
            <small className="loading-text">Memuat...</small>
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
                Foto Profil
            </h4>
            
            <div className="d-flex align-items-center">
                <div className="modern-avatar-container">
                    {uiState.loading ? renderLoadingAvatar() : 
                     uiState.imagePreview ? renderProfileAvatar() : renderDefaultAvatar()}
                </div>
                
                <div className="avatar-content-section">
                    <h5 className="avatar-section-title">Pilih Avatar Anda</h5>
                    <p className="avatar-section-description">
                        Unggah foto profesional untuk profil instruktur Anda
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
                        <small className="file-help-text">PNG atau JPG, maksimal {IMAGE_CONFIG.MAX_SIZE}</small>
                    </div>
                    
                    {uiState.imagePreview && (
                        <div className="profile-picture-actions">
                            <button 
                                type="button"
                                className="btn btn-delete-picture"
                                onClick={handleDeleteProfilePicture}
                                disabled={uiState.loading}
                            >
                                <i className="fas fa-trash-alt me-1"></i>
                                Hapus Foto
                            </button>
                            <small className="picture-action-text">
                                Ini akan menghapus foto profil Anda saat ini
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
                Informasi Pribadi
            </h4>
            
            <div className="row g-3">
                {renderFormField("full_name", "Nama Lengkap", "fas fa-user", "text", "Masukkan nama lengkap Anda")}
                {renderFormField("about", "Tentang Saya", "fas fa-edit", "textarea", "Ceritakan tentang diri Anda dan latar belakang Anda...", 4)}
                
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
                        placeholder="Cari negara Anda..."
                        label="Negara"
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
                Profil Instruktur
            </h4>
            
            <div className="row">
                {renderFormField("bio", "Biografi Profesional", false, "textarea", "Deskripsikan latar belakang profesional Anda, pengalaman, dan keahlian mengajar...", 4)}
            </div>
            <small className="field-help-text">Bantu siswa belajar tentang keahlian dan gaya mengajar Anda</small>
        </div>
    );

    const renderSocialMediaSection = () => (
        <div className="modern-form-section">
            <h4 className="form-section-title">
                <i className="fas fa-share-alt form-section-icon"></i>
                Tautan Media Sosial
                <small className="text-muted ms-2">(Opsional)</small>
            </h4>
            
            <div className="row g-3">
                {renderSocialField("facebook", "Facebook", "fab fa-facebook", "https://facebook.com/profilanda", "facebook")}
                {renderSocialField("twitter", "Twitter", "fab fa-twitter", "https://twitter.com/handle_anda", "twitter")}
                {renderSocialField("linkedin", "LinkedIn", "fab fa-linkedin", "https://linkedin.com/in/profilanda", "linkedin")}
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
                        Memperbarui Profil...
                    </>
                ) : (
                    <>
                        <i className="fas fa-save submit-icon"></i>
                        Perbarui Profil
                    </>
                )}
            </button>
        </div>
    );

    // Show full-page loading spinner on initial load
    if (uiState.loading && !profile) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-profile-page modern-profile-page" style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center' }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Memuat Profil...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    return (
        <>
            <BaseHeader />

            <section className="instructor-profile-page modern-profile-page">
                <div className="container">
                    <Header />
                    <div className="row">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Modern Header Section */}
                            <div className="modern-header-section">
                                <div className="header-decoration"></div>
                                <div className="instructor-header-content">
                                    <h1 className="page-header-title">
                                        <i className="fas fa-user-edit page-header-title-icon"></i>
                                        Pengaturan Profil
                                    </h1>
                                    <p className="page-header-subtitle">
                                        Kelola informasi akun dan profil instruktur Anda
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