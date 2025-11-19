import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import UserData from '../views/plugin/UserData';
import Toast from '../views/plugin/Toast';
import { useEffect, useState } from 'react';

const RoleRoute = ({ children, allowedRoles = [] }) => {
    const loggedIn = useAuthStore((state) => state.isLoggedIn());
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
        
        // Get user data and check role
        const userData = UserData();
        console.log("👤 RoleRoute: userData =", userData);
        console.log("👤 RoleRoute: userData.role =", userData?.role);
        
        if (!userData || !userData.role) {
            // User is logged in but has no role data
            console.error("❌ RoleRoute: No role data found!");
            Toast().fire({
                icon: 'error',
                title: 'Access Denied',
                text: 'Unable to verify user role. Please log in again.',
                timer: 3000
            });
            setHasCheckedRole(true);
            setShouldRender(false);
            return;
        }

        const userRole = userData.role.toLowerCase();
        const normalizedAllowedRoles = allowedRoles.map(role => role.toLowerCase());
        
        console.log("👤 RoleRoute: userRole =", userRole, "allowedRoles =", normalizedAllowedRoles);
        
        // Check if user has permission
        if (normalizedAllowedRoles.includes(userRole)) {
            console.log("✅ RoleRoute: User has permission!");
            setShouldRender(true);
        } else {
            // User doesn't have permission
            console.error("❌ RoleRoute: Permission denied - user role doesn't match allowed roles");
            const roleDisplay = userRole === 'teacher' ? 'Instructor' : userRole.charAt(0).toUpperCase() + userRole.slice(1);
            const requiredRoles = allowedRoles.map(role => {
                if (role.toLowerCase() === 'teacher') return 'Instructor';
                return role.charAt(0).toUpperCase() + role.slice(1);
            }).join(' or ');
            
            Toast().fire({
                icon: 'error',
                title: 'Access Denied',
                html: `
                    <div style="text-align: left;">
                        <p><strong>You don't have permission to access this page.</strong></p>
                        <p style="margin: 10px 0;">Your current role: <span style="color: #dc3545; font-weight: 600;">${roleDisplay}</span></p>
                        <p>Required role: <span style="color: #28a745; font-weight: 600;">${requiredRoles}</span></p>
                        <p style="margin-top: 10px; font-size: 0.9em; color: #6c757d;">You are being redirected to the home page...</p>
                    </div>
                `,
                timer: 4000,
                showConfirmButton: false,
                width: '500px'
            });
            setShouldRender(false);
        }
        
        setHasCheckedRole(true);
    }, [loggedIn, allowedRoles]);

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

    // Still checking role
    if (!hasCheckedRole) {
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
                </div>
            </div>
        );
    }

    // User doesn't have permission
    if (!shouldRender) {
        return <Navigate to="/" replace />;
    }

    // User has permission
    return <>{children}</>;
};

export default RoleRoute;
