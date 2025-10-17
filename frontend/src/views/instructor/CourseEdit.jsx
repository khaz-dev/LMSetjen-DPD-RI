import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";

// Custom hooks
import { useCourseData, useCourseForm, useCourseSubmit, useCategories } from "./hooks/useCourse";

// Components
import ImageUpload from "./components/ImageUpload";
import VideoUpload from "./components/VideoUpload";
import FormField from "./components/FormField";

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
    const [submitStatus, setSubmitStatus] = useState('idle'); // idle, submitting, success, error
    const [submitMessage, setSubmitMessage] = useState('');
    const [validationSummary, setValidationSummary] = useState({ errors: [], warnings: [] });
    const [isDirty, setIsDirty] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [canPublish, setCanPublish] = useState(false);
    const [initialCourseData, setInitialCourseData] = useState(null); // Track initial data
    
    const navigate = useNavigate();
    const param = useParams();

    // Custom hooks
    const { courseData, setCourseData, updateCourseData, loading } = useCourseData(param?.course_id);
    const { categories } = useCategories();
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
        
        // Course must have curriculum, lessons, AND quizzes to publish
        const meetsPublishRequirements = hasCurriculum && hasLessons && hasQuizzes;
        
        setCanPublish(meetsPublishRequirements);
    }, [courseData]);

    // Track form changes for dirty state - only if actual data changed
    const trackFormChanges = useCallback(() => {
        if (!initialCourseData) {
            return;
        }

        // Compare current data with initial data to detect real changes
        const hasRealChanges = JSON.stringify(courseData) !== JSON.stringify(initialCourseData);
        
        if (hasRealChanges !== isDirty) {
            setIsDirty(hasRealChanges);
        }
    }, [courseData, initialCourseData, isDirty]);

    // Validation wrapper to use the imported validation functions
    const handleFieldValidation = (fieldName, value) => {
        let validationFunction;
        let actualValue = value;
        
        // Handle category field special case
        if (fieldName === 'category') {
            actualValue = courseData?.category?.id || value;
        }
        
        switch (fieldName) {
            case 'title':
                validationFunction = validateTitle;
                break;
            case 'description':
                validationFunction = validateDescription;
                break;
            case 'image':
                validationFunction = validateImage;
                break;
            case 'category':
                validationFunction = validateCategory;
                break;
            case 'level':
                validationFunction = validateLevel;
                break;
            default:
                return;
        }
        
        validateFormField(fieldName, actualValue, validationFunction);
    };

    // Enhanced form input changes with dirty tracking
    const handleCourseInputChange = (event) => {
        const { name, value } = event.target;
        updateCourseData({ [name]: value });
        handleFieldValidation(name, value);
        
        // Defer dirty check to next tick so state updates first
        setTimeout(() => trackFormChanges(), 0);
        
        // Reset submit status when user makes changes after an error
        if (submitStatus === 'error') {
            setSubmitStatus('idle');
            setSubmitMessage('');
        }
    };

    // Enhanced description change handling
    const handleDescriptionChange = (content) => {
        updateCourseData({ description: content });
        handleFieldValidation('description', content);
        
        // Defer dirty check to next tick so state updates first
        setTimeout(() => trackFormChanges(), 0);
        
        if (submitStatus === 'error') {
            setSubmitStatus('idle');
            setSubmitMessage('');
        }
    };

    // Enhanced form submission with comprehensive error handling
    const handleCourseSubmit = async (event) => {
        event.preventDefault();
        
        // Set submitting state immediately
        setSubmitStatus('submitting');
        setSubmitMessage('Validating and updating your course...');
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
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                }

                setSubmitStatus('error');
                setSubmitMessage(`Please fix ${Object.keys(validationResult.errors).filter(key => validationResult.errors[key].length > 0).length} validation error(s) before updating`);

                Toast().fire({
                    icon: "error",
                    title: "Validation Failed",
                    text: "Please review and fix the highlighted errors",
                    timer: 5000,
                    timerProgressBar: true
                });
                return;
            }

            // Update submit message for actual submission
            setSubmitMessage('Saving your course updates...');

            await submitCourse(
                courseData, 
                param?.course_id,
                (data) => {
                    // Enhanced success callback
                    setSubmitStatus('success');
                    setSubmitMessage('Course updated successfully!');
                    setIsDirty(false);
                    
                    // Update initial data to current data after successful save
                    setInitialCourseData(JSON.parse(JSON.stringify(courseData)));
                    
                    Toast().fire({
                        icon: "success",
                        title: "Course Updated!",
                        text: "Your course has been successfully updated and saved.",
                        timer: 4000,
                        timerProgressBar: true,
                        showConfirmButton: false
                    });

                    // Reset to idle after showing success
                    setTimeout(() => {
                        setSubmitStatus('idle');
                        setSubmitMessage('');
                    }, 3000);
                },
                (error) => {
                    // Enhanced error callback
                    console.error("Failed to update course:", error);
                    setSubmitStatus('error');
                    
                    let errorMessage = 'An unexpected error occurred while updating your course.';
                    
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
                        title: "Update Failed",
                        text: errorMessage,
                        timer: 6000,
                        timerProgressBar: true,
                        showConfirmButton: true,
                        confirmButtonText: 'Try Again'
                    });
                }
            );
        } catch (error) {
            console.error("Submission error:", error);
            setSubmitStatus('error');
            setSubmitMessage('A network error occurred. Please check your connection and try again.');
            
            Toast().fire({
                icon: "error",
                title: "Network Error",
                text: "Unable to connect to the server. Please check your internet connection.",
                timer: 6000,
                timerProgressBar: true,
                showConfirmButton: true,
                confirmButtonText: 'Retry'
            });
        }
    };
    
    // Handle course publishing with comprehensive validation
    const handlePublishCourse = async () => {
        // Pre-publish validation
        const curriculumCount = courseData?.curriculum?.length || 0;
        const lecturesCount = courseData?.lectures?.length || 0;
        const quizzesCount = courseData?.quizzes?.length || 0;
        
        // Check minimum requirements
        if (!canPublish) {
            await Swal.fire({
                title: 'Cannot Publish Course Yet',
                html: `
                    <div class="text-start">
                        <p class="mb-3">Your course <strong>"${courseData?.title}"</strong> doesn't meet the minimum requirements for publishing.</p>
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            <strong>Missing Requirements:</strong>
                            <ul class="mt-2 mb-0">
                                ${curriculumCount === 0 ? '<li><i class="fas fa-times text-danger me-1"></i> No curriculum sections added</li>' : ''}
                                ${lecturesCount === 0 ? '<li><i class="fas fa-times text-danger me-1"></i> No lessons uploaded</li>' : ''}
                                ${quizzesCount === 0 ? '<li><i class="fas fa-times text-danger me-1"></i> No quizzes added</li>' : ''}
                            </ul>
                        </div>
                        <div class="alert alert-info mt-3">
                            <i class="fas fa-info-circle me-2"></i>
                            <strong>Next Steps:</strong>
                            <ol class="mt-2 mb-0">
                                ${curriculumCount === 0 ? '<li>Click "Manage Curriculum" to add course sections</li>' : ''}
                                ${lecturesCount === 0 ? '<li>Add lessons to your curriculum sections</li>' : ''}
                                ${quizzesCount === 0 ? '<li>Click "Manage Quiz" to add quizzes for your course</li>' : ''}
                                <li>Come back here and click "Publish Course"</li>
                            </ol>
                        </div>
                    </div>
                `,
                icon: 'warning',
                confirmButtonText: 'Got It',
                confirmButtonColor: '#3085d6',
                width: 600
            });
            return;
        }
        
        const result = await Swal.fire({
            title: 'Publish Course?',
            html: `
                <div class="text-start">
                    <p class="mb-3">Are you ready to publish <strong>"${courseData?.title}"</strong>?</p>
                    <div class="alert alert-success">
                        <i class="fas fa-check-circle me-2"></i>
                        <strong>Your course includes:</strong>
                        <ul class="mt-2 mb-0">
                            <li><i class="fas fa-check text-success me-1"></i> ${curriculumCount} curriculum section${curriculumCount !== 1 ? 's' : ''}</li>
                            <li><i class="fas fa-check text-success me-1"></i> ${lecturesCount} lesson${lecturesCount !== 1 ? 's' : ''}</li>
                            <li><i class="fas fa-check text-success me-1"></i> ${quizzesCount} quiz${quizzesCount !== 1 ? 'zes' : ''}</li>
                        </ul>
                    </div>
                    <p class="text-muted mb-0"><small>Once published, students will be able to enroll in your course.</small></p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Publish Course',
            cancelButtonText: 'Not Yet',
            width: 600
        });
        
        if (result.isConfirmed) {
            setIsPublishing(true);
            try {
                const response = await useAxios.post(`teacher/course-publish/${param?.course_id}/`);
                
                if (response.data.success) {
                    // Update local course data
                    setCourseData({
                        ...courseData,
                        teacher_course_status: 'Published',
                        platform_status: 'Published'
                    });
                    
                    await Swal.fire({
                        title: 'Course Published!',
                        html: `
                            <div class="text-start">
                                <p class="mb-3"><strong>"${courseData?.title}"</strong> is now live!</p>
                                <div class="alert alert-success">
                                    <i class="fas fa-check-circle me-2"></i>
                                    <strong>Your course is ready:</strong>
                                    <ul class="mt-2 mb-0">
                                        <li>${response.data.course.curriculum_sections} curriculum sections</li>
                                        <li>${response.data.course.lessons} lessons</li>
                                        <li>Published and available to students</li>
                                    </ul>
                                </div>
                                ${response.data.warnings && response.data.warnings.length > 0 ? `
                                    <div class="alert alert-warning mt-2">
                                        <i class="fas fa-exclamation-triangle me-2"></i>
                                        <strong>Suggestions:</strong>
                                        <ul class="mt-2 mb-0">
                                            ${response.data.warnings.map(w => `<li>${w}</li>`).join('')}
                                        </ul>
                                    </div>
                                ` : ''}
                            </div>
                        `,
                        icon: 'success',
                        showCancelButton: true,
                        confirmButtonText: 'View Course',
                        cancelButtonText: 'Stay Here',
                        confirmButtonColor: '#4CAF50'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            window.location.href = `/course-detail/${courseData?.slug}/`;
                        }
                    });
                } else {
                    throw new Error(response.data.message || 'Failed to publish course');
                }
            } catch (error) {
                console.error("Error publishing course:", error);
                const errorData = error.response?.data;
                
                await Swal.fire({
                    title: 'Cannot Publish Course',
                    html: `
                        <div class="text-start">
                            <p class="mb-3">${errorData?.message || 'Failed to publish course'}</p>
                            ${errorData?.errors && errorData.errors.length > 0 ? `
                                <div class="alert alert-danger">
                                    <i class="fas fa-exclamation-circle me-2"></i>
                                    <strong>Please fix these issues:</strong>
                                    <ul class="mt-2 mb-0">
                                        ${errorData.errors.map(e => `<li>${e}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            ${errorData?.warnings && errorData.warnings.length > 0 ? `
                                <div class="alert alert-warning mt-2">
                                    <i class="fas fa-exclamation-triangle me-2"></i>
                                    <strong>Suggestions:</strong>
                                    <ul class="mt-2 mb-0">
                                        ${errorData.warnings.map(w => `<li>${w}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    `,
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            } finally {
                setIsPublishing(false);
            }
        }
    };

    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="course-edit-container">
                    <div className="container">
                        <Header />
                        <div className="row mt-0 mt-md-4">
                            <Sidebar />
                            <div className="col-lg-9 col-md-8 col-12">
                                <div className="course-form-card card">
                                    <div className="loading-overlay">
                                        <div className="loading-content">
                                            <div className="loading-spinner"></div>
                                            <h5 className="text-muted mb-2">Loading course data...</h5>
                                            <p className="text-muted mb-0">Please wait while we fetch your course information</p>
                                        </div>
                                    </div>
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
            <section className="course-edit-container">
                <div className="container">
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        <Sidebar />                        
                        <div className="col-lg-9 col-md-8 col-12">
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
                                            Edit Course
                                        </h1>
                                        <p className="mb-0 text-white opacity-90">
                                            Update your course information and content to provide the best learning experience
                                        </p>
                                    </div>
                                    <div className="d-flex flex-column gap-3">
                                        <Link 
                                            to={`/instructor/edit-course/${param?.course_id}/curriculum/`} 
                                            className="btn btn-outline-light border border-2 border-light"
                                        >
                                            <i className="fas fa-list me-2"></i>
                                            Manage Curriculum
                                        </Link>
                                        <Link 
                                            to={`/instructor/edit-course/${param?.course_id}/quiz/`} 
                                            className="btn btn-outline-light border border-2 border-light"
                                        >
                                            <i className="fas fa-question-circle me-2"></i>
                                            Manage Quiz
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
                                            Media Files
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
                                        />

                                        <VideoUpload
                                            courseData={courseData}
                                            setCourseData={setCourseData}
                                            errors={errors}
                                            warnings={warnings}
                                            validateField={handleFieldValidation}
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
                                                    value={courseData?.title || ''}
                                                    onChange={handleCourseInputChange}
                                                    errors={errors.title}
                                                    warnings={warnings.title}
                                                    getValidationClass={getFieldValidationClass}
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
                                                    value={courseData?.category?.id || courseData?.category || ''}
                                                    onChange={handleCourseInputChange}
                                                    errors={errors.category}
                                                    warnings={warnings.category}
                                                    getValidationClass={getFieldValidationClass}
                                                    options={[
                                                        { value: "", label: "Select a category" },
                                                        ...categories.map(cat => ({ value: cat.id, label: cat.title }))
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
                                                    value={courseData?.level || ''}
                                                    onChange={handleCourseInputChange}
                                                    errors={errors.level}
                                                    warnings={warnings.level}
                                                    getValidationClass={getFieldValidationClass}
                                                    options={[
                                                        { value: "", label: "Select level" },
                                                        ...COURSE_LEVELS
                                                    ]}
                                                    required
                                                    helpText="Indicate the difficulty level"
                                                />
                                            </div>
                                        </div>

                                        <div className="row">
                                            <div className="col-md-6">
                                                <FormField
                                                    label="Course Status"
                                                    name="teacher_course_status"
                                                    type="select"
                                                    value={courseData?.teacher_course_status || 'Draft'}
                                                    onChange={handleCourseInputChange}
                                                    options={COURSE_STATUS_OPTIONS}
                                                    helpText="Control course visibility"
                                                />
                                            </div>
                                            <div className="col-md-6">
                                                <div className="mb-3" style={{ marginTop: '32px' }}>
                                                    <label className="form-label">Current Status</label>
                                                    <div className="d-flex align-items-center">
                                                        <span className={`status-badge ${courseData?.teacher_course_status?.toLowerCase() || 'draft'}`}>
                                                            <i className={`fas ${
                                                                courseData?.teacher_course_status === 'Published' ? 'fa-check-circle' :
                                                                courseData?.teacher_course_status === 'Disabled' ? 'fa-times-circle' : 'fa-clock'
                                                            } me-1`}></i>
                                                            {courseData?.teacher_course_status || 'Draft'}
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
                                                label="Course Description"
                                                value={courseData?.description || ''}
                                                onChange={handleDescriptionChange}
                                                errors={errors.description}
                                                warnings={warnings.description}
                                                required
                                                placeholder="Describe what students will learn in this course..."
                                                helpText="Provide a comprehensive overview of your course content and learning outcomes"
                                            />
                                        </Suspense>
                                        
                                        {/* Manage Curriculum Button */}
                                        <div className="d-flex justify-content-left mt-4 gap-3">
                                            <Link 
                                                to={`/instructor/edit-course/${param?.course_id}/curriculum/`} 
                                                className="btn btn-update-course"
                                            
                                            >
                                                <i className="fas fa-list me-2"></i>
                                                Manage Curriculum
                                            </Link>
                                            <Link 
                                                to={`/instructor/edit-course/${param?.course_id}/quiz/`} 
                                                className="btn btn-update-course"
                                                style={{ background: 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)' }}
                                            >
                                                <i className="fas fa-question-circle me-2"></i>
                                                Manage Quiz
                                            </Link>
                                        </div>
                                    </div>

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
                                                                {validationSummary.errors.length} Error{validationSummary.errors.length !== 1 ? 's' : ''} Found
                                                            </h6>
                                                            <ul className="mb-0 ps-3">
                                                                {validationSummary.errors.map((errorGroup, index) => (
                                                                    <li key={index} className="mb-1">
                                                                        <strong className="text-capitalize">{errorGroup.field}:</strong> {errorGroup.messages.join(', ')}
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
                                                                {validationSummary.warnings.length} Warning{validationSummary.warnings.length !== 1 ? 's' : ''}
                                                            </h6>
                                                            <ul className="mb-0 ps-3">
                                                                {validationSummary.warnings.map((warningGroup, index) => (
                                                                    <li key={index} className="mb-1">
                                                                        <strong className="text-capitalize">{warningGroup.field}:</strong> {warningGroup.messages.join(', ')}
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
                                            submitStatus === 'success' ? 'alert-success' : 
                                            submitStatus === 'error' ? 'alert-danger' : 
                                            'alert-info'
                                        } border-0 shadow-sm d-flex align-items-center`}>
                                            <div className="status-icon me-3">
                                                {submitStatus === 'submitting' && (
                                                    <div className="spinner-border spinner-border-sm text-primary"></div>
                                                )}
                                                {submitStatus === 'success' && (
                                                    <i className="fas fa-check-circle text-success fs-5"></i>
                                                )}
                                                {submitStatus === 'error' && (
                                                    <i className="fas fa-times-circle text-danger fs-5"></i>
                                                )}
                                            </div>
                                            <div className="status-message">
                                                <div className="fw-semibold">{submitMessage}</div>
                                                {submitStatus === 'submitting' && (
                                                    <small className="text-muted">Please don't close this page...</small>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Enhanced Action Buttons */}
                                <div className="action-buttons d-flex flex-column flex-sm-row justify-content-between align-items-stretch align-items-sm-center gap-3">
                                    <div className="form-status-info">
                                        {isDirty && submitStatus !== 'submitting' && (
                                            <div className="text-warning small">
                                                <i className="fas fa-circle me-1"></i>
                                                You have unsaved changes
                                            </div>
                                        )}
                                        {!isDirty && submitStatus === 'idle' && (
                                            <div className="text-muted small">
                                                <i className="fas fa-save me-1"></i>
                                                All changes saved
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="button-group d-flex flex-wrap gap-2 justify-content-end">
                                        {/* Preview Button */}
                                        <Link 
                                            to={`/course-detail/${courseData?.slug}/`}
                                            target="_blank"
                                            className="btn btn-outline-primary"
                                            disabled={submitStatus === 'submitting'}
                                        >
                                            <i className="fas fa-eye me-2"></i>
                                            Preview Course
                                        </Link>
                                        
                                        {/* Enhanced Update Course Button */}
                                        <button 
                                            className={`btn btn-update-course ${submitStatus}`}
                                            type="submit"
                                            disabled={
                                                isSubmitting || 
                                                submitStatus === 'submitting' || 
                                                validationSummary.errors.length > 0
                                            }
                                        >
                                            <div className="button-content d-flex align-items-center justify-content-center">
                                                {submitStatus === 'submitting' ? (
                                                    <>
                                                        <div className="spinner-border spinner-border-sm me-2"></div>
                                                        <span className="button-text">
                                                            {submitMessage.includes('Validating') ? 'Validating...' : 
                                                             submitMessage.includes('Saving') ? 'Saving...' : 'Updating...'}
                                                        </span>
                                                    </>
                                                ) : submitStatus === 'success' ? (
                                                    <>
                                                        <i className="fas fa-check me-2"></i>
                                                        <span className="button-text">Updated Successfully!</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-save me-2"></i>
                                                        <span className="button-text">Update Course</span>
                                                    </>
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Publish Course Button - Separate row, aligned to the right */}
                                {courseData?.teacher_course_status === 'Draft' && (
                                    <div className="d-flex justify-content-end mt-3">
                                        <div className="position-relative">
                                            <button 
                                                type="button"
                                                className="btn btn-publish-course"
                                                onClick={handlePublishCourse}
                                                disabled={isPublishing || submitStatus === 'submitting' || !canPublish}
                                                style={{
                                                    background: canPublish 
                                                        ? 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)' 
                                                        : 'linear-gradient(135deg, #9e9e9e 0%, #757575 100%)',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '12px 30px',
                                                    borderRadius: '8px',
                                                    fontWeight: '600',
                                                    fontSize: '1rem',
                                                    boxShadow: canPublish 
                                                        ? '0 4px 15px rgba(76, 175, 80, 0.3)' 
                                                        : '0 2px 8px rgba(0, 0, 0, 0.1)',
                                                    transition: 'all 0.3s ease',
                                                    cursor: canPublish ? 'pointer' : 'not-allowed',
                                                    opacity: canPublish ? 1 : 0.6
                                                }}
                                                onMouseOver={(e) => {
                                                    if (canPublish && !isPublishing && submitStatus !== 'submitting') {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.4)';
                                                    }
                                                }}
                                                onMouseOut={(e) => {
                                                    if (canPublish) {
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.3)';
                                                    }
                                                }}
                                                title={!canPublish ? 'Add curriculum, lessons, and quizzes before publishing' : 'Publish your course'}
                                            >
                                                {isPublishing ? (
                                                    <>
                                                        <div className="spinner-border spinner-border-sm me-2"></div>
                                                        <span>Publishing...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className={`fas ${canPublish ? 'fa-rocket' : 'fa-lock'} me-2`}></i>
                                                        <span>Publish Course</span>
                                                    </>
                                                )}
                                            </button>
                                            {!canPublish && (
                                                <small className="text-muted d-block mt-1 text-end" style={{ fontSize: '0.75rem' }}>
                                                    <i className="fas fa-info-circle me-1"></i>
                                                    Add curriculum, lessons & quizzes first
                                                </small>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Helper Text */}
                                <div className="form-helper-text text-center mt-3">
                                    <small className="text-muted">
                                        <i className="fas fa-info-circle me-1"></i>
                                        Changes are automatically validated. Fix any errors before updating your course.
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