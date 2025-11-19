import React, { useContext, useState, useEffect, memo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { WishlistContext } from '../plugin/Context';
import { useAuthStore } from "../../store/auth";
import UserData from "../plugin/UserData";
import apiInstance from "../../utils/axios";
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
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState(null);
    
    const navigate = useNavigate();
    const location = useLocation();
    const isSearchPage = location.pathname.includes('/search');
    const [isLoggedIn, user, allUserData] = useAuthStore((state) => [state.isLoggedIn, state.user, state.allUserData]);
    const userData = UserData();
    const hasTeacherId = !!(userData?.teacher_id && userData?.teacher_id !== null && userData?.teacher_id !== undefined && userData?.teacher_id !== 0);
    const isAdmin = userData?.role === 'admin';
    
    // Animation effect
    useEffect(() => {
        const timer = setTimeout(() => setTypingComplete(true), 4000);
        return () => clearTimeout(timer);
    }, []);

    // Search API call with debounce
    useEffect(() => {
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // Don't search if query is empty
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setShowSearchModal(false);
            return;
        }

        // Set new timeout for debounce
        const timeout = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await apiInstance.get(`course/search/?search=${encodeURIComponent(searchQuery)}`);
                const courses = response.data?.results || response.data || [];
                setSearchResults(Array.isArray(courses) ? courses.slice(0, 5) : []);
                setShowSearchModal(true);
            } catch (error) {
                console.error("Search error:", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 150); // 150ms debounce for snappier results

        setSearchTimeout(timeout);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    // Cleanup hover timeout
    useEffect(() => {
        return () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
        };
    }, [hoverTimeout, searchTimeout]);

    const handleBrandHover = () => {
        if (!typingComplete && !animationSkipped) {
            setAnimationSkipped(true);
            setTypingComplete(true);
        }
    };

    // Search functionality
    const handleSearchSubmit = () => {
        setShowSearchModal(false);
        if (searchQuery.trim()) {
            navigate(`/search/?search=${encodeURIComponent(searchQuery.trim())}`);
        } else {
            navigate('/search/');
        }
    };

    const handleCourseSelect = (courseSlug) => {
        setShowSearchModal(false);
        setSearchQuery("");
        navigate(`/course-detail/${courseSlug}/`);
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
        // Try to get full_name from multiple sources in order of preference:
        // 1. allUserData (from Zustand store) - most reliable for SSO
        // 2. userData (from decoded JWT token)
        // 3. user().full_name (from auth store user function)
        const fullName = allUserData?.full_name || userData?.full_name || user()?.full_name || '';

        // Clean up the full name - remove any trailing commas, extra spaces, special characters, and trim
        const cleanedFullName = fullName
            .replace(/,+/g, '') // Remove all commas
            .replace(/[^\w\s]/g, '') // Remove special characters except spaces and word characters
            .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
            .trim();
        const displayName = getFirstThreeWords(cleanedFullName);
        
        if (isAdmin) return displayName || 'Admin';
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

    const adminMenuItems = [
        { to: "/admin/dashboard/", icon: "bi bi-grid-fill", text: "Dashboard" },
        { to: "/admin/users/", icon: "fas fa-users", text: "Manajemen Pengguna" },
        { to: "/admin/documentation/", icon: "fas fa-book", text: "Dokumentasi" },
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
                            <div className="search-container-wrapper">
                                <div className="search-container">
                                    <input
                                        className="search-input"
                                        type="search"
                                        placeholder="Cari Pembelajaran..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        onFocus={() => searchQuery.trim() && setShowSearchModal(true)}
                                    />
                                    <button 
                                        onClick={handleSearchSubmit} 
                                        className="search-button"
                                    >
                                        <i className="fas fa-search me-1"></i>Cari
                                    </button>
                                </div>

                                {/* Search Modal */}
                                {showSearchModal && (
                                    <div className="search-modal">
                                        {searchResults.length > 0 ? (
                                            <>
                                                <div className="search-modal-header">
                                                    <span className="search-modal-title">
                                                        <i className="fas fa-search me-2"></i>
                                                        Hasil Pencarian ({searchResults.length})
                                                    </span>
                                                    <button 
                                                        className="search-modal-close"
                                                        onClick={() => setShowSearchModal(false)}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <div className="search-modal-content">
                                                    {searchResults.map((course) => (
                                                        <div 
                                                            key={course.id} 
                                                            className="search-modal-item"
                                                            onClick={() => handleCourseSelect(course.slug)}
                                                        >
                                                            <div className="search-item-image">
                                                                {course.image ? (
                                                                    <img src={course.image} alt={course.title} />
                                                                ) : (
                                                                    <div className="search-item-image-placeholder">
                                                                        <i className="fas fa-book"></i>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="search-item-content">
                                                                <h4 className="search-item-title">{course.title}</h4>
                                                                {course.description && (
                                                                    <p className="search-item-description">{course.description}</p>
                                                                )}
                                                                <div className="search-item-meta">
                                                                    <span className="search-item-category">
                                                                        <i className="fas fa-tag me-1"></i>
                                                                        {course.category?.title || 'Umum'}
                                                                    </span>
                                                                    {course.students_count !== undefined && (
                                                                        <span className="search-item-students">
                                                                            <i className="fas fa-users me-1"></i>
                                                                            {course.students_count} peserta
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {course.rating && (
                                                                    <div className="search-item-rating">
                                                                        <i className="fas fa-star text-warning"></i>
                                                                        <span className="rating-value">{course.rating.toFixed(1)}</span>
                                                                        <span className="rating-text">({course.number_of_rating || 0} rating)</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="search-modal-footer">
                                                    <button 
                                                        className="btn-view-all"
                                                        onClick={handleSearchSubmit}
                                                    >
                                                        <i className="fas fa-arrow-right me-2"></i>
                                                        Lihat Semua Hasil
                                                    </button>
                                                </div>
                                            </>
                                        ) : isSearching ? (
                                            <div className="search-modal-loading">
                                                <div className="search-loading-spinner"></div>
                                                <p>Mencari pembelajaran...</p>
                                            </div>
                                        ) : (
                                            <div className="search-modal-empty">
                                                <i className="fas fa-search"></i>
                                                <p>Tidak ada kursus yang cocok</p>
                                                <small>Coba ubah kata kunci atau tekan Enter untuk pencarian lengkap</small>
                                            </div>
                                        )}
                                    </div>
                                )}


                            </div>
                        )}

                        {/* User menu */}
                        {isLoggedIn() ? (
                            <div className="user-menu">
                                {isAdmin ? (
                                    <div 
                                        className="nav-item dropdown"
                                        onMouseEnter={handleMouseEnter}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        <div className="nav-link admin-link">
                                            <i className="fas fa-shield-alt me-2"></i>
                                            <span>{getDisplayName()}</span>
                                        </div>
                                        <ul className={`dropdown-menu ${dropdownOpen ? 'show' : ''}`}>
                                            {renderDropdownItems(adminMenuItems)}
                                        </ul>
                                    </div>
                                ) : hasTeacherId ? (
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