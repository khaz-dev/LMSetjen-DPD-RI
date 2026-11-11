import React, { useState, useEffect, useCallback, useContext } from "react";
import { Link } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import TestimonialSubmitForm from "../../components/TestimonialSubmitForm";
import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { ProfileContext } from "../plugin/Context";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
import { usePageCache } from "../../utils/usePageCache";
import { getValidProfileImageUrl } from "../../utils/imageUtils";
import "./Testimonials.css";

// Helper to safely extract string position/jabatan from profile object
const extractPosition = (p) => {
    if (!p) return "";
    if (typeof p.position_name === "string" && p.position_name.trim()) {
        return p.position_name.trim();
    }
    if (p.position && typeof p.position === "object" && typeof p.position.name === "string" && p.position.name.trim()) {
        return p.position.name.trim();
    }
    if (typeof p.position === "string" && p.position.trim()) {
        return p.position.trim();
    }
    if (typeof p.kelas_jabatan === "string" && p.kelas_jabatan.trim()) {
        return p.kelas_jabatan.trim();
    }
    if (typeof p.jenis_jabatan === "string" && p.jenis_jabatan.trim()) {
        return p.jenis_jabatan.trim();
    }
    return "";
};

// Helper to safely extract string organization unit from profile object
const extractUnit = (p) => {
    if (!p) return "";
    if (typeof p.organization_unit_name === "string" && p.organization_unit_name.trim()) {
        return p.organization_unit_name.trim();
    }
    if (p.organization_unit && typeof p.organization_unit === "object" && typeof p.organization_unit.name === "string" && p.organization_unit.name.trim()) {
        return p.organization_unit.name.trim();
    }
    if (typeof p.unit_organisasi === "string" && p.unit_organisasi.trim()) {
        return p.unit_organisasi.trim();
    }
    return "";
};

function Testimonials() {
    const isCollapsed = useSidebarCollapse();
    const userData = UserData();
    const profileContext = useContext(ProfileContext);
    const [profile] = profileContext || [null, () => {}];
    const [fetchedProfile, setFetchedProfile] = useState(null);

    // If profile is not available in context, fetch it directly
    useEffect(() => {
        if (!profile && userData?.user_id) {
            useAxios.get(`user/profile/${userData.user_id}/`)
                .then(res => setFetchedProfile(res.data))
                .catch(() => {});
        }
    }, [profile, userData?.user_id]);

    const activeProfile = profile || fetchedProfile;

    // Fetch user's own student testimonial with status
    const fetchTestimonials = useCallback(async () => {
        const res = await useAxios.get("student/testimonials/list/?role=student");
        return res.data?.results || [];
    }, []);

    // ✨ PHASE 11.12: Use page cache to avoid reloading when navigating
    const { data: testimonials = [], loading: fetching, refetch } = usePageCache(
        'student-testimonials',
        fetchTestimonials,
        {
            showLoadingOnStale: false
        }
    );

    const currentTestimonial = testimonials && testimonials.length > 0 ? testimonials[0] : null;

    // Real-time preview data synced with form
    const [previewData, setPreviewData] = useState({
        rating: 5,
        review: ""
    });

    // Sync preview state with loaded testimonial on initial load / change
    useEffect(() => {
        if (currentTestimonial) {
            setPreviewData({
                rating: currentTestimonial.rating || 5,
                review: currentTestimonial.review || ""
            });
        }
    }, [currentTestimonial?.id, currentTestimonial?.review, currentTestimonial?.rating]);

    const handleFormChange = useCallback((formData) => {
        setPreviewData({
            rating: formData.rating || 5,
            review: formData.review || ""
        });
    }, []);

    const handleTestimonialSubmitSuccess = () => {
        // Refresh testimonials after successful submission
        refetch();
    };

    // Extract student profile metadata
    const authorName = activeProfile?.full_name || userData?.full_name || userData?.username || "Peserta LMSetjen DPD RI";
    const authorRawAvatar = activeProfile?.image || userData?.image || null;
    const authorAvatar = getValidProfileImageUrl(authorRawAvatar);

    const resolvedPosition = extractPosition(activeProfile) || extractPosition(userData);
    const resolvedGolongan = activeProfile?.golongan || userData?.golongan || "";
    const authorUnit = extractUnit(activeProfile) || extractUnit(userData) || (activeProfile ? "Setjen DPD RI" : "");

    let authorTitle = "Peserta LMS Setjen DPD RI";
    if (resolvedPosition && resolvedGolongan) {
        authorTitle = `${resolvedPosition} (${resolvedGolongan})`;
    } else if (resolvedPosition) {
        authorTitle = resolvedPosition;
    } else if (resolvedGolongan) {
        authorTitle = `Pegawai Golongan ${resolvedGolongan}`;
    }

    const getAvatarInitial = (name) => {
        if (!name) return "S";
        return name.trim().charAt(0).toUpperCase();
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
                                    <div className="spinner-border text-teal" role="status" style={{ width: "3rem", height: "3rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Memuat Testimoni Peserta...</p>
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
                    <div className="row mt-0">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            
                            {/* Compact Modern Header */}
                            <div className="student-testimonial-header mb-4">
                                <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="testimonial-header-icon">
                                            <i className="fas fa-quote-left"></i>
                                        </div>
                                        <div>
                                            <h2 className="header-title mb-1">Testimoni Peserta Platform</h2>
                                            <p className="header-subtitle mb-0">
                                                Bagikan pengalaman dan ulasan belajar Anda pada portal LMS Setjen DPD RI
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Real-time Status Badge */}
                                    <div className="status-badge-container">
                                        {!currentTestimonial ? (
                                            <span className="badge rounded-pill badge-status-empty">
                                                <i className="fas fa-pen-nib me-1"></i> Belum Ada Testimoni
                                            </span>
                                        ) : currentTestimonial.status === 'approved' ? (
                                            <span className="badge rounded-pill badge-status-approved">
                                                <i className="fas fa-check-circle me-1"></i> Disetujui (+50 Poin)
                                            </span>
                                        ) : currentTestimonial.status === 'pending' ? (
                                            <span className="badge rounded-pill badge-status-pending">
                                                <i className="fas fa-hourglass-half me-1"></i> Menunggu Review Admin
                                            </span>
                                        ) : (
                                            <span className="badge rounded-pill badge-status-rejected">
                                                <i className="fas fa-triangle-exclamation me-1"></i> Perlu Revisi
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Main 2-Column Responsive Compact Layout */}
                            <div className="row g-4 align-items-start testimonial-main-grid">
                                
                                {/* Left Column: Form Submission / Edit Card */}
                                <div className="col-xl-7 col-lg-7 col-12 col-testimonial-form">
                                    <div className="card testimonial-form-card shadow-sm border-0">
                                        <div className="card-body p-4">
                                            
                                            {/* Status Notification Banner (if submitted) */}
                                            {currentTestimonial && (
                                                <div className="mb-4">
                                                    {currentTestimonial.status === 'approved' ? (
                                                        <div className="status-alert-box alert-success-compact">
                                                            <div className="d-flex align-items-center gap-2 mb-1">
                                                                <i className="fas fa-circle-check text-success fs-5"></i>
                                                                <strong className="text-success">Testimoni Anda Telah Disetujui & Tampil di Beranda!</strong>
                                                            </div>
                                                            <p className="small text-muted mb-0">
                                                                Terima kasih telah memberikan ulasan. Testimoni ini telah dipublikasikan pada halaman utama portal LMSetjen DPD RI dan Anda memperoleh reward <strong>+50 Poin Peserta</strong>.
                                                            </p>
                                                        </div>
                                                    ) : currentTestimonial.status === 'pending' ? (
                                                        <div className="status-alert-box alert-pending-compact">
                                                            <div className="d-flex align-items-center gap-2 mb-1">
                                                                <i className="fas fa-clock text-primary fs-5"></i>
                                                                <strong className="text-primary">Testimoni Sedang Ditinjau Admin</strong>
                                                            </div>
                                                            <p className="small text-muted mb-0">
                                                                Ulasan Anda sedang dalam antrean moderasi administrator. Anda tetap dapat memperbarui isi ulasan ini kapan saja sebelum disetujui.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="status-alert-box alert-rejected-compact">
                                                            <div className="d-flex align-items-center gap-2 mb-1">
                                                                <i className="fas fa-circle-xmark text-danger fs-5"></i>
                                                                <strong className="text-danger">Testimoni Perlu Direvisi</strong>
                                                            </div>
                                                            {currentTestimonial.rejection_reason && (
                                                                <div className="rejection-note mt-2 p-2 rounded">
                                                                    <span className="fw-semibold text-dark small d-block">Catatan Admin:</span>
                                                                    <span className="small text-danger-emphasis">{currentTestimonial.rejection_reason}</span>
                                                                </div>
                                                            )}
                                                            <p className="small text-muted mt-2 mb-0">
                                                                Silakan perbaiki ulasan sesuai catatan di atas dan kirim ulang untuk ditinjau kembali oleh admin.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Form Title & Subtitle */}
                                            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                                                <div>
                                                    <h5 className="fw-bold mb-1 text-dark">
                                                        <i className="fas fa-pen-fancy text-teal me-2"></i>
                                                        {currentTestimonial ? "Edit Testimoni Anda" : "Tulis Testimoni Peserta"}
                                                    </h5>
                                                    <span className="small text-muted">
                                                        Penilaian Anda membantu peningkatan kualitas pembelajaran digital Setjen DPD RI
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Testimonial Form with Compact & Realtime FormChange Integration */}
                                            <TestimonialSubmitForm 
                                                onSuccess={handleTestimonialSubmitSuccess}
                                                onFormChange={handleFormChange}
                                                role="student" 
                                                compact={true}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Live Homepage Preview & Activity/Points Summary */}
                                <div className="col-xl-5 col-lg-5 col-12 col-testimonial-sidebar">
                                    <div className="d-flex flex-column gap-4">
                                        
                                        {/* Card 1: Live Homepage Preview Card */}
                                        <div className="card preview-container-card shadow-sm border-0">
                                            <div className="card-header bg-transparent border-0 pt-3 px-4 pb-0 d-flex align-items-center justify-content-between">
                                                <span className="preview-label">
                                                    <i className="fas fa-eye text-teal me-2"></i>Pratinjau di Beranda
                                                </span>
                                                <span className="badge preview-mode-tag">
                                                    <i className="fas fa-sparkles me-1 text-warning"></i>Live Preview
                                                </span>
                                            </div>

                                            <div className="card-body p-4 pt-3">
                                                <p className="preview-help-text small text-muted mb-3">
                                                    Tampilan kartu testimoni Anda yang akan dilihat publik & peserta di halaman utama portal:
                                                </p>

                                                {/* Simulated Homepage Testimonial Card */}
                                                <div className="homepage-preview-card text-center">
                                                    
                                                    {/* Avatar */}
                                                    <div className="preview-avatar-wrap mx-auto mb-3">
                                                        {authorAvatar ? (
                                                            <img 
                                                                src={authorAvatar} 
                                                                alt={authorName} 
                                                                className="preview-avatar-img"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="preview-avatar-fallback">
                                                                {getAvatarInitial(authorName)}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Review Text */}
                                                    <div className="preview-quote-box mb-3">
                                                        <span className="quote-mark-open">“</span>
                                                        <p className="preview-quote-text fst-italic mb-0">
                                                            {previewData.review && previewData.review.trim() 
                                                                ? previewData.review.trim() 
                                                                : "Ketik ulasan Anda pada formulir di sebelah kiri untuk melihat tampilan langsung kartu testimoni di sini..."}
                                                        </p>
                                                        <span className="quote-mark-close">”</span>
                                                    </div>

                                                    {/* Rating Stars */}
                                                    <div className="preview-rating-row mb-3">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <i 
                                                                key={star} 
                                                                className={`fas fa-star ${star <= previewData.rating ? 'text-warning' : 'text-muted-star'}`}
                                                            ></i>
                                                        ))}
                                                        <span className="preview-rating-number ms-2 fw-bold text-warning">
                                                            {previewData.rating}.0
                                                        </span>
                                                    </div>

                                                    {/* Badges */}
                                                    <div className="d-flex flex-wrap justify-content-center gap-1 mb-3">
                                                        <span className="badge badge-role-student">
                                                            <i className="fas fa-graduation-cap me-1"></i>Sebagai Peserta
                                                        </span>
                                                        {currentTestimonial?.status === 'approved' ? (
                                                            <span className="badge bg-success-subtle text-success border border-success-subtle">
                                                                <i className="fas fa-check-double me-1"></i>Aktif di Beranda
                                                            </span>
                                                        ) : (
                                                            <span className="badge bg-light text-muted border">
                                                                <i className="fas fa-circle-dot me-1 text-primary"></i>Simulasi Kartu
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Author Info */}
                                                    <h6 className="preview-author-name fw-bold mb-1">{authorName}</h6>
                                                    <p className="preview-author-role text-muted small mb-0">{authorTitle}</p>
                                                    {authorUnit && (
                                                        <small className="preview-author-unit text-muted d-block mt-1">
                                                            <i className="fas fa-building text-teal me-1"></i>{authorUnit}
                                                        </small>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card 2: Points & Activity History Information */}
                                        <div className="card gamification-info-card shadow-sm border-0">
                                            <div className="card-body p-4">
                                                <div className="d-flex align-items-center gap-2 mb-3">
                                                    <div className="info-icon-box">
                                                        <i className="fas fa-coins text-warning"></i>
                                                    </div>
                                                    <div>
                                                        <h6 className="fw-bold mb-0 text-dark">Poin & Riwayat Aktivitas</h6>
                                                        <span className="small text-muted">Dampak testimoni terhadap profil & ranking Anda</span>
                                                    </div>
                                                </div>

                                                {/* Points Highlight */}
                                                <div className="points-highlight-box p-3 rounded mb-3">
                                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                                        <span className="fw-semibold text-dark small">Reward Testimoni Platform</span>
                                                        <span className="badge badge-points-reward">+50 Poin</span>
                                                    </div>
                                                    <p className="small text-muted mb-0">
                                                        Saat testimoni disetujui Admin, Anda otomatis mendapatkan <strong>50 Poin</strong> yang berkontribusi langsung pada akumulasi skor & peringkat Anda di Leaderboard Peserta.
                                                    </p>
                                                </div>

                                                {/* Activity Tracking Breakdown */}
                                                <div className="activity-timeline-box mb-3">
                                                    <span className="timeline-title d-block fw-semibold text-dark small mb-2">
                                                        <i className="fas fa-clock-rotate-left me-1 text-teal"></i>Terekap di Riwayat Aktivitas Peserta:
                                                    </span>
                                                    <ul className="activity-list list-unstyled mb-0">
                                                        <li className="d-flex align-items-start gap-2 mb-2">
                                                            <span className="badge-bullet bullet-create"></span>
                                                            <div className="small">
                                                                <strong>Membuat Testimoni</strong> (<code className="code-tag">testimonial_posted</code>)
                                                                <div className="text-muted">Tercatat saat testimoni pertama kali dikirimkan.</div>
                                                            </div>
                                                        </li>
                                                        <li className="d-flex align-items-start gap-2 mb-2">
                                                            <span className="badge-bullet bullet-update"></span>
                                                            <div className="small">
                                                                <strong>Mengubah Testimoni</strong> (<code className="code-tag">testimonial_updated</code>)
                                                                <div className="text-muted">Tercatat saat ulasan diperbarui untuk peninjauan ulang.</div>
                                                            </div>
                                                        </li>
                                                        <li className="d-flex align-items-start gap-2">
                                                            <span className="badge-bullet bullet-delete"></span>
                                                            <div className="small">
                                                                <strong>Menghapus Testimoni</strong> (<code className="code-tag">testimonial_deleted</code>)
                                                                <div className="text-muted">Tercatat di riwayat & audit log jika ulasan dihapus. Reward 50 poin ditarik kembali secara otomatis melalui rekonsiliasi poin.</div>
                                                            </div>
                                                        </li>
                                                    </ul>
                                                </div>

                                                {/* Quick Action Navigation Buttons */}
                                                <div className="d-flex gap-2 pt-2 border-top">
                                                    <Link 
                                                        to="/student/activities/" 
                                                        className="btn btn-action-activities flex-fill"
                                                    >
                                                        <i className="fas fa-list-check me-1"></i>Riwayat Aktivitas
                                                    </Link>
                                                    <Link 
                                                        to="/rankings/" 
                                                        className="btn btn-action-rankings flex-fill"
                                                    >
                                                        <i className="fas fa-trophy me-1"></i>Peringkat Peserta
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
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
