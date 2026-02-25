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
  // ✨ PHASE 2: Removed file upload validation rules (now using external URLs)
}

export const validateTitle = (title) => {
  const errors = [];
  const warnings = [];

  if (!title.trim()) {
    errors.push("Judul kursus diperlukan");
  } else {
    if (title.length < courseValidationRules.title.minLength) {
      warnings.push("Judul terlalu pendek. Pertimbangkan untuk menambahkan kata-kata yang lebih deskriptif");
    }
    if (title.length > courseValidationRules.title.maxLength) {
      errors.push(`Judul terlalu panjang. Maksimal ${courseValidationRules.title.maxLength} karakter diizinkan`);
    }
    if (!courseValidationRules.title.pattern.test(title)) {
      errors.push("Judul berisi karakter yang tidak valid");
    }
  }

  return { errors, warnings };
};

export const validateDescription = (description) => {
  const errors = [];
  const warnings = [];
  const plainText = description.replace(/<[^>]*>/g, '').trim();

  if (!plainText) {
    errors.push("Deskripsi kursus diperlukan");
  } else {
    if (plainText.length < courseValidationRules.description.minLength) {
      warnings.push("Deskripsi terlalu pendek. Tambahkan lebih banyak detail tentang kursus Anda");
    }
    if (plainText.length > courseValidationRules.description.maxLength) {
      warnings.push("Deskripsi sangat panjang. Pertimbangkan untuk membuatnya lebih ringkas");
    }
  }

  return { errors, warnings };
};

export const validateImage = (image) => {
  const errors = [];
  const warnings = [];

  if (!image) {
    warnings.push("Menambahkan thumbnail meningkatkan daya tarik kursus");
  }

  return { errors, warnings };
};

export const validateCategory = (categoryId) => {
  const errors = [];
  if (!categoryId) {
    errors.push("Silakan pilih kategori kursus");
  }
  return { errors, warnings: [] };
};

export const validateLevel = (level) => {
  const warnings = [];
  if (!level) {
    warnings.push("Menambahkan tingkat kesulitan membantu siswa memilih dengan tepat");
  }
  return { errors: [], warnings };
};

// ✨ PHASE 2: Removed validateFileType() - no longer uploading files to server
// Updated: Using external URLs instead (Google Drive, YouTube, image CDNs)
// Users now provide links directly instead of uploading files

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