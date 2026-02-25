import { useState, useEffect, useRef } from "react";
import useAxios from "../../../../utils/useAxios";
import UserData from "../../../plugin/UserData";
import Toast from "../../../plugin/Toast";

export const useCurriculumData = (courseId) => {
    const [courseData, setCourseData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCourseDetail = async () => {
        if (!courseId) return;
        
        try {
            setLoading(true);
            setError(null);
            
            const userData = UserData();
            const teacherId = userData?.teacher_id;
            
            // Use the correct endpoint with teacher_id
            const response = await useAxios.get(`teacher/course-detail/${teacherId}/${courseId}/`);
            
            if (response?.data) {
                setCourseData(response.data);
            } else {
                setError("Course not found");
            }
        } catch (error) {
            console.error("Error fetching course details:", error);
            setError(error.response?.data?.detail || "Failed to load course data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourseDetail();
    }, [courseId]);

    const updateCourseData = (updates) => {
        setCourseData(prevData => ({
            ...prevData,
            ...updates
        }));
    };

    const refreshCourseData = () => {
        fetchCourseDetail();
    };

    return {
        courseData,
        setCourseData,
        updateCourseData,
        refreshCourseData,
        loading,
        error
    };
};

export const useCurriculumForm = (initialData = {}) => {
    const [errors, setErrors] = useState({});
    const [warnings, setWarnings] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validateField = (fieldName, value, validationFunction) => {
        if (!validationFunction) return;
        
        const result = validationFunction(value);
        
        setErrors(prev => ({
            ...prev,
            [fieldName]: result.errors || []
        }));
        
        setWarnings(prev => ({
            ...prev,
            [fieldName]: result.warnings || []
        }));

        return result.errors?.length === 0;
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

    return {
        errors,
        warnings,
        isSubmitting,
        setIsSubmitting,
        validateField,
        clearFieldErrors,
        clearAllErrors,
        hasErrors
    };
};

export const useCurriculumFileUpload = () => {
    const [imageLoading, setImageLoading] = useState(false);
    const [fileLoading, setFileLoading] = useState(false);

    const uploadFile = async (file, fileType = 'image') => {
        const setLoading = fileType === 'image' ? setImageLoading : setFileLoading;
        
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
                return response.data.url;
            } else {
                throw new Error("Upload failed - no URL returned");
            }
        } catch (error) {
            console.error("Error uploading file:", error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return {
        uploadFile,
        imageLoading,
        fileLoading,
        setImageLoading,
        setFileLoading
    };
};

export const useCurriculumSubmit = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submitCurriculum = async (courseData, courseId, onSuccess, onError) => {
        setIsSubmitting(true);

        try {
            // Get teacher ID from user data
            const userData = UserData();
            const teacherId = userData?.teacher_id;

            if (!teacherId || teacherId === 0) {
                const errorMsg = "Teacher profile not found. Please ensure you have a teacher account.";
                Toast().fire({
                    icon: "error",
                    title: "Authentication Error", 
                    text: errorMsg,
                });
                if (onError) onError(errorMsg);
                return;
            }

            const json = {
                title: courseData?.title,
                description: courseData?.description,
                image: courseData?.image,
                file: courseData?.file,
                level: courseData?.level,
                category: courseData?.category?.id || courseData?.category,
            };

            const response = await useAxios.patch(
                `teacher/course-update/${teacherId}/${courseId}/`, 
                json
            );
            
            Toast().fire({
                icon: "success",
                title: "Kursus Berhasil Diperbarui",
                text: "Kursus Anda telah berhasil diperbarui!",
            });
            
            if (onSuccess) {
                onSuccess(response.data);
            }
            
            return response.data;
        } catch (error) {
            console.error("Error updating course:", error);
            
            const errorMessage = error.response?.data?.message || 
                               error.response?.data?.detail || 
                               "Failed to update course. Please try again.";
            
            Toast().fire({
                icon: "error",
                title: "Update Failed",
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
        submitCurriculum,
        isSubmitting
    };
};

export const useCurriculumCategories = () => {
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
    }, [categories?.length]);

    return {
        categories,
        loading,
        error
    };
};
        
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