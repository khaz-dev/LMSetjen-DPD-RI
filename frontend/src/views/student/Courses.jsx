import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import dayjs, { moment } from "../../utils/dayjs";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
import { getImageUrl, getCourseCurriculumSummary } from "../../utils/courseUtils";
import { calculateTotalDuration, parseDurationToSeconds } from "../../utils/durationUtils";
import { usePageCache } from "../../utils/usePageCache";
import "./Courses.css";

/**
 * ✨ Redesigned Student Courses Page (Perjalanan Belajar Saya)
 * LMSetjen DPD RI - Ultra-Compact, High-Density, Modern, Eye-Catching UI
 * Eliminates excessive white/blank space, streamlines hero card & toolbar, instant filters.
 */
function Courses() {
    const [courses, setCourses] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("all"); // 'all' | 'in-progress' | 'completed' | 'not-started'
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedLevel, setSelectedLevel] = useState("all");
    const [sortBy, setSortBy] = useState("newest"); // 'newest' | 'progress-desc' | 'progress-asc' | 'title-asc' | 'jp-desc'
    const [viewMode, setViewMode] = useState(() => {
        return localStorage.getItem("studentCoursesViewMode") || "grid";
    });

    const isCollapsed = useSidebarCollapse();
    const userData = UserData();

    // Fetch enrolled courses
    const fetchData = useCallback(async () => {
        const userId = UserData()?.user_id;
        if (!userId) return [];
        const res = await useAxios.get(`student/course-list/${userId}/`);
        const courseData = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        return courseData;
    }, []);

    // Page cache hook for instant navigation without loading stutter
    const { data: cachedCourses, loading: fetching } = usePageCache(
        `student-courses-${userData?.user_id || "guest"}`,
        fetchData,
        {
            showLoadingOnStale: false
        }
    );

    // Sync cached data to local state
    useEffect(() => {
        if (cachedCourses) {
            setCourses(cachedCourses);
        }
    }, [cachedCourses]);

    // Calculate total JP (Jam Pelajaran) from course lectures (1 JP = 45 min = 2700s)
    const calculateTotalJP = useCallback((lectures) => {
        if (!lectures || !Array.isArray(lectures)) return 0;
        let totalSeconds = 0;
        lectures.forEach((lecture) => {
            if (lecture.content_duration) {
                totalSeconds += parseDurationToSeconds(lecture.content_duration);
            }
        });
        return Math.ceil(totalSeconds / 2700);
    }, []);

    // Calculate combined progress metrics for a course item
    const getCourseMetrics = useCallback((course) => {
        const totalJP = calculateTotalJP(course.lectures || []);
        const durationObj = calculateTotalDuration(course.lectures || []);

        // 1. Prioritize backend-calculated completion_metrics if available
        if (course.completion_metrics) {
            const m = course.completion_metrics;
            const progress = Math.min(100, Math.max(0, m.progress || 0));
            let status = "not-started";
            if (progress === 100) {
                status = "completed";
            } else if (progress > 0) {
                status = "in-progress";
            }
            return {
                progress,
                status,
                totalItems: m.total_items,
                completedItems: Math.min(m.total_items, m.completed_items),
                totalLectures: m.total_lessons,
                completedLessons: m.completed_lessons,
                totalQuizzes: m.total_quizzes,
                passedQuizzes: m.passed_quizzes,
                totalJP,
                durationFormatted: durationObj.formatted || "0m"
            };
        }

        // 2. Comprehensive Client-Side Calculation Fallback
        const { lessonsCount } = getCourseCurriculumSummary(course);
        const totalLectures = lessonsCount || (course.lectures?.length || 0);

        // Deduplicate completed lessons
        const completedLessonSet = new Set(
            (course.completed_lesson || []).map(cl => cl.variant_item?.variant_item_id || cl.variant_item?.id || cl.id)
        );
        const completedLessons = completedLessonSet.size;

        // Quizzes (regular quizzes vs pre/post test)
        const allQuizzes = course.course?.quizzes || course.quizzes || [];
        const regQuizzes = allQuizzes.filter(q => q.quiz_type === 'quiz');
        const prePostQuiz = allQuizzes.find(q => q.quiz_type === 'pre_post_test');

        const quizResults = course.quiz_results || [];
        const passedQuizzes = regQuizzes.length > 0
            ? regQuizzes.filter(rq => {
                const res = quizResults.find(qr => String(qr.quiz_id) === String(rq.id) || String(qr.quiz_id) === String(rq.quiz_id));
                return res?.passed || rq.is_passed;
              }).length
            : quizResults.filter(q => q.passed).length;
        const totalQuizzes = regQuizzes.length > 0 ? regQuizzes.length : (quizResults.length || 0);

        // Pre-test & Post-test
        const preTestTotal = prePostQuiz ? 1 : 0;
        const preTestCompleted = (prePostQuiz && (prePostQuiz.has_pre_test || quizResults.some(q => q.is_pre_test && q.passed))) ? 1 : 0;
        const postTestTotal = prePostQuiz ? 1 : 0;
        const postTestCompleted = (prePostQuiz && (prePostQuiz.has_post_test || quizResults.some(q => q.is_post_test && q.passed))) ? 1 : 0;

        // Gamifikasi
        const games = course.course?.games || course.games || [];
        const totalGames = games.length;
        const completedGames = games.filter(g => Boolean(g.user_is_passed || (g.user_attempts_count || 0) > 0)).length;

        const totalItems = totalLectures + totalQuizzes + preTestTotal + postTestTotal + totalGames;
        let completedItems = completedLessons + passedQuizzes + preTestCompleted + postTestCompleted + completedGames;

        // Guarantee completedItems never exceeds totalItems
        if (totalItems > 0 && completedItems > totalItems) {
            completedItems = totalItems;
        }

        let progress = 0;
        if (totalItems > 0) {
            progress = Math.min(100, Math.round((completedItems / totalItems) * 100));
        }

        let status = "not-started";
        if (progress === 100) {
            status = "completed";
        } else if (progress > 0) {
            status = "in-progress";
        }

        return {
            progress,
            status,
            totalItems,
            completedItems,
            totalLectures,
            completedLessons,
            totalQuizzes,
            passedQuizzes,
            totalJP,
            durationFormatted: durationObj.formatted || "0m"
        };
    }, [calculateTotalJP]);

    // Precompute metrics map for all enrolled courses for instant filtering/sorting
    const coursesWithMetrics = useMemo(() => {
        return (courses || []).map((c) => {
            const metrics = getCourseMetrics(c);
            return {
                ...c,
                _metrics: metrics
            };
        });
    }, [courses, getCourseMetrics]);

    // Summary statistics for compact hero and toolbar
    const summaryStats = useMemo(() => {
        const total = coursesWithMetrics.length;
        let inProgress = 0;
        let completed = 0;
        let notStarted = 0;
        let totalJP = 0;
        let progressSum = 0;

        coursesWithMetrics.forEach((c) => {
            const { status, totalJP: jp, progress } = c._metrics;
            if (status === "completed") completed++;
            else if (status === "in-progress") inProgress++;
            else notStarted++;

            totalJP += jp;
            progressSum += progress;
        });

        const avgProgress = total > 0 ? Math.min(100, Math.round(progressSum / total)) : 0;

        return {
            total,
            inProgress,
            completed,
            notStarted,
            totalJP,
            avgProgress
        };
    }, [coursesWithMetrics]);

    // Extract unique categories for filter dropdown
    const uniqueCategories = useMemo(() => {
        const set = new Set();
        courses.forEach((item) => {
            const title = item.course?.category?.title;
            if (title) set.add(title);
        });
        return Array.from(set);
    }, [courses]);

    // Level badge helper with semantic styling
    const getLevelBadge = (level) => {
        const lvl = (level || "").toLowerCase();
        if (lvl.includes("begin") || lvl.includes("pemula")) {
            return { label: "Pemula", tone: "level-emerald", icon: "fa-seedling" };
        }
        if (lvl.includes("inter") || lvl.includes("menengah")) {
            return { label: "Menengah", tone: "level-teal", icon: "fa-chart-simple" };
        }
        if (lvl.includes("adv") || lvl.includes("lanjut")) {
            return { label: "Lanjutan", tone: "level-indigo", icon: "fa-rocket" };
        }
        if (lvl.includes("exp") || lvl.includes("ahli")) {
            return { label: "Ahli", tone: "level-amber", icon: "fa-crown" };
        }
        return { label: level || "Semua Tingkat", tone: "level-slate", icon: "fa-layer-group" };
    };

    // Filter and sort courses
    const filteredCourses = useMemo(() => {
        let list = [...coursesWithMetrics];

        // Search filter (title, teacher, category)
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter((item) => {
                const title = (item.course?.title || "").toLowerCase();
                const teacher = (item.course?.teacher?.full_name || "").toLowerCase();
                const category = (item.course?.category?.title || "").toLowerCase();
                return title.includes(q) || teacher.includes(q) || category.includes(q);
            });
        }

        // Status tab filter
        if (selectedStatus !== "all") {
            list = list.filter((item) => item._metrics.status === selectedStatus);
        }

        // Category filter
        if (selectedCategory !== "all") {
            list = list.filter((item) => item.course?.category?.title === selectedCategory);
        }

        // Level filter
        if (selectedLevel !== "all") {
            list = list.filter((item) => {
                const lvl = (item.course?.level || "").toLowerCase();
                return lvl.includes(selectedLevel.toLowerCase());
            });
        }

        // Sorting
        list.sort((a, b) => {
            if (sortBy === "progress-desc") {
                return b._metrics.progress - a._metrics.progress;
            }
            if (sortBy === "progress-asc") {
                return a._metrics.progress - b._metrics.progress;
            }
            if (sortBy === "title-asc") {
                return (a.course?.title || "").localeCompare(b.course?.title || "");
            }
            if (sortBy === "jp-desc") {
                return b._metrics.totalJP - a._metrics.totalJP;
            }
            // Default 'newest': sort by enrollment date or id desc
            const dateA = new Date(a.date || 0).getTime();
            const dateB = new Date(b.date || 0).getTime();
            if (dateB !== dateA) return dateB - dateA;
            return (b.enrollment_id || b.id || 0) - (a.enrollment_id || a.id || 0);
        });

        return list;
    }, [coursesWithMetrics, searchQuery, selectedStatus, selectedCategory, selectedLevel, sortBy]);

    // Clear all filters
    const clearAllFilters = () => {
        setSearchQuery("");
        setSelectedStatus("all");
        setSelectedCategory("all");
        setSelectedLevel("all");
        setSortBy("newest");
    };

    const hasActiveFilters =
        searchQuery.trim() !== "" ||
        selectedStatus !== "all" ||
        selectedCategory !== "all" ||
        selectedLevel !== "all" ||
        sortBy !== "newest";

    // Format Indonesian friendly date
    const formatEnrolledDate = (dateString) => {
        if (!dateString) return "-";
        try {
            return moment(dateString).format("D MMM YYYY");
        } catch {
            return dateString;
        }
    };

    return (
        <>
            <BaseHeader />

            <section className="modern-course-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            
                            {/* =========================================================================
                                1. ULTRA-COMPACT HERO SECTION (Executive DPD RI Strip)
                                ========================================================================= */}
                            <div className="courses-hero-card">
                                <div className="courses-hero-accent-shape"></div>
                                <div className="courses-hero-inner">
                                    <div className="courses-hero-left">
                                        <div className="courses-hero-badge">
                                            <i className="fas fa-landmark text-amber"></i>
                                            <span>Setjen DPD RI • E-Learning Platform</span>
                                        </div>
                                        <div className="courses-hero-title-row">
                                            <div className="courses-hero-icon-box">
                                                <i className="fas fa-graduation-cap"></i>
                                            </div>
                                            <div>
                                                <h1 className="courses-hero-title">Perjalanan Belajar Saya</h1>
                                                <p className="courses-hero-desc">
                                                    Pantau progres pembelajaran & tuntaskan modul kompetensi ASN Anda.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Compact High-Value Competency Metrics (No Duplicate Status Counters) */}
                                    <div className="courses-hero-right">
                                        <div className="courses-hero-stat-pill" title="Total Akumulasi Jam Pelajaran (JP) dari semua kursus">
                                            <div className="stat-pill-icon icon-indigo">
                                                <i className="fas fa-clock"></i>
                                            </div>
                                            <div className="stat-pill-info">
                                                <span className="stat-pill-num">{summaryStats.totalJP} JP</span>
                                                <span className="stat-pill-text">Total Jam Pelajaran</span>
                                            </div>
                                        </div>

                                        <div className="courses-hero-stat-pill" title="Rata-rata persentase penyelesaian kursus Anda">
                                            <div className="stat-pill-icon icon-teal">
                                                <i className="fas fa-chart-line"></i>
                                            </div>
                                            <div className="stat-pill-info">
                                                <span className="stat-pill-num">{summaryStats.avgProgress}%</span>
                                                <span className="stat-pill-text">Rata-rata Progres</span>
                                            </div>
                                        </div>

                                        <div className="courses-hero-stat-pill" title="Rasio kursus yang telah diselesaikan">
                                            <div className="stat-pill-icon icon-emerald">
                                                <i className="fas fa-award"></i>
                                            </div>
                                            <div className="stat-pill-info">
                                                <span className="stat-pill-num">{summaryStats.completed}/{summaryStats.total}</span>
                                                <span className="stat-pill-text">Kursus Tuntas</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* =========================================================================
                                2. HIGH-DENSITY 2-LINE TOOLBAR (Line 1: Status Pills, Line 2: Controls)
                                ========================================================================= */}
                            <div className="courses-toolbar">
                                {/* LINE 1: Status Filter Pills (Left) & Meta Count / Actions (Right) */}
                                <div className="courses-toolbar-line1">
                                    <div className="courses-status-pills">
                                        <button
                                            type="button"
                                            className={`courses-pill-btn ${selectedStatus === "all" ? "active" : ""}`}
                                            onClick={() => setSelectedStatus("all")}
                                            title="Tampilkan semua kursus"
                                        >
                                            <span>Semua</span>
                                            <span className="pill-count">{summaryStats.total}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`courses-pill-btn pill-in-progress ${selectedStatus === "in-progress" ? "active" : ""}`}
                                            onClick={() => setSelectedStatus("in-progress")}
                                            title="Filter kursus yang sedang aktif berjalan"
                                        >
                                            <i className="fas fa-play-circle"></i>
                                            <span>Berjalan</span>
                                            <span className="pill-count">{summaryStats.inProgress}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`courses-pill-btn pill-completed ${selectedStatus === "completed" ? "active" : ""}`}
                                            onClick={() => setSelectedStatus("completed")}
                                            title="Filter kursus yang sudah 100% tuntas"
                                        >
                                            <i className="fas fa-check-circle"></i>
                                            <span>Selesai</span>
                                            <span className="pill-count">{summaryStats.completed}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`courses-pill-btn pill-not-started ${selectedStatus === "not-started" ? "active" : ""}`}
                                            onClick={() => setSelectedStatus("not-started")}
                                            title="Filter kursus yang belum dimulai"
                                        >
                                            <i className="fas fa-circle-dot"></i>
                                            <span>Belum Mulai</span>
                                            <span className="pill-count">{summaryStats.notStarted}</span>
                                        </button>
                                    </div>

                                    {/* Line 1 Right: Summary Count & Quick Action */}
                                    <div className="courses-toolbar-line1-right">
                                        <div className="courses-meta-count">
                                            <span className="badge-count-pill">{filteredCourses.length}</span>
                                            <span>
                                                kursus
                                                {courses.length !== filteredCourses.length && (
                                                    <span className="text-muted ms-1">(dari {courses.length})</span>
                                                )}
                                            </span>
                                        </div>

                                        {hasActiveFilters && (
                                            <button
                                                type="button"
                                                className="courses-btn-reset-filter"
                                                onClick={clearAllFilters}
                                                title="Kembalikan semua filter ke awal"
                                            >
                                                <i className="fas fa-rotate-left me-1"></i>
                                                Reset
                                            </button>
                                        )}

                                        <Link to="/search" className="courses-btn-catalog-sm" title="Jelajahi kursus lainnya di katalog">
                                            <i className="fas fa-compass me-1"></i>
                                            <span>Katalog</span>
                                        </Link>
                                    </div>
                                </div>

                                {/* LINE 2: Search Box (Stretches across remaining width) + Filter Selects + View Mode */}
                                <div className="courses-toolbar-line2">
                                    <div className="courses-toolbar-controls">
                                        {/* Dynamic Full-Width Search Input */}
                                        <div className="courses-search-box">
                                            <i className="fas fa-search courses-search-icon"></i>
                                            <input
                                                type="text"
                                                className="form-control courses-search-input"
                                                placeholder="Cari kursus berdasarkan judul, kategori, atau pengajar..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    className="courses-search-clear"
                                                    onClick={() => setSearchQuery("")}
                                                    title="Hapus pencarian"
                                                    aria-label="Hapus pencarian"
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            )}
                                        </div>

                                        {/* Category Select */}
                                        {uniqueCategories.length > 0 && (
                                            <div className="courses-select-box">
                                                <select
                                                    className="form-select courses-select"
                                                    value={selectedCategory}
                                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                                    title="Filter Kategori"
                                                    aria-label="Filter Kategori"
                                                >
                                                    <option value="all">Semua Kategori</option>
                                                    {uniqueCategories.map((cat) => (
                                                        <option key={cat} value={cat}>
                                                            {cat}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Level Select */}
                                        <div className="courses-select-box">
                                            <select
                                                className="form-select courses-select"
                                                value={selectedLevel}
                                                onChange={(e) => setSelectedLevel(e.target.value)}
                                                title="Filter Tingkat Kesulitan"
                                                aria-label="Filter Tingkat"
                                            >
                                                <option value="all">Semua Tingkat</option>
                                                <option value="beginner">Pemula</option>
                                                <option value="intermediate">Menengah</option>
                                                <option value="advanced">Lanjutan</option>
                                                <option value="expert">Ahli</option>
                                            </select>
                                        </div>

                                        {/* Sort Select */}
                                        <div className="courses-select-box">
                                            <select
                                                className="form-select courses-select"
                                                value={sortBy}
                                                onChange={(e) => setSortBy(e.target.value)}
                                                title="Urutkan Kursus"
                                                aria-label="Urutkan Kursus"
                                            >
                                                <option value="newest">Terbaru</option>
                                                <option value="progress-desc">Progres Tertinggi</option>
                                                <option value="progress-asc">Progres Terendah</option>
                                                <option value="title-asc">Judul (A-Z)</option>
                                                <option value="jp-desc">JP Terbanyak</option>
                                            </select>
                                        </div>

                                        {/* View Mode Toggle: Grid vs List */}
                                        <div className="courses-view-toggle" role="group" aria-label="Mode Tampilan">
                                            <button
                                                type="button"
                                                className={`courses-view-btn ${viewMode === "grid" ? "active" : ""}`}
                                                onClick={() => {
                                                    setViewMode("grid");
                                                    localStorage.setItem("studentCoursesViewMode", "grid");
                                                }}
                                                title="Tampilan Grid Galeri"
                                                aria-label="Tampilan Grid Galeri"
                                            >
                                                <i className="fas fa-grip"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className={`courses-view-btn ${viewMode === "list" ? "active" : ""}`}
                                                onClick={() => {
                                                    setViewMode("list");
                                                    localStorage.setItem("studentCoursesViewMode", "list");
                                                }}
                                                title="Tampilan List Rapi"
                                                aria-label="Tampilan List Rapi"
                                            >
                                                <i className="fas fa-list-ul"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* =========================================================================
                                3. CONTENT AREA (Loading, Empty, Grid, List)
                                ========================================================================= */}

                            {/* Loading State Skeletons */}
                            {fetching && (
                                <div className={viewMode === "grid" ? "courses-cards-grid mb-3" : "courses-list-view mb-3"}>
                                    {[1, 2, 3, 4, 5, 6].map((n) => (
                                        <div className="course-compact-card course-skeleton-card" key={n}>
                                            <div className="skeleton-thumb"></div>
                                            <div className="course-card-content p-3">
                                                <div className="skeleton-line sm mb-2"></div>
                                                <div className="skeleton-line lg mb-2"></div>
                                                <div className="skeleton-line md mb-2"></div>
                                                <div className="skeleton-line sm"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Content When Ready */}
                            {!fetching && filteredCourses.length > 0 && (
                                <>
                                    {/* MODE 1: COMPACT GRID VIEW */}
                                    {viewMode === "grid" && (
                                        <div className="courses-cards-grid mb-3">
                                            {filteredCourses.map((c) => {
                                                const metrics = c._metrics;
                                                const enrollmentId = c.enrollment_id || c.id;
                                                const courseTargetUrl = `/student/courses/${enrollmentId}/`;
                                                const levelBadge = getLevelBadge(c.course?.level);

                                                return (
                                                    <div className="course-compact-card" key={enrollmentId}>
                                                        {/* Thumbnail Area */}
                                                        <div className="course-thumb-box">
                                                            <Link to={courseTargetUrl} className="course-thumb-link">
                                                                {c.course?.image ? (
                                                                    <img
                                                                        src={getImageUrl(c.course.image)}
                                                                        alt={c.course?.title || "Kursus"}
                                                                        className="course-thumb-img"
                                                                        loading="lazy"
                                                                        onError={(e) => {
                                                                            e.target.style.display = "none";
                                                                            const placeholder = e.target.parentElement?.querySelector(".course-placeholder-box");
                                                                            if (placeholder) placeholder.style.display = "flex";
                                                                        }}
                                                                    />
                                                                ) : null}

                                                                <div
                                                                    className="course-placeholder-box"
                                                                    style={{ display: c.course?.image ? "none" : "flex" }}
                                                                >
                                                                    <i className="fas fa-graduation-cap"></i>
                                                                </div>

                                                                {/* Hover Play Overlay */}
                                                                <div className="course-thumb-overlay">
                                                                    <div className="thumb-play-icon">
                                                                        <i className={metrics.progress === 100 ? "fas fa-rotate-right" : "fas fa-play"}></i>
                                                                    </div>
                                                                </div>
                                                            </Link>

                                                            {/* Floating Status Pill (Top-Left) */}
                                                            <div className="course-thumb-status-pill">
                                                                {metrics.progress === 100 ? (
                                                                    <span className="status-badge badge-done">
                                                                        <i className="fas fa-check-circle"></i> Selesai
                                                                    </span>
                                                                ) : metrics.progress > 0 ? (
                                                                    <span className="status-badge badge-active">
                                                                        <i className="fas fa-spinner fa-spin-pulse"></i> {metrics.progress}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="status-badge badge-new">
                                                                        <i className="fas fa-circle-dot"></i> Belum Mulai
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Floating Level Pill (Top-Right) */}
                                                            <div className="course-thumb-level-pill">
                                                                <span className={`level-badge-chip ${levelBadge.tone}`}>
                                                                    <i className={`fas ${levelBadge.icon}`}></i>
                                                                    {levelBadge.label}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Content Area */}
                                                        <div className="course-card-content">
                                                            {/* Category & Instructor */}
                                                            <div className="course-card-top-meta">
                                                                <span className="course-category-tag">
                                                                    <i className="fas fa-folder-open"></i>
                                                                    {c.course?.category?.title || "Umum"}
                                                                </span>
                                                                {c.course?.teacher?.full_name && (
                                                                    <span className="course-instructor-text" title={`Pengajar: ${c.course.teacher.full_name}`}>
                                                                        <i className="fas fa-chalkboard-user"></i>
                                                                        {c.course.teacher.full_name}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Course Title */}
                                                            <h3 className="course-card-title">
                                                                <Link to={courseTargetUrl} title={c.course?.title}>
                                                                    {c.course?.title || "Judul Kursus"}
                                                                </Link>
                                                            </h3>

                                                            {/* Progress Section */}
                                                            <div className="course-card-progress-box">
                                                                <div className="course-progress-header">
                                                                    <span className="progress-txt-label">Kemajuan Belajar</span>
                                                                    <span className={`progress-pct-val ${metrics.progress === 100 ? "text-emerald" : "text-teal"}`}>
                                                                        {metrics.progress}%
                                                                    </span>
                                                                </div>
                                                                <div className="course-progress-track">
                                                                    <div
                                                                        className={`course-progress-fill ${metrics.progress === 100 ? "fill-emerald" : "fill-teal"}`}
                                                                        style={{ width: `${metrics.progress}%` }}
                                                                    ></div>
                                                                </div>
                                                                <div className="course-progress-sub">
                                                                    <small>
                                                                        {metrics.completedItems} dari {metrics.totalItems} materi selesai
                                                                    </small>
                                                                </div>
                                                            </div>

                                                            {/* Bottom Metadata Info Chips */}
                                                            <div className="course-card-meta-chips">
                                                                <span className="course-meta-chip" title="Durasi materi & Jam Pelajaran (JP)">
                                                                    <i className="fas fa-clock text-teal"></i>
                                                                    {metrics.durationFormatted} ({metrics.totalJP} JP)
                                                                </span>
                                                                <span className="course-meta-chip" title="Tanggal pendaftaran">
                                                                    <i className="fas fa-calendar-check text-muted"></i>
                                                                    {formatEnrolledDate(c.date)}
                                                                </span>
                                                                {Array.isArray(c.note) && c.note.length > 0 && (
                                                                    <Link
                                                                        to={courseTargetUrl}
                                                                        className="course-meta-chip"
                                                                        title={`${c.note.length} catatan tersimpan di kelas ini. Klik untuk membuka Tab Catatan.`}
                                                                        style={{ color: "#047857", background: "#ecfdf5", border: "1px solid #a7f3d0", fontWeight: 700, textDecoration: "none" }}
                                                                    >
                                                                        <i className="fas fa-sticky-note text-emerald"></i>
                                                                        {c.note.length} Catatan
                                                                    </Link>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Footer Action Area */}
                                                        <div className="course-card-footer">
                                                            {metrics.progress === 0 ? (
                                                                <Link to={courseTargetUrl} className="btn-course-cta btn-start">
                                                                    <i className="fas fa-play"></i>
                                                                    <span>Mulai Belajar</span>
                                                                </Link>
                                                            ) : metrics.progress === 100 ? (
                                                                <div className="d-flex align-items-center gap-2 w-100">
                                                                    <Link to={courseTargetUrl} className="btn-course-cta btn-review">
                                                                        <i className="fas fa-rotate-right"></i>
                                                                        <span>Tinjau Materi</span>
                                                                    </Link>
                                                                    <Link
                                                                        to="/student/sertifikat-kursus/"
                                                                        className="btn-cert-shortcut"
                                                                        title="Lihat Sertifikat Kursus"
                                                                    >
                                                                        <i className="fas fa-award"></i>
                                                                    </Link>
                                                                </div>
                                                            ) : (
                                                                <Link to={courseTargetUrl} className="btn-course-cta btn-continue">
                                                                    <span>Lanjutkan Belajar</span>
                                                                    <i className="fas fa-arrow-right"></i>
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* MODE 2: STREAMLINED COMPACT LIST VIEW */}
                                    {viewMode === "list" && (
                                        <div className="courses-list-view mb-3">
                                            {filteredCourses.map((c) => {
                                                const metrics = c._metrics;
                                                const enrollmentId = c.enrollment_id || c.id;
                                                const courseTargetUrl = `/student/courses/${enrollmentId}/`;
                                                const levelBadge = getLevelBadge(c.course?.level);

                                                return (
                                                    <div className="course-list-row" key={enrollmentId}>
                                                        {/* Left Thumbnail */}
                                                        <div className="course-list-thumb">
                                                            <Link to={courseTargetUrl} className="course-thumb-link">
                                                                {c.course?.image ? (
                                                                    <img
                                                                        src={getImageUrl(c.course.image)}
                                                                        alt={c.course?.title || "Kursus"}
                                                                        className="course-thumb-img"
                                                                        loading="lazy"
                                                                        onError={(e) => {
                                                                            e.target.style.display = "none";
                                                                            const placeholder = e.target.parentElement?.querySelector(".course-placeholder-box");
                                                                            if (placeholder) placeholder.style.display = "flex";
                                                                        }}
                                                                    />
                                                                ) : null}

                                                                <div
                                                                    className="course-placeholder-box"
                                                                    style={{ display: c.course?.image ? "none" : "flex" }}
                                                                >
                                                                    <i className="fas fa-graduation-cap"></i>
                                                                </div>

                                                                <div className="course-thumb-overlay">
                                                                    <div className="thumb-play-icon sm">
                                                                        <i className={metrics.progress === 100 ? "fas fa-rotate-right" : "fas fa-play"}></i>
                                                                    </div>
                                                                </div>
                                                            </Link>
                                                        </div>

                                                        {/* Center Main Info */}
                                                        <div className="course-list-main">
                                                            <div className="course-list-header-badges">
                                                                <span className="course-category-tag">
                                                                    <i className="fas fa-folder-open"></i>
                                                                    {c.course?.category?.title || "Umum"}
                                                                </span>
                                                                <span className={`level-badge-chip ${levelBadge.tone}`}>
                                                                    <i className={`fas ${levelBadge.icon}`}></i>
                                                                    {levelBadge.label}
                                                                </span>
                                                                {metrics.progress === 100 ? (
                                                                    <span className="status-badge badge-done sm">
                                                                        <i className="fas fa-check-circle"></i> Selesai
                                                                    </span>
                                                                ) : metrics.progress > 0 ? (
                                                                    <span className="status-badge badge-active sm">
                                                                        <i className="fas fa-spinner fa-spin-pulse"></i> {metrics.progress}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="status-badge badge-new sm">
                                                                        <i className="fas fa-circle-dot"></i> Belum Mulai
                                                                    </span>
                                                                )}
                                                                <span className="course-list-date text-muted ms-auto">
                                                                    <i className="fas fa-calendar-check me-1"></i>
                                                                    {formatEnrolledDate(c.date)}
                                                                </span>
                                                            </div>

                                                            <h4 className="course-list-title">
                                                                <Link to={courseTargetUrl} title={c.course?.title}>
                                                                    {c.course?.title || "Judul Kursus"}
                                                                </Link>
                                                            </h4>

                                                            <div className="course-list-bottom-row">
                                                                {c.course?.teacher?.full_name && (
                                                                    <span className="course-instructor-text" title={`Pengajar: ${c.course.teacher.full_name}`}>
                                                                        <i className="fas fa-chalkboard-user"></i>
                                                                        {c.course.teacher.full_name}
                                                                    </span>
                                                                )}
                                                                <span className="course-meta-chip">
                                                                    <i className="fas fa-clock text-teal"></i>
                                                                    {metrics.durationFormatted} ({metrics.totalJP} JP)
                                                                </span>
                                                                <span className="course-meta-chip">
                                                                    <i className="fas fa-circle-check text-emerald"></i>
                                                                    {metrics.completedItems}/{metrics.totalItems} Selesai
                                                                </span>
                                                                {Array.isArray(c.note) && c.note.length > 0 && (
                                                                    <Link
                                                                        to={courseTargetUrl}
                                                                        className="course-meta-chip"
                                                                        title={`${c.note.length} catatan tersimpan di kelas ini. Klik untuk membuka Tab Catatan.`}
                                                                        style={{ color: "#047857", background: "#ecfdf5", border: "1px solid #a7f3d0", fontWeight: 700, textDecoration: "none" }}
                                                                    >
                                                                        <i className="fas fa-sticky-note text-emerald"></i>
                                                                        {c.note.length} Catatan
                                                                    </Link>
                                                                )}

                                                                {/* Inline Progress Bar in List Mode */}
                                                                <div className="course-list-inline-progress">
                                                                    <div className="course-progress-track">
                                                                        <div
                                                                            className={`course-progress-fill ${metrics.progress === 100 ? "fill-emerald" : "fill-teal"}`}
                                                                            style={{ width: `${metrics.progress}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className="inline-progress-pct fw-bold">{metrics.progress}%</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right Actions */}
                                                        <div className="course-list-action">
                                                            {metrics.progress === 0 ? (
                                                                <Link to={courseTargetUrl} className="btn-course-cta btn-start compact">
                                                                    <i className="fas fa-play"></i>
                                                                    <span>Mulai Belajar</span>
                                                                </Link>
                                                            ) : metrics.progress === 100 ? (
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <Link to={courseTargetUrl} className="btn-course-cta btn-review compact">
                                                                        <i className="fas fa-rotate-right"></i>
                                                                        <span>Tinjau</span>
                                                                    </Link>
                                                                    <Link
                                                                        to="/student/sertifikat-kursus/"
                                                                        className="btn-cert-shortcut"
                                                                        title="Lihat Sertifikat Kursus"
                                                                    >
                                                                        <i className="fas fa-award"></i>
                                                                    </Link>
                                                                </div>
                                                            ) : (
                                                                <Link to={courseTargetUrl} className="btn-course-cta btn-continue compact">
                                                                    <span>Lanjutkan</span>
                                                                    <i className="fas fa-arrow-right"></i>
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Empty State: Active Filters yielded no results */}
                            {!fetching && courses.length > 0 && filteredCourses.length === 0 && (
                                <div className="courses-empty-card">
                                    <div className="courses-empty-icon-wrap">
                                        <i className="fas fa-filter-circle-xmark"></i>
                                    </div>
                                    <h4 className="courses-empty-title">Tidak Ada Kursus yang Cocok</h4>
                                    <p className="courses-empty-desc">
                                        Tidak ditemukan kursus terdaftar dengan kata kunci atau filter yang Anda pilih saat ini.
                                    </p>
                                    <div className="courses-empty-actions">
                                        <button type="button" className="courses-btn-empty-reset" onClick={clearAllFilters}>
                                            <i className="fas fa-rotate-left me-1"></i>
                                            Reset Semua Filter
                                        </button>
                                        <Link to="/search" className="courses-btn-empty-explore">
                                            <i className="fas fa-compass me-1"></i>
                                            Jelajahi Katalog Kursus
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Empty State: Student has 0 enrolled courses */}
                            {!fetching && courses.length === 0 && (
                                <div className="courses-empty-card">
                                    <div className="courses-empty-icon-wrap hero-empty">
                                        <i className="fas fa-graduation-cap"></i>
                                    </div>
                                    <h3 className="courses-empty-title">Belum Ada Kursus Terdaftar</h3>
                                    <p className="courses-empty-desc">
                                        Anda belum mendaftar di kursus manapun. Mulai tingkatkan keahlian dan kompetensi ASN Anda melalui berbagai pelatihan yang tersedia di LMS Setjen DPD RI!
                                    </p>
                                    <div className="courses-empty-actions">
                                        <Link to="/search" className="courses-btn-empty-explore main">
                                            <i className="fas fa-rocket me-2"></i>
                                            Jelajahi Katalog Kursus
                                        </Link>
                                        <Link to="/student/wishlist/" className="courses-btn-empty-reset">
                                            <i className="fas fa-heart text-danger me-2"></i>
                                            Lihat Daftar Keinginan
                                        </Link>
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

export default React.memo(Courses);
