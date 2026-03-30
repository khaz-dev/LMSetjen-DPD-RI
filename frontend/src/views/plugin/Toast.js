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
            toast.style.position = 'relative';
            toast.style.paddingRight = '48px';
            
            // ✨ PHASE 4.58: Manually add close button since showCloseButton doesn't work for toasts
            const closeButton = document.createElement('button');
            closeButton.innerHTML = '✕';
            closeButton.type = 'button';
            closeButton.className = 'toast-close-btn';
            closeButton.onmouseenter = () => {
                closeButton.style.color = '#2d3748';
                closeButton.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                closeButton.style.opacity = '1';
            };
            closeButton.onmouseleave = () => {
                closeButton.style.color = '#718096';
                closeButton.style.backgroundColor = 'transparent';
                closeButton.style.opacity = '0.8';
            };
            // ✨ PHASE 4.59: Fix close button - use Swal.close() instead of hideLoading()
            closeButton.onclick = () => Swal.close();
            
            // Style close button
            closeButton.style.position = 'absolute';
            closeButton.style.right = '8px';
            closeButton.style.top = '8px';
            closeButton.style.background = 'transparent';
            closeButton.style.border = 'none';
            closeButton.style.fontSize = '20px';
            closeButton.style.cursor = 'pointer';
            closeButton.style.color = '#718096';
            closeButton.style.padding = '0';
            closeButton.style.width = '32px';
            closeButton.style.height = '32px';
            closeButton.style.display = 'flex';
            closeButton.style.alignItems = 'center';
            closeButton.style.justifyContent = 'center';
            closeButton.style.transition = 'all 0.2s ease';
            closeButton.style.borderRadius = '6px';
            closeButton.style.opacity = '0.8';
            closeButton.style.fontWeight = 'bold';
            
            // Append close button to toast
            toast.appendChild(closeButton);
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
        iconColor: '#0d9488',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-sign-out-alt me-2"></i>Ya, Keluar',
        cancelButtonText: '<i class="fas fa-times me-2"></i>Batal',
        reverseButtons: true,
        focusConfirm: false,
        focusCancel: true,
        allowOutsideClick: false,
        allowEscapeKey: true,
        buttonsStyling: true,
        confirmButtonColor: '#0d9488',
        cancelButtonColor: '#e53e3e'
    });
}

   // ✨ PHASE 4.82: Delete confirmation dialog with proper centering
function DeleteConfirmation({ title = "Konfirmasi Penghapusan", text = "Apakah Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan." }) {
    return Swal.fire({
        title: title,
        html: `<div style="text-align: center; color: #4a5568; font-size: 1rem; line-height: 1.5; margin-bottom: 1rem;">
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
        cancelButtonColor: '#0d9488',
        buttonsStyling: true,
        allowEscapeKey: true,
        allowOutsideClick: false,
        customClass: {
            popup: 'modern-toast modern-toast-dialog',
            title: 'modern-swal-title',
            htmlContainer: 'modern-swal-html'
        }
    });
}

export default Toast;
export { LogoutConfirmation, DeleteConfirmation };