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
import { WishlistContext } from "../plugin/Context";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
import { getImageUrl, getLevelText } from "../../utils/courseUtils";
import { calculateTotalDuration, parseDurationToSeconds } from "../../utils/durationUtils";
import "./Wishlist.css";

function Wishlist() {
    const [wishlist, setWishlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [wishlistCount, setWishlistCount, refreshWishlistCount] = useContext(WishlistContext);
    const isCollapsed = useSidebarCollapse();

    // ✨ PHASE 4.77+: Calculate total JP (Jam Pelajaran) from course lectures
    const calculateTotalJP = (lectures) => {
        if (!lectures || !Array.isArray(lectures)) return 0;
        
        let totalSeconds = 0;
        lectures.forEach(lecture => {
            if (lecture.content_duration) {
                totalSeconds += parseDurationToSeconds(lecture.content_duration);
            }
        });
        
        return Math.ceil(totalSeconds / 2700); // 1 JP = 45 minutes = 2700 seconds
    };

    const fetchWishlist = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await useAxios.get(`student/wishlist/${UserData()?.user_id}/`);
            // Handle paginated API response
            // API returns { results: [...], count: N, ... } due to DRF pagination
            const wishlistData = response.data?.results || response.data || [];
            const wishlistArray = Array.isArray(wishlistData) ? wishlistData : [];
            setWishlist(wishlistArray);
        } catch (err) {
            console.error("Error fetching wishlist:", err);
            setError("Gagal memuat wishlist");
            Toast().fire({
                icon: "error",
                title: "Gagal memuat wishlist"
            });
        } finally {
            setLoading(false);
        }
    };

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
                title: "Kursus tidak valid"
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

    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="pt-5 pb-5 modern-wishlist-page" style={{ minHeight: 'calc(100vh - 120px)' }}>
                    <div className="container">
                        <Header />
                        <div className="row mt-0 md-4">
                            <Sidebar />
                            <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                                <div className="text-center">
                                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                                        <span className="visually-hidden">Sedang memuat...</span>
                                    </div>
                                    <p className="mt-3 text-muted">Memuat Wishlist...</p>
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

            <section className="pt-5 pb-5 modern-wishlist-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0 md-4">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Page Header */}
                            <div className="page-header-card">
                                <div className="page-header-content">
                                    <div className="row align-items-center">
                                        <div className="col-lg-8">
                                            <h1 className="mb-3 fw-bold d-flex align-items-center">
                                                <i className="fas fa-heart me-3" style={{ fontSize: '2.5rem' }}></i>
                                                Daftar Keinginan Saya
                                            </h1>
                                            <p className="mb-0 opacity-90 lead">
                                                Koleksi kursus tersimpan Anda. Lacak kursus yang ingin Anda ambil nanti.
                                            </p>
                                        </div>
                                        <div className="col-lg-4">
                                            <div className="stat-card-header-wrapper">
                                                <div className="stat-card-header">
                                                    <div className="stat-number justify-content-end">
                                                        {wishlist?.length || 0}
                                                    </div>
                                                    <div className="stat-label">Kursus Tersimpan</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Error State */}
                            {error && (
                                <div className="empty-state">
                                    <i className="fas fa-exclamation-triangle empty-icon text-warning"></i>
                                    <h4 className="text-muted mb-3">Oops! Terjadi kesalahan</h4>
                                    <p className="text-muted mb-4">{error}</p>
                                    <button 
                                        onClick={fetchWishlist} 
                                        className="btn btn-modern"
                                    >
                                        <i className="fas fa-refresh me-2"></i>
                                        Coba Lagi
                                    </button>
                                </div>
                            )}
                            
                            {/* Wishlist Content */}
                            {!error && (
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
                                                                    src={getImageUrl(w.course?.image)}
                                                                    alt="course"
                                                                    className="course-image"
                                                                    onError={(e) => {
                                                                        e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                                                    }}
                                                                />
                                                            </Link>
                                                            {/* Wishlist Button */}
                                                            <button 
                                                                onClick={() => addToWishlist(w.course?.id)} 
                                                                className="wishlist-btn position-absolute"
                                                                type="button"
                                                                title={isCourseInWishlist(w.course?.id) ? "Hapus dari daftar keinginan" : "Tambah ke daftar keinginan"}
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
                                                                    <span className="badge-text">{w.course?.category?.title || 'Umum'}</span>
                                                                </span>
                                                                <span className="badge badge-level">
                                                                    <span className="badge-text">{getLevelText(w.course?.level)}</span>
                                                                </span>
                                                                {/* ✨ PHASE 4.77: Display Kursus JP */}
                                                                {w.course?.lectures && w.course?.lectures.length > 0 && (
                                                                    <span className="badge badge-jp">
                                                                        <i className="fas fa-clock"></i>
                                                                        <span className="badge-text">{calculateTotalJP(w.course?.lectures)} JP</span>
                                                                    </span>
                                                                )}
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
                                                                    {w.course?.title || 'Judul Kursus Tidak Tersedia'}
                                                                </Link>
                                                            </h5>

                                                            {/* Course Meta */}
                                                            <div className="mb-3">
                                                                <small className="text-muted d-block mb-2">
                                                                    <i className="fas fa-user me-1" style={{ color: '#667eea' }}></i>
                                                                    Oleh: {w.course?.teacher?.full_name || 'Instruktur Tidak Diketahui'}
                                                                </small>
                                                                
                                                                {/* Students & Rating Row */}
                                                                <div className="d-flex justify-content-between align-items-center">
                                                                    <small className="text-muted">
                                                                        <i className="fas fa-users me-1" style={{ color: '#667eea' }}></i>
                                                                        {w.course?.students?.length || 0} Siswa{(w.course?.students?.length || 0) !== 1 && "s"}
                                                                    </small>
                                                                    
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <Rating
                                                                            initialValue={w.course?.average_rating || 0}
                                                                            readonly={true}
                                                                            size={16}
                                                                            fillColor="#ffc107"
                                                                            emptyColor="#e4e5e9"
                                                                        />
                                                                        <span className="text-warning fw-medium">{w.course?.average_rating || 0}</span>
                                                                        <small className="text-muted">({w.course?.reviews?.length || 0} ulasan)</small>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Card Footer */}
                                                        <div className="card-footer bg-transparent border-0 p-3 pt-0 mt-auto">
                                                            <Link 
                                                                to={`/course-detail/${w.course?.slug || '#'}/`} 
                                                                className="btn btn-modern"
                                                            >
                                                                <i className="fas fa-eye me-2"></i>
                                                                Lihat Detail
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-state">
                                            <i className="fas fa-heart empty-icon"></i>
                                            <h4 className="text-muted mb-3">Daftar Keinginan Anda Kosong</h4>
                                            <p className="text-muted mb-4">
                                                Anda belum menyimpan kursus apapun. Jelajahi katalog kursus kami dan simpan kursus yang Anda minati!
                                            </p>
                                            <Link to="/search" className="wishlist-empty-link-btn">
                                                <i className="fas fa-search"></i>
                                                <span>Jelajahi Kursus</span>
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

export default React.memo(Wishlist);
