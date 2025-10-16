import React, { useState } from "react";
import { Rating } from "react-simple-star-rating";
import dayjs from "../../../utils/dayjs";

const CourseReviews = ({ reviews = [], averageRating = 0, totalReviews = 0 }) => {
    const [filter, setFilter] = useState("all");
    const [sortBy, setSortBy] = useState("newest");
    const [showAll, setShowAll] = useState(false);
    const [imageErrors, setImageErrors] = useState({});

    // Function to get initials from name
    const getInitials = (name) => {
        if (!name) return "U";
        const parts = name.split(" ");
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    // Function to get consistent color for user based on name
    const getUserColor = (name) => {
        const colors = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
            'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
        ];
        const index = (name?.charCodeAt(0) || 0) % colors.length;
        return colors[index];
    };

    const handleImageError = (reviewId) => {
        setImageErrors(prev => ({ ...prev, [reviewId]: true }));
    };

    const displayReviews = reviews;
    const displayCount = showAll ? displayReviews.length : 3;

    // Calculate rating distribution
    const ratingDistribution = {
        5: Math.floor(totalReviews * 0.65),
        4: Math.floor(totalReviews * 0.20),
        3: Math.floor(totalReviews * 0.10),
        2: Math.floor(totalReviews * 0.03),
        1: Math.floor(totalReviews * 0.02)
    };

    const filterReviews = (reviews) => {
        let filtered = [...reviews];
        
        if (filter !== "all") {
            filtered = filtered.filter(review => review.rating === parseInt(filter));
        }
        
        // Sort reviews
        filtered.sort((a, b) => {
            switch (sortBy) {
                case "newest":
                    return new Date(b.date) - new Date(a.date);
                case "oldest":
                    return new Date(a.date) - new Date(b.date);
                case "highest":
                    return b.rating - a.rating;
                case "lowest":
                    return a.rating - b.rating;
                case "helpful":
                    return (b.helpful_count || 0) - (a.helpful_count || 0);
                default:
                    return 0;
            }
        });
        
        return filtered;
    };

    const filteredReviews = filterReviews(displayReviews);

    return (
        <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-4">
                {reviews.length > 0 ? (
                    <div className="row">
                        <div className="col-lg-4 mb-4">
                            {/* Rating Summary */}
                            <div className="text-center bg-light rounded-3 p-4">
                                <div className="display-4 fw-bold text-warning mb-2">
                                    {averageRating || 0}
                                </div>
                                <Rating
                                    initialValue={averageRating || 0}
                                    readonly={true}
                                    size={25}
                                    fillColor="#ffc107"
                                    className="mb-2"
                                />
                                <p className="text-muted mb-0">
                                    {totalReviews} student reviews
                                </p>
                            </div>

                            {/* Rating Distribution */}
                            <div className="mt-4">
                                <h6 className="fw-semibold mb-3">Rating Breakdown</h6>
                                {[5, 4, 3, 2, 1].map(rating => {
                                    const count = ratingDistribution[rating];
                                    const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                                    
                                    return (
                                        <div key={rating} className="d-flex align-items-center mb-2">
                                            <span className="me-2 fw-semibold" style={{ minWidth: '15px' }}>
                                                {rating}
                                            </span>
                                            <i className="fas fa-star text-warning me-2 small"></i>
                                            <div className="progress flex-grow-1 me-3" style={{ height: '8px' }}>
                                                <div 
                                                    className="progress-bar bg-warning" 
                                                    style={{ width: `${percentage}%` }}
                                                ></div>
                                            </div>
                                            <small className="text-muted" style={{ minWidth: '40px' }}>
                                                {Math.round(percentage)}%
                                            </small>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="col-lg-8">
                            {/* Reviews Header */}
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h3 className="h4 mb-0 d-flex align-items-center">
                                    <i className="fas fa-comments text-primary me-3"></i>
                                    Student Reviews
                                </h3>
                                <button className="btn btn-outline-primary btn-sm">
                                    <i className="fas fa-plus me-2"></i>
                                    Write a Review
                                </button>
                            </div>

                            {/* Filters */}
                            <div className="row g-3 mb-4">
                                <div className="col-md-6">
                                    <label className="form-label small fw-semibold">Filter by Rating</label>
                                    <select 
                                        className="form-select form-select-sm"
                                        value={filter}
                                        onChange={(e) => setFilter(e.target.value)}
                                    >
                                        <option value="all">All Ratings</option>
                                        <option value="5">5 Stars</option>
                                        <option value="4">4 Stars</option>
                                        <option value="3">3 Stars</option>
                                        <option value="2">2 Stars</option>
                                        <option value="1">1 Star</option>
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label small fw-semibold">Sort by</label>
                                    <select 
                                        className="form-select form-select-sm"
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                    >
                                        <option value="newest">Newest First</option>
                                        <option value="oldest">Oldest First</option>
                                        <option value="highest">Highest Rating</option>
                                        <option value="lowest">Lowest Rating</option>
                                        <option value="helpful">Most Helpful</option>
                                    </select>
                                </div>
                            </div>

                        {/* Reviews List */}
                        <div className="mb-4">
                            {filteredReviews.length === 0 ? (
                                /* Empty State - No Reviews Yet */
                                <div className="text-center py-5">
                                    <div 
                                        className="mb-4"
                                        style={{
                                            width: '120px',
                                            height: '120px',
                                            margin: '0 auto',
                                            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <i className="fas fa-comments" style={{ fontSize: '3.5rem', color: '#667eea', opacity: '0.6' }}></i>
                                    </div>
                                    
                                    <h4 className="fw-bold mb-3" style={{ color: '#2c3e50' }}>
                                        Belum Ada Ulasan
                                    </h4>
                                    
                                    <p className="text-muted mb-4" style={{ maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
                                        Kursus ini belum memiliki ulasan dari student. Jadilah yang pertama memberikan ulasan setelah menyelesaikan kursus ini!
                                    </p>
                                    
                                    <div 
                                        className="d-inline-flex align-items-center gap-3 p-3 rounded-3"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                                            border: '2px dashed rgba(102, 126, 234, 0.2)'
                                        }}
                                    >
                                        <i className="fas fa-info-circle text-primary" style={{ fontSize: '1.2rem' }}></i>
                                        <span className="text-muted small">
                                            Daftar dan selesaikan kursus untuk memberikan ulasan pertama
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                /* Show reviews when available */
                                filteredReviews.slice(0, displayCount).map((review, index) => (
                                <div key={review.id || index} className="border-bottom pb-4 mb-4">
                                    <div className="d-flex align-items-start">
                                        {/* User Avatar with fallback to initials */}
                                        {review.user?.image && !imageErrors[review.id] ? (
                                            <img 
                                                src={review.user.image} 
                                                alt={review.user?.full_name}
                                                className="rounded-circle me-3"
                                                style={{ 
                                                    width: '50px', 
                                                    height: '50px', 
                                                    objectFit: 'cover',
                                                    border: '2px solid #f0f0f0'
                                                }}
                                                onError={() => handleImageError(review.id)}
                                            />
                                        ) : (
                                            <div 
                                                className="rounded-circle me-3 d-flex align-items-center justify-content-center"
                                                style={{ 
                                                    width: '50px', 
                                                    height: '50px',
                                                    background: getUserColor(review.user?.full_name),
                                                    color: 'white',
                                                    fontWeight: '600',
                                                    fontSize: '1.1rem',
                                                    border: '2px solid rgba(255, 255, 255, 0.5)',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                {getInitials(review.user?.full_name)}
                                            </div>
                                        )}
                                        <div className="flex-grow-1">
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <div>
                                                    <h6 className="fw-semibold mb-1">
                                                        {review.user?.full_name}
                                                    </h6>
                                                    <div className="d-flex align-items-center">
                                                        <Rating
                                                            initialValue={review.rating}
                                                            readonly={true}
                                                            size={16}
                                                            fillColor="#ffc107"
                                                        />
                                                        <span className="text-muted ms-2 small">
                                                            {moment(review.date).fromNow()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="dropdown">
                                                    <button 
                                                        className="btn btn-sm btn-outline-secondary dropdown-toggle"
                                                        data-bs-toggle="dropdown"
                                                    >
                                                        <i className="fas fa-ellipsis-h"></i>
                                                    </button>
                                                    <ul className="dropdown-menu">
                                                        <li>
                                                            <a className="dropdown-item" href="#">
                                                                <i className="fas fa-flag me-2"></i>
                                                                Report
                                                            </a>
                                                        </li>
                                                        <li>
                                                            <a className="dropdown-item" href="#">
                                                                <i className="fas fa-share me-2"></i>
                                                                Share
                                                            </a>
                                                        </li>
                                                    </ul>
                                                </div>
                                            </div>
                                            
                                            <p className="text-muted mb-3" style={{ lineHeight: '1.6' }}>
                                                {review.review}
                                            </p>
                                            
                                            <div className="d-flex align-items-center gap-3">
                                                <button className="btn btn-sm btn-outline-secondary">
                                                    <i className="fas fa-thumbs-up me-1"></i>
                                                    Helpful ({review.helpful_count || 0})
                                                </button>
                                                <button className="btn btn-sm btn-outline-secondary">
                                                    <i className="fas fa-reply me-1"></i>
                                                    Reply
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                            )}
                        </div>

                        {/* Show More/Less Button */}
                        {filteredReviews.length > 3 && (
                            <div className="text-center mt-4">
                                <button 
                                    className="btn btn-outline-primary"
                                    onClick={() => setShowAll(!showAll)}
                                >
                                    {showAll ? (
                                        <>
                                            <i className="fas fa-chevron-up me-2"></i>
                                            Show Less Reviews
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-chevron-down me-2"></i>
                                            Show All {filteredReviews.length} Reviews
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                        </div>
                    </div>
                ) : (
                    /* No Reviews Empty State */
                    <div className="text-center py-5">
                        <div 
                            className="mb-4"
                            style={{
                                width: '150px',
                                height: '150px',
                                margin: '0 auto',
                                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '3px dashed rgba(102, 126, 234, 0.2)'
                            }}
                        >
                            <i className="fas fa-star" style={{ fontSize: '4rem', color: '#667eea', opacity: '0.5' }}></i>
                        </div>
                        
                        <h3 className="fw-bold mb-3" style={{ color: '#2c3e50' }}>
                            Belum Ada Ulasan
                        </h3>
                        
                        <p className="text-muted mb-4" style={{ maxWidth: '500px', margin: '0 auto 2rem', lineHeight: '1.7', fontSize: '1.05rem' }}>
                            Kursus ini belum memiliki ulasan dari student. Jadilah yang pertama memberikan ulasan setelah menyelesaikan kursus ini!
                        </p>
                        
                        <div 
                            className="d-inline-flex align-items-center gap-3 p-4 rounded-4"
                            style={{
                                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                                border: '2px dashed rgba(102, 126, 234, 0.3)',
                                maxWidth: '600px'
                            }}
                        >
                            <div 
                                style={{
                                    width: '50px',
                                    height: '50px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    borderRadius: '15px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}
                            >
                                <i className="fas fa-info-circle text-white" style={{ fontSize: '1.5rem' }}></i>
                            </div>
                            <div className="text-start">
                                <h6 className="fw-bold mb-1" style={{ color: '#2c3e50' }}>
                                    Bagaimana Cara Memberikan Ulasan?
                                </h6>
                                <p className="text-muted mb-0 small">
                                    Daftar dan selesaikan kursus ini untuk memberikan ulasan pertama dan membantu student lain dalam mengambil keputusan
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourseReviews;