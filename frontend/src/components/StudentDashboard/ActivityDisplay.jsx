import React, { useState, useEffect } from 'react';
import useAxios from '../../utils/useAxios';
import UserData from '../../views/plugin/UserData';
import { moment } from '../../utils/dayjs';
import './ActivityDisplay.css';

/**
 * ✨ PHASE 65: ActivityDisplay Component (Compact & Modern Redesign)
 * Shows user's recent activities from API with streamlined layout matching InstructorActivityDisplay
 * 
 * @param {number} maxDisplay - Maximum number of activities to display per page (default: 4)
 * @param {boolean} showViewAll - Whether to show "View All" button (default: false)
 * @param {string} variant - Display variant: "compact" for dashboard, "full" for full page (default: "compact")
 * @param {boolean} showFilters - Whether to show filter controls (default: false)
 * @param {boolean} showPagination - Whether to show pagination controls (default: false)
 */
function ActivityDisplay({
    maxDisplay = 4,
    showViewAll = false,
    variant = "compact",
    showFilters = false,
    showPagination = false
}) {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        activity_type: '',
        success: ''
    });
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);

    // Activity type options with verified FontAwesome 6 icons and soft colors
    const activityTypes = [
        { value: 'enrollment', label: 'Pendaftaran Kursus', icon: 'fa-user-graduate', color: 'success' },
        { value: 'lesson_started', label: 'Mulai Pelajaran', icon: 'fa-book-open', color: 'info' },
        { value: 'lesson_completed', label: 'Selesaikan Pelajaran', icon: 'fa-circle-check', color: 'teal' },
        { value: 'video_watched', label: 'Tonton Video', icon: 'fa-circle-play', color: 'warning' },
        { value: 'video_completed', label: 'Video Selesai', icon: 'fa-video', color: 'info' },
        { value: 'quiz_attempted', label: 'Kerjakan Kuis', icon: 'fa-pen', color: 'secondary' },
        { value: 'quiz_passed', label: 'Lulus Kuis', icon: 'fa-trophy', color: 'success' },
        { value: 'quiz_failed', label: 'Gagal Kuis', icon: 'fa-circle-xmark', color: 'danger' },
        { value: 'certificate_earned', label: 'Raih Sertifikat', icon: 'fa-certificate', color: 'amber' },
        { value: 'course_completed', label: 'Selesaikan Kursus', icon: 'fa-flag-checkered', color: 'success' },
        { value: 'question_asked', label: 'Buat Pertanyaan', icon: 'fa-circle-question', color: 'secondary' },
        { value: 'question_answered', label: 'Jawab Pertanyaan', icon: 'fa-comments', color: 'teal' },
        { value: 'review_posted', label: 'Posting Review', icon: 'fa-star', color: 'amber' },
        { value: 'points_earned', label: 'Dapatkan Poin', icon: 'fa-coins', color: 'amber' },
        { value: 'search_query', label: 'Cari Kursus', icon: 'fa-magnifying-glass', color: 'secondary' },
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
        const activity = activityTypes.find((a) => a.value === activityType);
        return activity || { icon: 'fa-bolt', color: 'teal', label: activityType };
    };

    const handleFilterChange = (field, value) => {
        setFilters((prev) => ({
            ...prev,
            [field]: value
        }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({ activity_type: '', success: '' });
        setPage(1);
    };

    const hasActiveFilters = filters.activity_type || filters.success;

    // Loading State
    if (loading && activities.length === 0) {
        return (
            <div className="activity-compact-loading">
                <div className="spinner-border spinner-border-sm text-teal" role="status" style={{ width: '1.25rem', height: '1.25rem' }}>
                    <span className="visually-hidden">Memuat...</span>
                </div>
                <span className="ms-2 small text-muted">Memuat aktivitas terkini...</span>
            </div>
        );
    }

    return (
        <div className={`activity-display ${variant === 'compact' ? 'compact' : ''}`}>
            {/* Optional Filter Controls (Only if showFilters is explicitly true) */}
            {showFilters && (
                <div className="activity-filter-section mb-2">
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                    >
                        <i className="fas fa-filter me-2"></i>
                        {showFiltersPanel ? 'Sembunyikan Filter' : 'Filter Aktivitas'}
                    </button>
                </div>
            )}

            {showFilters && showFiltersPanel && (
                <div className="activity-filters mb-3">
                    <div className="activity-filter-input">
                        <label className="form-label small fw-bold">Tipe Aktivitas</label>
                        <select
                            className="form-select form-select-sm"
                            value={filters.activity_type}
                            onChange={(e) => handleFilterChange('activity_type', e.target.value)}
                        >
                            <option value="">Semua Tipe</option>
                            {activityTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

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

                        // ✨ Sleek compact variant matching Instructor Dashboard
                        if (variant === 'compact') {
                            return (
                                <div key={activity.id} className="activity-item-compact">
                                    <div className={`activity-compact-icon bg-soft-${actType.color} text-${actType.color}`}>
                                        <i className={`fas ${actType.icon}`}></i>
                                    </div>
                                    <div className="activity-compact-content">
                                        <div className="activity-compact-top">
                                            <span className="activity-compact-title" title={activity.title || activity.activity_type_display}>
                                                {activity.title || activity.activity_type_display}
                                            </span>
                                            <span className="activity-compact-time">
                                                {moment(activity.activity_date).fromNow()}
                                            </span>
                                        </div>
                                        <div className="activity-compact-meta">
                                            {activity.course_title && (
                                                <span className="compact-meta-chip course" title={`Kursus: ${activity.course_title}`}>
                                                    <i className="fas fa-folder-open me-1"></i>
                                                    {activity.course_title}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {activity.points_awarded > 0 && (
                                        <span className="activity-compact-points" title="Poin Diperoleh">
                                            +{activity.points_awarded} pt
                                        </span>
                                    )}
                                </div>
                            );
                        }

                        // Full / Default variant
                        return (
                            <div
                                key={activity.id}
                                className="activity-item"
                                style={{
                                    borderLeftColor: `var(--bs-${actType.color})`
                                }}
                            >
                                <div className="activity-item-row1">
                                    <div
                                        className="activity-item-icon"
                                        style={{
                                            backgroundColor: `var(--bs-${actType.color})`
                                        }}
                                    >
                                        <i className={`fas ${actType.icon}`}></i>
                                    </div>
                                    <h6 className="activity-item-type">
                                        {activity.activity_type_display}
                                    </h6>
                                    <div className="activity-item-badges">
                                        {activity.success ? (
                                            <span className="badge bg-success">Berhasil</span>
                                        ) : (
                                            <span className="badge bg-danger">Gagal</span>
                                        )}
                                    </div>
                                </div>

                                <div className="activity-item-row2">
                                    <p className="activity-item-title">
                                        {activity.title}
                                    </p>
                                    {activity.course_title && (
                                        <small className="activity-item-meta">
                                            <i className="fas fa-folder me-1"></i>
                                            {activity.course_title}
                                        </small>
                                    )}
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
                    <div className="activity-empty-compact">
                        <i className="fas fa-clock-rotate-left"></i>
                        <span>Belum ada riwayat aktivitas terbaru</span>
                    </div>
                )}
            </div>

            {/* Pagination (Only if showPagination is explicitly true) */}
            {showPagination && totalCount > maxDisplay && (
                <div className="activity-pagination mt-2">
                    <small className="activity-pagination-info">
                        Menampilkan {(page - 1) * maxDisplay + 1} - {Math.min(page * maxDisplay, totalCount)} dari {totalCount}
                    </small>
                    <div className="activity-pagination-buttons">
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            disabled={page * maxDisplay >= totalCount}
                            onClick={() => setPage(page + 1)}
                        >
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            )}

            {/* View All Button (Only if showViewAll is explicitly true) */}
            {showViewAll && totalCount > maxDisplay && (
                <div className="activity-view-all-wrapper mt-2">
                    <a href="/student/activities/" className="btn btn-primary btn-sm w-100">
                        <i className="fas fa-arrow-right me-2"></i>
                        Lihat Semua Aktivitas ({totalCount})
                    </a>
                </div>
            )}
        </div>
    );
}

export default ActivityDisplay;
