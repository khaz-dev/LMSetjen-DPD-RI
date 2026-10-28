import { useState, useEffect } from 'react';

/**
 * Custom hook to manage sticky hero behavior identical to Search page
 * Pinned under BaseHeader with dynamic height detection and scroll observer
 * 
 * @param {number} scrollThreshold - scroll threshold in px to activate stuck mode (default: 55)
 * @returns {{ isScrolled: boolean, headerHeight: number }}
 */
export default function useStickyHero(scrollThreshold = 55) {
    const [headerHeight, setHeaderHeight] = useState(60);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const updateHeaderHeight = () => {
            const headerEl = document.querySelector('.base-header');
            if (headerEl) {
                setHeaderHeight(headerEl.offsetHeight);
            }
        };

        updateHeaderHeight();

        let ro = null;
        const headerEl = document.querySelector('.base-header');
        if (headerEl && typeof window !== 'undefined' && window.ResizeObserver) {
            ro = new ResizeObserver(updateHeaderHeight);
            ro.observe(headerEl);
        }

        window.addEventListener('resize', updateHeaderHeight);
        return () => {
            if (ro) ro.disconnect();
            window.removeEventListener('resize', updateHeaderHeight);
        };
    }, []);

    useEffect(() => {
        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    setIsScrolled(window.scrollY >= scrollThreshold);
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        return () => window.removeEventListener('scroll', handleScroll);
    }, [scrollThreshold]);

    return { isScrolled, headerHeight };
}
