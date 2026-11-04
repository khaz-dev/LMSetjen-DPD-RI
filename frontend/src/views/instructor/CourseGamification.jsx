import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Toast, { DeleteConfirmation } from "../plugin/Toast";
import apiInstance from "../../utils/axios";
import "./CourseGamification.css";

import Sidebar from "./Partials/Sidebar";
import Header from "./Partials/Header";
import LoadingSpinner from "./Partials/LoadingSpinner";
import BaseHeader from "../partials/BaseHeader";
import Footer from "../partials/Footer";
import WorkflowStepper from "../../components/WorkflowStepper";
import { useInstructorSidebarCollapse } from "./Partials/useInstructorSidebarCollapse";

const GAME_TYPES = [
    {
        id: "crossword",
        name: "Teka Teki Silang",
        sub: "Kata & Petunjuk",
        icon: "fas fa-border-all",
        iconClass: "icon-crossword",
        badgeClass: "badge-crossword"
    },
    {
        id: "word_search",
        name: "Word Search",
        sub: "Pencarian Kata",
        icon: "fas fa-search",
        iconClass: "icon-wordsearch",
        badgeClass: "badge-wordsearch"
    },
    {
        id: "anagram",
        name: "Anagram",
        sub: "Susun Huruf",
        icon: "fas fa-font",
        iconClass: "icon-anagram",
        badgeClass: "badge-anagram"
    },
    {
        id: "memory_match",
        name: "Memory Match",
        sub: "Cocokkan Kartu",
        icon: "fas fa-clone",
        iconClass: "icon-memory",
        badgeClass: "badge-memory"
    }
];

function CourseGamification() {
    const { course_id } = useParams();
    const navigate = useNavigate();
    const { isSidebarCollapsed } = useInstructorSidebarCollapse();

    const [course, setCourse] = useState(null);
    const [games, setGames] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingGameId, setEditingGameId] = useState(null);
    const [previewMode, setPreviewMode] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        game_type: "crossword",
        max_attempts: 3,
        points_reward: 50,
        time_limit_seconds: 0,
        is_active: true,
        crossword_items: [
            { clue: "Lembaga perwakilan daerah di Indonesia", answer: "DPDRI" },
            { clue: "Pertemuan resmi anggota dewan", answer: "SIDANG" }
        ],
        word_search_words: [
            { word: "LEGISLASI", hint: "Fungsi pembentukan undang-undang" },
            { word: "PARIPURNA", hint: "Sidang tingkat tertinggi" },
            { word: "SENATOR", hint: "Sebutan anggota dewan perwakilan daerah" },
            { word: "KOMITE", hint: "Alat kelengkapan bidang tertentu" }
        ],
        anagram_items: [
            { word: "PROTOKOLER", clue: "Tata cara kehormatan acara resmi kenegaraan" },
            { word: "ASPIRASI", clue: "Harapan dan kehendak masyarakat daerah" },
            { word: "REGULASI", clue: "Aturan atau ketentuan perundang-undangan" }
        ],
        memory_pairs: [
            { term: "DPD RI", definition: "Dewan Perwakilan Daerah Republik Indonesia" },
            { term: "RUU", definition: "Rancangan Undang-Undang" },
            { term: "Tatib", definition: "Tata Tertib pelaksanaan tugas kedewanan" },
            { term: "Reses", definition: "Masa kunjungan kerja anggota ke daerah pemilihan" }
        ]
    });

    // Fetch Course & Games
    const fetchData = async () => {
        try {
            setIsLoading(true);
            const courseRes = await apiInstance.get(`teacher/course-detail/${course_id}/`);
            setCourse(courseRes.data);

            const gamesRes = await apiInstance.get(`game/list-create/?course_id=${course_id}`);
            const rawGames = gamesRes.data?.results || gamesRes.data;
            setGames(Array.isArray(rawGames) ? rawGames : []);
        } catch (error) {
            console.error("Error fetching gamification data:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat data gamifikasi kursus"
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (course_id) {
            fetchData();
        }
    }, [course_id]);

    const gamesList = useMemo(() => {
        if (Array.isArray(games)) return games;
        if (games && Array.isArray(games.results)) return games.results;
        return [];
    }, [games]);

    const handleOpenCreateForm = () => {
        setEditingGameId(null);
        setFormData({
            title: "",
            description: "",
            game_type: "crossword",
            max_attempts: 3,
            points_reward: 50,
            time_limit_seconds: 0,
            is_active: true,
            crossword_items: [
                { clue: "", answer: "" },
                { clue: "", answer: "" }
            ],
            word_search_words: [
                { word: "", hint: "" },
                { word: "", hint: "" },
                { word: "", hint: "" },
                { word: "", hint: "" }
            ],
            anagram_items: [
                { word: "", clue: "" },
                { word: "", clue: "" },
                { word: "", clue: "" }
            ],
            memory_pairs: [
                { term: "", definition: "" },
                { term: "", definition: "" },
                { term: "", definition: "" },
                { term: "", definition: "" }
            ]
        });
        setPreviewMode(false);
        setShowForm(true);
    };

    const handleEditGame = (game) => {
        setEditingGameId(game.game_id);
        const gData = game.game_data || {};

        setFormData({
            title: game.title || "",
            description: game.description || "",
            game_type: game.game_type || "crossword",
            max_attempts: game.max_attempts || 3,
            points_reward: game.points_reward || 50,
            time_limit_seconds: game.time_limit_seconds || 0,
            is_active: game.is_active ?? true,
            crossword_items: gData.items || [
                { clue: "", answer: "" },
                { clue: "", answer: "" }
            ],
            word_search_words: gData.words || [
                { word: "", hint: "" },
                { word: "", hint: "" }
            ],
            anagram_items: gData.items || [
                { word: "", clue: "" },
                { word: "", clue: "" }
            ],
            memory_pairs: gData.pairs || [
                { term: "", definition: "" },
                { term: "", definition: "" }
            ]
        });
        setPreviewMode(false);
        setShowForm(true);
    };

    const handleDeleteGame = async (gameId) => {
        const result = await DeleteConfirmation({
            title: "Hapus Game?",
            text: "Game dan data percobaan peserta terkait akan dihapus permanen."
        });

        if (result.isConfirmed) {
            try {
                await apiInstance.delete(`game/detail/${gameId}/`);
                Toast().fire({
                    icon: "success",
                    title: "Game berhasil dihapus"
                });
                fetchData();
            } catch (error) {
                console.error("Error deleting game:", error);
                Toast().fire({
                    icon: "error",
                    title: "Gagal menghapus game"
                });
            }
        }
    };

    // Item manipulation handlers
    const addCrosswordItem = () => {
        setFormData(prev => ({
            ...prev,
            crossword_items: [...prev.crossword_items, { clue: "", answer: "" }]
        }));
    };

    const updateCrosswordItem = (idx, field, value) => {
        const updated = [...formData.crossword_items];
        updated[idx][field] = field === "answer" ? value.toUpperCase().replace(/\s+/g, "") : value;
        setFormData({ ...formData, crossword_items: updated });
    };

    const removeCrosswordItem = (idx) => {
        if (formData.crossword_items.length <= 2) {
            Toast().fire({ icon: "warning", title: "Minimal butuh 2 pertanyaan TTS" });
            return;
        }
        setFormData({
            ...formData,
            crossword_items: formData.crossword_items.filter((_, i) => i !== idx)
        });
    };

    const addWordSearchItem = () => {
        setFormData(prev => ({
            ...prev,
            word_search_words: [...prev.word_search_words, { word: "", hint: "" }]
        }));
    };

    const updateWordSearchItem = (idx, field, value) => {
        const updated = [...formData.word_search_words];
        updated[idx][field] = field === "word" ? value.toUpperCase().replace(/[^A-Z]/g, "") : value;
        setFormData({ ...formData, word_search_words: updated });
    };

    const removeWordSearchItem = (idx) => {
        if (formData.word_search_words.length <= 3) {
            Toast().fire({ icon: "warning", title: "Minimal butuh 3 kata untuk Word Search" });
            return;
        }
        setFormData({
            ...formData,
            word_search_words: formData.word_search_words.filter((_, i) => i !== idx)
        });
    };

    const addAnagramItem = () => {
        setFormData(prev => ({
            ...prev,
            anagram_items: [...prev.anagram_items, { word: "", clue: "" }]
        }));
    };

    const updateAnagramItem = (idx, field, value) => {
        const updated = [...formData.anagram_items];
        updated[idx][field] = field === "word" ? value.toUpperCase().replace(/[^A-Z\s]/g, "") : value;
        setFormData({ ...formData, anagram_items: updated });
    };

    const removeAnagramItem = (idx) => {
        if (formData.anagram_items.length <= 2) {
            Toast().fire({ icon: "warning", title: "Minimal butuh 2 kata / frasa untuk Anagram" });
            return;
        }
        setFormData({
            ...formData,
            anagram_items: formData.anagram_items.filter((_, i) => i !== idx)
        });
    };

    const addMemoryPair = () => {
        setFormData(prev => ({
            ...prev,
            memory_pairs: [...prev.memory_pairs, { term: "", definition: "" }]
        }));
    };

    const updateMemoryPair = (idx, field, value) => {
        const updated = [...formData.memory_pairs];
        updated[idx][field] = value;
        setFormData({ ...formData, memory_pairs: updated });
    };

    const removeMemoryPair = (idx) => {
        if (formData.memory_pairs.length <= 3) {
            Toast().fire({ icon: "warning", title: "Minimal butuh 3 pasang kartu Memory Match" });
            return;
        }
        setFormData({
            ...formData,
            memory_pairs: formData.memory_pairs.filter((_, i) => i !== idx)
        });
    };

    // Save Game to API
    const handleSaveGame = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            Toast().fire({ icon: "warning", title: "Judul game harus diisi" });
            return;
        }

        let gameDataPayload = {};

        if (formData.game_type === "crossword") {
            const validItems = formData.crossword_items.filter(i => i.clue.trim() && i.answer.trim());
            if (validItems.length < 2) {
                Toast().fire({ icon: "warning", title: "Minimal isi 2 kata dan petunjuk untuk TTS" });
                return;
            }
            gameDataPayload = { items: validItems };
        } else if (formData.game_type === "word_search") {
            const validWords = formData.word_search_words.filter(w => w.word.trim());
            if (validWords.length < 3) {
                Toast().fire({ icon: "warning", title: "Minimal isi 3 kata untuk Word Search" });
                return;
            }
            gameDataPayload = { words: validWords, gridSize: 10 };
        } else if (formData.game_type === "anagram") {
            const validItems = formData.anagram_items
                .filter(i => i.word && i.word.trim())
                .map(i => ({
                    word: i.word.trim().replace(/\s+/g, " ").toUpperCase(),
                    clue: (i.clue || "").trim()
                }));
            if (validItems.length < 2) {
                Toast().fire({ icon: "warning", title: "Minimal isi 2 kata / frasa untuk Anagram" });
                return;
            }
            gameDataPayload = { items: validItems };
        } else if (formData.game_type === "memory_match") {
            const validPairs = formData.memory_pairs.filter(p => p.term.trim() && p.definition.trim());
            if (validPairs.length < 3) {
                Toast().fire({ icon: "warning", title: "Minimal isi 3 pasang istilah dan definisi untuk Memory Match" });
                return;
            }
            gameDataPayload = { pairs: validPairs };
        }

        const payload = {
            course_id: course_id,
            title: formData.title,
            description: formData.description,
            game_type: formData.game_type,
            game_data: gameDataPayload,
            max_attempts: parseInt(formData.max_attempts) || 3,
            points_reward: parseInt(formData.points_reward) || 50,
            time_limit_seconds: parseInt(formData.time_limit_seconds) || 0,
            is_active: formData.is_active
        };

        try {
            setIsSaving(true);
            if (editingGameId) {
                await apiInstance.patch(`game/detail/${editingGameId}/`, payload);
                Toast().fire({ icon: "success", title: "Game berhasil diperbarui" });
            } else {
                await apiInstance.post(`game/list-create/`, payload);
                Toast().fire({ icon: "success", title: "Game baru berhasil dibuat" });
            }
            setShowForm(false);
            fetchData();
        } catch (error) {
            console.error("Error saving game:", error);
            Toast().fire({ icon: "error", title: "Gagal menyimpan game" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <BaseHeader title="Kelola Gamifikasi Kursus" />
            <section className="pt-3 pb-4">
                <div className="container">
                    <Header />
                    <div className="row mt-0 mt-md-3">
                        <Sidebar />
                        <div className={`col-lg-9 col-md-8 col-12 transition-all ${isSidebarCollapsed ? "col-lg-11 col-md-11" : ""}`}>

                            {/* Workflow Stepper */}
                            <WorkflowStepper currentStep={4} courseId={course_id} courseData={course} />

                            <div className="course-gamification-container">

                                {/* 1. Sleek Compact Header Card (Matches LMS Setjen DPD RI Header Pattern) */}
                                <div className="gamification-header-card">
                                    <div className="d-flex flex-column flex-md-row md-align-items-center justify-content-between gap-3">
                                        <div>
                                            <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
                                                <span className="badge bg-teal-subtle text-teal border border-teal-subtle fw-semibold px-2 py-0" style={{ fontSize: "11px" }}>
                                                    <i className="fas fa-gamepad me-1"></i> Gamifikasi Kursus
                                                </span>
                                                <span className="badge bg-light text-muted border px-2 py-0" style={{ fontSize: "11px" }}>
                                                    ID: #{course_id}
                                                </span>
                                                <span className={`badge px-2 py-0 ${course?.platform_status === "Published" ? "bg-success text-white" : "bg-secondary text-white"}`} style={{ fontSize: "11px" }}>
                                                    {course?.platform_status === "Published" ? "Terbit" : "Draf"}
                                                </span>
                                                <span className="badge bg-info-subtle text-info border px-2 py-0" style={{ fontSize: "11px" }}>
                                                    {gamesList.length} Game Tersedia
                                                </span>
                                            </div>
                                            <h4 className="gamification-header-title mb-1">
                                                {course?.title || "Gamifikasi Pembelajaran Kursus"}
                                            </h4>
                                            <p className="gamification-header-desc mb-0">
                                                Kelola mini-game materi interaktif (TTS, Word Search, Anagram, Memory Match) dengan batas 3 kali pengerjaan bagi peserta.
                                            </p>
                                        </div>

                                        <div className="d-flex align-items-center gap-2 flex-wrap flex-shrink-0">
                                            <Link
                                                to={`/instructor/edit-course/${course_id}/`}
                                                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                                                title="Kembali ke Pengaturan Dasar Kursus"
                                            >
                                                <i className="fas fa-arrow-left"></i>
                                                <span>Detail</span>
                                            </Link>
                                            <Link
                                                to={`/instructor/edit-course/${course_id}/curriculum/`}
                                                className="btn btn-outline-teal btn-sm d-inline-flex align-items-center gap-1"
                                                title="Kelola Kurikulum Kursus"
                                            >
                                                <i className="fas fa-list"></i>
                                                <span>Kurikulum</span>
                                            </Link>
                                            <Link
                                                to={`/instructor/edit-course/${course_id}/quiz/`}
                                                className="btn btn-outline-teal btn-sm d-inline-flex align-items-center gap-1"
                                                title="Kelola Kuis Kursus"
                                            >
                                                <i className="fas fa-question-circle"></i>
                                                <span>Kuis</span>
                                            </Link>
                                            {!showForm && (
                                                <button
                                                    type="button"
                                                    className="btn btn-teal-primary btn-sm d-inline-flex align-items-center gap-1"
                                                    onClick={handleOpenCreateForm}
                                                >
                                                    <i className="fas fa-plus"></i>
                                                    <span>Tambah Game</span>
                                                </button>
                                            )}
                                            <Link
                                                to={`/instructor/preview-course/${course_id}/`}
                                                target="_blank"
                                                className="btn btn-teal btn-sm d-inline-flex align-items-center gap-1"
                                                title="Pratinjau Kursus"
                                            >
                                                <i className="fas fa-eye"></i>
                                                <span>Pratinjau</span>
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                {isLoading ? (
                                    <div className="text-center py-4">
                                        <LoadingSpinner />
                                        <p className="text-muted small mt-2">Memuat aktivitas gamifikasi...</p>
                                    </div>
                                ) : showForm ? (
                                    /* 2. Compact Form Builder */
                                    <div className="compact-builder-box">
                                        <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                                            <div className="compact-section-title">
                                                <i className="fas fa-sliders text-teal"></i>
                                                <span>{editingGameId ? "Edit Aktivitas Game" : "Buat Game Baru"}</span>
                                            </div>
                                            <div className="d-flex gap-2">
                                                <button
                                                    type="button"
                                                    className={`btn btn-sm ${previewMode ? "btn-teal-primary" : "btn-outline-secondary"}`}
                                                    style={{ fontSize: "0.8rem", padding: "0.25rem 0.65rem" }}
                                                    onClick={() => setPreviewMode(!previewMode)}
                                                >
                                                    <i className={`fas ${previewMode ? "fa-edit" : "fa-eye"} me-1`}></i>
                                                    {previewMode ? "Kembali ke Editor" : "Live Preview"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary"
                                                    style={{ fontSize: "0.8rem", padding: "0.25rem 0.65rem" }}
                                                    onClick={() => setShowForm(false)}
                                                >
                                                    Tutup
                                                </button>
                                            </div>
                                        </div>

                                        {previewMode ? (
                                            /* Compact Live Preview */
                                            <div className="compact-preview-card text-center">
                                                <div className="badge bg-teal-subtle text-teal border border-teal-subtle px-2 py-1 mb-2 text-uppercase font-monospace" style={{ fontSize: "11px" }}>
                                                    Preview: {GAME_TYPES.find(t => t.id === formData.game_type)?.name}
                                                </div>
                                                <h5 className="fw-bold m-0">{formData.title || "Judul Game"}</h5>
                                                <p className="text-muted small mb-2" style={{ whiteSpace: "pre-line", maxHeight: "80px", overflowY: "auto" }}>
                                                    {formData.description || "Petunjuk game untuk peserta."}
                                                </p>

                                                <div className="d-inline-flex gap-3 bg-white py-1 px-3 rounded-pill border small mb-3">
                                                    <span><i className="fas fa-redo me-1 text-teal"></i><strong>{formData.max_attempts}x</strong> Coba</span>
                                                    <span><i className="fas fa-trophy me-1 text-warning"></i><strong>+{formData.points_reward}</strong> XP</span>
                                                    <span><i className="fas fa-clock me-1 text-info"></i><strong>{formData.time_limit_seconds > 0 ? `${formData.time_limit_seconds}s` : "Tanpa Limit"}</strong></span>
                                                </div>

                                                <div className="card p-3 text-start bg-white mx-auto shadow-sm" style={{ maxWidth: "560px" }}>
                                                    <div className="small fw-bold text-muted mb-2">Item Materi Terdaftar:</div>
                                                    {formData.game_type === "crossword" && (
                                                        <div className="small">
                                                            {formData.crossword_items.map((item, idx) => (
                                                                <div key={idx} className="d-flex justify-content-between border-bottom py-1">
                                                                    <span><strong>{idx + 1}.</strong> {item.clue || "(petunjuk)"}</span>
                                                                    <span className="badge bg-light text-dark font-monospace">{item.answer || "____"}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {formData.game_type === "word_search" && (
                                                        <div className="d-flex flex-wrap gap-1">
                                                            {formData.word_search_words.map((item, idx) => (
                                                                <span key={idx} className="badge bg-light text-dark border font-monospace px-2 py-1">
                                                                    {item.word || "(kata)"}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {formData.game_type === "anagram" && (
                                                        <div className="small">
                                                            {formData.anagram_items.map((item, idx) => (
                                                                <div key={idx} className="d-flex justify-content-between border-bottom py-1">
                                                                    <span><strong>{idx + 1}.</strong> {item.clue || "(clue)"}</span>
                                                                    <span className="badge bg-secondary font-monospace">{item.word || "____"}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {formData.game_type === "memory_match" && (
                                                        <div className="row g-2 small">
                                                            {formData.memory_pairs.map((item, idx) => (
                                                                <div key={idx} className="col-6">
                                                                    <div className="p-1 border rounded bg-light">
                                                                        <strong>{item.term || "Istilah"}</strong>
                                                                        <div className="text-muted small mt-0">{item.definition || "Definisi"}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            /* Compact Form Editor */
                                            <form onSubmit={handleSaveGame}>
                                                {/* Compact Segmented Type Selector */}
                                                <div className="compact-type-selector">
                                                    {GAME_TYPES.map(type => (
                                                        <div
                                                            key={type.id}
                                                            className={`compact-type-btn ${formData.game_type === type.id ? "active" : ""}`}
                                                            onClick={() => setFormData({ ...formData, game_type: type.id })}
                                                        >
                                                            <div className={`compact-type-icon ${type.iconClass}`}>
                                                                <i className={type.icon}></i>
                                                            </div>
                                                            <div className="compact-type-info">
                                                                <div className="compact-type-name">{type.name}</div>
                                                                <div className="compact-type-sub">{type.sub}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Compact 2-Column Fields */}
                                                <div className="row g-2 mb-3">
                                                    <div className="col-md-7">
                                                        <div className="mb-2">
                                                            <label className="form-label-compact">Judul Game <span className="text-danger">*</span></label>
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-compact"
                                                                placeholder="Contoh: TTS Istilah Persidangan & Kelembagaan"
                                                                value={formData.title}
                                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                                required
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="form-label-compact d-flex justify-content-between align-items-center">
                                                                <span>Petunjuk Pengerjaan</span>
                                                                <span className="text-muted fw-normal" style={{ fontSize: "0.72rem" }}>Format Paragraf (Bisa multi-baris)</span>
                                                            </label>
                                                            <textarea
                                                                className="form-control form-control-compact"
                                                                rows={3}
                                                                style={{ resize: "vertical", minHeight: "68px" }}
                                                                placeholder="Tuliskan petunjuk pengerjaan lengkap untuk peserta, seperti aturan main, materi rujukan, atau tips pengerjaan..."
                                                                value={formData.description}
                                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="col-md-5">
                                                        <div className="card p-2 bg-light border-0 h-100">
                                                            <div className="row g-2">
                                                                <div className="col-4">
                                                                    <label className="form-label-compact">Maks Coba</label>
                                                                    <input
                                                                        type="number"
                                                                        className="form-control form-control-compact bg-white"
                                                                        value={formData.max_attempts}
                                                                        onChange={(e) => setFormData({ ...formData, max_attempts: e.target.value })}
                                                                        min="1"
                                                                        max="10"
                                                                    />
                                                                </div>
                                                                <div className="col-4">
                                                                    <label className="form-label-compact">Poin XP</label>
                                                                    <input
                                                                        type="number"
                                                                        className="form-control form-control-compact bg-white"
                                                                        value={formData.points_reward}
                                                                        onChange={(e) => setFormData({ ...formData, points_reward: e.target.value })}
                                                                        min="10"
                                                                    />
                                                                </div>
                                                                <div className="col-4">
                                                                    <label className="form-label-compact">Waktu (s)</label>
                                                                    <input
                                                                        type="number"
                                                                        className="form-control form-control-compact bg-white"
                                                                        value={formData.time_limit_seconds}
                                                                        onChange={(e) => setFormData({ ...formData, time_limit_seconds: e.target.value })}
                                                                        placeholder="0=Off"
                                                                    />
                                                                </div>
                                                                <div className="col-12 mt-2 pt-1 border-top d-flex align-items-center justify-content-between">
                                                                    <span className="small fw-semibold text-muted">Status Aktifkan Game:</span>
                                                                    <div className="form-check form-switch m-0">
                                                                        <input
                                                                            className="form-check-input"
                                                                            type="checkbox"
                                                                            id="isActiveToggle"
                                                                            checked={formData.is_active}
                                                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Compact Soal / Content Editor */}
                                                <div className="border-top pt-2 mb-3">
                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                        <span className="small fw-bold text-dark text-uppercase">
                                                            <i className="fas fa-layer-group me-1 text-teal"></i>
                                                            Daftar Soal {GAME_TYPES.find(t => t.id === formData.game_type)?.name}:
                                                        </span>
                                                        {formData.game_type === "crossword" && (
                                                            <button type="button" className="btn btn-xs btn-outline-success py-1 px-2" style={{ fontSize: "11px" }} onClick={addCrosswordItem}>
                                                                <i className="fas fa-plus me-1"></i>Tambah Baris TTS
                                                            </button>
                                                        )}
                                                        {formData.game_type === "word_search" && (
                                                            <button type="button" className="btn btn-xs btn-outline-success py-1 px-2" style={{ fontSize: "11px" }} onClick={addWordSearchItem}>
                                                                <i className="fas fa-plus me-1"></i>Tambah Kata
                                                            </button>
                                                        )}
                                                        {formData.game_type === "anagram" && (
                                                            <button type="button" className="btn btn-xs btn-outline-success py-1 px-2" style={{ fontSize: "11px" }} onClick={addAnagramItem}>
                                                                <i className="fas fa-plus me-1"></i>Tambah Kata / Frasa
                                                            </button>
                                                        )}
                                                        {formData.game_type === "memory_match" && (
                                                            <button type="button" className="btn btn-xs btn-outline-success py-1 px-2" style={{ fontSize: "11px" }} onClick={addMemoryPair}>
                                                                <i className="fas fa-plus me-1"></i>Tambah Pasangan
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* CROSSWORD LIST */}
                                                    {formData.game_type === "crossword" && (
                                                        <div className="compact-items-container">
                                                            {formData.crossword_items.map((item, idx) => (
                                                                <div key={idx} className="compact-item-row">
                                                                    <div className="item-index-badge">{idx + 1}</div>
                                                                    <div className="flex-grow-1">
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-compact"
                                                                            placeholder="Petunjuk / Clue (Contoh: Lembaga perwakilan daerah)"
                                                                            value={item.clue}
                                                                            onChange={(e) => updateCrosswordItem(idx, "clue", e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div style={{ width: "180px" }}>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-compact font-monospace text-uppercase fw-bold"
                                                                            placeholder="JAWABAN"
                                                                            value={item.answer}
                                                                            onChange={(e) => updateCrosswordItem(idx, "answer", e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-danger p-1"
                                                                        style={{ width: "28px", height: "28px" }}
                                                                        onClick={() => removeCrosswordItem(idx)}
                                                                        title="Hapus baris"
                                                                    >
                                                                        <i className="fas fa-times"></i>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* WORD SEARCH LIST */}
                                                    {formData.game_type === "word_search" && (
                                                        <div className="compact-items-container">
                                                            {formData.word_search_words.map((item, idx) => (
                                                                <div key={idx} className="compact-item-row">
                                                                    <div className="item-index-badge">{idx + 1}</div>
                                                                    <div style={{ width: "200px" }}>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-compact font-monospace text-uppercase fw-bold"
                                                                            placeholder="KATA PENCARIAN"
                                                                            value={item.word}
                                                                            onChange={(e) => updateWordSearchItem(idx, "word", e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="flex-grow-1">
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-compact"
                                                                            placeholder="Petunjuk kata (opsional)"
                                                                            value={item.hint}
                                                                            onChange={(e) => updateWordSearchItem(idx, "hint", e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-danger p-1"
                                                                        style={{ width: "28px", height: "28px" }}
                                                                        onClick={() => removeWordSearchItem(idx)}
                                                                        title="Hapus baris"
                                                                    >
                                                                        <i className="fas fa-times"></i>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* ANAGRAM LIST */}
                                                    {formData.game_type === "anagram" && (
                                                        <div className="compact-items-container">
                                                            {formData.anagram_items.map((item, idx) => (
                                                                <div key={idx} className="compact-item-row">
                                                                    <div className="item-index-badge">{idx + 1}</div>
                                                                    <div style={{ flex: "0 0 260px", minWidth: "220px" }}>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-compact font-monospace text-uppercase fw-bold"
                                                                            placeholder="KATA / FRASA ASLI"
                                                                            value={item.word}
                                                                            onChange={(e) => updateAnagramItem(idx, "word", e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="flex-grow-1">
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-compact"
                                                                            placeholder="Petunjuk / Definisi istilah atau frasa"
                                                                            value={item.clue}
                                                                            onChange={(e) => updateAnagramItem(idx, "clue", e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-danger p-1"
                                                                        style={{ width: "28px", height: "28px" }}
                                                                        onClick={() => removeAnagramItem(idx)}
                                                                        title="Hapus baris"
                                                                    >
                                                                        <i className="fas fa-times"></i>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* MEMORY MATCH LIST */}
                                                    {formData.game_type === "memory_match" && (
                                                        <div className="compact-items-container">
                                                            {formData.memory_pairs.map((item, idx) => (
                                                                <div key={idx} className="compact-item-row">
                                                                    <div className="item-index-badge">{idx + 1}</div>
                                                                    <div style={{ width: "220px" }}>
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-compact fw-bold"
                                                                            placeholder="Kartu 1: Istilah / Konsep"
                                                                            value={item.term}
                                                                            onChange={(e) => updateMemoryPair(idx, "term", e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="flex-grow-1">
                                                                        <input
                                                                            type="text"
                                                                            className="form-control form-control-compact"
                                                                            placeholder="Kartu 2: Definisi / Arti Istilah"
                                                                            value={item.definition}
                                                                            onChange={(e) => updateMemoryPair(idx, "definition", e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-danger p-1"
                                                                        style={{ width: "28px", height: "28px" }}
                                                                        onClick={() => removeMemoryPair(idx)}
                                                                        title="Hapus baris"
                                                                    >
                                                                        <i className="fas fa-times"></i>
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Compact Action Footer */}
                                                <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-light border px-3"
                                                        onClick={() => setShowForm(false)}
                                                    >
                                                        Batal
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="btn btn-sm btn-teal-primary px-3"
                                                        disabled={isSaving}
                                                    >
                                                        {isSaving ? "Menyimpan..." : (editingGameId ? "Perbarui Game" : "Simpan & Buat Game")}
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                ) : (
                                    /* 3. Compact Games List / Empty State */
                                    <div>
                                        {gamesList.length === 0 ? (
                                            <div className="compact-empty-card">
                                                <div className="compact-empty-icon">
                                                    <i className="fas fa-gamepad"></i>
                                                </div>
                                                <h6 className="fw-bold mb-1">Belum Ada Gamifikasi di Kursus Ini</h6>
                                                <p className="text-muted small mb-3" style={{ maxWidth: "440px", margin: "0 auto" }}>
                                                    Tingkatkan motivasi belajar peserta dengan mini-game interaktif (TTS, Word Search, Anagram, atau Memory Match) berbasis materi modul.
                                                </p>
                                                <button className="btn btn-sm btn-teal-primary px-3 py-1" onClick={handleOpenCreateForm}>
                                                    <i className="fas fa-plus me-1"></i>Mulai Buat Game Pertama
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <span className="small fw-bold text-dark text-uppercase">
                                                        Daftar Game Terdaftar ({gamesList.length})
                                                    </span>
                                                    <button
                                                        className="btn btn-xs btn-outline-teal py-1 px-2"
                                                        style={{ fontSize: "11px" }}
                                                        onClick={handleOpenCreateForm}
                                                    >
                                                        <i className="fas fa-plus me-1"></i>Tambah Game
                                                    </button>
                                                </div>

                                                {gamesList.map((game, idx) => {
                                                    const gameMeta = GAME_TYPES.find(t => t.id === game.game_type) || GAME_TYPES[0];
                                                    const gData = game.game_data || {};
                                                    const itemsCount = gData.items?.length || gData.words?.length || gData.pairs?.length || 0;

                                                    return (
                                                        <div key={game.game_id || idx} className="compact-game-item">
                                                            <div className="d-flex align-items-center gap-2 min-w-0">
                                                                <div className={`compact-type-icon ${gameMeta.iconClass}`}>
                                                                    <i className={gameMeta.icon}></i>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="d-flex align-items-center gap-2 mb-0 flex-wrap">
                                                                        <span className={`game-badge-pill ${gameMeta.badgeClass}`}>
                                                                            {gameMeta.name}
                                                                        </span>
                                                                        <span className="fw-bold text-dark" style={{ fontSize: "0.9rem" }}>
                                                                            {game.title}
                                                                        </span>
                                                                        {!game.is_active && (
                                                                            <span className="badge bg-secondary" style={{ fontSize: "10px" }}>Nonaktif</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                                                        <span className="stat-chip">
                                                                            <i className="fas fa-list-check text-muted"></i>
                                                                            {itemsCount} Soal/Kata
                                                                        </span>
                                                                        <span className="stat-chip">
                                                                            <i className="fas fa-redo text-muted"></i>
                                                                            Max {game.max_attempts} Coba
                                                                        </span>
                                                                        <span className="stat-chip">
                                                                            <i className="fas fa-trophy text-warning"></i>
                                                                            +{game.points_reward} XP
                                                                        </span>
                                                                        {game.time_limit_seconds > 0 && (
                                                                            <span className="stat-chip">
                                                                                <i className="fas fa-clock text-info"></i>
                                                                                {game.time_limit_seconds}s
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="d-flex align-items-center gap-1 flex-shrink-0 ms-2">
                                                                <button
                                                                    className="btn btn-sm btn-outline-secondary py-1 px-2"
                                                                    style={{ fontSize: "0.775rem" }}
                                                                    onClick={() => handleEditGame(game)}
                                                                    title="Edit Game"
                                                                >
                                                                    <i className="fas fa-edit me-1"></i>Edit
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm btn-outline-danger py-1 px-2"
                                                                    style={{ fontSize: "0.775rem" }}
                                                                    onClick={() => handleDeleteGame(game.game_id)}
                                                                    title="Hapus Game"
                                                                >
                                                                    <i className="fas fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </>
    );
}

export default CourseGamification;
