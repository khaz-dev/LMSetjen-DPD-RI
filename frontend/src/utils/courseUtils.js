// Course utilities
import { getMediaUrl, DEFAULT_IMAGE_URL } from './constants';

// ✨ PHASE 4.X: Extract Google Drive file ID from various URL formats
const extractGoogleDriveFileId = (url) => {
    try {
        // Format 1: https://drive.google.com/file/d/FILE_ID/view...
        const match1 = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match1 && match1[1]) return match1[1];
        
        // Format 2: https://drive.google.com/uc?id=FILE_ID or ?export=view&id=FILE_ID
        const match2 = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
        if (match2 && match2[1]) return match2[1];
        
        return null;
    } catch {
        return null;
    }
};

// ✨ PHASE 4.X: Convert Google Drive URLs to thumbnail format for proper image loading
const convertGoogleDriveUrlToThumbnail = (url) => {
    if (!url || !url.includes('drive.google.com')) {
        return url;
    }
    
    const fileId = extractGoogleDriveFileId(url);
    if (fileId) {
        // Use Google Drive's unofficial but reliable thumbnail endpoint
        // sz=w1200 provides high-quality thumbnail suitable for course thumbnails
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
    }
    
    return url;
};

export const getImageUrl = (imageUrl) => {
    if (!imageUrl) {
        return DEFAULT_IMAGE_URL;
    }
    
    let cleanUrl = imageUrl;
    
    // If it contains encoded URLs, decode and extract the actual path
    if (cleanUrl.includes('%3A') || cleanUrl.includes('http%3A')) {
        cleanUrl = decodeURIComponent(cleanUrl);
    }
    
    // ✨ PHASE 4.X: Handle Google Drive URLs specially - convert to thumbnail format
    if (cleanUrl.includes('drive.google.com')) {
        return convertGoogleDriveUrlToThumbnail(cleanUrl);
    }
    
    // If it's already a complete URL, return as is
    // Must check BEFORE trying to extract media path, since full URLs contain /media/
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        return cleanUrl;
    }
    
    // Extract the /media/... part if it's a nested URL structure (for relative paths)
    // ✨ PHASE 4.40: Fixed to preserve /media/ prefix
    const mediaPattern = /\/media\//;
    if (mediaPattern.test(cleanUrl)) {
        const parts = cleanUrl.split('/media/');
        if (parts.length > 1) {
            // Keep the /media/ prefix!
            cleanUrl = '/media/' + parts[parts.length - 1];
        }
    }
    
    // Use getMediaUrl from constants.js for proper URL construction
    return getMediaUrl(cleanUrl);
};

export const getStatusBadgeStyle = (status) => {
    // ✨ PHASE 11.X: Updated to Teal color palette (Tailwind v3.0.7)
    const styles = {
        Published: 'linear-gradient(135deg, #0d9488, #0f766e)',      // Teal-600 to Teal-700
        Draft: 'linear-gradient(135deg, #2dd4bf, #0d9488)',          // Teal-400 to Teal-600
        Review: 'linear-gradient(135deg, #14b8a6, #0d9488)',         // Teal-500 to Teal-600
        Disabled: 'linear-gradient(135deg, #115e59, #134e4a)',       // Teal-800 to Teal-900
        default: 'linear-gradient(135deg, #0d9488, #0f766e)'         // Teal default
    };
    return styles[status] || styles.default;
};

export const getLevelBadgeStyle = (level) => {
    // ✨ PHASE 11.X: Updated to Teal color palette with varying brightness
    const styles = {
        Beginner: 'linear-gradient(135deg, #2dd4bf, #14b8a6)',       // Teal-400 to Teal-500 (lightest)
        Intermediate: 'linear-gradient(135deg, #0d9488, #0f766e)',   // Teal-600 to Teal-700 (mid)
        Advanced: 'linear-gradient(135deg, #115e59, #134e4a)',       // Teal-800 to Teal-900 (darkest)
        default: 'linear-gradient(135deg, #0d9488, #0f766e)'         // Teal default
    };
    return styles[level] || styles.default;
};

export const getLevelText = (level) => {
    const texts = {
        Beginner: '🟢 Pemula',
        Intermediate: '🟡 Menengah',
        Advanced: '🔴 Lanjutan',
        beginner: '🟢 Pemula',
        intermediate: '🟡 Menengah',
        advanced: '🔴 Lanjutan',
        default: 'N/A'
    };
    return texts[level] || texts.default;
};

export const getStatusText = (status) => {
    const texts = {
        Draft: 'Draf',
        Published: 'Dipublikasikan',
        Disabled: 'Dinonaktifkan',
        Review: 'Ditinjau',
        draft: 'Draf',
        published: 'Dipublikasikan',
        disabled: 'Dinonaktifkan',
        review: 'Ditinjau',
        default: 'Tidak Tersedia'
    };
    return texts[status] || texts.default;
};

/**
 * ✨ PHASE 11.X: Updated - Determine actual course status based on platform_status and rejection_reason
 * Color scheme updated to Teal palette (Tailwind v3.0.7)
 * Priority:
 * 1. If rejection_reason exists or platform_status === 'Rejected' → Ditolak (Rejected) - Teal-800
 * 2. If platform_status === 'Review' or teacher_course_status === 'Review' → Ditinjau (Review) - Teal-500
 * 3. If teacher_course_status === 'Draft' → Draf (Draft) - Teal-400
 * 4. If platform_status === 'Published' → Dipublikasikan (Published) - Teal-600
 * 5. Default to Tidak Tersedia - Gray
 */
export const getActualCourseStatus = (course) => {
    if (!course) {
        return {
            status: 'Unknown',
            text: 'Tidak Tersedia',
            icon: 'fa-question-circle',
            color: '#6c757d'
        };
    }

    // Check if course has been rejected
    if (course.rejection_reason || course.platform_status === 'Rejected') {
        return {
            status: 'Rejected',
            text: 'Ditolak',
            icon: 'fa-times-circle',
            color: '#115e59'  // Teal-800 for error
        };
    }

    // Check if course is in review
    if (course.platform_status === 'Review' || course.teacher_course_status === 'Review') {
        return {
            status: 'Review',
            text: 'Menunggu Review',
            icon: 'fa-hourglass-half',
            color: '#14b8a6'  // Teal-500 for pending
        };
    }

    // Check if course is draft
    if (course.teacher_course_status === 'Draft') {
        return {
            status: 'Draft',
            text: 'Draf',
            icon: 'fa-clock',
            color: '#2dd4bf'  // Teal-400 for draft
        };
    }

    // Check if course is published
    if (course.platform_status === 'Published') {
        return {
            status: 'Published',
            text: 'Dipublikasikan',
            icon: 'fa-check-circle',
            color: '#0d9488'  // Teal-600 for published
        };
    }

    // Default
    return {
        status: 'Unknown',
        text: 'Tidak Tersedia',
        icon: 'fa-question-circle',
        color: '#6c757d'  // Gray for unknown
    };
};

export const handleDeleteCourse = async (courseId, courseName, onSuccess) => {
    // Dynamic import to avoid circular dependencies
    const { default: Swal } = await import('sweetalert2');
    const { DeleteConfirmation } = await import('../views/plugin/Toast');
    const useAxios = (await import('./useAxios')).default;
    
    try {
        // Show enhanced delete confirmation dialog
        const result = await DeleteConfirmation({
            title: 'Hapus Kursus?',
            text: `Anda akan menghapus secara permanen "${courseName}". Ini akan menghapus semua konten terkait termasuk kurikulum, pelajaran, kuis, dan pendaftaran peserta. Tindakan ini tidak dapat dibatalkan.`
        });
        
        if (result.isConfirmed) {
            // Show loading indicator
            Swal.fire({
                title: 'Menghapus Kursus...',
                html: `
                    <div style="text-align: center;">
                        <div class="spinner-border text-danger mb-3" role="status" style="width: 3rem; height: 3rem;">
                            <span class="visually-hidden">Memproses...</span>
                        </div>
                        <p style="color: #4a5568; font-size: 1rem;">
                            Menghapus "${courseName}" dan semua data terkait...
                        </p>
                        <small style="color: #718096;">Harap tunggu, ini mungkin membutuhkan waktu beberapa saat.</small>
                    </div>
                `,
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                customClass: {
                    popup: 'modern-toast modern-toast-dialog',
                    htmlContainer: 'modern-swal-html'
                },
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            try {
                // Make DELETE request to backend
                const response = await useAxios.delete(`teacher/course-detail/${courseId}/`);
                
                // Success notification
                await Swal.fire({
                    title: 'Kursus Berhasil Dihapus!',
                    html: `
                        <div style="text-align: center;">
                            <i class="fas fa-check-circle text-success mb-3" style="font-size: 3rem;"></i>
                            <p style="color: #4a5568; font-size: 1rem; margin-bottom: 0.5rem;">
                                <strong>"${courseName}"</strong> telah berhasil dihapus.
                            </p>
                            <small style="color: #718096;">
                                Semua konten terkait telah dihapus dari sistem.
                            </small>
                        </div>
                    `,
                    icon: 'success',
                    iconColor: '#28a745',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#28a745',
                    timer: 5174,
                    timerProgressBar: true,
                    customClass: {
                        popup: 'modern-toast modern-toast-dialog',
                        title: 'modern-swal-title',
                        htmlContainer: 'modern-swal-html'
                    }
                });
                
                // Call success callback to refresh the course list
                if (onSuccess && typeof onSuccess === 'function') {
                    onSuccess();
                } else {
                    // If no callback provided, reload the page
                    window.location.reload();
                }
                
            } catch (error) {
                console.error('Error deleting course:', error);
                
                // Determine error message
                let errorMessage = 'Gagal menghapus kursus. Silakan coba lagi.';
                let errorDetails = '';
                
                if (error.response) {
                    // Server responded with error
                    if (error.response.status === 404) {
                        errorMessage = 'Kursus tidak ditemukan. Mungkin sudah dihapus sebelumnya.';
                    } else if (error.response.status === 403) {
                        errorMessage = 'Anda tidak memiliki izin untuk menghapus kursus ini.';
                    } else if (error.response.status === 400) {
                        errorMessage = 'Tidak dapat menghapus kursus. Silakan periksa apakah ada ketergantungan.';
                    }
                    
                    if (error.response.data?.error) {
                        errorDetails = error.response.data.error;
                    } else if (error.response.data?.detail) {
                        errorDetails = error.response.data.detail;
                    }
                } else if (error.request) {
                    // Network error
                    errorMessage = 'Kesalahan jaringan. Silakan periksa koneksi internet Anda.';
                } else {
                    errorMessage = error.message || 'Terjadi kesalahan yang tidak terduga.';
                }
                
                // Show error dialog
                await Swal.fire({
                    title: 'Penghapusan Gagal',
                    html: `
                        <div style="text-align: center;">
                            <i class="fas fa-exclamation-triangle text-danger mb-3" style="font-size: 3rem;"></i>
                            <p style="color: #4a5568; font-size: 1rem; margin-bottom: 0.5rem;">
                                ${errorMessage}
                            </p>
                            ${errorDetails ? `
                                <div style="background: #fee; border: 1px solid #fcc; border-radius: 8px; padding: 12px; margin-top: 12px;">
                                    <small style="color: #c53030; font-family: monospace;">
                                        ${errorDetails}
                                    </small>
                                </div>
                            ` : ''}
                            <small style="color: #718096; display: block; margin-top: 12px;">
                                Jika masalah ini terus berlanjut, silakan hubungi dukungan.
                            </small>
                        </div>
                    `,
                    icon: 'error',
                    iconColor: '#dc3545',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#dc3545',
                    customClass: {
                        popup: 'modern-toast modern-toast-dialog',
                        title: 'modern-swal-title',
                        htmlContainer: 'modern-swal-html'
                    }
                });
            }
        }
    } catch (error) {
        // Handle any errors in the confirmation dialog itself
        console.error('Error in delete confirmation:', error);
    }
};

/**
 * ✨ Accurately calculates course curriculum statistics:
 * - sectionsCount: Total sections/variants in the course curriculum
 * - lessonsCount: Total actual lessons (excluding quiz items)
 * - quizzesCount: Total curriculum quizzes (excluding pre/post-tests)
 * 
 * Prioritizes backend-computed `course.curriculum_summary` if present,
 * or inspects nested `course.curriculum` items, with fallback to `lectures` & `quizzes`.
 */
export const getCourseCurriculumSummary = (course) => {
    if (!course) {
        return { sectionsCount: 0, lessonsCount: 0, quizzesCount: 0 };
    }

    // 1. If backend already computed curriculum_summary, prioritize it
    if (course.curriculum_summary) {
        return {
            sectionsCount: Number(course.curriculum_summary.sections_count) || 0,
            lessonsCount: Number(course.curriculum_summary.lessons_count) || 0,
            quizzesCount: Number(course.curriculum_summary.quizzes_count) || 0
        };
    }

    // 2. Sections / Bagian
    const sectionsCount = Array.isArray(course.curriculum) ? course.curriculum.length : 0;

    // 3. Scan directly from nested curriculum if variants & items exist
    let curriculumLessons = 0;
    let curriculumQuizzes = 0;
    let hasNestedItems = false;

    if (Array.isArray(course.curriculum) && course.curriculum.length > 0) {
        course.curriculum.forEach((section) => {
            const items = section.variant_items || section.items || [];
            if (Array.isArray(items) && items.length > 0) {
                hasNestedItems = true;
                items.forEach((item) => {
                    const isQuiz = item.item_type === 'quiz' || Boolean(item.quiz_id) || Boolean(item.quiz);
                    if (isQuiz) {
                        curriculumQuizzes++;
                    } else {
                        curriculumLessons++;
                    }
                });
            }
        });
    }

    // 4. Lessons calculation
    let lessonsCount = 0;
    if (hasNestedItems) {
        lessonsCount = curriculumLessons;
    } else if (Array.isArray(course.lectures)) {
        // Exclude quiz items if any exist in lectures
        lessonsCount = course.lectures.filter((l) => l.item_type !== 'quiz' && !l.quiz_id && !l.quiz).length;
    }

    // 5. Quizzes calculation
    let quizzesCount = 0;
    if (hasNestedItems && curriculumQuizzes > 0) {
        // Preferred: count of quizzes actually inserted into curriculum sections
        quizzesCount = curriculumQuizzes;
    } else if (Array.isArray(course.quizzes)) {
        // Filter regular learning quizzes (exclude pre/post-tests)
        const regularQuizzes = course.quizzes.filter((q) => {
            const type = q.quiz_type || '';
            return type !== 'pre_post_test' && !q.has_pre_test && !q.has_post_test;
        });
        quizzesCount = regularQuizzes.length > 0 ? regularQuizzes.length : (course.quizzes.length > 0 ? course.quizzes.length : 0);
    } else if (typeof course.quizzes === 'number') {
        quizzesCount = course.quizzes;
    }

    return {
        sectionsCount,
        lessonsCount,
        quizzesCount
    };
};

export const commonFeatureIcons = [
    { value: "fas fa-check", label: "✓ Centang", icon: "✓" },
    { value: "fas fa-book", label: "📖 Buku", icon: "📖" },
    { value: "fas fa-video", label: "🎥 Video", icon: "🎥" },
    { value: "fas fa-document", label: "📄 Dokumen", icon: "📄" },
    { value: "fas fa-users", label: "👥 Komunitas", icon: "👥" },
    { value: "fas fa-certificate", label: "🎓 Sertifikat", icon: "🎓" },
    { value: "fas fa-clock", label: "⏰ Waktu Fleksibel", icon: "⏰" },
    { value: "fas fa-globe", label: "🌐 Akses Seumur Hidup", icon: "🌐" },
    { value: "fas fa-star", label: "⭐ Premium", icon: "⭐" },
    { value: "fas fa-desktop", label: "💻 Akses Mobile", icon: "💻" },
    { value: "fas fa-download", label: "📥 Materi Downloadable", icon: "📥" },
    { value: "fas fa-headphones", label: "🎧 Dukungan 24/7", icon: "🎧" },
];

export const getFeatureIconDisplay = (iconValue) => {
    if (!iconValue) return "✓";
    const matched = commonFeatureIcons.find(
        (item) => item.value === iconValue || item.label?.startsWith(iconValue) || item.icon === iconValue
    );
    if (matched) return matched.icon;

    // Fallbacks for known classes
    const iconMap = {
        "fas fa-video": "🎥",
        "fas fa-document": "📄",
        "fas fa-file": "📄",
        "fas fa-file-alt": "📄",
        "fas fa-certificate": "🎓",
        "fas fa-graduation-cap": "🎓",
        "fas fa-check": "✓",
        "fas fa-check-circle": "✓",
        "fas fa-book": "📖",
        "fas fa-users": "👥",
        "fas fa-clock": "⏰",
        "fas fa-globe": "🌐",
        "fas fa-star": "⭐",
        "fas fa-desktop": "💻",
        "fas fa-download": "📥",
        "fas fa-headphones": "🎧",
        "fas fa-layer-group": "📚",
        "fas fa-laptop-code": "💻",
        "fas fa-infinity": "🌐",
    };
    if (iconMap[iconValue]) return iconMap[iconValue];

    // If it's already an emoji or non-font-awesome string
    if (!iconValue.startsWith("fa")) return iconValue;

    return null;
};
