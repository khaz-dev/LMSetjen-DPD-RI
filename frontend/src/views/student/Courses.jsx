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
import "./Courses.css";

function Courses() {
    const [courses, setCourses] = useState([]);
    const [fetching, setFetching] = useState(true);

    const fetchData = () => {
        setFetching(true);
        useAxios.get(`student/course-list/${UserData()?.user_id}/`)
            .then((res) => {
                setCourses(res.data);
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

    if (fetching) {
        return (
            <>
                <BaseHeader />
                <section style={{ minHeight: 'calc(100vh - 120px)' }}>
                    <div className="container">
                        <Header />
                        <div className="row mt-0 mt-md-4">
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

            <section className="modern-course-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Page Header */}
                            <div className="page-header-card">
                                <div className="page-header-content">
                                    <div className="row align-items-center">
                                        <div className="col-lg-8">
                                            <h1 className="mb-2 fw-bold d-flex align-items-center">
                                                <i className="fas fa-graduation-cap me-3" style={{ fontSize: '2rem' }}></i>
                                                My Learning Journey
                                            </h1>
                                            <p className="mb-0 opacity-90 lead">
                                                Continue your learning adventure. Track your progress and discover new knowledge.
                                            </p>
                                        </div>
                                        <div className="col-lg-4">
                                            <div className="stats-row mt-0">
                                                <div className="row h-100">
                                                    <div className="col-6">
                                                        <div className="d-flex flex-column justify-content-between h-100 text-center">
                                                            <div className="course-stat-number justify-content-end">{courses?.filter(c => c.completed_lesson?.length > 0).length || 0}</div>
                                                            <div className="stat-label">In Progress</div>
                                                        </div>
                                                    </div>
                                                    <div className="col-6">
                                                        <div className="d-flex flex-column justify-content-between h-100 text-center">
                                                            <div className="course-stat-number justify-content-end">{courses?.length || 0}</div>
                                                            <div className="stat-label">Total Courses</div>
                                                        </div>
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
                                            Find Your Courses
                                        </h4>
                                                <p className="text-muted mb-0">Search through your enrolled courses</p>
                                            </div>
                                            <div className="col-lg-6 mt-3 mt-lg-0">
                                                <div className="position-relative">
                                                    <input 
                                                        type="search" 
                                                        className="form-control search-input" 
                                                        placeholder="Search by course title..." 
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
                                                                    src={c.course.image}
                                                                    alt="course"
                                                                    className="course-image w-100"
                                                                    onError={(e) => {
                                                                        e.target.style.display = 'none';
                                                                        e.target.nextSibling.nextSibling.style.display = 'flex';
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
                                                                display: c?.course?.image ? 'none' : 'flex', 
                                                                alignItems: 'center', 
                                                                justifyContent: 'center', 
                                                                height: '100px', 
                                                                backgroundColor: '#f0f0f0', 
                                                                borderRadius: '8px' 
                                                            }}
                                                        >
                                                            <i className="fas fa-graduation-cap" style={{ fontSize: '32px', color: '#ccc' }}></i>
                                                        </div>
                                                    </Link>
                                                </div>
                                            </div>                                                            
                                            {/* Course Info */}
                                                            <div className="col-lg-5 col-md-5 col-12 mb-2 mb-lg-0">
                                                                <div className="d-flex gap-2 mb-1">
                                                                    <span className="badge badge-modern">
                                                                        <i className="fas fa-folder-open"></i>
                                                                        {c.course.category?.title || 'General'}
                                                                    </span>
                                                                    <span className="badge badge-level">
                                                                        <i className="fas fa-signal"></i>
                                                                        {c.course.level}
                                                                    </span>
                                                                </div>
                                                                <h5 className="fw-bold mb-2">
                                                                    <Link 
                                                                        to={`/student/courses/${c.enrollment_id}/`} 
                                                                        className="text-decoration-none text-dark"
                                                                    >
                                                                        {c.course.title}
                                                                    </Link>
                                                                </h5>
                                                                <div className="d-flex flex-wrap gap-2 text-muted small">
                                                                    <span>
                                                                        <i className="fas fa-calendar me-1 text-primary"></i>
                                                                        Enrolled: {moment(c.date).format("D MMM, YYYY")}
                                                                    </span>
                                                                    <span>
                                                                        <i className="fas fa-play-circle me-1 text-success"></i>
                                                                        {(c.lectures?.length || 0) + (c.quiz_results?.length || 0)} Total Items
                                                                    </span>
                                                                    <span>
                                                                        <i className="fas fa-check-circle me-1 text-info"></i>
                                                                        {(c.completed_lesson?.length || 0) + (c.quiz_results?.filter(q => q.passed)?.length || 0)} Completed
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Progress & Action */}
                                                            <div className="col-lg-4 col-md-4 col-12">
                                                                <div className="text-md-end">
                                                                    {/* Progress Bar */}
                                                                    <div className="mb-2">
                                                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                                                            <small className="text-muted">Progress</small>
                                                                            <small className="fw-bold text-primary">
                                                                                {calculateProgress(c)}%
                                                                            </small>
                                                                        </div>
                                                                        <div className="progress" style={{ height: '6px', borderRadius: '10px' }}>
                                                                            <div 
                                                                                className="progress-bar"
                                                                                role="progressbar"
                                                                                style={{ 
                                                                                    width: `${calculateProgress(c)}%`,
                                                                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                                                    borderRadius: '10px'
                                                                                }}
                                                                            ></div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Action Button */}
                                                                    {calculateProgress(c) === 0 ? (
                                                                        <Link 
                                                                            to={`/student/courses/${c.enrollment_id}/`} 
                                                                            className="course-btn btn-start"
                                                                        >
                                                                            <i className="fas fa-play"></i>
                                                                            Start Learning
                                                                        </Link>
                                                                    ) : calculateProgress(c) === 100 ? (
                                                                        <Link 
                                                                            to={`/student/courses/${c.enrollment_id}/`} 
                                                                            className="course-btn btn-completed"
                                                                        >
                                                                            <i className="fas fa-trophy"></i>
                                                                            Course Completed
                                                                        </Link>
                                                                    ) : (
                                                                        <Link 
                                                                            to={`/student/courses/${c.enrollment_id}/`} 
                                                                            className="course-btn btn-continue"
                                                                        >
                                                                            <i className="fas fa-arrow-right"></i>
                                                                            Continue Learning
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
                                            <h4 className="text-muted mb-3">No Courses Found</h4>
                                            <p className="text-muted mb-4">
                                                You haven't enrolled in any courses yet. Start your learning journey today!
                                            </p>
                                            <Link to="/search" className="btn btn-modern-primary">
                                                <i className="fas fa-search me-2" style={{ verticalAlign: 'middle', fontSize: '1rem', lineHeight: 1 }}></i>
                                                Browse Courses
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