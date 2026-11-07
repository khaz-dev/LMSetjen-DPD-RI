import React, { useState, useEffect, useMemo, useCallback } from "react";
import Swal from "sweetalert2";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";

/**
 * Redesigned Compact & Live Instructor Requests Tab
 * Setjen DPD RI Learning Platform
 */
function InstructorRequestsTab({ onCountsUpdated }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("PENDING"); // 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
    const [searchTerm, setSearchTerm] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'
    const [activeBioModal, setActiveBioModal] = useState(null);
    const [liveStats, setLiveStats] = useState({
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0
    });

    // Fetch requests from API
    const fetchInstructorRequests = useCallback(async () => {
        try {
            setLoading(true);
            const statusParam = filterStatus === 'ALL' ? 'ALL' : filterStatus;
            const response = await apiInstance.get(
                `/admin/instructor-requests/?status=${statusParam}`
            );

            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }

            setRequests(data);

            // If backend returned stats object, use it; otherwise compute from all
            if (response.data?.stats) {
                setLiveStats(response.data.stats);
            } else {
                // Fetch stats by getting ALL if needed, or update from current counts
                setLiveStats(prev => ({
                    ...prev,
                    [filterStatus.toLowerCase()]: data.length,
                    total: Math.max(prev.total, data.length)
                }));
            }
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
    }, [filterStatus]);

    // Separate call to fetch comprehensive stats across all statuses once on mount
    const fetchComprehensiveStats = useCallback(async () => {
        try {
            const res = await apiInstance.get('/admin/instructor-requests/?status=ALL');
            let allData = [];
            if (Array.isArray(res.data)) {
                allData = res.data;
            } else if (res.data?.results) {
                allData = res.data.results;
            }

            if (res.data?.stats) {
                setLiveStats(res.data.stats);
            } else {
                setLiveStats({
                    pending: allData.filter(r => r.status === 'PENDING').length,
                    approved: allData.filter(r => r.status === 'APPROVED').length,
                    rejected: allData.filter(r => r.status === 'REJECTED').length,
                    total: allData.length
                });
            }
        } catch (e) {
            console.error("Error fetching stats:", e);
        }
    }, []);

    useEffect(() => {
        fetchInstructorRequests();
    }, [fetchInstructorRequests]);

    useEffect(() => {
        fetchComprehensiveStats();
    }, [fetchComprehensiveStats]);

    // Handle approve
    const handleApproveRequest = async (request) => {
        const result = await Swal.fire({
            title: `Setujui Permintaan Instruktur?`,
            html: `
                <div class="text-start p-2" style="font-size: 0.9rem;">
                    <div class="mb-2"><strong>Nama:</strong> ${request.user_name || '-'}</div>
                    <div class="mb-2"><strong>Email:</strong> ${request.user_email || '-'}</div>
                    <div class="mb-2"><strong>Keahlian:</strong> ${request.expertise_areas || '-'}</div>
                    <div class="mb-2"><strong>Pengalaman:</strong> ${getExperienceLevelLabel(request.experience_level)}</div>
                    <div class="alert alert-info py-2 px-3 small mt-3 mb-0">
                        <i class="fas fa-info-circle me-1"></i> Pengguna akan langsung diberikan hak akses membuat dan mengelola kursus di portal LMS DPD RI.
                    </div>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0f766e",
            cancelButtonColor: "#64748b",
            confirmButtonText: '<i class="fas fa-check me-1"></i> Ya, Setujui',
            cancelButtonText: 'Batal'
        });

        if (result.isConfirmed) {
            try {
                await apiInstance.post(`/admin/instructor-request/${request.id}/approve/`);
                Toast().fire({
                    icon: "success",
                    title: "Permintaan Disetujui",
                    text: `"${request.user_name}" kini telah menjadi instruktur aktif.`
                });
                fetchInstructorRequests();
                fetchComprehensiveStats();
                if (typeof onCountsUpdated === 'function') {
                    onCountsUpdated();
                }
            } catch (error) {
                Toast().fire({
                    icon: "error",
                    title: "Gagal menyetujui permintaan",
                    text: error.response?.data?.detail || "Terjadi kesalahan"
                });
            }
        }
    };

    // Handle reject
    const handleRejectRequest = async (request) => {
        const { value: reason } = await Swal.fire({
            title: `Tolak Permintaan Instruktur?`,
            input: "textarea",
            inputLabel: "Alasan Penolakan (Minimal 10 Karakter)",
            inputPlaceholder: "Tuliskan alasan spesifik dan saran perbaikan kompetensi/dokumen...",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
            confirmButtonText: '<i class="fas fa-times me-1"></i> Tolak Permintaan',
            cancelButtonText: "Batal",
            inputValidator: (value) => {
                if (!value || value.trim().length < 10) {
                    return "Alasan penolakan minimal 10 karakter!";
                }
            }
        });

        if (reason) {
            try {
                await apiInstance.post(`/admin/instructor-request/${request.id}/reject/`, {
                    rejection_reason: reason
                });
                Toast().fire({
                    icon: "success",
                    title: "Permintaan Ditolak",
                    text: `Pemberitahuan penolakan tersimpan di sistem.`
                });
                fetchInstructorRequests();
                fetchComprehensiveStats();
                if (typeof onCountsUpdated === 'function') {
                    onCountsUpdated();
                }
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
        const map = {
            BEGINNER: 'Pemula (0-2 thn)',
            INTERMEDIATE: 'Menengah (2-5 thn)',
            ADVANCED: 'Lanjutan (5+ thn)'
        };
        return map[level] || level || 'Tidak Disebutkan';
    };

    // Client-side search and level filter
    const filteredRequests = useMemo(() => {
        return requests.filter((req) => {
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const name = (req.user_name || '').toLowerCase();
                const email = (req.user_email || '').toLowerCase();
                const nip = (req.user_nip || '').toLowerCase();
                const exp = (req.expertise_areas || '').toLowerCase();
                if (!name.includes(q) && !email.includes(q) && !nip.includes(q) && !exp.includes(q)) {
                    return false;
                }
            }
            if (levelFilter !== 'all') {
                if ((req.experience_level || '').toUpperCase() !== levelFilter.toUpperCase()) {
                    return false;
                }
            }
            return true;
        });
    }, [requests, searchTerm, levelFilter]);

    return (
        <div className="cm-tab-content cm-requests-v2">
            {/* 1. Header Bar with Live KPIs */}
            <div className="cm-compact-header-card mb-3">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <div className="cm-header-icon-box bg-amber-subtle text-warning">
                            <i className="fas fa-user-tie"></i>
                        </div>
                        <div>
                            <h3 className="cm-module-title mb-0">Permintaan Menjadi Instruktur</h3>
                            <p className="cm-module-desc mb-0">Tinjau, verifikasi kelayakan aparatur, dan terbitkan izin mengajar kursus pada portal LMS DPD RI</p>
                        </div>
                    </div>

                    {/* Live KPI Chips */}
                    <div className="cm-kpi-chips-row">
                        <div className="cm-kpi-chip" title="Total seluruh permohonan instruktur">
                            <i className="fas fa-users text-primary"></i>
                            <span className="cm-kpi-label">Total:</span>
                            <span className="cm-kpi-value">{liveStats.total}</span>
                        </div>
                        <div className={`cm-kpi-chip ${liveStats.pending > 0 ? 'cm-kpi-amber' : ''}`} title="Permohonan menunggu tinjauan admin">
                            <i className="fas fa-clock text-warning"></i>
                            <span className="cm-kpi-label">Tertunda:</span>
                            <span className="cm-kpi-value">{liveStats.pending}</span>
                        </div>
                        <div className="cm-kpi-chip" title="Instruktur telah disetujui">
                            <i className="fas fa-user-check text-success"></i>
                            <span className="cm-kpi-label">Disetujui:</span>
                            <span className="cm-kpi-value">{liveStats.approved}</span>
                        </div>
                        <div className="cm-kpi-chip" title="Permohonan ditolak">
                            <i className="fas fa-user-times text-danger"></i>
                            <span className="cm-kpi-label">Ditolak:</span>
                            <span className="cm-kpi-value">{liveStats.rejected}</span>
                        </div>
                        <button
                            type="button"
                            className="cm-btn-mini-refresh"
                            onClick={() => {
                                fetchInstructorRequests();
                                fetchComprehensiveStats();
                            }}
                            disabled={loading}
                            title="Segarkan data permohonan"
                        >
                            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Compact Control Toolbar: Status Pills + Search + Filters */}
            <div className="cm-toolbar-card mb-3">
                <div className="row g-2 align-items-center">
                    {/* Status Segmented Buttons */}
                    <div className="col-12 col-md-auto">
                        <div className="cm-segmented-pills">
                            <button
                                type="button"
                                className={`cm-seg-btn ${filterStatus === 'PENDING' ? 'active' : ''}`}
                                onClick={() => setFilterStatus('PENDING')}
                            >
                                <i className="fas fa-hourglass-half me-1"></i>
                                Tertunda
                                <span className={`cm-pill-count ${liveStats.pending > 0 ? 'pulse-amber' : ''}`}>
                                    {liveStats.pending}
                                </span>
                            </button>
                            <button
                                type="button"
                                className={`cm-seg-btn ${filterStatus === 'APPROVED' ? 'active' : ''}`}
                                onClick={() => setFilterStatus('APPROVED')}
                            >
                                <i className="fas fa-check-circle me-1"></i>
                                Disetujui
                                <span className="cm-pill-count">
                                    {liveStats.approved}
                                </span>
                            </button>
                            <button
                                type="button"
                                className={`cm-seg-btn ${filterStatus === 'REJECTED' ? 'active' : ''}`}
                                onClick={() => setFilterStatus('REJECTED')}
                            >
                                <i className="fas fa-times-circle me-1"></i>
                                Ditolak
                                <span className="cm-pill-count">
                                    {liveStats.rejected}
                                </span>
                            </button>
                            <button
                                type="button"
                                className={`cm-seg-btn ${filterStatus === 'ALL' ? 'active' : ''}`}
                                onClick={() => setFilterStatus('ALL')}
                            >
                                <i className="fas fa-layer-group me-1"></i>
                                Semua
                                <span className="cm-pill-count">
                                    {liveStats.total}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Search Field */}
                    <div className="col-12 col-sm-6 col-md">
                        <div className="cm-search-box">
                            <i className="fas fa-search cm-search-icon"></i>
                            <input
                                type="text"
                                className="form-control cm-input-compact"
                                placeholder="Cari nama pemohon, NIP, email, atau bidang keahlian..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    className="cm-search-clear"
                                    onClick={() => setSearchTerm('')}
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Experience Level Filter */}
                    <div className="col-6 col-sm-3 col-md-auto">
                        <select
                            className="form-select cm-select-compact"
                            value={levelFilter}
                            onChange={(e) => setLevelFilter(e.target.value)}
                            title="Filter Tingkat Pengalaman"
                        >
                            <option value="all">Semua Pengalaman</option>
                            <option value="BEGINNER">Pemula (0-2 thn)</option>
                            <option value="INTERMEDIATE">Menengah (2-5 thn)</option>
                            <option value="ADVANCED">Lanjutan (5+ thn)</option>
                        </select>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="col-auto ms-auto d-none d-sm-block">
                        <div className="btn-group btn-group-sm">
                            <button
                                type="button"
                                className={`btn btn-outline-secondary ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Tampilan Kartu Kompak"
                            >
                                <i className="fas fa-th-large"></i>
                            </button>
                            <button
                                type="button"
                                className={`btn btn-outline-secondary ${viewMode === 'table' ? 'active' : ''}`}
                                onClick={() => setViewMode('table')}
                                title="Tampilan Tabel Rapat"
                            >
                                <i className="fas fa-list"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Content Area */}
            {loading ? (
                <div className="cm-loading-box py-5 text-center">
                    <div className="spinner-border text-teal spinner-border-sm me-2" role="status"></div>
                    <span className="text-muted small fw-semibold">Memuat data permohonan instruktur...</span>
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="cm-empty-box py-4 text-center">
                    <div className="cm-empty-icon mb-2">
                        <i className="fas fa-inbox"></i>
                    </div>
                    <h5 className="cm-empty-title mb-1">Tidak Ada Permintaan</h5>
                    <p className="cm-empty-text text-muted small mb-0">
                        {searchTerm || levelFilter !== 'all'
                            ? 'Tidak ada permohonan yang sesuai dengan filter pencarian Anda.'
                            : filterStatus === 'PENDING'
                                ? 'Tidak ada permohonan instruktur yang tertunda saat ini. Semua pengajuan telah diproses.'
                                : `Tidak ada permohonan instruktur dengan status ${filterStatus.toLowerCase()}.`}
                    </p>
                </div>
            ) : viewMode === 'grid' ? (
                /* Compact Grid View */
                <div className="cm-requests-grid">
                    {filteredRequests.map((request) => {
                        const isPending = request.status === 'PENDING';
                        const isApproved = request.status === 'APPROVED';
                        const isRejected = request.status === 'REJECTED';

                        return (
                            <div
                                key={request.id}
                                className={`cm-req-card ${isPending ? 'card-status-pending' : isApproved ? 'card-status-approved' : 'card-status-rejected'}`}
                            >
                                {/* Compact Card Top Strip */}
                                <div className="cm-req-card-header">
                                    <div className="cm-req-avatar-box">
                                        {request.user_image ? (
                                            <img
                                                src={request.user_image}
                                                alt={request.user_name}
                                                className="cm-req-avatar-img"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.style.display = 'none';
                                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className="cm-req-avatar-fallback"
                                            style={{ display: request.user_image ? 'none' : 'flex' }}
                                        >
                                            {(request.user_name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                    </div>

                                    <div className="cm-req-user-meta">
                                        <div className="d-flex align-items-center justify-content-between gap-1">
                                            <h4 className="cm-req-name text-truncate mb-0" title={request.user_name}>
                                                {request.user_name}
                                            </h4>
                                            <span className={`cm-badge-status ${isPending ? 'badge-amber' : isApproved ? 'badge-emerald' : 'badge-rose'}`}>
                                                {isPending ? 'Tertunda' : isApproved ? 'Disetujui' : 'Ditolak'}
                                            </span>
                                        </div>
                                        <div className="cm-req-nip text-truncate">
                                            <i className="fas fa-id-badge text-muted me-1"></i>
                                            <span>NIP: {request.user_nip || 'Belum diisi'}</span>
                                        </div>
                                        <div className="cm-req-email text-truncate" title={request.user_email}>
                                            <i className="fas fa-envelope text-muted me-1"></i>
                                            <span>{request.user_email || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Compact Expertise & Level */}
                                <div className="cm-req-body">
                                    <div className="cm-req-meta-row">
                                        <span className="cm-req-meta-label">
                                            <i className="fas fa-lightbulb text-warning me-1"></i>Keahlian:
                                        </span>
                                        <span className="cm-req-meta-value text-truncate" title={request.expertise_areas}>
                                            {request.expertise_areas || '-'}
                                        </span>
                                    </div>

                                    <div className="cm-req-meta-row">
                                        <span className="cm-req-meta-label">
                                            <i className="fas fa-chart-line text-teal me-1"></i>Tingkat:
                                        </span>
                                        <span className="badge bg-light text-dark border cm-level-badge">
                                            {getExperienceLevelLabel(request.experience_level)}
                                        </span>
                                    </div>

                                    {/* Compact Bio Preview */}
                                    <div className="cm-req-bio-box">
                                        <p className="cm-req-bio-text mb-0">
                                            {request.bio || 'Tidak ada biografi singkat.'}
                                        </p>
                                        {request.bio && request.bio.length > 90 && (
                                            <button
                                                type="button"
                                                className="btn-link cm-bio-more-btn"
                                                onClick={() => setActiveBioModal(request)}
                                            >
                                                Selengkapnya
                                            </button>
                                        )}
                                    </div>

                                    {/* Review info if approved/rejected */}
                                    {!isPending && request.reviewed_date && (
                                        <div className={`cm-review-info-strip ${isApproved ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
                                            <i className={`fas ${isApproved ? 'fa-check-circle' : 'fa-times-circle'} me-1`}></i>
                                            <span>
                                                {isApproved ? 'Disetujui' : 'Ditolak'} oleh <strong>{request.reviewed_by_name || 'Admin'}</strong> ({new Date(request.reviewed_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })})
                                            </span>
                                        </div>
                                    )}

                                    {/* Rejection reason if available */}
                                    {isRejected && request.rejection_reason && (
                                        <div className="cm-rejection-reason-strip">
                                            <span className="text-danger fw-semibold d-block tiny mb-0.5">Alasan Penolakan:</span>
                                            <p className="tiny text-muted mb-0 font-italic text-truncate" title={request.rejection_reason}>
                                                "{request.rejection_reason}"
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Compact Footer */}
                                <div className="cm-req-card-footer">
                                    <span className="cm-req-date" title={request.request_date}>
                                        <i className="far fa-calendar-alt me-1"></i>
                                        {new Date(request.request_date).toLocaleDateString('id-ID', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </span>

                                    {isPending ? (
                                        <div className="cm-req-actions">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger cm-btn-action"
                                                onClick={() => handleRejectRequest(request)}
                                                title="Tolak permohonan instruktur"
                                            >
                                                <i className="fas fa-times me-1"></i>Tolak
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-teal cm-btn-action"
                                                onClick={() => handleApproveRequest(request)}
                                                title="Setujui permohonan instruktur"
                                            >
                                                <i className="fas fa-check me-1"></i>Setujui
                                            </button>
                                        </div>
                                    ) : (
                                        <span className={`tiny fw-semibold ${isApproved ? 'text-success' : 'text-danger'}`}>
                                            <i className={`fas ${isApproved ? 'fa-user-check' : 'fa-ban'} me-1`}></i>
                                            {isApproved ? 'Instruktur Aktif' : 'Berkas Selesai'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Compact Table View */
                <div className="cm-table-responsive">
                    <table className="table table-hover cm-dense-table mb-0">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>#</th>
                                <th>Pemohon Instruktur</th>
                                <th>NIP</th>
                                <th>Bidang Keahlian</th>
                                <th>Pengalaman</th>
                                <th>Tgl Pengajuan</th>
                                <th>Status</th>
                                <th style={{ width: '140px' }} className="text-end">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.map((request, idx) => {
                                const isPending = request.status === 'PENDING';
                                const isApproved = request.status === 'APPROVED';
                                return (
                                    <tr key={request.id}>
                                        <td className="text-muted small">{idx + 1}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="cm-table-avatar">
                                                    {(request.user_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="cm-table-userinfo">
                                                    <strong className="d-block text-dark small">{request.user_name}</strong>
                                                    <span className="text-muted tiny d-block">{request.user_email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-muted small font-monospace">
                                            {request.user_nip || '-'}
                                        </td>
                                        <td>
                                            <span className="small text-dark text-truncate d-block" style={{ maxWidth: '180px' }} title={request.expertise_areas}>
                                                {request.expertise_areas || '-'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-dark border">
                                                {getExperienceLevelLabel(request.experience_level)}
                                            </span>
                                        </td>
                                        <td className="text-muted tiny">
                                            {new Date(request.request_date).toLocaleDateString('id-ID', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </td>
                                        <td>
                                            <span className={`cm-badge-status ${isPending ? 'badge-amber' : isApproved ? 'badge-emerald' : 'badge-rose'}`}>
                                                {isPending ? 'Tertunda' : isApproved ? 'Disetujui' : 'Ditolak'}
                                            </span>
                                        </td>
                                        <td className="text-end">
                                            {isPending ? (
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-success btn-xs"
                                                        onClick={() => handleApproveRequest(request)}
                                                        title="Setujui"
                                                    >
                                                        <i className="fas fa-check"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger btn-xs"
                                                        onClick={() => handleRejectRequest(request)}
                                                        title="Tolak"
                                                    >
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary btn-xs"
                                                    onClick={() => setActiveBioModal(request)}
                                                    title="Lihat Detail Pengajuan"
                                                >
                                                    <i className="fas fa-eye me-1"></i>Detail
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 4. Full Bio & Detail Modal */}
            {activeBioModal && (
                <div className="cm-modal-backdrop" onClick={() => setActiveBioModal(null)}>
                    <div className="cm-modal-dialog-compact" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-header-compact">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fas fa-user-circle text-teal"></i>
                                <h5 className="mb-0 fw-bold">Detail Permohonan Instruktur</h5>
                            </div>
                            <button
                                type="button"
                                className="cm-modal-close-btn"
                                onClick={() => setActiveBioModal(null)}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="cm-modal-body-compact">
                            <div className="d-flex align-items-center gap-3 p-2.5 rounded bg-light border mb-3">
                                <div className="cm-req-avatar-fallback" style={{ width: '48px', height: '48px', fontSize: '1.2rem' }}>
                                    {(activeBioModal.user_name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h5 className="fw-bold mb-0.5 text-dark">{activeBioModal.user_name}</h5>
                                    <span className="text-muted small d-block">{activeBioModal.user_email} &bull; NIP: {activeBioModal.user_nip || '-'}</span>
                                    <span className={`cm-badge-status ${activeBioModal.status === 'PENDING' ? 'badge-amber' : activeBioModal.status === 'APPROVED' ? 'badge-emerald' : 'badge-rose'} mt-1`}>
                                        {activeBioModal.status}
                                    </span>
                                </div>
                            </div>

                            <div className="mb-2.5">
                                <strong className="small text-dark d-block mb-1">
                                    <i className="fas fa-lightbulb text-warning me-1"></i> Bidang Keahlian:
                                </strong>
                                <p className="small text-muted p-2 rounded bg-light border mb-0">
                                    {activeBioModal.expertise_areas || '-'}
                                </p>
                            </div>

                            <div className="mb-2.5">
                                <strong className="small text-dark d-block mb-1">
                                    <i className="fas fa-chart-line text-teal me-1"></i> Tingkat Pengalaman:
                                </strong>
                                <p className="small text-muted p-2 rounded bg-light border mb-0">
                                    {getExperienceLevelLabel(activeBioModal.experience_level)}
                                </p>
                            </div>

                            <div className="mb-2.5">
                                <strong className="small text-dark d-block mb-1">
                                    <i className="fas fa-align-left text-primary me-1"></i> Biografi & Portofolio:
                                </strong>
                                <p className="small text-muted p-2 rounded bg-light border mb-0" style={{ maxHeight: '160px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                                    {activeBioModal.bio || 'Tidak ada biografi yang dilampirkan.'}
                                </p>
                            </div>

                            {activeBioModal.rejection_reason && (
                                <div className="p-2.5 rounded bg-danger-subtle border border-danger">
                                    <strong className="small text-danger d-block mb-1">
                                        <i className="fas fa-ban me-1"></i> Alasan Penolakan:
                                    </strong>
                                    <p className="small text-dark mb-0 font-italic">
                                        "{activeBioModal.rejection_reason}"
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="cm-modal-footer-compact">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setActiveBioModal(null)}
                            >
                                Tutup
                            </button>
                            {activeBioModal.status === 'PENDING' && (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => {
                                            const req = activeBioModal;
                                            setActiveBioModal(null);
                                            handleRejectRequest(req);
                                        }}
                                    >
                                        Tolak
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-teal"
                                        onClick={() => {
                                            const req = activeBioModal;
                                            setActiveBioModal(null);
                                            handleApproveRequest(req);
                                        }}
                                    >
                                        Setujui
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default React.memo(InstructorRequestsTab);
