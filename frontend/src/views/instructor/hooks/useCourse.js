import { useState, useEffect } from "react";
import useAxios from "../../../utils/useAxios";
import UserData from "../../plugin/UserData";
import Toast from "../../plugin/Toast";

export const useCourseData = (courseId) => {
    const [courseData, setCourseData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
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
                setError(error.response?.data?.detail || "Failed to load course data");
                Toast().fire({
                    icon: "error",
                    title: "Error",
                    text: error.response?.data?.detail || "Failed to load course data",
                });
            } finally {
                setLoading(false);
            }
        };

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

    const submitCourse = async (courseData, courseId, onSuccess, onError) => {
        setIsSubmitting(true);

        try {
            const userData = UserData();
            
            // Format the data to ensure compatibility with backend
            const formattedData = {
                ...courseData,
                // Extract category ID if category is an object
                category: typeof courseData.category === 'object' && courseData.category?.id 
                    ? courseData.category.id 
                    : courseData.category,
                // Extract teacher_course_status if it's an object
                teacher_course_status: typeof courseData.teacher_course_status === 'object' && courseData.teacher_course_status?.value
                    ? courseData.teacher_course_status.value
                    : courseData.teacher_course_status
            };

            const response = await useAxios.patch(
                `/teacher/course-update/${userData?.teacher_id}/${courseId}/`,
                formattedData
            );

            if (response?.data) {
                Toast().fire({
                    icon: "success",
                    title: "Success",
                    text: "Course updated successfully!",
                });
                
                if (onSuccess) {
                    onSuccess(response.data);
                }
                
                return response.data;
            }
        } catch (error) {
            console.error("Error updating course:", error);
            const errorMessage = error.response?.data?.detail || "Failed to update course. Please try again.";
            
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

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const response = await useAxios.get("/course/category/");
                
                if (response?.data) {
                    setCategories(response.data);
                } else {
                    setError("Failed to load categories");
                }
            } catch (error) {
                console.error("Error fetching categories:", error);
                setError("Failed to load categories");
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, []);

    return {
        categories,
        loading,
        error
    };
};