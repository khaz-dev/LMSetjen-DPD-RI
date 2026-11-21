import React, { memo, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import logoSetjenWebP from "../../assets/logo/logo-setjen-dpd.webp";
import logoSetjenPNG from "../../assets/logo/logo-setjen-dpd.png";
import apiInstance from "../../utils/axios";
import "./TermsAndConditions.css";

function TermsAndConditions() {
  const [activeSection, setActiveSection] = useState("penerimaan");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(60);
  const [isScrolled, setIsScrolled] = useState(false);
  const [expandedHeroHeight, setExpandedHeroHeight] = useState(220);
  const heroRef = useRef(null);

  // Measure actual BaseHeader height dynamically
  useEffect(() => {
    const measureHeader = () => {
      const headerEl = document.querySelector('.base-header');
      if (headerEl) {
        setHeaderHeight(headerEl.offsetHeight);
      }
    };
    measureHeader();

    const headerEl = document.querySelector('.base-header');
    let observer = null;
    if (headerEl && window.ResizeObserver) {
      observer = new ResizeObserver(measureHeader);
      observer.observe(headerEl);
    }
    window.addEventListener('resize', measureHeader);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', measureHeader);
    };
  }, []);

  // Observe natural expanded height of hero
  useEffect(() => {
    const updateExpandedHeight = () => {
      if (heroRef.current && !isScrolled) {
        const height = heroRef.current.offsetHeight;
        if (height > 100) {
          setExpandedHeroHeight(height);
        }
      }
    };

    updateExpandedHeight();

    let observer = null;
    if (heroRef.current && window.ResizeObserver) {
      observer = new ResizeObserver(() => {
        if (!isScrolled) {
          updateExpandedHeight();
        }
      });
      observer.observe(heroRef.current);
    }

    window.addEventListener('resize', updateExpandedHeight);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateExpandedHeight);
    };
  }, [isScrolled]);

  // High-precision scroll listener with exact zero-gap threshold calculation
  useEffect(() => {
    const STUCK_HERO_HEIGHT = 56;
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const threshold = Math.max(50, expandedHeroHeight - headerHeight - STUCK_HERO_HEIGHT);
          const shouldBeStuck = window.scrollY >= threshold;
          setIsScrolled((prev) => (prev !== shouldBeStuck ? shouldBeStuck : prev));
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [expandedHeroHeight, headerHeight]);

  // Live Statistics State
  const [stats, setStats] = useState({
    app_version: "1.1.0",
    total_courses: 0,
    total_registered_users: 774,
    total_certificates: 0,
    timestamp: null,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Fetch real-time live statistics from backend
  const fetchLiveStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const response = await apiInstance.get("/statistics/public-stats/");
      if (response && response.data) {
        setStats({
          app_version: response.data.app_version || "1.1.0",
          total_courses: Number(response.data.total_courses) || 0,
          total_registered_users: Number(response.data.total_registered_users) || 774,
          total_certificates: Number(response.data.total_certificates) || 0,
          timestamp: response.data.timestamp || new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn("Gagal memuat statistik live untuk syarat dan ketentuan:", error);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveStats();
  }, [fetchLiveStats]);

  // 11 Sections for TOC and Quick Navigation
  const sections = useMemo(() => [
    { id: "penerimaan", title: "1. Penerimaan Ketentuan", icon: "bi-check2-circle", tag: "Persetujuan" },
    { id: "penggunaan-layanan", title: "2. Penggunaan Layanan", icon: "bi-laptop", tag: "Akses ASN" },
    { id: "akun-pengguna", title: "3. Akun, Kredensial & Poin Belajar", icon: "bi-person-badge", tag: "Akuntabilitas" },
    { id: "konten-kursus", title: "4. Konten, Materi & Asisten AI", icon: "bi-journal-bookmark", tag: "Materi & AI" },
    { id: "sertifikat-digital", title: "5. Sertifikat & Gamifikasi", icon: "bi-patch-check-fill", tag: "Validasi & XP" },
    { id: "pembatasan-tanggung-jawab", title: "6. Batasan Tanggung Jawab", icon: "bi-shield-exclamation", tag: "Operasional" },
    { id: "modifikasi-layanan", title: "7. Modifikasi & Versioning Sistem", icon: "bi-sliders", tag: "Kebijakan" },
    { id: "larangan-kegiatan", title: "8. Larangan Kegiatan & Integritas", icon: "bi-slash-circle-fill", tag: "Integritas" },
    { id: "hak-kekayaan-intelektual", title: "9. Hak Kekayaan Intelektual", icon: "bi-award", tag: "Hak Cipta" },
    { id: "penyelesaian-sengketa", title: "10. Hukum & Penyelesaian", icon: "bi-briefcase-fill", tag: "Yurisdiksi" },
    { id: "kontak-dukungan", title: "11. Kontak & Dukungan BPSDM", icon: "bi-envelope-at-fill", tag: "Bantuan" },
  ], []);

  // Ensure body background is properly tinted for silhouette layer
  useEffect(() => {
    const originalBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#f1f5f9";
    return () => {
      document.body.style.backgroundColor = originalBg;
    };
  }, []);

  // Smooth scroll to section
  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = (headerHeight || 60) + 56 + 16;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  // Scrollspy observer
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + (headerHeight || 60) + 56 + 24;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(sections[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections, headerHeight]);

  // Copy email helper
  const handleCopyEmail = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText("sdm@dpd.go.id").then(() => {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2500);
      });
    }
  };

  // Print helper
  const handlePrint = () => {
    window.print();
  };

  // Search query filter helper
  const q = searchQuery.toLowerCase().trim();
  const isMatch = (text) => !q || text.toLowerCase().includes(q);

  return (
    <div 
      className="terms-policy-wrapper"
      style={{ 
        '--header-height': `${headerHeight}px`,
        '--hero-expanded-height': `${expandedHeroHeight}px`,
        '--stuck-hero-height': '56px'
      }}
    >
      <BaseHeader />

      {/* HERO SLOT ANCHOR PREVENTS LAYOUT SHIFT */}
      <div 
        className={`terms-hero-slot ${isScrolled ? 'is-stuck' : ''}`}
        style={{ 
          '--header-height': `${headerHeight}px`,
          '--hero-expanded-height': `${expandedHeroHeight}px`,
          minHeight: isScrolled ? `${expandedHeroHeight}px` : 'auto'
        }}
      >
        {/* COMPACT HERO HEADER WITH STICKY SCROLL BEHAVIOR */}
        <header ref={heroRef} className={`terms-hero ${isScrolled ? 'is-stuck' : ''}`} role="banner">
          <div className="container">
            <div className="terms-hero-content">
              {/* Breadcrumb & Meta badges */}
              <div className="terms-hero-top">
                <nav aria-label="breadcrumb" className="terms-breadcrumb">
                  <Link to="/" className="breadcrumb-link">
                    <i className="bi bi-house-door-fill me-1" aria-hidden="true"></i> Beranda
                  </Link>
                  <span className="breadcrumb-separator">/</span>
                  <span className="breadcrumb-current">Ketentuan Penggunaan</span>
                </nav>
                <span className="terms-badge">
                  <span className="badge-pulse" aria-hidden="true"></span>
                  <span>Pedoman Tata Tertib & Akuntabilitas ASN • Versi {stats.app_version}</span>
                </span>
              </div>

              {/* Title & Concise Summary */}
              <div className="terms-hero-main">
                <div className="terms-hero-title-area">
                  <div className="terms-hero-icon-bubble" aria-hidden="true">
                    <i className="bi bi-file-earmark-check"></i>
                  </div>
                  <div>
                    <h1 className="terms-hero-title">Ketentuan Penggunaan LMSetjen DPD RI</h1>
                    <p className="terms-hero-subtitle">
                      Peraturan, etika akademik, integritas pemanfaatan asisten AI (Si Manta), gamifikasi, dan standar akuntabilitas pembelajaran digital di lingkungan Sekretariat Jenderal DPD RI.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Bar - High-Contrast Live Stat Pills */}
              <div className="terms-stats-row">
                <div className="stat-pill" title={`Versi ketentuan penggunaan platform v${stats.app_version}`}>
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-calendar-check-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Pembaruan Rilis</span>
                    <strong className="stat-val">
                      {isLoadingStats ? "..." : `v${stats.app_version} (Nov 2026)`}
                    </strong>
                  </div>
                </div>

                <div className="stat-pill" title={`${stats.total_courses} katalog kursus aktif terbit di sistem`}>
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-collection-play-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Katalog Kursus</span>
                    <strong className="stat-val">
                      {isLoadingStats ? "..." : `${stats.total_courses} Kursus Terbit`}
                    </strong>
                  </div>
                </div>

                <div className="stat-pill" title="Landasan hukum tata kelola kepegawaian dan SPBE">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-bank2"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Dasar Hukum</span>
                    <strong className="stat-val">UU ASN, SPBE & LAN RI</strong>
                  </div>
                </div>

                <div className="stat-pill" title={`${stats.total_certificates} sertifikat kelulusan tervalidasi terbit`}>
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-patch-check-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Kredensial Terbit</span>
                    <strong className="stat-val">
                      {isLoadingStats ? "..." : `${stats.total_certificates} Sertifikat`}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* MAIN TWO-COLUMN COMPACT LAYOUT WITH FROSTED VEIL */}
      <main className="terms-main-container">
        <div className="terms-background-pattern" aria-hidden="true"></div>

        <div className="container">
          <div className="row g-4 align-items-start">

            {/* LEFT COLUMN: STICKY TOC, KEY SUMMARY & ACTIONS */}
            <div className="col-lg-4 col-xl-3 terms-sidebar-col">
              <div className="terms-sidebar-sticky">

                {/* Search / Fast Filter */}
                <div 
                  className="terms-search-card"
                  title="Cari kata kunci (Manta AI, Gamifikasi, Sertifikat, NIP, Sanksi, Hak Cipta)..."
                >
                  <label htmlFor="terms-search" className="visually-hidden">Cari topik ketentuan</label>
                  <div className="terms-search-input-wrap">
                    <i className="bi bi-search search-icon" aria-hidden="true"></i>
                    <input
                      id="terms-search"
                      type="text"
                      className="terms-search-input"
                      placeholder="Cari topik (Manta AI, Kuis, Sertifikat)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button 
                        type="button" 
                        className="search-clear-btn" 
                        onClick={() => setSearchQuery("")}
                        aria-label="Bersihkan pencarian"
                      >
                        <i className="bi bi-x-circle-fill" aria-hidden="true"></i>
                      </button>
                    )}
                  </div>
                  <div className="terms-search-tooltip" role="tooltip">
                    <i className="bi bi-info-circle-fill me-1 text-teal"></i>
                    <span>Cari topik: Manta AI, Gamifikasi, Sertifikat, NIP, Larangan, Sanksi</span>
                  </div>
                </div>

                {/* Table of Contents Navigation */}
                <div className="terms-toc-card">
                  <div className="toc-header">
                    <span className="toc-title">
                      <i className="bi bi-list-nested me-2 text-teal" aria-hidden="true"></i>
                      Daftar Ketentuan
                    </span>
                    <span className="toc-count">{sections.length} Poin</span>
                  </div>
                  <nav className="toc-list" aria-label="Navigasi ketentuan penggunaan">
                    {sections.map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        className={`toc-item ${activeSection === sec.id ? "active" : ""}`}
                        onClick={() => scrollToSection(sec.id)}
                        title={sec.title}
                      >
                        <i className={`bi ${sec.icon} toc-icon`} aria-hidden="true"></i>
                        <span className="toc-text">{sec.title}</span>
                        <span className="toc-tag">{sec.tag}</span>
                        <span className="toc-item-tooltip" role="tooltip">
                          <i className={`bi ${sec.icon} me-1 text-teal`} aria-hidden="true"></i>
                          <span>{sec.title}</span>
                        </span>
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Key Conduct Summary Highlights */}
                <div className="terms-summary-card">
                  <div className="summary-card-header">
                    <i className="bi bi-shield-check text-warning me-2" aria-hidden="true"></i>
                    <span>Prinsip Integritas ASN</span>
                  </div>
                  <ul className="summary-list">
                    <li>
                      <i className="bi bi-person-check-fill text-teal" aria-hidden="true"></i>
                      <span>Akun bersifat personal kedinasan dan dilarang dialihkan atau dipinjamkan.</span>
                    </li>
                    <li>
                      <i className="bi bi-robot text-teal" aria-hidden="true"></i>
                      <span>Si Manta (AI) sebagai mitra belajar, bukan alat kecurangan ujian.</span>
                    </li>
                    <li>
                      <i className="bi bi-award-fill text-teal" aria-hidden="true"></i>
                      <span>Sertifikat digital terbit sah atas dasar kelulusan mandiri ber-QR Code.</span>
                    </li>
                    <li>
                      <i className="bi bi-exclamation-triangle-fill text-danger" aria-hidden="true"></i>
                      <span>Kecurangan pengerjaan modul berakibat pembatalan sertifikat dan sanksi.</span>
                    </li>
                  </ul>
                </div>

                {/* Quick Action Buttons */}
                <div className="terms-action-card">
                  <button
                    type="button"
                    className="terms-action-btn btn-copy"
                    onClick={handleCopyEmail}
                    title="Salin email pengelola BPSDM"
                  >
                    <i className={`bi ${copiedEmail ? "bi-check-lg text-success" : "bi-clipboard"} me-2`} aria-hidden="true"></i>
                    {copiedEmail ? "Email Tersalin!" : "Salin Email SDM"}
                  </button>
                  <button
                    type="button"
                    className="terms-action-btn btn-print"
                    onClick={handlePrint}
                    title="Cetak atau simpan sebagai PDF"
                  >
                    <i className="bi bi-printer me-2" aria-hidden="true"></i>
                    Cetak Dokumen
                  </button>
                </div>

                {/* Official Institution Stamp */}
                <div className="terms-authority-card">
                  <div className="authority-emblem-wrap">
                    <picture>
                      <source srcSet={logoSetjenWebP} type="image/webp" />
                      <img 
                        src={logoSetjenPNG} 
                        alt="Logo Setjen DPD RI" 
                        className="authority-emblem" 
                        width="36" 
                        height="36" 
                      />
                    </picture>
                    <div className="authority-meta">
                      <strong className="authority-org">BPSDM Biro OKK</strong>
                      <span className="authority-deputy">Deputi Administrasi Setjen DPD RI</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT COLUMN: DETAILED & COMPACT CONTENT CARDS */}
            <div className="col-lg-8 col-xl-9 terms-content-col">

              {/* SECTION 1: PENERIMAAN KETENTUAN */}
              <article 
                id="penerimaan" 
                className={`policy-card ${!isMatch("penerimaan ketentuan akses setuju terikat aturan versi 1.1.0") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-check2-circle"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 1</span>
                    <h2 className="policy-card-title">Penerimaan Ketentuan</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="lead-paragraph">
                    Dengan mengakses, mendaftar, atau menggunakan platform <strong>LMSetjen DPD RI</strong> (versi {stats.app_version}), Anda menyatakan bahwa Anda telah membaca, memahami, dan menyetujui untuk terikat secara hukum oleh seluruh syarat, ketentuan, etika akademik, serta panduan operasional yang tercantum di dalam dokumen ini.
                  </p>
                  <div className="policy-callout-box">
                    <i className="bi bi-info-circle-fill callout-icon" aria-hidden="true"></i>
                    <p className="callout-text mb-0">
                      Jika Anda tidak menyetujui sebagian atau seluruh ketentuan ini, Anda tidak diperkenankan mengakses atau menggunakan layanan pembelajaran pada sistem ini.
                    </p>
                  </div>
                </div>
              </article>

              {/* SECTION 2: PENGGUNAAN LAYANAN */}
              <article 
                id="penggunaan-layanan" 
                className={`policy-card ${!isMatch("penggunaan layanan pegawai asn bpsdm kompetensi pembelajaran") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-laptop"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 2</span>
                    <h2 className="policy-card-title">Penggunaan Layanan</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="section-intro">
                    Platform LMSetjen DPD RI didedikasikan sebagai infrastruktur pembelajaran digital kedinasan yang dirancang khusus untuk:
                  </p>

                  <div className="scope-grid">
                    <div className="scope-card">
                      <div className="scope-icon-wrap bg-teal-subtle">
                        <i className="bi bi-people-fill text-teal"></i>
                      </div>
                      <div className="scope-content">
                        <strong>Pegawai & Aparatur Berwenang</strong>
                        <span>Seluruh ASN (PNS & PPPK) serta tenaga pendukung di lingkungan Sekretariat Jenderal DPD RI.</span>
                      </div>
                    </div>

                    <div className="scope-card">
                      <div className="scope-icon-wrap bg-indigo-subtle">
                        <i className="bi bi-mortarboard-fill text-primary"></i>
                      </div>
                      <div className="scope-content">
                        <strong>Pengembangan Kompetensi SDM</strong>
                        <span>Pelatihan teknis keparlemenan, kepemimpinan, hukum, tata kelola persidangan, dan literasi digital.</span>
                      </div>
                    </div>

                    <div className="scope-card scope-card-span2">
                      <div className="scope-icon-wrap bg-success-subtle">
                        <i className="bi bi-shield-check text-success"></i>
                      </div>
                      <div className="scope-content">
                        <strong>Aktivitas Sah & Taat Regulasi</strong>
                        <span>Seluruh kegiatan belajar mengajar wajib tunduk pada pedoman LAN RI (pemenuhan 20 JP ASN) dan kode etik kedinasan Setjen DPD RI. Penggunaan untuk tujuan komersial atau di luar dinas dilarang keras.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 3: AKUN PENGGUNA & POIN BELAJAR */}
              <article 
                id="akun-pengguna" 
                className={`policy-card ${!isMatch("akun kredensial sso nip login tanggung jawab sandi poin xp badges") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-person-badge"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 3</span>
                    <h2 className="policy-card-title">Akun Pengguna, Kredensial & Poin Belajar</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="section-intro">
                    Setiap akun pengguna bersifat personal dan merepresentasikan identitas aparatur resmi. Pemilik akun bertanggung jawab penuh atas seluruh aktivitas di dalam akun:
                  </p>

                  <div className="checklist-grid">
                    <div className="checklist-card">
                      <div className="checklist-icon"><i className="bi bi-check2"></i></div>
                      <div className="checklist-content">
                        <strong>Keakuratan Identitas Pegawai</strong>
                        <span>Wajib memastikan NIP, nama lengkap kedinasan, dan data unit kerja telah sinkron dan valid.</span>
                      </div>
                    </div>

                    <div className="checklist-card">
                      <div className="checklist-icon"><i className="bi bi-check2"></i></div>
                      <div className="checklist-content">
                        <strong>Kerahasiaan Kredensial & Token</strong>
                        <span>Dilarang membagikan kata sandi, token autentikasi sesi JWT, atau akun login kepada pihak lain.</span>
                      </div>
                    </div>

                    <div className="checklist-card">
                      <div className="checklist-icon"><i className="bi bi-check2"></i></div>
                      <div className="checklist-content">
                        <strong>Integritas Poin XP & Lencana</strong>
                        <span>Poin pengalaman (XP) dan lencana kompetensi (badges) melekat sah pada pegawai yang menyelesaikan modul secara mandiri.</span>
                      </div>
                    </div>

                    <div className="checklist-card">
                      <div className="checklist-icon"><i className="bi bi-check2"></i></div>
                      <div className="checklist-content">
                        <strong>Etika Diskusi & Kolaborasi</strong>
                        <span>Menjaga etika aparatur negara pada forum Q&A, ruang diskusi kursus, serta umpan balik instruktur.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 4: KONTEN, MATERI DAN ASISTEN AI */}
              <article 
                id="konten-kursus" 
                className={`policy-card ${!isMatch("konten materi kursus hak cipta bpsdm modul video manta ai asisten cerdas") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-journal-bookmark"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 4</span>
                    <h2 className="policy-card-title">Konten Materi & Ketentuan Pemanfaatan Asisten AI (Si Manta)</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Semua materi pelatihan, bahan ajar, video pembelajaran, silabus modul, bank soal kuis, serta algoritma pendamping belajar <strong>Si Manta (Manta AI)</strong> adalah milik eksklusif <strong>BPSDM Biro OKK Setjen DPD RI</strong> atau narasumber kedinasan resmi.
                  </p>

                  <div className="license-box mb-3">
                    <div className="license-badge-col">
                      <i className="bi bi-file-earmark-lock-fill license-icon" aria-hidden="true"></i>
                      <span>Lisensi Internal</span>
                    </div>
                    <div className="license-text-col">
                      <strong>Ketentuan Lisensi Hak Akses Materi:</strong>
                      <p className="mb-0">
                        Anda diberikan izin terbatas, non-eksklusif, dan tidak dapat dipindahtangankan untuk mengakses materi semata-mata demi pembelajaran kedinasan. Dilarang mendistribusikan, mempublikasikan ulang ke publik, atau mengkomersialkannya tanpa izin tertulis Sekretariat Jenderal DPD RI.
                      </p>
                    </div>
                  </div>

                  <div className="policy-callout-box">
                    <i className="bi bi-robot callout-icon text-teal" aria-hidden="true"></i>
                    <div>
                      <strong>Pedoman Penggunaan Asisten AI Si Manta:</strong>
                      <p className="mb-0 mt-1" style={{ fontSize: "0.85rem", color: "#334155" }}>
                        Si Manta dihadirkan untuk mendampingi pemahaman modul, memberikan rangkuman, dan menyajikan latihan kuis adaptif. Pengguna dilarang melakukan rekayasa perintah (*prompt injection*), upaya menembus batasan teknis (*jailbreaking*), atau menyalahgunakan jawaban AI untuk memanipulasi penilaian kompetensi.
                      </p>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 5: SERTIFIKAT DIGITAL & GAMIFIKASI */}
              <article 
                id="sertifikat-digital" 
                className={`policy-card ${!isMatch("sertifikat digital kredensial kelulusan qr code gamifikasi leaderboard rank") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-patch-check-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 5</span>
                    <h2 className="policy-card-title">Sertifikat Digital, Gamifikasi & Papan Peringkat</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="section-intro">
                    Sertifikat kelulusan diterbitkan otomatis setelah peserta menuntaskan syarat kurikulum dengan standar penilaian objektif:
                  </p>

                  <div className="cert-features-row">
                    <div className="cert-feature-card">
                      <i className="bi bi-qr-code cert-feat-icon text-teal" aria-hidden="true"></i>
                      <h4>Verifikasi Kriptografis QR Code</h4>
                      <p>Setiap e-sertifikat dilengkapi kode hash unik yang dapat divalidasi keasliannya secara publik melalui portal verifikasi resmi.</p>
                    </div>

                    <div className="cert-feature-card">
                      <i className="bi bi-trophy cert-feat-icon text-amber" aria-hidden="true"></i>
                      <h4>Integritas Papan Peringkat</h4>
                      <p>Skor mini-game edukasi dan peringkat pada Kursus Rank maupun Global Rank wajib diraih secara jujur tanpa manipulasi teknis.</p>
                    </div>

                    <div className="cert-feature-card">
                      <i className="bi bi-shield-x cert-feat-icon text-danger" aria-hidden="true"></i>
                      <h4>Klausul Pencabutan Kredensial</h4>
                      <p>BPSDM berhak membatalkan sertifikat dan menganulir poin XP jika ditemukan bukti joki pengerjaan atau pelanggaran integritas akademik.</p>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 6: PEMBATASAN TANGGUNG JAWAB */}
              <article 
                id="pembatasan-tanggung-jawab" 
                className={`policy-card ${!isMatch("pembatasan tanggung jawab gangguan koneksi force majeure as is") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-shield-exclamation"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 6</span>
                    <h2 className="policy-card-title">Batasan Tanggung Jawab (Disclaimer)</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Layanan LMSetjen DPD RI disediakan dengan prinsip <em>"as is"</em> (sebagaimana adanya) dan <em>"as available"</em> (sebagaimana tersedia). Kami berkomitmen menjaga ketersediaan tinggi, namun tidak bertanggung jawab atas:
                  </p>

                  <div className="liability-grid">
                    <div className="liability-pill">
                      <i className="bi bi-wifi-off text-muted me-2" aria-hidden="true"></i>
                      <span>Gangguan koneksi internet lokal atau kegagalan perangkat keras pengguna</span>
                    </div>
                    <div className="liability-pill">
                      <i className="bi bi-tools text-muted me-2" aria-hidden="true"></i>
                      <span>Pemeliharaan terjadwal (*maintenance downtime*) yang telah diumumkan sebelumnya</span>
                    </div>
                    <div className="liability-pill">
                      <i className="bi bi-cloud-slash text-muted me-2" aria-hidden="true"></i>
                      <span>Kehilangan draf pengerjaan akibat menutup peramban sebelum sinkronisasi tuntas</span>
                    </div>
                    <div className="liability-pill">
                      <i className="bi bi-lightning-charge text-muted me-2" aria-hidden="true"></i>
                      <span>Kondisi kahar (*force majeure*) bencana alam atau gangguan jaringan nasional</span>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 7: MODIFIKASI & VERSIONING SISTEM */}
              <article 
                id="modifikasi-layanan" 
                className={`policy-card ${!isMatch("modifikasi layanan penghentian pembaruan kurikulum versioning update log") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-sliders"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 7</span>
                    <h2 className="policy-card-title">Modifikasi Layanan, Update Log & Versioning</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    BPSDM Biro OKK Setjen DPD RI berhak memperbarui materi modul, menambah fitur ekosistem baru, merilis pembaruan versi aplikasi, atau merevisi silabus pelatihan secara berkala untuk menjaga relevansi dengan perkembangan regulasi aparatur.
                  </p>
                  <p className="mb-0">
                    Setiap rilis pembaruan sistem dicatat secara transparan melalui konsol <strong>Update Log / Versioning</strong> yang dapat dipantau oleh seluruh aparatur demi menjamin keterbukaan pengembangan teknologi informasi kelembagaan.
                  </p>
                </div>
              </article>

              {/* SECTION 8: LARANGAN KEGIATAN & INTEGRITAS */}
              <article 
                id="larangan-kegiatan" 
                className={`policy-card ${!isMatch("larangan kegiatan bot otomatisasi hacking bypass scraping gamifikasi ai") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-slash-circle-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 8</span>
                    <h2 className="policy-card-title">Larangan Kegiatan Pengguna</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <div className="warning-rule-banner">
                    <i className="bi bi-exclamation-octagon-fill text-danger me-2 fs-5" aria-hidden="true"></i>
                    <strong>Ketentuan Mutlak:</strong> Pelanggaran terhadap larangan berikut dapat berakibat pemblokiran akun dan penindakan disiplin aparatur sipil negara.
                  </div>

                  <div className="prohibited-grid mt-3">
                    <div className="prohibited-card">
                      <div className="prohibited-icon"><i className="bi bi-robot"></i></div>
                      <div className="prohibited-text">
                        <strong>Bot & Otomasi Palsu</strong>
                        <span>Dilarang memakai skrip pemalsu durasi jam pelajaran atau bot otomatisasi video materi.</span>
                      </div>
                    </div>

                    <div className="prohibited-card">
                      <div className="prohibited-icon"><i className="bi bi-controller"></i></div>
                      <div className="prohibited-text">
                        <strong>Manipulasi Gamifikasi</strong>
                        <span>Dilarang merekayasa skor mini-game, eksploitasi celah poin XP, atau perolehan lencana palsu.</span>
                      </div>
                    </div>

                    <div className="prohibited-card">
                      <div className="prohibited-icon"><i className="bi bi-shield-slash-fill"></i></div>
                      <div className="prohibited-text">
                        <strong>Bypass & Serangan Siber</strong>
                        <span>Dilarang melakukan injeksi kode, peretasan database, atau percobaan bypass hak akses admin/instruktur.</span>
                      </div>
                    </div>

                    <div className="prohibited-card">
                      <div className="prohibited-icon"><i className="bi bi-share-fill"></i></div>
                      <div className="prohibited-text">
                        <strong>Praktik Joki Pembelajaran</strong>
                        <span>Dilarang menyerahkan pengerjaan kuis, ujian, atau modul kepada orang lain atas nama diri sendiri.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 9: HAK KEKAYAAN INTELEKTUAL */}
              <article 
                id="hak-kekayaan-intelektual" 
                className={`policy-card ${!isMatch("kekayaan intelektual hak cipta merek logo modul materi") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-award"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 9</span>
                    <h2 className="policy-card-title">Hak Kekayaan Intelektual</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Seluruh elemen visual, identitas grafis, lambang kelembagaan DPD RI, logo LMSetjen DPD RI, maskot dan aset karakter Si Manta, arsitektur kode sumber, modul gamifikasi, serta video materi pembelajaran dilindungi oleh Undang-Undang Hak Cipta No. 28 Tahun 2014 Republik Indonesia.
                  </p>
                  <p className="mb-0">
                    Pengambilan, penggandaan, atau pemanfaatan materi di luar lingkup kedinasan tanpa izin tertulis dari Sekretariat Jenderal DPD RI merupakan tindakan pelanggaran hukum hak cipta.
                  </p>
                </div>
              </article>

              {/* SECTION 10: PENYELESAIAN SENGKETA */}
              <article 
                id="penyelesaian-sengketa" 
                className={`policy-card ${!isMatch("penyelesaian sengketa hukum indonesia musyawarah mediasi biro okk") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-briefcase-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 10</span>
                    <h2 className="policy-card-title">Hukum yang Berlaku & Penyelesaian Sengketa</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Ketentuan Penggunaan ini diatur dan ditafsirkan berdasarkan hukum Negara Kesatuan Republik Indonesia serta peraturan kedinasan Sekretariat Jenderal DPD RI.
                  </p>
                  <div className="dispute-steps-box">
                    <div className="dispute-step">
                      <span className="dispute-step-num">Tahap 1</span>
                      <strong>Musyawarah Internal</strong>
                      <span>Segala perbedaan penafsiran diselesaikan terlebih dahulu melalui musyawarah kedinasan di bawah koordinasi BPSDM Biro OKK.</span>
                    </div>
                    <div className="dispute-step">
                      <span className="dispute-step-num">Tahap 2</span>
                      <strong>Regulasi Disiplin Pegawai</strong>
                      <span>Apabila menyangkut integritas dinas, penegakan sanksi tunduk pada Peraturan Pemerintah tentang Disiplin PNS yang berlaku.</span>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 11: KONTAK & DUKUNGAN */}
              <article 
                id="kontak-dukungan" 
                className={`policy-card ${!isMatch("kontak dukungan bantuan bpsdm email sdm@dpd.go.id biro okk") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-envelope-at-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 11</span>
                    <h2 className="policy-card-title">Kontak & Layanan Dukungan BPSDM</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Jika Anda memiliki pertanyaan seputar syarat dan ketentuan, verifikasi sertifikat diklat, atau ingin menyampaikan kendala teknis sistem, silakan hubungi saluran resmi berikut:
                  </p>

                  <div className="contact-box-grid">
                    <div className="contact-info-block">
                      <div className="contact-icon-bubble">
                        <i className="bi bi-building"></i>
                      </div>
                      <div className="contact-meta">
                        <span className="contact-kicker">Unit Pengelola</span>
                        <strong className="contact-primary-text">Bagian Pengembangan Sumber Daya Manusia (BPSDM)</strong>
                        <span className="contact-secondary-text">Biro OKK | Deputi Administrasi | Sekretariat Jenderal DPD RI</span>
                        <span className="contact-address">Gedung DPD RI, Kompleks Parlemen Senayan, Jakarta Pusat 10270</span>
                      </div>
                    </div>

                    <div className="contact-action-block">
                      <span className="contact-kicker">Surel Resmi BPSDM</span>
                      <div className="email-display-wrap">
                        <a href="mailto:sdm@dpd.go.id" className="email-link">
                          <i className="bi bi-envelope-fill me-2" aria-hidden="true"></i>
                          sdm@dpd.go.id
                        </a>
                        <button
                          type="button"
                          className="btn-quick-copy"
                          onClick={handleCopyEmail}
                          title="Salin email"
                        >
                          <i className={`bi ${copiedEmail ? "bi-check-lg text-success" : "bi-files"}`} aria-hidden="true"></i>
                        </button>
                      </div>
                      <a 
                        href="mailto:sdm@dpd.go.id?subject=Pertanyaan%20Ketentuan%20Penggunaan%20LMSetjen%20DPD%20RI" 
                        className="btn-send-inquiry"
                      >
                        <i className="bi bi-send-fill me-2" aria-hidden="true"></i>
                        Kirim Pertanyaan
                      </a>
                    </div>
                  </div>
                </div>
              </article>

              {/* BOTTOM FAST NAVIGATION / BACK TO TOP */}
              <div className="policy-footer-actions">
                <Link to="/privacy-policy/" className="policy-adjacent-link">
                  <i className="bi bi-shield-check me-2" aria-hidden="true"></i>
                  Baca Kebijakan Privasi Platform
                </Link>
                <button
                  type="button"
                  className="btn-back-to-top"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                >
                  <i className="bi bi-arrow-up-circle-fill me-2" aria-hidden="true"></i>
                  Kembali ke Atas
                </button>
              </div>

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default memo(TermsAndConditions);
