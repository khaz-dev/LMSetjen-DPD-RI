import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Toast from '../views/plugin/Toast';
import './ComingSoonModal.css';

export const useComingSoon = (featureName = 'Fitur') => {
  return (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    Toast().fire({
      icon: 'info',
      title: 'Segera Hadir!',
      text: `${featureName} akan tersedia segera.`,
    });
  };
};

const ComingSoonModal = ({ featureName = 'Fitur', onClose }) => {
  // Lock body scroll and handle Escape key
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const modalContent = (
    <div className="coming-soon-modal-overlay show" onClick={onClose}>
      <div className="coming-soon-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="coming-soon-modal-header">
          <h3>Segera Hadir!</h3>
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
          <p>{featureName} akan tersedia segera.</p>
          <p className="coming-soon-subtitle">Kami bekerja keras untuk menghadirkan fitur ini!</p>
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

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

export default ComingSoonModal;
