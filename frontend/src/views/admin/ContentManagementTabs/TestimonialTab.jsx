import React, { useState, useEffect, memo } from 'react';
import apiInstance from '../../../utils/axios';
import Toast from '../../plugin/Toast';

/**
 * Testimonial Tab Component
 * Handles review and curation of student testimonials
 * ✨ PHASE 4: Extracted from TestimonialsAdmin.jsx for merged Content Management
 */
function TestimonialTab() {
    const [pendingTestimonials, setPendingTestimonials] = useState([]);
    const [approvedTestimonials, setApprovedTestimonials] = useState([]);
    const [activeSubTab, setActiveSubTab] = useState('pending');
    const [loadingPending, setLoadingPending] = useState(true);
    const [loadingApproved, setLoadingApproved] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [selectedTestimonialId, setSelectedTestimonialId] = useState(null);

    // Fetch pending testimonials
    const fetchPendingTestimonials = () => {
        setLoadingPending(true);
        apiInstance
            .get('/admin/testimonials/pending/')
            .then((res) => {
                setPendingTestimonials(res.data?.results || []);
            })
            .catch((err) => {
                console.error('Error fetching pending testimonials:', err);
                Toast().fire({
                    icon: 'error',
                    title: 'Gagal memuat testimoni pending',
                    timer: 2000,
                });
            })
            .finally(() => setLoadingPending(false));
    };

    // Fetch approved testimonials
    const fetchApprovedTestimonials = () => {
        setLoadingApproved(true);
        apiInstance
            .get('/admin/testimonials/approved/')
            .then((res) => {
                setApprovedTestimonials(res.data?.results || []);
            })
            .catch((err) => {
                console.error('Error fetching approved testimonials:', err);
                Toast().fire({
                    icon: 'error',
                    title: 'Gagal memuat testimoni disetujui',
                    timer: 2000,
                });
            })
            .finally(() => setLoadingApproved(false));
    };

    // Initial load
    useEffect(() => {
        fetchPendingTestimonials();
        fetchApprovedTestimonials();
    }, []);

    // Handle approve action
    const handleApprove = (testimonialId) => {
        setProcessingId(testimonialId);
        apiInstance
            .patch(`/admin/testimonials/${testimonialId}/approve-reject/`, {
                action: 'approve'
            })
            .then((res) => {
                Toast().fire({
                    icon: 'success',
                    title: 'Testimoni berhasil disetujui',
                    timer: 2000,
                });
                setPendingTestimonials(pendingTestimonials.filter(t => t.id !== testimonialId));
            })
            .catch((err) => {
                console.error('Error approving testimonial:', err);
                Toast().fire({
                    icon: 'error',
                    title: 'Gagal menyetujui testimoni',
                    timer: 2000,
                });
            })
            .finally(() => setProcessingId(null));
    };

    // Handle reject action
    const handleRejectClick = (testimonialId) => {
        setSelectedTestimonialId(testimonialId);
        setRejectionReason('');
        setShowRejectionModal(true);
    };

    const handleConfirmReject = () => {
        if (!selectedTestimonialId) return;
        
        setProcessingId(selectedTestimonialId);
        apiInstance
            .patch(`/admin/testimonials/${selectedTestimonialId}/approve-reject/`, {
                action: 'reject',
                reason: rejectionReason
            })
            .then((res) => {
                Toast().fire({
                    icon: 'success',
                    title: 'Testimoni berhasil ditolak',
                    timer: 2000,
                });
                setPendingTestimonials(pendingTestimonials.filter(t => t.id !== selectedTestimonialId));
                setShowRejectionModal(false);
            })
            .catch((err) => {
                console.error('Error rejecting testimonial:', err);
                Toast().fire({
                    icon: 'error',
                    title: 'Gagal menolak testimoni',
                    timer: 2000,
                });
            })
            .finally(() => {
                setProcessingId(null);
                setSelectedTestimonialId(null);
            });
    };

    // Render testimonial card
    const renderTestimonialCard = (testimonial, showActions = true) => (
        <div key={testimonial.id} className="cm-testimonial-card">
            <div className="cm-testimonial-header">
                <div className="cm-testimonial-avatar">
                    {testimonial.image ? (
                        <img 
                            src={testimonial.image} 
                            alt={testimonial.full_name}
                            onError={(e) => {
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.full_name || 'User')}&background=667eea&color=ffffff`;
                            }}
                        />
                    ) : (
                        <div className="cm-avatar-initial">
                            {testimonial.full_name ? testimonial.full_name[0] : 'U'}
                        </div>
                    )}
                </div>
                <div className="cm-testimonial-info">
                    <h5 className="mb-0">{testimonial.full_name}</h5>
                    <small className="text-muted">
                        {testimonial.position} {testimonial.golongan ? `(${testimonial.golongan})` : ''}
                    </small>
                    <p className="cm-email-text">{testimonial.email}</p>
                </div>
                <div className="cm-role-badge">
                    <span className={`badge badge-${testimonial.role === 'instructor' ? 'primary' : 'info'}`}>
                        {testimonial.role === 'instructor' ? 'Instruktur' : 'Siswa'}
                    </span>
                </div>
            </div>

            <div className="cm-testimonial-body">
                <div className="cm-rating-display">
                    {[...Array(5)].map((_, i) => (
                        <i 
                            key={i}
                            className={`fas fa-star ${i < testimonial.rating ? 'filled' : ''}`}
                        ></i>
                    ))}
                    <span className="cm-rating-value">{testimonial.rating}.0</span>
                </div>
                <p className="cm-testimonial-text">"{testimonial.review}"</p>
                <small className="text-muted cm-date-text">
                    {new Date(testimonial.date).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </small>
            </div>

            {showActions && (
                <div className="cm-testimonial-actions">
                    <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleApprove(testimonial.id)}
                        disabled={processingId === testimonial.id}
                    >
                        <i className="fas fa-check me-1"></i>
                        {processingId === testimonial.id ? 'Memproses...' : 'Setujui'}
                    </button>
                    <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRejectClick(testimonial.id)}
                        disabled={processingId === testimonial.id}
                    >
                        <i className="fas fa-times me-1"></i>
                        {processingId === testimonial.id ? 'Memproses...' : 'Tolak'}
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="cm-tab-content cm-testimonials-tab">
            <div className="cm-tab-header d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h3 className="mb-1">
                        <i className="fas fa-comments me-2"></i>
                        Kurasi Testimoni
                    </h3>
                    <p className="text-muted small mb-0">Tinjau dan setujui testimoni sebelum ditampilkan di halaman utama</p>
                </div>
                <div className="cm-tab-stats d-flex gap-2">
                    <div className="cm-stat-box">
                        <span className="cm-stat-number">{pendingTestimonials.length}</span>
                        <span className="cm-stat-label">Pending</span>
                    </div>
                    <div className="cm-stat-box">
                        <span className="cm-stat-number">{approvedTestimonials.length}</span>
                        <span className="cm-stat-label">Disetujui</span>
                    </div>
                </div>
            </div>

            {/* Sub-tabs */}
            <div className="cm-subtabs mb-4">
                <button
                    className={`cm-subtab-button ${activeSubTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('pending')}
                >
                    <i className="fas fa-hourglass-half me-2"></i>
                    Pending Persetujuan ({pendingTestimonials.length})
                </button>
                <button
                    className={`cm-subtab-button ${activeSubTab === 'approved' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('approved')}
                >
                    <i className="fas fa-check-circle me-2"></i>
                    Sudah Disetujui ({approvedTestimonials.length})
                </button>
            </div>

            {/* Content */}
            {activeSubTab === 'pending' && (
                <div className="cm-subtab-content">
                    {loadingPending ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Memuat...</span>
                            </div>
                            <p className="mt-3 text-muted">Memuat testimoni pending...</p>
                        </div>
                    ) : pendingTestimonials.length === 0 ? (
                        <div className="cm-empty-state text-center py-5">
                            <i className="fas fa-check-circle"></i>
                            <h3>Tidak ada testimoni menunggu persetujuan</h3>
                            <p className="text-muted">Semua testimoni sudah diproses</p>
                        </div>
                    ) : (
                        <div className="cm-grid">
                            {pendingTestimonials.map(testimonial => 
                                renderTestimonialCard(testimonial, true)
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeSubTab === 'approved' && (
                <div className="cm-subtab-content">
                    {loadingApproved ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Memuat...</span>
                            </div>
                            <p className="mt-3 text-muted">Memuat testimoni disetujui...</p>
                        </div>
                    ) : approvedTestimonials.length === 0 ? (
                        <div className="cm-empty-state text-center py-5">
                            <i className="fas fa-inbox"></i>
                            <h3>Belum ada testimoni yang disetujui</h3>
                            <p className="text-muted">Mulai setujui testimoni dari tab "Pending Persetujuan"</p>
                        </div>
                    ) : (
                        <div className="cm-grid">
                            {approvedTestimonials.map(testimonial => 
                                renderTestimonialCard(testimonial, false)
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Rejection Modal */}
            {showRejectionModal && (
                <div className="cm-modal-overlay" onClick={() => setShowRejectionModal(false)}>
                    <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-header">
                            <h5>Berikan Alasan Penolakan</h5>
                            <button 
                                className="cm-modal-close"
                                onClick={() => setShowRejectionModal(false)}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="cm-modal-body">
                            <textarea
                                className="form-control"
                                placeholder="Masukkan alasan penolakan (opsional)..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                rows="4"
                            />
                        </div>
                        <div className="cm-modal-footer">
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setShowRejectionModal(false)}
                            >
                                <i className="fas fa-times me-1"></i>Batal
                            </button>
                            <button 
                                className="btn btn-danger"
                                onClick={handleConfirmReject}
                                disabled={processingId !== null}
                            >
                                <i className="fas fa-trash me-1"></i>
                                {processingId !== null ? 'Memproses...' : 'Tolak Testimoni'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default memo(TestimonialTab);
