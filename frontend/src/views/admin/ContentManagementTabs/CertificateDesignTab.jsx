import React, { useState, useEffect, useRef, useCallback } from "react";
import apiInstance from "../../../utils/axios";
import UserData from "../../plugin/UserData";
import Toast from "../../plugin/Toast";
import Swal from "sweetalert2";
import ModernCertificateDocument from "../../../components/CourseDetail/ModernCertificateDocument";
import "../CertificateSettingsAdmin.css";

const VARIABLE_DICTIONARY = [
    { tag: "{{NAMA_SISWA}}", desc: "Nama lengkap peserta pelatihan (beserta gelar)", cat: "peserta" },
    { tag: "{{NIP_PEGAWAI}}", desc: "Nomor Induk Pegawai peserta (Format: NIP. 19850315...)", cat: "peserta" },
    { tag: "{{JABATAN_PEGAWAI}}", desc: "Jabatan fungsional / struktural peserta pelatihan", cat: "peserta" },
    { tag: "{{UNIT_KERJA}}", desc: "Satuan kerja / Biro / Pusat penempatan peserta", cat: "peserta" },
    { tag: "{{JUDUL_KURSUS}}", desc: "Judul lengkap program pelatihan / kursus", cat: "kursus" },
    { tag: "{{TOTAL_JP}}", desc: "Total Jam Pelatihan (Contoh: 16 JP)", cat: "kursus" },
    { tag: "{{KATEGORI_KURSUS}}", desc: "Kategori diklat (Contoh: Kepemimpinan / Teknis)", cat: "kursus" },
    { tag: "{{NAMA_INSTRUKTUR}}", desc: "Nama lengkap fasilitator / instruktur pengampu", cat: "kursus" },
    { tag: "{{NOMOR_SERTIFIKAT}}", desc: "Nomor registrasi resmi sertifikat (KP.04/LMS/...)", cat: "legalitas" },
    { tag: "{{TANGGAL_LULUS}}", desc: "Tanggal kelulusan (Format: 06 November 2026)", cat: "legalitas" },
    { tag: "{{JABATAN_PENANDATANGAN}}", desc: "Jabatan pejabat penandatangan resmi", cat: "legalitas" },
    { tag: "{{NIP_PENANDATANGAN}}", desc: "Nomor Induk Pegawai (NIP) penandatangan", cat: "legalitas" },
    { tag: "{{KODE_QR}}", desc: "URL / Token verifikasi digital keabsahan sertifikat", cat: "legalitas" }
];

const OFFICIAL_SIGNER_PRESETS = [
    {
        label: "Kepala Biro OKK",
        title: "Kepala Biro Organisasi Keanggotaan dan Kepegawaian",
        sub_title: "Sekretariat Jenderal DPD RI",
        name: "Dr. Fitriani, A.P., M.Si.",
        nip: "19741017 199311 2 001"
    },
    {
        label: "Sekretaris Jenderal DPD RI",
        title: "Sekretaris Jenderal",
        sub_title: "Dewan Perwakilan Daerah Republik Indonesia",
        name: "Dr. Rahman Hadi, M.Si.",
        nip: "19690924 198903 1 002"
    },
    {
        label: "Plt. Kapus Kajian Daerah",
        title: "Kepala Pusat Kajian Daerah dan Anggaran",
        sub_title: "Sekretariat Jenderal DPD RI",
        name: "Dr. Lalu Niqman Zahir, M.Sos.",
        nip: "19750512 199803 1 003"
    }
];

const FONT_PRESETS = [
    { label: "Cinzel & Montserrat (Resmi & Elegan)", title: "'Cinzel', serif", body: "'Montserrat', sans-serif" },
    { label: "Playfair Display & Inter (Klasik Modern)", title: "'Playfair Display', serif", body: "'Inter', sans-serif" },
    { label: "Merriweather & Open Sans (Akademik)", title: "'Merriweather', serif", body: "'Open Sans', sans-serif" },
    { label: "Montserrat & Roboto (Formal Birokrasi)", title: "'Montserrat', sans-serif", body: "'Roboto', sans-serif" }
];

const COLOR_PRESETS = [
    { label: "Emerald DPD RI & Emas", primary: "#0d5c3a", accent: "#c59b27" },
    { label: "Teal Modern & Gold (LMS)", primary: "#0d9488", accent: "#f59e0b" },
    { label: "Royal Navy & Gold", primary: "#0f172a", accent: "#d97706" },
    { label: "Deep Maroon & Emas", primary: "#581c87", accent: "#d97706" },
    { label: "Classic Black & Bronze", primary: "#18181b", accent: "#b45309" }
];

function CertificateDesignTab() {
    const userData = UserData();
    // Sub-sections: 'visual' (Tata Letak & Visual), 'content' (Kop & Pejabat), 'pptx' (Master PPTX & Background)
    const [activeSection, setActiveSection] = useState("visual");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewScale, setPreviewScale] = useState(0.40);
    const [canvasTheme, setCanvasTheme] = useState("dark"); // 'dark' | 'light'
    const [varSearchQuery, setVarSearchQuery] = useState("");
    const [varCategoryFilter, setVarCategoryFilter] = useState("all"); // 'all' | 'peserta' | 'kursus' | 'legalitas'
    const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

    const stageContainerRef = useRef(null);

    // Form state
    const [formData, setFormData] = useState({
        template_name: "Template Resmi Setjen DPD RI",
        primary_color: "#0d5c3a",
        accent_color: "#c59b27",
        title_font: "'Cinzel', serif",
        body_font: "'Montserrat', sans-serif",
        agency_sup: "SEKRETARIAT JENDERAL",
        agency_main: "DEWAN PERWAKILAN DAERAH REPUBLIK INDONESIA",
        agency_sub: "BIRO ORGANISASI KEANGGOTAAN DAN KEPEGAWAIAN",
        certificate_title: "SERTIFIKAT KELULUSAN",
        certificate_subtitle: "Certificate of Completion",
        statement_text:
            "Telah berhasil dan berintegritas menyelesaikan seluruh materi pembelajaran mandiri, penugasan studi kasus, serta memenuhi standar evaluasi kelulusan pada program:",
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

    // Close fullscreen preview on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                setIsFullscreenPreview(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Dynamic Dummy sample for live preview (ASN vs Public)
    const activeDummyCertificate = {
        id: 999,
        certificate_id: "202736",
        formatted_certificate_id: "KP.04/LMS/202736/DPDRI/XI/2026",
        validation_token: "dpdri2026demo",
        student_name: userData?.full_name || "Khairil Azmi Ashari, S.Kom",
        student_nip: previewRoleMode === "asn" ? userData?.nip || "19880420 201101 1 008" : null,
        student_position: previewRoleMode === "asn" ? userData?.position || "Analis Kebijakan Ahli Muda" : null,
        student_organization_unit:
            previewRoleMode === "asn" ? userData?.organization_unit || "Biro Persidangan dan Organisasi" : null,
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

    const fetchConfig = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiInstance.get("/admin/certificate-template-config/");
            if (res.data) {
                setFormData((prev) => ({
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
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    // Auto-fit scale calculator based on preview stage width
    const handleFitScale = useCallback(() => {
        if (stageContainerRef.current) {
            const containerWidth = stageContainerRef.current.clientWidth - 28;
            if (containerWidth > 200) {
                const fit = Math.min(0.65, Math.max(0.28, +(containerWidth / 1414).toFixed(2)));
                setPreviewScale(fit);
                return;
            }
        }
        setPreviewScale(0.4);
    }, []);

    // Run auto-fit on mount & on window resize
    useEffect(() => {
        const timer = setTimeout(() => {
            handleFitScale();
        }, 120);
        window.addEventListener("resize", handleFitScale);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", handleFitScale);
        };
    }, [handleFitScale, activeSection]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
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
        setFormData((prev) => ({
            ...prev,
            primary_color: preset.primary,
            accent_color: preset.accent
        }));
    };

    const handleFontPreset = (preset) => {
        setFormData((prev) => ({
            ...prev,
            title_font: preset.title,
            body_font: preset.body
        }));
    };

    const handleResetKopDPDRI = () => {
        setFormData((prev) => ({
            ...prev,
            agency_sup: "SEKRETARIAT JENDERAL",
            agency_main: "DEWAN PERWAKILAN DAERAH REPUBLIK INDONESIA",
            agency_sub: "BIRO ORGANISASI KEANGGOTAAN DAN KEPEGAWAIAN"
        }));
        Toast().fire({
            icon: "success",
            title: "Kop resmi Setjen DPD RI diterapkan!"
        });
    };

    const handleApplySignerPreset = (signer) => {
        setFormData((prev) => ({
            ...prev,
            signatory_title: signer.title,
            signatory_sub_title: signer.sub_title,
            signatory_name: signer.name,
            signatory_nip: signer.nip
        }));
        Toast().fire({
            icon: "success",
            title: `Pejabat: ${signer.label} dipilih!`
        });
    };

    const processPptxFile = (file) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".pptx")) {
            Swal.fire({
                icon: "warning",
                title: "Format Tidak Sesuai",
                text: "Harap unggah file PowerPoint dengan ekstensi .pptx"
            });
            return;
        }
        setSelectedPptx(file);
        Toast().fire({
            icon: "success",
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
        const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
        const isImage = validTypes.includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
        if (!isImage) {
            Swal.fire({
                icon: "warning",
                title: "Format Tidak Didukung",
                text: "Harap unggah berkas gambar dengan format PNG, JPG, JPEG, atau WebP."
            });
            return;
        }
        setSelectedBg(file);
        const objectUrl = URL.createObjectURL(file);
        setBgPreview(objectUrl);
        Toast().fire({
            icon: "success",
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

    const handleRemoveCustomBg = () => {
        setSelectedBg(null);
        setBgPreview(null);
        setFormData((prev) => ({
            ...prev,
            custom_background_url: null,
            remove_custom_background: true
        }));
        if (bgInputRef.current) bgInputRef.current.value = "";
        Toast().fire({
            icon: "info",
            title: "Background kustom telah dihapus"
        });
    };

    const handleDownloadPPTX = async () => {
        try {
            setDownloadingPptx(true);
            const response = await apiInstance.get("admin/certificate-template-download-pptx/", {
                responseType: "blob"
            });
            const blob = new Blob([response.data], {
                type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.setAttribute("download", "Template_Sertifikat_Setjen_DPD_RI.pptx");
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);

            Toast().fire({
                icon: "success",
                title: "Master PPTX berhasil diunduh"
            });
        } catch (error) {
            console.error("Gagal mengunduh template PPTX:", error);
            try {
                const base = (apiInstance.defaults.baseURL || "").replace(/\/+$/, "");
                window.open(`${base}/admin/certificate-template-download-pptx/`, "_blank");
            } catch (fallbackError) {
                Toast().fire({
                    icon: "error",
                    title: "Gagal mengunduh berkas template PPTX"
                });
            }
        } finally {
            setDownloadingPptx(false);
        }
    };

    const handleSaveConfig = async () => {
        try {
            setSaving(true);
            const form = new FormData();

            Object.keys(formData).forEach((key) => {
                if (
                    key !== "pptx_template" &&
                    key !== "custom_background" &&
                    key !== "pptx_template_url" &&
                    key !== "custom_background_url"
                ) {
                    form.append(key, formData[key]);
                }
            });

            if (selectedPptx) {
                form.append("pptx_template", selectedPptx);
            }
            if (selectedBg) {
                form.append("custom_background", selectedBg);
            }

            const res = await apiInstance.post("/admin/certificate-template-config/", form, {
                headers: { "Content-Type": "multipart/form-data" }
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
                    setFormData((prev) => ({
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

    const activePreviewConfig = {
        ...formData,
        custom_background_url: bgPreview || formData.custom_background_url
    };

    // Filtered variable tags for search and category
    const filteredVariables = VARIABLE_DICTIONARY.filter((v) => {
        if (varCategoryFilter !== "all" && v.cat !== varCategoryFilter) {
            return false;
        }
        if (varSearchQuery.trim()) {
            const q = varSearchQuery.toLowerCase();
            return v.tag.toLowerCase().includes(q) || v.desc.toLowerCase().includes(q);
        }
        return true;
    });

    return (
        <div className="certificate-design-tab-wrapper">
            {/* 1. COMPACT & EYE-CATCHING STUDIO HEADER TOOLBAR */}
            <div className="cert-studio-header">
                <div className="cert-studio-brand">
                    <div className="cert-studio-icon">
                        <i className="fas fa-award"></i>
                    </div>
                    <div className="cert-studio-info">
                        <div className="cert-studio-title-row">
                            <h2 className="cert-studio-title">Studio Desain Sertifikat</h2>
                            <span className="cert-studio-tag">RESMI DPD RI</span>
                        </div>
                        <div className="cert-studio-chips">
                            <span className="cert-chip" title="Standar Internasional ISO 216">
                                <i className="fas fa-file-pdf text-teal"></i> A4 Landscape (1.414 : 1)
                            </span>
                            <span className="cert-chip" title="Resolusi Ultra-HD 2K untuk cetak jernih">
                                <i className="fas fa-expand text-amber"></i> Ultra-HD 1414×1000px
                            </span>
                            <span className="cert-chip" title="Perubahan live langsung tersinkronisasi">
                                <i className="fas fa-bolt text-teal"></i> Live Sync
                            </span>
                        </div>
                    </div>
                </div>

                <div className="cert-studio-actions">
                    <button
                        type="button"
                        className="btn cert-btn-ghost text-danger"
                        onClick={handleResetDefault}
                        disabled={saving}
                        title="Kembalikan format ke pengaturan standar resmi DPD RI"
                    >
                        <i className="fas fa-undo-alt me-1"></i>
                        <span>Reset Standar</span>
                    </button>

                    <button
                        type="button"
                        className="btn cert-btn-outline"
                        onClick={handleDownloadPPTX}
                        disabled={downloadingPptx}
                        title="Unduh Master PowerPoint (.pptx) dengan 2 slide lengkap"
                    >
                        {downloadingPptx ? (
                            <>
                                <span className="spinner-border spinner-border-sm text-danger" role="status"></span>
                                <span>Mengunduh...</span>
                            </>
                        ) : (
                            <>
                                <i className="fas fa-file-powerpoint text-danger"></i>
                                <span>Unduh PPTX</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        className="btn cert-btn-primary"
                        onClick={handleSaveConfig}
                        disabled={saving}
                        title="Simpan seluruh konfigurasi template sertifikat"
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

            {/* 2. TWO-COLUMN COMPACT STUDIO WORKSPACE */}
            <div className="row g-3 align-items-start">
                {/* LEFT COLUMN: COMPACT SEGMENTED SETTINGS CONTROLS */}
                <div className="col-xl-6 col-lg-12">
                    {/* Modern Segmented Sub-Nav Tabs */}
                    <div className="cert-nav-tabs">
                        <button
                            type="button"
                            className={`cert-nav-btn ${activeSection === "visual" || activeSection === "styling" ? "active" : ""}`}
                            onClick={() => setActiveSection("visual")}
                        >
                            <i className="fas fa-palette"></i>
                            <span>Tata Letak & Visual</span>
                        </button>
                        <button
                            type="button"
                            className={`cert-nav-btn ${activeSection === "content" ? "active" : ""}`}
                            onClick={() => setActiveSection("content")}
                        >
                            <i className="fas fa-feather-alt"></i>
                            <span>Kop & Pejabat</span>
                        </button>
                        <button
                            type="button"
                            className={`cert-nav-btn ${activeSection === "pptx" || activeSection === "background" ? "active" : ""}`}
                            onClick={() => setActiveSection("pptx")}
                        >
                            <i className="fas fa-file-powerpoint"></i>
                            <span>PPTX & Background</span>
                            {selectedPptx || selectedBg ? <span className="cert-nav-pill-dot"></span> : null}
                        </button>
                    </div>

                    {/* TAB 1: TATA LETAK & VISUAL (Colors, Fonts & Toggles) */}
                    {(activeSection === "visual" || activeSection === "styling") && (
                        <div className="cert-tab-content-pane">
                            {/* Card 1: Palet Warna & Presets */}
                            <div className="cert-card">
                                <div className="cert-card-header">
                                    <h3 className="cert-card-title">
                                        <i className="fas fa-paint-brush text-teal"></i>
                                        <span>Palet Warna & Gaya Tema</span>
                                    </h3>
                                    <span className="cert-card-badge">Desain Global</span>
                                </div>

                                <div className="cert-card-body">
                                    {/* Quick Presets */}
                                    <div className="mb-2">
                                        <label className="cert-form-label">Preset Tema Cepat:</label>
                                        <div className="cert-preset-row">
                                            {COLOR_PRESETS.map((p, idx) => {
                                                const isActive =
                                                    formData.primary_color === p.primary &&
                                                    formData.accent_color === p.accent;
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        className={`cert-preset-chip ${isActive ? "active" : ""}`}
                                                        onClick={() => handleColorPreset(p)}
                                                        title={`Terapkan ${p.label}`}
                                                    >
                                                        <span className="cert-dot-dual">
                                                            <span style={{ backgroundColor: p.primary }}></span>
                                                            <span style={{ backgroundColor: p.accent }}></span>
                                                        </span>
                                                        <span className="cert-preset-text">{p.label}</span>
                                                        {isActive && <i className="fas fa-check cert-preset-check"></i>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Custom Color Pickers side by side */}
                                    <div className="row g-2 mb-2">
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Warna Utama (Primary)</label>
                                            <div className="cert-color-input-group">
                                                <input
                                                    type="color"
                                                    name="primary_color"
                                                    value={formData.primary_color}
                                                    onChange={handleInputChange}
                                                    className="cert-color-picker"
                                                    title="Pilih Warna Utama"
                                                />
                                                <input
                                                    type="text"
                                                    name="primary_color"
                                                    value={formData.primary_color}
                                                    onChange={handleInputChange}
                                                    className="form-control form-control-sm cert-input font-monospace"
                                                    placeholder="#0d5c3a"
                                                />
                                            </div>
                                            <div className="cert-form-hint">Teks nama, judul, & bingkai luar</div>
                                        </div>

                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Warna Aksen Emas (Accent)</label>
                                            <div className="cert-color-input-group">
                                                <input
                                                    type="color"
                                                    name="accent_color"
                                                    value={formData.accent_color}
                                                    onChange={handleInputChange}
                                                    className="cert-color-picker"
                                                    title="Pilih Warna Aksen"
                                                />
                                                <input
                                                    type="text"
                                                    name="accent_color"
                                                    value={formData.accent_color}
                                                    onChange={handleInputChange}
                                                    className="form-control form-control-sm cert-input font-monospace"
                                                    placeholder="#c59b27"
                                                />
                                            </div>
                                            <div className="cert-form-hint">Bingkai dalam emas & ornamen</div>
                                        </div>
                                    </div>

                                    {/* Font Presets */}
                                    <div className="mt-2 pt-2 border-top">
                                        <label className="cert-form-label mb-1">
                                            Kombinasi Tipografi (Font Presets):
                                        </label>
                                        <div className="cert-font-presets-grid">
                                            {FONT_PRESETS.map((f, idx) => {
                                                const isActive =
                                                    formData.title_font === f.title &&
                                                    formData.body_font === f.body;
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        className={`cert-font-chip ${isActive ? "active" : ""}`}
                                                        onClick={() => handleFontPreset(f)}
                                                    >
                                                        <i className="fas fa-font me-1"></i>
                                                        <span>{f.label}</span>
                                                        {isActive && (
                                                            <i className="fas fa-check ms-auto text-teal"></i>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Visibilitas Elemen Resmi */}
                            <div className="cert-card">
                                <div className="cert-card-header">
                                    <h3 className="cert-card-title">
                                        <i className="fas fa-shield-alt text-teal"></i>
                                        <span>Visibilitas Elemen Resmi</span>
                                    </h3>
                                    <span className="cert-card-badge">Keaslian & Pengesahan</span>
                                </div>

                                <div className="cert-card-body">
                                    <div className="row g-2">
                                        <div className="col-sm-6">
                                            <div className="cert-toggle-box">
                                                <div className="cert-toggle-meta">
                                                    <i className="fas fa-certificate text-warning cert-toggle-icon"></i>
                                                    <div>
                                                        <div className="cert-toggle-label">Segel Emas Resmi</div>
                                                        <div className="cert-toggle-sub">Medali garuda embos emas</div>
                                                    </div>
                                                </div>
                                                <div className="form-check form-switch p-0 m-0">
                                                    <input
                                                        className="form-check-input cert-switch"
                                                        type="checkbox"
                                                        id="toggleGoldSeal"
                                                        name="show_gold_seal"
                                                        checked={formData.show_gold_seal}
                                                        onChange={handleInputChange}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-sm-6">
                                            <div className="cert-toggle-box">
                                                <div className="cert-toggle-meta">
                                                    <i className="fas fa-shield-alt text-teal cert-toggle-icon"></i>
                                                    <div>
                                                        <div className="cert-toggle-label">Watermark Lambang</div>
                                                        <div className="cert-toggle-sub">Lambang transparan DPD RI</div>
                                                    </div>
                                                </div>
                                                <div className="form-check form-switch p-0 m-0">
                                                    <input
                                                        className="form-check-input cert-switch"
                                                        type="checkbox"
                                                        id="toggleWatermark"
                                                        name="show_watermark"
                                                        checked={formData.show_watermark}
                                                        onChange={handleInputChange}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-sm-6">
                                            <div className="cert-toggle-box">
                                                <div className="cert-toggle-meta">
                                                    <i className="fas fa-landmark text-primary cert-toggle-icon"></i>
                                                    <div>
                                                        <div className="cert-toggle-label">Logo Pendamping</div>
                                                        <div className="cert-toggle-sub">Logo LMSetjen DPD RI</div>
                                                    </div>
                                                </div>
                                                <div className="form-check form-switch p-0 m-0">
                                                    <input
                                                        className="form-check-input cert-switch"
                                                        type="checkbox"
                                                        id="toggleBpsdm"
                                                        name="show_bpsdm_logo"
                                                        checked={formData.show_bpsdm_logo}
                                                        onChange={handleInputChange}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-sm-6">
                                            <div className="cert-toggle-box">
                                                <div className="cert-toggle-meta">
                                                    <i className="fas fa-qrcode text-dark cert-toggle-icon"></i>
                                                    <div>
                                                        <div className="cert-toggle-label">QR Code Validasi</div>
                                                        <div className="cert-toggle-sub">Token otentikasi digital</div>
                                                    </div>
                                                </div>
                                                <div className="form-check form-switch p-0 m-0">
                                                    <input
                                                        className="form-check-input cert-switch"
                                                        type="checkbox"
                                                        id="toggleQr"
                                                        name="show_qr_code"
                                                        checked={formData.show_qr_code}
                                                        onChange={handleInputChange}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: KOP LEMBAGA, TEKS & PEJABAT */}
                    {activeSection === "content" && (
                        <div className="cert-tab-content-pane">
                            {/* Card 1: Kop Lembaga Resmi (3-Tier) */}
                            <div className="cert-card">
                                <div className="cert-card-header">
                                    <h3 className="cert-card-title">
                                        <i className="fas fa-landmark text-teal"></i>
                                        <span>Kop Identitas Lembaga (3-Tier)</span>
                                    </h3>
                                    <button
                                        type="button"
                                        className="btn btn-outline-teal btn-xs d-flex align-items-center gap-1"
                                        onClick={handleResetKopDPDRI}
                                        title="Kembalikan teks kop ke standar resmi Setjen DPD RI"
                                    >
                                        <i className="fas fa-undo-alt"></i> Standar DPD RI
                                    </button>
                                </div>

                                <div className="cert-card-body">
                                    <div className="row g-2 mb-2">
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Tingkat Atas (Sup)</label>
                                            <input
                                                type="text"
                                                name="agency_sup"
                                                value={formData.agency_sup}
                                                onChange={handleInputChange}
                                                className="form-control form-control-sm cert-input"
                                                placeholder="SEKRETARIAT JENDERAL"
                                            />
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Institusi Utama (Main)</label>
                                            <input
                                                type="text"
                                                name="agency_main"
                                                value={formData.agency_main}
                                                onChange={handleInputChange}
                                                className="form-control form-control-sm cert-input fw-bold"
                                                placeholder="DEWAN PERWAKILAN DAERAH REPUBLIK INDONESIA"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="cert-form-label">Biro / Satuan Kerja Pengembang (Sub)</label>
                                        <input
                                            type="text"
                                            name="agency_sub"
                                            value={formData.agency_sub}
                                            onChange={handleInputChange}
                                            className="form-control form-control-sm cert-input"
                                            placeholder="BIRO ORGANISASI KEANGGOTAAN DAN KEPEGAWAIAN"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Judul Sertifikat & Pernyataan */}
                            <div className="cert-card">
                                <div className="cert-card-header">
                                    <h3 className="cert-card-title">
                                        <i className="fas fa-heading text-teal"></i>
                                        <span>Judul Sertifikat & Naskah Kelulusan</span>
                                    </h3>
                                    <span className="cert-card-badge">Isi Sertifikat</span>
                                </div>

                                <div className="cert-card-body">
                                    <div className="row g-2 mb-2">
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Judul Utama</label>
                                            <input
                                                type="text"
                                                name="certificate_title"
                                                value={formData.certificate_title}
                                                onChange={handleInputChange}
                                                className="form-control form-control-sm cert-input fw-semibold"
                                                placeholder="SERTIFIKAT KELULUSAN"
                                            />
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Sub-Judul Bahasa Inggris</label>
                                            <input
                                                type="text"
                                                name="certificate_subtitle"
                                                value={formData.certificate_subtitle}
                                                onChange={handleInputChange}
                                                className="form-control form-control-sm cert-input fst-italic"
                                                placeholder="Certificate of Completion"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="cert-form-label">Naskah Pernyataan Kelulusan (Statement)</label>
                                        <textarea
                                            name="statement_text"
                                            rows="2"
                                            value={formData.statement_text}
                                            onChange={handleInputChange}
                                            className="form-control form-control-sm cert-input"
                                            placeholder="Telah berhasil dan berintegritas menyelesaikan seluruh materi..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Pejabat Penandatangan Resmi */}
                            <div className="cert-card">
                                <div className="cert-card-header">
                                    <h3 className="cert-card-title">
                                        <i className="fas fa-signature text-teal"></i>
                                        <span>Pejabat Penandatangan Resmi</span>
                                    </h3>
                                    <span className="cert-card-badge">Otoritas Valid</span>
                                </div>

                                <div className="cert-card-body">
                                    {/* Presets Pejabat */}
                                    <div className="mb-2">
                                        <label className="cert-form-label">Pilih Cepat Pejabat Berwenang:</label>
                                        <div className="cert-preset-row">
                                            {OFFICIAL_SIGNER_PRESETS.map((s, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className={`cert-preset-chip ${formData.signatory_nip === s.nip ? "active" : ""}`}
                                                    onClick={() => handleApplySignerPreset(s)}
                                                    title={`Gunakan data: ${s.title}`}
                                                >
                                                    <i className="fas fa-user-check me-1 text-teal"></i>
                                                    <span>{s.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="row g-2 mb-2">
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Jabatan Penandatangan</label>
                                            <input
                                                type="text"
                                                name="signatory_title"
                                                value={formData.signatory_title}
                                                onChange={handleInputChange}
                                                className="form-control form-control-sm cert-input"
                                                placeholder="Kepala Biro Organisasi Keanggotaan..."
                                            />
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Nama Pejabat</label>
                                            <input
                                                type="text"
                                                name="signatory_name"
                                                value={formData.signatory_name}
                                                onChange={handleInputChange}
                                                className="form-control form-control-sm cert-input fw-bold"
                                                placeholder="Dr. Fitriani, A.P., M.Si."
                                            />
                                        </div>
                                    </div>

                                    <div className="row g-2">
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">Instansi Pejabat</label>
                                            <input
                                                type="text"
                                                name="signatory_sub_title"
                                                value={formData.signatory_sub_title}
                                                onChange={handleInputChange}
                                                className="form-control form-control-sm cert-input"
                                                placeholder="Sekretariat Jenderal DPD RI"
                                            />
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="cert-form-label">NIP Pejabat</label>
                                            <input
                                                type="text"
                                                name="signatory_nip"
                                                value={formData.signatory_nip}
                                                onChange={handleInputChange}
                                                className="form-control form-control-sm cert-input font-monospace"
                                                placeholder="19741017 199311 2 001"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: MASTER PPTX & BACKGROUND GRAFIS */}
                    {(activeSection === "pptx" || activeSection === "background") && (
                        <div className="cert-tab-content-pane">
                            {/* Card 1: Template Master PPTX & Background Dual Action */}
                            <div className="cert-card">
                                <div className="cert-card-header">
                                    <h3 className="cert-card-title">
                                        <i className="fas fa-file-powerpoint text-danger"></i>
                                        <span>Master PowerPoint & Background</span>
                                    </h3>
                                    <span className="cert-card-badge">Aset Eksternal</span>
                                </div>

                                <div className="cert-card-body">
                                    <div className="row g-2 mb-3">
                                        {/* Download Quick Box */}
                                        <div className="col-sm-6">
                                            <div className="cert-asset-action-box">
                                                <div className="d-flex align-items-center gap-2 mb-2">
                                                    <i className="fas fa-file-powerpoint fs-4 text-danger"></i>
                                                    <div>
                                                        <div className="fw-bold small">Master PPTX Baku</div>
                                                        <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                            2 Slide: Template & Kamus
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-1"
                                                    onClick={handleDownloadPPTX}
                                                    disabled={downloadingPptx}
                                                >
                                                    <i className="fas fa-download"></i>
                                                    <span>Unduh Master .PPTX</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Background Preview / Status Box */}
                                        <div className="col-sm-6">
                                            <div className="cert-asset-action-box">
                                                <div className="d-flex align-items-center gap-2 mb-2">
                                                    <i className="fas fa-image fs-4 text-teal"></i>
                                                    <div>
                                                        <div className="fw-bold small">Background Kustom</div>
                                                        <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                            {bgPreview || formData.custom_background_url
                                                                ? "Terpasang Aktif"
                                                                : "Bawaan Sistem"}
                                                        </div>
                                                    </div>
                                                </div>
                                                {bgPreview || formData.custom_background_url ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger btn-sm w-100 d-flex align-items-center justify-content-center gap-1"
                                                        onClick={handleRemoveCustomBg}
                                                    >
                                                        <i className="fas fa-trash-alt"></i>
                                                        <span>Hapus Background</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-teal btn-sm w-100 d-flex align-items-center justify-content-center gap-1"
                                                        onClick={() => bgInputRef.current?.click()}
                                                    >
                                                        <i className="fas fa-upload"></i>
                                                        <span>Unggah Gambar</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Upload Inputs Hidden */}
                                    <input
                                        type="file"
                                        ref={pptxInputRef}
                                        accept=".pptx"
                                        onChange={handlePptxChange}
                                        style={{ display: "none" }}
                                    />
                                    <input
                                        type="file"
                                        ref={bgInputRef}
                                        accept="image/png, image/jpeg, image/webp"
                                        onChange={handleBgChange}
                                        style={{ display: "none" }}
                                    />

                                    {/* Compact Dropzone: PPTX */}
                                    <div className="mb-2">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <label className="cert-form-label mb-0">Unggah Template PPTX Baru:</label>
                                            {selectedPptx && (
                                                <span className="badge bg-success small">
                                                    <i className="fas fa-check me-1"></i> Terpilih
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className={`cert-compact-dropzone ${isDraggingPptx ? "is-dragging" : ""} ${selectedPptx ? "has-file" : ""}`}
                                            onClick={() => pptxInputRef.current?.click()}
                                            onDragOver={handlePptxDragOver}
                                            onDragEnter={handlePptxDragEnter}
                                            onDragLeave={handlePptxDragLeave}
                                            onDrop={handlePptxDrop}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <i
                                                className={`fas ${selectedPptx ? "fa-file-circle-check text-success" : "fa-file-powerpoint text-danger"} cert-compact-icon`}
                                            ></i>
                                            <div className="cert-compact-droptext">
                                                <span className="fw-semibold">
                                                    {selectedPptx ? selectedPptx.name : "Klik atau Tarik file .pptx ke sini"}
                                                </span>
                                                <span className="text-muted small ms-1">
                                                    (.pptx hasil editan Microsoft PowerPoint)
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Compact Dropzone: Background Image */}
                                    <div>
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <label className="cert-form-label mb-0">Unggah Gambar Latar (PNG/JPG):</label>
                                            {(bgPreview || selectedBg) && (
                                                <span className="badge bg-teal text-white small">
                                                    <i className="fas fa-check me-1"></i> Preview Aktif
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className={`cert-compact-dropzone ${isDraggingBg ? "is-dragging" : ""} ${selectedBg ? "has-file" : ""}`}
                                            onClick={() => bgInputRef.current?.click()}
                                            onDragOver={handleBgDragOver}
                                            onDragEnter={handleBgDragEnter}
                                            onDragLeave={handleBgDragLeave}
                                            onDrop={handleBgDrop}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <i
                                                className={`fas ${selectedBg ? "fa-image text-success" : "fa-cloud-upload-alt text-teal"} cert-compact-icon`}
                                            ></i>
                                            <div className="cert-compact-droptext">
                                                <span className="fw-semibold">
                                                    {selectedBg
                                                        ? selectedBg.name
                                                        : "Tarik gambar background (Rasio 1.414 | 1414×1000px)"}
                                                </span>
                                                <span className="text-muted small ms-1">(PNG, JPG, WebP)</span>
                                            </div>
                                        </div>
                                    </div>

                                    {pptxFeedback && (
                                        <div className="alert alert-info py-2 px-3 mt-2 mb-0 small">
                                            <div className="fw-bold mb-1">
                                                <i className="fas fa-check-circle me-1"></i> Validasi Tag PPTX:
                                            </div>
                                            <div className="d-flex flex-wrap gap-1">
                                                {pptxFeedback.found_tags?.map((t, idx) => (
                                                    <span key={idx} className="badge bg-success">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card 2: Kamus Variabel Dinamis PPTX (Searchable & Compact with Category Filter) */}
                            <div className="cert-card">
                                <div className="cert-card-header">
                                    <h3 className="cert-card-title">
                                        <i className="fas fa-tags text-teal"></i>
                                        <span>Kamus Variabel Dinamis PPTX</span>
                                    </h3>
                                    <span className="badge bg-teal-subtle text-teal font-monospace small">
                                        {filteredVariables.length} Tag
                                    </span>
                                </div>

                                <div className="cert-card-body">
                                    {/* Category Filter Chips for Variables */}
                                    <div className="d-flex flex-wrap gap-1 mb-2">
                                        <button
                                            type="button"
                                            className={`btn btn-xs ${varCategoryFilter === "all" ? "btn-teal text-white" : "btn-outline-secondary"}`}
                                            onClick={() => setVarCategoryFilter("all")}
                                        >
                                            Semua ({VARIABLE_DICTIONARY.length})
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-xs ${varCategoryFilter === "peserta" ? "btn-teal text-white" : "btn-outline-secondary"}`}
                                            onClick={() => setVarCategoryFilter("peserta")}
                                        >
                                            Peserta & ASN (4)
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-xs ${varCategoryFilter === "kursus" ? "btn-teal text-white" : "btn-outline-secondary"}`}
                                            onClick={() => setVarCategoryFilter("kursus")}
                                        >
                                            Kursus & Diklat (4)
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-xs ${varCategoryFilter === "legalitas" ? "btn-teal text-white" : "btn-outline-secondary"}`}
                                            onClick={() => setVarCategoryFilter("legalitas")}
                                        >
                                            Otoritas & Legalitas (5)
                                        </button>
                                    </div>

                                    {/* Search input for variables */}
                                    <div className="input-group input-group-sm mb-2">
                                        <span className="input-group-text bg-white border-end-0">
                                            <i className="fas fa-search text-muted"></i>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm border-start-0"
                                            placeholder="Cari tag variabel (contoh: NIP, SISWA, KURSUS)..."
                                            value={varSearchQuery}
                                            onChange={(e) => setVarSearchQuery(e.target.value)}
                                        />
                                        {varSearchQuery && (
                                            <button
                                                className="btn btn-outline-secondary btn-sm"
                                                onClick={() => setVarSearchQuery("")}
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>

                                    {/* Compact Variable Tag List */}
                                    <div className="cert-var-tag-list">
                                        {filteredVariables.map((v, i) => (
                                            <div
                                                className="cert-var-tag-pill"
                                                key={i}
                                                onClick={() => handleCopyTag(v.tag)}
                                                title={`Klik untuk menyalin: ${v.tag}`}
                                            >
                                                <span className="cert-var-code">{v.tag}</span>
                                                <span className="cert-var-desc">{v.desc}</span>
                                                <button
                                                    type="button"
                                                    className="cert-var-copy-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopyTag(v.tag);
                                                    }}
                                                >
                                                    <i className="fas fa-copy"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: REAL-TIME INTERACTIVE LIVE PREVIEW EASEL */}
                <div className="col-xl-6 col-lg-12">
                    <div className="cert-preview-easel">
                        {/* Easel Studio Header Bar */}
                        <div className="cert-preview-header">
                            <div className="cert-preview-title-group">
                                <div className="cert-preview-title">
                                    <i className="fas fa-eye text-teal"></i>
                                    <span>Pratinjau Langsung (A4)</span>
                                </div>

                                {/* Dynamic Recipient Profile Mode Toggle (ASN vs Public) */}
                                <div className="cert-mode-pill-toggle">
                                    <button
                                        type="button"
                                        className={`cert-mode-btn ${previewRoleMode === "asn" ? "active" : ""}`}
                                        onClick={() => setPreviewRoleMode("asn")}
                                        title="Pratinjau Profil ASN (Menampilkan NIP, Jabatan & Satker)"
                                    >
                                        <i className="fas fa-id-badge me-1"></i> ASN (NIP)
                                    </button>
                                    <button
                                        type="button"
                                        className={`cert-mode-btn ${previewRoleMode === "public" ? "active" : ""}`}
                                        onClick={() => setPreviewRoleMode("public")}
                                        title="Pratinjau Peserta Eksternal / Non-NIP"
                                    >
                                        <i className="fas fa-user-circle me-1"></i> Publik (Non-NIP)
                                    </button>
                                </div>
                            </div>

                            {/* Studio Controls: Theme Canvas + Zoom Bar + Fullscreen */}
                            <div className="cert-preview-controls">
                                {/* Dark/Light Canvas Toggle */}
                                <button
                                    type="button"
                                    className={`btn btn-sm cert-ctrl-btn ${canvasTheme === "dark" ? "active" : ""}`}
                                    onClick={() => setCanvasTheme((t) => (t === "dark" ? "light" : "dark"))}
                                    title={
                                        canvasTheme === "dark"
                                            ? "Ganti ke Kanvas Terang"
                                            : "Ganti ke Studio Kanvas Gelap (Kontras Tinggi)"
                                    }
                                >
                                    <i
                                        className={`fas ${canvasTheme === "dark" ? "fa-sun text-warning" : "fa-moon"}`}
                                    ></i>
                                </button>

                                {/* Zoom Controls */}
                                <div className="cert-zoom-group">
                                    <button
                                        type="button"
                                        className="cert-ctrl-btn"
                                        onClick={() =>
                                            setPreviewScale((p) => Math.max(0.28, +(p - 0.04).toFixed(2)))
                                        }
                                        title="Perkecil"
                                    >
                                        <i className="fas fa-minus"></i>
                                    </button>
                                    <input
                                        type="range"
                                        min="0.28"
                                        max="0.65"
                                        step="0.02"
                                        value={previewScale}
                                        onChange={(e) => setPreviewScale(parseFloat(e.target.value))}
                                        className="cert-zoom-slider"
                                        title="Atur Skala Pratinjau"
                                    />
                                    <button
                                        type="button"
                                        className="cert-ctrl-btn"
                                        onClick={() =>
                                            setPreviewScale((p) => Math.min(0.65, +(p + 0.04).toFixed(2)))
                                        }
                                        title="Perbesar"
                                    >
                                        <i className="fas fa-plus"></i>
                                    </button>
                                    <button
                                        type="button"
                                        className="cert-ctrl-btn cert-ctrl-fit"
                                        onClick={handleFitScale}
                                        title="Paskan skala dengan lebar easel (Fit Width)"
                                    >
                                        Fit
                                    </button>
                                    <span className="cert-zoom-badge">
                                        {Math.round(previewScale * 100)}%
                                    </span>
                                </div>

                                {/* Fullscreen Modal Trigger */}
                                <button
                                    type="button"
                                    className="btn btn-sm cert-ctrl-btn"
                                    onClick={() => setIsFullscreenPreview(true)}
                                    title="Tampilkan Pratinjau Layar Penuh"
                                >
                                    <i className="fas fa-expand"></i>
                                </button>
                            </div>
                        </div>

                        {/* Stage with High-Contrast Canvas */}
                        <div
                            className={`cert-preview-stage ${canvasTheme === "dark" ? "theme-dark" : "theme-light"}`}
                            ref={stageContainerRef}
                        >
                            <div
                                className="cert-preview-viewport"
                                style={{
                                    width: `${Math.round(1414 * previewScale)}px`,
                                    height: `${Math.round(1000 * previewScale)}px`
                                }}
                            >
                                <div
                                    className="cert-preview-wrapper"
                                    style={{
                                        width: 1414,
                                        height: 1000,
                                        transform: `scale(${previewScale})`,
                                        transformOrigin: "0 0"
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

                        {/* Streamlined Single-Line Footer Meta */}
                        <div className="cert-preview-footer-bar">
                            <div className="cert-footer-meta-item">
                                <i className="fas fa-check-circle text-teal me-1"></i>
                                <span>ISO 216 A4 Landscape (297×210 mm)</span>
                            </div>
                            <div className="cert-footer-badges">
                                <span className="cert-micro-badge">Rasio 1.414 : 1</span>
                                <span className="cert-micro-badge">Ultra-HD 2K (1414×1000px)</span>
                                <span className="cert-micro-badge bg-teal-subtle text-teal">Cetak & PDF Siap</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. FULLSCREEN MODAL PREVIEW (Crisp High-Res Inspection) */}
            {isFullscreenPreview && (
                <div className="cert-fullscreen-overlay" onClick={() => setIsFullscreenPreview(false)}>
                    <div className="cert-fullscreen-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="cert-fullscreen-header">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fas fa-award text-teal fs-5"></i>
                                <h5 className="mb-0 text-white fw-bold">
                                    Pratinjau Layar Penuh — Sertifikat Resmi Setjen DPD RI
                                </h5>
                                <span className="badge bg-teal ms-2">A4 Ultra-HD</span>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <div className="btn-group btn-group-sm">
                                    <button
                                        type="button"
                                        className={`btn ${previewRoleMode === "asn" ? "btn-teal text-white" : "btn-outline-light"}`}
                                        onClick={() => setPreviewRoleMode("asn")}
                                    >
                                        ASN (NIP)
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn ${previewRoleMode === "public" ? "btn-teal text-white" : "btn-outline-light"}`}
                                        onClick={() => setPreviewRoleMode("public")}
                                    >
                                        Publik
                                    </button>
                                </div>
                                <button
                                    className="btn btn-outline-light btn-sm ms-2"
                                    onClick={() => setIsFullscreenPreview(false)}
                                    title="Tutup Pratinjau (Esc)"
                                >
                                    <i className="fas fa-times me-1"></i> Tutup
                                </button>
                            </div>
                        </div>

                        <div className="cert-fullscreen-body">
                            <div
                                className="cert-preview-viewport"
                                style={{
                                    width: `${Math.round(1414 * 0.75)}px`,
                                    height: `${Math.round(1000 * 0.75)}px`
                                }}
                            >
                                <div
                                    className="cert-preview-wrapper"
                                    style={{
                                        width: 1414,
                                        height: 1000,
                                        transform: `scale(0.75)`,
                                        transformOrigin: "0 0"
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
                    </div>
                </div>
            )}
        </div>
    );
}

export default CertificateDesignTab;
