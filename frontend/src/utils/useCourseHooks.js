import { useState } from "react";
import { validateFileType } from "./courseValidation";
import useAxios from "./useAxios";
import Toast from "../views/plugin/Toast";
import { TOAST_MESSAGES } from "./courseConstants";

export const useFileUpload = () => {
  const [loading, setLoading] = useState(false);

  const uploadFile = async (file, type = 'image') => {
    if (!file) return { success: false, url: null };

    // Validate file type and size
    const validation = validateFileType(file, type);
    if (!validation.isValid) {
      Toast().fire({
        ...TOAST_MESSAGES.UPLOAD_ERROR,
        text: validation.error,
      });
      return { success: false, url: null };
    }

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
        const successMessage = type === 'image' 
          ? TOAST_MESSAGES.IMAGE_UPLOAD_SUCCESS 
          : TOAST_MESSAGES.VIDEO_UPLOAD_SUCCESS;
        
        Toast().fire(successMessage);
        
        return { success: true, url: response.data.url };
      }
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      Toast().fire({
        ...TOAST_MESSAGES.UPLOAD_ERROR,
        text: error.response?.data?.message || `Failed to upload ${type}. Please try again.`,
      });
      return { success: false, url: null };
    } finally {
      setLoading(false);
    }

    return { success: false, url: null };
  };

  return { uploadFile, loading };
};

export const useCourseValidation = () => {
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});

  const validateField = (fieldName, value) => {
    // This would be imported from courseValidation.js
    // Implementation would go here based on field type
  };

  const clearFieldValidation = (fieldName) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: []
    }));
    setWarnings(prev => ({
      ...prev,
      [fieldName]: []
    }));
  };

  const clearAllValidation = () => {
    setErrors({});
    setWarnings({});
  };

  return {
    errors,
    warnings,
    validateField,
    clearFieldValidation,
    clearAllValidation,
    setErrors,
    setWarnings
  };
};