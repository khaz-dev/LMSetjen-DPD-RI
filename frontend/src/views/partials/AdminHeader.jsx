import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import UserData from '../plugin/UserData';
import { useComingSoon } from '../../components/ComingSoonModal';
import RoleIndicator from '../../components/RoleIndicator';
import './AdminHeader.css';

function AdminHeader() {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [hoverTimeout, setHoverTimeout] = useState(null);
    const handleComingSoon = useComingSoon('Notifications');
    
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
    const getFirstTwoWords = (fullName) => {
        if (!fullName || typeof fullName !== 'string') return '';
        const words = fullName.trim().split(/\s+/);
        
        if (words.length === 0) return '';
        if (words.length === 1) return words[0];
        return `${words[0]} ${words[1]}`;
    };

    const getDisplayName = () => {
        if (userData?.full_name) {
            const cleanedFullName = userData.full_name
                .replace(/,+/g, '') // Remove all commas
                .replace(/[^\w\s]/g, '') // Remove special characters except spaces and word characters
                .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
                .trim();
            return getFirstTwoWords(cleanedFullName) || 'Admin';
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
        // ✨ PHASE 4: Unified content management page (replaces Review Kursus, Kurasi Testimoni, Kelola Materi)
        { to: "/admin/content-management/", icon: "fas fa-cogs", text: "Manajemen Konten", requiresSuperAdmin: false },
        // ✨ PHASE 4.210: Unified reports page (includes abuse reports and other system reports)
        { to: "/admin/reports/", icon: "fas fa-file-alt", text: "Laporan Sistem", requiresSuperAdmin: false },
        { to: "/admin/documentation/", icon: "fas fa-book", text: "Dokumentasi Sistem", requiresSuperAdmin: false },
        { to: "/admin/analytics/", icon: "fas fa-chart-line", text: "Analitik", requiresSuperAdmin: false },
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
        <nav className="admin-header navbar navbar-expand-xxl">
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

                {/* Navbar Toggler for mobile - only shows on smaller screens */}
                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#adminNavbar"
                    aria-controls="adminNavbar"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"><span></span></span>
                </button>

                {/* Responsive Admin Navigation */}
                <div className="collapse navbar-collapse" id="adminNavbar">
                    <div className="navbar-nav ms-auto">
                        {/* Quick Stats */}
                        <div className="nav-item admin-quick-stats">
                            <span className="quick-stat-item">
                                <i className="fas fa-users text-primary"></i>
                                <span className="stat-label">Pengguna Online</span>
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
                                <li><h6 className="dropdown-header">Notifikasi</h6></li>
                                <li><hr className="dropdown-divider" /></li>
                                <li><a className="dropdown-item" href="#" onClick={handleComingSoon} style={{ cursor: "pointer" }}>Pengguna baru terdaftar</a></li>
                                <li><a className="dropdown-item" href="#" onClick={handleComingSoon} style={{ cursor: "pointer" }}>Kursus memerlukan persetujuan</a></li>
                                <li><a className="dropdown-item" href="#" onClick={handleComingSoon} style={{ cursor: "pointer" }}>Backup sistem selesai</a></li>
                                <li><hr className="dropdown-divider" /></li>
                                <li><a className="dropdown-item text-center" href="#" onClick={handleComingSoon} style={{ cursor: "pointer" }}>Lihat semua notifikasi</a></li>
                            </ul>
                        </div>

                        {/* ✨ PHASE 4.15: Role Status Indicator - Separated from Profile */}
                        {isLoggedIn() && isAdmin && (
                            <span className="nav-item profile-role-status-separator">
                                <RoleIndicator compact={true} isAdmin={true} />
                            </span>
                        )}

                        {/* Admin Profile Display with Dropdown */}
                        {isLoggedIn() && isAdmin && (
                            <div 
                                className="nav-item dropdown admin-profile-display"
                                onMouseEnter={handleMouseEnter}
                                onMouseLeave={handleMouseLeave}
                            >
                                {/* Profile Display + Dropdown Toggle */}
                                <button
                                    className="nav-link dropdown-toggle profile-dropdown-btn"
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
                                            <i className="fas fa-user"></i>
                                        )}
                                    </div>
                                    <div className="admin-info">
                                        <span className="admin-name">{getDisplayName()}</span>
                                    </div>
                                </button>
                                
                                {/* Dropdown Menu for Admin Panel */}
                                <ul className={`dropdown-menu admin-profile-dropdown ${dropdownOpen ? 'show' : ''}`}>
                                    <li><h6 className="dropdown-header">
                                        <i className="fas fa-shield-alt me-2"></i>
                                        Panel Admin
                                    </h6></li>
                                    {renderDropdownItems(filteredMenuItems)}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default React.memo(AdminHeader);
