import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import BaseHeader from "../partials/BaseHeader";
import CourseReviewTab from "./ContentManagementTabs/CourseReviewTab";
import TestimonialTab from "./ContentManagementTabs/TestimonialTab";
import MaterialsTab from "./ContentManagementTabs/MaterialsTab";
import InstructorRequestsTab from "./ContentManagementTabs/InstructorRequestsTab";
import "./ContentManagementAdmin.css";

/**
 * Unified Content Management Admin Page
 * ✨ PHASE 4: Merged page for managing courses, testimonials, and course categories
 * ✨ PHASE 4.78: Added instructor request review
 * 
 * Combines four admin functions:
 * - Review and approve/reject courses
 * - Curate and manage testimonials
 * - Create/edit/delete course categories
 * - Review and approve/reject instructor requests
 */
function ContentManagementAdmin() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(() => {
        const tab = searchParams.get("tab");
        return tab === "testimonials" || tab === "materials" || tab === "requests" ? tab : "courses";
    });

    // Update URL when tab changes
    useEffect(() => {
        setSearchParams({ tab: activeTab });
    }, [activeTab, setSearchParams]);

    const tabs = [
        {
            id: "courses",
            label: "Review Kursus",
            icon: "fas fa-check-circle",
            description: "Tinjau dan setujui kursus yang diajukan instruktur",
            component: <CourseReviewTab />
        },
        {
            id: "testimonials",
            label: "Kurasi Testimoni",
            icon: "fas fa-comments",
            description: "Kelola dan setujui testimoni sebelum ditampilkan",
            component: <TestimonialTab />
        },
        {
            id: "materials",
            label: "Kelola Materi",
            icon: "fas fa-book-atlas",
            description: "Kelola kategori kursus dan organisasi konten",
            component: <MaterialsTab />
        },
        {
            id: "requests",
            label: "Permintaan Instruktur",
            icon: "fas fa-user-tie",
            description: "Tinjau dan setujui permintaan pengguna untuk menjadi instruktur",
            component: <InstructorRequestsTab />
        }
    ];

    return (
        <>
            <BaseHeader />
            <section className="admin-dashboard pt-5 pb-5">
                <div className="container">
                    <AdminHeader />
                    
                    <div className="content-management-container">
                        {/* Page Header */}
                        <div className="cm-page-header mb-5">
                            <div className="cm-header-content">
                                <h1 className="cm-page-title">
                                    <i className="fas fa-cogs me-3"></i>
                                    Manajemen Konten
                                </h1>
                                <p className="cm-page-subtitle">
                                    Kelola seluruh konten platform: kursus, testimoni, kategori materi, dan permintaan instruktur
                                </p>
                            </div>
                        </div>

                        {/* Tab Navigation */}
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
                                    </button>
                                ))}
                            </div>

                            {/* Tab Description */}
                            <div className="cm-tab-description">
                                <div className="cm-description-box">
                                    <i className={`${tabs.find(t => t.id === activeTab)?.icon} me-2`}></i>
                                    {tabs.find(t => t.id === activeTab)?.description}
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
