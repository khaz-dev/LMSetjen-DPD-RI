import React, { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import apiInstance from "../../utils/axios";
import "./PdfRenderer.css";

// Configure PDF.js worker safely for Vite and browser environments
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.js",
            import.meta.url
        ).toString();
    } catch (e) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }
}

/**
 * PdfRenderer - Native Canvas-based PDF Document Viewer for LMS Setjen DPD RI.
 *
 * Solves the browser download interception issue:
 * Instead of embedding an <iframe src="..."> which triggers Chrome/Edge to download the PDF,
 * this component fetches the PDF data and renders each page directly onto an HTML5 <canvas>.
 *
 * Rendered in Bright Mode:
 * - Crisp high-DPI canvas rendering
 * - Page navigation (Prev, Next, Page Jump)
 * - Zoom controls (Zoom In, Zoom Out, Fit Width)
 * - Thumbnails sidebar
 * - Fullscreen mode
 */
const PdfRenderer = ({
    fileUrl,
    height = "520px",
    title = "Dokumen PDF",
    showThumbnails = false
}) => {
    const [pdfDoc, setPdfDoc] = useState(null);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.1);
    const [loading, setLoading] = useState(true);
    const [pageRendering, setPageRendering] = useState(false);
    const [error, setError] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(showThumbnails);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const renderTaskRef = useRef(null);

    // Load PDF Document
    useEffect(() => {
        let isMounted = true;
        let activeLoadingTask = null;
        setLoading(true);
        setError(null);
        setCurrentPage(1);

        if (!fileUrl) {
            setLoading(false);
            return;
        }

        // ⭐ IDM BYPASS: Fetch via API endpoint as JSON with base64 data.
        // This completely prevents Internet Download Manager (IDM) browser extension
        // and Chrome download interceptors from blocking or grabbing the PDF file.
        apiInstance.get(`course/pdf-data/?file_url=${encodeURIComponent(fileUrl)}`)
            .then((res) => {
                if (!isMounted) return;
                if (res.data?.success && res.data?.data) {
                    const binaryString = atob(res.data.data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    activeLoadingTask = pdfjsLib.getDocument({
                        data: bytes
                    });

                    return activeLoadingTask.promise.then((doc) => {
                        if (isMounted) {
                            setPdfDoc(doc);
                            setNumPages(doc.numPages);
                            setLoading(false);
                        }
                    });
                } else {
                    throw new Error(res.data?.error || "Gagal memproses berkas PDF.");
                }
            })
            .catch((err) => {
                console.warn("[PdfRenderer] API fetch failed, trying direct fallback:", err);
                if (!isMounted) return;

                activeLoadingTask = pdfjsLib.getDocument({
                    url: fileUrl,
                    withCredentials: false
                });

                activeLoadingTask.promise
                    .then((doc) => {
                        if (isMounted) {
                            setPdfDoc(doc);
                            setNumPages(doc.numPages);
                            setLoading(false);
                        }
                    })
                    .catch((fallbackErr) => {
                        console.error("[PdfRenderer] Error loading PDF:", fallbackErr);
                        if (isMounted) {
                            setError("Gagal memuat dokumen PDF. Pastikan tautan berkas valid dan dapat diakses.");
                            setLoading(false);
                        }
                    });
            });

        return () => {
            isMounted = false;
            if (activeLoadingTask && activeLoadingTask.destroy) {
                activeLoadingTask.destroy();
            }
        };
    }, [fileUrl]);

    // Render Current Page
    useEffect(() => {
        if (!pdfDoc || !canvasRef.current) return;

        let isCurrent = true;
        setPageRendering(true);

        // Cancel previous render task if active
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
            renderTaskRef.current = null;
        }

        pdfDoc.getPage(currentPage).then((page) => {
            if (!isCurrent || !canvasRef.current) return;

            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            const dpr = window.devicePixelRatio || 1;

            const viewport = page.getViewport({ scale });
            canvas.width = Math.floor(viewport.width * dpr);
            canvas.height = Math.floor(viewport.height * dpr);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            const renderTask = page.render(renderContext);
            renderTaskRef.current = renderTask;

            renderTask.promise
                .then(() => {
                    if (isCurrent) {
                        setPageRendering(false);
                        renderTaskRef.current = null;
                    }
                })
                .catch((renderErr) => {
                    if (renderErr?.name !== "RenderingCancelledException") {
                        console.warn("[PdfRenderer] Render warning:", renderErr);
                    }
                    if (isCurrent) {
                        setPageRendering(false);
                        renderTaskRef.current = null;
                    }
                });
        });

        return () => {
            isCurrent = false;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [pdfDoc, currentPage, scale]);

    // Fullscreen Toggle
    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!pdfDoc || numPages <= 1) return;
            if (e.key === "ArrowRight" || e.key === "PageDown") {
                setCurrentPage((prev) => Math.min(numPages, prev + 1));
            } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
                setCurrentPage((prev) => Math.max(1, prev - 1));
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [pdfDoc, numPages]);

    if (loading) {
        return (
            <div className="pdf-loading-overlay text-center border" style={{ height }}>
                <div className="spinner-border text-teal mb-2" role="status">
                    <span className="visually-hidden">Loading PDF...</span>
                </div>
                <div className="fw-semibold text-dark small">Menyiapkan Dokumen PDF...</div>
                <div className="text-muted" style={{ fontSize: "0.75rem" }}>Memuat halaman tanpa unduhan langsung...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="pdf-loading-overlay text-center border bg-light" style={{ height }}>
                <i className="fas fa-exclamation-circle text-danger fa-2x mb-2"></i>
                <div className="fw-bold text-dark small">{error}</div>
                <div className="text-muted mb-3" style={{ fontSize: "0.75rem" }}>
                    Tautan: <span className="text-break">{fileUrl}</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-teal"
                        style={{ fontSize: "0.75rem" }}
                    >
                        <i className="fas fa-external-link-alt me-1"></i>Buka di Tab Baru
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="pdf-renderer-container" style={{ height }}>
            {/* Bright Toolbar */}
            <div className="pdf-toolbar">
                <div className="d-flex align-items-center gap-1">
                    <button
                        type="button"
                        className={`pdf-toolbar-btn ${sidebarOpen ? "active" : ""}`}
                        onClick={() => setSidebarOpen((prev) => !prev)}
                        title="Buka / Tutup Daftar Halaman"
                    >
                        <i className="fas fa-th-list"></i>
                    </button>
                    <span className="text-dark fw-bold small ms-1 text-truncate" style={{ maxWidth: "240px", fontSize: "0.78rem" }} title={title}>
                        <i className="fas fa-file-pdf text-danger me-1"></i>
                        {title || fileUrl?.split("/")?.pop() || "Dokumen PDF"}
                    </span>
                </div>

                {/* Page Navigation */}
                <div className="d-flex align-items-center gap-1">
                    <button
                        type="button"
                        className="pdf-toolbar-btn"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1 || pageRendering}
                        title="Halaman Sebelumnya (Panah Kiri)"
                    >
                        <i className="fas fa-chevron-left"></i>
                    </button>

                    <span className="badge bg-light text-dark border px-2 py-1" style={{ fontSize: "0.75rem", minWidth: "85px", textAlign: "center" }}>
                        {currentPage} / {numPages}
                    </span>

                    <button
                        type="button"
                        className="pdf-toolbar-btn"
                        onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                        disabled={currentPage >= numPages || pageRendering}
                        title="Halaman Berikutnya (Panah Kanan)"
                    >
                        <i className="fas fa-chevron-right"></i>
                    </button>
                </div>

                {/* Zoom & Extras */}
                <div className="d-flex align-items-center gap-1">
                    <button
                        type="button"
                        className="pdf-toolbar-btn"
                        onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.15).toFixed(2))))}
                        title="Perkecil (-)"
                    >
                        <i className="fas fa-search-minus"></i>
                    </button>
                    <button
                        type="button"
                        className="pdf-toolbar-btn"
                        onClick={() => setScale(1.1)}
                        title="Ukuran Asli (100%)"
                        style={{ fontSize: "0.7rem", minWidth: "46px", justifyContent: "center" }}
                    >
                        {Math.round((scale / 1.1) * 100)}%
                    </button>
                    <button
                        type="button"
                        className="pdf-toolbar-btn"
                        onClick={() => setScale((s) => Math.min(2.5, Number((s + 0.15).toFixed(2))))}
                        title="Perbesar (+)"
                    >
                        <i className="fas fa-search-plus"></i>
                    </button>

                    <button
                        type="button"
                        className="pdf-toolbar-btn ms-1"
                        onClick={toggleFullscreen}
                        title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
                    >
                        <i className={`fas fa-${isFullscreen ? "compress" : "expand"}`}></i>
                    </button>

                    <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pdf-toolbar-btn"
                        title="Buka Dokumen Asli di Tab Baru"
                    >
                        <i className="fas fa-external-link-alt"></i>
                    </a>
                </div>
            </div>

            {/* Document Body */}
            <div className="pdf-body">
                {/* Thumbnails Sidebar */}
                {sidebarOpen && numPages > 0 && (
                    <div className="pdf-thumbnails-sidebar">
                        {Array.from({ length: numPages }, (_, idx) => idx + 1).map((pg) => (
                            <div
                                key={pg}
                                className={`pdf-thumbnail-item ${pg === currentPage ? "active" : ""}`}
                                onClick={() => setCurrentPage(pg)}
                            >
                                <div className="d-flex align-items-center justify-content-center bg-white border rounded" style={{ height: "60px" }}>
                                    <i className="fas fa-file-alt text-muted fa-lg"></i>
                                </div>
                                <div className="pdf-thumbnail-label">Hal. {pg}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Canvas Viewport */}
                <div className="pdf-canvas-viewport">
                    <div className="pdf-page-card">
                        <canvas ref={canvasRef} className="pdf-canvas-element" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PdfRenderer;

