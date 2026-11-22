import React, { useState, useEffect, useMemo, useCallback } from "react";
import apiInstance from "../../../utils/axios";
import UserData from "../../plugin/UserData";
import Toast from "../../plugin/Toast";
import Swal from "sweetalert2";
import dayjs, { moment } from "../../../utils/dayjs";

/**
 * Forum Administration & Moderation Tab
 * Comprehensive administrative interface for Forum Pembelajaran Setjen DPD RI:
 * 1. 🛡️ Moderasi Aduan & Laporan: Review, dismiss, resolve, lock, and delete reported content
 * 2. 🏷️ Kelola Rumpun Forum: Create, edit, toggle active, and delete forum categories (Rumpun Keahlian)
 * 3. 📚 Audit Seluruh Topik: Search, filter, pin/unpin, lock/unlock, and manage all learning topics
 */
function ForumReportsTab({ refreshTrigger = 0, onMutationSuccess }) {
    // Top Sub-Navigation: 'reports' | 'categories' | 'topics'
    const [adminSubTab, setAdminSubTab] = useState("reports");

    // =========================================================================
    // 1. STATE FOR REPORTS MODERATION
    // =========================================================================
    const [allReports, setAllReports] = useState([]);
    const [loadingReports, setLoadingReports] = useState(true);
    const [filterStatus, setFilterStatus] = useState("");
    const [filterType, setFilterType] = useState("all"); // 'all' | 'topic' | 'message'
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [selectedReport, setSelectedReport] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [detailStatus, setDetailStatus] = useState("resolved");
    const [detailNotes, setDetailNotes] = useState("");
    const userData = UserData();

    // =========================================================================
    // 2. STATE FOR CATEGORIES MANAGEMENT (RUMPUN FORUM)
    // =========================================================================
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [savingCategory, setSavingCategory] = useState(false);
    const [categoryForm, setCategoryForm] = useState({
        title: "",
        slug: "",
        description: "",
        icon: "fas fa-folder",
        badge_color: "#0d9488",
        order: 0,
        is_active: true,
    });

    // Preset Icons & Colors for Category Customization
    const PRESET_ICONS = [
        { label: "Folder", icon: "fas fa-folder" },
        { label: "Parlemen", icon: "fas fa-landmark" },
        { label: "Hukum & Regulasi", icon: "fas fa-scale-balanced" },
        { label: "Kepegawaian", icon: "fas fa-users-gear" },
        { label: "Tata Usaha", icon: "fas fa-briefcase" },
        { label: "Protokol", icon: "fas fa-file-signature" },
        { label: "Teknologi TI", icon: "fas fa-laptop-code" },
        { label: "Pengawasan & Audit", icon: "fas fa-shield-halved" },
        { label: "Akademik", icon: "fas fa-graduation-cap" },
        { label: "Diskusi", icon: "fas fa-comments" },
    ];

    const PRESET_COLORS = [
        { name: "Teal DPD", hex: "#0d9488" },
        { name: "Biru Parlemen", hex: "#2563eb" },
        { name: "Ungu Eksekutif", hex: "#7c3aed" },
        { name: "Kuning Kunyit", hex: "#d97706" },
        { name: "Merah Marun", hex: "#dc2626" },
        { name: "Hijau Emerald", hex: "#059669" },
        { name: "Sky Blue", hex: "#0284c7" },
        { name: "Slate Abu", hex: "#475569" },
    ];

    // =========================================================================
    // 3. STATE FOR TOPICS AUDIT & CONTROL
    // =========================================================================
    const [adminTopics, setAdminTopics] = useState([]);
    const [loadingTopics, setLoadingTopics] = useState(false);
    const [topicCatFilter, setTopicCatFilter] = useState("all");
    const [topicStatusFilter, setTopicStatusFilter] = useState("all"); // 'all' | 'pinned' | 'locked' | 'solved'
    const [topicSearchQuery, setTopicSearchQuery] = useState("");

    // =========================================================================
    // API FETCHERS
    // =========================================================================
    const fetchForumReports = useCallback(async () => {
        try {
            setLoadingReports(true);
            const response = await apiInstance.get("/admin/forum-reports/");
            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }
            setAllReports(data);
        } catch (error) {
            console.error("Error fetching forum reports:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat laporan forum",
                text: error.response?.data?.detail || error.response?.data?.error || "Terjadi kesalahan saat memuat data",
            });
        } finally {
            setLoadingReports(false);
        }
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            setLoadingCategories(true);
            const response = await apiInstance.get("/admin/forum/categories/");
            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }
            setCategories(data);
        } catch (error) {
            console.error("Error fetching categories:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat rumpun forum",
            });
        } finally {
            setLoadingCategories(false);
        }
    }, []);

    const fetchAdminTopics = useCallback(async () => {
        try {
            setLoadingTopics(true);
            const params = {};
            if (topicCatFilter !== "all") params.category_id = topicCatFilter;
            if (topicStatusFilter !== "all") params.status = topicStatusFilter;
            if (topicSearchQuery.trim()) params.search = topicSearchQuery.trim();

            const response = await apiInstance.get("/admin/forum/topics/", { params });
            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }
            setAdminTopics(data);
        } catch (error) {
            console.error("Error fetching admin topics:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat audit topik",
            });
        } finally {
            setLoadingTopics(false);
        }
    }, [topicCatFilter, topicStatusFilter, topicSearchQuery]);

    useEffect(() => {
        fetchForumReports();
        fetchCategories();
    }, [fetchForumReports, fetchCategories, refreshTrigger]);

    useEffect(() => {
        if (adminSubTab === "topics") {
            fetchAdminTopics();
        }
    }, [adminSubTab, fetchAdminTopics, refreshTrigger]);

    // Live counts computed from loaded records
    const counts = useMemo(() => {
        const total = allReports.length;
        const pending = allReports.filter((r) => r.status === "pending").length;
        const reviewed = allReports.filter((r) => r.status === "reviewed").length;
        const resolved = allReports.filter((r) => r.status === "resolved").length;
        const dismissed = allReports.filter((r) => r.status === "dismissed").length;
        const topicsCount = allReports.filter((r) => r.target_type === "topic").length;
        const messagesCount = allReports.filter((r) => r.target_type === "message").length;
        return { total, pending, reviewed, resolved, dismissed, topicsCount, messagesCount };
    }, [allReports]);

    // Filtered & sorted reports
    const filteredReports = useMemo(() => {
        return allReports
            .filter((report) => {
                if (filterStatus && report.status !== filterStatus) {
                    return false;
                }
                if (filterType !== "all" && report.target_type !== filterType) {
                    return false;
                }
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const idMatch = String(report.id).includes(q);
                    const reporterMatch = (report.reporter_details?.full_name || report.reporter_details?.username || "").toLowerCase().includes(q);
                    const topicTitle = (report.topic_details?.title || "").toLowerCase();
                    const topicAuthor = (report.topic_details?.author_name || "").toLowerCase();
                    const messageContent = (report.message_details?.message || "").toLowerCase();
                    const messageAuthor = (report.message_details?.author_name || "").toLowerCase();
                    const reasonMatch = (report.reason_display || report.reason || "").toLowerCase().includes(q);
                    const descMatch = (report.description || "").toLowerCase().includes(q);

                    if (!idMatch && !reporterMatch && !topicTitle.includes(q) && !topicAuthor.includes(q) &&
                        !messageContent.includes(q) && !messageAuthor.includes(q) && !reasonMatch && !descMatch) {
                        return false;
                    }
                }
                return true;
            })
            .sort((a, b) => {
                if (sortBy === "oldest") {
                    return new Date(a.created_at) - new Date(b.created_at);
                }
                return new Date(b.created_at) - new Date(a.created_at);
            });
    }, [allReports, filterStatus, filterType, searchQuery, sortBy]);

    // =========================================================================
    // REPORT MODERATION ACTIONS
    // =========================================================================
    const handleOpenDetailModal = (report) => {
        setSelectedReport(report);
        setDetailStatus(report.status === "pending" ? "resolved" : report.status);
        setDetailNotes(report.admin_notes || "");
        setShowDetailModal(true);
    };

    const handleSaveDetail = async (e) => {
        e.preventDefault();
        if (!selectedReport) return;

        try {
            setUpdating(true);
            const response = await apiInstance.patch(`/admin/forum-reports/${selectedReport.id}/`, {
                status: detailStatus,
                admin_notes: detailNotes,
            });

            Toast().fire({
                icon: "success",
                title: "Status Berhasil Diperbarui",
                text: response.data?.message || "Laporan moderasi telah diperbarui.",
            });

            setShowDetailModal(false);
            fetchForumReports();
            if (onMutationSuccess) onMutationSuccess();
        } catch (error) {
            console.error("Error updating forum report:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui status",
                text: error.response?.data?.error || "Terjadi kesalahan saat menyimpan pembaruan",
            });
        } finally {
            setUpdating(false);
        }
    };

    const handleToggleLockTopic = async (report) => {
        const topic = report.topic_details;
        if (!topic) return;

        const willLock = !topic.is_locked;
        const confirmResult = await Swal.fire({
            title: willLock ? "Kunci Topik Ini?" : "Buka Kunci Topik Ini?",
            text: willLock
                ? `Topik "${topic.title}" tidak akan dapat menerima balasan/tanggapan baru dari peserta.`
                : `Topik "${topic.title}" akan dibuka kembali sehingga peserta dapat membalas diskusi.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: willLock ? "#d97706" : "#0d9488",
            cancelButtonColor: "#64748b",
            confirmButtonText: willLock ? "Ya, Kunci Topik" : "Ya, Buka Kunci",
            cancelButtonText: "Batal",
        });

        if (!confirmResult.isConfirmed) return;

        try {
            const action = willLock ? "lock_topic" : "unlock_topic";
            const response = await apiInstance.patch(`/admin/forum-reports/${report.id}/`, { action });

            Toast().fire({
                icon: "success",
                title: willLock ? "Topik Dikunci" : "Topik Dibuka Kunci",
                text: response.data?.message || "Status kunci topik berhasil diubah.",
            });

            fetchForumReports();
            if (onMutationSuccess) onMutationSuccess();
        } catch (error) {
            console.error("Error toggling lock:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal mengubah status kunci",
                text: error.response?.data?.error || "Terjadi kesalahan",
            });
        }
    };

    const handleDeleteReportedContent = async (report) => {
        const isTopic = report.target_type === "topic";
        const targetTitle = isTopic
            ? `Topik "${report.topic_details?.title || "ini"}"`
            : `Balasan dari ${report.message_details?.author_name || "pengguna ini"}`;

        const confirmResult = await Swal.fire({
            title: isTopic ? "Hapus Topik Forum?" : "Hapus Balasan Forum?",
            html: `<p class="mb-2">Anda akan menghapus ${targetTitle} secara permanen dari Forum Pembelajaran.</p><p class="text-danger small mb-0"><i class="fas fa-exclamation-triangle me-1"></i> Tindakan ini tidak dapat dibatalkan!</p>`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus Permanen",
            cancelButtonText: "Batal",
        });

        if (!confirmResult.isConfirmed) return;

        try {
            const action = isTopic ? "delete_topic" : "delete_message";
            const response = await apiInstance.patch(`/admin/forum-reports/${report.id}/`, { action });

            Toast().fire({
                icon: "success",
                title: "Konten Dihapus",
                text: response.data?.message || "Konten yang dilaporkan berhasil dihapus dari forum.",
            });

            fetchForumReports();
            if (onMutationSuccess) onMutationSuccess();
        } catch (error) {
            console.error("Error deleting reported content:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal menghapus konten",
                text: error.response?.data?.error || "Terjadi kesalahan saat menghapus konten",
            });
        }
    };

    const handleQuickDismiss = async (report) => {
        const confirmResult = await Swal.fire({
            title: "Tolak Laporan?",
            text: "Laporan akan ditandai sebagai ditolak karena konten dinilai tidak melanggar tata tertib.",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#64748b",
            cancelButtonColor: "#cbd5e1",
            confirmButtonText: "Ya, Tolak Laporan",
            cancelButtonText: "Batal",
        });

        if (!confirmResult.isConfirmed) return;

        try {
            await apiInstance.patch(`/admin/forum-reports/${report.id}/`, {
                status: "dismissed",
                admin_notes: (report.admin_notes || "") + `\n[Admin]: Laporan ditolak - tidak ditemukan pelanggaran.`,
            });

            Toast().fire({
                icon: "info",
                title: "Laporan Ditolak",
                text: "Laporan telah ditandai sebagai tidak melanggar.",
            });

            fetchForumReports();
            if (onMutationSuccess) onMutationSuccess();
        } catch (error) {
            console.error("Error dismissing report:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal menolak laporan",
                text: error.response?.data?.error || "Terjadi kesalahan",
            });
        }
    };

    // =========================================================================
    // CATEGORY MANAGEMENT ACTIONS
    // =========================================================================
    const handleOpenCreateCategory = () => {
        setEditingCategory(null);
        setCategoryForm({
            title: "",
            slug: "",
            description: "",
            icon: "fas fa-folder",
            badge_color: "#0d9488",
            order: categories.length + 1,
            is_active: true,
        });
        setShowCategoryModal(true);
    };

    const handleOpenEditCategory = (cat) => {
        setEditingCategory(cat);
        setCategoryForm({
            title: cat.name || cat.title || "",
            slug: cat.slug || "",
            description: cat.description || "",
            icon: cat.icon || "fas fa-folder",
            badge_color: cat.badge_color || "#0d9488",
            order: cat.order || 0,
            is_active: Boolean(cat.is_active),
        });
        setShowCategoryModal(true);
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        if (!categoryForm.title.trim()) {
            Toast().fire({ icon: "warning", title: "Nama Rumpun Forum wajib diisi!" });
            return;
        }

        try {
            setSavingCategory(true);
            const payload = {
                title: categoryForm.title.trim(),
                slug: categoryForm.slug.trim() || undefined,
                description: categoryForm.description.trim(),
                icon: categoryForm.icon,
                badge_color: categoryForm.badge_color,
                order: parseInt(categoryForm.order, 10) || 0,
                is_active: Boolean(categoryForm.is_active),
            };

            if (editingCategory) {
                await apiInstance.patch(`/admin/forum/categories/${editingCategory.id}/`, payload);
                Toast().fire({ icon: "success", title: "Rumpun Forum berhasil diperbarui!" });
            } else {
                await apiInstance.post("/admin/forum/categories/", payload);
                Toast().fire({ icon: "success", title: "Rumpun Forum baru berhasil ditambahkan!" });
            }

            setShowCategoryModal(false);
            fetchCategories();
            if (onMutationSuccess) onMutationSuccess();
        } catch (error) {
            console.error("Error saving category:", error);
            const msg = error.response?.data?.title?.[0] || error.response?.data?.slug?.[0] || error.response?.data?.error || "Gagal menyimpan rumpun forum";
            Toast().fire({ icon: "error", title: msg });
        } finally {
            setSavingCategory(false);
        }
    };

    const handleToggleCategoryActive = async (cat) => {
        try {
            await apiInstance.patch(`/admin/forum/categories/${cat.id}/`, {
                is_active: !cat.is_active,
            });
            Toast().fire({
                icon: "info",
                title: !cat.is_active ? "Rumpun diaktifkan" : "Rumpun dinonaktifkan",
            });
            fetchCategories();
            if (onMutationSuccess) onMutationSuccess();
        } catch (error) {
            Toast().fire({ icon: "error", title: "Gagal mengubah status aktif rumpun" });
        }
    };

    const handleDeleteCategory = async (cat) => {
        if ((cat.topics_count || 0) > 0) {
            Swal.fire({
                title: "Tidak Dapat Dihapus",
                text: `Rumpun "${cat.name || cat.title}" masih memiliki ${cat.topics_count} topik diskusi aktif. Pindahkan atau hapus topiknya terlebih dahulu.`,
                icon: "warning",
                confirmButtonColor: "#0d9488",
            });
            return;
        }

        const confirm = await Swal.fire({
            title: `Hapus Rumpun Forum?`,
            text: `Rumpun "${cat.name || cat.title}" akan dihapus dari sistem.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus Rumpun",
            cancelButtonText: "Batal",
        });

        if (!confirm.isConfirmed) return;

        try {
            await apiInstance.delete(`/admin/forum/categories/${cat.id}/`);
            Toast().fire({ icon: "success", title: "Rumpun Forum berhasil dihapus!" });
            fetchCategories();
            if (onMutationSuccess) onMutationSuccess();
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: error.response?.data?.error || "Gagal menghapus rumpun",
            });
        }
    };

    // =========================================================================
    // TOPIC AUDIT ACTIONS
    // =========================================================================
    const handleToggleTopicPin = async (topic) => {
        try {
            const res = await apiInstance.post(`/forum/topics/${topic.id}/toggle-pin/`);
            Toast().fire({
                icon: "success",
                title: res.data?.is_pinned ? "Topik disematkan ke atas" : "Sematkan topik dibatalkan",
            });
            fetchAdminTopics();
        } catch (error) {
            Toast().fire({ icon: "error", title: "Gagal mengubah status semat topik" });
        }
    };

    const handleToggleTopicLock = async (topic) => {
        try {
            const res = await apiInstance.post(`/forum/topics/${topic.id}/toggle-lock/`);
            Toast().fire({
                icon: "info",
                title: res.data?.is_locked ? "Topik berhasil dikunci" : "Kunci topik dibuka kembali",
            });
            fetchAdminTopics();
        } catch (error) {
            Toast().fire({ icon: "error", title: "Gagal mengubah status kunci topik" });
        }
    };

    const handleDeleteTopic = async (topic) => {
        const confirm = await Swal.fire({
            title: "Hapus Topik Pembelajaran?",
            html: `<p class="mb-2">Anda akan menghapus topik <strong>"${topic.title}"</strong> beserta seluruh balasannya.</p><p class="text-danger small mb-0"><i class="fas fa-exclamation-triangle me-1"></i> Tindakan audit ini permanen!</p>`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: "Ya, Hapus Topik",
            cancelButtonText: "Batal",
        });

        if (!confirm.isConfirmed) return;

        try {
            await apiInstance.delete(`/forum/topics/${topic.id}/`);
            Toast().fire({ icon: "success", title: "Topik berhasil dihapus dari forum" });
            fetchAdminTopics();
            if (onMutationSuccess) onMutationSuccess();
        } catch (error) {
            Toast().fire({
                icon: "error",
                title: error.response?.data?.error || "Gagal menghapus topik",
            });
        }
    };

    // Helpers for Badges
    const renderReasonBadge = (reason, reasonDisplay) => {
        let badgeClass = "bg-secondary-subtle text-secondary";
        let icon = "fa-circle-exclamation";

        switch (reason) {
            case "spam":
                badgeClass = "bg-warning-subtle text-warning-emphasis border border-warning-subtle";
                icon = "fa-bullhorn";
                break;
            case "inappropriate":
                badgeClass = "bg-danger-subtle text-danger border border-danger-subtle";
                icon = "fa-user-slash";
                break;
            case "misleading":
                badgeClass = "bg-info-subtle text-info-emphasis border border-info-subtle";
                icon = "fa-triangle-exclamation";
                break;
            case "harassment":
                badgeClass = "bg-danger text-white";
                icon = "fa-shield-halved";
                break;
            default:
                badgeClass = "bg-secondary-subtle text-secondary";
                icon = "fa-flag";
        }

        return (
            <span className={`badge ${badgeClass} d-inline-flex align-items-center gap-1 px-2 py-1`}>
                <i className={`fas ${icon}`}></i>
                <span>{reasonDisplay || reason}</span>
            </span>
        );
    };

    const renderStatusBadge = (status) => {
        switch (status) {
            case "pending":
                return (
                    <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle d-inline-flex align-items-center gap-1 px-2 py-1">
                        <span className="kpi-pulse-dot position-relative top-0 right-0 me-1" style={{ width: 6, height: 6 }}></span>
                        Menunggu Reviu
                    </span>
                );
            case "reviewed":
                return (
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1 px-2 py-1">
                        <i className="fas fa-eye"></i> Ditinjau
                    </span>
                );
            case "resolved":
                return (
                    <span className="badge bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1 px-2 py-1">
                        <i className="fas fa-circle-check"></i> Terselesaikan
                    </span>
                );
            case "dismissed":
                return (
                    <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle d-inline-flex align-items-center gap-1 px-2 py-1">
                        <i className="fas fa-ban"></i> Ditolak
                    </span>
                );
            default:
                return <span className="badge bg-light text-dark">{status}</span>;
        }
    };

    return (
        <div className="forum-reports-tab-wrapper">
            {/* =========================================================================
               SUB-NAVBAR HEADER FOR FORUM MANAGEMENT & MODERATION
               ========================================================================= */}
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3 border-bottom pb-3">
                <div>
                    <h4 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                        <i className="fas fa-graduation-cap text-teal"></i>
                        Pusat Administrasi & Moderasi Forum Pembelajaran
                    </h4>
                    <p className="text-muted small mb-0">
                        Kelola rumpun keahlian forum, moderasi laporan pelanggaran etika diskusi, dan audit seluruh topik pembelajaran Setjen DPD RI.
                    </p>
                </div>
                <div className="nav nav-pills bg-light p-1 rounded-3 border">
                    <button
                        type="button"
                        className={`nav-link py-1 px-3 fw-bold ${adminSubTab === "reports" ? "active bg-teal text-white" : "text-muted"}`}
                        style={{ fontSize: "0.82rem" }}
                        onClick={() => setAdminSubTab("reports")}
                    >
                        <i className="fas fa-shield-halved me-1"></i>
                        Moderasi Aduan {counts.pending > 0 && <span className="badge bg-danger ms-1">{counts.pending}</span>}
                    </button>
                    <button
                        type="button"
                        className={`nav-link py-1 px-3 fw-bold ${adminSubTab === "categories" ? "active bg-teal text-white" : "text-muted"}`}
                        style={{ fontSize: "0.82rem" }}
                        onClick={() => setAdminSubTab("categories")}
                    >
                        <i className="fas fa-tags me-1"></i>
                        Kelola Rumpun Forum ({categories.length})
                    </button>
                    <button
                        type="button"
                        className={`nav-link py-1 px-3 fw-bold ${adminSubTab === "topics" ? "active bg-teal text-white" : "text-muted"}`}
                        style={{ fontSize: "0.82rem" }}
                        onClick={() => setAdminSubTab("topics")}
                    >
                        <i className="fas fa-list-check me-1"></i>
                        Audit Seluruh Topik
                    </button>
                </div>
            </div>

            {/* =========================================================================
               PANEL 1: MODERASI ADUAN & LAPORAN
               ========================================================================= */}
            {adminSubTab === "reports" && (
                <>
                    {/* 1. Live KPI Summary Metric Cards */}
                    <div className="kpi-metrics-grid mb-3">
                        <div
                            className={`kpi-card ${filterStatus === "" ? "active" : ""}`}
                            onClick={() => setFilterStatus("")}
                            title="Tampilkan semua laporan forum"
                        >
                            <div className="kpi-icon-box bg-teal-subtle text-teal">
                                <i className="fas fa-comments"></i>
                            </div>
                            <div className="kpi-content">
                                <span className="kpi-value">{counts.total}</span>
                                <span className="kpi-label">Semua Laporan</span>
                                <span className="kpi-subtext">{counts.topicsCount} Topik &bull; {counts.messagesCount} Balasan</span>
                            </div>
                        </div>

                        <div
                            className={`kpi-card ${filterStatus === "pending" ? "active" : ""}`}
                            onClick={() => setFilterStatus("pending")}
                            title="Filter laporan yang belum ditinjau"
                        >
                            {counts.pending > 0 && <span className="kpi-pulse-dot"></span>}
                            <div className="kpi-icon-box bg-warning-subtle text-warning">
                                <i className="fas fa-clock"></i>
                            </div>
                            <div className="kpi-content">
                                <span className="kpi-value text-warning-emphasis">{counts.pending}</span>
                                <span className="kpi-label">Perlu Ditinjau</span>
                                <span className="kpi-subtext">Menunggu tanggapan admin</span>
                            </div>
                        </div>

                        <div
                            className={`kpi-card ${filterStatus === "resolved" ? "active" : ""}`}
                            onClick={() => setFilterStatus("resolved")}
                            title="Filter laporan terselesaikan"
                        >
                            <div className="kpi-icon-box bg-success-subtle text-success">
                                <i className="fas fa-circle-check"></i>
                            </div>
                            <div className="kpi-content">
                                <span className="kpi-value text-success">{counts.resolved}</span>
                                <span className="kpi-label">Terselesaikan</span>
                                <span className="kpi-subtext">Tindakan telah diambil</span>
                            </div>
                        </div>

                        <div
                            className={`kpi-card ${filterStatus === "dismissed" ? "active" : ""}`}
                            onClick={() => setFilterStatus("dismissed")}
                            title="Filter laporan ditolak"
                        >
                            <div className="kpi-icon-box bg-secondary-subtle text-secondary">
                                <i className="fas fa-ban"></i>
                            </div>
                            <div className="kpi-content">
                                <span className="kpi-value text-secondary">{counts.dismissed}</span>
                                <span className="kpi-label">Ditolak / Valid</span>
                                <span className="kpi-subtext">Tidak melanggar aturan</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Interactive Filter & Search Bar */}
                    <div className="reports-filters-bar mb-3">
                        <div className="row g-2 align-items-center">
                            <div className="col-12 col-md-4">
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-white border-end-0">
                                        <i className="fas fa-search text-muted"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0"
                                        placeholder="Cari ID, pelapor, judul topik, isi balasan..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={() => setSearchQuery("")}
                                            title="Bersihkan pencarian"
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="col-6 col-md-3">
                                <select
                                    className="form-select form-select-sm"
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                >
                                    <option value="all">Semua Tipe Konten</option>
                                    <option value="topic">Hanya Topik Pembelajaran</option>
                                    <option value="message">Hanya Balasan / Tanggapan</option>
                                </select>
                            </div>

                            <div className="col-6 col-md-3">
                                <select
                                    className="form-select form-select-sm"
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                >
                                    <option value="">Semua Status Moderasi</option>
                                    <option value="pending">Menunggu Reviu</option>
                                    <option value="reviewed">Sedang Ditinjau</option>
                                    <option value="resolved">Terselesaikan</option>
                                    <option value="dismissed">Ditolak</option>
                                </select>
                            </div>

                            <div className="col-12 col-md-2 text-md-end">
                                <select
                                    className="form-select form-select-sm"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                >
                                    <option value="newest">Terbaru</option>
                                    <option value="oldest">Terlama</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 3. Main Data Table */}
                    <div className="reports-table-card">
                        {loadingReports ? (
                            <div className="p-5 text-center text-muted">
                                <span className="spinner-border spinner-border-sm me-2 text-teal"></span>
                                Memuat antrean laporan Forum Pembelajaran...
                            </div>
                        ) : filteredReports.length === 0 ? (
                            <div className="p-5 text-center text-muted">
                                <i className="fas fa-shield-heart fa-3x text-muted mb-3 opacity-50"></i>
                                <h6 className="fw-bold text-dark">Tidak ada laporan yang cocok</h6>
                                <p className="small mb-0">
                                    {searchQuery || filterStatus || filterType !== "all"
                                        ? "Coba ubah kriteria pencarian atau reset filter di atas."
                                        : "Bagus! Saat ini tidak ada laporan aduan konten yang menunggu penanganan admin."}
                                </p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0 reports-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: "5%" }}>ID</th>
                                            <th style={{ width: "13%" }}>Pelapor</th>
                                            <th style={{ width: "12%" }}>Alasan</th>
                                            <th style={{ width: "35%" }}>Konten yang Dilaporkan</th>
                                            <th style={{ width: "13%" }}>Status</th>
                                            <th style={{ width: "10%" }}>Waktu</th>
                                            <th style={{ width: "12%" }} className="text-end">Tindakan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredReports.map((report) => (
                                            <tr key={report.id} className={report.status === "pending" ? "table-warning-subtle" : ""}>
                                                <td className="fw-bold text-muted" style={{ fontSize: "0.78rem" }}>
                                                    #{report.id}
                                                </td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div
                                                            className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold bg-teal"
                                                            style={{ width: 26, height: 26, fontSize: "0.72rem", flexShrink: 0 }}
                                                        >
                                                            {(report.reporter_details?.full_name || report.reporter_details?.username || "A").charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="text-truncate" style={{ maxWidth: 120 }}>
                                                            <div className="fw-bold small text-truncate" title={report.reporter_details?.full_name || report.reporter_details?.username}>
                                                                {report.reporter_details?.full_name || report.reporter_details?.username || "Pengguna"}
                                                            </div>
                                                            <div className="text-muted" style={{ fontSize: "0.68rem" }}>
                                                                {report.reporter_details?.position_name || "Peserta"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {renderReasonBadge(report.reason, report.reason_display)}
                                                </td>
                                                <td>
                                                    <div className="report-target-box">
                                                        <div className="d-flex align-items-center gap-2 mb-1">
                                                            <span className={`badge ${report.target_type === "topic" ? "bg-teal-subtle text-teal" : "bg-primary-subtle text-primary"}`} style={{ fontSize: "0.68rem" }}>
                                                                <i className={`fas ${report.target_type === "topic" ? "fa-file-lines" : "fa-reply"} me-1`}></i>
                                                                {report.target_type === "topic" ? "Topik Pembelajaran" : "Balasan / Tanggapan"}
                                                            </span>
                                                            {report.topic_details?.is_locked && (
                                                                <span className="badge bg-warning text-dark" style={{ fontSize: "0.65rem" }}>
                                                                    <i className="fas fa-lock me-1"></i>Terkunci
                                                                </span>
                                                            )}
                                                        </div>
                                                        {report.target_type === "topic" && report.topic_details && (
                                                            <div>
                                                                <div className="fw-bold text-dark small text-truncate" title={report.topic_details.title}>
                                                                    {report.topic_details.title}
                                                                </div>
                                                                <div className="text-muted text-truncate" style={{ fontSize: "0.72rem" }}>
                                                                    Penulis: {report.topic_details.author_name} &bull; Rumpun: {report.topic_details.category_name || "Umum"}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {report.target_type === "message" && report.message_details && (
                                                            <div>
                                                                <div className="text-dark small text-truncate fst-italic" title={report.message_details.message}>
                                                                    "{report.message_details.message}"
                                                                </div>
                                                                <div className="text-muted text-truncate" style={{ fontSize: "0.72rem" }}>
                                                                    Oleh: {report.message_details.author_name} &bull; Topik: {report.message_details.topic_title || report.topic_details?.title}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {report.description && (
                                                            <div className="mt-1 p-1 bg-light rounded text-muted" style={{ fontSize: "0.7rem" }}>
                                                                <strong className="text-dark">Keterangan Pelapor:</strong> {report.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    {renderStatusBadge(report.status)}
                                                </td>
                                                <td style={{ fontSize: "0.75rem" }} className="text-muted">
                                                    <div>{dayjs(report.created_at).format("DD/MM/YY")}</div>
                                                    <div style={{ fontSize: "0.68rem" }}>{dayjs(report.created_at).format("HH:mm")} WIB</div>
                                                </td>
                                                <td className="text-end">
                                                    <div className="btn-group btn-group-sm">
                                                        <button
                                                            type="button"
                                                            className="btn btn-teal text-white"
                                                            onClick={() => handleOpenDetailModal(report)}
                                                            title="Tinjau & Putuskan Moderasi"
                                                        >
                                                            <i className="fas fa-gavel"></i>
                                                        </button>
                                                        {report.target_type === "topic" && report.topic_details && (
                                                            <button
                                                                type="button"
                                                                className={`btn ${report.topic_details.is_locked ? "btn-outline-warning" : "btn-outline-secondary"}`}
                                                                onClick={() => handleToggleLockTopic(report)}
                                                                title={report.topic_details.is_locked ? "Buka Kunci Topik" : "Kunci Topik"}
                                                            >
                                                                <i className={`fas ${report.topic_details.is_locked ? "fa-lock-open" : "fa-lock"}`}></i>
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDeleteReportedContent(report)}
                                                            title="Hapus Konten Permanen"
                                                        >
                                                            <i className="fas fa-trash-alt"></i>
                                                        </button>
                                                        {report.status === "pending" && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-secondary"
                                                                onClick={() => handleQuickDismiss(report)}
                                                                title="Tolak Aduan (Bukan Pelanggaran)"
                                                            >
                                                                <i className="fas fa-check"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* =========================================================================
               PANEL 2: KELOLA RUMPUN FORUM (CATEGORIES)
               ========================================================================= */}
            {adminSubTab === "categories" && (
                <div>
                    <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                        <div>
                            <h5 className="fw-bold mb-0 text-dark">
                                <i className="fas fa-layer-group text-teal me-2"></i>
                                Daftar Rumpun Forum & Keahlian ({categories.length})
                            </h5>
                            <span className="text-muted small">
                                Rumpun menentukan pengelompokan topik diskusi peserta dan filter kompetensi pembelajaran.
                            </span>
                        </div>
                        <button
                            type="button"
                            className="btn btn-sm btn-teal text-white fw-bold d-inline-flex align-items-center gap-1 shadow-sm"
                            onClick={handleOpenCreateCategory}
                        >
                            <i className="fas fa-plus-circle"></i>
                            <span>Tambah Rumpun Baru</span>
                        </button>
                    </div>

                    <div className="reports-table-card">
                        {loadingCategories ? (
                            <div className="p-5 text-center text-muted">
                                <span className="spinner-border spinner-border-sm me-2 text-teal"></span>
                                Memuat daftar rumpun forum...
                            </div>
                        ) : categories.length === 0 ? (
                            <div className="p-5 text-center text-muted">
                                <i className="fas fa-tags fa-3x text-muted mb-3 opacity-50"></i>
                                <h6 className="fw-bold text-dark">Belum ada Rumpun Forum</h6>
                                <p className="small mb-3">Tambahkan rumpun keahlian baru untuk mulai mengorganisasi Forum Pembelajaran.</p>
                                <button type="button" className="btn btn-sm btn-teal text-white" onClick={handleOpenCreateCategory}>
                                    <i className="fas fa-plus me-1"></i> Tambah Rumpun Pertama
                                </button>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0 reports-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: "5%" }}>Urutan</th>
                                            <th style={{ width: "22%" }}>Pratinjau Badge & Rumpun</th>
                                            <th style={{ width: "15%" }}>Slug URL</th>
                                            <th style={{ width: "30%" }}>Deskripsi Rumpun</th>
                                            <th style={{ width: "10%" }} className="text-center">Topik Aktif</th>
                                            <th style={{ width: "8%" }} className="text-center">Status</th>
                                            <th style={{ width: "10%" }} className="text-end">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categories.map((cat, idx) => (
                                            <tr key={cat.id || idx}>
                                                <td className="fw-bold text-muted text-center" style={{ fontSize: "0.8rem" }}>
                                                    {cat.order ?? idx + 1}
                                                </td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span
                                                            className="badge d-inline-flex align-items-center gap-1 py-1 px-2 text-white shadow-sm"
                                                            style={{ backgroundColor: cat.badge_color || "#0d9488", fontSize: "0.78rem" }}
                                                        >
                                                            <i className={cat.icon || "fas fa-folder"}></i>
                                                            <span>{cat.name || cat.title}</span>
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <code className="text-muted" style={{ fontSize: "0.75rem" }}>
                                                        {cat.slug}
                                                    </code>
                                                </td>
                                                <td>
                                                    <div className="small text-muted text-truncate" style={{ maxWidth: 300 }} title={cat.description}>
                                                        {cat.description || "Tidak ada deskripsi"}
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <span className="badge bg-light text-dark border">
                                                        <i className="fas fa-comments text-teal me-1"></i>
                                                        {cat.topics_count || 0}
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    <div className="form-check form-switch d-inline-block">
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            role="switch"
                                                            checked={Boolean(cat.is_active)}
                                                            onChange={() => handleToggleCategoryActive(cat)}
                                                            title={cat.is_active ? "Nonaktifkan rumpun" : "Aktifkan rumpun"}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="text-end">
                                                    <div className="btn-group btn-group-sm">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-teal"
                                                            onClick={() => handleOpenEditCategory(cat)}
                                                            title="Edit Rumpun Forum"
                                                        >
                                                            <i className="fas fa-edit"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDeleteCategory(cat)}
                                                            title="Hapus Rumpun"
                                                        >
                                                            <i className="fas fa-trash-alt"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* =========================================================================
               PANEL 3: AUDIT SELURUH TOPIK (TOPICS CONTROL)
               ========================================================================= */}
            {adminSubTab === "topics" && (
                <div>
                    <div className="reports-filters-bar mb-3">
                        <div className="row g-2 align-items-center">
                            <div className="col-12 col-md-5">
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-white border-end-0">
                                        <i className="fas fa-search text-muted"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0"
                                        placeholder="Cari judul topik, isi, nama pembuat..."
                                        value={topicSearchQuery}
                                        onChange={(e) => setTopicSearchQuery(e.target.value)}
                                    />
                                    {topicSearchQuery && (
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={() => setTopicSearchQuery("")}
                                        >
                                            <i className="fas fa-times"></i>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="col-6 col-md-4">
                                <select
                                    className="form-select form-select-sm"
                                    value={topicCatFilter}
                                    onChange={(e) => setTopicCatFilter(e.target.value)}
                                >
                                    <option value="all">Semua Rumpun Forum</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name || c.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-6 col-md-3">
                                <select
                                    className="form-select form-select-sm"
                                    value={topicStatusFilter}
                                    onChange={(e) => setTopicStatusFilter(e.target.value)}
                                >
                                    <option value="all">Semua Status Topik</option>
                                    <option value="pinned">Hanya Tersemat (Pinned)</option>
                                    <option value="locked">Hanya Terkunci (Locked)</option>
                                    <option value="solved">Hanya Terpecahkan (Solved)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="reports-table-card">
                        {loadingTopics ? (
                            <div className="p-5 text-center text-muted">
                                <span className="spinner-border spinner-border-sm me-2 text-teal"></span>
                                Memuat audit topik pembelajaran...
                            </div>
                        ) : adminTopics.length === 0 ? (
                            <div className="p-5 text-center text-muted">
                                <i className="fas fa-folder-open fa-3x text-muted mb-3 opacity-50"></i>
                                <h6 className="fw-bold text-dark">Tidak ada topik yang ditemukan</h6>
                                <p className="small mb-0">Coba ubah kata kunci atau reset filter pencarian di atas.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0 reports-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: "35%" }}>Topik & Rumpun</th>
                                            <th style={{ width: "18%" }}>Pembuat Topik</th>
                                            <th style={{ width: "12%" }} className="text-center">Statistik</th>
                                            <th style={{ width: "15%" }} className="text-center">Status Kontrol</th>
                                            <th style={{ width: "10%" }}>Tanggal</th>
                                            <th style={{ width: "10%" }} className="text-end">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {adminTopics.map((topic) => (
                                            <tr key={topic.topic_id || topic.id}>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                                        <span
                                                            className="badge text-white"
                                                            style={{
                                                                backgroundColor: topic.category_detail?.badge_color || "#0d9488",
                                                                fontSize: "0.68rem",
                                                            }}
                                                        >
                                                            <i className={`${topic.category_detail?.icon || "fas fa-folder"} me-1`}></i>
                                                            {topic.category_detail?.name || topic.category?.name || "Rumpun"}
                                                        </span>
                                                        {topic.is_pinned && (
                                                            <span className="badge bg-warning text-dark" style={{ fontSize: "0.65rem" }}>
                                                                <i className="fas fa-thumbtack me-1"></i>Tersemat
                                                            </span>
                                                        )}
                                                        {topic.is_locked && (
                                                            <span className="badge bg-danger text-white" style={{ fontSize: "0.65rem" }}>
                                                                <i className="fas fa-lock me-1"></i>Terkunci
                                                            </span>
                                                        )}
                                                        {topic.is_solved && (
                                                            <span className="badge bg-success text-white" style={{ fontSize: "0.65rem" }}>
                                                                <i className="fas fa-check-circle me-1"></i>Terpecahkan
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="fw-bold small text-dark text-truncate" style={{ maxWidth: 360 }} title={topic.title}>
                                                        {topic.title}
                                                    </div>
                                                    <div className="text-muted text-truncate" style={{ fontSize: "0.72rem", maxWidth: 360 }}>
                                                        {topic.content}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="fw-bold small text-dark">
                                                        {topic.user?.full_name || topic.profile?.full_name || "Peserta DPD RI"}
                                                    </div>
                                                    <div className="text-muted" style={{ fontSize: "0.68rem" }}>
                                                        {topic.profile?.position_name || topic.user?.email || "Internal"}
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <div className="d-flex align-items-center justify-content-center gap-2">
                                                        <span className="badge bg-light text-dark border" title="Jumlah Balasan">
                                                            <i className="fas fa-comment-dots text-teal me-1"></i>
                                                            {topic.replies_count ?? (topic.replies?.length || 0)}
                                                        </span>
                                                        <span className="badge bg-light text-dark border" title="Jumlah Suka">
                                                            <i className="far fa-thumbs-up text-amber me-1"></i>
                                                            {topic.likes_count ?? (topic.likes?.length || 0)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <div className="btn-group btn-group-sm">
                                                        <button
                                                            type="button"
                                                            className={`btn ${topic.is_pinned ? "btn-warning" : "btn-outline-secondary"}`}
                                                            onClick={() => handleToggleTopicPin(topic)}
                                                            title={topic.is_pinned ? "Lepas Sematan Topik" : "Sematkan Topik di Atas"}
                                                        >
                                                            <i className="fas fa-thumbtack"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`btn ${topic.is_locked ? "btn-danger" : "btn-outline-secondary"}`}
                                                            onClick={() => handleToggleTopicLock(topic)}
                                                            title={topic.is_locked ? "Buka Kunci Topik" : "Kunci Topik (Cegah Balasan)"}
                                                        >
                                                            <i className={`fas ${topic.is_locked ? "fa-lock-open" : "fa-lock"}`}></i>
                                                        </button>
                                                    </div>
                                                </td>
                                                <td style={{ fontSize: "0.75rem" }} className="text-muted">
                                                    {dayjs(topic.created_at).format("DD/MM/YYYY")}
                                                </td>
                                                <td className="text-end">
                                                    <div className="btn-group btn-group-sm">
                                                        <a
                                                            href={`/student/forum/?tab=learning-forum&topic_id=${topic.topic_id || topic.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn btn-outline-teal"
                                                            title="Buka Topik di Tab Baru"
                                                        >
                                                            <i className="fas fa-external-link-alt"></i>
                                                        </a>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() => handleDeleteTopic(topic)}
                                                            title="Hapus Topik Permanen"
                                                        >
                                                            <i className="fas fa-trash-alt"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* =========================================================================
               MODAL: TAMBAH / EDIT RUMPUN FORUM (CATEGORY)
               ========================================================================= */}
            {showCategoryModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(15, 23, 42, 0.65)",
                        backdropFilter: "blur(4px)",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "1rem",
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: "14px",
                            maxWidth: "580px",
                            width: "100%",
                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
                            overflow: "hidden",
                            maxHeight: "90vh",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <div
                            style={{
                                padding: "1rem 1.25rem",
                                borderBottom: "1px solid #e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "#f8fafc",
                            }}
                        >
                            <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                                <i className="fas fa-tags text-teal"></i>
                                <span>{editingCategory ? "Edit Rumpun Forum" : "Tambah Rumpun Forum Baru"}</span>
                            </h5>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={() => setShowCategoryModal(false)}
                                disabled={savingCategory}
                            ></button>
                        </div>

                        <form onSubmit={handleSaveCategory} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                            <div style={{ padding: "1.25rem", overflowY: "auto", flex: 1 }}>
                                {/* Pratinjau Badge Real-time */}
                                <div className="p-3 mb-3 rounded-3 text-center border" style={{ backgroundColor: "#f8fafc" }}>
                                    <div className="small text-muted mb-1 fw-bold">Pratinjau Tampilan Badge Rumpun di Forum:</div>
                                    <span
                                        className="badge py-2 px-3 text-white shadow-sm"
                                        style={{ backgroundColor: categoryForm.badge_color, fontSize: "0.85rem" }}
                                    >
                                        <i className={`${categoryForm.icon} me-1`}></i>
                                        {categoryForm.title || "Nama Rumpun Forum"}
                                    </span>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-dark">
                                        Nama Rumpun Forum <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="Contoh: Tata Usaha & Kepegawaian, Riset Parlemen..."
                                        value={categoryForm.title}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, title: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="row g-2 mb-3">
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-dark">
                                            Slug URL (Opsional)
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            placeholder="Otomatis jika dikosongkan"
                                            value={categoryForm.slug}
                                            onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-dark">
                                            Urutan Tampilan
                                        </label>
                                        <input
                                            type="number"
                                            className="form-control form-control-sm"
                                            value={categoryForm.order}
                                            onChange={(e) => setCategoryForm({ ...categoryForm, order: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-dark">
                                        Deskripsi Ruang Lingkup
                                    </label>
                                    <textarea
                                        className="form-control form-control-sm"
                                        rows={2}
                                        placeholder="Jelaskan topik materi, kompetensi, atau unit kerja yang tercakup dalam rumpun ini..."
                                        value={categoryForm.description}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                                    ></textarea>
                                </div>

                                {/* Pilihan Warna Badge */}
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-dark d-flex align-items-center justify-content-between">
                                        <span>Warna Identitas Badge</span>
                                        <span className="small text-muted">{categoryForm.badge_color}</span>
                                    </label>
                                    <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                                        {PRESET_COLORS.map((clr) => (
                                            <button
                                                key={clr.hex}
                                                type="button"
                                                onClick={() => setCategoryForm({ ...categoryForm, badge_color: clr.hex })}
                                                style={{
                                                    backgroundColor: clr.hex,
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: "50%",
                                                    border: categoryForm.badge_color === clr.hex ? "3px solid #0f172a" : "2px solid #ffffff",
                                                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                                                    cursor: "pointer",
                                                }}
                                                title={clr.name}
                                            />
                                        ))}
                                        <input
                                            type="color"
                                            value={categoryForm.badge_color}
                                            onChange={(e) => setCategoryForm({ ...categoryForm, badge_color: e.target.value })}
                                            className="form-control form-control-color form-control-sm p-0 border-0"
                                            style={{ width: 28, height: 28, cursor: "pointer" }}
                                            title="Pilih warna kustom"
                                        />
                                    </div>
                                </div>

                                {/* Pilihan Ikon FontAwesome */}
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-dark">
                                        Ikon Rumpun
                                    </label>
                                    <div className="d-flex align-items-center gap-1 flex-wrap mb-2">
                                        {PRESET_ICONS.map((p) => (
                                            <button
                                                key={p.icon}
                                                type="button"
                                                className={`btn btn-xs ${categoryForm.icon === p.icon ? "btn-teal text-white" : "btn-outline-secondary"}`}
                                                style={{ fontSize: "0.72rem" }}
                                                onClick={() => setCategoryForm({ ...categoryForm, icon: p.icon })}
                                            >
                                                <i className={`${p.icon} me-1`}></i>
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        placeholder="Atau ketik kelas ikon FontAwesome (misal: fas fa-award)"
                                        value={categoryForm.icon}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                                    />
                                </div>

                                <div className="form-check form-switch mt-2">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="categoryActiveSwitch"
                                        checked={categoryForm.is_active}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                                    />
                                    <label className="form-check-label small fw-bold text-dark" htmlFor="categoryActiveSwitch">
                                        Rumpun Aktif (Dapat dipilih peserta saat membuat topik diskusi baru)
                                    </label>
                                </div>
                            </div>

                            <div
                                style={{
                                    padding: "0.75rem 1.25rem",
                                    borderTop: "1px solid #e2e8f0",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "flex-end",
                                    gap: "0.5rem",
                                    background: "#f8fafc",
                                }}
                            >
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light"
                                    onClick={() => setShowCategoryModal(false)}
                                    disabled={savingCategory}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-sm btn-teal text-white fw-bold px-3"
                                    disabled={savingCategory}
                                >
                                    {savingCategory ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-1"></span>
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-check me-1"></i>
                                            {editingCategory ? "Simpan Perubahan" : "Buat Rumpun"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
               MODAL: DETAIL & KEPUTUSAN MODERASI LAPORAN
               ========================================================================= */}
            {showDetailModal && selectedReport && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(15, 23, 42, 0.65)",
                        backdropFilter: "blur(4px)",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "1rem",
                    }}
                >
                    <div
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: "14px",
                            maxWidth: "680px",
                            width: "100%",
                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
                            overflow: "hidden",
                            maxHeight: "90vh",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <div
                            style={{
                                padding: "1rem 1.25rem",
                                borderBottom: "1px solid #e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "#f8fafc",
                            }}
                        >
                            <h5 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                                <i className="fas fa-gavel text-teal"></i>
                                <span>Tinjauan & Keputusan Moderasi #{selectedReport.id}</span>
                            </h5>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={() => setShowDetailModal(false)}
                                disabled={updating}
                            ></button>
                        </div>

                        <form onSubmit={handleSaveDetail} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                            <div style={{ padding: "1.25rem", overflowY: "auto", flex: 1 }}>
                                <div className="row g-2 mb-3">
                                    <div className="col-sm-6">
                                        <div className="p-2 rounded border bg-light">
                                            <span className="text-muted d-block small">Pelapor:</span>
                                            <strong className="text-dark">
                                                {selectedReport.reporter_details?.full_name || selectedReport.reporter_details?.username}
                                            </strong>
                                            <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                                                {selectedReport.reporter_details?.position_name || "Peserta"} &bull; {selectedReport.reporter_details?.email}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-sm-6">
                                        <div className="p-2 rounded border bg-light">
                                            <span className="text-muted d-block small">Alasan Laporan:</span>
                                            <div className="mt-1">
                                                {renderReasonBadge(selectedReport.reason, selectedReport.reason_display)}
                                            </div>
                                            <div className="text-muted mt-1" style={{ fontSize: "0.72rem" }}>
                                                Dilaporkan: {dayjs(selectedReport.created_at).format("DD MMM YYYY, HH:mm")} WIB
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {selectedReport.description && (
                                    <div className="alert alert-warning py-2 px-3 small mb-3">
                                        <i className="fas fa-quote-left me-2 text-warning-emphasis"></i>
                                        <strong>Pernyataan Pelapor:</strong> "{selectedReport.description}"
                                    </div>
                                )}

                                <div className="p-3 rounded border mb-3" style={{ background: "#f8fafc" }}>
                                    <h6 className="fw-bold mb-2 text-dark d-flex align-items-center gap-2">
                                        <i className={`fas ${selectedReport.target_type === "topic" ? "fa-file-lines" : "fa-reply"} text-teal`}></i>
                                        <span>Konten yang Dilaporkan ({selectedReport.target_type === "topic" ? "Topik Forum" : "Balasan / Tanggapan"})</span>
                                    </h6>

                                    {selectedReport.target_type === "topic" && selectedReport.topic_details && (
                                        <div>
                                            <div className="fw-bold text-dark mb-1">{selectedReport.topic_details.title}</div>
                                            <div className="text-muted small mb-2 p-2 bg-white rounded border">
                                                {selectedReport.topic_details.content}
                                            </div>
                                            <div className="d-flex align-items-center justify-content-between small text-muted">
                                                <span>Penulis: <strong>{selectedReport.topic_details.author_name}</strong></span>
                                                <a
                                                    href={`/student/forum/?tab=learning-forum&topic_id=${selectedReport.topic_details.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-xs btn-outline-teal"
                                                >
                                                    <i className="fas fa-external-link-alt me-1"></i>Buka di Forum
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {selectedReport.target_type === "message" && selectedReport.message_details && (
                                        <div>
                                            <div className="text-muted small mb-2 p-2 bg-white rounded border fst-italic">
                                                "{selectedReport.message_details.message}"
                                            </div>
                                            <div className="d-flex align-items-center justify-content-between small text-muted">
                                                <span>Penulis Balasan: <strong>{selectedReport.message_details.author_name}</strong></span>
                                                {selectedReport.message_details.topic_id && (
                                                    <a
                                                        href={`/student/forum/?tab=learning-forum&topic_id=${selectedReport.message_details.topic_id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-xs btn-outline-teal"
                                                    >
                                                        <i className="fas fa-external-link-alt me-1"></i>Lihat Topik
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="forum-form-group-compact mb-3">
                                    <label className="forum-form-label-compact fw-bold">
                                        Tetapkan Status Moderasi:
                                    </label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={detailStatus}
                                        onChange={(e) => setDetailStatus(e.target.value)}
                                        required
                                    >
                                        <option value="resolved">Terselesaikan (Pelanggaran telah ditangani)</option>
                                        <option value="dismissed">Ditolak / Bukan Pelanggaran (Konten dinilai wajar)</option>
                                        <option value="reviewed">Sedang Ditinjau (Memerlukan eskalasi lebih lanjut)</option>
                                        <option value="pending">Menunggu Reviu (Kembalikan ke antrean)</option>
                                    </select>
                                </div>

                                <div className="mb-2">
                                    <label className="forum-form-label-compact fw-bold d-block">
                                        Templat Catatan Cepat Admin:
                                    </label>
                                    <div className="d-flex align-items-center gap-1 flex-wrap">
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-outline-secondary"
                                            onClick={() => setDetailNotes("Konten telah diverifikasi melanggar tata tertib dan telah dihapus secara permanen.")}
                                        >
                                            Konten Dihapus
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-outline-secondary"
                                            onClick={() => setDetailNotes("Topik telah dikunci untuk mencegah perdebatan yang tidak konstruktif.")}
                                        >
                                            Topik Dikunci
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-outline-secondary"
                                            onClick={() => setDetailNotes("Setelah ditinjau secara seksama, konten tidak terbukti melanggar kode etik maupun aturan forum.")}
                                        >
                                            Bukan Pelanggaran
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-outline-secondary"
                                            onClick={() => setDetailNotes("Peringatan tertulis telah disampaikan kepada pembuat konten terkait etika berkomunikasi.")}
                                        >
                                            Peringatan Pengguna
                                        </button>
                                    </div>
                                </div>

                                <div className="forum-form-group-compact">
                                    <label className="forum-form-label-compact fw-bold">
                                        Catatan Pertimbangan Administrator:
                                    </label>
                                    <textarea
                                        className="form-control form-control-sm"
                                        rows={4}
                                        placeholder="Tuliskan catatan hasil audit atau keputusan moderasi admin..."
                                        value={detailNotes}
                                        onChange={(e) => setDetailNotes(e.target.value)}
                                    ></textarea>
                                    <small className="text-muted">
                                        Catatan ini akan tersimpan dalam riwayat audit moderasi sistem.
                                    </small>
                                </div>
                            </div>

                            <div
                                style={{
                                    padding: "0.75rem 1.25rem",
                                    borderTop: "1px solid #e2e8f0",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "flex-end",
                                    gap: "0.5rem",
                                    background: "#f8fafc",
                                }}
                            >
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light"
                                    onClick={() => setShowDetailModal(false)}
                                    disabled={updating}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-sm btn-teal text-white fw-bold px-3"
                                    disabled={updating}
                                >
                                    {updating ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-1"></span>
                                            Menyimpan...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-check me-1"></i> Simpan Keputusan
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default React.memo(ForumReportsTab);
