import React, { useState, useEffect } from 'react';
import useFeedback from '../../hooks/useFeedback';
import FeedbackModal from './FeedbackModal';
import './FeedbackFloatingButton.css';

/**
 * ✨ PHASE 11.1: Floating Feedback Button
 * Sticky button that appears in the bottom-right corner
 * Allows users to easily access feedback form from any page
 */
const FeedbackFloatingButton = () => {
    // Jangan tampilkan tombol feedback jika sedang berada di dalam iframe (misalnya Scorm/Course Player)
    // atau di halaman khusus pemutar modul (/modules/:moduleId/player/)
    const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;
    const isPlayerPage = typeof window !== 'undefined' && window.location.pathname.includes('/modules/') && window.location.pathname.includes('/player');

    if (isInsideIframe || isPlayerPage) {
        return null;
    }

    const feedback = useFeedback();
    const [isVisible, setIsVisible] = useState(true);
    const [recentCountdown, setRecentCountdown] = useState(0);
    const [prefillData, setPrefillData] = useState(null);

    // Auto-hide button briefly after submission
    useEffect(() => {
        if (recentCountdown > 0) {
            const timer = setTimeout(() => {
                setRecentCountdown(recentCountdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [recentCountdown]);

    // Buka formulir masukan jika dipicu dari aksi cepat Manta AI (dengan diagnostik otomatis)
    useEffect(() => {
        const handleTriggerFeedback = (e) => {
            const detail = e?.detail || {};
            if (detail.prefill) {
                setPrefillData(detail.prefill);
            }
            feedback.openFeedback(detail.courseId || null);
        };
        window.addEventListener('lms-open-feedback-modal', handleTriggerFeedback);
        return () => window.removeEventListener('lms-open-feedback-modal', handleTriggerFeedback);
    }, [feedback]);

    const handleModalClose = () => {
        setPrefillData(null);
        feedback.closeFeedback();
    };

    const handleFeedbackSuccess = (data) => {
        setRecentCountdown(3);
        setPrefillData(null);
        feedback.onFeedbackSuccess(data);
    };

    return (
        <>
            <button
                className={`feedback-floating-button ${!isVisible ? 'hidden' : ''}`}
                onClick={() => {
                    setPrefillData(null);
                    feedback.openFeedback();
                }}
                title="Kirimkan masukan atau laporkan bug"
                aria-label="Open feedback form"
            >
                <span className="feedback-button-icon">💬</span>
                <span className="feedback-button-tooltip">Masukan</span>
            </button>

            <FeedbackModal
                isOpen={feedback.isOpen}
                onClose={handleModalClose}
                onSuccess={handleFeedbackSuccess}
                relatedCourse={feedback.relatedCourse}
                prefillData={prefillData}
            />
        </>
    );
};

export default React.memo(FeedbackFloatingButton);
