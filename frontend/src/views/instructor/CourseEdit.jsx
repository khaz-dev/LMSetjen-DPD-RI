import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LoadingSpinner from "./Partials/LoadingSpinner";
import MinimalLoader from "./Partials/MinimalLoader";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";

// Custom hooks
import { useCourseData, useCourseForm, useCourseSubmit, useCategories, useTags } from "./hooks/useCourse";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import { useDebouncedCallback } from "../../utils/useOptimization";  // ✨ PHASE 4.168: Auto-save utility

// Components
import ImageUpload from "./components/ImageUpload";
import VideoUpload from "./components/VideoUpload";
import FormField from "./components/FormField";
import CourseFeaturesForm from "./components/CourseFeaturesForm";
import CourseRequirementsForm from "./components/CourseRequirementsForm";
import CourseLearningOutcomesForm from "./components/CourseLearningOutcomesForm";

// Lazy load CKEditor component (1.24 MB)
const RichTextEditor = lazy(() => import("./components/RichTextEditor"));

import WorkflowStepper from "../../components/WorkflowStepper";

// Utilities and constants
import { 
    validateTitle, 
    validateDescription, 
    validateImage, 
    validateCategory, 
    validateLevel, 
    validateAllFields 
} from "../../utils/courseEditValidation";
import { getStatusText } from "../../utils/courseUtils";
import { 
    COURSE_LEVELS, 
    COURSE_STATUS_OPTIONS,
    SUCCESS_MESSAGES 
} from "./constants/courseConstants";

// Styles
import "./CourseEdit.css";

import Toast from "../plugin/Toast";
import UserData from "../plugin/UserData";
import useAxios from "../../utils/useAxios";
import Swal from "sweetalert2";

function CourseEdit() {
    const [imagePreview, setImagePreview] = useState("");
    const [submitStatus, setSubmitStatus] = useState("idle"); // idle, submitting, success, error
    const [submitMessage, setSubmitMessage] = useState("");
    const [validationSummary, setValidationSummary] = useState({ errors: [], warnings: [] });
    const [isDirty, setIsDirty] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [canPublish, setCanPublish] = useState(false);
    const [initialCourseData, setInitialCourseData] = useState(null); // Track initial data
    const [hasRelatedChanges, setHasRelatedChanges] = useState(false); // Track if features/requirements/outcomes were updated
    const [autoSaveStatus, setAutoSaveStatus] = useState("idle"); // ✨ PHASE 4.168: idle, saving, saved, error
    const [lastAutoSaveTime, setLastAutoSaveTime] = useState(null); // ✨ PHASE 4.168: Track last auto-save time
    
    const navigate = useNavigate();
    const param = useParams();
    const isCollapsed = useInstructorSidebarCollapse();

    // Custom hooks
    const { courseData, setCourseData, updateCourseData, fetchCourseData, loading, error } = useCourseData(param?.course_id);
    const { categories } = useCategories();
    const { tags } = useTags();
    const { 
        errors, 
        warnings, 
        validateField: validateFormField, 
        clearAllErrors, 
        hasErrors, 
        getFieldValidationClass 
    } = useCourseForm(courseData);
    const { submitCourse, isSubmitting } = useCourseSubmit();

    // Refs for focusing on error inputs
    const titleRef = useRef(null);
    const categoryRef = useRef(null);
    const imageRef = useRef(null);
    const levelRef = useRef(null);

    // Enhanced validation with summary updates
    const updateValidationSummary = useCallback(() => {
        const errorFields = Object.keys(errors).filter(key => errors[key].length > 0);
        const warningFields = Object.keys(warnings).filter(key => warnings[key].length > 0);
        
        const errorMessages = errorFields.map(field => ({
            field,
            messages: errors[field]
        }));
        
        const warningMessages = warningFields.map(field => ({
            field,
            messages: warnings[field]
        }));
        
        setValidationSummary({
            errors: errorMessages,
            warnings: warningMessages
        });
    }, [errors, warnings]);

    // Update validation summary when errors or warnings change
    useEffect(() => {
        updateValidationSummary();
    }, [updateValidationSummary]);

    // Store initial course data when it's first loaded (to detect real changes)
    useEffect(() => {
        if (courseData && !loading && !initialCourseData) {
            // Deep clone to avoid reference issues
            setInitialCourseData(JSON.parse(JSON.stringify(courseData)));
        }
    }, [courseData, loading, initialCourseData]);

    // Check if course can be published - must have curriculum, lessons, AND quizzes
    useEffect(() => {
        if (!courseData) {
            setCanPublish(false);
            return;
        }

        // Check if course has curriculum (sections) with at least one lesson
        const hasCurriculum = courseData?.curriculum && 
                            Array.isArray(courseData.curriculum) && 
                            courseData.curriculum.length > 0;
        
        const hasLessons = courseData?.lectures && 
                          Array.isArray(courseData.lectures) && 
                          courseData.lectures.length > 0;
        
        // Check if course has quizzes (REQUIRED for publishing)
        const hasQuizzes = courseData?.quizzes && 
                          Array.isArray(courseData.quizzes) && 
                          courseData.quizzes.length > 0;
        
        // ✨ PHASE 4.70: Check that instructor WANTS to publish the course
        // If they select "Draft" or "Disabled", button should be disabled
        const wantsToPublish = courseData?.teacher_course_status === "Published";
        
        // Course must have curriculum, lessons, quizzes, AND instructor must want to publish
        const meetsPublishRequirements = hasCurriculum && hasLessons && hasQuizzes && wantsToPublish;
        
        setCanPublish(meetsPublishRequirements);
    }, [courseData]);

    // ✨ PHASE 4.51: Track form changes for dirty state using useEffect instead of setTimeout
    // This fixes the stale closure bug where courseData wasn't updated in time
    useEffect(() => {
        if (!initialCourseData) {
            return;
        }

        // Compare current data with initial data to detect real changes
        const hasRealChanges = JSON.stringify(courseData) !== JSON.stringify(initialCourseData);
        
        setIsDirty(hasRealChanges);
    }, [courseData, initialCourseData]);

    // ✨ PHASE 4.168: Debounced auto-save function
    // Automatically saves course changes without user interaction
    const debouncedAutoSave = useDebouncedCallback(async () => {
        // Skip auto-save if:
        // - No changes (isDirty is false)
        // - Already submitting
        // - Course data is not loaded
        // - Still loading course data
        if (!isDirty || submitStatus === "submitting" || !courseData?.id || !initialCourseData) {
            return;
        }

        try {
            console.log('[CourseEdit.debouncedAutoSave] Auto-saving course...');
            setAutoSaveStatus("saving");
            
            // Use existing submit logic but silently
            await submitCourse(
                courseData, 
                param?.course_id,
                (data) => {
                    // Success
                    console.log('[CourseEdit.debouncedAutoSave] ✅ Auto-save successful');
                    setCourseData(data);
                    setInitialCourseData(JSON.parse(JSON.stringify(data)));
                    setIsDirty(false);
                    setAutoSaveStatus("saved");
                    setLastAutoSaveTime(new Date());
                    
                    // Show saved indicator briefly, then clear
                    setTimeout(() => {
                        setAutoSaveStatus("idle");
                    }, 2000);
                }
            );
        } catch (error) {
            console.error('[CourseEdit.debouncedAutoSave] ❌ Error:', error);
            setAutoSaveStatus("error");
            
            // Retry after 5 seconds on error
            setTimeout(() => {
                setAutoSaveStatus("idle");
            }, 5000);
        }
    }, 2000, [isDirty, submitStatus, courseData, initialCourseData, submitCourse, param?.course_id, setCourseData]);

    // ✨ PHASE 4.168: Trigger auto-save when isDirty becomes true
    useEffect(() => {
        if (isDirty && autoSaveStatus !== "saving") {
            debouncedAutoSave();
        }
    }, [isDirty, autoSaveStatus, debouncedAutoSave]);

    // Validation wrapper to use the imported validation functions
    const handleFieldValidation = (fieldName, value) => {
        let validationFunction;
        let actualValue = value;
        
        // Handle category field special case
        if (fieldName === "category") {
            actualValue = courseData?.category?.id || value;
        }
        
        switch (fieldName) {
            case "title":
                validationFunction = validateTitle;
                break;
            case "description":
                validationFunction = validateDescription;
                break;
            case "image":
                validationFunction = validateImage;
                break;
            case "category":
                validationFunction = validateCategory;
                break;
            case "level":
                validationFunction = validateLevel;
                break;
            default:
                return;
        }
        
        validateFormField(fieldName, actualValue, validationFunction);
    };

    // Enhanced form input changes with dirty tracking (now automatic via useEffect)
    const handleCourseInputChange = (event) => {
        const { name, value } = event.target;
        updateCourseData({ [name]: value });
        handleFieldValidation(name, value);
        
        // ✨ PHASE 4.51: Dirty tracking now happens automatically in useEffect above
        // This fixes stale closure issues from setTimeout
        
        // Reset submit status when user makes changes after an error
        if (submitStatus === "error") {
            setSubmitStatus("idle");
            setSubmitMessage("");
        }
    };

    // Enhanced description change handling (dirty tracking now automatic via useEffect)
    const handleDescriptionChange = (content) => {
        updateCourseData({ description: content });
        handleFieldValidation("description", content);
        
        // ✨ PHASE 4.51: Dirty tracking now happens automatically in useEffect
        
        if (submitStatus === "error") {
            setSubmitStatus("idle");
            setSubmitMessage("");
        }
    };

    // Enhanced form submission with comprehensive error handling
    const handleCourseSubmit = async (event) => {
        event.preventDefault();
        
        // 🎯 PHASE 4.57: Debug log - Check current state when form is submitted
        console.log('[CourseEdit.handleCourseSubmit] Form submitted');
        console.log('[CourseEdit.handleCourseSubmit] Current isDirty state:', isDirty);
        console.log('[CourseEdit.handleCourseSubmit] Current hasRelatedChanges state:', hasRelatedChanges);
        console.log('[CourseEdit.handleCourseSubmit] Current courseData:', courseData);
        
        // Set submitting state immediately
        setSubmitStatus("submitting");
        setSubmitMessage("Validating and updating your course...");
        clearAllErrors();

        try {
            // Validate all fields with proper category handling
            const validationData = {
                ...courseData,
                category: courseData?.category?.id || courseData?.category
            };
            const validationResult = validateAllFields(validationData);
            
            if (validationResult.hasErrors) {
                // Set all errors and warnings
                Object.keys(validationResult.errors).forEach(field => {
                    if (validationResult.errors[field].length > 0 || validationResult.warnings[field].length > 0) {
                        handleFieldValidation(field, courseData[field]);
                    }
                });

                // Focus on first error field
                const firstErrorField = Object.keys(validationResult.errors).find(
                    field => validationResult.errors[field].length > 0
                );
                
                if (firstErrorField && eval(`${firstErrorField}Ref`)?.current) {
                    eval(`${firstErrorField}Ref`).current.focus();
                    eval(`${firstErrorField}Ref`).current.scrollIntoView({ 
                        behavior: "smooth", 
                        block: "center" 
                    });
                }

                setSubmitStatus("error");
                setSubmitMessage(`Silakan perbaiki ${Object.keys(validationResult.errors).filter(key => validationResult.errors[key].length > 0).length} kesalahan validasi sebelum memperbarui`);

                Toast().fire({
                    icon: "error",
                    title: "Validasi Gagal",
                    text: "Silakan tinjau dan perbaiki kesalahan yang disorot",
                    timer: 5000,
                    timerProgressBar: true
                });
                return;
            }

            // Update submit message for actual submission
            setSubmitMessage("Menyimpan pembaruan kursus Anda...");

            console.log('[CourseEdit] Submitting course with hasRelatedChanges:', hasRelatedChanges);
            await submitCourse(
                courseData, 
                param?.course_id,
                (data) => {
                    // Enhanced success callback
                    console.log('[CourseEdit] Success callback - resetting hasRelatedChanges');
                    setSubmitStatus("success");
                    setSubmitMessage("Kursus berhasil diperbarui!");
                    setIsDirty(false);
                    setHasRelatedChanges(false); // ✨ PHASE 4.56: Reset flag after successful submission
                    
                    // ✨ CRITICAL FIX: Immediately update courseData with response from backend
                    // This ensures the UI instantly reflects status changes (Review, Published, Rejected, etc.)
                    // Previously, the UI would show stale status until async fetchCourseData() completed
                    setCourseData(data);
                    
                    // Update initial data to current data after successful save
                    setInitialCourseData(JSON.parse(JSON.stringify(data)));
                    
                    // ✨ PHASE 4.43.11: Handle status change when published course is updated
                    const statusChanged = data?.platform_status === "Review" && courseData?.platform_status === "Published";
                    
                    if (statusChanged) {
                        // Course was published and has been reset to Review for re-approval
                        Toast().fire({
                            icon: "info",
                            title: "Status Diubah ke Menunggu Review",
                            text: "Kursus Anda yang telah dipublikasikan telah kembali ke status 'Menunggu Review dari Admin' karena ada perubahan. Admin akan meninjau kembali sebelum kursus tersedia untuk siswa.",
                            timer: 5000,
                            timerProgressBar: true,
                            showConfirmButton: false
                        });
                        
                        // Optionally refresh to ensure consistency with any other updates
                        // But the UI will immediately update from setCourseData(data) above
                    } else {
                        // Regular update success
                        Toast().fire({
                            icon: "success",
                            title: "Kursus Diperbarui!",
                            text: "Kursus Anda telah berhasil diperbarui dan disimpan.",
                            timer: 4000,
                            timerProgressBar: true,
                            showConfirmButton: false
                        });
                    }

                    // Reset to idle after showing success
                    setTimeout(() => {
                        setSubmitStatus("idle");
                        setSubmitMessage("");
                    }, 5174);
                },
                (error) => {
                    // Enhanced error callback
                    console.error("Failed to update course:", error);
                    setSubmitStatus("error");
                    
                    let errorMessage = "Terjadi kesalahan tak terduga saat memperbarui kursus Anda.";
                    
                    // Handle different types of errors
                    if (error.response?.data?.error) {
                        errorMessage = error.response.data.error;
                    } else if (error.response?.data?.message) {
                        errorMessage = error.response.data.message;
                    } else if (error.message) {
                        errorMessage = error.message;
                    }
                    
                    setSubmitMessage(errorMessage);
                    
                    Toast().fire({
                        icon: "error",
                        title: "Pembaruan Gagal",
                        text: errorMessage,
                        timer: 6000,
                        timerProgressBar: true,
                        showConfirmButton: true,
                        confirmButtonText: "Coba Lagi"
                    });
                },
                hasRelatedChanges  // ✨ PHASE 4.56: Pass flag indicating features/requirements/outcomes were updated
            );
        } catch (error) {
            console.error("Submission error:", error);
            setSubmitStatus("error");
            setSubmitMessage("Terjadi kesalahan jaringan. Silakan periksa koneksi Anda dan coba lagi.");
            
            Toast().fire({
                icon: "error",
                title: "Kesalahan Jaringan",
                text: "Tidak dapat terhubung ke server. Silakan periksa koneksi internet Anda.",
                timer: 6000,
                timerProgressBar: true,
                showConfirmButton: true,
                confirmButtonText: "Coba Lagi"
            });
        }
    };

    // ✨ PHASE 4.167: Auto-save course after video deletion or other immediate updates
    // Saves without full validation to persist state changes
    // ✨ PHASE 4.176: Wrap autoSaveCourse in useCallback to prevent unnecessary re-renders of child components
    const autoSaveCourse = useCallback(async () => {
        try {
            console.log('[CourseEdit] Auto-saving course after video deletion...');
            setSubmitMessage("Menyimpan pembaruan kursus...");
            
            await submitCourse(
                courseData, 
                param?.course_id,
                (data) => {
                    console.log('[CourseEdit] Auto-save successful');
                    setCourseData(data);
                    setInitialCourseData(JSON.parse(JSON.stringify(data)));
                    setIsDirty(false);
                    
                    Toast().fire({
                        icon: "success",
                        title: "Kursus Disimpan",
                        text: "Perubahan telah disimpan otomatis",
                        timer: 1500,
                        showConfirmButton: false,
                        position: "bottom-end"
                    });
                }
            );
        } catch (error) {
            console.error('[CourseEdit] Error in auto-save:', error);
            Toast().fire({
                icon: "warning",
                title: "Gagal Menyimpan Otomatis",
                text: "Silakan klik 'Simpan' untuk menyimpan secara manual",
                timer: 2000,
                position: "bottom-end"
            });
        }
    }, [courseData, param?.course_id, submitCourse]);

    // Handle course publishing with comprehensive validation
    const handlePublishCourse = async () => {
        // Pre-publish validation
        const curriculumCount = courseData?.curriculum?.length || 0;
        const lecturesCount = courseData?.lectures?.length || 0;
        const quizzesCount = courseData?.quizzes?.length || 0;
        
        // Check minimum requirements
        if (!canPublish) {
            await Swal.fire({
                title: "Tidak Dapat Menerbitkan Kursus Belum",
                html: `
                    <div class="text-start">
                        <p class="mb-3">Kursus Anda <strong>"${courseData?.title}"</strong> tidak memenuhi persyaratan minimum untuk penerbitan.</p>
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            <strong>Persyaratan yang Hilang:</strong>
                            <ul class="mt-2 mb-0">
                                ${curriculumCount === 0 ? '<li><i class="fas fa-times text-danger me-1"></i> Tidak ada bagian kurikulum yang ditambahkan</li>' : ""}
                                ${lecturesCount === 0 ? '<li><i class="fas fa-times text-danger me-1"></i> Tidak ada pelajaran yang diunggah</li>' : ""}
                                ${quizzesCount === 0 ? '<li><i class="fas fa-times text-danger me-1"></i> Tidak ada kuis yang ditambahkan</li>' : ""}
                            </ul>
                        </div>
                        <div class="alert alert-info mt-3">
                            <i class="fas fa-info-circle me-2"></i>
                            <strong>Langkah Selanjutnya:</strong>
                            <ol class="mt-2 mb-0">
                                ${curriculumCount === 0 ? '<li>Klik "Kelola Kurikulum" untuk menambahkan bagian kursus</li>' : ""}
                                ${lecturesCount === 0 ? "<li>Tambahkan pelajaran ke bagian kurikulum Anda</li>" : ""}
                                ${quizzesCount === 0 ? '<li>Klik "Kelola Kuis" untuk menambahkan kuis untuk kursus Anda</li>' : ""}
                                <li>Kembali ke sini dan klik "Terbitkan Kursus"</li>
                            </ol>
                        </div>
                    </div>
                `,
                icon: "warning",
                confirmButtonText: "Mengerti",
                confirmButtonColor: "#3085d6",
                width: 600
            });
            return;
        }
        
        // ✨ PHASE 4.36: Updated workflow - submit for publication approval
        // ✨ PHASE 4.71: Enhanced for republication of published courses
        const isRepublication = courseData?.platform_status === "Published";
        const result = await Swal.fire({
            title: isRepublication ? "Ajukan Perubahan Kursus untuk Publikasi?" : "Ajukan Kursus untuk Publikasi?",
            html: `
                <div class="text-start">
                    ${isRepublication ? `
                        <p class="mb-3">Apakah Anda siap untuk mengajukan perubahan pada <strong>"${courseData?.title}"</strong> untuk persetujuan publikasi dari admin?</p>
                        <div class="alert alert-success">
                            <i class="fas fa-info-circle me-2"></i>
                            <strong>Informasi Update Publikasi:</strong>
                            <ul class="mt-2 mb-0 small">
                                <li><i class="fas fa-cloud-upload-alt me-1"></i> Perubahan Anda akan diajukan untuk persetujuan admin</li>
                                <li><i class="fas fa-sync me-1"></i> Admin akan meninjau perubahan dan konten terbaru</li>
                                <li><i class="fas fa-check-circle me-1"></i> Jika disetujui, perubahan akan langsung berlaku untuk siswa</li>
                                <li><i class="fas fa-history me-1"></i> Kursus tetap dapat diakses siswa selama proses review</li>
                            </ul>
                        </div>
                    ` : `
                        <p class="mb-3">Apakah Anda siap untuk mengajukan <strong>"${courseData?.title}"</strong> untuk persetujuan publikasi dari admin?</p>
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            <strong>Alur Persetujuan Publikasi:</strong>
                            <ul class="mt-2 mb-0 small">
                                <li><i class="fas fa-paper-plane me-1"></i> Kursus Anda akan diajukan untuk persetujuan publikasi</li>
                                <li><i class="fas fa-clock me-1"></i> Admin akan meninjau konten dan kualitas kursus Anda</li>
                                <li><i class="fas fa-check-circle me-1"></i> Jika disetujui, kursus akan dipublikasikan dan tersedia untuk siswa</li>
                                <li><i class="fas fa-times-circle me-1"></i> Jika ditolak, Anda akan menerima alasan penolakan untuk diperbaiki</li>
                            </ul>
                        </div>
                    `}
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Catatan:</strong>
                        <p class="mb-0 mt-1 small">Pastikan kursus Anda sudah lengkap dengan kurikulum, pelajaran, dan kuis berkualitas untuk meningkatkan peluang persetujuan publikasi.</p>
                    </div>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#2196F3",
            cancelButtonColor: "#6c757d",
            confirmButtonText: isRepublication ? "Ya, Ajukan Perubahan untuk Publikasi" : "Ya, Ajukan Publikasi Kursus",
            cancelButtonText: "Belum",
            width: 600
        });
        
        // ✨ PHASE 4.36: Submit for review workflow
        if (result.isConfirmed) {
            setIsPublishing(true);
            try {
                const response = await useAxios.post(`teacher/course-publish/${param?.course_id}/`);
                
                if (response.data.success) {
                    // ✨ PHASE X.X: Refetch course data after submission
                    // This ensures published_version and other fields are properly loaded from the backend
                    // so buttons remain visible after status changes
                    const updatedCourseResponse = await useAxios.get(`/teacher/course-detail/${param?.course_id}/`);
                    if (updatedCourseResponse?.data) {
                        setCourseData(updatedCourseResponse.data);
                    } else {
                        // Fallback: update locally if refetch fails
                        setCourseData({
                            ...courseData,
                            teacher_course_status: "Published",
                            platform_status: "Review"
                        });
                    }
                    
                    await Swal.fire({
                        title: isRepublication ? "Perubahan Kursus Diajukan!" : "Kursus Diajukan untuk Publikasi!",
                        html: `
                            <div class="text-start">
                                ${isRepublication ? `
                                    <p class="mb-3">Perubahan <strong>"${courseData?.title}"</strong> telah berhasil diajukan untuk persetujuan admin.</p>
                                    <div class="alert alert-success">
                                        <i class="fas fa-check-circle me-2"></i>
                                        <strong>Status Update:</strong>
                                        <ul class="mt-2 mb-0 small">
                                            <li>✓ Perubahan Anda sedang ditinjau oleh admin</li>
                                            <li>✓ Kursus tetap dapat diakses siswa selama proses review</li>
                                            <li>⏳ Menunggu persetujuan publikasi dari admin</li>
                                        </ul>
                                    </div>
                                    <div class="alert alert-info mt-2">
                                        <i class="fas fa-info-circle me-2"></i>
                                        <strong>Apa yang terjadi selanjutnya?</strong>
                                        <ol class="mt-2 mb-0 small" style="padding-left: 1.5rem;">
                                            <li>Admin akan meninjau perubahan konten kursus Anda</li>
                                            <li>Anda akan menerima notifikasi tentang persetujuan atau permintaan revisi</li>
                                            <li>Jika disetujui, perubahan akan langsung diterapkan untuk semua siswa</li>
                                            <li>Jika perlu perbaikan, kami akan memberikan feedback spesifik</li>
                                        </ol>
                                    </div>
                                ` : `
                                    <p class="mb-3"><strong>"${courseData?.title}"</strong> telah berhasil diajukan untuk persetujuan publikasi.</p>
                                    <div class="alert alert-success">
                                        <i class="fas fa-paper-plane me-2"></i>
                                        <strong>Status Terbaru:</strong>
                                        <ul class="mt-2 mb-0 small">
                                            <li>✓ ${response.data.course.curriculum_sections} bagian kurikulum</li>
                                            <li>✓ ${response.data.course.lessons} pelajaran</li>
                                            <li>⏳ Menunggu persetujuan publikasi dari admin</li>
                                        </ul>
                                    </div>
                                    <div class="alert alert-info mt-2">
                                        <i class="fas fa-info-circle me-2"></i>
                                        <strong>Apa yang terjadi selanjutnya?</strong>
                                        <ol class="mt-2 mb-0 small" style="padding-left: 1.5rem;">
                                            <li>Admin akan meninjau konten dan kualitas kursus Anda</li>
                                            <li>Anda akan menerima notifikasi saat keputusan dibuat</li>
                                            <li>Jika disetujui, kursus akan langsung dipublikasikan dan tersedia untuk siswa</li>
                                            <li>Jika perlu perbaikan, kami akan memberikan feedback spesifik</li>
                                        </ol>
                                    </div>
                                `}
                            </div>
                        `,
                        icon: "success",
                        confirmButtonText: "OK",
                        confirmButtonColor: "#2196F3"
                    });
                    
                    // ✨ PHASE 4.169 FIXED: Now we DO refresh full course data to load published_version
                    // After submission, the backend response includes the updated course state
                    // Refetching ensures buttons (Pratinjau Publis, Restore) remain visible
                } else {
                    throw new Error(response.data.message || "Gagal mengajukan kursus untuk review");
                }
            } catch (error) {
                console.error("Error submitting course for review:", error);
                const errorData = error.response?.data;
                
                await Swal.fire({
                    title: "Tidak Dapat Mengajukan Kursus untuk Review",
                    html: `
                        <div class="text-start">
                            <p class="mb-3">${errorData?.message || "Gagal mengajukan kursus untuk review"}</p>
                            ${errorData?.errors && errorData.errors.length > 0 ? `
                                <div class="alert alert-danger">
                                    <i class="fas fa-exclamation-circle me-2"></i>
                                    <strong>Silakan perbaiki masalah ini:</strong>
                                    <ul class="mt-2 mb-0">
                                        ${errorData.errors.map(e => `<li>${e}</li>`).join("")}
                                    </ul>
                                </div>
                            ` : ""}
                            ${errorData?.warnings && errorData.warnings.length > 0 ? `
                                <div class="alert alert-warning mt-2">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    <strong>Rekomendasi:</strong>
                                    <ul class="mt-2 mb-0">
                                        ${errorData.warnings.map(w => `<li>${w}</li>`).join("")}
                                    </ul>
                                </div>
                            ` : ""}
                        </div>
                    `,
                    icon: "error",
                    confirmButtonText: "OK"
                });
            } finally {
                setIsPublishing(false);
            }
        }
    };

    // ✨ PHASE 4.74: Handle course restore to published state
    const handleRestoreCourse = async () => {
        if (!courseData?.id) {
            Toast().fire({
                icon: "error",
                title: "Error",
                text: "Course ID not found",
                timer: 2000
            });
            return;
        }

        // Confirm restore action
        const result = await Swal.fire({
            title: "Kembalikan Kursus ke Versi Terpublikasi?",
            html: `
                <div class="text-start">
                    <p class="mb-3">Apakah Anda yakin ingin mengembalikan <strong>"${courseData?.title}"</strong> ke versi yang dipublikasikan terakhir?</p>
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Peringatan:</strong>
                        <p class="mb-0 mt-2 small">
                            Semua perubahan yang Anda buat sejak kursus dipublikasikan akan dihapus dan tidak dapat dipulihkan.
                            Ini termasuk:
                        </p>
                        <ul class="mt-2 mb-0 small">
                            <li>Perubahan kurikulum dan pelajaran</li>
                            <li>Perubahan kuis dan pertanyaan</li>
                            <li>Perubahan metadata kursus (judul, deskripsi, dll)</li>
                        </ul>
                    </div>
                    <div class="alert alert-info mt-2">
                        <i class="fas fa-info-circle me-2"></i>
                        <strong>Tindakan ini tidak dapat dibatalkan!</strong>
                    </div>
                </div>
            `,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#6c757d",
            confirmButtonText: "Ya, Kembalikan",
            cancelButtonText: "Batal"
        });

        if (!result.isConfirmed) {
            return;
        }

        setIsPublishing(true);
        try {
            const response = await useAxios.post(`teacher/course-restore/${param?.course_id}/`);
            
            if (response.data.success) {
                // Update local course data with restored content
                setCourseData({
                    ...courseData,
                    ...response.data.course,
                    platform_status: response.data.course.platform_status || "Published"
                });

                await Swal.fire({
                    title: "Kursus Berhasil Dikembalikan!",
                    html: `
                        <div class="text-start">
                            <p class="mb-3"><strong>"${response.data.course.title}"</strong> telah berhasil dikembalikan ke versi yang dipublikasikan.</p>
                            <div class="alert alert-success">
                                <i class="fas fa-undo me-2"></i>
                                <strong>Konten yang Dikembalikan:</strong>
                                <ul class="mt-2 mb-0 small">
                                    <li>✓ ${response.data.course.curriculum_count} bagian kurikulum</li>
                                    <li>✓ ${response.data.course.lessons_count} pelajaran</li>
                                    <li>✓ ${response.data.course.quizzes_count} kuis</li>
                                    <li>✓ Metadata kursus</li>
                                </ul>
                            </div>
                            <p class="text-muted small mb-0 mt-3">
                                Kursus Anda kembali ke status <strong>Published</strong> dan siap diakses siswa.
                            </p>
                        </div>
                    `,
                    icon: "success",
                    confirmButtonText: "OK",
                    confirmButtonColor: "#2196F3"
                });

                // ✨ PHASE 4.169: Don't refresh full course data to preserve published_version
                // The response already contains the restored course data merged above
                // No need for full fetch - this preserves buttons visibility
            } else {
                throw new Error(response.data.message || "Gagal mengembalikan kursus");
            }
        } catch (error) {
            console.error("Error restoring course:", error);
            
            await Swal.fire({
                title: "Gagal Mengembalikan Kursus",
                html: `
                    <div class="text-start">
                        <p class="mb-0">${error.response?.data?.message || error.message || "Gagal mengembalikan kursus"}</p>
                    </div>
                `,
                icon: "error",
                confirmButtonText: "OK"
            });
        } finally {
            setIsPublishing(false);
        }
    };

    // ✨ PHASE 4.76: Handle published course error - redirect to courses list
    useEffect(() => {
        if (error && error.type === "published_course") {
            console.log("[CourseEdit] Published course error detected, showing redirect modal");
            
            Swal.fire({
                title: "Kursus Sudah Dipublikasikan",
                html: `
                    <div class="text-start">
                        <p class="mb-3">Kursus ini telah dipublikasikan dan tidak dapat diedit secara langsung.</p>
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            <strong>Alasan:</strong>
                            <p class="mb-0 mt-2">Untuk melindungi kursus yang telah dipublikasikan, Anda perlu membuat versi draft terlebih dahulu. Versi draft memungkinkan Anda mengedit kursus tanpa mempengaruhi versi yang dipublikasikan.</p>
                        </div>
                        <div class="alert alert-warning mt-3">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Cara Mengedit Kursus Dipublikasikan:</strong>
                            <ol class="mt-2 mb-0 ps-3">
                                <li>Klik tombol <strong>"Edit Versi Terbaru"</strong> di halaman daftar kursus Anda</li>
                                <li>Sistem akan membuat versi draft baru untuk Anda</li>
                                <li>Edit kursus draft tanpa khawatir mempengaruhi versi yang dipublikasikan</li>
                                <li>Setelah selesai, ajukan untuk persetujuan publikasi ulang</li>
                            </ol>
                        </div>
                    </div>
                `,
                icon: "warning",
                confirmButtonText: "Kembali ke Daftar Kursus",
                confirmButtonColor: "#3085d6",
                width: 600,
                allowOutsideClick: false,
                allowEscapeKey: false
            }).then(() => {
                // Redirect to courses list where they can see the "Edit Versi Terbaru" button
                navigate("/instructor/courses/");
            });
        }
    }, [error, navigate]);

    // Show full-page loading spinner on initial load
    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-course-edit-page" style={{ minHeight: "calc(100vh - 120px)", display: "flex", alignItems: "center" }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Memuat Kursus...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    // ✨ PHASE 4.76: Don't render form if there's a published course error (redirect is happening)
    if (error && error.type === "published_course") {
        return (
            <>
                <BaseHeader />
                <section className="instructor-course-edit-page" style={{ minHeight: "calc(100vh - 120px)", display: "flex", alignItems: "center" }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                                <div className="text-center">
                                    <div className="spinner-border text-warning" role="status" style={{ width: "3rem", height: "3rem" }}>
                                        <span className="visually-hidden">Mengalihkan...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Mengalihkan Anda ke daftar kursus...</p>
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
            <section className="instructor-course-edit-page">
                <div className="container">
                    <Header />
                    <div className="row">
                        <Sidebar />                        
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Workflow Stepper */}
                            <WorkflowStepper 
                                currentStep={1} 
                                courseId={param?.course_id}
                                courseData={courseData}
                            />
                            
                            <div className="create-header-modern">
                                <div className="d-lg-flex align-items-center justify-content-between">
                                    <div className="mb-4 mb-lg-0">
                                        <h1 className="text-white mb-2 fw-bold">
                                            <i className="fas fa-edit me-2"></i>
                                            Edit Kursus
                                        </h1>
                                        <p className="mb-0 text-white opacity-90">
                                            Perbarui informasi dan konten kursus Anda untuk memberikan pengalaman belajar terbaik
                                        </p>
                                    </div>
                                    <div className="d-flex flex-column gap-3">
                                        <Link 
                                            to={`/instructor/edit-course/${param?.course_id}/curriculum/`} 
                                            className="btn btn-outline-light border border-2 border-light"
                                        >
                                            <i className="fas fa-list me-2"></i>
                                            Kelola Kurikulum
                                        </Link>
                                        <Link 
                                            to={`/instructor/edit-course/${param?.course_id}/quiz/`} 
                                            className="btn btn-outline-light border border-2 border-light"
                                        >
                                            <i className="fas fa-question-circle me-2"></i>
                                            Kelola Kuis
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleCourseSubmit} className="form-body-modern">
                                {/* Image Upload Section */}
                                    {/* Media Files Section */}
                                    <div className="form-section">
                                        <h5 className="section-title mb-3">
                                            <i className="fas fa-images me-2"></i>
                                            File Media
                                        </h5>
                                        
                                        <ImageUpload
                                            imagePreview={imagePreview}
                                            setImagePreview={setImagePreview}
                                            courseData={courseData}
                                            setCourseData={setCourseData}
                                            errors={errors}
                                            warnings={warnings}
                                            validateField={handleFieldValidation}
                                            imageRef={imageRef}
                                            onImageChange={() => {
                                                // ✨ PHASE 4.49: Mark form as dirty when image changes
                                                setIsDirty(true);
                                            }}
                                        />

                                        <VideoUpload
                                            courseData={courseData}
                                            setCourseData={setCourseData}
                                            onVideoChange={() => {
                                                // ✨ PHASE 4.49: Mark form as dirty when video changes
                                                setIsDirty(true);
                                            }}
                                            onVideoDelete={() => {
                                                // ✨ PHASE 4.167: Auto-save course after video deletion
                                                autoSaveCourse();
                                            }}
                                        />
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
                                                    value={courseData?.title || ""}
                                                    onChange={handleCourseInputChange}
                                                    errors={errors.title}
                                                    warnings={warnings.title}
                                                    getValidationClass={getFieldValidationClass}
                                                    required
                                                    placeholder="Masukkan judul kursus yang menarik..."
                                                    helpText="Buat judul yang dengan akurat menggambarkan kursus Anda dan menarik siswa"
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
                                                    value={courseData?.category?.id || courseData?.category || ""}
                                                    onChange={handleCourseInputChange}
                                                    errors={errors.category}
                                                    warnings={warnings.category}
                                                    getValidationClass={getFieldValidationClass}
                                                    options={[
                                                        { value: "", label: "Pilih kategori" },
                                                        ...(Array.isArray(categories) ? categories : []).map(cat => ({ value: cat.id, label: cat.title }))
                                                    ]}
                                                    required
                                                    helpText="Pilih kategori paling relevan untuk kursus Anda"
                                                />
                                            </div>

                                            <div className="col-md-6">
                                                <FormField
                                                    ref={levelRef}
                                                    label="Level Kursus"
                                                    name="level"
                                                    type="select"
                                                    value={courseData?.level || ""}
                                                    onChange={handleCourseInputChange}
                                                    errors={errors.level}
                                                    warnings={warnings.level}
                                                    getValidationClass={getFieldValidationClass}
                                                    options={[
                                                        { value: "", label: "Pilih level" },
                                                        ...COURSE_LEVELS
                                                    ]}
                                                    required
                                                    helpText="Tentukan tingkat kesulitan"
                                                />
                                            </div>
                                        </div>

                                        <div className="row">
                                            <div className="col-md-12">
                                                <div className="form-group mb-3">
                                                    <label htmlFor="tags-field" className="form-label">
                                                        Kursus Tag
                                                        <small className="text-muted ms-2">(Opsional)</small>
                                                    </label>
                                                    <select
                                                        id="tags-field"
                                                        name="tags"
                                                        multiple
                                                        className={`form-control form-select ${getFieldValidationClass('tags')}`}
                                                        value={Array.isArray(courseData?.tags) ? courseData.tags.map(tag => tag.id || tag) : []}
                                                        onChange={(e) => {
                                                            const selectedTagIds = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                                                            // Map tag IDs back to tag objects
                                                            const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id));
                                                            updateCourseData('tags', selectedTags);
                                                        }}
                                                        style={{ minHeight: '120px' }}
                                                    >
                                                        <option value="">-- Pilih tag kursus --</option>
                                                        {Array.isArray(tags) && tags.map(tag => (
                                                            <option key={tag.id} value={tag.id}>
                                                                {tag.title}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <small className="form-text text-muted d-block mt-2">
                                                        Tahan Ctrl (Windows) atau Cmd (Mac) untuk memilih multiple tags. Tag membantu siswa menemukan kursus dengan lebih mudah.
                                                    </small>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="row">
                                            <div className="col-md-6">
                                                <FormField
                                                    label="Status Kursus yang Diinginkan"
                                                    name="teacher_course_status"
                                                    type="select"
                                                    value={courseData?.teacher_course_status || "Draft"}
                                                    onChange={handleCourseInputChange}
                                                    options={COURSE_STATUS_OPTIONS}
                                                    helpText="Akan diterapkan setelah admin menyetujui kursus Anda"
                                                />
                                            </div>
                                            <div className="col-md-6">
                                                <div className="mb-3" style={{ marginTop: "32px" }}>
                                                    <label className="form-label">Status Persetujuan Saat Ini</label>
                                                    <div className="d-flex align-items-center">
                                                        <span className={`status-badge ${(courseData?.platform_status || "Draft").toLowerCase()}`}>
                                                            <i className={`fas ${
                                                                courseData?.platform_status === "Published" ? "fa-check-circle" :
                                                                courseData?.platform_status === "Review" ? "fa-hourglass-half" :
                                                                courseData?.platform_status === "Rejected" ? "fa-times-circle" :
                                                                courseData?.platform_status === "Disabled" ? "fa-times-circle" : "fa-clock"
                                                            } me-1`}></i>
                                                            {courseData?.platform_status === "Review" ? "Menunggu Persetujuan Admin" :
                                                             courseData?.platform_status === "Rejected" ? "Ditolak" :
                                                             courseData?.platform_status === "Published" ? "Disetujui" :
                                                             courseData?.platform_status === "Disabled" ? "Dinonaktifkan" : "Draf"}
                                                        </span>
                                                    </div>
                                                </div>
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
                                                label="Deskripsi Kursus"
                                                value={courseData?.description || ""}
                                                onChange={handleDescriptionChange}
                                                errors={errors.description}
                                                warnings={warnings.description}
                                                required
                                                placeholder="Deskripsikan apa yang akan dipelajari siswa di kursus ini..."
                                                helpText="Berikan ringkasan komprehensif tentang konten kursus Anda dan hasil pembelajaran"
                                            />
                                        </Suspense>
                                    </div>

                                    {/* ✨ PHASE 4.45: Course Features, Requirements, and Learning Outcomes */}
                                    {/* ✨ PHASE 4.47: Enable Perbarui Kursus button when nested forms update */}
                                    <CourseFeaturesForm 
                                        courseId={param?.course_id}
                                        onFeaturesUpdate={() => {
                                            // ✨ PHASE 4.48: Mark form as dirty to enable "Perbarui Kursus" button
                                            // Features are saved via API immediately, but we need to mark course as modified
                                            // When user clicks "Perbarui Kursus", the course will be validated and updated
                                            // This ensures the save button is visible when features are added/edited/deleted
                                            setIsDirty(true);
                                            // ✨ PHASE 4.56: Mark that related models were updated for status reset detection
                                            console.log('[CourseEdit] Feature updated - setting hasRelatedChanges to true');
                                            setHasRelatedChanges(true);
                                        }}
                                    />

                                    <CourseRequirementsForm 
                                        courseId={param?.course_id}
                                        onRequirementsUpdate={() => {
                                            // ✨ PHASE 4.48: Mark form as dirty to enable "Perbarui Kursus" button
                                            // Requirements are saved via API immediately, but we need to mark course as modified
                                            setIsDirty(true);
                                            // ✨ PHASE 4.56: Mark that related models were updated for status reset detection
                                            console.log('[CourseEdit] Requirement updated - setting hasRelatedChanges to true');
                                            setHasRelatedChanges(true);
                                        }}
                                    />

                                    <CourseLearningOutcomesForm 
                                        courseId={param?.course_id}
                                        onOutcomesUpdate={() => {
                                            // ✨ PHASE 4.48: Mark form as dirty to enable "Perbarui Kursus" button
                                            // Learning outcomes are saved via API immediately, but we need to mark course as modified
                                            setIsDirty(true);
                                            // ✨ PHASE 4.56: Mark that related models were updated for status reset detection
                                            console.log('[CourseEdit] Learning outcome updated - setting hasRelatedChanges to true');
                                            setHasRelatedChanges(true);
                                        }}
                                    />

                            {/* Enhanced Action Buttons Section */}
                            <div className="form-section">
                                {/* Validation Summary */}
                                {(validationSummary.errors.length > 0 || validationSummary.warnings.length > 0) && (
                                    <div className="validation-summary mb-4">
                                        {validationSummary.errors.length > 0 && (
                                            <div className="validation-errors">
                                                <div className="alert alert-danger border-0 shadow-sm">
                                                    <div className="d-flex align-items-start">
                                                        <i className="fas fa-exclamation-circle text-danger me-3 mt-1"></i>
                                                        <div className="flex-grow-1">
                                                            <h6 className="alert-heading mb-2 fw-bold">
                                                                {validationSummary.errors.length} Kesalahan{validationSummary.errors.length !== 1 ? "" : ""} Ditemukan
                                                            </h6>
                                                            <ul className="mb-0 ps-3">
                                                                {validationSummary.errors.map((errorGroup, index) => (
                                                                    <li key={index} className="mb-1">
                                                                        <strong className="text-capitalize">{errorGroup.field}:</strong> {errorGroup.messages.join(", ")}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {validationSummary.warnings.length > 0 && (
                                            <div className="validation-warnings">
                                                <div className="alert alert-warning border-0 shadow-sm">
                                                    <div className="d-flex align-items-start">
                                                        <i className="fas fa-exclamation-triangle text-warning me-3 mt-1"></i>
                                                        <div className="flex-grow-1">
                                                            <h6 className="alert-heading mb-2 fw-bold">
                                                                {validationSummary.warnings.length} Peringatan{validationSummary.warnings.length !== 1 ? "" : ""}
                                                            </h6>
                                                            <ul className="mb-0 ps-3">
                                                                {validationSummary.warnings.map((warningGroup, index) => (
                                                                    <li key={index} className="mb-1">
                                                                        <strong className="text-capitalize">{warningGroup.field}:</strong> {warningGroup.messages.join(", ")}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Submit Status Message */}
                                {submitMessage && (
                                    <div className={`submit-status-message mb-3 ${submitStatus}`}>
                                        <div className={`alert ${
                                            submitStatus === "success" ? "alert-success" : 
                                            submitStatus === "error" ? "alert-danger" : 
                                            "alert-info"
                                        } border-0 shadow-sm d-flex align-items-center`}>
                                            <div className="status-icon me-3">
                                                {submitStatus === "submitting" && (
                                                    <div className="spinner-border spinner-border-sm text-primary"></div>
                                                )}
                                                {submitStatus === "success" && (
                                                    <i className="fas fa-check-circle text-success fs-5"></i>
                                                )}
                                                {submitStatus === "error" && (
                                                    <i className="fas fa-times-circle text-danger fs-5"></i>
                                                )}
                                            </div>
                                            <div className="status-message">
                                                <div className="fw-semibold">{submitMessage}</div>
                                                {submitStatus === "submitting" && (
                                                    <small className="text-muted">Jangan tutup halaman ini...</small>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Enhanced Action Buttons */}
                                <div className="action-buttons d-flex flex-column flex-sm-row justify-content-between align-items-stretch align-items-sm-center gap-3">
                                    {/* ✨ PHASE 4.169: Preview Buttons Section (Left) - Always Visible */}
                                    <div className="preview-buttons d-flex flex-wrap gap-2 align-items-center">
                                        {/* Preview Draft Version Button - Always available */}
                                        <Link 
                                            to={`/instructor/preview-course/${param?.course_id}/`}
                                            target="_blank"
                                            className="btn btn-outline-primary"
                                            disabled={submitStatus === "submitting" || autoSaveStatus === "saving"}
                                            title="Lihat pratinjau kursus dalam format read-only"
                                        >
                                            <i className="fas fa-eye me-2"></i>
                                            Pratinjau Draf
                                        </Link>
                                        
                                        {/* Preview Published Version Button - Only if published_version exists or course was published */}
                                        {(courseData?.published_version || courseData?.platform_status === "Published" || courseData?.platform_status === "Review") && (
                                            <Link 
                                                to={`/instructor/preview-course/${courseData?.course_id}/?view=published`}
                                                target="_blank"
                                                className="btn btn-outline-success"
                                                disabled={submitStatus === "submitting" || autoSaveStatus === "saving"}
                                                title="Lihat pratinjau versi kursus yang telah dipublikasikan"
                                            >
                                                <i className="fas fa-eye me-2"></i>
                                                Pratinjau Publis
                                            </Link>
                                        )}
                                    </div>

                                    {/* ✨ PHASE 4.169: Status Info and Management Buttons (Right) */}
                                    <div className="form-status-and-actions d-flex flex-column flex-sm-row align-items-center gap-3">
                                        <div className="form-status-info">
                                            {/* ✨ PHASE 4.168: Auto-save status indicator */}
                                            {autoSaveStatus === "saving" && (
                                                <div className="text-info small">
                                                    <div className="spinner-border spinner-border-sm me-1" style={{ width: '14px', height: '14px', display: 'inline-block' }}></div>
                                                    Menyimpan perubahan otomatis...
                                                </div>
                                            )}
                                            {autoSaveStatus === "saved" && (
                                                <div className="text-success small">
                                                    <i className="fas fa-check-circle me-1"></i>
                                                    Perubahan tersimpan otomatis
                                                    {lastAutoSaveTime && (
                                                        <span className="ms-1 text-muted">
                                                            pada {lastAutoSaveTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {autoSaveStatus === "error" && (
                                                <div className="text-danger small">
                                                    <i className="fas fa-exclamation-circle me-1"></i>
                                                    Gagal menyimpan otomatis, akan dicoba lagi...
                                                </div>
                                            )}
                                            {autoSaveStatus === "idle" && !isDirty && (
                                                <div className="text-muted small">
                                                    <i className="fas fa-save me-1"></i>
                                                    Semua perubahan tersimpan
                                                </div>
                                            )}
                                        </div>

                                        {/* ✨ PHASE 4.169: Management buttons */}
                                        <div className="management-buttons d-flex flex-wrap gap-2">
                                            <Link 
                                                to={`/instructor/edit-course/${param?.course_id}/curriculum/`} 
                                                className="btn btn-update-course"
                                                style={{ background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)" }}
                                            >
                                                <i className="fas fa-list me-2"></i>
                                                Kelola Kurikulum
                                            </Link>
                                            <Link 
                                                to={`/instructor/edit-course/${param?.course_id}/quiz/`} 
                                                className="btn btn-update-course"
                                                style={{ background: "linear-gradient(135deg, #e67e22 0%, #d35400 100%)" }}
                                            >
                                                <i className="fas fa-question-circle me-2"></i>
                                                Kelola Kuis
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* ✨ PHASE 4.36: Status display and submit for review button */}
                                
                                {/* Show rejection reason if course was rejected */}
                                {courseData?.platform_status === "Rejected" && courseData?.rejection_reason && (
                                    <div className="alert alert-danger mt-3" style={{ marginBottom: "0" }}>
                                        <div className="d-flex align-items-start">
                                            <i className="fas fa-times-circle text-danger me-3 mt-1 fs-5"></i>
                                            <div className="flex-grow-1">
                                                <h6 className="alert-heading mb-2 fw-bold">
                                                    <i className="fas fa-exclamation-circle me-2"></i>
                                                    Kursus Ditolak - Silakan Perbaiki
                                                </h6>
                                                <p className="mb-0">
                                                    <strong>Alasan dari Admin:</strong>
                                                </p>
                                                <p className="mb-0 ps-3 border-left mt-2" style={{ borderLeft: "3px solid #dc3545", paddingLeft: "15px" }}>
                                                    {courseData.rejection_reason}
                                                </p>
                                                <p className="text-muted small mt-2 mb-0">
                                                    Silakan perbaiki masalah yang disebutkan di atas dan ajukan kembali untuk review.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Show pending review status */}
                                {courseData?.platform_status === "Review" && (
                                    <div className="alert alert-info mt-3" style={{ marginBottom: "0" }}>
                                        <div className="d-flex align-items-center">
                                            <i className="fas fa-hourglass-half text-info me-3"></i>
                                            <div className="flex-grow-1">
                                                <h6 className="alert-heading mb-1 fw-bold">Menunggu Persetujuan Admin</h6>
                                                <small className="text-muted">Kursus Anda sedang dalam proses review. Anda akan menerima notifikasi saat admin selesai meninjau.</small>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Show published status */}
                                {courseData?.platform_status === "Published" && (
                                    <div className="alert alert-success mt-3" style={{ marginBottom: "0" }}>
                                        <div className="d-flex align-items-center">
                                            <i className="fas fa-check-circle text-success me-3"></i>
                                            <div className="flex-grow-1">
                                                <h6 className="alert-heading mb-1 fw-bold">✓ Kursus Dipublikasikan</h6>
                                                <small className="text-muted">Kursus Anda telah disetujui dan sekarang tersedia untuk siswa di platform.</small>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ✨ PHASE 4.71 UPDATED: Buttons aligned horizontally when published_version exists */}
                                {/* ✨ PHASE 11.169a: Don't show buttons if course is in Review status (waiting for admin) */}
                                {courseData?.published_version && courseData?.platform_status !== "Review" ? (
                                    // Show both buttons in a horizontal line for published courses
                                    <div className="d-flex justify-content-center gap-3 mt-3 w-100 flex-wrap">
                                        {/* Restore Button */}
                                        <div className="position-relative d-flex flex-column align-items-center">
                                            <button 
                                                type="button"
                                                className="btn btn-warning"
                                                onClick={handleRestoreCourse}
                                                disabled={submitStatus === "submitting"}
                                                style={{
                                                    background: "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
                                                    color: "white",
                                                    border: "none",
                                                    padding: "12px 30px",
                                                    borderRadius: "8px",
                                                    fontWeight: "600",
                                                    fontSize: "1rem",
                                                    boxShadow: "0 4px 15px rgba(243, 156, 18, 0.3)",
                                                    transition: "all 0.3s ease",
                                                    cursor: submitStatus === "submitting" ? "not-allowed" : "pointer",
                                                    opacity: submitStatus === "submitting" ? 0.6 : 1,
                                                    whiteSpace: "nowrap"
                                                }}
                                                onMouseOver={(e) => {
                                                    if (submitStatus !== "submitting") {
                                                        e.currentTarget.style.transform = "translateY(-2px)";
                                                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(243, 156, 18, 0.4)";
                                                    }
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.transform = "translateY(0)";
                                                    e.currentTarget.style.boxShadow = "0 4px 15px rgba(243, 156, 18, 0.3)";
                                                }}
                                                title="Kembalikan kursus ke versi yang terakhir dipublikasikan"
                                            >
                                                {submitStatus === "submitting" ? (
                                                    <>
                                                        <div className="spinner-border spinner-border-sm me-2"></div>
                                                        <span>Mengembalikan...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-undo me-2"></i>
                                                        <span>Restore Kursus</span>
                                                    </>
                                                )}
                                            </button>
                                            {isDirty && (
                                                <small className="text-muted d-block mt-2" style={{ fontSize: "0.75rem" }}>
                                                    <i className="fas fa-info-circle me-1"></i>
                                                    Anda memiliki perubahan yang belum disimpan
                                                </small>
                                            )}
                                        </div>

                                        {/* Submit/Republication Button */}
                                        <div className="position-relative d-flex flex-column align-items-center">
                                            <button 
                                                type="button"
                                                className="btn btn-publish-course"
                                                onClick={handlePublishCourse}
                                                disabled={isPublishing || submitStatus === "submitting" || !canPublish}
                                                style={{
                                                    background: canPublish 
                                                        ? "linear-gradient(135deg, #2196F3 0%, #1976D2 100%)" 
                                                        : "linear-gradient(135deg, #9e9e9e 0%, #757575 100%)",
                                                    color: "white",
                                                    border: "none",
                                                    padding: "12px 30px",
                                                    borderRadius: "8px",
                                                    fontWeight: "600",
                                                    fontSize: "1rem",
                                                    boxShadow: canPublish 
                                                        ? "0 4px 15px rgba(33, 150, 243, 0.3)" 
                                                        : "0 2px 8px rgba(0, 0, 0, 0.1)",
                                                    transition: "all 0.3s ease",
                                                    cursor: canPublish ? "pointer" : "not-allowed",
                                                    opacity: canPublish ? 1 : 0.6,
                                                    whiteSpace: "nowrap"
                                                }}
                                                onMouseOver={(e) => {
                                                    if (canPublish && !isPublishing && submitStatus !== "submitting") {
                                                        e.currentTarget.style.transform = "translateY(-2px)";
                                                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(33, 150, 243, 0.4)";
                                                    }
                                                }}
                                                onMouseOut={(e) => {
                                                    if (canPublish) {
                                                        e.currentTarget.style.transform = "translateY(0)";
                                                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(33, 150, 243, 0.3)";
                                                    }
                                                }}
                                                title={!canPublish ? (
                                                    courseData?.teacher_course_status !== "Published" 
                                                        ? "Pilih 'Dipublikasikan' sebagai status yang diinginkan untuk mengajukan publikasi" 
                                                        : "Tambahkan kurikulum, pelajaran, dan kuis sebelum mengajukan"
                                                ) : "Ajukan kursus Anda untuk persetujuan publikasi"}
                                            >
                                                {isPublishing ? (
                                                    <>
                                                        <div className="spinner-border spinner-border-sm me-2"></div>
                                                        <span>Mengajukan...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className={`fas ${canPublish ? "fa-paper-plane" : "fa-lock"} me-2`}></i>
                                                        <span>
                                                            {courseData?.platform_status === "Rejected" ? "Ajukan Ulang Publikasi Kursus" : courseData?.platform_status === "Published" ? "Ajukan Review Publikasi" : "Ajukan Publikasi Kursus"}
                                                        </span>
                                                    </>
                                                )}
                                            </button>
                                            {!canPublish && (
                                                <small className="text-muted d-block mt-2" style={{ fontSize: "0.85rem", maxWidth: "400px", color: "#ff9800", fontWeight: "500" }}>
                                                    <i className="fas fa-exclamation-triangle me-1"></i>
                                                    {courseData?.teacher_course_status !== "Published" 
                                                        ? "Pilih 'Dipublikasikan' pada dropdown 'Status Kursus yang Diinginkan' di atas untuk melanjutkan"
                                                        : "Tambahkan kurikulum, pelajaran & kuis terlebih dahulu"}
                                                </small>
                                            )}
                                        </div>
                                    </div>
                                ) : (courseData?.platform_status === "Draft" || courseData?.platform_status === "Rejected") && (
                                    // ✨ PHASE 11.169a: Show only submit button for Draft and Rejected courses (not Review/in-progress)
                                    <div className="d-flex justify-content-center mt-3 w-100">
                                        <div className="position-relative d-flex flex-column align-items-center">
                                            <button 
                                                type="button"
                                                className="btn btn-publish-course"
                                                onClick={handlePublishCourse}
                                                disabled={isPublishing || submitStatus === "submitting" || !canPublish}
                                                style={{
                                                    background: canPublish 
                                                        ? "linear-gradient(135deg, #2196F3 0%, #1976D2 100%)" 
                                                        : "linear-gradient(135deg, #9e9e9e 0%, #757575 100%)",
                                                    color: "white",
                                                    border: "none",
                                                    padding: "12px 30px",
                                                    borderRadius: "8px",
                                                    fontWeight: "600",
                                                    fontSize: "1rem",
                                                    boxShadow: canPublish 
                                                        ? "0 4px 15px rgba(33, 150, 243, 0.3)" 
                                                        : "0 2px 8px rgba(0, 0, 0, 0.1)",
                                                    transition: "all 0.3s ease",
                                                    cursor: canPublish ? "pointer" : "not-allowed",
                                                    opacity: canPublish ? 1 : 0.6
                                                }}
                                                onMouseOver={(e) => {
                                                    if (canPublish && !isPublishing && submitStatus !== "submitting") {
                                                        e.currentTarget.style.transform = "translateY(-2px)";
                                                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(33, 150, 243, 0.4)";
                                                    }
                                                }}
                                                onMouseOut={(e) => {
                                                    if (canPublish) {
                                                        e.currentTarget.style.transform = "translateY(0)";
                                                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(33, 150, 243, 0.3)";
                                                    }
                                                }}
                                                title={!canPublish ? (
                                                    courseData?.teacher_course_status !== "Published" 
                                                        ? "Pilih 'Dipublikasikan' sebagai status yang diinginkan untuk mengajukan publikasi" 
                                                        : "Tambahkan kurikulum, pelajaran, dan kuis sebelum mengajukan"
                                                ) : "Ajukan kursus Anda untuk persetujuan publikasi"}
                                            >
                                                {isPublishing ? (
                                                    <>
                                                        <div className="spinner-border spinner-border-sm me-2"></div>
                                                        <span>Mengajukan...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className={`fas ${canPublish ? "fa-paper-plane" : "fa-lock"} me-2`}></i>
                                                        <span>
                                                            {courseData?.platform_status === "Rejected" ? "Ajukan Ulang Publikasi" : courseData?.platform_status === "Published" ? "Ajukan Review Publikasi" : "Ajukan Publikasi"}
                                                        </span>
                                                    </>
                                                )}
                                            </button>
                                            {!canPublish && (
                                                <small className="text-muted d-block mt-2" style={{ fontSize: "0.85rem", maxWidth: "400px", color: "#ff9800", fontWeight: "500" }}>
                                                    <i className="fas fa-exclamation-triangle me-1"></i>
                                                    {courseData?.teacher_course_status !== "Published" 
                                                        ? "Pilih 'Dipublikasikan' pada dropdown 'Status Kursus yang Diinginkan' di atas untuk melanjutkan"
                                                        : "Tambahkan kurikulum, pelajaran & kuis terlebih dahulu"}
                                                </small>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Helper Text */}
                                <div className="form-helper-text text-center mt-3">
                                    <small className="text-muted">
                                        <i className="fas fa-info-circle me-1"></i>
                                        Perubahan secara otomatis divalidasi. Perbaiki kesalahan apa pun sebelum memperbarui kursus Anda.
                                    </small>
                                </div>
                            </div>
                            </form>

                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </>
    );
}

export default React.memo(CourseEdit);