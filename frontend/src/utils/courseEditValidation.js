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

export const validateAllFields = (courseData = {}) => {
    const allErrors = {};
    const allWarnings = {};
    const data = courseData || {};
    
    // Validate all required fields
    const titleValidation = validateTitle(data.title);
    const descriptionValidation = validateDescription(data.description);
    const categoryValidation = validateCategory(data.category?.id || data.category);
    const imageValidation = validateImage(data.image);
    const levelValidation = validateLevel(data.level);

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
    if (errors?.[fieldName]?.length > 0) {
        return `${baseClass} is-invalid`;
    }
    if (warnings?.[fieldName]?.length > 0) {
        return `${baseClass} is-warning`;
    }
    if (value) {
        return `${baseClass} is-valid`;
    }
    return baseClass;
};

export const getSelectValidationClass = (fieldName, errors, warnings, value) => {
    const baseClass = "form-select";
    if (errors?.[fieldName]?.length > 0) {
        return `${baseClass} is-invalid`;
    }
    if (warnings?.[fieldName]?.length > 0) {
        return `${baseClass} is-warning`;
    }
    if (value) {
        return `${baseClass} is-valid`;
    }
    return baseClass;
};

/**
 * Detect active regular quizzes not yet embedded in the curriculum.
 * Pre/Post-tests are excluded because they are automatically included at course level.
 * Inactive quizzes (is_active === false) are also excluded.
 * 
 * @param {Object} courseData
 * @returns {Array} Array of unassigned active quiz objects
 */
export const getUnassignedActiveQuizzes = (courseData) => {
    if (!courseData) return [];

    const embeddedQuizIds = new Set();
    const curriculum = Array.isArray(courseData.curriculum) ? courseData.curriculum : [];

    curriculum.forEach(section => {
        const items = section?.variant_items || section?.items || [];
        if (Array.isArray(items)) {
            items.forEach(item => {
                const qId = item?.quiz_id ||
                    (item?.quiz && typeof item.quiz === 'object' ? item.quiz.quiz_id : (item?.quiz || null)) ||
                    (item?.quiz_detail && item.quiz_detail.quiz_id ? item.quiz_detail.quiz_id : null);
                if (qId !== null && qId !== undefined && qId !== '') {
                    embeddedQuizIds.add(String(qId));
                }
                if (item?.quiz && typeof item.quiz === 'object' && item?.quiz?.id !== undefined) {
                    embeddedQuizIds.add(String(item.quiz.id));
                }
            });
        }
    });

    const quizzes = Array.isArray(courseData.quizzes) ? courseData.quizzes : [];
    return quizzes.filter(quiz => {
        if (!quiz) return false;

        // Exclude Pre/Post-test quizzes
        const isPrePost = quiz.quiz_type === 'pre_post_test' || quiz.has_pre_test || quiz.has_post_test;
        if (isPrePost) return false;

        // Only check active quizzes (default is true if undefined)
        const isActive = quiz.is_active !== false;
        if (!isActive) return false;

        const quizIdStr = quiz.quiz_id !== undefined && quiz.quiz_id !== null ? String(quiz.quiz_id) : null;
        const idStr = quiz.id !== undefined && quiz.id !== null ? String(quiz.id) : null;

        const isEmbedded = (quizIdStr && embeddedQuizIds.has(quizIdStr)) || (idStr && embeddedQuizIds.has(idStr));
        return !isEmbedded;
    });
};
