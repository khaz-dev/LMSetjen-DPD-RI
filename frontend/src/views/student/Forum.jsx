import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
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

function Forum() {
    const navigate = useNavigate();
    const userData = UserData();

    // -------------------------------------------------------------------------
    // State: Tabs & Filters
    // -------------------------------------------------------------------------
    const [activeTab, setActiveTab] = useState("learning-forum"); // 'learning-forum' | 'course-discussions' | 'my-discussions'
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'solved' | 'unanswered' | 'pinned'
    const [sortBy, setSortBy] = useState("newest"); // 'newest' | 'popular' | 'active'

    // -------------------------------------------------------------------------
    // State: Data Storage
    // -------------------------------------------------------------------------
    const [categories, setCategories] = useState([]);
    const [topics, setTopics] = useState([]);
    const [courseDiscussions, setCourseDiscussions] = useState([]);
    const [enrolledCourses, setEnrolledCourses] = useState([]);
    const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");

    // -------------------------------------------------------------------------
    // State: UI & In-Place Thread Views
    // -------------------------------------------------------------------------
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [viewingTopic, setViewingTopic] = useState(null); // In-place active topic thread
    const [viewingCourseQA, setViewingCourseQA] = useState(null); // In-place active course QA
    const [isCollapsed, setIsCollapsed] = useState(false);

    // -------------------------------------------------------------------------
    // State: Forms (Create Topic & Reply)
    // -------------------------------------------------------------------------
    const [createCategory, setCreateCategory] = useState("");
    const [createTitle, setCreateTitle] = useState("");
    const [createContent, setCreateContent] = useState("");
    const [createFile, setCreateFile] = useState(null);
    const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);

    const [replyMessage, setReplyMessage] = useState("");
    const [replyFile, setReplyFile] = useState(null);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);

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

    useEffect(() => {
        fetchCategories();
        fetchEnrolledCourses();
    }, [fetchCategories, fetchEnrolledCourses]);

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

        setIsSubmittingTopic(true);
        try {
            const formData = new FormData();
            formData.append("category", createCategory);
            formData.append("title", createTitle.trim());
            formData.append("content", createContent.trim());
            if (createFile) {
                formData.append("file", createFile);
                formData.append("file_name", createFile.name);
            }

            const res = await useAxios.post("forum/topics/", formData);
            Toast().fire({ icon: "success", title: "Topik diskusi berhasil diterbitkan!" });

            setCreateTitle("");
            setCreateContent("");
            setCreateFile(null);
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

    // -------------------------------------------------------------------------
    // Open In-Place Topic Details & Thread
    // -------------------------------------------------------------------------
    const handleOpenTopic = async (topic) => {
        setViewingTopic(topic);
        setViewingCourseQA(null);
        window.scrollTo({ top: 120, behavior: "smooth" });
        try {
            const res = await useAxios.get(`forum/topics/${topic.topic_id}/`);
            setViewingTopic(res.data);
        } catch (err) {
            console.error("Error fetching topic detail:", err);
        }
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
    // Open In-Place Course QA Details
    // -------------------------------------------------------------------------
    const handleOpenCourseQA = (qa) => {
        setViewingCourseQA(qa);
        setViewingTopic(null);
        window.scrollTo({ top: 120, behavior: "smooth" });
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
                                            onClick={() => setViewingTopic(null)}
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

                                            {viewingTopic.is_pinned && (
                                                <span className="micro-badge-pinned">
                                                    <i className="fas fa-thumbtack"></i> Terpin
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
                                                    <div className="card-author-name-compact fw-bold">
                                                        {viewingTopic.profile?.full_name || "Anonim"}
                                                    </div>
                                                    <div className="card-author-dept-compact">
                                                        {viewingTopic.profile?.position_name || viewingTopic.profile?.organization_unit_name || "Internal Setjen DPD RI"}
                                                        <span className="mx-1">•</span>
                                                        {dayjs(viewingTopic.created_at).format("DD MMMM YYYY, HH:mm")} ({dayjs(viewingTopic.created_at).fromNow()})
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="thread-actions-quick">
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
                                            {viewingTopic.content}
                                        </div>

                                        {viewingTopic.file && (
                                            <div className="mt-3">
                                                <a
                                                    href={viewingTopic.file}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="thread-attachment-box"
                                                >
                                                    <i className="fas fa-paperclip"></i>
                                                    <span>{viewingTopic.file_name || "Unduh Dokumen Lampiran"}</span>
                                                    <i className="fas fa-arrow-down ms-2"></i>
                                                </a>
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
                                                    const canMarkSolution =
                                                        viewingTopic.user_id === userData?.user_id ||
                                                        userData?.role === "admin" ||
                                                        userData?.role === "teacher";

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
                                                                        <span className="card-author-name-compact fw-bold">
                                                                            {reply.profile?.full_name || "Rekan ASN"}
                                                                        </span>
                                                                        <span className="card-author-dept-compact ms-2">
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

                                                            <div className="reply-card-body">
                                                                {reply.message}
                                                            </div>

                                                            {reply.file && (
                                                                <a
                                                                    href={reply.file}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="thread-attachment-box mt-2"
                                                                >
                                                                    <i className="fas fa-paperclip"></i>
                                                                    <span>{reply.file_name || "Lampiran Jawaban"}</span>
                                                                    <i className="fas fa-arrow-down ms-2"></i>
                                                                </a>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* In-Place Reply Composer */}
                                        <div className="thread-inplace-reply-box">
                                            <h5 className="reply-box-title">
                                                <i className="fas fa-pen-nib text-teal me-2"></i>
                                                Beri Tanggapan atau Solusi
                                            </h5>
                                            <form onSubmit={handleSendReply}>
                                                <textarea
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
                                                    <div className="card-author-name-compact fw-bold">
                                                        {viewingCourseQA.profile?.full_name || "Penanya Kursus"}
                                                    </div>
                                                    <div className="card-author-dept-compact">
                                                        {dayjs(viewingCourseQA.date).format("DD MMMM YYYY, HH:mm")} ({dayjs(viewingCourseQA.date).fromNow()})
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                className="btn-open-course-compact"
                                                onClick={() => {
                                                    navigate(`/student/courses/${viewingCourseQA.course_pk || viewingCourseQA.course}/`);
                                                }}
                                            >
                                                <i className="fas fa-arrow-up-right-from-square"></i>
                                                <span>Buka di Player Kursus</span>
                                            </button>
                                        </div>

                                        <h1 className="thread-inplace-title">{viewingCourseQA.title}</h1>
                                        <div className="thread-inplace-body">
                                            {viewingCourseQA.messages?.[0]?.message || viewingCourseQA.title}
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
                                                    Belum ada tanggapan lain untuk pertanyaan kursus ini.
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
                                                                    <span className="card-author-name-compact fw-bold">
                                                                        {msg.profile?.full_name || "Pengguna"}
                                                                    </span>
                                                                    <span className="card-author-dept-compact ms-2">
                                                                        • {dayjs(msg.date).fromNow()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="reply-card-body">{msg.message}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* =========================================================================
                                   CARD LISTS (When no in-place thread is active)
                                   ========================================================================= */
                                <>
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
                                                                    {topic.is_pinned && (
                                                                        <span className="micro-badge-pinned">
                                                                            <i className="fas fa-thumbtack"></i> Terpin
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

                                                            <h3 className="card-title-compact">{topic.title}</h3>
                                                            <p className="card-snippet-compact">{topic.content}</p>

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
                                                                    <span className="card-author-name-compact">
                                                                        {topic.profile?.full_name || "Anonim"}
                                                                    </span>
                                                                    <span className="card-author-dept-compact">
                                                                        • {topic.profile?.position_name || topic.profile?.organization_unit_name || "Peserta Setjen DPD RI"}
                                                                    </span>
                                                                </div>

                                                                <div className="card-stats-compact">
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
                                                                <p className="card-snippet-compact">{qa.messages[0].message}</p>
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
                                                                    <span className="card-author-name-compact">
                                                                        {qa.profile?.full_name || "Peserta"}
                                                                    </span>
                                                                    <span className="card-author-dept-compact">
                                                                        • {qa.profile?.position_name || qa.profile?.organization_unit_name || "Internal Setjen DPD RI"}
                                                                    </span>
                                                                </div>

                                                                <div className="card-stats-compact">
                                                                    <span className="stat-item-compact">
                                                                        <i className="fas fa-comment-dots"></i> {qa.replies_count || 0} Balasan
                                                                    </span>
                                                                    <span className="stat-item-compact">
                                                                        <i className="far fa-thumbs-up"></i> {qa.likes_count || 0}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-open-course-compact"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigate(`/student/courses/${qa.course_pk || qa.course}/`);
                                                                        }}
                                                                    >
                                                                        <i className="fas fa-arrow-up-right-from-square"></i>
                                                                        <span>Buka di Kursus</span>
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
                                                        <h4 className="card-title-compact">{topic.title}</h4>
                                                        <p className="card-snippet-compact">{topic.content}</p>
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

            <BaseFooter />
        </>
    );
}

export default React.memo(Forum);
