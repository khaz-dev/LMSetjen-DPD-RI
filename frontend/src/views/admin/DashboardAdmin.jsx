import React, { useState, useEffect, lazy, Suspense } from "react";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import apiInstance from "../../utils/axios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";

// Analytics Components
import ContentGapWidget from "../../components/Analytics/ContentGapWidget";
import AtRiskStudentsWidget from "../../components/Analytics/AtRiskStudentsWidget";
import RecommendationMetricsWidget from "../../components/Analytics/RecommendationMetricsWidget";
import SearchQualityWidget from "../../components/Analytics/SearchQualityWidget";
import QueryTaxonomyWidget from "../../components/Analytics/QueryTaxonomyWidget";

// Lazy load Chart.js components (516 KB)
const Line = lazy(() => import("react-chartjs-2").then(m => ({ default: m.Line })));
const Bar = lazy(() => import("react-chartjs-2").then(m => ({ default: m.Bar })));
const Doughnut = lazy(() => import("react-chartjs-2").then(m => ({ default: m.Doughnut })));

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
} from "chart.js";
import "./DashboardAdmin.css";

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
    const [activeTab, setActiveTab] = useState("overview");

    const userData = UserData();
    const isAdmin = userData?.role === "admin";
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
            const response = await apiInstance.get("admin/dashboard-summary/");
            setDashboardData(response.data);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat data dashboard"
            });
        }
    };

    const fetchEnrollmentAnalytics = async () => {
        try {
            const response = await apiInstance.get("admin/enrollment-analytics/");
            setEnrollmentAnalytics(response.data);
        } catch (error) {
            console.error("Error fetching enrollment analytics:", error);
        }
    };

    const fetchSystemHealth = async () => {
        try {
            const response = await apiInstance.get("admin/system-health/");
            setSystemHealth(response.data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching system health:", error);
            setLoading(false);
        }
    };

    // Translation mapping for system health field names
    const fieldTranslations = {
        // Database statistics
        database_size: "Ukuran Database",
        total_tables: "Total Tabel",
        active_connections: "Koneksi Aktif",
        cache_hit_ratio: "Rasio Cache Hit",
        query_count: "Jumlah Query",
        last_backup: "Backup Terakhir",
        table_count: "Jumlah Tabel",
        record_count: "Jumlah Record",
        storage_used: "Penyimpanan Digunakan",
        storage_available: "Penyimpanan Tersedia",
        
        // Server information
        server_name: "Nama Server",
        operating_system: "Sistem Operasi",
        python_version: "Versi Python",
        django_version: "Versi Django",
        database_engine: "Engine Database",
        server_uptime: "Waktu Aktif Server",
        cpu_usage: "Penggunaan CPU",
        memory_usage: "Penggunaan Memori",
        disk_usage: "Penggunaan Disk",
        ssl_enabled: "SSL Diaktifkan",
        debug_mode: "Mode Debug",
        allowed_hosts: "Host yang Diizinkan"
    };

    // Function to translate field names
    const translateFieldName = (fieldName) => {
        return fieldTranslations[fieldName] || fieldName.replace(/_/g, " ");
    };

    // Chart configurations
    const getEnrollmentChartData = () => {
        if (!enrollmentAnalytics?.monthly_enrollments) return null;

        return {
            labels: enrollmentAnalytics.monthly_enrollments.map(item => 
                `${item.month.substring(0, 3)} ${item.year}`
            ),
            datasets: [{
                label: "Pendaftaran Bulanan",
                data: enrollmentAnalytics.monthly_enrollments.map(item => item.enrollments),
                borderColor: "rgb(75, 192, 192)",
                backgroundColor: "rgba(75, 192, 192, 0.2)",
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
                    "#FF6384",
                    "#36A2EB",
                    "#FFCE56",
                    "#4BC0C0",
                    "#9966FF",
                    "#FF9F40"
                ],
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        };
    };

    const getTopCoursesChartData = () => {
        if (!enrollmentAnalytics?.top_performing_courses) return null;

        return {
            labels: enrollmentAnalytics.top_performing_courses.map(course => 
                course.title.length > 20 ? course.title.substring(0, 20) + "..." : course.title
            ),
            datasets: [{
                label: "Pendaftaran",
                data: enrollmentAnalytics.top_performing_courses.map(course => course.enrollments),
                backgroundColor: "rgba(54, 162, 235, 0.6)",
                borderColor: "rgba(54, 162, 235, 1)",
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
                            <h2>Akses Ditolak</h2>
                            <p className="lead">Anda tidak memiliki izin untuk mengakses panel admin.</p>
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
                            <div className="spinner-border text-primary" style={{width: "3rem", height: "3rem"}}>
                                <span className="visually-hidden">Memuat...</span>
                            </div>
                            <p className="mt-3">Memuat dashboard admin...</p>
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="admin-page-wrapper" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <AdminHeader />
                
            <section className="pt-4 pb-5 modern-dashboard admin-dashboard" style={{ flex: 1 }}>
                <div className="container">
                    {/* Dashboard Header */}
                    <div className="dashboard-header-modern">
                        <div className="header-content">
                            <div className="header-text">
                                <h1 className="dashboard-title">
                                    <i className="fas fa-tachometer-alt me-3"></i>
                                    Dashboard Admin
                                </h1>
                                <p className="dashboard-subtitle">
                                    Selamat datang kembali, {userData?.full_name}! Berikut yang terjadi dengan sistem LMS Anda.
                                </p>
                            </div>
                            <div className="dashboard-actions">
                                <button className="btn btn-primary me-2">
                                    <i className="fas fa-download me-2"></i>
                                    Unduh Laporan
                                </button>
                                <button className="btn btn-outline-secondary">
                                    <i className="fas fa-sync-alt me-2"></i>
                                    Segarkan
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <ul className="nav nav-tabs admin-nav-tabs mb-4">
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === "overview" ? "active" : ""}`}
                                onClick={() => setActiveTab("overview")}
                            >
                                <i className="fas fa-chart-line me-2"></i>Gambaran Umum
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === "analytics" ? "active" : ""}`}
                                onClick={() => setActiveTab("analytics")}
                            >
                                <i className="fas fa-chart-bar me-2"></i>Analitik
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === "system" ? "active" : ""}`}
                                onClick={() => setActiveTab("system")}
                            >
                                <i className="fas fa-server me-2"></i>Kesehatan Sistem
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === "activity" ? "active" : ""}`}
                                onClick={() => setActiveTab("activity")}
                            >
                                <i className="fas fa-activity me-2"></i>Aktivitas Terbaru
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === "content-gaps" ? "active" : ""}`}
                                onClick={() => setActiveTab("content-gaps")}
                            >
                                <i className="fas fa-search-minus me-2"></i>Celah Konten
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === "at-risk" ? "active" : ""}`}
                                onClick={() => setActiveTab("at-risk")}
                            >
                                <i className="fas fa-user-shield me-2"></i>Siswa Berisiko
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === "recommendations" ? "active" : ""}`}
                                onClick={() => setActiveTab("recommendations")}
                            >
                                <i className="fas fa-star me-2"></i>Rekomendasi
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === "search-quality" ? "active" : ""}`}
                                onClick={() => setActiveTab("search-quality")}
                            >
                                <i className="fas fa-chart-line me-2"></i>Kualitas Pencarian
                            </button>
                        </li>
                        <li className="nav-item">
                            <button 
                                className={`nav-link ${activeTab === "query-taxonomy" ? "active" : ""}`}
                                onClick={() => setActiveTab("query-taxonomy")}
                            >
                                <i className="fas fa-tags me-2"></i>Taksonomi Kueri
                            </button>
                        </li>
                    </ul>

                    {/* Tab Content */}
                    <div className="tab-content">
                        {/* Overview Tab */}
                        {activeTab === "overview" && (
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
                                                    <p className="stat-label">Total Siswa</p>
                                                    <span className="stat-change positive">
                                                        +{dashboardData?.recent_registrations || 0} bulan ini
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
                                                    <p className="stat-label">Total Instruktur</p>
                                                    <span className="stat-change neutral">
                                                        {dashboardData?.active_teachers?.length || 0} aktif
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
                                                    <p className="stat-label">Total Kursus</p>
                                                    <span className="stat-change positive">
                                                        {dashboardData?.active_courses || 0} dipublikasikan
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
                                                    <p className="stat-label">Total Pendaftaran</p>
                                                    <span className="stat-change positive">
                                                        +{dashboardData?.recent_enrollments || 0} bulan ini
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
                                                <p>Sertifikat Diterbitkan</p>
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
                                                <p>Total Ulasan</p>
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
                                                <p>Total Kuis</p>
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
                                                <p>Tingkat Penyelesaian</p>
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
                                                    Kursus Terbaik
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
                                                        <p>Data kursus tidak tersedia</p>
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
                                                    Instruktur Paling Aktif
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
                                                                    {teacher.course_count} kursus
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="empty-state">
                                                        <i className="fas fa-chalkboard-teacher"></i>
                                                        <p>Data instruktur tidak tersedia</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Analytics Tab */}
                        {activeTab === "analytics" && (
                            <div className="tab-pane fade show active">
                                <Suspense fallback={
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Memuat grafik...</span>
                                        </div>
                                        <p className="mt-3 text-muted">Memuat analitik...</p>
                                    </div>
                                }>
                                <div className="row">
                                    {/* Enrollment Trend */}
                                    <div className="col-lg-8 mb-4">
                                        <div className="chart-panel">
                                            <div className="panel-header">
                                                <h5 className="panel-title">Tren Pendaftaran (12 Bulan Terakhir)</h5>
                                            </div>
                                            <div className="chart-container">
                                                {getEnrollmentChartData() && (
                                                    <Line 
                                                        data={getEnrollmentChartData()}
                                                        options={{
                                                            responsive: true,
                                                            plugins: {
                                                                legend: {
                                                                    position: "top",
                                                                },
                                                                title: {
                                                                    display: true,
                                                                    text: "Statistik Pendaftaran Bulanan"
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
                                                <h5 className="panel-title">Distribusi Kategori</h5>
                                            </div>
                                            <div className="chart-container">
                                                {getCategoryChartData() && (
                                                    <Doughnut 
                                                        data={getCategoryChartData()}
                                                        options={{
                                                            responsive: true,
                                                            plugins: {
                                                                legend: {
                                                                    position: "bottom",
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
                                                <h5 className="panel-title">Kursus Terbaik</h5>
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
                                                                    text: "Jumlah Pendaftaran Kursus"
                                                                }
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                </Suspense>
                            </div>
                        )}

                        {/* System Health Tab */}
                        {activeTab === "system" && systemHealth && (
                            <div className="tab-pane fade show active">
                                <div className="row">
                                    <div className="col-lg-8 mb-4">
                                        <div className="system-health-panel">
                                            <div className="panel-header">
                                                <h5 className="panel-title">
                                                    <i className="fas fa-heartbeat me-2"></i>
                                                    Status Kesehatan Sistem
                                                </h5>
                                                <span className="health-status online">
                                                    <i className="fas fa-check-circle"></i>
                                                    Semua Sistem Berfungsi
                                                </span>
                                            </div>
                                            <div className="system-metrics">
                                                <div className="row">
                                                    {Object.entries(systemHealth.database_statistics).map(([key, value]) => (
                                                        <div key={key} className="col-md-4 mb-3">
                                                            <div className="metric-card">
                                                                <h4>{value}</h4>
                                                                <p>{translateFieldName(key).toUpperCase()}</p>
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
                                                <h5 className="panel-title">Informasi Server</h5>
                                            </div>
                                            <div className="server-info-list">
                                                {Object.entries(systemHealth.server_information).map(([key, value]) => (
                                                    <div key={key} className="info-item">
                                                        <span className="info-label">{translateFieldName(key)}</span>
                                                        <span className="info-value">
                                                            {typeof value === "boolean" ? (value ? "Ya" : "Tidak") : value.toString()}
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
                        {activeTab === "activity" && (
                            <div className="tab-pane fade show active">
                                <div className="row">
                                    <div className="col-lg-6 mb-4">
                                        <div className="activity-panel">
                                            <div className="panel-header">
                                                <h5 className="panel-title">
                                                    <i className="fas fa-user-plus me-2"></i>
                                                    Pendaftaran Terbaru
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
                                                                    mendaftar di "{enrollment.course}"
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
                                                        <p>Tidak ada pendaftaran terbaru</p>
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
                                                    Ulasan Terbaru
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
                                                                    memberi nilai "{review.course}" - {review.rating}/5 bintang
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
                                                        <p>Tidak ada ulasan terbaru</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Content Gaps Tab (TIER 1) */}
                        {activeTab === "content-gaps" && (
                            <div className="tab-pane fade show active">
                                <ContentGapWidget />
                            </div>
                        )}

                        {/* At-Risk Students Tab (TIER 1) */}
                        {activeTab === "at-risk" && (
                            <div className="tab-pane fade show active">
                                <AtRiskStudentsWidget />
                            </div>
                        )}

                        {/* Recommendations Tab (TIER 1) */}
                        {activeTab === "recommendations" && (
                            <div className="tab-pane fade show active">
                                <RecommendationMetricsWidget />
                            </div>
                        )}

                        {/* Search Quality Tab (PHASE 4.10) */}
                        {activeTab === "search-quality" && (
                            <div className="tab-pane fade show active">
                                <SearchQualityWidget />
                            </div>
                        )}

                        {/* Query Taxonomy Tab (PHASE 4.10 TIER 1.2) */}
                        {activeTab === "query-taxonomy" && (
                            <div className="tab-pane fade show active">
                                <QueryTaxonomyWidget />
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <Footer />      
        </div>
    );
}

export default React.memo(DashboardAdmin);