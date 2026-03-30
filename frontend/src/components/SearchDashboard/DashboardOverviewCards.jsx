import React from 'react';

/**
 * DashboardOverviewCards Component
 * Displays KPI cards showing overview metrics
 * Shows: Total Searches, Unique Searchers, Avg Results, etc.
 */
const DashboardOverviewCards = ({ overview = {}, loading = false }) => {
  const {
    total_searches = 0,
    unique_searchers = 0,
    unique_queries = 0,
    avg_results_per_search = 0,
    avg_ctr = 0,
    search_quality_score = 0
  } = overview;

  const cards = [
    {
      id: 'total-searches',
      title: 'Total Searches',
      value: total_searches.toLocaleString(),
      icon: '🔍',
      color: '#0f766e',
      change: '+12%'
    },
    {
      id: 'unique-searchers',
      title: 'Unique Searchers',
      value: unique_searchers.toLocaleString(),
      icon: '👥',
      color: '#4CAF50',
      change: '+8%'
    },
    {
      id: 'unique-queries',
      title: 'Unique Queries',
      value: unique_queries.toLocaleString(),
      icon: '✨',
      color: '#FF9800',
      change: '+15%'
    },
    {
      id: 'avg-results',
      title: 'Avg Results/Search',
      value: avg_results_per_search.toFixed(1),
      icon: '📊',
      color: '#0d9488',
      change: `${avg_results_per_search > 10 ? '✓' : '⚠'}`
    },
    {
      id: 'quality-score',
      title: 'Quality Score',
      value: `${search_quality_score.toFixed(1)}/100`,
      icon: '⭐',
      color: search_quality_score >= 80 ? '#4CAF50' : '#FFC107',
      change: search_quality_score >= 80 ? 'Excellent' : 'Good'
    },
    {
      id: 'avg-ctr',
      title: 'Avg CTR',
      value: `${(avg_ctr * 100).toFixed(2)}%`,
      icon: '📈',
      color: '#F44336',
      change: avg_ctr > 0.3 ? '↑ High' : '→ Avg'
    }
  ];

  return (
    <div className="dashboard-overview-cards">
      {cards.map(card => (
        <div
          key={card.id}
          className={`overview-card ${loading ? 'loading' : ''}`}
          style={{ borderLeftColor: card.color }}
        >
          {loading ? (
            <div className="card-skeleton" />
          ) : (
            <>
              <div className="card-header">
                <div className="card-icon" style={{ backgroundColor: `${card.color}15` }}>
                  {card.icon}
                </div>
                <div className="card-title">{card.title}</div>
              </div>

              <div className="card-body">
                <div className="card-value">{card.value}</div>
                <div className="card-change" style={{ color: card.color }}>
                  {card.change}
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default DashboardOverviewCards;
