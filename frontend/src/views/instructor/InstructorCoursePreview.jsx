import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAxios from "../../utils/useAxios";
import Toast from "../plugin/Toast";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import { getImageUrl, getLevelText } from "../../utils/courseUtils";
import "./InstructorCoursePreview.css";

/**
 * Instructor Course Preview Page
 * ✨ PHASE 4.9+: Comprehensive instructor course preview
 * 
 * Features:
 * ✅ Complete course information with stats (Sections, Lectures, Quizzes)
 * ✅ Intro video with source indicators (YouTube, Google Drive, Upload)
 * ✅ Course details sections:
 *    - Deskripsi Kursus (Description)
 *    - Kursus ini Termasuk (Features/Benefits)
 *    - Persyaratan (Requirements)
 *    - Hasil Pembelajaran (Learning Outcomes)
 * ✅ Full curriculum with sections, lessons, and completion questions
 * ✅ Detailed quiz display with questions and answer choices
 * ✅ Clean standalone layout without shared header/sidebar
 * ✅ Read-only mode - no editing functionality
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

function InstructorCoursePreview() {
    const { course_id } = useParams();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(window.location.search);
    const viewMode = searchParams.get('view'); // 'published' or null for draft
    
    const [loading, setLoading] = useState(true);
    const [course, setCourse] = useState(null);
    const [expandedSections, setExpandedSections] = useState({});
    const [expandedQuizzes, setExpandedQuizzes] = useState({});
    const [showIntroVideoPreview, setShowIntroVideoPreview] = useState(false);
    const [expandedLecturePreview, setExpandedLecturePreview] = useState({});

    useEffect(() => {
        fetchCourseDetail();
    }, [course_id]);

    const fetchCourseDetail = async () => {
        try {
            setLoading(true);
            const response = await useAxios.get(`teacher/course-detail/${course_id}/`);
            console.log("[InstructorCoursePreview] Course data:", response.data);
            
            // If viewing published version, use published_version data if available
            if (viewMode === 'published' && response.data?.published_version) {
                console.log("[InstructorCoursePreview] Displaying published version", response.data.published_version);
                setCourse(response.data.published_version);
            } else {
                setCourse(response.data);
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

    const toggleQuiz = (quizId) => {
        setExpandedQuizzes(prev => ({
            ...prev,
            [quizId]: !prev[quizId]
        }));
    };

    const toggleLecturePreview = (lectureId) => {
        setExpandedLecturePreview(prev => ({
            ...prev,
            [lectureId]: !prev[lectureId]
        }));
    };

    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-preview-container pt-5 pb-5">
                    <div className="container">
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Memuat...</span>
                            </div>
                            <p className="mt-3 text-muted">Memuat pratinjau kursus...</p>
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
                <section className="instructor-preview-container pt-5 pb-5">
                    <div className="container">
                        <div className="alert alert-danger text-center">
                            <i className="fas fa-exclamation-circle me-2"></i>
                            Kursus tidak ditemukan
                        </div>
                        <div className="text-center">
                            <button 
                                className="btn btn-primary"
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

    return (
        <>
            <BaseHeader />
            <section className="instructor-preview-container pt-5 pb-5">
                <div className="container">
                    <div className="icp-container">
                        <div className="icp-header mb-4">
                            <button 
                                className="btn btn-outline-secondary"
                                onClick={() => navigate("/instructor/edit-course/" + course_id + "/")}
                                title="Kembali ke edit kursus"
                            >
                                <i className="fas fa-arrow-left me-2"></i>
                                Kembali
                            </button>
                            <h1 className="icp-title">
                                <i className="fas fa-file-alt me-2"></i>
                                {viewMode === 'published' ? 'Pratinjau Kursus Publis' : 'Pratinjau Kursus Draf'}
                            </h1>
                        </div>

                        {/* Course Header Card */}
                        <div className="icp-card icp-course-header mb-4">
                            <div className="row">
                                <div className="col-lg-3 mb-3 mb-lg-0">
                                    <img
                                        src={getImageUrl(course.image)}
                                        alt={course.title}
                                        className="icp-course-image"
                                        onError={(e) => {
                                            e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                                        }}
                                    />
                                </div>
                                <div className="col-lg-9">
                                    <div className="icp-course-info">
                                        <h2 className="icp-course-title">{course.title}</h2>
                                        
                                        <div className="icp-meta-row mb-3">
                                            <div className="icp-meta-item">
                                                <i className="fas fa-tag me-2 text-info"></i>
                                                <strong>Kategori:</strong>
                                                <span className="ms-2">{course.category?.title || "N/A"}</span>
                                            </div>
                                            <div className="icp-meta-item">
                                                <i className="fas fa-graduation-cap me-2 text-success"></i>
                                                <strong>Tingkat:</strong>
                                                <span className="ms-2">{getLevelText(course.level)}</span>
                                            </div>
                                        </div>

                                        {/* Course Stats */}
                                        <div className="icp-course-stats mb-3">
                                            <div className="icp-stat">
                                                <div className="icp-stat-number">{course.curriculum?.length || 0}</div>
                                                <div className="icp-stat-label">Bagian</div>
                                            </div>
                                            <div className="icp-stat">
                                                <div className="icp-stat-number">{course.lectures?.length || 0}</div>
                                                <div className="icp-stat-label">Pelajaran</div>
                                            </div>
                                            <div className="icp-stat">
                                                <div className="icp-stat-number">{course.quizzes?.length || 0}</div>
                                                <div className="icp-stat-label">Kuis</div>
                                            </div>
                                        </div>

                                        {course.review_submitted_date && (
                                            <div className="text-muted small">
                                                <i className="fas fa-calendar-alt me-1"></i>
                                                Diajukan: {new Date(course.review_submitted_date).toLocaleDateString('id-ID', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Video Pengantar Kursus */}
                        {course.file && (
                            <div className="icp-card mb-4">
                                <h3 className="icp-section-title">
                                    <i className="fas fa-video me-2"></i>
                                    Pratinjau Video Pengantar
                                </h3>
                                <div className="icp-intro-video">
                                    <div className="d-flex align-items-center justify-content-between mb-3">
                                        <div className="icp-video-source">
                                            <i className="fas fa-upload text-primary me-2"></i>
                                            <strong>Sumber:</strong>
                                            <span className="ms-2">Upload</span>
                                        </div>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => setShowIntroVideoPreview(!showIntroVideoPreview)}
                                        >
                                            <i className={`fas ${showIntroVideoPreview ? 'fa-eye-slash' : 'fa-eye'} me-1`}></i>
                                            {showIntroVideoPreview ? 'Sembunyikan' : 'Tampilkan'} Pratinjau
                                        </button>
                                    </div>
                                    {showIntroVideoPreview && (
                                        <div className="icp-video-preview mt-3">
                                            <video
                                                width="100%"
                                                    height="400"
                                                    controls
                                                    style={{ borderRadius: '8px' }}
                                                >
                                                    <source src={course.file} type="video/mp4" />
                                                    Browser Anda tidak mendukung video element.
                                                </video>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div className="icp-card mb-4">
                            <h3 className="icp-section-title">
                                <i className="fas fa-align-left me-2"></i>
                                Deskripsi Kursus
                            </h3>
                            <div className="icp-section-content">
                                {course.description ? (
                                    <div dangerouslySetInnerHTML={{ __html: course.description }} />
                                ) : (
                                    <p className="text-muted">Belum ada deskripsi</p>
                                )}
                            </div>
                        </div>

                        {/* Course Features */}
                        {course.features && course.features.length > 0 && (
                            <div className="icp-card mb-4">
                                <h3 className="icp-section-title">
                                    <i className="fas fa-star me-2"></i>
                                    Kursus ini Termasuk ({course.features.length})
                                </h3>
                                <div className="icp-features-list">
                                    {course.features.map((feature, idx) => (
                                        <div key={feature.id || `feature-${idx}`} className="icp-feature-item">
                                            {feature.icon ? (
                                                <i className={`${feature.icon} me-2`}></i>
                                            ) : (
                                                <i className="fas fa-check-circle text-success me-2"></i>
                                            )}
                                            <span>{feature.text || feature.feature || feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Course Requirements */}
                        {course.requirements && course.requirements.length > 0 && (
                            <div className="icp-card mb-4">
                                <h3 className="icp-section-title">
                                    <i className="fas fa-tasks me-2"></i>
                                    Persyaratan ({course.requirements.length})
                                </h3>
                                <div className="icp-requirements-list">
                                    {course.requirements.map((requirement, idx) => (
                                        <div key={requirement.id || `requirement-${idx}`} className="icp-requirement-item">
                                            <div className="icp-requirement-number">{idx + 1}</div>
                                            <span>{requirement.requirement || requirement}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Learning Outcomes */}
                        {course.learning_outcomes && course.learning_outcomes.length > 0 && (
                            <div className="icp-card mb-4">
                                <h3 className="icp-section-title">
                                    <i className="fas fa-graduation-cap me-2"></i>
                                    Hasil Pembelajaran ({course.learning_outcomes.length})
                                </h3>
                                <div className="icp-outcomes-list">
                                    {course.learning_outcomes.map((outcome, idx) => (
                                        <div key={outcome.id || `outcome-${idx}`} className="icp-outcome-item">
                                            <i className="fas fa-bullseye text-info me-2"></i>
                                            <span>{outcome.outcome || outcome}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Curriculum */}
                        {course.curriculum && course.curriculum.length > 0 && (
                            <div className="icp-card mb-4">
                                <h3 className="icp-section-title">
                                    <i className="fas fa-book me-2"></i>
                                    Kurikulum ({course.curriculum.length} Bagian)
                                </h3>
                                <div className="icp-curriculum">
                                    {course.curriculum.map((section, idx) => (
                                        <div key={section.id || section.variant_id || `section-${idx}`} className="icp-section mb-3">
                                            <button
                                                className="icp-section-header"
                                                onClick={() => toggleSection(section.id || section.variant_id)}
                                            >
                                                <span className="icp-section-num">Bagian {idx + 1}</span>
                                                <span className="icp-section-name">{section.title}</span>
                                                <i className={`fas fa-chevron-down ms-auto ${expandedSections[section.id || section.variant_id] ? 'expanded' : ''}`}></i>
                                            </button>

                                            {expandedSections[section.id || section.variant_id] && (
                                                <div className="icp-section-content">
                                                    {(section.items || section.variant_items || []).length === 0 ? (
                                                        <div className="icp-empty-message">
                                                            <i className="fas fa-inbox me-2"></i>
                                                            Tidak ada pelajaran dalam bagian ini
                                                        </div>
                                                    ) : (
                                                        <ul className="icp-lectures-list">
                                                            {(section.items || section.variant_items || []).map((lecture, lectureIdx) => (
                                                                <li key={lecture.id || lecture.variant_item_id || `lecture-${idx}-${lectureIdx}`} className="icp-lecture-item">
                                                                    <div className="icp-lecture-header">
                                                                        <span className="icp-lecture-num">
                                                                            {lectureIdx + 1}. {lecture.title}
                                                                        </span>
                                                                        <div className="icp-lecture-meta">
                                                                            <span className="icp-lecture-type">
                                                                                {lecture.file_type === "video" || lecture.content_type === "video" ? (
                                                                                    <>
                                                                                        <i className="fas fa-video me-1"></i>
                                                                                        Video
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <i className="fas fa-file-alt me-1"></i>
                                                                                        Dokumen
                                                                                    </>
                                                                                )}
                                                                            </span>
                                                                            {(lecture.duration_seconds || lecture.content_duration) && (
                                                                                <span className="icp-lecture-duration">
                                                                                    <i className="fas fa-hourglass-half me-1"></i>
                                                                                    {lecture.content_duration || `${Math.floor((lecture.duration_seconds || 0) / 60)}:${String(Math.floor((lecture.duration_seconds || 0) % 60)).padStart(2, '0')}`}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {lecture.description && (
                                                                        <p className="icp-lecture-detail">{lecture.description}</p>
                                                                    )}
                                                                    {lecture.file && (
                                                                        <div className="icp-lecture-video">
                                                                            {lecture.file_type === "video" || lecture.content_type === "video" || lecture.file.includes('youtube') || lecture.file.includes('youtu.be') || lecture.file.includes('drive.google') || lecture.file.includes('/d/') ? (
                                                                                <>
                                                                                    <div className="d-flex justify-content-end">
                                                                                        <button
                                                                                            className="btn btn-sm btn-primary"
                                                                                            onClick={() => toggleLecturePreview(lecture.id || lecture.variant_item_id)}
                                                                                        >
                                                                                            <i className={`fas ${expandedLecturePreview[lecture.id || lecture.variant_item_id] ? 'fa-eye-slash' : 'fa-eye'} me-1`}></i>
                                                                                            {expandedLecturePreview[lecture.id || lecture.variant_item_id] ? 'Sembunyikan' : 'Tampilkan'} Pratinjau Video
                                                                                        </button>
                                                                                    </div>
                                                                                    {expandedLecturePreview[lecture.id || lecture.variant_item_id] && (
                                                                                        <div className="icp-lecture-preview mt-3">
                                                                                            {lecture.file && (lecture.file.includes('youtube') || lecture.file.includes('youtu.be')) ? (
                                                                                                <iframe
                                                                                                    width="100%"
                                                                                                    height="300"
                                                                                                    src={lecture.file.includes('youtube.com/embed') ? lecture.file : `https://www.youtube.com/embed/${lecture.file.split('v=')[1]?.split('&')[0] || ''}`}
                                                                                                    title={lecture.title}
                                                                                                    frameBorder="0"
                                                                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                                                    allowFullScreen
                                                                                                    style={{ borderRadius: '8px' }}
                                                                                                ></iframe>
                                                                                            ) : (
                                                                                                <video
                                                                                                    width="100%"
                                                                                                    height="300"
                                                                                                    controls
                                                                                                    style={{ borderRadius: '8px' }}
                                                                                                >
                                                                                                    <source src={lecture.file} type="video/mp4" />
                                                                                                    Browser Anda tidak mendukung video element.
                                                                                                </video>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </>
                                                                            ) : (
                                                                                <a 
                                                                                    href={lecture.file} 
                                                                                    target="_blank" 
                                                                                    rel="noopener noreferrer"
                                                                                    className="btn btn-sm btn-primary"
                                                                                >
                                                                                    <i className="fas fa-download me-1"></i>
                                                                                    Download
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {/* Lesson Completion Question */}
                                                                    {lecture.completion_question && (
                                                                        <div className="icp-completion-question mt-3 p-2 bg-light rounded border-start border-success">
                                                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                                                <i className="fas fa-question-circle text-success"></i>
                                                                                <span className="fw-bold">Pertanyaan Penyelesaian Pelajaran</span>
                                                                                {lecture.completion_question.question_type_display && (
                                                                                    <span className="badge bg-success ms-auto">{lecture.completion_question.question_type_display}</span>
                                                                                )}
                                                                            </div>
                                                                            <p className="mb-2"><strong>Q:</strong> {lecture.completion_question.question_text}</p>
                                                                            {lecture.completion_question.choices && lecture.completion_question.choices.length > 0 && (
                                                                                <div className="ms-3">
                                                                                    <small className="text-muted">Pilihan:</small>
                                                                                    <ul className="mb-0 mt-1" style={{ fontSize: '0.9rem' }}>
                                                                                        {lecture.completion_question.choices.map((choice, choiceIdx) => (
                                                                                            <li key={choiceIdx}>
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
                            <div className="icp-card mb-4">
                                <h3 className="icp-section-title">
                                    <i className="fas fa-list-check me-2"></i>
                                    Kuis ({course.quizzes.length})
                                </h3>
                                <div className="icp-quizzes-list">
                                    {course.quizzes.map((quiz, idx) => (
                                        <div key={quiz.id || quiz.quiz_id || `quiz-${idx}`} className="icp-quiz-item">
                                            <button
                                                className="icp-quiz-header-btn"
                                                onClick={() => toggleQuiz(quiz.id || quiz.quiz_id)}
                                            >
                                                <span className="icp-quiz-num">Kuis {idx + 1}</span>
                                                <span className="icp-quiz-title">{quiz.title || "Kuis Tanpa Judul"}</span>
                                                {quiz.is_active !== undefined && (
                                                    <span className={`badge ${quiz.is_active ? 'bg-success' : 'bg-secondary'}`}>
                                                        {quiz.is_active ? 'Aktif' : 'Nonaktif'}
                                                    </span>
                                                )}
                                                <i className={`fas fa-chevron-down transition-icon ${expandedQuizzes[quiz.id || quiz.quiz_id] ? 'expanded' : ''}`}></i>
                                            </button>
                                            
                                            {expandedQuizzes[quiz.id || quiz.quiz_id] && (
                                                <div className="icp-quiz-content">
                                                    {quiz.description && (
                                                        <div className="alert alert-info mb-3">
                                                            <strong>Deskripsi:</strong> {quiz.description}
                                                        </div>
                                                    )}
                                                    <div className="icp-quiz-stats mb-4 justify-content-end">
                                                        <span className="badge bg-primary">
                                                            <i className="fas fa-question-circle me-1"></i>
                                                            Jumlah Pertanyaan: {quiz.question_count || quiz.questions?.length || 0}
                                                        </span>
                                                    </div>

                                                    {/* Questions and Answers */}
                                                    {quiz.questions && quiz.questions.length > 0 ? (
                                                        <div className="icp-quiz-questions">
                                                            <h5 className="mb-3"><i className="fas fa-list me-2"></i>Detail Pertanyaan & Jawaban</h5>
                                                            {quiz.questions.map((question, qIdx) => (
                                                                <div key={question.id || question.question_id || `question-${idx}-${qIdx}`} className="icp-question-item mb-4">
                                                                    <div className="icp-question-header">
                                                                        <span className="icp-question-num">Pertanyaan {qIdx + 1}</span>
                                                                        <p className="icp-question-text">{question.question_text}</p>
                                                                    </div>
                                                                    <div className="icp-choices">
                                                                        {question.choices && question.choices.length > 0 ? (
                                                                            question.choices.map((choice, cIdx) => (
                                                                                <div
                                                                                    key={choice.id || choice.choice_id || `choice-${cIdx}`}
                                                                                    className={`icp-choice-item ${choice.is_correct ? 'correct' : ''}`}
                                                                                >
                                                                                    <div className="icp-choice-indicator">
                                                                                        {choice.is_correct ? (
                                                                                            <i className="fas fa-check-circle text-success"></i>
                                                                                        ) : (
                                                                                            <i className="fas fa-circle text-muted"></i>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="icp-choice-content">
                                                                                        <div className="icp-choice-letter">{String.fromCharCode(65 + cIdx)}.</div>
                                                                                        <div className="icp-choice-text">{choice.choice_text}</div>
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

                        {/* Status Indicator */}
                        <div className="icp-card mt-4 bg-light border-0">
                            <div className="d-flex align-items-center justify-content-between">
                                <div>
                                    <h5 className="mb-2">
                                        <i className="fas fa-info-circle me-2 text-info"></i>
                                        Status Pratinjau
                                    </h5>
                                    <p className="text-muted small mb-0">
                                        Ini adalah pratinjau kursus Anda dalam mode read-only. Untuk melakukan perubahan, kembali ke halaman edit kursus.
                                    </p>
                                </div>
                                <button 
                                    className="btn btn-primary"
                                    onClick={() => navigate("/instructor/edit-course/" + course_id + "/")}
                                >
                                    <i className="fas fa-edit me-2"></i>
                                    Edit Kursus
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

export default React.memo(InstructorCoursePreview);
