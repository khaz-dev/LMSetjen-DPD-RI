import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import ReviewAbuseReportsTab from "./AdminReportsTabs/ReviewAbuseReportsTab";
import QAReportsTab from "./AdminReportsTabs/QAReportsTab";
import ForumReportsTab from "./AdminReportsTabs/ForumReportsTab";
import CourseEvaluationReportsTab from "./AdminReportsTabs/CourseEvaluationReportsTab";
import ASNCompetencyAuditTab from "./AdminReportsTabs/ASNCompetencyAuditTab";
import FeedbackAdminDashboard from "../../components/Feedback/FeedbackAdminDashboard";
import apiInstance from "../../utils/axios";
import dayjs, { moment } from "../../utils/dayjs";
import "./ReportsAdmin.css";

/**
 * ✨ PHASE 4.210 / 11.3: Content Moderation & User Feedback Center
 * Dedicated to Community & Content Moderation:
 * 1. Course Review Abuse Reports
 * 2. Q&A Forum Abuse Reports
 * 3. User Feedback & Bug Ticket Tracker
 * (System Diagnostics and Technical Docs are now separated into /admin/system/)
 */
function ReportsAdmin() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState(() => {
        const tab = searchParams.get("tab");
        if (tab === "course-evaluations" || tab === "course-evaluation" || tab === "evaluasi" || tab === "courses") return "course-evaluations";
        if (tab === "forum-reports" || tab === "forum") return "forum-reports";
        if (tab === "qa-reports") return "qa-reports";
        if (tab === "feedback" || tab === "user-feedback") return "feedback";
        if (tab === "abuse-reports") return "abuse-reports";
        return "course-evaluations";
    });

    // Check if query is meant for System Diagnostics Center or sync tab
    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab === "system-test" || tab === "diagnostics") {
            navigate("/admin/system/?tab=diagnostics", { replace: true });
            return;
        }
        if (tab === "documentation" || tab === "docs") {
            navigate("/admin/system/?tab=docs", { replace: true });
            return;
        }

        if (tab === "course-evaluations" || tab === "course-evaluation" || tab === "evaluasi" || tab === "courses") {
            if (activeTab !== "course-evaluations") setActiveTab("course-evaluations");
        } else if (tab === "forum-reports" || tab === "forum") {
            if (activeTab !== "forum-reports") setActiveTab("forum-reports");
        } else if (tab === "feedback" || tab === "user-feedback") {
            if (activeTab !== "feedback") setActiveTab("feedback");
        } else if (tab === "qa-reports") {
            if (activeTab !== "qa-reports") setActiveTab("qa-reports");
        } else if (tab === "abuse-reports") {
            if (activeTab !== "abuse-reports") setActiveTab("abuse-reports");
        } else if (!tab) {
            setSearchParams({ tab: activeTab }, { replace: true });
        }
    }, [searchParams, navigate, activeTab, setSearchParams]);

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(new Date());

    // Live counts across moderation modules
    const [stats, setStats] = useState({
        coursesTotal: 0,
        abuseTotal: 0,
        abusePending: 0,
        qaTotal: 0,
        qaPending: 0,
        forumTotal: 0,
        forumPending: 0,
        feedbackTotal: 0,
        feedbackOpen: 0,
        loading: true
    });

    // Fetch live summary counts across modules (only runs once on mount or when manually requested)
    const fetchSummaryStats = useCallback(async () => {
        try {
            setIsRefreshing(true);
            const [abuseRes, qaQRes, qaMRes, forumRes, fbStatsRes, courseEvalRes] = await Promise.allSettled([
                apiInstance.get("/admin/abuse-reports/"),
                apiInstance.get("/admin/qa-reports/?type=question"),
                apiInstance.get("/admin/qa-reports/?type=message"),
                apiInstance.get("/admin/forum-reports/"),
                apiInstance.get("/feedback/stats/"),
                apiInstance.get("/admin/course-evaluations-summary/")
            ]);

            let coursesTotal = 0;
            if (courseEvalRes.status === "fulfilled" && courseEvalRes.value?.data?.stats) {
                coursesTotal = courseEvalRes.value.data.stats.total_courses || 0;
            }

            let abuseTotal = 0;
            let abusePending = 0;
            if (abuseRes.status === "fulfilled" && abuseRes.value?.data) {
                const list = abuseRes.value.data.results || abuseRes.value.data;
                if (Array.isArray(list)) {
                    abuseTotal = list.length;
                    abusePending = list.filter(r => r.status === "pending").length;
                }
            }

            let qaTotal = 0;
            let qaPending = 0;
            const qaQuestions = (qaQRes.status === "fulfilled" && Array.isArray(qaQRes.value?.data)) ? qaQRes.value.data : [];
            const qaMessages = (qaMRes.status === "fulfilled" && Array.isArray(qaMRes.value?.data)) ? qaMRes.value.data : [];
            const combinedQA = [...qaQuestions, ...qaMessages];
            qaTotal = combinedQA.length;
            qaPending = combinedQA.filter(r => r.status === "pending").length;

            let forumTotal = 0;
            let forumPending = 0;
            if (forumRes.status === "fulfilled" && forumRes.value?.data) {
                const list = forumRes.value.data.results || forumRes.value.data;
                if (Array.isArray(list)) {
                    forumTotal = list.length;
                    forumPending = list.filter(r => r.status === "pending").length;
                }
            }

            let feedbackTotal = 0;
            let feedbackOpen = 0;
            if (fbStatsRes.status === "fulfilled" && fbStatsRes.value?.data) {
                feedbackTotal = fbStatsRes.value.data.total_feedback || 0;
                feedbackOpen = fbStatsRes.value.data.open_count || 0;
            }

            setStats({
                coursesTotal,
                abuseTotal,
                abusePending,
                qaTotal,
                qaPending,
                forumTotal,
                forumPending,
                feedbackTotal,
                feedbackOpen,
                loading: false
            });
            setLastSyncTime(new Date());
        } catch (error) {
            console.error("Error fetching summary stats:", error);
            setStats(prev => ({ ...prev, loading: false }));
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    // Initial mount and explicit manual refresh
    useEffect(() => {
        fetchSummaryStats();
    }, [fetchSummaryStats, refreshTrigger]);

    // Tab selection handler ensuring state and query params stay synchronized
    const handleTabSelect = (tabId) => {
        setActiveTab(tabId);
        setSearchParams({ tab: tabId }, { replace: true });
    };

    // Manual refresh action
    const handleManualRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
        setLastSyncTime(new Date());
    };

    // Callback when any child tab mutates status
    const handleMutationSuccess = useCallback(() => {
        fetchSummaryStats();
    }, [fetchSummaryStats]);

    // Moderation & Evaluation Tabs definition
    const tabs = [
        {
            id: "course-evaluations",
            label: "Evaluasi Kursus",
            icon: "fas fa-chart-line",
            badge: stats.loading ? null : (
                <span className="tab-badge tab-badge-neutral">
                    {stats.coursesTotal > 0 ? `${stats.coursesTotal} Kursus` : "Semua"}
                </span>
            ),
            description: "Evaluasi mutu pembelajaran, rekapitulasi capaian ujian & JP, serta moderasi kursus Setjen DPD RI",
            component: (
                <CourseEvaluationReportsTab
                    refreshTrigger={refreshTrigger}
                    onMutationSuccess={handleMutationSuccess}
                />
            )
        },
        {
            id: "asn-audit",
            label: "Audit Kompetensi ASN (20 JP)",
            icon: "fas fa-award",
            badge: (
                <span className="tab-badge" style={{ backgroundColor: "rgba(13, 148, 136, 0.15)", color: "#0d9488", border: "1px solid rgba(13, 148, 136, 0.3)" }}>
                    Target 20 JP
                </span>
            ),
            description: "Audit kepatuhan pengembangan kompetensi tahunan ASN (minimal 20 JP per tahun sesuai UU No. 20/2023 Pasal 49 & Peraturan LAN RI)",
            component: (
                <ASNCompetencyAuditTab
                    refreshTrigger={refreshTrigger}
                />
            )
        },
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
            id: "forum-reports",
            label: "Forum Pembelajaran",
            icon: "fas fa-chalkboard-user",
            badge: stats.loading ? null : (
                <span className={`tab-badge ${stats.forumPending > 0 ? "tab-badge-pending" : "tab-badge-neutral"}`}>
                    {stats.forumPending > 0 ? `${stats.forumPending} Perlu Reviu` : stats.forumTotal}
                </span>
            ),
            description: "Kelola rumpun keahlian forum, moderasi laporan pelanggaran etika diskusi, dan audit seluruh topik Forum Pembelajaran",
            component: (
                <ForumReportsTab
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
            component: (
                <FeedbackAdminDashboard
                    refreshTrigger={refreshTrigger}
                    onMutationSuccess={handleMutationSuccess}
                />
            )
        }
    ];

    const totalPendingCount = stats.abusePending + stats.qaPending + stats.forumPending + stats.feedbackOpen;
    const currentTabObj = tabs.find(t => t.id === activeTab) || tabs[0];

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
                                    <i className="fas fa-shield-alt text-teal me-1"></i>
                                    <span>LMS Setjen DPD RI &bull; Pusat Moderasi Konten & Masukan Pengguna</span>
                                </div>
                                <h1 className="reports-page-title">
                                    <i className="fas fa-shield-alt text-teal me-2"></i>
                                    Pusat Moderasi & Aduan Pengguna
                                </h1>
                                <p className="reports-page-subtitle">
                                    Audit moderasi ulasan kursus, diskusi forum Q&A, dan penanganan tiket keluhan serta masukan pengguna
                                </p>
                            </div>

                            <div className="header-right">
                                <div className="live-status-pill">
                                    <span className={`live-dot ${totalPendingCount > 0 ? "pulse" : "bg-success"}`}></span>
                                    <div className="status-texts">
                                        <span className="status-label">
                                            {totalPendingCount > 0 ? `${totalPendingCount} Perlu Ditindaklanjuti` : "Semua Antrean Bersih"}
                                        </span>
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
                                    title="Segarkan data moderasi"
                                >
                                    <i className={`fas fa-sync-alt me-1 ${isRefreshing ? "fa-spin" : ""}`}></i>
                                    <span>{isRefreshing ? "Menyinkronkan..." : "Segarkan"}</span>
                                </button>
                            </div>
                        </div>

                        {/* Modern Compact Tab Bar */}
                        <div className="reports-tabs-wrapper">
                            <div className="reports-tabs-navigation" role="tablist">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === tab.id}
                                        className={`reports-tab-button ${activeTab === tab.id ? "active" : ""}`}
                                        onClick={() => handleTabSelect(tab.id)}
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
                                <i className={`${currentTabObj.icon} text-teal me-2`}></i>
                                <span className="context-desc">
                                    {currentTabObj.description}
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
