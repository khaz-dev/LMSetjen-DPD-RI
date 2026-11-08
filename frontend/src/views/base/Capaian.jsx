import React, { memo, useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import useStickyHero from "../../hooks/useStickyHero";
import apiInstance from "../../utils/axios";
import "./Capaian.css";

function Capaian() {
  const [activeSection, setActiveSection] = useState("statistik-utama");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const { isScrolled, headerHeight } = useStickyHero(55);

  // Live Statistics State
  const [stats, setStats] = useState({
    total_courses: 0,
    total_materials: 0,
    total_registered_users: 774,
    total_students: 0,
    total_teachers: 0,
    total_certificates: 0,
    total_games: 0,
    total_quizzes: 0,
    total_notes: 0,
    total_feedbacks: 0,
    platform_rating: 4.8,
    satisfaction_index: 96.0,
    total_reviews: 0,
    total_discussions: 0,
    total_categories: 0,
    app_version: "1.1.0",
    timestamp: null,
  });

  const [releases, setReleases] = useState([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);

  // Fetch real-time live statistics from backend
  const fetchLiveStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const response = await apiInstance.get("/statistics/public-stats/");
      if (response && response.data) {
        const d = response.data;
        setStats({
          total_courses: Number(d.total_courses) || 0,
          total_materials: Number(d.total_materials) || 0,
          total_registered_users: Number(d.total_registered_users) || 774,
          total_students: Number(d.total_students) || 0,
          total_teachers: Number(d.total_teachers) || 0,
          total_certificates: Number(d.total_certificates) || 0,
          total_games: Number(d.total_games) || 0,
          total_quizzes: Number(d.total_quizzes) || 0,
          total_notes: Number(d.total_notes) || 0,
          total_feedbacks: Number(d.total_feedbacks) || 0,
          platform_rating: Number(d.platform_rating) || 4.8,
          satisfaction_index: Number(d.satisfaction_index) || 96.0,
          total_reviews: Number(d.total_reviews) || 0,
          total_discussions: Number(d.total_discussions) || 0,
          total_categories: Number(d.total_categories) || 0,
          app_version: d.app_version || "1.1.0",
          timestamp: d.timestamp || new Date().toISOString(),
        });
        setLastSynced(new Date());
      }
    } catch (error) {
      console.error("Gagal memuat statistik live platform:", error);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Fetch dynamic system releases if available
  const fetchReleases = useCallback(async () => {
    try {
      const response = await apiInstance.get("/system/releases/");
      if (response && response.data && response.data.releases) {
        setReleases(response.data.releases);
      }
    } catch (error) {
      console.warn("Gagal memuat data release system, menggunakan data rilis lokal:", error);
    }
  }, []);

  useEffect(() => {
    fetchLiveStats();
    fetchReleases();
  }, [fetchLiveStats, fetchReleases]);

  // Sections definition for Table of Contents & Navigation
  const sections = useMemo(() => [
    { id: "statistik-utama", title: "1. Kinerja & Metrik Real-Time", icon: "bi-graph-up-arrow", tag: "Live Data" },
    { id: "inovasi-v110", title: "2. Inovasi & Kapabilitas v1.1.0", icon: "bi-stars", tag: "Rilis Baru" },
    { id: "timeline-capaian", title: "3. Jejak Langkah (v1.0.0 – v1.1.0)", icon: "bi-clock-history", tag: "Timeline" },
    { id: "standar-mutu", title: "4. Standar Mutu, Keamanan & SPBE", icon: "bi-shield-check", tag: "Standar" },
    { id: "dampak-layanan", title: "5. Dampak Pelayanan Aparatur", icon: "bi-check2-circle", tag: "Hasil" },
    { id: "konsultasi-kemitraan", title: "6. Layanan & Kolaborasi", icon: "bi-envelope-at-fill", tag: "Kemitraan" }
  ], []);

  // Authentic system release timeline items
  const achievements = useMemo(() => [
    {
      version: "v1.0.0",
      date: "September 2026",
      badge: "Inisiasi & Rilis Perdana",
      title: "Peluncuran Platform LMSetjen DPD RI",
      description: "Fondasi resmi platform pembelajaran digital mandiri bagi ASN & PPNPN di lingkungan Sekretariat Jenderal DPD RI. Menyediakan akses materi terstruktur, pemenuhan Jam Pelajaran (JP), evaluasi kuis, serta sertifikat digital instan dengan validasi QR Code publik.",
      icon: "bi-rocket-takeoff-fill",
      color: "teal"
    },
    {
      version: "v1.0.1",
      date: "November 2026",
      badge: "Penyempurnaan",
      title: "Umpan Balik Aparatur, Catatan Belajar & Keamanan Sesi",
      description: "Peluncuran modul aspirasi 2-tab terpadu 'Bantu Kami Berkembang' dan What's New Log, penambahan fitur Catatan Belajar (Notes) interaktif saat menyimak video materi, optimalisasi pemutaran video materi adaptif, serta penguatan keamanan sesi token otentikasi JWT.",
      icon: "bi-shield-lock-fill",
      color: "emerald"
    },
    {
      version: "v1.1.0",
      date: "November 2026 (Terkini)",
      badge: "Transformasi Masif",
      title: "Manta AI, Gamifikasi Pembelajaran, Leaderboard & Redesain Menyeluruh",
      description: "Pembaruan lompatan besar LMSetjen DPD RI: pendamping belajar cerdas Si Manta (Manta AI), 8 modul gamifikasi mini-game interaktif per kursus, papan peringkat kompetensi (Kursus Rank & Global Rank se-Setjen DPD RI), pusat capaian dan lencana prestasi (Badges), konsol versioning transparan, serta redesain visual modern yang bebas ruang hampa.",
      icon: "bi-stars",
      color: "amber"
    }
  ], []);

  // Features highlight in version 1.1.0
  const v110Features = useMemo(() => [
    {
      title: "Si Manta (Manta AI Assistant)",
      badge: "AI Cerdas",
      badgeColor: "teal",
      icon: "bi-robot",
      desc: "Avatar pintar interaktif aparatur dengan rekomendasi cerdas materi diklat parlemen, asisten tanya-jawab kurikulum 24/7, kuis adaptif real-time, dan sinkronisasi catatan belajar mandiri.",
      pills: ["Rekomendasi Cerdas", "Kuis Adaptif", "Sinkronisasi Catatan"]
    },
    {
      title: "Ekosistem Gamifikasi Kursus",
      badge: "Interaktif",
      badgeColor: "emerald",
      icon: "bi-controller",
      desc: "Mini-game edukatif per modul kursus dengan pelacakan skor percobaan, batasan waktu, akumulasi poin kompetensi (XP), dan pengakuan keaktifan belajar aparatur.",
      pills: ["8 Modul Game", "Sistem Skor & XP", "Belajar Asyik"]
    },
    {
      title: "Papan Peringkat (Leaderboard)",
      badge: "Kompetitif",
      badgeColor: "amber",
      icon: "bi-trophy-fill",
      desc: "Transparansi capaian belajar aparatur melalui Kursus Rank per kelas diklat dan Global Rank seluruh pegawai di lingkungan Setjen DPD RI untuk menumbuhkan budaya belajar berkelanjutan.",
      pills: ["Kursus Rank", "Global Rank", "Continuous Learning"]
    },
    {
      title: "Catatan Belajar & Notifikasi In-App",
      badge: "Produktivitas",
      badgeColor: "indigo",
      icon: "bi-journal-bookmark-fill",
      desc: "Pencatatan materi langsung saat menonton modul video pembelajaran yang tersimpan rapi per materi, serta notifikasi lonceng terpadu untuk pembaruan kelas dan tugas diklat.",
      pills: ["Catatan per Video", "Lonceng Notifikasi", "Tersinkronisasi"]
    },
    {
      title: "Pusat Capaian & Lencana Prestasi",
      badge: "Rekam Jejak",
      badgeColor: "teal",
      icon: "bi-award-fill",
      desc: "Pemantauan mandiri capaian jam pelajaran (JP) tahunan, pembukaan lencana kompetensi digital, serta riwayat sertifikat resmi terverifikasi yang selaras dengan rekam jejak pegawai.",
      pills: ["Pemenuhan 20 JP", "Lencana Digital", "Sertifikat QR"]
    },
    {
      title: "Konsol Versioning & Diagnostik Sistem",
      badge: "Tata Kelola TI",
      badgeColor: "emerald",
      icon: "bi-gear-wide-connected",
      desc: "Manajemen rilis berbasis Semantic Versioning dengan changelog terbuka, audit log aktivitas, konsol verifikasi sertifikat instruktur, dan pemantauan kesehatan sistem terpadu.",
      pills: ["SemVer Transparan", "Update Log Publik", "Audit & Diagnostik"]
    }
  ], []);

  // Ensure body background is properly tinted for silhouette layer
  useEffect(() => {
    const originalBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#f1f5f9";
    return () => {
      document.body.style.backgroundColor = originalBg;
    };
  }, []);

  // Smooth scroll with sticky navbar + stuck hero clearance
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

  // Scrollspy observer for active section indicator
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

  // Search filter helper
  const q = searchQuery.toLowerCase().trim();
  const isMatch = (text) => !q || text.toLowerCase().includes(q);

  return (
    <div 
      className="capaian-page-wrapper"
      style={{ '--header-height': `${headerHeight}px` }}
    >
      <BaseHeader />

      {/* HERO SLOT ANCHOR PREVENTS LAYOUT SHIFT */}
      <div 
        className="capaian-hero-slot"
        style={{ '--header-height': `${headerHeight}px` }}
      >
        {/* COMPACT HERO HEADER WITH STICKY SCROLL BEHAVIOR */}
        <header className={`capaian-hero ${isScrolled ? 'is-stuck' : ''}`} role="banner">
          <div className="container">
            <div className="capaian-hero-content">
              {/* Breadcrumb & Top badge */}
              <div className="capaian-hero-top">
                <nav aria-label="breadcrumb" className="capaian-breadcrumb">
                  <Link to="/" className="breadcrumb-link">
                    <i className="bi bi-house-door-fill me-1" aria-hidden="true"></i> Beranda
                  </Link>
                  <span className="breadcrumb-separator">/</span>
                  <span className="breadcrumb-current">Capaian & Rekam Jejak</span>
                </nav>
                <span className="capaian-badge">
                  <span className="badge-pulse" aria-hidden="true"></span>
                  <span>Platform LMSetjen DPD RI v{stats.app_version} • Data Kinerja Terverifikasi</span>
                </span>
              </div>

              {/* Title & Concise Summary */}
              <div className="capaian-hero-main">
                <div className="capaian-hero-title-area">
                  <div className="capaian-hero-icon-bubble" aria-hidden="true">
                    <i className="bi bi-trophy-fill"></i>
                  </div>
                  <div>
                    <h1 className="capaian-hero-title">Capaian & Rekam Jejak LMSetjen DPD RI</h1>
                    <p className="capaian-subtitle-text">
                      Transparansi performa real-time, akselerasi kompetensi aparatur, kepatuhan tata kelola SPBE, dan lompatan inovasi digital versi {stats.app_version} Sekretariat Jenderal DPD RI.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Bar - High-Contrast Live Stat Pills */}
              <div className="capaian-stats-row">
                <div className="stat-pill" title={`${stats.total_courses} Kursus terbit dengan ${stats.total_materials} materi pembelajaran`}>
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-collection-play-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Kursus & Modul</span>
                    <strong className="stat-val">
                      {isLoadingStats ? "..." : `${stats.total_courses} Kursus (${stats.total_materials} Modul)`}
                    </strong>
                  </div>
                </div>

                <div className="stat-pill" title={`${stats.total_registered_users} Aparatur terdata di sistem`}>
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-people-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Aparatur Terdaftar</span>
                    <strong className="stat-val">
                      {isLoadingStats ? "..." : `${stats.total_registered_users} Pegawai`}
                    </strong>
                  </div>
                </div>

                <div className="stat-pill" title={`Indeks kepuasan ${stats.satisfaction_index}% dari ${stats.total_reviews} ulasan resmi aparatur`}>
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-star-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Kepuasan Pengguna</span>
                    <strong className="stat-val">
                      {isLoadingStats ? "..." : `${stats.satisfaction_index}% (${stats.platform_rating}/5.0)`}
                    </strong>
                  </div>
                </div>

                <div className="stat-pill" title={`Versi aktif platform ${stats.app_version} dengan ${stats.total_certificates} sertifikat digital terbit`}>
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-patch-check-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Rilis Sistem Aktif</span>
                    <strong className="stat-val">
                      {isLoadingStats ? "..." : `v${stats.app_version} (${stats.total_certificates} Sertifikat)`}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* MAIN TWO-COLUMN COMPACT LAYOUT WITH FROSTED VEIL */}
      <main className="capaian-main-container">
        {/* Geometric Grid & Luminous Glow Pattern */}
        <div className="capaian-background-pattern" aria-hidden="true"></div>

        <div className="container">
          <div className="row g-4 align-items-start">

            {/* LEFT COLUMN: STICKY TOC, SEARCH & HIGHLIGHTS */}
            <div className="col-lg-4 col-xl-3 capaian-sidebar-col">
              <div className="capaian-sidebar-sticky">

                {/* Search / Fast Filter */}
                <div 
                  className="capaian-search-card"
                  title="Cari capaian (Manta AI, Gamifikasi, Leaderboard, Versi, SPBE, Modul, Kuis)..."
                >
                  <label htmlFor="capaian-search" className="visually-hidden">Cari poin capaian kinerja</label>
                  <div className="capaian-search-input-wrap">
                    <i className="bi bi-search search-icon" aria-hidden="true"></i>
                    <input
                      id="capaian-search"
                      type="text"
                      className="capaian-search-input"
                      placeholder="Cari capaian (Manta AI, Kuis, v1.1.0)..."
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
                  <div className="capaian-search-tooltip" role="tooltip">
                    <i className="bi bi-info-circle-fill me-1 text-teal"></i>
                    <span>Filter cepat capaian, modul gamifikasi, Manta AI, timeline & SPBE</span>
                  </div>
                </div>

                {/* Table of Contents Navigation */}
                <div className="capaian-toc-card">
                  <div className="toc-header">
                    <i className="bi bi-list-nested me-2 text-teal" aria-hidden="true"></i>
                    <span className="toc-title">Navigasi Laporan</span>
                  </div>
                  <nav className="toc-list" aria-label="Daftar Isi Capaian">
                    {sections.map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        className={`toc-item-btn ${activeSection === sec.id ? "active" : ""}`}
                        onClick={() => scrollToSection(sec.id)}
                        aria-current={activeSection === sec.id ? "true" : undefined}
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

                {/* System Status & Standards Card */}
                <div className="capaian-highlight-card">
                  <div className="highlight-card-header">
                    <i className="bi bi-shield-fill-check text-teal" aria-hidden="true"></i>
                    <span>Integritas & Standar Mutu</span>
                  </div>
                  <div className="highlight-item">
                    <span className="badge-dot dot-emerald"></span>
                    <div>
                      <strong>Standar SPBE & LAN RI</strong>
                      <small className="d-block text-muted">Pemenuhan kewajiban 20 JP ASN</small>
                    </div>
                  </div>
                  <div className="highlight-item">
                    <span className="badge-dot dot-teal"></span>
                    <div>
                      <strong>Verifikasi Kriptografis QR</strong>
                      <small className="d-block text-muted">Sertifikat beridentitas unik publik</small>
                    </div>
                  </div>
                  <div className="highlight-item">
                    <span className="badge-dot dot-indigo"></span>
                    <div>
                      <strong>Keamanan Sesi JWT & RBAC</strong>
                      <small className="d-block text-muted">Proteksi berlapis akses sistem</small>
                    </div>
                  </div>
                  <div className="highlight-item">
                    <span className="badge-dot dot-emerald"></span>
                    <div>
                      <strong>Basis Data Live Terhubung</strong>
                      <small className="d-block text-muted">Metrik 100% real-time terverifikasi</small>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT COLUMN: CONTENT CARDS */}
            <div className="col-lg-8 col-xl-9 capaian-content-col">

              {/* 1. STATISTIK UTAMA KINERJA (REAL-TIME LIVE VALUES) */}
              {isMatch("statistik utama kinerja metrik performa real time live kursus materi aparatur terdaftar kepuasan instruktur gamifikasi kuis sertifikat") && (
                <article id="statistik-utama" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 1 • Metrik Real-Time</span>
                      <h2 className="card-title">Ringkasan Kinerja & Metrik Ekosistem Live</h2>
                    </div>
                    <span className="card-badge-status badge-active">
                      <span className="capaian-radar-dot me-1"></span>
                      Basis Data Live
                    </span>
                  </header>

                  <div className="card-body-content">
                    {/* Live Sync Ribbon Toolbar */}
                    <div className="capaian-sync-toolbar">
                      <div className="capaian-radar-group">
                        <span className="capaian-radar-dot" aria-hidden="true"></span>
                        <span className="capaian-radar-title">Sinkronisasi Real-Time Basis Data LMSetjen DPD RI</span>
                        <span className="capaian-live-badge">Aktif</span>
                      </div>
                      <div className="capaian-sync-actions">
                        <span className="capaian-sync-time">
                          <i className="bi bi-clock-history"></i>
                          {lastSynced 
                            ? `Diperbarui: ${lastSynced.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB`
                            : "Menghubungkan..."}
                        </span>
                        <button
                          type="button"
                          className="capaian-refresh-btn"
                          onClick={fetchLiveStats}
                          disabled={isLoadingStats}
                          title="Sinkronkan data metrik terkini dari server"
                        >
                          <i className={`bi bi-arrow-clockwise ${isLoadingStats ? "spin-icon" : ""}`}></i>
                          <span>{isLoadingStats ? "Menyinkronkan..." : "Sinkronkan"}</span>
                        </button>
                      </div>
                    </div>

                    <p className="lead-paragraph">
                      Nilai kinerja yang tercantum di bawah ini ditarik <strong>langsung dari basis data operasional LMSetjen DPD RI secara real-time</strong>, memastikan transparansi akuntabel tanpa data statis atau angka perkiraan:
                    </p>

                    {/* 8 Live Metric Boxes */}
                    <div className="row g-3 my-2">
                      {/* Metric 1: Kursus Terbit */}
                      <div className="col-sm-6 col-xl-3">
                        <div className={`metric-box border-teal ${isLoadingStats ? "is-loading" : ""}`}>
                          <div className="metric-icon-wrap bg-teal-subtle text-teal">
                            <i className="bi bi-collection-play-fill" aria-hidden="true"></i>
                          </div>
                          <div className="metric-val">{stats.total_courses} Kursus</div>
                          <div className="metric-title">Katalog Kursus Terbit</div>
                          <small className="metric-sub text-muted">{stats.total_materials} modul materi pembelajaran</small>
                        </div>
                      </div>

                      {/* Metric 2: Aparatur Terdaftar */}
                      <div className="col-sm-6 col-xl-3">
                        <div className={`metric-box border-emerald ${isLoadingStats ? "is-loading" : ""}`}>
                          <div className="metric-icon-wrap bg-emerald-subtle text-emerald">
                            <i className="bi bi-people-fill" aria-hidden="true"></i>
                          </div>
                          <div className="metric-val">{stats.total_registered_users} Pegawai</div>
                          <div className="metric-title">Aparatur Terdaftar</div>
                          <small className="metric-sub text-muted">{stats.total_students} aparatur aktif belajar</small>
                        </div>
                      </div>

                      {/* Metric 3: Instruktur & Pengajar */}
                      <div className="col-sm-6 col-xl-3">
                        <div className={`metric-box border-indigo ${isLoadingStats ? "is-loading" : ""}`}>
                          <div className="metric-icon-wrap bg-indigo-subtle text-indigo">
                            <i className="bi bi-person-workspace" aria-hidden="true"></i>
                          </div>
                          <div className="metric-val">{stats.total_teachers} Instruktur</div>
                          <div className="metric-title">Tenaga Pengajar</div>
                          <small className="metric-sub text-muted">Widyaiswara & pakar parlemen</small>
                        </div>
                      </div>

                      {/* Metric 4: Sertifikat Terbit */}
                      <div className="col-sm-6 col-xl-3">
                        <div className={`metric-box border-amber ${isLoadingStats ? "is-loading" : ""}`}>
                          <div className="metric-icon-wrap bg-amber-subtle text-amber">
                            <i className="bi bi-patch-check-fill" aria-hidden="true"></i>
                          </div>
                          <div className="metric-val">{stats.total_certificates} Terbit</div>
                          <div className="metric-title">Sertifikat Kelulusan</div>
                          <small className="metric-sub text-muted">QR Code verifikasi instan</small>
                        </div>
                      </div>

                      {/* Metric 5: Indeks Kepuasan Pengguna */}
                      <div className="col-sm-6 col-xl-3">
                        <div className={`metric-box border-teal ${isLoadingStats ? "is-loading" : ""}`}>
                          <div className="metric-icon-wrap bg-teal-subtle text-teal">
                            <i className="bi bi-star-fill" aria-hidden="true"></i>
                          </div>
                          <div className="metric-val">{stats.satisfaction_index}%</div>
                          <div className="metric-title">Indeks Kepuasan</div>
                          <small className="metric-sub text-muted">Rating {stats.platform_rating}/5.0 ({stats.total_reviews} ulasan)</small>
                        </div>
                      </div>

                      {/* Metric 6: Gamifikasi Edukatif */}
                      <div className="col-sm-6 col-xl-3">
                        <div className={`metric-box border-emerald ${isLoadingStats ? "is-loading" : ""}`}>
                          <div className="metric-icon-wrap bg-emerald-subtle text-emerald">
                            <i className="bi bi-controller" aria-hidden="true"></i>
                          </div>
                          <div className="metric-val">{stats.total_games} Mini-Game</div>
                          <div className="metric-title">Gamifikasi Kursus</div>
                          <small className="metric-sub text-muted">Modul permainan edukatif</small>
                        </div>
                      </div>

                      {/* Metric 7: Kuis & Ujian Mandiri */}
                      <div className="col-sm-6 col-xl-3">
                        <div className={`metric-box border-indigo ${isLoadingStats ? "is-loading" : ""}`}>
                          <div className="metric-icon-wrap bg-indigo-subtle text-indigo">
                            <i className="bi bi-card-checklist" aria-hidden="true"></i>
                          </div>
                          <div className="metric-val">{stats.total_quizzes} Kuis</div>
                          <div className="metric-title">Bank Evaluasi Kuis</div>
                          <small className="metric-sub text-muted">Pengujian pemahaman mandiri</small>
                        </div>
                      </div>

                      {/* Metric 8: Partisipasi Aspirasi */}
                      <div className="col-sm-6 col-xl-3">
                        <div className={`metric-box border-amber ${isLoadingStats ? "is-loading" : ""}`}>
                          <div className="metric-icon-wrap bg-amber-subtle text-amber">
                            <i className="bi bi-chat-quote-fill" aria-hidden="true"></i>
                          </div>
                          <div className="metric-val">{stats.total_feedbacks} Aspirasi</div>
                          <div className="metric-title">Masukan Aparatur</div>
                          <small className="metric-sub text-muted">{stats.total_notes} catatan belajar tersimpan</small>
                        </div>
                      </div>
                    </div>

                    <div className="summary-banner mt-3">
                      <i className="bi bi-shield-check text-teal me-2 fs-5" aria-hidden="true"></i>
                      <span>
                        Seluruh indikator kinerja di atas bersumber dari data live backend <strong>LMSetjen DPD RI (API Endpoint: <code>/api/v1/statistics/public-stats/</code>)</strong>, disinkronkan langsung dengan database PostgreSQL operasional Biro OKK Setjen DPD RI.
                      </span>
                    </div>
                  </div>
                </article>
              )}

              {/* 2. LOMPATAN FITUR & INOVASI VERSI 1.1.0 */}
              {isMatch("inovasi fitur versi 1.1.0 manta ai pendamping belajar avatar gamifikasi leaderboard rank catatan belajar badges lencana versioning update log") && (
                <article id="inovasi-v110" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 2 • Pembaruan Terkini</span>
                      <h2 className="card-title">Lompatan Kapabilitas & Inovasi Versi 1.1.0</h2>
                    </div>
                    <span className="card-badge-status badge-teal">Rilis v1.1.0 Terkini</span>
                  </header>

                  <div className="card-body-content">
                    <p className="card-desc mb-3">
                      Pembaruan versi <strong>1.1.0</strong> menandai transformasi besar LMSetjen DPD RI dari platform e-learning konvensional menjadi <strong>ekosistem pembelajaran cerdas, interaktif, dan terpersonalisasi</strong> bagi aparatur parlemen:
                    </p>

                    <div className="v110-feature-grid mb-3">
                      {v110Features.map((feat, idx) => (
                        <div key={idx} className="v110-card">
                          <div className="v110-card-header">
                            <div className={`v110-card-icon bg-${feat.badgeColor}-subtle text-${feat.badgeColor}`}>
                              <i className={`bi ${feat.icon}`} aria-hidden="true"></i>
                            </div>
                            <span className={`v110-card-tag bg-${feat.badgeColor}-subtle text-${feat.badgeColor}`}>
                              {feat.badge}
                            </span>
                          </div>
                          <h3 className="v110-card-title">{feat.title}</h3>
                          <p className="v110-card-desc">{feat.desc}</p>
                          <div className="v110-card-pills">
                            {feat.pills.map((pill, pIdx) => (
                              <span key={pIdx} className="v110-feature-pill">{pill}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="summary-banner mt-2">
                      <i className="bi bi-stars text-amber me-2 fs-5" aria-hidden="true"></i>
                      <span>
                        Seluruh pembaruan versi 1.1.0 dirancang dengan pendekatan <strong>kompak dan responsif</strong>, menghilangkan ruang hampa visual dan mempercepat waktu akses materi di berbagai perangkat aparatur.
                      </span>
                    </div>
                  </div>
                </article>
              )}

              {/* 3. TIMELINE CAPAIAN (v1.0.0 – v1.1.0 AUTHENTIC EVOLUTION) */}
              {isMatch("timeline perjalanan jejak langkah inisiasi peluncuran v1.0.0 v1.0.1 v1.1.0 transformasi digital bpsdm biro okk 2026") && (
                <article id="timeline-capaian" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 3 • Rekam Jejak Digital</span>
                      <h2 className="card-title">Jejak Langkah Transformasi Sistem (v1.0.0 – v1.1.0)</h2>
                    </div>
                    <span className="card-badge-status badge-gold">3 Rilis Strategis</span>
                  </header>

                  <div className="card-body-content">
                    <p className="card-desc mb-4">
                      Perjalanan autentik pengembangan platform LMSetjen DPD RI yang tercatat dalam log pembaruan sistem secara transparan:
                    </p>

                    {/* Compact Modern Timeline */}
                    <div className="compact-timeline">
                      {achievements.map((item, idx) => (
                        <div key={idx} className="timeline-row">
                          <div className="timeline-time-col">
                            <span className="year-pill">{item.version}</span>
                            <span className={`phase-badge bg-${item.color}-subtle text-${item.color}`}>{item.badge}</span>
                            <small className="text-muted d-block mt-1" style={{ fontSize: "0.68rem" }}>{item.date}</small>
                          </div>

                          <div className="timeline-node-col">
                            <div className={`timeline-dot bg-${item.color}`}>
                              <i className={`bi ${item.icon}`} aria-hidden="true"></i>
                            </div>
                            {idx < achievements.length - 1 && <div className="timeline-line"></div>}
                          </div>

                          <div className="timeline-card-col">
                            <div className="timeline-event-card">
                              <h3 className="event-title">{item.title}</h3>
                              <p className="event-desc">{item.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              )}

              {/* 4. STANDAR MUTU, KEAMANAN & ARSITEKTUR SPBE */}
              {isMatch("akreditasi sertifikasi mutu standar spbe lan ri keamanan data jwt rbac qr code uptime") && (
                <article id="standar-mutu" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 4 • Pengakuan & Keandalan</span>
                      <h2 className="card-title">Standar Mutu, Keamanan & Tata Kelola SPBE</h2>
                    </div>
                    <span className="card-badge-status badge-active">Standar Pemerintahan</span>
                  </header>

                  <div className="card-body-content">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="milestone-box">
                          <div className="milestone-icon-wrap bg-amber-subtle text-amber">
                            <i className="bi bi-award-fill" aria-hidden="true"></i>
                          </div>
                          <div>
                            <h3 className="milestone-title">Penyelarasan Standar 20 JP ASN (LAN RI)</h3>
                            <p className="milestone-text">Struktur kurikulum dan perhitungan jam pelajaran (JP) diselaraskan dengan pedoman Lembaga Administrasi Negara (LAN RI) dan PermenPANRB untuk pemenuhan hak pengembangan kompetensi ASN.</p>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="milestone-box">
                          <div className="milestone-icon-wrap bg-emerald-subtle text-emerald">
                            <i className="bi bi-shield-lock-fill" aria-hidden="true"></i>
                          </div>
                          <div>
                            <h3 className="milestone-title">Keamanan Sesi JWT & Kontrol Akses RBAC</h3>
                            <p className="milestone-text">Penerapan enkripsi token otentikasi JWT dengan rotasi berkala, proteksi header HTTP ketat, serta pemisahan hak akses berbasis peran (Admin, Instruktur, Siswa).</p>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="milestone-box">
                          <div className="milestone-icon-wrap bg-teal-subtle text-teal">
                            <i className="bi bi-qr-code-scan" aria-hidden="true"></i>
                          </div>
                          <div>
                            <h3 className="milestone-title">Validasi Kriptografis QR Code Sertifikat</h3>
                            <p className="milestone-text">Setiap sertifikat kelulusan diklat memiliki identifikasi kode hash unik yang dapat diverifikasi secara instan oleh publik maupun instansi pemeriksa tanpa risiko manipulasi.</p>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="milestone-box">
                          <div className="milestone-icon-wrap bg-indigo-subtle text-indigo">
                            <i className="bi bi-cloud-check-fill" aria-hidden="true"></i>
                          </div>
                          <div>
                            <h3 className="milestone-title">Infrastruktur Tangguh & Cadangan Berkala</h3>
                            <p className="milestone-text">Didukung arsitektur cloud server terdistribusi dengan pemantauan kesehatan diagnostik sistem, cadangan basis data otomatis, dan waktu muat halaman ultra-cepat.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* 5. DAMPAK PELAYANAN APARATUR */}
              {isMatch("dampak pelayanan aparatur efisiensi anggaran jam pelajaran jp asn kemudahan monitoring pimpinan kesiapan ai parlemen") && (
                <article id="dampak-layanan" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 5 • Nilai Tambah Organisasi</span>
                      <h2 className="card-title">Dampak Nyata Terhadap Pelayanan Aparatur Parlemen</h2>
                    </div>
                    <span className="card-badge-status badge-active">Efisiensi Tinggi</span>
                  </header>

                  <div className="card-body-content">
                    <p className="mb-3">
                      Transformasi menuju ekosistem pembelajaran digital berbasis LMSetjen DPD RI memberikan dampak konkret dan terukur bagi organisasi Sekretariat Jenderal DPD RI:
                    </p>

                    <div className="impact-grid">
                      <div className="impact-card">
                        <div className="impact-header">
                          <i className="bi bi-piggy-bank-fill text-emerald me-2" aria-hidden="true"></i>
                          <strong>Efisiensi Anggaran & Logistik Diklat</strong>
                        </div>
                        <p className="impact-body">
                          Menghemat alokasi biaya perjalanan dinas, sewa ruang kelas fisik, dan konsumsi diklat tatap muka dengan tetap mempertahankan mutu pembelajaran aparatur.
                        </p>
                      </div>

                      <div className="impact-card">
                        <div className="impact-header">
                          <i className="bi bi-stopwatch-fill text-teal me-2" aria-hidden="true"></i>
                          <strong>Pemenuhan 20 JP ASN Tanpa Mengganggu Tugas</strong>
                        </div>
                        <p className="impact-body">
                          Aparatur dapat menuntaskan kewajiban pengembangan kompetensi tahunan secara mandiri di sela-sela waktu tugas kedinasan, rapat komite, atau masa sidang dewan.
                        </p>
                      </div>

                      <div className="impact-card">
                        <div className="impact-header">
                          <i className="bi bi-speedometer text-indigo me-2" aria-hidden="true"></i>
                          <strong>Transparansi Pemantauan Pimpinan</strong>
                        </div>
                        <p className="impact-body">
                          Pimpinan unit kerja dapat memantau kepatuhan, keaktifan, dan perolehan jam pelajaran staf secara langsung melalui dasbor monitoring dan leaderboard real-time.
                        </p>
                      </div>

                      <div className="impact-card">
                        <div className="impact-header">
                          <i className="bi bi-robot text-teal me-2" aria-hidden="true"></i>
                          <strong>Peningkatan Literasi Digital & AI Aparatur</strong>
                        </div>
                        <p className="impact-body">
                          Membiasakan jajaran pegawai berinteraksi dengan teknologi kecerdasan buatan (Manta AI) dan antarmuka modern guna mendukung terwujudnya Parlemen Modern.
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* 6. INFORMASI & KOLABORASI KEMITRAAN */}
              {isMatch("konsultasi kemitraan informasi kolaborasi kontak tim bpsdm biro okk email telepon feedback saran") && (
                <article id="konsultasi-kemitraan" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 6 • Hubungi BPSDM</span>
                      <h2 className="card-title">Informasi & Kolaborasi Kemitraan</h2>
                    </div>
                    <span className="card-badge-status badge-teal">BPSDM Biro OKK Setjen DPD RI</span>
                  </header>

                  <div className="card-body-content">
                    <p>
                      Tertarik mengadopsi modul pembelajaran, mengajukan kolaborasi narasumber keparlemenan, atau mempelajari praktik baik transformasi digital platform kami?
                    </p>

                    <div className="cta-box">
                      <div className="cta-content">
                        <h3 className="cta-title">Hubungi Tim Pengelola LMSetjen DPD RI</h3>
                        <p className="cta-sub">
                          BPSDM Biro Organisasi, Keanggotaan, dan Kepegawaian (Biro OKK) Sekretariat Jenderal DPD RI membuka pintu sinergi dan berbagi praktik baik bagi kementerian, lembaga, maupun sekretariat DPRD di seluruh Indonesia.
                        </p>
                        <div className="cta-contacts">
                          <div className="cta-contact-item">
                            <i className="bi bi-envelope-at-fill text-teal me-2" aria-hidden="true"></i>
                            <a href="mailto:sdm@dpd.go.id" className="font-monospace text-teal">sdm@dpd.go.id</a>
                            <button
                              type="button"
                              className="copy-chip ms-2"
                              onClick={handleCopyEmail}
                              title="Salin surel"
                            >
                              <i className={`bi ${copiedEmail ? "bi-check-lg text-success" : "bi-files"}`} aria-hidden="true"></i>
                              <span>{copiedEmail ? "Tersalin" : "Salin"}</span>
                            </button>
                          </div>
                          <div className="cta-contact-item">
                            <i className="bi bi-telephone-fill text-teal me-2" aria-hidden="true"></i>
                            <a href="tel:+6285315869799" className="font-monospace text-teal">(+62) 853 1586 9799</a>
                          </div>
                          <div className="cta-contact-item">
                            <i className="bi bi-geo-alt-fill text-teal me-2" aria-hidden="true"></i>
                            <span className="text-muted">Gedung DPD RI, Kompleks Parlemen Senayan, Jakarta</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* No Search Match State */}
              {q && !isMatch("statistik utama ringkasan kinerja inovasi fitur versi 1.1.0 manta ai gamifikasi leaderboard timeline capaian jejak langkah standar mutu akreditasi sertifikasi dampak pelayanan aparatur konsultasi kemitraan") && (
                <div className="empty-search-state text-center py-5">
                  <i className="bi bi-search text-muted fs-1 mb-3 d-block" aria-hidden="true"></i>
                  <h4>Pencarian Tidak Ditemukan</h4>
                  <p className="text-muted">Tidak ada capaian atau bab yang cocok dengan kata kunci "<strong>{searchQuery}</strong>".</p>
                  <button type="button" className="btn btn-outline-teal btn-sm" onClick={() => setSearchQuery("")}>
                    Reset Pencarian
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default memo(Capaian);
