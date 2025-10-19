import React, { useContext, useState, useEffect, memo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { WishlistContext } from '../plugin/Context';
import { useAuthStore } from "../../store/auth";
import UserData from "../plugin/UserData";
import logoWebP from "../../assets/logo/logo-192.webp";
import logoPNG from "../../assets/logo/logo-192.png";
import { logout } from "../../utils/auth";
import Toast, { LogoutConfirmation } from "../plugin/Toast";
import './BaseHeader.css';

function BaseHeader() {
    const [wishlistCount, setWishlistCount] = useContext(WishlistContext);
    const [searchQuery, setSearchQuery] = useState("");
    const [typingComplete, setTypingComplete] = useState(false);
    const [animationSkipped, setAnimationSkipped] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [hoverTimeout, setHoverTimeout] = useState(null);
    
    const navigate = useNavigate();
    const location = useLocation();
    const isSearchPage = location.pathname.includes('/search');
    const [isLoggedIn, user] = useAuthStore((state) => [state.isLoggedIn, state.user]);
    const userData = UserData();
    const hasTeacherId = !!(userData?.teacher_id && userData?.teacher_id !== null && userData?.teacher_id !== undefined && userData?.teacher_id !== 0);
    
    // Animation effect
    useEffect(() => {
        const timer = setTimeout(() => setTypingComplete(true), 4000);
        return () => clearTimeout(timer);
    }, []);

    // Cleanup hover timeout
    useEffect(() => {
        return () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
        };
    }, [hoverTimeout]);

    const handleBrandHover = () => {
        if (!typingComplete && !animationSkipped) {
            setAnimationSkipped(true);
            setTypingComplete(true);
        }
    };

    // Search functionality
    const handleSearchSubmit = () => {
        if (searchQuery.trim()) {
            navigate(`/search/?search=${encodeURIComponent(searchQuery.trim())}`);
        } else {
            navigate('/search/');
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearchSubmit();
        }
    };

    // Dropdown handlers
    const handleMouseEnter = () => {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            setHoverTimeout(null);
        }
        setDropdownOpen(true);
    };

    const handleMouseLeave = () => {
        const timeout = setTimeout(() => {
            setDropdownOpen(false);
        }, 150); // Small delay to allow mouse to move to dropdown
        setHoverTimeout(timeout);
    };

    // Logout functionality
    const handleLogout = () => {
        LogoutConfirmation().then((result) => {
            if (result.isConfirmed) {
                Toast().fire({
                    icon: "success",
                    title: "Logout Berhasil! Terima kasih telah menggunakan platform kami.",
                });
                setTimeout(() => logout(), 1500);
            }
        });
    };

    // Utility functions
    const getFirstThreeWords = (fullName) => {
        if (!fullName || typeof fullName !== 'string') return '';
        const words = fullName.trim().split(/\s+/);
        
        if (words.length === 0) return '';
        if (words.length === 1) return words[0];
        if (words.length === 2) return `${words[0]} ${words[1]}`;
        return `${words[0]} ${words[1]} ${words[2]}`;
    };

    const getDisplayName = () => {
        const fullName = userData?.full_name || user?.full_name || user?.username || '';
        const displayName = getFirstThreeWords(fullName);
        return displayName || (hasTeacherId ? 'Pemateri' : 'Peserta');
    };

    const isActive = (path) => {
        if (path === "/logout/") return false;
        return location.pathname === path || location.pathname.startsWith(path);
    };

    // Menu data
    const instructorMenuItems = [
        { to: "/instructor/dashboard/", icon: "bi bi-grid-fill", text: "Dashboard" },
        { to: "/instructor/courses/", icon: "fas fa-book-atlas", text: "Materi Saya" },
        { to: "/instructor/create-course/", icon: "fas fa-plus", text: "Buat Materi" },
        { to: "/instructor/reviews/", icon: "fas fa-star", text: "Review" },
        { to: "/instructor/question-answer/", icon: "fas fa-envelope", text: "Tanya Jawab" },
        { to: "/instructor/students/", icon: "fas fa-users", text: "Murid Saya" },
        { to: "/instructor/profile/", icon: "fas fa-gear", text: "Pengaturan" },
        { to: "/logout/", icon: "fas fa-sign-out-alt", text: "Keluar" }
    ];

    const studentMenuItems = [
        { to: "/student/dashboard/", icon: "bi bi-grid-fill", text: "Dashboard" },
        { to: "/student/courses/", icon: "fas fa-book", text: "Pembelajaran" },
        { to: "/student/wishlist/", icon: "fas fa-bookmark", text: "Materi Impian" },
        { to: "/student/question-answer/", icon: "fas fa-envelope", text: "Tanya Jawab" },
        { to: "/student/profile/", icon: "fas fa-gear", text: "Pengaturan" },
        { to: "/logout/", icon: "fas fa-sign-out-alt", text: "Keluar" }
    ];

    // Render dropdown items
    const renderDropdownItems = (items) => (
        items.map((item, index) => {
            const isItemActive = isActive(item.to);
            const isLogoutItem = item.text === "Keluar";
            
            const itemClass = `dropdown-item ${isLogoutItem ? "logout-item" : ""} ${isItemActive ? "active-item" : ""}`;
            
            return (
                <li key={index}>
                    <Link
                        className={itemClass}
                        to={item.to}
                        onClick={item.to === "/logout/" ? (e) => {
                            e.preventDefault();
                            handleLogout();
                        } : undefined}
                    >
                        <i className={`${item.icon} me-3`}></i>
                        <span>{item.text}</span>
                    </Link>
                </li>
            );
        })
    );

    return (
        <header role="banner">
            <nav className="base-header navbar navbar-expand-lg" role="navigation" aria-label="Main navigation">
                <div className="container">
                    {/* Brand */}
                    <Link 
                        className="navbar-brand" 
                        to="/"
                        onMouseEnter={handleBrandHover}
                >
                    <picture>
                        <source srcSet={logoWebP} type="image/webp" />
                        <img 
                            src={logoPNG} 
                            alt="LMSetjen DPD RI Logo" 
                            className="brand-logo"
                            width="56"
                            height="56"
                            loading="eager"
                        />
                    </picture>
                    <div className="brand-text d-none d-sm-inline">
                        <span className={`typing-text ${typingComplete || animationSkipped ? 'animation-complete' : ''}`}>
                            LMSetjen DPD RI
                        </span>
                        <div className="brand-underline" />
                    </div>
                </Link>

                {/* Mobile toggle */}
                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarSupportedContent"
                >
                    <span className="navbar-toggler-icon" />
                </button>

                <div className="collapse navbar-collapse" id="navbarSupportedContent">
                    <div className="navbar-content">
                        {/* User Guide Link */}
                        <Link to="/user-guide/" className="nav-link-guide">
                            <i className="fas fa-book-reader me-2"></i>
                            <span className="d-none d-md-inline">Panduan Pengguna</span>
                            <span className="d-inline d-md-none">Panduan</span>
                        </Link>

                        {/* Search */}
                        {!isSearchPage && (
                            <div className="search-container">
                                <input
                                    className="search-input"
                                    type="search"
                                    placeholder="Cari Pembelajaran..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                />
                                <button 
                                    onClick={handleSearchSubmit} 
                                    className="search-button"
                                >
                                    <i className="fas fa-search me-1"></i>Cari
                                </button>
                            </div>
                        )}

                        {/* User menu */}
                        {isLoggedIn() ? (
                            <div className="user-menu">
                                {hasTeacherId ? (
                                    <div 
                                        className="nav-item dropdown"
                                        onMouseEnter={handleMouseEnter}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        <div className="nav-link instructor-link">
                                            <i className="fas fa-chalkboard-user me-2"></i>
                                            <span>{getDisplayName()}</span>
                                        </div>
                                        <ul className={`dropdown-menu ${dropdownOpen ? 'show' : ''}`}>
                                            {renderDropdownItems(instructorMenuItems)}
                                        </ul>
                                    </div>
                                ) : (
                                    <div 
                                        className="nav-item dropdown"
                                        onMouseEnter={handleMouseEnter}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        <div className="nav-link student-link">
                                            <i className="fas fa-graduation-cap me-2"></i>
                                            <span>{getDisplayName()}</span>
                                        </div>
                                        <ul className={`dropdown-menu ${dropdownOpen ? 'show' : ''}`}>
                                            {renderDropdownItems(studentMenuItems)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="auth-buttons">
                                <Link to="/login/" className="btn-login">
                                    <i className="fas fa-sign-in-alt me-2"></i>Masuk
                                </Link>
                                <Link to="/register/" className="btn-register">
                                    <i className="fas fa-user-plus me-2"></i>Daftar
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    </header>
    );
}

export default memo(BaseHeader);