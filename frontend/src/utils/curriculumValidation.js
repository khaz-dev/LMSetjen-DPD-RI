// Curriculum-specific validation utilities
// These are similar to course validation but tailored for curriculum editing needs

export const validateCurriculumTitle = (title) => {
    const errors = [];
    const warnings = [];

    if (!title?.trim()) {
        errors.push("Course title is required");
    } else {
        if (title.length < 10) {
            warnings.push("Title should be more descriptive (at least 10 characters)");
        }
        if (title.length > 60) {
            warnings.push("Title is too long. Keep it under 60 characters for better display");
        }
        if (!/^[a-zA-Z0-9\s\-_:&.,!?()]+$/.test(title)) {
            errors.push("Title contains invalid characters");
        }
    }

    return { errors, warnings };
};

export const validateCurriculumDescription = (description) => {
    const errors = [];
    const warnings = [];
    const plainText = description?.replace(/<[^>]*>/g, '').trim() || '';

    if (!plainText) {
        errors.push("Course description is required");
    } else {
        if (plainText.length < 30) {
            warnings.push("Description is too short. Add more details about your course");
        }
        if (plainText.length > 1000) {
            warnings.push("Description is quite long. Consider making it more concise");
        }
    }

    return { errors, warnings };
};

export const validateCurriculumImage = (image) => {
    const errors = [];
    const warnings = [];

    if (!image) {
        warnings.push("Adding a course thumbnail improves student engagement");
    }

    return { errors, warnings };
};

export const validateCurriculumCategory = (categoryId) => {
    const errors = [];
    const warnings = [];

    if (!categoryId) {
        errors.push("Please select a course category");
    }

    return { errors, warnings };
};

export const validateCurriculumLevel = (level) => {
    const errors = [];
    const warnings = [];

    if (!level) {
        warnings.push("Setting a difficulty level helps students choose appropriately");
    }

    return { errors, warnings };
};

export const validateCurriculumIntroVideo = (file) => {
    const errors = [];
    const warnings = [];

    if (!file) {
        warnings.push("An intro video can significantly improve course engagement");
    }

    return { errors, warnings };
};

export const validateAllCurriculumFields = (courseData) => {
    const errors = {};
    const warnings = {};
    let hasErrors = false;

    // Validate each field
    const titleValidation = validateCurriculumTitle(courseData.title);
    const descriptionValidation = validateCurriculumDescription(courseData.description);
    const imageValidation = validateCurriculumImage(courseData.image);
    const categoryValidation = validateCurriculumCategory(courseData.category);
    const levelValidation = validateCurriculumLevel(courseData.level);
    const videoValidation = validateCurriculumIntroVideo(courseData.file);

    // Collect errors and warnings
    errors.title = titleValidation.errors;
    warnings.title = titleValidation.warnings;
    
    errors.description = descriptionValidation.errors;
    warnings.description = descriptionValidation.warnings;
    
    errors.image = imageValidation.errors;
    warnings.image = imageValidation.warnings;
    
    errors.category = categoryValidation.errors;
    warnings.category = categoryValidation.warnings;
    
    errors.level = levelValidation.errors;
    warnings.level = levelValidation.warnings;
    
    errors.file = videoValidation.errors;
    warnings.file = videoValidation.warnings;

    // Check if there are any errors
    hasErrors = Object.values(errors).some(fieldErrors => fieldErrors.length > 0);

    return {
        errors,
        warnings,
        hasErrors
    };
};

export const getCurriculumValidationClass = (fieldName, errors, warnings, courseData, baseClass = "form-control") => {
    if (errors[fieldName]?.length > 0) {
        return `${baseClass} is-invalid`;
    }
    if (warnings[fieldName]?.length > 0) {
        return `${baseClass} is-warning`;
    }
    if (courseData?.[fieldName]) {
        return `${baseClass} is-valid`;
    }
    return baseClass;
};

export const getCurriculumSelectValidationClass = (fieldName, errors, warnings, courseData) => {
    return getCurriculumValidationClass(fieldName, errors, warnings, courseData, "form-select");
};