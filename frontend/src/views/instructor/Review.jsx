import { useState, useEffect } from "react";
import moment from "moment";
import { Rating } from 'react-simple-star-rating';

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import { teacherId } from "../../utils/constants";
import Toast from "../plugin/Toast";

function Review() {
    const [reviews, setReviews] = useState([]);
    const [replies, setReplies] = useState({});
    const [filteredReviews, setFilteredReview] = useState([]);
    const [loadingReply, setLoadingReply] = useState({});

    const fetchReviewsData = () => {
        useAxios.get(`teacher/review-lists/${teacherId}/`).then((res) => {
            setReviews(res.data);
            setFilteredReview(res.data);
        });
    };

    useEffect(() => {
        fetchReviewsData();
    }, []);

    const handleSubmitReply = async (reviewId) => {
        const replyText = replies[reviewId];
        if (!replyText?.trim()) return;
        
        setLoadingReply({...loadingReply, [reviewId]: true});
        
        try {
            await useAxios.patch(`teacher/review-detail/${teacherId}/${reviewId}/`, {
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

    return (
        <>
            <BaseHeader />

            <section className="instructor-review-page">
                <div className="container">
                    {/* Header Here */}
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        {/* Sidebar Here */}
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Modern Header Section */}
                            <div className="modern-header-section mb-4" style={{
                                background: 'rgba(255, 255, 255, 0.95)',
                                backdropFilter: 'blur(10px)',
                                borderRadius: '20px',
                                padding: '30px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    top: '-50%',
                                    right: '-20%',
                                    width: '300px',
                                    height: '300px',
                                    background: 'linear-gradient(45deg, #3498db20, #2980b920)',
                                    borderRadius: '50%',
                                    zIndex: 1
                                }}></div>
                                <div className="d-flex align-items-center justify-content-between position-relative" style={{ zIndex: 2 }}>
                                    <div>
                                        <h1 className="mb-2" style={{
                                            background: 'linear-gradient(135deg, #3498db, #2980b9)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            fontSize: '2.5rem',
                                            fontWeight: 'bold'
                                        }}>
                                            <i className="fas fa-star-half-alt me-3"></i>Course Reviews
                                        </h1>
                                        <p className="mb-0 text-muted" style={{ fontSize: '1.1rem' }}>
                                            Monitor feedback and engage with your students
                                        </p>
                                    </div>
                                    <div className="text-end">
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="stat-badge" style={{
                                                background: 'linear-gradient(135deg, #28a745, #20c997)',
                                                color: 'white',
                                                padding: '12px 20px',
                                                borderRadius: '15px',
                                                fontSize: '0.9rem',
                                                fontWeight: '600'
                                            }}>
                                                <i className="fas fa-comments me-2"></i>
                                                {filteredReviews?.length || 0} Reviews
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modern Filter Section */}
                            <div className="modern-filter-section mb-4" style={{
                                background: 'rgba(255, 255, 255, 0.95)',
                                backdropFilter: 'blur(10px)',
                                borderRadius: '15px',
                                padding: '25px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
                            }}>
                                <div className="row g-3">
                                    <div className="col-xl-7 col-lg-6 col-md-4 col-12">
                                        <div className="modern-search-container" style={{ position: 'relative' }}>
                                            <i className="fas fa-search" style={{
                                                position: 'absolute',
                                                left: '15px',
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                color: '#3498db',
                                                zIndex: 2
                                            }}></i>
                                            <input 
                                                type="text" 
                                                className="form-control modern-input" 
                                                placeholder="Search by course name..." 
                                                onChange={handleFilterByCourse}
                                                style={{
                                                    paddingLeft: '45px',
                                                    height: '50px',
                                                    border: '2px solid #e9ecef',
                                                    borderRadius: '12px',
                                                    fontSize: '0.95rem',
                                                    transition: 'all 0.3s ease'
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.borderColor = '#3498db';
                                                    e.target.style.boxShadow = '0 0 0 0.2rem rgba(52, 152, 219, 0.25)';
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.borderColor = '#e9ecef';
                                                    e.target.style.boxShadow = 'none';
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="col-xl-2 col-lg-2 col-md-4 col-12">
                                        <select 
                                            className="form-select modern-select" 
                                            onChange={handleSortByRatingChange}
                                            style={{
                                                height: '50px',
                                                border: '2px solid #e9ecef',
                                                borderRadius: '12px',
                                                fontSize: '0.95rem',
                                                background: 'white'
                                            }}
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
                                            style={{
                                                height: '50px',
                                                border: '2px solid #e9ecef',
                                                borderRadius: '12px',
                                                fontSize: '0.95rem',
                                                background: 'white'
                                            }}
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
                                                <div className="modern-review-card" style={{
                                                    background: 'rgba(255, 255, 255, 0.95)',
                                                    backdropFilter: 'blur(10px)',
                                                    borderRadius: '20px',
                                                    padding: '30px',
                                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                                                    transition: 'all 0.3s ease',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(-5px)';
                                                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
                                                }}
                                                >
                                                    <div className="row g-3">
                                                        <div className="col-auto">
                                                            <div className="modern-avatar-container" style={{
                                                                position: 'relative',
                                                                padding: '4px',
                                                                background: 'linear-gradient(135deg, #3498db, #2980b9)',
                                                                borderRadius: '50%'
                                                            }}>
                                                                <img
                                                                    src={r.profile.image}
                                                                    alt="avatar"
                                                                    className="rounded-circle"
                                                                    style={{
                                                                        width: "70px",
                                                                        height: "70px",
                                                                        objectFit: "cover",
                                                                        border: '3px solid white'
                                                                    }}
                                                                />
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    bottom: '5px',
                                                                    right: '5px',
                                                                    width: '20px',
                                                                    height: '20px',
                                                                    background: '#28a745',
                                                                    borderRadius: '50%',
                                                                    border: '2px solid white',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center'
                                                                }}>
                                                                    <i className="fas fa-check" style={{ fontSize: '8px', color: 'white' }}></i>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="col">
                                                            <div className="d-flex align-items-center justify-content-between mb-3">
                                                                <div>
                                                                    <h4 className="mb-1" style={{ 
                                                                        color: '#2c3e50',
                                                                        fontWeight: '600'
                                                                    }}>
                                                                        {r.profile.full_name}
                                                                    </h4>
                                                                    <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                                                                        <i className="fas fa-calendar-alt me-1"></i>
                                                                        {moment(r.date).format("DD MMM, YYYY")}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <button 
                                                                        className="btn btn-outline-danger btn-sm" 
                                                                        data-bs-toggle="tooltip" 
                                                                        data-placement="top" 
                                                                        title="Report Abuse"
                                                                        style={{
                                                                            border: 'none',
                                                                            background: 'rgba(220, 53, 69, 0.1)',
                                                                            color: '#dc3545',
                                                                            borderRadius: '10px',
                                                                            padding: '8px 12px'
                                                                        }}
                                                                    >
                                                                        <i className="fas fa-flag" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="mb-3">
                                                                <div className="d-flex align-items-center mb-2">
                                                                    <Rating
                                                                        initialValue={r.rating || 0}
                                                                        readonly={true}
                                                                        size={18}
                                                                        fillColor="#ffc107"
                                                                        emptyColor="#e4e5e9"
                                                                    />
                                                                    <span className="ms-2 me-1 text-muted">for</span>
                                                                    <span className="fw-bold" style={{ color: '#3498db' }}>
                                                                        {r.course?.title}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="review-content mb-3" style={{
                                                                background: 'rgba(102, 126, 234, 0.05)',
                                                                padding: '20px',
                                                                borderRadius: '15px',
                                                                border: '1px solid rgba(102, 126, 234, 0.1)'
                                                            }}>
                                                                <div className="d-flex align-items-start mb-2">
                                                                    <i className="fas fa-quote-left" style={{ 
                                                                        color: '#667eea', 
                                                                        fontSize: '1.2rem',
                                                                        marginRight: '10px',
                                                                        marginTop: '2px'
                                                                    }}></i>
                                                                    <span className="fw-bold text-dark">Student Review</span>
                                                                </div>
                                                                <p className="mb-0" style={{ 
                                                                    fontSize: '1rem',
                                                                    lineHeight: '1.6',
                                                                    color: '#2c3e50'
                                                                }}>
                                                                    {r.review}
                                                                </p>
                                                            </div>

                                                            {r.reply && (
                                                                <div className="response-content mb-3" style={{
                                                                    background: 'rgba(40, 167, 69, 0.05)',
                                                                    padding: '20px',
                                                                    borderRadius: '15px',
                                                                    border: '1px solid rgba(40, 167, 69, 0.1)'
                                                                }}>
                                                                    <div className="d-flex align-items-start mb-2">
                                                                        <i className="fas fa-reply" style={{ 
                                                                            color: '#28a745', 
                                                                            fontSize: '1.1rem',
                                                                            marginRight: '10px',
                                                                            marginTop: '2px'
                                                                        }}></i>
                                                                        <span className="fw-bold text-dark">Your Response</span>
                                                                    </div>
                                                                    <p className="mb-0" style={{ 
                                                                        fontSize: '0.95rem',
                                                                        lineHeight: '1.6',
                                                                        color: '#2c3e50'
                                                                    }}>
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
                                                                    style={{
                                                                        background: 'linear-gradient(135deg, #3498db, #2980b9)',
                                                                        border: 'none',
                                                                        color: 'white',
                                                                        borderRadius: '12px',
                                                                        padding: '12px 24px',
                                                                        fontSize: '0.9rem',
                                                                        fontWeight: '600',
                                                                        transition: 'all 0.3s ease'
                                                                        
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.target.style.transform = 'translateY(-2px)';
                                                                        e.target.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.3)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.target.style.transform = 'translateY(0)';
                                                                        e.target.style.boxShadow = 'none';
                                                                    }}
                                                                >
                                                                    <i className="fas fa-reply me-2"></i>
                                                                    {r.reply ? 'Update Response' : 'Send Response'}
                                                                </button>
                                                            </div>
                                                            
                                                            {/* Modern Collapse Section */}
                                                            <div className="collapse mt-4" id={`collapse${r.id}`}>
                                                                <div className="modern-response-form" style={{
                                                                    background: 'rgba(248, 249, 250, 0.8)',
                                                                    borderRadius: '15px',
                                                                    padding: '25px',
                                                                    border: '1px solid rgba(0, 0, 0, 0.1)'
                                                                }}>
                                                                    <div className="mb-3">
                                                                        <label htmlFor={`response-${r.id}`} className="form-label" style={{
                                                                            fontWeight: '600',
                                                                            color: '#2c3e50',
                                                                            fontSize: '1rem'
                                                                        }}>
                                                                            <i className="fas fa-pen-fancy me-2" style={{ color: '#3498db' }}></i>
                                                                            Write Your Response
                                                                        </label>
                                                                        <textarea 
                                                                            id={`response-${r.id}`}
                                                                            className="form-control modern-textarea" 
                                                                            rows="4" 
                                                                            value={replies[r.id] || ""}
                                                                            onChange={(e) => setReplies({...replies, [r.id]: e.target.value})}
                                                                            placeholder="Share your thoughts and appreciation for this review..."
                                                                            style={{ 
                                                                                resize: 'vertical',
                                                                                minHeight: '120px',
                                                                                fontSize: '0.95rem',
                                                                                border: '2px solid #e9ecef',
                                                                                borderRadius: '12px',
                                                                                padding: '15px',
                                                                                transition: 'all 0.3s ease'
                                                                            }}
                                                                            disabled={loadingReply[r.id]}
                                                                            onFocus={(e) => {
                                                                                e.target.style.borderColor = '#3498db';
                                                                                e.target.style.boxShadow = '0 0 0 0.2rem rgba(52, 152, 219, 0.25)';
                                                                            }}
                                                                            onBlur={(e) => {
                                                                                e.target.style.borderColor = '#e9ecef';
                                                                                e.target.style.boxShadow = 'none';
                                                                            }}
                                                                        ></textarea>
                                                                        <div className="form-text mt-2">
                                                                            <small className="text-muted">
                                                                                <i className="fas fa-info-circle me-1"></i>
                                                                                Your response will be visible to the student and help build better relationships.
                                                                            </small>
                                                                        </div>
                                                                    </div>

                                                                    <div className="d-flex justify-content-between align-items-center">
                                                                        <button 
                                                                            type="button" 
                                                                            className="btn btn-outline-secondary" 
                                                                            data-bs-toggle="collapse" 
                                                                            data-bs-target={`#collapse${r.id}`}
                                                                            disabled={loadingReply[r.id]}
                                                                            style={{
                                                                                borderRadius: '10px',
                                                                                padding: '10px 20px',
                                                                                fontWeight: '500'
                                                                            }}
                                                                        >
                                                                            <i className="fas fa-times me-1"></i>
                                                                            Cancel
                                                                        </button>
                                                                        
                                                                        <button 
                                                                            type="button" 
                                                                            className="btn btn-primary" 
                                                                            onClick={() => handleSubmitReply(r.id)}
                                                                            disabled={!replies[r.id]?.trim() || loadingReply[r.id]}
                                                                            style={{
                                                                                background: 'linear-gradient(135deg, #28a745, #20c997)',
                                                                                border: 'none',
                                                                                borderRadius: '10px',
                                                                                padding: '10px 20px',
                                                                                fontWeight: '600'
                                                                            }}
                                                                        >
                                                                            {loadingReply[r.id] ? (
                                                                                <>
                                                                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                                                    Sending...
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <i className="fas fa-paper-plane me-1"></i>
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
                                    <div className="modern-empty-state" style={{
                                        background: 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '20px',
                                        padding: '60px 40px',
                                        textAlign: 'center',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                                    }}>
                                        <div className="empty-state-icon mb-4" style={{
                                            width: '100px',
                                            height: '100px',
                                            background: 'linear-gradient(135deg, #667eea20, #764ba220)',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto'
                                        }}>
                                            <i className="fas fa-star" style={{ 
                                                fontSize: '2.5rem', 
                                                color: '#667eea' 
                                            }}></i>
                                        </div>
                                        <h4 className="mb-3" style={{ color: '#2c3e50' }}>No Reviews Found</h4>
                                        <p className="text-muted mb-0" style={{ fontSize: '1.1rem' }}>
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

export default Review;