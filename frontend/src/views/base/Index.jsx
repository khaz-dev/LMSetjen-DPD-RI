import { useEffect, useState, useContext, useMemo, useCallback } from "react";
import BaseHeader from "../partials/BaseHeader";
import BaseFooter from "../partials/BaseFooter";
import { Link } from "react-router-dom";
import { Rating } from 'react-simple-star-rating';

import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { WishlistContext } from "../plugin/Context";
import apiInstance from "../../utils/axios";
import { getImageUrl } from "../../utils/fileUtils";
import "./Index.css";

function Index() {
    const [courses, setCourses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [featuredCourses, setFeaturedCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [wishlistItems, setWishlistItems] = useState([]);
    const [stats, setStats] = useState({
        total_courses: 0,
        total_teachers: 0,
        total_students: 0,
        completion_rate: 95
    });
    const [wishlistCount, setWishlistCount, refreshWishlistCount] = useContext(WishlistContext);

    const userData = UserData();
    const userId = userData?.user_id;
    const userRole = userData?.role; // Get user role from token
    const isAdminOrTeacher = userRole === 'admin' || userRole === 'teacher' || userRole === 'instructor';

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch courses and categories in parallel for better performance
            const [coursesResponse, categoriesResponse] = await Promise.all([
                apiInstance.get(`/course/course-list/`),
                apiInstance.get(`/course/category/`)
            ]);

            // Set courses data
            const coursesData = coursesResponse.data || [];
            setCourses(coursesData);
            setCategories(categoriesResponse.data || []);
            
            // Get featured courses (first 6 courses)
            setFeaturedCourses(coursesData.slice(0, 6));
            
            // Calculate statistics from courses data
            const totalCourses = coursesData.length;
            const totalStudents = coursesData.reduce((sum, course) => 
                sum + (course.students?.length || 0), 0);
            const uniqueTeachers = new Set(
                coursesData
                    .map(course => course.teacher?.id)
                    .filter(id => id !== undefined)
            ).size;
            
            setStats({
                total_courses: totalCourses,
                total_teachers: uniqueTeachers,
                total_students: totalStudents,
                completion_rate: 95
            });

        } catch (error) {
            console.error('Error fetching data:', error);
            Toast().fire({
                icon: "error",
                title: "Failed to load data. Please refresh the page.",
            });
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch wishlist items
    const fetchWishlistItems = useCallback(async () => {
        if (!userId) return;
        try {
            const response = await apiInstance.get(`student/wishlist/${userId}/`);
            setWishlistItems(response.data);
        } catch (error) {
            console.error("Error fetching wishlist:", error);
        }
    }, [userId]);

    // Check if course is in wishlist
    const isCourseInWishlist = (courseId) => {
        return wishlistItems.some(item => item.course?.id === courseId);
    };

    useEffect(() => {
        // Scroll to top on page load
        window.scrollTo(0, 0);
        
        // Fetch data
        fetchData();
        
        // Fetch wishlist items if user is logged in
        if (userId && !isAdminOrTeacher) {
            fetchWishlistItems();
        }
    }, [userId, isAdminOrTeacher]);

    const addToWishlist = useCallback(async (courseId) => {
        if (!userId) {
            Toast().fire({
                icon: "warning",
                title: "Silakan login untuk menambahkan ke wishlist",
            });
            return;
        }

        // Prevent admin, teachers, and instructors from adding to wishlist
        if (isAdminOrTeacher) {
            Toast().fire({
                icon: "info",
                title: "Admin dan instruktur tidak dapat menambahkan kursus ke wishlist",
            });
            return;
        }

        const formdata = new FormData();
        formdata.append("user_id", userId);
        formdata.append("course_id", courseId);

        try {
            const response = await apiInstance.post(`student/wishlist/${userId}/`, formdata);
            Toast().fire({
                icon: "success",
                title: response.data.message || "Wishlist berhasil diperbarui",
            });
            
            // Refresh wishlist data
            await fetchWishlistItems();
            refreshWishlistCount();
        } catch (error) {
            console.error('Error adding to wishlist:', error);
            Toast().fire({
                icon: "error",
                title: "Terjadi kesalahan. Silakan coba lagi.",
            });
        }
    }, [userId, isAdminOrTeacher, refreshWishlistCount, fetchWishlistItems]);

    return (
        <>
            <BaseHeader />
            
            {/* Hero Section */}
            <section className="hero-section">
                {/* Background Pattern */}
                <div className="position-absolute w-100 h-100 hero-background-pattern"></div>

                <div className="container position-relative hero-container">
                    <div className="row align-items-center">
                        {/* Hero Content */}
                        <div className="col-lg-6 mb-5 mb-lg-0">
                            <div className="hero-content text-white">
                                {/* Badge */}
                                <div className="d-inline-flex align-items-center mb-4 px-3 py-2 hero-badge">
                                    <i className="fas fa-university me-2"></i>
                                    <span className="fw-medium">Platform Pembelajaran Setjen DPD RI</span>
                                </div>

                                {/* Main Headline */}
                                <h1 
                                    className="display-4 fw-bold mb-4 hero-main-title"
                                >
                                    LMS<span className="hero-title-highlight">etjen</span> DPD RI
                                </h1>
                                
                                <h2 className="h3 mb-4 opacity-90">
                                    Tingkatkan Kompetensi Melalui Pembelajaran Digital
                                </h2>

                                {/* Description */}
                                <p 
                                    className="lead mb-5 opacity-85 hero-description"
                                >
                                    Platform pembelajaran online untuk pengembangan kapasitas dan kompetensi 
                                    pegawai Sekretariat Jenderal DPD RI. Akses ribuan materi pembelajaran 
                                    berkualitas dari instruktur berpengalaman.
                                </p>

                                {/* CTA Buttons */}
                                <div className="d-flex flex-wrap gap-3 mb-5">
                                    <Link 
                                        to="/register" 
                                        className="btn btn-lg px-4 py-3 hero-btn-primary"
                                    >
                                        <i className="fas fa-user-plus me-2"></i>
                                        Daftar Sekarang
                                    </Link>
                                    
                                    <button 
                                        className="btn btn-lg btn-outline-light px-4 py-3 hero-btn-secondary-outline"
                                        onClick={() => document.getElementById('courses-section')?.scrollIntoView({ behavior: 'smooth' })}
                                    >
                                        <i className="fas fa-search me-2"></i>
                                        Jelajahi Kursus
                                    </button>
                                </div>

                                {/* Stats Preview */}
                                <div className="row g-4">
                                    <div className="col-4">
                                        <div className="text-center">
                                            <h3 className="fw-bold mb-1">{stats.total_courses}+</h3>
                                            <small className="opacity-75">Kursus</small>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="text-center">
                                            <h3 className="fw-bold mb-1">{stats.total_students}+</h3>
                                            <small className="opacity-75">Peserta</small>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="text-center">
                                            <h3 className="fw-bold mb-1">{stats.completion_rate}%</h3>
                                            <small className="opacity-75">Tingkat Selesai</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hero Image */}
                        <div className="col-lg-6">
                            <div className="position-relative">
                                <div 
                                    className="hero-image-wrapper"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: '30px',
                                        padding: '2rem',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)'
                                    }}
                                >
                                    <img 
                                        src="http://127.0.0.1:8000/static/LMSetjen-DPD-RI.jpg" 
                                        alt="LMS DPD RI" 
                                        className="img-fluid hero-right-image"
                                    />
                                </div>

                                {/* Floating Elements */}
                                <div 
                                    className="position-absolute floating-stats-card"
                                >
                                    <div className="d-flex align-items-center">
                                        <div 
                                            className="me-3 floating-card-icon"
                                        >
                                            <i className="fas fa-certificate"></i>
                                        </div>
                                        <div>
                                            <h6 className="mb-0 fw-bold card-heading-text">Sertifikat</h6>
                                            <small className="text-muted">Resmi & Diakui</small>
                                        </div>
                                    </div>
                                </div>

                                <div 
                                    className="position-absolute floating-stats-card-bottom"
                                >
                                    <div className="d-flex align-items-center">
                                        <div 
                                            className="me-3 floating-card-icon-green"
                                        >
                                            <i className="fas fa-chart-line"></i>
                                        </div>
                                        <div>
                                            <h6 className="mb-0 fw-bold card-heading-text">Progress</h6>
                                            <small className="text-muted">Real-time Tracking</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scroll Indicator */}
                <div 
                    className="position-absolute w-100 text-center text-white hero-scroll-indicator"
                >
                    <div className="animate-bounce">
                        <i className="fas fa-chevron-down"></i>
                        <div className="mt-2">
                            <small>Scroll untuk melihat lebih banyak</small>
                        </div>
                    </div>
                </div>
            </section>

            {/* About DPD RI Section */}
            <section className="py-5 about-section">
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-lg-6 mb-5 mb-lg-0">
                            <div className="pe-lg-4">
                                <div 
                                    className="badge mb-3 about-badge"
                                >
                                    <i className="fas fa-building me-2"></i>
                                    Tentang Setjen DPD RI
                                </div>
                                
                                <h2 className="display-6 fw-bold mb-4 about-section-heading">
                                    Sekretariat Jenderal<br/>Dewan Perwakilan Daerah<br/>Republik Indonesia
                                </h2>
                                
                                
                                <p className="lead text-muted mb-4">
                                    Setjen DPD RI adalah perangkat pendukung yang menyediakan dukungan administratif,
                                     teknis, dan keahlian untuk memastikan kelancaran kerja DPD RI
                                      dalam menjalankan fungsi legislasi dan pengawasannya.
                                </p>
                                
                                <div className="row g-4 mb-4">
                                    <div className="col-sm-6">
                                        <div className="d-flex align-items-center">
                                            <div 
                                                className="me-3 floating-card-icon-green"
                                            >
                                                <i className="fas fa-users"></i>
                                            </div>
                                            <div>
                                                <h6 className="fw-bold mb-1">Pengembangan SDM</h6>
                                                <small className="text-muted">Peningkatan kompetensi pegawai</small>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="col-sm-6">
                                        <div className="d-flex align-items-center">
                                            <div 
                                                className="me-3 feature-icon-red"
                                            >
                                                <i className="fas fa-graduation-cap"></i>
                                            </div>
                                            <div>
                                                <h6 className="fw-bold mb-1">Pembelajaran Digital</h6>
                                                <small className="text-muted">Transformasi digital pendidikan</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <p className="text-muted">
                                    Platform LMSetjen DPD RI hadir sebagai solusi pembelajaran digital untuk mendukung 
                                    pengembangan kapasitas dan kompetensi pegawai dalam melaksanakan tugas dan fungsinya 
                                    secara optimal.
                                </p>
                            </div>
                        </div>
                        
                        <div className="col-lg-6">
                            <div className="position-relative">
                                <div 
                                    className="image-container about-image-container"
                                >
                                    <img 
                                        src="http://127.0.0.1:8000/static/region-indonesia-map.jpg" 
                                        alt="Kantor Setjen DPD RI" 
                                        className="img-fluid"
                                        style={{ 
                                            borderRadius: '15px',
                                            objectFit: 'cover',
                                            width: '100%',
                                            height: '100%'
                                        }}
                                        onError={(e) => {
                                            e.target.src = "https://geeksui.codescandy.com/geeks/assets/images/background/acedamy-img/about-img.jpg";
                                        }}
                                    />
                                </div>
                                
                                {/* Floating Stats */}
                                <div 
                                    className="position-absolute"
                                    style={{
                                        bottom: '15%',
                                        right: '-10%',
                                        background: 'white',
                                        borderRadius: '20px',
                                        padding: '1rem',
                                        boxShadow: '0 15px 35px rgba(0, 0, 0, 0.1)',
                                        border: '1px solid #e9ecef'
                                    }}
                                >
                                    <div className="text-center">
                                        <h3 className="fw-bold mb-1 stats-number-blue">38</h3>
                                        <p className="mb-0 text-muted">Provinsi</p>
                                        <small className="text-muted">Terwakili</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Statistics Section */}
            <section className="py-5 statistics-section">
                <div className="container">
                    <div className="text-center mb-5">
                        <div 
                            className="badge mb-3 about-badge"
                        >
                            <i className="fas fa-chart-bar me-2"></i>
                            Statistik Platform
                        </div>
                        
                        <h2 className="display-6 fw-bold mb-3 about-section-heading">
                            Pencapaian LMSetjen DPD RI
                        </h2>
                        
                        <p className="lead text-muted">
                            Data terkini mengenai perkembangan dan capaian platform pembelajaran Setjen DPD RI
                        </p>
                    </div>

                    <div className="row g-4">
                        <div className="col-lg-3 col-md-6">
                            <div 
                                className="card border-0 h-100 text-center"
                                style={{
                                    borderRadius: '20px',
                                    background: 'white',
                                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <div className="card-body p-4">
                                    <div 
                                        className="d-inline-flex align-items-center justify-content-center mb-3 stats-card-icon"
                                    >
                                        <i className="fas fa-book-open"></i>
                                    </div>
                                    <h3 className="fw-bold mb-2 card-heading-text">{stats.total_courses}+</h3>
                                    <p className="text-muted mb-0">Kursus Tersedia</p>
                                    <small className="text-success">
                                        <i className="fas fa-arrow-up me-1"></i>
                                        +5 kursus baru bulan ini
                                    </small>
                                </div>
                            </div>
                        </div>

                        <div className="col-lg-3 col-md-6">
                            <div 
                                className="card border-0 h-100 text-center"
                                style={{
                                    borderRadius: '20px',
                                    background: 'white',
                                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <div className="card-body p-4">
                                    <div 
                                        className="d-inline-flex align-items-center justify-content-center mb-3"
                                        style={{
                                            width: '70px',
                                            height: '70px',
                                            background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                            borderRadius: '20px',
                                            color: 'white',
                                            fontSize: '1.8rem'
                                        }}
                                    >
                                        <i className="fas fa-users"></i>
                                    </div>
                                    <h3 className="fw-bold mb-2" style={{ color: '#2c3e50' }}>{stats.total_students}+</h3>
                                    <p className="text-muted mb-0">Peserta Aktif</p>
                                    <small className="text-success">
                                        <i className="fas fa-arrow-up me-1"></i>
                                        +12 peserta minggu ini
                                    </small>
                                </div>
                            </div>
                        </div>

                        <div className="col-lg-3 col-md-6">
                            <div 
                                className="card border-0 h-100 text-center"
                                style={{
                                    borderRadius: '20px',
                                    background: 'white',
                                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <div className="card-body p-4">
                                    <div 
                                        className="d-inline-flex align-items-center justify-content-center mb-3"
                                        style={{
                                            width: '70px',
                                            height: '70px',
                                            background: 'linear-gradient(135deg, #ffc107 0%, #ff8800 100%)',
                                            borderRadius: '20px',
                                            color: 'white',
                                            fontSize: '1.8rem'
                                        }}
                                    >
                                        <i className="fas fa-chalkboard-teacher"></i>
                                    </div>
                                    <h3 className="fw-bold mb-2" style={{ color: '#2c3e50' }}>{stats.total_teachers}+</h3>
                                    <p className="text-muted mb-0">Instruktur Ahli</p>
                                    <small className="text-success">
                                        <i className="fas fa-arrow-up me-1"></i>
                                        Berpengalaman & Tersertifikasi
                                    </small>
                                </div>
                            </div>
                        </div>

                        <div className="col-lg-3 col-md-6">
                            <div 
                                className="card border-0 h-100 text-center"
                                style={{
                                    borderRadius: '20px',
                                    background: 'white',
                                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <div className="card-body p-4">
                                    <div 
                                        className="d-inline-flex align-items-center justify-content-center mb-3"
                                        style={{
                                            width: '70px',
                                            height: '70px',
                                            background: 'linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)',
                                            borderRadius: '20px',
                                            color: 'white',
                                            fontSize: '1.8rem'
                                        }}
                                    >
                                        <i className="fas fa-chart-line"></i>
                                    </div>
                                    <h3 className="fw-bold mb-2" style={{ color: '#2c3e50' }}>{stats.completion_rate}%</h3>
                                    <p className="text-muted mb-0">Tingkat Kelulusan</p>
                                    <small className="text-success">
                                        <i className="fas fa-arrow-up me-1"></i>
                                        Rata-rata tinggi
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Course Categories Section */}
            <section className="py-5" style={{ background: 'white' }}>
                <div className="container">
                    <div className="text-center mb-5">
                        <div 
                            className="badge mb-3"
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                padding: '0.5rem 1rem',
                                borderRadius: '50px',
                                fontSize: '0.9rem'
                            }}
                        >
                            <i className="fas fa-th-large me-2"></i>
                            Kategori Kursus
                        </div>
                        
                        <h2 className="display-6 fw-bold mb-3" style={{ color: '#2c3e50' }}>
                            Jelajahi Berdasarkan Kategori
                        </h2>
                        
                        <p className="lead text-muted">
                            Temukan kursus yang sesuai dengan minat dan kebutuhan pengembangan karir Anda
                        </p>
                    </div>

                    <div className="row g-4">
                        {isLoading ? (
                            // Loading skeleton
                            [...Array(6)].map((_, index) => (
                                <div key={index} className="col-lg-4 col-md-6">
                                    <div 
                                        className="card border-0"
                                        style={{
                                            borderRadius: '20px',
                                            background: '#f8f9fa',
                                            height: '200px'
                                        }}
                                    >
                                        <div className="card-body d-flex align-items-center justify-content-center">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : categories.length > 0 ? (
                            categories.slice(0, 6).map((category, index) => (
                                <div key={category.id} className="col-lg-4 col-md-6">
                                    <Link 
                                        to={`/course-list?category=${category.slug}`}
                                        className="text-decoration-none"
                                    >
                                        <div 
                                            className="card border-0 h-100"
                                            style={{
                                                borderRadius: '20px',
                                                background: 'white',
                                                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            <div className="card-body p-4 text-center">
                                                <div 
                                                    className="category-icon mx-auto mb-3"
                                                    style={{
                                                        width: '80px',
                                                        height: '80px',
                                                        background: `linear-gradient(135deg, ${
                                                            ['#667eea, #764ba2', '#28a745, #20c997', '#ffc107, #ff8800', '#dc3545, #e83e8c', '#6f42c1, #e83e8c', '#17a2b8, #138496'][index % 6]
                                                        })`,
                                                        borderRadius: '20px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        fontSize: '2rem'
                                                    }}
                                                >
                                                    <i 
                                                        className={`fas ${
                                                            ['fa-globe', 'fa-chart-line', 'fa-paint-brush', 'fa-code', 'fa-tools', 'fa-globe'][index % 6]
                                                        }`}
                                                        style={{
                                                            fontSize: '2rem',
                                                            lineHeight: '1',
                                                            display: 'inline-block',
                                                            width: 'auto',
                                                            height: 'auto',
                                                            minWidth: '32px',
                                                            minHeight: '32px'
                                                        }}
                                                    ></i>
                                                </div>
                                                
                                                <h5 className="fw-bold mb-2" style={{ color: '#2c3e50' }}>
                                                    {category.title}
                                                </h5>
                                                
                                                <p className="text-muted mb-3">
                                                    {category.course_count} kursus tersedia
                                                </p>
                                                
                                                <div 
                                                    className="btn btn-sm"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '10px',
                                                        fontWeight: '500'
                                                    }}
                                                >
                                                    Lihat Kursus
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <div className="col-12 text-center">
                                <p className="text-muted">Kategori kursus akan segera tersedia</p>
                            </div>
                        )}
                    </div>

                    {categories.length > 6 && (
                        <div className="text-center mt-5">
                            <Link 
                                to="/course-list"
                                className="btn btn-lg px-4"
                                style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '15px',
                                    fontWeight: '600'
                                }}
                            >
                                Lihat Semua Kategori
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* Featured Courses Section */}
            <section id="courses-section" className="py-5" style={{ background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' }}>
                <div className="container">
                    <div className="text-center mb-5">
                        <div 
                            className="badge mb-3"
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                padding: '0.5rem 1rem',
                                borderRadius: '50px',
                                fontSize: '0.9rem'
                            }}
                        >
                            <i className="fas fa-star me-2"></i>
                            Kursus Populer
                        </div>
                        
                        <h2 className="display-6 fw-bold mb-3" style={{ color: '#2c3e50' }}>
                            Kursus Terfavorit
                        </h2>
                        
                        <p className="lead text-muted">
                            Kursus paling diminati dan memiliki rating tertinggi dari peserta
                        </p>
                    </div>

                    <div className="row g-4">
                        {isLoading ? (
                            // Loading skeleton
                            [...Array(6)].map((_, index) => (
                                <div key={index} className="col-lg-4 col-md-6">
                                    <div 
                                        className="card border-0"
                                        style={{
                                            borderRadius: '20px',
                                            background: '#f8f9fa',
                                            height: '400px'
                                        }}
                                    >
                                        <div className="card-body d-flex align-items-center justify-content-center">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : featuredCourses.length > 0 ? (
                            featuredCourses.map((course) => (
                                <div key={course.id} className="col-lg-4 col-md-6">
                                    <div 
                                        className="card border-0 h-100"
                                        style={{
                                            borderRadius: '20px',
                                            background: 'white',
                                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
                                            transition: 'all 0.3s ease',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {/* Course Image */}
                                        <div className="position-relative">
                                            <img 
                                                src={getImageUrl(course.image) || "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png"} 
                                                alt={course.title}
                                                className="card-img-top"
                                                style={{ 
                                                    height: '200px',
                                                    objectFit: 'cover'
                                                }}
                                                onError={(e) => {
                                                    e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                                }}
                                            />
                                            
                                            {/* Wishlist Button - Only show for students */}
                                            {!isAdminOrTeacher && (
                                                <button 
                                                    onClick={() => addToWishlist(course.id)}
                                                    className="btn position-absolute"
                                                    title={isCourseInWishlist(course.id) ? "Hapus dari wishlist" : "Tambahkan ke wishlist"}
                                                    disabled={!userId}
                                                    style={{
                                                        top: '15px',
                                                        right: '15px',
                                                        width: '40px',
                                                        height: '40px',
                                                        borderRadius: '50%',
                                                        background: 'white',
                                                        border: '1px solid #e9ecef',
                                                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                >
                                                    <i className={`${isCourseInWishlist(course.id) ? 'fas' : 'far'} fa-heart text-danger`} />
                                                </button>
                                            )}

                                            {/* Level Badge */}
                                            <div 
                                                className="position-absolute"
                                                style={{
                                                    bottom: '15px',
                                                    left: '15px'
                                                }}
                                            >
                                                <span 
                                                    className="badge"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                                        color: 'white',
                                                        padding: '0.4rem 0.8rem',
                                                        borderRadius: '10px',
                                                        fontSize: '0.8rem'
                                                    }}
                                                >
                                                    {course.level}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Card Body */}
                                        <div className="card-body p-4">
                                            {/* Category */}
                                            <div className="mb-2">
                                                <span 
                                                    className="badge"
                                                    style={{
                                                        background: 'rgba(102, 126, 234, 0.1)',
                                                        color: '#667eea',
                                                        border: '1px solid rgba(102, 126, 234, 0.2)',
                                                        borderRadius: '8px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: '500'
                                                    }}
                                                >
                                                    {course.category?.title || 'General'}
                                                </span>
                                            </div>

                                            {/* Course Title */}
                                            <h5 className="fw-bold mb-3">
                                                <Link 
                                                    to={`/course-detail/${course.slug}/`}
                                                    className="text-decoration-none"
                                                    style={{ 
                                                        color: '#2c3e50',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: '2',
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    {course.title}
                                                </Link>
                                            </h5>

                                            {/* Instructor */}
                                            <div className="mb-3">
                                                <small className="text-muted d-block">
                                                    <i className="fas fa-user me-1" style={{ color: '#667eea' }}></i>
                                                    Oleh: {course.teacher?.full_name || 'Instruktur'}
                                                </small>
                                            </div>

                                            {/* Rating */}
                                            <div className="d-flex align-items-center mb-3">
                                                <div className="me-2">
                                                    <Rating
                                                        initialValue={course.average_rating || 0}
                                                        readonly={true}
                                                        size={16}
                                                        fillColor="#ffc107"
                                                        emptyColor="#e4e5e9"
                                                    />
                                                </div>
                                                <span className="text-warning fw-medium me-1">{course.average_rating || 0}</span>
                                                <small className="text-muted">({course.reviews?.length || 0} ulasan)</small>
                                            </div>

                                            {/* Students Count */}
                                            <div className="mb-3">
                                                <small className="text-muted">
                                                    <i className="fas fa-users me-1" style={{ color: '#28a745' }}></i>
                                                    {course.students?.length || 0} siswa terdaftar
                                                </small>
                                            </div>
                                        </div>

                                        {/* Card Footer */}
                                        <div className="card-footer bg-transparent border-0 p-4 pt-0">
                                            <Link 
                                                to={`/course-detail/${course.slug}/`} 
                                                className="btn btn-lg w-100 fw-medium"
                                                style={{
                                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            >
                                                <i className="fas fa-eye me-2"></i>
                                                Lihat Detail
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-12 text-center">
                                <p className="text-muted">Kursus akan segera tersedia</p>
                            </div>
                        )}
                    </div>

                    {courses.length > 6 && (
                        <div className="text-center mt-5">
                            <Link 
                                to="/course-list"
                                className="btn btn-lg px-4"
                                style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '15px',
                                    fontWeight: '600'
                                }}
                            >
                                Lihat Semua Kursus
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-5" style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white'
            }}>
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-lg-8">
                            <h2 className="display-6 fw-bold mb-3">
                                Siap Memulai Perjalanan Pembelajaran Anda?
                            </h2>
                            <p className="lead mb-0">
                                Bergabunglah dengan ribuan pegawai Setjen DPD RI yang telah meningkatkan kompetensi mereka 
                                melalui platform LMSetjen DPD RI. Daftar sekarang dan akses seluruh kursus secara gratis!
                            </p>
                        </div>
                        <div className="col-lg-4 text-lg-end mt-4 mt-lg-0">
                            <Link 
                                to="/register"
                                className="btn btn-lg px-4 py-3"
                                style={{
                                    background: 'white',
                                    color: '#667eea',
                                    border: 'none',
                                    borderRadius: '15px',
                                    fontWeight: '600',
                                    boxShadow: '0 8px 25px rgba(255, 255, 255, 0.2)'
                                }}
                            >
                                <i className="fas fa-rocket me-2"></i>
                                Daftar Gratis Sekarang
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section className="py-5" style={{ background: 'white' }}>
                <div className="container">
                    <div className="text-center mb-5">
                        <div 
                            className="badge mb-3"
                            style={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                color: 'white',
                                padding: '0.5rem 1rem',
                                borderRadius: '50px',
                                fontSize: '0.9rem'
                            }}
                        >
                            <i className="fas fa-quote-left me-2"></i>
                            Testimoni
                        </div>
                        
                        <h2 className="display-6 fw-bold mb-3" style={{ color: '#2c3e50' }}>
                            Apa Kata Mereka?
                        </h2>
                        
                        <p className="lead text-muted">
                            Pengalaman nyata dari para peserta yang telah merasakan manfaat LMSetjen DPD RI
                        </p>
                    </div>

                    <div className="row g-4">
                        {/* Testimonial 1 */}
                        <div className="col-lg-4">
                            <div 
                                className="card border-0 h-100"
                                style={{
                                    borderRadius: '20px',
                                    background: 'white',
                                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                                    border: '1px solid #e9ecef'
                                }}
                            >
                                <div className="card-body text-center p-5">
                                    {/* Avatar */}
                                    <div 
                                        className="mx-auto mb-4"
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontSize: '24px'
                                        }}
                                    >
                                        <i className="fas fa-user"></i>
                                    </div>
                                    
                                    {/* Quote */}
                                    <p className="mb-4 fst-italic" style={{ lineHeight: '1.6', color: '#6c757d' }}>
                                        "Platform yang sangat membantu dalam pengembangan skill. 
                                        Materi yang disajikan berkualitas dan mudah dipahami. Saya berhasil 
                                        meningkatkan kemampuan analisis data dengan mengikuti kursus di sini."
                                    </p>
                                    
                                    {/* Rating */}
                                    <div className="mb-3">
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <span className="text-warning fw-medium ms-2">5.0</span>
                                    </div>
                                    
                                    {/* User Info */}
                                    <h6 className="fw-bold mb-1" style={{ color: '#343a40' }}>Siti Rahayu, S.E.</h6>
                                    <small className="text-muted">Staff Keuangan Setjen DPD RI Provinsi Jawa Barat</small>
                                </div>
                            </div>
                        </div>

                        {/* Testimonial 2 */}
                        <div className="col-lg-4">
                            <div 
                                className="card border-0 h-100"
                                style={{
                                    borderRadius: '20px',
                                    background: 'white',
                                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                                    border: '1px solid #e9ecef'
                                }}
                            >
                                <div className="card-body text-center p-5">
                                    {/* Avatar */}
                                    <div 
                                        className="mx-auto mb-4"
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontSize: '24px'
                                        }}
                                    >
                                        <i className="fas fa-user"></i>
                                    </div>
                                    
                                    {/* Quote */}
                                    <p className="mb-4 fst-italic" style={{ lineHeight: '1.6', color: '#6c757d' }}>
                                        "Sistem pembelajaran yang user-friendly dan instruktur yang kompeten. 
                                        Sangat recommended untuk pengembangan karir. Kursus manajemen proyek 
                                        membantu saya dalam mengorganisir pekerjaan dengan lebih efektif."
                                    </p>
                                    
                                    {/* Rating */}
                                    <div className="mb-3">
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <span className="text-warning fw-medium ms-2">5.0</span>
                                    </div>
                                    
                                    {/* User Info */}
                                    <h6 className="fw-bold mb-1" style={{ color: '#343a40' }}>Ahmad Fauzi, S.H.</h6>
                                    <small className="text-muted">Analis Kebijakan Setjen DPD RI Pusat</small>
                                </div>
                            </div>
                        </div>

                        {/* Testimonial 3 */}
                        <div className="col-lg-4">
                            <div 
                                className="card border-0 h-100"
                                style={{
                                    borderRadius: '20px',
                                    background: 'white',
                                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                                    border: '1px solid #e9ecef'
                                }}
                            >
                                <div className="card-body text-center p-5">
                                    {/* Avatar */}
                                    <div 
                                        className="mx-auto mb-4"
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontSize: '24px'
                                        }}
                                    >
                                        <i className="fas fa-user"></i>
                                    </div>
                                    
                                    {/* Quote */}
                                    <p className="mb-4 fst-italic" style={{ lineHeight: '1.6', color: '#6c757d' }}>
                                        "Fitur-fitur pembelajaran yang lengkap dan user-friendly. Platform ini benar-benar 
                                        membantu dalam meningkatkan efektivitas proses pembelajaran di institusi. 
                                        Interface yang intuitif memudahkan navigasi untuk semua kalangan usia."
                                    </p>
                                    
                                    {/* Rating */}
                                    <div className="mb-3">
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <i className="fas fa-star text-warning me-1"></i>
                                        <span className="text-warning fw-medium ms-2">5.0</span>
                                    </div>
                                    
                                    {/* User Info */}
                                    <h6 className="fw-bold mb-1" style={{ color: '#343a40' }}>Dr. Muhammad Sadli</h6>
                                    <small className="text-muted">Kepala Biro Umum Setjen DPD RI</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>



            <BaseFooter />
        </>
    );
}

export default Index;