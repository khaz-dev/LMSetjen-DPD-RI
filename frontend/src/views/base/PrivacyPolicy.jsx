import React, { memo, useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import logoSetjenWebP from "../../assets/logo/logo-setjen-dpd.webp";
import logoSetjenPNG from "../../assets/logo/logo-setjen-dpd.png";
import useStickyHero from "../../hooks/useStickyHero";
import "./PrivacyPolicy.css";

function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState("pendahuluan");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const { isScrolled, headerHeight } = useStickyHero(55);

  // Sections definition for Table of Contents & Quick Navigation
  const sections = useMemo(() => [
    { id: "pendahuluan", title: "1. Pendahuluan", icon: "bi-info-circle-fill", tag: "Prinsip Dasar" },
    { id: "informasi-dikumpulkan", title: "2. Informasi yang Dikumpulkan", icon: "bi-collection-fill", tag: "Data Pegawai" },
    { id: "penggunaan-informasi", title: "3. Penggunaan Informasi", icon: "bi-gear-wide-connected", tag: "Tujuan Layanan" },
    { id: "keamanan-data", title: "4. Keamanan & Enkripsi", icon: "bi-shield-lock-fill", tag: "Proteksi" },
    { id: "pembagian-informasi", title: "5. Pembagian Informasi", icon: "bi-share-fill", tag: "Keterbukaan" },
    { id: "retensi-data", title: "6. Retensi Data", icon: "bi-clock-history", tag: "Penyimpanan" },
    { id: "hak-pengguna", title: "7. Hak Peserta / Pengguna", icon: "bi-person-check-fill", tag: "Kewenangan" },
    { id: "kontak-kami", title: "8. Kontak & Layanan BPSDM", icon: "bi-envelope-at-fill", tag: "Dukungan" },
    { id: "perubahan-kebijakan", title: "9. Perubahan Ketentuan", icon: "bi-arrow-repeat", tag: "Pembaruan" },
  ], []);

  // Ensure body background is properly tinted for silhouette layer
  useEffect(() => {
    const originalBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#f1f5f9";
    return () => {
      document.body.style.backgroundColor = originalBg;
    };
  }, []);

  // Smooth scroll to selected section with navbar offset
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

  // Print helper
  const handlePrint = () => {
    window.print();
  };

  // Filter sections by search query
  const q = searchQuery.toLowerCase().trim();
  const isMatch = (text) => !q || text.toLowerCase().includes(q);

  return (
    <div 
      className="privacy-policy-wrapper"
      style={{ '--header-height': `${headerHeight}px` }}
    >
      <BaseHeader />

      {/* HERO SLOT ANCHOR PREVENTS LAYOUT SHIFT */}
      <div 
        className="privacy-hero-slot"
        style={{ '--header-height': `${headerHeight}px` }}
      >
        {/* COMPACT HERO HEADER WITH STICKY SCROLL BEHAVIOR */}
        <header className={`privacy-hero ${isScrolled ? 'is-stuck' : ''}`} role="banner">
          <div className="container">
            <div className="privacy-hero-content">
              {/* Breadcrumb & Meta badges */}
              <div className="privacy-hero-top">
                <nav aria-label="breadcrumb" className="privacy-breadcrumb">
                  <Link to="/" className="breadcrumb-link">
                    <i className="bi bi-house-door-fill me-1" aria-hidden="true"></i> Beranda
                  </Link>
                  <span className="breadcrumb-separator">/</span>
                  <span className="breadcrumb-current">Kebijakan Privasi</span>
                </nav>
                <span className="privacy-badge">
                  <span className="badge-pulse" aria-hidden="true"></span>
                  <span>Standar Regulasi Setjen DPD RI</span>
                </span>
              </div>

              {/* Title & Concise Summary */}
              <div className="privacy-hero-main">
                <div className="privacy-hero-title-area">
                  <div className="privacy-hero-icon-bubble" aria-hidden="true">
                    <i className="bi bi-shield-check"></i>
                  </div>
                  <div>
                    <h1 className="privacy-hero-title">Kebijakan Privasi LMSetjen DPD RI</h1>
                    <p className="privacy-hero-subtitle">
                      Perlindungan data pribadi, transparansi pengolahan data pembelajaran, dan komitmen keamanan digital di lingkungan Sekretariat Jenderal Dewan Perwakilan Daerah RI.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Bar - Minimizes whitespace, highlights key facts */}
              <div className="privacy-stats-row">
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-calendar-check-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Pembaruan</span>
                    <strong className="stat-val">Januari 2026</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-shield-lock-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Enkripsi Data</span>
                    <strong className="stat-val">SSL 256-Bit & MFA</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-check-circle-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Prinsip Komersial</span>
                    <strong className="stat-val">Bukan Untuk Dijual</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-patch-check-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Pengelola Resmi</span>
                    <strong className="stat-val">BPSDM Biro OKK</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* MAIN TWO-COLUMN COMPACT LAYOUT WITH FROSTED VEIL */}
      <main className="privacy-main-container">
        {/* Geometric Grid & Luminous Glow Pattern matching About section */}
        <div className="privacy-background-pattern" aria-hidden="true"></div>

        <div className="container">
          <div className="row g-4 align-items-start">
            
            {/* LEFT COLUMN: STICKY TOC, KEY SUMMARY & ACTIONS */}
            <div className="col-lg-4 col-xl-3 privacy-sidebar-col">
              <div className="privacy-sidebar-sticky">
                
                {/* Search / Fast Filter */}
                <div 
                  className="privacy-search-card"
                  title="Cari kata kunci (NIP, Sertifikat, Keamanan, Hak Akses, Retensi Data)..."
                >
                  <label htmlFor="policy-search" className="visually-hidden">Cari poin kebijakan</label>
                  <div className="privacy-search-input-wrap">
                    <i className="bi bi-search search-icon" aria-hidden="true"></i>
                    <input
                      id="policy-search"
                      type="text"
                      className="privacy-search-input"
                      placeholder="Cari kata kunci (NIP, Sertifikat)..."
                      title="Cari kata kunci (NIP, Sertifikat, Keamanan, Hak Akses, Retensi Data)..."
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
                  {/* Tooltip visible on hover over privacy-search-card */}
                  <div className="privacy-search-tooltip" role="tooltip">
                    <i className="bi bi-info-circle-fill me-1 text-teal"></i>
                    <span>Cari kata kunci (NIP, Sertifikat, Keamanan, Hak Akses, Retensi Data)...</span>
                  </div>
                </div>

                {/* Table of Contents Navigation */}
                <div className="privacy-toc-card">
                  <div className="toc-header">
                    <span className="toc-title">
                      <i className="bi bi-list-nested me-2 text-teal" aria-hidden="true"></i>
                      Daftar Isi Kebijakan
                    </span>
                    <span className="toc-count">{sections.length} Bagian</span>
                  </div>
                  <nav className="toc-list" aria-label="Navigasi bagian kebijakan">
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
                <div className="privacy-summary-card">
                  <div className="summary-card-header">
                    <i className="bi bi-stars text-warning me-2" aria-hidden="true"></i>
                    <span>Ringkasan Inti</span>
                  </div>
                  <ul className="summary-list">
                    <li>
                      <i className="bi bi-check2-circle text-teal" aria-hidden="true"></i>
                      <span>Data hanya dimanfaatkan untuk pengembangan kompetensi ASN DPD RI.</span>
                    </li>
                    <li>
                      <i className="bi bi-shield-slash text-danger" aria-hidden="true"></i>
                      <span>Tidak ada pembagian data komersial kepada pihak ketiga manapun.</span>
                    </li>
                    <li>
                      <i className="bi bi-key text-teal" aria-hidden="true"></i>
                      <span>Autentikasi terpusat via Google Workspace & Nusa DPD terenkripsi.</span>
                    </li>
                  </ul>
                </div>

                {/* Quick Action Buttons */}
                <div className="privacy-action-card">
                  <button
                    type="button"
                    className="privacy-action-btn btn-copy"
                    onClick={handleCopyEmail}
                    title="Salin alamat email pengelola BPSDM"
                  >
                    <i className={`bi ${copiedEmail ? "bi-check-lg text-success" : "bi-clipboard"} me-2`} aria-hidden="true"></i>
                    {copiedEmail ? "Email Tersalin!" : "Salin Email SDM"}
                  </button>
                  <button
                    type="button"
                    className="privacy-action-btn btn-print"
                    onClick={handlePrint}
                    title="Cetak atau simpan sebagai PDF"
                  >
                    <i className="bi bi-printer me-2" aria-hidden="true"></i>
                    Cetak Dokumen
                  </button>
                </div>

                {/* Official Institution Stamp */}
                <div className="privacy-authority-card">
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
            <div className="col-lg-8 col-xl-9 privacy-content-col">
              
              {/* SECTION 1: PENDAHULUAN */}
              <article 
                id="pendahuluan" 
                className={`policy-card ${!isMatch("pendahuluan sistem perlindungan data pribadi komitmen") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-info-circle-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 1</span>
                    <h2 className="policy-card-title">Pendahuluan</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="lead-paragraph">
                    Platform <strong>LMSetjen DPD RI</strong> (selanjutnya disebut "Sistem" atau "Kami") merupakan media pembelajaran digital resmi yang dikelola oleh <strong>Bagian Pengembangan Sumber Daya Manusia (BPSDM)</strong> di bawah <strong>Biro Organisasi, Keanggotaan, dan Kepegawaian (OKK)</strong>, Deputi Administrasi Sekretariat Jenderal DPD RI.
                  </p>
                  <div className="policy-callout-box">
                    <i className="bi bi-shield-shaded callout-icon" aria-hidden="true"></i>
                    <p className="callout-text mb-0">
                      Kami berkomitmen penuh untuk menghormati, melindungi, serta menjaga kerahasiaan data pribadi seluruh pegawai, instruktur, dan aparatur pengguna sistem sesuai dengan peraturan perundang-undangan perlindungan data yang berlaku di Indonesia.
                    </p>
                  </div>
                </div>
              </article>

              {/* SECTION 2: INFORMASI YANG DIKUMPULKAN */}
              <article 
                id="informasi-dikumpulkan" 
                className={`policy-card ${!isMatch("informasi dikumpulkan nip profil foto sertifikat nilai ip browser aktivitas") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-collection-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 2</span>
                    <h2 className="policy-card-title">Informasi yang Kami Kumpulkan</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="section-intro">
                    Untuk memberikan pengalaman belajar digital yang terarah dan akuntabel, Sistem mengumpulkan data berikut secara transparan:
                  </p>

                  <div className="data-grid">
                    {/* Item 1: Autentikasi */}
                    <div className="data-item-card">
                      <div className="data-item-head">
                        <span className="data-item-icon bg-teal-subtle">
                          <i className="bi bi-person-badge-fill text-teal"></i>
                        </span>
                        <h3 className="data-item-title">Data Autentikasi</h3>
                      </div>
                      <p className="data-item-desc">
                        Nomor Induk Pegawai (NIP), nama lengkap kedinasan, serta alamat email resmi dari <strong>Google Workspace</strong> dan <strong>Nusa DPD</strong>.
                      </p>
                    </div>

                    {/* Item 2: Profil */}
                    <div className="data-item-card">
                      <div className="data-item-head">
                        <span className="data-item-icon bg-indigo-subtle">
                          <i className="bi bi-person-circle text-primary"></i>
                        </span>
                        <h3 className="data-item-title">Data Profil Pegawai</h3>
                      </div>
                      <p className="data-item-desc">
                        Foto profil akun, ringkasan biografi profesional, unit kerja, jabatan, dan riwayat pelatihan kepakaran.
                      </p>
                    </div>

                    {/* Item 3: Pembelajaran */}
                    <div className="data-item-card">
                      <div className="data-item-head">
                        <span className="data-item-icon bg-success-subtle">
                          <i className="bi bi-mortarboard-fill text-success"></i>
                        </span>
                        <h3 className="data-item-title">Data Pembelajaran</h3>
                      </div>
                      <p className="data-item-desc">
                        Kursus terdaftar, progres materi modul (SCORM/H5P/Video), evaluasi kuis, riwayat nilai, dan sertifikat kelulusan terverifikasi.
                      </p>
                    </div>

                    {/* Item 4: Aktivitas */}
                    <div className="data-item-card">
                      <div className="data-item-head">
                        <span className="data-item-icon bg-amber-subtle">
                          <i className="bi bi-activity text-warning"></i>
                        </span>
                        <h3 className="data-item-title">Data Aktivitas Sistem</h3>
                      </div>
                      <p className="data-item-desc">
                        Log riwayat login, interaksi pada forum Q&A, ulasan kursus, waktu penyelesaian modul, dan riwayat pencarian pelatihan.
                      </p>
                    </div>

                    {/* Item 5: Teknis */}
                    <div className="data-item-card data-item-span2">
                      <div className="data-item-head">
                        <span className="data-item-icon bg-cyan-subtle">
                          <i className="bi bi-laptop-fill text-info"></i>
                        </span>
                        <h3 className="data-item-title">Data Teknis & Diagnostik</h3>
                      </div>
                      <p className="data-item-desc">
                        Alamat IP (Internet Protocol), jenis dan versi peramban (browser), sistem operasi, resolusi layar, dan timestamp akses guna audit stabilitas dan keamanan infrastruktur.
                      </p>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 3: PENGGUNAAN INFORMASI */}
              <article 
                id="penggunaan-informasi" 
                className={`policy-card ${!isMatch("penggunaan informasi tujuan sso sertifikat evaluasi regulasi") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-gear-wide-connected"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 3</span>
                    <h2 className="policy-card-title">Penggunaan Informasi</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="section-intro">
                    Setiap data yang dikumpulkan diproses secara proporsional semata-mata untuk tujuan kedinasan dan pengembangan kompetensi pegawai:
                  </p>

                  <div className="usage-checklist-grid">
                    <div className="usage-item">
                      <div className="usage-check-icon"><i className="bi bi-check2"></i></div>
                      <div className="usage-item-content">
                        <strong>Penyediaan Layanan E-Learning</strong>
                        <span>Memfasilitasi modul pelatihan daring, ujian kompetensi, dan pencatatan jam pembelajaran.</span>
                      </div>
                    </div>

                    <div className="usage-item">
                      <div className="usage-check-icon"><i className="bi bi-check2"></i></div>
                      <div className="usage-item-content">
                        <strong>Integrasi SSO Nusa DPD & Google</strong>
                        <span>Memproses autentikasi tunggal (Single Sign-On) yang cepat, aman, dan tanpa kata sandi berulang.</span>
                      </div>
                    </div>

                    <div className="usage-item">
                      <div className="usage-check-icon"><i className="bi bi-check2"></i></div>
                      <div className="usage-item-content">
                        <strong>Penerbitan Sertifikat Digital</strong>
                        <span>Menerbitkan e-sertifikat bernomor registrasi resmi dan QR Code validasi keaslian dokumen.</span>
                      </div>
                    </div>

                    <div className="usage-item">
                      <div className="usage-check-icon"><i className="bi bi-check2"></i></div>
                      <div className="usage-item-content">
                        <strong>Pemberitahuan & Notifikasi</strong>
                        <span>Mengirimkan pengingat tenggat kursus, pembaruan materi, serta tanggapan forum instruktur.</span>
                      </div>
                    </div>

                    <div className="usage-item">
                      <div className="usage-check-icon"><i className="bi bi-check2"></i></div>
                      <div className="usage-item-content">
                        <strong>Analitik Pengembangan SDM</strong>
                        <span>Menganalisis kebutuhan diklat pegawai guna menyusun kurikulum pengembangan yang relevan.</span>
                      </div>
                    </div>

                    <div className="usage-item">
                      <div className="usage-check-icon"><i className="bi bi-check2"></i></div>
                      <div className="usage-item-content">
                        <strong>Kepatuhan Hukum & Audit</strong>
                        <span>Memenuhi standar akuntabilitas aparatur sipil negara dan regulasi instansi pemerintah.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 4: KEAMANAN DATA */}
              <article 
                id="keamanan-data" 
                className={`policy-card ${!isMatch("keamanan enkripsi mfa data server perlindungan") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-shield-lock-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 4</span>
                    <h2 className="policy-card-title">Keamanan & Perlindungan Data</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Kami mengimplementasikan langkah-langkah keamanan teknis berstandar industri serta kontrol administratif ketat untuk melindungi data pribadi Anda dari akses tidak sah, kebocoran, perubahan, atau penghapusan tanpa hak.
                  </p>

                  <div className="security-features-row">
                    <div className="sec-feature-box">
                      <i className="bi bi-file-earmark-lock2-fill sec-feat-icon text-teal" aria-hidden="true"></i>
                      <h4>Enkripsi Data (In-Transit & At-Rest)</h4>
                      <p>Seluruh transmisi data dienkripsi dengan protokol Transport Layer Security (TLS/HTTPS 256-bit) dan database terlindungi.</p>
                    </div>

                    <div className="sec-feature-box">
                      <i className="bi bi-person-check-fill sec-feat-icon text-teal" aria-hidden="true"></i>
                      <h4>Multi-Factor Authentication (MFA)</h4>
                      <p>Dukungan autentikasi berlapis via SSO Nusa DPD untuk memitigasi risiko pembajakan akun pengguna.</p>
                    </div>

                    <div className="sec-feature-box">
                      <i className="bi bi-hdd-network-fill sec-feat-icon text-teal" aria-hidden="true"></i>
                      <h4>Penyimpanan Server Kedinasan</h4>
                      <p>Infrastruktur server terlindungi dengan firewall berlapis, backup berkala, dan pemantauan anomali jaringan 24/7.</p>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 5: PEMBAGIAN INFORMASI */}
              <article 
                id="pembagian-informasi" 
                className={`policy-card ${!isMatch("pembagian pihak ketiga google nusa dpd penjualan data") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-share-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 5</span>
                    <h2 className="policy-card-title">Pembagian Informasi</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <div className="no-sale-banner">
                    <i className="bi bi-shield-x me-2 text-danger fs-5" aria-hidden="true"></i>
                    <strong>Prinsip Nol Komersialisasi:</strong> Kami TIDAK PERNAH menjual, menyewakan, atau memperdagangkan data pribadi Anda kepada pihak ketiga manapun untuk tujuan periklanan atau komersial.
                  </div>

                  <p className="mt-3 mb-2">Informasi hanya dibagikan secara terbatas dalam koridor sah berikut:</p>
                  
                  <div className="sharing-chips-list">
                    <div className="sharing-chip">
                      <i className="bi bi-google text-danger me-2" aria-hidden="true"></i>
                      <div>
                        <strong>Penyedia Autentikasi Resmi</strong>
                        <span>(Google Workspace & Nusa DPD) sebatas verifikasi identitas token login.</span>
                      </div>
                    </div>

                    <div className="sharing-chip">
                      <i className="bi bi-people-fill text-teal me-2" aria-hidden="true"></i>
                      <div>
                        <strong>Tim Internal BPSDM Setjen DPD RI</strong>
                        <span>Pengelola berwenang untuk administrasi kursus dan rekapitulasi nilai pegawai.</span>
                      </div>
                    </div>

                    <div className="sharing-chip">
                      <i className="bi bi-bank text-primary me-2" aria-hidden="true"></i>
                      <div>
                        <strong>Otoritas Hukum & Regulasi Pemerintah</strong>
                        <span>Hanya apabila diwajibkan secara eksplisit oleh ketentuan perundang-undangan RI.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 6: RETENSI DATA */}
              <article 
                id="retensi-data" 
                className={`policy-card ${!isMatch("retensi data penyimpanan arsip lama simpan") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-clock-history"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 6</span>
                    <h2 className="policy-card-title">Retensi & Penyimpanan Data</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Kami menyimpan data pribadi Anda selama Anda memiliki status aktif sebagai pengguna atau selama dibutuhkan untuk memelihara riwayat kelulusan dan rekam jejak sertifikat kompetensi kedinasan.
                  </p>
                  <div className="retention-timeline-box">
                    <div className="retention-point">
                      <div className="retention-dot bg-teal"></div>
                      <div className="retention-content">
                        <strong>Masa Aktif Penugasan</strong>
                        <span>Data profil, log aktivitas, dan kursus aktif tersimpan utuh selama akun aktif di Setjen DPD RI.</span>
                      </div>
                    </div>
                    <div className="retention-point">
                      <div className="retention-dot bg-indigo"></div>
                      <div className="retention-content">
                        <strong>Arsip Sertifikat Permanen</strong>
                        <span>Data kelulusan dan nomor registrasi sertifikat diarsipkan permanen untuk validasi kredensial pegawai masa depan.</span>
                      </div>
                    </div>
                    <div className="retention-point">
                      <div className="retention-dot bg-gray"></div>
                      <div className="retention-content">
                        <strong>Penghapusan / Pembersihan</strong>
                        <span>Log sesi dan data sementara dibersihkan secara terjadwal setelah masa retensi audit keamanan berakhir.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 7: HAK PENGGUNA */}
              <article 
                id="hak-pengguna" 
                className={`policy-card ${!isMatch("hak pengguna akses perbaiki hapus tolak akun") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-person-check-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 7</span>
                    <h2 className="policy-card-title">Hak Peserta & Pengguna Platform</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="section-intro">
                    Sebagai pemilik data yang sah, Anda memiliki sejumlah hak mendasar yang diakui dan dapat Anda laksanakan sewaktu-waktu:
                  </p>

                  <div className="rights-grid">
                    <div className="right-badge-card">
                      <div className="right-number">01</div>
                      <div className="right-body">
                        <h3 className="right-title">Hak Akses Data</h3>
                        <p className="right-desc">Melihat data profil, riwayat pembelajaran, dan transkrip nilai yang terekam pada platform.</p>
                      </div>
                    </div>

                    <div className="right-badge-card">
                      <div className="right-number">02</div>
                      <div className="right-body">
                        <h3 className="right-title">Hak Perbaikan (Rektifikasi)</h3>
                        <p className="right-desc">Memperbarui informasi profil atau mengajukan koreksi atas data NIP dan identitas yang kurang akurat.</p>
                      </div>
                    </div>

                    <div className="right-badge-card">
                      <div className="right-number">03</div>
                      <div className="right-body">
                        <h3 className="right-title">Hak Penghapusan Akun</h3>
                        <p className="right-desc">Mengajukan penutupan akun setelah purnatugas sesuai prosedur administrasi kepegawaian DPD RI.</p>
                      </div>
                    </div>

                    <div className="right-badge-card">
                      <div className="right-number">04</div>
                      <div className="right-body">
                        <h3 className="right-title">Hak Keberatan Pemrosesan</h3>
                        <p className="right-desc">Menyampaikan keberatan atas pengolahan data tertentu di luar kebutuhan operasional kedinasan wajib.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 8: KONTAK KAMI */}
              <article 
                id="kontak-kami" 
                className={`policy-card ${!isMatch("kontak bpsdm email sdm@dpd.go.id biro okk bantuan hubungi") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-envelope-at-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 8</span>
                    <h2 className="policy-card-title">Kontak & Layanan BPSDM</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Apabila Anda memiliki pertanyaan, klarifikasi kebijakan, maupun ingin melaksanakan hak-hak privasi Anda di atas, silakan hubungi unit pengelola resmi melalui kontak berikut:
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
                        href="mailto:sdm@dpd.go.id?subject=Pertanyaan%20Kebijakan%20Privasi%20LMSetjen%20DPD%20RI" 
                        className="btn-send-inquiry"
                      >
                        <i className="bi bi-send-fill me-2" aria-hidden="true"></i>
                        Kirim Pertanyaan
                      </a>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 9: PERUBAHAN KEBIJAKAN */}
              <article 
                id="perubahan-kebijakan" 
                className={`policy-card ${!isMatch("perubahan kebijakan revisi pembaruan ketentuan") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-arrow-repeat"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 9</span>
                    <h2 className="policy-card-title">Perubahan Ketentuan Kebijakan</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Kami berhak meninjau dan memperbarui Kebijakan Privasi ini secara berkala untuk menyesuaikan dengan perkembangan teknologi, integrasi sistem baru, atau pembaruan regulasi pemerintah.
                  </p>
                  <p className="mb-0">
                    Setiap revisi signifikan akan diumumkan melalui beranda platform LMSetjen DPD RI atau pesan notifikasi. Penggunaan berkelanjutan Anda atas layanan LMS setelah tanggal pembaruan menandakan persetujuan Anda terhadap ketentuan yang diperbarui.
                  </p>
                </div>
              </article>

              {/* BOTTOM FAST NAVIGATION / BACK TO TOP */}
              <div className="policy-footer-actions">
                <Link to="/terms-and-conditions/" className="policy-adjacent-link">
                  <i className="bi bi-file-text me-2" aria-hidden="true"></i>
                  Baca Ketentuan Penggunaan Platform
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

export default memo(PrivacyPolicy);
