import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiInstance from "../../utils/axios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LoadingSpinner from "./Partials/LoadingSpinner";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import WorkflowStepper from "../../components/WorkflowStepper";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";

import ModernCertificateDocument from "../../components/CourseDetail/ModernCertificateDocument";
import "./CourseCertificateDesign.css";

const VARIABLE_DICTIONARY = [
    { tag: "{{NAMA_SISWA}}", desc: "Nama lengkap peserta pelatihan (beserta gelar)" },
    { tag: "{{NIP_PEGAWAI}}", desc: "Nomor Induk Pegawai peserta (Format: NIP. 19850315...)" },
    { tag: "{{JABATAN_PEGAWAI}}", desc: "Jabatan fungsional / struktural peserta pelatihan" },
    { tag: "{{UNIT_KERJA}}", desc: "Satuan kerja / Biro / Pusat penempatan peserta" },
    { tag: "{{JUDUL_KURSUS}}", desc: "Judul lengkap program pelatihan / kursus" },
    { tag: "{{NOMOR_SERTIFIKAT}}", desc: "Nomor registrasi resmi sertifikat (KP.04/LMS/...)" },
    { tag: "{{TANGGAL_LULUS}}", desc: "Tanggal kelulusan (Format: 07 November 2026)" },
    { tag: "{{TOTAL_JP}}", desc: "Total Jam Pelatihan (Contoh: 16)" },
    { tag: "{{KATEGORI_KURSUS}}", desc: "Kategori diklat (Contoh: Teknis / Fungsional)" },
    { tag: "{{NAMA_INSTRUKTUR}}", desc: "Nama lengkap Anda sebagai instruktur pengampu" },
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

function CourseCertificateDesign() {
    const { course_id } = useParams();
    const navigate = useNavigate();
    const userData = UserData();
    const { isSidebarCollapsed } = useInstructorSidebarCollapse();

    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState("theme");
    const [previewScale, setPreviewScale] = useState(0.42);
    const [previewRoleMode, setPreviewRoleMode] = useState("asn"); // 'asn' | 'public'

    // Form data state
    const [useSystemDefault, setUseSystemDefault] = useState(true);
    const [systemDefaultData, setSystemDefaultData] = useState(null);
    const [formData, setFormData] = useState({
        template_name: "",
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
        instructor_title: "Instruktur Pengampu Kursus",
        show_instructor_signature: false,
        show_gold_seal: true,
        show_watermark: true,
        show_bpsdm_logo: true,
        show_qr_code: true,
        custom_background_url: null,
        instructor_signature_url: null,
        pptx_template_url: null
    });

    const [selectedBg, setSelectedBg] = useState(null);
    const [bgPreview, setBgPreview] = useState(null);
    const [selectedSig, setSelectedSig] = useState(null);
    const [sigPreview, setSigPreview] = useState(null);
    const [selectedPptx, setSelectedPptx] = useState(null);
    const [downloadingPptx, setDownloadingPptx] = useState(false);
    const [isDraggingBg, setIsDraggingBg] = useState(false);
    const [isDraggingSig, setIsDraggingSig] = useState(false);

    const bgInputRef = useRef(null);
    const sigInputRef = useRef(null);
    const pptxInputRef = useRef(null);

    // Fetch course and certificate template configuration
    const fetchTemplateData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiInstance.get(`teacher/course/${course_id}/certificate-template/`);
            if (res.data) {
                setCourse(res.data.course);
                setUseSystemDefault(res.data.use_system_default);
                setSystemDefaultData(res.data.system_default);

                const activeTpl = res.data.template || res.data.system_default;
                if (activeTpl) {
                    setFormData(prev => ({
                        ...prev,
                        ...activeTpl,
                        template_name: activeTpl.template_name || `Template Kursus - ${res.data.course?.title || ''}`,
                    }));
                }
            }
        } catch (error) {
            console.error("Error fetching course certificate template:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat template sertifikat kursus."
            });
        } finally {
            setLoading(false);
        }
    }, [course_id]);

    useEffect(() => {
        fetchTemplateData();
    }, [fetchTemplateData]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
        }));
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

    const handleCopyTag = (tag) => {
        navigator.clipboard.writeText(tag);
        Toast().fire({
            icon: "success",
            title: `Tag ${tag} disalin!`
        });
    };

    // File Handlers
    const handleBgFileSelect = (file) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            Toast().fire({ icon: "warning", title: "Pilih file gambar (JPG/PNG/WebP)" });
            return;
        }
        setSelectedBg(file);
        const reader = new FileReader();
        reader.onload = (e) => setBgPreview(e.target.result);
        reader.readAsDataURL(file);
    };

    const handleSigFileSelect = (file) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            Toast().fire({ icon: "warning", title: "Pilih file gambar tanda tangan (PNG transparan disarankan)" });
            return;
        }
        setSelectedSig(file);
        const reader = new FileReader();
        reader.onload = (e) => setSigPreview(e.target.result);
        reader.readAsDataURL(file);
    };

    const handlePptxFileSelect = (file) => {
        if (!file) return;
        if (!file.name.endsWith(".pptx")) {
            Toast().fire({ icon: "warning", title: "Hanya format file PowerPoint (.pptx) yang didukung" });
            return;
        }
        setSelectedPptx(file);
    };

    // Copy from System Default
    const handleCopySystemDefault = () => {
        if (!systemDefaultData) return;
        Swal.fire({
            title: "Salin Pengaturan Default?",
            text: "Pengaturan form akan diselaraskan dengan standar default resmi sistem LMSetjen DPD RI.",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Ya, Salin",
            cancelButtonText: "Batal",
            confirmButtonColor: "#0d5c3a"
        }).then((result) => {
            if (result.isConfirmed) {
                setFormData(prev => ({
                    ...prev,
                    ...systemDefaultData,
                    template_name: `Template Kursus - ${course?.title || ''}`,
                    instructor_title: prev.instructor_title || "Instruktur Pengampu Kursus",
                    show_instructor_signature: prev.show_instructor_signature
                }));
                Toast().fire({
                    icon: "success",
                    title: "Pengaturan default sistem berhasil disalin ke form."
                });
            }
        });
    };

    // Save Form
    const handleSaveTemplate = async () => {
        setSaving(true);
        try {
            const payload = new FormData();
            payload.append("use_system_default", useSystemDefault ? "true" : "false");

            if (!useSystemDefault) {
                Object.keys(formData).forEach(key => {
                    if (formData[key] !== null && formData[key] !== undefined && !['custom_background_url', 'instructor_signature_url', 'pptx_template_url'].includes(key)) {
                        payload.append(key, formData[key]);
                    }
                });

                if (selectedBg) {
                    payload.append("custom_background", selectedBg);
                }
                if (selectedSig) {
                    payload.append("instructor_signature_image", selectedSig);
                }
                if (selectedPptx) {
                    payload.append("pptx_template", selectedPptx);
                }
            }

            const res = await apiInstance.post(`teacher/course/${course_id}/certificate-template/`, payload, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            if (res.data) {
                setUseSystemDefault(res.data.use_system_default);
                if (res.data.template) {
                    setFormData(prev => ({
                        ...prev,
                        ...res.data.template
                    }));
                }
                Toast().fire({
                    icon: "success",
                    title: "Berhasil Menyimpan!",
                    text: res.data.message || "Konfigurasi template sertifikat kursus berhasil diperbarui."
                });
            }
        } catch (error) {
            console.error("Save error:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal menyimpan konfigurasi sertifikat kursus."
            });
        } finally {
            setSaving(false);
        }
    };

    // Reset to System Default
    const handleResetToDefault = async () => {
        Swal.fire({
            title: "Reset ke Default Sistem?",
            text: "Kursus ini akan kembali menggunakan sertifikat default resmi LMSetjen DPD RI.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Ya, Reset ke Default",
            cancelButtonText: "Batal",
            confirmButtonColor: "#d97706"
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const res = await apiInstance.post(`teacher/course/${course_id}/certificate-template/reset/`);
                    setUseSystemDefault(true);
                    if (systemDefaultData) {
                        setFormData(prev => ({
                            ...prev,
                            ...systemDefaultData
                        }));
                    }
                    Toast().fire({
                        icon: "success",
                        title: "Template sertifikat di-reset ke Default Sistem LMSetjen DPD RI."
                    });
                } catch (error) {
                    Toast().fire({
                        icon: "error",
                        title: "Gagal me-reset template sertifikat."
                    });
                }
            }
        });
    };

    // Download PPTX
    const handleDownloadPptx = async () => {
        setDownloadingPptx(true);
        try {
            const res = await apiInstance.get(`teacher/course/${course_id}/certificate-template/download-pptx/`, {
                responseType: "blob"
            });
            const blob = new Blob([res.data], {
                type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Master_Template_Sertifikat_${course?.course_id || "Kursus"}.pptx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            Toast().fire({
                icon: "success",
                title: "Master PPTX Berhasil Diunduh!"
            });
        } catch (error) {
            console.error("Download error:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal mengunduh template PPTX kursus."
            });
        } finally {
            setDownloadingPptx(false);
        }
    };

    // Dynamic Dummy Certificate for Live Preview
    const dummyCertificate = {
        id: 999,
        certificate_id: "202736",
        formatted_certificate_id: "KP.04/LMS/202736/DPDRI/XI/2026",
        validation_token: "dpdri2026demo",
        student_name: previewRoleMode === "asn" ? "Khairil Azmi Ashari, S.Kom" : "Rudi Hartono, S.T.",
        student_nip: previewRoleMode === "asn" ? "199701182025061001" : "",
        student_position: previewRoleMode === "asn" ? "Penata Kelola Sistem dan Teknologi Informasi" : "",
        student_organization_unit: previewRoleMode === "asn" ? "Subbagian Administrasi Keanggotaan" : "",
        course_title: course?.title || "Program Diklat Pengembangan Kompetensi Aparatur",
        course_category: course?.category || "Teknis & Fungsional",
        instructor_name: course?.teacher_name || userData?.full_name || "Instruktur Pengampu Kursus",
        total_jp: 16,
        date: "07 November 2026"
    };

    // Effective live config for preview
    const previewConfig = useSystemDefault && systemDefaultData
        ? systemDefaultData
        : {
            ...formData,
            custom_background_url: bgPreview || formData.custom_background_url,
            instructor_signature_url: sigPreview || formData.instructor_signature_url
        };

    if (loading) {
        return (
            <>
                <BaseHeader />
                <section className="instructor-course-certificate-page pt-3 pb-5">
                    <div className="container header-container-aligned py-5">
                        <LoadingSpinner message="Memuat konfigurasi sertifikat kursus..." />
                    </div>
                </section>
                <Footer />
            </>
        );
    }

    return (
        <>
            <BaseHeader />

            <section className="instructor-course-certificate-page">
                <div className="container header-container-aligned">
                    {/* Top Level Instructor Header - Synchronized with header-container */}
                    <Header />

                    <div className="row">
                        {/* Instructor Sidebar */}
                        <Sidebar />

                        {/* Main Content Area */}
                        <div className={`col-lg-9 col-md-8 col-12 transition-all ${isSidebarCollapsed ? "col-lg-11 col-md-11" : ""}`}>
                            {/* Workflow Stepper Navigation */}
                            {course && (
                                <WorkflowStepper
                                    currentStep={5}
                                    courseId={course_id}
                                    courseData={course}
                                />
                            )}

                            {/* COMPACT & INTEGRATED COMMAND BAR */}
                            <div className="cert-command-bar mb-3">
                                <div className="d-flex align-items-center justify-content-between gap-2.5 mb-2.5 flex-nowrap" style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
                                    <div className="d-flex flex-column min-w-0" style={{ minWidth: 0, flex: "1 1 0%" }}>
                                        <div className="d-flex align-items-center gap-1.5 mb-1 flex-nowrap overflow-hidden">
                                            <span className="badge bg-teal-subtle text-teal fw-semibold px-2 py-0.5 fs-8 text-nowrap flex-shrink-0">
                                                <i className="fas fa-certificate me-1"></i> Sertifikat Kursus
                                            </span>
                                            <span className="badge bg-light text-muted border px-2 py-0.5 fs-8 text-nowrap flex-shrink-0">
                                                ID: #{course_id}
                                            </span>
                                            {course?.category && (
                                                <span className="badge bg-secondary-subtle text-secondary px-2 py-0.5 fs-8 text-truncate" style={{ maxWidth: "150px" }}>
                                                    {typeof course.category === 'object' ? course.category.title : course.category}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="cert-command-title mb-0 text-truncate" title={course?.title}>
                                            {course?.title || "Pengaturan Sertifikat Kelulusan"}
                                        </h3>
                                    </div>

                                    {/* Action Links & Save Button - Stick to Right Side */}
                                    <div className="d-flex align-items-center gap-1 flex-nowrap flex-shrink-0 ms-auto">
                                        <Link
                                            to={`/instructor/edit-course/${course_id}/`}
                                            className="btn btn-outline-secondary btn-sm px-2 py-1 d-inline-flex align-items-center gap-1 text-nowrap"
                                            title="Informasi Dasar"
                                        >
                                            <i className="fas fa-arrow-left"></i>
                                            <span>Detail</span>
                                        </Link>
                                        <Link
                                            to={`/instructor/edit-course/${course_id}/curriculum/`}
                                            className="btn btn-outline-teal btn-sm px-2 py-1 d-inline-flex align-items-center gap-1 text-nowrap"
                                            title="Kelola Kurikulum"
                                        >
                                            <i className="fas fa-list"></i>
                                            <span>Kurikulum</span>
                                        </Link>
                                        <Link
                                            to={`/instructor/edit-course/${course_id}/quiz/`}
                                            className="btn btn-outline-teal btn-sm px-2 py-1 d-inline-flex align-items-center gap-1 text-nowrap"
                                            title="Kelola Kuis"
                                        >
                                            <i className="fas fa-question-circle"></i>
                                            <span>Kuis</span>
                                        </Link>
                                        <Link
                                            to={`/instructor/edit-course/${course_id}/gamification/`}
                                            className="btn btn-outline-teal btn-sm px-2 py-1 d-inline-flex align-items-center gap-1 text-nowrap"
                                            title="Kelola Gamifikasi"
                                        >
                                            <i className="fas fa-gamepad"></i>
                                            <span>Gamifikasi</span>
                                        </Link>
                                        <button
                                            type="button"
                                            className="btn btn-teal-primary btn-sm px-2.5 py-1 d-inline-flex align-items-center gap-1 shadow-sm text-nowrap ms-0.5"
                                            onClick={handleSaveTemplate}
                                            disabled={saving}
                                        >
                                            {saving ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                    <span>Menyimpan...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-save me-1"></i>
                                                    <span>Simpan</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Integrated Mode Switcher & Status Line */}
                                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 pt-2 border-top">
                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                        <span className="fw-bold small text-muted">Mode Template:</span>
                                        <div className="cert-segmented-control">
                                            <button
                                                type="button"
                                                className={`cert-segment-btn ${useSystemDefault ? "active" : ""}`}
                                                onClick={() => setUseSystemDefault(true)}
                                            >
                                                <i className="fas fa-building-columns"></i>
                                                <span>Standar Default Resmi</span>
                                                <span className="segment-badge">Biro OKK</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`cert-segment-btn ${!useSystemDefault ? "active" : ""}`}
                                                onClick={() => setUseSystemDefault(false)}
                                            >
                                                <i className="fas fa-paint-brush"></i>
                                                <span>Kustomisasi Khusus Kursus</span>
                                                <span className="segment-badge">Kustom</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Informative Micro Status */}
                                    <div className="d-flex align-items-center gap-2 fs-8 text-muted">
                                        {useSystemDefault ? (
                                            <span className="text-success fw-medium">
                                                <i className="fas fa-shield-halved me-1"></i> Otomatis menggunakan naskah dinas baku Setjen DPD RI
                                            </span>
                                        ) : (
                                            <span className="text-teal fw-medium">
                                                <i className="fas fa-wand-magic-sparkles me-1"></i> Desain kustom aktif — bebas kustomisasi palet &amp; tanda tangan
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* LIVE PREVIEW & SETTINGS SPLIT VIEW */}
                            <div className="row g-3">
                                {/* LEFT: Live Interactive Preview Easel */}
                                <div className="col-xl-7 col-lg-12">
                                    <div className="cert-preview-card sticky-top" style={{ top: "75px", zIndex: 10 }}>
                                        <div className="cert-preview-card-header">
                                            <div className="d-flex align-items-center gap-2">
                                                <i className="fas fa-eye text-teal"></i>
                                                <h6 className="fw-bold mb-0 text-dark">Pratinjau Sertifikat</h6>
                                                <span className={`badge ${useSystemDefault ? "bg-success" : "bg-teal"} text-white fs-8 ms-1`}>
                                                    {useSystemDefault ? "Default Resmi" : "Desain Kustom"}
                                                </span>
                                            </div>

                                            {/* Toolbar Preview Controls */}
                                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                                {/* Role Profile Switcher */}
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        type="button"
                                                        className={`btn btn-sm ${previewRoleMode === "asn" ? "btn-teal-primary" : "btn-outline-secondary"}`}
                                                        onClick={() => setPreviewRoleMode("asn")}
                                                        title="Pratinjau profil ASN (NIP, Jabatan & Unit Kerja)"
                                                    >
                                                        <i className="fas fa-id-badge me-1"></i> ASN
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`btn btn-sm ${previewRoleMode === "public" ? "btn-teal-primary" : "btn-outline-secondary"}`}
                                                        onClick={() => setPreviewRoleMode("public")}
                                                        title="Pratinjau profil Non-NIP / Umum"
                                                    >
                                                        <i className="fas fa-user me-1"></i> Umum
                                                    </button>
                                                </div>

                                                {/* Zoom Controls */}
                                                <div className="d-flex align-items-center gap-1">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary btn-sm px-2 py-0.5"
                                                        onClick={() => setPreviewScale(prev => Math.max(0.28, +(prev - 0.04).toFixed(2)))}
                                                        title="Perkecil"
                                                    >
                                                        <i className="fas fa-minus small"></i>
                                                    </button>
                                                    <input
                                                        type="range"
                                                        min="0.28"
                                                        max="0.75"
                                                        step="0.02"
                                                        value={previewScale}
                                                        onChange={(e) => setPreviewScale(parseFloat(e.target.value))}
                                                        style={{ width: 60, cursor: "pointer" }}
                                                        title="Atur Skala Pratinjau"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary btn-sm px-2 py-0.5"
                                                        onClick={() => setPreviewScale(prev => Math.min(0.75, +(prev + 0.04).toFixed(2)))}
                                                        title="Perbesar"
                                                    >
                                                        <i className="fas fa-plus small"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`btn btn-sm px-2 py-0.5 ${previewScale === 0.42 ? "btn-teal-primary" : "btn-outline-secondary"}`}
                                                        onClick={() => setPreviewScale(0.42)}
                                                        title="Paskan (Fit)"
                                                    >
                                                        Fit
                                                    </button>
                                                    <span className="badge bg-light text-dark border font-monospace ms-0.5 fs-8">
                                                        {Math.round(previewScale * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Preview Easel Stage with Exact Pixel Viewport */}
                                        <div className="cert-preview-stage">
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
                                                        transform: `scale(${previewScale})`,
                                                        transformOrigin: "0 0"
                                                    }}
                                                >
                                                    <ModernCertificateDocument
                                                        certificate={dummyCertificate}
                                                        course={course}
                                                        templateConfig={previewConfig}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer Info & Quick Actions */}
                                        <div className="cert-preview-footer">
                                            <div className="d-flex align-items-center gap-1.5">
                                                <i className="fas fa-check-circle text-teal"></i>
                                                <span>A4 Landscape (29.7 × 21.0 cm) • Sinkronisasi otomatis secara *real-time*.</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-link text-teal text-decoration-none p-0 fs-8 fw-semibold"
                                                onClick={handleDownloadPptx}
                                                disabled={downloadingPptx}
                                            >
                                                <i className="fas fa-file-powerpoint text-danger me-1"></i>
                                                {downloadingPptx ? "Menyiapkan PPTX..." : "Unduh Master PPTX Kursus"}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT: Customization Editor / Default Overview Panels */}
                                <div className="col-xl-5 col-lg-12">
                                    {useSystemDefault ? (
                                        /* COMPACT OFFICIAL SYSTEM DEFAULT PROFILE */
                                        <div className="cert-editor-card">
                                            <div className="card-body p-3.5">
                                                <div className="cert-default-profile-box">
                                                    <div className="d-flex align-items-center justify-content-between mb-2">
                                                        <span className="badge bg-success text-white px-2 py-0.5 fs-8">
                                                            <i className="fas fa-shield-alt me-1"></i> Format Baku Lembaga
                                                        </span>
                                                        <span className="badge bg-white text-muted border fs-8">
                                                            ISO 216 A4 Landscape
                                                        </span>
                                                    </div>
                                                    <h5 className="fw-bold text-dark mb-1">
                                                        Sertifikat Resmi Sekretariat Jenderal DPD RI
                                                    </h5>
                                                    <p className="text-muted small mb-0">
                                                        Kursus ini telah dikonfigurasi untuk langsung menerbitkan sertifikat kelulusan sah berstandar resmi lembaga tanpa perlu pengaturan manual.
                                                    </p>

                                                    {/* Official Specifications in a neat 2x2 grid */}
                                                    <div className="cert-spec-grid">
                                                        <div className="cert-spec-item">
                                                            <div className="cert-spec-icon">
                                                                <i className="fas fa-user-tie"></i>
                                                            </div>
                                                            <div>
                                                                <span className="cert-spec-label">Pengesahan</span>
                                                                <span className="cert-spec-val">Kepala Biro OKK</span>
                                                            </div>
                                                        </div>
                                                        <div className="cert-spec-item">
                                                            <div className="cert-spec-icon">
                                                                <i className="fas fa-stamp"></i>
                                                            </div>
                                                            <div>
                                                                <span className="cert-spec-label">Keabsahan</span>
                                                                <span className="cert-spec-val">Stempel Basah Setjen</span>
                                                            </div>
                                                        </div>
                                                        <div className="cert-spec-item">
                                                            <div className="cert-spec-icon">
                                                                <i className="fas fa-medal"></i>
                                                            </div>
                                                            <div>
                                                                <span className="cert-spec-label">Atribut Resmi</span>
                                                                <span className="cert-spec-val">Segel Emas &amp; Watermark</span>
                                                            </div>
                                                        </div>
                                                        <div className="cert-spec-item">
                                                            <div className="cert-spec-icon">
                                                                <i className="fas fa-qrcode"></i>
                                                            </div>
                                                            <div>
                                                                <span className="cert-spec-label">Verifikasi</span>
                                                                <span className="cert-spec-val">QR Code &amp; Token Digital</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Switch to Custom CTA */}
                                                    <div className="d-flex align-items-center justify-content-between pt-2 border-top flex-wrap gap-2">
                                                        <span className="text-muted small">Ingin mengubah warna, teks atau menyematkan tanda tangan Anda?</span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-teal-primary btn-sm px-3 text-nowrap"
                                                            onClick={() => setUseSystemDefault(false)}
                                                        >
                                                            <i className="fas fa-paint-brush me-1"></i> Aktifkan Kustom
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Master PPTX Quick Download Card */}
                                                <div className="p-3 bg-light rounded-3 border mt-3 d-flex align-items-center justify-content-between gap-2">
                                                    <div className="d-flex align-items-center gap-2.5">
                                                        <div className="p-2 bg-white rounded border d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
                                                            <i className="fas fa-file-powerpoint text-danger fs-5"></i>
                                                        </div>
                                                        <div>
                                                            <div className="fw-semibold small text-dark">Master Template PowerPoint (.pptx)</div>
                                                            <div className="text-muted fs-8">Template baku siap pakai untuk kursus ini.</div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-teal btn-sm text-nowrap"
                                                        onClick={handleDownloadPptx}
                                                        disabled={downloadingPptx}
                                                    >
                                                        <i className="fas fa-download me-1"></i> {downloadingPptx ? "Mengunduh..." : "Unduh PPTX"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* CUSTOMIZATION EDITOR TABS */
                                        <div className="cert-editor-card">
                                            {/* Sub Tab Navigation Pills */}
                                            <div className="cert-nav-pills">
                                                <button
                                                    type="button"
                                                    className={`cert-nav-pill-btn ${activeSection === "theme" ? "active" : ""}`}
                                                    onClick={() => setActiveSection("theme")}
                                                >
                                                    <i className="fas fa-palette"></i> Tema &amp; Warna
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`cert-nav-pill-btn ${activeSection === "statement" ? "active" : ""}`}
                                                    onClick={() => setActiveSection("statement")}
                                                >
                                                    <i className="fas fa-font"></i> Narasi &amp; Teks
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`cert-nav-pill-btn ${activeSection === "signature" ? "active" : ""}`}
                                                    onClick={() => setActiveSection("signature")}
                                                >
                                                    <i className="fas fa-pen-nib"></i> Tanda Tangan
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`cert-nav-pill-btn ${activeSection === "assets" ? "active" : ""}`}
                                                    onClick={() => setActiveSection("assets")}
                                                >
                                                    <i className="fas fa-image"></i> Latar &amp; File
                                                </button>
                                            </div>

                                            <div className="card-body p-3">
                                                {/* SECTION 1: THEME & VISUAL */}
                                                {activeSection === "theme" && (
                                                    <div className="cert-section-pane">
                                                        <div className="mb-3">
                                                            <label className="form-label fw-bold small text-dark mb-1.5">
                                                                Preset Palet Warna Resmi
                                                            </label>
                                                            <div className="row g-1.5">
                                                                {COLOR_PRESETS.map((preset, idx) => (
                                                                    <div key={idx} className="col-6">
                                                                        <button
                                                                            type="button"
                                                                            className={`btn btn-outline-secondary w-100 text-start p-2 d-flex align-items-center justify-content-between cert-preset-btn ${formData.primary_color === preset.primary && formData.accent_color === preset.accent ? "active-preset" : ""}`}
                                                                            onClick={() => handleColorPreset(preset)}
                                                                        >
                                                                            <span className="small fw-semibold text-truncate fs-8">{preset.label}</span>
                                                                            <div className="d-flex gap-1 flex-shrink-0 ms-1">
                                                                                <span className="color-swatch-chip" style={{ backgroundColor: preset.primary }} />
                                                                                <span className="color-swatch-chip" style={{ backgroundColor: preset.accent }} />
                                                                            </div>
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="row g-2 mb-3">
                                                            <div className="col-6">
                                                                <label className="form-label fs-8 fw-semibold text-muted mb-1">Warna Utama (Primary)</label>
                                                                <div className="input-group input-group-sm">
                                                                    <input
                                                                        type="color"
                                                                        className="form-control form-control-color"
                                                                        name="primary_color"
                                                                        value={formData.primary_color || "#0d5c3a"}
                                                                        onChange={handleInputChange}
                                                                        style={{ width: "42px", height: "31px", padding: "2px" }}
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        className="form-control form-control-sm text-uppercase font-monospace"
                                                                        name="primary_color"
                                                                        value={formData.primary_color || "#0d5c3a"}
                                                                        onChange={handleInputChange}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="col-6">
                                                                <label className="form-label fs-8 fw-semibold text-muted mb-1">Warna Aksen (Gold/Highlight)</label>
                                                                <div className="input-group input-group-sm">
                                                                    <input
                                                                        type="color"
                                                                        className="form-control form-control-color"
                                                                        name="accent_color"
                                                                        value={formData.accent_color || "#c59b27"}
                                                                        onChange={handleInputChange}
                                                                        style={{ width: "42px", height: "31px", padding: "2px" }}
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        className="form-control form-control-sm text-uppercase font-monospace"
                                                                        name="accent_color"
                                                                        value={formData.accent_color || "#c59b27"}
                                                                        onChange={handleInputChange}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="mb-3">
                                                            <label className="form-label fw-bold small text-dark mb-1.5">
                                                                Kombinasi Tipografi
                                                            </label>
                                                            <div className="d-flex flex-column gap-1.5">
                                                                {FONT_PRESETS.map((f, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        type="button"
                                                                        className={`btn btn-outline-secondary text-start p-2 cert-preset-btn ${formData.title_font === f.title ? "active-preset" : ""}`}
                                                                        onClick={() => handleFontPreset(f)}
                                                                    >
                                                                        <div className="fw-semibold fs-8">{f.label}</div>
                                                                        <div className="text-muted fs-8">{f.title} &amp; {f.body}</div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="form-label fw-bold small text-dark mb-1.5">
                                                                Elemen Visual Tambahan
                                                            </label>
                                                            <div className="d-flex flex-column gap-2 bg-light p-2.5 rounded-3 border">
                                                                <div className="form-check form-switch mb-0">
                                                                    <input
                                                                        className="form-check-input"
                                                                        type="checkbox"
                                                                        id="show_gold_seal"
                                                                        name="show_gold_seal"
                                                                        checked={formData.show_gold_seal}
                                                                        onChange={handleInputChange}
                                                                    />
                                                                    <label className="form-check-label fs-8" htmlFor="show_gold_seal">
                                                                        Tampilkan Segel Medali Emas (*Gold Seal*)
                                                                    </label>
                                                                </div>
                                                                <div className="form-check form-switch mb-0">
                                                                    <input
                                                                        className="form-check-input"
                                                                        type="checkbox"
                                                                        id="show_watermark"
                                                                        name="show_watermark"
                                                                        checked={formData.show_watermark}
                                                                        onChange={handleInputChange}
                                                                    />
                                                                    <label className="form-check-label fs-8" htmlFor="show_watermark">
                                                                        Tampilkan Watermark Garuda / Lambang di Latar
                                                                    </label>
                                                                </div>
                                                                <div className="form-check form-switch mb-0">
                                                                    <input
                                                                        className="form-check-input"
                                                                        type="checkbox"
                                                                        id="show_bpsdm_logo"
                                                                        name="show_bpsdm_logo"
                                                                        checked={formData.show_bpsdm_logo}
                                                                        onChange={handleInputChange}
                                                                    />
                                                                    <label className="form-check-label fs-8" htmlFor="show_bpsdm_logo">
                                                                        Tampilkan Logo LMSetjen DPD RI (Kanan Atas)
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* SECTION 2: STATEMENT & TEXT */}
                                                {activeSection === "statement" && (
                                                    <div className="cert-section-pane">
                                                        <div className="row g-2 mb-2.5">
                                                            <div className="col-6">
                                                                <label className="form-label fs-8 fw-bold text-dark mb-1">Judul Sertifikat</label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control form-control-sm"
                                                                    name="certificate_title"
                                                                    value={formData.certificate_title || ""}
                                                                    onChange={handleInputChange}
                                                                    placeholder="Contoh: SERTIFIKAT KELULUSAN"
                                                                />
                                                            </div>
                                                            <div className="col-6">
                                                                <label className="form-label fs-8 fw-bold text-dark mb-1">Subjudul Bahasa Inggris</label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control form-control-sm"
                                                                    name="certificate_subtitle"
                                                                    value={formData.certificate_subtitle || ""}
                                                                    onChange={handleInputChange}
                                                                    placeholder="Contoh: Certificate of Completion"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="mb-2.5">
                                                            <label className="form-label fs-8 fw-bold text-dark mb-1">
                                                                Pernyataan Kelulusan (*Statement Text*)
                                                            </label>
                                                            <textarea
                                                                className="form-control form-control-sm"
                                                                rows={3}
                                                                name="statement_text"
                                                                value={formData.statement_text || ""}
                                                                onChange={handleInputChange}
                                                                placeholder="Tuliskan pernyataan kelulusan yang mencerminkan standar capaian kursus..."
                                                            />
                                                            <div className="form-text fs-8 text-muted mt-1">
                                                                Teks diletakkan di antara nama peserta dan judul kursus.
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="form-label fw-bold fs-8 text-dark mb-1">
                                                                Variabel Otomatis (Klik untuk Salin)
                                                            </label>
                                                            <div className="cert-var-cloud">
                                                                {VARIABLE_DICTIONARY.map((v, i) => (
                                                                    <button
                                                                        key={i}
                                                                        type="button"
                                                                        className="cert-var-chip"
                                                                        onClick={() => handleCopyTag(v.tag)}
                                                                        title={v.desc}
                                                                    >
                                                                        <span>{v.tag}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* SECTION 3: SIGNATURE & ENDORSEMENT */}
                                                {activeSection === "signature" && (
                                                    <div className="cert-section-pane">
                                                        {/* Official Bureau OKK Signatory (Read-only System Enforced) */}
                                                        <div className="p-2.5 bg-light rounded-3 border mb-3">
                                                            <div className="d-flex align-items-center gap-1.5 mb-1.5">
                                                                <i className="fas fa-stamp text-teal"></i>
                                                                <span className="fw-bold fs-8 text-dark">Pejabat Pengesah Kedinasan (Wajib Sistem)</span>
                                                            </div>
                                                            <div className="bg-white p-2 rounded border fs-8">
                                                                <div className="fw-semibold text-dark">{formData.signatory_name}</div>
                                                                <div className="text-muted">{formData.signatory_title}</div>
                                                                <div className="text-muted">NIP. {formData.signatory_nip}</div>
                                                            </div>
                                                        </div>

                                                        {/* Instructor Signature Customization */}
                                                        <div>
                                                            <div className="form-check form-switch mb-2.5">
                                                                <input
                                                                    className="form-check-input"
                                                                    type="checkbox"
                                                                    id="show_instructor_signature"
                                                                    name="show_instructor_signature"
                                                                    checked={formData.show_instructor_signature}
                                                                    onChange={handleInputChange}
                                                                />
                                                                <label className="form-check-label fw-bold fs-8 text-dark" htmlFor="show_instructor_signature">
                                                                    Sematkan Tanda Tangan Saya Sebagai Instruktur
                                                                </label>
                                                            </div>

                                                            {formData.show_instructor_signature && (
                                                                <div className="p-2.5 bg-teal-subtle rounded-3 border border-teal-subtle">
                                                                    <div className="mb-2">
                                                                        <label className="form-label fs-8 fw-bold text-dark mb-1">
                                                                            Gelar / Peran Instruktur di Sertifikat
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-sm"
                                                                            name="instructor_title"
                                                                            value={formData.instructor_title || ""}
                                                                            onChange={handleInputChange}
                                                                            placeholder="Contoh: Instruktur Pengampu / Fasilitator Ahli"
                                                                        />
                                                                    </div>

                                                                    <div>
                                                                        <label className="form-label fs-8 fw-bold text-dark mb-1">
                                                                            Unggah Tanda Tangan Digital (PNG Transparan)
                                                                        </label>
                                                                        <div
                                                                            className={`cert-dropzone p-2.5 ${isDraggingSig ? "dragging" : ""}`}
                                                                            onDragOver={(e) => { e.preventDefault(); setIsDraggingSig(true); }}
                                                                            onDragLeave={() => setIsDraggingSig(false)}
                                                                            onDrop={(e) => {
                                                                                e.preventDefault();
                                                                                setIsDraggingSig(false);
                                                                                if (e.dataTransfer.files?.[0]) handleSigFileSelect(e.dataTransfer.files[0]);
                                                                            }}
                                                                            onClick={() => sigInputRef.current?.click()}
                                                                        >
                                                                            <input
                                                                                type="file"
                                                                                ref={sigInputRef}
                                                                                className="d-none"
                                                                                accept="image/*"
                                                                                onChange={(e) => handleSigFileSelect(e.target.files?.[0])}
                                                                            />
                                                                            {sigPreview || formData.instructor_signature_url ? (
                                                                                <div className="d-flex flex-column align-items-center">
                                                                                    <img
                                                                                        src={sigPreview || formData.instructor_signature_url}
                                                                                        alt="Tanda Tangan Instruktur"
                                                                                        style={{ maxHeight: "55px", objectFit: "contain" }}
                                                                                        className="mb-1"
                                                                                    />
                                                                                    <span className="text-teal fs-8 fw-semibold">Klik untuk mengganti gambar</span>
                                                                                </div>
                                                                            ) : (
                                                                                <div>
                                                                                    <i className="fas fa-file-signature text-muted fs-4 mb-1"></i>
                                                                                    <p className="mb-0 fs-8 text-muted">
                                                                                        Tarik &amp; lepas gambar tanda tangan transparan di sini, atau <strong>klik untuk telusuri</strong>
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* SECTION 4: BACKGROUND & PPTX ASSETS */}
                                                {activeSection === "assets" && (
                                                    <div className="cert-section-pane">
                                                        <div className="mb-3">
                                                            <label className="form-label fw-bold fs-8 text-dark mb-1">
                                                                Latar Belakang Khusus Kursus (Opsional)
                                                            </label>
                                                            <p className="text-muted fs-8 mb-1.5">
                                                                Rasio A4 Landscape (1414 × 1000 px, format WebP/PNG/JPG).
                                                            </p>

                                                            <div
                                                                className={`cert-dropzone p-2.5 ${isDraggingBg ? "dragging" : ""}`}
                                                                onDragOver={(e) => { e.preventDefault(); setIsDraggingBg(true); }}
                                                                onDragLeave={() => setIsDraggingBg(false)}
                                                                onDrop={(e) => {
                                                                    e.preventDefault();
                                                                    setIsDraggingBg(false);
                                                                    if (e.dataTransfer.files?.[0]) handleBgFileSelect(e.dataTransfer.files[0]);
                                                                }}
                                                                onClick={() => bgInputRef.current?.click()}
                                                            >
                                                                <input
                                                                    type="file"
                                                                    ref={bgInputRef}
                                                                    className="d-none"
                                                                    accept="image/*"
                                                                    onChange={(e) => handleBgFileSelect(e.target.files?.[0])}
                                                                />
                                                                {bgPreview || formData.custom_background_url ? (
                                                                    <div className="d-flex flex-column align-items-center">
                                                                        <img
                                                                            src={bgPreview || formData.custom_background_url}
                                                                            alt="Background Preview"
                                                                            style={{ maxHeight: "75px", objectFit: "cover" }}
                                                                            className="rounded mb-1 shadow-sm"
                                                                        />
                                                                        <span className="text-teal fs-8 fw-semibold">Klik untuk mengganti background</span>
                                                                    </div>
                                                                ) : (
                                                                    <div>
                                                                        <i className="fas fa-cloud-arrow-up text-muted fs-4 mb-1"></i>
                                                                        <p className="mb-0 fs-8 text-muted">
                                                                            Tarik &amp; lepas file gambar di sini, atau <strong>klik untuk telusuri</strong>
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="form-label fw-bold fs-8 text-dark mb-1">
                                                                Master Template PowerPoint (.pptx)
                                                            </label>
                                                            <div className="d-flex gap-2">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-teal btn-sm flex-grow-1"
                                                                    onClick={handleDownloadPptx}
                                                                    disabled={downloadingPptx}
                                                                >
                                                                    <i className="fas fa-download me-1.5"></i>
                                                                    {downloadingPptx ? "Mengunduh..." : "Unduh Master PPTX"}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-secondary btn-sm"
                                                                    onClick={() => pptxInputRef.current?.click()}
                                                                >
                                                                    <i className="fas fa-upload me-1.5"></i>
                                                                    Unggah
                                                                </button>
                                                                <input
                                                                    type="file"
                                                                    ref={pptxInputRef}
                                                                    className="d-none"
                                                                    accept=".pptx"
                                                                    onChange={(e) => handlePptxFileSelect(e.target.files?.[0])}
                                                                />
                                                            </div>
                                                            {selectedPptx && (
                                                                <div className="text-success fs-8 mt-1.5">
                                                                    <i className="fas fa-check-circle me-1"></i> {selectedPptx.name} siap disimpan.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Sticky Footer */}
                                            <div className="cert-editor-footer">
                                                <button
                                                    type="button"
                                                    className="btn btn-link text-muted text-decoration-none p-0 fs-8"
                                                    onClick={handleCopySystemDefault}
                                                    title="Salin isi konfigurasi default sistem ke form ini"
                                                >
                                                    <i className="fas fa-copy me-1"></i> Salin Default
                                                </button>

                                                <div className="d-flex align-items-center gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger btn-sm"
                                                        onClick={handleResetToDefault}
                                                    >
                                                        <i className="fas fa-undo me-1"></i> Reset ke Default
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-teal-primary btn-sm px-3 shadow-sm"
                                                        onClick={handleSaveTemplate}
                                                        disabled={saving}
                                                    >
                                                        {saving ? (
                                                            <>
                                                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                                <span>Menyimpan...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <i className="fas fa-save me-1"></i>
                                                                <span>Simpan Desain</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}

export default CourseCertificateDesign;
