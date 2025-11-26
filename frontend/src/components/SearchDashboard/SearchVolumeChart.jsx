import React, { useMemo } from 'react';

/**
 * SearchVolumeChart Component
 * Displays daily search volume as a line chart
 * Shows trends in search activity over time
 */
const SearchVolumeChart = ({ data, loading = false }) => {
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    // Sort by date and limit to last 30 days
    return data
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-30)
      .map(item => ({
        date: new Date(item.date),
        count: item.count || 0,
        label: new Date(item.date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        })
      }));
  }, [data]);

  const maxCount = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.max(...chartData.map(d => d.count), 1);
  }, [chartData]);

  const minCount = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.min(...chartData.map(d => d.count), 0);
  }, [chartData]);

  const range = maxCount - minCount || 1;

  if (loading) {
    return (
      <div className="search-volume-chart loading">
        <div className="chart-skeleton" />
        <div className="chart-skeleton" style={{ height: '200px', marginTop: '10px' }} />
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="search-volume-chart empty">
        <p>No search volume data available</p>
      </div>
    );
  }

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const graphWidth = svgWidth - padding.left - padding.right;
  const graphHeight = svgHeight - padding.top - padding.bottom;

  // Calculate points for line chart
  const points = chartData.map((item, idx) => {
    const x = (idx / Math.max(chartData.length - 1, 1)) * graphWidth + padding.left;
    const y = svgHeight - ((item.count - minCount) / range) * graphHeight - padding.bottom;
    return { ...item, x, y, idx };
  });

  // Generate SVG path for the line
  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Generate SVG path for the area under the line
  const areaPath = [
    `M ${points[0]?.x || 0} ${svgHeight - padding.bottom}`,
    ...points.map((p, idx) => `${idx === 0 ? '' : 'L'} ${p.x} ${p.y}`),
    `L ${points[points.length - 1]?.x || 0} ${svgHeight - padding.bottom}`,
    'Z'
  ].join(' ');

  return (
    <div className="search-volume-chart">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="volume-chart-svg">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = svgHeight - padding.bottom - ratio * graphHeight;
          return (
            <g key={`grid-${idx}`} className="grid-line">
              <line
                x1={padding.left}
                y1={y}
                x2={svgWidth - padding.right}
                y2={y}
                stroke="#f0f0f0"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="grid-label"
                fontSize="12"
                fill="#666"
              >
                {Math.round(minCount + ratio * range)}
              </text>
            </g>
          );
        })}

        {/* Area under line */}
        <path d={areaPath} fill="rgba(76, 175, 80, 0.1)" />

        {/* Line chart */}
        <path
          d={linePath}
          stroke="#4CAF50"
          strokeWidth="2"
          fill="none"
          className="volume-line"
        />

        {/* Data points */}
        {points.map((p, idx) => (
          <g key={`point-${idx}`} className="data-point-group">
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#4CAF50"
              className="data-point"
            />
            {idx % Math.ceil(chartData.length / 8) === 0 && (
              <text
                x={p.x}
                y={svgHeight - padding.bottom + 20}
                textAnchor="middle"
                className="x-label"
                fontSize="12"
                fill="#666"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}

        {/* Axes */}
        <line
          x1={padding.left}
          y1={svgHeight - padding.bottom}
          x2={svgWidth - padding.right}
          y2={svgHeight - padding.bottom}
          stroke="#333"
          strokeWidth="2"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={svgHeight - padding.bottom}
          stroke="#333"
          strokeWidth="2"
        />
      </svg>

      {/* Statistics */}
      <div className="volume-stats">
        <div className="stat">
          <span className="stat-label">Peak Volume:</span>
          <span className="stat-value">{maxCount}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Avg Volume:</span>
          <span className="stat-value">
            {Math.round(chartData.reduce((sum, d) => sum + d.count, 0) / chartData.length)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Total Searches:</span>
          <span className="stat-value">
            {chartData.reduce((sum, d) => sum + d.count, 0)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Trend:</span>
          <span className="stat-value trend">
            {chartData.length > 1 && chartData[chartData.length - 1].count > chartData[0].count
              ? '↑ Growing'
              : chartData.length > 1 && chartData[chartData.length - 1].count < chartData[0].count
              ? '↓ Declining'
              : '→ Stable'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SearchVolumeChart;
