import React, { useState, useEffect } from 'react';
import apiInstance from '../../utils/axios';
import Toast from '../../views/plugin/Toast';
import './QueryTaxonomyWidget.css';

export default function QueryTaxonomyWidget() {
  const [report, setReport] = useState(null);
  const [taxonomies, setTaxonomies] = useState([]);
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [timelineData, setTimelineData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchTaxonomyReport();
  }, [days]);

  useEffect(() => {
    if (activeTab === 'queries') {
      fetchTaxonomies();
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    } else if (activeTab === 'timeline') {
      fetchTimeline();
    }
  }, [activeTab, selectedCategory, days]);

  const fetchTaxonomyReport = async () => {
    setLoading(true);
    try {
      const response = await apiInstance.get(`analytics/search-taxonomy/report/?days=${days}`);
      if (response.data?.success) {
        setReport(response.data);
      }
    } catch (error) {
      Toast().fire({
        icon: 'error',
        title: 'Gagal mengambil laporan taksonomi'
      });
    }
    setLoading(false);
  };

  const fetchTaxonomies = async () => {
    setLoading(true);
    try {
      let params = new URLSearchParams();
      if (selectedCategory) params.append('category_id', selectedCategory);
      
      const response = await apiInstance.get(`analytics/search-taxonomy/queries/?${params.toString()}`);
      if (response.data?.results) {
        setTaxonomies(response.data.results);
      }
    } catch (error) {
      Toast().fire({
        icon: 'error',
        title: 'Gagal mengambil taksonomi kueri'
      });
    }
    setLoading(false);
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let params = new URLSearchParams();
      if (selectedCategory) params.append('category_id', selectedCategory);
      
      const response = await apiInstance.get(`analytics/search-taxonomy/category-analytics/?${params.toString()}`);
      if (response.data?.results) {
        setAnalytics(response.data.results);
      }
    } catch (error) {
      Toast().fire({
        icon: 'error',
        title: 'Gagal mengambil analitik kategori'
      });
    }
    setLoading(false);
  };

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const response = await apiInstance.get(`analytics/search-taxonomy/timeline/?days=${days}`);
      if (response.data?.success) {
        setTimelineData(response.data);
      }
    } catch (error) {
      Toast().fire({
        icon: 'error',
        title: 'Gagal mengambil data garis waktu'
      });
    }
    setLoading(false);
  };

  const getPerformanceColor = (ctr) => {
    if (ctr >= 10) return '#20c997';
    if (ctr >= 5) return '#28a745';
    if (ctr >= 1) return '#ffc107';
    return '#dc3545';
  };

  const getPerformanceBadge = (ctr) => {
    if (ctr >= 10) return 'success';
    if (ctr >= 5) return 'info';
    if (ctr >= 1) return 'warning';
    return 'danger';
  };

  if (loading && !report && activeTab === 'overview') {
    return <div className="qtw-widget card"><div className="card-body text-center">Memuat...</div></div>;
  }

  return (
    <div className="qtw-widget card">
      <div className="card-header bg-light border-bottom">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h5 className="mb-0">🏷️ Taksonomi Kueri Pencarian</h5>
            <small className="text-muted">Kategorikan dan analisis kueri pencarian berdasarkan maksud</small>
          </div>
          <div className="btn-group btn-group-sm">
            <button
              className={`btn ${days === 7 ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setDays(7)}
            >
              7 hari
            </button>
            <button
              className={`btn ${days === 30 ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setDays(30)}
            >
              30 hari
            </button>
            <button
              className={`btn ${days === 90 ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setDays(90)}
            >
              90 hari
            </button>
          </div>
        </div>
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
            Ringkasan
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'queries' ? 'active' : ''}`}
            href="#queries"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('queries');
            }}
          >
            Kueri
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`}
            href="#analytics"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('analytics');
            }}
          >
            Kategori
          </a>
        </li>
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === 'timeline' ? 'active' : ''}`}
            href="#timeline"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('timeline');
            }}
          >
            Garis Waktu
          </a>
        </li>
      </ul>

      <div className="card-body">
        {/* Overview Tab */}
        {activeTab === 'overview' && report && (
          <div className="qtw-overview">
            <div className="row mb-4">
              <div className="col-md-3 mb-3">
                <div className="metric-card">
                  <div className="metric-label">Total Pencarian</div>
                  <div className="metric-value">{report.total_searches}</div>
                </div>
              </div>
              <div className="col-md-3 mb-3">
                <div className="metric-card">
                  <div className="metric-label">Kueri Unik</div>
                  <div className="metric-value">{report.unique_queries}</div>
                </div>
              </div>
              <div className="col-md-3 mb-3">
                <div className="metric-card">
                  <div className="metric-label">Pengguna Unik</div>
                  <div className="metric-value">{report.unique_users}</div>
                </div>
              </div>
              <div className="col-md-3 mb-3">
                <div className="metric-card highlight">
                  <div className="metric-label">CTR Rata-rata</div>
                  <div className="metric-value">{report.avg_ctr.toFixed(2)}%</div>
                </div>
              </div>
            </div>

            <h6 className="mb-3">Kategori Kueri</h6>
            <div className="row">
              {report.categories && Object.entries(report.categories).slice(0, 6).map(([key, cat]) => (
                <div key={key} className="col-md-6 mb-3">
                  <div className="category-card">
                    <div className="category-header">
                      <strong>{cat.category_name}</strong>
                      {cat.trending && <span className="badge bg-danger ms-2">Trending</span>}
                    </div>
                    <div className="category-stats">
                      <div className="stat">
                        <span className="label">Volume:</span>
                        <span className="value">{cat.search_volume}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Hasil Rata-rata:</span>
                        <span className="value">{cat.avg_results}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Tingkat Gagal:</span>
                        <span className="value text-danger">{cat.failed_rate.toFixed(1)}%</span>
                      </div>
                    </div>
                    {cat.top_queries && cat.top_queries.length > 0 && (
                      <div className="top-queries">
                        <small className="text-muted">Kueri Teratas:</small>
                        <ul>
                          {cat.top_queries.slice(0, 3).map((q, idx) => (
                            <li key={idx}>{q.search_query} ({q.count})</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Queries Tab */}
        {activeTab === 'queries' && (
          <div className="qtw-queries">
            <div className="mb-3">
              <label className="form-label">Filter berdasarkan Kategori</label>
              <select
                className="form-select"
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
              >
                <option value="">Semua Kategori</option>
                {report?.categories && Object.entries(report.categories).map(([key, cat]) => (
                  <option key={key} value={cat.category_type}>
                    {cat.category_name}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="text-center">Memuat...</div>
            ) : taxonomies.length === 0 ? (
              <div className="alert alert-info">Tidak ada kueri yang ditemukan</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover table-sm">
                  <thead className="table-light">
                    <tr>
                      <th>Kueri</th>
                      <th>Kategori</th>
                      <th>Pencarian</th>
                      <th>Klik</th>
                      <th>CTR</th>
                      <th>Gagal</th>
                      <th>Pengguna</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxonomies.map((tax) => {
                      const ctr = tax.search_count > 0 ? (tax.click_through_count / tax.search_count) * 100 : 0;
                      return (
                        <tr key={tax.id}>
                          <td><strong>{tax.search_query}</strong></td>
                          <td><small>{tax.category_type}</small></td>
                          <td>{tax.search_count}</td>
                          <td>{tax.click_through_count}</td>
                          <td>
                            <span className={`badge bg-${getPerformanceBadge(ctr)}`}>
                              {ctr.toFixed(1)}%
                            </span>
                          </td>
                          <td><span className="badge bg-warning">{tax.failed_count}</span></td>
                          <td>{tax.unique_users}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="qtw-analytics">
            {loading ? (
              <div className="text-center">Memuat...</div>
            ) : analytics.length === 0 ? (
              <div className="alert alert-info">Tidak ada analitik kategori yang tersedia</div>
            ) : (
              <div className="row">
                {analytics.map((cat) => (
                  <div key={cat.id} className="col-md-6 mb-4">
                    <div className="analytics-card">
                      <div className="header">
                        <h6>{cat.category_name}</h6>
                        <span className={`badge bg-${getPerformanceBadge(cat.avg_ctr)}`}>
                          {cat.performance_indicator}
                        </span>
                      </div>
                      <div className="metrics">
                        <div className="metric-row">
                          <span>Total Pencarian</span>
                          <strong>{cat.total_searches}</strong>
                        </div>
                        <div className="metric-row">
                          <span>CTR</span>
                          <strong style={{ color: getPerformanceColor(cat.avg_ctr) }}>
                            {cat.avg_ctr.toFixed(2)}%
                          </strong>
                        </div>
                        <div className="metric-row">
                          <span>Tingkat Gagal</span>
                          <strong className="text-danger">{cat.failed_rate.toFixed(1)}%</strong>
                        </div>
                        <div className="metric-row">
                          <span>Skor Trending</span>
                          <div className="progress" style={{ height: '20px' }}>
                            <div
                              className="progress-bar"
                              style={{
                                width: `${cat.trending_score}%`,
                                backgroundColor: cat.trending_score >= 50 ? '#28a745' : '#ffc107'
                              }}
                            >
                              {cat.trending_score.toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && timelineData && (
          <div className="qtw-timeline">
            <h6 className="mb-3">Volume Pencarian Seiring Waktu</h6>
            {timelineData.daily_stats && timelineData.daily_stats.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-sm table-hover">
                  <thead className="table-light">
                    <tr>
                      <th>Tanggal</th>
                      <th>Pencarian</th>
                      <th>CTR Rata-rata</th>
                      <th>Kegagalan</th>
                      <th>Kueri Baru</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineData.daily_stats.map((day, idx) => (
                      <tr key={idx}>
                        <td><small>{new Date(day.date).toLocaleDateString()}</small></td>
                        <td>{day.total_searches}</td>
                        <td>
                          <span className={`badge bg-${getPerformanceBadge(day.avg_ctr || 0)}`}>
                            {(day.avg_ctr || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td><span className="badge bg-warning">{day.total_failures || 0}</span></td>
                        <td>{day.new_queries}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="alert alert-info">Tidak ada data garis waktu yang tersedia</div>
            )}

            {timelineData.trending_categories && timelineData.trending_categories.length > 0 && (
              <div className="mt-4">
                <h6 className="mb-3">Kategori Trending</h6>
                <div className="row">
                  {timelineData.trending_categories.map((cat) => (
                    <div key={cat.id} className="col-md-6 mb-3">
                      <div className="trending-badge">
                        <strong>{cat.category_name}</strong>
                        <div className="trend-score">
                          Trending: <span className="badge bg-danger">{cat.trending_score.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card-footer bg-light text-end">
        <button
          className="btn btn-sm btn-primary"
          onClick={fetchTaxonomyReport}
          disabled={loading}
        >
          {loading ? 'Menyegarkan...' : 'Segarkan'}
        </button>
      </div>
    </div>
  );
}
