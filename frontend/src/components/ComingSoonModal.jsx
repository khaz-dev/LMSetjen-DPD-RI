import React, { useState } from 'react';
import './ComingSoonModal.css';

/**
 * ComingSoonModal Component
 * Displays a beautiful "Coming Soon" notification for unimplemented features
 * Usage: Call showComingSoon() from anywhere in your component
 */
export const ComingSoonModal = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [featureName, setFeatureName] = useState('This feature');

  window.showComingSoon = (name = 'This feature') => {
    setFeatureName(name);
    setIsVisible(true);
    setTimeout(() => {
      setIsVisible(false);
    }, 3000);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="coming-soon-overlay">
      <div className="coming-soon-modal animate-in">
        <div className="coming-soon-header">
          <div className="coming-soon-icon">
            <i className="fas fa-rocket"></i>
          </div>
        </div>
        
        <div className="coming-soon-content">
          <h3 className="coming-soon-title">Coming Soon!</h3>
          <p className="coming-soon-message">
            {featureName} is still under development
          </p>
          <p className="coming-soon-subtitle">
            We're working hard to bring you this feature. Stay tuned!
          </p>
        </div>

        <div className="coming-soon-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <button 
          className="coming-soon-close"
          onClick={() => setIsVisible(false)}
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  );
};

/**
 * Hook to trigger the coming soon modal
 * Usage: const handleComingSoon = useComingSoon('Feature Name');
 */
export const useComingSoon = (featureName = 'This feature') => {
  return (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (window.showComingSoon) {
      window.showComingSoon(featureName);
    }
  };
};

export default ComingSoonModal;
