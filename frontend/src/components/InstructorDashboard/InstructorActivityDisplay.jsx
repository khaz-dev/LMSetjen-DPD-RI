import React, { useState, useEffect } from 'react';
import useAxios from '../../utils/useAxios';
import UserData from '../../views/plugin/UserData';
import { moment } from '../../utils/dayjs';
import './InstructorActivityDisplay.css';

/**
 * ✨ PHASE 63: InstructorActivityDisplay Component (Refactored)
 * Shows student and instructor activities from API with filtering and pagination
 * All inline styles moved to CSS for better maintainability
 * 
 * @param {number} maxDisplay - Maximum number of activities to display per page (default: 6)
 * @param {boolean} showViewAll - Whether to show "View All" button (default: true)
 * @param {string} variant - Display variant: "compact" for dashboard (truncated), "full" for full page (default: "compact")
 */
function InstructorActivityDisplay({
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

    // Activity type options with icons and colors
    // ✨ All icons verified with FontAwesome 6 Free: no pro icons, no blank glyphs, no literal question marks
    const activityTypes = [
        // 📚 Student Learning Activities
        { value: 'enrollment', label: 'Pendaftaran Kursus', icon: 'fa-user-graduate', color: 'success', category: 'siswa' },
        { value: 'lesson_started', label: 'Mulai Pelajaran', icon: 'fa-book-open', color: 'info', category: 'siswa' },
        { value: 'lesson_completed', label: 'Selesaikan Pelajaran', icon: 'fa-circle-check', color: 'success', category: 'siswa' },
        { value: 'video_watched', label: 'Tonton Video', icon: 'fa-circle-play', color: 'info', category: 'siswa' },
        { value: 'video_completed', label: 'Video Selesai', icon: 'fa-video', color: 'success', category: 'siswa' },
        { value: 'quiz_attempted', label: 'Kerjakan Kuis', icon: 'fa-pen', color: 'warning', category: 'siswa' },
        { value: 'quiz_passed', label: 'Lulus Kuis', icon: 'fa-trophy', color: 'success', category: 'siswa' },
        { value: 'quiz_failed', label: 'Tidak Lulus Kuis', icon: 'fa-circle-xmark', color: 'danger', category: 'siswa' },
        { value: 'certificate_earned', label: 'Raih Sertifikat', icon: 'fa-certificate', color: 'amber', category: 'siswa' },
        { value: 'course_completed', label: 'Selesaikan Kursus', icon: 'fa-flag-checkered', color: 'success', category: 'siswa' },
        { value: 'question_asked', label: 'Buat Pertanyaan', icon: 'fa-circle-question', color: 'info', category: 'siswa' },
        { value: 'question_answered', label: 'Jawab Pertanyaan', icon: 'fa-comments', color: 'teal', category: 'siswa' },
        { value: 'review_posted', label: 'Posting Review', icon: 'fa-star', color: 'amber', category: 'siswa' },
        { value: 'points_earned', label: 'Dapatkan Poin', icon: 'fa-coins', color: 'amber', category: 'siswa' },
        { value: 'search_query', label: 'Cari Kursus', icon: 'fa-magnifying-glass', color: 'secondary', category: 'siswa' },
        { value: 'content_liked', label: 'Sukai Konten', icon: 'fa-heart', color: 'danger', category: 'siswa' },
        { value: 'wishlist_added', label: 'Tambah Wishlist', icon: 'fa-bookmark', color: 'primary', category: 'siswa' },
        { value: 'discussion_participated', label: 'Ikut Diskusi', icon: 'fa-comments', color: 'info', category: 'siswa' },

        // 👨‍🏫 Instructor Teaching Activities (Meaningful & Distinct Icons)
        { value: 'course_created', label: 'Buat Kursus', icon: 'fa-folder-plus', color: 'teal', category: 'pengajar', badge: 'Mengajar' },
        { value: 'course_updated', label: 'Update Kursus', icon: 'fa-pen-to-square', color: 'info', category: 'pengajar', badge: 'Mengajar' },
        { value: 'course_deleted', label: 'Hapus Kursus', icon: 'fa-folder-minus', color: 'danger', category: 'pengajar', badge: 'Mengajar' },
        { value: 'course_published', label: 'Publikasikan Kursus', icon: 'fa-rocket', color: 'success', category: 'pengajar', badge: 'Mengajar' },
        { value: 'lesson_created', label: 'Tambah Pelajaran', icon: 'fa-file-circle-plus', color: 'teal', category: 'pengajar', badge: 'Mengajar' },
        { value: 'lesson_updated', label: 'Update Pelajaran', icon: 'fa-file-pen', color: 'info', category: 'pengajar', badge: 'Mengajar' },
        { value: 'lesson_deleted', label: 'Hapus Pelajaran', icon: 'fa-file-circle-xmark', color: 'danger', category: 'pengajar', badge: 'Mengajar' },
        { value: 'quiz_created', label: 'Buat Kuis', icon: 'fa-list-check', color: 'purple', category: 'pengajar', badge: 'Mengajar' },
        { value: 'quiz_updated', label: 'Update Kuis', icon: 'fa-file-pen', color: 'info', category: 'pengajar', badge: 'Mengajar' },
        { value: 'quiz_deleted', label: 'Hapus Kuis', icon: 'fa-trash-can', color: 'danger', category: 'pengajar', badge: 'Mengajar' },
        { value: 'testimonial_posted', label: 'Kirim Testimoni', icon: 'fa-heart', color: 'amber', category: 'pengajar', badge: 'Testimoni' },
        { value: 'testimonial_updated', label: 'Update Testimoni', icon: 'fa-pen-to-square', color: 'info', category: 'pengajar', badge: 'Testimoni' },
        { value: 'testimonial_deleted', label: 'Hapus Testimoni', icon: 'fa-trash-can', color: 'danger', category: 'pengajar', badge: 'Testimoni' },
        { value: 'review_updated', label: 'Update Review', icon: 'fa-pen-to-square', color: 'info', category: 'pengajar', badge: 'Review' },
        { value: 'review_deleted', label: 'Hapus Review', icon: 'fa-trash-can', color: 'danger', category: 'pengajar', badge: 'Review' },
        { value: 'student_enrolled_manual', label: 'Daftar Siswa', icon: 'fa-user-plus', color: 'success', category: 'pengajar', badge: 'Mengajar' },
        { value: 'student_unenrolled', label: 'Hapus Siswa', icon: 'fa-user-minus', color: 'danger', category: 'pengajar', badge: 'Mengajar' },
        { value: 'announcement_posted', label: 'Posting Pengumuman', icon: 'fa-bullhorn', color: 'warning', category: 'pengajar', badge: 'Mengajar' },
        { value: 'grade_recorded', label: 'Berikan Nilai', icon: 'fa-award', color: 'purple', category: 'pengajar', badge: 'Mengajar' },
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
                params.append('page', page);
                params.append('page_size', maxDisplay);
                params.append('limit', maxDisplay);
                params.append('offset', (page - 1) * maxDisplay);

                const response = await useAxios.get(
                    `instructor/activities/?${params.toString()}`
                );

                if (response.data) {
                    setActivities(response.data.results || []);
                    setTotalCount(response.data.count || 0);
                }
            } catch (error) {
                console.error('Error fetching instructor activities:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchActivities();
    }, [filters.activity_type, filters.success, page, maxDisplay]);

    // ✨ Smart semantic mapping: Ensures no activity icon is ever blank or lost meaning
    const getActivityIcon = (activityType) => {
        if (!activityType) {
            return { icon: 'fa-bolt', color: 'teal', label: 'Aktivitas' };
        }

        const exactMatch = activityTypes.find(a => a.value === activityType);
        if (exactMatch) return exactMatch;

        // Contextual fallback by keyword so no unknown activity displays generic ? or blank icon
        const key = String(activityType).toLowerCase();
        if (key.includes('delete') || key.includes('hapus') || key.includes('remove')) {
            return { icon: 'fa-trash-can', color: 'danger', label: 'Penghapusan' };
        }
        if (key.includes('quiz') || key.includes('kuis') || key.includes('exam') || key.includes('eval')) {
            return { icon: 'fa-list-check', color: 'purple', label: 'Kuis & Asesmen' };
        }
        if (key.includes('lesson') || key.includes('materi') || key.includes('lecture')) {
            return { icon: 'fa-file-circle-plus', color: 'teal', label: 'Materi Pelajaran' };
        }
        if (key.includes('course') || key.includes('kursus')) {
            return { icon: 'fa-book-open', color: 'teal', label: 'Kursus' };
        }
        if (key.includes('video') || key.includes('tonton') || key.includes('play')) {
            return { icon: 'fa-circle-play', color: 'info', label: 'Video Pelajaran' };
        }
        if (key.includes('cert') || key.includes('sertifikat')) {
            return { icon: 'fa-certificate', color: 'amber', label: 'Sertifikat' };
        }
        if (key.includes('enroll') || key.includes('daftar') || key.includes('student') || key.includes('siswa')) {
            return { icon: 'fa-user-graduate', color: 'success', label: 'Pendaftaran Siswa' };
        }
        if (key.includes('review') || key.includes('ulasan') || key.includes('rating') || key.includes('star')) {
            return { icon: 'fa-star', color: 'amber', label: 'Ulasan & Rating' };
        }
        if (key.includes('question') || key.includes('tanya') || key.includes('qa') || key.includes('comment') || key.includes('diskusi')) {
            return { icon: 'fa-comments', color: 'info', label: 'Tanya Jawab' };
        }
        if (key.includes('grade') || key.includes('nilai') || key.includes('score')) {
            return { icon: 'fa-award', color: 'purple', label: 'Penilaian' };
        }

        return { icon: 'fa-bolt', color: 'teal', label: activityType };
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({
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

    if (loading && activities.length === 0) {
        return (
            <div className="instructor-activity-display loading">
                <div className="spinner-border spinner-sm text-teal" role="status" style={{ width: '1.5rem', height: '1.5rem' }}>
                    <span className="visually-hidden">Memuat...</span>
                </div>
                <span className="ms-2 small text-muted">Memuat aktivitas terbaru...</span>
            </div>
        );
    }

    return (
        <div className={`instructor-activity-display ${variant === 'compact' ? 'compact' : ''}`}>
            {/* Optional Filter Controls (Only shown if showFilters is explicitly true) */}
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

            {/* Filter Inputs (Only shown if showFilters and toggled) */}
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
                            {activityTypes.map(type => (
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
                    activities.slice(0, maxDisplay).map((activity) => {
                        const actType = getActivityIcon(activity.activity_type);

                        // ✨ Sleek compact variant for modern dashboard
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
                                                    <i className="fas fa-book-bookmark me-1"></i>
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

                        // Default / Full variant
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
                                        {actType.badge && (
                                            <span className="badge activity-badge-instructor">
                                                <i className="fas fa-chalkboard-user me-1"></i>
                                                {actType.badge}
                                            </span>
                                        )}
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

                                    {activity.user_name && (
                                        <small className="activity-item-meta">
                                            <i className="fas fa-user me-1"></i>
                                            {activity.user_name}
                                        </small>
                                    )}

                                    {activity.course_title && (
                                        <small className="activity-item-course">
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
                                            <span className="activity-item-details-points">
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
                    <div className="activity-item-empty py-4 text-center">
                        <i className="fas fa-clock-rotate-left fa-2x mb-2 text-muted" style={{ opacity: 0.5 }}></i>
                        <h6 className="fw-semibold">Belum ada aktivitas</h6>
                        <p className="text-muted small mb-0">
                            Aktivitas siswa dan pengajaran Anda akan tampil di sini
                        </p>
                    </div>
                )}
            </div>

            {/* Optional Pagination (Only shown if showPagination is explicitly true) */}
            {showPagination && totalCount > maxDisplay && (
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

            {/* Optional View All Button */}
            {showViewAll && totalCount > maxDisplay && (
                <div className="activity-view-all-wrapper">
                    <a href="/instructor/notifications/" className="btn btn-primary btn-sm">
                        <i className="fas fa-arrow-right me-2"></i>
                        Lihat Semua Aktivitas ({totalCount})
                    </a>
                </div>
            )}
        </div>
    );
}

export default InstructorActivityDisplay;
