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
    title: "Gambar Berhasil Diunggah",
    text: "Thumbnail kursus berhasil diunggah!",
    timer: 2000,
    showConfirmButton: false
  },
  VIDEO_UPLOAD_SUCCESS: {
    icon: "success",
    title: "Video Berhasil Diunggah",
    text: "Video pengantar berhasil diunggah!",
    timer: 2000,
    showConfirmButton: false
  },
  COURSE_CREATE_SUCCESS: {
    icon: "success",
    title: "Kursus Berhasil Dibuat",
    text: "Kursus Anda telah dibuat dan Anda sekarang dapat menambahkan pelajaran!",
    confirmButtonText: "Lanjutkan ke Edit Kursus"
  },
  VALIDATION_ERROR: {
    icon: "error",
    title: "Silakan Perbaiki Masalah Berikut",
    confirmButtonText: "Perbaiki"
  },
  UPLOAD_ERROR: {
    icon: "error",
    title: "Unggahan Gagal",
  },
  CATEGORIES_LOAD_ERROR: {
    icon: "error",
    title: "Kesalahan Memuat",
    text: "Gagal memuat kategori kursus. Silakan segarkan halaman.",
  },
  CREATION_ERROR: {
    icon: "error",
    title: "Pembuatan Gagal",
  }
};

export const ERROR_FOCUS_REFS = {
  title: 'titleRef',
  category: 'categoryRef',
  image: 'imageRef',
  level: 'levelRef',
  description: 'ckeditorRef'
};