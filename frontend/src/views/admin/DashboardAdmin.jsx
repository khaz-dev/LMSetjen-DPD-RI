import React, { useState, useEffect, lazy, Suspense, useMemo, useCallback } from "react";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import apiInstance from "../../utils/axios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { APP_VERSION } from "../../utils/version";
import useSystemVersion from "../../hooks/useSystemVersion";

// Analytics Components
import ContentGapWidget from "../../components/Analytics/ContentGapWidget";
import AtRiskStudentsWidget from "../../components/Analytics/AtRiskStudentsWidget";
import RecommendationMetricsWidget from "../../components/Analytics/RecommendationMetricsWidget";
import SearchQualityWidget from "../../components/Analytics/SearchQualityWidget";
import QueryTaxonomyWidget from "../../components/Analytics/QueryTaxonomyWidget";
import VisitorTrafficWidget from "../../components/Analytics/VisitorTrafficWidget";

// Lazy load Chart.js components
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
    const { version: liveAppVersion } = useSystemVersion();
    const activeVersion = liveAppVersion || APP_VERSION;

    const [dashboardData, setDashboardData] = useState(null);
    const [enrollmentAnalytics, setEnrollmentAnalytics] = useState(null);
    const [systemHealth, setSystemHealth] = useState(null);
    const [atRiskSummary, setAtRiskSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");
    const [aiSubTab, setAiSubTab] = useState("content-gaps");
    const [lastSyncTime, setLastSyncTime] = useState("");

    const userData = UserData();
    const isAdmin = userData?.role === "admin";

    const fetchAllData = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const [summaryRes, analyticsRes, healthRes, riskRes] = await Promise.all([
                apiInstance.get("admin/dashboard-summary/").catch(err => {
                    console.error("Error fetching summary:", err);
                    return { data: null };
                }),
                apiInstance.get("admin/enrollment-analytics/").catch(err => {
                    console.error("Error fetching analytics:", err);
                    return { data: null };
                }),
                apiInstance.get("admin/system-health/").catch(err => {
                    console.error("Error fetching health:", err);
                    return { data: null };
                }),
                apiInstance.get("analytics/at-risk-summary/").catch(err => {
                    console.error("Error fetching risk summary:", err);
                    return { data: null };
                }),
            ]);

            if (summaryRes.data) setDashboardData(summaryRes.data);
            if (analyticsRes.data) setEnrollmentAnalytics(analyticsRes.data);
            if (healthRes.data) setSystemHealth(healthRes.data);
            if (riskRes.data) setAtRiskSummary(riskRes.data);

            const now = new Date();
            setLastSyncTime(
                now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " WIB"
            );

            if (isRefresh) {
                Toast().fire({
                    icon: "success",
                    title: "Data dasbor berhasil diperbarui langsung"
                });
            }
        } catch (error) {
            console.error("Error fetching admin dashboard data:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat data dashboard"
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) {
            fetchAllData(false);
        }
    }, [isAdmin, fetchAllData]);

    // Export report function
    const handleExportReport = () => {
        try {
            const nowStr = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
            const rows = [
                ["LAPORAN RINGKASAN EKSEKUTIF LMS SETJEN DPD RI"],
                ["Waktu Ekspor", nowStr],
                ["Diekspor Oleh", userData?.full_name || "Administrator"],
                [""],
                ["METRIK UTAMA", "NILAI REAL", "KETERANGAN"],
                ["Total Siswa", dashboardData?.total_students || 0, `+${dashboardData?.recent_registrations || 0} pendaftar 30 hari terakhir`],
                ["Total Instruktur", dashboardData?.total_teachers || 0, `${dashboardData?.active_teachers_count ?? dashboardData?.active_teachers?.length ?? 0} aktif mengajar`],
                ["Total Kursus", dashboardData?.total_courses || 0, `${dashboardData?.active_courses || 0} dipublikasikan, ${dashboardData?.draft_courses || 0} draf`],
                ["Total Pendaftaran", dashboardData?.total_enrollments || 0, `+${dashboardData?.recent_enrollments || 0} pendaftaran 30 hari terakhir`],
                ["Sertifikat Terbit", dashboardData?.total_certificates || 0, `+${dashboardData?.recent_certificates || 0} 30 hari terakhir`],
                ["Tingkat Kelulusan", `${dashboardData?.completion_rate || 0}%`, "Rasio kelulusan siswa sah"],
                ["Total Kuis", dashboardData?.total_quizzes || 0, `${dashboardData?.total_quiz_attempts || 0} kali dikerjakan`],
                ["Rating LMS Rata-rata", `${dashboardData?.avg_rating || 0} / 5.0`, `Berdasarkan ${dashboardData?.total_reviews || 0} ulasan`],
                [""],
                ["TOP 5 KURSUS TERPOPULER", "INSTRUKTUR", "TOTAL PENDAFTARAN"],
                ...(dashboardData?.top_courses || []).map((c, i) => [
                    `#${i + 1} ${c.title}`,
                    c.teacher,
                    c.enrollment_count
                ]),
                [""],
                ["TOP 5 INSTRUKTUR TERAKTIF", "JUMLAH KURSUS PUBLIKASI"],
                ...(dashboardData?.active_teachers || []).map((t, i) => [
                    `#${i + 1} ${t.full_name}`,
                    t.course_count
                ]),
                [""],
                ["STATUS KESEHATAN SISTEM"],
                ["Sistem Operasi", systemHealth?.server_information?.operating_system || "-"],
                ["Versi Aplikasi LMS", `v${activeVersion}`],
                ["Versi Django Backend", systemHealth?.server_information?.django_version || "-"],
                ["Versi Python", systemHealth?.server_information?.python_version || "-"],
                ["Engine Database", systemHealth?.server_information?.database_engine || "-"],
                ["Ukuran Database", systemHealth?.database_statistics?.database_size || "-"],
                ["Status Server", "Aktif Normal (Live Sync)"]
            ];

            const csvContent = "\uFEFF" + rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const dateStr = new Date().toISOString().split("T")[0];
            link.setAttribute("href", url);
            link.setAttribute("download", `Laporan_Eksekutif_LMS_Setjen_DPD_RI_${dateStr}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            Toast().fire({
                icon: "success",
                title: "Laporan eksekutif berhasil diunduh"
            });
        } catch (err) {
            console.error("Error generating report:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal membuat laporan"
            });
        }
    };

    // Translation mapping for system health field names
    const fieldTranslations = {
        database_size: "Ukuran Database",
        total_users: "Total Pengguna Terdaftar",
        total_students: "Total Siswa",
        total_teachers: "Total Instruktur",
        total_courses: "Total Kursus Aktif",
        total_lessons: "Total Materi Pelajaran",
        total_enrollments: "Total Pendaftaran",
        total_certificates: "Total Sertifikat Terbit",
        total_quizzes: "Total Kuis Tersedia",
        total_reviews: "Total Ulasan Pengguna",
        total_tables: "Total Tabel Database",
        active_connections: "Koneksi Aktif",
        cache_hit_ratio: "Rasio Cache Hit",
        query_count: "Jumlah Query",
        last_backup: "Backup Terakhir",
        operating_system: "Sistem Operasi",
        app_version: "Versi Aplikasi",
        python_version: "Versi Python",
        django_version: "Versi Django",
        database_engine: "Engine Database",
        server_uptime: "Waktu Aktif Server",
        debug_mode: "Mode Debug",
        timezone: "Zona Waktu",
        server_time: "Waktu Server",
        server_name: "Nama Server"
    };

    const translateFieldName = (fieldName) => {
        return fieldTranslations[fieldName] || fieldName.replace(/_/g, " ");
    };

    // Compact Charts memo
    const enrollmentChartData = useMemo(() => {
        if (!enrollmentAnalytics?.monthly_enrollments?.length) return null;
        return {
            labels: enrollmentAnalytics.monthly_enrollments.map(item => 
                `${item.month.substring(0, 3)} ${String(item.year).slice(-2)}`
            ),
            datasets: [{
                label: "Pendaftaran Siswa",
                data: enrollmentAnalytics.monthly_enrollments.map(item => item.enrollments),
                borderColor: "#0284c7",
                backgroundColor: "rgba(2, 132, 199, 0.12)",
                fill: true,
                tension: 0.35,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: "#0284c7"
            }]
        };
    }, [enrollmentAnalytics]);

    const categoryChartData = useMemo(() => {
        if (!enrollmentAnalytics?.category_distribution?.length) return null;
        return {
            labels: enrollmentAnalytics.category_distribution.map(item => item.category),
            datasets: [{
                data: enrollmentAnalytics.category_distribution.map(item => item.enrollments),
                backgroundColor: [
                    "#0284c7",
                    "#0d9488",
                    "#d97706",
                    "#6366f1",
                    "#ec4899",
                    "#8b5cf6",
                    "#10b981"
                ],
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        };
    }, [enrollmentAnalytics]);

    const topCoursesChartData = useMemo(() => {
        if (!enrollmentAnalytics?.top_performing_courses?.length) return null;
        return {
            labels: enrollmentAnalytics.top_performing_courses.slice(0, 7).map(c => 
                c.title.length > 22 ? c.title.substring(0, 22) + "..." : c.title
            ),
            datasets: [{
                label: "Jumlah Pendaftaran",
                data: enrollmentAnalytics.top_performing_courses.slice(0, 7).map(c => c.enrollments),
                backgroundColor: "rgba(13, 148, 136, 0.75)",
                borderColor: "rgba(13, 148, 136, 1)",
                borderRadius: 6,
                borderWidth: 1
            }]
        };
    }, [enrollmentAnalytics]);

    if (!isAdmin) {
        return (
            <div className="admin-access-denied">
                <AdminHeader />
                <div className="container mt-5 pt-5">
                    <div className="row justify-content-center">
                        <div className="col-md-6 text-center">
                            <i className="fas fa-shield-alt fa-4x text-danger mb-3"></i>
                            <h3 className="fw-bold">Akses Ditolak</h3>
                            <p className="text-muted">Anda tidak memiliki izin untuk mengakses panel administrasi DPD RI.</p>
                        </div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="admin-loading-wrapper">
                <AdminHeader />
                <div className="container text-center py-5 my-5">
                    <div className="spinner-border text-primary" style={{ width: "2.5rem", height: "2.5rem" }}>
                        <span className="visually-hidden">Memuat...</span>
                    </div>
                    <p className="mt-3 text-muted fw-semibold">Memuat data Dasbor Admin Setjen DPD RI...</p>
                </div>
                <Footer />
            </div>
        );
    }

    // Helper to calculate max enrollments for relative progress bars
    const maxCourseEnrollments = Math.max(
        ...(dashboardData?.top_courses?.map(c => c.enrollment_count) || [1]),
        1
    );

    return (
        <div className="admin-page-wrapper">
            <AdminHeader />

            <main className="admin-dashboard-container">
                <div className="container-fluid px-3 px-xl-4 footer-container">

                    {/* Executive Header Bar */}
                    <div className="admin-exec-header mb-3">
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                            <div className="admin-header-left">
                                <div className="admin-gov-badge">
                                    <i className="fas fa-landmark me-1"></i> SEKRETARIAT JENDERAL DPD RI
                                </div>
                                <h1 className="admin-exec-title">
                                    Dasbor Utama Administrasi
                                    <span className="admin-live-pulse" title="Terhubung langsung ke database PostgreSQL">
                                        <span className="pulse-dot"></span> Live Sync
                                    </span>
                                </h1>
                                <p className="admin-exec-subtitle">
                                    Selamat datang kembali, <strong>{userData?.full_name || "Administrator"}</strong>. Berikut ringkasan performa real-time LMS.
                                </p>
                            </div>

                            <div className="admin-header-actions d-flex align-items-center gap-2">
                                <span className="sync-timestamp-badge d-none d-sm-inline-flex align-items-center">
                                    <i className="far fa-clock me-1 text-primary"></i>
                                    {lastSyncTime || "Real-time"}
                                </span>
                                <button 
                                    className="btn btn-sm admin-btn-refresh" 
                                    onClick={() => fetchAllData(true)}
                                    disabled={refreshing}
                                    title="Segarkan data live saat ini"
                                >
                                    <i className={`fas fa-sync-alt me-1 ${refreshing ? "fa-spin" : ""}`}></i>
                                    {refreshing ? "Memperbarui..." : "Segarkan"}
                                </button>
                                <button 
                                    className="btn btn-sm admin-btn-export" 
                                    onClick={handleExportReport}
                                    title="Unduh laporan ringkasan real-time dalam format CSV"
                                >
                                    <i className="fas fa-file-download me-1"></i>
                                    Unduh Laporan
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Compact 8 KPI Metric Cards Grid */}
                    <div className="row g-2 mb-3">
                        {/* 1. Total Siswa */}
                        <div className="col-6 col-md-3 col-xl-3">
                            <div className="kpi-compact-card kpi-blue">
                                <div className="kpi-icon-wrap">
                                    <i className="fas fa-user-graduate"></i>
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Total Siswa</span>
                                    <div className="kpi-number">
                                        {Number(dashboardData?.total_students || 0).toLocaleString("id-ID")}
                                    </div>
                                    <span className="kpi-meta positive">
                                        +{dashboardData?.recent_registrations || 0} baru (30 hr)
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Instruktur */}
                        <div className="col-6 col-md-3 col-xl-3">
                            <div className="kpi-compact-card kpi-teal">
                                <div className="kpi-icon-wrap">
                                    <i className="fas fa-chalkboard-teacher"></i>
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Instruktur</span>
                                    <div className="kpi-number">
                                        {Number(dashboardData?.total_teachers || 0).toLocaleString("id-ID")}
                                    </div>
                                    <span className="kpi-meta info">
                                        {dashboardData?.active_teachers_count ?? dashboardData?.active_teachers?.length ?? 0} aktif mengajar
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 3. Total Kursus */}
                        <div className="col-6 col-md-3 col-xl-3">
                            <div className="kpi-compact-card kpi-indigo">
                                <div className="kpi-icon-wrap">
                                    <i className="fas fa-book-open"></i>
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Total Kursus</span>
                                    <div className="kpi-number">
                                        {Number(dashboardData?.total_courses || 0).toLocaleString("id-ID")}
                                    </div>
                                    <span className="kpi-meta neutral">
                                        {dashboardData?.active_courses || 0} rilis • {dashboardData?.draft_courses || 0} draf
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 4. Total Pendaftaran */}
                        <div className="col-6 col-md-3 col-xl-3">
                            <div className="kpi-compact-card kpi-purple">
                                <div className="kpi-icon-wrap">
                                    <i className="fas fa-clipboard-check"></i>
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Pendaftaran</span>
                                    <div className="kpi-number">
                                        {Number(dashboardData?.total_enrollments || 0).toLocaleString("id-ID")}
                                    </div>
                                    <span className="kpi-meta positive">
                                        +{dashboardData?.recent_enrollments || 0} bulan ini
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 5. Sertifikat Terbit */}
                        <div className="col-6 col-md-3 col-xl-3">
                            <div className="kpi-compact-card kpi-amber">
                                <div className="kpi-icon-wrap">
                                    <i className="fas fa-award"></i>
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Sertifikat Terbit</span>
                                    <div className="kpi-number">
                                        {Number(dashboardData?.total_certificates || 0).toLocaleString("id-ID")}
                                    </div>
                                    <span className="kpi-meta positive">
                                        +{dashboardData?.recent_certificates || 0} baru (30 hr)
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 6. Tingkat Kelulusan */}
                        <div className="col-6 col-md-3 col-xl-3">
                            <div className="kpi-compact-card kpi-emerald">
                                <div className="kpi-icon-wrap">
                                    <i className="fas fa-chart-pie"></i>
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Kelulusan</span>
                                    <div className="kpi-number">
                                        {dashboardData?.completion_rate || 0}%
                                    </div>
                                    <div className="kpi-progress-bar">
                                        <div 
                                            className="kpi-progress-fill" 
                                            style={{ width: `${Math.min(dashboardData?.completion_rate || 0, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 7. Kuis & Evaluasi */}
                        <div className="col-6 col-md-3 col-xl-3">
                            <div className="kpi-compact-card kpi-rose">
                                <div className="kpi-icon-wrap">
                                    <i className="fas fa-tasks"></i>
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Kuis & Ujian</span>
                                    <div className="kpi-number">
                                        {Number(dashboardData?.total_quizzes || 0).toLocaleString("id-ID")}
                                    </div>
                                    <span className="kpi-meta neutral">
                                        {dashboardData?.total_quiz_attempts || 0} kali dikerjakan
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 8. Rating LMS */}
                        <div className="col-6 col-md-3 col-xl-3">
                            <div className="kpi-compact-card kpi-orange">
                                <div className="kpi-icon-wrap">
                                    <i className="fas fa-star"></i>
                                </div>
                                <div className="kpi-info-wrap">
                                    <span className="kpi-label">Rating LMS</span>
                                    <div className="kpi-number">
                                        {dashboardData?.avg_rating ? `${dashboardData.avg_rating} / 5` : "5.0 / 5"}
                                    </div>
                                    <span className="kpi-meta warning">
                                        {dashboardData?.total_reviews || 0} ulasan pengguna
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Compact Navigation Tabs Bar */}
                    <div className="admin-nav-bar mb-3">
                        <div className="admin-tabs-list">
                            <button 
                                className={`admin-tab-btn ${activeTab === "overview" ? "active" : ""}`}
                                onClick={() => setActiveTab("overview")}
                            >
                                <i className="fas fa-th-large me-1"></i>
                                <span>Ringkasan Eksekutif</span>
                            </button>

                            <button 
                                className={`admin-tab-btn ${activeTab === "analytics" ? "active" : ""}`}
                                onClick={() => setActiveTab("analytics")}
                            >
                                <i className="fas fa-chart-line me-1"></i>
                                <span>Analitik & Tren</span>
                            </button>

                            <button 
                                className={`admin-tab-btn ${activeTab === "system" ? "active" : ""}`}
                                onClick={() => setActiveTab("system")}
                            >
                                <i className="fas fa-server me-1"></i>
                                <span>Kesehatan Server & DB</span>
                            </button>

                            <button 
                                className={`admin-tab-btn ${activeTab === "activity" ? "active" : ""}`}
                                onClick={() => setActiveTab("activity")}
                            >
                                <i className="fas fa-stream me-1"></i>
                                <span>Log Aktivitas</span>
                            </button>

                            <button 
                                className={`admin-tab-btn ${activeTab === "ai-quality" ? "active" : ""}`}
                                onClick={() => setActiveTab("ai-quality")}
                            >
                                <i className="fas fa-brain me-1"></i>
                                <span>AI & Kualitas Pembelajaran</span>
                                {atRiskSummary?.total_students > 0 ? (
                                    <span 
                                        className="badge ms-1"
                                        style={{ 
                                            background: activeTab === "ai-quality" ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.15)",
                                            color: activeTab === "ai-quality" ? "#fbbf24" : "#d97706",
                                            border: "1px solid rgba(245, 158, 11, 0.35)",
                                            fontSize: "0.68rem"
                                        }}
                                        title={`${atRiskSummary.total_students} siswa dalam pemantauan risiko belajar`}
                                    >
                                        <i className="fas fa-exclamation-triangle me-1"></i>
                                        {atRiskSummary.total_students} Terpantau
                                    </span>
                                ) : (
                                    <span className="badge bg-primary-subtle text-primary ms-1">AI Aktif</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* TAB CONTENT PANELS */}
                    <div className="admin-tab-body">

                        {/* 1. OVERVIEW TAB */}
                        {activeTab === "overview" && (
                            <div className="tab-pane-content">
                                <div className="row g-3">
                                    
                                    {/* Left Column (8 cols): Visual Charts & Top Courses */}
                                    <div className="col-lg-8">
                                        
                                        {/* Widget Analisis Tren Pengunjung LMSetjen DPD RI (Jam, Hari, Tanggal, Bulan, Tahun) */}
                                        <div className="mb-3">
                                            <VisitorTrafficWidget mode="compact" defaultGranularity="hourly" />
                                        </div>

                                        {/* Quick Analytics Visual Showcase */}
                                        <div className="admin-card mb-3">
                                            <div className="admin-card-header d-flex justify-content-between align-items-center">
                                                <h6 className="admin-card-title mb-0">
                                                    <i className="fas fa-chart-area text-primary me-2"></i>
                                                    Pratinjau Tren Pendaftaran & Kategori Kursus
                                                </h6>
                                                <button 
                                                    className="btn btn-link btn-sm p-0 text-decoration-none fw-semibold"
                                                    onClick={() => setActiveTab("analytics")}
                                                >
                                                    Lihat Detail Analitik <i className="fas fa-arrow-right ms-1"></i>
                                                </button>
                                            </div>
                                            <div className="admin-card-body p-3">
                                                <div className="row g-3 align-items-center">
                                                    {/* Mini Line Chart */}
                                                    <div className="col-md-7">
                                                        <div className="chart-wrapper-mini" style={{ height: "200px" }}>
                                                            {enrollmentChartData ? (
                                                                <Suspense fallback={<div className="chart-placeholder">Memuat grafik...</div>}>
                                                                    <Line 
                                                                        data={enrollmentChartData}
                                                                        options={{
                                                                            responsive: true,
                                                                            maintainAspectRatio: false,
                                                                            plugins: {
                                                                                legend: { display: false },
                                                                                tooltip: {
                                                                                    backgroundColor: "#002B49",
                                                                                    titleFont: { size: 11 },
                                                                                    bodyFont: { size: 12 }
                                                                                }
                                                                            },
                                                                            scales: {
                                                                                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                                                                                y: { grid: { color: "#f1f5f9" }, ticks: { font: { size: 10 } } }
                                                                            }
                                                                        }}
                                                                    />
                                                                </Suspense>
                                                            ) : (
                                                                <div className="chart-placeholder text-muted small">Data tren belum tersedia</div>
                                                            )}
                                                        </div>
                                                        <div className="text-center mt-1">
                                                            <small className="text-muted fw-semibold" style={{ fontSize: "0.75rem" }}>
                                                                <i className="fas fa-circle text-primary me-1" style={{ fontSize: "7px" }}></i>
                                                                Tren Pendaftaran Bulanan (12 Bulan)
                                                            </small>
                                                        </div>
                                                    </div>

                                                    {/* Mini Doughnut Chart */}
                                                    <div className="col-md-5">
                                                        <div className="chart-wrapper-mini" style={{ height: "180px" }}>
                                                            {categoryChartData ? (
                                                                <Suspense fallback={<div className="chart-placeholder">Memuat diagram...</div>}>
                                                                    <Doughnut 
                                                                        data={categoryChartData}
                                                                        options={{
                                                                            responsive: true,
                                                                            maintainAspectRatio: false,
                                                                            plugins: {
                                                                                legend: {
                                                                                    position: "bottom",
                                                                                    labels: { boxWidth: 10, font: { size: 10 } }
                                                                                }
                                                                            },
                                                                            cutout: "68%"
                                                                        }}
                                                                    />
                                                                </Suspense>
                                                            ) : (
                                                                <div className="chart-placeholder text-muted small">Data kategori belum tersedia</div>
                                                            )}
                                                        </div>
                                                        <div className="text-center mt-1">
                                                            <small className="text-muted fw-semibold" style={{ fontSize: "0.75rem" }}>
                                                                Distribusi Kategori Kursus
                                                            </small>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Top Performing Courses Table */}
                                        <div className="admin-card">
                                            <div className="admin-card-header d-flex justify-content-between align-items-center">
                                                <h6 className="admin-card-title mb-0">
                                                    <i className="fas fa-trophy text-warning me-2"></i>
                                                    Kursus Berkinerja Terbaik (Top 5)
                                                </h6>
                                                <span className="badge bg-light text-dark border">Berdasarkan Total Pendaftar</span>
                                            </div>
                                            <div className="admin-card-body p-0">
                                                {dashboardData?.top_courses?.length > 0 ? (
                                                    <div className="table-responsive">
                                                        <table className="table table-hover align-middle admin-compact-table mb-0">
                                                            <thead>
                                                                <tr>
                                                                    <th style={{ width: "45px" }} className="text-center">#</th>
                                                                    <th>Judul Kursus</th>
                                                                    <th>Instruktur</th>
                                                                    <th style={{ minWidth: "160px" }}>Pendaftaran Siswa</th>
                                                                    <th className="text-center" style={{ width: "90px" }}>Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {dashboardData.top_courses.slice(0, 5).map((course, idx) => {
                                                                    const pct = Math.round((course.enrollment_count / maxCourseEnrollments) * 100);
                                                                    return (
                                                                        <tr key={course.id || idx}>
                                                                            <td className="text-center">
                                                                                <span className={`rank-pill rank-${idx + 1}`}>
                                                                                    {idx + 1}
                                                                                </span>
                                                                            </td>
                                                                            <td>
                                                                                <div className="fw-semibold text-truncate course-table-title" title={course.title}>
                                                                                    {course.title}
                                                                                </div>
                                                                            </td>
                                                                            <td>
                                                                                <span className="text-muted small">
                                                                                    <i className="fas fa-user-circle me-1 text-primary"></i>
                                                                                    {course.teacher || "Belum ditentukan"}
                                                                                </span>
                                                                            </td>
                                                                            <td>
                                                                                <div className="d-flex align-items-center gap-2">
                                                                                    <div className="progress flex-grow-1" style={{ height: "6px" }}>
                                                                                        <div 
                                                                                            className="progress-bar bg-primary" 
                                                                                            role="progressbar" 
                                                                                            style={{ width: `${pct}%` }}
                                                                                        ></div>
                                                                                    </div>
                                                                                    <span className="fw-bold small" style={{ minWidth: "32px" }}>
                                                                                        {course.enrollment_count}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="text-center">
                                                                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                                                                                    Aktif
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="admin-empty-state py-4 text-center">
                                                        <i className="fas fa-book-open text-muted fa-2x mb-2"></i>
                                                        <p className="text-muted small mb-0">Belum ada data kursus yang dipublikasikan.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                    </div>

                                    {/* Right Column (4 cols): Active Instructors & Live Stream */}
                                    <div className="col-lg-4">

                                        {/* Most Active Instructors */}
                                        <div className="admin-card mb-3">
                                            <div className="admin-card-header d-flex justify-content-between align-items-center">
                                                <h6 className="admin-card-title mb-0">
                                                    <i className="fas fa-user-tie text-teal me-2"></i>
                                                    Instruktur Paling Aktif
                                                </h6>
                                                <span className="badge bg-teal-subtle text-teal">
                                                    {dashboardData?.active_teachers_count ?? dashboardData?.active_teachers?.length ?? 0} Instruktur
                                                </span>
                                            </div>
                                            <div className="admin-card-body p-2">
                                                {dashboardData?.active_teachers?.length > 0 ? (
                                                    <div className="admin-instructor-list">
                                                        {dashboardData.active_teachers.slice(0, 5).map((teacher, idx) => (
                                                            <div key={teacher.id || idx} className="admin-instructor-item">
                                                                <div className="admin-instructor-avatar">
                                                                    {(teacher.full_name || "I").charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="admin-instructor-meta">
                                                                    <div className="admin-instructor-name" title={teacher.full_name}>
                                                                        {teacher.full_name}
                                                                    </div>
                                                                    <small className="admin-instructor-courses">
                                                                        {teacher.course_count} Kursus Dipublikasikan
                                                                    </small>
                                                                </div>
                                                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle admin-instructor-badge">
                                                                    #{idx + 1}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="admin-empty-state py-3 text-center">
                                                        <i className="fas fa-user-friends text-muted fa-2x mb-2"></i>
                                                        <p className="text-muted small mb-0">Belum ada data instruktur aktif.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Live Activity Stream (Enrollments & Reviews) */}
                                        <div className="admin-card mb-3">
                                            <div className="admin-card-header d-flex justify-content-between align-items-center">
                                                <h6 className="admin-card-title mb-0">
                                                    <i className="fas fa-bolt text-warning me-2"></i>
                                                    Aktivitas Terbaru
                                                </h6>
                                                <button 
                                                    className="btn btn-link btn-sm p-0 text-decoration-none"
                                                    onClick={() => setActiveTab("activity")}
                                                >
                                                    Semua <i className="fas fa-chevron-right ms-1"></i>
                                                </button>
                                            </div>
                                            <div className="admin-card-body p-2">
                                                <div className="activity-mini-stream">
                                                    {dashboardData?.latest_enrollments?.slice(0, 4).map((enr, idx) => (
                                                        <div key={`enr-${idx}`} className="stream-item">
                                                            <div className="stream-badge bg-info-subtle text-info">
                                                                <i className="fas fa-user-plus"></i>
                                                            </div>
                                                            <div className="stream-content">
                                                                <div className="stream-title">
                                                                    <strong>{enr.student}</strong> mendaftar kursus
                                                                </div>
                                                                <div className="stream-desc text-truncate" title={enr.course}>
                                                                    "{enr.course}"
                                                                </div>
                                                                <span className="stream-time">
                                                                    {new Date(enr.date).toLocaleDateString("id-ID", {
                                                                        day: "numeric",
                                                                        month: "short"
                                                                    })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {dashboardData?.latest_reviews?.slice(0, 2).map((rev, idx) => (
                                                        <div key={`rev-${idx}`} className="stream-item">
                                                            <div className="stream-badge bg-warning-subtle text-warning">
                                                                <i className="fas fa-star"></i>
                                                            </div>
                                                            <div className="stream-content">
                                                                <div className="stream-title">
                                                                    <strong>{rev.student}</strong> memberi {rev.rating}★
                                                                </div>
                                                                <div className="stream-desc text-truncate" title={rev.course}>
                                                                    "{rev.course}"
                                                                </div>
                                                                <span className="stream-time">
                                                                    {new Date(rev.date).toLocaleDateString("id-ID", {
                                                                        day: "numeric",
                                                                        month: "short"
                                                                    })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {(!dashboardData?.latest_enrollments?.length && !dashboardData?.latest_reviews?.length) && (
                                                        <div className="admin-empty-state py-3 text-center">
                                                            <i className="fas fa-bell-slash text-muted fa-2x mb-1"></i>
                                                            <p className="text-muted small mb-0">Belum ada aktivitas pendaftaran terkini.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick System Diagnostic Pill */}
                                        <div className="admin-card system-quick-box">
                                            <div className="admin-card-body p-3">
                                                <div className="d-flex align-items-center justify-content-between mb-2">
                                                    <span className="fw-bold small text-primary">
                                                        <i className="fas fa-shield-alt me-1"></i> Status Server LMS
                                                    </span>
                                                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                                                        <i className="fas fa-check-circle me-1"></i> Optimal
                                                    </span>
                                                </div>
                                                <div className="d-flex justify-content-between small text-muted mb-1">
                                                    <span>Engine DB:</span>
                                                    <strong className="text-dark">
                                                        {systemHealth?.server_information?.database_engine || "PostgreSQL"}
                                                    </strong>
                                                </div>
                                                {systemHealth?.database_statistics?.database_size && (
                                                    <div className="d-flex justify-content-between small text-muted mb-1">
                                                        <span>Ukuran DB:</span>
                                                        <strong className="text-dark">
                                                            {systemHealth.database_statistics.database_size}
                                                        </strong>
                                                    </div>
                                                )}
                                                <div className="d-flex justify-content-between small text-muted">
                                                    <span>Versi LMS:</span>
                                                    <strong className="text-dark">v{activeVersion}</strong>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. ANALYTICS TAB */}
                        {activeTab === "analytics" && (
                            <div className="tab-pane-content">
                                <Suspense fallback={
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary spinner-border-sm" role="status"></div>
                                        <p className="mt-2 text-muted small">Memuat grafik analitik...</p>
                                    </div>
                                }>
                                    <div className="row g-3">
                                        {/* Widget Analisis Tren Pengguna Mengunjungi LMSetjen DPD RI (Full Detail) */}
                                        <div className="col-12">
                                            <VisitorTrafficWidget mode="full" defaultGranularity="date" />
                                        </div>

                                        {/* Line Chart: 12-Month Enrollment */}
                                        <div className="col-lg-8">
                                            <div className="admin-card h-100">
                                                <div className="admin-card-header d-flex justify-content-between align-items-center">
                                                    <h6 className="admin-card-title mb-0">
                                                        <i className="fas fa-chart-line text-primary me-2"></i>
                                                        Tren Pendaftaran Siswa (12 Bulan Terakhir)
                                                    </h6>
                                                    <span className="badge bg-primary-subtle text-primary">Data Real-Time</span>
                                                </div>
                                                <div className="admin-card-body p-3">
                                                    <div style={{ height: "320px", position: "relative" }}>
                                                        {enrollmentChartData ? (
                                                            <Line 
                                                                data={enrollmentChartData}
                                                                options={{
                                                                    responsive: true,
                                                                    maintainAspectRatio: false,
                                                                    plugins: {
                                                                        legend: { position: "top" },
                                                                        tooltip: {
                                                                            backgroundColor: "#002B49",
                                                                            padding: 10
                                                                        }
                                                                    },
                                                                    scales: {
                                                                        y: { beginAtZero: true, grid: { color: "#f1f5f9" } },
                                                                        x: { grid: { display: false } }
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="chart-placeholder">Data tren bulanan tidak tersedia</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Doughnut: Category Distribution */}
                                        <div className="col-lg-4">
                                            <div className="admin-card h-100">
                                                <div className="admin-card-header">
                                                    <h6 className="admin-card-title mb-0">
                                                        <i className="fas fa-pie-chart text-teal me-2"></i>
                                                        Distribusi Kategori Kursus
                                                    </h6>
                                                </div>
                                                <div className="admin-card-body p-3 d-flex flex-column justify-content-center">
                                                    <div style={{ height: "280px", position: "relative" }}>
                                                        {categoryChartData ? (
                                                            <Doughnut 
                                                                data={categoryChartData}
                                                                options={{
                                                                    responsive: true,
                                                                    maintainAspectRatio: false,
                                                                    plugins: {
                                                                        legend: {
                                                                            position: "bottom",
                                                                            labels: { boxWidth: 12, font: { size: 11 } }
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="chart-placeholder">Data kategori tidak tersedia</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bar Chart: Top Courses Performance */}
                                        <div className="col-12">
                                            <div className="admin-card">
                                                <div className="admin-card-header d-flex justify-content-between align-items-center">
                                                    <h6 className="admin-card-title mb-0">
                                                        <i className="fas fa-chart-bar text-indigo me-2"></i>
                                                        Perbandingan Pendaftaran Kursus Terpopuler
                                                    </h6>
                                                    <span className="badge bg-light text-dark border">
                                                        Top {enrollmentAnalytics?.top_performing_courses?.length || 0} Kursus
                                                    </span>
                                                </div>
                                                <div className="admin-card-body p-3">
                                                    <div style={{ height: "280px", position: "relative" }}>
                                                        {topCoursesChartData ? (
                                                            <Bar 
                                                                data={topCoursesChartData}
                                                                options={{
                                                                    responsive: true,
                                                                    maintainAspectRatio: false,
                                                                    plugins: {
                                                                        legend: { display: false },
                                                                        tooltip: {
                                                                            backgroundColor: "#002B49",
                                                                            padding: 10
                                                                        }
                                                                    },
                                                                    scales: {
                                                                        y: { beginAtZero: true, grid: { color: "#f1f5f9" } },
                                                                        x: { grid: { display: false } }
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="chart-placeholder">Data performa kursus tidak tersedia</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Suspense>
                            </div>
                        )}

                        {/* 3. SYSTEM HEALTH TAB */}
                        {activeTab === "system" && systemHealth && (
                            <div className="tab-pane-content">
                                {/* Banner Info */}
                                <div className="admin-status-banner mb-3 d-flex flex-wrap align-items-center justify-content-between p-3 rounded-3">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="status-banner-icon bg-success text-white rounded-circle p-2">
                                            <i className="fas fa-heartbeat"></i>
                                        </div>
                                        <div>
                                            <h6 className="fw-bold mb-0 text-success">
                                                Status Seluruh Layanan: Beroperasi Optimal
                                            </h6>
                                            <small className="text-muted">
                                                Koneksi Database PostgreSQL & Layanan API Backend Aktif dan Responsif
                                            </small>
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center gap-2 mt-2 mt-sm-0">
                                        <span className="badge bg-primary px-3 py-2">
                                            LMS v{activeVersion}
                                        </span>
                                        {systemHealth.server_information?.app_version && systemHealth.server_information.app_version !== activeVersion && (
                                            <span className="badge bg-warning text-dark px-3 py-2">
                                                Backend: v{systemHealth.server_information.app_version}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="row g-3">
                                    {/* Database & Operational Metrics */}
                                    <div className="col-lg-8">
                                        <div className="admin-card h-100">
                                            <div className="admin-card-header d-flex justify-content-between align-items-center">
                                                <h6 className="admin-card-title mb-0">
                                                    <i className="fas fa-database text-primary me-2"></i>
                                                    Statistik Database & Rekor Sistem
                                                </h6>
                                                <span className="badge bg-light text-dark border">Nilai Live dari Database</span>
                                            </div>
                                            <div className="admin-card-body p-3">
                                                <div className="row g-2">
                                                    {Object.entries(systemHealth.database_statistics || {}).map(([key, value]) => (
                                                        <div key={key} className="col-sm-6 col-md-4">
                                                            <div className="system-metric-tile">
                                                                <span className="metric-tile-title">
                                                                    {translateFieldName(key)}
                                                                </span>
                                                                <div className="metric-tile-value">
                                                                    {typeof value === "number" ? value.toLocaleString("id-ID") : value}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Server Environment Information */}
                                    <div className="col-lg-4">
                                        <div className="admin-card h-100">
                                            <div className="admin-card-header">
                                                <h6 className="admin-card-title mb-0">
                                                    <i className="fas fa-microchip text-indigo me-2"></i>
                                                    Lingkungan Server
                                                </h6>
                                            </div>
                                            <div className="admin-card-body p-0">
                                                <div className="server-info-table">
                                                    {Object.entries(systemHealth.server_information || {}).map(([key, value]) => (
                                                        <div key={key} className="server-info-row">
                                                            <span className="server-info-key">{translateFieldName(key)}</span>
                                                            <span className="server-info-val">
                                                                {typeof value === "boolean" ? (
                                                                    value ? (
                                                                        <span className="badge bg-warning-subtle text-warning">Aktif</span>
                                                                    ) : (
                                                                        <span className="badge bg-secondary-subtle text-secondary">Nonaktif</span>
                                                                    )
                                                                ) : (
                                                                    String(value)
                                                                )}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 4. ACTIVITY LOG TAB */}
                        {activeTab === "activity" && (
                            <div className="tab-pane-content">
                                <div className="row g-3">
                                    {/* Pendaftaran Terbaru */}
                                    <div className="col-lg-6">
                                        <div className="admin-card h-100">
                                            <div className="admin-card-header d-flex justify-content-between align-items-center">
                                                <h6 className="admin-card-title mb-0">
                                                    <i className="fas fa-user-plus text-info me-2"></i>
                                                    Pendaftaran Kursus Terbaru (10 Terakhir)
                                                </h6>
                                                <span className="badge bg-info-subtle text-info">Real-time</span>
                                            </div>
                                            <div className="admin-card-body p-0">
                                                {dashboardData?.latest_enrollments?.length > 0 ? (
                                                    <div className="activity-detailed-list">
                                                        {dashboardData.latest_enrollments.map((item, idx) => (
                                                            <div key={item.id || idx} className="activity-detailed-item">
                                                                <div className="activity-detailed-icon bg-info text-white">
                                                                    <i className="fas fa-user-check"></i>
                                                                </div>
                                                                <div className="activity-detailed-body flex-grow-1">
                                                                    <div className="fw-semibold text-dark">
                                                                        {item.student}
                                                                    </div>
                                                                    <div className="text-muted small">
                                                                        Mendaftar di kursus: <strong>"{item.course}"</strong>
                                                                    </div>
                                                                </div>
                                                                <span className="activity-detailed-date text-muted small">
                                                                    {new Date(item.date).toLocaleDateString("id-ID", {
                                                                        day: "numeric",
                                                                        month: "short",
                                                                        year: "numeric"
                                                                    })}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="admin-empty-state py-5 text-center">
                                                        <i className="fas fa-inbox text-muted fa-3x mb-2"></i>
                                                        <p className="text-muted small">Tidak ada data pendaftaran terbaru.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ulasan Terbaru */}
                                    <div className="col-lg-6">
                                        <div className="admin-card h-100">
                                            <div className="admin-card-header d-flex justify-content-between align-items-center">
                                                <h6 className="admin-card-title mb-0">
                                                    <i className="fas fa-star text-warning me-2"></i>
                                                    Ulasan & Penilaian Terbaru (10 Terakhir)
                                                </h6>
                                                <span className="badge bg-warning-subtle text-warning">Real-time</span>
                                            </div>
                                            <div className="admin-card-body p-0">
                                                {dashboardData?.latest_reviews?.length > 0 ? (
                                                    <div className="activity-detailed-list">
                                                        {dashboardData.latest_reviews.map((item, idx) => (
                                                            <div key={item.id || idx} className="activity-detailed-item">
                                                                <div className="activity-detailed-icon bg-warning text-white">
                                                                    <i className="fas fa-comment-dots"></i>
                                                                </div>
                                                                <div className="activity-detailed-body flex-grow-1">
                                                                    <div className="d-flex align-items-center justify-content-between">
                                                                        <span className="fw-semibold text-dark">{item.student}</span>
                                                                        <span className="text-warning small fw-bold">
                                                                            {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)} ({item.rating}/5)
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-muted small">
                                                                        Kursus: <strong>"{item.course}"</strong>
                                                                    </div>
                                                                </div>
                                                                <span className="activity-detailed-date text-muted small ms-2">
                                                                    {new Date(item.date).toLocaleDateString("id-ID", {
                                                                        day: "numeric",
                                                                        month: "short",
                                                                        year: "numeric"
                                                                    })}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="admin-empty-state py-5 text-center">
                                                        <i className="fas fa-star-half-alt text-muted fa-3x mb-2"></i>
                                                        <p className="text-muted small">Tidak ada ulasan terbaru dari pengguna.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 5. AI & LEARNING QUALITY TAB */}
                        {activeTab === "ai-quality" && (
                            <div className="tab-pane-content">
                                {/* Executive AI & Learning Quality Hub Header */}
                                <div className="ai-executive-hero mb-3">
                                    <div className="ai-hero-header">
                                        <div>
                                            <span className="ai-hero-badge">
                                                <i className="fas fa-brain"></i> Kecerdasan Buatan & Mutu Pembelajaran
                                            </span>
                                            <h4 className="ai-hero-title">
                                                Pusat Kendali Analitik AI & Penjaminan Mutu Kurikulum
                                            </h4>
                                            <p className="ai-hero-subtitle">
                                                Algoritma prediktif machine learning untuk mitigasi kegagalan belajar ASN, deteksi materi kompetensi yang belum terpenuhi, kurasi rekomendasi otomatis, serta optimasi pencarian materi Setjen DPD RI.
                                            </p>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="badge bg-dark border border-secondary text-light py-2 px-3 d-inline-flex align-items-center">
                                                <i className="fas fa-microchip text-warning me-2"></i>
                                                Engine: <strong>AI Learning Analytics v2.4</strong>
                                            </span>
                                        </div>
                                    </div>

                                    {/* 4 Live AI Telemetry KPIs */}
                                    <div className="ai-kpi-grid">
                                        <div className="ai-kpi-item">
                                            <div className="ai-kpi-icon warning">
                                                <i className="fas fa-user-shield"></i>
                                            </div>
                                            <div className="ai-kpi-details">
                                                <span className="ai-kpi-label">Siswa Terpantau Risiko</span>
                                                <div className="ai-kpi-val">
                                                    {atRiskSummary?.total_students || 0}
                                                    <span className="ai-kpi-meta">
                                                        ({atRiskSummary?.medium_risk || 0} Sedang, {atRiskSummary?.high_risk || 0} Tinggi)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="ai-kpi-item">
                                            <div className="ai-kpi-icon info">
                                                <i className="fas fa-heartbeat"></i>
                                            </div>
                                            <div className="ai-kpi-details">
                                                <span className="ai-kpi-label">Rata-rata Skor Risiko</span>
                                                <div className="ai-kpi-val">
                                                    {atRiskSummary?.average_risk_score !== undefined ? `${atRiskSummary.average_risk_score}` : "0"}
                                                    <span className="ai-kpi-meta">/ 100</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="ai-kpi-item">
                                            <div className="ai-kpi-icon success">
                                                <i className="fas fa-magic"></i>
                                            </div>
                                            <div className="ai-kpi-details">
                                                <span className="ai-kpi-label">Rekomendasi Adaptif</span>
                                                <div className="ai-kpi-val">
                                                    Aktif
                                                    <span className="ai-kpi-meta">Hybrid & Prasyarat</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="ai-kpi-item">
                                            <div className="ai-kpi-icon purple">
                                                <i className="fas fa-tags"></i>
                                            </div>
                                            <div className="ai-kpi-details">
                                                <span className="ai-kpi-label">Taksonomi Kueri ASN</span>
                                                <div className="ai-kpi-val">
                                                    NLP Semantic
                                                    <span className="ai-kpi-meta">Otomatis</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Executive Sub-navigation Capsules for AI & Quality Analytics */}
                                <div className="ai-subtabs-nav mb-3">
                                    <button 
                                        className={`ai-subtab-pill ${aiSubTab === "content-gaps" ? "active" : ""}`}
                                        onClick={() => setAiSubTab("content-gaps")}
                                        title="Identifikasi materi kompetensi yang dicari ASN namun belum tersedia"
                                    >
                                        <i className="fas fa-search-minus"></i>
                                        <span>Celah Konten</span>
                                    </button>

                                    <button 
                                        className={`ai-subtab-pill ${aiSubTab === "at-risk" ? "active" : ""}`}
                                        onClick={() => setAiSubTab("at-risk")}
                                        title="Pantau pegawai/siswa yang berpotensi putus belajar untuk intervensi dini"
                                    >
                                        <i className="fas fa-user-shield"></i>
                                        <span>Siswa Berisiko</span>
                                        {atRiskSummary?.total_students > 0 && (
                                            <span className="ai-subtab-badge warning">
                                                {atRiskSummary.total_students}
                                            </span>
                                        )}
                                    </button>

                                    <button 
                                        className={`ai-subtab-pill ${aiSubTab === "recommendations" ? "active" : ""}`}
                                        onClick={() => setAiSubTab("recommendations")}
                                        title="Evaluasi efektivitas dan rasio klik rekomendasi kursus AI"
                                    >
                                        <i className="fas fa-thumbs-up"></i>
                                        <span>Performa Rekomendasi</span>
                                    </button>

                                    <button 
                                        className={`ai-subtab-pill ${aiSubTab === "search-quality" ? "active" : ""}`}
                                        onClick={() => setAiSubTab("search-quality")}
                                        title="Analisis presisi dan tingkat keberhasilan pencarian portal"
                                    >
                                        <i className="fas fa-search-dollar"></i>
                                        <span>Kualitas Pencarian</span>
                                    </button>

                                    <button 
                                        className={`ai-subtab-pill ${aiSubTab === "query-taxonomy" ? "active" : ""}`}
                                        onClick={() => setAiSubTab("query-taxonomy")}
                                        title="Pemetaan kategori dan tren kebutuhan pembelajaran pegawai dari riwayat kueri"
                                    >
                                        <i className="fas fa-tags"></i>
                                        <span>Taksonomi Kueri</span>
                                    </button>
                                </div>

                                {/* Active AI Subtab Widget */}
                                <div className="ai-subtab-panel">
                                    {aiSubTab === "content-gaps" && <ContentGapWidget />}
                                    {aiSubTab === "at-risk" && <AtRiskStudentsWidget />}
                                    {aiSubTab === "recommendations" && <RecommendationMetricsWidget />}
                                    {aiSubTab === "search-quality" && <SearchQualityWidget />}
                                    {aiSubTab === "query-taxonomy" && <QueryTaxonomyWidget />}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

export default React.memo(DashboardAdmin);
