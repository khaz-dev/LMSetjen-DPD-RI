import React, { memo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { moment } from "../utils/dayjs";
import { 
    getImageUrl, 
    getLevelBadgeStyle, 
    getLevelText, 
    getActualCourseStatus 
} from "../utils/courseUtils.js";
import { calculateTotalDuration, parseDurationToSeconds } from "../utils/durationUtils";
import useAxios from "../utils/useAxios";
import Toast from "../views/plugin/Toast";

import "./CourseCard.css";

const CourseCard = ({ course, _index, viewMode = "grid" }) => {
    const navigate = useNavigate();
    const [editingCourse, setEditingCourse] = useState(false);

    // Calculate course completion
    const hasCurriculum = course.curriculum?.length > 0;
    const hasLessons = course.curriculum?.some(variant => variant.items?.length > 0);
    
    // Quizzes check
    const hasQuiz = (() => {
        if (!course.quizzes) return false;
        if (typeof course.quizzes === "number") {
            return course.quizzes > 0;
        }
        if (Array.isArray(course.quizzes)) {
            return course.quizzes.length > 0;
        }
        if (typeof course.quizzes === "object") {
            const quizList = Object.values(course.quizzes);
            return quizList.length > 0;
        }
        return false;
    })();
    
    // Calculate progress percentage
    const calculateProgress = () => {
        let completed = 0;
        const total = 4;
        
        if (course.title && course.description) completed++; // Basic info
        if (hasCurriculum) completed++; // Has curriculum
        if (hasLessons) completed++; // Has lessons
        if (hasQuiz) completed++; // Has quiz
        
        return Math.round((completed / total) * 100);
    };
    
    const progress = calculateProgress();
    
    // Calculate total JP (Jam Pelajaran) from course lectures (1 JP = 45 mins)
    const calculateTotalJP = (lectures) => {
        if (!lectures || !Array.isArray(lectures)) return 0;
        
        let totalSeconds = 0;
        lectures.forEach(lecture => {
            if (lecture.content_duration) {
                totalSeconds += parseDurationToSeconds(lecture.content_duration);
            }
        });
        
        return Math.ceil(totalSeconds / 2700);
    };
    
    // Check if this is a published course
    const isPublished = course.is_published_version === true;
    
    // Edit button - creates draft automatically for published courses
    const handleEditCourse = async (e) => {
        if (e) e.preventDefault();
        
        try {
            if (isPublished) {
                setEditingCourse(true);
                const response = await useAxios.post(`teacher/course-edit-published/${course.course_id}/`);
                
                if (response.data?.success) {
                    const draftCourseId = response.data.course?.course_id;
                    const isNew = response.data.is_new;
                    
                    if (isNew) {
                        Toast().fire({
                            icon: "success",
                            title: "Draft Berhasil Dibuat",
                            text: "Anda sekarang dapat mengedit kursus ini"
                        });
                    }
                    
                    setTimeout(() => {
                        navigate(`/instructor/edit-course/${draftCourseId}/`);
                    }, 400);
                } else {
                    Toast().fire({
                        icon: "error",
                        title: "Error",
                        text: response.data?.message || "Gagal membuat draft kursus"
                    });
                }
            } else {
                navigate(`/instructor/edit-course/${course.course_id}/`);
            }
        } catch (error) {
            console.error("Error editing course:", error);
            Toast().fire({
                icon: "error",
                title: "Error",
                text: "Gagal membuka editor kursus. Silakan coba lagi."
            });
        } finally {
            setEditingCourse(false);
        }
    };
    
    // Get actual course status
    const courseStatus = getActualCourseStatus(course);
    
    // Determine next step
    const getNextStep = () => {
        if (!hasCurriculum) {
            return {
                label: "Tambah Kurikulum",
                icon: "fa-list-check",
                link: `/instructor/edit-course/${course.course_id}/curriculum/`,
                color: "#0f766e"
            };
        }
        if (!hasLessons) {
            return {
                label: "Tambah Pelajaran",
                icon: "fa-play-circle",
                link: `/instructor/edit-course/${course.course_id}/curriculum/`,
                color: "#0284c7"
            };
        }
        if (!hasQuiz) {
            return {
                label: "Tambah Kuis",
                icon: "fa-question-circle",
                link: `/instructor/edit-course/${course.course_id}/quiz/`,
                color: "#d97706"
            };
        }
        return {
            label: "Siap Dipublikasikan",
            icon: "fa-check-circle",
            link: `/instructor/edit-course/${course.course_id}/`,
            color: "#16a34a"
        };
    };
    
    const nextStep = getNextStep();
    const studentsCount = course.students?.length || 0;
    const lecturesCount = course.lectures?.length || 0;
    const durationInfo = lecturesCount > 0 ? calculateTotalDuration(course.lectures) : null;
    const totalJP = lecturesCount > 0 ? calculateTotalJP(course.lectures) : 0;

    // ==========================================
    // LIST VIEW MODE (Compact Horizontal Row)
    // ==========================================
    if (viewMode === "list") {
        return (
            <div className="col-12 mb-2">
                <div className="modern-course-card modern-course-card-list">
                    {/* Thumbnail */}
                    <div className="list-thumbnail-box" onClick={handleEditCourse}>
                        <img
                            src={getImageUrl(course.image)}
                            alt={course.title || "Course"}
                            className="list-course-thumb"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                                e.target.src = "/images/placeholders/default-course.svg";
                            }}
                        />
                        <span 
                            className="list-thumb-status-badge"
                            style={{ background: courseStatus.color }}
                            title={courseStatus.text}
                        >
                            <i className={`fas ${courseStatus.icon}`}></i>
                        </span>
                    </div>

                    {/* Middle Info */}
                    <div className="list-course-body">
                        <div className="list-meta-chips">
                            <span 
                                className="badge level-badge-sm" 
                                style={{ background: getLevelBadgeStyle(course.level) }}
                            >
                                {getLevelText(course.level)}
                            </span>
                            <span className="course-meta-tag category-tag">
                                <i className="fas fa-folder-open me-1"></i>
                                {course.category?.title || "Umum"}
                            </span>
                            <span className="course-meta-tag students-tag">
                                <i className="fas fa-user-graduate me-1"></i>
                                {studentsCount} Siswa
                            </span>
                            {totalJP > 0 && (
                                <span className="course-meta-tag duration-tag">
                                    <i className="fas fa-clock me-1"></i>
                                    {durationInfo?.formatted} ({totalJP} JP)
                                </span>
                            )}
                            <span className="course-meta-tag date-tag">
                                <i className="far fa-calendar-alt me-1"></i>
                                {course.date ? moment(course.date).format("DD MMM YYYY") : "Baru"}
                            </span>
                        </div>

                        <h4 
                            className="course-title list-course-title mb-1" 
                            title={course.title}
                            onClick={handleEditCourse}
                        >
                            {course.title || "Kursus Tanpa Judul"}
                        </h4>

                        {/* Progress for Draft */}
                        {!isPublished && courseStatus.status === "Draft" && (
                            <div className="list-progress-wrapper">
                                <div className="list-progress-track">
                                    <div 
                                        className="list-progress-fill" 
                                        style={{ width: `${progress}%`, background: nextStep.color }}
                                    ></div>
                                </div>
                                <span className="list-progress-label" style={{ color: nextStep.color }}>
                                    <i className={`fas ${nextStep.icon} me-1`}></i>
                                    {progress}% • {nextStep.label}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Right Actions */}
                    <div className="list-course-actions">
                        <span 
                            className="status-pill-badge"
                            style={{ 
                                color: courseStatus.color,
                                backgroundColor: `${courseStatus.color}15`,
                                borderColor: `${courseStatus.color}35`
                            }}
                        >
                            <i className={`fas ${courseStatus.icon} me-1`}></i>
                            {courseStatus.text}
                        </span>

                        <div className="d-flex align-items-center gap-1.5 mt-2">
                            <button 
                                className="btn course-action-btn course-action-btn-sm btn-edit"
                                onClick={handleEditCourse}
                                disabled={editingCourse}
                                title="Edit Kursus"
                            >
                                <i className={`fas ${editingCourse ? "fa-spinner fa-spin" : "fa-pen-to-square"} me-1`}></i>
                                {editingCourse ? "Membuka..." : "Edit"}
                            </button>
                            
                            <button 
                                className="btn course-action-btn course-action-btn-sm btn-view"
                                onClick={() => window.open(`/course-detail/${course.slug}/`, "_blank")}
                                title="Pratinjau Kursus"
                            >
                                <i className="fas fa-eye me-1"></i>
                                Lihat
                            </button>

                            <Link
                                to={`/instructor/edit-course/${course.course_id}/curriculum/`}
                                className="btn course-action-btn course-action-btn-sm btn-curriculum"
                                title="Kurikulum Kursus"
                            >
                                <i className="fas fa-layer-group"></i>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // GRID VIEW MODE (Compact Modern Card)
    // ==========================================
    return (
        <div className="col-xl-6 col-lg-6 col-md-12 mb-3">
            <div className="modern-course-card modern-course-card-grid">
                {/* Thumbnail Header */}
                <div className="course-image-container" onClick={handleEditCourse}>
                    <img
                        src={getImageUrl(course.image)}
                        alt={course.title || "Course"}
                        className="course-image"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                            e.target.src = "/images/placeholders/default-course.svg";
                        }}
                    />

                    {/* Gradient overlay for text & badge contrast */}
                    <div className="course-image-overlay"></div>

                    {/* Top Badges */}
                    <div className="course-card-top-badges">
                        <span 
                            className="badge level-badge" 
                            style={{ background: getLevelBadgeStyle(course.level) }}
                        >
                            {getLevelText(course.level)}
                        </span>
                        
                        <span 
                            className="badge status-badge" 
                            style={{ background: courseStatus.color }}
                        >
                            <i className={`fas ${courseStatus.icon} me-1`}></i>
                            {courseStatus.text}
                        </span>
                    </div>

                    {/* Bottom overlay badge: Duration / JP */}
                    {totalJP > 0 && (
                        <div className="course-card-bottom-badge">
                            <span className="course-jp-chip">
                                <i className="fas fa-clock me-1"></i>
                                {durationInfo?.formatted} ({totalJP} JP)
                            </span>
                        </div>
                    )}
                </div>

                {/* Content Body */}
                <div className="course-content">
                    {/* Meta Row: Category, Students, Date */}
                    <div className="course-meta-row">
                        <span className="course-meta-tag category-tag">
                            <i className="fas fa-folder-open me-1"></i>
                            {course.category?.title || "Umum"}
                        </span>
                        <span className="course-meta-tag students-tag">
                            <i className="fas fa-user-graduate me-1"></i>
                            {studentsCount} Siswa
                        </span>
                        <span className="course-meta-tag date-tag">
                            <i className="far fa-calendar-alt me-1"></i>
                            {course.date ? moment(course.date).format("DD MMM YYYY") : "Baru"}
                        </span>
                    </div>

                    {/* Course Title */}
                    <h4 
                        className="course-title" 
                        title={course.title}
                        onClick={handleEditCourse}
                    >
                        {course.title || "Kursus Tanpa Judul"}
                    </h4>

                    {/* Progress Indicator for Draft Courses */}
                    {!isPublished && courseStatus.status === "Draft" && (
                        <div className="course-draft-progress-box">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="draft-progress-text">
                                    <i className="fas fa-tasks me-1"></i>
                                    Kelengkapan Modul
                                </span>
                                <span className="draft-progress-value" style={{ color: nextStep.color }}>
                                    {progress}%
                                </span>
                            </div>
                            <div className="progress course-progress-track">
                                <div 
                                    className="progress-bar" 
                                    role="progressbar" 
                                    style={{ 
                                        width: `${progress}%`,
                                        background: `linear-gradient(90deg, ${nextStep.color} 0%, ${nextStep.color}dd 100%)`,
                                    }}
                                    aria-valuenow={progress} 
                                    aria-valuemin="0" 
                                    aria-valuemax="100"
                                ></div>
                            </div>
                            <Link 
                                to={nextStep.link} 
                                className="draft-next-step-link"
                                style={{ color: nextStep.color, borderColor: `${nextStep.color}40` }}
                            >
                                <span className="d-flex align-items-center gap-1.5 text-truncate">
                                    <i className={`fas ${nextStep.icon}`}></i>
                                    <span>{nextStep.label}</span>
                                </span>
                                <i className="fas fa-chevron-right ms-auto"></i>
                            </Link>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="course-actions">
                        <button 
                            className="btn course-action-btn course-action-btn-sm btn-edit flex-fill"
                            onClick={handleEditCourse}
                            disabled={editingCourse}
                            title="Edit konten kursus"
                        >
                            <i className={`fas ${editingCourse ? "fa-spinner fa-spin" : "fa-pen-to-square"} me-1.5`}></i>
                            {editingCourse ? "Membuka..." : "Edit Kursus"}
                        </button>
                        
                        <button 
                            className="btn course-action-btn course-action-btn-sm btn-view"
                            onClick={() => window.open(`/course-detail/${course.slug}/`, "_blank")}
                            title="Buka halaman publik kursus"
                        >
                            <i className="fas fa-eye me-1"></i>
                            Lihat
                        </button>

                        <Link
                            to={`/instructor/edit-course/${course.course_id}/curriculum/`}
                            className="btn course-action-btn course-action-btn-sm btn-curriculum"
                            title="Kelola Kurikulum & Materi"
                        >
                            <i className="fas fa-layer-group"></i>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(CourseCard);