import React, { useMemo } from 'react';

/**
 * QualityMetricsCard Component
 * Displays search quality metrics with visual indicators
 * Shows: quality score, success rate, avg CTR
 */
const QualityMetricsCard = ({ metrics = {}, loading = false }) => {
  const {
    search_quality_score = 0,
    success_rate = 0,
    avg_ctr = 0,
    unique_queries = 0,
    avg_results = 0
  } = metrics;

  const qualityColor = useMemo(() => {
    if (search_quality_score >= 80) return '#4CAF50'; // Green
    if (search_quality_score >= 60) return '#FFC107'; // Amber
    return '#F44336'; // Red
  }, [search_quality_score]);

  const statusText = useMemo(() => {
    if (search_quality_score >= 80) return 'Excellent';
    if (search_quality_score >= 60) return 'Good';
    return 'Needs Improvement';
  }, [search_quality_score]);

  if (loading) {
    return (
      <div className="quality-metrics-card loading">
        <div className="metric-skeleton" />
        <div className="metric-skeleton" style={{ height: '80px', marginTop: '10px' }} />
      </div>
    );
  }

  return (
    <div className="quality-metrics-card">
      {/* Main Quality Score */}
      <div className="quality-score-section">
        <div className="score-circle" style={{ borderColor: qualityColor }}>
          <div className="score-value">{search_quality_score.toFixed(1)}</div>
          <div className="score-label">Quality</div>
        </div>
        <div className="score-status" style={{ color: qualityColor }}>
          {statusText}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="quality-metrics-grid">
        {/* Success Rate */}
        <div className="metric-item">
          <div className="metric-header">
            <span className="metric-title">Success Rate</span>
            <span className="metric-badge">{success_rate.toFixed(1)}%</span>
          </div>
          <div className="metric-bar">
            <div
              className="metric-bar-fill"
              style={{
                width: `${Math.min(success_rate, 100)}%`,
                backgroundColor: success_rate >= 80 ? '#4CAF50' : '#FFC107'
              }}
            />
          </div>
        </div>

        {/* CTR (Click-Through Rate) */}
        <div className="metric-item">
          <div className="metric-header">
            <span className="metric-title">Avg CTR</span>
            <span className="metric-badge">{(avg_ctr * 100).toFixed(2)}%</span>
          </div>
          <div className="metric-bar">
            <div
              className="metric-bar-fill"
              style={{
                width: `${Math.min(avg_ctr * 100, 100)}%`,
                backgroundColor: avg_ctr > 0.3 ? '#4CAF50' : '#2196F3'
              }}
            />
          </div>
        </div>

        {/* Unique Queries */}
        <div className="metric-item">
          <div className="metric-header">
            <span className="metric-title">Unique Queries</span>
            <span className="metric-badge">{unique_queries}</span>
          </div>
          <div className="metric-description">
            Diverse search queries from users
          </div>
        </div>

        {/* Avg Results */}
        <div className="metric-item">
          <div className="metric-header">
            <span className="metric-title">Avg Results</span>
            <span className="metric-badge">{avg_results.toFixed(1)}</span>
          </div>
          <div className="metric-description">
            Results per search query
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="quality-insights">
        <div className="insight-item">
          <span className="insight-icon">💡</span>
          <span className="insight-text">
            {search_quality_score >= 80
              ? 'Excellent search performance! Users are finding relevant results.'
              : search_quality_score >= 60
              ? 'Good search quality. Consider optimizing filters and ranking algorithms.'
              : 'Quality needs improvement. Review search queries and indexing strategies.'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default QualityMetricsCard;
