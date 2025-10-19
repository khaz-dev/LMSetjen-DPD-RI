import React, { useState, useEffect, useMemo, useCallback } from "react";
import dayjs, { moment } from "../../utils/dayjs";
import "./Dashboard.css";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LoadingSpinner from "./Partials/LoadingSpinner";
import MinimalLoader from "./Partials/MinimalLoader";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import { calculateTotalDuration, getDurationStats } from "../../utils/durationUtils";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { getMediaUrl, DEFAULT_IMAGE_URL } from "../../utils/constants";

function Dashboard() {
    const [stats, setStats] = useState([]);
    const [courses, setCourses] = useState([]);
    const [students, setStudents] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [orders, setOrders] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [bestCourses, setBestCourses] = useState([]);
    const [originalCourses, setOriginalCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recentActivity, setRecentActivity] = useState([]);

    // Helper function to clean and format image URLs
    const getImageUrl = (imageUrl) => {
        if (!imageUrl) {
            return DEFAULT_IMAGE_URL;
        }
        
        // Clean the URL - remove any extra encoding or nested URLs
        let cleanUrl = imageUrl;
        
        // If it contains encoded URLs, decode and extract the actual path
        if (cleanUrl.includes('%3A') || cleanUrl.includes('http%3A')) {
            cleanUrl = decodeURIComponent(cleanUrl);
        }
        
        // Extract just the filename if it's a nested URL structure
        if (cleanUrl.includes('/media/')) {
            const parts = cleanUrl.split('/media/');
            if (parts.length > 1) {
                // Get the last part which should be the actual filename
                cleanUrl = '/media/' + parts[parts.length - 1];
            }
        }
        
        // If it's already a complete URL, return as is
        if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
            return cleanUrl;
        }
        
        // Use the centralized helper
        return getMediaUrl(cleanUrl);
    };

    const fetchCourseData = async () => {
        try {
            setLoading(true);
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
            
            setStats(statsResponse.data[0] || {});
            setCourses(coursesResponse.data || []);
            setOriginalCourses(coursesResponse.data || []);
            setStudents(studentsResponse.data || []);
            setReviews(reviewsResponse.data || []);
            setNotifications(notificationsResponse.data || []);
            setOrders(ordersResponse.data || []);
            setQuestions(questionsResponse.data || []);
            setBestCourses(bestCoursesResponse.data || []);
            
            // Generate recent activity
            generateRecentActivity(
                studentsResponse.data || [], 
                reviewsResponse.data || [], 
                questionsResponse.data || [],
                notificationsResponse.data || []
            );
            
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const generateRecentActivity = (studentsData, reviewsData, questionsData, notificationsData) => {
        const activities = [];
        
        // Add recent student enrollments
        studentsData.slice(0, 3).forEach(student => {
            activities.push({
                type: 'enrollment',
                title: `${student.full_name} enrolled in a course`,
                time: moment(student.date).fromNow(),
                icon: 'fas fa-user-plus',
                color: '#10b981'
            });
        });
        
        // Add recent reviews
        reviewsData.slice(0, 3).forEach(review => {
            activities.push({
                type: 'review',
                title: `New ${review.rating}★ review received`,
                time: moment(review.date).fromNow(),
                icon: 'fas fa-star',
                color: '#f59e0b'
            });
        });
        
        // Add recent questions
        questionsData.slice(0, 3).forEach(question => {
            activities.push({
                type: 'question',
                title: `New question: ${question.title}`,
                time: moment(question.date).fromNow(),
                icon: 'fas fa-question-circle',
                color: '#3b82f6'
            });
        });
        
        // Sort by most recent and take top 6
        activities.sort((a, b) => new Date(b.time) - new Date(a.time));
        setRecentActivity(activities.slice(0, 6));
    };

    useEffect(() => {
        fetchCourseData();
    }, []);

    // Memoize enhanced statistics calculation
    const enhancedStats = useMemo(() => {
        const averageRating = reviews.length > 0 
            ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
            : 0;
        const unreadNotifications = notifications.filter(n => !n.seen).length;
        const pendingQuestions = questions.filter(q => !q.answered).length;
        
        return {
            averageRating,
            unreadNotifications,
            pendingQuestions,
            totalReviews: reviews.length,
            totalQuestions: questions.length
        };
    }, [reviews, notifications, questions]);

    // Memoize total content duration calculation
    const totalContentDuration = useMemo(() => {
        if (courses.length === 0) return "0m";
        const allLectures = courses.flatMap(course => course.lectures || []);
        return calculateTotalDuration(allLectures);
    }, [courses]);

    // Memoize duration statistics
    const courseDurationStats = useMemo(() => {
        const allLectures = courses.flatMap(course => course.lectures || []);
        return getDurationStats(allLectures);
    }, [courses]);

    // Memoize search handler
    const handleSearch = useCallback((event) => {
        const query = event.target.value.toLowerCase();
        if (query === "") {
            setCourses(originalCourses); // Reset to original courses
        } else {
            const filtered = originalCourses.filter((c) => {
                return c.title?.toLowerCase().includes(query);
            });
            setCourses(filtered);
        }
    }, [originalCourses]);

    // Show full-page loading spinner on initial load
    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="modern-dashboard" style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center' }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className="col-lg-9 col-md-8 col-12" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Loading Dashboard...</p>
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

            <section className="modern-dashboard">
                <div className="container">
                    <Header />
                    <div className="row">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Dashboard Header */}
                            <div className="dashboard-header-modern mb-3">
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h2 className="dashboard-title">
                                            <i className="bi bi-speedometer2 me-3"></i>
                                            Instructor Dashboard
                                        </h2>
                                        <p className="dashboard-subtitle">
                                            Welcome back! Here's what's happening with your courses today.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Statistics Grid */}
                            <div className="row">
                                {/* Primary Stats */}
                                <div className="col-xl-4 col-lg-6 col-sm-6 mb-1">
                                    <div className="stat-card-enhanced" style={{'--card-accent': '#3498db', '--icon-bg': '#3498db'}}>
                                        <div className="stat-icon-enhanced">
                                            <i className="fas fa-book-open"></i>
                                        </div>
                                        <div className="stat-content">
                                            <div className="stat-number-enhanced">{stats.total_courses || 0}</div>
                                            <div className="stat-label-enhanced">Total Courses</div>
                                            <div className="stat-change positive">
                                                <i className="fas fa-arrow-up"></i> +2 this month
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-xl-4 col-lg-6 col-sm-6 mb-1">
                                    <div className="stat-card-enhanced" style={{'--card-accent': '#10b981', '--icon-bg': '#10b981'}}>
                                        <div className="stat-icon-enhanced">
                                            <i className="fas fa-users"></i>
                                        </div>
                                        <div className="stat-content">
                                            <div className="stat-number-enhanced">{stats.total_students || 0}</div>
                                            <div className="stat-label-enhanced">Total Students</div>
                                            <div className="stat-change positive">
                                                <i className="fas fa-arrow-up"></i> +{students.length > 5 ? students.length - 5 : 0} this week
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-xl-4 col-lg-6 col-sm-6 mb-1">
                                    <div className="stat-card-enhanced" style={{'--card-accent': '#2980b9', '--icon-bg': '#2980b9'}}>
                                        <div className="stat-icon-enhanced">
                                            <i className="fas fa-star"></i>
                                        </div>
                                        <div className="stat-content">
                                            <div className="stat-number-enhanced">{enhancedStats.averageRating}</div>
                                            <div className="stat-label-enhanced">Avg Rating</div>
                                            <div className="stat-change neutral">
                                                <i className="fas fa-star"></i> {enhancedStats.totalReviews} reviews
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Secondary Stats Row */}
                            <div className="row mb-3">
                                <div className="col-xl-4 col-lg-6 col-sm-6 mb-3">
                                    <div className="mini-stat-card">
                                        <div className="mini-stat-icon text-warning">
                                            <i className="fas fa-bell"></i>
                                        </div>
                                        <div className="mini-stat-content">
                                            <div className="mini-stat-number">{enhancedStats.unreadNotifications}</div>
                                            <div className="mini-stat-label">Unread Notifications</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-xl-4 col-lg-6 col-sm-6 mb-3">
                                    <div className="mini-stat-card">
                                        <div className="mini-stat-icon text-info">
                                            <i className="fas fa-question-circle"></i>
                                        </div>
                                        <div className="mini-stat-content">
                                            <div className="mini-stat-number">{enhancedStats.pendingQuestions}</div>
                                            <div className="mini-stat-label">Pending Questions</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-xl-4 col-lg-6 col-sm-6 mb-3">
                                    <div className="mini-stat-card">
                                        <div className="mini-stat-icon" >
                                            <i className="fas fa-chart-line"></i>
                                        </div>
                                        <div className="mini-stat-content">
                                            <div className="mini-stat-number">{courses.filter(c => c.platform_status === 'Published').length}</div>
                                            <div className="mini-stat-label">Published Courses</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Content Creation Statistics */}
                            <div className="row mb-3">
                                <div className="col-12">
                                    <div className="dashboard-card">
                                        <div className="card-body p-3">
                                            <h5 className="mb-3 fw-bold">
                                                <i className="fas fa-clock me-2"></i>
                                                Content Creation Overview
                                            </h5>
                                            <div className="row g-3">
                                                <div className="col-md-3">
                                                    <div className="d-flex flex-column align-items-center p-3 bg-light rounded text-center">
                                                        <i className="fas fa-hourglass-half text-primary mb-2" style={{fontSize: '2rem'}}></i>
                                                        <div className="h5 fw-bold mb-0">{totalContentDuration}</div>
                                                        <small className="text-muted">Total Content Created</small>
                                                    </div>
                                                </div>
                                                <div className="col-md-3">
                                                    <div className="d-flex flex-column align-items-center p-3 bg-light rounded text-center">
                                                        <i className="fas fa-film text-info mb-2" style={{fontSize: '2rem'}}></i>
                                                        <div className="h5 fw-bold mb-0">{courseDurationStats.count || 0}</div>
                                                        <small className="text-muted">Total Lectures</small>
                                                    </div>
                                                </div>
                                                <div className="col-md-3">
                                                    <div className="d-flex flex-column align-items-center p-3 bg-light rounded text-center">
                                                        <i className="fas fa-chart-line text-success mb-2" style={{fontSize: '2rem'}}></i>
                                                        <div className="h5 fw-bold mb-0">{courseDurationStats.average || "0m"}</div>
                                                        <small className="text-muted">Avg Lecture Length</small>
                                                    </div>
                                                </div>
                                                <div className="col-md-3">
                                                    <div className="d-flex flex-column align-items-center p-3 bg-light rounded text-center">
                                                        <i className="fas fa-fire text-danger mb-2" style={{fontSize: '2rem'}}></i>
                                                        <div className="h5 fw-bold mb-0">{courseDurationStats.max || "0m"}</div>
                                                        <small className="text-muted">Longest Lecture</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Content Grid */}
                            <div className="row">
                                {/* Recent Activity Panel */}
                                <div className="col-lg-6 mb-3">
                                    <div className="activity-panel-modern">
                                        <div className="panel-header">
                                            <h5 className="panel-title">
                                                <i className="fas fa-clock me-2"></i>
                                                Recent Activity
                                            </h5>
                                            <a href="/instructor/notifications/" className="view-all-link">View All</a>
                                        </div>
                                        <div className="activity-list">
                                            {recentActivity.length > 0 ? (
                                                recentActivity.map((activity, index) => (
                                                    <div key={index} className="activity-item">
                                                        <div className="activity-icon" style={{'--color': activity.color}}>
                                                            <i className={activity.icon}></i>
                                                        </div>
                                                        <div className="activity-content">
                                                            <div className="activity-title">{activity.title}</div>
                                                            <div className="activity-time">{activity.time}</div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="empty-activity">
                                                    <i className="fas fa-history"></i>
                                                    <p>No recent activity</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Course Analytics Chart */}
                                <div className="col-lg-6 mb-3">
                                    <div className="analytics-panel-modern">
                                        <div className="panel-header">
                                            <h5 className="panel-title">
                                                <i className="fas fa-analytics me-2"></i>
                                                Course Analytics
                                            </h5>
                                            <div className="analytics-filters">
                                                <select className="form-select form-select-sm">
                                                    <option>Last 7 days</option>
                                                    <option>Last 30 days</option>
                                                    <option>Last 3 months</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="analytics-content">
                                            {/* Simple Analytics Cards */}
                                            <div className="row">
                                                <div className="col-md-6 mb-3">
                                                    <div className="analytics-metric">
                                                        <div className="metric-value">{courses.filter(c => c.platform_status === 'Published').length}</div>
                                                        <div className="metric-label">Published</div>
                                                        <div className="metric-chart">
                                                            <div className="chart-bar" style={{width: '85%', backgroundColor: '#10b981'}}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-6 mb-3">
                                                    <div className="analytics-metric">
                                                        <div className="metric-value">{courses.filter(c => c.platform_status === 'Draft').length}</div>
                                                        <div className="metric-label">Drafts</div>
                                                        <div className="metric-chart">
                                                            <div className="chart-bar" style={{width: '45%', backgroundColor: '#f59e0b'}}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-6 mb-3">
                                                    <div className="analytics-metric">
                                                        <div className="metric-value">{courses.filter(c => c.platform_status === 'Review').length}</div>
                                                        <div className="metric-label">In Review</div>
                                                        <div className="metric-chart">
                                                            <div className="chart-bar" style={{width: '25%', backgroundColor: '#3498db'}}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="col-md-6 mb-3">
                                                    <div className="analytics-metric">
                                                        <div className="metric-value">{courses.reduce((sum, c) => sum + (c.students?.length || 0), 0)}</div>
                                                        <div className="metric-label">Total Enrollments</div>
                                                        <div className="metric-chart">
                                                            <div className="chart-bar" style={{width: '100%', backgroundColor: '#2980b9'}}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Top Performing Courses Row */}
                            <div className="row mb-3">
                                {/* Top Performing Courses */}
                                <div className="col-lg-12 mb-3">
                                    <div className="performance-panel-modern">
                                        <div className="panel-header">
                                            <h5 className="panel-title">
                                                <i className="fas fa-chart-line me-2"></i>
                                                Top Performing Courses
                                            </h5>
                                            <a href="/instructor/courses/" className="view-all-link">View All</a>
                                        </div>
                                        <div className="performance-content">
                                            {bestCourses.length > 0 ? (
                                                <div className="row">
                                                    {bestCourses.slice(0, 3).map((course, index) => (
                                                        <div key={index} className="col-md-4 mb-3">
                                                            <div className="performance-course-card">
                                                                <div className="course-rank">#{index + 1}</div>
                                                                <img 
                                                                    src={getImageUrl(course.image)} 
                                                                    alt={course.title}
                                                                    className="performance-course-image"
                                                                    onError={(e) => {
                                                                        e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                                                    }}
                                                                />
                                                                <div className="performance-course-info">
                                                                    <h6 className="course-title-small">{course.title}</h6>
                                                                    <div className="course-metrics">
                                                                        <div className="metric">
                                                                            <i className="fas fa-users"></i>
                                                                            <span>{course.students?.length || 0} students</span>
                                                                        </div>
                                                                        <div className="metric">
                                                                            <i className="fas fa-star"></i>
                                                                            <span>{course.average_rating || 0}★</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="empty-performance">
                                                    <i className="fas fa-chart-bar"></i>
                                                    <h6>No performance data yet</h6>
                                                    <p>Create and publish courses to see performance metrics</p>
                                                </div>
                                            )}
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

export default Dashboard;