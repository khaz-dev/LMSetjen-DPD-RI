// Course Edit Validation Utilities

export const validateTitle = (title) => {
    const errors = [];
    const warnings = [];

    if (!title?.trim()) {
        errors.push("Course title is required");
    } else {
        if (title.length < 10) {
            warnings.push("Title is too short. Consider adding more descriptive words");
        }
        if (title.length > 100) {
            errors.push("Title is too long. Maximum 100 characters allowed");
        }
        if (!/^[a-zA-Z0-9\s\-_:&.,!?()]+$/.test(title)) {
            errors.push("Title contains invalid characters");
        }
    }

    return { errors, warnings };
};

export const validateDescription = (description) => {
    const errors = [];
    const warnings = [];
    const plainText = description?.replace(/<[^>]*>/g, '').trim() || '';

    if (!plainText) {
        errors.push("Course description is required");
    } else {
        if (plainText.length < 50) {
            warnings.push("Description is too short. Add more details about your course");
        }
        if (plainText.length > 2000) {
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

export const validateAllFields = (courseData) => {
    const allErrors = {};
    const allWarnings = {};
    
    // Validate all required fields
    const titleValidation = validateTitle(courseData?.title);
    const descriptionValidation = validateDescription(courseData?.description);
    const categoryValidation = validateCategory(courseData?.category?.id || courseData?.category);
    const imageValidation = validateImage(courseData?.image);
    const levelValidation = validateLevel(courseData?.level);

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
    const baseClass = "form-control";
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
    const baseClass = "form-select";
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