import React, { useState, useEffect } from 'react';
import apiInstance from '../utils/axios';
import UserData from '../views/plugin/UserData';
import Toast from '../views/plugin/Toast';
import './InstructorRequestStatus.css';

/**
 * Instructor Request Status Component
 * 
 * Displays the current status of user's instructor request.
 * Shows pending, approved, or rejected status with relevant actions.
 * 
 * @param {Object} props
 * @param {Function} props.onRequestAction - Callback when user takes action (approve/reject/submit)
 * @param {boolean} props.compact - Show compact version (for sidebar/widget)
 */
function InstructorRequestStatus({ onRequestAction = () => {}, compact = false }) {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const userData = UserData();

  useEffect(() => {
    if (userData?.user_id) {
      fetchRequestStatus();
    }
  }, [userData?.user_id]);

  const fetchRequestStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiInstance.get('/instructor-request/');

      if (response.data) {
        // Could be single object or array
        const requestData = Array.isArray(response.data) 
          ? response.data[0] 
          : response.data;
        
        setRequest(requestData || null);
      }
    } catch (error) {
      // 404 or no request means user hasn't requested yet
      if (error.response?.status === 404) {
        setRequest(null);
        setError(null);
      } else {
        console.error('Error fetching request status:', error);
        setError('Gagal memuat status permintaan');
      }
    } finally {
      setLoading(false);
    }
  };

  const getExperienceLevelLabel = (level) => {
    const labelMap = {
      BEGINNER: 'Pemula',
      INTERMEDIATE: 'Menengah',
      ADVANCED: 'Lanjutan'
    };
    return labelMap[level] || level;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      PENDING: '#ff9800',
      APPROVED: '#4caf50',
      REJECTED: '#f44336'
    };
    return colorMap[status] || '#999';
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      PENDING: 'fa-hourglass-half',
      APPROVED: 'fa-check-circle',
      REJECTED: 'fa-times-circle'
    };
    return iconMap[status] || 'fa-question-circle';
  };

  const getStatusLabel = (status) => {
    const labelMap = {
      PENDING: 'Tertunda',
      APPROVED: 'Disetujui',
      REJECTED: 'Ditolak'
    };
    return labelMap[status] || status;
  };

  if (loading) {
    return (
      <div className={`instructor-status-container ${compact ? 'compact' : ''}`}>
        <div className="loading-spinner">
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <span>Memuat status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`instructor-status-container ${compact ? 'compact' : ''}`}>
        <div className="alert alert-danger">
          <i className="fas fa-exclamation-circle"></i>
          <span className="ms-2">{error}</span>
        </div>
      </div>
    );
  }

  // No request - show CTA
  if (!request) {
    if (compact) {
      return (
        <div className="instructor-status-compact">
          <div className="status-cta">
            <i className="fas fa-user-tie"></i>
            <p>Ingin menjadi instruktur?</p>
            <button 
              className="btn btn-sm btn-primary"
              onClick={() => onRequestAction('open-modal')}
            >
              Daftar Sekarang
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="instructor-status-container">
        <div className="status-card no-request">
          <div className="card-icon">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <div className="card-content">
            <h3>Belum Menjadi Instruktur?</h3>
            <p className="text-muted">
              Bagikan pengetahuan Anda dengan komunitas. Daftar sebagai instruktur hari ini!
            </p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => onRequestAction('open-modal')}
          >
            <i className="fas fa-user-tie"></i> Ajukan Permohonan
          </button>
        </div>
      </div>
    );
  }

  // Has request - show status
  const statusColor = getStatusColor(request.status);
  const statusIcon = getStatusIcon(request.status);
  const statusLabel = getStatusLabel(request.status);

  if (compact) {
    return (
      <div className="instructor-status-compact">
        <div className="status-badge" style={{ borderColor: statusColor }}>
          <i className={`fas ${statusIcon}`} style={{ color: statusColor }}></i>
          <div className="badge-content">
            <p className="badge-label">Status Permintaan</p>
            <p className="badge-value" style={{ color: statusColor }}>{statusLabel}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="instructor-status-container">
      <div className="status-card">
        {/* Header */}
        <div className="card-header" style={{ borderLeftColor: statusColor }}>
          <div className="header-icon" style={{ backgroundColor: statusColor }}>
            <i className={`fas ${statusIcon}`}></i>
          </div>
          <div className="header-content">
            <h3 style={{ color: statusColor }}>Status Permintaan: {statusLabel}</h3>
            <p className="text-muted small">
              Diminta pada {new Date(request.request_date).toLocaleDateString('id-ID')}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="card-body">
          {/* Request Details */}
          <div className="details-grid">
            <div className="detail-item">
              <label>Bidang Keahlian</label>
              <p>{request.expertise_areas || '-'}</p>
            </div>
            <div className="detail-item">
              <label>Tingkat Pengalaman</label>
              <p>{getExperienceLevelLabel(request.experience_level)}</p>
            </div>
          </div>

          <div className="detail-full">
            <label>Biografi</label>
            <p>{request.bio || '-'}</p>
          </div>

          {/* Status-specific info */}
          {request.status === 'PENDING' && (
            <div className="alert alert-info">
              <i className="fas fa-info-circle"></i>
              <span className="ms-2">
                Admin kami sedang meninjau permintaan Anda. Anda akan menerima notifikasi 
                email ketika ada keputusan dalam 1-2 hari kerja.
              </span>
            </div>
          )}

          {request.status === 'APPROVED' && (
            <div className="alert alert-success">
              <i className="fas fa-check-circle"></i>
              <span className="ms-2">
                Selamat! Permintaan Anda telah disetujui. Anda sekarang dapat membuat dan 
                mengelola kursus.
              </span>
            </div>
          )}

          {request.status === 'REJECTED' && (
            <>
              <div className="alert alert-warning">
                <strong>Alasan Penolakan:</strong>
                <p className="mt-2 mb-0">{request.rejection_reason || '-'}</p>
              </div>
              <div className="alert alert-info">
                <i className="fas fa-lightbulb"></i>
                <span className="ms-2">
                  Anda dapat mencoba mendaftar ulang setelah memperbaiki poin-poin yang disebutkan di atas.
                </span>
              </div>
            </>
          )}

          {/* Review info */}
          {(request.status === 'APPROVED' || request.status === 'REJECTED') && request.reviewed_date && (
            <div className="review-info">
              <small className="text-muted">
                <i className="fas fa-user-check"></i> Ditinjau oleh {request.reviewed_by_name || 'Admin'} 
                pada {new Date(request.reviewed_date).toLocaleDateString('id-ID')}
              </small>
            </div>
          )}
        </div>

        {/* Footer - Actions */}
        {request.status === 'REJECTED' && (
          <div className="card-footer">
            <button 
              className="btn btn-primary"
              onClick={() => onRequestAction('reapply')}
            >
              <i className="fas fa-redo"></i> Mendaftar Ulang
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(InstructorRequestStatus);
