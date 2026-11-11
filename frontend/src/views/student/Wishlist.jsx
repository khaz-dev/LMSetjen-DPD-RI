import React, { useState, useEffect, useContext, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { WishlistContext } from "../plugin/Context";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
import { getImageUrl } from "../../utils/courseUtils";
import { parseDurationToSeconds } from "../../utils/durationUtils";
import { usePageCache } from "../../utils/usePageCache";
import "./Wishlist.css";

/**
 * ✨ Redesigned Student Wishlist Page (Kursus yang Ingin Dipelajari)
 * LMSetjen DPD RI - High-Density, Compact, Modern, Eye-Catching UI
 * Eliminates excessive white/blank space, provides grid/list views, quick search & filters
 */
function Wishlist() {
    const [wishlist, setWishlist] = useState([]);
    const [error, setError] = useState(null);
    const [removingId, setRemovingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedLevel, setSelectedLevel] = useState("all");
    const [sortBy, setSortBy] = useState("newest"); // 'newest' | 'title-asc' | 'rating-desc' | 'jp-desc'
    const [viewMode, setViewMode] = useState(() => {
        return localStorage.getItem("studentWishlistViewMode") || "grid";
    });

    const [wishlistCount, setWishlistCount, refreshWishlistCount] = useContext(WishlistContext);
    const isCollapsed = useSidebarCollapse();
    const userData = UserData();

    // Calculate total JP (Jam Pelajaran) from course lectures (1 JP = 45 mins = 2700s)
    const calculateTotalJP = useCallback((lectures) => {
        if (!lectures || !Array.isArray(lectures)) return 0;
        let totalSeconds = 0;
        lectures.forEach((lecture) => {
            if (lecture.content_duration) {
                totalSeconds += parseDurationToSeconds(lecture.content_duration);
            }
        });
        return Math.ceil(totalSeconds / 2700);
    }, []);

    // Level badge meta
    const getLevelBadge = (level) => {
        const lvl = (level || "").toLowerCase();
        if (lvl.includes("begin") || lvl.includes("pemula")) {
            return { label: "Pemula", tone: "level-emerald", icon: "fa-seedling" };
        }
        if (lvl.includes("inter") || lvl.includes("menengah")) {
            return { label: "Menengah", tone: "level-teal", icon: "fa-chart-simple" };
        }
        if (lvl.includes("adv") || lvl.includes("lanjut")) {
            return { label: "Lanjutan", tone: "level-indigo", icon: "fa-rocket" };
        }
        if (lvl.includes("exp") || lvl.includes("ahli")) {
            return { label: "Ahli", tone: "level-amber", icon: "fa-crown" };
        }
        return { label: level || "Semua Tingkat", tone: "level-slate", icon: "fa-layer-group" };
    };

    // Fetch wishlist items from backend
    const fetchWishlist = useCallback(async () => {
        if (!userData?.user_id) return [];
        try {
            setError(null);
            const response = await useAxios.get(`student/wishlist/${userData.user_id}/`);
            const wishlistData = response.data?.results || response.data || [];
            return Array.isArray(wishlistData) ? wishlistData : [];
        } catch (err) {
            console.error("Error fetching wishlist:", err);
            setError("Gagal memuat daftar kursus yang ingin dipelajari");
            Toast().fire({
                icon: "error",
                title: "Gagal memuat kursus yang ingin dipelajari",
            });
            throw err;
        }
    }, [userData?.user_id]);

    // Use page cache hook for instant navigation without loading stutter
    const { data: cachedWishlist, loading, refetch } = usePageCache(
        `student-wishlist-${userData?.user_id || "guest"}`,
        fetchWishlist,
        {
            showLoadingOnStale: false,
        }
    );

    // Sync cached data to local state
    useEffect(() => {
        if (cachedWishlist) {
            setWishlist(cachedWishlist);
        }
    }, [cachedWishlist]);

    // Remove course from wishlist with optimistic UI update
    const handleRemove = async (courseId, courseTitle, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!courseId || removingId) return;

        setRemovingId(courseId);
        const previousWishlist = [...wishlist];

        // Optimistic update
        setWishlist((prev) => prev.filter((item) => item.course?.id !== courseId));

        const formdata = new FormData();
        formdata.append("course_id", courseId);
        formdata.append("user_id", userData?.user_id);

        try {
            const response = await useAxios.post(`student/wishlist/${userData?.user_id}/`, formdata);

            Toast().fire({
                icon: "success",
                title: "Dihapus dari Daftar",
                text: courseTitle ? `"${courseTitle}" telah dihapus` : response.data?.message,
                timer: 1800,
            });

            if (refreshWishlistCount) {
                refreshWishlistCount();
            }
            if (refetch) {
                refetch();
            }
        } catch (err) {
            console.error("Gagal menghapus kursus dari wishlist:", err);
            // Rollback on failure
            setWishlist(previousWishlist);
            Toast().fire({
                icon: "error",
                title: "Gagal menghapus",
                text: "Terjadi kesalahan saat memperbarui daftar kursus yang ingin dipelajari.",
            });
        } finally {
            setRemovingId(null);
        }
    };

    // Calculate total JP across all wishlist items
    const totalWishlistJP = useMemo(() => {
        return wishlist.reduce((acc, curr) => {
            return acc + calculateTotalJP(curr.course?.lectures);
        }, 0);
    }, [wishlist, calculateTotalJP]);

    // Extract unique categories available in current wishlist
    const uniqueCategories = useMemo(() => {
        const cats = new Set();
        wishlist.forEach((item) => {
            const title = item.course?.category?.title;
            if (title) cats.add(title);
        });
        return Array.from(cats);
    }, [wishlist]);

    // Filter and sort wishlist items
    const filteredWishlist = useMemo(() => {
        let list = [...wishlist];

        // Search query filter (title, instructor, category)
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter((w) => {
                const title = (w.course?.title || "").toLowerCase();
                const teacher = (w.course?.teacher?.full_name || "").toLowerCase();
                const category = (w.course?.category?.title || "").toLowerCase();
                return title.includes(q) || teacher.includes(q) || category.includes(q);
            });
        }

        // Category filter
        if (selectedCategory !== "all") {
            list = list.filter((w) => w.course?.category?.title === selectedCategory);
        }

        // Level filter
        if (selectedLevel !== "all") {
            list = list.filter((w) => {
                const lvl = (w.course?.level || "").toLowerCase();
                return lvl.includes(selectedLevel.toLowerCase());
            });
        }

        // Sorting
        list.sort((a, b) => {
            if (sortBy === "title-asc") {
                return (a.course?.title || "").localeCompare(b.course?.title || "");
            }
            if (sortBy === "rating-desc") {
                return (b.course?.average_rating || 0) - (a.course?.average_rating || 0);
            }
            if (sortBy === "jp-desc") {
                return calculateTotalJP(b.course?.lectures) - calculateTotalJP(a.course?.lectures);
            }
            // default 'newest'
            return (b.id || 0) - (a.id || 0);
        });

        return list;
    }, [wishlist, searchQuery, selectedCategory, selectedLevel, sortBy, calculateTotalJP]);

    // Reset all search and dropdown filters
    const clearAllFilters = () => {
        setSearchQuery("");
        setSelectedCategory("all");
        setSelectedLevel("all");
        setSortBy("newest");
    };

    const hasActiveFilters = searchQuery.trim() !== "" || selectedCategory !== "all" || selectedLevel !== "all" || sortBy !== "newest";

    return (
        <>
            <BaseHeader />

            <section className="modern-wishlist-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* =========================================================================
                                1. COMPACT HERO SECTION (DPD RI Theme, Glowing Accent, Stat Chips)
                                ========================================================================= */}
                            <div className="wishlist-hero-card">
                                <div className="wishlist-hero-accent-shape"></div>
                                <div className="wishlist-hero-inner">
                                    <div className="wishlist-hero-content">
                                        <div className="wishlist-hero-badge">
                                            <i className="fas fa-landmark text-amber"></i>
                                            <span>Setjen DPD RI • E-Learning Platform</span>
                                        </div>
                                        <h1 className="wishlist-hero-title">
                                            <i className="fas fa-bookmark text-primary me-2"></i>
                                            Kursus yang Ingin Dipelajari
                                        </h1>
                                        <p className="wishlist-hero-desc">
                                            Kelola kursus pilihan Anda untuk perencanaan pengembangan kompetensi ASN yang berkelanjutan.
                                        </p>
                                    </div>

                                    {/* Compact Stat Chips */}
                                    <div className="wishlist-hero-stats">
                                        <div className="wishlist-stat-chip" title="Total kursus yang disimpan untuk dipelajari">
                                            <div className="wishlist-stat-chip-icon stat-icon-blue">
                                                <i className="fas fa-bookmark"></i>
                                            </div>
                                            <div className="wishlist-stat-chip-text">
                                                <span className="wishlist-stat-chip-val">{wishlist?.length || 0}</span>
                                                <span className="wishlist-stat-chip-lbl">Kursus Tersimpan</span>
                                            </div>
                                        </div>

                                        <div className="wishlist-stat-chip" title="Estimasi jam pelajaran dari seluruh kursus tersimpan">
                                            <div className="wishlist-stat-chip-icon stat-icon-amber">
                                                <i className="fas fa-clock"></i>
                                            </div>
                                            <div className="wishlist-stat-chip-text">
                                                <span className="wishlist-stat-chip-val">{totalWishlistJP} JP</span>
                                                <span className="wishlist-stat-chip-lbl">Total Pembelajaran</span>
                                            </div>
                                        </div>

                                        <div className="wishlist-stat-chip" title="Variasi bidang kompetensi kursus">
                                            <div className="wishlist-stat-chip-icon stat-icon-teal">
                                                <i className="fas fa-layer-group"></i>
                                            </div>
                                            <div className="wishlist-stat-chip-text">
                                                <span className="wishlist-stat-chip-val">{uniqueCategories.length}</span>
                                                <span className="wishlist-stat-chip-lbl">Bidang Kategori</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* =========================================================================
                                2. COMPACT SEARCH & CONTROL TOOLBAR (Zero Wasted Space)
                                ========================================================================= */}
                            <div className="wishlist-toolbar">
                                <div className="wishlist-toolbar-row">
                                    {/* Search Input */}
                                    <div className="wishlist-search-wrap">
                                        <i className="fas fa-search wishlist-search-icon"></i>
                                        <input
                                            type="text"
                                            className="form-control wishlist-search-input"
                                            placeholder="Cari kursus tersimpan, kategori, atau instruktur..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                className="wishlist-search-clear"
                                                onClick={() => setSearchQuery("")}
                                                title="Hapus pencarian"
                                                aria-label="Hapus pencarian"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>

                                    {/* Filters & View Controls */}
                                    <div className="wishlist-filter-group">
                                        {/* Category Select */}
                                        {uniqueCategories.length > 0 && (
                                            <div className="wishlist-select-wrap">
                                                <i className="fas fa-folder-open wishlist-select-icon"></i>
                                                <select
                                                    className="form-select wishlist-select"
                                                    value={selectedCategory}
                                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                                    title="Filter berdasarkan kategori"
                                                    aria-label="Filter kategori"
                                                >
                                                    <option value="all">Semua Kategori</option>
                                                    {uniqueCategories.map((cat) => (
                                                        <option key={cat} value={cat}>
                                                            {cat}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Level Select */}
                                        <div className="wishlist-select-wrap">
                                            <i className="fas fa-layer-group wishlist-select-icon"></i>
                                            <select
                                                className="form-select wishlist-select"
                                                value={selectedLevel}
                                                onChange={(e) => setSelectedLevel(e.target.value)}
                                                title="Filter tingkat kesulitan"
                                                aria-label="Filter tingkat kesulitan"
                                            >
                                                <option value="all">Semua Tingkat</option>
                                                <option value="beginner">Pemula</option>
                                                <option value="intermediate">Menengah</option>
                                                <option value="advanced">Lanjutan</option>
                                                <option value="expert">Ahli</option>
                                            </select>
                                        </div>

                                        {/* Sort Select */}
                                        <div className="wishlist-select-wrap">
                                            <i className="fas fa-arrow-down-short-wide wishlist-select-icon"></i>
                                            <select
                                                className="form-select wishlist-select"
                                                value={sortBy}
                                                onChange={(e) => setSortBy(e.target.value)}
                                                title="Urutkan daftar kursus"
                                                aria-label="Urutkan daftar kursus"
                                            >
                                                <option value="newest">Terbaru Disimpan</option>
                                                <option value="title-asc">Judul (A-Z)</option>
                                                <option value="rating-desc">Rating Tertinggi</option>
                                                <option value="jp-desc">JP Terbanyak</option>
                                            </select>
                                        </div>

                                        {/* View Switcher: Grid vs List */}
                                        <div className="wishlist-view-toggle" role="group" aria-label="Mode Tampilan">
                                            <button
                                                type="button"
                                                className={`wishlist-view-btn ${viewMode === "grid" ? "active" : ""}`}
                                                onClick={() => {
                                                    setViewMode("grid");
                                                    localStorage.setItem("studentWishlistViewMode", "grid");
                                                }}
                                                title="Tampilan Galeri Kartu"
                                                aria-label="Tampilan Galeri Kartu"
                                            >
                                                <i className="fas fa-grip"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className={`wishlist-view-btn ${viewMode === "list" ? "active" : ""}`}
                                                onClick={() => {
                                                    setViewMode("list");
                                                    localStorage.setItem("studentWishlistViewMode", "list");
                                                }}
                                                title="Tampilan Daftar Rapi"
                                                aria-label="Tampilan Daftar Rapi"
                                            >
                                                <i className="fas fa-list-ul"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Filters Status Bar */}
                                <div className="wishlist-toolbar-meta">
                                    <div className="wishlist-meta-count">
                                        <span className="badge-count-pill">{filteredWishlist.length}</span>
                                        <span>
                                            kursus ditampilkan
                                            {wishlist.length !== filteredWishlist.length && (
                                                <span className="text-muted ms-1">(dari total {wishlist.length} tersimpan)</span>
                                            )}
                                        </span>
                                    </div>

                                    <div className="d-flex align-items-center gap-2">
                                        {hasActiveFilters && (
                                            <button
                                                type="button"
                                                className="wishlist-btn-reset-filter"
                                                onClick={clearAllFilters}
                                            >
                                                <i className="fas fa-rotate-left me-1"></i>
                                                Reset Filter
                                            </button>
                                        )}

                                        <Link to="/search" className="wishlist-btn-catalog" title="Buka katalog lengkap">
                                            <i className="fas fa-compass me-1"></i>
                                            <span>Jelajahi Katalog</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* =========================================================================
                                3. CONTENT AREA (Loading, Error, Empty, Grid, List)
                                ========================================================================= */}

                            {/* Loading State */}
                            {loading && (
                                <div className="wishlist-cards-grid mb-4">
                                    {[1, 2, 3].map((n) => (
                                        <div className="wishlist-compact-card wishlist-skeleton-card" key={n}>
                                            <div className="skeleton-thumb"></div>
                                            <div className="wishlist-card-content p-3">
                                                <div className="skeleton-line sm mb-2"></div>
                                                <div className="skeleton-line lg mb-2"></div>
                                                <div className="skeleton-line md mb-3"></div>
                                                <div className="skeleton-line sm"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Error State */}
                            {error && !loading && (
                                <div className="alert alert-danger d-flex align-items-center justify-content-between p-3 rounded-4 mb-4" role="alert">
                                    <div className="d-flex align-items-center gap-2">
                                        <i className="fas fa-circle-exclamation fs-5 text-danger"></i>
                                        <span>{error}</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => refetch && refetch()}
                                    >
                                        <i className="fas fa-rotate-right me-1"></i>
                                        Coba Lagi
                                    </button>
                                </div>
                            )}

                            {/* Wishlist Data Loaded */}
                            {!loading && !error && (
                                <>
                                    {wishlist.length === 0 ? (
                                        /* Empty State: Wishlist is completely empty */
                                        <div className="wishlist-empty-card">
                                            <div className="wishlist-empty-icon-wrap">
                                                <i className="fas fa-bookmark"></i>
                                            </div>
                                            <h3 className="wishlist-empty-title">Belum Ada Kursus yang Ingin Dipelajari</h3>
                                            <p className="wishlist-empty-desc">
                                                Anda belum menyimpan kursus apapun. Temukan beragam kursus berkualitas di katalog LMSetjen DPD RI dan tandai kursus yang ingin Anda pelajari di sini.
                                            </p>
                                            <Link to="/search" className="btn-wishlist-explore">
                                                <i className="fas fa-compass me-2"></i>
                                                <span>Jelajahi Katalog Kursus</span>
                                            </Link>
                                        </div>
                                    ) : filteredWishlist.length === 0 ? (
                                        /* Empty State: Filter or search returned 0 results */
                                        <div className="wishlist-empty-card">
                                            <div className="wishlist-empty-icon-wrap filter-empty">
                                                <i className="fas fa-search"></i>
                                            </div>
                                            <h3 className="wishlist-empty-title">Tidak Ditemukan Kursus yang Sesuai</h3>
                                            <p className="wishlist-empty-desc">
                                                Tidak ada kursus tersimpan yang cocok dengan filter atau kata kunci pencarian Anda.
                                            </p>
                                            <button
                                                type="button"
                                                className="btn-wishlist-explore"
                                                onClick={clearAllFilters}
                                            >
                                                <i className="fas fa-rotate-left me-2"></i>
                                                <span>Reset Filter Pencarian</span>
                                            </button>
                                        </div>
                                    ) : viewMode === "grid" ? (
                                        /* =========================================================================
                                           GRID VIEW (Compact Cards, Proportional 155px Image)
                                           ========================================================================= */
                                        <div className="wishlist-cards-grid mb-4">
                                            {filteredWishlist.map((w, index) => {
                                                const course = w.course || {};
                                                const levelBadge = getLevelBadge(course.level);
                                                const courseJP = calculateTotalJP(course.lectures);
                                                const isRemoving = removingId === course.id;

                                                return (
                                                    <div className={`wishlist-compact-card ${isRemoving ? "removing" : ""}`} key={w.id || index}>
                                                        {/* Course Thumbnail */}
                                                        <div className="wishlist-thumb-wrapper">
                                                            <Link
                                                                to={`/course-detail/${course.slug || "#"}/`}
                                                                className="wishlist-thumb-link"
                                                                title={course.title}
                                                            >
                                                                <img
                                                                    src={getImageUrl(course.image)}
                                                                    alt={course.title || "Kursus"}
                                                                    className="wishlist-thumb-img"
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                    onError={(e) => {
                                                                        e.target.src = "/images/placeholders/default-course.svg";
                                                                    }}
                                                                />
                                                                <div className="wishlist-thumb-overlay">
                                                                    <span className="thumb-view-badge">
                                                                        <i className="fas fa-arrow-right"></i>
                                                                    </span>
                                                                </div>
                                                            </Link>

                                                            {/* Category Pill Floating Top-Left */}
                                                            <span
                                                                className="wishlist-category-pill"
                                                                title={course.category?.title || "Umum"}
                                                            >
                                                                <i className="fas fa-folder-open me-1"></i>
                                                                <span>{course.category?.title || "Umum"}</span>
                                                            </span>

                                                            {/* Remove Wishlist Button Floating Top-Right */}
                                                            <button
                                                                type="button"
                                                                className="wishlist-remove-btn"
                                                                onClick={(e) => handleRemove(course.id, course.title, e)}
                                                                title="Hapus dari kursus yang ingin dipelajari"
                                                                aria-label="Hapus dari kursus yang ingin dipelajari"
                                                                disabled={isRemoving}
                                                            >
                                                                {isRemoving ? (
                                                                    <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
                                                                ) : (
                                                                    <i className="fas fa-bookmark text-primary"></i>
                                                                )}
                                                            </button>
                                                        </div>

                                                        {/* Card Content */}
                                                        <div className="wishlist-card-content">
                                                            {/* Badges: Level & JP */}
                                                            <div className="wishlist-badges-row">
                                                                <span className={`wishlist-badge ${levelBadge.tone}`}>
                                                                    <i className={`fas ${levelBadge.icon} me-1`}></i>
                                                                    {levelBadge.label}
                                                                </span>
                                                                {courseJP > 0 && (
                                                                    <span className="wishlist-badge badge-jp" title={`Total durasi: ${courseJP} Jam Pelajaran`}>
                                                                        <i className="fas fa-clock me-1"></i>
                                                                        {courseJP} JP
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Course Title */}
                                                            <h3 className="wishlist-card-title">
                                                                <Link
                                                                    to={`/course-detail/${course.slug || "#"}/`}
                                                                    title={course.title}
                                                                >
                                                                    {course.title || "Judul Kursus Tidak Tersedia"}
                                                                </Link>
                                                            </h3>

                                                            {/* Instructor */}
                                                            <div className="wishlist-instructor-row">
                                                                <i className="fas fa-user-tie text-teal me-1"></i>
                                                                <span className="instructor-name text-truncate">
                                                                    {course.teacher?.full_name || "Instruktur Setjen DPD RI"}
                                                                </span>
                                                            </div>

                                                            {/* Metrics: Rating & Students */}
                                                            <div className="wishlist-metrics-row">
                                                                <div className="wishlist-rating-wrap">
                                                                    <i className="fas fa-star text-warning"></i>
                                                                    <span className="rating-score">
                                                                        {Number(course.average_rating || 0).toFixed(1)}
                                                                    </span>
                                                                    <span className="rating-count">
                                                                        ({course.reviews?.length || 0})
                                                                    </span>
                                                                </div>
                                                                <div className="wishlist-students-wrap">
                                                                    <i className="fas fa-users text-teal"></i>
                                                                    <span>{course.students?.length || 0} peserta</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Card Footer */}
                                                        <div className="wishlist-card-footer">
                                                            <Link
                                                                to={`/course-detail/${course.slug || "#"}/`}
                                                                className="btn-wishlist-primary"
                                                            >
                                                                <span>Lihat Detail Kursus</span>
                                                                <i className="fas fa-chevron-right ms-1"></i>
                                                            </Link>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        /* =========================================================================
                                           LIST VIEW (Ultra-Compact Rows, Maximum Space Efficiency)
                                           ========================================================================= */
                                        <div className="wishlist-list-container mb-4">
                                            {filteredWishlist.map((w, index) => {
                                                const course = w.course || {};
                                                const levelBadge = getLevelBadge(course.level);
                                                const courseJP = calculateTotalJP(course.lectures);
                                                const isRemoving = removingId === course.id;

                                                return (
                                                    <div
                                                        className={`wishlist-list-item ${isRemoving ? "removing" : ""}`}
                                                        key={w.id || index}
                                                    >
                                                        {/* Thumbnail */}
                                                        <div className="wishlist-list-thumb">
                                                            <Link to={`/course-detail/${course.slug || "#"}/`}>
                                                                <img
                                                                    src={getImageUrl(course.image)}
                                                                    alt={course.title || "Kursus"}
                                                                    className="list-thumb-img"
                                                                    loading="lazy"
                                                                    onError={(e) => {
                                                                        e.target.src = "/images/placeholders/default-course.svg";
                                                                    }}
                                                                />
                                                                <div className="list-thumb-overlay">
                                                                    <i className="fas fa-play"></i>
                                                                </div>
                                                            </Link>
                                                            {courseJP > 0 && (
                                                                <span className="list-thumb-jp">
                                                                    {courseJP} JP
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Info */}
                                                        <div className="wishlist-list-info">
                                                            <div className="wishlist-list-badges">
                                                                <span className="wishlist-badge badge-category-sm">
                                                                    <i className="fas fa-folder-open me-1"></i>
                                                                    {course.category?.title || "Umum"}
                                                                </span>
                                                                <span className={`wishlist-badge ${levelBadge.tone}`}>
                                                                    <i className={`fas ${levelBadge.icon} me-1`}></i>
                                                                    {levelBadge.label}
                                                                </span>
                                                            </div>

                                                            <h4 className="wishlist-list-title">
                                                                <Link to={`/course-detail/${course.slug || "#"}/`}>
                                                                    {course.title}
                                                                </Link>
                                                            </h4>

                                                            <div className="wishlist-list-meta">
                                                                <span className="meta-item">
                                                                    <i className="fas fa-user-tie text-teal me-1"></i>
                                                                    {course.teacher?.full_name || "Instruktur Setjen DPD RI"}
                                                                </span>
                                                                <span className="meta-dot">•</span>
                                                                <span className="meta-item">
                                                                    <i className="fas fa-star text-warning me-1"></i>
                                                                    <strong>{Number(course.average_rating || 0).toFixed(1)}</strong> ({course.reviews?.length || 0} ulasan)
                                                                </span>
                                                                <span className="meta-dot">•</span>
                                                                <span className="meta-item">
                                                                    <i className="fas fa-users text-teal me-1"></i>
                                                                    {course.students?.length || 0} peserta
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="wishlist-list-actions">
                                                            <Link
                                                                to={`/course-detail/${course.slug || "#"}/`}
                                                                className="btn-wishlist-primary list-btn-primary"
                                                            >
                                                                <span>Lihat Detail</span>
                                                                <i className="fas fa-chevron-right ms-1"></i>
                                                            </Link>
                                                            <button
                                                                type="button"
                                                                className="btn-wishlist-remove-outline"
                                                                onClick={(e) => handleRemove(course.id, course.title, e)}
                                                                title="Hapus dari kursus yang ingin dipelajari"
                                                                aria-label="Hapus dari kursus yang ingin dipelajari"
                                                                disabled={isRemoving}
                                                            >
                                                                {isRemoving ? (
                                                                    <span className="spinner-border spinner-border-sm" role="status"></span>
                                                                ) : (
                                                                    <>
                                                                        <i className="fas fa-trash-alt"></i>
                                                                        <span className="d-none d-sm-inline ms-1">Hapus</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default React.memo(Wishlist);
