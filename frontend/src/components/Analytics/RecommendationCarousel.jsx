import React, { useState, useEffect } from 'react';
import apiInstance from '../../utils/axios';
import './RecommendationCarousel.css';

export default function RecommendationCarousel() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      fetchRecommendations();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchRecommendations = async () => {
    try {
      const response = await apiInstance.get('analytics/recommendations/?limit=6');
      setRecommendations(response.data.results || response.data || []);
    } catch (error) {
    }
    setLoading(false);
  };

  const handleClick = async (recommendationId) => {
    try {
      await apiInstance.post(`analytics/recommendations/${recommendationId}/click/`);
      // Update UI to show click
      setRecommendations(prev =>
        prev.map(rec =>
          rec.id === recommendationId ? { ...rec, clicked: true } : rec
        )
      );
    } catch (error) {
    }
  };

  const handleEnroll = async (recommendationId, courseId) => {
    try {
      await apiInstance.post(`analytics/recommendations/${recommendationId}/enroll/`);
      // Update UI to show enrollment
      setRecommendations(prev =>
        prev.map(rec =>
          rec.id === recommendationId ? { ...rec, enrolled: true } : rec
        )
      );
    } catch (error) {
    }
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? recommendations.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === recommendations.length - 1 ? 0 : prev + 1));
  };

  if (!isAuthenticated) {
    return (
      <div className="recommendation-carousel-container">
        <div className="auth-prompt">
          <div className="auth-content">
            <i className="fas fa-graduation-cap"></i>
            <h3>Jalur Pembelajaran Dipersonalisasi Menanti</h3>
            <p>Masuk untuk mendapatkan rekomendasi kursus yang disesuaikan dengan tujuan pembelajaran Anda</p>
            <a href="/sign-in" className="btn btn-primary">Masuk</a>
            <a href="/sign-up" className="btn btn-outline">Buat Akun</a>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="recommendation-carousel-container">
        <div className="loading-skeleton">
          <div className="skeleton-card"></div>
          <div className="skeleton-card"></div>
          <div className="skeleton-card"></div>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return null;
  }

  const displayCards = recommendations.slice(0, 3).map((rec, idx) => (
    recommendations[(currentIndex + idx) % recommendations.length]
  ));

  return (
    <div className="recommendation-carousel-container">
      <div className="carousel-header">
        <div>
          <h2>
            <i className="fas fa-star me-2"></i>
            Direkomendasikan untuk Anda
          </h2>
          <p>Kursus yang dikurasi berdasarkan profil pembelajaran dan minat Anda</p>
        </div>
        <div className="carousel-nav">
          <button 
            className="carousel-btn prev-btn" 
            onClick={goToPrevious}
            aria-label="Previous recommendations"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          <span className="carousel-counter">{currentIndex + 1} / {recommendations.length}</span>
          <button 
            className="carousel-btn next-btn" 
            onClick={goToNext}
            aria-label="Next recommendations"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>

      <div className="carousel-content">
        <div className="carousel-cards">
          {displayCards.map((rec, index) => (
            <div 
              key={rec.id} 
              className={`recommendation-card ${rec.enrolled ? 'enrolled' : rec.clicked ? 'viewed' : 'new'}`}
            >
              <div className="card-image">
                {rec.course_detail?.image ? (
                  <img 
                    src={rec.course_detail.image} 
                    alt={rec.course_detail?.title || 'Course'}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className="image-placeholder" style={{display: !rec.course_detail?.image ? 'flex' : 'none'}}>
                  <i className="fas fa-book"></i>
                </div>
                <div className="recommendation-badge">
                  <span className={`badge badge-${getReasonColor(rec.reason)}`}>
                    {getReasonLabel(rec.reason)}
                  </span>
                </div>
                {rec.enrolled && (
                  <div className="status-overlay enrolled">
                    <i className="fas fa-check-circle"></i>
                    <p>Terdaftar</p>
                  </div>
                )}
              </div>

              <div className="card-content">
                <h3 className="card-title">
                  {rec.course_detail?.title || rec.course_name || 'Kursus'}
                </h3>
                <p className="card-reason">
                  {getFullReasonLabel(rec.reason)}
                </p>

                <div className="card-score">
                  <div className="score-bar">
                    <div 
                      className={`score-fill score-${rec.score >= 70 ? 'high' : rec.score >= 40 ? 'medium' : 'low'}`}
                      style={{ width: rec.score + '%' }}
                    ></div>
                  </div>
                  <span className="score-text">{rec.score.toFixed(0)}% cocok</span>
                </div>

                {rec.course_detail?.instructor_name && (
                  <div className="card-instructor">
                    <i className="fas fa-chalkboard-user"></i>
                    {rec.course_detail.instructor_name}
                  </div>
                )}

                {rec.course_detail?.description && (
                  <p className="card-description">
                    {rec.course_detail.description.substring(0, 100)}...
                  </p>
                )}
              </div>

              <div className="card-footer">
                <button 
                  className="btn btn-outline"
                  onClick={() => handleClick(rec.id)}
                  disabled={rec.clicked}
                >
                  <i className="fas fa-eye me-1"></i>
                  {rec.clicked ? 'Dilihat' : 'Pelajari Lebih Lanjut'}
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleEnroll(rec.id, rec.course)}
                  disabled={rec.enrolled}
                >
                  <i className="fas fa-plus me-1"></i>
                  {rec.enrolled ? 'Terdaftar' : 'Daftar Sekarang'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="carousel-dots">
        {recommendations.map((_, idx) => (
          <button
            key={idx}
            className={`dot ${idx === currentIndex ? 'active' : ''}`}
            onClick={() => setCurrentIndex(idx)}
            aria-label={`Go to recommendation ${idx + 1}`}
          ></button>
        ))}
      </div>
    </div>
  );
}

function getReasonColor(reason) {
  const colors = {
    'similar_content': 'primary',
    'trending': 'success',
    'personalized': 'info',
    'popular': 'warning',
    'completed_prerequisite': 'secondary'
  };
  return colors[reason] || 'secondary';
}

function getReasonLabel(reason) {
  const labels = {
    'similar_content': 'Serupa',
    'trending': 'Trending',
    'personalized': 'Untuk Anda',
    'popular': 'Populer',
    'completed_prerequisite': 'Langkah Berikutnya'
  };
  return labels[reason] || reason;
}

function getFullReasonLabel(reason) {
  const labels = {
    'similar_content': 'Berdasarkan kursus yang Anda ambil',
    'trending': 'Populer minggu ini',
    'personalized': 'Disesuaikan dengan minat Anda',
    'popular': 'Paling banyak diambil oleh teman sejawat',
    'completed_prerequisite': 'Tersedia setelah prasyarat'
  };
  return labels[reason] || reason;
}
