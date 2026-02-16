// Course Form Constants
export const COURSE_LEVELS = [
    { value: "Beginner", label: "Beginner" },
    { value: "Intermediate", label: "Intermediate" },
    { value: "Advanced", label: "Advanced" }
];

export const COURSE_STATUS_OPTIONS = [
    { value: "Draft", label: "Draft" },
    { value: "Published", label: "Published" },
    { value: "Disabled", label: "Disabled" }
];

// File Upload Constants
export const FILE_UPLOAD_LIMITS = {
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

// Form Validation Constants
export const VALIDATION_RULES = {
    title: {
        minLength: 10,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\s\-_:&.,!?()]+$/
    },
    description: {
        minLength: 50,
        maxLength: 2000
    }
};

// Default Values
export const DEFAULT_COURSE_DATA = {
    title: '',
    description: '',
    image: '',
    file: '',
    level: '',
    category: '',
    status: 'Draft'
};

// Error Messages
export const ERROR_MESSAGES = {
    required: {
        title: "Course title is required",
        description: "Course description is required",
        category: "Please select a course category",
        level: "Please select a course level",
        image: "Course thumbnail is required"
    },
    invalid: {
        title: "Title contains invalid characters",
        email: "Please enter a valid email address"
    },
    length: {
        titleTooShort: "Title is too short. Consider adding more descriptive words",
        titleTooLong: "Title is too long. Maximum 100 characters allowed",
        descriptionTooShort: "Description is too short. Add more details about your course",
        descriptionTooLong: "Description is very long. Consider making it more concise"
    },
    file: {
        invalidType: "Jenis file tidak valid. Silakan unggah file yang valid.",
        tooLarge: "File terlalu besar. Silakan unggah file yang lebih kecil.",
        uploadFailed: "Gagal mengunggah file. Silakan coba lagi."
    }
};

// Success Messages
export const SUCCESS_MESSAGES = {
    courseUpdated: "Kursus berhasil diperbarui!",
    imageUploaded: "Thumbnail kursus berhasil diperbarui!",
    videoUploaded: "Video kursus berhasil diunggah!",
    fileSaved: "File berhasil disimpan!"
};

// CKEditor Configuration
export const CKEDITOR_CONFIG = {
    toolbar: {
        items: [
            'heading',
            '|',
            'bold',
            'italic',
            'underline',
            'strikethrough',
            '|',
            'bulletedList',
            'numberedList',
            '|',
            'outdent',
            'indent',
            '|',
            'undo',
            'redo',
            '|',
            'link',
            'insertTable',
            'blockQuote',
            '|',
            'fontFamily',
            'fontSize',
            'fontColor',
            'fontBackgroundColor',
            '|',
            'alignment',
            '|',
            'code',
            'codeBlock'
        ]
    },
    image: {
        toolbar: [
            'imageTextAlternative',
            'imageStyle:full',
            'imageStyle:side'
        ]
    },
    table: {
        contentToolbar: [
            'tableColumn',
            'tableRow',
            'mergeTableCells'
        ]
    }
};

// API Endpoints
export const API_ENDPOINTS = {
    fileUpload: "/file-upload/",
    categories: "/course/category/",
    courseDetail: (teacherId, courseId) => `/teacher/course-detail/${teacherId}/${courseId}/`,
    courseUpdate: (teacherId, courseId) => `/teacher/course-update/${teacherId}/${courseId}/`
};

// CSS Classes
export const CSS_CLASSES = {
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
    }
};

// Default Image URLs
export const DEFAULT_IMAGES = {
    courseThumbnail: "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png",
    userAvatar: "/static/default-avatar.png"
};