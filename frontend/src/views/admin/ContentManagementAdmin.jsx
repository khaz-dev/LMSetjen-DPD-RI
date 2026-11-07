import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import BaseHeader from "../partials/BaseHeader";
import CourseReviewTab from "./ContentManagementTabs/CourseReviewTab";
import TestimonialTab from "./ContentManagementTabs/TestimonialTab";
import MaterialsTab from "./ContentManagementTabs/MaterialsTab";
import InstructorRequestsTab from "./ContentManagementTabs/InstructorRequestsTab";
import CertificateDesignTab from "./ContentManagementTabs/CertificateDesignTab";
import apiInstance from "../../utils/axios";
import "./ContentManagementAdmin.css";

/**
 * Unified Content Management Admin Page (Redesigned Compact & Live)
 * Setjen DPD RI Learning Platform
 */
function ContentManagementAdmin() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(() => {
        const tab = searchParams.get("tab");
        return tab === "testimonials" || tab === "materials" || tab === "requests" || tab === "certificate" ? tab : "courses";
    });

    // Real live counts from backend for tab badges & header chips
    const [liveMetrics, setLiveMetrics] = useState({
        coursesReview: 0,
        testimonialsPending: 0,
        categoriesCount: 0,
        requestsPending: 0,
        loading: true,
    });
    const [refreshSignal, setRefreshSignal] = useState(0);

    // Update URL when tab changes
    useEffect(() => {
        setSearchParams({ tab: activeTab });
    }, [activeTab, setSearchParams]);

    // Fetch real live metrics across content management modules
    const fetchLiveMetrics = useCallback(async () => {
        setLiveMetrics(prev => ({ ...prev, loading: true }));
        try {
            const [coursesRes, testimonialsRes, categoriesRes, requestsRes] = await Promise.allSettled([
                apiInstance.get("/admin/courses-pending-review/?status=Review"),
                apiInstance.get("/admin/testimonials/pending/"),
                apiInstance.get("admin/category/"),
                apiInstance.get("/admin/instructor-requests/?status=PENDING")
            ]);

            // Real count for courses pending review
            let coursesCount = 0;
            if (coursesRes.status === "fulfilled" && coursesRes.value?.data) {
                const data = coursesRes.value.data;
                if (data.stats && typeof data.stats.review === "number") {
                    coursesCount = data.stats.review;
                } else if (Array.isArray(data)) {
                    coursesCount = data.length;
                } else if (data.results) {
                    coursesCount = data.results.length;
                }
            }

            // Real count for testimonials pending
            let testimonialsCount = 0;
            if (testimonialsRes.status === "fulfilled" && testimonialsRes.value?.data) {
                const data = testimonialsRes.value.data;
                testimonialsCount = Array.isArray(data) ? data.length : (data.results?.length || 0);
            }

            // Real count for course categories
            let categoriesTotal = 0;
            if (categoriesRes.status === "fulfilled" && categoriesRes.value?.data) {
                const data = categoriesRes.value.data;
                categoriesTotal = Array.isArray(data) ? data.length : (data.results?.length || 0);
            }

            // Real count for instructor requests pending
            let requestsCount = 0;
            if (requestsRes.status === "fulfilled" && requestsRes.value?.data) {
                const data = requestsRes.value.data;
                requestsCount = Array.isArray(data) ? data.length : (data.results?.length || 0);
            }

            setLiveMetrics({
                coursesReview: coursesCount,
                testimonialsPending: testimonialsCount,
                categoriesCount: categoriesTotal,
                requestsPending: requestsCount,
                loading: false,
            });
        } catch (error) {
            console.error("[ContentManagementAdmin] Error fetching live metrics:", error);
            setLiveMetrics(prev => ({ ...prev, loading: false }));
        }
    }, []);

    useEffect(() => {
        fetchLiveMetrics();
    }, [fetchLiveMetrics, refreshSignal]);

    const handleTriggerRefresh = () => {
        setRefreshSignal(prev => prev + 1);
    };

    const tabs = [
        {
            id: "courses",
            label: "Review Kursus",
            icon: "fas fa-check-circle",
            badge: liveMetrics.coursesReview,
            badgeType: liveMetrics.coursesReview > 0 ? "has-pending" : "normal",
            description: "Tinjau, evaluasi, dan setujui kursus yang diajukan oleh instruktur",
            component: <CourseReviewTab onCountsUpdated={handleTriggerRefresh} refreshSignal={refreshSignal} />
        },
        {
            id: "testimonials",
            label: "Kurasi Testimoni",
            icon: "fas fa-comments",
            badge: liveMetrics.testimonialsPending,
            badgeType: liveMetrics.testimonialsPending > 0 ? "has-pending" : "normal",
            description: "Kelola, moderasi, dan setujui ulasan testimoni peserta pembelajaran",
            component: <TestimonialTab />
        },
        {
            id: "materials",
            label: "Kelola Materi",
            icon: "fas fa-book-atlas",
            badge: liveMetrics.categoriesCount,
            badgeType: "normal",
            description: "Kelola taksonomi kategori materi, tag, dan struktur kurikulum kursus",
            component: <MaterialsTab />
        },
        {
            id: "requests",
            label: "Permintaan Instruktur",
            icon: "fas fa-user-tie",
            badge: liveMetrics.requestsPending,
            badgeType: liveMetrics.requestsPending > 0 ? "has-pending" : "normal",
            description: "Tinjau dan setujui permohonan pegawai untuk menjadi instruktur resmi",
            component: <InstructorRequestsTab />
        },
        {
            id: "certificate",
            label: "Desain Sertifikat",
            icon: "fas fa-award",
            badge: null,
            badgeType: "normal",
            description: "Studio template PPTX, background kustom, tipografi, dan variabel sertifikat",
            component: <CertificateDesignTab />
        }
    ];

    const currentTabInfo = tabs.find(t => t.id === activeTab) || tabs[0];

    return (
        <>
            <BaseHeader />
            <section className="admin-dashboard pt-3 pb-4">
                <div className="container">
                    <AdminHeader />
                    
                    <div className="content-management-container">
                        {/* Compact Executive Page Header */}
                        <div className="cm-page-header mb-3">
                            <div className="cm-header-content">
                                <div className="cm-header-left">
                                    <div className="cm-header-badge-row">
                                        <span className="cm-inst-tag">
                                            <i className="fas fa-shield-alt me-1"></i>
                                            Setjen DPD RI
                                        </span>
                                        <span className="text-white-50 small">| Tata Kelola Pembelajaran</span>
                                    </div>
                                    <h1 className="cm-page-title">
                                        <i className="fas fa-sliders-h"></i>
                                        Manajemen Konten
                                    </h1>
                                    <p className="cm-page-subtitle">
                                        Pusat peninjauan kurikulum kursus, kurasi ulasan, taksonomi materi, dan penerbitan sertifikat
                                    </p>
                                </div>

                                {/* Live Metrics Quick Chips */}
                                <div className="cm-header-chips">
                                    <div 
                                        className={`cm-header-chip ${liveMetrics.coursesReview > 0 ? 'chip-pending' : ''}`}
                                        title={`${liveMetrics.coursesReview} kursus sedang menunggu peninjauan`}
                                    >
                                        <i className="fas fa-book-reader"></i>
                                        <span className="chip-label">Review:</span>
                                        <span className="chip-val">{liveMetrics.coursesReview}</span>
                                    </div>

                                    <div 
                                        className={`cm-header-chip ${liveMetrics.testimonialsPending > 0 ? 'chip-pending' : ''}`}
                                        title={`${liveMetrics.testimonialsPending} testimoni menunggu moderasi`}
                                    >
                                        <i className="fas fa-comment-dots"></i>
                                        <span className="chip-label">Testimoni:</span>
                                        <span className="chip-val">{liveMetrics.testimonialsPending}</span>
                                    </div>

                                    <div 
                                        className={`cm-header-chip ${liveMetrics.requestsPending > 0 ? 'chip-pending' : ''}`}
                                        title={`${liveMetrics.requestsPending} permohonan instruktur menunggu persetujuan`}
                                    >
                                        <i className="fas fa-user-clock"></i>
                                        <span className="chip-label">Permintaan:</span>
                                        <span className="chip-val">{liveMetrics.requestsPending}</span>
                                    </div>

                                    <div 
                                        className="cm-header-chip"
                                        title={`${liveMetrics.categoriesCount} kategori materi aktif`}
                                    >
                                        <i className="fas fa-folder"></i>
                                        <span className="chip-label">Kategori:</span>
                                        <span className="chip-val">{liveMetrics.categoriesCount}</span>
                                    </div>

                                    <button 
                                        className="cm-refresh-btn ms-1"
                                        onClick={handleTriggerRefresh}
                                        title="Muat ulang seluruh data metrik real-time"
                                        disabled={liveMetrics.loading}
                                    >
                                        <i className={`fas fa-sync-alt ${liveMetrics.loading ? 'fa-spin' : ''}`}></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tab Navigation with Real Live Badges */}
                        <div className="cm-tabs-container">
                            <div className="cm-tabs-header">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        className={`cm-tab-button ${activeTab === tab.id ? "active" : ""}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        <span className="cm-tab-icon">
                                            <i className={tab.icon}></i>
                                        </span>
                                        <span className="cm-tab-label">{tab.label}</span>
                                        {tab.badge !== null && (
                                            <span className={`cm-tab-pill-badge ${tab.badgeType === "has-pending" ? "has-pending" : ""}`}>
                                                {tab.badge}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Compact Tab Subline */}
                            <div className="cm-tab-description">
                                <div className="cm-description-box">
                                    <i className={`${currentTabInfo.icon} me-1`}></i>
                                    <span>{currentTabInfo.description}</span>
                                </div>
                                <div className="text-muted small">
                                    <i className="fas fa-bolt text-teal me-1"></i>
                                    <span>Sinkronisasi Realtime</span>
                                </div>
                            </div>

                            {/* Tab Content */}
                            <div className="cm-tabs-content">
                                {tabs.map((tab) => (
                                    <div
                                        key={tab.id}
                                        className={`cm-tab-pane ${activeTab === tab.id ? "active" : ""}`}
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

export default React.memo(ContentManagementAdmin);
