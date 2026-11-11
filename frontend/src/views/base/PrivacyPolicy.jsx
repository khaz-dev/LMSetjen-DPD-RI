import React, { memo, useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import logoSetjenWebP from "../../assets/logo/logo-setjen-dpd.webp";
import logoSetjenPNG from "../../assets/logo/logo-setjen-dpd.png";
import useStickyHero from "../../hooks/useStickyHero";
import apiInstance from "../../utils/axios";
import "./PrivacyPolicy.css";

function PrivacyPolicy() {
  const [activeSection, setActiveSection] = useState("pendahuluan");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const { isScrolled, headerHeight } = useStickyHero(55);

  // Live Statistics State
  const [stats, setStats] = useState({
    app_version: "1.1.0",
    total_registered_users: 774,
    total_courses: 0,
    total_certificates: 0,
    timestamp: null,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Fetch real-time statistics from backend
  const fetchLiveStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const response = await apiInstance.get("/statistics/public-stats/");
      if (response && response.data) {
        setStats({
          app_version: response.data.app_version || "1.1.0",
          total_registered_users: Number(response.data.total_registered_users) || 774,
          total_courses: Number(response.data.total_courses) || 0,
          total_certificates: Number(response.data.total_certificates) || 0,
          timestamp: response.data.timestamp || new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn("Gagal memuat statistik live untuk kebijakan privasi:", error);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveStats();
  }, [fetchLiveStats]);

  // Sections definition for Table of Contents & Quick Navigation
  const sections = useMemo(() => [
    { id: "pendahuluan", title: "1. Pendahuluan", icon: "bi-info-circle-fill", tag: "Prinsip Dasar" },
    { id: "informasi-dikumpulkan", title: "2. Informasi yang Dikumpulkan", icon: "bi-collection-fill", tag: "Data Pegawai" },
    { id: "penggunaan-informasi", title: "3. Penggunaan Informasi & AI", icon: "bi-gear-wide-connected", tag: "Tujuan Layanan" },
    { id: "keamanan-data", title: "4. Keamanan & Enkripsi", icon: "bi-shield-lock-fill", tag: "Proteksi" },
    { id: "pembagian-informasi", title: "5. Pembagian Informasi & Leaderboard", icon: "bi-share-fill", tag: "Keterbukaan" },
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
                  <span>Standar Regulasi SPBE & Perlindungan Data ASN • Versi {stats.app_version}</span>
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
                      Perlindungan data pribadi aparatur, transparansi pengolahan data pembelajaran & kecerdasan buatan (Manta AI), serta komitmen keamanan digital berstandar SPBE di lingkungan Sekretariat Jenderal DPD RI.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Bar - Live Stat Pills */}
              <div className="privacy-stats-row">
                <div className="stat-pill" title={`Versi kebijakan platform terkini v${stats.app_version}`}>
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

                <div className="stat-pill" title={`${stats.total_registered_users} akun aparatur terlindungi di sistem`}>
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-shield-lock-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Proteksi Aparatur</span>
                    <strong className="stat-val">
                      {isLoadingStats ? "..." : `${stats.total_registered_users} Pegawai`}
                    </strong>
                  </div>
                </div>

                <div className="stat-pill" title="Enkripsi data sesi dan proteksi kontrol akses RBAC">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-key-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Enkripsi Data</span>
                    <strong className="stat-val">TLS 256-Bit & JWT</strong>
                  </div>
                </div>

                <div className="stat-pill" title="Data 100% untuk kedinasan dan tidak dikomersialkan">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-patch-check-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Prinsip Komersial</span>
                    <strong className="stat-val">100% Bebas Komersialisasi</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* MAIN TWO-COLUMN COMPACT LAYOUT WITH FROSTED VEIL */}
      <main className="privacy-main-container">
        <div className="privacy-background-pattern" aria-hidden="true"></div>

        <div className="container">
          <div className="row g-4 align-items-start">
            
            {/* LEFT COLUMN: STICKY TOC, KEY SUMMARY & ACTIONS */}
            <div className="col-lg-4 col-xl-3 privacy-sidebar-col">
              <div className="privacy-sidebar-sticky">
                
                {/* Search / Fast Filter */}
                <div 
                  className="privacy-search-card"
                  title="Cari kata kunci (NIP, Manta AI, Gamifikasi, Sertifikat, Keamanan, Hak Akses, Retensi Data)..."
                >
                  <label htmlFor="policy-search" className="visually-hidden">Cari poin kebijakan</label>
                  <div className="privacy-search-input-wrap">
                    <i className="bi bi-search search-icon" aria-hidden="true"></i>
                    <input
                      id="policy-search"
                      type="text"
                      className="privacy-search-input"
                      placeholder="Cari kata kunci (Manta AI, NIP)..."
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
                  <div className="privacy-search-tooltip" role="tooltip">
                    <i className="bi bi-info-circle-fill me-1 text-teal"></i>
                    <span>Cari kata kunci: NIP, Manta AI, Gamifikasi, Sertifikat, Retensi, Hak Akses</span>
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
                    <span>Prinsip Utama Kebijakan</span>
                  </div>
                  <ul className="summary-list">
                    <li>
                      <i className="bi bi-check2-circle text-teal" aria-hidden="true"></i>
                      <span>Data semata-mata untuk akselerasi kompetensi ASN & pemenuhan 20 JP.</span>
                    </li>
                    <li>
                      <i className="bi bi-shield-slash text-danger" aria-hidden="true"></i>
                      <span>Nol penjualan atau monetisasi data pribadi ke pihak ketiga mana pun.</span>
                    </li>
                    <li>
                      <i className="bi bi-robot text-teal" aria-hidden="true"></i>
                      <span>Obrolan Manta AI diisolasi untuk sesi belajar dan tidak digunakan melatih AI komersial.</span>
                    </li>
                    <li>
                      <i className="bi bi-key text-teal" aria-hidden="true"></i>
                      <span>Autentikasi terenkripsi SSL 256-bit dengan kontrol akses berbasis peran (RBAC).</span>
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
                className={`policy-card ${!isMatch("pendahuluan sistem perlindungan data pribadi komitmen spbe versi 1.1.0") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-info-circle-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 1</span>
                    <h2 className="policy-card-title">Pendahuluan & Dasar Hukum</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="lead-paragraph">
                    Platform <strong>LMSetjen DPD RI</strong> (selanjutnya disebut "Sistem" atau "Kami") versi <strong>{stats.app_version}</strong> merupakan media pembelajaran digital resmi yang dikelola oleh <strong>Bagian Pengembangan Sumber Daya Manusia (BPSDM)</strong> di bawah <strong>Biro Organisasi, Keanggotaan, dan Kepegawaian (OKK)</strong>, Deputi Administrasi Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia.
                  </p>
                  <div className="policy-callout-box">
                    <i className="bi bi-shield-shaded callout-icon" aria-hidden="true"></i>
                    <p className="callout-text mb-0">
                      Kami berkomitmen penuh untuk menghormati, melindungi, serta menjaga kerahasiaan data pribadi seluruh aparatur (PNS, PPPK, dan PPNPN) serta instruktur pengguna sistem sesuai dengan Undang-Undang Perlindungan Data Pribadi (UU PDP No. 27/2022), Undang-Undang ASN No. 20/2023, serta Peraturan Presiden tentang Sistem Pemerintahan Berbasis Elektronik (SPBE).
                    </p>
                  </div>
                </div>
              </article>

              {/* SECTION 2: INFORMASI YANG DIKUMPULKAN */}
              <article 
                id="informasi-dikumpulkan" 
                className={`policy-card ${!isMatch("informasi dikumpulkan nip profil foto sertifikat nilai ip browser aktivitas manta ai gamifikasi catatan belajar leaderboard") ? "search-dim" : ""}`}
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
                    Untuk memberikan pengalaman belajar digital yang terarah, interaktif, dan akuntabel di versi {stats.app_version}, Sistem mengumpulkan data berikut secara transparan dan proporsional:
                  </p>

                  <div className="data-grid">
                    {/* Item 1: Autentikasi */}
                    <div className="data-item-card">
                      <div className="data-item-head">
                        <span className="data-item-icon bg-teal-subtle">
                          <i className="bi bi-person-badge-fill text-teal"></i>
                        </span>
                        <h3 className="data-item-title">Data Identitas & Autentikasi</h3>
                      </div>
                      <p className="data-item-desc">
                        Nomor Induk Pegawai (NIP), nama lengkap kedinasan, unit kerja, serta alamat surel resmi kedinasan.
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
                        Foto profil akun, ringkasan biografi profesional, jabatan, peran pengguna (Peserta/Instruktur/Admin), dan minat rumpun diklat.
                      </p>
                    </div>

                    {/* Item 3: Pembelajaran & Sertifikat */}
                    <div className="data-item-card">
                      <div className="data-item-head">
                        <span className="data-item-icon bg-success-subtle">
                          <i className="bi bi-mortarboard-fill text-success"></i>
                        </span>
                        <h3 className="data-item-title">Data Pembelajaran & Nilai</h3>
                      </div>
                      <p className="data-item-desc">
                        Kursus terdaftar, durasi jam pelajaran (JP), progres materi video, evaluasi kuis bertingkat, serta riwayat sertifikat resmi terverifikasi QR Code.
                      </p>
                    </div>

                    {/* Item 4: Interaksi Si Manta (AI) */}
                    <div className="data-item-card">
                      <div className="data-item-head">
                        <span className="data-item-icon bg-teal-subtle">
                          <i className="bi bi-robot text-teal"></i>
                        </span>
                        <h3 className="data-item-title">Interaksi AI (Si Manta)</h3>
                      </div>
                      <p className="data-item-desc">
                        Pertanyaan dan obrolan kontekstual dengan asisten AI Si Manta seputar materi pelatihan untuk menghasilkan rangkuman dan kuis adaptif (diisolasi khusus sesi belajar aparatur).
                      </p>
                    </div>

                    {/* Item 5: Gamifikasi & Leaderboard */}
                    <div className="data-item-card">
                      <div className="data-item-head">
                        <span className="data-item-icon bg-amber-subtle">
                          <i className="bi bi-controller text-warning"></i>
                        </span>
                        <h3 className="data-item-title">Gamifikasi & Poin Belajar</h3>
                      </div>
                      <p className="data-item-desc">
                        Skor mini-game edukatif per modul, akumulasi poin pengalaman (XP), perolehan lencana kompetensi (badges), dan riwayat peringkat kompetensi (Kursus & Global Rank).
                      </p>
                    </div>

                    {/* Item 6: Catatan Belajar & Masukan */}
                    <div className="data-item-card">
                      <div className="data-item-head">
                        <span className="data-item-icon bg-indigo-subtle">
                          <i className="bi bi-journal-text text-indigo"></i>
                        </span>
                        <h3 className="data-item-title">Catatan Belajar & Aspirasi</h3>
                      </div>
                      <p className="data-item-desc">
                        Catatan mandiri terenkripsi yang dibuat saat menyimak materi pembelajaran, serta saran atau laporan kendala yang disampaikan melalui dialog aspirasi aparatur.
                      </p>
                    </div>

                    {/* Item 7: Teknis & Diagnostik */}
                    <div className="data-item-card data-item-span2">
                      <div className="data-item-head">
                        <span className="data-item-icon bg-cyan-subtle">
                          <i className="bi bi-laptop-fill text-info"></i>
                        </span>
                        <h3 className="data-item-title">Data Teknis & Keamanan Sesi</h3>
                      </div>
                      <p className="data-item-desc">
                        Alamat IP (Internet Protocol), penanda sesi token JWT, jenis peramban (browser), sistem operasi, dan stempel waktu akses guna audit stabilitas, diagnostik performa, serta mitigasi insiden siber.
                      </p>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 3: PENGGUNAAN INFORMASI & AI */}
              <article 
                id="penggunaan-informasi" 
                className={`policy-card ${!isMatch("penggunaan informasi tujuan manta ai rekomendasi evaluasi jam pelajaran jp 20") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-gear-wide-connected"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 3</span>
                    <h2 className="policy-card-title">Penggunaan Informasi & Pemrosesan Kecerdasan Buatan (AI)</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="section-intro">
                    Setiap data yang dikumpulkan diproses secara proporsional semata-mata untuk kepentingan kedinasan dan akselerasi kompetensi pegawai Setjen DPD RI:
                  </p>

                  <div className="usage-checklist-grid">
                    <div className="usage-item">
                      <div className="usage-check-icon"><i className="bi bi-check2"></i></div>
                      <div className="usage-item-content">
                        <strong>Pemenuhan Hak 20 Jam Pelajaran (JP) ASN</strong>
                        <span>Merekam pencapaian jam pelajaran mandiri secara akuntabel sesuai amanat LAN RI dan peraturan kepegawaian.</span>
                      </div>
                    </div>

                    <div className="usage-item">
                      <div className="usage-check-icon"><i className="bi bi-check2"></i></div>
                      <div className="usage-item-content">
                        <strong>Personalisasi Pendamping Belajar Si Manta (AI)</strong>
                        <span>Menghadirkan penjelasan materi adaptif, asistensi kurikulum keparlemenan, dan simulasi kuis interaktif yang relevan.</span>
                      </div>
                    </div>

                    <div className="usage-item">
                      <div className="usage-check-icon"><i className="bi bi-check2"></i></div>
                      <div className="usage-item-content">
                        <strong>Penerbitan Sertifikat Resmi Ber-QR Code</strong>
                        <span>Menerbitkan sertifikat kompetensi beridentitas kode unik kriptografis yang tervalidasi secara publik.</span>
                      </div>
                    </div>

                    <div className="usage-item">
                      <div className="usage-check-icon"><i className="bi bi-check2"></i></div>
                      <div className="usage-item-content">
                        <strong>Papan Peringkat (Leaderboard) & Motivasi Belajar</strong>
                        <span>Menghitung perolehan poin XP dan lencana prestasi guna menumbuhkan budaya belajar berkelanjutan di seluruh unit kerja.</span>
                      </div>
                    </div>

                    <div className="usage-item">
                      <div className="usage-check-icon"><i className="bi bi-check2"></i></div>
                      <div className="usage-item-content">
                        <strong>Notifikasi Sistem & Pengingat Diklat</strong>
                        <span>Mengirimkan notifikasi lonceng in-app terkait tenggat kursus, respons forum instruktur, dan rilis versi aplikasi.</span>
                      </div>
                    </div>

                    <div className="usage-item">
                      <div className="usage-check-icon"><i className="bi bi-check2"></i></div>
                      <div className="usage-item-content">
                        <strong>Penyempurnaan Kurikulum Biro OKK</strong>
                        <span>Menganalisis statistik agregat (tanpa mengidentifikasi personal) guna merancang program diklat keparlemenan masa depan.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 4: KEAMANAN DATA */}
              <article 
                id="keamanan-data" 
                className={`policy-card ${!isMatch("keamanan enkripsi mfa data server perlindungan jwt rbac") ? "search-dim" : ""}`}
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
                    Kami menerapkan standar keamanan teknis dan kontrol akses administratif berlapis untuk melindungi data aparatur dari potensi kebocoran, modifikasi tidak sah, maupun insiden siber:
                  </p>

                  <div className="security-features-row">
                    <div className="sec-feature-box">
                      <i className="bi bi-file-earmark-lock2-fill sec-feat-icon text-teal" aria-hidden="true"></i>
                      <h4>Enkripsi Data (TLS 256-Bit)</h4>
                      <p>Seluruh transmisi lalu lintas data antara peramban pegawai dan server dilindungi protokol TLS/HTTPS 256-bit berstandar enkripsi tinggi.</p>
                    </div>

                    <div className="sec-feature-box">
                      <i className="bi bi-person-check-fill sec-feat-icon text-teal" aria-hidden="true"></i>
                      <h4>Token JWT & Kontrol Akses RBAC</h4>
                      <p>Pengamanan sesi pengguna berbasis JSON Web Token dengan rotasi aman serta pemisahan hak akses ketat (Admin, Instruktur, Peserta).</p>
                    </div>

                    <div className="sec-feature-box">
                      <i className="bi bi-robot sec-feat-icon text-teal" aria-hidden="true"></i>
                      <h4>Isolasi Pemrosesan AI Manta</h4>
                      <p>Kueri pembelajaran diproses dalam saluran terlindung; data percakapan tidak pernah disimpan atau dipakai untuk melatih model publik komersial.</p>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 5: PEMBAGIAN INFORMASI & LEADERBOARD */}
              <article 
                id="pembagian-informasi" 
                className={`policy-card ${!isMatch("pembagian pihak ketiga penjualan leaderboard transparansi") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-share-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 5</span>
                    <h2 className="policy-card-title">Pembagian Informasi & Transparansi Leaderboard</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <div className="no-sale-banner">
                    <i className="bi bi-shield-x me-2 text-danger fs-5" aria-hidden="true"></i>
                    <strong>Prinsip Nol Komersialisasi:</strong> Kami TIDAK PERNAH menjual, menyewakan, atau membagikan data pribadi aparatur kepada pihak ketiga komersial mana pun untuk keperluan periklanan atau monetisasi.
                  </div>

                  <p className="mt-3 mb-2">Informasi hanya dibagikan secara terbatas dalam koridor sah berikut:</p>
                  
                  <div className="sharing-chips-list">
                    <div className="sharing-chip">
                      <i className="bi bi-trophy-fill text-amber me-2" aria-hidden="true"></i>
                      <div>
                        <strong>Papan Peringkat Lingkup Internal Setjen DPD RI</strong>
                        <span>Nama, unit kerja, dan poin XP ditampilkan di Leaderboard antarsesama aparatur Setjen DPD RI demi motivasi belajar kedinasan.</span>
                      </div>
                    </div>

                    <div className="sharing-chip">
                      <i className="bi bi-people-fill text-teal me-2" aria-hidden="true"></i>
                      <div>
                        <strong>Pengelola BPSDM Biro OKK Setjen DPD RI</strong>
                        <span>Aparatur pengelola berwenang untuk validasi jam pelajaran, administrasi sertifikat, dan rekapitulasi penilaian.</span>
                      </div>
                    </div>

                    <div className="sharing-chip">
                      <i className="bi bi-bank text-primary me-2" aria-hidden="true"></i>
                      <div>
                        <strong>Otoritas Hukum & Regulasi Pemerintah RI</strong>
                        <span>Hanya apabila diwajibkan secara eksplisit oleh ketentuan hukum perundang-undangan Republik Indonesia.</span>
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
                    Kami menyimpan data pribadi Anda selama Anda berstatus aktif sebagai aparatur di lingkungan Setjen DPD RI atau selama dibutuhkan untuk memelihara rekam jejak sertifikasi kompetensi kedinasan:
                  </p>
                  <div className="retention-timeline-box">
                    <div className="retention-point">
                      <div className="retention-dot bg-teal"></div>
                      <div className="retention-content">
                        <strong>Masa Aktif Kedinasan</strong>
                        <span>Data profil, log aktivitas diklat, dan progres modul tersimpan utuh selama akun aktif di lingkungan Setjen DPD RI.</span>
                      </div>
                    </div>
                    <div className="retention-point">
                      <div className="retention-dot bg-indigo"></div>
                      <div className="retention-content">
                        <strong>Arsip Sertifikat Kelulusan Permanen</strong>
                        <span>Nomor registrasi sertifikat digital dan kode QR disimpan permanen untuk keperluan validasi keabsahan diklat di masa depan.</span>
                      </div>
                    </div>
                    <div className="retention-point">
                      <div className="retention-dot bg-gray"></div>
                      <div className="retention-content">
                        <strong>Pembersihan Data Sesi Sementara</strong>
                        <span>Log sesi sementara dan cache sistem dibersihkan secara terjadwal setelah batas audit keamanan terpenuhi.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 7: HAK PENGGUNA */}
              <article 
                id="hak-pengguna" 
                className={`policy-card ${!isMatch("hak pengguna akses perbaiki hapus tolak akun manta ai catatan") ? "search-dim" : ""}`}
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
                    Sebagai aparatur pemilik data yang sah, Anda memiliki sejumlah hak mendasar yang diakui dan dapat dilaksanakan sewaktu-waktu:
                  </p>

                  <div className="rights-grid">
                    <div className="right-badge-card">
                      <div className="right-number">01</div>
                      <div className="right-body">
                        <h3 className="right-title">Hak Akses & Transkrip</h3>
                        <p className="right-desc">Melihat data profil, transkrip jam pelajaran (JP), lencana prestasi, dan sertifikat yang Anda miliki.</p>
                      </div>
                    </div>

                    <div className="right-badge-card">
                      <div className="right-number">02</div>
                      <div className="right-body">
                        <h3 className="right-title">Hak Koreksi Data Profil</h3>
                        <p className="right-desc">Memperbarui informasi profil atau mengajukan pembetulan atas penulisan nama dan unit kerja pada sertifikat.</p>
                      </div>
                    </div>

                    <div className="right-badge-card">
                      <div className="right-number">03</div>
                      <div className="right-body">
                        <h3 className="right-title">Hak Kelola Catatan & Obrolan AI</h3>
                        <p className="right-desc">Menghapus catatan belajar mandiri atau mereset sesi dialog konsultasi dengan asisten AI Si Manta.</p>
                      </div>
                    </div>

                    <div className="right-badge-card">
                      <div className="right-number">04</div>
                      <div className="right-body">
                        <h3 className="right-title">Hak Aspirasi & Aduan Privasi</h3>
                        <p className="right-desc">Menyampaikan aspirasi dan melaporkan kekhawatiran terkait data pribadi langsung ke admin BPSDM Biro OKK.</p>
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
                    Apabila Anda memiliki pertanyaan, permohonan klarifikasi kebijakan, maupun ingin melaksanakan hak-hak privasi Anda di atas, silakan hubungi unit pengelola resmi melalui kanal berikut:
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
                className={`policy-card ${!isMatch("perubahan kebijakan revisi pembaruan ketentuan versi") ? "search-dim" : ""}`}
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
                    Kami berhak meninjau dan memperbarui Kebijakan Privasi ini secara berkala selaras dengan pembaruan rilis sistem LMSetjen DPD RI, integrasi modul baru, maupun perubahan regulasi kedinasan pemerintah.
                  </p>
                  <p className="mb-0">
                    Setiap revisi signifikan akan dicatat secara transparan pada log pembaruan sistem (Update Log) dan diumumkan melalui pengumuman platform. Penggunaan berkelanjutan Anda atas layanan LMSetjen DPD RI setelah tanggal pembaruan menandakan persetujuan Anda terhadap ketentuan yang diperbarui.
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
