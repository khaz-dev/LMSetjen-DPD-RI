import { useState, useEffect, useRef } from "react";
import useAxios from "../../../utils/useAxios";
import UserData from "../../plugin/UserData";
import Toast from "../../plugin/Toast";

export const useCourseData = (courseId) => {
    const [courseData, setCourseData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCourse = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await useAxios.get(`/teacher/course-detail/${courseId}/`);
            
            if (response?.data) {
                setCourseData(response.data);
            } else {
                setError("Course not found");
            }
        } catch (error) {
            console.error("Error fetching course:", error);
            console.log("[useCourseData] Error response:", error.response?.data);
            
            // ✨ PHASE 4.76: Check if error is due to published course requiring draft
            const errorData = error.response?.data;
            const errorDetail = errorData?.detail;
            const isPublishedCourseError = error.response?.status === 403 && 
                (errorDetail?.action === "edit_published" || 
                 (typeof errorDetail === 'object' && errorDetail?.action === "edit_published"));
            
            if (isPublishedCourseError) {
                console.log("[useCourseData] Published course detected - setting published_course error type");
                
                // Show error to user
                Toast().fire({
                    icon: "info",
                    title: "Kursus Sudah Dipublikasikan",
                    text: "Membuat draft versi untuk editing...",
                });
                
                // The CourseEdit component will need to handle this
                // Store the published course ID for the component to use
                setError({
                    type: "published_course",
                    published_course_id: courseId,
                    message: (typeof errorDetail === 'object' ? errorDetail?.message : null) || "Kursus ini sudah dipublikasikan"
                });
                setLoading(false);
                return;
            }
            
            // Regular error
            const errorMessage = (typeof errorDetail === 'object') 
                ? errorDetail?.message || errorDetail?.error || "Failed to load course data"
                : errorDetail || "Failed to load course data";
            
            setError(errorMessage);
            Toast().fire({
                icon: "error",
                title: "Error",
                text: errorMessage,
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (courseId) {
            fetchCourse();
        }
    }, [courseId]);

    const updateCourseData = (updates) => {
        setCourseData(prevData => ({
            ...prevData,
            ...updates
        }));
    };

    return {
        courseData,
        setCourseData,
        updateCourseData,
        fetchCourseData: fetchCourse,
        loading,
        error
    };
};

export const useCourseForm = (initialData = {}) => {
    const [errors, setErrors] = useState({});
    const [warnings, setWarnings] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validateField = (fieldName, value, validationFunction) => {
        const result = validationFunction(value);
        
        setErrors(prev => ({
            ...prev,
            [fieldName]: result.errors
        }));
        
        setWarnings(prev => ({
            ...prev,
            [fieldName]: result.warnings
        }));

        return result.errors.length === 0;
    };

    const clearFieldErrors = (fieldName) => {
        setErrors(prev => ({
            ...prev,
            [fieldName]: []
        }));
        
        setWarnings(prev => ({
            ...prev,
            [fieldName]: []
        }));
    };

    const clearAllErrors = () => {
        setErrors({});
        setWarnings({});
    };

    const hasErrors = () => {
        return Object.values(errors).some(fieldErrors => fieldErrors?.length > 0);
    };

    const getFieldValidationClass = (fieldName, baseClass = "form-control") => {
        if (errors[fieldName]?.length > 0) {
            return `${baseClass} is-invalid`;
        }
        if (warnings[fieldName]?.length > 0) {
            return `${baseClass} is-warning`;
        }
        if (initialData[fieldName]) {
            return `${baseClass} is-valid`;
        }
        return baseClass;
    };

    return {
        errors,
        warnings,
        isSubmitting,
        setIsSubmitting,
        validateField,
        clearFieldErrors,
        clearAllErrors,
        hasErrors,
        getFieldValidationClass
    };
};

export const useFileUpload = () => {
    const [loading, setLoading] = useState(false);

    const uploadFile = async (file, onSuccess, onError) => {
        setLoading(true);
        
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await useAxios.post("/file-upload/", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            if (response?.data?.url) {
                onSuccess(response.data.url);
                return response.data.url;
            } else {
                throw new Error("Upload failed - no URL returned");
            }
        } catch (error) {
            console.error("Error uploading file:", error);
            const errorMessage = error.response?.data?.message || "Failed to upload file. Please try again.";
            
            if (onError) {
                onError(errorMessage);
            } else {
                Toast().fire({
                    icon: "error",
                    title: "Upload Failed",
                    text: errorMessage,
                });
            }
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return {
        uploadFile,
        loading
    };
};

export const useCourseSubmit = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submitCourse = async (courseData, courseId, onSuccess, onError, hasRelatedChanges = false) => {
        setIsSubmitting(true);

        try {
            const userData = UserData();
            
            // ✨ CRITICAL FIX: Only send writable fields to avoid 400 Bad Request
            // The CourseSerializer has many read-only fields (students, curriculum, lectures, reviews, etc.)
            // Sending these causes validation errors. We must filter to only writable fields.
            // Writable fields: category, file, image, title, description, level, platform_status, 
            //                  teacher_course_status, featured, intro_video_source
            const writableFields = [
                'category', 'file', 'image', 'title', 'description', 'level',
                'platform_status', 'teacher_course_status', 'featured', 'intro_video_source'
            ];
            
            const formattedData = {};
            
            // Only include writable fields
            writableFields.forEach(field => {
                if (field in courseData) {
                    formattedData[field] = courseData[field];
                }
            });
            
            // 🎯 PHASE 4.57: CRITICAL FIX - Always include teacher_course_status for status reset detection
            // Even if not explicitly set, ensure it's present so backend can check it
            if (!('teacher_course_status' in formattedData) && courseData?.teacher_course_status) {
                formattedData.teacher_course_status = courseData.teacher_course_status;
                console.log('[useCourse.submitCourse] Added teacher_course_status from courseData:', formattedData.teacher_course_status);
            }
            
            // Extract category ID if category is an object
            if (formattedData.category) {
                formattedData.category = typeof formattedData.category === 'object' && formattedData.category?.id 
                    ? formattedData.category.id 
                    : formattedData.category;
            }
            
            // Extract teacher_course_status if it's an object
            if (formattedData.teacher_course_status) {
                formattedData.teacher_course_status = typeof formattedData.teacher_course_status === 'object' && formattedData.teacher_course_status?.value
                    ? formattedData.teacher_course_status.value
                    : formattedData.teacher_course_status;
            }

            // ✨ PHASE 4.56: Pass flag to backend indicating if features/requirements/learning_outcomes were updated
            if (hasRelatedChanges) {
                formattedData.has_related_changes = true;
                console.log('[useCourse.submitCourse] ✅ Flag detected - has_related_changes:', formattedData.has_related_changes);
            } else {
                console.log('[useCourse.submitCourse] ❌ No related changes flag set - hasRelatedChanges param is:', hasRelatedChanges);
            }
            
            // ✨ PHASE 4.101.3: Simplified - old files now deleted automatically on upload
            // No need to send unsaved_image_uploads list anymore!
            
            console.log('[useCourse.submitCourse] ===== FULL REQUEST DATA BEING SENT =====');
            console.log('[useCourse.submitCourse] teacher_course_status:', formattedData.teacher_course_status);
            console.log('[useCourse.submitCourse] has_related_changes:', formattedData.has_related_changes);
            console.log('[useCourse.submitCourse] All fields:', formattedData);
            console.log('[useCourse.submitCourse] ===== END REQUEST DATA =====');

            const response = await useAxios.patch(
                `/teacher/course-update/${userData?.teacher_id}/${courseId}/`,
                formattedData
            );

            if (response?.data) {
                Toast().fire({
                    icon: "success",
                    title: "Berhasil",
                    text: "Kursus berhasil diperbarui!",
                });
                
                if (onSuccess) {
                    onSuccess(response.data);
                }
                
                return response.data;
            }
        } catch (error) {
            console.error("Error updating course:", error);
            const errorMessage = error.response?.data?.detail || "Gagal memperbarui kursus. Silakan coba lagi.";
            
            Toast().fire({
                icon: "error",
                title: "Error",
                text: errorMessage,
            });
            
            if (onError) {
                onError(errorMessage);
            }
            
            throw error;
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        submitCourse,
        isSubmitting
    };
};

export const useCategories = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // ✨ PHASE 4.177: Fetch guard to prevent duplicate category loads
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        // ✨ PHASE 4.177: Skip if categories already loaded (prevents duplicates in React Strict Mode)
        if (categories && categories.length > 0) return;
        
        // Guard against multiple fetches in React Strict Mode
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        
        const fetchCategories = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const response = await useAxios.get("/course/category/");
                
                if (response?.data) {
                    // Handle both paginated and direct array responses
                    const data = Array.isArray(response.data) 
                        ? response.data 
                        : (response.data.results || []);
                    
                    setCategories(Array.isArray(data) ? data : []);
                } else {
                    setError("Failed to load categories");
                    setCategories([]);
                }
            } catch (error) {
                console.error("Error fetching categories:", error);
                setError("Failed to load categories");
                setCategories([]);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, [categories?.length]);

    return {
        categories: Array.isArray(categories) ? categories : [],
        loading,
        error
    };
};

export const useTags = () => {
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // ✨ PHASE X: Fetch guard to prevent duplicate tag loads
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        // ✨ PHASE X: Skip if tags already loaded (prevents duplicates in React Strict Mode)
        if (tags && tags.length > 0) return;
        
        // Guard against multiple fetches in React Strict Mode
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        
        const fetchTags = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const response = await useAxios.get("/course/tag/");
                
                if (response?.data) {
                    // Handle both paginated and direct array responses
                    const data = Array.isArray(response.data) 
                        ? response.data 
                        : (response.data.results || []);
                    
                    setTags(Array.isArray(data) ? data : []);
                } else {
                    setError("Failed to load tags");
                    setTags([]);
                }
            } catch (error) {
                console.error("Error fetching tags:", error);
                setError("Failed to load tags");
                setTags([]);
            } finally {
                setLoading(false);
            }
        };

        fetchTags();
    }, [tags?.length]);

    return {
        tags: Array.isArray(tags) ? tags : [],
        loading,
        error
    };
};