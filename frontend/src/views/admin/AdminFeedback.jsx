import React from 'react';
import AdminHeader from '../partials/AdminHeader';
import Footer from '../partials/Footer';
import FeedbackAdminDashboard from '../../components/Feedback/FeedbackAdminDashboard';
import './AdminFeedback.css';

/**
 * ✨ PHASE 11.1: Admin Feedback Management Page
 * Wrap the FeedbackAdminDashboard with standard admin layout
 */
function AdminFeedback() {
    return (
        <div className="admin-page-wrapper" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <AdminHeader />
            <div className="admin-feedback-page" style={{ flex: 1 }}>
                <div className="container">
                    <div className="page-header">
                        <h1>📋 Manajemen Masukan Pengguna</h1>
                        <p>Lihat, kelola, dan respons laporan bug serta permintaan fitur dari pengguna</p>
                    </div>
                    <FeedbackAdminDashboard />
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default React.memo(AdminFeedback);
