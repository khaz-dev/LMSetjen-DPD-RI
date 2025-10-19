import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import ImageUpload from "./components/ImageUpload";
import VideoUpload from "./components/VideoUpload";
import FormField from "./components/FormField";

// Lazy load CKEditor component (1.24 MB)
const RichTextEditor = lazy(() => import("./components/RichTextEditor"));

import useAxios from "../../utils/useAxios";
import Toast from "../plugin/Toast";
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
    const navigate = useNavigate();

    // Refs for focusing on error inputs
    const titleRef = useRef(null);
    const categoryRef = useRef(null);
    const imageRef = useRef(null);
    const levelRef = useRef(null);
    const ckeditorRef = useRef(null);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await useAxios.get(`course/category/`);
                setCategory(response.data);
            } catch (error) {
                console.error('Error fetching categories:', error);
                Toast("error", "Failed to load categories");
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
            case 'title':
                const titleValidation = validateTitle(value);
                fieldErrors = titleValidation.errors;
                fieldWarnings = titleValidation.warnings;
                break;
            case 'description':
                const descValidation = validateDescription(value);
                fieldErrors = descValidation.errors;
                fieldWarnings = descValidation.warnings;
                break;
            case 'category':
                const categoryValidation = validateCategory(value);
                fieldErrors = categoryValidation.errors;
                break;
            case 'level':
                const levelValidation = validateLevel(value);
                fieldErrors = levelValidation.errors;
                break;
            case 'image':
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
        validateField('description', content);
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
                    behavior: 'smooth', 
                    block: 'center' 
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
        };

        try {
            const response = await useAxios.post(`teacher/course-create/`, courseSubmissionData, {
                headers: {
                    "Content-Type": "application/json",
                },
            });
            
            const courseId = response.data.course_id;
            
            // Show success message with draft status information
            Toast().fire({
                icon: "success",
                title: "Course Created Successfully!",
                html: `
                    <div class="text-start">
                        <p class="mb-2"><strong>Status:</strong> <span class="badge bg-warning text-dark">Draft</span></p>
                        <p class="mb-2"><small>Your course has been created but is not yet published.</small></p>
                        <hr class="my-2">
                        <p class="mb-1"><strong>Next Steps:</strong></p>
                        <ul class="small mb-0 ps-3">
                            <li>Complete course information</li>
                            <li>Add curriculum and lessons</li>
                            <li>Create quizzes and assessments</li>
                            <li>Review and publish your course</li>
                        </ul>
                    </div>
                `,
                width: 500,
                confirmButtonText: "Continue Editing",
                showConfirmButton: true,
                timer: 3000,
                timerProgressBar: true
            }).then((result) => {
                // Redirect to course edit page
                navigate(`/instructor/edit-course/${courseId}/`);
            });
            
            // Auto-redirect after 3 seconds even if user doesn't click
            setTimeout(() => {
                navigate(`/instructor/edit-course/${courseId}/`);
            }, 3000);
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
                    if (field !== 'error') { // Skip the generic error field
                        if (Array.isArray(serverResponse[field])) {
                            formattedErrors[field] = serverResponse[field];
                        } else if (typeof serverResponse[field] === 'string') {
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
            <section className="course-create-container">
                <div className="container">
                    <Header />
                    <div className="row">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            <div className="create-header-modern">
                                <div className="d-lg-flex align-items-center justify-content-between">
                                    <div className="mb-4 mb-lg-0">
                                        <h1 className="text-white mb-2 fw-bold">
                                            <i className="fas fa-plus-circle me-2"></i>
                                            Create New Course
                                        </h1>
                                        <p className="mb-0 text-white opacity-90">
                                            Design and build an engaging learning experience for your students
                                        </p>
                                    </div>
                                    <div className="d-flex gap-3 align-items-center">
                                        <Link to="/instructor/courses/" className="btn btn-outline-light border border-2 border-light">
                                            <i className="fas fa-arrow-left me-2"></i>
                                            Back to Courses
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="form-body-modern">
                                {/* Draft Status Information */}
                                <div className="alert alert-info d-flex align-items-start mb-4 border-0 shadow-sm" style={{ 
                                    background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                                    borderLeft: '4px solid #2196f3'
                                }}>
                                    <div className="me-3">
                                        <i className="fas fa-info-circle fa-2x text-primary"></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <h6 className="alert-heading mb-2 fw-bold text-primary">
                                            <i className="fas fa-edit me-2"></i>
                                            Creating a Draft Course
                                        </h6>
                                        <p className="mb-2 small">
                                            Your course will be created in <span className="badge bg-warning text-dark fw-bold">Draft</span> status. 
                                            This means it won't be visible to students until you complete the following steps:
                                        </p>
                                        <ul className="mb-0 small ps-3">
                                            <li className="mb-1">
                                                <i className="fas fa-check-circle text-success me-1"></i>
                                                <strong>Add Course Information</strong> (You're doing this now!)
                                            </li>
                                            <li className="mb-1">
                                                <i className="fas fa-list text-muted me-1"></i>
                                                <strong>Build Curriculum</strong> - Add sections and lessons
                                            </li>
                                            <li className="mb-1">
                                                <i className="fas fa-question-circle text-muted me-1"></i>
                                                <strong>Create Quizzes</strong> - Add assessments and tests
                                            </li>
                                            <li>
                                                <i className="fas fa-rocket text-muted me-1"></i>
                                                <strong>Publish Course</strong> - Make it available to students
                                            </li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Media Files Section */}
                                <div className="form-section">
                                    <h5 className="section-title mb-3">
                                        <i className="fas fa-images me-2"></i>
                                        Media Files
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
                                        errors={errors}
                                        warnings={warnings}
                                        validateField={validateField}
                                    />
                                </div>

                                {/* Basic Information Section */}
                                <div className="form-section">
                                    <h5 className="section-title mb-3">
                                        <i className="fas fa-info-circle me-2"></i>
                                        Basic Information
                                    </h5>
                                    
                                    <div className="row">
                                        <div className="col-12">
                                            <FormField 
                                                ref={titleRef}
                                                label="Course Title"
                                                name="title"
                                                value={courseData.title}
                                                onChange={handleCourseInputChange}
                                                errors={errors.title || []}
                                                warnings={warnings.title || []}
                                                required
                                                placeholder="Enter a compelling course title..."
                                                helpText="Create a title that accurately describes your course and attracts students"
                                            />
                                        </div>
                                    </div>

                                    <div className="row">
                                        <div className="col-md-6">
                                            <FormField 
                                                ref={categoryRef}
                                                label="Course Category"
                                                name="category"
                                                type="select"
                                                value={courseData.category}
                                                onChange={handleCourseInputChange}
                                                errors={errors.category || []}
                                                warnings={warnings.category || []}
                                                options={[
                                                    { value: "", label: "Select a category" },
                                                    ...(category?.map(cat => ({ value: cat.id, label: cat.title })) || [])
                                                ]}
                                                required
                                                helpText="Choose the most relevant category for your course"
                                            />
                                        </div>

                                        <div className="col-md-6">
                                            <FormField 
                                                ref={levelRef}
                                                label="Course Level"
                                                name="level"
                                                type="select"
                                                value={courseData.level}
                                                onChange={handleCourseInputChange}
                                                errors={errors.level || []}
                                                warnings={warnings.level || []}
                                                options={[
                                                    { value: "", label: "Select level" },
                                                    ...COURSE_LEVELS
                                                ]}
                                                required
                                                helpText="Indicate the difficulty level"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Course Description Section */}
                                <div className="form-section">
                                    <h5 className="section-title mb-3">
                                        <i className="fas fa-align-left me-2"></i>
                                        Course Description
                                    </h5>
                                    
                                    <Suspense fallback={
                                        <div className="text-center py-4">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading editor...</span>
                                            </div>
                                            <p className="mt-2 text-muted">Loading rich text editor...</p>
                                        </div>
                                    }>
                                        <RichTextEditor
                                            ref={ckeditorRef}
                                            label="Course Description"
                                            value={courseData.description || ""}
                                            onChange={handleCKEditorChange}
                                            errors={errors.description || []}
                                            warnings={warnings.description || []}
                                            required
                                            placeholder="Describe what students will learn in this course..."
                                            helpText="Provide a comprehensive overview of your course content and learning outcomes"
                                        />
                                    </Suspense>
                                </div>

                                {/* Action Buttons Section */}
                                <div style={{ marginTop: '20px', marginBottom: '10px' }}>
                                    <div className="d-flex justify-content-end gap-3">
                                        <Link to="/instructor/courses/" className="btn btn-outline-primary">
                                            <i className="fas fa-times me-2"></i>
                                            Cancel
                                        </Link>
                                        <button 
                                            type="submit" 
                                            className="btn btn-create-course"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                                    Creating Course...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-save me-2"></i>
                                                    Create Course
                                                </>
                                            )}
                                        </button>
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

export default React.memo(CourseCreate);