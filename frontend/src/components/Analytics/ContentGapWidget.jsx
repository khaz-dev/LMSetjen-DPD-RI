import React, { useState, useEffect } from 'react';
import apiInstance from '../../utils/axios';
import Toast from '../../views/plugin/Toast';
import './AnalyticsWidgets.css';

export default function ContentGapWidget() {
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('priority_score');
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    fetchGaps();
  }, []);

  const fetchGaps = async () => {
    setLoading(true);
    try {
      const response = await apiInstance.get('analytics/content-gaps/');
      const data = response.data?.gaps || response.data?.results || response.data || [];
      setGaps(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch gaps:', error);
      Toast().fire({
        icon: 'error',
        title: 'Failed to fetch content gaps'
      });
      setGaps([]);
    }
    setLoading(false);
  };

  const handleTriggerAnalysis = async () => {
    setLoading(true);
    try {
      const response = await apiInstance.post('analytics/content-gaps/', { days: 30 });
      const data = response.data?.gaps || response.data?.results || response.data || [];
      setGaps(Array.isArray(data) ? data : []);
      Toast().fire({
        icon: 'success',
        title: 'Analysis completed',
        timer: 2000
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      Toast().fire({
        icon: 'error',
        title: 'Analysis failed'
      });
    }
    setLoading(false);
  };

  // Sort gaps
  const sortedGaps = [...gaps]
    .filter(gap => 
      gap.search_query?.toLowerCase().includes(filterText.toLowerCase()) ||
      gap.suggested_course_title?.toLowerCase().includes(filterText.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'priority_score') return b.priority_score - a.priority_score;
      if (sortBy === 'attempts') return b.attempt_count - a.attempt_count;
      if (sortBy === 'users') return b.unique_users - a.unique_users;
      return 0;
    });

  return (
    <div className="analytics-widget content-gap-widget">
      <div className="widget-header">
        <div>
          <h3>
            <i className="fas fa-search-minus me-2"></i>
            Content Gap Analysis
          </h3>
          <p className="text-muted">Identify missing content from failed searches</p>
        </div>
        <button 
          onClick={handleTriggerAnalysis} 
          disabled={loading}
          className="btn btn-primary"
        >
          <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-sync-alt'} me-2`}></i>
          {loading ? 'Analyzing...' : 'Analyze Now'}
        </button>
      </div>

      <div className="widget-controls">
        <div className="control-group">
          <input
            type="text"
            placeholder="Filter by search term or course..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="form-control"
          />
        </div>
        <div className="control-group">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="form-control"
          >
            <option value="priority_score">Sort by Priority Score</option>
            <option value="attempts">Sort by Attempts</option>
            <option value="users">Sort by Unique Users</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner-border"></div>
          <p>Loading content gaps...</p>
        </div>
      ) : sortedGaps.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-inbox"></i>
          <p>No content gaps found</p>
          <small>Failed searches will appear here</small>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="gaps-table">
            <thead>
              <tr>
                <th>Search Query</th>
                <th>Attempts</th>
                <th>Unique Users</th>
                <th>Priority Score</th>
                <th>Suggested Course</th>
                <th>Category</th>
                <th>Last Searched</th>
              </tr>
            </thead>
            <tbody>
              {sortedGaps.map((gap) => (
                <tr key={gap.id}>
                  <td className="search-query">
                    <code>{gap.search_query}</code>
                  </td>
                  <td>
                    <span className="badge bg-info">{gap.attempt_count}</span>
                  </td>
                  <td>
                    <span className="badge bg-secondary">{gap.unique_users}</span>
                  </td>
                  <td>
                    <div className="priority-score">
                      <span className={`badge ${gap.priority_score >= 70 ? 'bg-danger' : gap.priority_score >= 40 ? 'bg-warning' : 'bg-success'}`}>
                        {gap.priority_score.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="suggested-course">
                    {gap.suggested_course_title || 'N/A'}
                  </td>
                  <td>
                    <span className="category-badge">{gap.suggested_category || 'N/A'}</span>
                  </td>
                  <td className="last-searched">
                    {gap.last_searched ? new Date(gap.last_searched).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="widget-stats">
        <div className="stat-item">
          <span className="stat-label">Total Gaps:</span>
          <span className="stat-value">{gaps.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Avg Priority:</span>
          <span className="stat-value">
            {gaps.length > 0 ? (gaps.reduce((sum, g) => sum + g.priority_score, 0) / gaps.length).toFixed(1) : '0'}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total Attempts:</span>
          <span className="stat-value">{gaps.reduce((sum, g) => sum + g.attempt_count, 0)}</span>
        </div>
      </div>
    </div>
  );
}
