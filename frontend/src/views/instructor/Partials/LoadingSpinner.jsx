import React from 'react';
import './LoadingSpinner.css';

function LoadingSpinner({ fullPage = false, message = "Loading..." }) {
    return (
        <div className={`loading-spinner-container ${fullPage ? 'fullpage' : ''}`}>
            <div className="loading-spinner-content">
                <div className="spinner-wrapper">
                    <div className="spinner-ring"></div>
                    <div className="spinner-ring"></div>
                    <div className="spinner-ring"></div>
                    <div className="spinner-core"></div>
                </div>
                <p className="loading-message">{message}</p>
            </div>
        </div>
    );
}

export default LoadingSpinner;
