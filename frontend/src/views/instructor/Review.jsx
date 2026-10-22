import React, { useState, useEffect, useCallback, useMemo } from "react";
import { moment } from "../../utils/dayjs";
import { Rating } from "react-simple-star-rating";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";
import { usePageCache } from "../../utils/usePageCache";
import "./Review.css";

function Review() {
    const isCollapsed = useInstructorSidebarCollapse();

    // Replies and UI states
    const [replies, setReplies] = useState({});
    const [loadingReply, setLoadingReply] = useState({});
    const [openReplyId, setOpenReplyId] = useState(null);

    // Filters and Search states
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'unanswered' | 'answered'
    const [selectedRating, setSelectedRating] = useState(0); // 0 = all
    const [selectedCourseId, setSelectedCourseId] = useState("all");
    const [sortBy, setSortBy] = useState("newest"); // 'newest' | 'oldest' | 'highest' | 'lowest'

    // Abuse reporting states
    const [reportingAbuseReviewId, setReportingAbuseReviewId] = useState(null);
    const [showAbuseModal, setShowAbuseModal] = useState(false);
    const [abuseReason, setAbuseReason] = useState("");
    const [abuseDescription, setAbuseDescription] = useState("");
    const [reportingAbuse, setReportingAbuse] = useState(false);
    const [abuseReports, setAbuseReports] = useState([]);
    const [showExistingReportModal, setShowExistingReportModal] = useState(false);
    const [selectedExistingReport, setSelectedExistingReport] = useState(null);
    const [isEditingReport, setIsEditingReport] = useState(false);
    const [editReason, setEditReason] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [updatingExistingReport, setUpdatingExistingReport] = useState(false);
    const [closingReport, setClosingReport] = useState(false);

    // Fetch review data for page cache
    const fetchReviewsData = useCallback(async () => {
        const userData = UserData();
        if (!userData?.teacher_id) {
            throw new Error("Teacher ID not found");
        }
        const res = await useAxios.get(`teacher/review-lists/${userData.teacher_id}/`);
        const reviewsData = res.data.results || res.data;
        return Array.isArray(reviewsData) ? reviewsData : [];
    }, []);

    const { data: reviews = [], loading, refetch: refetchReviews } = usePageCache(
        "instructor-reviews",
        fetchReviewsData,
        { showLoadingOnStale: false }
    );

    // Fetch abuse reports submitted by this teacher
    const fetchAbuseReports = async () => {
        try {
            const userData = UserData();
            if (!userData?.teacher_id) return;
            const res = await useAxios.get(`teacher/abuse-reports/${userData.teacher_id}/`);
            const reports = res.data.results || res.data;
            setAbuseReports(Array.isArray(reports) ? reports : []);
        } catch (error) {
            console.error("Error fetching abuse reports:", error);
        }
    };

    useEffect(() => {
        fetchAbuseReports();
    }, []);

    // Extract unique courses for dropdown filter
    const uniqueCourses = useMemo(() => {
        if (!reviews || !Array.isArray(reviews)) return [];
        const courseMap = new Map();
        reviews.forEach((r) => {
            if (r.course?.id && r.course?.title) {
                courseMap.set(String(r.course.id), r.course.title);
            }
        });
        return Array.from(courseMap.entries()).map(([id, title]) => ({ id, title }));
    }, [reviews]);

    // KPI Metrics calculation
    const metrics = useMemo(() => {
        const total = reviews?.length || 0;
        if (total === 0) {
            return { total: 0, average: "0.0", answered: 0, unanswered: 0, responseRate: 0, fiveStars: 0 };
        }
        const answered = reviews.filter((r) => r.reply && r.reply.trim() !== "").length;
        const unanswered = total - answered;
        const sumRating = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
        const average = (sumRating / total).toFixed(1);
        const responseRate = Math.round((answered / total) * 100);
        const fiveStars = reviews.filter((r) => Number(r.rating) === 5).length;

        return { total, average, answered, unanswered, responseRate, fiveStars };
    }, [reviews]);

    // Filter and sort reviews
    const filteredReviews = useMemo(() => {
        if (!reviews || !Array.isArray(reviews)) return [];

        return reviews
            .filter((r) => {
                // Status Filter
                const hasReply = Boolean(r.reply && r.reply.trim() !== "");
                if (statusFilter === "answered" && !hasReply) return false;
                if (statusFilter === "unanswered" && hasReply) return false;

                // Rating Filter
                if (selectedRating !== 0 && Number(r.rating) !== Number(selectedRating)) return false;

                // Course Filter
                if (selectedCourseId !== "all" && String(r.course?.id) !== String(selectedCourseId)) return false;

                // Search Query Filter
                if (searchQuery.trim() !== "") {
                    const q = searchQuery.toLowerCase().trim();
                    const courseTitle = (r.course?.title || "").toLowerCase();
                    const studentName = (r.user?.full_name || "").toLowerCase();
                    const reviewText = (r.review || "").toLowerCase();
                    if (!courseTitle.includes(q) && !studentName.includes(q) && !reviewText.includes(q)) {
                        return false;
                    }
                }

                return true;
            })
            .sort((a, b) => {
                if (sortBy === "newest") {
                    return new Date(b.date) - new Date(a.date);
                }
                if (sortBy === "oldest") {
                    return new Date(a.date) - new Date(b.date);
                }
                if (sortBy === "highest") {
                    return (Number(b.rating) || 0) - (Number(a.rating) || 0);
                }
                if (sortBy === "lowest") {
                    return (Number(a.rating) || 0) - (Number(b.rating) || 0);
                }
                return 0;
            });
    }, [reviews, statusFilter, selectedRating, selectedCourseId, searchQuery, sortBy]);

    // Check if any filter is active
    const hasActiveFilters = useMemo(() => {
        return (
            searchQuery.trim() !== "" ||
            statusFilter !== "all" ||
            selectedRating !== 0 ||
            selectedCourseId !== "all" ||
            sortBy !== "newest"
        );
    }, [searchQuery, statusFilter, selectedRating, selectedCourseId, sortBy]);

    const handleResetFilters = () => {
        setSearchQuery("");
        setStatusFilter("all");
        setSelectedRating(0);
        setSelectedCourseId("all");
        setSortBy("newest");
    };

    // Toggle reply form accordion
    const handleToggleReply = (review) => {
        if (openReplyId === review.id) {
            setOpenReplyId(null);
        } else {
            setOpenReplyId(review.id);
            if (replies[review.id] === undefined) {
                setReplies((prev) => ({ ...prev, [review.id]: review.reply || "" }));
            }
        }
    };

    // Submit or update response
    const handleSubmitReply = async (reviewId) => {
        const replyText = replies[reviewId];
        if (!replyText?.trim()) return;

        setLoadingReply((prev) => ({ ...prev, [reviewId]: true }));

        try {
            const userData = UserData();
            if (!userData?.teacher_id) {
                throw new Error("Teacher ID not found");
            }
            await useAxios.patch(`teacher/review-detail/${userData.teacher_id}/${reviewId}/`, {
                reply: replyText.trim(),
            });

            await refetchReviews();
            Toast().fire({
                icon: "success",
                title: "Balasan berhasil dikirim!",
            });

            setOpenReplyId(null);
        } catch (error) {
            console.error("Error sending reply:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal mengirim balasan. Silakan coba lagi.",
            });
        } finally {
            setLoadingReply((prev) => ({ ...prev, [reviewId]: false }));
        }
    };

    // Abuse Report Handlers
    const handleOpenAbuseModal = (reviewId) => {
        const existingReport = abuseReports.find((r) => r.review?.id === reviewId);
        if (existingReport) {
            setSelectedExistingReport(existingReport);
            setShowExistingReportModal(true);
            return;
        }

        setReportingAbuseReviewId(reviewId);
        setShowAbuseModal(true);
        setAbuseReason("");
        setAbuseDescription("");
    };

    const handleCloseAbuseModal = () => {
        setShowAbuseModal(false);
        setReportingAbuseReviewId(null);
        setAbuseReason("");
        setAbuseDescription("");
    };

    const handleCloseExistingReportModal = () => {
        setShowExistingReportModal(false);
        setSelectedExistingReport(null);
        setIsEditingReport(false);
        setEditReason("");
        setEditDescription("");
    };

    const handleEditExistingReport = () => {
        if (selectedExistingReport) {
            setEditReason(selectedExistingReport.reason || "");
            setEditDescription(selectedExistingReport.description || "");
            setIsEditingReport(true);
        }
    };

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

            setSelectedExistingReport(response.data);
            fetchAbuseReports();
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

            setSelectedExistingReport(response.data);
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

    return (
        <>
            <BaseHeader />

            <section className="instructor-review-page">
                <div className="container">
                    <Header />

                    <div className="row">
                        <Sidebar />

                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Page Header Bar */}
                            <div className="reviews-header-card">
                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                    <div>
                                        <h2 className="reviews-title mb-1">
                                            <i className="fas fa-star-half-alt text-teal me-2"></i>
                                            Ulasan Kursus
                                        </h2>
                                        <p className="reviews-subtitle mb-0">
                                            Pantau kepuasan siswa, respon umpan balik, dan tingkatkan mutu pembelajaran
                                        </p>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-teal"
                                            onClick={() => refetchReviews()}
                                            title="Segarkan data ulasan"
                                            disabled={loading}
                                        >
                                            <i className={`fas fa-sync-alt me-1 ${loading ? "fa-spin" : ""}`}></i>
                                            Segarkan
                                        </button>
                                        <span className="reviews-counter-pill">
                                            <i className="fas fa-comments me-1"></i>
                                            {metrics.total} Total
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* KPI Metrics Strip */}
                            <div className="reviews-metrics-grid">
                                <div className="review-metric-card">
                                    <div className="metric-icon-box bg-teal-subtle text-teal">
                                        <i className="fas fa-comment-dots"></i>
                                    </div>
                                    <div className="metric-content">
                                        <span className="metric-value">{metrics.total}</span>
                                        <span className="metric-label">Total Ulasan</span>
                                    </div>
                                    <span className="metric-badge bg-light text-muted">Semua kursus</span>
                                </div>

                                <div className="review-metric-card">
                                    <div className="metric-icon-box bg-amber-subtle text-amber">
                                        <i className="fas fa-star"></i>
                                    </div>
                                    <div className="metric-content">
                                        <div className="d-flex align-items-baseline gap-1">
                                            <span className="metric-value">{metrics.average}</span>
                                            <small className="text-muted fw-normal">/ 5.0</small>
                                        </div>
                                        <span className="metric-label">Rata-rata Rating</span>
                                    </div>
                                    <span className="metric-badge bg-amber-subtle text-amber">
                                        ★ {metrics.fiveStars} Bintang 5
                                    </span>
                                </div>

                                <div className="review-metric-card">
                                    <div className="metric-icon-box bg-emerald-subtle text-emerald">
                                        <i className="fas fa-check-circle"></i>
                                    </div>
                                    <div className="metric-content">
                                        <span className="metric-value">{metrics.answered}</span>
                                        <span className="metric-label">Sudah Dibalas</span>
                                    </div>
                                    <span className="metric-badge bg-emerald-subtle text-emerald">
                                        {metrics.responseRate}% Terjawab
                                    </span>
                                </div>

                                <div className="review-metric-card">
                                    <div className="metric-icon-box bg-coral-subtle text-coral">
                                        <i className="fas fa-reply"></i>
                                    </div>
                                    <div className="metric-content">
                                        <span className="metric-value">{metrics.unanswered}</span>
                                        <span className="metric-label">Belum Dibalas</span>
                                    </div>
                                    <span className={`metric-badge ${metrics.unanswered > 0 ? "bg-coral-subtle text-coral fw-bold" : "bg-light text-muted"}`}>
                                        {metrics.unanswered > 0 ? "Perlu Respons" : "Semua Selesai"}
                                    </span>
                                </div>
                            </div>

                            {/* Filter & Search Toolbar */}
                            <div className="reviews-toolbar-card">
                                {/* Top Row: Status Tabs & Rating Pills */}
                                <div className="toolbar-top-row">
                                    {/* Status Filter Tabs */}
                                    <div className="status-filter-pills">
                                        <button
                                            type="button"
                                            className={`status-pill ${statusFilter === "all" ? "active" : ""}`}
                                            onClick={() => setStatusFilter("all")}
                                        >
                                            Semua ({metrics.total})
                                        </button>
                                        <button
                                            type="button"
                                            className={`status-pill ${statusFilter === "unanswered" ? "active" : ""}`}
                                            onClick={() => setStatusFilter("unanswered")}
                                        >
                                            <i className="fas fa-clock me-1 text-coral"></i>
                                            Belum Dibalas ({metrics.unanswered})
                                        </button>
                                        <button
                                            type="button"
                                            className={`status-pill ${statusFilter === "answered" ? "active" : ""}`}
                                            onClick={() => setStatusFilter("answered")}
                                        >
                                            <i className="fas fa-check-circle me-1 text-emerald"></i>
                                            Sudah Dibalas ({metrics.answered})
                                        </button>
                                    </div>

                                    {/* Star Rating Pills */}
                                    <div className="rating-filter-pills">
                                        <span className="filter-label d-none d-sm-inline">Rating:</span>
                                        <button
                                            type="button"
                                            className={`rating-pill ${selectedRating === 0 ? "active" : ""}`}
                                            onClick={() => setSelectedRating(0)}
                                        >
                                            Semua
                                        </button>
                                        {[5, 4, 3, 2, 1].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                className={`rating-pill ${selectedRating === star ? "active" : ""}`}
                                                onClick={() => setSelectedRating(selectedRating === star ? 0 : star)}
                                                title={`Filter ${star} Bintang`}
                                            >
                                                ★ {star}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Bottom Row: Search, Course Filter, Sort */}
                                <div className="toolbar-bottom-row">
                                    <div className="search-input-wrapper">
                                        <i className="fas fa-search search-icon"></i>
                                        <input
                                            type="text"
                                            className="form-control compact-input"
                                            placeholder="Cari kursus, nama siswa, atau kata kunci ulasan..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                className="btn-clear-search"
                                                onClick={() => setSearchQuery("")}
                                                title="Hapus pencarian"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>

                                    {/* Course Select Dropdown */}
                                    {uniqueCourses.length > 1 && (
                                        <div className="select-input-wrapper course-select">
                                            <select
                                                className="form-select compact-select"
                                                value={selectedCourseId}
                                                onChange={(e) => setSelectedCourseId(e.target.value)}
                                            >
                                                <option value="all">Semua Kursus ({uniqueCourses.length})</option>
                                                {uniqueCourses.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.title}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Sort Dropdown */}
                                    <div className="select-input-wrapper sort-select">
                                        <select
                                            className="form-select compact-select"
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value)}
                                        >
                                            <option value="newest">Terbaru</option>
                                            <option value="oldest">Terlama</option>
                                            <option value="highest">Rating Tertinggi</option>
                                            <option value="lowest">Rating Terendah</option>
                                        </select>
                                    </div>

                                    {/* Reset Filters Button */}
                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            className="btn-reset-filters"
                                            onClick={handleResetFilters}
                                            title="Reset semua filter"
                                        >
                                            <i className="fas fa-undo-alt me-1"></i>
                                            Reset
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Reviews List Container */}
                            <div className="reviews-list-wrapper">
                                {loading ? (
                                    <div className="reviews-loading-state">
                                        <div className="spinner-border text-teal spinner-border-sm me-2" role="status">
                                            <span className="visually-hidden">Memuat...</span>
                                        </div>
                                        <span>Memuat data ulasan siswa...</span>
                                    </div>
                                ) : filteredReviews.length > 0 ? (
                                    <div className="reviews-cards-stack">
                                        {filteredReviews.map((r, index) => {
                                            const existingReport = abuseReports.find((rpt) => rpt.review?.id === r.id);
                                            const hasReply = Boolean(r.reply && r.reply.trim() !== "");
                                            const isReplyFormOpen = openReplyId === r.id;
                                            const ratingScore = Number(r.rating) || 0;

                                            return (
                                                <div
                                                    key={r.id || index}
                                                    className={`compact-review-card ${hasReply ? "has-reply" : "no-reply"}`}
                                                >
                                                    {/* Card Header */}
                                                    <div className="review-card-topbar">
                                                        {/* Left: Avatar & User / Course Info */}
                                                        <div className="reviewer-main-meta">
                                                            <div className="reviewer-avatar-box">
                                                                {r.user?.image ? (
                                                                    <img
                                                                        src={r.user.image}
                                                                        alt={r.user.full_name || "Siswa"}
                                                                        className="reviewer-img"
                                                                        onError={(e) => {
                                                                            e.target.style.display = "none";
                                                                            if (e.target.nextSibling) {
                                                                                e.target.nextSibling.style.display = "flex";
                                                                            }
                                                                        }}
                                                                    />
                                                                ) : null}
                                                                <div
                                                                    className="reviewer-initial-fallback"
                                                                    style={{ display: r.user?.image ? "none" : "flex" }}
                                                                >
                                                                    {r.user?.full_name
                                                                        ? r.user.full_name.charAt(0).toUpperCase()
                                                                        : <i className="fas fa-user"></i>}
                                                                </div>
                                                            </div>

                                                            <div className="reviewer-details">
                                                                <div className="d-flex align-items-center flex-wrap gap-2">
                                                                    <h5 className="reviewer-name mb-0">
                                                                        {r.user?.full_name || "Siswa Anonymous"}
                                                                    </h5>
                                                                    {r.user?.jenis_jabatan && (
                                                                        <span className="user-role-badge">
                                                                            {r.user.jenis_jabatan}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="reviewer-submeta">
                                                                    <span className="review-timestamp">
                                                                        <i className="far fa-calendar-alt me-1"></i>
                                                                        {moment(r.date).format("DD MMM YYYY")}
                                                                    </span>
                                                                    <span className="meta-separator">•</span>
                                                                    <span className="review-course-name" title={r.course?.title || "Kursus"}>
                                                                        <i className="fas fa-book-reader me-1 text-teal"></i>
                                                                        {r.course?.title || "Kursus Tidak Tersedia"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right: Rating Stars & Status Badges */}
                                                        <div className="review-card-actions-meta">
                                                            <div className="rating-display-group">
                                                                <Rating
                                                                    initialValue={ratingScore}
                                                                    readonly={true}
                                                                    size={15}
                                                                    fillColor="#f59e0b"
                                                                    emptyColor="#e2e8f0"
                                                                    SVGstyle={{ display: "inline-block" }}
                                                                />
                                                                <span className="rating-numeric-tag">
                                                                    {ratingScore.toFixed(1)}
                                                                </span>
                                                            </div>

                                                            {/* Reply Status Tag */}
                                                            {hasReply ? (
                                                                <span className="status-tag replied" title="Ulasan sudah memiliki balasan instuktur">
                                                                    <i className="fas fa-check-circle me-1"></i>
                                                                    Dibalas
                                                                </span>
                                                            ) : (
                                                                <span className="status-tag unreplied" title="Menunggu tanggapan dari instruktur">
                                                                    <i className="fas fa-clock me-1"></i>
                                                                    Belum Dibalas
                                                                </span>
                                                            )}

                                                            {/* Abuse Report Button / Status */}
                                                            {existingReport ? (
                                                                <button
                                                                    type="button"
                                                                    className={`btn-report-status ${existingReport.status || "reported"}`}
                                                                    onClick={() => handleOpenAbuseModal(r.id)}
                                                                    title="Klik untuk melihat detail laporan pelanggaran"
                                                                >
                                                                    <i className="fas fa-flag me-1"></i>
                                                                    <span>{existingReport.status || "Dilaporkan"}</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="btn-flag-abuse"
                                                                    onClick={() => handleOpenAbuseModal(r.id)}
                                                                    title="Laporkan ulasan yang melanggar aturan"
                                                                >
                                                                    <i className="far fa-flag"></i>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Review Comment Text */}
                                                    <div className="review-body-content">
                                                        <p className="student-comment-text mb-0">
                                                            {r.review}
                                                        </p>
                                                    </div>

                                                    {/* Existing Instructor Reply Section */}
                                                    {hasReply && (
                                                        <div className="instructor-reply-box">
                                                            <div className="reply-header-row">
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <span className="reply-author-badge">
                                                                        <i className="fas fa-reply me-1"></i>
                                                                        Respons Instruktur
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="btn-edit-reply-link"
                                                                    onClick={() => handleToggleReply(r)}
                                                                >
                                                                    <i className="fas fa-pencil-alt me-1"></i>
                                                                    {isReplyFormOpen ? "Tutup Editor" : "Edit Respons"}
                                                                </button>
                                                            </div>
                                                            <p className="instructor-reply-text mb-0">
                                                                {r.reply}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Reply CTA button when no reply yet */}
                                                    {!hasReply && !isReplyFormOpen && (
                                                        <div className="reply-cta-row">
                                                            <button
                                                                type="button"
                                                                className="btn-quick-reply"
                                                                onClick={() => handleToggleReply(r)}
                                                            >
                                                                <i className="fas fa-reply me-1"></i>
                                                                Beri Tanggapan / Respons
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Inline Reply Accordion Form */}
                                                    {isReplyFormOpen && (
                                                        <div className="inline-reply-editor">
                                                            <div className="editor-header">
                                                                <span className="editor-title">
                                                                    <i className="fas fa-pen-alt me-1 text-teal"></i>
                                                                    {hasReply ? "Edit Tanggapan Anda" : "Tulis Tanggapan untuk Siswa"}
                                                                </span>
                                                                <span className="editor-hint">
                                                                    Tanggapan Anda akan tampil di halaman kursus
                                                                </span>
                                                            </div>
                                                            <textarea
                                                                className="form-control reply-textarea"
                                                                rows="3"
                                                                value={replies[r.id] ?? r.reply ?? ""}
                                                                onChange={(e) => setReplies({ ...replies, [r.id]: e.target.value })}
                                                                placeholder="Tuliskan ucapan terima kasih atau jawaban atas masukan siswa..."
                                                                disabled={loadingReply[r.id]}
                                                            />
                                                            <div className="editor-footer">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-light text-muted"
                                                                    onClick={() => setOpenReplyId(null)}
                                                                    disabled={loadingReply[r.id]}
                                                                >
                                                                    Batal
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-teal"
                                                                    onClick={() => handleSubmitReply(r.id)}
                                                                    disabled={!replies[r.id]?.trim() || loadingReply[r.id]}
                                                                >
                                                                    {loadingReply[r.id] ? (
                                                                        <>
                                                                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                                            Mengirim...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <i className="fas fa-paper-plane me-1"></i>
                                                                            {hasReply ? "Simpan Perubahan" : "Kirim Tanggapan"}
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    /* Empty State */
                                    <div className="reviews-empty-box">
                                        <div className="empty-icon-circle">
                                            <i className="fas fa-star-half-alt"></i>
                                        </div>
                                        <h5 className="empty-title mb-1">
                                            {hasActiveFilters ? "Tidak Ada Ulasan yang Cocok" : "Belum Ada Ulasan Kursus"}
                                        </h5>
                                        <p className="empty-desc mb-3">
                                            {hasActiveFilters
                                                ? "Coba ubah kriteria pencarian, rating, atau filter status ulasan Anda."
                                                : "Ketika siswa menyelesaikan kursus dan memberikan ulasan, umpan balik mereka akan muncul di sini."}
                                        </p>
                                        {hasActiveFilters && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-teal"
                                                onClick={handleResetFilters}
                                            >
                                                <i className="fas fa-undo-alt me-1"></i>
                                                Reset Filter Pencarian
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Abuse Report Modal */}
            {showAbuseModal && (
                <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered modal-compact-dialog">
                        <div className="modal-content abuse-report-modal">
                            <div className="modal-header abuse-modal-header">
                                <h6 className="modal-title mb-0">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    Laporkan Ulasan Bermasalah
                                </h6>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={handleCloseAbuseModal}
                                    disabled={reportingAbuse}
                                ></button>
                            </div>
                            <div className="modal-body p-3">
                                <p className="text-muted small mb-3">
                                    Bantu kami menjaga komunitas tetap santun dan kondusif dengan melaporkan ulasan yang tidak pantas.
                                </p>

                                <div className="mb-3">
                                    <label className="form-label small fw-semibold">
                                        Alasan Pelaporan <span className="text-danger">*</span>
                                    </label>
                                    <select
                                        className="form-select compact-select"
                                        value={abuseReason}
                                        onChange={(e) => setAbuseReason(e.target.value)}
                                        disabled={reportingAbuse}
                                    >
                                        <option value="">-- Pilih Alasan --</option>
                                        <option value="inappropriate_content">Konten Tidak Pantas</option>
                                        <option value="spam">Spam / Iklan</option>
                                        <option value="offensive_language">Bahasa Kasar / Menghina</option>
                                        <option value="false_information">Informasi Palsu / Menyesatkan</option>
                                        <option value="harassment">Pelecehan</option>
                                        <option value="other">Lainnya</option>
                                    </select>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label small fw-semibold">Penjelasan Tambahan (Opsional)</label>
                                    <textarea
                                        className="form-control compact-input"
                                        rows="3"
                                        placeholder="Berikan detail tambahan untuk membantu Admin menindaklanjuti..."
                                        value={abuseDescription}
                                        onChange={(e) => setAbuseDescription(e.target.value)}
                                        disabled={reportingAbuse}
                                        maxLength={500}
                                    ></textarea>
                                    <small className="text-muted">Maksimal 500 karakter</small>
                                </div>

                                <div className="alert alert-light border small p-2 mb-0 text-muted">
                                    <i className="fas fa-info-circle text-teal me-1"></i>
                                    Laporan ini akan ditinjau langsung oleh tim Administrator sistem.
                                </div>
                            </div>
                            <div className="modal-footer p-2 bg-light">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={handleCloseAbuseModal}
                                    disabled={reportingAbuse}
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-danger"
                                    onClick={handleSubmitAbuseReport}
                                    disabled={reportingAbuse || !abuseReason.trim()}
                                >
                                    {reportingAbuse ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                            Mengirim...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-paper-plane me-1"></i>
                                            Kirim Laporan
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Report Details Modal */}
            {showExistingReportModal && selectedExistingReport && (
                <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog modal-dialog-centered modal-compact-dialog">
                        <div className="modal-content abuse-report-modal">
                            <div className="modal-header abuse-modal-header">
                                <h6 className="modal-title mb-0">
                                    <i className="fas fa-file-alt me-2"></i>
                                    Status Laporan Pelanggaran
                                </h6>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={handleCloseExistingReportModal}
                                ></button>
                            </div>
                            <div className="modal-body p-3">
                                {/* Report Status */}
                                <div className="mb-3">
                                    <label className="form-label small fw-semibold">Status Saat Ini</label>
                                    <div
                                        className={`alert p-2 small mb-0 alert-${
                                            selectedExistingReport.status === "pending"
                                                ? "warning"
                                                : selectedExistingReport.status === "reviewed"
                                                ? "info"
                                                : selectedExistingReport.status === "action_taken"
                                                ? "success"
                                                : "danger"
                                        }`}
                                    >
                                        <i
                                            className={`fas ${
                                                selectedExistingReport.status === "pending"
                                                    ? "fa-clock"
                                                    : selectedExistingReport.status === "reviewed"
                                                    ? "fa-eye"
                                                    : selectedExistingReport.status === "action_taken"
                                                    ? "fa-check-circle"
                                                    : "fa-times-circle"
                                            } me-2`}
                                        ></i>
                                        <strong>
                                            {selectedExistingReport.status === "pending" && "Menunggu Review Admin"}
                                            {selectedExistingReport.status === "reviewed" && "Sudah Ditinjau"}
                                            {selectedExistingReport.status === "action_taken" && "Tindakan Telah Diambil"}
                                            {selectedExistingReport.status === "dismissed" && "Laporan Ditolak"}
                                        </strong>
                                    </div>
                                </div>

                                {/* Reason */}
                                <div className="mb-3">
                                    <label className="form-label small fw-semibold">Alasan Laporan</label>
                                    {isEditingReport ? (
                                        <select
                                            className="form-select compact-select"
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
                                        <p className="text-muted small mb-0">{selectedExistingReport.reason || "-"}</p>
                                    )}
                                </div>

                                {/* Description */}
                                <div className="mb-3">
                                    <label className="form-label small fw-semibold">Deskripsi</label>
                                    {isEditingReport ? (
                                        <textarea
                                            className="form-control compact-input"
                                            rows="3"
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            disabled={updatingExistingReport}
                                            maxLength={500}
                                        />
                                    ) : (
                                        <p className="text-muted small mb-0" style={{ whiteSpace: "pre-wrap" }}>
                                            {selectedExistingReport.description || "-"}
                                        </p>
                                    )}
                                </div>

                                {/* Admin Notes */}
                                {selectedExistingReport.review_notes && (
                                    <div className="mb-3">
                                        <label className="form-label small fw-semibold">Catatan dari Admin</label>
                                        <div className="alert alert-light border small p-2 mb-0">
                                            <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                                                {selectedExistingReport.review_notes}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="d-flex justify-content-between text-muted small mt-2">
                                    <span>
                                        Dilaporkan: {moment(selectedExistingReport.reported_at).format("DD MMM YYYY HH:mm")}
                                    </span>
                                    {selectedExistingReport.reviewed_at && (
                                        <span>
                                            Ditinjau: {moment(selectedExistingReport.reviewed_at).format("DD MMM YYYY HH:mm")}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer p-2 bg-light">
                                {selectedExistingReport.closed_by_reporter ? (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary"
                                        onClick={handleCloseExistingReportModal}
                                    >
                                        Tutup
                                    </button>
                                ) : isEditingReport ? (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => setIsEditingReport(false)}
                                            disabled={updatingExistingReport}
                                        >
                                            Batal
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-danger"
                                            onClick={handleUpdateExistingReport}
                                            disabled={updatingExistingReport || !editReason.trim()}
                                        >
                                            {updatingExistingReport ? "Memperbarui..." : "Perbarui Laporan"}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={handleEditExistingReport}
                                            disabled={selectedExistingReport.status !== "pending"}
                                        >
                                            <i className="fas fa-edit me-1"></i>
                                            Laporkan Ulang
                                        </button>
                                        {selectedExistingReport.status !== "pending" && (
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-success"
                                                onClick={handleCloseReport}
                                                disabled={closingReport}
                                            >
                                                <i className="fas fa-check-circle me-1"></i>
                                                Masalah Selesai
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-secondary ms-auto"
                                            onClick={handleCloseExistingReportModal}
                                        >
                                            Tutup
                                        </button>
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