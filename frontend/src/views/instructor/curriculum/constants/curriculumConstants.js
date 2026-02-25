// Curriculum-specific constants for course editing

// Course Levels
export const CURRICULUM_LEVELS = [
    { value: "Beginner", label: "Beginner" },
    { value: "Intermediate", label: "Intermediate" },
    { value: "Advanced", label: "Advanced" }
];

// File Upload Limits for Curriculum
export const CURRICULUM_FILE_LIMITS = {
    image: {
        maxSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    },
    video: {
        maxSize: 100 * 1024 * 1024, // 100MB
        allowedTypes: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'],
        allowedExtensions: ['.mp4', '.avi', '.mov', '.wmv']
    }
};

// Validation Rules for Curriculum
export const CURRICULUM_VALIDATION_RULES = {
    title: {
        minLength: 10,
        maxLength: 60,
        pattern: /^[a-zA-Z0-9\s\-_:&.,!?()]+$/
    },
    description: {
        minLength: 30,
        maxLength: 1000
    }
};

// Default Values for Curriculum
export const DEFAULT_CURRICULUM_DATA = {
    title: '',
    description: '',
    image: '',
    file: '',
    level: '',
    category: ''
};

// Error Messages for Curriculum
export const CURRICULUM_ERROR_MESSAGES = {
    required: {
        title: "Judul kursus diperlukan",
        description: "Deskripsi kursus diperlukan",
        category: "Silakan pilih kategori kursus"
    },
    invalid: {
        title: "Judul berisi karakter yang tidak valid",
        fileType: "Jenis file tidak valid. Silakan unggah file yang valid.",
        fileSize: "File terlalu besar. Silakan unggah file yang lebih kecil."
    },
    length: {
        titleTooShort: "Judul harus lebih deskriptif (minimal 10 karakter)",
        titleTooLong: "Judul terlalu panjang. Pertahankan di bawah 60 karakter untuk tampilan yang lebih baik",
        descriptionTooShort: "Deskripsi terlalu pendek. Tambahkan lebih banyak detail tentang kursus Anda",
        descriptionTooLong: "Deskripsi cukup panjang. Pertimbangkan untuk membuatnya lebih ringkas"
    },
    upload: {
        failed: "Gagal mengunggah file. Silakan coba lagi.",
        invalidImage: "Silakan unggah file gambar yang valid (JPEG, PNG, GIF, atau WebP)",
        invalidVideo: "Silakan unggah file video yang valid (MP4, AVI, MOV, atau WMV)",
        imageTooLarge: "Silakan unggah gambar dengan ukuran lebih kecil dari 5MB",
        videoTooLarge: "Silakan unggah video dengan ukuran lebih kecil dari 100MB"
    }
};

// Success Messages for Curriculum
export const CURRICULUM_SUCCESS_MESSAGES = {
    courseUpdated: "Kursus berhasil diperbarui!",
    imageUploaded: "Thumbnail kursus berhasil diperbarui!",
    videoUploaded: "Video pengantar kursus berhasil diunggah!",
    dataLoaded: "Data kursus berhasil dimuat!"
};

// CKEditor Configuration for Curriculum
export const CURRICULUM_CKEDITOR_CONFIG = {
    toolbar: [
        "heading",
        "|",
        "bold", "italic", "underline",
        "|", 
        "bulletedList", "numberedList",
        "|",
        "link", "blockQuote",
        "|",
        "undo", "redo"
    ],
    placeholder: "Write a brief summary of your course..."
};

// API Endpoints for Curriculum
export const CURRICULUM_API_ENDPOINTS = {
    fileUpload: "/file-upload/",
    categories: "/course/category/",
    courseDetail: (teacherId, courseId) => `teacher/course-detail/${teacherId}/${courseId}/`,
    courseUpdate: (teacherId, courseId) => `teacher/course-update/${teacherId}/${courseId}/`
};

// CSS Classes for Curriculum
export const CURRICULUM_CSS_CLASSES = {
    validation: {
        base: "form-control",
        invalid: "form-control is-invalid",
        valid: "form-control is-valid",
        warning: "form-control is-warning"
    },
    select: {
        base: "form-select",
        invalid: "form-select is-invalid",
        valid: "form-select is-valid",
        warning: "form-select is-warning"
    },
    editor: {
        base: "",
        invalid: "border border-danger rounded",
        valid: "border border-success rounded",
        warning: "border border-warning rounded"
    }
};

// Default Images for Curriculum
export const CURRICULUM_DEFAULT_IMAGES = {
    courseThumbnail: "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png"
};

// Form Field Labels
export const CURRICULUM_LABELS = {
    title: "Title",
    category: "Course Category", 
    level: "Level",
    description: "Course Description",
    image: "Course Thumbnail",
    video: "Intro Video"
};

// Help Text for Form Fields
export const CURRICULUM_HELP_TEXT = {
    title: "Write a compelling course title (60 characters recommended)",
    category: "Help people find your courses by choosing categories that represent your course.",
    level: "Choose the appropriate difficulty level for your course.",
    description: "A brief summary of your course content and learning objectives.",
    image: "Upload a course thumbnail image (JPG, PNG, GIF, or WebP - Max 5MB)",
    video: "Upload an intro video for your course (MP4, AVI, MOV, or WMV - Max 100MB)"
};