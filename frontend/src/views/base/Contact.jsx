import React, { memo, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import logoSetjenWebP from "../../assets/logo/logo-setjen-dpd.webp";
import logoSetjenPNG from "../../assets/logo/logo-setjen-dpd.png";
import useStickyHero from "../../hooks/useStickyHero";
import "./Contact.css";

function Contact() {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [openFaq, setOpenFaq] = useState({ 0: true, 1: false, 2: false, 3: false });
  const [inquiryTopic, setInquiryTopic] = useState("Kendala Login SSO & Akun");
  const [inquiryNotes, setInquiryNotes] = useState("");
  const { isScrolled, headerHeight } = useStickyHero(55);

  // Ensure body background is properly tinted for silhouette layer
  React.useEffect(() => {
    const originalBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#f1f5f9";
    return () => {
      document.body.style.backgroundColor = originalBg;
    };
  }, []);

  // FAQ List
  const faqs = useMemo(() => [
    {
      q: "Bagaimana cara mendaftar akun di LMSetjen DPD RI?",
      a: "Akun Anda terintegrasi secara otomatis saat pertama kali masuk menggunakan SSO Nusa DPD atau Google Workspace resmi Sekretariat Jenderal DPD RI. Anda tidak perlu melakukan registrasi mandiri.",
      tag: "Akun & Akses"
    },
    {
      q: "Berapa lama e-sertifikat diterbitkan setelah kursus selesai?",
      a: "Sertifikat digital diterbitkan secara instan dan otomatis begitu Anda menyelesaikan seluruh modul dan mencapai batas nilai kelulusan kuis. Sertifikat dapat langsung diunduh dari dashboard Anda dengan QR Code verifikasi.",
      tag: "Sertifikat"
    },
    {
      q: "Bagaimana cara berkonsultasi dengan instruktur kursus?",
      a: "Gunakan fitur forum 'Q&A' yang tersedia pada setiap halaman modul kursus untuk mengajukan pertanyaan teknis maupun materi. Instruktur kami biasanya memberikan tanggapan dalam 1x24 jam kerja.",
      tag: "Pembelajaran"
    },
    {
      q: "Bagaimana jika data profil (NIP/Nama/Unit Kerja) tidak sesuai?",
      a: "Silakan kirimkan laporan perbaikan data melalui email sdm@dpd.go.id dengan menyertakan bukti NIP dan unit kerja saat ini agar dapat disinkronkan kembali dengan basis data kepegawaian Biro OKK.",
      tag: "Data Pegawai"
    }
  ], []);

  // Copy email helper
  const handleCopyEmail = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText("sdm@dpd.go.id").then(() => {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2500);
      });
    }
  };

  // Toggle FAQ accordion
  const toggleFaq = (index) => {
    setOpenFaq((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // Compose email link helper
  const mailtoHref = `mailto:sdm@dpd.go.id?subject=${encodeURIComponent(`[LMSetjen DPD RI] ${inquiryTopic}`)}${inquiryNotes ? `&body=${encodeURIComponent(inquiryNotes)}` : ""}`;

  return (
    <div 
      className="contact-page-wrapper"
      style={{ '--header-height': `${headerHeight}px` }}
    >
      <BaseHeader />

      {/* HERO SLOT ANCHOR PREVENTS LAYOUT SHIFT */}
      <div 
        className="contact-hero-slot"
        style={{ '--header-height': `${headerHeight}px` }}
      >
        {/* COMPACT HERO HEADER WITH STICKY SCROLL BEHAVIOR */}
        <header className={`contact-hero ${isScrolled ? 'is-stuck' : ''}`} role="banner">
          <div className="container">
            <div className="contact-hero-content">
              {/* Breadcrumb & Top badge */}
              <div className="contact-hero-top">
                <nav aria-label="breadcrumb" className="contact-breadcrumb">
                  <Link to="/" className="breadcrumb-link">
                    <i className="bi bi-house-door-fill me-1" aria-hidden="true"></i> Beranda
                  </Link>
                  <span className="breadcrumb-separator">/</span>
                  <span className="breadcrumb-current">Hubungi Kami</span>
                </nav>
                <span className="contact-badge">
                  <span className="badge-pulse" aria-hidden="true"></span>
                  <span>Layanan Bantuan Resmi BPSDM Setjen DPD RI</span>
                </span>
              </div>

              {/* Title & Concise Summary */}
              <div className="contact-hero-main">
                <div className="contact-hero-title-area">
                  <div className="contact-hero-icon-bubble" aria-hidden="true">
                    <i className="bi bi-headset"></i>
                  </div>
                  <div>
                    <h1 className="contact-hero-title">Hubungi Kami & Layanan Dukungan</h1>
                    <p className="contact-hero-subtitle">
                      Pusat layanan informasi, bantuan teknis kendala pembelajaran, konsultasi kurikulum diklat, dan pengaduan aparatur di lingkungan Sekretariat Jenderal DPD RI.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Bar - High-Contrast Stat Pills */}
              <div className="contact-stats-row">
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-lightning-charge-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Respon Cepat</span>
                    <strong className="stat-val">1×24 Jam Kerja</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-envelope-check-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Surel Resmi</span>
                    <strong className="stat-val">sdm@dpd.go.id</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-geo-alt-fill"></i>
                  </span>
                  <div className="stat-pill-text">
                    <span className="stat-label">Gedung B Lt. 4</span>
                    <strong className="stat-val">Senayan, Jakarta</strong>
                  </div>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-icon-box" aria-hidden="true">
                    <i className="bi bi-person-workspace"></i>
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
      <main className="contact-main-container">
        {/* Geometric Grid & Luminous Glow Pattern matching About section */}
        <div className="contact-background-pattern" aria-hidden="true"></div>

        <div className="container">
          <div className="row g-4 align-items-start">

            {/* LEFT COLUMN: INFORMASI KONTAK & DETAIL RESMI */}
            <div className="col-lg-5 col-xl-5 contact-sidebar-col">
              <div className="contact-info-card">
                <div className="info-card-header">
                  <div className="header-icon-box" aria-hidden="true">
                    <i className="bi bi-building-check"></i>
                  </div>
                  <div>
                    <span className="card-kicker">Sekretariat Jenderal DPD RI</span>
                    <h2 className="info-card-title">Saluran Kontak Resmi</h2>
                  </div>
                </div>

                <div className="info-channels-list">
                  {/* Channel 1: Email */}
                  <div className="channel-box">
                    <div className="channel-icon-wrap bg-teal-subtle text-teal">
                      <i className="bi bi-envelope-at-fill" aria-hidden="true"></i>
                    </div>
                    <div className="channel-content">
                      <span className="channel-label">Surel Layanan BPSDM</span>
                      <div className="channel-action-row">
                        <a href="mailto:sdm@dpd.go.id" className="channel-value email-hover">
                          sdm@dpd.go.id
                        </a>
                        <button
                          type="button"
                          className="btn-pill-copy"
                          onClick={handleCopyEmail}
                          title="Salin alamat email"
                        >
                          <i className={`bi ${copiedEmail ? "bi-check-lg text-success" : "bi-files"}`} aria-hidden="true"></i>
                          <span>{copiedEmail ? "Tersalin" : "Salin"}</span>
                        </button>
                      </div>
                      <small className="channel-meta text-muted">Ditanggapi pada hari kerja (Senin – Jumat)</small>
                    </div>
                  </div>

                  {/* Channel 2: Alamat Kantor */}
                  <div className="channel-box">
                    <div className="channel-icon-wrap bg-indigo-subtle text-primary">
                      <i className="bi bi-geo-alt-fill" aria-hidden="true"></i>
                    </div>
                    <div className="channel-content">
                      <span className="channel-label">Lokasi Kantor Fisik</span>
                      <strong className="channel-value">Gedung B Lantai 4 | Sekretariat Jenderal DPD RI</strong>
                      <p className="channel-address mb-1">
                        Kompleks Parlemen Senayan, Jl. Jenderal Gatot Subroto, Jakarta Pusat 10270
                      </p>
                      <a 
                        href="https://maps.google.com/?q=Kompleks+Parlemen+Senayan+Jakarta" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="channel-link-sm"
                      >
                        <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true"></i>
                        Buka Petunjuk Arah Peta
                      </a>
                    </div>
                  </div>

                  {/* Channel 3: Unit Kerja Pengelola */}
                  <div className="channel-box">
                    <div className="channel-icon-wrap bg-cyan-subtle text-info">
                      <i className="bi bi-diagram-3-fill" aria-hidden="true"></i>
                    </div>
                    <div className="channel-content">
                      <span className="channel-label">Unit Pengelola Kelembagaan</span>
                      <strong className="channel-value">Bagian Pengembangan Sumber Daya Manusia (BPSDM)</strong>
                      <p className="channel-meta-text mb-0">
                        Biro Organisasi, Keanggotaan, dan Kepegawaian (OKK)<br />
                        Deputi Bidang Administrasi | Setjen DPD RI
                      </p>
                    </div>
                  </div>

                  {/* Channel 4: Jam Operasional */}
                  <div className="channel-box">
                    <div className="channel-icon-wrap bg-amber-subtle text-warning">
                      <i className="bi bi-clock-history" aria-hidden="true"></i>
                    </div>
                    <div className="channel-content">
                      <span className="channel-label">Waktu Operasional Layanan</span>
                      <strong className="channel-value">Senin – Jumat: 08:00 – 16:00 WIB</strong>
                      <div className="schedule-pills mt-1">
                        <span className="schedule-pill online">
                          <span className="dot-live"></span>
                          Jam Kerja Aktif
                        </span>
                        <span className="schedule-pill muted">Sabtu, Minggu & Hari Libur Nasional Tutup</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Institutional Stamp Card */}
                <div className="contact-institution-seal">
                  <picture>
                    <source srcSet={logoSetjenWebP} type="image/webp" />
                    <img 
                      src={logoSetjenPNG} 
                      alt="Logo Setjen DPD RI" 
                      className="institution-emblem" 
                      width="38" 
                      height="38" 
                    />
                  </picture>
                  <div className="institution-meta">
                    <strong className="institution-name">Biro OKK Setjen DPD RI</strong>
                    <span className="institution-tagline">Komitmen Profesionalisme dan Integritas ASN</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: FAQ ACCORDION & DIRECT INQUIRY HELPER */}
            <div className="col-lg-7 col-xl-7 contact-content-col">

              {/* QUICK INQUIRY HELPER CARD */}
              <div className="contact-form-card">
                <div className="form-card-header">
                  <div className="header-icon-box" aria-hidden="true">
                    <i className="bi bi-send-check-fill"></i>
                  </div>
                  <div>
                    <span className="card-kicker">Layanan Cepat Terpadu</span>
                    <h2 className="form-card-title">Kirim Pertanyaan / Pengaduan Kendala</h2>
                  </div>
                </div>

                <div className="form-card-body">
                  <p className="form-intro">
                    Pilih kategori kendala Anda untuk membuat pesan resmi ke helpdesk BPSDM dengan format terstruktur:
                  </p>

                  <div className="inquiry-inputs-grid">
                    <div className="inquiry-field">
                      <label htmlFor="topic-select" className="inquiry-label">Kategori Topik Bantuan:</label>
                      <select 
                        id="topic-select"
                        className="form-select form-select-sm inquiry-select"
                        value={inquiryTopic}
                        onChange={(e) => setInquiryTopic(e.target.value)}
                      >
                        <option value="Kendala Login SSO & Akun">Kendala Login SSO & Akun Pegawai</option>
                        <option value="Klarifikasi E-Sertifikat & Nilai Kuis">Klarifikasi E-Sertifikat & Nilai Kuis</option>
                        <option value="Kendala Pemutaran Modul Video/SCORM">Kendala Pemutaran Modul Video / SCORM</option>
                        <option value="Pembaruan Data NIP / Profil ASN">Pembaruan Data NIP / Profil ASN</option>
                        <option value="Saran & Masukan Pengembangan LMS">Saran & Masukan Pengembangan LMS</option>
                        <option value="Pertanyaan Kurikulum & Diklat Lainnya">Pertanyaan Kurikulum & Diklat Lainnya</option>
                      </select>
                    </div>

                    <div className="inquiry-field">
                      <label htmlFor="notes-input" className="inquiry-label">Catatan Singkat / Nomor NIP (Opsional):</label>
                      <input 
                        id="notes-input"
                        type="text"
                        className="form-control form-control-sm inquiry-text"
                        placeholder="Contoh: NIP 19850101..., kendala tidak bisa buka modul 3..."
                        value={inquiryNotes}
                        onChange={(e) => setInquiryNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-card-footer mt-3">
                    <a 
                      href={mailtoHref}
                      className="btn-send-mail-client"
                      title="Buka aplikasi email untuk mengirim pesan"
                    >
                      <i className="bi bi-send-fill me-2" aria-hidden="true"></i>
                      Buka Pesan Email Otomatis
                    </a>
                    <button
                      type="button"
                      className="btn-copy-template"
                      onClick={handleCopyEmail}
                    >
                      <i className={`bi ${copiedEmail ? "bi-check-lg text-success" : "bi-files"} me-1`} aria-hidden="true"></i>
                      {copiedEmail ? "Email Tersalin" : "Salin Email"}
                    </button>
                  </div>
                </div>
              </div>

              {/* FAQ ACCORDION CARD (COMPACT & COLLAPSIBLE) */}
              <div className="contact-faq-card mt-4">
                <div className="faq-card-header">
                  <div className="header-icon-box" aria-hidden="true">
                    <i className="bi bi-question-circle-fill"></i>
                  </div>
                  <div>
                    <span className="card-kicker">Pusat Jawaban Cepat</span>
                    <h2 className="faq-card-title">Pertanyaan Umum (FAQ)</h2>
                  </div>
                </div>

                <div className="faq-accordion-list">
                  {faqs.map((faq, idx) => (
                    <div key={idx} className={`faq-row-item ${openFaq[idx] ? "is-open" : ""}`}>
                      <button
                        type="button"
                        className="faq-question-btn"
                        onClick={() => toggleFaq(idx)}
                        aria-expanded={openFaq[idx] ? "true" : "false"}
                      >
                        <span className="faq-q-text">
                          <i className="bi bi-patch-question-fill text-teal me-2" aria-hidden="true"></i>
                          {faq.q}
                        </span>
                        <span className="faq-toggle-icon" aria-hidden="true">
                          <i className={`bi ${openFaq[idx] ? "bi-chevron-up" : "bi-chevron-down"}`}></i>
                        </span>
                      </button>

                      {openFaq[idx] && (
                        <div className="faq-answer-pane">
                          <p className="faq-answer-text">{faq.a}</p>
                          <span className="faq-tag-badge">{faq.tag}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* HELP GUIDE TIP CALLOUT */}
              <div className="contact-tip-banner mt-4">
                <div className="tip-icon-wrap" aria-hidden="true">
                  <i className="bi bi-lightbulb-fill"></i>
                </div>
                <div className="tip-content">
                  <strong>Butuh Panduan Visual Lengkap?</strong>
                  <p className="mb-0">
                    Pelajari langkah-langkah belajar, penyelesaian kuis, serta unduh sertifikat melalui{" "}
                    <Link to="/user-guide/" className="tip-link">
                      Panduan Pengguna LMSetjen DPD RI <i className="bi bi-arrow-right-short" aria-hidden="true"></i>
                    </Link>
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default memo(Contact);
