import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Theme utility hook to manage user-based theming
export const useTheme = () => {
    const location = useLocation();

    useEffect(() => {
        // Detect user type based on current route
        const isInstructorRoute = location.pathname.includes('/instructor/') || 
                                 location.pathname.includes('/teacher/');
        const isStudentRoute = location.pathname.includes('/student/');

        // Apply theme class to body
        const body = document.body;
        
        // Remove existing theme classes
        body.classList.remove('instructor-theme', 'student-theme');
        
        // Apply appropriate theme
        if (isInstructorRoute) {
            body.classList.add('instructor-theme');
        } else if (isStudentRoute) {
            body.classList.add('student-theme');
        } else {
            // Default to student theme for public pages
            body.classList.add('student-theme');
        }
    }, [location.pathname]);

    // Return current theme info for components that need it
    const isInstructor = location.pathname.includes('/instructor/') || 
                        location.pathname.includes('/teacher/');
    const isStudent = location.pathname.includes('/student/');
    
    return {
        isInstructor,
        isStudent,
        currentTheme: isInstructor ? 'instructor' : 'student'
    };
};

// Utility function to manually set theme (if needed)
export const setTheme = (themeType) => {
    const body = document.body;
    body.classList.remove('instructor-theme', 'student-theme');
    
    if (themeType === 'instructor') {
        body.classList.add('instructor-theme');
    } else {
        body.classList.add('student-theme');
    }
};

// Theme constants for easy access
export const THEMES = {
    INSTRUCTOR: 'instructor',
    STUDENT: 'student'
};

export default useTheme;