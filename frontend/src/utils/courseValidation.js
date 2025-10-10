// Course creation validation utilities

export const courseValidationRules = {
  title: {
    minLength: 10,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-_:&.,!?()]+$/,
  },
  description: {
    minLength: 50,
    maxLength: 2000,
  },
  image: {
    validTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  video: {
    validTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'],
    maxSize: 100 * 1024 * 1024, // 100MB
  },
};

export const validateTitle = (title) => {
  const errors = [];
  const warnings = [];

  if (!title.trim()) {
    errors.push("Course title is required");
  } else {
    if (title.length < courseValidationRules.title.minLength) {
      warnings.push("Title is too short. Consider adding more descriptive words");
    }
    if (title.length > courseValidationRules.title.maxLength) {
      errors.push(`Title is too long. Maximum ${courseValidationRules.title.maxLength} characters allowed`);
    }
    if (!courseValidationRules.title.pattern.test(title)) {
      errors.push("Title contains invalid characters");
    }
  }

  return { errors, warnings };
};

export const validateDescription = (description) => {
  const errors = [];
  const warnings = [];
  const plainText = description.replace(/<[^>]*>/g, '').trim();

  if (!plainText) {
    errors.push("Course description is required");
  } else {
    if (plainText.length < courseValidationRules.description.minLength) {
      warnings.push("Description is too short. Add more details about your course");
    }
    if (plainText.length > courseValidationRules.description.maxLength) {
      warnings.push("Description is very long. Consider making it more concise");
    }
  }

  return { errors, warnings };
};

export const validateImage = (image) => {
  const errors = [];
  const warnings = [];

  if (!image) {
    warnings.push("Adding a thumbnail increases course appeal");
  }

  return { errors, warnings };
};

export const validateCategory = (categoryId) => {
  const errors = [];
  if (!categoryId) {
    errors.push("Please select a course category");
  }
  return { errors, warnings: [] };
};

export const validateLevel = (level) => {
  const warnings = [];
  if (!level) {
    warnings.push("Adding a difficulty level helps students choose appropriately");
  }
  return { errors: [], warnings };
};

export const validateFileType = (file, type = 'image') => {
  const rules = courseValidationRules[type];
  
  if (!rules.validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Please upload a valid ${type} file (${rules.validTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')})`,
    };
  }

  // For videos, be more lenient since we have compression
  if (type === 'video') {
    const maxReasonableSize = 500 * 1024 * 1024; // 500MB reasonable limit
    if (file.size > maxReasonableSize) {
      return {
        isValid: false,
        error: `Video file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum reasonable size is 500MB.`,
      };
    }
    // For videos over 100MB, show a warning but allow upload (compression will handle it)
    if (file.size > rules.maxSize) {
      return {
        isValid: true,
        warning: `Video is ${(file.size / (1024 * 1024)).toFixed(1)}MB and will be automatically compressed during upload.`,
      };
    }
  } else {
    // For non-video files, keep original size validation
    if (file.size > rules.maxSize) {
      const maxSizeMB = rules.maxSize / (1024 * 1024);
      return {
        isValid: false,
        error: `Please upload a ${type} smaller than ${maxSizeMB}MB`,
      };
    }
  }

  return { isValid: true, error: null };
};

export const validateAllFields = (courseData) => {
  const allErrors = {};
  const allWarnings = {};
  
  // Validate all required fields
  const titleValidation = validateTitle(courseData.title);
  const descriptionValidation = validateDescription(courseData.description);
  const categoryValidation = validateCategory(courseData.category);
  const imageValidation = validateImage(courseData.image);
  const levelValidation = validateLevel(courseData.level);

  allErrors.title = titleValidation.errors;
  allErrors.description = descriptionValidation.errors;
  allErrors.category = categoryValidation.errors;
  allErrors.image = imageValidation.errors;
  allErrors.level = levelValidation.errors;

  allWarnings.title = titleValidation.warnings;
  allWarnings.description = descriptionValidation.warnings;
  allWarnings.category = categoryValidation.warnings;
  allWarnings.image = imageValidation.warnings;
  allWarnings.level = levelValidation.warnings;

  // Get fields with errors
  const errorFields = Object.keys(allErrors).filter(key => allErrors[key].length > 0);
  
  return { allErrors, allWarnings, errorFields };
};

export const getValidationClass = (fieldName, errors, warnings, value) => {
  const baseClass = "form-control-modern";
  if (errors[fieldName]?.length > 0) {
    return `${baseClass} is-invalid`;
  }
  if (warnings[fieldName]?.length > 0) {
    return `${baseClass} is-warning`;
  }
  if (value) {
    return `${baseClass} is-valid`;
  }
  return baseClass;
};

export const getSelectValidationClass = (fieldName, errors, warnings, value) => {
  const baseClass = "form-control-modern";
  if (errors[fieldName]?.length > 0) {
    return `${baseClass} is-invalid`;
  }
  if (warnings[fieldName]?.length > 0) {
    return `${baseClass} is-warning`;
  }
  if (value) {
    return `${baseClass} is-valid`;
  }
  return baseClass;
};