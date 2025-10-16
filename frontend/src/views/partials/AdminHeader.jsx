import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import UserData from '../plugin/UserData';
import './AdminHeader.css';

function AdminHeader() {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [hoverTimeout, setHoverTimeout] = useState(null);
    
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoggedIn, user] = useAuthStore((state) => [state.isLoggedIn, state.user]);
    const userData = UserData();
    const isAdmin = userData?.role === 'admin';
    const isSuperAdmin = userData?.is_super_admin || false;
    
    // Cleanup hover timeout
    useEffect(() => {
        return () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
        };
    }, [hoverTimeout]);

    // Dropdown handlers
    const handleMouseEnter = () => {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }
        setDropdownOpen(true);
    };

    const handleMouseLeave = () => {
        const timeout = setTimeout(() => {
            setDropdownOpen(false);
        }, 300);
        setHoverTimeout(timeout);
    };

    // Logout functionality
    const handleLogout = () => {
        import('../../utils/auth').then(({ logout }) => {
            logout();
        });
    };

    // Utility functions
    const getDisplayName = () => {
        if (userData?.full_name) {
            return userData.full_name.length > 20 
                ? userData.full_name.substring(0, 20) + "..."
                : userData.full_name;
        }
        return "Admin";
    };

    const isActive = (path) => {
        return location.pathname.includes(path);
    };

    // Admin menu items
    const adminMenuItems = [
        { to: "/admin/dashboard/", icon: "bi bi-grid-fill", text: "Dashboard", requiresSuperAdmin: false },
        { to: "/admin/users/", icon: "fas fa-users", text: "Kelola Pengguna", requiresSuperAdmin: false },
        { to: "/admin/courses/", icon: "fas fa-book-atlas", text: "Kelola Materi", requiresSuperAdmin: false },
        { to: "/admin/analytics/", icon: "fas fa-chart-line", text: "Analytics", requiresSuperAdmin: false },
        { to: "/admin/reports/", icon: "fas fa-file-alt", text: "Laporan", requiresSuperAdmin: false },
        { to: "/admin/system/", icon: "fas fa-cogs", text: "Pengaturan Sistem", requiresSuperAdmin: true },
        { to: "/admin/profile/", icon: "fas fa-user-cog", text: "Profil Admin", requiresSuperAdmin: false },
        { to: "/logout/", icon: "fas fa-sign-out-alt", text: "Keluar", requiresSuperAdmin: false }
    ];

    // Filter menu items based on admin privileges
    const filteredMenuItems = adminMenuItems.filter(item => 
        !item.requiresSuperAdmin || isSuperAdmin
    );

    // Render dropdown items
    const renderDropdownItems = (items) => (
        items.map((item, index) => {
            if (item.to === "/logout/") {
                return (
                    <li key={index}>
                        <button
                            className="dropdown-item logout-item"
                            onClick={handleLogout}
                        >
                            <i className={item.icon}></i>
                            {item.text}
                        </button>
                    </li>
                );
            }
            
            return (
                <li key={index}>
                    <Link
                        to={item.to}
                        className={`dropdown-item ${isActive(item.to) ? 'active-item' : ''}`}
                        onClick={() => setDropdownOpen(false)}
                    >
                        <i className={item.icon}></i>
                        {item.text}
                    </Link>
                </li>
            );
        })
    );

    return (
        <nav className="admin-header navbar navbar-expand-lg">
            <div className="container">
                {/* Brand */}
                <Link className="navbar-brand admin-brand" to="/admin/dashboard/">
                    <div className="brand-content">
                        <i className="fas fa-shield-alt brand-icon"></i>
                        <div className="brand-text">
                            <span className="brand-title">LMSetjen DPD RI</span>
                            <span className="brand-subtitle">Admin Panel</span>
                        </div>
                    </div>
                </Link>

                {/* Admin Navigation */}
                <div className="navbar-nav ms-auto">
                    {/* Quick Stats */}
                    <div className="nav-item admin-quick-stats">
                        <span className="quick-stat-item">
                            <i className="fas fa-users text-primary"></i>
                            <span className="stat-label">Users Online</span>
                        </span>
                    </div>

                    {/* Notifications */}
                    <div className="nav-item dropdown admin-notifications">
                        <button 
                            className="nav-link notification-btn"
                            type="button"
                            data-bs-toggle="dropdown"
                        >
                            <i className="fas fa-bell"></i>
                            <span className="notification-badge">3</span>
                        </button>
                        <ul className="dropdown-menu notification-dropdown">
                            <li><h6 className="dropdown-header">Notifications</h6></li>
                            <li><hr className="dropdown-divider" /></li>
                            <li><a className="dropdown-item" href="#">New user registered</a></li>
                            <li><a className="dropdown-item" href="#">Course requires approval</a></li>
                            <li><a className="dropdown-item" href="#">System backup completed</a></li>
                            <li><hr className="dropdown-divider" /></li>
                            <li><a className="dropdown-item text-center" href="#">View all notifications</a></li>
                        </ul>
                    </div>

                    {/* Admin Profile Dropdown */}
                    {isLoggedIn() && isAdmin && (
                        <div 
                            className="nav-item dropdown admin-profile-dropdown"
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                        >
                            <button 
                                className="nav-link dropdown-toggle admin-profile-btn"
                                type="button"
                                data-bs-toggle="dropdown"
                                aria-expanded={dropdownOpen}
                            >
                                <div className="admin-avatar">
                                    {userData?.image ? (
                                        <img 
                                            src={userData.image} 
                                            alt="Admin" 
                                            className="avatar-img"
                                        />
                                    ) : (
                                        <i className="fas fa-user-shield"></i>
                                    )}
                                </div>
                                <div className="admin-info">
                                    <span className="admin-name">{getDisplayName()}</span>
                                    <span className="admin-role">
                                        {isSuperAdmin ? 'Super Admin' : 'Admin'}
                                    </span>
                                </div>
                            </button>
                            
                            <ul className={`dropdown-menu admin-dropdown ${dropdownOpen ? 'show' : ''}`}>
                                <li><h6 className="dropdown-header">
                                    <i className="fas fa-shield-alt me-2"></i>
                                    Admin Panel
                                </h6></li>
                                {renderDropdownItems(filteredMenuItems)}
                            </ul>
                        </div>
                    )}

                    {/* System Status Indicator */}
                    <div className="nav-item admin-status">
                        <div className="system-status online">
                            <span className="status-dot"></span>
                            <span className="status-text">System Online</span>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default React.memo(AdminHeader);