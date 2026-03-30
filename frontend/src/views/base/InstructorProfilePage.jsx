import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import useAxios from "../../utils/useAxios";
import { getImageUrl, getLevelText } from "../../utils/courseUtils";
import { SkeletonInstructorProfile } from "../../components/skeletons/InstructorSkeletons";
import Swal from "sweetalert2";
import "./InstructorProfilePage.css";

// ✨ PHASE 4.43: Proficiency level translations
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
    const [stats, setStats] = useState(null);

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
            
            // ✨ PHASE 4.43: Fetch teacher profile directly with expertise data
            // Using teacher/detail/{teacher_id}/ endpoint for public teacher data
            // Parallel API calls for better performance
            const [teacherProfileRes, coursesRes, summaryRes, reviewsRes] = await Promise.all([
                useAxios.get(`teacher/detail/${teacher_id}/`).catch(() => ({ data: null })),
                useAxios.get(`teacher/published-courses/${teacher_id}/`).catch(() => ({ data: [] })),  // ✨ PHASE 4.77: Use separate endpoint for published courses
                useAxios.get(`teacher/summary/${teacher_id}/`).catch(() => ({ data: [{ total_courses: 0, total_students: 0 }] })),
                useAxios.get(`teacher/review-lists/${teacher_id}/`).catch(() => ({ data: { count: 0, results: [] } }))
            ]);
            
            // Extract courses
            const coursesData = Array.isArray(coursesRes.data) ? coursesRes.data : [];
            setCourses(coursesData);
            
            // ✨ PHASE 4.43: Try to get teacher from direct API first, then fallback to course
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
            
            // Extract stats
            const statsData = Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data;
            setStats(statsData || { total_courses: 0, total_students: 0 });
            
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

    // ✨ PHASE 4.77: Helper to get published courses (filter once, use multiple times)
    const publishedCourses = courses.filter(course => course.platform_status === 'Published');

    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-profile-page pt-5 pb-5">
                    <div className="container">
                        <SkeletonInstructorProfile />
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    if (error || !teacher) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-profile-page error-section pt-5 pb-5">
                    <div className="container">
                        <div className="alert alert-warning" role="alert">
                            <i className="fas fa-exclamation-triangle me-2"></i>
                            {error || "Instruktur tidak ditemukan"}
                        </div>
                        <div className="mt-3">
                            <a href="/" className="btn btn-primary">
                                <i className="fas fa-home me-2"></i>
                                Kembali ke Beranda
                            </a>
                        </div>
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    // Calculate average rating from reviews
    const calculateAverageRating = () => {
        if (reviews.length === 0) return 0;
        const total = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
        return (total / reviews.length).toFixed(1);
    };

    const averageRating = calculateAverageRating();

    return (
        <>
            <BaseHeader />
            
            <section className="instructor-profile-page pt-5 pb-5">
                <div className="container">
                    {/* Hero Section */}
                    <div className="instructor-profile-hero mb-5">
                        <div className="hero-content">
                            <div className="hero-avatar-wrapper">
                                <img 
                                    src={getImageUrl(teacher.image) || '/images/placeholders/default-instructor.svg'}
                                    alt={teacher.full_name}
                                    className="hero-avatar"
                                    onError={(e) => {
                                        e.target.src = '/images/placeholders/default-instructor.svg';
                                    }}
                                />
                                <div className="instructor-badge">
                                    <i className="fas fa-chalkboard-user"></i>
                                </div>
                            </div>
                            
                            <div className="hero-info">
                                <h1 className="instructor-name">{teacher.full_name}</h1>
                                {teacher.bio && (
                                    <p className="instructor-bio">{teacher.bio}</p>
                                )}
                                {teacher.country && (
                                    <p className="instructor-location">
                                        <i className="fas fa-map-marker-alt"></i> {teacher.country}
                                    </p>
                                )}
                                
                                {/* Social Links */}
                                {(teacher.facebook || teacher.twitter || teacher.linkedin) && (
                                    <div className="instructor-social">
                                        {teacher.facebook && (
                                            <a 
                                                href={teacher.facebook} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="social-icon"
                                                title="Facebook"
                                            >
                                                <i className="fab fa-facebook-f"></i>
                                            </a>
                                        )}
                                        {teacher.twitter && (
                                            <a 
                                                href={teacher.twitter} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="social-icon"
                                                title="Twitter"
                                            >
                                                <i className="fab fa-twitter"></i>
                                            </a>
                                        )}
                                        {teacher.linkedin && (
                                            <a 
                                                href={teacher.linkedin} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="social-icon"
                                                title="LinkedIn"
                                            >
                                                <i className="fab fa-linkedin-in"></i>
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ✨ PHASE 4.43.2: Stats Section - Moved to Right Side */}
                            <div className="instructor-stats">
                                <div className="stat">
                                    <span className="stat-value">{stats?.total_courses || 0}</span>
                                    <span className="stat-label">Kursus</span>
                                </div>
                                <div className="stat">
                                    <span className="stat-value">{stats?.total_students || 0}</span>
                                    <span className="stat-label">Siswa</span>
                                </div>
                                <div className="stat">
                                    <span className="stat-value">{averageRating}</span>
                                    <span className="stat-label">Rating</span>
                                </div>
                            </div>
                        </div>

                        {/* ✨ PHASE 4.43.2: About Section - Moved to Bottom of Hero */}
                        {teacher.about && (
                            <div className="hero-about-section">
                                <h3 className="about-title">
                                    <i className="fas fa-user-tie"></i>
                                    Tentang Instruktur
                                </h3>
                                <div className="about-content">
                                    <p>{teacher.about}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ✨ PHASE 4.43: Professional Background Section */}
                    {teacher.bio && (
                        <div className="instructor-profile-about mb-5">
                            <h2 className="section-title">
                                <i className="fas fa-briefcase section-icon"></i>
                                Latar Belakang Profesional
                            </h2>
                            <div className="about-content">
                                <p>{teacher.bio}</p>
                            </div>
                        </div>
                    )}

                    {/* ✨ PHASE 4.43: Expertise Section */}
                    {teacher.expertise && teacher.expertise.length > 0 && (
                        <div className="instructor-profile-expertise mb-5">
                            <h2 className="section-title">
                                <i className="fas fa-star section-icon"></i>
                                Keahlian & Spesialisasi
                            </h2>
                            <div className="expertise-grid">
                                {teacher.expertise.map((skill, index) => (
                                    <div 
                                        key={skill.id || index} 
                                        className="expertise-badge"
                                        style={{
                                            backgroundColor: skill.color_gradient || 'rgba(102, 126, 234, 0.1)',
                                            color: skill.text_color || '#0d9488',
                                            borderColor: skill.border_color || 'rgba(102, 126, 234, 0.2)'
                                        }}
                                    >
                                        <div className="expertise-skill">{skill.skill}</div>
                                        <div className="expertise-level">
                                            <span className={`level-badge level-${skill.proficiency_level.toLowerCase()}`}>
                                                {getProficiencyLabel(skill.proficiency_level)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Courses Section */}
                    {publishedCourses.length > 0 && (
                        <div className="instructor-profile-courses mb-5">
                            <h2 className="section-title">
                                <i className="fas fa-book section-icon"></i>
                                Kursus Instruktur ({publishedCourses.length})
                            </h2>
                            <div className="courses-grid">
                                {publishedCourses.map((course) => (
                                    <div key={course.id} className="course-card">
                                        <div className="course-image-wrapper">
                                            <img 
                                                src={getImageUrl(course.image) || '/images/placeholders/default-course.svg'}
                                                alt={course.title}
                                                className="course-image"
                                                onError={(e) => {
                                                    e.target.src = '/images/placeholders/default-course.svg';
                                                }}
                                            />
                                            {course.featured && (
                                                <div className="featured-badge">
                                                    <i className="fas fa-star"></i> Featured
                                                </div>
                                            )}
                                        </div>
                                        <div className="course-content">
                                            <h3 className="course-title">{course.title}</h3>
                                            <div className="course-info-row">
                                                <p className="course-level">
                                                    <span className={`level-badge level-${course.level.toLowerCase()}`}>
                                                        {getLevelText(course.level)}
                                                    </span>
                                                </p>
                                                <div className="course-rating">
                                                    <span className="rating-stars">
                                                        <i className="fas fa-star"></i> {course.average_rating || 0}
                                                    </span>
                                                    <span className="rating-count">
                                                        ({course.rating_count || 0})
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="course-footer">
                                            <a 
                                                href={`/course-detail/${course.slug}/`} 
                                                className="btn btn-sm btn-primary w-100"
                                            >
                                                Lihat Kursus
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reviews Section */}
                    {reviews.length > 0 && (
                        <div className="instructor-profile-reviews">
                            <h2 className="section-title">
                                <i className="fas fa-comments section-icon"></i>
                                Ulasan Siswa ({reviews.length})
                            </h2>
                            
                            {/* Rating Summary */}
                            <div className="rating-summary mb-4">
                                <div className="rating-main">
                                    <div className="rating-value">{averageRating}</div>
                                    <div className="rating-stars">
                                        {[...Array(5)].map((_, i) => (
                                            <i 
                                                key={i} 
                                                className={`fas fa-star ${i < Math.floor(averageRating) ? 'filled' : 'empty'}`}
                                            ></i>
                                        ))}
                                    </div>
                                    <div className="rating-count">Berdasarkan {reviews.length} ulasan</div>
                                </div>
                            </div>

                            {/* Reviews List */}
                            <div className="reviews-list">
                                {reviews.slice(0, 10).map((review) => (
                                    <div key={review.id} className="review-card">
                                        <div className="review-header">
                                            <div className="reviewer-info">
                                                <div className="reviewer-avatar">
                                                    {review.user?.image ? (
                                                        <img 
                                                            src={review.user.image} 
                                                            alt={review.user.full_name}
                                                            onError={(e) => {
                                                                e.target.src = '/images/placeholders/default-user.svg';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="default-avatar">
                                                            <i className="fas fa-user"></i>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h5 className="reviewer-name">{review.user?.full_name || 'Anonymous'}</h5>
                                                    <p className="review-course">{review.course?.title}</p>
                                                </div>
                                            </div>
                                            <div className="review-rating">
                                                <div className="rating-stars">
                                                    {[...Array(5)].map((_, i) => (
                                                        <i 
                                                            key={i} 
                                                            className={`fas fa-star ${i < review.rating ? 'filled' : 'empty'}`}
                                                        ></i>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="review-text">{review.review}</p>
                                        {review.reply && (
                                            <div className="instructor-reply">
                                                <div className="reply-label">Balasan Instruktur:</div>
                                                <p className="reply-text">{review.reply}</p>
                                            </div>
                                        )}
                                        <small className="review-date">
                                            {new Date(review.date).toLocaleDateString('id-ID', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </small>
                                    </div>
                                ))}
                            </div>

                            {reviews.length > 10 && (
                                <div className="text-center mt-4">
                                    <button className="btn btn-outline-primary">
                                        Lihat Semua Ulasan
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* No Content State */}
                    {courses.length === 0 && reviews.length === 0 && (
                        <div className="empty-state text-center py-5">
                            <i className="fas fa-inbox"></i>
                            <h3>Belum ada konten</h3>
                            <p>Instruktur ini belum memiliki kursus yang tersedia.</p>
                        </div>
                    )}
                </div>
            </section>
            
            <Footer />
        </>
    );
}

export default React.memo(InstructorProfilePage);
