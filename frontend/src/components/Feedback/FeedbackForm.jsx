import React, { useState } from 'react';
import './FeedbackForm.css';
import useAxios from '../../utils/useAxios';
import Toast from '../../views/plugin/Toast';
import FeedbackVerificationModal from './FeedbackVerificationModal';
import useSystemVersion from '../../hooks/useSystemVersion';
import dayjs, { moment } from '../../utils/dayjs';

/**
 * ✨ PHASE 11.1 & 11.4: User Feedback & What's New Update Log Dialog
 * Multi-tab modal allowing users to:
 *   1. Submit feedback / bug reports ("Bantu Kami Berkembang")
 *   2. View platform release notes & version changelog ("Update Log / What's New on LMSetjen DPD RI")
 * 
 * Props:
 *   - onSuccess: Callback function when feedback is submitted successfully
 *   - onClose: Callback function to close the form/modal
 *   - relatedCourse: Optional course ID to pre-select
 *   - prefillData: Optional prefill data from AI assistant
 *   - initialTab: 'feedback' | 'updates'
 */
const FeedbackForm = ({ onSuccess, onClose, relatedCourse, prefillData, initialTab = 'feedback' }) => {
    const [activeModalTab, setActiveModalTab] = useState(initialTab || 'feedback');
    const [updateSearch, setUpdateSearch] = useState('');

    const {
        version: currentVersion,
        releases,
        currentRelease,
        loading: releasesLoading,
        fetchReleases
    } = useSystemVersion({ fetchReleases: true });

    // Sync activeModalTab if initialTab changes
    React.useEffect(() => {
        if (initialTab) {
            setActiveModalTab(initialTab);
        }
    }, [initialTab]);

    const [formData, setFormData] = useState({
        feedback_type: prefillData?.feedback_type || 'bug',
        title: prefillData?.title || '',
        description: prefillData?.description || '',
        related_course: prefillData?.related_course || relatedCourse || '',
        related_url: prefillData?.related_url || (typeof window !== 'undefined' ? window.location.href : ''),
        affected_area: prefillData?.affected_area || '',
        attachments: '',
    });

    // Update formData jika prefillData baru dikirim dari aksi cerdas Manta AI
    React.useEffect(() => {
        if (prefillData) {
            setFormData(prev => ({
                ...prev,
                feedback_type: prefillData.feedback_type || prev.feedback_type || 'bug',
                title: prefillData.title || prev.title,
                description: prefillData.description || prev.description,
                related_course: prefillData.related_course || prev.related_course || relatedCourse || '',
                related_url: prefillData.related_url || prev.related_url || (typeof window !== 'undefined' ? window.location.href : ''),
                affected_area: prefillData.affected_area || prev.affected_area || ''
            }));
        }
    }, [prefillData, relatedCourse]);

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

    // Category helper for update items
    const getCatIcon = (cat) => {
        const c = String(cat || '').toLowerCase();
        if (c.includes('feat') || c.includes('fitur')) return { icon: 'bi-rocket-takeoff-fill text-primary', label: 'Fitur Baru' };
        if (c.includes('improv') || c.includes('peningkatan')) return { icon: 'bi-lightning-charge-fill text-success', label: 'Peningkatan' };
        if (c.includes('bug') || c.includes('fix') || c.includes('perbaikan')) return { icon: 'bi-bug-fill text-danger', label: 'Perbaikan Bug' };
        if (c.includes('sec') || c.includes('aman')) return { icon: 'bi-shield-check text-purple', label: 'Keamanan' };
        if (c.includes('ui') || c.includes('tampilan')) return { icon: 'bi-palette-fill text-warning', label: 'Antarmuka' };
        return { icon: 'bi-check2-circle text-primary', label: 'Pembaruan' };
    };

    // Filter releases for update log tab
    const filteredReleases = React.useMemo(() => {
        if (!updateSearch.trim()) return releases;
        const q = updateSearch.toLowerCase();
        return releases.filter(r =>
            (r.version && r.version.toLowerCase().includes(q)) ||
            (r.title && r.title.toLowerCase().includes(q)) ||
            (r.summary && r.summary.toLowerCase().includes(q)) ||
            (r.changes && r.changes.some(c =>
                (c.title && c.title.toLowerCase().includes(q)) ||
                (c.description && c.description.toLowerCase().includes(q))
            ))
        );
    }, [releases, updateSearch]);

    return (
        <div className="feedback-form-container">
            <div className="feedback-form position-relative">
                {/* 2-Tab Navigation Bar */}
                <div className="feedback-modal-tabs">
                    <button
                        type="button"
                        className={`feedback-tab-button ${activeModalTab === 'feedback' ? 'is-active' : ''}`}
                        onClick={() => setActiveModalTab('feedback')}
                    >
                        <i className="bi bi-chat-heart-fill feedback-tab-icon text-danger"></i>
                        <span>Bantu Kami Berkembang</span>
                    </button>
                    <button
                        type="button"
                        className={`feedback-tab-button ${activeModalTab === 'updates' ? 'is-active' : ''}`}
                        onClick={() => setActiveModalTab('updates')}
                    >
                        <i className="bi bi-rocket-takeoff-fill feedback-tab-icon text-primary"></i>
                        <span>Update Log (What's New on LMSetjen DPD RI)</span>
                        <span className="feedback-tab-badge">v{currentVersion || "1.0.1"}</span>
                    </button>
                </div>

                {/* TAB 1: BANTU KAMI BERKEMBANG */}
                {activeModalTab === 'feedback' && (
                    <form onSubmit={handleSubmit}>

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
                )}

                {/* TAB 2: UPDATE LOG (WHAT'S NEW ON LMSETJEN DPD RI) */}
                {activeModalTab === 'updates' && (
                    <div className="update-log-panel">
                        {/* Hero Section */}
                        <div className="update-log-hero">
                            <div className="update-log-hero-badge">
                                <span className="badge-dot-pulsing"></span>
                                <span>LMSetjen DPD RI v{currentVersion || "1.0.1"}</span>
                            </div>
                            <h2 className="update-log-hero-title">
                                Apa yang Baru di LMSetjen DPD RI
                            </h2>
                            <p className="update-log-hero-subtitle">
                                Simak riwayat pembaruan, fitur terbaru, dan peningkatan berkelanjutan platform pembelajaran aparatur sipil negara Setjen DPD RI.
                            </p>
                        </div>

                        {/* Search Bar */}
                        <div className="update-log-search-bar">
                            <i className="bi bi-search update-log-search-icon"></i>
                            <input
                                type="text"
                                className="update-log-search-input"
                                placeholder="Cari fitur, modul, atau perbaikan bug..."
                                value={updateSearch}
                                onChange={e => setUpdateSearch(e.target.value)}
                            />
                        </div>

                        {/* Release Timeline Cards */}
                        <div className="update-log-timeline">
                            {releasesLoading ? (
                                <div className="text-center py-4">
                                    <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                                    <p className="text-muted small mt-2">Memuat catatan pembaruan...</p>
                                </div>
                            ) : filteredReleases.length === 0 ? (
                                <div className="text-center py-4 text-muted">
                                    <i className="bi bi-inbox fs-2 d-block mb-1 text-secondary"></i>
                                    <p className="small mb-0">Tidak ada log rilis yang sesuai dengan pencarian.</p>
                                </div>
                            ) : (
                                filteredReleases.map((rel, idx) => {
                                    const isCurrent = rel.is_current;
                                    const changes = rel.changes || [];

                                    return (
                                        <div
                                            key={rel.id || idx}
                                            className={`update-log-card ${isCurrent ? 'is-latest' : ''}`}
                                        >
                                            <div className="update-log-card-header">
                                                <div className="update-log-version-pill">
                                                    <span>v{rel.version}</span>
                                                    {isCurrent && (
                                                        <span className="badge-latest-tag">
                                                            <i className="bi bi-check-circle-fill me-1"></i>
                                                            Versi Aktif
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="update-log-date">
                                                    <i className="bi bi-calendar3 me-1"></i>
                                                    {rel.release_date ? moment(rel.release_date).format('DD MMM YYYY') : '-'}
                                                </div>
                                            </div>

                                            <h4 className="update-log-title">{rel.title}</h4>
                                            {rel.summary && (
                                                <p className="update-log-summary">{rel.summary}</p>
                                            )}

                                            {changes.length > 0 && (
                                                <div className="update-log-items-list">
                                                    {changes.map((item, itemIdx) => {
                                                        const cat = getCatIcon(item.category);
                                                        return (
                                                            <div key={itemIdx} className="update-log-single-item">
                                                                <i className={`bi ${cat.icon} item-cat-icon`}></i>
                                                                <div>
                                                                    <div>
                                                                        <span className="item-title-text">{item.title}</span>
                                                                        {item.module && (
                                                                            <span className="item-module-badge">{item.module}</span>
                                                                        )}
                                                                    </div>
                                                                    {item.description && (
                                                                        <div className="item-desc-text">{item.description}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Bottom Action Bar */}
                        <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                            <span className="text-muted small">
                                Punya ide atau kendala?
                                <button
                                    type="button"
                                    className="btn btn-link text-primary p-0 ms-1 fw-bold text-decoration-none small"
                                    onClick={() => setActiveModalTab('feedback')}
                                >
                                    Beri Masukan Sistem
                                </button>
                            </span>
                            {onClose && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary px-3"
                                    onClick={onClose}
                                >
                                    Tutup
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

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
