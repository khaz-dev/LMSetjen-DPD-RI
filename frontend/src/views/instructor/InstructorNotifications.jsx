import React, { useState, useEffect, useMemo } from 'react';
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
 * ✨ Redesigned Instructor Notifications & Activity History Page
 * Compact, modern, high-density layout with integrated Gamification and Filter Toolbar
 */
function InstructorNotifications() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        activity_type: '',
        course_id: '',
        success: '',
        role: ''
    });
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'teaching' | 'student' | 'points'
    const [searchTerm, setSearchTerm] = useState('');
    const [courses, setCourses] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);
    const isCollapsed = useInstructorSidebarCollapse();

    // Points breakdown state
    const [pointsData, setPointsData] = useState(null);
    const [loadingPoints, setLoadingPoints] = useState(false);
    const [showPointsModal, setShowPointsModal] = useState(false);

    // Activity type options - comprehensive list with category and icon mappings
    const activityTypes = [
        // Teaching / Pengajaran Instruktur
        { value: 'course_published', label: 'Publikasikan Kursus', icon: 'fa-rocket', color: 'emerald', role: 'instructor' },
        { value: 'course_created', label: 'Buat Kursus', icon: 'fa-folder-plus', color: 'teal', role: 'instructor' },
        { value: 'course_updated', label: 'Update Kursus', icon: 'fa-pen-to-square', color: 'blue', role: 'instructor' },
        { value: 'course_deleted', label: 'Hapus Kursus', icon: 'fa-folder-minus', color: 'rose', role: 'instructor' },
        { value: 'lesson_created', label: 'Tambah Pelajaran', icon: 'fa-file-circle-plus', color: 'teal', role: 'instructor' },
        { value: 'lesson_updated', label: 'Update Pelajaran', icon: 'fa-file-pen', color: 'blue', role: 'instructor' },
        { value: 'lesson_deleted', label: 'Hapus Pelajaran', icon: 'fa-file-circle-xmark', color: 'rose', role: 'instructor' },
        { value: 'quiz_created', label: 'Buat Kuis', icon: 'fa-list-check', color: 'indigo', role: 'instructor' },
        { value: 'quiz_updated', label: 'Update Kuis', icon: 'fa-file-pen', color: 'blue', role: 'instructor' },
        { value: 'quiz_deleted', label: 'Hapus Kuis', icon: 'fa-trash-can', color: 'rose', role: 'instructor' },
        { value: 'announcement_posted', label: 'Posting Pengumuman', icon: 'fa-bullhorn', color: 'amber', role: 'instructor' },
        { value: 'grade_recorded', label: 'Berikan Nilai', icon: 'fa-award', color: 'indigo', role: 'instructor' },
        { value: 'student_enrolled_manual', label: 'Daftar Siswa Manual', icon: 'fa-user-plus', color: 'emerald', role: 'instructor' },
        { value: 'student_unenrolled', label: 'Hapus Siswa', icon: 'fa-user-minus', color: 'rose', role: 'instructor' },
        { value: 'testimonial_posted', label: 'Kirim Testimoni', icon: 'fa-heart', color: 'amber', role: 'instructor' },
        { value: 'testimonial_updated', label: 'Update Testimoni', icon: 'fa-pen-to-square', color: 'blue', role: 'instructor' },
        { value: 'testimonial_deleted', label: 'Hapus Testimoni', icon: 'fa-trash-can', color: 'rose', role: 'instructor' },
        { value: 'review_updated', label: 'Update Review', icon: 'fa-pen-to-square', color: 'blue', role: 'instructor' },
        { value: 'review_deleted', label: 'Hapus Review', icon: 'fa-trash-can', color: 'rose', role: 'instructor' },

        // Student Learning Activities
        { value: 'enrollment', label: 'Pendaftaran Siswa', icon: 'fa-user-graduate', color: 'emerald', role: 'student' },
        { value: 'course_completed', label: 'Selesaikan Kursus', icon: 'fa-graduation-cap', color: 'emerald', role: 'student' },
        { value: 'certificate_earned', label: 'Raih Sertifikat', icon: 'fa-certificate', color: 'amber', role: 'student' },
        { value: 'lesson_completed', label: 'Selesaikan Pelajaran', icon: 'fa-circle-check', color: 'emerald', role: 'student' },
        { value: 'lesson_started', label: 'Mulai Pelajaran', icon: 'fa-book-open', color: 'blue', role: 'student' },
        { value: 'quiz_passed', label: 'Lulus Kuis', icon: 'fa-trophy', color: 'emerald', role: 'student' },
        { value: 'quiz_attempted', label: 'Kerjakan Kuis', icon: 'fa-clipboard-question', color: 'cyan', role: 'student' },
        { value: 'quiz_failed', label: 'Gagal Kuis', icon: 'fa-circle-xmark', color: 'rose', role: 'student' },
        { value: 'video_completed', label: 'Video Selesai', icon: 'fa-video', color: 'indigo', role: 'student' },
        { value: 'video_watched', label: 'Tonton Video', icon: 'fa-circle-play', color: 'amber', role: 'student' },
        { value: 'question_asked', label: 'Buat Pertanyaan', icon: 'fa-circle-question', color: 'indigo', role: 'student' },
        { value: 'question_answered', label: 'Jawab Pertanyaan', icon: 'fa-comment-dots', color: 'blue', role: 'student' },
        { value: 'review_posted', label: 'Posting Review', icon: 'fa-star', color: 'amber', role: 'student' },
        { value: 'points_earned', label: 'Dapatkan Poin', icon: 'fa-coins', color: 'amber', role: 'gamification' },
        { value: 'discussion_participated', label: 'Ikut Diskusi', icon: 'fa-comments', color: 'blue', role: 'student' },
        { value: 'content_liked', label: 'Sukai Konten', icon: 'fa-heart', color: 'rose', role: 'student' },
        { value: 'wishlist_added', label: 'Tambah Wishlist', icon: 'fa-bookmark', color: 'teal', role: 'student' },
        { value: 'search_query', label: 'Cari Kursus', icon: 'fa-magnifying-glass', color: 'slate', role: 'student' },
    ];

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

    // Fetch instructor courses
    const fetchData = async () => {
        try {
            const coursesRes = await useAxios.get(`teacher/course-lists/${UserData()?.teacher_id}/`);
            const coursesData = Array.isArray(coursesRes.data) ? coursesRes.data : (coursesRes.data?.results || []);
            setCourses(coursesData);
            return { courses: coursesData };
        } catch (error) {
            console.error('Failed to fetch data:', error);
            return { courses: [] };
        }
    };

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

    // Fetch activities
    useEffect(() => {
        const fetchActivities = async () => {
            try {
                setLoading(true);
                const params = new URLSearchParams();

                if (filters.activity_type) {
                    params.append('activity_type', filters.activity_type);
                }
                if (filters.course_id) {
                    params.append('course_id', filters.course_id);
                }
                if (filters.success) {
                    params.append('success', filters.success);
                }
                if (filters.role) {
                    params.append('role', filters.role);
                }

                params.append('limit', pageSize);
                params.append('offset', (page - 1) * pageSize);

                const response = await useAxios.get(`instructor/activities/?${params.toString()}`);

                if (response.data) {
                    setActivities(response.data.results || []);
                    setTotalCount(response.data.count || 0);
                }
            } catch (error) {
                console.error('Failed to fetch activities:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchActivities();
    }, [filters, page, pageSize]);

    // Tab switcher
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setPage(1);
        if (tab === 'all') {
            setFilters(prev => ({ ...prev, role: '' }));
        } else if (tab === 'teaching') {
            setFilters(prev => ({ ...prev, role: 'instructor' }));
        } else if (tab === 'student') {
            setFilters(prev => ({ ...prev, role: 'student' }));
        } else if (tab === 'points') {
            setFilters(prev => ({ ...prev, role: '' }));
        }
    };

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({ activity_type: '', course_id: '', success: '', role: '' });
        setActiveTab('all');
        setSearchTerm('');
        setPage(1);
    };

    // Activity icon & styling helper
    const getActivityMeta = (activity) => {
        const type = activity?.activity_type;
        const found = activityTypes.find(a => a.value === type);
        if (found) {
            return {
                ...found,
                roleCategory: activity.role_at_time === 'instructor' ? 'Pengajaran' : 'Siswa'
            };
        }

        const typeLower = (type || '').toLowerCase();
        let color = 'teal';
        let icon = 'fa-bolt';
        let label = activity?.activity_type_display || type || 'Aktivitas';

        if (typeLower.includes('delete') || typeLower.includes('hapus') || typeLower.includes('remove') || typeLower.includes('fail')) {
            color = 'rose';
            icon = 'fa-trash-can';
        } else if (typeLower.includes('publish') || typeLower.includes('rocket')) {
            color = 'emerald';
            icon = 'fa-rocket';
        } else if (typeLower.includes('enroll') || typeLower.includes('student') || typeLower.includes('siswa')) {
            color = 'emerald';
            icon = 'fa-user-graduate';
        } else if (typeLower.includes('quiz') || typeLower.includes('exam')) {
            color = 'indigo';
            icon = 'fa-list-check';
        } else if (typeLower.includes('lesson') || typeLower.includes('materi')) {
            color = 'blue';
            icon = 'fa-file-lines';
        } else if (typeLower.includes('course') || typeLower.includes('kursus')) {
            color = 'teal';
            icon = 'fa-book-open';
        } else if (typeLower.includes('point') || typeLower.includes('poin') || typeLower.includes('award')) {
            color = 'amber';
            icon = 'fa-coins';
        }

        return {
            icon,
            color,
            label,
            roleCategory: activity.role_at_time === 'instructor' ? 'Pengajaran' : 'Siswa'
        };
    };

    // Client-side instant filter for search term & points tab
    const displayedActivities = useMemo(() => {
        let result = activities;

        if (activeTab === 'points') {
            result = result.filter(a => Number(a.points_awarded) > 0);
        }

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            result = result.filter(a => {
                const titleMatch = (a.title || '').toLowerCase().includes(q);
                const descMatch = (a.description || '').toLowerCase().includes(q);
                const courseMatch = (a.course_title || '').toLowerCase().includes(q);
                const userMatch = (a.user_name || '').toLowerCase().includes(q);
                return titleMatch || descMatch || courseMatch || userMatch;
            });
        }

        return result;
    }, [activities, searchTerm, activeTab]);

    const hasActiveFilters = Boolean(
        filters.activity_type ||
        filters.course_id ||
        filters.success ||
        filters.role ||
        activeTab !== 'all' ||
        searchTerm.trim()
    );

    const totalPages = Math.ceil(totalCount / pageSize);

    if (fetching) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-notifications-page">
                    <div className="container">
                        <Header />
                        <div className="row mt-0">
                            <Sidebar />
                            <div className="col-lg-9 col-md-8 col-12 d-flex align-items-center justify-content-center" style={{ minHeight: "50vh" }}>
                                <div className="text-center">
                                    <div className="spinner-grow text-teal" role="status" style={{ width: "2rem", height: "2rem" }}>
                                        <span className="visually-hidden">Sedang memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted small fw-medium">Menyiapkan riwayat aktivitas Anda...</p>
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

                            {/* =========================================================================
                                1. UNIFIED HERO & GAMIFICATION BANNER (Compact & Eye-catching)
                                ========================================================================= */}
                            <div className="act-hero-card">
                                <div className="act-hero-bg-accent"></div>
                                <div className="act-hero-top">
                                    <div className="act-hero-info">
                                        <div className="act-hero-badge">
                                            <i className="fas fa-shield-halved"></i>
                                            <span>Pusat Aktivitas Instruktur</span>
                                        </div>
                                        <h2 className="act-hero-title">
                                            <i className="fas fa-clock-rotate-left"></i>
                                            Riwayat Aktivitas & Log
                                        </h2>
                                        <p className="act-hero-desc">
                                            Monitor rekam jejak pengajaran materi, partisipasi kuis, dan interaksi siswa di lingkungan LMSetjen DPD RI.
                                        </p>
                                    </div>

                                    {/* Gamification Points Widget */}
                                    <div className="act-hero-gamification">
                                        <div className="act-points-badge-wrap">
                                            <div className="act-points-icon">
                                                <i className="fas fa-trophy"></i>
                                            </div>
                                            <div className="act-points-content">
                                                <div className="act-points-num">
                                                    {pointsData?.lifetime_points || 0}
                                                    <span className="act-points-unit">pt</span>
                                                </div>
                                                <div className="act-points-rank">
                                                    <i className="fas fa-medal text-warning"></i>
                                                    <span>{pointsData?.rank_position ? `Peringkat #${pointsData.rank_position}` : 'Instruktur LMS'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="act-btn-points-detail"
                                            onClick={() => setShowPointsModal(true)}
                                            title="Lihat rincian aturan dan riwayat audit perolehan poin"
                                        >
                                            <i className="fas fa-circle-question"></i>
                                            <span>Rincian Poin</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Integrated Stat Pills Row */}
                                <div className="act-hero-stats">
                                    <div className="act-stat-chip">
                                        <div className="act-stat-chip-icon bg-soft-teal">
                                            <i className="fas fa-list-check"></i>
                                        </div>
                                        <div className="act-stat-chip-info">
                                            <span className="act-stat-chip-val">{totalCount}</span>
                                            <span className="act-stat-chip-lbl">Total Log</span>
                                        </div>
                                    </div>
                                    <div className="act-stat-chip">
                                        <div className="act-stat-chip-icon bg-soft-emerald">
                                            <i className="fas fa-rocket"></i>
                                        </div>
                                        <div className="act-stat-chip-info">
                                            <span className="act-stat-chip-val">{pointsData?.summary?.course_published?.count || 0}</span>
                                            <span className="act-stat-chip-lbl">Kursus Terbit</span>
                                        </div>
                                    </div>
                                    <div className="act-stat-chip">
                                        <div className="act-stat-chip-icon bg-soft-blue">
                                            <i className="fas fa-user-graduate"></i>
                                        </div>
                                        <div className="act-stat-chip-info">
                                            <span className="act-stat-chip-val">{pointsData?.summary?.student_enrollment?.count || 0}</span>
                                            <span className="act-stat-chip-lbl">Siswa Terdaftar</span>
                                        </div>
                                    </div>
                                    <div className="act-stat-chip">
                                        <div className="act-stat-chip-icon bg-soft-amber">
                                            <i className="fas fa-star"></i>
                                        </div>
                                        <div className="act-stat-chip-info">
                                            <span className="act-stat-chip-val">
                                                {(pointsData?.summary?.student_rating?.count || 0) + (pointsData?.summary?.platform_testimonial?.count || 0)}
                                            </span>
                                            <span className="act-stat-chip-lbl">Rating & Testi</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* =========================================================================
                                2. INTEGRATED CONTROL TOOLBAR (Compact, Filter & Search In One)
                                ========================================================================= */}
                            <div className="act-toolbar-card">
                                {/* Top Toolbar: Category Tabs & Search Bar */}
                                <div className="act-toolbar-top">
                                    <div className="act-category-tabs">
                                        <button
                                            type="button"
                                            className={`act-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                                            onClick={() => handleTabChange('all')}
                                        >
                                            <i className="fas fa-layer-group"></i>
                                            <span>Semua</span>
                                            <span className="act-tab-count">{totalCount}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`act-tab-btn ${activeTab === 'teaching' ? 'active' : ''}`}
                                            onClick={() => handleTabChange('teaching')}
                                        >
                                            <i className="fas fa-chalkboard-user"></i>
                                            <span>Pengajaran</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`act-tab-btn ${activeTab === 'student' ? 'active' : ''}`}
                                            onClick={() => handleTabChange('student')}
                                        >
                                            <i className="fas fa-user-graduate"></i>
                                            <span>Aktivitas Siswa</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`act-tab-btn ${activeTab === 'points' ? 'active' : ''}`}
                                            onClick={() => handleTabChange('points')}
                                        >
                                            <i className="fas fa-coins text-warning"></i>
                                            <span>Perolehan Poin</span>
                                        </button>
                                    </div>

                                    {/* Fast Search Input */}
                                    <div className="act-search-box">
                                        <i className="fas fa-magnifying-glass act-search-icon"></i>
                                        <input
                                            type="text"
                                            className="act-search-input"
                                            placeholder="Cari aktivitas, materi, siswa..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                        {searchTerm && (
                                            <button
                                                type="button"
                                                className="act-search-clear"
                                                onClick={() => setSearchTerm('')}
                                                title="Hapus pencarian"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Filter Controls Row */}
                                <div className="act-toolbar-filters">
                                    <div className="act-filter-group">
                                        <span className="act-filter-label">
                                            <i className="fas fa-tag"></i>
                                            Tipe:
                                        </span>
                                        <select
                                            className="act-select"
                                            value={filters.activity_type}
                                            onChange={(e) => handleFilterChange('activity_type', e.target.value)}
                                        >
                                            <option value="">Semua Tipe Aktivitas</option>
                                            {activityTypes.map(type => (
                                                <option key={type.value} value={type.value}>
                                                    {type.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="act-filter-group">
                                        <span className="act-filter-label">
                                            <i className="fas fa-book-open"></i>
                                            Kursus:
                                        </span>
                                        <select
                                            className="act-select act-select-course"
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

                                    <div className="act-filter-group">
                                        <span className="act-filter-label">
                                            <i className="fas fa-circle-check"></i>
                                            Status:
                                        </span>
                                        <select
                                            className="act-select act-select-sm"
                                            value={filters.success}
                                            onChange={(e) => handleFilterChange('success', e.target.value)}
                                        >
                                            <option value="">Semua Status</option>
                                            <option value="true">Berhasil</option>
                                            <option value="false">Gagal</option>
                                        </select>
                                    </div>

                                    <div className="act-filter-group ms-auto">
                                        <span className="act-filter-label">
                                            <i className="fas fa-table-list"></i>
                                            Baris:
                                        </span>
                                        <select
                                            className="act-select act-select-sm"
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

                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            className="act-btn-reset-filters"
                                            onClick={clearFilters}
                                            title="Bersihkan semua filter"
                                        >
                                            <i className="fas fa-rotate-left"></i>
                                            <span>Reset</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* =========================================================================
                                3. ACTIVITIES FEED CONTAINER (Compact, High-Density Timeline)
                                ========================================================================= */}
                            <div className="act-main-card">
                                <div className="act-main-header">
                                    <div className="act-main-title">
                                        <i className="fas fa-stream"></i>
                                        <span>Daftar Log Aktivitas</span>
                                    </div>
                                    <div className="act-main-meta">
                                        Menampilkan <strong>{activities.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> - <strong>{Math.min(page * pageSize, totalCount)}</strong> dari <strong>{totalCount}</strong> riwayat
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="act-loading-box">
                                        <div className="spinner-border text-teal" role="status">
                                            <span className="visually-hidden">Memuat...</span>
                                        </div>
                                        <p className="act-loading-text">Menyinkronkan data aktivitas...</p>
                                    </div>
                                ) : displayedActivities.length > 0 ? (
                                    <div className="act-feed">
                                        {displayedActivities.map((activity) => {
                                            const meta = getActivityMeta(activity);
                                            const isPointsAwarded = Number(activity.points_awarded) > 0;
                                            const formattedDate = moment(activity.activity_date).format('DD MMM YYYY, HH:mm');
                                            const relativeTime = moment(activity.activity_date).fromNow();

                                            // Clean description from duplicate points mention
                                            const cleanDescription = (activity.description || '')
                                                .replace(/\s*\(\+\d+\s*poin\)/gi, '')
                                                .trim();

                                            return (
                                                <div
                                                    key={activity.id}
                                                    className={`act-item act-item-${meta.color} ${!activity.success ? 'act-item-failed' : ''}`}
                                                >
                                                    {/* Type Icon Badge */}
                                                    <div className={`act-item-icon bg-${meta.color}`} title={meta.label}>
                                                        <i className={`fas ${meta.icon}`}></i>
                                                    </div>

                                                    {/* Item Content */}
                                                    <div className="act-item-content">
                                                        {/* Top Row: Category Tag, Type, Points & Timestamp */}
                                                        <div className="act-item-top">
                                                            <div className="act-item-tags">
                                                                <span className={`act-pill-role ${activity.role_at_time === 'instructor' ? 'instructor' : 'student'}`}>
                                                                    <i className={`fas ${activity.role_at_time === 'instructor' ? 'fa-chalkboard-user' : 'fa-user-graduate'}`}></i>
                                                                    {meta.roleCategory}
                                                                </span>

                                                                <span className="act-pill-type">
                                                                    {activity.activity_type_display || meta.label}
                                                                </span>

                                                                {isPointsAwarded && (
                                                                    <span className="act-pill-points">
                                                                        <i className="fas fa-coins"></i>
                                                                        +{activity.points_awarded} Poin
                                                                    </span>
                                                                )}

                                                                {!activity.success && (
                                                                    <span className="act-pill-status failed">
                                                                        <i className="fas fa-circle-exclamation"></i>
                                                                        Gagal
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="act-item-time" title={formattedDate}>
                                                                <i className="far fa-clock"></i>
                                                                <span>{relativeTime}</span>
                                                            </div>
                                                        </div>

                                                        {/* Activity Title */}
                                                        <h4 className="act-item-title">
                                                            {activity.title}
                                                        </h4>

                                                        {/* Activity Description (if present and distinct from title) */}
                                                        {cleanDescription && cleanDescription !== activity.title && (
                                                            <p className="act-item-desc">
                                                                {cleanDescription}
                                                            </p>
                                                        )}

                                                        {/* Bottom Meta Row (Course, User, Duration) */}
                                                        <div className="act-item-footer">
                                                            {activity.course_title && (
                                                                <span className="act-meta-pill course" title={activity.course_title}>
                                                                    <i className="fas fa-book-open"></i>
                                                                    <span>{activity.course_title}</span>
                                                                </span>
                                                            )}

                                                            {activity.user_name && activity.role_at_time !== 'instructor' && (
                                                                <span className="act-meta-pill user" title={activity.user_name}>
                                                                    <i className="fas fa-user"></i>
                                                                    <span>{activity.user_name}</span>
                                                                </span>
                                                            )}

                                                            {activity.duration_seconds && (
                                                                <span className="act-meta-pill duration">
                                                                    <i className="fas fa-stopwatch"></i>
                                                                    <span>{Math.round(activity.duration_seconds / 60)} mnt</span>
                                                                </span>
                                                            )}

                                                            <span className="act-meta-pill date-detail">
                                                                <i className="far fa-calendar-alt"></i>
                                                                <span>{formattedDate}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="act-empty-box">
                                        <div className="act-empty-icon">
                                            <i className="fas fa-inbox"></i>
                                        </div>
                                        <h5 className="act-empty-title">Tidak Ada Aktivitas Ditemukan</h5>
                                        <p className="act-empty-desc">
                                            {hasActiveFilters
                                                ? 'Tidak ada data aktivitas yang sesuai dengan kriteria filter atau pencarian Anda.'
                                                : 'Aktivitas pengajaran materi dan interaksi siswa akan otomatis tercatat di sini.'}
                                        </p>
                                        {hasActiveFilters && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-teal mt-2"
                                                onClick={clearFilters}
                                            >
                                                <i className="fas fa-rotate-left me-1"></i>
                                                Reset Kriteria Filter
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Integrated Pagination Footer */}
                                {totalPages > 1 && (
                                    <div className="act-pagination-bar">
                                        <div className="act-pagination-info">
                                            Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong>
                                        </div>

                                        <div className="act-pagination-nav">
                                            <button
                                                type="button"
                                                className="act-page-btn"
                                                disabled={page === 1}
                                                onClick={() => setPage(1)}
                                                title="Halaman Pertama"
                                            >
                                                <i className="fas fa-angles-left"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className="act-page-btn"
                                                disabled={page === 1}
                                                onClick={() => setPage(page - 1)}
                                                title="Sebelumnya"
                                            >
                                                <i className="fas fa-chevron-left"></i>
                                            </button>

                                            {/* Numeric Page Buttons */}
                                            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                                let pageNum;
                                                if (totalPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (page <= 3) {
                                                    pageNum = i + 1;
                                                } else if (page >= totalPages - 2) {
                                                    pageNum = totalPages - 4 + i;
                                                } else {
                                                    pageNum = page - 2 + i;
                                                }

                                                if (pageNum < 1 || pageNum > totalPages) return null;

                                                return (
                                                    <button
                                                        key={pageNum}
                                                        type="button"
                                                        className={`act-page-btn ${page === pageNum ? 'active' : ''}`}
                                                        onClick={() => setPage(pageNum)}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}

                                            <button
                                                type="button"
                                                className="act-page-btn"
                                                disabled={page === totalPages}
                                                onClick={() => setPage(page + 1)}
                                                title="Berikutnya"
                                            >
                                                <i className="fas fa-chevron-right"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className="act-page-btn"
                                                disabled={page === totalPages}
                                                onClick={() => setPage(totalPages)}
                                                title="Halaman Terakhir"
                                            >
                                                <i className="fas fa-angles-right"></i>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* =========================================================================
                                4. MODAL RINCIAN POIN & GAMIFIKASI (Enhanced & Compact)
                                ========================================================================= */}
                            {showPointsModal && (
                                <div className="points-modal-overlay" onClick={() => setShowPointsModal(false)}>
                                    <div className="points-modal-card" onClick={(e) => e.stopPropagation()}>
                                        <div className="points-modal-header">
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="act-modal-header-icon">
                                                    <i className="fas fa-award text-warning"></i>
                                                </div>
                                                <div>
                                                    <h5 className="mb-0">Rincian Perolehan Poin Instruktur</h5>
                                                    <small className="opacity-75">Transparansi gamifikasi dan riwayat audit perolehan poin</small>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="points-modal-close"
                                                onClick={() => setShowPointsModal(false)}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        </div>

                                        <div className="points-modal-body">
                                            {/* Summary Cards */}
                                            <div className="row g-2 mb-3">
                                                <div className="col-4">
                                                    <div className="act-modal-stat-card">
                                                        <small className="text-muted d-block mb-1">Sepanjang Masa</small>
                                                        <h4 className="fw-bold text-teal mb-0">{pointsData?.lifetime_points || 0} <span className="fs-6">pt</span></h4>
                                                    </div>
                                                </div>
                                                <div className="col-4">
                                                    <div className="act-modal-stat-card">
                                                        <small className="text-muted d-block mb-1">Tahun Ini</small>
                                                        <h4 className="fw-bold text-blue mb-0">{pointsData?.yearly_points || 0} <span className="fs-6">pt</span></h4>
                                                    </div>
                                                </div>
                                                <div className="col-4">
                                                    <div className="act-modal-stat-card">
                                                        <small className="text-muted d-block mb-1">Peringkat</small>
                                                        <h4 className="fw-bold text-amber mb-0">#{pointsData?.rank_position || '-'}</h4>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Category Breakdown Badges */}
                                            <div className="p-3 bg-light rounded-3 border mb-3">
                                                <small className="fw-bold text-muted d-block mb-2 text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0px' }}>
                                                    Sumber Akumulasi Poin:
                                                </small>
                                                <div className="d-flex flex-wrap gap-2">
                                                    <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1">
                                                        <i className="fas fa-rocket text-success"></i>
                                                        <span>Publikasi Kursus: <strong>{pointsData?.summary?.course_published?.count || 0}</strong> ({pointsData?.summary?.course_published?.points || 0} pt)</span>
                                                    </div>
                                                    <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1">
                                                        <i className="fas fa-heart text-warning"></i>
                                                        <span>Testimoni Platform: <strong>{pointsData?.summary?.platform_testimonial?.count || 0}</strong> ({pointsData?.summary?.platform_testimonial?.points || 0} pt)</span>
                                                    </div>
                                                    <div className="badge bg-white text-dark border p-2 d-flex align-items-center gap-1">
                                                        <i className="fas fa-user-graduate text-info"></i>
                                                        <span>Siswa Terdaftar: <strong>{pointsData?.summary?.student_enrollment?.count || 0}</strong> ({pointsData?.summary?.student_enrollment?.points || 0} pt)</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Point History */}
                                            <h6 className="fw-bold mb-2 small text-dark d-flex align-items-center gap-1">
                                                <i className="fas fa-history text-teal"></i>
                                                Riwayat Audit Perolehan Poin
                                            </h6>
                                            {pointsData?.history && pointsData.history.length > 0 ? (
                                                <div className="points-history-list mb-3">
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
                                                <p className="text-muted small mb-3">Belum ada catatan audit perolehan poin.</p>
                                            )}

                                            {/* Point Earning Rules */}
                                            <h6 className="fw-bold mb-2 small text-dark d-flex align-items-center gap-1">
                                                <i className="fas fa-book-open text-primary"></i>
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

                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default React.memo(InstructorNotifications);
