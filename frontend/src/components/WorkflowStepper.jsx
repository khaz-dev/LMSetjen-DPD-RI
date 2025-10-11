import React from 'react';
import { Link } from 'react-router-dom';
import './WorkflowStepper.css';

const WorkflowStepper = ({ currentStep, courseId, courseData }) => {
    // Ensure courseData is always an object (handle null, undefined, etc.)
    const course = courseData || {};
    
    // Helper function to check if basic info is complete
    const hasBasicInfo = () => {
        // Check essential fields: title, description, category
        const hasTitle = course.title && course.title.trim().length > 0;
        const hasDescription = course.description && course.description.trim().length > 0;
        
        // Handle both category object and category ID
        const hasCategory = !!(
            (course.category && typeof course.category === 'object' && course.category.id) ||
            (course.category && typeof course.category === 'number' && course.category > 0) ||
            (course.category && typeof course.category === 'string' && course.category !== '')
        );
        
        return hasTitle && hasDescription && hasCategory;
    };
    
    // Helper function to check if curriculum has content
    const hasCurriculumContent = () => {
        // Handle null/undefined curriculum
        if (!course.curriculum) return false;
        
        // Handle array format (from API)
        if (Array.isArray(course.curriculum)) {
            if (course.curriculum.length === 0) return false;
            
            // Check if there's at least one section with at least one lesson
            return course.curriculum.some(variant => {
                // Check variant_items (from API) or items (from local state)
                const items = variant.variant_items || variant.items;
                return items && Array.isArray(items) && items.length > 0;
            });
        }
        
        // Handle object format
        if (typeof course.curriculum === 'object') {
            const sections = Object.values(course.curriculum);
            if (sections.length === 0) return false;
            
            return sections.some(variant => {
                const items = variant.variant_items || variant.items;
                return items && Array.isArray(items) && items.length > 0;
            });
        }
        
        return false;
    };
    
    // Helper function to check if quizzes exist
    const hasQuizzes = () => {
        if (!course.quizzes) return false;
        
        // Handle array format
        if (Array.isArray(course.quizzes)) {
            return course.quizzes.length > 0;
        }
        
        // Handle object format (from serializer)
        if (typeof course.quizzes === 'object') {
            const quizList = Object.values(course.quizzes);
            return quizList.length > 0;
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
            isComplete: hasBasicInfo()
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
            isComplete: course.teacher_course_status === 'Published' || course.platform_status === 'Published'
        }
    ];

    return (
        <div className="workflow-stepper-container mb-4">
            <div className="workflow-stepper">
                {steps.map((step, index) => {
                    const isActive = step.id === currentStep;
                    const isPast = step.id < currentStep;
                    // Allow access if: it's a past step, current step, or previous step is complete
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
