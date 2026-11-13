import React, { useState, useEffect, useRef } from "react";
import apiInstance from "../../utils/axios";
import "./PptxRenderer.css";

/**
 * PptxRenderer - Real, native presentation viewer for PPTX slides.
 * Rendered in Bright Mode with clean white / light-gray theme.
 * Reconstructs PowerPoint slides exactly as designed:
 * - 16:9 responsive presentation canvas with proportional geometries
 * - Precise layout positioning, fills, borders, and typography
 * - Thumbnails sidebar, Next/Previous controls, Fullscreen mode, and Download.
 */
const PptxRenderer = ({
    fileUrl,
    height = "420px",
    showThumbnails = true,
    showToolbar = true,
    defaultSlideIndex = 0,
    onPresentationLoaded
}) => {
    const [loading, setLoading] = useState(true);
    const [presentation, setPresentation] = useState(null);
    const [error, setError] = useState(null);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(defaultSlideIndex);
    const [sidebarOpen, setSidebarOpen] = useState(showThumbnails);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);
        setCurrentSlideIndex(0);

        if (!fileUrl) {
            setLoading(false);
            return;
        }

        apiInstance.get(`course/presentation-preview/?file_url=${encodeURIComponent(fileUrl)}`)
            .then((res) => {
                if (isMounted) {
                    if (res.data?.success) {
                        setPresentation(res.data);
                        if (typeof onPresentationLoaded === 'function') {
                            onPresentationLoaded(res.data);
                        }
                    } else {
                        setError(res.data?.error || "Gagal memproses berkas paparan.");
                    }
                }
            })
            .catch((err) => {
                console.error("PptxRenderer load error:", err);
                if (isMounted) {
                    setError("Gagal memuat pratinjau slide paparan.");
                }
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [fileUrl]);

    // Handle Fullscreen Toggle
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

    // Handle Keyboard Arrows for Next/Prev Slide
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!presentation?.slides?.length) return;
            if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
                setCurrentSlideIndex((prev) => Math.min(presentation.slides.length - 1, prev + 1));
            } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
                setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [presentation]);

    if (loading) {
        return (
            <div className="pptx-canvas-loading d-flex flex-column align-items-center justify-content-center p-4 bg-white rounded border text-secondary shadow-xs" style={{ height }}>
                <div className="spinner-border text-teal mb-2" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
                <span className="small fw-semibold text-dark">Membuka Berkas Paparan (PPTX)...</span>
                <span className="text-muted mt-1" style={{ fontSize: "0.72rem" }}>Merender layout grafis slide asli</span>
            </div>
        );
    }

    if (error || !presentation?.slides?.length) {
        return (
            <div className="p-3 text-center bg-white rounded border shadow-xs" style={{ minHeight: "160px" }}>
                <i className="fas fa-exclamation-circle text-warning fa-2x mb-2"></i>
                <div className="small fw-bold text-dark">{error || "Tidak ada slide yang ditemukan dalam berkas ini."}</div>
                <div className="mt-2">
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-outline-primary px-3 py-1" style={{ fontSize: "0.75rem" }}>
                        <i className="fas fa-download me-1"></i>Unduh Berkas PPTX
                    </a>
                </div>
            </div>
        );
    }

    const slides = presentation.slides;
    const currentSlide = slides[currentSlideIndex] || slides[0];
    const totalSlides = slides.length;

    /**
     * Render single visual shape on slide canvas with proportional percent layout
     */
    const renderVisualShape = (shape, sIdx) => {
        const isRounded = shape.type === "rounded-rectangle";
        const hasBorder = Boolean(shape.border);
        const hasFill = Boolean(shape.fill);

        const shapeStyle = {
            position: "absolute",
            left: `${shape.left}%`,
            top: `${shape.top}%`,
            width: `${shape.width}%`,
            height: `${shape.height}%`,
            backgroundColor: shape.fill || "transparent",
            border: hasBorder ? `1.5px solid ${shape.border}` : "none",
            borderRadius: isRounded ? "10px" : "0px",
            boxSizing: "border-box",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: shape.name?.toLowerCase().includes("top") || shape.top === 0 ? "center" : "flex-start",
            padding: shape.paragraphs?.length ? "1.5% 2%" : "0",
            pointerEvents: "auto",
            zIndex: hasFill ? 1 : 2
        };

        return (
            <div key={sIdx} className="pptx-slide-shape" style={shapeStyle}>
                {/* Paragraphs and Text Runs */}
                {shape.paragraphs && shape.paragraphs.map((p, pIdx) => {
                    return (
                        <div
                            key={pIdx}
                            className="pptx-shape-paragraph"
                            style={{
                                textAlign: p.align || "left",
                                lineHeight: "1.3",
                                marginBottom: "0.8%",
                                width: "100%",
                                wordBreak: "break-word"
                            }}
                        >
                            {p.runs.map((r, rIdx) => {
                                const fontSize = r.size ? `${Math.max(10, r.size * 0.72)}px` : "13px";
                                return (
                                    <span
                                        key={rIdx}
                                        style={{
                                            color: r.color || (shape.fill && shape.fill.toLowerCase() === "#0f2043" ? "#FFFFFF" : "#1E293B"),
                                            fontSize,
                                            fontWeight: r.bold ? "700" : "400",
                                            fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif"
                                        }}
                                    >
                                        {r.text}
                                    </span>
                                );
                            })}
                        </div>
                    );
                })}

                {/* Table Data if shape has a table */}
                {shape.table && (
                    <table className="table table-sm table-bordered mb-0" style={{ fontSize: "11px", backgroundColor: "#fff" }}>
                        <tbody>
                            {shape.table.map((row, rIdx) => (
                                <tr key={rIdx} className={rIdx === 0 ? "table-light fw-bold" : ""}>
                                    {row.map((cell, cIdx) => (
                                        <td key={cIdx} className="p-1">{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        );
    };

    return (
        <div
            ref={containerRef}
            className={`pptx-viewer-player position-relative rounded overflow-hidden shadow-xs d-flex flex-column bg-white border ${isFullscreen ? 'fullscreen-mode' : ''}`}
            style={{
                height: isFullscreen ? "100vh" : height,
                width: "100%",
                fontFamily: "system-ui, -apple-system, sans-serif"
            }}
        >
            {/* Top Toolbar (Bright Mode) */}
            {showToolbar && (
                <div className="pptx-toolbar d-flex align-items-center justify-content-between px-3 py-2 bg-white text-dark border-bottom shadow-2xs">
                    <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-warning text-dark fw-bold px-2 py-1 shadow-2xs" style={{ fontSize: "0.7rem" }}>
                            <i className="fas fa-file-powerpoint me-1"></i>PPTX
                        </span>
                        <span className="small text-truncate fw-bold text-dark" style={{ maxWidth: "260px", fontSize: "0.78rem" }} title={presentation.file_name}>
                            {presentation.file_name}
                        </span>
                    </div>

                    {/* Navigation Controls */}
                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0 px-2 border d-inline-flex align-items-center justify-content-center"
                            style={{ fontSize: "0.74rem", height: "24px", lineHeight: "1" }}
                            disabled={currentSlideIndex === 0}
                            onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                            title="Slide Sebelumnya (◄)"
                        >
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <span className="small text-dark fw-bold px-1" style={{ fontSize: "0.76rem", minWidth: "75px", textAlign: "center" }}>
                            Slide {currentSlideIndex + 1} / {totalSlides}
                        </span>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0 px-2 border d-inline-flex align-items-center justify-content-center"
                            style={{ fontSize: "0.74rem", height: "24px", lineHeight: "1" }}
                            disabled={currentSlideIndex >= totalSlides - 1}
                            onClick={() => setCurrentSlideIndex((prev) => Math.min(totalSlides - 1, prev + 1))}
                            title="Slide Selanjutnya (►)"
                        >
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>

                    {/* Secondary Actions */}
                    <div className="d-flex align-items-center gap-1">
                        <button
                            type="button"
                            className={`btn btn-sm py-0 px-2 border d-inline-flex align-items-center justify-content-center ${sidebarOpen ? 'btn-teal text-white' : 'btn-outline-secondary'}`}
                            style={{ fontSize: "0.72rem", height: "24px", lineHeight: "1" }}
                            onClick={() => setSidebarOpen((prev) => !prev)}
                            title="Tampilkan / Sembunyikan Panel Thumbnail"
                        >
                            <i className="fas fa-th-large me-1"></i>Slide
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary py-0 px-2 border d-inline-flex align-items-center justify-content-center"
                            style={{ fontSize: "0.72rem", height: "24px", lineHeight: "1" }}
                            onClick={toggleFullscreen}
                            title="Layar Penuh"
                        >
                            <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                        </button>
                        <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-primary py-0 px-2 d-inline-flex align-items-center justify-content-center"
                            style={{ fontSize: "0.72rem", height: "24px", lineHeight: "1" }}
                            title="Unduh Berkas PPTX"
                        >
                            <i className="fas fa-download me-1"></i>Unduh
                        </a>
                    </div>
                </div>
            )}

            {/* Main Stage: Sidebar + Active Slide Canvas (Bright Mode) */}
            <div className="pptx-stage-body d-flex flex-grow-1 overflow-hidden position-relative bg-light">
                {/* Thumbnails Sidebar */}
                {sidebarOpen && (
                    <div
                        className="pptx-thumbnails-sidebar bg-white border-end p-2 overflow-auto shadow-2xs"
                        style={{ width: "135px", minWidth: "135px", maxHeight: "100%" }}
                    >
                        {slides.map((s, idx) => (
                            <div
                                key={idx}
                                className={`pptx-thumbnail-item p-1 mb-2 rounded cursor-pointer transition ${currentSlideIndex === idx ? 'border border-primary bg-primary-subtle shadow-2xs' : 'bg-light border'}`}
                                style={{ cursor: "pointer" }}
                                onClick={() => setCurrentSlideIndex(idx)}
                            >
                                <div className="d-flex justify-content-between align-items-center px-1 mb-1">
                                    <span className={`badge ${currentSlideIndex === idx ? 'bg-primary text-white' : 'bg-secondary text-white'}`} style={{ fontSize: "0.6rem" }}>
                                        #{idx + 1}
                                    </span>
                                </div>
                                <div
                                    className="pptx-mini-slide-preview rounded overflow-hidden d-flex align-items-center justify-content-center text-center p-1 border shadow-2xs"
                                    style={{
                                        aspectRatio: "16/9",
                                        backgroundColor: idx === 0 && presentation.thumbnail ? "#fff" : (s.shapes?.find(sh => sh.fill)?.fill || "#0f2043"),
                                        color: "#fff",
                                        fontSize: "0.6rem",
                                        lineHeight: "1.1"
                                    }}
                                >
                                    {idx === 0 && presentation.thumbnail ? (
                                        <img src={presentation.thumbnail} alt={`Slide ${idx + 1}`} className="w-100 h-100 object-fit-contain" />
                                    ) : (
                                        <span className="text-truncate px-1 fw-bold">{s.title || `Slide ${idx + 1}`}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Main Slide Canvas Container (Bright Light Background) */}
                <div className="pptx-canvas-stage flex-grow-1 d-flex align-items-center justify-content-center p-2 p-md-3 overflow-hidden bg-light position-relative">
                    {/* The 16:9 Presentation Slide Canvas */}
                    <div
                        className="pptx-slide-canvas position-relative shadow-sm rounded border"
                        style={{
                            width: "100%",
                            maxWidth: isFullscreen ? "92vw" : "100%",
                            maxHeight: isFullscreen ? "88vh" : "100%",
                            aspectRatio: "16 / 9",
                            backgroundColor: currentSlide.bg_color || (currentSlide.slide_number === 1 ? "#0F2043" : "#FFFFFF"),
                            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                            overflow: "hidden"
                        }}
                    >
                        {/* Cover Image Slide 1 fallback if thumbnail is available */}
                        {currentSlideIndex === 0 && presentation.thumbnail && (!currentSlide.shapes || currentSlide.shapes.length <= 1) ? (
                            <img
                                src={presentation.thumbnail}
                                alt="Slide Cover"
                                className="w-100 h-100"
                                style={{ objectFit: "contain", backgroundColor: "#0F2043" }}
                            />
                        ) : (
                            /* Render All Visual Shapes */
                            currentSlide.shapes && currentSlide.shapes.map((shape, shIdx) => renderVisualShape(shape, shIdx))
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Status Bar (Bright Mode) */}
            <div className="pptx-bottom-bar d-flex justify-content-between align-items-center px-3 py-1 bg-white text-secondary border-top" style={{ fontSize: "0.68rem" }}>
                <span>
                    <i className="fas fa-check-circle text-success me-1"></i>PPTX Slide Viewer (Bright Mode)
                </span>
                <span>
                    Navigasi slide via tombol ◄ ► atau klik thumbnail
                </span>
            </div>
        </div>
    );
};

export default PptxRenderer;
