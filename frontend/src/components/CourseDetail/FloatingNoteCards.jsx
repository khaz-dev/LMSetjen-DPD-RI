import React, { useState, useEffect } from "react";
import { moment } from "../../utils/dayjs";
import useAxios from "../../utils/useAxios";
import UserData from "../../views/plugin/UserData";
import Toast from "../../views/plugin/Toast";

// ✨ PHASE 11.164: Extracted floating note card component - fixes React hooks violation
export const FloatingNoteCard = React.memo(({ item, idx, openNotes, setOpenNotes, param, enrollmentId, fetchCourseDetail }) => {
    const noteColor = item.note.color || '#f39c12';
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [position, setPosition] = useState(item.position);

    const handleMouseDown = (e) => {
        if (e.target.closest('.note-detail-close-btn') || e.target.closest('.note-detail-edit-toggle')) {
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
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
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
    }, [isDragging, dragOffset]);

    const handleEditToggle = (e) => {
        e.stopPropagation();
        const newOpenNotes = [...openNotes];
        newOpenNotes[idx].isEditing = !newOpenNotes[idx].isEditing;

        if (!newOpenNotes[idx].isEditing && item.note.id) {
            // Save the note
            const formdata = new FormData();
            formdata.append("title", newOpenNotes[idx].editData.title);
            formdata.append("note", newOpenNotes[idx].editData.note);
            formdata.append("color", newOpenNotes[idx].editData.color);
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

    // ✨ Resize state
    const [size, setSize] = useState({ width: 380, height: 400 });
    const [isResizing, setIsResizing] = useState(false);
    const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });

    const handleResizeStart = (e) => {
        e.preventDefault();
        setIsResizing(true);
        setResizeStart({ x: e.clientX, y: e.clientY });
    };

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e) => {
            setSize(prev => ({
                width: Math.max(300, prev.width + e.clientX - resizeStart.x),
                height: Math.max(250, prev.height + e.clientY - resizeStart.y)
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
    }, [isResizing, resizeStart]);

    return (
        <div
            key={item.note.id}
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                backgroundColor: '#ffffff',
                border: `2px solid ${noteColor}`,
                borderRadius: '12px',
                boxShadow: `0 10px 40px rgba(0, 0, 0, 0.2)`,
                zIndex: 1040 + idx,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}
        >
            {/* Header - Draggable */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    background: `linear-gradient(135deg, ${noteColor} 0%, ${noteColor}dd 100%)`,
                    color: 'white',
                    padding: '1rem 1.5rem',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderRadius: '10px 10px 0 0'
                }}
            >
                <div style={{ flex: 1 }}>
                    {item.isEditing ? (
                        <input
                            type="text"
                            value={item.editData.title}
                            onChange={handleTitleChange}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                border: '1px solid rgba(255, 255, 255, 0.4)',
                                color: 'white',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '4px',
                                width: '100%',
                                fontWeight: '600',
                                fontSize: '1rem'
                            }}
                            placeholder="Judul Catatan"
                        />
                    ) : (
                        <>
                            <i className="fas fa-sticky-note me-2"></i>
                            {item.note.title}
                        </>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                    <button
                        className="note-detail-edit-toggle"
                        onClick={handleEditToggle}
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                        title={item.isEditing ? "Save" : "Edit"}
                    >
                        <i className={item.isEditing ? "fas fa-save" : "fas fa-edit"}></i>
                    </button>
                    <button
                        className="note-detail-close-btn"
                        onClick={handleClose}
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            border: 'none',
                            color: 'white',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                        title="Close"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            </div>

            {/* Body - Scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: '#f8f9fa' }}>
                {/* Date and lesson context */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <small style={{ color: '#666' }}>
                        <i className="fas fa-calendar-alt me-2"></i>
                        {moment(item.note.date || item.note.created_at).format("dddd, MMMM DD, YYYY [at] HH:mm")}
                    </small>
                </div>

                {/* Lesson context badge */}
                {item.note.variant && (
                    <div style={{
                        backgroundColor: '#e8f4f8',
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '1.5rem',
                        borderLeft: `4px solid ${noteColor}`
                    }}>
                        <small style={{ color: '#2c3e50', fontWeight: 600 }}>
                            <i className="fas fa-layer-group me-2" style={{ color: noteColor }}></i>
                            <strong>{item.note.variant.title}</strong>
                            {item.note.variant_item && (
                                <>
                                    {' > '}
                                    <strong>{item.note.variant_item.title}</strong>
                                </>
                            )}
                        </small>
                    </div>
                )}

                {/* Note content - inline editable */}
                {item.isEditing ? (
                    <textarea
                        value={item.editData.note}
                        onChange={handleNoteChange}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            height: '150px',
                            padding: '1rem',
                            border: `1px solid ${noteColor}`,
                            borderRadius: '8px',
                            fontFamily: 'inherit',
                            fontSize: '1rem',
                            resize: 'none'
                        }}
                    />
                ) : (
                    <div style={{
                        backgroundColor: '#ffffff',
                        padding: '1.5rem',
                        borderRadius: '8px',
                        lineHeight: '1.8',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        fontSize: '1rem',
                        color: '#333',
                        border: `1px solid ${noteColor}33`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                    }}>
                        {item.note.note}
                    </div>
                )}
            </div>

            {/* ✨ PHASE 11.165: Resize Handle - bottom right corner */}
            <div
                onMouseDown={handleResizeStart}
                style={{
                    position: 'absolute',
                    bottom: '0px',
                    right: '0px',
                    width: '20px',
                    height: '20px',
                    cursor: 'nwse-resize',
                    backgroundColor: 'rgba(0,0,0,0.1)',
                    borderRadius: '0 0 8px 0',
                    transition: 'background-color 0.2s',
                    zIndex: 1050
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.2)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.1)'}
                title="Drag to resize"
            />
        </div>
    );
});

FloatingNoteCard.displayName = 'FloatingNoteCard';

// ✨ PHASE 11.164: Container for multiple floating note cards
export const FloatingNoteCardsContainer = React.memo(({ openNotes, setOpenNotes, param, fetchCourseDetail }) => {
    return (
        <div style={{ position: 'fixed', pointerEvents: 'none', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1040 }}>
            {openNotes.map((item, idx) => (
                <FloatingNoteCard
                    key={item.note.id}
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

