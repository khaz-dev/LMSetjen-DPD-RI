import React from "react";
import { Link, useLocation } from "react-router-dom";
import { logout } from "../../../utils/auth";
import Toast, { LogoutConfirmation } from "../../plugin/Toast";
import "./Sidebar.css";

function Sidebar() {
    const location = useLocation();
    
    // Check if current path is active
    const isActive = (path) => {
        return location.pathname === path || location.pathname.startsWith(path);
    };
    
    const handleLogout = () => {
        LogoutConfirmation().then((result) => {
            if (result.isConfirmed) {
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
        <div className="col-lg-3 col-md-4 col-12">
            <nav className="modern-sidebar">
                {/* Mobile Header */}
                <div className="d-md-none">
                    <div className="sidebar-header">
                        <h6 className="mb-0 fw-bold">Student Menu</h6>
                    </div>
                    <button
                        className="mobile-toggle w-100"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#modernSidenav"
                        aria-controls="modernSidenav"
                        aria-expanded="false"
                        aria-label="Toggle navigation"
                    >
                        <i className="bi bi-grid me-2"></i>Menu
                    </button>
                </div>

                {/* Desktop Header */}
                <div className="d-none d-md-block sidebar-header">
                    <h5 className="mb-1 fw-bold">Student Portal</h5>
                    <p className="mb-0 opacity-90 small">Manage your learning journey</p>
                </div>

                <div className="collapse navbar-collapse show" id="modernSidenav">
                    <div className="sidebar-content">
                        {/* Main Navigation */}
                        <div className="nav-section-title">Learning</div>
                        <div className="d-flex flex-column">
                            <Link 
                                className={`modern-nav-link ${isActive('/student/dashboard') ? 'active' : ''}`} 
                                to="/student/dashboard/"
                            >
                                <div className="nav-icon">
                                    <i className="bi bi-grid-fill"></i>
                                </div>
                                <span>Dashboard</span>
                            </Link>
                            
                            <Link 
                                className={`modern-nav-link ${isActive('/student/courses') ? 'active' : ''}`} 
                                to="/student/courses/"
                            >
                                <div className="nav-icon">
                                    <i className="fas fa-graduation-cap"></i>
                                </div>
                                <span>My Courses</span>
                            </Link>
                            
                            <Link 
                                className={`modern-nav-link ${isActive('/student/wishlist') ? 'active' : ''}`} 
                                to="/student/wishlist/"
                            >
                                <div className="nav-icon">
                                    <i className="fas fa-bookmark"></i>
                                </div>
                                <span>Wishlist</span>
                            </Link>
                            
                            <Link 
                                className={`modern-nav-link ${isActive('/student/question-answer') ? 'active' : ''}`} 
                                to="/student/question-answer/"
                            >
                                <div className="nav-icon">
                                    <i className="fas fa-comments"></i>
                                </div>
                                <span>Q&A Forum</span>
                            </Link>
                        </div>

                        <div className="sidebar-divider"></div>

                        {/* Account Settings */}
                        <div className="nav-section-title">Account Settings</div>
                        <div className="d-flex flex-column">
                            <Link 
                                className={`modern-nav-link ${isActive('/student/profile') ? 'active' : ''}`} 
                                to="/student/profile/"
                            >
                                <div className="nav-icon">
                                    <i className="fas fa-user-edit"></i>
                                </div>
                                <span>Edit Profile</span>
                            </Link>
                            
                            <Link 
                                className={`modern-nav-link ${isActive('/student/change-password') ? 'active' : ''}`} 
                                to="/student/change-password/"
                            >
                                <div className="nav-icon">
                                    <i className="fas fa-shield-alt"></i>
                                </div>
                                <span>Change Password</span>
                            </Link>
                        </div>

                        {/* Logout Button */}
                        <button 
                            onClick={handleLogout}
                            className="modern-nav-link logout-btn"
                        >
                            <div className="nav-icon">
                                <i className="fas fa-sign-out-alt"></i>
                            </div>
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </nav>
        </div>
    );
}

export default Sidebar;
