import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiInstance from '../../utils/axios';
import Toast from '../plugin/Toast';
import { Helmet } from 'react-helmet-async';
import BaseHeader from '../partials/BaseHeader';
import BaseFooter from '../partials/BaseFooter';
import { getLevelText } from '../../utils/courseUtils';
import './CertificateValidation.css';

// ✨ Function to translate course level from English to Indonesian
const translateLevel = (level) => {
    return getLevelText(level);
};

function CertificateValidation() {
    const { validation_token } = useParams();
    const navigate = useNavigate();
    const [certificate, setCertificate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const validateCertificate = async () => {
            try {
                setLoading(true);
                const response = await apiInstance.get(`certificate/validate/${validation_token}/`);
                
                if (response.data.is_valid) {
                    setCertificate(response.data.details);
                    setError(null);
                } else {
                    setError(response.data.message || 'Sertifikat tidak valid');
                    setCertificate(null);
                }
            } catch (err) {
                console.error('Error validating certificate:', err);
                setError(err.response?.data?.message || 'Gagal memvalidasi sertifikat. Silakan coba lagi.');
                setCertificate(null);
            } finally {
                setLoading(false);
            }
        };

        if (validation_token) {
            validateCertificate();
        } else {
            setError('Token sertifikat tidak valid');
            setLoading(false);
        }
    }, [validation_token]);

    if (loading) {
        return (
            <>
                <Helmet>
                    <title>Validasi Sertifikat - LMSetjen</title>
                </Helmet>
                <BaseHeader />
                <div className="certificate-validation-container">
                    <div className="validation-loader">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Memuat...</span>
                        </div>
                        <p className="mt-3">Memvalidasi sertifikat...</p>
                    </div>
                </div>
                <BaseFooter />
            </>
        );
    }

    return (
        <>
            <Helmet>
                <title>Validasi Sertifikat - LMSetjen</title>
            </Helmet>
            <BaseHeader />
            <div className="certificate-validation-container">
                {error ? (
                    <div className="validation-result invalid-result">
                        <div className="result-icon error-icon">
                            <i className="fas fa-times-circle"></i>
                        </div>
                        <h2>Sertifikat Tidak Valid</h2>
                        <p className="error-message">{error}</p>
                        <button 
                            className="btn btn-primary mt-4"
                            onClick={() => navigate('/')}
                        >
                            <i className="fas fa-home me-2"></i>
                            Kembali ke Beranda
                        </button>
                    </div>
                ) : certificate ? (
                    <div className="validation-result valid-result">
                        <div className="result-icon success-icon">
                            <i className="fas fa-check-circle"></i>
                        </div>
                        
                        <div className="result-header">
                            <h1>Keaslian Sertifikat Terverifikasi</h1>
                            <p className="subtitle">Sertifikat ini valid dan asli</p>
                        </div>

                        <div className="certificate-details-grid">
                            {/* Left Column - Student & Course Info */}
                            <div className="details-section">
                                <h3 className="section-title">
                                    <i className="fas fa-user me-2"></i>
                                    Pemegang Sertifikat
                                </h3>
                                <div className="detail-row">
                                    <span className="detail-label">Nama:</span>
                                    <span className="detail-value">{certificate.student_name}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Posisi/Unit:</span>
                                    <span className="detail-value">{certificate.student_info}</span>
                                </div>

                                <h3 className="section-title mt-4">
                                    <i className="fas fa-book me-2"></i>
                                    Informasi Kursus
                                </h3>
                                <div className="detail-row">
                                    <span className="detail-label">Kursus:</span>
                                    <span className="detail-value">{certificate.course_title}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Level:</span>
                                    <span className="detail-value">{translateLevel(certificate.course_level) || 'Tidak Tersedia'}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Kategori:</span>
                                    <span className="detail-value">{certificate.course_category}</span>
                                </div>
                            </div>

                            {/* Right Column - Instructor & Dates */}
                            <div className="details-section">
                                <h3 className="section-title">
                                    <i className="fas fa-chalkboard-user me-2"></i>
                                    Pengajar
                                </h3>
                                <div className="detail-row">
                                    <span className="detail-label">Nama:</span>
                                    <span className="detail-value">{certificate.instructor_name}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Posisi/Unit:</span>
                                    <span className="detail-value">{certificate.instructor_info}</span>
                                </div>

                                <h3 className="section-title mt-4">
                                    <i className="fas fa-calendar me-2"></i>
                                    Tanggal Penting
                                </h3>
                                <div className="detail-row">
                                    <span className="detail-label">Tanggal Penerbitan:</span>
                                    <span className="detail-value">{certificate.issued_date}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Tanggal Penyelesaian:</span>
                                    <span className="detail-value">{certificate.completion_date}</span>
                                </div>

                                <h3 className="section-title mt-4">
                                    <i className="fas fa-key me-2"></i>
                                    Nomor Sertifikat
                                </h3>
                                <div className="certificate-id-box">
                                    <code>{certificate.formatted_certificate_id}</code>
                                </div>
                            </div>
                        </div>

                        {/* Course Detail Link Section */}
                        {certificate.course_slug && (
                            <div className="course-link-section mt-4">
                                <a 
                                    href={`/course-detail/${certificate.course_slug}/`}
                                    className="btn btn-lg btn-course-link"
                                    style={{
                                        background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: 'white',
                                        padding: '1rem 2rem',
                                        fontSize: '1.05rem',
                                        fontWeight: '600',
                                        textDecoration: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                                        width: '100%',
                                        justifyContent: 'center'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.5)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
                                    }}
                                >
                                    <i className="fas fa-book-open"></i>
                                    <span>Lihat Detail Kursus</span>
                                </a>
                            </div>
                        )}

                        {/* Verification Badge */}
                        <div className="verification-badge">
                            <div className="badge-content">
                                <i className="fas fa-seal"></i>
                                <span>Diverifikasi oleh Sistem LMSetjen DPD RI</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="action-buttons">
                            <button 
                                className="btn btn-primary"
                                onClick={() => navigate('/')}
                            >
                                <i className="fas fa-home me-2"></i>
                                Kembali ke Beranda
                            </button>
                            <button 
                                className="btn btn-outline-secondary"
                                onClick={() => window.print()}
                            >
                                <i className="fas fa-print me-2"></i>
                                Cetak Verifikasi
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
            <BaseFooter />
        </>
    );
}

export default CertificateValidation;
