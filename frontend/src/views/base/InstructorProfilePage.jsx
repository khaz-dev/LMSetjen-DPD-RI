import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import useAxios from "../../utils/useAxios";
import { getImageUrl, getLevelText } from "../../utils/courseUtils";
import { SkeletonInstructorProfile } from "../../components/skeletons/InstructorSkeletons";
import Swal from "sweetalert2";
import "./InstructorProfilePage.css";

// Proficiency level translations
const PROFICIENCY_LEVELS = {
    'beginner': 'Pemula',
    'intermediate': 'Menengah',
    'advanced': 'Lanjutan',
    'expert': 'Ahli'
};

const getProficiencyLabel = (level) => {
    if (!level) return level;
    return PROFICIENCY_LEVELS[level.toLowerCase()] || level;
};

function InstructorProfilePage() {
    const { teacher_id } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [teacher, setTeacher] = useState(null);
    const [courses, setCourses] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [copied, setCopied] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [headerHeight, setHeaderHeight] = useState(78);

    // Measure BaseHeader height dynamically to ensure pixel-perfect sticky positioning
    useEffect(() => {
        const updateHeaderHeight = () => {
            const headerEl = document.querySelector('.base-header');
            if (headerEl) {
                setHeaderHeight(headerEl.offsetHeight);
            }
        };

        updateHeaderHeight();

        let ro = null;
        const headerEl = document.querySelector('.base-header');
        if (headerEl && window.ResizeObserver) {
            ro = new ResizeObserver(() => {
                updateHeaderHeight();
            });
            ro.observe(headerEl);
        }

        window.addEventListener("resize", updateHeaderHeight);
        return () => {
            if (ro) ro.disconnect();
            window.removeEventListener("resize", updateHeaderHeight);
        };
    }, []);

    useEffect(() => {
        let ticking = false;
        let snapTimeout = null;
        let isSnapping = false;

        const SNAP_STUCK_Y = 75;
        const SNAP_MIDPOINT = 38;

        const performSnap = () => {
            if (isSnapping) return;
            const currentY = window.scrollY;
            // Only trigger snap if user stopped scrolling in the transition zone
            if (currentY > 6 && currentY < SNAP_STUCK_Y) {
                isSnapping = true;
                const targetY = currentY >= SNAP_MIDPOINT ? SNAP_STUCK_Y : 0;
                window.scrollTo({
                    top: targetY,
                    behavior: 'smooth'
                });
                setTimeout(() => {
                    isSnapping = false;
                }, 300);
            }
        };

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrollY = window.scrollY;
                    // Trigger stuck mode smoothly
                    setIsScrolled(scrollY >= 55);
                    ticking = false;
                });
                ticking = true;
            }

            // Magnetic snap debounce: automatically snaps to 0 or 75 if user scrolls slowly and stops in-between
            clearTimeout(snapTimeout);
            snapTimeout = setTimeout(performSnap, 80);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        if ('onscrollend' in window) {
            window.addEventListener("scrollend", performSnap, { passive: true });
        }

        return () => {
            clearTimeout(snapTimeout);
            window.removeEventListener("scroll", handleScroll);
            if ('onscrollend' in window) {
                window.removeEventListener("scrollend", performSnap);
            }
        };
    }, []);

    useEffect(() => {
        if (!teacher_id) {
            setError("ID instruktur tidak ditemukan");
            setLoading(false);
            return;
        }

        fetchData();
    }, [teacher_id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Parallel public API calls for optimal performance
            // Note: teacher/detail/ and teacher/published-courses/ are public endpoints (AllowAny)
            const [teacherProfileRes, coursesRes, reviewsRes] = await Promise.all([
                useAxios.get(`teacher/detail/${teacher_id}/`).catch(() => ({ data: null })),
                useAxios.get(`teacher/published-courses/${teacher_id}/`).catch(() => ({ data: [] })),
                useAxios.get(`teacher/review-lists/${teacher_id}/`).catch(() => ({ data: { count: 0, results: [] } }))
            ]);

            // Extract courses
            const coursesData = Array.isArray(coursesRes.data) ? coursesRes.data : [];
            setCourses(coursesData);

            // Try to get teacher from direct API first, then fallback to course
            let teacherData = null;
            if (teacherProfileRes.data) {
                teacherData = teacherProfileRes.data;
            } else if (coursesData.length > 0 && coursesData[0].teacher) {
                teacherData = coursesData[0].teacher;
            }

            if (teacherData) {
                setTeacher(teacherData);
            } else {
                setError("Instruktur tidak ditemukan");
                setLoading(false);
                return;
            }

            // Extract reviews
            const reviewsData = reviewsRes.data?.results || reviewsRes.data || [];
            setReviews(Array.isArray(reviewsData) ? reviewsData : []);

        } catch (err) {
            console.error("Error fetching instructor data:", err);
            setError("Gagal memuat profil instruktur. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = () => {
        try {
            navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2200);
        } catch {
            Swal.fire({
                icon: "info",
                title: "Tautan Profil",
                text: window.location.href,
                confirmButtonColor: "#0d9488"
            });
        }
    };

    // Filter published courses
    const publishedCourses = courses.filter(course => course.platform_status === 'Published');

    // Calculate average rating from reviews if available, or fallback to teacher data
    const calculateAverageRating = () => {
        if (reviews.length === 0) return 0;
        const total = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
        return (total / reviews.length).toFixed(1);
    };

    const reviewAvg = calculateAverageRating();
    const effectiveRating = teacher?.average_rating && Number(teacher.average_rating) > 0
        ? Number(teacher.average_rating).toFixed(1)
        : (reviewAvg > 0 ? reviewAvg : "4.8");

    const totalCourses = publishedCourses.length;
    const totalStudents = teacher?.total_students || 0;

    if (loading) {
        return (
            <div className="instructor-profile-wrapper" style={{ '--header-height': `${headerHeight}px` }}>
                <BaseHeader />
                <div className="container py-4">
                    <SkeletonInstructorProfile />
                </div>
                <Footer />
            </div>
        );
    }

    if (error || !teacher) {
        return (
            <div className="instructor-profile-wrapper" style={{ '--header-height': `${headerHeight}px` }}>
                <BaseHeader />
                <div className="container py-5 text-center">
                    <div className="alert alert-warning d-inline-flex align-items-center gap-2 px-4 py-3 rounded-3" role="alert">
                        <i className="fas fa-exclamation-triangle text-warning"></i>
                        <span>{error || "Instruktur tidak ditemukan"}</span>
                    </div>
                    <div className="mt-3">
                        <Link to="/" className="btn btn-outline-teal px-4">
                            <i className="fas fa-home me-2"></i> Kembali ke Beranda
                        </Link>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="instructor-profile-wrapper" style={{ '--header-height': `${headerHeight}px` }}>
            <BaseHeader />

            {/* 1. Compact & Sticky Hero Banner wrapped in Stable Hero Slot */}
            <div className="instructor-hero-slot">
                <section className={`instructor-hero-banner ${isScrolled ? 'is-stuck' : ''}`}>
                <div className="container">
                    {/* Breadcrumbs */}
                    <nav aria-label="breadcrumb" className="instructor-breadcrumb">
                        <Link to="/" className="breadcrumb-item-link">
                            <i className="fas fa-home me-1"></i> Beranda
                        </Link>
                        <span className="breadcrumb-separator">/</span>
                        <Link to="/courses/" className="breadcrumb-item-link">
                            Kursus
                        </Link>
                        <span className="breadcrumb-separator">/</span>
                        <span className="breadcrumb-current">{teacher.full_name}</span>
                    </nav>

                    {/* Main Hero Card Content */}
                    <div className="instructor-hero-main">
                        <div className="instructor-hero-left">
                            {/* Avatar */}
                            <div className="instructor-avatar-container">
                                <img
                                    src={getImageUrl(teacher.image) || '/images/placeholders/default-instructor.svg'}
                                    alt={teacher.full_name}
                                    className="instructor-avatar-img"
                                    onError={(e) => {
                                        e.target.src = '/images/placeholders/default-instructor.svg';
                                    }}
                                />
                                <div className="instructor-verified-badge" title="Instruktur Terverifikasi DPD RI">
                                    <i className="fas fa-check"></i>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="instructor-hero-details">
                                <div className="instructor-tag-row">
                                    <span className="instructor-role-badge">
                                        <i className="fas fa-chalkboard-user me-1"></i> Instruktur DPD RI
                                    </span>
                                    {teacher.country && (
                                        <span className="instructor-location-badge">
                                            <i className="fas fa-map-marker-alt me-1"></i> {teacher.country}
                                        </span>
                                    )}
                                </div>
                                <h1 className="instructor-profile-title">{teacher.full_name}</h1>
                                <p className="instructor-profile-subtitle">
                                    {teacher.bio || "Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia"}
                                </p>

                                {/* Action Buttons & Socials */}
                                <div className="instructor-hero-actions">
                                    <div className="instructor-social-pills">
                                        {teacher.facebook && (
                                            <a href={teacher.facebook} target="_blank" rel="noopener noreferrer" className="social-pill" title="Facebook">
                                                <i className="fab fa-facebook-f"></i>
                                            </a>
                                        )}
                                        {teacher.twitter && (
                                            <a href={teacher.twitter} target="_blank" rel="noopener noreferrer" className="social-pill" title="Twitter / X">
                                                <i className="fab fa-x-twitter"></i>
                                            </a>
                                        )}
                                        {teacher.linkedin && (
                                            <a href={teacher.linkedin} target="_blank" rel="noopener noreferrer" className="social-pill" title="LinkedIn">
                                                <i className="fab fa-linkedin-in"></i>
                                            </a>
                                        )}
                                        {teacher.instagram && (
                                            <a href={teacher.instagram} target="_blank" rel="noopener noreferrer" className="social-pill" title="Instagram">
                                                <i className="fab fa-instagram"></i>
                                            </a>
                                        )}
                                        {teacher.youtube && (
                                            <a href={teacher.youtube} target="_blank" rel="noopener noreferrer" className="social-pill" title="YouTube">
                                                <i className="fab fa-youtube"></i>
                                            </a>
                                        )}
                                        {teacher.tiktok && (
                                            <a href={teacher.tiktok} target="_blank" rel="noopener noreferrer" className="social-pill" title="TikTok">
                                                <i className="fab fa-tiktok"></i>
                                            </a>
                                        )}
                                    </div>

                                    {/* Copy Link Button */}
                                    <button
                                        type="button"
                                        className={`btn-share-profile ${copied ? 'copied' : ''}`}
                                        onClick={handleCopyLink}
                                        title="Salin tautan profil"
                                    >
                                        <i className={`fas ${copied ? 'fa-check text-success' : 'fa-share-nodes'} me-1`}></i>
                                        <span>{copied ? 'Tautan Tersalin!' : 'Bagikan'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Inline Stat Chips */}
                        <div className="instructor-hero-stats">
                            <div className="stat-pill-item">
                                <div className="stat-pill-icon courses-icon">
                                    <i className="fas fa-book-open"></i>
                                </div>
                                <div className="stat-pill-info">
                                    <span className="stat-pill-num">{totalCourses}</span>
                                    <span className="stat-pill-lbl">Kursus</span>
                                </div>
                            </div>

                            <div className="stat-pill-item">
                                <div className="stat-pill-icon students-icon">
                                    <i className="fas fa-users"></i>
                                </div>
                                <div className="stat-pill-info">
                                    <span className="stat-pill-num">{totalStudents}</span>
                                    <span className="stat-pill-lbl">Siswa</span>
                                </div>
                            </div>

                            <div className="stat-pill-item">
                                <div className="stat-pill-icon rating-icon">
                                    <i className="fas fa-star"></i>
                                </div>
                                <div className="stat-pill-info">
                                    <span className="stat-pill-num">{effectiveRating}</span>
                                    <span className="stat-pill-lbl">Rating</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            </div>

            {/* 2. Compact Two-Column Layout */}
            <div className="container instructor-content-container">
                <div className="row g-3 g-lg-4">
                    {/* Left Column (Sidebar) */}
                    <div className="col-lg-4">
                        <div className="instructor-sidebar-stack">
                            {/* Card: Tentang Instruktur */}
                            <div className="profile-compact-card">
                                <div className="compact-card-header">
                                    <div className="header-icon-box">
                                        <i className="fas fa-user-tie"></i>
                                    </div>
                                    <h2 className="compact-card-heading">Tentang Instruktur</h2>
                                </div>
                                <div className="compact-card-body">
                                    <p className="about-text-content">
                                        {teacher.about || teacher.bio || "Instruktur aktif di lingkungan Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia (Setjen DPD RI)."}
                                    </p>

                                    {teacher.about && teacher.bio && teacher.about !== teacher.bio && (
                                        <div className="bio-extra-content mt-3 pt-3">
                                            <span className="d-block small text-muted fw-bold mb-1">
                                                <i className="fas fa-briefcase me-1 text-teal"></i> Latar Belakang:
                                            </span>
                                            <p className="about-text-content mb-0">{teacher.bio}</p>
                                        </div>
                                    )}

                                    {/* Quick Facts List */}
                                    <div className="instructor-facts-list mt-3">
                                        <div className="fact-item">
                                            <i className="fas fa-building-columns"></i>
                                            <div className="fact-content">
                                                <span className="fact-label">Instansi</span>
                                                <span className="fact-value">Setjen DPD RI</span>
                                            </div>
                                        </div>
                                        <div className="fact-item">
                                            <i className="fas fa-location-dot"></i>
                                            <div className="fact-content">
                                                <span className="fact-label">Wilayah</span>
                                                <span className="fact-value">{teacher.country || "Indonesia"}</span>
                                            </div>
                                        </div>
                                        <div className="fact-item">
                                            <i className="fas fa-shield-halved"></i>
                                            <div className="fact-content">
                                                <span className="fact-label">Status</span>
                                                <span className="fact-value text-success">
                                                    <i className="fas fa-circle-check me-1"></i> Terverifikasi
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card: Keahlian & Spesialisasi (if any) */}
                            {teacher.expertise && teacher.expertise.length > 0 && (
                                <div className="profile-compact-card">
                                    <div className="compact-card-header">
                                        <div className="header-icon-box">
                                            <i className="fas fa-award"></i>
                                        </div>
                                        <h2 className="compact-card-heading">Keahlian & Kompetensi</h2>
                                    </div>
                                    <div className="compact-card-body">
                                        <div className="expertise-tags-flow">
                                            {teacher.expertise.map((skill, index) => (
                                                <div key={skill.id || index} className="expertise-chip">
                                                    <span className="skill-name">{skill.skill}</span>
                                                    <span className={`skill-level-pill level-${(skill.proficiency_level || 'beginner').toLowerCase()}`}>
                                                        {getProficiencyLabel(skill.proficiency_level)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Card: Reputasi & Penilaian */}
                            <div className="profile-compact-card">
                                <div className="compact-card-header">
                                    <div className="header-icon-box">
                                        <i className="fas fa-star"></i>
                                    </div>
                                    <h2 className="compact-card-heading">Reputasi & Penilaian</h2>
                                </div>
                                <div className="compact-card-body">
                                    <div className="rating-reputation-box">
                                        <div className="rep-score">{effectiveRating}</div>
                                        <div className="rep-stars">
                                            {[...Array(5)].map((_, i) => (
                                                <i
                                                    key={i}
                                                    className={`fas fa-star ${i < Math.floor(effectiveRating === 'Baru' ? 5 : Number(effectiveRating)) ? 'filled' : ''}`}
                                                ></i>
                                            ))}
                                        </div>
                                        <div className="rep-caption">
                                            {reviews.length > 0
                                                ? `Berdasarkan ${reviews.length} ulasan siswa`
                                                : "Indeks kepuasan peserta diklat DPD RI"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Courses & Reviews) */}
                    <div className="col-lg-8">
                        <div className="instructor-main-stack">
                            {/* Card: Kursus yang Diselenggarakan */}
                            <div className="profile-compact-card">
                                <div className="compact-card-header d-flex justify-content-between align-items-center">
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="header-icon-box">
                                            <i className="fas fa-graduation-cap"></i>
                                        </div>
                                        <div>
                                            <h2 className="compact-card-heading mb-0">Kursus yang Diselenggarakan</h2>
                                            <span className="compact-card-subheading">Pelatihan aktif yang diampu oleh instruktur</span>
                                        </div>
                                    </div>
                                    <span className="badge-count-pill">
                                        {publishedCourses.length} Kursus
                                    </span>
                                </div>

                                <div className="compact-card-body">
                                    {publishedCourses.length > 0 ? (
                                        <div className="row row-cols-1 row-cols-sm-2 g-3">
                                            {publishedCourses.map((course) => {
                                                const ratingVal = course.average_rating ? Number(course.average_rating) : 0;
                                                const jpVal = course.total_jam_pelatihan || 1;
                                                const categoryName = typeof course.category === 'object'
                                                    ? (course.category?.title || 'Umum')
                                                    : (course.category || 'Umum');

                                                return (
                                                    <div key={course.id} className="col">
                                                        <div className="compact-course-card">
                                                            {/* Course Thumbnail */}
                                                            <div className="course-card-thumb-wrap">
                                                                <img
                                                                    src={getImageUrl(course.image) || '/images/placeholders/default-course.svg'}
                                                                    alt={course.title}
                                                                    className="course-card-thumb"
                                                                    onError={(e) => {
                                                                        e.target.src = '/images/placeholders/default-course.svg';
                                                                    }}
                                                                />
                                                                {/* Top Badges */}
                                                                <div className="thumb-badges-top">
                                                                    <span className="badge-category-chip">
                                                                        {categoryName}
                                                                    </span>
                                                                    {course.featured && (
                                                                        <span className="badge-featured-chip" title="Kursus Unggulan">
                                                                            <i className="fas fa-star"></i>
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Bottom Badges */}
                                                                <div className="thumb-badges-bottom">
                                                                    <span className="badge-jp-chip">
                                                                        <i className="fas fa-clock me-1"></i>{jpVal} JP
                                                                    </span>
                                                                    <span className={`badge-level-chip level-${(course.level || 'all').toLowerCase()}`}>
                                                                        {getLevelText(course.level)}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Course Info */}
                                                            <div className="course-card-details">
                                                                <h3 className="course-card-title">
                                                                    <Link to={`/course-detail/${course.slug}/`} title={course.title}>
                                                                        {course.title}
                                                                    </Link>
                                                                </h3>

                                                                <div className="course-card-meta-row">
                                                                    <div className="meta-stat-item">
                                                                        <i className="fas fa-star text-warning"></i>
                                                                        <span className="fw-bold">{ratingVal > 0 ? ratingVal.toFixed(1) : 'Baru'}</span>
                                                                        {course.rating_count > 0 && (
                                                                            <span className="text-muted small">({course.rating_count})</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="meta-stat-item text-secondary">
                                                                        <i className="fas fa-users me-1"></i>
                                                                        <span>{course.students?.length || 0} Siswa</span>
                                                                    </div>
                                                                </div>

                                                                <Link
                                                                    to={`/course-detail/${course.slug}/`}
                                                                    className="btn-course-cta"
                                                                >
                                                                    <span>Lihat Detail Kursus</span>
                                                                    <i className="fas fa-arrow-right"></i>
                                                                </Link>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="empty-courses-state">
                                            <div className="empty-icon-circle">
                                                <i className="fas fa-folder-open"></i>
                                            </div>
                                            <h4 className="empty-state-title">Belum Ada Kursus Publik</h4>
                                            <p className="empty-state-text">
                                                Instruktur ini belum memiliki kursus yang dipublikasikan saat ini.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card: Ulasan & Testimoni Siswa */}
                            <div className="profile-compact-card">
                                <div className="compact-card-header d-flex justify-content-between align-items-center">
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="header-icon-box">
                                            <i className="fas fa-comments"></i>
                                        </div>
                                        <div>
                                            <h2 className="compact-card-heading mb-0">Ulasan & Testimoni Siswa</h2>
                                            <span className="compact-card-subheading">Tanggapan dari para peserta pelatihan</span>
                                        </div>
                                    </div>
                                    <span className="badge-count-pill">
                                        {reviews.length} Ulasan
                                    </span>
                                </div>

                                <div className="compact-card-body">
                                    {reviews.length > 0 ? (
                                        <div className="reviews-compact-stream">
                                            {reviews.slice(0, 10).map((review) => (
                                                <div key={review.id} className="compact-review-item">
                                                    <div className="review-item-header">
                                                        <div className="review-user-block">
                                                            <div className="review-user-avatar">
                                                                {review.user?.image ? (
                                                                    <img
                                                                        src={review.user.image}
                                                                        alt={review.user.full_name}
                                                                        onError={(e) => { e.target.src = '/images/placeholders/default-user.svg'; }}
                                                                    />
                                                                ) : (
                                                                    <i className="fas fa-user"></i>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h5 className="review-user-name">{review.user?.full_name || 'Peserta Diklat'}</h5>
                                                                <span className="review-course-name">{review.course?.title}</span>
                                                            </div>
                                                        </div>
                                                        <div className="review-meta-right">
                                                            <div className="review-stars-row">
                                                                {[...Array(5)].map((_, i) => (
                                                                    <i key={i} className={`fas fa-star ${i < (review.rating || 5) ? 'filled' : ''}`}></i>
                                                                ))}
                                                            </div>
                                                            <span className="review-date-text">
                                                                {review.date ? new Date(review.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <p className="review-body-text">{review.review}</p>

                                                    {review.reply && (
                                                        <div className="review-instructor-reply">
                                                            <div className="reply-header">
                                                                <i className="fas fa-reply me-1 text-teal"></i>
                                                                <strong>Tanggapan Instruktur:</strong>
                                                            </div>
                                                            <p className="reply-body">{review.reply}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-reviews-state">
                                            <div className="empty-review-icon">
                                                <i className="fas fa-comment-dots"></i>
                                            </div>
                                            <h4 className="empty-review-title">Belum Ada Ulasan</h4>
                                            <p className="empty-review-text">
                                                Belum ada ulasan siswa untuk instruktur ini. Ulasan akan muncul setelah peserta menyelesaikan kursus dan memberikan penilaian.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}

export default React.memo(InstructorProfilePage);
