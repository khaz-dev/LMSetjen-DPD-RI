import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { logout } from "../../../utils/auth";
import Toast, { LogoutConfirmation } from "../../plugin/Toast";

function Sidebar() {
    const location = useLocation();
    
    // Collapse state - synced with header via localStorage and events
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('instructorHeaderCollapsed');
        return saved === 'true';
    });

    // Listen for header toggle events to sync sidebar
    useEffect(() => {
        const handleHeaderToggle = (e) => {
            setIsCollapsed(e.detail.collapsed);
        };
        window.addEventListener('instructorHeaderToggle', handleHeaderToggle);
        return () => window.removeEventListener('instructorHeaderToggle', handleHeaderToggle);
    }, []);

    // Toggle sidebar collapse
    const toggleSidebarCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem('instructorHeaderCollapsed', newState.toString());
        // Notify header to sync
        window.dispatchEvent(new CustomEvent('instructorHeaderToggle', { detail: { collapsed: newState } }));
    };
    
    // Check if current path is active
    const isActive = (path) => {
        return location.pathname === path || location.pathname.startsWith(path);
    };

    const handleLogout = () => {
        LogoutConfirmation().then((result) => {
            if (result.isConfirmed) {
                // Show enhanced success toast
                Toast().fire({
                    icon: "success",
                    title: "Logout Berhasil! Terima kasih telah menggunakan platform kami.",
                });
                
                // Small delay for better UX
                setTimeout(() => {
                    logout();
                }, 1500);
            }
        });
    };

    return (
        <>
            <style>
                {`
                    /* Modern Toast Styles */
                    .modern-toast {
                        border-radius: 15px !important;
                        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15) !important;
                        border: 1px solid rgba(255, 255, 255, 0.2) !important;
                        backdrop-filter: blur(15px) !important;
                        font-family: 'Inter', sans-serif !important;
                    }
                    
                    .modern-progress-bar {
                        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%) !important;
                        border-radius: 0 0 15px 15px !important;
                        height: 4px !important;
                    }
                    
                    /* Modern Logout Dialog Styles */
                    .modern-logout-dialog {
                        border-radius: 20px !important;
                        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25) !important;
                        border: 1px solid rgba(255, 255, 255, 0.2) !important;
                        backdrop-filter: blur(15px) !important;
                        font-family: 'Inter', sans-serif !important;
                        padding: 2rem !important;
                    }
                    
                    .modern-confirm-btn {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                        border: none !important;
                        border-radius: 12px !important;
                        padding: 12px 24px !important;
                        font-weight: 600 !important;
                        font-size: 0.95rem !important;
                        color: white !important;
                        transition: all 0.3s ease !important;
                        margin: 0 8px !important;
                        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3) !important;
                    }
                    
                    .modern-confirm-btn:hover {
                        transform: translateY(-2px) !important;
                        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4) !important;
                        background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%) !important;
                    }
                    
                    .modern-cancel-btn {
                        background: transparent !important;
                        border: 2px solid #e53e3e !important;
                        border-radius: 12px !important;
                        padding: 10px 24px !important;
                        font-weight: 600 !important;
                        font-size: 0.95rem !important;
                        color: #e53e3e !important;
                        transition: all 0.3s ease !important;
                        margin: 0 8px !important;
                    }
                    
                    .modern-cancel-btn:hover {
                        background: #e53e3e !important;
                        color: white !important;
                        transform: translateY(-2px) !important;
                        box-shadow: 0 5px 15px rgba(229, 62, 62, 0.3) !important;
                    }
                    
                    .instructor-sidebar {
                        background: white;
                        border-radius: 16px;
                        box-shadow: 0 8px 30px rgba(52, 152, 219, 0.12);
                        border: 1px solid rgba(52, 152, 219, 0.08);
                        overflow: hidden;
                        position: sticky;
                        top: 70px;
                        z-index: 100;
                        transition: all 0.3s ease;
                        max-height: calc(100vh - 90px);
                        overflow-y: auto;
                        margin-top: -10px;
                    }
                    
                    .instructor-sidebar:hover {
                        box-shadow: 0 12px 40px rgba(52, 152, 219, 0.18);
                    }
                    
                    .instructor-sidebar-header {
                        background: linear-gradient(135deg, #3498db 0%, #2980b9 50%, #34495e 100%);
                        color: white;
                        padding: 1.5rem;
                        text-align: center;
                        position: relative;
                        overflow: hidden;
                        z-index: 1;
                    }
                    
                    .instructor-sidebar-header::before {
                        content: '';
                        position: absolute;
                        top: -50%;
                        right: -20%;
                        width: 60%;
                        height: 200%;
                        background: linear-gradient(45deg, rgba(255, 255, 255, 0.1), transparent);
                        transform: rotate(-15deg);
                    }
                    
                    .sidebar-content {
                        padding: 0 1.25rem 1.25rem 1.25rem;
                        position: relative;
                        z-index: 1;
                    }
                    
                    .nav-section-title {
                        font-size: 0.75rem;
                        font-weight: 600;
                        color: #34495e;
                        text-transform: uppercase;
                        letter-spacing: 0.8px;
                        margin-bottom: 0.75rem;
                        margin-top: 1.25rem;
                        padding-left: 0.5rem;
                    }
                    
                    .nav-section-title:first-child {
                        margin-top: 0;
                    }
                    
                    .instructor-nav-link {
                        display: flex;
                        align-items: center;
                        padding: 0.875rem 1rem;
                        color: #4a5568;
                        text-decoration: none;
                        border-radius: 10px;
                        margin-bottom: 0.25rem;
                        transition: all 0.3s ease;
                        font-weight: 500;
                        position: relative;
                        font-size: 0.9rem;
                        overflow: hidden;
                    }
                    
                    .instructor-nav-link::before {
                        content: '';
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 0;
                        height: 100%;
                        background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                        transition: width 0.3s ease;
                        z-index: 0;
                    }
                    
                    .instructor-nav-link > * {
                        position: relative;
                        z-index: 1;
                    }
                    
                    .instructor-nav-link:hover {
                        color: white;
                        transform: translateX(4px);
                        box-shadow: 0 6px 18px rgba(52, 152, 219, 0.5);
                        background: linear-gradient(135deg, rgba(52, 152, 219, 0.25) 0%, rgba(41, 128, 185, 0.25) 100%);
                    }
                    
                    .instructor-nav-link:hover::before {
                        width: 100%;
                    }
                    
                    .instructor-nav-link.active {
                        background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                        color: white;
                        transform: translateX(4px);
                        box-shadow: 0 8px 20px rgba(52, 152, 219, 0.4);
                    }
                    
                    .instructor-nav-link.active::before {
                        width: 100%;
                    }
                    
                    .instructor-nav-icon {
                        width: 18px;
                        height: 18px;
                        margin-right: 0.75rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 0.9rem;
                        transition: all 0.3s ease;
                    }
                    
                    .instructor-nav-link:hover .instructor-nav-icon,
                    .instructor-nav-link.active .instructor-nav-icon {
                        transform: scale(1.1);
                    }
                    
                    .instructor-logout-btn {
                        background: transparent;
                        border: 1.5px solid #e74c3c;
                        color: #e74c3c;
                        width: 100%;
                        margin-top: 1rem;
                        transition: all 0.3s ease;
                        border-radius: 10px;
                        padding: 0.875rem 1rem;
                        font-weight: 500;
                        font-size: 0.9rem;
                        display: flex;
                        align-items: center;
                        cursor: pointer;
                        position: relative;
                        overflow: hidden;
                    }
                    
                    .instructor-logout-btn::before {
                        content: '';
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 0;
                        height: 100%;
                        background: #e74c3c;
                        transition: width 0.3s ease;
                        z-index: 0;
                    }
                    
                    .instructor-logout-btn > * {
                        position: relative;
                        z-index: 1;
                    }
                    
                    .instructor-logout-btn:hover {
                        color: white;
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(231, 76, 60, 0.3);
                    }
                    
                    .instructor-logout-btn:hover::before {
                        width: 100%;
                    }
                    
                    .instructor-mobile-toggle {
                        background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                        border: none;
                        color: white;
                        border-radius: 10px;
                        padding: 0.875rem;
                        margin: 1rem;
                        transition: all 0.25s ease;
                        font-weight: 500;
                    }
                    
                    .instructor-mobile-toggle:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
                    }
                    
                    .instructor-divider {
                        height: 1px;
                        background: linear-gradient(90deg, transparent 0%, rgba(52, 152, 219, 0.15) 50%, transparent 100%);
                        margin: 1rem 0;
                    }
                    
                    /* Hide divider when sidebar is collapsed */
                    .instructor-sidebar.collapsed .instructor-divider {
                        display: none;
                    }
                    
                    @media (max-width: 768px) {
                        .instructor-sidebar {
                            border-radius: 12px;
                            margin-bottom: 1.5rem;
                        }
                        
                        .instructor-sidebar-header {
                            padding: 1.25rem;
                        }
                        
                        .sidebar-content {
                            padding: 1rem;
                        }
                        
                        .instructor-nav-link {
                            padding: 0.75rem 0.875rem;
                        }
                    }
                    
                    /* Sidebar Collapse Styles */
                    .instructor-sidebar {
                        transition: width 0.3s ease, padding 0.3s ease;
                        position: relative;
                    }
                    
                    .instructor-sidebar.collapsed {
                        width: 85px !important;
                        min-width: 85px;
                    }
                    
                    .instructor-sidebar.collapsed .sidebar-content {
                        padding: 0.5rem 0.25rem;
                    }
                    
                    .instructor-sidebar.collapsed .instructor-nav-link {
                        padding: 0.875rem 0.5rem;
                        justify-content: center;
                        text-align: center;
                        position: relative;
                    }
                    
                    .instructor-sidebar.collapsed .nav-text {
                        display: none;
                    }
                    
                    .instructor-sidebar.collapsed .nav-icon {
                        margin: 0 auto;
                        font-size: 1.25rem;
                    }
                    
                    .instructor-sidebar.collapsed .section-title {
                        font-size: 0;
                        height: 2px;
                        background: rgba(102, 126, 234, 0.1);
                        margin: 1rem 0.5rem;
                        padding: 0;
                    }
                    
                    /* Tooltip for collapsed nav items */
                    .instructor-sidebar.collapsed .instructor-nav-link::after {
                        content: attr(data-tooltip);
                        position: absolute;
                        left: 100%;
                        top: 50%;
                        transform: translateY(-50%);
                        margin-left: 10px;
                        padding: 8px 12px;
                        background: #2d3748;
                        color: white;
                        border-radius: 8px;
                        white-space: nowrap;
                        font-size: 0.85rem;
                        font-weight: 500;
                        opacity: 0;
                        pointer-events: none;
                        transition: opacity 0.2s ease;
                        z-index: 1000;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    }
                    
                    .instructor-sidebar.collapsed .instructor-nav-link::before {
                        content: '';
                        position: absolute;
                        left: 100%;
                        top: 50%;
                        transform: translateY(-50%);
                        margin-left: 5px;
                        border: 5px solid transparent;
                        border-right-color: #2d3748;
                        opacity: 0;
                        transition: opacity 0.2s ease;
                    }
                    
                    .instructor-sidebar.collapsed .instructor-nav-link:hover::after,
                    .instructor-sidebar.collapsed .instructor-nav-link:hover::before {
                        opacity: 1;
                    }
                    
                    /* Fix icon visibility on collapsed hover */
                    .instructor-sidebar.collapsed .instructor-nav-link:hover {
                        color: white;
                    }
                    
                    .instructor-sidebar.collapsed .instructor-nav-link:hover .nav-icon i,
                    .instructor-sidebar.collapsed .instructor-nav-link:hover .instructor-nav-icon i {
                        color: #f8fafc !important;
                    }
                    
                    .instructor-sidebar.collapsed .instructor-nav-link .nav-icon,
                    .instructor-sidebar.collapsed .instructor-nav-link .instructor-nav-icon {
                        color: inherit;
                    }
                    
                    .instructor-sidebar.collapsed .instructor-nav-link .nav-icon i,
                    .instructor-sidebar.collapsed .instructor-nav-link .instructor-nav-icon i {
                        color: #4a5568;
                    }
                    
                    /* Toggle button for sidebar - Now inside sidebar-content */
                    .sidebar-toggle-btn {
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        background: rgba(102, 126, 234, 0.1);
                        border: 1.5px solid rgba(102, 126, 234, 0.3);
                        color: #667eea;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.3s ease;
                        z-index: 1000;
                        backdrop-filter: blur(10px);
                    }
                    
                    /* Position toggle at top when collapsed (on top of nav section title) */
                    .instructor-sidebar.collapsed .sidebar-toggle-btn {
                        top: 5px;
                    }
                    
                    /* Position toggle aligned with header when expanded */
                    .instructor-sidebar:not(.collapsed) .sidebar-toggle-btn {
                        top: 10px;
                    }
                    
                    .sidebar-toggle-btn:hover {
                        background: rgba(102, 126, 234, 0.2);
                        border-color: #667eea;
                        transform: scale(1.1);
                    }
                    
                    .sidebar-toggle-btn i {
                        font-size: 1rem;
                        transition: transform 0.3s ease;
                        color: #667eea;
                    }
                    
                    .instructor-sidebar.collapsed .sidebar-toggle-btn i {
                        transform: rotate(180deg);
                    }
                    
                    /* Hide toggle on mobile */
                    @media (max-width: 768px) {
                        .sidebar-toggle-btn {
                            display: none;
                        }
                        
                        .instructor-sidebar.collapsed {
                            width: 100% !important;
                        }
                    }
                    
                    /* Adjust logout button for collapsed state */
                    .instructor-sidebar.collapsed .instructor-logout-btn {
                        padding: 0.875rem 0.5rem;
                        justify-content: center;
                    }
                    
                    .instructor-sidebar.collapsed .instructor-logout-btn .nav-text {
                        display: none;
                    }
                `}
            </style>
            
            <div className="col-lg-3 col-md-4 col-12">
                <nav className={`instructor-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
                    {/* Mobile Header */}
                    <div className="d-md-none">
                        <div className="instructor-sidebar-header">
                            <h6 className="mb-0 fw-bold">Instructor Panel</h6>
                            <p className="mb-0 opacity-90 small">Manage your courses</p>
                        </div>
                        <button
                            className="instructor-mobile-toggle w-100"
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target="#instructorSidenav"
                            aria-controls="instructorSidenav"
                            aria-expanded="false"
                            aria-label="Toggle navigation"
                        >
                            <i className="bi bi-grid me-2"></i>Menu
                        </button>
                    </div>

                    {/* Desktop Header */}
                    {!isCollapsed && (
                        <div className="d-none d-md-block instructor-sidebar-header">
                            <h5 className="mb-1 fw-bold">Instructor Dashboard</h5>
                            <p className="mb-0 opacity-90 small">Manage courses & students</p>
                        </div>
                    )}

                    <div className="collapse navbar-collapse show" id="instructorSidenav">
                        <div className="sidebar-content">
                            {/* Collapse Toggle Button (Desktop only) - Moved inside content */}
                            <button 
                                className="sidebar-toggle-btn d-none d-md-flex"
                                onClick={toggleSidebarCollapse}
                                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                            >
                                <i className="bi bi-chevron-left"></i>
                            </button>

                            {/* Main Navigation */}
                            <div className="nav-section-title section-title">Course Management</div>
                            <div className="d-flex flex-column">
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/dashboard') ? 'active' : ''}`} 
                                    to="/instructor/dashboard/"
                                    data-tooltip="Dashboard"
                                >
                                    <div className="instructor-nav-icon nav-icon">
                                        <i className="bi bi-grid-fill"></i>
                                    </div>
                                    <span className="nav-text">Dashboard</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/courses') ? 'active' : ''}`} 
                                    to="/instructor/courses/"
                                    data-tooltip="My Courses"
                                >
                                    <div className="instructor-nav-icon nav-icon">
                                        <i className="fas fa-book-open"></i>
                                    </div>
                                    <span className="nav-text">My Courses</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/create-course') ? 'active' : ''}`} 
                                    to="/instructor/create-course/"
                                    data-tooltip="Create Course"
                                >
                                    <div className="instructor-nav-icon nav-icon">
                                        <i className="fas fa-plus-circle"></i>
                                    </div>
                                    <span className="nav-text">Create Course</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/students') ? 'active' : ''}`} 
                                    to="/instructor/students/"
                                    data-tooltip="Students"
                                >
                                    <div className="instructor-nav-icon nav-icon">
                                        <i className="fas fa-user-graduate"></i>
                                    </div>
                                    <span className="nav-text">Students</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/reviews') ? 'active' : ''}`} 
                                    to="/instructor/reviews/"
                                    data-tooltip="Reviews"
                                >
                                    <div className="instructor-nav-icon nav-icon">
                                        <i className="fas fa-star"></i>
                                    </div>
                                    <span className="nav-text">Reviews</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/question-answer') ? 'active' : ''}`} 
                                    to="/instructor/question-answer/"
                                    data-tooltip="Q&A Forum"
                                >
                                    <div className="instructor-nav-icon nav-icon">
                                        <i className="fas fa-comments"></i>
                                    </div>
                                    <span className="nav-text">Q&A Forum</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/notifications') ? 'active' : ''}`} 
                                    to="/instructor/notifications/"
                                    data-tooltip="Notifications"
                                >
                                    <div className="instructor-nav-icon nav-icon">
                                        <i className="fas fa-bell"></i>
                                    </div>
                                    <span className="nav-text">Notifications</span>
                                </Link>
                            </div>

                            <div className="instructor-divider"></div>

                            {/* Account Settings */}
                            <div className="nav-section-title section-title">Account Settings</div>
                            <div className="d-flex flex-column">
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/profile') ? 'active' : ''}`} 
                                    to="/instructor/profile/"
                                    data-tooltip="Edit Profile"
                                >
                                    <div className="instructor-nav-icon nav-icon">
                                        <i className="fas fa-user-edit"></i>
                                    </div>
                                    <span className="nav-text">Edit Profile</span>
                                </Link>
                                
                                <Link 
                                    className={`instructor-nav-link ${isActive('/instructor/change-password') ? 'active' : ''}`} 
                                    to="/instructor/change-password/"
                                    data-tooltip="Change Password"
                                >
                                    <div className="instructor-nav-icon nav-icon">
                                        <i className="fas fa-shield-alt"></i>
                                    </div>
                                    <span className="nav-text">Change Password</span>
                                </Link>
                            </div>

                            {/* Logout Button */}
                            <button 
                                onClick={handleLogout}
                                className="instructor-logout-btn"
                                data-tooltip="Sign Out"
                            >
                                <div className="instructor-nav-icon nav-icon" style={{ marginRight: isCollapsed ? '0' : '0.75rem' }}>
                                    <i className="fas fa-sign-out-alt"></i>
                                </div>
                                <span className="nav-text">Sign Out</span>
                            </button>
                        </div>
                    </div>
                </nav>
            </div>
        </>
    );
}

export default React.memo(Sidebar);