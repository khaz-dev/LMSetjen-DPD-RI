import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";
import { getImageUrl, getCourseCurriculumSummary } from "../../../utils/courseUtils";

/**
 * Course Review Tab Component (Redesigned Compact & Live)
 * Setjen DPD RI Learning Platform
 */
function CourseReviewTab({ onCountsUpdated }) {
    const [courses, setCourses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [stats, setStats] = useState({
        all: 0,
        review: 0,
        published: 0,
        draft: 0,
        rejected: 0,
        disabled: 0
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters & view options
    const [filterStatus, setFilterStatus] = useState("Review");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [sortOrder, setSortOrder] = useState("recent");
    const [viewMode, setViewMode] = useState(() => {
        return localStorage.getItem("cm_course_view_mode") || "grid";
    });

    const navigate = useNavigate();

    // Debounce search query to prevent network request spam
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Toggle view mode and persist
    const handleSetViewMode = (mode) => {
        setViewMode(mode);
        try {
            localStorage.setItem("cm_course_view_mode", mode);
        } catch {
            // Ignore localStorage errors
        }
    };

    // Fetch categories for filtering dropdown
    const fetchCategories = useCallback(async () => {
        try {
            const response = await apiInstance.get("admin/category/");
            const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            setCategories(data);
        } catch (error) {
            console.error("[CourseReviewTab] Error fetching categories:", error);
        }
    }, []);

    // Fetch courses with real live parameters
    const fetchCourses = useCallback(async (isSilentRefresh = false) => {
        if (!isSilentRefresh) setLoading(true);
        else setRefreshing(true);

        try {
            const params = new URLSearchParams();
            if (filterStatus) params.append("status", filterStatus);
            if (selectedCategory && selectedCategory !== "all") params.append("category", selectedCategory);
            if (sortOrder) params.append("ordering", sortOrder);
            if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());

            const url = `/admin/courses-pending-review/?${params.toString()}`;
            const response = await apiInstance.get(url);

            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }

            setCourses(data);

            // Update live stats from backend response if available
            if (response.data?.stats) {
                setStats(response.data.stats);
            }
        } catch (error) {
            console.error("[CourseReviewTab] Error fetching courses:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat data kursus",
                text: error.response?.data?.detail || "Terjadi kesalahan saat memuat data"
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [filterStatus, selectedCategory, sortOrder, debouncedSearch]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        fetchCourses();
    }, [fetchCourses]);

    // Handle view details navigation
    const handleViewDetails = (course) => {
        if (course.course_id) {
            navigate(`/admin/review-course/${course.course_id}/`);
        } else {
            Toast().fire({
                icon: "error",
                title: "Error",
                text: "Course ID tidak ditemukan."
            });
        }
    };

    // Client-side quick filter fallback
    const filteredCourses = useMemo(() => {
        return courses.filter((course) => {
            if (!searchQuery.trim()) return true;
            const query = searchQuery.toLowerCase();
            const titleMatch = (course.title || "").toLowerCase().includes(query);
            const teacherMatch = (course.teacher?.full_name || course.user?.full_name || "").toLowerCase().includes(query);
            const catMatch = (course.category?.title || "").toLowerCase().includes(query);
            return titleMatch || teacherMatch || catMatch;
        });
    }, [courses, searchQuery]);

    // Format Indonesian readable dates
    const formatDate = (dateString) => {
        if (!dateString) return "-";
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return String(dateString);
        }
    };

    // Get status display badge
    const renderStatusBadge = (status) => {
        switch (status) {
            case "Review":
                return (
                    <span className="course-card-badge-status status-review">
                        <i className="fas fa-clock"></i>
                        Review
                    </span>
                );
            case "Published":
                return (
                    <span className="course-card-badge-status status-published">
                        <i className="fas fa-check-circle"></i>
                        Terbit
                    </span>
                );
            case "Draft":
                return (
                    <span className="course-card-badge-status status-draft">
                        <i className="fas fa-pencil-alt"></i>
                        Draft
                    </span>
                );
            case "Rejected":
                return (
                    <span className="course-card-badge-status status-rejected">
                        <i className="fas fa-times-circle"></i>
                        Ditolak
                    </span>
                );
            case "Disabled":
                return (
                    <span className="course-card-badge-status status-disabled">
                        <i className="fas fa-ban"></i>
                        Nonaktif
                    </span>
                );
            default:
                return (
                    <span className="course-card-badge-status status-draft">
                        {status || "Draft"}
                    </span>
                );
        }
    };

    return (
        <div className="cm-courses-tab">
            {/* 1. Header Bar with Module Info on Left and Interactive Stats Ribbon sticking to Right on Same Row */}
            <div className="cm-compact-header-card mb-3">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div className="d-flex align-items-center gap-2">
                        <div className="cm-header-icon-box bg-teal-subtle text-teal">
                            <i className="fas fa-check-circle"></i>
                        </div>
                        <div>
                            <h3 className="cm-module-title mb-0">Review & Kurasi Kursus</h3>
                            <p className="cm-module-desc mb-0">Tinjau kelayakan silabus, evaluasi materi pembelajaran, dan persetujuan penerbitan kursus</p>
                        </div>
                    </div>

                    {/* Live Stats Ribbon (Interactive High-Density KPI Quick Filters) */}
                    <div className="cm-stats-ribbon">
                        <div 
                            className={`cm-stat-card ${filterStatus === "all" ? "active" : ""}`}
                            onClick={() => setFilterStatus("all")}
                            title="Klik untuk melihat semua kursus"
                        >
                            <div className="cm-stat-icon-wrap stat-all">
                                <i className="fas fa-layer-group"></i>
                            </div>
                            <div className="cm-stat-info">
                                <span className="cm-stat-val">{stats.all}</span>
                                <span className="cm-stat-name">Semua Kursus</span>
                            </div>
                        </div>

                        <div 
                            className={`cm-stat-card stat-card-review ${filterStatus === "Review" ? "active" : ""} ${stats.review > 0 ? "has-pending" : ""}`}
                            onClick={() => setFilterStatus("Review")}
                            title="Klik untuk memfilter kursus yang menunggu reviu admin"
                        >
                            <div className="cm-stat-icon-wrap stat-review">
                                <i className="fas fa-hourglass-half"></i>
                            </div>
                            <div className="cm-stat-info">
                                <span className="cm-stat-val" style={{ color: stats.review > 0 ? "#d97706" : "inherit" }}>
                                    {stats.review}
                                </span>
                                <span className="cm-stat-name">Perlu Review</span>
                            </div>
                            {stats.review > 0 && (
                                <span className="cm-stat-alert-dot" title="Ada kursus menunggu persetujuan"></span>
                            )}
                        </div>

                        <div 
                            className={`cm-stat-card ${filterStatus === "Published" ? "active" : ""}`}
                            onClick={() => setFilterStatus("Published")}
                            title="Klik untuk memfilter kursus yang sudah dipublikasikan"
                        >
                            <div className="cm-stat-icon-wrap stat-published">
                                <i className="fas fa-check-circle"></i>
                            </div>
                            <div className="cm-stat-info">
                                <span className="cm-stat-val" style={{ color: "#059669" }}>{stats.published}</span>
                                <span className="cm-stat-name">Dipublikasi</span>
                            </div>
                        </div>

                        <div 
                            className={`cm-stat-card ${filterStatus === "Rejected" ? "active" : ""}`}
                            onClick={() => setFilterStatus("Rejected")}
                            title="Klik untuk memfilter kursus yang ditolak / perlu revisi"
                        >
                            <div className="cm-stat-icon-wrap stat-rejected">
                                <i className="fas fa-times-circle"></i>
                            </div>
                            <div className="cm-stat-info">
                                <span className="cm-stat-val" style={{ color: stats.rejected > 0 ? "#dc2626" : "inherit" }}>
                                    {stats.rejected}
                                </span>
                                <span className="cm-stat-name">Ditolak</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Single-Row Unified Executive Control Toolbar */}
            <div className="cm-toolbar-wrapper">
                <div className="cm-controls-left">
                    {/* Search Input */}
                    <div className="cm-search-box">
                        <i className="fas fa-search cm-search-icon"></i>
                        <input
                            type="text"
                            className="cm-search-input"
                            placeholder="Cari kursus, instruktur, kategori..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                className="cm-search-clear"
                                onClick={() => setSearchQuery("")}
                                title="Hapus pencarian"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>

                    {/* Category Dropdown with Icon */}
                    <div className="cm-select-wrap">
                        <i className="fas fa-filter cm-select-icon"></i>
                        <select
                            className="cm-select-control"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            title="Filter kategori"
                        >
                            <option value="all">Semua Kategori ({categories.length})</option>
                            {categories.map((cat) => (
                                <option key={cat.id || cat.slug} value={cat.id || cat.slug}>
                                    {cat.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Sort Order Dropdown with Icon */}
                    <div className="cm-select-wrap">
                        <i className="fas fa-sort-amount-down cm-select-icon"></i>
                        <select
                            className="cm-select-control"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            title="Urutkan daftar kursus"
                        >
                            <option value="recent">Terbaru Diajukan</option>
                            <option value="oldest">Terlama Dibuat</option>
                            <option value="title_asc">Judul (A-Z)</option>
                            <option value="title_desc">Judul (Z-A)</option>
                        </select>
                    </div>
                </div>

                <div className="cm-controls-right">
                    {/* Quick Link to Central Reports & Evaluations Hub */}
                    <Link
                        to="/admin/reports/?tab=course-evaluations"
                        className="btn-cm-quick-link"
                        title="Buka Pusat Laporan Eksekutif & Evaluasi Mutu Seluruh Kursus"
                    >
                        <i className="fas fa-chart-pie"></i>
                        <span className="d-none d-lg-inline">Pusat Laporan & Evaluasi</span>
                    </Link>

                    {/* View Mode Toggle (Grid vs Table) */}
                    <div className="cm-view-toggle" title="Pilih tampilan">
                        <button
                            type="button"
                            className={`cm-view-btn ${viewMode === "grid" ? "active" : ""}`}
                            onClick={() => handleSetViewMode("grid")}
                            title="Tampilan Kartu Ringkas"
                        >
                            <i className="fas fa-th-large"></i>
                        </button>
                        <button
                            type="button"
                            className={`cm-view-btn ${viewMode === "table" ? "active" : ""}`}
                            onClick={() => handleSetViewMode("table")}
                            title="Tampilan Tabel Rapat"
                        >
                            <i className="fas fa-list"></i>
                        </button>
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        className="cm-refresh-btn"
                        onClick={() => fetchCourses(true)}
                        disabled={refreshing || loading}
                        title="Segarkan daftar kursus"
                    >
                        <i className={`fas fa-sync-alt ${refreshing ? "fa-spin" : ""}`}></i>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-teal" style={{ color: "#0f766e" }} role="status">
                        <span className="visually-hidden">Memuat...</span>
                    </div>
                    <p className="mt-2 text-muted small">Memuat data kursus real-time...</p>
                </div>
            ) : filteredCourses.length === 0 ? (
                /* Compact Meaningful Empty State */
                <div className="cm-empty-container">
                    <div className="cm-empty-icon">
                        {filterStatus === "Review" ? (
                            <i className="fas fa-clipboard-check"></i>
                        ) : (
                            <i className="fas fa-search"></i>
                        )}
                    </div>
                    <h5 className="cm-empty-title">
                        {filterStatus === "Review"
                            ? "Semua Pengajuan Telah Ditinjau"
                            : "Tidak Ditemukan Kursus yang Cocok"}
                    </h5>
                    <p className="cm-empty-desc">
                        {filterStatus === "Review"
                            ? "Saat ini tidak ada kursus yang menunggu persetujuan review dari instruktur. Semua konten terkelola dengan baik."
                            : `Tidak ada data kursus yang sesuai dengan kriteria filter "${filterStatus}". Coba ubah kata kunci atau reset filter.`}
                    </p>
                    {filterStatus !== "all" ? (
                        <button
                            className="cm-btn-reset-filter"
                            onClick={() => {
                                setFilterStatus("all");
                                setSearchQuery("");
                                setSelectedCategory("all");
                            }}
                        >
                            <i className="fas fa-layer-group me-1"></i>
                            Tampilkan Semua Kursus ({stats.all})
                        </button>
                    ) : (
                        searchQuery && (
                            <button
                                className="cm-btn-reset-filter"
                                onClick={() => setSearchQuery("")}
                            >
                                <i className="fas fa-times me-1"></i>
                                Hapus Kata Kunci
                            </button>
                        )
                    )}
                </div>
            ) : viewMode === "grid" ? (
                /* Compact Grid View (4 Columns on Wide Screens, 3 on Large) */
                <div className="row g-2 g-xl-3">
                    {filteredCourses.map((course) => {
                        const { sectionsCount, lessonsCount, quizzesCount } = getCourseCurriculumSummary(course);
                        const teacherName = course.teacher?.full_name || course.user?.full_name || "Instruktur";
                        const teacherInitial = teacherName.charAt(0).toUpperCase();

                        return (
                            <div key={course.course_id} className="col-xxl-3 col-xl-4 col-md-6 col-12">
                                <div className="course-card-compact">
                                    {/* Thumbnail Header */}
                                    <div className="course-card-thumb-wrap">
                                        <img
                                            src={getImageUrl(course.image)}
                                            alt={course.title}
                                            className="course-card-thumb"
                                            onError={(e) => {
                                                e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                            }}
                                        />
                                        {/* Status Badge */}
                                        {renderStatusBadge(course.platform_status)}

                                        {/* Level Badge */}
                                        <span className="course-card-badge-level">
                                            {course.level || "Semua Level"}
                                        </span>
                                    </div>

                                    {/* Card Body */}
                                    <div className="course-card-body">
                                        {/* Category & Date Meta Row */}
                                        <div className="course-card-meta-line">
                                            <span className="course-card-cat-tag">
                                                <i className="fas fa-folder-open me-1"></i>
                                                {course.category?.title || "Umum"}
                                            </span>
                                            <span className="course-card-date-compact" title={course.review_submitted_date || course.date}>
                                                <i className="far fa-clock me-1"></i>
                                                {formatDate(course.review_submitted_date || course.date)}
                                            </span>
                                        </div>

                                        {/* Course Title */}
                                        <h5
                                            className="course-card-title"
                                            onClick={() => handleViewDetails(course)}
                                            title={course.title}
                                        >
                                            {course.title}
                                        </h5>

                                        {/* Instructor Info */}
                                        <div className="course-card-teacher">
                                            {course.teacher?.image ? (
                                                <img
                                                    src={getImageUrl(course.teacher.image)}
                                                    alt={teacherName}
                                                    className="course-card-avatar"
                                                    onError={(e) => {
                                                        e.target.style.display = "none";
                                                    }}
                                                />
                                            ) : (
                                                <div className="course-card-avatar">
                                                    {teacherInitial}
                                                </div>
                                            )}
                                            <span className="course-card-teacher-name">{teacherName}</span>
                                        </div>

                                        {/* Micro Metrics Bar */}
                                        <div className="course-card-metrics">
                                            <div className="course-card-metric-item" title="Jumlah Bagian Kurikulum">
                                                <i className="fas fa-layer-group"></i>
                                                <span>{sectionsCount} Bagian</span>
                                            </div>
                                            <div className="course-card-metric-item" title="Jumlah Pelajaran">
                                                <i className="fas fa-play-circle"></i>
                                                <span>{lessonsCount} Pelajaran</span>
                                            </div>
                                            <div className="course-card-metric-item" title="Jumlah Kuis Evaluasi">
                                                <i className="fas fa-clipboard-question"></i>
                                                <span>{quizzesCount} Kuis</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="course-card-actions">
                                            <button
                                                type="button"
                                                className="btn-review-primary"
                                                onClick={() => handleViewDetails(course)}
                                                title="Lihat rincian materi, kuis, dan evaluasi kelayakan terbit"
                                            >
                                                <i className="fas fa-clipboard-check"></i>
                                                <span>Tinjau</span>
                                            </button>

                                            <Link
                                                to={`/admin/courses/${course.course_id}/edit/`}
                                                className="btn-review-evaluation"
                                                title="Edit materi, metadata, dan kurikulum kursus langsung ke versi publik"
                                            >
                                                <i className="fas fa-edit"></i>
                                                <span>Edit</span>
                                            </Link>

                                            {course.platform_status === "Published" && course.slug && (
                                                <a
                                                    href={`/course-detail/${course.slug}/`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn-review-evaluation px-2"
                                                    title="Buka Halaman Publik Kursus (Tab Baru)"
                                                    style={{ backgroundColor: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" }}
                                                >
                                                    <i className="fas fa-external-link-alt"></i>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Dense Table View (High-Density List Mode) */
                <div className="cm-table-responsive">
                    <table className="cm-dense-table">
                        <thead>
                            <tr>
                                <th style={{ width: "40px", textAlign: "center" }}>No</th>
                                <th>Kursus</th>
                                <th>Instruktur</th>
                                <th>Level</th>
                                <th>Kurikulum</th>
                                <th>Status</th>
                                <th>Tanggal</th>
                                <th style={{ textAlign: "right" }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCourses.map((course, idx) => {
                                const { sectionsCount, lessonsCount, quizzesCount } = getCourseCurriculumSummary(course);
                                const teacherName = course.teacher?.full_name || course.user?.full_name || "Instruktur";

                                return (
                                    <tr key={course.course_id}>
                                        <td style={{ textAlign: "center", color: "#94a3b8", fontWeight: 600 }}>
                                            {idx + 1}
                                        </td>
                                        <td>
                                            <div className="table-course-cell">
                                                <img
                                                    src={getImageUrl(course.image)}
                                                    alt={course.title}
                                                    className="table-course-thumb"
                                                    onError={(e) => {
                                                        e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                                    }}
                                                />
                                                <div className="table-course-info">
                                                    <span
                                                        className="table-course-title"
                                                        onClick={() => handleViewDetails(course)}
                                                        title={course.title}
                                                    >
                                                        {course.title}
                                                    </span>
                                                    <span className="table-course-cat">
                                                        {course.category?.title || "Umum"}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 600, color: "#334155" }}>
                                                {teacherName}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-dark border">
                                                {course.level || "Semua"}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="small text-muted">
                                                <strong>{sectionsCount}</strong> bag · <strong>{lessonsCount}</strong> pel · <strong>{quizzesCount}</strong> kuis
                                            </span>
                                        </td>
                                        <td>
                                            {course.platform_status === "Review" && (
                                                <span className="badge bg-warning text-dark">
                                                    <i className="fas fa-clock me-1"></i>
                                                    Review
                                                </span>
                                            )}
                                            {course.platform_status === "Published" && (
                                                <span className="badge bg-success text-white">
                                                    <i className="fas fa-check me-1"></i>
                                                    Terbit
                                                </span>
                                            )}
                                            {course.platform_status === "Draft" && (
                                                <span className="badge bg-secondary text-white">
                                                    <i className="fas fa-file me-1"></i>
                                                    Draft
                                                </span>
                                            )}
                                            {course.platform_status === "Rejected" && (
                                                <span className="badge bg-danger text-white">
                                                    <i className="fas fa-times me-1"></i>
                                                    Ditolak
                                                </span>
                                            )}
                                            {!["Review", "Published", "Draft", "Rejected"].includes(course.platform_status) && (
                                                <span className="badge bg-secondary">
                                                    {course.platform_status || "Draft"}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <span className="small text-muted" title={course.review_submitted_date || course.date}>
                                                {formatDate(course.review_submitted_date || course.date)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <div className="d-flex align-items-center justify-content-end gap-1">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-teal py-1 px-2.5 d-inline-flex align-items-center gap-1 shadow-sm"
                                                    style={{ fontSize: "0.78rem", fontWeight: 600, backgroundColor: "#0d9488", color: "#ffffff", borderColor: "#0d9488", borderRadius: "6px" }}
                                                    onClick={() => handleViewDetails(course)}
                                                    title="Tinjau Detail & Kurikulum Kursus"
                                                >
                                                    <i className="fas fa-clipboard-check"></i>
                                                    <span>Tinjau</span>
                                                </button>
                                                <Link
                                                    to={`/admin/courses/${course.course_id}/edit/`}
                                                    className="btn btn-sm btn-outline-teal py-1 px-2.5 d-inline-flex align-items-center gap-1 shadow-sm"
                                                    style={{ fontSize: "0.78rem", fontWeight: 600, borderColor: "#0d9488", color: "#0d9488", borderRadius: "6px" }}
                                                    title="Edit Kursus & Konten Langsung (Live Update)"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                    <span>Edit</span>
                                                </Link>
                                                {course.platform_status === "Published" && course.slug && (
                                                    <a
                                                        href={`/course-detail/${course.slug}/`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-sm btn-light border py-1 px-2 d-inline-flex align-items-center justify-content-center shadow-sm text-secondary"
                                                        style={{ fontSize: "0.78rem", borderRadius: "6px", height: "28px" }}
                                                        title="Buka Halaman Publik Kursus (Tab Baru)"
                                                    >
                                                        <i className="fas fa-external-link-alt"></i>
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default React.memo(CourseReviewTab);
