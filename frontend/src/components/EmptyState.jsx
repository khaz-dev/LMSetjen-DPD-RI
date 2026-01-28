import React, { memo } from 'react';
import { Link } from 'react-router-dom';

const EmptyState = () => {
    return (
        <div className="modern-empty-state">
            <div className="empty-state-icon mb-4">
                <i className="fas fa-graduation-cap"></i>
            </div>
            <h4 className="mb-3" style={{ color: '#2c3e50' }}>Tidak Ada Kursus Ditemukan</h4>
            <p className="text-muted mb-4" style={{ fontSize: '1.1rem' }}>
                Anda belum membuat kursus apa pun. Mulai membangun kursus pertama Anda untuk berbagi pengetahuan dengan siswa.
            </p>
            <Link 
                to="/instructor/create-course/" 
                className="btn modern-create-btn"
            >
                <i className="fas fa-plus me-2"></i>Buat Kursus Pertama Anda
            </Link>
        </div>
    );
};

export default memo(EmptyState);