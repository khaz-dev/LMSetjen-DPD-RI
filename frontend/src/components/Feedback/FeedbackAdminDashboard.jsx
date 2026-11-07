import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./FeedbackAdminDashboard.css";
import useAxios from "../../utils/useAxios";
import Toast from "../../views/plugin/Toast";

/**
 * ✨ PHASE 11.2: Admin Feedback Dashboard (Redesigned & Compact)
 * High-density layout, zero blank space, live real-time metrics & filters.
 */
function FeedbackAdminDashboard({ refreshTrigger = 0, onMutationSuccess }) {
    const [feedbacks, setFeedbacks] = useState([]);
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFeedback, setSelectedFeedback] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [viewMode, setViewMode] = useState("table"); // 'table' | 'grid'

    // Filters
    const [filters, setFilters] = useState({
        status: "",
        type: "",
        priority: "",
        search: ""
    });

    const [adminNotes, setAdminNotes] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("");
    const [selectedPriority, setSelectedPriority] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Quick note templates for fast admin response
    const quickResponseTemplates = [
        "Sedang diinvestigasi oleh tim pengembang.",
        "Telah berhasil diperbaiki pada pembaruan sistem terkini.",
        "Masukan telah dicatat dan dijadwalkan pada roadmap rilis berikutnya.",
        "Kendala tidak dapat direproduksi. Mohon kirimkan detail langkah pengetesan."
    ];

    // Fetch feedbacks & stats
    const fetchFeedbacks = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });

            const response = await useAxios.get(`/feedback/list/?${params.toString()}`);
            setFeedbacks(response.data.results || response.data || []);
        } catch (error) {
            console.error("Error fetching feedbacks:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal Memuat",
                text: "Gagal mengambil data masukan pengguna."
            });
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    const fetchStats = useCallback(async () => {
        try {
            const response = await useAxios.get("/feedback/stats/");
            setStats(response.data);
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    }, []);

    useEffect(() => {
        fetchFeedbacks();
        fetchStats();
    }, [fetchFeedbacks, fetchStats, refreshTrigger]);

    // Handle filter inputs
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleQuickStatus = (statusValue) => {
        setFilters(prev => ({ ...prev, status: statusValue }));
    };

    const handleSearchChange = (e) => {
        const { value } = e.target;
        setFilters(prev => ({ ...prev, search: value }));
    };

    const clearSearch = () => {
        setFilters(prev => ({ ...prev, search: "" }));
    };

    // Open detail modal with full data
    const openFeedbackDetail = async (feedback) => {
        try {
            setIsLoading(true);
            const response = await useAxios.get(`/feedback/detail/${feedback.id}/`);
            const data = response.data || feedback;
            setSelectedFeedback(data);
            setAdminNotes(data.admin_notes || "");
            setSelectedStatus(data.status);
            setSelectedPriority(data.priority);
        } catch (error) {
            console.error("Error loading feedback detail:", error);
            setSelectedFeedback(feedback);
            setAdminNotes(feedback.admin_notes || "");
            setSelectedStatus(feedback.status);
            setSelectedPriority(feedback.priority);
        } finally {
            setIsLoading(false);
            setShowModal(true);
        }
    };

    const closeFeedbackModal = () => {
        setShowModal(false);
        setSelectedFeedback(null);
    };

    // Save status, priority, and notes
    const saveFeedbackUpdate = async () => {
        if (!selectedFeedback) return;

        setIsSaving(true);
        try {
            const updateData = {
                status: selectedStatus,
                priority: selectedPriority,
                admin_notes: adminNotes
            };

            const response = await useAxios.put(
                `/feedback/detail/${selectedFeedback.id}/`,
                updateData
            );

            Toast().fire({
                icon: "success",
                title: "Berhasil Diperbarui",
                text: "Status & catatan masukan berhasil disimpan."
            });

            setSelectedFeedback(response.data);
            fetchFeedbacks();
            fetchStats();
            if (onMutationSuccess) onMutationSuccess();
            setTimeout(() => closeFeedbackModal(), 400);
        } catch (error) {
            console.error("Error updating feedback:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal Menyimpan",
                text: "Terjadi kesalahan saat memperbarui masukan."
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Mark as resolved shortcut
    const markAsResolved = async () => {
        if (!selectedFeedback) return;

        setIsSaving(true);
        try {
            const response = await useAxios.post(
                `/feedback/mark-resolved/${selectedFeedback.id}/`,
                { resolution_notes: adminNotes || "Masukan telah diselesaikan oleh admin sistem." }
            );

            Toast().fire({
                icon: "success",
                title: "Masukan Diselesaikan",
                text: "Status masukan berhasil diubah menjadi Diselesaikan."
            });

            setSelectedFeedback(response.data.feedback || response.data);
            fetchFeedbacks();
            fetchStats();
            if (onMutationSuccess) onMutationSuccess();
            setTimeout(() => closeFeedbackModal(), 400);
        } catch (error) {
            console.error("Error marking as resolved:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal",
                text: "Gagal menandai masukan sebagai diselesaikan."
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Helpers
    const getStatusBadge = (status) => {
        const config = {
            open: { label: "Terbuka", class: "fdb-status-open", icon: "fas fa-clock" },
            under_review: { label: "Ditinjau", class: "fdb-status-review", icon: "fas fa-search" },
            in_progress: { label: "Diproses", class: "fdb-status-progress", icon: "fas fa-spinner fa-spin" },
            resolved: { label: "Selesai", class: "fdb-status-resolved", icon: "fas fa-check-circle" },
            wont_fix: { label: "Tidak Diperbaiki", class: "fdb-status-wontfix", icon: "fas fa-times-circle" },
            closed: { label: "Ditutup", class: "fdb-status-closed", icon: "fas fa-archive" }
        };
        const item = config[status] || { label: status, class: "fdb-status-neutral", icon: "fas fa-info-circle" };
        return (
            <span className={`fdb-badge ${item.class}`}>
                <i className={`${item.icon} me-1`}></i>
                {item.label}
            </span>
        );
    };

    const getPriorityBadge = (priority) => {
        const config = {
            critical: { label: "Kritis", class: "fdb-prio-critical" },
            high: { label: "Tinggi", class: "fdb-prio-high" },
            medium: { label: "Sedang", class: "fdb-prio-medium" },
            low: { label: "Rendah", class: "fdb-prio-low" }
        };
        const item = config[priority] || { label: priority, class: "fdb-prio-neutral" };
        return <span className={`fdb-prio-badge ${item.class}`}>{item.label}</span>;
    };

    const getUserRoleBadge = (role) => {
        const map = {
            student: "Peserta",
            teacher: "Pengajar",
            instructor: "Instruktur",
            admin: "Admin",
            super_admin: "Super Admin",
            user: "Pengguna"
        };
        return <span className="fdb-user-role">{map[role] || role || "User"}</span>;
    };

    // Computed Resolution Rate
    const resolutionRate = useMemo(() => {
        if (!stats || !stats.total_feedback) return 0;
        return Math.round((stats.resolved_count / stats.total_feedback) * 100);
    }, [stats]);

    return (
        <div className="feedback-admin-dashboard">
            {/* Live KPI Metric Cards Strip */}
            {stats && (
                <div className="fdb-kpi-grid">
                    <div className="fdb-kpi-card card-total">
                        <div className="kpi-icon-wrap bg-teal-subtle text-teal">
                            <i className="fas fa-inbox"></i>
                        </div>
                        <div className="kpi-body">
                            <div className="kpi-value">{stats.total_feedback}</div>
                            <div className="kpi-label">Total Masukan</div>
                            <span className="kpi-subtext">Semua tiket tercatat</span>
                        </div>
                    </div>

                    <div className="fdb-kpi-card card-open">
                        <div className="kpi-icon-wrap bg-amber-subtle text-amber">
                            <i className="fas fa-clock"></i>
                        </div>
                        <div className="kpi-body">
                            <div className="kpi-value">{stats.open_count}</div>
                            <div className="kpi-label">Menunggu Respon</div>
                            <span className="kpi-subtext">Status terbuka</span>
                        </div>
                    </div>

                    <div className="fdb-kpi-card card-progress">
                        <div className="kpi-icon-wrap bg-blue-subtle text-blue">
                            <i className="fas fa-tools"></i>
                        </div>
                        <div className="kpi-body">
                            <div className="kpi-value">{stats.in_progress_count}</div>
                            <div className="kpi-label">Sedang Diproses</div>
                            <span className="kpi-subtext">Dalam penanganan tim</span>
                        </div>
                    </div>

                    <div className="fdb-kpi-card card-resolved">
                        <div className="kpi-icon-wrap bg-emerald-subtle text-emerald">
                            <i className="fas fa-check-double"></i>
                        </div>
                        <div className="kpi-body">
                            <div className="kpi-value">{stats.resolved_count}</div>
                            <div className="kpi-label">Terselesaikan</div>
                            <span className="kpi-subtext">{resolutionRate}% resolusi sukses</span>
                        </div>
                    </div>

                    <div className="fdb-kpi-card card-bug">
                        <div className="kpi-icon-wrap bg-rose-subtle text-rose">
                            <i className="fas fa-bug"></i>
                        </div>
                        <div className="kpi-body">
                            <div className="kpi-value">{stats.bug_reports}</div>
                            <div className="kpi-label">Laporan Bug</div>
                            <span className="kpi-subtext">Masalah teknis / error</span>
                        </div>
                    </div>

                    <div className="fdb-kpi-card card-feature">
                        <div className="kpi-icon-wrap bg-purple-subtle text-purple">
                            <i className="fas fa-lightbulb"></i>
                        </div>
                        <div className="kpi-body">
                            <div className="kpi-value">{stats.feature_requests}</div>
                            <div className="kpi-label">Usulan Fitur</div>
                            <span className="kpi-subtext">Permintaan pengguna</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Toolbar & Quick Status Chips */}
            <div className="fdb-control-panel">
                <div className="fdb-chips-row">
                    <button
                        type="button"
                        className={`fdb-chip ${filters.status === "" ? "active" : ""}`}
                        onClick={() => handleQuickStatus("")}
                    >
                        <span>Semua</span>
                        <span className="chip-count">{stats ? stats.total_feedback : feedbacks.length}</span>
                    </button>
                    <button
                        type="button"
                        className={`fdb-chip ${filters.status === "open" ? "active" : ""}`}
                        onClick={() => handleQuickStatus("open")}
                    >
                        <i className="fas fa-clock text-amber me-1"></i>
                        <span>Terbuka</span>
                        {stats && <span className="chip-count">{stats.open_count}</span>}
                    </button>
                    <button
                        type="button"
                        className={`fdb-chip ${filters.status === "in_progress" ? "active" : ""}`}
                        onClick={() => handleQuickStatus("in_progress")}
                    >
                        <i className="fas fa-tools text-blue me-1"></i>
                        <span>Diproses</span>
                        {stats && <span className="chip-count">{stats.in_progress_count}</span>}
                    </button>
                    <button
                        type="button"
                        className={`fdb-chip ${filters.status === "under_review" ? "active" : ""}`}
                        onClick={() => handleQuickStatus("under_review")}
                    >
                        <i className="fas fa-search text-info me-1"></i>
                        <span>Ditinjau</span>
                    </button>
                    <button
                        type="button"
                        className={`fdb-chip ${filters.status === "resolved" ? "active" : ""}`}
                        onClick={() => handleQuickStatus("resolved")}
                    >
                        <i className="fas fa-check-circle text-emerald me-1"></i>
                        <span>Diselesaikan</span>
                        {stats && <span className="chip-count">{stats.resolved_count}</span>}
                    </button>
                    <button
                        type="button"
                        className={`fdb-chip ${filters.status === "closed" ? "active" : ""}`}
                        onClick={() => handleQuickStatus("closed")}
                    >
                        <i className="fas fa-archive me-1"></i>
                        <span>Ditutup</span>
                    </button>
                </div>

                <div className="fdb-filters-toolbar">
                    <div className="fdb-search-box search-input-wrapper">
                        <i className="fas fa-search search-icon"></i>
                        <input
                            type="text"
                            placeholder="Cari judul, nama pengguna, atau kata kunci..."
                            value={filters.search}
                            onChange={handleSearchChange}
                            className="form-control form-control-sm search-input fdb-search-input"
                        />
                        {filters.search && (
                            <button type="button" className="clear-search-btn btn-clear-search" onClick={clearSearch}>
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>

                    <div className="fdb-selects-group">
                        <select
                            name="type"
                            value={filters.type}
                            onChange={handleFilterChange}
                            className="fdb-select"
                        >
                            <option value="">Semua Jenis</option>
                            <option value="bug">🐛 Laporan Bug</option>
                            <option value="feature">💡 Usulan Fitur</option>
                        </select>

                        <select
                            name="priority"
                            value={filters.priority}
                            onChange={handleFilterChange}
                            className="fdb-select"
                        >
                            <option value="">Semua Prioritas</option>
                            <option value="critical">🔴 Kritis</option>
                            <option value="high">🟠 Tinggi</option>
                            <option value="medium">🟡 Sedang</option>
                            <option value="low">⚪ Rendah</option>
                        </select>

                        <div className="fdb-view-switch">
                            <button
                                type="button"
                                className={`view-btn ${viewMode === "table" ? "active" : ""}`}
                                onClick={() => setViewMode("table")}
                                title="Tampilan Tabel Kompak"
                            >
                                <i className="fas fa-list"></i>
                            </button>
                            <button
                                type="button"
                                className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
                                onClick={() => setViewMode("grid")}
                                title="Tampilan Grid Kartu"
                            >
                                <i className="fas fa-th-large"></i>
                            </button>
                        </div>

                        <button
                            type="button"
                            className="fdb-refresh-btn"
                            onClick={() => { fetchFeedbacks(); fetchStats(); }}
                            title="Segarkan Masukan"
                        >
                            <i className={`fas fa-sync-alt ${isLoading ? "fa-spin" : ""}`}></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* Feedback Content Section */}
            <div className="fdb-content-card">
                <div className="fdb-card-header">
                    <div className="d-flex align-items-center gap-2">
                        <span className="fdb-count-badge">{feedbacks.length} Tiket</span>
                        <span className="text-muted small">
                            {filters.status ? `Filter: ${filters.status.replace("_", " ")}` : "Semua Masukan Pengguna"}
                        </span>
                    </div>
                    {isLoading && <span className="fdb-loading-indicator"><i className="fas fa-spinner fa-spin me-1"></i> Memuat data...</span>}
                </div>

                {isLoading && feedbacks.length === 0 ? (
                    <div className="fdb-empty-state">
                        <i className="fas fa-spinner fa-spin fdb-empty-icon text-teal"></i>
                        <p className="mt-2 text-muted">Memuat daftar masukan sistem...</p>
                    </div>
                ) : feedbacks.length === 0 ? (
                    <div className="fdb-empty-state">
                        <i className="fas fa-inbox fdb-empty-icon text-muted"></i>
                        <h5 className="mt-2 mb-1">Tidak ada masukan yang sesuai</h5>
                        <p className="text-muted small">Tidak ditemukan tiket masukan dengan kriteria filter saat ini.</p>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-teal mt-2"
                            onClick={() => setFilters({ status: "", type: "", priority: "", search: "" })}
                        >
                            Reset Semua Filter
                        </button>
                    </div>
                ) : viewMode === "table" ? (
                    /* Table View */
                    <div className="fdb-table-responsive">
                        <table className="fdb-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "90px" }}>Jenis</th>
                                    <th>Judul & Ringkasan</th>
                                    <th style={{ width: "180px" }}>Pengguna</th>
                                    <th style={{ width: "120px" }}>Prioritas</th>
                                    <th style={{ width: "140px" }}>Status</th>
                                    <th style={{ width: "130px" }}>Tanggal</th>
                                    <th style={{ width: "100px", textAlign: "right" }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feedbacks.map((item) => (
                                    <tr key={item.id} className="fdb-row">
                                        <td>
                                            <span className={`fdb-type-pill ${item.feedback_type === "bug" ? "type-bug" : "type-feature"}`}>
                                                {item.feedback_type === "bug" ? "🐛 Bug" : "💡 Fitur"}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="fdb-title-wrap">
                                                <div className="fdb-row-title" onClick={() => openFeedbackDetail(item)}>
                                                    {item.title}
                                                </div>
                                                {item.course_title && (
                                                    <span className="fdb-course-tag">
                                                        <i className="fas fa-book-open me-1"></i>
                                                        {item.course_title}
                                                    </span>
                                                )}
                                                {item.affected_area && (
                                                    <span className="fdb-area-tag">
                                                        <i className="fas fa-compass me-1"></i>
                                                        {item.affected_area}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="fdb-user-cell">
                                                <span className="fdb-user-name">{item.user_name || "Anonim"}</span>
                                                {getUserRoleBadge(item.user_role)}
                                            </div>
                                        </td>
                                        <td>{getPriorityBadge(item.priority)}</td>
                                        <td>{getStatusBadge(item.status)}</td>
                                        <td>
                                            <span className="fdb-date-text">
                                                {new Date(item.created_at).toLocaleDateString("id-ID", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric"
                                                })}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: "right" }}>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-teal fdb-btn-action"
                                                onClick={() => openFeedbackDetail(item)}
                                            >
                                                <i className="fas fa-eye me-1"></i> Tinjau
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* Grid Cards View */
                    <div className="fdb-cards-grid">
                        {feedbacks.map((item) => (
                            <div
                                key={item.id}
                                className={`fdb-grid-card prio-border-${item.priority || "medium"}`}
                                onClick={() => openFeedbackDetail(item)}
                            >
                                <div className="fdb-card-top">
                                    <span className={`fdb-type-pill ${item.feedback_type === "bug" ? "type-bug" : "type-feature"}`}>
                                        {item.feedback_type === "bug" ? "🐛 Bug" : "💡 Fitur"}
                                    </span>
                                    {getPriorityBadge(item.priority)}
                                </div>
                                <h4 className="fdb-card-title">{item.title}</h4>
                                <p className="fdb-card-desc">
                                    {item.description ? (
                                        item.description.length > 120 ? `${item.description.substring(0, 120)}...` : item.description
                                    ) : "Tidak ada deskripsi rinci."}
                                </p>
                                <div className="fdb-card-meta">
                                    <div className="fdb-user-cell">
                                        <span className="fdb-user-name">{item.user_name || "Anonim"}</span>
                                        {getUserRoleBadge(item.user_role)}
                                    </div>
                                    <span className="fdb-date-text">
                                        {new Date(item.created_at).toLocaleDateString("id-ID", {
                                            day: "numeric",
                                            month: "short"
                                        })}
                                    </span>
                                </div>
                                <div className="fdb-card-footer">
                                    {getStatusBadge(item.status)}
                                    <button
                                        type="button"
                                        className="btn btn-xs btn-outline-teal"
                                        onClick={(e) => { e.stopPropagation(); openFeedbackDetail(item); }}
                                    >
                                        Detail
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Compact Feedback Detail & Moderation Modal */}
            {showModal && selectedFeedback && (
                <div className="fdb-modal-overlay" onClick={closeFeedbackModal}>
                    <div className="fdb-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="fdb-modal-header">
                            <div className="modal-title-wrap">
                                <span className={`fdb-type-pill ${selectedFeedback.feedback_type === "bug" ? "type-bug" : "type-feature"}`}>
                                    {selectedFeedback.feedback_type === "bug" ? "🐛 Laporan Bug" : "💡 Permintaan Fitur"}
                                </span>
                                <h3 className="fdb-modal-title">{selectedFeedback.title}</h3>
                            </div>
                            <button type="button" className="fdb-modal-close" onClick={closeFeedbackModal}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="fdb-modal-body">
                            {/* User & Submission Strip */}
                            <div className="fdb-modal-user-strip">
                                <div className="strip-item">
                                    <i className="fas fa-user-circle text-teal me-2"></i>
                                    <div>
                                        <strong>{selectedFeedback.user_name || "Anonim"}</strong>
                                        <span className="ms-2">{getUserRoleBadge(selectedFeedback.user_role)}</span>
                                        <div className="text-muted small">{selectedFeedback.user_email || "Tidak ada email"}</div>
                                    </div>
                                </div>
                                <div className="strip-item text-md-end">
                                    <div className="text-muted small">Waktu Pengajuan:</div>
                                    <strong>
                                        {new Date(selectedFeedback.created_at).toLocaleString("id-ID", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit"
                                        })} WIB
                                    </strong>
                                </div>
                            </div>

                            {/* Additional Metadata Tags */}
                            <div className="fdb-modal-tags-row">
                                {selectedFeedback.course_title && (
                                    <div className="modal-meta-pill">
                                        <i className="fas fa-graduation-cap text-teal me-1.5"></i>
                                        <span>Kursus: <strong>{selectedFeedback.course_title}</strong></span>
                                    </div>
                                )}
                                {selectedFeedback.affected_area && (
                                    <div className="modal-meta-pill">
                                        <i className="fas fa-map-marker-alt text-amber me-1.5"></i>
                                        <span>Area: <strong>{selectedFeedback.affected_area}</strong></span>
                                    </div>
                                )}
                                {selectedFeedback.related_url && (
                                    <a
                                        href={selectedFeedback.related_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="modal-meta-pill text-decoration-none"
                                    >
                                        <i className="fas fa-external-link-alt text-blue me-1.5"></i>
                                        <span>Buka URL Terkait</span>
                                    </a>
                                )}
                                {selectedFeedback.attachments && (
                                    <a
                                        href={selectedFeedback.attachments}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="modal-meta-pill text-decoration-none text-teal"
                                    >
                                        <i className="fas fa-paperclip text-teal me-1.5"></i>
                                        <span>Lihat Tangkapan Layar (Lampiran)</span>
                                    </a>
                                )}
                            </div>

                            {/* Description Box */}
                            <div className="fdb-section-block">
                                <label className="fdb-block-label">
                                    <i className="fas fa-align-left text-muted me-1.5"></i>
                                    Deskripsi Masukan / Permintaan
                                </label>
                                <div className="fdb-description-box">
                                    {selectedFeedback.description || "Tidak ada rincian deskripsi yang dilampirkan."}
                                </div>
                            </div>

                            {/* Resolution History if resolved */}
                            {selectedFeedback.resolved_at && (
                                <div className="fdb-resolved-banner">
                                    <i className="fas fa-check-circle text-emerald me-2"></i>
                                    <div>
                                        <strong>Telah Diselesaikan</strong> pada{" "}
                                        {new Date(selectedFeedback.resolved_at).toLocaleString("id-ID")} WIB
                                    </div>
                                </div>
                            )}

                            {/* Action Form: Status, Priority, Quick Templates & Notes */}
                            <div className="fdb-form-row">
                                <div className="form-group flex-1">
                                    <label className="fdb-field-label">Status Tindak Lanjut</label>
                                    <select
                                        value={selectedStatus}
                                        onChange={(e) => setSelectedStatus(e.target.value)}
                                        className="fdb-input-select"
                                    >
                                        <option value="open">Terbuka (Open)</option>
                                        <option value="under_review">Dalam Peninjauan (Under Review)</option>
                                        <option value="in_progress">Sedang Diproses (In Progress)</option>
                                        <option value="resolved">Diselesaikan (Resolved)</option>
                                        <option value="wont_fix">Tidak Akan Diperbaiki (Won't Fix)</option>
                                        <option value="closed">Ditutup (Closed)</option>
                                    </select>
                                </div>

                                <div className="form-group flex-1">
                                    <label className="fdb-field-label">Tingkat Prioritas</label>
                                    <select
                                        value={selectedPriority}
                                        onChange={(e) => setSelectedPriority(e.target.value)}
                                        className="fdb-input-select"
                                    >
                                        <option value="critical">🔴 Kritis (Critical)</option>
                                        <option value="high">🟠 Tinggi (High)</option>
                                        <option value="medium">🟡 Sedang (Medium)</option>
                                        <option value="low">⚪ Rendah (Low)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Quick Note Templates */}
                            <div className="fdb-templates-block">
                                <label className="fdb-block-label">
                                    <i className="fas fa-bolt text-amber me-1.5"></i>
                                    Template Tanggapan Cepat (Klik untuk menambahkan ke catatan):
                                </label>
                                <div className="fdb-template-chips">
                                    {quickResponseTemplates.map((tpl, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            className="fdb-template-chip"
                                            onClick={() => setAdminNotes((prev) => (prev ? `${prev}\n${tpl}` : tpl))}
                                        >
                                            {tpl}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Admin Notes */}
                            <div className="fdb-section-block">
                                <label className="fdb-block-label">
                                    <i className="fas fa-sticky-note text-teal me-1.5"></i>
                                    Catatan Admin / Detail Tindak Lanjut
                                </label>
                                <textarea
                                    rows="3"
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    placeholder="Tuliskan catatan internal, solusi perbaikan, atau status penugasan pengembang..."
                                    className="fdb-textarea"
                                />
                            </div>
                        </div>

                        <div className="fdb-modal-footer">
                            <div className="d-flex align-items-center gap-2">
                                {selectedStatus !== "resolved" && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-success"
                                        onClick={markAsResolved}
                                        disabled={isSaving}
                                    >
                                        <i className="fas fa-check-double me-1"></i>
                                        Tandai Selesai Langsung
                                    </button>
                                )}
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={closeFeedbackModal}
                                    disabled={isSaving}
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-teal"
                                    onClick={saveFeedbackUpdate}
                                    disabled={isSaving}
                                >
                                    <i className="fas fa-save me-1"></i>
                                    {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default React.memo(FeedbackAdminDashboard);
