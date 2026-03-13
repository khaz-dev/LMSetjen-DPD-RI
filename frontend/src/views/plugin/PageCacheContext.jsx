import { createContext, useState, useRef, useCallback } from "react";

/**
 * PageCacheContext - Maintains a global cache of page data that persists across component unmounts
 * This prevents unnecessary data re-fetching when navigating between pages and returning
 * 
 * PHASE 11.12: Seamless page navigation without reloading
 */
export const PageCacheContext = createContext();

export function PageCacheProvider({ children }) {
    // Cache structure: { [pageKey]: { data: any, timestamp: number, isStale: boolean } }
    const cacheRef = useRef({});
    const [, setUpdateTrigger] = useState(0);

    /**
     * Get cached data for a page
     * Returns null if data doesn't exist or is older than 5 minutes
     */
    const getCache = useCallback((pageKey) => {
        const cached = cacheRef.current[pageKey];
        if (!cached) return null;

        // Check if cache is stale (older than 5 minutes)
        const cacheAge = Date.now() - cached.timestamp;
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

        if (cacheAge > CACHE_TTL) {
            // Mark as stale but don't delete it yet - return stale data
            cached.isStale = true;
            return cached.data; // Return stale data anyway for immediate display
        }

        cached.isStale = false;
        return cached.data;
    }, []);

    /**
     * Set cache for a page with timestamp
     */
    const setCache = useCallback((pageKey, data) => {
        cacheRef.current[pageKey] = {
            data,
            timestamp: Date.now(),
            isStale: false
        };
        // Trigger re-render so components get updated data
        setUpdateTrigger(prev => prev + 1);
    }, []);

    /**
     * Check if cached data is stale
     */
    const isCacheStale = useCallback((pageKey) => {
        const cached = cacheRef.current[pageKey];
        if (!cached) return true;

        const cacheAge = Date.now() - cached.timestamp;
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        return cacheAge > CACHE_TTL;
    }, []);

    /**
     * Clear cache for a specific page
     */
    const clearCache = useCallback((pageKey) => {
        delete cacheRef.current[pageKey];
        setUpdateTrigger(prev => prev + 1);
    }, []);

    /**
     * Clear all cache
     */
    const clearAllCache = useCallback(() => {
        cacheRef.current = {};
        setUpdateTrigger(prev => prev + 1);
    }, []);

    const value = {
        getCache,
        setCache,
        isCacheStale,
        clearCache,
        clearAllCache
    };

    return (
        <PageCacheContext.Provider value={value}>
            {children}
        </PageCacheContext.Provider>
    );
}
