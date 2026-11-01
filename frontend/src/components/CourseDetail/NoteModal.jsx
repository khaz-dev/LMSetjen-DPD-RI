import React from "react";
import Modal from "react-bootstrap/Modal";

/**
 * NoteModal Component - Redesigned Executive DPD RI Edition
 * Compact, modern, and draggable/resizable modal for creating and editing course notes.
 */
const NoteModal = ({
    show,
    onHide,
    selectedNote,
    selectedNoteColor = "#f39c12",
    createNote,
    handleNoteChange,
    handleColorChange,
    currentNoteVariantContext,
    setCurrentNoteVariantContext,
    course,
    getColorVariations,
    handleSubmitCreateNote,
    handleSubmitEditNote,
}) => {
    const colorOptions = [
        { color: "#f39c12", name: "Orange" },
        { color: "#e74c3c", name: "Red" },
        { color: "#0f766e", name: "Teal Deep" },
        { color: "#0d9488", name: "Teal Primary" },
        { color: "#2ecc71", name: "Green" },
        { color: "#059669", name: "Emerald" },
        { color: "#f1c40f", name: "Yellow" },
        { color: "#e67e22", name: "Dark Orange" },
        { color: "#0284c7", name: "Sky Blue" },
        { color: "#34495e", name: "Navy Slate" },
        { color: "#e91e63", name: "Pink" },
        { color: "#64748b", name: "Cool Gray" }
    ];

    const defaultColorVariations = getColorVariations ? getColorVariations(selectedNoteColor) : {
        light: "rgba(243, 156, 18, 0.2)",
        hover: "rgba(243, 156, 18, 0.13)",
        shadow: "rgba(243, 156, 18, 0.3)"
    };

    return (
        <Modal
            show={show}
            onHide={onHide}
            size="lg"
            backdrop={false}
            keyboard={true}
            className="add-note-modal compact-executive-modal"
        >
            <form
                className="compact-modal-form"
                onSubmit={(e) => {
                    if (selectedNote) {
                        handleSubmitEditNote(e, selectedNote.id);
                    } else {
                        handleSubmitCreateNote(e);
                    }
                }}
            >
                {/* 1. Sleek Compact Draggable Header (52px height) */}
                <div
                    className="modal-header-note modal-header-dynamic note-modal-header-draggable compact-modal-header"
                    style={{
                        background: `linear-gradient(135deg, ${selectedNoteColor} 0%, ${selectedNoteColor}dd 100%)`,
                        cursor: 'grab'
                    }}
                >
                    <div className="compact-header-left d-flex align-items-center gap-2">
                        <div className="compact-header-icon-box">
                            <i className="fas fa-sticky-note"></i>
                        </div>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <h5 className="compact-modal-title mb-0">
                                {selectedNote ? "Edit Catatan Kursus" : "Tambah Catatan Kursus"}
                            </h5>
                            <span className="compact-header-drag-badge">
                                <i className="fas fa-arrows-alt me-1"></i>Bisa Digeser &amp; Diubah Ukuran
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn-close-modern compact-btn-close"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onHide();
                        }}
                        title="Tutup Modal"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* 2. Compact Body with 2-Column Meta & Maximized Content */}
                <div className="modal-body-modern compact-modal-body">
                    {/* Meta Row: Judul (col-7) & Bagian/Pelajaran (col-5) */}
                    <div className="row g-2 mb-2">
                        <div className="col-md-7 col-12">
                            <label className="compact-form-label">
                                <i className="fas fa-heading me-1 text-teal-accent"></i>
                                Judul Catatan <span className="text-danger">*</span>
                            </label>
                            <input
                                type="text"
                                name="title"
                                className="form-control compact-modal-input"
                                placeholder="Berikan judul catatan yang deskriptif..."
                                value={createNote.title}
                                onChange={handleNoteChange}
                                required
                            />
                        </div>
                        <div className="col-md-5 col-12">
                            <label className="compact-form-label">
                                <i className="fas fa-layer-group me-1 text-teal-accent"></i>
                                Bagian / Pelajaran <span className="text-muted fw-normal" style={{ fontSize: '0.72rem' }}>(Opsional)</span>
                            </label>
                            <select
                                className="form-select compact-modal-select"
                                value={currentNoteVariantContext?.variant_item_id || ''}
                                onChange={(e) => {
                                    const selected = e.target.value;
                                    if (selected) {
                                        let foundVariantItem = null;
                                        course?.curriculum?.forEach(variant => {
                                            (variant.variant_items || variant.items || []).forEach(item => {
                                                if (item.variant_item_id === selected) {
                                                    foundVariantItem = {
                                                        variant_item_id: item.variant_item_id,
                                                        title: item.title,
                                                        variant_id: variant.variant_id || variant.id,
                                                        variant_title: variant.title
                                                    };
                                                }
                                            });
                                        });
                                        setCurrentNoteVariantContext(foundVariantItem);
                                    } else {
                                        setCurrentNoteVariantContext(null);
                                    }
                                }}
                            >
                                <option value="">-- Semua Bagian (Umum) --</option>
                                {course?.curriculum?.map((variant) => (
                                    <optgroup key={variant.variant_id} label={variant.title}>
                                        {(variant.variant_items || variant.items || []).map((item) => (
                                            <option key={item.variant_item_id} value={item.variant_item_id}>
                                                {item.title}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Compact Color Palette Bar (Only 36px) */}
                    <div className="compact-color-bar d-flex align-items-center justify-content-between flex-wrap gap-2 py-1 px-2 mb-2 rounded border">
                        <div className="d-flex align-items-center gap-2">
                            <i className="fas fa-palette text-amber" style={{ fontSize: '0.82rem' }}></i>
                            <span className="compact-meta-label">Pilih Warna Catatan:</span>
                        </div>
                        <div className="d-flex align-items-center gap-1 flex-wrap">
                            {colorOptions.map((opt) => (
                                <button
                                    key={opt.color}
                                    type="button"
                                    className={`compact-color-swatch ${selectedNoteColor === opt.color ? "active" : ""}`}
                                    style={{ backgroundColor: opt.color }}
                                    onClick={() => {
                                        handleColorChange(opt.color);
                                        handleNoteChange({
                                            target: {
                                                name: "color",
                                                value: opt.color
                                            }
                                        });
                                    }}
                                    title={opt.name}
                                >
                                    {selectedNoteColor === opt.color && <i className="fas fa-check"></i>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Note Content Textarea */}
                    <div className="compact-content-group mb-2">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <label className="compact-form-label mb-0">
                                <i className="fas fa-edit me-1 text-teal-accent"></i>
                                Isi Catatan <span className="text-danger">*</span>
                            </label>
                            <span className="compact-char-counter">
                                {(createNote.note || "").length}/2000 karakter
                            </span>
                        </div>
                        <textarea
                            name="note"
                            className="form-control compact-modal-textarea"
                            rows="5"
                            placeholder="Tuliskan ringkasan wawasan penting, poin kunci, atau refleksi materi kursus..."
                            value={createNote.note}
                            onChange={handleNoteChange}
                            required
                        />
                    </div>

                    {/* Slim Tips Banner (1 line) */}
                    <div className="compact-modal-tip-banner d-flex align-items-center gap-2 px-3 py-1-5 rounded">
                        <i className="fas fa-lightbulb text-amber flex-shrink-0"></i>
                        <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                            <strong>Tips:</strong> Kelompokkan catatan per bab dan gunakan warna berbeda agar materi mudah ditemukan kembali saat belajar.
                        </span>
                    </div>
                </div>

                {/* 3. Sleek Compact Footer (50px height) */}
                <div className="modal-footer-modern compact-modal-footer">
                    <div className="d-flex align-items-center gap-2 ms-auto">
                        <button
                            type="button"
                            className="btn btn-sm compact-btn-cancel"
                            onClick={onHide}
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="btn btn-sm compact-btn-submit text-white"
                            disabled={!createNote.title?.trim() || !createNote.note?.trim()}
                            style={{
                                background: `linear-gradient(135deg, ${selectedNoteColor} 0%, ${selectedNoteColor}dd 100%)`,
                                boxShadow: `0 3px 10px ${defaultColorVariations.shadow}`
                            }}
                        >
                            <i className="fas fa-save me-1"></i>
                            {selectedNote ? "Perbarui Catatan" : "Simpan Catatan"}
                        </button>
                    </div>
                </div>
            </form>

            {/* Resize handle (Preserved for JavaScript resize listener) */}
            <div className="modal-resize-handle" title="Tahan dan geser untuk mengubah ukuran modal"></div>
        </Modal>
    );
};

export default React.memo(NoteModal);
