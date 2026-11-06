import React from 'react';
import QRCode from 'qrcode.react';
import { moment } from '../../utils/dayjs';
import { LOGO_SETJEN_DPD_BASE64, LOGO_LMSETJEN_DPD_BASE64, TTD_OKK_BASE64, STEMPEL_SEKJEN_BASE64 } from '../../assets/certificateLogos';
import './ModernCertificateDocument.css';

/**
 * ✨ ULTRA-PROFESSIONAL OFFICIAL CERTIFICATE (SETJEN DPD RI)
 * Fixed 1414 x 1000 px dimensions for crisp, razor-sharp 2K/Ultra-HD export via html2canvas.
 */
const ModernCertificateDocument = React.forwardRef(({
    certificate,
    course,
    userData,
    templateConfig = null,
    style = {}
}, ref) => {
    if (!certificate) return null;

    // Config overrides with elegant defaults
    const cfg = templateConfig || {};
    const agencySup = cfg.agency_sup || "Dewan Perwakilan Daerah Republik Indonesia";
    const agencyMain = cfg.agency_main || "Sekretariat Jenderal";
    const agencySub = cfg.agency_sub || "Pusat Pengembangan Sumber Daya Manusia Aparatur";
    const certTitle = cfg.certificate_title || "Sertifikat Kelulusan";
    const certSubTitle = cfg.certificate_subtitle || "Certificate of Completion";
    const statementText = cfg.statement_text || "Telah berhasil dan berintegritas menyelesaikan seluruh materi pembelajaran mandiri, penugasan studi kasus, serta memenuhi standar evaluasi kelulusan pada program:";
    const primaryColor = cfg.primary_color || "#0d5c3a";
    const accentColor = cfg.accent_color || "#c59b27";
    const titleFont = cfg.title_font || "'Cinzel', serif";
    const bodyFont = cfg.body_font || "'Montserrat', sans-serif";
    const showGoldSeal = cfg.show_gold_seal !== false;
    const showWatermark = cfg.show_watermark !== false;
    const showBpsdmLogo = cfg.show_bpsdm_logo !== false;
    const showQrCode = cfg.show_qr_code !== false;
    const customBg = cfg.custom_background_url || null;

    // Resolve accurate student name
    const studentName = userData?.full_name || certificate?.student_name || certificate?.user?.full_name || 'Peserta Pelatihan';

    // ✨ RECIPIENT CREDENTIALS (DYNAMIC ASN SMART RESOLUTION: NIP, JABATAN, UNIT KERJA)
    const rawNip = certificate?.student_nip || userData?.nip || certificate?.user?.nip || null;
    const position = certificate?.student_position || userData?.position || certificate?.user?.position || null;
    const unitKerja = certificate?.student_organization_unit || userData?.organization_unit || certificate?.user?.organization_unit || null;

    let formattedNip = null;
    if (rawNip && String(rawNip).trim() && String(rawNip).trim() !== '-' && String(rawNip).toLowerCase() !== 'null') {
        const cleanNip = String(rawNip).trim().replace(/^NIP[\.\:\s]*/i, '');
        formattedNip = `NIP. ${cleanNip}`;
    }

    // Dynamic resolution for ASN vs Non-ASN / Eksternal
    let primaryCredential = '';
    let secondaryCredential = '';

    if (formattedNip) {
        primaryCredential = formattedNip;
        if (position && unitKerja) {
            secondaryCredential = `${position} — ${unitKerja}`;
        } else if (position) {
            secondaryCredential = `${position} — Sekretariat Jenderal DPD RI`;
        } else if (unitKerja) {
            secondaryCredential = `${unitKerja} — Setjen DPD RI`;
        } else {
            secondaryCredential = 'Aparatur Sipil Negara • Sekretariat Jenderal DPD RI';
        }
    } else if (position || unitKerja) {
        primaryCredential = position || 'Aparatur Sipil Negara';
        secondaryCredential = unitKerja ? `${unitKerja} — Setjen DPD RI` : 'Sekretariat Jenderal DPD RI';
    } else {
        // Formal honorable fallback for public / external / intern
        primaryCredential = 'Peserta Program Pengembangan Sumber Daya Manusia Aparatur';
        secondaryCredential = 'Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia';
    }

    // Resolve course title & metadata
    const courseTitle = course?.course?.title || certificate?.course?.title || 'Program Pelatihan Kompetensi';
    const totalJP = course?.course?.total_jam_pelatihan || certificate?.course?.total_jam_pelatihan || 2;
    const categoryName = course?.course?.category?.title || certificate?.course?.category?.title || 'Pelatihan Mandiri Digital';
    const instructorName = course?.course?.teacher?.full_name || certificate?.instructor_name || 'Fasilitator & Tenaga Pengajar';

    // Resolve certificate ID
    const formattedId = certificate?.formatted_certificate_id || certificate?.certificate_id || 'KP.04/LMS/DPDRI/2026';
    const validationToken = certificate?.validation_token || certificate?.certificate_id;

    // Format completion date in Indonesian
    const certDate = certificate?.date
        ? moment(certificate.date).format('DD MMMM YYYY')
        : moment().format('DD MMMM YYYY');

    // QR validation URL
    const qrUrl = certificate?.qr_code_url || (validationToken ? `${window.location.origin}/certificate/validate/${validationToken}/` : window.location.href);

    const mergedStyle = {
        '--cert-primary': primaryColor,
        '--cert-accent': accentColor,
        '--cert-gold': accentColor,
        '--font-title': titleFont,
        '--font-body': bodyFont,
        ...(customBg ? { backgroundImage: `url(${customBg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
        ...style
    };

    return (
        <div
            className="modern-certificate-container"
            ref={ref}
            style={mergedStyle}
        >
            {/* Background Watermark & Frame */}
            {showWatermark && !customBg && (
                <div className="modern-certificate-bg">
                    <div
                        className="modern-certificate-watermark"
                        style={{ backgroundImage: `url(${LOGO_SETJEN_DPD_BASE64})` }}
                    />
                </div>
            )}

            {/* Triple Luxury Border System */}
            {!customBg && (
                <>
                    <div className="modern-cert-outer-border" style={{ borderColor: primaryColor }} />
                    <div className="modern-cert-inner-border" style={{ borderColor: accentColor }} />
                    <div className="modern-cert-hairline-border" />
                    <div className="cert-corner cert-corner-tl"><div className="cert-corner-bracket" style={{ borderColor: accentColor }} /></div>
                    <div className="cert-corner cert-corner-tr"><div className="cert-corner-bracket" style={{ borderColor: accentColor }} /></div>
                    <div className="cert-corner cert-corner-bl"><div className="cert-corner-bracket" style={{ borderColor: accentColor }} /></div>
                    <div className="cert-corner cert-corner-br"><div className="cert-corner-bracket" style={{ borderColor: accentColor }} /></div>
                </>
            )}

            {/* Certificate Content */}
            <div className="modern-cert-content">
                {/* 1. Official Kop Lembaga */}
                <div className="modern-cert-header">
                    <div className="cert-header-logo-left">
                        <div className="cert-logo-badge">
                            <img src={LOGO_SETJEN_DPD_BASE64} alt="Logo Setjen DPD RI" />
                        </div>
                    </div>
                    <div className="cert-header-text">
                        <h4 className="cert-agency-sup">{agencySup}</h4>
                        <h2 className="cert-agency-main" style={{ color: primaryColor }}>{agencyMain}</h2>
                        <h5 className="cert-agency-sub">{agencySub}</h5>
                    </div>
                    {showBpsdmLogo ? (
                        <div className="cert-header-logo-right">
                            <div className="cert-logo-badge">
                                <img src={LOGO_LMSETJEN_DPD_BASE64} alt="Logo LMSetjen DPD RI" />
                            </div>
                        </div>
                    ) : (
                        <div className="cert-header-logo-right" style={{ width: '130px' }} />
                    )}
                </div>

                {/* Symmetrical Gold Divider */}
                <div className="cert-header-divider">
                    <div className="cert-divider-line" style={{ background: `linear-gradient(90deg, transparent, ${accentColor})` }} />
                    <span className="cert-divider-diamond" style={{ color: accentColor }}>✦</span>
                    <div className="cert-divider-line" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
                </div>

                {/* 2. Certificate Title & Registration Number */}
                <div className="modern-cert-title-area">
                    <h1 className="modern-cert-main-title" style={{ fontFamily: titleFont, color: primaryColor }}>{certTitle}</h1>
                    <div className="modern-cert-english-title">{certSubTitle}</div>
                    <div className="modern-cert-number-capsule" style={{ borderColor: accentColor, color: primaryColor }}>
                        NOMOR: {formattedId}
                    </div>
                </div>

                {/* 3. Recipient Section */}
                <div className="modern-cert-recipient-area">
                    <p className="cert-awarded-to">Diberikan dengan penuh kehormatan kepada:</p>
                    <h2 className="cert-student-name" style={{ color: primaryColor }}>{studentName}</h2>
                    <div className="cert-name-ornament">
                        <div className="cert-name-line" style={{ background: `linear-gradient(90deg, transparent, ${accentColor})` }} />
                        <span className="cert-name-star" style={{ color: accentColor }}>✦</span>
                        <div className="cert-name-line" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
                    </div>

                    {/* ✨ Dynamic Official Credentials (NIP, Jabatan, Satker / Fallback Kedinasan) */}
                    <div className="cert-credentials-container">
                        {formattedNip ? (
                            <div className="cert-nip-row">
                                <span className="cert-nip-badge" style={{ borderColor: accentColor }}>
                                    <span className="cert-nip-prefix">NIP.</span>
                                    <span className="cert-nip-number">{formattedNip.replace(/^NIP[\.\:\s]*/i, '')}</span>
                                </span>
                            </div>
                        ) : null}

                        <div className="cert-position-row">
                            <span className={`cert-position-text ${!formattedNip ? 'cert-non-nip' : ''}`}>
                                {formattedNip ? secondaryCredential : primaryCredential}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 4. Achievement & Course Information */}
                <div className="modern-cert-achievement-area">
                    <p className="cert-achievement-intro">
                        {statementText}
                    </p>
                    <div className="cert-course-title-box" style={{ borderLeftColor: accentColor, borderRightColor: accentColor }}>
                        <h3 className="cert-course-title" style={{ color: primaryColor }}>“{courseTitle}”</h3>
                    </div>
                    <div className="cert-meta-badges">
                        <span className="cert-meta-chip">
                            <i className="fas fa-clock me-1"></i> Beban Belajar: {totalJP} Jam Pelatihan (JP)
                        </span>
                        <span className="cert-meta-chip">
                            <i className="fas fa-tag me-1"></i> {categoryName}
                        </span>
                        <span className="cert-meta-chip chip-gold" style={{ borderColor: accentColor }}>
                            <i className="fas fa-check-double me-1" style={{ color: accentColor }}></i> Predikat: Lulus Memuaskan
                        </span>
                    </div>
                </div>

                {/* 5. Footer Triad: Verification QR, Official Gold Seal, Signature */}
                <div className="modern-cert-footer">
                    {/* Left: Security QR Code */}
                    {showQrCode ? (
                        <div className="cert-footer-verification">
                            <div className="cert-qr-frame">
                                <QRCode
                                    value={qrUrl}
                                    size={98}
                                    level="H"
                                    includeMargin={false}
                                    renderAs="canvas"
                                />
                            </div>
                            <div className="cert-qr-info">
                                <div className="cert-qr-title">Keabsahan Digital</div>
                                <div className="cert-qr-desc">
                                    Pindai kode QR untuk memverifikasi keaslian dokumen resmi di Portal LMS Setjen DPD RI.
                                </div>
                                <span className="cert-qr-token">ID: {certificate.certificate_id}</span>
                            </div>
                        </div>
                    ) : <div className="cert-footer-verification" />}

                    {/* Center: Vector Gold Medallion Rosette */}
                    {showGoldSeal ? (
                        <div className="cert-footer-seal">
                            <svg className="gold-seal-rosette" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#fef08a" />
                                        <stop offset="35%" stopColor="#d97706" />
                                        <stop offset="70%" stopColor="#f59e0b" />
                                        <stop offset="100%" stopColor="#92400e" />
                                    </linearGradient>
                                    <linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#064e3b" />
                                        <stop offset="100%" stopColor="#022c22" />
                                    </linearGradient>
                                </defs>
                                {/* Rosette Ribbon Tails */}
                                <path d="M38 72 L26 95 L44 90 L50 82 Z" fill="url(#ribbonGrad)" opacity="0.95" />
                                <path d="M62 72 L74 95 L56 90 L50 82 Z" fill="url(#ribbonGrad)" opacity="0.95" />
                                {/* Rosette 24-point Scalloped Outer Star */}
                                <circle cx="50" cy="46" r="38" fill="url(#goldGradient)" stroke="#78350f" strokeWidth="1" />
                                {/* Inner Gold Rings */}
                                <circle cx="50" cy="46" r="33" fill="#fffbeb" stroke="#d97706" strokeWidth="1.5" strokeDasharray="2 2" />
                                <circle cx="50" cy="46" r="27" fill="url(#goldGradient)" />
                                <circle cx="50" cy="46" r="23" fill="#064e3b" />
                                {/* Center Star & Laurel */}
                                <path d="M50 35 L52.5 42 L60 42.5 L54 47 L56 54.5 L50 50 L44 54.5 L46 47 L40 42.5 L47.5 42 Z" fill="#fef08a" />
                            </svg>
                            <div className="cert-seal-caption">Dokumen Resmi Sah</div>
                            <div className="cert-seal-subcaption">LMSetjen DPD RI</div>
                        </div>
                    ) : <div className="cert-footer-seal" />}

                    {/* Right: Instructor Endorsement & Signature */}
                    <div className="cert-footer-signature">
                        <div className="cert-sig-date">Jakarta, {certDate}</div>
                        <div className="cert-sig-title">{cfg.signatory_title || 'Instruktur / Fasilitator Kursus,'}</div>
                        <div className="cert-sig-img-container">
                            <img
                                src={cfg.stamp_image_url || STEMPEL_SEKJEN_BASE64}
                                alt="Stempel Resmi Sekretariat Jenderal DPD RI"
                                className="cert-official-stamp"
                            />
                            <img
                                src={cfg.signature_image_url || TTD_OKK_BASE64}
                                alt="Tanda Tangan Pejabat"
                                className="cert-sig-image"
                            />
                        </div>
                        <div className="cert-sig-line" />
                        <div className="cert-instructor-name">{cfg.signatory_name || instructorName}</div>
                        <div className="cert-instructor-title">
                            {cfg.signatory_nip ? `NIP. ${cfg.signatory_nip}` : (cfg.signatory_sub_title || 'Tenaga Pengajar & Verifikator Kompetensi')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

ModernCertificateDocument.displayName = 'ModernCertificateDocument';

export default ModernCertificateDocument;

