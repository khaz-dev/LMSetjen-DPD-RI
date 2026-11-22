import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";

import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";

import useAxios from "../../utils/useAxios";
import UserData from "../plugin/UserData";
import Toast, { DeleteConfirmation } from "../plugin/Toast";
import { useSidebarCollapse } from "./Partials/useSidebarCollapse";
import dayjs, { moment } from "../../utils/dayjs";
import "./Notes.css";

const COLOR_OPTIONS = [
    { label: "Amber / Oranye", value: "#f39c12" },
    { label: "Teal DPD RI", value: "#0d9488" },
    { label: "Biru Langit", value: "#3b82f6" },
    { label: "Hijau Zamrud", value: "#10b981" },
    { label: "Ungu Elegan", value: "#8b5cf6" },
    { label: "Merah Karang", value: "#ef4444" },
    { label: "Kuning Emas", value: "#f59e0b" },
    { label: "Abu Netral", value: "#64748b" },
];

// Helper pembersih teks cuplikan agar tidak menampilkan simbol mentah markdown
const getCleanSnippet = (text) => {
    if (!text) return "";
    return text
        .replace(/^#+\s+/gm, "")
        .replace(/^---$/gm, "")
        .replace(/\*\*/g, "")
        .replace(/^[•\-\*]\s+/gm, "• ")
        .replace(/Pelatihan:.*?\n/g, "")
        .replace(/Waktu Rangkuman:.*?\n/g, "")
        .replace(/Catatan ini dirangkum.*/g, "")
        .replace(/\n\s*\n/g, "\n")
        .trim();
};

function Notes() {
    const isCollapsed = useSidebarCollapse();
    const userData = UserData();

    // Data states
    const [notes, setNotes] = useState([]);
    const [enrolledCourses, setEnrolledCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all"); // 'all' | 'general' | 'course' | 'pinned'
    const [selectedCourseFilter, setSelectedCourseFilter] = useState("all");
    const [selectedColorFilter, setSelectedColorFilter] = useState("all");
    const [sortBy, setSortBy] = useState("newest"); // 'newest' | 'oldest' | 'title-asc' | 'title-desc'
    const [viewMode, setViewMode] = useState(() => {
        return localStorage.getItem("studentNotesViewMode") || "grid";
    });

    // Modal states
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewingNote, setViewingNote] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form inputs state
    const [formTitle, setFormTitle] = useState("");
    const [formNote, setFormNote] = useState("");
    const [formColor, setFormColor] = useState("#f39c12");
    const [formIsPinned, setFormIsPinned] = useState(false);
    const [formType, setFormType] = useState("general"); // 'general' | 'course'
    const [formCourseId, setFormCourseId] = useState("");

    // Fetch notes and enrolled courses
    const fetchNotes = useCallback(async () => {
        if (!userData?.user_id) return;
        try {
            const res = await useAxios.get(`student/notes/${userData.user_id}/`);
            const notesData = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setNotes(notesData);
        } catch (err) {
            console.error("Gagal memuat catatan peserta:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat daftar catatan. Silakan muat ulang.",
            });
        }
    }, [userData?.user_id]);

    const fetchEnrolledCourses = useCallback(async () => {
        if (!userData?.user_id) return;
        try {
            const res = await useAxios.get(`student/course-list/${userData.user_id}/`);
            const courseData = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setEnrolledCourses(courseData);
        } catch (err) {
            console.error("Gagal memuat kursus yang diikuti:", err);
        }
    }, [userData?.user_id]);

    useEffect(() => {
        setIsLoading(true);
        Promise.all([fetchNotes(), fetchEnrolledCourses()]).finally(() => {
            setIsLoading(false);
        });
    }, [fetchNotes, fetchEnrolledCourses]);

    // Handle View Mode toggle
    const handleViewModeChange = (mode) => {
        setViewMode(mode);
        localStorage.setItem("studentNotesViewMode", mode);
    };

    // Open Form Modal for Create
    const handleOpenCreateModal = () => {
        setEditingNote(null);
        setFormTitle("");
        setFormNote("");
        setFormColor("#f39c12");
        setFormIsPinned(false);
        setFormType("general");
        setFormCourseId("");
        setIsFormModalOpen(true);
    };

    // Open Form Modal for Edit
    const handleOpenEditModal = (note) => {
        setEditingNote(note);
        setFormTitle(note.title || "");
        setFormNote(note.note || "");
        setFormColor(note.color || "#f39c12");
        setFormIsPinned(Boolean(note.is_pinned));
        if (note.course || note.course_id) {
            setFormType("course");
            setFormCourseId(note.course || note.course_id || "");
        } else {
            setFormType("general");
            setFormCourseId("");
        }
        setIsFormModalOpen(true);
    };

    // Close Form Modal
    const handleCloseFormModal = () => {
        setIsFormModalOpen(false);
        setEditingNote(null);
    };

    // Open View Detail Modal
    const handleOpenViewModal = (note) => {
        setViewingNote(note);
        setIsViewModalOpen(true);
    };

    // Close View Detail Modal
    const handleCloseViewModal = () => {
        setIsViewModalOpen(false);
        setViewingNote(null);
    };

    // Submit Create or Edit Note
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!formTitle.trim()) {
            Toast().fire({
                icon: "warning",
                title: "Silakan masukkan judul catatan",
            });
            return;
        }
        if (!formNote.trim()) {
            Toast().fire({
                icon: "warning",
                title: "Silakan masukkan konten catatan",
            });
            return;
        }

        setIsSubmitting(true);
        const payload = {
            user_id: userData?.user_id,
            title: formTitle.trim(),
            note: formNote.trim(),
            color: formColor,
            is_pinned: formIsPinned,
            course_id: formType === "course" && formCourseId ? formCourseId : null,
        };

        try {
            if (editingNote) {
                // Update existing note
                await useAxios.patch(`student/notes/${userData.user_id}/${editingNote.id}/`, payload);
                Toast().fire({
                    icon: "success",
                    title: "Catatan berhasil diperbarui",
                });
            } else {
                // Create new note
                await useAxios.post(`student/notes/${userData.user_id}/`, payload);
                Toast().fire({
                    icon: "success",
                    title: "Catatan berhasil dibuat",
                });
            }
            handleCloseFormModal();
            fetchNotes();
        } catch (err) {
            console.error("Gagal menyimpan catatan:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal menyimpan catatan. Silakan coba lagi.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete Note
    const handleDeleteNote = (note) => {
        DeleteConfirmation("Hapus Catatan?", `Apakah Anda yakin ingin menghapus catatan "${note.title || "ini"}"?`).then(
            async (result) => {
                if (result.isConfirmed) {
                    try {
                        await useAxios.delete(`student/notes/${userData.user_id}/${note.id}/`);
                        Toast().fire({
                            icon: "success",
                            title: "Catatan berhasil dihapus",
                        });
                        if (viewingNote?.id === note.id) {
                            handleCloseViewModal();
                        }
                        fetchNotes();
                    } catch (err) {
                        console.error("Gagal menghapus catatan:", err);
                        Toast().fire({
                            icon: "error",
                            title: "Gagal menghapus catatan. Silakan coba lagi.",
                        });
                    }
                }
            }
        );
    };

    // Toggle Pin Note
    const handleTogglePin = async (note, e) => {
        if (e) e.stopPropagation();
        try {
            const newPinned = !note.is_pinned;
            await useAxios.patch(`student/notes/${userData.user_id}/${note.id}/`, {
                is_pinned: newPinned,
            });
            Toast().fire({
                icon: "success",
                title: newPinned ? "Catatan disematkan di atas" : "Sematkan catatan dilepas",
            });
            // Update local state optimistically
            setNotes((prev) =>
                prev.map((item) =>
                    item.id === note.id ? { ...item, is_pinned: newPinned } : item
                )
            );
        } catch (err) {
            console.error("Gagal mengubah status sematan catatan:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal memperbarui sematan.",
            });
        }
    };

    // Export single note or all filtered notes to TXT
    const handleExportNotes = (notesToExport, fileName = "Catatan_LMSetjen_DPDRI.txt") => {
        if (!notesToExport || notesToExport.length === 0) {
            Toast().fire({
                icon: "warning",
                title: "Tidak ada catatan untuk diekspor",
            });
            return;
        }

        let content = `==========================================================\n`;
        content += `  RINGKASAN CATATAN PEMBELAJARAN - LMSETJEN DPD RI\n`;
        content += `  Waktu Cetak : ${moment().format("DD MMMM YYYY, HH:mm")} WIB\n`;
        content += `  Total Item  : ${notesToExport.length} Catatan\n`;
        content += `==========================================================\n\n`;

        notesToExport.forEach((n, idx) => {
            content += `[${idx + 1}] ${n.title || "Tanpa Judul"}\n`;
            content += `Kategori  : ${n.course_title ? `Kursus: ${n.course_title}` : "Catatan Umum Peserta"}\n`;
            if (n.variant?.title || n.variant_item?.title) {
                content += `Materi    : ${[n.variant?.title, n.variant_item?.title].filter(Boolean).join(" › ")}\n`;
            }
            content += `Tanggal   : ${moment(n.date).format("DD/MM/YYYY HH:mm")}\n`;
            content += `Status    : ${n.is_pinned ? "⭐ Tersemat (Penting)" : "Biasa"}\n`;
            content += `----------------------------------------------------------\n`;
            content += `${n.note}\n\n`;
            content += `==========================================================\n\n`;
        });

        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Toast().fire({ icon: "success", title: "Catatan berhasil diunduh!" });
    };

    // Copy note text to clipboard
    const handleCopyNote = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            Toast().fire({
                icon: "success",
                title: "Konten catatan berhasil disalin ke clipboard",
            });
        });
    };

    // Calculate Counts for hero & tabs
    const stats = useMemo(() => {
        const total = notes.length;
        const general = notes.filter((n) => !n.course && !n.course_id).length;
        const course = notes.filter((n) => Boolean(n.course || n.course_id)).length;
        const pinned = notes.filter((n) => Boolean(n.is_pinned)).length;
        return { total, general, course, pinned };
    }, [notes]);

    // Filter and Sort Notes
    const filteredNotes = useMemo(() => {
        let list = [...notes];

        // 1. Search filter (title, content, course title)
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter((n) => {
                const titleMatch = (n.title || "").toLowerCase().includes(q);
                const noteMatch = (n.note || "").toLowerCase().includes(q);
                const courseMatch = (n.course_title || "").toLowerCase().includes(q);
                return titleMatch || noteMatch || courseMatch;
            });
        }

        // 2. Tab filter
        if (activeTab === "general") {
            list = list.filter((n) => !n.course && !n.course_id);
        } else if (activeTab === "course") {
            list = list.filter((n) => Boolean(n.course || n.course_id));
        } else if (activeTab === "pinned") {
            list = list.filter((n) => Boolean(n.is_pinned));
        }

        // 3. Course dropdown filter
        if (selectedCourseFilter !== "all") {
            list = list.filter((n) => {
                const cId = String(n.course || n.course_id || "");
                return cId === String(selectedCourseFilter);
            });
        }

        // 4. Color dropdown filter
        if (selectedColorFilter !== "all") {
            list = list.filter((n) => (n.color || "").toLowerCase() === selectedColorFilter.toLowerCase());
        }

        // 5. Sorting (Pinned always kept on top unless explicitly overridden)
        list.sort((a, b) => {
            // Priority 1: pinned status
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;

            // Priority 2: selected sort criteria
            if (sortBy === "oldest") {
                return new Date(a.date) - new Date(b.date);
            }
            if (sortBy === "title-asc") {
                return (a.title || "").localeCompare(b.title || "");
            }
            if (sortBy === "title-desc") {
                return (b.title || "").localeCompare(a.title || "");
            }
            // default 'newest'
            return new Date(b.date) - new Date(a.date);
        });

        return list;
    }, [notes, searchQuery, activeTab, selectedCourseFilter, selectedColorFilter, sortBy]);

    // Map unique enrolled course list for filter dropdown
    const availableCourses = useMemo(() => {
        // Collect courses either from enrolledCourses or from notes with course info
        const courseMap = new Map();
        enrolledCourses.forEach((ec) => {
            if (ec.course?.id && ec.course?.title) {
                courseMap.set(String(ec.course.id), {
                    id: ec.course.id,
                    title: ec.course.title,
                    enrollment_id: ec.enrollment_id,
                });
            }
        });
        notes.forEach((n) => {
            const cId = n.course || n.course_id;
            if (cId && n.course_title && !courseMap.has(String(cId))) {
                courseMap.set(String(cId), {
                    id: cId,
                    title: n.course_title,
                    enrollment_id: n.enrollment_id,
                });
            }
        });
        return Array.from(courseMap.values());
    }, [enrolledCourses, notes]);

    return (
        <>
            <BaseHeader />

            <section className="modern-notes-page">
                <div className="container">
                    <Header />

                    <div className="row mt-0">
                        <Sidebar />

                        <div className={`col-lg-9 col-md-8 col-12 ${isCollapsed ? "sidebar-collapsed-adapted" : ""}`}>
                            {/* =========================================================================
                                1. ULTRA-COMPACT EXECUTIVE HERO SECTION
                                ========================================================================= */}
                            <div className="notes-hero-card">
                                <div className="notes-hero-accent-shape"></div>
                                <div className="notes-hero-left">
                                    <div className="notes-hero-badge">
                                        <i className="fas fa-landmark text-amber"></i>
                                        <span>Setjen DPD RI • Ruang Catatan Peserta</span>
                                    </div>
                                    <div className="notes-hero-title-row">
                                        <div className="notes-hero-icon-box">
                                            <i className="fas fa-sticky-note"></i>
                                        </div>
                                        <div>
                                            <h1 className="notes-hero-title">
                                                Catatan Pembelajaran
                                            </h1>
                                            <p className="notes-hero-desc">
                                                Kelola catatan mandiri dan materi kursus Anda di satu tempat terpusat.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Compact Stat Pills & Action */}
                                <div className="notes-hero-right">
                                    <div className="notes-hero-stat-pill" title="Total semua catatan tersimpan">
                                        <div className="notes-stat-pill-icon icon-amber">
                                            <i className="fas fa-sticky-note"></i>
                                        </div>
                                        <div className="notes-stat-pill-info">
                                            <span className="notes-stat-pill-num">{stats.total}</span>
                                            <span className="notes-stat-pill-text">Total Catatan</span>
                                        </div>
                                    </div>

                                    <div className="notes-hero-stat-pill" title="Catatan terhubung ke kursus">
                                        <div className="notes-stat-pill-icon icon-teal">
                                            <i className="fas fa-book-open"></i>
                                        </div>
                                        <div className="notes-stat-pill-info">
                                            <span className="notes-stat-pill-num">{stats.course}</span>
                                            <span className="notes-stat-pill-text">Kursus</span>
                                        </div>
                                    </div>

                                    <div className="notes-hero-stat-pill" title="Catatan umum mandiri">
                                        <div className="notes-stat-pill-icon icon-blue">
                                            <i className="fas fa-pen-to-square"></i>
                                        </div>
                                        <div className="notes-stat-pill-info">
                                            <span className="notes-stat-pill-num">{stats.general}</span>
                                            <span className="notes-stat-pill-text">Umum</span>
                                        </div>
                                    </div>

                                    {stats.pinned > 0 && (
                                        <div className="notes-hero-stat-pill" title="Catatan disematkan (penting)">
                                            <div className="notes-stat-pill-icon icon-rose">
                                                <i className="fas fa-thumbtack"></i>
                                            </div>
                                            <div className="notes-stat-pill-info">
                                                <span className="notes-stat-pill-num">{stats.pinned}</span>
                                                <span className="notes-stat-pill-text">Tersemat</span>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleOpenCreateModal}
                                        className="notes-btn-create-compact"
                                        title="Buat Catatan Baru"
                                    >
                                        <i className="fas fa-plus"></i>
                                        <span>Tambah Catatan</span>
                                    </button>
                                </div>
                            </div>

                            {/* =========================================================================
                                2. HIGH-DENSITY UNIFIED TOOLBAR
                                ========================================================================= */}
                            <div className="notes-toolbar-card">
                                {/* Line 1: Category Filter Pills & Summary */}
                                <div className="notes-toolbar-line1">
                                    <div className="notes-category-pills">
                                        <button
                                            type="button"
                                            className={`notes-pill-btn ${activeTab === "all" ? "active" : ""}`}
                                            onClick={() => setActiveTab("all")}
                                        >
                                            <span>Semua</span>
                                            <span className="pill-count">{stats.total}</span>
                                        </button>

                                        <button
                                            type="button"
                                            className={`notes-pill-btn ${activeTab === "course" ? "active" : ""}`}
                                            onClick={() => setActiveTab("course")}
                                        >
                                            <i className="fas fa-book-open"></i>
                                            <span>Kursus</span>
                                            <span className="pill-count">{stats.course}</span>
                                        </button>

                                        <button
                                            type="button"
                                            className={`notes-pill-btn ${activeTab === "general" ? "active" : ""}`}
                                            onClick={() => setActiveTab("general")}
                                        >
                                            <i className="fas fa-pen-to-square"></i>
                                            <span>Umum</span>
                                            <span className="pill-count">{stats.general}</span>
                                        </button>

                                        <button
                                            type="button"
                                            className={`notes-pill-btn ${activeTab === "pinned" ? "active" : ""}`}
                                            onClick={() => setActiveTab("pinned")}
                                        >
                                            <i className="fas fa-thumbtack"></i>
                                            <span>Tersemat</span>
                                            <span className="pill-count">{stats.pinned}</span>
                                        </button>
                                    </div>

                                    <div className="notes-toolbar-line1-right">
                                        <div className="notes-meta-summary">
                                            Menampilkan <strong>{filteredNotes.length}</strong> dari {notes.length} catatan
                                        </div>

                                        {(searchQuery || activeTab !== "all" || selectedCourseFilter !== "all" || selectedColorFilter !== "all" || sortBy !== "newest") && (
                                            <button
                                                type="button"
                                                className="notes-btn-reset-compact"
                                                onClick={() => {
                                                    setSearchQuery("");
                                                    setActiveTab("all");
                                                    setSelectedCourseFilter("all");
                                                    setSelectedColorFilter("all");
                                                    setSortBy("newest");
                                                }}
                                                title="Reset semua filter"
                                            >
                                                <i className="fas fa-arrow-rotate-left me-1"></i>Reset
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Line 2: Search Box & Controls in one row */}
                                <div className="notes-toolbar-line2">
                                    <div className="notes-search-box">
                                        <i className="fas fa-search notes-search-icon"></i>
                                        <input
                                            type="text"
                                            className="notes-search-input"
                                            placeholder="Cari catatan, isi, atau kursus..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                className="notes-search-clear"
                                                onClick={() => setSearchQuery("")}
                                                title="Bersihkan"
                                            >
                                                <i className="fas fa-times"></i>
                                            </button>
                                        )}
                                    </div>

                                    <div className="notes-controls-group">
                                        <select
                                            className="notes-compact-select"
                                            value={selectedCourseFilter}
                                            onChange={(e) => setSelectedCourseFilter(e.target.value)}
                                            title="Saring berdasarkan kursus"
                                        >
                                            <option value="all">Semua Kursus</option>
                                            {availableCourses.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.title.length > 28 ? c.title.substring(0, 28) + "..." : c.title}
                                                </option>
                                            ))}
                                        </select>

                                        <select
                                            className="notes-compact-select"
                                            value={selectedColorFilter}
                                            onChange={(e) => setSelectedColorFilter(e.target.value)}
                                            title="Saring berdasarkan warna label"
                                        >
                                            <option value="all">Semua Warna</option>
                                            {COLOR_OPTIONS.map((c) => (
                                                <option key={c.value} value={c.value}>
                                                    {c.label}
                                                </option>
                                            ))}
                                        </select>

                                        <select
                                            className="notes-compact-select"
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value)}
                                            title="Urutkan catatan"
                                        >
                                            <option value="newest">Terbaru</option>
                                            <option value="oldest">Terlama</option>
                                            <option value="title-asc">Judul (A-Z)</option>
                                            <option value="title-desc">Judul (Z-A)</option>
                                        </select>

                                        <div className="notes-view-switcher">
                                            <button
                                                type="button"
                                                className={`notes-view-btn ${viewMode === "grid" ? "active" : ""}`}
                                                onClick={() => handleViewModeChange("grid")}
                                                title="Tampilan Kisi (Grid)"
                                            >
                                                <i className="fas fa-grip"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className={`notes-view-btn ${viewMode === "list" ? "active" : ""}`}
                                                onClick={() => handleViewModeChange("list")}
                                                title="Tampilan Daftar (List)"
                                            >
                                                <i className="fas fa-list"></i>
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            className="notes-btn-export-compact"
                                            onClick={() => handleExportNotes(filteredNotes)}
                                            title="Unduh seluruh catatan yang tersaring sebagai dokumen teks"
                                        >
                                            <i className="fas fa-file-arrow-down"></i>
                                            <span>Ekspor</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* =========================================================================
                                3. NOTES LIST / GRID DISPLAY
                                ========================================================================= */}
                            {isLoading ? (
                                <div className="notes-empty-state">
                                    <div className="spinner-border text-teal mb-3" role="status">
                                        <span className="visually-hidden">Memuat catatan...</span>
                                    </div>
                                    <div className="notes-empty-title">Memuat Catatan...</div>
                                    <p className="notes-empty-desc">Sinkronisasi catatan belajar Anda...</p>
                                </div>
                            ) : filteredNotes.length === 0 ? (
                                <div className="notes-empty-state">
                                    <div className="notes-empty-icon">
                                        <i className="fas fa-note-sticky"></i>
                                    </div>
                                    <div className="notes-empty-title">
                                        {searchQuery || activeTab !== "all" || selectedCourseFilter !== "all" || selectedColorFilter !== "all"
                                            ? "Catatan tidak ditemukan"
                                            : "Belum Ada Catatan"}
                                    </div>
                                    <p className="notes-empty-desc">
                                        {searchQuery || activeTab !== "all" || selectedCourseFilter !== "all" || selectedColorFilter !== "all"
                                            ? "Tidak ada catatan yang sesuai dengan kata kunci atau filter yang Anda pilih. Coba sesuaikan kata kunci pencarian Anda."
                                            : "Mulai simpan poin penting pembelajaran, rangkuman, atau rencana belajar kedinasan Anda di sini."}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleOpenCreateModal}
                                        className="notes-btn-create-compact"
                                    >
                                        <i className="fas fa-plus"></i>
                                        <span>Buat Catatan Sekarang</span>
                                    </button>
                                </div>
                            ) : (
                                <div className={viewMode === "grid" ? "notes-grid-container" : "notes-list-container"}>
                                    {filteredNotes.map((note) => {
                                        const isManta = Boolean(
                                            note.note_id?.startsWith("manta_") ||
                                            (note.title && note.title.toLowerCase().includes("manta")) ||
                                            (note.note && note.note.includes("Manta AI"))
                                        );
                                        const noteColor = note.color || (isManta ? "#0d9488" : "#f39c12");
                                        const hasCourse = Boolean(note.course || note.course_id || note.course_title);

                                        // Find target enrollment_id for direct linking
                                        let targetEnrollmentId = note.enrollment_id;
                                        if (!targetEnrollmentId && note.course) {
                                            const matchedCourse = enrolledCourses.find(
                                                (ec) => String(ec.course?.id) === String(note.course)
                                            );
                                            if (matchedCourse) {
                                                targetEnrollmentId = matchedCourse.enrollment_id;
                                            }
                                        }

                                        const courseTargetUrl = targetEnrollmentId
                                            ? `/student/courses/${targetEnrollmentId}/`
                                            : null;

                                        return (
                                            <div
                                                key={note.id || note.note_id}
                                                className={`note-item-card ${note.is_pinned ? "is-pinned" : ""}`}
                                                style={{ "--note-accent": noteColor }}
                                            >
                                                {/* Card Header */}
                                                <div className="note-card-header">
                                                    <div className="note-card-title-group">
                                                        <div className="note-badge-row">
                                                            {hasCourse ? (
                                                                <span className="note-type-badge badge-course">
                                                                    <i className="fas fa-book-open"></i> Kursus
                                                                </span>
                                                            ) : (
                                                                <span className="note-type-badge badge-general">
                                                                    <i className="fas fa-pen-to-square"></i> Umum
                                                                </span>
                                                            )}

                                                            {isManta && (
                                                                <span className="note-type-badge badge-manta">
                                                                    ✨ Manta AI
                                                                </span>
                                                            )}

                                                            {note.is_pinned && (
                                                                <span className="badge bg-amber text-dark" style={{ fontSize: "0.68rem" }}>
                                                                    <i className="fas fa-thumbtack me-1"></i> Tersemat
                                                                </span>
                                                            )}
                                                        </div>

                                                        <h4
                                                            className="note-card-title"
                                                            onClick={() => handleOpenViewModal(note)}
                                                            style={{ cursor: "pointer" }}
                                                            title={note.title}
                                                        >
                                                            {note.title || "Tanpa Judul"}
                                                        </h4>

                                                        {/* Course metadata context inside title group so list view never overflows */}
                                                        {hasCourse && (
                                                            <div className="note-course-meta">
                                                                {courseTargetUrl ? (
                                                                    <Link
                                                                        to={courseTargetUrl}
                                                                        className="note-course-link"
                                                                        title="Buka kursus terkait"
                                                                    >
                                                                        <i className="fas fa-graduation-cap"></i>
                                                                        <span>{note.course_title || "Kursus Terkait"}</span>
                                                                        <i className="fas fa-arrow-up-right-from-square ms-1" style={{ fontSize: "0.65rem" }}></i>
                                                                    </Link>
                                                                ) : (
                                                                    <span className="text-muted d-inline-flex align-items-center gap-1">
                                                                        <i className="fas fa-graduation-cap"></i>
                                                                        {note.course_title || "Kursus Terkait"}
                                                                    </span>
                                                                )}

                                                                {(note.variant?.title || note.variant_item?.title) && (
                                                                    <div className="note-lesson-tag">
                                                                        <i className="fas fa-layer-group"></i>
                                                                        <span>
                                                                            {[note.variant?.title, note.variant_item?.title]
                                                                                .filter(Boolean)
                                                                                .join(" › ")}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Header action buttons */}
                                                    <div className="note-card-actions">
                                                        <button
                                                            type="button"
                                                            className={`note-action-icon-btn btn-pin ${note.is_pinned ? "pinned" : ""}`}
                                                            onClick={(e) => handleTogglePin(note, e)}
                                                            title={note.is_pinned ? "Lepas sematan" : "Sematkan catatan ke atas"}
                                                        >
                                                            <i className="fas fa-thumbtack"></i>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="note-action-icon-btn"
                                                            onClick={() => handleOpenEditModal(note)}
                                                            title="Edit catatan"
                                                        >
                                                            <i className="fas fa-pencil"></i>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="note-action-icon-btn btn-delete"
                                                            onClick={() => handleDeleteNote(note)}
                                                            title="Hapus catatan"
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Card Body snippet */}
                                                <div
                                                    className="note-card-body"
                                                    onClick={() => handleOpenViewModal(note)}
                                                    title="Klik untuk membaca penuh"
                                                >
                                                    <p className="note-card-text">
                                                        {getCleanSnippet(note.note)}
                                                    </p>
                                                </div>

                                                {/* Card Footer */}
                                                <div className="note-card-footer">
                                                    <div className="note-footer-date">
                                                        <i className="fas fa-calendar-alt" style={{ color: noteColor }}></i>
                                                        <span>{moment(note.date).format("DD MMM YYYY")}</span>
                                                    </div>

                                                    <div className="note-footer-btns">
                                                        <button
                                                            type="button"
                                                            className="note-btn-pill"
                                                            onClick={() => handleCopyNote(note.note)}
                                                            title="Salin isi catatan"
                                                        >
                                                            <i className="fas fa-copy"></i> Salin
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="note-btn-pill btn-primary-soft"
                                                            onClick={() => handleOpenViewModal(note)}
                                                            title="Buka tampilan penuh"
                                                        >
                                                            <i className="fas fa-eye"></i> Baca
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* =========================================================================
                4. CREATE / EDIT NOTE MODAL
                ========================================================================= */}
            {isFormModalOpen && (
                <div className="notes-modal-backdrop" onClick={handleCloseFormModal}>
                    <div
                        className="notes-modal-card note-paper-modal"
                        style={{
                            "--modal-note-color": formColor,
                            "--modal-note-light": `${formColor}18`,
                            borderTop: `6px solid ${formColor}`
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Sticky note top tape strip */}
                        <div className="notes-modal-tape"></div>

                        <div className="notes-modal-header" style={{ background: `linear-gradient(180deg, ${formColor}14 0%, #ffffff 100%)` }}>
                            <div className="d-flex align-items-center gap-2">
                                <span
                                    className="notes-color-indicator-swatch"
                                    style={{ backgroundColor: formColor }}
                                    title={`Warna Catatan: ${COLOR_OPTIONS.find((c) => c.value === formColor)?.label || formColor}`}
                                ></span>
                                <h3 className="notes-modal-title">
                                    <i className="fas fa-sticky-note" style={{ color: formColor }}></i>
                                    <span>{editingNote ? "Edit Catatan" : "Tambah Catatan Baru"}</span>
                                </h3>
                            </div>
                            <button
                                type="button"
                                className="notes-modal-close"
                                onClick={handleCloseFormModal}
                                title="Tutup"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSubmitForm}>
                            <div className="notes-modal-body">
                                {/* Note Type Selector */}
                                <div className="notes-form-group">
                                    <label className="notes-form-label">Jenis Catatan</label>
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="form-check">
                                            <input
                                                className="form-check-input"
                                                type="radio"
                                                name="noteTypeRadio"
                                                id="noteTypeGeneral"
                                                checked={formType === "general"}
                                                onChange={() => setFormType("general")}
                                            />
                                            <label className="form-check-label small fw-semibold" htmlFor="noteTypeGeneral">
                                                <i className="fas fa-pen-to-square text-primary me-1"></i> Catatan Umum Mandiri
                                            </label>
                                        </div>

                                        <div className="form-check">
                                            <input
                                                className="form-check-input"
                                                type="radio"
                                                name="noteTypeRadio"
                                                id="noteTypeCourse"
                                                checked={formType === "course"}
                                                onChange={() => setFormType("course")}
                                            />
                                            <label className="form-check-label small fw-semibold" htmlFor="noteTypeCourse">
                                                <i className="fas fa-book-open text-emerald me-1"></i> Tautkan ke Kursus Tertentu
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Course Dropdown (if course note) */}
                                {formType === "course" && (
                                    <div className="notes-form-group">
                                        <label className="notes-form-label">
                                            Pilih Kursus <span className="text-danger">*</span>
                                        </label>
                                        <select
                                            className="notes-form-select"
                                            value={formCourseId}
                                            onChange={(e) => setFormCourseId(e.target.value)}
                                            required={formType === "course"}
                                        >
                                            <option value="">-- Pilih Kursus yang Diikuti --</option>
                                            {availableCourses.map((c) => (
                                                <option key={c.id} value={c.id}>
                                                    {c.title}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Note Title */}
                                <div className="notes-form-group">
                                    <label className="notes-form-label">
                                        Judul Catatan <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="notes-form-input"
                                        placeholder="Contoh: Rangkuman Modul Tata Kelola Regulasi ASN..."
                                        value={formTitle}
                                        onChange={(e) => setFormTitle(e.target.value)}
                                        required
                                    />
                                </div>

                                {/* Color Palette */}
                                <div className="notes-form-group">
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <label className="notes-form-label mb-0">Pilihan Warna Catatan</label>
                                        <span className="small text-muted" style={{ fontSize: "0.74rem" }}>
                                            {COLOR_OPTIONS.find((c) => c.value === formColor)?.label || "Warna Label"}
                                        </span>
                                    </div>
                                    <div className="notes-color-palette">
                                        {COLOR_OPTIONS.map((col) => (
                                            <div
                                                key={col.value}
                                                className={`notes-color-dot ${formColor === col.value ? "active" : ""}`}
                                                style={{ backgroundColor: col.value }}
                                                onClick={() => setFormColor(col.value)}
                                                title={col.label}
                                            >
                                                {formColor === col.value && <i className="fas fa-check"></i>}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Pin checkbox / switch - Stick to left on the same row */}
                                <div className="notes-form-group mb-2">
                                    <div className="notes-pin-switch-row">
                                        <div className="form-check form-switch m-0 p-0 d-inline-flex align-items-center">
                                            <input
                                                className="form-check-input m-0 cursor-pointer"
                                                type="checkbox"
                                                role="switch"
                                                id="pinSwitch"
                                                checked={formIsPinned}
                                                onChange={(e) => setFormIsPinned(e.target.checked)}
                                            />
                                            <label className="form-check-label small fw-semibold text-dark cursor-pointer ms-2" htmlFor="pinSwitch">
                                                <i className="fas fa-thumbtack text-amber me-1"></i>
                                                Sematkan sebagai Catatan Penting (Tampil paling atas)
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Note Content with Paper Note Pad styling */}
                                <div className="notes-form-group mb-0">
                                    <label className="notes-form-label">
                                        Konten Catatan <span className="text-danger">*</span>
                                    </label>
                                    <textarea
                                        className="notes-form-textarea notes-paper-pad"
                                        placeholder="Tuliskan catatan, gagasan penting, ringkasan materi, atau referensi di sini..."
                                        value={formNote}
                                        onChange={(e) => setFormNote(e.target.value)}
                                        required
                                    ></textarea>
                                </div>
                            </div>

                            <div className="notes-modal-footer">
                                <button
                                    type="button"
                                    className="notes-btn-secondary"
                                    onClick={handleCloseFormModal}
                                    disabled={isSubmitting}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="notes-btn-save"
                                    style={{
                                        backgroundColor: formColor,
                                        borderColor: formColor,
                                        boxShadow: `0 3px 10px ${formColor}40`,
                                    }}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status"></span>
                                            <span>Menyimpan...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-save"></i>
                                            <span>{editingNote ? "Perbarui Catatan" : "Simpan Catatan"}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* =========================================================================
                5. VIEW NOTE DETAIL MODAL
                ========================================================================= */}
            {isViewModalOpen && viewingNote && (
                <div className="notes-modal-backdrop" onClick={handleCloseViewModal}>
                    <div
                        className="notes-modal-card note-paper-modal"
                        style={{
                            "--modal-note-color": viewingNote.color || "#0d9488",
                            "--modal-note-light": `${viewingNote.color || "#0d9488"}18`,
                            borderTop: `6px solid ${viewingNote.color || "#0d9488"}`
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="notes-modal-tape"></div>

                        <div
                            className="notes-modal-header"
                            style={{ background: `linear-gradient(180deg, ${viewingNote.color || "#0d9488"}14 0%, #ffffff 100%)` }}
                        >
                            <div className="d-flex align-items-center gap-2">
                                <span
                                    className="notes-color-indicator-swatch"
                                    style={{
                                        backgroundColor: viewingNote.color || "#0d9488",
                                    }}
                                ></span>
                                <h3 className="notes-modal-title">
                                    <i className="fas fa-sticky-note" style={{ color: viewingNote.color || "#0d9488" }}></i>
                                    <span>{viewingNote.title || "Detail Catatan"}</span>
                                </h3>
                            </div>
                            <button
                                type="button"
                                className="notes-modal-close"
                                onClick={handleCloseViewModal}
                                title="Tutup"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="notes-modal-body">
                            {/* Metadata context header */}
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 pb-2 border-bottom">
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    {viewingNote.course_title ? (
                                        <span className="note-type-badge badge-course">
                                            <i className="fas fa-graduation-cap"></i> {viewingNote.course_title}
                                        </span>
                                    ) : (
                                        <span className="note-type-badge badge-general">
                                            <i className="fas fa-pen-to-square"></i> Catatan Umum
                                        </span>
                                    )}

                                    {viewingNote.is_pinned && (
                                        <span className="badge bg-amber text-dark" style={{ fontSize: "0.72rem" }}>
                                            <i className="fas fa-thumbtack me-1"></i> Tersemat
                                        </span>
                                    )}
                                </div>

                                <div className="small text-muted d-flex align-items-center gap-1">
                                    <i className="fas fa-calendar-alt"></i>
                                    <span>{moment(viewingNote.date).format("DD MMMM YYYY, HH:mm")} WIB</span>
                                </div>
                            </div>

                            {/* Lesson / Variant Context */}
                            {(viewingNote.variant?.title || viewingNote.variant_item?.title) && (
                                <div className="alert alert-light border py-2 px-3 mb-3 small d-flex align-items-center gap-2">
                                    <i className="fas fa-layer-group text-teal"></i>
                                    <span>
                                        Materi: <strong>{[viewingNote.variant?.title, viewingNote.variant_item?.title].filter(Boolean).join(" › ")}</strong>
                                    </span>
                                </div>
                            )}

                            {/* Full text content display */}
                            <div className="notes-detail-content notes-paper-pad">
                                {viewingNote.note}
                            </div>
                        </div>

                        <div className="notes-modal-footer">
                            <button
                                type="button"
                                className="notes-btn-secondary"
                                onClick={() => handleCopyNote(viewingNote.note)}
                                title="Salin ke clipboard"
                            >
                                <i className="fas fa-copy me-1"></i> Salin
                            </button>

                            <button
                                type="button"
                                className="notes-btn-secondary"
                                onClick={() => handleExportNotes([viewingNote], `Catatan_${(viewingNote.title || "LMSetjen").replace(/\s+/g, "_")}.txt`)}
                                title="Unduh catatan ini ke file teks"
                            >
                                <i className="fas fa-file-arrow-down me-1"></i> Unduh
                            </button>

                            <button
                                type="button"
                                className="notes-btn-secondary"
                                onClick={() => {
                                    handleCloseViewModal();
                                    handleOpenEditModal(viewingNote);
                                }}
                            >
                                <i className="fas fa-pencil me-1"></i> Edit
                            </button>

                            <button
                                type="button"
                                className="notes-btn-save"
                                onClick={handleCloseViewModal}
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </>
    );
}

export default React.memo(Notes);

