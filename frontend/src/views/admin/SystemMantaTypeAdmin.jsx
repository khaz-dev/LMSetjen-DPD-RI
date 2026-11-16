import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiInstance from "../../utils/axios";
import Toast from "../plugin/Toast";
import dayjs, { moment } from "../../utils/dayjs";
import "./SystemMantaTypeAdmin.css";

const DIFFICULTY_MAP = {
    easy: { label: "Wave 1: Mudah (3-4 Huruf)", badgeClass: "badge-diff-easy", short: "Easy" },
    medium: { label: "Wave 2-3: Menengah (5-7 Huruf)", badgeClass: "badge-diff-medium", short: "Medium" },
    hard: { label: "Wave 4+: Mahir (8+ Huruf)", badgeClass: "badge-diff-hard", short: "Hard" }
};

const CATEGORY_MAP = {
    berakhlak: { label: "Core Values BerAKHLAK", icon: "fa-award", colorClass: "cat-berakhlak" },
    keparlemenan: { label: "Keparlemenan DPD RI", icon: "fa-landmark", colorClass: "cat-keparlemenan" },
    lms: { label: "LMS & Literasi Digital", icon: "fa-laptop-code", colorClass: "cat-lms" },
    umum: { label: "Kosakata Umum / Kerja", icon: "fa-comments", colorClass: "cat-umum" }
};

export default function SystemMantaTypeAdmin({ isEmbedded = false, refreshTrigger = 0 }) {
    // Active sub-tab in MantaType console
    const [subTab, setSubTab] = useState("settings"); // "settings" | "words" | "ranked"

    // Telemetry & Settings
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [telemetry, setTelemetry] = useState(null);
    const [settingsForm, setSettingsForm] = useState({
        is_enabled: true,
        restrict_to_break_hours: true,
        work_start: "08:00",
        break_start: "12:00",
        break_end: "13:00",
        after_work_start: "16:30",
        allow_weekend: true,
        daily_play_limit: 5,
        offline_custom_message: "Saat ini MantaType sedang tidak dapat diakses sesuai jadwal jam kerja kedinasan."
    });

    // Word Bank
    const [words, setWords] = useState([]);
    const [wordCounts, setWordCounts] = useState({ total: 0, easy: 0, medium: 0, hard: 0, active: 0 });
    const [loadingWords, setLoadingWords] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [diffFilter, setDiffFilter] = useState("all");
    const [catFilter, setCatFilter] = useState("all");
    const [activeFilter, setActiveFilter] = useState("all");

    // Word Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [editingWord, setEditingWord] = useState(null);
    const [singleWordForm, setSingleWordForm] = useState({
        word: "",
        difficulty: "easy",
        category: "keparlemenan",
        meaning: "",
        is_active: true
    });
    const [bulkForm, setBulkForm] = useState({
        words_text: "",
        difficulty: "auto",
        category: "umum",
        meaning: ""
    });
    const [actionLoading, setActionLoading] = useState(false);

    // Leaderboard
    const [leaderboard, setLeaderboard] = useState([]);
    const [loadingRanked, setLoadingRanked] = useState(false);
    const [resettingRanked, setResettingRanked] = useState(false);

    // =========================================================================
    // 1. FETCH DATA
    // =========================================================================

    // Fetch Settings & Telemetry
    const fetchSettings = useCallback(async () => {
        try {
            setLoadingSettings(true);
            const res = await apiInstance.get("/admin/mantatype/settings/");
            if (res.data?.status === "success") {
                const s = res.data.settings;
                setSettingsForm({
                    is_enabled: s.is_enabled ?? true,
                    restrict_to_break_hours: s.restrict_to_break_hours ?? true,
                    work_start: s.work_start ? s.work_start.substring(0, 5) : "08:00",
                    break_start: s.break_start ? s.break_start.substring(0, 5) : "12:00",
                    break_end: s.break_end ? s.break_end.substring(0, 5) : "13:00",
                    after_work_start: s.after_work_start ? s.after_work_start.substring(0, 5) : "16:30",
                    allow_weekend: s.allow_weekend ?? true,
                    daily_play_limit: s.daily_play_limit ?? 5,
                    offline_custom_message: s.offline_custom_message || ""
                });
                setTelemetry(res.data.runtime_telemetry);
            }
        } catch (err) {
            console.error("Gagal memuat pengaturan MantaType:", err);
            Toast("error", "Gagal memuat pengaturan MantaType dari server.");
        } finally {
            setLoadingSettings(false);
        }
    }, []);

    // Fetch Words
    const fetchWords = useCallback(async () => {
        try {
            setLoadingWords(true);
            const params = {};
            if (searchQuery) params.search = searchQuery;
            if (diffFilter !== "all") params.difficulty = diffFilter;
            if (catFilter !== "all") params.category = catFilter;
            if (activeFilter !== "all") params.is_active = activeFilter;

            const res = await apiInstance.get("/admin/mantatype/words/", { params });
            if (res.data?.status === "success") {
                setWords(res.data.words || []);
                if (res.data.counts) {
                    setWordCounts(res.data.counts);
                }
            }
        } catch (err) {
            console.error("Gagal memuat Bank Kosakata MantaType:", err);
            Toast("error", "Gagal memuat daftar kosakata.");
        } finally {
            setLoadingWords(false);
        }
    }, [searchQuery, diffFilter, catFilter, activeFilter]);

    // Fetch Leaderboard
    const fetchLeaderboard = useCallback(async () => {
        try {
            setLoadingRanked(true);
            const res = await apiInstance.get("/manta-game/leaderboard/");
            if (res.data?.status === "success") {
                setLeaderboard(res.data.leaderboard || []);
            }
        } catch (err) {
            console.error("Gagal memuat papan peringkat:", err);
        } finally {
            setLoadingRanked(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings, refreshTrigger]);

    useEffect(() => {
        if (subTab === "words") {
            fetchWords();
        } else if (subTab === "ranked") {
            fetchLeaderboard();
        }
    }, [subTab, fetchWords, fetchLeaderboard]);

    // =========================================================================
    // 2. HANDLERS
    // =========================================================================

    // Save Settings
    const handleSaveSettings = async (e) => {
        if (e) e.preventDefault();
        try {
            setSavingSettings(true);
            const payload = {
                ...settingsForm,
                work_start: settingsForm.work_start.length === 5 ? `${settingsForm.work_start}:00` : settingsForm.work_start,
                break_start: settingsForm.break_start.length === 5 ? `${settingsForm.break_start}:00` : settingsForm.break_start,
                break_end: settingsForm.break_end.length === 5 ? `${settingsForm.break_end}:00` : settingsForm.break_end,
                after_work_start: settingsForm.after_work_start.length === 5 ? `${settingsForm.after_work_start}:00` : settingsForm.after_work_start,
            };

            const res = await apiInstance.put("/admin/mantatype/settings/", payload);
            if (res.data?.status === "success") {
                Toast("success", "Pengaturan MantaType berhasil disimpan!");
                fetchSettings();
            }
        } catch (err) {
            console.error("Gagal menyimpan pengaturan:", err);
            Toast("error", err.response?.data?.message || "Gagal menyimpan perubahan pengaturan.");
        } finally {
            setSavingSettings(false);
        }
    };

    // Save Single Word (Create or Edit)
    const handleSaveSingleWord = async (e) => {
        if (e) e.preventDefault();
        if (!singleWordForm.word.trim()) {
            Toast("warning", "Kata tidak boleh kosong!");
            return;
        }

        try {
            setActionLoading(true);
            if (editingWord) {
                // Edit existing
                const res = await apiInstance.put(`/admin/mantatype/words/${editingWord.id}/`, singleWordForm);
                if (res.data?.status === "success") {
                    Toast("success", `Kata '${editingWord.word}' berhasil diperbarui!`);
                    setShowAddModal(false);
                    setEditingWord(null);
                    fetchWords();
                }
            } else {
                // Add new
                const res = await apiInstance.post("/admin/mantatype/words/", singleWordForm);
                if (res.data?.status === "success") {
                    Toast("success", `Kata '${singleWordForm.word.toUpperCase()}' berhasil ditambahkan!`);
                    setShowAddModal(false);
                    setSingleWordForm({
                        word: "",
                        difficulty: "easy",
                        category: "keparlemenan",
                        meaning: "",
                        is_active: true
                    });
                    fetchWords();
                }
            }
        } catch (err) {
            console.error("Error saving word:", err);
            Toast("error", err.response?.data?.message || "Gagal menyimpan kata.");
        } finally {
            setActionLoading(false);
        }
    };

    // Quick Toggle Word Active
    const handleToggleWordActive = async (wordObj) => {
        try {
            const nextStatus = !wordObj.is_active;
            const res = await apiInstance.put(`/admin/mantatype/words/${wordObj.id}/`, {
                is_active: nextStatus
            });
            if (res.data?.status === "success") {
                setWords(prev => prev.map(w => w.id === wordObj.id ? { ...w, is_active: nextStatus } : w));
                Toast("success", `Kata '${wordObj.word}' kini ${nextStatus ? "Aktif" : "Nonaktif"}.`);
            }
        } catch (err) {
            Toast("error", "Gagal mengubah status aktif kata.");
        }
    };

    // Delete Word
    const handleDeleteWord = async (wordObj) => {
        if (!window.confirm(`Yakin ingin menghapus kata '${wordObj.word}' dari Bank Kosakata?`)) {
            return;
        }
        try {
            const res = await apiInstance.delete(`/admin/mantatype/words/${wordObj.id}/`);
            if (res.data?.status === "success") {
                Toast("success", `Kata '${wordObj.word}' berhasil dihapus.`);
                setWords(prev => prev.filter(w => w.id !== wordObj.id));
            }
        } catch (err) {
            Toast("error", "Gagal menghapus kata.");
        }
    };

    // Bulk Import Words
    const handleBulkImport = async (e) => {
        if (e) e.preventDefault();
        if (!bulkForm.words_text.trim()) {
            Toast("warning", "Silakan masukkan daftar kata terlebih dahulu!");
            return;
        }

        try {
            setActionLoading(true);
            const res = await apiInstance.post("/admin/mantatype/words/bulk/", bulkForm);
            if (res.data?.status === "success") {
                Toast("success", res.data.message || "Bulk import berhasil!");
                setShowBulkModal(false);
                setBulkForm({ words_text: "", difficulty: "auto", category: "umum", meaning: "" });
                fetchWords();
            }
        } catch (err) {
            console.error("Bulk import error:", err);
            Toast("error", err.response?.data?.message || "Gagal melakukan impor kata.");
        } finally {
            setActionLoading(false);
        }
    };

    // Open Edit Word Modal
    const handleOpenEdit = (w) => {
        setEditingWord(w);
        setSingleWordForm({
            word: w.word,
            difficulty: w.difficulty,
            category: w.category,
            meaning: w.meaning || "",
            is_active: w.is_active
        });
        setShowAddModal(true);
    };

    // Reset Leaderboard
    const handleResetLeaderboard = async (mode) => {
        const confirmMsg = mode === "guests_only"
            ? "Bersihkan semua skor Guest (pemain tamu non-login)?"
            : mode === "test_scores"
                ? "Bersihkan skor tes / uji coba (skor <= 100)?"
                : "PERINGATAN: Seluruh skor papan peringkat MantaType akan di-reset untuk musim baru. Lanjutkan?";

        if (!window.confirm(confirmMsg)) return;

        try {
            setResettingRanked(true);
            const res = await apiInstance.post("/admin/mantatype/reset-leaderboard/", { mode });
            if (res.data?.status === "success") {
                Toast("success", res.data.message || "Papan peringkat berhasil dibersihkan!");
                fetchLeaderboard();
            }
        } catch (err) {
            Toast("error", "Gagal mereset papan peringkat.");
        } finally {
            setResettingRanked(false);
        }
    };

    const isLiveAccessible = telemetry?.is_accessible_now ?? settingsForm.is_enabled;

    return (
        <div className="mantatype-admin-container">
            {/* 1. Header Telemetry & Quick Action Bar */}
            <div className="mantatype-action-bar">
                <div className="mantatype-bar-left">
                    <div className="mantatype-live-chip">
                        <span className={`pulse-dot ${settingsForm.is_enabled ? "active" : "offline"}`}></span>
                        <span>MantaType: {settingsForm.is_enabled ? "AKTIF" : "NONAKTIF"}</span>
                    </div>

                    <div className={`mantatype-access-pill ${isLiveAccessible ? "accessible" : "restricted"}`}>
                        <i className={`fas ${isLiveAccessible ? "fa-door-open text-emerald" : "fa-lock text-warning"} me-1`}></i>
                        <span>
                            {isLiveAccessible ? "Status Akses: Buka Sekarang" : "Status Akses: Terkunci (Jam Kerja Kedinasan)"}
                        </span>
                    </div>

                    {telemetry?.server_time && (
                        <div className="mantatype-time-pill">
                            <i className="far fa-clock me-1 text-teal"></i>
                            <span>WIB Server: {telemetry.server_time}</span>
                        </div>
                    )}
                </div>

                <div className="mantatype-bar-right">
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-teal"
                        onClick={() => {
                            fetchSettings();
                            if (subTab === "words") fetchWords();
                            if (subTab === "ranked") fetchLeaderboard();
                        }}
                        disabled={loadingSettings}
                    >
                        <i className={`fas fa-sync-alt me-1 ${loadingSettings ? "fa-spin" : ""}`}></i>
                        Segarkan
                    </button>
                </div>
            </div>

            {/* 2. Sub-Tab Switcher Navigation */}
            <div className="mantatype-subtabs-nav">
                <button
                    type="button"
                    className={`subtab-btn ${subTab === "settings" ? "active" : ""}`}
                    onClick={() => setSubTab("settings")}
                >
                    <i className="fas fa-sliders-h me-2"></i>
                    Pengaturan & Jam Operasional
                </button>
                <button
                    type="button"
                    className={`subtab-btn ${subTab === "words" ? "active" : ""}`}
                    onClick={() => setSubTab("words")}
                >
                    <i className="fas fa-book-open me-2"></i>
                    Bank Kosakata ({wordCounts.total || words.length})
                </button>
                <button
                    type="button"
                    className={`subtab-btn ${subTab === "ranked" ? "active" : ""}`}
                    onClick={() => setSubTab("ranked")}
                >
                    <i className="fas fa-trophy me-2"></i>
                    Papan Peringkat (Ranked)
                </button>
            </div>

            {/* ================================================================= */}
            {/* SUBTAB 1: PENGATURAN & JAM OPERASIONAL                            */}
            {/* ================================================================= */}
            {subTab === "settings" && (
                <div className="mantatype-tab-content fade-in">
                    <form onSubmit={handleSaveSettings} className="settings-form-layout">
                        {/* Panel 1: Master Control & Saklar Global */}
                        <div className="settings-card">
                            <div className="card-head-compact">
                                <div className="head-title">
                                    <i className="fas fa-power-off text-teal me-2"></i>
                                    <h5>Master Switch & Kebijakan Global</h5>
                                </div>
                                <span className="head-badge">Sistem LMS</span>
                            </div>
                            <div className="card-body-compact">
                                <div className="setting-toggle-row">
                                    <div className="toggle-info">
                                        <label className="toggle-label">Aktifkan Game MantaType di LMS</label>
                                        <p className="toggle-desc">
                                            Jika dinonaktifkan, ikon dan menu MantaType pada SiManta AI Avatar akan disembunyikan dari pengguna.
                                        </p>
                                    </div>
                                    <div className="form-check form-switch custom-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="toggleEnabled"
                                            checked={settingsForm.is_enabled}
                                            onChange={(e) => setSettingsForm({ ...settingsForm, is_enabled: e.target.checked })}
                                        />
                                    </div>
                                </div>

                                <div className="setting-toggle-row">
                                    <div className="toggle-info">
                                        <label className="toggle-label">Batasi Akses Selama Jam Kerja Kedinasan (Work-Hour Restriction)</label>
                                        <p className="toggle-desc">
                                            Sangat direkomendasikan untuk ASN: MantaType hanya dapat diakses saat jam istirahat siang, sebelum jam dinas, atau setelah jam kantor selesai.
                                        </p>
                                    </div>
                                    <div className="form-check form-switch custom-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="toggleBreakHours"
                                            checked={settingsForm.restrict_to_break_hours}
                                            onChange={(e) => setSettingsForm({ ...settingsForm, restrict_to_break_hours: e.target.checked })}
                                        />
                                    </div>
                                </div>

                                <div className="setting-toggle-row">
                                    <div className="toggle-info">
                                        <label className="toggle-label">Bebas Akses di Akhir Pekan (Sabtu & Minggu)</label>
                                        <p className="toggle-desc">
                                            Mengizinkan staf dan peserta pelatihan bermain 24 jam penuh pada hari libur akhir pekan.
                                        </p>
                                    </div>
                                    <div className="form-check form-switch custom-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="toggleWeekend"
                                            checked={settingsForm.allow_weekend}
                                            onChange={(e) => setSettingsForm({ ...settingsForm, allow_weekend: e.target.checked })}
                                        />
                                    </div>
                                </div>

                                <div className="setting-input-row mt-3">
                                    <div className="row g-3 align-items-center">
                                        <div className="col-md-8">
                                            <label className="form-label-compact">Batas Sesi Bermain Harian (Daily Session Cap)</label>
                                            <p className="toggle-desc">Maksimal berapa kali seorang user dapat memulai sesi game per hari (0 = tanpa batas).</p>
                                        </div>
                                        <div className="col-md-4">
                                            <div className="input-group input-group-sm">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="50"
                                                    className="form-control form-control-compact text-center fw-bold"
                                                    value={settingsForm.daily_play_limit}
                                                    onChange={(e) => setSettingsForm({ ...settingsForm, daily_play_limit: parseInt(e.target.value) || 0 })}
                                                />
                                                <span className="input-group-text bg-light">Sesi / Hari</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Panel 2: Konfigurasi Jam Kerja Kedinasan */}
                        <div className="settings-card">
                            <div className="card-head-compact">
                                <div className="head-title">
                                    <i className="fas fa-business-time text-teal me-2"></i>
                                    <h5>Jadwal Jam Dinas & Jam Istirahat Kantor</h5>
                                </div>
                                <span className="head-badge">Zona Waktu WIB</span>
                            </div>
                            <div className="card-body-compact">
                                <p className="section-note mb-3">
                                    <i className="fas fa-info-circle text-teal me-1"></i>
                                    Aturan ini hanya berlaku jika <strong>Batasi Akses Selama Jam Kerja</strong> diaktifkan. Di luar jam kerja dan selama istirahat siang, staf dapat bermain untuk *refreshing* dan melatih kecepatan ketik.
                                </p>

                                <div className="row g-3">
                                    <div className="col-sm-6 col-md-3">
                                        <label className="form-label-compact">Mulai Jam Dinas</label>
                                        <input
                                            type="time"
                                            className="form-control form-control-compact"
                                            value={settingsForm.work_start}
                                            onChange={(e) => setSettingsForm({ ...settingsForm, work_start: e.target.value })}
                                            required
                                        />
                                        <span className="form-text-hint">Standar: 08:00 WIB</span>
                                    </div>

                                    <div className="col-sm-6 col-md-3">
                                        <label className="form-label-compact">Mulai Istirahat Siang</label>
                                        <input
                                            type="time"
                                            className="form-control form-control-compact highlight-break"
                                            value={settingsForm.break_start}
                                            onChange={(e) => setSettingsForm({ ...settingsForm, break_start: e.target.value })}
                                            required
                                        />
                                        <span className="form-text-hint">Game dibuka (12:00)</span>
                                    </div>

                                    <div className="col-sm-6 col-md-3">
                                        <label className="form-label-compact">Selesai Istirahat Siang</label>
                                        <input
                                            type="time"
                                            className="form-control form-control-compact highlight-break"
                                            value={settingsForm.break_end}
                                            onChange={(e) => setSettingsForm({ ...settingsForm, break_end: e.target.value })}
                                            required
                                        />
                                        <span className="form-text-hint">Game ditutup kembali (13:00)</span>
                                    </div>

                                    <div className="col-sm-6 col-md-3">
                                        <label className="form-label-compact">Selesai Jam Kantor (Sore)</label>
                                        <input
                                            type="time"
                                            className="form-control form-control-compact"
                                            value={settingsForm.after_work_start}
                                            onChange={(e) => setSettingsForm({ ...settingsForm, after_work_start: e.target.value })}
                                            required
                                        />
                                        <span className="form-text-hint">Bebas main (16:30+)</span>
                                    </div>
                                </div>

                                <div className="mt-3">
                                    <label className="form-label-compact">Pesan Kustom Jam Kerja / Nonaktif</label>
                                    <textarea
                                        rows="2"
                                        className="form-control form-control-compact"
                                        placeholder="Pesan yang tampil pada dialog avatar saat game ditutup..."
                                        value={settingsForm.offline_custom_message}
                                        onChange={(e) => setSettingsForm({ ...settingsForm, offline_custom_message: e.target.value })}
                                    ></textarea>
                                    <span className="form-text-hint">Pesan santun pengingat tugas dinas yang akan dibacakan SiManta AI.</span>
                                </div>
                            </div>
                        </div>

                        {/* Submit Actions */}
                        <div className="settings-submit-bar">
                            <button
                                type="submit"
                                className="btn btn-teal px-4"
                                disabled={savingSettings}
                            >
                                <i className={`fas ${savingSettings ? "fa-spinner fa-spin" : "fa-save"} me-2`}></i>
                                {savingSettings ? "Menyimpan Pengaturan..." : "Simpan Pengaturan MantaType"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ================================================================= */}
            {/* SUBTAB 2: BANK KOSAKATA MANTATYPE (CRUD & BULK)                   */}
            {/* ================================================================= */}
            {subTab === "words" && (
                <div className="mantatype-tab-content fade-in">
                    {/* Filter & Action Toolbar */}
                    <div className="words-toolbar">
                        <div className="toolbar-left">
                            <div className="search-box-compact">
                                <i className="fas fa-search search-icon"></i>
                                <input
                                    type="text"
                                    className="form-control form-control-compact"
                                    placeholder="Cari kata atau makna glosarium..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        className="clear-search-btn"
                                        onClick={() => setSearchQuery("")}
                                    >
                                        &times;
                                    </button>
                                )}
                            </div>

                            <select
                                className="form-select form-select-compact"
                                value={diffFilter}
                                onChange={(e) => setDiffFilter(e.target.value)}
                            >
                                <option value="all">Semua Kesulitan ({wordCounts.total})</option>
                                <option value="easy">Easy / Wave 1 ({wordCounts.easy})</option>
                                <option value="medium">Medium / Wave 2-3 ({wordCounts.medium})</option>
                                <option value="hard">Hard / Wave 4+ ({wordCounts.hard})</option>
                            </select>

                            <select
                                className="form-select form-select-compact"
                                value={catFilter}
                                onChange={(e) => setCatFilter(e.target.value)}
                            >
                                <option value="all">Semua Kategori</option>
                                <option value="berakhlak">Core Values BerAKHLAK</option>
                                <option value="keparlemenan">Keparlemenan DPD RI</option>
                                <option value="lms">LMS & Digital</option>
                                <option value="umum">Kosakata Umum</option>
                            </select>

                            <select
                                className="form-select form-select-compact"
                                value={activeFilter}
                                onChange={(e) => setActiveFilter(e.target.value)}
                            >
                                <option value="all">Semua Status</option>
                                <option value="true">Hanya Aktif</option>
                                <option value="false">Nonaktif</option>
                            </select>
                        </div>

                        <div className="toolbar-right">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-teal"
                                onClick={() => setShowBulkModal(true)}
                            >
                                <i className="fas fa-file-import me-1"></i>
                                Impor Massal (Bulk)
                            </button>

                            <button
                                type="button"
                                className="btn btn-sm btn-teal"
                                onClick={() => {
                                    setEditingWord(null);
                                    setSingleWordForm({
                                        word: "",
                                        difficulty: "easy",
                                        category: "keparlemenan",
                                        meaning: "",
                                        is_active: true
                                    });
                                    setShowAddModal(true);
                                }}
                            >
                                <i className="fas fa-plus me-1"></i>
                                Tambah Kata
                            </button>
                        </div>
                    </div>

                    {/* Words Table */}
                    <div className="words-table-wrapper">
                        {loadingWords ? (
                            <div className="loading-state-box">
                                <i className="fas fa-circle-notch fa-spin text-teal fa-2x mb-2"></i>
                                <span>Memuat Bank Kosakata MantaType...</span>
                            </div>
                        ) : words.length === 0 ? (
                            <div className="empty-state-box">
                                <i className="fas fa-spell-check text-muted fa-3x mb-2"></i>
                                <h6>Tidak Ada Kosakata Ditemukan</h6>
                                <p className="text-muted">Coba ubah filter pencarian atau tambahkan kata baru.</p>
                            </div>
                        ) : (
                            <table className="table table-hover table-compact-manta align-middle">
                                <thead>
                                    <tr>
                                        <th style={{ width: "50px" }}>No</th>
                                        <th style={{ width: "200px" }}>Kata (Word)</th>
                                        <th style={{ width: "170px" }}>Kesulitan</th>
                                        <th style={{ width: "180px" }}>Kategori</th>
                                        <th>Arti / Glosarium Edukatif</th>
                                        <th style={{ width: "110px" }} className="text-center">Status</th>
                                        <th style={{ width: "110px" }} className="text-end">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {words.map((w, idx) => {
                                        const diffInfo = DIFFICULTY_MAP[w.difficulty] || DIFFICULTY_MAP.easy;
                                        const catInfo = CATEGORY_MAP[w.category] || CATEGORY_MAP.umum;

                                        return (
                                            <tr key={w.id} className={!w.is_active ? "row-inactive" : ""}>
                                                <td className="text-muted">{idx + 1}</td>
                                                <td>
                                                    <span className="word-token">{w.word}</span>
                                                    <span className="word-len-pill ms-1">{w.word.length}h</span>
                                                </td>
                                                <td>
                                                    <span className={`diff-pill ${diffInfo.badgeClass}`}>
                                                        {diffInfo.short}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`cat-pill ${catInfo.colorClass}`}>
                                                        <i className={`fas ${catInfo.icon} me-1`}></i>
                                                        {catInfo.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    {w.meaning ? (
                                                        <span className="word-meaning-text">{w.meaning}</span>
                                                    ) : (
                                                        <span className="text-muted fst-italic">-</span>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    <button
                                                        type="button"
                                                        className={`btn-status-toggle ${w.is_active ? "active" : "inactive"}`}
                                                        onClick={() => handleToggleWordActive(w)}
                                                        title="Klik untuk ubah status aktif/nonaktif"
                                                    >
                                                        {w.is_active ? "Aktif" : "Mati"}
                                                    </button>
                                                </td>
                                                <td className="text-end">
                                                    <div className="btn-group btn-group-sm">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary btn-table-action"
                                                            onClick={() => handleOpenEdit(w)}
                                                            title="Edit Kata"
                                                        >
                                                            <i className="fas fa-pencil-alt"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger btn-table-action"
                                                            onClick={() => handleDeleteWord(w)}
                                                            title="Hapus Kata"
                                                        >
                                                            <i className="fas fa-trash-alt"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ================================================================= */}
            {/* SUBTAB 3: PAPAN PERINGKAT & TATA KELOLA (RANKED)                  */}
            {/* ================================================================= */}
            {subTab === "ranked" && (
                <div className="mantatype-tab-content fade-in">
                    <div className="ranked-action-bar mb-3">
                        <div className="ranked-bar-title">
                            <i className="fas fa-trophy text-warning me-2"></i>
                            <h6 className="mb-0">Papan Peringkat Top 10 MantaType</h6>
                            <span className="text-muted ms-2">({leaderboard.length} Rekor Terdaftar)</span>
                        </div>

                        <div className="btn-group btn-group-sm">
                            <button
                                type="button"
                                className="btn btn-outline-warning"
                                onClick={() => handleResetLeaderboard("guests_only")}
                                disabled={resettingRanked}
                            >
                                <i className="fas fa-user-slash me-1"></i>
                                Bersihkan Skor Tamu (Guest)
                            </button>
                            <button
                                type="button"
                                className="btn btn-outline-danger"
                                onClick={() => handleResetLeaderboard("all")}
                                disabled={resettingRanked}
                            >
                                <i className="fas fa-trash-restore me-1"></i>
                                Reset Musim Baru (Semua)
                            </button>
                        </div>
                    </div>

                    <div className="ranked-table-wrapper">
                        {loadingRanked ? (
                            <div className="loading-state-box">
                                <i className="fas fa-circle-notch fa-spin text-teal fa-2x mb-2"></i>
                                <span>Memuat Peringkat...</span>
                            </div>
                        ) : leaderboard.length === 0 ? (
                            <div className="empty-state-box">
                                <i className="fas fa-medal text-muted fa-3x mb-2"></i>
                                <h6>Belum Ada Rekor Tercatat</h6>
                                <p className="text-muted">Jadilah yang pertama mencatatkan rekor di MantaType Arcade!</p>
                            </div>
                        ) : (
                            <table className="table table-hover table-compact-manta align-middle">
                                <thead>
                                    <tr>
                                        <th style={{ width: "70px" }}>Rank</th>
                                        <th>Nama Pemain</th>
                                        <th>Tipe Akun</th>
                                        <th className="text-end">Skor</th>
                                        <th className="text-end">Kata Diketik</th>
                                        <th className="text-end">Akurasi</th>
                                        <th className="text-end">WPM</th>
                                        <th className="text-center">Wave Capaian</th>
                                        <th className="text-end">Tanggal Rekor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboard.map((item, idx) => (
                                        <tr key={item.id}>
                                            <td>
                                                <span className={`rank-medal rank-${item.rank}`}>
                                                    {item.rank === 1 ? "🥇 1" : item.rank === 2 ? "🥈 2" : item.rank === 3 ? "🥉 3" : `#${item.rank}`}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    {item.avatar_url ? (
                                                        <img src={item.avatar_url} alt="" className="player-avatar-small" />
                                                    ) : (
                                                        <div className="player-avatar-placeholder">
                                                            {item.player_name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <span className="fw-semibold">{item.player_name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {item.is_guest ? (
                                                    <span className="badge bg-secondary">Guest Arcade</span>
                                                ) : (
                                                    <span className="badge bg-primary">Akun LMS DPD RI</span>
                                                )}
                                            </td>
                                            <td className="text-end fw-bold text-teal">{item.score.toLocaleString()}</td>
                                            <td className="text-end">{item.words_typed}</td>
                                            <td className="text-end text-success">{item.accuracy}%</td>
                                            <td className="text-end">{item.wpm} WPM</td>
                                            <td className="text-center">
                                                <span className="badge bg-dark">Lv.{item.wave_reached}</span>
                                            </td>
                                            <td className="text-end text-muted small">{item.created_at}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ================================================================= */}
            {/* MODAL: TAMBAH / EDIT KATA TUNGGAL                                 */}
            {/* ================================================================= */}
            {showAddModal && (
                <div className="mantatype-modal-backdrop">
                    <div className="mantatype-admin-modal">
                        <div className="modal-head">
                            <h6>{editingWord ? "Edit Kosakata MantaType" : "Tambah Kosakata Baru"}</h6>
                            <button
                                type="button"
                                className="close-btn"
                                onClick={() => { setShowAddModal(false); setEditingWord(null); }}
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleSaveSingleWord}>
                            <div className="modal-body">
                                <div className="mb-3">
                                    <label className="form-label-compact">Kata (Tanpa Spasi, Otomatis Huruf Kapital)</label>
                                    <input
                                        type="text"
                                        className="form-control form-control-compact font-monospace fw-bold"
                                        placeholder="Contoh: SENATOR, BERAKHLAK, INTEGRITAS"
                                        value={singleWordForm.word}
                                        onChange={(e) => setSingleWordForm({ ...singleWordForm, word: e.target.value })}
                                        required
                                        autoFocus
                                    />
                                    <span className="form-text-hint">Spasi akan otomatis dihapus untuk menjaga ritme ketik.</span>
                                </div>

                                <div className="row g-2 mb-3">
                                    <div className="col-md-6">
                                        <label className="form-label-compact">Tingkat Kesulitan</label>
                                        <select
                                            className="form-select form-select-compact"
                                            value={singleWordForm.difficulty}
                                            onChange={(e) => setSingleWordForm({ ...singleWordForm, difficulty: e.target.value })}
                                        >
                                            <option value="easy">Wave 1: Mudah (3-4 Huruf)</option>
                                            <option value="medium">Wave 2-3: Menengah (5-7 Huruf)</option>
                                            <option value="hard">Wave 4+: Mahir (8+ Huruf)</option>
                                        </select>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label-compact">Kategori / Tema</label>
                                        <select
                                            className="form-select form-select-compact"
                                            value={singleWordForm.category}
                                            onChange={(e) => setSingleWordForm({ ...singleWordForm, category: e.target.value })}
                                        >
                                            <option value="keparlemenan">Keparlemenan DPD RI</option>
                                            <option value="berakhlak">Core Values BerAKHLAK</option>
                                            <option value="lms">LMS & Literasi Digital</option>
                                            <option value="umum">Kosakata Umum / Kerja</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label-compact">Makna / Glosarium Edukatif (Opsional)</label>
                                    <input
                                        type="text"
                                        className="form-control form-control-compact"
                                        placeholder="Penjelasan singkat arti kata..."
                                        value={singleWordForm.meaning}
                                        onChange={(e) => setSingleWordForm({ ...singleWordForm, meaning: e.target.value })}
                                    />
                                    <span className="form-text-hint">Akan tampil sebagai wawasan edukatif ASN saat kata berhasil diketik.</span>
                                </div>

                                <div className="form-check form-switch custom-switch">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="wordActiveCheck"
                                        checked={singleWordForm.is_active}
                                        onChange={(e) => setSingleWordForm({ ...singleWordForm, is_active: e.target.checked })}
                                    />
                                    <label className="form-check-label ms-2" htmlFor="wordActiveCheck">
                                        Kosakata Aktif (Dapat Muncul dalam Game)
                                    </label>
                                </div>
                            </div>
                            <div className="modal-foot">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => { setShowAddModal(false); setEditingWord(null); }}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-sm btn-teal"
                                    disabled={actionLoading}
                                >
                                    <i className={`fas ${actionLoading ? "fa-spinner fa-spin" : "fa-check"} me-1`}></i>
                                    {editingWord ? "Simpan Perubahan" : "Tambahkan Kata"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ================================================================= */}
            {/* MODAL: IMPOR MASSAL (BULK IMPORT)                                 */}
            {/* ================================================================= */}
            {showBulkModal && (
                <div className="mantatype-modal-backdrop">
                    <div className="mantatype-admin-modal large">
                        <div className="modal-head">
                            <h6><i className="fas fa-file-import text-teal me-2"></i>Impor Massal Kosakata Baru</h6>
                            <button
                                type="button"
                                className="close-btn"
                                onClick={() => setShowBulkModal(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleBulkImport}>
                            <div className="modal-body">
                                <p className="section-note mb-2">
                                    Masukkan kata-kata yang ingin ditambahkan. Pisahkan dengan tanda koma (<code>,</code>) atau baris baru (<code>Enter</code>).
                                    Spasi akan otomatis dihapus dan huruf dikonversi ke kapital.
                                </p>

                                <div className="mb-3">
                                    <textarea
                                        rows="6"
                                        className="form-control form-control-compact font-monospace"
                                        placeholder="Contoh:&#10;LEGISLASI, PARLEMEN, SENATOR&#10;ANGGARAN, PENGAWASAN, ASPIRASI"
                                        value={bulkForm.words_text}
                                        onChange={(e) => setBulkForm({ ...bulkForm, words_text: e.target.value })}
                                        required
                                        autoFocus
                                    ></textarea>
                                </div>

                                <div className="row g-2">
                                    <div className="col-md-6">
                                        <label className="form-label-compact">Tingkat Kesulitan</label>
                                        <select
                                            className="form-select form-select-compact"
                                            value={bulkForm.difficulty}
                                            onChange={(e) => setBulkForm({ ...bulkForm, difficulty: e.target.value })}
                                        >
                                            <option value="auto">🤖 Otomatis (Berdasarkan Panjang Huruf)</option>
                                            <option value="easy">Wave 1: Mudah (3-4 Huruf)</option>
                                            <option value="medium">Wave 2-3: Menengah (5-7 Huruf)</option>
                                            <option value="hard">Wave 4+: Mahir (8+ Huruf)</option>
                                        </select>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label-compact">Kategori / Tema</label>
                                        <select
                                            className="form-select form-select-compact"
                                            value={bulkForm.category}
                                            onChange={(e) => setBulkForm({ ...bulkForm, category: e.target.value })}
                                        >
                                            <option value="keparlemenan">Keparlemenan DPD RI</option>
                                            <option value="berakhlak">Core Values BerAKHLAK</option>
                                            <option value="lms">LMS & Literasi Digital</option>
                                            <option value="umum">Kosakata Umum / Kerja</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-foot">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => setShowBulkModal(false)}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-sm btn-teal"
                                    disabled={actionLoading}
                                >
                                    <i className={`fas ${actionLoading ? "fa-spinner fa-spin" : "fa-upload"} me-1`}></i>
                                    {actionLoading ? "Mengimpor..." : "Mulai Impor Kata"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

