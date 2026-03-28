import React, { useState, useEffect } from 'react';
import useAxios from '../../utils/useAxios';
import UserData from '../../views/plugin/UserData';
import { moment } from '../../utils/dayjs';
import './ActivityDisplay.css';

/**
 * ✨ PHASE 53: ActivityDisplay Component
 * Shows user's recent activities from API with filtering and pagination
 * Replaces manual activity aggregation on Dashboard
 * 
 * @param {number} maxDisplay - Maximum number of activities to display per page (default: 6)
 * @param {boolean} showViewAll - Whether to show "View All" button (default: true)
 * @param {string} variant - Display variant: "compact" for dashboard (truncated), "full" for full page (default: "compact")
 */
function ActivityDisplay({ maxDisplay = 6, showViewAll = true, variant = "compact" }) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        activity_type: '',
        success: ''
    });
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [showFilters, setShowFilters] = useState(false);

    // Activity type options with icons and colors
    const activityTypes = [
        { value: 'enrollment', label: 'Pendaftaran', icon: 'fa-user-graduate', color: 'success' },
        { value: 'lesson_started', label: 'Mulai Pelajaran', icon: 'fa-book-open', color: 'info' },
        { value: 'lesson_completed', label: 'Selesaikan Pelajaran', icon: 'fa-check-circle', color: 'primary' },
        { value: 'video_watched', label: 'Tonton Video', icon: 'fa-play-circle', color: 'warning' },
        { value: 'video_completed', label: 'Video Selesai', icon: 'fa-video', color: 'info' },
        { value: 'quiz_attempted', label: 'Kerjakan Kuis', icon: 'fa-clipboard-list', color: 'secondary' },
        { value: 'quiz_passed', label: 'Lulus Kuis', icon: 'fa-star', color: 'success' },
        { value: 'quiz_failed', label: 'Gagal Kuis', icon: 'fa-times-circle', color: 'danger' },
        { value: 'certificate_earned', label: 'Raih Sertifikat', icon: 'fa-award', color: 'danger' },
        { value: 'course_completed', label: 'Selesaikan Kursus', icon: 'fa-trophy', color: 'warning' },
        { value: 'question_asked', label: 'Buat Pertanyaan', icon: 'fa-question-circle', color: 'secondary' },
        { value: 'question_answered', label: 'Jawab Pertanyaan', icon: 'fa-comments', color: 'info' },
        { value: 'review_posted', label: 'Posting Review', icon: 'fa-comment-dots', color: 'primary' },
        { value: 'points_earned', label: 'Dapatkan Poin', icon: 'fa-coins', color: 'warning' },
        { value: 'search_query', label: 'Cari Kursus', icon: 'fa-search', color: 'secondary' },
        { value: 'content_liked', label: 'Sukai Konten', icon: 'fa-heart', color: 'danger' },
        { value: 'wishlist_added', label: 'Tambah Wishlist', icon: 'fa-bookmark', color: 'primary' },
    ];

    // Fetch activities from API
    useEffect(() => {
        const fetchActivities = async () => {
            try {
                setLoading(true);
                const params = new URLSearchParams();
                
                if (filters.activity_type) {
                    params.append('activity_type', filters.activity_type);
                }
                if (filters.success) {
                    params.append('success', filters.success);
                }
                params.append('limit', maxDisplay);
                params.append('offset', (page - 1) * maxDisplay);
                
                const response = await useAxios.get(
                    `student/activities/?${params.toString()}`
                );
                
                if (response.data) {
                    setActivities(response.data.results || []);
                    setTotalCount(response.data.count || 0);
                }
            } catch (error) {
                // Silently handle fetch errors
            } finally {
                setLoading(false);
            }
        };

        fetchActivities();
    }, [filters.activity_type, filters.success, page, maxDisplay]);

    const getActivityIcon = (activityType) => {
        const activity = activityTypes.find(a => a.value === activityType);
        return activity || { icon: 'fa-circle', color: 'secondary', label: activityType };
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
        setPage(1); // Reset to first page when filtering
    };

    const clearFilters = () => {
        setFilters({ activity_type: '', success: '' });
        setPage(1);
    };

    const hasActiveFilters = filters.activity_type || filters.success;

    if (loading && activities.length === 0) {
        return (
            <div className="activity-display loading">
                <div className="spinner-border spinner-sm text-primary" role="status">
                    <span className="visually-hidden">Memuat...</span>
                </div>
                <span className="ms-2">Memuat aktivitas Anda...</span>
            </div>
        );
    }

    return (
        <div className={`activity-display ${variant === 'compact' ? 'compact' : ''}`}>
            {/* Filter Controls */}
            <div className="activity-filter-section">
                <button
                    className="btn btn-sm btn-primary"
                    onClick={() => setShowFilters(!showFilters)}
                >
                    <i className={`fas fa-filter me-2`}></i>
                    {showFilters ? 'Sembunyikan Filter' : 'Tampilkan Filter'}
                </button>
            </div>

            {showFilters && (
                <div className="activity-filters mb-3" style={{
                    display: 'flex',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    padding: '1rem',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px'
                }}>
                    {/* Activity Type Filter */}
                    <div style={{ flex: '1 1 250px' }}>
                        <label className="form-label small fw-bold">Tipe Aktivitas</label>
                        <select
                            className="form-select form-select-sm"
                            value={filters.activity_type}
                            onChange={(e) => handleFilterChange('activity_type', e.target.value)}
                        >
                            <option value="">Semua Tipe</option>
                            {activityTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Success Filter */}
                    <div style={{ flex: '1 1 150px' }}>
                        <label className="form-label small fw-bold">Status</label>
                        <select
                            className="form-select form-select-sm"
                            value={filters.success}
                            onChange={(e) => handleFilterChange('success', e.target.value)}
                        >
                            <option value="">Semua Status</option>
                            <option value="true">Berhasil</option>
                            <option value="false">Gagal</option>
                        </select>
                    </div>

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end' }}>
                            <button
                                className="btn btn-sm btn-danger"
                                onClick={clearFilters}
                            >
                                <i className="fas fa-times me-1"></i>
                                Bersihkan
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Activities List */}
            <div className="activities-list">
                {activities.length > 0 ? (
                    activities.map((activity) => {
                        const actType = getActivityIcon(activity.activity_type);
                        return (
                            <div key={activity.id} className="activity-item" style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0rem',
                                padding: '1rem',
                                borderLeft: `4px solid var(--bs-${actType.color})`,
                                backgroundColor: '#f8f9fa',
                                borderRadius: '6px',
                                marginBottom: '0.75rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                                e.currentTarget.style.boxShadow = 'none';
                            }}>
                                {/* Row 1: Icon | Activity Type | Success Badge */}
                                <div style={{
                                    display: 'flex',
                                    gap: '1rem',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    {/* Icon - Column 1 */}
                                    <div style={{
                                        flex: '0 0 48px',
                                        width: '48px',
                                        height: '48px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: `var(--bs-${actType.color})`,
                                        borderRadius: '50%',
                                        color: 'white',
                                        fontSize: '1.25rem'
                                    }}>
                                        <i className={`fas ${actType.icon}`}></i>
                                    </div>

                                    {/* Activity Type Display - Column 2 */}
                                    <h6 style={{ 
                                        margin: 0, 
                                        fontSize: '0.95rem', 
                                        fontWeight: 600, 
                                        color: '#2c3e50',
                                        flex: '1',
                                        minWidth: 0
                                    }}>
                                        {activity.activity_type_display}
                                    </h6>

                                    {/* Success Badge - Column 3 */}
                                    <div style={{ flex: '0 0 auto' }}>
                                        {activity.success ? (
                                            <span className="badge bg-success">Berhasil</span>
                                        ) : (
                                            <span className="badge bg-danger">Gagal</span>
                                        )}
                                    </div>
                                </div>

                                {/* Row 2: Content (Full Width) */}
                                <div style={{ paddingLeft: '0' }}>
                                    {/* Title */}
                                    <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#555', fontWeight: 500 }} className={variant === 'compact' ? 'activity-truncate-line' : ''}>
                                        {activity.title}
                                    </p>

                                    {/* Course Title */}
                                    {activity.course_title && (
                                        <small style={{ color: '#999', display: 'block', marginBottom: '0.5rem' }} className={variant === 'compact' ? 'activity-truncate-line' : ''}>
                                            <i className="fas fa-folder me-1"></i>
                                            {activity.course_title}
                                        </small>
                                    )}

                                    {/* Activity Details */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '1rem',
                                        fontSize: '0.85rem',
                                        color: '#999',
                                        flexWrap: 'wrap'
                                    }}>
                                        <span>
                                            <i className="fas fa-calendar me-1"></i>
                                            {moment(activity.activity_date).fromNow()}
                                        </span>
                                        {activity.points_awarded > 0 && (
                                            <span style={{ color: '#ffc107' }}>
                                                <i className="fas fa-coins me-1"></i>
                                                Poin: {activity.points_awarded}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-5" style={{ color: '#999' }}>
                        <i className="fas fa-inbox" style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.4 }}></i>
                        <p>Tidak ada aktivitas</p>
                        <small>Mulai belajar untuk mencatat aktivitas Anda</small>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalCount > maxDisplay && (
                <div className="activity-pagination" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '1.5rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e9ecef'
                }}>
                    <small style={{ color: '#999' }}>
                        Menampilkan {(page - 1) * maxDisplay + 1} hingga {Math.min(page * maxDisplay, totalCount)} dari {totalCount} aktivitas
                    </small>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            className="btn btn-sm btn-outline-primary"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            <i className="fas fa-chevron-left"></i> Sebelumnya
                        </button>
                        <span style={{ padding: '0.375rem 0.75rem', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                            Halaman {page}
                        </span>
                        <button
                            className="btn btn-sm btn-outline-primary"
                            disabled={page * maxDisplay >= totalCount}
                            onClick={() => setPage(page + 1)}
                        >
                            Berikutnya <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* View All Button */}
            {showViewAll && totalCount > maxDisplay && (
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <a href="/student/activities/" className="btn btn-primary btn-sm">
                        <i className="fas fa-arrow-right me-2"></i>
                        Lihat Semua Aktivitas ({totalCount})
                    </a>
                </div>
            )}
        </div>
    );
}

export default ActivityDisplay;
