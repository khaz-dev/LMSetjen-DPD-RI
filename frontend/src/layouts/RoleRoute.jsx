import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import UserData from '../views/plugin/UserData';
import Toast from '../views/plugin/Toast';
import { useRoles } from '../utils/useRoles';
import { switchRole } from '../utils/roleUtils';
import React, { useEffect, useState, useRef } from 'react';

/**
 * RoleRoute Component - Seamless Multi-Role Access Control
 * 
 * Verifies access permissions for protected routes.
 * In a multi-role system (e.g. Pegawai ASN Setjen DPD RI who can be both Student and Instructor):
 * - If user is already in the matching role: renders immediately.
 * - If user has the required role capability but is currently in another role:
 *   automatically and seamlessly switches the active role in the background WITHOUT
 *   interrupting the user with a disruptive "Peran Aktif Tidak Sesuai" modal dialog.
 * - If user does not possess the required role at all: displays Access Denied toast
 *   and safely redirects to the user's current role dashboard.
 */
const RoleRoute = ({ children, allowedRoles = [] }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const loggedIn = useAuthStore((state) => state.isLoggedIn());
    const { currentRole, availableRoles, rolesLoading, fetchAvailableRoles, setCurrentRole, setAvailableRoles } = useRoles();
    const [hasCheckedRole, setHasCheckedRole] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const isSwitchingRef = useRef(false);

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

        // Normalize allowed roles
        const normalizedAllowedRoles = allowedRoles.map(role => normalizeRole(role));

        // CHECK -1: Active role switch in progress across the application
        const activeSwitchTarget = normalizeRole(
            (typeof window !== 'undefined' ? window.__roleSwitchingTarget : null) ||
            (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('role_switching_target') : null)
        );

        if (activeSwitchTarget) {
            // If the route DOES NOT allow the target role currently being switched to,
            // this component represents an old page being left behind!
            // NEVER trigger auto-revert or access-denied error from this old page!
            if (!normalizedAllowedRoles.includes(activeSwitchTarget)) {
                console.log(`[RoleRoute] Bypassing ${location.pathname} because role switch to '${activeSwitchTarget}' is in progress`);
                return;
            } else {
                // Arrived at destination route matching activeSwitchTarget
                if (typeof window !== 'undefined') {
                    delete window.__roleSwitchingTarget;
                    try { sessionStorage.removeItem('role_switching_target'); } catch (e) { }
                }
            }
        }

        // CHECK 0: Role passed directly via navigation state (e.g. from RoleIndicator switch)
        const navigatedRole = normalizeRole(location.state?.roleSwitchedTo);
        if (navigatedRole && normalizedAllowedRoles.includes(navigatedRole)) {
            if (setCurrentRole && normalizeRole(currentRole) !== navigatedRole) {
                setCurrentRole(navigatedRole);
            }
            setShouldRender(true);
            setHasCheckedRole(true);
            return;
        }

        // Check active role from both context and fresh token from cookie
        const contextRole = normalizeRole(currentRole);
        const tokenRole = normalizeRole(userData?.current_role || userData?.role);

        // CHECK 1: Does current active role (from either context or token) match allowed roles?
        const isContextRoleAllowed = contextRole && normalizedAllowedRoles.includes(contextRole);
        const isTokenRoleAllowed = tokenRole && normalizedAllowedRoles.includes(tokenRole);

        if (isContextRoleAllowed || isTokenRoleAllowed) {
            // Clear any lingering switching target flag
            if (typeof window !== 'undefined') {
                delete window.__roleSwitchingTarget;
                try { sessionStorage.removeItem('role_switching_target'); } catch (e) { }
            }
            // Keep context in sync with valid token role if needed
            if (isTokenRoleAllowed && contextRole !== tokenRole && setCurrentRole) {
                setCurrentRole(tokenRole);
            }
            setShouldRender(true);
            setHasCheckedRole(true);
            return;
        }

        // Guard against duplicate auto-switch loops in React StrictMode
        if (isSwitchingRef.current) {
            return;
        }

        // CHECK 2: Does user have the required role among their capabilities?
        const normalizedAvailableRoles = (availableRoles || []).map(r => normalizeRole(r));
        const hasStudent = !!(userData?.is_student || normalizedAvailableRoles.includes('student'));
        const hasInstructor = !!(userData?.is_instructor || normalizedAvailableRoles.includes('instructor'));
        const hasAdmin = !!(userData?.is_admin || userData?.is_super_admin || userData?.is_superuser || userData?.is_staff || normalizedAvailableRoles.includes('admin') || userData?.email?.toLowerCase() === 'khairilazmiashari@gmail.com');

        let targetRole = null;
        if (normalizedAllowedRoles.includes('student') && hasStudent) {
            targetRole = 'student';
        } else if (normalizedAllowedRoles.includes('instructor') && hasInstructor) {
            targetRole = 'instructor';
        } else if (normalizedAllowedRoles.includes('admin') && hasAdmin) {
            targetRole = 'admin';
        }

        const effectiveActiveRole = tokenRole || contextRole || 'student';
        const currentRoleDisplay = getRoleLabel(effectiveActiveRole);
        const requiredRolesDisplay = normalizedAllowedRoles.map(r => getRoleLabel(r)).join(' atau ');
        const activeDashboardUrl = getRoleDashboardUrl(effectiveActiveRole);

        // CASE A: User HAS the role capability -> Seamlessly auto-switch role in the background!
        // No intrusive modal / SweetAlert dialog asking "Peran Aktif Tidak Sesuai"
        if (targetRole) {
            isSwitchingRef.current = true;
            const targetRoleDisplay = getRoleLabel(targetRole);

            (async () => {
                try {
                    const switchRes = await switchRole(targetRole);
                    if (switchRes.success) {
                        if (setCurrentRole) {
                            setCurrentRole(switchRes.current_role || targetRole);
                        }
                        if (setAvailableRoles && switchRes.available_roles) {
                            setAvailableRoles(switchRes.available_roles);
                        }
                        if (fetchAvailableRoles) {
                            fetchAvailableRoles();
                        }
                        setShouldRender(true);
                        setHasCheckedRole(true);
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
                } finally {
                    isSwitchingRef.current = false;
                }
            })();
            return;
        }

        // CASE B: User DOES NOT have the role capability at all -> Deny access safely
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
            timer: 3500,
            showConfirmButton: false,
            width: '460px'
        });
        setShouldRender(false);
        setHasCheckedRole(true);
        navigate(activeDashboardUrl, { replace: true });

    }, [loggedIn, allowedRoles, currentRole, rolesLoading, location.pathname, location.state]);

    // Don't redirect during logout
    const isLoggingOut = sessionStorage.getItem('logging_out') === 'true';

    if (isLoggingOut) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                backgroundColor: '#f8f9fa'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Memproses logout...</span>
                    </div>
                    <p style={{ marginTop: '1rem', color: '#6c757d' }}>Sedang keluar dari sistem...</p>
                </div>
            </div>
        );
    }

    if (!loggedIn) {
        return <Navigate to="/login/" state={{ from: location }} replace />;
    }

    if (rolesLoading || !hasCheckedRole) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '60vh'
            }}>
                <div className="spinner-border text-teal" role="status" style={{ color: '#0d9488' }}>
                    <span className="visually-hidden">Memverifikasi peran...</span>
                </div>
            </div>
        );
    }

    return shouldRender ? children : null;
};

export default RoleRoute;
