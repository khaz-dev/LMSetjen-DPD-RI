import React, { useState } from 'react';
import './FeedbackForm.css';
import useAxios from '../../utils/useAxios';
import Toast from '../../views/plugin/Toast';

/**
 * ✨ PHASE 11.1: Bug Report & Feature Request Form Component
 * Allows users to submit feedback to improve the platform
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

    const feedbackTypes = [
        { value: 'bug', label: '🐛 Laporkan Bug', description: 'Laporkan masalah yang tidak berfungsi sebagaimana mestinya' },
        { value: 'feature', label: '✨ Ajukan Fitur Baru', description: 'Sarankan fitur baru atau perbaikan' },
    ];

    const affectedAreas = [
        'Pencarian',
        'Pendaftaran Kursus',
        'Pemutaran Pelajaran',
        'Sistem Kuis',
        'Dasbor',
        'Profil',
        'Notifikasi',
        'Pembayaran',
        'Sertifikat',
        'Forum Tanya Jawab',
        'Lainnya',
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
            newErrors.related_url = 'Harap masukkan URL yang valid';
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
                text: 'Harap perbaiki kesalahan di atas',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // Build the request data, exclude empty fields
            const submitData = {};
            Object.keys(formData).forEach(key => {
                if (formData[key]) {
                    submitData[key] = formData[key];
                }
            });

            const response = await useAxios.post('/feedback/create/', submitData);

            Toast().fire({
                icon: 'success',
                title: 'Terima Kasih!',
                text: response.data.message || 'Masukan Anda telah berhasil dikirim',
            });

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
                onSuccess(response.data);
            }

            // Close modal/form
            if (onClose) {
                onClose();
            }
        } catch (error) {
            console.error('Feedback submission error:', error);
            const errorMsg = error.response?.data?.error ||
                error.response?.data?.message ||
                error.response?.data?.detail ||
                'Failed to submit feedback. Please try again.';

            Toast().fire({
                icon: 'error',
                title: 'Pengiriman Gagal',
                text: errorMsg,
            });
        } finally {
            setIsSubmitting(false);
        }
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
                        aria-label="Close"
                    >
                        ×
                    </button>
                )}

                {/* Header */}
                <div className="feedback-form-header">
                    <h2>Bantu Kami Berkembang</h2>
                    <p>Masukan Anda membantu kami membangun pengalaman belajar yang lebih baik</p>
                </div>

                {/* Feedback Type Selection */}
                <div className="feedback-form-group">
                    <label>Apa yang ingin Anda lakukan?</label>
                    <div className="feedback-type-options">
                        {feedbackTypes.map(type => (
                            <label key={type.value} className="feedback-type-option">
                                <input
                                    type="radio"
                                    name="feedback_type"
                                    value={type.value}
                                    checked={formData.feedback_type === type.value}
                                    onChange={handleChange}
                                />
                                <div>
                                    <strong>{type.label}</strong>
                                    <p>{type.description}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Title */}
                <div className="feedback-form-group">
                    <label htmlFor="title">
                        <strong>Ringkasan *</strong>
                        <span className="character-count">({formData.title.length}/100)</span>
                    </label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        maxLength="100"
                        placeholder={
                            formData.feedback_type === 'bug'
                                ? 'Cth: Pemutar video macet saat pemutaran'
                                : 'Cth: Tambahkan mode gelap ke dasbor'
                        }
                        value={formData.title}
                        onChange={handleChange}
                        className={errors.title ? 'error' : ''}
                    />
                    {errors.title && <span className="error-message">{errors.title}</span>}
                </div>

                {/* Description */}
                <div className="feedback-form-group">
                    <label htmlFor="description">
                        <strong>Detail *</strong>
                        <span className="character-count">({formData.description.length}/2000)</span>
                    </label>
                    <textarea
                        id="description"
                        name="description"
                        maxLength="2000"
                        rows="3"
                        placeholder={
                            formData.feedback_type === 'bug'
                                ? 'Jelaskan apa yang terjadi, apa yang Anda harapkan, dan pesan kesalahan apa pun yang Anda lihat...'
                                : 'Jelaskan fitur yang ingin Anda lihat dan bagaimana hal itu akan membantu Anda...'
                        }
                        value={formData.description}
                        onChange={handleChange}
                        className={errors.description ? 'error' : ''}
                    />
                    {errors.description && <span className="error-message">{errors.description}</span>}
                </div>

                {/* Affected Area */}
                <div className="feedback-form-row">
                    <div className="feedback-form-group">
                        <label htmlFor="affected_area">
                            <strong>Area yang Terkena Dampak</strong>
                        </label>
                        <select
                            id="affected_area"
                            name="affected_area"
                            value={formData.affected_area}
                            onChange={handleChange}
                        >
                            <option value="">-- Pilih area --</option>
                            {affectedAreas.map(area => (
                                <option key={area} value={area}>{area}</option>
                            ))}
                        </select>
                    </div>

                    {/* Related Course */}
                    <div className="feedback-form-group">
                        <label htmlFor="related_course">
                            <strong>Kursus Terkait (Opsional)</strong>
                        </label>
                        <input
                            type="text"
                            id="related_course"
                            name="related_course"
                            placeholder="ID Kursus atau judul"
                            value={formData.related_course}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                {/* URL and Attachments */}
                <div className="feedback-form-row">
                    <div className="feedback-form-group">
                        <label htmlFor="related_url">
                            <strong>URL (Opsional)</strong>
                        </label>
                        <input
                            type="url"
                            id="related_url"
                            name="related_url"
                            placeholder="https://contoh.com/kursus/..."
                            value={formData.related_url}
                            onChange={handleChange}
                            className={errors.related_url ? 'error' : ''}
                        />
                        {errors.related_url && <span className="error-message">{errors.related_url}</span>}
                    </div>

                    <div className="feedback-form-group">
                        <label htmlFor="attachments">
                            <strong>URL Tangkapan Layar (Opsional)</strong>
                        </label>
                        <input
                            type="url"
                            id="attachments"
                            name="attachments"
                            placeholder="URL ke tangkapan layar atau dokumen"
                            value={formData.attachments}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                {/* Email Info (for reference) */}
                <div className="feedback-form-info">
                    <p>
                        <strong>💡 Saran:</strong> Tim kami akan meninjau masukan Anda dan mungkin menghubungi Anda melalui alamat email terdaftar jika kami memerlukan klarifikasi.
                    </p>
                </div>

                {/* Submit Button */}
                <div className="feedback-form-actions">
                    {onClose && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Batal
                        </button>
                    )}
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                Mengirim...
                            </>
                        ) : (
                            '✓ Kirim Masukan'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default React.memo(FeedbackForm);
