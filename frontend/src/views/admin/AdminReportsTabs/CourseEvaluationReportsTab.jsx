import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";
import { getImageUrl, calculateCourseJP } from "../../../utils/courseUtils";
import logoSetjenDPD from "../../../assets/logo/logo-setjen-dpd.png";
import "./CourseEvaluationReportsTab.css";

const getCourseJP = (c) => {
    if (!c) return 1;
    if (c.total_jp && Number(c.total_jp) > 0) return Number(c.total_jp);
    return calculateCourseJP(c);
};

const getDistributedJP = (c) => {
    if (!c) return 0;
    if (c.distributed_jp !== undefined && c.distributed_jp !== null) return c.distributed_jp;
    return (c.completed_count || 0) * getCourseJP(c);
};

/**
 * Menghitung status kesehatan pembelajaran kursus (Monev Health Indicator)
 * - Dorman: Belum ada pegawai terdaftar
 * - Baru: Partisipasi awal (< 3 peserta)
 * - Kritis: Drop-out tinggi (peserta >= 5 & kelulusan < 35%) atau rating buruk (< 3.0)
 * - Sehat: Kelulusan >= 60% atau kelulusan >= 50% dengan rating >= 4.0
 * - Perlu Pantau: Progres berjalan namun belum optimal (35% s/d 59%)
 */
export const getCourseHealth = (c) => {
    const enrolled = c?.enrolled_count || 0;
    const completionRate = c?.completion_rate || 0;
    const rating = c?.average_rating || 0;

    if (enrolled === 0) {
        return {
            status: "dormant",
            label: "Dorman",
            badgeClass: "badge-health-dormant",
            icon: "fa-moon",
            tooltip: "Belum ada pegawai terdaftar"
        };
    }
    if (enrolled < 3) {
        return {
            status: "new",
            label: "Baru Terbit",
            badgeClass: "badge-health-new",
            icon: "fa-seedling",
            tooltip: "Partisipasi awal (< 3 peserta)"
        };
    }
    if (enrolled >= 5 && (completionRate < 35 || (rating > 0 && rating < 3.0))) {
        return {
            status: "critical",
            label: "Kritis",
            badgeClass: "badge-health-critical",
            icon: "fa-exclamation-circle",
            tooltip: `Kelulusan rendah (${completionRate}%) - Perlu tindak lanjut monev`
        };
    }
    if (completionRate >= 60 || (completionRate >= 50 && rating >= 4.0)) {
        return {
            status: "healthy",
            label: "Sehat",
            badgeClass: "badge-health-healthy",
            icon: "fa-check-circle",
            tooltip: `Pembelajaran efektif (${completionRate}% kelulusan peserta)`
        };
    }
    return {
        status: "warning",
        label: "Perlu Pantau",
        badgeClass: "badge-health-warning",
        icon: "fa-exclamation-triangle",
        tooltip: `Progres kelulusan (${completionRate}%) - Dalam pemantauan`
    };
};

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
        total_distributed_jp: 0,
        overall_completion_rate: 0,
        average_rating: 0,
        total_reviews: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // Filters & View State
    const [searchQuery, setSearchQuery] = useState("");
    const [healthFilter, setHealthFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [sortBy, setSortBy] = useState("rating_desc");
    const [viewMode, setViewMode] = useState("table"); // 'table' | 'grid'

    // Quick Snapshot Modal State
    const [selectedCourseForSnapshot, setSelectedCourseForSnapshot] = useState(null);
    const [snapshotData, setSnapshotData] = useState(null);
    const [snapshotLoading, setSnapshotLoading] = useState(false);
    const [showSnapshotModal, setShowSnapshotModal] = useState(false);
    const [snapshotActiveTab, setSnapshotActiveTab] = useState("overview"); // 'overview' | 'feedback' | 'exams'

    const handleOpenSnapshot = useCallback(async (course) => {
        setSelectedCourseForSnapshot(course);
        setShowSnapshotModal(true);
        setSnapshotLoading(true);
        setSnapshotData(null);
        setSnapshotActiveTab("overview");

        const courseId = course.course_id || course.id;
        try {
            const res = await apiInstance.get(`/admin/course/${courseId}/evaluation/`);
            if (res.data) {
                setSnapshotData(res.data);
            }
        } catch (err) {
            console.error("Error fetching course evaluation snapshot:", err);
        } finally {
            setSnapshotLoading(false);
        }
    }, []);

    const handleCloseSnapshot = useCallback(() => {
        setShowSnapshotModal(false);
        setSelectedCourseForSnapshot(null);
        setSnapshotData(null);
    }, []);

    // Learning Nudge Modal State
    const [selectedCourseForNudge, setSelectedCourseForNudge] = useState(null);
    const [nudgeData, setNudgeData] = useState(null);
    const [nudgeLoading, setNudgeLoading] = useState(false);
    const [nudgeSending, setNudgeSending] = useState(false);
    const [showNudgeModal, setShowNudgeModal] = useState(false);
    const [nudgeTitle, setNudgeTitle] = useState("");
    const [nudgeMessage, setNudgeMessage] = useState("");
    const [selectedLearnerIds, setSelectedLearnerIds] = useState([]);
    const [nudgeLearnerSearch, setNudgeLearnerSearch] = useState("");

    const handleOpenNudge = useCallback(async (course) => {
        setSelectedCourseForNudge(course);
        setShowNudgeModal(true);
        setNudgeLoading(true);
        setNudgeData(null);
        setSelectedLearnerIds([]);
        setNudgeLearnerSearch("");

        const courseId = course.course_id || course.id;
        try {
            const res = await apiInstance.get(`admin/course/${courseId}/nudge-learners/`);
            if (res.data) {
                setNudgeData(res.data);
                setNudgeTitle(res.data.default_title || "");
                setNudgeMessage(res.data.default_message || "");
                // Pre-select all uncompleted learners
                const allIds = (res.data.learners || []).map(l => l.user_id);
                setSelectedLearnerIds(allIds);
            }
        } catch (err) {
            console.error("Error fetching nudge recipients:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat peserta pengingat",
                text: err.response?.data?.error || "Terjadi kesalahan server"
            });
        } finally {
            setNudgeLoading(false);
        }
    }, []);

    const handleCloseNudge = useCallback(() => {
        setShowNudgeModal(false);
        setSelectedCourseForNudge(null);
        setNudgeData(null);
        setNudgeSending(false);
    }, []);

    const handleSendNudge = useCallback(async () => {
        if (!selectedCourseForNudge) return;
        if (selectedLearnerIds.length === 0) {
            Toast().fire({
                icon: "warning",
                title: "Pilih minimal 1 peserta untuk dikirimkan pengingat"
            });
            return;
        }

        const courseId = selectedCourseForNudge.course_id || selectedCourseForNudge.id;
        setNudgeSending(true);
        try {
            const payload = {
                title: nudgeTitle,
                message: nudgeMessage,
                user_ids: selectedLearnerIds
            };
            const res = await apiInstance.post(`admin/course/${courseId}/nudge-learners/`, payload);
            if (res.data?.success) {
                Toast().fire({
                    icon: "success",
                    title: "Pengingat Berhasil Dikirim!",
                    text: res.data.message || `Notifikasi telah dikirim ke ${res.data.sent_count} peserta.`
                });
                handleCloseNudge();
            }
        } catch (err) {
            console.error("Error sending learning nudge:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal mengirim pengingat belajar",
                text: err.response?.data?.error || "Terjadi kesalahan server"
            });
        } finally {
            setNudgeSending(false);
        }
    }, [selectedCourseForNudge, selectedLearnerIds, nudgeTitle, nudgeMessage, handleCloseNudge]);

    const filteredNudgeLearners = useMemo(() => {
        if (!nudgeData?.learners) return [];
        if (!nudgeLearnerSearch.trim()) return nudgeData.learners;
        const q = nudgeLearnerSearch.toLowerCase();
        return nudgeData.learners.filter(l =>
            (l.full_name && l.full_name.toLowerCase().includes(q)) ||
            (l.nip && l.nip.toLowerCase().includes(q)) ||
            (l.unit_kerja && l.unit_kerja.toLowerCase().includes(q)) ||
            (l.email && l.email.toLowerCase().includes(q))
        );
    }, [nudgeData, nudgeLearnerSearch]);

    const handleToggleSelectAllLearners = () => {
        if (!nudgeData?.learners) return;
        if (selectedLearnerIds.length === nudgeData.learners.length) {
            setSelectedLearnerIds([]);
        } else {
            setSelectedLearnerIds(nudgeData.learners.map(l => l.user_id));
        }
    };

    const handleToggleLearner = (userId) => {
        setSelectedLearnerIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

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

    // Live counts for health & quality dropdown filter
    const healthCounts = useMemo(() => {
        const counts = {
            total: courses.length,
            critical: 0,
            warning: 0,
            healthy: 0,
            dormant: 0,
            popular: 0
        };

        courses.forEach(c => {
            const h = getCourseHealth(c);
            if (h.status === "healthy") counts.healthy++;
            else if (h.status === "warning") counts.warning++;
            else if (h.status === "critical") counts.critical++;
            else if (h.status === "dormant" || h.status === "new") counts.dormant++;

            if ((c.enrolled_count || 0) >= 20) counts.popular++;
        });

        return counts;
    }, [courses]);

    // Unique categories from published courses
    const availableCategories = useMemo(() => {
        const catMap = new Map();
        courses.forEach(c => {
            if (c.category?.id && c.category?.title) {
                catMap.set(String(c.category.id), c.category.title);
            }
        });
        return Array.from(catMap.entries()).map(([id, title]) => ({ id, title }));
    }, [courses]);

    // Filtered & sorted courses
    const filteredCourses = useMemo(() => {
        let result = [...courses];

        // Smart Health / Quality filter
        if (healthFilter !== "all") {
            result = result.filter(c => {
                const h = getCourseHealth(c);
                if (healthFilter === "healthy") return h.status === "healthy";
                if (healthFilter === "warning") return h.status === "warning";
                if (healthFilter === "critical") return h.status === "critical";
                if (healthFilter === "dormant") return h.status === "dormant" || h.status === "new";
                if (healthFilter === "popular") return (c.enrolled_count || 0) >= 20;
                return true;
            });
        }

        // Category filter
        if (categoryFilter !== "all") {
            result = result.filter(c => String(c.category?.id) === String(categoryFilter));
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
    }, [courses, healthFilter, categoryFilter, searchQuery, sortBy]);

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
                `admin/course-evaluations-export-excel/?search=${encodeURIComponent(searchQuery)}`,
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

    // Print / PDF Executive Report State & Handlers
    const [showPrintModal, setShowPrintModal] = useState(false);

    const handlePrintReport = () => {
        setShowPrintModal(true);
    };

    const handleExecutePrint = () => {
        window.print();
    };

    const handleClosePrintModal = () => {
        setShowPrintModal(false);
    };

    const currentDateFormatted = useMemo(() => {
        return new Date().toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }, []);

    const printSummary = useMemo(() => {
        const list = filteredCourses || [];
        const totalCourses = list.length;
        const totalEnrolled = list.reduce((acc, c) => acc + (c.enrolled_count || 0), 0);
        const totalCompleted = list.reduce((acc, c) => acc + (c.completed_count || 0), 0);
        const totalJP = list.reduce((acc, c) => acc + getDistributedJP(c), 0);
        const avgCompletion = totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0;
        const avgScore = totalCourses > 0 ? (list.reduce((acc, c) => acc + (c.average_quiz_score || 0), 0) / totalCourses).toFixed(1) : 0;
        const avgRating = totalCourses > 0 ? (list.reduce((acc, c) => acc + (c.average_rating || 0), 0) / totalCourses).toFixed(1) : 0;

        return {
            totalCourses,
            totalEnrolled,
            totalCompleted,
            totalJP,
            avgCompletion,
            avgScore,
            avgRating
        };
    }, [filteredCourses]);

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

    const renderHealthBadge = (c) => {
        const health = getCourseHealth(c);
        return (
            <span
                className={`badge badge-eval-health ${health.badgeClass}`}
                title={health.tooltip}
            >
                <i className={`fas ${health.icon} me-1`}></i>
                <span>{health.label}</span>
            </span>
        );
    };

    return (
        <div className="course-evaluation-tab-container">
            {/* Interactive KPI Metrics Grid */}
            <div className="course-eval-kpi-grid">
                {/* 1. Total Courses Card */}
                <div 
                    className={`kpi-card interactive-kpi ${healthFilter === "all" ? "active" : ""}`}
                    onClick={() => { setHealthFilter("all"); setCategoryFilter("all"); }}
                    title="Total kursus terpublikasi aktif (Klik untuk setel ulang filter ke semua kursus)"
                >
                    <div className="kpi-icon-box bg-teal-subtle text-teal">
                        <i className="fas fa-graduation-cap"></i>
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-value">{stats.total_courses || courses.length}</span>
                        <span className="kpi-label">Kursus Publikasi</span>
                        <span className="kpi-subtext text-teal fw-semibold">
                            {healthCounts.healthy} Sehat &bull; {healthCounts.warning} Pantau &bull; {healthCounts.critical} Kritis
                        </span>
                    </div>
                </div>

                {/* 2. Participation & Completions Card */}
                <div 
                    className="kpi-card"
                    title="Total pegawai terdaftar dan akumulasi JP ASN yang telah disalurkan"
                >
                    <div className="kpi-icon-box bg-blue-subtle text-primary">
                        <i className="fas fa-users"></i>
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-value">{stats.total_students_enrolled}</span>
                        <span className="kpi-label">Partisipan Terdaftar</span>
                        <span className="kpi-subtext text-success fw-semibold">
                            {stats.total_completions} Pegawai Lulus &bull; {stats.total_distributed_jp ?? (stats.total_completions * 1)} JP ASN
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
                {/* Left: Search, Category Filter, Sort Dropdown */}
                <div className="toolbar-left-controls">
                    {/* Live Search */}
                    <div className="search-input-wrapper" style={{ width: "220px" }}>
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

                    {/* Smart Health & Quality Filter Dropdown */}
                    <div className="toolbar-select-group">
                        <i className="fas fa-heartbeat toolbar-select-icon text-teal"></i>
                        <select
                            className="form-select form-select-sm toolbar-select"
                            value={healthFilter}
                            onChange={(e) => setHealthFilter(e.target.value)}
                            title="Filter Berdasarkan Status Kesehatan / Mutu Pembelajaran Kursus"
                        >
                            <option value="all">Semua Mutu ({healthCounts.total})</option>
                            <option value="critical">🔴 Kritis / Butuh Evaluasi ({healthCounts.critical})</option>
                            <option value="warning">🟡 Perlu Pantau ({healthCounts.warning})</option>
                            <option value="healthy">🟢 Sehat / Efektif ({healthCounts.healthy})</option>
                            <option value="dormant">⚪ Dorman / Pasif ({healthCounts.dormant})</option>
                            {healthCounts.popular > 0 && (
                                <option value="popular">🔥 Paling Diminati ({healthCounts.popular})</option>
                            )}
                        </select>
                    </div>

                    {/* Category Dropdown Menu */}
                    {availableCategories.length > 0 && (
                        <div className="toolbar-select-group">
                            <i className="fas fa-layer-group toolbar-select-icon text-teal"></i>
                            <select
                                className="form-select form-select-sm toolbar-select"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                title="Filter Berdasarkan Kategori Kursus"
                            >
                                <option value="all">Semua Kategori ({courses.length})</option>
                                {availableCategories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.title}</option>
                                ))}
                            </select>
                        </div>
                    )}

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
                                    <th style={{ width: "330px" }}>Kursus & Silabus</th>
                                    <th style={{ width: "160px" }}>Instruktur Pengampu</th>
                                    <th style={{ width: "125px" }} className="text-center">Status & Mutu</th>
                                    <th style={{ width: "140px" }} className="text-center">Kelulusan Peserta</th>
                                    <th style={{ width: "115px" }} className="text-center">Kepuasan Peserta</th>
                                    <th style={{ width: "135px" }} className="text-center">Bobot & Akumulasi JP</th>
                                    <th style={{ width: "220px" }} className="text-center">Aksi Administrator</th>
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

                                        {/* Status & Health Indicator */}
                                        <td className="text-center">
                                            <div className="d-flex flex-column align-items-center gap-1">
                                                {getStatusBadge(c.platform_status)}
                                                {renderHealthBadge(c)}
                                            </div>
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

                                        {/* Bobot & Distributed JP */}
                                        <td className="text-center">
                                            <div className="d-flex flex-column align-items-center">
                                                <span className="jp-badge-pill mb-1">
                                                    {getCourseJP(c)} JP
                                                </span>
                                                <div 
                                                    className="distributed-jp-text" 
                                                    title={`Total JP yang tersalurkan kepada ${c.completed_count || 0} pegawai yang lulus`}
                                                >
                                                    <i className="fas fa-award text-teal me-1"></i>
                                                    <span className="fw-bold text-dark">{getDistributedJP(c)}</span> JP ASN
                                                </div>
                                            </div>
                                        </td>

                                        {/* Administrator Actions */}
                                        <td className="text-center">
                                            <div className="eval-action-btn-group justify-content-center">
                                                {/* 1. Quick Snapshot Modal Button */}
                                                <button
                                                    type="button"
                                                    className="btn-action-snapshot"
                                                    onClick={() => handleOpenSnapshot(c)}
                                                    title="Pratinjau Ringkasan Cepat Monev & Ulasan Pegawai"
                                                >
                                                    <i className="fas fa-eye"></i>
                                                    <span>Ringkasan</span>
                                                </button>

                                                {/* 2. Proactive Learning Nudge Button */}
                                                <button
                                                    type="button"
                                                    className="btn-action-nudge"
                                                    onClick={() => handleOpenNudge(c)}
                                                    title="Kirim Pengingat Belajar (Nudge) ke Peserta Belum Lulus"
                                                >
                                                    <i className="fas fa-paper-plane"></i>
                                                    <span>Nudge</span>
                                                </button>

                                                {/* 3. Evaluasi & Audit Ujian Button */}
                                                <Link
                                                    to={`/admin/courses/${c.course_id || c.id}/evaluation/`}
                                                    state={{ from: "/admin/reports/?tab=course-evaluations", fromLabel: "Evaluasi Kursus" }}
                                                    className="btn-action-eval"
                                                    title="Buka Evaluasi & Audit Ujian Lengkap"
                                                >
                                                    <i className="fas fa-poll-h"></i>
                                                    <span>Evaluasi</span>
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
                                            <div className="d-flex align-items-center gap-1">
                                                {getStatusBadge(c.platform_status)}
                                                {renderHealthBadge(c)}
                                            </div>
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
                                        <span className="metric-label">Bobot & Akumulasi JP</span>
                                        <span className="metric-val text-dark">{getCourseJP(c)} JP</span>
                                        <span className="distributed-jp-card-hint" title={`Total JP tersalurkan ke ${c.completed_count || 0} lulusan`}>
                                            <i className="fas fa-award text-teal me-1"></i>
                                            {getDistributedJP(c)} JP ASN
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="course-eval-card-footer">
                                <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                    <i className="fas fa-clock me-1"></i>{c.quizzes_count || 0} Kuis aktif
                                </span>
                                <div className="eval-action-btn-group">
                                    <button
                                        type="button"
                                        className="btn-action-snapshot"
                                        onClick={() => handleOpenSnapshot(c)}
                                        title="Pratinjau Ringkasan Cepat Monev & Ulasan"
                                    >
                                        <i className="fas fa-eye"></i>
                                        <span>Ringkasan</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-action-nudge"
                                        onClick={() => handleOpenNudge(c)}
                                        title="Kirim Pengingat Belajar (Nudge) ke Peserta Belum Lulus"
                                    >
                                        <i className="fas fa-paper-plane"></i>
                                        <span>Nudge</span>
                                    </button>
                                    <Link
                                        to={`/admin/courses/${c.course_id || c.id}/evaluation/`}
                                        state={{ from: "/admin/reports/?tab=course-evaluations", fromLabel: "Evaluasi Kursus" }}
                                        className="btn-action-eval"
                                        title="Buka Evaluasi & Audit Ujian Lengkap"
                                    >
                                        <i className="fas fa-poll-h"></i>
                                        <span>Evaluasi</span>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL QUICK SNAPSHOT MONEV & ULASAN PEGAWAI */}
            {showSnapshotModal && selectedCourseForSnapshot && (
                <div className="snapshot-modal-overlay" onClick={handleCloseSnapshot}>
                    <div className="snapshot-modal-container" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="snapshot-modal-header">
                            <div className="d-flex align-items-center gap-3 min-w-0">
                                <div className="snapshot-header-thumb">
                                    <img
                                        src={getImageUrl(selectedCourseForSnapshot.image)}
                                        alt={selectedCourseForSnapshot.title}
                                        onError={(e) => {
                                            e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                        }}
                                    />
                                </div>
                                <div className="min-w-0">
                                    <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                        <span className="course-meta-pill bg-white text-teal fw-bold">
                                            {selectedCourseForSnapshot.category?.title || "Umum"}
                                        </span>
                                        {getStatusBadge(selectedCourseForSnapshot.platform_status)}
                                        {renderHealthBadge(selectedCourseForSnapshot)}
                                    </div>
                                    <h5 className="snapshot-modal-title text-truncate" title={selectedCourseForSnapshot.title}>
                                        {selectedCourseForSnapshot.title}
                                    </h5>
                                    <div className="snapshot-modal-subtitle">
                                        <i className="fas fa-chalkboard-teacher me-1"></i>
                                        {selectedCourseForSnapshot.teacher?.full_name || "Instruktur Setjen DPD RI"}
                                        <span className="mx-2">&bull;</span>
                                        <i className="fas fa-clock me-1"></i>
                                        Bobot {getCourseJP(selectedCourseForSnapshot)} JP
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="snapshot-modal-close"
                                onClick={handleCloseSnapshot}
                                title="Tutup Modal"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* Sub-Nav Tabs */}
                        <div className="snapshot-nav-tabs">
                            <button
                                type="button"
                                className={`snapshot-tab-btn ${snapshotActiveTab === "overview" ? "active" : ""}`}
                                onClick={() => setSnapshotActiveTab("overview")}
                            >
                                <i className="fas fa-chart-line me-1"></i>
                                <span>Ringkasan Capaian & JP</span>
                            </button>
                            <button
                                type="button"
                                className={`snapshot-tab-btn ${snapshotActiveTab === "feedback" ? "active" : ""}`}
                                onClick={() => setSnapshotActiveTab("feedback")}
                            >
                                <i className="fas fa-star me-1"></i>
                                <span>Ulasan & Masukan Pegawai ({snapshotData?.evaluation?.total_reviews ?? selectedCourseForSnapshot.rating_count ?? 0})</span>
                            </button>
                            <button
                                type="button"
                                className={`snapshot-tab-btn ${snapshotActiveTab === "exams" ? "active" : ""}`}
                                onClick={() => setSnapshotActiveTab("exams")}
                            >
                                <i className="fas fa-poll-h me-1"></i>
                                <span>Instrumen Ujian & Kuis ({snapshotData?.quizzes?.length ?? selectedCourseForSnapshot.quizzes_count ?? 0})</span>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="snapshot-modal-body">
                            {snapshotLoading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-teal mb-3" role="status" style={{ width: "2.5rem", height: "2.5rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <div className="fw-semibold text-dark">Memuat data analitik monev kursus...</div>
                                    <div className="text-muted small">Mengambil rekapitulasi ujian, ulasan pegawai, dan capaian JP</div>
                                </div>
                            ) : (
                                <>
                                    {/* Tab 1: Overview */}
                                    {snapshotActiveTab === "overview" && (
                                        <div className="snapshot-tab-content">
                                            {/* 4 Mini Metrics Cards */}
                                            <div className="snapshot-metrics-grid mb-3">
                                                <div className="snapshot-stat-card">
                                                    <div className="stat-label">Partisipan & Kelulusan</div>
                                                    <div className="stat-value text-teal">
                                                        {snapshotData?.metrics?.completed_count ?? selectedCourseForSnapshot.completed_count} / {snapshotData?.metrics?.total_enrolled ?? selectedCourseForSnapshot.enrolled_count}
                                                        <span className="stat-sub">({snapshotData?.metrics?.completion_rate ?? selectedCourseForSnapshot.completion_rate}%)</span>
                                                    </div>
                                                    <div className="progress-micro mt-2">
                                                        <div
                                                            className="progress-micro-bar bg-teal"
                                                            style={{ width: `${Math.min(100, snapshotData?.metrics?.completion_rate ?? selectedCourseForSnapshot.completion_rate ?? 0)}%`, backgroundColor: "#0d9488" }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                <div className="snapshot-stat-card">
                                                    <div className="stat-label">Akumulasi JP Disalurkan</div>
                                                    <div className="stat-value text-primary">
                                                        {snapshotData?.metrics?.total_jp_issued ?? getDistributedJP(selectedCourseForSnapshot)} <span className="stat-sub">JP ASN</span>
                                                    </div>
                                                    <div className="text-muted mt-1" style={{ fontSize: "0.72rem" }}>
                                                        Bobot {snapshotData?.metrics?.total_jp ?? getCourseJP(selectedCourseForSnapshot)} JP per pegawai lulus
                                                    </div>
                                                </div>

                                                <div className="snapshot-stat-card">
                                                    <div className="stat-label">Kepuasan Peserta</div>
                                                    <div className="stat-value text-warning">
                                                        {(snapshotData?.evaluation?.average_rating || selectedCourseForSnapshot.average_rating || 0)} ★
                                                        <span className="stat-sub">({snapshotData?.evaluation?.satisfaction_rate ?? 0}% Puas)</span>
                                                    </div>
                                                    <div className="text-muted mt-1" style={{ fontSize: "0.72rem" }}>
                                                        Dari {snapshotData?.evaluation?.total_reviews ?? selectedCourseForSnapshot.rating_count ?? 0} ulasan sah
                                                    </div>
                                                </div>

                                                <div className="snapshot-stat-card">
                                                    <div className="stat-label">Rata-rata Skor Ujian</div>
                                                    <div className="stat-value text-dark">
                                                        {snapshotData?.metrics?.avg_post_score ?? 0} <span className="stat-sub">/ 100</span>
                                                    </div>
                                                    <div className="text-muted mt-1" style={{ fontSize: "0.72rem" }}>
                                                        {snapshotData?.metrics?.total_attempts ?? selectedCourseForSnapshot.attempts_count ?? 0} total percobaan ujian
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Health & Diagnostic Alert Box */}
                                            {(() => {
                                                const h = getCourseHealth(selectedCourseForSnapshot);
                                                return (
                                                    <div className={`snapshot-health-alert alert-health-${h.status} mb-3`}>
                                                        <div className="d-flex align-items-center gap-2 mb-1">
                                                            <i className={`fas ${h.icon}`}></i>
                                                            <strong>Status Monev: {h.label}</strong>
                                                        </div>
                                                        <p className="mb-0 small">{h.tooltip}. {h.status === "critical" ? "Disarankan melakukan evaluasi pada butir soal kuis atau memberikan reminder kepada peserta." : h.status === "healthy" ? "Mutu pembelajaran sangat memuaskan dan mencapai standar efektivitas diklat." : "Pantau tingkat penyelesaian modul secara berkala."}</p>
                                                    </div>
                                                );
                                            })()}

                                            {/* Intervensi Proaktif Monev: Learning Nudge */}
                                            <div className="snapshot-nudge-banner mb-3">
                                                <div className="snapshot-nudge-info">
                                                    <i className="fas fa-bullhorn text-warning"></i>
                                                    <div>
                                                        <div className="fw-bold text-dark small">Intervensi Proaktif Monev (Learning Nudge)</div>
                                                        <div className="text-muted" style={{ fontSize: "0.74rem" }}>
                                                            Kirimkan pengingat belajar resmi ke pegawai terdaftar yang belum menuntaskan modul & evaluasi ini.
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn-snapshot-nudge"
                                                    onClick={() => {
                                                        const targetCourse = selectedCourseForSnapshot;
                                                        handleCloseSnapshot();
                                                        handleOpenNudge(targetCourse);
                                                    }}
                                                >
                                                    <i className="fas fa-paper-plane me-1"></i>
                                                    Kirim Pengingat Belajar
                                                </button>
                                            </div>

                                            {/* Unit Kerja Sebaran */}
                                            {snapshotData?.unit_kerja_list?.length > 0 && (
                                                <div className="snapshot-unit-box">
                                                    <h6 className="fw-bold text-dark small mb-2 d-flex align-items-center gap-2">
                                                        <i className="fas fa-building text-teal"></i>
                                                        Unit Kerja / Satuan Kerja Peserta Terdaftar
                                                    </h6>
                                                    <div className="d-flex flex-wrap gap-1">
                                                        {snapshotData.unit_kerja_list.slice(0, 8).map((unit, uIdx) => (
                                                            <span key={uIdx} className="badge bg-light text-dark border" style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}>
                                                                {unit}
                                                            </span>
                                                        ))}
                                                        {snapshotData.unit_kerja_list.length > 8 && (
                                                            <span className="badge bg-teal-subtle text-teal border" style={{ fontSize: "0.72rem" }}>
                                                                +{snapshotData.unit_kerja_list.length - 8} Satker lainnya
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Tab 2: Feedback & Reviews */}
                                    {snapshotActiveTab === "feedback" && (
                                        <div className="snapshot-tab-content">
                                            {/* Rating Scoreboard Banner */}
                                            <div className="snapshot-rating-banner mb-3">
                                                <div className="d-flex align-items-center gap-3">
                                                    <div className="rating-big-number">
                                                        {snapshotData?.evaluation?.average_rating || selectedCourseForSnapshot.average_rating || "0.0"}
                                                    </div>
                                                    <div>
                                                        <div className="text-warning mb-1">
                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                <i
                                                                    key={star}
                                                                    className={`fas fa-star ${star <= Math.round(snapshotData?.evaluation?.average_rating || selectedCourseForSnapshot.average_rating || 0) ? "text-warning" : "text-muted"}`}
                                                                ></i>
                                                            ))}
                                                        </div>
                                                        <div className="text-muted small">
                                                            Tingkat Kepuasan: <strong className="text-dark">{snapshotData?.evaluation?.satisfaction_rate || 0}% Puas</strong> &bull; {snapshotData?.evaluation?.total_reviews || 0} Ulasan
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Reviews List */}
                                            <h6 className="fw-bold text-dark small mb-2 d-flex align-items-center gap-2">
                                                <i className="fas fa-comments text-teal"></i>
                                                Masukan & Evaluasi Kualitatif Peserta
                                            </h6>
                                            {(!snapshotData?.evaluation?.reviews || snapshotData.evaluation.reviews.length === 0) ? (
                                                <div className="text-center py-4 bg-light rounded border">
                                                    <i className="fas fa-comment-slash text-muted mb-2" style={{ fontSize: "1.5rem" }}></i>
                                                    <div className="fw-semibold text-dark small">Belum Ada Ulasan Tertulis</div>
                                                    <p className="text-muted small mb-0">Peserta belum meninggalkan ulasan atau kritik/saran tertulis untuk kursus ini.</p>
                                                </div>
                                            ) : (
                                                <div className="snapshot-reviews-list">
                                                    {snapshotData.evaluation.reviews.slice(0, 5).map((rev) => (
                                                        <div key={rev.id} className="snapshot-review-card">
                                                            <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <div className="review-avatar-circle">
                                                                        {rev.avatar ? (
                                                                            <img src={rev.avatar} alt={rev.full_name} />
                                                                        ) : (
                                                                            <span>{(rev.full_name || "P")[0].toUpperCase()}</span>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <div className="fw-bold text-dark small">{rev.full_name || "Pegawai Setjen DPD RI"}</div>
                                                                        <div className="text-muted" style={{ fontSize: "0.68rem" }}>{rev.date || "-"}</div>
                                                                    </div>
                                                                </div>
                                                                <span className="rating-pill-badge">
                                                                    <i className="fas fa-star"></i>
                                                                    <span>{rev.rating}</span>
                                                                </span>
                                                            </div>
                                                            <p className="snapshot-review-text mb-0">
                                                                "{rev.review || "Tidak ada komentar tertulis."}"
                                                            </p>
                                                            {rev.reply && (
                                                                <div className="snapshot-review-reply mt-2">
                                                                    <div className="reply-label"><i className="fas fa-reply me-1"></i> Tanggapan Instruktur:</div>
                                                                    <div>{rev.reply}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Tab 3: Exams */}
                                    {snapshotActiveTab === "exams" && (
                                        <div className="snapshot-tab-content">
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <h6 className="fw-bold text-dark small mb-0 d-flex align-items-center gap-2">
                                                    <i className="fas fa-list-check text-teal"></i>
                                                    Daftar Instrumen Kuis & Ujian
                                                </h6>
                                                <span className="text-muted small">
                                                    Rata-rata Skor: <strong>{snapshotData?.metrics?.avg_post_score ?? 0} / 100</strong>
                                                </span>
                                            </div>

                                            {(!snapshotData?.quizzes || snapshotData.quizzes.length === 0) ? (
                                                <div className="text-center py-4 bg-light rounded border">
                                                    <i className="fas fa-file-excel text-muted mb-2" style={{ fontSize: "1.5rem" }}></i>
                                                    <div className="fw-semibold text-dark small">Tidak Ada Kuis Aktif</div>
                                                    <p className="text-muted small mb-0">Kursus ini belum memiliki instrumen kuis evaluasi terpasang.</p>
                                                </div>
                                            ) : (
                                                <div className="snapshot-quizzes-table-wrap">
                                                    <table className="table table-sm align-middle mb-0">
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th>Nama Instrumen Ujian</th>
                                                                <th className="text-center">Tipe</th>
                                                                <th className="text-center">Jumlah Soal</th>
                                                                <th className="text-center">Percobaan Selesai</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {snapshotData.quizzes.map((q, qIdx) => {
                                                                const countAttempts = snapshotData?.attempts?.filter(a => a.quiz_id === q.quiz_id)?.length || 0;
                                                                return (
                                                                    <tr key={q.quiz_id || qIdx}>
                                                                        <td className="fw-semibold text-dark small">
                                                                            <i className="fas fa-file-signature text-teal me-2"></i>
                                                                            {q.title}
                                                                        </td>
                                                                        <td className="text-center">
                                                                            <span className="badge bg-light text-dark border text-uppercase" style={{ fontSize: "0.68rem" }}>
                                                                                {q.quiz_type || "Kuis"}
                                                                            </span>
                                                                        </td>
                                                                        <td className="text-center small">
                                                                            {q.total_questions || q.questions?.length || 0} Soal
                                                                        </td>
                                                                        <td className="text-center small">
                                                                            <span className="badge bg-teal-subtle text-teal fw-bold">
                                                                                {countAttempts} Attempt
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="snapshot-modal-footer">
                            <span className="text-muted small d-none d-sm-inline">
                                <i className="fas fa-shield-alt text-teal me-1"></i>
                                Rekapitulasi Sah Monev Pusdiklat / Biro SDM Setjen DPD RI
                            </span>
                            <div className="d-flex align-items-center gap-2 ms-auto">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={handleCloseSnapshot}
                                >
                                    Tutup
                                </button>
                                <Link
                                    to={`/admin/courses/${selectedCourseForSnapshot.course_id || selectedCourseForSnapshot.id}/evaluation/`}
                                    state={{ from: "/admin/reports/?tab=course-evaluations", fromLabel: "Evaluasi Kursus" }}
                                    className="btn btn-sm btn-teal text-white"
                                    style={{ backgroundColor: "#0d9488", borderColor: "#0d9488" }}
                                >
                                    <i className="fas fa-poll-h me-1"></i>
                                    <span>Buka Audit Lengkap</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL KIRIM PENGINGAT BELAJAR (LEARNING NUDGE) */}
            {showNudgeModal && selectedCourseForNudge && (
                <div className="nudge-modal-overlay" onClick={handleCloseNudge}>
                    <div className="nudge-modal-container" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="nudge-modal-header">
                            <div>
                                <h5 className="nudge-modal-title">
                                    <i className="fas fa-paper-plane"></i>
                                    <span>Kirim Pengingat Belajar (Learning Nudge)</span>
                                </h5>
                                <div className="text-white-50 small mt-1">
                                    {selectedCourseForNudge.title} &bull; {selectedCourseForNudge.category?.title || "Umum"}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="nudge-modal-close"
                                onClick={handleCloseNudge}
                                title="Tutup"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="nudge-modal-body">
                            {nudgeLoading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-warning mb-3" role="status" style={{ width: "2.5rem", height: "2.5rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <div className="fw-semibold text-dark">Memuat data target penerima pengingat...</div>
                                    <div className="text-muted small">Menghitung peserta aktif yang belum menuntaskan pelatihan</div>
                                </div>
                            ) : (
                                <>
                                    {/* Stats Strip */}
                                    <div className="nudge-stats-strip">
                                        <div className="nudge-stat-box">
                                            <div className="num text-dark">{nudgeData?.stats?.total_enrolled || 0}</div>
                                            <div className="lbl">Total Terdaftar</div>
                                        </div>
                                        <div className="nudge-stat-box">
                                            <div className="num text-success">{nudgeData?.stats?.completed_count || 0}</div>
                                            <div className="lbl">Sudah Lulus</div>
                                        </div>
                                        <div className="nudge-stat-box" style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
                                            <div className="num text-warning">{nudgeData?.stats?.uncompleted_count || 0}</div>
                                            <div className="lbl fw-bold text-dark">Target Belum Lulus</div>
                                        </div>
                                    </div>

                                    {nudgeData?.stats?.uncompleted_count === 0 ? (
                                        <div className="alert alert-success d-flex align-items-center gap-2 mb-3">
                                            <i className="fas fa-check-circle fa-lg"></i>
                                            <div>
                                                <strong>Luar Biasa! Seluruh Peserta Telah Lulus</strong>
                                                <div className="small">Tidak ada peserta yang berstatus in-progress pada kursus ini. Semua target JP telah terpenuhi.</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Form Editor Pesan */}
                                            <div className="mb-3">
                                                <label className="form-label fw-bold text-dark small mb-1">
                                                    Judul Notifikasi Resmi
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm"
                                                    value={nudgeTitle}
                                                    onChange={(e) => setNudgeTitle(e.target.value)}
                                                    placeholder="Contoh: 💡 Pengingat Monev: Lanjutkan Pelatihan..."
                                                />
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label fw-bold text-dark small mb-1">
                                                    Isi Pesan Notifikasi ASN
                                                </label>
                                                <textarea
                                                    className="form-control form-control-sm"
                                                    rows={3}
                                                    value={nudgeMessage}
                                                    onChange={(e) => setNudgeMessage(e.target.value)}
                                                    placeholder="Tulis pesan pengingat resmi dari Administrator SDM..."
                                                ></textarea>
                                                <div className="d-flex align-items-center justify-content-between mt-1">
                                                    <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                        Gunakan variabel dinamis:
                                                    </span>
                                                    <div className="nudge-pill-chips">
                                                        <code onClick={() => setNudgeMessage(prev => prev + " {nama}")} title="Klik untuk sisipkan nama peserta">{"{nama}"}</code>
                                                        <code onClick={() => setNudgeMessage(prev => prev + " {progress}")} title="Klik untuk sisipkan persentase progres">{"{progress}"}</code>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Target Learners List */}
                                            <div>
                                                <div className="d-flex align-items-center justify-content-between mb-1">
                                                    <label className="form-label fw-bold text-dark small mb-0">
                                                        Pilih Penerima Pengingat ({selectedLearnerIds.length} dari {nudgeData?.learners?.length || 0} dipilih)
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="btn btn-link btn-sm text-decoration-none p-0 text-teal"
                                                        style={{ fontSize: "0.74rem" }}
                                                        onClick={handleToggleSelectAllLearners}
                                                    >
                                                        {selectedLearnerIds.length === (nudgeData?.learners?.length || 0) ? "Batal Pilih Semua" : "Pilih Semua Peserta"}
                                                    </button>
                                                </div>

                                                <div className="nudge-learners-wrapper">
                                                    <div className="nudge-learners-toolbar">
                                                        <div className="input-group input-group-sm" style={{ maxWidth: "260px" }}>
                                                            <span className="input-group-text bg-white border-end-0">
                                                                <i className="fas fa-search text-muted" style={{ fontSize: "0.75rem" }}></i>
                                                            </span>
                                                            <input
                                                                type="text"
                                                                className="form-control border-start-0"
                                                                placeholder="Cari nama, NIP, atau unit kerja..."
                                                                value={nudgeLearnerSearch}
                                                                onChange={(e) => setNudgeLearnerSearch(e.target.value)}
                                                                style={{ fontSize: "0.75rem" }}
                                                            />
                                                        </div>
                                                        <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                            {filteredNudgeLearners.length} peserta ditemukan
                                                        </span>
                                                    </div>

                                                    <div className="nudge-learners-list">
                                                        {filteredNudgeLearners.length === 0 ? (
                                                            <div className="text-center py-4 text-muted small">
                                                                Tidak ada data peserta yang cocok dengan pencarian
                                                            </div>
                                                        ) : (
                                                            filteredNudgeLearners.map((lr) => {
                                                                const isChecked = selectedLearnerIds.includes(lr.user_id);
                                                                return (
                                                                    <div
                                                                        key={lr.user_id}
                                                                        className="nudge-learner-item"
                                                                        onClick={() => handleToggleLearner(lr.user_id)}
                                                                        style={{ cursor: "pointer" }}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            className="form-check-input mt-0"
                                                                            checked={isChecked}
                                                                            onChange={() => {}}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onChangeCapture={() => handleToggleLearner(lr.user_id)}
                                                                        />
                                                                        <div className="flex-grow-1 min-w-0">
                                                                            <div className="d-flex align-items-center justify-content-between">
                                                                                <span className="fw-semibold text-dark text-truncate" style={{ fontSize: "0.78rem" }}>
                                                                                    {lr.full_name}
                                                                                </span>
                                                                                <span className="badge bg-light text-dark border ms-2" style={{ fontSize: "0.7rem" }}>
                                                                                    Progres: {lr.progress_pct}%
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-muted text-truncate" style={{ fontSize: "0.71rem" }}>
                                                                                NIP: {lr.nip || "-"} &bull; {lr.unit_kerja || "-"}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="nudge-modal-footer">
                            <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={handleCloseNudge}
                                disabled={nudgeSending}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                className="btn-send-nudge"
                                onClick={handleSendNudge}
                                disabled={nudgeSending || nudgeLoading || selectedLearnerIds.length === 0}
                            >
                                {nudgeSending ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        <span>Mengirim Pengingat...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-paper-plane"></i>
                                        <span>Kirim ke {selectedLearnerIds.length} Pegawai</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL PRATINJAU DOKUMEN CETAK EKSEKUTIF MONEV */}
            {showPrintModal && (
                <div className="monev-print-modal-overlay" onClick={handleClosePrintModal}>
                    <div className="monev-print-modal-container" onClick={(e) => e.stopPropagation()}>
                        {/* Header Bar */}
                        <div className="monev-print-modal-header no-print">
                            <div>
                                <h5>
                                    <i className="fas fa-print"></i>
                                    <span>Pratinjau Dokumen Cetak Eksekutif — Monev Pelatihan Terbit Setjen DPD RI</span>
                                </h5>
                                <div className="text-white-50 small mt-1">
                                    Format resmi kedinasan siap cetak / simpan sebagai berkas PDF (A4 Landscape)
                                </div>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light text-dark fw-semibold"
                                    onClick={handleExecutePrint}
                                >
                                    <i className="fas fa-print me-1 text-teal"></i>
                                    <span>Cetak Sekarang (PDF)</span>
                                </button>
                                <button
                                    type="button"
                                    className="nudge-modal-close"
                                    onClick={handleClosePrintModal}
                                    title="Tutup"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        </div>

                        {/* Modal Body / Printable Document Container */}
                        <div className="monev-print-modal-body">
                            <div id="printable-monev-document" className="printable-monev-sheet">
                                {/* Kop Surat Resmi Setjen DPD RI */}
                                <div className="kop-surat-wrapper">
                                    <img
                                        src={logoSetjenDPD}
                                        alt="Logo Setjen DPD RI"
                                        className="kop-logo"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    <div className="kop-text-block">
                                        <div className="kop-title-main">SEKRETARIAT JENDERAL DEWAN PERWAKILAN DAERAH REPUBLIK INDONESIA</div>
                                        <div className="kop-title-dept">BIRO ORGANISASI, KEANGGOTAAN, DAN KEPEGAWAIAN</div>
                                        <div className="kop-title-sub">BAGIAN PENGEMBANGAN KAPASITAS SUMBER DAYA MANUSIA</div>
                                        <div className="kop-address">
                                            Kompleks Parlemen, Jalan Jenderal Gatot Subroto No. 6, Senayan, Jakarta Pusat 10270<br />
                                            Laman: https://lms.dpd.go.id &bull; Pos-el: pusdiklat.sdm@dpd.go.id &bull; Telepon: (021) 57897475
                                        </div>
                                    </div>
                                </div>

                                {/* Judul Dokumen & Nomor */}
                                <div className="doc-heading-wrapper">
                                    <div className="doc-report-title">
                                        LAPORAN MONITORING DAN EVALUASI PELATIHAN TERBIT
                                    </div>
                                    <div className="doc-report-sub">
                                        SERTA AKUMULASI CAPAIAN JAM PELAJARAN (JP) PENGEMBANGAN KOMPETENSI PEGAWAI SETJEN DPD RI
                                    </div>
                                    <div className="doc-report-number">
                                        Nomor: LAP-MONEV/{new Date().getFullYear()}/BPSDM-SDM/{String(new Date().getMonth() + 1).padStart(2, '0')} &bull; Tanggal Cetak: {currentDateFormatted} WIB
                                    </div>
                                </div>

                                {/* Kotak Ringkasan Eksekutif */}
                                <div className="print-executive-summary-grid">
                                    <div className="print-exec-stat-box">
                                        <div className="lbl">Total Kursus Terbit</div>
                                        <div className="val text-teal">{printSummary.totalCourses} <span className="unit">Pelatihan</span></div>
                                        <div className="sub">100% Terpublikasi Aktif</div>
                                    </div>
                                    <div className="print-exec-stat-box">
                                        <div className="lbl">Partisipasi ASN Terdaftar</div>
                                        <div className="val text-primary">{printSummary.totalEnrolled} <span className="unit">Pegawai</span></div>
                                        <div className="sub">Lintas Unit Kerja & Kantor Daerah</div>
                                    </div>
                                    <div className="print-exec-stat-box">
                                        <div className="lbl">Tingkat Kelulusan ASN</div>
                                        <div className="val text-success">{printSummary.totalCompleted} <span className="unit">Lulus ({printSummary.avgCompletion}%)</span></div>
                                        <div className="sub">Telah Meraih Sertifikat Kelulusan</div>
                                    </div>
                                    <div className="print-exec-stat-box">
                                        <div className="lbl">Total Akumulasi JP Tersalurkan</div>
                                        <div className="val text-dark">{printSummary.totalJP} <span className="unit">JP ASN</span></div>
                                        <div className="sub">Kredit Pengembangan Kompetensi</div>
                                    </div>
                                </div>

                                {/* Peta Sebaran Mutu Pelatihan */}
                                <div className="print-health-strip">
                                    <span className="fw-bold me-1">Sebaran Mutu Pelatihan:</span>
                                    <span className="badge-print-health">🟢 Sehat: {healthCounts.healthy}</span>
                                    <span className="badge-print-health">🟡 Perlu Pantau: {healthCounts.warning}</span>
                                    <span className="badge-print-health">🔴 Kritis: {healthCounts.critical}</span>
                                    <span className="badge-print-health">⚪ Dorman: {healthCounts.dormant}</span>
                                    <span className="badge-print-health">🔵 Baru: {healthCounts.popular}</span>
                                </div>

                                {/* Tabel Rekapitulasi Rinci Kursus */}
                                <table className="print-doc-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: "26px" }} className="text-center">No</th>
                                            <th>Judul Pelatihan & Kurikulum</th>
                                            <th style={{ width: "95px" }}>Kategori</th>
                                            <th style={{ width: "125px" }}>Instruktur Pengampu</th>
                                            <th style={{ width: "50px" }} className="text-center">Peserta</th>
                                            <th style={{ width: "48px" }} className="text-center">Lulus</th>
                                            <th style={{ width: "50px" }} className="text-center">% Lulus</th>
                                            <th style={{ width: "52px" }} className="text-center">Bobot JP</th>
                                            <th style={{ width: "68px" }} className="text-center">Total JP</th>
                                            <th style={{ width: "48px" }} className="text-center">Skor</th>
                                            <th style={{ width: "48px" }} className="text-center">Rating</th>
                                            <th style={{ width: "75px" }} className="text-center">Status Mutu</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCourses.map((c, idx) => {
                                            const h = getCourseHealth(c);
                                            const distJP = getDistributedJP(c);
                                            return (
                                                <tr key={c.course_id || c.id || idx}>
                                                    <td className="text-center">{idx + 1}</td>
                                                    <td className="fw-semibold">{c.title}</td>
                                                    <td>{c.category?.title || "Umum"}</td>
                                                    <td>{c.teacher?.full_name || "Instruktur Internal"}</td>
                                                    <td className="text-center">{c.enrolled_count || 0}</td>
                                                    <td className="text-center">{c.completed_count || 0}</td>
                                                    <td className="text-center fw-bold">{c.completion_rate || 0}%</td>
                                                    <td className="text-center">{getCourseJP(c)} JP</td>
                                                    <td className="text-center fw-bold text-teal">{distJP} JP</td>
                                                    <td className="text-center">{c.average_quiz_score || "-"}</td>
                                                    <td className="text-center">{(c.average_rating || 0).toFixed(1)} ★</td>
                                                    <td className="text-center">
                                                        <span className={`print-health-tag tag-${h.status}`}>
                                                            {h.label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="print-table-summary-row">
                                            <td colSpan="4" className="text-center fw-bold">
                                                TOTAL KESELURUHAN / RATA-RATA EVALUASI ({printSummary.totalCourses} PELATIHAN)
                                            </td>
                                            <td className="text-center fw-bold">{printSummary.totalEnrolled}</td>
                                            <td className="text-center fw-bold">{printSummary.totalCompleted}</td>
                                            <td className="text-center fw-bold">{printSummary.avgCompletion}%</td>
                                            <td className="text-center fw-bold">-</td>
                                            <td className="text-center fw-bold text-teal">{printSummary.totalJP} JP</td>
                                            <td className="text-center fw-bold">{printSummary.avgScore}</td>
                                            <td className="text-center fw-bold">{printSummary.avgRating} ★</td>
                                            <td className="text-center fw-bold text-success">Sah</td>
                                        </tr>
                                    </tfoot>
                                </table>

                                {/* Lembar Pengesahan Formal */}
                                <div className="doc-signature-row">
                                    <div className="doc-signature-col">
                                        <div>Disusun & Dilaporkan Oleh:</div>
                                        <div style={{ fontWeight: 700 }}>Administrator Pengelola Sistem LMS</div>
                                        <div className="doc-signature-space"></div>
                                        <div className="doc-signature-name">
                                            Administrator SDM Setjen DPD RI
                                        </div>
                                        <div className="doc-signature-role">
                                            Biro Organisasi, Keanggotaan, dan Kepegawaian
                                        </div>
                                    </div>

                                    <div className="doc-signature-col">
                                        <div>Jakarta, {currentDateFormatted}</div>
                                        <div>Mengetahui,</div>
                                        <div style={{ fontWeight: 700 }}>Kepala Bagian Pengembangan Kapasitas SDM</div>
                                        <div className="doc-signature-space"></div>
                                        <div className="doc-signature-name">
                                            Kepala Bagian Pengembangan Kapasitas SDM
                                        </div>
                                        <div className="doc-signature-role">
                                            Sekretariat Jenderal DPD RI
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default React.memo(CourseEvaluationReportsTab);
