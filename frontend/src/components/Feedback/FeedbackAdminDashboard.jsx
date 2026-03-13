import React, { useState, useEffect } from 'react';
import './FeedbackAdminDashboard.css';
import useAxios from '../../utils/useAxios';
import Toast from '../../views/plugin/Toast';

/**
 * ✨ PHASE 11.1: Admin Feedback Dashboard
 * Allows admins to view, filter, and manage user feedback submissions
 */
const FeedbackAdminDashboard = () => {
    const [feedbacks, setFeedbacks] = useState([]);
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFeedback, setSelectedFeedback] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        status: '',
        type: '',
        priority: '',
        search: '',
    });

    const [adminNotes, setAdminNotes] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedPriority, setSelectedPriority] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Fetch feedback list
    useEffect(() => {
        fetchFeedbacks();
        fetchStats();
    }, [filters]);

    const fetchFeedbacks = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });

            const response = await useAxios.get(`/feedback/list/?${params}`);
            setFeedbacks(response.data.results || response.data);
        } catch (error) {
            console.error('Error fetching feedbacks:', error);
            Toast().fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Gagal memuat pengajuan masukan',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await useAxios.get('/feedback/stats/');
            setStats(response.data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSearchChange = (e) => {
        const { value } = e.target;
        setFilters(prev => ({ ...prev, search: value }));
    };

    const openFeedbackDetail = (feedback) => {
        setSelectedFeedback(feedback);
        setAdminNotes(feedback.admin_notes || '');
        setSelectedStatus(feedback.status);
        setSelectedPriority(feedback.priority);
        setShowModal(true);
    };

    const closeFeedbackModal = () => {
        setShowModal(false);
        setSelectedFeedback(null);
    };

    const saveFeedbackUpdate = async () => {
        if (!selectedFeedback) return;

        setIsSaving(true);
        try {
            const updateData = {
                status: selectedStatus,
                priority: selectedPriority,
                admin_notes: adminNotes,
            };

            const response = await useAxios.put(
                `/feedback/detail/${selectedFeedback.id}/`,
                updateData
            );

            Toast().fire({
                icon: 'success',
                title: 'Diperbarui',
                text: 'Masukan telah diperbarui dengan berhasil',
            });

            setSelectedFeedback(response.data);
            fetchFeedbacks(); // Refresh list
            setTimeout(() => closeFeedbackModal(), 600);
        } catch (error) {
            console.error('Error updating feedback:', error);
            Toast().fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Gagal memperbarui masukan',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const markAsResolved = async () => {
        if (!selectedFeedback) return;

        setIsSaving(true);
        try {
            const response = await useAxios.post(
                `/feedback/mark-resolved/${selectedFeedback.id}/`,
                { resolution_notes: adminNotes }
            );

            Toast().fire({
                icon: 'success',
                title: 'Diselesaikan',
                text: 'Masukan ditandai sebagai diselesaikan',
            });

            setSelectedFeedback(response.data.feedback);
            fetchFeedbacks();
        } catch (error) {
            console.error('Error marking as resolved:', error);
            Toast().fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Gagal menandai masukan sebagai diselesaikan',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const getStatusBadgeClass = (status) => {
        const statusMap = {
            open: 'badge-warning',
            under_review: 'badge-info',
            in_progress: 'badge-primary',
            resolved: 'badge-success',
            wont_fix: 'badge-secondary',
            closed: 'badge-dark',
        };
        return statusMap[status] || 'badge-secondary';
    };

    const getPriorityBadgeClass = (priority) => {
        const priorityMap = {
            low: 'badge-secondary',
            medium: 'badge-info',
            high: 'badge-warning',
            critical: 'badge-danger',
        };
        return priorityMap[priority] || 'badge-secondary';
    };

    // Translate status to Indonesian
    const getStatusLabel = (status) => {
        const statusMap = {
            open: 'Terbuka',
            under_review: 'Dalam Peninjauan',
            in_progress: 'Sedang Diproses',
            resolved: 'Diselesaikan',
            wont_fix: 'Tidak Akan Diperbaiki',
            closed: 'Ditutup',
        };
        return statusMap[status] || status.replace('_', ' ');
    };

    // Translate priority to Indonesian
    const getPriorityLabel = (priority) => {
        const priorityMap = {
            low: 'Rendah',
            medium: 'Sedang',
            high: 'Tinggi',
            critical: 'Kritis',
        };
        return priorityMap[priority] || priority;
    };

    // Translate user role to Indonesian
    const getUserRoleLabel = (role) => {
        const roleMap = {
            student: 'Peserta',
            teacher: 'Pengajar',
            instructor: 'Instruktur',
            admin: 'Admin',
            super_admin: 'Super Admin',
            user: 'Pengguna',
        };
        return roleMap[role] || role;
    };

    return (
        <div className="feedback-admin-dashboard">
            {/* Stats Cards */}
            {stats && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-number">{stats.total_feedback}</div>
                        <div className="stat-label">Total Masukan</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{stats.open_count}</div>
                        <div className="stat-label">Terbuka</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{stats.in_progress_count}</div>
                        <div className="stat-label">Sedang Diproses</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{stats.resolved_count}</div>
                        <div className="stat-label">Diselesaikan</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{stats.bug_reports}</div>
                        <div className="stat-label">Laporan Bug</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{stats.feature_requests}</div>
                        <div className="stat-label">Permintaan Fitur</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filters-section">
                <h3>Filter</h3>
                <div className="filters-row">
                    <input
                        type="text"
                        placeholder="Cari berdasarkan judul atau deskripsi..."
                        name="search"
                        value={filters.search}
                        onChange={handleSearchChange}
                        className="filter-input"
                    />
                    <select
                        name="type"
                        value={filters.type}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">Semua Jenis</option>
                        <option value="bug">Laporan Bug</option>
                        <option value="feature">Permintaan Fitur</option>
                    </select>
                    <select
                        name="status"
                        value={filters.status}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">Semua Status</option>
                        <option value="open">Terbuka</option>
                        <option value="under_review">Dalam Peninjauan</option>
                        <option value="in_progress">Sedang Diproses</option>
                        <option value="resolved">Diselesaikan</option>
                        <option value="wont_fix">Tidak Akan Diperbaiki</option>
                        <option value="closed">Ditutup</option>
                    </select>
                    <select
                        name="priority"
                        value={filters.priority}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">Semua Prioritas</option>
                        <option value="low">Rendah</option>
                        <option value="medium">Sedang</option>
                        <option value="high">Tinggi</option>
                        <option value="critical">Kritis</option>
                    </select>
                </div>
            </div>

            {/* Feedback List */}
            <div className="feedback-list-section">
                <h3>Pengajuan Masukan ({feedbacks.length})</h3>
                
                {isLoading ? (
                    <div className="loading">Memuat...</div>
                ) : feedbacks.length === 0 ? (
                    <div className="no-data">Tidak ada pengajuan masukan ditemukan</div>
                ) : (
                    <div className="feedback-table-wrapper">
                        <table className="feedback-table">
                            <thead>
                                <tr>
                                    <th>Jenis</th>
                                    <th>Judul</th>
                                    <th>Pengguna</th>
                                    <th>Status</th>
                                    <th>Prioritas</th>
                                    <th>Tanggal</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feedbacks.map(feedback => (
                                    <tr key={feedback.id}>
                                        <td>
                                            <span className="type-badge">
                                                {feedback.feedback_type === 'bug' ? '🐛' : '✨'}
                                            </span>
                                        </td>
                                        <td>{feedback.title}</td>
                                        <td>
                                            <div className="user-info">
                                                <strong>{feedback.user_name}</strong>
                                                <small>{getUserRoleLabel(feedback.user_role)}</small>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${getStatusBadgeClass(feedback.status)}`}>
                                                {getStatusLabel(feedback.status)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${getPriorityBadgeClass(feedback.priority)}`}>
                                                {getPriorityLabel(feedback.priority)}
                                            </span>
                                        </td>
                                        <td>
                                            <small>{new Date(feedback.created_at).toLocaleDateString()}</small>
                                        </td>
                                        <td>
                                            <button
                                                className="btn-view"
                                                onClick={() => openFeedbackDetail(feedback)}
                                            >
                                                Lihat
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Feedback Detail Modal */}
            {showModal && selectedFeedback && (
                <div className="feedback-modal-overlay" onClick={closeFeedbackModal}>
                    <div className="feedback-modal-content" onClick={e => e.stopPropagation()}>

                        <div className="modal-header">
                            <h3>{selectedFeedback.title}</h3>
                            <div className="modal-meta">
                                <span className={`badge ${getStatusBadgeClass(selectedFeedback.status)}`}>
                                    {getStatusLabel(selectedFeedback.status)}
                                </span>
                                <span className={`badge ${getPriorityBadgeClass(selectedFeedback.priority)}`}>
                                    {getPriorityLabel(selectedFeedback.priority)}
                                </span>
                            </div>
                            <button className="close-btn" onClick={closeFeedbackModal}>×</button>
                        </div>

                        <div className="modal-body">
                            {/* User Info */}
                            <div className="info-section">
                                <h4>Diajukan Oleh</h4>
                                <p>
                                    <strong>{selectedFeedback.user_name}</strong> ({getUserRoleLabel(selectedFeedback.user_role)})<br/>
                                    <small>{selectedFeedback.user_email}</small>
                                </p>
                            </div>

                            {/* Description */}
                            <div className="info-section">
                                <h4>Deskripsi</h4>
                                <p>{selectedFeedback.description}</p>
                            </div>

                            {/* Additional Info */}
                            {selectedFeedback.affected_area && (
                                <div className="info-section">
                                    <h4>Area yang Terkena Dampak</h4>
                                    <p>{selectedFeedback.affected_area}</p>
                                </div>
                            )}

                            {selectedFeedback.related_url && (
                                <div className="info-section">
                                    <h4>URL Terkait</h4>
                                    <p><a href={selectedFeedback.related_url} target="_blank" rel="noopener noreferrer">{selectedFeedback.related_url}</a></p>
                                </div>
                            )}

                            {selectedFeedback.attachments && (
                                <div className="info-section">
                                    <h4>Lampiran</h4>
                                    <p><a href={selectedFeedback.attachments} target="_blank" rel="noopener noreferrer">Lihat Tangkapan Layar</a></p>
                                </div>
                            )}

                            {/* Status & Priority Update */}
                            <div className="info-section">
                                <h4>Perbarui Status dan Prioritas</h4>
                                <div className="update-grid">
                                    <div>
                                        <label>Status</label>
                                        <select
                                            value={selectedStatus}
                                            onChange={e => setSelectedStatus(e.target.value)}
                                            className="update-select"
                                        >
                                            <option value="open">Terbuka</option>
                                            <option value="under_review">Dalam Peninjauan</option>
                                            <option value="in_progress">Sedang Diproses</option>
                                            <option value="resolved">Diselesaikan</option>
                                            <option value="wont_fix">Tidak Akan Diperbaiki</option>
                                            <option value="closed">Ditutup</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Prioritas</label>
                                        <select
                                            value={selectedPriority}
                                            onChange={e => setSelectedPriority(e.target.value)}
                                            className="update-select"
                                        >
                                            <option value="low">Rendah</option>
                                            <option value="medium">Sedang</option>
                                            <option value="high">Tinggi</option>
                                            <option value="critical">Kritis</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Admin Notes */}
                            <div className="info-section">
                                <h4>Catatan Admin</h4>
                                <textarea
                                    value={adminNotes}
                                    onChange={e => setAdminNotes(e.target.value)}
                                    placeholder="Tambahkan catatan internal, detail penyelesaian, dll."
                                    className="admin-notes"
                                    rows="4"
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={closeFeedbackModal}
                                disabled={isSaving}
                            >
                                Batal
                            </button>
                            <button
                                className="btn btn-success"
                                onClick={saveFeedbackUpdate}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(FeedbackAdminDashboard);
