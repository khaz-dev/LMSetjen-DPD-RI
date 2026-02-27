import React, { useState, useEffect } from "react";
import apiInstance from "../../../utils/axios";
import UserData from "../../plugin/UserData";
import Toast from "../../plugin/Toast";
import dayjs, { moment } from "../../../utils/dayjs";

/**
 * Review Abuse Reports Tab
 * ✨ PHASE 4.210: Tab component for managing review abuse reports within Reports page
 * 
 * Extracted from ReviewAbuseAdmin.jsx to be used as a tab in ReportsAdmin
 */
function ReviewAbuseReportsTab() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("");
    const [selectedReport, setSelectedReport] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [detailStatus, setDetailStatus] = useState("");
    const [detailNotes, setDetailNotes] = useState("");
    const userData = UserData();

    useEffect(() => {
        fetchAbuseReports();
    }, [filterStatus]);

    const fetchAbuseReports = async () => {
        try {
            setLoading(true);
            let url = "/admin/abuse-reports/";
            if (filterStatus) {
                url += `?status=${filterStatus}`;
            }
            
            const response = await apiInstance.get(url);
            console.log("[ReviewAbuseReportsTab] API Response:", response.data);
            
            // Handle both array and paginated response formats
            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }
            
            console.log(`[ReviewAbuseReportsTab] Found ${data.length} reports`);
            setReports(data);
        } catch (error) {
            console.error("Error fetching abuse reports:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat laporan",
                text: error.response?.data?.detail || "Terjadi kesalahan saat memuat data"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetail = (report) => {
        setSelectedReport(report);
        setDetailStatus(report.status);
        setDetailNotes(report.review_notes || "");
        setShowDetailModal(true);
    };

    const handleUpdateStatus = async () => {
        if (!selectedReport) return;

        try {
            setUpdating(true);
            const response = await apiInstance.put(`/admin/abuse-reports/${selectedReport.id}/`, {
                status: detailStatus,
                review_notes: detailNotes,
                reviewed_by: userData.user_id
            });

            Toast().fire({
                icon: "success",
                title: "Laporan Diperbarui",
                text: "Status laporan telah diperbarui"
            });

            setShowDetailModal(false);
            fetchAbuseReports();
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

    const getReasonLabel = (reason) => {
        const reasons = {
            'inappropriate_content': 'Konten Tidak Pantas',
            'spam': 'Spam',
            'offensive_language': 'Bahasa Kasar/Menyinggung',
            'false_information': 'Informasi Palsu',
            'harassment': 'Pelecehan',
            'other': 'Lainnya'
        };
        return reasons[reason] || reason;
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            'pending': { class: 'badge-warning', icon: 'fa-clock', label: 'Menunggu Review' },
            'reviewed': { class: 'badge-info', icon: 'fa-eye', label: 'Sudah Direviu' },
            'dismissed': { class: 'badge-danger', icon: 'fa-times', label: 'Ditolak' },
            'action_taken': { class: 'badge-success', icon: 'fa-check', label: 'Tindakan Diambil' }
        };
        const config = statusConfig[status] || statusConfig['pending'];
        return (
            <span className={`badge ${config.class}`}>
                <i className={`fas ${config.icon} me-1`}></i>
                {config.label}
            </span>
        );
    };

    return (
        <div className="review-abuse-tab">
            {/* Filter Section */}
            <div className="filter-section mb-4">
                <div className="row">
                    <div className="col-md-6">
                        <label className="form-label">Filter berdasarkan Status</label>
                        <select 
                            className="form-select filter-select"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="">Semua Status</option>
                            <option value="pending">Menunggu Review</option>
                            <option value="reviewed">Sudah Direviu</option>
                            <option value="dismissed">Ditolak</option>
                            <option value="action_taken">Tindakan Diambil</option>
                        </select>
                    </div>
                    <div className="col-md-6">
                        <div className="stat-badge">
                            <span className="stat-value">{reports.length}</span>
                            <span className="stat-label">Total Laporan</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reports List */}
            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            ) : reports.length === 0 ? (
                <div className="empty-state text-center py-5">
                    <i className="fas fa-inbox text-muted" style={{ fontSize: "3rem" }}></i>
                    <p className="text-muted mt-3">Tidak ada laporan penyalahgunaan</p>
                </div>
            ) : (
                <div className="reports-list">
                    {reports.map((report) => (
                        <div key={report.id} className="report-card">
                            <div className="report-header">
                                <div className="report-info">
                                    <div className="report-meta">
                                        <span className="report-id">
                                            <i className="fas fa-file-alt me-1"></i>
                                            Report #{report.id}
                                        </span>
                                    </div>
                                </div>
                                <div className="report-status">
                                    {getStatusBadge(report.status)}
                                </div>
                            </div>

                            <span className="report-date text-muted">
                                <i className="fas fa-calendar me-1"></i>
                                {moment(report.reported_at).format("DD MMM YYYY HH:mm")}
                            </span>
                            <div className="report-instructor">
                                <strong>Dilaporkan oleh:</strong> {report.reported_by_name}
                            </div>
                            <div className="report-reason">
                                <i className="fas fa-exclamation-circle text-warning me-1"></i>
                                <strong>Alasan:</strong> {getReasonLabel(report.reason)}
                            </div>

                            <div className="report-description">
                                <p className="text-muted">
                                    <strong>Deskripsi:</strong>
                                </p>
                                <p>{report.description || "-"}</p>
                            </div>

                            <div className="report-footer">
                                <button 
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleViewDetail(report)}
                                >
                                    <i className="fas fa-eye me-1"></i>
                                    Lihat Detail
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedReport && (
                <div className="modal-overlay" onClick={() => !updating && setShowDetailModal(false)}>
                    <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h5 className="modal-title">
                                <i className="fas fa-clipboard-check me-2"></i>
                                Detail Laporan Penyalahgunaan
                            </h5>
                            <button 
                                type="button" 
                                className="btn-close" 
                                onClick={() => setShowDetailModal(false)}
                                disabled={updating}
                            ></button>
                        </div>

                        <div className="modal-body">
                            {/* Report Info */}
                            <div className="detail-section">
                                <h6 className="section-title">Informasi Laporan</h6>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <label>ID Laporan</label>
                                        <p>#{selectedReport.id}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>Dilaporkan Oleh</label>
                                        <p>{selectedReport.reported_by_name}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>Tanggal Laporan</label>
                                        <p>{moment(selectedReport.reported_at).format("DD MMM YYYY HH:mm")}</p>
                                    </div>
                                    <div className="info-item">
                                        <label>Alasan</label>
                                        <p>{getReasonLabel(selectedReport.reason)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Review Content */}
                            <div className="detail-section">
                                <h6 className="section-title">Konten Review yang Dilaporkan</h6>
                                <div className="review-content-box">
                                    <div className="review-item">
                                        <div className="review-meta mt-2">
                                            <span className="badge badge-light badge-rating">
                                                Rating: {selectedReport.review?.rating} ⭐
                                            </span>
                                            <span className="badge badge-light badge-author">
                                                Oleh: {selectedReport.review?.user?.full_name}
                                            </span>
                                        </div>
                                        <p className="review-text">{selectedReport.review?.review || "-"}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Report Description */}
                            <div className="detail-section">
                                <h6 className="section-title">Deskripsi Masalah</h6>
                                <div className="description-box">
                                    <p>{selectedReport.description || "Tidak ada deskripsi tambahan"}</p>
                                </div>
                            </div>

                            {/* Reporter Status */}
                            {selectedReport.closed_by_reporter && (
                                <div className="detail-section">
                                    <div className="alert alert-success">
                                        <i className="fas fa-check-circle me-2"></i>
                                        <strong>Masalah Selesai oleh Pelapor</strong>
                                        <p className="mb-0 mt-2">
                                            Instruktur telah menandai masalah ini sebagai selesai pada {moment(selectedReport.closed_by_reporter_at).format("DD MMM YYYY HH:mm")}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Status & Notes */}
                            <div className="detail-section">
                                <h6 className="section-title">Update Status</h6>
                                <div className="form-group mb-3">
                                    <label className="form-label">Status</label>
                                    <select 
                                        className="form-select"
                                        value={detailStatus}
                                        onChange={(e) => setDetailStatus(e.target.value)}
                                        disabled={updating}
                                    >
                                        <option value="pending">Menunggu Review</option>
                                        <option value="reviewed">Sudah Direviu</option>
                                        <option value="dismissed">Ditolak</option>
                                        <option value="action_taken">Tindakan Diambil</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Catatan Review</label>
                                    <textarea 
                                        className="form-control"
                                        rows="4"
                                        placeholder="Masukkan catatan hasil review..."
                                        value={detailNotes}
                                        onChange={(e) => setDetailNotes(e.target.value)}
                                        disabled={updating}
                                    />
                                    <small className="text-muted">
                                        Catatan ini akan dilihat oleh instruktur yang melaporkan
                                    </small>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button 
                                type="button" 
                                className="btn btn-secondary"
                                onClick={() => setShowDetailModal(false)}
                                disabled={updating}
                            >
                                Batal
                            </button>
                            <button 
                                type="button" 
                                className="btn btn-primary"
                                onClick={handleUpdateStatus}
                                disabled={updating}
                            >
                                {updating ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Memproses...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-save me-1"></i>
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

export default ReviewAbuseReportsTab;
