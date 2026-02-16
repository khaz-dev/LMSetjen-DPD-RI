import Swal from "sweetalert2";

function Toast(){
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
            
            // Ensure consistent styling even during loading states
            toast.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
            toast.style.borderRadius = '12px';
            toast.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
            toast.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            toast.style.backdropFilter = 'blur(15px)';
            toast.style.webkitBackdropFilter = 'blur(15px)';
        },
        customClass: {
            popup: 'modern-toast',
            timerProgressBar: 'modern-progress-bar'
        },
        background: 'rgba(255, 255, 255, 0.98)',
        showClass: {
            popup: 'animate__animated animate__slideInRight animate__faster'
        },
        hideClass: {
            popup: 'animate__animated animate__slideOutRight animate__faster'
        },
        // Enhanced mobile support - removed incompatible parameters for toasts
        allowEscapeKey: true,
        // Prevent style conflicts during network delays
        scrollbarPadding: false,
        // Better performance on mobile
        animation: false // Disable complex animations on slower connections
    })

    return Toast
}

// Enhanced logout confirmation dialog with mobile optimization
function LogoutConfirmation() {
    // Detect slow connection and adjust accordingly
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const isSlowConnection = connection && (
        connection.effectiveType === 'slow-2g' || 
        connection.effectiveType === '2g' ||
        connection.downlink < 1
    );

    // Use a completely clean implementation
    return Swal.fire({
        title: 'Konfirmasi Logout',
        html: `
            <div style="color: #4a5568; font-size: 1rem; line-height: 1.5; margin-bottom: 1rem;">
                Apakah Anda yakin ingin keluar dari sistem?<br>
                <small style="color: #718096;">Anda perlu login kembali untuk mengakses akun.</small>
            </div>
        `,
        icon: 'question',
        iconColor: '#667eea',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-sign-out-alt me-2"></i>Ya, Keluar',
        cancelButtonText: '<i class="fas fa-times me-2"></i>Batal',
        reverseButtons: true,
        focusConfirm: false,
        focusCancel: true,
        allowOutsideClick: false,
        allowEscapeKey: true,
        buttonsStyling: true,
        confirmButtonColor: '#667eea',
        cancelButtonColor: '#e53e3e'
    });
}

   // Place this near the top of your file, after imports
function DeleteConfirmation({ title = "Konfirmasi Penghapusan", text = "Apakah Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan." }) {
    return Swal.fire({
        title: title,
        html: `<div style="color: #4a5568; font-size: 1rem; line-height: 1.5; margin-bottom: 1rem;">
                ${text}
                <br><small style="color: #718096;">Tindakan ini bersifat permanen.</small>
            </div>`,
        icon: 'warning',
        iconColor: '#e53e3e',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash me-2"></i>Ya, Hapus',
        cancelButtonText: '<i class="fas fa-times me-2"></i>Batal',
        reverseButtons: true,
        focusCancel: true,
        confirmButtonColor: '#e53e3e',
        cancelButtonColor: '#667eea',
        buttonsStyling: true,
        allowEscapeKey: true,
        allowOutsideClick: false,
        customClass: {
            popup: 'modern-toast',
        }
    });
}

export default Toast;
export { LogoutConfirmation, DeleteConfirmation };