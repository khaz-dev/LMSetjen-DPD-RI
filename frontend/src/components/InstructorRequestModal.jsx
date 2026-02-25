import React, { useState, useEffect } from 'react';
import apiInstance from '../utils/axios';
import Toast from '../views/plugin/Toast';
import './InstructorRequestModal.css';

/**
 * Instructor Request Modal Component
 * 
 * Modal form for students to request instructor/teacher role.
 * Collects expertise areas, bio, and experience level.
 * 
 * @param {Object} props
 * @param {boolean} props.show - Controls modal visibility
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onSuccess - Callback after successful submission
 * @param {Object} props.user - Current user data
 * @param {Object} props.existingRequest - If user has pending request
 */
const InstructorRequestModal = ({
  show = false,
  onClose = () => {},
  onSuccess = () => {},
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
  const [isReapplying, setIsReapplying] = useState(false); // Track when user clicks Mendaftar Ulang

  // Reset reapply flag when modal closes or existing request changes
  useEffect(() => {
    if (!show) {
      setIsReapplying(false);
    }
  }, [show]);

  if (!show) {
    return null;
  }

  const getExperienceLevelLabel = (level) => {
    const labelMap = {
      BEGINNER: 'Pemula',
      INTERMEDIATE: 'Menengah',
      ADVANCED: 'Lanjutan'
    };
    return labelMap[level] || level;
  };

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
      newErrors.bio = 'Biografi tidak boleh kosong';
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
        text: 'Permintaan Anda telah dikirim. Admin akan meninjau dalam 1-2 hari kerja.',
      });

      // Reset form
      setFormData({
        expertise_areas: '',
        bio: '',
        experience_level: 'BEGINNER'
      });
      setErrors({});
      setIsReapplying(false); // Reset reapply flag

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

  // If user has existing pending request
  if (existingRequest && existingRequest.status === 'PENDING') {
    return (
      <div className="instructor-modal-overlay" onClick={onClose}>
        <div 
          className="instructor-modal-content" 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header border-0">
            <h5 className="modal-title">
              <i className="fas fa-hourglass-half text-warning"></i> Permintaan Tertunda
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close"
            />
          </div>
          <div className="modal-body">
            <div className="alert alert-info">
              <i className="fas fa-info-circle"></i>
              <strong className="ms-2">Anda sudah memiliki permintaan yang menunggu review</strong>
            </div>
            <p className="text-muted">
              Admin kami sedang meninjau permintaan Anda untuk menjadi instruktur. 
              Anda akan menerima notifikasi ketika ada keputusan.
            </p>
            <p className="text-muted small">
              <strong>Tanggal Permintaan:</strong> {new Date(existingRequest.request_date).toLocaleDateString('id-ID')}
            </p>
          </div>
          <div className="modal-footer border-0">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user has rejected request (but not reapplying)
  if (existingRequest && existingRequest.status === 'REJECTED' && !isReapplying) {
    return (
      <div className="instructor-modal-overlay" onClick={onClose}>
        <div 
          className="instructor-modal-content" 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header border-0">
            <h5 className="modal-title">
              <i className="fas fa-times-circle text-danger"></i> Permintaan Ditolak
            </h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close"
            />
          </div>
          <div className="modal-body">
            <div className="alert alert-warning">
              <strong>Alasan Penolakan:</strong>
            </div>
            <p className="text-muted">
              {existingRequest.rejection_reason || 'Tidak ada alasan yang diberikan'}
            </p>
            <p className="text-muted small mt-3">
              <strong>Tanggal Review:</strong> {
                existingRequest.reviewed_date 
                  ? new Date(existingRequest.reviewed_date).toLocaleDateString('id-ID')
                  : 'Tanggal tidak tersedia'
              }
            </p>
            {existingRequest.reviewed_by_name && (
              <p className="text-muted small mt-2">
                <strong>Ditinjau oleh:</strong> {existingRequest.reviewed_by_name}
              </p>
            )}
            <div className="alert alert-info mt-3">
              <i className="fas fa-lightbulb"></i>
              <span className="ms-2">Anda dapat mendaftar ulang setelah memperbaiki kekurangan yang disebutkan di atas.</span>
            </div>
          </div>
          <div className="modal-footer border-0">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
            >
              Tutup
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
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
              Mendaftar Ulang
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main form for new request
  return (
    <div className="instructor-modal-overlay" onClick={onClose}>
      <div 
        className="instructor-modal-content" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header border-0">
          <h5 className="modal-title">
            <i className="fas fa-chalkboard-user"></i> Jadilah Instruktur
          </h5>
          <button 
            type="button" 
            className="btn-close" 
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
          />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="text-muted mb-3">
              Kami mencari instruktur berbakat untuk berbagi pengetahuan dengan komunitas kami.
              Isi formulir di bawah untuk mengajukan permohonan Anda.
            </p>

            {/* Expertise Areas */}
            <div className="mb-3">
              <label htmlFor="expertise_areas" className="form-label">
                Bidang Keahlian <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className={`form-control ${errors.expertise_areas ? 'is-invalid' : ''}`}
                id="expertise_areas"
                name="expertise_areas"
                placeholder="Contoh: Python, Django, Web Development"
                value={formData.expertise_areas}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
              {errors.expertise_areas && (
                <div className="invalid-feedback d-block">
                  {errors.expertise_areas}
                </div>
              )}
              <small className="text-muted d-block mt-1">
                Pisahkan dengan koma jika lebih dari satu
              </small>
            </div>

            {/* Experience Level */}
            <div className="mb-3">
              <label htmlFor="experience_level" className="form-label">
                Tingkat Pengalaman <span className="text-danger">*</span>
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
            </div>

            {/* Bio */}
            <div className="mb-3">
              <label htmlFor="bio" className="form-label">
                Biografi Singkat <span className="text-danger">*</span>
              </label>
              <textarea
                className={`form-control ${errors.bio ? 'is-invalid' : ''}`}
                id="bio"
                name="bio"
                rows="4"
                placeholder="Ceritakan tentang pengalaman Anda, pencapaian, dan motivasi Anda menjadi instruktur..."
                value={formData.bio}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />
              {errors.bio && (
                <div className="invalid-feedback d-block">
                  {errors.bio}
                </div>
              )}
              <small className="text-muted d-block mt-1">
                Minimal 20 karakter
              </small>
            </div>

            <div className="alert alert-light border">
              <i className="fas fa-shield-alt text-primary"></i>
              <small className="ms-2 text-muted">
                Admin kami akan meninjau aplikasi Anda dalam 1-2 hari kerja. 
                Anda akan menerima notifikasi tentang keputusan.
              </small>
            </div>
          </div>

          <div className="modal-footer border-0">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Mengirim...
                </>
              ) : (
                <>
                  <i className="fas fa-send me-1"></i>
                  Kirim Permintaan
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
