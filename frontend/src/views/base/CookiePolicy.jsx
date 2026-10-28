import React, { memo, useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import logoSetjenWebP from "../../assets/logo/logo-setjen-dpd.webp";
import logoSetjenPNG from "../../assets/logo/logo-setjen-dpd.png";
import useStickyHero from "../../hooks/useStickyHero";
import "./CookiePolicy.css";

function CookiePolicy() {
  const [activeSection, setActiveSection] = useState("apa-itu-cookie");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const { isScrolled, headerHeight } = useStickyHero(55);

  // 10 Sections for Table of Contents & Quick Navigation
  const sections = useMemo(() => [
    { id: "apa-itu-cookie", title: "1. Apa Itu Cookie?", icon: "bi-info-circle", tag: "Definisi" },
    { id: "jenis-cookie", title: "2. Jenis Cookie Digunakan", icon: "bi-layers-fill", tag: "Kategori" },
    { id: "token-jwt", title: "3. Autentikasi Token JWT", icon: "bi-key-fill", tag: "Keamanan" },
    { id: "cara-penggunaan", title: "4. Tujuan & Pemanfaatan", icon: "bi-gear-fill", tag: "Fungsional" },
    { id: "kontrol-cookie", title: "5. Kontrol & Pengaturan", icon: "bi-sliders", tag: "Preferensi" },
    { id: "cookie-pihak-ketiga", title: "6. Layanan Pihak Ketiga", icon: "bi-share-fill", tag: "SSO Integrasi" },
    { id: "retensi-cookie", title: "7. Masa Simpan (Retensi)", icon: "bi-clock-history", tag: "Durasi" },
    { id: "privasi-keamanan", title: "8. Privasi & Enkripsi", icon: "bi-shield-lock-fill", tag: "Proteksi" },
    { id: "perubahan-kebijakan", title: "9. Pembaruan Kebijakan", icon: "bi-arrow-repeat", tag: "Revisi" },
    { id: "kontak-kami", title: "10. Kontak & Layanan BPSDM", icon: "bi-envelope-at-fill", tag: "Dukungan" },
  ], []);

  // Smooth scroll with header offset
  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      // Offset for: BaseHeader (headerHeight) + stuck hero (56px) + margin clearance (16px)
      const headerOffset = (headerHeight || 60) + 56 + 16;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  // Scrollspy observer for active section
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

  // Search filter
  const q = searchQuery.toLowerCase().trim();
  const isMatch = (text) => !q || text.toLowerCase().includes(q);

  return (
    <div className="cookie-policy-wrapper">
      <BaseHeader />

      {/* HERO SLOT ANCHOR PREVENTS LAYOUT SHIFT */}
      <div 
        className="cookie-hero-slot"
        style={{ '--header-height': `${headerHeight}px` }}
      >
        {/* COMPACT HERO HEADER WITH STICKY SCROLL BEHAVIOR */}
        <header className={`cookie-hero ${isScrolled ? 'is-stuck' : ''}`} role="banner">
          <div className="container">
            <div className="cookie-hero-content">
              {/* Breadcrumb & Top badge */}
              <div className="cookie-hero-top">
                <nav aria-label="breadcrumb" className="cookie-breadcrumb">
                  <Link to="/" className="breadcrumb-link">
                    <i className="bi bi-house-door-fill me-1" aria-hidden="true"></i> Beranda
                  </Link>
                  <span className="breadcrumb-separator">/</span>
                  <span className="breadcrumb-current">Informasi Cookie</span>
                </nav>
                <span className="cookie-badge">
                  <span className="badge-pulse" aria-hidden="true"></span>
                  <span>Standar Transparansi Web Setjen DPD RI</span>
                </span>
              </div>

              {/* Title & Concise Summary */}
              <div className="cookie-hero-main">
                <div className="cookie-hero-title-area">
                  <div className="cookie-hero-icon-bubble" aria-hidden="true">
                    <i className="fas fa-cookie-bite"></i>
                  </div>
                  <div>
                    <h1 className="cookie-hero-title">Informasi & Kebijakan Cookie LMSetjen DPD RI</h1>
                    <p className="cookie-hero-subtitle">
                      Keterbukaan informasi mengenai penggunaan cookie, token autentikasi JWT, dan penyimpanan peramban lokal demi memastikan keandalan, kenyamanan, serta keamanan login pengguna.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Bar - High-Contrast Stat Pills */}
              <div className="cookie-stats-row">
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-shield-check"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Cookies Esensial</span>
                    <strong className="stat-val">Wajib untuk Login</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-key-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Autentikasi Sesi</span>
                    <strong className="stat-val">JSON Web Token (JWT)</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-slash-circle-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Pelacak Iklan</span>
                    <strong className="stat-val">Nol Pelacak Komersial</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-calendar-check-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Pembaruan</span>
                    <strong className="stat-val">Januari 2026</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* MAIN TWO-COLUMN COMPACT LAYOUT */}
      <main className="cookie-main-container">
        <div className="container">
          <div className="row g-4 align-items-start">

            {/* LEFT COLUMN: STICKY TOC, KEY SUMMARY & ACTIONS */}
            <div className="col-lg-4 col-xl-3 cookie-sidebar-col">
              <div className="cookie-sidebar-sticky">

                {/* Search / Fast Filter */}
                <div 
                  className="cookie-search-card"
                  title="Cari kata kunci (JWT, Sesi, Google, Keamanan, Masa Simpan)..."
                >
                  <label htmlFor="cookie-search" className="visually-hidden">Cari poin kebijakan cookie</label>
                  <div className="cookie-search-input-wrap">
                    <i className="bi bi-search search-icon" aria-hidden="true"></i>
                    <input
                      id="cookie-search"
                      type="text"
                      className="cookie-search-input"
                      placeholder="Cari kata kunci (JWT, Sesi, Google)..."
                      title="Cari kata kunci (JWT, Sesi, Google, Keamanan, Masa Simpan)..."
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
                  {/* Tooltip visible on hover over cookie-search-card */}
                  <div className="cookie-search-tooltip" role="tooltip">
                    <i className="bi bi-info-circle-fill me-1 text-teal"></i>
                    <span>Cari kata kunci (JWT, Sesi, Google, Keamanan, Masa Simpan)...</span>
                  </div>
                </div>

                {/* Table of Contents Navigation */}
                <div className="cookie-toc-card">
                  <div className="toc-header">
                    <span className="toc-title">
                      <i className="bi bi-list-nested me-2 text-teal" aria-hidden="true"></i>
                      Daftar Topik Cookie
                    </span>
                    <span className="toc-count">{sections.length} Poin</span>
                  </div>
                  <nav className="toc-list" aria-label="Navigasi informasi cookie">
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
                        {/* Custom floating tooltip for full text when truncated */}
                        <span className="toc-item-tooltip" role="tooltip">
                          <i className={`bi ${sec.icon} me-1 text-teal`} aria-hidden="true"></i>
                          <span>{sec.title}</span>
                        </span>
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Key Summary Highlights */}
                <div className="cookie-summary-card">
                  <div className="summary-card-header">
                    <i className="bi bi-check2-circle text-teal me-2" aria-hidden="true"></i>
                    <span>Prinsip Keamanan Cookie</span>
                  </div>
                  <ul className="summary-list">
                    <li>
                      <i className="bi bi-shield-check text-teal" aria-hidden="true"></i>
                      <span>Hanya menyimpan token otorisasi dan preferensi teknis tampilan.</span>
                    </li>
                    <li>
                      <i className="bi bi-eye-slash-fill text-teal" aria-hidden="true"></i>
                      <span>Tidak mengumpulkan kata sandi asli maupun riwayat penelusuran di luar LMS.</span>
                    </li>
                    <li>
                      <i className="bi bi-lock-fill text-teal" aria-hidden="true"></i>
                      <span>Token JWT terlindungi dengan masa berlaku yang diperbarui otomatis.</span>
                    </li>
                  </ul>
                </div>

                {/* Quick Action Buttons */}
                <div className="cookie-action-card">
                  <button
                    type="button"
                    className="cookie-action-btn btn-copy"
                    onClick={handleCopyEmail}
                    title="Salin email pengelola BPSDM"
                  >
                    <i className={`bi ${copiedEmail ? "bi-check-lg text-success" : "bi-clipboard"} me-2`} aria-hidden="true"></i>
                    {copiedEmail ? "Email Tersalin!" : "Salin Email SDM"}
                  </button>
                  <button
                    type="button"
                    className="cookie-action-btn btn-print"
                    onClick={handlePrint}
                    title="Cetak atau simpan sebagai PDF"
                  >
                    <i className="bi bi-printer me-2" aria-hidden="true"></i>
                    Cetak Dokumen
                  </button>
                </div>

                {/* Official Institution Stamp */}
                <div className="cookie-authority-card">
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
            <div className="col-lg-8 col-xl-9 cookie-content-col">

              {/* SECTION 1: APA ITU COOKIE */}
              <article 
                id="apa-itu-cookie" 
                className={`policy-card ${!isMatch("apa itu cookie file peramban browser definisi simpan") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-info-circle"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 1</span>
                    <h2 className="policy-card-title">Apa Itu Cookie?</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="lead-paragraph">
                    <strong>Cookie</strong> adalah berkas teks berukuran sangat kecil yang disimpan secara otomatis oleh peramban (*browser*) pada komputer, ponsel, atau gawai Anda ketika Anda mengakses platform <strong>LMSetjen DPD RI</strong>.
                  </p>
                  <div className="policy-callout-box">
                    <i className="bi bi-shield-shaded callout-icon" aria-hidden="true"></i>
                    <p className="callout-text mb-0">
                      Cookie membantu sistem mengenali identitas sesi login Anda, mengingat preferensi pengaturan antarmuka, serta memungkinkan navigasi perpindahan modul materi pembelajaran berlangsung mulus tanpa perlu login berulang kali.
                    </p>
                  </div>
                </div>
              </article>

              {/* SECTION 2: JENIS COOKIE YANG KAMI GUNAKAN */}
              <article 
                id="jenis-cookie" 
                className={`policy-card ${!isMatch("jenis cookie esensial analitik preferensi tema bahasa sesi") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-layers-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 2</span>
                    <h2 className="policy-card-title">Jenis Cookie yang Digunakan</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="section-intro">
                    Kami mengelompokkan teknologi penyimpanan peramban menjadi tiga kategori fungsional yang terdefinisi dengan jelas:
                  </p>

                  <div className="cookie-types-grid">
                    {/* 1. Cookies Esensial */}
                    <div className="cookie-type-card border-teal">
                      <div className="cookie-type-head">
                        <div className="cookie-type-badge bg-teal-subtle text-teal">
                          <i className="bi bi-shield-lock-fill me-1"></i> Wajib
                        </div>
                        <h3 className="cookie-type-name">Cookies Esensial</h3>
                      </div>
                      <p className="cookie-type-desc">
                        Diperlukan secara mutlak untuk menjalankan fungsi inti platform. Tanpa cookie ini, Anda tidak dapat mengakses dashboard atau modul pelatihan.
                      </p>
                      <ul className="cookie-feature-list">
                        <li>Autentikasi dan token keamanan login</li>
                        <li>Pencegahan serangan Cross-Site Request Forgery (CSRF)</li>
                        <li>Verifikasi role pengguna (Admin / Instruktur / Pegawai)</li>
                      </ul>
                    </div>

                    {/* 2. Cookies Analitik */}
                    <div className="cookie-type-card border-indigo">
                      <div className="cookie-type-head">
                        <div className="cookie-type-badge bg-indigo-subtle text-primary">
                          <i className="bi bi-graph-up me-1"></i> Kinerja
                        </div>
                        <h3 className="cookie-type-name">Cookies Analitik</h3>
                      </div>
                      <p className="cookie-type-desc">
                        Membantu tim teknis BPSDM memahami efektivitas sistem dan stabilitas modul kursus secara agregat tanpa mengidentifikasi data privat.
                      </p>
                      <ul className="cookie-feature-list">
                        <li>Mengukur durasi waktu belajar pada modul video/SCORM</li>
                        <li>Mendeteksi kegagalan muat halaman atau error jaringan</li>
                        <li>Statistik kursus yang paling diminati aparatur</li>
                      </ul>
                    </div>

                    {/* 3. Cookies Preferensi */}
                    <div className="cookie-type-card border-amber cookie-type-span2">
                      <div className="cookie-type-head">
                        <div className="cookie-type-badge bg-amber-subtle text-warning">
                          <i className="bi bi-palette-fill me-1"></i> Personalisasi
                        </div>
                        <h3 className="cookie-type-name">Cookies Preferensi & Antarmuka</h3>
                      </div>
                      <p className="cookie-type-desc">
                        Menyimpan preferensi personal pengguna agar pengalaman belajar tetap konsisten setiap kali Anda membuka platform:
                      </p>
                      <div className="pref-chips-row">
                        <span className="pref-chip"><i className="bi bi-moon-stars me-1 text-teal"></i> Tema Tampilan (Terang / Gelap)</span>
                        <span className="pref-chip"><i className="bi bi-translate me-1 text-teal"></i> Pengaturan Bahasa (ID/EN)</span>
                        <span className="pref-chip"><i className="bi bi-bell me-1 text-teal"></i> Status Pop-up Notifikasi & Bantuan</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 3: TOKEN JWT */}
              <article 
                id="token-jwt" 
                className={`policy-card ${!isMatch("token jwt json web token localstorage sessionstorage autentikasi") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-key-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 3</span>
                    <h2 className="policy-card-title">Autentikasi Token JWT (JSON Web Token)</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Platform LMSetjen DPD RI menggunakan arsitektur modern berbasis <strong>JSON Web Token (JWT)</strong>. Token akses terenkripsi disimpan secara aman di <code>localStorage</code> atau <code>sessionStorage</code> peramban Anda untuk mengamankan komunikasi API ke server backend.
                  </p>

                  <div className="jwt-tech-box">
                    <div className="jwt-feature-col">
                      <div className="jwt-item">
                        <i className="bi bi-check-circle-fill text-success me-2" aria-hidden="true"></i>
                        <div>
                          <strong>Menjaga Sesi Login Aktif:</strong>
                          <span>Mengizinkan akses berkelanjutan tanpa meminta sandi di setiap perpindahan modul kursus.</span>
                        </div>
                      </div>

                      <div className="jwt-item">
                        <i className="bi bi-check-circle-fill text-success me-2" aria-hidden="true"></i>
                        <div>
                          <strong>Validasi Akses Berbasis Role:</strong>
                          <span>Menjamin hanya akun berwenang yang dapat membuka panel instruktur atau panel admin.</span>
                        </div>
                      </div>

                      <div className="jwt-item">
                        <i className="bi bi-check-circle-fill text-success me-2" aria-hidden="true"></i>
                        <div>
                          <strong>Masa Kadaluwarsa Otomatis:</strong>
                          <span>Token disegarkan secara otomatis dan kedaluwarsa jika terjadi ketidakaktifan panjang guna mitigasi pembajakan sesi.</span>
                        </div>
                      </div>
                    </div>

                    <div className="jwt-notice-col">
                      <i className="bi bi-shield-exclamation text-teal fs-3 mb-2" aria-hidden="true"></i>
                      <strong>Komponen Wajib Sistem</strong>
                      <p className="mb-0">
                        Token JWT merupakan pondasi keamanan sistem e-learning dan tidak dapat dinonaktifkan secara manual.
                      </p>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 4: CARA KAMI MENGGUNAKAN COOKIE */}
              <article 
                id="cara-penggunaan" 
                className={`policy-card ${!isMatch("cara penggunaan tujuan peningkatan personalisasi keamanan fungsionalitas") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-gear-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 4</span>
                    <h2 className="policy-card-title">Tujuan & Cara Kami Menggunakan Cookie</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="section-intro">
                    Setiap data teknis yang terekam pada peramban dimanfaatkan semata-mata untuk mendukung kelancaran kegiatan belajar mengajar:
                  </p>

                  <div className="usage-grid">
                    <div className="usage-card">
                      <div className="usage-head">
                        <span className="usage-icon bg-teal-subtle text-teal"><i className="bi bi-arrow-up-right-circle"></i></span>
                        <h4>Peningkatan Layanan</h4>
                      </div>
                      <p>Menganalisis performa muat video pembelajaran dan stabilitas kuis daring agar proses belajar berjalan lancar.</p>
                    </div>

                    <div className="usage-card">
                      <div className="usage-head">
                        <span className="usage-icon bg-indigo-subtle text-primary"><i className="bi bi-person-gear"></i></span>
                        <h4>Personalisasi Diklat</h4>
                      </div>
                      <p>Menyesuaikan preferensi modul, bookmark kursus favorit (Wishlist), serta riwayat pencarian materi kepakaran.</p>
                    </div>

                    <div className="usage-card">
                      <div className="usage-head">
                        <span className="usage-icon bg-success-subtle text-success"><i className="bi bi-shield-lock"></i></span>
                        <h4>Keamanan & Audit</h4>
                      </div>
                      <p>Mencegah pemalsuan identitas, mendeteksi login ganda tidak sah, dan melindungi akun dari serangan siber.</p>
                    </div>

                    <div className="usage-card">
                      <div className="usage-head">
                        <span className="usage-icon bg-cyan-subtle text-info"><i className="bi bi-check2-square"></i></span>
                        <h4>Fungsionalitas Kursus</h4>
                      </div>
                      <p>Memastikan progres persentase belajar, pelacakan SCORM, dan pengunduhan e-sertifikat tersinkronisasi tepat waktu.</p>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 5: KONTROL DAN PENGATURAN COOKIE */}
              <article 
                id="kontrol-cookie" 
                className={`policy-card ${!isMatch("kontrol pengaturan kelola tolak hapus browser peramban") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-sliders"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 5</span>
                    <h2 className="policy-card-title">Kontrol & Pengaturan Cookie Peramban</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Anda memiliki wewenang penuh untuk mengatur bagaimana peramban memperlakukan cookie. Sebagian besar peramban web modern menyediakan menu pengaturan privasi untuk:
                  </p>

                  <div className="controls-list-box">
                    <div className="control-item">
                      <i className="bi bi-sliders2-vertical text-teal me-2" aria-hidden="true"></i>
                      <span>Mengatur peramban untuk menolak atau menerima cookie dari situs tertentu secara selektif.</span>
                    </div>
                    <div className="control-item">
                      <i className="bi bi-trash3-fill text-teal me-2" aria-hidden="true"></i>
                      <span>Menghapus seluruh berkas cookie dan riwayat cache yang telah tersimpan di komputer Anda.</span>
                    </div>
                    <div className="control-item">
                      <i className="bi bi-bell-fill text-teal me-2" aria-hidden="true"></i>
                      <span>Mengaktifkan pemberitahuan setiap kali sebuah situs meminta izin untuk menyimpan cookie.</span>
                    </div>
                  </div>

                  <div className="cookie-warning-banner mt-3">
                    <i className="bi bi-exclamation-triangle-fill text-warning me-2 fs-5" aria-hidden="true"></i>
                    <div>
                      <strong>Perhatian Penting:</strong> Memblokir atau menghapus <em>Cookies Esensial</em> atau <em>Token JWT</em> akan menyebabkan sesi login terputus dan mengganggu akses Anda ke materi kursus serta ujian kompetensi.
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 6: COOKIE PIHAK KETIGA */}
              <article 
                id="cookie-pihak-ketiga" 
                className={`policy-card ${!isMatch("pihak ketiga google oauth nusa dpd sso login") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-share-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 6</span>
                    <h2 className="policy-card-title">Layanan & Cookie Pihak Ketiga</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Untuk mempermudah akses aparatur, platform LMSetjen DPD RI terintegrasi dengan penyedia identitas resmi pemerintah yang mungkin menetapkan cookie otorisasi mereka sendiri:
                  </p>

                  <div className="third-party-row">
                    <div className="third-party-card">
                      <div className="tp-header">
                        <i className="bi bi-google text-danger fs-4 me-2" aria-hidden="true"></i>
                        <div>
                          <strong>Google Workspace OAuth</strong>
                          <span className="tp-sub">Autentikasi Akun Resmi Kedinasan</span>
                        </div>
                      </div>
                      <p className="tp-desc">
                        Digunakan untuk validasi identitas Single Sign-On (SSO) email Google Setjen DPD RI. Dikelola berdasarkan kebijakan privasi Google.
                      </p>
                    </div>

                    <div className="third-party-card">
                      <div className="tp-header">
                        <i className="bi bi-building-lock text-teal fs-4 me-2" aria-hidden="true"></i>
                        <div>
                          <strong>Nusa DPD RI (SSO Portal)</strong>
                          <span className="tp-sub">Sistem Otentikasi Terintegrasi Setjen</span>
                        </div>
                      </div>
                      <p className="tp-desc">
                        Digunakan untuk verifikasi NIP dan status kepegawaian internal DPD RI secara otomatis tanpa entri kredensial ganda.
                      </p>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 7: RETENSI COOKIE */}
              <article 
                id="retensi-cookie" 
                className={`policy-card ${!isMatch("retensi cookie durasi simpan masa berlaku sesi permanen") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-clock-history"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 7</span>
                    <h2 className="policy-card-title">Durasi Penyimpanan (Masa Retensi)</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Masa penyimpanan data peramban bervariasi bergantung pada jenis dan fungsi keamanannya:
                  </p>

                  <div className="retention-table-wrap">
                    <div className="retention-row">
                      <div className="ret-badge bg-teal-subtle text-teal">Cookies Sesi</div>
                      <div className="ret-duration"><strong>Hingga Peramban Ditutup</strong></div>
                      <div className="ret-detail">Dihapus secara otomatis segera setelah jendela browser ditutup atau tombol logout ditekan.</div>
                    </div>

                    <div className="retention-row">
                      <div className="ret-badge bg-indigo-subtle text-primary">Token JWT</div>
                      <div className="ret-duration"><strong>Diperbarui Dinamis</strong></div>
                      <div className="ret-detail">Memiliki masa kedaluwarsa jangka pendek dengan mekanisme *refresh token* aman saat sesi aktif.</div>
                    </div>

                    <div className="retention-row">
                      <div className="ret-badge bg-amber-subtle text-warning">Preferensi</div>
                      <div className="ret-duration"><strong>Maksimal 12 Bulan</strong></div>
                      <div className="ret-detail">Menyimpan preferensi tema (terang/gelap) dan bahasa agar tidak perlu diatur ulang di masa mendatang.</div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 8: PRIVASI DAN KEAMANAN */}
              <article 
                id="privasi-keamanan" 
                className={`policy-card ${!isMatch("privasi keamanan enkripsi ssl tls sensitif proteksi") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-shield-lock-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 8</span>
                    <h2 className="policy-card-title">Privasi & Standar Keamanan Data</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Cookie dan token penyimpanan yang digunakan oleh LMSetjen DPD RI <strong>tidak pernah memuat data pribadi sensitif</strong> seperti sandi teks polos, nomor rekening, atau informasi rahasia kepegawaian.
                  </p>
                  <div className="security-guarantee-box">
                    <i className="bi bi-patch-check-fill text-teal guarantee-icon" aria-hidden="true"></i>
                    <div>
                      <strong>Jaminan Enkripsi Protokol TLS 256-Bit:</strong>
                      <p className="mb-0">
                        Seluruh interaksi data antara peramban Anda dan server e-learning Setjen DPD RI dienkripsi dengan standar industri tertinggi. Token penyimpanan hanya dapat didekripsi oleh sistem resmi kami.
                      </p>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 9: PERUBAHAN KEBIJAKAN COOKIE */}
              <article 
                id="perubahan-kebijakan" 
                className={`policy-card ${!isMatch("perubahan kebijakan cookie revisi pembaruan teknologi") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-arrow-repeat"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 9</span>
                    <h2 className="policy-card-title">Pembaruan Kebijakan Cookie</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Kami dapat meninjau dan merevisi kebijakan cookie ini dari waktu ke waktu untuk menyesuaikan dengan integrasi modul teknologi terbaru atau arahan regulasi perlindungan data pemerintah.
                  </p>
                  <p className="mb-0">
                    Pemberitahuan perubahan signifikan akan disampaikan melalui notifikasi sistem LMS atau banner pada beranda. Penggunaan berkelanjutan Anda atas platform menandakan penerimaan atas pembaruan ketentuan ini.
                  </p>
                </div>
              </article>

              {/* SECTION 10: KONTAK KAMI */}
              <article 
                id="kontak-kami" 
                className={`policy-card ${!isMatch("kontak bpsdm email sdm@dpd.go.id biro okk bantuan hubungi") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-envelope-at-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 10</span>
                    <h2 className="policy-card-title">Kontak & Layanan BPSDM</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Apabila Anda memiliki pertanyaan, kendala teknis terkait sesi login, atau ingin mengetahui lebih lanjut mengenai pengelolaan cookie di sistem ini, silakan hubungi unit pengelola resmi:
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
                        href="mailto:sdm@dpd.go.id?subject=Pertanyaan%20Kebijakan%20Cookie%20LMSetjen%20DPD%20RI" 
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

export default memo(CookiePolicy);
