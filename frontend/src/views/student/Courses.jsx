import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import dayjs, { moment } from "../../utils/dayjs";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { SkeletonPage } from "../../components/skeletons";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
import { getImageUrl, getLevelText } from "../../utils/courseUtils";
import { calculateTotalDuration, parseDurationToSeconds } from "../../utils/durationUtils";
import "./Courses.css";

function Courses() {
    const [courses, setCourses] = useState([]);
    const [fetching, setFetching] = useState(true);
    const isCollapsed = useSidebarCollapse();

    const fetchData = () => {
        setFetching(true);
        useAxios.get(`student/course-list/${UserData()?.user_id}/`)
            .then((res) => {
                // Handle both array and paginated response formats
                const courseData = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                setCourses(courseData);
                setFetching(false);
            })
            .catch((error) => {
                console.error("Error fetching courses:", error);
                setFetching(false);
            });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSearch = (event) => {
        const query = event.target.value.toLowerCase();
        if (query === "") {
            fetchData();
        } else {
            const filtered = courses.filter((course) => {
                return course.course.title.toLowerCase().includes(query);
            });
            setCourses(filtered);
        }
    };

    const calculateProgress = (course) => {
        // ===== Count Completed Lessons =====
        const totalLectures = course.lectures?.length || 0;
        const completedLessons = course.completed_lesson?.length || 0;
        
        // ===== Count Quiz Completion =====
        const quizResults = course.quiz_results || [];
        const totalQuizzes = quizResults.length || 0;
        const passedQuizzes = quizResults.filter(q => q.passed).length || 0;
        
        // ===== Combined Progress (all items treated equally) =====
        // This matches Dashboard calculation for consistency
        const totalItems = totalLectures + totalQuizzes;
        const completedItems = completedLessons + passedQuizzes;
        
        let progressPercentage = 0;
        if (totalItems > 0) {
            progressPercentage = Math.round((completedItems / totalItems) * 100);
        }
        
        return progressPercentage;
    };

    // ✨ PHASE 4.77+: Calculate total JP (Jam Pelajaran) from course lectures
    const calculateTotalJP = (lectures) => {
        if (!lectures || !Array.isArray(lectures)) return 0;
        
        let totalSeconds = 0;
        lectures.forEach(lecture => {
            if (lecture.content_duration) {
                totalSeconds += parseDurationToSeconds(lecture.content_duration);
            }
        });
        
        return Math.ceil(totalSeconds / 2700); // 1 JP = 45 minutes = 2700 seconds
    };

    if (fetching) {
        return (
            <>
                <BaseHeader />
                <section className="pt-5 pb-5 modern-course-page" style={{ minHeight: "calc(100vh - 120px)" }}>
                    <div className="container">
                        <Header />
                        <div className="row mt-0 md-4">
                            <Sidebar />
                            <div className="col-lg-9 col-md-8 col-12">
                                <SkeletonPage contentType="cards" items={6} hasHeader={false} />
                            </div>
                        </div>
                    </div>
                </section>
                <Footer />
            </>
        );
    }    return (
        <>
            <BaseHeader />

            <section className="pt-5 pb-5 modern-course-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0 md-4">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Page Header */}
                            <div className="page-header-card">
                                <div className="page-header-content">
                                    <div className="row align-items-center">
                                        <div className="col-lg-7">
                                            <h1 className="mb-2 fw-bold d-flex align-items-center">
                                                <i className="fas fa-graduation-cap me-3" style={{ fontSize: "2rem" }}></i>
                                                Perjalanan Belajar Saya
                            </h1>
                                            <p className="mb-0 opacity-90 lead">
                                                Lanjutkan petualangan belajar Anda. Lacak kemajuan dan temukan pengetahuan baru.
                                            </p>
                                        </div>
                                        <div className="col-lg-5">
                                            <div className="stats-grid mt-0">
                                                <div className="stat-card-header-wrapper">
                                                    <div className="stat-card-header">
                                                        <div className="stat-number justify-content-end">{courses?.filter(c => c.completed_lesson?.length > 0).length || 0}</div>
                                                        <div className="stat-label">Sedang Berlangsung</div>
                                                    </div>
                                                </div>
                                                <div className="stat-card-header-wrapper">
                                                    <div className="stat-card-header">
                                                        <div className="stat-number justify-content-end">{courses?.length || 0}</div>
                                                        <div className="stat-label">Total Kursus</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Search Section */}
                            <div className="search-card">
                                <div className="row align-items-center">
                                    <div className="col-lg-6">
                                        <h4 className="fw-bold mb-2 d-flex align-items-center">
                                            <i className="fas fa-search text-primary me-2"></i>
                                            Cari Kursus Anda
                                        </h4>
                                                <p className="text-muted mb-0">Cari melalui kursus yang terdaftar</p>
                                            </div>
                                            <div className="col-lg-6 mt-3 mt-lg-0">
                                                <div className="position-relative">
                                                    <input 
                                                        type="search" 
                                                        className="form-control search-input" 
                                                        placeholder="Cari berdasarkan judul kursus..." 
                                                        onChange={handleSearch}
                                                    />
                                                    <i className="fas fa-search position-absolute top-50 end-0 translate-middle-y me-3 text-muted"></i>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Course Cards */}
                                    {courses?.length > 0 ? (
                                        <div className="row g-4">
                                            {courses.map((c, index) => (
                                                <div key={c.enrollment_id || c.id || index} className="col-12">
                                                    <div className="course-card">
                                                        <div className="row align-items-center">
                                            {/* Course Image */}
                                            <div className="col-lg-3 col-md-3 col-12 mb-2 mb-md-0">
                                                <div className="course-image-wrapper">
                                                    <Link to={`/student/courses/${c.enrollment_id}/`}>
                                                        {c?.course?.image ? (
                                                            <>
                                                                <img
                                                                    src={getImageUrl(c.course.image)}
                                                                    alt="course"
                                                                    className="course-image w-100"
                                                                    onError={(e) => {
                                                                        e.target.style.display = "none";
                                                                        const placeholder = e.target.parentElement?.querySelector(".course-placeholder");
                                                                        if (placeholder) {
                                                                            placeholder.style.display = "flex";
                                                                        }
                                                                    }}
                                                                />
                                                                <div className="course-image-overlay">
                                                                    <i className="fas fa-play-circle play-icon"></i>
                                                                </div>
                                                            </>
                                                        ) : null}
                                                        <div 
                                                            className="course-placeholder" 
                                                            style={{ 
                                                                display: c?.course?.image ? "none" : "flex", 
                                                                alignItems: "center", 
                                                                justifyContent: "center", 
                                                                height: "100px", 
                                                                backgroundColor: "#f0f0f0", 
                                                                borderRadius: "8px" 
                                                            }}
                                                        >
                                                            <i className="fas fa-graduation-cap" style={{ fontSize: "32px", color: "#ccc" }}></i>
                                                        </div>
                                                    </Link>
                                                </div>
                                            </div>                                                            
                                            {/* Course Info - Title Only - Expanded to fill remaining width */}
                                                <div className="col-lg-9 col-md-9 col-12 mb-2 mb-lg-0">
                                                    <h5 className="fw-bold mb-2">
                                                        <Link 
                                                            to={`/student/courses/${c.enrollment_id}/`} 
                                                            className="text-decoration-none text-dark"
                                                        >
                                                            {c.course.title}
                                                        </Link>
                                                    </h5>

                                                    {/* 🎯 REORGANIZED: Badges & Progress below title, to the right of image */}
                                                    <div className="row align-items-center w-100 mt-2">
                                                        {/* Badges on LEFT */}
                                                        <div className="col-auto">
                                                            <div className="d-flex gap-2">
                                                                <span className="badge badge-modern">
                                                                    <i className="fas fa-folder-open"></i>
                                                                    {c.course.category?.title || "Umum"}
                                                                </span>
                                                                <span className="badge badge-level">
                                                                    {getLevelText(c.course.level)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Progress on RIGHT */}
                                                        <div className="col ms-auto">
                                                            <div className="d-flex justify-content-end">
                                                                <div style={{ minWidth: "180px" }}>
                                                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                                                        <small className="text-muted">Kemajuan</small>
                                                                        <small className="fw-bold text-primary">
                                                                            {calculateProgress(c)}%
                                                                        </small>
                                                                    </div>
                                                                    <div className="progress" style={{ height: "6px", borderRadius: "10px" }}>
                                                                        <div 
                                                                            className="progress-bar"
                                                                            role="progressbar"
                                                                            style={{ 
                                                                                width: `${calculateProgress(c)}%`,
                                                                                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                                                                borderRadius: "10px"
                                                                            }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                        {/* 🎯 REORGANIZED: Metadata & Button in one horizontal line */}
                                        <div className="row align-items-center w-100 mt-2 mt-lg-2">
                                            {/* Metadata on LEFT - Stick to bottom */}
                                            <div className="col-auto align-self-end">
                                                <div className="d-flex flex-wrap gap-2 text-muted small">
                                                    <span>
                                                        <i className="fas fa-calendar me-1 text-primary"></i>
                                                        Terdaftar: {moment(c.date).format("D MMM, YYYY")}
                                                    </span>
                                                    <span>
                                                        <i className="fas fa-clock me-1 text-info"></i>
                                                        {calculateTotalDuration(c.lectures || []).formatted} ({calculateTotalJP(c.lectures || [])} JP)
                                                    </span>
                                                    <span>
                                                        <i className="fas fa-check-circle me-1 text-success"></i>
                                                        {(c.completed_lesson?.length || 0) + (c.quiz_results?.filter(q => q.passed)?.length || 0)} Selesai
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Button on RIGHT */}
                                            <div className="col ms-auto">
                                                <div className="text-md-end">
                                                    {calculateProgress(c) === 0 ? (
                                                        <Link 
                                                            to={`/student/courses/${c.enrollment_id}/`} 
                                                            className="course-btn btn-start"
                                                        >
                                                            <i className="fas fa-play"></i>
                                                            Mulai Belajar
                                                        </Link>
                                                    ) : calculateProgress(c) === 100 ? (
                                                        <Link 
                                                            to={`/student/courses/${c.enrollment_id}/`} 
                                                            className="course-btn btn-completed"
                                                        >
                                                            <i className="fas fa-trophy"></i>
                                                            Kursus Selesai
                                                        </Link>
                                                    ) : (
                                                        <Link 
                                                            to={`/student/courses/${c.enrollment_id}/`} 
                                                            className="course-btn btn-continue"
                                                        >
                                                            <i className="fas fa-arrow-right"></i>
                                                            Lanjutkan Belajar
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-state">
                                            <i className="fas fa-graduation-cap empty-icon"></i>
                                            <h4 className="text-muted mb-3">Tidak Ada Kursus</h4>
                                            <p className="text-muted mb-4">
                                                Anda belum terdaftar di kursus manapun. Mulai perjalanan belajar Anda hari ini!
                                            </p>
                                            <Link to="/search" className="courses-empty-link-btn">
                                                <i className="fas fa-search"></i>
                                                <span>Jelajahi Kursus</span>
                                            </Link>
                                        </div>
                                    )}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    )
}

export default Courses