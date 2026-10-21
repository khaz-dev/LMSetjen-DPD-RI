import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
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
import { useRoles } from "../../utils/useRoles";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
import { getValidProfileImageUrl } from "../../utils/imageUtils";
import "./Profile.css";

// Constants
const IMAGE_CONFIG = {
    QUALITY: 0.8,
    FORMAT: "image/jpeg",
    MAX_SIZE: "5MB"
};

const CROP_CONFIG = {
    INITIAL: {
        unit: "%",
        width: 50,
        height: 50,
        x: 25,
        y: 25,
        aspect: 1
    }
};

const SOCIAL_PLATFORMS = {
    FACEBOOK: "facebook",
    TWITTER: "twitter",
    LINKEDIN: "linkedin"
};

// URL validation & formatting
const validateUrl = (url) => /^https?:\/\/.+/.test(url);
const formatUrl = (url) => {
    if (!url) return url;
    if (validateUrl(url)) return url;
    return url.startsWith("www.") || url.includes(".") ? `https://${url}` : url;
};

const generateUniqueFilename = (userId, originalFilename = "") => {
    let extension = "jpg";
    if (originalFilename && originalFilename.includes(".")) {
        extension = originalFilename.split(".").pop().toLowerCase();
        const validExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
        if (!validExtensions.includes(extension)) extension = "jpg";
    }
    return `user_${userId}.${extension}`;
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
        crop.height
    );

    return new Promise((resolve) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) return;
                blob.name = fileName;
                resolve(blob);
            },
            IMAGE_CONFIG.FORMAT,
            IMAGE_CONFIG.QUALITY
        );
    });
};

function Profile() {
    // Contexts & Hooks
    const profileContext = useContext(ProfileContext);
    const [profile, setProfile] = profileContext || [null, () => {}];
    const { isCollapsed } = useSidebarCollapse();
    const { availableRoles, currentRole } = useRoles();
    const currentUser = UserData();

    // Active Tab State: 'general', 'employee', 'roles', 'social'
    const [activeTab, setActiveTab] = useState("general");

    // Profile form state
    const [profileData, setProfileData] = useState({
        full_name: "",
        email: "",
        nip: "",
        country: "",
        about: "",
        bio: "",
        golongan: "",
        kelas_jabatan: "",
        jenis_jabatan: "",
        organization_unit_name: "",
        position_name: "",
        facebook: "",
        twitter: "",
        linkedin: "",
        image: ""
    });

    // Employee options
    const [employeeOptions, setEmployeeOptions] = useState({
        organizations: [],
        positions: [],
        golongan: [],
        jenis_jabatan: []
    });
    const [employeeOptionsLoading, setEmployeeOptionsLoading] = useState(true);

    // Image & Crop State
    const [imageState, setImageState] = useState({
        selected: null,
        croppedBlob: null,
        fileName: ""
    });
    const [cropState, setCropState] = useState({
        crop: CROP_CONFIG.INITIAL,
        completedCrop: null
    });
    const [fileInputKey, setFileInputKey] = useState(0);

    // UI state
    const [uiState, setUiState] = useState({
        loading: true,
        saving: false,
        autoSaving: false,
        autoSaveStatus: "idle",
        showCropModal: false,
        imagePreview: ""
    });

    const imgRef = useRef(null);
    const croppedBlobRef = useRef(null);
    const autoSaveTimeoutRef = useRef(null);
    const previousDataRef = useRef({});

    // Profile Completeness Calculation
    const completenessScore = useMemo(() => {
        let score = 0;
        if (uiState.imagePreview) score += 20;
        if (profileData.full_name?.trim()) score += 15;
        if (profileData.about?.trim()) score += 15;
        if (profileData.country?.trim()) score += 10;
        if (profileData.nip?.trim() || profileData.golongan?.trim() || profileData.organization_unit_name?.trim()) score += 20;
        if (profileData.bio?.trim()) score += 10;
        if (profileData.linkedin?.trim() || profileData.twitter?.trim() || profileData.facebook?.trim()) score += 10;
        return Math.min(score, 100);
    }, [profileData, uiState.imagePreview]);

    // Role Capabilities
    const hasStudentRole = availableRoles?.includes("student") || currentUser?.roles?.includes("student") || currentUser?.is_student;
    const hasInstructorRole = availableRoles?.includes("teacher") || availableRoles?.includes("instructor") || currentUser?.is_instructor;

    // Fetch initial profile
    const fetchProfile = async () => {
        setUiState((prev) => ({ ...prev, loading: true }));
        try {
            const userId = currentUser?.user_id;
            if (!userId) return;

            const profileRes = await useAxios.get(`user/profile/${userId}/`);
            const pData = profileRes.data || {};

            let tData = null;
            try {
                const teacherRes = await useAxios.get(`teacher/profile/${userId}/`);
                if (teacherRes.data) tData = teacherRes.data;
            } catch (e) {
                // Not a blocker
            }

            const merged = {
                ...pData,
                email: pData.email || currentUser?.email || "",
                full_name: pData.full_name || currentUser?.full_name || "",
                nip: pData.nip || "",
                golongan: pData.golongan || "",
                kelas_jabatan: pData.kelas_jabatan || "",
                jenis_jabatan: pData.jenis_jabatan || "",
                organization_unit_name: pData.organization_unit_name || "",
                position_name: pData.position_name || "",
                bio: tData?.bio || pData.bio || "",
                facebook: tData?.facebook || pData.facebook || "",
                twitter: tData?.twitter || pData.twitter || "",
                linkedin: tData?.linkedin || pData.linkedin || "",
                about: pData.about || "",
                country: pData.country || ""
            };

            setProfile(pData);
            setProfileData(merged);
            previousDataRef.current = merged;

            const validImageUrl = getValidProfileImageUrl(pData.image, "");
            setUiState((prev) => ({ ...prev, imagePreview: validImageUrl }));
            setImageState((prev) => ({
                ...prev,
                fileName: extractFileName(pData.image)
            }));
        } catch (error) {
            console.error("Error fetching student profile:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat profil siswa"
            });
        } finally {
            setUiState((prev) => ({ ...prev, loading: false }));
        }
    };

    // Fetch Employee Options
    const fetchEmployeeOptions = async () => {
        try {
            setEmployeeOptionsLoading(true);
            const res = await useAxios.get("employee/options/");
            if (res.data) {
                const { organizations = [], positions = [], golongan = [], jenis_jabatan = [] } = res.data;
                setEmployeeOptions({
                    organizations: Array.isArray(organizations) ? organizations : [],
                    positions: Array.isArray(positions) ? positions : [],
                    golongan: Array.isArray(golongan) ? golongan : [],
                    jenis_jabatan: Array.isArray(jenis_jabatan) ? jenis_jabatan : []
                });
            }
        } catch (err) {
            console.warn("Could not load employee options:", err);
        } finally {
            setEmployeeOptionsLoading(false);
        }
    };

    // Save profile method (unified)
    const saveProfileData = async (dataToSave, isManual = false) => {
        try {
            if (isManual) {
                setUiState((prev) => ({ ...prev, saving: true }));
            } else {
                setUiState((prev) => ({ ...prev, autoSaving: true, autoSaveStatus: "saving" }));
            }

            const userId = currentUser?.user_id;
            if (!userId) throw new Error("User ID tidak ditemukan");

            const formdata = new FormData();
            Object.keys(dataToSave).forEach((key) => {
                if (dataToSave[key] !== null && dataToSave[key] !== undefined) {
                    if (key !== "image" && !(dataToSave[key] instanceof File || dataToSave[key] instanceof Blob)) {
                        formdata.append(key, dataToSave[key]);
                    }
                }
            });

            const updateRes = await useAxios.patch(`user/profile/${userId}/`, formdata);

            // Sync teacher fields if present
            const teacherFields = ["bio", "facebook", "twitter", "linkedin"];
            const hasTeacherFields = Object.keys(dataToSave).some((k) => teacherFields.includes(k));
            if (hasTeacherFields && hasInstructorRole) {
                try {
                    await useAxios.patch(`teacher/profile-update/${userId}/`, {
                        bio: dataToSave.bio ?? profileData.bio ?? "",
                        facebook: dataToSave.facebook ?? profileData.facebook ?? "",
                        twitter: dataToSave.twitter ?? profileData.twitter ?? "",
                        linkedin: dataToSave.linkedin ?? profileData.linkedin ?? ""
                    });
                } catch (tErr) {
                    console.warn("Sinkronisasi instruktur:", tErr);
                }
            }

            setProfile(updateRes.data);
            setProfileData((prev) => ({ ...prev, ...updateRes.data }));
            previousDataRef.current = { ...profileData, ...updateRes.data };

            if (isManual) {
                setUiState((prev) => ({ ...prev, saving: false, autoSaveStatus: "saved" }));
                Toast().fire({
                    icon: "success",
                    title: "Profil Berhasil Disimpan",
                    text: "Data profil telah disinkronkan di akun Anda",
                    timer: 2500,
                    showConfirmButton: false
                });
            } else {
                setUiState((prev) => ({ ...prev, autoSaving: false, autoSaveStatus: "saved" }));
            }

            setTimeout(() => {
                setUiState((prev) => ({ ...prev, autoSaveStatus: "idle" }));
            }, 2500);
        } catch (error) {
            console.error("Error saving profile:", error);
            setUiState((prev) => ({
                ...prev,
                saving: false,
                autoSaving: false,
                autoSaveStatus: "error"
            }));
            if (isManual) {
                Toast().fire({
                    icon: "error",
                    title: "Gagal Menyimpan",
                    text: error.response?.data?.detail || "Terjadi kesalahan saat menyimpan profil",
                    timer: 3500,
                    showConfirmButton: false
                });
            }
            setTimeout(() => {
                setUiState((prev) => ({ ...prev, autoSaveStatus: "idle" }));
            }, 3000);
        }
    };

    // Generic change handler with debounce
    const handleProfileChange = (event) => {
        const { name, value } = event.target;
        let processedValue = value;

        if (Object.values(SOCIAL_PLATFORMS).includes(name) && value) {
            processedValue = formatUrl(value);
        }

        setProfileData((prev) => ({
            ...prev,
            [name]: processedValue
        }));

        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        autoSaveTimeoutRef.current = setTimeout(() => {
            saveProfileData({ [name]: processedValue }, false);
        }, 1200);
    };

    const handleSubmitManual = (e) => {
        if (e) e.preventDefault();
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }
        saveProfileData(profileData, true);
    };

    // Avatar handlers
    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;

        if (imageState.selected) {
            URL.revokeObjectURL(imageState.selected);
        }

        const newImageUrl = URL.createObjectURL(selectedFile);
        setProfileData((prev) => ({
            ...prev,
            [event.target.name]: selectedFile
        }));

        setImageState((prev) => ({
            ...prev,
            fileName: selectedFile.name,
            selected: newImageUrl
        }));

        setCropState({
            crop: CROP_CONFIG.INITIAL,
            completedCrop: null
        });

        setUiState((prev) => ({ ...prev, showCropModal: true }));
    };

    const submitImageOnly = async () => {
        try {
            setUiState((prev) => ({ ...prev, loading: true }));
            const userId = currentUser?.user_id;
            if (!userId) throw new Error("User ID not found");

            const res = await useAxios.get(`user/profile/${userId}/`);
            const uniqueFilename = generateUniqueFilename(userId, imageState.fileName);
            const blobToUse = croppedBlobRef.current || imageState.croppedBlob;

            const formdata = new FormData();
            if (blobToUse) {
                formdata.append("image", blobToUse, uniqueFilename);
            }
            formdata.append("full_name", profileData.full_name || "");
            formdata.append("about", profileData.about || "");
            formdata.append("country", profileData.country || "");

            const updateRes = await useAxios.patch(`user/profile/${userId}/`, formdata);

            const cacheBustedImageUrl = updateRes.data.image
                ? `${updateRes.data.image}?v=${Date.now()}`
                : updateRes.data.image;

            setProfile({ ...updateRes.data, image: cacheBustedImageUrl });
            setProfileData((prev) => ({ ...prev, ...updateRes.data }));

            const validImageUrl = getValidProfileImageUrl(cacheBustedImageUrl, "");
            setUiState((prev) => ({ ...prev, imagePreview: validImageUrl }));
            setImageState((prev) => ({
                ...prev,
                fileName: extractFileName(updateRes.data.image),
                croppedBlob: null,
                selected: null
            }));

            Toast().fire({
                icon: "success",
                title: "Foto Profil Berhasil Diperbarui"
            });
            setFileInputKey((prev) => prev + 1);
        } catch (error) {
            console.error("Error saving image:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal Mengunggah Foto"
            });
        } finally {
            setUiState((prev) => ({ ...prev, loading: false }));
        }
    };

    const handleCropComplete = async () => {
        if (!cropState.completedCrop || !imgRef.current) return;

        try {
            const croppedBlob = await getCroppedImage(
                imgRef.current,
                cropState.completedCrop,
                imageState.fileName
            );

            croppedBlobRef.current = croppedBlob;
            setImageState((prev) => ({ ...prev, croppedBlob }));

            const previewUrl = URL.createObjectURL(croppedBlob);
            setUiState((prev) => ({
                ...prev,
                imagePreview: previewUrl,
                showCropModal: false
            }));

            setProfileData((prev) => ({ ...prev, image: croppedBlob }));

            setTimeout(async () => {
                await submitImageOnly();
            }, 100);
        } catch (error) {
            console.error("Error cropping image:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memotong gambar"
            });
        }
    };

    const handleCropCancel = () => {
        if (imageState.selected) {
            URL.revokeObjectURL(imageState.selected);
        }
        setUiState((prev) => ({ ...prev, showCropModal: false }));
        setImageState({
            selected: null,
            croppedBlob: null,
            fileName: ""
        });
        setCropState({
            crop: CROP_CONFIG.INITIAL,
            completedCrop: null
        });
        setFileInputKey((prev) => prev + 1);
    };

    const handleDeleteProfilePicture = async () => {
        try {
            setUiState((prev) => ({ ...prev, loading: true }));
            const userId = currentUser?.user_id;
            if (!userId) throw new Error("User ID not found");

            const formdata = new FormData();
            formdata.append("image", "");
            formdata.append("full_name", profileData.full_name || "");

            const updateRes = await useAxios.patch(`user/profile/${userId}/`, formdata);

            setProfile(updateRes.data);
            setProfileData((prev) => ({ ...prev, ...updateRes.data }));
            setUiState((prev) => ({ ...prev, imagePreview: "" }));
            setImageState({
                selected: null,
                croppedBlob: null,
                fileName: ""
            });

            const fileInput = document.getElementById("profileImage");
            if (fileInput) fileInput.value = "";

            Toast().fire({
                icon: "success",
                title: "Foto profil dihapus"
            });
        } catch (error) {
            console.error("Error deleting image:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal menghapus foto profil"
            });
        } finally {
            setUiState((prev) => ({ ...prev, loading: false }));
        }
    };

    // Lifecycle
    useEffect(() => {
        fetchProfile();
        fetchEmployeeOptions();

        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, []);

    // Full-page spinner on initial load
    if (uiState.loading && !profile) {
        return (
            <>
                <BaseHeader />
                <section className="student-profile-page modern-profile-page pt-4 pb-4">
                    <div className="container">
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div
                                className={`col-lg-9 col-md-8 col-12 ${
                                    isCollapsed ? "sidebar-collapsed-adapted" : ""
                                }`}
                                style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}
                            >
                                <div className="text-center">
                                    <div className="spinner-border text-teal-dpd" role="status" style={{ width: "2.8rem", height: "2.8rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted fw-semibold">Memuat Pengaturan Profil Siswa...</p>
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

                    <div className="row">
                        <Sidebar />

                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            
                            {/* ========================================================
                                COMPACT EXECUTIVE IDENTITY HERO
                                ======================================================== */}
                            <div className="profile-hero-card">
                                <div className="profile-hero-accent-strip student-strip"></div>
                                <div className="profile-hero-body">
                                    {/* Left: Avatar with camera trigger */}
                                    <div className="profile-avatar-wrapper">
                                        <div className="profile-avatar-circle student-avatar-circle">
                                            {uiState.imagePreview ? (
                                                <img
                                                    src={uiState.imagePreview}
                                                    alt={profileData.full_name || "Profile"}
                                                    className="profile-avatar-img"
                                                    onError={(e) => {
                                                        e.target.style.display = "none";
                                                        setUiState((prev) => ({ ...prev, imagePreview: "" }));
                                                    }}
                                                />
                                            ) : (
                                                <div className="profile-avatar-placeholder">
                                                    <i className="fas fa-graduation-cap"></i>
                                                </div>
                                            )}
                                            
                                            <label htmlFor="profileImage" className="avatar-edit-badge" title="Ubah Foto Profil">
                                                <i className="fas fa-camera"></i>
                                                <input
                                                    key={fileInputKey}
                                                    type="file"
                                                    id="profileImage"
                                                    name="image"
                                                    onChange={handleFileChange}
                                                    accept="image/*"
                                                    style={{ display: "none" }}
                                                    disabled={uiState.loading}
                                                />
                                            </label>
                                        </div>

                                        {uiState.imagePreview && (
                                            <button
                                                type="button"
                                                className="btn-delete-avatar-mini"
                                                onClick={handleDeleteProfilePicture}
                                                title="Hapus foto profil"
                                                disabled={uiState.loading}
                                            >
                                                <i className="fas fa-trash-can"></i> Hapus
                                            </button>
                                        )}
                                    </div>

                                    {/* Middle: Identity & Roles */}
                                    <div className="profile-hero-info">
                                        <div className="hero-title-row">
                                            <h2 className="hero-full-name">
                                                {profileData.full_name || currentUser?.full_name || "Peserta Setjen DPD RI"}
                                            </h2>
                                            <span className="badge-verified" title="Akun Terverifikasi Setjen DPD RI">
                                                <i className="fas fa-circle-check"></i> Terverifikasi
                                            </span>
                                        </div>

                                        <div className="hero-meta-row">
                                            <span className="hero-meta-item" title="Email Pengguna">
                                                <i className="fas fa-envelope text-teal"></i>
                                                {profileData.email || currentUser?.email || "email@dpd.go.id"}
                                            </span>
                                            {profileData.nip && (
                                                <span className="hero-meta-item" title="Nomor Induk Pegawai">
                                                    <i className="fas fa-id-card text-teal"></i>
                                                    NIP: {profileData.nip}
                                                </span>
                                            )}
                                            {profileData.organization_unit_name && (
                                                <span className="hero-meta-item" title="Unit Kerja">
                                                    <i className="fas fa-building text-teal"></i>
                                                    {profileData.organization_unit_name}
                                                </span>
                                            )}
                                        </div>

                                        {/* Multi-Role Badges Connection */}
                                        <div className="hero-roles-bar">
                                            <span className="role-tag-pill role-student-active" title="Peran Aktif: Peserta">
                                                <i className="fas fa-graduation-cap"></i> Peserta Pelatihan DPD RI
                                            </span>

                                            {hasInstructorRole && (
                                                <Link 
                                                    to="/instructor/profile/" 
                                                    className="role-tag-pill role-instructor-link"
                                                    title="Terhubung dengan Peran Instruktur / Pengajar. Klik untuk beralih ke profil instruktur"
                                                >
                                                    <i className="fas fa-chalkboard-user"></i> Terhubung: Instruktur Setjen
                                                    <i className="fas fa-arrow-up-right-from-square role-link-icon"></i>
                                                </Link>
                                            )}

                                            {profileData.golongan && (
                                                <span className="role-tag-pill role-gov" title="Golongan / Pangkat">
                                                    <i className="fas fa-layer-group"></i> Gol: {profileData.golongan}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Completeness & Quick Actions */}
                                    <div className="profile-hero-actions">
                                        <div className="completeness-box">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <span className="completeness-label">Kelengkapan</span>
                                                <span className="completeness-pct">{completenessScore}%</span>
                                            </div>
                                            <div className="completeness-progress-track">
                                                <div
                                                    className="completeness-progress-bar"
                                                    style={{ width: `${completenessScore}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="hero-btn-group">
                                            <Link
                                                to="/student/sertifikat/"
                                                className="btn-hero-outline"
                                                title="Lihat sertifikat pelatihan yang telah diperoleh"
                                            >
                                                <i className="fas fa-award"></i> Sertifikat Saya
                                            </Link>

                                            <button
                                                type="button"
                                                onClick={handleSubmitManual}
                                                disabled={uiState.saving || uiState.loading}
                                                className="btn-hero-primary"
                                                title="Simpan semua perubahan profil sekarang"
                                            >
                                                {uiState.saving ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                                        Menyimpan...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-floppy-disk me-1"></i> Simpan
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* Auto-save Status Chip */}
                                        <div className={`autosave-chip autosave-${uiState.autoSaveStatus}`}>
                                            {uiState.autoSaveStatus === "saving" ? (
                                                <>
                                                    <span className="spinner-grow spinner-grow-sm me-1" role="status"></span>
                                                    <span>Menyimpan otomatis...</span>
                                                </>
                                            ) : uiState.autoSaveStatus === "saved" ? (
                                                <>
                                                    <i className="fas fa-check-circle me-1 text-success"></i>
                                                    <span>Tersimpan</span>
                                                </>
                                            ) : uiState.autoSaveStatus === "error" ? (
                                                <>
                                                    <i className="fas fa-circle-exclamation me-1 text-danger"></i>
                                                    <span>Gagal simpan</span>
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-cloud-arrow-up me-1"></i>
                                                    <span>Auto-sync aktif</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ========================================================
                                COMPACT SEGMENTED NAVIGATION TABS
                                ======================================================== */}
                            <div className="profile-tabs-nav">
                                <button
                                    type="button"
                                    className={`profile-tab-btn ${activeTab === "general" ? "active" : ""}`}
                                    onClick={() => setActiveTab("general")}
                                >
                                    <i className="fas fa-user-circle"></i>
                                    <span>Data Utama & Akun</span>
                                </button>

                                <button
                                    type="button"
                                    className={`profile-tab-btn ${activeTab === "employee" ? "active" : ""}`}
                                    onClick={() => setActiveTab("employee")}
                                >
                                    <i className="fas fa-building-columns"></i>
                                    <span>Kepegawaian DPD RI</span>
                                </button>

                                <button
                                    type="button"
                                    className={`profile-tab-btn ${activeTab === "roles" ? "active" : ""}`}
                                    onClick={() => setActiveTab("roles")}
                                >
                                    <i className="fas fa-user-graduate"></i>
                                    <span>Profil Peran (Peserta & Instruktur)</span>
                                    <span className="tab-pill-role-badge">Terpadu</span>
                                </button>

                                <button
                                    type="button"
                                    className={`profile-tab-btn ${activeTab === "social" ? "active" : ""}`}
                                    onClick={() => setActiveTab("social")}
                                >
                                    <i className="fas fa-share-nodes"></i>
                                    <span>Media Sosial & Tautan</span>
                                </button>
                            </div>

                            {/* ========================================================
                                TAB CONTENT PANELS
                                ======================================================== */}
                            <div className="profile-tab-content-card">
                                <form onSubmit={handleSubmitManual}>
                                    
                                    {/* TAB 1: DATA UTAMA & AKUN */}
                                    {activeTab === "general" && (
                                        <div className="tab-pane-content fade-in">
                                            <div className="section-intro-bar">
                                                <div>
                                                    <h4 className="section-heading">
                                                        <i className="fas fa-user-shield me-2 text-teal"></i>
                                                        Informasi Identitas & Akun Peserta
                                                    </h4>
                                                    <p className="section-subtext">
                                                        Identitas ini diselaraskan otomatis antara peran Peserta dan Instruktur Anda di LMS Setjen DPD RI.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="row g-3">
                                                <div className="col-md-6 col-12">
                                                    <label className="compact-label" htmlFor="full_name">
                                                        Nama Lengkap <span className="text-danger">*</span>
                                                    </label>
                                                    <div className="input-group-compact">
                                                        <span className="input-group-icon"><i className="fas fa-user"></i></span>
                                                        <input
                                                            type="text"
                                                            id="full_name"
                                                            name="full_name"
                                                            className="form-control compact-input"
                                                            placeholder="Nama lengkap beserta gelar..."
                                                            value={profileData.full_name || ""}
                                                            onChange={handleProfileChange}
                                                            required
                                                            disabled={uiState.loading}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <label className="compact-label" htmlFor="email">
                                                        Email Akun (SSO Terpadu)
                                                    </label>
                                                    <div className="input-group-compact input-readonly">
                                                        <span className="input-group-icon"><i className="fas fa-envelope"></i></span>
                                                        <input
                                                            type="email"
                                                            id="email"
                                                            name="email"
                                                            className="form-control compact-input"
                                                            value={profileData.email || currentUser?.email || ""}
                                                            readOnly
                                                            disabled
                                                        />
                                                        <span className="input-badge-verified" title="Email terdaftar di SSO Setjen DPD RI">
                                                            <i className="fas fa-lock"></i> SSO
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <CountrySelector
                                                        value={profileData.country || ""}
                                                        onChange={handleProfileChange}
                                                        onBlur={handleProfileChange}
                                                        name="country"
                                                        id="country"
                                                        required={true}
                                                        disabled={uiState.loading}
                                                        placeholder="Pilih atau cari negara..."
                                                        label="Negara / Domisili"
                                                        icon="fas fa-globe-asia"
                                                    />
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <label className="compact-label">
                                                        Status Hak Akses Multi-Peran
                                                    </label>
                                                    <div className="roles-status-card">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <span className="badge-linked-role">
                                                                <i className="fas fa-graduation-cap me-1"></i> Peserta Pelatihan Aktif
                                                            </span>
                                                            {hasInstructorRole && (
                                                                <span className="badge-active-role">
                                                                    <i className="fas fa-chalkboard-user me-1"></i> Instruktur Terhubung
                                                                </span>
                                                            )}
                                                        </div>
                                                        <small className="roles-status-hint">
                                                            Data identitas dan kepegawaian otomatis terhubung tanpa duplikasi formulir.
                                                        </small>
                                                    </div>
                                                </div>

                                                <div className="col-12">
                                                    <label className="compact-label" htmlFor="about">
                                                        Tentang Diri Saya (Ringkasan Profil Umum)
                                                    </label>
                                                    <textarea
                                                        id="about"
                                                        name="about"
                                                        className="form-control compact-textarea"
                                                        rows="3"
                                                        placeholder="Ceritakan latar belakang, fokus tugas, atau minat pengembangan kompetensi Anda..."
                                                        value={profileData.about || ""}
                                                        onChange={handleProfileChange}
                                                        disabled={uiState.loading}
                                                    ></textarea>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 2: DATA KEPEGAWAIAN SETJEN DPD RI */}
                                    {activeTab === "employee" && (
                                        <div className="tab-pane-content fade-in">
                                            <div className="section-intro-bar">
                                                <div>
                                                    <h4 className="section-heading">
                                                        <i className="fas fa-landmark me-2 text-teal"></i>
                                                        Data Kepegawaian Setjen DPD RI
                                                    </h4>
                                                    <p className="section-subtext">
                                                        Data resmi pegawai digunakan untuk pencatatan JP pelatihan, sertifikat ASN, dan penugasan kediklatan.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="employee-sync-notice">
                                                <i className="fas fa-circle-info notice-icon"></i>
                                                <div className="notice-body">
                                                    <strong>Sinkronisasi Terpadu Kepegawaian</strong>
                                                    <p>
                                                        Data kepegawaian ini digunakan bersama untuk peran Anda sebagai Peserta maupun Instruktur.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="row g-3">
                                                <div className="col-md-6 col-12">
                                                    <label className="compact-label" htmlFor="nip">
                                                        NIP (Nomor Induk Pegawai)
                                                    </label>
                                                    <div className="input-group-compact input-readonly">
                                                        <span className="input-group-icon"><i className="fas fa-id-badge"></i></span>
                                                        <input
                                                            type="text"
                                                            id="nip"
                                                            name="nip"
                                                            className="form-control compact-input"
                                                            placeholder="NIP Pegawai DPD RI..."
                                                            value={profileData.nip || ""}
                                                            readOnly
                                                            disabled
                                                        />
                                                        <span className="input-badge-verified">
                                                            <i className="fas fa-shield"></i> Terdaftar
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <OptionSelector
                                                        value={profileData.golongan || ""}
                                                        onChange={handleProfileChange}
                                                        onBlur={handleProfileChange}
                                                        options={employeeOptions.golongan.map((g) => ({ id: g, name: g }))}
                                                        name="golongan"
                                                        id="golongan"
                                                        label="Pangkat / Golongan Ruang"
                                                        icon="fas fa-layer-group"
                                                        placeholder="Pilih golongan ruang..."
                                                        required={false}
                                                        disabled={uiState.loading}
                                                        displayKey="name"
                                                        valueKey="id"
                                                        isLoading={employeeOptionsLoading}
                                                    />
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <OptionSelector
                                                        value={profileData.jenis_jabatan || ""}
                                                        onChange={(event) => {
                                                            const newValue = event.target.value || "";
                                                            setProfileData((prev) => ({ ...prev, jenis_jabatan: newValue }));
                                                            if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                                            autoSaveTimeoutRef.current = setTimeout(() => {
                                                                saveProfileData({ jenis_jabatan: newValue }, false);
                                                            }, 1200);
                                                        }}
                                                        onBlur={handleProfileChange}
                                                        options={employeeOptions.jenis_jabatan.map((j) => ({ id: j, name: j }))}
                                                        name="jenis_jabatan"
                                                        id="jenis_jabatan"
                                                        label="Jenis Jabatan"
                                                        icon="fas fa-tags"
                                                        placeholder="Pilih jenis jabatan ASN..."
                                                        required={false}
                                                        disabled={uiState.loading}
                                                        displayKey="name"
                                                        valueKey="id"
                                                        isLoading={employeeOptionsLoading}
                                                    />
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <OptionSelector
                                                        value={profileData.organization_unit_name || ""}
                                                        onChange={(event) => {
                                                            const newValue = event.target.value || "";
                                                            setProfileData((prev) => ({ ...prev, organization_unit_name: newValue }));
                                                            if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                                            autoSaveTimeoutRef.current = setTimeout(() => {
                                                                saveProfileData({ organization_unit_name: newValue }, false);
                                                            }, 1200);
                                                        }}
                                                        onBlur={handleProfileChange}
                                                        options={employeeOptions.organizations}
                                                        name="organization_unit_name"
                                                        id="organization_unit_name"
                                                        label="Unit Organisasi / Biro / Bagian"
                                                        icon="fas fa-sitemap"
                                                        placeholder="Pilih unit kerja Setjen DPD RI..."
                                                        required={false}
                                                        disabled={uiState.loading}
                                                        displayKey="name"
                                                        valueKey="name"
                                                        isLoading={employeeOptionsLoading}
                                                    />
                                                </div>

                                                <div className="col-12">
                                                    <OptionSelector
                                                        value={profileData.position_name || ""}
                                                        onChange={(event) => {
                                                            const newValue = event.target.value || "";
                                                            setProfileData((prev) => ({ ...prev, position_name: newValue }));
                                                            if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                                            autoSaveTimeoutRef.current = setTimeout(() => {
                                                                saveProfileData({ position_name: newValue }, false);
                                                            }, 1200);
                                                        }}
                                                        onBlur={handleProfileChange}
                                                        options={employeeOptions.positions}
                                                        name="position_name"
                                                        id="position_name"
                                                        label="Nama Jabatan / Posisi"
                                                        icon="fas fa-briefcase"
                                                        placeholder="Pilih atau cari jabatan Anda..."
                                                        required={false}
                                                        disabled={uiState.loading}
                                                        displayKey="name"
                                                        valueKey="name"
                                                        isLoading={employeeOptionsLoading}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 3: PROFIL PERAN (PESERTA & INSTRUKTUR) */}
                                    {activeTab === "roles" && (
                                        <div className="tab-pane-content fade-in">
                                            <div className="section-intro-bar">
                                                <div>
                                                    <h4 className="section-heading">
                                                        <i className="fas fa-users-gear me-2 text-teal"></i>
                                                        Profil Peran Terintegrasi (Peserta & Instruktur)
                                                    </h4>
                                                    <p className="section-subtext">
                                                        Kedua peran saling terhubung tanpa duplikasi data. Anda dapat mengelola tujuan belajar sekaligus aspek kepakaran pengajar.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="roles-dual-grid">
                                                
                                                {/* Role Card: Siswa / Peserta Pelatihan */}
                                                <div className="role-subcard student-card">
                                                    <div className="role-subcard-header">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="role-icon-box student-icon-box">
                                                                <i className="fas fa-graduation-cap"></i>
                                                            </div>
                                                            <div>
                                                                <h5 className="role-subcard-title">Peran Siswa / Peserta</h5>
                                                                <span className="role-subcard-subtitle">Pengembangan Kompetensi ASN DPD RI</span>
                                                            </div>
                                                        </div>
                                                        <span className="role-badge-pill-stud">Aktif</span>
                                                    </div>

                                                    <div className="role-subcard-body">
                                                        <div className="mb-3">
                                                            <label className="compact-label" htmlFor="student_bio">
                                                                Bio / Minat Pengembangan Belajar
                                                            </label>
                                                            <textarea
                                                                id="student_bio"
                                                                name="bio"
                                                                className="form-control compact-textarea"
                                                                rows="3"
                                                                placeholder="Tuliskan target kompetensi atau bidang diklat yang ingin Anda pelajari..."
                                                                value={profileData.bio || ""}
                                                                onChange={handleProfileChange}
                                                                disabled={uiState.loading}
                                                            ></textarea>
                                                        </div>

                                                        <div className="role-quick-shortcuts">
                                                            <span className="shortcuts-label">Akses Cepat Peserta:</span>
                                                            <div className="shortcuts-links-row">
                                                                <Link to="/student/courses/" className="shortcut-chip">
                                                                    <i className="fas fa-play-circle"></i> Kursus Saya
                                                                </Link>
                                                                <Link to="/student/sertifikat/" className="shortcut-chip">
                                                                    <i className="fas fa-award text-amber"></i> Sertifikat
                                                                </Link>
                                                                <Link to="/student/activities/" className="shortcut-chip">
                                                                    <i className="fas fa-clock-rotate-left"></i> Riwayat Belajar
                                                                </Link>
                                                                <Link to="/student/dashboard/" className="shortcut-chip">
                                                                    <i className="fas fa-gauge-high"></i> Dasbor
                                                                </Link>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Role Card: Instruktur / Widyaiswara */}
                                                <div className="role-subcard instructor-card">
                                                    <div className="role-subcard-header">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="role-icon-box instructor-icon-box">
                                                                <i className="fas fa-chalkboard-user"></i>
                                                            </div>
                                                            <div>
                                                                <h5 className="role-subcard-title">Peran Instruktur / Pengajar</h5>
                                                                <span className="role-subcard-subtitle">Pemateri Kursus & Widyaiswara</span>
                                                            </div>
                                                        </div>
                                                        <span className="role-badge-pill-inst">
                                                            {hasInstructorRole ? "Terhubung" : "Tersedia"}
                                                        </span>
                                                    </div>

                                                    <div className="role-subcard-body">
                                                        <div className="mb-3">
                                                            <label className="compact-label">
                                                                Status Instruktur Terhubung
                                                            </label>
                                                            <div className="student-profile-sync-box">
                                                                <div className="d-flex align-items-center gap-2 mb-2">
                                                                    <i className="fas fa-circle-check text-teal"></i>
                                                                    <span className="fw-semibold text-dark">Data Pengajar Terintegrasi</span>
                                                                </div>
                                                                <p className="student-sync-desc mb-2">
                                                                    Jika Anda mengajar kursus, data profil dan biografi kepakaran otomatis terhubung dengan kartu instruktur publik tanpa perlu mengisi ulang data dasar.
                                                                </p>
                                                                {hasInstructorRole ? (
                                                                    <Link to="/instructor/profile/" className="btn-switch-role-view">
                                                                        <i className="fas fa-arrow-right-arrow-left me-1"></i> Buka Pengaturan Profil Instruktur
                                                                    </Link>
                                                                ) : (
                                                                    <span className="text-muted small">Hubungi admin untuk aktivasi peran pengajar.</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {hasInstructorRole && (
                                                            <div className="role-quick-shortcuts">
                                                                <span className="shortcuts-label">Akses Cepat Instruktur:</span>
                                                                <div className="shortcuts-links-row">
                                                                    <Link to="/instructor/courses/" className="shortcut-chip">
                                                                        <i className="fas fa-book-open"></i> Kursus Diajar
                                                                    </Link>
                                                                    <Link to="/instructor/reviews/" className="shortcut-chip">
                                                                        <i className="fas fa-star text-warning"></i> Ulasan
                                                                    </Link>
                                                                    <Link to="/instructor/dashboard/" className="shortcut-chip">
                                                                        <i className="fas fa-chalkboard"></i> Dasbor Instruktur
                                                                    </Link>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 4: MEDIA SOSIAL & TAUTAN PUBLIK */}
                                    {activeTab === "social" && (
                                        <div className="tab-pane-content fade-in">
                                            <div className="section-intro-bar">
                                                <div>
                                                    <h4 className="section-heading">
                                                        <i className="fas fa-globe me-2 text-teal"></i>
                                                        Tautan Media Sosial & Jejaring Profesional
                                                    </h4>
                                                    <p className="section-subtext">
                                                        Tautan ini memudahkan instruktur dan rekan kerja di lingkungan DPD RI untuk terhubung.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="row g-3">
                                                <div className="col-md-4 col-12">
                                                    <label className="compact-label" htmlFor="linkedin">
                                                        <i className="fab fa-linkedin text-primary me-1"></i> LinkedIn
                                                    </label>
                                                    <div className="input-group-compact">
                                                        <span className="input-group-icon text-primary"><i className="fab fa-linkedin-in"></i></span>
                                                        <input
                                                            type="url"
                                                            id="linkedin"
                                                            name="linkedin"
                                                            className="form-control compact-input"
                                                            placeholder="https://linkedin.com/in/profil"
                                                            value={profileData.linkedin || ""}
                                                            onChange={handleProfileChange}
                                                            disabled={uiState.loading}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="col-md-4 col-12">
                                                    <label className="compact-label" htmlFor="twitter">
                                                        <i className="fab fa-x-twitter text-dark me-1"></i> Twitter / X
                                                    </label>
                                                    <div className="input-group-compact">
                                                        <span className="input-group-icon text-dark"><i className="fab fa-x-twitter"></i></span>
                                                        <input
                                                            type="url"
                                                            id="twitter"
                                                            name="twitter"
                                                            className="form-control compact-input"
                                                            placeholder="https://x.com/username"
                                                            value={profileData.twitter || ""}
                                                            onChange={handleProfileChange}
                                                            disabled={uiState.loading}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="col-md-4 col-12">
                                                    <label className="compact-label" htmlFor="facebook">
                                                        <i className="fab fa-facebook text-primary me-1"></i> Facebook
                                                    </label>
                                                    <div className="input-group-compact">
                                                        <span className="input-group-icon text-primary"><i className="fab fa-facebook-f"></i></span>
                                                        <input
                                                            type="url"
                                                            id="facebook"
                                                            name="facebook"
                                                            className="form-control compact-input"
                                                            placeholder="https://facebook.com/profil"
                                                            value={profileData.facebook || ""}
                                                            onChange={handleProfileChange}
                                                            disabled={uiState.loading}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Bottom Sticky Action Bar */}
                                    <div className="profile-form-footer">
                                        <div className="footer-status-indicator">
                                            <i className="fas fa-shield-halved text-teal me-1"></i>
                                            <span>Semua perubahan tersinkronisasi aman ke profil LMS Setjen DPD RI</span>
                                        </div>

                                        <div className="footer-buttons">
                                            <button
                                                type="button"
                                                onClick={fetchProfile}
                                                className="btn-footer-reset"
                                                disabled={uiState.loading || uiState.saving}
                                            >
                                                <i className="fas fa-rotate-left me-1"></i> Reset
                                            </button>

                                            <button
                                                type="submit"
                                                className="btn-footer-save"
                                                disabled={uiState.loading || uiState.saving}
                                            >
                                                {uiState.saving ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                        Menyimpan...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-check-double me-2"></i> Simpan Perubahan
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>

                        </div>
                    </div>
                </div>
            </section>

            {/* Image Cropping Modal */}
            <ProfilePictureCropModal
                show={uiState.showCropModal}
                imageSrc={imageState.selected}
                crop={cropState.crop}
                completedCrop={cropState.completedCrop}
                onCropChange={(c) => setCropState((prev) => ({ ...prev, crop: c }))}
                onCropComplete={(c) => setCropState((prev) => ({ ...prev, completedCrop: c }))}
                onApplyCrop={handleCropComplete}
                onCancel={handleCropCancel}
                imgRef={imgRef}
                onImageLoad={(e) => {
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
                        x,
                        y
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