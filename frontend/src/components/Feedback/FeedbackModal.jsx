import React from 'react';
import './FeedbackForm.css';
import FeedbackForm from './FeedbackForm';

/**
 * ✨ PHASE 11.1: Feedback Modal Component
 * Modal wrapper for the FeedbackForm
 * 
 * Props:
 *   - isOpen: Boolean indicating if modal is open
 *   - onClose: Function to call when modal should close
 *   - onSuccess: Function to call when feedback is submitted
 *   - relatedCourse: Optional course ID
 */
const FeedbackModal = ({ isOpen, onClose, onSuccess, relatedCourse }) => {
    if (!isOpen) return null;

    return (
        <div className={`feedback-modal ${isOpen ? 'active' : ''}`} onClick={e => {
            if (e.target === e.currentTarget) {
                onClose();
            }
        }}>
            <FeedbackForm
                onClose={onClose}
                onSuccess={onSuccess}
                relatedCourse={relatedCourse}
            />
        </div>
    );
};

export default React.memo(FeedbackModal);
