import { useState } from 'react';

/**
 * ✨ PHASE 11.1: Custom hook for Feedback Modal management
 * 
 * Usage:
 *   const feedback = useFeedback();
 *   
 *   // Open feedback modal
 *   feedback.openFeedback();
 *   
 *   // Or open with specific course
 *   feedback.openFeedback(courseId);
 *   
 *   // Access modal state
 *   <FeedbackModal 
 *       isOpen={feedback.isOpen}
 *       onClose={feedback.closeFeedback}
 *       relatedCourse={feedback.relatedCourse}
 *   />
 */
const useFeedback = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [relatedCourse, setRelatedCourse] = useState(null);

    const openFeedback = (courseId = null) => {
        setRelatedCourse(courseId);
        setIsOpen(true);
    };

    const closeFeedback = () => {
        setIsOpen(false);
        setRelatedCourse(null);
    };

    const onFeedbackSuccess = (data) => {
        // Could be extended to trigger additional actions
        console.log('Feedback submitted successfully:', data);
    };

    return {
        isOpen,
        relatedCourse,
        openFeedback,
        closeFeedback,
        onFeedbackSuccess,
    };
};

export default useFeedback;
