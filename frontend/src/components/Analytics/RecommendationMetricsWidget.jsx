import React, { useState, useEffect } from 'react';
import apiInstance from '../../utils/axios';
import Toast from '../../views/plugin/Toast';
import './AnalyticsWidgets.css';

export default function RecommendationMetricsWidget() {
  const [stats, setStats] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterReason, setFilterReason] = useState('');
  const [sortBy, setSortBy] = useState('created_at');

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const [statsResponse, recsResponse] = await Promise.all([
        apiInstance.get('analytics/recommendations/stats/'),
        apiInstance.get('analytics/recommendations/')
      ]);
      
      setStats(statsResponse.data);
      setRecommendations(recsResponse.data.results || recsResponse.data || []);
    } catch (error) {
      Toast().fire({
        icon: 'error',
        title: 'Gagal mengambil metrik rekomendasi'
      });
    }
    setLoading(false);
  };

  // Filter and sort recommendations
  const filteredRecs = [...recommendations]
    .filter(rec => !filterReason || rec.reason === filterReason)
    .sort((a, b) => {
      if (sortBy === 'created_at') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'score') return b.score - a.score;
      return 0;
    });

  const reasonColors = {
    'similar_content': 'primary',
    'trending': 'success',
    'personalized': 'info',
    'popular': 'warning',
    'completed_prerequisite': 'secondary'
  };

  const getReasonLabel = (reason) => {
    const labels = {
      'similar_content': 'Konten Serupa',
      'trending': 'Kursus Trending',
      'personalized': 'Dipersonalisasi',
      'popular': 'Populer',
      'completed_prerequisite': 'Prasyarat Selesai'
    };
    return labels[reason] || reason;
  };

  const getConversionRate = (rec) => {
    if (!rec.clicked) return 0;
    return rec.enrolled ? 100 : 0;
  };

  return (
    <div className="analytics-widget recommendation-metrics-widget">
      <div className="widget-header">
        <div>
          <h3>
            <i className="fas fa-star me-2"></i>
            Performa Rekomendasi
          </h3>
          <p className="text-muted">Lacak efektivitas rekomendasi kursus</p>
        </div>
        <button 
          onClick={fetchMetrics} 
          disabled={loading}
          className="btn btn-primary"
        >
          <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-sync-alt'} me-2`}></i>
          Segarkan
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-cards">
        <div className="kpi-card kpi-primary">
          <div className="kpi-icon">
            <i className="fas fa-bullseye"></i>
          </div>
          <div className="kpi-content">
            <p className="kpi-label">Total Rekomendasi</p>
            <h3 className="kpi-value">{stats?.total_recommendations || 0}</h3>
            <small className="kpi-percent">sepanjang waktu</small>
          </div>
        </div>

        <div className="kpi-card kpi-info">
          <div className="kpi-icon">
            <i className="fas fa-mouse"></i>
          </div>
          <div className="kpi-content">
            <p className="kpi-label">Tingkat Klik</p>
            <h3 className="kpi-value">{(stats?.ctr_percent || 0).toFixed(1)}%</h3>
            <small className="kpi-percent">{stats?.total_clicks || 0} klik</small>
          </div>
        </div>

        <div className="kpi-card kpi-success">
          <div className="kpi-icon">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <div className="kpi-content">
            <p className="kpi-label">Tingkat Konversi</p>
            <h3 className="kpi-value">{(stats?.conversion_percent || 0).toFixed(1)}%</h3>
            <small className="kpi-percent">{stats?.total_enrollments || 0} pendaftaran</small>
          </div>
        </div>

        <div className="kpi-card kpi-warning">
          <div className="kpi-icon">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="kpi-content">
            <p className="kpi-label">Skor Rata-rata</p>
            <h3 className="kpi-value">
              {recommendations.length > 0 
                ? (recommendations.reduce((sum, r) => sum + r.score, 0) / recommendations.length).toFixed(1)
                : '0'
              }
            </h3>
            <small className="kpi-percent">dari 100</small>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="widget-controls">
        <div className="control-group">
          <select 
            value={filterReason} 
            onChange={(e) => setFilterReason(e.target.value)}
            className="form-control"
          >
            <option value="">Semua Alasan Rekomendasi</option>
            <option value="similar_content">Konten Serupa</option>
            <option value="trending">Trending</option>
            <option value="personalized">Dipersonalisasi</option>
            <option value="popular">Populer</option>
            <option value="completed_prerequisite">Prasyarat Selesai</option>
          </select>
        </div>
        <div className="control-group">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="form-control"
          >
            <option value="created_at">Urutkan berdasarkan Terbaru</option>
            <option value="score">Urutkan berdasarkan Skor</option>
          </select>
        </div>
      </div>

      {/* Performance Chart */}
      {stats?.by_reason && Object.keys(stats.by_reason).length > 0 && (
        <div className="performance-chart">
          <h4 className="chart-title">Performa menurut Alasan Rekomendasi</h4>
          <div className="reason-stats">
            {Object.entries(stats.by_reason).map(([reason, data]) => (
              <div key={reason} className="reason-stat">
                <div className="reason-label">
                  <span className={`badge bg-${reasonColors[reason] || 'secondary'}`}>
                    {getReasonLabel(reason)}
                  </span>
                </div>
                <div className="reason-bar">
                  <div className="bar-segment clicks" style={{width: (data.clicks / Math.max(...Object.values(stats.by_reason).map(d => d.clicks)) || 1) * 100 + '%'}}>
                    <span className="bar-label">{data.clicks} klik</span>
                  </div>
                  <div className="bar-segment enrollments" style={{width: (data.enrollments / Math.max(...Object.values(stats.by_reason).map(d => d.enrollments)) || 1) * 100 + '%'}}>
                    <span className="bar-label">{data.enrollments} daftar</span>
                  </div>
                </div>
                <div className="reason-rates">
                  <span>CTR: {data.ctr ? data.ctr.toFixed(1) : 0}%</span>
                  <span>Conv: {data.conversion ? data.conversion.toFixed(1) : 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner-border"></div>
          <p>Memuat rekomendasi...</p>
        </div>
      ) : filteredRecs.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-inbox"></i>
          <p>Tidak ada rekomendasi yang ditemukan</p>
          <small>Rekomendasi akan muncul di sini</small>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="recommendations-table">
            <thead>
              <tr>
                <th>Pengguna</th>
                <th>Kursus</th>
                <th>Alasan</th>
                <th>Skor</th>
                <th>Status</th>
                <th>Diklik</th>
                <th>Terdaftar</th>
                <th>Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecs.slice(0, 50).map((rec) => (
                <tr key={rec.id}>
                  <td className="user-name">
                    {rec.user_name || `User ${rec.user}`}
                  </td>
                  <td className="course-name">
                    {rec.course_detail?.title || rec.course_name || 'N/A'}
                  </td>
                  <td>
                    <span className={`badge bg-${reasonColors[rec.reason] || 'secondary'}`}>
                      {getReasonLabel(rec.reason)}
                    </span>
                  </td>
                  <td>
                    <div className="score-badge">
                      <span className={`badge bg-${rec.score >= 70 ? 'success' : rec.score >= 40 ? 'warning' : 'danger'}`}>
                        {rec.score.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td>
                    {rec.enrolled ? (
                      <span className="badge bg-success">
                        <i className="fas fa-check me-1"></i>Terdaftar
                      </span>
                    ) : rec.clicked ? (
                      <span className="badge bg-info">
                        <i className="fas fa-eye me-1"></i>Dilihat
                      </span>
                    ) : (
                      <span className="badge bg-secondary">
                        <i className="fas fa-clock me-1"></i>Baru
                      </span>
                    )}
                  </td>
                  <td>
                    {rec.clicked ? (
                      <>
                        <i className="fas fa-check text-success"></i> {rec.click_date ? new Date(rec.click_date).toLocaleDateString() : 'Ya'}
                      </>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    {rec.enrolled ? (
                      <>
                        <i className="fas fa-check text-success"></i> {rec.enroll_date ? new Date(rec.enroll_date).toLocaleDateString() : 'Ya'}
                      </>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="created-date">
                    {new Date(rec.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRecs.length > 50 && (
            <div className="table-footer">
              <small className="text-muted">Menampilkan 50 dari {filteredRecs.length} rekomendasi</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
