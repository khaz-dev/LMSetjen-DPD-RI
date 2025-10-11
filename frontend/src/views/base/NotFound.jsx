import { Link } from 'react-router-dom';
import BaseHeader from '../partials/BaseHeader';
import BaseFooter from '../partials/BaseFooter';

function NotFound() {
    return (
        <>
            <BaseHeader />
            
            <div 
                style={{
                    minHeight: 'calc(100vh - 120px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    padding: '2rem 1rem',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Background Pattern */}
                <div 
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        opacity: 0.1,
                        backgroundImage: `
                            repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.1) 35px, rgba(255,255,255,.1) 70px),
                            repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(255,255,255,.1) 35px, rgba(255,255,255,.1) 70px)
                        `
                    }}
                />

                <div className="container position-relative" style={{ zIndex: 1 }}>
                    <div className="row justify-content-center">
                        <div className="col-lg-8 col-xl-6">
                            <div 
                                className="card border-0 shadow-lg"
                                style={{
                                    borderRadius: '30px',
                                    overflow: 'hidden',
                                    background: 'rgba(255, 255, 255, 0.95)',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <div className="card-body text-center p-5">
                                    {/* 404 Illustration */}
                                    <div 
                                        style={{
                                            fontSize: '120px',
                                            fontWeight: '800',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            backgroundClip: 'text',
                                            lineHeight: '1',
                                            marginBottom: '1rem',
                                            textShadow: '0 4px 20px rgba(102, 126, 234, 0.2)'
                                        }}
                                    >
                                        404
                                    </div>

                                    {/* Icon */}
                                    <div 
                                        style={{
                                            width: '100px',
                                            height: '100px',
                                            margin: '0 auto 2rem',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)'
                                        }}
                                    >
                                        <i 
                                            className="fas fa-exclamation-triangle" 
                                            style={{
                                                fontSize: '3rem',
                                                color: 'white'
                                            }}
                                        />
                                    </div>

                                    {/* Heading */}
                                    <h1 
                                        className="display-6 fw-bold mb-3"
                                        style={{
                                            color: '#2c3e50',
                                            fontSize: '2rem'
                                        }}
                                    >
                                        Halaman Tidak Ditemukan
                                    </h1>

                                    {/* Description */}
                                    <p 
                                        className="lead text-muted mb-4"
                                        style={{
                                            fontSize: '1.1rem',
                                            lineHeight: '1.7'
                                        }}
                                    >
                                        Maaf, halaman yang Anda cari tidak dapat ditemukan atau mungkin telah dihapus. 
                                        Silakan periksa kembali URL atau kembali ke halaman utama.
                                    </p>

                                    {/* Info Box */}
                                    <div 
                                        className="alert alert-light border-0 mb-4"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                                            borderRadius: '15px',
                                            padding: '1.5rem'
                                        }}
                                    >
                                        <div className="d-flex align-items-start text-start">
                                            <i 
                                                className="fas fa-info-circle me-3 mt-1"
                                                style={{
                                                    fontSize: '1.5rem',
                                                    color: '#667eea'
                                                }}
                                            />
                                            <div>
                                                <h6 className="fw-bold mb-2" style={{ color: '#2c3e50' }}>
                                                    Kemungkinan Penyebab:
                                                </h6>
                                                <ul className="mb-0 text-muted" style={{ fontSize: '0.95rem', paddingLeft: '1.2rem' }}>
                                                    <li>Halaman telah dipindahkan atau dihapus</li>
                                                    <li>URL yang Anda masukkan salah ketik</li>
                                                    <li>Link yang Anda klik sudah tidak valid</li>
                                                    <li>Anda tidak memiliki akses ke halaman ini</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="d-flex flex-wrap gap-3 justify-content-center">
                                        <Link 
                                            to="/"
                                            className="btn btn-lg px-4 py-3"
                                            style={{
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '15px',
                                                fontWeight: '600',
                                                boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)',
                                                transition: 'all 0.3s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = '0 12px 25px rgba(102, 126, 234, 0.4)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.3)';
                                            }}
                                        >
                                            <i className="fas fa-home me-2"></i>
                                            Kembali ke Beranda
                                        </Link>

                                        <button 
                                            onClick={() => window.history.back()}
                                            className="btn btn-lg btn-outline-secondary px-4 py-3"
                                            style={{
                                                borderRadius: '15px',
                                                fontWeight: '600',
                                                borderWidth: '2px',
                                                transition: 'all 0.3s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.background = '#6c757d';
                                                e.currentTarget.style.color = 'white';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.color = '#6c757d';
                                            }}
                                        >
                                            <i className="fas fa-arrow-left me-2"></i>
                                            Halaman Sebelumnya
                                        </button>

                                        <Link 
                                            to="/search/"
                                            className="btn btn-lg btn-outline-primary px-4 py-3"
                                            style={{
                                                borderRadius: '15px',
                                                fontWeight: '600',
                                                borderWidth: '2px',
                                                borderColor: '#667eea',
                                                color: '#667eea',
                                                transition: 'all 0.3s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.background = '#667eea';
                                                e.currentTarget.style.color = 'white';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.color = '#667eea';
                                            }}
                                        >
                                            <i className="fas fa-search me-2"></i>
                                            Jelajahi Kursus
                                        </Link>
                                    </div>

                                    {/* Help Section */}
                                    <div className="mt-5 pt-4 border-top">
                                        <p className="text-muted mb-2" style={{ fontSize: '0.9rem' }}>
                                            Butuh bantuan?
                                        </p>
                                        <div className="d-flex gap-3 justify-content-center flex-wrap">
                                            <a 
                                                href="mailto:support@lmsetjendpdri.go.id"
                                                className="text-decoration-none"
                                                style={{
                                                    color: '#667eea',
                                                    fontSize: '0.9rem',
                                                    fontWeight: '500',
                                                    transition: 'color 0.3s ease'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = '#764ba2'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = '#667eea'}
                                            >
                                                <i className="fas fa-envelope me-1"></i>
                                                Hubungi Support
                                            </a>
                                            <span className="text-muted">|</span>
                                            <Link 
                                                to="/search/"
                                                className="text-decoration-none"
                                                style={{
                                                    color: '#667eea',
                                                    fontSize: '0.9rem',
                                                    fontWeight: '500',
                                                    transition: 'color 0.3s ease'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.color = '#764ba2'}
                                                onMouseLeave={(e) => e.currentTarget.style.color = '#667eea'}
                                            >
                                                <i className="fas fa-question-circle me-1"></i>
                                                FAQ
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <BaseFooter />
        </>
    );
}

export default NotFound;
