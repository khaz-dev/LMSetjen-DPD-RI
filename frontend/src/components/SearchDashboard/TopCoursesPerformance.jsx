import React from 'react';

/**
 * TopCoursesPerformance Component
 * Displays top performing courses in search
 * Shows: Course name, impressions, clicks, CTR
 */
const TopCoursesPerformance = ({ courses = [], loading = false }) => {
  if (loading) {
    return (
      <div className="top-courses-performance loading">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="course-row-skeleton" />
        ))}
      </div>
    );
  }

  if (!courses.length) {
    return (
      <div className="top-courses-performance empty">
        <div className="empty-state">
          <span className="empty-icon">🎯</span>
          <p>No course performance data available</p>
        </div>
      </div>
    );
  }

  // Calculate max values for relative sizing
  const maxImpressions = Math.max(...courses.map(c => c.impressions || 0), 1);
  const maxClicks = Math.max(...courses.map(c => c.clicks || 0), 1);

  return (
    <div className="top-courses-performance">
      {/* Header */}
      <div className="courses-header">
        <div className="header-rank">Rank</div>
        <div className="header-title">Course Title</div>
        <div className="header-impressions">Impressions</div>
        <div className="header-clicks">Clicks</div>
        <div className="header-ctr">CTR</div>
      </div>

      {/* Course Rows */}
      <div className="courses-list">
        {courses.map((course, idx) => {
          const impressions = course.impressions || 0;
          const clicks = course.clicks || 0;
          const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
          const impressionPercent = (impressions / maxImpressions) * 100;
          const clickPercent = (clicks / maxClicks) * 100;

          return (
            <div key={course.id || idx} className="course-row">
              {/* Rank */}
              <div className="rank-cell">
                <span className="rank-badge">{idx + 1}</span>
              </div>

              {/* Course Title */}
              <div className="title-cell">
                <div className="course-name">{course.title || course.name}</div>
                {course.category && (
                  <div className="course-category">{course.category}</div>
                )}
              </div>

              {/* Impressions */}
              <div className="impressions-cell">
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${impressionPercent}%`,
                      backgroundColor: '#2196F3'
                    }}
                  />
                </div>
                <div className="value">{impressions.toLocaleString()}</div>
              </div>

              {/* Clicks */}
              <div className="clicks-cell">
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${clickPercent}%`,
                      backgroundColor: '#4CAF50'
                    }}
                  />
                </div>
                <div className="value">{clicks.toLocaleString()}</div>
              </div>

              {/* CTR */}
              <div className="ctr-cell">
                <div className="ctr-badge" style={{ color: getCTRColor(parseFloat(ctr)) }}>
                  {ctr}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Stats */}
      <div className="courses-footer">
        <div className="footer-stat">
          <span className="stat-label">Total Impressions:</span>
          <span className="stat-value">
            {courses.reduce((sum, c) => sum + (c.impressions || 0), 0).toLocaleString()}
          </span>
        </div>
        <div className="footer-stat">
          <span className="stat-label">Total Clicks:</span>
          <span className="stat-value">
            {courses.reduce((sum, c) => sum + (c.clicks || 0), 0).toLocaleString()}
          </span>
        </div>
        <div className="footer-stat">
          <span className="stat-label">Avg CTR:</span>
          <span className="stat-value">
            {courses.length > 0
              ? (
                  (courses.reduce((sum, c) => sum + (c.clicks || 0), 0) /
                    courses.reduce((sum, c) => sum + (c.impressions || 0), 0)) *
                  100
                ).toFixed(2)
              : '0.00'}
            %
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Helper function to get color based on CTR value
 */
const getCTRColor = (ctr) => {
  if (ctr >= 5) return '#4CAF50'; // Green
  if (ctr >= 2) return '#FFC107'; // Amber
  return '#FF9800'; // Orange
};

export default TopCoursesPerformance;
