import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import UserData from '../plugin/UserData';
import RoleIndicator from '../../components/RoleIndicator';
import { ProfileContext } from '../plugin/Context';
import apiInstance from '../../utils/axios';
import './AdminHeader.css';

function AdminHeader() {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [notiOpen, setNotiOpen] = useState(false);
    const [hoverTimeout, setHoverTimeout] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);

    const [headerStats, setHeaderStats] = useState({
        status: 'online',
        active_users: 1,
        online_users: 1,
        total_users: 0,
        pending_courses: 0,
        pending_reports: 0,
        pending_testimonials: 0,
        pending_feedback: 0,
        total_alerts: 0,
        notifications: [],
        server_time: ''
    });

    const notiRef = useRef(null);
    const profileRef = useRef(null);

    const navigate = useNavigate();
    const location = useLocation();
    const [isLoggedIn, user] = useAuthStore((state) => [state.isLoggedIn, state.user]);
    const [profile] = useContext(ProfileContext) || [null];
    const userData = UserData();
    const isAdmin = userData?.role === 'admin' || user?.role === 'admin' || user?.is_admin || userData?.email?.toLowerCase() === 'khairilazmiashari@gmail.com';
    
    const [isSuperAdminLive, setIsSuperAdminLive] = useState(() => {
        return Boolean(
            userData?.is_super_admin ||
            user?.is_super_admin ||
            userData?.is_superuser ||
            user?.is_superuser ||
            userData?.email?.toLowerCase() === 'khairilazmiashari@gmail.com' ||
            user?.email?.toLowerCase() === 'khairilazmiashari@gmail.com'
        );
    });

    const isSuperAdmin = Boolean(
        isSuperAdminLive ||
        userData?.is_super_admin ||
        user?.is_super_admin ||
        userData?.is_superuser ||
        user?.is_superuser ||
        userData?.email?.toLowerCase() === 'khairilazmiashari@gmail.com' ||
        user?.email?.toLowerCase() === 'khairilazmiashari@gmail.com'
    );

    // Fetch live real data for admin header
    const fetchHeaderStats = useCallback(async () => {
        if (!isLoggedIn() || !isAdmin) return;
        setLoadingStats(true);
        try {
            const res = await apiInstance.get('admin/header-stats/');
            if (res.data) {
                setHeaderStats(res.data);
                if (res.data.is_super_admin !== undefined) {
                    setIsSuperAdminLive(Boolean(res.data.is_super_admin));
                }
            }
        } catch (err) {
            console.debug('Admin header stats fetch:', err);
        } finally {
            setLoadingStats(false);
        }
    }, [isLoggedIn, isAdmin]);

    useEffect(() => {
        fetchHeaderStats();
        const interval = setInterval(fetchHeaderStats, 45000);
        return () => clearInterval(interval);
    }, [fetchHeaderStats]);

    // Cleanup hover timeout
    useEffect(() => {
        return () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
        };
    }, [hoverTimeout]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notiRef.current && !notiRef.current.contains(event.target)) {
                setNotiOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Dropdown hover handlers for profile
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

    // Utility: Active route check
    const isActive = (path) => {
        if (path === '/admin/dashboard/' && (location.pathname === '/admin/' || location.pathname === '/admin/dashboard/')) {
            return true;
        }
        return location.pathname.includes(path) && path !== '/admin/dashboard/';
    };

    // Notification click handler
    const handleNotificationClick = async (item) => {
        setNotiOpen(false);
        if (item.link) {
            navigate(item.link);
        }
    };

    // Admin menu items
    const adminMenuItems = [
        { to: "/admin/dashboard/", icon: "bi bi-grid-fill", text: "Dashboard", requiresSuperAdmin: false },
        { to: "/admin/users/", icon: "fas fa-users", text: "Kelola Pengguna", requiresSuperAdmin: false },
        { to: "/admin/content-management/", icon: "fas fa-cogs", text: "Manajemen Konten", requiresSuperAdmin: false },
        { to: "/admin/reports/", icon: "fas fa-shield-alt", text: "Moderasi & Masukan", requiresSuperAdmin: false },
        { to: "/admin/system/", icon: "fas fa-server", text: "Diagnostik & Sistem", requiresSuperAdmin: true },
        { to: "/logout/", icon: "fas fa-sign-out-alt", text: "Keluar", requiresSuperAdmin: false }
    ];

    const filteredMenuItems = adminMenuItems.filter(item => 
        !item.requiresSuperAdmin || isSuperAdmin
    );

    const renderDropdownItems = (items) => (
        items.map((item, index) => {
            if (item.to === "/logout/") {
                return (
                    <li key={index} className="admin-profile-li">
                        <button
                            className="dropdown-item admin-profile-item admin-profile-logout"
                            onClick={() => {
                                setDropdownOpen(false);
                                handleLogout();
                            }}
                        >
                            <span className="admin-profile-icon">
                                <i className={item.icon}></i>
                            </span>
                            <span className="admin-profile-text">{item.text}</span>
                        </button>
                    </li>
                );
            }
            
            return (
                <li key={index} className="admin-profile-li">
                    <Link
                        to={item.to}
                        className={`dropdown-item admin-profile-item ${isActive(item.to) ? 'active-item active' : ''}`}
                        onClick={() => setDropdownOpen(false)}
                    >
                        <span className="admin-profile-icon">
                            <i className={item.icon}></i>
                        </span>
                        <span className="admin-profile-text">{item.text}</span>
                    </Link>
                </li>
            );
        })
    );

    return (
        <nav className="admin-header navbar navbar-expand-xxl">
            <div className="container-fluid px-3 px-xl-4 footer-container">
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

                {/* Navbar Toggler for mobile - only shows on small screens below 1200px */}
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
                    <div className="navbar-nav ms-auto align-items-center">
                        {/* Live Online Users Stat */}
                        <div className="nav-item admin-quick-stats">
                            <span className="quick-stat-item" title="Pengguna Aktif & Online Real-Time">
                                <span className="stat-pulse-dot"></span>
                                <i className="fas fa-users text-primary me-1"></i>
                                <span className="stat-label">
                                    Pengguna Online: <strong>{headerStats.online_users || 1}</strong>
                                </span>
                            </span>
                        </div>

                        {/* Live Notifications Dropdown */}
                        <div className="nav-item dropdown admin-notifications" ref={notiRef}>
                            <button 
                                className="nav-link notification-btn"
                                type="button"
                                onClick={() => {
                                    setNotiOpen(!notiOpen);
                                    setDropdownOpen(false);
                                }}
                                title="Pusat Notifikasi & Tindakan Tertunda"
                                aria-expanded={notiOpen}
                            >
                                <i className="fas fa-bell"></i>
                                {headerStats.total_alerts > 0 && (
                                    <span className="notification-badge pulse-badge">
                                        {headerStats.total_alerts > 99 ? '99+' : headerStats.total_alerts}
                                    </span>
                                )}
                            </button>
                            {notiOpen && (
                                <ul className="dropdown-menu notification-dropdown show shadow-lg">
                                    <li className="dropdown-header d-flex justify-content-between align-items-center">
                                        <div className="d-flex align-items-center">
                                            <i className="fas fa-bell me-2 text-warning"></i>
                                            <span>Notifikasi & Tindakan</span>
                                        </div>
                                        {headerStats.total_alerts > 0 ? (
                                            <span className="badge bg-warning text-dark font-weight-bold">
                                                {headerStats.total_alerts} Perlu Ditindak
                                            </span>
                                        ) : (
                                            <span className="badge bg-success">Terpantau</span>
                                        )}
                                    </li>
                                    <li><hr className="dropdown-divider m-0" /></li>
                                    
                                    <div className="notification-list-body" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                                        {headerStats.notifications && headerStats.notifications.length > 0 ? (
                                            headerStats.notifications.map((item, idx) => (
                                                <li key={item.id || idx}>
                                                    <div 
                                                        className="dropdown-item noti-item-row"
                                                        onClick={() => handleNotificationClick(item)}
                                                        style={{ cursor: 'pointer', whiteSpace: 'normal', padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}
                                                    >
                                                        <div className="d-flex align-items-start gap-2">
                                                            <i className={`fas ${item.icon || 'fa-bell'} mt-1 ${item.badge_type === 'warning' ? 'text-warning' : item.badge_type === 'danger' ? 'text-danger' : 'text-primary'}`}></i>
                                                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                                <div className="fw-bold small">{item.title}</div>
                                                                <div className="text-muted" style={{ fontSize: '0.78rem' }}>{item.message}</div>
                                                                {item.time && <div className="text-muted" style={{ fontSize: '0.7rem' }}>{item.time}</div>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="p-3 text-center text-muted small">
                                                <i className="fas fa-check-circle text-success mb-1 d-block" style={{ fontSize: '20px' }}></i>
                                                Semua operasional sistem berjalan normal.
                                            </li>
                                        )}
                                    </div>
                                    
                                    <li><hr className="dropdown-divider m-0" /></li>
                                    <li>
                                        <Link 
                                            to="/admin/reports/" 
                                            className="dropdown-item text-center small text-primary fw-semibold py-2"
                                            onClick={() => setNotiOpen(false)}
                                        >
                                            Buka Laporan & Diagnostik <i className="fas fa-arrow-right ms-1"></i>
                                        </Link>
                                    </li>
                                </ul>
                            )}
                        </div>

                        {/* Role Status Indicator */}
                        {isLoggedIn() && isAdmin && (
                            <span className="nav-item profile-role-status-separator">
                                <RoleIndicator compact={true} isAdmin={true} />
                            </span>
                        )}

                        {/* Admin Profile Display with Dropdown */}
                        {isLoggedIn() && isAdmin && (
                            <div 
                                className="nav-item dropdown admin-profile-display"
                                ref={profileRef}
                                onMouseEnter={handleMouseEnter}
                                onMouseLeave={handleMouseLeave}
                            >
                                <button
                                    className="nav-link dropdown-toggle profile-dropdown-btn"
                                    type="button"
                                    onClick={() => {
                                        setDropdownOpen(!dropdownOpen);
                                        setNotiOpen(false);
                                    }}
                                    aria-expanded={dropdownOpen}
                                >
                                    <div className="admin-avatar">
                                        {profile?.image ? (
                                            <img 
                                                src={profile.image} 
                                                alt="Admin" 
                                                className="avatar-img"
                                                title={profile?.full_name || 'Admin'}
                                            />
                                        ) : (
                                            <i className="fas fa-user"></i>
                                        )}
                                    </div>
                                </button>
                                
                                <ul className={`dropdown-menu admin-profile-dropdown ${dropdownOpen ? 'show' : ''}`}>
                                    <li className="admin-profile-header">
                                        <div className="admin-profile-header-user">
                                            <div className="admin-profile-header-avatar">
                                                {profile?.image ? (
                                                    <img 
                                                        src={profile.image} 
                                                        alt="Admin" 
                                                        className="admin-profile-header-avatar-img"
                                                    />
                                                ) : (
                                                    <span>{(userData?.full_name || 'A').charAt(0).toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div className="admin-profile-header-info">
                                                <div className="admin-profile-header-name" title={userData?.full_name || 'Administrator'}>
                                                    {userData?.full_name || 'Administrator'}
                                                </div>
                                                <div className="admin-profile-header-role">
                                                    <i className="fas fa-shield-alt me-1 text-warning"></i>
                                                    <span>{isSuperAdmin ? 'Super Administrator' : 'Administrator'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                    <li><hr className="admin-profile-divider" /></li>
                                    {renderDropdownItems(filteredMenuItems)}
                                    <li><hr className="admin-profile-divider" /></li>
                                    <li className="admin-profile-li">
                                        <Link 
                                            to="/" 
                                            className="dropdown-item admin-profile-item admin-profile-portal-link" 
                                            onClick={() => setDropdownOpen(false)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <span className="admin-profile-icon text-teal">
                                                <i className="fas fa-globe"></i>
                                            </span>
                                            <span className="admin-profile-text">Portal Publik LMS</span>
                                            <i className="fas fa-external-link-alt ms-auto" style={{ fontSize: '0.7rem', opacity: 0.6 }}></i>
                                        </Link>
                                    </li>
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
