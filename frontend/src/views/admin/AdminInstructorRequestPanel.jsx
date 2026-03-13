import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import apiInstance from "../../utils/axios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import "./AdminInstructorRequestPanel.css";

/**
 * Admin Instructor Request Panel Component
 * 
 * Allows admins to review pending instructor requests, approve, or reject them.
 * Displays request details, applicant info, and action buttons.
 */
function AdminInstructorRequestPanel() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("PENDING");
    const [rejectionReason, setRejectionReason] = useState("");
    const userData = UserData();

    useEffect(() => {
        fetchInstructorRequests();
    }, [filterStatus]);

    const fetchInstructorRequests = async () => {
        try {
            setLoading(true);
            const response = await apiInstance.get(
                `/admin/instructor-requests/?status=${filterStatus}`
            );

            console.log("[AdminInstructorRequestPanel] API Response:", response.data);

            // Handle both array and paginated response formats
            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }

            console.log(`[AdminInstructorRequestPanel] Found ${data.length} requests`);
            setRequests(data);
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: "Gagal memuat permintaan",
                text: error.response?.data?.detail || "Terjadi kesalahan saat memuat data"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleApproveRequest = async (request) => {
        const result = await Swal.fire({
            title: `Setujui Permintaan dari "${request.user_name}"?`,
            html: `
                <div class="text-start">
                    <p><strong>Email:</strong> ${request.user_email || "N/A"}</p>
                    <p><strong>Bidang Keahlian:</strong> ${request.expertise_areas || "N/A"}</p>
                    <p><strong>Tingkat Pengalaman:</strong> ${getExperienceLevelLabel(request.experience_level)}</p>
                    <p class="text-muted small mt-3">
                        Pengguna akan secara otomatis mendapat peran instruktur dan dapat membuat kursus.
                    </p>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#4CAF50",
            cancelButtonColor: "#d33",
            confirmButtonText: "Ya, Setujui",
            cancelButtonText: "Batal"
        });

        if (result.isConfirmed) {
            try {
                await apiInstance.post(
                    `/admin/instructor-request/${request.id}/approve/`
                );

                Toast().fire({
                    icon: "success",
                    title: "Permintaan Disetujui",
                    text: `"${request.user_name}" sekarang adalah instruktur`
                });

                fetchInstructorRequests();
            } catch (error) {
                Toast().fire({
                    icon: "error",
                    title: "Gagal menyetujui permintaan",
                    text: error.response?.data?.detail || "Terjadi kesalahan"
                });
            }
        }
    };

    const handleRejectRequest = async (request) => {
        const { value: reason } = await Swal.fire({
            title: `Tolak Permintaan dari "${request.user_name}"?`,
            input: "textarea",
            inputLabel: "Alasan Penolakan",
            inputPlaceholder: "Jelaskan mengapa aplikasi ini ditolak dan apa yang perlu diperbaiki...",
            inputAttributes: {
                "aria-label": "Alasan penolakan"
            },
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#6c757d",
            confirmButtonText: "Ya, Tolak",
            cancelButtonText: "Batal",
            inputValidator: (value) => {
                if (!value || value.trim().length < 10) {
                    return "Alasan penolakan minimal 10 karakter";
                }
            }
        });

        if (reason) {
            try {
                await apiInstance.post(
                    `/admin/instructor-request/${request.id}/reject/`,
                    {
                        rejection_reason: reason
                    }
                );

                Toast().fire({
                    icon: "success",
                    title: "Permintaan Ditolak",
                    text: `Pengguna akan menerima email notifikasi tentang penolakan`
                });

                fetchInstructorRequests();
            } catch (error) {
                Toast().fire({
                    icon: "error",
                    title: "Gagal menolak permintaan",
                    text: error.response?.data?.detail || "Terjadi kesalahan"
                });
            }
        }
    };

    const getExperienceLevelLabel = (level) => {
        const labelMap = {
            BEGINNER: 'Pemula (0-2 tahun)',
            INTERMEDIATE: 'Menengah (2-5 tahun)',
            ADVANCED: 'Lanjutan (5+ tahun)'
        };
        return labelMap[level] || level;
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            PENDING: { label: 'Tertunda', class: 'bg-warning' },
            APPROVED: { label: 'Disetujui', class: 'bg-success' },
            REJECTED: { label: 'Ditolak', class: 'bg-danger' }
        };
        const statusInfo = statusMap[status] || { label: status, class: 'bg-secondary' };
        return <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>;
    };

    return (
        <div className="instructor-request-panel">
            <div className="panel-header">
                <div className="header-title">
                    <h2>
                        <i className="fas fa-user-tie"></i> Kelola Permintaan Instruktur
                    </h2>
                    <p className="text-muted">
                        Tinjau dan setujui permintaan dari pengguna yang ingin menjadi instruktur
                    </p>
                </div>
            </div>

            {/* Filter Buttons */}
            <div className="panel-filters">
                <div className="filter-group">
                    <button
                        className={`filter-btn ${filterStatus === 'PENDING' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('PENDING')}
                    >
                        <i className="fas fa-hourglass-half"></i>
                        <span>Tertunda</span>
                        {requests.filter(r => r.status === 'PENDING').length > 0 && (
                            <span className="badge bg-danger ms-2">
                                {requests.filter(r => r.status === 'PENDING').length}
                            </span>
                        )}
                    </button>
                    <button
                        className={`filter-btn ${filterStatus === 'APPROVED' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('APPROVED')}
                    >
                        <i className="fas fa-check-circle"></i>
                        <span>Disetujui</span>
                    </button>
                    <button
                        className={`filter-btn ${filterStatus === 'REJECTED' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('REJECTED')}
                    >
                        <i className="fas fa-times-circle"></i>
                        <span>Ditolak</span>
                    </button>
                </div>
                <button 
                    className="btn btn-sm btn-outline-primary"
                    onClick={fetchInstructorRequests}
                    disabled={loading}
                >
                    <i className="fas fa-sync"></i> Segar
                </button>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="loading-state">
                    <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p>Memuat permintaan...</p>
                </div>
            ) : requests.length === 0 ? (
                <div className="empty-state">
                    <i className="fas fa-inbox"></i>
                    <h3>Tidak Ada Permintaan</h3>
                    <p className="text-muted">
                        {filterStatus === 'PENDING' 
                            ? 'Tidak ada permintaan yang menunggu review saat ini.'
                            : `Tidak ada permintaan dengan status ${filterStatus.toLowerCase()}.`
                        }
                    </p>
                </div>
            ) : (
                <div className="requests-grid">
                    {requests.map((request) => (
                        <div key={request.id} className="request-card">
                            {/* Card Header */}
                            <div className="card-header">
                                <div className="header-info">
                                    <h4 className="user-name">{request.user_name}</h4>
                                    <p className="user-email">
                                        <i className="fas fa-envelope"></i>
                                        <a href={`mailto:${request.user_email}`}>
                                            {request.user_email}
                                        </a>
                                    </p>
                                </div>
                                <div className="header-meta">
                                    {getStatusBadge(request.status)}
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="card-body">
                                {/* Expertise Areas */}
                                <div className="info-section">
                                    <label className="section-label">
                                        <i className="fas fa-lightbulb"></i> Bidang Keahlian
                                    </label>
                                    <p className="section-content">
                                        {request.expertise_areas || '-'}
                                    </p>
                                </div>

                                {/* Experience Level */}
                                <div className="info-section">
                                    <label className="section-label">
                                        <i className="fas fa-chart-line"></i> Tingkat Pengalaman
                                    </label>
                                    <p className="section-content">
                                        {getExperienceLevelLabel(request.experience_level)}
                                    </p>
                                </div>

                                {/* Bio */}
                                <div className="info-section">
                                    <label className="section-label">
                                        <i className="fas fa-user"></i> Biografi
                                    </label>
                                    <p className="section-content bio-content">
                                        {request.bio || '-'}
                                    </p>
                                </div>

                                {/* Request Date */}
                                <div className="info-section">
                                    <label className="section-label">
                                        <i className="fas fa-calendar"></i> Tanggal Permintaan
                                    </label>
                                    <p className="section-content text-muted small">
                                        {new Date(request.request_date).toLocaleDateString('id-ID', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>

                                {/* Rejection Reason (if rejected) */}
                                {request.status === 'REJECTED' && request.rejection_reason && (
                                    <div className="info-section">
                                        <label className="section-label text-danger">
                                            <i className="fas fa-ban"></i> Alasan Penolakan
                                        </label>
                                        <p className="section-content bg-light p-2 rounded">
                                            {request.rejection_reason}
                                        </p>
                                    </div>
                                )}

                                {/* Review Info (if approved/rejected) */}
                                {(request.status === 'APPROVED' || request.status === 'REJECTED') && request.reviewed_date && (
                                    <div className="info-section">
                                        <label className="section-label">
                                            <i className="fas fa-user-check"></i> Ditinjau Oleh
                                        </label>
                                        <p className="section-content text-muted small">
                                            {request.reviewed_by_name || 'Admin'} pada {new Date(request.reviewed_date).toLocaleDateString('id-ID')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Card Footer - Actions */}
                            {request.status === 'PENDING' && (
                                <div className="card-footer">
                                    <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => handleRejectRequest(request)}
                                    >
                                        <i className="fas fa-times"></i> Tolak
                                    </button>
                                    <button
                                        className="btn btn-sm btn-success"
                                        onClick={() => handleApproveRequest(request)}
                                    >
                                        <i className="fas fa-check"></i> Setujui
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default React.memo(AdminInstructorRequestPanel);
