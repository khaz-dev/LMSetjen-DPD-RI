import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import Swal from 'sweetalert2';
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
    const [previewTestimonial, setPreviewTestimonial] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [ratingFilter, setRatingFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

    // Multi-select & Bulk Moderation state
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkProcessing, setBulkProcessing] = useState(false);

    // Close preview drawer / modals on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setPreviewTestimonial(null);
                setShowRejectionModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Clear selections when tab or filters change
    useEffect(() => {
        setSelectedIds([]);
    }, [activeSubTab, searchTerm, ratingFilter, roleFilter]);

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

    // Handle approve action with SweetAlert2 confirmation
    const handleApprove = async (itemOrId) => {
        const item = typeof itemOrId === 'object' && itemOrId !== null
            ? itemOrId
            : currentDataset.find(t => t.id === itemOrId);
        const testimonialId = item?.id || itemOrId;
        if (!testimonialId) return;

        const result = await Swal.fire({
            title: "Setujui Testimoni Ini?",
            html: `
                <div class="text-start" style="font-size: 0.88rem;">
                    <p class="mb-2">Anda akan menyetujui ulasan dari:</p>
                    <div class="p-2 rounded border bg-light mb-2">
                        <strong class="text-dark d-block">${item?.full_name || 'Pegawai'}</strong>
                        <span class="text-muted small">${item?.email || '-'} · ${item?.position || 'Peserta'}</span>
                    </div>
                    <div class="text-warning small mb-1">
                        ${"★".repeat(Math.round(item?.rating || 5))}${"☆".repeat(5 - Math.round(item?.rating || 5))} <b class="text-dark">(${item?.rating || 5}.0)</b>
                    </div>
                    <p class="small text-muted fst-italic mb-2">"${item?.review || '-'}"</p>
                    <div class="alert alert-info py-2 px-2 mb-0" style="font-size: 0.78rem;">
                        <i class="fas fa-info-circle me-1"></i> Ulasan ini akan langsung tampil di beranda dan halaman publik portal LMS Setjen DPD RI.
                    </div>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0d9488",
            cancelButtonColor: "#64748b",
            confirmButtonText: '<i class="fas fa-check-circle me-1"></i> Ya, Setujui & Terbitkan',
            cancelButtonText: "Batal",
            reverseButtons: true
        });

        if (!result.isConfirmed) return;

        setProcessingId(testimonialId);
        try {
            await apiInstance.patch(`/admin/testimonials/${testimonialId}/approve-reject/`, {
                action: 'approve'
            });
            Toast().fire({
                icon: 'success',
                title: 'Testimoni Berhasil Disetujui',
                text: `Ulasan dari ${item?.full_name || 'pegawai'} telah dipublikasikan.`
            });
            fetchAllData();
            if (typeof onCountsUpdated === 'function') {
                onCountsUpdated();
            }
        } catch (err) {
            console.error('Error approving testimonial:', err);
            Toast().fire({
                icon: 'error',
                title: 'Gagal menyetujui testimoni',
                text: err.response?.data?.detail || 'Terjadi kesalahan saat memproses persetujuan'
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
                title: 'Testimoni Berhasil Ditolak',
                text: `Ulasan dari ${selectedTestimonial.full_name} telah ditolak.`
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
                text: err.response?.data?.detail || 'Terjadi kesalahan saat memproses penolakan'
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

    // Multi-select & Bulk Moderation helpers
    const isAllSelected = useMemo(() => {
        return filteredTestimonials.length > 0 && filteredTestimonials.every(t => selectedIds.includes(t.id));
    }, [filteredTestimonials, selectedIds]);

    const isSomeSelected = useMemo(() => {
        return selectedIds.length > 0 && !isAllSelected;
    }, [selectedIds, isAllSelected]);

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredTestimonials.map(t => t.id));
        }
    };

    const handleToggleSelectOne = (id) => {
        if (!id) return;
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const selectedTestimonials = useMemo(() => {
        return currentDataset.filter(t => selectedIds.includes(t.id));
    }, [currentDataset, selectedIds]);

    const pendingInSelected = useMemo(() => {
        return selectedTestimonials.filter(t => !t.active);
    }, [selectedTestimonials]);

    const approvedInSelected = useMemo(() => {
        return selectedTestimonials.filter(t => t.active);
    }, [selectedTestimonials]);

    // Reset all search/rating/role filters
    const handleResetAllFilters = () => {
        setSearchTerm('');
        setRatingFilter('all');
        setRoleFilter('all');
    };

    const hasActiveFilters = useMemo(() => {
        return Boolean(searchTerm.trim() || ratingFilter !== 'all' || roleFilter !== 'all');
    }, [searchTerm, ratingFilter, roleFilter]);

    // Bulk Approve
    const handleBulkApprove = async () => {
        if (pendingInSelected.length === 0) {
            Toast().fire({
                icon: 'info',
                title: 'Tidak ada testimoni pending',
                text: 'Pilih testimoni berstatus menunggu untuk disetujui.'
            });
            return;
        }

        const result = await Swal.fire({
            title: `Setujui ${pendingInSelected.length} Testimoni Sekaligus?`,
            html: `
                <div class="text-start" style="font-size: 0.86rem;">
                    <p class="mb-2">Anda akan menyetujui & mempublikasikan <b>${pendingInSelected.length} ulasan testimoni</b> terpilih.</p>
                    <div class="alert alert-info py-2 px-2 mb-0" style="font-size: 0.78rem;">
                        <i class="fas fa-info-circle me-1"></i> Seluruh testimoni ini akan langsung aktif dan tampil di portal LMS Setjen DPD RI.
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#0d9488',
            cancelButtonColor: '#64748b',
            confirmButtonText: `<i class="fas fa-check-double me-1"></i> Ya, Setujui Semua (${pendingInSelected.length})`,
            cancelButtonText: 'Batal',
            reverseButtons: true
        });

        if (!result.isConfirmed) return;

        setBulkProcessing(true);
        let successCount = 0;

        for (const item of pendingInSelected) {
            try {
                await apiInstance.patch(`/admin/testimonials/${item.id}/approve-reject/`, {
                    action: 'approve'
                });
                successCount++;
            } catch (err) {
                console.error(`Error approving testimonial ${item.id}:`, err);
            }
        }

        setBulkProcessing(false);
        setSelectedIds([]);

        Toast().fire({
            icon: 'success',
            title: 'Persetujuan Massal Berhasil',
            text: `${successCount} testimoni berhasil disetujui & ditayangkan.`
        });

        fetchAllData();
        if (typeof onCountsUpdated === 'function') {
            onCountsUpdated();
        }
    };

    // Bulk Reject
    const handleBulkReject = async () => {
        if (pendingInSelected.length === 0) {
            Toast().fire({
                icon: 'info',
                title: 'Tidak ada testimoni pending',
                text: 'Pilih testimoni berstatus menunggu untuk ditolak.'
            });
            return;
        }

        const { value: reason } = await Swal.fire({
            title: `Tolak ${pendingInSelected.length} Testimoni Sekaligus?`,
            html: `
                <div class="text-start mb-2" style="font-size: 0.86rem;">
                    <p class="mb-2">Tuliskan catatan alasan penolakan untuk <b>${pendingInSelected.length} testimoni</b>:</p>
                </div>
            `,
            input: 'textarea',
            inputPlaceholder: 'Contoh: Ulasan tidak relevan atau tidak sesuai etika...',
            inputAttributes: {
                style: 'min-height: 80px; font-size: 0.85rem;'
            },
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: `<i class="fas fa-ban me-1"></i> Ya, Tolak Semua (${pendingInSelected.length})`,
            cancelButtonText: 'Batal',
            reverseButtons: true,
            inputValidator: (val) => {
                if (!val || !val.trim()) {
                    return 'Alasan penolakan wajib diisi!';
                }
            }
        });

        if (!reason || !reason.trim()) return;

        setBulkProcessing(true);
        let successCount = 0;

        for (const item of pendingInSelected) {
            try {
                await apiInstance.patch(`/admin/testimonials/${item.id}/approve-reject/`, {
                    action: 'reject',
                    reason: reason.trim()
                });
                successCount++;
            } catch (err) {
                console.error(`Error rejecting testimonial ${item.id}:`, err);
            }
        }

        setBulkProcessing(false);
        setSelectedIds([]);

        Toast().fire({
            icon: 'warning',
            title: 'Penolakan Massal Berhasil',
            text: `${successCount} testimoni telah ditolak.`
        });

        fetchAllData();
        if (typeof onCountsUpdated === 'function') {
            onCountsUpdated();
        }
    };

    // Export current filtered testimonials to CSV
    const handleExportCSV = () => {
        if (!filteredTestimonials || filteredTestimonials.length === 0) {
            Toast().fire({
                icon: 'info',
                title: 'Tidak ada data untuk diekspor',
                text: 'Daftar testimoni saat ini kosong berdasarkan filter yang dipilih.'
            });
            return;
        }

        try {
            const escapeCSV = (str) => {
                if (str === null || str === undefined) return '""';
                const s = String(str).replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
                return `"${s}"`;
            };

            const headers = [
                "No",
                "Nama Pegawai",
                "Email",
                "Jabatan / Unit Kerja",
                "Golongan",
                "Peran",
                "Rating (Bintang)",
                "Isi Ulasan Testimoni",
                "Tanggal Pengajuan",
                "Status Publikasi"
            ];

            const rows = filteredTestimonials.map((item, idx) => {
                const dateStr = item.date ? new Date(item.date).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }) : '-';

                return [
                    idx + 1,
                    escapeCSV(item.full_name || 'Anonim'),
                    escapeCSV(item.email || '-'),
                    escapeCSV(item.position || 'Peserta'),
                    escapeCSV(item.golongan || '-'),
                    escapeCSV(item.role === 'instructor' ? 'Instruktur' : 'Peserta'),
                    item.rating || 5,
                    escapeCSV(item.review || ''),
                    escapeCSV(dateStr),
                    escapeCSV(item.active ? 'Aktif (Terbit)' : 'Menunggu Kurasi')
                ].join(',');
            });

            const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const dateStamp = new Date().toISOString().slice(0, 10);
            link.href = URL.createObjectURL(blob);
            link.download = `Rekap_Testimoni_SetjenDPDRI_${activeSubTab}_${dateStamp}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            Toast().fire({
                icon: 'success',
                title: 'Berhasil Mengekspor Data',
                text: `${filteredTestimonials.length} testimoni berhasil diekspor ke file CSV.`
            });
        } catch (err) {
            console.error('Export error:', err);
            Toast().fire({
                icon: 'error',
                title: 'Gagal Mengekspor',
                text: 'Terjadi kesalahan saat mengekspor data ke CSV.'
            });
        }
    };

    // Bulk Export Selected Testimonials to CSV
    const handleBulkExportSelectedCSV = () => {
        if (!selectedTestimonials || selectedTestimonials.length === 0) return;

        try {
            const escapeCSV = (str) => {
                if (str === null || str === undefined) return '""';
                const s = String(str).replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
                return `"${s}"`;
            };

            const headers = [
                "No",
                "Nama Pegawai",
                "Email",
                "Jabatan / Unit Kerja",
                "Golongan",
                "Peran",
                "Rating (Bintang)",
                "Isi Ulasan Testimoni",
                "Tanggal Pengajuan",
                "Status Publikasi"
            ];

            const rows = selectedTestimonials.map((item, idx) => {
                const dateStr = item.date ? new Date(item.date).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }) : '-';

                return [
                    idx + 1,
                    escapeCSV(item.full_name || 'Anonim'),
                    escapeCSV(item.email || '-'),
                    escapeCSV(item.position || 'Peserta'),
                    escapeCSV(item.golongan || '-'),
                    escapeCSV(item.role === 'instructor' ? 'Instruktur' : 'Peserta'),
                    item.rating || 5,
                    escapeCSV(item.review || ''),
                    escapeCSV(dateStr),
                    escapeCSV(item.active ? 'Aktif (Terbit)' : 'Menunggu Kurasi')
                ].join(',');
            });

            const csvContent = [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const dateStamp = new Date().toISOString().slice(0, 10);
            link.href = URL.createObjectURL(blob);
            link.download = `Rekap_Testimoni_Pilihan_SetjenDPDRI_${dateStamp}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            Toast().fire({
                icon: 'success',
                title: 'Berhasil Mengekspor Pilihan',
                text: `${selectedTestimonials.length} testimoni terpilih berhasil diekspor ke file CSV.`
            });
        } catch (err) {
            console.error('Bulk export error:', err);
            Toast().fire({
                icon: 'error',
                title: 'Gagal Mengekspor',
                text: 'Terjadi kesalahan saat mengekspor data terpilih.'
            });
        }
    };

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

                    {/* Export to CSV Button */}
                    <div className="col-auto ms-auto">
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 shadow-xs"
                            style={{ fontSize: "0.78rem", fontWeight: 600, height: "31px", borderRadius: "6px" }}
                            onClick={handleExportCSV}
                            title="Ekspor daftar testimoni yang sedang tampil ke berkas CSV"
                            disabled={isLoading || filteredTestimonials.length === 0}
                        >
                            <i className="fas fa-file-export text-teal"></i>
                            <span className="d-none d-md-inline">Ekspor CSV</span>
                        </button>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="col-auto d-none d-sm-block">
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

            {/* Active Filters Pill Bar */}
            {hasActiveFilters && (
                <div className="cm-active-filters-bar mb-3">
                    <span className="cm-active-filter-label">
                        <i className="fas fa-filter me-1 text-teal" style={{ color: "#0d9488" }}></i>
                        Filter Aktif:
                    </span>
                    <div className="cm-filter-pills-list">
                        {searchTerm.trim() && (
                            <span className="cm-filter-pill">
                                <span>Cari: <b>"{searchTerm}"</b></span>
                                <button type="button" onClick={() => setSearchTerm('')} title="Hapus pencarian">
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        )}
                        {ratingFilter !== 'all' && (
                            <span className="cm-filter-pill">
                                <span>Rating: <b>{ratingFilter} Bintang</b></span>
                                <button type="button" onClick={() => setRatingFilter('all')} title="Hapus filter rating">
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        )}
                        {roleFilter !== 'all' && (
                            <span className="cm-filter-pill">
                                <span>Peran: <b>{roleFilter === 'student' ? 'Peserta' : 'Instruktur'}</b></span>
                                <button type="button" onClick={() => setRoleFilter('all')} title="Hapus filter peran">
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        )}
                        <button
                            type="button"
                            className="cm-btn-reset-all"
                            onClick={handleResetAllFilters}
                            title="Reset semua filter pencarian"
                        >
                            <i className="fas fa-undo-alt me-1"></i>
                            Reset Semua
                        </button>
                    </div>
                </div>
            )}

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
                        const isSelected = selectedIds.includes(item.id);
                        return (
                            <div key={item.id} className={`cm-t-card ${isPending ? 'border-pending' : 'border-approved'} ${isSelected ? 'is-selected' : ''}`}>
                                {/* Card Selection Checkbox */}
                                <div
                                    className="cm-t-select-box"
                                    onClick={(e) => e.stopPropagation()}
                                    title={isSelected ? "Batalkan pilihan" : "Pilih testimoni ini"}
                                >
                                    <input
                                        type="checkbox"
                                        className="form-check-input cm-card-checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleSelectOne(item.id)}
                                    />
                                </div>

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
                                            <h4
                                                className="cm-t-name text-truncate mb-0"
                                                title={`Klik untuk pratinjau: ${item.full_name}`}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => setPreviewTestimonial(item)}
                                            >
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
                                <div
                                    className="cm-t-quote-box"
                                    onClick={() => setPreviewTestimonial(item)}
                                    style={{ cursor: "pointer" }}
                                    title="Klik untuk membaca ulasan lengkap"
                                >
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

                                    <div className="cm-t-actions d-flex align-items-center gap-1">
                                        {/* Eyeball Preview Button */}
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-teal cm-btn-action px-2"
                                            onClick={() => setPreviewTestimonial(item)}
                                            title="Pratinjau Rincian Testimoni"
                                            style={{ borderColor: "#0d9488", color: "#0d9488" }}
                                        >
                                            <i className="fas fa-eye"></i>
                                        </button>

                                        {isPending ? (
                                            <>
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
                                                    onClick={() => handleApprove(item)}
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
                                            </>
                                        ) : (
                                            <div className="cm-t-approved-tag ms-1">
                                                <i className="fas fa-shield-check text-success me-1"></i>
                                                <span className="text-success small fw-semibold">Live</span>
                                            </div>
                                        )}
                                    </div>
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
                                <th style={{ width: '38px', textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        className="form-check-input cm-table-checkbox"
                                        checked={isAllSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = isSomeSelected;
                                        }}
                                        onChange={handleToggleSelectAll}
                                        title={isAllSelected ? "Batalkan pilihan semua" : "Pilih semua testimoni"}
                                    />
                                </th>
                                <th style={{ width: '36px', textAlign: 'center' }}>#</th>
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
                                const isSelected = selectedIds.includes(item.id);
                                return (
                                    <tr key={item.id} className={isSelected ? 'cm-row-selected' : ''}>
                                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="form-check-input cm-table-checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleSelectOne(item.id)}
                                                title={isSelected ? "Batalkan pilihan" : "Pilih testimoni ini"}
                                            />
                                        </td>
                                        <td className="text-muted small" style={{ textAlign: 'center' }}>{idx + 1}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="cm-table-avatar">
                                                    {(item.full_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="cm-table-userinfo">
                                                    <strong
                                                        className="d-block text-dark small"
                                                        style={{ cursor: "pointer" }}
                                                        onClick={() => setPreviewTestimonial(item)}
                                                        title="Klik untuk melihat pratinjau lengkap"
                                                    >
                                                        {item.full_name}
                                                    </strong>
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
                                            <p
                                                className="cm-table-review-text mb-0 text-truncate"
                                                style={{ maxWidth: '300px', cursor: 'pointer' }}
                                                onClick={() => setPreviewTestimonial(item)}
                                                title={`Klik untuk membaca ulasan: "${item.review}"`}
                                            >
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
                                            <div className="d-flex align-items-center justify-content-end gap-1">
                                                {/* Eyeball Preview Button */}
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-teal btn-xs d-inline-flex align-items-center justify-content-center"
                                                    style={{ width: "26px", height: "26px", borderColor: "#0d9488", color: "#0d9488" }}
                                                    onClick={() => setPreviewTestimonial(item)}
                                                    title="Pratinjau Rincian Testimoni"
                                                >
                                                    <i className="fas fa-eye"></i>
                                                </button>

                                                {isPending ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-success btn-xs d-inline-flex align-items-center justify-content-center"
                                                            style={{ width: "26px", height: "26px" }}
                                                            onClick={() => handleApprove(item)}
                                                            disabled={isProc}
                                                            title="Setujui Testimoni"
                                                        >
                                                            <i className="fas fa-check"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger btn-xs d-inline-flex align-items-center justify-content-center"
                                                            style={{ width: "26px", height: "26px" }}
                                                            onClick={() => handleRejectClick(item)}
                                                            disabled={isProc}
                                                            title="Tolak Testimoni"
                                                        >
                                                            <i className="fas fa-times"></i>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-success tiny fw-semibold ms-1">
                                                        <i className="fas fa-check-circle me-1"></i>Live
                                                    </span>
                                                )}
                                            </div>
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
                            <div className="cm-reject-preview p-2 rounded bg-light border mb-2">
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

            {/* 5. Floating Bulk Action Bar (Batch Moderation) */}
            {selectedIds.length > 0 && (
                <div className="cm-floating-bulk-bar shadow-lg">
                    <div className="cm-bulk-bar-inner">
                        <div className="cm-bulk-bar-left">
                            <span className="cm-bulk-badge">
                                <i className="fas fa-check-square me-1" style={{ color: '#0d9488' }}></i>
                                <strong>{selectedIds.length}</strong> Testimoni Dipilih
                            </span>
                            <div className="cm-bulk-breakdowns d-none d-md-flex align-items-center gap-1 ms-2">
                                {pendingInSelected.length > 0 && (
                                    <span className="badge bg-warning text-dark border">
                                        {pendingInSelected.length} Menunggu Kurasi
                                    </span>
                                )}
                                {approvedInSelected.length > 0 && (
                                    <span className="badge bg-success text-white">
                                        {approvedInSelected.length} Aktif
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="cm-bulk-bar-actions">
                            {/* Bulk Approve */}
                            {pendingInSelected.length > 0 && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-teal text-white d-inline-flex align-items-center gap-1 shadow-xs"
                                    style={{ backgroundColor: '#0d9488', borderColor: '#0d9488', fontSize: '0.8rem', fontWeight: 600, borderRadius: '6px' }}
                                    onClick={handleBulkApprove}
                                    disabled={bulkProcessing}
                                    title="Setujui semua testimoni terpilih yang menunggu kurasi"
                                >
                                    <i className={`fas ${bulkProcessing ? 'fa-spinner fa-spin' : 'fa-check-double'}`}></i>
                                    <span>Setujui ({pendingInSelected.length})</span>
                                </button>
                            )}

                            {/* Bulk Reject */}
                            {pendingInSelected.length > 0 && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1 shadow-xs"
                                    style={{ fontSize: '0.8rem', fontWeight: 600, borderRadius: '6px' }}
                                    onClick={handleBulkReject}
                                    disabled={bulkProcessing}
                                    title="Tolak semua testimoni terpilih yang menunggu kurasi"
                                >
                                    <i className={`fas ${bulkProcessing ? 'fa-spinner fa-spin' : 'fa-ban'}`}></i>
                                    <span>Tolak ({pendingInSelected.length})</span>
                                </button>
                            )}

                            {/* Bulk Export Selected */}
                            <button
                                type="button"
                                className="btn btn-sm btn-light border d-inline-flex align-items-center gap-1 shadow-xs text-dark"
                                style={{ fontSize: '0.8rem', fontWeight: 600, borderRadius: '6px' }}
                                onClick={handleBulkExportSelectedCSV}
                                disabled={bulkProcessing}
                                title="Unduh data testimoni terpilih ke format file CSV"
                            >
                                <i className="fas fa-file-csv text-teal"></i>
                                <span>Ekspor Pilihan</span>
                            </button>

                            <div className="vr d-none d-sm-block mx-1"></div>

                            {/* Deselect All */}
                            <button
                                type="button"
                                className="btn btn-sm btn-link text-secondary text-decoration-none p-1"
                                onClick={() => setSelectedIds([])}
                                disabled={bulkProcessing}
                                title="Batalkan semua pilihan"
                            >
                                <i className="fas fa-times me-1"></i>
                                <span>Batal</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. Quick Preview Slide-over Drawer for Testimonial */}
            {previewTestimonial && (
                <>
                    <div className="cm-drawer-backdrop" onClick={() => setPreviewTestimonial(null)} />
                    <div className="cm-preview-drawer">
                        <div className="cm-drawer-header">
                            <div className="d-flex align-items-center gap-2">
                                <div className="cm-drawer-icon-box">
                                    <i className="fas fa-comment-dots"></i>
                                </div>
                                <div>
                                    <h5 className="cm-drawer-title mb-0">Rincian Ulasan Testimoni</h5>
                                    <span className="text-muted" style={{ fontSize: "0.74rem" }}>
                                        {new Date(previewTestimonial.date).toLocaleDateString('id-ID', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="cm-drawer-close-btn"
                                onClick={() => setPreviewTestimonial(null)}
                                title="Tutup (Esc)"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="cm-drawer-body">
                            {/* Profile Box */}
                            <div className="p-3 bg-light rounded border mb-3">
                                <div className="d-flex align-items-center gap-3 mb-2">
                                    <div
                                        className="rounded-circle text-white d-flex align-items-center justify-content-center fw-bold shadow-xs"
                                        style={{ width: "48px", height: "48px", fontSize: "1.1rem", backgroundColor: "#0d9488" }}
                                    >
                                        {(previewTestimonial.full_name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h5 className="mb-0 text-dark fw-bold">{previewTestimonial.full_name || 'Anonim'}</h5>
                                        <div className="text-muted small">{previewTestimonial.email || 'Tidak ada email'}</div>
                                        <div className="d-flex align-items-center gap-2 mt-1">
                                            <span className="badge bg-teal text-white" style={{ backgroundColor: "#0d9488", fontSize: "0.7rem" }}>
                                                {previewTestimonial.role === 'instructor' ? 'Instruktur' : 'Peserta Pembelajaran'}
                                            </span>
                                            {previewTestimonial.position && (
                                                <span className="badge bg-light text-dark border" style={{ fontSize: "0.7rem" }}>
                                                    {previewTestimonial.position}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Rating Card */}
                            <div className="p-2 bg-white rounded border mb-3 d-flex align-items-center justify-content-between">
                                <div>
                                    <div className="text-muted small">Skor Kepuasan:</div>
                                    <div className="d-flex align-items-center gap-1 text-warning fs-5">
                                        <i className="fas fa-star"></i>
                                        <strong className="text-dark fs-5">{previewTestimonial.rating}.0</strong>
                                        <span className="text-muted small">/ 5.0</span>
                                    </div>
                                </div>
                                <div>
                                    <span className={`badge ${previewTestimonial.active ? 'bg-success' : 'bg-warning text-dark'}`}>
                                        {previewTestimonial.active ? 'Sudah Disetujui (Tayang)' : 'Menunggu Kurasi'}
                                    </span>
                                </div>
                            </div>

                            {/* Full Testimonial Text */}
                            <div className="mb-3">
                                <h6 className="fw-bold text-dark mb-1" style={{ fontSize: "0.84rem" }}>Isi Lengkap Testimoni:</h6>
                                <div className="p-3 rounded border bg-light text-dark" style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
                                    <i className="fas fa-quote-left text-teal me-2 opacity-50" style={{ color: "#0d9488" }}></i>
                                    {previewTestimonial.review}
                                </div>
                            </div>
                        </div>

                        {/* Footer Quick Actions */}
                        <div className="cm-drawer-footer d-flex align-items-center justify-content-between">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setPreviewTestimonial(null)}
                            >
                                Tutup
                            </button>

                            {!previewTestimonial.active && (
                                <div className="d-flex align-items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => {
                                            const t = previewTestimonial;
                                            setPreviewTestimonial(null);
                                            handleRejectClick(t);
                                        }}
                                    >
                                        <i className="fas fa-times me-1"></i> Tolak
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-teal text-white"
                                        style={{ backgroundColor: "#0d9488", borderColor: "#0d9488" }}
                                        onClick={async () => {
                                            const t = previewTestimonial;
                                            setPreviewTestimonial(null);
                                            await handleApprove(t);
                                        }}
                                    >
                                        <i className="fas fa-check me-1"></i> Setujui & Terbitkan
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default memo(TestimonialTab);
