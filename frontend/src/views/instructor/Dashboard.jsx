import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import dayjs, { moment } from "../../utils/dayjs";
import "./Dashboard.css";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LoadingSpinner from "./Partials/LoadingSpinner";
import MinimalLoader from "./Partials/MinimalLoader";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import InstructorActivityDisplay from "../../components/InstructorDashboard/InstructorActivityDisplay";  // ✨ PHASE 53: Import activity display
import { calculateTotalDuration, getDurationStats } from "../../utils/durationUtils";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../utils/constants";
import { parseDurationToSeconds } from "../../utils/durationUtils"; // ✨ PHASE 4.77+: Calculate JP
import { usePageCache } from "../../utils/usePageCache"; // ✨ PHASE 11.12+: Fix page reload issue

function Dashboard() {
    const isCollapsed = useInstructorSidebarCollapse();

    // ✨ PHASE 11.12+: Wrap fetch logic for usePageCache
    const fetchDashboardData = useCallback(async () => {
        const teacherId = UserData()?.teacher_id;

        const [
            statsResponse,
            coursesResponse,
            studentsResponse,
            reviewsResponse,
            notificationsResponse,
            ordersResponse,
            questionsResponse,
            bestCoursesResponse
        ] = await Promise.all([
            useAxios.get(`teacher/summary/${teacherId}/`),
            useAxios.get(`teacher/course-lists/${teacherId}/`),
            useAxios.get(`teacher/student-lists/${teacherId}/`),
            useAxios.get(`teacher/review-lists/${teacherId}/`),
            useAxios.get(`teacher/noti-list/${teacherId}/`),
            useAxios.get(`teacher/course-order-list/${teacherId}/`),
            useAxios.get(`teacher/question-answer-list/${teacherId}/`),
            useAxios.get(`teacher/best-course-earning/${teacherId}/`)
        ]);

        // Normalize responses to arrays (handle both array and paginated responses)
        const coursesData = Array.isArray(coursesResponse.data) ? coursesResponse.data : (coursesResponse.data?.results || []);
        const reviewsData = Array.isArray(reviewsResponse.data) ? reviewsResponse.data : (reviewsResponse.data?.results || []);
        const notificationsData = Array.isArray(notificationsResponse.data) ? notificationsResponse.data : (notificationsResponse.data?.results || []);
        const ordersData = Array.isArray(ordersResponse.data) ? ordersResponse.data : (ordersResponse.data?.results || []);
        const questionsData = Array.isArray(questionsResponse.data) ? questionsResponse.data : (questionsResponse.data?.results || []);
        const bestCoursesData = Array.isArray(bestCoursesResponse.data) ? bestCoursesResponse.data : (bestCoursesResponse.data?.results || []);
        const studentsData = Array.isArray(studentsResponse.data) ? studentsResponse.data : (studentsResponse.data?.results || []);

        return {
            stats: statsResponse.data[0] || {},
            courses: coursesData,
            students: studentsData,
            reviews: reviewsData,
            notifications: notificationsData,
            orders: ordersData,
            questions: questionsData,
            bestCourses: bestCoursesData
        };
    }, []);

    // ✨ PHASE 11.12+: Use page cache to prevent reloads on navigation
    const { data: dashboardData, loading } = usePageCache(
        'instructor-dashboard',
        fetchDashboardData,
        { showLoadingOnStale: false }
    );

    // Destructure data with fallbacks - use nullish coalescing to handle null values
    const stats = dashboardData?.stats || {};
    const courses = dashboardData?.courses || [];
    const students = dashboardData?.students || [];
    const reviews = dashboardData?.reviews || [];
    const notifications = dashboardData?.notifications || [];
    const orders = dashboardData?.orders || [];
    const questions = dashboardData?.questions || [];
    const bestCourses = dashboardData?.bestCourses || [];

    // Helper function to clean and format image URLs
    const getImageUrl = (imageUrl) => {
        if (!imageUrl) {
            return DEFAULT_IMAGE_URL;
        }

        let cleanUrl = imageUrl;
        if (cleanUrl.includes("%3A") || cleanUrl.includes("http%3A")) {
            cleanUrl = decodeURIComponent(cleanUrl);
        }

        if (cleanUrl.includes("drive.google.com")) {
            const fileIdMatch1 = cleanUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            const fileIdMatch2 = cleanUrl.match(/[?&]id=([a-zA-Z0-9-_]+)/);
            const fileId = (fileIdMatch1 && fileIdMatch1[1]) || (fileIdMatch2 && fileIdMatch2[1]);

            if (fileId) {
                return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
            }
        }

        if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
            return cleanUrl;
        }

        if (cleanUrl.includes("/media/")) {
            const parts = cleanUrl.split("/media/");
            if (parts.length > 1) {
                cleanUrl = "/media/" + parts[parts.length - 1];
            }
        }

        return getMediaUrl(cleanUrl);
    };

    // Calculate total JP (Jam Pelajaran) from course lectures
    // 1 JP = 45 minutes = 2700 seconds
    const calculateTotalJP = (lectures) => {
        if (!lectures || !Array.isArray(lectures)) return 0;

        let totalSeconds = 0;
        lectures.forEach(lecture => {
            if (lecture.content_duration) {
                totalSeconds += parseDurationToSeconds(lecture.content_duration);
            }
        });

        return Math.ceil(totalSeconds / 2700);
    };

    // Course status analytics memo (integrated into Dasbor Header)
    const courseAnalytics = useMemo(() => {
        const publishedCourses = courses.filter(c => c.platform_status === "Published");
        const draftCourses = courses.filter(c => c.platform_status === "Draft");
        const reviewCourses = courses.filter(c => c.platform_status === "Review");
        const totalCourses = stats.total_courses || courses.length || 0;
        const publishedPercentage = totalCourses > 0
            ? Math.round((publishedCourses.length / totalCourses) * 100)
            : 0;

        return {
            publishedCount: publishedCourses.length,
            draftCount: draftCourses.length,
            reviewCount: reviewCourses.length,
            totalCourses,
            publishedPercentage
        };
    }, [courses, stats.total_courses]);

    // Memoize enhanced statistics calculation (Notifikasi Belum Dibaca & Pertanyaan Tertunda removed)
    const enhancedStats = useMemo(() => {
        const reviewsArray = Array.isArray(reviews) ? reviews : [];
        const averageRating = reviewsArray.length > 0
            ? (reviewsArray.reduce((sum, review) => sum + (parseFloat(review.rating) || 0), 0) / reviewsArray.length).toFixed(1)
            : "0.0";

        return {
            averageRating,
            totalReviews: reviewsArray.length
        };
    }, [reviews]);

    // Memoize total content duration calculation
    const totalContentDuration = useMemo(() => {
        if (courses.length === 0) return { formatted: "0m", withJP: "0m (0JP)" };
        const allLectures = courses.flatMap(course => course.lectures || []);
        return calculateTotalDuration(allLectures);
    }, [courses]);

    // Memoize duration statistics
    const courseDurationStats = useMemo(() => {
        const allLectures = courses.flatMap(course => course.lectures || []);
        return getDurationStats(allLectures);
    }, [courses]);

    // Show full-page loading spinner on initial load
    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="modern-dashboard instructor-dashboard" style={{ display: "flex", alignItems: "center" }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Memuat Dasbor...</p>
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

            <section className="modern-dashboard instructor-dashboard">
                <div className="container">
                    <Header />
                    <div className="row">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>

                            {/* 1. Dasbor Header with Integrated Analitik Kursus */}
                            <div className="dashboard-header-modern mb-3">
                                <div className="dash-header-main-bar">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="dash-header-icon-box">
                                            <i className="bi bi-speedometer2"></i>
                                        </div>
                                        <div>
                                            <div className="d-flex align-items-center gap-2">
                                                <h2 className="dash-header-title">Dasbor Instruktur</h2>
                                                <span className="dash-live-badge">
                                                    <span className="live-dot"></span> Live
                                                </span>
                                            </div>
                                            <p className="dash-header-subtitle">
                                                Selamat kembali! Berikut ringkasan status publikasi dan performa materi Anda.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="dash-header-actions">
                                        <Link to="/instructor/create-course/" className="btn-dash-create">
                                            <i className="fas fa-plus"></i>
                                            <span>Buat Kursus</span>
                                        </Link>
                                    </div>
                                </div>

                                {/* Integrated Analitik Kursus Strip */}
                                <div className="dash-analytics-strip">
                                    <div className="row g-2">
                                        <div className="col-md-4 col-12">
                                            <div className="dash-analytic-chip published">
                                                <div className="chip-icon">
                                                    <i className="fas fa-circle-check"></i>
                                                </div>
                                                <div className="chip-info">
                                                    <div className="chip-value">
                                                        {courseAnalytics.publishedCount} <span className="chip-unit">Kursus</span>
                                                    </div>
                                                    <div className="chip-label">Dipublikasikan</div>
                                                </div>
                                                <div className="chip-badge">{courseAnalytics.publishedPercentage}%</div>
                                            </div>
                                        </div>

                                        <div className="col-md-4 col-12">
                                            <div className="dash-analytic-chip review">
                                                <div className="chip-icon">
                                                    <i className="fas fa-hourglass-half"></i>
                                                </div>
                                                <div className="chip-info">
                                                    <div className="chip-value">
                                                        {courseAnalytics.reviewCount} <span className="chip-unit">Review</span>
                                                    </div>
                                                    <div className="chip-label">Sedang Ditinjau</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-md-4 col-12">
                                            <div className="dash-analytic-chip draft">
                                                <div className="chip-icon">
                                                    <i className="fas fa-file-pen"></i>
                                                </div>
                                                <div className="chip-info">
                                                    <div className="chip-value">
                                                        {courseAnalytics.draftCount} <span className="chip-unit">Draf</span>
                                                    </div>
                                                    <div className="chip-label">Dalam Draf</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Primary KPI Grid: Total Kursus, Total Siswa, Rating Rata-rata */}
                            <div className="row g-3 mb-3">
                                <div className="col-md-4 col-sm-6 col-12">
                                    <div className="stat-card-compact theme-teal">
                                        <div className="stat-card-inner">
                                            <div className="stat-icon-wrapper">
                                                <i className="fas fa-book-open"></i>
                                            </div>
                                            <div className="stat-info-wrapper">
                                                <div className="stat-number">{courseAnalytics.totalCourses}</div>
                                                <div className="stat-label">Total Kursus</div>
                                            </div>
                                        </div>
                                        <div className="stat-footer">
                                            <span className="stat-badge neutral">
                                                <i className="fas fa-layer-group me-1"></i> Semua Kurikulum
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-md-4 col-sm-6 col-12">
                                    <div className="stat-card-compact theme-blue">
                                        <div className="stat-card-inner">
                                            <div className="stat-icon-wrapper">
                                                <i className="fas fa-users"></i>
                                            </div>
                                            <div className="stat-info-wrapper">
                                                <div className="stat-number">{stats.total_students || 0}</div>
                                                <div className="stat-label">Total Siswa</div>
                                            </div>
                                        </div>
                                        <div className="stat-footer">
                                            <span className="stat-badge info">
                                                <i className="fas fa-arrow-up me-1"></i> +{students.length > 5 ? students.length - 5 : 0} minggu ini
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-md-4 col-sm-6 col-12">
                                    <div className="stat-card-compact theme-amber">
                                        <div className="stat-card-inner">
                                            <div className="stat-icon-wrapper">
                                                <i className="fas fa-star"></i>
                                            </div>
                                            <div className="stat-info-wrapper">
                                                <div className="stat-number">{enhancedStats.averageRating}</div>
                                                <div className="stat-label">Rating Rata-rata</div>
                                            </div>
                                        </div>
                                        <div className="stat-footer">
                                            <span className="stat-badge warning">
                                                <i className="fas fa-star me-1"></i> {enhancedStats.totalReviews} ulasan siswa
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Ringkasan Pembuatan Konten: Total Konten Dibuat, Total Materi, Durasi Rata-rata Materi, Materi Terlama */}
                            <div className="row mb-3">
                                <div className="col-12">
                                    <div className="content-summary-card">
                                        <div className="content-summary-header d-flex align-items-center justify-content-between">
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="summary-icon-circle">
                                                    <i className="fas fa-film"></i>
                                                </div>
                                                <div>
                                                    <h6 className="summary-title mb-0">Ringkasan Pembuatan Konten</h6>
                                                    <span className="summary-subtitle">Metrik agregat produksi video & materi kursus</span>
                                                </div>
                                            </div>
                                            <span className="summary-tag">
                                                <i className="fas fa-clock me-1"></i> Terkini
                                            </span>
                                        </div>
                                        <div className="content-summary-body">
                                            <div className="row g-2">
                                                <div className="col-md-3 col-sm-6">
                                                    <div className="summary-metric-box">
                                                        <div className="metric-icon text-primary">
                                                            <i className="fas fa-hourglass-half"></i>
                                                        </div>
                                                        <div className="metric-data">
                                                            <div className="metric-val">{totalContentDuration.withJP || "0m 0s (0JP)"}</div>
                                                            <div className="metric-lbl">Total Konten Dibuat</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-3 col-sm-6">
                                                    <div className="summary-metric-box">
                                                        <div className="metric-icon text-info">
                                                            <i className="fas fa-video"></i>
                                                        </div>
                                                        <div className="metric-data">
                                                            <div className="metric-val">{courseDurationStats.count || 0}</div>
                                                            <div className="metric-lbl">Total Materi</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-3 col-sm-6">
                                                    <div className="summary-metric-box">
                                                        <div className="metric-icon text-success">
                                                            <i className="fas fa-chart-line"></i>
                                                        </div>
                                                        <div className="metric-data">
                                                            <div className="metric-val">{courseDurationStats.averageWithJP || "0m 0s (0JP)"}</div>
                                                            <div className="metric-lbl">Durasi Rata-rata Materi</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-3 col-sm-6">
                                                    <div className="summary-metric-box">
                                                        <div className="metric-icon text-danger">
                                                            <i className="fas fa-fire"></i>
                                                        </div>
                                                        <div className="metric-data">
                                                            <div className="metric-val">{courseDurationStats.maxWithJP || "0m 0s (0JP)"}</div>
                                                            <div className="metric-lbl">Materi Terlama</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Side-by-side Balanced Row: Kursus Berkinerja Terbaik & Aktivitas Terbaru */}
                            <div className="row g-3 mb-3">
                                {/* Kursus Berkinerja Terbaik */}
                                <div className="col-lg-6 mb-3">
                                    <div className="performance-panel-modern h-50">
                                        <div className="panel-header d-flex justify-content-between align-items-center">
                                            <h5 className="panel-title d-flex align-items-center gap-2 mb-0">
                                                <i className="fas fa-trophy text-warning"></i>
                                                <span>Kursus Berkinerja Terbaik</span>
                                            </h5>
                                            <Link to="/instructor/courses/" className="view-all-link">
                                                Lihat Semua <i className="fas fa-arrow-right ms-1"></i>
                                            </Link>
                                        </div>
                                        <div className="performance-content">
                                            {bestCourses.length > 0 ? (
                                                <div className="performance-list">
                                                    {bestCourses.slice(0, 4).map((course, index) => (
                                                        <div key={course.id || index} className="performance-list-item">
                                                            <div className={`course-rank-badge rank-${index + 1 <= 3 ? index + 1 : 'other'}`}>
                                                                {index === 0 ? <i className="fas fa-crown"></i> : `#${index + 1}`}
                                                            </div>
                                                            <img
                                                                src={getImageUrl(course.image)}
                                                                alt={course.title}
                                                                className="performance-item-thumb"
                                                                onError={(e) => {
                                                                    e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                                                }}
                                                            />
                                                            <div className="performance-item-details">
                                                                <h6 className="performance-item-title" title={course.title}>
                                                                    {course.title}
                                                                </h6>
                                                                <div className="performance-item-tags">
                                                                    <span className="metric-chip">
                                                                        <i className="fas fa-users text-primary"></i>
                                                                        {course.students?.length || 0} siswa
                                                                    </span>
                                                                    <span className="metric-chip">
                                                                        <i className="fas fa-star text-warning"></i>
                                                                        {course.average_rating || 0}★
                                                                    </span>
                                                                    <span className="metric-chip">
                                                                        <i className="fas fa-clock text-info"></i>
                                                                        {calculateTotalJP(course.lectures)} JP
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {course.id && (
                                                                <Link
                                                                    to={`/instructor/edit-course/${course.course_id || course.id}/`}
                                                                    className="btn-item-action"
                                                                    title="Kelola Kursus"
                                                                >
                                                                    <i className="fas fa-pen-to-square"></i>
                                                                </Link>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="empty-performance py-4">
                                                    <i className="fas fa-chart-line fa-2x mb-2 text-muted"></i>
                                                    <h6 className="fw-semibold">Belum ada data kinerja kursus</h6>
                                                    <p className="text-muted small mb-3">Publikasikan kursus untuk mulai memantau metrik pendaftaran</p>
                                                    <Link to="/instructor/create-course/" className="btn btn-sm btn-primary">
                                                        <i className="fas fa-plus me-1"></i> Buat Kursus
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Aktivitas Terbaru */}
                                <div className="col-lg-6 mb-3">
                                    <div className="activity-panel-modern h-100">
                                        <div className="panel-header d-flex justify-content-between align-items-center">
                                            <h5 className="panel-title d-flex align-items-center gap-2 mb-0">
                                                <i className="fas fa-clock-rotate-left text-teal"></i>
                                                <span>Aktivitas Terbaru</span>
                                            </h5>
                                            <Link to="/instructor/notifications/" className="view-all-link">
                                                Lihat Semua <i className="fas fa-arrow-right ms-1"></i>
                                            </Link>
                                        </div>
                                        <div className="activity-panel-body">
                                            <InstructorActivityDisplay 
                                                maxDisplay={4} 
                                                showViewAll={false} 
                                                variant="compact" 
                                                showFilters={false} 
                                                showPagination={false} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default React.memo(Dashboard);