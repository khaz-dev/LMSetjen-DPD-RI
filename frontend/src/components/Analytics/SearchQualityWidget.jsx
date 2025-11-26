import React, { useState, useEffect } from 'react';
import apiInstance from '../../utils/axios';
import Toast from '../../views/plugin/Toast';
import './SearchQualityWidget.css';

export default function SearchQualityWidget() {
  const [report, setReport] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterIndicator, setFilterIndicator] = useState(null);
  const [sortBy, setSortBy] = useState('-search_impressions');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchQualityReport();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'courses') {
      fetchCourses();
    }
  }, [filterIndicator, sortBy, categoryFilter]);

  const fetchQualityReport = async () => {
    setLoading(true);
    try {
      const response = await apiInstance.get('analytics/search-quality/');
      if (response.data?.success) {
        setReport(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch quality report:', error);
      Toast().fire({
        icon: 'error',
        title: 'Failed to fetch search quality metrics'
      });
    }
    setLoading(false);
  };

  const fetchCourses = async () => {
    setLoading(true);
    try {
      let params = new URLSearchParams();
      if (filterIndicator) params.append('indicator', filterIndicator);
      if (categoryFilter) params.append('category_id', categoryFilter);
      params.append('sort_by', sortBy);

      const response = await apiInstance.get(`analytics/search-quality/courses/?${params.toString()}`);
      if (response.data?.results) {
        setCourses(response.data.results);
      }
    } catch (error) {
      console.error('Failed to fetch courses:', error);
      Toast().fire({
        icon: 'error',
        title: 'Failed to fetch course metrics'
      });
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const response = await apiInstance.get('filters/options/');
      if (response.data?.categories) {
        setCategories(response.data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const getPerformanceColor = (indicator) => {
    switch (indicator) {
      case 'HIGH':
        return '#28a745';
      case 'NORMAL':
        return '#ffc107';
      case 'LOW':
        return '#dc3545';
      case 'HIDDEN':
        return '#6c757d';
      default:
        return '#007bff';
    }
  };

  const getPerformanceBadge = (indicator) => {
    const colors = {
      HIGH: 'success',
      NORMAL: 'warning',
      LOW: 'danger',
      HIDDEN: 'secondary'
    };
    return colors[indicator] || 'info';
  };

  if (loading && !report && activeTab === 'overview') {
    return <div className="sq-widget card"><div className="card-body text-center">Loading...</div></div>;
  }

  return (
    <div className="sq-widget card">
      <div className="card-header bg-light border-bottom">
        <h5 className="mb-0">📊 Search Quality Metrics</h5>
        <small className="text-muted">
          Real-time visibility into course search performance and CTR analytics
        </small>
      </div>

      <ul className="nav nav-tabs card-header-tabs" role="tablist">
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('overview');
            }}
          >
            Overview
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'courses' ? 'active' : ''}`}
            href="#courses"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('courses');
            }}
          >
            Course Metrics
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'distribution' ? 'active' : ''}`}
            href="#distribution"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('distribution');
            }}
          >
            CTR Distribution
          </a>
        </li>
      </ul>

      <div className="card-body">
        {/* Overview Tab */}
        {activeTab === 'overview' && report && (
          <div className="sq-overview">
            <div className="row mb-4">
              <div className="col-md-3 mb-3">
                <div className="metric-card">
                  <div className="metric-label">Total Courses</div>
                  <div className="metric-value">{report.report.total_courses}</div>
                </div>
              </div>
              <div className="col-md-3 mb-3">
                <div className="metric-card">
                  <div className="metric-label">Total Impressions</div>
                  <div className="metric-value">{report.report.total_impressions}</div>
                </div>
              </div>
              <div className="col-md-3 mb-3">
                <div className="metric-card">
                  <div className="metric-label">Total Clicks</div>
                  <div className="metric-value">{report.report.total_clicks}</div>
                </div>
              </div>
              <div className="col-md-3 mb-3">
                <div className="metric-card highlight">
                  <div className="metric-label">Overall CTR</div>
                  <div className="metric-value">{report.report.overall_ctr.toFixed(2)}%</div>
                </div>
              </div>
            </div>

            <div className="row mb-4">
              <div className="col-md-4 mb-3">
                <div className="status-card success">
                  <div className="status-icon">✓</div>
                  <div className="status-label">High Performers</div>
                  <div className="status-value">{report.report.high_performers}</div>
                  <small>CTR ≥ 5%</small>
                </div>
              </div>
              <div className="col-md-4 mb-3">
                <div className="status-card warning">
                  <div className="status-icon">⚠</div>
                  <div className="status-label">Low Performers</div>
                  <div className="status-value">{report.report.low_performers}</div>
                  <small>CTR &lt; 1% (with impressions)</small>
                </div>
              </div>
              <div className="col-md-4 mb-3">
                <div className="status-card danger">
                  <div className="status-icon">✗</div>
                  <div className="status-label">Hidden Courses</div>
                  <div className="status-value">{report.report.no_impression_courses}</div>
                  <small>0 impressions</small>
                </div>
              </div>
            </div>

            {report.recommendations && report.recommendations.length > 0 && (
              <div className="recommendations-section">
                <h6 className="mb-3">🎯 Recommendations</h6>
                {report.recommendations.map((rec, idx) => (
                  <div key={idx} className={`alert alert-${rec.priority === 'HIGH' ? 'danger' : 'warning'}`} role="alert">
                    <strong>{rec.action}</strong>: {rec.description}
                    {rec.affected_count && <small> ({rec.affected_count} courses affected)</small>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <div className="sq-courses">
            <div className="filter-section mb-4">
              <div className="row">
                <div className="col-md-4">
                  <label className="form-label">Performance</label>
                  <select
                    className="form-select"
                    value={filterIndicator || ''}
                    onChange={(e) => setFilterIndicator(e.target.value || null)}
                  >
                    <option value="">All Performances</option>
                    <option value="HIGH">High (CTR ≥ 5%)</option>
                    <option value="NORMAL">Normal (1-5%)</option>
                    <option value="LOW">Low (&lt; 1%)</option>
                    <option value="HIDDEN">Hidden (0 impressions)</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={categoryFilter || ''}
                    onChange={(e) => setCategoryFilter(e.target.value || null)}
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Sort By</label>
                  <select
                    className="form-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="-search_impressions">Most Impressions</option>
                    <option value="-search_clicks">Most Clicks</option>
                    <option value="-click_through_rate">Highest CTR</option>
                    <option value="click_through_rate">Lowest CTR</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center">Loading...</div>
            ) : courses.length === 0 ? (
              <div className="alert alert-info">No courses found with selected filters</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Course Title</th>
                      <th>Category</th>
                      <th>Impressions</th>
                      <th>Clicks</th>
                      <th>CTR</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course.id} className="sq-course-row">
                        <td>
                          <strong>{course.course_title}</strong>
                          <br />
                          <small className="text-muted">{course.level}</small>
                        </td>
                        <td>{course.category}</td>
                        <td>{course.search_impressions}</td>
                        <td>{course.search_clicks}</td>
                        <td>
                          <strong>{course.click_through_rate.toFixed(2)}%</strong>
                        </td>
                        <td>
                          <span className={`badge bg-${getPerformanceBadge(course.performance_indicator)}`}>
                            {course.performance_indicator}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Distribution Tab */}
        {activeTab === 'distribution' && report && (
          <div className="sq-distribution">
            <h6 className="mb-4">Course Distribution by CTR Range</h6>
            <div className="row">
              {[
                { label: '0-1%', value: report.ctr_distribution.range_0_1, color: '#dc3545' },
                { label: '1-3%', value: report.ctr_distribution.range_1_3, color: '#fd7e14' },
                { label: '3-5%', value: report.ctr_distribution.range_3_5, color: '#ffc107' },
                { label: '5-10%', value: report.ctr_distribution.range_5_10, color: '#28a745' },
                { label: '10%+', value: report.ctr_distribution.range_10_plus, color: '#20c997' }
              ].map((item) => (
                <div key={item.label} className="col-md-4 mb-3">
                  <div className="distribution-card">
                    <div className="distribution-bar">
                      <div
                        className="distribution-fill"
                        style={{
                          backgroundColor: item.color,
                          width: `${Math.min(item.value * 10, 100)}%`
                        }}
                      />
                    </div>
                    <div className="distribution-label">
                      <strong>{item.label}</strong>
                      <span className="distribution-count">{item.value} courses</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card-footer bg-light text-end">
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={fetchQualityReport}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
