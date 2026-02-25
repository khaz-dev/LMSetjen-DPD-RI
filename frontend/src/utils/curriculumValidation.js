// Curriculum-specific validation utilities
// These are similar to course validation but tailored for curriculum editing needs

export const validateCurriculumTitle = (title) => {
    const errors = [];
    const warnings = [];

    if (!title?.trim()) {
        errors.push("Judul kursus diperlukan");
    } else {
        if (title.length < 10) {
            warnings.push("Judul harus lebih deskriptif (minimal 10 karakter)");
        }
        if (title.length > 60) {
            warnings.push("Judul terlalu panjang. Pertahankan di bawah 60 karakter untuk tampilan yang lebih baik");
        }
        if (!/^[a-zA-Z0-9\s\-_:&.,!?()]+$/.test(title)) {
            errors.push("Judul berisi karakter yang tidak valid");
        }
    }

    return { errors, warnings };
};

export const validateCurriculumDescription = (description) => {
    const errors = [];
    const warnings = [];
    const plainText = description?.replace(/<[^>]*>/g, '').trim() || '';

    if (!plainText) {
        errors.push("Deskripsi kursus diperlukan");
    } else {
        if (plainText.length < 30) {
            warnings.push("Deskripsi terlalu pendek. Tambahkan lebih banyak detail tentang kursus Anda");
        }
        if (plainText.length > 1000) {
            warnings.push("Deskripsi cukup panjang. Pertimbangkan untuk membuatnya lebih ringkas");
        }
    }

    return { errors, warnings };
};

export const validateCurriculumImage = (image) => {
    const errors = [];
    const warnings = [];

    if (!image) {
        warnings.push("Menambahkan thumbnail kursus meningkatkan keterlibatan siswa");
    }

    return { errors, warnings };
};

export const validateCurriculumCategory = (categoryId) => {
    const errors = [];
    const warnings = [];

    if (!categoryId) {
        errors.push("Silakan pilih kategori kursus");
    }

    return { errors, warnings };
};

export const validateCurriculumLevel = (level) => {
    const errors = [];
    const warnings = [];

    if (!level) {
        warnings.push("Menetapkan tingkat kesulitan membantu siswa memilih dengan tepat");
    }

    return { errors, warnings };
};

export const validateCurriculumIntroVideo = (file) => {
    const errors = [];
    const warnings = [];

    if (!file) {
        warnings.push("Video pengantar dapat secara signifikan meningkatkan keterlibatan kursus");
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