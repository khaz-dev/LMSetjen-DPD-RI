/**
 * ✨ PHASE 10.1: RankedInstructors Component
 * Displays top 10 instructors ranked by points with filtering by period (lifetime, yearly, monthly)
 * Shown on homepage CTA section
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import apiInstance from '../../utils/axios';
import Toast from '../../views/plugin/Toast';
import './Rankings.css';

const RankedInstructors = ({ maxResults = 5 }) => {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('lifetime');
  const [brokenImages, setBrokenImages] = useState({});

  /**
   * Fetch ranked instructors from API
   */
  const fetchRankedInstructors = async (selectedPeriod = 'lifetime') => {
    try {
      setLoading(true);
      const endpoint = `/rankings/instructors/${selectedPeriod}/`;
      const response = await apiInstance.get(endpoint);
      
      // Take only first maxResults items
      if (response.data && Array.isArray(response.data)) {
        setInstructors(response.data.slice(0, maxResults));
      } else if (response.data && response.data.results) {
        setInstructors(response.data.results.slice(0, maxResults));
      }
    } catch (error) {
      console.error('Error fetching ranked instructors:', error);
      // Only show error toast for actual server errors (5xx), not for 404s or empty results
      if (error.response?.status >= 500) {
        Toast().fire({
          icon: 'error',
          title: 'Error',
          text: 'Gagal memuat daftar instruktur terbaik'
        });
      }
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Effect hook to fetch data when period changes
   */
  useEffect(() => {
    fetchRankedInstructors(period);
  }, [period]);

  /**
   * Handle period filter change
   */
  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
  };

  const [selectedInstructor, setSelectedInstructor] = useState(null);
  const [breakdownData, setBreakdownData] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalPeriod, setModalPeriod] = useState('lifetime');

  /**
   * Fetch breakdown data for an instructor with a specific period filter
   */
  const fetchBreakdown = async (instructor, targetPeriod) => {
    setLoadingBreakdown(true);
    try {
      const userId = instructor.user_id || instructor.user?.id || '';
      const teacherId = instructor.teacher_id || instructor.id || '';
      const response = await apiInstance.get(
        `/instructor/points-breakdown/?user_id=${userId}&teacher_id=${teacherId}&period=${targetPeriod}`
      );
      if (response.data) {
        setBreakdownData(response.data);
      }
    } catch (err) {
      console.error('Error fetching breakdown:', err);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  /**
   * Handle opening breakdown modal for an instructor
   */
  const handleOpenBreakdown = (instructor) => {
    setSelectedInstructor(instructor);
    setModalPeriod(period);
    setShowModal(true);
    fetchBreakdown(instructor, period);
  };

  /**
   * Handle changing period filter inside breakdown modal
   */
  const handleModalPeriodChange = (newPeriod) => {
    setModalPeriod(newPeriod);
    if (selectedInstructor) {
      fetchBreakdown(selectedInstructor, newPeriod);
    }
  };

  /**
   * Handle broken image - show gradient fallback
   */
  const handleImageError = (instructorId) => {
    setBrokenImages(prev => ({ ...prev, [instructorId]: true }));
  };

  /**
   * Get points value based on current period or API returned points
   */
  const getPoints = (instructor, targetPeriod = period) => {
    if (!instructor) return 0;
    if (targetPeriod === 'monthly') return instructor?.monthly_points ?? 0;
    if (targetPeriod === 'yearly') return instructor?.yearly_points ?? 0;
    if (targetPeriod === 'lifetime') return instructor?.lifetime_points ?? 0;
    if (instructor?.points !== undefined && instructor?.points !== null) {
      return instructor.points;
    }
    return instructor?.lifetime_points ?? 0;
  };

  return (
    <div className="ranked-instructors-widget card h-100 shadow-sm">
      {/* Header */}
      <div className="card-header bg-gradient-success text-white d-flex justify-content-between align-items-center">
        <h5 className="mb-0 d-flex align-items-center gap-2">
          <i className="fas fa-chalkboard-user"></i>
          <span>Instruktur Terbaik</span>
        </h5>
        <span className="badge bg-white text-success fw-bold">Top {instructors.length > 0 ? instructors.length : maxResults}</span>
      </div>

      {/* Filter Buttons */}
      <div className="ranking-filters p-2 px-3 border-bottom">
        <div className="btn-group d-flex gap-1" role="group">
          {['lifetime', 'yearly', 'monthly'].map((p) => (
            <button
              key={p}
              className={`btn btn-sm flex-fill ${
                period === p 
                  ? 'btn-success' 
                  : 'btn-outline-secondary'
              }`}
              onClick={() => handlePeriodChange(p)}
            >
              {p === 'lifetime' && 'Sepanjang Masa'}
              {p === 'yearly' && 'Tahun Ini'}
              {p === 'monthly' && 'Bulan Ini'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card-body text-center py-3">
          <div className="spinner-border spinner-border-sm text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-1 text-muted small mb-0">Memuat peringkat...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && instructors.length === 0 && (
        <div className="card-body text-center py-3 empty-state-compact">
          <i className="fas fa-inbox text-muted mb-1" style={{ fontSize: '1.4rem' }}></i>
          <p className="text-muted mb-0 small">
            {period === 'monthly'
              ? 'Belum ada data untuk bulan ini'
              : period === 'yearly'
              ? 'Belum ada data untuk tahun ini'
              : 'Belum ada data instruktur'}
          </p>
        </div>
      )}

      {/* Rankings List */}
      {!loading && instructors.length > 0 && (
        <div className="rankings-list">
          {instructors.map((instructor, index) => (
            <div
              key={instructor.id}
              className={`ranking-item d-flex align-items-center top-${instructor.rank_position} ${
                index < instructors.length - 1 ? 'border-bottom' : ''
              }`}
            >
              {/* Rank Badge & Avatar */}
              <div className="rank-badge-avatar-group d-flex align-items-center">
                <div className={`badge-rank-pill rank-${instructor.rank_position}`}>
                  {instructor.rank_position === 1 ? (
                    <i className="fas fa-crown text-warning" title="Peringkat 1"></i>
                  ) : (
                    instructor.rank
                  )}
                </div>
                <div className="rank-avatar-box">
                  {!brokenImages[instructor.id] ? (
                    <img
                      src={instructor.image || '/images/placeholders/default-instructor.svg'}
                      alt={instructor.full_name}
                      className="ranking-avatar rounded-circle"
                      loading="lazy"
                      decoding="async"
                      width="42"
                      height="42"
                      onError={() => handleImageError(instructor.id)}
                    />
                  ) : (
                    <div className="ranking-avatar rounded-circle avatar-placeholder instructor-accent">
                      <img
                        src="/images/placeholders/default-instructor.svg"
                        alt={instructor.full_name}
                        className="placeholder-image"
                        loading="lazy"
                        decoding="async"
                        width="42"
                        height="42"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Instructor Info */}
              <div className="ranking-info flex-grow-1 min-w-0 ms-2">
                <h6 className="mb-0 text-truncate" title={instructor.full_name}>
                  {instructor.full_name}
                </h6>
                <small className="text-muted d-block text-truncate">
                  {instructor.position_name || instructor.organization_unit_name || instructor.country || '—'}
                </small>
              </div>

              {/* Points Display - Interactive with Click to View Breakdown */}
              <div 
                className="ranking-points text-end"
                style={{ cursor: 'pointer' }}
                onClick={() => handleOpenBreakdown(instructor)}
                title="Klik untuk melihat darimana poin ini diperoleh"
              >
                <div className="points-value d-flex align-items-center justify-content-end gap-1">
                  <span>{getPoints(instructor)}</span>
                  <i className="fas fa-circle-info text-success ms-1" style={{ fontSize: '0.8rem' }}></i>
                </div>
                <small className="points-label text-muted d-block">
                  poin • <span className="text-success fw-bold">rincian</span>
                </small>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="card-footer bg-light py-2 px-3 text-center">
        <small className="text-muted d-block" style={{ fontSize: '0.74rem' }}>
          <i className="fas fa-info-circle me-1"></i>
          Poin diakumulasikan dari kursus, peserta aktif, ulasan & testimoni terverifikasi
        </small>
      </div>

      {/* Modal Rincian Perolehan Poin */}
      {/* Modal Rincian Perolehan Poin (Portaled to document.body to center on viewport) */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal fade show d-block modal-instructor-points-breakdown" 
          tabIndex="-1" 
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 10050 }}
          onClick={() => setShowModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 shadow-lg border-0 overflow-hidden">
              <div className="modal-header py-3">
                <h5 className="modal-title fw-bold fs-6 mb-0">
                  <i className="fas fa-award me-2"></i>
                  Rincian Poin Instruktur
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body p-3 p-md-4">
                {/* Period Filter Tabs inside Modal - High Contrast */}
                <div className="d-flex justify-content-center mb-3">
                  <div className="modal-period-filter-pill d-inline-flex rounded-pill" role="group">
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-1 ${modalPeriod === 'lifetime' ? 'modal-filter-btn-active' : 'modal-filter-btn-inactive'}`}
                      onClick={() => handleModalPeriodChange('lifetime')}
                    >
                      Sepanjang Masa
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-1 ${modalPeriod === 'yearly' ? 'modal-filter-btn-active' : 'modal-filter-btn-inactive'}`}
                      onClick={() => handleModalPeriodChange('yearly')}
                    >
                      Tahun Ini
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-1 ${modalPeriod === 'monthly' ? 'modal-filter-btn-active' : 'modal-filter-btn-inactive'}`}
                      onClick={() => handleModalPeriodChange('monthly')}
                    >
                      Bulan Ini
                    </button>
                  </div>
                </div>

                {/* Instructor Card Header */}
                <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 mb-3 border">
                  <img
                    src={selectedInstructor?.image || '/images/placeholders/default-instructor.svg'}
                    alt={selectedInstructor?.full_name}
                    className="rounded-circle border"
                    width="48"
                    height="48"
                    style={{ objectFit: 'cover' }}
                  />
                  <div>
                    <h6 className="fw-bold mb-0 text-dark">{selectedInstructor?.full_name}</h6>
                    <small className="text-muted">{selectedInstructor?.position_name || 'Instruktur LMS'}</small>
                  </div>
                  <div className="ms-auto text-end">
                    <span className="badge fs-6 px-3 py-2" style={{ backgroundColor: '#0f766e', color: '#ffffff', fontWeight: 700 }}>
                      {breakdownData?.period_points !== undefined ? breakdownData.period_points : getPoints(selectedInstructor, modalPeriod)} Poin
                    </span>
                    <small className="d-block text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                      {modalPeriod === 'monthly' ? 'Bulan Ini' : modalPeriod === 'yearly' ? 'Tahun Ini' : 'Sepanjang Masa'}
                    </small>
                  </div>
                </div>

                {loadingBreakdown ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-success" role="status">
                      <span className="visually-hidden">Memuat rincian...</span>
                    </div>
                    <p className="mt-2 text-muted small">Memuat data periode {modalPeriod === 'monthly' ? 'bulan ini' : modalPeriod === 'yearly' ? 'tahun ini' : 'sepanjang masa'}...</p>
                  </div>
                ) : (
                  <>
                    {/* Summary category badges */}
                    <div className="p-3 bg-light rounded-3 border mb-3">
                      <small className="fw-bold text-muted d-block mb-2 text-uppercase" style={{ fontSize: '0.72rem' }}>
                        Sumber Perolehan Poin ({modalPeriod === 'monthly' ? 'Bulan Ini' : modalPeriod === 'yearly' ? 'Tahun Ini' : 'Sepanjang Masa'}):
                      </small>
                      <div className="d-flex flex-wrap gap-2">
                        <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1 shadow-xs">
                          <i className="fas fa-rocket text-success"></i>
                          <span>Publikasi Kursus: <strong>{breakdownData?.summary?.course_published?.count || 0}</strong> ({breakdownData?.summary?.course_published?.points || 0} pt)</span>
                        </div>
                        <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1 shadow-xs">
                          <i className="fas fa-heart text-danger"></i>
                          <span>Testimoni Platform: <strong>{breakdownData?.summary?.platform_testimonial?.count || 0}</strong> ({breakdownData?.summary?.platform_testimonial?.points || 0} pt)</span>
                        </div>
                        <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1 shadow-xs">
                          <i className="fas fa-star text-warning"></i>
                          <span>Ulasan & Rating: <strong>{breakdownData?.summary?.student_rating?.count || 0}</strong> ({breakdownData?.summary?.student_rating?.points || 0} pt)</span>
                        </div>
                        <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1 shadow-xs">
                          <i className="fas fa-user-graduate text-info"></i>
                          <span>Siswa Terdaftar: <strong>{breakdownData?.summary?.student_enrollment?.count || 0}</strong> ({breakdownData?.summary?.student_enrollment?.points || 0} pt)</span>
                        </div>
                      </div>
                    </div>

                    {/* Points History / Audit Trail */}
                    <h6 className="fw-bold mb-2 small text-dark">
                      <i className="fas fa-history text-success me-2"></i>
                      Riwayat Aktivitas Perolehan Poin:
                    </h6>

                    {breakdownData?.history && breakdownData.history.length > 0 ? (
                      <div className="list-group list-group-flush mb-2 border rounded-3 points-history-scroll-container" style={{ maxHeight: '240px', overflowY: 'auto', overflowX: 'hidden' }}>
                        {breakdownData.history.map((item) => (
                          <div key={item.id} className="list-group-item d-flex align-items-center justify-content-between p-2 px-3">
                            <div className="me-2">
                              <div className="fw-semibold text-dark small">{item.description}</div>
                              <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                                {new Date(item.awarded_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </small>
                            </div>
                            <span className="badge bg-warning text-dark fw-bold px-2 py-1 ms-2 flex-shrink-0">
                              +{item.points_awarded} pt
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="alert alert-light border small text-muted mb-2 text-center py-3">
                        <i className="fas fa-info-circle me-1 text-primary"></i>
                        Belum ada aktivitas perolehan poin pada periode {modalPeriod === 'monthly' ? 'bulan ini' : modalPeriod === 'yearly' ? 'tahun ini' : 'sepanjang masa'}.
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer bg-light py-2">
                <button type="button" className="btn btn-secondary btn-sm rounded-3 px-3" onClick={() => setShowModal(false)}>
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default React.memo(RankedInstructors);
