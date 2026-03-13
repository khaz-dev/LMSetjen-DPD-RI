import React, { useState, useEffect } from "react";
import dayjs, { moment } from "../../utils/dayjs";
import { Rating } from "react-simple-star-rating";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LoadingSpinner from "./Partials/LoadingSpinner";
import MinimalLoader from "./Partials/MinimalLoader";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import "./Review.css";

function Review() {
    const [reviews, setReviews] = useState([]);
    const [replies, setReplies] = useState({});
    const [filteredReviews, setFilteredReview] = useState([]);
    const [loadingReply, setLoadingReply] = useState({});
    const [loading, setLoading] = useState(true);
    const [reportingAbuseReviewId, setReportingAbuseReviewId] = useState(null);
    const [showAbuseModal, setShowAbuseModal] = useState(false);
    const [abuseReason, setAbuseReason] = useState('');
    const [abuseDescription, setAbuseDescription] = useState('');
    const [reportingAbuse, setReportingAbuse] = useState(false);
    const [abuseReports, setAbuseReports] = useState([]);  // ✨ PHASE 4.210: Track submitted abuse reports
    const [loadingAbuseReports, setLoadingAbuseReports] = useState(false);
    const [showExistingReportModal, setShowExistingReportModal] = useState(false);  // ✨ PHASE 4.210: Modal for viewing existing reports
    const [selectedExistingReport, setSelectedExistingReport] = useState(null);  // ✨ PHASE 4.210: Currently viewed report
    const [isEditingReport, setIsEditingReport] = useState(false);  // ✨ PHASE 4.210: Edit mode for existing report
    const [editReason, setEditReason] = useState('');  // ✨ PHASE 4.210: Edited reason
    const [editDescription, setEditDescription] = useState('');  // ✨ PHASE 4.210: Edited description
    const [updatingExistingReport, setUpdatingExistingReport] = useState(false);  // ✨ PHASE 4.210: Loading state for updating
    const [closingReport, setClosingReport] = useState(false);  // ✨ PHASE 4.210: Loading state for closing
    const isCollapsed = useInstructorSidebarCollapse();

    const fetchReviewsData = async () => {
        try {
            setLoading(true);
            const userData = UserData();
            if (!userData?.teacher_id) {
                throw new Error("Teacher ID not found");
            }
            const res = await useAxios.get(`teacher/review-lists/${userData.teacher_id}/`);
            // Extract results from paginated response
            const reviewsData = res.data.results || res.data;
            setReviews(reviewsData);
            setFilteredReview(reviewsData);
        } catch (error) {
            console.error("Error fetching reviews:", error);
        } finally {
            setLoading(false);
        }
    };

    // ✨ PHASE 4.210: Fetch abuse reports submitted by this teacher
    const fetchAbuseReports = async () => {
        try {
            const userData = UserData();
            if (!userData?.teacher_id) return;
            
            const res = await useAxios.get(`teacher/abuse-reports/${userData.teacher_id}/`);
            const reports = res.data.results || res.data;
            console.log("[Review] Fetched abuse reports:", reports);
            reports.forEach(r => {
                console.log(`[Review] Report ${r.id}: review.id = ${r.review?.id}, status = ${r.status}`);
            });
            setAbuseReports(reports);
        } catch (error) {
            console.error("Error fetching abuse reports:", error);
        }
    };

    useEffect(() => {
        fetchReviewsData();
        fetchAbuseReports();
    }, []);

    const handleSubmitReply = async (reviewId) => {
        const replyText = replies[reviewId];
        if (!replyText?.trim()) return;
        
        setLoadingReply({...loadingReply, [reviewId]: true});
        
        try {
            const userData = UserData();
            if (!userData?.teacher_id) {
                throw new Error("Teacher ID not found");
            }
            await useAxios.patch(`teacher/review-detail/${userData.teacher_id}/${reviewId}/`, {
                reply: replyText,
            });
            
            fetchReviewsData();
            Toast().fire({
                icon: "success",
                title: "Balasan terkirim berhasil!",
            });
            
            // Clear only the specific reply
            setReplies({...replies, [reviewId]: ""});
            
            // Close the collapse
            const collapseElement = document.getElementById(`collapse${reviewId}`);
            if (collapseElement) {
                const bsCollapse = new window.bootstrap.Collapse(collapseElement);
                bsCollapse.hide();
            }
            
        } catch (error) {
            console.error("Error sending reply:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal mengirim balasan. Silakan coba lagi.",
            });
        } finally {
            setLoadingReply({...loadingReply, [reviewId]: false});
        }
    };

    const handleSortByDate = (e) => {
        const sortValue = e.target.value;
        const sortedReview = [...filteredReviews];
        if (sortValue === "Newest") {
            sortedReview.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            sortedReview.sort((a, b) => new Date(a.date) - new Date(b.date));
        }

        setFilteredReview(sortedReview);
    };

    const handleSortByRatingChange = (e) => {
        const rating = parseInt(e.target.value);
        if (rating === 0) {
            fetchReviewsData();
        } else {
            const filtered = reviews.filter((review) => review.rating === rating);
            setFilteredReview(filtered);
        }
    };

    const handleFilterByCourse = (e) => {
        const query = e.target.value.toLowerCase();
        if (query === "") {
            fetchReviewsData();
        } else {
            const filtered = reviews.filter((review) => {
                return review.course.title.toLowerCase().includes(query);
            });
            setFilteredReview(filtered);
        }
    };

    // ✨ PHASE 4.210: Abuse Report Handlers
    const handleOpenAbuseModal = (reviewId) => {
        console.log(`[Review] Looking for existing reports for review ${reviewId}`);
        console.log("[Review] Available reports:", abuseReports);
        
        // Check if already reported
        const existingReport = abuseReports.find(r => r.review?.id === reviewId);
        
        console.log(`[Review] Found existing report:`, existingReport);
        
        if (existingReport) {
            // Open the existing report details modal instead
            console.log("[Review] Showing existing report modal");
            setSelectedExistingReport(existingReport);
            setShowExistingReportModal(true);
            return;
        }
        
        console.log("[Review] Showing new report modal");
        setReportingAbuseReviewId(reviewId);
        setShowAbuseModal(true);
        setAbuseReason('');
        setAbuseDescription('');
    };

    const handleCloseAbuseModal = () => {
        setShowAbuseModal(false);
        setReportingAbuseReviewId(null);
        setAbuseReason('');
        setAbuseDescription('');
    };

    const handleCloseExistingReportModal = () => {
        setShowExistingReportModal(false);
        setSelectedExistingReport(null);
        setIsEditingReport(false);
        setEditReason('');
        setEditDescription('');
    };

    // ✨ PHASE 4.210: Enter edit mode for existing report
    const handleEditExistingReport = () => {
        if (selectedExistingReport) {
            setEditReason(selectedExistingReport.reason || '');
            setEditDescription(selectedExistingReport.description || '');
            setIsEditingReport(true);
        }
    };

    // ✨ PHASE 4.210: Submit updated report
    const handleUpdateExistingReport = async () => {
        if (!editReason.trim()) {
            Toast().fire({
                icon: "warning",
                title: "Silakan pilih alasan laporan",
            });
            return;
        }

        setUpdatingExistingReport(true);

        try {
            const userData = UserData();
            
            // Send updated data to backend
            const response = await useAxios.put(
                `teacher/abuse-reports/${selectedExistingReport.id}/update/`,
                {
                    reason: editReason,
                    description: editDescription,
                }
            );

            Toast().fire({
                icon: "success",
                title: "Laporan Diperbarui!",
                text: "Laporan Anda telah diperbarui dan dikirim kembali untuk ditinjau admin.",
            });

            console.log("[Review] Updated report response:", response.data);
            
            // Update local state
            const updatedReport = response.data;
            setSelectedExistingReport(updatedReport);
            
            // Refresh abuse reports
            fetchAbuseReports();
            
            // Exit edit mode
            setIsEditingReport(false);
        } catch (error) {
            console.error("Error updating report:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui laporan",
                text: error.response?.data?.detail || error.response?.data?.error || "Terjadi kesalahan",
            });
        } finally {
            setUpdatingExistingReport(false);
        }
    };

    // ✨ PHASE 4.210: Close/Resolve the abuse report
    const handleCloseReport = async () => {
        setClosingReport(true);

        try {
            const response = await useAxios.put(
                `teacher/abuse-reports/${selectedExistingReport.id}/close/`
            );

            Toast().fire({
                icon: "success",
                title: "Masalah Selesai!",
                text: "Laporan ditandai sebagai selesai. Admin telah diberitahu.",
            });

            console.log("[Review] Close report response:", response.data);
            
            // Update local state
            const closedReport = response.data;
            setSelectedExistingReport(closedReport);
            
            // Refresh abuse reports
            fetchAbuseReports();
        } catch (error) {
            console.error("Error closing report:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal menyelesaikan laporan",
                text: error.response?.data?.detail || error.response?.data?.error || "Terjadi kesalahan",
            });
        } finally {
            setClosingReport(false);
        }
    };

    const handleSubmitAbuseReport = async () => {
        if (!abuseReason.trim()) {
            Toast().fire({
                icon: "warning",
                title: "Silakan pilih alasan laporan",
            });
            return;
        }

        setReportingAbuse(true);

        try {
            const userData = UserData();
            if (!userData?.id) {
                throw new Error("User ID not found");
            }

            await useAxios.post(`teacher/review-report-abuse/${reportingAbuseReviewId}/`, {
                reported_by: userData.id,
                reason: abuseReason,
                description: abuseDescription,
            });

            Toast().fire({
                icon: "success",
                title: "Laporan berhasil dikirim!",
                text: "Admin akan meninjau laporan Anda dalam waktu singkat.",
            });

            // Refresh abuse reports list
            fetchAbuseReports();
            handleCloseAbuseModal();
        } catch (error) {
            console.error("Error reporting abuse:", error);
            if (error.response?.data?.error) {
                Toast().fire({
                    icon: "error",
                    title: error.response.data.error,
                });
            } else {
                Toast().fire({
                    icon: "error",
                    title: "Gagal mengirim laporan. Silakan coba lagi.",
                });
            }
        } finally {
            setReportingAbuse(false);
        }
    };

    // Show full-page loading spinner on initial load
    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-review-page" style={{ display: "flex", alignItems: "center" }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
                                        <span className="visually-hidden">Memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Memuat Ulasan...</p>
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

            <section className="instructor-review-page">
                <div className="container">
                    {/* Header Here */}
                    <Header />
                    <div className="row">
                        {/* Sidebar Here */}
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Modern Header Section */}
                            <div className="modern-header-section mb-4">
                                <div className="header-decoration"></div>
                                <div className="d-flex align-items-center justify-content-between header-content">
                                    <div>
                                        <h1 className="mb-2 page-title">
                                            <i className="fas fa-star-half-alt me-3 page-title-icon"></i>Ulasan Kursus
                                        </h1>
                                        <p className="mb-0 text-muted page-subtitle">
                                            Pantau umpan balik dan berkomunikasi dengan siswa Anda
                                        </p>
                                    </div>
                                    <div className="text-end">
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="stat-badge">
                                                <i className="fas fa-comments stat-badge-icon"></i>
                                                {filteredReviews?.length || 0} Ulasan
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modern Filter Section */}
                            <div className="modern-filter-section">
                                <div className="row g-3">
                                    <div className="col-xl-7 col-lg-6 col-md-4 col-12">
                                        <div className="modern-search-container">
                                            <i className="fas fa-search search-icon"></i>
                                            <input 
                                                type="text" 
                                                className="form-control modern-input" 
                                                placeholder="Cari berdasarkan nama kursus..." 
                                                onChange={handleFilterByCourse}
                                            />
                                        </div>
                                    </div>
                                    <div className="col-xl-2 col-lg-2 col-md-4 col-12">
                                        <select 
                                            className="form-select modern-select" 
                                            onChange={handleSortByRatingChange}
                                        >
                                            <option value={0}>Semua Rating</option>
                                            <option value={5}>5 Bintang</option>
                                            <option value={4}>4 Bintang</option>
                                            <option value={3}>3 Bintang</option>
                                            <option value={2}>2 Bintang</option>
                                            <option value={1}>1 Bintang</option>
                                        </select>
                                    </div>
                                    <div className="col-xl-3 col-lg-3 col-md-4 col-12">
                                        <select 
                                            className="form-select modern-select" 
                                            onChange={handleSortByDate}
                                        >
                                            <option value="">Urutkan Berdasarkan Tanggal</option>
                                            <option value="Newest">Terbaru Dulu</option>
                                            <option value="Oldest">Tertua Dulu</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            {/* Modern Reviews List */}
                            <div className="modern-reviews-container">
                                {filteredReviews?.length > 0 ? (
                                    <div className="row g-4">
                                        {filteredReviews.map((r, index) => (
                                            <div key={r.id || index} className="col-12">
                                                <div className="modern-review-card">
                                                    <div className="row g-3">
                                                        <div className="col-auto">
                                                            <div className="modern-avatar-container">
                                                                {r.user?.image ? (
                                                                    <img
                                                                        src={r.user.image}
                                                                        alt="avatar"
                                                                        className="reviewer-avatar rounded-circle"
                                                                        onError={(e) => {
                                                                            e.target.style.display = "none";
                                                                            e.target.parentElement.innerHTML = '<div class="default-avatar"><i class="fas fa-user"></i></div>';
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div className="default-avatar">
                                                                        <i className="fas fa-user"></i>
                                                                    </div>
                                                                )}
                                                                <div className="avatar-status-badge">
                                                                    <i className="fas fa-check avatar-status-icon"></i>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="col">
                                                            <div className="review-header">
                                                                <div className="reviewer-info">
                                                                    <h4 className="reviewer-name">
                                                                        {r.user?.full_name || 'Anonymous'}
                                                                    </h4>
                                                                    <span className="review-date">
                                                                        <i className="fas fa-calendar-alt review-date-icon"></i>
                                                                        {moment(r.date).format("DD MMM, YYYY")}
                                                                    </span>
                                                                </div>
                                                                {/* ✨ PHASE 4.210: Report button with status */}
                                                                <div className="review-report-section">
                                                                    {abuseReports.find(rpt => rpt.review?.id === r.id) ? (
                                                                        <button 
                                                                            className={`report-status-badge-btn ${abuseReports.find(rpt => rpt.review?.id === r.id)?.status}`}
                                                                            onClick={() => handleOpenAbuseModal(r.id)}
                                                                            title="Klik untuk melihat detail laporan"
                                                                        >
                                                                            <i className="fas fa-flag-checkered me-1"></i>
                                                                            <span>{abuseReports.find(rpt => rpt.review?.id === r.id)?.status || 'reported'}</span>
                                                                        </button>
                                                                    ) : (
                                                                        <button 
                                                                            className="btn report-btn" 
                                                                            data-bs-toggle="tooltip" 
                                                                            data-placement="top" 
                                                                            title="Report Abuse"
                                                                            onClick={() => handleOpenAbuseModal(r.id)}
                                                                        >
                                                                            <i className="fas fa-flag" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="rating-section">
                                                                <Rating
                                                                    initialValue={r.rating || 0}
                                                                    readonly={true}
                                                                    size={18}
                                                                    fillColor="#ffc107"
                                                                    emptyColor="#e4e5e9"
                                                                />
                                                            </div>
                                                            <div className="course-info">
                                                                <span className="rating-label">untuk</span>
                                                                <span className="course-title">
                                                                    {r.course?.title || 'Kursus Tidak Tersedia'}
                                                                </span>
                                                            </div>

                                                            <div className="review-content">
                                                                <div className="review-content-label">
                                                                    <i className="fas fa-quote-left review-quote-icon"></i>
                                                                    <span className="review-label-text">Ulasan Siswa</span>
                                                                </div>
                                                                <p className="review-text">
                                                                    {r.review}
                                                                </p>
                                                            </div>

                                                            {r.reply && (
                                                                <div className="response-content">
                                                                    <div className="response-content-label">
                                                                        <i className="fas fa-reply response-icon"></i>
                                                                        <span className="response-label-text">Respons Anda</span>
                                                                    </div>
                                                                    <p className="response-text">
                                                                        {r.reply}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            <div className="d-flex justify-content-end">
                                                                <button 
                                                                    className="btn modern-reply-btn" 
                                                                    type="button" 
                                                                    data-bs-toggle="collapse" 
                                                                    data-bs-target={`#collapse${r.id}`} 
                                                                    aria-expanded="false" 
                                                                    aria-controls={`collapse${r.id}`}
                                                                >
                                                                    <i className="fas fa-reply reply-icon"></i>
                                                                    {r.reply ? "Perbarui Respons" : "Kirim Respons"}
                                                                </button>
                                                            </div>
                                                            
                                                            {/* Modern Collapse Section */}
                                                            <div className="collapse mt-4" id={`collapse${r.id}`}>
                                                                <div className="modern-response-form">
                                                                    <div className="mb-3">
                                                                        <label htmlFor={`response-${r.id}`} className="form-label">
                                                                            <i className="fas fa-pen-fancy form-label-icon"></i>
                                                                            Tulis Respons Anda
                                                                        </label>
                                                                        <textarea 
                                                                            id={`response-${r.id}`}
                                                                            className="form-control modern-textarea" 
                                                                            rows="4" 
                                                                            value={replies[r.id] || ""}
                                                                            onChange={(e) => setReplies({...replies, [r.id]: e.target.value})}
                                                                            placeholder="Bagikan pemikiran dan apresiasi Anda untuk ulasan ini..."
                                                                            disabled={loadingReply[r.id]}
                                                                        ></textarea>
                                                                        <div className="form-text">
                                                                            <small className="text-muted">
                                                                                <i className="fas fa-info-circle form-text-icon"></i>
                                                                                Respons Anda akan terlihat oleh siswa dan membantu membangun hubungan yang lebih baik.
                                                                            </small>
                                                                        </div>
                                                                    </div>

                                                                    <div className="form-buttons">
                                                                        <button 
                                                                            type="button" 
                                                                            className="btn btn-outline-secondary cancel-btn" 
                                                                            data-bs-toggle="collapse" 
                                                                            data-bs-target={`#collapse${r.id}`}
                                                                            disabled={loadingReply[r.id]}
                                                                        >
                                                                            <i className="fas fa-times cancel-icon"></i>
                                                                            Batal
                                                                        </button>
                                                                        
                                                                        <button 
                                                                            type="button" 
                                                                            className="btn submit-btn" 
                                                                            onClick={() => handleSubmitReply(r.id)}
                                                                            disabled={!replies[r.id]?.trim() || loadingReply[r.id]}
                                                                        >
                                                                            {loadingReply[r.id] ? (
                                                                                <>
                                                                                    <span className="spinner-border spinner-border-sm submit-spinner" role="status" aria-hidden="true"></span>
                                                                                    <strong>Mengirim...</strong>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <i className="fas fa-paper-plane submit-icon"></i>
                                                                                    Kirim Respons
                                                                                </>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="modern-empty-state">
                                        <div className="empty-state-icon">
                                            <i className="fas fa-star empty-state-icon-inner"></i>
                                        </div>
                                        <h4 className="empty-state-title">Tidak Ada Ulasan Ditemukan</h4>
                                        <p className="empty-state-text">
                                            Ketika siswa memberi ulasan pada kursus Anda, mereka akan muncul di sini untuk Anda respons.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ✨ PHASE 4.210: Abuse Report Modal */}
            {showAbuseModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content abuse-report-modal">
                            <div className="modal-header abuse-modal-header">
                                <h5 className="modal-title">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    Laporkan Ulasan Penyalahgunaan
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close" 
                                    onClick={handleCloseAbuseModal}
                                    disabled={reportingAbuse}
                                ></button>
                            </div>
                            <div className="modal-body">
                                <p className="abuse-modal-text">
                                    Bantu kami menjaga kualitas komunitas dengan melaporkan ulasan yang tidak sesuai.
                                </p>
                                
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Alasan Laporan <span className="text-danger">*</span></label>
                                    <select 
                                        className="form-select form-select-modern"
                                        value={abuseReason}
                                        onChange={(e) => setAbuseReason(e.target.value)}
                                        disabled={reportingAbuse}
                                    >
                                        <option value="">-- Pilih Alasan --</option>
                                        <option value="inappropriate_content">Konten Tidak Pantas</option>
                                        <option value="spam">Spam</option>
                                        <option value="offensive_language">Bahasa Kasar/Menyinggung</option>
                                        <option value="false_information">Informasi Palsu</option>
                                        <option value="harassment">Pelecehan</option>
                                        <option value="other">Lainnya</option>
                                    </select>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Penjelasan Tambahan (Opsional)</label>
                                    <textarea 
                                        className="form-control"
                                        rows="3"
                                        placeholder="Berikan rincian untuk membantu Admin memahami masalah ini..."
                                        value={abuseDescription}
                                        onChange={(e) => setAbuseDescription(e.target.value)}
                                        disabled={reportingAbuse}
                                    ></textarea>
                                    <small className="text-muted">Maksimal 500 karakter</small>
                                </div>

                                <div className="alert alert-info">
                                    <i className="fas fa-info-circle me-2"></i>
                                    Tim Admin kami akan meninjau laporan ini dan mengambil tindakan yang sesuai.
                                </div>
                            </div>
                            <div className="modal-footer abuse-modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary"
                                    onClick={handleCloseAbuseModal}
                                    disabled={reportingAbuse}
                                >
                                    Batal
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-danger"
                                    onClick={handleSubmitAbuseReport}
                                    disabled={reportingAbuse || !abuseReason.trim()}
                                >
                                    {reportingAbuse ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Mengirim...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-paper-plane me-2"></i>
                                            Laporkan
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ✨ PHASE 4.210: Existing Report Details Modal */}
            {showExistingReportModal && selectedExistingReport && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content abuse-report-modal">
                            <div className="modal-header abuse-modal-header">
                                <h5 className="modal-title">
                                    <i className="fas fa-file-alt me-2"></i>
                                    Detail Laporan Penyalahgunaan
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close" 
                                    onClick={handleCloseExistingReportModal}
                                ></button>
                            </div>
                            <div className="modal-body">
                                {/* Report Status */}
                                <div className="mb-4">
                                    <label className="form-label fw-semibold">Status Laporan</label>
                                    <div className={`alert alert-${selectedExistingReport.status === 'pending' ? 'warning' : selectedExistingReport.status === 'reviewed' ? 'info' : selectedExistingReport.status === 'action_taken' ? 'success' : 'danger'}`}>
                                        <i className={`fas ${selectedExistingReport.status === 'pending' ? 'fa-clock' : selectedExistingReport.status === 'reviewed' ? 'fa-eye' : selectedExistingReport.status === 'action_taken' ? 'fa-check-circle' : 'fa-times-circle'} me-2`}></i>
                                        <strong>
                                            {selectedExistingReport.status === 'pending' && 'Menunggu Review'}
                                            {selectedExistingReport.status === 'reviewed' && 'Sudah Direviu'}
                                            {selectedExistingReport.status === 'action_taken' && 'Tindakan Telah Diambil'}
                                            {selectedExistingReport.status === 'dismissed' && 'Laporan Ditolak'}
                                        </strong>
                                    </div>
                                </div>

                                {/* Reason */}
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Alasan Laporan</label>
                                    {isEditingReport ? (
                                        <select 
                                            className="form-select"
                                            value={editReason}
                                            onChange={(e) => setEditReason(e.target.value)}
                                            disabled={updatingExistingReport}
                                        >
                                            <option value="">-- Pilih Alasan --</option>
                                            <option value="inappropriate_content">Konten Tidak Pantas</option>
                                            <option value="spam">Spam</option>
                                            <option value="offensive_language">Bahasa Kasar/Menyinggung</option>
                                            <option value="false_information">Informasi Palsu</option>
                                            <option value="harassment">Pelecehan</option>
                                            <option value="other">Lainnya</option>
                                        </select>
                                    ) : (
                                        <p className="text-muted">{selectedExistingReport.reason || '-'}</p>
                                    )}
                                </div>

                                {/* Your Description */}
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Deskripsi Anda</label>
                                    {isEditingReport ? (
                                        <textarea 
                                            className="form-control"
                                            rows="3"
                                            placeholder="Berikan rincian untuk membantu Admin memahami masalah ini..."
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            disabled={updatingExistingReport}
                                            maxLength={500}
                                        ></textarea>
                                    ) : (
                                        <p className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>{selectedExistingReport.description || '-'}</p>
                                    )}
                                    {isEditingReport && (
                                        <small className="text-muted">Maksimal 500 karakter ({editDescription.length}/500)</small>
                                    )}
                                </div>

                                {/* Admin Notes */}
                                {selectedExistingReport.review_notes && (
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Catatan dari Admin</label>
                                        <div className="alert alert-light border">
                                            <p style={{ whiteSpace: 'pre-wrap' }}>{selectedExistingReport.review_notes}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Reported Date */}
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Tanggal Laporan</label>
                                    <p className="text-muted">{moment(selectedExistingReport.reported_at).format("DD MMM YYYY HH:mm")}</p>
                                </div>

                                {/* Reviewed Date */}
                                {selectedExistingReport.reviewed_at && (
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold">Tanggal Review</label>
                                        <p className="text-muted">{moment(selectedExistingReport.reviewed_at).format("DD MMM YYYY HH:mm")}</p>
                                    </div>
                                )}

                                {!isEditingReport && (
                                    <div className="alert alert-info mt-4">
                                        <i className="fas fa-info-circle me-2"></i>
                                        Terima kasih telah membantu kami menjaga komunitas yang sehat. Admin kami telah meninjau laporan Anda.
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer abuse-modal-footer">
                                {selectedExistingReport.closed_by_reporter ? (
                                    // Report is closed - show only close button
                                    <button 
                                        type="button" 
                                        className="btn btn-primary"
                                        onClick={handleCloseExistingReportModal}
                                    >
                                        Tutup
                                    </button>
                                ) : isEditingReport ? (
                                    // Editing mode - show cancel and update
                                    <>
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-secondary"
                                            onClick={() => setIsEditingReport(false)}
                                            disabled={updatingExistingReport}
                                        >
                                            Batal
                                        </button>
                                        <button 
                                            type="button" 
                                            className="btn btn-danger"
                                            onClick={handleUpdateExistingReport}
                                            disabled={updatingExistingReport || !editReason.trim()}
                                        >
                                            {updatingExistingReport ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                    Mengirim...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-paper-plane me-2"></i>
                                                    Perbarui Laporan
                                                </>
                                            )}
                                        </button>
                                    </>
                                ) : (
                                    // View mode - show edit and resolve buttons
                                    <>
                                        <button 
                                            type="button" 
                                            className="btn btn-outline-secondary"
                                            onClick={handleEditExistingReport}
                                            // ✨ PHASE 4.210: Only allow re-reporting if status is pending
                                            disabled={selectedExistingReport.status !== 'pending'}
                                        >
                                            <i className="fas fa-edit me-2"></i>
                                            Laporkan Ulang
                                        </button>
                                        {/* ✨ PHASE 4.210: Show "Masalah Selesai" button only after status is reviewed/dismissed/action_taken */}
                                        {selectedExistingReport.status !== 'pending' && (
                                            <button 
                                                type="button" 
                                                className="btn btn-success"
                                                onClick={handleCloseReport}
                                                disabled={closingReport}
                                            >
                                                {closingReport ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                        Memproses...
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-check-circle me-2"></i>
                                                        Masalah Selesai
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </>
    );
}

export default React.memo(Review);