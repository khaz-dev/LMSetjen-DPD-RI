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

  /**
   * Handle broken image - show gradient fallback
   */
  const handleImageError = (instructorId) => {
    setBrokenImages(prev => ({ ...prev, [instructorId]: true }));
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
                  : 'btn-secondary'
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
          <p className="text-muted mb-0">Belum ada data untuk periode ini</p>
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
                    onError={() => handleImageError(instructor.id)}
                  />
                ) : (
                  <div className="ranking-avatar rounded-circle avatar-placeholder instructor-accent">
                    <img
                      src="/images/placeholders/default-instructor.svg"
                      alt={instructor.full_name}
                      className="placeholder-image"
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

              {/* Points Display */}
              <div className="ranking-points text-end">
                <div className="points-value">
                  {instructor.lifetime_points || instructor.yearly_points || instructor.monthly_points || 0}
                </div>
                <small className="points-label text-muted">poin</small>
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
        <small className="text-muted">
          <i className="fas fa-info-circle me-1"></i>
          Dapatkan poin dari siswa yang mendaftar dan memberi rating
        </small>
      </div>
    </div>
  );
};

export default React.memo(RankedInstructors);
