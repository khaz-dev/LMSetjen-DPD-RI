import React, { useState, useEffect, useCallback } from "react";
import { moment } from "../../utils/dayjs";
import useAxios from "../../utils/useAxios";
import UserData from "../../views/plugin/UserData";
import Toast from "../../views/plugin/Toast";

// Helper normalisasi warna agar selalu menghasilkan hex color CSS yang valid
const normalizeNoteColor = (color) => {
    if (!color || typeof color !== 'string') return '#0d9488';
    const c = color.trim().toLowerCase();
    const map = {
        'emerald': '#059669',
        'teal': '#0d9488',
        'teal-deep': '#0f766e',
        'green': '#10b981',
        'orange': '#f39c12',
        'red': '#ef4444',
        'blue': '#3b82f6',
        'purple': '#8b5cf6',
        'yellow': '#f59e0b',
        'gray': '#64748b'
    };
    if (map[c]) return map[c];
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return c;
    return '#0d9488';
};

// Smart Formatted Content Renderer: Mengonversi Markdown Manta AI / Catatan menjadi kartu terstruktur & rapi
const renderFormattedNoteContent = (rawText, noteColor, isManta) => {
    if (!rawText) {
        return <p className="floating-note-paragraph text-muted fst-italic">Catatan tidak memiliki isi teks.</p>;
    }

    const lines = rawText.split('\n');
    const elements = [];
    let keyIdx = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Judul Utama Markdown #
        if (line.startsWith('# ')) {
            const headingText = line.replace(/^#\s+/, '');
            elements.push(
                <div key={keyIdx++} className="floating-note-main-heading">
                    <i className="fas fa-bookmark me-2" style={{ color: noteColor }}></i>
                    <span>{headingText}</span>
                </div>
            );
            continue;
        }

        // Sub-judul Markdown ##
        if (line.startsWith('## ')) {
            const sectionText = line.replace(/^##\s+/, '');
            elements.push(
                <div key={keyIdx++} className="floating-note-section-heading">
                    <span>{sectionText}</span>
                </div>
            );
            continue;
        }

        // Baris Metadata Pelatihan & Waktu
        if (line.startsWith('Pelatihan:') || line.startsWith('Waktu Rangkuman:')) {
            const [label, ...rest] = line.split(':');
            elements.push(
                <div key={keyIdx++} className="floating-note-meta-line">
                    <strong>{label}:</strong> {rest.join(':').trim()}
                </div>
            );
            continue;
        }

        // Garis Pembatas ---
        if (line === '---') {
            elements.push(<hr key={keyIdx++} className="floating-note-divider" />);
            continue;
        }

        // Footer Rangkuman Otomatis Manta AI
        if (line.includes('Catatan ini dirangkum secara otomatis oleh Manta AI') || line.includes('Manta AI - Asisten Virtual')) {
            elements.push(
                <div key={keyIdx++} className="floating-note-footer-signature">
                    <i className="fas fa-wand-magic-sparkles text-emerald me-1"></i>
                    <span>Catatan dirangkum secara otomatis oleh <strong>Manta AI</strong> - Asisten Virtual LMS Setjen DPD RI</span>
                </div>
            );
            continue;
        }

        // Butir bernomor: 1. Judul: Deskripsi
        const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
            const num = numMatch[1];
            const content = numMatch[2];
            const colonPos = content.indexOf(':');
            let itemTitle = '';
            let itemDesc = content;
            if (colonPos !== -1) {
                itemTitle = content.slice(0, colonPos).trim();
                itemDesc = content.slice(colonPos + 1).trim();
            }

            elements.push(
                <div key={keyIdx++} className="floating-note-takeaway-item">
                    <div className="d-flex align-items-start gap-2">
                        <span className="floating-note-takeaway-badge" style={{ backgroundColor: noteColor }}>
                            {num}
                        </span>
                        <div style={{ flex: 1 }}>
                            {itemTitle && <strong className="floating-note-item-title">{itemTitle}: </strong>}
                            <span className="floating-note-item-desc">{itemDesc}</span>
                        </div>
                    </div>
                </div>
            );
            continue;
        }

        // Butir checklist / peluru: • or - or *
        const bulletMatch = line.match(/^[•\-\*]\s+(.*)$/);
        if (bulletMatch) {
            const bulletContent = bulletMatch[1];
            elements.push(
                <div key={keyIdx++} className="floating-note-action-item">
                    <i className="fas fa-check-circle floating-note-action-icon" style={{ color: noteColor }}></i>
                    <span>{bulletContent}</span>
                </div>
            );
            continue;
        }

        // Teks Paragraf Normal
        elements.push(
            <p key={keyIdx++} className="floating-note-paragraph">
                {line}
            </p>
        );
    }

    return elements;
};

/**
 * ✨ PHASE 11.230: Executive Floating Note Card Component
 * Desain compact, modern, warna khas Manta AI, draggable & resizable.
 */
export const FloatingNoteCard = React.memo(({ item, idx, openNotes, setOpenNotes, param, enrollmentId, fetchCourseDetail }) => {
    const rawColor = item.note.color;
    const isManta = Boolean(
        item.note.note_id?.startsWith('manta_') ||
        (item.note.title && item.note.title.toLowerCase().includes('manta')) ||
        (item.note.note && item.note.note.includes('Manta AI'))
    );
    
    // Normalisasi warna, default Manta AI ke #0d9488
    const noteColor = normalizeNoteColor(rawColor || (isManta ? '#0d9488' : '#f39c12'));
    const headerGradient = isManta
        ? 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)'
        : `linear-gradient(135deg, ${noteColor} 0%, ${noteColor}dd 100%)`;

    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    
    // Default ukuran & posisi awal (mirip modal-dialog modal-lg, proporsional di tengah layar)
    const defaultWidth = typeof window !== 'undefined' ? Math.min(620, window.innerWidth - 40) : 620;
    const defaultHeight = typeof window !== 'undefined' ? Math.min(540, window.innerHeight - 80) : 540;
    const initialX = typeof window !== 'undefined' ? Math.max(20, Math.round((window.innerWidth - defaultWidth) / 2) + idx * 25) : 100;
    const initialY = typeof window !== 'undefined' ? Math.max(50, Math.round((window.innerHeight - defaultHeight) / 2) + idx * 25) : 80;
    const [position, setPosition] = useState({ x: initialX, y: initialY });
    const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
    const [isResizing, setIsResizing] = useState(false);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });

    const [copied, setCopied] = useState(false);
    const [speaking, setSpeaking] = useState(false);

    const handleMouseDown = (e) => {
        if (e.target.closest('.floating-note-btn') || e.target.closest('input') || e.target.closest('button')) {
            return;
        }
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e) => {
            const nextX = Math.max(10, Math.min(window.innerWidth - size.width - 10, e.clientX - dragOffset.x));
            const nextY = Math.max(10, Math.min(window.innerHeight - size.height - 10, e.clientY - dragOffset.y));
            setPosition({ x: nextX, y: nextY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset, size.width, size.height]);

    const handleEditToggle = (e) => {
        e.stopPropagation();
        const newOpenNotes = [...openNotes];
        newOpenNotes[idx].isEditing = !newOpenNotes[idx].isEditing;

        if (!newOpenNotes[idx].isEditing && item.note.id) {
            // Simpan catatan
            const formdata = new FormData();
            formdata.append("title", newOpenNotes[idx].editData.title);
            formdata.append("note", newOpenNotes[idx].editData.note);
            formdata.append("color", noteColor);
            if (newOpenNotes[idx].editData.variant_id) {
                formdata.append("variant_id", newOpenNotes[idx].editData.variant_id);
            }
            if (newOpenNotes[idx].editData.variant_item_id) {
                formdata.append("variant_item_id", newOpenNotes[idx].editData.variant_item_id);
            }
            useAxios.put(`student/course-note-detail/${UserData()?.user_id}/${enrollmentId}/${item.note.id}/`, formdata).then(() => {
                fetchCourseDetail();
                Toast().fire({ icon: "success", title: "Catatan berhasil diperbarui" });
            }).catch(() => {
                Toast().fire({ icon: "error", title: "Gagal memperbarui catatan" });
            });
        }
        setOpenNotes(newOpenNotes);
    };

    const handleClose = (e) => {
        e.stopPropagation();
        if (speaking && typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        setOpenNotes(openNotes.filter((_, i) => i !== idx));
    };

    const handleTitleChange = (e) => {
        const newOpenNotes = [...openNotes];
        newOpenNotes[idx].editData.title = e.target.value;
        setOpenNotes(newOpenNotes);
    };

    const handleNoteChange = (e) => {
        const newOpenNotes = [...openNotes];
        newOpenNotes[idx].editData.note = e.target.value;
        setOpenNotes(newOpenNotes);
    };

    const handleCopy = () => {
        const textToCopy = item.isEditing ? item.editData.note : item.note.note;
        if (!textToCopy) return;
        try {
            navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            Toast().fire({ icon: "success", title: "Isi catatan berhasil disalin!" });
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.warn("Copy error:", err);
        }
    };

    const handleSpeak = () => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        if (speaking) {
            window.speechSynthesis.cancel();
            setSpeaking(false);
            return;
        }
        const textToRead = item.note.note || '';
        const cleanText = textToRead
            .replace(/^#+\s+/gm, '')
            .replace(/^---$/gm, '')
            .replace(/\*\*/g, '')
            .replace(/^[•\-\*]\s+/gm, '')
            .trim();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'id-ID';
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
        setSpeaking(true);
    };

    const handleResizeStart = (e) => {
        e.preventDefault();
        setIsResizing(true);
        setResizeStart({ x: e.clientX, y: e.clientY });
    };

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e) => {
            setSize(prev => ({
                width: Math.max(340, Math.min(window.innerWidth - position.x - 20, prev.width + e.clientX - resizeStart.x)),
                height: Math.max(300, Math.min(window.innerHeight - position.y - 20, prev.height + e.clientY - resizeStart.y))
            }));
            setResizeStart({ x: e.clientX, y: e.clientY });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, resizeStart, position.x, position.y]);

    return (
        <div
            key={item.note.id}
            className="floating-note-dialog"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                border: `1.5px solid ${noteColor}66`,
                zIndex: 1040 + idx
            }}
        >
            {/* 1. Header Compact Bergradasi dengan Icon & Action Buttons */}
            <div
                className="floating-note-header"
                onMouseDown={handleMouseDown}
                style={{
                    background: headerGradient,
                    cursor: isDragging ? 'grabbing' : 'grab'
                }}
            >
                <div className="floating-note-header-left">
                    <div className="floating-note-icon-badge">
                        <i className={isManta ? "fas fa-wand-magic-sparkles" : "fas fa-sticky-note"}></i>
                    </div>
                    <div className="floating-note-title-wrap">
                        {item.isEditing ? (
                            <input
                                type="text"
                                className="floating-note-edit-input"
                                value={item.editData.title}
                                onChange={handleTitleChange}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                placeholder="Judul Catatan..."
                            />
                        ) : (
                            <span className="floating-note-title-text" title={item.note.title}>
                                {item.note.title || "Catatan Pembelajaran"}
                            </span>
                        )}
                        {isManta && (
                            <span className="floating-note-manta-tag">
                                ✨ Manta AI
                            </span>
                        )}
                    </div>
                </div>

                <div className="floating-note-header-actions">
                    <button
                        type="button"
                        className="floating-note-btn"
                        onClick={handleEditToggle}
                        title={item.isEditing ? "Simpan Perubahan" : "Edit Catatan"}
                    >
                        <i className={item.isEditing ? "fas fa-check text-warning" : "fas fa-pen"}></i>
                    </button>
                    <button
                        type="button"
                        className="floating-note-btn close"
                        onClick={handleClose}
                        title="Tutup Dialog"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            </div>

            {/* 2. Body Scrollable dengan Tipografi & Formatting Rapi */}
            <div className="floating-note-body">
                {/* Meta bar: Waktu & Tanggal Simpan */}
                <div className="floating-note-meta-bar">
                    <span>
                        <i className="fas fa-calendar-alt me-1 text-teal"></i>
                        {moment(item.note.date || item.note.created_at).format("DD MMM YYYY, HH:mm [WIB]")}
                    </span>
                    <span className="badge" style={{ backgroundColor: `${noteColor}22`, color: noteColor, border: `1px solid ${noteColor}55`, fontSize: '10px' }}>
                        {isManta ? "Rangkuman Instan" : "Catatan Mandiri"}
                    </span>
                </div>

                {/* Konteks Modul / Pelajaran */}
                {item.note.variant && (
                    <div
                        className="floating-note-context-pill"
                        style={{ borderLeftColor: noteColor }}
                    >
                        <i className="fas fa-layer-group" style={{ color: noteColor }}></i>
                        <span>
                            {item.note.variant.title}
                            {item.note.variant_item && ` › ${item.note.variant_item.title}`}
                        </span>
                    </div>
                )}

                {/* Konten Catatan: Tampilan Terstruktur atau Textarea Edit */}
                {item.isEditing ? (
                    <textarea
                        className="floating-note-edit-textarea"
                        value={item.editData.note}
                        onChange={handleNoteChange}
                        onClick={(e) => e.stopPropagation()}
                        style={{ height: `${Math.max(180, size.height - 220)}px` }}
                        placeholder="Tuliskan isi catatan Anda di sini..."
                    />
                ) : (
                    <div className="floating-note-content-container">
                        {renderFormattedNoteContent(item.note.note, noteColor, isManta)}
                    </div>
                )}
            </div>

            {/* 3. Bottom Bar dengan Aksi Salin, TTS, & ID Catatan */}
            <div className="floating-note-bottom-bar">
                <div className="floating-note-bottom-left">
                    <button
                        type="button"
                        className="floating-note-copy-btn"
                        onClick={handleCopy}
                        title="Salin isi teks rangkuman ke clipboard"
                    >
                        <i className={copied ? "fas fa-check text-success" : "fas fa-copy text-teal"}></i>
                        <span>{copied ? "Tersalin!" : "Salin Catatan"}</span>
                    </button>
                    <button
                        type="button"
                        className="floating-note-copy-btn"
                        onClick={handleSpeak}
                        title="Dengarkan pembacaan suara rangkuman"
                    >
                        <i className={speaking ? "fas fa-stop text-danger" : "fas fa-volume-high text-teal"}></i>
                        <span>{speaking ? "Berhenti" : "Dengarkan"}</span>
                    </button>
                </div>
                <div className="floating-note-bottom-right">
                    <span className="floating-note-id-badge">
                        {item.note.note_id ? `ID: ${item.note.note_id}` : 'Catatan LMS DPD RI'}
                    </span>
                </div>
            </div>

            {/* ✨ Corner Triangle Resize Handle (Sesuai dialog modal-lg / compact-executive-modal) */}
            <div
                className="floating-note-resize-handle"
                onMouseDown={handleResizeStart}
                title="Tahan dan geser untuk mengubah ukuran dialog"
            />
        </div>
    );
});

FloatingNoteCard.displayName = 'FloatingNoteCard';

// Container untuk merender seluruh Floating Note Cards aktif
export const FloatingNoteCardsContainer = React.memo(({ openNotes, setOpenNotes, param, fetchCourseDetail }) => {
    return (
        <div style={{ position: 'fixed', pointerEvents: 'none', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}>
            {openNotes.map((item, idx) => (
                <FloatingNoteCard
                    key={item.note.id || idx}
                    item={item}
                    idx={idx}
                    openNotes={openNotes}
                    setOpenNotes={setOpenNotes}
                    param={param}
                    enrollmentId={param?.enrollment_id}
                    fetchCourseDetail={fetchCourseDetail}
                />
            ))}
        </div>
    );
});

FloatingNoteCardsContainer.displayName = 'FloatingNoteCardsContainer';

export default FloatingNoteCardsContainer;
