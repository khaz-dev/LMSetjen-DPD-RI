import { useEffect, useState, useContext, useCallback, useRef } from "react";
import BaseHeader from "../partials/BaseHeader";
import BaseFooter from "../partials/BaseFooter";
import { Link } from "react-router-dom";
import { Rating } from "react-simple-star-rating";

import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import { WishlistContext } from "../plugin/Context";
import apiInstance from "../../utils/axios";
import { getImageUrl, getLevelText } from "../../utils/courseUtils";
import { parseDurationToSeconds } from "../../utils/durationUtils"; // ✨ PHASE 4.77+: Calculate JP
import SEO from "../../components/SEO";
import TestimonialSection from "../../components/TestimonialSection";
import RankedStudents from "../../components/Rankings/RankedStudents";  // ✨ PHASE 10.1: Ranking components
import RankedInstructors from "../../components/Rankings/RankedInstructors";  // ✨ PHASE 10.1: Ranking components
import "./Index.css";

// Import frontend assets (Modern WebP + JPG fallback)
import heroImageWebP from "../../assets/LMSetjen-DPD-RI.webp";
import heroImageJpg from "../../assets/LMSetjen-DPD-RI.jpg";
import regionMapWebP from "../../assets/region-indonesia-map.webp";
import regionMapJpg from "../../assets/region-indonesia-map.jpg";

function Index() {
    const [courses, setCourses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [featuredCourses, setFeaturedCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isStatsLoading, setIsStatsLoading] = useState(true);
    const [wishlistItems, setWishlistItems] = useState([]);
    const [activeSection, setActiveSection] = useState(0);
    const [showSectionLabel, setShowSectionLabel] = useState(false);
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

    // ✨ PHASE 4.177: Fetch guard to prevent duplicate API calls in React Strict Mode
    const hasFetchedRef = useRef(false);

    const userData = UserData();
    const userId = userData?.user_id;
    const userRole = userData?.role; // Get user role from token
    const isAdminOrTeacher = userRole === "admin" || userRole === "teacher" || userRole === "instructor";

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch courses and categories in parallel for better performance
            const [coursesResponse, categoriesResponse] = await Promise.all([
                apiInstance.get("/course/course-list/"),
                apiInstance.get("/course/category/")
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
            const response = await apiInstance.get("/statistics/public-stats/");
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
                setStats(newStats);
            }
        } catch (error) {
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
            // Handle both paginated and non-paginated responses
            const wishlistData = response.data?.results || response.data || [];
            // Ensure wishlistData is an array
            const wishlistArray = Array.isArray(wishlistData) ? wishlistData : [];
            setWishlistItems(wishlistArray);
        } catch (error) {
            // Set empty array on error to prevent .some() errors
            setWishlistItems([]);
        }
    }, [userId]);

    // Check if course is in wishlist
    const isCourseInWishlist = (courseId) => {
        // Ensure wishlistItems is an array before calling .some()
        const items = Array.isArray(wishlistItems) ? wishlistItems : [];
        return items.some(item => item.course?.id === courseId);
    };

    useEffect(() => {
        // Scroll to top on page load
        window.scrollTo(0, 0);

        // ✨ PHASE 4.177: Guard against duplicate API calls in React Strict Mode
        // Skip if data is already loaded (check for any course data)
        if (courses && courses.length > 0) return;

        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;

        // Fetch data
        fetchData();
        fetchStatistics();

        // Fetch wishlist items if user is logged in
        if (userId && !isAdminOrTeacher) {
            fetchWishlistItems();
        }
    }, [userId, isAdminOrTeacher, courses?.length]);

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
            Toast().fire({
                icon: "error",
                title: "Terjadi kesalahan. Silakan coba lagi.",
            });
        }
    }, [userId, isAdminOrTeacher, refreshWishlistCount, fetchWishlistItems]);

    // ✨ PHASE 4.77+: Calculate total JP (Jam Pelajaran) from course lectures
    // 1 JP = 45 seconds, so JP = Math.ceil(totalSeconds / 2700)
    const calculateTotalJP = useCallback((lectures) => {
        if (!lectures || !Array.isArray(lectures)) return 0;

        let totalSeconds = 0;
        lectures.forEach(lecture => {
            if (lecture.content_duration) {
                totalSeconds += parseDurationToSeconds(lecture.content_duration);
            }
        });

        // 1 JP = 45 minutes = 2700 seconds
        return Math.ceil(totalSeconds / 2700);
    }, []);

    // Section navigation configuration
    const sections = [
        { id: "hero", label: "Beranda", icon: "home" },
        { id: "about", label: "Tentang", icon: "building" },
        { id: "statistics", label: "Statistik", icon: "chart-bar" },
        { id: "categories", label: "Kategori", icon: "th-large" },
        { id: "courses", label: "Kursus", icon: "graduation-cap" },
        { id: "cta", label: "Peringkat", icon: "rocket" },
        { id: "testimonials", label: "Testimoni", icon: "quote-left" }
    ];

    // Handle scroll to track active section
    useEffect(() => {
        const container = document.querySelector(".landing-page-container");
        if (!container) return;

        let scrollTimeout;
        let hideTimeout;

        const handleScroll = () => {
            // Debounce scroll events for better performance
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const sections = document.querySelectorAll(".snap-section");
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
                        }, 5174);
                    }
                });
            }, 50); // 50ms debounce for smooth performance
        };

        // Add scroll listener with passive for better performance
        container.addEventListener("scroll", handleScroll, { passive: true });

        // Initial check
        handleScroll();

        return () => {
            container.removeEventListener("scroll", handleScroll);
            clearTimeout(scrollTimeout);
            if (hideTimeout) {
                clearTimeout(hideTimeout);
            }
        };
    }, []);

    // Scroll to section with enhanced smooth behavior
    const scrollToSection = useCallback((index) => {
        const sections = document.querySelectorAll(".snap-section");
        if (sections[index]) {
            // Show label when user clicks to scroll
            setShowSectionLabel(true);

            // Hide label after 3 seconds
            setTimeout(() => {
                setShowSectionLabel(false);
            }, 3000);

            sections[index].scrollIntoView({
                behavior: "smooth",
                block: "start",
                inline: "nearest"
            });
        }
    }, []);

    // Full 100% Snap Wheel & Keyboard Controller (prevents getting stuck in the middle)
    useEffect(() => {
        const container = document.querySelector(".landing-page-container");
        if (!container) return;

        let isSnapping = false;
        let snapTimer = null;

        const onWheel = (e) => {
            // Only on desktop/tablet viewports (> 991px)
            if (window.innerWidth <= 991) return;

            // Ignore subtle movements (deltaY between -18 and 18)
            if (Math.abs(e.deltaY) < 18) return;

            e.preventDefault();

            if (isSnapping) return;

            const sections = document.querySelectorAll(".snap-section");
            if (!sections || sections.length === 0) return;

            const currentScroll = container.scrollTop;

            // Determine closest section
            let closestIdx = 0;
            let minDiff = Infinity;
            sections.forEach((sec, idx) => {
                const diff = Math.abs(sec.offsetTop - currentScroll);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = idx;
                }
            });

            let targetIdx = closestIdx;
            if (e.deltaY > 0) {
                targetIdx = Math.min(closestIdx + 1, sections.length - 1);
            } else {
                targetIdx = Math.max(closestIdx - 1, 0);
            }

            isSnapping = true;
            scrollToSection(targetIdx);

            clearTimeout(snapTimer);
            snapTimer = setTimeout(() => {
                isSnapping = false;
            }, 650);
        };

        const onKeyDown = (e) => {
            if (window.innerWidth <= 991) return;
            if (["ArrowDown", "PageDown", " "].includes(e.key)) {
                if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
                e.preventDefault();
                const sections = document.querySelectorAll(".snap-section");
                const currentScroll = container.scrollTop;
                let closestIdx = 0;
                let minDiff = Infinity;
                sections.forEach((sec, idx) => {
                    const diff = Math.abs(sec.offsetTop - currentScroll);
                    if (diff < minDiff) { minDiff = diff; closestIdx = idx; }
                });
                scrollToSection(Math.min(closestIdx + 1, sections.length - 1));
            } else if (["ArrowUp", "PageUp"].includes(e.key)) {
                if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
                e.preventDefault();
                const sections = document.querySelectorAll(".snap-section");
                const currentScroll = container.scrollTop;
                let closestIdx = 0;
                let minDiff = Infinity;
                sections.forEach((sec, idx) => {
                    const diff = Math.abs(sec.offsetTop - currentScroll);
                    if (diff < minDiff) { minDiff = diff; closestIdx = idx; }
                });
                scrollToSection(Math.max(closestIdx - 1, 0));
            }
        };

        container.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("keydown", onKeyDown);

        return () => {
            container.removeEventListener("wheel", onWheel);
            window.removeEventListener("keydown", onKeyDown);
            clearTimeout(snapTimer);
        };
    }, [scrollToSection]);

    return (
        <>
            <SEO
                title="Beranda - LMSetjen DPD RI | Learning Management System"
                description="Platform pembelajaran online Setjen DPD RI. Akses ribuan kursus, pelatihan, dan program sertifikasi untuk meningkatkan kompetensi pegawai DPD RI."
                keywords="LMS DPD RI, e-learning Setjen, pelatihan online, kursus pegawai, sertifikasi DPD RI"
                preloadImages={[
                    { href: heroImageWebP, type: "image/webp", fetchPriority: "high" }
                ]}
            />
            {/* Fixed Header - Always on top */}
            <div className="landing-fixed-header">
                <BaseHeader />
            </div>

            {/* Main Content */}
            <main id="main-content" role="main" className="index-page">
                {/* Section Navigation Indicator */}
                <div className="section-navigation">
                    {sections.map((section, index) => (
                        <div
                            key={section.id}
                            className={`section-nav-item ${activeSection === index ? "active" : ""}`}
                            onClick={() => scrollToSection(index)}
                        >
                            <div className="section-nav-dot"></div>
                            <div className={`section-nav-label ${showSectionLabel && activeSection === index ? "visible" : ""}`}>
                                <i className={`fas fa-${section.icon} me-2`}></i>
                                {section.label}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="landing-page-container">
                    {/* Hero Section */}
                    <section className="hero-section snap-section">
                        {/* Background Geometric Grid & Radial Glow Pattern */}
                        <div className="hero-background-pattern" aria-hidden="true"></div>

                        <div className="container position-relative hero-container">
                            <div className="row align-items-center g-4">
                                {/* Hero Left Content */}
                                <div className="col-lg-6 hero-text-col">
                                    <div className="hero-content text-white">
                                        {/* Institutional Pill Badge */}
                                        <div className="hero-badge-pill mb-2">
                                            <span className="hero-badge-dot"></span>
                                            <i className="fas fa-university me-2 hero-badge-icon"></i>
                                            <span className="fw-semibold">Sekretariat Jenderal DPD RI</span>
                                            <span className="hero-badge-sep">•</span>
                                            <span className="hero-badge-sub">E-Learning BPSDM OKK</span>
                                        </div>

                                        {/* Main Headline */}
                                        <h1 className="hero-main-title mb-2">
                                            LMS<span className="hero-title-accent">etjen</span> DPD RI
                                        </h1>

                                        {/* Tagline */}
                                        <h2 className="hero-subtitle mb-2">
                                            Pusat Pembelajaran Digital &amp; Akselerasi Kompetensi ASN Parlemen
                                        </h2>

                                        {/* Concise Description */}
                                        <p className="hero-description mb-3">
                                            Tingkatkan kapasitas dan kapabilitas profesional aparatur sipil negara melalui kurikulum terstruktur, materi interaktif, dan sertifikasi resmi terpadu.
                                        </p>

                                        {/* CTA Action Buttons */}
                                        <div className="d-flex flex-wrap gap-2 mb-3 align-items-center hero-action-buttons">
                                            <button
                                                className="btn hero-btn-primary-compact"
                                                onClick={() => document.getElementById("courses-section")?.scrollIntoView({ behavior: "smooth" })}
                                            >
                                                <i className="fas fa-graduation-cap me-2"></i>
                                                <span>Jelajahi Kursus</span>
                                                <i className="fas fa-arrow-right ms-2 hero-btn-arrow"></i>
                                            </button>
                                            <button
                                                className="btn hero-btn-secondary-compact"
                                                onClick={() => document.querySelector(".about-section")?.scrollIntoView({ behavior: "smooth" })}
                                            >
                                                <i className="fas fa-landmark me-2"></i>
                                                <span>Tentang Setjen DPD RI</span>
                                            </button>
                                        </div>

                                        {/* Integrated Live Stats Glass Ribbon (Compact 4-column) */}
                                        <div className="hero-stats-ribbon">
                                            <div className="hero-stat-cell">
                                                {isStatsLoading ? (
                                                    <div className="hero-stat-shimmer"></div>
                                                ) : (
                                                    <>
                                                        <div className="hero-stat-value">{stats.total_courses}+</div>
                                                        <div className="hero-stat-label">
                                                            <i className="fas fa-book-open me-1 text-warning"></i> Kursus
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="hero-stat-divider"></div>
                                            <div className="hero-stat-cell">
                                                {isStatsLoading ? (
                                                    <div className="hero-stat-shimmer"></div>
                                                ) : (
                                                    <>
                                                        <div className="hero-stat-value">{stats.total_students}+</div>
                                                        <div className="hero-stat-label">
                                                            <i className="fas fa-users me-1 text-info"></i> Peserta
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="hero-stat-divider"></div>
                                            <div className="hero-stat-cell">
                                                {isStatsLoading ? (
                                                    <div className="hero-stat-shimmer"></div>
                                                ) : (
                                                    <>
                                                        <div className="hero-stat-value">{stats.completion_rate}%</div>
                                                        <div className="hero-stat-label">
                                                            <i className="fas fa-check-circle me-1 text-success"></i> Kelulusan
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <div className="hero-stat-divider"></div>
                                            <div className="hero-stat-cell">
                                                {isStatsLoading ? (
                                                    <div className="hero-stat-shimmer"></div>
                                                ) : (
                                                    <>
                                                        <div className="hero-stat-value d-flex align-items-center justify-content-center">
                                                            <span>{stats.platform_rating}</span>
                                                            <i className="fas fa-star ms-1 text-warning" style={{ fontSize: "0.8rem" }}></i>
                                                        </div>
                                                        <div className="hero-stat-label">Rating</div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Hero Right Visual Showcase */}
                                <div className="col-lg-6 hero-visual-col">
                                    <div className="hero-showcase-card">
                                        {/* Card Top Pill */}
                                        <div className="hero-showcase-header">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="hero-showcase-tag">
                                                    <i className="fas fa-shield-alt text-warning me-1"></i> BPSDM OKK
                                                </span>
                                                <span className="hero-showcase-status">
                                                    <span className="hero-status-pulse"></span> Sistem Terverifikasi
                                                </span>
                                            </div>
                                            <span className="hero-showcase-inst">Setjen DPD RI &bull; 2026</span>
                                        </div>

                                        {/* Precision Image Container */}
                                        <div className="hero-image-wrapper">
                                            <picture>
                                                <source srcSet={heroImageWebP} type="image/webp" />
                                                <img
                                                    src={heroImageJpg}
                                                    alt="LMSetjen DPD RI - Platform Pembelajaran Digital Pegawai"
                                                    className="img-fluid hero-showcase-img"
                                                    loading="eager"
                                                    /* eslint-disable-next-line react/no-unknown-property */
                                                    fetchpriority="high"
                                                    decoding="async"
                                                    width="1024"
                                                    height="764"
                                                />
                                            </picture>
                                            <div className="hero-image-gradient-veil" aria-hidden="true"></div>
                                        </div>

                                        {/* Floating Elements Within Bounds */}
                                        <div className="hero-float-chip hero-float-top-right">
                                            <div className="hero-chip-icon-box bg-teal-gradient">
                                                <i className="fas fa-certificate text-white"></i>
                                            </div>
                                            <div className="hero-chip-text">
                                                <div className="hero-chip-heading">Sertifikat Resmi</div>
                                                <small className="hero-chip-sub">Diakui Instansi</small>
                                            </div>
                                        </div>

                                        <div className="hero-float-chip hero-float-bottom-left">
                                            <div className="hero-chip-icon-box bg-amber-gradient">
                                                <i className="fas fa-chart-line text-white"></i>
                                            </div>
                                            <div className="hero-chip-text">
                                                <div className="hero-chip-heading">Progress ASN</div>
                                                <small className="hero-chip-sub">Real-time Tracking</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Compact Scroll Cue Indicator */}
                        <div className="hero-scroll-cue">
                            <button
                                type="button"
                                className="hero-scroll-cue-btn"
                                onClick={() => scrollToSection(1)}
                                aria-label="Scroll ke bagian Tentang Setjen DPD RI"
                            >
                                <span className="hero-scroll-cue-text">Eksplorasi Platform</span>
                                <i className="fas fa-chevron-down hero-scroll-chevron"></i>
                            </button>
                        </div>
                    </section>

                    {/* About DPD RI Section */}
                    <section className="about-section snap-section">
                        {/* Background Geometric Grid & Luminous Glow Pattern */}
                        <div className="about-background-pattern" aria-hidden="true"></div>

                        <div className="container position-relative about-container">
                            <div className="row align-items-center g-4 about-row">
                                {/* About Left Text Column */}
                                <div className="col-lg-6 about-text-col">
                                    <div className="about-content">
                                        {/* Institutional Pill Badge */}
                                        <div className="about-badge-pill mb-2">
                                            <span className="about-badge-dot"></span>
                                            <i className="fas fa-landmark me-2"></i>
                                            <span>Profil Lembaga</span>
                                            <span className="about-badge-sep">•</span>
                                            <span className="about-badge-sub">Setjen DPD RI</span>
                                        </div>

                                        {/* Main Headline */}
                                        <h2 className="about-main-title mb-2">
                                            Sekretariat Jenderal <span className="about-title-accent">DPD RI</span>
                                        </h2>

                                        {/* Subtitle / Tagline */}
                                        <h3 className="about-subtitle mb-2">
                                            Dukungan Keahlian, Administratif &amp; Operasional Parlemen Berintegritas
                                        </h3>

                                        {/* Concise Description */}
                                        <p className="about-description mb-3">
                                            Perangkat pendukung sistem parlemen yang menyelenggarakan dukungan teknis, administratif, dan keahlian untuk menunjang kelancaran fungsi legislasi, pengawasan, dan penganggaran DPD RI di seluruh wilayah nusantara.
                                        </p>

                                        {/* Feature Highlights Grid */}
                                        <div className="about-features-grid mb-3">
                                            <div className="about-feature-card">
                                                <div className="about-feature-icon-box teal">
                                                    <i className="fas fa-users-cog"></i>
                                                </div>
                                                <div>
                                                    <div className="about-feature-heading">Pengembangan SDM</div>
                                                    <div className="about-feature-sub">Peningkatan kompetensi aparatur parlemen</div>
                                                </div>
                                            </div>

                                            <div className="about-feature-card">
                                                <div className="about-feature-icon-box gold">
                                                    <i className="fas fa-laptop-code"></i>
                                                </div>
                                                <div>
                                                    <div className="about-feature-heading">Pembelajaran Digital</div>
                                                    <div className="about-feature-sub">Transformasi e-learning terpadu &amp; adaptif</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Action Discovery Buttons */}
                                        <div className="about-action-buttons d-flex flex-wrap gap-2 mb-3 align-items-center">
                                            <button
                                                type="button"
                                                className="btn about-btn-primary-compact"
                                                onClick={() => scrollToSection(2)}
                                            >
                                                <i className="fas fa-chart-line me-2"></i>
                                                <span>Capaian Platform</span>
                                                <i className="fas fa-arrow-down ms-2 about-btn-arrow"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn about-btn-secondary-compact"
                                                onClick={() => scrollToSection(3)}
                                            >
                                                <i className="fas fa-th-large me-2"></i>
                                                <span>Kategori Kursus</span>
                                            </button>
                                        </div>

                                        {/* Institutional Focus Pillars Ribbon */}
                                        <div className="about-pillars-ribbon">
                                            <div className="about-pillar-item">
                                                <i className="fas fa-scroll text-teal me-1"></i> Legislasi
                                            </div>
                                            <span className="about-pillar-sep">&bull;</span>
                                            <div className="about-pillar-item">
                                                <i className="fas fa-shield-alt text-warning me-1"></i> Pengawasan
                                            </div>
                                            <span className="about-pillar-sep">&bull;</span>
                                            <div className="about-pillar-item">
                                                <i className="fas fa-coins text-success me-1"></i> Anggaran
                                            </div>
                                            <span className="about-pillar-sep">&bull;</span>
                                            <div className="about-pillar-item">
                                                <i className="fas fa-map-location-dot text-info me-1"></i> 38 Provinsi
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* About Right Visual Showcase */}
                                <div className="col-lg-6 about-visual-col">
                                    <div className="about-showcase-card">
                                        {/* Showcase Header */}
                                        <div className="about-showcase-header">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="about-showcase-tag">
                                                    <i className="fas fa-map-marked-alt me-1"></i> Wilayah Kerja
                                                </span>
                                                <span className="about-showcase-status">
                                                    <span className="hero-status-pulse"></span> Sabang &ndash; Merauke
                                                </span>
                                            </div>
                                            <span className="hero-showcase-inst">Kantor Daerah DPD RI</span>
                                        </div>

                                        {/* Image Container with In-bounds Floating Badges */}
                                        <div className="about-image-wrapper">
                                            <picture>
                                                <source srcSet={regionMapWebP} type="image/webp" />
                                                <img
                                                    src={regionMapJpg}
                                                    alt="Peta Wilayah Kerja Sekretariat Jenderal DPD RI"
                                                    className="img-fluid about-showcase-img"
                                                    loading="lazy"
                                                    decoding="async"
                                                    width="1600"
                                                    height="587"
                                                    onError={(e) => {
                                                        e.target.src = regionMapJpg;
                                                    }}
                                                />
                                            </picture>
                                            <div className="about-image-gradient-veil" aria-hidden="true"></div>

                                            {/* Floating Badge Chip - Top Right */}
                                            <div className="about-float-chip about-float-top-right">
                                                <div className="about-chip-icon-box bg-teal-gradient text-white">
                                                    <i className="fas fa-landmark"></i>
                                                </div>
                                                <div>
                                                    <div className="about-chip-heading">38 Provinsi</div>
                                                    <div className="about-chip-sub">Representasi Parlemen</div>
                                                </div>
                                            </div>

                                            {/* Floating Badge Chip - Bottom Left */}
                                            <div className="about-float-chip about-float-bottom-left">
                                                <div className="about-chip-icon-box bg-amber-gradient text-white">
                                                    <i className="fas fa-award"></i>
                                                </div>
                                                <div>
                                                    <div className="about-chip-heading">BPSDM OKK</div>
                                                    <div className="about-chip-sub">Standar Kompetensi ASN</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Compact Scroll Cue Indicator */}
                        <div className="about-scroll-cue">
                            <button
                                type="button"
                                className="about-scroll-cue-btn"
                                onClick={() => scrollToSection(2)}
                                aria-label="Scroll ke bagian Statistik Platform"
                            >
                                <span className="about-scroll-cue-text">Capaian &amp; Statistik</span>
                                <i className="fas fa-chevron-down about-scroll-chevron"></i>
                            </button>
                        </div>
                    </section>

                    {/* Statistics Section */}
                    <section className="statistics-section snap-section">
                        {/* Background Geometric Grid & Radial Glow Pattern */}
                        <div className="stats-background-pattern" aria-hidden="true"></div>

                        <div className="container position-relative stats-container">
                            <div className="text-center mb-3">
                                <div
                                    className="badge mb-2 about-badge"
                                    style={{
                                        background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                        color: "#ffffff",
                                        padding: "0.35rem 0.85rem",
                                        borderRadius: "50px",
                                        fontSize: "0.82rem",
                                        fontWeight: "600",
                                        boxShadow: "0 2px 8px rgba(13, 148, 136, 0.25)"
                                    }}
                                >
                                    <i className="fas fa-chart-bar me-2"></i>
                                    Statistik Platform
                                </div>

                                <h2 className="display-6 fw-bold mb-1 about-section-heading" style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)" }}>
                                    Pencapaian LMSetjen <span className="about-title-accent">DPD RI</span>
                                </h2>

                                <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
                                    Data terkini mengenai perkembangan dan capaian platform pembelajaran Setjen DPD RI
                                </p>
                            </div>

                            {/* 2x4 layout (2 rows, 4 cards - compact design) */}
                            <div className="row g-3 justify-content-center stats-row">
                                {/* Row 1 - All 4 stats */}
                                <div className="col-lg-3 col-md-6">
                                    {isStatsLoading ? (
                                        <div
                                            className="card border-0 h-100 text-center"
                                            style={{
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                padding: "1.5rem"
                                            }}
                                        >
                                            <div className="placeholder rounded-circle mx-auto mb-3" style={{ width: "50px", height: "50px", background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                                            <div className="placeholder rounded mx-auto mb-2" style={{ width: "60%", height: "24px", background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                                            <div className="placeholder rounded mx-auto" style={{ width: "70%", height: "14px", background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
                                        </div>
                                    ) : (
                                        <div
                                            className="card border-0 h-100 text-center"
                                            style={{
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                transition: "all 0.3s ease"
                                            }}
                                        >
                                            <div className="card-body p-3">
                                                <div
                                                    className="d-inline-flex align-items-center justify-content-center mb-2"
                                                    style={{
                                                        width: "50px",
                                                        height: "50px",
                                                        background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                                        borderRadius: "12px",
                                                        color: "white",
                                                        fontSize: "1.3rem"
                                                    }}
                                                >
                                                    <i className="fas fa-book-open"></i>
                                                </div>
                                                <h4 className="fw-bold mb-1" style={{ fontSize: "1.5rem", color: "#2c3e50" }}>{stats.total_courses}+</h4>
                                                <p className="text-muted mb-1" style={{ fontSize: "0.85rem" }}>Kursus Tersedia</p>
                                                <small className="text-success" style={{ fontSize: "0.75rem" }}>
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
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                padding: "1.5rem"
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "50px",
                                                    height: "50px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "12px",
                                                    margin: "0 auto 1rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "80px",
                                                    height: "24px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto 0.5rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "100px",
                                                    height: "16px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto"
                                                }}
                                            ></div>
                                        </div>
                                    ) : (
                                        <div
                                            className="card border-0 h-100 text-center"
                                            style={{
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                transition: "all 0.3s ease"
                                            }}
                                        >
                                            <div className="card-body p-3">
                                                <div
                                                    className="d-inline-flex align-items-center justify-content-center mb-2"
                                                    style={{
                                                        width: "50px",
                                                        height: "50px",
                                                        background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
                                                        borderRadius: "12px",
                                                        color: "white",
                                                        fontSize: "1.3rem"
                                                    }}
                                                >
                                                    <i className="fas fa-users"></i>
                                                </div>
                                                <h4 className="fw-bold mb-1" style={{ fontSize: "1.5rem", color: "#2c3e50" }}>{stats.total_students}+</h4>
                                                <p className="text-muted mb-1" style={{ fontSize: "0.85rem" }}>Peserta Aktif</p>
                                                <small className="text-success" style={{ fontSize: "0.75rem" }}>
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
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                padding: "1.5rem"
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "50px",
                                                    height: "50px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "12px",
                                                    margin: "0 auto 1rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "80px",
                                                    height: "24px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto 0.5rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "100px",
                                                    height: "16px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto"
                                                }}
                                            ></div>
                                        </div>
                                    ) : (
                                        <div
                                            className="card border-0 h-100 text-center"
                                            style={{
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                transition: "all 0.3s ease"
                                            }}
                                        >
                                            <div className="card-body p-3">
                                                <div
                                                    className="d-inline-flex align-items-center justify-content-center mb-2"
                                                    style={{
                                                        width: "50px",
                                                        height: "50px",
                                                        background: "linear-gradient(135deg, #ffc107 0%, #ff8800 100%)",
                                                        borderRadius: "12px",
                                                        color: "white",
                                                        fontSize: "1.3rem"
                                                    }}
                                                >
                                                    <i className="fas fa-chalkboard-teacher"></i>
                                                </div>
                                                <h4 className="fw-bold mb-1" style={{ fontSize: "1.5rem", color: "#2c3e50" }}>{stats.total_teachers}+</h4>
                                                <p className="text-muted mb-1" style={{ fontSize: "0.85rem" }}>Instruktur Ahli</p>
                                                <small className="text-success" style={{ fontSize: "0.75rem" }}>
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
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                padding: "1.5rem"
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "50px",
                                                    height: "50px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "12px",
                                                    margin: "0 auto 1rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "80px",
                                                    height: "24px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto 0.5rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "100px",
                                                    height: "16px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto"
                                                }}
                                            ></div>
                                        </div>
                                    ) : (
                                        <div
                                            className="card border-0 h-100 text-center"
                                            style={{
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                transition: "all 0.3s ease"
                                            }}
                                        >
                                            <div className="card-body p-3">
                                                <div
                                                    className="d-inline-flex align-items-center justify-content-center mb-2"
                                                    style={{
                                                        width: "50px",
                                                        height: "50px",
                                                        background: "linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)",
                                                        borderRadius: "12px",
                                                        color: "white",
                                                        fontSize: "1.3rem"
                                                    }}
                                                >
                                                    <i className="fas fa-chart-line"></i>
                                                </div>
                                                <h4 className="fw-bold mb-1" style={{ fontSize: "1.5rem", color: "#2c3e50" }}>{stats.completion_rate}%</h4>
                                                <p className="text-muted mb-1" style={{ fontSize: "0.85rem" }}>Tingkat Kelulusan</p>
                                                <small className="text-success" style={{ fontSize: "0.75rem" }}>
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
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                padding: "1.5rem"
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "50px",
                                                    height: "50px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "12px",
                                                    margin: "0 auto 1rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "80px",
                                                    height: "24px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto 0.5rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "100px",
                                                    height: "16px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto"
                                                }}
                                            ></div>
                                        </div>
                                    ) : (
                                        <div
                                            className="card border-0 h-100 text-center"
                                            style={{
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                transition: "all 0.3s ease"
                                            }}
                                        >
                                            <div className="card-body p-3">
                                                <div
                                                    className="d-inline-flex align-items-center justify-content-center mb-2"
                                                    style={{
                                                        width: "50px",
                                                        height: "50px",
                                                        background: "linear-gradient(135deg, #17a2b8 0%, #138496 100%)",
                                                        borderRadius: "12px",
                                                        color: "white",
                                                        fontSize: "1.3rem"
                                                    }}
                                                >
                                                    <i className="fas fa-certificate"></i>
                                                </div>
                                                <h4 className="fw-bold mb-1" style={{ fontSize: "1.5rem", color: "#2c3e50" }}>{stats.total_certificates}+</h4>
                                                <p className="text-muted mb-1" style={{ fontSize: "0.85rem" }}>Sertifikat Diterbitkan</p>
                                                <small className="text-success" style={{ fontSize: "0.75rem" }}>
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
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                padding: "1.5rem"
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "50px",
                                                    height: "50px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "12px",
                                                    margin: "0 auto 1rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "80px",
                                                    height: "24px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto 0.5rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "100px",
                                                    height: "16px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto"
                                                }}
                                            ></div>
                                        </div>
                                    ) : (
                                        <div
                                            className="card border-0 h-100 text-center"
                                            style={{
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                transition: "all 0.3s ease"
                                            }}
                                        >
                                            <div className="card-body p-3">
                                                <div
                                                    className="d-inline-flex align-items-center justify-content-center mb-2"
                                                    style={{
                                                        width: "50px",
                                                        height: "50px",
                                                        background: "linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%)",
                                                        borderRadius: "12px",
                                                        color: "white",
                                                        fontSize: "1.3rem"
                                                    }}
                                                >
                                                    <i className="fas fa-clock"></i>
                                                </div>
                                                <h4 className="fw-bold mb-1" style={{ fontSize: "1.5rem", color: "#2c3e50" }}>24/7</h4>
                                                <p className="text-muted mb-1" style={{ fontSize: "0.85rem" }}>Akses Kapan Saja</p>
                                                <small className="text-success" style={{ fontSize: "0.75rem" }}>
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
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                padding: "1.5rem"
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "50px",
                                                    height: "50px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "12px",
                                                    margin: "0 auto 1rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "80px",
                                                    height: "24px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto 0.5rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "100px",
                                                    height: "16px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto"
                                                }}
                                            ></div>
                                        </div>
                                    ) : (
                                        <div
                                            className="card border-0 h-100 text-center"
                                            style={{
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                transition: "all 0.3s ease"
                                            }}
                                        >
                                            <div className="card-body p-3">
                                                <div
                                                    className="d-inline-flex align-items-center justify-content-center mb-2"
                                                    style={{
                                                        width: "50px",
                                                        height: "50px",
                                                        background: "linear-gradient(135deg, #fd7e14 0%, #dc3545 100%)",
                                                        borderRadius: "12px",
                                                        color: "white",
                                                        fontSize: "1.3rem"
                                                    }}
                                                >
                                                    <i className="fas fa-video"></i>
                                                </div>
                                                <h4 className="fw-bold mb-1" style={{ fontSize: "1.5rem", color: "#2c3e50" }}>{stats.total_materials}+</h4>
                                                <p className="text-muted mb-1" style={{ fontSize: "0.85rem" }}>Video Pembelajaran</p>
                                                <small className="text-success" style={{ fontSize: "0.75rem" }}>
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
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                padding: "1.5rem"
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "50px",
                                                    height: "50px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "12px",
                                                    margin: "0 auto 1rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "80px",
                                                    height: "24px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto 0.5rem"
                                                }}
                                            ></div>
                                            <div
                                                style={{
                                                    width: "100px",
                                                    height: "16px",
                                                    background: "linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)",
                                                    backgroundSize: "200% 100%",
                                                    animation: "shimmer 1.5s infinite",
                                                    borderRadius: "4px",
                                                    margin: "0 auto"
                                                }}
                                            ></div>
                                        </div>
                                    ) : (
                                        <div
                                            className="card border-0 h-100 text-center"
                                            style={{
                                                borderRadius: "16px",
                                                background: "white",
                                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                transition: "all 0.3s ease"
                                            }}
                                        >
                                            <div className="card-body p-3">
                                                <div
                                                    className="d-inline-flex align-items-center justify-content-center mb-2"
                                                    style={{
                                                        width: "50px",
                                                        height: "50px",
                                                        background: "linear-gradient(135deg, #20c997 0%, #28a745 100%)",
                                                        borderRadius: "12px",
                                                        color: "white",
                                                        fontSize: "1.3rem"
                                                    }}
                                                >
                                                    <i className="fas fa-star"></i>
                                                </div>
                                                <h4 className="fw-bold mb-1" style={{ fontSize: "1.5rem", color: "#2c3e50" }}>{stats.platform_rating}/5</h4>
                                                <p className="text-muted mb-1" style={{ fontSize: "0.85rem" }}>Rating Platform</p>
                                                <small className="text-success" style={{ fontSize: "0.75rem" }}>
                                                    <i className="fas fa-thumbs-up me-1"></i>
                                                    Sangat memuaskan
                                                </small>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Compact Scroll Cue Indicator */}
                        <div className="stats-scroll-cue">
                            <button
                                type="button"
                                className="stats-scroll-cue-btn"
                                onClick={() => scrollToSection(3)}
                                aria-label="Scroll ke bagian Kategori Kursus"
                            >
                                <span className="stats-scroll-cue-text">Kategori Kursus</span>
                                <i className="fas fa-chevron-down stats-scroll-chevron"></i>
                            </button>
                        </div>
                    </section>

                    {/* Course Categories Section */}
                    <section className="categories-section snap-section">
                        {/* Background Geometric Grid & Radial Glow Pattern */}
                        <div className="categories-background-pattern" aria-hidden="true"></div>

                        <div className="container position-relative categories-container">
                            <div className="text-center mb-3">
                                <div
                                    className="badge mb-2"
                                    style={{
                                        background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                        color: "white",
                                        padding: "0.35rem 0.85rem",
                                        borderRadius: "50px",
                                        fontSize: "0.82rem",
                                        fontWeight: "600"
                                    }}
                                >
                                    <i className="fas fa-th-large me-2"></i>
                                    Kategori Kursus
                                </div>

                                <h2 className="display-6 fw-bold mb-1" style={{ color: "#2c3e50", fontSize: "clamp(1.5rem, 2.5vw, 2rem)" }}>
                                    Jelajahi Berdasarkan <span className="about-title-accent">Kategori</span>
                                </h2>

                                <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
                                    Temukan kursus yang sesuai dengan minat dan kebutuhan pengembangan karir Anda
                                </p>
                            </div>

                            {/* 2x4 layout (2 rows, 4 cards each - compact) */}
                            <div className="row g-3 justify-content-center categories-row">
                                {isLoading ? (
                                    // Loading skeleton - 8 cards with placeholder content
                                    [...Array(8)].map((_, index) => (
                                        <div key={index} className="col-lg-3 col-md-6">
                                            <div
                                                className="card border-0"
                                                style={{
                                                    borderRadius: "16px",
                                                    background: "white",
                                                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                    height: "160px",
                                                    overflow: "hidden"
                                                }}
                                            >
                                                <div className="card-body p-3 text-center d-flex flex-column justify-content-center">
                                                    <div
                                                        className="placeholder rounded-circle mx-auto mb-2"
                                                        style={{
                                                            width: "50px",
                                                            height: "50px",
                                                            background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
                                                            backgroundSize: "200% 100%",
                                                            animation: "shimmer 1.5s infinite"
                                                        }}
                                                    />
                                                    <div
                                                        className="placeholder rounded mx-auto mb-2"
                                                        style={{
                                                            width: "70%",
                                                            height: "16px",
                                                            background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
                                                            backgroundSize: "200% 100%",
                                                            animation: "shimmer 1.5s infinite"
                                                        }}
                                                    />
                                                    <div
                                                        className="placeholder rounded mx-auto"
                                                        style={{
                                                            width: "50%",
                                                            height: "12px",
                                                            background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
                                                            backgroundSize: "200% 100%",
                                                            animation: "shimmer 1.5s infinite"
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
                                                        borderRadius: "16px",
                                                        background: "white",
                                                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                        transition: "all 0.3s ease",
                                                        cursor: "pointer"
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform = "translateY(-5px)";
                                                        e.currentTarget.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.12)";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform = "translateY(0)";
                                                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.06)";
                                                    }}
                                                >
                                                    <div className="card-body p-3 text-center">
                                                        <div
                                                            className="category-icon mx-auto mb-2"
                                                            style={{
                                                                width: "50px",
                                                                height: "50px",
                                                                background: `linear-gradient(135deg, ${["#0d9488, #0f766e", "#28a745, #20c997", "#ffc107, #ff8800", "#dc3545, #e83e8c", "#17a2b8, #138496", "#6f42c1, #e83e8c", "#fd7e14, #dc3545", "#20c997, #28a745"][index % 8]
                                                                    })`,
                                                                borderRadius: "12px",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                color: "white",
                                                                fontSize: "1.5rem"
                                                            }}
                                                        >
                                                            <i
                                                                className={`fas ${["fa-globe", "fa-chart-line", "fa-paint-brush", "fa-code", "fa-database", "fa-tools", "fa-brain", "fa-graduation-cap"][index % 8]
                                                                    }`}
                                                                style={{
                                                                    fontSize: "1.3rem"
                                                                }}
                                                            ></i>
                                                        </div>

                                                        <h3 className="fw-bold mb-1" style={{ color: "#2c3e50", fontSize: "0.95rem" }}>
                                                            {category.title}
                                                        </h3>

                                                        <p className="text-muted mb-2" style={{ fontSize: "0.8rem" }}>
                                                            {category.course_count} kursus
                                                        </p>

                                                        <div
                                                            className="btn btn-sm"
                                                            style={{
                                                                background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                                                color: "white",
                                                                border: "none",
                                                                borderRadius: "8px",
                                                                fontWeight: "500",
                                                                fontSize: "0.75rem",
                                                                padding: "0.5rem 1rem",
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                height: "auto",
                                                                cursor: "pointer",
                                                                transition: "all 0.3s ease"
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
                                <div className="text-center mt-3">
                                    <Link
                                        to="/search/"
                                        className="btn btn-sm px-4 py-2"
                                        style={{
                                            background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "12px",
                                            fontWeight: "600",
                                            fontSize: "0.85rem",
                                            boxShadow: "0 4px 12px rgba(13, 148, 136, 0.25)"
                                        }}
                                    >
                                        <i className="fas fa-grid-2 me-2"></i>
                                        Lihat Semua Kategori
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Compact Scroll Cue Indicator */}
                        <div className="categories-scroll-cue">
                            <button
                                type="button"
                                className="categories-scroll-cue-btn"
                                onClick={() => scrollToSection(4)}
                                aria-label="Scroll ke bagian Kursus Populer"
                            >
                                <span className="categories-scroll-cue-text">Kursus Terfavorit</span>
                                <i className="fas fa-chevron-down categories-scroll-chevron"></i>
                            </button>
                        </div>
                    </section>

                    {/* Featured Courses Section */}
                    <section id="courses-section" className="courses-section snap-section">
                        {/* Background Geometric Grid & Radial Glow Pattern */}
                        <div className="courses-background-pattern" aria-hidden="true"></div>

                        <div className="container position-relative courses-container">
                            <div className="text-center mb-3">
                                <div
                                    className="badge mb-2"
                                    style={{
                                        background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                        color: "white",
                                        padding: "0.35rem 0.85rem",
                                        borderRadius: "50px",
                                        fontSize: "0.82rem",
                                        fontWeight: "600"
                                    }}
                                >
                                    <i className="fas fa-star me-2"></i>
                                    Kursus Populer
                                </div>

                                <h2 className="display-6 fw-bold mb-1" style={{ color: "#2c3e50", fontSize: "clamp(1.5rem, 2.5vw, 2rem)" }}>
                                    Kursus <span className="about-title-accent">Terfavorit</span>
                                </h2>

                                <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
                                    Kursus paling diminati dan memiliki rating tertinggi dari peserta
                                </p>
                            </div>

                            {/* 3x1 layout (1 row, 3 cards - compact) */}
                            <div className="row g-3 justify-content-center courses-row">
                                {isLoading ? (
                                    // Loading skeleton - 3 course cards with placeholder content
                                    [...Array(3)].map((_, index) => (
                                        <div key={index} className="col-lg-4 col-md-6">
                                            <div
                                                className="card border-0"
                                                style={{
                                                    borderRadius: "16px",
                                                    background: "white",
                                                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                    height: "380px",
                                                    overflow: "hidden"
                                                }}
                                            >
                                                <div
                                                    className="placeholder"
                                                    style={{
                                                        height: "180px",
                                                        background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
                                                        backgroundSize: "200% 100%",
                                                        animation: "shimmer 1.5s infinite"
                                                    }}
                                                />
                                                <div className="card-body p-3">
                                                    <div
                                                        className="placeholder rounded mb-2"
                                                        style={{
                                                            width: "60%",
                                                            height: "12px",
                                                            background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
                                                            backgroundSize: "200% 100%",
                                                            animation: "shimmer 1.5s infinite"
                                                        }}
                                                    />
                                                    <div
                                                        className="placeholder rounded mb-2"
                                                        style={{
                                                            width: "90%",
                                                            height: "18px",
                                                            background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
                                                            backgroundSize: "200% 100%",
                                                            animation: "shimmer 1.5s infinite"
                                                        }}
                                                    />
                                                    <div
                                                        className="placeholder rounded mb-3"
                                                        style={{
                                                            width: "70%",
                                                            height: "18px",
                                                            background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
                                                            backgroundSize: "200% 100%",
                                                            animation: "shimmer 1.5s infinite"
                                                        }}
                                                    />
                                                    <div className="d-flex justify-content-between mb-2">
                                                        <div
                                                            className="placeholder rounded"
                                                            style={{
                                                                width: "45%",
                                                                height: "14px",
                                                                background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
                                                                backgroundSize: "200% 100%",
                                                                animation: "shimmer 1.5s infinite"
                                                            }}
                                                        />
                                                        <div
                                                            className="placeholder rounded"
                                                            style={{
                                                                width: "45%",
                                                                height: "14px",
                                                                background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
                                                                backgroundSize: "200% 100%",
                                                                animation: "shimmer 1.5s infinite"
                                                            }}
                                                        />
                                                    </div>
                                                    <div
                                                        className="placeholder rounded"
                                                        style={{
                                                            width: "100%",
                                                            height: "40px",
                                                            background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
                                                            backgroundSize: "200% 100%",
                                                            animation: "shimmer 1.5s infinite"
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
                                                    borderRadius: "16px",
                                                    background: "white",
                                                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                                                    transition: "all 0.3s ease",
                                                    overflow: "hidden",
                                                    position: "relative"
                                                }}
                                            >
                                                {/* Gradient Overlay on Hover */}
                                                <div
                                                    className="card-gradient-overlay"
                                                    style={{
                                                        position: "absolute",
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        bottom: 0,
                                                        background: "linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)",
                                                        opacity: 0,
                                                        transition: "opacity 0.3s ease",
                                                        pointerEvents: "none",
                                                        zIndex: 1
                                                    }}
                                                />

                                                {/* Course Image */}
                                                <div className="position-relative" style={{ overflow: "hidden" }}>
                                                    <img
                                                        src={getImageUrl(course.image) || "/images/placeholders/default-course.svg"}
                                                        alt={course.title}
                                                        className="card-img-top course-card-image"
                                                        loading="lazy"
                                                        decoding="async"
                                                        width="400"
                                                        height="180"
                                                        style={{
                                                            height: "180px",
                                                            objectFit: "cover",
                                                            transition: "transform 0.3s ease"
                                                        }}
                                                        onError={(e) => {
                                                            e.target.src = "/images/placeholders/default-course.svg";
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
                                                                top: "10px",
                                                                right: "10px",
                                                                width: "36px",
                                                                height: "36px",
                                                                borderRadius: "50%",
                                                                background: "rgba(255, 255, 255, 0.95)",
                                                                backdropFilter: "blur(10px)",
                                                                border: "none",
                                                                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                transition: "all 0.3s ease",
                                                                zIndex: 2
                                                            }}
                                                        >
                                                            <i
                                                                className={`${isCourseInWishlist(course.id) ? "fas" : "far"} fa-heart`}
                                                                style={{
                                                                    color: isCourseInWishlist(course.id) ? "#dc3545" : "#6c757d",
                                                                    fontSize: "0.95rem"
                                                                }}
                                                            />
                                                        </button>
                                                    )}

                                                    {/* Level Badge - Positioned at top-left inside card image */}
                                                    <div
                                                        className="position-absolute"
                                                        style={{
                                                            top: "10px",
                                                            left: "10px",
                                                            zIndex: 2
                                                        }}
                                                    >
                                                        <span
                                                            className="badge"
                                                            style={{
                                                                background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                                                color: "white",
                                                                padding: "0.35rem 0.75rem",
                                                                borderRadius: "8px",
                                                                fontSize: "0.7rem",
                                                                fontWeight: "600",
                                                                boxShadow: "0 2px 8px rgba(102, 126, 234, 0.3)"
                                                            }}
                                                        >
                                                            {getLevelText(course.level)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Card Body */}
                                                <div className="card-body p-3" style={{ position: "relative", zIndex: 2 }}>
                                                    {/* Category */}
                                                    <div className="mb-2">
                                                        <span
                                                            className="badge"
                                                            style={{
                                                                background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
                                                                color: "#0d9488",
                                                                border: "1px solid rgba(102, 126, 234, 0.2)",
                                                                borderRadius: "8px",
                                                                fontSize: "0.65rem",
                                                                fontWeight: "600",
                                                                padding: "0.3rem 0.6rem"
                                                            }}
                                                        >
                                                            <i className="fas fa-folder me-1"></i>
                                                            {course.category?.title || "General"}
                                                        </span>
                                                    </div>

                                                    {/* Course Title */}
                                                    <h3 className="fw-bold mb-2" style={{ minHeight: "42px", fontSize: "0.95rem" }}>
                                                        <Link
                                                            to={`/course-detail/${course.slug}/`}
                                                            className="text-decoration-none course-title-link"
                                                            style={{
                                                                color: "#2c3e50",
                                                                display: "-webkit-box",
                                                                WebkitLineClamp: "2",
                                                                WebkitBoxOrient: "vertical",
                                                                overflow: "hidden",
                                                                lineHeight: "1.4",
                                                                transition: "color 0.3s ease"
                                                            }}
                                                        >
                                                            {course.title}
                                                        </Link>
                                                    </h3>

                                                    {/* Instructor */}
                                                    <div className="mb-2 d-flex align-items-center">
                                                        <img
                                                            src={getImageUrl(course.teacher?.image) || `https://ui-avatars.com/api/?name=${encodeURIComponent(course.teacher?.full_name || "Instruktur")}&background=0d9488&color=ffffff&bold=true&size=28`}
                                                            alt={course.teacher?.full_name || "Instruktur"}
                                                            loading="lazy"
                                                            decoding="async"
                                                            width="28"
                                                            height="28"
                                                            style={{
                                                                width: "28px",
                                                                height: "28px",
                                                                borderRadius: "50%",
                                                                marginRight: "8px",
                                                                objectFit: "cover",
                                                                border: "1px solid rgba(255, 255, 255, 0.3)"
                                                            }}
                                                            onError={(e) => {
                                                                e.target.src = "/images/placeholders/default-instructor.svg";
                                                            }}
                                                        />
                                                        <small className="text-muted" style={{ fontSize: "0.8rem", fontWeight: "500" }}>
                                                            {course.teacher?.full_name || "Instruktur"}
                                                        </small>
                                                    </div>

                                                    {/* Rating & Stats */}
                                                    <div
                                                        className="d-flex align-items-center justify-content-between mb-2 p-2"
                                                        style={{
                                                            background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
                                                            borderRadius: "8px"
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
                                                            <span className="text-warning fw-bold ms-1" style={{ fontSize: "0.8rem" }}>
                                                                {course.average_rating || 0}
                                                            </span>
                                                        </div>
                                                        <small className="text-muted" style={{ fontSize: "0.7rem" }}>
                                                            ({course.reviews?.length || 0})
                                                        </small>
                                                    </div>

                                                    {/* Students Count */}
                                                    <div
                                                        className="d-flex align-items-center justify-content-between p-2 mb-2"
                                                        style={{
                                                            background: "rgba(40, 167, 69, 0.05)",
                                                            borderRadius: "8px",
                                                            border: "1px solid rgba(40, 167, 69, 0.1)"
                                                        }}
                                                    >
                                                        <small className="fw-medium" style={{ fontSize: "0.8rem", color: "#146c43" }}>
                                                            <i className="fas fa-users me-1"></i>
                                                            {course.students?.length || 0} siswa
                                                        </small>
                                                        <small className="text-muted" style={{ fontSize: "0.7rem" }}>
                                                            <i className="fas fa-book-open me-1"></i>
                                                            Aktif
                                                        </small>
                                                    </div>

                                                    {/* Total Duration in JP (Jam Pelajaran) - ✨ PHASE 4.77+ */}
                                                    <div
                                                        className="d-flex align-items-center justify-content-center p-2 mb-2"
                                                        style={{
                                                            background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
                                                            borderRadius: "8px",
                                                            border: "1px solid rgba(102, 126, 234, 0.2)"
                                                        }}
                                                    >
                                                        <small className="fw-medium" style={{ fontSize: "0.8rem", color: "#0d9488" }}>
                                                            <i className="fas fa-clock me-1"></i>
                                                            Total: <strong>{calculateTotalJP(course.lectures)}</strong> JP (Jam Pelajaran)
                                                        </small>
                                                    </div>
                                                </div>

                                                {/* Card Footer */}
                                                <div className="card-footer bg-transparent border-0 p-3 pt-0" style={{ position: "relative", zIndex: 2 }}>
                                                    <Link
                                                        to={`/course-detail/${course.slug}/`}
                                                        className="btn w-100 fw-semibold course-detail-btn"
                                                        style={{
                                                            background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                                            border: "none",
                                                            borderRadius: "10px",
                                                            color: "white",
                                                            transition: "all 0.3s ease",
                                                            padding: "0.6rem 1rem",
                                                            fontSize: "0.85rem",
                                                            boxShadow: "0 2px 8px rgba(102, 126, 234, 0.3)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center"
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
                                <div className="text-center mt-3">
                                    <Link
                                        to="/search/"
                                        className="btn btn-sm px-4 py-2"
                                        style={{
                                            background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "12px",
                                            fontWeight: "600",
                                            fontSize: "0.85rem",
                                            boxShadow: "0 4px 12px rgba(13, 148, 136, 0.25)"
                                        }}
                                    >
                                        <i className="fas fa-graduation-cap me-2"></i>
                                        Lihat Semua Kursus
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Compact Scroll Cue Indicator */}
                        <div className="courses-scroll-cue">
                            <button
                                type="button"
                                className="courses-scroll-cue-btn"
                                onClick={() => scrollToSection(5)}
                                aria-label="Scroll ke bagian Peringkat Peserta"
                            >
                                <span className="courses-scroll-cue-text">Peringkat &amp; Capaian</span>
                                <i className="fas fa-chevron-down courses-scroll-chevron"></i>
                            </button>
                        </div>
                    </section>

                    {/* CTA Section with Rankings - ✨ PHASE 10.1 */}
                    <section className="cta-section snap-section">
                        {/* Background Geometric Grid & Radial Glow Pattern */}
                        <div className="cta-background-pattern" aria-hidden="true"></div>

                        <div className="container position-relative cta-container">
                            <div className="row align-items-stretch gap-3 gap-lg-0 cta-row">

                                {/* Left Column: Ranked Instructors */}
                                <div className="col-lg-4">
                                    <RankedInstructors maxResults={5} />
                                </div>

                                {/* Right Column: Ranked Students */}
                                <div className="col-lg-4">
                                    <RankedStudents maxResults={5} />
                                </div>

                                {/* Center Column: CTA Content */}
                                <div className="col-lg-4 d-flex flex-column justify-content-center">
                                    <div
                                        className="badge mb-2 d-inline-flex align-items-center align-self-start"
                                        style={{
                                            background: "rgba(255, 255, 255, 0.18)",
                                            backdropFilter: "blur(8px)",
                                            border: "1px solid rgba(255, 255, 255, 0.3)",
                                            color: "white",
                                            padding: "0.35rem 0.85rem",
                                            borderRadius: "50px",
                                            fontSize: "0.82rem",
                                            fontWeight: "600"
                                        }}
                                    >
                                        <i className="fas fa-trophy text-warning me-2"></i>
                                        Peringkat &amp; Prestasi
                                    </div>

                                    <h2 className="display-6 fw-bold mb-2" style={{ color: "white", fontSize: "clamp(1.4rem, 2.2vw, 1.85rem)", lineHeight: 1.25 }}>
                                        Siap Memulai Perjalanan Pembelajaran Anda?
                                    </h2>
                                    <p className="mb-3" style={{ color: "rgba(255, 255, 255, 0.9)", fontSize: "0.88rem", lineHeight: 1.5 }}>
                                        Bergabunglah dengan ribuan pegawai Setjen DPD RI yang telah meningkatkan kompetensi mereka
                                        melalui platform LMSetjen DPD RI. Akses seluruh kursus secara gratis!
                                    </p>
                                    <div className="d-flex flex-wrap gap-2 align-items-center">
                                        <button
                                            onClick={() => document.getElementById("courses-section")?.scrollIntoView({ behavior: "smooth" })}
                                            className="btn px-3 py-2 cta-register-btn"
                                            style={{
                                                background: "white",
                                                color: "#0d9488",
                                                border: "none",
                                                borderRadius: "12px",
                                                fontWeight: "700",
                                                fontSize: "0.88rem",
                                                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.12)",
                                                cursor: "pointer",
                                                pointerEvents: "auto",
                                                position: "relative",
                                                zIndex: 10,
                                                textDecoration: "none",
                                                display: "inline-block",
                                                transition: "all 0.3s ease"
                                            }}
                                        >
                                            <i className="fas fa-search me-2"></i>
                                            Jelajahi Kursus
                                        </button>
                                        <Link
                                            to="/rankings/"
                                            className="btn px-3 py-2"
                                            style={{
                                                background: "rgba(255, 255, 255, 0.18)",
                                                color: "white",
                                                border: "1px solid rgba(255, 255, 255, 0.4)",
                                                borderRadius: "12px",
                                                fontWeight: "600",
                                                fontSize: "0.88rem",
                                                backdropFilter: "blur(10px)",
                                                textDecoration: "none",
                                                display: "inline-block",
                                                transition: "all 0.3s ease"
                                            }}
                                        >
                                            <i className="fas fa-trophy me-2 text-warning"></i>
                                            Semua Peringkat
                                        </Link>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Compact Scroll Cue Indicator */}
                        <div className="cta-scroll-cue">
                            <button
                                type="button"
                                className="cta-scroll-cue-btn"
                                onClick={() => scrollToSection(6)}
                                aria-label="Scroll ke bagian Testimoni Peserta"
                            >
                                <span className="cta-scroll-cue-text">Ulasan &amp; Testimoni</span>
                                <i className="fas fa-chevron-down cta-scroll-chevron"></i>
                            </button>
                        </div>
                    </section>

                    {/* Testimonials Section - Now fetches real testimonials from API */}
                    <TestimonialSection />

                </div>
            </main>
        </>
    );
}

export default Index;