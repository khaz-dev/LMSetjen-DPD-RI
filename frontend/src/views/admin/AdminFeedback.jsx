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
        <div className="admin-page-wrapper">
            <AdminHeader />
            <main className="admin-dashboard-container">
                <div className="container-fluid px-3 px-xl-4 footer-container">
                    <div className="page-header mb-3">
                        <h1 className="h3 fw-bold">📋 Manajemen Masukan Pengguna</h1>
                        <p className="text-muted">Lihat, kelola, dan respons laporan bug serta permintaan fitur dari pengguna</p>
                    </div>
                    <FeedbackAdminDashboard />
                </div>
            </main>
            <Footer />
        </div>
    );
}

export default React.memo(AdminFeedback);
