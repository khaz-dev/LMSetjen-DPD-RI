import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";

import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import apiInstance from "../../utils/axios";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
import { usePageCache } from "../../utils/usePageCache";

import "./SertifikatKursus.css";

/**
 * ✨ Redesigned Student Certificates Page (Sertifikat Kursus Saya)
 * LMSetjen DPD RI - High-density, compact, modern and eye-catching layout
 * Eliminates excessive blank/white space while highlighting official credentials & credentials validity.
 */
function SertifikatKursus() {
    const [certificates, setCertificates] = useState([]);
    const [error, setError] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [previewModalCert, setPreviewModalCert] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLevel, setSelectedLevel] = useState("all");
    const [sortBy, setSortBy] = useState("newest"); // 'newest' | 'oldest' | 'title'
    const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
    const [copiedId, setCopiedId] = useState(null);
    const [imageLoadErrors, setImageLoadErrors] = useState({});

    const isCollapsed = useSidebarCollapse();
    const userData = UserData();

    // Fetch all student certificates
    const fetchCertificates = useCallback(async () => {
        try {
            setError(null);
            if (!userData?.user_id) return [];

            const response = await apiInstance.get(`student/certificates/${userData.user_id}/`);
            const certificatesData = response.data?.results || response.data?.certificates || [];
            return Array.isArray(certificatesData) ? certificatesData : [];
        } catch (err) {
            console.error("Error fetching certificates:", err);
            setError("Gagal memuat sertifikat kursus");
            Toast().fire({
                icon: "error",
                title: "Gagal memuat sertifikat",
                text: err.response?.data?.message || "Silakan coba muat ulang halaman"
            });
            throw err;
        }
    }, [userData?.user_id]);

    // Use page cache to prevent unnecessary reload when navigating
    const { data: cachedCertificates, loading, refetch } = usePageCache(
        `student-certificates-${userData?.user_id || 'guest'}`,
        fetchCertificates,
        {
            showLoadingOnStale: false
        }
    );

    // Sync cached data to state
    useEffect(() => {
        if (cachedCertificates) {
            setCertificates(cachedCertificates);
        }
    }, [cachedCertificates]);

    // Format date in Indonesian locale
    const formatDate = (dateString) => {
        if (!dateString) return "-";
        try {
            return new Date(dateString).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric"
            });
        } catch (e) {
            return dateString;
        }
    };

    // Full date for badges & modals
    const formatFullDate = (dateString) => {
        if (!dateString) return "-";
        try {
            return new Date(dateString).toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });
        } catch (e) {
            return dateString;
        }
    };

    // Level badge meta
    const getLevelBadge = (level) => {
        const lvl = (level || "").toLowerCase();
        if (lvl.includes("begin") || lvl.includes("pemula")) {
            return { label: "Pemula", tone: "level-emerald", icon: "fa-seedling" };
        }
        if (lvl.includes("inter") || lvl.includes("menengah")) {
            return { label: "Menengah", tone: "level-teal", icon: "fa-chart-simple" };
        }
        if (lvl.includes("adv") || lvl.includes("lanjut")) {
            return { label: "Lanjutan", tone: "level-indigo", icon: "fa-rocket" };
        }
        if (lvl.includes("exp") || lvl.includes("ahli")) {
            return { label: "Ahli", tone: "level-amber", icon: "fa-crown" };
        }
        return { label: level || "Umum", tone: "level-slate", icon: "fa-book" };
    };

    // Resolve full image URL for preview and download
    const getCertificateImageUrl = (cert) => {
        if (!cert) return null;
        let url = cert.image_file_url;
        if (!url && cert.certificate_id) {
            url = `/api/v1/student/certificate-image/${cert.certificate_id}/`;
        }
        if (!url) return null;
        if (url.startsWith("/")) {
            const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";
            const origin = apiBase.startsWith("http") ? new URL(apiBase).origin : "";
            return `${origin}${url}`;
        }
        return url;
    };

    // Copy certificate ID with feedback
    const handleCopyId = (cert, e) => {
        if (e) e.stopPropagation();
        const idToCopy = cert.formatted_certificate_id || cert.certificate_id;
        if (!idToCopy) return;

        navigator.clipboard.writeText(idToCopy).then(() => {
            setCopiedId(cert.id);
            setTimeout(() => setCopiedId(null), 2200);
            Toast().fire({
                icon: "success",
                title: "Nomor Sertifikat Tersalin!",
                text: idToCopy,
                timer: 1600
            });
        }).catch(() => {
            Toast().fire({
                icon: "info",
                title: "Nomor Sertifikat",
                text: idToCopy
            });
        });
    };

    // Download certificate image
    const downloadCertificate = async (certificate, e) => {
        if (e) e.stopPropagation();
        if (!certificate?.id) {
            Toast().fire({
                icon: "error",
                title: "Sertifikat tidak valid"
            });
            return;
        }

        try {
            setDownloadingId(certificate.id);
            const imageUrl = getCertificateImageUrl(certificate);

            if (!imageUrl) {
                Toast().fire({
                    icon: "warning",
                    title: "Gambar sertifikat belum tersedia",
                    text: "Silakan coba lagi dalam beberapa saat"
                });
                setDownloadingId(null);
                return;
            }

            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            const safeTitle = (certificate.course_title || "Kursus")
                .replace(/[^\w\s-]/gi, "")
                .replace(/\s+/g, "_");
            link.setAttribute("download", `Sertifikat_${safeTitle}_${certificate.certificate_id}.png`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

            Toast().fire({
                icon: "success",
                title: "Unduhan Berhasil!",
                text: "Sertifikat berhasil diunduh ke perangkat Anda",
                timer: 2000
            });
        } catch (error) {
            console.error("Error downloading certificate:", error);
            const fallbackUrl = getCertificateImageUrl(certificate);
            if (fallbackUrl) {
                window.open(fallbackUrl, "_blank");
            } else {
                Toast().fire({
                    icon: "error",
                    title: "Unduhan Gagal",
                    text: "Gagal mengunduh sertifikat. Silakan coba lagi"
                });
            }
        } finally {
            setDownloadingId(null);
        }
    };

    // Handle image load error fallback
    const handleImageError = (certId) => {
        setImageLoadErrors(prev => ({ ...prev, [certId]: true }));
    };

    // Filter and sort certificates
    const filteredCertificates = useMemo(() => {
        let result = [...certificates];

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(cert =>
                (cert.course_title || "").toLowerCase().includes(q) ||
                (cert.instructor_name || "").toLowerCase().includes(q) ||
                (cert.formatted_certificate_id || "").toLowerCase().includes(q) ||
                (cert.certificate_id || "").toLowerCase().includes(q) ||
                (cert.course_category || "").toLowerCase().includes(q)
            );
        }

        // Level filter
        if (selectedLevel !== "all") {
            result = result.filter(cert =>
                (cert.course_level || "").toLowerCase() === selectedLevel.toLowerCase()
            );
        }

        // Sorting
        result.sort((a, b) => {
            if (sortBy === "oldest") {
                return new Date(a.date || a.created_at || 0) - new Date(b.date || b.created_at || 0);
            }
            if (sortBy === "title") {
                return (a.course_title || "").localeCompare(b.course_title || "");
            }
            // Default: newest
            return new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0);
        });

        return result;
    }, [certificates, searchQuery, selectedLevel, sortBy]);

    // Active filters count
    const hasActiveFilters = searchQuery.trim() !== "" || selectedLevel !== "all" || sortBy !== "newest";

    const clearAllFilters = () => {
        setSearchQuery("");
        setSelectedLevel("all");
        setSortBy("newest");
    };

    // Latest certificate date calculation
    const latestDate = certificates.length > 0
        ? formatDate(certificates[0]?.date || certificates[0]?.created_at)
        : "-";

    if (!userData?.user_id) {
        return (
            <div className="container mt-5">
                <div className="alert alert-warning d-flex align-items-center gap-2">
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>Silakan login terlebih dahulu untuk mengakses sertifikat kursus Anda.</span>
                </div>
            </div>
        );
    }

    return (
        <>
            <BaseHeader />

            <section className="modern-certificates-page">
                <div className="container">
                    <Header />
                    <div className="row mt-0">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>

                            {/* =========================================================================
                                1. UNIFIED COMPACT HERO HEADER & STATS CHIPS
                                ========================================================================= */}
                            <div className="cert-hero-card">
                                <div className="cert-hero-accent-shape"></div>
                                <div className="cert-hero-inner">
                                    <div className="cert-hero-content">
                                        <div className="cert-hero-badge">
                                            <i className="fas fa-award"></i>
                                            <span>Portofolio Kompetensi Resmi</span>
                                        </div>
                                        <h1 className="cert-hero-title">
                                            <i className="fas fa-certificate text-amber"></i>
                                            Sertifikat Kursus Saya
                                        </h1>
                                        <p className="cert-hero-desc">
                                            Koleksi kredensial dan bukti kelulusan pelatihan resmi Anda di lingkungan Sekretariat Jenderal DPD RI. Setiap sertifikat memiliki nomor seri resmi dan dapat divalidasi.
                                        </p>
                                    </div>

                                    {/* Stat Chips embedded cleanly in hero */}
                                    <div className="cert-hero-stats">
                                        <div className="cert-stat-chip">
                                            <div className="cert-stat-chip-icon bg-teal-subtle text-teal">
                                                <i className="fas fa-file-shield"></i>
                                            </div>
                                            <div className="cert-stat-chip-text">
                                                <span className="cert-stat-chip-val">{certificates.length}</span>
                                                <span className="cert-stat-chip-lbl">Total Sertifikat</span>
                                            </div>
                                        </div>

                                        <div className="cert-stat-chip">
                                            <div className="cert-stat-chip-icon bg-emerald-subtle text-emerald">
                                                <i className="fas fa-circle-check"></i>
                                            </div>
                                            <div className="cert-stat-chip-text">
                                                <span className="cert-stat-chip-val">100%</span>
                                                <span className="cert-stat-chip-lbl">Terverifikasi</span>
                                            </div>
                                        </div>

                                        <div className="cert-stat-chip d-none d-sm-flex">
                                            <div className="cert-stat-chip-icon bg-amber-subtle text-amber">
                                                <i className="fas fa-calendar-check"></i>
                                            </div>
                                            <div className="cert-stat-chip-text">
                                                <span className="cert-stat-chip-val">{latestDate}</span>
                                                <span className="cert-stat-chip-lbl">Terbitan Terakhir</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* =========================================================================
                                2. COMPACT SEARCH & CONTROL TOOLBAR (Zero Wasted Space)
                                ========================================================================= */}
                            <div className="cert-toolbar">
                                <div className="cert-toolbar-row">
                                    {/* Search Input */}
                                    <div className="cert-search-wrap">
                                        <i className="fas fa-magnifying-glass cert-search-icon"></i>
                                        <input
                                            type="text"
                                            className="form-control cert-search-input"
                                            placeholder="Cari kursus, nomor sertifikat, atau instruktur..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button
                                                className="cert-search-clear"
                                                onClick={() => setSearchQuery("")}
                                                title="Bersihkan pencarian"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>

                                    {/* Quick Filters Group */}
                                    <div className="cert-filter-group">
                                        {/* Level Select */}
                                        <div className="cert-select-wrap">
                                            <i className="fas fa-layer-group cert-select-icon"></i>
                                            <select
                                                className="form-select cert-select"
                                                value={selectedLevel}
                                                onChange={(e) => setSelectedLevel(e.target.value)}
                                                title="Filter tingkat kesulitan"
                                            >
                                                <option value="all">Semua Tingkat</option>
                                                <option value="Beginner">Pemula</option>
                                                <option value="Intermediate">Menengah</option>
                                                <option value="Advanced">Lanjutan</option>
                                                <option value="Expert">Ahli</option>
                                            </select>
                                        </div>

                                        {/* Sort Select */}
                                        <div className="cert-select-wrap">
                                            <i className="fas fa-arrow-down-short-wide cert-select-icon"></i>
                                            <select
                                                className="form-select cert-select"
                                                value={sortBy}
                                                onChange={(e) => setSortBy(e.target.value)}
                                                title="Urutkan sertifikat"
                                            >
                                                <option value="newest">Terbaru</option>
                                                <option value="oldest">Terlama</option>
                                                <option value="title">Judul (A-Z)</option>
                                            </select>
                                        </div>

                                        {/* View Switcher: Grid vs List */}
                                        <div className="cert-view-toggle" role="group" aria-label="Mode Tampilan">
                                            <button
                                                type="button"
                                                className={`cert-view-btn ${viewMode === "grid" ? "active" : ""}`}
                                                onClick={() => setViewMode("grid")}
                                                title="Tampilan Galeri Kartu"
                                            >
                                                <i className="fas fa-grip"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className={`cert-view-btn ${viewMode === "list" ? "active" : ""}`}
                                                onClick={() => setViewMode("list")}
                                                title="Tampilan Daftar Rapi"
                                            >
                                                <i className="fas fa-list-ul"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Filters Status Bar */}
                                <div className="cert-toolbar-meta">
                                    <div className="cert-meta-count">
                                        <span className="badge-count-pill">
                                            {filteredCertificates.length}
                                        </span>
                                        <span>
                                            sertifikat ditampilkan
                                            {certificates.length !== filteredCertificates.length && (
                                                <span className="text-muted"> (dari total {certificates.length})</span>
                                            )}
                                        </span>
                                    </div>

                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            className="cert-btn-reset-filter"
                                            onClick={clearAllFilters}
                                        >
                                            <i className="fas fa-rotate-left me-1"></i>
                                            Reset Filter
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* =========================================================================
                                3. CONTENT AREA (Loading, Error, Empty, Grid, List)
                                ========================================================================= */}

                            {/* Loading State */}
                            {loading && (
                                <div className="cert-loading-state">
                                    <div className="cert-spinner-wrapper">
                                        <div className="spinner-border text-teal" role="status">
                                            <span className="visually-hidden">Memuat...</span>
                                        </div>
                                        <i className="fas fa-award cert-spinner-icon"></i>
                                    </div>
                                    <p className="mt-3 text-muted fw-medium">Menyiapkan sertifikat kursus Anda...</p>
                                </div>
                            )}

                            {/* Error State */}
                            {error && !loading && (
                                <div className="alert alert-danger d-flex align-items-center justify-content-between p-3 rounded-4 mb-4" role="alert">
                                    <div className="d-flex align-items-center gap-2">
                                        <i className="fas fa-circle-exclamation fs-5 text-danger"></i>
                                        <span>{error}</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => refetch()}
                                    >
                                        <i className="fas fa-rotate-right me-1"></i>
                                        Coba Lagi
                                    </button>
                                </div>
                            )}

                            {/* Empty State: Belum ada sertifikat sama sekali */}
                            {!loading && certificates.length === 0 && !error && (
                                <div className="cert-empty-card">
                                    <div className="cert-empty-icon-wrap">
                                        <i className="fas fa-certificate"></i>
                                        <div className="cert-empty-icon-sub">
                                            <i className="fas fa-plus"></i>
                                        </div>
                                    </div>
                                    <h3 className="cert-empty-title">Belum Ada Sertifikat yang Diraih</h3>
                                    <p className="cert-empty-desc">
                                        Selesaikan seluruh modul materi pembelajaran dan lulus semua evaluasi kuis pada kursus Anda untuk menerbitkan sertifikat kelulusan berakreditasi Setjen DPD RI.
                                    </p>
                                    <Link to="/student/courses/" className="cert-btn-primary">
                                        <i className="fas fa-book-open me-2"></i>
                                        <span>Buka Kursus Saya</span>
                                    </Link>
                                </div>
                            )}

                            {/* Empty Filter State: Ada sertifikat, tapi filter nihil */}
                            {!loading && certificates.length > 0 && filteredCertificates.length === 0 && (
                                <div className="cert-empty-filter-card">
                                    <div className="cert-filter-empty-icon">
                                        <i className="fas fa-filter-circle-xmark"></i>
                                    </div>
                                    <h4 className="fw-bold mb-2">Tidak Menemukan Sertifikat yang Sesuai</h4>
                                    <p className="text-muted small mb-3">
                                        Coba ubah kata kunci pencarian atau sesuaikan pilihan filter tingkat kesulitan Anda.
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-sm cert-btn-primary"
                                        onClick={clearAllFilters}
                                    >
                                        <i className="fas fa-rotate-left me-2"></i>
                                        Reset Filter & Pencarian
                                    </button>
                                </div>
                            )}

                            {/* =========================================================================
                                4. A. GRID VIEW (Showcase Cards with Real Image / Mini Frame)
                                ========================================================================= */}
                            {!loading && filteredCertificates.length > 0 && viewMode === "grid" && (
                                <div className="cert-grid">
                                    {filteredCertificates.map((cert) => {
                                        const levelInfo = getLevelBadge(cert.course_level);
                                        const imageUrl = getCertificateImageUrl(cert);
                                        const hasImageError = imageLoadErrors[cert.id];

                                        return (
                                            <div key={cert.id} className="cert-card">
                                                {/* Certificate Visual Showcase Top Frame */}
                                                <div 
                                                    className="cert-card-preview"
                                                    onClick={() => setPreviewModalCert(cert)}
                                                    role="button"
                                                    tabIndex={0}
                                                    title="Klik untuk pratinjau sertifikat"
                                                    onKeyDown={(e) => { if (e.key === "Enter") setPreviewModalCert(cert); }}
                                                >
                                                    {/* Ribbon status */}
                                                    <div className="cert-card-ribbon">
                                                        <i className="fas fa-shield-check me-1"></i>
                                                        <span>Terverifikasi</span>
                                                    </div>

                                                    {/* Actual certificate thumbnail or SVG Certificate fallback */}
                                                    {imageUrl && !hasImageError ? (
                                                        <img
                                                            src={imageUrl}
                                                            alt={`Sertifikat ${cert.course_title}`}
                                                            className="cert-card-img"
                                                            onError={() => handleImageError(cert.id)}
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="cert-mini-mockup">
                                                            <div className="cert-mini-border">
                                                                <div className="cert-mini-header">
                                                                    <i className="fas fa-landmark text-teal"></i>
                                                                    <span>SETJEN DPD RI</span>
                                                                </div>
                                                                <div className="cert-mini-badge-icon">
                                                                    <i className="fas fa-award"></i>
                                                                </div>
                                                                <div className="cert-mini-title">
                                                                    {cert.course_title}
                                                                </div>
                                                                <div className="cert-mini-recipient">
                                                                    {cert.student_name || userData?.full_name || "Peserta Pelatihan"}
                                                                </div>
                                                                <div className="cert-mini-id">
                                                                    {cert.formatted_certificate_id || cert.certificate_id}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Hover Overlay with Quick Actions */}
                                                    <div className="cert-preview-overlay">
                                                        <span className="cert-overlay-action-btn">
                                                            <i className="fas fa-eye me-1"></i> Pratinjau
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Card Body */}
                                                <div className="cert-card-body">
                                                    {/* Badges: Level & Category */}
                                                    <div className="cert-tags-row">
                                                        <span className={`cert-level-badge ${levelInfo.tone}`}>
                                                            <i className={`fas ${levelInfo.icon} me-1`}></i>
                                                            {levelInfo.label}
                                                        </span>
                                                        {cert.course_category && (
                                                            <span className="cert-category-badge" title={cert.course_category}>
                                                                <i className="fas fa-tag me-1"></i>
                                                                {cert.course_category}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Course Title */}
                                                    <h3 className="cert-card-title" title={cert.course_title}>
                                                        {cert.course_slug ? (
                                                            <Link to={`/student/courses/`}>
                                                                {cert.course_title}
                                                            </Link>
                                                        ) : (
                                                            cert.course_title || "Kursus Tidak Dikenal"
                                                        )}
                                                    </h3>

                                                    {/* Instructor */}
                                                    <div className="cert-card-instructor">
                                                        <i className="fas fa-user-tie text-teal me-2"></i>
                                                        <span className="text-truncate">
                                                            {cert.instructor_name || "BPSDM Setjen DPD RI"}
                                                        </span>
                                                    </div>

                                                    {/* Official Certificate ID Box with Copy Button */}
                                                    <div className="cert-id-badge-wrap">
                                                        <div className="cert-id-info">
                                                            <span className="cert-id-label">NO. SERTIFIKAT</span>
                                                            <code className="cert-id-text">
                                                                {cert.formatted_certificate_id || cert.certificate_id}
                                                            </code>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className={`cert-btn-copy-id ${copiedId === cert.id ? "copied" : ""}`}
                                                            onClick={(e) => handleCopyId(cert, e)}
                                                            title={copiedId === cert.id ? "Tersalin!" : "Salin Nomor Sertifikat"}
                                                        >
                                                            <i className={`fas ${copiedId === cert.id ? "fa-check text-success" : "fa-copy"}`}></i>
                                                        </button>
                                                    </div>

                                                    {/* Dates & Status Info */}
                                                    <div className="cert-card-dates">
                                                        <div className="cert-date-col">
                                                            <span className="cert-date-label">Tanggal Selesai</span>
                                                            <span className="cert-date-val">
                                                                <i className="fas fa-calendar-check text-teal me-1"></i>
                                                                {formatDate(cert.date)}
                                                            </span>
                                                        </div>
                                                        {cert.created_at && (
                                                            <div className="cert-date-col text-end">
                                                                <span className="cert-date-label">Diterbitkan</span>
                                                                <span className="cert-date-val">
                                                                    <i className="fas fa-stamp text-amber me-1"></i>
                                                                    {formatDate(cert.created_at)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Card Footer Actions */}
                                                <div className="cert-card-footer">
                                                    <button
                                                        type="button"
                                                        className="cert-btn-preview"
                                                        onClick={() => setPreviewModalCert(cert)}
                                                        title="Lihat Pratinjau Sertifikat"
                                                    >
                                                        <i className="fas fa-eye me-1"></i>
                                                        <span>Lihat</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="cert-btn-download"
                                                        onClick={(e) => downloadCertificate(cert, e)}
                                                        disabled={downloadingId === cert.id}
                                                        title="Unduh Sertifikat PNG"
                                                    >
                                                        {downloadingId === cert.id ? (
                                                            <>
                                                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                                <span>Mengunduh...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <i className="fas fa-download me-1"></i>
                                                                <span>Unduh</span>
                                                            </>
                                                        )}
                                                    </button>

                                                    {cert.validation_token && (
                                                        <Link
                                                            to={`/certificate/validate/${cert.validation_token}/`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="cert-btn-verify"
                                                            title="Verifikasi Keaslian Sertifikat di Sistem DPD RI"
                                                        >
                                                            <i className="fas fa-qrcode"></i>
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* =========================================================================
                                4. B. LIST VIEW (High-Density Tabular Compact Row)
                                ========================================================================= */}
                            {!loading && filteredCertificates.length > 0 && viewMode === "list" && (
                                <div className="cert-list-container">
                                    {filteredCertificates.map((cert) => {
                                        const levelInfo = getLevelBadge(cert.course_level);
                                        const imageUrl = getCertificateImageUrl(cert);

                                        return (
                                            <div key={cert.id} className="cert-list-row">
                                                {/* Left: Thumbnail Icon */}
                                                <div 
                                                    className="cert-list-thumb" 
                                                    onClick={() => setPreviewModalCert(cert)}
                                                    title="Lihat Pratinjau"
                                                >
                                                    {imageUrl && !imageLoadErrors[cert.id] ? (
                                                        <img
                                                            src={imageUrl}
                                                            alt={cert.course_title}
                                                            onError={() => handleImageError(cert.id)}
                                                        />
                                                    ) : (
                                                        <div className="cert-list-thumb-icon">
                                                            <i className="fas fa-award"></i>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Center-Left: Course & Instructor */}
                                                <div className="cert-list-main">
                                                    <div className="cert-list-tags">
                                                        <span className={`cert-level-badge ${levelInfo.tone}`}>
                                                            {levelInfo.label}
                                                        </span>
                                                        {cert.course_category && (
                                                            <span className="cert-category-badge">
                                                                {cert.course_category}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="cert-list-title" title={cert.course_title}>
                                                        {cert.course_title || "Kursus Tidak Dikenal"}
                                                    </h4>
                                                    <div className="cert-list-meta-sub">
                                                        <span>
                                                            <i className="fas fa-user-tie text-teal me-1"></i>
                                                            {cert.instructor_name || "BPSDM Setjen DPD RI"}
                                                        </span>
                                                        <span className="bullet-sep">•</span>
                                                        <span>
                                                            <i className="fas fa-calendar-check text-muted me-1"></i>
                                                            {formatDate(cert.date)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Center-Right: Certificate ID Badge */}
                                                <div className="cert-list-id-box">
                                                    <span className="cert-list-id-lbl">No. Sertifikat:</span>
                                                    <div className="d-flex align-items-center gap-1">
                                                        <code className="cert-list-id-code">
                                                            {cert.formatted_certificate_id || cert.certificate_id}
                                                        </code>
                                                        <button
                                                            type="button"
                                                            className={`cert-btn-copy-id ${copiedId === cert.id ? "copied" : ""}`}
                                                            onClick={(e) => handleCopyId(cert, e)}
                                                            title="Salin ID Sertifikat"
                                                        >
                                                            <i className={`fas ${copiedId === cert.id ? "fa-check text-success" : "fa-copy"}`}></i>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Right: Actions */}
                                                <div className="cert-list-actions">
                                                    <button
                                                        type="button"
                                                        className="cert-list-btn-preview"
                                                        onClick={() => setPreviewModalCert(cert)}
                                                        title="Pratinjau Sertifikat"
                                                    >
                                                        <i className="fas fa-eye"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="cert-list-btn-download"
                                                        onClick={(e) => downloadCertificate(cert, e)}
                                                        disabled={downloadingId === cert.id}
                                                        title="Unduh Sertifikat"
                                                    >
                                                        {downloadingId === cert.id ? (
                                                            <span className="spinner-border spinner-border-sm" role="status"></span>
                                                        ) : (
                                                            <i className="fas fa-download"></i>
                                                        )}
                                                    </button>
                                                    {cert.validation_token && (
                                                        <Link
                                                            to={`/certificate/validate/${cert.validation_token}/`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="cert-list-btn-verify"
                                                            title="Verifikasi Resmi"
                                                        >
                                                            <i className="fas fa-qrcode"></i>
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </section>

            {/* =========================================================================
                5. HIGH-FIDELITY CERTIFICATE PREVIEW MODAL
                ========================================================================= */}
            {previewModalCert && (
                <div 
                    className="cert-modal-backdrop"
                    onClick={() => setPreviewModalCert(null)}
                >
                    <div 
                        className="cert-modal-dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="cert-modal-header">
                            <div className="cert-modal-header-info">
                                <div className="cert-modal-header-badge">
                                    <i className="fas fa-award text-amber me-1"></i>
                                    <span>Sertifikat Resmi Terakreditasi DPD RI</span>
                                </div>
                                <h3 className="cert-modal-title">
                                    {previewModalCert.course_title}
                                </h3>
                                <div className="cert-modal-id-line">
                                    <span className="text-muted">Nomor Surat: </span>
                                    <code>{previewModalCert.formatted_certificate_id || previewModalCert.certificate_id}</code>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="cert-modal-close-btn"
                                onClick={() => setPreviewModalCert(null)}
                                title="Tutup Pratinjau (Esc)"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* Modal Body: High Resolution Certificate Image */}
                        <div className="cert-modal-body">
                            {getCertificateImageUrl(previewModalCert) ? (
                                <div className="cert-modal-image-wrap">
                                    <img
                                        src={getCertificateImageUrl(previewModalCert)}
                                        alt={`Sertifikat ${previewModalCert.course_title}`}
                                        className="cert-modal-img"
                                    />
                                </div>
                            ) : (
                                <div className="cert-modal-fallback-card">
                                    <i className="fas fa-award cert-fallback-icon text-amber"></i>
                                    <h4 className="fw-bold mt-3 mb-2">{previewModalCert.course_title}</h4>
                                    <p className="text-muted">Diberikan kepada:</p>
                                    <h5 className="text-teal fw-bold">{previewModalCert.student_name || userData?.full_name}</h5>
                                    <code className="d-block my-3 p-2 bg-light rounded text-dark fs-6">
                                        {previewModalCert.formatted_certificate_id || previewModalCert.certificate_id}
                                    </code>
                                    <p className="text-muted small">
                                        Tanggal Selesai: {formatFullDate(previewModalCert.date)}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer: Action Bar */}
                        <div className="cert-modal-footer">
                            <div className="cert-modal-meta">
                                <span className="text-muted small">
                                    <i className="fas fa-calendar-check text-teal me-1"></i>
                                    Diselesaikan pada {formatDate(previewModalCert.date)}
                                </span>
                            </div>
                            <div className="cert-modal-actions">
                                <button
                                    type="button"
                                    className="btn cert-modal-btn-download"
                                    onClick={(e) => downloadCertificate(previewModalCert, e)}
                                    disabled={downloadingId === previewModalCert.id}
                                >
                                    {downloadingId === previewModalCert.id ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                            Mengunduh...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-download me-2"></i>
                                            Unduh Sertifikat (PNG)
                                        </>
                                    )}
                                </button>

                                {getCertificateImageUrl(previewModalCert) && (
                                    <a
                                        href={getCertificateImageUrl(previewModalCert)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn cert-modal-btn-open"
                                        title="Buka gambar di tab baru"
                                    >
                                        <i className="fas fa-arrow-up-right-from-square me-2"></i>
                                        Tab Baru
                                    </a>
                                )}

                                <button
                                    type="button"
                                    className="btn cert-modal-btn-close"
                                    onClick={() => setPreviewModalCert(null)}
                                >
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </>
    );
}

export default React.memo(SertifikatKursus);
