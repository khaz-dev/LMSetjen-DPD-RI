import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import BaseHeader from '../partials/BaseHeader';
import Footer from '../partials/Footer';
import Sidebar from './Partials/Sidebar';
import Header from './Partials/Header';
import useAxios from '../../utils/useAxios';
import UserData from '../plugin/UserData';
import { moment } from '../../utils/dayjs';
import { useInstructorSidebarCollapse } from './Partials/useInstructorSidebarCollapse';
import { usePageCache } from '../../utils/usePageCache';
import './InstructorNotifications.css';

/**
 * ✨ PHASE 64: Instructor Notifications Page
 * Full activity history view for instructors with comprehensive filtering and pagination
 * Shows instructor teaching activities: course management, lesson creation, student enrollment, grading
 */
function InstructorNotifications() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        activity_type: '',
        course_id: '',
        success: ''
    });
    const [courses, setCourses] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);
    const isCollapsed = useInstructorSidebarCollapse();

    // ✨ Activity type options - ALL 28 types with valid FA6 Free icon mappings
    // Includes both student activities (18 types) and instructor teaching activities (10 types)
    const activityTypes = [
        // Student Learning Activities
        { value: 'enrollment', label: 'Pendaftaran', icon: 'fa-user-graduate', color: 'success' },
        { value: 'lesson_started', label: 'Mulai Pelajaran', icon: 'fa-book-open', color: 'info' },
        { value: 'lesson_completed', label: 'Selesaikan Pelajaran', icon: 'fa-circle-check', color: 'success' },
        { value: 'video_watched', label: 'Tonton Video', icon: 'fa-circle-play', color: 'warning' },
        { value: 'video_completed', label: 'Video Selesai', icon: 'fa-video', color: 'info' },
        { value: 'quiz_attempted', label: 'Kerjakan Kuis', icon: 'fa-clipboard-question', color: 'info' },
        { value: 'quiz_passed', label: 'Lulus Kuis', icon: 'fa-trophy', color: 'success' },
        { value: 'quiz_failed', label: 'Gagal Kuis', icon: 'fa-circle-xmark', color: 'danger' },
        { value: 'certificate_earned', label: 'Raih Sertifikat', icon: 'fa-certificate', color: 'warning' },
        { value: 'course_completed', label: 'Selesaikan Kursus', icon: 'fa-graduation-cap', color: 'success' },
        { value: 'question_asked', label: 'Buat Pertanyaan', icon: 'fa-circle-question', color: 'info' },
        { value: 'question_answered', label: 'Jawab Pertanyaan', icon: 'fa-comment-dots', color: 'primary' },
        { value: 'review_posted', label: 'Posting Review', icon: 'fa-star', color: 'warning' },
        { value: 'points_earned', label: 'Dapatkan Poin', icon: 'fa-coins', color: 'warning' },
        { value: 'search_query', label: 'Cari Kursus', icon: 'fa-magnifying-glass', color: 'secondary' },
        { value: 'content_liked', label: 'Sukai Konten', icon: 'fa-heart', color: 'danger' },
        { value: 'wishlist_added', label: 'Tambah Wishlist', icon: 'fa-bookmark', color: 'primary' },
        { value: 'discussion_participated', label: 'Ikut Diskusi', icon: 'fa-comments', color: 'info' },
        // Instructor Teaching Activities
        { value: 'course_created', label: 'Buat Kursus', icon: 'fa-folder-plus', color: 'info' },
        { value: 'course_updated', label: 'Update Kursus', icon: 'fa-pen-to-square', color: 'info' },
        { value: 'course_deleted', label: 'Hapus Kursus', icon: 'fa-folder-minus', color: 'danger' },
        { value: 'course_published', label: 'Publikasikan Kursus', icon: 'fa-rocket', color: 'success' },
        { value: 'lesson_created', label: 'Tambah Pelajaran', icon: 'fa-file-circle-plus', color: 'info' },
        { value: 'lesson_updated', label: 'Update Pelajaran', icon: 'fa-file-pen', color: 'info' },
        { value: 'lesson_deleted', label: 'Hapus Pelajaran', icon: 'fa-file-circle-xmark', color: 'danger' },
        { value: 'quiz_created', label: 'Buat Kuis', icon: 'fa-list-check', color: 'primary' },
        { value: 'quiz_updated', label: 'Update Kuis', icon: 'fa-file-pen', color: 'info' },
        { value: 'quiz_deleted', label: 'Hapus Kuis', icon: 'fa-trash-can', color: 'danger' },
        { value: 'testimonial_posted', label: 'Kirim Testimoni', icon: 'fa-heart', color: 'warning' },
        { value: 'testimonial_updated', label: 'Update Testimoni', icon: 'fa-pen-to-square', color: 'info' },
        { value: 'testimonial_deleted', label: 'Hapus Testimoni', icon: 'fa-trash-can', color: 'danger' },
        { value: 'review_updated', label: 'Update Review', icon: 'fa-pen-to-square', color: 'info' },
        { value: 'review_deleted', label: 'Hapus Review', icon: 'fa-trash-can', color: 'danger' },
        { value: 'student_enrolled_manual', label: 'Daftar Siswa', icon: 'fa-user-plus', color: 'success' },
        { value: 'student_unenrolled', label: 'Hapus Siswa', icon: 'fa-user-minus', color: 'danger' },
        { value: 'announcement_posted', label: 'Posting Pengumuman', icon: 'fa-bullhorn', color: 'warning' },
        { value: 'grade_recorded', label: 'Berikan Nilai', icon: 'fa-award', color: 'primary' },
    ];

    // Points breakdown state
    const [pointsData, setPointsData] = useState(null);
    const [loadingPoints, setLoadingPoints] = useState(false);
    const [showPointsModal, setShowPointsModal] = useState(false);

    const fetchPointsBreakdown = async () => {
        try {
            setLoadingPoints(true);
            const res = await useAxios.get('instructor/points-breakdown/');
            if (res.data) {
                setPointsData(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch instructor points:', err);
        } finally {
            setLoadingPoints(false);
        }
    };

    useEffect(() => {
        fetchPointsBreakdown();
    }, []);

    // Fetch data
    const fetchData = async () => {
        try {
            // Fetch courses taught by this instructor
            const coursesRes = await useAxios.get(`teacher/course-lists/${UserData()?.teacher_id}/`);
            const coursesData = Array.isArray(coursesRes.data) ? coursesRes.data : (coursesRes.data?.results || []);
            setCourses(coursesData);

            return { courses: coursesData };
        } catch (error) {
            console.error('Failed to fetch data:', error);
            return { courses: [] };
        }
    };

    // Use cache for initial data
    const { data: cachedData, loading: fetching } = usePageCache(
        'instructor-notifications',
        fetchData,
        { showLoadingOnStale: false }
    );

    useEffect(() => {
        if (cachedData) {
            setCourses(cachedData.courses || []);
        }
    }, [cachedData]);

    // Fetch activities when filters or pagination changes
    useEffect(() => {
        const fetchActivities = async () => {
            try {
                setLoading(true);
                const params = new URLSearchParams();

                // ✨ PHASE 64: Show ALL activities from instructor's courses
                // (both student activities AND instructor teaching activities)
                // This matches the dashboard behavior and shows comprehensive activity history
                // Users can filter by specific types if needed

                if (filters.activity_type) {
                    params.append('activity_type', filters.activity_type);
                }
                if (filters.course_id) {
                    params.append('course_id', filters.course_id);
                }
                if (filters.success) {
                    params.append('success', filters.success);
                }
                params.append('limit', pageSize);
                params.append('offset', (page - 1) * pageSize);

                const response = await useAxios.get(`instructor/activities/?${params.toString()}`);

                if (response.data) {
                    setActivities(response.data.results || []);
                    setTotalCount(response.data.count || 0);
                }
            } catch (error) {
                // Silently handle fetch errors
                console.error('Failed to fetch activities:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchActivities();
    }, [filters, page, pageSize]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({ activity_type: '', course_id: '', success: '' });
        setPage(1);
    };

    const getActivityIcon = (activityType) => {
        const found = activityTypes.find(a => a.value === activityType);
        if (found) return found;

        const typeLower = (activityType || '').toLowerCase();
        if (typeLower.includes('delete') || typeLower.includes('hapus') || typeLower.includes('remove')) {
            return { icon: 'fa-trash-can', color: 'danger', label: 'Penghapusan' };
        }
        if (typeLower.includes('testimonial') || typeLower.includes('testi')) {
            return { icon: 'fa-heart', color: 'warning', label: 'Testimoni Platform' };
        }
        if (typeLower.includes('quiz') || typeLower.includes('exam')) {
            return { icon: 'fa-list-check', color: 'primary', label: activityType };
        }
        if (typeLower.includes('lesson') || typeLower.includes('material')) {
            return { icon: 'fa-file-lines', color: 'info', label: activityType };
        }
        if (typeLower.includes('course')) {
            return { icon: 'fa-book-open', color: 'info', label: activityType };
        }
        if (typeLower.includes('user') || typeLower.includes('student') || typeLower.includes('enroll')) {
            return { icon: 'fa-user-graduate', color: 'success', label: activityType };
        }
        if (typeLower.includes('certificate') || typeLower.includes('grade')) {
            return { icon: 'fa-award', color: 'primary', label: activityType };
        }
        return { icon: 'fa-bolt', color: 'secondary', label: activityType || 'Aktivitas' };
    };

    const hasActiveFilters = filters.activity_type || filters.course_id || filters.success;
    const totalPages = Math.ceil(totalCount / pageSize);

    if (fetching) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-notifications-page" style={{ minHeight: "calc(100vh - 120px)" }}>
                    <div className="container">
                        <Header />
                        <div className="row mt-0">
                            <Sidebar />
                            <div className="col-lg-9 col-md-8 col-12" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
                                        <span className="visually-hidden">Sedang memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Memuat notifikasi Anda...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    return (
        <>
            <BaseHeader />

            <section className="instructor-notifications-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Page Header */}
                            <div className="page-header">
                                <h2 className="fw-bold mb-2">
                                    <i className="fas fa-clock-rotate-left me-2"></i>
                                    Riwayat Aktivitas Instruktur
                                </h2>
                                <p className="text-muted mb-0">Rekapitulasi lengkap rekam jejak pengajaran (pembuatan, pembaruan, penghapusan materi) dan interaksi siswa pada kursus Anda</p>
                            </div>

                            {/* Points Summary Banner */}
                            <div className="points-summary-banner">
                                <div className="points-banner-info">
                                    <div className="points-banner-icon">
                                        <i className="fas fa-trophy"></i>
                                    </div>
                                    <div className="points-banner-text">
                                        <h4>{pointsData?.lifetime_points || 0} Poin Instruktur</h4>
                                        <p>
                                            {pointsData?.rank_position ? `Peringkat #${pointsData.rank_position} di Instruktur Terbaik` : 'Poin Gamifikasi Pengajar LMS'}
                                        </p>
                                    </div>
                                </div>

                                <div className="points-banner-stats">
                                    <div className="points-stat-pill" title="Kursus Dipublikasikan">
                                        <i className="fas fa-rocket text-success"></i>
                                        <span>{pointsData?.summary?.course_published?.count || 0} Publikasi</span>
                                    </div>
                                    <div className="points-stat-pill" title="Siswa Terdaftar">
                                        <i className="fas fa-user-graduate text-info"></i>
                                        <span>{pointsData?.summary?.student_enrollment?.count || 0} Siswa</span>
                                    </div>
                                    <div className="points-stat-pill" title="Rating & Testimoni">
                                        <i className="fas fa-heart text-warning"></i>
                                        <span>{pointsData?.summary?.student_rating?.count || 0} Rating & Testimoni</span>
                                    </div>
                                </div>

                                <div className="points-banner-action">
                                    <button
                                        type="button"
                                        className="btn-points-detail"
                                        onClick={() => setShowPointsModal(true)}
                                    >
                                        <i className="fas fa-circle-question"></i>
                                        Rincian & Riwayat Poin
                                    </button>
                                </div>
                            </div>

                            {/* Modal Rincian Poin & Aturan Gamifikasi */}
                            {showPointsModal && (
                                <div className="points-modal-overlay" onClick={() => setShowPointsModal(false)}>
                                    <div className="points-modal-card" onClick={(e) => e.stopPropagation()}>
                                        <div className="points-modal-header">
                                            <div>
                                                <h5><i className="fas fa-award me-2 text-warning"></i>Rincian Perolehan Poin Instruktur</h5>
                                                <small className="opacity-90">Transparansi dan riwayat perolehan poin Anda</small>
                                            </div>
                                            <button className="points-modal-close" onClick={() => setShowPointsModal(false)}>
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>

                                        <div className="points-modal-body">
                                            {/* Summary Cards */}
                                            <div className="row g-2 mb-3">
                                                <div className="col-4">
                                                    <div className="p-3 bg-light rounded-3 text-center border">
                                                        <small className="text-muted d-block mb-1">Sepanjang Masa</small>
                                                        <h4 className="fw-bold text-success mb-0">{pointsData?.lifetime_points || 0} pt</h4>
                                                    </div>
                                                </div>
                                                <div className="col-4">
                                                    <div className="p-3 bg-light rounded-3 text-center border">
                                                        <small className="text-muted d-block mb-1">Tahun Ini</small>
                                                        <h4 className="fw-bold text-primary mb-0">{pointsData?.yearly_points || 0} pt</h4>
                                                    </div>
                                                </div>
                                                <div className="col-4">
                                                    <div className="p-3 bg-light rounded-3 text-center border">
                                                        <small className="text-muted d-block mb-1">Peringkat</small>
                                                        <h4 className="fw-bold text-warning mb-0">#{pointsData?.rank_position || '-'}</h4>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Category Breakdown Badges */}
                                            <div className="p-3 bg-white rounded-3 border mb-4">
                                                <small className="fw-bold text-muted d-block mb-2 text-uppercase">Sumber Perolehan Poin:</small>
                                                <div className="d-flex flex-wrap gap-2">
                                                    <div className="badge bg-light text-dark border p-2 d-flex align-items-center gap-1">
                                                        <i className="fas fa-rocket text-success"></i>
                                                        <span>Publikasi Kursus: <strong>{pointsData?.summary?.course_published?.count || 0}</strong> ({pointsData?.summary?.course_published?.points || 0} pt)</span>
                                                    </div>
                                                    <div className="badge bg-light text-dark border p-2 d-flex align-items-center gap-1">
                                                        <i className="fas fa-heart text-warning"></i>
                                                        <span>Testimoni Platform: <strong>{pointsData?.summary?.platform_testimonial?.count || 0}</strong> ({pointsData?.summary?.platform_testimonial?.points || 0} pt)</span>
                                                    </div>
                                                    <div className="badge bg-light text-dark border p-2 d-flex align-items-center gap-1">
                                                        <i className="fas fa-user-graduate text-info"></i>
                                                        <span>Siswa Terdaftar: <strong>{pointsData?.summary?.student_enrollment?.count || 0}</strong> ({pointsData?.summary?.student_enrollment?.points || 0} pt)</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Point History */}
                                            <h6 className="fw-bold mb-3">
                                                <i className="fas fa-history me-2 text-teal"></i>
                                                Riwayat Audit Perolehan Poin
                                            </h6>
                                            {pointsData?.history && pointsData.history.length > 0 ? (
                                                <div className="points-history-list mb-4">
                                                    {pointsData.history.map((h) => (
                                                        <div key={h.id} className="points-history-item">
                                                            <div className="badge-points-gold">
                                                                +{h.points_awarded} pt
                                                            </div>
                                                            <div className="flex-grow-1">
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <span className="fw-bold text-dark small">{h.description}</span>
                                                                    <span className="badge bg-soft-info text-info border" style={{ fontSize: '0.7rem' }}>
                                                                        {h.activity_type_display}
                                                                    </span>
                                                                </div>
                                                                <small className="text-muted">{moment(h.awarded_at).format('DD MMM YYYY, HH:mm')}</small>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-muted small mb-4">Belum ada catatan audit perolehan poin.</p>
                                            )}

                                            {/* Point Earning Rules */}
                                            <h6 className="fw-bold mb-3">
                                                <i className="fas fa-book-open me-2 text-primary"></i>
                                                Cara Memperoleh Poin Instruktur
                                            </h6>
                                            <div className="points-rules-list">
                                                {pointsData?.rules?.map((rule) => (
                                                    <div key={rule.key} className="points-rule-card">
                                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                                            <strong className="text-dark small">{rule.title}</strong>
                                                            <span className="badge bg-success">{rule.points_text}</span>
                                                        </div>
                                                        <small className="text-muted">{rule.description}</small>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Filter Card */}
                            <div className="filter-card">
                                <div className="filter-header">
                                    <h5 className="mb-0 fw-bold">
                                        <i className="fas fa-filter me-2"></i>
                                        Filter
                                    </h5>
                                </div>

                                <div className="filter-controls" style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                    gap: '1rem',
                                    padding: '1.5rem'
                                }}>
                                    {/* Activity Type Filter */}
                                    <div>
                                        <label className="form-label small fw-bold">Tipe Aktivitas</label>
                                        <select
                                            className="form-select"
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

                                    {/* Course Filter */}
                                    <div>
                                        <label className="form-label small fw-bold">Kursus</label>
                                        <select
                                            className="form-select"
                                            value={filters.course_id}
                                            onChange={(e) => handleFilterChange('course_id', e.target.value)}
                                        >
                                            <option value="">Semua Kursus</option>
                                            {courses.map(course => (
                                                <option key={course.id} value={course.id}>
                                                    {course.title}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Success Filter */}
                                    <div>
                                        <label className="form-label small fw-bold">Status</label>
                                        <select
                                            className="form-select"
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
                                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                            <button
                                                className="btn btn-danger"
                                                onClick={clearFilters}
                                                title="Bersihkan Filter"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Page Size Selector */}
                            <div className="page-size-selector mb-3" style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '1rem'
                            }}>
                                <small className="text-muted">
                                    Menampilkan {activities.length > 0 ? (page - 1) * pageSize + 1 : 0} hingga {Math.min(page * pageSize, totalCount)} dari {totalCount} notifikasi
                                </small>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label htmlFor="pageSize" className="form-label small mb-0">Notifikasi per halaman:</label>
                                    <select
                                        id="pageSize"
                                        className="form-select form-select-sm"
                                        style={{ width: 'auto' }}
                                        value={pageSize}
                                        onChange={(e) => {
                                            setPageSize(parseInt(e.target.value));
                                            setPage(1);
                                        }}
                                    >
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                            </div>

                            {/* Activities List */}
                            <div className="activities-container">
                                {loading ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border spinner-sm text-primary" role="status">
                                            <span className="visually-hidden">Memuat...</span>
                                        </div>
                                        <p className="text-muted mt-2">Memuat notifikasi...</p>
                                    </div>
                                ) : activities.length > 0 ? (
                                    <div className="activities-list">
                                        {activities.map((activity) => {
                                            const actType = getActivityIcon(activity.activity_type);
                                            return (
                                                <div key={activity.id} className="activity-card">
                                                    <div className="activity-icon" style={{
                                                        backgroundColor: `var(--bs-${actType.color})`,
                                                    }}>
                                                        <i className={`fas ${actType.icon} text-white`}></i>
                                                    </div>

                                                    <div className="activity-content">
                                                        <div className="activity-header">
                                                            <h6 className="activity-type">
                                                                {activity.activity_type_display}
                                                            </h6>
                                                            <div className="activity-meta">
                                                                {activity.points_awarded > 0 && (
                                                                    <span className="badge-points-gold">
                                                                        <i className="fas fa-coins me-1"></i>+{activity.points_awarded} Poin
                                                                    </span>
                                                                )}
                                                                {!activity.success && (
                                                                    <span className="badge bg-danger ms-2">
                                                                        Gagal
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <p className="activity-title">
                                                            {activity.title}
                                                        </p>

                                                        {activity.description && (
                                                            <p className="activity-description">
                                                                {activity.description.replace(/\s*\(\+\d+\s*poin\)/gi, '')}
                                                            </p>
                                                        )}

                                                        <div className="activity-details">
                                                            {activity.course_title && (
                                                                <span className="detail-item">
                                                                    <i className="fas fa-folder me-1"></i>
                                                                    {activity.course_title}
                                                                </span>
                                                            )}
                                                            <span className="detail-item">
                                                                <i className="fas fa-calendar me-1"></i>
                                                                {moment(activity.activity_date).format('DD MMM YYYY HH:mm')}
                                                            </span>
                                                            {activity.duration_seconds && (
                                                                <span className="detail-item">
                                                                    <i className="fas fa-hourglass me-1"></i>
                                                                    {Math.round(activity.duration_seconds / 60)} menit
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-5" style={{ color: '#999' }}>
                                        <i className="fas fa-inbox" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.4 }}></i>
                                        <p className="fs-5">Tidak ada notifikasi</p>
                                        <small>Aktivitas siswa dan pengajaran Anda akan muncul di sini</small>
                                    </div>
                                )}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="pagination-controls mt-4" style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    flexWrap: 'wrap'
                                }}>
                                    <button
                                        className="btn btn-outline-primary btn-sm"
                                        disabled={page === 1}
                                        onClick={() => setPage(1)}
                                    >
                                        <i className="fas fa-chevron-left"></i> Pertama
                                    </button>
                                    <button
                                        className="btn btn-outline-primary btn-sm"
                                        disabled={page === 1}
                                        onClick={() => setPage(page - 1)}
                                    >
                                        <i className="fas fa-chevron-left"></i> Sebelumnya
                                    </button>

                                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                        const pageNum = page > 3 ? page + i - 2 : i + 1;
                                        if (pageNum > totalPages) return null;
                                        return (
                                            <button
                                                key={pageNum}
                                                className={`btn btn-sm ${page === pageNum ? 'btn-primary' : 'btn-outline-primary'}`}
                                                onClick={() => setPage(pageNum)}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}

                                    <button
                                        className="btn btn-outline-primary btn-sm"
                                        disabled={page === totalPages}
                                        onClick={() => setPage(page + 1)}
                                    >
                                        Berikutnya <i className="fas fa-chevron-right"></i>
                                    </button>
                                    <button
                                        className="btn btn-outline-primary btn-sm"
                                        disabled={page === totalPages}
                                        onClick={() => setPage(totalPages)}
                                    >
                                        Terakhir <i className="fas fa-chevron-right"></i>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default React.memo(InstructorNotifications);
