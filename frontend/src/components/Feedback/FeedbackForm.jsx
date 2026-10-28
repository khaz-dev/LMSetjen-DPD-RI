import React, { useState } from 'react';
import './FeedbackForm.css';
import useAxios from '../../utils/useAxios';
import Toast from '../../views/plugin/Toast';
import FeedbackVerificationModal from './FeedbackVerificationModal';

/**
 * ✨ PHASE 11.1: Bug Report & Feature Request Form Component
 * Allows users to submit feedback to improve the platform
 * 
 * ✨ PHASE 11.3: Integrated verification modal to prevent spam
 * Shows verification step before final submission
 * 
 * Props:
 *   - onSuccess: Callback function when feedback is submitted successfully
 *   - onClose: Callback function to close the form/modal
 *   - relatedCourse: Optional course ID to pre-select
 */
const FeedbackForm = ({ onSuccess, onClose, relatedCourse }) => {
    const [formData, setFormData] = useState({
        feedback_type: 'bug',
        title: '',
        description: '',
        related_course: relatedCourse || '',
        related_url: '',
        affected_area: '',
        attachments: '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    
    // ✨ PHASE 11.3: Verification modal state
    const [showVerification, setShowVerification] = useState(false);
    const [pendingFeedbackData, setPendingFeedbackData] = useState(null);

    const feedbackTypes = [
        { 
            value: 'bug', 
            label: 'Laporkan Kendala / Bug', 
            icon: 'bi-bug-fill', 
            badge: 'Kendala Sistem',
            description: 'Laporkan fitur yang error atau tidak berfungsi sebagaimana mestinya' 
        },
        { 
            value: 'feature', 
            label: 'Ajukan Usulan Fitur Baru', 
            icon: 'bi-stars', 
            badge: 'Ide Peningkatan',
            description: 'Sarankan ide perbaikan atau modul baru yang Anda butuhkan' 
        },
    ];

    /**
     * ✨ PHASE 11.2: Fixed affected_area mapping - maps display names to backend enum codes
     * 
     * Backend Feedback model expects: ('course', 'video', 'quiz', 'forum', 'ui', 'account', 'other')
     * Frontend displays Indonesian names but must send backend codes
     */
    const affectedAreas = [
        { value: 'ui', label: 'Pencarian' },
        { value: 'course', label: 'Pendaftaran Kursus' },
        { value: 'video', label: 'Pemutaran Pelajaran' },
        { value: 'quiz', label: 'Sistem Kuis' },
        { value: 'ui', label: 'Dasbor' },
        { value: 'account', label: 'Profil' },
        { value: 'ui', label: 'Notifikasi' },
        { value: 'other', label: 'Pembayaran' },
        { value: 'other', label: 'Sertifikat' },
        { value: 'forum', label: 'Forum Tanya Jawab' },
        { value: 'other', label: 'Lainnya' },
    ];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error for this field when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.title || formData.title.trim().length < 3) {
            newErrors.title = 'Ringkasan harus setidaknya 3 karakter';
        }

        if (!formData.description || formData.description.trim().length < 10) {
            newErrors.description = 'Detail harus setidaknya 10 karakter';
        }

        if (formData.related_url && !isValidUrl(formData.related_url)) {
            newErrors.related_url = 'Harap masukkan URL yang valid (contoh: https://...)';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const isValidUrl = (string) => {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            Toast().fire({
                icon: 'error',
                title: 'Kesalahan Validasi',
                text: 'Harap periksa kembali bidang formulir yang ditandai merah',
            });
            return;
        }

        // ✨ PHASE 11.3: Build feedback data to send to verification modal
        const submitData = {};
        Object.keys(formData).forEach(key => {
            if (formData[key]) {
                // ✨ PHASE 11.2: Convert related_course to integer (if provided)
                // related_course is a ForeignKey, must be sent as integer
                if (key === 'related_course') {
                    const courseId = parseInt(formData[key], 10);
                    if (!isNaN(courseId)) {
                        submitData[key] = courseId;
                    }
                } else {
                    submitData[key] = formData[key];
                }
            }
        });

        // Store pending data and show verification modal
        setPendingFeedbackData(submitData);
        setShowVerification(true);
    };

    // ✨ PHASE 11.3: Handle successful verification submission
    const handleVerificationSuccess = (response) => {
        // Reset form
        setFormData({
            feedback_type: 'bug',
            title: '',
            description: '',
            related_course: relatedCourse || '',
            related_url: '',
            affected_area: '',
            attachments: '',
        });

        // Call onSuccess callback
        if (onSuccess) {
            onSuccess(response);
        }

        // Close verification modal and form
        setShowVerification(false);
        setPendingFeedbackData(null);
        if (onClose) {
            onClose();
        }
    };

    // ✨ PHASE 11.3: Handle verification modal close
    const handleVerificationClose = () => {
        setShowVerification(false);
        setPendingFeedbackData(null);
    };

    return (
        <div className="feedback-form-container">
            <form onSubmit={handleSubmit} className="feedback-form">
                {/* Close button (if modal context) */}
                {onClose && (
                    <button
                        type="button"
                        className="feedback-form-close"
                        onClick={onClose}
                        aria-label="Tutup Formulir"
                    >
                        <i className="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                )}

                {/* Header with DPD RI Identity */}
                <div className="feedback-form-header">
                    <div className="feedback-header-badge">
                        <span className="badge-dot-pulsing" aria-hidden="true"></span>
                        <span>Aspirasi & Masukan LMSetjen DPD RI</span>
                    </div>
                    <div className="feedback-header-title-row">
                        <div className="feedback-header-icon" aria-hidden="true">
                            <i className="bi bi-chat-heart-fill"></i>
                        </div>
                        <div>
                            <h2 className="feedback-title">Bantu Kami Berkembang</h2>
                            <p className="feedback-subtitle">
                                Masukan Anda sangat berharga untuk membangun platform pembelajaran aparatur yang lebih andal, modern, dan nyaman.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Feedback Type Selection (Compact segmented cards) */}
                <div className="feedback-form-group">
                    <label className="feedback-group-label">Kategori Masukan *</label>
                    <div className="feedback-type-options">
                        {feedbackTypes.map(type => (
                            <label 
                                key={type.value} 
                                className={`feedback-type-option ${formData.feedback_type === type.value ? 'is-selected' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="feedback_type"
                                    value={type.value}
                                    checked={formData.feedback_type === type.value}
                                    onChange={handleChange}
                                />
                                <div className="type-option-content">
                                    <div className="type-option-head">
                                        <i className={`bi ${type.icon} type-icon`} aria-hidden="true"></i>
                                        <strong className="type-title">{type.label}</strong>
                                        <span className="type-badge">{type.badge}</span>
                                    </div>
                                    <p className="type-desc">{type.description}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Title */}
                <div className="feedback-form-group">
                    <div className="label-with-counter">
                        <label htmlFor="title" className="feedback-group-label mb-0">
                            <strong>Ringkasan Masukan *</strong>
                        </label>
                        <span className="character-count">({formData.title.length}/100)</span>
                    </div>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        maxLength="100"
                        placeholder={
                            formData.feedback_type === 'bug'
                                ? 'Contoh: Pemutar video materi macet saat modul 2 dibuka...'
                                : 'Contoh: Usulan penambahan fitur unduh transkrip materi...'
                        }
                        value={formData.title}
                        onChange={handleChange}
                        className={`feedback-input ${errors.title ? 'error' : ''}`}
                    />
                    {errors.title && <span className="error-message">{errors.title}</span>}
                </div>

                {/* Description */}
                <div className="feedback-form-group">
                    <div className="label-with-counter">
                        <label htmlFor="description" className="feedback-group-label mb-0">
                            <strong>Detail Penjelasan *</strong>
                        </label>
                        <span className="character-count">({formData.description.length}/2000)</span>
                    </div>
                    <textarea
                        id="description"
                        name="description"
                        maxLength="2000"
                        rows="3"
                        placeholder={
                            formData.feedback_type === 'bug'
                                ? 'Jelaskan langkah terjadinya kendala, perilaku yang diharapkan, dan pesan galat/error yang muncul di layar...'
                                : 'Jelaskan manfaat fitur baru yang Anda usulkan dan bagaimana fitur tersebut membantu proses belajar Anda...'
                        }
                        value={formData.description}
                        onChange={handleChange}
                        className={`feedback-textarea ${errors.description ? 'error' : ''}`}
                    />
                    {errors.description && <span className="error-message">{errors.description}</span>}
                </div>

                {/* Affected Area & Related Course (2 Columns) */}
                <div className="feedback-form-row">
                    <div className="feedback-form-group">
                        <label htmlFor="affected_area" className="feedback-group-label">
                            <strong>Area yang Terdampak</strong>
                        </label>
                        <select
                            id="affected_area"
                            name="affected_area"
                            value={formData.affected_area}
                            onChange={handleChange}
                            className="feedback-select"
                        >
                            <option value="">-- Pilih area modul / sistem --</option>
                            {affectedAreas.map(area => (
                                <option key={area.value + '-' + area.label} value={area.value}>{area.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="feedback-form-group">
                        <label htmlFor="related_course" className="feedback-group-label">
                            <strong>ID / Judul Kursus (Opsional)</strong>
                        </label>
                        <input
                            type="text"
                            id="related_course"
                            name="related_course"
                            placeholder="Contoh: Tata Naskah Dinas, ID: 12"
                            value={formData.related_course}
                            onChange={handleChange}
                            className="feedback-input"
                        />
                    </div>
                </div>

                {/* URL and Attachments (2 Columns) */}
                <div className="feedback-form-row">
                    <div className="feedback-form-group">
                        <label htmlFor="related_url" className="feedback-group-label">
                            <strong>Tautan Halaman / URL (Opsional)</strong>
                        </label>
                        <input
                            type="url"
                            id="related_url"
                            name="related_url"
                            placeholder="https://lms.dpd.go.id/course/..."
                            value={formData.related_url}
                            onChange={handleChange}
                            className={`feedback-input ${errors.related_url ? 'error' : ''}`}
                        />
                        {errors.related_url && <span className="error-message">{errors.related_url}</span>}
                    </div>

                    <div className="feedback-form-group">
                        <label htmlFor="attachments" className="feedback-group-label">
                            <strong>Tautan Tangkapan Layar (Opsional)</strong>
                        </label>
                        <input
                            type="url"
                            id="attachments"
                            name="attachments"
                            placeholder="Tautan Google Drive / Screenshot"
                            value={formData.attachments}
                            onChange={handleChange}
                            className="feedback-input"
                        />
                    </div>
                </div>

                {/* Info Callout */}
                <div className="feedback-form-info">
                  <i className="bi bi-shield-check info-icon" aria-hidden="true"></i>
                  <p className="mb-0">
                    Masukan Anda langsung diteruskan ke Tim Teknis <strong>BPSDM Biro OKK Setjen DPD RI</strong> untuk ditindaklanjuti.
                  </p>
                </div>

                {/* Submit & Cancel Actions */}
                <div className="feedback-form-actions">
                    {onClose && (
                        <button
                            type="button"
                            className="btn btn-feedback-secondary"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Batal
                        </button>
                    )}
                    <button
                        type="submit"
                        className="btn btn-feedback-primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Memproses...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-send-fill me-2" aria-hidden="true"></i>
                                Kirim Masukan
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* ✨ PHASE 11.3: Verification Modal */}
            <FeedbackVerificationModal
                isOpen={showVerification}
                onClose={handleVerificationClose}
                feedbackData={pendingFeedbackData}
                onSuccess={handleVerificationSuccess}
            />
        </div>
    );
};

export default React.memo(FeedbackForm);
