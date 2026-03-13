import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import ImageUpload from "./components/ImageUpload";
import VideoUpload from "./components/VideoUpload";
import FormField from "./components/FormField";
import CourseFeaturesForm from "./components/CourseFeaturesForm";
import CourseRequirementsForm from "./components/CourseRequirementsForm";
import CourseLearningOutcomesForm from "./components/CourseLearningOutcomesForm";

// Lazy load CKEditor component (1.24 MB)
const RichTextEditor = lazy(() => import("./components/RichTextEditor"));

import useAxios from "../../utils/useAxios";
import Toast from "../plugin/Toast";
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

function CourseCreate() {
    const [courseData, setCourseData] = useState(DEFAULT_COURSE_DATA);
    const [imagePreview, setImagePreview] = useState("");
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
        
        // Cleanup function to reset state when component unmounts
        return () => {
            setCourseData(DEFAULT_COURSE_DATA);
            setImagePreview("");
            setErrors({});
            setWarnings({});
            setLoading(false);
        };
    }, []);

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
            file: courseData.file,   // URL from file-upload API
            intro_video_source: courseData.intro_video_source || "upload", // ✨ PHASE 4.18: Include video source type
        };

        try {
            const response = await useAxios.post("teacher/course-create/", courseSubmissionData, {
                headers: {
                    "Content-Type": "application/json",
                },
            });
            
            const courseId = response.data.course_id;
            
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
                                // Create course form (initial state)
                                <form onSubmit={handleSubmit} className="form-body-modern">
                                {/* Draft Status Information */}
                                <div className="alert alert-info d-flex align-items-start mb-4 border-0 shadow-sm" style={{ 
                                    background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
                                    borderLeft: "4px solid #2196f3"
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
                                        validateField={validateField}
                                        imageRef={imageRef}
                                    />

                                    <VideoUpload 
                                        courseData={courseData}
                                        setCourseData={setCourseData}
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