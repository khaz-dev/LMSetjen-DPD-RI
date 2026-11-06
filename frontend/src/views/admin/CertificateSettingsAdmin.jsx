import React, { useState, useEffect, useRef } from "react";
import AdminHeader from "../partials/AdminHeader";
import Footer from "../partials/Footer";
import BaseHeader from "../partials/BaseHeader";
import apiInstance from "../../utils/axios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";
import ModernCertificateDocument from "../../components/CourseDetail/ModernCertificateDocument";
import "./CertificateSettingsAdmin.css";

const VARIABLE_DICTIONARY = [
    { tag: "{{NAMA_SISWA}}", desc: "Nama lengkap peserta pelatihan (beserta gelar)" },
    { tag: "{{NIP_PEGAWAI}}", desc: "Nomor Induk Pegawai peserta (Format: NIP. 19850315...)" },
    { tag: "{{JABATAN_PEGAWAI}}", desc: "Jabatan fungsional / struktural peserta pelatihan" },
    { tag: "{{UNIT_KERJA}}", desc: "Satuan kerja / Biro / Pusat penempatan peserta" },
    { tag: "{{JUDUL_KURSUS}}", desc: "Judul lengkap program pelatihan / kursus" },
    { tag: "{{NOMOR_SERTIFIKAT}}", desc: "Nomor registrasi resmi sertifikat (KP.04/LMS/...)" },
    { tag: "{{TANGGAL_LULUS}}", desc: "Tanggal kelulusan (Format: 06 November 2026)" },
    { tag: "{{TOTAL_JP}}", desc: "Total Jam Pelatihan (Contoh: 16)" },
    { tag: "{{KATEGORI_KURSUS}}", desc: "Kategori diklat (Contoh: Kepemimpinan / Teknis)" },
    { tag: "{{NAMA_INSTRUKTUR}}", desc: "Nama lengkap fasilitator / instruktur pengampu" },
    { tag: "{{JABATAN_PENANDATANGAN}}", desc: "Jabatan pejabat penandatangan resmi" },
    { tag: "{{NIP_PENANDATANGAN}}", desc: "Nomor Induk Pegawai (NIP) penandatangan" },
    { tag: "{{KODE_QR}}", desc: "URL / Token verifikasi digital keabsahan sertifikat" }
];

const FONT_PRESETS = [
    { label: "Cinzel & Montserrat (Resmi & Elegan)", title: "'Cinzel', serif", body: "'Montserrat', sans-serif" },
    { label: "Playfair Display & Inter (Klasik Modern)", title: "'Playfair Display', serif", body: "'Inter', sans-serif" },
    { label: "Merriweather & Open Sans (Akademik)", title: "'Merriweather', serif", body: "'Open Sans', sans-serif" },
    { label: "Montserrat & Roboto (Formal Birokrasi)", title: "'Montserrat', sans-serif", body: "'Roboto', sans-serif" }
];

const COLOR_PRESETS = [
    { label: "Emerald DPD RI & Emas", primary: "#0d5c3a", accent: "#c59b27" },
    { label: "Royal Navy & Gold", primary: "#0f172a", accent: "#d97706" },
    { label: "Deep Maroon & Emas", primary: "#581c87", accent: "#d97706" },
    { label: "Classic Black & Bronze", primary: "#18181b", accent: "#b45309" }
];

function CertificateSettingsAdmin() {
    const userData = UserData();
    const [activeTab, setActiveTab] = useState("styling");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewScale, setPreviewScale] = useState(0.42);

    // Form state
    const [formData, setFormData] = useState({
        template_name: "Template Resmi Setjen DPD RI",
        primary_color: "#0d5c3a",
        accent_color: "#c59b27",
        title_font: "'Cinzel', serif",
        body_font: "'Montserrat', sans-serif",
        agency_sup: "SEKRETARIAT JENDERAL",
        agency_main: "DEWAN PERWAKILAN DAERAH REPUBLIK INDONESIA",
        agency_sub: "PUSAT PENGEMBANGAN SUMBER DAYA MANUSIA APARATUR",
        certificate_title: "SERTIFIKAT KELULUSAN",
        certificate_subtitle: "Certificate of Completion",
        statement_text: "Telah berhasil dan berintegritas menyelesaikan seluruh materi pembelajaran mandiri, penugasan studi kasus, serta memenuhi standar evaluasi kelulusan pada program:",
        signatory_title: "Kepala Biro Organisasi Keanggotaan dan Kepegawaian",
        signatory_sub_title: "Sekretariat Jenderal DPD RI",
        signatory_name: "Dr. Fitriani, A.P., M.Si.",
        signatory_nip: "19741017 199311 2 001",
        show_gold_seal: true,
        show_watermark: true,
        show_bpsdm_logo: true,
        show_qr_code: true,
        custom_background_url: null,
        pptx_template_url: null
    });

    const [selectedPptx, setSelectedPptx] = useState(null);
    const [selectedBg, setSelectedBg] = useState(null);
    const [bgPreview, setBgPreview] = useState(null);
    const [pptxFeedback, setPptxFeedback] = useState(null);
    const [downloadingPptx, setDownloadingPptx] = useState(false);
    const [isDraggingBg, setIsDraggingBg] = useState(false);
    const [isDraggingPptx, setIsDraggingPptx] = useState(false);
    const [previewRoleMode, setPreviewRoleMode] = useState("asn"); // 'asn' | 'public'

    const pptxInputRef = useRef(null);
    const bgInputRef = useRef(null);

    // Dynamic Dummy sample for live preview (ASN vs Public)
    const activeDummyCertificate = {
        id: 999,
        certificate_id: "202736",
        formatted_certificate_id: "KP.04/LMS/202736/DPDRI/XI/2026",
        validation_token: "dpdri2026demo",
        student_name: userData?.full_name || "Khairil Azmi Ashari, S.Kom",
        student_nip: previewRoleMode === "asn" ? (userData?.nip || "19880420 201101 1 008") : null,
        student_position: previewRoleMode === "asn" ? (userData?.position || "Analis Kebijakan Ahli Muda") : null,
        student_organization_unit: previewRoleMode === "asn" ? (userData?.organization_unit || "Biro Persidangan dan Organisasi") : null,
        instructor_name: "Fasilitator & Pengampu Diklat",
        date: new Date().toISOString()
    };

    const dummyCourse = {
        course: {
            title: "Pengenalan Sistem Pemerintahan Daerah & Tata Kelola Parlemen",
            total_jam_pelatihan: 16,
            category: { title: "Kompetensi Manajerial & Kepemimpinan" },
            teacher: { full_name: "Drs. Hendrawan Wicaksono, M.Si" }
        }
    };

    // Load active config on mount
    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await apiInstance.get("/admin/certificate-template-config/");
            if (res.data) {
                setFormData(prev => ({
                    ...prev,
                    ...res.data
                }));
            }
        } catch (err) {
            console.error("Gagal mengambil konfigurasi template sertifikat:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat template sertifikat"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));
    };

    const handleCopyTag = (tag) => {
        navigator.clipboard.writeText(tag);
        Toast().fire({
            icon: "success",
            title: `Tag ${tag} disalin!`
        });
    };

    const handleColorPreset = (preset) => {
        setFormData(prev => ({
            ...prev,
            primary_color: preset.primary,
            accent_color: preset.accent
        }));
    };

    const handleFontPreset = (preset) => {
        setFormData(prev => ({
            ...prev,
            title_font: preset.title,
            body_font: preset.body
        }));
    };

    const processPptxFile = (file) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.pptx')) {
            Swal.fire({
                icon: 'warning',
                title: 'Format Tidak Sesuai',
                text: 'Harap unggah file PowerPoint dengan ekstensi .pptx'
            });
            return;
        }
        setSelectedPptx(file);
        Toast().fire({
            icon: 'success',
            title: `Berkas ${file.name} berhasil dipilih`
        });
    };

    const handlePptxChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            processPptxFile(file);
        }
    };

    const handlePptxDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDraggingPptx) setIsDraggingPptx(true);
    };

    const handlePptxDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingPptx(true);
    };

    const handlePptxDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDraggingPptx(false);
    };

    const handlePptxDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingPptx(false);
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            processPptxFile(files[0]);
        }
    };

    const processBgFile = (file) => {
        if (!file) return;
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        const isImage = validTypes.includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
        if (!isImage) {
            Swal.fire({
                icon: 'warning',
                title: 'Format Tidak Didukung',
                text: 'Harap unggah berkas gambar dengan format PNG, JPG, JPEG, atau WebP.'
            });
            return;
        }
        setSelectedBg(file);
        const objectUrl = URL.createObjectURL(file);
        setBgPreview(objectUrl);
        Toast().fire({
            icon: 'success',
            title: `Background ${file.name} berhasil dipasang di pratinjau`
        });
    };

    const handleBgChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            processBgFile(file);
        }
    };

    const handleBgDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDraggingBg) setIsDraggingBg(true);
    };

    const handleBgDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingBg(true);
    };

    const handleBgDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDraggingBg(false);
    };

    const handleBgDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingBg(false);
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            processBgFile(files[0]);
        }
    };

    // Remove custom background
    const handleRemoveCustomBg = () => {
        setSelectedBg(null);
        setBgPreview(null);
        setFormData(prev => ({
            ...prev,
            custom_background_url: null,
            remove_custom_background: true
        }));
        if (bgInputRef.current) bgInputRef.current.value = "";
        Toast().fire({
            icon: 'info',
            title: 'Background kustom telah dihapus'
        });
    };

    // Download default PPTX template
    const handleDownloadPPTX = async () => {
        try {
            setDownloadingPptx(true);
            const response = await apiInstance.get('admin/certificate-template-download-pptx/', {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', 'Template_Sertifikat_Setjen_DPD_RI.pptx');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);

            Toast().fire({
                icon: 'success',
                title: 'Master PPTX berhasil diunduh'
            });
        } catch (error) {
            console.error('Gagal mengunduh template PPTX:', error);
            try {
                const base = (apiInstance.defaults.baseURL || '').replace(/\/+$/, '');
                window.open(`${base}/admin/certificate-template-download-pptx/`, '_blank');
            } catch (fallbackError) {
                Toast().fire({
                    icon: 'error',
                    title: 'Gagal mengunduh berkas template PPTX'
                });
            }
        } finally {
            setDownloadingPptx(false);
        }
    };

    // Submit / Save Changes
    const handleSaveConfig = async () => {
        try {
            setSaving(true);
            const form = new FormData();

            // Append all scalar fields
            Object.keys(formData).forEach(key => {
                if (key !== 'pptx_template' && key !== 'custom_background' && key !== 'pptx_template_url' && key !== 'custom_background_url') {
                    form.append(key, formData[key]);
                }
            });

            if (selectedPptx) {
                form.append('pptx_template', selectedPptx);
            }
            if (selectedBg) {
                form.append('custom_background', selectedBg);
            }

            const res = await apiInstance.post("/admin/certificate-template-config/", form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data?.pptx_feedback) {
                setPptxFeedback(res.data.pptx_feedback);
            }

            await Swal.fire({
                icon: "success",
                title: "Berhasil Disimpan!",
                text: "Konfigurasi template sertifikat resmi telah diperbarui dan langsung aktif untuk seluruh sertifikat kursus.",
                confirmButtonColor: "#0d5c3a"
            });

            // Refresh
            fetchConfig();
            setSelectedPptx(null);
            setSelectedBg(null);
            setBgPreview(null);
        } catch (err) {
            console.error("Gagal menyimpan konfigurasi:", err);
            Swal.fire({
                icon: "error",
                title: "Gagal Menyimpan",
                text: err.response?.data?.error || "Terjadi kesalahan saat menyimpan pengaturan sertifikat."
            });
        } finally {
            setSaving(false);
        }
    };

    // Reset to official DPD RI default
    const handleResetDefault = async () => {
        const confirm = await Swal.fire({
            title: "Reset ke Standar Resmi?",
            text: "Pengaturan tata letak, warna, tipografi, dan teks akan dikembalikan ke format sertifikat baku Setjen DPD RI.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Kembalikan ke Standar",
            cancelButtonText: "Batal"
        });

        if (confirm.isConfirmed) {
            try {
                setSaving(true);
                const res = await apiInstance.post("/admin/certificate-template-reset/");
                if (res.data?.config) {
                    setFormData(prev => ({
                        ...prev,
                        ...res.data.config
                    }));
                }
                setBgPreview(null);
                setSelectedBg(null);
                setSelectedPptx(null);

                Toast().fire({
                    icon: "success",
                    title: "Format berhasil direset ke standar resmi!"
                });
            } catch (err) {
                console.error("Gagal mereset template:", err);
                Toast().fire({
                    icon: "error",
                    title: "Gagal mereset template sertifikat"
                });
            } finally {
                setSaving(false);
            }
        }
    };

    // Active config for preview
    const activePreviewConfig = {
        ...formData,
        custom_background_url: bgPreview || formData.custom_background_url
    };

    return (
        <div className="cert-admin-page">
            <BaseHeader />
            <AdminHeader />

            {/* Hero Title Section */}
            <header className="cert-admin-header">
                <div className="container">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                        <div>
                            <div className="cert-badge-active mb-2">
                                <i className="fas fa-certificate text-warning"></i> Master Sertifikat Setjen DPD RI
                            </div>
                            <h1 className="cert-admin-title">Studio Desain & Template Sertifikat</h1>
                            <p className="cert-admin-subtitle mb-0">
                                Kelola template PowerPoint (.pptx), identitas lembaga, tipografi, palet warna, dan variabel dinamis penerbitan sertifikat kelulusan pegawai & aparatur.
                            </p>
                        </div>
                        <div className="d-flex gap-2">
                            <button
                                className="btn btn-outline-light d-inline-flex align-items-center gap-2"
                                onClick={handleDownloadPPTX}
                                disabled={downloadingPptx}
                                title="Unduh Master PPTX ber-placeholder resmi"
                            >
                                {downloadingPptx ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm text-warning" role="status"></span>
                                        <span>Mengunduh...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-file-powerpoint text-warning"></i>
                                        <span>Unduh Master PPTX</span>
                                    </>
                                )}
                            </button>
                            <button
                                className="btn btn-warning text-dark font-weight-bold d-inline-flex align-items-center gap-2"
                                onClick={handleSaveConfig}
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status"></span>
                                        <span>Menyimpan...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-save"></i>
                                        <span>Simpan Perubahan</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container cert-admin-container mt-4">
                <div className="row g-4">
                    {/* LEFT COLUMN: Controls & Settings */}
                    <div className="col-lg-6">
                        {/* Tab Switcher */}
                        <div className="cert-nav-tabs">
                            <button
                                className={`cert-nav-btn ${activeTab === "styling" ? "active" : ""}`}
                                onClick={() => setActiveTab("styling")}
                            >
                                <i className="fas fa-palette"></i> Tata Letak & Styling
                            </button>
                            <button
                                className={`cert-nav-btn ${activeTab === "pptx" ? "active" : ""}`}
                                onClick={() => setActiveTab("pptx")}
                            >
                                <i className="fas fa-file-powerpoint"></i> Master PPTX & Variabel
                            </button>
                            <button
                                className={`cert-nav-btn ${activeTab === "background" ? "active" : ""}`}
                                onClick={() => setActiveTab("background")}
                            >
                                <i className="fas fa-image"></i> Background Grafis
                            </button>
                        </div>

                        {/* TAB 1: STYLING & TEXT */}
                        {activeTab === "styling" && (
                            <>
                                {/* Card: Palet Warna & Font */}
                                <div className="cert-card">
                                    <h3 className="cert-card-title">
                                        <i className="fas fa-paint-brush"></i> Palet Warna & Presets
                                    </h3>

                                    <div className="mb-3">
                                        <label className="cert-form-label">Preset Warna Cepat</label>
                                        <div className="d-flex flex-wrap gap-2 mt-1">
                                            {COLOR_PRESETS.map((p, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2"
                                                    onClick={() => handleColorPreset(p)}
                                                >
                                                    <span style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: p.primary, border: '1px solid #ccc' }}></span>
                                                    <span style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: p.accent, border: '1px solid #ccc' }}></span>
                                                    <span>{p.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="row g-3">
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Warna Utama (Primary)</label>
                                            <div className="color-swatch-group">
                                                <input
                                                    type="color"
                                                    name="primary_color"
                                                    value={formData.primary_color}
                                                    onChange={handleInputChange}
                                                    className="color-swatch-input"
                                                />
                                                <input
                                                    type="text"
                                                    name="primary_color"
                                                    value={formData.primary_color}
                                                    onChange={handleInputChange}
                                                    className="form-control cert-input"
                                                />
                                            </div>
                                            <div className="cert-form-hint">Digunakan untuk kop, teks nama siswa, dan bingkai luar.</div>
                                        </div>

                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Warna Aksen (Gold/Highlight)</label>
                                            <div className="color-swatch-group">
                                                <input
                                                    type="color"
                                                    name="accent_color"
                                                    value={formData.accent_color}
                                                    onChange={handleInputChange}
                                                    className="color-swatch-input"
                                                />
                                                <input
                                                    type="text"
                                                    name="accent_color"
                                                    value={formData.accent_color}
                                                    onChange={handleInputChange}
                                                    className="form-control cert-input"
                                                />
                                            </div>
                                            <div className="cert-form-hint">Digunakan untuk bingkai dalam emas, bintang, dan ornamen.</div>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <label className="cert-form-label">Kombinasi Tipografi (Font Presets)</label>
                                        <div className="d-flex flex-wrap gap-2 mt-1">
                                            {FONT_PRESETS.map((f, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary"
                                                    onClick={() => handleFontPreset(f)}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Card: Identitas Kop & Judul */}
                                <div className="cert-card">
                                    <h3 className="cert-card-title">
                                        <i className="fas fa-landmark"></i> Identitas Kop Lembaga & Teks
                                    </h3>

                                    <div className="mb-3">
                                        <label className="cert-form-label">Kop Lembaga - Tingkat Atas</label>
                                        <input
                                            type="text"
                                            name="agency_sup"
                                            value={formData.agency_sup}
                                            onChange={handleInputChange}
                                            className="form-control cert-input"
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="cert-form-label">Kop Lembaga - Institusi Utama</label>
                                        <input
                                            type="text"
                                            name="agency_main"
                                            value={formData.agency_main}
                                            onChange={handleInputChange}
                                            className="form-control cert-input font-weight-bold"
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="cert-form-label">Kop Lembaga - Pusat / Unit Pengembang</label>
                                        <input
                                            type="text"
                                            name="agency_sub"
                                            value={formData.agency_sub}
                                            onChange={handleInputChange}
                                            className="form-control cert-input"
                                        />
                                    </div>

                                    <div className="row g-3 mb-3">
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Judul Utama Sertifikat</label>
                                            <input
                                                type="text"
                                                name="certificate_title"
                                                value={formData.certificate_title}
                                                onChange={handleInputChange}
                                                className="form-control cert-input"
                                            />
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Sub-Judul Bahasa Inggris</label>
                                            <input
                                                type="text"
                                                name="certificate_subtitle"
                                                value={formData.certificate_subtitle}
                                                onChange={handleInputChange}
                                                className="form-control cert-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="cert-form-label">Pernyataan Kelulusan (Statement Text)</label>
                                        <textarea
                                            name="statement_text"
                                            rows="3"
                                            value={formData.statement_text}
                                            onChange={handleInputChange}
                                            className="form-control cert-input"
                                        />
                                    </div>
                                </div>

                                {/* Card: Penandatangan & Pengesahan */}
                                <div className="cert-card">
                                    <h3 className="cert-card-title">
                                        <i className="fas fa-signature"></i> Pejabat Pengesahan & Toggles
                                    </h3>

                                    <div className="row g-3 mb-3">
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Jabatan Penandatangan</label>
                                            <input
                                                type="text"
                                                name="signatory_title"
                                                value={formData.signatory_title}
                                                onChange={handleInputChange}
                                                className="form-control cert-input"
                                            />
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Nama Pejabat Penandatangan</label>
                                            <input
                                                type="text"
                                                name="signatory_name"
                                                value={formData.signatory_name}
                                                onChange={handleInputChange}
                                                className="form-control cert-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="row g-3 mb-3">
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Instansi Pejabat</label>
                                            <input
                                                type="text"
                                                name="signatory_sub_title"
                                                value={formData.signatory_sub_title}
                                                onChange={handleInputChange}
                                                className="form-control cert-input"
                                            />
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">NIP Pejabat</label>
                                            <input
                                                type="text"
                                                name="signatory_nip"
                                                value={formData.signatory_nip}
                                                onChange={handleInputChange}
                                                className="form-control cert-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="cert-form-label mb-2">Visibilitas Elemen Resmi:</div>
                                    <div className="row g-2">
                                        <div className="col-sm-6">
                                            <div className="form-check form-switch">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id="toggleGoldSeal"
                                                    name="show_gold_seal"
                                                    checked={formData.show_gold_seal}
                                                    onChange={handleInputChange}
                                                />
                                                <label className="form-check-label" htmlFor="toggleGoldSeal">
                                                    Segel Emas Resmi (Gold Medallion)
                                                </label>
                                            </div>
                                        </div>
                                        <div className="col-sm-6">
                                            <div className="form-check form-switch">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id="toggleWatermark"
                                                    name="show_watermark"
                                                    checked={formData.show_watermark}
                                                    onChange={handleInputChange}
                                                />
                                                <label className="form-check-label" htmlFor="toggleWatermark">
                                                    Watermark Lambang DPD RI
                                                </label>
                                            </div>
                                        </div>
                                        <div className="col-sm-6">
                                            <div className="form-check form-switch">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id="toggleBpsdm"
                                                    name="show_bpsdm_logo"
                                                    checked={formData.show_bpsdm_logo}
                                                    onChange={handleInputChange}
                                                />
                                                <label className="form-check-label" htmlFor="toggleBpsdm">
                                                    Logo Pendamping (LMSetjen DPD RI)
                                                </label>
                                            </div>
                                        </div>
                                        <div className="col-sm-6">
                                            <div className="form-check form-switch">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id="toggleQr"
                                                    name="show_qr_code"
                                                    checked={formData.show_qr_code}
                                                    onChange={handleInputChange}
                                                />
                                                <label className="form-check-label" htmlFor="toggleQr">
                                                    QR Code Validasi Digital
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* TAB 2: PPTX MASTER & VARIABLE DICTIONARY */}
                        {activeTab === "pptx" && (
                            <div className="cert-card">
                                <h3 className="cert-card-title">
                                    <i className="fas fa-file-powerpoint text-danger"></i> Template Master PowerPoint (.pptx)
                                </h3>
                                <p className="text-muted small">
                                    Admin dapat mengunduh template PowerPoint resmi Setjen DPD RI, mengedit tata letak, ukuran, dan background sesuka hati di Microsoft PowerPoint, lalu mengunggah kembali file PPTX tersebut ke sistem.
                                </p>

                                <div className="p-3 bg-light rounded-3 mb-4 border d-flex flex-wrap justify-content-between align-items-center gap-3">
                                    <div>
                                        <h6 className="mb-1 font-weight-bold">Unduh Berkas Master PPTX Bawaan</h6>
                                        <p className="mb-0 text-muted small">Lengkap dengan 2 Slide: Slide Template & Kamus Panduan Teknis.</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-teal text-white btn-sm px-3 d-inline-flex align-items-center gap-2"
                                        onClick={handleDownloadPPTX}
                                        disabled={downloadingPptx}
                                    >
                                        {downloadingPptx ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm" role="status"></span>
                                                <span>Mengunduh berkas...</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-download"></i> Unduh (.pptx)
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className="mb-4">
                                    <h5 className="font-weight-bold text-dark mb-2">
                                        <i className="fas fa-tags text-teal me-2"></i> Kamus Variabel Dinamis
                                    </h5>
                                    <p className="text-muted small mb-2">
                                        Gunakan tag di bawah ini di dalam PowerPoint. Sistem LMS akan otomatis mengganti tag dengan data peserta dan kursus yang bersangkutan:
                                    </p>
                                    <div className="var-dict-grid">
                                        {VARIABLE_DICTIONARY.map((v, i) => (
                                            <div className="var-tag-card" key={i}>
                                                <div>
                                                    <span className="var-tag-code">{v.tag}</span>
                                                    <span className="var-tag-label">{v.desc}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn-copy-tag"
                                                    onClick={() => handleCopyTag(v.tag)}
                                                    title="Salin Tag"
                                                >
                                                    <i className="fas fa-copy"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Drag & Drop Upload PPTX */}
                                <div className="mb-3">
                                    <h5 className="font-weight-bold text-dark mb-2">
                                        <i className="fas fa-upload text-teal me-2"></i> Unggah File Master PPTX Baru
                                    </h5>
                                    <input
                                        type="file"
                                        ref={pptxInputRef}
                                        accept=".pptx"
                                        onChange={handlePptxChange}
                                        style={{ display: 'none' }}
                                    />
                                    <div
                                        className={`cert-dropzone ${isDraggingPptx ? 'is-dragging' : ''}`}
                                        onClick={() => pptxInputRef.current?.click()}
                                        onDragOver={handlePptxDragOver}
                                        onDragEnter={handlePptxDragEnter}
                                        onDragLeave={handlePptxDragLeave}
                                        onDrop={handlePptxDrop}
                                        role="button"
                                        tabIndex={0}
                                        title="Klik atau Tarik File .pptx ke sini"
                                    >
                                        <div className="cert-dropzone-icon">
                                            <i className={`fas ${isDraggingPptx ? 'fa-file-arrow-up fa-bounce' : 'fa-file-powerpoint'} text-danger`}></i>
                                        </div>
                                        <h6 className="font-weight-bold mb-1">
                                            {isDraggingPptx 
                                                ? "Lepaskan file PowerPoint (.pptx) di sini..."
                                                : (selectedPptx ? selectedPptx.name : "Pilih atau Tarik (Drag & Drop) file .pptx hasil editan Anda")}
                                        </h6>
                                        <p className="text-muted small mb-0">
                                            Format file harus berupa Microsoft PowerPoint Presentation (.pptx).
                                        </p>
                                    </div>
                                </div>

                                {pptxFeedback && (
                                    <div className="alert alert-info mt-3">
                                        <h6 className="alert-heading font-weight-bold mb-1">
                                            <i className="fas fa-check-circle me-1"></i> Validasi Tag PPTX:
                                        </h6>
                                        <p className="small mb-1">Tag yang ditemukan di dalam slide:</p>
                                        <div className="d-flex flex-wrap gap-1">
                                            {pptxFeedback.found_tags?.map((t, idx) => (
                                                <span key={idx} className="badge bg-success">{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 3: CUSTOM GRAPHIC BACKGROUND */}
                        {activeTab === "background" && (
                            <div className="cert-card">
                                <h3 className="cert-card-title">
                                    <i className="fas fa-image text-primary"></i> Background Grafis Kustom (PNG / JPG)
                                </h3>
                                <p className="text-muted small">
                                    Jika Anda mendesain sertifikat secara visual di PowerPoint, Canva, atau Photoshop, Anda dapat mengekspornya menjadi gambar (PNG/JPG resolusi 1414 × 1000 px) dan mengunggahnya sebagai latar belakang sertifikat.
                                </p>

                                <input
                                    type="file"
                                    ref={bgInputRef}
                                    accept="image/png, image/jpeg, image/webp"
                                    onChange={handleBgChange}
                                    style={{ display: 'none' }}
                                />

                                <div
                                    className={`cert-dropzone mb-3 ${isDraggingBg ? 'is-dragging' : ''}`}
                                    onClick={() => bgInputRef.current?.click()}
                                    onDragOver={handleBgDragOver}
                                    onDragEnter={handleBgDragEnter}
                                    onDragLeave={handleBgDragLeave}
                                    onDrop={handleBgDrop}
                                    role="button"
                                    tabIndex={0}
                                    title="Klik atau Tarik File Gambar ke sini"
                                >
                                    <div className="cert-dropzone-icon">
                                        <i className={`fas ${isDraggingBg ? 'fa-cloud-arrow-down fa-bounce' : 'fa-cloud-upload-alt'} text-teal`}></i>
                                    </div>
                                    <h6 className="font-weight-bold mb-1">
                                        {isDraggingBg 
                                            ? "Lepaskan berkas gambar background di sini..."
                                            : (selectedBg ? selectedBg.name : "Pilih atau Tarik (Drag & Drop) gambar background kustom")}
                                    </h6>
                                    <p className="text-muted small mb-0">
                                        Mendukung format PNG, JPG, JPEG, WebP (Rekomendasi rasio: 1.414 | A4 Landscape, 1414 × 1000 px).
                                    </p>
                                </div>

                                {(bgPreview || formData.custom_background_url) && (
                                    <div className="p-3 bg-light rounded-3 border d-flex justify-content-between align-items-center">
                                        <div className="d-flex align-items-center gap-3">
                                            <img
                                                src={bgPreview || formData.custom_background_url}
                                                alt="Preview Background"
                                                style={{ width: 80, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1' }}
                                            />
                                            <div>
                                                <div className="font-weight-bold small">Background Aktif Terpasang</div>
                                                <div className="text-muted" style={{ fontSize: '0.75rem' }}>Gambar ini akan menjadi latar belakang sertifikat di seluruh sistem.</div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-outline-danger btn-sm"
                                            onClick={handleRemoveCustomBg}
                                        >
                                            <i className="fas fa-trash-alt me-1"></i> Hapus
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Card: Reset Actions */}
                        <div className="cert-card border-danger-subtle">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-danger font-weight-bold mb-1">
                                        <i className="fas fa-undo-alt me-1"></i> Kembalikan ke Setelan Pabrik
                                    </h6>
                                    <p className="text-muted small mb-0">
                                        Reset seluruh format sertifikat kembali ke tata letak dan teks resmi DPD RI bawaan.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm px-3"
                                    onClick={handleResetDefault}
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Real-Time Interactive Live Preview (Light Mode Studio) */}
                    <div className="col-lg-6">
                        <div className="cert-preview-easel">
                            <div className="cert-preview-header">
                                <div className="cert-preview-title">
                                    <i className="fas fa-eye text-teal"></i>
                                    <span>Pratinjau Langsung (Live A4 Preview)</span>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    {/* Interactive ASN vs Public Profile Mode Toggle */}
                                    <div className="btn-group btn-group-sm" role="group">
                                        <button
                                            type="button"
                                            className={`btn btn-sm ${previewRoleMode === 'asn' ? 'btn-teal text-white fw-semibold' : 'btn-outline-secondary'}`}
                                            onClick={() => setPreviewRoleMode('asn')}
                                            title="Pratinjau Profil ASN (NIP & Jabatan Kedinasan)"
                                        >
                                            <i className="fas fa-id-badge me-1"></i> ASN (NIP)
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-sm ${previewRoleMode === 'public' ? 'btn-teal text-white fw-semibold' : 'btn-outline-secondary'}`}
                                            onClick={() => setPreviewRoleMode('public')}
                                            title="Pratinjau Peserta Eksternal / Non-NIP"
                                        >
                                            <i className="fas fa-user-circle me-1"></i> Non-NIP
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary px-2 py-0"
                                        onClick={() => setPreviewScale(p => Math.max(0.30, +(p - 0.05).toFixed(2)))}
                                        title="Perkecil"
                                    >
                                        <i className="fas fa-minus small"></i>
                                    </button>
                                    <input
                                        type="range"
                                        min="0.30"
                                        max="0.75"
                                        step="0.02"
                                        value={previewScale}
                                        onChange={(e) => setPreviewScale(parseFloat(e.target.value))}
                                        style={{ width: 75, cursor: 'pointer' }}
                                        title="Atur Skala Pratinjau"
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-secondary px-2 py-0"
                                        onClick={() => setPreviewScale(p => Math.min(0.75, +(p + 0.05).toFixed(2)))}
                                        title="Perbesar"
                                    >
                                        <i className="fas fa-plus small"></i>
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${previewScale === 0.42 ? 'btn-teal text-white' : 'btn-outline-secondary'} px-2 py-0`}
                                        onClick={() => setPreviewScale(0.42)}
                                        title="Paskan dengan Lebar Layar (Fit)"
                                    >
                                        Fit
                                    </button>
                                    <span className="badge bg-light text-teal border border-teal-subtle font-monospace">
                                        {Math.round(previewScale * 100)}%
                                    </span>
                                </div>
                            </div>

                            {/* Stage dengan Canvas Light Mode & Scaled Viewport tanpa Over-Scroll */}
                            <div className="cert-preview-stage">
                                <div
                                    className="cert-preview-viewport"
                                    style={{
                                        width: `${Math.round(1414 * previewScale)}px`,
                                        height: `${Math.round(1000 * previewScale)}px`,
                                    }}
                                >
                                    <div
                                        className="cert-preview-wrapper"
                                        style={{
                                            width: 1414,
                                            height: 1000,
                                            transform: `scale(${previewScale})`,
                                            transformOrigin: '0 0',
                                        }}
                                    >
                                        <ModernCertificateDocument
                                            certificate={activeDummyCertificate}
                                            course={dummyCourse}
                                            userData={userData}
                                            templateConfig={activePreviewConfig}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Light Mode Info Footer */}
                            <div className="mt-3 p-3 bg-light rounded-3 border border-teal-subtle text-dark small d-flex flex-wrap justify-content-between align-items-center gap-2">
                                <div>
                                    <div className="fw-bold text-dark d-flex align-items-center gap-2">
                                        <i className="fas fa-check-circle text-teal"></i>
                                        <span>Dimensi Standar: A4 Landscape (297 × 210 mm)</span>
                                    </div>
                                    <p className="text-muted small mb-0 mt-1">
                                        Rasio presisi 1.414 : 1 sesuai standar ISO 216 untuk cetak dan unduh dokumen resmi.
                                    </p>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <span className="badge bg-teal text-white px-2 py-1">
                                        <i className="fas fa-file-pdf me-1"></i> A4 Standard
                                    </span>
                                    <span className="badge bg-light text-muted border px-2 py-1">
                                        Ultra-HD (1414 × 1000 px)
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

export default CertificateSettingsAdmin;

