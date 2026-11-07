import React, { useState, useEffect, useMemo, useCallback } from "react";
import apiInstance from "../../../utils/axios";
import UserData from "../../plugin/UserData";
import Toast from "../../plugin/Toast";
import Swal from "sweetalert2";
import dayjs, { moment } from "../../../utils/dayjs";

/**
 * Q&A Reports Tab (Redesigned & Compact)
 * ✨ Displays real live data from /admin/qa-reports/
 * ✨ Features:
 *   - Real-time KPI summary metric cards
 *   - Type switcher (Pertanyaan vs Balasan)
 *   - Quick status filter chips with real counts
 *   - Dual View Mode (Grid Cards vs Compact Table)
 *   - Moderation Modal with quick-action templates
 */
function QAReportsTab({ refreshTrigger = 0, onMutationSuccess }) {
    const [allReports, setAllReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("");
    const [filterType, setFilterType] = useState("question"); // 'question' | 'message'
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'
    const [selectedReport, setSelectedReport] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [detailStatus, setDetailStatus] = useState("");
    const [detailNotes, setDetailNotes] = useState("");
    const userData = UserData();

    const fetchQAReports = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiInstance.get(`/admin/qa-reports/?type=${filterType}`);
            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }
            setAllReports(data);
        } catch (error) {
            console.error("Error fetching Q&A reports:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat laporan",
                text: error.response?.data?.detail || "Terjadi kesalahan saat memuat data Q&A"
            });
        } finally {
            setLoading(false);
        }
    }, [filterType]);

    useEffect(() => {
        fetchQAReports();
    }, [fetchQAReports, refreshTrigger]);

    // Live counts computed directly from real records
    const counts = useMemo(() => {
        const total = allReports.length;
        const pending = allReports.filter(r => r.status === "pending").length;
        const actionTaken = allReports.filter(r => r.status === "action_taken").length;
        const reviewed = allReports.filter(r => r.status === "reviewed").length;
        const dismissed = allReports.filter(r => r.status === "dismissed").length;
        return { total, pending, actionTaken, reviewed, dismissed };
    }, [allReports]);

    // Filtered & sorted reports
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
                    const titleMatch = (report.question_title || "").toLowerCase().includes(q);
                    const userMatch = (report.question_user || report.message_user || "").toLowerCase().includes(q);
                    const contentMatch = (report.message_content || "").toLowerCase().includes(q);
                    const reasonMatch = (report.reason || "").toLowerCase().includes(q);
                    const descMatch = (report.description || "").toLowerCase().includes(q);

                    if (!idMatch && !reporterMatch && !titleMatch && !userMatch && !contentMatch && !reasonMatch && !descMatch) {
                        return false;
                    }
                }
                return true;
            })
            .sort((a, b) => {
                if (sortBy === "oldest") {
                    return new Date(a.reported_at) - new Date(b.reported_at);
                }
                return new Date(b.reported_at) - new Date(a.reported_at);
            });
    }, [allReports, filterStatus, searchQuery, sortBy]);

    const handleViewDetail = (report) => {
        setSelectedReport(report);
        setDetailStatus(report.status || "pending");
        setDetailNotes(report.review_notes || "");
        setShowDetailModal(true);
    };

    const handleQuickStatusChange = async (report, newStatus) => {
        const statusLabels = {
            action_taken: "Tindakan Diambil",
            dismissed: "Ditolak",
            reviewed: "Sudah Direviu",
            pending: "Menunggu Reviu"
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
            await apiInstance.put(`/admin/qa-reports/${report.id}/?type=${filterType}`, {
                status: newStatus,
                review_notes: report.review_notes || `Status diubah langsung oleh admin menjadi ${statusLabels[newStatus]}`,
                reviewed_by: userData.id || userData.user_id
            });

            Toast().fire({
                icon: "success",
                title: "Status Berhasil Diperbarui"
            });
            fetchQAReports();
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

    const handleUpdateStatus = async () => {
        if (!selectedReport) return;

        try {
            setUpdating(true);
            await apiInstance.put(`/admin/qa-reports/${selectedReport.id}/?type=${filterType}`, {
                status: detailStatus,
                review_notes: detailNotes,
                reviewed_by: userData.id || userData.user_id
            });

            Toast().fire({
                icon: "success",
                title: "Laporan Diperbarui",
                text: "Status & catatan moderasi telah tersimpan ke sistem."
            });

            setShowDetailModal(false);
            fetchQAReports();
            if (onMutationSuccess) onMutationSuccess();
        } catch (error) {
            console.error("Error updating report:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui laporan",
                text: error.response?.data?.detail || "Terjadi kesalahan"
            });
        } finally {
            setUpdating(false);
        }
    };

    const applyQuickNote = (template) => {
        setDetailNotes(template);
    };

    const getReasonLabel = (reason) => {
        const reasons = {
            spam: "Spam / Iklan",
            inappropriate: "Konten Tidak Pantas",
            offensive: "Konten Menyinggung",
            misinformation: "Informasi Salah",
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

    return (
        <div className="qa-reports-module">
            {/* Live KPI Metric Cards */}
            <div className="kpi-metrics-grid mb-3">
                <div
                    className={`kpi-card ${filterStatus === "" ? "active" : ""}`}
                    onClick={() => setFilterStatus("")}
                    role="button"
                    title="Semua laporan Q&A"
                >
                    <div className="kpi-icon-box bg-teal-subtle text-teal">
                        <i className="fas fa-comments"></i>
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-value">{counts.total}</span>
                        <span className="kpi-label">Total Laporan {filterType === "question" ? "Pertanyaan" : "Balasan"}</span>
                        <span className="kpi-subtext">Dari forum diskusi kursus</span>
                    </div>
                </div>

                <div
                    className={`kpi-card ${filterStatus === "pending" ? "active" : ""}`}
                    onClick={() => setFilterStatus("pending")}
                    role="button"
                    title="Menunggu review"
                >
                    <div className="kpi-icon-box bg-warning-subtle text-warning">
                        <i className="fas fa-hourglass-half"></i>
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-value">{counts.pending}</span>
                        <span className="kpi-label">Menunggu Reviu</span>
                        <span className="kpi-subtext">
                            {counts.pending > 0 ? "Memerlukan tindakan admin" : "Antrean bersih"}
                        </span>
                    </div>
                    {counts.pending > 0 && <span className="kpi-pulse-dot"></span>}
                </div>

                <div
                    className={`kpi-card ${filterStatus === "action_taken" ? "active" : ""}`}
                    onClick={() => setFilterStatus("action_taken")}
                    role="button"
                    title="Tindakan diambil"
                >
                    <div className="kpi-icon-box bg-success-subtle text-success">
                        <i className="fas fa-check-double"></i>
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-value">{counts.actionTaken}</span>
                        <span className="kpi-label">Tindakan Diterapkan</span>
                        <span className="kpi-subtext">Konten disesuaikan / dihapus</span>
                    </div>
                </div>

                <div
                    className={`kpi-card ${filterStatus === "dismissed" ? "active" : ""}`}
                    onClick={() => setFilterStatus("dismissed")}
                    role="button"
                    title="Selesai atau ditolak"
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

            {/* Type Selector Tabs & Toolbar */}
            <div className="reports-toolbar mb-3">
                {/* Type & Status Chips */}
                <div className="d-flex flex-wrap align-items-center gap-2">
                    {/* Segmented Type Toggle */}
                    <div className="btn-group btn-group-sm me-2" role="group">
                        <button
                            type="button"
                            className={`btn ${filterType === "question" ? "btn-teal fw-bold" : "btn-outline-secondary"}`}
                            onClick={() => setFilterType("question")}
                        >
                            <i className="fas fa-question-circle me-1"></i> Pertanyaan
                        </button>
                        <button
                            type="button"
                            className={`btn ${filterType === "message" ? "btn-teal fw-bold" : "btn-outline-secondary"}`}
                            onClick={() => setFilterType("message")}
                        >
                            <i className="fas fa-reply me-1"></i> Balasan/Reply
                        </button>
                    </div>

                    {/* Status Chips */}
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
                </div>

                {/* Right controls */}
                <div className="toolbar-right-controls">
                    <div className="search-input-wrapper">
                        <i className="fas fa-search search-icon"></i>
                        <input
                            type="text"
                            className="form-control form-control-sm search-input"
                            placeholder="Cari ID, pelapor, atau konten..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                className="search-clear-btn"
                                onClick={() => setSearchQuery("")}
                                type="button"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>

                    <div className="sort-select-wrapper">
                        <select
                            className="form-select form-select-sm sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="newest">Terbaru</option>
                            <option value="oldest">Terlama</option>
                        </select>
                    </div>

                    <div className="btn-group btn-group-sm view-mode-group" role="group">
                        <button
                            type="button"
                            className={`btn ${viewMode === "grid" ? "btn-teal" : "btn-outline-secondary"}`}
                            onClick={() => setViewMode("grid")}
                            title="Tampilan Grid"
                        >
                            <i className="fas fa-th-large"></i>
                        </button>
                        <button
                            type="button"
                            className={`btn ${viewMode === "table" ? "btn-teal" : "btn-outline-secondary"}`}
                            onClick={() => setViewMode("table")}
                            title="Tampilan Tabel"
                        >
                            <i className="fas fa-list"></i>
                        </button>
                    </div>

                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary refresh-btn"
                        onClick={fetchQAReports}
                        disabled={loading}
                        title="Segarkan data saat ini"
                    >
                        <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
                    </button>
                </div>
            </div>

            {/* Content List */}
            {loading ? (
                <div className="compact-loading-state text-center py-5">
                    <div className="spinner-border text-teal spinner-border-sm me-2" role="status"></div>
                    <span className="text-muted small">Memuat laporan diskusi Q&A...</span>
                </div>
            ) : filteredReports.length === 0 ? (
                <div className="compact-empty-state text-center py-5">
                    <div className="empty-icon-circle mb-2">
                        <i className="fas fa-comments text-muted"></i>
                    </div>
                    <h6 className="fw-bold mb-1">Tidak Ada Laporan Q&A yang Ditemukan</h6>
                    <p className="text-muted small mb-3">
                        {searchQuery || filterStatus
                            ? "Tidak ada data yang sesuai filter saat ini."
                            : `Belum ada laporan penyalahgunaan ${filterType === "question" ? "pertanyaan" : "balasan"} di forum.`}
                    </p>
                    {(searchQuery || filterStatus) && (
                        <button
                            className="btn btn-sm btn-outline-teal"
                            onClick={() => {
                                setFilterStatus("");
                                setSearchQuery("");
                            }}
                        >
                            <i className="fas fa-undo me-1"></i> Reset Filter
                        </button>
                    )}
                </div>
            ) : viewMode === "grid" ? (
                /* Grid View */
                <div className="reports-responsive-grid">
                    {filteredReports.map((report) => (
                        <div
                            key={report.id}
                            className={`compact-report-card status-border-${report.status || "pending"}`}
                        >
                            <div className="report-card-topbar">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="report-id-chip">
                                        <i className="fas fa-hashtag text-muted me-0.5"></i>
                                        {report.id}
                                    </span>
                                    <span className="report-date-badge text-muted">
                                        <i className="far fa-calendar-alt me-1"></i>
                                        {moment(report.reported_at).format("DD MMM YYYY HH:mm")}
                                    </span>
                                </div>
                                <div>{getStatusBadge(report.status)}</div>
                            </div>

                            {/* Content Snippet */}
                            <div className="reported-review-snippet">
                                <div className="d-flex align-items-center justify-content-between mb-1">
                                    <span className="badge bg-light text-dark border small">
                                        <i className={`fas ${filterType === "question" ? "fa-question-circle" : "fa-reply"} text-teal me-1`}></i>
                                        {filterType === "question" ? "Pertanyaan" : "Balasan Peserta"}
                                    </span>
                                    <span className="small text-muted">
                                        Oleh: <strong>{report.question_user || report.message_user || "Pengguna"}</strong>
                                    </span>
                                </div>
                                <p className="review-text-quote fw-semibold">
                                    {filterType === "question"
                                        ? report.question_title
                                        : report.message_content}
                                </p>
                            </div>

                            {/* Complaint detail */}
                            <div className="complaint-details-box">
                                <div className="complaint-meta-row">
                                    <span className="complaint-reason-tag">
                                        <i className="fas fa-exclamation-circle me-1"></i>
                                        {getReasonLabel(report.reason)}
                                    </span>
                                    <span className="complaint-reporter">
                                        Pelapor: <strong>{report.reported_by_name}</strong>
                                    </span>
                                </div>
                                {report.description && (
                                    <p className="complaint-desc-text">
                                        <span className="fw-semibold">Keluhan:</span> {report.description}
                                    </p>
                                )}
                            </div>

                            {/* Action footer */}
                            <div className="report-card-actions">
                                <button
                                    className="btn btn-teal btn-sm flex-grow-1"
                                    onClick={() => handleViewDetail(report)}
                                >
                                    <i className="fas fa-eye me-1.5"></i> Lihat Detail & Moderasi
                                </button>
                                {report.status === "pending" && (
                                    <button
                                        className="btn btn-outline-success btn-sm"
                                        onClick={() => handleQuickStatusChange(report, "action_taken")}
                                        title="Tandai Tindakan Diambil"
                                    >
                                        <i className="fas fa-check"></i>
                                    </button>
                                )}
                                {report.status !== "dismissed" && (
                                    <button
                                        className="btn btn-outline-danger btn-sm"
                                        onClick={() => handleQuickStatusChange(report, "dismissed")}
                                        title="Tolak Laporan"
                                    >
                                        <i className="fas fa-ban"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Table View */
                <div className="reports-table-container table-responsive">
                    <table className="table table-hover align-middle reports-data-table mb-0">
                        <thead>
                            <tr>
                                <th style={{ width: "70px" }}>ID</th>
                                <th style={{ width: "130px" }}>Status</th>
                                <th style={{ width: "150px" }}>Tipe & Penulis</th>
                                <th>Konten Diskusi</th>
                                <th style={{ width: "200px" }}>Pelapor & Alasan</th>
                                <th style={{ width: "140px" }}>Tanggal</th>
                                <th style={{ width: "110px" }} className="text-end">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReports.map((report) => (
                                <tr key={report.id}>
                                    <td><span className="fw-bold text-dark">#{report.id}</span></td>
                                    <td>{getStatusBadge(report.status)}</td>
                                    <td>
                                        <span className="badge bg-light text-dark border small d-block mb-1 w-fit">
                                            {filterType === "question" ? "Pertanyaan" : "Balasan"}
                                        </span>
                                        <span className="small text-muted">
                                            {report.question_user || report.message_user || "-"}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="text-truncate fw-semibold text-dark" style={{ maxWidth: "340px" }}>
                                            {filterType === "question" ? report.question_title : report.message_content}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="small fw-semibold text-dark">{report.reported_by_name}</div>
                                        <span className="badge bg-light text-danger border border-danger-subtle small mt-0.5">
                                            {getReasonLabel(report.reason)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="small text-muted">{moment(report.reported_at).format("DD/MM/YYYY")}</div>
                                        <div className="small text-muted" style={{ fontSize: "0.75rem" }}>
                                            {moment(report.reported_at).format("HH:mm WIB")}
                                        </div>
                                    </td>
                                    <td className="text-end">
                                        <button
                                            className="btn btn-sm btn-teal py-1 px-2.5"
                                            onClick={() => handleViewDetail(report)}
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

            {/* Detail Modal */}
            {showDetailModal && selectedReport && (
                <div className="modal-overlay" onClick={() => !updating && setShowDetailModal(false)}>
                    <div className="modal-content modern-detail-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="d-flex align-items-center gap-2">
                                <div className="modal-header-icon-box">
                                    <i className="fas fa-comments"></i>
                                </div>
                                <div>
                                    <h5 className="modal-title mb-0">
                                        Moderasi Laporan Q&A #{selectedReport.id}
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
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="row g-3 mb-3">
                                <div className="col-lg-6">
                                    <div className="detail-card h-100">
                                        <div className="detail-card-header text-teal">
                                            <i className="fas fa-file-alt me-1.5"></i>
                                            Konten yang Dilaporkan
                                        </div>
                                        <div className="detail-card-body">
                                            <div className="p-2.5 bg-light rounded-3 mb-2">
                                                <span className="small text-muted d-block mb-1">
                                                    Penulis: <strong>{selectedReport.question_user || selectedReport.message_user || "-"}</strong>
                                                </span>
                                                <div className="fw-semibold text-dark">
                                                    {filterType === "question"
                                                        ? selectedReport.question_title
                                                        : selectedReport.message_content}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-lg-6">
                                    <div className="detail-card h-100">
                                        <div className="detail-card-header text-danger">
                                            <i className="fas fa-flag me-1.5"></i>
                                            Informasi Pelapor
                                        </div>
                                        <div className="detail-card-body">
                                            <div className="p-2 bg-light rounded-3 mb-2">
                                                <div className="small text-muted mb-1">
                                                    Pelapor: <strong className="text-dark">{selectedReport.reported_by_name}</strong>
                                                </div>
                                                <div className="small text-muted mb-1">
                                                    Alasan: <span className="badge bg-danger-subtle text-danger">{getReasonLabel(selectedReport.reason)}</span>
                                                </div>
                                            </div>
                                            <div className="p-2.5 bg-danger-subtle rounded-3 small text-dark border border-danger-subtle">
                                                <span className="fw-semibold text-danger">Keluhan: </span>
                                                {selectedReport.description || "Tidak ada rincian tambahan"}
                                            </div>
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
                                            <option value="dismissed">🚫 Ditolak (Dismissed)</option>
                                        </select>
                                    </div>
                                    <div className="col-md-7">
                                        <label className="form-label small fw-semibold">Template Catatan Cepat</label>
                                        <div className="d-flex flex-wrap gap-1">
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-outline-secondary py-0.5 px-2"
                                                onClick={() => applyQuickNote("Konten diskusi telah ditinjau dan dinyatakan tidak melanggar pedoman komunitas.")}
                                            >
                                                Tidak Melanggar
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-outline-secondary py-0.5 px-2"
                                                onClick={() => applyQuickNote("Konten melanggar tata tertib dan telah dimoderasi/dihapus.")}
                                            >
                                                Dimoderasi
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-0">
                                    <label className="form-label small fw-semibold">Catatan Moderasi Admin</label>
                                    <textarea
                                        className="form-control form-control-sm"
                                        rows="3"
                                        placeholder="Tuliskan catatan hasil pemeriksaan laporan diskusi ini..."
                                        value={detailNotes}
                                        onChange={(e) => setDetailNotes(e.target.value)}
                                        disabled={updating}
                                    />
                                </div>
                            </div>
                        </div>

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
                                        <i className="fas fa-save me-1.5"></i> Simpan Perubahan
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

export default React.memo(QAReportsTab);
