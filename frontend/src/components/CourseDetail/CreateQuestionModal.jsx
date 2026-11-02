import React, { useRef } from "react";
import Modal from "react-bootstrap/Modal";
import {
    formatTimestamp,
    QAFormattingToolbar,
    QAMarkdownRenderer,
} from "./QAMarkdownTools";
import { QAAttachmentInputPreview } from "./QAAttachmentTools";
import { validateQAFile, compressImageFile, formatFileSize } from "../../utils/qaCompression";
import Toast from "../../views/plugin/Toast";

/**
 * CreateQuestionModal Component - Redesigned Executive DPD RI Edition
 * Compact, modern, and draggable/resizable modal for creating course discussion threads.
 */
const CreateQuestionModal = ({
    show,
    onHide,
    onSubmit,
    createMessage,
    setCreateMessage,
    handleMessageChange,
    currentVariantContext,
    setCurrentVariantContext,
    course,
    attachedTimestamp,
    setAttachedTimestamp,
    getCurrentVideoTime,
    questionTextareaRef,
    questionPreviewMode,
    setQuestionPreviewMode,
    handleJumpToVideoTimestamp,
    questionAttachment = null,
    setQuestionAttachment,
    isCompressingAttachment = false,
    setIsCompressingAttachment,
}) => {
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validation = validateQAFile(file);
        if (!validation.valid) {
            Toast().fire({ icon: "error", title: validation.error });
            e.target.value = "";
            return;
        }

        try {
            if (setIsCompressingAttachment) setIsCompressingAttachment(true);
            const compressed = await compressImageFile(file);
            if (setQuestionAttachment) setQuestionAttachment(compressed);
        } catch (err) {
            console.error("Gagal mengompresi gambar:", err);
            if (setQuestionAttachment) setQuestionAttachment(file);
        } finally {
            if (setIsCompressingAttachment) setIsCompressingAttachment(false);
            e.target.value = "";
        }
    };

    const handlePasteImage = async (e) => {
        const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type && item.type.indexOf("image") === 0) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;

                const validation = validateQAFile(file);
                if (!validation.valid) {
                    Toast().fire({ icon: "error", title: validation.error });
                    return;
                }

                try {
                    if (setIsCompressingAttachment) setIsCompressingAttachment(true);
                    const compressed = await compressImageFile(file);
                    if (setQuestionAttachment) setQuestionAttachment(compressed);
                    Toast().fire({
                        icon: "success",
                        title: `Gambar berhasil dilampirkan (${formatFileSize(compressed.size)})`
                    });
                } catch (err) {
                    console.error("Paste image error:", err);
                } finally {
                    if (setIsCompressingAttachment) setIsCompressingAttachment(false);
                }
                break;
            }
        }
    };
    // Helper to determine if a lesson has video content
    const isVideoFile = (fileUrl) => {
        if (!fileUrl) return false;
        const cleanUrl = String(fileUrl).toLowerCase().split('?')[0];
        const ext = cleanUrl.split('.').pop();
        const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'];
        if (videoExtensions.includes(ext)) return true;
        if (cleanUrl.includes('drive.google.com')) return true;
        if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be') || cleanUrl.includes('youtube-nocookie.com')) return true;
        return false;
    };

    const isVideoContent = (item) => {
        if (!item) return false;
        const fileUrl = item.file || item.rawItem?.file || '';
        return isVideoFile(fileUrl);
    };

    // Find the currently selected lesson from course curriculum
    const selectedLessonItem = React.useMemo(() => {
        if (!currentVariantContext?.variant_item_id) return null;
        let found = null;
        course?.curriculum?.forEach((variant) => {
            (variant.variant_items || variant.items || []).forEach((item) => {
                if (item.variant_item_id === currentVariantContext.variant_item_id) {
                    found = item;
                }
            });
        });
        return found;
    }, [course, currentVariantContext]);

    // Check if video timestamp can be attached (must have selected a lesson AND it must be video)
    const isVideoLesson = Boolean(selectedLessonItem && isVideoContent(selectedLessonItem));
    const canAttachVideoTimestamp = Boolean(currentVariantContext?.variant_item_id && isVideoLesson);

    return (
        <Modal
            show={show}
            onHide={onHide}
            size="lg"
            backdrop={false}
            keyboard={true}
            className="create-question-modal compact-executive-modal"
        >
            <form className="compact-modal-form" onSubmit={onSubmit}>
                {/* 1. Sleek Compact Draggable Header (46px height) */}
                <div
                    className="modal-header-modern compact-modal-header"
                    style={{
                        background: 'linear-gradient(135deg, #042f2e 0%, #0d9488 100%)',
                        cursor: 'grab'
                    }}
                >
                    <div className="compact-header-left d-flex align-items-center gap-2">
                        <div className="compact-header-icon-box">
                            <i className="fas fa-question-circle"></i>
                        </div>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <h5 className="compact-modal-title mb-0">Ajukan Pertanyaan Kursus</h5>
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
                                Judul Pertanyaan <span className="text-danger">*</span>
                            </label>
                            <input
                                type="text"
                                name="title"
                                className="form-control compact-modal-input"
                                placeholder="Tulis judul pertanyaan yang jelas dan spesifik..."
                                value={createMessage.title}
                                onChange={handleMessageChange}
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
                                value={currentVariantContext?.variant_item_id || ''}
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
                                                        variant_id: variant.variant_id,
                                                        variant_title: variant.title,
                                                        file: item.file,
                                                        rawItem: item
                                                    };
                                                }
                                            });
                                        });
                                        setCurrentVariantContext(foundVariantItem);
                                        // If newly selected lesson is NOT video, automatically clear attached timestamp
                                        if (!isVideoContent(foundVariantItem)) {
                                            setAttachedTimestamp(null);
                                        }
                                    } else {
                                        // "-- Semua Bagian (Umum) --" selected
                                        setCurrentVariantContext(null);
                                        setAttachedTimestamp(null);
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

                    {/* Compact Video Timestamp Bar (Active only when lesson is video) */}
                    <div className={`compact-timestamp-bar ${!canAttachVideoTimestamp ? "disabled opacity-75 bg-light" : ""} d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-1 mb-2 rounded border`}>
                        <div className="d-flex align-items-center gap-2">
                            <i className={`fas ${canAttachVideoTimestamp ? "fa-stopwatch text-teal-accent" : "fa-video-slash text-muted"}`} style={{ fontSize: '0.85rem' }}></i>
                            <span className={`compact-meta-label ${!canAttachVideoTimestamp ? "text-muted" : ""}`}>Menit Video:</span>
                            {canAttachVideoTimestamp ? (
                                attachedTimestamp !== null ? (
                                    <span className="compact-timestamp-pill">
                                        <i className="fas fa-play me-1"></i>{formatTimestamp(attachedTimestamp)}
                                    </span>
                                ) : (
                                    <span className="text-muted" style={{ fontSize: '0.76rem' }}>
                                        (Opsional) Tautkan menit video terkait
                                    </span>
                                )
                            ) : (
                                <span className="text-muted" style={{ fontSize: '0.76rem', fontStyle: 'italic' }}>
                                    {!currentVariantContext?.variant_item_id
                                        ? "(Pilih pelajaran materi video untuk mengaktifkan tautan menit video)"
                                        : "(Pelajaran ini bukan dalam format video — penautan menit dinonaktifkan)"}
                                </span>
                            )}
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            {canAttachVideoTimestamp && attachedTimestamp !== null && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger compact-bar-btn"
                                    onClick={() => setAttachedTimestamp(null)}
                                    title="Hapus tautan video"
                                >
                                    <i className="fas fa-times me-1"></i>Hapus
                                </button>
                            )}
                            <button
                                type="button"
                                className={`btn btn-sm compact-bar-btn ${canAttachVideoTimestamp ? "btn-outline-teal" : "btn-light border text-muted disabled"}`}
                                disabled={!canAttachVideoTimestamp}
                                onClick={() => {
                                    if (!canAttachVideoTimestamp) return;
                                    const cur = Math.floor(getCurrentVideoTime ? getCurrentVideoTime() : 0);
                                    setAttachedTimestamp(cur);
                                }}
                                title={!canAttachVideoTimestamp ? (!currentVariantContext?.variant_item_id ? "Pilih pelajaran materi video terlebih dahulu" : "Pelajaran ini bukan format video") : "Sematkan menit pemutar"}
                            >
                                <i className="fas fa-clock me-1"></i>
                                {canAttachVideoTimestamp ? (
                                    `${attachedTimestamp !== null ? "Perbarui" : "Sematkan"} Waktu Pemutar (${formatTimestamp(Math.floor(getCurrentVideoTime ? getCurrentVideoTime() : 0))})`
                                ) : (
                                    "Sematkan Waktu Pemutar"
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Question Message with Formatting Toolbar */}
                    <div className="compact-content-group mb-2">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <label className="compact-form-label mb-0">
                                <i className="fas fa-edit me-1 text-teal-accent"></i>
                                Detail Pertanyaan <span className="text-danger">*</span>
                            </label>
                            <span className="compact-char-counter">
                                {(createMessage.message || "").length}/2000 karakter
                            </span>
                        </div>

                        {/* Hidden file input for question attachment */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: "none" }}
                            accept=".png,.jpg,.jpeg,.webp,.pdf,image/*"
                            onChange={handleFileChange}
                        />

                        {/* Formatting Toolbar - Timestamp button synced with canAttachVideoTimestamp */}
                        <QAFormattingToolbar
                            textareaRef={questionTextareaRef}
                            value={createMessage.message}
                            onChange={(newVal) => setCreateMessage(prev => ({ ...prev, message: newVal }))}
                            isPreview={questionPreviewMode}
                            onTogglePreview={setQuestionPreviewMode}
                            getCurrentVideoTime={getCurrentVideoTime}
                            showTimestampBtn={canAttachVideoTimestamp}
                            compact={true}
                            onAttachClick={() => fileInputRef.current?.click()}
                            hasAttachment={Boolean(questionAttachment)}
                        />

                        {/* Textarea or Markdown Preview */}
                        <div className="textarea-wrapper-modern mt-1">
                            {questionPreviewMode ? (
                                <div className="modal-question-preview-box compact-preview-box">
                                    <QAMarkdownRenderer
                                        content={createMessage.message}
                                        onTimestampClick={(sec) => handleJumpToVideoTimestamp(currentVariantContext?.variant_item_id, sec)}
                                        emptyPlaceholder="Tuliskan detail pertanyaan Anda di mode Tulis untuk melihat pratinjau di sini."
                                    />
                                </div>
                            ) : (
                                <textarea
                                    ref={questionTextareaRef}
                                    name="message"
                                    className="form-control compact-modal-textarea"
                                    rows="5"
                                    placeholder="Tuliskan rincian pertanyaan Anda di sini. Mendukung pemformatan Markdown, tautan menit video [02:30], dan tempel screenshot langsung (Ctrl+V)..."
                                    value={createMessage.message}
                                    onChange={handleMessageChange}
                                    onPaste={handlePasteImage}
                                    required={!questionAttachment}
                                />
                            )}
                        </div>

                        {/* Attachment Preview Chip */}
                        <QAAttachmentInputPreview
                            file={questionAttachment}
                            isCompressing={isCompressingAttachment}
                            onRemove={() => setQuestionAttachment && setQuestionAttachment(null)}
                            compact={true}
                        />
                    </div>

                    {/* Slim Tips Banner (1 line) */}
                    <div className="compact-modal-tip-banner d-flex align-items-center gap-2 px-3 py-1-5 rounded">
                        <i className="fas fa-lightbulb text-amber flex-shrink-0"></i>
                        <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                            <strong>Tips:</strong> Jelaskan kendala secara spesifik dan sematkan menit video agar instruktur atau rekan diskusi langsung memahami konteks Anda.
                        </span>
                    </div>
                </div>

                {/* 3. Sleek Compact Footer (44px height) */}
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
                            disabled={!createMessage.title?.trim() || (!createMessage.message?.trim() && !questionAttachment) || isCompressingAttachment}
                            style={{
                                background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
                                boxShadow: '0 3px 10px rgba(13, 148, 136, 0.35)'
                            }}
                        >
                            <i className="fas fa-paper-plane me-1"></i>Ajukan Pertanyaan
                        </button>
                    </div>
                </div>
            </form>

            {/* Resize handle (Preserved for JavaScript resize listener) */}
            <div className="modal-resize-handle" title="Tahan dan geser untuk mengubah ukuran modal"></div>
        </Modal>
    );
};

export default React.memo(CreateQuestionModal);
