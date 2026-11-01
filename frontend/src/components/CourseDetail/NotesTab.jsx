import React from "react";
import { moment } from "../../utils/dayjs";

/**
 * NotesTab Component
 * Displays the user's personal notes for this course with search, filtering, and floating cards support.
 */
const NotesTab = ({
    course,
    handleNoteShow,
    noteFilters,
    setNoteFilters,
    filteredNotes,
    openNotes,
    setOpenNotes,
    getColorVariations,
    handleDeleteNote,
}) => {
    return (
        <div className="tab-pane fade show active" id="notes" role="tabpanel">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="mb-0">
                    <i className="fas fa-sticky-note text-amber me-2"></i>Catatan Saya
                </h4>
                <button
                    className="add-btn-modern"
                    onClick={() => handleNoteShow(null)}
                >
                    <i className="fas fa-plus"></i>
                    Tambah Catatan
                </button>
            </div>

            {/* Search and filter controls for notes */}
            <div className="mb-3 course-filters-row">
                {/* Search Input */}
                <div className="filter-col-search">
                    <label className="compact-filter-label">
                        <i className="fas fa-search me-1 text-teal-accent"></i>
                        Cari Catatan
                    </label>
                    <input
                        type="text"
                        className="form-control compact-filter-input"
                        placeholder="Cari berdasarkan judul atau isi..."
                        value={noteFilters.search}
                        onChange={(e) => setNoteFilters({ ...noteFilters, search: e.target.value })}
                    />
                </div>

                {/* Bagian Filter Dropdown */}
                <div className="filter-col-select">
                    <label className="compact-filter-label">
                        <i className="fas fa-layer-group me-1 text-teal-accent"></i>
                        Bagian
                    </label>
                    <select
                        className="form-select compact-filter-select"
                        value={noteFilters.bagian || ''}
                        onChange={(e) => setNoteFilters({ ...noteFilters, bagian: e.target.value || null, pelajaran: null })}
                    >
                        <option value="">Semua Bagian</option>
                        {course?.curriculum?.map((variant) => (
                            <option key={variant.variant_id} value={variant.variant_id}>
                                {variant.title}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Pelajaran Filter Dropdown */}
                <div className="filter-col-select">
                    <label className="compact-filter-label">
                        <i className="fas fa-book me-1 text-danger"></i>
                        Pelajaran
                    </label>
                    <select
                        className="form-select compact-filter-select"
                        value={noteFilters.pelajaran || ''}
                        onChange={(e) => setNoteFilters({ ...noteFilters, pelajaran: e.target.value || null })}
                        disabled={!noteFilters.bagian}
                    >
                        <option value="">Semua Pelajaran</option>
                        {noteFilters.bagian && course?.curriculum?.find(v => v.variant_id === noteFilters.bagian)?.variant_items?.map((item) => (
                            <option key={item.variant_item_id} value={item.variant_item_id}>
                                {item.title}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Color Filter Dropdown */}
                <div className="filter-col-color">
                    <label className="compact-filter-label">
                        <i className="fas fa-palette me-1 text-amber"></i>
                        Warna
                    </label>
                    <select
                        className="form-select compact-filter-select"
                        value={noteFilters.color || ''}
                        onChange={(e) => setNoteFilters({ ...noteFilters, color: e.target.value || null })}
                    >
                        <option value="">Semua Warna</option>
                        <option value="#f39c12">🟠 Orange</option>
                        <option value="#e74c3c">🔴 Red</option>
                        <option value="#0f766e">🔵 Blue</option>
                        <option value="#2ecc71">🟢 Green</option>
                        <option value="#0d9488">🟣 Teal (Primary)</option>
                        <option value="#f1c40f">🟡 Yellow</option>
                        <option value="#e67e22">🟠 Dark Orange</option>
                        <option value="#95a5a6">⚪ Gray</option>
                        <option value="#1abc9c">🔷 Teal</option>
                        <option value="#34495e">🔹 Dark Blue</option>
                        <option value="#e91e63">💗 Pink</option>
                        <option value="#115e59">🟣 Teal Dark</option>
                    </select>
                </div>

                {/* Clear Filters Button */}
                {(noteFilters.search || noteFilters.bagian || noteFilters.pelajaran || noteFilters.color) && (
                    <button
                        type="button"
                        onClick={() => setNoteFilters({ search: '', bagian: null, pelajaran: null, color: null })}
                        className="compact-clear-filter-btn"
                        title="Reset Filter Catatan"
                    >
                        <i className="fas fa-times me-1"></i>Reset
                    </button>
                )}
            </div>

            {/* 2-Column Grid Layout for Notes */}
            <div className="note-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', gridAutoRows: 'max-content' }}>
                {filteredNotes?.length > 0 ? (
                    filteredNotes.map((n, index) => {
                        const noteColor = n.color || "#f39c12";
                        const colorVariations = getColorVariations ? getColorVariations(noteColor) : {
                            light: "rgba(243, 156, 18, 0.2)",
                            hover: "rgba(243, 156, 18, 0.13)",
                            shadow: "rgba(243, 156, 18, 0.3)"
                        };

                        return (
                            <div
                                key={n.id || index}
                                className="note-card"
                                onClick={() => {
                                    const isAlreadyOpen = openNotes.some(item => item.note.id === n.id);
                                    if (!isAlreadyOpen) {
                                        setOpenNotes([...openNotes, {
                                            note: n,
                                            position: { x: openNotes.length * 30, y: 60 + openNotes.length * 30 },
                                            isEditing: false,
                                            editData: n
                                        }]);
                                    }
                                }}
                                style={{
                                    "--note-color": noteColor,
                                    "--note-color-light": colorVariations.light,
                                    "--note-color-hover": colorVariations.hover,
                                    borderColor: colorVariations.light,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <div className="note-header">
                                    <div className="note-header-content">
                                        <div
                                            className="note-icon-wrapper"
                                            style={{
                                                background: `linear-gradient(135deg, ${noteColor} 0%, ${noteColor}dd 100%)`,
                                                boxShadow: `0 4px 12px ${colorVariations.shadow}`
                                            }}
                                        >
                                            <i className="fas fa-sticky-note"></i>
                                        </div>
                                        <div className="note-content-info">
                                            <h5 className="note-title">{n.title}</h5>
                                            {(n.variant || n.variant_item) && (
                                                <div className="note-context">
                                                    <i className="fas fa-layer-group"></i>
                                                    {n.variant && <span>{n.variant.title}</span>}
                                                    {n.variant && n.variant_item && <span style={{ opacity: 0.6 }}>›</span>}
                                                    {n.variant_item && <span>{n.variant_item.title}</span>}
                                                </div>
                                            )}
                                            <div className="note-date">
                                                <i
                                                    className="fas fa-calendar-alt"
                                                    style={{ color: noteColor }}
                                                ></i>
                                                {moment(n.date).format("MMM DD, YYYY")}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="note-actions">
                                        <button
                                            className="btn-note-action edit"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleNoteShow(n);
                                            }}
                                            title="Edit catatan"
                                        >
                                            <i className="fas fa-edit"></i>
                                        </button>
                                        <button
                                            className="btn-note-action delete"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteNote(n.id);
                                            }}
                                            title="Hapus catatan"
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                                <p
                                    className="note-content-text"
                                    style={{
                                        background: `linear-gradient(135deg, ${colorVariations.hover} 0%, ${colorVariations.light} 100%)`,
                                        borderColor: colorVariations.light
                                    }}
                                >
                                    {n.note}
                                </p>
                            </div>
                        );
                    })
                ) : (
                    <div className="empty-state">
                        <i className="fas fa-sticky-note empty-icon"></i>
                        <h5>Belum ada catatan</h5>
                        <p>Mulai membuat catatan untuk mengingat poin penting</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotesTab;

