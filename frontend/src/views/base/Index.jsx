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
        total_enrollments: 0,
        completion_rate: 0,
        total_certificates: 0,
        total_materials: 0,
        platform_rating: 4.8,
        total_reviews: 0,
        total_discussions: 0,
        total_categories: 0,
        timestamp: null,
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
                    total_courses: Number(response.data.total_courses) || 0,
                    total_teachers: Number(response.data.total_teachers) || 0,
                    total_students: Number(response.data.total_students) || 0,
                    total_enrollments: Number(response.data.total_enrollments) || 0,
                    completion_rate: Number(response.data.completion_rate) || 0,
                    total_certificates: Number(response.data.total_certificates) || 0,
                    total_materials: Number(response.data.total_materials) || 0,
                    platform_rating: Number(response.data.platform_rating) || 4.8,
                    total_reviews: Number(response.data.total_reviews) || 0,
                    total_discussions: Number(response.data.total_discussions) || 0,
                    total_categories: Number(response.data.total_categories) || 0,
                    timestamp: response.data.timestamp || null,
                };
                setStats(newStats);
            }
        } catch (error) {
            // Set default stats on error
            setStats({
                total_courses: 0,
                total_teachers: 0,
                total_students: 0,
                total_enrollments: 0,
                completion_rate: 0,
                total_certificates: 0,
                total_materials: 0,
                platform_rating: 4.8,
                total_reviews: 0,
                total_discussions: 0,
                total_categories: 0,
                timestamp: null,
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

    // Dynamic Theme Resolver for Course Categories (BPSDM Setjen DPD RI)
    const getCategoryTheme = (title, slug, index) => {
        const t = (title || "").toLowerCase();
        const s = (slug || "").toLowerCase();
        if (t.includes("inovasi") || s.includes("inovasi") || t.includes("digital")) {
            return {
                icon: "fas fa-lightbulb",
                gradient: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                accentColor: "#0d9488",
                glowColor: "rgba(13, 148, 136, 0.25)",
                subtitle: "Transformasi Digital & Inovasi",
                tag: "Prioritas BPSDM",
                tagColor: "teal",
            };
        }
        if (t.includes("individu") || s.includes("arsiparis") || t.includes("kompetensi") || t.includes("sdm")) {
            return {
                icon: "fas fa-user-graduate",
                gradient: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                accentColor: "#6366f1",
                glowColor: "rgba(99, 102, 241, 0.25)",
                subtitle: "Kompetensi ASN & Jabatan Fungsional",
                tag: "Pengembangan Karir",
                tagColor: "indigo",
            };
        }
        if (t.includes("bisnis") || s.includes("bisnis") || t.includes("manajemen") || t.includes("anggaran")) {
            return {
                icon: "fas fa-briefcase",
                gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                accentColor: "#f59e0b",
                glowColor: "rgba(245, 158, 11, 0.25)",
                subtitle: "Tata Kelola & Manajemen Organisasi",
                tag: "Tata Kelola",
                tagColor: "amber",
            };
        }
        const palettes = [
            { icon: "fas fa-landmark", gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)", accentColor: "#06b6d4", glowColor: "rgba(6, 182, 212, 0.25)", subtitle: "Keparlemenan & Regulasi DPD RI", tag: "Parlemen", tagColor: "cyan" },
            { icon: "fas fa-shield-alt", gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)", accentColor: "#10b981", glowColor: "rgba(16, 185, 129, 0.25)", subtitle: "Integritas & Akuntabilitas ASN", tag: "Integritas", tagColor: "emerald" },
            { icon: "fas fa-chart-line", gradient: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)", accentColor: "#ec4899", glowColor: "rgba(236, 72, 153, 0.25)", subtitle: "Analisis Kebijakan Daerah", tag: "Analisis", tagColor: "pink" },
        ];
        return palettes[index % palettes.length];
    };

    // Live Real-Time Platform Stat Cards Configuration (Setjen DPD RI)
    const statCards = [
        {
            id: "courses",
            label: "Kursus Kompetensi",
            value: stats.total_courses,
            unit: "",
            pill: `${stats.total_categories || 3} Kategori`,
            pillIcon: "fas fa-layer-group",
            pillColor: "primary",
            subtext: "Kurikulum Aktif BPSDM",
            icon: "fas fa-book-open",
            gradient: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
            glowColor: "rgba(13, 148, 136, 0.25)",
            accentColor: "#0d9488",
        },
        {
            id: "students",
            label: "Peserta Terdaftar",
            value: stats.total_students,
            unit: "",
            pill: `${stats.total_enrollments || stats.total_students} Enrolmen`,
            pillIcon: "fas fa-user-check",
            pillColor: "success",
            subtext: "Pegawai & Staf Terverifikasi",
            icon: "fas fa-users",
            gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            glowColor: "rgba(16, 185, 129, 0.25)",
            accentColor: "#10b981",
        },
        {
            id: "teachers",
            label: "Widyaiswara & Instruktur",
            value: stats.total_teachers,
            unit: "",
            pill: "Biro OKK DPD RI",
            pillIcon: "fas fa-award",
            pillColor: "warning",
            subtext: "Instruktur & Tenaga Ahli",
            icon: "fas fa-chalkboard-teacher",
            gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            glowColor: "rgba(245, 158, 11, 0.25)",
            accentColor: "#f59e0b",
        },
        {
            id: "completion",
            label: "Tingkat Kelulusan",
            value: `${stats.completion_rate}%`,
            unit: "",
            pill: "Progres Belajar",
            pillIcon: "fas fa-chart-line",
            pillColor: "danger",
            subtext: "Rata-rata Penyelesaian",
            icon: "fas fa-graduation-cap",
            gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            glowColor: "rgba(239, 68, 68, 0.25)",
            accentColor: "#ef4444",
        },
        {
            id: "certificates",
            label: "Sertifikat Diterbitkan",
            value: stats.total_certificates,
            unit: "",
            pill: "Resmi DPD RI",
            pillIcon: "fas fa-shield-alt",
            pillColor: "info",
            subtext: "E-Sertifikat Terverifikasi",
            icon: "fas fa-certificate",
            gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
            glowColor: "rgba(6, 182, 212, 0.25)",
            accentColor: "#06b6d4",
        },
        {
            id: "materials",
            label: "Materi Pembelajaran",
            value: stats.total_materials,
            unit: "",
            pill: "Bahan Tayang",
            pillIcon: "fas fa-play-circle",
            pillColor: "purple",
            subtext: "Video & Modul Ajar Terbit",
            icon: "fas fa-file-video",
            gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
            glowColor: "rgba(139, 92, 246, 0.25)",
            accentColor: "#8b5cf6",
        },
        {
            id: "discussions",
            label: "Forum & Konsultasi",
            value: stats.total_discussions,
            unit: "",
            pill: "Interaktif",
            pillIcon: "fas fa-comments",
            pillColor: "orange",
            subtext: "Tanya Jawab & Diskusi Aktif",
            icon: "fas fa-comments",
            gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
            glowColor: "rgba(249, 115, 22, 0.25)",
            accentColor: "#f97316",
        },
        {
            id: "rating",
            label: "Indeks Kepuasan",
            value: stats.platform_rating,
            unit: "/ 5.0",
            pill: `${stats.total_reviews} Ulasan`,
            pillIcon: "fas fa-star",
            pillColor: "teal",
            subtext: "Evaluasi Mutu Platform",
            icon: "fas fa-star-half-alt",
            gradient: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
            glowColor: "rgba(20, 184, 166, 0.25)",
            accentColor: "#14b8a6",
        },
    ];

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
                                            <span className="hero-badge-sub">E-Learning Biro OKK</span>
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

                                <h2 className="display-6 fw-bold mb-1 about-section-heading" style={{ fontSize: "clamp(1rem, 2vw, 2rem)" }}>
                                    Pencapaian LMSetjen <span className="about-title-accent">DPD RI</span>
                                </h2>

                                <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
                                    Data terkini mengenai perkembangan dan capaian platform pembelajaran Setjen DPD RI
                                </p>
                            </div>

                            {/* Live Real-Time Synchronized Platform Toolbar */}
                            <div className="stats-live-toolbar d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="stats-live-radar-dot"></span>
                                    <span className="stats-live-title">Sinkronisasi Database Real-Time</span>
                                    <span className="stats-live-badge">BPSDM Setjen DPD RI</span>
                                </div>
                                <div className="d-flex align-items-center gap-3 stats-live-meta">
                                    <span className="stats-live-meta-item d-none d-md-flex">
                                        <i className="fas fa-shield-alt text-teal me-1"></i> Data Terverifikasi
                                    </span>
                                    <span className="stats-live-meta-item d-none d-sm-flex">
                                        <i className="fas fa-server text-teal me-1"></i> Sistem Aktif
                                    </span>
                                    <button
                                        type="button"
                                        className="btn stats-live-refresh-btn"
                                        onClick={fetchStatistics}
                                        title="Perbarui data statistik langsung dari server"
                                        disabled={isStatsLoading}
                                    >
                                        <i className={`fas fa-sync-alt me-1 ${isStatsLoading ? "fa-spin" : ""}`}></i>
                                        <span>{isStatsLoading ? "Memperbarui..." : "Sinkronkan"}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Compact Executive Metric Cards Grid (2x4 responsive) */}
                            <div className="row g-2 g-md-3 justify-content-center stats-row">
                                {statCards.map((card) => (
                                    <div key={card.id} className="col-xl-3 col-lg-3 col-md-6 col-sm-6 stats-card-col">
                                        {isStatsLoading ? (
                                            <div className="stats-metric-card stats-metric-loading">
                                                <div className="stats-shimmer-icon"></div>
                                                <div className="stats-shimmer-content">
                                                    <div className="stats-shimmer-bar stats-shimmer-bar-sm"></div>
                                                    <div className="stats-shimmer-bar stats-shimmer-bar-lg"></div>
                                                    <div className="stats-shimmer-bar stats-shimmer-bar-md"></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div
                                                className="stats-metric-card"
                                                style={{
                                                    "--card-accent": card.accentColor,
                                                    "--card-glow": card.glowColor,
                                                }}
                                            >
                                                <div className="stats-card-accent-line"></div>
                                                <div className="stats-card-inner">
                                                    {/* Left: Icon Squircle */}
                                                    <div
                                                        className="stats-metric-icon-box"
                                                        style={{
                                                            background: card.gradient,
                                                            boxShadow: `0 4px 14px ${card.glowColor}`,
                                                        }}
                                                    >
                                                        <i className={card.icon}></i>
                                                    </div>

                                                    {/* Right: Body */}
                                                    <div className="stats-metric-body">
                                                        <div className="stats-metric-header">
                                                            <span className="stats-metric-label">{card.label}</span>
                                                            <span className={`stats-metric-pill stats-pill-${card.pillColor}`}>
                                                                <i className={`${card.pillIcon} me-1`}></i>
                                                                {card.pill}
                                                            </span>
                                                        </div>

                                                        <div className="stats-metric-value-wrap">
                                                            <span className="stats-metric-value">{card.value}</span>
                                                            {card.unit && <span className="stats-metric-unit">{card.unit}</span>}
                                                        </div>

                                                        <div className="stats-metric-subtext">
                                                            <i className="fas fa-check-circle text-success me-1 stats-subtext-icon"></i>
                                                            <span>{card.subtext}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

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

                                <h2 className="display-6 fw-bold mb-1" style={{ color: "#2c3e50", fontSize: "clamp(1rem, 2vw, 2rem)" }}>
                                    Jelajahi Berdasarkan <span className="about-title-accent">Kategori</span>
                                </h2>

                                <p className="text-muted mb-0" style={{ fontSize: "0.9rem" }}>
                                    Temukan kursus yang sesuai dengan minat dan kebutuhan pengembangan karir Anda
                                </p>
                            </div>

                            {/* Live Category Summary & Filter Toolbar */}
                            <div className="categories-live-toolbar d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="cat-live-radar-dot"></span>
                                    <span className="cat-live-title">Klaster Bidang Keahlian Biro OKK</span>
                                    <span className="cat-live-badge">{categories.length} Bidang Kompetensi</span>
                                </div>
                                <div className="d-flex align-items-center gap-3 cat-live-meta">
                                    <span className="cat-live-meta-item d-none d-md-flex">
                                        <i className="fas fa-check-circle text-teal me-1"></i> Terbuka untuk Pegawai DPD RI
                                    </span>
                                    <Link to="/search/" className="cat-toolbar-all-btn">
                                        <i className="fas fa-compass me-1"></i> Semua Silabus
                                    </Link>
                                </div>
                            </div>

                            {/* Compact Executive Category Cards Grid */}
                            <div className="row g-2 g-md-3 justify-content-center categories-row">
                                {isLoading ? (
                                    [...Array(categories.length > 0 ? categories.length : 3)].map((_, index) => (
                                        <div key={index} className="col-lg-4 col-md-6 col-12 category-col">
                                            <div className="category-compact-card category-loading">
                                                <div className="cat-shimmer-top d-flex align-items-center justify-content-between mb-2">
                                                    <div className="cat-shimmer-icon"></div>
                                                    <div className="cat-shimmer-pill"></div>
                                                </div>
                                                <div className="cat-shimmer-bar cat-shimmer-title"></div>
                                                <div className="cat-shimmer-bar cat-shimmer-sub"></div>
                                                <div className="cat-shimmer-footer d-flex justify-content-between mt-2">
                                                    <div className="cat-shimmer-stat"></div>
                                                    <div className="cat-shimmer-btn"></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : categories.length > 0 ? (
                                    categories.map((category, index) => {
                                        const theme = getCategoryTheme(category.title, category.slug, index);
                                        const courseCount = Number(category.course_count) || 0;
                                        const enrollmentCount = Number(category.enrollment_count) || 0;
                                        const materialCount = Number(category.material_count) || 0;
                                        const colClass = categories.length <= 3 ? "col-lg-4 col-md-6 col-12" : "col-xl-3 col-lg-4 col-md-6 col-12";

                                        return (
                                            <div key={category.id} className={`${colClass} category-col`}>
                                                <Link
                                                    to={`/search/?category=${encodeURIComponent(category.title)}`}
                                                    className="text-decoration-none d-block h-100"
                                                >
                                                    <div
                                                        className="category-compact-card"
                                                        style={{
                                                            "--cat-accent": theme.accentColor,
                                                            "--cat-glow": theme.glowColor,
                                                        }}
                                                    >
                                                        <div className="category-card-accent-line"></div>

                                                        {/* Top Row: Icon squircle on left, tags on right */}
                                                        <div className="category-card-top d-flex align-items-center justify-content-between mb-2">
                                                            <div
                                                                className="category-icon-box"
                                                                style={{
                                                                    background: theme.gradient,
                                                                    boxShadow: `0 4px 14px ${theme.glowColor}`,
                                                                }}
                                                            >
                                                                <i className={theme.icon}></i>
                                                            </div>
                                                            <div className="d-flex align-items-center gap-1">
                                                                <span className={`cat-tag-pill cat-tag-${theme.tagColor}`}>
                                                                    {theme.tag}
                                                                </span>
                                                                <span className={courseCount > 0 ? "cat-status-chip active" : "cat-status-chip idle"}>
                                                                    <span className={courseCount > 0 ? "cat-pulse-dot" : "cat-idle-dot"}></span>
                                                                    {courseCount > 0 ? `${courseCount} Kursus` : "Segera"}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Middle: Title & Subtitle */}
                                                        <div className="category-card-content mb-2">
                                                            <h3 className="category-card-title mb-1">
                                                                {category.title}
                                                            </h3>
                                                            <p className="category-card-sub text-muted mb-0">
                                                                {theme.subtitle}
                                                            </p>
                                                        </div>

                                                        {/* Bottom: Real Live Database Metrics & Action */}
                                                        <div className="category-card-footer d-flex align-items-center justify-content-between pt-2">
                                                            <div className="category-metrics-strip d-flex align-items-center gap-2">
                                                                <span className="cat-micro-metric" title="Jumlah kursus yang diterbitkan">
                                                                    <i className="fas fa-book-open text-teal me-1"></i>
                                                                    <strong>{courseCount}</strong> Kursus
                                                                </span>
                                                                <span className="cat-metric-dot">•</span>
                                                                <span className="cat-micro-metric" title="Jumlah peserta terdaftar">
                                                                    <i className="fas fa-users text-info me-1"></i>
                                                                    <strong>{enrollmentCount}</strong> Peserta
                                                                </span>
                                                                <span className="cat-metric-dot">•</span>
                                                                <span className="cat-micro-metric" title="Jumlah modul/materi">
                                                                    <i className="fas fa-file-video text-warning me-1"></i>
                                                                    <strong>{materialCount}</strong> Modul
                                                                </span>
                                                            </div>
                                                            <span className="category-action-link">
                                                                Jelajahi <i className="fas fa-arrow-right ms-1 cat-action-arrow"></i>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </Link>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="col-12 text-center py-4">
                                        <div className="category-empty-card p-4">
                                            <i className="fas fa-folder-open text-muted mb-2" style={{ fontSize: "2rem" }}></i>
                                            <p className="text-muted mb-0">Kategori kursus akan segera tersedia</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

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
                            <div className="text-center mb-2">
                                <div
                                    className="badge mb-1"
                                    style={{
                                        background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                                        color: "white",
                                        padding: "0.3rem 0.8rem",
                                        borderRadius: "50px",
                                        fontSize: "0.78rem",
                                        fontWeight: "600",
                                        letterSpacing: "0.3px"
                                    }}
                                >
                                    <i className="fas fa-graduation-cap me-2"></i>
                                    Katalog Pelatihan Unggulan
                                </div>

                                <h2 className="display-6 fw-bold mb-1" style={{ color: "#2c3e50", fontSize: "clamp(1.4rem, 2.3vw, 1.85rem)" }}>
                                    Program Kursus <span className="about-title-accent">Pilihan BPSDM</span>
                                </h2>

                                <p className="text-muted mb-0" style={{ fontSize: "0.85rem" }}>
                                    Pelatihan berbasis kompetensi birokrasi dan transformasi digital Sekretariat Jenderal DPD RI
                                </p>
                            </div>

                            {/* Live Synchronization Toolbar */}
                            <div className="courses-live-toolbar d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                                <div className="d-flex align-items-center gap-2">
                                    <span className="courses-live-pill">
                                        <span className="courses-live-dot"></span>
                                        Sinkronisasi Database BPSDM
                                    </span>
                                    <span className="courses-count-pill">
                                        <i className="fas fa-book-open me-1 text-teal"></i>
                                        <strong>{courses.length || featuredCourses.length}</strong> Kursus Terbit
                                    </span>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <Link to="/search/" className="courses-catalog-link">
                                        <span>Lihat Semua Katalog</span>
                                        <i className="fas fa-arrow-right"></i>
                                    </Link>
                                </div>
                            </div>

                            {/* Dynamic Adaptive Grid dengan lebar ideal setengah dari sebelumnya */}
                            <div className="row g-3 justify-content-center courses-row">
                                {isLoading ? (
                                    // Loading skeleton
                                    [...Array(featuredCourses.length === 2 ? 2 : 3)].map((_, index) => (
                                        <div
                                            key={index}
                                            className="col-xl-3 col-lg-4 col-md-6 col-12 d-flex justify-content-center"
                                        >
                                            <div className="course-compact-card p-3">
                                                <div
                                                    className="placeholder rounded mb-3"
                                                    style={{
                                                        height: "150px",
                                                        background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
                                                        backgroundSize: "200% 100%",
                                                        animation: "shimmer 1s infinite"
                                                    }}
                                                />
                                                <div
                                                    className="placeholder rounded mb-2"
                                                    style={{ width: "40%", height: "14px" }}
                                                />
                                                <div
                                                    className="placeholder rounded mb-2"
                                                    style={{ width: "90%", height: "18px" }}
                                                />
                                                <div
                                                    className="placeholder rounded mb-3"
                                                    style={{ width: "70%", height: "18px" }}
                                                />
                                                <div
                                                    className="placeholder rounded"
                                                    style={{ width: "100%", height: "36px" }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : featuredCourses.length > 0 ? (
                                    featuredCourses.slice(0, 6).map((course, index) => {
                                        const theme = getCategoryTheme(course.category?.title, course.category?.slug, index);
                                        const totalJP = Number(course.total_jam_pelatihan) || calculateTotalJP(course.lectures) || 0;
                                        const studentCount = Number(course.students?.length) || 0;
                                        const reviewCount = Number(course.reviews?.length) || Number(course.rating_count) || 0;
                                        const ratingVal = course.average_rating ? Number(course.average_rating).toFixed(1) : (reviewCount > 0 ? "5.0" : null);
                                        const lectureCount = Number(course.lectures?.length) || 0;
                                        const gameCount = Number(course.games?.length) || 0;

                                        // Kolom proporsional setengah lebar (col-xl-3 / col-lg-4 / col-md-6)
                                        const colClass = "col-xl-3 col-lg-4 col-md-6 col-12 d-flex justify-content-center";

                                        return (
                                            <div key={course.id} className={colClass}>
                                                <div className="course-compact-card">
                                                    {/* Top Accent Line based on Category */}
                                                    <div
                                                        style={{
                                                            height: "3px",
                                                            width: "100%",
                                                            background: theme.gradient,
                                                            flexShrink: 0
                                                        }}
                                                    />

                                                    {/* Course Image Header with Floating Badges */}
                                                    <div className="course-banner-wrap">
                                                        <img
                                                            src={getImageUrl(course.image) || "/images/placeholders/default-course.svg"}
                                                            alt={course.title}
                                                            className="course-compact-img"
                                                            loading="lazy"
                                                            decoding="async"
                                                            width="400"
                                                            height="152"
                                                            onError={(e) => {
                                                                e.target.src = "/images/placeholders/default-course.svg";
                                                            }}
                                                        />
                                                        <div className="course-banner-vignette" />

                                                        {/* Category Badge */}
                                                        <div
                                                            className="course-badge-category"
                                                            style={{
                                                                background: theme.gradient
                                                            }}
                                                        >
                                                            <i className={`fas ${theme.icon}`}></i>
                                                            <span>{course.category?.title || "Umum"}</span>
                                                        </div>

                                                        {/* Wishlist Button - Only for students */}
                                                        {!isAdminOrTeacher && (
                                                            <button
                                                                onClick={() => addToWishlist(course.id)}
                                                                className="course-badge-wishlist"
                                                                title={isCourseInWishlist(course.id) ? "Hapus dari wishlist" : "Tambahkan ke wishlist"}
                                                                disabled={!userId}
                                                                aria-label="Wishlist"
                                                            >
                                                                <i
                                                                    className={`${isCourseInWishlist(course.id) ? "fas" : "far"} fa-heart`}
                                                                    style={{
                                                                        color: isCourseInWishlist(course.id) ? "#ef4444" : "#64748b",
                                                                        fontSize: "0.85rem"
                                                                    }}
                                                                />
                                                            </button>
                                                        )}

                                                        {/* Floating Bottom Row: Level & JP */}
                                                        <div className="course-floating-bottom">
                                                            <span className="course-badge-level">
                                                                <i className="fas fa-layer-group me-1" style={{ fontSize: "0.62rem" }}></i>
                                                                {getLevelText(course.level)}
                                                            </span>

                                                            <span className="course-badge-jp">
                                                                <i className="fas fa-clock" style={{ fontSize: "0.62rem" }}></i>
                                                                <span>{totalJP} JP</span>
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Course Body Compact */}
                                                    <div className="course-body-compact">
                                                        {/* Instructor Strip */}
                                                        <div className="course-instructor-strip">
                                                            <div className="course-instructor-info">
                                                                <img
                                                                    src={getImageUrl(course.teacher?.image) || `https://ui-avatars.com/api/?name=${encodeURIComponent(course.teacher?.full_name || "BPSDM")}&background=0d9488&color=ffffff&bold=true&size=24`}
                                                                    alt={course.teacher?.full_name || "Instruktur"}
                                                                    className="course-instructor-avatar"
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                    width="24"
                                                                    height="24"
                                                                    onError={(e) => {
                                                                        e.target.src = "/images/placeholders/default-instructor.svg";
                                                                    }}
                                                                />
                                                                <span className="course-instructor-name" title={course.teacher?.full_name || "BPSDM Setjen DPD RI"}>
                                                                    {course.teacher?.full_name || "BPSDM Setjen DPD RI"}
                                                                </span>
                                                            </div>

                                                            <span className="course-badge-official">
                                                                <i className="fas fa-shield-alt me-1 text-teal"></i>
                                                                BPSDM
                                                            </span>
                                                        </div>

                                                        {/* Course Title Link */}
                                                        <h3 className="mb-0">
                                                            <Link
                                                                to={`/course-detail/${course.slug}/`}
                                                                className="text-decoration-none course-title-compact"
                                                                title={course.title}
                                                            >
                                                                {course.title}
                                                            </Link>
                                                        </h3>

                                                        {/* Micro-Metrics Strip (Rating, Peserta, Modul) */}
                                                        <div className="course-metrics-strip">
                                                            <div className="course-metric-item">
                                                                <span className="course-metric-label">
                                                                    <i className="fas fa-star text-warning"></i>
                                                                    Rating
                                                                </span>
                                                                <span className="course-metric-val">
                                                                    {ratingVal ? (
                                                                        <>
                                                                            <span className="text-warning">{ratingVal}</span>
                                                                            <span className="text-muted fw-normal ms-1" style={{ fontSize: "0.65rem" }}>
                                                                                ({reviewCount})
                                                                            </span>
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-muted fw-normal" style={{ fontSize: "0.72rem" }}>
                                                                            Baru
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </div>

                                                            <div className="course-metric-item">
                                                                <span className="course-metric-label">
                                                                    <i className="fas fa-users text-teal"></i>
                                                                    Peserta
                                                                </span>
                                                                <span className="course-metric-val text-dark">
                                                                    {studentCount} <span className="text-muted fw-normal" style={{ fontSize: "0.65rem" }}>ASN</span>
                                                                </span>
                                                            </div>

                                                            <div className="course-metric-item">
                                                                <span className="course-metric-label">
                                                                    <i className="fas fa-book-reader text-primary"></i>
                                                                    Materi
                                                                </span>
                                                                <span className="course-metric-val text-dark">
                                                                    {lectureCount} <span className="text-muted fw-normal" style={{ fontSize: "0.65rem" }}>Modul</span>
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Gamification / Interactive Badge if Available */}
                                                        {gameCount > 0 && (
                                                            <div className="course-extra-tags">
                                                                <span className="course-tag-pill course-tag-game">
                                                                    <i className="fas fa-gamepad"></i>
                                                                    {gameCount} Game Edukasi
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Course Action Footer */}
                                                    <div className="course-action-wrap">
                                                        <Link
                                                            to={`/course-detail/${course.slug}/`}
                                                            className="course-compact-action-btn"
                                                        >
                                                            <span>Akses &amp; Mulai Belajar</span>
                                                            <i className="fas fa-arrow-right btn-arrow-icon"></i>
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="col-12 text-center py-4">
                                        <div className="p-4 rounded-4 bg-white shadow-sm border d-inline-block">
                                            <i className="fas fa-folder-open text-muted fa-2x mb-2"></i>
                                            <p className="text-muted mb-0 fw-medium">Belum ada kursus yang diterbitkan saat ini.</p>
                                        </div>
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
                                    <p className="mb-3" style={{ color: "rgba(255, 255, 255, 0.9)", fontSize: "0.88rem", lineHeight: 1 }}>
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