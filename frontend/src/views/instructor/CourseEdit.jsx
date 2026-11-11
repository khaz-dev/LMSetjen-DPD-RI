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
import TagSelector from "./components/TagSelector";  // ✨ PHASE X.2: Searchable tag selector

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
    COURSE_AUDIENCE_OPTIONS,
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

    // ✨ Log courseData changes after auto-save completes
    useEffect(() => {
        console.log("[CourseEdit.courseDataMonitor] Current courseData state updated:", {
            id: courseData?.id,
            has_published_version: !!courseData?.published_version,
            platform_status: courseData?.platform_status,
            tags: courseData?.tags?.map(t => ({ id: t?.id, title: t?.title })),
            isDirty,
            autoSaveStatus
        });
    }, [courseData, isDirty, autoSaveStatus]);

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

    // ✨ PHASE 41: Track form changes for dirty state using useEffect instead of setTimeout
    // This fixes the stale closure bug where courseData wasn't updated in time
    // ✨ PHASE X.2.2: FIX - Improved comparison to handle tags properly
    // Tags are objects with different references even if they have same IDs, so JSON.stringify fails
    useEffect(() => {
        if (!initialCourseData) {
            return;
        }

        // ✨ PHASE X.2.2: Smart comparison for complex fields like tags
        // Normalize tags arrays to IDs for comparison to avoid false positives from object references
        const normalizeData = (data) => {
            if (!data) return data;
            const normalized = { ...data };

            // If tags exist, convert to IDs array for comparison
            if (normalized.tags && Array.isArray(normalized.tags)) {
                normalized.tags = normalized.tags
                    .map(tag => tag?.id || tag)
                    .sort((a, b) => a - b);  // Sort for consistent comparison
            }

            return normalized;
        };

        const normalizedCurrent = normalizeData(courseData);
        const normalizedInitial = normalizeData(initialCourseData);

        // Compare using normalized data
        const hasRealChanges = JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedInitial);

        console.log("[CourseEdit.isDirty] Checking dirty state:", {
            hasRealChanges,
            currentTags: courseData?.tags?.map(t => t?.id || t),
            initialTags: initialCourseData?.tags?.map(t => t?.id || t)
        });

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
            console.log("[CourseEdit.debouncedAutoSave] Skipping auto-save:", { isDirty, submitting: submitStatus === "submitting", hasId: !!courseData?.id, hasInitial: !!initialCourseData });
            return;
        }

        try {
            console.log("[CourseEdit.debouncedAutoSave] 🚀 Auto-saving course...");
            console.log("[CourseEdit.debouncedAutoSave] Tags being saved:", courseData?.tags?.map(t => ({ id: t?.id, title: t?.title })));
            setAutoSaveStatus("saving");

            // Use existing submit logic but silently
            await submitCourse(
                courseData,
                param?.course_id,
                (data) => {
                    // Success
                    console.log("[CourseEdit.debouncedAutoSave] ✅ Auto-save successful");
                    console.log("[CourseEdit.debouncedAutoSave] Response tags:", data?.tags?.map(t => ({ id: t?.id, title: t?.title })));
                    setCourseData(data);
                    setInitialCourseData(JSON.parse(JSON.stringify(data)));
                    setIsDirty(false);
                    setAutoSaveStatus("saved");
                    setLastAutoSaveTime(new Date());
                    // ✨ Timestamp status tetap dipertahankan
                }
            );
        } catch (error) {
            console.error("[CourseEdit.debouncedAutoSave] ❌ Error:", error);
            setAutoSaveStatus("error");
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

        // ✨ PHASE 41: Dirty tracking now happens automatically in useEffect above
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

        // ✨ PHASE 41: Dirty tracking now happens automatically in useEffect

        if (submitStatus === "error") {
            setSubmitStatus("idle");
            setSubmitMessage("");
        }
    };

    // Enhanced form submission with comprehensive error handling
    const handleCourseSubmit = async (event) => {
        event.preventDefault();

        // 🎯 PHASE 47: Debug log - Check current state when form is submitted
        console.log("[CourseEdit.handleCourseSubmit] Form submitted");
        console.log("[CourseEdit.handleCourseSubmit] Current isDirty state:", isDirty);
        console.log("[CourseEdit.handleCourseSubmit] Current hasRelatedChanges state:", hasRelatedChanges);
        console.log("[CourseEdit.handleCourseSubmit] Current courseData:", courseData);

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

                const fieldRefMap = {
                    title: titleRef,
                    category: categoryRef,
                    image: imageRef,
                    level: levelRef
                };
                const targetRef = firstErrorField ? fieldRefMap[firstErrorField] : null;

                if (targetRef?.current) {
                    targetRef.current.focus();
                    targetRef.current.scrollIntoView({
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

            console.log("[CourseEdit] Submitting course with hasRelatedChanges:", hasRelatedChanges);
            await submitCourse(
                courseData,
                param?.course_id,
                (data) => {
                    // Enhanced success callback
                    console.log("[CourseEdit] Success callback - resetting hasRelatedChanges");
                    setSubmitStatus("success");
                    setSubmitMessage("Kursus berhasil diperbarui!");
                    setIsDirty(false);
                    setHasRelatedChanges(false); // ✨ PHASE 46: Reset flag after successful submission

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
                            text: "Kursus Anda yang telah dipublikasikan telah kembali ke status 'Menunggu Review dari Admin' karena ada perubahan. Admin akan meninjau kembali sebelum kursus tersedia untuk peserta.",
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
                hasRelatedChanges  // ✨ PHASE 46: Pass flag indicating features/requirements/outcomes were updated
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
            console.log("[CourseEdit] Auto-saving course after video deletion...");
            setSubmitMessage("Menyimpan pembaruan kursus...");

            await submitCourse(
                courseData,
                param?.course_id,
                (data) => {
                    console.log("[CourseEdit] Auto-save successful");
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
            console.error("[CourseEdit] Error in auto-save:", error);
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
                title: "Persyaratan Minimum Belum Terpenuhi",
                html: `
                    <div class="text-start">
                        <p class="mb-2">Kursus <strong>"${courseData?.title}"</strong> belum memenuhi syarat minimum untuk penerbitan:</p>
                        <div class="alert alert-danger mb-2">
                            <i class="fas fa-exclamation-circle me-1"></i>
                            <strong>Persyaratan yang Belum Lengkap:</strong>
                            <ul class="mt-1 mb-0 small ps-3">
                                ${curriculumCount === 0 ? '<li>Belum ada bagian kurikulum yang dibuat</li>' : ""}
                                ${lecturesCount === 0 ? '<li>Belum ada pelajaran yang diunggah</li>' : ""}
                                ${quizzesCount === 0 ? '<li>Belum ada kuis yang ditambahkan</li>' : ""}
                            </ul>
                        </div>
                        <div class="alert alert-info mb-0">
                            <i class="fas fa-info-circle me-1"></i>
                            <strong>Langkah Selanjutnya:</strong>
                            <ol class="mt-1 mb-0 small ps-3">
                                ${curriculumCount === 0 ? '<li>Buka "Kelola Kurikulum" untuk membuat bagian kursus</li>' : ""}
                                ${lecturesCount === 0 ? "<li>Unggah pelajaran ke dalam kurikulum</li>" : ""}
                                ${quizzesCount === 0 ? '<li>Buka "Kelola Kuis" untuk menambahkan evaluasi kuis</li>' : ""}
                            </ol>
                        </div>
                    </div>
                `,
                icon: "warning",
                confirmButtonText: '<i class="fas fa-check me-1"></i> Mengerti',
                confirmButtonColor: "#0d9488"
            });
            return;
        }

        // ✨ PHASE 4.36: Updated workflow - submit for publication approval
        // ✨ PHASE 4.71: Enhanced for republication of published courses
        const isRepublication = courseData?.platform_status === "Published";
        const result = await Swal.fire({
            title: isRepublication ? "Ajukan Perubahan Kursus?" : "Ajukan Publikasi Kursus?",
            html: `
                <div class="text-start">
                    ${isRepublication ? `
                        <p class="mb-2">Ajukan perubahan terbaru pada <strong>"${courseData?.title}"</strong> untuk diverifikasi admin?</p>
                        <div class="alert alert-success mb-2">
                            <i class="fas fa-info-circle me-1"></i>
                            <strong>Ringkasan Update:</strong>
                            <ul class="mt-1 mb-0 small ps-3">
                                <li>Perubahan materi akan ditinjau oleh admin</li>
                                <li>Kursus tetap aktif & dapat diakses peserta selama review</li>
                                <li>Pembaruan langsung aktif setelah disetujui</li>
                            </ul>
                        </div>
                    ` : `
                        <p class="mb-2">Ajukan <strong>"${courseData?.title}"</strong> untuk persetujuan publikasi oleh admin?</p>
                        <div class="alert alert-info mb-2">
                            <i class="fas fa-info-circle me-1"></i>
                            <strong>Alur Verifikasi:</strong>
                            <ul class="mt-1 mb-0 small ps-3">
                                <li>Admin meninjau kesiapan kurikulum & kualitas materi</li>
                                <li>Kursus akan otomatis tayang setelah disetujui</li>
                                <li>Jika ada catatan revisi, Anda akan menerima feedback</li>
                            </ul>
                        </div>
                    `}
                    <div class="alert alert-warning mb-0">
                        <i class="fas fa-exclamation-triangle me-1"></i>
                        <strong>Catatan:</strong>
                        <p class="mb-0 mt-1 small">Pastikan kurikulum dan pelajaran sudah lengkap untuk mempercepat proses persetujuan.</p>
                    </div>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0d9488",
            cancelButtonColor: "#64748b",
            confirmButtonText: isRepublication ? '<i class="fas fa-paper-plane me-1"></i> Ya, Ajukan Perubahan' : '<i class="fas fa-paper-plane me-1"></i> Ya, Ajukan Publikasi',
            cancelButtonText: '<i class="fas fa-times me-1"></i> Batal',
            reverseButtons: true,
            focusCancel: true
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
                                            <li>✓ Kursus tetap dapat diakses peserta selama proses review</li>
                                            <li>⏳ Menunggu persetujuan publikasi dari admin</li>
                                        </ul>
                                    </div>
                                    <div class="alert alert-info mt-2">
                                        <i class="fas fa-info-circle me-2"></i>
                                        <strong>Apa yang terjadi selanjutnya?</strong>
                                        <ol class="mt-2 mb-0 small" style="padding-left: 1rem;">
                                            <li>Admin akan meninjau perubahan konten kursus Anda</li>
                                            <li>Anda akan menerima notifikasi tentang persetujuan atau permintaan revisi</li>
                                            <li>Jika disetujui, perubahan akan langsung diterapkan untuk semua peserta</li>
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
                                        <ol class="mt-2 mb-0 small" style="padding-left: 1rem;">
                                            <li>Admin akan meninjau konten dan kualitas kursus Anda</li>
                                            <li>Anda akan menerima notifikasi saat keputusan dibuat</li>
                                            <li>Jika disetujui, kursus akan langsung dipublikasikan dan tersedia untuk peserta</li>
                                            <li>Jika perlu perbaikan, kami akan memberikan feedback spesifik</li>
                                        </ol>
                                    </div>
                                `}
                            </div>
                        `,
                        icon: "success",
                        confirmButtonText: "OK",
                        confirmButtonColor: "#0f766e"
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
            title: "Kembalikan ke Versi Terpublikasi?",
            html: `
                <div class="text-start">
                    <p class="mb-2">Kembalikan <strong>"${courseData?.title}"</strong> ke versi publikasi terakhir?</p>
                    <div class="alert alert-warning mb-0">
                        <i class="fas fa-exclamation-triangle me-1"></i>
                        <strong>Peringatan Penting:</strong>
                        <p class="mb-1 mt-1 small">Semua perubahan draft sejak publikasi terakhir akan dibatalkan permanen, meliputi:</p>
                        <ul class="mb-0 small ps-3">
                            <li>Draft bagian kurikulum dan pelajaran baru</li>
                            <li>Perubahan kuis dan materi evaluasi</li>
                            <li>Perubahan metadata atau info kursus</li>
                        </ul>
                    </div>
                </div>
            `,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#f43f5e",
            cancelButtonColor: "#64748b",
            confirmButtonText: '<i class="fas fa-undo me-1"></i> Ya, Kembalikan',
            cancelButtonText: '<i class="fas fa-times me-1"></i> Batal',
            reverseButtons: true,
            focusCancel: true
        });

        if (!result.isConfirmed) {
            return;
        }

        setIsPublishing(true);
        try {
            const response = await useAxios.post(`teacher/course-restore/${param?.course_id}/`);

            if (response.data.success) {
                // Update local course data with restored content
                console.log("[CourseEdit.handleRestoreCourse] 📥 API Response received:", {
                    success: response.data.success,
                    restored_tags: response.data.course?.tags,
                    restored_title: response.data.course?.title,
                    restored_category: response.data.course?.category
                });

                setCourseData({
                    ...courseData,
                    ...response.data.course,
                    platform_status: response.data.course.platform_status || "Published"
                });

                console.log("[CourseEdit.handleRestoreCourse] ✅ Course data updated with restored content including tags");

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
                                Kursus Anda kembali ke status <strong>Published</strong> dan siap diakses peserta.
                            </p>
                        </div>
                    `,
                    icon: "success",
                    confirmButtonText: "OK",
                    confirmButtonColor: "#0f766e"
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

                            {/* 1. Header Card (Compact & Modern) */}
                            <div className="course-edit-header-card mb-2">
                                <div className="d-flex align-items-center justify-content-between flex-nowrap gap-3">
                                    <div className="flex-grow-1 min-w-0" style={{ minWidth: 0 }}>
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <span className={`badge ${courseData?.platform_status === "Published" ? "bg-emerald-subtle text-emerald" :
                                                    courseData?.platform_status === "Review" ? "bg-teal-subtle text-teal" :
                                                        courseData?.platform_status === "Rejected" ? "bg-danger-subtle text-danger" :
                                                            "bg-amber-subtle text-amber"
                                                } fw-semibold px-2 py-0`} style={{ fontSize: "11px" }}>
                                                <i className={`fas ${courseData?.platform_status === "Published" ? "fa-check-circle" :
                                                        courseData?.platform_status === "Review" ? "fa-hourglass-half" :
                                                            courseData?.platform_status === "Rejected" ? "fa-times-circle" : "fa-pen-nib"
                                                    } me-1`}></i>
                                                {courseData?.platform_status === "Published" ? "Dipublikasikan" :
                                                    courseData?.platform_status === "Review" ? "Menunggu Review" :
                                                        courseData?.platform_status === "Rejected" ? "Ditolak" : "Mode Draf"}
                                            </span>
                                            <span className="text-muted small">
                                                ID: #{courseData?.id || param?.course_id}
                                            </span>
                                        </div>
                                        <h2 className="header-title mb-0 text-truncate" title={courseData?.title}>
                                            <i className="fas fa-edit text-teal me-2 flex-shrink-0"></i>
                                            <span className="text-truncate">
                                                Edit Kursus{courseData?.title ? `: ${courseData.title}` : ""}
                                            </span>
                                        </h2>
                                        <p className="header-subtitle mb-0 text-truncate">
                                            Perbarui informasi dasar, media pengantar, silabus, dan kuis kursus
                                        </p>
                                    </div>

                                    <div className="d-flex align-items-center gap-2 flex-nowrap flex-shrink-0 ms-auto">
                                        <Link
                                            to="/instructor/courses/"
                                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2 text-nowrap"
                                            title="Kembali ke Daftar Kursus"
                                        >
                                            <i className="fas fa-arrow-left"></i>
                                            <span>Kembali</span>
                                        </Link>

                                        <Link
                                            to={`/instructor/edit-course/${param?.course_id}/curriculum/`}
                                            className="btn btn-sm btn-outline-teal d-inline-flex align-items-center gap-2 text-nowrap"
                                            title="Kelola Kurikulum & Materi"
                                        >
                                            <i className="fas fa-list"></i>
                                            <span>Kurikulum</span>
                                        </Link>

                                        <Link
                                            to={`/instructor/edit-course/${param?.course_id}/quiz/`}
                                            className="btn btn-sm btn-outline-teal d-inline-flex align-items-center gap-2 text-nowrap"
                                            title="Kelola Kuis Kursus"
                                        >
                                            <i className="fas fa-question-circle"></i>
                                            <span>Kuis</span>
                                        </Link>

                                        <Link
                                            to={`/instructor/edit-course/${param?.course_id}/gamification/`}
                                            className="btn btn-sm btn-outline-teal d-inline-flex align-items-center gap-2 text-nowrap"
                                            title="Kelola Gamifikasi Kursus"
                                        >
                                            <i className="fas fa-gamepad"></i>
                                            <span>Gamifikasi</span>
                                        </Link>

                                        <Link
                                            to={`/instructor/edit-course/${param?.course_id}/certificate/`}
                                            className="btn btn-sm btn-outline-teal d-inline-flex align-items-center gap-2 text-nowrap"
                                            title="Kelola Desain Sertifikat Kursus"
                                        >
                                            <i className="fas fa-certificate"></i>
                                            <span>Sertifikat</span>
                                        </Link>

                                        <Link
                                            to={`/instructor/preview-course/${param?.course_id}/`}
                                            target="_blank"
                                            className="btn btn-sm btn-teal d-inline-flex align-items-center gap-2 text-nowrap"
                                            title="Pratinjau Kursus"
                                        >
                                            <i className="fas fa-eye"></i>
                                            <span>Pratinjau</span>
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
                                                helpText="Buat judul yang dengan akurat menggambarkan kursus Anda dan menarik peserta"
                                            />
                                        </div>
                                    </div>

                                    <div className="row">
                                        <div className="col-md-4">
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

                                        <div className="col-md-4">
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

                                        <div className="col-md-4">
                                            <FormField
                                                label="Target Peserta & Akses"
                                                name="target_audience"
                                                type="select"
                                                value={courseData?.target_audience || "pegawai"}
                                                onChange={handleCourseInputChange}
                                                options={COURSE_AUDIENCE_OPTIONS}
                                                required
                                                helpText="Khusus pegawai DPD RI atau umum"
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
                                                {/* ✨ PHASE X.2: NEW - Searchable tag selector with visual improvements */}
                                                <TagSelector
                                                    tags={Array.isArray(tags) ? tags : []}
                                                    selectedTags={Array.isArray(courseData?.tags) ? courseData.tags : []}
                                                    onChange={(selectedTags) => {
                                                        // ✨ PHASE X.1 FIX: Use correct syntax with object
                                                        console.log("[CourseEdit.TagSelector] onChange called with tags:", selectedTags?.map(t => ({ id: t.id, title: t.title })));
                                                        updateCourseData({ tags: selectedTags });
                                                        console.log("[CourseEdit.TagSelector] After updateCourseData, isDirty should trigger");
                                                    }}
                                                    placeholder="Cari atau pilih tag kursus..."
                                                    helpText="Tag membantu peserta menemukan kursus dengan lebih mudah. Pilih 1 atau lebih tag yang relevan dengan konten kursus."
                                                />
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
                                                        <i className={`fas ${courseData?.platform_status === "Published" ? "fa-check-circle" :
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
                                            placeholder="Deskripsikan apa yang akan dipelajari peserta di kursus ini..."
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
                                        // ✨ PHASE 46: Mark that related models were updated for status reset detection
                                        console.log("[CourseEdit] Feature updated - setting hasRelatedChanges to true");
                                        setHasRelatedChanges(true);
                                    }}
                                />

                                <CourseRequirementsForm
                                    courseId={param?.course_id}
                                    onRequirementsUpdate={() => {
                                        // ✨ PHASE 4.48: Mark form as dirty to enable "Perbarui Kursus" button
                                        // Requirements are saved via API immediately, but we need to mark course as modified
                                        setIsDirty(true);
                                        // ✨ PHASE 46: Mark that related models were updated for status reset detection
                                        console.log("[CourseEdit] Requirement updated - setting hasRelatedChanges to true");
                                        setHasRelatedChanges(true);
                                    }}
                                />

                                <CourseLearningOutcomesForm
                                    courseId={param?.course_id}
                                    onOutcomesUpdate={() => {
                                        // ✨ PHASE 4.48: Mark form as dirty to enable "Perbarui Kursus" button
                                        // Learning outcomes are saved via API immediately, but we need to mark course as modified
                                        setIsDirty(true);
                                        // ✨ PHASE 46: Mark that related models were updated for status reset detection
                                        console.log("[CourseEdit] Learning outcome updated - setting hasRelatedChanges to true");
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
                                            <div className={`alert ${submitStatus === "success" ? "alert-success" :
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
                                        {/* ✨ PHASE 4.169: Preview Buttons Section & Auto-save Status (Left) - Always Visible & In Line */}
                                        <div className="preview-buttons d-flex flex-wrap gap-2 align-items-center">
                                            {/* Preview Draft Version Button - Always available */}
                                            <Link
                                                to={`/instructor/preview-course/${param?.course_id}/`}
                                                target="_blank"
                                                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-2"
                                                disabled={submitStatus === "submitting" || autoSaveStatus === "saving"}
                                                title="Lihat pratinjau kursus dalam format read-only"
                                            >
                                                <i className="fas fa-eye"></i>
                                                <span>Pratinjau Draf</span>
                                            </Link>

                                            {/* Preview Published Version Button - Only if published_version exists or course was published */}
                                            {(courseData?.published_version || courseData?.platform_status === "Published" || courseData?.platform_status === "Review") && (
                                                <Link
                                                    to={`/instructor/preview-course/${courseData?.course_id}/?view=published`}
                                                    target="_blank"
                                                    className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-2"
                                                    disabled={submitStatus === "submitting" || autoSaveStatus === "saving"}
                                                    title="Lihat pratinjau versi kursus yang telah dipublikasikan"
                                                >
                                                    <i className="fas fa-eye"></i>
                                                    <span>Pratinjau Publis</span>
                                                </Link>
                                            )}

                                            {/* Auto-save status indicator */}
                                            <div className="form-status-info ms-sm-2">
                                                {autoSaveStatus === "saving" ? (
                                                    <div className="text-info small d-flex align-items-center">
                                                        <span className="spinner-border spinner-border-sm me-1" style={{ width: "13px", height: "13px", display: "inline-block" }}></span>
                                                        <span>Menyimpan perubahan otomatis...</span>
                                                    </div>
                                                ) : isDirty ? (
                                                    <div className="text-secondary small d-flex align-items-center">
                                                        <span className="spinner-border spinner-border-sm text-warning me-1" style={{ width: "13px", height: "13px", display: "inline-block" }}></span>
                                                        <span>Menyimpan perubahan...</span>
                                                    </div>
                                                ) : autoSaveStatus === "error" ? (
                                                    <div className="text-danger small d-flex align-items-center">
                                                        <i className="fas fa-exclamation-circle text-danger me-1"></i>
                                                        <span>Gagal menyimpan otomatis, akan dicoba lagi...</span>
                                                    </div>
                                                ) : lastAutoSaveTime ? (
                                                    <div className="text-muted small d-flex align-items-center">
                                                        <i className="fas fa-check-circle text-success me-1 gap-2"></i>
                                                        <span>
                                                            Perubahan tersimpan pada {lastAutoSaveTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/:/g, ".")}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="text-muted small d-flex align-items-center gap-2">
                                                        <i className="fas fa-check-circle text-success me-1"></i>
                                                        <span>Semua perubahan tersimpan</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* ✨ PHASE 4.169: Management buttons - Stick to the right, in line with preview buttons */}
                                        <div className="management-buttons d-flex flex-wrap gap-2 align-items-center justify-content-sm-end ms-sm-auto">
                                            <Link
                                                to={`/instructor/edit-course/${param?.course_id}/curriculum/`}
                                                className="btn btn-update-course"
                                                style={{ background: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)" }}
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
                                            <Link
                                                to={`/instructor/edit-course/${param?.course_id}/gamification/`}
                                                className="btn btn-update-course"
                                                style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
                                            >
                                                <i className="fas fa-gamepad me-2"></i>
                                                Kelola Gamifikasi
                                            </Link>
                                            <Link
                                                to={`/instructor/edit-course/${param?.course_id}/certificate/`}
                                                className="btn btn-update-course"
                                                style={{ background: "linear-gradient(135deg, #0d5c3a 0%, #064e3b 100%)" }}
                                            >
                                                <i className="fas fa-certificate me-2"></i>
                                                Desain Sertifikat
                                            </Link>
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
                                                    <small className="text-muted">Kursus Anda telah disetujui dan sekarang tersedia untuk peserta di platform.</small>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ✨ PHASE 4.71 UPDATED: Buttons aligned horizontally when published_version exists */}
                                    {/* ✨ PHASE 11.169a: Don't show buttons if course is in Review status (waiting for admin) */}
                                    {(() => {
                                        const hasPublishedVersion = !!courseData?.published_version;
                                        const platformStatus = courseData?.platform_status;
                                        const isReview = platformStatus === "Review";
                                        // ✨ PHASE 7f FIX: Show buttons if:
                                        // 1. Course has published_version (was published before) OR platform_status is Published
                                        // 2. AND course is not awaiting admin review
                                        const shouldShowBothButtons = (hasPublishedVersion || platformStatus === "Published") && !isReview;
                                        console.log("[CourseEdit.ButtonRender] Button visibility check:", {
                                            hasPublishedVersion,
                                            platformStatus,
                                            isReview,
                                            shouldShowBothButtons,
                                            course_id: courseData?.id
                                        });
                                        return shouldShowBothButtons;
                                    })() ? (
                                        // Show both buttons in a horizontal line for published courses
                                        <div className="d-flex justify-content-center gap-3 mt-3 w-100 flex-wrap">
                                            {/* Restore Button */}
                                            <div className="position-relative d-flex flex-column align-items-center">
                                                <button
                                                    type="button"
                                                    className="btn btn-warning btn-sm d-inline-flex align-items-center gap-2"
                                                    onClick={handleRestoreCourse}
                                                    disabled={submitStatus === "submitting"}
                                                    style={{
                                                        background: "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)",
                                                        color: "white",
                                                        border: "none",
                                                        padding: "7px 18px",
                                                        borderRadius: "8px",
                                                        fontWeight: "600",
                                                        fontSize: "0.85rem",
                                                        boxShadow: "0 2px 8px rgba(243, 156, 18, 0.25)",
                                                        minHeight: "34px",
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
                                                            <i className="fas fa-undo"></i>
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
                                                    className="btn btn-publish-course btn-sm d-inline-flex align-items-center gap-2"
                                                    onClick={handlePublishCourse}
                                                    disabled={isPublishing || submitStatus === "submitting" || !canPublish}
                                                    style={{
                                                        background: canPublish
                                                            ? "linear-gradient(135deg, #0f766e 0%, #115e59 100%)"
                                                            : "linear-gradient(135deg, #9e9e9e 0%, #757575 100%)",
                                                        color: "white",
                                                        border: "none",
                                                        padding: "7px 18px",
                                                        borderRadius: "8px",
                                                        fontWeight: "600",
                                                        fontSize: "0.85rem",
                                                        boxShadow: canPublish
                                                            ? "0 2px 8px rgba(15, 118, 110, 0.25)"
                                                            : "0 2px 8px rgba(0, 0, 0, 0.1)",
                                                        transition: "all 0.3s ease",
                                                        cursor: canPublish ? "pointer" : "not-allowed",
                                                        opacity: canPublish ? 1 : 0.6,
                                                        whiteSpace: "nowrap",
                                                        minHeight: "34px"
                                                    }}
                                                    onMouseOver={(e) => {
                                                        if (canPublish && !isPublishing && submitStatus !== "submitting") {
                                                            e.currentTarget.style.transform = "translateY(-2px)";
                                                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(15, 118, 110, 0.35)";
                                                        }
                                                    }}
                                                    onMouseOut={(e) => {
                                                        if (canPublish) {
                                                            e.currentTarget.style.transform = "translateY(0)";
                                                            e.currentTarget.style.boxShadow = "0 2px 8px rgba(15, 118, 110, 0.25)";
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
                                                            <i className={`fas ${canPublish ? "fa-paper-plane" : "fa-lock"}`}></i>
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
                                    ) : (() => {
                                        const isDraft = courseData?.platform_status === "Draft";
                                        const isRejected = courseData?.platform_status === "Rejected";
                                        const shouldShowSingleButton = (isDraft || isRejected);
                                        console.log("[CourseEdit.ButtonRender] Draft/Rejected button check:", {
                                            isDraft,
                                            isRejected,
                                            shouldShowSingleButton,
                                            platformStatus: courseData?.platform_status
                                        });
                                        return shouldShowSingleButton;
                                    })() && (
                                        // ✨ PHASE 11.169a: Show only submit button for Draft and Rejected courses (not Review/in-progress)
                                        <div className="d-flex justify-content-center mt-3 w-100">
                                            <div className="position-relative d-flex flex-column align-items-center">
                                                <button
                                                    type="button"
                                                    className="btn btn-publish-course btn-sm d-inline-flex align-items-center gap-2"
                                                    onClick={handlePublishCourse}
                                                    disabled={isPublishing || submitStatus === "submitting" || !canPublish}
                                                    style={{
                                                        background: canPublish
                                                            ? "linear-gradient(135deg, #0f766e 0%, #115e59 100%)"
                                                            : "linear-gradient(135deg, #9e9e9e 0%, #757575 100%)",
                                                        color: "white",
                                                        border: "none",
                                                        padding: "7px 18px",
                                                        borderRadius: "8px",
                                                        fontWeight: "600",
                                                        fontSize: "0.85rem",
                                                        boxShadow: canPublish
                                                            ? "0 2px 8px rgba(15, 118, 110, 0.25)"
                                                            : "0 2px 8px rgba(0, 0, 0, 0.1)",
                                                        transition: "all 0.3s ease",
                                                        cursor: canPublish ? "pointer" : "not-allowed",
                                                        opacity: canPublish ? 1 : 0.6,
                                                        whiteSpace: "nowrap",
                                                        minHeight: "34px"
                                                    }}
                                                    onMouseOver={(e) => {
                                                        if (canPublish && !isPublishing && submitStatus !== "submitting") {
                                                            e.currentTarget.style.transform = "translateY(-2px)";
                                                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(15, 118, 110, 0.35)";
                                                        }
                                                    }}
                                                    onMouseOut={(e) => {
                                                        if (canPublish) {
                                                            e.currentTarget.style.transform = "translateY(0)";
                                                            e.currentTarget.style.boxShadow = "0 2px 8px rgba(15, 118, 110, 0.25)";
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
                                                            <i className={`fas ${canPublish ? "fa-paper-plane" : "fa-lock"}`}></i>
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