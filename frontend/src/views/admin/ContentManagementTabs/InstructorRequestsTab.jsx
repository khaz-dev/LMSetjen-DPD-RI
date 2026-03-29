import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";

/**
 * Instructor Requests Tab Component
 * Handles review, approval, and rejection of pending instructor requests
 * ✨ PHASE 4.78: Integrated from AdminInstructorRequestPanel into Content Management
 */
function InstructorRequestsTab() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("PENDING");
    const [expandedBio, setExpandedBio] = useState(null);

    // Initial fetch on mount + dependency on filterStatus
    useEffect(() => {
        fetchInstructorRequests();
    }, [filterStatus]);

    const fetchInstructorRequests = async () => {
        try {
            setLoading(true);
            const response = await apiInstance.get(
                `/admin/instructor-requests/?status=${filterStatus}`
            );

            console.log("[InstructorRequestsTab] API Response:", response.data);

            // Handle both array and paginated response formats
            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }

            console.log(`[InstructorRequestsTab] Found ${data.length} requests`);
            setRequests(data);
        } catch (error) {
            console.error("Error fetching instructor requests:", error);
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
        <div className="instructor-requests-tab">
            {/* Filter Buttons */}
            <div className="tab-filters mb-4">
                <div className="filter-group d-flex gap-2 mb-3">
                    <button
                        className={`btn btn-sm ${filterStatus === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilterStatus('PENDING')}
                    >
                        <i className="fas fa-hourglass-half me-2"></i>
                        Tertunda
                        {requests.filter(r => r.status === 'PENDING').length > 0 && (
                            <span className="badge bg-danger ms-2">
                                {requests.filter(r => r.status === 'PENDING').length}
                            </span>
                        )}
                    </button>
                    <button
                        className={`btn btn-sm ${filterStatus === 'APPROVED' ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => setFilterStatus('APPROVED')}
                    >
                        <i className="fas fa-check-circle me-2"></i>
                        Disetujui
                    </button>
                    <button
                        className={`btn btn-sm ${filterStatus === 'REJECTED' ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => setFilterStatus('REJECTED')}
                    >
                        <i className="fas fa-times-circle me-2"></i>
                        Ditolak
                    </button>
                    <button 
                        className="btn btn-sm btn-primary ms-auto"
                        onClick={fetchInstructorRequests}
                        disabled={loading}
                    >
                        <i className="fas fa-sync me-2"></i> Segar
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-3 text-muted">Memuat permintaan...</p>
                </div>
            ) : requests.length === 0 ? (
                <div className="text-center py-5">
                    <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <h5>Tidak Ada Permintaan</h5>
                    <p className="text-muted mb-0">
                        {filterStatus === 'PENDING' 
                            ? 'Tidak ada permintaan yang menunggu review saat ini.'
                            : `Tidak ada permintaan dengan status "${filterStatus.toLowerCase()}".`
                        }
                    </p>
                </div>
            ) : (
                <div className="row g-3">
                    {requests.map((request) => (
                        <div key={request.id} className="col-md-6 col-lg-4">
                            <div className="card h-100 shadow-sm hover-shadow-lg" style={{ borderTop: `4px solid ${request.status === 'PENDING' ? '#ff9800' : request.status === 'APPROVED' ? '#4caf50' : '#f44336'}` }}>
                                {/* Card Header with Profile Image */}
                                <div className="card-header bg-light">
                                    <div className="d-flex align-items-start gap-3">
                                        {/* Profile Image */}
                                <div className="flex-shrink-0 position-relative" style={{ width: '50px', height: '50px' }}>
                                    {/* Fallback avatar - shown by default, hidden if image loads */}
                                    <div 
                                        className="fallback-avatar rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
                                        style={{ width: '50px', height: '50px', fontSize: '20px' }}
                                    >
                                        <i className="fas fa-user"></i>
                                    </div>
                                    
                                    {/* Profile image - shown if available and loads successfully */}
                                    {request.user_image && (
                                        <img 
                                            src={request.user_image}
                                            alt={request.user_name}
                                            className="rounded-circle"
                                            style={{ 
                                                width: '50px', 
                                                height: '50px', 
                                                objectFit: 'cover',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0
                                            }}
                                            onError={(e) => {
                                                // Hide image on error, fallback will be visible
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    )}
                                </div>
                                        
                                        {/* User Info & Status */}
                                        <div className="flex-grow-1">
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <h6 className="card-title mb-1">{request.user_name}</h6>
                                                    <a href={`mailto:${request.user_email}`} className="text-decoration-none small text-muted">
                                                        <i className="fas fa-envelope me-1"></i>{request.user_email}
                                                    </a>
                                                    {request.user_nip && (
                                                        <p className="mb-0 small text-muted mt-1">
                                                            <i className="fas fa-id-card me-1"></i>NIP: {request.user_nip}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    {getStatusBadge(request.status)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="card-body">
                                    {/* Expertise Areas */}
                                    <div className="mb-3">
                                        <small className="text-muted">
                                            <i className="fas fa-lightbulb me-1"></i> <strong>Bidang Keahlian</strong>
                                        </small>
                                        <p className="mb-0 small mt-1">
                                            {request.expertise_areas || '-'}
                                        </p>
                                    </div>

                                    {/* Experience Level */}
                                    <div className="mb-3">
                                        <small className="text-muted">
                                            <i className="fas fa-chart-line me-1"></i> <strong>Tingkat Pengalaman</strong>
                                        </small>
                                        <p className="mb-0 small mt-1">
                                            {getExperienceLevelLabel(request.experience_level)}
                                        </p>
                                    </div>

                                    {/* Bio - Full display, not truncated */}
                                    <div className="mb-3">
                                        <small className="text-muted">
                                            <i className="fas fa-user me-1"></i> <strong>Biografi</strong>
                                        </small>
                                        <p className="mb-0 small mt-1" style={{ maxHeight: '80px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                                            {request.bio || '-'}
                                        </p>
                                    </div>

                                    {/* Request Date */}
                                    <div className="mb-3">
                                        <small className="text-muted">
                                            <i className="fas fa-calendar me-1"></i> <strong>Permintaan Pada</strong>
                                        </small>
                                        <p className="mb-0 small mt-1">
                                            {new Date(request.request_date).toLocaleDateString('id-ID', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>

                                    {/* Review Information (for approved/rejected) */}
                                    {(request.status === 'APPROVED' || request.status === 'REJECTED') && request.reviewed_date && (
                                        <div className="mb-3 p-2 bg-light rounded border-start border-3" style={{ borderColor: request.status === 'APPROVED' ? '#4caf50' : '#f44336' }}>
                                            <small className="text-muted">
                                                <i className="fas fa-user-check me-1"></i> <strong>Ditinjau Oleh</strong>
                                            </small>
                                            <p className="mb-0 small mt-1">
                                                {request.reviewed_by_name || 'Admin'} pada {new Date(request.reviewed_date).toLocaleDateString('id-ID')}
                                            </p>
                                        </div>
                                    )}

                                    {/* Rejection Reason (if rejected) */}
                                    {request.status === 'REJECTED' && request.rejection_reason && (
                                        <div className="mb-3 p-2 bg-light rounded border-start border-danger border-3">
                                            <small className="text-danger">
                                                <i className="fas fa-ban me-1"></i> <strong>Alasan Penolakan</strong>
                                            </small>
                                            <p className="mb-0 small mt-1 text-muted" style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                                {request.rejection_reason}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Card Footer - Actions (ONLY for PENDING) */}
                                {request.status === 'PENDING' && (
                                    <div className="card-footer bg-light d-flex gap-2 justify-content-end">
                                        <button
                                            className="btn btn-sm btn-danger"
                                            onClick={() => handleRejectRequest(request)}
                                            title="Tolak permintaan instruktur"
                                        >
                                            <i className="fas fa-times me-1"></i> Tolak
                                        </button>
                                        <button
                                            className="btn btn-sm btn-success"
                                            onClick={() => handleApproveRequest(request)}
                                            title="Setujui permintaan instruktur"
                                        >
                                            <i className="fas fa-check me-1"></i> Setujui
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default React.memo(InstructorRequestsTab);
