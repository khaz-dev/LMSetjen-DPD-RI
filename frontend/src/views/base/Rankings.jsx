import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import BaseHeader from '../partials/BaseHeader';
import Footer from '../partials/Footer';
import RankedStudents from '../../components/Rankings/RankedStudents';
import RankedInstructors from '../../components/Rankings/RankedInstructors';
import useStickyHero from '../../hooks/useStickyHero';
import './Rankings.css';

/**
  * Full Page Leaderboard & Rankings
  * Displays Top Instructors and Top Students across Setjen DPD RI
  */
function Rankings() {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'instructors' | 'students'
  const { isScrolled, headerHeight } = useStickyHero(55);

  // Ensure body background is properly tinted for silhouette layer
  React.useEffect(() => {
    const originalBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#f1f5f9";
    return () => {
      document.body.style.backgroundColor = originalBg;
    };
  }, []);

  return (
    <>
      <BaseHeader />
      <div className="rankings-page-wrapper">
        
        {/* Sticky Hero Slot prevents CLS layout shift */}
        <div 
          className="rankings-hero-slot"
          style={{ '--header-height': `${headerHeight}px` }}
        >
          {/* Hero Header - Compact & Eye-Catching with Sticky Scroll Behavior */}
          <section className={`rankings-hero-section py-3 py-md-4 ${isScrolled ? 'is-stuck' : ''}`}>
            <div className="container">
              <div className="rankings-hero-inner">
                <div className="rankings-hero-branding">
                  <div className="badge-rankings-pill mb-2">
                    <i className="fas fa-trophy me-2 text-warning"></i>
                    Papan Peringkat LMSetjen DPD RI
                  </div>
                  <h1 className="h2 fw-bold text-white mb-2 rankings-hero-title">
                    Peringkat Instruktur & Siswa Terbaik
                  </h1>
                  <p className="text-white text-opacity-75 mb-3 small mx-auto rankings-hero-subtitle" style={{ maxWidth: '620px' }}>
                    Apresiasi atas dedikasi pengajaran instruktur dan konsistensi pembelajaran pegawai di lingkungan Sekretariat Jenderal DPD RI.
                  </p>
                </div>

                {/* Filter Tabs - Crisp & Readable */}
                <div className="rankings-tab-switch d-inline-flex p-1 rounded-pill">
                  <button
                    className={`btn rounded-pill px-3 py-1 px-md-4 py-md-2 ${activeTab === 'all' ? 'btn-white-active' : 'btn-tab-inactive'}`}
                    onClick={() => setActiveTab('all')}
                  >
                    <i className="fas fa-users-viewfinder me-2"></i>Semua Peringkat
                  </button>
                  <button
                    className={`btn rounded-pill px-3 py-1 px-md-4 py-md-2 ${activeTab === 'instructors' ? 'btn-white-active' : 'btn-tab-inactive'}`}
                    onClick={() => setActiveTab('instructors')}
                  >
                    <i className="fas fa-chalkboard-user me-2"></i>Instruktur Terbaik
                  </button>
                  <button
                    className={`btn rounded-pill px-3 py-1 px-md-4 py-md-2 ${activeTab === 'students' ? 'btn-white-active' : 'btn-tab-inactive'}`}
                    onClick={() => setActiveTab('students')}
                  >
                    <i className="fas fa-graduation-cap me-2"></i>Siswa Terbaik
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Content Section - Compact Spacing with Frosted Veil */}
        <section className="py-3 py-md-4 rankings-content-section">
          {/* Background Geometric Grid & Luminous Glow Pattern matching About section */}
          <div className="rankings-background-pattern" aria-hidden="true"></div>

          <div className="container">
            
            {activeTab === 'all' && (
              <div className="row g-3 g-md-4 align-items-stretch">
                {/* Left Column: Ranked Instructors */}
                <div className="col-lg-6">
                  <div className="rankings-column-card h-100">
                    <RankedInstructors maxResults={15} />
                  </div>
                </div>

                {/* Right Column: Ranked Students */}
                <div className="col-lg-6">
                  <div className="rankings-column-card h-100">
                    <RankedStudents maxResults={15} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'instructors' && (
              <div className="row justify-content-center">
                <div className="col-lg-8 col-xl-7">
                  <div className="rankings-column-card">
                    <RankedInstructors maxResults={25} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'students' && (
              <div className="row justify-content-center">
                <div className="col-lg-8 col-xl-7">
                  <div className="rankings-column-card">
                    <RankedStudents maxResults={25} />
                  </div>
                </div>
              </div>
            )}

            {/* Gamification Points Rules Info - Compact */}
            <div className="row mt-3 g-3">
              <div className="col-md-6">
                <div className="card h-100 border-0 shadow-sm rounded-4 p-3 p-md-4 point-rule-card">
                  <div className="d-flex align-items-center gap-3 mb-2">
                    <div className="rule-icon-box bg-emerald-light text-teal">
                      <i className="fas fa-chalkboard-teacher fs-5"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0 text-dark">Sistem Poin Instruktur</h6>
                      <span className="small text-muted" style={{ fontSize: '0.78rem' }}>Cara menaikkan ranking sebagai instruktur</span>
                    </div>
                  </div>
                  <ul className="list-unstyled mb-3 rule-points-list small">
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-quote-left text-teal me-2"></i>Testimoni Platform Disetujui Admin</span>
                      <span className="badge bg-success-subtle text-success fw-bold">+50 Poin</span>
                    </li>
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-star text-warning me-2"></i>Menerima Rating Bintang dari Peserta</span>
                      <span className="badge bg-warning-subtle text-warning-emphasis fw-bold">10 - 50 Poin</span>
                    </li>
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-rocket text-primary me-2"></i>Mempublikasikan Kursus Baru</span>
                      <span className="badge bg-primary-subtle text-primary fw-bold">+100 Poin</span>
                    </li>
                  </ul>
                  <div className="mt-auto pt-1">
                    <Link to="/instructor/testimonials/" className="btn btn-sm btn-rankings-action-teal w-100">
                      <i className="fas fa-feather-pointed me-2"></i>Tulis Testimoni Instruktur (+50 Poin)
                    </Link>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card h-100 border-0 shadow-sm rounded-4 p-3 p-md-4 point-rule-card">
                  <div className="d-flex align-items-center gap-3 mb-2">
                    <div className="rule-icon-box bg-amber-light text-warning">
                      <i className="fas fa-graduation-cap fs-5"></i>
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0 text-dark">Sistem Poin Siswa</h6>
                      <span className="small text-muted" style={{ fontSize: '0.78rem' }}>Cara menaikkan ranking sebagai peserta didik</span>
                    </div>
                  </div>
                  <ul className="list-unstyled mb-3 rule-points-list small">
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-check-circle text-success me-2"></i>Menyelesaikan Seluruh Kursus</span>
                      <span className="badge bg-success-subtle text-success fw-bold">+100 Poin</span>
                    </li>
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-certificate text-warning me-2"></i>Memperoleh Sertifikat Kompetensi</span>
                      <span className="badge bg-warning-subtle text-warning-emphasis fw-bold">+50 Poin</span>
                    </li>
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-clipboard-check text-info me-2"></i>Lulus Kuis & Ujian Pelajaran</span>
                      <span className="badge bg-info-subtle text-info-emphasis fw-bold">+25 Poin</span>
                    </li>
                  </ul>
                  <div className="mt-auto pt-1">
                    <Link to="/search/" className="btn btn-sm btn-rankings-action-gold w-100">
                      <i className="fas fa-book-open me-2 text-warning"></i>Jelajahi & Ikuti Kursus
                    </Link>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

      </div>
      <Footer />
    </>
  );
}

export default Rankings;
