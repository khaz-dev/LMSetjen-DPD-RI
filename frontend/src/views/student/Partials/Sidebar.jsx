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
        // Trigger event for all pages to adapt their layout
        triggerSidebarCollapseEvent();
    };

    // Accurate active path checking
    const isActive = (path) => {
        const current = location.pathname;
        if (path === "/student/dashboard/" || path === "/student/dashboard") {
            return current === "/student/dashboard/" || current === "/student/dashboard";
        }
        if (path === "/student/courses/" || path === "/student/courses") {
            return (
                current === "/student/courses/" ||
                current === "/student/courses" ||
                current.startsWith("/student/courses/")
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

                // Small delay for better UX
                setTimeout(() => {
                    logout();
                }, 1500);
            }
        });
    };

    return (
        <div className="col-lg-3 col-md-4 col-12 student-sidebar-column">
            <nav className={`student-sidebar modern-sidebar ${isCollapsed ? "collapsed" : ""}`}>
                {/* Mobile Header */}
                <div className="d-md-none">
                    <div className="student-sidebar-header sidebar-header">
                        <div className="sidebar-header-brand-wrap">
                            <div className="sidebar-header-icon-box">
                                <i className="fas fa-graduation-cap"></i>
                            </div>
                            <div className="sidebar-header-text">
                                <h6 className="sidebar-header-title">Panel Pembelajar</h6>
                                <span className="sidebar-header-badge">LMSetjen DPD RI</span>
                            </div>
                        </div>
                    </div>
                    <button
                        className="student-mobile-toggle mobile-toggle w-100"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#studentSidenav"
                        aria-controls="studentSidenav"
                        aria-expanded="false"
                        aria-label="Toggle navigation"
                    >
                        <i className="bi bi-grid me-2"></i>Menu Navigasi
                    </button>
                </div>

                {/* Desktop Header - Expanded State */}
                {!isCollapsed && (
                    <div className="d-none d-md-flex student-sidebar-header sidebar-header">
                        <div className="sidebar-header-brand-wrap">
                            <div className="sidebar-header-icon-box">
                                <i className="fas fa-graduation-cap"></i>
                            </div>
                            <div className="sidebar-header-text">
                                <h6 className="sidebar-header-title">Menu Siswa</h6>
                                <span className="sidebar-header-badge">LMSetjen DPD RI</span>
                            </div>
                        </div>
                        <button
                            className="sidebar-toggle-btn d-flex"
                            onClick={toggleSidebarCollapse}
                            title="Ciutkan bilah sisi"
                            aria-label="Ciutkan bilah sisi"
                        >
                            <i className="bi bi-chevron-left"></i>
                        </button>
                    </div>
                )}

                {/* Desktop Header - Collapsed State */}
                {isCollapsed && (
                    <div className="d-none d-md-flex student-sidebar-header-collapsed sidebar-header-collapsed">
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

                <div className="collapse navbar-collapse show" id="studentSidenav">
                    <div className="sidebar-content">
                        {/* Main Navigation */}
                        <div className="nav-section-title section-title">Pembelajaran</div>
                        <div className="d-flex flex-column nav-items-group">
                            <Link
                                className={`student-nav-link modern-nav-link ${isActive("/student/dashboard") ? "active" : ""}`}
                                to="/student/dashboard/"
                                data-tooltip="Dasbor"
                            >
                                <div className="student-nav-icon nav-icon">
                                    <i className="bi bi-grid-fill"></i>
                                </div>
                                <span className="nav-text">Dasbor</span>
                            </Link>

                            <Link
                                className={`student-nav-link modern-nav-link ${isActive("/student/courses") ? "active" : ""}`}
                                to="/student/courses/"
                                data-tooltip="Kursus Saya"
                            >
                                <div className="student-nav-icon nav-icon">
                                    <i className="fas fa-book-open"></i>
                                </div>
                                <span className="nav-text">Kursus Saya</span>
                            </Link>

                            <Link
                                className={`student-nav-link modern-nav-link ${isActive("/student/wishlist") ? "active" : ""}`}
                                to="/student/wishlist/"
                                data-tooltip="Daftar Keinginan"
                            >
                                <div className="student-nav-icon nav-icon">
                                    <i className="fas fa-bookmark"></i>
                                </div>
                                <span className="nav-text">Daftar Keinginan</span>
                            </Link>

                            <Link
                                className={`student-nav-link modern-nav-link ${isActive("/student/sertifikat") ? "active" : ""}`}
                                to="/student/sertifikat/"
                                data-tooltip="Sertifikat Kursus"
                            >
                                <div className="student-nav-icon nav-icon">
                                    <i className="fas fa-certificate"></i>
                                </div>
                                <span className="nav-text">Sertifikat Kursus</span>
                            </Link>

                            <Link
                                className={`student-nav-link modern-nav-link ${isActive("/student/activities") ? "active" : ""}`}
                                to="/student/activities/"
                                data-tooltip="Riwayat Aktivitas"
                            >
                                <div className="student-nav-icon nav-icon">
                                    <i className="fas fa-clock-rotate-left"></i>
                                </div>
                                <span className="nav-text">Riwayat Aktivitas</span>
                            </Link>
                        </div>

                        <div className="student-divider sidebar-divider"></div>

                        {/* Account Settings */}
                        <div className="nav-section-title section-title">Pengaturan Akun</div>
                        <div className="d-flex flex-column nav-items-group">
                            <Link
                                className={`student-nav-link modern-nav-link ${isActive("/student/profile") ? "active" : ""}`}
                                to="/student/profile/"
                                data-tooltip="Edit Profil"
                            >
                                <div className="student-nav-icon nav-icon">
                                    <i className="fas fa-user-gear"></i>
                                </div>
                                <span className="nav-text">Edit Profil</span>
                            </Link>

                            <Link
                                className={`student-nav-link modern-nav-link ${isActive("/student/testimonials") ? "active" : ""}`}
                                to="/student/testimonials/"
                                data-tooltip="Testimoni"
                            >
                                <div className="student-nav-icon nav-icon">
                                    <i className="fas fa-quote-left"></i>
                                </div>
                                <span className="nav-text">Testimoni</span>
                            </Link>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className={`student-logout-btn modern-logout-btn ${isCollapsed ? "collapsed" : ""}`}
                            data-tooltip="Keluar"
                            type="button"
                        >
                            <div className="student-nav-icon nav-icon logout-icon">
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
