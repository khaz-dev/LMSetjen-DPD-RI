import React, { memo } from 'react';

function Footer() {
  const currentYear = new Date().getFullYear();

  // Configuration data for easy maintenance
  const config = {
    brand: {
      name: 'LMSetjen DPD RI',
      tagline: 'Platform e-learning BPSDM OKK untuk Setjen DPD RI',
      copyright: `© ${currentYear} BPSDM | OKK`
    },
    contact: {
      email: 'sdm@dpd.go.id',
      phone: '(+62) 853 1586 9799'
    },
    colors: {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#6c757d',
      light: '#f8f9fa',
      dark: '#343a40'
    }
  };

  const socialLinks = [
    { 
      name: 'Facebook', 
      icon: 'fab fa-facebook-f', 
      url: '#',
      color: '#1877F2'
    },
    { 
      name: 'Twitter', 
      icon: 'fab fa-twitter', 
      url: '#',
      color: '#1DA1F2'
    },
    { 
      name: 'Instagram', 
      icon: 'fab fa-instagram', 
      url: '#',
      color: '#E4405F'
    },
    { 
      name: 'LinkedIn', 
      icon: 'fab fa-linkedin-in', 
      url: '#',
      color: '#0A66C2'
    }
  ];

  const quickLinks = [
    { name: 'Kebijakan Privasi', url: '#' },
    { name: 'Syarat & Ketentuan', url: '#' },
    { name: 'Bantuan', url: '#' },
    { name: 'Kontak', url: '#' }
  ];

  // Simplified Components for compact layout
  const QuickLink = ({ link }) => (
    <a
      href={link.url}
      className="text-decoration-none small me-3"
      style={{
        transition: 'all 0.3s ease',
        color: config.colors.accent
      }}
      onMouseEnter={(e) => {
        e.target.style.color = config.colors.primary;
      }}
      onMouseLeave={(e) => {
        e.target.style.color = config.colors.accent;
      }}
    >
      {link.name}
    </a>
  );

  return (
    <footer 
      className="py-3"
      style={{
        background: 'white',
        borderTop: '1px solid #e9ecef',
        boxShadow: '0 -4px 15px rgba(0, 0, 0, 0.1)'
      }}
    >
      <div className="container">
        {/* Single Row Layout */}
        <div className="row align-items-center">
          {/* Brand & Copyright */}
          <div className="col-md-4 text-center text-md-start">
            <span className="fw-bold me-2" style={{ color: config.colors.dark }}>
              {config.brand.name}
            </span>
            <small className="text-muted">
              {config.brand.copyright}
            </small>
          </div>

          {/* Quick Links */}
          <div className="col-md-5 text-center my-2 my-md-0">
            {quickLinks.map((link, index) => (
              <QuickLink key={index} link={link} />
            ))}
          </div>

          {/* Contact */}
          <div className="col-md-3 text-center text-md-end">
            <small className="text-muted">
              <i className="fas fa-envelope me-1" style={{ color: config.colors.primary }}></i>
              <a 
                href={`mailto:${config.contact.email}`} 
                className="text-decoration-none text-muted"
                style={{ transition: 'color 0.3s ease' }}
                onMouseEnter={(e) => e.target.style.color = config.colors.primary}
                onMouseLeave={(e) => e.target.style.color = ''}
              >
                {config.contact.email}
              </a>
            </small>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default memo(Footer);
