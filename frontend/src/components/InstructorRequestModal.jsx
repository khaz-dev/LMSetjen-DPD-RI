import React, { useState, useEffect } from 'react';
import apiInstance from '../utils/axios';
import Toast from '../views/plugin/Toast';
import './InstructorRequestModal.css';

/**
 * Instructor Request Modal Component
 * 
 * Compact, eye-catching modal form for students/staff to request instructor/teacher role
 * in the LMSetjen DPD RI platform.
 * 
 * @param {Object} props
 * @param {boolean} props.show - Controls modal visibility
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onSuccess - Callback after successful submission
 * @param {Object} props.user - Current user data
 * @param {Object} props.existingRequest - If user has pending/rejected request
 */
const InstructorRequestModal = ({
  show = false,
  onClose = () => { },
  onSuccess = () => { },
  user = {},
  existingRequest = null
}) => {
  const [formData, setFormData] = useState({
    expertise_areas: '',
    bio: '',
    experience_level: 'BEGINNER'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [isReapplying, setIsReapplying] = useState(false);

  // Reset reapply flag when modal closes or existing request changes
  useEffect(() => {
    if (!show) {
      setIsReapplying(false);
    }
  }, [show]);

  if (!show) {
    return null;
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.expertise_areas.trim()) {
      newErrors.expertise_areas = 'Bidang keahlian tidak boleh kosong';
    }

    if (!formData.bio.trim()) {
      newErrors.bio = 'Biografi & ringkasan portofolio tidak boleh kosong';
    } else if (formData.bio.trim().length < 20) {
      newErrors.bio = 'Biografi minimal 20 karakter';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiInstance.post(
        '/instructor-request/',
        formData
      );

      Toast().fire({
        icon: 'success',
        title: 'Permintaan Dikirim',
        text: 'Permintaan Anda telah dikirim. Admin Setjen DPD RI akan meninjau dalam 1-2 hari kerja.',
      });

      // Reset form
      setFormData({
        expertise_areas: '',
        bio: '',
        experience_level: 'BEGINNER'
      });
      setErrors({});
      setIsReapplying(false);

      // Close modal and call success callback
      onClose();
      onSuccess(response.data);
    } catch (error) {
      console.error('Error submitting request:', error);

      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.error ||
        'Gagal mengirim permintaan. Silakan coba lagi.';

      Toast().fire({
        icon: 'error',
        title: 'Gagal Mengirim Permintaan',
        text: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // State 1: If user has existing pending request
  if (existingRequest && existingRequest.status === 'PENDING') {
    return (
      <div className="instructor-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
        <div
          className="instructor-modal-content instructor-modal-status"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="instructor-modal-top-accent"></div>

          <div className="instructor-modal-header">
            <div className="modal-header-top-row">
              <span className="instructor-brand-badge">
                <i className="fas fa-landmark"></i> LMSetjen DPD RI
              </span>
              <button
                type="button"
                className="btn-modal-close"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label="Tutup"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-header-content">
              <h5 className="modal-title">
                <i className="fas fa-hourglass-half text-amber"></i> Permintaan Instruktur
              </h5>
              <p className="modal-subtitle">
                Status verifikasi pengajuan instruktur internal DPD RI
              </p>
            </div>
          </div>

          <div className="instructor-modal-body">
            <div className="status-indicator-card pending">
              <div className="status-pill-row">
                <span className="status-pill status-pill-pending">
                  <span className="status-dot-pulse"></span>
                  Sedang Ditinjau Admin
                </span>
              </div>
              <h6 className="status-card-title">Permintaan Anda Dalam Proses Review</h6>
              <p className="status-card-desc">
                Tim Biro Kepegawaian & Diklat Sekretariat Jenderal DPD RI sedang memverifikasi profil keahlian Anda.
              </p>
            </div>

            <div className="instructor-compact-meta-grid">
              <div className="compact-meta-item">
                <span className="meta-label">
                  <i className="fas fa-calendar-alt text-teal"></i> Tanggal Pengajuan
                </span>
                <span className="meta-value">
                  {existingRequest.request_date
                    ? new Date(existingRequest.request_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '-'}
                </span>
              </div>
              <div className="compact-meta-item">
                <span className="meta-label">
                  <i className="fas fa-brain text-teal"></i> Bidang Keahlian
                </span>
                <span className="meta-value" title={existingRequest.expertise_areas}>
                  {existingRequest.expertise_areas || '-'}
                </span>
              </div>
            </div>

            <div className="instructor-trust-note mt-2">
              <i className="fas fa-bell text-teal"></i>
              <span>Anda akan menerima notifikasi otomatis ketika akun Anda disetujui.</span>
            </div>
          </div>

          <div className="instructor-modal-footer">
            <button
              type="button"
              className="btn-modal-cancel w-100"
              onClick={onClose}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 2: If user has rejected request (but not reapplying yet)
  if (existingRequest && existingRequest.status === 'REJECTED' && !isReapplying) {
    return (
      <div className="instructor-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
        <div
          className="instructor-modal-content instructor-modal-status"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="instructor-modal-top-accent"></div>

          <div className="instructor-modal-header">
            <div className="modal-header-top-row">
              <span className="instructor-brand-badge">
                <i className="fas fa-landmark"></i> LMSetjen DPD RI
              </span>
              <button
                type="button"
                className="btn-modal-close"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label="Tutup"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-header-content">
              <h5 className="modal-title">
                <i className="fas fa-circle-exclamation text-rose"></i> Status Pengajuan
              </h5>
              <p className="modal-subtitle">
                Hasil evaluasi permohonan instruktur DPD RI
              </p>
            </div>
          </div>

          <div className="instructor-modal-body">
            <div className="status-indicator-card rejected">
              <div className="status-pill-row">
                <span className="status-pill status-pill-rejected">
                  <i className="fas fa-circle-xmark me-1"></i> Perlu Perbaikan
                </span>
              </div>
              <h6 className="status-card-title">Pengajuan Belum Dapat Disetujui</h6>

              <div className="rejection-feedback-box">
                <div className="feedback-box-header">
                  <i className="fas fa-comment-dots text-rose me-1"></i>
                  <span>Catatan Evaluator:</span>
                </div>
                <p className="feedback-box-text">
                  {existingRequest.rejection_reason || 'Kriteria belum memenuhi standar minimal pengajar internal.'}
                </p>
              </div>
            </div>

            <div className="instructor-compact-meta-grid">
              <div className="compact-meta-item">
                <span className="meta-label">
                  <i className="fas fa-calendar-check text-teal"></i> Tanggal Review
                </span>
                <span className="meta-value">
                  {existingRequest.reviewed_date
                    ? new Date(existingRequest.reviewed_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '-'}
                </span>
              </div>
              <div className="compact-meta-item">
                <span className="meta-label">
                  <i className="fas fa-user-check text-teal"></i> Ditinjau Oleh
                </span>
                <span className="meta-value">
                  {existingRequest.reviewed_by_name || 'Tim Administrator'}
                </span>
              </div>
            </div>

            <div className="instructor-trust-note mt-2">
              <i className="fas fa-lightbulb text-amber"></i>
              <span>Perbaiki catatan di atas dan ajukan kembali permohonan Anda.</span>
            </div>
          </div>

          <div className="instructor-modal-footer">
            <button
              type="button"
              className="btn-modal-cancel"
              onClick={onClose}
            >
              Tutup
            </button>
            <button
              type="button"
              className="btn-modal-submit"
              onClick={() => {
                // Pre-fill form with previous submission data
                setFormData({
                  expertise_areas: existingRequest?.expertise_areas || '',
                  bio: existingRequest?.bio || '',
                  experience_level: existingRequest?.experience_level || 'BEGINNER'
                });
                setErrors({});
                setIsReapplying(true); // Switch to form view
              }}
            >
              <i className="fas fa-rotate-left me-1"></i> Mendaftar Ulang
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 3: Main request form (New request or reapplying)
  return (
    <div className="instructor-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="instructor-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="instructor-modal-top-accent"></div>

        <div className="instructor-modal-header">
          <div className="modal-header-top-row">
            <span className="instructor-brand-badge">
              <i className="fas fa-landmark"></i> LMSetjen DPD RI
            </span>
            <button
              type="button"
              className="btn-modal-close"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Tutup"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="modal-header-content">
            <h5 className="modal-title">
              <i className="fas fa-chalkboard-teacher text-amber"></i>
              <span>{isReapplying ? 'Pendaftaran Ulang Instruktur' : 'Pengajuan Instruktur Internal'}</span>
            </h5>
            <p className="modal-subtitle">
              Bagikan kompetensi Anda untuk mendukung pengembangan SDM aparatur DPD RI
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="instructor-modal-body">
            {isReapplying && (
              <div className="instructor-reapply-banner">
                <i className="fas fa-info-circle"></i>
                <span>Data sebelumnya telah dimuat. Silakan perbarui sebelum mengajukan kembali.</span>
              </div>
            )}

            {/* 2-Column Responsive Grid for Compact Space Utilization */}
            <div className="instructor-form-grid">
              {/* Expertise Areas */}
              <div className="form-group-item">
                <label htmlFor="expertise_areas" className="form-label">
                  <i className="fas fa-award text-teal me-1"></i> Bidang Keahlian <span className="text-danger">*</span>
                </label>
                <div className="input-with-icon-wrap">
                  <input
                    type="text"
                    className={`form-control ${errors.expertise_areas ? 'is-invalid' : ''}`}
                    id="expertise_areas"
                    name="expertise_areas"
                    placeholder="cth: TI, Legislasi, Keprotokolan"
                    value={formData.expertise_areas}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                </div>
                {errors.expertise_areas ? (
                  <div className="invalid-feedback d-block">
                    {errors.expertise_areas}
                  </div>
                ) : (
                  <span className="form-inline-hint">Pisahkan koma jika lebih dari 1</span>
                )}
              </div>

              {/* Experience Level */}
              <div className="form-group-item">
                <label htmlFor="experience_level" className="form-label">
                  <i className="fas fa-layer-group text-teal me-1"></i> Pengalaman <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  id="experience_level"
                  name="experience_level"
                  value={formData.experience_level}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                >
                  <option value="BEGINNER">Pemula (0-2 tahun)</option>
                  <option value="INTERMEDIATE">Menengah (2-5 tahun)</option>
                  <option value="ADVANCED">Lanjutan (5+ tahun)</option>
                </select>
                <span className="form-inline-hint">Tingkat jam terbang di bidang terkait</span>
              </div>
            </div>

            {/* Bio & Portfolio Summary */}
            <div className="form-group-item mt-2">
              <div className="form-label-row">
                <label htmlFor="bio" className="form-label mb-0">
                  <i className="fas fa-file-lines text-teal me-1"></i> Biografi & Ringkasan Portofolio <span className="text-danger">*</span>
                </label>
                <span className={`bio-char-counter ${formData.bio.trim().length >= 20 ? 'valid' : ''}`}>
                  {formData.bio.trim().length} / 20 min
                </span>
              </div>
              <textarea
                className={`form-control ${errors.bio ? 'is-invalid' : ''}`}
                id="bio"
                name="bio"
                rows="3"
                placeholder="Ceritakan ringkasan pengalaman, rekam jejak, dan materi yang ingin Anda ajarkan..."
                value={formData.bio}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
              {errors.bio && (
                <div className="invalid-feedback d-block">
                  {errors.bio}
                </div>
              )}
            </div>

            {/* Trust and SLA Note */}
            <div className="instructor-trust-note">
              <i className="fas fa-shield-halved text-teal"></i>
              <span>Ditinjau oleh Admin LMSetjen DPD RI (1-2 hari kerja).</span>
            </div>
          </div>

          <div className="instructor-modal-footer">
            <button
              type="button"
              className="btn-modal-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-modal-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Mengirim...
                </>
              ) : (
                <>
                  <span>{isReapplying ? 'Kirim Ulang Permintaan' : 'Kirim Pengajuan'}</span>
                  <i className="fas fa-paper-plane ms-2"></i>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default React.memo(InstructorRequestModal);
