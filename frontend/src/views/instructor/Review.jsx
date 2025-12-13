import React, { useState, useEffect } from "react";
import dayjs, { moment } from "../../utils/dayjs";
import { Rating } from 'react-simple-star-rating';

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

    useEffect(() => {
        fetchReviewsData();
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
                title: "Reply sent successfully!",
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
                title: "Failed to send reply. Please try again.",
            });
        } finally {
            setLoadingReply({...loadingReply, [reviewId]: false});
        }
    };

    const handleSortByDate = (e) => {
        const sortValue = e.target.value;
        let sortedReview = [...filteredReviews];
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

    // Show full-page loading spinner on initial load
    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-review-page" style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center' }}>
                    <div className="container" style={{ flex: 1 }}>
                        <Header />
                        <div className="row">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Loading Reviews...</p>
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

            <section className="instructor-review-page" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
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
                                            <i className="fas fa-star-half-alt me-3 page-title-icon"></i>Course Reviews
                                        </h1>
                                        <p className="mb-0 text-muted page-subtitle">
                                            Monitor feedback and engage with your students
                                        </p>
                                    </div>
                                    <div className="text-end">
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="stat-badge">
                                                <i className="fas fa-comments stat-badge-icon"></i>
                                                {filteredReviews?.length || 0} Reviews
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
                                                placeholder="Search by course name..." 
                                                onChange={handleFilterByCourse}
                                            />
                                        </div>
                                    </div>
                                    <div className="col-xl-2 col-lg-2 col-md-4 col-12">
                                        <select 
                                            className="form-select modern-select" 
                                            onChange={handleSortByRatingChange}
                                        >
                                            <option value={0}>All Ratings</option>
                                            <option value={5}>5 Stars</option>
                                            <option value={4}>4 Stars</option>
                                            <option value={3}>3 Stars</option>
                                            <option value={2}>2 Stars</option>
                                            <option value={1}>1 Star</option>
                                        </select>
                                    </div>
                                    <div className="col-xl-3 col-lg-3 col-md-4 col-12">
                                        <select 
                                            className="form-select modern-select" 
                                            onChange={handleSortByDate}
                                        >
                                            <option value="">Sort by Date</option>
                                            <option value="Newest">Newest First</option>
                                            <option value="Oldest">Oldest First</option>
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
                                                                {r.profile?.image ? (
                                                                    <img
                                                                        src={r.profile.image}
                                                                        alt="avatar"
                                                                        className="reviewer-avatar rounded-circle"
                                                                        onError={(e) => {
                                                                            e.target.style.display = 'none';
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
                                                                        {r.profile.full_name}
                                                                    </h4>
                                                                    <span className="review-date">
                                                                        <i className="fas fa-calendar-alt review-date-icon"></i>
                                                                        {moment(r.date).format("DD MMM, YYYY")}
                                                                    </span>
                                                                </div>
                                                                <button 
                                                                    className="btn report-btn" 
                                                                    data-bs-toggle="tooltip" 
                                                                    data-placement="top" 
                                                                    title="Report Abuse"
                                                                >
                                                                    <i className="fas fa-flag" />
                                                                </button>
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
                                                                <span className="rating-label">for</span>
                                                                <span className="course-title">
                                                                    {r.course?.title}
                                                                </span>
                                                            </div>

                                                            <div className="review-content">
                                                                <div className="review-content-label">
                                                                    <i className="fas fa-quote-left review-quote-icon"></i>
                                                                    <span className="review-label-text">Student Review</span>
                                                                </div>
                                                                <p className="review-text">
                                                                    {r.review}
                                                                </p>
                                                            </div>

                                                            {r.reply && (
                                                                <div className="response-content">
                                                                    <div className="response-content-label">
                                                                        <i className="fas fa-reply response-icon"></i>
                                                                        <span className="response-label-text">Your Response</span>
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
                                                                    {r.reply ? 'Update Response' : 'Send Response'}
                                                                </button>
                                                            </div>
                                                            
                                                            {/* Modern Collapse Section */}
                                                            <div className="collapse mt-4" id={`collapse${r.id}`}>
                                                                <div className="modern-response-form">
                                                                    <div className="mb-3">
                                                                        <label htmlFor={`response-${r.id}`} className="form-label">
                                                                            <i className="fas fa-pen-fancy form-label-icon"></i>
                                                                            Write Your Response
                                                                        </label>
                                                                        <textarea 
                                                                            id={`response-${r.id}`}
                                                                            className="form-control modern-textarea" 
                                                                            rows="4" 
                                                                            value={replies[r.id] || ""}
                                                                            onChange={(e) => setReplies({...replies, [r.id]: e.target.value})}
                                                                            placeholder="Share your thoughts and appreciation for this review..."
                                                                            disabled={loadingReply[r.id]}
                                                                        ></textarea>
                                                                        <div className="form-text">
                                                                            <small className="text-muted">
                                                                                <i className="fas fa-info-circle form-text-icon"></i>
                                                                                Your response will be visible to the student and help build better relationships.
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
                                                                            <i className="fas fa-times"></i>
                                                                            Cancel
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
                                                                                    <strong>Sending...</strong>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <i className="fas fa-paper-plane submit-icon"></i>
                                                                                    Send Response
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
                                        <h4 className="empty-state-title">No Reviews Found</h4>
                                        <p className="empty-state-text">
                                            When students review your courses, they'll appear here for you to respond to.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default React.memo(Review);