import React, { memo } from "react";
import { Link } from "react-router-dom";
import { APP_VERSION } from "../../utils/version";
import "./Footer.css";

function Footer() {
  const currentYear = new Date().getFullYear();

  // Content configuration - text only
  const content = {
    brand: {
      name: "LMSetjen DPD RI",
      copyright: `© ${currentYear} BPSDM | OKK | Setjen DPD RI`,
      version: `v${APP_VERSION}`
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
    <footer className="footer-wrapper">
      <div className="container">
        <div className="footer-content-row">
          {/* Brand Section */}
          <div className="footer-brand-section">
            <Link to="/" className="footer-brand-name">{content.brand.name}</Link>{" "}
            <small className="footer-brand-copyright">{content.brand.copyright}</small>
            <small className="footer-brand-version ms-2 text-muted">{content.brand.version}</small>
          </div>

          {/* Quick Links Section */}
          <div className="footer-links-section">
            {content.links.map((link, index) => (
              <a
                key={index}
                href={link.url}
                className="footer-quick-link"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Contact Section */}
          <div className="footer-contact-section">
            <i className="fas fa-envelope footer-contact-icon"></i>
            <a
              href={`mailto:${content.contact.email}`}
              className="footer-contact-email"
            >
              {content.contact.email}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default memo(Footer);
