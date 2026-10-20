/**
 * ✨ PHASE 10.1: RankedInstructors Component
 * Displays top 10 instructors ranked by points with filtering by period (lifetime, yearly, monthly)
 * Shown on homepage CTA section
 */

import React, { useState, useEffect } from 'react';
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

  /**
   * Handle opening breakdown modal for an instructor
   */
  const handleOpenBreakdown = async (instructor) => {
    setSelectedInstructor(instructor);
    setShowModal(true);
    setLoadingBreakdown(true);
    setBreakdownData(null);
    try {
      const response = await apiInstance.get(`/instructor/points-breakdown/?teacher_id=${instructor.id}`);
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
   * Handle broken image - show gradient fallback
   */
  const handleImageError = (instructorId) => {
    setBrokenImages(prev => ({ ...prev, [instructorId]: true }));
  };

  /**
   * Get points value based on current period or API returned points
   */
  const getPoints = (instructor) => {
    if (instructor?.points !== undefined && instructor?.points !== null) {
      return instructor.points;
    }
    if (period === 'monthly') return instructor?.monthly_points ?? 0;
    if (period === 'yearly') return instructor?.yearly_points ?? 0;
    return instructor?.lifetime_points ?? 0;
  };

  return (
    <div className="ranked-instructors-widget card h-100 shadow-sm">
      {/* Header */}
      <div className="card-header bg-gradient-success text-white d-flex justify-content-between align-items-center">
        <h5 className="mb-0">
          <i className="fas fa-star me-2"></i>
          Instruktur Terbaik
        </h5>
        <span className="badge bg-light text-dark">Top {maxResults}</span>
      </div>

      {/* Filter Buttons */}
      <div className="ranking-filters p-3 border-bottom">
        <div className="btn-group d-flex gap-2" role="group">
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
        <div className="card-body text-center py-4">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Memuat data...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && instructors.length === 0 && (
        <div className="card-body text-center py-4">
          <i className="fas fa-inbox text-muted mb-2" style={{ fontSize: '2rem' }}></i>
          <p className="text-muted mb-0">
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
              className={`ranking-item d-flex align-items-center p-3 top-${instructor.rank_position} ${
                index < instructors.length - 1 ? 'border-bottom' : ''
              }`}
            >
              {/* Avatar Container with Blended Badge */}
              <div className="rank-badge">
                {!brokenImages[instructor.id] ? (
                  <img
                    src={instructor.image || '/images/placeholders/default-instructor.svg'}
                    alt={instructor.full_name}
                    className="ranking-avatar rounded-circle"
                    loading="lazy"
                    decoding="async"
                    width="60"
                    height="60"
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
                      width="60"
                      height="60"
                    />
                  </div>
                )}
                <span className={`badge badge-rank rank-${instructor.rank_position}`}>
                  {instructor.rank}
                </span>
              </div>

              {/* Instructor Info */}
              <div className="ranking-info flex-grow-1 min-w-0">
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
                  <i className="fas fa-circle-info text-success ms-1" style={{ fontSize: '0.85rem' }}></i>
                </div>
                <small className="points-label text-muted d-block" style={{ fontSize: '0.72rem' }}>
                  poin • <span className="text-success fw-bold">rincian</span>
                </small>
              </div>
            </div>
          ))}
          
          {/* Empty Slots to reach maxResults */}
          {Array.from({ length: Math.max(0, maxResults - instructors.length) }).map((_, index) => (
            <div key={`empty-${index}`} className="ranking-item empty-slot"></div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="card-footer bg-light p-3 text-center">
        <small className="text-muted d-block">
          <i className="fas fa-info-circle me-1"></i>
          Poin diperoleh dari publikasi kursus, siswa mendaftar, ulasan rating & testimoni
        </small>
      </div>

      {/* Modal Rincian Perolehan Poin */}
      {showModal && (
        <div 
          className="modal fade show d-block" 
          tabIndex="-1" 
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 10050 }}
          onClick={() => setShowModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 shadow-lg border-0">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">
                  <i className="fas fa-award me-2 text-warning"></i>
                  Rincian Poin Instruktur
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                {/* Instructor Card Header */}
                <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 mb-3 border">
                  <img
                    src={selectedInstructor?.image || '/images/placeholders/default-instructor.svg'}
                    alt={selectedInstructor?.full_name}
                    className="rounded-circle"
                    width="48"
                    height="48"
                    style={{ objectFit: 'cover' }}
                  />
                  <div>
                    <h6 className="fw-bold mb-0">{selectedInstructor?.full_name}</h6>
                    <small className="text-muted">{selectedInstructor?.position_name || 'Instruktur LMS'}</small>
                  </div>
                  <div className="ms-auto text-end">
                    <span className="badge bg-success fs-6">
                      {getPoints(selectedInstructor)} Poin
                    </span>
                    <small className="d-block text-muted" style={{ fontSize: '0.72rem' }}>
                      {period === 'monthly' ? 'Bulan Ini' : period === 'yearly' ? 'Tahun Ini' : 'Sepanjang Masa'}
                    </small>
                  </div>
                </div>

                {loadingBreakdown ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-success" role="status">
                      <span className="visually-hidden">Memuat rincian...</span>
                    </div>
                    <p className="mt-2 text-muted small">Memuat riwayat perolehan poin...</p>
                  </div>
                ) : (
                  <>
                    {/* Summary category badges */}
                    <div className="p-3 bg-light rounded-3 border mb-3">
                      <small className="fw-bold text-muted d-block mb-2 text-uppercase" style={{ fontSize: '0.72rem' }}>Sumber Perolehan Poin:</small>
                      <div className="d-flex flex-wrap gap-2">
                        <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1">
                          <i className="fas fa-rocket text-success"></i>
                          <span>Publikasi Kursus: <strong>{breakdownData?.summary?.course_published?.count || 0}</strong> ({breakdownData?.summary?.course_published?.points || 0} pt)</span>
                        </div>
                        <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1">
                          <i className="fas fa-heart text-warning"></i>
                          <span>Testimoni Platform: <strong>{breakdownData?.summary?.platform_testimonial?.count || 0}</strong> ({breakdownData?.summary?.platform_testimonial?.points || 0} pt)</span>
                        </div>
                        <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1">
                          <i className="fas fa-user-graduate text-info"></i>
                          <span>Siswa Terdaftar: <strong>{breakdownData?.summary?.student_enrollment?.count || 0}</strong> ({breakdownData?.summary?.student_enrollment?.points || 0} pt)</span>
                        </div>
                      </div>
                    </div>

                    {/* Points History / Audit Trail */}
                    <h6 className="fw-bold mb-2">
                      <i className="fas fa-history text-success me-2"></i>
                      Riwayat Aktivitas Perolehan Poin:
                    </h6>

                    {breakdownData?.history && breakdownData.history.length > 0 ? (
                      <div className="list-group list-group-flush mb-4 border rounded-3 overflow-hidden">
                        {breakdownData.history.map((item) => (
                          <div key={item.id} className="list-group-item d-flex align-items-center justify-content-between p-3">
                            <div className="me-2">
                              <div className="fw-bold text-dark small">{item.description}</div>
                              <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                                {new Date(item.awarded_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </small>
                            </div>
                            <span className="badge bg-warning text-dark fw-bold px-2 py-1">
                              +{item.points_awarded} pt
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="alert alert-light border small text-muted mb-4">
                        <i className="fas fa-info-circle me-1"></i>
                        Poin ini tercatat dari total kontribusi awal pada sistem.
                      </div>
                    )}

                    {/* How Points Are Calculated (Rules) */}
                    <h6 className="fw-bold mb-2">
                      <i className="fas fa-book-open text-primary me-2"></i>
                      Cara Instruktur Memperoleh Poin:
                    </h6>
                    <div className="d-flex flex-column gap-2">
                      {breakdownData?.rules?.map((rule) => (
                        <div key={rule.key} className="p-2 px-3 bg-light rounded-3 border">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <strong className="small text-dark">{rule.title}</strong>
                            <span className="badge bg-success" style={{ fontSize: '0.72rem' }}>{rule.points_text}</span>
                          </div>
                          <small className="text-muted d-block" style={{ fontSize: '0.78rem' }}>{rule.description}</small>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-secondary btn-sm rounded-3 px-3" onClick={() => setShowModal(false)}>
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(RankedInstructors);
