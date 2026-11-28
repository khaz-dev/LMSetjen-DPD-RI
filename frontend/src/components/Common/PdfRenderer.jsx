import React, { useState, useEffect, useRef, useCallback } from "react";
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
 * Individual Page Item in Continuous Multi-Page Scroll Mode
 */
const PdfPageCard = ({
    pdfDoc,
    pageNum,
    scale,
    isActive,
    viewportRef,
    onPageVisible
}) => {
    const canvasRef = useRef(null);
    const cardRef = useRef(null);
    const renderTaskRef = useRef(null);
    const [isRendered, setIsRendered] = useState(false);

    const renderPage = useCallback(() => {
        if (!pdfDoc || !canvasRef.current) return;
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
            renderTaskRef.current = null;
        }

        pdfDoc.getPage(pageNum).then((page) => {
            if (!canvasRef.current) return;
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
                    setIsRendered(true);
                    renderTaskRef.current = null;
                })
                .catch((err) => {
                    if (err?.name !== "RenderingCancelledException") {
                        console.warn(`[PdfRenderer] Render error on page ${pageNum}:`, err);
                    }
                });
        }).catch((err) => {
            console.warn(`[PdfRenderer] getPage error on page ${pageNum}:`, err);
        });
    }, [pdfDoc, pageNum, scale]);

    // Initial render & viewport observer for lazy rendering and scroll tracking
    useEffect(() => {
        const cardEl = cardRef.current;
        if (!cardEl) return;

        // Render immediately for first 2 pages
        if (pageNum <= 2) {
            renderPage();
        }

        let hasRendered = pageNum <= 2;
        const renderObserver = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !hasRendered && pdfDoc) {
                    hasRendered = true;
                    renderPage();
                }
            },
            {
                root: viewportRef?.current || null,
                rootMargin: "600px 0px 600px 0px"
            }
        );
        renderObserver.observe(cardEl);

        const visibilityObserver = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    onPageVisible(pageNum);
                }
            },
            {
                root: viewportRef?.current || null,
                threshold: 0.35
            }
        );
        visibilityObserver.observe(cardEl);

        return () => {
            renderObserver.disconnect();
            visibilityObserver.disconnect();
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [pdfDoc, pageNum, renderPage, viewportRef, onPageVisible]);

    // Re-render when scale changes
    useEffect(() => {
        if (isRendered) {
            renderPage();
        }
    }, [scale, renderPage, isRendered]);

    return (
        <div
            id={`pdf-page-${pageNum}`}
            ref={cardRef}
            className={`pdf-page-card ${isActive ? "active-page" : ""}`}
            style={{
                minHeight: isRendered ? "auto" : `${Math.floor(650 * (scale / 1.1))}px`,
                width: "fit-content"
            }}
        >
            <canvas ref={canvasRef} className="pdf-canvas-element" />
            <div className="pdf-page-number-pill">
                Halaman {pageNum}
            </div>
        </div>
    );
};

/**
 * PdfRenderer - Native Continuous Scroll Multi-Page Canvas-based PDF Document Viewer
 * for LMS Setjen DPD RI.
 *
 * Solves the browser download interception issue & provides seamless vertical scroll:
 * - Direct continuous scrolling through all pages (continuous reading mode)
 * - Automatic active page tracking in toolbar as user scrolls
 * - Crisp high-DPI canvas rendering
 * - Page navigation & jump (Prev, Next, Page Jump)
 * - Zoom controls (Zoom In, Zoom Out, Fit Width)
 * - Thumbnails sidebar
 * - Fullscreen mode
 */
const PdfRenderer = ({
    fileUrl,
    height = "520px",
    title = "Dokumen PDF",
    showThumbnails = false,
    onDocLoaded
}) => {
    const [pdfDoc, setPdfDoc] = useState(null);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(showThumbnails);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const containerRef = useRef(null);
    const viewportRef = useRef(null);

    const scrollToPage = useCallback((targetPage) => {
        const page = Math.max(1, Math.min(numPages, targetPage));
        setCurrentPage(page);
        const el = document.getElementById(`pdf-page-${page}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [numPages]);

    const handlePageVisible = useCallback((pageNum) => {
        setCurrentPage(pageNum);
    }, []);

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
                            if (typeof onDocLoaded === 'function') {
                                onDocLoaded({ numPages: doc.numPages });
                            }
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
                            if (typeof onDocLoaded === 'function') {
                                onDocLoaded({ numPages: doc.numPages });
                            }
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

    // Fullscreen Toggle
    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
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
                scrollToPage(currentPage + 1);
            } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
                scrollToPage(currentPage - 1);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [pdfDoc, numPages, currentPage, scrollToPage]);

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
                        onClick={() => scrollToPage(currentPage - 1)}
                        disabled={currentPage <= 1}
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
                        onClick={() => scrollToPage(currentPage + 1)}
                        disabled={currentPage >= numPages}
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
                        onClick={() => setScale((s) => Math.min(2, Number((s + 0.15).toFixed(2))))}
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
                                onClick={() => scrollToPage(pg)}
                            >
                                <div className="d-flex align-items-center justify-content-center bg-white border rounded" style={{ height: "60px" }}>
                                    <i className="fas fa-file-alt text-muted fa-lg"></i>
                                </div>
                                <div className="pdf-thumbnail-label">Hal. {pg}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Canvas Viewport with Continuous Multi-Page Scroll */}
                <div className="pdf-canvas-viewport" ref={viewportRef}>
                    <div className="pdf-pages-container">
                        {Array.from({ length: numPages }, (_, idx) => idx + 1).map((pg) => (
                            <PdfPageCard
                                key={pg}
                                pageNum={pg}
                                pdfDoc={pdfDoc}
                                scale={scale}
                                isActive={pg === currentPage}
                                viewportRef={viewportRef}
                                onPageVisible={handlePageVisible}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PdfRenderer;
