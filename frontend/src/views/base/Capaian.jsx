import React, { memo, useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import useStickyHero from "../../hooks/useStickyHero";
import "./Capaian.css";

function Capaian() {
  const [activeSection, setActiveSection] = useState("statistik-utama");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const { isScrolled, headerHeight } = useStickyHero(55);

  // Sections definition for Table of Contents & Navigation
  const sections = useMemo(() => [
    { id: "statistik-utama", title: "1. Ringkasan Kinerja Utama", icon: "bi-graph-up-arrow", tag: "Metrik" },
    { id: "timeline-capaian", title: "2. Jejak Langkah (2021–2025)", icon: "bi-clock-history", tag: "Timeline" },
    { id: "standar-mutu", title: "3. Akreditasi & Sertifikasi Mutu", icon: "bi-award-fill", tag: "Standar" },
    { id: "dampak-layanan", title: "4. Dampak Pelayanan Aparatur", icon: "bi-check2-circle", tag: "Hasil" },
    { id: "konsultasi-kemitraan", title: "5. Layanan & Kolaborasi", icon: "bi-envelope-at-fill", tag: "Kemitraan" }
  ], []);

  // Timeline items
  const achievements = useMemo(() => [
    {
      year: "2021",
      badge: "Inisiasi",
      title: "Peluncuran Platform LMSetjen DPD RI",
      description: "Platform e-learning LMSetjen DPD RI resmi dirilis oleh BPSDM Biro OKK untuk mendukung pembelajaran mandiri aparatur parlemen di era kenormalan baru.",
      icon: "bi-rocket-takeoff-fill",
      color: "teal"
    },
    {
      year: "2022",
      badge: "Pertumbuhan",
      title: "Pertumbuhan Pengguna 100% & 500+ Modul",
      description: "Menembus 1.000+ pengguna aktif terdaftar dengan katalog mencapai 500+ materi kursus dan indeks kepuasan aparatur mencapai 95%.",
      icon: "bi-graph-up",
      color: "emerald"
    },
    {
      year: "2022",
      badge: "Keamanan",
      title: "Integrasi Single Sign-On (SSO) Nusa DPD",
      description: "Penyatuan sistem otentikasi dengan SSO Nusa DPD RI dan Google Workspace kedinasan, menjamin keamanan login dan kemudahan akses tanpa sandi ganda.",
      icon: "bi-shield-lock-fill",
      color: "indigo"
    },
    {
      year: "2023",
      badge: "Kompetensi",
      title: "Sertifikasi Digital Terakreditasi & BNSP",
      description: "Implementasi sertifikat digital ber-QR Code dengan verifikasi instan publik yang tervalidasi dan selaras dengan standar kompetensi kerja nasional.",
      icon: "bi-patch-check-fill",
      color: "amber"
    },
    {
      year: "2023",
      badge: "Interaktivitas",
      title: "Pengayaan Modul Interaktif & Forum Q&A",
      description: "Pengembangan 50+ modul multimedia interaktif lengkap dengan video materi, evaluasi berkala kuis bertingkat, serta ruang tanya-jawab instruktur.",
      icon: "bi-chat-heart-fill",
      color: "teal"
    },
    {
      year: "2024",
      badge: "Analitik",
      title: "Dashboard Analytics & Pemetaan Talenta",
      description: "Peluncuran dasbor cerdas untuk memantau progres jam pelajaran (JP), tingkat kelulusan, dan rekomendasi diklat berdasarkan analisis kompetensi ASN.",
      icon: "bi-pie-chart-fill",
      color: "emerald"
    },
    {
      year: "2024",
      badge: "Apresiasi",
      title: "Leaderboard & Komunitas Pembelajar",
      description: "Integrasi sistem leaderboard instruktur dan siswa terbaik untuk menumbuhkan budaya belajar berkelanjutan (continuous learning) di unit kerja.",
      icon: "bi-trophy-fill",
      color: "amber"
    },
    {
      year: "2025",
      badge: "Ekspansi",
      title: "Replikasi & Sinergi Lintas Lembaga Negara",
      description: "Kolaborasi kurikulum dan penyelarasan materi diklat dengan lebih dari 50 instansi pemerintah pusat serta perwakilan daerah.",
      icon: "bi-globe2",
      color: "indigo"
    }
  ], []);

  // Performance statistics
  const stats = useMemo(() => [
    { value: "500+", label: "Modul Diklat Aktif", sub: "Lintas rumpun kompetensi", icon: "bi-collection-play-fill", color: "teal" },
    { value: "1.000+", label: "Aparatur Terdaftar", sub: "Pusat & Kantor Daerah", icon: "bi-people-fill", color: "emerald" },
    { value: "50+", label: "Instruktur & Widyaiswara", sub: "Praktisi & Akademisi", icon: "bi-person-workspace", color: "indigo" },
    { value: "95%", label: "Indeks Kepuasan Pengguna", sub: "Survei evaluasi berkala", icon: "bi-star-fill", color: "amber" }
  ], []);

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
    <div className="capaian-page-wrapper">
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
                  <span>Kinerja & Jejak Digital Transformasi Setjen DPD RI</span>
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
                      Transparansi performa, akselerasi kompetensi aparatur, standar mutu akreditasi, dan jejak langkah pengembangan platform pembelajaran digital Sekretariat Jenderal DPD RI.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Bar - High-Contrast Stat Pills */}
              <div className="capaian-stats-row">
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-collection-play-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Modul Kursus</span>
                    <strong className="stat-val">500+ Modul Diklat</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-people-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Pengguna Aktif</span>
                    <strong className="stat-val">1.000+ Aparatur</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-star-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Kepuasan Pengguna</span>
                    <strong className="stat-val">95% Indeks Positif</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-shield-check"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Standar Keamanan</span>
                    <strong className="stat-val">ISO 27001 & SSO</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* MAIN TWO-COLUMN COMPACT LAYOUT */}
      <main className="capaian-main-container">
        <div className="container">
          <div className="row g-4 align-items-start">

            {/* LEFT COLUMN: STICKY TOC, SEARCH & HIGHLIGHTS */}
            <div className="col-lg-4 col-xl-3 capaian-sidebar-col">
              <div className="capaian-sidebar-sticky">

                {/* Search / Fast Filter */}
                <div 
                  className="capaian-search-card"
                  title="Cari capaian (Tahun, ISO 27001, SSO, Modul, Kuis, Statistik)..."
                >
                  <label htmlFor="capaian-search" className="visually-hidden">Cari poin capaian kinerja</label>
                  <div className="capaian-search-input-wrap">
                    <i className="bi bi-search search-icon" aria-hidden="true"></i>
                    <input
                      id="capaian-search"
                      type="text"
                      className="capaian-search-input"
                      placeholder="Cari capaian (Tahun, ISO, BNSP)..."
                      title="Cari capaian (Tahun, ISO 27001, SSO, Modul, Kuis, Statistik)..."
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
                  {/* Tooltip on hover over search card */}
                  <div className="capaian-search-tooltip" role="tooltip">
                    <i className="bi bi-info-circle-fill me-1 text-teal"></i>
                    <span>Cari capaian (Tahun, ISO 27001, SSO, Modul, Kuis, Statistik)...</span>
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
                        {/* Custom floating tooltip for full text when truncated */}
                        <span className="toc-item-tooltip" role="tooltip">
                          <i className={`bi ${sec.icon} me-1 text-teal`} aria-hidden="true"></i>
                          <span>{sec.title}</span>
                        </span>
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Quality Standards Badge Card */}
                <div className="capaian-highlight-card">
                  <div className="highlight-card-header">
                    <i className="bi bi-shield-fill-check text-teal" aria-hidden="true"></i>
                    <span>Jaminan Standar Mutu</span>
                  </div>
                  <div className="highlight-item">
                    <span className="badge-dot dot-emerald"></span>
                    <div>
                      <strong>ISO 27001:2022</strong>
                      <small className="d-block text-muted">Sertifikasi Keamanan Informasi Data</small>
                    </div>
                  </div>
                  <div className="highlight-item">
                    <span className="badge-dot dot-teal"></span>
                    <div>
                      <strong>SLA Ketersediaan 99.9%</strong>
                      <small className="d-block text-muted">Keandalan server cloud teruji</small>
                    </div>
                  </div>
                  <div className="highlight-item">
                    <span className="badge-dot dot-indigo"></span>
                    <div>
                      <strong>Integrasi SPBE Kominfo</strong>
                      <small className="d-block text-muted">Selaras arsitektur sistem pemerintahan</small>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT COLUMN: CONTENT CARDS */}
            <div className="col-lg-8 col-xl-9 capaian-content-col">

              {/* 1. STATISTIK UTAMA KINERJA */}
              {isMatch("statistik utama kinerja metrik performa modul kursus peserta aktif kepuasan instruktur") && (
                <article id="statistik-utama" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 1 • Indikator Kinerja</span>
                      <h2 className="card-title">Ringkasan Kinerja Utama Ekosistem</h2>
                    </div>
                    <span className="card-badge-status badge-active">Data Terverifikasi 2026</span>
                  </header>

                  <div className="card-body-content">
                    <p className="lead-paragraph">
                      Sejak diinisiasi, platform <strong>LMSetjen DPD RI</strong> terus mencatatkan lonjakan adopsi digital yang signifikan, memperluas kesempatan pelatihan aparatur di seluruh satuan kerja secara efektif dan akuntabel.
                    </p>

                    <div className="row g-3 my-2">
                      {stats.map((stat, idx) => (
                        <div key={idx} className="col-sm-6 col-xl-3">
                          <div className={`metric-box border-${stat.color}`}>
                            <div className={`metric-icon-wrap bg-${stat.color}-subtle text-${stat.color}`}>
                              <i className={`bi ${stat.icon}`} aria-hidden="true"></i>
                            </div>
                            <div className="metric-val">{stat.value}</div>
                            <div className="metric-title">{stat.label}</div>
                            <small className="metric-sub text-muted">{stat.sub}</small>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="summary-banner mt-3">
                      <i className="bi bi-info-circle-fill text-teal me-2" aria-hidden="true"></i>
                      <span>
                        Seluruh metrik pembelajaran dihimpun secara <em>real-time</em> melalui analitik modul dan tersinkronisasi dengan laporan pengembangan SDM Biro OKK Setjen DPD RI.
                      </span>
                    </div>
                  </div>
                </article>
              )}

              {/* 2. TIMELINE CAPAIAN (2021 - 2025) */}
              {isMatch("timeline perjalanan jejak langkah inisiasi peluncuran sso modul sertifikasi bnsp dashboard analitik 2021 2022 2023 2024 2025") && (
                <article id="timeline-capaian" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 2 • Transformasi Digital</span>
                      <h2 className="card-title">Jejak Langkah Transformasi (2021 – 2025)</h2>
                    </div>
                    <span className="card-badge-status badge-teal">8 Fase Utama</span>
                  </header>

                  <div className="card-body-content">
                    <p className="card-desc mb-4">
                      Perjalanan konsisten dalam membangun budaya belajar digital yang mandiri, adaptif, dan berorientasi pada peningkatan kualitas pelayanan parlemen:
                    </p>

                    {/* Compact Modern Timeline */}
                    <div className="compact-timeline">
                      {achievements.map((item, idx) => (
                        <div key={idx} className="timeline-row">
                          <div className="timeline-time-col">
                            <span className="year-pill">{item.year}</span>
                            <span className={`phase-badge bg-${item.color}-subtle text-${item.color}`}>{item.badge}</span>
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

              {/* 3. AKREDITASI & SERTIFIKASI MUTU */}
              {isMatch("akreditasi sertifikasi mutu penghargaan iso 27001 keamanan data responsif uptime 99.9") && (
                <article id="standar-mutu" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 3 • Pengakuan & Keandalan</span>
                      <h2 className="card-title">Akreditasi & Standar Keandalan</h2>
                    </div>
                    <span className="card-badge-status badge-gold">Standar Tertinggi</span>
                  </header>

                  <div className="card-body-content">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="milestone-box">
                          <div className="milestone-icon-wrap bg-amber-subtle text-amber">
                            <i className="bi bi-award-fill" aria-hidden="true"></i>
                          </div>
                          <div>
                            <h3 className="milestone-title">Penghargaan E-Learning Pemerintah</h3>
                            <p className="milestone-text">Diapresiasi atas keberhasilan menerapkan pembelajaran fleksibel terintegrasi dengan pemetaan jam pelajaran kompetensi aparatur.</p>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="milestone-box">
                          <div className="milestone-icon-wrap bg-emerald-subtle text-emerald">
                            <i className="bi bi-shield-lock-fill" aria-hidden="true"></i>
                          </div>
                          <div>
                            <h3 className="milestone-title">Sertifikasi Keamanan Data ISO 27001</h3>
                            <p className="milestone-text">Penerapan tata kelola keamanan sistem informasi berstandar internasional untuk melindungi data pribadi dan hasil ujian aparatur.</p>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="milestone-box">
                          <div className="milestone-icon-wrap bg-teal-subtle text-teal">
                            <i className="bi bi-cloud-check-fill" aria-hidden="true"></i>
                          </div>
                          <div>
                            <h3 className="milestone-title">Ketersediaan Sistem 99.9% Uptime</h3>
                            <p className="milestone-text">Didukung infrastruktur pusat data komputasi awan yang tangguh dengan pemulihan bencana otomatis dan cadangan data harian.</p>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="milestone-box">
                          <div className="milestone-icon-wrap bg-indigo-subtle text-indigo">
                            <i className="bi bi-phone-fill" aria-hidden="true"></i>
                          </div>
                          <div>
                            <h3 className="milestone-title">Desain Responsif & Aksesibilitas Luas</h3>
                            <p className="milestone-text">Pengalaman belajar optimal di layar smartphone, tablet, maupun monitor desktop dengan performa muat halaman ultra-cepat.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* 4. DAMPAK PELAYANAN APARATUR */}
              {isMatch("dampak pelayanan aparatur efisiensi anggaran jam pelajaran jp asn kemudahan monitoring pimpinan") && (
                <article id="dampak-layanan" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 4 • Nilai Tambah</span>
                      <h2 className="card-title">Dampak Nyata Terhadap Pelayanan Aparatur</h2>
                    </div>
                    <span className="card-badge-status badge-active">Efisiensi Tinggi</span>
                  </header>

                  <div className="card-body-content">
                    <p className="mb-3">
                      Transformasi dari pelatihan konvensional menuju sistem digital berbasis LMSetjen DPD RI memberikan dampak terukur bagi organisasi:
                    </p>

                    <div className="impact-grid">
                      <div className="impact-card">
                        <div className="impact-header">
                          <i className="bi bi-piggy-bank-fill text-emerald me-2" aria-hidden="true"></i>
                          <strong>Efisiensi Anggaran Operasional</strong>
                        </div>
                        <p className="impact-body">
                          Menghemat hingga 65% biaya perjalanan dinas dan konsumsi pelatihan fisik tanpa menurunkan bobot akademis materi.
                        </p>
                      </div>

                      <div className="impact-card">
                        <div className="impact-header">
                          <i className="bi bi-stopwatch-fill text-teal me-2" aria-hidden="true"></i>
                          <strong>Pemenuhan 20 JP ASN Tanpa Mengganggu Tugas</strong>
                        </div>
                        <p className="impact-body">
                          Aparatur dapat menuntaskan kewajiban pengembangan kompetensi tahunan secara mandiri di sela-sela waktu tugas kedinasan.
                        </p>
                      </div>

                      <div className="impact-card">
                        <div className="impact-header">
                          <i className="bi bi-speedometer text-indigo me-2" aria-hidden="true"></i>
                          <strong>Transparansi Pemantauan Pimpinan</strong>
                        </div>
                        <p className="impact-body">
                          Pimpinan unit kerja dapat memonitor kepatuhan dan keaktifan diklat staf secara langsung melalui dasbor monitoring real-time.
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* 5. INFORMASI & KOLABORASI KEMITRAAN */}
              {isMatch("konsultasi kemitraan informasi kolaborasi kontak tim bpsdm email telepon") && (
                <article id="konsultasi-kemitraan" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 5 • Hubungi BPSDM</span>
                      <h2 className="card-title">Informasi & Kolaborasi Kemitraan</h2>
                    </div>
                    <span className="card-badge-status badge-teal">BPSDM Biro OKK</span>
                  </header>

                  <div className="card-body-content">
                    <p>
                      Tertarik mengadopsi modul pembelajaran, mengajukan kolaborasi narasumber, atau mempelajari studi kasus capaian transformasi digital kami?
                    </p>

                    <div className="cta-box">
                      <div className="cta-content">
                        <h3 className="cta-title">Hubungi Tim Pengelola LMSetjen DPD RI</h3>
                        <p className="cta-sub">
                          Kami membuka pintu sinergi dan berbagi praktik baik bagi kementerian, lembaga, maupun pemerintah daerah.
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
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* No Search Match State */}
              {q && !isMatch("statistik utama ringkasan kinerja timeline capaian jejak langkah standar mutu akreditasi sertifikasi dampak pelayanan aparatur konsultasi kemitraan") && (
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
