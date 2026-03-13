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
    const feedback = useFeedback();
    const [isVisible, setIsVisible] = useState(true);
    const [recentCountdown, setRecentCountdown] = useState(0);

    // Auto-hide button briefly after submission
    useEffect(() => {
        if (recentCountdown > 0) {
            const timer = setTimeout(() => {
                setRecentCountdown(recentCountdown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [recentCountdown]);

    const handleFeedbackSuccess = (data) => {
        setRecentCountdown(3);
        feedback.onFeedbackSuccess(data);
    };

    return (
        <>
            <button
                className={`feedback-floating-button ${!isVisible ? 'hidden' : ''}`}
                onClick={() => feedback.openFeedback()}
                title="Kirimkan masukan atau laporkan bug"
                aria-label="Open feedback form"
            >
                <span className="feedback-button-icon">💬</span>
                <span className="feedback-button-tooltip">Masukan</span>
            </button>

            <FeedbackModal
                isOpen={feedback.isOpen}
                onClose={feedback.closeFeedback}
                onSuccess={handleFeedbackSuccess}
                relatedCourse={feedback.relatedCourse}
            />
        </>
    );
};

export default React.memo(FeedbackFloatingButton);
