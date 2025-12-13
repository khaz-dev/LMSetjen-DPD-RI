import { useState, useEffect } from 'react';

/**
 * Hook to track student sidebar collapse state across all pages
 * Updates when sidebar is toggled via localStorage
 * 
 * @returns {boolean} isCollapsed - Whether the sidebar is collapsed
 * 
 * Usage:
 * const isCollapsed = useSidebarCollapse();
 * 
 * Then use in className or inline styles:
 * className={isCollapsed ? 'col-lg-12' : 'col-lg-9'}
 */
export function useSidebarCollapse() {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('studentSidebarCollapsed');
        return saved === 'true';
    });

    useEffect(() => {
        // Listen for storage changes (when sidebar is toggled in another component)
        const handleStorageChange = () => {
            const saved = localStorage.getItem('studentSidebarCollapsed');
            setIsCollapsed(saved === 'true');
        };

        // Listen for storage events (changes from other tabs/windows)
        window.addEventListener('storage', handleStorageChange);

        // Custom event listener for same-tab updates
        window.addEventListener('sidebarCollapsedChanged', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('sidebarCollapsedChanged', handleStorageChange);
        };
    }, []);

    return isCollapsed;
}

/**
 * Trigger a custom event when sidebar collapse state changes
 * Call this from Sidebar component after updating localStorage
 */
export function triggerSidebarCollapseEvent() {
    window.dispatchEvent(new Event('sidebarCollapsedChanged'));
}
