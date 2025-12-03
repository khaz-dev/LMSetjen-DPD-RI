import React, { memo } from 'react';
import dayjs, { moment } from '../utils/dayjs';
import { Link } from 'react-router-dom';
import { getImageUrl, getStatusBadgeStyle, getLevelBadgeStyle, getLevelText, handleDeleteCourse } from '../utils/courseUtils.js';
import { calculateTotalDuration } from '../utils/durationUtils';

import './CourseCard.css';

const CourseCard = ({ course, index, onDelete }) => {
    // Calculate course completion
    const hasCurriculum = course.curriculum?.length > 0;
    const hasLessons = course.curriculum?.some(variant => variant.items?.length > 0);
    const hasQuiz = course.question_answer?.length > 0;
    
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
    
    // Determine next step
    const getNextStep = () => {
        if (!hasCurriculum) {
            return {
                label: 'Add Curriculum',
                icon: 'fa-list',
                link: `/instructor/edit-course/${course.course_id}/curriculum/`,
                color: '#4CAF50'
            };
        }
        if (!hasLessons) {
            return {
                label: 'Add Lessons',
                icon: 'fa-video',
                link: `/instructor/edit-course/${course.course_id}/curriculum/`,
                color: '#2196F3'
            };
        }
        if (!hasQuiz) {
            return {
                label: 'Add Quiz',
                icon: 'fa-question-circle',
                link: `/instructor/edit-course/${course.course_id}/quiz/`,
                color: '#FF9800'
            };
        }
        return {
            label: 'Ready to Publish',
            icon: 'fa-check-circle',
            link: `/instructor/edit-course/${course.course_id}/`,
            color: '#8BC34A'
        };
    };
    
    const nextStep = getNextStep();
    
    return (
        <div key={course.course_id || course.id || index} className="col-xl-6 col-lg-6 col-md-6 col-sm-12">
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
                            background: isDraft ? '#FF9800' : '#4CAF50',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <i className={`fas ${isDraft ? 'fa-clock' : 'fa-check-circle'}`}></i>
                        {course.teacher_course_status || 'Published'}
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
                            {course.category?.title || "General"}
                        </div>
                        <div className="students-count">
                            <i className="fas fa-users me-1"></i>
                            {course.students?.length || 0} Students
                        </div>
                        {/* Duration Display */}
                        {course.lectures && course.lectures.length > 0 && (
                            <div className="course-duration">
                                <i className="fas fa-clock me-1"></i>
                                {calculateTotalDuration(course.lectures)}
                            </div>
                        )}
                    </div>

                    <h4 className="course-title mb-2">
                        {course.title || "Untitled Course"}
                    </h4>

                    <div className="course-date mb-3">
                        <i className="fas fa-calendar-alt me-2"></i>
                        Created {course.date ? moment(course.date).format("DD MMM, YYYY") : "N/A"}
                    </div>

                    {/* Progress Indicator for Draft Courses */}
                    {isDraft && (
                        <div className="mb-3">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <small className="text-muted fw-bold">Course Progress</small>
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
                        <Link 
                            to={`/instructor/edit-course/${course.course_id}/`} 
                            className="btn course-action-btn course-action-btn-sm btn-edit flex-fill"
                        >
                            <i className="fas fa-edit me-1"></i>
                            Edit
                        </Link>
                        
                        <button 
                            className="btn course-action-btn course-action-btn-sm btn-view"
                            onClick={() => window.location.href = `/course-detail/${course.slug}/`}
                        >
                            <i className="fas fa-eye me-1"></i>
                            View
                        </button>
                        
                        <button 
                            className="btn course-action-btn course-action-btn-sm btn-delete"
                            onClick={() => handleDeleteCourse(course.course_id, course.title, onDelete)}
                        >
                            <i className="fas fa-trash me-1"></i>
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(CourseCard);