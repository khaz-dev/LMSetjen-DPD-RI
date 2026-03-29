import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import BaseHeader from "../partials/BaseHeader";
import ReviewAbuseReportsTab from "./AdminReportsTabs/ReviewAbuseReportsTab";
import QAReportsTab from "./AdminReportsTabs/QAReportsTab";  // ✨ PHASE 7.16: Import Q&A Reports Tab
import "./ReportsAdmin.css";

/**
 * Unified Reports Admin Page
 * ✨ PHASE 4.210: Integrated reporting dashboard
 * 
 * Combines multiple reporting functions:
 * - Review and manage review abuse reports from instructors
 */
function ReportsAdmin() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(() => {
        const tab = searchParams.get("tab");
        return tab === "abuse-reports" ? tab : "abuse-reports";
    });

    // Update URL when tab changes
    useEffect(() => {
        setSearchParams({ tab: activeTab });
    }, [activeTab, setSearchParams]);

    const tabs = [
        {
            id: "abuse-reports",
            label: "Laporan Penyalahgunaan Review",
            icon: "fas fa-flag",
            description: "Kelola laporan penyalahgunaan review yang dikirim oleh instruktur",
            component: <ReviewAbuseReportsTab />
        },
        {
            id: "qa-reports",  // ✨ PHASE 7.16: Q&A Reports tab
            label: "Laporan Pertanyaan & Balasan",
            icon: "fas fa-comments",
            description: "Kelola laporan pertanyaan dan balasan yang tidak pantas di forum diskusi",
            component: <QAReportsTab />
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
                                    <i className="fas fa-file-alt me-3"></i>
                                    Laporan Pengguna
                                </h1>
                                <p className="reports-page-subtitle">
                                    Kelola semua laporan dan masalah yang dilaporkan pengguna
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
