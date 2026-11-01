import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import dayjs, { moment } from "../../utils/dayjs";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { calculateTotalDuration, parseDurationToSeconds, formatDurationWithJP } from "../../utils/durationUtils";
import { getImageUrl } from "../../utils/courseUtils";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
import { usePageCache } from "../../utils/usePageCache";
import ActivityDisplay from "../../components/StudentDashboard/ActivityDisplay";
import "./Dashboard.css";

/**
 * ✨ Redesigned Student Dashboard (Dasbor Siswa)
 * LMSetjen DPD RI - Ultra-Compact, High-Density, Modern, Eye-Catching UI
 * Eliminates excess blank & white space while maximizing visual appeal and utility.
 */
function Dashboard() {
    const [courses, setCourses] = useState([]);
    const [stats, setStats] = useState({});
    const [progressData, setProgressData] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'in-progress' | 'completed'

    const isCollapsed = useSidebarCollapse();
    const userData = UserData();

    // Fetch dashboard stats & enrolled courses
    const fetchData = useCallback(async () => {
        const userId = UserData()?.user_id;
        if (!userId) return { stats: {}, courses: [], progressData: [] };

        const promises = await Promise.all([
            useAxios.get(`student/summary/${userId}/`).then((res) => res.data[0] || {}),
            useAxios.get(`student/course-list/${userId}/`).then((res) => {
                return Array.isArray(res.data) ? res.data : (res.data?.results || []);
            })
        ]);

        const statsData = promises[0] || {};
        const courseData = promises[1] || [];

        // Synchronously compute progress before state updates to avoid race conditions
        const progressStats = courseData.map((course) => {
            const totalLessons = course.lectures?.length || 0;
            const completedLessons = course.completed_lesson?.length || 0;

            const quizResults = course.quiz_results || [];
            const totalQuizzes = quizResults.length || 0;
            const passedQuizzes = quizResults.filter((q) => q.passed).length || 0;

            const totalItems = totalLessons + totalQuizzes;
            const completedItems = completedLessons + passedQuizzes;

            let progressPercentage = 0;
            if (totalItems > 0) {
                progressPercentage = Math.round((completedItems / totalItems) * 100);
            }

            const totalDuration = calculateTotalDuration(course.lectures || []);

            return {
                ...course,
                progressPercentage,
                totalLessons,
                completedLessons,
                totalQuizzes,
                completedQuizzes: passedQuizzes,
                quizProgress: totalQuizzes > 0 ? Math.round((passedQuizzes / totalQuizzes) * 100) : 0,
                lessonProgress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
                courseDurationFormatted: totalDuration.formatted,
                courseDurationWithJP: totalDuration.withJP
            };
        });

        return {
            stats: statsData,
            courses: courseData,
            progressData: progressStats
        };
    }, []);

    // Page cache hook for instant navigation without loading stutter
    const { data: cachedData, loading: fetching } = usePageCache(
        `student-dashboard-${userData?.user_id || "guest"}`,
        fetchData,
        {
            showLoadingOnStale: false
        }
    );

    // Sync cached data to local states
    useEffect(() => {
        if (cachedData) {
            setStats(cachedData.stats || {});
            setCourses(cachedData.courses || []);
            setProgressData(cachedData.progressData || []);
        }
    }, [cachedData]);

    // Active learning courses in progress
    const activeCoursesCount = useMemo(() => {
        return progressData.filter((c) => c.progressPercentage > 0 && c.progressPercentage < 100).length;
    }, [progressData]);

    // Completed courses count
    const completedCoursesCount = useMemo(() => {
        return progressData.filter((c) => c.progressPercentage === 100).length;
    }, [progressData]);

    // Average progress percentage across all courses
    const averageProgress = useMemo(() => {
        if (progressData.length === 0) return 0;
        const total = progressData.reduce((sum, c) => sum + (c.progressPercentage || 0), 0);
        return Math.round(total / progressData.length);
    }, [progressData]);

    // Total content duration with JP
    const totalLearningTime = useMemo(() => {
        if (courses.length === 0) return "0h 0m (0 JP)";
        const allLectures = courses.flatMap((c) => c.lectures || []);
        return calculateTotalDuration(allLectures).withJP;
    }, [courses]);

    // Completed content duration with JP
    const completedLearningTime = useMemo(() => {
        if (courses.length === 0) return "0h 0m (0 JP)";
        let totalSeconds = 0;

        courses.forEach((c) => {
            const completedLessonIds = c.completed_lesson || [];
            const lectures = c.lectures || [];

            const completedVariantItemIds = new Set(
                completedLessonIds.map((cl) => cl.variant_item?.id || cl.variant_item?.variant_item_id || cl.id)
            );

            lectures.forEach((lecture) => {
                if (completedVariantItemIds.has(lecture.id)) {
                    totalSeconds += parseDurationToSeconds(lecture.content_duration);
                }
            });
        });

        return formatDurationWithJP(totalSeconds);
    }, [courses]);

    // First active course in progress to offer direct resume learning action
    const activeCourse = useMemo(() => {
        const inProgress = progressData.find((c) => c.progressPercentage > 0 && c.progressPercentage < 100);
        if (inProgress) return inProgress;
        return progressData.find((c) => c.progressPercentage === 0) || null;
    }, [progressData]);

    // Filter courses for live search and status tabs
    const filteredCourses = useMemo(() => {
        let list = progressData;

        if (statusFilter === "in-progress") {
            list = list.filter((c) => c.progressPercentage > 0 && c.progressPercentage < 100);
        } else if (statusFilter === "completed") {
            list = list.filter((c) => c.progressPercentage === 100);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter((c) => {
                const title = (c.course?.title || "").toLowerCase();
                const category = (c.course?.category?.title || "").toLowerCase();
                return title.includes(q) || category.includes(q);
            });
        }

        return list;
    }, [progressData, statusFilter, searchQuery]);

    // User display name
    const userDisplayName = useMemo(() => {
        if (userData?.full_name && userData.full_name !== "Peserta Didik") {
            return userData.full_name;
        }
        if (userData?.username) {
            return userData.username;
        }
        return "Peserta";
    }, [userData]);

    // Initial Loading State
    if (fetching && !cachedData) {
        return (
            <>
                <BaseHeader />
                <section className="dashboard-page modern-dashboard-page">
                    <div className="container">
                        <Header />
                        <div className="row mt-0">
                            <Sidebar />
                            <div className="col-lg-9 col-md-8 col-12 d-flex align-items-center justify-content-center" style={{ minHeight: "50vh" }}>
                                <div className="text-center">
                                    <div className="spinner-border text-teal" role="status" style={{ width: "2.5rem", height: "2.5rem", color: "#0f766e" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted small fw-semibold">Memuat Dasbor Siswa LMSetjen DPD RI...</p>
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

            <section className="dashboard-page modern-dashboard-page">
                <div className="container">
                    <Header />

                    <div className="row mt-0">
                        <Sidebar />

                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            
                            {/* =========================================================================
                                1. ULTRA-COMPACT EXECUTIVE HERO SECTION (DPD RI Strip)
                                ========================================================================= */}
                            <div className="dash-hero-card">
                                <div className="dash-hero-accent-shape"></div>
                                <div className="dash-hero-inner">
                                    <div className="dash-hero-left">
                                        <div className="dash-hero-badge">
                                            <i className="fas fa-landmark text-amber"></i>
                                            <span>Setjen DPD RI • E-Learning Platform</span>
                                        </div>
                                        <div className="dash-hero-title-row">
                                            <div className="dash-hero-icon-box">
                                                <i className="fas fa-chart-pie"></i>
                                            </div>
                                            <div>
                                                <h1 className="dash-hero-title">
                                                    Selamat Datang Kembali, {userDisplayName}! 👋
                                                </h1>
                                                <p className="dash-hero-desc">
                                                    Pantau capaian kompetensi ASN, jam pelajaran (JP), dan tuntaskan modul pelatihan Anda.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Quick Resume Learning Pill */}
                                        {activeCourse && (
                                            <div className="dash-hero-resume">
                                                <span className="dash-resume-label">
                                                    <i className="fas fa-bolt text-warning me-1"></i> Lanjutkan Terakhir:
                                                </span>
                                                <Link
                                                    to={`/student/courses/${activeCourse.enrollment_id}/`}
                                                    className="dash-resume-btn"
                                                    title={activeCourse.course?.title}
                                                >
                                                    <span className="dash-resume-title">{activeCourse.course?.title}</span>
                                                    <span className="dash-resume-pct">{activeCourse.progressPercentage}%</span>
                                                    <i className="fas fa-arrow-right ms-1"></i>
                                                </Link>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Side: Compact Radial Dial */}
                                    <div className="dash-hero-right">
                                        <div className="dash-progress-widget">
                                            <div
                                                className="dash-progress-ring"
                                                style={{ "--progress": averageProgress || 0 }}
                                            >
                                                <div className="dash-progress-inner">
                                                    <span className="dash-progress-num">{averageProgress || 0}%</span>
                                                    <span className="dash-progress-sub">Tuntas</span>
                                                </div>
                                            </div>
                                            <div className="dash-progress-meta">
                                                <span className="dash-progress-meta-title">Rata-rata Capaian</span>
                                                <span className="dash-progress-meta-desc">
                                                    {completedCoursesCount} dari {stats.total_courses || courses.length || 0} Kursus Selesai
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* =========================================================================
                                2. HIGH-DENSITY KPI STAT CARDS (Single Row)
                                ========================================================================= */}
                            <div className="row g-2 mb-2 dash-stats-row">
                                <div className="col-xl-3 col-sm-6">
                                    <div className="dash-kpi-card kpi-teal">
                                        <div className="kpi-icon-wrap">
                                            <i className="fas fa-graduation-cap"></i>
                                        </div>
                                        <div className="kpi-content">
                                            <span className="kpi-label">Total Kursus</span>
                                            <div className="kpi-val-row">
                                                <h3 className="kpi-value">{stats.total_courses || courses.length || 0}</h3>
                                                <span className="kpi-pill">Terdaftar</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-xl-3 col-sm-6">
                                    <div className="dash-kpi-card kpi-emerald">
                                        <div className="kpi-icon-wrap">
                                            <i className="fas fa-play-circle"></i>
                                        </div>
                                        <div className="kpi-content">
                                            <span className="kpi-label">Kursus Aktif</span>
                                            <div className="kpi-val-row">
                                                <h3 className="kpi-value">{activeCoursesCount}</h3>
                                                <span className="kpi-pill">Berjalan</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-xl-3 col-sm-6">
                                    <div className="dash-kpi-card kpi-amber">
                                        <div className="kpi-icon-wrap">
                                            <i className="fas fa-check-double"></i>
                                        </div>
                                        <div className="kpi-content">
                                            <span className="kpi-label">Materi Selesai</span>
                                            <div className="kpi-val-row">
                                                <h3 className="kpi-value">{stats.completed_lessons || 0}</h3>
                                                <span className="kpi-pill">Pelajaran</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-xl-3 col-sm-6">
                                    <div className="dash-kpi-card kpi-indigo">
                                        <div className="kpi-icon-wrap">
                                            <i className="fas fa-award"></i>
                                        </div>
                                        <div className="kpi-content">
                                            <span className="kpi-label">Kursus Selesai</span>
                                            <div className="kpi-val-row">
                                                <h3 className="kpi-value">{completedCoursesCount}</h3>
                                                <span className="kpi-pill">Sertifikat</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* =========================================================================
                                3. STREAMLINED LEARNING TIME & JP STRIP (Replaces Bulky Legacy Row)
                                ========================================================================= */}
                            <div className="dash-progress-strip mb-3">
                                <div className="strip-item">
                                    <div className="strip-icon text-teal">
                                        <i className="fas fa-hourglass-start"></i>
                                    </div>
                                    <div className="strip-info">
                                        <span className="strip-label">Total Beban Waktu</span>
                                        <strong className="strip-val">{totalLearningTime}</strong>
                                    </div>
                                </div>

                                <div className="strip-divider"></div>

                                <div className="strip-item">
                                    <div className="strip-icon text-emerald">
                                        <i className="fas fa-check-circle"></i>
                                    </div>
                                    <div className="strip-info">
                                        <span className="strip-label">Waktu Diselesaikan</span>
                                        <strong className="strip-val">{completedLearningTime}</strong>
                                    </div>
                                </div>

                                <div className="strip-divider"></div>

                                <div className="strip-item strip-item-progress">
                                    <div className="strip-progress-header">
                                        <span className="strip-label">Akumulasi Capaian Belajar</span>
                                        <span className="strip-pct">{averageProgress}%</span>
                                    </div>
                                    <div className="dash-mini-progress">
                                        <div
                                            className="dash-mini-progress-bar"
                                            style={{ width: `${averageProgress}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="strip-actions">
                                    <Link to="/student/sertifikat/" className="strip-action-btn">
                                        <i className="fas fa-certificate me-1"></i> Sertifikat
                                    </Link>
                                    <Link to="/student/wishlist/" className="strip-action-btn secondary">
                                        <i className="fas fa-heart me-1"></i> Wishlist
                                    </Link>
                                </div>
                            </div>

                            {/* =========================================================================
                                4. MAIN DASHBOARD CONTENT: KURSUS SAYA & AKTIVITAS TERBARU
                                ========================================================================= */}
                            <div className="row g-3">
                                {/* Left: Kursus Saya (col-lg-8) */}
                                <div className="col-lg-8">
                                    <div className="dash-section-card">
                                        <div className="dash-section-header">
                                            <div className="dash-header-title-wrap">
                                                <div className="dash-header-icon">
                                                    <i className="fas fa-book-reader"></i>
                                                </div>
                                                <h2 className="dash-header-title">Kursus Saya</h2>
                                                <span className="dash-count-badge">{filteredCourses.length}</span>
                                            </div>

                                            <div className="dash-header-controls">
                                                {/* Filter Tabs */}
                                                <div className="dash-filter-tabs">
                                                    <button
                                                        type="button"
                                                        className={`dash-filter-tab ${statusFilter === "all" ? "active" : ""}`}
                                                        onClick={() => setStatusFilter("all")}
                                                    >
                                                        Semua ({progressData.length})
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`dash-filter-tab ${statusFilter === "in-progress" ? "active" : ""}`}
                                                        onClick={() => setStatusFilter("in-progress")}
                                                    >
                                                        Berjalan ({activeCoursesCount})
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`dash-filter-tab ${statusFilter === "completed" ? "active" : ""}`}
                                                        onClick={() => setStatusFilter("completed")}
                                                    >
                                                        Selesai ({completedCoursesCount})
                                                    </button>
                                                </div>

                                                {/* Compact Search Box */}
                                                <div className="dash-search-box">
                                                    <i className="fas fa-search dash-search-icon"></i>
                                                    <input
                                                        type="text"
                                                        className="dash-search-input"
                                                        placeholder="Cari kursus..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                    />
                                                    {searchQuery && (
                                                        <button
                                                            type="button"
                                                            className="dash-search-clear"
                                                            onClick={() => setSearchQuery("")}
                                                            title="Hapus pencarian"
                                                        >
                                                            <i className="fas fa-times"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="dash-section-body">
                                            {filteredCourses.length > 0 ? (
                                                <div className="row g-2">
                                                    {filteredCourses.slice(0, 6).map((course, index) => {
                                                        const isFinished = course.progressPercentage === 100;
                                                        const isNew = course.progressPercentage === 0;

                                                        return (
                                                            <div key={course.enrollment_id || index} className="col-md-6">
                                                                <div className="dash-course-card">
                                                                    {/* Upper Main: Thumb + Details */}
                                                                    <div className="dash-card-main">
                                                                        {/* Compact Thumbnail */}
                                                                        <div className="dash-card-thumb-wrap">
                                                                            {course?.course?.image ? (
                                                                                <img
                                                                                    src={getImageUrl(course.course.image)}
                                                                                    alt={course.course.title || "Course"}
                                                                                    className="dash-card-thumb"
                                                                                    loading="lazy"
                                                                                />
                                                                            ) : (
                                                                                <div className="dash-card-thumb-placeholder">
                                                                                    <i className="fas fa-graduation-cap"></i>
                                                                                </div>
                                                                            )}

                                                                            <Link
                                                                                to={`/student/courses/${course.enrollment_id}/`}
                                                                                className="dash-card-thumb-overlay"
                                                                                title={`Buka ${course.course?.title || "Kursus"}`}
                                                                            >
                                                                                <div className="dash-card-play-icon">
                                                                                    <i className="fas fa-play"></i>
                                                                                </div>
                                                                            </Link>

                                                                            {/* Duration Badge */}
                                                                            <span className="dash-card-duration-badge">
                                                                                {course.courseDurationWithJP || "0 JP"}
                                                                            </span>
                                                                        </div>

                                                                        {/* Course Details */}
                                                                        <div className="dash-card-content">
                                                                            <div className="dash-card-top-row">
                                                                                <span className="dash-card-category-badge">
                                                                                    {course.course?.category?.title || "Umum"}
                                                                                </span>
                                                                                <span className={`dash-card-status-badge ${isFinished ? "completed" : isNew ? "new" : "active"}`}>
                                                                                    {isFinished ? "Selesai" : isNew ? "Baru" : `${course.progressPercentage}%`}
                                                                                </span>
                                                                            </div>

                                                                            <Link
                                                                                to={`/student/courses/${course.enrollment_id}/`}
                                                                                className="dash-card-title"
                                                                                title={course.course?.title}
                                                                            >
                                                                                {course.course?.title}
                                                                            </Link>

                                                                            <div className="dash-card-meta">
                                                                                <span className="dash-card-meta-item">
                                                                                    <i className="fas fa-book-open text-teal me-1"></i>
                                                                                    {course.totalLessons} Pelajaran
                                                                                </span>
                                                                                <span className="dash-card-meta-divider">•</span>
                                                                                <span className="dash-card-meta-item">
                                                                                    <i className="fas fa-check-circle text-success me-1"></i>
                                                                                    {course.completedLessons} Tuntas
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Bottom Footer: Progress Bar + Compact Action Button */}
                                                                    <div className="dash-card-footer">
                                                                        <div className="dash-card-progress-bar-wrap" title={`Progres: ${course.progressPercentage}%`}>
                                                                            <div
                                                                                className={`dash-card-progress-bar ${isFinished ? "completed" : ""}`}
                                                                                style={{ width: `${course.progressPercentage}%` }}
                                                                            ></div>
                                                                        </div>

                                                                        <div className="dash-card-action-wrap">
                                                                            {isNew ? (
                                                                                <Link
                                                                                    to={`/student/courses/${course.enrollment_id}/`}
                                                                                    className="dash-card-btn btn-start"
                                                                                >
                                                                                    <i className="fas fa-play"></i> Mulai
                                                                                </Link>
                                                                            ) : isFinished ? (
                                                                                <Link
                                                                                    to={`/student/courses/${course.enrollment_id}/`}
                                                                                    className="dash-card-btn btn-done"
                                                                                >
                                                                                    <i className="fas fa-trophy"></i> Selesai
                                                                                </Link>
                                                                            ) : (
                                                                                <Link
                                                                                    to={`/student/courses/${course.enrollment_id}/`}
                                                                                    className="dash-card-btn btn-continue"
                                                                                >
                                                                                    <i className="fas fa-arrow-right"></i> Lanjut
                                                                                </Link>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="dash-empty-state">
                                                    <div className="dash-empty-icon">
                                                        <i className="fas fa-search"></i>
                                                    </div>
                                                    <h3 className="dash-empty-title">
                                                        {searchQuery || statusFilter !== "all"
                                                            ? "Tidak ditemukan kursus yang cocok"
                                                            : "Belum Ada Kursus Terdaftar"}
                                                    </h3>
                                                    <p className="dash-empty-desc">
                                                        {searchQuery || statusFilter !== "all"
                                                            ? "Coba ubah kata kunci pencarian atau ganti filter status di atas."
                                                            : "Mulai perjalanan peningkatan kompetensi ASN Anda dengan mendaftar di kursus yang tersedia."}
                                                    </p>
                                                    {searchQuery || statusFilter !== "all" ? (
                                                        <button
                                                            type="button"
                                                            className="dash-empty-btn"
                                                            onClick={() => {
                                                                setSearchQuery("");
                                                                setStatusFilter("all");
                                                            }}
                                                        >
                                                            <i className="fas fa-redo me-1"></i> Reset Filter
                                                        </button>
                                                    ) : (
                                                        <Link to="/" className="dash-empty-btn">
                                                            <i className="fas fa-compass me-1"></i> Jelajahi Kursus
                                                        </Link>
                                                    )}
                                                </div>
                                            )}

                                            {/* Footer "Lihat Semua" Link */}
                                            {progressData.length > 6 && (
                                                <div className="text-center pt-2">
                                                    <Link to="/student/courses/" className="dash-header-link">
                                                        <span>Lihat Semua Kursus ({progressData.length})</span>
                                                        <i className="fas fa-arrow-right"></i>
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Pintasan & Aktivitas Terbaru (col-lg-4) */}
                                <div className="col-lg-4 dash-col-side">
                                    {/* 1. Pintasan Akses Siswa - Modern 2x2 Action Grid (Placed on Top) */}
                                    <div className="dash-shortcuts-card">
                                        <div className="dash-shortcuts-head">
                                            <i className="fas fa-th-large"></i>
                                            <span>Pintasan Cepat Pembelajaran</span>
                                        </div>
                                        <div className="dash-shortcuts-grid">
                                            <Link to="/student/courses/" className="dash-shortcut-tile tile-teal">
                                                <div className="dash-shortcut-tile-icon">
                                                    <i className="fas fa-graduation-cap"></i>
                                                </div>
                                                <div className="dash-shortcut-tile-text">
                                                    <span className="dash-shortcut-tile-title">Kursus Saya</span>
                                                    <span className="dash-shortcut-tile-sub">Modul Belajar</span>
                                                </div>
                                            </Link>

                                            <Link to="/student/sertifikat/" className="dash-shortcut-tile tile-amber">
                                                <div className="dash-shortcut-tile-icon">
                                                    <i className="fas fa-award"></i>
                                                </div>
                                                <div className="dash-shortcut-tile-text">
                                                    <span className="dash-shortcut-tile-title">Sertifikat</span>
                                                    <span className="dash-shortcut-tile-sub">Unduh & Cek</span>
                                                </div>
                                            </Link>

                                            <Link to="/student/wishlist/" className="dash-shortcut-tile tile-rose">
                                                <div className="dash-shortcut-tile-icon">
                                                    <i className="fas fa-heart"></i>
                                                </div>
                                                <div className="dash-shortcut-tile-text">
                                                    <span className="dash-shortcut-tile-title">Keinginan</span>
                                                    <span className="dash-shortcut-tile-sub">Disimpan</span>
                                                </div>
                                            </Link>

                                            <Link to="/student/profile/" className="dash-shortcut-tile tile-indigo">
                                                <div className="dash-shortcut-tile-icon">
                                                    <i className="fas fa-user-shield"></i>
                                                </div>
                                                <div className="dash-shortcut-tile-text">
                                                    <span className="dash-shortcut-tile-title">Profil ASN</span>
                                                    <span className="dash-shortcut-tile-sub">Pengaturan</span>
                                                </div>
                                            </Link>
                                        </div>
                                    </div>

                                    {/* 2. Recent Activities Card (Placed Beneath Pintasan Cepat) */}
                                    <div className="dash-section-card">
                                        <div className="dash-section-header">
                                            <div className="dash-header-title-wrap">
                                                <div className="dash-header-icon">
                                                    <i className="fas fa-clock-rotate-left"></i>
                                                </div>
                                                <h2 className="dash-header-title">Aktivitas Terkini</h2>
                                            </div>
                                            <Link to="/student/activities/" className="dash-header-link">
                                                <span>Semua</span>
                                                <i className="fas fa-arrow-right ms-1"></i>
                                            </Link>
                                        </div>
                                        <div className="dash-section-body p-2">
                                            <ActivityDisplay maxDisplay={4} showViewAll={false} variant="compact" showFilters={false} showPagination={false} />
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
