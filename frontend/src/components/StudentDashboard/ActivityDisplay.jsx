import React, { useState, useEffect } from 'react';
import useAxios from '../../utils/useAxios';
import UserData from '../../views/plugin/UserData';
import { moment } from '../../utils/dayjs';
import './ActivityDisplay.css';

/**
 * ✨ PHASE 64: ActivityDisplay Component (Refactored)
 * Shows user's recent activities from API with filtering and pagination
 * All inline styles moved to CSS for better maintainability
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
                <div className="activity-filters">
                    {/* Activity Type Filter */}
                    <div className="activity-filter-input">
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
                    <div className="activity-filter-status">
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
                        <div className="activity-filter-clear">
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
                            <div 
                                key={activity.id} 
                                className="activity-item"
                                style={{
                                    borderLeftColor: `var(--bs-${actType.color})`
                                }}
                            >
                                {/* Row 1: Icon | Activity Type | Success Badge */}
                                <div className="activity-item-row1">
                                    {/* Icon - Column 1 */}
                                    <div 
                                        className="activity-item-icon"
                                        style={{
                                            backgroundColor: `var(--bs-${actType.color})`
                                        }}
                                    >
                                        <i className={`fas ${actType.icon}`}></i>
                                    </div>

                                    {/* Activity Type Display - Column 2 */}
                                    <h6 className="activity-item-type">
                                        {activity.activity_type_display}
                                    </h6>

                                    {/* Success Badge - Column 3 */}
                                    <div className="activity-item-badges">
                                        {activity.success ? (
                                            <span className="badge bg-success">Berhasil</span>
                                        ) : (
                                            <span className="badge bg-danger">Gagal</span>
                                        )}
                                    </div>
                                </div>

                                {/* Row 2: Content (Full Width) */}
                                <div className="activity-item-row2">
                                    {/* Title */}
                                    <p className={`activity-item-title ${variant === 'compact' ? 'activity-truncate-line' : ''}`}>
                                        {activity.title}
                                    </p>

                                    {/* Course Title */}
                                    {activity.course_title && (
                                        <small className={`activity-item-meta ${variant === 'compact' ? 'activity-truncate-line' : ''}`}>
                                            <i className="fas fa-folder me-1"></i>
                                            {activity.course_title}
                                        </small>
                                    )}

                                    {/* Activity Details */}
                                    <div className="activity-item-details">
                                        <span>
                                            <i className="fas fa-calendar me-1"></i>
                                            {moment(activity.activity_date).fromNow()}
                                        </span>
                                        {activity.points_awarded > 0 && (
                                            <span className="points-badge">
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
                    <div className="activity-empty-state">
                        <i className="fas fa-inbox activity-empty-state-icon"></i>
                        <p>Tidak ada aktivitas</p>
                        <small>Mulai belajar untuk mencatat aktivitas Anda</small>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalCount > maxDisplay && (
                <div className="activity-pagination">
                    <small className="activity-pagination-info">
                        Menampilkan {(page - 1) * maxDisplay + 1} hingga {Math.min(page * maxDisplay, totalCount)} dari {totalCount} aktivitas
                    </small>
                    <div className="activity-pagination-buttons">
                        <button
                            className="btn btn-sm btn-outline-primary"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            <i className="fas fa-chevron-left"></i> Sebelumnya
                        </button>
                        <span className="activity-pagination-page">
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
                <div className="activity-view-all-wrapper">
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
