import React, { useState, useEffect } from 'react';
import AdminHeader from '../partials/AdminHeader';
import Footer from '../partials/Footer';
import apiInstance from '../../utils/axios';
import UserData from '../plugin/UserData';
import Toast from '../plugin/Toast';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import './DashboardAdmin.css';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

function DashboardAdmin() {
    const [dashboardData, setDashboardData] = useState(null);
    const [enrollmentAnalytics, setEnrollmentAnalytics] = useState(null);
    const [systemHealth, setSystemHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    const userData = UserData();
    const isAdmin = userData?.role === 'admin';
    const isSuperAdmin = userData?.is_super_admin || false;

    useEffect(() => {
        if (isAdmin) {
            fetchDashboardData();
            fetchEnrollmentAnalytics();
            fetchSystemHealth();
        }
    }, [isAdmin]);

    const fetchDashboardData = async () => {
        try {
            const response = await apiInstance.get('admin/dashboard-summary/');
            setDashboardData(response.data);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            Toast().fire({
                icon: 'error',
                title: 'Failed to load dashboard data'
            });
        }
    };

    const fetchEnrollmentAnalytics = async () => {
        try {
            const response = await apiInstance.get('admin/enrollment-analytics/');
            setEnrollmentAnalytics(response.data);
        } catch (error) {
            console.error('Error fetching enrollment analytics:', error);
        }
    };

    const fetchSystemHealth = async () => {
        try {
            const response = await apiInstance.get('admin/system-health/');
            setSystemHealth(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching system health:', error);
            setLoading(false);
        }
    };

    // Chart configurations
    const getEnrollmentChartData = () => {
        if (!enrollmentAnalytics?.monthly_enrollments) return null;

        return {
            labels: enrollmentAnalytics.monthly_enrollments.map(item => 
                `${item.month.substring(0, 3)} ${item.year}`
            ),
            datasets: [{
                label: 'Monthly Enrollments',
                data: enrollmentAnalytics.monthly_enrollments.map(item => item.enrollments),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.4,
                fill: true,
            }]
        };
    };

    const getCategoryChartData = () => {
        if (!enrollmentAnalytics?.category_distribution) return null;

        return {
            labels: enrollmentAnalytics.category_distribution.map(item => item.category),
            datasets: [{
                data: enrollmentAnalytics.category_distribution.map(item => item.enrollments),
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF',
                    '#FF9F40'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        };
    };

    const getTopCoursesChartData = () => {
        if (!enrollmentAnalytics?.top_performing_courses) return null;

        return {
            labels: enrollmentAnalytics.top_performing_courses.map(course => 
                course.title.length > 20 ? course.title.substring(0, 20) + '...' : course.title
            ),
            datasets: [{
                label: 'Enrollments',
                data: enrollmentAnalytics.top_performing_courses.map(course => course.enrollments),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
            }]
        };
    };

    if (!isAdmin) {
        return (
            <div className="admin-access-denied">
                <AdminHeader />
                <div className="container mt-5 pt-5">
                    <div className="row justify-content-center">
                        <div className="col-md-6 text-center">
                            <i className="fas fa-shield-alt fa-5x text-danger mb-4"></i>
                            <h2>Access Denied</h2>
                            <p className="lead">You don't have permission to access the admin panel.</p>
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="admin-loading">
                <AdminHeader />
                <div className="container-fluid mt-5 pt-5">
                    <div className="row justify-content-center">
                        <div className="col-md-6 text-center">
                            <div className="spinner-border text-primary" style={{width: '3rem', height: '3rem'}}>
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p className="mt-3">Loading admin dashboard...</p>
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <>
            <AdminHeader />
                
            <section className="pt-5 pb-5 modern-dashboard">
                <div className="container">
                    {/* Dashboard Header */}
                    <div className="dashboard-header-modern">
                        <div className="header-content">
                            <div className="header-text">
                                <h1 className="dashboard-title">
                                    <i className="fas fa-tachometer-alt me-3"></i>
                                    Admin Dashboard
                                </h1>
                                <p className="dashboard-subtitle">
                                    Welcome back, {userData?.full_name}! Here's what's happening with your LMS system.
                                </p>
                            </div>
                            <div className="dashboard-actions">
                                <button className="btn btn-primary me-2">
                                    <i className="fas fa-download me-2"></i>
                                    Export Report
                                </button>
                                <button className="btn btn-outline-secondary">
                                    <i className="fas fa-sync-alt me-2"></i>
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <ul className="nav nav-tabs admin-nav-tabs mb-4">
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                                onClick={() => setActiveTab('overview')}
                            >
                                <i className="fas fa-chart-line me-2"></i>Overview
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`}
                                onClick={() => setActiveTab('analytics')}
                            >
                                <i className="fas fa-chart-bar me-2"></i>Analytics
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === 'system' ? 'active' : ''}`}
                                onClick={() => setActiveTab('system')}
                            >
                                <i className="fas fa-server me-2"></i>System Health
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === 'activity' ? 'active' : ''}`}
                                onClick={() => setActiveTab('activity')}
                            >
                                <i className="fas fa-activity me-2"></i>Recent Activity
                            </button>
                        </li>
                    </ul>

                    {/* Tab Content */}
                    <div className="tab-content">
                        {/* Overview Tab */}
                        {activeTab === 'overview' && (
                            <div className="tab-pane fade show active">
                                {/* Statistics Cards */}
                                <div className="row">
                                    <div className="col-xl-3 col-md-6 mb-4">
                                        <div className="stat-card stat-card-primary">
                                            <div className="stat-card-body">
                                                <div className="stat-icon">
                                                    <i className="fas fa-users"></i>
                                                </div>
                                                <div className="stat-info">
                                                    <h4 className="stat-number">{dashboardData?.total_students || 0}</h4>
                                                    <p className="stat-label">Total Students</p>
                                                    <span className="stat-change positive">
                                                        +{dashboardData?.recent_registrations || 0} this month
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-xl-3 col-md-6 mb-4">
                                        <div className="stat-card stat-card-success">
                                            <div className="stat-card-body">
                                                <div className="stat-icon">
                                                    <i className="fas fa-chalkboard-teacher"></i>
                                                </div>
                                                <div className="stat-info">
                                                    <h4 className="stat-number">{dashboardData?.total_teachers || 0}</h4>
                                                    <p className="stat-label">Total Teachers</p>
                                                    <span className="stat-change neutral">
                                                        {dashboardData?.active_teachers?.length || 0} active
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-xl-3 col-md-6 mb-4">
                                        <div className="stat-card stat-card-warning">
                                            <div className="stat-card-body">
                                                <div className="stat-icon">
                                                    <i className="fas fa-book"></i>
                                                </div>
                                                <div className="stat-info">
                                                    <h4 className="stat-number">{dashboardData?.total_courses || 0}</h4>
                                                    <p className="stat-label">Total Courses</p>
                                                    <span className="stat-change positive">
                                                        {dashboardData?.active_courses || 0} published
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-xl-3 col-md-6 mb-4">
                                        <div className="stat-card stat-card-info">
                                            <div className="stat-card-body">
                                                <div className="stat-icon">
                                                    <i className="fas fa-graduation-cap"></i>
                                                </div>
                                                <div className="stat-info">
                                                    <h4 className="stat-number">{dashboardData?.total_enrollments || 0}</h4>
                                                    <p className="stat-label">Total Enrollments</p>
                                                    <span className="stat-change positive">
                                                        +{dashboardData?.recent_enrollments || 0} this month
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Stats Row */}
                                <div className="row">
                                    <div className="col-xl-3 col-md-6 mb-4">
                                        <div className="mini-stat-card">
                                            <div className="mini-stat-icon">
                                                <i className="fas fa-certificate text-success"></i>
                                            </div>
                                            <div className="mini-stat-content">
                                                <h5>{dashboardData?.total_certificates || 0}</h5>
                                                <p>Certificates Issued</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-xl-3 col-md-6 mb-4">
                                        <div className="mini-stat-card">
                                            <div className="mini-stat-icon">
                                                <i className="fas fa-star text-warning"></i>
                                            </div>
                                            <div className="mini-stat-content">
                                                <h5>{dashboardData?.total_reviews || 0}</h5>
                                                <p>Total Reviews</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-xl-3 col-md-6 mb-4">
                                        <div className="mini-stat-card">
                                            <div className="mini-stat-icon">
                                                <i className="fas fa-question-circle text-info"></i>
                                            </div>
                                            <div className="mini-stat-content">
                                                <h5>{dashboardData?.total_quizzes || 0}</h5>
                                                <p>Total Quizzes</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-xl-3 col-md-6 mb-4">
                                        <div className="mini-stat-card">
                                            <div className="mini-stat-icon">
                                                <i className="fas fa-percentage text-primary"></i>
                                            </div>
                                            <div className="mini-stat-content">
                                                <h5>{dashboardData?.completion_rate || 0}%</h5>
                                                <p>Completion Rate</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Lists */}
                                <div className="row">
                                    <div className="col-lg-6 mb-4">
                                        <div className="activity-panel">
                                            <div className="panel-header">
                                                <h5 className="panel-title">
                                                    <i className="fas fa-trophy me-2"></i>
                                                    Top Performing Courses
                                                </h5>
                                            </div>
                                            <div className="activity-list">
                                                {dashboardData?.top_courses?.length > 0 ? (
                                                    dashboardData.top_courses.slice(0, 5).map((course, index) => (
                                                        <div key={index} className="activity-item">
                                                            <div className="activity-icon bg-success text-white">
                                                                <i className="fas fa-book"></i>
                                                            </div>
                                                            <div className="activity-content">
                                                                <h6 className="activity-title">{course.title}</h6>
                                                                <p className="activity-description">
                                                                    {course.enrollment_count} enrollments • {course.teacher}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="empty-state">
                                                        <i className="fas fa-book-open"></i>
                                                        <p>No course data available</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-lg-6 mb-4">
                                        <div className="activity-panel">
                                            <div className="panel-header">
                                                <h5 className="panel-title">
                                                    <i className="fas fa-users me-2"></i>
                                                    Most Active Teachers
                                                </h5>
                                            </div>
                                            <div className="activity-list">
                                                {dashboardData?.active_teachers?.length > 0 ? (
                                                    dashboardData.active_teachers.slice(0, 5).map((teacher, index) => (
                                                        <div key={index} className="activity-item">
                                                            <div className="activity-icon bg-primary text-white">
                                                                <i className="fas fa-user"></i>
                                                            </div>
                                                            <div className="activity-content">
                                                                <h6 className="activity-title">{teacher.full_name}</h6>
                                                                <p className="activity-description">
                                                                    {teacher.course_count} courses
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="empty-state">
                                                        <i className="fas fa-chalkboard-teacher"></i>
                                                        <p>No teacher data available</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Analytics Tab */}
                        {activeTab === 'analytics' && (
                            <div className="tab-pane fade show active">
                                <div className="row">
                                    {/* Enrollment Trend */}
                                    <div className="col-lg-8 mb-4">
                                        <div className="chart-panel">
                                            <div className="panel-header">
                                                <h5 className="panel-title">Enrollment Trends (Last 12 Months)</h5>
                                            </div>
                                            <div className="chart-container">
                                                {getEnrollmentChartData() && (
                                                    <Line 
                                                        data={getEnrollmentChartData()}
                                                        options={{
                                                            responsive: true,
                                                            plugins: {
                                                                legend: {
                                                                    position: 'top',
                                                                },
                                                                title: {
                                                                    display: true,
                                                                    text: 'Monthly Enrollment Statistics'
                                                                }
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Category Distribution */}
                                    <div className="col-lg-4 mb-4">
                                        <div className="chart-panel">
                                            <div className="panel-header">
                                                <h5 className="panel-title">Category Distribution</h5>
                                            </div>
                                            <div className="chart-container">
                                                {getCategoryChartData() && (
                                                    <Doughnut 
                                                        data={getCategoryChartData()}
                                                        options={{
                                                            responsive: true,
                                                            plugins: {
                                                                legend: {
                                                                    position: 'bottom',
                                                                }
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Top Courses Performance */}
                                    <div className="col-12 mb-4">
                                        <div className="chart-panel">
                                            <div className="panel-header">
                                                <h5 className="panel-title">Top Performing Courses</h5>
                                            </div>
                                            <div className="chart-container">
                                                {getTopCoursesChartData() && (
                                                    <Bar 
                                                        data={getTopCoursesChartData()}
                                                        options={{
                                                            responsive: true,
                                                            plugins: {
                                                                legend: {
                                                                    display: false,
                                                                },
                                                                title: {
                                                                    display: true,
                                                                    text: 'Course Enrollment Numbers'
                                                                }
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* System Health Tab */}
                        {activeTab === 'system' && systemHealth && (
                            <div className="tab-pane fade show active">
                                <div className="row">
                                    <div className="col-lg-8 mb-4">
                                        <div className="system-health-panel">
                                            <div className="panel-header">
                                                <h5 className="panel-title">
                                                    <i className="fas fa-heartbeat me-2"></i>
                                                    System Health Status
                                                </h5>
                                                <span className="health-status online">
                                                    <i className="fas fa-check-circle"></i>
                                                    All Systems Operational
                                                </span>
                                            </div>
                                            <div className="system-metrics">
                                                <div className="row">
                                                    {Object.entries(systemHealth.database_statistics).map(([key, value]) => (
                                                        <div key={key} className="col-md-4 mb-3">
                                                            <div className="metric-card">
                                                                <h4>{value}</h4>
                                                                <p>{key.replace(/_/g, ' ').toUpperCase()}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-lg-4 mb-4">
                                        <div className="server-info-panel">
                                            <div className="panel-header">
                                                <h5 className="panel-title">Server Information</h5>
                                            </div>
                                            <div className="server-info-list">
                                                {Object.entries(systemHealth.server_information).map(([key, value]) => (
                                                    <div key={key} className="info-item">
                                                        <span className="info-label">{key.replace(/_/g, ' ')}</span>
                                                        <span className="info-value">
                                                            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value.toString()}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Recent Activity Tab */}
                        {activeTab === 'activity' && (
                            <div className="tab-pane fade show active">
                                <div className="row">
                                    <div className="col-lg-6 mb-4">
                                        <div className="activity-panel">
                                            <div className="panel-header">
                                                <h5 className="panel-title">
                                                    <i className="fas fa-user-plus me-2"></i>
                                                    Recent Enrollments
                                                </h5>
                                            </div>
                                            <div className="activity-list">
                                                {dashboardData?.latest_enrollments?.length > 0 ? (
                                                    dashboardData.latest_enrollments.map((enrollment, index) => (
                                                        <div key={index} className="activity-item">
                                                            <div className="activity-icon bg-info">
                                                                <i className="fas fa-user-plus text-white"></i>
                                                            </div>
                                                            <div className="activity-content">
                                                                <h6 className="activity-title">{enrollment.student}</h6>
                                                                <p className="activity-description">
                                                                    enrolled in "{enrollment.course}"
                                                                </p>
                                                                <small className="activity-time">
                                                                    {new Date(enrollment.date).toLocaleDateString()}
                                                                </small>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="empty-state">
                                                        <i className="fas fa-user-plus"></i>
                                                        <p>No recent enrollments</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-lg-6 mb-4">
                                        <div className="activity-panel">
                                            <div className="panel-header">
                                                <h5 className="panel-title">
                                                    <i className="fas fa-star me-2"></i>
                                                    Recent Reviews
                                                </h5>
                                            </div>
                                            <div className="activity-list">
                                                {dashboardData?.latest_reviews?.length > 0 ? (
                                                    dashboardData.latest_reviews.map((review, index) => (
                                                        <div key={index} className="activity-item">
                                                            <div className="activity-icon bg-warning text-white">
                                                                <i className="fas fa-star"></i>
                                                            </div>
                                                            <div className="activity-content">
                                                                <h6 className="activity-title">{review.student}</h6>
                                                                <p className="activity-description">
                                                                    rated "{review.course}" - {review.rating}/5 stars
                                                                </p>
                                                                <small className="activity-time">
                                                                    {new Date(review.date).toLocaleDateString()}
                                                                </small>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="empty-state">
                                                        <i className="fas fa-star"></i>
                                                        <p>No recent reviews</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <Footer />      
        </>
    );
}

export default DashboardAdmin;