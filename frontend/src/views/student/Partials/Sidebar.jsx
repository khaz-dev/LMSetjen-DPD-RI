import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { logout } from "../../../utils/auth";
import Toast, { LogoutConfirmation } from "../../plugin/Toast";
import { triggerSidebarCollapseEvent } from "./useSidebarCollapse";
import "./Sidebar.css";

function Sidebar() {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem("studentSidebarCollapsed");
        return saved === "true";
    });

    const toggleSidebarCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem("studentSidebarCollapsed", newState.toString());
        // ✨ Trigger event for all pages to adapt their layout
        triggerSidebarCollapseEvent();
    };
    
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
        <div className="col-lg-3 col-md-4 col-12 student-sidebar-column">
            <nav className={`modern-sidebar ${isCollapsed ? "collapsed" : ""}`}>
                {/* Mobile Header */}
                <div className="d-md-none">
                    <div className="sidebar-header">
                        <h6 className="mb-0 fw-bold">Menu Siswa</h6>
                    </div>
                    <button
                        className="mobile-toggle w-100"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#modernSidenav"
                        aria-controls="modernSidenav"
                        aria-expanded="false"
                        aria-label="Buka navigasi"
                    >
                        <i className="bi bi-grid me-2"></i>Menu
                    </button>
                </div>

                {/* Desktop Header - Expanded State */}
                {!isCollapsed && (
                    <div className="d-none d-md-flex sidebar-header">
                        <div style={{ flex: 1 }}>
                            <h5 className="mb-1 fw-bold">Portal Siswa</h5>
                            <p className="mb-0 opacity-90 small">Kelola perjalanan belajar Anda</p>
                        </div>
                        <button 
                            className="sidebar-toggle-btn d-flex"
                            onClick={toggleSidebarCollapse}
                            title="Ciutkan sidebar"
                        >
                            <i className="bi bi-chevron-left"></i>
                        </button>
                    </div>
                )}

                {/* Desktop Header - Collapsed State */}
                {isCollapsed && (
                    <div className="d-none d-md-flex sidebar-header-collapsed">
                        <button 
                            className="sidebar-expand-btn d-flex"
                            onClick={toggleSidebarCollapse}
                            title="Perluas sidebar"
                        >
                            <i className="bi bi-chevron-right"></i>
                        </button>
                    </div>
                )}

                <div className="collapse navbar-collapse show" id="modernSidenav">
                    <div className="sidebar-content">
                        {/* Main Navigation */}
                        <div className="nav-section-title section-title">Pembelajaran</div>
                        <div className="d-flex flex-column">
                            <Link 
                                className={`modern-nav-link ${isActive("/student/dashboard") ? "active" : ""}`} 
                                to="/student/dashboard/"
                                data-tooltip="Dasbor"
                            >
                                <div className="nav-icon">
                                    <i className="bi bi-grid-fill"></i>
                                </div>
                                <span className="nav-text">Dasbor</span>
                            </Link>
                            
                            <Link 
                                className={`modern-nav-link ${isActive("/student/courses") ? "active" : ""}`} 
                                to="/student/courses/"
                                data-tooltip="Kursus Saya"
                            >
                                <div className="nav-icon">
                                    <i className="fas fa-graduation-cap"></i>
                                </div>
                                <span className="nav-text">Kursus Saya</span>
                            </Link>
                            
                            <Link 
                                className={`modern-nav-link ${isActive("/student/wishlist") ? "active" : ""}`} 
                                to="/student/wishlist/"
                                data-tooltip="Daftar Keinginan"
                            >
                                <div className="nav-icon">
                                    <i className="fas fa-bookmark"></i>
                                </div>
                                <span className="nav-text">Daftar Keinginan</span>
                            </Link>
                            
                            <Link 
                                className={`modern-nav-link ${isActive("/student/question-answer") ? "active" : ""}`} 
                                to="/student/question-answer/"
                                data-tooltip="Forum T&J"
                            >
                                <div className="nav-icon">
                                    <i className="fas fa-comments"></i>
                                </div>
                                <span className="nav-text">Forum T&J</span>
                            </Link>
                        </div>

                        <div className="sidebar-divider"></div>

                        {/* Account Settings */}
                        <div className="nav-section-title section-title">Pengaturan Akun</div>
                        <div className="d-flex flex-column">
                            <Link 
                                className={`modern-nav-link ${isActive("/student/profile") ? "active" : ""}`} 
                                to="/student/profile/"
                                data-tooltip="Edit Profil"
                            >
                                <div className="nav-icon">
                                    <i className="fas fa-user-edit"></i>
                                </div>
                                <span className="nav-text">Edit Profil</span>
                            </Link>
                            
                            <Link 
                                className={`modern-nav-link ${isActive("/student/testimonials") ? "active" : ""}`} 
                                to="/student/testimonials/"
                                data-tooltip="Testimoni"
                            >
                                <div className="nav-icon">
                                    <i className="fas fa-quote-left"></i>
                                </div>
                                <span className="nav-text">Testimoni</span>
                            </Link>
                        </div>

                        {/* Logout Button */}
                        <button 
                            onClick={handleLogout}
                            className={`modern-logout-btn ${isCollapsed ? "collapsed" : ""}`}
                            data-tooltip="Keluar"
                        >
                            <div className="nav-icon">
                                <i className="fas fa-sign-out-alt"></i>
                            </div>
                            <span className="nav-text">Keluar</span>
                        </button>
                    </div>
                </div>
            </nav>
        </div>
    );
}

export default React.memo(Sidebar);
