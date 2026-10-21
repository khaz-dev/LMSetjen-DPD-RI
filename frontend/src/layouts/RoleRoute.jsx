import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import UserData from '../views/plugin/UserData';
import Toast from '../views/plugin/Toast';
import { useRoles } from '../utils/useRoles';
import { switchRole } from '../utils/roleUtils';
import Swal from 'sweetalert2';
import React, { useEffect, useState, useRef } from 'react';

/**
 * RoleRoute Component - Strict Active Role Enforcement
 * 
 * Protects routes by verifying the user's CURRENT ACTIVE ROLE before rendering.
 * In a multi-role system, having permission in the background is not enough;
 * the user must actively operate under the specific role session.
 * 
 * If a multi-role user attempts to visit a page of another role they possess,
 * they are prompted to switch their active role first.
 */
const RoleRoute = ({ children, allowedRoles = [] }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const loggedIn = useAuthStore((state) => state.isLoggedIn());
    const { currentRole, availableRoles, rolesLoading, fetchAvailableRoles } = useRoles();
    const [hasCheckedRole, setHasCheckedRole] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const isPromptingRef = useRef(false);
    
    // Normalize role string (e.g. 'teacher' -> 'instructor')
    const normalizeRole = (role) => {
        if (!role) return '';
        const r = role.toLowerCase().trim();
        return (r === 'teacher') ? 'instructor' : r;
    };

    const getRoleLabel = (role) => {
        const r = normalizeRole(role);
        if (r === 'admin') return 'Administrator';
        if (r === 'instructor') return 'Instruktur';
        if (r === 'student') return 'Peserta';
        return role || 'Pengguna';
    };

    const getRoleDashboardUrl = (role) => {
        const r = normalizeRole(role);
        if (r === 'admin') return '/admin/dashboard/';
        if (r === 'instructor') return '/instructor/dashboard/';
        if (r === 'student') return '/student/dashboard/';
        return '/';
    };

    useEffect(() => {
        // Not logged in -> handled by redirect
        if (!loggedIn) {
            setHasCheckedRole(true);
            setShouldRender(false);
            return;
        }

        // Still loading roles from API
        if (rolesLoading) {
            return;
        }

        const userData = UserData();
        
        // Determine user's active role
        const rawActiveRole = currentRole || userData?.current_role || userData?.role || 'student';
        const activeRole = normalizeRole(rawActiveRole);
        
        // Normalize allowed roles
        const normalizedAllowedRoles = allowedRoles.map(role => normalizeRole(role));
        
        // CHECK 1: Does current active role match allowed roles?
        const isCurrentRoleAllowed = normalizedAllowedRoles.includes(activeRole);
        
        if (isCurrentRoleAllowed) {
            setShouldRender(true);
            setHasCheckedRole(true);
            return;
        }

        // Active role does NOT match allowed roles for this route
        setShouldRender(false);

        // Guard against duplicate prompts in React StrictMode
        if (isPromptingRef.current) {
            return;
        }
        isPromptingRef.current = true;

        // CHECK 2: Does user actually have the required role among their capabilities?
        const normalizedAvailableRoles = (availableRoles || []).map(r => normalizeRole(r));
        const hasStudent = !!(userData?.is_student || normalizedAvailableRoles.includes('student'));
        const hasInstructor = !!(userData?.is_instructor || normalizedAvailableRoles.includes('instructor'));
        const hasAdmin = !!(userData?.is_admin || normalizedAvailableRoles.includes('admin'));

        let targetRole = null;
        if (normalizedAllowedRoles.includes('student') && hasStudent) {
            targetRole = 'student';
        } else if (normalizedAllowedRoles.includes('instructor') && hasInstructor) {
            targetRole = 'instructor';
        } else if (normalizedAllowedRoles.includes('admin') && hasAdmin) {
            targetRole = 'admin';
        }

        const currentRoleDisplay = getRoleLabel(activeRole);
        const requiredRolesDisplay = normalizedAllowedRoles.map(r => getRoleLabel(r)).join(' atau ');
        const activeDashboardUrl = getRoleDashboardUrl(activeRole);

        // CASE A: User HAS the role, but must switch active role first to access!
        if (targetRole) {
            const targetRoleDisplay = getRoleLabel(targetRole);

            Swal.fire({
                title: 'Peran Aktif Tidak Sesuai',
                html: `
                    <div style="text-align: left; font-size: 0.95rem; color: #334155; line-height: 1.6;">
                        <p style="margin-bottom: 8px;">
                            Peran aktif Anda saat ini: <strong style="color: #e11d48;">${currentRoleDisplay}</strong>
                        </p>
                        <p style="margin-bottom: 12px;">
                            Halaman ini khusus untuk peran aktif <strong style="color: #0d9488;">${targetRoleDisplay}</strong>.
                        </p>
                        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px; color: #166534; font-size: 0.9rem;">
                            <i class="fas fa-info-circle me-1" style="color: #16a34a;"></i>
                            Anda memiliki hak akses <strong>${targetRoleDisplay}</strong>. Beralih peran aktif sekarang untuk melanjutkan ke halaman ini?
                        </div>
                    </div>
                `,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#0d9488',
                cancelButtonColor: '#64748b',
                confirmButtonText: `<i class="fas fa-exchange-alt me-1"></i> Beralih ke ${targetRoleDisplay}`,
                cancelButtonText: `Kembali ke Dashboard ${currentRoleDisplay}`,
                allowOutsideClick: false,
                allowEscapeKey: false
            }).then(async (result) => {
                isPromptingRef.current = false;
                if (result.isConfirmed) {
                    Toast().fire({
                        icon: 'info',
                        title: 'Memproses...',
                        text: `Beralih ke peran ${targetRoleDisplay}...`,
                        timer: 1500,
                        showConfirmButton: false
                    });

                    try {
                        const switchRes = await switchRole(targetRole);
                        if (switchRes.success) {
                            if (fetchAvailableRoles) {
                                await fetchAvailableRoles();
                            }
                            setShouldRender(true);
                            setHasCheckedRole(true);
                            Toast().fire({
                                icon: 'success',
                                title: 'Peran Berhasil Beralih',
                                text: `Anda sekarang aktif dalam peran ${targetRoleDisplay}`
                            });
                        } else {
                            Toast().fire({
                                icon: 'error',
                                title: 'Gagal Beralih Peran',
                                text: switchRes.error || 'Terjadi kesalahan saat beralih peran'
                            });
                            navigate(activeDashboardUrl, { replace: true });
                        }
                    } catch (err) {
                        navigate(activeDashboardUrl, { replace: true });
                    }
                } else {
                    navigate(activeDashboardUrl, { replace: true });
                }
            });
        } else {
            // CASE B: User DOES NOT have the role at all - deny access
            Toast().fire({
                icon: 'error',
                title: 'Akses Ditolak',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Anda tidak memiliki izin untuk mengakses halaman ini.</strong></p>
                        <p style="margin: 8px 0;">Peran Anda saat ini: <span style="color: #dc3545; font-weight: 600;">${currentRoleDisplay}</span></p>
                        <p>Peran yang diperlukan: <span style="color: #0d9488; font-weight: 600;">${requiredRolesDisplay}</span></p>
                        <p style="margin-top: 8px; font-size: 0.9em; color: #6c757d;">Mengalihkan ke dashboard Anda...</p>
                    </div>
                `,
                timer: 4000,
                showConfirmButton: false,
                width: '500px'
            });
            isPromptingRef.current = false;
            navigate(activeDashboardUrl, { replace: true });
        }
        
        setHasCheckedRole(true);
    }, [loggedIn, allowedRoles, currentRole, rolesLoading, location.pathname]);

    // Don't redirect during logout
    const isLoggingOut = sessionStorage.getItem('logging_out') === 'true';
    
    if (isLoggingOut) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                backgroundColor: '#f8f9fa',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid #e2e8f0',
                        borderTop: '3px solid #0d9488',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 1rem'
                    }}></div>
                    <p style={{
                        margin: 0,
                        color: '#4a5568',
                        fontSize: '1rem',
                        fontWeight: '500'
                    }}>
                        Logging out...
                    </p>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    // Not logged in
    if (!loggedIn) {
        return <Navigate to="/login/" replace />;
    }

    // Still checking role or loading roles
    if (!hasCheckedRole || rolesLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                backgroundColor: '#f8f9fa'
            }}>
                <div style={{
                    textAlign: 'center',
                    padding: '2rem'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '3px solid #e2e8f0',
                        borderTop: '3px solid #0d9488',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 1rem'
                    }}></div>
                    <p style={{
                        margin: 0,
                        color: '#4a5568',
                        fontSize: '1rem'
                    }}>
                        Verifying access...
                    </p>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    // User doesn't have permission
    if (!shouldRender) {
        return <Navigate to="/" replace />;
    }

    // User has permission - render children
    return <>{children}</>;
};

export default React.memo(RoleRoute);
