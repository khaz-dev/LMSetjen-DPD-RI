import { useState } from "react";

// ✨ PHASE 2: Removed useFileUpload() hook - no longer needed (using external URLs instead)
// Updated: Feature removed to optimize memory usage (no file uploads to server)

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