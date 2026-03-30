import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import apiInstance from "../../utils/axios";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
import { getMediaUrl } from "../../utils/constants";
// ✨ PHASE 11.12: Import caching hook for seamless navigation
import { usePageCache } from "../../utils/usePageCache";

import "./SertifikatKursus.css";

function SertifikatKursus() {
    const [certificates, setCertificates] = useState([]);
    const [filteredCertificates, setFilteredCertificates] = useState([]);
    const [error, setError] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [previewingId, setPreviewingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [instructorFilter, setInstructorFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const isCollapsed = useSidebarCollapse();
    const userData = UserData();

    // Fetch all student certificates
    const fetchCertificates = async () => {
        try {
            setError(null);
            
            const response = await apiInstance.get(`student/certificates/${userData?.user_id}/`);
            const certificatesData = response.data?.results || response.data?.certificates || [];
            const certificatesArray = Array.isArray(certificatesData) ? certificatesData : [];
            
            if (certificatesArray.length === 0) {
                console.log('No certificates found for student');
            }
            
            return certificatesArray;
        } catch (err) {
            console.error("Error fetching certificates:", err);
            setError("Gagal memuat sertifikat");
            Toast().fire({
                icon: "error",
                title: "Gagal memuat sertifikat",
                text: err.response?.data?.message || "Silakan coba lagi"
            });
            throw err;
        }
    };

    // ✨ PHASE 11.12: Use page cache to avoid reloading when navigating
    const { data: cachedCertificates, loading } = usePageCache(
        'student-certificates',
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

    useEffect(() => {
        let filtered = [...certificates];

        // Filter by course/instructor name
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(cert => 
                cert.course_title?.toLowerCase().includes(query) || 
                cert.instructor_name?.toLowerCase().includes(query)
            );
        }

        // Filter by instructor
        if (instructorFilter.trim()) {
            filtered = filtered.filter(cert => 
                cert.instructor_name?.toLowerCase().includes(instructorFilter.toLowerCase())
            );
        }

        // Filter by date range
        if (startDate) {
            filtered = filtered.filter(cert => {
                const certDate = new Date(cert.date);
                return certDate >= new Date(startDate);
            });
        }
        if (endDate) {
            filtered = filtered.filter(cert => {
                const certDate = new Date(cert.date);
                return certDate <= new Date(endDate);
            });
        }

        setFilteredCertificates(filtered);
    }, [certificates, searchQuery, instructorFilter, startDate, endDate]);

    // Download certificate image
    const downloadCertificate = async (certificate) => {
        if (!certificate?.id) {
            Toast().fire({
                icon: "error",
                title: "Sertifikat tidak valid"
            });
            return;
        }

        try {
            setDownloadingId(certificate.id);
            
            // Get the image URL from the certificate
            const imageUrl = certificate.image_file_url;
            
            if (!imageUrl) {
                Toast().fire({
                    icon: "warning",
                    title: "Gambar sertifikat belum tersedia",
                    text: "Silakan coba lagi dalam beberapa saat"
                });
                setDownloadingId(null);
                return;
            }

            // Fetch the image as a blob to force download instead of opening in browser
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
            
            // Create a blob URL and trigger download
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', `Sertifikat_${certificate.course_title?.replace(/\s+/g, '_')}_${certificate.certificate_id}.png`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            
            // Clean up the blob URL
            window.URL.revokeObjectURL(blobUrl);

            Toast().fire({
                icon: "success",
                title: "Berhasil!",
                text: "Sertifikat berhasil diunduh"
            });
        } catch (error) {
            console.error('Error downloading certificate:', error);
            Toast().fire({
                icon: "error",
                title: "Unduhan Gagal",
                text: "Gagal mengunduh sertifikat. Silakan coba lagi"
            });
        } finally {
            setDownloadingId(null);
        }
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // ✨ PHASE 11.X: Get certificate level badge color - Updated to Teal palette
    const getLevelColor = (level) => {
        const colors = {
            'Beginner': '#2dd4bf',      // Teal-400 (lightest)
            'Intermediate': '#0d9488',  // Teal-600 (medium)
            'Advanced': '#0f766e',      // Teal-700 (dark)
            'Expert': '#115e59'         // Teal-800 (darkest)
        };
        return colors[level] || '#14b8a6';  // Teal-500 default
    };

    if (!userData?.user_id) {
        return (
            <div className="container mt-5">
                <div className="alert alert-warning">
                    Silakan login terlebih dahulu
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
                    <div className="row mt-0 md-4">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* Page Header */}
                            <div className="page-header-card">
                                <div className="page-header-content">
                                    <div className="row align-items-center">
                                        <div className="col-lg-8">
                                            <h1 className="mb-3 fw-bold d-flex align-items-center">
                                                <i className="fas fa-certificate me-3" style={{ fontSize: '2.5rem' }}></i>
                                                Sertifikat Kursus Saya
                                            </h1>
                                            <p className="mb-0 opacity-90 lead">
                                                Koleksi lengkap sertifikat atas penyelesaian kursus Anda
                                            </p>
                                        </div>
                                        <div className="col-lg-4 d-flex justify-content-end align-items-center">
                                            {!loading && certificates.length > 0 && (
                                                <div className="stat-card-header-wrapper">
                                                    <div className="stat-card-header">
                                                        <div className="stat-number justify-content-end">
                                                            {certificates.length}
                                                        </div>
                                                        <div className="stat-label">Total Sertifikat</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Loading State */}
                            {loading && (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary mb-3" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                    <p className="text-muted">Memuat sertifikat...</p>
                                </div>
                            )}

                            {/* Error State */}
                            {error && !loading && (
                                <div className="alert alert-danger alert-dismissible fade show mt-3" role="alert">
                                    <i className="fas fa-exclamation-circle me-2"></i>
                                    <strong>Error:</strong> {error}
                                    <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                                </div>
                            )}

                            {/* Empty State */}
                            {!loading && certificates.length === 0 && !error && (
                                <div className="empty-state">
                                    <i className="fas fa-certificate empty-icon"></i>
                                    <h4 className="text-muted mb-3">Belum Ada Sertifikat</h4>
                                    <p className="text-muted mb-4">
                                        Selesaikan kursus dan lulus semua kuis untuk mendapatkan sertifikat
                                    </p>
                                    <Link to="/student/courses/" className="empty-state-link-btn">
                                        <i className="fas fa-book"></i>
                                        <span>Lihat Kursus Saya</span>
                                    </Link>
                                </div>
                            )}

                            {/* Search and Filter Section */}
                            {!loading && certificates.length > 0 && (
                                <div className="certificate-filters mb-4">
                                    <div className="row g-3">
                                        {/* Course/Instructor Search */}
                                        <div className="col-12 col-md-6">
                                            <div className="position-relative">
                                                <input
                                                    type="text"
                                                    className="form-control form-control-modern"
                                                    placeholder="Cari berdasarkan nama kursus atau instruktur..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                />
                                                <i className="fas fa-search search-filter-icon"></i>
                                            </div>
                                        </div>

                                        {/* Date Range Filter */}
                                        <div className="col-12 col-md-6">
                                            <div className="date-range-inputs">
                                                <input
                                                    type="date"
                                                    className="form-control form-control-modern"
                                                    placeholder="Dari tanggal"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    title="Dari tanggal"
                                                />
                                                <span className="date-range-separator">—</span>
                                                <input
                                                    type="date"
                                                    className="form-control form-control-modern"
                                                    placeholder="Ke tanggal"
                                                    value={endDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    title="Ke tanggal"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Clear Filters Button */}
                                    {(searchQuery || startDate || endDate) && (
                                        <div className="mt-2">
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => {
                                                    setSearchQuery('');
                                                    setStartDate('');
                                                    setEndDate('');
                                                }}
                                            >
                                                <i className="fas fa-times me-1"></i>
                                                Hapus Filter
                                            </button>
                                        </div>
                                    )}

                                    {/* Results Count */}
                                    <div className="filter-results-info mt-2">
                                        <small className="text-muted">
                                            Menampilkan <strong>{filteredCertificates.length}</strong> dari <strong>{certificates.length}</strong> sertifikat
                                        </small>
                                    </div>
                                </div>
                            )}

                            {/* Empty Filter Results */}
                            {!loading && certificates.length > 0 && filteredCertificates.length === 0 && (
                                <div className="empty-state">
                                    <i className="fas fa-search empty-icon"></i>
                                    <h4 className="text-muted mb-3">Tidak Ada Hasil</h4>
                                    <p className="text-muted mb-4">
                                        Tidak ada sertifikat yang sesuai dengan filter yang Anda tentukan
                                    </p>
                                    <button
                                        className="btn btn-modern"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setStartDate('');
                                            setEndDate('');
                                        }}
                                    >
                                        <i className="fas fa-redo me-2"></i>
                                        Reset Filter
                                    </button>
                                </div>
                            )}

                            {/* Certificates Grid */}
                            {!loading && filteredCertificates.length > 0 && (
                                <div className="certificate-list">
                                    {filteredCertificates.map((certificate) => (
                                        <div key={certificate.id} className="certificate-card-horizontal">
                                            {/* Certificate Body - Bright Theme */}
                                            <div className="certificate-body-horizontal">
                                                    {/* Certificate Detail - Course Title, Instructor, ID & Badge */}
                                                    <div className="certificate-detail d-flex align-items-center justify-content-between">
                                                        <div className="certificate-detail-left">
                                                            {/* Course Title */}
                                                            <h5 className="certificate-course-title">
                                                                {certificate.course_title || 'Kursus Tidak Dikenal'}
                                                            </h5>

                                                            {/* Instructor */}
                                                            <div className="certificate-instructor mb-3">
                                                                <small className="text-muted">
                                                                    <i className="fas fa-user-tie me-1"></i>
                                                                    {certificate.instructor_name || 'Instruktur Tidak Dikenal'}
                                                                </small>
                                                            </div>

                                                            {/* Certificate ID & Badge */}
                                                            <div className="d-flex align-items-center gap-2">
                                                                <div>
                                                                    <small className="d-block text-muted mb-1">Nomor Sertifikat</small>
                                                                    <code className="certificate-id-badge">
                                                                        {certificate.formatted_certificate_id || certificate.certificate_id}
                                                                    </code>
                                                                </div>
                                                                {certificate.course_level && (
                                                                    <span 
                                                                        className="badge certificate-level-badge" 
                                                                        style={{ backgroundColor: getLevelColor(certificate.course_level) }}
                                                                    >
                                                                        {certificate.course_level}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Category */}
                                                    {certificate.course_category && (
                                                        <p className="mb-3">
                                                            <small className="text-muted">
                                                                <i className="fas fa-tag me-1"></i>
                                                                {certificate.course_category}
                                                            </small>
                                                        </p>
                                                    )}

                                                    {/* Dates */}
                                                    <div className="certificate-dates">
                                                        <div className="date-item">
                                                            <small className="text-muted d-block">Tanggal Selesai</small>
                                                            <small className="fw-500">
                                                                <i className="fas fa-calendar-check me-1"></i>
                                                                {formatDate(certificate.date)}
                                                            </small>
                                                        </div>
                                                        {certificate.created_at && (
                                                            <div className="date-item">
                                                                <small className="text-muted d-block">Tanggal Terbit</small>
                                                                <small className="fw-500">
                                                                    <i className="fas fa-calendar me-1"></i>
                                                                    {formatDate(certificate.created_at)}
                                                                </small>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="certificate-actions mt-auto d-flex">
                                                        <button
                                                            onClick={() => downloadCertificate(certificate)}
                                                            disabled={downloadingId === certificate.id || !certificate.image_file_url}
                                                            className="btn btn-download btn-modern btn-sm"
                                                            title="Unduh sertifikat"
                                                        >
                                                            {downloadingId === certificate.id ? (
                                                                <>
                                                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                                    Mengunduh...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <i className="fas fa-download me-2"></i>
                                                                    Unduh Sertifikat
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Modal untuk Preview Sertifikat Besar */}
            {previewingId && (
                <div className="certificate-modal-overlay" onClick={() => setPreviewingId(null)}>
                    <div className="certificate-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button 
                            className="certificate-modal-close" 
                            onClick={() => setPreviewingId(null)}
                            title="Tutup"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                        <div className="certificate-modal-body">
                            {certificates.find(c => c.id === previewingId)?.image_file_url && (
                                <img 
                                    src={certificates.find(c => c.id === previewingId)?.image_file_url} 
                                    alt="Certificate preview"
                                    className="w-100"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </>
    );
}

export default React.memo(SertifikatKursus);
