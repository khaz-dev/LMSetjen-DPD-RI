import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Theme utility hook to manage user-based theming
export const useTheme = () => {
    const location = useLocation();

    useEffect(() => {
        // Detect user type based on current route
        const isAdminRoute = location.pathname.includes('/admin/');
        const isInstructorRoute = location.pathname.includes('/instructor/') || 
                                 location.pathname.includes('/teacher/');
        const isStudentRoute = location.pathname.includes('/student/');

        // Apply theme class to body
        const body = document.body;
        
        // Remove existing theme classes
        body.classList.remove('instructor-theme', 'student-theme');
        
        // Apply appropriate theme
        // IMPORTANT: Admin routes should NOT have instructor/student themes applied
        // This ensures admin dropdown styling is not overridden
        if (isAdminRoute) {
            // Admin pages don't use theme color variables, just remove all theme classes
            // This prevents instructor-theme CSS from interfering with admin styling
        } else if (isInstructorRoute) {
            body.classList.add('instructor-theme');
        } else if (isStudentRoute) {
            body.classList.add('student-theme');
        } else {
            // Default to student theme for public pages
            body.classList.add('student-theme');
        }
    }, [location.pathname]);

    // Return current theme info for components that need it
    const isAdmin = location.pathname.includes('/admin/');
    const isInstructor = location.pathname.includes('/instructor/') || 
                        location.pathname.includes('/teacher/');
    const isStudent = location.pathname.includes('/student/');
    
    return {
        isAdmin,
        isInstructor,
        isStudent,
        currentTheme: isAdmin ? 'admin' : (isInstructor ? 'instructor' : 'student')
    };
};

// Utility function to manually set theme (if needed)
export const setTheme = (themeType) => {
    const body = document.body;
    body.classList.remove('instructor-theme', 'student-theme');
    
    if (themeType === 'instructor') {
        body.classList.add('instructor-theme');
    } else if (themeType === 'student') {
        body.classList.add('student-theme');
    }
    // NOTE: Admin theme doesn't add any classes - it's just the absence of instructor/student themes
};

// Theme constants for easy access
export const THEMES = {
    ADMIN: 'admin',
    INSTRUCTOR: 'instructor',
    STUDENT: 'student'
};

export default useTheme;