import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/id";

import BaseHeader from "../partials/BaseHeader";
import BaseFooter from "../partials/BaseFooter";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";
import { DPDRIRoleBadges } from "../../components/CourseDetail/DiscussionTab";
import {
    stripMarkdown,
    QAMarkdownRenderer,
    QAFormattingToolbar,
} from "../../components/CourseDetail/QAMarkdownTools";
import {
    QAAttachmentInputPreview,
    QAAttachmentDisplay,
    QAImageLightboxModal,
} from "../../components/CourseDetail/QAAttachmentTools";
import {
    validateQAFile,
    compressImageFile,
} from "../../utils/qaCompression";

import "./Forum.css";

dayjs.extend(relativeTime);
dayjs.locale("id");

const extractList = (data) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
};

// Robust avatar resolver for real user profile images and high-fidelity fallback
const getUserAvatarUrl = (profile, fullName = "ASN") => {
    const rawImage = profile?.image;
    if (rawImage && typeof rawImage === 'string') {
        const trimmed = rawImage.trim();
        if (trimmed && !["default.jpg", "default-user.jpg", "placeholder.jpg", "null", "undefined"].includes(trimmed)) {
            if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
                return trimmed;
            }
            if (trimmed.startsWith("/media/")) {
                return trimmed;
            }
            if (trimmed.startsWith("user_profile_images/")) {
                return `/media/${trimmed}`;
            }
            return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
        }
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || "ASN")}&size=96&background=0f766e&color=ffffff&bold=true`;
};

// Author verification role badge renderer
const renderAuthorBadges = (profile) => {
    if (!profile) return null;
    const badges = [];

    if (profile.is_staff || profile.role_badges?.some((b) => b.key === "admin")) {
        badges.push(
            <span key="admin" className="author-verified-badge admin" title="Administrator Sistem">
                <i className="fas fa-shield-halved"></i>
                <span>Admin</span>
            </span>
        );
    }

    if (profile.is_instructor || profile.role_badges?.some((b) => b.key === "instructor")) {
        badges.push(
            <span key="instructor" className="author-verified-badge instructor" title="Instruktur / Widyaiswara Terverifikasi">
                <i className="fas fa-chalkboard-user"></i>
                <span>Instruktur</span>
            </span>
        );
    }

    if (profile.is_internal || profile.role_badges?.some((b) => b.key === "internal")) {
        badges.push(
            <span key="internal" className="author-verified-badge internal" title="Pegawai Sekretariat Jenderal DPD RI">
                <i className="fas fa-building-columns"></i>
                <span>Setjen DPD RI</span>
            </span>
        );
    } else if (profile.user_type === "ASN" || profile.role_badges?.some((b) => b.key === "asn")) {
        badges.push(
            <span key="asn" className="author-verified-badge asn" title="ASN Mitra Kerja / Instansi Lain">
                <i className="fas fa-id-badge"></i>
                <span>ASN</span>
            </span>
        );
    }

    return badges.length > 0 ? <div className="author-badges-wrap">{badges}</div> : null;
};

// Inline markdown formatting helper
const parseInlineFormatting = (text) => {
    if (!text) return "";
    const parts = [];
    const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }
        const m = match[0];
        if (m.startsWith("**") && m.endsWith("**")) {
            parts.push(<strong key={match.index}>{m.slice(2, -2)}</strong>);
        } else if (m.startsWith("`") && m.endsWith("`")) {
            parts.push(<code key={match.index} className="reply-code-inline">{m.slice(1, -1)}</code>);
        } else if (m.startsWith("*") && m.endsWith("*")) {
            parts.push(<em key={match.index}>{m.slice(1, -1)}</em>);
        } else if (m.startsWith("[")) {
            const linkMatch = m.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (linkMatch) {
                parts.push(
                    <a key={match.index} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="reply-inline-link">
                        {linkMatch[1]} <i className="fas fa-arrow-up-right-from-square small ms-1"></i>
                    </a>
                );
            }
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? parts : text;
};

// Formatted content renderer for topics and replies
const renderFormattedContent = (content) => {
    if (!content) return null;
    const lines = content.split("\n");
    const elements = [];
    let inList = false;
    let listItems = [];
    let inQuote = false;
    let quoteLines = [];

    const flushList = () => {
        if (inList && listItems.length > 0) {
            elements.push(
                <ul key={`ul-${elements.length}`} className="reply-formatted-list">
                    {listItems.map((item, idx) => (
                        <li key={idx}>{parseInlineFormatting(item)}</li>
                    ))}
                </ul>
            );
            listItems = [];
            inList = false;
        }
    };

    const flushQuote = () => {
        if (inQuote && quoteLines.length > 0) {
            // Check if first line has an author header format: e.g. "@Author Name:" or "**@Author Name:**"
            let author = null;
            let bodyLines = [...quoteLines];
            const firstLine = bodyLines[0]?.trim() || "";

            const authorMatch = firstLine.match(/^(\*\*)?@([^:*]+):?(\*\*)?$/);
            if (authorMatch) {
                author = authorMatch[2].trim();
                bodyLines = bodyLines.slice(1);
            }

            elements.push(
                <blockquote key={`quote-${elements.length}`} className="reply-formatted-quote">
                    {author ? (
                        <div className="quote-header">
                            <i className="fas fa-quote-left quote-icon"></i>
                            <span className="quote-author-badge">@{author}</span>
                            <span className="quote-author-label">menulis:</span>
                        </div>
                    ) : (
                        <div className="quote-header simple">
                            <i className="fas fa-quote-left quote-icon opacity-75"></i>
                            <span className="quote-author-label">Kutipan:</span>
                        </div>
                    )}
                    <div className="quote-content">
                        {bodyLines.map((bLine, bIdx) => (
                            <div key={bIdx} className="quote-content-line">
                                {parseInlineFormatting(bLine)}
                            </div>
                        ))}
                    </div>
                </blockquote>
            );
            quoteLines = [];
            inQuote = false;
        }
    };

    lines.forEach((line, idx) => {
        const trimmed = line.trim();

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            flushQuote();
            inList = true;
            listItems.push(trimmed.substring(2));
        } else if (trimmed.startsWith(">")) {
            flushList();
            inQuote = true;
            const cleanedQuoteLine = trimmed.replace(/^>\s?/, "");
            quoteLines.push(cleanedQuoteLine);
        } else {
            flushList();
            flushQuote();
            if (trimmed === "") {
                elements.push(<div key={`br-${idx}`} className="reply-line-break"></div>);
            } else {
                elements.push(
                    <p key={`p-${idx}`} className="reply-formatted-p">
                        {parseInlineFormatting(line)}
                    </p>
                );
            }
        }
    });

    flushList();
    flushQuote();

    return elements;
};

function Forum() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const userData = UserData();
    const replyTextareaRef = useRef(null);

    // Current user profile & internal employee detection
    const [currentUserProfile, setCurrentUserProfile] = useState(null);

    useEffect(() => {
        if (!userData?.user_id) return;
        useAxios.get(`user/profile/${userData.user_id}/`)
            .then((res) => setCurrentUserProfile(res.data))
            .catch(() => {});
    }, [userData?.user_id]);

    const isInternalSetjen = useMemo(() => {
        if (!userData) return false;
        return Boolean(
            currentUserProfile?.user?.is_internal ||
            currentUserProfile?.is_internal ||
            currentUserProfile?.user_type === "INTERNAL" ||
            currentUserProfile?.user?.user_type === "INTERNAL" ||
            currentUserProfile?.organization_unit ||
            currentUserProfile?.organization_unit_name ||
            currentUserProfile?.user?.email?.toLowerCase()?.endsWith("@dpd.go.id") ||
            userData?.is_staff ||
            userData?.role === "admin"
        );
    }, [userData, currentUserProfile]);

    // Admin Detection: In Learning Forum, only regular participants and Admin exist.
    // Instructors only have elevated roles in Course Discussions that they teach.
    const isAdmin = useMemo(() => {
        if (!userData) return false;
        return Boolean(
            userData.role === "admin" ||
            userData.current_role === "admin" ||
            userData.is_admin ||
            userData.is_staff ||
            userData.is_superuser ||
            currentUserProfile?.role === "admin" ||
            currentUserProfile?.is_admin ||
            currentUserProfile?.is_super_admin
        );
    }, [userData, currentUserProfile]);

    // -------------------------------------------------------------------------
    // State: Tabs & Filters
    // -------------------------------------------------------------------------
    const [activeTab, setActiveTab] = useState("learning-forum"); // 'learning-forum' | 'course-discussions' | 'my-discussions'
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'solved' | 'unanswered' | 'pinned' | 'bookmarked' | 'internal'
    const [sortBy, setSortBy] = useState("newest"); // 'newest' | 'popular' | 'active'

    // -------------------------------------------------------------------------
    // State: Data Storage
    // -------------------------------------------------------------------------
    const [categories, setCategories] = useState([]);
    const [topics, setTopics] = useState([]);
    const [courseDiscussions, setCourseDiscussions] = useState([]);
    const [enrolledCourses, setEnrolledCourses] = useState([]);
    const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");
    const [leaderboard, setLeaderboard] = useState([]);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(true);

    // -------------------------------------------------------------------------
    // State: UI & In-Place Thread Views
    // -------------------------------------------------------------------------
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [viewingTopic, setViewingTopic] = useState(null); // In-place active topic thread
    const [viewingCourseQA, setViewingCourseQA] = useState(null); // In-place active course QA
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activePreviewImage, setActivePreviewImage] = useState(null);

    // Attachment file preview & lightbox helper
    const renderAttachmentPreview = (fileUrl, fileName) => {
        if (!fileUrl) return null;
        const name = fileName || fileUrl.split("/").pop() || "Lampiran";
        const ext = name.split(".").pop().toLowerCase();
        const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
        const isPdf = ext === "pdf";

        if (isImage) {
            return (
                <div className="attachment-image-card" onClick={() => setActivePreviewImage(fileUrl)}>
                    <img src={fileUrl} alt={name} className="attachment-image-thumb" />
                    <div className="attachment-image-overlay">
                        <i className="fas fa-magnifying-glass-plus"></i>
                        <span>Lihat Gambar Penuh</span>
                    </div>
                </div>
            );
        }

        return (
            <div className="attachment-doc-card">
                <div className="doc-icon-box">
                    {isPdf ? (
                        <i className="fas fa-file-pdf text-danger"></i>
                    ) : ["doc", "docx"].includes(ext) ? (
                        <i className="fas fa-file-word text-primary"></i>
                    ) : ["xls", "xlsx"].includes(ext) ? (
                        <i className="fas fa-file-excel text-success"></i>
                    ) : (
                        <i className="fas fa-file-lines text-teal"></i>
                    )}
                </div>
                <div className="doc-info-box">
                    <span className="doc-filename" title={name}>{name}</span>
                    <span className="doc-type-badge">{ext.toUpperCase()} Dokumen</span>
                </div>
                <div className="doc-actions-box">
                    <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-doc-action"
                        title="Buka Dokumen di Tab Baru"
                    >
                        <i className="fas fa-arrow-up-right-from-square"></i>
                        <span>Buka</span>
                    </a>
                    <a
                        href={fileUrl}
                        download={name}
                        className="btn-doc-action download"
                        title="Unduh Berkas"
                    >
                        <i className="fas fa-download"></i>
                        <span>Unduh</span>
                    </a>
                </div>
            </div>
        );
    };

    // -------------------------------------------------------------------------
    // State: Forms (Create Topic & Reply)
    // -------------------------------------------------------------------------
    const [createCategory, setCreateCategory] = useState("");
    const [createTitle, setCreateTitle] = useState("");
    const [createContent, setCreateContent] = useState("");
    const [createVisibility, setCreateVisibility] = useState("public"); // 'public' | 'internal_setjen'
    const [createFile, setCreateFile] = useState(null);
    const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);

    const [replyMessage, setReplyMessage] = useState("");
    const [replyFile, setReplyFile] = useState(null);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);

    // Edit Topic State
    const [isEditTopicModalOpen, setIsEditTopicModalOpen] = useState(false);
    const [editTopicTitle, setEditTopicTitle] = useState("");
    const [editTopicContent, setEditTopicContent] = useState("");
    const [editTopicCategory, setEditTopicCategory] = useState("");
    const [editTopicVisibility, setEditTopicVisibility] = useState("public");
    const [editTopicFile, setEditTopicFile] = useState(null);
    const [isSubmittingEditTopic, setIsSubmittingEditTopic] = useState(false);

    // Inline Edit Reply State
    const [editingReplyId, setEditingReplyId] = useState(null);
    const [editReplyMessage, setEditReplyMessage] = useState("");
    const [isSubmittingEditReply, setIsSubmittingEditReply] = useState(false);

    // Mini-Poll Create State
    const [createHasPoll, setCreateHasPoll] = useState(false);
    const [createPollQuestion, setCreatePollQuestion] = useState("");
    const [createPollOptions, setCreatePollOptions] = useState(["", ""]);

    // Polling Active State & Vote Handler
    const [selectedPollOption, setSelectedPollOption] = useState(null);
    const [isSubmittingVote, setIsSubmittingVote] = useState(false);

    // Reporting State & Modal
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportTarget, setReportTarget] = useState(null); // { topicId, messageId, isTopic }
    const [reportReason, setReportReason] = useState("inappropriate");
    const [reportDescription, setReportDescription] = useState("");
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [activeReportStatus, setActiveReportStatus] = useState(null); // Tracking / View report status
    const [isCancellingReport, setIsCancellingReport] = useState(false);
    const [courseQAReplyText, setCourseQAReplyText] = useState("");
    const [isSubmittingCourseQAReply, setIsSubmittingCourseQAReply] = useState(false);
    const [replyAttachment, setReplyAttachment] = useState(null);
    const [isCompressingReplyAttachment, setIsCompressingReplyAttachment] = useState(false);
    const [replyPreviewMode, setReplyPreviewMode] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null);
    const courseQAReplyFileInputRef = useRef(null);
    const courseQAReplyTextareaRef = useRef(null);

    // -------------------------------------------------------------------------
    // Sync with sidebar collapse state
    // -------------------------------------------------------------------------
    useEffect(() => {
        const checkCollapsed = () => {
            const sidebarEl = document.querySelector(".modern-sidebar");
            if (sidebarEl) {
                setIsCollapsed(sidebarEl.classList.contains("collapsed"));
            }
        };

        checkCollapsed();
        const observer = new MutationObserver(checkCollapsed);
        const sidebarEl = document.querySelector(".modern-sidebar");
        if (sidebarEl) {
            observer.observe(sidebarEl, { attributes: true, attributeFilter: ["class"] });
        }

        return () => observer.disconnect();
    }, []);

    // -------------------------------------------------------------------------
    // 1. Fetch Categories (Rumpun Jabatan / Kompetensi)
    // -------------------------------------------------------------------------
    const fetchCategories = useCallback(async () => {
        try {
            const res = await useAxios.get("forum/categories/");
            setCategories(extractList(res.data));
        } catch (err) {
            console.error("Error fetching forum categories:", err);
            setCategories([]);
        }
    }, []);

    // -------------------------------------------------------------------------
    // 2. Fetch Topics for Forum Pembelajaran
    // -------------------------------------------------------------------------
    const fetchTopics = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = {
                category: selectedCategory !== "all" ? selectedCategory : undefined,
                search: searchQuery.trim() || undefined,
                filter: statusFilter !== "all" ? statusFilter : undefined,
                sort: sortBy,
            };
            const res = await useAxios.get("forum/topics/", { params });
            setTopics(extractList(res.data));
        } catch (err) {
            console.error("Error fetching forum topics:", err);
            setTopics([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedCategory, searchQuery, statusFilter, sortBy]);

    // -------------------------------------------------------------------------
    // 3. Fetch Aggregated Course Discussions
    // -------------------------------------------------------------------------
    const fetchCourseDiscussions = useCallback(async () => {
        try {
            const params = {
                course_id: selectedCourseFilter !== "all" ? selectedCourseFilter : undefined,
                search: searchQuery.trim() || undefined,
                filter: statusFilter !== "all" ? statusFilter : undefined,
                sort: sortBy,
            };
            const res = await useAxios.get("student/course-discussions-all/", { params });
            setCourseDiscussions(extractList(res.data));
        } catch (err) {
            console.error("Error fetching course discussions:", err);
            setCourseDiscussions([]);
        }
    }, [selectedCourseFilter, searchQuery, statusFilter, sortBy]);

    // -------------------------------------------------------------------------
    // 4. Fetch Enrolled Courses
    // -------------------------------------------------------------------------
    const fetchEnrolledCourses = useCallback(async () => {
        if (!userData?.user_id) return;
        try {
            const res = await useAxios.get(`student/course-list/${userData.user_id}/`);
            setEnrolledCourses(extractList(res.data));
        } catch (err) {
            console.error("Error fetching enrolled courses:", err);
            setEnrolledCourses([]);
        }
    }, [userData?.user_id]);

    // -------------------------------------------------------------------------
    // 5. Fetch Forum Leaderboard (Top Contributors & Solvers)
    // -------------------------------------------------------------------------
    const fetchLeaderboard = useCallback(async () => {
        try {
            const res = await useAxios.get("forum/leaderboard/");
            setLeaderboard(extractList(res.data));
        } catch (err) {
            console.error("Error fetching forum leaderboard:", err);
            setLeaderboard([]);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
        fetchEnrolledCourses();
        fetchLeaderboard();
    }, [fetchCategories, fetchEnrolledCourses, fetchLeaderboard]);

    useEffect(() => {
        if (activeTab === "learning-forum" || activeTab === "my-discussions") {
            fetchTopics();
        }
        if (activeTab === "course-discussions" || activeTab === "my-discussions") {
            fetchCourseDiscussions();
        }
    }, [activeTab, fetchTopics, fetchCourseDiscussions]);

    // Switch tab handler - clears active in-place views
    const handleSwitchTab = (tab) => {
        setActiveTab(tab);
        setViewingTopic(null);
        setViewingCourseQA(null);
    };

    // Category chip click handler - clears active in-place views
    const handleSelectCategory = (catSlug) => {
        setSelectedCategory(catSlug);
        setViewingTopic(null);
        setViewingCourseQA(null);
    };

    // -------------------------------------------------------------------------
    // Safe Arrays Memos (Guarantees .map, .filter, .length never throw)
    // -------------------------------------------------------------------------
    const safeCategories = useMemo(() => extractList(categories), [categories]);
    const safeTopics = useMemo(() => extractList(topics), [topics]);
    const safeCourseDiscussions = useMemo(() => extractList(courseDiscussions), [courseDiscussions]);
    const safeEnrolledCourses = useMemo(() => extractList(enrolledCourses), [enrolledCourses]);

    // -------------------------------------------------------------------------
    // Create New Topic Handler
    // -------------------------------------------------------------------------
    const handleOpenCreateModal = () => {
        setCreateCategory(safeCategories[0]?.id || "");
        setCreateTitle("");
        setCreateContent("");
        setCreateFile(null);
        setCreateHasPoll(false);
        setCreatePollQuestion("");
        setCreatePollOptions(["", ""]);
        setIsCreateModalOpen(true);
    };

    const handleCreateTopicSubmit = async (e) => {
        e.preventDefault();
        if (!createTitle.trim()) {
            Toast().fire({ icon: "warning", title: "Silakan masukkan judul topik" });
            return;
        }
        if (!createContent.trim()) {
            Toast().fire({ icon: "warning", title: "Silakan masukkan isi diskusi" });
            return;
        }
        if (!createCategory) {
            Toast().fire({ icon: "warning", title: "Silakan pilih rumpun/kategori" });
            return;
        }

        if (createHasPoll) {
            if (!createPollQuestion.trim()) {
                Toast().fire({ icon: "warning", title: "Silakan masukkan pertanyaan polling" });
                return;
            }
            const validOptions = createPollOptions.filter((o) => o.trim().length > 0);
            if (validOptions.length < 2) {
                Toast().fire({ icon: "warning", title: "Polling membutuhkan minimal 2 pilihan opsi" });
                return;
            }
        }

        setIsSubmittingTopic(true);
        try {
            const formData = new FormData();
            formData.append("category", createCategory);
            formData.append("title", createTitle.trim());
            formData.append("content", createContent.trim());
            formData.append("visibility", createVisibility);
            if (createFile) {
                formData.append("file", createFile);
                formData.append("file_name", createFile.name);
            }
            if (createHasPoll) {
                formData.append("poll_question", createPollQuestion.trim());
                const validOptions = createPollOptions.filter((o) => o.trim().length > 0);
                formData.append("poll_options", JSON.stringify(validOptions));
            }

            const res = await useAxios.post("forum/topics/", formData);
            Toast().fire({ icon: "success", title: "Topik diskusi berhasil diterbitkan!" });

            setCreateTitle("");
            setCreateContent("");
            setCreateFile(null);
            setCreateVisibility("public");
            setCreateHasPoll(false);
            setCreatePollQuestion("");
            setCreatePollOptions(["", ""]);
            setIsCreateModalOpen(false);

            setTopics((prev) => [res.data, ...prev]);
            setActiveTab("learning-forum");
            // Automatically open newly created topic in-place
            setViewingTopic(res.data);
            setViewingCourseQA(null);
        } catch (err) {
            console.error("Error creating topic:", err);
            Toast().fire({ icon: "error", title: err.response?.data?.error || "Gagal menerbitkan topik" });
        } finally {
            setIsSubmittingTopic(false);
        }
    };

    // Mini-Poll Vote Handler
    const handleVotePoll = async (pollId, optionId) => {
        if (!userData?.user_id) {
            Toast().fire({ icon: "warning", title: "Silakan masuk (login) untuk memberikan suara" });
            return;
        }
        if (!optionId) {
            Toast().fire({ icon: "warning", title: "Pilih salah satu opsi jawaban" });
            return;
        }

        setIsSubmittingVote(true);
        try {
            const res = await useAxios.post(`forum/polls/${pollId}/vote/`, {
                option_id: optionId,
            });
            Toast().fire({ icon: "success", title: res.data.message || "Suara Anda berhasil dicatat!" });
            if (viewingTopic) {
                setViewingTopic((prev) => ({
                    ...prev,
                    poll: res.data.poll,
                }));
            }
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: err.response?.data?.error || "Gagal mencatat suara voting",
            });
        } finally {
            setIsSubmittingVote(false);
        }
    };

    // Toggle Close Mini-Poll
    const handleToggleClosePoll = async (pollId) => {
        try {
            const res = await useAxios.post(`forum/polls/${pollId}/toggle-close/`);
            Toast().fire({ icon: "success", title: res.data.message });
            if (viewingTopic && viewingTopic.poll) {
                setViewingTopic((prev) => ({
                    ...prev,
                    poll: {
                        ...prev.poll,
                        is_closed: res.data.is_closed,
                    },
                }));
            }
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: err.response?.data?.error || "Gagal memperbarui status polling",
            });
        }
    };

    // Report Content Modal & Submit Handler
    const handleOpenReportModal = (target) => {
        if (!userData?.user_id) {
            Toast().fire({ icon: "warning", title: "Silakan masuk untuk melaporkan konten" });
            return;
        }
        setReportTarget(target);
        setReportReason("inappropriate");
        setReportDescription("");
        setIsReportModalOpen(true);
    };

    const handleViewReportStatus = (reportData, contextInfo = {}) => {
        setActiveReportStatus({ ...reportData, ...contextInfo });
    };

    const handleSubmitReport = async (e) => {
        e.preventDefault();
        if (!reportTarget) return;

        setIsSubmittingReport(true);
        try {
            const payload = {
                reason: reportReason,
                description: reportDescription.trim(),
            };
            if (reportTarget.isTopic) {
                payload.topic_id = reportTarget.topicId;
            } else {
                payload.message_id = reportTarget.messageId;
            }

            const res = await useAxios.post("forum/reports/", payload);
            if (res.data?.already_reported) {
                Toast().fire({
                    icon: "info",
                    title: "Laporan Sedang Ditinjau",
                    text: res.data.message || "Laporan Anda sudah terdaftar dan sedang diproses oleh Admin.",
                });
            } else {
                Toast().fire({
                    icon: "success",
                    title: res.data.message || "Laporan Anda berhasil dikirim",
                });
            }

            const updatedReport = res.data?.report || {
                reason: reportReason,
                reason_display: reportReason === "inappropriate" ? "Bahasa Tidak Pantas / Pelanggaran Etika ASN" : reportReason,
                description: reportDescription.trim(),
                status: "pending",
                status_display: "Menunggu Tinjauan",
                created_at: new Date().toISOString(),
            };

            if (reportTarget.isTopic) {
                setViewingTopic((prev) => (prev ? { ...prev, user_report: updatedReport } : prev));
                setForumTopics((prev) =>
                    prev.map((t) => (t.topic_id === reportTarget.topicId || t.id === reportTarget.topicId ? { ...t, user_report: updatedReport } : t))
                );
            } else {
                setViewingTopic((prev) =>
                    prev
                        ? {
                              ...prev,
                              replies: (prev.replies || []).map((r) =>
                                  r.id === reportTarget.messageId || r.message_id === reportTarget.messageId
                                      ? { ...r, user_report: updatedReport }
                                      : r
                              ),
                          }
                        : prev
                );
            }

            setIsReportModalOpen(false);
            setReportTarget(null);
            setReportDescription("");
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: err.response?.data?.error || "Gagal mengirimkan laporan",
            });
        } finally {
            setIsSubmittingReport(false);
        }
    };

    const handleCancelReport = async (reportId) => {
        const confirm = await Swal.fire({
            title: "Batalkan Laporan Ini?",
            text: "Aduan Anda akan ditarik dari antrean peninjauan Administrator.",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Batalkan Laporan",
            cancelButtonText: "Kembali",
        });
        if (!confirm.isConfirmed) return;

        setIsCancellingReport(true);
        try {
            await useAxios.post(`forum/reports/${reportId}/cancel/`);
            Toast().fire({
                icon: "success",
                title: "Laporan Dibatalkan",
                text: "Aduan Anda telah ditarik dari antrean moderasi.",
            });

            if (activeReportStatus?.isTopic) {
                setViewingTopic((prev) => (prev ? { ...prev, user_report: null } : prev));
                setForumTopics((prev) =>
                    prev.map((t) => (t.id === viewingTopic?.id ? { ...t, user_report: null } : t))
                );
            } else if (activeReportStatus?.replyId) {
                setViewingTopic((prev) =>
                    prev
                        ? {
                              ...prev,
                              replies: (prev.replies || []).map((r) =>
                                  r.id === activeReportStatus.replyId || r.message_id === activeReportStatus.replyId
                                      ? { ...r, user_report: null }
                                      : r
                              ),
                          }
                        : prev
                );
            }
            setActiveReportStatus(null);
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: err.response?.data?.error || "Gagal membatalkan laporan",
            });
        } finally {
            setIsCancellingReport(false);
        }
    };

    // -------------------------------------------------------------------------
    // Open In-Place Topic Details & Thread
    // -------------------------------------------------------------------------
    const handleOpenTopic = async (topic) => {
        setViewingTopic(topic);
        setViewingCourseQA(null);
        setSearchParams({ topic: topic.topic_id });
        window.scrollTo({ top: 120, behavior: "smooth" });
        try {
            const res = await useAxios.get(`forum/topics/${topic.topic_id}/`);
            setViewingTopic(res.data);
        } catch (err) {
            console.error("Error fetching topic detail:", err);
        }
    };

    const handleBackToTopicList = () => {
        setViewingTopic(null);
        setSearchParams({});
    };

    // Deep-link direct URL handling: ?topic=<topic_id>
    useEffect(() => {
        const topicParam = searchParams.get("topic");
        if (topicParam && (!viewingTopic || viewingTopic.topic_id !== topicParam)) {
            useAxios.get(`forum/topics/${topicParam}/`)
                .then((res) => {
                    setViewingTopic(res.data);
                    setActiveTab("learning-forum");
                })
                .catch((err) => {
                    console.error("Gagal membuka topik dari URL deep-link:", err);
                });
        }
    }, [searchParams]);

    // Fallback clipboard copy
    const fallbackCopyText = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand("copy");
            Toast().fire({
                icon: "success",
                title: "Tautan topik berhasil disalin ke clipboard!",
            });
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: "Gagal menyalin tautan",
            });
        }
        document.body.removeChild(textArea);
    };

    const handleCopyTopicLink = (topicId) => {
        const link = `${window.location.origin}/student/forum/?topic=${topicId}`;
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(link)
                .then(() => {
                    Toast().fire({
                        icon: "success",
                        title: "Tautan topik berhasil disalin ke clipboard!",
                    });
                })
                .catch(() => fallbackCopyText(link));
        } else {
            fallbackCopyText(link);
        }
    };

    // Keyword Highlight Helper for Search
    const renderHighlightedText = (text, query) => {
        if (!text) return "";
        if (!query || !query.trim()) return text;

        const trimmedQuery = query.trim();
        const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const parts = String(text).split(new RegExp(`(${escapedQuery})`, "gi"));

        return parts.map((part, index) =>
            part.toLowerCase() === trimmedQuery.toLowerCase() ? (
                <mark key={index} className="forum-search-highlight">
                    {part}
                </mark>
            ) : (
                part
            )
        );
    };

    // Export Forum Topic to Official Notulensi Document / PDF
    const handleExportTopicPDF = (topic) => {
        if (!topic) return;

        const printWindow = window.open("", "_blank", "width=900,height=800");
        if (!printWindow) {
            Toast().fire({
                icon: "warning",
                title: "Izinkan pop-up peramban untuk mencetak/mengunduh dokumen notulensi.",
            });
            return;
        }

        const topicId = topic.topic_id || "-";
        const title = topic.title || "Topik Diskusi";
        const categoryName = topic.category_detail?.name || "Rumpun Umum";
        const authorName = topic.profile?.full_name || topic.user?.full_name || "Pegawai Setjen DPD RI";
        const authorDept = topic.profile?.position_name || topic.profile?.organization_unit_name || "Sekretariat Jenderal DPD RI";
        const createdAt = dayjs(topic.created_at).format("DD MMMM YYYY, HH:mm [WIB]");
        const statusText = topic.is_solved ? "TERPECAHKAN (SOLUSI TERVERIFIKASI)" : (topic.is_locked ? "DISKUSI DITUTUP" : "AKTIF / TERBUKA");

        const solutionReply = (topic.replies || []).find((r) => r.is_solution);
        const otherReplies = (topic.replies || []).filter((r) => !r.is_solution);

        const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Notulensi Diskusi - #${topicId}</title>
    <style>
        @page {
            size: A4;
            margin: 18mm 15mm 18mm 15mm;
        }
        * {
            box-sizing: border-box;
            font-family: 'Times New Roman', Times, serif;
            color: #111827;
        }
        body {
            margin: 0;
            padding: 12px;
            background: #ffffff;
            font-size: 11pt;
            line-height: 1.5;
        }
        .header-kop {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 3px;
        }
        .header-kop-line2 {
            border-bottom: 1px solid #000;
            margin-bottom: 16px;
        }
        .kop-instansi {
            font-size: 13pt;
            font-weight: bold;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            margin: 0;
        }
        .kop-sub {
            font-size: 10.5pt;
            font-weight: bold;
            letter-spacing: 0.02em;
            margin: 3px 0 0 0;
        }
        .kop-alamat {
            font-size: 8.5pt;
            margin: 3px 0 0 0;
            color: #4b5563;
        }
        .doc-title {
            text-align: center;
            font-size: 12pt;
            font-weight: bold;
            text-decoration: underline;
            text-transform: uppercase;
            margin: 14px 0 4px 0;
        }
        .doc-num {
            text-align: center;
            font-size: 9.5pt;
            color: #374151;
            margin-bottom: 16px;
        }
        .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 10pt;
        }
        .meta-table td {
            padding: 4px 6px;
            vertical-align: top;
        }
        .meta-table td.label {
            width: 28%;
            font-weight: bold;
            color: #1f2937;
        }
        .meta-table td.colon {
            width: 2%;
        }
        .meta-table td.val {
            width: 70%;
        }
        .status-badge {
            display: inline-block;
            font-size: 8.5pt;
            font-weight: bold;
            padding: 2px 7px;
            border-radius: 3px;
            border: 1px solid #000;
        }
        .section-box {
            margin-bottom: 16px;
        }
        .section-title {
            font-size: 10.5pt;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 4px;
            margin-bottom: 8px;
            color: #111827;
        }
        .content-box {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 10px 14px;
            white-space: pre-wrap;
            font-size: 10pt;
            line-height: 1.6;
        }
        .solution-box {
            background: #f0fdf4;
            border: 1.5px solid #16a34a;
            border-radius: 5px;
            padding: 12px 14px;
            margin-bottom: 16px;
        }
        .solution-badge {
            display: inline-block;
            background: #16a34a;
            color: #ffffff;
            font-size: 8.5pt;
            font-weight: bold;
            padding: 2px 8px;
            border-radius: 3px;
            margin-bottom: 6px;
        }
        .solution-meta {
            font-size: 9pt;
            color: #15803d;
            font-weight: bold;
            margin-bottom: 6px;
        }
        .reply-card {
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 8px 12px;
            margin-bottom: 8px;
            page-break-inside: avoid;
        }
        .reply-author {
            font-size: 9.5pt;
            font-weight: bold;
            color: #1f2937;
        }
        .reply-meta {
            font-size: 8.5pt;
            color: #6b7280;
            margin-bottom: 4px;
        }
        .reply-text {
            font-size: 9.5pt;
            line-height: 1.5;
            white-space: pre-wrap;
        }
        .footer-note {
            margin-top: 24px;
            border-top: 1px dashed #9ca3af;
            padding-top: 8px;
            font-size: 8pt;
            color: #6b7280;
            display: flex;
            justify-content: space-between;
        }
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 12px; text-align: right;">
        <button onclick="window.print()" style="padding: 6px 14px; background: #0f766e; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            Cetak / Simpan PDF
        </button>
    </div>

    <div class="header-kop">
        <h2 class="kop-instansi">SEKRETARIAT JENDERAL DEWAN PERWAKILAN DAERAH<br>REPUBLIK INDONESIA</h2>
        <p class="kop-sub">SISTEM INFORMASI MANAJEMEN PEMBELAJARAN (LMS DPD RI)</p>
        <p class="kop-alamat">Gedung DPD RI, Kompleks Parlemen Senayan, Jakarta Pusat 10270 • Portal Kolaborasi Kompetensi ASN</p>
    </div>
    <div class="header-kop-line2"></div>

    <h3 class="doc-title">LEMBAR NOTULENSI FORUM PEMBELAJARAN & KOMPETENSI</h3>
    <div class="doc-num">Nomor Registrasi Topik: #${topicId}</div>

    <table class="meta-table">
        <tr>
            <td class="label">Judul Topik</td>
            <td class="colon">:</td>
            <td class="val"><strong>${title}</strong></td>
        </tr>
        <tr>
            <td class="label">Rumpun Jabatan / Kompetensi</td>
            <td class="colon">:</td>
            <td class="val">${categoryName}</td>
        </tr>
        <tr>
            <td class="label">Penggagas Topik (Author)</td>
            <td class="colon">:</td>
            <td class="val">${authorName} (${authorDept})</td>
        </tr>
        <tr>
            <td class="label">Waktu Diterbitkan</td>
            <td class="colon">:</td>
            <td class="val">${createdAt}</td>
        </tr>
        <tr>
            <td class="label">Status Diskusi</td>
            <td class="colon">:</td>
            <td class="val"><span class="status-badge">${statusText}</span></td>
        </tr>
    </table>

    <div class="section-box">
        <div class="section-title">I. Pokok Pembahasan & Uraian Pertanyaan</div>
        <div class="content-box">${topic.content || "-"}</div>
    </div>

    ${solutionReply ? `
    <div class="solution-box">
        <span class="solution-badge">✓ SOLUSI TERBAIK TERVERIFIKASI</span>
        <div class="solution-meta">Oleh: ${solutionReply.profile?.full_name || 'Rekan ASN'} (${solutionReply.profile?.position_name || solutionReply.profile?.organization_unit_name || 'Setjen DPD RI'}) • ${dayjs(solutionReply.created_at).format("DD MMM YYYY, HH:mm")}</div>
        <div class="reply-text">${solutionReply.message || "-"}</div>
    </div>
    ` : ''}

    <div class="section-box">
        <div class="section-title">II. Rekapitulasi Tanggapan & Wawasan Pembelajar (${otherReplies.length})</div>
        ${otherReplies.length === 0 ? '<p style="font-size: 9pt; color: #6b7280; font-style: italic;">Tidak ada tanggapan tambahan lainnya.</p>' : ''}
        ${otherReplies.map((r, i) => `
            <div class="reply-card">
                <div class="reply-author">${i + 1}. ${r.profile?.full_name || 'Rekan ASN'}</div>
                <div class="reply-meta">${r.profile?.position_name || r.profile?.organization_unit_name || 'Setjen DPD RI'} • ${dayjs(r.created_at).format("DD MMM YYYY, HH:mm")}</div>
                <div class="reply-text">${r.message || "-"}</div>
            </div>
        `).join('')}
    </div>

    <div class="footer-note">
        <span>Dokumen ini dihasilkan secara otomatis dari Forum LMS Setjen DPD RI untuk dokumentasi pengetahuan kedinasan.</span>
        <span>Dicetak: ${dayjs().format("DD MMMM YYYY, HH:mm:ss [WIB]")}</span>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 300);
        };
    </script>
</body>
</html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleToggleTopicLike = async (topicId) => {
        try {
            const res = await useAxios.post(`forum/topics/${topicId}/like/`);
            const { liked, total_likes } = res.data;

            setTopics((prev) =>
                prev.map((t) => (t.topic_id === topicId ? { ...t, user_liked: liked, likes_count: total_likes } : t))
            );

            if (viewingTopic && viewingTopic.topic_id === topicId) {
                setViewingTopic((prev) => ({ ...prev, user_liked: liked, likes_count: total_likes }));
            }
        } catch (err) {
            console.error("Error toggling like:", err);
        }
    };

    const handleToggleTopicBookmark = async (topicId) => {
        try {
            const res = await useAxios.post(`forum/topics/${topicId}/bookmark/`);
            const { bookmarked, total_bookmarks } = res.data;

            setTopics((prev) =>
                prev.map((t) =>
                    t.topic_id === topicId
                        ? { ...t, user_bookmarked: bookmarked, bookmarks_count: total_bookmarks }
                        : t
                )
            );

            if (viewingTopic && viewingTopic.topic_id === topicId) {
                setViewingTopic((prev) => ({
                    ...prev,
                    user_bookmarked: bookmarked,
                    bookmarks_count: total_bookmarks,
                }));
            }

            Toast().fire({
                icon: "success",
                title: bookmarked ? "Topik disimpan ke favorit" : "Topik dihapus dari favorit",
            });
        } catch (err) {
            console.error("Error toggling bookmark:", err);
            Toast().fire({ icon: "error", title: "Gagal memperbarui status favorit" });
        }
    };

    const handleInsertFormat = (type) => {
        const textarea = replyTextareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = replyMessage;
        const selectedText = text.substring(start, end);

        let replacement = "";
        let cursorOffset = 0;

        switch (type) {
            case "bold":
                replacement = selectedText ? `**${selectedText}**` : "**Teks Tebal**";
                cursorOffset = selectedText ? replacement.length : 2;
                break;
            case "italic":
                replacement = selectedText ? `*${selectedText}*` : "*Teks Miring*";
                cursorOffset = selectedText ? replacement.length : 1;
                break;
            case "quote":
                replacement = selectedText ? `\n> ${selectedText}\n` : "\n> Kutipan Regulasi / Catatan:\n";
                cursorOffset = replacement.length;
                break;
            case "list":
                replacement = selectedText
                    ? selectedText.split("\n").map((line) => `- ${line}`).join("\n")
                    : "\n- Butir poin 1\n- Butir poin 2\n";
                cursorOffset = replacement.length;
                break;
            case "code":
                replacement = selectedText ? `\`${selectedText}\`` : "`Pasal / Tata Tertib`";
                cursorOffset = selectedText ? replacement.length : 1;
                break;
            case "link":
                replacement = selectedText ? `[${selectedText}](https://)` : "[Judul Tautan](https://dpd.go.id)";
                cursorOffset = replacement.length - 1;
                break;
            default:
                return;
        }

        const newText = text.substring(0, start) + replacement + text.substring(end);
        setReplyMessage(newText);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
        }, 10);
    };

    const handleToggleReplyLike = async (messageId) => {
        try {
            const res = await useAxios.post(`forum/messages/${messageId}/like/`);
            const { liked, total_likes } = res.data;

            if (viewingTopic) {
                setViewingTopic((prev) => {
                    if (!prev) return prev;
                    const updatedReplies = (prev.replies || []).map((r) =>
                        r.message_id === messageId
                            ? { ...r, user_liked: liked, likes_count: total_likes }
                            : r
                    );
                    return { ...prev, replies: updatedReplies };
                });
            }
        } catch (err) {
            console.error("Error toggling reply like:", err);
        }
    };

    const handleQuoteReply = (reply) => {
        const authorName = reply.profile?.full_name || "Rekan ASN";
        const rawMessage = reply.message || "";

        // STRIP OUT PREVIOUS QUOTES:
        // Ignore lines that start with ">" to prevent recursive nested/double quotes!
        const nonQuoteLines = rawMessage
            .split("\n")
            .filter((line) => !line.trim().startsWith(">"))
            .filter((line) => line.trim().length > 0);

        // If the reply had only quote lines, fallback to stripped content
        const linesToQuote = nonQuoteLines.length > 0
            ? nonQuoteLines
            : rawMessage.split("\n").map((l) => l.replace(/^>\s?/, "")).filter((l) => l.trim().length > 0);

        // Format as a single cohesive quote block:
        // Line 1: "> @Author Name:"
        // Following lines: "> message text"
        const formattedQuoteBlock = [
            `> @${authorName}:`,
            ...linesToQuote.slice(0, 5).map((l) => `> ${l.trim()}`),
        ].join("\n");

        const quoteText = `${formattedQuoteBlock}\n\n`;

        setReplyMessage((prev) => {
            const trimmedPrev = (prev || "").trim();
            return trimmedPrev ? `${trimmedPrev}\n\n${quoteText}` : quoteText;
        });

        setTimeout(() => {
            if (replyTextareaRef.current) {
                replyTextareaRef.current.focus();
                const len = replyTextareaRef.current.value.length;
                replyTextareaRef.current.setSelectionRange(len, len);
                replyTextareaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 50);

        Toast().fire({
            icon: "info",
            title: `Mengutip tanggapan dari ${authorName}`,
            timer: 1500,
        });
    };

    const handleSendReply = async (e) => {
        e.preventDefault();
        if (!replyMessage.trim()) return;

        setIsSubmittingReply(true);
        try {
            const formData = new FormData();
            formData.append("topic_id", viewingTopic.topic_id);
            formData.append("message", replyMessage.trim());
            if (replyFile) {
                formData.append("file", replyFile);
                formData.append("file_name", replyFile.name);
            }

            const res = await useAxios.post(`forum/topics/${viewingTopic.topic_id}/reply/`, formData);
            Toast().fire({ icon: "success", title: "Tanggapan berhasil dikirim!" });

            setReplyMessage("");
            setReplyFile(null);

            setViewingTopic((prev) => ({
                ...prev,
                replies_count: (prev.replies_count || 0) + 1,
                replies: [...(prev.replies || []), res.data],
            }));

            setTopics((prev) =>
                prev.map((t) =>
                    t.topic_id === viewingTopic.topic_id
                        ? { ...t, replies_count: (t.replies_count || 0) + 1 }
                        : t
                )
            );
        } catch (err) {
            console.error("Error sending reply:", err);
            Toast().fire({ icon: "error", title: "Gagal mengirim tanggapan" });
        } finally {
            setIsSubmittingReply(false);
        }
    };

    const handleToggleSolution = async (messageId) => {
        try {
            const res = await useAxios.post(`forum/messages/${messageId}/toggle-solution/`);
            const { is_solution, topic_is_solved } = res.data;

            setViewingTopic((prev) => ({
                ...prev,
                is_solved: topic_is_solved,
                replies: prev.replies.map((r) =>
                    r.message_id === messageId ? { ...r, is_solution } : r
                ),
            }));

            setTopics((prev) =>
                prev.map((t) =>
                    t.topic_id === viewingTopic.topic_id ? { ...t, is_solved: topic_is_solved } : t
                )
            );

            Toast().fire({
                icon: "success",
                title: is_solution ? "Jawaban ditandai sebagai Solusi Terbaik!" : "Tanda solusi dicabut",
            });
        } catch (err) {
            console.error("Error toggling solution:", err);
            Toast().fire({ icon: "error", title: err.response?.data?.error || "Gagal mengubah status solusi" });
        }
    };

    // -------------------------------------------------------------------------
    // Pin & Lock Topic Handlers (Instructors & Admins)
    // -------------------------------------------------------------------------
    const handleTogglePinTopic = async (topicId) => {
        try {
            const res = await useAxios.post(`forum/topics/${topicId}/toggle-pin/`);
            const newPinned = res.data.is_pinned;
            setTopics((prev) =>
                prev.map((t) => (t.topic_id === topicId ? { ...t, is_pinned: newPinned } : t))
            );
            if (viewingTopic && viewingTopic.topic_id === topicId) {
                setViewingTopic((prev) => ({ ...prev, is_pinned: newPinned }));
            }
            Toast().fire({
                icon: "success",
                title: res.data.message || (newPinned ? "Topik berhasil disematkan" : "Sematkan topik dibatalkan"),
            });
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: err?.response?.data?.error || "Gagal mengubah status sematan topik",
            });
        }
    };

    const handleToggleLockTopic = async (topicId) => {
        try {
            const res = await useAxios.post(`forum/topics/${topicId}/toggle-lock/`);
            const newLocked = res.data.is_locked;
            setTopics((prev) =>
                prev.map((t) => (t.topic_id === topicId ? { ...t, is_locked: newLocked } : t))
            );
            if (viewingTopic && viewingTopic.topic_id === topicId) {
                setViewingTopic((prev) => ({ ...prev, is_locked: newLocked }));
            }
            Toast().fire({
                icon: "success",
                title: res.data.message || (newLocked ? "Topik berhasil dikunci" : "Topik berhasil dibuka kembali"),
            });
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: err?.response?.data?.error || "Gagal mengubah status kunci topik",
            });
        }
    };

    // -------------------------------------------------------------------------
    // Edit & Delete Topic Handlers (Owner & Admins)
    // -------------------------------------------------------------------------
    const handleOpenEditTopic = (topic) => {
        setEditTopicTitle(topic.title || "");
        setEditTopicContent(topic.content || "");
        setEditTopicCategory(topic.category?.id || topic.category || "");
        setEditTopicVisibility(topic.visibility || "public");
        setEditTopicFile(null);
        setIsEditTopicModalOpen(true);
    };

    const handleSaveEditTopic = async (e) => {
        e.preventDefault();
        if (!viewingTopic) return;
        if (!editTopicTitle.trim()) {
            Toast().fire({ icon: "warning", title: "Judul topik tidak boleh kosong" });
            return;
        }
        if (!editTopicContent.trim()) {
            Toast().fire({ icon: "warning", title: "Konten topik tidak boleh kosong" });
            return;
        }

        try {
            setIsSubmittingEditTopic(true);
            const formData = new FormData();
            formData.append("title", editTopicTitle.trim());
            formData.append("content", editTopicContent.trim());
            if (editTopicCategory) {
                formData.append("category", editTopicCategory);
            }
            formData.append("visibility", editTopicVisibility);
            if (editTopicFile) {
                formData.append("file", editTopicFile);
                formData.append("file_name", editTopicFile.name);
            }

            const res = await useAxios.patch(`forum/topics/${viewingTopic.topic_id}/`, formData);
            const updatedTopic = res.data;
            setViewingTopic((prev) => ({
                ...prev,
                ...updatedTopic,
                replies: prev.replies || updatedTopic.replies || [],
            }));
            setTopics((prev) =>
                prev.map((t) => (t.topic_id === viewingTopic.topic_id ? { ...t, ...updatedTopic } : t))
            );
            setIsEditTopicModalOpen(false);
            Toast().fire({
                icon: "success",
                title: "Topik diskusi berhasil diperbarui!",
            });
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: err?.response?.data?.error || "Gagal memperbarui topik diskusi",
            });
        } finally {
            setIsSubmittingEditTopic(false);
        }
    };

    const handleDeleteTopic = async (topicId) => {
        const result = await Swal.fire({
            title: "Hapus Topik Diskusi?",
            text: "Topik beserta seluruh balasan di dalamnya akan dihapus secara permanen.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus Topik",
            cancelButtonText: "Batal",
            reverseButtons: true,
        });

        if (!result.isConfirmed) return;

        try {
            await useAxios.delete(`forum/topics/${topicId}/`);
            setTopics((prev) => prev.filter((t) => t.topic_id !== topicId));
            setViewingTopic(null);
            Toast().fire({
                icon: "success",
                title: "Topik diskusi berhasil dihapus",
            });
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: err?.response?.data?.error || "Gagal menghapus topik diskusi",
            });
        }
    };

    // -------------------------------------------------------------------------
    // Edit & Delete Reply Handlers (Owner & Admins)
    // -------------------------------------------------------------------------
    const handleStartEditReply = (reply) => {
        setEditingReplyId(reply.message_id || reply.id);
        setEditReplyMessage(reply.message || "");
    };

    const handleCancelEditReply = () => {
        setEditingReplyId(null);
        setEditReplyMessage("");
    };

    const handleSaveEditReply = async (messageId) => {
        if (!editReplyMessage.trim()) {
            Toast().fire({ icon: "warning", title: "Pesan balasan tidak boleh kosong" });
            return;
        }
        try {
            setIsSubmittingEditReply(true);
            const res = await useAxios.patch(`forum/messages/${messageId}/`, {
                message: editReplyMessage.trim(),
            });
            const updatedReply = res.data;
            if (viewingTopic) {
                setViewingTopic((prev) => ({
                    ...prev,
                    replies: (prev.replies || []).map((r) =>
                        r.message_id === messageId || r.id === messageId
                            ? { ...r, ...updatedReply, message: updatedReply.message }
                            : r
                    ),
                }));
            }
            setEditingReplyId(null);
            setEditReplyMessage("");
            Toast().fire({
                icon: "success",
                title: "Tanggapan berhasil diperbarui!",
            });
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: err?.response?.data?.error || "Gagal memperbarui tanggapan",
            });
        } finally {
            setIsSubmittingEditReply(false);
        }
    };

    const handleDeleteReply = async (messageId) => {
        const result = await Swal.fire({
            title: "Hapus Tanggapan?",
            text: "Tanggapan ini akan dihapus secara permanen.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus",
            cancelButtonText: "Batal",
            reverseButtons: true,
        });

        if (!result.isConfirmed) return;

        try {
            await useAxios.delete(`forum/messages/${messageId}/`);
            if (viewingTopic) {
                const updatedReplies = (viewingTopic.replies || []).filter(
                    (r) => r.message_id !== messageId && r.id !== messageId
                );
                const stillHasSolution = updatedReplies.some((r) => r.is_solution);
                setViewingTopic((prev) => ({
                    ...prev,
                    replies: updatedReplies,
                    is_solved: stillHasSolution,
                    replies_count: Math.max(0, (prev.replies_count || 1) - 1),
                }));
                setTopics((prev) =>
                    prev.map((t) =>
                        t.topic_id === viewingTopic.topic_id
                            ? {
                                  ...t,
                                  replies_count: Math.max(0, (t.replies_count || 1) - 1),
                                  is_solved: stillHasSolution,
                              }
                            : t
                    )
                );
            }
            Toast().fire({
                icon: "success",
                title: "Tanggapan berhasil dihapus",
            });
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: err?.response?.data?.error || "Gagal menghapus tanggapan",
            });
        }
    };

    // -------------------------------------------------------------------------
    // Open In-Place Course QA Details & Navigation
    // -------------------------------------------------------------------------
    const handleOpenCourseQA = (qa) => {
        setViewingCourseQA(qa);
        setViewingTopic(null);
        window.scrollTo({ top: 120, behavior: "smooth" });
    };

    // Helper to navigate to Course or Enrolled Course Classroom
    const handleNavigateToCourse = (qa, e) => {
        if (e) e.stopPropagation();
        const enrollmentId = qa.enrollment_id;
        const qaId = qa.qa_id || qa.id;
        if (enrollmentId) {
            navigate(`/student/courses/${enrollmentId}/?tab=discussions&qa_id=${qaId}`);
        } else if (qa.course_slug) {
            navigate(`/course-detail/${qa.course_slug}/`);
        } else {
            navigate(`/student/courses/${qa.course_pk || qa.course}/`);
        }
    };

    // Toggle Like for Course QA
    const handleToggleCourseQALike = async (qa, e) => {
        if (e) e.stopPropagation();
        if (!qa) return;
        const qaId = qa.qa_id || qa.id;
        const courseId = qa.course_pk || qa.course;
        const userId = userData?.user_id;
        try {
            const res = await useAxios.post(`student/question-answer-like/${qaId}/`, {
                user_id: userId,
                course_id: courseId,
            });
            const updatedLikes = res.data?.likes_count ?? ((qa.likes_count || 0) + (res.data?.liked ? 1 : -1));
            const updatedLiked = res.data?.liked ?? !qa.user_liked;
            
            setCourseDiscussions(prev => prev.map(item => {
                if ((item.qa_id || item.id) === qaId) {
                    return { ...item, likes_count: updatedLikes, user_liked: updatedLiked };
                }
                return item;
            }));
            if (viewingCourseQA && (viewingCourseQA.qa_id || viewingCourseQA.id) === qaId) {
                setViewingCourseQA(prev => ({
                    ...prev,
                    likes_count: updatedLikes,
                    user_liked: updatedLiked,
                }));
            }
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui suka",
            });
        }
    };

    // Handle Reply File Upload & Compression
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
            const processedFile = await compressImageFile(file);
            setReplyAttachment(processedFile);
        } catch (err) {
            setReplyAttachment(file);
        } finally {
            setIsCompressingReplyAttachment(false);
            e.target.value = "";
        }
    };

    // Handle Direct Clipboard Screenshot Paste (Ctrl+V)
    const handleReplyPasteImage = async (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    try {
                        setIsCompressingReplyAttachment(true);
                        const processed = await compressImageFile(file);
                        setReplyAttachment(processed);
                        Toast().fire({ icon: "success", title: "Gambar dari clipboard berhasil dilampirkan!" });
                    } catch {
                        setReplyAttachment(file);
                    } finally {
                        setIsCompressingReplyAttachment(false);
                    }
                    break;
                }
            }
        }
    };

    // Send New Reply for Course QA
    const handleSendCourseQAReply = async (e) => {
        e?.preventDefault();
        if (!viewingCourseQA) return;
        if (!courseQAReplyText.trim() && !replyAttachment) {
            Toast().fire({
                icon: "warning",
                title: "Tuliskan tanggapan atau sertakan lampiran terlebih dahulu",
            });
            return;
        }
        const qaId = viewingCourseQA.qa_id || viewingCourseQA.id;
        const courseId = viewingCourseQA.course_pk || viewingCourseQA.course;
        const userId = userData?.user_id;

        try {
            setIsSubmittingCourseQAReply(true);
            const formdata = new FormData();
            formdata.append("course_id", courseId);
            formdata.append("user_id", userId);
            formdata.append("message", courseQAReplyText.trim());
            formdata.append("qa_id", qaId);

            if (replyAttachment) {
                formdata.append("file", replyAttachment);
                formdata.append("file_name", replyAttachment.name);
            }

            const res = await useAxios.post("student/question-answer-message-create/", formdata);
            if (res.data?.question) {
                const updatedQA = res.data.question;
                setViewingCourseQA(updatedQA);
                setCourseDiscussions(prev => prev.map(item => {
                    if ((item.qa_id || item.id) === qaId) {
                        return {
                            ...item,
                            ...updatedQA,
                            replies_count: Math.max(0, (updatedQA.messages?.length || 1) - 1),
                        };
                    }
                    return item;
                }));
            } else {
                const newMsg = {
                    id: Date.now(),
                    message: courseQAReplyText.trim(),
                    date: new Date().toISOString(),
                    file: replyAttachment ? URL.createObjectURL(replyAttachment) : null,
                    file_name: replyAttachment ? replyAttachment.name : null,
                    profile: {
                        full_name: userData?.full_name || "Anda",
                        image: userData?.image || null,
                        is_staff: Boolean(userData?.is_staff),
                        position_name: userData?.position_name || null,
                        organization_unit_name: userData?.organization_unit_name || null,
                    },
                    user_id: userId,
                };
                setViewingCourseQA(prev => ({
                    ...prev,
                    messages: [...(prev.messages || []), newMsg],
                }));
                setCourseDiscussions(prev => prev.map(item => {
                    if ((item.qa_id || item.id) === qaId) {
                        return {
                            ...item,
                            messages: [...(item.messages || []), newMsg],
                            replies_count: (item.replies_count || 0) + 1,
                        };
                    }
                    return item;
                }));
            }
            setCourseQAReplyText("");
            setReplyAttachment(null);
            setReplyPreviewMode(false);
            Toast().fire({
                icon: "success",
                title: "Tanggapan diskusi kursus berhasil dikirim!",
            });
        } catch (err) {
            Toast().fire({
                icon: "error",
                title: err?.response?.data?.error || "Gagal mengirim tanggapan",
            });
        } finally {
            setIsSubmittingCourseQAReply(false);
        }
    };

    // Filtered data for "Diskusi Saya" tab
    const myTopics = useMemo(() => {
        if (!userData?.user_id) return [];
        return safeTopics.filter(
            (t) =>
                t.user_id === userData.user_id ||
                t.user?.id === userData.user_id ||
                t.replies?.some((r) => r.user_id === userData.user_id)
        );
    }, [safeTopics, userData?.user_id]);

    const myCourseDiscussions = useMemo(() => {
        if (!userData?.user_id) return [];
        return safeCourseDiscussions.filter(
            (cd) =>
                cd.user_id === userData.user_id ||
                cd.user?.id === userData.user_id ||
                cd.messages?.some((m) => m.user_id === userData.user_id)
        );
    }, [safeCourseDiscussions, userData?.user_id]);

    // High-Density Stats Calculation
    const forumStats = useMemo(() => {
        const solvedCount =
            safeTopics.filter((t) => t.is_solved).length +
            safeCourseDiscussions.filter((c) => c.is_solved).length;
        return {
            learningTopics: safeTopics.length,
            courseDiscussions: safeCourseDiscussions.length,
            solved: solvedCount,
        };
    }, [safeTopics, safeCourseDiscussions]);

    return (
        <>
            <BaseHeader />

            <section className="modern-forum-page">
                <div className="container">
                    <Header />

                    <div className="row mt-0">
                        <Sidebar />

                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* =========================================================================
                                1. ULTRA-COMPACT EXECUTIVE HERO SECTION (Slim, High-Density Banner)
                                ========================================================================= */}
                            <div className="forum-hero-card">
                                <div className="forum-hero-accent-shape"></div>
                                <div className="forum-hero-left">
                                    <div className="forum-hero-badge">
                                        <i className="fas fa-landmark text-amber"></i>
                                        <span>Setjen DPD RI • Forum Diskusi & Pembelajaran</span>
                                    </div>
                                    <div className="forum-hero-title-row">
                                        <div className="forum-hero-icon-box">
                                            <i className="fas fa-comments"></i>
                                        </div>
                                        <div>
                                            <h1 className="forum-hero-title">Forum Diskusi & Pembelajaran</h1>
                                            <p className="forum-hero-desc">
                                                Tanya jawab kursus, knowledge sharing rumpun kompetensi, dan diskusi terbuka pegawai DPD RI.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Compact Stat Pills & Action */}
                                <div className="forum-hero-right">
                                    <div className="forum-hero-stat-pill" title="Total Topik Pembelajaran Rumpun">
                                        <div className="forum-stat-pill-icon icon-teal">
                                            <i className="fas fa-users-line"></i>
                                        </div>
                                        <div className="forum-stat-pill-info">
                                            <span className="forum-stat-pill-num">{forumStats.learningTopics}</span>
                                            <span className="forum-stat-pill-text">Rumpun</span>
                                        </div>
                                    </div>

                                    <div className="forum-hero-stat-pill" title="Total Diskusi Kursus">
                                        <div className="forum-stat-pill-icon icon-blue">
                                            <i className="fas fa-book-open-reader"></i>
                                        </div>
                                        <div className="forum-stat-pill-info">
                                            <span className="forum-stat-pill-num">{forumStats.courseDiscussions}</span>
                                            <span className="forum-stat-pill-text">Kursus</span>
                                        </div>
                                    </div>

                                    <div className="forum-hero-stat-pill" title="Diskusi Terpecahkan (Solusi)">
                                        <div className="forum-stat-pill-icon icon-emerald">
                                            <i className="fas fa-circle-check"></i>
                                        </div>
                                        <div className="forum-stat-pill-info">
                                            <span className="forum-stat-pill-num">{forumStats.solved}</span>
                                            <span className="forum-stat-pill-text">Solusi</span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleOpenCreateModal}
                                        className="forum-btn-create-compact"
                                        title="Mulai Topik Diskusi Baru"
                                    >
                                        <i className="fas fa-plus"></i>
                                        <span>Topik Baru</span>
                                    </button>
                                </div>
                            </div>

                            {/* =========================================================================
                                2. HIGH-DENSITY UNIFIED TOOLBAR (Tabs + Search + Filters in One Card)
                                ========================================================================= */}
                            <div className="forum-toolbar-card">
                                {/* Line 1: Primary Tab Switcher & Integrated Search Box */}
                                <div className="forum-toolbar-line1">
                                    <div className="forum-tab-pills">
                                        <button
                                            type="button"
                                            className={`forum-tab-pill ${activeTab === "learning-forum" ? "active" : ""}`}
                                            onClick={() => handleSwitchTab("learning-forum")}
                                        >
                                            <i className="fas fa-users-line"></i>
                                            <span>Forum Pembelajaran (Rumpun)</span>
                                            <span className="forum-pill-count">{safeTopics.length}</span>
                                        </button>

                                        <button
                                            type="button"
                                            className={`forum-tab-pill ${activeTab === "course-discussions" ? "active" : ""}`}
                                            onClick={() => handleSwitchTab("course-discussions")}
                                        >
                                            <i className="fas fa-book-open-reader"></i>
                                            <span>Forum Diskusi Kursus</span>
                                            <span className="forum-pill-count">{safeCourseDiscussions.length}</span>
                                        </button>

                                        <button
                                            type="button"
                                            className={`forum-tab-pill ${activeTab === "my-discussions" ? "active" : ""}`}
                                            onClick={() => handleSwitchTab("my-discussions")}
                                        >
                                            <i className="fas fa-user-tag"></i>
                                            <span>Diskusi Saya</span>
                                            <span className="forum-pill-count">
                                                {myTopics.length + myCourseDiscussions.length}
                                            </span>
                                        </button>
                                    </div>

                                    {/* Integrated Live Search (Fixed: No icon/placeholder overlap) */}
                                    <div className="forum-search-box-compact">
                                        <i className="fas fa-magnifying-glass search-icon"></i>
                                        <input
                                            type="text"
                                            className="forum-search-input-compact"
                                            placeholder="Cari topik diskusi, materi, pemateri..."
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                if (viewingTopic || viewingCourseQA) {
                                                    setViewingTopic(null);
                                                    setViewingCourseQA(null);
                                                }
                                            }}
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                className="forum-search-clear-compact"
                                                onClick={() => setSearchQuery("")}
                                                title="Bersihkan pencarian"
                                            >
                                                <i className="fas fa-xmark"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Line 2: Sub-toolbar for Categories Dropdown (Left) & Select Filters (Right) */}
                                <div className="forum-toolbar-line2">
                                    {activeTab === "learning-forum" && (
                                        <div className="forum-cat-dropdown-wrapper">
                                            <label className="forum-toolbar-label">
                                                <i className="fas fa-layer-group text-teal"></i>
                                                <span>Rumpun:</span>
                                            </label>
                                            <select
                                                className="forum-select-compact forum-cat-select"
                                                value={selectedCategory}
                                                onChange={(e) => handleSelectCategory(e.target.value)}
                                            >
                                                <option value="all">Semua Rumpun Kompetensi ({safeTopics.length})</option>
                                                {safeCategories.map((cat) => (
                                                    <option key={cat.id} value={cat.slug}>
                                                        {cat.name} ({cat.topics_count || 0})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {activeTab === "course-discussions" && (
                                        <div className="forum-cat-dropdown-wrapper">
                                            <label className="forum-toolbar-label">
                                                <i className="fas fa-book-open-reader text-teal"></i>
                                                <span>Pilih Kursus:</span>
                                            </label>
                                            <select
                                                className="forum-select-compact forum-cat-select"
                                                value={selectedCourseFilter}
                                                onChange={(e) => {
                                                    setSelectedCourseFilter(e.target.value);
                                                    setViewingCourseQA(null);
                                                }}
                                            >
                                                <option value="all">Semua Kursus Saya ({safeEnrolledCourses.length})</option>
                                                {safeEnrolledCourses.map((ec) => (
                                                    <option key={ec.course?.id || ec.id} value={ec.course?.course_id || ec.course?.id}>
                                                        {ec.course?.title}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {activeTab === "my-discussions" && (
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="small text-muted fw-bold">
                                                <i className="fas fa-user-check me-1 text-teal"></i>
                                                Aktivitas Diskusi: {myTopics.length} Topik Rumpun & {myCourseDiscussions.length} Diskusi Kursus
                                            </span>
                                        </div>
                                    )}

                                    <div className="forum-filters-compact ms-auto">
                                        <div className="d-flex align-items-center gap-1">
                                            <label className="forum-toolbar-label d-none d-sm-inline-flex">
                                                <i className="fas fa-filter text-muted"></i>
                                                <span>Status:</span>
                                            </label>
                                            <select
                                                className="forum-select-compact"
                                                value={statusFilter}
                                                onChange={(e) => setStatusFilter(e.target.value)}
                                            >
                                                <option value="all">Semua Status</option>
                                                <option value="bookmarked">⭐ Disimpan (Favorit)</option>
                                                {isInternalSetjen && (
                                                    <option value="internal">🔒 Khusus Setjen DPD RI</option>
                                                )}
                                                <option value="solved">Terpecahkan</option>
                                                <option value="unanswered">Belum Dijawab</option>
                                                <option value="pinned">Terpin / Pengumuman</option>
                                            </select>
                                        </div>

                                        <div className="d-flex align-items-center gap-1">
                                            <label className="forum-toolbar-label d-none d-sm-inline-flex">
                                                <i className="fas fa-arrow-down-short-wide text-muted"></i>
                                                <span>Urutkan:</span>
                                            </label>
                                            <select
                                                className="forum-select-compact"
                                                value={sortBy}
                                                onChange={(e) => setSortBy(e.target.value)}
                                            >
                                                <option value="newest">Terbaru</option>
                                                <option value="popular">Terpopuler</option>
                                                <option value="active">Aktivitas Terakhir</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* =========================================================================
                                3. IN-PLACE FORUM THREAD VIEW (When viewingTopic is active)
                                ========================================================================= */}
                            {viewingTopic ? (
                                <div className="forum-thread-inplace-container">
                                    {/* Top Navigation Bar with Back Button */}
                                    <div className="thread-inplace-nav">
                                        <button
                                            type="button"
                                            className="btn-thread-back"
                                            onClick={handleBackToTopicList}
                                        >
                                            <i className="fas fa-arrow-left"></i>
                                            <span>Kembali ke Daftar Topik</span>
                                        </button>

                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <span
                                                className="micro-badge-cat"
                                                style={{ backgroundColor: viewingTopic.category_detail?.badge_color || "#0d9488" }}
                                            >
                                                <i className={viewingTopic.category_detail?.icon || "fas fa-tag"}></i>
                                                <span>{viewingTopic.category_detail?.name}</span>
                                            </span>

                                            {viewingTopic.visibility === "internal_setjen" && (
                                                <span className="micro-badge-internal" title="Topik khusus pegawai Setjen DPD RI">
                                                    <i className="fas fa-lock"></i> Khusus Setjen
                                                </span>
                                            )}

                                            {viewingTopic.is_pinned && (
                                                <span className="micro-badge-pinned">
                                                    <i className="fas fa-thumbtack"></i> Terpin
                                                </span>
                                            )}

                                            {viewingTopic.is_locked && (
                                                <span className="micro-badge-locked" title="Topik ini telah dikunci untuk diskusi baru">
                                                    <i className="fas fa-lock"></i> Terkunci
                                                </span>
                                            )}

                                            {viewingTopic.is_solved && (
                                                <span className="micro-badge-solved">
                                                    <i className="fas fa-circle-check"></i> Terpecahkan
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Main Post Card */}
                                    <div className="thread-inplace-main-card">
                                        <div className="thread-header-row">
                                            <div className="card-author-compact">
                                                <img
                                                    src={getUserAvatarUrl(viewingTopic.profile, viewingTopic.profile?.full_name)}
                                                    alt={viewingTopic.profile?.full_name || "Anonim"}
                                                    className="thread-author-avatar-lg"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingTopic.profile?.full_name || "Anonim")}&size=96&background=0f766e&color=ffffff&bold=true`;
                                                    }}
                                                />
                                                <div>
                                                    <div className="card-author-name-compact fw-bold d-flex align-items-center flex-wrap">
                                                        <span>{viewingTopic.profile?.full_name || "Anonim"}</span>
                                                        {renderAuthorBadges(viewingTopic.profile)}
                                                    </div>
                                                    <div className="card-author-dept-compact">
                                                        {viewingTopic.profile?.position_name || viewingTopic.profile?.organization_unit_name || "Internal Setjen DPD RI"}
                                                        <span className="mx-1">•</span>
                                                        {dayjs(viewingTopic.created_at).format("DD MMMM YYYY, HH:mm")} ({dayjs(viewingTopic.created_at).fromNow()})
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="thread-actions-quick">
                                                {/* Moderation: Pin only for Administrator */}
                                                {isAdmin && (
                                                    <button
                                                        type="button"
                                                        className={`btn-thread-pin ${viewingTopic.is_pinned ? "pinned" : ""}`}
                                                        onClick={() => handleTogglePinTopic(viewingTopic.topic_id)}
                                                        title={viewingTopic.is_pinned ? "Batal Sematkan Topik" : "Sematkan Topik di Atas (Admin)"}
                                                    >
                                                        <i className="fas fa-thumbtack"></i>
                                                        <span>{viewingTopic.is_pinned ? "Tersemat" : "Sematkan"}</span>
                                                    </button>
                                                )}

                                                {/* Lock: Topic Owner (closing discussion) or Admin (moderation) */}
                                                {(Boolean(userData?.user_id && (Number(viewingTopic.user_id) === Number(userData.user_id) || Number(viewingTopic.user?.id) === Number(userData.user_id) || Number(viewingTopic.user) === Number(userData.user_id))) || isAdmin) && (
                                                    <button
                                                        type="button"
                                                        className={`btn-thread-lock ${viewingTopic.is_locked ? "locked" : ""}`}
                                                        onClick={() => handleToggleLockTopic(viewingTopic.topic_id)}
                                                        title={viewingTopic.is_locked ? "Buka Kunci Diskusi" : "Kunci Diskusi"}
                                                    >
                                                        <i className={`fas fa-${viewingTopic.is_locked ? "lock-open" : "lock"}`}></i>
                                                        <span>{viewingTopic.is_locked ? "Buka Kunci" : "Kunci"}</span>
                                                    </button>
                                                )}

                                                {/* Edit Topic: ONLY for Topic Owner */}
                                                {Boolean(userData?.user_id && (Number(viewingTopic.user_id) === Number(userData.user_id) || Number(viewingTopic.user?.id) === Number(userData.user_id) || Number(viewingTopic.user) === Number(userData.user_id))) && (
                                                    <button
                                                        type="button"
                                                        className="btn-thread-edit"
                                                        onClick={() => handleOpenEditTopic(viewingTopic)}
                                                        title="Edit topik diskusi saya"
                                                    >
                                                        <i className="fas fa-pen-to-square"></i>
                                                        <span>Edit</span>
                                                    </button>
                                                )}

                                                {/* Delete Topic: Topic Owner or Admin */}
                                                {(Boolean(userData?.user_id && (Number(viewingTopic.user_id) === Number(userData.user_id) || Number(viewingTopic.user?.id) === Number(userData.user_id) || Number(viewingTopic.user) === Number(userData.user_id))) || isAdmin) && (
                                                    <button
                                                        type="button"
                                                        className="btn-thread-delete"
                                                        onClick={() => handleDeleteTopic(viewingTopic.topic_id)}
                                                        title={Boolean(userData?.user_id && (Number(viewingTopic.user_id) === Number(userData.user_id) || Number(viewingTopic.user?.id) === Number(userData.user_id) || Number(viewingTopic.user) === Number(userData.user_id))) ? "Hapus topik diskusi saya" : "Hapus topik (Moderasi Admin)"}
                                                    >
                                                        <i className="fas fa-trash-can"></i>
                                                        <span>Hapus</span>
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    className="btn-thread-export-pdf"
                                                    onClick={() => handleExportTopicPDF(viewingTopic)}
                                                    title="Cetak atau Unduh Notulensi Diskusi (Format PDF Resmi DPD RI)"
                                                >
                                                    <i className="fas fa-file-pdf"></i>
                                                    <span>Notulensi PDF</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-thread-share"
                                                    onClick={() => handleCopyTopicLink(viewingTopic.topic_id)}
                                                    title="Salin tautan topik ini"
                                                >
                                                    <i className="fas fa-share-nodes"></i>
                                                    <span>Bagikan</span>
                                                </button>

                                                {/* Report Topic: only for non-owners */}
                                                {!Boolean(userData?.user_id && (Number(viewingTopic.user_id) === Number(userData.user_id) || Number(viewingTopic.user?.id) === Number(userData.user_id) || Number(viewingTopic.user) === Number(userData.user_id))) && (
                                                    viewingTopic.user_report ? (
                                                        <button
                                                            type="button"
                                                            className="btn-thread-report reported"
                                                            onClick={() => handleViewReportStatus(viewingTopic.user_report, { isTopic: true, topicTitle: viewingTopic.title, topicId: viewingTopic.id })}
                                                            title={`Status Laporan: ${viewingTopic.user_report.status_display || viewingTopic.user_report.status}. Klik untuk melihat progres aduan.`}
                                                        >
                                                            <i className="fas fa-flag text-warning"></i>
                                                            <span>Status Laporan</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="btn-thread-report"
                                                            onClick={() => handleOpenReportModal({ topicId: viewingTopic.topic_id, isTopic: true })}
                                                            title="Laporkan topik ini ke Pengelola Forum"
                                                        >
                                                            <i className="far fa-flag"></i>
                                                            <span>Laporkan</span>
                                                        </button>
                                                    )
                                                )}

                                                <button
                                                    type="button"
                                                    className={`btn-thread-bookmark ${viewingTopic.user_bookmarked ? "bookmarked" : ""}`}
                                                    onClick={() => handleToggleTopicBookmark(viewingTopic.topic_id)}
                                                    title={viewingTopic.user_bookmarked ? "Hapus dari favorit" : "Simpan topik"}
                                                >
                                                    <i className={`${viewingTopic.user_bookmarked ? "fas" : "far"} fa-bookmark`}></i>
                                                    <span>{viewingTopic.user_bookmarked ? "Tersimpan" : "Simpan"}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`btn-thread-like ${viewingTopic.user_liked ? "liked" : ""}`}
                                                    onClick={() => handleToggleTopicLike(viewingTopic.topic_id)}
                                                    title={viewingTopic.user_liked ? "Batal menyukai" : "Sukai topik ini"}
                                                >
                                                    <i className={`${viewingTopic.user_liked ? "fas" : "far"} fa-thumbs-up`}></i>
                                                    <span>{viewingTopic.likes_count || 0} Suka</span>
                                                </button>
                                                <span className="thread-view-count">
                                                    <i className="fas fa-eye me-1"></i> {viewingTopic.views_count || 0} kali dilihat
                                                </span>
                                            </div>
                                        </div>

                                        <h1 className="thread-inplace-title">{viewingTopic.title}</h1>

                                        <div className="thread-inplace-body">
                                             {renderFormattedContent(viewingTopic.content)}
                                        </div>

                                        {viewingTopic.file && (
                                            <div className="thread-attachments-wrap mt-3">
                                                {renderAttachmentPreview(viewingTopic.file, viewingTopic.file_name)}
                                            </div>
                                        )}

                                        {/* Mini-Poll / Jajak Pendapat Partisipatif */}
                                        {viewingTopic.poll && (
                                            <div className="thread-poll-card mt-3">
                                                <div className="poll-card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="poll-icon-box">
                                                            <i className="fas fa-square-poll-vertical text-teal"></i>
                                                        </span>
                                                        <div>
                                                            <span className="poll-badge-label">Jajak Pendapat / Polling</span>
                                                            <h4 className="poll-question-title mb-0">{viewingTopic.poll.question}</h4>
                                                        </div>
                                                    </div>

                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className={`badge ${viewingTopic.poll.is_closed ? "bg-secondary-subtle text-secondary border" : "bg-success-subtle text-success border border-success-subtle"}`} style={{ fontSize: "0.68rem" }}>
                                                            <i className={`fas fa-${viewingTopic.poll.is_closed ? "lock" : "circle-check"} me-1`}></i>
                                                            {viewingTopic.poll.is_closed ? "Polling Ditutup" : "Polling Aktif"}
                                                        </span>

                                                        {/* Owner or Admin toggle poll close */}
                                                        {(Boolean(userData?.user_id && (Number(viewingTopic.user_id) === Number(userData.user_id) || Number(viewingTopic.user?.id) === Number(userData.user_id) || Number(viewingTopic.user) === Number(userData.user_id))) || isAdmin) && (
                                                            <button
                                                                type="button"
                                                                className="btn-poll-toggle-close"
                                                                onClick={() => handleToggleClosePoll(viewingTopic.poll.id)}
                                                                title={viewingTopic.poll.is_closed ? "Buka kembali polling" : "Tutup polling"}
                                                            >
                                                                <i className={`fas fa-${viewingTopic.poll.is_closed ? "lock-open" : "lock"} me-1`}></i>
                                                                <span>{viewingTopic.poll.is_closed ? "Buka" : "Tutup"}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="poll-card-body mt-3">
                                                    <div className="poll-options-list">
                                                        {viewingTopic.poll.options?.map((opt) => {
                                                            const isMyVote = viewingTopic.poll.user_voted_option_id === opt.id;
                                                            const isSelected = selectedPollOption === opt.id;

                                                            return (
                                                                <div
                                                                    key={opt.id}
                                                                    className={`poll-option-row ${isMyVote ? "my-vote" : ""} ${isSelected ? "selected" : ""} ${viewingTopic.poll.is_closed ? "closed" : ""}`}
                                                                    onClick={() => {
                                                                        if (!viewingTopic.poll.is_closed) {
                                                                            setSelectedPollOption(opt.id);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div
                                                                        className="poll-option-progress-bg"
                                                                        style={{ width: `${opt.percentage || 0}%` }}
                                                                    ></div>
                                                                    <div className="poll-option-content">
                                                                        <div className="d-flex align-items-center gap-2">
                                                                            {!viewingTopic.poll.is_closed && (
                                                                                <input
                                                                                    type="radio"
                                                                                    name="poll_option_selection"
                                                                                    checked={selectedPollOption ? isSelected : isMyVote}
                                                                                    onChange={() => setSelectedPollOption(opt.id)}
                                                                                    className="poll-radio-input"
                                                                                />
                                                                            )}
                                                                            <span className="poll-option-text">{opt.option_text}</span>
                                                                            {isMyVote && (
                                                                                <span className="poll-my-vote-badge">
                                                                                    <i className="fas fa-check-circle me-1"></i>Pilihan Anda
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="poll-option-stats">
                                                                            <span className="poll-stat-pct">{opt.percentage || 0}%</span>
                                                                            <span className="poll-stat-cnt">({opt.votes_count || 0} suara)</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="poll-card-footer mt-2 d-flex align-items-center justify-content-between">
                                                        <span className="poll-total-votes">
                                                            <i className="fas fa-users me-1 text-muted"></i>
                                                            Total: <strong>{viewingTopic.poll.total_votes || 0}</strong> pemilih
                                                        </span>

                                                        {!viewingTopic.poll.is_closed && (
                                                            <button
                                                                type="button"
                                                                className="btn-submit-vote"
                                                                onClick={() => handleVotePoll(viewingTopic.poll.id, selectedPollOption || viewingTopic.poll.user_voted_option_id)}
                                                                disabled={isSubmittingVote || (!selectedPollOption && !viewingTopic.poll.user_voted_option_id)}
                                                            >
                                                                {isSubmittingVote ? (
                                                                    <>
                                                                        <span className="spinner-border spinner-border-sm me-1"></span>
                                                                        Merekam...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <i className="fas fa-check-to-slot me-1"></i>
                                                                        {viewingTopic.poll.user_voted_option_id ? "Perbarui Suara" : "Kirim Suara"}
                                                                    </>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Replies & Discussion Stream */}
                                    <div className="thread-replies-section">
                                        <div className="thread-replies-header">
                                            <h4 className="replies-count-title">
                                                <i className="fas fa-comments text-teal me-2"></i>
                                                Tanggapan & Diskusi ({viewingTopic.replies?.length || 0})
                                            </h4>
                                            {viewingTopic.is_solved && (
                                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1" style={{ fontSize: "0.72rem" }}>
                                                    <i className="fas fa-check-double me-1"></i> Telah Memiliki Solusi
                                                </span>
                                            )}
                                        </div>

                                        {viewingTopic.is_locked && (
                                            <div className="thread-locked-banner">
                                                <div className="d-flex align-items-center gap-2">
                                                    <i className="fas fa-lock text-warning fa-lg"></i>
                                                    <div>
                                                        <span className="fw-bold d-block text-dark">Diskusi Topik Ini Telah Dikunci</span>
                                                        <span className="small text-muted">
                                                            Topik ini telah ditutup oleh instruktur/pengelola sehingga tidak menerima tanggapan baru. Arsip diskusi tetap dapat dipelajari.
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {(!viewingTopic.replies || viewingTopic.replies.length === 0) ? (
                                            <div className="thread-empty-replies">
                                                <i className="far fa-comment-dots text-muted fa-2x mb-2"></i>
                                                <p className="text-muted small mb-0">
                                                    Belum ada tanggapan untuk topik ini. Jadilah yang pertama memberikan pandangan atau solusi!
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="thread-replies-list">
                                                {viewingTopic.replies.map((reply) => {
                                                    const isTopicOwner = Boolean(
                                                        userData?.user_id &&
                                                        (Number(viewingTopic.user_id) === Number(userData.user_id) ||
                                                            Number(viewingTopic.user?.id) === Number(userData.user_id) ||
                                                            Number(viewingTopic.user) === Number(userData.user_id))
                                                    );
                                                    const isOriginalPoster = Boolean(
                                                        viewingTopic &&
                                                        (Number(reply.user_id) === Number(viewingTopic.user_id || viewingTopic.user?.id || viewingTopic.user) ||
                                                            Number(reply.user?.id) === Number(viewingTopic.user_id || viewingTopic.user?.id || viewingTopic.user) ||
                                                            Number(reply.user) === Number(viewingTopic.user_id || viewingTopic.user?.id || viewingTopic.user))
                                                    );
                                                    const canMarkSolution = isTopicOwner || isAdmin;
                                                    const isReplyOwner = Boolean(
                                                        userData?.user_id &&
                                                        (Number(reply.user_id) === Number(userData.user_id) ||
                                                            Number(reply.user?.id) === Number(userData.user_id) ||
                                                            Number(reply.user) === Number(userData.user_id))
                                                    );
                                                    const canDeleteReply = isReplyOwner || isAdmin;
                                                    const isEditingThisReply = editingReplyId === (reply.message_id || reply.id);

                                                    return (
                                                        <div
                                                            key={reply.message_id || reply.id}
                                                            className={`thread-reply-card ${reply.is_solution ? "solution-highlighted" : ""}`}
                                                        >
                                                            {reply.is_solution && (
                                                                <div className="solution-indicator-bar">
                                                                    <i className="fas fa-circle-check"></i>
                                                                    <span>Solusi Terbaik Terverifikasi</span>
                                                                </div>
                                                            )}

                                                            <div className="reply-card-header">
                                                                <div className="card-author-compact">
                                                                    <img
                                                                        src={getUserAvatarUrl(reply.profile, reply.profile?.full_name)}
                                                                        alt={reply.profile?.full_name || "Rekan ASN"}
                                                                        className="card-author-avatar-compact"
                                                                        onError={(e) => {
                                                                            e.target.onerror = null;
                                                                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.profile?.full_name || "Rekan ASN")}&size=96&background=0f766e&color=ffffff&bold=true`;
                                                                        }}
                                                                    />
                                                                    <div>
                                                                        <div className="card-author-name-compact fw-bold d-flex align-items-center flex-wrap">
                                                                            <span>{reply.profile?.full_name || "Rekan ASN"}</span>
                                                                            {isOriginalPoster && (
                                                                                <span className="micro-badge-op" title="Penulis Asli Topik Ini">
                                                                                    <i className="fas fa-feather-pointed me-1"></i>Penulis Topik
                                                                                </span>
                                                                            )}
                                                                            {renderAuthorBadges(reply.profile)}
                                                                        </div>
                                                                        <span className="card-author-dept-compact">
                                                                            {reply.profile?.position_name || reply.profile?.organization_unit_name || "Peserta Setjen DPD RI"}
                                                                            <span className="mx-1">•</span>
                                                                            {dayjs(reply.created_at).fromNow()}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {canMarkSolution && (
                                                                    <button
                                                                        type="button"
                                                                        className={`btn-solution-action ${reply.is_solution ? "btn-unmark-solution" : "btn-mark-solution"}`}
                                                                        onClick={() => handleToggleSolution(reply.message_id)}
                                                                        title={reply.is_solution ? "Cabut tanda solusi" : "Tandai sebagai Solusi Terbaik"}
                                                                    >
                                                                        <i className={`fas fa-${reply.is_solution ? "xmark" : "check"}`}></i>
                                                                        <span>{reply.is_solution ? "Batalkan Solusi" : "Tandai Solusi"}</span>
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {isEditingThisReply ? (
                                                                <div className="reply-inline-edit-box mt-2">
                                                                    <textarea
                                                                        className="form-control mb-2"
                                                                        rows={3}
                                                                        value={editReplyMessage}
                                                                        onChange={(e) => setEditReplyMessage(e.target.value)}
                                                                        placeholder="Edit tanggapan Anda..."
                                                                        autoFocus
                                                                    ></textarea>
                                                                    <div className="d-flex align-items-center justify-content-end gap-2">
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-sm btn-outline-secondary"
                                                                            onClick={handleCancelEditReply}
                                                                            disabled={isSubmittingEditReply}
                                                                        >
                                                                            Batal
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-sm btn-teal text-white"
                                                                            onClick={() => handleSaveEditReply(reply.message_id || reply.id)}
                                                                            disabled={isSubmittingEditReply}
                                                                        >
                                                                            {isSubmittingEditReply ? (
                                                                                <>
                                                                                    <span className="spinner-border spinner-border-sm me-1"></span>
                                                                                    Menyimpan...
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <i className="fas fa-check me-1"></i>
                                                                                    Simpan Perubahan
                                                                                </>
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="reply-card-body">
                                                                        {renderFormattedContent(reply.message)}
                                                                    </div>

                                                                    {reply.file && (
                                                                        <div className="thread-attachments-wrap mt-2">
                                                                            {renderAttachmentPreview(reply.file, reply.file_name)}
                                                                        </div>
                                                                    )}

                                                                    <div className="reply-card-footer">
                                                                        <button
                                                                            type="button"
                                                                            className="btn-reply-quote"
                                                                            onClick={() => handleQuoteReply(reply)}
                                                                            title="Kutip tanggapan ini"
                                                                            disabled={viewingTopic.is_locked}
                                                                        >
                                                                            <i className="fas fa-quote-left me-1"></i> Kutip
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            className={`btn-reply-like ${reply.user_liked ? "liked" : ""}`}
                                                                            onClick={() => handleToggleReplyLike(reply.message_id)}
                                                                            title={reply.user_liked ? "Batal menyukai" : "Sukai tanggapan ini"}
                                                                        >
                                                                            <i className={`${reply.user_liked ? "fas" : "far"} fa-thumbs-up me-1`}></i>
                                                                            <span>{reply.likes_count || 0} Suka</span>
                                                                        </button>

                                                                        {/* Report Reply: only for non-owners */}
                                                                        {!isReplyOwner && (
                                                                            reply.user_report ? (
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn-reply-action-report reported"
                                                                                    onClick={() => handleViewReportStatus(reply.user_report, { isTopic: false, replyAuthor: reply.profile?.full_name || reply.profile?.username || 'Peserta', replyId: reply.id })}
                                                                                    title={`Status Laporan: ${reply.user_report.status_display || reply.user_report.status}. Klik untuk melihat progres aduan.`}
                                                                                >
                                                                                    <i className="fas fa-flag text-warning me-1"></i>
                                                                                    <span>Status Laporan</span>
                                                                                </button>
                                                                            ) : (
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn-reply-action-report"
                                                                                    onClick={() => handleOpenReportModal({ messageId: reply.message_id || reply.id, isTopic: false })}
                                                                                    title="Laporkan tanggapan ini"
                                                                                >
                                                                                    <i className="far fa-flag me-1"></i>
                                                                                    <span>Laporkan</span>
                                                                                </button>
                                                                            )
                                                                        )}

                                                                        {/* Reply Management: Edit ONLY by Author, Delete by Author or Admin */}
                                                                        {(isReplyOwner || canDeleteReply) && (
                                                                            <div className="reply-manage-actions ms-auto d-flex align-items-center gap-1">
                                                                                {isReplyOwner && !viewingTopic.is_locked && (
                                                                                    <button
                                                                                        type="button"
                                                                                        className="btn-reply-action-edit"
                                                                                        onClick={() => handleStartEditReply(reply)}
                                                                                        title="Edit tanggapan saya"
                                                                                    >
                                                                                        <i className="fas fa-pen-to-square"></i>
                                                                                        <span>Edit</span>
                                                                                    </button>
                                                                                )}
                                                                                {canDeleteReply && (
                                                                                    <button
                                                                                        type="button"
                                                                                        className="btn-reply-action-delete"
                                                                                        onClick={() => handleDeleteReply(reply.message_id || reply.id)}
                                                                                        title={isReplyOwner ? "Hapus tanggapan saya" : "Hapus tanggapan (Moderasi Admin)"}
                                                                                    >
                                                                                        <i className="fas fa-trash-can"></i>
                                                                                        <span>Hapus</span>
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* In-Place Reply Composer or Locked Notice */}
                                        {viewingTopic.is_locked ? (
                                            <div className="thread-locked-composer-box">
                                                <div className="d-flex align-items-center gap-3">
                                                    <div className="locked-icon-bubble">
                                                        <i className="fas fa-lock fa-lg"></i>
                                                    </div>
                                                    <div>
                                                        <h6 className="fw-bold mb-1 text-dark">Diskusi Ditutup</h6>
                                                        <p className="text-muted small mb-0">
                                                            Topik ini telah dikunci oleh pengelola atau instruktur sehingga tidak lagi menerima tanggapan baru.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="thread-inplace-reply-box">
                                                <h5 className="reply-box-title">
                                                    <i className="fas fa-pen-nib text-teal me-2"></i>
                                                    Beri Tanggapan atau Solusi
                                                </h5>
                                                <form onSubmit={handleSendReply}>
                                                    <div className="thread-formatting-toolbar">
                                                        <button
                                                            type="button"
                                                            className="format-btn"
                                                            onClick={() => handleInsertFormat("bold")}
                                                            title="Tebal (**teks**)"
                                                        >
                                                            <i className="fas fa-bold"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="format-btn"
                                                            onClick={() => handleInsertFormat("italic")}
                                                            title="Miring (*teks*)"
                                                        >
                                                            <i className="fas fa-italic"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="format-btn"
                                                            onClick={() => handleInsertFormat("quote")}
                                                            title="Kutipan Regulasi / Catatan"
                                                        >
                                                            <i className="fas fa-quote-left"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="format-btn"
                                                            onClick={() => handleInsertFormat("list")}
                                                            title="Daftar Butir Poin"
                                                        >
                                                            <i className="fas fa-list-ul"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="format-btn"
                                                            onClick={() => handleInsertFormat("code")}
                                                            title="Klausul / Tata Tertib"
                                                        >
                                                            <i className="fas fa-code"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="format-btn"
                                                            onClick={() => handleInsertFormat("link")}
                                                            title="Sisipkan Tautan"
                                                        >
                                                            <i className="fas fa-link"></i>
                                                        </button>
                                                        <span className="format-hint ms-auto">
                                                            <i className="fab fa-markdown me-1 text-teal"></i>Format Teks
                                                        </span>
                                                    </div>

                                                    <textarea
                                                        ref={replyTextareaRef}
                                                        className="thread-reply-textarea"
                                                        placeholder="Tuliskan saran, jawaban terperinci, atau panduan regulasi untuk membantu rekan pembelajar..."
                                                        rows={4}
                                                        value={replyMessage}
                                                        onChange={(e) => setReplyMessage(e.target.value)}
                                                        required
                                                    ></textarea>

                                                    <div className="thread-reply-footer">
                                                        <div className="d-flex align-items-center gap-2">
                                                            <label className="btn-attach-file" title="Lampirkan Dokumen/Gambar">
                                                                <i className="fas fa-paperclip"></i>
                                                                <span>{replyFile ? replyFile.name : "Lampirkan Berkas"}</span>
                                                                <input
                                                                    type="file"
                                                                    hidden
                                                                    onChange={(e) => setReplyFile(e.target.files[0] || null)}
                                                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
                                                                />
                                                            </label>
                                                            {replyFile && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-link text-danger p-0"
                                                                    onClick={() => setReplyFile(null)}
                                                                    title="Hapus lampiran"
                                                                >
                                                                    <i className="fas fa-times-circle"></i>
                                                                </button>
                                                            )}
                                                        </div>

                                                        <button
                                                            type="submit"
                                                            className="btn-submit-reply"
                                                            disabled={isSubmittingReply}
                                                        >
                                                            {isSubmittingReply ? (
                                                                <>
                                                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                                                    Mengirim...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <i className="fas fa-paper-plane me-1"></i>
                                                                    Kirim Tanggapan
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : viewingCourseQA ? (
                                /* =========================================================================
                                   IN-PLACE COURSE DISCUSSION DETAIL VIEW (When viewingCourseQA is active)
                                   ========================================================================= */
                                <div className="forum-thread-inplace-container">
                                    <div className="thread-inplace-nav">
                                        <button
                                            type="button"
                                            className="btn-thread-back"
                                            onClick={() => setViewingCourseQA(null)}
                                        >
                                            <i className="fas fa-arrow-left"></i>
                                            <span>Kembali ke Diskusi Kursus</span>
                                        </button>

                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <span className="micro-badge-course">
                                                <i className="fas fa-graduation-cap"></i>
                                                <span>{viewingCourseQA.course_title || "Kursus"}</span>
                                            </span>
                                            {(viewingCourseQA.enrollment_id || viewingCourseQA.user_enrolled) && (
                                                <span className="badge bg-success-subtle text-success border border-success-subtle py-1 px-2" style={{ fontSize: "0.68rem" }}>
                                                    <i className="fas fa-check-circle me-1"></i>
                                                    Kursus Terdaftar
                                                </span>
                                            )}
                                            {viewingCourseQA.variant_item?.title && (
                                                <span className="badge bg-light text-dark border py-1 px-2" style={{ fontSize: "0.68rem" }}>
                                                    <i className="fas fa-play-circle me-1 text-teal"></i>
                                                    {viewingCourseQA.variant_item.title}
                                                </span>
                                            )}
                                            {viewingCourseQA.is_solved && (
                                                <span className="micro-badge-solved">
                                                    <i className="fas fa-circle-check"></i> Terpecahkan
                                                </span>
                                            )}
                                            {viewingCourseQA.has_instructor_reply && (
                                                <span className="badge bg-primary text-white py-1 px-2" style={{ fontSize: "0.68rem" }}>
                                                    <i className="fas fa-user-tie me-1"></i> Respon Instruktur
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="thread-inplace-main-card">
                                        <div className="thread-header-row">
                                            <div className="card-author-compact">
                                                <img
                                                    src={getUserAvatarUrl(viewingCourseQA.profile, viewingCourseQA.profile?.full_name)}
                                                    alt={viewingCourseQA.profile?.full_name || "Penanya Kursus"}
                                                    className="thread-author-avatar-lg"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingCourseQA.profile?.full_name || "Penanya Kursus")}&size=96&background=0f766e&color=ffffff&bold=true`;
                                                    }}
                                                />
                                                <div>
                                                    <div className="card-author-name-compact fw-bold d-flex align-items-center gap-1 flex-wrap">
                                                        <span>{viewingCourseQA.profile?.full_name || "Penanya Kursus"}</span>
                                                        <DPDRIRoleBadges 
                                                            profile={viewingCourseQA.profile} 
                                                            isAsker={true}
                                                            isCurrentUser={viewingCourseQA.user_id === userData?.user_id || viewingCourseQA.user?.id === userData?.user_id}
                                                        />
                                                    </div>
                                                    <div className="card-author-dept-compact">
                                                        {dayjs(viewingCourseQA.date).format("DD MMMM YYYY, HH:mm")} ({dayjs(viewingCourseQA.date).fromNow()})
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                                <button
                                                    type="button"
                                                    className={`btn-thread-like ${viewingCourseQA.user_liked ? 'liked' : ''}`}
                                                    onClick={(e) => handleToggleCourseQALike(viewingCourseQA, e)}
                                                    title="Suka pertanyaan kursus ini"
                                                >
                                                    <i className={viewingCourseQA.user_liked ? "fas fa-thumbs-up" : "far fa-thumbs-up"}></i>
                                                    <span>{viewingCourseQA.likes_count || 0} Suka</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn-open-course-compact"
                                                    onClick={(e) => handleNavigateToCourse(viewingCourseQA, e)}
                                                    title="Buka langsung di Player Kursus Anda"
                                                >
                                                    <i className="fas fa-arrow-up-right-from-square"></i>
                                                    <span>{viewingCourseQA.enrollment_id ? "Buka di Kursus Saya" : "Buka di Kursus"}</span>
                                                </button>
                                            </div>
                                        </div>

                                        <h1 className="thread-inplace-title">{viewingCourseQA.title}</h1>
                                        <div className="thread-inplace-body forum-post-content">
                                            <QAMarkdownRenderer
                                                content={viewingCourseQA.messages?.[0]?.message || viewingCourseQA.title}
                                            />
                                            {viewingCourseQA.messages?.[0]?.file && (
                                                <div className="mt-3 pt-2 border-top">
                                                    <QAAttachmentDisplay
                                                        fileUrl={viewingCourseQA.messages[0].file}
                                                        fileName={viewingCourseQA.messages[0].file_name}
                                                        onImageClick={(url, name) => setLightboxImage({ url, name })}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="thread-replies-section">
                                        <div className="thread-replies-header">
                                            <h4 className="replies-count-title">
                                                <i className="fas fa-comments text-teal me-2"></i>
                                                Tanggapan Diskusi Kursus ({Math.max(0, (viewingCourseQA.messages?.length || 1) - 1)})
                                            </h4>
                                        </div>

                                        {(!viewingCourseQA.messages || viewingCourseQA.messages.length <= 1) ? (
                                            <div className="thread-empty-replies">
                                                <i className="far fa-comment-dots text-muted fa-2x mb-2"></i>
                                                <p className="text-muted small mb-0">
                                                    Belum ada tanggapan lain untuk pertanyaan kursus ini. Tuliskan tanggapan pertama di bawah ini!
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="thread-replies-list">
                                                {viewingCourseQA.messages.slice(1).map((msg, idx) => (
                                                    <div key={idx} className="thread-reply-card">
                                                        <div className="reply-card-header">
                                                            <div className="card-author-compact">
                                                                <img
                                                                    src={getUserAvatarUrl(msg.profile, msg.profile?.full_name)}
                                                                    alt={msg.profile?.full_name || "Pengguna"}
                                                                    className="card-author-avatar-compact"
                                                                    onError={(e) => {
                                                                        e.target.onerror = null;
                                                                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.profile?.full_name || "Pengguna")}&size=96&background=0f766e&color=ffffff&bold=true`;
                                                                    }}
                                                                />
                                                                <div>
                                                                    <div className="d-flex align-items-center gap-1 flex-wrap">
                                                                        <span className="card-author-name-compact fw-bold">
                                                                            {msg.profile?.full_name || "Pengguna"}
                                                                        </span>
                                                                        <DPDRIRoleBadges 
                                                                            profile={msg.profile} 
                                                                            isInstructor={msg.is_instructor || msg.profile?.is_instructor}
                                                                            isCurrentUser={msg.user_id === userData?.user_id}
                                                                        />
                                                                    </div>
                                                                    <div className="card-author-dept-compact">
                                                                        {dayjs(msg.date).format("DD MMMM YYYY, HH:mm")} ({dayjs(msg.date).fromNow()})
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="reply-card-body forum-post-content">
                                                            <QAMarkdownRenderer content={msg.message} />
                                                            {msg.file && (
                                                                <div className="mt-2 pt-2 border-top">
                                                                    <QAAttachmentDisplay
                                                                        fileUrl={msg.file}
                                                                        fileName={msg.file_name}
                                                                        onImageClick={(url, name) => setLightboxImage({ url, name })}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* FULL FORUM REPLY SECTION WITH TOOLBAR & ATTACHMENT */}
                                        <div className="forum-reply-section mt-3">
                                            <h3 className="forum-reply-section-title">
                                                <i className="fas fa-edit me-2 text-teal"></i>
                                                Berikan Tanggapan Anda
                                            </h3>
                                            <form onSubmit={handleSendCourseQAReply} className="forum-reply-form">
                                                {/* Hidden file input for reply attachment */}
                                                <input
                                                    type="file"
                                                    ref={courseQAReplyFileInputRef}
                                                    style={{ display: "none" }}
                                                    accept=".png,.jpg,.jpeg,.webp,.pdf,image/*"
                                                    onChange={handleReplyFileChange}
                                                />

                                                <div className="forum-form-group">
                                                    {/* Formatting Toolbar */}
                                                    <QAFormattingToolbar
                                                        textareaRef={courseQAReplyTextareaRef}
                                                        value={courseQAReplyText}
                                                        onChange={(newVal) => setCourseQAReplyText(newVal)}
                                                        isPreview={replyPreviewMode}
                                                        onTogglePreview={setReplyPreviewMode}
                                                        showTimestampBtn={false}
                                                        onAttachClick={() => courseQAReplyFileInputRef.current?.click()}
                                                        hasAttachment={Boolean(replyAttachment)}
                                                    />

                                                    {replyPreviewMode ? (
                                                        <div className="forum-reply-preview-container">
                                                            <QAMarkdownRenderer
                                                                content={courseQAReplyText}
                                                                emptyPlaceholder="Tuliskan tanggapan Anda di mode Tulis untuk melihat pratinjau di sini."
                                                            />
                                                        </div>
                                                    ) : (
                                                        <textarea
                                                            ref={courseQAReplyTextareaRef}
                                                            name="message"
                                                            className="forum-reply-textarea"
                                                            placeholder="Tulis tanggapan Anda di sini... Mendukung Markdown, tautan, dan tempel screenshot langsung (Ctrl+V)."
                                                            rows="3"
                                                            onChange={(e) => setCourseQAReplyText(e.target.value)}
                                                            onPaste={handleReplyPasteImage}
                                                            value={courseQAReplyText}
                                                            required={!replyAttachment}
                                                        />
                                                    )}

                                                    {/* Attachment Preview Chip */}
                                                    <QAAttachmentInputPreview
                                                        file={replyAttachment}
                                                        isCompressing={isCompressingReplyAttachment}
                                                        onRemove={() => setReplyAttachment(null)}
                                                    />
                                                </div>

                                                <div className="forum-form-actions d-flex align-items-center justify-content-between flex-wrap gap-2">
                                                    <p className="forum-form-hint mb-0 text-muted" style={{ fontSize: "0.75rem" }}>
                                                        <i className="fas fa-info-circle me-1 text-teal"></i>
                                                        Format Markdown, sisipan tautan, dan lampiran file/gambar didukung penuh.
                                                    </p>
                                                    <button
                                                        type="submit"
                                                        className="forum-btn-primary"
                                                        disabled={(!courseQAReplyText.trim() && !replyAttachment) || isSubmittingCourseQAReply || isCompressingReplyAttachment}
                                                    >
                                                        {isSubmittingCourseQAReply ? (
                                                            <>
                                                                <i className="fas fa-spinner fa-spin me-2"></i>Mengirim...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <i className="fas fa-paper-plane me-2"></i>Kirim Tanggapan
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* =========================================================================
                                   CARD LISTS (When no in-place thread is active)
                                   ========================================================================= */
                                <>
                                    {/* WIDGET LEADERBOARD KONTRIBUTOR TERBAIK RUMPUN */}
                                    {activeTab === "learning-forum" && leaderboard.length > 0 && (
                                        <div className="forum-leaderboard-card mb-3">
                                            <div className="leaderboard-card-header d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="leaderboard-icon-box">
                                                        <i className="fas fa-trophy text-amber"></i>
                                                    </div>
                                                    <div>
                                                        <h4 className="leaderboard-title mb-0">
                                                            Papan Peringkat Kontributor Rumpun
                                                        </h4>
                                                        <p className="leaderboard-subtitle mb-0">
                                                            Rekan ASN Setjen DPD RI paling aktif berbagi wawasan & memberikan solusi terverifikasi
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn-leaderboard-toggle"
                                                    onClick={() => setIsLeaderboardOpen(!isLeaderboardOpen)}
                                                >
                                                    <i className={`fas fa-chevron-${isLeaderboardOpen ? "up" : "down"} me-1`}></i>
                                                    <span>{isLeaderboardOpen ? "Sembunyikan" : "Buka Peringkat"}</span>
                                                </button>
                                            </div>

                                            {isLeaderboardOpen && (
                                                <div className="leaderboard-card-body mt-3">
                                                    <div className="leaderboard-podium-grid">
                                                        {leaderboard.slice(0, 3).map((contributor) => {
                                                            const rankColors = {
                                                                1: { badge: "gold", icon: "fa-crown", label: "Juara 1" },
                                                                2: { badge: "silver", icon: "fa-medal", label: "Juara 2" },
                                                                3: { badge: "bronze", icon: "fa-award", label: "Juara 3" },
                                                            };
                                                            const currentRank = rankColors[contributor.rank] || rankColors[3];

                                                            return (
                                                                <div key={contributor.user_id} className={`leaderboard-podium-card rank-${contributor.rank}`}>
                                                                    <div className={`podium-rank-badge ${currentRank.badge}`}>
                                                                        <i className={`fas ${currentRank.icon} me-1`}></i>
                                                                        #{contributor.rank}
                                                                    </div>
                                                                    <div className="podium-avatar-wrap">
                                                                        <img
                                                                            src={contributor.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contributor.full_name || "ASN")}&size=96&background=0f766e&color=ffffff&bold=true`}
                                                                            alt={contributor.full_name}
                                                                            className="podium-avatar"
                                                                            onError={(e) => {
                                                                                e.target.onerror = null;
                                                                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contributor.full_name || "ASN")}&size=96&background=0f766e&color=ffffff&bold=true`;
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="podium-user-info">
                                                                        <span className="podium-name text-truncate" title={contributor.full_name}>
                                                                            {contributor.full_name}
                                                                        </span>
                                                                        <span className="podium-dept text-truncate" title={contributor.position_name || contributor.organization_unit_name}>
                                                                            {contributor.position_name || contributor.organization_unit_name || "Setjen DPD RI"}
                                                                        </span>
                                                                    </div>
                                                                    <div className="podium-stats-row">
                                                                        <span className="podium-stat-solution" title="Solusi Terbaik Terverifikasi">
                                                                            <i className="fas fa-check-double me-1"></i>
                                                                            {contributor.solutions_count} Solusi
                                                                        </span>
                                                                        <span className="podium-stat-xp" title="Total Poin Kontribusi">
                                                                            <i className="fas fa-bolt me-1 text-warning"></i>
                                                                            {contributor.score} XP
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Other ranks (4 - 5) compact list */}
                                                    {leaderboard.length > 3 && (
                                                        <div className="leaderboard-runners-list mt-2">
                                                            {leaderboard.slice(3, 5).map((contributor) => (
                                                                <div key={contributor.user_id} className="leaderboard-runner-item">
                                                                    <span className="runner-rank-num">#{contributor.rank}</span>
                                                                    <img
                                                                        src={contributor.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contributor.full_name || "ASN")}&size=96&background=0f766e&color=ffffff&bold=true`}
                                                                        alt={contributor.full_name}
                                                                        className="runner-avatar"
                                                                        onError={(e) => {
                                                                            e.target.onerror = null;
                                                                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contributor.full_name || "ASN")}&size=96&background=0f766e&color=ffffff&bold=true`;
                                                                        }}
                                                                    />
                                                                    <div className="runner-info text-truncate">
                                                                        <span className="runner-name text-truncate">{contributor.full_name}</span>
                                                                        <span className="runner-dept text-truncate">{contributor.position_name || contributor.organization_unit_name || "Setjen DPD RI"}</span>
                                                                    </div>
                                                                    <div className="runner-stats ms-auto">
                                                                        <span className="badge bg-success-subtle text-success border border-success-subtle me-1" style={{ fontSize: "0.68rem" }}>
                                                                            <i className="fas fa-check me-1"></i>{contributor.solutions_count} Solusi
                                                                        </span>
                                                                        <span className="badge bg-light text-dark border" style={{ fontSize: "0.68rem" }}>
                                                                            {contributor.score} XP
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 4. TAB CONTENT: FORUM PEMBELAJARAN (RUMPUN JABATAN) */}
                                    {activeTab === "learning-forum" && (
                                        <>
                                            {isLoading ? (
                                                <div className="forum-empty-card-compact">
                                                    <div className="spinner-border spinner-border-sm text-teal mb-2" role="status"></div>
                                                    <p className="mb-0 small text-muted">Memuat ruang diskusi...</p>
                                                </div>
                                            ) : safeTopics.length === 0 ? (
                                                <div className="forum-empty-card-compact">
                                                    <i className="fas fa-comments forum-empty-icon-compact"></i>
                                                    <h4 className="forum-empty-title-compact">Belum ada topik diskusi di rumpun ini</h4>
                                                    <p className="forum-empty-desc-compact">
                                                        Mulai pertukaran wawasan atau ajukan pertanyaan kompetensi bersama rekan-rekan pembelajar Setjen DPD RI!
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className="forum-btn-create-compact"
                                                        onClick={handleOpenCreateModal}
                                                    >
                                                        <i className="fas fa-pen-to-square"></i>
                                                        <span>Mulai Topik Pertama</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="forum-cards-list-compact">
                                                    {safeTopics.map((topic) => (
                                                        <div
                                                            key={topic.topic_id}
                                                            className={`forum-topic-card-compact ${topic.is_pinned ? "pinned" : ""}`}
                                                            onClick={() => handleOpenTopic(topic)}
                                                        >
                                                            <div className="card-top-meta">
                                                                <div className="card-badges-row">
                                                                    {topic.visibility === "internal_setjen" && (
                                                                        <span className="micro-badge-internal" title="Topik khusus pegawai Setjen DPD RI">
                                                                            <i className="fas fa-lock me-1"></i> Khusus Setjen
                                                                        </span>
                                                                    )}
                                                                    {topic.is_pinned && (
                                                                        <span className="micro-badge-pinned">
                                                                            <i className="fas fa-thumbtack"></i> Terpin
                                                                        </span>
                                                                    )}
                                                                    {topic.is_locked && (
                                                                        <span className="micro-badge-locked" title="Diskusi telah dikunci">
                                                                            <i className="fas fa-lock"></i> Terkunci
                                                                        </span>
                                                                    )}
                                                                    {topic.is_solved && (
                                                                        <span className="micro-badge-solved">
                                                                            <i className="fas fa-circle-check"></i> Terpecahkan
                                                                        </span>
                                                                    )}
                                                                    <span
                                                                        className="micro-badge-cat"
                                                                        style={{ backgroundColor: topic.category_detail?.badge_color || "#0d9488" }}
                                                                    >
                                                                        <i className={topic.category_detail?.icon || "fas fa-tag"}></i>
                                                                        <span>{topic.category_detail?.name}</span>
                                                                    </span>
                                                                </div>
                                                                <span className="card-time">
                                                                    {dayjs(topic.created_at).fromNow()}
                                                                </span>
                                                            </div>

                                                            <h3 className="card-title-compact">
                                                                {renderHighlightedText(topic.title, searchQuery)}
                                                            </h3>
                                                            <p className="card-snippet-compact">
                                                                {renderHighlightedText(stripMarkdown(topic.content, 160), searchQuery)}
                                                            </p>

                                                            <div className="card-bottom-meta">
                                                                <div className="card-author-compact">
                                                                    <img
                                                                        src={getUserAvatarUrl(topic.profile, topic.profile?.full_name)}
                                                                        alt={topic.profile?.full_name || "Anonim"}
                                                                        className="card-author-avatar-compact"
                                                                        onError={(e) => {
                                                                            e.target.onerror = null;
                                                                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(topic.profile?.full_name || "Anonim")}&size=96&background=0f766e&color=ffffff&bold=true`;
                                                                        }}
                                                                    />
                                                                    <span className="card-author-name-compact d-inline-flex align-items-center flex-wrap">
                                                                        <span>{topic.profile?.full_name || "Anonim"}</span>
                                                                        {renderAuthorBadges(topic.profile)}
                                                                    </span>
                                                                    <span className="card-author-dept-compact">
                                                                        • {topic.profile?.position_name || topic.profile?.organization_unit_name || "Peserta Setjen DPD RI"}
                                                                    </span>
                                                                </div>

                                                                <div className="card-stats-compact">
                                                                    <span
                                                                        className="stat-item-compact stat-share-btn"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleCopyTopicLink(topic.topic_id);
                                                                        }}
                                                                        style={{ cursor: "pointer" }}
                                                                        title="Salin tautan topik"
                                                                    >
                                                                        <i className="fas fa-share-nodes"></i>
                                                                    </span>
                                                                    <span
                                                                        className={`stat-item-compact ${topic.user_bookmarked ? "bookmarked" : ""}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleToggleTopicBookmark(topic.topic_id);
                                                                        }}
                                                                        style={{ cursor: "pointer" }}
                                                                        title={topic.user_bookmarked ? "Hapus dari favorit" : "Simpan topik"}
                                                                    >
                                                                        <i className={`${topic.user_bookmarked ? "fas text-teal" : "far"} fa-bookmark`}></i> {topic.bookmarks_count || 0}
                                                                    </span>
                                                                    <span className="stat-item-compact">
                                                                        <i className="fas fa-eye"></i> {topic.views_count || 0}
                                                                    </span>
                                                                    <span className="stat-item-compact">
                                                                        <i className="fas fa-comment-dots"></i> {topic.replies_count || 0}
                                                                    </span>
                                                                    <span
                                                                        className={`stat-item-compact ${topic.user_liked ? "liked" : ""}`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleToggleTopicLike(topic.topic_id);
                                                                        }}
                                                                        style={{ cursor: "pointer" }}
                                                                        title="Sukai topik ini"
                                                                    >
                                                                        <i className={`${topic.user_liked ? "fas" : "far"} fa-thumbs-up`}></i> {topic.likes_count || 0}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* 5. TAB CONTENT: FORUM DISKUSI KURSUS (AGGREGATED) */}
                                    {activeTab === "course-discussions" && (
                                        <>
                                            {isLoading ? (
                                                <div className="forum-empty-card-compact">
                                                    <div className="spinner-border spinner-border-sm text-teal mb-2" role="status"></div>
                                                    <p className="mb-0 small text-muted">Memuat diskusi kursus...</p>
                                                </div>
                                            ) : safeCourseDiscussions.length === 0 ? (
                                                <div className="forum-empty-card-compact">
                                                    <i className="fas fa-book-open-reader forum-empty-icon-compact"></i>
                                                    <h4 className="forum-empty-title-compact">Belum ada diskusi pada kursus yang Anda ikuti</h4>
                                                    <p className="forum-empty-desc-compact">
                                                        Jika Anda memiliki pertanyaan seputar materi video, modul, atau kuis saat
                                                        mempelajari kursus, Anda dapat langsung mengajukannya dari halaman materi kursus.
                                                    </p>
                                                    <Link to="/student/courses/" className="forum-btn-create-compact text-decoration-none">
                                                        <i className="fas fa-book-open"></i>
                                                        <span>Buka Kursus Saya</span>
                                                    </Link>
                                                </div>
                                            ) : (
                                                <div className="forum-cards-list-compact">
                                                    {safeCourseDiscussions.map((qa) => (
                                                        <div
                                                            key={qa.qa_id || qa.id}
                                                            className="forum-topic-card-compact"
                                                            onClick={() => handleOpenCourseQA(qa)}
                                                        >
                                                            <div className="card-top-meta">
                                                                <div className="card-badges-row">
                                                                    <span className="micro-badge-course">
                                                                        <i className="fas fa-graduation-cap"></i>
                                                                        <span>{qa.course_title || "Kursus"}</span>
                                                                    </span>
                                                                    {(qa.enrollment_id || qa.user_enrolled) && (
                                                                        <span className="badge bg-success-subtle text-success border border-success-subtle py-1 px-2" style={{ fontSize: "0.68rem" }}>
                                                                            <i className="fas fa-check-circle me-1"></i>
                                                                            Terdaftar
                                                                        </span>
                                                                    )}
                                                                    {qa.variant_item?.title && (
                                                                        <span className="badge bg-light text-dark border py-1 px-2" style={{ fontSize: "0.68rem" }}>
                                                                            <i className="fas fa-play-circle me-1 text-teal"></i>
                                                                            {qa.variant_item.title}
                                                                        </span>
                                                                    )}
                                                                    {qa.is_solved && (
                                                                        <span className="micro-badge-solved">
                                                                            <i className="fas fa-circle-check"></i> Terpecahkan
                                                                        </span>
                                                                    )}
                                                                    {qa.has_instructor_reply && (
                                                                        <span className="badge bg-primary text-white py-1 px-2" style={{ fontSize: "0.68rem" }}>
                                                                            <i className="fas fa-user-tie me-1"></i> Instruktur Merespon
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="card-time">
                                                                    {dayjs(qa.date).fromNow()}
                                                                </span>
                                                            </div>

                                                            <h3 className="card-title-compact">{qa.title}</h3>
                                                            {qa.messages?.[0]?.message && (
                                                                <p className="card-snippet-compact">{stripMarkdown(qa.messages[0].message, 160)}</p>
                                                            )}

                                                            <div className="card-bottom-meta">
                                                                <div className="card-author-compact">
                                                                    <img
                                                                        src={getUserAvatarUrl(qa.profile, qa.profile?.full_name)}
                                                                        alt={qa.profile?.full_name || "Peserta"}
                                                                        className="card-author-avatar-compact"
                                                                        onError={(e) => {
                                                                            e.target.onerror = null;
                                                                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(qa.profile?.full_name || "Peserta")}&size=96&background=0f766e&color=ffffff&bold=true`;
                                                                        }}
                                                                    />
                                                                    <span className="card-author-name-compact d-inline-flex align-items-center flex-wrap gap-1">
                                                                        <span>{qa.profile?.full_name || "Peserta"}</span>
                                                                        <DPDRIRoleBadges 
                                                                            profile={qa.profile} 
                                                                            isAsker={true}
                                                                            isCurrentUser={qa.user_id === userData?.user_id || qa.user?.id === userData?.user_id}
                                                                        />
                                                                    </span>
                                                                    <span className="card-author-dept-compact">
                                                                        • {qa.profile?.position_name || qa.profile?.organization_unit_name || "Internal Setjen DPD RI"}
                                                                    </span>
                                                                </div>

                                                                <div className="card-stats-compact">
                                                                    <button
                                                                        type="button"
                                                                        className={`btn-like-pill-compact ${qa.user_liked ? 'liked' : ''}`}
                                                                        onClick={(e) => handleToggleCourseQALike(qa, e)}
                                                                        title="Suka pertanyaan kursus ini"
                                                                    >
                                                                        <i className={qa.user_liked ? "fas fa-thumbs-up" : "far fa-thumbs-up"}></i>
                                                                        <span>{qa.likes_count || 0}</span>
                                                                    </button>
                                                                    <span className="stat-item-compact">
                                                                        <i className="fas fa-comment-dots"></i> {qa.replies_count || 0} Balasan
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-open-course-compact"
                                                                        onClick={(e) => handleNavigateToCourse(qa, e)}
                                                                        title={qa.enrollment_id ? "Buka di Kursus Saya" : "Buka di Kursus"}
                                                                    >
                                                                        <i className="fas fa-arrow-up-right-from-square"></i>
                                                                        <span>{qa.enrollment_id ? "Buka di Kursus Saya" : "Buka di Kursus"}</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* 6. TAB CONTENT: DISKUSI SAYA */}
                                    {activeTab === "my-discussions" && (
                                        <div className="forum-cards-list-compact">
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <span className="small fw-bold text-secondary">
                                                    <i className="fas fa-user-pen me-1 text-teal"></i>
                                                    Topik Pembelajaran yang Saya Ikuti ({myTopics.length})
                                                </span>
                                            </div>

                                            {myTopics.length === 0 ? (
                                                <div className="forum-empty-card-compact mb-3">
                                                    <p className="mb-0 small text-muted">Anda belum memiliki topik di Forum Pembelajaran.</p>
                                                </div>
                                            ) : (
                                                myTopics.map((topic) => (
                                                    <div
                                                        key={topic.topic_id}
                                                        className="forum-topic-card-compact"
                                                        onClick={() => handleOpenTopic(topic)}
                                                    >
                                                        <div className="card-top-meta">
                                                            <span
                                                                className="micro-badge-cat"
                                                                style={{ backgroundColor: topic.category_detail?.badge_color || "#0d9488" }}
                                                            >
                                                                {topic.category_detail?.name}
                                                            </span>
                                                            <span className="card-time">{dayjs(topic.created_at).fromNow()}</span>
                                                        </div>
                                                        <h4 className="card-title-compact">
                                                            {renderHighlightedText(topic.title, searchQuery)}
                                                        </h4>
                                                        <p className="card-snippet-compact">
                                                            {renderHighlightedText(stripMarkdown(topic.content, 160), searchQuery)}
                                                        </p>
                                                    </div>
                                                ))
                                            )}

                                            <div className="d-flex align-items-center justify-content-between mt-3 mb-2">
                                                <span className="small fw-bold text-secondary">
                                                    <i className="fas fa-book-bookmark me-1 text-primary"></i>
                                                    Diskusi Kursus yang Saya Ikuti ({myCourseDiscussions.length})
                                                </span>
                                            </div>

                                            {myCourseDiscussions.length === 0 ? (
                                                <div className="forum-empty-card-compact">
                                                    <p className="mb-0 small text-muted">Anda belum pernah bertanya pada materi kursus.</p>
                                                </div>
                                            ) : (
                                                myCourseDiscussions.map((qa) => (
                                                    <div
                                                        key={qa.qa_id || qa.id}
                                                        className="forum-topic-card-compact"
                                                        onClick={() => handleOpenCourseQA(qa)}
                                                    >
                                                        <div className="card-top-meta">
                                                             <span className="micro-badge-course">{qa.course_title}</span>
                                                             <span className="card-time">{dayjs(qa.date).fromNow()}</span>
                                                        </div>
                                                        <h4 className="card-title-compact">{qa.title}</h4>
                                                        {qa.messages?.[0]?.message && (
                                                            <p className="card-snippet-compact">{stripMarkdown(qa.messages[0].message, 160)}</p>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* =========================================================================
                MODAL: BUAT TOPIK BARU (COMPACT)
                ========================================================================= */}
            {isCreateModalOpen && (
                <div className="forum-modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
                    <div className="forum-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="forum-modal-header">
                            <h3 className="forum-modal-title">
                                <i className="fas fa-pen-to-square me-2 text-teal"></i>
                                Buat Topik Forum Pembelajaran
                            </h3>
                            <button
                                type="button"
                                className="forum-modal-close-btn"
                                onClick={() => setIsCreateModalOpen(false)}
                            >
                                <i className="fas fa-xmark"></i>
                            </button>
                        </div>

                        <form onSubmit={handleCreateTopicSubmit}>
                            <div className="forum-modal-body">
                                <div className="forum-form-group-compact">
                                    <label className="forum-form-label-compact">Rumpun Jabatan / Kompetensi</label>
                                    <select
                                        className="forum-form-control-compact"
                                        value={createCategory}
                                        onChange={(e) => setCreateCategory(e.target.value)}
                                        required
                                    >
                                        <option value="">-- Pilih Rumpun / Kategori --</option>
                                        {safeCategories.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="forum-form-group-compact">
                                    <label className="forum-form-label-compact">Judul Topik Diskusi</label>
                                    <input
                                        type="text"
                                        className="forum-form-control-compact"
                                        placeholder="Tuliskan judul bahasan yang ringkas dan jelas..."
                                        value={createTitle}
                                        onChange={(e) => setCreateTitle(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="forum-form-group-compact">
                                    <label className="forum-form-label-compact">Uraian / Pertanyaan Diskusi</label>
                                    <textarea
                                        className="forum-form-control-compact"
                                        rows={4}
                                        placeholder="Jelaskan pertanyaan, konteks pelaksanaan tugas di Setjen, atau wawasan yang ingin didiskusikan..."
                                        value={createContent}
                                        onChange={(e) => setCreateContent(e.target.value)}
                                        required
                                    ></textarea>
                                </div>

                                <div className="forum-form-group-compact">
                                    <label className="forum-form-label-compact">Lampiran Dokumen / Gambar (Opsional)</label>
                                    <input
                                        type="file"
                                        className="forum-form-control-compact"
                                        onChange={(e) => setCreateFile(e.target.files[0] || null)}
                                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
                                    />
                                </div>

                                <div className="forum-form-group-compact">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <label className="forum-form-label-compact mb-0 d-flex align-items-center gap-1">
                                            <i className="fas fa-square-poll-vertical text-teal"></i>
                                            <span>Sertakan Jajak Pendapat / Polling (Opsional)</span>
                                        </label>
                                        <div className="form-check form-switch m-0">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="createHasPollToggle"
                                                checked={createHasPoll}
                                                onChange={(e) => setCreateHasPoll(e.target.checked)}
                                                style={{ cursor: "pointer" }}
                                            />
                                        </div>
                                    </div>

                                    {createHasPoll && (
                                        <div className="forum-poll-builder-box p-3 border rounded bg-white mt-2">
                                            <div className="mb-2">
                                                <label className="small fw-bold text-dark mb-1">Pertanyaan Polling</label>
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm"
                                                    placeholder="Tuliskan pertanyaan polling (misal: Apakah Anda sepakat dengan draft SOP ini?)"
                                                    value={createPollQuestion}
                                                    onChange={(e) => setCreatePollQuestion(e.target.value)}
                                                    required={createHasPoll}
                                                />
                                            </div>

                                            <label className="small fw-bold text-dark mb-1">Pilihan Opsi Jawaban (Minimal 2, Maksimal 5)</label>
                                            <div className="d-flex flex-column gap-2 mb-2">
                                                {createPollOptions.map((opt, idx) => (
                                                    <div key={idx} className="d-flex align-items-center gap-2">
                                                        <span className="small text-muted fw-bold" style={{ width: "20px" }}>{idx + 1}.</span>
                                                        <input
                                                            type="text"
                                                            className="form-control form-control-sm"
                                                            placeholder={`Teks Opsi ${idx + 1}`}
                                                            value={opt}
                                                            onChange={(e) => {
                                                                const newOpts = [...createPollOptions];
                                                                newOpts[idx] = e.target.value;
                                                                setCreatePollOptions(newOpts);
                                                            }}
                                                            required={createHasPoll && idx < 2}
                                                        />
                                                        {createPollOptions.length > 2 && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-danger p-1 px-2"
                                                                onClick={() => {
                                                                    setCreatePollOptions(createPollOptions.filter((_, i) => i !== idx));
                                                                }}
                                                                title="Hapus opsi"
                                                            >
                                                                <i className="fas fa-trash-can"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {createPollOptions.length < 5 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-teal"
                                                    onClick={() => setCreatePollOptions([...createPollOptions, ""])}
                                                >
                                                    <i className="fas fa-plus me-1"></i> Tambah Pilihan Opsi
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {isInternalSetjen && (
                                    <div className="forum-form-group-compact">
                                        <label className="forum-form-label-compact d-flex align-items-center justify-content-between">
                                            <span>Hak Akses & Visibilitas Topik</span>
                                            <span className="badge bg-light text-teal border" style={{ fontSize: "0.68rem" }}>
                                                <i className="fas fa-building-columns me-1"></i>Internal Setjen DPD RI
                                            </span>
                                        </label>
                                        <div className="forum-visibility-selector">
                                            <label className={`visibility-option-card ${createVisibility === "public" ? "selected" : ""}`}>
                                                <input
                                                    type="radio"
                                                    name="createVisibility"
                                                    value="public"
                                                    checked={createVisibility === "public"}
                                                    onChange={() => setCreateVisibility("public")}
                                                    className="d-none"
                                                />
                                                <div className="visibility-icon-box public">
                                                    <i className="fas fa-globe"></i>
                                                </div>
                                                <div className="visibility-text">
                                                    <span className="visibility-title">Publik (Semua Pengguna LMS)</span>
                                                    <span className="visibility-desc">Dapat diakses & didiskusikan oleh seluruh peserta kursus & masyarakat umum</span>
                                                </div>
                                            </label>
                                            <label className={`visibility-option-card ${createVisibility === "internal_setjen" ? "selected" : ""}`}>
                                                <input
                                                    type="radio"
                                                    name="createVisibility"
                                                    value="internal_setjen"
                                                    checked={createVisibility === "internal_setjen"}
                                                    onChange={() => setCreateVisibility("internal_setjen")}
                                                    className="d-none"
                                                />
                                                <div className="visibility-icon-box internal">
                                                    <i className="fas fa-lock"></i>
                                                </div>
                                                <div className="visibility-text">
                                                    <span className="visibility-title">Khusus Internal Pegawai Setjen DPD RI</span>
                                                    <span className="visibility-desc">Hanya dapat diakses & didiskusikan oleh sesama pegawai Sekretariat Jenderal DPD RI</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-2 px-3 border-top d-flex justify-content-end gap-2 bg-light">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light"
                                    onClick={() => setIsCreateModalOpen(false)}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn-forum-submit-compact"
                                    disabled={isSubmittingTopic}
                                >
                                    {isSubmittingTopic ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-1"></span>
                                            Menerbitkan...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-paper-plane me-1"></i> Terbitkan Topik
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL: EDIT TOPIK FORUM (COMPACT)
                ========================================================================= */}
            {isEditTopicModalOpen && (
                <div className="forum-modal-backdrop" onClick={() => setIsEditTopicModalOpen(false)}>
                    <div className="forum-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="forum-modal-header">
                            <h3 className="forum-modal-title">
                                <i className="fas fa-pen-to-square me-2 text-teal"></i>
                                Edit Topik Forum Pembelajaran
                            </h3>
                            <button
                                type="button"
                                className="forum-modal-close-btn"
                                onClick={() => setIsEditTopicModalOpen(false)}
                            >
                                <i className="fas fa-xmark"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSaveEditTopic}>
                            <div className="forum-modal-body">
                                <div className="forum-form-group-compact">
                                    <label className="forum-form-label-compact">Rumpun Jabatan / Kompetensi</label>
                                    <select
                                        className="forum-form-control-compact"
                                        value={editTopicCategory}
                                        onChange={(e) => setEditTopicCategory(e.target.value)}
                                        required
                                    >
                                        <option value="">-- Pilih Rumpun / Kategori --</option>
                                        {safeCategories.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="forum-form-group-compact">
                                    <label className="forum-form-label-compact">Judul Topik Diskusi</label>
                                    <input
                                        type="text"
                                        className="forum-form-control-compact"
                                        placeholder="Tuliskan judul bahasan yang ringkas dan jelas..."
                                        value={editTopicTitle}
                                        onChange={(e) => setEditTopicTitle(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="forum-form-group-compact">
                                    <label className="forum-form-label-compact">Uraian / Pertanyaan Diskusi</label>
                                    <textarea
                                        className="forum-form-control-compact"
                                        rows={4}
                                        placeholder="Jelaskan pertanyaan atau wawasan yang ingin didiskusikan..."
                                        value={editTopicContent}
                                        onChange={(e) => setEditTopicContent(e.target.value)}
                                        required
                                    ></textarea>
                                </div>

                                <div className="forum-form-group-compact">
                                    <label className="forum-form-label-compact">Ganti/Unggah Lampiran Baru (Opsional)</label>
                                    <input
                                        type="file"
                                        className="forum-form-control-compact"
                                        onChange={(e) => setEditTopicFile(e.target.files[0] || null)}
                                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip"
                                    />
                                </div>

                                {isInternalSetjen && (
                                    <div className="forum-form-group-compact">
                                        <label className="forum-form-label-compact d-flex align-items-center justify-content-between">
                                            <span>Hak Akses & Visibilitas Topik</span>
                                            <span className="badge bg-light text-teal border" style={{ fontSize: "0.68rem" }}>
                                                <i className="fas fa-building-columns me-1"></i>Internal Setjen DPD RI
                                            </span>
                                        </label>
                                        <div className="forum-visibility-selector">
                                            <label className={`visibility-option-card ${editTopicVisibility === "public" ? "selected" : ""}`}>
                                                <input
                                                    type="radio"
                                                    name="editTopicVisibility"
                                                    value="public"
                                                    checked={editTopicVisibility === "public"}
                                                    onChange={() => setEditTopicVisibility("public")}
                                                    className="d-none"
                                                />
                                                <div className="visibility-icon-box public">
                                                    <i className="fas fa-globe"></i>
                                                </div>
                                                <div className="visibility-text">
                                                    <span className="visibility-title">Publik (Semua Pengguna LMS)</span>
                                                    <span className="visibility-desc">Dapat diakses & didiskusikan oleh seluruh peserta</span>
                                                </div>
                                            </label>
                                            <label className={`visibility-option-card ${editTopicVisibility === "internal_setjen" ? "selected" : ""}`}>
                                                <input
                                                    type="radio"
                                                    name="editTopicVisibility"
                                                    value="internal_setjen"
                                                    checked={editTopicVisibility === "internal_setjen"}
                                                    onChange={() => setEditTopicVisibility("internal_setjen")}
                                                    className="d-none"
                                                />
                                                <div className="visibility-icon-box internal">
                                                    <i className="fas fa-lock"></i>
                                                </div>
                                                <div className="visibility-text">
                                                    <span className="visibility-title">Khusus Internal Pegawai Setjen DPD RI</span>
                                                    <span className="visibility-desc">Hanya untuk sesama pegawai Sekretariat Jenderal DPD RI</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-2 px-3 border-top d-flex justify-content-end gap-2 bg-light">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light"
                                    onClick={() => setIsEditTopicModalOpen(false)}
                                    disabled={isSubmittingEditTopic}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn-forum-submit-compact"
                                    disabled={isSubmittingEditTopic}
                                >
                                    {isSubmittingEditTopic ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-1"></span>
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-check me-1"></i> Simpan Perubahan
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL: LIGHTBOX IMAGE PREVIEW
                ========================================================================= */}
            {activePreviewImage && (
                <div className="forum-lightbox-backdrop" onClick={() => setActivePreviewImage(null)}>
                    <div className="forum-lightbox-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="forum-lightbox-header">
                            <span className="forum-lightbox-title">
                                <i className="fas fa-image text-teal me-2"></i>
                                Pratinjau Gambar Lampiran
                            </span>
                            <div className="d-flex align-items-center gap-2">
                                <a
                                    href={activePreviewImage}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline-secondary"
                                    download
                                >
                                    <i className="fas fa-download me-1"></i> Unduh Asli
                                </a>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light"
                                    onClick={() => setActivePreviewImage(null)}
                                >
                                    <i className="fas fa-xmark"></i>
                                </button>
                            </div>
                        </div>
                        <div className="forum-lightbox-body">
                            <img src={activePreviewImage} alt="Lampiran Penuh" className="forum-lightbox-img" />
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL: LAPORKAN KONTEN FORUM (REPORT / FLAGGING)
                ========================================================================= */}
            {isReportModalOpen && (
                <div className="forum-modal-backdrop" onClick={() => setIsReportModalOpen(false)}>
                    <div className="forum-modal-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="forum-modal-header bg-danger-subtle text-danger">
                            <h3 className="forum-modal-title text-danger">
                                <i className="fas fa-triangle-exclamation me-2"></i>
                                Laporkan Konten ke Administrator
                            </h3>
                            <button
                                type="button"
                                className="forum-modal-close-btn"
                                onClick={() => setIsReportModalOpen(false)}
                            >
                                <i className="fas fa-xmark"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSubmitReport}>
                            <div className="forum-modal-body">
                                <p className="small text-muted mb-3">
                                    Bantu menjaga ekosistem pembelajaran yang sehat, profesional, dan sesuai dengan kode etik ASN Setjen DPD RI.
                                    Laporan Anda akan ditinjau secara rahasia oleh tim Administrator.
                                </p>

                                <div className="forum-form-group-compact">
                                    <label className="forum-form-label-compact">Alasan Pelaporan</label>
                                    <select
                                        className="forum-form-control-compact"
                                        value={reportReason}
                                        onChange={(e) => setReportReason(e.target.value)}
                                        required
                                    >
                                        <option value="inappropriate">Bahasa Tidak Pantas / Pelanggaran Etika ASN</option>
                                        <option value="spam">Spam / Iklan / Konten Tidak Relevan</option>
                                        <option value="misleading">Informasi Menyesatkan / Hoaks</option>
                                        <option value="harassment">Pelecehan / Ujaran Kebencian</option>
                                        <option value="other">Lainnya</option>
                                    </select>
                                </div>

                                <div className="forum-form-group-compact">
                                    <label className="forum-form-label-compact">Catatan Tambahan (Opsional)</label>
                                    <textarea
                                        className="forum-form-control-compact"
                                        rows={3}
                                        placeholder="Berikan keterangan singkat mengapa konten ini perlu ditinjau..."
                                        value={reportDescription}
                                        onChange={(e) => setReportDescription(e.target.value)}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="p-2 px-3 border-top d-flex justify-content-end gap-2 bg-light">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light"
                                    onClick={() => setIsReportModalOpen(false)}
                                    disabled={isSubmittingReport}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-sm btn-danger px-3 font-weight-bold"
                                    disabled={isSubmittingReport}
                                >
                                    {isSubmittingReport ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-1"></span>
                                            Mengirim Laporan...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-paper-plane me-1"></i> Kirim Laporan
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                MODAL: STATUS & PROGRES LAPORAN ADUAN
                ========================================================================= */}
            {activeReportStatus && (
                <div className="forum-modal-backdrop" onClick={() => setActiveReportStatus(null)}>
                    <div className="forum-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                        <div className="forum-modal-header bg-amber-subtle" style={{ background: "#fffbeb", borderBottomColor: "#fde68a" }}>
                            <h3 className="forum-modal-title" style={{ color: "#b45309" }}>
                                <i className="fas fa-shield-halved me-2"></i>
                                Status Laporan Aduan
                            </h3>
                            <button
                                type="button"
                                className="forum-modal-close-btn"
                                onClick={() => setActiveReportStatus(null)}
                            >
                                <i className="fas fa-xmark"></i>
                            </button>
                        </div>

                        <div className="forum-modal-body">
                            {/* Status Tracker Banner */}
                            {activeReportStatus.status === "pending" && (
                                <div className="p-3 rounded border border-warning-subtle bg-warning-subtle text-warning-emphasis">
                                    <div className="d-flex align-items-center gap-2 mb-1 fw-bold">
                                        <span className="spinner-grow spinner-grow-sm text-warning" role="status"></span>
                                        Menunggu Tinjauan Administrator
                                    </div>
                                    <p className="small mb-0">
                                        Laporan Anda telah berhasil terdaftar dalam sistem dan saat ini berada dalam antrean prioritas peninjauan oleh tim Administrator Setjen DPD RI.
                                    </p>
                                </div>
                            )}

                            {activeReportStatus.status === "reviewed" && (
                                <div className="p-3 rounded border border-primary-subtle bg-primary-subtle text-primary-emphasis">
                                    <div className="d-flex align-items-center gap-2 mb-1 fw-bold">
                                        <i className="fas fa-magnifying-glass"></i>
                                        Sedang Ditinjau oleh Administrator
                                    </div>
                                    <p className="small mb-0">
                                        Administrator sedang mempelajari aduan Anda dan meneliti konten terkait untuk memastikan kepatuhan terhadap kode etik forum.
                                    </p>
                                </div>
                            )}

                            {activeReportStatus.status === "resolved" && (
                                <div className="p-3 rounded border border-success-subtle bg-success-subtle text-success-emphasis">
                                    <div className="d-flex align-items-center gap-2 mb-1 fw-bold">
                                        <i className="fas fa-circle-check"></i>
                                        Laporan Telah Diselesaikan
                                    </div>
                                    <p className="small mb-0">
                                        Laporan telah ditindaklanjuti oleh Administrator. Terima kasih atas kepedulian Anda dalam menjaga etika komunikasi di platform ini.
                                    </p>
                                </div>
                            )}

                            {activeReportStatus.status === "dismissed" && (
                                <div className="p-3 rounded border border-secondary-subtle bg-secondary-subtle text-secondary-emphasis">
                                    <div className="d-flex align-items-center gap-2 mb-1 fw-bold">
                                        <i className="fas fa-circle-info"></i>
                                        Laporan Dinilai Tidak Melanggar
                                    </div>
                                    <p className="small mb-0">
                                        Setelah melalui verifikasi dan penelaahan mendalam, Administrator menilai konten ini masih dalam batas wajar diskusi atau tidak terbukti melanggar tata tertib.
                                    </p>
                                </div>
                            )}

                            {/* Report Details Information */}
                            <div className="p-3 rounded border bg-light">
                                <h6 className="fw-bold mb-2 small text-dark border-bottom pb-1">
                                    <i className="fas fa-file-lines me-1 text-teal"></i> Rincian Aduan yang Anda Kirim:
                                </h6>
                                <div className="d-flex flex-column gap-2 small">
                                    <div>
                                        <span className="text-muted d-block">Target yang Dilaporkan:</span>
                                        <strong className="text-dark">
                                            {activeReportStatus.isTopic 
                                                ? `Topik: "${activeReportStatus.topicTitle || 'Topik Forum'}"`
                                                : `Balasan dari: "${activeReportStatus.replyAuthor || 'Peserta'}"`
                                            }
                                        </strong>
                                    </div>
                                    <div>
                                        <span className="text-muted d-block">Alasan Pelaporan:</span>
                                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                            {activeReportStatus.reason_display || activeReportStatus.reason}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted d-block">Waktu Pelaporan:</span>
                                        <span className="text-dark">
                                            <i className="far fa-clock me-1 text-muted"></i>
                                            {activeReportStatus.created_at ? dayjs(activeReportStatus.created_at).format("DD MMMM YYYY, HH:mm [WIB]") : "-"}
                                        </span>
                                    </div>
                                    {activeReportStatus.description && (
                                        <div>
                                            <span className="text-muted d-block">Catatan yang Anda Sertakan:</span>
                                            <div className="p-2 rounded bg-white border mt-1 fst-italic text-dark">
                                                "{activeReportStatus.description}"
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Admin Feedback / Notes if exists */}
                            {activeReportStatus.admin_notes && (
                                <div className="p-3 rounded border border-info-subtle bg-info-subtle text-info-emphasis">
                                    <h6 className="fw-bold mb-1 small">
                                        <i className="fas fa-user-shield me-1"></i> Tanggapan / Catatan Administrator:
                                    </h6>
                                    <pre className="mb-0 small text-dark font-sans" style={{ whiteSpace: "pre-wrap", background: "transparent", border: "none", padding: 0 }}>
                                        {activeReportStatus.admin_notes}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div className="p-2 px-3 border-top d-flex justify-content-between align-items-center bg-light">
                            {activeReportStatus.status === "pending" ? (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleCancelReport(activeReportStatus.id)}
                                    disabled={isCancellingReport}
                                >
                                    {isCancellingReport ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-1"></span>
                                            Membatalkan...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-trash-arrow-up me-1"></i> Batalkan Aduan Ini
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div></div>
                            )}
                            <button
                                type="button"
                                className="btn btn-sm btn-secondary px-3"
                                onClick={() => setActiveReportStatus(null)}
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox Modal for Attachment Images */}
            <QAImageLightboxModal
                imageUrl={lightboxImage?.url}
                imageName={lightboxImage?.name}
                show={Boolean(lightboxImage)}
                onHide={() => setLightboxImage(null)}
            />

            <BaseFooter />
        </>
    );
}

export default React.memo(Forum);
