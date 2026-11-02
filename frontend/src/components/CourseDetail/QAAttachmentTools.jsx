import React, { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import { getMediaUrl } from "../../utils/constants";
import {
    formatFileSize,
    isImageFile,
    isPdfFile,
    getFileExtension,
} from "../../utils/qaCompression";

/**
 * Preview chip for an attached file in input forms (before submit).
 * Shows thumbnail/icon, filename, file size, and remove button.
 */
export const QAAttachmentInputPreview = ({
    file,
    isCompressing,
    onRemove,
    compact = false,
}) => {
    const [previewUrl, setPreviewUrl] = useState(null);

    useEffect(() => {
        if (!file || !file.type?.startsWith("image/")) {
            setPreviewUrl(null);
            return;
        }

        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [file]);

    if (isCompressing) {
        return (
            <div className={`qa-attachment-preview-chip compressing ${compact ? "compact" : ""}`}>
                <div className="d-flex align-items-center gap-2">
                    <i className="fas fa-circle-notch fa-spin text-teal"></i>
                    <span className="qa-attachment-name">Mengoptimalkan & mengompresi gambar...</span>
                </div>
            </div>
        );
    }

    if (!file) return null;

    const isImg = file.type?.startsWith("image/") || isImageFile(file.name);
    const isPdf = file.type === "application/pdf" || isPdfFile(file.name);

    return (
        <div className={`qa-attachment-preview-chip ${compact ? "compact" : ""}`}>
            <div className="d-flex align-items-center gap-2 flex-grow-1 overflow-hidden">
                {isImg && previewUrl ? (
                    <img src={previewUrl} alt="Pratinjau" className="qa-attachment-thumb" />
                ) : isPdf ? (
                    <div className="qa-attachment-file-icon pdf">
                        <i className="fas fa-file-pdf"></i>
                    </div>
                ) : (
                    <div className="qa-attachment-file-icon default">
                        <i className="fas fa-paperclip"></i>
                    </div>
                )}
                <div className="qa-attachment-info text-truncate">
                    <span className="qa-attachment-name text-truncate d-block" title={file.name}>
                        {file.name}
                    </span>
                    <span className="qa-attachment-size">
                        {formatFileSize(file.size)}
                        {isImg && <span className="badge bg-success-subtle text-success ms-1 px-1 py-0" style={{ fontSize: '0.68rem' }}>WebP</span>}
                    </span>
                </div>
            </div>
            <button
                type="button"
                className="qa-attachment-remove-btn"
                onClick={onRemove}
                title="Hapus lampiran"
                aria-label="Hapus lampiran"
            >
                <i className="fas fa-times"></i>
            </button>
        </div>
    );
};

/**
 * Display component for an uploaded attachment in question or reply card.
 * Renders an interactive image with click-to-zoom or a styled PDF link.
 */
export const QAAttachmentDisplay = ({ fileUrl, fileName, onImageClick }) => {
    if (!fileUrl) return null;

    const fullUrl = getMediaUrl(fileUrl);
    const displayName = fileName || fileUrl.split("/").pop() || "Lampiran";
    const isImg = isImageFile(fileUrl) || isImageFile(displayName);
    const isPdf = isPdfFile(fileUrl) || isPdfFile(displayName);

    if (isImg) {
        return (
            <div className="qa-attachment-display-container my-2">
                <div
                    className="qa-image-attachment-wrapper"
                    onClick={() => onImageClick && onImageClick(fullUrl, displayName)}
                    title="Klik untuk memperbesar gambar"
                >
                    <img
                        src={fullUrl}
                        alt={displayName}
                        className="qa-image-attachment-thumb"
                        loading="lazy"
                    />
                    <div className="qa-image-attachment-overlay">
                        <i className="fas fa-search-plus me-1"></i>
                        <span>Lihat Gambar Penuh</span>
                    </div>
                </div>
                <div className="qa-attachment-caption">
                    <i className="fas fa-image me-1 text-muted"></i>
                    <span className="text-truncate">{displayName}</span>
                </div>
            </div>
        );
    }

    if (isPdf) {
        return (
            <div className="qa-attachment-display-container my-2">
                <a
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="qa-pdf-attachment-card"
                    title={`Buka dokumen: ${displayName}`}
                >
                    <div className="qa-pdf-icon-wrapper">
                        <i className="fas fa-file-pdf"></i>
                    </div>
                    <div className="qa-pdf-meta text-truncate">
                        <span className="qa-pdf-title text-truncate d-block">{displayName}</span>
                        <span className="qa-pdf-sub">
                            Dokumen PDF &bull; Klik untuk membuka di tab baru <i className="fas fa-external-link-alt ms-1" style={{ fontSize: '0.7rem' }}></i>
                        </span>
                    </div>
                </a>
            </div>
        );
    }

    // Generic fallback for any other files
    return (
        <div className="qa-attachment-display-container my-2">
            <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="qa-generic-attachment-card"
            >
                <i className="fas fa-paperclip me-2 text-primary"></i>
                <span className="text-truncate me-2">{displayName}</span>
                <i className="fas fa-download ms-auto text-muted"></i>
            </a>
        </div>
    );
};

/**
 * Image Lightbox / Fullscreen Viewer Modal
 */
export const QAImageLightboxModal = ({ show, onHide, imageUrl, imageName }) => {
    if (!show) return null;

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            size="lg"
            className="qa-image-lightbox-modal"
            contentClassName="qa-lightbox-modal-content border-0 bg-transparent"
        >
            <div className="qa-lightbox-inner">
                {/* Header bar */}
                <div className="qa-lightbox-header d-flex align-items-center justify-content-between p-2 text-white">
                    <span className="text-truncate me-3 fw-medium" style={{ fontSize: '0.9rem' }}>
                        <i className="fas fa-image me-2 text-teal-light"></i>
                        {imageName || "Pratinjau Gambar Lampiran"}
                    </span>
                    <div className="d-flex align-items-center gap-2">
                        {imageUrl && (
                            <a
                                href={imageUrl}
                                download={imageName || "attachment"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-dark text-white rounded-pill px-3"
                                style={{ background: 'rgba(255,255,255,0.15)', border: 'none' }}
                                title="Buka / Unduh gambar asli"
                            >
                                <i className="fas fa-download me-1"></i>Unduh
                            </a>
                        )}
                        <button
                            type="button"
                            className="btn btn-sm btn-dark text-white rounded-circle p-2"
                            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={onHide}
                            aria-label="Tutup"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                {/* Body image */}
                <div className="qa-lightbox-body text-center p-2" onClick={onHide}>
                    <img
                        src={imageUrl}
                        alt={imageName || "Pratinjau"}
                        className="qa-lightbox-img"
                        onClick={(e) => e.stopPropagation()} // Prevent close on image click
                    />
                </div>
            </div>
        </Modal>
    );
};

