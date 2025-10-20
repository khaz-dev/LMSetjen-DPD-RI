import { Link } from 'react-router-dom';
import BaseHeader from '../partials/BaseHeader';
import AdminHeader from '../partials/AdminHeader';
import BaseFooter from '../partials/BaseFooter';
import UserData from '../plugin/UserData';
import './NotFound.css';

function NotFound() {
    const userData = UserData();
    const isAdmin = userData?.role === 'admin';

    return (
        <>
            {isAdmin ? <AdminHeader /> : <BaseHeader />}
            
            <section className="notfound-section">
                {/* Background Pattern */}
                <div className="notfound-background-pattern" />

                <div className="container notfound-content">
                    <div className="row justify-content-center">
                        <div className="col-lg-8 col-xl-6">
                            <div className="card shadow-lg notfound-card">
                                <div className="card-body notfound-card-body">
                                    {/* 404 Illustration */}
                                    <div className="notfound-404-text">
                                        404
                                    </div>

                                    {/* Icon */}
                                    <div className="notfound-icon-circle">
                                        <i className="fas fa-exclamation-triangle notfound-icon" />
                                    </div>

                                    {/* Heading */}
                                    <h1 className="notfound-title">
                                        Halaman Tidak Ditemukan
                                    </h1>

                                    {/* Description */}
                                    <p className="notfound-description">
                                        Maaf, halaman yang Anda cari tidak dapat ditemukan atau mungkin telah dihapus. 
                                        Silakan periksa kembali URL atau kembali ke halaman utama.
                                    </p>

                                    {/* Info Box */}
                                    <div className="notfound-info-box">
                                        <div className="notfound-info-content">
                                            <i className="fas fa-info-circle notfound-info-icon" />
                                            <div>
                                                <h6 className="notfound-info-title">
                                                    Kemungkinan Penyebab:
                                                </h6>
                                                <ul className="notfound-info-list">
                                                    <li>Halaman telah dipindahkan atau dihapus</li>
                                                    <li>URL yang Anda masukkan salah ketik</li>
                                                    <li>Link yang Anda klik sudah tidak valid</li>
                                                    <li>Anda tidak memiliki akses ke halaman ini</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="notfound-buttons">
                                        <Link to="/" className="notfound-btn-primary">
                                            <i className="fas fa-home notfound-btn-icon"></i>
                                            Kembali ke Beranda
                                        </Link>

                                        <button 
                                            onClick={() => window.history.back()}
                                            className="notfound-btn-secondary"
                                        >
                                            <i className="fas fa-arrow-left notfound-btn-icon"></i>
                                            Halaman Sebelumnya
                                        </button>

                                        <Link to="/search/" className="notfound-btn-outline">
                                            <i className="fas fa-search notfound-btn-icon"></i>
                                            Jelajahi Kursus
                                        </Link>
                                    </div>

                                    {/* Help Section */}
                                    <div className="notfound-help-section">
                                        <p className="notfound-help-text">
                                            Butuh bantuan?
                                        </p>
                                        <div className="notfound-help-links">
                                            <a 
                                                href="mailto:support@lmsetjendpdri.go.id"
                                                className="notfound-help-link"
                                            >
                                                <i className="fas fa-envelope me-1"></i>
                                                Hubungi Support
                                            </a>
                                            <span className="notfound-help-separator">|</span>
                                            <Link to="/search/" className="notfound-help-link">
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
            </section>

            <BaseFooter />
        </>
    );
}

export default NotFound;
