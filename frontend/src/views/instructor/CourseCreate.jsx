import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import ImageUpload from "./components/ImageUpload";
import VideoUpload from "./components/VideoUpload";
import ElearningModuleUpload from "./components/ElearningModuleUpload";
import FormField from "./components/FormField";
import CourseFeaturesForm from "./components/CourseFeaturesForm";
import CourseRequirementsForm from "./components/CourseRequirementsForm";
import CourseLearningOutcomesForm from "./components/CourseLearningOutcomesForm";

// Lazy load CKEditor component (1.24 MB)
const RichTextEditor = lazy(() => import("./components/RichTextEditor"));

import useAxios from "../../utils/useAxios";
import Toast from "../plugin/Toast";
import UserData from "../plugin/UserData";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import { 
  validateTitle, 
  validateDescription, 
  validateCategory, 
  validateLevel, 
  validateImage,
  validateAllFields,
  getValidationClass,
  getSelectValidationClass 
} from "../../utils/courseValidation";
import { 
  DEFAULT_COURSE_DATA, 
  COURSE_LEVELS, 
  TOAST_MESSAGES, 
  ERROR_FOCUS_REFS 
} from "../../utils/courseConstants";
import "./CourseCreate.css";

// Helper for draft localStorage key per user
const getDraftKey = () => {
    try {
        const user = UserData();
        return user?.user_id ? `lms_course_create_draft_${user.user_id}` : "lms_course_create_draft_default";
    } catch (e) {
        return "lms_course_create_draft_default";
    }
};

function CourseCreate() {
    // Restore initial state from localStorage if available
    const [courseData, setCourseData] = useState(() => {
        try {
            const saved = localStorage.getItem(getDraftKey());
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.courseData) {
                    return { ...DEFAULT_COURSE_DATA, ...parsed.courseData };
                }
            }
        } catch (e) {
            console.warn("[CourseCreate] Error reading draft from localStorage:", e);
        }
        return DEFAULT_COURSE_DATA;
    });

    const [courseFormat, setCourseFormat] = useState(() => {
        try {
            const saved = localStorage.getItem(getDraftKey());
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.courseFormat || "standard";
            }
        } catch (e) {}
        return "standard";
    });

    const [imagePreview, setImagePreview] = useState(() => {
        try {
            const saved = localStorage.getItem(getDraftKey());
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.imagePreview || parsed.courseData?.image || "";
            }
        } catch (e) {}
        return "";
    });

    const [draftRestored, setDraftRestored] = useState(() => {
        try {
            const saved = localStorage.getItem(getDraftKey());
            if (saved) {
                const parsed = JSON.parse(saved);
                const d = parsed.courseData;
                return Boolean(d && (d.title || d.description || d.file || d.image || d.learning_module_id));
            }
        } catch (e) {}
        return false;
    });

    const [lastSavedTime, setLastSavedTime] = useState(() => {
        try {
            const saved = localStorage.getItem(getDraftKey());
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed.savedAt ? new Date(parsed.savedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null;
            }
        } catch (e) {}
        return null;
    });

    const [category, setCategory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [warnings, setWarnings] = useState({});
    const [createdCourseId, setCreatedCourseId] = useState(null); // ✨ PHASE 4.45
    const navigate = useNavigate();
    const isCollapsed = useInstructorSidebarCollapse();

    // Refs for focusing on error inputs
    const titleRef = useRef(null);
    const categoryRef = useRef(null);
    const imageRef = useRef(null);
    const levelRef = useRef(null);
    const ckeditorRef = useRef(null);
    // ✨ PHASE 4.177: Fetch guard to prevent duplicate category loads
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        // ✨ PHASE 4.177: Guard against duplicate category fetches in React Strict Mode
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        
        const fetchCategories = async () => {
            try {
                const response = await useAxios.get("course/category/");
                // Normalize response: handle both array and paginated responses
                const categoryData = Array.isArray(response.data) 
                    ? response.data 
                    : (response.data?.results || []);
                setCategory(categoryData);
            } catch (error) {
                console.error("Kesalahan mengambil kategori:", error);
                Toast("error", "Gagal memuat kategori");
            }
        };
        fetchCategories();
    }, []);

    // ✨ Auto-save to localStorage (debounced) so user never loses progress on refresh or disconnect
    useEffect(() => {
        const hasContent = Boolean(
            courseData.title || 
            courseData.description || 
            courseData.image || 
            courseData.file || 
            courseData.learning_module_id || 
            courseData.category || 
            courseData.level
        );

        if (!hasContent) return;

        const timer = setTimeout(() => {
            try {
                const now = new Date();
                localStorage.setItem(getDraftKey(), JSON.stringify({
                    courseData,
                    courseFormat,
                    imagePreview,
                    savedAt: now.toISOString()
                }));
                setLastSavedTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
            } catch (e) {
                console.warn("[CourseCreate] Auto-save error:", e);
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [courseData, courseFormat, imagePreview]);

    // ✨ Protect against accidental page refresh or tab close
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            const hasContent = Boolean(courseData.title || courseData.file || courseData.learning_module_id);
            if (hasContent && !createdCourseId) {
                e.preventDefault();
                e.returnValue = "Perubahan draf kursus Anda telah tersimpan secara lokal. Apakah Anda yakin ingin keluar?";
                return e.returnValue;
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [courseData, createdCourseId]);

    // Handler untuk membersihkan draf lokal dan menghapus modul yatim di server
    const handleClearDraft = async () => {
        if (courseData?.learning_module_id) {
            try {
                await useAxios.delete(`api/v1/modules/${courseData.learning_module_id}/detail/`);
            } catch (e) {
                console.warn("[CourseCreate] Cleanup module failed:", e);
            }
        }

        try {
            localStorage.removeItem(getDraftKey());
        } catch (e) {}

        setCourseData(DEFAULT_COURSE_DATA);
        setImagePreview("");
        setCourseFormat("standard");
        setDraftRestored(false);
        setLastSavedTime(null);
        setErrors({});
        setWarnings({});

        Toast().fire({
            icon: "info",
            title: "Draf Berhasil Direset",
            text: "Formulir telah dikosongkan dan berkas sementara telah dibersihkan dari server.",
            timer: 2500
        });
    };

    // Handler pergantian format kursus (Standard Video vs SCORM/H5P)
    const handleFormatChange = (newFormat) => {
        setCourseFormat(newFormat);
        setCourseData(prev => ({
            ...prev,
            course_type: newFormat === "elearning" 
                ? (prev.course_type && prev.course_type !== "standard" ? prev.course_type : "scorm_12") 
                : "standard"
        }));
    };

    // Handler untuk menghapus draf modul SCORM saat berada di mode Standar
    const handleRemoveScormDraft = async () => {
        if (courseData?.learning_module_id) {
            try {
                await useAxios.delete(`api/v1/modules/${courseData.learning_module_id}/detail/`);
            } catch (e) {
                console.warn("[CourseCreate] Delete module draft error:", e);
            }
        }
        setCourseData(prev => ({
            ...prev,
            learning_module_id: null,
            learning_module: null,
            course_type: courseFormat === "elearning" ? "scorm_12" : "standard"
        }));
        Toast().fire({
            icon: "success",
            title: "Modul SCORM Dihapus",
            text: "Modul interaktif dari draf telah dibersihkan.",
            timer: 2000
        });
    };

    // Validation function
    const validateField = (name, value) => {
        let fieldErrors = [];
        let fieldWarnings = [];

        switch (name) {
            case "title":
                const titleValidation = validateTitle(value);
                fieldErrors = titleValidation.errors;
                fieldWarnings = titleValidation.warnings;
                break;
            case "description":
                const descValidation = validateDescription(value);
                fieldErrors = descValidation.errors;
                fieldWarnings = descValidation.warnings;
                break;
            case "category":
                const categoryValidation = validateCategory(value);
                fieldErrors = categoryValidation.errors;
                break;
            case "level":
                const levelValidation = validateLevel(value);
                fieldErrors = levelValidation.errors;
                break;
            case "image":
                const imageValidation = validateImage(value);
                fieldErrors = imageValidation.errors;
                fieldWarnings = imageValidation.warnings;
                break;
            default:
                break;
        }

        // Update errors state
        setErrors(prev => ({
            ...prev,
            [name]: fieldErrors
        }));
        

        // Update warnings state
        setWarnings(prev => ({
            ...prev,
            [name]: fieldWarnings
        }));

        return { errors: fieldErrors, warnings: fieldWarnings };
    };

    const handleCourseInputChange = (event) => {
        const { name, value, type, checked } = event.target;
        const newValue = type === "checkbox" ? checked : value;
        
        setCourseData(prevData => ({
            ...prevData,
            [name]: newValue,
        }));

        // Real-time validation
        validateField(name, newValue);
    };

    const handleCKEditorChange = (content) => {
        // RichTextEditor now passes the string content directly
        setCourseData(prevData => ({
            ...prevData,
            description: content,
        }));

        // Real-time validation for description
        validateField("description", content);
    };

    // Focus on first error field
    const focusOnError = (errorFields) => {
        const fieldRefs = {
            title: titleRef,
            category: categoryRef,
            image: imageRef,
            level: levelRef,
            description: ckeditorRef
        };

        for (const field of errorFields) {
            if (fieldRefs[field]?.current) {
                fieldRefs[field].current.focus();
                fieldRefs[field].current.scrollIntoView({ 
                    behavior: "smooth", 
                    block: "center" 
                });
                break;
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate all fields
        const { allErrors, allWarnings, errorFields } = validateAllFields(courseData);
        
        setErrors(allErrors);
        setWarnings(allWarnings);

        // If there are validation errors, focus on the first error field
        if (errorFields.length > 0) {
            focusOnError(errorFields);
            Toast("error", TOAST_MESSAGES.VALIDATION_ERROR);
            return;
        }

        setLoading(true);
        
        // Prepare data to send - files are already uploaded as URLs
        const courseSubmissionData = {
            title: courseData.title,
            description: courseData.description,
            category: courseData.category,
            level: courseData.level,
            image: courseData.image, // URL from file-upload API
            file: courseFormat === "elearning" ? null : courseData.file,   // URL from file-upload API
            intro_video_source: courseData.intro_video_source || "upload", // ✨ PHASE 4.18: Include video source type
            course_type: courseFormat === "elearning" ? (courseData.course_type || "scorm_12") : "standard",
            learning_module_id: courseFormat === "elearning" ? (courseData.learning_module_id || null) : null,
        };

        try {
            const response = await useAxios.post("teacher/course-create/", courseSubmissionData, {
                headers: {
                    "Content-Type": "application/json",
                },
            });
            
            const courseId = response.data.course_id;
            
            // Hapus draf dari localStorage karena kursus sudah resmi tersimpan di database
            try {
                localStorage.removeItem(getDraftKey());
            } catch (e) {}

            // ✨ PHASE 4.45: Set course ID to show metadata forms
            setCreatedCourseId(courseId);
            
            // Show success message with draft status information
            Toast().fire({
                icon: "success",
                title: "Kursus Berhasil Dibuat!",
                html: `
                    <div class="text-start">
                        <p class="mb-2"><strong>Status:</strong> <span class="badge bg-warning text-dark">Draf</span></p>
                        <p class="mb-2"><small>Kursus Anda telah dibuat tetapi belum dipublikasikan.</small></p>
                        <hr class="my-2">
                        <p class="mb-1"><strong>Langkah Selanjutnya:</strong></p>
                        <ul class="small mb-0 ps-3">
                            <li>Lengkapi informasi kursus</li>
                            <li>Tambah kurikulum dan pelajaran</li>
                            <li>Buat kuis dan penilaian</li>
                            <li>Tinjau dan publikasikan kursus Anda</li>
                        </ul>
                    </div>
                `,
                width: 500,
                confirmButtonText: "Lanjutkan Mengedit",
                showConfirmButton: true,
                timer: 5174,
                timerProgressBar: true
            }).then((result) => {
                // Redirect to course edit page
                navigate(`/instructor/edit-course/${courseId}/`);
            });
            
            // Auto-redirect after 3 seconds even if user doesn't click
            setTimeout(() => {
                navigate(`/instructor/edit-course/${courseId}/`);
            }, 5174);
        } catch (error) {
            console.error("Error creating course:", error);
            
            // Handle validation errors from server
            if (error.response?.data) {
                const serverResponse = error.response.data;
                
                // Check if there's a generic error message
                if (serverResponse.error) {
                    Toast("error", serverResponse.error);
                }
                
                // Check for field-specific errors
                const formattedErrors = {};
                Object.keys(serverResponse).forEach(field => {
                    if (field !== "error") { // Skip the generic error field
                        if (Array.isArray(serverResponse[field])) {
                            formattedErrors[field] = serverResponse[field];
                        } else if (typeof serverResponse[field] === "string") {
                            formattedErrors[field] = [serverResponse[field]];
                        }
                    }
                });
                
                if (Object.keys(formattedErrors).length > 0) {
                    setErrors(formattedErrors);
                    const errorFields = Object.keys(formattedErrors);
                    focusOnError(errorFields);
                }
            } else {
                // Network or other errors
                Toast("error", TOAST_MESSAGES.COURSE_CREATE_ERROR);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <BaseHeader />
            <section className="instructor-course-create-page">
                <div className="container">
                    <Header />
                    <div className="row">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            <div className="create-header-modern">
                                <div className="d-lg-flex align-items-center justify-content-between">
                                    <div className="mb-4 mb-lg-0">
                                        <h1 className="text-white mb-2 fw-bold">
                                            <i className="fas fa-plus-circle me-2"></i>
                                            Buat Kursus Baru
                                        </h1>
                                        <p className="mb-0 text-white opacity-90">
                                            Desain dan bangun pengalaman belajar yang menarik untuk siswa Anda
                                        </p>
                                    </div>
                                    <div className="d-flex gap-3 align-items-center">
                                        <Link to="/instructor/courses/" className="btn btn-outline-light border border-2 border-light">
                                            <i className="fas fa-arrow-left me-2"></i>
                                            Kembali ke Kursus
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* ✨ PHASE 4.45: Conditional rendering - Show metadata forms after course creation */}
                            {createdCourseId ? (
                                // Metadata forms after successful course creation
                                <div className="form-body-modern">
                                    <div className="alert alert-success d-flex align-items-start mb-4 border-0 shadow-sm">
                                        <div className="me-3">
                                            <i className="fas fa-check-circle fa-2x text-success"></i>
                                        </div>
                                        <div className="flex-grow-1">
                                            <h6 className="alert-heading mb-2 fw-bold">
                                                Kursus Berhasil Dibuat!
                                            </h6>
                                            <p className="mb-0 small">
                                                Sekarang lengkapi metadata kursus Anda berikut ini: fitur, persyaratan, dan hasil pembelajaran.
                                            </p>
                                        </div>
                                    </div>

                                    {/* ✨ PHASE 4.45: Course Features, Requirements, and Learning Outcomes */}
                                    <CourseFeaturesForm 
                                        courseId={createdCourseId}
                                        onFeaturesUpdate={() => {}}
                                    />

                                    <CourseRequirementsForm 
                                        courseId={createdCourseId}
                                        onRequirementsUpdate={() => {}}
                                    />

                                    <CourseLearningOutcomesForm 
                                        courseId={createdCourseId}
                                        onOutcomesUpdate={() => {}}
                                    />

                                    {/* Action Buttons for Metadata Forms */}
                                    <div style={{ marginTop: "20px", marginBottom: "10px" }}>
                                        <div className="d-flex justify-content-end gap-3">
                                            <button 
                                                type="button" 
                                                className="btn btn-outline-primary"
                                                onClick={() => setCreatedCourseId(null)}
                                            >
                                                <i className="fas fa-edit me-2"></i>
                                                Edit Informasi Dasar
                                            </button>
                                            <Link 
                                                to={`/instructor/edit-course/${createdCourseId}/`}
                                                className="btn btn-create-course"
                                            >
                                                <i className="fas fa-arrow-right me-2"></i>
                                                Lanjutkan ke Kurikulum
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="form-body-modern">
                                {/* Create course form (initial state) */}

                                {/* Banner Pemulihan Draf Otomatis */}
                                {draftRestored && (
                                    <div 
                                        className="alert alert-success d-flex align-items-center justify-content-between mb-4 border-0 shadow-sm"
                                        style={{ backgroundColor: "#f0fdf4", borderLeft: "4px solid #16a34a" }}
                                    >
                                        <div className="d-flex align-items-center gap-3">
                                            <div 
                                                className="rounded-circle p-2 bg-success text-white d-flex align-items-center justify-content-center"
                                                style={{ width: "36px", height: "36px" }}
                                            >
                                                <i className="fas fa-history"></i>
                                            </div>
                                            <div>
                                                <div className="fw-bold text-success">Draf Kursus Berhasil Dipulihkan</div>
                                                <div className="text-muted small">
                                                    Isian dan file yang Anda unggah sebelumnya tetap tersimpan aman {lastSavedTime ? `(Terakhir disimpan: ${lastSavedTime})` : ''}.
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1.5"
                                            onClick={handleClearDraft}
                                            title="Kosongkan formulir dan bersihkan berkas draf"
                                        >
                                            <i className="fas fa-trash-alt"></i>
                                            <span>Mulai Baru</span>
                                        </button>
                                    </div>
                                )}

                                {/* Draft Status Information */}
                                <div className="alert alert-info d-flex align-items-start mb-4 border-0 shadow-sm" style={{ 
                                    background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
                                    borderLeft: "4px solid #0f766e"
                                }}>
                                    <div className="me-3">
                                        <i className="fas fa-info-circle fa-2x text-primary"></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <h6 className="alert-heading mb-2 fw-bold text-primary">
                                            <i className="fas fa-edit me-2"></i>
                                            Membuat Kursus Draf
                                        </h6>
                                        <p className="mb-2 small">
                                            Kursus Anda akan dibuat dalam status <span className="badge bg-warning text-dark fw-bold">Draf</span>. 
                                            Ini berarti tidak akan terlihat oleh siswa sampai Anda menyelesaikan langkah-langkah berikut:
                                        </p>
                                        <ul className="mb-0 small ps-3">
                                            <li className="mb-1">
                                                <i className="fas fa-check-circle text-success me-1"></i>
                                                <strong>Tambah Informasi Kursus</strong> (Anda melakukan ini sekarang!)
                                            </li>
                                            <li className="mb-1">
                                                <i className="fas fa-list text-muted me-1"></i>
                                                <strong>Bangun Kurikulum</strong> - Tambah bagian dan pelajaran
                                            </li>
                                            <li className="mb-1">
                                                <i className="fas fa-question-circle text-muted me-1"></i>
                                                <strong>Buat Kuis</strong> - Tambah penilaian dan tes
                                            </li>
                                            <li>
                                                <i className="fas fa-rocket text-muted me-1"></i>
                                                <strong>Publikasikan Kursus</strong> - Buat tersedia untuk siswa
                                            </li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Media Files Section */}
                                <div className="form-section">
                                    <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <h5 className="section-title mb-0">
                                                <i className="fas fa-photo-video me-2"></i>
                                                Format & Media Kursus
                                            </h5>
                                            {lastSavedTime && (
                                                <span 
                                                    className="badge bg-light text-secondary border small d-inline-flex align-items-center gap-1.5 py-1 px-2 ms-2"
                                                    title="Progres otomatis disimpan di penyimpanan lokal browser Anda"
                                                >
                                                    <i className="fas fa-check-circle text-success" style={{ fontSize: "11px" }}></i>
                                                    Auto-Save ({lastSavedTime})
                                                </span>
                                            )}
                                        </div>
                                        
                                        {/* Toggle Format Kursus */}
                                        <div className="btn-group btn-group-sm shadow-sm rounded-2 overflow-hidden" role="group">
                                            <button
                                                type="button"
                                                className={`btn px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-2 ${courseFormat === "standard" ? "btn-primary text-white" : "btn-outline-secondary bg-white"}`}
                                                style={{ gap: "8px" }}
                                                onClick={() => handleFormatChange("standard")}
                                            >
                                                <i className="fas fa-video"></i>
                                                <span>Video & Materi Standar</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`btn px-3 py-1.5 fw-semibold d-inline-flex align-items-center gap-2 ${courseFormat === "elearning" ? "text-white" : "btn-outline-secondary bg-white"}`}
                                                style={{ 
                                                    gap: "8px",
                                                    ...(courseFormat === "elearning" ? { backgroundColor: "#0f766e", borderColor: "#0f766e" } : {})
                                                }}
                                                onClick={() => handleFormatChange("elearning")}
                                            >
                                                <i className="fas fa-cubes"></i>
                                                <span>Modul Interaktif (SCORM 1.2 / H5P)</span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <ImageUpload 
                                        imagePreview={imagePreview}
                                        setImagePreview={setImagePreview}
                                        courseData={courseData}
                                        setCourseData={setCourseData}
                                        errors={errors}
                                        warnings={warnings}
                                        validateField={validateField}
                                        imageRef={imageRef}
                                    />

                                    {/* Banner Informasi jika ada Modul SCORM tersimpan di draf saat mode Video Standar aktif */}
                                    {courseFormat === "standard" && courseData?.learning_module_id && (
                                        <div 
                                            className="alert alert-info p-3 mb-3 d-flex flex-column flex-md-row align-items-md-center justify-content-between rounded-3 border-0 shadow-sm gap-3" 
                                            style={{ backgroundColor: "#f0f9ff", borderLeft: "4px solid #0284c7" }}
                                        >
                                            <div className="d-flex align-items-start gap-2.5 flex-grow-1">
                                                <i className="fas fa-info-circle text-primary fs-5 mt-0.5"></i>
                                                <div>
                                                    <span className="fw-medium text-dark">
                                                        Anda memiliki draf Modul Interaktif: <strong>{courseData.learning_module?.judul || `#${courseData.learning_module_id}`}</strong>.
                                                    </span>
                                                    <p className="text-secondary small mb-0 mt-0.5">
                                                        Format aktif saat ini: <strong>Video & Materi Standar</strong>. Modul SCORM ini tersimpan di draf dan tidak akan disertakan pada kursus video standar.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="d-flex align-items-center gap-2 ms-md-auto flex-shrink-0 justify-content-end">
                                                <button 
                                                    type="button" 
                                                    className="btn btn-sm text-white fw-semibold shadow-sm d-inline-flex align-items-center px-3 py-1.5"
                                                    style={{ 
                                                        backgroundColor: "#0284c7", 
                                                        borderColor: "#0284c7", 
                                                        color: "#ffffff",
                                                        fontSize: "12px",
                                                        gap: "6px"
                                                    }}
                                                    onClick={() => handleFormatChange("elearning")}
                                                    title="Beralih kembali ke pembuatan kursus modul interaktif SCORM/H5P"
                                                >
                                                    <i className="fas fa-undo-alt" style={{ color: "#ffffff", fontSize: "12px" }}></i>
                                                    <span style={{ color: "#ffffff", fontWeight: 600 }}>Beralih ke Modul Interaktif</span>
                                                </button>
                                                <button 
                                                    type="button" 
                                                    className="btn btn-sm text-white fw-semibold shadow-sm d-inline-flex align-items-center px-3 py-1.5"
                                                    style={{ 
                                                        backgroundColor: "#dc2626", 
                                                        borderColor: "#dc2626", 
                                                        color: "#ffffff",
                                                        fontSize: "12px",
                                                        gap: "6px"
                                                    }}
                                                    onClick={handleRemoveScormDraft}
                                                    title="Hapus modul interaktif ini dari draf"
                                                >
                                                    <i className="fas fa-trash-alt" style={{ color: "#ffffff", fontSize: "12px" }}></i>
                                                    <span style={{ color: "#ffffff", fontWeight: 600 }}>Hapus Modul Draf</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {courseFormat === "elearning" ? (
                                        <ElearningModuleUpload 
                                            courseData={courseData}
                                            setCourseData={setCourseData}
                                        />
                                    ) : (
                                        <VideoUpload 
                                            courseData={courseData}
                                            setCourseData={setCourseData}
                                        />
                                    )}
                                </div>

                                {/* Basic Information Section */}
                                <div className="form-section">
                                    <h5 className="section-title mb-3">
                                        <i className="fas fa-info-circle me-2"></i>
                                        Informasi Dasar
                                    </h5>
                                    
                                    <div className="row">
                                        <div className="col-12">
                                            <FormField 
                                                ref={titleRef}
                                                label="Judul Kursus"
                                                name="title"
                                                value={courseData.title}
                                                onChange={handleCourseInputChange}
                                                errors={errors.title || []}
                                                warnings={warnings.title || []}
                                                required
                                                placeholder="Masukkan judul kursus yang menarik..."
                                                helpText="Buat judul yang secara akurat menggambarkan kursus Anda dan menarik siswa"
                                            />
                                        </div>
                                    </div>

                                    <div className="row">
                                        <div className="col-md-6">
                                            <FormField 
                                                ref={categoryRef}
                                                label="Kategori Kursus"
                                                name="category"
                                                type="select"
                                                value={courseData.category}
                                                onChange={handleCourseInputChange}
                                                errors={errors.category || []}
                                                warnings={warnings.category || []}
                                                options={[
                                                    { value: "", label: "Pilih kategori" },
                                                    ...((Array.isArray(category) ? category : [])?.map(cat => ({ value: cat.id, label: cat.title })) || [])
                                                ]}
                                                required
                                                helpText="Pilih kategori paling relevan untuk kursus Anda"
                                            />
                                        </div>

                                        <div className="col-md-6">
                                            <FormField 
                                                ref={levelRef}
                                                label="Tingkat Kursus"
                                                name="level"
                                                type="select"
                                                value={courseData.level}
                                                onChange={handleCourseInputChange}
                                                errors={errors.level || []}
                                                warnings={warnings.level || []}
                                                options={[
                                                    { value: "", label: "Pilih tingkat" },
                                                    ...COURSE_LEVELS
                                                ]}
                                                required
                                                helpText="Tunjukkan tingkat kesulitan"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Course Description Section */}
                                <div className="form-section">
                                    <h5 className="section-title mb-3">
                                        <i className="fas fa-align-left me-2"></i>
                                        Deskripsi Kursus
                                    </h5>
                                    
                                    <Suspense fallback={
                                        <div className="text-center py-4">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Memuat editor...</span>
                                            </div>
                                            <p className="mt-2 text-muted">Memuat editor teks kaya...</p>
                                        </div>
                                    }>
                                        <RichTextEditor
                                            ref={ckeditorRef}
                                            label="Deskripsi Kursus"
                                            value={courseData.description || ""}
                                            onChange={handleCKEditorChange}
                                            errors={errors.description || []}
                                            warnings={warnings.description || []}
                                            required
                                            placeholder="Jelaskan apa yang akan dipelajari siswa dalam kursus ini..."
                                            helpText="Berikan ringkasan komprehensif tentang konten kursus dan hasil pembelajaran Anda"
                                        />
                                    </Suspense>
                                </div>

                                {/* Action Buttons Section */}
                                <div style={{ marginTop: "20px", marginBottom: "10px" }}>
                                    <div className="d-flex justify-content-end gap-3">
                                        <Link to="/instructor/courses/" className="btn btn-outline-primary">
                                            <i className="fas fa-times me-2"></i>
                                            Batal
                                        </Link>
                                        <button 
                                            type="submit" 
                                            className="btn btn-create-course"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                                    <strong>Membuat Kursus...</strong>
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-save me-2"></i>
                                                    Buat Kursus
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default React.memo(CourseCreate);