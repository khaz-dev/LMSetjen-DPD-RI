import React, { memo } from "react"
import { Link } from "react-router-dom"
import Toast from "../plugin/Toast"
import "./BaseFooter.css"
import { APP_VERSION } from "../../utils/version";

function BaseFooter() {
  const currentYear = new Date().getFullYear();

  const handleComingSoon = (e) => {
    e.preventDefault();
    Toast().fire({
      title: "Akan segera datang",
      icon: "info",
      timer: 5174
    });
  };

  // Configuration data for easy maintenance
  const config = {
    brand: {
      name: "LMSetjen DPD RI",
      description: "Platform e-learning berbasis LMS yang dikembangkan oleh BPSDM OKK untuk mendukung pelatihan digital pegawai dan anggota Setjen DPD RI.",
      copyright: `© ${currentYear} BPSDM | OKK | Setjen DPD RI`,
      version: `v${APP_VERSION}`
    },
    contact: {
      email: "sdm@dpd.go.id",
      phone: "(+62) 853 1586 9799",
      address: "Setjen DPD RI Senayan, Indonesia"
    }
  };

  return (
    <footer 
      role="contentinfo"
      className="base-footer"
    >
      <div className="container">
        <div className="row">
          {/* Brand Section */}
          <div className="col-lg-4 col-md-6 col-12">
            <div className="mb-4">
              <Link to="/" className="footer-brand-title fw-bold mb-3">
                {config.brand.name}
              </Link>
              <div className="mt-3">
                <p className="footer-brand-description text-muted mb-4">
                  {config.brand.description}
                </p>
              </div>
            </div>
          </div>

          {/* Institution Links */}
          <div className="offset-lg-1 col-lg-2 col-md-3 col-6">
            <div className="mb-4">
              <h5 className="footer-section-title fw-bold mb-3">Instansi</h5>
              <ul className="footer-section-list list-unstyled">
                <li className="mb-2"><a href="/tentang/" className="footer-link">Tentang</a></li>
                <li className="mb-2"><a href="/capaian/" className="footer-link">Capaian</a></li>
                <li className="mb-2"><a href="/contact/" className="footer-link">Kontak</a></li>
              </ul>
            </div>
          </div>

          {/* Support Links */}
          <div className="col-lg-2 col-md-3 col-6">
            <div className="mb-4">
              <h5 className="footer-section-title fw-bold mb-3">Dukungan</h5>
              <ul className="footer-section-list list-unstyled">
                <li className="mb-2"><Link to="/user-guide/" className="footer-link">Bantuan dan Dukungan</Link></li>
                <li className="mb-2"><Link to="/contact/" className="footer-link">Menjadi Pemateri</Link></li>
                <li className="mb-2"><a href="#" className="footer-link" onClick={handleComingSoon}>Dapatkan Aplikasi</a></li>
              </ul>
            </div>
          </div>

          {/* Contact Information */}
          <div className="col-lg-3 col-md-12">
            <div className="mb-4">
              <h5 className="footer-section-title fw-bold mb-3">Hubungi Kami</h5>
              <div className="contact-info d-flex flex-column gap-2">
                <p className="mb-2 contact-item align-items-start">
                  <i className="fas fa-map-marker-alt contact-icon me-2 mt-1"></i>
                  <span className="contact-text">{config.contact.address}</span>
                </p>
                <p className="mb-2 contact-item align-items-center">
                  <i className="fas fa-envelope contact-icon me-2"></i>
                  <a href={`mailto:${config.contact.email}`} className="footer-link contact-link">
                    {config.contact.email}
                  </a>
                </p>
                <p className="mb-0 contact-item align-items-center">
                  <i className="fas fa-phone contact-icon me-2"></i>
                  <span className="contact-text">{config.contact.phone}</span>
                </p>
                {/* Social Media Icons */}
                <div className="social-links d-flex gap-3 mt-3">
                  <a href="https://www.facebook.com/khairilazmiashari" className="social-link facebook" title="Facebook" target="_blank" rel="noopener noreferrer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z" />
                    </svg>
                  </a>
                  <a href="https://x.com/KhaAzAs" className="social-link twitter" title="Twitter" target="_blank" rel="noopener noreferrer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334 0-.14 0-.282-.006-.422A6.685 6.685 0 0 0 16 3.542a6.658 6.658 0 0 1-1.889.518 3.301 3.301 0 0 0 1.447-1.817 6.533 6.533 0 0 1-2.087.793A3.286 3.286 0 0 0 7.875 6.03a9.325 9.325 0 0 1-6.767-3.429 3.289 3.289 0 0 0 1.018 4.382A3.323 3.323 0 0 1 .64 6.575v.045a3.288 3.288 0 0 0 2.632 3.218 3.203 3.203 0 0 1-.865.115 3.23 3.23 0 0 1-.614-.057 3.283 3.283 0 0 0 3.067 2.277A6.588 6.588 0 0 1 .78 13.58a6.32 6.32 0 0 1-.78-.045A9.344 9.344 0 0 0 5.026 15z" />
                    </svg>
                  </a>
                  <a href="https://github.com/khaz-dev" className="social-link github" title="GitHub" target="_blank" rel="noopener noreferrer">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom Section */}
        <div className="row align-items-center pt-4 footer-bottom">
          {/* Copyright */}
          <div className="col-md-6 col-12 text-center text-md-start">
            <span className="footer-copyright">{config.brand.copyright} {config.brand.version}</span>
          </div>
          
          {/* Legal Links */}
          <div className="col-md-6 col-12 text-center text-md-end">
            <div className="footer-legal-links d-flex justify-content-center justify-content-md-end flex-wrap gap-3">
              <a href="/privacy-policy/" className="footer-link footer-link-sm">Kebijakan Privasi</a>
              <a href="/cookie-policy/" className="footer-link footer-link-sm">Informasi Cookie</a>
              <a href="/terms-and-conditions/" className="footer-link footer-link-sm d-none d-lg-inline">Ketentuan Penggunaan</a>
              <a href="/terms-and-conditions/" className="footer-link footer-link-sm">Syarat & Ketentuan</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default memo(BaseFooter)
