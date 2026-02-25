import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiInstance from "../../utils/axios";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import AdminHeader from "../partials/AdminHeader";
import { getImageUrl, getLevelText } from "../../utils/courseUtils";
import "./AdminCourseReviewDetail.css";

/**
 * Admin Course Review Detail Page
 * ✨ PHASE 4.37+: Full course review page for comprehensive admin evaluation
 * 
 * Displays:
 * - Complete course information
 * - Full curriculum with all sections and lectures
 * - Course quizzes
 * - Course images and videos
 * - Approval/rejection controls
 */

/**
 * ✨ PHASE 4.53 FIX: Convert embed/preview URLs to viewable URLs for new tab view
 * Embed URLs (youtube-nocookie.com/embed, drive.google.com/file/d/ID/preview) 
 * are meant for iframes only - they fail when opened directly in browser tabs
 */
const convertEmbedUrlToViewable = (fileUrl, videoSource) => {
    if (!fileUrl) return null;
    
    if (videoSource === "youtube") {
        // Extract video ID from embed URL: https://www.youtube-nocookie.com/embed/VIDEO_ID?...
        const youtubeMatch = fileUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
        if (youtubeMatch?.[1]) {
            return `https://www.youtube.com/watch?v=${youtubeMatch[1]}`;
        }
    } else if (videoSource === "google_drive") {
        // Extract file ID from preview URL: https://drive.google.com/file/d/FILE_ID/preview
        const driveMatch = fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (driveMatch?.[1]) {
            return `https://drive.google.com/file/d/${driveMatch[1]}/view`;
        }
    }
    
    // For upload or unknown sources, use URL as-is
    return fileUrl;
};

function AdminCourseReviewDetail() {
    const { course_id } = useParams();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [course, setCourse] = useState(null);
    const [expandedSections, setExpandedSections] = useState({});
    const [expandedQuizzes, setExpandedQuizzes] = useState({});
    const [approving, setApproving] = useState(false);

    useEffect(() => {
        fetchCourseDetail();
    }, [course_id]);

    const fetchCourseDetail = async () => {
        try {
            setLoading(true);
            const response = await apiInstance.get(`teacher/course-detail/${course_id}/`);
            console.log("[AdminCourseReviewDetail] Course data:", response.data);
            setCourse(response.data);
        } catch (error) {
            console.error("Error fetching course detail:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat detail kursus",
                text: error.response?.data?.detail || "Terjadi kesalahan saat memuat data"
            });
            setTimeout(() => navigate("/admin/content-management/?tab=courses"), 2000);
        } finally {
            setLoading(false);
        }
    };

    const toggleSection = (sectionId) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };

    const toggleQuiz = (quizId) => {
        setExpandedQuizzes(prev => ({
            ...prev,
            [quizId]: !prev[quizId]
        }));
    };

    const handleApproveCourse = async () => {
        const result = await Swal.fire({
            title: `Setujui Kursus "${course.title}"?`,
            html: `
                <div class="text-start">
                    <p>Instruktur: <strong>${course.teacher?.full_name || "Unknown"}</strong></p>
                    <p>Kategori: <strong>${course.category?.title || "N/A"}</strong></p>
                    <p class="text-muted small">Kursus ini akan dipublikasikan dan tersedia untuk siswa.</p>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#4CAF50",
            cancelButtonColor: "#d33",
            confirmButtonText: "Ya, Setujui",
            cancelButtonText: "Batal"
        });

        if (result.isConfirmed) {
            try {
                setApproving(true);
                await apiInstance.post(`/admin/course-approval/${course.course_id}/`, {
                    action: "approve"
                });
                
                Toast().fire({
                    icon: "success",
                    title: "Kursus Disetujui",
                    text: `"${course.title}" telah disetujui dan dipublikasikan`
                });
                
                setTimeout(() => navigate("/admin/content-management/?tab=courses"), 1500);
            } catch (error) {
                Toast().fire({
                    icon: "error",
                    title: "Gagal menyetujui kursus",
                    text: error.response?.data?.detail || "Terjadi kesalahan"
                });
            } finally {
                setApproving(false);
            }
        }
    };

    const handleRejectCourse = async () => {
        const { value: reason } = await Swal.fire({
            title: `Tolak Kursus "${course.title}"?`,
            input: "textarea",
            inputLabel: "Alasan Penolakan",
            inputPlaceholder: "Jelaskan mengapa kursus ini ditolak dan apa yang perlu diperbaiki...",
            inputAttributes: {
                "aria-label": "Alasan penolakan"
            },
            showCancelButton: true,
            confirmButtonColor: "#dc3545",
            cancelButtonColor: "#6c757d",
            confirmButtonText: "Ya, Tolak Kursus",
            cancelButtonText: "Batal",
            inputValidator: (value) => {
                if (!value || value.trim().length < 10) {
                    return "Alasan penolakan harus setidaknya 10 karakter!";
                }
            }
        });

        if (reason) {
            try {
                setApproving(true);
                await apiInstance.post(`/admin/course-approval/${course.course_id}/`, {
                    action: "reject",
                    rejection_reason: reason
                });
                
                Toast().fire({
                    icon: "success",
                    title: "Kursus Ditolak",
                    text: `"${course.title}" telah ditolak dan instruktur dapat melihat alasan`
                });
                
                setTimeout(() => navigate("/admin/content-management/?tab=courses"), 1500);
            } catch (error) {
                Toast().fire({
                    icon: "error",
                    title: "Gagal menolak kursus",
                    text: error.response?.data?.detail || "Terjadi kesalahan"
                });
            } finally {
                setApproving(false);
            }
        }
    };

    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="admin-dashboard pt-5 pb-5">
                    <div className="container">
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Memuat...</span>
                            </div>
                            <p className="mt-3 text-muted">Memuat detail kursus...</p>
                        </div>
                    </div>
                </section>
            </>
        );
    }

    if (!course) {
        return (
            <>
                <BaseHeader />
                <section className="admin-dashboard pt-5 pb-5">
                    <div className="container">
                        <div className="alert alert-danger text-center">
                            <i className="fas fa-exclamation-circle me-2"></i>
                            Kursus tidak ditemukan
                        </div>
                        <div className="text-center">
                            <button 
                                className="btn btn-primary"
                                onClick={() => navigate("/admin/content-management/?tab=courses")}
                            >
                                <i className="fas fa-arrow-left me-2"></i>
                                Kembali ke Review Kursus
                            </button>
                        </div>
                    </div>
                </section>
            </>
        );
    }

    return (
        <>
            <BaseHeader />
            <section className="admin-dashboard pt-5 pb-5">
                <div className="container">
                    <AdminHeader />
                    
                    <div className="acrd-container">
                        {/* Header with Back Button and Title */}
                        <div className="acrd-header mb-4">
                            <button 
                                className="btn btn-outline-secondary"
                                onClick={() => navigate("/admin/content-management/?tab=courses")}
                                title="Kembali ke daftar review"
                            >
                                <i className="fas fa-arrow-left me-2"></i>
                                Kembali
                            </button>
                            <h1 className="acrd-title">
                                <i className="fas fa-eye me-2"></i>
                                Review Detail Kursus
                            </h1>
                        </div>

                        {/* Course Header Card */}
                        <div className="acrd-card acrd-course-header mb-4">
                            
                            <div className="row">
                                <div className="col-lg-3 mb-3 mb-lg-0">
                                    <img
                                        src={getImageUrl(course.image)}
                                        alt={course.title}
                                        className="acrd-course-image"
                                        onError={(e) => {
                                            e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                        }}
                                    />
                                </div>
                                <div className="col-lg-9">
                                    <div className="acrd-course-info">
                                        <h2 className="acrd-course-title">{course.title}</h2>
                                        
                                        <div className="acrd-meta-row mb-3">
                                            <div className="acrd-meta-item">
                                                <i className="fas fa-user me-2 text-primary"></i>
                                                <strong>Instruktur:</strong>
                                                <span className="ms-2">{course.teacher?.full_name || "Unknown"}</span>
                                            </div>
                                            <div className="acrd-meta-item">
                                                <i className="fas fa-tag me-2 text-info"></i>
                                                <strong>Kategori:</strong>
                                                <span className="ms-2">{course.category?.title || "N/A"}</span>
                                            </div>
                                            <div className="acrd-meta-item">
                                                <i className="fas fa-graduation-cap me-2 text-success"></i>
                                                <strong>Tingkat:</strong>
                                                <span className="ms-2">{getLevelText(course.level)}</span>
                                            </div>
                                        </div>

                                        {course.review_submitted_date && (
                                            <div className="text-muted small mb-3">
                                                <i className="fas fa-calendar-alt me-1"></i>
                                                Diajukan: {new Date(course.review_submitted_date).toLocaleDateString('id-ID', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                        )}

                                        <div className="acrd-course-stats mb-3">
                                            <div className="acrd-stat">
                                                <div className="acrd-stat-number">{course.curriculum?.length || 0}</div>
                                                <div className="acrd-stat-label">Bagian</div>
                                            </div>
                                            <div className="acrd-stat">
                                                <div className="acrd-stat-number">{course.lectures?.length || 0}</div>
                                                <div className="acrd-stat-label">Pelajaran</div>
                                            </div>
                                            <div className="acrd-stat">
                                                <div className="acrd-stat-number">{course.quizzes?.length || 0}</div>
                                                <div className="acrd-stat-label">Kuis</div>
                                            </div>
                                        </div>

                                        {course.average_rating > 0 && (
                                            <div className="acrd-ratings mb-3">
                                                <i className="fas fa-star text-warning me-1"></i>
                                                <strong>{course.average_rating.toFixed(1)}</strong>
                                                <span className="text-muted ms-2">({course.rating_count} ulasan)</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Video Pengantar Kursus */}
                        {course.intro_video_source && (
                            <div className="acrd-card mb-4">
                                <h3 className="acrd-section-title">
                                    <i className="fas fa-video me-2"></i>
                                    Video Pengantar Kursus
                                </h3>
                                <div className="acrd-intro-video">
                                    {course.intro_video_source === "youtube" ? (
                                        <div className="acrd-video-container">
                                            <i className="fab fa-youtube text-danger me-2"></i>
                                            <strong>Sumber:</strong>
                                            <span className="ms-2">YouTube</span>
                                        </div>
                                    ) : course.intro_video_source === "google_drive" ? (
                                        <div className="acrd-video-container">
                                            <i className="fab fa-google text-info me-2"></i>
                                            <strong>Sumber:</strong>
                                            <span className="ms-2">Google Drive</span>
                                        </div>
                                    ) : (
                                        <div className="acrd-video-container">
                                            <i className="fas fa-upload text-primary me-2"></i>
                                            <strong>Sumber:</strong>
                                            <span className="ms-2">Upload</span>
                                        </div>
                                    )}
                                    {course.file && (
                                        <div className="mt-3">
                                            <a 
                                                href={convertEmbedUrlToViewable(course.file, course.intro_video_source)}
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="acrd-video-link"
                                            >
                                                <i className="fas fa-external-link-alt me-1"></i>
                                                Lihat Video Pengantar
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Additional Information - Moved here after course header */}
                        <div className="acrd-card mb-4">
                            <h3 className="acrd-section-title">
                                <i className="fas fa-info-circle me-2"></i>
                                Informasi Tambahan
                            </h3>
                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <div className="acrd-info-box">
                                        <strong>ID Kursus:</strong>
                                        <p className="text-monospace">{course.course_id}</p>
                                    </div>
                                </div>
                                <div className="col-md-6 mb-3">
                                    <div className="acrd-info-box">
                                        <strong>Slug:</strong>
                                        <p className="text-monospace">{course.slug}</p>
                                    </div>
                                </div>
                                <div className="col-md-6 mb-3">
                                    <div className="acrd-info-box">
                                        <strong>Status Platform:</strong>
                                        <p><span className="badge bg-warning">{course.platform_status || "N/A"}</span></p>
                                    </div>
                                </div>
                                <div className="col-md-6 mb-3">
                                    <div className="acrd-info-box">
                                        <strong>Status Instruktur:</strong>
                                        <p><span className="badge bg-info">{course.teacher_course_status || "N/A"}</span></p>
                                    </div>
                                </div>
                            </div>

                            {course.rejection_reason && (
                                <div className="alert alert-danger mt-3">
                                    <h6 className="alert-heading">
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        Alasan Penolakan Sebelumnya
                                    </h6>
                                    <p className="mb-0">{course.rejection_reason}</p>
                                </div>
                            )}
                        </div>
                        <div className="acrd-card mb-4">
                            <h3 className="acrd-section-title">
                                <i className="fas fa-file-alt me-2"></i>
                                Deskripsi Kursus
                            </h3>
                            <div 
                                className="acrd-description"
                                dangerouslySetInnerHTML={{ __html: course.description || "Deskripsi kursus tidak tersedia." }}
                            />
                        </div>

                        {/* Course Features - ✨ PHASE 4.85 */}
                        {course.features && course.features.length > 0 && (
                            <div className="acrd-card mb-4">
                                <h3 className="acrd-section-title">
                                    <i className="fas fa-star me-2"></i>
                                    Kursus ini Termasuk ({course.features.length})
                                </h3>
                                <div className="acrd-features-list">
                                    {course.features.map((feature, idx) => (
                                        <div key={feature.id} className="acrd-feature-item">
                                            {feature.icon && <i className={`${feature.icon} me-2`}></i>}
                                            {!feature.icon && <i className="fas fa-check-circle text-success me-2"></i>}
                                            <span>{feature.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Course Requirements - ✨ PHASE 4.85 */}
                        {course.requirements && course.requirements.length > 0 && (
                            <div className="acrd-card mb-4">
                                <h3 className="acrd-section-title">
                                    <i className="fas fa-tasks me-2"></i>
                                    Persyaratan ({course.requirements.length})
                                </h3>
                                <div className="acrd-requirements-list">
                                    {course.requirements.map((requirement, idx) => (
                                        <div key={requirement.id} className="acrd-requirement-item">
                                            <div className="acrd-requirement-number">{idx + 1}</div>
                                            <span>{requirement.requirement}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Learning Outcomes - ✨ PHASE 4.85 */}
                        {course.learning_outcomes && course.learning_outcomes.length > 0 && (
                            <div className="acrd-card mb-4">
                                <h3 className="acrd-section-title">
                                    <i className="fas fa-graduation-cap me-2"></i>
                                    Hasil Pembelajaran ({course.learning_outcomes.length})
                                </h3>
                                <div className="acrd-outcomes-list">
                                    {course.learning_outcomes.map((outcome, idx) => (
                                        <div key={outcome.id} className="acrd-outcome-item">
                                            <i className="fas fa-bullseye text-info me-2"></i>
                                            <span>{outcome.outcome}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Curriculum & Lectures */}
                        {course.curriculum && course.curriculum.length > 0 && (
                            <div className="acrd-card mb-4">
                                <h3 className="acrd-section-title">
                                    <i className="fas fa-book me-2"></i>
                                    Kurikulum ({course.curriculum.length} Bagian)
                                </h3>
                                <div className="acrd-curriculum">
                                    {course.curriculum.map((section, idx) => (
                                        <div key={section.variant_id} className="acrd-section mb-3">
                                            <button
                                                className="acrd-section-header"
                                                onClick={() => toggleSection(section.variant_id)}
                                            >
                                                <span className="acrd-section-num">Bagian {idx + 1}</span>
                                                <span className="acrd-section-name">{section.title}</span>
                                                <i className={`fas fa-chevron-down ms-auto transition-icon ${expandedSections[section.variant_id] ? 'expanded' : ''}`}></i>
                                            </button>
                                            
                                            {expandedSections[section.variant_id] && section.variant_items && (
                                                <div className="acrd-section-content">
                                                    {section.variant_items.length === 0 ? (
                                                        <div className="acrd-empty-message">
                                                            <i className="fas fa-inbox me-2"></i>
                                                            Tidak ada pelajaran dalam bagian ini
                                                        </div>
                                                    ) : (
                                                        <ul className="acrd-lectures-list">
                                                            {section.variant_items.map((lecture, lectureIdx) => (
                                                                <li key={lecture.variant_item_id} className="acrd-lecture-item">
                                                                    <div className="acrd-lecture-header">
                                                                        <span className="acrd-lecture-num">
                                                                            {lectureIdx + 1}. {lecture.title}
                                                                        </span>
                                                                        <div className="acrd-lecture-meta">
                                                                            <span className="acrd-lecture-type">
                                                                                {lecture.file_type === "video" || lecture.file_type?.includes('video') ? (
                                                                                    <>
                                                                                        <i className="fas fa-video me-1"></i>
                                                                                        Video
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <i className={`${lecture.file_icon || 'fas fa-file'} me-1`}></i>
                                                                                        {lecture.file_type ? lecture.file_type.charAt(0).toUpperCase() + lecture.file_type.slice(1) : 'Dokumen'}
                                                                                    </>
                                                                                )}
                                                                            </span>
                                                                            {/* ✨ PHASE 4.142: Display content duration */}
                                                                            {lecture.duration_seconds && lecture.duration_seconds > 0 && (
                                                                                <span className="acrd-lecture-duration">
                                                                                    <i className="fas fa-hourglass-half me-1"></i>
                                                                                    {Math.floor(lecture.duration_seconds / 60)}:{String(Math.floor(lecture.duration_seconds % 60)).padStart(2, '0')}
                                                                                </span>
                                                                            )}
                                                                            {lecture.content_duration && !lecture.duration_seconds && (
                                                                                <span className="acrd-lecture-duration">
                                                                                    <i className="fas fa-hourglass-half me-1"></i>
                                                                                    {lecture.content_duration}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {lecture.description && (
                                                                        <p className="acrd-lecture-detail">{lecture.description}</p>
                                                                    )}
                                                                    {lecture.file && (
                                                                        <div className="acrd-lecture-video">
                                                                            {lecture.file_type === "video" || lecture.file_type?.includes('video') ? (
                                                                                <a 
                                                                                    href={lecture.file} 
                                                                                    target="_blank" 
                                                                                    rel="noopener noreferrer"
                                                                                    className="acrd-video-link"
                                                                                >
                                                                                    <i className="fas fa-external-link-alt me-1"></i>
                                                                                    Lihat Video
                                                                                </a>
                                                                            ) : (
                                                                                <a 
                                                                                    href={lecture.file} 
                                                                                    target="_blank" 
                                                                                    rel="noopener noreferrer"
                                                                                    className="acrd-video-link"
                                                                                >
                                                                                    <i className="fas fa-download me-1"></i>
                                                                                    Download
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {/* ✨ PHASE 4.143: Display lesson completion question */}
                                                                    {lecture.completion_question && (
                                                                        <div className="acrd-completion-question mt-3 p-2 bg-light rounded border-start border-success">
                                                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                                                <i className="fas fa-question-circle text-success"></i>
                                                                                <span className="fw-bold">Pertanyaan Penyelesaian Pelajaran</span>
                                                                                <span className="badge bg-success ms-auto">{lecture.completion_question.question_type_display}</span>
                                                                            </div>
                                                                            <p className="mb-2"><strong>Q:</strong> {lecture.completion_question.question_text}</p>
                                                                            {lecture.completion_question.choices && lecture.completion_question.choices.length > 0 && (
                                                                                <div className="ms-3">
                                                                                    <small className="text-muted">Pilihan:</small>
                                                                                    <ul className="mb-0 mt-1" style={{ fontSize: '0.9rem' }}>
                                                                                        {lecture.completion_question.choices.map((choice, idx) => (
                                                                                            <li key={idx}>
                                                                                                {choice.choice_text}
                                                                                                {choice.is_correct && <i className="fas fa-check text-success ms-2"></i>}
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                </div>
                                                                            )}
                                                                            {lecture.completion_question.correct_answer_text && (
                                                                                <p className="mb-0 mt-2">
                                                                                    <small><strong>A:</strong> {lecture.completion_question.correct_answer_text}</small>
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quizzes */}
                        {course.quizzes && course.quizzes.length > 0 && (
                            <div className="acrd-card mb-4">
                                <h3 className="acrd-section-title">
                                    <i className="fas fa-list-check me-2"></i>
                                    Kuis ({course.quizzes.length})
                                </h3>
                                <div className="acrd-quizzes-list">
                                    {course.quizzes.map((quiz, idx) => (
                                        <div key={quiz.quiz_id} className="acrd-quiz-item">
                                            <button
                                                className="acrd-quiz-header-btn"
                                                onClick={() => toggleQuiz(quiz.quiz_id)}
                                            >
                                                <span className="acrd-quiz-num">Kuis {idx + 1}</span>
                                                <span className="acrd-quiz-title">{quiz.title || "Kuis Tanpa Judul"}</span>
                                                {quiz.is_active !== undefined && (
                                                    <span className={`badge ${quiz.is_active ? 'bg-success' : 'bg-secondary'}`}>
                                                        {quiz.is_active ? 'Aktif' : 'Nonaktif'}
                                                    </span>
                                                )}
                                                <i className={`fas fa-chevron-down transition-icon ${expandedQuizzes[quiz.quiz_id] ? 'expanded' : ''}`}></i>
                                            </button>
                                            
                                            {expandedQuizzes[quiz.quiz_id] && (
                                                <div className="acrd-quiz-content">
                                                    {quiz.description && (
                                                        <div className="alert alert-info mb-3">
                                                            <strong>Deskripsi:</strong> {quiz.description}
                                                        </div>
                                                    )}
                                                    <div className="acrd-quiz-stats mb-4">
                                                        <span className="badge bg-primary">
                                                            <i className="fas fa-question-circle me-1"></i>
                                                            Jumlah Pertanyaan: {quiz.total_questions || 0}
                                                        </span>
                                                    </div>

                                                    {/* Questions and Answers */}
                                                    {quiz.questions && quiz.questions.length > 0 ? (
                                                        <div className="acrd-quiz-questions">
                                                            <h5 className="mb-3"><i className="fas fa-list me-2"></i>Detail Pertanyaan & Jawaban</h5>
                                                            {quiz.questions.map((question, qIdx) => (
                                                                <div key={question.question_id} className="acrd-question-item mb-4">
                                                                    <div className="acrd-question-header">
                                                                        <span className="acrd-question-num">Pertanyaan {qIdx + 1}</span>
                                                                        <p className="acrd-question-text">{question.question_text}</p>
                                                                    </div>
                                                                    <div className="acrd-choices">
                                                                        {question.choices && question.choices.length > 0 ? (
                                                                            question.choices.map((choice, cIdx) => (
                                                                                <div
                                                                                    key={choice.choice_id}
                                                                                    className={`acrd-choice-item ${choice.is_correct ? 'correct' : ''}`}
                                                                                >
                                                                                    <div className="acrd-choice-indicator">
                                                                                        {choice.is_correct ? (
                                                                                            <i className="fas fa-check-circle text-success"></i>
                                                                                        ) : (
                                                                                            <i className="fas fa-circle text-muted"></i>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="acrd-choice-content">
                                                                                        <div className="acrd-choice-letter">{String.fromCharCode(65 + cIdx)}.</div>
                                                                                        <div className="acrd-choice-text">{choice.choice_text}</div>
                                                                                        {choice.is_correct && (
                                                                                            <span className="badge bg-success ms-2">Jawaban Benar</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            <p className="text-muted text-center py-2">
                                                                                <i className="fas fa-inbox me-2"></i>
                                                                                Tidak ada pilihan jawaban
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="alert alert-warning">
                                                            <i className="fas fa-exclamation-triangle me-2"></i>
                                                            Tidak ada pertanyaan dalam kuis ini
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="acrd-card acrd-actions mb-4">
                            <h3 className="acrd-section-title mb-4">
                                <i className="fas fa-check-square me-2"></i>
                                Tindakan Review
                            </h3>
                            <div className="d-grid gap-3 d-md-flex justify-content-center">
                                <button
                                    className="btn btn-success btn-lg"
                                    onClick={handleApproveCourse}
                                    disabled={approving}
                                >
                                    {approving ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Memproses...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-check me-2"></i>
                                            Setujui Kursus
                                        </>
                                    )}
                                </button>
                                <button
                                    className="btn btn-danger btn-lg"
                                    onClick={handleRejectCourse}
                                    disabled={approving}
                                >
                                    {approving ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Memproses...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-times me-2"></i>
                                            Tolak Kursus
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </>
    );
}

export default React.memo(AdminCourseReviewDetail);
