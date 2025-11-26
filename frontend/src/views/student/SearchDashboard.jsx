import React, { useState, useCallback, useEffect } from 'react';
import useDashboardAnalytics from '../../utils/useDashboardAnalytics';
import { useSearchURLPersistence } from '../../utils/useURLState';
import DashboardOverviewCards from './DashboardOverviewCards';
import SearchVolumeChart from './SearchVolumeChart';
import QualityMetricsCard from './QualityMetricsCard';
import TrendingSearchesList from './TrendingSearchesList';
import TopCoursesPerformance from './TopCoursesPerformance';
import './SearchDashboard.css';

/**
 * SearchDashboard Component
 * Main dashboard page showing comprehensive search analytics
 * Features:
 * - KPI overview cards
 * - Search volume chart
 * - Quality metrics
 * - Trending searches
 * - Top performing courses
 * - Period selector (daily/weekly/monthly)
 * - Export functionality
 */
const SearchDashboard = () => {
  const {
    overview,
    trending,
    coursePerformance,
    loading,
    error,
    selectedPeriod,
    fetchDashboardData,
    exportData
  } = useDashboardAnalytics();

  // URL persistence for period and expanded section
  const searchParams = new URLSearchParams(window.location.search);
  const urlPeriod = searchParams.get('period') || 'daily';
  const urlExpandedSection = searchParams.get('section') || null;

  const [expandedSection, setExpandedSection] = useState(urlExpandedSection);

  // Sync period to URL when it changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (urlPeriod !== selectedPeriod) {
      params.set('period', selectedPeriod);
      window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [selectedPeriod]);

  // Sync expanded section to URL when it changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (expandedSection) {
      params.set('section', expandedSection);
    } else {
      params.delete('section');
    }
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, [expandedSection]);

  /**
   * Handle period change
   */
  const handlePeriodChange = useCallback(
    (period) => {
      const params = new URLSearchParams(window.location.search);
      params.set('period', period);
      window.history.replaceState(null, '', `?${params.toString()}`);
      fetchDashboardData(period);
    },
    [fetchDashboardData]
  );

  /**
   * Handle export
   */
  const handleExport = useCallback(() => {
    const data = exportData();
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `search-analytics-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [exportData]);

  /**
   * Toggle section expansion
   */
  const toggleSection = useCallback((sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  }, [expandedSection]);

  if (error && !loading) {
    return (
      <div className="search-dashboard error-state">
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <button
            onClick={() => fetchDashboardData(selectedPeriod)}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="search-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">Search Analytics Dashboard</h1>
          <p className="dashboard-subtitle">
            Monitor and analyze search performance and user behavior
          </p>
        </div>

        {/* Controls */}
        <div className="dashboard-controls">
          {/* Period Selector */}
          <div className="period-selector">
            {['daily', 'weekly', 'monthly'].map(period => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`period-btn ${selectedPeriod === period ? 'active' : ''}`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          {/* Export Button */}
          <button onClick={handleExport} className="export-btn" title="Export analytics data">
            📥 Export
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchDashboardData(selectedPeriod)}
            className={`refresh-btn ${loading ? 'loading' : ''}`}
            disabled={loading}
            title="Refresh data"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <section className="dashboard-section overview-section">
        <div className="section-header">
          <h2 className="section-title">Overview</h2>
          <p className="section-description">Key performance indicators</p>
        </div>
        <DashboardOverviewCards overview={overview} loading={loading} />
      </section>

      {/* Search Volume Chart */}
      <section className="dashboard-section chart-section">
        <div className="section-header">
          <button
            onClick={() => toggleSection('volume')}
            className="section-toggle"
          >
            <h2 className="section-title">Search Volume Trend</h2>
            <span className="toggle-icon">
              {expandedSection === 'volume' ? '▼' : '▶'}
            </span>
          </button>
          <p className="section-description">Daily search volume over time</p>
        </div>
        {expandedSection === 'volume' && (
          <SearchVolumeChart data={trending.search_volume_trend} loading={loading} />
        )}
      </section>

      {/* Two Column Layout */}
      <div className="dashboard-row">
        {/* Quality Metrics */}
        <section className="dashboard-section quality-section">
          <div className="section-header">
            <button
              onClick={() => toggleSection('quality')}
              className="section-toggle"
            >
              <h2 className="section-title">Quality Metrics</h2>
              <span className="toggle-icon">
                {expandedSection === 'quality' ? '▼' : '▶'}
              </span>
            </button>
            <p className="section-description">Search quality indicators</p>
          </div>
          {expandedSection === 'quality' && (
            <QualityMetricsCard metrics={overview} loading={loading} />
          )}
        </section>

        {/* Trending Searches */}
        <section className="dashboard-section trending-section">
          <div className="section-header">
            <button
              onClick={() => toggleSection('trending')}
              className="section-toggle"
            >
              <h2 className="section-title">Trending Searches</h2>
              <span className="toggle-icon">
                {expandedSection === 'trending' ? '▼' : '▶'}
              </span>
            </button>
            <p className="section-description">Top 10 most searched queries</p>
          </div>
          {expandedSection === 'trending' && (
            <TrendingSearchesList searches={trending.trending_searches} loading={loading} />
          )}
        </section>
      </div>

      {/* Top Courses Performance */}
      <section className="dashboard-section courses-section">
        <div className="section-header">
          <button
            onClick={() => toggleSection('courses')}
            className="section-toggle"
          >
            <h2 className="section-title">Top Courses Performance</h2>
            <span className="toggle-icon">
              {expandedSection === 'courses' ? '▼' : '▶'}
            </span>
          </button>
          <p className="section-description">
            Course impressions, clicks, and engagement metrics
          </p>
        </div>
        {expandedSection === 'courses' && (
          <TopCoursesPerformance
            courses={coursePerformance.top_courses}
            loading={loading}
          />
        )}
      </section>

      {/* Failed Searches Alert (if any) */}
      {trending.failed_searches && trending.failed_searches.length > 0 && (
        <section className="dashboard-section alert-section">
          <div className="section-header">
            <h2 className="section-title">⚠️ Failed Searches</h2>
            <p className="section-description">
              Queries that returned no results (top {Math.min(5, trending.failed_searches.length)})
            </p>
          </div>
          <div className="failed-searches-list">
            {trending.failed_searches.slice(0, 5).map((search, idx) => (
              <div key={idx} className="failed-search-item">
                <span className="item-icon">❌</span>
                <span className="item-query">{search.query || search}</span>
                <span className="item-count">
                  {search.count ? `${search.count}x` : ''}
                </span>
              </div>
            ))}
          </div>
          <p className="alert-tip">
            💡 Consider adding these queries as saved searches or improving search algorithms
          </p>
        </section>
      )}

      {/* Footer Stats */}
      <section className="dashboard-footer">
        <div className="footer-content">
          <p className="footer-text">
            📊 Data refreshes every 5 minutes. Last updated:{' '}
            {new Date().toLocaleTimeString()}
          </p>
        </div>
      </section>
    </div>
  );
};

export default SearchDashboard;
