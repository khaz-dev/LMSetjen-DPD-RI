import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * useDebounce Hook
 * Debounces a value to avoid excessive updates
 *
 * Usage:
 * const debouncedQuery = useDebounce(query, 300);
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set up the timeout
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up the timeout if value changes before delay expires
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * useDebouncedCallback Hook
 * Debounces a callback function
 *
 * Usage:
 * const debouncedSearch = useDebouncedCallback((query) => {
 *   performSearch(query);
 * }, 300);
 */
export const useDebouncedCallback = (callback, delay = 300, deps = []) => {
  const timeoutRef = useRef(null);

  const debouncedCallback = useCallback(
    (...args) => {
      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

/**
 * useThrottle Hook
 * Throttles a value to limit update frequency
 *
 * Usage:
 * const throttledScroll = useThrottle(scrollPosition, 100);
 */
export const useThrottle = (value, interval = 300) => {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastUpdated = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();

    if (now >= lastUpdated.current + interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      // Schedule update for later
      const timeout = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval);

      return () => clearTimeout(timeout);
    }
  }, [value, interval]);

  return throttledValue;
};

/**
 * useThrottledCallback Hook
 * Throttles a callback function
 *
 * Usage:
 * const throttledScroll = useThrottledCallback(() => {
 *   handleScroll();
 * }, 100);
 */
export const useThrottledCallback = (callback, delay = 300, deps = []) => {
  const lastRun = useRef(Date.now());

  return useCallback(
    (...args) => {
      const now = Date.now();

      if (now >= lastRun.current + delay) {
        lastRun.current = now;
        callback(...args);
      }
    },
    [callback, delay] // eslint-disable-line react-hooks/exhaustive-deps
  );
};

/**
 * useRequestCache Hook
 * Caches API request results in memory
 * Useful for avoiding duplicate requests
 *
 * Usage:
 * const { cached, setCached, getCached } = useRequestCache(cacheKey);
 */
export const useRequestCache = (cacheKey) => {
  const cache = useRef(new Map());

  const getCached = useCallback(() => {
    const entry = cache.current.get(cacheKey);

    // Check if cache entry is still valid (5 minutes)
    if (entry && Date.now() - entry.timestamp < 5 * 60 * 1000) {
      return entry.data;
    }

    return null;
  }, [cacheKey]);

  const setCached = useCallback(
    (data) => {
      cache.current.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
    },
    [cacheKey]
  );

  const clearCache = useCallback(() => {
    cache.current.delete(cacheKey);
  }, [cacheKey]);

  return { getCached, setCached, clearCache };
};

/**
 * useAbortController Hook
 * Manages abort controllers for cancellable requests
 *
 * Usage:
 * const abort = useAbortController();
 * axios.get(url, { signal: abort.signal })
 * // On cleanup or cancel:
 * abort.cancel();
 */
export const useAbortController = () => {
  const abortControllerRef = useRef(new AbortController());

  const cancel = useCallback(() => {
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current.abort();
    };
  }, []);

  return {
    signal: abortControllerRef.current.signal,
    cancel,
    get isAborted() {
      return abortControllerRef.current.signal.aborted;
    }
  };
};

/**
 * useOptimizedSearch Hook
 * Combines debouncing, caching, and request cancellation
 * for optimized search functionality
 *
 * Usage:
 * const { execute, loading, error, data } = useOptimizedSearch(performSearch, 300);
 * const debouncedSearch = useCallback((query) => {
 *   execute(query);
 * }, [execute]);
 */
export const useOptimizedSearch = (searchFn, debounceDelay = 300) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const abort = useAbortController();
  const cache = useRef(new Map());
  const lastQueryRef = useRef('');

  const execute = useDebouncedCallback(
    async (query) => {
      // Avoid duplicate requests
      if (query === lastQueryRef.current) {
        return;
      }

      lastQueryRef.current = query;

      // Check cache
      const cacheKey = `search:${query}`;
      const cached = cache.current.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        setData(cached.data);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Make request with abort signal
        const result = await searchFn(query, abort.signal);

        if (!abort.isAborted) {
          // Cache result
          cache.current.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          });

          setData(result);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        if (!abort.isAborted) {
          setLoading(false);
        }
      }
    },
    debounceDelay
  );

  const cancel = useCallback(() => {
    abort.cancel();
    setLoading(false);
  }, [abort]);

  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  return {
    execute,
    loading,
    error,
    data,
    cancel,
    clearCache
  };
};

/**
 * usePrefetch Hook
 * Prefetch data before user needs it
 *
 * Usage:
 * const prefetch = usePrefetch(fetchFn);
 * prefetch(url); // Prefetch URL
 */
export const usePrefetch = (fetchFn) => {
  const cache = useRef(new Map());

  const prefetch = useCallback(
    async (key, ...args) => {
      // Skip if already cached
      if (cache.current.has(key)) {
        return;
      }

      try {
        const data = await fetchFn(...args);
        cache.current.set(key, data);
      } catch (error) {
        // Silently fail on prefetch errors
        console.warn('Prefetch failed for:', key, error);
      }
    },
    [fetchFn]
  );

  const getCached = useCallback((key) => {
    return cache.current.get(key);
  }, []);

  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  return { prefetch, getCached, clearCache };
};

/**
 * useInfiniteScroll Hook
 * Handles infinite scroll pagination
 *
 * Usage:
 * const { ref, page, hasMore, isLoading } = useInfiniteScroll(
 *   loadMore,
 *   { threshold: 0.8 }
 * );
 */
export const useInfiniteScroll = (onLoadMore, options = {}) => {
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const ref = useRef(null);

  const { threshold = 0.8 } = options;

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && hasMore && !isLoading) {
          setIsLoading(true);
          onLoadMore(page + 1)
            .then((hasMoreData) => {
              setHasMore(hasMoreData);
              if (hasMoreData) {
                setPage((prev) => prev + 1);
              }
            })
            .catch((error) => {
              console.error('Failed to load more:', error);
            })
            .finally(() => {
              setIsLoading(false);
            });
        }
      });
    });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [page, hasMore, isLoading, onLoadMore]);

  const reset = useCallback(() => {
    setPage(1);
    setHasMore(true);
  }, []);

  return { ref, page, hasMore, isLoading, reset };
};

export default useDebounce;
