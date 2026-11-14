import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import UserData from '../plugin/UserData';
import RoleIndicator from '../../components/RoleIndicator';
import { ProfileContext } from '../plugin/Context';
import apiInstance from '../../utils/axios';
import '../../components/Notification/InAppNotificationBell.css';
import './AdminHeader.css';

function AdminHeader() {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [notiOpen, setNotiOpen] = useState(false);
    const [notiFilterStatus, setNotiFilterStatus] = useState('all'); // 'all' | 'actionable'
    const [hoverTimeout, setHoverTimeout] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);

    const [headerStats, setHeaderStats] = useState({
        status: 'online',
        active_users: 1,
        online_users: 1,
        total_users: 0,
        pending_courses: 0,
        pending_instructor_requests: 0,
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

    // Helper ikon dan label metadata notifikasi admin selaras dengan style InAppNotificationBell
    const getAdminNotiMeta = useCallback((item) => {
        const cat = item?.category || '';
        const bType = item?.badge_type || '';
        if (cat === 'instructor_request' || cat === 'instructor') {
            return {
                icon: 'fas fa-chalkboard-teacher',
                badgeClass: 'badge-teal',
                label: item?.badge || 'Permintaan Instruktur',
                dotColor: '#0d9488',
                isActionable: true
            };
        }
        if (cat === 'course' || bType === 'warning') {
            return {
                icon: 'fas fa-book-reader',
                badgeClass: 'badge-amber',
                label: item?.badge || 'Review Kursus',
                dotColor: '#d97706',
                isActionable: true
            };
        }
        if (cat === 'abuse' || bType === 'danger') {
            return {
                icon: 'fas fa-triangle-exclamation',
                badgeClass: 'badge-rose',
                label: item?.badge || 'Laporan Ulasan',
                dotColor: '#e11d48',
                isActionable: true
            };
        }
        if (cat === 'testimonial' || bType === 'info') {
            return {
                icon: 'fas fa-quote-right',
                badgeClass: 'badge-sky',
                label: item?.badge || 'Kurasi Testimoni',
                dotColor: '#0284c7',
                isActionable: true
            };
        }
        if (cat === 'feedback' || bType === 'purple') {
            const isBug = (item?.badge || '').toLowerCase().includes('bug');
            return {
                icon: isBug ? 'fas fa-bug' : 'fas fa-lightbulb',
                badgeClass: isBug ? 'badge-rose' : 'badge-purple',
                label: item?.badge || 'Masukan Pengguna',
                dotColor: isBug ? '#e11d48' : '#9333ea',
                isActionable: true
            };
        }
        return {
            icon: 'fas fa-shield-halved',
            badgeClass: 'badge-teal',
            label: item?.badge || 'Sistem Admin',
            dotColor: '#0f766e',
            isActionable: false
        };
    }, []);

    // Filter ketat: pastikan pengingat target 20 JP ASN atau notifikasi belajar personal tidak pernah muncul di Admin
    const safeAdminNotifications = useMemo(() => {
        const rawList = Array.isArray(headerStats?.notifications) ? headerStats.notifications : [];
        return rawList.filter(item => {
            const title = (item?.title || '').toLowerCase();
            const msg = (item?.message || '').toLowerCase();
            const badge = (item?.badge || '').toLowerCase();
            const type = (item?.type || '').toLowerCase();
            if (
                title.includes('target 20 jp') ||
                msg.includes('target 20 jp') ||
                title.includes('20 jp') ||
                msg.includes('20 jp') ||
                badge.includes('20 jp') ||
                type.includes('target reminder') ||
                title.includes('learning nudge') ||
                title.includes('microlearning') ||
                title.includes('flashcard') ||
                item?.category === 'personal'
            ) {
                return false;
            }
            return true;
        });
    }, [headerStats?.notifications]);

    // Hitung item yang perlu tindakan admin
    const actionableAlertsCount = useMemo(() => {
        return safeAdminNotifications.filter(item => getAdminNotiMeta(item).isActionable).length;
    }, [safeAdminNotifications, getAdminNotiMeta]);

    // Tampilkan notifikasi sesuai tab filter 'all' vs 'actionable'
    const displayedAdminNotifs = useMemo(() => {
        if (notiFilterStatus === 'actionable') {
            return safeAdminNotifications.filter(item => getAdminNotiMeta(item).isActionable);
        }
        return safeAdminNotifications;
    }, [safeAdminNotifications, notiFilterStatus, getAdminNotiMeta]);

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
                                className={`nav-link notification-btn ${notiOpen ? 'active' : ''}`}
                                type="button"
                                onClick={() => {
                                    setNotiOpen(!notiOpen);
                                    setDropdownOpen(false);
                                }}
                                title="Pusat Notifikasi & Tindakan Tertunda Admin"
                                aria-expanded={notiOpen}
                                aria-label="Notifikasi Administrator"
                            >
                                <i className="fas fa-bell"></i>
                                {actionableAlertsCount > 0 && (
                                    <span className="notification-badge pulse-badge" title={`${actionableAlertsCount} tindakan tertunda`}>
                                        <span className="notification-badge-number">{actionableAlertsCount > 99 ? '99+' : actionableAlertsCount}</span>
                                    </span>
                                )}
                            </button>
                            {notiOpen && (
                                <div className="in-app-noti-dropdown shadow-lg">
                                    {/* Header Panel */}
                                    <div className="in-app-noti-header">
                                        <div className="d-flex align-items-center justify-content-between w-100 mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <h6 className="in-app-noti-title mb-0">
                                                    Notifikasi Admin
                                                </h6>
                                                {actionableAlertsCount > 0 ? (
                                                    <span className="in-app-noti-unread-count">
                                                        {actionableAlertsCount} baru
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle py-1 px-2" style={{ fontSize: '0.68rem', borderRadius: '6px' }}>
                                                        <i className="fas fa-check-circle me-1"></i> Terpantau
                                                    </span>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                className="in-app-noti-mark-all"
                                                onClick={() => fetchHeaderStats()}
                                                disabled={loadingStats}
                                                title="Segarkan notifikasi dan tindakan tertunda"
                                            >
                                                <i className={`fas fa-sync-alt me-1 ${loadingStats ? 'fa-spin' : ''}`}></i>
                                                {loadingStats ? 'Memuat...' : 'Segarkan'}
                                            </button>
                                        </div>

                                        {/* Filter Bar (Semua / Belum Ditindak) */}
                                        <div className="in-app-noti-filter-bar">
                                            <div className="filter-pill-group">
                                                <button
                                                    type="button"
                                                    className={`filter-pill-btn ${notiFilterStatus === 'all' ? 'active' : ''}`}
                                                    onClick={() => setNotiFilterStatus('all')}
                                                >
                                                    Semua ({safeAdminNotifications.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`filter-pill-btn ${notiFilterStatus === 'actionable' ? 'active' : ''}`}
                                                    onClick={() => setNotiFilterStatus('actionable')}
                                                >
                                                    Perlu Ditindak ({actionableAlertsCount})
                                                </button>
                                            </div>
                                            <span className="noti-role-context-hint">
                                                Fokus: Tata Kelola
                                            </span>
                                        </div>
                                    </div>

                                    {/* Notification List Body */}
                                    <div className="in-app-noti-list">
                                        {displayedAdminNotifs.length === 0 ? (
                                            <div className="in-app-noti-empty">
                                                <div className="in-app-noti-empty-icon">
                                                    <i className={notiFilterStatus === 'actionable' ? 'fas fa-check-circle text-success' : 'fas fa-bell-slash'}></i>
                                                </div>
                                                <div className="in-app-noti-empty-text">
                                                    {notiFilterStatus === 'actionable'
                                                        ? 'Semua tindakan operasional telah selesai'
                                                        : 'Belum ada notifikasi baru untuk Admin'}
                                                </div>
                                                <div className="in-app-noti-empty-sub">
                                                    Pemberitahuan verifikasi kursus baru, pengajuan instruktur, laporan ulasan pengguna, testimoni, dan masukan akan tampil di sini.
                                                </div>
                                            </div>
                                        ) : (
                                            displayedAdminNotifs.slice(0, 15).map((item, idx) => {
                                                const meta = getAdminNotiMeta(item);
                                                return (
                                                    <div 
                                                        key={item.id || idx}
                                                        className={`in-app-noti-item ${meta.isActionable ? 'unread' : 'read'}`}
                                                        onClick={() => handleNotificationClick(item)}
                                                    >
                                                        <div className={`in-app-noti-item-icon ${meta.badgeClass}`}>
                                                            <i className={meta.icon}></i>
                                                        </div>

                                                        <div className="in-app-noti-item-content">
                                                            <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                                                <span className={`in-app-noti-type-tag ${meta.badgeClass}`}>
                                                                    {meta.label}
                                                                </span>
                                                                <span className="in-app-noti-time">{item.time || 'Baru'}</span>
                                                            </div>

                                                            <div className="in-app-noti-heading" title={item.title}>
                                                                {item.title}
                                                            </div>

                                                            {item.message && (
                                                                <div className="in-app-noti-msg" title={item.message}>
                                                                    {item.message}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {meta.isActionable && (
                                                            <div className="in-app-noti-dot" style={{ backgroundColor: meta.dotColor }}></div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Footer Section */}
                                    <div className="in-app-noti-footer d-flex align-items-center justify-content-between">
                                        <span className="in-app-noti-footer-tip">
                                            Tata kelola & moderasi platform
                                        </span>
                                        <Link 
                                            to="/admin/reports/" 
                                            className="in-app-noti-view-activities-btn"
                                            onClick={() => setNotiOpen(false)}
                                        >
                                            Buka Laporan & Masukan <i className="fas fa-arrow-right ms-1"></i>
                                        </Link>
                                    </div>
                                </div>
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
