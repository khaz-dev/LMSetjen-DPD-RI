import React from 'react';
import { Link } from 'react-router-dom';

const EmptyState = () => {
    return (
        <div className="modern-empty-state">
            <div className="empty-state-icon mb-4">
                <i className="fas fa-graduation-cap"></i>
            </div>
            <h4 className="mb-3" style={{ color: '#2c3e50' }}>No Courses Found</h4>
            <p className="text-muted mb-4" style={{ fontSize: '1.1rem' }}>
                You haven't created any courses yet. Start building your first course to share your knowledge with students.
            </p>
            <Link 
                to="/instructor/create-course/" 
                className="btn modern-create-btn"
            >
                <i className="fas fa-plus me-2"></i>Create Your First Course
            </Link>
        </div>
    );
};

export default EmptyState;