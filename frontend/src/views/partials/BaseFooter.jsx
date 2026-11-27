import React, { memo } from "react";
import { Link } from "react-router-dom";
import Toast from "../plugin/Toast";
import "./BaseFooter.css";
import { APP_VERSION } from "../../utils/version";
import useSystemVersion, { openUpdateLogModal } from "../../hooks/useSystemVersion";

// Import institution logos (optimized WebP with PNG fallback)
import logoSetjenWebP from "../../assets/logo/logo-setjen-dpd.webp";
import logoSetjenPNG from "../../assets/logo/logo-setjen-dpd.png";
import logoOkkWebP from "../../assets/logo/logo-okk.webp";
import logoOkkPNG from "../../assets/logo/logo-okk.png";
import logoBpsdmWebP from "../../assets/logo/logo-bpsdm.webp";
import logoBpsdmPNG from "../../assets/logo/logo-bpsdm.png";

function BaseFooter() {
  const currentYear = new Date().getFullYear();
  const { version } = useSystemVersion();

  const handleComingSoon = (e) => {
    e.preventDefault();
    Toast().fire({
      title: "Akan segera datang",
      icon: "info",
      timer: 3500
    });
  };

  const config = {
    brand: {
      name: "LMSetjen DPD RI",
      description: "Platform e-learning Biro Organisasi Keanggotaan dan Kepegawaian (OKK) Setjen DPD RI untuk pelatihan digital & pengembangan kompetensi aparatur sipil negara terpadu.",
      copyright: `©${currentYear} Biro OKK Setjen DPD RI`,
      version: `${version || APP_VERSION}`
    },
    contact: {
      email: "sdm@dpd.go.id",
      phone: "(+62) 853 1586 9799",
      address: "Setjen DPD RI Senayan, Jakarta"
    }
  };

  return (
    <footer role="contentinfo" className="base-footer">
      {/* Decorative Top Accent Glow Bar */}
      <div className="footer-top-accent" aria-hidden="true" />

      <div className="container footer-container">
        <div className="base-footer-main">
          {/* 1. Brand & Collaboration Pillar */}
          <div className="base-footer-brand-col">
            <Link to="/" className="footer-brand-link" title="Beranda LMSetjen DPD RI">
              <span className="footer-brand-title">{config.brand.name}</span>
              <span
                className="footer-brand-version"
                title="Versi Aplikasi - Klik untuk melihat Update Log"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openUpdateLogModal();
                }}
                style={{ cursor: "pointer" }}
              >
                v{config.brand.version}
              </span>
            </Link>

            <p className="footer-brand-description">
              {config.brand.description}
            </p>

            {/* Institution Logos in a compact frosted badge */}
            <div className="footer-institution-strip" aria-label="Instansi Penyelenggara">
              <div className="footer-institution-logos">
                <div className="footer-institution-logo-item" title="Sekretariat Jenderal DPD RI">
                  <picture>
                    <source srcSet={logoSetjenWebP} type="image/webp" />
                    <img
                      src={logoSetjenPNG}
                      alt="Logo Setjen DPD RI"
                      className="footer-institution-logo-img"
                      height="26"
                      width="29"
                      loading="lazy"
                      decoding="async"
                    />
                  </picture>
                </div>
                <div className="footer-institution-logo-item" title="Biro Organisasi, Keanggotaan, & Kepegawaian (OKK)">
                  <picture>
                    <source srcSet={logoOkkWebP} type="image/webp" />
                    <img
                      src={logoOkkPNG}
                      alt="Logo Biro OKK Setjen DPD RI"
                      className="footer-institution-logo-img footer-institution-logo-okk"
                      height="23"
                      width="45"
                      loading="lazy"
                      decoding="async"
                    />
                  </picture>
                </div>
                <div className="footer-institution-logo-item" title="Biro Organisasi Keanggotaan dan Kepegawaian (Biro OKK)">
                  <picture>
                    <source srcSet={logoBpsdmWebP} type="image/webp" />
                    <img
                      src={logoBpsdmPNG}
                      alt="Logo Biro OKK Setjen DPD RI"
                      className="footer-institution-logo-img"
                      height="26"
                      width="23"
                      loading="lazy"
                      decoding="async"
                    />
                  </picture>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Navigation Columns: Instansi & Dukungan */}
          <div className="base-footer-nav-group">
            {/* Instansi Links */}
            <div className="base-footer-nav-col">
              <h5 className="footer-section-title">
                <span className="footer-title-bar" aria-hidden="true" />
                Instansi
              </h5>
              <ul className="footer-section-list">
                <li><Link to="/tentang/" className="footer-link">Tentang Kami</Link></li>
                <li><Link to="/capaian/" className="footer-link">Capaian</Link></li>
                <li><Link to="/contact/" className="footer-link">Kontak</Link></li>
              </ul>
            </div>

            {/* Dukungan Links */}
            <div className="base-footer-nav-col">
              <h5 className="footer-section-title">
                <span className="footer-title-bar" aria-hidden="true" />
                Dukungan
              </h5>
              <ul className="footer-section-list">
                <li><Link to="/certificate/verify/" className="footer-link">Cek & Validasi Sertifikat</Link></li>
                <li><Link to="/user-guide/" className="footer-link">Panduan Pengguna</Link></li>
                <li><Link to="/contact/" className="footer-link">Menjadi Instruktur</Link></li>
                <li>
                  <a href="#" className="footer-link footer-link-badge-wrap" onClick={handleComingSoon}>
                    <span>Dapatkan Aplikasi</span>
                    <span className="footer-mini-chip">Segera</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* 3. Contact & Social Pillar */}
          <div className="base-footer-contact-col">
            <h5 className="footer-section-title">
              <span className="footer-title-bar" aria-hidden="true" />
              Hubungi Kami
            </h5>
            <div className="footer-contact-card">
              <div className="footer-contact-item">
                <div className="footer-contact-icon-box" aria-hidden="true">
                  <i className="fas fa-map-marker-alt"></i>
                </div>
                <span className="footer-contact-text">{config.contact.address}</span>
              </div>
              <div className="footer-contact-item">
                <div className="footer-contact-icon-box" aria-hidden="true">
                  <i className="fas fa-envelope"></i>
                </div>
                <a href={`mailto:${config.contact.email}`} className="footer-contact-link" title="Kirim email ke Biro OKK">
                  {config.contact.email}
                </a>
              </div>
              <div className="footer-contact-item">
                <div className="footer-contact-icon-box" aria-hidden="true">
                  <i className="fas fa-phone-alt"></i>
                </div>
                <a href="tel:+6285315869799" className="footer-contact-link" title="Hubungi melalui telepon">
                  {config.contact.phone}
                </a>
              </div>
            </div>

            {/* Social Media Strip */}
            <div className="footer-social-wrap">
              <span className="footer-social-label">Jejaring:</span>
              <div className="footer-social-links">
                <a
                  href="https://www.facebook.com/khairilazmiashari"
                  className="footer-social-btn facebook"
                  title="Facebook"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z" />
                  </svg>
                </a>
                <a
                  href="https://x.com/KhaAzAs"
                  className="footer-social-btn twitter"
                  title="Twitter / X"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter / X"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334 0-.14 0-.282-.006-.422A6.685 6.685 0 0 0 16 3.542a6.658 6.658 0 0 1-1.889.518 3.301 3.301 0 0 0 1.447-1.817 6.533 6.533 0 0 1-2.087.793A3.286 3.286 0 0 0 7.875 6.03a9.325 9.325 0 0 1-6.767-3.429 3.289 3.289 0 0 0 1.018 4.382A3.323 3.323 0 0 1 .64 6.575v.045a3.288 3.288 0 0 0 2.632 3.218 3.203 3.203 0 0 1-.865.115 3.23 3.23 0 0 1-.614-.057 3.283 3.283 0 0 0 3.067 2.277A6.588 6.588 0 0 1 .78 13.58a6.32 6.32 0 0 1-.78-.045A9.344 9.344 0 0 0 5.026 15z" />
                  </svg>
                </a>
                <a
                  href="https://github.com/khaz-dev"
                  className="footer-social-btn github"
                  title="GitHub"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Bottom Compact Legal & Copyright Bar */}
        <div className="footer-bottom-bar">
          <div className="footer-bottom-content">
            <div className="footer-copyright">
              <span>{config.brand.copyright}</span>
              <span className="footer-separator" aria-hidden="true">·</span>
              <span className="footer-rights">Hak Cipta Dilindungi</span>
            </div>

            <nav className="footer-legal-nav" aria-label="Kebijakan & Ketentuan">
              <Link to="/privacy-policy/" className="footer-legal-link">Kebijakan Privasi</Link>
              <span className="footer-separator" aria-hidden="true">·</span>
              <Link to="/terms-and-conditions/" className="footer-legal-link">Syarat & Ketentuan</Link>
              <span className="footer-separator" aria-hidden="true">·</span>
              <Link to="/cookie-policy/" className="footer-legal-link">Informasi Cookie</Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default memo(BaseFooter);
