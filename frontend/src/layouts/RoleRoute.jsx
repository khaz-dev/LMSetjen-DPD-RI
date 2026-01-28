import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import UserData from '../views/plugin/UserData';
import Toast from '../views/plugin/Toast';
import { useRoles } from '../utils/useRoles';
import { useEffect, useState } from 'react';

/**
 * RoleRoute Component - Phase 6
 * 
 * Protects routes by verifying user's role before rendering.
 * Supports multi-role users via current_role field.
 * 
 * @param {React.ReactNode} children - Component to render if authorized
 * @param {Array<string>} allowedRoles - List of roles that can access this route
 * 
 * Usage:
 * <RoleRoute allowedRoles={["admin"]}>
 *   <AdminDashboard />
 * </RoleRoute>
 */
const RoleRoute = ({ children, allowedRoles = [] }) => {
    const loggedIn = useAuthStore((state) => state.isLoggedIn());
    const { currentRole, rolesLoading } = useRoles();
    const [hasCheckedRole, setHasCheckedRole] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    
    useEffect(() => {
        // Check if user is logged in first
        if (!loggedIn) {
            console.log("🚫 RoleRoute: User not logged in (isLoggedIn=false)");
            setHasCheckedRole(true);
            setShouldRender(false);
            return;
        }

        console.log("✅ RoleRoute: User logged in, checking role...");
        
        // Still loading roles from API
        if (rolesLoading) {
            console.log("⏳ RoleRoute: Roles still loading...");
            return;
        }

        // Get user data for permission checking (Phase 4.15+ multi-role support)
        const userData = UserData();
        
        // PHASE 4.15+: Check permissions using boolean role fields (is_student, is_instructor, is_admin)
        // This ensures seamless role switching without string comparison issues
        let hasPermission = false;
        const normalizedAllowedRoles = allowedRoles.map(role => role.toLowerCase());
        
        console.log("👤 RoleRoute: Checking boolean role fields");
        console.log("   is_student:", userData?.is_student);
        console.log("   is_instructor:", userData?.is_instructor);
        console.log("   is_admin:", userData?.is_admin);
        console.log("   allowedRoles:", normalizedAllowedRoles);
        
        // Check if user has one of the allowed roles using boolean fields
        for (const allowedRole of normalizedAllowedRoles) {
            if (allowedRole === 'student' && userData?.is_student) {
                hasPermission = true;
                console.log("✅ RoleRoute: User has 'student' role (is_student=true)");
                break;
            } else if ((allowedRole === 'teacher' || allowedRole === 'instructor') && userData?.is_instructor) {
                hasPermission = true;
                console.log("✅ RoleRoute: User has 'instructor' role (is_instructor=true)");
                break;
            } else if (allowedRole === 'admin' && userData?.is_admin) {
                hasPermission = true;
                console.log("✅ RoleRoute: User has 'admin' role (is_admin=true)");
                break;
            }
        }
        
        if (!hasPermission) {
            // User doesn't have permission - show error
            console.error("❌ RoleRoute: Permission denied - user doesn't have any of the allowed roles");
            
            // Determine which role user currently has for display
            let currentRoleDisplay = 'Tidak Diketahui';
            if (userData?.is_admin) currentRoleDisplay = 'Administrator';
            else if (userData?.is_instructor) currentRoleDisplay = 'Instruktur';
            else if (userData?.is_student) currentRoleDisplay = 'Peserta';
            
            const requiredRoles = allowedRoles.map(role => {
                if (role.toLowerCase() === 'teacher' || role.toLowerCase() === 'instructor') return 'Instruktur';
                return role.charAt(0).toUpperCase() + role.slice(1);
            }).join(' atau ');
            
            Toast().fire({
                icon: 'error',
                title: 'Akses Ditolak',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Anda tidak memiliki izin untuk mengakses halaman ini.</strong></p>
                        <p style="margin: 10px 0;">Peran Anda saat ini: <span style="color: #dc3545; font-weight: 600;">${currentRoleDisplay}</span></p>
                        <p>Peran yang diperlukan: <span style="color: #28a745; font-weight: 600;">${requiredRoles}</span></p>
                        <p style="margin-top: 10px; font-size: 0.9em; color: #6c757d;">Anda sedang dialihkan ke halaman utama...</p>
                    </div>
                `,
                timer: 4000,
                showConfirmButton: false,
                width: '500px'
            });
            setShouldRender(false);
        } else {
            console.log("✅ RoleRoute: User has permission!");
            setShouldRender(true);
        }
        
        setHasCheckedRole(true);
    }, [loggedIn, allowedRoles, currentRole, rolesLoading]);

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
                        borderTop: '3px solid #667eea',
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
                        borderTop: '3px solid #667eea',
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

export default RoleRoute;
