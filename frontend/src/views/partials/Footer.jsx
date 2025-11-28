import React, { memo } from "react";
import "./Footer.css";

function Footer() {
  const currentYear = new Date().getFullYear();

  // Content configuration - text only
  const content = {
    brand: {
      name: "LMSetjen DPD RI",
      copyright: `© ${currentYear} BPSDM All rights reserved.`
    },
    contact: {
      email: "sdm@dpd.go.id"
    },
    links: [
      { name: "Kebijakan Privasi", url: "#" },
      { name: "Syarat & Ketentuan", url: "#" },
      { name: "Bantuan", url: "#" },
      { name: "Kontak", url: "#" }
    ]
  };

  return (
    <footer className="footer-wrapper">
      <div className="container">
        <div className="footer-content-row">
          {/* Brand Section */}
          <div className="footer-brand-section">
            <span className="footer-brand-name">{content.brand.name}</span> <small className="footer-brand-copyright">{content.brand.copyright}</small>
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
