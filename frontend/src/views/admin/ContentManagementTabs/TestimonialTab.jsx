import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import apiInstance from '../../../utils/axios';
import Toast from '../../plugin/Toast';

/**
 * Redesigned Compact & Live Testimonial Curation Tab
 * Setjen DPD RI Learning Platform
 */
function TestimonialTab({ onCountsUpdated }) {
    const [pendingTestimonials, setPendingTestimonials] = useState([]);
    const [approvedTestimonials, setApprovedTestimonials] = useState([]);
    const [activeSubTab, setActiveSubTab] = useState('pending'); // 'pending' | 'approved' | 'all'
    const [loadingPending, setLoadingPending] = useState(true);
    const [loadingApproved, setLoadingApproved] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [selectedTestimonial, setSelectedTestimonial] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [ratingFilter, setRatingFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

    // Fetch pending testimonials
    const fetchPendingTestimonials = useCallback(async () => {
        setLoadingPending(true);
        try {
            const res = await apiInstance.get('/admin/testimonials/pending/');
            const data = res.data?.results || (Array.isArray(res.data) ? res.data : []);
            setPendingTestimonials(data);
        } catch (err) {
            console.error('Error fetching pending testimonials:', err);
            Toast().fire({
                icon: 'error',
                title: 'Gagal memuat testimoni pending',
                timer: 2000,
            });
        } finally {
            setLoadingPending(false);
        }
    }, []);

    // Fetch approved testimonials
    const fetchApprovedTestimonials = useCallback(async () => {
        setLoadingApproved(true);
        try {
            const res = await apiInstance.get('/admin/testimonials/approved/');
            const data = res.data?.results || (Array.isArray(res.data) ? res.data : []);
            setApprovedTestimonials(data);
        } catch (err) {
            console.error('Error fetching approved testimonials:', err);
            Toast().fire({
                icon: 'error',
                title: 'Gagal memuat testimoni disetujui',
                timer: 2000,
            });
        } finally {
            setLoadingApproved(false);
        }
    }, []);

    const fetchAllData = useCallback(() => {
        fetchPendingTestimonials();
        fetchApprovedTestimonials();
    }, [fetchPendingTestimonials, fetchApprovedTestimonials]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Handle approve action
    const handleApprove = async (testimonialId) => {
        setProcessingId(testimonialId);
        try {
            await apiInstance.patch(`/admin/testimonials/${testimonialId}/approve-reject/`, {
                action: 'approve'
            });
            Toast().fire({
                icon: 'success',
                title: 'Testimoni berhasil disetujui',
                timer: 2000,
            });
            // Re-fetch both so approved list receives it and counters update
            fetchAllData();
            if (typeof onCountsUpdated === 'function') {
                onCountsUpdated();
            }
        } catch (err) {
            console.error('Error approving testimonial:', err);
            Toast().fire({
                icon: 'error',
                title: 'Gagal menyetujui testimoni',
                timer: 2000,
            });
        } finally {
            setProcessingId(null);
        }
    };

    // Open reject modal
    const handleRejectClick = (testimonial) => {
        setSelectedTestimonial(testimonial);
        setRejectionReason('');
        setShowRejectionModal(true);
    };

    // Confirm reject
    const handleConfirmReject = async () => {
        if (!selectedTestimonial) return;
        setProcessingId(selectedTestimonial.id);
        try {
            await apiInstance.patch(`/admin/testimonials/${selectedTestimonial.id}/approve-reject/`, {
                action: 'reject',
                reason: rejectionReason
            });
            Toast().fire({
                icon: 'success',
                title: 'Testimoni berhasil ditolak',
                timer: 2000,
            });
            setShowRejectionModal(false);
            fetchAllData();
            if (typeof onCountsUpdated === 'function') {
                onCountsUpdated();
            }
        } catch (err) {
            console.error('Error rejecting testimonial:', err);
            Toast().fire({
                icon: 'error',
                title: 'Gagal menolak testimoni',
                timer: 2000,
            });
        } finally {
            setProcessingId(null);
            setSelectedTestimonial(null);
        }
    };

    // Quick reject templates
    const quickReasons = [
        'Ulasan tidak relevan dengan materi pembelajaran',
        'Mengandung bahasa yang kurang pantas',
        'Duplikasi pengajuan ulasan',
        'Informasi identitas tidak sesuai data kepegawaian'
    ];

    // Combine for 'all' tab
    const allTestimonials = useMemo(() => {
        return [...pendingTestimonials, ...approvedTestimonials].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );
    }, [pendingTestimonials, approvedTestimonials]);

    // Compute live stats
    const liveStats = useMemo(() => {
        const total = allTestimonials.length;
        const pending = pendingTestimonials.length;
        const approved = approvedTestimonials.length;
        const sumRatings = allTestimonials.reduce((sum, item) => sum + (Number(item.rating) || 5), 0);
        const avgRating = total > 0 ? (sumRatings / total).toFixed(1) : '5.0';
        return { total, pending, approved, avgRating };
    }, [allTestimonials, pendingTestimonials, approvedTestimonials]);

    // Active dataset based on subtab
    const currentDataset = useMemo(() => {
        if (activeSubTab === 'pending') return pendingTestimonials;
        if (activeSubTab === 'approved') return approvedTestimonials;
        return allTestimonials;
    }, [activeSubTab, pendingTestimonials, approvedTestimonials, allTestimonials]);

    // Filtered by search, rating, and role
    const filteredTestimonials = useMemo(() => {
        return currentDataset.filter((item) => {
            // Search filter
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const name = (item.full_name || '').toLowerCase();
                const email = (item.email || '').toLowerCase();
                const text = (item.review || '').toLowerCase();
                const pos = (item.position || '').toLowerCase();
                if (!name.includes(q) && !email.includes(q) && !text.includes(q) && !pos.includes(q)) {
                    return false;
                }
            }
            // Rating filter
            if (ratingFilter !== 'all') {
                if (Math.floor(item.rating) !== Number(ratingFilter)) {
                    return false;
                }
            }
            // Role filter
            if (roleFilter !== 'all') {
                if ((item.role || '').toLowerCase() !== roleFilter.toLowerCase()) {
                    return false;
                }
            }
            return true;
        });
    }, [currentDataset, searchTerm, ratingFilter, roleFilter]);

    const isLoading = activeSubTab === 'pending' ? loadingPending : (activeSubTab === 'approved' ? loadingApproved : (loadingPending || loadingApproved));

    return (
        <div className="cm-tab-content cm-testimonials-v2">
            {/* 1. Compact Header Bar with Live KPIs */}
            <div className="cm-compact-header-card mb-3">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <div className="cm-header-icon-box bg-teal-subtle text-teal">
                            <i className="fas fa-comments"></i>
                        </div>
                        <div>
                            <h3 className="cm-module-title mb-0">Kurasi Testimoni Pegawai & Peserta</h3>
                            <p className="cm-module-desc mb-0">Moderasi dan seleksi ulasan apresiasi pembelajaran untuk tayang di portal publik LMS DPD RI</p>
                        </div>
                    </div>

                    {/* Live KPI Chips */}
                    <div className="cm-kpi-chips-row">
                        <div className="cm-kpi-chip" title="Total seluruh ulasan testimoni">
                            <i className="fas fa-list-alt text-primary"></i>
                            <span className="cm-kpi-label">Total:</span>
                            <span className="cm-kpi-value">{liveStats.total}</span>
                        </div>
                        <div className={`cm-kpi-chip ${liveStats.pending > 0 ? 'cm-kpi-amber' : ''}`} title="Testimoni menunggu kurasi persetujuan">
                            <i className="fas fa-hourglass-half text-warning"></i>
                            <span className="cm-kpi-label">Tertunda:</span>
                            <span className="cm-kpi-value">{liveStats.pending}</span>
                        </div>
                        <div className="cm-kpi-chip" title="Testimoni disetujui tayang">
                            <i className="fas fa-check-circle text-success"></i>
                            <span className="cm-kpi-label">Disetujui:</span>
                            <span className="cm-kpi-value">{liveStats.approved}</span>
                        </div>
                        <div className="cm-kpi-chip" title="Rata-rata rating kepuasan peserta">
                            <i className="fas fa-star text-warning"></i>
                            <span className="cm-kpi-label">Skor:</span>
                            <span className="cm-kpi-value">{liveStats.avgRating}/5.0</span>
                        </div>
                        <button
                            type="button"
                            className="cm-btn-mini-refresh"
                            onClick={fetchAllData}
                            disabled={isLoading}
                            title="Segarkan data testimoni real-time"
                        >
                            <i className={`fas fa-sync-alt ${isLoading ? 'fa-spin' : ''}`}></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Compact Control Toolbar: Subtabs + Filters + View Toggle */}
            <div className="cm-toolbar-card mb-3">
                <div className="row g-2 align-items-center">
                    {/* Subtab Segmented Controls */}
                    <div className="col-12 col-md-auto">
                        <div className="cm-segmented-pills">
                            <button
                                type="button"
                                className={`cm-seg-btn ${activeSubTab === 'pending' ? 'active' : ''}`}
                                onClick={() => setActiveSubTab('pending')}
                            >
                                <i className="fas fa-clock me-1"></i>
                                Tertunda
                                <span className={`cm-pill-count ${liveStats.pending > 0 ? 'pulse-amber' : ''}`}>
                                    {liveStats.pending}
                                </span>
                            </button>
                            <button
                                type="button"
                                className={`cm-seg-btn ${activeSubTab === 'approved' ? 'active' : ''}`}
                                onClick={() => setActiveSubTab('approved')}
                            >
                                <i className="fas fa-check me-1"></i>
                                Disetujui
                                <span className="cm-pill-count">
                                    {liveStats.approved}
                                </span>
                            </button>
                            <button
                                type="button"
                                className={`cm-seg-btn ${activeSubTab === 'all' ? 'active' : ''}`}
                                onClick={() => setActiveSubTab('all')}
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
                                placeholder="Cari nama, email, jabatan, atau teks ulasan..."
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

                    {/* Rating Filter */}
                    <div className="col-6 col-sm-3 col-md-auto">
                        <select
                            className="form-select cm-select-compact"
                            value={ratingFilter}
                            onChange={(e) => setRatingFilter(e.target.value)}
                            title="Filter Berdasarkan Bintang"
                        >
                            <option value="all">Semua Bintang</option>
                            <option value="5">⭐⭐⭐⭐⭐ (5 Bintang)</option>
                            <option value="4">⭐⭐⭐⭐ (4 Bintang)</option>
                            <option value="3">⭐⭐⭐ (3 Bintang)</option>
                            <option value="2">⭐⭐ (2 Bintang)</option>
                            <option value="1">⭐ (1 Bintang)</option>
                        </select>
                    </div>

                    {/* Role Filter */}
                    <div className="col-6 col-sm-3 col-md-auto">
                        <select
                            className="form-select cm-select-compact"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            title="Filter Berdasarkan Peran"
                        >
                            <option value="all">Semua Peran</option>
                            <option value="student">Peserta</option>
                            <option value="instructor">Instruktur</option>
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
            {isLoading ? (
                <div className="cm-loading-box py-5 text-center">
                    <div className="spinner-border text-teal spinner-border-sm me-2" role="status"></div>
                    <span className="text-muted small fw-semibold">Memuat ulasan testimoni live...</span>
                </div>
            ) : filteredTestimonials.length === 0 ? (
                <div className="cm-empty-box py-4 text-center">
                    <div className="cm-empty-icon mb-2">
                        <i className="fas fa-comment-slash"></i>
                    </div>
                    <h5 className="cm-empty-title mb-1">Tidak Ada Ulasan Testimoni</h5>
                    <p className="cm-empty-text text-muted small mb-0">
                        {searchTerm || ratingFilter !== 'all' || roleFilter !== 'all'
                            ? 'Tidak ada testimoni yang sesuai dengan kriteria pencarian/filter Anda.'
                            : activeSubTab === 'pending'
                            ? 'Semua pengajuan testimoni telah ditinjau dan tidak ada yang menunggu persetujuan.'
                            : 'Belum ada data ulasan testimoni pada kategori ini.'}
                    </p>
                </div>
            ) : viewMode === 'grid' ? (
                /* Compact Grid View */
                <div className="cm-testimonials-grid">
                    {filteredTestimonials.map((item) => {
                        const isPending = !item.active;
                        const isProc = processingId === item.id;
                        return (
                            <div key={item.id} className={`cm-t-card ${isPending ? 'border-pending' : 'border-approved'}`}>
                                {/* Card Header */}
                                <div className="cm-t-card-header">
                                    <div className="cm-t-avatar-box">
                                        {item.image ? (
                                            <img
                                                src={item.image}
                                                alt={item.full_name}
                                                className="cm-t-avatar-img"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.style.display = 'none';
                                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className="cm-t-avatar-fallback"
                                            style={{ display: item.image ? 'none' : 'flex' }}
                                        >
                                            {(item.full_name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                    </div>

                                    <div className="cm-t-user-meta">
                                        <div className="d-flex align-items-center justify-content-between gap-1">
                                            <h4 className="cm-t-name text-truncate mb-0" title={item.full_name}>
                                                {item.full_name || 'Anonim'}
                                            </h4>
                                            <span className={`cm-badge-status ${isPending ? 'badge-amber' : 'badge-emerald'}`}>
                                                {isPending ? 'Menunggu' : 'Disetujui'}
                                            </span>
                                        </div>
                                        <div className="cm-t-subinfo text-truncate">
                                            <span>{item.position || 'Aparatur Sipil'}</span>
                                            {item.golongan && <span className="ms-1 text-muted">({item.golongan})</span>}
                                        </div>
                                        <div className="cm-t-email text-truncate" title={item.email}>
                                            <i className="fas fa-envelope me-1 text-muted"></i>
                                            {item.email || 'Tidak ada email'}
                                        </div>
                                    </div>
                                </div>

                                {/* Rating & Meta */}
                                <div className="cm-t-rating-strip">
                                    <div className="cm-stars">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <i
                                                key={star}
                                                className={`fas fa-star ${star <= item.rating ? 'star-filled' : 'star-empty'}`}
                                            ></i>
                                        ))}
                                        <span className="cm-star-score ms-1">{item.rating}.0</span>
                                    </div>
                                    <div className="cm-t-role-tag">
                                        <i className={`fas ${item.role === 'instructor' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'} me-1`}></i>
                                        <span>{item.role === 'instructor' ? 'Instruktur' : 'Peserta'}</span>
                                    </div>
                                </div>

                                {/* Review Text Bubble */}
                                <div className="cm-t-quote-box">
                                    <i className="fas fa-quote-left cm-quote-icon me-1"></i>
                                    <p className="cm-t-quote-text mb-0">{item.review}</p>
                                </div>

                                {/* Card Footer: Date & Actions */}
                                <div className="cm-t-card-footer">
                                    <span className="cm-t-date" title={item.date}>
                                        <i className="far fa-calendar-alt me-1"></i>
                                        {new Date(item.date).toLocaleDateString('id-ID', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </span>

                                    {isPending ? (
                                        <div className="cm-t-actions">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger cm-btn-action"
                                                onClick={() => handleRejectClick(item)}
                                                disabled={isProc}
                                                title="Tolak ulasan testimoni"
                                            >
                                                <i className="fas fa-times me-1"></i>Tolak
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-teal cm-btn-action"
                                                onClick={() => handleApprove(item.id)}
                                                disabled={isProc}
                                                title="Setujui ulasan untuk tayang di portal publik"
                                            >
                                                {isProc ? (
                                                    <span className="spinner-border spinner-border-sm me-1"></span>
                                                ) : (
                                                    <i className="fas fa-check me-1"></i>
                                                )}
                                                Setujui
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="cm-t-approved-tag">
                                            <i className="fas fa-shield-check text-success me-1"></i>
                                            <span className="text-success small fw-semibold">Aktif di Beranda</span>
                                        </div>
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
                                <th>Profil Pegawai</th>
                                <th>Peran</th>
                                <th>Rating</th>
                                <th>Ulasan Testimoni</th>
                                <th>Tanggal</th>
                                <th>Status</th>
                                <th style={{ width: '130px' }} className="text-end">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTestimonials.map((item, idx) => {
                                const isPending = !item.active;
                                const isProc = processingId === item.id;
                                return (
                                    <tr key={item.id}>
                                        <td className="text-muted small">{idx + 1}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="cm-table-avatar">
                                                    {(item.full_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="cm-table-userinfo">
                                                    <strong className="d-block text-dark small">{item.full_name}</strong>
                                                    <span className="text-muted tiny d-block">{item.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-dark border">
                                                {item.role === 'instructor' ? 'Instruktur' : 'Peserta'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center gap-1 text-warning small">
                                                <i className="fas fa-star"></i>
                                                <strong className="text-dark">{item.rating}.0</strong>
                                            </div>
                                        </td>
                                        <td>
                                            <p className="cm-table-review-text mb-0 text-truncate" style={{ maxWidth: '320px' }} title={item.review}>
                                                "{item.review}"
                                            </p>
                                        </td>
                                        <td className="text-muted tiny">
                                            {new Date(item.date).toLocaleDateString('id-ID', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </td>
                                        <td>
                                            <span className={`cm-badge-status ${isPending ? 'badge-amber' : 'badge-emerald'}`}>
                                                {isPending ? 'Menunggu' : 'Aktif'}
                                            </span>
                                        </td>
                                        <td className="text-end">
                                            {isPending ? (
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-success btn-xs"
                                                        onClick={() => handleApprove(item.id)}
                                                        disabled={isProc}
                                                        title="Setujui"
                                                    >
                                                        <i className="fas fa-check"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger btn-xs"
                                                        onClick={() => handleRejectClick(item)}
                                                        disabled={isProc}
                                                        title="Tolak"
                                                    >
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-success tiny fw-semibold">
                                                    <i className="fas fa-check-circle me-1"></i>Live
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 4. Sleek Rejection Modal */}
            {showRejectionModal && selectedTestimonial && (
                <div className="cm-modal-backdrop" onClick={() => setShowRejectionModal(false)}>
                    <div className="cm-modal-dialog-compact" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-header-compact">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fas fa-comment-slash text-danger"></i>
                                <h5 className="mb-0 fw-bold">Tolak Ulasan Testimoni</h5>
                            </div>
                            <button
                                type="button"
                                className="cm-modal-close-btn"
                                onClick={() => setShowRejectionModal(false)}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="cm-modal-body-compact">
                            <div className="cm-reject-preview p-2 rounded bg-light border mb-2.5">
                                <div className="d-flex align-items-center justify-content-between mb-1">
                                    <strong className="small text-dark">{selectedTestimonial.full_name}</strong>
                                    <span className="tiny text-warning">⭐ {selectedTestimonial.rating}.0</span>
                                </div>
                                <p className="small text-muted mb-0 font-italic">"{selectedTestimonial.review}"</p>
                            </div>

                            <label className="form-label small fw-semibold text-dark mb-1">
                                Alasan Penolakan (Akan disimpan untuk catatan kurasi):
                            </label>
                            
                            {/* Preset Buttons */}
                            <div className="d-flex flex-wrap gap-1 mb-2">
                                {quickReasons.map((reason, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className="btn btn-xs btn-outline-secondary"
                                        onClick={() => setRejectionReason(reason)}
                                    >
                                        + {reason}
                                    </button>
                                ))}
                            </div>

                            <textarea
                                className="form-control cm-input-compact"
                                placeholder="Tuliskan alasan penolakan secara spesifik..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                rows={3}
                            />
                        </div>
                        <div className="cm-modal-footer-compact">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setShowRejectionModal(false)}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={handleConfirmReject}
                                disabled={processingId !== null}
                            >
                                {processingId !== null ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-1"></span>
                                        Memproses...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-ban me-1"></i>
                                        Konfirmasi Tolak
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

export default memo(TestimonialTab);
