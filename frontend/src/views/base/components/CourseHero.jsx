import React, { useState, useEffect, useRef } from "react";
import dayjs from "../../../utils/dayjs";
import { Rating } from "react-simple-star-rating";
import "./CourseHero.css";
import { Link } from "react-router-dom";
import { getImageUrl, getCourseCurriculumSummary, calculateCourseJP } from "../../../utils/courseUtils";

const CourseHero = ({ course }) => {
    if (!course) return null;

    const teacherName = course.teacher?.full_name || course.user?.full_name || "Instruktur DPD RI";
    const teacherImage = getImageUrl(course.teacher?.image || course.user?.profile?.image);
    const formattedDate = course.date ? dayjs(course.date).format("DD MMMM YYYY") : null;
    const totalJP = calculateCourseJP(course);

    const [isScrolled, setIsScrolled] = useState(false);
    const [headerHeight, setHeaderHeight] = useState(60);
    const [naturalHeroHeight, setNaturalHeroHeight] = useState(0);

    const heroSectionRef = useRef(null);
    const heroSlotRef = useRef(null);

    // Dynamically track BaseHeader height
    useEffect(() => {
        const updateHeaderHeight = () => {
            const headerEl = document.querySelector('.base-header');
            if (headerEl) {
                const h = headerEl.offsetHeight;
                setHeaderHeight(h);
                document.documentElement.style.setProperty('--header-height', `${h}px`);
            }
        };

        updateHeaderHeight();

        let ro = null;
        const headerEl = document.querySelector('.base-header');
        if (headerEl && window.ResizeObserver) {
            ro = new ResizeObserver(() => updateHeaderHeight());
            ro.observe(headerEl);
        }

        window.addEventListener("resize", updateHeaderHeight);
        return () => {
            if (ro) ro.disconnect();
            window.removeEventListener("resize", updateHeaderHeight);
        };
    }, []);

    // Measure natural height of hero to prevent layout shifts
    useEffect(() => {
        if (!isScrolled && heroSectionRef.current) {
            const measuredHeight = heroSectionRef.current.offsetHeight;
            if (measuredHeight > 0) {
                setNaturalHeroHeight(measuredHeight);
            }
        }
    }, [course, isScrolled]);

    // Handle scroll to toggle stuck mode with RAF
    useEffect(() => {
        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrollY = window.scrollY;
                    // Trigger stuck mode when scrolling down
                    const shouldStick = scrollY >= 65;
                    setIsScrolled(shouldStick);

                    // Update CSS variable for underlying sticky bars (e.g. course-tab-bar & course-sidebar)
                    document.documentElement.style.setProperty(
                        '--course-hero-stuck-height',
                        shouldStick ? '54px' : '0px'
                    );

                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();

        return () => {
            window.removeEventListener("scroll", handleScroll);
            document.documentElement.style.setProperty('--course-hero-stuck-height', '0px');
        };
    }, []);

    // Smooth scroll to sidebar or main content
    const handleScrollToSidebar = () => {
        const target = document.querySelector('.course-sidebar-sticky') || document.querySelector('.base-course-detail-content');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div 
            className={`course-hero-slot ${isScrolled ? 'is-stuck-active' : ''}`}
            ref={heroSlotRef}
            style={{
                minHeight: naturalHeroHeight > 0 && isScrolled ? `${naturalHeroHeight}px` : undefined,
                '--header-height': `${headerHeight}px`
            }}
        >
            <section 
                ref={heroSectionRef}
                className={`course-hero-compact position-relative overflow-hidden ${isScrolled ? 'is-stuck' : ''}`}
                style={{ '--header-height': `${headerHeight}px` }}
            >
                {/* Ambient Background Gradient & Mesh Pattern */}
                <div className="course-hero-bg-overlay position-absolute w-100 h-100 top-0 start-0" />
                <div className="course-hero-ambient-glow position-absolute" />
                
                {/* 1. Full Unstuck Mode Content */}
                <div className={`container position-relative py-3 py-md-4 course-hero-full-view ${isScrolled ? 'd-none' : ''}`} style={{ zIndex: 2 }}>
                    {/* Modern Inline Breadcrumb */}
                    <nav aria-label="breadcrumb" className="mb-2">
                        <ol className="breadcrumb course-hero-breadcrumb mb-0">
                            <li className="breadcrumb-item">
                                <Link to="/" className="text-white-75 text-decoration-none">
                                    <i className="fas fa-home me-1"></i>Beranda
                                </Link>
                            </li>
                            <li className="breadcrumb-item">
                                <Link to="/search/" className="text-white-75 text-decoration-none">
                                    Kursus
                                </Link>
                            </li>
                            {course.category?.title && (
                                <li className="breadcrumb-item active text-white" aria-current="page">
                                    <Link
                                        to={`/search/?category=${encodeURIComponent(course.category.title)}`}
                                        className="text-white text-decoration-none fw-medium"
                                    >
                                        {course.category.title}
                                    </Link>
                                </li>
                            )}
                        </ol>
                    </nav>

                    <div className="row align-items-center g-3">
                        <div className="col-lg-9 col-md-10">
                            {/* Badges Row */}
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                {course.category?.title && (
                                    <span className="hero-badge hero-badge-category">
                                        <i className="fas fa-layer-group me-1"></i>
                                        {course.category.title}
                                    </span>
                                )}
                                
                                {course.level && (
                                    <span className="hero-badge hero-badge-level">
                                        <i className="fas fa-signal me-1"></i>
                                        {course.level}
                                    </span>
                                )}

                                <span
                                    className="hero-badge hero-badge-jp"
                                    title="Bobot Pelatihan: Sesuai Standar UU ASN No. 20/2023 Pasal 49 (Hak Pengembangan Pegawai min. 20 JP/tahun)"
                                >
                                    <i className="fas fa-award me-1"></i>
                                    {totalJP} Jam Pelatihan (JP)
                                </span>

                                {course.featured && (
                                    <span className="hero-badge hero-badge-featured">
                                        <i className="fas fa-bolt me-1"></i>
                                        Unggulan
                                    </span>
                                )}

                                <span className="hero-badge hero-badge-platform">
                                    <i className="fas fa-landmark me-1"></i>
                                    Setjen DPD RI
                                </span>

                                {course.target_audience === 'asn' ? (
                                    <span className="hero-badge hero-badge-audience-public" title="Kursus khusus Aparatur Sipil Negara" style={{ background: 'rgba(5, 150, 105, 0.25)', borderColor: 'rgba(167, 243, 208, 0.4)', color: '#6ee7b7' }}>
                                        <i className="fas fa-building-columns me-1"></i>
                                        Khusus ASN
                                    </span>
                                ) : course.target_audience === 'umum' ? (
                                    <span className="hero-badge hero-badge-audience-public" title="Kursus terbuka untuk umum">
                                        <i className="fas fa-globe me-1"></i>
                                        Terbuka untuk Umum
                                    </span>
                                ) : (
                                    <span className="hero-badge hero-badge-audience-internal" title="Pelatihan kedinasan internal Setjen DPD RI">
                                        <i className="fas fa-shield-halved me-1"></i>
                                        Khusus Internal DPD RI
                                    </span>
                                )}
                            </div>
                            
                            {/* Course Title */}
                            <h1 className="course-hero-title text-white fw-bold mb-2">
                                {course.title}
                            </h1>

                            {/* Course Tags */}
                            {course.tags && Array.isArray(course.tags) && course.tags.length > 0 && (
                                <div className="d-flex flex-wrap gap-1 mb-2">
                                    {course.tags.map((tag) => (
                                        <span key={tag.id || tag.title} className="hero-tag-chip">
                                            #{tag.title}
                                        </span>
                                    ))}
                                </div>
                            )}
                            
                            {/* Metadata Ribbon (Compact & Informative) */}
                            <div className="course-hero-meta d-flex flex-wrap align-items-center gap-3 pt-1 text-white-75">
                                {/* Instructor Info */}
                                <div className="d-flex align-items-center gap-2">
                                    <img
                                        src={teacherImage || "/images/placeholders/default-instructor.svg"}
                                        alt={teacherName}
                                        className="rounded-circle border border-white border-opacity-25"
                                        style={{ width: "24px", height: "24px", objectFit: "cover" }}
                                        onError={(e) => { e.target.src = "/images/placeholders/default-instructor.svg"; }}
                                    />
                                    <span className="text-white fw-medium small">
                                        {teacherName}
                                    </span>
                                </div>

                                {/* Ratings */}
                                <div className="d-flex align-items-center gap-1 small">
                                    <Rating
                                        initialValue={course.average_rating || 0}
                                        readonly={true}
                                        size={13}
                                        fillColor="#fbbf24"
                                        emptyColor="rgba(255, 255, 255, 0.3)"
                                    />
                                    <span className="text-warning fw-bold ms-1">
                                        {(course.average_rating || 0).toFixed(1)}
                                    </span>
                                    <span className="opacity-75">
                                        ({course.rating_count || 0} ulasan)
                                    </span>
                                </div>

                                {/* Students */}
                                <div className="d-flex align-items-center small">
                                    <i className="fas fa-user-graduate me-1 text-white-50"></i>
                                    <span>{course.students?.length || 0} Peserta</span>
                                </div>

                                {/* Jam Pelatihan (JP) */}
                                <div
                                    className="d-flex align-items-center small"
                                    title="Standar UU ASN No. 20/2023 Pasal 49: 1 JP = 45 Menit Pembelajaran"
                                >
                                    <i className="fas fa-award me-1 text-warning"></i>
                                    <span className="text-white fw-semibold">{totalJP} JP</span>
                                    <span className="text-white-50 ms-1">({totalJP * 45} Menit)</span>
                                </div>

                                {/* Total Curriculum / Lessons */}
                                <div className="d-flex align-items-center small">
                                    {(() => {
                                        const { sectionsCount, lessonsCount } = getCourseCurriculumSummary(course);
                                        return (
                                            <>
                                                <i className="fas fa-book-open me-1 text-white-50"></i>
                                                <span>{sectionsCount} Modul</span>
                                                <span className="mx-1 opacity-50">•</span>
                                                <span>{lessonsCount} Materi</span>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Date */}
                                {formattedDate && (
                                    <div className="d-flex align-items-center small">
                                        <i className="fas fa-clock-rotate-left me-1 text-white-50"></i>
                                        <span>Diperbarui {formattedDate}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Stuck Compact Mode Content (Ultra Sleek & Eye-Catching Bar) */}
                <div className={`container position-relative course-hero-stuck-view ${isScrolled ? 'd-flex' : 'd-none'}`} style={{ zIndex: 2 }}>
                    <div className="course-hero-stuck-inner w-100 d-flex align-items-center justify-content-between">
                        {/* Left Side: Brand Icon, Category Chip, Course Title with Ellipsis & Floating Tooltip, Rating */}
                        <div className="course-hero-stuck-left d-flex align-items-center gap-2 overflow-hidden">
                            <span className="hero-stuck-badge" title="Platform Pembelajaran Setjen DPD RI">
                                <i className="fas fa-graduation-cap"></i>
                            </span>

                            {course.category?.title && (
                                <span className="hero-stuck-category-chip d-none d-md-inline-flex" title={course.category.title}>
                                    <i className="fas fa-layer-group me-1"></i>
                                    <span>{course.category.title}</span>
                                </span>
                            )}

                            {/* JP Badge in Stuck Mode */}
                            <span
                                className="hero-stuck-jp-chip d-none d-sm-inline-flex"
                                title={`Bobot: ${totalJP} Jam Pelatihan (Standar UU ASN No. 20/2023)`}
                            >
                                <i className="fas fa-award text-warning me-1"></i>
                                <span>{totalJP} JP</span>
                            </span>

                            {/* Course Title with Ellipsis & Custom Hover Tooltip */}
                            <div className="course-hero-stuck-title-box">
                                <h1 
                                    className="course-hero-stuck-title" 
                                    title={course.title}
                                    aria-label={course.title}
                                >
                                    <span>{course.title}</span>
                                </h1>

                                {/* Floating Tooltip card when hovered */}
                                <div className="course-hero-title-tooltip" role="tooltip">
                                    <i className="fas fa-circle-info text-teal-accent"></i>
                                    <span>{course.title}</span>
                                </div>
                            </div>

                            {course.average_rating > 0 && (
                                <div 
                                    className="hero-stuck-rating-pill d-none d-sm-inline-flex" 
                                    title={`${(course.average_rating || 0).toFixed(1)} dari ${course.rating_count || 0} ulasan`}
                                >
                                    <i className="fas fa-star text-warning me-1"></i>
                                    <span>{(course.average_rating || 0).toFixed(1)}</span>
                                </div>
                            )}
                        </div>

                        {/* Right Side: Instructor Pill & Quick Action Button */}
                        <div className="course-hero-stuck-right d-flex align-items-center gap-2 gap-md-3 flex-shrink-0">
                            <div className="hero-stuck-instructor d-none d-lg-flex align-items-center gap-2" title={`Instruktur: ${teacherName}`}>
                                <img
                                    src={teacherImage || "/images/placeholders/default-instructor.svg"}
                                    alt={teacherName}
                                    className="hero-stuck-instructor-avatar"
                                    onError={(e) => { e.target.src = "/images/placeholders/default-instructor.svg"; }}
                                />
                                <span className="hero-stuck-instructor-name text-truncate">{teacherName}</span>
                            </div>

                            <button
                                type="button"
                                className="hero-stuck-action-btn"
                                onClick={handleScrollToSidebar}
                                title="Lihat Pendaftaran & Detail Kursus"
                            >
                                <span>Ikuti Kursus</span>
                                <i className="fas fa-arrow-down ms-1"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default CourseHero;