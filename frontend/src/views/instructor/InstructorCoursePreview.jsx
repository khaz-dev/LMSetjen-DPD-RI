import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAxios from "../../utils/useAxios";
import Toast from "../plugin/Toast";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import { getImageUrl, getLevelText } from "../../utils/courseUtils";
import "./InstructorCoursePreview.css";

/**
 * Instructor Course Preview Page
 * Compact, modern, and eye-catching course preview for instructors
 * Reduces excessive whitespace and provides a rich, responsive 2-column layout.
 */

const convertEmbedUrlToViewable = (fileUrl, videoSource) => {
    if (!fileUrl) return null;
    
    if (videoSource === "youtube") {
        const youtubeMatch = fileUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
        if (youtubeMatch?.[1]) {
            return `https://www.youtube.com/watch?v=${youtubeMatch[1]}`;
        }
    } else if (videoSource === "google_drive") {
        const driveMatch = fileUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (driveMatch?.[1]) {
            return `https://drive.google.com/file/d/${driveMatch[1]}/view`;
        }
    }
    
    return fileUrl;
};

const getYouTubeEmbedUrl = (url) => {
    if (!url) return "";
    if (url.includes("youtube.com/embed/")) return url;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : url;
};

function InstructorCoursePreview() {
    const { course_id } = useParams();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(window.location.search);
    const viewMode = searchParams.get('view'); // 'published' or null for draft
    
    const [loading, setLoading] = useState(true);
    const [course, setCourse] = useState(null);
    const [activeTab, setActiveTab] = useState("curriculum"); // 'curriculum', 'quizzes', 'overview', 'all'
    const [expandedSections, setExpandedSections] = useState({});
    const [expandedQuizzes, setExpandedQuizzes] = useState({});
    const [showIntroVideoModal, setShowIntroVideoModal] = useState(false);
    const [showIntroVideoInline, setShowIntroVideoInline] = useState(false);
    const [expandedLecturePreview, setExpandedLecturePreview] = useState({});

    useEffect(() => {
        fetchCourseDetail();
    }, [course_id]);

    const fetchCourseDetail = async () => {
        try {
            setLoading(true);
            const response = await useAxios.get(`teacher/course-detail/${course_id}/`);
            console.log("[InstructorCoursePreview] Course data:", response.data);
            
            if (viewMode === 'published' && response.data?.published_version) {
                console.log("[InstructorCoursePreview] Displaying published version", response.data.published_version);
                setCourse(response.data.published_version);
            } else {
                setCourse(response.data);
            }

            // Auto-expand the first section by default for convenience
            if (response.data?.curriculum?.length > 0) {
                const firstSectionId = response.data.curriculum[0].id || response.data.curriculum[0].variant_id;
                if (firstSectionId) {
                    setExpandedSections({ [firstSectionId]: true });
                }
            }
            if (response.data?.quizzes?.length > 0) {
                const firstQuizId = response.data.quizzes[0].id || response.data.quizzes[0].quiz_id;
                if (firstQuizId) {
                    setExpandedQuizzes({ [firstQuizId]: true });
                }
            }
        } catch (error) {
            console.error("Error fetching course detail:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat detail kursus",
                text: error.response?.data?.detail || "Terjadi kesalahan saat memuat data"
            });
            setTimeout(() => navigate("/instructor/courses/"), 2000);
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

    const toggleAllSections = () => {
        if (!course?.curriculum) return;
        const allExpanded = course.curriculum.every(s => expandedSections[s.id || s.variant_id]);
        const newState = {};
        course.curriculum.forEach(s => {
            newState[s.id || s.variant_id] = !allExpanded;
        });
        setExpandedSections(newState);
    };

    const toggleQuiz = (quizId) => {
        setExpandedQuizzes(prev => ({
            ...prev,
            [quizId]: !prev[quizId]
        }));
    };

    const toggleAllQuizzes = () => {
        if (!course?.quizzes) return;
        const allExpanded = course.quizzes.every(q => expandedQuizzes[q.id || q.quiz_id]);
        const newState = {};
        course.quizzes.forEach(q => {
            newState[q.id || q.quiz_id] = !allExpanded;
        });
        setExpandedQuizzes(newState);
    };

    const toggleLecturePreview = (lectureId) => {
        setExpandedLecturePreview(prev => ({
            ...prev,
            [lectureId]: !prev[lectureId]
        }));
    };

    // Derived statistics
    const stats = useMemo(() => {
        if (!course) return { sections: 0, lectures: 0, quizzes: 0, questions: 0 };
        const sections = course.curriculum?.length || 0;
        let lectures = 0;
        if (course.curriculum) {
            course.curriculum.forEach(sec => {
                const items = sec.items || sec.variant_items || [];
                lectures += items.length;
            });
        }
        if (!lectures && course.lectures) {
            lectures = course.lectures.length;
        }
        const quizzes = course.quizzes?.length || 0;
        let questions = 0;
        if (course.quizzes) {
            course.quizzes.forEach(q => {
                questions += q.questions?.length || q.question_count || 0;
            });
        }
        return { sections, lectures, quizzes, questions };
    }, [course]);

    const isAllSectionsExpanded = useMemo(() => {
        if (!course?.curriculum?.length) return false;
        return course.curriculum.every(s => expandedSections[s.id || s.variant_id]);
    }, [course, expandedSections]);

    const isAllQuizzesExpanded = useMemo(() => {
        if (!course?.quizzes?.length) return false;
        return course.quizzes.every(q => expandedQuizzes[q.id || q.quiz_id]);
    }, [course, expandedQuizzes]);

    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="icp-wrapper py-4">
                    <div className="container">
                        <div className="icp-loading-box">
                            <div className="spinner-border text-teal" role="status">
                                <span className="visually-hidden">Memuat...</span>
                            </div>
                            <h6 className="mt-3 fw-bold text-dark">Memuat Pratinjau Kursus...</h6>
                            <p className="text-muted small mb-0">Menyiapkan data draf dan kurikulum</p>
                        </div>
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    if (!course) {
        return (
            <>
                <BaseHeader />
                <section className="icp-wrapper py-4">
                    <div className="container">
                        <div className="icp-error-card">
                            <div className="icp-error-icon">
                                <i className="fas fa-exclamation-triangle"></i>
                            </div>
                            <h4 className="fw-bold mt-3 mb-2">Kursus Tidak Ditemukan</h4>
                            <p className="text-muted mb-4">Data kursus tidak dapat dimuat atau telah dihapus.</p>
                            <button 
                                className="btn btn-teal px-4"
                                onClick={() => navigate("/instructor/courses/")}
                            >
                                <i className="fas fa-arrow-left me-2"></i>
                                Kembali ke Kursus Saya
                            </button>
                        </div>
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    const isPublished = viewMode === 'published';

    return (
        <>
            <BaseHeader />
            <div className="icp-wrapper">
                {/* Compact Top Navigation Bar */}
                <div className="icp-topbar-sticky">
                    <div className="container">
                        <div className="icp-topbar-inner">
                            <div className="icp-topbar-left">
                                <button 
                                    className="btn btn-sm btn-outline-secondary icp-btn-back"
                                    onClick={() => navigate(`/instructor/edit-course/${course_id}/`)}
                                    title="Kembali ke halaman edit kursus"
                                >
                                    <i className="fas fa-arrow-left me-1"></i>
                                    <span>Kembali</span>
                                </button>
                                <div className="icp-topbar-title-wrap">
                                    <div className="icp-badge-mode">
                                        <span className={`icp-pulse-dot ${isPublished ? 'published' : 'draft'}`}></span>
                                        {isPublished ? 'Mode Publikasi' : 'Mode Pratinjau Draf'}
                                    </div>
                                    <h1 className="icp-topbar-course-title text-truncate" title={course.title}>
                                        {course.title}
                                    </h1>
                                </div>
                            </div>

                            <div className="icp-topbar-actions">
                                {isPublished ? (
                                    <button 
                                        className="btn btn-sm btn-outline-teal"
                                        onClick={() => navigate(`/instructor/preview-course/${course_id}/`)}
                                        title="Lihat versi draf saat ini"
                                    >
                                        <i className="fas fa-code-branch me-1"></i>
                                        <span>Lihat Draf</span>
                                    </button>
                                ) : course.published_version ? (
                                    <button 
                                        className="btn btn-sm btn-outline-teal"
                                        onClick={() => navigate(`/instructor/preview-course/${course_id}/?view=published`)}
                                        title="Lihat versi yang sedang aktif dipublikasikan"
                                    >
                                        <i className="fas fa-globe me-1"></i>
                                        <span>Lihat Publis</span>
                                    </button>
                                ) : null}

                                <button 
                                    className="btn btn-sm btn-teal d-flex align-items-center gap-1 shadow-sm"
                                    onClick={() => navigate(`/instructor/edit-course/${course_id}/`)}
                                >
                                    <i className="fas fa-edit"></i>
                                    <span>Edit Kursus</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="container py-3">
                    <div className="row g-3">
                        {/* LEFT COLUMN: Main Course Content (8 Cols) */}
                        <div className="col-lg-8">
                            {/* Course Compact Hero Card */}
                            <div className="icp-hero-card">
                                <div className="icp-hero-header">
                                    <div className="icp-hero-meta-badges">
                                        <span className="icp-pill-badge icp-pill-category">
                                            <i className="fas fa-folder-open me-1"></i>
                                            {course.category?.title || "Umum"}
                                        </span>
                                        <span className="icp-pill-badge icp-pill-level">
                                            <i className="fas fa-signal me-1"></i>
                                            {getLevelText(course.level)}
                                        </span>
                                        {course.language && (
                                            <span className="icp-pill-badge icp-pill-lang">
                                                <i className="fas fa-language me-1"></i>
                                                {course.language}
                                            </span>
                                        )}
                                        {course.review_submitted_date && (
                                            <span className="icp-pill-badge icp-pill-date">
                                                <i className="fas fa-paper-plane me-1"></i>
                                                Diajukan: {new Date(course.review_submitted_date).toLocaleDateString('id-ID', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="icp-hero-title">{course.title}</h2>
                                    
                                    {/* Course Tags */}
                                    {course.tags && Array.isArray(course.tags) && course.tags.length > 0 && (
                                        <div className="icp-hero-tags">
                                            {course.tags.map((tag) => (
                                                <span key={tag.id || tag} className="icp-tag-item">
                                                    #{typeof tag === 'object' ? tag.title : tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Compact Tab Bar */}
                                <div className="icp-nav-tabs">
                                    <button 
                                        className={`icp-nav-tab ${activeTab === 'curriculum' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('curriculum')}
                                    >
                                        <i className="fas fa-layer-group me-1.5"></i>
                                        <span>Kurikulum</span>
                                        <span className="icp-tab-counter">{stats.sections} Bagian • {stats.lectures} Materi</span>
                                    </button>
                                    <button 
                                        className={`icp-nav-tab ${activeTab === 'quizzes' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('quizzes')}
                                    >
                                        <i className="fas fa-tasks me-1.5"></i>
                                        <span>Kuis</span>
                                        <span className="icp-tab-counter">{stats.quizzes} Kuis</span>
                                    </button>
                                    <button 
                                        className={`icp-nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('overview')}
                                    >
                                        <i className="fas fa-info-circle me-1.5"></i>
                                        <span>Deskripsi & Video</span>
                                    </button>
                                    <button 
                                        className={`icp-nav-tab ${activeTab === 'all' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('all')}
                                    >
                                        <i className="fas fa-list-ul me-1.5"></i>
                                        <span>Semua Konten</span>
                                    </button>
                                </div>
                            </div>

                            {/* TAB 1: CURRICULUM */}
                            {(activeTab === 'curriculum' || activeTab === 'all') && (
                                <div className="icp-card mb-3">
                                    <div className="icp-card-header d-flex align-items-center justify-content-between">
                                        <div className="d-flex align-items-center gap-2">
                                            <div className="icp-card-header-icon">
                                                <i className="fas fa-book-open"></i>
                                            </div>
                                            <div>
                                                <h3 className="icp-card-title mb-0">Struktur Kurikulum</h3>
                                                <span className="icp-card-subtitle">
                                                    {stats.sections} Bagian • {stats.lectures} Pelajaran
                                                </span>
                                            </div>
                                        </div>
                                        {course.curriculum && course.curriculum.length > 0 && (
                                            <button 
                                                className="btn btn-sm btn-light border icp-btn-toggle-all"
                                                onClick={toggleAllSections}
                                            >
                                                <i className={`fas fa-${isAllSectionsExpanded ? 'compress-arrows-alt' : 'expand-arrows-alt'} me-1`}></i>
                                                {isAllSectionsExpanded ? 'Tutup Semua' : 'Buka Semua'}
                                            </button>
                                        )}
                                    </div>

                                    <div className="icp-card-body p-0">
                                        {(!course.curriculum || course.curriculum.length === 0) ? (
                                            <div className="icp-empty-state">
                                                <i className="fas fa-book-reader mb-2"></i>
                                                <h6>Belum Ada Bagian Kurikulum</h6>
                                                <p className="text-muted small mb-0">Silakan tambahkan bagian dan pelajaran di editor kursus.</p>
                                            </div>
                                        ) : (
                                            <div className="icp-accordion">
                                                {course.curriculum.map((section, idx) => {
                                                    const sectionId = section.id || section.variant_id || `section-${idx}`;
                                                    const items = section.items || section.variant_items || [];
                                                    const isExpanded = !!expandedSections[sectionId];

                                                    return (
                                                        <div key={sectionId} className={`icp-section-block ${isExpanded ? 'is-open' : ''}`}>
                                                            <div 
                                                                className="icp-section-head"
                                                                onClick={() => toggleSection(sectionId)}
                                                            >
                                                                <div className="d-flex align-items-center gap-2 flex-grow-1">
                                                                    <span className="icp-section-badge">Bagian {idx + 1}</span>
                                                                    <span className="icp-section-name">{section.title}</span>
                                                                </div>
                                                                <div className="d-flex align-items-center gap-3">
                                                                    <span className="icp-section-counter">
                                                                        {items.length} Pelajaran
                                                                    </span>
                                                                    <i className={`fas fa-chevron-down icp-arrow ${isExpanded ? 'rotate' : ''}`}></i>
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="icp-section-body">
                                                                    {items.length === 0 ? (
                                                                        <div className="icp-empty-sub">
                                                                            <i className="fas fa-file-alt text-muted me-2"></i>
                                                                            Belum ada materi pelajaran dalam bagian ini.
                                                                        </div>
                                                                    ) : (
                                                                        <div className="icp-lecture-group">
                                                                            {items.map((lecture, lIdx) => {
                                                                                const lectureId = lecture.id || lecture.variant_item_id || `lec-${idx}-${lIdx}`;
                                                                                const isVideo = lecture.file_type === "video" || 
                                                                                                lecture.content_type === "video" || 
                                                                                                lecture.file?.includes('youtube') || 
                                                                                                lecture.file?.includes('youtu.be') || 
                                                                                                lecture.file?.includes('drive.google');
                                                                                const isLecturePreviewOpen = !!expandedLecturePreview[lectureId];

                                                                                return (
                                                                                    <div key={lectureId} className="icp-lecture-row">
                                                                                        <div className="icp-lecture-main">
                                                                                            <div className="icp-lecture-icon-wrap">
                                                                                                <i className={`fas ${isVideo ? 'fa-play-circle text-teal' : 'fa-file-alt text-primary'}`}></i>
                                                                                            </div>
                                                                                            <div className="icp-lecture-content-block">
                                                                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                                                                    <span className="icp-lecture-title">
                                                                                                        {lIdx + 1}. {lecture.title}
                                                                                                    </span>
                                                                                                    <span className={`icp-pill-micro ${isVideo ? 'pill-video' : 'pill-doc'}`}>
                                                                                                        {isVideo ? 'Video' : 'Dokumen'}
                                                                                                    </span>
                                                                                                    {(lecture.duration_seconds || lecture.content_duration) && (
                                                                                                        <span className="icp-pill-micro pill-time">
                                                                                                            <i className="fas fa-clock me-1"></i>
                                                                                                            {lecture.content_duration || `${Math.floor((lecture.duration_seconds || 0) / 60)}:${String(Math.floor((lecture.duration_seconds || 0) % 60)).padStart(2, '0')}`}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                                {lecture.description && (
                                                                                                    <div className="icp-lecture-desc">
                                                                                                        {lecture.description}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                            
                                                                                            {lecture.file && (
                                                                                                <div className="icp-lecture-action">
                                                                                                    {isVideo ? (
                                                                                                        <button
                                                                                                            className={`btn btn-xs ${isLecturePreviewOpen ? 'btn-teal' : 'btn-outline-teal'}`}
                                                                                                            onClick={() => toggleLecturePreview(lectureId)}
                                                                                                        >
                                                                                                            <i className={`fas ${isLecturePreviewOpen ? 'fa-eye-slash' : 'fa-play'} me-1`}></i>
                                                                                                            {isLecturePreviewOpen ? 'Tutup' : 'Lihat'}
                                                                                                        </button>
                                                                                                    ) : (
                                                                                                        <a 
                                                                                                            href={lecture.file} 
                                                                                                            target="_blank" 
                                                                                                            rel="noopener noreferrer"
                                                                                                            className="btn btn-xs btn-outline-secondary"
                                                                                                        >
                                                                                                            <i className="fas fa-download me-1"></i>
                                                                                                            Unduh
                                                                                                        </a>
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* Inline Lecture Video Preview */}
                                                                                        {isLecturePreviewOpen && lecture.file && (
                                                                                            <div className="icp-lecture-video-box">
                                                                                                {lecture.file.includes('youtube') || lecture.file.includes('youtu.be') ? (
                                                                                                    <iframe
                                                                                                        width="100%"
                                                                                                        height="280"
                                                                                                        src={getYouTubeEmbedUrl(lecture.file)}
                                                                                                        title={lecture.title}
                                                                                                        frameBorder="0"
                                                                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                                                        allowFullScreen
                                                                                                        className="icp-video-iframe"
                                                                                                    ></iframe>
                                                                                                ) : (
                                                                                                    <video
                                                                                                        width="100%"
                                                                                                        height="280"
                                                                                                        controls
                                                                                                        className="icp-video-player"
                                                                                                    >
                                                                                                        <source src={lecture.file} type="video/mp4" />
                                                                                                        Browser Anda tidak mendukung pemutar video.
                                                                                                    </video>
                                                                                                )}
                                                                                            </div>
                                                                                        )}

                                                                                        {/* Lesson Completion Question */}
                                                                                        {lecture.completion_question && (
                                                                                            <div className="icp-completion-box">
                                                                                                <div className="d-flex align-items-center justify-content-between mb-1">
                                                                                                    <span className="icp-completion-tag">
                                                                                                        <i className="fas fa-question-circle me-1"></i>
                                                                                                        Pertanyaan Penyelesaian
                                                                                                    </span>
                                                                                                    {lecture.completion_question.question_type_display && (
                                                                                                        <span className="badge bg-light text-dark border">
                                                                                                            {lecture.completion_question.question_type_display}
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                                <p className="icp-completion-question-text mb-2">
                                                                                                    {lecture.completion_question.question_text}
                                                                                                </p>
                                                                                                {lecture.completion_question.choices && lecture.completion_question.choices.length > 0 && (
                                                                                                    <div className="icp-completion-choices">
                                                                                                        {lecture.completion_question.choices.map((choice, cIdx) => (
                                                                                                            <div 
                                                                                                                key={cIdx} 
                                                                                                                className={`icp-choice-mini ${choice.is_correct ? 'correct' : ''}`}
                                                                                                            >
                                                                                                                <span className="icp-choice-circle">
                                                                                                                    {String.fromCharCode(65 + cIdx)}
                                                                                                                </span>
                                                                                                                <span className="icp-choice-txt">{choice.choice_text}</span>
                                                                                                                {choice.is_correct && (
                                                                                                                    <i className="fas fa-check-circle text-success ms-auto"></i>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                )}
                                                                                                {lecture.completion_question.correct_answer_text && (
                                                                                                    <div className="icp-completion-ans mt-2">
                                                                                                        <strong>Kunci Jawaban:</strong> {lecture.completion_question.correct_answer_text}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: QUIZZES */}
                            {(activeTab === 'quizzes' || activeTab === 'all') && (
                                <div className="icp-card mb-3">
                                    <div className="icp-card-header d-flex align-items-center justify-content-between">
                                        <div className="d-flex align-items-center gap-2">
                                            <div className="icp-card-header-icon icon-quiz">
                                                <i className="fas fa-tasks"></i>
                                            </div>
                                            <div>
                                                <h3 className="icp-card-title mb-0">Daftar Kuis Kursus</h3>
                                                <span className="icp-card-subtitle">
                                                    {stats.quizzes} Kuis • {stats.questions} Pertanyaan
                                                </span>
                                            </div>
                                        </div>
                                        {course.quizzes && course.quizzes.length > 0 && (
                                            <button 
                                                className="btn btn-sm btn-light border icp-btn-toggle-all"
                                                onClick={toggleAllQuizzes}
                                            >
                                                <i className={`fas fa-${isAllQuizzesExpanded ? 'compress-arrows-alt' : 'expand-arrows-alt'} me-1`}></i>
                                                {isAllQuizzesExpanded ? 'Tutup Semua' : 'Buka Semua'}
                                            </button>
                                        )}
                                    </div>

                                    <div className="icp-card-body p-0">
                                        {(!course.quizzes || course.quizzes.length === 0) ? (
                                            <div className="icp-empty-state">
                                                <i className="fas fa-clipboard-check mb-2"></i>
                                                <h6>Belum Ada Kuis</h6>
                                                <p className="text-muted small mb-0">Kuis dapat ditambahkan melalui menu Manajemen Kuis.</p>
                                            </div>
                                        ) : (
                                            <div className="icp-accordion">
                                                {course.quizzes.map((quiz, qIndex) => {
                                                    const quizId = quiz.id || quiz.quiz_id || `quiz-${qIndex}`;
                                                    const isExpanded = !!expandedQuizzes[quizId];
                                                    const questions = quiz.questions || [];

                                                    return (
                                                        <div key={quizId} className={`icp-section-block ${isExpanded ? 'is-open' : ''}`}>
                                                            <div 
                                                                className="icp-section-head"
                                                                onClick={() => toggleQuiz(quizId)}
                                                            >
                                                                <div className="d-flex align-items-center gap-2 flex-grow-1">
                                                                    <span className="icp-section-badge quiz-badge">Kuis {qIndex + 1}</span>
                                                                    <span className="icp-section-name">{quiz.title || "Kuis Tanpa Judul"}</span>
                                                                    {quiz.is_active !== undefined && (
                                                                        <span className={`icp-pill-micro ${quiz.is_active ? 'pill-active' : 'pill-inactive'}`}>
                                                                            {quiz.is_active ? 'Aktif' : 'Nonaktif'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="d-flex align-items-center gap-3">
                                                                    <span className="icp-section-counter">
                                                                        {questions.length || quiz.question_count || 0} Soal
                                                                    </span>
                                                                    <i className={`fas fa-chevron-down icp-arrow ${isExpanded ? 'rotate' : ''}`}></i>
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="icp-section-body">
                                                                    {quiz.description && (
                                                                        <div className="icp-quiz-desc-box">
                                                                            <i className="fas fa-info-circle text-teal me-2"></i>
                                                                            <span>{quiz.description}</span>
                                                                        </div>
                                                                    )}

                                                                    {questions.length === 0 ? (
                                                                        <div className="icp-empty-sub">
                                                                            <i className="fas fa-question-circle text-muted me-2"></i>
                                                                            Belum ada soal/pertanyaan dalam kuis ini.
                                                                        </div>
                                                                    ) : (
                                                                        <div className="icp-quiz-questions-wrap">
                                                                            {questions.map((question, qIdx) => (
                                                                                <div key={question.id || question.question_id || qIdx} className="icp-quiz-question-card">
                                                                                    <div className="icp-quiz-q-header">
                                                                                        <span className="icp-q-num">Soal {qIdx + 1}</span>
                                                                                        <span className="icp-q-text">{question.question_text}</span>
                                                                                    </div>
                                                                                    
                                                                                    <div className="icp-quiz-choices-grid">
                                                                                        {question.choices && question.choices.length > 0 ? (
                                                                                            question.choices.map((choice, cIdx) => (
                                                                                                <div 
                                                                                                    key={choice.id || choice.choice_id || cIdx}
                                                                                                    className={`icp-choice-card ${choice.is_correct ? 'is-correct-choice' : ''}`}
                                                                                                >
                                                                                                    <span className="icp-choice-letter">
                                                                                                        {String.fromCharCode(65 + cIdx)}
                                                                                                    </span>
                                                                                                    <span className="icp-choice-title">{choice.choice_text}</span>
                                                                                                    {choice.is_correct && (
                                                                                                        <span className="icp-badge-correct ms-auto">
                                                                                                            <i className="fas fa-check me-1"></i> Benar
                                                                                                        </span>
                                                                                                    )}
                                                                                                </div>
                                                                                            ))
                                                                                        ) : (
                                                                                            <div className="text-muted small py-1">Pilihan jawaban belum diatur.</div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: DESCRIPTION & INTRO VIDEO */}
                            {(activeTab === 'overview' || activeTab === 'all') && (
                                <>
                                    {/* Intro Video Card */}
                                    {course.file && (
                                        <div className="icp-card mb-3">
                                            <div className="icp-card-header d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="icp-card-header-icon icon-video">
                                                        <i className="fas fa-play"></i>
                                                    </div>
                                                    <div>
                                                        <h3 className="icp-card-title mb-0">Video Pengantar Kursus</h3>
                                                        <span className="icp-card-subtitle">Pratinjau video intro resmi</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    className={`btn btn-xs ${showIntroVideoInline ? 'btn-teal' : 'btn-outline-teal'}`}
                                                    onClick={() => setShowIntroVideoInline(!showIntroVideoInline)}
                                                >
                                                    <i className={`fas ${showIntroVideoInline ? 'fa-eye-slash' : 'fa-play'} me-1`}></i>
                                                    {showIntroVideoInline ? 'Sembunyikan' : 'Putar Video'}
                                                </button>
                                            </div>
                                            <div className="icp-card-body">
                                                {showIntroVideoInline ? (
                                                    <div className="icp-intro-video-wrapper">
                                                        {course.file.includes('youtube') || course.file.includes('youtu.be') ? (
                                                            <iframe
                                                                width="100%"
                                                                height="360"
                                                                src={getYouTubeEmbedUrl(course.file)}
                                                                title="Video Pengantar Kursus"
                                                                frameBorder="0"
                                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                allowFullScreen
                                                                className="icp-video-iframe"
                                                            ></iframe>
                                                        ) : (
                                                            <video
                                                                width="100%"
                                                                height="360"
                                                                controls
                                                                className="icp-video-player"
                                                            >
                                                                <source src={course.file} type="video/mp4" />
                                                                Browser Anda tidak mendukung tag video.
                                                            </video>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div 
                                                        className="icp-video-placeholder-banner"
                                                        onClick={() => setShowIntroVideoInline(true)}
                                                    >
                                                        <div className="icp-video-play-circle">
                                                            <i className="fas fa-play"></i>
                                                        </div>
                                                        <div className="text-center mt-2">
                                                            <span className="fw-bold d-block text-dark">Klik untuk Membuka Video Pengantar</span>
                                                            <small className="text-muted">Format: Video player inline</small>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Description Card */}
                                    <div className="icp-card mb-3">
                                        <div className="icp-card-header d-flex align-items-center gap-2">
                                            <div className="icp-card-header-icon">
                                                <i className="fas fa-align-left"></i>
                                            </div>
                                            <div>
                                                <h3 className="icp-card-title mb-0">Deskripsi Kursus</h3>
                                                <span className="icp-card-subtitle">Ringkasan materi dan penjelasan silabus</span>
                                            </div>
                                        </div>
                                        <div className="icp-card-body">
                                            {course.description ? (
                                                <div 
                                                    className="icp-rich-description"
                                                    dangerouslySetInnerHTML={{ __html: course.description }}
                                                />
                                            ) : (
                                                <p className="text-muted mb-0 small">Belum ada deskripsi yang ditambahkan untuk kursus ini.</p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Sidebar (4 Cols) */}
                        <div className="col-lg-4">
                            <div className="icp-sidebar-sticky">
                                {/* Course Thumbnail Card with Video Trigger */}
                                <div className="icp-sidebar-card mb-3">
                                    <div className="icp-thumbnail-box position-relative">
                                        <img
                                            src={getImageUrl(course.image)}
                                            alt={course.title}
                                            className="icp-thumbnail-img"
                                            loading="lazy"
                                            onError={(e) => {
                                                e.target.src = "/images/placeholders/default-course.svg";
                                            }}
                                        />
                                        {course.file && (
                                            <button 
                                                className="icp-thumbnail-play-overlay"
                                                onClick={() => setShowIntroVideoModal(true)}
                                                title="Lihat Video Pengantar"
                                            >
                                                <span className="icp-pulse-ring"></span>
                                                <i className="fas fa-play"></i>
                                            </button>
                                        )}
                                        <div className="icp-thumbnail-badge">
                                            {isPublished ? 'PUBLIK' : 'DRAF'}
                                        </div>
                                    </div>

                                    {/* Quick Micro-Stats Bar */}
                                    <div className="icp-micro-stats-row">
                                        <div className="icp-micro-stat-item">
                                            <span className="icp-m-num">{stats.sections}</span>
                                            <span className="icp-m-label">Bagian</span>
                                        </div>
                                        <div className="icp-micro-stat-divider"></div>
                                        <div className="icp-micro-stat-item">
                                            <span className="icp-m-num">{stats.lectures}</span>
                                            <span className="icp-m-label">Pelajaran</span>
                                        </div>
                                        <div className="icp-micro-stat-divider"></div>
                                        <div className="icp-micro-stat-item">
                                            <span className="icp-m-num">{stats.quizzes}</span>
                                            <span className="icp-m-label">Kuis</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="icp-sidebar-action-box p-3 pt-0">
                                        <button 
                                            className="btn btn-teal w-100 mb-2 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                                            onClick={() => navigate(`/instructor/edit-course/${course_id}/`)}
                                        >
                                            <i className="fas fa-edit"></i>
                                            <span>Lanjut Edit Kursus</span>
                                        </button>
                                        <button 
                                            className="btn btn-outline-secondary btn-sm w-100 d-flex align-items-center justify-content-center gap-2"
                                            onClick={() => navigate(`/instructor/courses/`)}
                                        >
                                            <i className="fas fa-th-list"></i>
                                            <span>Semua Kursus Saya</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Kursus Ini Termasuk (Features) */}
                                {course.features && course.features.length > 0 && (
                                    <div className="icp-sidebar-card mb-3">
                                        <div className="icp-sidebar-card-head">
                                            <i className="fas fa-star text-teal me-2"></i>
                                            <span className="fw-bold">Kursus Ini Termasuk</span>
                                            <span className="badge bg-light text-dark ms-auto">{course.features.length}</span>
                                        </div>
                                        <div className="icp-sidebar-card-body p-3">
                                            <div className="icp-compact-list">
                                                {course.features.map((feature, idx) => (
                                                    <div key={feature.id || `feat-${idx}`} className="icp-compact-item">
                                                        <i className="fas fa-check-circle text-teal me-2 flex-shrink-0"></i>
                                                        <span className="small text-dark">
                                                            {feature.text || feature.feature || feature}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Hasil Pembelajaran (Learning Outcomes) */}
                                {course.learning_outcomes && course.learning_outcomes.length > 0 && (
                                    <div className="icp-sidebar-card mb-3">
                                        <div className="icp-sidebar-card-head">
                                            <i className="fas fa-graduation-cap text-teal me-2"></i>
                                            <span className="fw-bold">Hasil Pembelajaran</span>
                                            <span className="badge bg-light text-dark ms-auto">{course.learning_outcomes.length}</span>
                                        </div>
                                        <div className="icp-sidebar-card-body p-3">
                                            <div className="icp-compact-list">
                                                {course.learning_outcomes.map((outcome, idx) => (
                                                    <div key={outcome.id || `out-${idx}`} className="icp-compact-item">
                                                        <i className="fas fa-bullseye text-info me-2 flex-shrink-0"></i>
                                                        <span className="small text-dark">
                                                            {outcome.outcome || outcome}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Persyaratan (Requirements) */}
                                {course.requirements && course.requirements.length > 0 && (
                                    <div className="icp-sidebar-card mb-3">
                                        <div className="icp-sidebar-card-head">
                                            <i className="fas fa-tasks text-teal me-2"></i>
                                            <span className="fw-bold">Persyaratan</span>
                                            <span className="badge bg-light text-dark ms-auto">{course.requirements.length}</span>
                                        </div>
                                        <div className="icp-sidebar-card-body p-3">
                                            <div className="icp-compact-list">
                                                {course.requirements.map((req, idx) => (
                                                    <div key={req.id || `req-${idx}`} className="icp-compact-item">
                                                        <span className="icp-num-dot me-2">{idx + 1}</span>
                                                        <span className="small text-dark">
                                                            {req.requirement || req}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Notice / Status Box */}
                                <div className="icp-sidebar-info-banner">
                                    <div className="d-flex align-items-start gap-2">
                                        <i className="fas fa-info-circle text-teal mt-1"></i>
                                        <div>
                                            <h6 className="fw-bold mb-1" style={{ fontSize: '0.85rem' }}>Pratinjau Read-Only</h6>
                                            <p className="text-muted mb-0" style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
                                                Halaman ini menampilkan pratinjau seperti yang akan dilihat oleh siswa saat kursus dipublikasikan.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Intro Video Modal */}
            {showIntroVideoModal && course.file && (
                <div 
                    className="modal fade show d-block icp-video-modal-backdrop" 
                    tabIndex="-1" 
                    role="dialog"
                    onClick={() => setShowIntroVideoModal(false)}
                >
                    <div 
                        className="modal-dialog modal-lg modal-dialog-centered" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-content border-0 shadow-lg icp-modal-content">
                            <div className="modal-header border-0 pb-0 d-flex align-items-center justify-content-between">
                                <h6 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                                    <i className="fas fa-play-circle text-teal"></i>
                                    <span>Video Pengantar: {course.title}</span>
                                </h6>
                                <button 
                                    type="button" 
                                    className="btn-close" 
                                    onClick={() => setShowIntroVideoModal(false)}
                                    aria-label="Close"
                                ></button>
                            </div>
                            <div className="modal-body p-3">
                                <div className="icp-modal-video-box">
                                    {course.file.includes('youtube') || course.file.includes('youtu.be') ? (
                                        <iframe
                                            width="100%"
                                            height="420"
                                            src={getYouTubeEmbedUrl(course.file)}
                                            title="Video Pengantar Kursus"
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            className="icp-video-iframe"
                                        ></iframe>
                                    ) : (
                                        <video
                                            width="100%"
                                            height="420"
                                            controls
                                            autoPlay
                                            className="icp-video-player"
                                        >
                                            <source src={course.file} type="video/mp4" />
                                            Browser Anda tidak mendukung pemutar video.
                                        </video>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </>
    );
}

export default React.memo(InstructorCoursePreview);
