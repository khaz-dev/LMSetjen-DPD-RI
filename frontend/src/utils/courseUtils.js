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
            title: 'Delete Course?',
            text: `You are about to permanently delete "${courseName}". This will remove all associated content including curriculum, lessons, quizzes, and student enrollments. This action cannot be undone.`
        });
        
        if (result.isConfirmed) {
            // Show loading indicator
            Swal.fire({
                title: 'Deleting Course...',
                html: `
                    <div style="text-align: center;">
                        <div class="spinner-border text-danger mb-3" role="status" style="width: 3rem; height: 3rem;">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p style="color: #4a5568; font-size: 1rem;">
                            Removing "${courseName}" and all related data...
                        </p>
                        <small style="color: #718096;">Please wait, this may take a moment.</small>
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
                    title: 'Course Deleted!',
                    html: `
                        <div style="text-align: center;">
                            <i class="fas fa-check-circle text-success mb-3" style="font-size: 3rem;"></i>
                            <p style="color: #4a5568; font-size: 1rem; margin-bottom: 0.5rem;">
                                <strong>"${courseName}"</strong> has been successfully deleted.
                            </p>
                            <small style="color: #718096;">
                                All associated content has been removed from the system.
                            </small>
                        </div>
                    `,
                    icon: 'success',
                    iconColor: '#28a745',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#28a745',
                    timer: 3000,
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
                let errorMessage = 'Failed to delete the course. Please try again.';
                let errorDetails = '';
                
                if (error.response) {
                    // Server responded with error
                    if (error.response.status === 404) {
                        errorMessage = 'Course not found. It may have already been deleted.';
                    } else if (error.response.status === 403) {
                        errorMessage = 'You do not have permission to delete this course.';
                    } else if (error.response.status === 400) {
                        errorMessage = 'Cannot delete course. Please check if there are any dependencies.';
                    }
                    
                    if (error.response.data?.error) {
                        errorDetails = error.response.data.error;
                    } else if (error.response.data?.detail) {
                        errorDetails = error.response.data.detail;
                    }
                } else if (error.request) {
                    // Network error
                    errorMessage = 'Network error. Please check your internet connection.';
                } else {
                    errorMessage = error.message || 'An unexpected error occurred.';
                }
                
                // Show error dialog
                await Swal.fire({
                    title: 'Deletion Failed',
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
                                If this problem persists, please contact support.
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