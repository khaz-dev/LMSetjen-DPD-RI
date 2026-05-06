import { useContext, useEffect, useState, useRef } from "react";
// ✨ PHASE 11.12: Import PageCacheContext from correct path
import { PageCacheContext } from "../views/plugin/PageCacheContext";

/**
 * usePageCache - Custom hook for seamless page data caching across navigation
 * 
 * PHASE 11.12: Seamless page navigation without reloading
 * 
 * Usage:
 * const { data, loading, error, refetch } = usePageCache(
 *   'dashboard-page',  // Unique cache key for this page
 *   async () => fetchData(),  // Async function to fetch data
 *   { showLoadingOnStale: false }  // Options
 * );
 * 
 * Behavior:
 * 1. On mount: Shows cached data immediately (no loading spinner)
 * 2. Meanwhile: Fetches fresh data in background
 * 3. If fresh data differs: Updates to new data (no loading spinner)
 * 4. First ever load: Shows loading spinner while fetching
 * 5. 5+ min old: Refetches in background
 */
export function usePageCache(
    pageKey,
    fetchFn,
    options = {}
) {
    const {
        showLoadingOnStale = false,  // Whether to show loading spinner when cache is stale
        onDataChange = null  // Optional callback when data changes
    } = options;

    const pageCache = useContext(PageCacheContext);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const isMountedRef = useRef(true);
    const isFetchingRef = useRef(false);

    // Check for cached data on mount
    useEffect(() => {
        isMountedRef.current = true;

        const initializeData = async () => {
            try {
                // Try to get cached data
                const cachedData = pageCache.getCache(pageKey);

                // Set initial state based on cache
                if (cachedData) {
                    // We have cached data - use it immediately
                    setData(cachedData);
                    setLoading(false);
                    setError(null);
                } else {
                    // No cache - show loading
                    setLoading(true);
                }

                // Always fetch fresh data (either for first load or background refresh)
                if (!isFetchingRef.current) {
                    isFetchingRef.current = true;
                    try {
                        const freshData = await fetchFn();

                        if (!isMountedRef.current) return;

                        // Update cache with fresh data
                        pageCache.setCache(pageKey, freshData);

                        // Update state with fresh data
                        setData(freshData);
                        setLoading(false);
                        setError(null);

                        // Trigger callback if provided
                        if (onDataChange) {
                            onDataChange(freshData, false);
                        }
                    } catch (err) {
                        if (!isMountedRef.current) return;

                        setError(err);
                        setLoading(false);

                        // Only show error if we don't have cached data to fall back to
                        if (!cachedData) {
                            setError(err);
                        }

                        if (onDataChange) {
                            onDataChange(null, true);
                        }
                    } finally {
                        isFetchingRef.current = false;
                    }
                }
            } catch (err) {
                if (!isMountedRef.current) return;
                setError(err);
                setLoading(false);
            }
        };

        initializeData();

        return () => {
            isMountedRef.current = false;
        };
    }, [pageKey, pageCache]);  // ✨ FIXED: Removed fetchFn & onDataChange - they cause infinite loops

    /**
     * Manual refetch function
     * Always shows loading spinner and fetches fresh data
     */
    const refetch = async (showLoading = true) => {
        try {
            if (showLoading) {
                setLoading(true);
            }
            setError(null);

            const freshData = await fetchFn();

            if (!isMountedRef.current) return;

            // Update cache and state
            pageCache.setCache(pageKey, freshData);
            setData(freshData);
            setLoading(false);

            if (onDataChange) {
                onDataChange(freshData, false);
            }

            return freshData;
        } catch (err) {
            if (!isMountedRef.current) return;

            setError(err);
            setLoading(false);

            if (onDataChange) {
                onDataChange(null, true);
            }

            throw err;
        }
    };

    /**
     * Clear cache for this page
     */
    const clearCache = () => {
        pageCache.clearCache(pageKey);
        setData(null);
        setLoading(true);
        setError(null);
    };

    return {
        data,
        loading,
        error,
        refetch,
        clearCache,
        isCacheStale: pageCache.isCacheStale(pageKey)
    };
}
