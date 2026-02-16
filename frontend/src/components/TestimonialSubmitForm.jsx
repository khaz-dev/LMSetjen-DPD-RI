import React, { useState, memo, useEffect, useRef } from 'react';
import apiInstance from '../utils/axios';
import Toast, { DeleteConfirmation } from '../views/plugin/Toast';
import UserData from '../views/plugin/UserData';

/**
 * Testimonial Submission Form Component
 * Allows students and instructors to submit or edit testimonials
 * Supports multiple testimonials per user based on role
 * ✨ PHASE 4.11: Multi-role testimonial support
 */
function TestimonialSubmitForm({ onSuccess, initialData = null, role = 'student' }) {
  const userData = UserData();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [existingTestimonial, setExistingTestimonial] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const fetchAttempted = useRef(false); // Prevent duplicate fetch requests
  const [formData, setFormData] = useState({
    rating: initialData?.rating || 5,
    review: initialData?.review || '',
  });

  // Load user's existing testimonial for this role on mount (only attempt once)
  useEffect(() => {
    // Only fetch if we have user data and haven't already tried fetching
    // Check for any sign of authenticated user (email, username, or user_id)
    const isAuthenticated = userData && (userData?.user_id || userData?.id || userData?.email);
    
    if (isAuthenticated && !initialData && !fetchAttempted.current) {
      fetchAttempted.current = true;
      
      const fetchExistingTestimonial = async () => {
        try {
          // ✨ PHASE 4.11: Pass role parameter to get testimonial for specific role
          const response = await apiInstance.get(`student/testimonial/?role=${role}`);
          // Check if we got actual data (not null/undefined)
          if (response.data && response.data.id) {
            setExistingTestimonial(response.data);
            setFormData({
              rating: response.data.rating || 5,
              review: response.data.review || '',
            });
          } else {
            // No testimonial found (data is null or empty)
            setExistingTestimonial(null);
          }
        } catch (error) {
          // Only log non-404 errors
          if (error.response?.status !== 404) {
            console.error('Error fetching existing testimonial:', error);
          }
          setExistingTestimonial(null);
        } finally {
          setHasLoaded(true);
        }
      };

      fetchExistingTestimonial();
    } else if (!isAuthenticated && !initialData) {
      // User not authenticated yet
      setHasLoaded(true);
    }
  }, [role]); // ✨ PHASE 4.11: Re-fetch when role changes

  const handleRatingChange = (star) => {
    setFormData({ ...formData, rating: star });
  };

  const handleReviewChange = (e) => {
    setFormData({ ...formData, review: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.review.trim()) {
      Toast().fire({
        icon: 'error',
        title: 'Silakan tulis testimoni Anda',
        timer: 2000,
      });
      return;
    }

    if (!formData.rating || formData.rating < 1 || formData.rating > 5) {
      Toast().fire({
        icon: 'error',
        title: 'Silakan pilih rating 1-5 bintang',
        timer: 2000,
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        rating: formData.rating,
        review: formData.review.trim(),
        role: role  // ✨ PHASE 4.11: Include role in payload
      };

      const response = await apiInstance.post('student/submit-testimonial/', payload);

      // Update state based on whether this was a create or update
      if (response.status === 201 || response.data.status === 'submitted') {
        setExistingTestimonial(response.data);
      } else if (response.status === 200 || response.data.status === 'updated') {
        setExistingTestimonial(response.data);
      }

      Toast().fire({
        icon: 'success',
        title: response.data?.message || 'Testimoni berhasil disimpan!',
        timer: 2000,
      });

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (error) {
      console.error('Error submitting testimonial:', error);
      const errorMessage = 
        error.response?.data?.error || 
        'Gagal mengirim testimoni. Silakan coba lagi.';
      
      Toast().fire({
        icon: 'error',
        title: errorMessage,
        timer: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingTestimonial) return;

    // ✨ PHASE 4.11: Use custom DeleteConfirmation modal instead of window.confirm()
    const result = await DeleteConfirmation({
      title: 'Hapus Testimoni?',
      text: 'Anda akan menghapus secara permanen testimoni Anda. Tindakan ini tidak dapat dibatalkan.'
    });

    if (!result.isConfirmed) return;

    setDeleting(true);
    try {
      // ✨ PHASE 4.11: Pass role parameter to delete specific role testimonial
      const response = await apiInstance.delete(`student/testimonial/?role=${role}`);
      
      setExistingTestimonial(null);
      setFormData({ rating: 5, review: '' });

      Toast().fire({
        icon: 'success',
        title: 'Testimoni Anda berhasil dihapus',
        timer: 2000,
      });

      if (onSuccess) {
        onSuccess({ status: 'deleted' });
      }
    } catch (error) {
      console.error('Error deleting testimonial:', error);
      const errorMessage = 
        error.response?.data?.error || 
        'Gagal menghapus testimoni. Silakan coba lagi.';
      
      Toast().fire({
        icon: 'error',
        title: errorMessage,
        timer: 3000,
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!hasLoaded) {
    return (
      <div className="testimonial-submit-form">
        <div className="form-card">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isEditing = !!existingTestimonial;
  const roleLabel = role === 'instructor' ? 'Instruktur' : 'Siswa';  // ✨ PHASE 4.11: Role label
  const formTitle = isEditing ? `Edit Testimoni Anda sebagai ${roleLabel}` : `Bagikan Testimoni Anda sebagai ${roleLabel}`;
  const submitButtonText = isEditing ? 'Perbarui Testimoni' : 'Kirim Testimoni';
  const submitButtonIcon = isEditing ? 'fa-save' : 'fa-paper-plane';

  return (
    <div className="testimonial-submit-form">
      <div className="form-card">
        <h3 className="form-title mb-4">
          <i className={`fas ${submitButtonIcon} text-primary me-2`}></i>
          {formTitle}
        </h3>
        
        <form onSubmit={handleSubmit}>
          {/* Rating Section */}
          <div className="mb-4">
            <label className="form-label fw-bold">
              Rating <span className="text-danger">*</span>
            </label>
            <div className="rating-stars d-flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <i
                  key={star}
                  className={`fas fa-star cursor-pointer ${
                    star <= formData.rating ? 'text-warning' : 'text-muted'
                  }`}
                  onClick={() => handleRatingChange(star)}
                  style={{ fontSize: '1.5rem', transition: 'all 0.2s' }}
                  title={`${star} bintang`}
                ></i>
              ))}
            </div>
            <small className="text-muted d-block mt-2">
              Rating Anda: <strong>{formData.rating} dari 5 bintang</strong>
            </small>
          </div>

          {/* Review/Testimonial Text */}
          <div className="mb-4">
            <label className="form-label fw-bold">
              Testimoni Anda <span className="text-danger">*</span>
            </label>
            <textarea
              className="form-control form-control-lg"
              rows="5"
              placeholder="Bagikan pengalaman Anda menggunakan platform LMSetjen DPD RI...
Contoh: Kursus ini sangat membantu saya dalam mengembangkan keterampilan..."
              value={formData.review}
              onChange={handleReviewChange}
              style={{
                borderRadius: '10px',
                border: '2px solid #e9ecef',
                fontSize: '0.95rem',
              }}
              disabled={loading || deleting}
            ></textarea>
            <small className="text-muted d-block mt-2">
              {formData.review.length} karakter (minimal 10 karakter)
            </small>
          </div>

          {/* Action Buttons */}
          <div className="d-flex gap-2 justify-content-end flex-wrap">
            {isEditing && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={loading || deleting}
                onClick={handleDelete}
              >
                {deleting ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Menghapus...
                  </>
                ) : (
                  <>
                    <i className="fas fa-trash me-2"></i>
                    Hapus
                  </>
                )}
              </button>
            )}
            <button
              type="reset"
              className="btn btn-outline-secondary"
              disabled={loading || deleting}
              onClick={() => {
                if (isEditing) {
                  setFormData({
                    rating: existingTestimonial.rating,
                    review: existingTestimonial.review,
                  });
                } else {
                  setFormData({ rating: 5, review: '' });
                }
              }}
            >
              <i className="fas fa-times me-2"></i>
              {isEditing ? 'Batal' : 'Ulang'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || deleting || !formData.review.trim()}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  {isEditing ? 'Memperbarui...' : 'Mengirim...'}
                </>
              ) : (
                <>
                  <i className={`fas ${submitButtonIcon} me-2`}></i>
                  {submitButtonText}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div
          className="mt-4 p-3"
          style={{
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            borderLeft: '4px solid #667eea',
            borderRadius: '8px',
          }}
        >
          <p className="small mb-0" style={{ color: '#2c3e50' }}>
            <i className="fas fa-info-circle text-primary me-2"></i>
            <strong>Catatan:</strong> Testimoni Anda akan ditampilkan pada halaman utama jika disetujui oleh administrator.
            {!isEditing && ' Anda dapat mengedit atau menghapus testimoni Anda kapan saja.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default memo(TestimonialSubmitForm);
