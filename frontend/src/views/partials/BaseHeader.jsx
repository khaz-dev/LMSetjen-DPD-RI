import React, { useContext, useState, useEffect, memo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { WishlistContext, RolesContext, ProfileContext } from '../plugin/Context';
import { useAuthStore } from "../../store/auth";
import UserData from "../plugin/UserData";
import apiInstance from "../../utils/axios";
import logoWebP from "../../assets/logo/logo-192.webp";
import logoPNG from "../../assets/logo/logo-192.png";
import { logout } from "../../utils/auth";
import Toast, { LogoutConfirmation } from "../plugin/Toast";
import { getImageUrl } from "../../utils/courseUtils";  // ✨ PHASE 4.77: Image URL utility
import './BaseHeader.css';

function BaseHeader() {
    const [wishlistCount, setWishlistCount] = useContext(WishlistContext);
    // ✨ PHASE 4.20: Import RolesContext to track role changes for menu updates
    const { currentRole } = useContext(RolesContext) || {};
    // ✨ PHASE 11.2: Use ProfileContext to get profile data (avatar updates from Profile page)
    const [profile] = useContext(ProfileContext) || [null];
    
    const [searchQuery, setSearchQuery] = useState("");
    const [typingComplete, setTypingComplete] = useState(false);
    const [animationSkipped, setAnimationSkipped] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [hoverTimeout, setHoverTimeout] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchModal, setShowSearchModal] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchTimeout, setSearchTimeout] = useState(null);
    const [selectedResultIndex, setSelectedResultIndex] = useState(-1);  // ✨ Track keyboard navigation
    const [searchHistory, setSearchHistory] = useState([]);  // ✨ PHASE 3: Search history
    const [showSearchHistory, setShowSearchHistory] = useState(false);  // ✨ PHASE 3: Show history dropdown
    const [trendingSearches, setTrendingSearches] = useState([]);  // ✨ PHASE 3: Trending searches
    const [showTrendingSearches, setShowTrendingSearches] = useState(false);  // ✨ PHASE 3: Show trending dropdown
    const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
    
    const navigate = useNavigate();
    const location = useLocation();
    const isSearchPage = location.pathname.includes('/search');
    const [isLoggedIn, user, allUserData] = useAuthStore((state) => [state.isLoggedIn, state.user, state.allUserData]);
    const userData = UserData();
    // ✨ PHASE 4.20: Re-compute menu role checks based on currentRole dependency to update menu on role change
    const hasTeacherId = !!(userData?.teacher_id && userData?.teacher_id !== null && userData?.teacher_id !== undefined && userData?.teacher_id !== 0);
    const isAdmin = userData?.role === 'admin';
    const isSuperAdmin = userData?.is_super_admin || false;  // ✨ PHASE X: Check if user is super admin for menu filtering
    
    // ✨ PHASE 4.21: Determine menu to show based on currentRole, not hasTeacherId
    // hasTeacherId is a permanent user attribute that doesn't change with role switches
    // currentRole reflects the actual current role the user is in
    const determineMenuType = () => {
        const normalizedRole = currentRole?.toLowerCase?.().trim();
        
        switch (normalizedRole) {
            case 'admin':
                return 'admin';
            case 'teacher':
            case 'instructor':
                return 'instructor';
            case 'student':
            default:
                return 'student';
        }
    };
    
    const currentMenuType = determineMenuType();
    
    // ✨ PHASE 4.177: Fetch guards to prevent duplicate API calls
    const hasFetchedTrendingRef = React.useRef(false);
    
    // Animation effect
    useEffect(() => {
        const timer = setTimeout(() => setTypingComplete(true), 4000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Reset avatar error state when profile image changes.
        setAvatarLoadFailed(false);
    }, [profile?.image]);

    // ✨ PHASE 3: Load search history from localStorage and fetch trending searches on component mount
    useEffect(() => {
        // Load search history
        const savedHistory = localStorage.getItem('searchHistory');
        if (savedHistory) {
            try {
                setSearchHistory(JSON.parse(savedHistory));
            } catch (e) {
                setSearchHistory([]);
            }
        }
        
        // ✨ PHASE 3: Fetch trending searches on component mount
        // ✨ PHASE 4.177: Add fetch guard + data check to prevent duplicate calls in React Strict Mode
        if (!trendingSearches || trendingSearches.length === 0) {
            if (!hasFetchedTrendingRef.current) {
                hasFetchedTrendingRef.current = true;
                const fetchTrendingSearches = async () => {
                    try {
                        const response = await apiInstance.get('course/trending-searches/');
                        setTrendingSearches(response.data?.trending || []);
                    } catch (error) {
                        setTrendingSearches([]);
                    }
                };
                fetchTrendingSearches();
            }
        }
        
        // ✨ PHASE 3: Sync search param from URL if navigating to search page
        const searchParams = new URLSearchParams(location.search);
        const queryParam = searchParams.get('search');
        if (queryParam && isSearchPage) {
            setSearchQuery(queryParam);
        }
    }, [isSearchPage, location, trendingSearches]);

    // ✨ PHASE 11.2: Avatar is now managed via ProfileContext from App.jsx
    // It updates automatically when user changes avatar on Profile page
    // No separate fetch needed - just render from profile?.image

    const addToSearchHistory = (query) => {
        if (!query || query.trim().length < 2) return;
        
        const trimmedQuery = query.trim();
        // Remove if already exists (so it goes to top)
        const filtered = searchHistory.filter(item => item !== trimmedQuery);
        // Add to beginning
        const updated = [trimmedQuery, ...filtered].slice(0, 5); // Keep only last 5
        setSearchHistory(updated);
        localStorage.setItem('searchHistory', JSON.stringify(updated));
    };

    // Search API call with debounce
    useEffect(() => {
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // ✨ IMPROVEMENT: Require minimum 2 characters and trim whitespace
        const trimmedQuery = searchQuery.trim();
        if (!trimmedQuery || trimmedQuery.length < 2) {
            // ALWAYS hide modal and clear results if query is too short
            setSearchResults([]);
            setShowSearchModal(false);
            setShowSearchHistory(false);  // Hide history
            setSelectedResultIndex(-1);  // Reset keyboard navigation
            setIsSearching(false);  // Ensure loading state is cleared
            return;
        }

        // Set new timeout for debounce
        const timeout = setTimeout(async () => {
            setIsSearching(true);
            setSelectedResultIndex(-1);  // Reset keyboard navigation on new search
            try {
                const response = await apiInstance.get(`course/search/?search=${encodeURIComponent(trimmedQuery)}`);
                const courses = response.data?.results || response.data || [];
                const courseArray = Array.isArray(courses) ? courses.slice(0, 5) : [];
                setSearchResults(courseArray);
                // ✨ FIX: ALWAYS show modal even with 0 results so user gets clear feedback
                // The modal component handles empty state display internally
                setShowSearchModal(true);  // Show modal regardless of result count
                setShowSearchHistory(false);  // Hide history when we have results
            } catch (error) {
                setSearchResults([]);
                // ✨ FIX: Show modal on error too so user knows search was attempted
                setShowSearchModal(true);
            } finally {
                setIsSearching(false);
            }
        }, 200);  // ✨ IMPROVEMENT: Increased debounce from 150ms to 200ms for better performance

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
        const trimmedQuery = searchQuery.trim();
        if (trimmedQuery && trimmedQuery.length >= 2) {
            addToSearchHistory(trimmedQuery);  // ✨ PHASE 3: Add to history
        }
        setShowSearchModal(false);
        setShowSearchHistory(false);  // ✨ PHASE 3: Hide history
        if (trimmedQuery) {
            navigate(`/search/?search=${encodeURIComponent(trimmedQuery)}`);
        } else {
            navigate('/search/');
        }
    };

    const handleCourseSelect = (courseSlug) => {
        addToSearchHistory(searchQuery);  // ✨ PHASE 3: Add to history
        setShowSearchModal(false);
        setShowSearchHistory(false);  // ✨ PHASE 3: Hide history
        setSearchQuery("");
        navigate(`/course-detail/${courseSlug}/`);
    };

    // ✨ PHASE 3: Handle search history item click
    const handleHistoryItemClick = (item) => {
        setSearchQuery(item);
        setShowSearchHistory(false);
        // The debounce in useEffect will trigger the search automatically
    };

    // ✨ PHASE 3: Clear search history
    const clearSearchHistory = () => {
        setSearchHistory([]);
        localStorage.removeItem('searchHistory');
        setShowSearchHistory(false);
    };

    // ✨ PHASE 3: Handle trending item click
    const handleTrendingItemClick = (query) => {
        setSearchQuery(query);
        setShowTrendingSearches(false);
        addToSearchHistory(query);  // Add to history when clicked
        // The debounce in useEffect will trigger the search automatically
    };

    // ✨ PHASE 3: Handle input focus - show modal if there are results or show history/trending
    const handleSearchInputFocus = () => {
        // Show history if available and query is short
        if (searchQuery.trim().length < 2 && searchHistory.length > 0) {
            setShowSearchHistory(true);
            setShowTrendingSearches(false);
            return;
        }
        // Show trending if no history and query is short
        if (searchQuery.trim().length < 2 && searchHistory.length === 0 && trendingSearches.length > 0) {
            setShowTrendingSearches(true);
            setShowSearchHistory(false);
            return;
        }
        // Show results modal if query is valid and we have results
        if (searchQuery.trim().length >= 2 && searchResults.length > 0) {
            setShowSearchModal(true);
        }
    };

    const handleKeyPress = (e) => {
        // ✨ IMPROVEMENT: Enhanced keyboard navigation
        if (e.key === 'Enter') {
            if (selectedResultIndex >= 0) {
                // If history is shown, click the history item
                if (showSearchHistory && searchHistory[selectedResultIndex]) {
                    handleHistoryItemClick(searchHistory[selectedResultIndex]);
                }
                // If trending is shown, click the trending item
                else if (showTrendingSearches && trendingSearches[selectedResultIndex]) {
                    handleTrendingItemClick(trendingSearches[selectedResultIndex]);
                }
                // If results are shown, navigate to the course
                else if (searchResults[selectedResultIndex]) {
                    handleCourseSelect(searchResults[selectedResultIndex].slug);
                }
            } else {
                // Otherwise, do full search
                handleSearchSubmit();
            }
        } else if (e.key === 'ArrowDown') {
            // Navigate down through results/history/trending
            e.preventDefault();
            let maxIndex = -1;
            if (showSearchHistory) {
                maxIndex = searchHistory.length - 1;
            } else if (showTrendingSearches) {
                maxIndex = trendingSearches.length - 1;
            } else {
                maxIndex = searchResults.length - 1;
            }
            setSelectedResultIndex(prev => 
                prev < maxIndex ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            // Navigate up through results/history/trending
            e.preventDefault();
            setSelectedResultIndex(prev => prev > 0 ? prev - 1 : -1);
        } else if (e.key === 'Escape') {
            // Close modals
            setShowSearchModal(false);
            setShowSearchHistory(false);  // ✨ PHASE 3: Close history
            setShowTrendingSearches(false);  // ✨ PHASE 3: Close trending
            setSelectedResultIndex(-1);
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
    const getFirstTwoWords = (fullName) => {
        if (!fullName || typeof fullName !== 'string') return '';
        const words = fullName.trim().split(/\s+/);
        
        if (words.length === 0) return '';
        if (words.length === 1) return words[0];
        return `${words[0]} ${words[1]}`;
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
        const displayName = getFirstTwoWords(cleanedFullName);
        
        if (isAdmin) return displayName || 'Admin';
        return displayName || (hasTeacherId ? 'Pemateri' : 'Peserta');
    };

    // ✨ PHASE X: Render admin avatar in navigation - same as student/instructor
    // ✨ Shows avatar image from ProfileContext or fallback to initials
    const renderAdminAvatarInNav = () => {
        // Show avatar image from profile context if available
        if (profile?.image && !avatarLoadFailed) {
            return (
                <div className="nav-avatar-wrapper">
                    <img
                        src={profile.image}
                        className="nav-avatar-image"
                        alt={`${profile?.full_name || "Admin"} avatar`}
                        title={profile?.full_name || "Profil Admin"}
                        onError={() => setAvatarLoadFailed(true)}
                    />
                </div>
            );
        }

        // Default avatar with initials or icon
        const fullName = allUserData?.full_name || userData?.full_name || profile?.full_name || "A";
        const initials = fullName
            .split(' ')
            .slice(0, 2)
            .map(word => word[0])
            .join('')
            .toUpperCase();

        return (
            <div className="nav-avatar-wrapper default">
                <div className="nav-avatar-default">
                    <span>{initials}</span>
                </div>
            </div>
        );
    };

    // ✨ PHASE 4.X: Render student profile avatar in navigation
    // ✨ PHASE 11.2: Render profile avatar from ProfileContext (updated when user changes profile picture)
    const renderProfileAvatarInNav = () => {
        // Show avatar image from profile context if available
        if (profile?.image && !avatarLoadFailed) {
            return (
                <div className="nav-avatar-wrapper">
                    <img
                        src={profile.image}
                        className="nav-avatar-image"
                        alt={`${profile?.full_name || "Pengguna"} avatar`}
                        title={profile?.full_name || "Profil Saya"}
                        onError={() => setAvatarLoadFailed(true)}
                    />
                </div>
            );
        }

        // Default avatar with initials or icon
        const fullName = allUserData?.full_name || userData?.full_name || profile?.full_name || "U";
        const initials = fullName
            .split(' ')
            .slice(0, 2)
            .map(word => word[0])
            .join('')
            .toUpperCase();

        return (
            <div className="nav-avatar-wrapper default">
                <div className="nav-avatar-default">
                    <span>{initials}</span>
                </div>
            </div>
        );
    };

    // ✨ PHASE 11.2: Render instructor avatar - same as student, from ProfileContext
    const renderInstructorAvatarInNav = () => {
        // Show avatar image from profile context if available
        if (profile?.image && !avatarLoadFailed) {
            return (
                <div className="nav-avatar-wrapper">
                    <img
                        src={profile.image}
                        className="nav-avatar-image"
                        alt={`${profile?.full_name || "Pengguna"} avatar`}
                        title={profile?.full_name || "Profil Saya"}
                        onError={() => setAvatarLoadFailed(true)}
                    />
                </div>
            );
        }

        // Default avatar with initials or icon
        const fullName = allUserData?.full_name || userData?.full_name || profile?.full_name || "I";
        const initials = fullName
            .split(' ')
            .slice(0, 2)
            .map(word => word[0])
            .join('')
            .toUpperCase();

        return (
            <div className="nav-avatar-wrapper default">
                <div className="nav-avatar-default">
                    <span>{initials}</span>
                </div>
            </div>
        );
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
        { to: "/student/profile/", icon: "fas fa-gear", text: "Pengaturan" },
        { to: "/logout/", icon: "fas fa-sign-out-alt", text: "Keluar" }
    ];

    const adminMenuItems = [
        { to: "/admin/dashboard/", icon: "bi bi-grid-fill", text: "Dashboard", requiresSuperAdmin: false },
        { to: "/admin/users/", icon: "fas fa-users", text: "Kelola Pengguna", requiresSuperAdmin: false },
        // ✨ PHASE 4: Unified content management page (replaces Review Kursus, Kurasi Testimoni, Kelola Materi)
        { to: "/admin/content-management/", icon: "fas fa-cogs", text: "Manajemen Konten", requiresSuperAdmin: false },
        // ✨ PHASE 4.210: Unified reports page (includes abuse reports and other system reports)
        { to: "/admin/reports/", icon: "fas fa-file-alt", text: "Laporan Sistem", requiresSuperAdmin: false },
        { to: "/admin/documentation/", icon: "fas fa-book", text: "Dokumentasi Sistem", requiresSuperAdmin: false },
        // ✨ PHASE 11.1: User Feedback Management
        { to: "/admin/feedback/", icon: "fas fa-comments", text: "Manajemen Masukan", requiresSuperAdmin: false },
        { to: "/admin/system/", icon: "fas fa-cogs", text: "Pengaturan Sistem", requiresSuperAdmin: true },
        { to: "/logout/", icon: "fas fa-sign-out-alt", text: "Keluar", requiresSuperAdmin: false }
    ];

    // ✨ PHASE X: Filter admin menu items based on super admin privileges
    const filteredAdminMenuItems = adminMenuItems.filter(item => 
        !item.requiresSuperAdmin || isSuperAdmin
    );

    // Render dropdown items
    const renderDropdownItems = (items) => (
        items.map((item, index) => {
            // ✨ PHASE X: Handle logout as a button (not a Link) to prevent navigation attempts
            if (item.to === "/logout/") {
                return (
                    <li key={index}>
                        <button
                            className="dropdown-item logout-item"
                            onClick={handleLogout}
                        >
                            <i className={item.icon}></i>
                            {item.text}
                        </button>
                    </li>
                );
            }
            
            const isItemActive = isActive(item.to);
            const itemClass = `dropdown-item ${isItemActive ? "active-item" : ""}`;
            
            return (
                <li key={index}>
                    <Link
                        className={itemClass}
                        to={item.to}
                        onClick={() => setDropdownOpen(false)}
                    >
                        <i className={item.icon}></i>
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
                            <div className="search-container-wrapper" onClick={(e) => {
                                // Close modal only when clicking outside search area, not on it
                                if (e.target.closest('.search-container')) return;
                                if (e.target.closest('.search-modal')) return;
                                setShowSearchModal(false);
                                setShowSearchHistory(false);  // ✨ PHASE 3: Close history
                                setShowTrendingSearches(false);  // ✨ PHASE 3: Close trending
                            }}>
                                <div className="search-container">
                                    <input
                                        className="search-input"
                                        type="search"
                                        placeholder="Cari Pembelajaran..."
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            // Close history/trending when user types
                                            setShowSearchHistory(false);
                                            setShowTrendingSearches(false);
                                        }}
                                        onKeyDown={handleKeyPress}  // ✨ Changed from onKeyPress to onKeyDown for arrow keys
                                        onFocus={handleSearchInputFocus}  // ✨ PHASE 3 FIX: Call proper handler to show history or results
                                        aria-label="Search courses"  // ✨ NEW: Accessibility attribute
                                        aria-autocomplete="list"
                                        aria-controls="search-results"
                                    />
                                    <button 
                                        onClick={handleSearchSubmit} 
                                        className="search-button"
                                        aria-label="Cari"
                                    >
                                        <i className="fas fa-search me-1"></i>Cari
                                    </button>
                                </div>

                                {/* Search Modal */}
                                {showSearchModal && (
                                    <div className="search-modal" id="search-results" role="listbox">
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
                                                        aria-label="Close search results"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <div className="search-modal-content">
                                                    {searchResults.map((course, index) => (
                                                        <div 
                                                            key={course.id}
                                                            className={`search-modal-item ${index === selectedResultIndex ? 'selected' : ''}`}
                                                            onClick={() => handleCourseSelect(course.slug)}
                                                            onMouseEnter={() => setSelectedResultIndex(index)}
                                                            role="option"
                                                            aria-selected={index === selectedResultIndex}
                                                        >
                                                            <div className="search-item-image">
                                                                {course.image ? (
                                                                    <img src={getImageUrl(course.image)} alt={course.title} />
                                                                ) : (
                                                                    <div className="search-item-image-placeholder">
                                                                        <i className="fas fa-book"></i>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="search-item-content">
                                                                <h4 className="search-item-title">{course.title}</h4>
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

                                {/* ✨ PHASE 3: Search History Modal */}
                                {showSearchHistory && searchHistory.length > 0 && (
                                    <div className="search-modal search-history-modal" role="listbox">
                                        <div className="search-modal-header">
                                            <span className="search-modal-title">
                                                <i className="fas fa-history me-2"></i>
                                                Riwayat Pencarian
                                            </span>
                                            <button 
                                                className="search-modal-close"
                                                onClick={() => setShowSearchHistory(false)}
                                                aria-label="Close search history"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <div className="search-modal-content">
                                            {searchHistory.map((item, index) => (
                                                <div 
                                                    key={`history-${index}`}
                                                    className={`search-history-item ${index === selectedResultIndex ? 'selected' : ''}`}
                                                    onClick={() => handleHistoryItemClick(item)}
                                                    onMouseEnter={() => setSelectedResultIndex(index)}
                                                    role="option"
                                                    aria-selected={index === selectedResultIndex}
                                                >
                                                    <i className="fas fa-clock me-2"></i>
                                                    <span>{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="search-modal-footer">
                                            <button 
                                                className="btn-clear-history"
                                                onClick={clearSearchHistory}
                                            >
                                                <i className="fas fa-trash me-2"></i>
                                                Hapus Riwayat
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ✨ PHASE 3: Trending Searches Modal */}
                                {showTrendingSearches && trendingSearches.length > 0 && (
                                    <div className="search-modal search-trending-modal" role="listbox">
                                        <div className="search-modal-header">
                                            <span className="search-modal-title">
                                                <i className="fas fa-fire me-2"></i>
                                                Pencarian Trending
                                            </span>
                                            <button 
                                                className="search-modal-close"
                                                onClick={() => setShowTrendingSearches(false)}
                                                aria-label="Close trending searches"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <div className="search-modal-content">
                                            {trendingSearches.map((item, index) => (
                                                <div 
                                                    key={`trending-${index}`}
                                                    className={`search-trending-item ${index === selectedResultIndex ? 'selected' : ''}`}
                                                    onClick={() => handleTrendingItemClick(item)}
                                                    onMouseEnter={() => setSelectedResultIndex(index)}
                                                    role="option"
                                                    aria-selected={index === selectedResultIndex}
                                                >
                                                    <i className="fas fa-fire me-2"></i>
                                                    <span>{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}


                            </div>
                        )}

                        {/* User menu */}
                        {isLoggedIn() ? (
                            <div className="user-menu">
                                {currentMenuType === 'admin' ? (
                                    <div 
                                        className="nav-item dropdown"
                                        onMouseEnter={handleMouseEnter}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        <div className="nav-link admin-link nav-link-avatar">
                                            {renderAdminAvatarInNav()}
                                            <i className="fas fa-shield-alt nav-admin-role-icon"></i>
                                        </div>
                                        {/* ✨ PHASE X: Use admin-profile-dropdown class and add header like AdminHeader */}
                                        <ul className={`dropdown-menu admin-profile-dropdown ${dropdownOpen ? 'show' : ''}`}>
                                            <li><h6 className="dropdown-header">
                                                <i className="fas fa-shield-alt me-2"></i>
                                                Panel Admin
                                            </h6></li>
                                            {renderDropdownItems(filteredAdminMenuItems)}
                                        </ul>
                                    </div>
                                ) : currentMenuType === 'instructor' ? (
                                    <div 
                                        className="nav-item dropdown"
                                        onMouseEnter={handleMouseEnter}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        <div className="nav-link instructor-link nav-link-avatar">
                                            {renderInstructorAvatarInNav()}
                                            <i className="fas fa-chalkboard-user nav-instructor-role-icon"></i>
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
                                        <div className="nav-link student-link nav-link-avatar">
                                            {renderProfileAvatarInNav()}
                                            <i className="fas fa-graduation-cap nav-avatar-role-icon"></i>
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