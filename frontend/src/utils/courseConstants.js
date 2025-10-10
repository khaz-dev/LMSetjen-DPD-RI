// Course creation constants and configuration

export const COURSE_LEVELS = [
  { value: "", label: "-- Select Level --" },
  { value: "Beginner", label: "🟢 Beginner" },
  { value: "Intermediate", label: "🟡 Intermediate" },
  { value: "Advanced", label: "🔴 Advanced" },
];

export const DEFAULT_COURSE_DATA = {
  title: "", 
  description: "", 
  image: "", 
  file: "", 
  level: "", 
  category: ""
};

export const DEFAULT_IMAGE_URL = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";

export const FILE_SIZE_LIMITS = {
  IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  VIDEO_MAX_SIZE: 100 * 1024 * 1024, // 100MB
};

export const ACCEPTED_FILE_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  VIDEO: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'],
};

export const CKEDITOR_CONFIG = {
  toolbar: [
    "bold", 
    "italic", 
    "link", 
    "bulletedList", 
    "numberedList", 
    "blockQuote", 
    "undo", 
    "redo"
  ],
};

export const TOAST_MESSAGES = {
  IMAGE_UPLOAD_SUCCESS: {
    icon: "success",
    title: "Image Uploaded",
    text: "Course thumbnail uploaded successfully!",
    timer: 2000,
    showConfirmButton: false
  },
  VIDEO_UPLOAD_SUCCESS: {
    icon: "success",
    title: "Video Uploaded",
    text: "Intro video uploaded successfully!",
    timer: 2000,
    showConfirmButton: false
  },
  COURSE_CREATE_SUCCESS: {
    icon: "success",
    title: "Course Created Successfully",
    text: "Your course has been created and you can now add lessons!",
    confirmButtonText: "Continue to Edit Course"
  },
  VALIDATION_ERROR: {
    icon: "error",
    title: "Please Fix the Following Issues",
    confirmButtonText: "Fix Issues"
  },
  UPLOAD_ERROR: {
    icon: "error",
    title: "Upload Failed",
  },
  CATEGORIES_LOAD_ERROR: {
    icon: "error",
    title: "Loading Error",
    text: "Failed to load course categories. Please refresh the page.",
  },
  CREATION_ERROR: {
    icon: "error",
    title: "Creation Failed",
  }
};

export const ERROR_FOCUS_REFS = {
  title: 'titleRef',
  category: 'categoryRef',
  image: 'imageRef',
  level: 'levelRef',
  description: 'ckeditorRef'
};