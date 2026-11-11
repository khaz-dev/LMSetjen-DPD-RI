import { useState, useEffect, useRef, useContext, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Rating } from "react-simple-star-rating";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { WishlistContext } from "../plugin/Context";
import { getImageUrl } from "../../utils/courseUtils";
import { parseDurationToSeconds } from "../../utils/durationUtils";
import Toast from "../plugin/Toast";
import InstructorRequestModal from "../../components/InstructorRequestModal";
import apiInstance from "../../utils/axios";

import "./Search.css";

function Search() {
    const [courses, setCourses] = useState([]);
    const [allCourses, setAllCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [wishlistItems, setWishlistItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedLevel, setSelectedLevel] = useState("all");
    const [sortBy, setSortBy] = useState("relevance");
    
    // ✨ Recommendations state
    const [recommendedCourses, setRecommendedCourses] = useState([]);
    const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
    
    // Instructor Request System state
    const [showInstructorModal, setShowInstructorModal] = useState(false);
    const [existingInstructorRequest, setExistingInstructorRequest] = useState(null);
    
    const userData = UserData();
    const userId = userData?.user_id;
    const userRole = userData?.role;
    const isTeacher = userData?.is_instructor || userRole === 'teacher';
    
    const wishlistContextValue = useContext(WishlistContext);
    const refreshWishlistCount = wishlistContextValue?.[2] || (() => {});
    
    // Header height measurement & sticky hero state
    const [headerHeight, setHeaderHeight] = useState(60);
    const [isScrolled, setIsScrolled] = useState(false);

    const searchInputRef = useRef(null);
    const [searchParams, setSearchParams] = useSearchParams();

    // Ensure body background is properly tinted for silhouette layer
    useEffect(() => {
        const originalBg = document.body.style.backgroundColor;
        document.body.style.backgroundColor = "#f1f5f9";
        return () => {
            document.body.style.backgroundColor = originalBg;
        };
    }, []);

    // 12 items per page aligns evenly on 4-col (desktop), 3-col (laptop), 2-col (tablet), and 1-col (mobile) grids
    const itemsPerPage = 12;

    // Dynamically track BaseHeader height
    useEffect(() => {
        const updateHeaderHeight = () => {
            const headerEl = document.querySelector('.base-header');
            if (headerEl) {
                setHeaderHeight(headerEl.offsetHeight);
            }
        };

        updateHeaderHeight();

        let ro = null;
        const headerEl = document.querySelector('.base-header');
        if (headerEl && window.ResizeObserver) {
            ro = new ResizeObserver(() => {
                updateHeaderHeight();
            });
            ro.observe(headerEl);
        }

        window.addEventListener("resize", updateHeaderHeight);
        return () => {
            if (ro) ro.disconnect();
            window.removeEventListener("resize", updateHeaderHeight);
        };
    }, []);

    // Scroll listener with RAF and magnetic snap
    useEffect(() => {
        let ticking = false;
        let snapTimeout = null;
        let isSnapping = false;

        const SNAP_STUCK_Y = 75;
        const SNAP_MIDPOINT = 38;

        const performSnap = () => {
            if (isSnapping) return;
            const currentY = window.scrollY;
            // Only trigger snap if user stopped scrolling in the transition zone
            if (currentY > 6 && currentY < SNAP_STUCK_Y) {
                isSnapping = true;
                const targetY = currentY >= SNAP_MIDPOINT ? SNAP_STUCK_Y : 0;
                window.scrollTo({
                    top: targetY,
                    behavior: 'smooth'
                });
                setTimeout(() => {
                    isSnapping = false;
                }, 300);
            }
        };

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrollY = window.scrollY;
                    setIsScrolled(scrollY >= 55);
                    ticking = false;
                });
                ticking = true;
            }

            // Magnetic snap debounce: automatically snaps if user scrolls slowly and stops in-between
            clearTimeout(snapTimeout);
            snapTimeout = setTimeout(performSnap, 80);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", handleScroll);
            clearTimeout(snapTimeout);
        };
    }, []);

    // Fetch courses from API
    const fetchCourse = async () => {
        setIsLoading(true);
        try {
            const response = await useAxios.get(`course/course-list/`);
            const coursesData = response.data?.results || response.data || [];
            const coursesArray = Array.isArray(coursesData) ? coursesData : [];
            
            setCourses(coursesArray);
            setAllCourses(coursesArray);
            
            // Extract unique categories from courses
            const uniqueCategories = [...new Set(coursesArray.map(course => course.category?.title).filter(Boolean))];
            setCategories(uniqueCategories);
        } catch (error) {
            setCourses([]);
            setAllCourses([]);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat kursus",
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch wishlist items
    const fetchWishlistItems = async () => {
        if (!userId) return;
        try {
            const response = await useAxios.get(`student/wishlist/${userId}/`);
            const wishlistData = response.data?.results || response.data || [];
            const wishlistArray = Array.isArray(wishlistData) ? wishlistData : [];
            setWishlistItems(wishlistArray);
        } catch (error) {
            // Silently handle error
        }
    };

    // Check if course is in wishlist
    const isCourseInWishlist = (courseId) => {
        if (!Array.isArray(wishlistItems)) {
            return false;
        }
        return wishlistItems.some(item => item.course?.id === courseId);
    };

    // Add/remove from wishlist
    const addToWishlist = async (courseId) => {
        if (!userId) {
            Toast().fire({
                icon: "warning",
                title: "Silakan login untuk menambah ke daftar keinginan",
            });
            return;
        }

        if (isTeacher) {
            Toast().fire({
                icon: "info",
                title: "Instruktur tidak dapat menambahkan kursus ke daftar keinginan",
            });
            return;
        }

        try {
            const formdata = new FormData();
            formdata.append("user_id", userId);
            formdata.append("course_id", courseId);

            const response = await useAxios.post(`student/wishlist/${userId}/`, formdata);
            
            Toast().fire({
                icon: "success",
                title: response.data.message || "Daftar keinginan berhasil diperbarui",
            });
            
            await fetchWishlistItems();
            refreshWishlistCount();
        } catch (error) {
            let errorMessage = "Kesalahan saat memperbarui daftar keinginan";
            if (error.response) {
                if (error.response.status === 404) {
                    errorMessage = "Kursus tidak ditemukan";
                } else if (error.response.status === 401) {
                    errorMessage = "Silakan login lagi";
                } else if (error.response.data?.message) {
                    errorMessage = error.response.data.message;
                } else if (error.response.data?.detail) {
                    errorMessage = error.response.data.detail;
                }
            } else if (error.request) {
                errorMessage = "Kesalahan jaringan. Silakan periksa koneksi Anda";
            }
            
            Toast().fire({
                icon: "error",
                title: errorMessage,
            });
        }
    };

    // ✨ Fetch recommended courses for the user from LMSetjen DPD RI system
    useEffect(() => {
        let isMounted = true;

        const loadRecommendations = async () => {
            if (!allCourses || allCourses.length === 0) return;
            setIsLoadingRecommendations(true);

            try {
                const token = localStorage.getItem('token') || localStorage.getItem('access_token');
                let recsData = [];

                if (token && userId) {
                    try {
                        const response = await apiInstance.get('analytics/recommendations/?limit=6');
                        recsData = response.data?.results || response.data || [];
                    } catch (err) {
                        recsData = [];
                    }
                }

                // If personalized recommendations exist from backend
                if (recsData.length > 0) {
                    const mapped = recsData.map(rec => {
                        const matchedCourse = allCourses.find(c => c.id === rec.course || c.id === rec.course_detail?.id);
                        if (matchedCourse) {
                            return {
                                ...matchedCourse,
                                recommendationId: rec.id,
                                recommendationScore: rec.score,
                                recommendationReason: rec.reason,
                                recommendationBadge: `${Math.round(rec.score || 95)}% Cocok`
                            };
                        }
                        return null;
                    }).filter(Boolean);

                    if (mapped.length > 0 && isMounted) {
                        setRecommendedCourses(mapped.slice(0, 4));
                        setIsLoadingRecommendations(false);
                        return;
                    }
                }

                // Fallback: Smart curated recommendation from catalog
                const candidates = [...allCourses];
                candidates.sort((a, b) => {
                    const scoreA = (Number(a.average_rating || 0) * 20) + ((a.students?.length || 0) * 3) + ((a.reviews?.length || 0) * 2);
                    const scoreB = (Number(b.average_rating || 0) * 20) + ((b.students?.length || 0) * 3) + ((b.reviews?.length || 0) * 2);
                    return scoreB - scoreA;
                });

                const badges = [
                    "⭐ Rating Tertinggi",
                    "🔥 Terpopuler di DPD RI",
                    "🏛️ Kurasi Biro OKK Setjen",
                    "🎯 Rekomendasi Sistem"
                ];

                const topPicks = candidates.slice(0, 4).map((c, idx) => ({
                    ...c,
                    recommendationBadge: badges[idx % badges.length]
                }));

                if (isMounted) {
                    setRecommendedCourses(topPicks);
                }
            } catch (error) {
                console.error("Failed to load recommendations:", error);
            } finally {
                if (isMounted) {
                    setIsLoadingRecommendations(false);
                }
            }
        };

        loadRecommendations();

        return () => {
            isMounted = false;
        };
    }, [allCourses, userId]);

    const handleRecommendedCourseClick = async (course) => {
        if (course.recommendationId) {
            try {
                await apiInstance.post(`analytics/recommendations/${course.recommendationId}/click/`);
            } catch (e) {
                // silent catch
            }
        }
    };

    // Calculate total JP (Jam Pelajaran) from course
    // 1 JP = 45 minutes = 2700 seconds
    const calculateTotalJP = (course) => {
        if (!course) return 1;

        // 1. If backend provides total_jam_pelatihan > 0, use it
        if (typeof course.total_jam_pelatihan === "number" && course.total_jam_pelatihan > 0) {
            return course.total_jam_pelatihan;
        }

        // 2. Calculate from course.lectures if available
        let totalSeconds = 0;
        const lectures = Array.isArray(course.lectures) ? course.lectures : [];
        
        lectures.forEach(lecture => {
            if (typeof lecture.duration_seconds === "number" && lecture.duration_seconds > 0) {
                totalSeconds += lecture.duration_seconds;
            } else if (lecture.content_duration) {
                totalSeconds += parseDurationToSeconds(lecture.content_duration);
            }
        });

        // 3. Fallback to curriculum if lectures didn't have durations
        if (totalSeconds === 0 && Array.isArray(course.curriculum)) {
            course.curriculum.forEach(section => {
                const items = section.variant_items || section.items || [];
                items.forEach(item => {
                    if (typeof item.duration_seconds === "number" && item.duration_seconds > 0) {
                        totalSeconds += item.duration_seconds;
                    } else if (item.content_duration) {
                        totalSeconds += parseDurationToSeconds(item.content_duration);
                    }
                });
            });
        }

        if (totalSeconds > 0) {
            return Math.ceil(totalSeconds / 2700);
        }

        // 4. Default: Every published course in DPD RI has minimum 1 JP
        return 1;
    };

    // Combined filter function
    const applyFilters = (query, category, level, sort, sourceList = allCourses) => {
        let filtered = [...sourceList];

        // 1. Search Query Filter
        if (query && query.trim() !== "") {
            const lowerQuery = query.toLowerCase().trim();
            filtered = filtered.filter((course) => {
                const titleMatch = course.title?.toLowerCase().includes(lowerQuery);
                const teacherMatch = course.teacher?.full_name?.toLowerCase().includes(lowerQuery);
                const catMatch = course.category?.title?.toLowerCase().includes(lowerQuery);
                return titleMatch || teacherMatch || catMatch;
            });
        }

        // 2. Category Filter
        if (category && category !== "all") {
            filtered = filtered.filter((course) => course.category?.title === category);
        }

        // 3. Level Filter
        if (level && level !== "all") {
            filtered = filtered.filter((course) => {
                const cLevel = (course.level || "").toLowerCase();
                return cLevel === level.toLowerCase();
            });
        }

        // 4. Sort
        if (sort === "rating") {
            filtered.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        } else if (sort === "popular") {
            filtered.sort((a, b) => (b.students?.length || 0) - (a.students?.length || 0));
        } else if (sort === "newest") {
            filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        }

        setCourses(filtered);
        setCurrentPage(1);
    };

    // Search input handler
    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        applyFilters(query, selectedCategory, selectedLevel, sortBy);
    };

    // Category filter handler
    const handleCategoryChange = (category) => {
        setSelectedCategory(category);
        applyFilters(searchQuery, category, selectedLevel, sortBy);
    };

    // Level filter handler
    const handleLevelChange = (level) => {
        setSelectedLevel(level);
        applyFilters(searchQuery, selectedCategory, level, sortBy);
    };

    // Sort order handler
    const handleSortChange = (sort) => {
        setSortBy(sort);
        applyFilters(searchQuery, selectedCategory, selectedLevel, sort);
    };

    // Clear search query
    const handleClearSearch = () => {
        setSearchQuery("");
        applyFilters("", selectedCategory, selectedLevel, sortBy);
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    };

    // Reset all filters
    const handleResetAllFilters = () => {
        setSearchQuery("");
        setSelectedCategory("all");
        setSelectedLevel("all");
        setSortBy("relevance");
        setCourses(allCourses);
        setCurrentPage(1);
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    };

    // Instructor request modal trigger
    const handleStartTeaching = async () => {
        if (!userId) {
            Toast().fire({
                icon: "warning",
                title: "Silakan login terlebih dahulu",
                text: "Anda harus login untuk mengajukan permohonan instruktur"
            });
            return;
        }

        if (isTeacher) {
            Toast().fire({
                icon: "info",
                title: "Anda sudah menjadi instruktur",
                text: "Anda dapat mulai membuat dan mengelola kursus"
            });
            return;
        }

        try {
            const response = await apiInstance.get('/instructor-request/');
            if (response.data) {
                const requestData = Array.isArray(response.data) ? response.data[0] : response.data;
                if (requestData.status === 'APPROVED') {
                    Toast().fire({
                        icon: "info",
                        title: "Anda sudah menjadi instruktur",
                        text: "Anda dapat mulai membuat dan mengelola kursus"
                    });
                    setExistingInstructorRequest(requestData);
                    return;
                }
                setExistingInstructorRequest(requestData);
            }
        } catch (error) {
            setExistingInstructorRequest(null);
        }

        setShowInstructorModal(true);
    };

    const handleCloseInstructorModal = () => {
        setShowInstructorModal(false);
    };

    const handleInstructorRequestSuccess = async (requestData) => {
        setExistingInstructorRequest(requestData);
        setShowInstructorModal(false);
    };

    // Pagination calculations
    const coursesArray = Array.isArray(courses) ? courses : [];
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = coursesArray.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(coursesArray.length / itemsPerPage);
    const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

    // Initial load
    useEffect(() => {
        const loadInitialData = async () => {
            await fetchCourse();
            if (userId) {
                await fetchWishlistItems();
            }
        };
        loadInitialData();
    }, [userId]);

    // Handle URL search and category params
    useEffect(() => {
        const searchParam = searchParams.get('search');
        const categoryParam = searchParams.get('category');
        
        let initialQuery = searchQuery;
        let initialCategory = selectedCategory;

        if (searchParam !== null) {
            initialQuery = searchParam;
            setSearchQuery(searchParam);
        }
        
        if (categoryParam && allCourses.length > 0) {
            const matchedCourse = allCourses.find(course => 
                course.category?.title?.toLowerCase() === categoryParam.toLowerCase() ||
                course.category?.slug?.toLowerCase() === categoryParam.toLowerCase()
            );
            
            if (matchedCourse) {
                initialCategory = matchedCourse.category.title;
                setSelectedCategory(initialCategory);
            }
        }

        if (allCourses.length > 0) {
            applyFilters(initialQuery, initialCategory, selectedLevel, sortBy, allCourses);
        }
    }, [searchParams, allCourses]);

    // Check if any filter is active
    const isFilterActive = searchQuery.trim() !== "" || selectedCategory !== "all" || selectedLevel !== "all" || sortBy !== "relevance";

    return (
        <>
            <BaseHeader />

            <div 
                className="search-compact-wrapper"
                style={{ '--header-height': `${headerHeight}px` }}
            >
                {/* Hero Slot acts as a permanent layout placeholder */}
                <div className="search-hero-slot">
                    {/* Compact & Eye-Catching Hero Section */}
                    <section className={`search-compact-hero ${isScrolled ? 'is-stuck' : ''}`}>
                        <div className="container">
                            <div className="search-hero-inner">
                                {/* Top Badge & Header */}
                                <div className="search-hero-header">
                                    <div className="search-hero-badge">
                                        <span className="badge-dot"></span>
                                        <span>KATALOG PEMBELAJARAN ASN</span>
                                    </div>
                                    <h1 className="search-hero-title">
                                        <i className="fas fa-graduation-cap search-hero-icon me-2"></i>
                                        <span>Temukan Kursus Luar Biasa</span>
                                    </h1>
                                    <p className="search-hero-subtitle">
                                        Akses modul pelatihan dan pengembangan kompetensi di lingkungan Sekretariat Jenderal DPD RI
                                    </p>
                                </div>

                                {/* Integrated Compact Search Box */}
                                <div className="search-input-wrapper">
                                    <div className="search-input-box">
                                        <i className="fas fa-search search-input-icon"></i>
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            className="search-input-field"
                                            placeholder="Cari judul kursus, topik pelatihan, atau nama instruktur..."
                                            title="Cari judul kursus, topik pelatihan, atau nama instruktur..."
                                            aria-label="Cari judul kursus, topik pelatihan, atau nama instruktur"
                                            value={searchQuery}
                                            onChange={handleSearch}
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                className="search-clear-btn"
                                                onClick={handleClearSearch}
                                                title="Hapus pencarian"
                                                aria-label="Hapus kata kunci pencarian"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                        {/* Floating Hover Tooltip for complete placeholder visibility */}
                                        {!searchQuery && (
                                            <div className="search-placeholder-tooltip" role="tooltip">
                                                <i className="fas fa-circle-info text-teal-accent"></i>
                                                <span>Cari judul kursus, topik pelatihan, atau nama instruktur...</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Popular Quick Category Tags */}
                                {categories.length > 0 && (
                                    <div className="search-quick-tags">
                                        <span className="quick-tags-title">
                                            <i className="fas fa-fire me-1 text-teal"></i> Topik Populer:
                                        </span>
                                        <div className="quick-tags-container">
                                            {categories.slice(0, 5).map((cat, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className={`quick-tag-chip ${selectedCategory === cat ? 'active' : ''}`}
                                                    onClick={() => handleCategoryChange(selectedCategory === cat ? 'all' : cat)}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </div>

                {/* Main Content Area */}
                <main className="search-main-content">
                    {/* Background Geometric Grid & Luminous Glow Pattern matching About section */}
                    <div className="search-background-pattern" aria-hidden="true"></div>

                    <div className="container">
                        {/* Streamlined Filter & Control Bar */}
                        <div className="search-control-card">
                            <div className="search-control-row">
                                {/* Left Side: Count & Active Filter Reset */}
                                <div className="search-status-group">
                                    <span className="search-count-pill">
                                        <i className="fas fa-graduation-cap me-1"></i>
                                        <strong>{courses.length}</strong> Kursus Tersedia
                                    </span>

                                    {isFilterActive && (
                                        <button 
                                            type="button"
                                            className="btn-reset-filters"
                                            onClick={handleResetAllFilters}
                                            title="Reset semua filter pencarian"
                                        >
                                            <i className="fas fa-undo-alt me-1"></i>
                                            Reset Filter
                                        </button>
                                    )}
                                </div>

                                {/* Right Side: Level & Sort Controls */}
                                <div className="search-actions-group">
                                    {/* Level Selector */}
                                    <div className="filter-select-wrapper">
                                        <i className="fas fa-layer-group filter-select-icon"></i>
                                        <select
                                            className="filter-select-control"
                                            value={selectedLevel}
                                            onChange={(e) => handleLevelChange(e.target.value)}
                                            aria-label="Pilih tingkat kesulitan"
                                        >
                                            <option value="all">Semua Level</option>
                                            <option value="Beginner">Pemula</option>
                                            <option value="Intermediate">Menengah</option>
                                            <option value="Advanced">Lanjutan</option>
                                        </select>
                                    </div>

                                    {/* Sort Selector */}
                                    <div className="filter-select-wrapper">
                                        <i className="fas fa-sort-amount-down filter-select-icon"></i>
                                        <select
                                            className="filter-select-control"
                                            value={sortBy}
                                            onChange={(e) => handleSortChange(e.target.value)}
                                            aria-label="Pilih urutan kursus"
                                        >
                                            <option value="relevance">Relevansi</option>
                                            <option value="newest">Terbaru</option>
                                            <option value="rating">Rating Tertinggi</option>
                                            <option value="popular">Terpopuler</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Horizontal Scrollable Category Pills */}
                            <div className="search-category-strip">
                                <button
                                    type="button"
                                    className={`category-pill-btn ${selectedCategory === "all" ? "active" : ""}`}
                                    onClick={() => handleCategoryChange("all")}
                                >
                                    <i className="fas fa-th-large me-1"></i>
                                    Semua Kategori ({allCourses.length})
                                </button>
                                {categories.map((category, index) => {
                                    const count = allCourses.filter(c => c.category?.title === category).length;
                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            className={`category-pill-btn ${selectedCategory === category ? "active" : ""}`}
                                            onClick={() => handleCategoryChange(category)}
                                        >
                                            {category}
                                            {count > 0 && <span className="category-pill-count">{count}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Course List Section */}
                        {isLoading ? (
                            /* Sleek Skeleton Loading */
                            <div className="row g-3">
                                {[...Array(8)].map((_, index) => (
                                    <div key={index} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                                        <div className="compact-skeleton-card">
                                            <div className="skeleton-thumb"></div>
                                            <div className="skeleton-body">
                                                <div className="skeleton-line-title"></div>
                                                <div className="skeleton-line-sub"></div>
                                                <div className="skeleton-line-meta"></div>
                                                <div className="skeleton-btn"></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : courses.length === 0 ? (
                            /* Compact & Helpful Empty State */
                            <div className="search-empty-state">
                                <div className="empty-icon-circle">
                                    <i className="fas fa-search"></i>
                                </div>
                                <h3 className="empty-state-title">Kursus Tidak Ditemukan</h3>
                                <p className="empty-state-desc">
                                    {searchQuery 
                                        ? <>Tidak ada hasil yang sesuai dengan kata kunci "<strong>{searchQuery}</strong>". Coba kata kunci lain atau bersihkan filter.</>
                                        : "Belum ada kursus yang tersedia untuk kriteria filter yang dipilih."
                                    }
                                </p>
                                <div className="empty-state-actions">
                                    <button 
                                        type="button"
                                        className="btn-empty-reset"
                                        onClick={handleResetAllFilters}
                                    >
                                        <i className="fas fa-redo-alt me-2"></i>
                                        Tampilkan Semua Kursus
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Compact & Eye-Catching Course Grid */
                            <>
                                <div className="row g-3">
                                    {currentItems.map((c, index) => {
                                        const jpDuration = calculateTotalJP(c);
                                        const ratingValue = Number(c.average_rating || 0);

                                        return (
                                            <div key={c.id || index} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                                                <div className="compact-course-card">
                                                    {/* Card Media Header */}
                                                    <div className="card-media-wrapper">
                                                        <img
                                                            src={getImageUrl(c.image)}
                                                            alt={c.title}
                                                            className="card-media-image"
                                                            loading="lazy"
                                                            decoding="async"
                                                            onError={(e) => {
                                                                e.target.src = "/images/placeholders/default-course.svg";
                                                            }}
                                                        />
                                                        {!c.image && (
                                                            <div className="card-media-fallback">
                                                                <i className="fas fa-book-reader"></i>
                                                            </div>
                                                        )}

                                                        {/* Top Left: Level Badge */}
                                                        <span className="card-badge-level">
                                                            {c.level || "Umum"}
                                                        </span>

                                                        {/* Top Right: Wishlist Button */}
                                                        {!isTeacher && (
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    addToWishlist(c.id);
                                                                }} 
                                                                className="card-wishlist-action"
                                                                title={isCourseInWishlist(c.id) ? "Hapus dari daftar keinginan" : "Tambah ke daftar keinginan"}
                                                                disabled={!userId}
                                                                aria-label="Wishlist kursus"
                                                            >
                                                                <i className={`${isCourseInWishlist(c.id) ? 'fas fa-heart text-danger' : 'far fa-heart'}`} />
                                                            </button>
                                                        )}

                                                        {/* Bottom Left: Category Pill */}
                                                        {c.category?.title && (
                                                            <span className="card-badge-category">
                                                                {c.category.title}
                                                            </span>
                                                        )}

                                                        {/* Bottom Right: JP Badge */}
                                                        <span className="card-badge-jp">
                                                            <i className="fas fa-clock me-1"></i>
                                                            {jpDuration} JP
                                                        </span>
                                                    </div>

                                                    {/* Card Body */}
                                                    <div className="card-info-body">
                                                        {/* Title */}
                                                        <h3 className="compact-card-title">
                                                            <Link to={`/course-detail/${c.slug}/`}>
                                                                {c.title}
                                                            </Link>
                                                        </h3>

                                                        {/* Instructor Info */}
                                                        <div className="card-instructor-meta">
                                                            <i className="fas fa-user-circle me-1 text-teal"></i>
                                                            <span className="instructor-name">
                                                                {c.teacher?.full_name || 'Instruktur DPD RI'}
                                                            </span>
                                                        </div>

                                                        {/* Stats Row (Rating & Students) */}
                                                        <div className="card-stats-row">
                                                            <div className="card-rating-stat">
                                                                <i className="fas fa-star text-warning me-1"></i>
                                                                <strong>{ratingValue > 0 ? ratingValue.toFixed(1) : 'Baru'}</strong>
                                                                {ratingValue > 0 && (
                                                                    <span className="rating-count">({c.reviews?.length || 0})</span>
                                                                )}
                                                            </div>
                                                            <div className="card-students-stat">
                                                                <i className="fas fa-users me-1 text-secondary"></i>
                                                                <span>{c.students?.length || 0} Peserta</span>
                                                            </div>
                                                        </div>

                                                        {/* View Details Action Button */}
                                                        <Link 
                                                            to={`/course-detail/${c.slug}/`} 
                                                            className="btn-card-detail"
                                                        >
                                                            <span>Lihat Kursus</span>
                                                            <i className="fas fa-arrow-right"></i>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Modern Compact Pagination */}
                                {totalPages > 1 && (
                                    <div className="search-pagination-wrapper">
                                        <button 
                                            type="button"
                                            className={`page-nav-btn ${currentPage === 1 ? 'disabled' : ''}`}
                                            onClick={() => setCurrentPage(currentPage - 1)}
                                            disabled={currentPage === 1}
                                            aria-label="Halaman sebelumnya"
                                        >
                                            <i className="fas fa-chevron-left"></i>
                                        </button>
                                        
                                        <div className="page-numbers-group">
                                            {pageNumbers.map((number) => (
                                                <button 
                                                    key={number} 
                                                    type="button"
                                                    className={`page-num-btn ${currentPage === number ? 'active' : ''}`}
                                                    onClick={() => setCurrentPage(number)}
                                                >
                                                    {number}
                                                </button>
                                            ))}
                                        </div>
                                        
                                        <button 
                                            type="button"
                                            className={`page-nav-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                                            onClick={() => setCurrentPage(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                            aria-label="Halaman selanjutnya"
                                        >
                                            <i className="fas fa-chevron-right"></i>
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ✨ Section: Rekomendasi Kursus Sistem LMSetjen DPD RI (Di atas search-cta-banner) */}
                        {recommendedCourses.length > 0 && (
                            <section className="search-recommended-section" aria-label="Rekomendasi Kursus LMSetjen DPD RI">
                                <div className="recommended-header-wrapper">
                                    <div className="recommended-header-left">
                                        <div className="recommended-pill-tag">
                                            <i className="fas fa-sparkles"></i>
                                            <span>Rekomendasi Terpilih</span>
                                        </div>
                                        <h2 className="recommended-heading">
                                            Rekomendasi Kursus Untuk Anda
                                        </h2>
                                        <p className="recommended-subheading">
                                            Kursus kompetensi yang dikurasi khusus oleh sistem LMSetjen DPD RI untuk mengoptimalkan keahlian dan kinerja pegawai di lingkungan Sekretariat Jenderal DPD RI.
                                        </p>
                                    </div>
                                    <div className="recommended-header-right">
                                        <span className="recommended-count-badge">
                                            <i className="fas fa-award me-1 text-teal"></i>
                                            {recommendedCourses.length} Kursus Pilihan
                                        </span>
                                    </div>
                                </div>

                                <div className="row g-3">
                                    {recommendedCourses.map((c, index) => {
                                        const jpDuration = calculateTotalJP(c);
                                        const ratingValue = Number(c.average_rating || 0);

                                        return (
                                            <div key={`rec-${c.id || index}`} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                                                <div className="compact-course-card recommended-course-card">
                                                    {/* Card Media Header */}
                                                    <div className="card-media-wrapper">
                                                        <img
                                                            src={getImageUrl(c.image)}
                                                            alt={c.title}
                                                            className="card-media-image"
                                                            loading="lazy"
                                                            decoding="async"
                                                            onError={(e) => {
                                                                e.target.src = "/images/placeholders/default-course.svg";
                                                            }}
                                                        />
                                                        {!c.image && (
                                                            <div className="card-media-fallback">
                                                                <i className="fas fa-book-reader"></i>
                                                            </div>
                                                        )}

                                                        {/* Top Left: Recommendation Badge */}
                                                        <span className="card-badge-recommend-reason">
                                                            <i className="fas fa-star"></i>
                                                            {c.recommendationBadge || "Rekomendasi"}
                                                        </span>

                                                        {/* Level Badge (Shifted under recommendation badge) */}
                                                        <span className="card-badge-level-shifted">
                                                            {c.level || "Umum"}
                                                        </span>

                                                        {/* Top Right: Wishlist Button */}
                                                        {!isTeacher && (
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    addToWishlist(c.id);
                                                                }} 
                                                                className="card-wishlist-action"
                                                                title={isCourseInWishlist(c.id) ? "Hapus dari daftar keinginan" : "Tambah ke daftar keinginan"}
                                                                disabled={!userId}
                                                                aria-label="Wishlist kursus"
                                                            >
                                                                <i className={`${isCourseInWishlist(c.id) ? 'fas fa-heart text-danger' : 'far fa-heart'}`} />
                                                            </button>
                                                        )}

                                                        {/* Bottom Left: Category Pill */}
                                                        {c.category?.title && (
                                                            <span className="card-badge-category">
                                                                {c.category.title}
                                                            </span>
                                                        )}

                                                        {/* Bottom Right: JP Badge */}
                                                        <span className="card-badge-jp">
                                                            <i className="fas fa-clock me-1"></i>
                                                            {jpDuration} JP
                                                        </span>
                                                    </div>

                                                    {/* Card Body */}
                                                    <div className="card-info-body">
                                                        {/* Title */}
                                                        <h3 className="compact-card-title">
                                                            <Link 
                                                                to={`/course-detail/${c.slug}/`}
                                                                onClick={() => handleRecommendedCourseClick(c)}
                                                            >
                                                                {c.title}
                                                            </Link>
                                                        </h3>

                                                        {/* Instructor Info */}
                                                        <div className="card-instructor-meta">
                                                            <i className="fas fa-user-circle me-1 text-teal"></i>
                                                            <span className="instructor-name">
                                                                {c.teacher?.full_name || 'Instruktur DPD RI'}
                                                            </span>
                                                        </div>

                                                        {/* Stats Row (Rating & Students) */}
                                                        <div className="card-stats-row">
                                                            <div className="card-rating-stat">
                                                                <i className="fas fa-star text-warning me-1"></i>
                                                                <strong>{ratingValue > 0 ? ratingValue.toFixed(1) : 'Baru'}</strong>
                                                                {ratingValue > 0 && (
                                                                    <span className="rating-count">({c.reviews?.length || 0})</span>
                                                                )}
                                                            </div>
                                                            <div className="card-students-stat">
                                                                <i className="fas fa-users me-1 text-secondary"></i>
                                                                <span>{c.students?.length || 0} Peserta</span>
                                                            </div>
                                                        </div>

                                                        {/* Curated System Badge */}
                                                        <div className="recommended-system-tag">
                                                            <i className="fas fa-shield-alt text-teal"></i>
                                                            <span>Rekomendasi LMSetjen DPD RI</span>
                                                        </div>

                                                        {/* View Details Action Button */}
                                                        <Link 
                                                            to={`/course-detail/${c.slug}/`} 
                                                            className="btn-card-detail btn-rec-detail"
                                                            onClick={() => handleRecommendedCourseClick(c)}
                                                        >
                                                            <span>Pelajari Kursus</span>
                                                            <i className="fas fa-arrow-right"></i>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Compact Call to Action Section */}
                        <section className="search-cta-banner">
                            <div className="cta-banner-content">
                                <div className="cta-text-wrapper">
                                    <div className="cta-icon-box">
                                        <i className="fas fa-chalkboard-teacher"></i>
                                    </div>
                                    <div className="cta-copy">
                                        <h2 className="cta-heading">Jadilah Instruktur & Berbagi Pengetahuan di DPD RI</h2>
                                        <p className="cta-subheading">
                                            Bagikan kompetensi dan keahlian Anda untuk mendukung pengembangan SDM aparatur Sekretariat Jenderal DPD RI.
                                        </p>
                                    </div>
                                </div>
                                <div className="cta-btn-wrapper">
                                    <button 
                                        type="button"
                                        onClick={handleStartTeaching}
                                        className="btn-cta-action"
                                    >
                                        <span>Mulai Mengajar</span>
                                        <i className="fas fa-arrow-right"></i>
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                </main>
            </div>

            {/* Instructor Request Modal */}
            <InstructorRequestModal
                show={showInstructorModal}
                onClose={handleCloseInstructorModal}
                onSuccess={handleInstructorRequestSuccess}
                user={userData}
                existingRequest={existingInstructorRequest}
            />

            <Footer />
        </>
    );
}

export default Search;
