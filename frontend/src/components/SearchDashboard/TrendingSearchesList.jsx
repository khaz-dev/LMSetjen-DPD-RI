import React from 'react';
import { VirtualList } from '../VirtualList/VirtualList';

/**
 * TrendingSearchesList Component
 * Displays top trending search queries with virtual scrolling
 * Shows frequency and trending indicator
 */
const TrendingSearchesList = ({ searches = [], limit = 10, loading = false }) => {
  const displayedSearches = searches.slice(0, limit);

  if (loading) {
    return (
      <div className="trending-searches-list loading">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="trending-item-skeleton" />
        ))}
      </div>
    );
  }

  if (!displayedSearches.length) {
    return (
      <div className="trending-searches-list empty">
        <div className="empty-state">
          <span className="empty-icon">📊</span>
          <p>No trending searches yet</p>
        </div>
      </div>
    );
  }

  // Find max count for relative sizing
  const maxCount = Math.max(...displayedSearches.map(s => s.count || 1), 1);

  // Render item for VirtualList
  const renderItem = (search, idx) => {
    const query = search.query || search;
    const count = search.count || 1;
    const trend = search.trend || 'stable';
    const relativeSize = (count / maxCount) * 100;

    return (
      <div key={idx} className="trending-item">
        {/* Rank Badge */}
        <div className="rank-badge">
          <span className="rank-number">{idx + 1}</span>
        </div>

        {/* Search Query */}
        <div className="search-info">
          <div className="search-query">{query}</div>
          <div className="search-meta">
            <span className="count-badge">{count} searches</span>
            {trend && (
              <span className={`trend-badge trend-${trend}`}>
                {trend === 'up' ? '↑ Rising' : trend === 'down' ? '↓ Falling' : '→ Stable'}
              </span>
            )}
          </div>
        </div>

        {/* Visual Bar */}
        <div className="bar-container">
          <div
            className="bar-fill"
            style={{
              width: `${relativeSize}%`,
              backgroundColor: getTrendColor(trend)
            }}
          />
        </div>

        {/* Count */}
        <div className="count-display">{count}</div>
      </div>
    );
  };

  return (
    <div className="trending-searches-list-container">
      <VirtualList
        items={displayedSearches}
        itemHeight={80}
        containerHeight={400}
        overscan={2}
        renderItem={renderItem}
      />
    </div>
  );
};

/**
 * Helper function to get color based on trend
 */
const getTrendColor = (trend) => {
  switch (trend) {
    case 'up':
      return '#4CAF50'; // Green
    case 'down':
      return '#FF9800'; // Orange
    default:
      return '#0f766e'; // Blue
  }
};

export default TrendingSearchesList;
