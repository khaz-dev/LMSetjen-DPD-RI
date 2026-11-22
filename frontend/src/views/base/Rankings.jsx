import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import BaseHeader from '../partials/BaseHeader';
import Footer from '../partials/Footer';
import RankedStudents from '../../components/Rankings/RankedStudents';
import RankedInstructors from '../../components/Rankings/RankedInstructors';
import './Rankings.css';

/**
  * Full Page Leaderboard & Rankings
  * Displays Top Instructors and Top Students across Setjen DPD RI
  */
function Rankings() {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'instructors' | 'students'
  const [headerHeight, setHeaderHeight] = useState(60);
  const [isScrolled, setIsScrolled] = useState(false);
  const heroRef = useRef(null);
  const [expandedHeroHeight, setExpandedHeroHeight] = useState(200);

  // Ensure body background is properly tinted for silhouette layer
  useEffect(() => {
    const originalBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#f1f5f9";
    return () => {
      document.body.style.backgroundColor = originalBg;
    };
  }, []);

  // Dynamically track BaseHeader height
  useEffect(() => {
    const updateHeaderHeight = () => {
      const headerEl = document.querySelector('.base-header');
      if (headerEl) {
        setHeaderHeight(headerEl.offsetHeight);
      }
    };

    updateHeaderHeight();

    let ro = null;
    const headerEl = document.querySelector('.base-header');
    if (headerEl && window.ResizeObserver) {
      ro = new ResizeObserver(updateHeaderHeight);
      ro.observe(headerEl);
    }

    window.addEventListener("resize", updateHeaderHeight);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, []);

  // Continuously measure true expanded hero height (adapts to tabs, screen resize, etc.)
  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;

    const updateExpandedHeight = () => {
      if (!isScrolled && heroEl.offsetHeight > 80) {
        setExpandedHeroHeight(heroEl.offsetHeight);
      }
    };

    updateExpandedHeight();

    let ro = null;
    if (typeof window !== "undefined" && window.ResizeObserver) {
      ro = new ResizeObserver(updateExpandedHeight);
      ro.observe(heroEl);
    }

    window.addEventListener("resize", updateExpandedHeight);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", updateExpandedHeight);
    };
  }, [isScrolled, activeTab]);

  // Dynamic scroll observer for sticky hero with mathematically exact zero-gap alignment
  useEffect(() => {
    let ticking = false;
    const STUCK_HERO_HEIGHT = 58;

    const updateScrollState = () => {
      // The stuck hero bottom edge in viewport sits at headerHeight + STUCK_HERO_HEIGHT
      // The top of rankings-content-section in viewport sits at expandedHeroHeight - window.scrollY
      // They meet seamlessly with 0 gap when:
      // window.scrollY >= expandedHeroHeight - headerHeight - STUCK_HERO_HEIGHT
      const threshold = Math.max(60, expandedHeroHeight - headerHeight - STUCK_HERO_HEIGHT);
      setIsScrolled(window.scrollY >= threshold);
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollState);
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateScrollState();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [expandedHeroHeight, headerHeight]);

  return (
    <>
      <BaseHeader />
      <div 
        className="rankings-page-wrapper"
        style={{
          '--header-height': `${headerHeight}px`,
          '--hero-expanded-height': `${expandedHeroHeight}px`,
          '--stuck-hero-height': '58px'
        }}
      >
        
        {/* Sticky Hero Slot prevents CLS layout shift */}
        <div 
          className={`rankings-hero-slot ${isScrolled ? 'is-stuck' : ''}`}
        >
          {/* Hero Header - Compact & Eye-Catching with Sticky Scroll Behavior */}
          <section 
            ref={heroRef}
            className={`rankings-hero-section py-3 py-md-4 ${isScrolled ? 'is-stuck' : ''}`}
          >
            <div className="container">
              <div className="rankings-hero-inner">
                <div className="rankings-hero-branding">
                  <div className="badge-rankings-pill mb-2">
                    <i className="fas fa-trophy me-2 text-warning"></i>
                    Papan Peringkat LMSetjen DPD RI
                  </div>
                  <h1 className="h2 fw-bold text-white mb-2 rankings-hero-title">
                    Peringkat Instruktur & Peserta Terbaik
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
                    <i className="fas fa-graduation-cap me-2"></i>Peserta Terbaik
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
                      <span><i className="fas fa-rocket text-primary me-2"></i>Mempublikasikan Kursus Baru</span>
                      <span className="badge bg-primary-subtle text-primary fw-bold">+100 Poin</span>
                    </li>
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-graduation-cap text-emerald me-2"></i>Kelulusan Peserta Kursus</span>
                      <span className="badge bg-success-subtle text-success fw-bold">+20 Poin / Lulus</span>
                    </li>
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-user-graduate text-success me-2"></i>Pendaftaran Peserta Baru</span>
                      <span className="badge bg-success-subtle text-success fw-bold">+10 Poin / Peserta</span>
                    </li>
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-star text-warning me-2"></i>Menerima Rating Bintang dari Peserta</span>
                      <span className="badge bg-warning-subtle text-warning-emphasis fw-bold">10 - 50 Poin</span>
                    </li>
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-comments text-info me-2"></i>Bimbingan & Jawaban Diskusi Q&A</span>
                      <span className="badge bg-info-subtle text-info fw-bold">+5 Poin</span>
                    </li>
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-quote-left text-teal me-2"></i>Testimoni Platform Disetujui Admin</span>
                      <span className="badge bg-teal-subtle text-teal fw-bold">+20 Poin</span>
                    </li>
                  </ul>
                  <div className="mt-auto pt-1">
                    <Link to="/instructor/testimonials/" className="btn btn-sm btn-rankings-action-teal w-100">
                      <i className="fas fa-feather-pointed me-2"></i>Tulis Testimoni Instruktur (+20 Poin)
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
                      <h6 className="fw-bold mb-0 text-dark">Sistem Poin Peserta</h6>
                      <span className="small text-muted" style={{ fontSize: '0.78rem' }}>Cara menaikkan ranking sebagai peserta pelatihan</span>
                    </div>
                  </div>
                  <ul className="list-unstyled mb-3 rule-points-list small">
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-graduation-cap text-success me-2"></i>Menyelesaikan Kursus & Raih Sertifikat</span>
                      <span className="badge bg-success-subtle text-success fw-bold">+100 Poin</span>
                    </li>
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-star text-warning me-2"></i>Ulasan Kursus Konstruktif</span>
                      <span className="badge bg-warning-subtle text-warning-emphasis fw-bold">+15 Poin</span>
                    </li>
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-quote-left text-teal me-2"></i>Testimoni Platform Disetujui</span>
                      <span className="badge bg-teal-subtle text-teal fw-bold">+20 Poin</span>
                    </li>
                    <li className="d-flex align-items-center justify-content-between py-2 border-bottom">
                      <span><i className="fas fa-trophy text-info me-2"></i>Kelulusan Kuis & Ujian Materi</span>
                      <span className="badge bg-info-subtle text-info-emphasis fw-bold">Peringkat Kursus</span>
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

            {/* ✨ PHASE: Integrated Manta AI Gamification Hierarchy & Badges Explanation */}
            <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mt-2" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f0fdfa 100%)', borderColor: '#ccfbf1' }}>
              <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-3 pb-3 border-bottom">
                <div className="d-flex align-items-center gap-3">
                  <div className="rule-icon-box" style={{ background: '#ccfbf1', color: '#0f766e', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-trophy fs-5"></i>
                  </div>
                  <div>
                    <h6 className="fw-bold mb-0 text-dark fs-6">Jenjang Level Kompetensi ASN & Milestone Badges Manta AI</h6>
                    <span className="small text-muted" style={{ fontSize: '0.8rem' }}>
                      Sistem ranking terintegrasi secara otomatis dengan kurva level ASN, Study Streak, dan 8 Lencana Prestasi belajar.
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Link 
                    to="/student/profile/" 
                    className="btn btn-sm btn-outline-teal rounded-pill px-3 py-1 fw-semibold d-inline-flex align-items-center justify-content-center"
                  >
                    <i className="fas fa-id-card me-2"></i>
                    <span>Buka Profil & Lencana Saya</span>
                  </Link>
                </div>
              </div>

              {/* 6 Level Progression Tier Pills */}
              <div className="mb-3">
                <small className="fw-bold text-muted text-uppercase d-block mb-2" style={{ fontSize: '0.72rem' }}>
                  6 Tingkatan Level Pembelajar ASN (Dikalibrasi Berimbang):
                </small>
                <div className="row g-2">
                  <div className="col-6 col-md-4 col-lg-2">
                    <div className="p-2 rounded-3 bg-white border text-center h-100 shadow-xs">
                      <span className="badge rounded-pill text-white mb-1" style={{ backgroundColor: '#10b981', fontSize: '0.65rem' }}>
                        <i className="fas fa-seedling me-1"></i> Level 1
                      </span>
                      <div className="fw-bold text-dark small" style={{ fontSize: '0.75rem' }}>Aparatur Pratama</div>
                      <small className="text-muted" style={{ fontSize: '0.68rem' }}>0 – 249 XP</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-4 col-lg-2">
                    <div className="p-2 rounded-3 bg-white border text-center h-100 shadow-xs">
                      <span className="badge rounded-pill text-white mb-1" style={{ backgroundColor: '#0ea5e9', fontSize: '0.65rem' }}>
                        <i className="fas fa-shield-halved me-1"></i> Level 2
                      </span>
                      <div className="fw-bold text-dark small" style={{ fontSize: '0.75rem' }}>Aparatur Muda</div>
                      <small className="text-muted" style={{ fontSize: '0.68rem' }}>250 – 599 XP</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-4 col-lg-2">
                    <div className="p-2 rounded-3 bg-white border text-center h-100 shadow-xs">
                      <span className="badge rounded-pill text-white mb-1" style={{ backgroundColor: '#6366f1', fontSize: '0.65rem' }}>
                        <i className="fas fa-gem me-1"></i> Level 3
                      </span>
                      <div className="fw-bold text-dark small" style={{ fontSize: '0.75rem' }}>Aparatur Madya</div>
                      <small className="text-muted" style={{ fontSize: '0.68rem' }}>600 – 1.199 XP</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-4 col-lg-2">
                    <div className="p-2 rounded-3 bg-white border text-center h-100 shadow-xs">
                      <span className="badge rounded-pill text-white mb-1" style={{ backgroundColor: '#8b5cf6', fontSize: '0.65rem' }}>
                        <i className="fas fa-medal me-1"></i> Level 4
                      </span>
                      <div className="fw-bold text-dark small" style={{ fontSize: '0.75rem' }}>Aparatur Utama</div>
                      <small className="text-muted" style={{ fontSize: '0.68rem' }}>1.200 – 2.499 XP</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-4 col-lg-2">
                    <div className="p-2 rounded-3 bg-white border text-center h-100 shadow-xs">
                      <span className="badge rounded-pill text-white mb-1" style={{ backgroundColor: '#f59e0b', fontSize: '0.65rem' }}>
                        <i className="fas fa-crown me-1"></i> Level 5
                      </span>
                      <div className="fw-bold text-dark small" style={{ fontSize: '0.75rem' }}>Ksatria Parlemen</div>
                      <small className="text-muted" style={{ fontSize: '0.68rem' }}>2.500 – 4.499 XP</small>
                    </div>
                  </div>
                  <div className="col-6 col-md-4 col-lg-2">
                    <div className="p-2 rounded-3 bg-white border text-center h-100 shadow-xs">
                      <span className="badge rounded-pill text-white mb-1" style={{ backgroundColor: '#eab308', fontSize: '0.65rem' }}>
                        <i className="fas fa-trophy me-1"></i> Level 6
                      </span>
                      <div className="fw-bold text-dark small" style={{ fontSize: '0.75rem' }}>Pakar Reformasi</div>
                      <small className="text-muted" style={{ fontSize: '0.68rem' }}>4.500+ XP</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* 8 Badges Mention */}
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-2 border-top">
                <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                  <i className="fas fa-certificate text-teal me-1"></i>
                  <strong>8 Lencana Prestasi Manta:</strong> Langkah Perdana • Pembelajar Tangguh • Jawara Evaluasi • Lulusan Kompeten • Ksatria 20 JP • Penjelajah Pengetahuan • Maestro Recall • Multitalenta Parlemen
                </small>
                <button 
                  type="button" 
                  className="btn btn-link btn-sm p-0 text-decoration-none fw-semibold text-teal" 
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => {
                    const prompt = 'Apa saja lencana prestasi yang sudah saya raih?';
                    if (typeof window !== 'undefined') {
                      if (typeof window.openMantaChat === 'function') {
                        window.openMantaChat(prompt);
                      } else {
                        window.dispatchEvent(new CustomEvent('manta_open_chat', { detail: { prompt } }));
                        window.dispatchEvent(new CustomEvent('manta-open-chat', { detail: { prompt, query: prompt } }));
                      }
                    }
                  }}
                >
                  <i className="fas fa-comment-dots me-1"></i> Tanya Manta AI
                </button>
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
