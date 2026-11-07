import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import SystemDocumentation from "./SystemDocumentation";
import SystemTestAdmin from "./SystemTestAdmin";
import apiInstance from "../../utils/axios";
import dayjs, { moment } from "../../utils/dayjs";
import "./SystemAdmin.css";

/**
 * ✨ PHASE 4.210 / 11.3: Unified System Diagnostics & Technical Architecture Center
 * Dedicated console for Super Admin & IT team: System Documentation, API Specs,
 * Live Database Schemas, and System Diagnostics / UI Playground.
 */
function SystemAdmin() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(() => {
        const tab = searchParams.get("tab");
        if (tab === "diagnostics" || tab === "system-test" || tab === "test") return "diagnostics";
        return "docs";
    });

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(new Date());
    const [systemHealth, setSystemHealth] = useState(null);

    // Fetch system health telemetry
    const fetchHealthStats = useCallback(async () => {
        try {
            setIsRefreshing(true);
            const res = await apiInstance.get("/admin/system-health/");
            if (res.data) {
                setSystemHealth(res.data);
                setLastSyncTime(new Date());
            }
        } catch (err) {
            console.warn("Notice: System health telemetry fetch:", err?.message || err);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchHealthStats();
    }, [fetchHealthStats, refreshTrigger]);

    // Keep URL search params in sync with active tab
    useEffect(() => {
        const currentParam = searchParams.get("tab");
        if (currentParam !== activeTab) {
            setSearchParams({ tab: activeTab }, { replace: true });
        }
    }, [activeTab, searchParams, setSearchParams]);

    const handleManualRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
        setLastSyncTime(new Date());
    };

    const serverInfo = systemHealth?.server_information || {};
    const isHealthy = systemHealth?.system_status === "healthy" || !systemHealth?.error;

    // Tabs definition
    const tabs = [
        {
            id: "docs",
            label: "Dokumentasi & Arsitektur",
            icon: "fas fa-book",
            badge: <span className="tab-badge tab-badge-neutral">Arsitektur & API</span>,
            description: "Panduan teknis komprehensif, arsitektur sistem, spesifikasi API RESTful, dan skema basis data PostgreSQL",
            component: (
                <SystemDocumentation
                    isEmbedded={true}
                    refreshTrigger={refreshTrigger}
                />
            )
        },
        {
            id: "diagnostics",
            label: "Pengujian & Diagnostik Sistem",
            icon: "fas fa-vial",
            badge: <span className="tab-badge tab-badge-neutral">Playground & Uji</span>,
            description: "Pusat verifikasi dialog toast, latency server, dan pengujian komponen antarmuka sistem",
            component: (
                <SystemTestAdmin
                    isEmbedded={true}
                    refreshTrigger={refreshTrigger}
                />
            )
        }
    ];

    return (
        <div className="admin-page-wrapper">
            <AdminHeader />

            <main className="admin-dashboard-container">
                <div className="container-fluid px-3 px-xl-4 footer-container">
                    <div className="system-admin-container">
                        {/* Compact Executive Page Header */}
                        <div className="system-page-header mb-3">
                            <div className="header-left">
                                <div className="header-meta-pill mb-1">
                                    <i className="fas fa-server text-teal me-1"></i>
                                    <span>LMS Setjen DPD RI &bull; Konsol Diagnostik & Arsitektur Sistem</span>
                                </div>
                                <h1 className="system-page-title">
                                    <i className="fas fa-cogs text-teal me-2"></i>
                                    Pusat Diagnostik & Arsitektur Sistem
                                </h1>
                                <p className="system-page-subtitle">
                                    Konsol teknis infrastruktur, telemetri kesehatan server, pengujian antarmuka, dan dokumentasi arsitektur platform
                                </p>
                            </div>

                            <div className="header-right">
                                <div className="live-status-pill">
                                    <span className={`live-dot ${isHealthy ? "pulse" : "bg-warning"}`}></span>
                                    <div className="status-texts">
                                        <span className="status-label">
                                            {isHealthy ? "Sistem: Beroperasi Normal" : "Sistem: Perlu Pemeriksaan"}
                                        </span>
                                        <span className="status-time">
                                            Django {serverInfo.django_version ? `v${serverInfo.django_version}` : "4.2"} &bull; {moment(lastSyncTime).format("HH:mm:ss WIB")}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-teal header-refresh-btn"
                                    onClick={handleManualRefresh}
                                    disabled={isRefreshing}
                                    title="Segarkan data telemetri sistem"
                                >
                                    <i className={`fas fa-sync-alt me-1 ${isRefreshing ? "fa-spin" : ""}`}></i>
                                    <span>{isRefreshing ? "Menyinkronkan..." : "Segarkan"}</span>
                                </button>
                            </div>
                        </div>

                        {/* Modern Compact Tab Bar */}
                        <div className="system-tabs-wrapper">
                            <div className="system-tabs-navigation" role="tablist">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === tab.id}
                                        className={`system-tab-button ${activeTab === tab.id ? "active" : ""}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        <span className="system-tab-icon">
                                            <i className={tab.icon}></i>
                                        </span>
                                        <span className="system-tab-label">{tab.label}</span>
                                        {tab.badge}
                                    </button>
                                ))}
                            </div>

                            {/* Active Tab Sub-Bar / Context */}
                            <div className="system-tab-context-bar">
                                <i className={`${tabs.find(t => t.id === activeTab)?.icon} text-teal me-2`}></i>
                                <span className="context-desc">
                                    {tabs.find(t => t.id === activeTab)?.description}
                                </span>
                            </div>

                            {/* Tab Content Panels */}
                            <div className="system-tabs-content">
                                {tabs.map((tab) => (
                                    <div
                                        key={tab.id}
                                        className={`system-tab-pane ${activeTab === tab.id ? "active" : ""}`}
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

export default React.memo(SystemAdmin);

