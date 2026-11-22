import React, { useState, useEffect, useContext, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { switchRoleAndNavigate } from "../../utils/roleUtils";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import ProfilePictureCropModal from "../../components/ProfilePictureCropModal/ProfilePictureCropModal";
import CountrySelector from "../../components/CountrySelector/CountrySelector";
import OptionSelector from "../../components/OptionSelector/OptionSelector";
import { 
    ASN_POSITIONS, 
    ASN_INSTITUTIONS_GROUPS, 
    PROFESSIONS_LIST, 
    COUNTRIES_LIST, 
    INDONESIA_PROVINCES_AND_CITIES 
} from "../../data/onboardingData";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { ProfileContext } from "../plugin/Context";
import { useRoles } from "../../utils/useRoles";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import { getValidProfileImageUrl } from "../../utils/imageUtils";
import mantaHappyWebp from "../../assets/avatar/manta-happy.webp";
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

const SOCIAL_PLATFORMS_CONFIG = [
    {
        id: "youtube",
        name: "YouTube",
        icon: "fab fa-youtube",
        color: "#ff0000",
        bgLight: "rgba(255, 0, 0, 0.08)",
        placeholder: "https://youtube.com/@channel",
        helper: "Tautan channel atau video YouTube resmi Anda"
    },
    {
        id: "instagram",
        name: "Instagram",
        icon: "fab fa-instagram",
        color: "#e1306c",
        bgLight: "rgba(225, 48, 108, 0.08)",
        placeholder: "https://instagram.com/username",
        helper: "Tautan akun Instagram resmi Anda"
    },
    {
        id: "tiktok",
        name: "TikTok",
        icon: "fab fa-tiktok",
        color: "#0f172a",
        bgLight: "rgba(15, 23, 42, 0.08)",
        placeholder: "https://tiktok.com/@username",
        helper: "Tautan profil TikTok edukatif Anda"
    },
    {
        id: "linkedin",
        name: "LinkedIn",
        icon: "fab fa-linkedin-in",
        color: "#0a66c2",
        bgLight: "rgba(10, 102, 194, 0.08)",
        placeholder: "https://linkedin.com/in/username",
        helper: "Tautan profil profesional LinkedIn Anda"
    },
    {
        id: "twitter",
        name: "Twitter / X",
        icon: "fab fa-x-twitter",
        color: "#0f172a",
        bgLight: "rgba(15, 23, 42, 0.08)",
        placeholder: "https://x.com/username",
        helper: "Tautan akun Twitter / X Anda"
    },
    {
        id: "facebook",
        name: "Facebook",
        icon: "fab fa-facebook-f",
        color: "#1877f2",
        bgLight: "rgba(24, 119, 242, 0.08)",
        placeholder: "https://facebook.com/username",
        helper: "Tautan profil atau halaman Facebook Anda"
    }
];

const SOCIAL_PLATFORMS = {
    FACEBOOK: "facebook",
    TWITTER: "twitter",
    LINKEDIN: "linkedin",
    YOUTUBE: "youtube",
    INSTAGRAM: "instagram",
    TIKTOK: "tiktok"
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
    const navigate = useNavigate();
    // Contexts & Hooks
    const profileContext = useContext(ProfileContext);
    const [profile, setProfile] = profileContext || [null, () => { }];
    const { isCollapsed } = useInstructorSidebarCollapse();
    const { availableRoles, currentRole } = useRoles();
    const currentUser = UserData();

    // Active Tab State: 'general', 'employee', 'roles', 'social'
    const [activeTab, setActiveTab] = useState("general");

    // Profile form state
    const [profileData, setProfileData] = useState({
        full_name: "",
        email: "",
        phone: "",
        user_type: "UMUM",
        is_internal: false,
        nip: "",
        instansi_asal: "",
        pekerjaan: "",
        provinsi: "",
        kota_kabupaten: "",
        country: "",
        about: "",
        bio: "",
        student_interest: "",
        golongan: "",
        kelas_jabatan: "",
        jenis_jabatan: "",
        organization_unit_name: "",
        position_name: "",
        facebook: "",
        twitter: "",
        linkedin: "",
        youtube: "",
        instagram: "",
        tiktok: "",
        image: ""
    });

    // Cascading cities based on selected province
    const availableCities = useMemo(() => {
        if (!profileData.provinsi) return [];
        return INDONESIA_PROVINCES_AND_CITIES[profileData.provinsi] || [];
    }, [profileData.provinsi]);

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
        autoSaveStatus: "idle", // 'idle' | 'saving' | 'saved' | 'error'
        showCropModal: false,
        imagePreview: ""
    });

    // Public Card Pop Up Modal state
    const [showPublicCardModal, setShowPublicCardModal] = useState(false);
    const [teacherStats, setTeacherStats] = useState({
        total_courses: 0,
        total_students: 0,
        total_rating: "5.0"
    });

    // Dynamic Social Media Form State
    const [socialForm, setSocialForm] = useState({
        isOpen: false,
        platform: "youtube",
        url: "",
        isEditing: false
    });

    const imgRef = useRef(null);
    const croppedBlobRef = useRef(null);
    const autoSaveTimeoutRef = useRef(null);
    const previousDataRef = useRef({});

    // Filter Active Social Media & Available to Add
    const activeSocialList = useMemo(() => {
        return SOCIAL_PLATFORMS_CONFIG.filter((platform) => Boolean(profileData[platform.id]?.trim()));
    }, [profileData]);

    const availablePlatformsToAdd = useMemo(() => {
        return SOCIAL_PLATFORMS_CONFIG.filter((platform) => !profileData[platform.id]?.trim());
    }, [profileData]);

    // Profile Completeness Calculation
    const completenessScore = useMemo(() => {
        let score = 0;
        if (uiState.imagePreview) score += 20;
        if (profileData.full_name?.trim()) score += 15;
        if (profileData.about?.trim()) score += 15;
        if (profileData.country?.trim()) score += 10;
        if (
            (profileData.user_type === 'INTERNAL' && (profileData.nip?.trim() || profileData.organization_unit_name?.trim())) ||
            (profileData.user_type === 'ASN' && (profileData.nip?.trim() || profileData.instansi_asal?.trim())) ||
            (profileData.user_type === 'UMUM' && (profileData.pekerjaan?.trim() || profileData.provinsi?.trim())) ||
            profileData.nip?.trim()
        ) score += 20;
        if (profileData.bio?.trim()) score += 10;
        if (
            profileData.linkedin?.trim() ||
            profileData.twitter?.trim() ||
            profileData.facebook?.trim() ||
            profileData.youtube?.trim() ||
            profileData.instagram?.trim() ||
            profileData.tiktok?.trim()
        ) score += 10;
        return Math.min(score, 100);
    }, [profileData, uiState.imagePreview]);

    // ========================================================
    // 🌟 INSTRUCTOR TEACHING GAMIFICATION & REPUTATION ENGINE
    // ========================================================
    const teachingGamification = useMemo(() => {
        const coursesCount = Number(teacherStats?.total_courses || 0);
        const studentsCount = Number(teacherStats?.total_students || 0);
        const rating = parseFloat(teacherStats?.total_rating || "5.0") || 5.0;

        // Hitung Instructor Points (IP / Poin Pengajar)
        // Formula: Kursus Aktif (150 IP) + Peserta Terbimbing (15 IP) + Bonus Rating Kepuasan
        let points = (coursesCount * 150) + (studentsCount * 15);
        if (coursesCount > 0) {
            points += Math.round(rating * 20);
        }

        // 5 Tingkat Jenjang Reputasi Pengajar Setjen DPD RI
        let level = 1;
        let level_name = "Widyaiswara Pratama";
        let level_icon = "fas fa-chalkboard-user";
        let level_color = "#0ea5e9";
        let min_xp = 0;
        let next_level_xp = 250;
        let next_level_name = "Fasilitator Terampil";
        let xp_progress_pct = 0;
        let remaining_xp = 250;

        if (points < 250) {
            level = 1;
            level_name = "Widyaiswara Pratama";
            level_icon = "fas fa-chalkboard-user";
            level_color = "#0ea5e9";
            min_xp = 0;
            next_level_xp = 250;
            next_level_name = "Fasilitator Terampil";
            xp_progress_pct = Math.min(100, Math.round((points / 250) * 100));
            remaining_xp = Math.max(0, 250 - points);
        } else if (points < 600) {
            level = 2;
            level_name = "Fasilitator Terampil";
            level_icon = "fas fa-award";
            level_color = "#10b981";
            min_xp = 250;
            next_level_xp = 600;
            next_level_name = "Mentor Teladan";
            xp_progress_pct = Math.min(100, Math.round(((points - 250) / 350) * 100));
            remaining_xp = Math.max(0, 600 - points);
        } else if (points < 1200) {
            level = 3;
            level_name = "Mentor Teladan";
            level_icon = "fas fa-gem";
            level_color = "#6366f1";
            min_xp = 600;
            next_level_xp = 1200;
            next_level_name = "Pakar Kurikulum Parlemen";
            xp_progress_pct = Math.min(100, Math.round(((points - 600) / 600) * 100));
            remaining_xp = Math.max(0, 1200 - points);
        } else if (points < 2500) {
            level = 4;
            level_name = "Pakar Kurikulum Parlemen";
            level_icon = "fas fa-medal";
            level_color = "#8b5cf6";
            min_xp = 1200;
            next_level_xp = 2500;
            next_level_name = "Maestro Widyaiswara DPD RI";
            xp_progress_pct = Math.min(100, Math.round(((points - 1200) / 1300) * 100));
            remaining_xp = Math.max(0, 2500 - points);
        } else {
            level = 5;
            level_name = "Maestro Widyaiswara DPD RI";
            level_icon = "fas fa-crown";
            level_color = "#f59e0b";
            min_xp = 2500;
            next_level_xp = points;
            next_level_name = "Puncak Reputasi Pengajar";
            xp_progress_pct = 100;
            remaining_xp = 0;
        }

        // 8 Lencana Prestasi Pengajaran (Teaching Milestone Badges)
        const badges = [
            {
                id: "first_course",
                title: "Inisiator Modul",
                category: "Penyusunan Materi",
                icon: "fas fa-book-bookmark",
                color: "#0ea5e9",
                description: "Mempublikasikan kursus pelatihan perdana Anda di lingkungan Setjen DPD RI.",
                is_unlocked: coursesCount >= 1,
                progress: `${Math.min(1, coursesCount)}/1 Kursus Terbit`,
                progress_pct: coursesCount >= 1 ? 100 : 0
            },
            {
                id: "talent_builder",
                title: "Pencetak Talenta ASN",
                category: "Dampak Pembelajaran",
                icon: "fas fa-user-graduate",
                color: "#10b981",
                description: "Membimbing minimal 10 peserta pelatihan aktif di kelas yang Anda ampu.",
                is_unlocked: studentsCount >= 10,
                progress: `${Math.min(10, studentsCount)}/10 Peserta`,
                progress_pct: Math.min(100, Math.round((studentsCount / 10) * 100))
            },
            {
                id: "five_star",
                title: "Widyaiswara Bintang Lima",
                category: "Mutu Pengajaran",
                icon: "fas fa-star",
                color: "#f59e0b",
                description: "Mempertahankan indeks kepuasan peserta minimal 4.8 bintang pada evaluasi kelas.",
                is_unlocked: coursesCount > 0 && rating >= 4.8,
                progress: coursesCount > 0 && rating >= 4.8 ? "Rating Prima 4.8+" : (coursesCount > 0 ? `${Number(rating).toFixed(1)}/4.8 ★` : "Perlu Kursus"),
                progress_pct: coursesCount > 0 && rating >= 4.8 ? 100 : (coursesCount > 0 ? Math.min(99, Math.round((rating / 5) * 100)) : 0)
            },
            {
                id: "broad_community",
                title: "Jangkauan Parlemen Luas",
                category: "Skala Edukasi",
                icon: "fas fa-people-group",
                color: "#6366f1",
                description: "Menjangkau lebih dari 30 peserta terdaftar lintas unit kerja atau instansi parlemen.",
                is_unlocked: studentsCount >= 30,
                progress: `${Math.min(30, studentsCount)}/30 Peserta`,
                progress_pct: Math.min(100, Math.round((studentsCount / 30) * 100))
            },
            {
                id: "curriculum_architect",
                title: "Arsitek Kurikulum",
                category: "Kaya Materi",
                icon: "fas fa-layer-group",
                color: "#8b5cf6",
                description: "Mengembangkan minimal 2 silabus kursus pelatihan yang aktif dan terstruktur.",
                is_unlocked: coursesCount >= 2,
                progress: `${Math.min(2, coursesCount)}/2 Kursus`,
                progress_pct: Math.min(100, Math.round((coursesCount / 2) * 100))
            },
            {
                id: "digital_innovator",
                title: "Inovator E-Learning",
                category: "Metode Interaktif",
                icon: "fas fa-laptop-code",
                color: "#06b6d4",
                description: "Menyediakan media digital interaktif, video materi, dan bank soal evaluasi.",
                is_unlocked: coursesCount >= 1,
                progress: coursesCount >= 1 ? "Modul Aktif" : "Perlu 1 Kursus",
                progress_pct: coursesCount >= 1 ? 100 : 0
            },
            {
                id: "ai_collaborator",
                title: "Kolaborator AI Manta",
                category: "Keaktifan Asisten",
                icon: "fas fa-brain",
                color: "#ec4899",
                description: "Memanfaatkan asisten Manta AI untuk konsultasi kurikulum dan penyusunan kuis adaptif.",
                is_unlocked: true,
                progress: "Fitur Terbuka",
                progress_pct: 100
            },
            {
                id: "competency_empowerer",
                title: "Pemberdaya Kompetensi ASN",
                category: "Kontribusi Lembaga",
                icon: "fas fa-landmark",
                color: "#0f766e",
                description: "Membimbing minimal 5 peserta hingga tuntas dan berkontribusi pada pemenuhan 20 JP instansi.",
                is_unlocked: coursesCount >= 1 && studentsCount >= 5,
                progress: `${Math.min(5, studentsCount)}/5 Peserta Kelas`,
                progress_pct: Math.min(100, Math.round((studentsCount / 5) * 100))
            }
        ];

        const unlocked_count = badges.filter(b => b.is_unlocked).length;

        return {
            level,
            level_name,
            level_icon,
            level_color,
            points,
            next_level_xp,
            next_level_name,
            remaining_xp,
            xp_progress_pct,
            unlocked_count,
            total_badges: badges.length,
            badges
        };
    }, [teacherStats]);

    // Role Capabilities
    const hasStudentRole = availableRoles?.includes("student") || currentUser?.roles?.includes("student") || currentUser?.is_student;
    const hasInstructorRole = availableRoles?.includes("teacher") || availableRoles?.includes("instructor") || currentUser?.is_instructor;

    // Fetch initial profile & teacher data
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
                if (teacherRes.data) {
                    tData = teacherRes.data;
                    try {
                        localStorage.setItem("instructor_cached_teacher", JSON.stringify(teacherRes.data));
                        window.dispatchEvent(new CustomEvent("instructorTeacherProfileUpdated", { detail: teacherRes.data }));
                    } catch (e) {}
                    const teacherId = teacherRes.data.id || userId;
                    try {
                        const summaryRes = await useAxios.get(`teacher/summary/${teacherId}/`);
                        const sData = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data;
                        if (sData) {
                            setTeacherStats({
                                total_courses: sData.total_courses || 0,
                                total_students: sData.total_students || 0,
                                total_rating: sData.total_rating || "5.0"
                            });
                        }
                    } catch (sumErr) {
                        // Summary stats fallback
                    }
                }
            } catch (e) {
                // Teacher profile optional fallback
            }

            const merged = {
                ...pData,
                email: pData.email || currentUser?.email || "",
                full_name: pData.full_name || currentUser?.full_name || "",
                phone: pData.phone || currentUser?.phone || "",
                user_type: pData.user_type || currentUser?.user_type || "UMUM",
                is_internal: Boolean(pData.is_internal || currentUser?.is_internal || (pData.user_type === 'INTERNAL')),
                nip: pData.nip || currentUser?.nip || "",
                instansi_asal: pData.instansi_asal || currentUser?.instansi_asal || "",
                pekerjaan: pData.pekerjaan || currentUser?.pekerjaan || "",
                provinsi: pData.provinsi || currentUser?.provinsi || "",
                kota_kabupaten: pData.kota_kabupaten || currentUser?.kota_kabupaten || "",
                golongan: pData.golongan || "",
                kelas_jabatan: pData.kelas_jabatan || "",
                jenis_jabatan: pData.jenis_jabatan || "",
                organization_unit_name: pData.organization_unit_name || "",
                position_name: pData.position_name || "",
                bio: tData?.bio || pData.bio || "",
                facebook: tData?.facebook || pData.facebook || "",
                twitter: tData?.twitter || pData.twitter || "",
                linkedin: tData?.linkedin || pData.linkedin || "",
                youtube: tData?.youtube || pData.youtube || "",
                instagram: tData?.instagram || pData.instagram || "",
                tiktok: tData?.tiktok || pData.tiktok || "",
                about: pData.about || "",
                country: pData.country || pData.negara || currentUser?.country || currentUser?.negara || "Indonesia"
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
            console.error("Error fetching profile:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat data profil"
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

    // Save profile method (used for both debounced auto-save & manual submit)
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

            // Update user/profile
            const updateRes = await useAxios.patch(`user/profile/${userId}/`, formdata);

            // Sync teacher fields explicitly
            const teacherFields = ["bio", "facebook", "twitter", "linkedin", "youtube", "instagram", "tiktok"];
            const hasTeacherFields = Object.keys(dataToSave).some((k) => teacherFields.includes(k));
            if (hasTeacherFields) {
                try {
                    const teacherPayload = {
                        bio: dataToSave.bio ?? profileData.bio ?? "",
                        facebook: dataToSave.facebook ?? profileData.facebook ?? "",
                        twitter: dataToSave.twitter ?? profileData.twitter ?? "",
                        linkedin: dataToSave.linkedin ?? profileData.linkedin ?? "",
                        youtube: dataToSave.youtube ?? profileData.youtube ?? "",
                        instagram: dataToSave.instagram ?? profileData.instagram ?? "",
                        tiktok: dataToSave.tiktok ?? profileData.tiktok ?? ""
                    };
                    await useAxios.patch(`teacher/profile-update/${userId}/`, teacherPayload);
                    window.dispatchEvent(new CustomEvent("instructorTeacherProfileUpdated", { detail: teacherPayload }));
                } catch (tErr) {
                    console.warn("Catatan sinkronisasi instruktur:", tErr);
                }
            }

            // Sync Context
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

    // Manual form submit handler
    const handleSubmitManual = async (e) => {
        if (e) e.preventDefault();
        await saveProfileData(profileData, true);
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

    // Dynamic Social Media Handlers
    const handleOpenAddSocial = () => {
        const defaultPlatform = availablePlatformsToAdd[0]?.id || "youtube";
        setSocialForm({
            isOpen: true,
            platform: defaultPlatform,
            url: "",
            isEditing: false
        });
    };

    const handleEditSocial = (platformId) => {
        setSocialForm({
            isOpen: true,
            platform: platformId,
            url: profileData[platformId] || "",
            isEditing: true
        });
    };

    const handleDeleteSocial = (platformId) => {
        const platformConfig = SOCIAL_PLATFORMS_CONFIG.find((p) => p.id === platformId);
        const platformName = platformConfig?.name || "Media Sosial";
        setProfileData((prev) => ({
            ...prev,
            [platformId]: ""
        }));
        saveProfileData({ [platformId]: "" }, false);
        if (socialForm.isEditing && socialForm.platform === platformId) {
            setSocialForm({ isOpen: false, platform: "youtube", url: "", isEditing: false });
        }
        Toast().fire({
            icon: "success",
            title: `Tautan ${platformName} Dihapus`,
            timer: 1800,
            showConfirmButton: false
        });
    };

    const handleSaveSocial = (e) => {
        if (e) e.preventDefault();
        if (!socialForm.url?.trim()) {
            Toast().fire({
                icon: "warning",
                title: "Tautan Belum Diisi",
                text: "Silakan masukkan URL / tautan profil media sosial Anda."
            });
            return;
        }

        const formatted = formatUrl(socialForm.url.trim());
        const platformConfig = SOCIAL_PLATFORMS_CONFIG.find((p) => p.id === socialForm.platform);
        const platformName = platformConfig?.name || "Media Sosial";

        setProfileData((prev) => ({
            ...prev,
            [socialForm.platform]: formatted
        }));
        saveProfileData({ [socialForm.platform]: formatted }, false);

        setSocialForm({
            isOpen: false,
            platform: "youtube",
            url: "",
            isEditing: false
        });

        Toast().fire({
            icon: "success",
            title: `Tautan ${platformName} Berhasil ${socialForm.isEditing ? "Diperbarui" : "Ditambahkan"}`,
            timer: 2000,
            showConfirmButton: false
        });
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

    // Close Public Card Modal on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && showPublicCardModal) {
                setShowPublicCardModal(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showPublicCardModal]);

    // Full-page spinner on initial load
    if (uiState.loading && !profile) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-profile-page modern-profile-page pt-4 pb-4">
                    <div className="container">
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div
                                className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""
                                    }`}
                                style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}
                            >
                                <div className="text-center">
                                    <div className="spinner-border text-teal-dpd" role="status" style={{ width: "2.8rem", height: "2.8rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted fw-semibold">Memuat Pengaturan Profil...</p>
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

                            {/* ========================================================
                                COMPACT EXECUTIVE IDENTITY HERO
                                ======================================================== */}
                            <div className="profile-hero-card">
                                <div className="profile-hero-accent-strip"></div>
                                <div className="profile-hero-body">
                                    {/* Left: Avatar with camera trigger */}
                                    <div className="profile-avatar-wrapper">
                                        <div className="profile-avatar-circle">
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
                                                    <i className="fas fa-user-tie"></i>
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
                                                {profileData.full_name || currentUser?.full_name || "Pengguna Setjen DPD RI"}
                                            </h2>
                                            <span className="badge-verified" title="Akun Terverifikasi Setjen DPD RI">
                                                <i className="fas fa-circle-check"></i> Terverifikasi
                                            </span>
                                            {(profileData.user_type === 'INTERNAL' || profileData.is_internal) ? (
                                                <span className="user-type-badge-pill internal">
                                                    <i className="fas fa-landmark me-1"></i> Internal Setjen DPD RI
                                                </span>
                                            ) : profileData.user_type === 'ASN' ? (
                                                <span className="user-type-badge-pill asn">
                                                    <i className="fas fa-id-badge me-1"></i> ASN Luar
                                                </span>
                                            ) : (
                                                <span className="user-type-badge-pill umum">
                                                    <i className="fas fa-globe me-1"></i> Masyarakat Umum
                                                </span>
                                            )}
                                        </div>

                                        <div className="hero-meta-row">
                                            <span className="hero-meta-item" title="Email Pengguna">
                                                <i className="fas fa-envelope text-teal"></i>
                                                {profileData.email || currentUser?.email || "email@dpd.go.id"}
                                            </span>
                                            {profileData.phone && (
                                                <span className="hero-meta-item" title="Nomor Telepon / WhatsApp">
                                                    <i className="fas fa-phone text-teal"></i>
                                                    {profileData.phone}
                                                </span>
                                            )}
                                            {profileData.nip && (
                                                <span className="hero-meta-item" title="Nomor Induk Pegawai">
                                                    <i className="fas fa-id-card text-teal"></i>
                                                    NIP: {profileData.nip}
                                                </span>
                                            )}
                                            {profileData.user_type === 'ASN' && profileData.instansi_asal && (
                                                <span className="hero-meta-item" title="Instansi Asal">
                                                    <i className="fas fa-building-columns text-teal"></i>
                                                    {profileData.instansi_asal}
                                                </span>
                                            )}
                                            {profileData.user_type === 'UMUM' && (profileData.pekerjaan || profileData.provinsi) && (
                                                <span className="hero-meta-item" title="Profesi & Asal Wilayah">
                                                    <i className="fas fa-briefcase text-teal"></i>
                                                    {profileData.pekerjaan ? profileData.pekerjaan : ""}{profileData.pekerjaan && profileData.provinsi ? " • " : ""}{profileData.provinsi ? profileData.provinsi : ""}
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
                                            <span className="role-tag-pill role-instructor" title="Peran Aktif: Instruktur">
                                                <i className="fas fa-chalkboard-user"></i> Instruktur DPD RI
                                            </span>

                                            {hasStudentRole && (
                                                <Link
                                                    to="/student/profile/"
                                                    className="role-tag-pill role-student-link"
                                                    title="Terhubung dengan Peran Peserta. Klik untuk melihat profil peserta"
                                                >
                                                    <i className="fas fa-graduation-cap"></i> Terhubung: Peserta Pelatihan
                                                    <i className="fas fa-arrow-up-right-from-square role-link-icon"></i>
                                                </Link>
                                            )}

                                            {profileData.golongan && (
                                                <span className="role-tag-pill role-gov" title="Golongan / Pangkat">
                                                    <i className="fas fa-layer-group"></i> Gol: {profileData.golongan}
                                                </span>
                                            )}

                                            {teachingGamification && (
                                                <button
                                                    type="button"
                                                    className="role-tag-pill border-0"
                                                    style={{
                                                        backgroundColor: `${teachingGamification.level_color || '#0ea5e9'}22`,
                                                        color: teachingGamification.level_color || '#0ea5e9',
                                                        fontWeight: 700,
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => setActiveTab("achievements")}
                                                    title={`Tingkat Reputasi Pengajar: Level ${teachingGamification.level} (${teachingGamification.level_name}) - ${teachingGamification.points} IP. Klik untuk melihat galeri prestasi pengajar`}
                                                >
                                                    <i className={teachingGamification.level_icon || 'fas fa-chalkboard-user'}></i>
                                                    Level {teachingGamification.level}: {teachingGamification.level_name} ({teachingGamification.points} IP)
                                                </button>
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
                                            <button
                                                type="button"
                                                onClick={() => setShowPublicCardModal(true)}
                                                className="btn-hero-outline"
                                                title="Lihat pop-up kartu profil publik Anda"
                                            >
                                                <i className="fas fa-id-card"></i> Profil Publik
                                            </button>

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
                                    {(profileData.user_type === 'INTERNAL' || profileData.is_internal) ? (
                                        <>
                                            <i className="fas fa-landmark"></i>
                                            <span>Kepegawaian DPD RI</span>
                                        </>
                                    ) : profileData.user_type === 'ASN' ? (
                                        <>
                                            <i className="fas fa-id-badge"></i>
                                            <span>Kepegawaian & Instansi ASN</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-globe"></i>
                                            <span>Data Kepesertaan & Domisili</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    className={`profile-tab-btn ${activeTab === "roles" ? "active" : ""}`}
                                    onClick={() => setActiveTab("roles")}
                                >
                                    <i className="fas fa-user-graduate"></i>
                                    <span>Profil Peran (Instruktur & Peserta)</span>
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

                                <button
                                    type="button"
                                    className={`profile-tab-btn ${activeTab === "achievements" ? "active" : ""}`}
                                    onClick={() => setActiveTab("achievements")}
                                >
                                    <i className="fas fa-trophy text-warning"></i>
                                    <span>Prestasi & Lencana Pengajar</span>
                                    {teachingGamification && (
                                        <span 
                                            className="badge rounded-pill text-white ms-1" 
                                            style={{ 
                                                backgroundColor: teachingGamification.level_color || '#0ea5e9',
                                                fontSize: '0.66rem',
                                                padding: '2px 7px'
                                            }}
                                        >
                                            Lv. {teachingGamification.level}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* ========================================================
                                TAB CONTENT PANELS (COMPACT 2-COLUMN GRIDS)
                                ======================================================== */}
                            <div className="profile-tab-content-card">
                                <form onSubmit={handleSubmitManual}>

                                    {/* ----------------------------------------------------
                                        TAB 1: DATA UTAMA & AKUN
                                        ---------------------------------------------------- */}
                                    {activeTab === "general" && (
                                        <div className="tab-pane-content fade-in">
                                            <div className="section-intro-bar">
                                                <div>
                                                    <h4 className="section-heading">
                                                        <i className="fas fa-user-shield me-2 text-teal"></i>
                                                        Informasi Identitas & Akun
                                                    </h4>
                                                    <p className="section-subtext">
                                                        Identitas utama ini berlaku konsisten untuk akun Anda di seluruh sistem LMS Setjen DPD RI.
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
                                                        <span className="input-badge-verified" title="Email terdaftar di sistem SSO Setjen DPD RI">
                                                            <i className="fas fa-lock"></i> SSO
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <label className="compact-label" htmlFor="phone">
                                                        Nomor Telepon / WhatsApp
                                                    </label>
                                                    <div className="input-group-compact">
                                                        <span className="input-group-icon"><i className="fas fa-phone"></i></span>
                                                        <input
                                                            type="tel"
                                                            id="phone"
                                                            name="phone"
                                                            className="form-control compact-input"
                                                            placeholder="Contoh: 081234567890"
                                                            value={profileData.phone || ""}
                                                            onChange={handleProfileChange}
                                                            disabled={uiState.loading}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="col-md-6 col-12">
                                                    <label className="compact-label">
                                                        Kategori Pengguna LMS
                                                    </label>
                                                    <div className="input-group-compact input-readonly">
                                                        <span className="input-group-icon">
                                                            <i className={`fas ${(profileData.user_type === 'INTERNAL' || profileData.is_internal) ? "fa-landmark text-primary" : profileData.user_type === 'ASN' ? "fa-id-badge text-success" : "fa-globe text-info"}`}></i>
                                                        </span>
                                                        <input
                                                            type="text"
                                                            className="form-control compact-input fw-semibold"
                                                            value={
                                                                (profileData.user_type === 'INTERNAL' || profileData.is_internal)
                                                                    ? "Internal Setjen DPD RI (SSO Nusa)"
                                                                    : profileData.user_type === 'ASN'
                                                                    ? "Aparatur Sipil Negara (ASN Luar)"
                                                                    : "Masyarakat Umum"
                                                            }
                                                            readOnly
                                                            disabled
                                                        />
                                                        <span className="input-badge-verified">
                                                            <i className="fas fa-check-circle"></i> Terdaftar
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
                                                            <span className="badge-active-role">
                                                                <i className="fas fa-check-circle me-1"></i> Instruktur / Widyaiswara
                                                            </span>
                                                            {hasStudentRole && (
                                                                <span className="badge-linked-role">
                                                                    <i className="fas fa-graduation-cap me-1"></i> Peserta Pelatihan
                                                                </span>
                                                            )}
                                                        </div>
                                                        <small className="roles-status-hint">
                                                            Akun Anda memiliki akses ganda. Data profil otomatis tersinkronisasi.
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
                                                        placeholder="Ceritakan latar belakang, fokus tugas, atau ringkasan profesional Anda..."
                                                        value={profileData.about || ""}
                                                        onChange={handleProfileChange}
                                                        disabled={uiState.loading}
                                                    ></textarea>
                                                    <small className="field-hint">
                                                        Ringkasan ini tampil di profil publik Anda dan kartu pengenalan di sistem LMS.
                                                    </small>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ----------------------------------------------------
                                        TAB 2: DATA KEPEGAWAIAN / KEPESERTAAN SESUAI KATEGORI
                                        ---------------------------------------------------- */}
                                    {activeTab === "employee" && (
                                        <div className="tab-pane-content fade-in">
                                            {(profileData.user_type === 'INTERNAL' || profileData.is_internal) ? (
                                                <>
                                                    <div className="section-intro-bar">
                                                        <div>
                                                            <h4 className="section-heading">
                                                                <i className="fas fa-landmark me-2 text-teal"></i>
                                                                Data Kepegawaian Setjen DPD RI
                                                            </h4>
                                                            <p className="section-subtext">
                                                                Informasi kepegawaian resmi digunakan untuk validasi sertifikasi, JP pelatihan, dan identitas instruktur internal.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="employee-sync-notice">
                                                        <i className="fas fa-circle-info notice-icon"></i>
                                                        <div className="notice-body">
                                                            <strong>Sinkronisasi Data Kepegawaian</strong>
                                                            <p>
                                                                Data ini menghubungkan identitas Anda sebagai Instruktur sekaligus Peserta. Perubahan diselaraskan secara langsung dengan Sistem Kepegawaian Setjen DPD RI.
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
                                                                <span className="input-badge-verified" title="NIP resmi Setjen DPD RI">
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
                                                </>
                                            ) : profileData.user_type === 'ASN' ? (
                                                <>
                                                    <div className="section-intro-bar">
                                                        <div>
                                                            <h4 className="section-heading">
                                                                <i className="fas fa-id-badge me-2 text-success"></i>
                                                                Data Kepegawaian & Instansi Asal (ASN Luar)
                                                            </h4>
                                                            <p className="section-subtext">
                                                                Informasi NIP, Jabatan, dan Instansi Asal Anda untuk validasi kepakaran instruktur dan pencatatan kediklatan resmi.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="employee-sync-notice" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                                                        <i className="fas fa-shield-halved notice-icon" style={{ color: '#16a34a' }}></i>
                                                        <div className="notice-body">
                                                            <strong style={{ color: '#15803d' }}>Identitas Instruktur Aparatur Sipil Negara</strong>
                                                            <p style={{ color: '#166534' }}>
                                                                Pastikan NIP dan Asal Instansi Anda sesuai dengan data resmi BKN / SK penugasan kediklatan Anda.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="row g-3">
                                                        <div className="col-md-6 col-12">
                                                            <label className="compact-label" htmlFor="asn_inst_nip">
                                                                NIP (Nomor Induk Pegawai - 18 Digit) <span className="text-danger">*</span>
                                                            </label>
                                                            <div className="input-group-compact">
                                                                <span className="input-group-icon"><i className="fas fa-id-card"></i></span>
                                                                <input
                                                                    type="text"
                                                                    id="asn_inst_nip"
                                                                    name="nip"
                                                                    className="form-control compact-input"
                                                                    placeholder="Contoh: 198501152010121002"
                                                                    value={profileData.nip || ""}
                                                                    maxLength={18}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value.replace(/\D/g, '').slice(0, 18);
                                                                        setProfileData(prev => ({ ...prev, nip: val }));
                                                                        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                                                        autoSaveTimeoutRef.current = setTimeout(() => {
                                                                            saveProfileData({ nip: val }, false);
                                                                        }, 1200);
                                                                    }}
                                                                    disabled={uiState.loading}
                                                                />
                                                            </div>
                                                            <small className="form-text text-muted" style={{ fontSize: '0.72rem' }}>
                                                                {profileData.nip?.length || 0}/18 digit angka NIP resmi
                                                            </small>
                                                        </div>

                                                        <div className="col-md-6 col-12">
                                                            <label className="compact-label" htmlFor="asn_inst_jabatan">
                                                                Jabatan Saat Ini <span className="text-danger">*</span>
                                                            </label>
                                                            <div className="input-group-compact">
                                                                <span className="input-group-icon"><i className="fas fa-briefcase"></i></span>
                                                                <select
                                                                    id="asn_inst_jabatan"
                                                                    name="jenis_jabatan"
                                                                    className="form-select compact-input"
                                                                    value={profileData.jenis_jabatan || ""}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setProfileData(prev => ({ ...prev, jenis_jabatan: val }));
                                                                        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                                                        autoSaveTimeoutRef.current = setTimeout(() => {
                                                                            saveProfileData({ jenis_jabatan: val }, false);
                                                                        }, 1200);
                                                                    }}
                                                                    disabled={uiState.loading}
                                                                >
                                                                    <option value="">-- Pilih Jenis Jabatan ASN --</option>
                                                                    {ASN_POSITIONS.map((pos) => (
                                                                        <option key={pos} value={pos}>{pos}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div className="col-12">
                                                            <label className="compact-label" htmlFor="asn_inst_instansi">
                                                                Asal Instansi / Kementerian / Lembaga / Daerah <span className="text-danger">*</span>
                                                            </label>
                                                            <div className="input-group-compact">
                                                                <span className="input-group-icon"><i className="fas fa-building-columns"></i></span>
                                                                <select
                                                                    id="asn_inst_instansi"
                                                                    name="instansi_asal"
                                                                    className="form-select compact-input"
                                                                    value={profileData.instansi_asal || ""}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setProfileData(prev => ({ ...prev, instansi_asal: val }));
                                                                        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                                                        autoSaveTimeoutRef.current = setTimeout(() => {
                                                                            saveProfileData({ instansi_asal: val }, false);
                                                                        }, 1200);
                                                                    }}
                                                                    disabled={uiState.loading}
                                                                >
                                                                    <option value="">-- Pilih Asal Instansi Anda --</option>
                                                                    {Object.entries(ASN_INSTITUTIONS_GROUPS).map(([category, institutions]) => (
                                                                        <optgroup key={category} label={category}>
                                                                            {institutions.map((inst) => (
                                                                                <option key={inst} value={inst}>{inst}</option>
                                                                            ))}
                                                                        </optgroup>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="section-intro-bar">
                                                        <div>
                                                            <h4 className="section-heading">
                                                                <i className="fas fa-globe me-2 text-info"></i>
                                                                Data Kepesertaan & Domisili (Masyarakat Umum)
                                                            </h4>
                                                            <p className="section-subtext">
                                                                Informasi profesi dan asal wilayah domisili untuk identitas publik instruktur dan personalisasi materi pembelajaran.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="employee-sync-notice" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
                                                        <i className="fas fa-user-check notice-icon" style={{ color: '#0284c7' }}></i>
                                                        <div className="notice-body">
                                                            <strong style={{ color: '#0369a1' }}>Profil Instruktur Umum</strong>
                                                            <p style={{ color: '#334155' }}>
                                                                Sebagai instruktur dari masyarakat umum, identitas profesi dan asal daerah ditampilkan pada kartu instruktur publik kursus Anda.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="row g-3">
                                                        <div className="col-md-6 col-12">
                                                            <label className="compact-label" htmlFor="umum_inst_pekerjaan">
                                                                Pekerjaan / Profesi Saat Ini <span className="text-danger">*</span>
                                                            </label>
                                                            <div className="input-group-compact">
                                                                <span className="input-group-icon"><i className="fas fa-briefcase"></i></span>
                                                                <select
                                                                    id="umum_inst_pekerjaan"
                                                                    name="pekerjaan"
                                                                    className="form-select compact-input"
                                                                    value={profileData.pekerjaan || ""}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setProfileData(prev => ({ ...prev, pekerjaan: val }));
                                                                        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                                                        autoSaveTimeoutRef.current = setTimeout(() => {
                                                                            saveProfileData({ pekerjaan: val }, false);
                                                                        }, 1200);
                                                                    }}
                                                                    disabled={uiState.loading}
                                                                >
                                                                    <option value="">-- Pilih Pekerjaan / Profesi --</option>
                                                                    {PROFESSIONS_LIST.map((prof) => (
                                                                        <option key={prof} value={prof}>{prof}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div className="col-md-6 col-12">
                                                            <label className="compact-label" htmlFor="umum_inst_negara">
                                                                Negara Domisili <span className="text-danger">*</span>
                                                            </label>
                                                            <div className="input-group-compact">
                                                                <span className="input-group-icon"><i className="fas fa-flag"></i></span>
                                                                <select
                                                                    id="umum_inst_negara"
                                                                    name="country"
                                                                    className="form-select compact-input"
                                                                    value={profileData.country || "Indonesia"}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setProfileData(prev => ({ ...prev, country: val }));
                                                                        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                                                        autoSaveTimeoutRef.current = setTimeout(() => {
                                                                            saveProfileData({ country: val }, false);
                                                                        }, 1200);
                                                                    }}
                                                                    disabled={uiState.loading}
                                                                >
                                                                    {COUNTRIES_LIST.map((c) => (
                                                                        <option key={c} value={c}>{c}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div className="col-md-6 col-12">
                                                            <label className="compact-label" htmlFor="umum_inst_provinsi">
                                                                Provinsi Asal <span className="text-danger">*</span>
                                                            </label>
                                                            <div className="input-group-compact">
                                                                <span className="input-group-icon"><i className="fas fa-map-location-dot"></i></span>
                                                                <select
                                                                    id="umum_inst_provinsi"
                                                                    name="provinsi"
                                                                    className="form-select compact-input"
                                                                    value={profileData.provinsi || ""}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setProfileData(prev => ({ ...prev, provinsi: val, kota_kabupaten: "" }));
                                                                        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                                                        autoSaveTimeoutRef.current = setTimeout(() => {
                                                                            saveProfileData({ provinsi: val, kota_kabupaten: "" }, false);
                                                                        }, 1200);
                                                                    }}
                                                                    disabled={uiState.loading}
                                                                >
                                                                    <option value="">-- Pilih Provinsi --</option>
                                                                    {Object.keys(INDONESIA_PROVINCES_AND_CITIES).map((prov) => (
                                                                        <option key={prov} value={prov}>{prov}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div className="col-md-6 col-12">
                                                            <label className="compact-label" htmlFor="umum_inst_kota">
                                                                Kota / Kabupaten Asal
                                                            </label>
                                                            <div className="input-group-compact">
                                                                <span className="input-group-icon"><i className="fas fa-city"></i></span>
                                                                <select
                                                                    id="umum_inst_kota"
                                                                    name="kota_kabupaten"
                                                                    className="form-select compact-input"
                                                                    value={profileData.kota_kabupaten || ""}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setProfileData(prev => ({ ...prev, kota_kabupaten: val }));
                                                                        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                                                                        autoSaveTimeoutRef.current = setTimeout(() => {
                                                                            saveProfileData({ kota_kabupaten: val }, false);
                                                                        }, 1200);
                                                                    }}
                                                                    disabled={uiState.loading || !profileData.provinsi}
                                                                >
                                                                    <option value="">{profileData.provinsi ? "-- Pilih Kota / Kabupaten --" : "-- Pilih Provinsi Dahulu --"}</option>
                                                                    {availableCities.map((city) => (
                                                                        <option key={city} value={city}>{city}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* ----------------------------------------------------
                                        TAB 3: PROFIL PERAN (INSTRUKTUR & PESERTA)
                                        Menghubungkan peran Instruktur & Peserta tanpa duplikasi data
                                        ---------------------------------------------------- */}
                                    {activeTab === "roles" && (
                                        <div className="tab-pane-content fade-in">
                                            <div className="section-intro-bar">
                                                <div>
                                                    <h4 className="section-heading">
                                                        <i className="fas fa-users-gear me-2 text-teal"></i>
                                                        Profil Peran Terintegrasi (Instruktur & Peserta)
                                                    </h4>
                                                    <p className="section-subtext">
                                                        Sistem menghubungkan pengaturan profil Anda untuk peran Instruktur dan Peserta secara terpadu tanpa duplikasi data profil umum.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="roles-dual-grid">

                                                {/* Role Card 1: Instruktur / Widyaiswara */}
                                                <div className="role-subcard instructor-card">
                                                    <div className="role-subcard-header">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="role-icon-box instructor-icon-box">
                                                                <i className="fas fa-chalkboard-user"></i>
                                                            </div>
                                                            <div>
                                                                <h5 className="role-subcard-title">Peran Instruktur</h5>
                                                                <span className="role-subcard-subtitle">Widyaiswara & Instruktur Kursus DPD RI</span>
                                                            </div>
                                                        </div>
                                                        <span className="role-badge-pill-inst">Aktif</span>
                                                    </div>

                                                    <div className="role-subcard-body">
                                                        <div className="mb-3">
                                                            <label className="compact-label" htmlFor="bio">
                                                                Biografi Mengajar & Kepakaran Instruktur
                                                            </label>
                                                            <textarea
                                                                id="bio"
                                                                name="bio"
                                                                className="form-control compact-textarea"
                                                                rows="3"
                                                                placeholder="Jelaskan bidang kepakaran, pengalaman mengajar, atau fokus topik yang Anda ampu..."
                                                                value={profileData.bio || ""}
                                                                onChange={handleProfileChange}
                                                                disabled={uiState.loading}
                                                            ></textarea>
                                                            <small className="field-hint">
                                                                Teks ini ditampilkan pada halaman kursus dan profil publik instruktur bagi peserta.
                                                            </small>
                                                        </div>

                                                        <div className="role-quick-shortcuts">
                                                            <span className="shortcuts-label">Akses Cepat Instruktur:</span>
                                                            <div className="shortcuts-links-row">
                                                                <Link to="/instructor/courses/" className="shortcut-chip">
                                                                    <i className="fas fa-book-open"></i> Kursus Saya
                                                                </Link>
                                                                <Link to="/instructor/reviews/" className="shortcut-chip">
                                                                    <i className="fas fa-star text-warning"></i> Ulasan Peserta
                                                                </Link>
                                                                <Link to="/instructor/testimonials/" className="shortcut-chip">
                                                                    <i className="fas fa-quote-left"></i> Testimoni
                                                                </Link>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowPublicCardModal(true)}
                                                                    className="shortcut-chip"
                                                                    title="Buka pop-up kartu publik instruktur"
                                                                >
                                                                    <i className="fas fa-id-card text-teal"></i> Kartu Publik
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Role Card 2: Siswa / Peserta Pelatihan */}
                                                <div className="role-subcard student-card">
                                                    <div className="role-subcard-header">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="role-icon-box student-icon-box">
                                                                <i className="fas fa-graduation-cap"></i>
                                                            </div>
                                                            <div>
                                                                <h5 className="role-subcard-title">Peran Peserta</h5>
                                                                <span className="role-subcard-subtitle">Pengembangan Kompetensi ASN DPD RI</span>
                                                            </div>
                                                        </div>
                                                        <span className="role-badge-pill-stud">
                                                            {hasStudentRole ? "Terhubung" : "Tersedia"}
                                                        </span>
                                                    </div>

                                                    <div className="role-subcard-body">
                                                        <div className="mb-3">
                                                            <label className="compact-label">
                                                                Informasi Pembelajaran Peserta
                                                            </label>
                                                            <div className="student-profile-sync-box">
                                                                <div className="d-flex align-items-center gap-2 mb-2">
                                                                    <i className="fas fa-link text-teal"></i>
                                                                    <span className="fw-semibold text-dark">Data Profil Terpadu</span>
                                                                </div>
                                                                <p className="student-sync-desc mb-2">
                                                                    Sebagai peserta pelatihan, data profil Anda (nama, NIP, golongan, unit kerja) otomatis sinkron dengan data utama di atas. Tidak ada duplikasi akun atau formulir terpisah.
                                                                </p>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => switchRoleAndNavigate('student', '/student/profile/', navigate)} 
                                                                    className="btn-switch-role-view"
                                                                    title="Beralih peran ke Peserta dan buka profil peserta"
                                                                >
                                                                    <i className="fas fa-arrow-right-arrow-left me-1"></i> Buka Halaman Profil Peserta
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="role-quick-shortcuts">
                                                            <span className="shortcuts-label">Akses Cepat Peserta:</span>
                                                            <div className="shortcuts-links-row">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => switchRoleAndNavigate('student', '/student/courses/', navigate)} 
                                                                    className="shortcut-chip"
                                                                    title="Beralih peran ke Peserta dan buka kursus diikuti"
                                                                >
                                                                    <i className="fas fa-play-circle"></i> Kursus Diikuti
                                                                </button>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => switchRoleAndNavigate('student', '/student/sertifikat/', navigate)} 
                                                                    className="shortcut-chip"
                                                                    title="Beralih peran ke Peserta dan buka sertifikat"
                                                                >
                                                                    <i className="fas fa-award text-amber"></i> Sertifikat Saya
                                                                </button>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => switchRoleAndNavigate('student', '/student/activities/', navigate)} 
                                                                    className="shortcut-chip"
                                                                    title="Beralih peran ke Peserta dan buka riwayat belajar"
                                                                >
                                                                    <i className="fas fa-clock-rotate-left"></i> Riwayat Belajar
                                                                </button>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => switchRoleAndNavigate('student', '/student/dashboard/', navigate)} 
                                                                    className="shortcut-chip"
                                                                    title="Beralih peran ke Peserta dan buka dasbor peserta"
                                                                >
                                                                    <i className="fas fa-gauge-high"></i> Dasbor Peserta
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    )}

                                    {/* ----------------------------------------------------
                                        TAB 4: MEDIA SOSIAL & TAUTAN PUBLIK
                                        ---------------------------------------------------- */}
                                    {activeTab === "social" && (
                                        <div className="tab-pane-content fade-in">
                                            <div className="section-intro-bar">
                                                <div>
                                                    <h4 className="section-heading">
                                                        <i className="fas fa-globe me-2 text-teal"></i>
                                                        Tautan Media Sosial & Jejaring Profesional
                                                    </h4>
                                                    <p className="section-subtext">
                                                        Kelola tautan media sosial Anda (YouTube, Instagram, TikTok, LinkedIn, Twitter/X, Facebook) agar peserta dan kolega dapat terhubung.
                                                    </p>
                                                </div>
                                                {!socialForm.isOpen && availablePlatformsToAdd.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={handleOpenAddSocial}
                                                        className="btn-add-social-trigger"
                                                        title="Tambah tautan media sosial baru"
                                                    >
                                                        <i className="fas fa-plus"></i> Tambah Media Sosial
                                                    </button>
                                                )}
                                            </div>

                                            <div className="social-manager-wrapper">
                                                {/* Inline Add / Edit Social Form */}
                                                {socialForm.isOpen && (
                                                    <div className={`social-add-card ${socialForm.isEditing ? "editing-mode" : ""}`}>
                                                        <div className="d-flex align-items-center justify-content-between mb-3">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span className="badge bg-teal-subtle text-teal fw-semibold px-2 py-1 rounded">
                                                                    <i className={`fas ${socialForm.isEditing ? "fa-pen" : "fa-plus"} me-1`}></i>
                                                                    {socialForm.isEditing ? "Edit Tautan Media Sosial" : "Tambah Media Sosial Baru"}
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="btn-close"
                                                                onClick={() => setSocialForm((prev) => ({ ...prev, isOpen: false, isEditing: false }))}
                                                                aria-label="Tutup formulir"
                                                            ></button>
                                                        </div>

                                                        {/* Platform Selector */}
                                                        <div className="mb-3">
                                                            <label className="compact-label mb-2">Pilih Platform Media Sosial</label>
                                                            <div className="social-platform-pill-selector">
                                                                {(socialForm.isEditing
                                                                    ? SOCIAL_PLATFORMS_CONFIG.filter((p) => p.id === socialForm.platform)
                                                                    : availablePlatformsToAdd
                                                                ).map((p) => {
                                                                    const isSelected = socialForm.platform === p.id;
                                                                    return (
                                                                        <button
                                                                            key={p.id}
                                                                            type="button"
                                                                            onClick={() => setSocialForm((prev) => ({ ...prev, platform: p.id }))}
                                                                            className={`social-platform-pill ${isSelected ? "selected" : ""}`}
                                                                        >
                                                                            <i className={p.icon} style={{ color: isSelected ? "#ffffff" : p.color }}></i>
                                                                            {p.name}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* URL Input */}
                                                        <div className="mb-3">
                                                            {(() => {
                                                                const currentPlatform = SOCIAL_PLATFORMS_CONFIG.find((p) => p.id === socialForm.platform) || SOCIAL_PLATFORMS_CONFIG[0];
                                                                return (
                                                                    <>
                                                                        <label className="compact-label" htmlFor="social_url_input">
                                                                            URL / Tautan {currentPlatform.name}
                                                                        </label>
                                                                        <div className="input-group-compact">
                                                                            <span className="input-group-icon" style={{ color: currentPlatform.color }}>
                                                                                <i className={currentPlatform.icon}></i>
                                                                            </span>
                                                                            <input
                                                                                type="url"
                                                                                id="social_url_input"
                                                                                className="form-control compact-input"
                                                                                placeholder={currentPlatform.placeholder}
                                                                                value={socialForm.url}
                                                                                onChange={(e) => setSocialForm((prev) => ({ ...prev, url: e.target.value }))}
                                                                                autoFocus
                                                                            />
                                                                        </div>
                                                                        <small className="field-hint text-muted mt-1 d-block">
                                                                            {currentPlatform.helper}
                                                                        </small>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>

                                                        {/* Form Buttons */}
                                                        <div className="d-flex align-items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={handleSaveSocial}
                                                                className="btn-hero-primary py-2 px-3"
                                                            >
                                                                <i className="fas fa-check me-1"></i>
                                                                {socialForm.isEditing ? "Perbarui Tautan" : "Tambah Tautan"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSocialForm((prev) => ({ ...prev, isOpen: false, isEditing: false }))}
                                                                className="btn btn-outline-secondary btn-sm py-2 px-3 rounded-3"
                                                            >
                                                                Batal
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* List of Active Social Cards */}
                                                {activeSocialList.length > 0 ? (
                                                    <div className="social-cards-grid">
                                                        {activeSocialList.map((platform) => {
                                                            const url = profileData[platform.id];
                                                            return (
                                                                <div key={platform.id} className="social-card-item">
                                                                    <div className="social-card-left">
                                                                        <div className="social-card-icon-box" style={{ background: platform.bgLight, color: platform.color }}>
                                                                            <i className={platform.icon}></i>
                                                                        </div>
                                                                        <div className="social-card-info">
                                                                            <h6 className="social-card-name">
                                                                                {platform.name}
                                                                                <i className="fas fa-circle-check text-teal" style={{ fontSize: "0.75rem" }}></i>
                                                                            </h6>
                                                                            <a
                                                                                href={url}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="social-card-link"
                                                                                title={`Buka ${url}`}
                                                                            >
                                                                                {url}
                                                                            </a>
                                                                        </div>
                                                                    </div>
                                                                    <div className="social-card-actions">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleEditSocial(platform.id)}
                                                                            className="btn-social-mini"
                                                                            title={`Ubah tautan ${platform.name}`}
                                                                        >
                                                                            <i className="fas fa-pen"></i>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteSocial(platform.id)}
                                                                            className="btn-social-mini btn-delete"
                                                                            title={`Hapus tautan ${platform.name}`}
                                                                        >
                                                                            <i className="fas fa-trash-can"></i>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : !socialForm.isOpen ? (
                                                    <div className="social-empty-state">
                                                        <div className="empty-social-icon">
                                                            <i className="fas fa-share-nodes"></i>
                                                        </div>
                                                        <h5 className="empty-social-title">Belum Ada Media Sosial Ditambahkan</h5>
                                                        <p className="empty-social-desc">
                                                            Hubungkan akun media sosial profesional Anda seperti YouTube, Instagram, TikTok, LinkedIn, Twitter/X, atau Facebook agar peserta dan kolega dapat terhubung dengan Anda.
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={handleOpenAddSocial}
                                                            className="btn-hero-primary py-2 px-3"
                                                        >
                                                            <i className="fas fa-plus me-1"></i> Tambah Media Sosial Sekarang
                                                        </button>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}

                                    {/* ========================================================
                                        TAB 5: 🌟 MANTA AI ACHIEVEMENTS & TEACHING MILESTONES (SISI INSTRUKTUR)
                                        ======================================================== */}
                                    {activeTab === "achievements" && (
                                        <div className="tab-pane-content">
                                            {(() => {
                                                const g = teachingGamification || {
                                                    level: 1,
                                                    level_name: "Widyaiswara Pratama",
                                                    level_icon: "fas fa-chalkboard-user",
                                                    level_color: "#0ea5e9",
                                                    points: 0,
                                                    next_level_xp: 250,
                                                    next_level_name: "Fasilitator Terampil",
                                                    remaining_xp: 250,
                                                    xp_progress_pct: 0,
                                                    unlocked_count: 1,
                                                    total_badges: 8,
                                                    badges: []
                                                };

                                                return (
                                                    <div className="gamification-tab-container">
                                                        {/* Hero Banner Level Pengajar / Widyaiswara */}
                                                        <div className="gamification-hero-banner">
                                                            <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-3">
                                                                <div>
                                                                    <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                                                                        <span 
                                                                            className="gamification-level-pill"
                                                                            style={{ backgroundColor: g.level_color || '#0ea5e9' }}
                                                                        >
                                                                            <i className={g.level_icon || 'fas fa-chalkboard-user'}></i>
                                                                            Level {g.level}: {g.level_name}
                                                                        </span>
                                                                        <span className="badge bg-white text-dark px-3 py-2 fw-bold" style={{ borderRadius: '9999px' }}>
                                                                            {g.points?.toLocaleString('id-ID')} IP (Instructor Points)
                                                                        </span>
                                                                        <span className="badge bg-warning text-dark px-3 py-2 fw-bold" style={{ borderRadius: '9999px' }}>
                                                                            <i className="fas fa-graduation-cap me-1"></i> Portofolio Pengajaran
                                                                        </span>
                                                                    </div>
                                                                    <h4 className="fw-bold text-white mb-1">
                                                                        Prestasi & Dedikasi Pengajaran Widyaiswara DPD RI
                                                                    </h4>
                                                                    <p className="text-white-50 mb-0 small">
                                                                        Sistem apresiasi terintegrasi Manta AI untuk mengukur kontribusi kurikulum, jangkauan alumni, dan dampak pembelajaran bagi seluruh aparatur Setjen DPD RI.
                                                                    </p>
                                                                </div>

                                                                <div className="flex-shrink-0 d-flex gap-2 flex-wrap">
                                                                    <Link 
                                                                        to="/instructor/courses/" 
                                                                        className="btn btn-light btn-sm px-3 py-2 rounded-pill fw-bold text-teal shadow-sm"
                                                                    >
                                                                        <i className="fas fa-chalkboard me-1"></i>
                                                                        Kursus Saya
                                                                    </Link>
                                                                    <Link 
                                                                        to="/instructor/create-course/" 
                                                                        className="btn btn-outline-light btn-sm px-3 py-2 rounded-pill fw-bold shadow-sm"
                                                                    >
                                                                        <i className="fas fa-plus me-1"></i>
                                                                        Buat Kursus Baru
                                                                    </Link>
                                                                    <Link 
                                                                        to="/rankings/" 
                                                                        className="btn btn-outline-light btn-sm px-3 py-2 rounded-pill fw-bold shadow-sm"
                                                                    >
                                                                        <i className="fas fa-ranking-star me-1"></i>
                                                                        Peringkat Global
                                                                    </Link>
                                                                </div>
                                                            </div>

                                                            {/* IP Progression Bar */}
                                                            <div className="p-3 rounded-3" style={{ background: 'rgba(0, 0, 0, 0.22)', backdropFilter: 'blur(6px)' }}>
                                                                <div className="d-flex justify-content-between align-items-center mb-1 text-white flex-wrap gap-2" style={{ fontSize: '0.8rem' }}>
                                                                    <span>
                                                                        Progres Reputasi Pengajar: <strong>{g.xp_progress_pct}%</strong>
                                                                    </span>
                                                                    {g.level < 5 ? (
                                                                        <span>
                                                                            Menuju <strong>{g.next_level_name}</strong>: tersisa <strong>{g.remaining_xp} IP</strong> lagi
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-warning fw-bold">
                                                                            <i className="fas fa-crown me-1"></i> Telah Mencapai Puncak Reputasi Widyaiswara DPD RI
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="progress" style={{ height: '8px', borderRadius: '4px', backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                                                                    <div 
                                                                        className="progress-bar progress-bar-striped progress-bar-animated bg-warning"
                                                                        role="progressbar" 
                                                                        style={{ width: `${g.xp_progress_pct}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 4 Pillars Summary Cards (Teaching Stats POV) */}
                                                        <div className="row g-3 mb-4">
                                                            <div className="col-12 col-md-6 col-lg-3">
                                                                <div className="gamification-stat-card">
                                                                    <div className="d-flex align-items-center gap-3">
                                                                        <div className="stat-icon-wrapper" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                                                                            <i className="fas fa-book-open"></i>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Modul & Kursus</span>
                                                                            <h5 className="fw-bold mb-0 text-dark">
                                                                                {teacherStats?.total_courses ?? 0} Kursus Aktif
                                                                            </h5>
                                                                        </div>
                                                                    </div>
                                                                    <small className="text-muted d-block mt-2" style={{ fontSize: '0.74rem' }}>
                                                                        Materi pelatihan resmi yang Anda ampu dan publikasikan di LMS.
                                                                    </small>
                                                                </div>
                                                            </div>

                                                            <div className="col-12 col-md-6 col-lg-3">
                                                                <div className="gamification-stat-card">
                                                                    <div className="d-flex align-items-center gap-3">
                                                                        <div className="stat-icon-wrapper" style={{ background: '#dcfce7', color: '#16a34a' }}>
                                                                            <i className="fas fa-users-viewfinder"></i>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Jangkauan Peserta</span>
                                                                            <h5 className="fw-bold mb-0 text-dark">
                                                                                {teacherStats?.total_students ?? 0} Peserta
                                                                            </h5>
                                                                        </div>
                                                                    </div>
                                                                    <small className="text-muted d-block mt-2" style={{ fontSize: '0.74rem' }}>
                                                                        Aparatur yang telah terdaftar dan mengikuti kelas bimbingan Anda.
                                                                    </small>
                                                                </div>
                                                            </div>

                                                            <div className="col-12 col-md-6 col-lg-3">
                                                                <div className="gamification-stat-card">
                                                                    <div className="d-flex align-items-center gap-3">
                                                                        <div className="stat-icon-wrapper" style={{ background: '#fef3c7', color: '#d97706' }}>
                                                                            <i className="fas fa-star"></i>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Indeks Kepuasan</span>
                                                                            <h5 className="fw-bold mb-0 text-dark">
                                                                                {Number(teacherStats?.total_rating || 5).toFixed(1)} / 5.0 ★
                                                                            </h5>
                                                                        </div>
                                                                    </div>
                                                                    <small className="text-muted d-block mt-2" style={{ fontSize: '0.74rem' }}>
                                                                        Evaluasi mutu materi dan efektivitas pengajaran dari para peserta.
                                                                    </small>
                                                                </div>
                                                            </div>

                                                            <div className="col-12 col-md-6 col-lg-3">
                                                                <div className="gamification-stat-card" style={{ borderColor: '#ddd6fe', background: '#faf5ff' }}>
                                                                    <div className="d-flex align-items-center gap-3">
                                                                        <div className="stat-icon-wrapper" style={{ background: '#ede9fe', color: '#7c3aed' }}>
                                                                            <i className="fas fa-award"></i>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Lencana Pengajar</span>
                                                                            <h5 className="fw-bold mb-0 text-purple" style={{ color: '#6d28d9' }}>
                                                                                {g.unlocked_count} / {g.total_badges} Terbuka
                                                                            </h5>
                                                                        </div>
                                                                    </div>
                                                                    <small className="text-muted d-block mt-2" style={{ fontSize: '0.74rem' }}>
                                                                        Tersisa {Math.max(0, g.total_badges - g.unlocked_count)} lencana widyaiswara untuk dilengkapi.
                                                                    </small>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Section Header: Teaching Milestone Badges */}
                                                        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                                                            <div>
                                                                <h6 className="fw-bold mb-0 text-dark fs-6">
                                                                    <i className="fas fa-medal text-warning me-2"></i>
                                                                    Galeri {g.total_badges || 8} Lencana Pengajaran (Teaching Milestone Badges)
                                                                </h6>
                                                                <span className="text-muted small">
                                                                    Setiap lencana mencerminkan pencapaian kemahiran kurikulum, jangkauan alumni peserta, dan mutu materi ajar Anda.
                                                                </span>
                                                            </div>
                                                            <span className="badge bg-light text-dark border px-3 py-1">
                                                                {g.unlocked_count} dari {g.total_badges} Terbuka
                                                            </span>
                                                        </div>

                                                        {/* Badges Grid */}
                                                        <div className="milestones-grid mb-4">
                                                            {(g.badges || []).map((b) => (
                                                                <div 
                                                                    key={b.id} 
                                                                    className={`milestone-badge-card ${b.is_unlocked ? 'unlocked' : 'locked'}`}
                                                                >
                                                                    <div className="d-flex align-items-start gap-3 mb-2">
                                                                        <div 
                                                                            className="badge-icon-box"
                                                                            style={{ 
                                                                                background: b.is_unlocked ? `${b.color}15` : '#f1f5f9',
                                                                                color: b.is_unlocked ? b.color : '#94a3b8' 
                                                                            }}
                                                                        >
                                                                            <i className={b.icon}></i>
                                                                        </div>
                                                                        <div className="flex-grow-1 min-w-0">
                                                                            <div className="d-flex align-items-center justify-content-between gap-1">
                                                                                <span 
                                                                                    className="badge px-2 py-0" 
                                                                                    style={{ 
                                                                                        fontSize: '0.65rem', 
                                                                                        backgroundColor: b.is_unlocked ? `${b.color}20` : '#e2e8f0', 
                                                                                        color: b.is_unlocked ? b.color : '#64748b' 
                                                                                    }}
                                                                                >
                                                                                    {b.category}
                                                                                </span>
                                                                                {b.is_unlocked ? (
                                                                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0" style={{ fontSize: '0.65rem' }}>
                                                                                        <i className="fas fa-check-circle me-1"></i> Terbuka
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="badge bg-secondary-subtle text-muted border px-2 py-0" style={{ fontSize: '0.65rem' }}>
                                                                                        <i className="fas fa-lock me-1"></i> Terkunci
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <h6 className="fw-bold mb-1 text-dark mt-1 text-truncate" title={b.title}>
                                                                                {b.title}
                                                                            </h6>
                                                                            <p className="text-muted mb-0" style={{ fontSize: '0.73rem', lineHeight: '1.3' }}>
                                                                                {b.description}
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-auto pt-2 border-top">
                                                                        <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.68rem' }}>
                                                                            <span>Kriteria Pencapaian:</span>
                                                                            <strong className={b.is_unlocked ? "text-success" : "text-dark"}>{b.progress}</strong>
                                                                        </div>
                                                                        <div className="progress mt-1" style={{ height: '4px' }}>
                                                                            <div 
                                                                                className={`progress-bar ${b.is_unlocked ? 'bg-success' : 'bg-primary'}`}
                                                                                style={{ width: `${b.progress_pct}%` }}
                                                                            ></div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Manta AI Consult Card - Instructor Focus */}
                                                        <div className="manta-consult-card d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
                                                            <div className="d-flex align-items-center gap-3">
                                                                <div 
                                                                    className="rounded-circle border border-teal d-flex align-items-center justify-content-center overflow-hidden flex-shrink-0 shadow-xs"
                                                                    style={{ 
                                                                        width: '54px', 
                                                                        height: '54px', 
                                                                        background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                                                                        padding: '2px'
                                                                    }}
                                                                >
                                                                    <img 
                                                                        src={mantaHappyWebp} 
                                                                        alt="Manta AI"
                                                                        width="48"
                                                                        height="48"
                                                                        style={{ objectFit: 'contain' }}
                                                                        onError={(e) => { e.currentTarget.src = "/images/avatar/manta-happy.png"; }}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <h6 className="fw-bold mb-1 text-teal-dark fs-6">
                                                                        Konsultasikan Kurikulum & Kualitas Pengajaran dengan Manta AI 🌊
                                                                    </h6>
                                                                    <p className="text-muted mb-0 small">
                                                                        Butuh inspirasi silabus kursus, format evaluasi kuis, metode microlearning, atau panduan peningkatan mutu kelas? Asisten Widyaiswara Manta siap mendampingi Anda 24/7.
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex-shrink-0 d-flex gap-2 flex-wrap">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-teal btn-sm rounded-pill px-3 py-2 fw-semibold shadow-xs"
                                                                    onClick={() => {
                                                                        const prompt = 'Halo Manta, saya instruktur di LMS Setjen DPD RI. Bagaimana tips meningkatkan keterlibatan peserta dan kualitas modul pembelajaran yang saya ampu?';
                                                                        if (typeof window !== 'undefined') {
                                                                            if (typeof window.openMantaChat === 'function') {
                                                                                window.openMantaChat(prompt);
                                                                            } else {
                                                                                window.dispatchEvent(new CustomEvent('manta_open_chat', { detail: { prompt } }));
                                                                                window.dispatchEvent(new CustomEvent('manta-open-chat', { detail: { prompt, query: prompt } }));
                                                                            }
                                                                        }
                                                                    }}
                                                                >
                                                                    <i className="fas fa-comment-dots me-1"></i> Tanya Asisten Widyaiswara
                                                                </button>
                                                                <Link 
                                                                    to="/instructor/courses/" 
                                                                    className="btn btn-outline-teal btn-sm rounded-pill px-3 py-2 fw-semibold"
                                                                >
                                                                    <i className="fas fa-book-open me-1"></i> Kelola Kursus
                                                                </Link>
                                                                <Link 
                                                                    to="/instructor/create-course/" 
                                                                    className="btn btn-outline-teal btn-sm rounded-pill px-3 py-2 fw-semibold"
                                                                >
                                                                    <i className="fas fa-plus me-1"></i> Buat Kursus
                                                                </Link>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
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

            {/* ========================================================
                PUBLIC PROFILE POP-UP CARD MODAL
                ======================================================== */}
            {showPublicCardModal && (
                <div
                    className="public-card-modal-backdrop"
                    onClick={() => setShowPublicCardModal(false)}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="public-card-modal-dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header Banner */}
                        <div className="public-card-banner">
                            <div className="banner-badge-preview">
                                <i className="fas fa-eye me-1"></i> Pratinjau Kartu Publik Instruktur
                            </div>
                            <button
                                type="button"
                                className="btn-modal-close"
                                onClick={() => setShowPublicCardModal(false)}
                                aria-label="Tutup"
                                title="Tutup pratinjau"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* Modal Card Content */}
                        <div className="public-card-content">
                            {/* Avatar with Verified Ring */}
                            <div className="public-card-avatar-wrapper">
                                <div className="public-card-avatar">
                                    {uiState.imagePreview ? (
                                        <img
                                            src={uiState.imagePreview}
                                            alt={profileData.full_name || "Instruktur"}
                                            className="public-avatar-img"
                                        />
                                    ) : (
                                        <div className="public-avatar-placeholder">
                                            <i className="fas fa-user-tie"></i>
                                        </div>
                                    )}
                                    <span className="public-avatar-badge" title="Instruktur Terverifikasi Setjen DPD RI">
                                        <i className="fas fa-check"></i>
                                    </span>
                                </div>
                            </div>

                            {/* Name & Titles */}
                            <div className="text-center mt-2 mb-3">
                                <h3 className="public-card-name">
                                    {profileData.full_name || currentUser?.full_name || "Instruktur Setjen DPD RI"}
                                </h3>
                                <div className="public-card-roles">
                                    <span className="badge-role-pill">
                                        <i className="fas fa-chalkboard-user me-1"></i> Instruktur Resmi Setjen DPD RI
                                    </span>
                                    {hasStudentRole && (
                                        <span className="badge-role-pill-sub">
                                            <i className="fas fa-graduation-cap me-1"></i> Peserta Pelatihan
                                        </span>
                                    )}
                                </div>
                                {profileData.position_name && (
                                    <p className="public-card-position mb-1">
                                        <i className="fas fa-briefcase text-teal me-1"></i>
                                        {profileData.position_name}
                                    </p>
                                )}
                                {profileData.organization_unit_name && (
                                    <p className="public-card-org text-muted mb-0">
                                        <i className="fas fa-building me-1"></i>
                                        {profileData.organization_unit_name} &bull; Setjen DPD RI
                                    </p>
                                )}
                            </div>

                            {/* NIP & Location Strip */}
                            <div className="public-card-info-strip">
                                {profileData.nip && (
                                    <div className="info-strip-item">
                                        <span className="strip-label">NIP</span>
                                        <span className="strip-value">{profileData.nip}</span>
                                    </div>
                                )}
                                {profileData.golongan && (
                                    <div className="info-strip-item">
                                        <span className="strip-label">Golongan</span>
                                        <span className="strip-value">{profileData.golongan}</span>
                                    </div>
                                )}
                                <div className="info-strip-item">
                                    <span className="strip-label">Domisili</span>
                                    <span className="strip-value">{profileData.country || "Indonesia"}</span>
                                </div>
                            </div>

                            {/* Teaching Stats Tiles */}
                            <div className="public-card-stats-grid">
                                <div className="public-stat-tile">
                                    <span className="stat-number">{teacherStats?.total_courses ?? 0}</span>
                                    <span className="stat-label"><i className="fas fa-book-open me-1 text-teal"></i> Kursus</span>
                                </div>
                                <div className="public-stat-tile">
                                    <span className="stat-number">{teacherStats?.total_students ?? 0}</span>
                                    <span className="stat-label"><i className="fas fa-users me-1 text-teal"></i> Peserta</span>
                                </div>
                                <div className="public-stat-tile">
                                    <span className="stat-number">
                                        {teacherStats?.total_rating ? Number(teacherStats.total_rating).toFixed(1) : "5.0"}
                                    </span>
                                    <span className="stat-label"><i className="fas fa-star me-1 text-warning"></i> Rating</span>
                                </div>
                            </div>

                            {/* Biografi / Kepakaran Mengajar */}
                            <div className="public-card-bio-section">
                                <h6 className="bio-section-title">
                                    <i className="fas fa-quote-left text-teal me-2"></i>
                                    Kepakaran & Biografi Instruktur
                                </h6>
                                <p className="bio-section-text">
                                    {profileData.bio || profileData.about || (
                                        <span className="text-muted fst-italic">
                                            Belum ada biografi instruktur. Anda dapat melengkapi kepakaran Anda di Tab "Profil Peran (Instruktur & Peserta)".
                                        </span>
                                    )}
                                </p>
                            </div>

                            {/* Social & Contact Strip */}
                            {(profileData.linkedin || profileData.twitter || profileData.facebook || profileData.youtube || profileData.instagram || profileData.tiktok || profileData.email) && (
                                <div className="public-card-social-strip">
                                    <span className="social-strip-label">Tautan Terverifikasi:</span>
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        {profileData.youtube && (
                                            <a
                                                href={profileData.youtube}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="public-social-chip youtube"
                                            >
                                                <i className="fab fa-youtube text-danger"></i> YouTube
                                            </a>
                                        )}
                                        {profileData.instagram && (
                                            <a
                                                href={profileData.instagram}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="public-social-chip instagram"
                                            >
                                                <i className="fab fa-instagram" style={{ color: "#e1306c" }}></i> Instagram
                                            </a>
                                        )}
                                        {profileData.tiktok && (
                                            <a
                                                href={profileData.tiktok}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="public-social-chip tiktok"
                                            >
                                                <i className="fab fa-tiktok text-dark"></i> TikTok
                                            </a>
                                        )}
                                        {profileData.linkedin && (
                                            <a
                                                href={profileData.linkedin}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="public-social-chip linkedin"
                                            >
                                                <i className="fab fa-linkedin text-primary"></i> LinkedIn
                                            </a>
                                        )}
                                        {profileData.twitter && (
                                            <a
                                                href={profileData.twitter}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="public-social-chip twitter"
                                            >
                                                <i className="fab fa-x-twitter text-dark"></i> Twitter/X
                                            </a>
                                        )}
                                        {profileData.facebook && (
                                            <a
                                                href={profileData.facebook}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="public-social-chip facebook"
                                            >
                                                <i className="fab fa-facebook text-primary"></i> Facebook
                                            </a>
                                        )}
                                        {profileData.email && (
                                            <span className="public-social-chip email">
                                                <i className="fas fa-envelope text-teal"></i> {profileData.email}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="public-card-footer">
                            <button
                                type="button"
                                className="btn-modal-dismiss"
                                onClick={() => setShowPublicCardModal(false)}
                            >
                                <i className="fas fa-xmark me-1"></i> Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                variant="instructor"
            />

            <Footer />
        </>
    );
}

export default React.memo(Profile);