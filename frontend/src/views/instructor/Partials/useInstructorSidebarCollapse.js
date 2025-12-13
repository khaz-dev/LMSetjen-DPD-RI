import { useState, useEffect } from 'react';

/**
 * Hook to track instructor sidebar collapse state across all pages
 * Updates when sidebar is toggled via localStorage
 * 
 * @returns {boolean} isCollapsed - Whether the sidebar is collapsed
 * 
 * Usage:
 * const isCollapsed = useInstructorSidebarCollapse();
 * 
 * Then use in className or inline styles:
 * className={isCollapsed ? 'col-lg-12' : 'col-lg-9'}
 */
export function useInstructorSidebarCollapse() {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('instructorSidebarCollapsed');
        return saved === 'true';
    });

    useEffect(() => {
        // Listen for storage changes (when sidebar is toggled in another component)
        const handleStorageChange = () => {
            const saved = localStorage.getItem('instructorSidebarCollapsed');
            setIsCollapsed(saved === 'true');
        };

        // Listen for storage events (changes from other tabs/windows)
        window.addEventListener('storage', handleStorageChange);

        // Custom event listener for same-tab updates
        window.addEventListener('instructorSidebarCollapsedChanged', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('instructorSidebarCollapsedChanged', handleStorageChange);
        };
    }, []);

    return isCollapsed;
}

/**
 * Trigger a custom event when sidebar collapse state changes
 * Call this from Sidebar component after updating localStorage
 */
export function triggerInstructorSidebarCollapseEvent() {
    window.dispatchEvent(new Event('instructorSidebarCollapsedChanged'));
}
