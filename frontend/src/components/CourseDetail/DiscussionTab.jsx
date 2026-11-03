import React from "react";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import { moment } from "../../utils/dayjs";
import { getMediaUrl } from "../../utils/constants";
import UserData from "../../views/plugin/UserData";
import {
    formatTimestamp,
    QAFormattingToolbar,
    QAMarkdownRenderer,
    QAVideoTimestampBadge,
    stripMarkdown,
} from "./QAMarkdownTools";
import { QAAttachmentInputPreview, QAAttachmentDisplay, QAImageLightboxModal } from "./QAAttachmentTools";
import { validateQAFile, compressImageFile, formatFileSize } from "../../utils/qaCompression";
import Toast from "../../views/plugin/Toast";

/**
 * ✨ PILAR 5: Official Executive DPD RI Role Badges
 * Displays verified badges for Course Instructor, Setjen DPD RI Staff/Admin,
 * Organization Unit, and Position/Jabatan.
 * 
 * Revisions:
 * Setjen DPD RI, Jabatan (Position), and Unit Kerja (Organization Unit) are displayed as
 * sleek icon-only badges, with full contextual text revealed in a polished floating tooltip on hover.
 */
export const DPDRIRoleBadges = ({
    profile,
    isInstructor,
    isCurrentUser,
    isAsker,
    className = "",
}) => {
    const rawId = React.useId();
    const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, "");

    return (
        <span className={`dpd-role-badges-group d-inline-flex align-items-center gap-1 flex-wrap ${className}`}>
            {/* 1. Lencana Instruktur Resmi Kursus */}
            {isInstructor && (
                <OverlayTrigger
                    placement="top"
                    delay={{ show: 150, hide: 100 }}
                    overlay={(props) => (
                        <Tooltip id={`dpd-tip-inst-${cleanId}`} {...props} className="dpd-role-tooltip">
                            <div className="dpd-tooltip-label label-instructor">Peran Kursus</div>
                            <div className="dpd-tooltip-value">Instruktur Resmi Kursus LMSetjen DPD RI</div>
                        </Tooltip>
                    )}
                >
                    <span className="dpd-badge-role dpd-badge-instructor" tabIndex={0}>
                        <i className="fas fa-chalkboard-user me-1"></i>Instruktur
                    </span>
                </OverlayTrigger>
            )}

            {/* 2. Lencana Staf / Admin Setjen DPD RI (Icon Only with Tooltip) */}
            {profile?.is_staff && (
                <OverlayTrigger
                    placement="top"
                    delay={{ show: 150, hide: 100 }}
                    overlay={(props) => (
                        <Tooltip id={`dpd-tip-admin-${cleanId}`} {...props} className="dpd-role-tooltip">
                            <div className="dpd-tooltip-label label-admin">Institusi</div>
                            <div className="dpd-tooltip-value">Setjen DPD RI (Staf Resmi / Penyelenggara)</div>
                        </Tooltip>
                    )}
                >
                    <span
                        className="dpd-badge-role dpd-badge-icon-only dpd-badge-admin"
                        tabIndex={0}
                        aria-label="Setjen DPD RI"
                    >
                        <i className="fas fa-shield-alt"></i>
                    </span>
                </OverlayTrigger>
            )}

            {/* 3. Lencana Penanya */}
            {isAsker && (
                <span className="dpd-badge-role dpd-badge-asker" title="Pembuat Pertanyaan">
                    Penanya
                </span>
            )}

            {/* 4. Lencana Anda */}
            {isCurrentUser && (
                <span className="dpd-badge-role dpd-badge-current" title="Akun Anda">
                    Anda
                </span>
            )}

            {/* 5. Lencana Jabatan (Icon Only with Tooltip, e.g. Penata Kelola Sistem dan Teknologi Informasi) */}
            {profile?.position_name && (
                <OverlayTrigger
                    placement="top"
                    delay={{ show: 150, hide: 100 }}
                    overlay={(props) => (
                        <Tooltip id={`dpd-tip-pos-${cleanId}`} {...props} className="dpd-role-tooltip">
                            <div className="dpd-tooltip-label label-pos">Jabatan Pegawai</div>
                            <div className="dpd-tooltip-value">{profile.position_name}</div>
                        </Tooltip>
                    )}
                >
                    <span
                        className="dpd-badge-role dpd-badge-icon-only dpd-badge-position"
                        tabIndex={0}
                        aria-label={`Jabatan: ${profile.position_name}`}
                    >
                        <i className="fas fa-briefcase"></i>
                    </span>
                </OverlayTrigger>
            )}

            {/* 6. Lencana Unit Kerja Setjen DPD RI (Icon Only with Tooltip, e.g. Subbagian Administrasi Keanggotaan) */}
            {profile?.organization_unit_name && (
                <OverlayTrigger
                    placement="top"
                    delay={{ show: 150, hide: 100 }}
                    overlay={(props) => (
                        <Tooltip id={`dpd-tip-org-${cleanId}`} {...props} className="dpd-role-tooltip">
                            <div className="dpd-tooltip-label label-org">Unit Kerja Organisasi</div>
                            <div className="dpd-tooltip-value">{profile.organization_unit_name}</div>
                        </Tooltip>
                    )}
                >
                    <span
                        className="dpd-badge-role dpd-badge-icon-only dpd-badge-org"
                        tabIndex={0}
                        aria-label={`Unit Kerja: ${profile.organization_unit_name}`}
                    >
                        <i className="fas fa-building-columns"></i>
                    </span>
                </OverlayTrigger>
            )}
        </span>
    );
};

/**
 * DiscussionTab Component
 * Modularized discussion forum for CourseDetail
 */
const DiscussionTab = ({
    course,
    openedQuestionId,
    selectedConversation,
    handleConversationClose,
    handleConversationShow,
    handleQuestionShow,
    qaStats,
    discussionFilters,
    setDiscussionFilters,
    filteredQuestions,
    handleToggleSolution,
    handleTogglePin,
    handleLikeQuestion,
    handleLikeMessage,
    userLikedQuestions,
    userLikedMessages,
    isQAItemReported,
    getQAReportStatus,
    handleOpenQAReportModal,
    createMessage,
    setCreateMessage,
    handleMessageChange,
    sendNewMessage,
    isSubmittingReply = false,
    activeVariantItem = null,
    replyTextareaRef,
    replyPreviewMode,
    setReplyPreviewMode,
    getCurrentVideoTime,
    handleJumpToVideoTimestamp,
    isCourseInstructorOrStaff,
}) => {
    const currentUser = UserData();

    const [replyAttachment, setReplyAttachment] = React.useState(null);
    const [isCompressingReplyAttachment, setIsCompressingReplyAttachment] = React.useState(false);
    const [lightboxImage, setLightboxImage] = React.useState({ show: false, url: '', name: '' });
    const replyFileInputRef = React.useRef(null);

    const handleReplyFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validation = validateQAFile(file);
        if (!validation.valid) {
            Toast().fire({ icon: "error", title: validation.error });
            e.target.value = "";
            return;
        }

        try {
            setIsCompressingReplyAttachment(true);
            const compressed = await compressImageFile(file);
            setReplyAttachment(compressed);
        } catch (err) {
            console.error("Gagal mengompresi gambar:", err);
            setReplyAttachment(file);
        } finally {
            setIsCompressingReplyAttachment(false);
            e.target.value = "";
        }
    };

    const handleReplyPasteImage = async (e) => {
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
                    setIsCompressingReplyAttachment(true);
                    const compressed = await compressImageFile(file);
                    setReplyAttachment(compressed);
                    Toast().fire({
                        icon: "success",
                        title: `Gambar berhasil dilampirkan (${formatFileSize(compressed.size)})`
                    });
                } catch (err) {
                    console.error("Paste image error:", err);
                } finally {
                    setIsCompressingReplyAttachment(false);
                }
                break;
            }
        }
    };

    // ✨ Keyboard shortcut: Esc to return to question list
    React.useEffect(() => {
        if (!openedQuestionId) return;

        const handleKeyDown = (e) => {
            if (e.key === "Escape" || e.key === "Esc") {
                handleConversationClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [openedQuestionId, handleConversationClose]);

    return (
        <div className="tab-pane fade" id="discussions" role="tabpanel">
            {/* Header - shows "Diskusi Kursus" when viewing list, question title when viewing detail */}
            <div className="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
                {!openedQuestionId && (
                    <>
                        <div className="d-flex align-items-center pt-1">
                            <h4 className="mb-0">
                                <i className="fas fa-comments text-teal-accent me-2"></i>Diskusi Kursus
                            </h4>
                        </div>
                        <div className="d-flex align-items-center gap-2 ms-auto flex-wrap justify-content-end qa-header-actions-col">
                            {activeVariantItem && (
                                <button
                                    type="button"
                                    className={`qa-active-lesson-chip ${discussionFilters.pelajaran === activeVariantItem.variant_item_id ? 'active' : ''}`}
                                    onClick={() => {
                                        if (discussionFilters.pelajaran === activeVariantItem.variant_item_id) {
                                            setDiscussionFilters(prev => ({ ...prev, bagian: null, pelajaran: null }));
                                        } else {
                                            const parentVariant = course?.curriculum?.find(v =>
                                                (v.variant_items || v.items || []).some(it => it.variant_item_id === activeVariantItem.variant_item_id)
                                            );
                                            setDiscussionFilters(prev => ({
                                                ...prev,
                                                bagian: parentVariant?.variant_id || null,
                                                pelajaran: activeVariantItem.variant_item_id
                                            }));
                                        }
                                    }}
                                    title={discussionFilters.pelajaran === activeVariantItem.variant_item_id ? "Klik untuk menampilkan semua diskusi materi" : "Klik untuk memfilter diskusi materi yang sedang Anda pelajari"}
                                >
                                    <i className="fas fa-crosshairs me-1 text-teal-accent"></i>
                                    <span className="qa-chip-title">Materi Aktif: <strong>{activeVariantItem.title}</strong></span>
                                    {discussionFilters.pelajaran === activeVariantItem.variant_item_id ? (
                                        <span className="qa-chip-status-tag tag-active"><i className="fas fa-times me-1"></i>Batalkan</span>
                                    ) : (
                                        <span className="qa-chip-status-tag tag-idle"><i className="fas fa-filter me-1"></i>Filter Diskusi Ini</span>
                                    )}
                                </button>
                            )}
                            <button
                                className="add-btn-modern"
                                onClick={handleQuestionShow}
                            >
                                <i className="fas fa-plus"></i>
                                Ajukan Pertanyaan
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Inline forum view - show when a question is opened */}
            {openedQuestionId && selectedConversation ? (
                <div className="forum-thread-container">
                    {/* ✨ Pilar 5: Pinned Announcement Banner if question is pinned */}
                    {selectedConversation.is_pinned && (
                        <div className="pinned-thread-banner mb-3 d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center gap-2">
                                <span className="pinned-banner-icon">
                                    <i className="fas fa-thumbtack"></i>
                                </span>
                                <div>
                                    <strong className="d-block text-amber-900" style={{ fontSize: '0.85rem' }}>
                                        Diskusi / Pengumuman Disematkan
                                    </strong>
                                    <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                                        Topik ini disematkan oleh instruktur kursus agar mudah diakses seluruh peserta.
                                    </span>
                                </div>
                            </div>
                            {isCourseInstructorOrStaff && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-amber"
                                    onClick={() => handleTogglePin(selectedConversation.qa_id)}
                                    title="Batalkan sematan diskusi ini"
                                >
                                    <i className="fas fa-times me-1"></i>Batal Sematkan
                                </button>
                            )}
                        </div>
                    )}

                    {/* Professional Forum Header with Status Badge */}
                    <div className="forum-thread-header">
                        <div className="forum-thread-title-area">
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <button
                                    className="forum-back-btn"
                                    onClick={handleConversationClose}
                                >
                                    <i className="fas fa-arrow-left me-1"></i>
                                    Kembali
                                </button>
                                <h2 className="forum-thread-title mb-0 flex-grow-1">
                                    {selectedConversation.title || 'Tidak Ada Judul'}
                                </h2>

                                {/* Solved / Waiting Status Pill */}
                                {selectedConversation.is_solved || selectedConversation.messages?.some(m => m.is_solution) ? (
                                    <span className="qa-status-pill solved">
                                        <i className="fas fa-check-circle me-1"></i>Terjawab
                                    </span>
                                ) : (
                                    <span className="qa-status-pill waiting">
                                        <i className="fas fa-clock me-1"></i>Menunggu Solusi
                                    </span>
                                )}

                                {/* ✨ Quick Jump to Reply Form Button */}
                                <button
                                    type="button"
                                    className="forum-quick-reply-btn"
                                    onClick={() => {
                                        const replySec = document.querySelector('.forum-reply-section');
                                        if (replySec) {
                                            replySec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            setTimeout(() => {
                                                if (replyTextareaRef?.current) {
                                                    replyTextareaRef.current.focus();
                                                }
                                            }, 250);
                                        }
                                    }}
                                    title="Langsung menuju form balasan di bawah"
                                >
                                    <i className="fas fa-reply me-1 text-teal"></i>Tulis Balasan
                                </button>

                                {/* ✨ Pilar 5: Pin Toggle Button for Instructors / Staff */}
                                {isCourseInstructorOrStaff && !selectedConversation.is_pinned && (
                                    <button
                                        type="button"
                                        className="forum-pin-action-btn"
                                        onClick={() => handleTogglePin(selectedConversation.qa_id)}
                                        title="Sematkan diskusi ini ke bagian teratas"
                                    >
                                        <i className="fas fa-thumbtack me-1 text-amber"></i>Sematkan
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Breadcrumb and Meta in one line */}
                        <div className="forum-header-footer">
                            <div className="forum-breadcrumb">
                                {selectedConversation.variant && (
                                    <>
                                        <i className="fas fa-folder me-1" style={{ color: '#016b87' }}></i>
                                        <span>{selectedConversation.variant.title}</span>
                                        {selectedConversation.variant_item && <span className="mx-2">/</span>}
                                    </>
                                )}
                                {selectedConversation.variant_item && (
                                    <>
                                        <i className="fas fa-file me-1" style={{ color: '#662d91' }}></i>
                                        <span>{selectedConversation.variant_item.title}</span>
                                    </>
                                )}
                            </div>
                            <div className="forum-thread-meta d-flex align-items-center gap-2 flex-wrap">
                                {selectedConversation.video_timestamp !== null && selectedConversation.video_timestamp !== undefined && (
                                    <QAVideoTimestampBadge
                                        timestamp={selectedConversation.video_timestamp}
                                        onClick={(sec) => handleJumpToVideoTimestamp(selectedConversation.variant_item?.variant_item_id, sec)}
                                        label="Menit"
                                        size="md"
                                    />
                                )}
                                <span className="forum-meta-badge">
                                    <i className="fas fa-comments"></i>
                                    {Math.max(0, (selectedConversation.messages?.length || 1) - 1)} Balasan
                                </span>
                                <span className="forum-meta-badge">
                                    <i className="fas fa-clock"></i>
                                    {moment(selectedConversation.date).fromNow()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Original Question Card - Professional Style */}
                    <div className="forum-post-card forum-original-post">
                        {/* Post Header */}
                        <div className="forum-post-header">
                            <div className="forum-user-info">
                                <div className="forum-user-avatar-wrapper">
                                    {selectedConversation.profile?.image ? (
                                        <img
                                            src={selectedConversation.profile.image.startsWith("http")
                                                ? selectedConversation.profile.image
                                                : selectedConversation.profile.image.startsWith("/images/")
                                                    ? selectedConversation.profile.image
                                                    : getMediaUrl(selectedConversation.profile.image)}
                                            alt={selectedConversation.profile?.full_name || "User"}
                                            className="forum-user-avatar"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = "/images/placeholders/default-avatar.svg";
                                            }}
                                        />
                                    ) : (
                                        <div className="forum-user-avatar-placeholder">
                                            {selectedConversation.profile?.full_name ? (
                                                selectedConversation.profile.full_name
                                                    .split(' ')
                                                    .filter(Boolean)
                                                    .map(n => n[0])
                                                    .slice(0, 2)
                                                    .join('')
                                                    .toUpperCase()
                                            ) : (
                                                <i className="fas fa-user"></i>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="forum-user-details">
                                    <div className="forum-user-name d-flex align-items-center gap-1 flex-wrap">
                                        <span>{selectedConversation.profile?.full_name || 'Pengguna Anonim'}</span>

                                        {/* ✨ Pilar 5: DPD RI Role Badges */}
                                        <DPDRIRoleBadges
                                            profile={selectedConversation.profile}
                                            isInstructor={course?.course?.teacher && (
                                                selectedConversation?.user_id === course.course.teacher.user_id ||
                                                selectedConversation?.profile?.user_id === course.course.teacher.user_id
                                            )}
                                            isCurrentUser={Boolean(
                                                (selectedConversation?.user_id && selectedConversation?.user_id === currentUser?.user_id) ||
                                                (selectedConversation?.profile?.user_id && selectedConversation?.profile?.user_id === currentUser?.user_id)
                                            )}
                                            isAsker={true}
                                        />

                                        {isQAItemReported(selectedConversation.qa_id) && (
                                            <span className="forum-user-badge-reported">
                                                <i className="fas fa-flag me-1"></i>Sudah Dilaporkan
                                            </span>
                                        )}
                                    </div>
                                    <div className="forum-user-timestamp">
                                        <i className="fas fa-clock-o me-1"></i>
                                        {moment(selectedConversation.date).format("DD MMM YYYY [pada] HH:mm")}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Post Content */}
                        <div className="forum-post-content">
                            <QAMarkdownRenderer
                                content={selectedConversation.message || (selectedConversation.messages?.[0]?.message) || 'Tidak ada pesan'}
                                onTimestampClick={(sec) => handleJumpToVideoTimestamp(selectedConversation.variant_item?.variant_item_id, sec)}
                            />
                            {/* Attachment Display for Original Question */}
                            <QAAttachmentDisplay
                                fileUrl={selectedConversation.file || selectedConversation.messages?.[0]?.file}
                                fileName={selectedConversation.file_name || selectedConversation.messages?.[0]?.file_name}
                                onImageClick={(url, name) => setLightboxImage({ show: true, url, name })}
                            />
                        </div>

                        {/* Post Footer with Like and Report Button */}
                        <div className="forum-post-footer">
                            <div className="forum-post-actions">
                                <button
                                    className={`forum-like-btn ${userLikedQuestions.has(selectedConversation.qa_id) ? 'liked' : ''}`}
                                    title={userLikedQuestions.has(selectedConversation.qa_id) ? "Batalkan suka" : "Sukai pertanyaan ini"}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleLikeQuestion(selectedConversation);
                                    }}
                                    style={userLikedQuestions.has(selectedConversation.qa_id) ? { color: '#eab308' } : {}}
                                >
                                    <i className={`${userLikedQuestions.has(selectedConversation.qa_id) ? "fas" : "far"} fa-thumbs-up me-1`}></i>
                                    <span className="like-count">{selectedConversation.likes_count || 0}</span>
                                </button>
                                {(() => {
                                    const reportStatus = getQAReportStatus(selectedConversation.qa_id, 'question');
                                    return (
                                        <button
                                            className="forum-report-btn"
                                            title={reportStatus ? `Laporan: ${reportStatus.status}` : "Laporkan pertanyaan ini"}
                                            onClick={() => handleOpenQAReportModal(selectedConversation, 'question')}
                                            style={reportStatus ? { color: '#d32f2f', opacity: 0.8 } : {}}
                                        >
                                            <i className="fas fa-flag"></i>
                                            {reportStatus && (
                                                <span style={{ marginLeft: '0.25rem', fontSize: '0.7rem' }}>✓</span>
                                            )}
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* ✨ Pilar 1: Pinned Verified Solution Box */}
                    {(selectedConversation.is_solved || selectedConversation.messages?.some(m => m.is_solution)) && (
                        <div className="pinned-solution-box my-2">
                            <div className="d-flex align-items-center justify-content-between mb-1">
                                <span className="solution-badge-pill">
                                    <i className="fas fa-award me-1"></i>Solusi Terverifikasi
                                </span>
                                <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                                    Telah diverifikasi sebagai jawaban terbaik
                                </small>
                            </div>
                            {(() => {
                                const solMsg = selectedConversation.messages?.find(m => m.is_solution);
                                if (!solMsg) return null;
                                return (
                                    <div className="pinned-solution-body">
                                        <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                            <strong className="text-slate-800" style={{ fontSize: '0.82rem' }}>
                                                {solMsg.profile?.full_name || 'Pengguna'}
                                            </strong>
                                            <DPDRIRoleBadges
                                                profile={solMsg.profile}
                                                isInstructor={course?.course?.teacher && (
                                                    solMsg.user_id === course.course.teacher.user_id ||
                                                    solMsg.profile?.user_id === course.course.teacher.user_id
                                                )}
                                                isCurrentUser={Boolean(
                                                    solMsg.profile?.user_id === currentUser?.user_id ||
                                                    (solMsg.user_id && solMsg.user_id === currentUser?.user_id)
                                                )}
                                            />
                                            <span className="text-muted ms-auto" style={{ fontSize: '0.72rem' }}>
                                                {moment(solMsg.date).fromNow()}
                                            </span>
                                        </div>
                                        <div className="mb-0 text-dark" style={{ fontSize: '0.84rem', lineHeight: '1.45' }}>
                                            <QAMarkdownRenderer
                                                content={solMsg.message}
                                                onTimestampClick={(sec) => handleJumpToVideoTimestamp(selectedConversation.variant_item?.variant_item_id, sec)}
                                            />
                                            <QAAttachmentDisplay
                                                fileUrl={solMsg.file}
                                                fileName={solMsg.file_name}
                                                onImageClick={(url, name) => setLightboxImage({ show: true, url, name })}
                                            />
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Replies Section */}
                    {selectedConversation.messages && selectedConversation.messages.length > 1 && (
                        <div className="forum-replies-section">
                            <div className="forum-replies-list">
                                {selectedConversation.messages.slice(1).map((msg, index) => {
                                    const isCurrentUser = msg.profile?.user_id === currentUser?.user_id ||
                                        (msg.user_id && msg.user_id === currentUser?.user_id);
                                    const isInstructor = course?.course?.teacher && (
                                        (msg.user_id && msg.user_id === course.course.teacher.user_id) ||
                                        (msg.profile?.user_id && msg.profile.user_id === course.course.teacher.user_id)
                                    );
                                    const isSolution = Boolean(msg.is_solution);
                                    const isAskerUser = Boolean(
                                        (selectedConversation.user_id && selectedConversation.user_id === currentUser?.user_id) ||
                                        (selectedConversation.profile?.user_id && selectedConversation.profile.user_id === currentUser?.user_id)
                                    );
                                    const canToggle = Boolean(isAskerUser || isCourseInstructorOrStaff);

                                    return (
                                        <div
                                            key={msg.id || index}
                                            className={`forum-post-card forum-reply-post ${isSolution ? 'post-solution-active' : ''}`}
                                        >
                                            {/* Solution Ribbon */}
                                            {isSolution && (
                                                <div className="solution-indicator-ribbon">
                                                    <i className="fas fa-check-circle me-1"></i>Jawaban Ini Ditandai Sebagai Solusi Terbaik
                                                </div>
                                            )}

                                            {/* Reply Header */}
                                            <div className="forum-post-header">
                                                <div className="forum-user-info">
                                                    <div className="forum-user-avatar-wrapper">
                                                        {msg.profile?.image ? (
                                                            <img
                                                                src={msg.profile.image.startsWith("http")
                                                                    ? msg.profile.image
                                                                    : msg.profile.image.startsWith("/images/")
                                                                        ? msg.profile.image
                                                                        : getMediaUrl(msg.profile.image)}
                                                                alt={`${msg.profile?.full_name || "User"} avatar`}
                                                                className="forum-user-avatar"
                                                                onError={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = "/images/placeholders/default-avatar.svg";
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="forum-user-avatar-placeholder">
                                                                {msg.profile?.full_name ? (
                                                                    msg.profile.full_name
                                                                        .split(' ')
                                                                        .filter(Boolean)
                                                                        .map(n => n[0])
                                                                        .slice(0, 2)
                                                                        .join('')
                                                                        .toUpperCase()
                                                                ) : (
                                                                    <i className="fas fa-user"></i>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="forum-user-details">
                                                        <div className="forum-user-name d-flex align-items-center gap-1 flex-wrap">
                                                            <span>{msg.profile?.full_name || 'Pengguna Anonim'}</span>

                                                            {isSolution && (
                                                                <span className="forum-user-badge-solution" title="Solusi Terverifikasi">
                                                                    <i className="fas fa-check-circle me-1"></i>Solusi Terpilih
                                                                </span>
                                                            )}

                                                            {/* ✨ Pilar 5: DPD RI Role Badges */}
                                                            <DPDRIRoleBadges
                                                                profile={msg.profile}
                                                                isInstructor={isInstructor}
                                                                isCurrentUser={isCurrentUser}
                                                            />

                                                            {isQAItemReported(msg.qa_id) && (
                                                                <span className="forum-user-badge-reported">
                                                                    <i className="fas fa-flag me-1"></i>Sudah Dilaporkan
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="forum-user-timestamp">
                                                            <i className="fas fa-clock-o me-1"></i>
                                                            {moment(msg.date).format("DD MMM YYYY [pada] HH:mm")}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Reply Content */}
                                            <div className="forum-post-content">
                                                <QAMarkdownRenderer
                                                    content={msg.message}
                                                    onTimestampClick={(sec) => handleJumpToVideoTimestamp(selectedConversation.variant_item?.variant_item_id, sec)}
                                                />
                                                <QAAttachmentDisplay
                                                    fileUrl={msg.file}
                                                    fileName={msg.file_name}
                                                    onImageClick={(url, name) => setLightboxImage({ show: true, url, name })}
                                                />
                                            </div>

                                            {/* Post Footer with Solution Toggle, Like and Report Button */}
                                            <div className="forum-post-footer">
                                                <div className="forum-post-actions d-flex align-items-center justify-content-between w-100 flex-wrap gap-2">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <button
                                                            className={`forum-like-btn ${userLikedMessages.has(msg.id) ? 'liked' : ''}`}
                                                            title={userLikedMessages.has(msg.id) ? "Batalkan suka" : "Sukai jawaban ini"}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleLikeMessage(msg);
                                                            }}
                                                            style={userLikedMessages.has(msg.id) ? { color: '#eab308' } : {}}
                                                        >
                                                            <i className={`${userLikedMessages.has(msg.id) ? "fas" : "far"} fa-thumbs-up me-1`}></i>
                                                            <span className="like-count">{msg.likes_count || 0}</span>
                                                        </button>
                                                        {(() => {
                                                            const reportStatus = getQAReportStatus(msg.qa_id, 'message');
                                                            return (
                                                                <button
                                                                    className="forum-report-btn"
                                                                    title={reportStatus ? `Laporan: ${reportStatus.status}` : "Laporkan jawaban ini"}
                                                                    onClick={() => handleOpenQAReportModal(msg, 'message')}
                                                                    style={reportStatus ? { color: '#d32f2f', opacity: 0.8 } : {}}
                                                                >
                                                                    <i className="fas fa-flag"></i>
                                                                    {reportStatus && (
                                                                        <span style={{ marginLeft: '0.25rem', fontSize: '0.7rem' }}>✓</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })()}
                                                    </div>

                                                    {/* Verified Solution Button */}
                                                    {canToggle && (
                                                        <button
                                                            type="button"
                                                            className={`forum-solution-btn ${isSolution ? 'active' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleSolution(msg, selectedConversation.qa_id);
                                                            }}
                                                            title={isSolution ? "Batalkan status solusi untuk jawaban ini" : "Tandai jawaban ini sebagai solusi yang menyelesaikan pertanyaan"}
                                                        >
                                                            <i className={`fas ${isSolution ? 'fa-check-circle' : 'fa-circle-check'} me-1`}></i>
                                                            {isSolution ? "Solusi Terverifikasi" : "Tandai Sebagai Solusi"}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {(!selectedConversation.messages || selectedConversation.messages.length <= 1) && (
                        <div className="forum-empty-replies">
                            <div className="empty-replies-content">
                                <i className="fas fa-comments"></i>
                                <h4>Belum ada balasan</h4>
                                <p>Jadilah yang pertama memberikan balasan untuk pertanyaan ini!</p>
                            </div>
                        </div>
                    )}

                    {/* Reply Form Section */}
                    <div className="forum-reply-section">
                        <h3 className="forum-reply-section-title">
                            <i className="fas fa-edit me-2"></i>Berikan Balasan Anda
                        </h3>
                        <form onSubmit={(e) => { e.preventDefault(); sendNewMessage(e, replyAttachment, () => setReplyAttachment(null)); }} className="forum-reply-form">
                            {/* Hidden file input for reply attachment */}
                            <input
                                type="file"
                                ref={replyFileInputRef}
                                style={{ display: "none" }}
                                accept=".png,.jpg,.jpeg,.webp,.pdf,image/*"
                                onChange={handleReplyFileChange}
                            />

                            <div className="forum-form-group">
                                {/* ✨ Pilar 4: Formatting Toolbar */}
                                <QAFormattingToolbar
                                    textareaRef={replyTextareaRef}
                                    value={createMessage.message}
                                    onChange={(newVal) => setCreateMessage(prev => ({ ...prev, message: newVal }))}
                                    isPreview={replyPreviewMode}
                                    onTogglePreview={setReplyPreviewMode}
                                    getCurrentVideoTime={getCurrentVideoTime}
                                    showTimestampBtn={true}
                                    onAttachClick={() => replyFileInputRef.current?.click()}
                                    hasAttachment={Boolean(replyAttachment)}
                                />
                                {replyPreviewMode ? (
                                    <div className="forum-reply-preview-container">
                                        <QAMarkdownRenderer
                                            content={createMessage.message}
                                            onTimestampClick={(sec) => handleJumpToVideoTimestamp(selectedConversation?.variant_item?.variant_item_id, sec)}
                                            emptyPlaceholder="Tuliskan balasan Anda di mode Tulis untuk melihat pratinjau di sini."
                                        />
                                    </div>
                                ) : (
                                    <textarea
                                        ref={replyTextareaRef}
                                        name="message"
                                        className="forum-reply-textarea"
                                        placeholder="Tulis balasan Anda di sini... Mendukung Markdown, cap waktu video [02:15], dan tempel screenshot langsung (Ctrl+V)."
                                        rows="3"
                                        onChange={handleMessageChange}
                                        onPaste={handleReplyPasteImage}
                                        value={createMessage.message}
                                        required={!replyAttachment}
                                    />
                                )}

                                {/* Attachment Preview Chip for Reply */}
                                <QAAttachmentInputPreview
                                    file={replyAttachment}
                                    isCompressing={isCompressingReplyAttachment}
                                    onRemove={() => setReplyAttachment(null)}
                                />
                            </div>
                            <div className="forum-form-actions">
                                <p className="forum-form-hint">
                                    <i className="fas fa-info-circle me-1"></i>Format Markdown, cap waktu video, dan lampiran file/gambar didukung penuh.
                                </p>
                                <div className="forum-action-buttons">
                                    <button
                                        type="submit"
                                        className="forum-btn-primary"
                                        disabled={(!createMessage.message?.trim() && !replyAttachment) || isSubmittingReply || isCompressingReplyAttachment}
                                    >
                                        {isSubmittingReply ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin me-2"></i>Mengirim...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-paper-plane me-2"></i>Kirim Balasan
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            ) : (
                <>
                    {/* ✨ Pilar 2: Quick Filter Tabs */}
                    <div className="qa-quick-filter-tabs mb-2">
                        <button
                            type="button"
                            className={`qa-filter-tab-btn ${(!discussionFilters.tab || discussionFilters.tab === 'all') ? 'active' : ''}`}
                            onClick={() => setDiscussionFilters(prev => ({ ...prev, tab: 'all' }))}
                        >
                            <i className="fas fa-layer-group"></i>
                            <span className="qa-tab-label">Semua Diskusi</span>
                            <span className="qa-tab-count">{qaStats.total}</span>
                        </button>
                        <button
                            type="button"
                            className={`qa-filter-tab-btn ${discussionFilters.tab === 'unsolved' ? 'active' : ''}`}
                            onClick={() => setDiscussionFilters(prev => ({ ...prev, tab: 'unsolved' }))}
                        >
                            <i className="fas fa-clock"></i>
                            <span className="qa-tab-label">Belum Terjawab</span>
                            <span className="qa-tab-count">{qaStats.unsolved}</span>
                        </button>
                        <button
                            type="button"
                            className={`qa-filter-tab-btn ${discussionFilters.tab === 'solved' ? 'active' : ''}`}
                            onClick={() => setDiscussionFilters(prev => ({ ...prev, tab: 'solved' }))}
                        >
                            <i className="fas fa-check-circle"></i>
                            <span className="qa-tab-label">Terjawab</span>
                            <span className="qa-tab-count">{qaStats.solved}</span>
                        </button>
                        <button
                            type="button"
                            className={`qa-filter-tab-btn ${discussionFilters.tab === 'instructor' ? 'active' : ''}`}
                            onClick={() => setDiscussionFilters(prev => ({ ...prev, tab: 'instructor' }))}
                        >
                            <i className="fas fa-chalkboard-user"></i>
                            <span className="qa-tab-label">Dijawab Instruktur</span>
                            <span className="qa-tab-count">{qaStats.instructor}</span>
                        </button>
                        <button
                            type="button"
                            className={`qa-filter-tab-btn ${discussionFilters.tab === 'my_questions' ? 'active' : ''}`}
                            onClick={() => setDiscussionFilters(prev => ({ ...prev, tab: 'my_questions' }))}
                        >
                            <i className="fas fa-user"></i>
                            <span className="qa-tab-label">Pertanyaan Saya</span>
                            <span className="qa-tab-count">{qaStats.myQuestions}</span>
                        </button>
                        <button
                            type="button"
                            className={`qa-filter-tab-btn ${discussionFilters.tab === 'popular' ? 'active' : ''}`}
                            onClick={() => setDiscussionFilters(prev => ({ ...prev, tab: 'popular' }))}
                        >
                            <i className="fas fa-fire text-danger"></i>
                            <span className="qa-tab-label">Populer</span>
                        </button>
                    </div>

                    {/* Secondary Filter Controls - Search, Bagian, Pelajaran, Sorting */}
                    <div className="mb-3 course-filters-row">
                        {/* Search Input with inline clear */}
                        <div className="filter-col-search" style={{ flex: '1 1 35%' }}>
                            <label className="compact-filter-label">
                                <i className="fas fa-search me-1 text-teal-accent"></i>
                                Cari Pertanyaan
                            </label>
                            <div className="search-input-wrapper position-relative">
                                <input
                                    type="text"
                                    className="form-control compact-filter-input"
                                    placeholder="Cari judul, kata kunci, atau jawaban..."
                                    value={discussionFilters.search}
                                    onChange={(e) => setDiscussionFilters({ ...discussionFilters, search: e.target.value })}
                                    style={{ paddingRight: discussionFilters.search ? '2rem' : undefined }}
                                />
                                {discussionFilters.search && (
                                    <button
                                        type="button"
                                        className="search-clear-inline-btn"
                                        onClick={() => setDiscussionFilters(prev => ({ ...prev, search: '' }))}
                                        title="Hapus kata kunci pencarian"
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Bagian Filter Dropdown */}
                        <div className="filter-col-select" style={{ flex: '1 1 20%' }}>
                            <label className="compact-filter-label">
                                <i className="fas fa-layer-group me-1 text-teal-accent"></i>
                                Bagian
                            </label>
                            <select
                                className="form-select compact-filter-select"
                                value={discussionFilters.bagian || ''}
                                onChange={(e) => setDiscussionFilters({ ...discussionFilters, bagian: e.target.value || null, pelajaran: null })}
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
                        <div className="filter-col-select" style={{ flex: '1 1 20%' }}>
                            <label className="compact-filter-label">
                                <i className="fas fa-book me-1 text-danger"></i>
                                Pelajaran
                            </label>
                            <select
                                className="form-select compact-filter-select"
                                value={discussionFilters.pelajaran || ''}
                                onChange={(e) => setDiscussionFilters({ ...discussionFilters, pelajaran: e.target.value || null })}
                                disabled={!discussionFilters.bagian}
                            >
                                <option value="">Semua Pelajaran</option>
                                {discussionFilters.bagian && course?.curriculum?.find(v => v.variant_id === discussionFilters.bagian)?.variant_items?.map((item) => (
                                    <option key={item.variant_item_id} value={item.variant_item_id}>
                                        {item.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Urutkan / Sort Dropdown */}
                        <div className="filter-col-select" style={{ flex: '1 1 18%' }}>
                            <label className="compact-filter-label">
                                <i className="fas fa-sort-amount-down me-1 text-amber"></i>
                                Urutkan
                            </label>
                            <select
                                className="form-select compact-filter-select"
                                value={discussionFilters.sort || 'newest'}
                                onChange={(e) => setDiscussionFilters({ ...discussionFilters, sort: e.target.value })}
                            >
                                <option value="newest">Terbaru</option>
                                <option value="most_replies">Paling Banyak Balasan</option>
                                <option value="most_liked">Paling Banyak Disukai</option>
                            </select>
                        </div>

                        {/* Clear Filters Button */}
                        {(discussionFilters.search || discussionFilters.bagian || discussionFilters.pelajaran || (discussionFilters.tab && discussionFilters.tab !== 'all') || (discussionFilters.sort && discussionFilters.sort !== 'newest')) && (
                            <button
                                onClick={() => setDiscussionFilters({ search: '', bagian: null, pelajaran: null, tab: 'all', sort: 'newest' })}
                                className="compact-clear-filter-btn"
                                title="Reset Semua Filter"
                            >
                                <i className="fas fa-times me-1"></i>Reset
                            </button>
                        )}
                    </div>

                    {/* Question Cards List */}
                    {filteredQuestions?.length > 0 ? (
                        filteredQuestions.map((q, index) => {
                            const isSolved = Boolean(q.is_solved || q.messages?.some(m => m.is_solution));
                            const hasInstructorReply = Boolean(
                                q.has_instructor_reply ||
                                (course?.course?.teacher?.user_id && q.messages?.slice(1).some(m => m.user_id === course.course.teacher.user_id || m.profile?.user_id === course.course.teacher.user_id))
                            );
                            const isPinned = Boolean(q.is_pinned);
                            const isAuthorInstructor = Boolean(
                                course?.course?.teacher && (
                                    q.user_id === course.course.teacher.user_id ||
                                    q.profile?.user_id === course.course.teacher.user_id
                                )
                            );

                            return (
                                <div
                                    key={q.qa_id || index}
                                    className={`question-card ${isPinned ? 'card-pinned' : ''} ${isSolved ? 'card-solved' : 'card-waiting'}`}
                                    onClick={() => handleConversationShow(q)}
                                >
                                    {/* Top Row: Status Pills & Curriculum Context */}
                                    <div className="qa-card-header d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                                        <div className="d-flex align-items-center gap-1 flex-wrap">
                                            {/* ✨ Pilar 5: Pinned Pill Badge */}
                                            {isPinned && (
                                                <span className="qa-status-pill pinned" title="Disematkan oleh instruktur">
                                                    <i className="fas fa-thumbtack me-1 text-amber"></i>Disematkan
                                                </span>
                                            )}

                                            {isSolved ? (
                                                <span className="qa-status-pill solved">
                                                    <i className="fas fa-check-circle me-1"></i>Terjawab
                                                </span>
                                            ) : (
                                                <span className="qa-status-pill waiting">
                                                    <i className="fas fa-clock me-1"></i>Menunggu Solusi
                                                </span>
                                            )}

                                            {hasInstructorReply && (
                                                <span className="qa-status-pill instructor">
                                                    <i className="fas fa-chalkboard-user me-1"></i>Respon Instruktur
                                                </span>
                                            )}

                                            {Boolean(q.file || q.messages?.some(m => m.file)) && (
                                                <span className="qa-status-pill attachment" title="Diskusi ini memiliki lampiran gambar atau dokumen">
                                                    <i className="fas fa-paperclip me-1 text-teal-accent"></i>Lampiran
                                                </span>
                                            )}
                                        </div>

                                        {(q.variant || q.variant_item || (q.video_timestamp !== null && q.video_timestamp !== undefined)) && (
                                            <div className="question-card-badges d-flex align-items-center gap-1 flex-wrap">
                                                {q.variant && (
                                                    <span className="question-badge-variant">
                                                        <i className="fas fa-layer-group me-1"></i>{q.variant.title}
                                                    </span>
                                                )}
                                                {q.variant_item && (
                                                    <span className="question-badge-lesson">
                                                        <i className="fas fa-book me-1"></i>{q.variant_item.title}
                                                    </span>
                                                )}
                                                {q.video_timestamp !== null && q.video_timestamp !== undefined && (
                                                    <QAVideoTimestampBadge
                                                        timestamp={q.video_timestamp}
                                                        onClick={(sec) => handleJumpToVideoTimestamp(q.variant_item?.variant_item_id, sec)}
                                                        size="sm"
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Content Row: Avatar + Title & Snippet */}
                                    <div className="d-flex align-items-start gap-2 mb-2">
                                        <div className="avatar-compact-wrapper flex-shrink-0">
                                            {q.profile?.image ? (
                                                <img
                                                    src={q.profile.image.startsWith("http")
                                                        ? q.profile.image
                                                        : q.profile.image.startsWith("/images/")
                                                            ? q.profile.image
                                                            : getMediaUrl(q.profile.image)}
                                                    alt={q.profile?.full_name || "User"}
                                                    className="avatar-compact"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = "/images/placeholders/default-avatar.svg";
                                                    }}
                                                />
                                            ) : (
                                                <div className="avatar-compact-placeholder">
                                                    {q.profile?.full_name ? (
                                                        q.profile.full_name
                                                            .split(' ')
                                                            .filter(Boolean)
                                                            .map(n => n[0])
                                                            .slice(0, 2)
                                                            .join('')
                                                            .toUpperCase()
                                                    ) : (
                                                        <i className="fas fa-user"></i>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-grow-1 overflow-hidden">
                                            <h5 className="question-title-compact text-truncate mb-1">
                                                {q.title || 'Tidak Ada Judul'}
                                            </h5>
                                            {(q.message || (q.messages && q.messages[0]?.message)) && (
                                                <p className="question-snippet-compact mb-0">
                                                    {stripMarkdown(q.message || q.messages?.[0]?.message || '', 160)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Footer Row: User + DPD RI Roles + Relative Date & Actions */}
                                    <div className="qa-card-footer d-flex justify-content-between align-items-center pt-1 flex-wrap gap-2">
                                        <div className="d-flex align-items-center gap-1 text-muted flex-wrap" style={{ fontSize: '0.74rem' }}>
                                            <span className="fw-semibold text-slate-700">
                                                {q.profile?.full_name || 'Anonim'}
                                            </span>

                                            {/* ✨ Pilar 5: DPD RI Role Badges in Question Card */}
                                            <DPDRIRoleBadges
                                                profile={q.profile}
                                                isInstructor={isAuthorInstructor}
                                                isCurrentUser={Boolean(
                                                    q.profile?.user_id === currentUser?.user_id ||
                                                    (q.user_id && q.user_id === currentUser?.user_id)
                                                )}
                                            />

                                            <span>•</span>
                                            <span>
                                                <i className="fas fa-clock me-1 text-amber"></i>{moment(q.date).fromNow()}
                                            </span>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            {/* Pin Toggle Quick Action for Instructor / Staff */}
                                            {isCourseInstructorOrStaff && (
                                                <button
                                                    type="button"
                                                    className={`card-quick-pin-btn ${isPinned ? 'pinned' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleTogglePin(q.qa_id);
                                                    }}
                                                    title={isPinned ? "Batal Sematkan" : "Sematkan ke Teratas"}
                                                >
                                                    <i className="fas fa-thumbtack"></i>
                                                </button>
                                            )}

                                            <span className="qa-stat-pill">
                                                <i className="fas fa-comments me-1 text-teal"></i>
                                                {q.replies_count ?? Math.max(0, (q.messages?.length || 0) - 1)} Balasan
                                            </span>
                                            <button
                                                type="button"
                                                className={`forum-like-btn ${userLikedQuestions.has(q.qa_id) ? 'liked' : ''}`}
                                                title={userLikedQuestions.has(q.qa_id) ? "Batalkan suka" : "Sukai pertanyaan ini"}
                                                onClick={(e) => { e.stopPropagation(); handleLikeQuestion(q); }}
                                                style={userLikedQuestions.has(q.qa_id) ? { color: '#eab308' } : {}}
                                            >
                                                <i className={`${userLikedQuestions.has(q.qa_id) ? 'fas fa-thumbs-up' : 'far fa-thumbs-up'} me-1`}></i>
                                                <span className="like-count">{q.likes_count || 0}</span>
                                            </button>
                                            {(() => {
                                                const reportStatus = getQAReportStatus(q.qa_id, 'question');
                                                return (
                                                    <button
                                                        type="button"
                                                        className="forum-report-btn"
                                                        title={reportStatus ? `Laporan: ${reportStatus.status}` : "Laporkan pertanyaan ini"}
                                                        onClick={(e) => { e.stopPropagation(); handleOpenQAReportModal(q, 'question'); }}
                                                        style={reportStatus ? { color: '#d32f2f', opacity: 0.8 } : {}}
                                                    >
                                                        <i className="fas fa-flag"></i>
                                                        {reportStatus && (
                                                            <span style={{ marginLeft: '0.25rem', fontSize: '0.7rem' }}>✓</span>
                                                        )}
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="empty-state">
                            <i className="fas fa-comments empty-icon"></i>
                            <h5>Belum ada diskusi ditemukan</h5>
                            <p>
                                {discussionFilters.tab !== 'all' || discussionFilters.search || discussionFilters.bagian || discussionFilters.pelajaran
                                    ? 'Tidak ada pertanyaan yang sesuai dengan filter yang dipilih.'
                                    : 'Jadilah yang pertama mengajukan pertanyaan atau memulai diskusi!'}
                            </p>
                            {(discussionFilters.search || discussionFilters.bagian || discussionFilters.pelajaran || (discussionFilters.tab && discussionFilters.tab !== 'all')) && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-teal mt-2"
                                    onClick={() => setDiscussionFilters({ search: '', bagian: null, pelajaran: null, tab: 'all', sort: 'newest' })}
                                >
                                    <i className="fas fa-undo me-1"></i>Reset Filter
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Fullscreen Lightbox Modal for Attachment Images */}
            <QAImageLightboxModal
                show={lightboxImage.show}
                onHide={() => setLightboxImage({ show: false, url: '', name: '' })}
                imageUrl={lightboxImage.url}
                imageName={lightboxImage.name}
            />
        </div>
    );
};

export default React.memo(DiscussionTab);
