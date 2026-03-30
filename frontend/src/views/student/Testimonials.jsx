import React, { useState, useEffect } from "react";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import TestimonialSubmitForm from "../../components/TestimonialSubmitForm";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
// ✨ PHASE 11.12: Import caching hook for seamless navigation
import { usePageCache } from "../../utils/usePageCache";
import "./Testimonials.css";

function Testimonials() {
    const [testimonials, setTestimonials] = useState([]);
    const isCollapsed = useSidebarCollapse();

    const fetchTestimonials = async () => {
        const res = await useAxios
            .get("student/testimonials/list/?role=student");  // ✨ PHASE 4.13: Fetch user's own testimonials with status
        return res.data?.results || [];
    };

    // ✨ PHASE 11.12: Use page cache to avoid reloading when navigating
    const { data: cachedTestimonials, loading: fetching, refetch } = usePageCache(
        'student-testimonials',
        fetchTestimonials,
        {
            showLoadingOnStale: false
        }
    );

    // Sync cached data to state
    useEffect(() => {
        if (cachedTestimonials) {
            setTestimonials(cachedTestimonials);
        }
    }, [cachedTestimonials]);

    const handleTestimonialSubmitSuccess = () => {
        // Refresh testimonials after successful submission
        refetch();
    };

    if (fetching) {
        return (
            <>
                <BaseHeader />
                <section className="student-testimonials-page" style={{ minHeight: "calc(100vh - 120px)" }}>
                    <div className="container">
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Memuat Testimoni...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    return (
        <>
            <BaseHeader />
            <section className="student-testimonials-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0 md-4">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Page Header */}
                            <div className="modern-header-section mb-4" style={{
                                background: "rgba(255, 255, 255, 0.95)",
                                backdropFilter: "blur(10px)",
                                borderRadius: "20px",
                                padding: "20px 20px",
                                border: "1px solid rgba(255, 255, 255, 0.2)",
                                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                                position: "relative",
                                overflow: "hidden"
                            }}>
                                <div style={{
                                    position: "absolute",
                                    top: "-50%",
                                    right: "-15%",
                                    width: "300px",
                                    height: "300px",
                                    background: "linear-gradient(45deg, #0d948820, #0f766e20)",
                                    borderRadius: "50%",
                                    zIndex: 1,
                                    pointerEvents: "none"
                                }}></div>
                                <div className="d-flex align-items-center justify-content-between position-relative" style={{ zIndex: 2 }}>
                                    <div>
                                        <h1 className="mb-2" style={{
                                            background: "linear-gradient(135deg, #0d9488, #0f766e)",
                                            WebkitBackgroundClip: "text",
                                            WebkitTextFillColor: "transparent",
                                            fontSize: "2.5rem",
                                            fontWeight: "bold"
                                        }}>
                                            <i className="fas fa-quote-left me-3"></i>Testimoni Platform
                                        </h1>
                                        <p className="mb-0 text-muted" style={{ fontSize: "1.1rem" }}>
                                            Bagikan pengalaman belajar anda dalam platform ini.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Testimonial Submission Form */}
                            <div className="card mb-5" style={{
                                borderRadius: "15px",
                                border: "1px solid rgba(102, 126, 234, 0.2)",
                                boxShadow: "0 4px 15px rgba(102, 126, 234, 0.1)"
                            }}>
                                <div className="card-body p-4">
                                    {/* ✨ PHASE 4.14: Show status of latest testimonial inside form card */}
                                    {testimonials && testimonials.length > 0 && (
                                        <div style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid #e9ecef" }}>
                                            <h5 style={{
                                                marginBottom: "1rem",
                                                color: "#0d9488",
                                                fontSize: "1rem",
                                                fontWeight: "600"
                                            }}>
                                                <i className="fas fa-check-double me-2"></i>Status Testimoni Anda
                                            </h5>

                                            {testimonials[0].status === 'approved' ? (
                                                <div style={{
                                                    padding: "1rem",
                                                    backgroundColor: "#d4edda",
                                                    border: "1px solid #c3e6cb",
                                                    borderRadius: "8px",
                                                    color: "#155724"
                                                }}>
                                                    <i className="fas fa-check-circle me-2" style={{ fontSize: "1.1rem" }}></i>
                                                    <strong>Testimoni Anda Telah Disetujui!</strong>
                                                    <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9rem" }}>
                                                        Terima kasih, testimoni Anda akan ditampilkan di halaman utama.
                                                    </p>
                                                </div>
                                            ) : testimonials[0].status === 'pending' ? (
                                                <div style={{
                                                    padding: "1rem",
                                                    backgroundColor: "#d1ecf1",
                                                    border: "1px solid #bee5eb",
                                                    borderRadius: "8px",
                                                    color: "#0c5460"
                                                }}>
                                                    <i className="fas fa-clock me-2" style={{ fontSize: "1.1rem" }}></i>
                                                    <strong>Testimoni Menunggu Persetujuan</strong>
                                                    <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9rem" }}>
                                                        Testimoni Anda sedang ditinjau oleh admin. Terima kasih atas kesabaran Anda.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div style={{
                                                        padding: "1rem",
                                                        backgroundColor: "#f8d7da",
                                                        border: "1px solid #f5c6cb",
                                                        borderRadius: "8px",
                                                        color: "#721c24",
                                                        marginBottom: "1rem"
                                                    }}>
                                                        <i className="fas fa-times-circle me-2" style={{ fontSize: "1.1rem" }}></i>
                                                        <strong>Testimoni Anda Ditolak</strong>
                                                    </div>

                                                    {testimonials[0].rejection_reason && (
                                                        <div style={{
                                                            padding: "1rem",
                                                            backgroundColor: "#fff3cd",
                                                            border: "1px solid #ffeeba",
                                                            borderLeft: "4px solid #ffc107",
                                                            borderRadius: "8px",
                                                            color: "#856404"
                                                        }}>
                                                            <i className="fas fa-exclamation-triangle me-2"></i>
                                                            <strong>Alasan Penolakan:</strong>
                                                            <p style={{ margin: "0.75rem 0 0 0", lineHeight: "1.5" }}>
                                                                {testimonials[0].rejection_reason}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <h4 className="card-title mb-3" style={{
                                        background: "linear-gradient(135deg, #0d9488, #0f766e)",
                                        WebkitBackgroundClip: "text",
                                        WebkitTextFillColor: "transparent"
                                    }}>
                                        <i className="fas fa-pen-fancy me-2"></i>Bagikan Testimoni Anda
                                    </h4>
                                    <p className="card-text text-muted mb-3">
                                        Ceritakan pengalaman dan pembelajaran Anda sebagai siswa di platform kami
                                    </p>
                                    {/* ✨ PHASE 4.11: Pass role='student' to form */}
                                    <TestimonialSubmitForm onSuccess={handleTestimonialSubmitSuccess} role="student" />
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </>
    );
}

export default React.memo(Testimonials);
