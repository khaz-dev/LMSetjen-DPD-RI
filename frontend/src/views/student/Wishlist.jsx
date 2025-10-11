import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import { Rating } from 'react-simple-star-rating';

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import GetCurrentAddress from "../plugin/UserCountry";
import { WishlistContext } from "../plugin/Context";
import "./Wishlist.css";

function Wishlist() {
    const [wishlist, setWishlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [wishlistCount, setWishlistCount, refreshWishlistCount] = useContext(WishlistContext);

    const fetchWishlist = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await useAxios.get(`student/wishlist/${UserData()?.user_id}/`);
            setWishlist(response.data);
        } catch (err) {
            console.error("Error fetching wishlist:", err);
            setError("Failed to load wishlist");
            Toast().fire({
                icon: "error",
                title: "Failed to load wishlist"
            });
        } finally {
            setLoading(false);
        }
    };

    const country = GetCurrentAddress()?.country;

    useEffect(() => {
        fetchWishlist();
    }, []);

    // Check if course is already in wishlist
    const isCourseInWishlist = (courseId) => {
        return wishlist.some(item => item.course?.id === courseId);
    };

    const addToWishlist = async (courseId) => {
        if (!courseId) {
            Toast().fire({
                icon: "error",
                title: "Invalid course"
            });
            return;
        }

        const formdata = new FormData();
        formdata.append("course_id", courseId);
        formdata.append("user_id", UserData()?.user_id);

        try {
            const response = await useAxios.post(`student/wishlist/${UserData()?.user_id}/`, formdata);
            
            Toast().fire({
                icon: "success",
                title: response.data.message
            });
            
            // Refresh the wishlist
            fetchWishlist();
            refreshWishlistCount();
        } catch (error) {
            console.error("Error toggling wishlist:", error);
            Toast().fire({
                icon: "error",
                title: "Something went wrong"
            });
        }
    };

    return (
        <>
            <BaseHeader />

            <section className="modern-wishlist-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0 mt-md-4">
                        <Sidebar />
                        <div className="col-lg-9 col-md-8 col-12">
                            {/* Page Header */}
                            <div className="page-header-card">
                                <div className="page-header-content">
                                    <div className="row align-items-center">
                                        <div className="col-lg-8">
                                            <h1 className="mb-3 fw-bold d-flex align-items-center">
                                                <i className="fas fa-heart me-3" style={{ fontSize: '2.5rem' }}></i>
                                                My Wishlist
                                            </h1>
                                            <p className="mb-0 opacity-90 lead">
                                                Your saved courses collection. Keep track of courses you want to take later.
                                            </p>
                                        </div>
                                        <div className="col-lg-4">
                                            <div className="stats-grid mt-0">
                                                <div className="wishlist-stat-card">
                                                    <div className="wishlist-stat-number justify-content-end">
                                                        {wishlist?.length || 0}
                                                    </div>
                                                    <div className="wishlist-stat-label">Active Courses</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Loading State */}
                            {loading && (
                                <div >
                                    <div className="text-center">
                                        <div className="loading-dots">
                                            <div className="dot"></div>
                                            <div className="dot"></div>
                                            <div className="dot"></div>
                                        </div>
                                        <h5 className="mt-4 mb-2 fw-bold text-primary">Loading your wishlist...</h5>
                                        <p className="text-muted mb-0">Please wait while we fetch your saved courses</p>
                                    </div>
                                </div>
                            )}

                            {/* Error State */}
                            {error && (
                                <div className="empty-state">
                                    <i className="fas fa-exclamation-triangle empty-icon text-warning"></i>
                                    <h4 className="text-muted mb-3">Oops! Something went wrong</h4>
                                    <p className="text-muted mb-4">{error}</p>
                                    <button 
                                        onClick={fetchWishlist} 
                                        className="btn btn-modern"
                                    >
                                        <i className="fas fa-refresh me-2"></i>
                                        Try Again
                                    </button>
                                </div>
                            )}
                            
                            {/* Wishlist Content */}
                            {!loading && !error && (
                                <>
                                    {wishlist?.length > 0 ? (
                                        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
                                            {wishlist.map((w, index) => (
                                                <div className="col" key={w.id || index}>
                                                    <div className="wishlist-card d-flex flex-column h-100">
                                                        {/* Course Image */}
                                                        <div className="position-relative" style={{ borderRadius: '20px 20px 0 0', overflow: 'hidden' }}>
                                                            <Link to={`/course-detail/${w.course?.slug || '#'}/`}>
                                                                <img
                                                                    src={w.course?.image || '/default-course-image.jpg'}
                                                                    alt="course"
                                                                    className="course-image"
                                                                />
                                                            </Link>
                                                            {/* Wishlist Button */}
                                                            <button 
                                                                onClick={() => addToWishlist(w.course?.id)} 
                                                                className="wishlist-btn position-absolute"
                                                                type="button"
                                                                title={isCourseInWishlist(w.course?.id) ? "Remove from wishlist" : "Add to wishlist"}
                                                                style={{
                                                                    top: '15px',
                                                                    right: '15px'
                                                                }}
                                                            >
                                                                <i className={`${isCourseInWishlist(w.course?.id) ? 'fas' : 'far'} fa-heart text-danger`} />
                                                            </button>
                                                        </div>

                                                        {/* Card Body */}
                                                        <div className="wishlist-card-body p-3 ">
                                                            {/* Badges */}
                                                            <div className="d-flex flex-wrap gap-2 mb-2" style={{ maxWidth: '100%' }}>
                                                                <span className="badge badge-modern">
                                                                    <i className="fas fa-folder-open"></i>
                                                                    <span className="badge-text">{w.course?.category?.title || 'General'}</span>
                                                                </span>
                                                                <span className="badge badge-level">
                                                                    <i className="fas fa-signal"></i>
                                                                    <span className="badge-text">{w.course?.level}</span>
                                                                </span>
                                                            </div>

                                                            {/* Course Title */}
                                                            <h5 className="card-title mb-3" style={{ lineHeight: '1.4' }}>
                                                                <Link 
                                                                    to={`/course-detail/${w.course?.slug || '#'}/`} 
                                                                    className="text-decoration-none"
                                                                    style={{ 
                                                                        color: '#343a40',
                                                                        display: '-webkit-box',
                                                                        WebkitLineClamp: '2',
                                                                        WebkitBoxOrient: 'vertical',
                                                                        overflow: 'hidden'
                                                                    }}
                                                                >
                                                                    {w.course?.title || 'Course Title Not Available'}
                                                                </Link>
                                                            </h5>

                                                            {/* Course Meta */}
                                                            <div className="mb-3">
                                                                <small className="text-muted d-block mb-1">
                                                                    <i className="fas fa-user me-1" style={{ color: '#667eea' }}></i>
                                                                    By: {w.course?.teacher?.full_name || 'Unknown Teacher'}
                                                                </small>
                                                                <small className="text-muted d-block">
                                                                    <i className="fas fa-users me-1" style={{ color: '#667eea' }}></i>
                                                                    {w.course?.students?.length || 0} Student{(w.course?.students?.length || 0) !== 1 && "s"}
                                                                </small>
                                                            </div>

                                                            {/* Rating */}
                                                            <div className="d-flex align-items-center mb-3">
                                                                <div className="me-2">
                                                                    <Rating
                                                                        initialValue={w.course?.average_rating || 0}
                                                                        readonly={true}
                                                                        size={16}
                                                                        fillColor="#ffc107"
                                                                        emptyColor="#e4e5e9"
                                                                    />
                                                                </div>
                                                                <span className="text-warning fw-medium me-1">{w.course?.average_rating || 0}</span>
                                                                <small className="text-muted">({w.course?.reviews?.length || 0} reviews)</small>
                                                            </div>
                                                        </div>

                                                        {/* Card Footer */}
                                                        <div className="card-footer bg-transparent border-0 p-3 pt-0 mt-auto">
                                                            <Link 
                                                                to={`/course-detail/${w.course?.slug || '#'}/`} 
                                                                className="btn btn-modern"
                                                            >
                                                                <i className="fas fa-eye me-2"></i>
                                                                View Details
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-state">
                                            <i className="fas fa-heart empty-icon"></i>
                                            <h4 className="text-muted mb-3">Your Wishlist is Empty</h4>
                                            <p className="text-muted mb-4">
                                                You haven't saved any courses yet. Browse our course catalog and save courses you're interested in!
                                            </p>
                                            <Link to="/" className="btn btn-modern">
                                                <i className="fas fa-search me-2"></i>
                                                Browse Courses
                                            </Link>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default Wishlist;
