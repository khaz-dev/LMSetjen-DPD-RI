import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { logout } from "../../../utils/auth";
import Toast, { LogoutConfirmation } from "../../plugin/Toast";
import "./Sidebar.css";

function Sidebar() {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('instructorSidebarCollapsed');
        return saved === 'true';
    });

    const toggleSidebarCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem('instructorSidebarCollapsed', newState.toString());
    };
    
    const isActive = (path) => location.pathname === path || location.pathname.startsWith(path);

    const handleLogout = () => {
        LogoutConfirmation().then((result) => {
            if (result.isConfirmed) {
                Toast().fire({
                    icon: "success",
                    title: "Logout Berhasil! Terima kasih telah menggunakan platform kami.",
                });
                setTimeout(() => {
                    logout();
                }, 1500);
            }
        });
    };

    return (
        <div className="col-lg-3 col-md-4 col-12 instructor-sidebar-column">
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

                {/* Desktop Header - Expanded State */}
                {!isCollapsed && (
                    <div className="d-none d-md-flex instructor-sidebar-header">
                        <div style={{ flex: 1 }}>
                            <h5 className="mb-1 fw-bold">Instructor Dashboard</h5>
                            <p className="mb-0 opacity-90 small">Manage courses & students</p>
                        </div>
                        <button 
                            className="sidebar-toggle-btn d-flex"
                            onClick={toggleSidebarCollapse}
                            title="Collapse sidebar"
                        >
                            <i className="bi bi-chevron-left"></i>
                        </button>
                    </div>
                )}

                {/* Desktop Header - Collapsed State */}
                {isCollapsed && (
                    <div className="d-none d-md-flex instructor-sidebar-header-collapsed">
                        <button 
                            className="sidebar-expand-btn d-flex"
                            onClick={toggleSidebarCollapse}
                            title="Expand sidebar"
                        >
                            <i className="bi bi-chevron-right"></i>
                        </button>
                    </div>
                )}

                <div className="collapse navbar-collapse show" id="instructorSidenav">
                    <div className="sidebar-content">
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
                            className={`instructor-logout-btn ${isCollapsed ? 'collapsed' : ''}`}
                            data-tooltip="Sign Out"
                        >
                            <div className="instructor-nav-icon nav-icon">
                                <i className="fas fa-sign-out-alt"></i>
                            </div>
                            <span className="nav-text">Sign Out</span>
                        </button>
                    </div>
                </div>
            </nav>
        </div>
    );
}

export default React.memo(Sidebar);
