import React from 'react';

/**
 * ✨ PHASE 11.1: Feedback Button Component
 * Reusable button that opens the feedback modal
 * 
 * Props:
 *   - onClick: Function to open feedback modal
 *   - variant: 'default', 'outline', 'icon' (default: 'default')
 *   - size: 'sm', 'md', 'lg' (default: 'md')
 *   - className: Additional CSS classes
 */
const FeedbackButton = ({ onClick, variant = 'default', size = 'md', className = '', text = 'Laporkan Masukan' }) => {
    const getButtonClass = () => {
        const baseClass = 'feedback-button';
        const variantClass = `feedback-button-${variant}`;
        const sizeClass = `feedback-button-${size}`;
        return `${baseClass} ${variantClass} ${sizeClass} ${className}`;
    };

    return (
        <button
            className={getButtonClass()}
            onClick={onClick}
            title="Laporkan bug atau ajukan permintaan fitur"
            type="button"
        >
            {variant === 'icon' ? (
                <span role="img" aria-label="feedback">💬</span>
            ) : (
                <>
                    <span role="img" aria-label="feedback">💬</span>
                    {text}
                </>
            )}
        </button>
    );
};

export default React.memo(FeedbackButton);
