import { useState, useCallback, useEffect } from 'react';
import useAxios from './useAxios';

/**
 * useDashboardAnalytics Hook
 * Fetches and manages search analytics data for the dashboard
 * Handles: overview metrics, trending searches, quality scores, course performance
 */
export const useDashboardAnalytics = () => {

  // State management
  const [overview, setOverview] = useState({
    total_searches: 0,
    unique_searchers: 0,
    unique_queries: 0,
    avg_results_per_search: 0,
    avg_ctr: 0,
    search_quality_score: 0
  });

  const [trending, setTrending] = useState({
    trending_searches: [],
    failed_searches: [],
    search_volume_trend: []
  });

  const [coursePerformance, setCoursePerformance] = useState({
    total_courses: 0,
    top_courses: [],
    avg_metrics: {}
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('weekly'); // daily, weekly, monthly

  /**
   * Fetch dashboard analytics data
   */
  const fetchDashboardData = useCallback(
    async (period = 'weekly', days = null) => {
      try {
        setLoading(true);
        setError(null);

        // Determine days based on period
        let queryDays = days;
        if (!queryDays) {
          switch (period) {
            case 'monthly':
              queryDays = 30;
              break;
            case 'weekly':
              queryDays = 7;
              break;
            case 'daily':
              queryDays = 1;
              break;
            default:
              queryDays = 7;
          }
        }

        // Fetch main dashboard data
        const dashboardResponse = await useAxios.get('/analytics/dashboard/', {
          params: {
            period: period,
            days: queryDays
          }
        });

        const dashData = dashboardResponse.data;

        // Update states
        setOverview(dashData.overview || {});
        setTrending(dashData.trending || {});
        setCoursePerformance(dashData.course_performance || {});
        setSelectedPeriod(period);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError(
          err.response?.data?.detail ||
            err.message ||
            'Failed to load dashboard data. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Fetch summary data (lightweight)
   */
  const fetchSummary = useCallback(
    async (days = 7) => {
      try {
        const response = await useAxios.get('/analytics/summary/', {
          params: { days }
        });
        return response.data;
      } catch (err) {
        console.error('Failed to fetch summary:', err);
        throw err;
      }
    },
    []
  );
  const fetchTrendData = useCallback(
    async (startDate, endDate) => {
      try {
        const response = await useAxios.get('/analytics/trend/', {
          params: {
            start_date: startDate,
            end_date: endDate
          }
        });
        return response.data;
      } catch (err) {
        console.error('Failed to fetch trend data:', err);
        throw err;
      }
    },
    []
  );

  /**
   * Fetch trending searches
   */
  const fetchTrendingSearches = useCallback(
    async (days = 7, limit = 10) => {
      try {
        const response = await useAxios.get('/analytics/trending-searches/', {
          params: { days, limit }
        });
        return response.data?.trending || [];
      } catch (err) {
        console.error('Failed to fetch trending searches:', err);
        throw err;
      }
    },
    []
  );

  /**
   * Export dashboard data as JSON
   */
  const exportData = useCallback(() => {
    const data = {
      exported_at: new Date().toISOString(),
      overview,
      trending,
      coursePerformance
    };
    return data;
  }, [overview, trending, coursePerformance]);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchDashboardData('weekly');
  }, [fetchDashboardData]);

  return {
    // State
    overview,
    trending,
    coursePerformance,
    loading,
    error,
    selectedPeriod,

    // Functions
    fetchDashboardData,
    fetchSummary,
    fetchTrendData,
    fetchTrendingSearches,
    exportData,

    // Computed
    qualityScore: overview.search_quality_score || 0,
    totalSearches: overview.total_searches || 0,
    uniqueSearchers: overview.unique_searchers || 0,
    topSearches: trending.trending_searches || [],
    failedSearches: trending.failed_searches || [],
    volumeTrend: trending.search_volume_trend || [],
    topCourses: coursePerformance.top_courses || []
  };
};

export default useDashboardAnalytics;
