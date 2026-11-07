import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import ReviewAbuseReportsTab from "./AdminReportsTabs/ReviewAbuseReportsTab";
import QAReportsTab from "./AdminReportsTabs/QAReportsTab";
import FeedbackAdminDashboard from "../../components/Feedback/FeedbackAdminDashboard";
import SystemTestAdmin from "./SystemTestAdmin";
import SystemDocumentation from "./SystemDocumentation";
import apiInstance from "../../utils/axios";
import dayjs, { moment } from "../../utils/dayjs";
import "./ReportsAdmin.css";

/**
 * Unified Reports, Feedback & Diagnostics Admin Center
 * ✨ Merges Abuse Reports, Q&A Moderation, User Feedback, Diagnostics & System Docs
 * ✨ Redesigned for ultra-compact, zero-waste layout with 100% real live data
 */
function ReportsAdmin() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(() => {
        const tab = searchParams.get("tab");
        if (tab === "system-test" || tab === "diagnostics") return "diagnostics";
        if (tab === "documentation" || tab === "docs") return "docs";
        if (tab === "qa-reports") return "qa-reports";
        if (tab === "feedback" || tab === "user-feedback") return "feedback";
        return "abuse-reports";
    });

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(new Date());

    // Live counts across modules
    const [stats, setStats] = useState({
        abuseTotal: 0,
        abusePending: 0,
        qaTotal: 0,
        qaPending: 0,
        feedbackTotal: 0,
        feedbackOpen: 0,
        loading: true
    });

    // Fetch live summary counts across modules (only runs once on mount or when manually requested)
    const fetchSummaryStats = useCallback(async () => {
        try {
            setIsRefreshing(true);
            const [abuseRes, qaQRes, qaMRes, fbStatsRes] = await Promise.allSettled([
                apiInstance.get("/admin/abuse-reports/"),
                apiInstance.get("/admin/qa-reports/?type=question"),
                apiInstance.get("/admin/qa-reports/?type=message"),
                apiInstance.get("/feedback/stats/")
            ]);

            let abuseData = [];
            if (abuseRes.status === "fulfilled") {
                const d = abuseRes.value.data;
                abuseData = Array.isArray(d) ? d : (d?.results || []);
            }

            let qaQuestions = [];
            if (qaQRes.status === "fulfilled") {
                const d = qaQRes.value.data;
                qaQuestions = Array.isArray(d) ? d : (d?.results || []);
            }

            let qaMessages = [];
            if (qaMRes.status === "fulfilled") {
                const d = qaMRes.value.data;
                qaMessages = Array.isArray(d) ? d : (d?.results || []);
            }

            let fbStats = { total: 0, open: 0 };
            if (fbStatsRes.status === "fulfilled") {
                fbStats = fbStatsRes.value.data || { total: 0, open: 0 };
            }

            const allQA = [...qaQuestions, ...qaMessages];

            setStats({
                abuseTotal: abuseData.length,
                abusePending: abuseData.filter(r => r.status === "pending").length,
                qaTotal: allQA.length,
                qaPending: allQA.filter(r => r.status === "pending").length,
                feedbackTotal: fbStats.total || 0,
                feedbackOpen: fbStats.open || 0,
                loading: false
            });
            setLastSyncTime(new Date());
        } catch (error) {
            console.error("Error loading summary stats for reports:", error);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    // Initial mount only
    useEffect(() => {
        fetchSummaryStats();
    }, [fetchSummaryStats]);

    // Update URL query param when tab changes
    useEffect(() => {
        setSearchParams({ tab: activeTab });
    }, [activeTab, setSearchParams]);

    const handleManualRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
        fetchSummaryStats();
    };

    const handleMutationSuccess = () => {
        // Refetch summary badges when child updates a report
        fetchSummaryStats();
    };

    const tabs = [
        {
            id: "abuse-reports",
            label: "Laporan Ulasan",
            icon: "fas fa-flag",
            badge: stats.loading ? null : (
                <span className={`tab-badge ${stats.abusePending > 0 ? "tab-badge-pending" : "tab-badge-neutral"}`}>
                    {stats.abusePending > 0 ? `${stats.abusePending} Perlu Reviu` : stats.abuseTotal}
                </span>
            ),
            description: "Kelola laporan penyalahgunaan ulasan kursus dari instruktur dan pengguna",
            component: (
                <ReviewAbuseReportsTab
                    refreshTrigger={refreshTrigger}
                    onMutationSuccess={handleMutationSuccess}
                />
            )
        },
        {
            id: "qa-reports",
            label: "Laporan Diskusi Q&A",
            icon: "fas fa-comments",
            badge: stats.loading ? null : (
                <span className={`tab-badge ${stats.qaPending > 0 ? "tab-badge-pending" : "tab-badge-neutral"}`}>
                    {stats.qaPending > 0 ? `${stats.qaPending} Perlu Reviu` : stats.qaTotal}
                </span>
            ),
            description: "Kelola laporan pertanyaan dan balasan tidak pantas di forum tanya jawab",
            component: (
                <QAReportsTab
                    refreshTrigger={refreshTrigger}
                    onMutationSuccess={handleMutationSuccess}
                />
            )
        },
        {
            id: "feedback",
            label: "Masukan Pengguna",
            icon: "fas fa-envelope-open-text",
            badge: stats.loading ? null : (
                <span className={`tab-badge ${stats.feedbackOpen > 0 ? "tab-badge-pending" : "tab-badge-neutral"}`}>
                    {stats.feedbackOpen > 0 ? `${stats.feedbackOpen} Terbuka` : stats.feedbackTotal}
                </span>
            ),
            description: "Kelola laporan kendala sistem, bug, masukan, dan permintaan fitur dari seluruh pengguna platform",
            component: <FeedbackAdminDashboard />
        },
        {
            id: "diagnostics",
            label: "Pengujian Sistem",
            icon: "fas fa-vial",
            badge: <span className="tab-badge tab-badge-neutral">Diagnostik</span>,
            description: "Pusat pengujian antarmuka, verifikasi dialog toast, dan diagnostik server",
            component: <SystemTestAdmin isEmbedded={true} />
        },
        {
            id: "docs",
            label: "Dokumentasi Sistem",
            icon: "fas fa-book",
            badge: <span className="tab-badge tab-badge-neutral">Arsitektur</span>,
            description: "Dokumentasi teknis, arsitektur sistem, panduan API, dan skema basis data",
            component: <SystemDocumentation isEmbedded={true} />
        }
    ];

    return (
        <div className="admin-page-wrapper">
            <AdminHeader />

            <main className="admin-dashboard-container">
                <div className="container-fluid px-3 px-xl-4 footer-container">
                    <div className="reports-container">
                        {/* Compact Executive Page Header */}
                        <div className="reports-page-header mb-3">
                            <div className="header-left">
                                <div className="header-meta-pill mb-1">
                                    <i className="fas fa-shield-alt text-teal me-1.5"></i>
                                    <span>LMS Setjen DPD RI &bull; Moderasi, Masukan & Diagnostik Terpadu</span>
                                </div>
                                <h1 className="reports-page-title">
                                    <i className="fas fa-chart-line text-teal me-2"></i>
                                    Pusat Laporan & Diagnostik Sistem
                                </h1>
                                <p className="reports-page-subtitle">
                                    Audit terpadu moderasi konten, keluhan masukan pengguna, pengujian diagnostik, dan arsitektur sistem
                                </p>
                            </div>

                            <div className="header-right">
                                <div className="live-status-pill">
                                    <span className="live-dot pulse"></span>
                                    <div className="status-texts">
                                        <span className="status-label">API Backend: Terhubung</span>
                                        <span className="status-time">
                                            Diperbarui: {moment(lastSyncTime).format("HH:mm:ss WIB")}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-teal header-refresh-btn"
                                    onClick={handleManualRefresh}
                                    disabled={isRefreshing}
                                    title="Segarkan data laporan dari database"
                                >
                                    <i className={`fas fa-sync-alt me-1.5 ${isRefreshing ? "fa-spin" : ""}`}></i>
                                    Segarkan
                                </button>
                            </div>
                        </div>

                        {/* Unified Tabs & Content Box */}
                        <div className="reports-tabs-container">
                            {/* Sleek Segmented Tab Navigation */}
                            <div className="reports-tabs-header">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        className={`reports-tab-button ${activeTab === tab.id ? "active" : ""}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        <span className="reports-tab-icon">
                                            <i className={tab.icon}></i>
                                        </span>
                                        <span className="reports-tab-label">{tab.label}</span>
                                        {tab.badge}
                                    </button>
                                ))}
                            </div>

                            {/* Active Tab Sub-Bar / Context */}
                            <div className="reports-tab-context-bar">
                                <i className={`${tabs.find(t => t.id === activeTab)?.icon} text-teal me-2`}></i>
                                <span className="context-desc">
                                    {tabs.find(t => t.id === activeTab)?.description}
                                </span>
                            </div>

                            {/* Tab Content Panels */}
                            <div className="reports-tabs-content">
                                {tabs.map((tab) => (
                                    <div
                                        key={tab.id}
                                        className={`reports-tab-pane ${activeTab === tab.id ? "active" : ""}`}
                                    >
                                        {tab.component}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}

export default React.memo(ReportsAdmin);
