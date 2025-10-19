import React from 'react';
import './MinimalLoader.css';

/**
 * Minimal Loading Component for smooth page transitions
 * Replaces the annoying full-page loading spinner
 * Shows a subtle top progress bar instead
 */
function MinimalLoader({ message = "Loading..." }) {
    return (
        <div className="minimal-loader-container">
            <div className="minimal-loader-bar"></div>
            {message && <div className="minimal-loader-message">{message}</div>}
        </div>
    );
}

export default MinimalLoader;
