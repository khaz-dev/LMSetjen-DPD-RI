import Swal from "sweetalert2";
import "./toast-mobile.css";

function Toast(){
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
        backdrop: false,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
            
            // Consistent compact glassmorphic styling
            toast.style.fontFamily = "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
            toast.style.borderRadius = '10px';
            toast.style.boxShadow = '0 10px 25px -4px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.06)';
            toast.style.backdropFilter = 'blur(14px)';
            toast.style.webkitBackdropFilter = 'blur(14px)';
            toast.style.position = 'relative';
            toast.style.paddingRight = '32px';
            toast.style.paddingLeft = '10px';
            toast.style.paddingTop = '8px';
            toast.style.paddingBottom = '8px';
            
            // Compact close button
            const closeButton = document.createElement('button');
            closeButton.innerHTML = '✕';
            closeButton.type = 'button';
            closeButton.className = 'toast-close-btn';
            closeButton.setAttribute('aria-label', 'Tutup Notifikasi');
            closeButton.onclick = () => Swal.close();
            
            // Style close button compact
            closeButton.style.position = 'absolute';
            closeButton.style.right = '6px';
            closeButton.style.top = '50%';
            closeButton.style.transform = 'translateY(-50%)';
            closeButton.style.background = 'transparent';
            closeButton.style.border = 'none';
            closeButton.style.fontSize = '13px';
            closeButton.style.cursor = 'pointer';
            closeButton.style.color = '#94a3b8';
            closeButton.style.padding = '0';
            closeButton.style.width = '22px';
            closeButton.style.height = '22px';
            closeButton.style.display = 'flex';
            closeButton.style.alignItems = 'center';
            closeButton.style.justifyContent = 'center';
            closeButton.style.transition = 'all 0.15s ease';
            closeButton.style.borderRadius = '5px';
            closeButton.style.opacity = '0.85';
            closeButton.style.fontWeight = 'bold';
            
            // Append close button to toast
            toast.appendChild(closeButton);
        },
        customClass: {
            popup: 'modern-toast',
            timerProgressBar: 'modern-progress-bar'
        },
        background: 'rgba(255, 255, 255, 0.96)',
        showClass: {
            popup: 'swal2-toast-animate-in'
        },
        hideClass: {
            popup: 'swal2-toast-animate-out'
        },
        allowEscapeKey: true,
        scrollbarPadding: false,
        animation: true
    });

    return Toast;
}

// Enhanced logout confirmation dialog with compact styling
function LogoutConfirmation() {
    return Swal.fire({
        title: 'Konfirmasi Logout',
        html: `
            <div style="color: #475569; font-size: 0.86rem; line-height: 1.45; margin-bottom: 0.25rem;">
                Apakah Anda yakin ingin keluar dari sistem?<br>
                <small style="color: #64748b;">Anda perlu login kembali untuk mengakses akun.</small>
            </div>
        `,
        icon: 'question',
        iconColor: '#0d9488',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-sign-out-alt me-1"></i> Ya, Keluar',
        cancelButtonText: '<i class="fas fa-times me-1"></i> Batal',
        reverseButtons: true,
        focusConfirm: false,
        focusCancel: true,
        allowOutsideClick: false,
        allowEscapeKey: true,
        buttonsStyling: true,
        confirmButtonColor: '#0d9488',
        cancelButtonColor: '#64748b'
    });
}

// Delete confirmation dialog with compact styling
function DeleteConfirmation({ title = "Konfirmasi Penghapusan", text = "Apakah Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan." }) {
    return Swal.fire({
        title: title,
        html: `<div style="text-align: center; color: #475569; font-size: 0.86rem; line-height: 1.45; margin-bottom: 0.25rem;">
                ${text}
                <br><small style="color: #64748b;">Tindakan ini bersifat permanen.</small>
            </div>`,
        icon: 'warning',
        iconColor: '#f43f5e',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash me-1"></i> Ya, Hapus',
        cancelButtonText: '<i class="fas fa-times me-1"></i> Batal',
        reverseButtons: true,
        focusCancel: true,
        confirmButtonColor: '#f43f5e',
        cancelButtonColor: '#64748b',
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
