import React, { useState, useEffect, memo } from 'react';
import apiInstance from '../../utils/axios';
import Toast from '../plugin/Toast';
import { SkeletonPage } from '../../components/skeletons/SkeletonComponents';
import AdminHeader from '../partials/AdminHeader';

/**
 * Admin Testimonials Curation Page
 * Allows admin to review and approve/reject testimonials before they appear on homepage
 * ✨ PHASE 4.12: Testimonial curation system
 */
function TestimonialsAdmin() {
    const [pendingTestimonials, setPendingTestimonials] = useState([]);
    const [approvedTestimonials, setApprovedTestimonials] = useState([]);
    const [activeTab, setActiveTab] = useState('pending');
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
        // ✨ FIX: Auto-load approved testimonials on mount instead of lazy loading
        fetchApprovedTestimonials();
    }, []);

    // Load approved testimonials when switching tabs
    useEffect(() => {
        if (activeTab === 'approved' && approvedTestimonials.length === 0) {
            fetchApprovedTestimonials();
        }
    }, [activeTab]);

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
                // Remove from pending list
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
                // Remove from pending list
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
        <div key={testimonial.id} className="testimonial-card">
            <div className="testimonial-header">
                <div className="testimonial-avatar">
                    {testimonial.image ? (
                        <img 
                            src={testimonial.image} 
                            alt={testimonial.full_name}
                            onError={(e) => {
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.full_name || 'User')}&background=0d9488&color=ffffff`;
                            }}
                        />
                    ) : (
                        <div className="avatar-initial">
                            {testimonial.full_name ? testimonial.full_name[0] : 'U'}
                        </div>
                    )}
                </div>
                <div className="testimonial-info">
                    <h5>{testimonial.full_name}</h5>
                    <small className="text-muted">
                        {testimonial.position} {testimonial.golongan ? `(${testimonial.golongan})` : ''}
                    </small>
                    <p className="email-text">{testimonial.email}</p>
                </div>
                <div className="role-badge">
                    <span className={`badge badge-${testimonial.role === 'instructor' ? 'primary' : 'info'}`}>
                        {testimonial.role === 'instructor' ? 'Instruktur' : 'Siswa'}
                    </span>
                </div>
            </div>

            <div className="testimonial-body">
                <div className="rating-display">
                    {[...Array(5)].map((_, i) => (
                        <i 
                            key={i}
                            className={`fas fa-star ${i < testimonial.rating ? 'filled' : ''}`}
                        ></i>
                    ))}
                    <span className="rating-value">{testimonial.rating}.0</span>
                </div>
                <p className="testimonial-text">"{testimonial.review}"</p>
                <small className="text-muted date-text">
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
                <div className="testimonial-actions">
                    <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleApprove(testimonial.id)}
                        disabled={processingId === testimonial.id}
                        style={{
                            backgroundColor: '#28a745',
                            borderColor: '#28a745',
                            color: 'white',
                            fontWeight: '500',
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.875rem',
                            minWidth: 'auto',
                            minHeight: 'auto',
                            height: 'auto',
                            width: 'auto'
                        }}
                    >
                        <i className="fas fa-check" style={{ color: 'white', marginRight: '0.3rem' }}></i>
                        <span style={{ color: 'white', fontWeight: '500' }}>
                            {processingId === testimonial.id ? 'Memproses...' : 'Setujui'}
                        </span>
                    </button>
                    <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRejectClick(testimonial.id)}
                        disabled={processingId === testimonial.id}
                        style={{
                            backgroundColor: '#dc3545',
                            borderColor: '#dc3545',
                            color: 'white',
                            fontWeight: '500',
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.875rem',
                            minWidth: 'auto',
                            minHeight: 'auto',
                            height: 'auto',
                            width: 'auto'
                        }}
                    >
                        <i className="fas fa-times" style={{ color: 'white', marginRight: '0.3rem' }}></i>
                        <span style={{ color: 'white', fontWeight: '500' }}>
                            {processingId === testimonial.id ? 'Memproses...' : 'Tolak'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <div className="testimonials-admin-page">
            <AdminHeader />
            
            <div className="testimonials-admin-container">
                {/* Page Header */}
                <div className="testimonials-admin-header">
                    <div className="header-content">
                        <h1>
                            <i className="fas fa-comments"></i>
                            Kurasi Testimoni
                        </h1>
                        <p className="header-subtitle">
                            Tinjau dan setujui testimoni sebelum ditampilkan di halaman utama
                        </p>
                    </div>
                    <div className="header-stats">
                        <div className="stat-item">
                            <span className="stat-number">{pendingTestimonials.length}</span>
                            <span className="stat-label" style={{
                                color: '#6c757d',
                                fontSize: '0.85rem',
                                marginTop: '0.5rem',
                                display: 'block',
                                textAlign: 'center',
                                textShadow: 'none',
                                letterSpacing: 'normal',
                                marginLeft: '0'
                            }}>Pending</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">{approvedTestimonials.length}</span>
                            <span className="stat-label" style={{
                                color: '#6c757d',
                                fontSize: '0.85rem',
                                marginTop: '0.5rem',
                                display: 'block',
                                textAlign: 'center',
                                textShadow: 'none',
                                letterSpacing: 'normal',
                                marginLeft: '0'
                            }}>Disetujui</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="testimonials-tabs">
                    <button
                        className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pending')}
                    >
                        <i className="fas fa-hourglass-half"></i>
                        Pending Persetujuan ({pendingTestimonials.length})
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'approved' ? 'active' : ''}`}
                        onClick={() => setActiveTab('approved')}
                    >
                        <i className="fas fa-check-circle"></i>
                        Sudah Disetujui ({approvedTestimonials.length})
                    </button>
                </div>

                {/* Content */}
                <div className="testimonials-content">
                    {activeTab === 'pending' && (
                        <div className="pending-section">
                            {loadingPending ? (
                                <SkeletonPage />
                            ) : pendingTestimonials.length === 0 ? (
                                <div className="empty-state">
                                    <i className="fas fa-check-circle"></i>
                                    <h3>Tidak ada testimoni menunggu persetujuan</h3>
                                    <p>Semua testimoni sudah diproses</p>
                                </div>
                            ) : (
                                <div className="testimonials-grid">
                                    {pendingTestimonials.map(testimonial => 
                                        renderTestimonialCard(testimonial, true)
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'approved' && (
                        <div className="approved-section">
                            {loadingApproved ? (
                                <SkeletonPage />
                            ) : approvedTestimonials.length === 0 ? (
                                <div className="empty-state">
                                    <i className="fas fa-inbox"></i>
                                    <h3>Belum ada testimoni yang disetujui</h3>
                                    <p>Mulai setujui testimoni dari tab "Pending Persetujuan"</p>
                                </div>
                            ) : (
                                <div className="testimonials-grid">
                                    {approvedTestimonials.map(testimonial => 
                                        renderTestimonialCard(testimonial, false)
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Rejection Modal */}
            {showRejectionModal && (
                <div className="modal-overlay" onClick={() => setShowRejectionModal(false)}>
                    <div className="rejection-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h5>Berikan Alasan Penolakan</h5>
                            <button 
                                className="close-btn" 
                                onClick={() => setShowRejectionModal(false)}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="modal-body">
                            <textarea
                                className="form-control"
                                placeholder="Masukkan alasan penolakan (opsional)..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                rows="4"
                            />
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setShowRejectionModal(false)}
                                style={{
                                    backgroundColor: '#6c757d',
                                    borderColor: '#6c757d',
                                    color: 'white',
                                    fontWeight: '500',
                                    padding: '0.5rem 1.5rem',
                                    fontSize: '1rem',
                                    minWidth: 'auto',
                                    minHeight: 'auto'
                                }}
                            >
                                <span style={{ color: 'white', fontWeight: '500' }}>Batal</span>
                            </button>
                            <button 
                                className="btn btn-danger"
                                onClick={handleConfirmReject}
                                disabled={processingId !== null}
                                style={{
                                    backgroundColor: '#dc3545',
                                    borderColor: '#dc3545',
                                    color: 'white',
                                    fontWeight: '500',
                                    padding: '0.5rem 1.5rem',
                                    fontSize: '1rem',
                                    minWidth: 'auto',
                                    minHeight: 'auto'
                                }}
                            >
                                <span style={{ color: 'white', fontWeight: '500' }}>
                                    {processingId !== null ? 'Memproses...' : 'Tolak Testimoni'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default memo(TestimonialsAdmin);
