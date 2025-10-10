import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import moment from "moment";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { calculateTotalDuration, parseDurationToSeconds } from "../../utils/durationUtils";
import "./Dashboard.css";

function Dashboard() {
    const [courses, setCourses] = useState([]);
    const [stats, setStats] = useState([]);
    const [fetching, setFetching] = useState(true);
    const [recentActivity, setRecentActivity] = useState([]);
    const [progressData, setProgressData] = useState([]);

    const fetchData = () => {
        setFetching(true);
        useAxios.get(`student/summary/${UserData()?.user_id}/`).then((res) => {
            setStats(res.data[0]);
        });

        useAxios.get(`student/course-list/${UserData()?.user_id}/`).then((res) => {
            setCourses(res.data);
            setFetching(false);
            
            // Calculate additional statistics
            calculateProgressData(res.data);
            generateRecentActivity(res.data);
        });
    };

    const calculateProgressData = (coursesData) => {
        const progressStats = coursesData.map(course => {
            const totalLessons = course.lectures?.length || 0;
            const completedLessons = course.completed_lesson?.length || 0;
            const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
            
            return {
                ...course,
                progressPercentage,
                totalLessons,
                completedLessons
            };
        });
        setProgressData(progressStats);
    };

    const generateRecentActivity = (coursesData) => {
        const activities = [];
        
        coursesData.slice(0, 5).forEach(course => {
            activities.push({
                id: course.enrollment_id,
                type: 'enrollment',
                title: `Enrolled in ${course.course.title}`,
                date: course.date,
                icon: 'fas fa-user-graduate',
                color: 'success'
            });
            
            if (course.completed_lesson?.length > 0) {
                activities.push({
                    id: `${course.enrollment_id}-progress`,
                    type: 'progress',
                    title: `Completed ${course.completed_lesson.length} lessons in ${course.course.title}`,
                    date: course.date,
                    icon: 'fas fa-check-circle',
                    color: 'primary'
                });
            }
        });
        
        // Sort by date (most recent first)
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentActivity(activities.slice(0, 6));
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSearch = (event) => {
        const query = event.target.value.toLowerCase();
        if (query === "") {
            // Reset to original data when search is cleared
            fetchData();
        } else {
            // Filter both courses and progressData
            const filteredCourses = courses.filter((c) => {
                return c.course.title.toLowerCase().includes(query);
            });
            setCourses(filteredCourses);
            
            // Also filter progressData which is used for display
            const filteredProgressData = progressData.filter((course) => {
                return course.course.title.toLowerCase().includes(query);
            });
            setProgressData(filteredProgressData);
        }
    };

    // Calculate additional stats
    const getAverageProgress = () => {
        if (progressData.length === 0) return 0;
        const totalProgress = progressData.reduce((sum, course) => sum + course.progressPercentage, 0);
        return Math.round(totalProgress / progressData.length);
    };

    const getActiveCoursesCount = () => {
        return progressData.filter(course => course.progressPercentage > 0 && course.progressPercentage < 100).length;
    };

    const getCompletedCoursesCount = () => {
        return progressData.filter(course => course.progressPercentage === 100).length;
    };

    // Calculate total learning time
    const getTotalLearningTime = () => {
        if (courses.length === 0) return "0m";
        const allLectures = courses.flatMap(course => course.lectures || []);
        return calculateTotalDuration(allLectures);
    };

    // Calculate completed learning time
    const getCompletedLearningTime = () => {
        if (courses.length === 0) return "0m";
        let totalSeconds = 0;
        
        courses.forEach(course => {
            const completedLessonIds = course.completed_lesson || [];
            const lectures = course.lectures || [];
            
            lectures.forEach(lecture => {
                if (completedLessonIds.includes(lecture.id)) {
                    totalSeconds += parseDurationToSeconds(lecture.content_duration);
                }
            });
        });
        
        // Format seconds back to readable duration
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        let result = "";
        if (hours > 0) result += `${hours}h `;
        if (minutes > 0 || hours > 0) result += `${minutes}m `;
        if (seconds > 0 || (hours === 0 && minutes === 0)) result += `${seconds}s`;
        
        return result.trim();
    };

    return (
        <>
            <BaseHeader />

            <section className="pt-5 pb-5 dashboard-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Welcome Section */}
                            <div className="welcome-section">
                                <div className="row align-items-center">
                                    <div className="col-md-8">
                                        <h2 className="mb-2 fw-bold">Welcome back! 👋</h2>
                                        <p className="mb-0 opacity-90">Ready to continue your learning journey? Let's pick up where you left off.</p>
                                    </div>
                                    <div className="col-md-4 text-md-end mt-3 mt-md-0">
                                        <div className="d-flex justify-content-md-end justify-content-center text-primary">
                                                <div
                                                    className="progress-circle"
                                                    style={{ '--progress': getAverageProgress() || 0 }}
                                                >
                                                    <div className="progress-inner">
                                                    <div className="text-center">
                                                        <div className="h3 fw-bold mb-0">{getAverageProgress() || 0}%</div>
                                                        <small>Complete</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <h5 className="mt-2 mb-0 opacity-90 medium text-md-end text-center">Average Progress</h5>
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Statistics Cards */}
                            <div className="row mb-2">
                                <div className="col-lg-3 col-sm-6 mb-3">
                                    <div className="dashboard-stat-card justify-content-end" style={{'--gradient-start': '#667eea', '--gradient-end': '#764ba2'}}>
                                        <div className="d-flex flex-column h-100 justify-content-between">
                                            <div className="d-flex flex-row align-items-center">
                                            <div className="stat-icon me-3">
                                                <i className="fas fa-graduation-cap"></i>
                                            </div>
                                            <div className="dashboard-stat-number">{stats.total_courses || 0}</div>
                                            </div>
                                            <div className="stat-label mt-2">{/* or mt-1 for less space */}
                                            Total Courses
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-lg-3 col-sm-6 mb-3">
                                    <div className="dashboard-stat-card justify-content-end" style={{'--gradient-start': '#667eea', '--gradient-end': '#764ba2'}}>
                                        <div className="d-flex flex-column h-100 justify-content-between">
                                            <div className="d-flex flex-row align-items-center">
                                            <div className="stat-icon me-3">
                                                <i className="fas fa-play-circle"></i>
                                            </div>
                                            <div className="dashboard-stat-number">{getActiveCoursesCount()}</div>
                                            </div>
                                            <div className="stat-label mt-2">{/* or mt-1 for less space */}
                                            Active Courses
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-lg-3 col-sm-6 mb-3">
                                    <div className="dashboard-stat-card justify-content-end" style={{'--gradient-start': '#667eea', '--gradient-end': '#764ba2'}}>
                                        <div className="d-flex flex-column h-100 justify-content-between">
                                            <div className="d-flex flex-row align-items-center">
                                            <div className="stat-icon me-3">
                                                <i className="fas fa-clipboard-check"></i>
                                            </div>
                                            <div className="dashboard-stat-number">{stats.completed_lessons || 0}</div>
                                            </div>
                                            <div className="stat-label mt-2">{/* or mt-1 for less space */}
                                            Completed Lessons
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-lg-3 col-sm-6 mb-3">
                                    <div className="dashboard-stat-card justify-content-end" style={{'--gradient-start': '#667eea', '--gradient-end': '#764ba2'}}>
                                        <div className="d-flex flex-column h-100 justify-content-between">
                                            <div className="d-flex flex-row align-items-center">
                                            <div className="stat-icon me-3">
                                                <i className="fas fa-medal"></i>
                                            </div>
                                            <div className="dashboard-stat-number">{getCompletedCoursesCount()}</div>
                                            </div>
                                            <div className="stat-label mt-2">{/* or mt-1 for less space */}
                                            Completed Courses
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Learning Time Statistics */}
                            <div className="row mb-4">
                                <div className="col-12">
                                    <div className="dashboard-card">
                                        <div className="card-body p-4">
                                            <h5 className="mb-3 fw-bold">
                                                <i className="fas fa-clock me-2"></i>
                                                Learning Progress
                                            </h5>
                                            <div className="row g-3">
                                                <div className="col-md-4">
                                                    <div className="d-flex align-items-center p-3 bg-light rounded">
                                                        <div className="me-3">
                                                            <i className="fas fa-hourglass-start text-primary" style={{fontSize: '2rem'}}></i>
                                                        </div>
                                                        <div>
                                                            <div className="h5 fw-bold mb-0">{getTotalLearningTime()}</div>
                                                            <small className="text-muted">Total Content</small>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-4">
                                                    <div className="d-flex align-items-center p-3 bg-light rounded">
                                                        <div className="me-3">
                                                            <i className="fas fa-check-circle text-success" style={{fontSize: '2rem'}}></i>
                                                        </div>
                                                        <div>
                                                            <div className="h5 fw-bold mb-0">{getCompletedLearningTime()}</div>
                                                            <small className="text-muted">Completed</small>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-4">
                                                    <div className="d-flex align-items-center p-3 bg-light rounded">
                                                        <div className="me-3">
                                                            <i className="fas fa-trophy text-warning" style={{fontSize: '2rem'}}></i>
                                                        </div>
                                                        <div>
                                                            <div className="h5 fw-bold mb-0">{getAverageProgress()}%</div>
                                                            <small className="text-muted">Average Progress</small>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="row">
                                {/* Recent Activity */}
                                <div className="col-lg-4 mb-4">
                                    <div className="dashboard-card h-50">
                                        <div className="card-header bg-transparent border-0">
                                            <h5 className="mb-0 fw-bold">
                                                <i className="fas fa-clock"></i>
                                                Recent Activity
                                            </h5>
                                        </div>
                                            {recentActivity.length > 0 ? (
                                                recentActivity.map((activity, index) => (
                                                    <div key={index} className="activity-item">
                                                        <div className="d-flex align-items-start">
                                                            <div className={`activity-icon text-${activity.color}`}>
                                                                <i className={`${activity.icon} text-white`}></i>
                                                            </div>
                                                            <div className="flex-grow-1">
                                                                <p className="mb-1 fw-semibold">{activity.title}</p>
                                                                <small className="text-muted">
                                                                    {moment(activity.date).fromNow()}
                                                                </small>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-4">
                                                    <i className="fas fa-clock text-muted mb-3" style={{fontSize: '2rem', opacity: 0.3}}></i>
                                                    <p className="text-muted mb-0">No recent activity</p>
                                                    <small className="text-muted">Your learning activities will appear here</small>
                                                </div>
                                            )}
                                    </div>
                                </div>

                                {/* Course Progress Overview */}
                                <div className="col-lg-8">
                                    <div className="dashboard-card">
                                        <div className="card-header bg-transparent border-0 p-4 d-flex justify-content-between align-items-center">
                                            <h5 className="mb-0 fw-bold">
                                                <i className="fas fa-chart-line me-2"></i>
                                                My Courses
                                            </h5>
                                            <div className="search-container" style={{width: '300px'}}>
                                                <input 
                                                    type="search" 
                                                    className="search-input" 
                                                    placeholder="Search your courses..." 
                                                    onChange={handleSearch}
                                                />
                                            </div>
                                        </div>
                                        
                                        {fetching ? (
                                            <div className="card-body p-4 text-center">
                                                <div className="spinner-border text-primary" role="status">
                                                    <span className="visually-hidden">Loading...</span>
                                                </div>
                                                <p className="mt-3 text-muted">Loading your courses...</p>
                                            </div>
                                        ) : (
                                            <div className="card-body p-4 pt-0">
                                                {progressData.length > 0 ? (
                                                    <div className="row">
                                                        {progressData.slice(0, 6).map((course, index) => (
                                                            <div key={course.enrollment_id || index} className="col-md-6 mb-4">
                                                                <div className="course-card">
                                                                    <div className="card-body p-4 d-flex flex-column h-100">
                                                                        {/* Course Image with Overlay */}
                                                                        <div className="course-image-container">
                                                                            <img
                                                                                src={course.course.image}
                                                                                alt={course.course.title}
                                                                                className="course-image"
                                                                            />
                                                                            <div className="course-image-overlay">
                                                                                <i className="fas fa-play-circle course-play-icon"></i>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {/* Course Title */}
                                                                        <Link 
                                                                            to={`/student/courses/${course.enrollment_id}/`}
                                                                            className="text-decoration-none"
                                                                        >
                                                                            <h6 className="course-title mb-0 pb-0">
                                                                                {course.course.title}
                                                                            </h6>
                                                                        </Link>
                                                                        
                                                                        {/* Course Category */}
                                                                        <div className="course-category mb-3">
                                                                            <i className="fas fa-folder-open me-1"></i>
                                                                            {course.course.category?.title || 'General'}
                                                                        </div>
                                                                        
                                                                        {/* Course Meta Information */}
                                                                        <div className="course-meta mb-3">
                                                                            <div className="meta-item">
                                                                                <i className="fas fa-book-open meta-icon"></i>
                                                                                <span>{course.totalLessons} lessons</span>
                                                                            </div>
                                                                            <div className="meta-item">
                                                                                <i className="fas fa-clock meta-icon"></i>
                                                                                <span>Self-paced</span>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {/* Progress Section */}
                                                                        <div className="progress-container mb-2">
                                                                            <div className="progress-header">
                                                                                <span className="progress-label">
                                                                                    Progress
                                                                                </span>
                                                                                <span className="progress-percentage text-white">
                                                                                    {course.progressPercentage}%
                                                                                </span>
                                                                            </div>
                                                                            
                                                                            <div className="progress" style={{ height: '8px', borderRadius: '10px' }}>
                                                                                <div 
                                                                                    className="progress-bar" 
                                                                                    role="progressbar"
                                                                                    style={{
                                                                                        width: `${course.progressPercentage}%`,
                                                                                        borderRadius: '10px',
                                                                                        background: `linear-gradient(180deg, #28a745 0%, #20c997 100%)`
                                                                                    }}
                                                                                ></div>
                                                                            </div>
                                                                            
                                                                            <div className="course-stats">
                                                                                <div className="lesson-count">
                                                                                    <i className="fas fa-check-circle text-success"></i>
                                                                                    <span>{course.completedLessons} completed</span>
                                                                                </div>
                                                                                <div className="lesson-count">
                                                                                    <i className="fas fa-list text-muted"></i>
                                                                                    <span>{course.totalLessons - course.completedLessons} remaining</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {/* Action Button */}
                                                                        <div className="course-actions">
                                                                            {course.progressPercentage === 0 ? (
                                                                                <Link 
                                                                                    to={`/student/courses/${course.enrollment_id}/`}
                                                                                    className="course-btn btn-start"
                                                                                >
                                                                                    <i className="fas fa-play"></i>
                                                                                    Start Learning
                                                                                </Link>
                                                                            ) : course.progressPercentage === 100 ? (
                                                                                <Link 
                                                                                    to={`/student/courses/${course.enrollment_id}/`}
                                                                                    className="course-btn btn-completed"
                                                                                >
                                                                                    <i className="fas fa-trophy"></i>
                                                                                    Course Completed
                                                                                </Link>
                                                                            ) : (
                                                                                <Link 
                                                                                    to={`/student/courses/${course.enrollment_id}/`}
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
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-5">
                                                        <i className="fas fa-book-open text-muted" style={{fontSize: '3rem'}}></i>
                                                        <h6 className="mt-3 mb-2">No courses enrolled yet</h6>
                                                        <p className="text-muted">Start your learning journey by enrolling in courses</p>
                                                        <Link to="/" className="btn btn-modern">
                                                            Browse Courses
                                                        </Link>
                                                    </div>
                                                )}
                                                
                                                {progressData.length > 6 && (
                                                    <div className="text-center mt-4">
                                                        <Link to="/student/courses/" className="btn btn-outline-primary">
                                                            View All Courses ({progressData.length})
                                                        </Link>
                                                    </div>
                                                )}
                                            </div>
                                        )}
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

export default Dashboard;
