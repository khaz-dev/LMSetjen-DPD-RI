import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";
import { getImageUrl } from "../../../utils/courseUtils";
import "./CourseEvaluationReportsTab.css";

/**
 * CourseEvaluationReportsTab Component (Redesigned & High-Density)
 * Platform: LMSetjen DPD RI
 * 
 * ✨ Zero-Waste Layout:
 *   - 4 Interactive Live KPI Metric Cards with Instant Filter Toggles
 *   - Compact Toolbar with Filter Chips, Live Search, Sort, View Switcher & CSV Export
 *   - Dual View Mode: High-Density Audit Table & Visual Compact Cards
 *   - Grouped Quick Actions: [Audit Evaluasi & Ujian], [Moderasi Edit], [Pratinjau]
 */
function CourseEvaluationReportsTab({ refreshTrigger = 0, onMutationSuccess }) {
    const [courses, setCourses] = useState([]);
    const [stats, setStats] = useState({
        total_courses: 0,
        total_students_enrolled: 0,
        total_completions: 0,
        overall_completion_rate: 0,
        average_rating: 0,
        total_reviews: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // Filters & View State
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sortBy, setSortBy] = useState("rating_desc");
    const [viewMode, setViewMode] = useState("table"); // 'table' | 'grid'

    // Fetch summary data from backend
    const fetchEvaluations = useCallback(async (isSilent = false) => {
        try {
            if (isSilent) setRefreshing(true);
            else setLoading(true);

            const res = await apiInstance.get("/admin/course-evaluations-summary/");
            if (res.data?.success) {
                setCourses(res.data.courses || []);
                if (res.data.stats) {
                    setStats(res.data.stats);
                }
            }
        } catch (error) {
            console.error("Error fetching course evaluations summary:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat evaluasi kursus",
                text: error.response?.data?.error || "Terjadi kesalahan pada server."
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchEvaluations();
    }, [fetchEvaluations, refreshTrigger]);

    // Live counts for status chips
    const statusCounts = useMemo(() => {
        const total = courses.length;
        const published = courses.filter(c => c.platform_status?.toLowerCase() === "published").length;
        const review = courses.filter(c => c.platform_status?.toLowerCase() === "review").length;
        const draft = courses.filter(c => c.platform_status?.toLowerCase() === "draft").length;
        const rejected = courses.filter(c => c.platform_status?.toLowerCase() === "rejected").length;
        return { total, published, review, draft, rejected };
    }, [courses]);

    // Filtered & sorted courses
    const filteredCourses = useMemo(() => {
        let result = [...courses];

        // Status filter
        if (statusFilter !== "all") {
            result = result.filter(c => 
                c.platform_status?.toLowerCase() === statusFilter.toLowerCase()
            );
        }

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(c => 
                c.title?.toLowerCase().includes(q) ||
                c.teacher?.full_name?.toLowerCase().includes(q) ||
                c.category?.title?.toLowerCase().includes(q)
            );
        }

        // Sorting
        result.sort((a, b) => {
            if (sortBy === "rating_desc") {
                return (b.average_rating || 0) - (a.average_rating || 0);
            }
            if (sortBy === "rating_asc") {
                return (a.average_rating || 0) - (b.average_rating || 0);
            }
            if (sortBy === "students_desc") {
                return (b.enrolled_count || 0) - (a.enrolled_count || 0);
            }
            if (sortBy === "completion_desc") {
                return (b.completion_rate || 0) - (a.completion_rate || 0);
            }
            if (sortBy === "title_asc") {
                return a.title?.localeCompare(b.title || "") || 0;
            }
            // newest
            return new Date(b.date || 0) - new Date(a.date || 0);
        });

        return result;
    }, [courses, statusFilter, searchQuery, sortBy]);

    // Export Excel (.xlsx) handler
    const handleExportExcel = async () => {
        try {
            if (!filteredCourses.length) {
                Toast().fire({
                    icon: "warning",
                    title: "Tidak ada data untuk diekspor"
                });
                return;
            }
            setIsExportingExcel(true);
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            
            const response = await apiInstance.get(
                `admin/course-evaluations-export-excel/?status=${encodeURIComponent(statusFilter)}&search=${encodeURIComponent(searchQuery)}`,
                { responseType: "blob" }
            );

            const blob = new Blob([response.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Laporan_Evaluasi_Kursus_Setjen_DPD_RI_${dateStr}.xlsx`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            Toast().fire({
                icon: "success",
                title: "Laporan evaluasi kursus (.xlsx) berhasil diunduh"
            });
        } catch (err) {
            console.error("Error exporting excel:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal mengekspor laporan Excel"
            });
        } finally {
            setIsExportingExcel(false);
        }
    };

    // Print / PDF Handler
    const handlePrintReport = () => {
        window.print();
    };

    const getStatusBadge = (status) => {
        const s = (status || "").toLowerCase().trim();
        if (s === "published" || s === "publish" || s === "publik") {
            return (
                <span className="badge badge-eval-status badge-eval-published">
                    <i className="fas fa-check-circle me-1"></i>
                    <span>Publik</span>
                </span>
            );
        }
        if (s === "review" || s === "reviu" || s === "menunggu") {
            return (
                <span className="badge badge-eval-status badge-eval-review">
                    <i className="fas fa-clock me-1"></i>
                    <span>Review</span>
                </span>
            );
        }
        if (s === "draft") {
            return (
                <span className="badge badge-eval-status badge-eval-draft">
                    <i className="fas fa-file-edit me-1"></i>
                    <span>Draft</span>
                </span>
            );
        }
        if (s === "rejected" || s === "ditolak") {
            return (
                <span className="badge badge-eval-status badge-eval-rejected">
                    <i className="fas fa-times-circle me-1"></i>
                    <span>Ditolak</span>
                </span>
            );
        }
        if (s === "disabled" || s === "nonaktif") {
            return (
                <span className="badge badge-eval-status badge-eval-disabled">
                    <i className="fas fa-ban me-1"></i>
                    <span>Nonaktif</span>
                </span>
            );
        }
        return (
            <span className="badge badge-eval-status badge-eval-draft">
                <span>{status || "-"}</span>
            </span>
        );
    };

    return (
        <div className="course-evaluation-tab-container">
            {/* Interactive KPI Metrics Grid */}
            <div className="course-eval-kpi-grid">
                {/* 1. Total Courses Card */}
                <div 
                    className={`kpi-card interactive-kpi ${statusFilter === "all" ? "active" : ""}`}
                    onClick={() => setStatusFilter("all")}
                    title="Klik untuk tampilkan semua kursus"
                >
                    <div className="kpi-icon-box bg-teal-subtle text-teal">
                        <i className="fas fa-graduation-cap"></i>
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-value">{stats.total_courses || courses.length}</span>
                        <span className="kpi-label">Total Kursus</span>
                        <span className="kpi-subtext">
                            {statusCounts.published} Publik &bull; {statusCounts.review} Reviu
                        </span>
                    </div>
                </div>

                {/* 2. Participation & Completions Card */}
                <div 
                    className="kpi-card"
                    title="Total pegawai terdaftar dan menyelesaikan kursus"
                >
                    <div className="kpi-icon-box bg-blue-subtle text-primary">
                        <i className="fas fa-users"></i>
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-value">{stats.total_students_enrolled}</span>
                        <span className="kpi-label">Partisipan Terdaftar</span>
                        <span className="kpi-subtext text-success fw-semibold">
                            {stats.total_completions} Pegawai Lulus
                        </span>
                    </div>
                </div>

                {/* 3. Average Rating Card */}
                <div 
                    className="kpi-card"
                    title="Rata-rata rating evaluasi kepuasan peserta (skala 5)"
                >
                    <div className="kpi-icon-box bg-warning-subtle text-warning">
                        <i className="fas fa-star"></i>
                    </div>
                    <div className="kpi-content">
                        <div className="d-flex align-items-center gap-1">
                            <span className="kpi-value">{stats.average_rating > 0 ? stats.average_rating : "0.0"}</span>
                            <i className="fas fa-star text-warning" style={{ fontSize: "1rem" }}></i>
                        </div>
                        <span className="kpi-label">Kepuasan Peserta</span>
                        <span className="kpi-subtext">
                            {stats.total_reviews} Ulasan Resmi Terkumpul
                        </span>
                    </div>
                </div>

                {/* 4. Overall Completion Rate Card */}
                <div 
                    className="kpi-card"
                    title="Efektivitas pembelajaran dan kelulusan platform"
                >
                    <div className="kpi-icon-box bg-success-subtle text-success">
                        <i className="fas fa-chart-line"></i>
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-value">{stats.overall_completion_rate}%</span>
                        <span className="kpi-label">Efektivitas Belajar</span>
                        <span className="kpi-subtext">
                            Rasio Penyelesaian Materi
                        </span>
                    </div>
                </div>
            </div>

            {/* Ultra-Compact Executive Toolbar */}
            <div className="course-eval-toolbar">
                {/* Left: Search, Status Dropdown Filter, Sort Dropdown */}
                <div className="toolbar-left-controls">
                    {/* Live Search */}
                    <div className="search-input-wrapper" style={{ width: "230px" }}>
                        <i className="fas fa-search search-icon"></i>
                        <input
                            type="text"
                            className="form-control form-control-sm search-input"
                            placeholder="Cari kursus, instruktur, kategori..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="search-clear-btn"
                                onClick={() => setSearchQuery("")}
                                title="Hapus pencarian"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>

                    {/* Status Dropdown Menu (Replaces filter-chips-group) */}
                    <div className="toolbar-select-group">
                        <i className="fas fa-filter toolbar-select-icon text-teal"></i>
                        <select
                            className="form-select form-select-sm toolbar-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            title="Filter Berdasarkan Status Kursus"
                        >
                            <option value="all">Semua Status ({statusCounts.total})</option>
                            <option value="published">Publik ({statusCounts.published})</option>
                            <option value="review">Menunggu Reviu ({statusCounts.review})</option>
                            <option value="draft">Draft ({statusCounts.draft})</option>
                            {statusCounts.rejected > 0 && (
                                <option value="rejected">Ditolak ({statusCounts.rejected})</option>
                            )}
                        </select>
                    </div>

                    {/* Sort Dropdown */}
                    <div className="toolbar-select-group">
                        <i className="fas fa-arrow-down-short-wide toolbar-select-icon"></i>
                        <select
                            className="form-select form-select-sm toolbar-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            title="Urutkan data"
                        >
                            <option value="rating_desc">Rating Tertinggi</option>
                            <option value="students_desc">Peserta Terbanyak</option>
                            <option value="completion_desc">Tingkat Kelulusan</option>
                            <option value="newest">Paling Baru</option>
                            <option value="title_asc">Judul (A-Z)</option>
                        </select>
                    </div>
                </div>

                {/* Right: Counter Pill, View Mode Toggle, Export, Refresh */}
                <div className="toolbar-right-controls">
                    {/* Live Match Counter Pill */}
                    <div className="eval-counter-pill" title="Jumlah kursus yang ditampilkan sesuai filter">
                        <i className="fas fa-layer-group text-teal"></i>
                        <span><strong>{filteredCourses.length}</strong> Kursus</span>
                    </div>

                    {/* View Switcher: Table vs Cards */}
                    <div className="btn-group view-mode-group" role="group">
                        <button
                            type="button"
                            className={`btn btn-sm ${viewMode === "table" ? "btn-teal text-white" : "btn-light border"}`}
                            onClick={() => setViewMode("table")}
                            title="Tampilan Tabel Berdensitas Tinggi"
                            style={viewMode === "table" ? { backgroundColor: "#0d9488", borderColor: "#0d9488" } : {}}
                        >
                            <i className="fas fa-list-ul"></i>
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${viewMode === "grid" ? "btn-teal text-white" : "btn-light border"}`}
                            onClick={() => setViewMode("grid")}
                            title="Tampilan Kartu Ringkas"
                            style={viewMode === "grid" ? { backgroundColor: "#0d9488", borderColor: "#0d9488" } : {}}
                        >
                            <i className="fas fa-grip-vertical"></i>
                        </button>
                    </div>

                    {/* Export Excel (.xlsx) Button */}
                    <button
                        type="button"
                        className="btn-export-excel"
                        onClick={handleExportExcel}
                        disabled={isExportingExcel || loading}
                        title="Ekspor Seluruh Rekapitulasi Evaluasi Kursus ke Format Excel (.xlsx)"
                    >
                        <i className={`fas ${isExportingExcel ? "fa-spinner fa-spin" : "fa-file-excel"}`}></i>
                        <span className="d-none d-sm-inline">{isExportingExcel ? "Mengunduh..." : "Ekspor Excel"}</span>
                    </button>

                    {/* Print / PDF Button */}
                    <button
                        type="button"
                        className="btn-export-pdf"
                        onClick={handlePrintReport}
                        disabled={loading}
                        title="Cetak Laporan / Simpan sebagai PDF"
                    >
                        <i className="fas fa-print"></i>
                        <span className="d-none d-sm-inline">Cetak / PDF</span>
                    </button>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary refresh-btn"
                        onClick={() => fetchEvaluations(true)}
                        disabled={refreshing}
                        title="Segarkan data evaluasi"
                        style={{ height: "32px", width: "32px", padding: 0 }}
                    >
                        <i className={`fas fa-sync-alt ${refreshing ? "fa-spin" : ""}`}></i>
                    </button>
                </div>
            </div>

            {/* Content Area: Table Mode or Grid Mode */}
            {loading ? (
                <div className="compact-loading-state text-center py-4">
                    <div className="spinner-border text-teal mb-2" style={{ width: "2rem", height: "2rem" }} role="status">
                        <span className="visually-hidden">Memuat...</span>
                    </div>
                    <div className="fw-semibold text-dark small">Memuat evaluasi mutu dan capaian kursus...</div>
                </div>
            ) : filteredCourses.length === 0 ? (
                <div className="compact-empty-state text-center py-4">
                    <div className="empty-icon-circle mb-2">
                        <i className="fas fa-folder-open text-muted"></i>
                    </div>
                    <h6 className="fw-bold text-dark mb-1">Tidak Ada Kursus yang Sesuai</h6>
                    <p className="text-muted small mb-0">Coba ubah kata kunci pencarian atau filter status Anda.</p>
                </div>
            ) : viewMode === "table" ? (
                /* High Density Table View */
                <div className="course-eval-table-wrapper">
                    <div className="course-eval-table-header">
                        <div className="d-flex align-items-center gap-2">
                            <i className="fas fa-clipboard-check text-teal"></i>
                            <span className="fw-bold text-dark small">Daftar Kursus & Evaluasi Mutu Pembelajaran</span>
                        </div>
                        <span className="text-muted small">
                            Menampilkan <strong>{filteredCourses.length}</strong> dari {courses.length} Kursus
                        </span>
                    </div>

                    <div className="table-responsive">
                        <table className="table course-eval-table align-middle">
                            <thead>
                                <tr>
                                    <th style={{ width: "340px" }}>Kursus & Silabus</th>
                                    <th style={{ width: "160px" }}>Instruktur Pengampu</th>
                                    <th style={{ width: "120px" }} className="text-center">Status</th>
                                    <th style={{ width: "130px" }} className="text-center">Kelulusan Peserta</th>
                                    <th style={{ width: "120px" }} className="text-center">Kepuasan Peserta</th>
                                    <th style={{ width: "80px" }} className="text-center">Bobot</th>
                                    <th style={{ width: "210px" }} className="text-center">Aksi Administrator</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCourses.map((c) => (
                                    <tr key={c.course_id || c.id}>
                                        {/* Course Info */}
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="course-thumb-box">
                                                    <img
                                                        src={getImageUrl(c.image)}
                                                        alt={c.title}
                                                        onError={(e) => {
                                                            e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                                        }}
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="course-title-text text-truncate" title={c.title}>
                                                        {c.title}
                                                    </div>
                                                    <div className="course-meta-tags">
                                                        <span className="course-meta-pill">
                                                            {c.category?.title || "Umum"}
                                                        </span>
                                                        <span>&bull;</span>
                                                        <span>{c.level || "Beginner"}</span>
                                                        <span>&bull;</span>
                                                        <span>{c.quizzes_count || 0} Kuis</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Instructor */}
                                        <td>
                                            <div className="fw-semibold text-dark small text-truncate" style={{ maxWidth: "150px" }} title={c.teacher?.full_name}>
                                                {c.teacher?.full_name || "Instruktur"}
                                            </div>
                                            <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                {c.teacher?.email || "-"}
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="text-center">
                                            {getStatusBadge(c.platform_status)}
                                        </td>

                                        {/* Completion Ratio */}
                                        <td className="text-center">
                                            <div className="fw-bold text-dark small">
                                                {c.completed_count} / {c.enrolled_count} <span className="text-muted fw-normal">({c.completion_rate}%)</span>
                                            </div>
                                            <div className="progress-micro-wrap">
                                                <div className="progress-micro">
                                                    <div
                                                        className="progress-micro-bar bg-teal"
                                                        style={{ 
                                                            width: `${Math.min(100, c.completion_rate || 0)}%`,
                                                            backgroundColor: "#0d9488"
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Rating */}
                                        <td className="text-center">
                                            {c.average_rating > 0 ? (
                                                <div className="d-flex flex-column align-items-center gap-1">
                                                    <span className="rating-pill-badge">
                                                        <i className="fas fa-star"></i>
                                                        <span>{c.average_rating}</span>
                                                    </span>
                                                    <span className="text-muted" style={{ fontSize: "0.68rem" }}>
                                                        {c.rating_count} Ulasan
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-muted small">-</span>
                                            )}
                                        </td>

                                        {/* JP */}
                                        <td className="text-center">
                                            <span className="jp-badge-pill">
                                                {c.total_jp || 2} JP
                                            </span>
                                        </td>

                                        {/* Grouped Admin Actions */}
                                        <td className="text-center">
                                            <div className="eval-action-btn-group">
                                                {/* 1. Evaluasi & Audit Ujian Button */}
                                                <Link
                                                    to={`/admin/courses/${c.course_id || c.id}/evaluation/`}
                                                    state={{ from: "/admin/reports/?tab=course-evaluations", fromLabel: "Evaluasi Kursus" }}
                                                    className="btn-action-eval"
                                                    title="Buka Evaluasi & Audit Ujian Mendalam"
                                                >
                                                    <i className="fas fa-poll-h"></i>
                                                    <span>Evaluasi</span>
                                                </Link>

                                                {/* 2. Moderasi / Edit Kursus Button */}
                                                <Link
                                                    to={`/instructor/edit-course/${c.course_id || c.id}/`}
                                                    state={{ from: "/admin/reports/?tab=course-evaluations", fromLabel: "Evaluasi Kursus" }}
                                                    className="btn-action-edit"
                                                    title="Moderasi dan Sunting Kursus ini"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                    <span>Edit</span>
                                                </Link>

                                                {/* 3. Reviu Kurikulum Button */}
                                                <Link
                                                    to={`/admin/review-course/${c.course_id || c.id}/`}
                                                    state={{ from: "/admin/reports/?tab=course-evaluations", fromLabel: "Evaluasi Kursus" }}
                                                    className="btn-action-review"
                                                    title="Tinjau Detail Kurikulum & Pratinjau Materi"
                                                >
                                                    <i className="fas fa-eye"></i>
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Compact Visual Card Grid View */
                <div className="course-eval-grid-wrapper">
                    {filteredCourses.map((c) => (
                        <div key={c.course_id || c.id} className="course-eval-card">
                            <div>
                                <div className="course-eval-card-top">
                                    <div className="course-eval-card-thumb">
                                        <img
                                            src={getImageUrl(c.image)}
                                            alt={c.title}
                                            onError={(e) => {
                                                e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                            }}
                                        />
                                    </div>
                                    <div className="course-eval-card-info">
                                        <div className="d-flex align-items-center justify-content-between gap-1 mb-1">
                                            <span className="course-meta-pill">{c.category?.title || "Umum"}</span>
                                            {getStatusBadge(c.platform_status)}
                                        </div>
                                        <h6 className="course-eval-card-title" title={c.title}>
                                            {c.title}
                                        </h6>
                                        <div className="course-eval-card-instructor">
                                            <i className="fas fa-user-circle text-muted"></i>
                                            <span className="text-truncate">{c.teacher?.full_name || "Instruktur"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Compact Metrics Grid */}
                                <div className="course-eval-metrics-row">
                                    <div className="course-eval-metric-item">
                                        <span className="metric-label">Kelulusan</span>
                                        <span className="metric-val text-teal" style={{ color: "#0d9488" }}>
                                            {c.completed_count}/{c.enrolled_count} <span className="small">({c.completion_rate}%)</span>
                                        </span>
                                    </div>
                                    <div className="course-eval-metric-item">
                                        <span className="metric-label">Rating</span>
                                        <span className="metric-val text-warning">
                                            {c.average_rating > 0 ? `${c.average_rating} ★` : "-"}
                                        </span>
                                    </div>
                                    <div className="course-eval-metric-item">
                                        <span className="metric-label">Bobot</span>
                                        <span className="metric-val text-dark">{c.total_jp || 2} JP</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="course-eval-card-footer">
                                <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                    <i className="fas fa-clock me-1"></i>{c.quizzes_count || 0} Kuis aktif
                                </span>
                                <div className="eval-action-btn-group">
                                    <Link
                                        to={`/admin/courses/${c.course_id || c.id}/evaluation/`}
                                        state={{ from: "/admin/reports/?tab=course-evaluations", fromLabel: "Evaluasi Kursus" }}
                                        className="btn-action-eval"
                                        title="Buka Evaluasi & Audit Ujian"
                                    >
                                        <i className="fas fa-poll-h"></i>
                                        <span>Evaluasi</span>
                                    </Link>
                                    <Link
                                        to={`/instructor/edit-course/${c.course_id || c.id}/`}
                                        state={{ from: "/admin/reports/?tab=course-evaluations", fromLabel: "Evaluasi Kursus" }}
                                        className="btn-action-edit"
                                        title="Moderasi Edit Kursus"
                                    >
                                        <i className="fas fa-edit"></i>
                                        <span>Edit</span>
                                    </Link>
                                    <Link
                                        to={`/admin/review-course/${c.course_id || c.id}/`}
                                        state={{ from: "/admin/reports/?tab=course-evaluations", fromLabel: "Evaluasi Kursus" }}
                                        className="btn-action-review"
                                        title="Reviu Kursus"
                                    >
                                        <i className="fas fa-eye"></i>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default React.memo(CourseEvaluationReportsTab);
