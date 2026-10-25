import React, { useState } from "react";
import { Rating } from "react-simple-star-rating";
import dayjs, { moment } from "../../../utils/dayjs";
import { useComingSoon } from "../../../components/ComingSoonModal";

const CourseReviews = ({ reviews = [], averageRating = 0, totalReviews = 0 }) => {
    const [filter, setFilter] = useState("all");
    const [sortBy, setSortBy] = useState("newest");
    const [showAll, setShowAll] = useState(false);
    const [imageErrors, setImageErrors] = useState({});
    const handleComingSoon = useComingSoon('Review actions');

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
            'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
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
        <div className="card border-0 shadow-xs rounded-3 bg-white mb-3 overflow-hidden">
            <div className="card-body p-3 p-md-4">
                {/* Header */}
                <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                        <div
                            className="rounded-2 d-flex align-items-center justify-content-center text-white flex-shrink-0"
                            style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}
                        >
                            <i className="fas fa-star" style={{ fontSize: "0.8rem" }}></i>
                        </div>
                        <h5 className="mb-0 fw-bold text-dark" style={{ fontSize: "0.98rem" }}>
                            Ulasan & Kepuasan Peserta
                        </h5>
                    </div>
                    <span className="badge bg-light text-secondary border py-1 px-2 rounded-pill small">
                        {totalReviews} Ulasan Masuk
                    </span>
                </div>

                {reviews.length > 0 ? (
                    <div>
                        {/* Rating Summary Strip */}
                        <div className="row g-3 align-items-center p-3 p-md-4 rounded-3 bg-light border mb-3">
                            <div className="col-sm-4 text-center border-sm-end">
                                <div className="display-6 fw-bold text-dark mb-0">
                                    {(averageRating || 5.0).toFixed(1)}
                                </div>
                                <div className="d-flex justify-content-center my-1">
                                    <Rating
                                        initialValue={averageRating || 5}
                                        readonly={true}
                                        size={18}
                                        fillColor="#f59e0b"
                                    />
                                </div>
                                <small className="text-muted" style={{ fontSize: "0.78rem" }}>
                                    Berdasarkan {totalReviews} ulasan peserta
                                </small>
                            </div>

                            {/* Distribution Progress Bars */}
                            <div className="col-sm-8">
                                <div className="d-flex flex-column gap-1">
                                    {[5, 4, 3, 2, 1].map(rating => {
                                        const count = ratingDistribution[rating] || 0;
                                        const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : (rating === 5 ? 100 : 0);
                                        return (
                                            <div key={rating} className="d-flex align-items-center gap-2" style={{ fontSize: "0.78rem" }}>
                                                <span className="fw-semibold text-secondary" style={{ width: "12px" }}>{rating}</span>
                                                <i className="fas fa-star text-warning small" style={{ fontSize: "0.68rem" }}></i>
                                                <div className="progress flex-grow-1" style={{ height: "6px" }}>
                                                    <div
                                                        className="progress-bar bg-warning"
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-muted text-end" style={{ width: "36px" }}>
                                                    {Math.round(percentage)}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Filter Toolbar */}
                        <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
                            <div className="d-flex align-items-center gap-2">
                                <span className="small text-muted fw-semibold">Filter:</span>
                                <select
                                    className="form-select form-select-sm py-1"
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    style={{ fontSize: "0.8rem", width: "auto" }}
                                >
                                    <option value="all">Semua Bintang</option>
                                    <option value="5">5 Bintang</option>
                                    <option value="4">4 Bintang</option>
                                    <option value="3">3 Bintang</option>
                                </select>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <span className="small text-muted fw-semibold">Urutkan:</span>
                                <select
                                    className="form-select form-select-sm py-1"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    style={{ fontSize: "0.8rem", width: "auto" }}
                                >
                                    <option value="newest">Terbaru</option>
                                    <option value="highest">Rating Tertinggi</option>
                                    <option value="helpful">Paling Membantu</option>
                                </select>
                            </div>
                        </div>

                        {/* Reviews List */}
                        <div className="d-flex flex-column gap-3">
                            {filteredReviews.slice(0, displayCount).map((review, index) => (
                                <div key={review.id || index} className="p-3 rounded-3 bg-white border">
                                    <div className="d-flex align-items-start gap-3">
                                        <div
                                            className="rounded-circle text-white d-flex align-items-center justify-content-center flex-shrink-0"
                                            style={{
                                                width: "42px",
                                                height: "42px",
                                                background: getUserColor(review.user?.full_name),
                                                fontSize: "0.95rem",
                                                fontWeight: 700
                                            }}
                                        >
                                            {getInitials(review.user?.full_name)}
                                        </div>
                                        <div className="flex-grow-1 min-w-0">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <div>
                                                    <span className="fw-bold text-dark d-block" style={{ fontSize: "0.9rem" }}>
                                                        {review.user?.full_name}
                                                    </span>
                                                    <div className="d-flex align-items-center gap-2 mt-0">
                                                        <Rating
                                                            initialValue={review.rating}
                                                            readonly={true}
                                                            size={13}
                                                            fillColor="#f59e0b"
                                                        />
                                                        <small className="text-muted" style={{ fontSize: "0.74rem" }}>
                                                            {moment(review.date).fromNow()}
                                                        </small>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-secondary mb-0" style={{ fontSize: "0.85rem", lineHeight: "1.6" }}>
                                                {review.review}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredReviews.length > 3 && (
                            <div className="text-center mt-3">
                                <button
                                    className="btn btn-sm btn-outline-teal rounded-pill px-3 py-1 fw-semibold"
                                    onClick={() => setShowAll(!showAll)}
                                    style={{ fontSize: "0.8rem" }}
                                >
                                    {showAll ? "Tampilkan Lebih Sedikit" : `Tampilkan Semua (${filteredReviews.length}) Ulasan`}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Compact & Eye-Catching No Reviews State */
                    <div className="p-4 p-md-5 rounded-3 bg-light border text-center">
                        <div
                            className="mx-auto mb-3 rounded-circle d-flex align-items-center justify-content-center"
                            style={{
                                width: "54px",
                                height: "54px",
                                background: "rgba(13, 148, 136, 0.12)",
                                color: "#0d9488"
                            }}
                        >
                            <i className="fas fa-star-half-stroke" style={{ fontSize: "1.45rem" }}></i>
                        </div>

                        <h6 className="fw-bold mb-1 text-dark" style={{ fontSize: "0.98rem" }}>
                            Belum Ada Ulasan untuk Kursus Ini
                        </h6>

                        <p className="text-muted small mb-3 mx-auto" style={{ maxWidth: "460px", fontSize: "0.84rem", lineHeight: "1.6" }}>
                            Kursus ini masih baru dan belum memiliki ulasan dari peserta. Jadilah yang pertama memberikan ulasan dan rating setelah menyelesaikan materi kursus.
                        </p>

                        <div className="d-inline-flex align-items-center gap-2 py-1 px-3 rounded-pill bg-white border text-secondary small" style={{ fontSize: "0.78rem" }}>
                            <i className="fas fa-certificate text-teal" style={{ color: "#0d9488" }}></i>
                            <span>Ulasan resmi hanya dapat ditulis oleh aparatur yang telah menyelesaikan kursus</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourseReviews;
