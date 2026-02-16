// Course utilities
import { getMediaUrl, DEFAULT_IMAGE_URL } from './constants';

export const getImageUrl = (imageUrl) => {
    if (!imageUrl) {
        return DEFAULT_IMAGE_URL;
    }
    
    let cleanUrl = imageUrl;
    
    // If it contains encoded URLs, decode and extract the actual path
    if (cleanUrl.includes('%3A') || cleanUrl.includes('http%3A')) {
        cleanUrl = decodeURIComponent(cleanUrl);
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
    const styles = {
        Published: 'linear-gradient(135deg, #28a745, #20c997)',
        Draft: 'linear-gradient(135deg, #ffc107, #fd7e14)',
        Review: 'linear-gradient(135deg, #17a2b8, #138496)',
        Disabled: 'linear-gradient(135deg, #dc3545, #c82333)',
        default: 'linear-gradient(135deg, #6c757d, #545b62)'
    };
    return styles[status] || styles.default;
};

export const getLevelBadgeStyle = (level) => {
    const styles = {
        Beginner: 'linear-gradient(135deg, #28a745, #20c997)',
        Intermediate: 'linear-gradient(135deg, #ffc107, #fd7e14)', 
        Advanced: 'linear-gradient(135deg, #dc3545, #c82333)',
        default: 'linear-gradient(135deg, #6c757d, #545b62)'
    };
    return styles[level] || styles.default;
};

export const getLevelText = (level) => {
    const texts = {
        Beginner: '🟢 Beginner',
        Intermediate: '🟡 Intermediate',
        Advanced: '🔴 Advanced',
        default: 'N/A'
    };
    return texts[level] || texts.default;
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
            text: `Anda akan menghapus secara permanen "${courseName}". Ini akan menghapus semua konten terkait termasuk kurikulum, pelajaran, kuis, dan pendaftaran siswa. Tindakan ini tidak dapat dibatalkan.`
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
                        popup: 'modern-toast'
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
                        popup: 'modern-toast'
                    }
                });
            }
        }
    } catch (error) {
        // Handle any errors in the confirmation dialog itself
        console.error('Error in delete confirmation:', error);
    }
};