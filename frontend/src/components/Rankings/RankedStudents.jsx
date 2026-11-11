/**
 * ✨ PHASE 10.1: RankedStudents Component
 * Displays top students ranked by points with filtering by period (lifetime, yearly, monthly)
 * and interactive detailed Points Breakdown modal.
 * Shown on homepage CTA section & rankings page
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import apiInstance from '../../utils/axios';
import Toast from '../../views/plugin/Toast';
import './Rankings.css';

const RankedStudents = ({ maxResults = 5 }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('lifetime');
  const [brokenImages, setBrokenImages] = useState({});

  // Modal State for Rincian Poin Siswa
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [breakdownData, setBreakdownData] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalPeriod, setModalPeriod] = useState('lifetime');

  /**
   * Fetch ranked students from API
   */
  const fetchRankedStudents = async (selectedPeriod = 'lifetime') => {
    try {
      setLoading(true);
      const endpoint = `/rankings/students/${selectedPeriod}/`;
      const response = await apiInstance.get(endpoint);
      
      // Take only first maxResults items
      if (response.data && Array.isArray(response.data)) {
        setStudents(response.data.slice(0, maxResults));
      } else if (response.data && response.data.results) {
        setStudents(response.data.results.slice(0, maxResults));
      }
    } catch (error) {
      console.error('Error fetching ranked students:', error);
      // Only show error toast for actual server errors (5xx), not for 404s or empty results
      if (error.response?.status >= 500) {
        Toast().fire({
          icon: 'error',
          title: 'Error',
          text: 'Gagal memuat daftar peserta terbaik'
        });
      }
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch breakdown data for a student with a specific period filter
   */
  const fetchBreakdown = async (student, targetPeriod) => {
    setLoadingBreakdown(true);
    try {
      const userId = student.user_id || student.user?.id || '';
      const studentId = student.id || student.student_id || '';
      const response = await apiInstance.get(
        `/student/points-breakdown/?user_id=${userId}&student_id=${studentId}&period=${targetPeriod}`
      );
      if (response.data) {
        setBreakdownData(response.data);
      }
    } catch (err) {
      console.error('Error fetching student breakdown:', err);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  /**
   * Handle opening breakdown modal for a student
   */
  const handleOpenBreakdown = (student) => {
    setSelectedStudent(student);
    setModalPeriod(period);
    setShowModal(true);
    fetchBreakdown(student, period);
  };

  /**
   * Handle changing period filter inside breakdown modal
   */
  const handleModalPeriodChange = (newPeriod) => {
    setModalPeriod(newPeriod);
    if (selectedStudent) {
      fetchBreakdown(selectedStudent, newPeriod);
    }
  };

  /**
   * Effect hook to fetch data when period changes
   */
  useEffect(() => {
    fetchRankedStudents(period);
  }, [period]);

  /**
   * Handle period filter change
   */
  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
  };

  /**
   * Handle broken image - show gradient fallback
   */
  const handleImageError = (studentId) => {
    setBrokenImages(prev => ({ ...prev, [studentId]: true }));
  };

  /**
   * Get points value based on current period or API returned points
   */
  const getPoints = (student, targetPeriod = period) => {
    if (!student) return 0;
    if (targetPeriod === 'monthly') return student?.monthly_points ?? 0;
    if (targetPeriod === 'yearly') return student?.yearly_points ?? 0;
    if (targetPeriod === 'lifetime') return student?.lifetime_points ?? 0;
    if (student?.points !== undefined && student?.points !== null) {
      return student.points;
    }
    return student?.lifetime_points ?? 0;
  };

  return (
    <div className="ranked-students-widget card h-100 shadow-sm">
      {/* Header */}
      <div className="card-header bg-gradient-primary text-white d-flex justify-content-between align-items-center">
        <h5 className="mb-0 d-flex align-items-center gap-2">
          <i className="fas fa-graduation-cap"></i>
          <span>Peserta Terbaik</span>
        </h5>
        <span className="badge bg-white text-primary fw-bold">Top {students.length > 0 ? students.length : maxResults}</span>
      </div>

      {/* Filter Buttons */}
      <div className="ranking-filters p-2 px-3 border-bottom">
        <div className="btn-group d-flex gap-1" role="group">
          {['lifetime', 'yearly', 'monthly'].map((p) => (
            <button
              key={p}
              className={`btn btn-sm flex-fill ${
                period === p 
                  ? 'btn-primary' 
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
          <div className="spinner-border spinner-border-sm text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-1 text-muted small mb-0">Memuat peringkat...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && students.length === 0 && (
        <div className="card-body text-center py-3 empty-state-compact">
          <i className="fas fa-inbox text-muted mb-1" style={{ fontSize: '1.4rem' }}></i>
          <p className="text-muted mb-0 small">
            {period === 'monthly'
              ? 'Belum ada data untuk bulan ini'
              : period === 'yearly'
              ? 'Belum ada data untuk tahun ini'
              : 'Belum ada data peserta'}
          </p>
        </div>
      )}

      {/* Rankings List */}
      {!loading && students.length > 0 && (
        <div className="rankings-list">
          {students.map((student, index) => (
            <div
              key={student.id}
              className={`ranking-item d-flex align-items-center top-${student.rank_position} ${
                index < students.length - 1 ? 'border-bottom' : ''
              }`}
            >
              {/* Rank Badge & Avatar */}
              <div className="rank-badge-avatar-group d-flex align-items-center">
                <div className={`badge-rank-pill rank-${student.rank_position}`}>
                  {student.rank_position === 1 ? (
                    <i className="fas fa-crown text-warning" title="Peringkat 1"></i>
                  ) : (
                    student.rank
                  )}
                </div>
                <div className="rank-avatar-box">
                  {!brokenImages[student.id] ? (
                    <img
                      src={student.image || '/images/placeholders/default-avatar.svg'}
                      alt={student.full_name}
                      className="ranking-avatar rounded-circle"
                      loading="lazy"
                      decoding="async"
                      width="42"
                      height="42"
                      onError={() => handleImageError(student.id)}
                    />
                  ) : (
                    <div className="ranking-avatar rounded-circle avatar-placeholder student-accent">
                      <img
                        src="/images/placeholders/default-avatar.svg"
                        alt={student.full_name}
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

              {/* Student Info */}
              <div className="ranking-info flex-grow-1 min-w-0 ms-2">
                <div className="d-flex align-items-center gap-1 mb-0 flex-wrap">
                  <h6 className="mb-0 text-truncate" title={student.full_name}>
                    {student.full_name}
                  </h6>
                  {student.manta_level_name && (
                    <span 
                      className="badge rounded-pill text-white flex-shrink-0" 
                      style={{ 
                        backgroundColor: student.manta_level_color || '#10b981', 
                        fontSize: '0.64rem',
                        padding: '2px 7px',
                        fontWeight: 600
                      }}
                      title={`Tingkat Kompetensi ASN: Level ${student.manta_level || 1} (${student.manta_level_name})`}
                    >
                      <i className={`${student.manta_level_icon || 'fas fa-seedling'} me-1`}></i>
                      {student.manta_level_name}
                    </span>
                  )}
                </div>
                <small className="text-muted d-block text-truncate">
                  {student.position_name || student.organization_unit_name || student.country || '—'}
                </small>
              </div>

              {/* Points Display - Interactive with Click to View Breakdown */}
              <div 
                className="ranking-points text-end"
                style={{ cursor: 'pointer' }}
                onClick={() => handleOpenBreakdown(student)}
                title="Klik untuk melihat darimana poin ini diperoleh"
              >
                <div className="points-value d-flex align-items-center justify-content-end gap-1">
                  <span>{getPoints(student)}</span>
                  <i className="fas fa-circle-info text-primary ms-1" style={{ fontSize: '0.8rem' }}></i>
                </div>
                <small className="points-label text-muted d-block">
                  poin • <span className="text-primary fw-bold">rincian</span>
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
          Poin diakumulasikan dari penyelesaian kursus, kelulusan kuis, forum & keaktifan belajar
        </small>
      </div>

      {/* Modal Rincian Perolehan Poin Siswa (Portaled to document.body to center on viewport) */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal fade show d-block modal-student-points-breakdown" 
          tabIndex="-1" 
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 10050 }}
          onClick={() => setShowModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content rounded-4 shadow-lg border-0 overflow-hidden">
              <div className="modal-header py-3">
                <h5 className="modal-title fw-bold fs-6 mb-0">
                  <i className="fas fa-trophy me-2"></i>
                  Rincian Poin Peserta
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body p-3 p-md-4">
                {/* Period Filter Tabs inside Modal - High Contrast */}
                <div className="d-flex justify-content-center mb-3">
                  <div className="modal-period-filter-pill d-inline-flex rounded-pill" role="group">
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-1 ${modalPeriod === 'lifetime' ? 'modal-filter-btn-active student-filter-active' : 'modal-filter-btn-inactive'}`}
                      onClick={() => handleModalPeriodChange('lifetime')}
                    >
                      Sepanjang Masa
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-1 ${modalPeriod === 'yearly' ? 'modal-filter-btn-active student-filter-active' : 'modal-filter-btn-inactive'}`}
                      onClick={() => handleModalPeriodChange('yearly')}
                    >
                      Tahun Ini
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 py-1 ${modalPeriod === 'monthly' ? 'modal-filter-btn-active student-filter-active' : 'modal-filter-btn-inactive'}`}
                      onClick={() => handleModalPeriodChange('monthly')}
                    >
                      Bulan Ini
                    </button>
                  </div>
                </div>

                {/* Student Card Header */}
                <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 mb-3 border">
                  <img
                    src={selectedStudent?.image || '/images/placeholders/default-avatar.svg'}
                    alt={selectedStudent?.full_name}
                    className="rounded-circle border"
                    width="48"
                    height="48"
                    style={{ objectFit: 'cover' }}
                  />
                  <div>
                    <h6 className="fw-bold mb-0 text-dark">{selectedStudent?.full_name}</h6>
                    <small className="text-muted">{selectedStudent?.position_name || selectedStudent?.organization_unit_name || 'Peserta LMS'}</small>
                  </div>
                  <div className="ms-auto text-end">
                    <span className="badge fs-6 px-3 py-2" style={{ backgroundColor: '#1d4ed8', color: '#ffffff', fontWeight: 700 }}>
                      {breakdownData?.period_points !== undefined ? breakdownData.period_points : getPoints(selectedStudent, modalPeriod)} Poin
                    </span>
                    <small className="d-block text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                      {modalPeriod === 'monthly' ? 'Bulan Ini' : modalPeriod === 'yearly' ? 'Tahun Ini' : 'Sepanjang Masa'}
                    </small>
                  </div>
                </div>

                {loadingBreakdown ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Memuat rincian...</span>
                    </div>
                    <p className="mt-2 text-muted small">Memuat data periode {modalPeriod === 'monthly' ? 'bulan ini' : modalPeriod === 'yearly' ? 'tahun ini' : 'sepanjang masa'}...</p>
                  </div>
                ) : (
                  <>
                    {/* ✨ Manta AI Gamification & Milestone Badges Card */}
                    {breakdownData?.gamification && (
                      <div className="p-3 rounded-3 mb-3 border shadow-xs" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f0fdfa 100%)', borderColor: '#ccfbf1' }}>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <div className="d-flex align-items-center gap-2">
                            <span 
                              className="badge rounded-pill text-white px-3 py-1 shadow-xs"
                              style={{ 
                                backgroundColor: breakdownData.gamification.level_color || '#10b981',
                                fontSize: '0.75rem',
                                fontWeight: 700 
                              }}
                            >
                              <i className={`${breakdownData.gamification.level_icon || 'fas fa-seedling'} me-1`}></i>
                              Level {breakdownData.gamification.level}: {breakdownData.gamification.level_name}
                            </span>
                            <span className="badge bg-white text-dark border px-2 py-1" style={{ fontSize: '0.72rem' }}>
                              {breakdownData.gamification.xp?.toLocaleString('id-ID')} XP
                            </span>
                          </div>
                          {breakdownData.gamification.streak_days > 0 && (
                            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1" style={{ fontSize: '0.72rem' }}>
                              <i className="fas fa-fire-flame-curved text-danger me-1"></i>
                              {breakdownData.gamification.streak_days} Hari Streak
                            </span>
                          )}
                        </div>

                        {/* XP Progress Bar */}
                        <div className="mb-2">
                          <div className="d-flex justify-content-between text-muted" style={{ fontSize: '0.7rem' }}>
                            <span>Progres Tingkat ASN: <strong>{breakdownData.gamification.xp_progress_pct}%</strong></span>
                            {breakdownData.gamification.level < 6 ? (
                              <span>Ke <strong>{breakdownData.gamification.next_level_name}</strong>: tersisa {breakdownData.gamification.remaining_xp} XP</span>
                            ) : (
                              <span className="text-success fw-bold">Tingkat Tertinggi</span>
                            )}
                          </div>
                          <div className="progress mt-1" style={{ height: '6px', borderRadius: '4px', backgroundColor: '#e2e8f0' }}>
                            <div 
                              className="progress-bar progress-bar-striped progress-bar-animated"
                              role="progressbar" 
                              style={{ 
                                width: `${breakdownData.gamification.xp_progress_pct}%`,
                                backgroundColor: breakdownData.gamification.level_color || '#10b981'
                              }}
                            ></div>
                          </div>
                        </div>

                        {/* Mini Badges Shelf */}
                        {breakdownData.gamification.badges && (
                          <div className="pt-2 border-top">
                            <div className="d-flex align-items-center justify-content-between mb-1">
                              <small className="fw-bold text-muted text-uppercase" style={{ fontSize: '0.68rem' }}>
                                Lencana Prestasi ({breakdownData.gamification.unlocked_count}/{breakdownData.gamification.total_badges} Terbuka):
                              </small>
                              <small className="text-teal fw-semibold" style={{ fontSize: '0.68rem' }}>
                                Target 20 JP: {breakdownData.gamification.total_jp || 0}/20 JP
                              </small>
                            </div>
                            <div className="d-flex flex-wrap gap-1">
                              {breakdownData.gamification.badges.map((b) => (
                                <span
                                  key={b.id}
                                  className={`badge d-inline-flex align-items-center gap-1 border px-2 py-1 ${b.is_unlocked ? 'bg-white text-dark shadow-xs' : 'bg-light text-muted opacity-75'}`}
                                  style={{ fontSize: '0.68rem' }}
                                  title={`${b.title}: ${b.description} (${b.progress})`}
                                >
                                  <i className={b.icon} style={{ color: b.is_unlocked ? b.color : '#94a3b8' }}></i>
                                  <span>{b.title}</span>
                                  {b.is_unlocked && <i className="fas fa-check-circle text-success ms-1" style={{ fontSize: '0.6rem' }}></i>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Summary category badges */}
                    <div className="p-3 bg-light rounded-3 border mb-3">
                      <small className="fw-bold text-muted d-block mb-2 text-uppercase" style={{ fontSize: '0.72rem' }}>
                        Sumber Perolehan Poin ({modalPeriod === 'monthly' ? 'Bulan Ini' : modalPeriod === 'yearly' ? 'Tahun Ini' : 'Sepanjang Masa'}):
                      </small>
                      <div className="d-flex flex-wrap gap-2">
                        <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1 shadow-xs">
                          <i className="fas fa-graduation-cap text-primary"></i>
                          <span>Penyelesaian Kursus: <strong>{breakdownData?.summary?.course_completion?.count || 0}</strong> ({breakdownData?.summary?.course_completion?.points || 0} pt)</span>
                        </div>
                        <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1 shadow-xs">
                          <i className="fas fa-clipboard-check text-success"></i>
                          <span>Kuis & Ujian: <strong>{breakdownData?.summary?.quiz_score?.count || 0}</strong> ({breakdownData?.summary?.quiz_score?.points || 0} pt)</span>
                        </div>
                        <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1 shadow-xs">
                          <i className="fas fa-star text-warning"></i>
                          <span>Ulasan & Rating: <strong>{breakdownData?.summary?.rating_given?.count || 0}</strong> ({breakdownData?.summary?.rating_given?.points || 0} pt)</span>
                        </div>
                        {breakdownData?.summary?.platform_testimonial?.count > 0 && (
                          <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1 shadow-xs">
                            <i className="fas fa-heart text-danger"></i>
                            <span>Testimoni Platform: <strong>{breakdownData?.summary?.platform_testimonial?.count || 0}</strong> ({breakdownData?.summary?.platform_testimonial?.points || 0} pt)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Points History / Audit Trail */}
                    <h6 className="fw-bold mb-2 small text-dark">
                      <i className="fas fa-history text-primary me-2"></i>
                      Riwayat Aktivitas Perolehan Poin:
                    </h6>

                    {breakdownData?.history && breakdownData.history.length > 0 ? (
                      <div className="list-group list-group-flush mb-2 border rounded-3 points-history-scroll-container student-scroll" style={{ maxHeight: '240px', overflowY: 'auto', overflowX: 'hidden' }}>
                        {breakdownData.history.map((item) => (
                          <div key={item.id} className="list-group-item d-flex align-items-center justify-content-between p-2 px-3">
                            <div className="me-2">
                              <div className="fw-semibold text-dark small">{item.description}</div>
                              <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                                {new Date(item.awarded_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </small>
                            </div>
                            <span className="badge bg-primary text-white fw-bold px-2 py-1 ms-2 flex-shrink-0">
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

export default React.memo(RankedStudents);
