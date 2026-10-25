import React from "react";
import dayjs from "../../../utils/dayjs";
import { Rating } from "react-simple-star-rating";
import "./CourseHero.css";
import { Link } from "react-router-dom";
import { getImageUrl } from "../../../utils/courseUtils";

const CourseHero = ({ course }) => {
    if (!course) return null;

    const teacherName = course.teacher?.full_name || course.user?.full_name || "Instruktur DPD RI";
    const teacherImage = getImageUrl(course.teacher?.image || course.user?.profile?.image);
    const formattedDate = course.date ? dayjs(course.date).format("DD MMMM YYYY") : null;

    return (
        <section className="course-hero-compact position-relative overflow-hidden">
            {/* Ambient Background Gradient & Mesh Pattern */}
            <div className="course-hero-bg-overlay position-absolute w-100 h-100 top-0 start-0" />
            <div className="course-hero-ambient-glow position-absolute" />
            
            <div className="container position-relative py-3 py-md-4" style={{ zIndex: 2 }}>
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

                            {course.target_audience === 'umum' ? (
                                <span className="hero-badge hero-badge-audience-public" title="Kursus terbuka untuk umum">
                                    <i className="fas fa-globe me-1"></i>
                                    Terbuka untuk Umum
                                </span>
                            ) : (
                                <span className="hero-badge hero-badge-audience-internal" title="Pelatihan kedinasan internal Setjen DPD RI">
                                    <i className="fas fa-id-card-clip me-1"></i>
                                    Khusus Pegawai Setjen DPD RI
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
                                <span>{course.students?.length || 0} Siswa</span>
                            </div>

                            {/* Total Curriculum / Lessons */}
                            <div className="d-flex align-items-center small">
                                <i className="fas fa-book-open me-1 text-white-50"></i>
                                <span>{course.curriculum?.length || 0} Modul</span>
                                <span className="mx-1 opacity-50">•</span>
                                <span>{course.lectures?.length || 0} Materi</span>
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
        </section>
    );
};

export default CourseHero;