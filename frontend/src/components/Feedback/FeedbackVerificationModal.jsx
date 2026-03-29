import React, { useState, useEffect } from 'react';
import './FeedbackVerificationModal.css';
import Toast from '../../views/plugin/Toast';
import useAxios from '../../utils/useAxios';

/**
 * ✨ PHASE 11.3: Feedback Verification Modal with Sequence Challenge
 * 
 * Interactive verification step before final feedback submission.
 * Prevents spam by requiring user to click verification dots in correct sequence.
 * 
 * Props:
 *   - isOpen: boolean - show/hide modal
 *   - onClose: function - close modal without submitting
 *   - feedbackData: object - the feedback to submit
 *   - onSuccess: function - callback after successful submission
 */
const FeedbackVerificationModal = ({ isOpen, onClose, feedbackData, onSuccess }) => {
    const [verificationState, setVerificationState] = useState(0); // 0-4: progress through sequence
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [dotStates, setDotStates] = useState([false, false, false, false]); // Track which dots clicked
    const [showSummary, setShowSummary] = useState(true);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setVerificationState(0);
            setDotStates([false, false, false, false]);
            setShowSummary(true);
        }
    }, [isOpen]);

    // Handle dot click - must be clicked in sequence
    const handleDotClick = (index) => {
        // Only allow clicking the next dot in sequence
        if (index !== verificationState) {
            Toast().fire({
                icon: 'warning',
                title: 'Urutan Salah!',
                text: `Harap klik poin ke ${verificationState + 1}`,
                timer: 2000
            });
            return;
        }

        // Mark dot as verified
        const newDotStates = [...dotStates];
        newDotStates[index] = true;
        setDotStates(newDotStates);

        // Move to next step
        const nextStep = verificationState + 1;
        setVerificationState(nextStep);

        // All dots clicked - ready to submit
        if (nextStep === 4) {
            setShowSummary(false);
            setTimeout(() => {
                Toast().fire({
                    icon: 'success',
                    title: 'Verifikasi Lengkap!',
                    text: 'Anda siap mengirim masukan',
                    timer: 1500
                });
            }, 300);
        }
    };

    // Final submission to backend
    const handleFinalSubmit = async () => {
        // Double-check verification complete
        if (verificationState < 4) {
            Toast().fire({
                icon: 'error',
                title: 'Verifikasi Belum Lengkap',
                text: 'Harap selesaikan semua poin verifikasi',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // Submit to backend
            const response = await useAxios.post('/feedback/create/', feedbackData);

            Toast().fire({
                icon: 'success',
                title: 'Berhasil!',
                text: response.data.message || 'Masukan Anda telah berhasil dikirim',
            });

            // Reset form
            setVerificationState(0);
            setDotStates([false, false, false, false]);

            // Callback
            if (onSuccess) {
                onSuccess(response.data);
            }

            // Close modal
            onClose();
        } catch (error) {
            const errorMessage = error.response?.data?.detail || error.message || 'Gagal mengirim masukan';
            Toast().fire({
                icon: 'error',
                title: 'Kesalahan',
                text: errorMessage,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    // Format feedback data for summary
    const getFeedbackSummary = () => {
        const type = feedbackData?.feedback_type === 'bug' ? '🐛 Bug Report' : '✨ Feature Request';
        const title = feedbackData?.title || 'Untitled';
        const desc = feedbackData?.description ? feedbackData.description.substring(0, 80) + '...' : '';
        
        return { type, title, desc };
    };

    const summary = getFeedbackSummary();

    return (
        <>
            {/* Backdrop */}
            <div className="verification-modal-backdrop" onClick={onClose}></div>

            {/* Modal */}
            <div className="verification-modal-container">
                <div className="verification-modal-content">
                    {/* Header */}
                    <div className="verification-modal-header">
                        <h2>🔐 Verifikasi Masukan Anda</h2>
                        <button
                            className="verification-modal-close"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Body */}
                    <div className="verification-modal-body">
                        {showSummary ? (
                            // Step 1: Show Summary
                            <div className="verification-summary-section">
                                <p className="verification-subtitle">Ringkasan Masukan Anda:</p>
                                
                                <div className="verification-feedback-card">
                                    <div className="feedback-type-badge">{summary.type}</div>
                                    <div className="feedback-title">{summary.title}</div>
                                    <div className="feedback-preview">{summary.desc}</div>
                                </div>

                                <div className="verification-instruction">
                                    <p className="instruction-text">
                                        Untuk melanjutkan, harap klik poin-poin verifikasi di bawah <strong>secara berurutan</strong>:
                                    </p>
                                </div>
                            </div>
                        ) : (
                            // Step 2: Show Success State
                            <div className="verification-success-section">
                                <div className="success-icon">✓</div>
                                <h3>Verifikasi Berhasil!</h3>
                                <p>Masukan Anda siap dikirim</p>
                            </div>
                        )}

                        {/* Verification Dots */}
                        <div className="verification-dots-container">
                            {dotStates.map((isClicked, index) => (
                                <button
                                    key={index}
                                    className={`verification-dot ${
                                        isClicked ? 'verified' : ''
                                    } ${
                                        index === verificationState && !isClicked ? 'next-to-click' : ''
                                    }`}
                                    onClick={() => handleDotClick(index)}
                                    disabled={isSubmitting || isClicked || index !== verificationState}
                                    aria-label={`Verification dot ${index + 1}`}
                                >
                                    {isClicked ? (
                                        <span className="dot-checkmark">✓</span>
                                    ) : (
                                        <span className="dot-number">{index + 1}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Progress Text */}
                        <div className="verification-progress">
                            <p className="progress-text">
                                {verificationState === 0 && 'Klik dimulai dari poin 1'}
                                {verificationState === 1 && '🎯 Bagus! Lanjutkan ke poin 2'}
                                {verificationState === 2 && '⚡ Sempurna! Klik poin 3'}
                                {verificationState === 3 && '🔥 Hampir selesai! Klik poin 4'}
                                {verificationState === 4 && '🎉 Verifikasi lengkap!'}
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="verification-modal-footer">
                        <button
                            className="verification-button-cancel"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Batal
                        </button>
                        <button
                            className={`verification-button-submit ${
                                verificationState === 4 ? 'ready' : 'disabled'
                            }`}
                            onClick={handleFinalSubmit}
                            disabled={verificationState < 4 || isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="spinner"></span>
                                    Mengirim...
                                </>
                            ) : (
                                '✓ Konfirmasi & Kirim Masukan'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default FeedbackVerificationModal;
