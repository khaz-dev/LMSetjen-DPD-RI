import React from 'react';
import { Link } from 'react-router-dom';
import './WorkflowStepper.css';

const WorkflowStepper = ({ currentStep, courseId, courseData }) => {
    // Ensure courseData is always an object (handle null, undefined, etc.)
    const course = courseData || {};
    
    // Helper function to check if curriculum has content
    const hasCurriculumContent = () => {
        if (!course.curriculum || !Array.isArray(course.curriculum)) return false;
        
        // Check if there's at least one section with at least one lesson
        return course.curriculum.some(variant => {
            return variant.variant_items && 
                   Array.isArray(variant.variant_items) && 
                   variant.variant_items.length > 0;
        });
    };
    
    // Helper function to check if quizzes exist
    const hasQuizzes = () => {
        if (!course.quizzes) return false;
        
        // Handle both array and object formats
        if (Array.isArray(course.quizzes)) {
            return course.quizzes.length > 0;
        }
        
        // If it's an object (from serializer), check if it has any items
        if (typeof course.quizzes === 'object') {
            return Object.keys(course.quizzes).length > 0;
        }
        
        return false;
    };
    
    const steps = [
        {
            id: 1,
            name: 'Basic Info',
            icon: 'fa-info-circle',
            path: `/instructor/edit-course/${courseId}/`,
            description: 'Course details',
            isComplete: !!(course.title && course.description && course.category)
        },
        {
            id: 2,
            name: 'Curriculum',
            icon: 'fa-list',
            path: `/instructor/edit-course/${courseId}/curriculum/`,
            description: 'Sections & lessons',
            isComplete: hasCurriculumContent()
        },
        {
            id: 3,
            name: 'Quiz',
            icon: 'fa-question-circle',
            path: `/instructor/edit-course/${courseId}/quiz/`,
            description: 'Assessments',
            isComplete: hasQuizzes()
        },
        {
            id: 4,
            name: 'Publish',
            icon: 'fa-rocket',
            path: `/instructor/edit-course/${courseId}/`,
            description: 'Go live',
            isComplete: course.teacher_course_status === 'Published'
        }
    ];

    return (
        <div className="workflow-stepper-container mb-4">
            <div className="workflow-stepper">
                {steps.map((step, index) => {
                    const isActive = step.id === currentStep;
                    const isPast = step.id < currentStep;
                    const isAccessible = isPast || isActive || (index > 0 && steps[index - 1].isComplete);
                    
                    return (
                        <React.Fragment key={step.id}>
                            <div className={`stepper-step ${isActive ? 'active' : ''} ${isPast ? 'completed' : ''} ${!isAccessible ? 'disabled' : ''}`}>
                                {isAccessible ? (
                                    <Link to={step.path} className="step-link">
                                        <div className="step-circle">
                                            {step.isComplete ? (
                                                <i className="fas fa-check"></i>
                                            ) : (
                                                <i className={`fas ${step.icon}`}></i>
                                            )}
                                        </div>
                                        <div className="step-content">
                                            <div className="step-name">{step.name}</div>
                                            <div className="step-description">{step.description}</div>
                                        </div>
                                    </Link>
                                ) : (
                                    <div className="step-link disabled">
                                        <div className="step-circle">
                                            <i className={`fas ${step.icon}`}></i>
                                        </div>
                                        <div className="step-content">
                                            <div className="step-name">{step.name}</div>
                                            <div className="step-description">{step.description}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {index < steps.length - 1 && (
                                <div className={`stepper-line ${step.isComplete ? 'completed' : ''}`}></div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default WorkflowStepper;
