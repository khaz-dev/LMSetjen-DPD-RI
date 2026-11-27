import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiInstance from '../../utils/axios';
import Toast from '../plugin/Toast';
import { Helmet } from 'react-helmet-async';
import BaseHeader from '../partials/BaseHeader';
import BaseFooter from '../partials/BaseFooter';
import './CertificateValidation.css';

/**
 * ✨ Redesigned Certificate Validation Page (Keaslian Sertifikat Terverifikasi)
 * LMSetjen DPD RI - Modern, Compact, High-Density, Verified Credential Showcase
 * Eliminates excessive blank/white space and provides instant official credibility.
 */
function CertificateValidation() {
    const { validation_token } = useParams();
    const navigate = useNavigate();
    const [certificate, setCertificate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copiedId, setCopiedId] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    // Format verification inspection timestamp
    const [verifiedAt] = useState(() => {
        try {
            return new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) + ' WIB';
        } catch (e) {
            return 'Hari ini';
        }
    });

    useEffect(() => {
        const validateCertificate = async () => {
            try {
                setLoading(true);
                const response = await apiInstance.get(`certificate/validate/${validation_token}/`);

                if (response.data.is_valid && response.data.details) {
                    setCertificate(response.data.details);
                    setError(null);
                } else {
                    setError(response.data.message || 'Sertifikat tidak terdaftar atau tidak valid.');
                    setCertificate(null);
                }
            } catch (err) {
                console.error('Error validating certificate:', err);
                setError(err.response?.data?.message || 'Gagal memvalidasi sertifikat. Pastikan tautan atau kode QR yang Anda gunakan benar.');
                setCertificate(null);
            } finally {
                setLoading(false);
            }
        };

        if (validation_token) {
            validateCertificate();
        } else {
            setError('Token validasi sertifikat tidak ditemukan.');
            setLoading(false);
        }
    }, [validation_token]);

    // Format dates to Indonesian locale
    const formatDateIndo = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
        } catch (e) { }
        return dateStr;
    };

    // Course level badge meta
    const getLevelBadge = (level) => {
        const lvl = (level || '').toLowerCase();
        if (lvl.includes('begin') || lvl.includes('pemula')) {
            return { label: 'Pemula', tone: 'val-lvl-emerald', icon: 'fa-seedling' };
        }
        if (lvl.includes('inter') || lvl.includes('menengah')) {
            return { label: 'Menengah', tone: 'val-lvl-teal', icon: 'fa-chart-simple' };
        }
        if (lvl.includes('adv') || lvl.includes('lanjut')) {
            return { label: 'Lanjutan', tone: 'val-lvl-indigo', icon: 'fa-rocket' };
        }
        if (lvl.includes('exp') || lvl.includes('ahli')) {
            return { label: 'Ahli', tone: 'val-lvl-amber', icon: 'fa-crown' };
        }
        if (lvl.includes('all') || lvl.includes('semua')) {
            return { label: 'Semua Level', tone: 'val-lvl-slate', icon: 'fa-layer-group' };
        }
        return { label: level || 'Umum', tone: 'val-lvl-slate', icon: 'fa-book' };
    };

    // Resolve full certificate image URL
    const imageUrl = useMemo(() => {
        if (!certificate) return null;
        let url = certificate.image_file_url;
        if (!url && certificate.certificate_id) {
            url = `/api/v1/student/certificate-image/${certificate.certificate_id}/`;
        }
        if (!url) return null;
        if (url.startsWith('/')) {
            const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';
            const origin = apiBase.startsWith('http') ? new URL(apiBase).origin : '';
            return `${origin}${url}`;
        }
        return url;
    }, [certificate]);

    // Copy certificate registration number
    const handleCopyId = () => {
        const idToCopy = certificate?.formatted_certificate_id || certificate?.certificate_id;
        if (!idToCopy) return;

        navigator.clipboard.writeText(idToCopy).then(() => {
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
            Toast().fire({
                icon: 'success',
                title: 'Nomor Sertifikat Disalin!',
                text: idToCopy,
                timer: 1500
            });
        }).catch(() => { });
    };

    // Share validation page link
    const handleShareLink = () => {
        const currentUrl = window.location.href;
        navigator.clipboard.writeText(currentUrl).then(() => {
            Toast().fire({
                icon: 'success',
                title: 'Tautan Verifikasi Disalin!',
                text: 'Tautan verifikasi siap dibagikan',
                timer: 1800
            });
        }).catch(() => { });
    };

    // Download certificate image
    const downloadCertificate = async () => {
        if (!imageUrl) {
            Toast().fire({
                icon: 'warning',
                title: 'File Gambar Belum Tersedia'
            });
            return;
        }

        try {
            setDownloading(true);
            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            const safeTitle = (certificate.course_title || 'Kursus')
                .replace(/[^\w\s-]/gi, '')
                .replace(/\s+/g, '_');
            link.setAttribute('download', `Sertifikat_${safeTitle}_${certificate.certificate_id}.png`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

            Toast().fire({
                icon: 'success',
                title: 'Unduhan Berhasil!',
                text: 'Sertifikat tersimpan di perangkat Anda',
                timer: 1800
            });
        } catch (e) {
            window.open(imageUrl, '_blank');
        } finally {
            setDownloading(false);
        }
    };

    // Loading State
    if (loading) {
        return (
            <>
                <Helmet>
                    <title>Memvalidasi Sertifikat - LMSetjen DPD RI</title>
                </Helmet>
                <BaseHeader />
                <div className="val-page-container">
                    <div className="val-card-wrapper">
                        <div className="val-loading-box">
                            <div className="val-spinner-wrap">
                                <div className="spinner-border text-teal" role="status">
                                    <span className="visually-hidden">Memvalidasi...</span>
                                </div>
                                <i className="fas fa-shield-halved val-spinner-icon"></i>
                            </div>
                            <h3 className="val-loading-title">Memverifikasi Keaslian Dokumen...</h3>
                            <p className="val-loading-desc">
                                Menghubungkan ke basis data sertifikat resmi Sekretariat Jenderal DPD RI
                            </p>
                        </div>
                    </div>
                </div>
                <BaseFooter />
            </>
        );
    }

    const levelInfo = getLevelBadge(certificate?.course_level);

    return (
        <>
            <Helmet>
                <title>
                    {certificate
                        ? `Keaslian Sertifikat Terverifikasi: ${certificate.student_name} - LMSetjen DPD RI`
                        : 'Hasil Verifikasi Sertifikat - LMSetjen DPD RI'}
                </title>
            </Helmet>
            <BaseHeader />

            <div className="val-page-container">
                <div className="val-card-wrapper">

                    {/* =========================================================================
                        A. INVALID / ERROR STATE
                        ========================================================================= */}
                    {error ? (
                        <div className="val-invalid-box">
                            <div className="val-invalid-icon-wrap">
                                <i className="fas fa-circle-xmark"></i>
                            </div>
                            <h2 className="val-invalid-title">Sertifikat Tidak Terverifikasi</h2>
                            <p className="val-invalid-desc">{error}</p>

                            <div className="val-invalid-meta">
                                <div className="val-invalid-token">
                                    <span>Token / ID yang diperiksa:</span>
                                    <code>{validation_token}</code>
                                </div>
                                <p className="text-muted small mt-2 mb-0">
                                    Pastikan token pada URL atau kode QR yang Anda pindai sesuai dengan yang tertera pada sertifikat fisik/digital resmi.
                                </p>
                            </div>

                            <div className="val-invalid-actions">
                                <button
                                    type="button"
                                    className="btn btn-val-home"
                                    onClick={() => navigate('/')}
                                >
                                    <i className="fas fa-house me-2"></i>
                                    Kembali ke Beranda
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-val-print"
                                    onClick={() => window.location.reload()}
                                >
                                    <i className="fas fa-rotate-right me-2"></i>
                                    Coba Lagi
                                </button>
                            </div>
                        </div>
                    ) : certificate ? (
                        /* =========================================================================
                           B. VALID / VERIFIED CERTIFICATE STATE
                           ========================================================================= */
                        <div className="val-verified-box">

                            {/* 1. TOP OFFICIAL VERIFICATION BANNER */}
                            <div className="val-status-header">
                                <div className="val-status-header-inner">
                                    <div className="val-agency-info">
                                        <div className="val-agency-emblem">
                                            <i className="fas fa-landmark"></i>
                                        </div>
                                        <div>
                                            <span className="val-agency-sub">SISTEM VALIDASI KREDENSIAL RESMI</span>
                                            <h1 className="val-agency-name">Sekretariat Jenderal DPD RI</h1>
                                        </div>
                                    </div>

                                    {/* Verification Status Pill */}
                                    <div className="val-badge-container">
                                        <div className="val-verified-chip">
                                            <span className="val-radar-dot"></span>
                                            <i className="fas fa-certificate text-warning"></i>
                                            <span className="val-verified-chip-txt">KEASLIAN TERVERIFIKASI RESMI</span>
                                        </div>
                                        <div className="val-timestamp">
                                            <i className="fas fa-clock-rotate-left me-1"></i>
                                            Diperiksa: {verifiedAt}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. TWO-COLUMN HIGH-DENSITY CONTENT GRID */}
                            <div className="val-main-grid">

                                {/* ---------------- LEFT COLUMN: VISUAL CERTIFICATE ---------------- */}
                                <div className="val-visual-col">
                                    <div
                                        className="val-cert-frame"
                                        onClick={() => setShowPreviewModal(true)}
                                        role="button"
                                        tabIndex={0}
                                        title="Klik untuk melihat sertifikat resolusi penuh"
                                        onKeyDown={(e) => { if (e.key === 'Enter') setShowPreviewModal(true); }}
                                    >
                                        <div className="val-cert-frame-header">
                                            <span className="val-cert-frame-tag">
                                                <i className="fas fa-shield-halved me-1 text-emerald"></i>
                                                DOKUMEN DIGITAL RESMI
                                            </span>
                                            <span className="val-cert-frame-zoom">
                                                <i className="fas fa-magnifying-glass-plus"></i>
                                            </span>
                                        </div>

                                        <div className="val-cert-img-container">
                                            {imageUrl && !imageError ? (
                                                <img
                                                    src={imageUrl}
                                                    alt={`Sertifikat ${certificate.course_title}`}
                                                    className="val-cert-img"
                                                    onError={() => setImageError(true)}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="val-cert-svg-mockup">
                                                    <div className="val-mockup-inner">
                                                        <div className="val-mockup-top">
                                                            <i className="fas fa-landmark text-teal me-1"></i>
                                                            <span>SETJEN DPD RI</span>
                                                        </div>
                                                        <div className="val-mockup-seal">
                                                            <i className="fas fa-award"></i>
                                                        </div>
                                                        <div className="val-mockup-heading">SERTIFIKAT KELULUSAN</div>
                                                        <div className="val-mockup-title">{certificate.course_title}</div>
                                                        <div className="val-mockup-student">{certificate.student_name}</div>
                                                        <div className="val-mockup-id">
                                                            {certificate.formatted_certificate_id || certificate.certificate_id}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Hover Zoom Prompt */}
                                            <div className="val-cert-overlay">
                                                <span className="val-cert-overlay-btn">
                                                    <i className="fas fa-eye me-1"></i> Lihat Layar Penuh
                                                </span>
                                            </div>
                                        </div>

                                        {/* Security Token Footnote Box */}
                                        <div className="val-token-box">
                                            <div className="val-token-left">
                                                <i className="fas fa-fingerprint text-teal me-2"></i>
                                                <div className="val-token-meta">
                                                    <span className="val-token-lbl">TOKEN VALIDASI SISTEM</span>
                                                    <code className="val-token-hash">{validation_token}</code>
                                                </div>
                                            </div>
                                            <span className="val-token-status">
                                                <i className="fas fa-circle-check text-success me-1"></i> Sah
                                            </span>
                                        </div>
                                    </div>

                                    {/* Quick Visual Action Buttons */}
                                    <div className="val-visual-actions">
                                        <button
                                            type="button"
                                            className="btn btn-val-view"
                                            onClick={() => setShowPreviewModal(true)}
                                        >
                                            <i className="fas fa-expand me-1"></i> Layar Penuh
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-val-download"
                                            onClick={downloadCertificate}
                                            disabled={downloading}
                                        >
                                            {downloading ? (
                                                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                            ) : (
                                                <i className="fas fa-download me-1"></i>
                                            )}
                                            Unduh Dokumen
                                        </button>
                                    </div>
                                </div>

                                {/* ---------------- RIGHT COLUMN: STRUCTURED METADATA ---------------- */}
                                <div className="val-data-col">

                                    {/* 1. Identity & Registration Number */}
                                    <div className="val-info-card">
                                        <div className="val-info-header">
                                            <div className="val-info-title">
                                                <i className="fas fa-id-card text-teal me-2"></i>
                                                Identitas Pemilik Sertifikat
                                            </div>
                                            <span className="val-verified-user-pill">
                                                <i className="fas fa-user-check me-1"></i> Peserta Sah
                                            </span>
                                        </div>

                                        <div className="val-data-group">
                                            <div className="val-data-row">
                                                <span className="val-label">Nama Lengkap</span>
                                                <span className="val-val val-recipient-name">
                                                    {certificate.student_name}
                                                </span>
                                            </div>

                                            {certificate.student_email && (
                                                <div className="val-data-row">
                                                    <span className="val-label">Email Akun</span>
                                                    <span className="val-val text-muted small">
                                                        {certificate.student_email}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Prominent Monospace Registration ID with Copy Button */}
                                            <div className="val-id-row">
                                                <span className="val-label">Nomor Registrasi Sertifikat</span>
                                                <div className="val-id-pill-wrap">
                                                    <code className="val-id-code">
                                                        {certificate.formatted_certificate_id || certificate.certificate_id}
                                                    </code>
                                                    <button
                                                        type="button"
                                                        className={`val-btn-copy ${copiedId ? 'copied' : ''}`}
                                                        onClick={handleCopyId}
                                                        title="Salin Nomor Sertifikat"
                                                    >
                                                        <i className={`fas ${copiedId ? 'fa-check text-success' : 'fa-copy'}`}></i>
                                                        <span className="ms-1">{copiedId ? 'Tersalin' : 'Salin'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Course Program & Competency */}
                                    <div className="val-info-card">
                                        <div className="val-info-header">
                                            <div className="val-info-title">
                                                <i className="fas fa-graduation-cap text-teal me-2"></i>
                                                Program Pelatihan & Kompetensi
                                            </div>
                                            <span className={`val-level-pill ${levelInfo.tone}`}>
                                                <i className={`fas ${levelInfo.icon} me-1`}></i>
                                                {levelInfo.label}
                                            </span>
                                        </div>

                                        <div className="val-data-group">
                                            <div className="val-data-row flex-column align-items-start">
                                                <span className="val-label mb-1">Materi / Kursus</span>
                                                <div className="val-course-title">
                                                    {certificate.course_slug ? (
                                                        <Link to={`/course-detail/${certificate.course_slug}/`}>
                                                            {certificate.course_title}
                                                            <i className="fas fa-arrow-up-right-from-square ms-2 small"></i>
                                                        </Link>
                                                    ) : (
                                                        certificate.course_title
                                                    )}
                                                </div>
                                            </div>

                                            <div className="val-data-grid-sub">
                                                <div className="val-sub-item">
                                                    <span className="val-label">Kategori Bidang</span>
                                                    <span className="val-val font-semibold">
                                                        <i className="fas fa-tag text-teal me-1"></i>
                                                        {certificate.course_category || 'Umum'}
                                                    </span>
                                                </div>
                                                <div className="val-sub-item">
                                                    <span className="val-label">Penyelenggara</span>
                                                    <span className="val-val text-truncate" title={certificate.instructor_name}>
                                                        <i className="fas fa-user-tie text-teal me-1"></i>
                                                        {certificate.instructor_name || 'BPSDM Setjen DPD RI'}
                                                    </span>
                                                </div>
                                                <div className="val-sub-item">
                                                    <span className="val-label">Bobot Pelatihan</span>
                                                    <span className="val-val font-semibold text-teal" title="Beban Pembelajaran ASN (UU No. 20/2023 Pasal 49)">
                                                        <i className="fas fa-award text-warning me-1"></i>
                                                        {certificate.total_jam_pelatihan || 2} Jam Pelatihan (JP)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Dates & Legal Legitimacy */}
                                    <div className="val-info-card">
                                        <div className="val-info-header">
                                            <div className="val-info-title">
                                                <i className="fas fa-calendar-check text-teal me-2"></i>
                                                Legalitas & Kronologi
                                            </div>
                                            <span className="val-status-pill text-emerald">
                                                <i className="fas fa-shield-check me-1"></i> Sah & Berlaku
                                            </span>
                                        </div>

                                        <div className="val-data-grid-sub">
                                            <div className="val-sub-item">
                                                <span className="val-label">Tanggal Kelulusan</span>
                                                <span className="val-val">
                                                    {formatDateIndo(certificate.completion_date)}
                                                </span>
                                            </div>
                                            <div className="val-sub-item">
                                                <span className="val-label">Tanggal Penerbitan</span>
                                                <span className="val-val">
                                                    {formatDateIndo(certificate.issued_date)}
                                                </span>
                                            </div>
                                            <div className="val-sub-item">
                                                <span className="val-label">Masa Berlaku</span>
                                                <span className="val-val text-success font-semibold">
                                                    Permanen (Seumur Hidup)
                                                </span>
                                            </div>
                                            <div className="val-sub-item">
                                                <span className="val-label">Pangkalan Data</span>
                                                <span className="val-val">
                                                    Biro Organisasi Keanggotaan dan Kepegawaian Setjen DPD RI
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* 3. COMPACT ACTION TOOLBAR (BOTTOM) */}
                            <div className="val-action-bar">
                                <div className="val-action-left">
                                    {certificate.course_slug && (
                                        <Link
                                            to={`/course-detail/${certificate.course_slug}/`}
                                            className="btn btn-val-cta"
                                        >
                                            <i className="fas fa-book-open me-2"></i>
                                            Silabus & Materi Kursus
                                        </Link>
                                    )}

                                    <button
                                        type="button"
                                        className="btn btn-val-print"
                                        onClick={() => window.print()}
                                    >
                                        <i className="fas fa-print me-2"></i>
                                        Cetak Hasil Verifikasi
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-val-share"
                                        onClick={handleShareLink}
                                    >
                                        <i className="fas fa-share-nodes me-2"></i>
                                        Bagikan Tautan
                                    </button>
                                </div>

                                <div className="val-action-right">
                                    <button
                                        type="button"
                                        className="btn btn-val-home"
                                        onClick={() => navigate('/')}
                                    >
                                        <i className="fas fa-house me-1"></i>
                                        Beranda
                                    </button>
                                </div>
                            </div>

                        </div>
                    ) : null}

                </div>
            </div>

            {/* =========================================================================
                PREVIEW MODAL (FULL SCREEN HIGH-RES INSPECTION)
                ========================================================================= */}
            {showPreviewModal && certificate && (
                <div
                    className="val-modal-backdrop"
                    onClick={() => setShowPreviewModal(false)}
                >
                    <div
                        className="val-modal-dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="val-modal-header">
                            <div>
                                <span className="val-modal-header-tag">
                                    <i className="fas fa-certificate text-amber me-1"></i>
                                    Pratinjau Sertifikat Asli
                                </span>
                                <h4 className="val-modal-title mb-0">{certificate.course_title}</h4>
                                <small className="text-muted">
                                    {certificate.student_name} • {certificate.formatted_certificate_id || certificate.certificate_id}
                                </small>
                            </div>
                            <button
                                type="button"
                                className="val-modal-close"
                                onClick={() => setShowPreviewModal(false)}
                                title="Tutup (Esc)"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="val-modal-body">
                            {imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt={`Sertifikat ${certificate.course_title}`}
                                    className="val-modal-img"
                                />
                            ) : (
                                <div className="val-modal-empty">Gambar sertifikat tidak tersedia</div>
                            )}
                        </div>

                        <div className="val-modal-footer">
                            <button
                                type="button"
                                className="btn btn-val-cta"
                                onClick={downloadCertificate}
                                disabled={downloading}
                            >
                                <i className="fas fa-download me-2"></i>
                                Unduh Gambar (PNG)
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowPreviewModal(false)}
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BaseFooter />
        </>
    );
}

export default CertificateValidation;
