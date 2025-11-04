import React, { memo } from 'react'

function BaseFooter() {
  const currentYear = new Date().getFullYear();

  // Configuration data for easy maintenance
  const config = {
    brand: {
      name: 'LMSetjen DPD RI',
      tagline: 'Platform e-learning BPSDM OKK untuk Setjen DPD RI',
      description: 'Platform e-learning berbasis LMS yang dikembangkan oleh BPSDM OKK untuk mendukung pelatihan digital pegawai dan anggota Setjen DPD RI.',
      copyright: `© ${currentYear} BPSDM All rights reserved.`
    },
    contact: {
      email: 'sdm@dpd.go.id',
      phone: '(+62) 853 1586 9799',
      address: 'Setjen DPD RI Senayan, Indonesia'
    },
    colors: {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#6c757d',
      light: '#f8f9fa',
      dark: '#343a40',
      border: '#e9ecef'
    }
  };

  return (
    <footer 
      role="contentinfo"
      className="pt-5 pb-4"
      style={{
        marginTop: '4rem',
        background: 'white',
        borderTop: `1px solid ${config.colors.border}`,
        boxShadow: '0 -4px 15px rgba(0, 0, 0, 0.08)'
      }}
    >
      <div className="container">
        <div className="row">
          <div className="col-lg-4 col-md-6 col-12">
            {/* about company */}
            <div className="mb-4">
              <h2 
                className="fw-bold mb-3"
                style={{
                  background: `linear-gradient(135deg, ${config.colors.primary} 0%, ${config.colors.secondary} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontSize: '1.75rem'
                }}
              >
                {config.brand.name}
              </h2>
              <div className="mt-3">
                <p className="text-muted mb-4" style={{ lineHeight: '1.6' }}>
                  {config.brand.description}
                </p>
                {/* social media */}
                <div className="d-flex gap-3">
                  {/*Facebook*/}
                  <a 
                    href="#" 
                    className="d-flex align-items-center justify-content-center"
                    style={{
                      width: '40px',
                      height: '40px',
                      background: 'white',
                      borderRadius: '10px',
                      border: `2px solid ${config.colors.border}`,
                      color: '#1877F2',
                      textDecoration: 'none',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(24, 119, 242, 0.3)';
                      e.target.style.borderColor = '#1877F2';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                      e.target.style.borderColor = config.colors.border;
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={18}
                      height={18}
                      fill="currentColor"
                      className="bi bi-facebook"
                      viewBox="0 0 16 16"
                    >
                      <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z" />
                    </svg>
                  </a>
                  {/*Twitter*/}
                  <a 
                    href="#" 
                    className="d-flex align-items-center justify-content-center"
                    style={{
                      width: '40px',
                      height: '40px',
                      background: 'white',
                      borderRadius: '10px',
                      border: `2px solid ${config.colors.border}`,
                      color: '#1DA1F2',
                      textDecoration: 'none',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(29, 161, 242, 0.3)';
                      e.target.style.borderColor = '#1DA1F2';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                      e.target.style.borderColor = config.colors.border;
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={18}
                      height={18}
                      fill="currentColor"
                      className="bi bi-twitter"
                      viewBox="0 0 16 16"
                    >
                      <path d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334 0-.14 0-.282-.006-.422A6.685 6.685 0 0 0 16 3.542a6.658 6.658 0 0 1-1.889.518 3.301 3.301 0 0 0 1.447-1.817 6.533 6.533 0 0 1-2.087.793A3.286 3.286 0 0 0 7.875 6.03a9.325 9.325 0 0 1-6.767-3.429 3.289 3.289 0 0 0 1.018 4.382A3.323 3.323 0 0 1 .64 6.575v.045a3.288 3.288 0 0 0 2.632 3.218 3.203 3.203 0 0 1-.865.115 3.23 3.23 0 0 1-.614-.057 3.283 3.283 0 0 0 3.067 2.277A6.588 6.588 0 0 1 .78 13.58a6.32 6.32 0 0 1-.78-.045A9.344 9.344 0 0 0 5.026 15z" />
                    </svg>
                  </a>
                  {/*GitHub*/}
                  <a 
                    href="#" 
                    className="d-flex align-items-center justify-content-center"
                    style={{
                      width: '40px',
                      height: '40px',
                      background: 'white',
                      borderRadius: '10px',
                      border: `2px solid ${config.colors.border}`,
                      color: '#333',
                      textDecoration: 'none',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 4px 15px rgba(51, 51, 51, 0.3)';
                      e.target.style.borderColor = '#333';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                      e.target.style.borderColor = config.colors.border;
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width={18}
                      height={18}
                      fill="currentColor"
                      className="bi bi-github"
                      viewBox="0 0 16 16"
                    >
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className="offset-lg-1 col-lg-2 col-md-3 col-6">
            <div className="mb-4">
              {/* list */}
              <h5 
                className="fw-bold mb-3" 
                style={{ 
                  color: config.colors.dark,
                  fontSize: '1.1rem'
                }}
              >
                Instansi
              </h5>
              <ul className="list-unstyled">
                <li className="mb-2">
                  <a 
                    href="#" 
                    className="text-decoration-none"
                    style={{
                      color: config.colors.accent,
                      transition: 'color 0.3s ease',
                      fontSize: '0.95rem'
                    }}
                    onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                    onMouseLeave={(e) => e.target.style.color = config.colors.accent}
                  >
                    Tentang
                  </a>
                </li>
                <li className="mb-2">
                  <a 
                    href="#" 
                    className="text-decoration-none"
                    style={{
                      color: config.colors.accent,
                      transition: 'color 0.3s ease',
                      fontSize: '0.95rem'
                    }}
                    onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                    onMouseLeave={(e) => e.target.style.color = config.colors.accent}
                  >
                    Capaian
                  </a>
                </li>
                <li className="mb-2">
                  <a 
                    href="#" 
                    className="text-decoration-none"
                    style={{
                      color: config.colors.accent,
                      transition: 'color 0.3s ease',
                      fontSize: '0.95rem'
                    }}
                    onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                    onMouseLeave={(e) => e.target.style.color = config.colors.accent}
                  >
                    Blog
                  </a>
                </li>
                <li className="mb-2">
                  <a 
                    href="#" 
                    className="text-decoration-none"
                    style={{
                      color: config.colors.accent,
                      transition: 'color 0.3s ease',
                      fontSize: '0.95rem'
                    }}
                    onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                    onMouseLeave={(e) => e.target.style.color = config.colors.accent}
                  >
                    Karir
                  </a>
                </li>
                <li className="mb-2">
                  <a 
                    href="#" 
                    className="text-decoration-none"
                    style={{
                      color: config.colors.accent,
                      transition: 'color 0.3s ease',
                      fontSize: '0.95rem'
                    }}
                    onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                    onMouseLeave={(e) => e.target.style.color = config.colors.accent}
                  >
                    Kontak
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="col-lg-2 col-md-3 col-6">
            <div className="mb-4">
              {/* list */}
              <h5 
                className="fw-bold mb-3" 
                style={{ 
                  color: config.colors.dark,
                  fontSize: '1.1rem'
                }}
              >
                Dukungan
              </h5>
              <ul className="list-unstyled">
                <li className="mb-2">
                  <a 
                    href="#" 
                    className="text-decoration-none"
                    style={{
                      color: config.colors.accent,
                      transition: 'color 0.3s ease',
                      fontSize: '0.95rem'
                    }}
                    onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                    onMouseLeave={(e) => e.target.style.color = config.colors.accent}
                  >
                    Bantuan dan Dukungan
                  </a>
                </li>
                <li className="mb-2">
                  <a 
                    href="#" 
                    className="text-decoration-none"
                    style={{
                      color: config.colors.accent,
                      transition: 'color 0.3s ease',
                      fontSize: '0.95rem'
                    }}
                    onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                    onMouseLeave={(e) => e.target.style.color = config.colors.accent}
                  >
                    Menjadi Pemateri
                  </a>
                </li>
                <li className="mb-2">
                  <a 
                    href="#" 
                    className="text-decoration-none"
                    style={{
                      color: config.colors.accent,
                      transition: 'color 0.3s ease',
                      fontSize: '0.95rem'
                    }}
                    onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                    onMouseLeave={(e) => e.target.style.color = config.colors.accent}
                  >
                    Dapatkan Aplikasi
                  </a>
                </li>
                <li className="mb-2">
                  <a 
                    href="#" 
                    className="text-decoration-none"
                    style={{
                      color: config.colors.accent,
                      transition: 'color 0.3s ease',
                      fontSize: '0.95rem'
                    }}
                    onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                    onMouseLeave={(e) => e.target.style.color = config.colors.accent}
                  >
                    Pertanyaan Umum
                  </a>
                </li>
                <li className="mb-2">
                  <a 
                    href="#" 
                    className="text-decoration-none"
                    style={{
                      color: config.colors.accent,
                      transition: 'color 0.3s ease',
                      fontSize: '0.95rem'
                    }}
                    onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                    onMouseLeave={(e) => e.target.style.color = config.colors.accent}
                  >
                    Tutorial
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="col-lg-3 col-md-12">
            {/* contact info */}
            <div className="mb-4">
              <h5 
                className="fw-bold mb-3" 
                style={{ 
                  color: config.colors.dark,
                  fontSize: '1.1rem'
                }}
              >
                Hubungi Kami
              </h5>
              <div className="d-flex flex-column gap-2">
                <p className="mb-2 d-flex align-items-start">
                  <i 
                    className="fas fa-map-marker-alt me-2 mt-1" 
                    style={{ 
                      color: config.colors.primary,
                      fontSize: '0.9rem'
                    }}
                  ></i>
                  <span style={{ color: config.colors.accent, fontSize: '0.95rem' }}>
                    {config.contact.address}
                  </span>
                </p>
                <p className="mb-2 d-flex align-items-center">
                  <i 
                    className="fas fa-envelope me-2" 
                    style={{ 
                      color: config.colors.primary,
                      fontSize: '0.9rem'
                    }}
                  ></i>
                  <a 
                    href={`mailto:${config.contact.email}`} 
                    className="text-decoration-none"
                    style={{
                      color: config.colors.accent,
                      transition: 'color 0.3s ease',
                      fontSize: '0.95rem'
                    }}
                    onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                    onMouseLeave={(e) => e.target.style.color = config.colors.accent}
                  >
                    {config.contact.email}
                  </a>
                </p>
                <p className="mb-0 d-flex align-items-center">
                  <i 
                    className="fas fa-phone me-2" 
                    style={{ 
                      color: config.colors.primary,
                      fontSize: '0.9rem'
                    }}
                  ></i>
                  <span style={{ color: config.colors.accent, fontSize: '0.95rem' }}>
                    {config.contact.phone}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom section with copyright and links */}
        <div 
          className="row align-items-center pt-4 mt-4"
          style={{
            borderTop: `1px solid ${config.colors.border}`
          }}
        >
          {/* Copyright */}
          <div className="col-md-6 col-12 text-center text-md-start">
            <span style={{ color: config.colors.accent, fontSize: '0.9rem' }}>
              {config.brand.copyright}
            </span>
          </div>
          
          {/* Legal Links */}
          <div className="col-md-6 col-12 text-center text-md-end mt-2 mt-md-0">
            <div className="d-flex justify-content-center justify-content-md-end flex-wrap gap-3">
              <a 
                href="#" 
                className="text-decoration-none"
                style={{
                  color: config.colors.accent,
                  transition: 'color 0.3s ease',
                  fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                onMouseLeave={(e) => e.target.style.color = config.colors.accent}
              >
                Kebijakan Privasi
              </a>
              <a 
                href="#" 
                className="text-decoration-none"
                style={{
                  color: config.colors.accent,
                  transition: 'color 0.3s ease',
                  fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                onMouseLeave={(e) => e.target.style.color = config.colors.accent}
              >
                Informasi Cookie
              </a>
              <a 
                href="#" 
                className="text-decoration-none d-none d-lg-inline"
                style={{
                  color: config.colors.accent,
                  transition: 'color 0.3s ease',
                  fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                onMouseLeave={(e) => e.target.style.color = config.colors.accent}
              >
                Jangan Jual Informasi Pribadi Saya
              </a>
              <a 
                href="#" 
                className="text-decoration-none"
                style={{
                  color: config.colors.accent,
                  transition: 'color 0.3s ease',
                  fontSize: '0.9rem'
                }}
                onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                onMouseLeave={(e) => e.target.style.color = config.colors.accent}
              >
                Ketentuan Penggunaan
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default memo(BaseFooter)