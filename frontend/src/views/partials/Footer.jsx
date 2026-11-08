import React, { memo } from "react";
import { Link } from "react-router-dom";
import { APP_VERSION } from "../../utils/version";
import useSystemVersion, { openUpdateLogModal } from "../../hooks/useSystemVersion";
import logoSetjenWebP from "../../assets/logo/logo-setjen-dpd.webp";
import logoSetjenPNG from "../../assets/logo/logo-setjen-dpd.png";
import "./Footer.css";

function Footer() {
  const currentYear = new Date().getFullYear();
  const { version } = useSystemVersion();

  // Content configuration
  const content = {
    brand: {
      name: "LMSetjen DPD RI",
      copyright: `©${currentYear} BPSDM OKK Setjen DPD RI`,
      version: `v${version || APP_VERSION}`
    },
    contact: {
      email: "sdm@dpd.go.id"
    },
    links: [
      { name: "Kebijakan Privasi", url: "/privacy-policy/" },
      { name: "Syarat & Ketentuan", url: "/terms-and-conditions/" },
      { name: "Informasi Cookie", url: "/cookie-policy/" },
      { name: "Kontak", url: "/contact/" }
    ]
  };

  return (
    <footer className="footer-wrapper" role="contentinfo">
      {/* Decorative top accent glow bar */}
      <div className="footer-top-accent" aria-hidden="true" />

      <div className="footer-container">
        <div className="footer-content-row">
          {/* Brand & Identity Section */}
          <div className="footer-brand-section">
            <Link to="/" className="footer-brand-link" title="Beranda LMSetjen DPD RI">
              <span className="footer-brand-name">{content.brand.name}</span>
            </Link>
            <span className="footer-brand-divider" aria-hidden="true">·</span>
            <small className="footer-brand-copyright">{content.brand.copyright}</small>
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
              {content.brand.version}
            </span>
          </div>

          {/* Quick Links Section with subtle dot separators */}
          <nav className="footer-links-section" aria-label="Navigasi Bawah">
            {content.links.map((link, index) => (
              <React.Fragment key={link.url}>
                {index > 0 && (
                  <span className="footer-link-dot" aria-hidden="true">·</span>
                )}
                <Link
                  to={link.url}
                  className="footer-quick-link"
                >
                  {link.name}
                </Link>
              </React.Fragment>
            ))}
          </nav>

          {/* Contact & Support Section */}
          <div className="footer-contact-section">
            <a
              href={`mailto:${content.contact.email}`}
              className="footer-contact-pill"
              title="Kirim email ke BPSDM OKK Setjen DPD RI"
            >
              <span className="footer-contact-icon-wrapper">
                <i className="fas fa-envelope footer-contact-icon" aria-hidden="true"></i>
              </span>
              <span className="footer-contact-email">
                {content.contact.email}
              </span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default memo(Footer);

