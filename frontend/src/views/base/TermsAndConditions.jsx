import React, { memo, useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import logoSetjenWebP from "../../assets/logo/logo-setjen-dpd.webp";
import logoSetjenPNG from "../../assets/logo/logo-setjen-dpd.png";
import useStickyHero from "../../hooks/useStickyHero";
import "./TermsAndConditions.css";

function TermsAndConditions() {
  const [activeSection, setActiveSection] = useState("penerimaan");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const { isScrolled, headerHeight } = useStickyHero(55);

  // 11 Sections for TOC and Quick Navigation
  const sections = useMemo(() => [
    { id: "penerimaan", title: "1. Penerimaan Ketentuan", icon: "bi-check2-circle", tag: "Persetujuan" },
    { id: "penggunaan-layanan", title: "2. Penggunaan Layanan", icon: "bi-laptop", tag: "Akses ASN" },
    { id: "akun-pengguna", title: "3. Akun & Kredensial", icon: "bi-person-badge", tag: "Akuntabilitas" },
    { id: "konten-kursus", title: "4. Konten & Materi Belajar", icon: "bi-journal-bookmark", tag: "Materi Diklat" },
    { id: "sertifikat-digital", title: "5. Sertifikat & Kredensial", icon: "bi-patch-check-fill", tag: "Validasi" },
    { id: "pembatasan-tanggung-jawab", title: "6. Batasan Tanggung Jawab", icon: "bi-shield-exclamation", tag: "Operasional" },
    { id: "modifikasi-layanan", title: "7. Modifikasi & Penghentian", icon: "bi-sliders", tag: "Kebijakan" },
    { id: "larangan-kegiatan", title: "8. Larangan Kegiatan", icon: "bi-slash-circle-fill", tag: "Integritas" },
    { id: "hak-kekayaan-intelektual", title: "9. Hak Kekayaan Intelektual", icon: "bi-award", tag: "Hak Cipta" },
    { id: "penyelesaian-sengketa", title: "10. Hukum & Penyelesaian", icon: "bi-briefcase-fill", tag: "Yurisdiksi" },
    { id: "kontak-dukungan", title: "11. Kontak & Dukungan", icon: "bi-envelope-at-fill", tag: "Bantuan" },
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
      style={{ '--header-height': `${headerHeight}px` }}
    >
      <BaseHeader />

      {/* HERO SLOT ANCHOR PREVENTS LAYOUT SHIFT */}
      <div 
        className="terms-hero-slot"
        style={{ '--header-height': `${headerHeight}px` }}
      >
        {/* COMPACT HERO HEADER WITH STICKY SCROLL BEHAVIOR */}
        <header className={`terms-hero ${isScrolled ? 'is-stuck' : ''}`} role="banner">
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
                  <span>Pedoman Tata Tertib & Akuntabilitas ASN</span>
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
                      Peraturan, hak, kewajiban, integritas akademik, dan standar etika digital pemanfaatan platform pembelajaran elektronik Sekretariat Jenderal Dewan Perwakilan Daerah RI.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Bar - High-Contrast Stat Pills */}
              <div className="terms-stats-row">
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
                    <i className="bi bi-bank2"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Dasar Hukum</span>
                    <strong className="stat-val">UU ASN & ITE RI</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-patch-check-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Kredensial</span>
                    <strong className="stat-val">E-Sertifikat Resmi</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-building-check"></i>
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
      <main className="terms-main-container">
        {/* Geometric Grid & Luminous Glow Pattern matching About section */}
        <div className="terms-background-pattern" aria-hidden="true"></div>

        <div className="container">
          <div className="row g-4 align-items-start">

            {/* LEFT COLUMN: STICKY TOC, KEY CONDUCT SUMMARY & ACTIONS */}
            <div className="col-lg-4 col-xl-3 terms-sidebar-col">
              <div className="terms-sidebar-sticky">

                {/* Search / Fast Filter */}
                <div 
                  className="terms-search-card"
                  title="Cari kata kunci (Akun, Integritas, Sertifikat, Larangan, Sanksi)..."
                >
                  <label htmlFor="terms-search" className="visually-hidden">Cari ketentuan penggunaan</label>
                  <div className="terms-search-input-wrap">
                    <i className="bi bi-search search-icon" aria-hidden="true"></i>
                    <input
                      id="terms-search"
                      type="text"
                      className="terms-search-input"
                      placeholder="Cari topik (Akun, Sertifikat, Larangan)..."
                      title="Cari kata kunci (Akun, Integritas, Sertifikat, Larangan, Sanksi)..."
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
                  {/* Tooltip visible on hover over terms-search-card */}
                  <div className="terms-search-tooltip" role="tooltip">
                    <i className="bi bi-info-circle-fill me-1 text-teal"></i>
                    <span>Cari kata kunci (Akun, Integritas, Sertifikat, Larangan, Sanksi)...</span>
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
                        {/* Custom floating tooltip for full text when truncated */}
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
                    <span>Prinsip Utama ASN</span>
                  </div>
                  <ul className="summary-list">
                    <li>
                      <i className="bi bi-person-check-fill text-teal" aria-hidden="true"></i>
                      <span>Akun bersifat personal kedinasan dan dilarang dialihkan atau dipinjamkan.</span>
                    </li>
                    <li>
                      <i className="bi bi-award-fill text-teal" aria-hidden="true"></i>
                      <span>Sertifikat digital diterbitkan atas nama penyelesai modul yang sah.</span>
                    </li>
                    <li>
                      <i className="bi bi-exclamation-triangle-fill text-danger" aria-hidden="true"></i>
                      <span>Kecurangan pengerjaan evaluasi berakibat pembatalan sertifikat kelulusan.</span>
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
                className={`policy-card ${!isMatch("penerimaan ketentuan akses setuju terikat aturan") ? "search-dim" : ""}`}
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
                    Dengan mengakses, mendaftar, atau menggunakan platform <strong>LMSetjen DPD RI</strong>, Anda menyatakan bahwa Anda telah membaca, memahami, dan menyetujui untuk terikat secara hukum oleh seluruh syarat, ketentuan, serta panduan operasional yang tercantum di dalam dokumen ini.
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
                        <span>Seluruh ASN, PPPK, dan tenaga pendukung resmi di lingkungan Sekretariat Jenderal DPD RI.</span>
                      </div>
                    </div>

                    <div className="scope-card">
                      <div className="scope-icon-wrap bg-indigo-subtle">
                        <i className="bi bi-mortarboard-fill text-primary"></i>
                      </div>
                      <div className="scope-content">
                        <strong>Pengembangan Kompetensi SDM</strong>
                        <span>Pelatihan teknis, kepemimpinan, kepatuhan hukum, manajerial, dan transformasi digital kelembagaan.</span>
                      </div>
                    </div>

                    <div className="scope-card scope-card-span2">
                      <div className="scope-icon-wrap bg-success-subtle">
                        <i className="bi bi-shield-check text-success"></i>
                      </div>
                      <div className="scope-content">
                        <strong>Aktivitas Sah & Taat Regulasi</strong>
                        <span>Seluruh kegiatan belajar mengajar wajib tunduk pada peraturan perundang-undangan aparatur sipil negara dan kode etik Setjen DPD RI. Penggunaan untuk tujuan komersial di luar dinas dilarang keras.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 3: AKUN PENGGUNA */}
              <article 
                id="akun-pengguna" 
                className={`policy-card ${!isMatch("akun kredensial sso nip login tanggung jawab sandi") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-person-badge"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 3</span>
                    <h2 className="policy-card-title">Akun Pengguna & Tanggung Jawab Kredensial</h2>
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
                        <strong>Keakuratan Identitas</strong>
                        <span>Wajib mencantumkan NIP, nama lengkap, dan data unit kerja yang valid saat sinkronisasi profil SSO.</span>
                      </div>
                    </div>

                    <div className="checklist-card">
                      <div className="checklist-icon"><i className="bi bi-check2"></i></div>
                      <div className="checklist-content">
                        <strong>Kerahasiaan Kredensial</strong>
                        <span>Dilarang membagikan sandi, token autentikasi, atau sesi login Nusa DPD/Google kepada pihak manapun.</span>
                      </div>
                    </div>

                    <div className="checklist-card">
                      <div className="checklist-icon"><i className="bi bi-check2"></i></div>
                      <div className="checklist-content">
                        <strong>Pelaporan Anomali Keamanan</strong>
                        <span>Wajib segera melapor ke helpdesk BPSDM jika mencurigai adanya akses tanpa izin atau pembajakan akun.</span>
                      </div>
                    </div>

                    <div className="checklist-card">
                      <div className="checklist-icon"><i className="bi bi-check2"></i></div>
                      <div className="checklist-content">
                        <strong>Kepatuhan Tata Tertib</strong>
                        <span>Mematuhi etika diskusi daring pada forum tanya-jawab serta ruang kolaborasi bersama instruktur.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 4: KONTEN DAN KURSUS */}
              <article 
                id="konten-kursus" 
                className={`policy-card ${!isMatch("konten materi kursus hak cipta bpsdm modul video") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-journal-bookmark"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 4</span>
                    <h2 className="policy-card-title">Konten dan Materi Pembelajaran</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Semua materi pelatihan, bahan ajar, video rekaman, kurikulum SCORM 1.2, modul H5P, panduan PDF, serta soal evaluasi yang dimuat di dalam LMSetjen DPD RI adalah milik eksklusif <strong>BPSDM Biro OKK Setjen DPD RI</strong> atau mitra penyedia konten resmi yang ditunjuk.
                  </p>

                  <div className="license-box">
                    <div className="license-badge-col">
                      <i className="bi bi-file-earmark-lock-fill license-icon" aria-hidden="true"></i>
                      <span>Lisensi Internal</span>
                    </div>
                    <div className="license-text-col">
                      <strong>Ketentuan Lisensi Hak Akses:</strong>
                      <p className="mb-0">
                        Anda diberikan izin terbatas, non-eksklusif, dan tidak dapat dipindahtangankan untuk mengakses materi semata-mata demi pembelajaran pribadi kedinasan. Dilarang mendistribusikan, mempublikasikan ulang, mengunggah ke platform publik, atau mengkomersialkannya tanpa izin tertulis Sekretariat Jenderal DPD RI.
                      </p>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 5: SERTIFIKAT DAN KREDENSIAL */}
              <article 
                id="sertifikat-digital" 
                className={`policy-card ${!isMatch("sertifikat digital kredensial kelulusan qr code pembatalan kecurangan") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-patch-check-fill"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 5</span>
                    <h2 className="policy-card-title">Sertifikat Digital & Kredensial</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p className="section-intro">
                    Sertifikat digital diterbitkan secara otomatis oleh sistem setelah peserta menuntaskan seluruh syarat kelulusan kursus:
                  </p>

                  <div className="cert-features-row">
                    <div className="cert-feature-card">
                      <i className="bi bi-qr-code cert-feat-icon text-teal" aria-hidden="true"></i>
                      <h4>Verifikasi QR Code Resmi</h4>
                      <p>Setiap e-sertifikat dilengkapi identitas registrasi unik yang dapat divalidasi keasliannya secara daring melalui fitur verifikasi sertifikat.</p>
                    </div>

                    <div className="cert-feature-card">
                      <i className="bi bi-award cert-feat-icon text-teal" aria-hidden="true"></i>
                      <h4>Bukti Kelulusan Pembelajaran</h4>
                      <p>Sertifikat berfungsi sebagai dokumentasi pemenuhan jam diklat pegawai dan bukti keikutsertaan program peningkatan kompetensi aparatur.</p>
                    </div>

                    <div className="cert-feature-card">
                      <i className="bi bi-shield-x cert-feat-icon text-danger" aria-hidden="true"></i>
                      <h4>Klausul Pembatalan Hak</h4>
                      <p>BPSDM berhak membatalkan atau mencabut sertifikat jika di kemudian hari ditemukan kecurangan, joki pengerjaan, atau pelanggaran etika.</p>
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
                    Layanan LMSetjen DPD RI disediakan dengan prinsip <em>"as is"</em> (sebagaimana adanya) dan <em>"as available"</em> (sebagaimana tersedia). Meskipun Kami berupaya maksimal menjaga keandalan infrastruktur 24/7, Kami tidak bertanggung jawab atas:
                  </p>

                  <div className="liability-grid">
                    <div className="liability-pill">
                      <i className="bi bi-wifi-off text-muted me-2" aria-hidden="true"></i>
                      <span>Gangguan koneksi internet lokal atau kegagalan perangkat pengguna</span>
                    </div>
                    <div className="liability-pill">
                      <i className="bi bi-tools text-muted me-2" aria-hidden="true"></i>
                      <span>Waktu pemeliharaan terjadwal (*maintenance downtime*) yang telah diumumkan</span>
                    </div>
                    <div className="liability-pill">
                      <i className="bi bi-cloud-slash text-muted me-2" aria-hidden="true"></i>
                      <span>Kehilangan progres akibat penutupan peramban sebelum sinkronisasi otomatis selesai</span>
                    </div>
                    <div className="liability-pill">
                      <i className="bi bi-lightning-charge text-muted me-2" aria-hidden="true"></i>
                      <span>Kondisi kahar (*force majeure*) yang berada di luar kendali teknis kelembagaan</span>
                    </div>
                  </div>
                </div>
              </article>

              {/* SECTION 7: MODIFIKASI DAN PENGHENTIAN */}
              <article 
                id="modifikasi-layanan" 
                className={`policy-card ${!isMatch("modifikasi layanan penghentian pembaruan kurikulum suspensi") ? "search-dim" : ""}`}
              >
                <div className="policy-card-header">
                  <div className="header-icon-wrap" aria-hidden="true">
                    <i className="bi bi-sliders"></i>
                  </div>
                  <div>
                    <span className="card-section-label">Bagian 7</span>
                    <h2 className="policy-card-title">Modifikasi & Penghentian Layanan</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    BPSDM Setjen DPD RI berhak untuk setiap saat memperbarui materi diklat, menambah fitur sistem baru, memodifikasi silabus, atau menangguhkan sementara kursus tertentu guna keperluan evaluasi mutu pendidikan.
                  </p>
                  <p className="mb-0">
                    Pengelola berhak menonaktifkan atau memblokir akses akun pengguna yang terbukti melanggar ketentuan tata tertib tanpa kewajiban memberikan ganti rugi dalam bentuk apapun.
                  </p>
                </div>
              </article>

              {/* SECTION 8: LARANGAN KEGIATAN */}
              <article 
                id="larangan-kegiatan" 
                className={`policy-card ${!isMatch("larangan kegiatan bot otomatisasi hacking bypass scraping") ? "search-dim" : ""}`}
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
                    <strong>Ketentuan Mutlak:</strong> Pelanggaran terhadap larangan berikut dapat dikenakan sanksi disiplin ASN sesuai peraturan yang berlaku di lingkungan Setjen DPD RI.
                  </div>

                  <div className="prohibited-grid mt-3">
                    <div className="prohibited-card">
                      <div className="prohibited-icon"><i className="bi bi-robot"></i></div>
                      <div className="prohibited-text">
                        <strong>Bot & Otomasi Palsu</strong>
                        <span>Dilarang menggunakan bot, web spider, skrip auto-watch, atau alat pemalsu durasi belajar.</span>
                      </div>
                    </div>

                    <div className="prohibited-card">
                      <div className="prohibited-icon"><i className="bi bi-shield-slash-fill"></i></div>
                      <div className="prohibited-text">
                        <strong>Akses Tidak Sah & Bypass</strong>
                        <span>Dilarang mencoba menembus celah keamanan, SQL injection, manipulasi nilai kuis, atau bypass akses role admin.</span>
                      </div>
                    </div>

                    <div className="prohibited-card">
                      <div className="prohibited-icon"><i className="bi bi-share-fill"></i></div>
                      <div className="prohibited-text">
                        <strong>Bagi Pakai Akun (Joki Belajar)</strong>
                        <span>Dilarang menyerahkan pengerjaan materi atau ujian kompetensi kepada pihak lain atas nama peserta.</span>
                      </div>
                    </div>

                    <div className="prohibited-card">
                      <div className="prohibited-icon"><i className="bi bi-bug-fill"></i></div>
                      <div className="prohibited-text">
                        <strong>Eksploitasi & Gangguan Sistem</strong>
                        <span>Dilarang menyebarkan konten berbahaya, malware, atau melakukan serangan DoS terhadap server LMS.</span>
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
                    Seluruh elemen visual, lambang kelembagaan DPD RI, logo aplikasi LMSetjen DPD RI, struktur antarmuka piranti lunak (*source code* & *UI layout*), serta aset digital yang terdapat pada platform ini dilindungi oleh Undang-Undang Republik Indonesia Nomor 28 Tahun 2014 tentang Hak Cipta.
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
                    Ketentuan Penggunaan ini diatur dan ditafsirkan berdasarkan hukum Negara Kesatuan Republik Indonesia serta ketentuan kedinasan Sekretariat Jenderal DPD RI.
                  </p>
                  <div className="dispute-steps-box">
                    <div className="dispute-step">
                      <span className="dispute-step-num">Tahap 1</span>
                      <strong>Musyawarah Internal</strong>
                      <span>Segala kesalahpahaman atau perbedaan penafsiran diselesaikan terlebih dahulu melalui musyawarah kekeluargaan di bawah koordinasi BPSDM Biro OKK.</span>
                    </div>
                    <div className="dispute-step">
                      <span className="dispute-step-num">Tahap 2</span>
                      <strong>Regulasi Disiplin Pegawai</strong>
                      <span>Apabila menyangkut integritas dinas, penyelesaian tunduk pada Peraturan Disiplin Pegawai Negeri Sipil yang berlaku.</span>
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
                    <h2 className="policy-card-title">Kontak & Layanan Dukungan</h2>
                  </div>
                </div>
                <div className="policy-card-body">
                  <p>
                    Jika Anda memiliki pertanyaan seputar syarat dan ketentuan, kendala akun dinas, atau ingin mengonfirmasi validitas sertifikat pelatihan, silakan hubungi saluran resmi berikut:
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
