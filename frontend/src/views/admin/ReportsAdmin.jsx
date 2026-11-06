import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import BaseHeader from "../partials/BaseHeader";
import ReviewAbuseReportsTab from "./AdminReportsTabs/ReviewAbuseReportsTab";
import QAReportsTab from "./AdminReportsTabs/QAReportsTab";
import SystemTestAdmin from "./SystemTestAdmin";
import SystemDocumentation from "./SystemDocumentation";
import "./ReportsAdmin.css";

/**
 * Unified Reports, Diagnostics & Documentation Admin Center
 * ✨ Merges System Reports, System Testing/Diagnostics, and Technical Documentation
 */
function ReportsAdmin() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(() => {
        const tab = searchParams.get("tab");
        if (tab === "system-test" || tab === "diagnostics") return "diagnostics";
        if (tab === "documentation" || tab === "docs") return "docs";
        if (tab === "qa-reports") return "qa-reports";
        return "abuse-reports";
    });

    // Update URL when tab changes
    useEffect(() => {
        setSearchParams({ tab: activeTab });
    }, [activeTab, setSearchParams]);

    const tabs = [
        {
            id: "abuse-reports",
            label: "Laporan Review",
            icon: "fas fa-flag",
            description: "Kelola laporan penyalahgunaan ulasan kursus dari instruktur",
            component: <ReviewAbuseReportsTab />
        },
        {
            id: "qa-reports",
            label: "Laporan Diskusi Q&A",
            icon: "fas fa-comments",
            description: "Kelola laporan pertanyaan dan balasan tidak pantas di forum tanya jawab",
            component: <QAReportsTab />
        },
        {
            id: "diagnostics",
            label: "Pengujian Sistem",
            icon: "fas fa-vial",
            description: "Pusat pengujian antarmuka, verifikasi dialog toast, dan diagnostik server",
            component: <SystemTestAdmin isEmbedded={true} />
        },
        {
            id: "docs",
            label: "Dokumentasi Sistem",
            icon: "fas fa-book",
            description: "Dokumentasi teknis, arsitektur sistem, panduan API, dan skema basis data",
            component: <SystemDocumentation isEmbedded={true} />
        }
    ];

    return (
        <>
            <BaseHeader />
            <section className="admin-dashboard pt-4 pb-5">
                <div className="container">
                    <AdminHeader />
                    
                    <div className="reports-container">
                        {/* Page Header */}
                        <div className="reports-page-header mb-3">
                            <div className="reports-header-content">
                                <h1 className="reports-page-title">
                                    <i className="fas fa-chart-line me-3"></i>
                                    Pusat Laporan & Diagnostik Sistem
                                </h1>
                                <p className="reports-page-subtitle">
                                    Pusat audit terpadu: moderasi laporan pengguna, pengujian diagnostik antarmuka, dan dokumentasi arsitektur sistem
                                </p>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div className="reports-tabs-container">
                            <div className="reports-tabs-header">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        className={`reports-tab-button ${activeTab === tab.id ? "active" : ""}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        <span className="reports-tab-icon">
                                            <i className={tab.icon}></i>
                                        </span>
                                        <span className="reports-tab-label">{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Tab Description */}
                            <div className="reports-tab-description">
                                <div className="reports-description-box">
                                    <i className={`${tabs.find(t => t.id === activeTab)?.icon} me-2`}></i>
                                    {tabs.find(t => t.id === activeTab)?.description}
                                </div>
                            </div>

                            {/* Tab Content */}
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
            </section>
            <Footer />
        </>
    );
}

export default React.memo(ReportsAdmin);
