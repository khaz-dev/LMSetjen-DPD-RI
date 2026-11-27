import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import apiInstance from '../../utils/axios';
import Toast from '../plugin/Toast';
import { Helmet } from 'react-helmet-async';
import BaseHeader from '../partials/BaseHeader';
import BaseFooter from '../partials/BaseFooter';
import logoSetjenWebP from '../../assets/logo/logo-setjen-dpd.webp';
import logoSetjenPNG from '../../assets/logo/logo-setjen-dpd.png';
import './CertificateVerify.css';

/**
 * ✨ Redesigned Compact & High-Density Certificate Verification Portal
 * LMSetjen DPD RI - Eliminates excessive white/blank space, high visual prestige,
 * seamless Single & Bulk validation for external and internal auditors.
 */
function CertificateVerify() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('single'); // 'single' | 'bulk'

    // --- State Single Check ---
    const [singleQuery, setSingleQuery] = useState('');
    const [singleLoading, setSingleLoading] = useState(false);
    const [singleResult, setSingleResult] = useState(null);
    const [singleError, setSingleError] = useState(null);
    const [copiedId, setCopiedId] = useState(false);

    // --- State Bulk Check ---
    const [bulkInput, setBulkInput] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkResults, setBulkResults] = useState(null);
    const [bulkFilter, setBulkFilter] = useState('all'); // 'all' | 'valid' | 'invalid'
    const fileInputRef = useRef(null);

    // Format verification inspection timestamp
    const [inspectedAt] = useState(() => {
        try {
            return new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) + ' WIB';
        } catch (e) {
            return 'Hari ini';
        }
    });

    // Check if query is provided in URL params
    useEffect(() => {
        const queryParam = searchParams.get('no') || searchParams.get('query') || searchParams.get('id');
        if (queryParam) {
            setSingleQuery(queryParam);
            executeSingleVerify(queryParam);
        }
    }, [searchParams]);

    // Handle single verification
    const executeSingleVerify = async (queryToSearch) => {
        const query = (queryToSearch !== undefined ? queryToSearch : singleQuery).trim();
        if (!query) {
            Toast().fire({
                icon: 'warning',
                title: 'Nomor Belum Diisi',
                text: 'Ketikkan nomor sertifikat atau token validasi.'
            });
            return;
        }

        setSingleLoading(true);
        setSingleError(null);
        setSingleResult(null);

        try {
            const res = await apiInstance.get('certificate/verify/', {
                params: { query }
            });

            if (res.data && res.data.is_valid && res.data.details) {
                setSingleResult(res.data.details);
                setSingleError(null);
            } else {
                setSingleResult(res.data?.details || null);
                setSingleError(res.data?.message || 'Sertifikat tidak terverifikasi valid.');
            }
        } catch (err) {
            console.error('Error verifying certificate:', err);
            const errMsg = err.response?.data?.message ||
                err.response?.data?.error ||
                `Nomor sertifikat "${query}" tidak ditemukan dalam sistem resmi LMS DPD RI.`;
            setSingleError(errMsg);
            setSingleResult(null);
        } finally {
            setSingleLoading(false);
        }
    };

    const handleSingleSubmit = (e) => {
        if (e) e.preventDefault();
        executeSingleVerify();
    };

    const handleCopyText = (text) => {
        navigator.clipboard.writeText(text);
        setCopiedId(true);
        Toast().fire({
            icon: 'success',
            title: 'Tersalin!',
            text: 'Nomor sertifikat berhasil disalin ke clipboard',
            timer: 1500
        });
        setTimeout(() => setCopiedId(false), 2000);
    };

    // Parse bulk input into array of items
    const detectedBulkItems = useMemo(() => {
        if (!bulkInput) return [];
        const lines = bulkInput.split(/[\r\n,;]+/);
        const unique = [];
        const seen = new Set();
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
                const upper = trimmed.toUpperCase();
                if (!seen.has(upper)) {
                    seen.add(upper);
                    unique.push(trimmed);
                }
            }
        }
        return unique;
    }, [bulkInput]);

    // Handle bulk verification
    const executeBulkVerify = async () => {
        if (detectedBulkItems.length === 0) {
            Toast().fire({
                icon: 'warning',
                title: 'Data Masih Kosong',
                text: 'Masukkan minimal satu nomor sertifikat pada form bulk.'
            });
            return;
        }

        if (detectedBulkItems.length > 100) {
            Toast().fire({
                icon: 'warning',
                title: 'Maksimal 100 Nomor',
                text: 'Pengecekan massal dibatasi hingga 100 nomor per permintaan untuk performa optimal.'
            });
        }

        setBulkLoading(true);
        try {
            const res = await apiInstance.post('certificate/verify/bulk/', {
                queries: detectedBulkItems.slice(0, 100)
            });

            setBulkResults(res.data);
            Toast().fire({
                icon: 'success',
                title: 'Verifikasi Massal Selesai',
                text: `${res.data.valid_count} dari ${res.data.total_checked} sertifikat terverifikasi valid.`
            });
        } catch (err) {
            console.error('Error bulk verifying certificates:', err);
            Toast().fire({
                icon: 'error',
                title: 'Gagal Memproses Verifikasi Massal',
                text: err.response?.data?.error || 'Terjadi kesalahan sistem, silakan coba beberapa saat lagi.'
            });
        } finally {
            setBulkLoading(false);
        }
    };

    // Handle file upload for bulk
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === 'string') {
                setBulkInput(content);
                Toast().fire({
                    icon: 'info',
                    title: 'File Berhasil Dimuat',
                    text: 'Daftar nomor sertifikat telah diimpor ke form.',
                    timer: 2000
                });
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Export bulk results to CSV
    const exportBulkToCSV = () => {
        if (!bulkResults?.results || bulkResults.results.length === 0) return;

        const headers = ['No', 'Nomor Input', 'Status Keabsahan', 'ID Sertifikat', 'Nama Peserta', 'Pelatihan / Kursus', 'Tanggal Terbit', 'Jumlah JP'];
        const rows = bulkResults.results.map((item, idx) => {
            const d = item.details;
            return [
                idx + 1,
                `"${(item.query || '').replace(/"/g, '""')}"`,
                item.is_valid ? 'VALID' : 'TIDAK VALID / TIDAK DITEMUKAN',
                `"${(d?.formatted_certificate_id || d?.certificate_id || '-').replace(/"/g, '""')}"`,
                `"${(d?.student_name || '-').replace(/"/g, '""')}"`,
                `"${(d?.course_title || '-').replace(/"/g, '""')}"`,
                `"${(d?.issued_date || d?.completion_date || '-').replace(/"/g, '""')}"`,
                d?.total_jam_pelatihan ? `${d.total_jam_pelatihan} JP` : '-'
            ];
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Verifikasi_Sertifikat_DPDRI_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Filtered bulk results
    const filteredBulkResults = useMemo(() => {
        if (!bulkResults?.results) return [];
        if (bulkFilter === 'valid') return bulkResults.results.filter(r => r.is_valid);
        if (bulkFilter === 'invalid') return bulkResults.results.filter(r => !r.is_valid);
        return bulkResults.results;
    }, [bulkResults, bulkFilter]);

    return (
        <div className="cv-page-wrapper">
            <Helmet>
                <title>Verifikasi Keaslian Sertifikat - LMSetjen DPD RI</title>
                <meta name="description" content="Layanan resmi verifikasi keabsahan sertifikat pelatihan Sekretariat Jenderal DPD RI secara satuan maupun massal." />
            </Helmet>
            <BaseHeader />

            <main className="cv-main-content">
                <section className="cv-section">
                    {/* Background Geometric Grid & Luminous Glow Pattern matching Login section */}
                    <div className="cv-background-pattern" aria-hidden="true" />

                    <div className="cv-container">

                    {/* =========================================================================
                        COMPACT HEADER BANNER WITH EMBEDDED TAB SWITCHER
                        ========================================================================= */}
                    <header className="cv-banner">
                        <div className="cv-banner-left">
                            <div className="cv-logo-badge">
                                <picture>
                                    <source srcSet={logoSetjenWebP} type="image/webp" />
                                    <img src={logoSetjenPNG} alt="Logo DPD RI" className="cv-logo-img" width="38" height="38" />
                                </picture>
                            </div>
                            <div className="cv-banner-titles">
                                <div className="cv-title-row">
                                    <h1 className="cv-title">Verifikasi Keaslian Sertifikat</h1>
                                    <span className="cv-verified-tag">
                                        <span className="cv-pulse-dot"></span> Pangkalan Data Resmi
                                    </span>
                                </div>
                                <p className="cv-subtitle">
                                    Sekretariat Jenderal Dewan Perwakilan Daerah Republik Indonesia • Biro OKK
                                </p>
                            </div>
                        </div>

                        {/* Segmented Tab Switcher */}
                        <div className="cv-tab-switcher" role="tablist" aria-label="Metode Verifikasi">
                            <button
                                type="button"
                                className={`cv-tab-btn ${activeTab === 'single' ? 'active' : ''}`}
                                onClick={() => setActiveTab('single')}
                                role="tab"
                                aria-selected={activeTab === 'single'}
                            >
                                <i className="fas fa-search me-1"></i>
                                Cek Satuan
                            </button>
                            <button
                                type="button"
                                className={`cv-tab-btn ${activeTab === 'bulk' ? 'active' : ''}`}
                                onClick={() => setActiveTab('bulk')}
                                role="tab"
                                aria-selected={activeTab === 'bulk'}
                            >
                                <i className="fas fa-layer-group me-1"></i>
                                Cek Massal
                                {bulkResults?.total_checked ? (
                                    <span className="cv-tab-count">{bulkResults.total_checked}</span>
                                ) : null}
                            </button>
                        </div>
                    </header>

                    {/* =========================================================================
                        TAB CONTENT AREA
                        ========================================================================= */}
                    <main className="cv-card">
                        {/* -------------------------------------------------------------
                            TAB 1: SINGLE VERIFICATION
                            ------------------------------------------------------------- */}
                        {activeTab === 'single' && (
                            <div className="cv-tab-pane">
                                {/* Search Form Bar */}
                                <form onSubmit={handleSingleSubmit} className="cv-search-bar-wrap">
                                    <div className="cv-input-box">
                                        <i className="fas fa-barcode cv-input-ico" aria-hidden="true"></i>
                                        <input
                                            type="text"
                                            className="cv-input"
                                            placeholder="Masukkan No. Sertifikat (cth: KP.04/LMS/123456/DPDRI/II/2026 atau 123456)..."
                                            value={singleQuery}
                                            onChange={(e) => setSingleQuery(e.target.value)}
                                            autoFocus
                                            spellCheck={false}
                                        />
                                        {singleQuery && (
                                            <button
                                                type="button"
                                                className="cv-clear-btn"
                                                onClick={() => {
                                                    setSingleQuery('');
                                                    setSingleResult(null);
                                                    setSingleError(null);
                                                }}
                                                title="Bersihkan"
                                                aria-label="Bersihkan input"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        className="cv-btn-verify"
                                        disabled={singleLoading || !singleQuery.trim()}
                                    >
                                        {singleLoading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                Memeriksa...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-shield-halved me-1"></i>
                                                Periksa
                                            </>
                                        )}
                                    </button>
                                </form>

                                {/* Quick Example Chips */}
                                <div className="cv-quick-examples">
                                    <span className="cv-example-label">
                                        <i className="fas fa-lightbulb text-amber me-1"></i>
                                        Format Cepat:
                                    </span>
                                    <button
                                        type="button"
                                        className="cv-example-chip"
                                        onClick={() => {
                                            setSingleQuery('271098');
                                            executeSingleVerify('271098');
                                        }}
                                        title="Klik untuk mencoba ID contoh"
                                    >
                                        <code>271098</code> (Nomor ID)
                                    </button>
                                    <button
                                        type="button"
                                        className="cv-example-chip"
                                        onClick={() => {
                                            setSingleQuery('KP.04/LMS/271098/DPDRI/III/2026');
                                            executeSingleVerify('KP.04/LMS/271098/DPDRI/III/2026');
                                        }}
                                        title="Klik untuk mencoba nomor format lengkap"
                                    >
                                        <code>KP.04/LMS/271098/...</code> (Resmi DPD RI)
                                    </button>
                                </div>

                                {/* ---------------- RESULT: VALID (HIGH DENSITY SHOWCASE) ---------------- */}
                                {singleResult && (
                                    <div className="cv-result-box cv-result-valid">
                                        {/* Status Ribbon */}
                                        <div className="cv-result-header">
                                            <div className="cv-status-pill valid">
                                                <i className="fas fa-circle-check me-1"></i>
                                                Sertifikat Terverifikasi Asli & Valid
                                            </div>
                                            <div className="cv-audit-meta">
                                                <i className="fas fa-fingerprint me-1 text-teal"></i>
                                                <span>Diperiksa: {inspectedAt}</span>
                                                <button
                                                    type="button"
                                                    className="cv-btn-mini-print"
                                                    onClick={() => window.print()}
                                                    title="Cetak Bukti Verifikasi"
                                                >
                                                    <i className="fas fa-print"></i>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Certificate High-Density Spec Grid */}
                                        <div className="cv-spec-grid">
                                            {/* Top Highlight: Official Certificate Number with Copy */}
                                            <div className="cv-spec-col-full">
                                                <div className="cv-cert-id-badge">
                                                    <div className="cv-cert-id-info">
                                                        <span className="cv-spec-label">Nomor Registrasi Sertifikat</span>
                                                        <span className="cv-cert-id-code">
                                                            {singleResult.formatted_certificate_id || singleResult.certificate_id}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="cv-copy-btn"
                                                        onClick={() => handleCopyText(singleResult.formatted_certificate_id || singleResult.certificate_id)}
                                                        title="Salin Nomor Sertifikat"
                                                    >
                                                        <i className={`fas ${copiedId ? 'fa-check text-success' : 'fa-copy'} me-1`}></i>
                                                        {copiedId ? 'Tersalin' : 'Salin'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Recipient Name */}
                                            <div className="cv-spec-cell">
                                                <span className="cv-spec-label">Nama Penerima Sertifikat</span>
                                                <div className="cv-spec-val-primary">
                                                    <i className="fas fa-user-graduate cv-cell-ico text-teal"></i>
                                                    <span>{singleResult.student_name}</span>
                                                </div>
                                            </div>

                                            {/* Course Title */}
                                            <div className="cv-spec-cell">
                                                <span className="cv-spec-label">Judul Pelatihan / Kursus</span>
                                                <div className="cv-spec-val-primary">
                                                    <i className="fas fa-chalkboard text-teal cv-cell-ico"></i>
                                                    <span>{singleResult.course_title}</span>
                                                </div>
                                            </div>

                                            {/* Instructor / Pengampu */}
                                            <div className="cv-spec-cell">
                                                <span className="cv-spec-label">Pengampu / Instruktur</span>
                                                <div className="cv-spec-val">
                                                    <i className="fas fa-user-tie text-muted cv-cell-ico"></i>
                                                    <span>{singleResult.instructor_name}</span>
                                                </div>
                                            </div>

                                            {/* Beban JP */}
                                            <div className="cv-spec-cell">
                                                <span className="cv-spec-label">Beban Pembelajaran</span>
                                                <div className="cv-spec-val">
                                                    <span className="cv-jp-badge">
                                                        <i className="fas fa-clock me-1"></i>
                                                        {singleResult.total_jam_pelatihan || 2} Jam Pelatihan (JP)
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Tanggal Kelulusan & Terbit */}
                                            <div className="cv-spec-cell">
                                                <span className="cv-spec-label">Waktu Kelulusan & Terbit</span>
                                                <div className="cv-spec-val">
                                                    <i className="fas fa-calendar-check text-muted cv-cell-ico"></i>
                                                    <span>{singleResult.issued_date || singleResult.completion_date || '-'}</span>
                                                </div>
                                            </div>

                                            {/* Kategori & Status Integritas */}
                                            <div className="cv-spec-cell">
                                                <span className="cv-spec-label">Kategori & Keabsahan</span>
                                                <div className="cv-spec-val">
                                                    <span className="cv-category-tag">{singleResult.course_category || 'Pelatihan ASN'}</span>
                                                    <span className="cv-active-tag">
                                                        <i className="fas fa-shield-check me-1"></i> Aktif & Sah
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom Action Strip */}
                                        <div className="cv-action-strip">
                                            {singleResult.validation_url && (
                                                <Link
                                                    to={singleResult.validation_url}
                                                    className="cv-btn-cta"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <i className="fas fa-external-link-alt me-1"></i>
                                                    Buka Lembar Sertifikat & QR Code
                                                </Link>
                                            )}
                                            {singleResult.image_file_url && (
                                                <a
                                                    href={singleResult.image_file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="cv-btn-secondary"
                                                >
                                                    <i className="fas fa-image me-1"></i>
                                                    Pratinjau Gambar
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                className="cv-btn-ghost ms-auto"
                                                onClick={() => {
                                                    setSingleQuery('');
                                                    setSingleResult(null);
                                                }}
                                            >
                                                <i className="fas fa-rotate-left me-1"></i> Cek Nomor Lain
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ---------------- RESULT: INVALID / NOT FOUND ---------------- */}
                                {singleError && (
                                    <div className="cv-result-box cv-result-invalid">
                                        <div className="cv-invalid-content">
                                            <div className="cv-invalid-icon-wrap">
                                                <i className="fas fa-circle-exclamation"></i>
                                            </div>
                                            <div className="cv-invalid-body">
                                                <h3 className="cv-invalid-title">Sertifikat Tidak Terverifikasi</h3>
                                                <p className="cv-invalid-desc">{singleError}</p>
                                                <div className="cv-invalid-guide">
                                                    <span>Pastikan penulisan nomor sudah tepat. Nomor dapat ditulis format resmi (<code>KP.04/LMS/123456/...</code>) atau 6 digit nomor uniknya saja.</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* -------------------------------------------------------------
                            TAB 2: BULK VERIFICATION
                            ------------------------------------------------------------- */}
                        {activeTab === 'bulk' && (
                            <div className="cv-tab-pane">
                                {/* Compact Bulk Header Controls */}
                                <div className="cv-bulk-topbar">
                                    <div className="cv-bulk-title-wrap">
                                        <span className="cv-bulk-title">
                                            <i className="fas fa-layer-group text-teal me-1"></i>
                                            Verifikasi Massal (Maksimal 100 Nomor)
                                        </span>
                                        <span className="cv-bulk-counter-chip">
                                            {detectedBulkItems.length} nomor terdeteksi
                                        </span>
                                    </div>

                                    <div className="cv-bulk-actions-wrap">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            style={{ display: 'none' }}
                                            accept=".txt,.csv"
                                            onChange={handleFileUpload}
                                        />
                                        <button
                                            type="button"
                                            className="cv-btn-chip"
                                            onClick={() => fileInputRef.current?.click()}
                                            title="Unggah file .txt/.csv"
                                        >
                                            <i className="fas fa-upload me-1"></i> Unggah File
                                        </button>
                                        <button
                                            type="button"
                                            className="cv-btn-chip"
                                            onClick={() => {
                                                setBulkInput("KP.04/LMS/271098/DPDRI/III/2026\n271098\n999999");
                                            }}
                                            title="Isi contoh nomor"
                                        >
                                            <i className="fas fa-wand-magic-sparkles me-1"></i> Contoh Format
                                        </button>
                                        {bulkInput && (
                                            <button
                                                type="button"
                                                className="cv-btn-chip text-danger"
                                                onClick={() => {
                                                    setBulkInput('');
                                                    setBulkResults(null);
                                                }}
                                                title="Bersihkan teks"
                                            >
                                                <i className="fas fa-trash-alt me-1"></i> Bersihkan
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Compact Textarea */}
                                <div className="cv-bulk-input-container">
                                    <textarea
                                        className="cv-bulk-textarea"
                                        rows={4}
                                        placeholder="Tempelkan daftar nomor sertifikat di sini (pisahkan baris baru atau koma)...&#10;Contoh:&#10;KP.04/LMS/271098/DPDRI/III/2026&#10;271098&#10;999999"
                                        value={bulkInput}
                                        onChange={(e) => setBulkInput(e.target.value)}
                                        spellCheck={false}
                                    />
                                    <button
                                        type="button"
                                        className="cv-bulk-submit-btn"
                                        disabled={bulkLoading || detectedBulkItems.length === 0}
                                        onClick={executeBulkVerify}
                                    >
                                        {bulkLoading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                Memproses ({detectedBulkItems.length})...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-check-double me-1"></i>
                                                Verifikasi {detectedBulkItems.length > 0 ? `(${detectedBulkItems.length} Nomor)` : 'Semua'}
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* ---------------- BULK RESULTS SHOWCASE ---------------- */}
                                {bulkResults && (
                                    <div className="cv-bulk-results-wrap">
                                        {/* Stats Bar & Filter Controls in One Row */}
                                        <div className="cv-bulk-summary-bar">
                                            <div className="cv-stats-group">
                                                <div className="cv-stat-chip total">
                                                    <span className="cv-stat-chip-label">Total:</span>
                                                    <span className="cv-stat-chip-val">{bulkResults.total_checked}</span>
                                                </div>
                                                <div className="cv-stat-chip valid">
                                                    <span className="cv-stat-chip-label">Valid:</span>
                                                    <span className="cv-stat-chip-val">{bulkResults.valid_count}</span>
                                                </div>
                                                <div className="cv-stat-chip invalid">
                                                    <span className="cv-stat-chip-label">Tidak Valid:</span>
                                                    <span className="cv-stat-chip-val">{bulkResults.invalid_count}</span>
                                                </div>
                                            </div>

                                            <div className="cv-filter-group">
                                                <div className="cv-filter-pills">
                                                    <button
                                                        type="button"
                                                        className={`cv-filter-pill ${bulkFilter === 'all' ? 'active' : ''}`}
                                                        onClick={() => setBulkFilter('all')}
                                                    >
                                                        Semua ({bulkResults.results.length})
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`cv-filter-pill ${bulkFilter === 'valid' ? 'active' : ''}`}
                                                        onClick={() => setBulkFilter('valid')}
                                                    >
                                                        Valid ({bulkResults.valid_count})
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`cv-filter-pill ${bulkFilter === 'invalid' ? 'active' : ''}`}
                                                        onClick={() => setBulkFilter('invalid')}
                                                    >
                                                        Tidak Valid ({bulkResults.invalid_count})
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="cv-btn-export"
                                                    onClick={exportBulkToCSV}
                                                    title="Unduh hasil verifikasi sebagai file spreadsheet CSV"
                                                >
                                                    <i className="fas fa-file-csv me-1 text-success"></i>
                                                    Ekspor CSV
                                                </button>
                                            </div>
                                        </div>

                                        {/* Dense Results Table */}
                                        <div className="cv-table-container">
                                            <table className="cv-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '40px' }}>#</th>
                                                        <th>Nomor Input</th>
                                                        <th style={{ width: '130px' }}>Status</th>
                                                        <th>Nama Peserta</th>
                                                        <th>Pelatihan / Kursus</th>
                                                        <th style={{ width: '90px' }}>Beban</th>
                                                        <th style={{ width: '60px' }} className="text-center">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredBulkResults.map((item, idx) => {
                                                        const d = item.details;
                                                        return (
                                                            <tr key={`b-${idx}`} className={item.is_valid ? 'cv-tr-valid' : 'cv-tr-invalid'}>
                                                                <td className="text-muted">{idx + 1}</td>
                                                                <td>
                                                                    <code className="cv-query-code">{item.query}</code>
                                                                </td>
                                                                <td>
                                                                    {item.is_valid ? (
                                                                        <span className="cv-badge-status valid">
                                                                            <i className="fas fa-check-circle me-1"></i> Sah & Valid
                                                                        </span>
                                                                    ) : (
                                                                        <span className="cv-badge-status invalid">
                                                                            <i className="fas fa-times-circle me-1"></i> Tidak Valid
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    {d?.student_name ? (
                                                                        <strong className="cv-name-text">{d.student_name}</strong>
                                                                    ) : (
                                                                        <span className="text-muted">-</span>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    {d?.course_title ? (
                                                                        <span className="cv-course-text">{d.course_title}</span>
                                                                    ) : (
                                                                        <span className="text-danger small">{item.message || 'Tidak terdaftar'}</span>
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    {d?.total_jam_pelatihan ? (
                                                                        <span className="cv-jp-micro">
                                                                            {d.total_jam_pelatihan} JP
                                                                        </span>
                                                                    ) : '-'}
                                                                </td>
                                                                <td className="text-center">
                                                                    {d?.validation_url ? (
                                                                        <Link
                                                                            to={d.validation_url}
                                                                            className="cv-btn-table-action"
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            title="Buka Lembar Sertifikat"
                                                                        >
                                                                            <i className="fas fa-arrow-up-right-from-square"></i>
                                                                        </Link>
                                                                    ) : (
                                                                        <span className="text-muted">-</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </main>

                    </div>
                </section>
            </main>

            <BaseFooter />
        </div>
    );
}

export default CertificateVerify;
