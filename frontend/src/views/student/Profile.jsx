import React, { useState, useEffect, useContext, useRef } from "react";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import ProfilePictureCropModal from "../../components/ProfilePictureCropModal/ProfilePictureCropModal";
import CountrySelector from "../../components/CountrySelector/CountrySelector";
import OptionSelector from "../../components/OptionSelector/OptionSelector";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { ProfileContext } from "../plugin/Context";
import { getValidProfileImageUrl } from "../../utils/imageUtils";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
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
    FORMAT: "image/jpeg",
    MAX_SIZE: "5MB"
};

const CROP_CONFIG = {
    INITIAL: {
        unit: "px",
        width: 200,
        height: 200,
        x: 50,
        y: 50,
        aspect: 1
    }
};

const VALIDATION_MESSAGES = {
    PROFILE_LOAD_ERROR: "Gagal memuat profil",
    PROFILE_UPDATE_SUCCESS: "Profil berhasil diperbarui!",
    PROFILE_UPDATE_ERROR: "Gagal memperbarui profil",
    IMAGE_CROP_SUCCESS: "Gambar berhasil dipotong!",
    IMAGE_CROP_ERROR: "Gagal memotong gambar",
    PICTURE_REMOVED: "Foto profil berhasil dihapus!",
    CANVAS_EMPTY: "Canvas kosong"
};

const SOCIAL_PLATFORMS = {
    FACEBOOK: "facebook",
    TWITTER: "twitter",
    LINKEDIN: "linkedin"
};

// Utility Functions
const validateUrl = (url) => {
    const urlPattern = /^https?:\/\/.+/;
    return urlPattern.test(url);
};

const formatUrl = (url) => {
    if (!url) return url;
    if (validateUrl(url)) return url;
    return url.startsWith("www.") || url.includes(".") ? `https://${url}` : url;
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
    
    // Handle image upload/deletion logic
    if (profileData.image === null) {
        formdata.append("image", "");
    } else if (croppedImageBlob) {
        formdata.append("image", croppedImageBlob, fileName);
    } else if (profileData.image && profileData.image !== originalImage) {
        formdata.append("image", profileData.image);
    }

    // Profile fields
    formdata.append("full_name", profileData.full_name || "");
    formdata.append("about", profileData.about || "");
    formdata.append("country", profileData.country || "");
    
    // Employee information fields
    formdata.append("nip", profileData.nip || "");
    formdata.append("golongan", profileData.golongan || "");
    formdata.append("kelas_jabatan", profileData.kelas_jabatan || "");
    formdata.append("jenis_jabatan", profileData.jenis_jabatan || "");
    formdata.append("organization_unit_name", profileData.organization_unit_name || "");
    formdata.append("position_name", profileData.position_name || "");
    
    // Add social media fields
    formdata.append("bio", profileData.bio || "");
    formdata.append("facebook", profileData.facebook || "");
    formdata.append("twitter", profileData.twitter || "");
    formdata.append("linkedin", profileData.linkedin || "");

    return formdata;
};

const extractFileName = (imagePath) => {
    if (!imagePath) return "";
    return imagePath.split("/").pop() || "profile-picture";
};

const getCroppedImage = (image, crop, fileName) => {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d");

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

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error(VALIDATION_MESSAGES.CANVAS_EMPTY));
                return;
            }
            blob.name = fileName;
            resolve(blob);
        }, IMAGE_CONFIG.FORMAT, IMAGE_CONFIG.QUALITY);
    });
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
    const isCollapsed = useSidebarCollapse();
    
    const [profileData, setProfileData] = useState({
        image: "",
        full_name: "",
        about: "",
        country: "",
        // Student social media fields
        bio: "",
        facebook: "",
        twitter: "",
        linkedin: "",
    });
    
    const [uiState, setUiState] = useState({
        loading: true,
        imagePreview: "",
        showCropModal: false,
        autoSaving: false,      // ✨ PHASE 4.12.4: Track auto-save status
        autoSaveStatus: "idle"  // ✨ PHASE 4.12.4: idle | saving | saved | error
    });
    
    const [imageState, setImageState] = useState({
        selected: null,
        croppedBlob: null,
        fileName: ""
    });
    
    // ✨ PHASE 11.7 CRITICAL FIX: Use useRef to preserve cropped blob across state render cycles
    // The state closure issue caused croppedBlob to be lost during the 100ms setTimeout delay
    // useRef survives re-renders and doesn't trigger re-renders when updated
    const croppedBlobRef = useRef(null);
    
    const [cropState, setCropState] = useState({
        crop: CROP_CONFIG.INITIAL,
        completedCrop: null
    });
    
    // ✨ PHASE 4.12.3: Employee information options
    const [employeeOptions, setEmployeeOptions] = useState({
        organizations: [],
        positions: [],
        golongan: [],
        jenis_jabatan: []
    });
    const [employeeOptionsLoading, setEmployeeOptionsLoading] = useState(true);  // ✨ Track loading state
    
    const imgRef = useRef(null);
    
    // ✨ PHASE 4.12.4: Auto-save debounce timer and previous data tracking
    const autoSaveTimeoutRef = useRef(null);
    const previousDataRef = useRef(profileData);

    // API Functions
    
    // ✨ PHASE 4.12.4: Auto-save profile with debounce (without image upload)
    const autoSaveProfile = async (dataToSave) => {
        try {
            setUiState(prev => ({ ...prev, autoSaving: true, autoSaveStatus: "saving" }));
            
            const userId = UserData()?.user_id;
            if (!userId) throw new Error("User ID not found");
            
            // Create a simple form data with only changed fields (no images)
            const formdata = new FormData();
            Object.keys(dataToSave).forEach(key => {
                if (dataToSave[key] !== null && dataToSave[key] !== undefined) {
                    // Skip image files in auto-save (only button click with manual image cropping does images)
                    if (key !== 'image' && !(dataToSave[key] instanceof File || dataToSave[key] instanceof Blob)) {
                        formdata.append(key, dataToSave[key]);
                    }
                }
            });
            
const updateRes = await useAxios.patch(`user/profile/${userId}/`, formdata);
            
            // Update local state with server response
            setProfileData(updateRes.data);
            previousDataRef.current = updateRes.data;
            
            setUiState(prev => ({ ...prev, autoSaving: false, autoSaveStatus: "saved" }));
            
            // ✨ PHASE 4.12.5: Show Toast notification on top-right
            Toast().fire({
                icon: "success",
                title: "Perubahan Tersimpan",
                text: "Profil Anda telah diperbarui",
                timer: 3000,
                showConfirmButton: false
            });
            
            // Clear "saved" status after 2 seconds
            setTimeout(() => {
                setUiState(prev => ({ ...prev, autoSaveStatus: "idle" }));
            }, 2000);
            
        } catch (error) {
            console.error("❌ Error auto-saving profile:", error);
            setUiState(prev => ({ ...prev, autoSaving: false, autoSaveStatus: "error" }));
            
            // ✨ PHASE 4.12.5: Show Toast error notification on top-right
            Toast().fire({
                icon: "error",
                title: "Gagal Menyimpan",
                text: error.response?.data?.detail || "Terjadi kesalahan saat menyimpan profil",
                timer: 4000,
                showConfirmButton: false
            });
            
            // Clear "error" status after 3 seconds
            setTimeout(() => {
                setUiState(prev => ({ ...prev, autoSaveStatus: "idle" }));
            }, 3000);
        }
    };

    const fetchProfile = async () => {
        setUiState(prev => ({ ...prev, loading: true }));

        
        try {
            const profileRes = await useAxios.get(`user/profile/${UserData()?.user_id}/`);
            
            // ✨ PHASE 4.12.5: Ensure jenis_jabatan is string, not null/undefined
            const processedData = {
                ...profileRes.data,
                jenis_jabatan: profileRes.data.jenis_jabatan || ""  // Convert null/undefined to empty string
            };
            
            setProfile(profileRes.data);
            setProfileData(processedData);
            
            // ✅ FIX: Validate image URL before setting (handles null, invalid strings)
            const validImageUrl = getValidProfileImageUrl(profileRes.data.image, "");
            setUiState(prev => ({ ...prev, imagePreview: validImageUrl }));
            
            setImageState(prev => ({
                ...prev,
                fileName: extractFileName(profileRes.data.image)
            }));
        } catch (error) {
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
        try {
            setUiState(prev => ({ ...prev, loading: true }));
            
            const userId = UserData()?.user_id;
            if (!userId) throw new Error("User ID not found");
            
            // Get current profile to pass existing image
            const res = await useAxios.get(`user/profile/${userId}/`);
            
            // ✨ PHASE 11.6: Generate unique filename to prevent overwrites between users
            const uniqueFilename = generateUniqueFilename(userId, imageState.fileName);
            
            // ✨ PHASE 11.7: Use REF instead of STATE to avoid closure issues
            const blobToUse = croppedBlobRef.current || imageState.croppedBlob;
            
            // Create form data using the proven createFormData function with unique filename
            const formdata = createFormData(
                profileData,
                blobToUse,  // ← Use REF-backed blob to survive closure
                uniqueFilename,  // ✨ Use unique filename instead of original
                res.data.image
            );

            // ✨ PHASE 11.5: FIX - Do NOT set Content-Type header for FormData!
            // useAxios interceptor will handle it correctly by removing it and letting browser add boundary
            const updateRes = await useAxios.patch(`user/profile/${userId}/`, formdata);
            
            // ✨ PHASE 11.8: Cache-bust image URL to force browser reload (fixes BOTH navbar AND profile form avatars)
            // Problem: Same filename means same URL, browser won't fetch new image from cache
            // Solution: Add timestamp parameter to force fresh fetch
            const cacheBustedImageUrl = updateRes.data.image 
                ? `${updateRes.data.image}?v=${Date.now()}` 
                : updateRes.data.image;
            
            // ✅ Update context immediately with cache-busted image URL
            const dataToUpdateContext = { ...updateRes.data, image: cacheBustedImageUrl };
            setProfile(dataToUpdateContext);
            
            // ✅ Update local state with fresh data
            setProfileData(updateRes.data);
            
            // ✅ Update image preview with the CACHE-BUSTED image URL (fixes profile form avatar!)
            const validImageUrl = getValidProfileImageUrl(cacheBustedImageUrl, "");
            setUiState(prev => ({ ...prev, imagePreview: validImageUrl }));
            
            // ✅ Update filename and clear cropped blob
            setImageState(prev => ({
                ...prev,
                fileName: extractFileName(updateRes.data.image),
                croppedBlob: null,
                selected: null  // ✨ Also clear selected to allow new file selection
            }));
            
            Toast().fire({
                icon: "success",
                title: "Foto Profil Berhasil Disimpan",
                text: "Avatar Anda telah diperbarui"
            });
            
            // ✨ PHASE 11.6 FIX: Reset file input to allow re-selecting new avatar
            // This fixes the issue where crop modal doesn't reappear after successful upload
            const fileInput = document.getElementById("profileImage");
            if (fileInput) {
                fileInput.value = "";
            }
            
        } catch (error) {
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

            const updateRes = await useAxios.patch(`user/profile/${userId}/`, formdata);
            
            // ✨ PHASE 11.8: Cache-bust image URL to force browser reload (fixes BOTH navbar AND profile form avatars)
            // Problem: Same filename means same URL, browser won't fetch new image from cache
            // Solution: Add timestamp parameter to force fresh fetch
            const cacheBustedImageUrl = updateRes.data.image 
                ? `${updateRes.data.image}?v=${Date.now()}` 
                : updateRes.data.image;
            console.log('🔄 Cache-busting: Added timestamp to image URL:', cacheBustedImageUrl);
            
            // ✅ CRITICAL: Update context IMMEDIATELY with cache-busted image URL
            const dataToUpdateContext = { ...updateRes.data, image: cacheBustedImageUrl };
            setProfile(dataToUpdateContext);
            
            // ✅ Update local state with fresh data
            setProfileData(updateRes.data);
            
            // ✅ Update image preview with the CACHE-BUSTED image URL (fixes profile form avatar!)
            const validImageUrl = getValidProfileImageUrl(cacheBustedImageUrl, "");
            setUiState(prev => ({ ...prev, imagePreview: validImageUrl }));
            
            // ✅ Update filename
            setImageState(prev => ({
                ...prev,
                fileName: extractFileName(updateRes.data.image),
                croppedBlob: null // Clear cropped blob after successful upload
            }));
            
            Toast().fire({
                icon: "success",
                title: VALIDATION_MESSAGES.PROFILE_UPDATE_SUCCESS
            });

            // Note: fetchProfile() call removed - we already have fresh data from updateRes
            
        } catch (error) {
            console.error("Error updating profile:", error);
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
            
            // ✨ PHASE 4.12.4: Trigger auto-save with debounce
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
            autoSaveTimeoutRef.current = setTimeout(() => {
                autoSaveProfile({
                    [name]: formattedValue
                });
            }, 1000); // 1 second debounce
            return;
        }

        setProfileData(prev => ({
            ...prev,
            [name]: value,
        }));
        
        // ✨ PHASE 4.12.4: Trigger auto-save with debounce for regular fields
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveTimeoutRef.current = setTimeout(() => {
            autoSaveProfile({
                [name]: value
            });
        }, 1000); // 1 second debounce
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
        console.log('   Current cropState:', cropState);
        console.log('   imgRef.current exists?:', !!imgRef.current);
        console.log('   imageState before crop:', { fileName: imageState.fileName, selected: !!imageState.selected, croppedBlob: !!imageState.croppedBlob });
        
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
            
            console.log('✅ CROP COMPLETED! Blob received:', { size: croppedBlob.size, sizeKB: (croppedBlob.size / 1024).toFixed(2) });
            
            // ✨ STORE BLOB IN REF IMMEDIATELY - survives state closure issues
            croppedBlobRef.current = croppedBlob;
            console.log('🔗 croppedBlobRef.current SET to blob:', { size: croppedBlob.size, refHasData: !!croppedBlobRef.current });
            
            setImageState(prev => ({
                ...prev,
                croppedBlob,  // ← THE CROPPED IMAGE IS NOW STORED HERE
            }));
            console.log('✅ Updated imageState.croppedBlob - cropped image is now ready to be submitted!');
            
            console.log('🖼️ Creating preview from cropped blob...');
            const previewUrl = URL.createObjectURL(croppedBlob);
            console.log('✅ Preview URL created:', previewUrl);
            
            setUiState(prev => ({ 
                ...prev, 
                imagePreview: previewUrl,  // ← Shows the CROPPED preview
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
                console.log('   imageState.croppedBlob before submit:', { exists: !!imageState.croppedBlob, size: imageState.croppedBlob ? imageState.croppedBlob.size : 'NOT SET' });
                await submitImageOnly();
            }, 100);
            
        } catch (error) {
            console.error("❌ Error cropping image:", error);
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
        const fileInput = document.getElementById("profileImage");
        if (fileInput) {
            fileInput.value = "";
        }
    };

    // ✨ PHASE 4.12.3: Fetch employee information options
    const fetchEmployeeOptions = async () => {
        try {
            setEmployeeOptionsLoading(true);  // ✨ Set loading state
            console.log('🔄 Fetching employee options from /api/v1/employee/options/...');
            const res = await useAxios.get('employee/options/');
            console.log('✅ Employee options loaded successfully:', res.data);
            
            // Validate response has required fields
            if (!res.data) {
                throw new Error('Empty response from employee options API');
            }
            
            const { organizations = [], positions = [], golongan = [], jenis_jabatan = [] } = res.data;
            
            console.log(`📊 Options loaded: ${organizations.length} organizations, ${positions.length} positions, ${golongan.length} golongan, ${jenis_jabatan.length} jenis_jabatan`);
            
            setEmployeeOptions({
                organizations: Array.isArray(organizations) ? organizations : [],
                positions: Array.isArray(positions) ? positions : [],
                golongan: Array.isArray(golongan) ? golongan : [],
                jenis_jabatan: Array.isArray(jenis_jabatan) ? jenis_jabatan : []
            });
        } catch (error) {
            console.error('❌ Error fetching employee options:');
            console.error('   Status:', error.response?.status);
            console.error('   URL:', error.config?.url);
            console.error('   Message:', error.response?.data?.detail || error.message);
            console.error('   Full error:', error);
            
            // Set default empty lists if fetch fails
            setEmployeeOptions({
                organizations: [],
                positions: [],
                golongan: [],
                jenis_jabatan: []
            });
        } finally {
            setEmployeeOptionsLoading(false);  // ✨ Loading complete
        }
    };
    
    // Effects
    useEffect(() => {
        fetchProfile();
        fetchEmployeeOptions();  // ✨ PHASE 4.12.3: Load employee options on mount
        
        // ✨ PHASE 4.12.5: Cleanup on unmount
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, []);
    
    // ✨ PHASE 4.12.5: Log when employee options are updated
    useEffect(() => {
        console.log('📋 Employee options state updated:', {
            organizations: employeeOptions.organizations.length,
            positions: employeeOptions.positions.length,
            golongan: employeeOptions.golongan.length,
            jenis_jabatan: employeeOptions.jenis_jabatan.length,
            data: employeeOptions
        });
    }, [employeeOptions]);
    
    // ✨ PHASE 4.12.5: Log when profileData.jenis_jabatan changes
    useEffect(() => {
        console.log('👤 ProfileData.jenis_jabatan updated:', {
            value: profileData.jenis_jabatan,
            type: typeof profileData.jenis_jabatan,
            isEmpty: !profileData.jenis_jabatan || profileData.jenis_jabatan === ""
        });
    }, [profileData.jenis_jabatan]);

    // Component Rendering Functions
    const renderLoadingAvatar = () => (
        <div className="loading-avatar">
            <div className="spinner-border text-purple" role="status">
                <span className="visually-hidden">Memuat...</span>
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
        <div style={{ position: "relative" }}>
            <img
                src={uiState.imagePreview}
                className="modern-avatar"
                alt="Profile"
                onError={(e) => {
                    e.target.style.display = "none";
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
                        Unggah foto profesional untuk profil siswa Anda
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
                        <small className="file-help-text">PNG atau JPG, maks {IMAGE_CONFIG.MAX_SIZE}</small>
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

    const renderFormField = (name, label, icon, type = "text", placeholder = "", rows = null, required = true, disabled = false) => (
        <div className="col-12">
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
                    disabled={uiState.loading || disabled}
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
                    disabled={uiState.loading || disabled}
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

    const renderEmployeeSection = () => (
        <div className="modern-form-section">
            <h4 className="form-section-title">
                <i className="fas fa-briefcase form-section-icon"></i>
                Informasi Karyawan
                <small className="text-muted ms-2">(Detail Organisasi)</small>
            </h4>
            
            {/* ✨ PHASE 4.12.3: Warning alert for temporary edits */}
            <div style={{
                padding: "12px 16px",
                backgroundColor: "#fff3cd",
                border: "1px solid #ffc107",
                borderRadius: "8px",
                marginBottom: "20px",
                color: "#856404",
                fontSize: "0.9rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px"
            }}>
                <i className="fas fa-exclamation-triangle" style={{ marginTop: "2px", flexShrink: 0 }}></i>
                <div>
                    <strong>⚠️ Perubahan Sementara</strong>
                    <p style={{ marginBottom: 0, marginTop: "4px" }}>Perubahan di sini bersifat sementara dan hanya tersimpan di profil lokal Anda. Perubahan akan dihapus setelah "Sync Data Pegawai" dilakukan. Untuk perubahan permanen, perbarui data di sistem Kepegawaian Setjen DPD RI.</p>
                </div>
            </div>
            
            <div className="row g-3">
                <div className="col-md-6">
                    {renderFormField("nip", "NIP (ID Karyawan)", "fas fa-id-card", "text", "Masukkan NIP Anda", null, false, true)}
                </div>
                
                {/* ✨ PHASE 4.12.3: Golongan Selector */}
                <div className="col-md-6">
                    <OptionSelector
                        value={profileData.golongan || ""}
                        onChange={handleProfileChange}
                        onBlur={handleProfileChange}
                        options={employeeOptions.golongan.map((g) => ({ id: g, name: g }))}
                        name="golongan"
                        id="golongan"
                        label="Golongan"
                        icon="fas fa-layer-group"
                        placeholder="Pilih golongan..."
                        required={false}
                        disabled={uiState.loading}
                        displayKey="name"
                        valueKey="id"
                        isLoading={employeeOptionsLoading}
                    />
                </div>
                
                {/* ✨ PHASE 4.12.4: Jenis Jabatan Selector */}
                <div className="col-md-6">
                    <OptionSelector
                        value={profileData.jenis_jabatan || ""}
                        onChange={(event) => {
                            const newValue = event.target.value || "";
                            setProfileData(prev => ({
                                ...prev,
                                jenis_jabatan: newValue
                            }));
                            
                            // Trigger auto-save with debounce
                            if (autoSaveTimeoutRef.current) {
                                clearTimeout(autoSaveTimeoutRef.current);
                            }
                            autoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveProfile({
                                    jenis_jabatan: newValue
                                });
                            }, 1000);
                        }}
                        onBlur={handleProfileChange}
                        options={employeeOptions.jenis_jabatan.map((j) => ({ id: j, name: j }))}
                        name="jenis_jabatan_selector"
                        id="jenis_jabatan"
                        label="Jenis Jabatan"
                        icon="fas fa-tags"
                        placeholder="Pilih jenis jabatan..."
                        required={false}
                        disabled={uiState.loading || uiState.autoSaving}
                        displayKey="name"
                        valueKey="id"
                        isLoading={employeeOptionsLoading}
                    />
                </div>
                
                {/* ✨ PHASE 4.12.3: Unit Organisasi Selector */}
                <div className="col-md-6">
                    <OptionSelector
                        value={profileData.organization_unit_name || ""}
                        onChange={(event) => {
                            handleProfileChange({
                                target: {
                                    name: "organization_unit_name",
                                    value: event.target.value || ""
                                }
                            });
                        }}
                        onBlur={handleProfileChange}
                        options={employeeOptions.organizations}
                        name="organization_unit_name"
                        id="organization_unit_name"
                        label="Unit Organisasi"
                        icon="fas fa-building"
                        placeholder="Pilih unit organisasi..."
                        required={false}
                        disabled={uiState.loading}
                        displayKey="name"
                        valueKey="name"
                        isLoading={employeeOptionsLoading}
                    />
                </div>
                
                {/* ✨ PHASE 4.12.3: Posisi Selector */}
                <div className="col-md-6">
                    <OptionSelector
                        value={profileData.position_name || ""}
                        onChange={(event) => {
                            handleProfileChange({
                                target: {
                                    name: "position_name",
                                    value: event.target.value || ""
                                }
                            });
                        }}
                        onBlur={handleProfileChange}
                        options={employeeOptions.positions}
                        name="position_name"
                        id="position_name"
                        label="Posisi"
                        icon="fas fa-user-tie"
                        placeholder="Pilih posisi..."
                        required={false}
                        disabled={uiState.loading}
                        displayKey="name"
                        valueKey="name"
                        isLoading={employeeOptionsLoading}
                    />
                </div>
            </div>
            <small className="field-help-text">
                <i className="fas fa-info-circle me-1"></i>
                Informasi karyawan disinkronkan dari sistem organisasi. Perubahan sementara Anda akan ditimpa saat sinkronisasi berikutnya.
            </small>
        </div>
    );

    const renderStudentDetails = () => (
        <div className="modern-form-section">
            <h4 className="form-section-title">
                <i className="fas fa-graduation-cap form-section-icon"></i>
                Profil Siswa
            </h4>
            
            <div className="row g-3">
                {renderFormField("bio", "Bio", false, "textarea", "Bagikan tujuan pembelajaran, minat, dan latar belakang akademik Anda...", 4)}
            </div>
            <small className="field-help-text">Bantu instruktur memahami perjalanan belajar dan tujuan Anda</small>
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
                {renderSocialField("facebook", "Facebook", "fab fa-facebook", "https://facebook.com/yourprofile", "facebook")}
                {renderSocialField("twitter", "Twitter", "fab fa-twitter", "https://twitter.com/yourhandle", "twitter")}
                {renderSocialField("linkedin", "LinkedIn", "fab fa-linkedin", "https://linkedin.com/in/yourprofile", "linkedin")}
            </div>
        </div>
    );

    const renderSubmitButton = () => (
        <div className="form-actions">
            {/* ✨ PHASE 4.12.5: Minimal status indicator - main notifications now via Toast (top-right) */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "8px 16px",
                minHeight: "36px",
                borderRadius: "8px",
                backgroundColor: uiState.autoSaveStatus === "saved" ? "#d4edda" : 
                                 uiState.autoSaveStatus === "error" ? "#f8d7da" : "#f8f9fa",
                border: uiState.autoSaveStatus === "saved" ? "1px solid #28a745" :
                        uiState.autoSaveStatus === "error" ? "1px solid #dc3545" : "1px solid #dee2e6",
                transition: "all 0.3s ease",
                fontSize: "0.9rem"
            }}>
                {uiState.autoSaveStatus === "saving" || uiState.autoSaving ? (
                    <>
                        <span className="spinner-border spinner-border-sm" role="status" style={{ width: "14px", height: "14px", borderWidth: "2px" }}></span>
                        <span style={{ color: "#667eea", fontWeight: "500" }}>Menyimpan...</span>
                    </>
                ) : uiState.autoSaveStatus === "saved" ? (
                    <>
                        <i className="fas fa-check-circle" style={{ color: "#28a745", fontSize: "1rem" }}></i>
                        <span style={{ color: "#28a745", fontWeight: "500" }}>Tersimpan</span>
                    </>
                ) : uiState.autoSaveStatus === "error" ? (
                    <>
                        <i className="fas fa-exclamation-circle" style={{ color: "#dc3545", fontSize: "1rem" }}></i>
                        <span style={{ color: "#dc3545", fontWeight: "500" }}>Gagal</span>
                    </>
                ) : (
                    <>
                        <i className="fas fa-check" style={{ color: "#6c757d", fontSize: "0.9rem" }}></i>
                        <span style={{ color: "#6c757d", fontWeight: "500" }}>Otomatis tersimpan</span>
                    </>
                )}
            </div>
        </div>
    );

    if (uiState.loading && (!profile || !profile.full_name)) {
        return (
            <>
                <BaseHeader />
                <section className="student-profile-page" style={{ minHeight: "calc(100vh - 120px)", display: "flex", alignItems: "center" }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row mt-0 md-4">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
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

            <section className="student-profile-page modern-profile-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0 md-4">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Modern Header Section */}
                            <div className="modern-header-section mb-4" style={{
                                background: "rgba(255, 255, 255, 0.95)",
                                backdropFilter: "blur(10px)",
                                borderRadius: "20px",
                                padding: "20px",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                                position: "relative",
                                overflow: "hidden"
                            }}>
                                <div style={{
                                    position: "absolute",
                                    top: "-50%",
                                    right: "-20%",
                                    width: "300px",
                                    height: "300px",
                                    background: "linear-gradient(45deg, #667eea20, #764ba220)",
                                    borderRadius: "50%",
                                    zIndex: 1
                                }}></div>
                                <div className="d-flex align-items-center justify-content-between position-relative" style={{ zIndex: 2 }}>
                                    <div>
                                        <h1 className="mb-2" style={{
                                            background: "linear-gradient(135deg, #667eea, #764ba2)",
                                            WebkitBackgroundClip: "text",
                                            WebkitTextFillColor: "transparent",
                                            fontSize: "2.5rem",
                                            fontWeight: "bold"
                                        }}>
                                            <i className="fas fa-user-edit me-3"></i>Pengaturan Profil
                                        </h1>
                                        <p className="mb-0 text-muted" style={{ fontSize: "1.1rem" }}>
                                            Kelola informasi akun dan profil siswa Anda
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Modern Profile Form - Changed from form to div to prevent button submission */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                                {/* Avatar Section */}
                                {renderAvatarSection()}

                                {/* Personal Details Section */}
                                {renderPersonalDetails()}

                                {/* Employee Information Section */}
                                {renderEmployeeSection()}

                                {/* Student Details Section */}
                                {renderStudentDetails()}

                                {/* Social Media Section */}
                                {renderSocialMediaSection()}

                                {/* Auto-save Status Section */}
                                {renderSubmitButton()}
                            </div>
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
                        unit: "px",
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
                variant="student"
            />

            <Footer />
        </>
    );
}

export default React.memo(Profile);