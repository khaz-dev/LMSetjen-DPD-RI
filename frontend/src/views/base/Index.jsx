import { useEffect, useState, useContext, useMemo, useCallback } from "react";
import BaseHeader from "../partials/BaseHeader";
import BaseFooter from "../partials/BaseFooter";
import { Link } from "react-router-dom";
import { Rating } from 'react-simple-star-rating';

import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { WishlistContext } from "../plugin/Context";
import apiInstance, { getMediaURL } from "../../utils/axios";
import { getImageUrl } from "../../utils/fileUtils";
import SEO from "../../components/SEO";
import "./Index.css";

// Import frontend assets
import heroImage from "../../assets/LMSetjen-DPD-RI.jpg";
import regionMapImage from "../../assets/region-indonesia-map.jpg";

function Index() {
    const [courses, setCourses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [featuredCourses, setFeaturedCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isStatsLoading, setIsStatsLoading] = useState(true);
    const [wishlistItems, setWishlistItems] = useState([]);
    const [activeSection, setActiveSection] = useState(0);
    const [showSectionLabel, setShowSectionLabel] = useState(false);
    const [labelHideTimeout, setLabelHideTimeout] = useState(null);
    const [stats, setStats] = useState({
        total_courses: 0,
        total_teachers: 0,
        total_students: 0,
        completion_rate: 0,
        total_certificates: 0,
        total_materials: 0,
        platform_rating: 4.8
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

            // Extract courses data - handle both paginated and non-paginated responses
            // If response has 'results' key (paginated), use that; otherwise use data directly
            const coursesData = coursesResponse.data?.results || coursesResponse.data || [];
            const categoriesData = categoriesResponse.data?.results || categoriesResponse.data || [];
            
            // Ensure coursesData is an array before using
            const coursesArray = Array.isArray(coursesData) ? coursesData : [];
            const categoriesArray = Array.isArray(categoriesData) ? categoriesData : [];
            
            setCourses(coursesArray);
            setCategories(categoriesArray);
            
            // Get featured courses (first 6 courses)
            setFeaturedCourses(coursesArray.slice(0, 6));

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

    // Fetch real-time statistics from backend
    const fetchStatistics = useCallback(async () => {
        setIsStatsLoading(true);
        try {
            const response = await apiInstance.get(`/statistics/public-stats/`);
            console.log('📊 Statistics API Response:', response.data); // DEBUG
            if (response.data) {
                const newStats = {
                    total_courses: response.data.total_courses || 0,
                    total_teachers: response.data.total_teachers || 0,
                    total_students: response.data.total_students || 0,
                    completion_rate: response.data.completion_rate || 0,
                    total_certificates: response.data.total_certificates || 0,
                    total_materials: response.data.total_materials || 0,
                    platform_rating: response.data.platform_rating || 4.8
                };
                console.log('📊 Setting stats state:', newStats); // DEBUG
                setStats(newStats);
            }
        } catch (error) {
            console.error('❌ Error fetching statistics:', error);
            // Set default stats on error
            setStats({
                total_courses: 0,
                total_teachers: 0,
                total_students: 0,
                completion_rate: 0,
                total_certificates: 0,
                total_materials: 0,
                platform_rating: 4.8
            });
        } finally {
            setIsStatsLoading(false);
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
        fetchStatistics();
        
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

    // Section navigation configuration
    const sections = [
        { id: 'hero', label: 'Beranda', icon: 'home' },
        { id: 'about', label: 'Tentang', icon: 'building' },
        { id: 'statistics', label: 'Statistik', icon: 'chart-bar' },
        { id: 'categories', label: 'Kategori', icon: 'th-large' },
        { id: 'courses', label: 'Kursus', icon: 'graduation-cap' },
        { id: 'cta', label: 'Daftar', icon: 'rocket' },
        { id: 'testimonials', label: 'Testimoni', icon: 'quote-left' }
    ];

    // Handle scroll to track active section
    useEffect(() => {
        const container = document.querySelector('.landing-page-container');
        if (!container) return;

        let scrollTimeout;
        let hideTimeout;
        
        const handleScroll = () => {
            // Debounce scroll events for better performance
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const sections = document.querySelectorAll('.snap-section');
                const scrollPosition = container.scrollTop + window.innerHeight / 2;

                // Update active section for navigation dots
                sections.forEach((section, index) => {
                    const sectionTop = section.offsetTop;
                    const sectionBottom = sectionTop + section.offsetHeight;

                    if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
                        setActiveSection(index);
                        // Show label when transitioning between sections
                        setShowSectionLabel(true);
                        
                        // Clear existing hide timeout
                        if (hideTimeout) {
                            clearTimeout(hideTimeout);
                        }
                        
                        // Hide label after 3 seconds
                        hideTimeout = setTimeout(() => {
                            setShowSectionLabel(false);
                        }, 3000);
                    }
                });
            }, 50); // 50ms debounce for smooth performance
        };
        
        // Add scroll listener with passive for better performance
        container.addEventListener('scroll', handleScroll, { passive: true });
        
        // Initial check
        handleScroll();

        return () => {
            container.removeEventListener('scroll', handleScroll);
            clearTimeout(scrollTimeout);
            if (hideTimeout) {
                clearTimeout(hideTimeout);
            }
        };
    }, []);

    // Scroll to section with enhanced smooth behavior
    const scrollToSection = (index) => {
        const sections = document.querySelectorAll('.snap-section');
        if (sections[index]) {
            // Show label when user clicks to scroll
            setShowSectionLabel(true);
            
            // Clear existing timeout
            if (labelHideTimeout) {
                clearTimeout(labelHideTimeout);
            }
            
            // Hide label after 3 seconds
            const timeout = setTimeout(() => {
                setShowSectionLabel(false);
            }, 3000);
            setLabelHideTimeout(timeout);
            
            sections[index].scrollIntoView({ 
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            });
        }
    };

    return (
        <>
            <SEO 
                title="Beranda - LMSetjen DPD RI | Learning Management System"
                description="Platform pembelajaran online Setjen DPD RI. Akses ribuan kursus, pelatihan, dan program sertifikasi untuk meningkatkan kompetensi pegawai DPD RI."
                keywords="LMS DPD RI, e-learning Setjen, pelatihan online, kursus pegawai, sertifikasi DPD RI"
            />
            {/* Fixed Header - Always on top */}
            <div className="landing-fixed-header">
                <BaseHeader />
            </div>

            {/* Main Content */}
            <main id="main-content" role="main">
                {/* Section Navigation Indicator */}
                <div className="section-navigation">
                    {sections.map((section, index) => (
                        <div
                            key={section.id}
                            className={`section-nav-item ${activeSection === index ? 'active' : ''}`}
                            onClick={() => scrollToSection(index)}
                        >
                            <div className="section-nav-dot"></div>
                        <div className={`section-nav-label ${showSectionLabel && activeSection === index ? 'visible' : ''}`}>
                            <i className={`fas fa-${section.icon} me-2`}></i>
                            {section.label}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="landing-page-container">
                {/* Hero Section */}
                <section className="hero-section snap-section">
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
                                    LMS<span className="hero-title-accent">etjen</span> DPD RI
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

                                {/* Stats Preview - Compact for single line */}
                                <div className="row g-2">
                                    <div className="col-4">
                                        <div className="text-center">
                                            {isStatsLoading ? (
                                                <>
                                                    <div 
                                                        style={{
                                                            width: '50px',
                                                            height: '32px',
                                                            background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 25%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 75%)',
                                                            backgroundSize: '200% 100%',
                                                            animation: 'shimmer 1.5s infinite',
                                                            borderRadius: '4px',
                                                            margin: '0 auto 0.5rem'
                                                        }}
                                                    ></div>
                                                    <div 
                                                        style={{
                                                            width: '40px',
                                                            height: '12px',
                                                            background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 25%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 75%)',
                                                            backgroundSize: '200% 100%',
                                                            animation: 'shimmer 1.5s infinite',
                                                            borderRadius: '4px',
                                                            margin: '0 auto'
                                                        }}
                                                    ></div>
                                                </>
                                            ) : (
                                                <>
                                                    <h3 className="fw-bold mb-0" style={{ fontSize: '1.5rem' }}>{stats.total_courses}+</h3>
                                                    <small className="opacity-75" style={{ fontSize: '0.75rem' }}>Kursus</small>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="text-center">
                                            {isStatsLoading ? (
                                                <>
                                                    <div 
                                                        style={{
                                                            width: '50px',
                                                            height: '32px',
                                                            background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 25%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 75%)',
                                                            backgroundSize: '200% 100%',
                                                            animation: 'shimmer 1.5s infinite',
                                                            borderRadius: '4px',
                                                            margin: '0 auto 0.5rem'
                                                        }}
                                                    ></div>
                                                    <div 
                                                        style={{
                                                            width: '40px',
                                                            height: '12px',
                                                            background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 25%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 75%)',
                                                            backgroundSize: '200% 100%',
                                                            animation: 'shimmer 1.5s infinite',
                                                            borderRadius: '4px',
                                                            margin: '0 auto'
                                                        }}
                                                    ></div>
                                                </>
                                            ) : (
                                                <>
                                                    <h3 className="fw-bold mb-0" style={{ fontSize: '1.5rem' }}>{stats.total_students}+</h3>
                                                    <small className="opacity-75" style={{ fontSize: '0.75rem' }}>Peserta</small>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="text-center">
                                            {isStatsLoading ? (
                                                <>
                                                    <div 
                                                        style={{
                                                            width: '50px',
                                                            height: '32px',
                                                            background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 25%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 75%)',
                                                            backgroundSize: '200% 100%',
                                                            animation: 'shimmer 1.5s infinite',
                                                            borderRadius: '4px',
                                                            margin: '0 auto 0.5rem'
                                                        }}
                                                    ></div>
                                                    <div 
                                                        style={{
                                                            width: '40px',
                                                            height: '12px',
                                                            background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 25%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 75%)',
                                                            backgroundSize: '200% 100%',
                                                            animation: 'shimmer 1.5s infinite',
                                                            borderRadius: '4px',
                                                            margin: '0 auto'
                                                        }}
                                                    ></div>
                                                </>
                                            ) : (
                                                <>
                                                    <h3 className="fw-bold mb-0" style={{ fontSize: '1.5rem' }}>{stats.completion_rate}%</h3>
                                                    <small className="opacity-75" style={{ fontSize: '0.75rem' }}>Tingkat Selesai</small>
                                                </>
                                            )}
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
                                        src={heroImage}
                                        alt="LMS DPD RI" 
                                        className="img-fluid hero-right-image"
                                        fetchpriority="high"
                                        loading="eager"
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
                                            <h4 className="mb-0 fw-bold card-heading-text">Sertifikat</h4>
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
                                            <h4 className="mb-0 fw-bold card-heading-text">Progress</h4>
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
            <section className="py-5 about-section snap-section" style={{ background: 'rgba(255,255,255,0.70)' }}>
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
                                                <h3 className="fw-bold mb-1">Pengembangan SDM</h3>
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
                                                <h3 className="fw-bold mb-1">Pembelajaran Digital</h3>
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
                                        src={regionMapImage}
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
            <section className="py-5 statistics-section snap-section" style={{ background: 'rgba(255,255,255,0.2)' }}>
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

                    {/* Changed to 2x4 layout (2 rows, 4 cards - compact design) */}
                    <div className="row g-3 justify-content-center">
                        {/* Row 1 - All 4 stats */}
                        <div className="col-lg-3 col-md-6">
                            {isStatsLoading ? (
                                <div 
                                    className="card border-0 h-100 text-center"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        padding: '1.5rem'
                                    }}
                                >
                                    <div className="placeholder rounded-circle mx-auto mb-3" style={{ width: '50px', height: '50px', background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                                    <div className="placeholder rounded mx-auto mb-2" style={{ width: '60%', height: '24px', background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                                    <div className="placeholder rounded mx-auto" style={{ width: '70%', height: '14px', background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                                </div>
                            ) : (
                                <div 
                                    className="card border-0 h-100 text-center"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div className="card-body p-3">
                                        <div 
                                            className="d-inline-flex align-items-center justify-content-center mb-2"
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                borderRadius: '12px',
                                                color: 'white',
                                                fontSize: '1.3rem'
                                            }}
                                        >
                                            <i className="fas fa-book-open"></i>
                                        </div>
                                        <h4 className="fw-bold mb-1" style={{ fontSize: '1.5rem', color: '#2c3e50' }}>{stats.total_courses}+</h4>
                                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Kursus Tersedia</p>
                                        <small className="text-success" style={{ fontSize: '0.75rem' }}>
                                            <i className="fas fa-arrow-up me-1"></i>
                                            +5 kursus baru
                                        </small>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="col-lg-3 col-md-6">
                            {isStatsLoading ? (
                                <div 
                                    className="card border-0 h-100"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        padding: '1.5rem'
                                    }}
                                >
                                    <div 
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '12px',
                                            margin: '0 auto 1rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '80px',
                                            height: '24px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto 0.5rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '100px',
                                            height: '16px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto'
                                        }}
                                    ></div>
                                </div>
                            ) : (
                                <div 
                                    className="card border-0 h-100 text-center"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div className="card-body p-3">
                                        <div 
                                            className="d-inline-flex align-items-center justify-content-center mb-2"
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                                                borderRadius: '12px',
                                                color: 'white',
                                                fontSize: '1.3rem'
                                            }}
                                        >
                                            <i className="fas fa-users"></i>
                                        </div>
                                        <h4 className="fw-bold mb-1" style={{ fontSize: '1.5rem', color: '#2c3e50' }}>{stats.total_students}+</h4>
                                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Peserta Aktif</p>
                                        <small className="text-success" style={{ fontSize: '0.75rem' }}>
                                            <i className="fas fa-arrow-up me-1"></i>
                                            +12 peserta baru
                                        </small>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="col-lg-3 col-md-6">
                            {isStatsLoading ? (
                                <div 
                                    className="card border-0 h-100"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        padding: '1.5rem'
                                    }}
                                >
                                    <div 
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '12px',
                                            margin: '0 auto 1rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '80px',
                                            height: '24px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto 0.5rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '100px',
                                            height: '16px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto'
                                        }}
                                    ></div>
                                </div>
                            ) : (
                                <div 
                                    className="card border-0 h-100 text-center"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div className="card-body p-3">
                                        <div 
                                            className="d-inline-flex align-items-center justify-content-center mb-2"
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                background: 'linear-gradient(135deg, #ffc107 0%, #ff8800 100%)',
                                                borderRadius: '12px',
                                                color: 'white',
                                                fontSize: '1.3rem'
                                            }}
                                        >
                                            <i className="fas fa-chalkboard-teacher"></i>
                                        </div>
                                        <h4 className="fw-bold mb-1" style={{ fontSize: '1.5rem', color: '#2c3e50' }}>{stats.total_teachers}+</h4>
                                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Instruktur Ahli</p>
                                        <small className="text-success" style={{ fontSize: '0.75rem' }}>
                                            <i className="fas fa-certificate me-1"></i>
                                            Tersertifikasi
                                        </small>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="col-lg-3 col-md-6">
                            {isStatsLoading ? (
                                <div 
                                    className="card border-0 h-100"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        padding: '1.5rem'
                                    }}
                                >
                                    <div 
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '12px',
                                            margin: '0 auto 1rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '80px',
                                            height: '24px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto 0.5rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '100px',
                                            height: '16px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto'
                                        }}
                                    ></div>
                                </div>
                            ) : (
                                <div 
                                    className="card border-0 h-100 text-center"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div className="card-body p-3">
                                        <div 
                                            className="d-inline-flex align-items-center justify-content-center mb-2"
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                background: 'linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)',
                                                borderRadius: '12px',
                                                color: 'white',
                                                fontSize: '1.3rem'
                                            }}
                                        >
                                            <i className="fas fa-chart-line"></i>
                                        </div>
                                        <h4 className="fw-bold mb-1" style={{ fontSize: '1.5rem', color: '#2c3e50' }}>{stats.completion_rate}%</h4>
                                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Tingkat Kelulusan</p>
                                        <small className="text-success" style={{ fontSize: '0.75rem' }}>
                                            <i className="fas fa-trophy me-1"></i>
                                            Rata-rata tinggi
                                        </small>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Row 2 - Additional stats for 2x4 visual layout */}
                        <div className="col-lg-3 col-md-6">
                            {isStatsLoading ? (
                                <div 
                                    className="card border-0 h-100"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        padding: '1.5rem'
                                    }}
                                >
                                    <div 
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '12px',
                                            margin: '0 auto 1rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '80px',
                                            height: '24px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto 0.5rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '100px',
                                            height: '16px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto'
                                        }}
                                    ></div>
                                </div>
                            ) : (
                                <div 
                                    className="card border-0 h-100 text-center"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div className="card-body p-3">
                                        <div 
                                            className="d-inline-flex align-items-center justify-content-center mb-2"
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                                                borderRadius: '12px',
                                                color: 'white',
                                                fontSize: '1.3rem'
                                            }}
                                        >
                                            <i className="fas fa-certificate"></i>
                                        </div>
                                        <h4 className="fw-bold mb-1" style={{ fontSize: '1.5rem', color: '#2c3e50' }}>{stats.total_certificates}+</h4>
                                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Sertifikat Diterbitkan</p>
                                        <small className="text-success" style={{ fontSize: '0.75rem' }}>
                                            <i className="fas fa-arrow-up me-1"></i>
                                            Terus meningkat
                                        </small>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="col-lg-3 col-md-6">
                            {isStatsLoading ? (
                                <div 
                                    className="card border-0 h-100"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        padding: '1.5rem'
                                    }}
                                >
                                    <div 
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '12px',
                                            margin: '0 auto 1rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '80px',
                                            height: '24px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto 0.5rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '100px',
                                            height: '16px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto'
                                        }}
                                    ></div>
                                </div>
                            ) : (
                                <div 
                                    className="card border-0 h-100 text-center"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div className="card-body p-3">
                                        <div 
                                            className="d-inline-flex align-items-center justify-content-center mb-2"
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                background: 'linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%)',
                                                borderRadius: '12px',
                                                color: 'white',
                                                fontSize: '1.3rem'
                                            }}
                                        >
                                            <i className="fas fa-clock"></i>
                                        </div>
                                        <h4 className="fw-bold mb-1" style={{ fontSize: '1.5rem', color: '#2c3e50' }}>24/7</h4>
                                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Akses Kapan Saja</p>
                                        <small className="text-success" style={{ fontSize: '0.75rem' }}>
                                            <i className="fas fa-check me-1"></i>
                                            Fleksibel
                                        </small>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="col-lg-3 col-md-6">
                            {isStatsLoading ? (
                                <div 
                                    className="card border-0 h-100"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        padding: '1.5rem'
                                    }}
                                >
                                    <div 
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '12px',
                                            margin: '0 auto 1rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '80px',
                                            height: '24px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto 0.5rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '100px',
                                            height: '16px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto'
                                        }}
                                    ></div>
                                </div>
                            ) : (
                                <div 
                                    className="card border-0 h-100 text-center"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div className="card-body p-3">
                                        <div 
                                            className="d-inline-flex align-items-center justify-content-center mb-2"
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                background: 'linear-gradient(135deg, #fd7e14 0%, #dc3545 100%)',
                                                borderRadius: '12px',
                                                color: 'white',
                                                fontSize: '1.3rem'
                                            }}
                                        >
                                            <i className="fas fa-video"></i>
                                        </div>
                                        <h4 className="fw-bold mb-1" style={{ fontSize: '1.5rem', color: '#2c3e50' }}>{stats.total_materials}+</h4>
                                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Video Pembelajaran</p>
                                        <small className="text-success" style={{ fontSize: '0.75rem' }}>
                                            <i className="fas fa-play me-1"></i>
                                            HD Quality
                                        </small>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="col-lg-3 col-md-6">
                            {isStatsLoading ? (
                                <div 
                                    className="card border-0 h-100"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        padding: '1.5rem'
                                    }}
                                >
                                    <div 
                                        style={{
                                            width: '50px',
                                            height: '50px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '12px',
                                            margin: '0 auto 1rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '80px',
                                            height: '24px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto 0.5rem'
                                        }}
                                    ></div>
                                    <div 
                                        style={{
                                            width: '100px',
                                            height: '16px',
                                            background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.5s infinite',
                                            borderRadius: '4px',
                                            margin: '0 auto'
                                        }}
                                    ></div>
                                </div>
                            ) : (
                                <div 
                                    className="card border-0 h-100 text-center"
                                    style={{
                                        borderRadius: '16px',
                                        background: 'white',
                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div className="card-body p-3">
                                        <div 
                                            className="d-inline-flex align-items-center justify-content-center mb-2"
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                background: 'linear-gradient(135deg, #20c997 0%, #28a745 100%)',
                                                borderRadius: '12px',
                                                color: 'white',
                                                fontSize: '1.3rem'
                                            }}
                                        >
                                            <i className="fas fa-star"></i>
                                        </div>
                                        <h4 className="fw-bold mb-1" style={{ fontSize: '1.5rem', color: '#2c3e50' }}>{stats.platform_rating}/5</h4>
                                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Rating Platform</p>
                                        <small className="text-success" style={{ fontSize: '0.75rem' }}>
                                            <i className="fas fa-thumbs-up me-1"></i>
                                            Sangat memuaskan
                                        </small>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Course Categories Section */}
            <section className="py-5 snap-section" style={{ background: 'rgba(255,255,255,0.70)' }}>
                <div className="container">
                    <div className="text-center mb-4">
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

                    {/* Changed to 2x4 layout (2 rows, 4 cards each - compact) */}
                    <div className="row g-3 justify-content-center">
                        {isLoading ? (
                            // Loading skeleton - 8 cards with placeholder content
                            [...Array(8)].map((_, index) => (
                                <div key={index} className="col-lg-3 col-md-6">
                                    <div 
                                        className="card border-0"
                                        style={{
                                            borderRadius: '16px',
                                            background: 'white',
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                            height: '160px',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div className="card-body p-3 text-center d-flex flex-column justify-content-center">
                                            <div 
                                                className="placeholder rounded-circle mx-auto mb-2"
                                                style={{
                                                    width: '50px',
                                                    height: '50px',
                                                    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                    backgroundSize: '200% 100%',
                                                    animation: 'shimmer 1.5s infinite'
                                                }}
                                            />
                                            <div 
                                                className="placeholder rounded mx-auto mb-2" 
                                                style={{ 
                                                    width: '70%', 
                                                    height: '16px',
                                                    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                    backgroundSize: '200% 100%',
                                                    animation: 'shimmer 1.5s infinite'
                                                }}
                                            />
                                            <div 
                                                className="placeholder rounded mx-auto" 
                                                style={{ 
                                                    width: '50%', 
                                                    height: '12px',
                                                    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                    backgroundSize: '200% 100%',
                                                    animation: 'shimmer 1.5s infinite'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : categories.length > 0 ? (
                            categories.slice(0, 8).map((category, index) => (
                                <div key={category.id} className="col-lg-3 col-md-6">
                                    <Link 
                                        to={`/search/?category=${encodeURIComponent(category.title)}`}
                                        className="text-decoration-none"
                                    >
                                        <div 
                                            className="card border-0 h-100"
                                            style={{
                                                borderRadius: '16px',
                                                background: 'white',
                                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                                transition: 'all 0.3s ease',
                                                cursor: 'pointer'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-5px)';
                                                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)';
                                            }}
                                        >
                                            <div className="card-body p-3 text-center">
                                                <div 
                                                    className="category-icon mx-auto mb-2"
                                                    style={{
                                                        width: '50px',
                                                        height: '50px',
                                                        background: `linear-gradient(135deg, ${
                                                            ['#667eea, #764ba2', '#28a745, #20c997', '#ffc107, #ff8800', '#dc3545, #e83e8c', '#17a2b8, #138496', '#6f42c1, #e83e8c', '#fd7e14, #dc3545', '#20c997, #28a745'][index % 8]
                                                        })`,
                                                        borderRadius: '12px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        fontSize: '1.5rem'
                                                    }}
                                                >
                                                    <i 
                                                        className={`fas ${
                                                            ['fa-globe', 'fa-chart-line', 'fa-paint-brush', 'fa-code', 'fa-database', 'fa-tools', 'fa-brain', 'fa-graduation-cap'][index % 8]
                                                        }`}
                                                        style={{
                                                            fontSize: '1.3rem'
                                                        }}
                                                    ></i>
                                                </div>
                                                
                                                <h3 className="fw-bold mb-1" style={{ color: '#2c3e50', fontSize: '0.95rem' }}>
                                                    {category.title}
                                                </h3>
                                                
                                                <p className="text-muted mb-2" style={{ fontSize: '0.8rem' }}>
                                                    {category.course_count} kursus
                                                </p>
                                                
                                                <div 
                                                    className="btn btn-sm"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        fontWeight: '500',
                                                        fontSize: '0.75rem',
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
                                to="/search/"
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
            <section id="courses-section" className="py-5 snap-section" style={{ background: 'rgba(255,255,255,0.2)' }}>
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

                    {/* Changed to 3x1 layout (1 row, 3 cards - compact) */}
                    <div className="row g-3 justify-content-center">
                        {isLoading ? (
                            // Loading skeleton - 3 course cards with placeholder content
                            [...Array(3)].map((_, index) => (
                                <div key={index} className="col-lg-4 col-md-6">
                                    <div 
                                        className="card border-0"
                                        style={{
                                            borderRadius: '16px',
                                            background: 'white',
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                            height: '380px',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div 
                                            className="placeholder" 
                                            style={{ 
                                                height: '180px', 
                                                background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                backgroundSize: '200% 100%',
                                                animation: 'shimmer 1.5s infinite'
                                            }}
                                        />
                                        <div className="card-body p-3">
                                            <div 
                                                className="placeholder rounded mb-2" 
                                                style={{ 
                                                    width: '60%', 
                                                    height: '12px',
                                                    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                    backgroundSize: '200% 100%',
                                                    animation: 'shimmer 1.5s infinite'
                                                }}
                                            />
                                            <div 
                                                className="placeholder rounded mb-2" 
                                                style={{ 
                                                    width: '90%', 
                                                    height: '18px',
                                                    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                    backgroundSize: '200% 100%',
                                                    animation: 'shimmer 1.5s infinite'
                                                }}
                                            />
                                            <div 
                                                className="placeholder rounded mb-3" 
                                                style={{ 
                                                    width: '70%', 
                                                    height: '18px',
                                                    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                    backgroundSize: '200% 100%',
                                                    animation: 'shimmer 1.5s infinite'
                                                }}
                                            />
                                            <div className="d-flex justify-content-between mb-2">
                                                <div 
                                                    className="placeholder rounded" 
                                                    style={{ 
                                                        width: '45%', 
                                                        height: '14px',
                                                        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                        backgroundSize: '200% 100%',
                                                        animation: 'shimmer 1.5s infinite'
                                                    }}
                                                />
                                                <div 
                                                    className="placeholder rounded" 
                                                    style={{ 
                                                        width: '45%', 
                                                        height: '14px',
                                                        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                        backgroundSize: '200% 100%',
                                                        animation: 'shimmer 1.5s infinite'
                                                    }}
                                                />
                                            </div>
                                            <div 
                                                className="placeholder rounded" 
                                                style={{ 
                                                    width: '100%', 
                                                    height: '40px',
                                                    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                    backgroundSize: '200% 100%',
                                                    animation: 'shimmer 1.5s infinite'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : featuredCourses.length > 0 ? (
                            featuredCourses.slice(0, 3).map((course, index) => (
                                <div key={course.id} className="col-lg-4 col-md-6">
                                    <div 
                                        className="card border-0 h-100 course-card"
                                        style={{
                                            borderRadius: '16px',
                                            background: 'white',
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                                            transition: 'all 0.3s ease',
                                            overflow: 'hidden',
                                            position: 'relative'
                                        }}
                                    >
                                        {/* Gradient Overlay on Hover */}
                                        <div 
                                            className="card-gradient-overlay"
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                                                opacity: 0,
                                                transition: 'opacity 0.3s ease',
                                                pointerEvents: 'none',
                                                zIndex: 1
                                            }}
                                        />
                                        
                                        {/* Course Image */}
                                        <div className="position-relative" style={{ overflow: 'hidden' }}>
                                            <img 
                                                src={getImageUrl(course.image) || "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png"} 
                                                alt={course.title}
                                                className="card-img-top course-card-image"
                                                style={{ 
                                                    height: '180px',
                                                    objectFit: 'cover',
                                                    transition: 'transform 0.3s ease'
                                                }}
                                                onError={(e) => {
                                                    e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                                }}
                                            />
                                            
                                            {/* Wishlist Button - Only show for students */}
                                            {!isAdminOrTeacher && (
                                                <button 
                                                    onClick={() => addToWishlist(course.id)}
                                                    className="btn position-absolute wishlist-btn"
                                                    title={isCourseInWishlist(course.id) ? "Hapus dari wishlist" : "Tambahkan ke wishlist"}
                                                    disabled={!userId}
                                                    style={{
                                                        top: '10px',
                                                        right: '10px',
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '50%',
                                                        background: 'rgba(255, 255, 255, 0.95)',
                                                        backdropFilter: 'blur(10px)',
                                                        border: 'none',
                                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.3s ease',
                                                        zIndex: 2
                                                    }}
                                                >
                                                    <i 
                                                        className={`${isCourseInWishlist(course.id) ? 'fas' : 'far'} fa-heart`}
                                                        style={{
                                                            color: isCourseInWishlist(course.id) ? '#dc3545' : '#6c757d',
                                                            fontSize: '0.95rem'
                                                        }}
                                                    />
                                                </button>
                                            )}

                                            {/* Level Badge */}
                                            <div 
                                                className="position-absolute"
                                                style={{
                                                    bottom: '10px',
                                                    left: '10px',
                                                    zIndex: 2
                                                }}
                                            >
                                                <span 
                                                    className="badge"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        color: 'white',
                                                        padding: '0.35rem 0.75rem',
                                                        borderRadius: '8px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: '600',
                                                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                                    }}
                                                >
                                                    <i className="fas fa-signal me-1"></i>
                                                    {course.level}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Card Body */}
                                        <div className="card-body p-3" style={{ position: 'relative', zIndex: 2 }}>
                                            {/* Category */}
                                            <div className="mb-2">
                                                <span 
                                                    className="badge"
                                                    style={{
                                                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                                                        color: '#667eea',
                                                        border: '1px solid rgba(102, 126, 234, 0.2)',
                                                        borderRadius: '8px',
                                                        fontSize: '0.65rem',
                                                        fontWeight: '600',
                                                        padding: '0.3rem 0.6rem'
                                                    }}
                                                >
                                                    <i className="fas fa-folder me-1"></i>
                                                    {course.category?.title || 'General'}
                                                </span>
                                            </div>

                                            {/* Course Title */}
                                            <h3 className="fw-bold mb-2" style={{ minHeight: '42px', fontSize: '0.95rem' }}>
                                                <Link 
                                                    to={`/course-detail/${course.slug}/`}
                                                    className="text-decoration-none course-title-link"
                                                    style={{ 
                                                        color: '#2c3e50',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: '2',
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden',
                                                        lineHeight: '1.4',
                                                        transition: 'color 0.3s ease'
                                                    }}
                                                >
                                                    {course.title}
                                                </Link>
                                            </h3>

                                            {/* Instructor */}
                                            <div className="mb-2 d-flex align-items-center">
                                                <div 
                                                    style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        marginRight: '8px'
                                                    }}
                                                >
                                                    <i className="fas fa-user-tie" style={{ color: 'white', fontSize: '0.7rem' }}></i>
                                                </div>
                                                <small className="text-muted" style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                                                    {course.teacher?.full_name || 'Instruktur'}
                                                </small>
                                            </div>

                                            {/* Rating & Stats */}
                                            <div 
                                                className="d-flex align-items-center justify-content-between mb-2 p-2"
                                                style={{
                                                    background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                                                    borderRadius: '8px'
                                                }}
                                            >
                                                <div className="d-flex align-items-center">
                                                    <Rating
                                                        initialValue={course.average_rating || 0}
                                                        readonly={true}
                                                        size={14}
                                                        fillColor="#ffc107"
                                                        emptyColor="#e4e5e9"
                                                    />
                                                    <span className="text-warning fw-bold ms-1" style={{ fontSize: '0.8rem' }}>
                                                        {course.average_rating || 0}
                                                    </span>
                                                </div>
                                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                    ({course.reviews?.length || 0})
                                                </small>
                                            </div>

                                            {/* Students Count */}
                                            <div 
                                                className="d-flex align-items-center justify-content-between p-2 mb-2"
                                                style={{
                                                    background: 'rgba(40, 167, 69, 0.05)',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(40, 167, 69, 0.1)'
                                                }}
                                            >
                                                <small className="fw-medium" style={{ fontSize: '0.8rem', color: '#146c43' }}>
                                                    <i className="fas fa-users me-1"></i>
                                                    {course.students?.length || 0} siswa
                                                </small>
                                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                    <i className="fas fa-book-open me-1"></i>
                                                    Aktif
                                                </small>
                                            </div>
                                        </div>

                                        {/* Card Footer */}
                                        <div className="card-footer bg-transparent border-0 p-3 pt-0" style={{ position: 'relative', zIndex: 2 }}>
                                            <Link 
                                                to={`/course-detail/${course.slug}/`} 
                                                className="btn w-100 fw-semibold course-detail-btn"
                                                style={{
                                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    color: 'white',
                                                    transition: 'all 0.3s ease',
                                                    padding: '0.6rem 1rem',
                                                    fontSize: '0.85rem',
                                                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                                }}
                                            >
                                                <i className="fas fa-arrow-right me-2"></i>
                                                Mulai Belajar
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
                                to="/search/"
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
            <section className="py-5 snap-section cta-section" style={{ 
                background: 'linear-gradient(135deg, rgba(102,126,234,0.85) 0%, rgba(118,75,162,0.85) 100%)',
            }}>
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-lg-8">
                            <h2 className="display-6 fw-bold mb-3" style={{ color: 'white' }}>
                                Siap Memulai Perjalanan Pembelajaran Anda?
                            </h2>
                            <p className="lead mb-0" style={{ color: 'white' }}>
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
                                    boxShadow: '0 8px 25px rgba(255, 255, 255, 0.2)',
                                    cursor: 'pointer',
                                    pointerEvents: 'auto',
                                    position: 'relative',
                                    zIndex: 10,
                                    textDecoration: 'none',
                                    display: 'inline-block'
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
            <section className="py-5 snap-section" style={{ background: 'rgba(255,255,255,0.2)' }}>
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
                        
                        <h2 className="display-6 fw-bold mb-3" style={{ color: '#2c3e50', fontSize: '2.2rem' }}>
                            Apa Kata Mereka?
                        </h2>
                        
                        <p className="lead text-muted mb-0" style={{ fontSize: '1.1rem' }}>
                            Pengalaman nyata dari para peserta yang telah merasakan manfaat LMSetjen DPD RI
                        </p>
                    </div>

                    <div className="row g-3">
                        {/* Testimonial 1 */}
                        <div className="col-lg-4">
                            <div 
                                className="card border-0 h-100"
                                style={{
                                    borderRadius: '20px',
                                    background: 'white',
                                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)',
                                    border: '1px solid #e9ecef'
                                }}
                            >
                                <div className="card-body text-center p-4">
                                    {/* Avatar */}
                                    <div 
                                        className="mx-auto mb-3"
                                        style={{
                                            width: '70px',
                                            height: '70px',
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
                                    <p className="mb-3 fst-italic" style={{ lineHeight: '1.7', color: '#6c757d', fontSize: '0.95rem' }}>
                                        "Platform yang sangat membantu dalam pengembangan skill. 
                                        Materi yang disajikan berkualitas dan mudah dipahami. Saya berhasil 
                                        meningkatkan kemampuan analisis data dengan mengikuti kursus di sini."
                                    </p>
                                    
                                    {/* Rating */}
                                    <div className="mb-3">
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <span className="text-warning fw-medium ms-2" style={{ fontSize: '0.95rem' }}>5.0</span>
                                    </div>
                                    
                                    {/* User Info */}
                                    <h3 className="fw-bold mb-1" style={{ color: '#343a40', fontSize: '1rem' }}>Siti Rahayu, S.E.</h3>
                                    <small className="text-muted" style={{ fontSize: '0.85rem' }}>Staff Keuangan Setjen DPD RI</small>
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
                                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)',
                                    border: '1px solid #e9ecef'
                                }}
                            >
                                <div className="card-body text-center p-4">
                                    {/* Avatar */}
                                    <div 
                                        className="mx-auto mb-3"
                                        style={{
                                            width: '70px',
                                            height: '70px',
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
                                    <p className="mb-3 fst-italic" style={{ lineHeight: '1.7', color: '#6c757d', fontSize: '0.95rem' }}>
                                        "Sistem pembelajaran yang user-friendly dan instruktur yang kompeten. 
                                        Sangat recommended untuk pengembangan karir. Kursus manajemen proyek 
                                        membantu saya dalam mengorganisir pekerjaan dengan lebih efektif."
                                    </p>
                                    
                                    {/* Rating */}
                                    <div className="mb-3">
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <span className="text-warning fw-medium ms-2" style={{ fontSize: '0.95rem' }}>5.0</span>
                                    </div>
                                    
                                    {/* User Info */}
                                    <h3 className="fw-bold mb-1" style={{ color: '#343a40', fontSize: '1rem' }}>Ahmad Fauzi, S.H.</h3>
                                    <small className="text-muted" style={{ fontSize: '0.85rem' }}>Analis Kebijakan Setjen DPD RI</small>
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
                                    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.1)',
                                    border: '1px solid #e9ecef'
                                }}
                            >
                                <div className="card-body text-center p-4">
                                    {/* Avatar */}
                                    <div 
                                        className="mx-auto mb-3"
                                        style={{
                                            width: '70px',
                                            height: '70px',
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
                                    <p className="mb-3 fst-italic" style={{ lineHeight: '1.7', color: '#6c757d', fontSize: '0.95rem' }}>
                                        "Fitur-fitur pembelajaran yang lengkap dan user-friendly. Platform ini benar-benar 
                                        membantu dalam meningkatkan efektivitas proses pembelajaran di institusi. 
                                        Interface yang intuitif memudahkan navigasi untuk semua kalangan usia."
                                    </p>
                                    
                                    {/* Rating */}
                                    <div className="mb-3">
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <i className="fas fa-star text-warning" style={{ fontSize: '0.9rem' }}></i>
                                        <span className="text-warning fw-medium ms-2" style={{ fontSize: '0.95rem' }}>5.0</span>
                                    </div>
                                    
                                    {/* User Info */}
                                    <h3 className="fw-bold mb-1" style={{ color: '#343a40', fontSize: '1rem' }}>Dr. Muhammad Sadli</h3>
                                    <small className="text-muted" style={{ fontSize: '0.85rem' }}>Kepala Biro Umum Setjen DPD RI</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Footer integrated into last section */}
                <div className="mt-5 pt-4">
                    <BaseFooter />
                </div>
            </section>
            </div>
            </main>
        </>
    );
}

export default Index;