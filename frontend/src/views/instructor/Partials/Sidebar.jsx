import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { logout } from "../../../utils/auth";
import Toast, { LogoutConfirmation } from "../../plugin/Toast";
import { triggerInstructorSidebarCollapseEvent } from "./useInstructorSidebarCollapse";
import "./Sidebar.css";

function Sidebar() {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem("instructorSidebarCollapsed");
        return saved === "true";
    });

    const toggleSidebarCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem("instructorSidebarCollapsed", newState.toString());
        // ✨ Trigger event for all pages to adapt their layout
        triggerInstructorSidebarCollapseEvent();
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
            <nav className={`instructor-sidebar ${isCollapsed ? "collapsed" : ""}`}>
                {/* Mobile Header */}
                <div className="d-md-none">
                    <div className="instructor-sidebar-header">
                        <h6 className="mb-0 fw-bold">Panel Instruktur</h6>
                        <p className="mb-0 opacity-90 small">Kelola kursus Anda</p>
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
                            <h5 className="mb-1 fw-bold">Dasbor Instruktur</h5>
                            <p className="mb-0 opacity-90 small">Kelola kursus & siswa</p>
                        </div>
                        <button 
                            className="sidebar-toggle-btn d-flex"
                            onClick={toggleSidebarCollapse}
                            title="Tutup bilah sisi"
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
                            title="Perluas bilah sisi"
                        >
                            <i className="bi bi-chevron-right"></i>
                        </button>
                    </div>
                )}

                <div className="collapse navbar-collapse show" id="instructorSidenav">
                    <div className="sidebar-content">
                        {/* Main Navigation */}
                        <div className="nav-section-title section-title">Manajemen Kursus</div>
                        <div className="d-flex flex-column">
                            <Link 
                                className={`instructor-nav-link ${isActive("/instructor/dashboard") ? "active" : ""}`} 
                                to="/instructor/dashboard/"
                                data-tooltip="Dasbor"
                            >
                                <div className="instructor-nav-icon nav-icon">
                                    <i className="bi bi-grid-fill"></i>
                                </div>
                                <span className="nav-text">Dasbor</span>
                            </Link>
                            
                            <Link 
                                className={`instructor-nav-link ${isActive("/instructor/courses") ? "active" : ""}`} 
                                to="/instructor/courses/"
                                data-tooltip="Kursus Saya"
                            >
                                <div className="instructor-nav-icon nav-icon">
                                    <i className="fas fa-book-open"></i>
                                </div>
                                <span className="nav-text">Kursus Saya</span>
                            </Link>
                            
                            <Link 
                                className={`instructor-nav-link ${isActive("/instructor/create-course") ? "active" : ""}`} 
                                to="/instructor/create-course/"
                                data-tooltip="Buat Kursus"
                            >
                                <div className="instructor-nav-icon nav-icon">
                                    <i className="fas fa-plus-circle"></i>
                                </div>
                                <span className="nav-text">Buat Kursus</span>
                            </Link>
                            
                            <Link 
                                className={`instructor-nav-link ${isActive("/instructor/students") ? "active" : ""}`} 
                                to="/instructor/students/"
                                data-tooltip="Siswa"
                            >
                                <div className="instructor-nav-icon nav-icon">
                                    <i className="fas fa-user-graduate"></i>
                                </div>
                                <span className="nav-text">Siswa</span>
                            </Link>
                            
                            <Link 
                                className={`instructor-nav-link ${isActive("/instructor/reviews") ? "active" : ""}`} 
                                to="/instructor/reviews/"
                                data-tooltip="Ulasan"
                            >
                                <div className="instructor-nav-icon nav-icon">
                                    <i className="fas fa-star"></i>
                                </div>
                                <span className="nav-text">Ulasan</span>
                            </Link>
                            
                            <Link 
                                className={`instructor-nav-link ${isActive("/instructor/question-answer") ? "active" : ""}`} 
                                to="/instructor/question-answer/"
                                data-tooltip="Forum T&J"
                            >
                                <div className="instructor-nav-icon nav-icon">
                                    <i className="fas fa-comments"></i>
                                </div>
                                <span className="nav-text">Forum T&J</span>
                            </Link>
                            
                            <Link 
                                className={`instructor-nav-link ${isActive("/instructor/notifications") ? "active" : ""}`} 
                                to="/instructor/notifications/"
                                data-tooltip="Notifikasi"
                            >
                                <div className="instructor-nav-icon nav-icon">
                                    <i className="fas fa-bell"></i>
                                </div>
                                <span className="nav-text">Notifikasi</span>
                            </Link>
                        </div>

                        <div className="instructor-divider"></div>

                        {/* Account Settings */}
                        <div className="nav-section-title section-title">Pengaturan Akun</div>
                        <div className="d-flex flex-column">
                            <Link 
                                className={`instructor-nav-link ${isActive("/instructor/profile") ? "active" : ""}`} 
                                to="/instructor/profile/"
                                data-tooltip="Edit Profil"
                            >
                                <div className="instructor-nav-icon nav-icon">
                                    <i className="fas fa-user-edit"></i>
                                </div>
                                <span className="nav-text">Edit Profil</span>
                            </Link>
                            
                            <Link 
                                className={`instructor-nav-link ${isActive("/instructor/testimonials") ? "active" : ""}`} 
                                to="/instructor/testimonials/"
                                data-tooltip="Testimoni"
                            >
                                <div className="instructor-nav-icon nav-icon">
                                    <i className="fas fa-quote-left"></i>
                                </div>
                                <span className="nav-text">Testimoni</span>
                            </Link>
                        </div>

                        {/* Logout Button */}
                        <button 
                            onClick={handleLogout}
                            className={`instructor-logout-btn ${isCollapsed ? "collapsed" : ""}`}
                            data-tooltip="Keluar"
                        >
                            <div className="instructor-nav-icon nav-icon">
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
