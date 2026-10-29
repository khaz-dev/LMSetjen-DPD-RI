import React, { memo, useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import useStickyHero from "../../hooks/useStickyHero";
import "./Tentang.css";

function Tentang() {
  const [activeSection, setActiveSection] = useState("apa-itu-lms");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const { isScrolled, headerHeight } = useStickyHero(55);

  // Sections definition for Table of Contents & Navigation
  const sections = useMemo(() => [
    { id: "apa-itu-lms", title: "1. Apa itu LMSetjen DPD RI?", icon: "bi-info-circle-fill", tag: "Ikhtisar" },
    { id: "visi-misi", title: "2. Visi & Misi Strategis", icon: "bi-bullseye", tag: "Landasan" },
    { id: "nilai-budaya", title: "3. Nilai Budaya BerAKHLAK", icon: "bi-gem", tag: "Integritas" },
    { id: "fitur-utama", title: "4. Fitur Ekosistem Unggulan", icon: "bi-grid-1x2-fill", tag: "Teknologi" },
    { id: "pengembang", title: "5. Pengembang & Regulasi", icon: "bi-building-check", tag: "Kelembagaan" },
    { id: "kontak-layanan", title: "6. Saluran Bantuan BPSDM", icon: "bi-headset", tag: "Dukungan" }
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
    <div className="tentang-page-wrapper">
      <BaseHeader />

      {/* HERO SLOT ANCHOR PREVENTS LAYOUT SHIFT */}
      <div 
        className="tentang-hero-slot"
        style={{ '--header-height': `${headerHeight}px` }}
      >
        {/* COMPACT HERO HEADER WITH STICKY SCROLL BEHAVIOR */}
        <header className={`tentang-hero ${isScrolled ? 'is-stuck' : ''}`} role="banner">
          <div className="container">
            <div className="tentang-hero-content">
              {/* Breadcrumb & Top badge */}
              <div className="tentang-hero-top">
                <nav aria-label="breadcrumb" className="tentang-breadcrumb">
                  <Link to="/" className="breadcrumb-link">
                    <i className="bi bi-house-door-fill me-1" aria-hidden="true"></i> Beranda
                  </Link>
                  <span className="breadcrumb-separator">/</span>
                  <span className="breadcrumb-current">Tentang Platform</span>
                </nav>
                <span className="tentang-badge">
                  <span className="badge-pulse" aria-hidden="true"></span>
                  <span>Profil & Landasan Resmi LMSetjen DPD RI</span>
                </span>
              </div>

              {/* Title & Concise Summary */}
              <div className="tentang-hero-main">
                <div className="tentang-hero-title-area">
                  <div className="tentang-hero-icon-bubble" aria-hidden="true">
                    <i className="fas fa-landmark"></i>
                  </div>
                  <div>
                    <h1 className="tentang-hero-title">Tentang LMSetjen DPD RI</h1>
                    <p className="tentang-subtitle-text">
                      Platform pembelajaran digital resmi Bagian Pengembangan Sumber Daya Manusia (BPSDM) Sekretariat Jenderal DPD RI untuk mengakselerasi kompetensi dan profesionalisme aparatur sipil.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Bar - High-Contrast Stat Pills */}
              <div className="tentang-stats-row">
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-journal-bookmark-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Katalog Diklat</span>
                    <strong className="stat-val">500+ Kursus Aktif</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-people-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Peserta Terdaftar</span>
                    <strong className="stat-val">1.000+ Pegawai</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-person-workspace"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Tenaga Pengajar</span>
                    <strong className="stat-val">50+ Instruktur Ahli</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-shield-check"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Akreditasi Mutu</span>
                    <strong className="stat-val">Standar BPSDM DPD RI</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* MAIN TWO-COLUMN COMPACT LAYOUT WITH FROSTED VEIL */}
      <main className="tentang-main-container">
        {/* Geometric Grid & Luminous Glow Pattern matching About section */}
        <div className="tentang-background-pattern" aria-hidden="true"></div>

        <div className="container">
          <div className="row g-4 align-items-start">

            {/* LEFT COLUMN: STICKY TOC, SEARCH & CONTACT */}
            <div className="col-lg-4 col-xl-3 tentang-sidebar-col">
              <div className="tentang-sidebar-sticky">

                {/* Search / Fast Filter */}
                <div 
                  className="tentang-search-card"
                  title="Cari kata kunci (Visi, Misi, BPSDM, Kursus, Fitur, Kontak)..."
                >
                  <label htmlFor="tentang-search" className="visually-hidden">Cari poin informasi tentang platform</label>
                  <div className="tentang-search-input-wrap">
                    <i className="bi bi-search search-icon" aria-hidden="true"></i>
                    <input
                      id="tentang-search"
                      type="text"
                      className="tentang-search-input"
                      placeholder="Cari info (Visi, Fitur, BPSDM)..."
                      title="Cari kata kunci (Visi, Misi, BPSDM, Kursus, Fitur, Kontak)..."
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
                  <div className="tentang-search-tooltip" role="tooltip">
                    <i className="bi bi-info-circle-fill me-1 text-teal"></i>
                    <span>Cari kata kunci (Visi, Misi, BPSDM, Kursus, Fitur, Kontak)...</span>
                  </div>
                </div>

                {/* Table of Contents Navigation */}
                <div className="tentang-toc-card">
                  <div className="toc-header">
                    <i className="bi bi-list-nested me-2 text-teal" aria-hidden="true"></i>
                    <span className="toc-title">Navigasi Bab</span>
                  </div>
                  <nav className="toc-list" aria-label="Daftar Isi Tentang">
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

                {/* Fast Contact Card */}
                <div className="tentang-contact-card">
                  <div className="contact-card-header">
                    <i className="bi bi-building-check text-teal" aria-hidden="true"></i>
                    <span>Pengelola Resmi</span>
                  </div>
                  <p className="contact-card-sub">
                    Bagian Pengembangan SDM (BPSDM) Biro OKK Setjen DPD RI
                  </p>
                  <div className="contact-card-item">
                    <span className="item-label">Surel Resmi:</span>
                    <div className="item-action">
                      <a href="mailto:sdm@dpd.go.id" className="item-val">sdm@dpd.go.id</a>
                      <button 
                        type="button" 
                        className="copy-chip" 
                        onClick={handleCopyEmail}
                        title="Salin email"
                      >
                        <i className={`bi ${copiedEmail ? "bi-check-lg text-success" : "bi-files"}`} aria-hidden="true"></i>
                        <span>{copiedEmail ? "Disalin" : "Salin"}</span>
                      </button>
                    </div>
                  </div>
                  <div className="contact-card-item">
                    <span className="item-label">Lokasi Kantor:</span>
                    <span className="item-val-text">Gedung B Lt. 4, Kompleks Parlemen Senayan, Jakarta Pusat 10270</span>
                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT COLUMN: CONTENT CARDS */}
            <div className="col-lg-8 col-xl-9 tentang-content-col">

              {/* 1. APA ITU LMSETJEN DPD RI */}
              {isMatch("apa itu lmsetjen dpd ri bpsdm platform elearning latar belakang") && (
                <article id="apa-itu-lms" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 1 • Ikhtisar Platform</span>
                      <h2 className="card-title">Apa itu LMSetjen DPD RI?</h2>
                    </div>
                    <span className="card-badge-status badge-active">Resmi BPSDM</span>
                  </header>

                  <div className="card-body-content">
                    <p className="lead-paragraph">
                      <strong>LMSetjen DPD RI</strong> adalah ekosistem <em>Learning Management System</em> (LMS) modern yang dikembangkan secara terpadu oleh Bagian Pengembangan Sumber Daya Manusia (BPSDM) Sekretariat Jenderal DPD RI. Platform ini dirancang sebagai pilar transformasi digital pelatihan aparatur sipil negara di lingkungan parlemen DPD RI.
                    </p>
                    <div className="row g-3 my-2">
                      <div className="col-md-6">
                        <div className="highlight-feature-card">
                          <div className="feature-icon-box bg-teal-subtle text-teal">
                            <i className="bi bi-laptop-fill" aria-hidden="true"></i>
                          </div>
                          <div>
                            <h3 className="feature-title">Fleksibilitas Belajar Mandiri</h3>
                            <p className="feature-desc">Materi pelatihan dapat diakses kapan saja (24/7) melalui desktop maupun perangkat mobile dengan penyesuaian ritme belajar masing-masing aparatur.</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="highlight-feature-card">
                          <div className="feature-icon-box bg-emerald-subtle text-emerald">
                            <i className="bi bi-mortarboard-fill" aria-hidden="true"></i>
                          </div>
                          <div>
                            <h3 className="feature-title">Terintegrasi Kepegawaian</h3>
                            <p className="feature-desc">Setiap penyelesaian kursus dan perolehan e-sertifikat langsung tervalidasi serta siap diakui sebagai jam pelajaran pengembangan kompetensi ASN.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3">
                      Dengan mengadopsi standar teknologi web modern berbasis Single Sign-On (SSO), enkripsi TLS 1.3, dan modul interaktif, platform ini meniadakan hambatan geografis bagi aparatur di Kantor Daerah DPD RI di seluruh Indonesia.
                    </p>
                  </div>
                </article>
              )}

              {/* 2. VISI & MISI STRATEGIS */}
              {isMatch("visi misi tujuan strategis arah kebijakan bpsdm berkualitas kompeten") && (
                <article id="visi-misi" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 2 • Arah Strategis</span>
                      <h2 className="card-title">Visi & Misi Strategis</h2>
                    </div>
                    <span className="card-badge-status badge-teal">Komitmen 2024–2029</span>
                  </header>

                  <div className="card-body-content">
                    {/* Vision Banner */}
                    <div className="vision-banner mb-4">
                      <div className="vision-icon-box" aria-hidden="true">
                        <i className="bi bi-compass-fill"></i>
                      </div>
                      <div>
                        <span className="vision-label">Visi Organisasi</span>
                        <blockquote className="vision-quote">
                          "Menjadi platform pembelajaran digital terdepan dalam mendukung pengembangan SDM yang unggul, berintegritas, adaptif, dan berstandar profesional di lingkungan Sekretariat Jenderal DPD RI."
                        </blockquote>
                      </div>
                    </div>

                    {/* Mission List */}
                    <h3 className="sub-heading mb-3">Misi Pelaksanaan:</h3>
                    <div className="mission-grid">
                      <div className="mission-card">
                        <div className="mission-num">01</div>
                        <div className="mission-detail">
                          <strong>Akses Terbuka & Merata</strong>
                          <p>Menyediakan akses modul diklat berkualitas tinggi yang merata bagi aparatur pusat maupun kantor daerah.</p>
                        </div>
                      </div>
                      <div className="mission-card">
                        <div className="mission-num">02</div>
                        <div className="mission-detail">
                          <strong>Standarisasi Nasional & Global</strong>
                          <p>Mengadopsi kurikulum pembelajaran berbasis kompetensi jabatan yang selaras dengan standar LAN dan BKN.</p>
                        </div>
                      </div>
                      <div className="mission-card">
                        <div className="mission-num">03</div>
                        <div className="mission-detail">
                          <strong>Efisiensi Anggaran & Waktu</strong>
                          <p>Mereduksi biaya operasional pelatihan tatap muka konvensional tanpa mengurangi bobot pemahaman substansi.</p>
                        </div>
                      </div>
                      <div className="mission-card">
                        <div className="mission-num">04</div>
                        <div className="mission-detail">
                          <strong>Kolaborasi & Pengetahuan Terbuka</strong>
                          <p>Memfasilitasi forum tanya-jawab, bedah materi, dan pertukaran gagasan ilmiah antar sesama aparatur dan narasumber ahli.</p>
                        </div>
                      </div>
                      <div className="mission-card">
                        <div className="mission-num">05</div>
                        <div className="mission-detail">
                          <strong>Evaluasi Kinerja Terukur</strong>
                          <p>Menyajikan analitik capaian belajar yang akurat guna mendukung pemetaan talenta dan jenjang karier pegawai.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* 3. NILAI BUDAYA BERAKHLAK */}
              {isMatch("nilai budaya kerja berakhlak integritas asn aparatur berorientasi akuntabel kompeten harmonis loyal adaptif kolaboratif") && (
                <article id="nilai-budaya" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 3 • Budaya Kerja</span>
                      <h2 className="card-title">Nilai Budaya Kerja Core Values ASN (BerAKHLAK)</h2>
                    </div>
                    <span className="card-badge-status badge-gold">Prinsip Etika</span>
                  </header>

                  <div className="card-body-content">
                    <p className="card-desc mb-3">
                      Seluruh proses pembelajaran dan interaksi di dalam platform LMSetjen DPD RI berpedoman pada Core Values Aparatur Sipil Negara:
                    </p>
                    <div className="berakhlak-grid">
                      <div className="berakhlak-item">
                        <span className="letter-badge">Ber</span>
                        <div className="ber-info">
                          <strong>Berorientasi Pelayanan</strong>
                          <p>Berkomitmen memberikan kemudahan belajar prima demi kepuasan aparatur.</p>
                        </div>
                      </div>
                      <div className="berakhlak-item">
                        <span className="letter-badge">A</span>
                        <div className="ber-info">
                          <strong>Akuntabel</strong>
                          <p>Bertanggung jawab penuh atas keabsahan modul pelatihan dan hasil asesmen.</p>
                        </div>
                      </div>
                      <div className="berakhlak-item">
                        <span className="letter-badge">K</span>
                        <div className="ber-info">
                          <strong>Kompeten</strong>
                          <p>Terus meningkatkan kapabilitas diri melalui materi kurikulum terkini.</p>
                        </div>
                      </div>
                      <div className="berakhlak-item">
                        <span className="letter-badge">H</span>
                        <div className="ber-info">
                          <strong>Harmonis</strong>
                          <p>Saling peduli, menghargai keberagaman pendapat dalam ruang diskusi.</p>
                        </div>
                      </div>
                      <div className="berakhlak-item">
                        <span className="letter-badge">L</span>
                        <div className="ber-info">
                          <strong>Loyal</strong>
                          <p>Memegang teguh ideologi Pancasila dan nama baik institusi DPD RI.</p>
                        </div>
                      </div>
                      <div className="berakhlak-item">
                        <span className="letter-badge">A</span>
                        <div className="ber-info">
                          <strong>Adaptif</strong>
                          <p>Cepat menyesuaikan diri terhadap perkembangan teknologi dan regulasi digital.</p>
                        </div>
                      </div>
                      <div className="berakhlak-item">
                        <span className="letter-badge">K</span>
                        <div className="ber-info">
                          <strong>Kolaboratif</strong>
                          <p>Membangun kerja sama sinergis antar unit kerja dalam membagikan keahlian.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* 4. FITUR EKOSISTEM UNGGULAN */}
              {isMatch("fitur ekosistem unggulan modul katalog kuis sertifikat qr code forum qa tracking analitik wishlist") && (
                <article id="fitur-utama" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 4 • Kemampuan Sistem</span>
                      <h2 className="card-title">Fitur Ekosistem Unggulan</h2>
                    </div>
                    <span className="card-badge-status badge-teal">8 Fitur Utama</span>
                  </header>

                  <div className="card-body-content">
                    <div className="feature-grid">
                      <div className="feature-tile">
                        <div className="tile-icon-wrap bg-teal-subtle text-teal">
                          <i className="bi bi-collection-play-fill" aria-hidden="true"></i>
                        </div>
                        <h3 className="tile-title">Katalog Kursus Lengkap</h3>
                        <p className="tile-text">Ratusan modul pembelajaran terstruktur mencakup administrasi keparlemenan, persidangan, keprotokolan, hingga teknologi informasi.</p>
                      </div>

                      <div className="feature-tile">
                        <div className="tile-icon-wrap bg-primary-subtle text-primary">
                          <i className="bi bi-patch-check-fill" aria-hidden="true"></i>
                        </div>
                        <h3 className="tile-title">Sertifikat Digital Otentik</h3>
                        <p className="tile-text">E-sertifikat ber-QR Code dengan verifikasi publik instan untuk validasi keaslian dokumen kelulusan tanpa manipulasi.</p>
                      </div>

                      <div className="feature-tile">
                        <div className="tile-icon-wrap bg-indigo-subtle text-indigo">
                          <i className="bi bi-chat-dots-fill" aria-hidden="true"></i>
                        </div>
                        <h3 className="tile-title">Forum Q&A Interaktif</h3>
                        <p className="tile-text">Komunikasi langsung dua arah antara peserta dengan widyaiswara / instruktur terkait pendalaman materi diklat.</p>
                      </div>

                      <div className="feature-tile">
                        <div className="tile-icon-wrap bg-warning-subtle text-warning">
                          <i className="bi bi-speedometer2" aria-hidden="true"></i>
                        </div>
                        <h3 className="tile-title">Tracking Progres Real-Time</h3>
                        <p className="tile-text">Pemantauan persentase penyelesaian modul, nilai kuis, dan resume jam pelajaran yang tersinkron otomatis.</p>
                      </div>

                      <div className="feature-tile">
                        <div className="tile-icon-wrap bg-success-subtle text-success">
                          <i className="bi bi-shield-lock-fill" aria-hidden="true"></i>
                        </div>
                        <h3 className="tile-title">Integrasi SSO Nusa DPD</h3>
                        <p className="tile-text">Akses aman satu pintu tanpa perlu mengingat sandi tambahan, langsung terhubung dengan akun kedinasan.</p>
                      </div>

                      <div className="feature-tile">
                        <div className="tile-icon-wrap bg-danger-subtle text-danger">
                          <i className="bi bi-bookmark-heart-fill" aria-hidden="true"></i>
                        </div>
                        <h3 className="tile-title">Wishlist & Rencana Diklat</h3>
                        <p className="tile-text">Tandai kursus penting untuk diikuti pada periode waktu tertentu sesuai kebutuhan tugas kedinasan.</p>
                      </div>

                      <div className="feature-tile">
                        <div className="tile-icon-wrap bg-teal-subtle text-teal">
                          <i className="bi bi-trophy-fill" aria-hidden="true"></i>
                        </div>
                        <h3 className="tile-title">Leaderboard & Peringkat</h3>
                        <p className="tile-text">Peringkat apresiasi peserta dan instruktur paling aktif guna memotivasi semangat belajar berkelanjutan.</p>
                      </div>

                      <div className="feature-tile">
                        <div className="tile-icon-wrap bg-secondary-subtle text-dark">
                          <i className="bi bi-search" aria-hidden="true"></i>
                        </div>
                        <h3 className="tile-title">Pencarian Full-Text Cerdas</h3>
                        <p className="tile-text">Temukan topik bahasan spesifik secara cepat menggunakan kata kunci dengan sistem filter multi-kategori.</p>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* 5. PENGEMBANG & REGULASI */}
              {isMatch("pengembang regulasi dasar hukum kelembagaan bpsdm biro okk sekretariat jenderal") && (
                <article id="pengembang" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 5 • Landasan Hukum & Tata Kelola</span>
                      <h2 className="card-title">Pengembang & Kelembagaan</h2>
                    </div>
                    <span className="card-badge-status badge-active">Resmi Pemerintah</span>
                  </header>

                  <div className="card-body-content">
                    <p>
                      Platform <strong>LMSetjen DPD RI</strong> dikelola dan dikembangkan secara resmi oleh:
                    </p>
                    <div className="org-card">
                      <div className="org-icon-bubble">
                        <i className="bi bi-diagram-3-fill"></i>
                      </div>
                      <div className="org-info">
                        <h3 className="org-title">Bagian Pengembangan Sumber Daya Manusia (BPSDM)</h3>
                        <span className="org-unit">Biro Organisasi, Keanggotaan, dan Kepegawaian (Biro OKK)</span>
                        <span className="org-inst">Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia</span>
                      </div>
                    </div>
                    <p className="mt-3">
                      Penyelenggaraan pelatihan mandiri digital ini berlandaskan pada Undang-Undang Aparatur Sipil Negara, Peraturan Lembaga Administrasi Negara terkait pembelajaran terintegrasi <em>(Corporate University)</em>, serta Keputusan Sekretaris Jenderal DPD RI mengenai roadmap transformasi digital pelayanan parlemen.
                    </p>
                  </div>
                </article>
              )}

              {/* 6. SALURAN BANTUAN BPSDM */}
              {isMatch("kontak saluran bantuan bpsdm email telepon alamat layanan konsultasi") && (
                <article id="kontak-layanan" className="content-card mb-4">
                  <header className="card-header-row">
                    <div className="header-left">
                      <span className="section-pill">Bab 6 • Saluran Komunikasi</span>
                      <h2 className="card-title">Saluran Bantuan & Layanan BPSDM</h2>
                    </div>
                    <span className="card-badge-status badge-teal">Dukungan Responsif</span>
                  </header>

                  <div className="card-body-content">
                    <p>
                      Jika Anda memiliki pertanyaan terkait kurikulum, permohonan instruktur, atau kendala teknis dalam pemanfaatan platform, tim kami siap melayani:
                    </p>
                    <div className="channel-grid">
                      <div className="channel-cell">
                        <i className="bi bi-envelope-at-fill text-teal channel-cell-icon" aria-hidden="true"></i>
                        <div>
                          <strong>Surel Pengaduan & Layanan</strong>
                          <a href="mailto:sdm@dpd.go.id" className="d-block text-teal font-monospace">sdm@dpd.go.id</a>
                          <small className="text-muted">Respon cepat dalam 1x24 jam kerja</small>
                        </div>
                      </div>

                      <div className="channel-cell">
                        <i className="bi bi-telephone-fill text-teal channel-cell-icon" aria-hidden="true"></i>
                        <div>
                          <strong>Layanan Telepon / WhatsApp</strong>
                          <a href="tel:+6285315869799" className="d-block text-teal font-monospace">(+62) 853 1586 9799</a>
                          <small className="text-muted">Senin – Jumat (08:00 – 16:00 WIB)</small>
                        </div>
                      </div>

                      <div className="channel-cell">
                        <i className="bi bi-geo-alt-fill text-teal channel-cell-icon" aria-hidden="true"></i>
                        <div>
                          <strong>Sekretariat Kantor Fisik</strong>
                          <p className="mb-0 text-dark">Gedung B Lantai 4, Sekretariat Jenderal DPD RI</p>
                          <small className="text-muted">Kompleks Parlemen Senayan, Jakarta Pusat 10270</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* No Search Match State */}
              {q && !isMatch("apa itu lmsetjen dpd ri bpsdm platform visi misi nilai budaya berakhlak fitur utama ekosistem pengembang regulasi kontak saluran bantuan") && (
                <div className="empty-search-state text-center py-5">
                  <i className="bi bi-search text-muted fs-1 mb-3 d-block" aria-hidden="true"></i>
                  <h4>Pencarian Tidak Ditemukan</h4>
                  <p className="text-muted">Tidak ada bab atau topik yang cocok dengan kata kunci "<strong>{searchQuery}</strong>".</p>
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

export default memo(Tentang);
