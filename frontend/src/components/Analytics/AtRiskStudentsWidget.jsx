import React, { useState, useEffect } from 'react';
import apiInstance from '../../utils/axios';
import Toast from '../../views/plugin/Toast';
import './AnalyticsWidgets.css';

export default function AtRiskStudentsWidget() {
  const [risks, setRisks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [riskFilter, setRiskFilter] = useState('');
  const [sortBy, setSortBy] = useState('risk_score');

  useEffect(() => {
    fetchRiskData();
  }, []);

  const fetchRiskData = async () => {
    setLoading(true);
    try {
      // Fetch both list and summary
      const [riskResponse, summaryResponse] = await Promise.all([
        apiInstance.get('analytics/at-risk-students/'),
        apiInstance.get('analytics/at-risk-summary/')
      ]);
      
      setRisks(riskResponse.data.results || riskResponse.data || []);
      setSummary(summaryResponse.data);
    } catch (error) {
      console.error('Failed to fetch risk data:', error);
      Toast().fire({
        icon: 'error',
        title: 'Failed to fetch at-risk students'
      });
    }
    setLoading(false);
  };

  const handleTriggerAssessment = async () => {
    setLoading(true);
    try {
      const response = await apiInstance.post('analytics/at-risk-students/trigger-assessment/');
      await fetchRiskData();
      Toast().fire({
        icon: 'success',
        title: response.data.message || 'Assessment triggered',
        timer: 2000
      });
    } catch (error) {
      console.error('Assessment failed:', error);
      Toast().fire({
        icon: 'error',
        title: 'Assessment failed'
      });
    }
    setLoading(false);
  };

  // Filter and sort risks
  const filteredRisks = [...risks]
    .filter(risk => !riskFilter || risk.risk_level === riskFilter)
    .sort((a, b) => {
      if (sortBy === 'risk_score') return b.risk_score - a.risk_score;
      if (sortBy === 'recent') return new Date(b.last_assessed) - new Date(a.last_assessed);
      return 0;
    });

  const getRiskColor = (level) => {
    if (level === 'HIGH') return 'danger';
    if (level === 'MEDIUM') return 'warning';
    return 'success';
  };

  const getRiskIcon = (level) => {
    if (level === 'HIGH') return 'fa-exclamation-circle';
    if (level === 'MEDIUM') return 'fa-exclamation-triangle';
    return 'fa-check-circle';
  };

  return (
    <div className="analytics-widget at-risk-widget">
      <div className="widget-header">
        <div>
          <h3>
            <i className="fas fa-user-shield me-2"></i>
            At-Risk Students
          </h3>
          <p className="text-muted">Monitor students at risk of dropout</p>
        </div>
        <button 
          onClick={handleTriggerAssessment} 
          disabled={loading}
          className="btn btn-primary"
        >
          <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-heartbeat'} me-2`}></i>
          {loading ? 'Assessing...' : 'Assess Now'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-cards">
        <div className="kpi-card kpi-high">
          <div className="kpi-icon">
            <i className="fas fa-exclamation-circle"></i>
          </div>
          <div className="kpi-content">
            <p className="kpi-label">HIGH Risk</p>
            <h3 className="kpi-value">{summary?.high_risk || 0}</h3>
            <small className="kpi-percent">{summary?.total_students > 0 ? ((summary.high_risk / summary.total_students) * 100).toFixed(1) : 0}%</small>
          </div>
        </div>

        <div className="kpi-card kpi-medium">
          <div className="kpi-icon">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div className="kpi-content">
            <p className="kpi-label">MEDIUM Risk</p>
            <h3 className="kpi-value">{summary?.medium_risk || 0}</h3>
            <small className="kpi-percent">{summary?.total_students > 0 ? ((summary.medium_risk / summary.total_students) * 100).toFixed(1) : 0}%</small>
          </div>
        </div>

        <div className="kpi-card kpi-low">
          <div className="kpi-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="kpi-content">
            <p className="kpi-label">LOW Risk</p>
            <h3 className="kpi-value">{summary?.low_risk || 0}</h3>
            <small className="kpi-percent">{summary?.total_students > 0 ? ((summary.low_risk / summary.total_students) * 100).toFixed(1) : 0}%</small>
          </div>
        </div>

        <div className="kpi-card kpi-avg">
          <div className="kpi-icon">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="kpi-content">
            <p className="kpi-label">Average Score</p>
            <h3 className="kpi-value">{(summary?.average_risk_score || 0).toFixed(1)}</h3>
            <small className="kpi-percent">out of 100</small>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="widget-controls">
        <div className="control-group">
          <select 
            value={riskFilter} 
            onChange={(e) => setRiskFilter(e.target.value)}
            className="form-control"
          >
            <option value="">All Risk Levels</option>
            <option value="HIGH">HIGH Risk Only</option>
            <option value="MEDIUM">MEDIUM Risk Only</option>
            <option value="LOW">LOW Risk Only</option>
          </select>
        </div>
        <div className="control-group">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="form-control"
          >
            <option value="risk_score">Sort by Risk Score</option>
            <option value="recent">Sort by Recent Assessment</option>
          </select>
        </div>
      </div>

      {/* Students Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner-border"></div>
          <p>Loading at-risk students...</p>
        </div>
      ) : filteredRisks.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-inbox"></i>
          <p>No students found</p>
          <small>At-risk students will appear here</small>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="risks-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Risk Level</th>
                <th>Risk Score</th>
                <th>Enrollment</th>
                <th>Indicators</th>
                <th>Last Assessed</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRisks.map((risk) => (
                <tr key={risk.id} className={`risk-${risk.risk_level.toLowerCase()}`}>
                  <td className="student-name">
                    <strong>{risk.student_name || `Student ${risk.enrollment?.user || 'N/A'}`}</strong>
                  </td>
                  <td>
                    <span className={`badge bg-${getRiskColor(risk.risk_level)}`}>
                      <i className={`fas ${getRiskIcon(risk.risk_level)} me-1`}></i>
                      {risk.risk_level}
                    </span>
                  </td>
                  <td>
                    <div className="risk-score-bar">
                      <div 
                        className={`score-fill score-${risk.risk_score >= 75 ? 'high' : risk.risk_score >= 50 ? 'medium' : 'low'}`}
                        style={{width: risk.risk_score + '%'}}
                      ></div>
                      <span className="score-text">{risk.risk_score.toFixed(1)}</span>
                    </div>
                  </td>
                  <td>{risk.course_title || 'N/A'}</td>
                  <td>
                    <div className="indicators-summary">
                      {risk.indicators && typeof risk.indicators === 'object' && (
                        <>
                          {risk.indicators.completion_rate !== undefined && (
                            <span className="indicator-tag" title="Completion Rate">
                              <i className="fas fa-check"></i> {risk.indicators.completion_rate}%
                            </span>
                          )}
                          {risk.indicators.quiz_pass_rate !== undefined && (
                            <span className="indicator-tag" title="Quiz Pass Rate">
                              <i className="fas fa-list-check"></i> {risk.indicators.quiz_pass_rate}%
                            </span>
                          )}
                          {risk.indicators.days_inactive !== undefined && (
                            <span className="indicator-tag" title="Days Inactive">
                              <i className="fas fa-clock"></i> {risk.indicators.days_inactive}d
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="last-assessed">
                    {risk.last_assessed ? new Date(risk.last_assessed).toLocaleDateString() : 'N/A'}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline-primary">
                      <i className="fas fa-envelope"></i> Message
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="widget-footer">
        <small className="text-muted">
          <i className="fas fa-info-circle me-1"></i>
          Last updated: {summary?.last_updated ? new Date(summary.last_updated).toLocaleString() : 'Never'}
        </small>
      </div>
    </div>
  );
}
