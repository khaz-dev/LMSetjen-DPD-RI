import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import apiInstance from "../../../utils/axios";
import UserData from "../../plugin/UserData";
import Toast from "../../plugin/Toast";
import Swal from "sweetalert2";
import dayjs, { moment } from "../../../utils/dayjs";

/**
 * Review Abuse Reports Tab (Redesigned & Compact)
 * ✨ Displays 100% real live data from /admin/abuse-reports/
 * ✨ Features:
 *   - Real-time KPI summary metric cards (Total, Pending, Action Taken, Dismissed/Reviewed)
 *   - Quick status filter chips with live counts
 *   - Live search across multiple fields (ID, course, user, reporter, text)
 *   - Dual View Mode: Compact Responsive Grid & Modern Data Table
 *   - Interactive Moderation Detail Modal with quick-reply templates
 *   - Zero blank/wasted space layout
 */
function ReviewAbuseReportsTab({ refreshTrigger = 0, onMutationSuccess }) {
    const [allReports, setAllReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'
    const [selectedReport, setSelectedReport] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [detailStatus, setDetailStatus] = useState("");
    const [detailNotes, setDetailNotes] = useState("");
    const userData = UserData();

    // Fetch live reports
    const fetchAbuseReports = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiInstance.get("/admin/abuse-reports/");
            
            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }
            
            setAllReports(data);
        } catch (error) {
            console.error("Error fetching abuse reports:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat laporan",
                text: error.response?.data?.detail || "Terjadi kendala saat menghubungkan ke database laporan"
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAbuseReports();
    }, [fetchAbuseReports, refreshTrigger]);

    // Live counts computed directly from real database records
    const counts = useMemo(() => {
        const total = allReports.length;
        const pending = allReports.filter(r => r.status === "pending").length;
        const actionTaken = allReports.filter(r => r.status === "action_taken").length;
        const reviewed = allReports.filter(r => r.status === "reviewed").length;
        const dismissed = allReports.filter(r => r.status === "dismissed").length;
        const closedByReporter = allReports.filter(r => r.closed_by_reporter).length;
        return { total, pending, actionTaken, reviewed, dismissed, closedByReporter };
    }, [allReports]);

    // Filtered & sorted reports for current view
    const filteredReports = useMemo(() => {
        return allReports
            .filter((report) => {
                if (filterStatus && report.status !== filterStatus) {
                    return false;
                }
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const idMatch = String(report.id).includes(q);
                    const reporterMatch = (report.reported_by_name || "").toLowerCase().includes(q);
                    const courseMatch = (report.review?.course?.title || "").toLowerCase().includes(q);
                    const userMatch = (report.review?.user?.full_name || "").toLowerCase().includes(q);
                    const reasonMatch = (report.reason || "").toLowerCase().includes(q);
                    const descMatch = (report.description || "").toLowerCase().includes(q);
                    const reviewTextMatch = (report.review?.review || "").toLowerCase().includes(q);

                    if (!idMatch && !reporterMatch && !courseMatch && !userMatch && !reasonMatch && !descMatch && !reviewTextMatch) {
                        return false;
                    }
                }
                return true;
            })
            .sort((a, b) => {
                if (sortBy === "oldest") {
                    return new Date(a.reported_at) - new Date(b.reported_at);
                }
                if (sortBy === "rating_high") {
                    return (b.review?.rating || 0) - (a.review?.rating || 0);
                }
                if (sortBy === "rating_low") {
                    return (a.review?.rating || 0) - (b.review?.rating || 0);
                }
                // default newest
                return new Date(b.reported_at) - new Date(a.reported_at);
            });
    }, [allReports, filterStatus, searchQuery, sortBy]);

    // Modal open
    const handleViewDetail = (report) => {
        setSelectedReport(report);
        setDetailStatus(report.status || "pending");
        setDetailNotes(report.review_notes || "");
        setShowDetailModal(true);
    };

    // Quick status update from card or table
    const handleQuickStatusChange = async (report, newStatus) => {
        const statusLabels = {
            action_taken: "Tindakan Diambil",
            dismissed: "Ditolak",
            reviewed: "Sudah Direviu",
            pending: "Kembalikan ke Menunggu Review"
        };

        const result = await Swal.fire({
            title: `Ubah Status ke ${statusLabels[newStatus] || newStatus}?`,
            text: `Perbarui status Laporan #${report.id} secara langsung.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya, Perbarui",
            cancelButtonText: "Batal",
            confirmButtonColor: "#0d9488",
            cancelButtonColor: "#6c757d"
        });

        if (!result.isConfirmed) return;

        try {
            await apiInstance.put(`/admin/abuse-reports/${report.id}/`, {
                status: newStatus,
                review_notes: report.review_notes || `Status diperbarui langsung oleh admin menjadi ${statusLabels[newStatus]}`,
                reviewed_by: userData.user_id || userData.id
            });

            Toast().fire({
                icon: "success",
                title: "Status Berhasil Diperbarui"
            });
            fetchAbuseReports();
            if (onMutationSuccess) onMutationSuccess();
        } catch (error) {
            console.error("Error updating report:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui status",
                text: error.response?.data?.detail || "Terjadi kesalahan"
            });
        }
    };

    // Save from detail modal
    const handleUpdateStatus = async () => {
        if (!selectedReport) return;

        try {
            setUpdating(true);
            await apiInstance.put(`/admin/abuse-reports/${selectedReport.id}/`, {
                status: detailStatus,
                review_notes: detailNotes,
                reviewed_by: userData.user_id || userData.id
            });

            Toast().fire({
                icon: "success",
                title: "Laporan Berhasil Diperbarui",
                text: "Status & catatan moderasi telah tersimpan ke sistem."
            });

            setShowDetailModal(false);
            fetchAbuseReports();
            if (onMutationSuccess) onMutationSuccess();
        } catch (error) {
            console.error("Error updating report:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui laporan",
                text: error.response?.data?.detail || "Terjadi kesalahan saat menyimpan perubahan"
            });
        } finally {
            setUpdating(false);
        }
    };

    // Quick templates for notes
    const applyQuickNote = (template) => {
        setDetailNotes(template);
    };

    const getReasonLabel = (reason) => {
        const reasons = {
            inappropriate_content: "Konten Tidak Pantas",
            spam: "Spam / Promosi",
            offensive_language: "Bahasa Kasar / SARA",
            false_information: "Informasi Palsu",
            harassment: "Pelecehan / Harassment",
            other: "Lainnya"
        };
        return reasons[reason] || reason || "Tidak Ditentukan";
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            pending: { class: "badge-status-warning", icon: "fa-clock", label: "Menunggu Reviu" },
            reviewed: { class: "badge-status-info", icon: "fa-eye", label: "Sudah Direviu" },
            dismissed: { class: "badge-status-danger", icon: "fa-ban", label: "Ditolak" },
            action_taken: { class: "badge-status-success", icon: "fa-check-circle", label: "Tindakan Diambil" }
        };
        const config = statusConfig[status] || statusConfig.pending;
        return (
            <span className={`status-pill ${config.class}`}>
                <i className={`fas ${config.icon} me-1.5`}></i>
                {config.label}
            </span>
        );
    };

    // Render stars helper
    const renderRatingStars = (rating = 0) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <i
                    key={i}
                    className={`fas fa-star ${i <= rating ? "text-warning" : "text-muted opacity-25"}`}
                    style={{ fontSize: "0.8rem", marginRight: "2px" }}
                ></i>
            );
        }
        return stars;
    };

    return (
        <div className="review-abuse-module">
            {/* Live KPI Metric Cards */}
            <div className="kpi-metrics-grid mb-3">
                <div
                    className={`kpi-card ${filterStatus === "" ? "active" : ""}`}
                    onClick={() => setFilterStatus("")}
                    role="button"
                    title="Klik untuk menampilkan semua laporan"
                >
                    <div className="kpi-icon-box bg-teal-subtle text-teal">
                        <i className="fas fa-layer-group"></i>
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-value">{counts.total}</span>
                        <span className="kpi-label">Total Laporan Masuk</span>
                        <span className="kpi-subtext">Semua laporan ulasan kursus</span>
                    </div>
                </div>

                <div
                    className={`kpi-card ${filterStatus === "pending" ? "active" : ""}`}
                    onClick={() => setFilterStatus("pending")}
                    role="button"
                    title="Klik untuk filter laporan menunggu reviu"
                >
                    <div className="kpi-icon-box bg-warning-subtle text-warning">
                        <i className="fas fa-hourglass-half"></i>
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-value">{counts.pending}</span>
                        <span className="kpi-label">Menunggu Reviu</span>
                        <span className="kpi-subtext">
                            {counts.pending > 0 ? "Memerlukan tindakan admin" : "Semua antrean bersih"}
                        </span>
                    </div>
                    {counts.pending > 0 && <span className="kpi-pulse-dot"></span>}
                </div>

                <div
                    className={`kpi-card ${filterStatus === "action_taken" ? "active" : ""}`}
                    onClick={() => setFilterStatus("action_taken")}
                    role="button"
                    title="Klik untuk filter tindakan diambil"
                >
                    <div className="kpi-icon-box bg-success-subtle text-success">
                        <i className="fas fa-check-double"></i>
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-value">{counts.actionTaken}</span>
                        <span className="kpi-label">Tindakan Diterapkan</span>
                        <span className="kpi-subtext">Sanksi / ulasan disesuaikan</span>
                    </div>
                </div>

                <div
                    className={`kpi-card ${filterStatus === "dismissed" ? "active" : ""}`}
                    onClick={() => setFilterStatus("dismissed")}
                    role="button"
                    title="Klik untuk filter laporan ditolak"
                >
                    <div className="kpi-icon-box bg-slate-subtle text-secondary">
                        <i className="fas fa-shield-slash"></i>
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-value">{counts.dismissed + counts.reviewed}</span>
                        <span className="kpi-label">Selesai / Ditolak</span>
                        <span className="kpi-subtext">
                            {counts.dismissed} Ditolak &bull; {counts.reviewed} Direviu
                        </span>
                    </div>
                </div>
            </div>

            {/* Compact Control Toolbar */}
            <div className="reports-toolbar mb-3">
                {/* Status Filter Chips */}
                <div className="filter-chips-group">
                    <button
                        type="button"
                        className={`filter-chip ${filterStatus === "" ? "active" : ""}`}
                        onClick={() => setFilterStatus("")}
                    >
                        Semua ({counts.total})
                    </button>
                    <button
                        type="button"
                        className={`filter-chip ${filterStatus === "pending" ? "active" : ""}`}
                        onClick={() => setFilterStatus("pending")}
                    >
                        <i className="fas fa-clock text-warning me-1"></i>
                        Menunggu ({counts.pending})
                    </button>
                    <button
                        type="button"
                        className={`filter-chip ${filterStatus === "action_taken" ? "active" : ""}`}
                        onClick={() => setFilterStatus("action_taken")}
                    >
                        <i className="fas fa-check-circle text-success me-1"></i>
                        Ditindak ({counts.actionTaken})
                    </button>
                    <button
                        type="button"
                        className={`filter-chip ${filterStatus === "reviewed" ? "active" : ""}`}
                        onClick={() => setFilterStatus("reviewed")}
                    >
                        <i className="fas fa-eye text-info me-1"></i>
                        Direviu ({counts.reviewed})
                    </button>
                    <button
                        type="button"
                        className={`filter-chip ${filterStatus === "dismissed" ? "active" : ""}`}
                        onClick={() => setFilterStatus("dismissed")}
                    >
                        <i className="fas fa-ban text-danger me-1"></i>
                        Ditolak ({counts.dismissed})
                    </button>
                </div>

                {/* Right controls: Search, Sort, View mode */}
                <div className="toolbar-right-controls">
                    {/* Search box */}
                    <div className="search-input-wrapper">
                        <i className="fas fa-search search-icon"></i>
                        <input
                            type="text"
                            className="form-control form-control-sm search-input"
                            placeholder="Cari ID, kursus, pelapor, atau pengulas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                className="search-clear-btn"
                                onClick={() => setSearchQuery("")}
                                type="button"
                                title="Hapus pencarian"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>

                    {/* Sort */}
                    <div className="sort-select-wrapper">
                        <select
                            className="form-select form-select-sm sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            title="Urutkan Data"
                        >
                            <option value="newest">Terbaru</option>
                            <option value="oldest">Terlama</option>
                            <option value="rating_high">Rating Tertinggi</option>
                            <option value="rating_low">Rating Terendah</option>
                        </select>
                    </div>

                    {/* View Switcher */}
                    <div className="btn-group btn-group-sm view-mode-group" role="group">
                        <button
                            type="button"
                            className={`btn ${viewMode === "grid" ? "btn-teal" : "btn-outline-secondary"}`}
                            onClick={() => setViewMode("grid")}
                            title="Tampilan Kartu Grid"
                        >
                            <i className="fas fa-th-large"></i>
                        </button>
                        <button
                            type="button"
                            className={`btn ${viewMode === "table" ? "btn-teal" : "btn-outline-secondary"}`}
                            onClick={() => setViewMode("table")}
                            title="Tampilan Tabel Ringkas"
                        >
                            <i className="fas fa-list"></i>
                        </button>
                    </div>

                    {/* Refresh */}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary refresh-btn"
                        onClick={fetchAbuseReports}
                        disabled={loading}
                        title="Segarkan data saat ini"
                    >
                        <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            {loading ? (
                <div className="compact-loading-state text-center py-5">
                    <div className="spinner-border text-teal spinner-border-sm me-2" role="status"></div>
                    <span className="text-muted small">Menghubungkan & memuat laporan ulasan real-time...</span>
                </div>
            ) : filteredReports.length === 0 ? (
                <div className="compact-empty-state text-center py-5">
                    <div className="empty-icon-circle mb-2">
                        <i className="fas fa-inbox text-muted"></i>
                    </div>
                    <h6 className="fw-bold mb-1">Tidak Ada Laporan yang Ditemukan</h6>
                    <p className="text-muted small mb-3">
                        {searchQuery || filterStatus
                            ? "Tidak ada data yang sesuai dengan filter atau kata kunci pencarian saat ini."
                            : "Belum ada laporan penyalahgunaan ulasan yang diajukan oleh instruktur."}
                    </p>
                    {(searchQuery || filterStatus) && (
                        <button
                            className="btn btn-sm btn-outline-teal"
                            onClick={() => {
                                setSearchFilter("");
                                setFilterStatus("");
                                setSearchQuery("");
                            }}
                        >
                            <i className="fas fa-undo me-1"></i> Reset Filter & Pencarian
                        </button>
                    )}
                </div>
            ) : viewMode === "grid" ? (
                /* GRID CARDS VIEW - Full Width Responsive Grid */
                <div className="reports-responsive-grid">
                    {filteredReports.map((report) => (
                        <div
                            key={report.id}
                            className={`compact-report-card status-border-${report.status || "pending"}`}
                        >
                            {/* Card Header */}
                            <div className="report-card-topbar">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="report-id-chip">
                                        <i className="fas fa-hashtag text-muted me-0.5"></i>
                                        {report.id}
                                    </span>
                                    <span className="report-date-badge text-muted" title={report.reported_at}>
                                        <i className="far fa-calendar-alt me-1"></i>
                                        {moment(report.reported_at).format("DD MMM YYYY HH:mm")}
                                    </span>
                                </div>
                                <div className="report-status-badge">
                                    {getStatusBadge(report.status)}
                                </div>
                            </div>

                            {/* Course Context */}
                            <div className="report-course-context">
                                <i className="fas fa-graduation-cap text-teal me-1.5 flex-shrink-0 mt-0.5"></i>
                                <span className="course-title-text" title={report.review?.course?.title}>
                                    {report.review?.course?.title || "Kursus Tidak Diketahui"}
                                </span>
                            </div>

                            {/* Reported Review Box */}
                            <div className="reported-review-snippet">
                                <div className="reviewer-header-row">
                                    <div className="reviewer-profile-group">
                                        {report.review?.user?.image ? (
                                            <img
                                                src={report.review.user.image}
                                                alt={report.review.user.full_name || "Pengguna"}
                                                className="reviewer-mini-avatar"
                                                onError={(e) => {
                                                    e.target.style.display = "none";
                                                    if (e.target.nextSibling) {
                                                        e.target.nextSibling.style.display = "flex";
                                                    }
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className="reviewer-mini-initial"
                                            style={{ display: report.review?.user?.image ? "none" : "flex" }}
                                        >
                                            {report.review?.user?.full_name?.charAt(0).toUpperCase() || "U"}
                                        </div>
                                        <div className="reviewer-name-col">
                                            <span className="reviewer-name">
                                                {report.review?.user?.full_name || "Peserta"}
                                            </span>
                                            {(report.review?.user?.golongan || report.review?.user?.jenis_jabatan) && (
                                                <span className="reviewer-role-badge">
                                                    {report.review.user.golongan || ""}{" "}
                                                    {report.review.user.jenis_jabatan ? `• ${report.review.user.jenis_jabatan}` : ""}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="reviewer-rating-stars">
                                        {renderRatingStars(report.review?.rating || 0)}
                                        <span className="rating-number ms-1">
                                            {report.review?.rating ? Number(report.review.rating).toFixed(1) : "-"}
                                        </span>
                                    </div>
                                </div>
                                <p className="review-text-quote">
                                    &ldquo;{report.review?.review || "Tidak ada teks ulasan"}&rdquo;
                                </p>
                            </div>

                            {/* Reporter Complaint Box */}
                            <div className="complaint-details-box">
                                <div className="complaint-meta-row">
                                    <span className="complaint-reason-tag">
                                        <i className="fas fa-exclamation-circle me-1"></i>
                                        {getReasonLabel(report.reason)}
                                    </span>
                                    <span className="complaint-reporter">
                                        <i className="fas fa-user-shield me-1"></i>
                                        Pelapor: <strong>{report.reported_by_name}</strong>
                                    </span>
                                </div>
                                {report.description && (
                                    <p className="complaint-desc-text">
                                        <span className="fw-semibold">Keluhan:</span> {report.description}
                                    </p>
                                )}
                                {report.closed_by_reporter && (
                                    <div className="reporter-closed-pill mt-1">
                                        <i className="fas fa-check-circle text-success me-1"></i>
                                        Instruktur menandai selesai pada {moment(report.closed_by_reporter_at).format("DD/MM/YY HH:mm")}
                                    </div>
                                )}
                            </div>

                            {/* Admin Resolution Summary if reviewed */}
                            {report.review_notes && (
                                <div className="admin-resolution-snippet">
                                    <i className="fas fa-comment-dots text-teal me-1.5 flex-shrink-0 mt-0.5"></i>
                                    <div className="small">
                                        <span className="fw-bold text-dark">Catatan Admin:</span> {report.review_notes}
                                    </div>
                                </div>
                            )}

                            {/* Card Footer Actions */}
                            <div className="report-card-actions">
                                <button
                                    className="btn btn-teal btn-sm flex-grow-1"
                                    onClick={() => handleViewDetail(report)}
                                >
                                    <i className="fas fa-eye me-1.5"></i>
                                    Lihat Detail & Moderasi
                                </button>
                                {report.status === "pending" && (
                                    <button
                                        className="btn btn-outline-success btn-sm"
                                        onClick={() => handleQuickStatusChange(report, "action_taken")}
                                        title="Langsung Tandai Tindakan Diambil"
                                    >
                                        <i className="fas fa-check"></i>
                                    </button>
                                )}
                                {report.status !== "dismissed" && (
                                    <button
                                        className="btn btn-outline-danger btn-sm"
                                        onClick={() => handleQuickStatusChange(report, "dismissed")}
                                        title="Tolak Laporan (Tidak Melanggar)"
                                    >
                                        <i className="fas fa-ban"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* TABLE VIEW - Ultra Compact for Bulk Moderation */
                <div className="reports-table-container table-responsive">
                    <table className="table table-hover align-middle reports-data-table mb-0">
                        <thead>
                            <tr>
                                <th style={{ width: "70px" }}>ID</th>
                                <th style={{ width: "130px" }}>Status</th>
                                <th style={{ width: "240px" }}>Kursus Terkait</th>
                                <th style={{ width: "220px" }}>Pengulas & Rating</th>
                                <th>Isi Ulasan</th>
                                <th style={{ width: "190px" }}>Pelapor & Alasan</th>
                                <th style={{ width: "140px" }}>Tanggal</th>
                                <th style={{ width: "120px" }} className="text-end">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReports.map((report) => (
                                <tr key={report.id}>
                                    <td>
                                        <span className="fw-bold text-dark">#{report.id}</span>
                                    </td>
                                    <td>{getStatusBadge(report.status)}</td>
                                    <td>
                                        <div className="text-truncate fw-semibold text-dark" style={{ maxWidth: "230px" }} title={report.review?.course?.title}>
                                            {report.review?.course?.title || "-"}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="d-flex align-items-center gap-2">
                                            <div className="reviewer-table-avatar">
                                                {report.review?.user?.full_name?.charAt(0).toUpperCase() || "U"}
                                            </div>
                                            <div>
                                                <div className="fw-semibold small text-dark">
                                                    {report.review?.user?.full_name || "Peserta"}
                                                </div>
                                                <div className="small text-muted d-flex align-items-center">
                                                    <i className="fas fa-star text-warning me-1"></i>
                                                    <span>{report.review?.rating || 0} / 5</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="text-truncate text-muted small" style={{ maxWidth: "280px" }} title={report.review?.review}>
                                            &ldquo;{report.review?.review || "-"}&rdquo;
                                        </div>
                                    </td>
                                    <td>
                                        <div className="small fw-semibold text-dark">{report.reported_by_name}</div>
                                        <span className="badge bg-light text-danger border border-danger-subtle small mt-0.5">
                                            {getReasonLabel(report.reason)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="small text-muted">
                                            {moment(report.reported_at).format("DD/MM/YYYY")}
                                        </div>
                                        <div className="small text-muted" style={{ fontSize: "0.75rem" }}>
                                            {moment(report.reported_at).format("HH:mm WIB")}
                                        </div>
                                    </td>
                                    <td className="text-end">
                                        <button
                                            className="btn btn-sm btn-teal py-1 px-2.5"
                                            onClick={() => handleViewDetail(report)}
                                            title="Buka detail moderasi"
                                        >
                                            <i className="fas fa-sliders me-1"></i> Reviu
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modern Moderation Detail Modal */}
            {showDetailModal && selectedReport && (
                <div className="modal-overlay" onClick={() => !updating && setShowDetailModal(false)}>
                    <div className="modal-content modern-detail-modal" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="modal-header">
                            <div className="d-flex align-items-center gap-2">
                                <div className="modal-header-icon-box">
                                    <i className="fas fa-shield-alt"></i>
                                </div>
                                <div>
                                    <h5 className="modal-title mb-0">
                                        Moderasi Laporan Ulasan #{selectedReport.id}
                                    </h5>
                                    <span className="modal-subtitle text-white-50 small">
                                        Dilaporkan pada {moment(selectedReport.reported_at).format("DD MMMM YYYY HH:mm WIB")}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="btn-close-custom"
                                onClick={() => setShowDetailModal(false)}
                                disabled={updating}
                                aria-label="Tutup"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="modal-body">
                            {/* Two-Column Information Cards */}
                            <div className="row g-3 mb-3">
                                {/* Left Col: Target Review Content */}
                                <div className="col-lg-6">
                                    <div className="detail-card h-100">
                                        <div className="detail-card-header text-teal">
                                            <i className="fas fa-comment-dots me-1.5"></i>
                                            Konten Ulasan yang Dilaporkan
                                        </div>
                                        <div className="detail-card-body">
                                            {/* Reviewer info */}
                                            <div className="d-flex align-items-center gap-2 mb-2 p-2 bg-light rounded-3">
                                                <div className="reviewer-modal-avatar">
                                                    {selectedReport.review?.user?.full_name?.charAt(0).toUpperCase() || "U"}
                                                </div>
                                                <div className="flex-grow-1">
                                                    <div className="fw-bold text-dark small">
                                                        {selectedReport.review?.user?.full_name || "Peserta"}
                                                    </div>
                                                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                        {selectedReport.review?.user?.email || "Tidak ada email"}
                                                        {selectedReport.review?.user?.golongan && ` • Gol. ${selectedReport.review.user.golongan}`}
                                                        {selectedReport.review?.user?.jenis_jabatan && ` (${selectedReport.review.user.jenis_jabatan})`}
                                                    </div>
                                                </div>
                                                <div className="text-end">
                                                    <div className="badge bg-warning text-dark px-2 py-1">
                                                        <i className="fas fa-star me-1"></i>
                                                        {selectedReport.review?.rating || 0}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Course */}
                                            <div className="mb-2 small">
                                                <span className="text-muted">Kursus: </span>
                                                <strong className="text-dark">
                                                    {selectedReport.review?.course?.title || "-"}
                                                </strong>
                                            </div>

                                            {/* Review text box */}
                                            <div className="review-quote-modal p-2.5 rounded-3 mb-2">
                                                <div className="text-muted small mb-1">Teks Ulasan:</div>
                                                <div className="fw-normal text-dark fst-italic">
                                                    &ldquo;{selectedReport.review?.review || "Tidak ada teks"}&rdquo;
                                                </div>
                                                {selectedReport.review?.reply && (
                                                    <div className="mt-2 pt-2 border-top border-light-subtle small">
                                                        <span className="fw-semibold text-teal">Balasan Instruktur: </span>
                                                        <span>{selectedReport.review.reply}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                Tanggal Ulasan: {selectedReport.review?.date ? moment(selectedReport.review.date).format("DD MMM YYYY HH:mm") : "-"}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Col: Reporter Complaint */}
                                <div className="col-lg-6">
                                    <div className="detail-card h-100">
                                        <div className="detail-card-header text-danger">
                                            <i className="fas fa-flag me-1.5"></i>
                                            Keluhan Pelapor
                                        </div>
                                        <div className="detail-card-body">
                                            <div className="mb-2 p-2 bg-light rounded-3">
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="small text-muted">Pelapor:</span>
                                                    <span className="fw-bold small text-dark">
                                                        {selectedReport.reported_by_name}
                                                    </span>
                                                </div>
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <span className="small text-muted">Kategori Alasan:</span>
                                                    <span className="badge bg-danger-subtle text-danger fw-semibold">
                                                        {getReasonLabel(selectedReport.reason)}
                                                    </span>
                                                </div>
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <span className="small text-muted">Waktu Laporan:</span>
                                                    <span className="small text-dark">
                                                        {moment(selectedReport.reported_at).format("DD MMM YYYY HH:mm")}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="p-2.5 bg-danger-subtle rounded-3 mb-2 border border-danger-subtle">
                                                <div className="small fw-semibold text-danger mb-1">
                                                    <i className="fas fa-quote-left me-1"></i> Penjelasan Masalah dari Pelapor:
                                                </div>
                                                <div className="small text-dark">
                                                    {selectedReport.description || "Tidak ada deskripsi rincian dari pelapor."}
                                                </div>
                                            </div>

                                            {selectedReport.closed_by_reporter && (
                                                <div className="alert alert-success py-2 px-2.5 mb-0 small rounded-3">
                                                    <i className="fas fa-check-circle me-1.5"></i>
                                                    <strong>Selesai oleh Pelapor:</strong> Instruktur telah menandai masalah ini terselesaikan pada {moment(selectedReport.closed_by_reporter_at).format("DD MMM YYYY HH:mm")}.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Moderation Form */}
                            <div className="moderation-form-card p-3 rounded-3">
                                <h6 className="fw-bold text-dark mb-2.5 d-flex align-items-center gap-1.5">
                                    <i className="fas fa-gavel text-teal"></i>
                                    Keputusan Moderasi Admin
                                </h6>

                                <div className="row g-2 mb-2.5">
                                    <div className="col-md-5">
                                        <label className="form-label small fw-semibold">Status Tindakan</label>
                                        <select
                                            className="form-select form-select-sm"
                                            value={detailStatus}
                                            onChange={(e) => setDetailStatus(e.target.value)}
                                            disabled={updating}
                                        >
                                            <option value="pending">⏳ Menunggu Reviu (Pending)</option>
                                            <option value="action_taken">✅ Tindakan Diambil (Action Taken)</option>
                                            <option value="reviewed">👁️ Sudah Direviu (Reviewed)</option>
                                            <option value="dismissed">🚫 Ditolak / Tidak Melanggar (Dismissed)</option>
                                        </select>
                                    </div>
                                    <div className="col-md-7">
                                        <label className="form-label small fw-semibold">Template Catatan Cepat</label>
                                        <div className="d-flex flex-wrap gap-1">
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-outline-secondary py-0.5 px-2"
                                                onClick={() => applyQuickNote("Ulasan telah ditinjau dan dinyatakan tidak melanggar ketentuan platform.")}
                                            >
                                                Tidak Melanggar
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-outline-secondary py-0.5 px-2"
                                                onClick={() => applyQuickNote("Ulasan terbukti melanggar norma dan telah dinonaktifkan/ditindaklanjuti.")}
                                            >
                                                Melanggar / Ditindak
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-outline-secondary py-0.5 px-2"
                                                onClick={() => applyQuickNote("Masalah ulasan telah diselesaikan secara musyawarah dengan instruktur.")}
                                            >
                                                Musyawarah
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-0">
                                    <label className="form-label small fw-semibold">Catatan Moderasi Admin</label>
                                    <textarea
                                        className="form-control form-control-sm"
                                        rows="3"
                                        placeholder="Tuliskan catatan hasil pemeriksaan laporan ini (akan tersimpan pada rekam audit sistem)..."
                                        value={detailNotes}
                                        onChange={(e) => setDetailNotes(e.target.value)}
                                        disabled={updating}
                                    />
                                    <div className="d-flex justify-content-between align-items-center mt-1">
                                        <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                            Catatan ini dapat ditinjau oleh instruktur pelapor dan tim pengelola LMS.
                                        </span>
                                        {selectedReport.reviewed_at && (
                                            <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                Reviu Terakhir: {moment(selectedReport.reviewed_at).format("DD/MM/YY HH:mm")}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary px-3"
                                onClick={() => setShowDetailModal(false)}
                                disabled={updating}
                            >
                                Tutup
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-teal px-3"
                                onClick={handleUpdateStatus}
                                disabled={updating}
                            >
                                {updating ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-1.5" role="status"></span>
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-save me-1.5"></i>
                                        Simpan Perubahan
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default React.memo(ReviewAbuseReportsTab);
