import React, { memo, useState } from 'react';
import dayjs, { moment } from '../utils/dayjs';
import { Link, useNavigate } from 'react-router-dom';
import { getImageUrl, getStatusBadgeStyle, getLevelBadgeStyle, getLevelText, getStatusText, getActualCourseStatus } from '../utils/courseUtils.js';
import { calculateTotalDuration, parseDurationToSeconds } from '../utils/durationUtils'; // ✨ PHASE 4.77+: Add parseDurationToSeconds for JP
import useAxios from '../utils/useAxios';
import Toast from '../views/plugin/Toast';

import './CourseCard.css';

const CourseCard = ({ course, index }) => {
    const navigate = useNavigate();
    const [editingCourse, setEditingCourse] = useState(false);
    // Calculate course completion
    const hasCurriculum = course.curriculum?.length > 0;
    const hasLessons = course.curriculum?.some(variant => variant.items?.length > 0);
    
    // ✨ PHASE 4.54 FIX: Changed from question_answer to quizzes - question_answer is for Q&A discussions, not quizzes
    // quizzes can be a number (from CourseSerializer.get_quizzes returns count) or array (from CourseEditSerializer)
    const hasQuiz = (() => {
        if (!course.quizzes) return false;
        if (typeof course.quizzes === 'number') {
            return course.quizzes > 0;
        }
        if (Array.isArray(course.quizzes)) {
            return course.quizzes.length > 0;
        }
        if (typeof course.quizzes === 'object') {
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
    const isDraft = course.teacher_course_status === 'Draft';
    
    // ✨ PHASE 4.77+: Calculate total JP (Jam Pelajaran) from course lectures
    const calculateTotalJP = (lectures) => {
        if (!lectures || !Array.isArray(lectures)) return 0;
        
        let totalSeconds = 0;
        lectures.forEach(lecture => {
            if (lecture.content_duration) {
                totalSeconds += parseDurationToSeconds(lecture.content_duration);
            }
        });
        
        return Math.ceil(totalSeconds / 2700); // 1 JP = 45 minutes = 2700 seconds
    };
    
    // ✨ PHASE 4.76: Check if this is a published course
    const isPublished = course.is_published_version === true;
    
    // ✨ PHASE 4.76 IMPROVED: Single Edit button - creates draft automatically for published courses
    const handleEditCourse = async (e) => {
        e.preventDefault();
        
        try {
            // If course is published, create/fetch draft first
            if (isPublished) {
                setEditingCourse(true);
                const response = await useAxios.post(`teacher/course-edit-published/${course.course_id}/`);
                
                if (response.data?.success) {
                    const draftCourseId = response.data.course?.course_id;
                    const isNew = response.data.is_new;
                    
                    // Show appropriate message
                    if (isNew) {
                        Toast().fire({
                            icon: 'success',
                            title: 'Draft Berhasil Dibuat',
                            text: 'Anda sekarang dapat mengedit kursus ini'
                        });
                    }
                    
                    // Navigate to edit page
                    setTimeout(() => {
                        navigate(`/instructor/edit-course/${draftCourseId}/`);
                    }, 500);
                } else {
                    Toast().fire({
                        icon: 'error',
                        title: 'Error',
                        text: response.data?.message || 'Gagal membuat draft kursus'
                    });
                }
            } else {
                // For draft courses, navigate directly
                navigate(`/instructor/edit-course/${course.course_id}/`);
            }
        } catch (error) {
            console.error('Error editing course:', error);
            Toast().fire({
                icon: 'error',
                title: 'Error',
                text: 'Gagal membuka editor kursus. Silakan coba lagi.'
            });
        } finally {
            setEditingCourse(false);
        }
    };
    
    // ✨ PHASE 4.40: Get actual course status considering platform_status, rejection_reason, and teacher_course_status
    const courseStatus = getActualCourseStatus(course);
    
    // Determine next step
    const getNextStep = () => {
        if (!hasCurriculum) {
            return {
                label: 'Tambah Kurikulum',
                icon: 'fa-list',
                link: `/instructor/edit-course/${course.course_id}/curriculum/`,
                color: '#4CAF50'
            };
        }
        if (!hasLessons) {
            return {
                label: 'Tambah Pelajaran',
                icon: 'fa-video',
                link: `/instructor/edit-course/${course.course_id}/curriculum/`,
                color: '#0f766e'
            };
        }
        if (!hasQuiz) {
            return {
                label: 'Tambah Kuis',
                icon: 'fa-question-circle',
                link: `/instructor/edit-course/${course.course_id}/quiz/`,
                color: '#FF9800'
            };
        }
        return {
            label: 'Siap Dipublikasikan',
            icon: 'fa-check-circle',
            link: `/instructor/edit-course/${course.course_id}/`,
            color: '#8BC34A'
        };
    };
    
    const nextStep = getNextStep();
    
    return (
        <div key={course.course_id || course.id || index} className="col-xl-6 col-lg-12 col-md-12">
            <div className="modern-course-card">
                <div className="course-image-container mb-0" style={{ position: 'relative' }}>
                    <img
                        src={getImageUrl(course.image)}
                        alt={course.title || "Course"}
                        className="course-image"
                        onError={(e) => {
                            e.target.src = "https://www.eclosio.ong/wp-content/uploads/2018/08/default.png";
                        }}
                    />
                    
                    {/* Status Badge */}
                    <span 
                        className="badge status-badge" 
                        style={{ 
                            background: courseStatus.color,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <i className={`fas ${courseStatus.icon}`}></i>
                        {courseStatus.text}
                    </span>

                    {/* Level Badge */}
                    <span 
                        className="badge level-badge" 
                        style={{ background: getLevelBadgeStyle(course.level) }}
                    >
                        {getLevelText(course.level)}
                    </span>
                </div>

                <div className="course-content" style={{ padding: '25px' }}>
                    <div className="d-flex align-items-center gap-3 mb-3">
                        <div className="category-tag">
                            <i className="fas fa-tag me-1"></i>
                            {course.category?.title || "Umum"}
                        </div>
                        <div className="students-count">
                            <i className="fas fa-users me-1"></i>
                            {course.students?.length || 0} Siswa
                        </div>
                        {/* Duration Display with JP - ✨ PHASE 4.77+ */}
                        {course.lectures && course.lectures.length > 0 && (
                            <div className="course-duration">
                                <i className="fas fa-clock me-1"></i>
                                {calculateTotalDuration(course.lectures).formatted} ({calculateTotalJP(course.lectures)} JP)
                            </div>
                        )}
                    </div>

                    <h4 className="course-title mb-2">
                        {course.title || "Kursus Tanpa Judul"}
                    </h4>

                    <div className="course-date mb-3">
                        <i className="fas fa-calendar-alt me-2"></i>
                        Dibuat {course.date ? moment(course.date).format("DD MMM, YYYY") : "Tidak Tersedia"}
                    </div>

                    {/* Progress Indicator for Draft Courses */}
                    {!isPublished && courseStatus.status === 'Draft' && (
                        <div className="mb-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <small className="text-muted fw-bold">Kemajuan Kursus</small>
                                <small className="fw-bold" style={{ color: nextStep.color }}>{progress}%</small>
                            </div>
                            <div className="progress" style={{ height: '8px', borderRadius: '10px' }}>
                                <div 
                                    className="progress-bar" 
                                    role="progressbar" 
                                    style={{ 
                                        width: `${progress}%`,
                                        background: `linear-gradient(90deg, ${nextStep.color} 0%, ${nextStep.color}dd 100%)`,
                                        borderRadius: '10px'
                                    }}
                                    aria-valuenow={progress} 
                                    aria-valuemin="0" 
                                    aria-valuemax="100"
                                ></div>
                            </div>
                            <div className="mt-2">
                                <Link 
                                    to={nextStep.link} 
                                    className="btn btn-sm w-100"
                                    style={{
                                        background: nextStep.color,
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        fontWeight: '600',
                                        fontSize: '0.85rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                                    onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                                >
                                    <i className={`fas ${nextStep.icon}`}></i>
                                    {nextStep.label}
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="course-actions d-flex gap-2">
                        {/* ✨ PHASE 4.76 IMPROVED: Single Edit button for all courses */}
                        <button 
                            className="btn course-action-btn course-action-btn-sm btn-edit flex-fill"
                            onClick={handleEditCourse}
                            disabled={editingCourse}
                        >
                            <i className={`fas ${editingCourse ? 'fa-spinner fa-spin' : 'fa-edit'} me-1`}></i>
                            {editingCourse ? 'Membuka...' : 'Edit'}
                        </button>
                        
                        <button 
                            className="btn course-action-btn course-action-btn-sm btn-view"
                            onClick={() => window.location.href = `/course-detail/${course.slug}/`}
                        >
                            <i className="fas fa-eye me-1"></i>
                            Lihat
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(CourseCard);