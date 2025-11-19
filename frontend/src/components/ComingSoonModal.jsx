import React, { useState } from 'react';
import Toast from '../views/plugin/Toast';
import './ComingSoonModal.css';

export const useComingSoon = (featureName = 'Feature') => {
  return (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    Toast().fire({
      icon: 'info',
      title: 'Coming Soon!',
      text: `${featureName} will be available soon.`,
    });
  };
};

const ComingSoonModal = ({ featureName = 'Feature', onClose }) => {
  return (
    <div className="coming-soon-modal-overlay" onClick={onClose}>
      <div className="coming-soon-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="coming-soon-modal-header">
          <h3>Coming Soon!</h3>
          <button 
            className="coming-soon-modal-close" 
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="coming-soon-modal-body">
          <i className="fas fa-hourglass-half coming-soon-icon"></i>
          <p>{featureName} will be available soon.</p>
          <p className="coming-soon-subtitle">We're working hard to bring you this feature!</p>
        </div>
        <div className="coming-soon-modal-footer">
          <button 
            className="btn btn-primary"
            onClick={onClose}
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonModal;
