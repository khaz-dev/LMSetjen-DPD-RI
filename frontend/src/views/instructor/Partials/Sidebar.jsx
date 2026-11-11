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

    // Accurate active path checking
    const isActive = (path) => {
        const current = location.pathname;
        if (path === "/instructor/dashboard/" || path === "/instructor/dashboard") {
            return current === "/instructor/dashboard/" || current === "/instructor/dashboard";
        }
        if (path === "/instructor/courses/" || path === "/instructor/courses") {
            return (
                current === "/instructor/courses/" ||
                current === "/instructor/courses" ||
                current.startsWith("/instructor/course-edit/") ||
                current.startsWith("/instructor/course-quiz/")
            );
        }
        return current === path || current.startsWith(path);
    };

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
        <div className={`col-lg-3 col-md-4 col-12 instructor-sidebar-column ${isCollapsed ? "collapsed" : ""}`}>
            <nav className={`instructor-sidebar ${isCollapsed ? "collapsed" : ""}`}>
                {/* Mobile Header */}
                <div className="d-md-none">
                    <div className="instructor-sidebar-header">
                        <div className="sidebar-header-brand-wrap">
                            <div className="sidebar-header-icon-box">
                                <i className="fas fa-chalkboard-user"></i>
                            </div>
                            <div className="sidebar-header-text">
                                <h6 className="sidebar-header-title">Panel Instruktur</h6>
                                <span className="sidebar-header-badge">LMSetjen DPD RI</span>
                            </div>
                        </div>
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
                        <i className="bi bi-grid me-2"></i>Menu Navigasi
                    </button>
                </div>

                {/* Desktop Header - Expanded State */}
                {!isCollapsed && (
                    <div className="d-none d-md-flex instructor-sidebar-header">
                        <div className="sidebar-header-brand-wrap">
                            <div className="sidebar-header-icon-box">
                                <i className="fas fa-chalkboard-user"></i>
                            </div>
                            <div className="sidebar-header-text">
                                <h6 className="sidebar-header-title">Menu Instruktur</h6>
                                <span className="sidebar-header-badge">LMSetjen DPD RI</span>
                            </div>
                        </div>
                        <button
                            className="sidebar-toggle-btn d-flex"
                            onClick={toggleSidebarCollapse}
                            title="Tutup bilah sisi"
                            aria-label="Tutup bilah sisi"
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
                            aria-label="Perluas bilah sisi"
                        >
                            <i className="bi bi-chevron-right"></i>
                        </button>
                    </div>
                )}

                <div className="collapse navbar-collapse show" id="instructorSidenav">
                    <div className="sidebar-content">
                        {/* Main Navigation */}
                        <div className="nav-section-title section-title">Manajemen Kursus</div>
                        <div className="d-flex flex-column nav-items-group">
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
                                    <i className="fas fa-circle-plus"></i>
                                </div>
                                <span className="nav-text">Buat Kursus</span>
                            </Link>

                            <Link
                                className={`instructor-nav-link ${isActive("/instructor/students") ? "active" : ""}`}
                                to="/instructor/students/"
                                data-tooltip="Peserta"
                            >
                                <div className="instructor-nav-icon nav-icon">
                                    <i className="fas fa-user-graduate"></i>
                                </div>
                                <span className="nav-text">Peserta</span>
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
                                data-tooltip="Riwayat Aktivitas"
                            >
                                <div className="instructor-nav-icon nav-icon">
                                    <i className="fas fa-clock-rotate-left"></i>
                                </div>
                                <span className="nav-text">Riwayat Aktivitas</span>
                            </Link>
                        </div>

                        <div className="instructor-divider"></div>

                        {/* Account Settings */}
                        <div className="nav-section-title section-title">Pengaturan Akun</div>
                        <div className="d-flex flex-column nav-items-group">
                            <Link
                                className={`instructor-nav-link ${isActive("/instructor/profile") ? "active" : ""}`}
                                to="/instructor/profile/"
                                data-tooltip="Edit Profil"
                            >
                                <div className="instructor-nav-icon nav-icon">
                                    <i className="fas fa-user-gear"></i>
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
                            type="button"
                        >
                            <div className="instructor-nav-icon nav-icon logout-icon">
                                <i className="fas fa-right-from-bracket"></i>
                            </div>
                            <span className="nav-text">Keluar Akun</span>
                        </button>

                        {/* Compact Branding Pill */}
                        {!isCollapsed && (
                            <div className="sidebar-footer-brand">
                                <span className="sidebar-brand-dot"></span>
                                <span className="sidebar-brand-text">Setjen DPD RI</span>
                            </div>
                        )}
                    </div>
                </div>
            </nav>
        </div>
    );
}

export default React.memo(Sidebar);
