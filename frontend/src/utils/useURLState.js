import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * useURLState Hook
 * Persists component state to URL query parameters
 * Enables browser back/forward navigation and shareable URLs
 *
 * Usage:
 * const [state, setState] = useURLState({
 *   search: '',
 *   filters: {},
 *   page: 1
 * }, 'search'); // 'search' is the key prefix
 */
export const useURLState = (initialState = {}, keyPrefix = 'state') => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Get state from URL parameters
   */
  const getStateFromURL = useCallback(() => {
    const state = { ...initialState };

    // Parse each initial state key from URL
    Object.keys(initialState).forEach(key => {
      const paramKey = `${keyPrefix}_${key}`;
      const paramValue = searchParams.get(paramKey);

      if (paramValue) {
        // Try to parse JSON for complex objects
        try {
          state[key] = JSON.parse(decodeURIComponent(paramValue));
        } catch (e) {
          // Fallback to string value
          state[key] = paramValue;
        }
      }
    });

    return state;
  }, [searchParams, initialState, keyPrefix]);

  /**
   * Update state and sync to URL
   */
  const setState = useCallback(
    (newState) => {
      const stateToSync = typeof newState === 'function' ? newState(getStateFromURL()) : newState;

      // Create new search params
      const newSearchParams = new URLSearchParams(searchParams);

      // Update each state key
      Object.entries(stateToSync).forEach(([key, value]) => {
        const paramKey = `${keyPrefix}_${key}`;

        if (value === undefined || value === null) {
          newSearchParams.delete(paramKey);
        } else if (typeof value === 'object') {
          // Serialize objects/arrays as JSON
          const serialized = encodeURIComponent(JSON.stringify(value));
          newSearchParams.set(paramKey, serialized);
        } else {
          newSearchParams.set(paramKey, String(value));
        }
      });

      setSearchParams(newSearchParams);
    },
    [searchParams, setSearchParams, keyPrefix, getStateFromURL]
  );

  // Get current state from URL
  const state = getStateFromURL();

  return [state, setState];
};

/**
 * useSearchURLPersistence Hook
 * Specialized hook for search feature URL persistence
 *
 * Usage:
 * const { query, filters, page, setQuery, setFilters, setPage } = useSearchURLPersistence();
 */
export const useSearchURLPersistence = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get current values from URL
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const categoryId = searchParams.get('category') || '';
  const level = searchParams.get('level') || '';
  const minRating = searchParams.get('rating') || '';
  const teacherId = searchParams.get('teacher') || '';

  // Setter functions
  const setQuery = useCallback(
    (newQuery) => {
      const params = new URLSearchParams(searchParams);
      if (newQuery) {
        params.set('q', newQuery);
        params.set('page', '1'); // Reset to page 1 on new query
      } else {
        params.delete('q');
      }
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const setPage = useCallback(
    (newPage) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', String(newPage));
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const setFilters = useCallback(
    (filters) => {
      const params = new URLSearchParams(searchParams);

      // Update filter parameters
      if (filters.category_id) {
        params.set('category', filters.category_id);
      } else {
        params.delete('category');
      }

      if (filters.level) {
        params.set('level', filters.level);
      } else {
        params.delete('level');
      }

      if (filters.min_rating) {
        params.set('rating', filters.min_rating);
      } else {
        params.delete('rating');
      }

      if (filters.teacher_id) {
        params.set('teacher', filters.teacher_id);
      } else {
        params.delete('teacher');
      }

      // Reset to page 1 when filters change
      params.set('page', '1');
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const clearAll = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  return {
    query,
    page,
    filters: {
      category_id: categoryId,
      level,
      min_rating: minRating,
      teacher_id: teacherId
    },
    setQuery,
    setPage,
    setFilters,
    clearAll,
    // Check if any filters are applied
    hasFilters: !!(categoryId || level || minRating || teacherId),
    // Check if any search is active
    hasSearch: !!query
  };
};

/**
 * useDashboardURLPersistence Hook
 * Specialized hook for dashboard URL persistence
 *
 * Usage:
 * const { period, days, setPeriod } = useDashboardURLPersistence();
 */
export const useDashboardURLPersistence = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const period = searchParams.get('period') || 'weekly';
  const days = parseInt(searchParams.get('days') || '7', 10);

  const setPeriod = useCallback(
    (newPeriod) => {
      const params = new URLSearchParams(searchParams);
      params.set('period', newPeriod);

      // Update days based on period
      const daysMap = {
        daily: 1,
        weekly: 7,
        monthly: 30
      };
      params.set('days', String(daysMap[newPeriod] || 7));

      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const setDays = useCallback(
    (newDays) => {
      const params = new URLSearchParams(searchParams);
      params.set('days', String(newDays));
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  return {
    period,
    days,
    setPeriod,
    setDays
  };
};

/**
 * useURLSyncedState Hook
 * Generic hook for syncing any state with URL
 *
 * Usage:
 * const [expandedSection, setExpandedSection] = useURLSyncedState('section', null);
 */
export const useURLSyncedState = (paramName, defaultValue = null) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = searchParams.get(paramName) || defaultValue;

  const setValue = useCallback(
    (newValue) => {
      const params = new URLSearchParams(searchParams);

      if (newValue === null || newValue === undefined) {
        params.delete(paramName);
      } else {
        params.set(paramName, String(newValue));
      }

      setSearchParams(params);
    },
    [searchParams, setSearchParams, paramName]
  );

  return [value, setValue];
};

export default useURLState;
