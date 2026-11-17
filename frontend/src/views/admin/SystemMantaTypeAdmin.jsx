import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import apiInstance from "../../utils/axios";
import Toast from "../plugin/Toast";
import Swal from "sweetalert2";
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

    // Export & Import States
    const [showExportDropdown, setShowExportDropdown] = useState(false);
    const [exportScope, setExportScope] = useState("all"); // "all" | "filtered"
    const [exportLoading, setExportLoading] = useState(null); // 'xlsx' | 'csv' | 'json' | null
    const [downloadingTemplate, setDownloadingTemplate] = useState(null); // 'xlsx' | 'csv' | null
    const exportDropdownRef = useRef(null);

    // Word Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importTab, setImportTab] = useState("file"); // "file" | "text"
    const [importFile, setImportFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const fileInputRef = useRef(null);

    const [editingWord, setEditingWord] = useState(null);
    const [singleWordForm, setSingleWordForm] = useState({
        word: "",
        difficulty: "easy",
        category: "keparlemenan",
        meaning: "",
        is_active: true
    });
    const [importOptions, setImportOptions] = useState({
        words_text: "",
        update_existing: true,
        default_difficulty: "auto",
        default_category: "umum",
        default_is_active: true
    });
    const [actionLoading, setActionLoading] = useState(false);

    // Leaderboard & Seasons
    const [leaderboard, setLeaderboard] = useState([]);
    const [seasonalLeaderboard, setSeasonalLeaderboard] = useState([]);
    const [lifetimeLeaderboard, setLifetimeLeaderboard] = useState([]);
    const [adminRankedTab, setAdminRankedTab] = useState("seasonal"); // "seasonal" | "lifetime"
    const [loadingRanked, setLoadingRanked] = useState(false);
    const [resettingRanked, setResettingRanked] = useState(false);
    const [seasonInfo, setSeasonInfo] = useState(null);
    const [togglingAutoReset, setTogglingAutoReset] = useState(false);

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
                if (res.data.season_info) {
                    setSeasonInfo(res.data.season_info);
                }
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
                const seasonal = res.data.seasonal_leaderboard || res.data.leaderboard || [];
                const lifetime = res.data.lifetime_leaderboard || [];
                setSeasonalLeaderboard(seasonal);
                setLifetimeLeaderboard(lifetime);
                setLeaderboard(seasonal);
                if (res.data.season_info) {
                    setSeasonInfo(res.data.season_info);
                }
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
        const diffInfo = DIFFICULTY_MAP[wordObj.difficulty] || { label: wordObj.difficulty, short: wordObj.difficulty };
        const catInfo = CATEGORY_MAP[wordObj.category] || { label: wordObj.category, icon: "fa-tag" };

        const result = await Swal.fire({
            title: "Hapus Kosakata?",
            html: `
                <div style="text-align: left; font-size: 0.88rem; color: #334155;">
                    <p style="margin-bottom: 10px;">
                        Apakah Anda yakin ingin menghapus kata berikut dari Bank Kosakata MantaType?
                    </p>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                        <div style="font-size: 1.2rem; font-weight: 800; color: #0f172a; font-family: monospace; letter-spacing: 0.05em; margin-bottom: 6px;">
                            ${wordObj.word}
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.78rem; margin-bottom: 6px;">
                            <span style="background: #e2e8f0; color: #334155; padding: 2px 8px; border-radius: 4px; font-weight: 600;">
                                ${diffInfo.label || wordObj.difficulty}
                            </span>
                            <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: 600;">
                                ${catInfo.label || wordObj.category}
                            </span>
                        </div>
                        ${wordObj.meaning ? `<div style="font-size: 0.82rem; color: #64748b; font-style: italic;">"${wordObj.meaning}"</div>` : ""}
                    </div>
                    <p style="margin: 0; font-size: 0.8rem; color: #dc2626;">
                        <i class="fas fa-exclamation-triangle me-1"></i> Kata yang dihapus tidak akan lagi muncul dalam sesi game MantaType.
                    </p>
                </div>
            `,
            icon: "warning",
            iconColor: "#ef4444",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: '<i class="fas fa-trash-alt me-1"></i> Ya, Hapus Kata',
            cancelButtonText: "Batal",
            reverseButtons: true,
            focusCancel: true
        });

        if (result.isConfirmed) {
            try {
                const res = await apiInstance.delete(`/admin/mantatype/words/${wordObj.id}/`);
                if (res.data?.status === "success") {
                    Toast("success", `Kata '${wordObj.word}' berhasil dihapus.`);
                    setWords(prev => prev.filter(w => w.id !== wordObj.id));
                } else {
                    Toast("error", res.data?.message || "Gagal menghapus kata.");
                }
            } catch (err) {
                Toast("error", err.response?.data?.message || "Gagal menghapus kata.");
            }
        }
    };

    // Outside click listener for export dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
                setShowExportDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // =========================================================================
    // EXPORT & TEMPLATE HANDLERS
    // =========================================================================

    // Handle Export (Excel, CSV, JSON)
    const handleExport = async (format = "xlsx") => {
        try {
            setExportLoading(format);
            const params = { format };
            if (exportScope === "filtered") {
                if (searchQuery) params.search = searchQuery;
                if (diffFilter !== "all") params.difficulty = diffFilter;
                if (catFilter !== "all") params.category = catFilter;
                if (activeFilter !== "all") params.is_active = activeFilter;
            }

            const res = await apiInstance.get("/admin/mantatype/words/export/", {
                params,
                responseType: "blob"
            });

            const ext = format === "json" ? "json" : (format === "csv" ? "csv" : "xlsx");
            const mimeTypes = {
                xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                csv: "text/csv;charset=utf-8;",
                json: "application/json;charset=utf-8;"
            };

            const blob = new Blob([res.data], { type: mimeTypes[ext] || "application/octet-stream" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const nowStr = dayjs ? dayjs().format("YYYYMMDD_HHmmss") : "export";
            const scopeStr = exportScope === "filtered" ? "_Filter" : "_Semua";
            link.setAttribute("download", `Bank_Kosakata_MantaType${scopeStr}_${nowStr}.${ext}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            Toast("success", `Bank Kosakata berhasil diekspor (${ext.toUpperCase()})!`);
            setShowExportDropdown(false);
        } catch (err) {
            console.error("Export error:", err);
            Toast("error", "Gagal mengekspor Bank Kosakata.");
        } finally {
            setExportLoading(null);
        }
    };

    // Download Blank/Sample Template
    const handleDownloadTemplate = async (format = "xlsx") => {
        try {
            setDownloadingTemplate(format);
            const res = await apiInstance.get(`/admin/mantatype/words/export/?template=1&format=${format}`, {
                responseType: "blob"
            });

            const ext = format === "csv" ? "csv" : "xlsx";
            const mime = format === "csv" ? "text/csv;charset=utf-8;" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            const blob = new Blob([res.data], { type: mime });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Template_Bank_Kosakata_MantaType.${ext}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            Toast("success", `Template Bank Kosakata (${ext.toUpperCase()}) berhasil diunduh!`);
        } catch (err) {
            console.error("Template download error:", err);
            Toast("error", "Gagal mengunduh template Bank Kosakata.");
        } finally {
            setDownloadingTemplate(null);
        }
    };

    // =========================================================================
    // IMPORT HANDLERS (FILE PREVIEW & EXECUTE)
    // =========================================================================

    const handleFileChange = (file) => {
        if (!file) {
            setImportFile(null);
            setFilePreview(null);
            return;
        }
        setImportFile(file);
        setImportResult(null);

        const name = file.name.toLowerCase();
        if (name.endsWith('.csv') || name.endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
                const previewRows = lines.slice(0, 6).map(l => l.split(/[,;|]/).map(c => c.trim().replace(/^"|"$/g, '')));
                setFilePreview({
                    type: 'csv',
                    fileName: file.name,
                    fileSize: (file.size / 1024).toFixed(1) + " KB",
                    totalRows: Math.max(0, lines.length - 1),
                    previewRows
                });
            };
            reader.readAsText(file.slice(0, 15000));
        } else if (name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const list = Array.isArray(data) ? data : (data.words || []);
                    setFilePreview({
                        type: 'json',
                        fileName: file.name,
                        fileSize: (file.size / 1024).toFixed(1) + " KB",
                        totalRows: list.length,
                        previewRows: list.slice(0, 5)
                    });
                } catch (err) {
                    setFilePreview({
                        type: 'json',
                        fileName: file.name,
                        fileSize: (file.size / 1024).toFixed(1) + " KB",
                        error: 'Format JSON belum valid'
                    });
                }
            };
            reader.readAsText(file);
        } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            setFilePreview({
                type: 'xlsx',
                fileName: file.name,
                fileSize: (file.size / 1024).toFixed(1) + " KB"
            });
        }
    };

    const handleResetImportForm = () => {
        setImportFile(null);
        setFilePreview(null);
        setImportResult(null);
        setImportOptions({
            words_text: "",
            update_existing: true,
            default_difficulty: "auto",
            default_category: "umum",
            default_is_active: true
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleExecuteImport = async (e) => {
        if (e) e.preventDefault();
        try {
            setActionLoading(true);
            setImportResult(null);

            let res;
            if (importTab === "file") {
                if (!importFile) {
                    Toast("warning", "Silakan pilih atau seret file .xlsx, .csv, atau .json terlebih dahulu!");
                    setActionLoading(false);
                    return;
                }

                const formData = new FormData();
                formData.append("file", importFile);
                formData.append("update_existing", importOptions.update_existing ? "true" : "false");
                formData.append("default_difficulty", importOptions.default_difficulty);
                formData.append("default_category", importOptions.default_category);
                formData.append("default_is_active", importOptions.default_is_active ? "true" : "false");

                res = await apiInstance.post("/admin/mantatype/words/import/", formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
            } else {
                if (!importOptions.words_text.trim()) {
                    Toast("warning", "Silakan masukkan teks kata-kata yang akan diimpor!");
                    setActionLoading(false);
                    return;
                }

                const payload = {
                    words_text: importOptions.words_text,
                    update_existing: importOptions.update_existing,
                    default_difficulty: importOptions.default_difficulty,
                    default_category: importOptions.default_category,
                    default_is_active: importOptions.default_is_active
                };

                res = await apiInstance.post("/admin/mantatype/words/import/", payload);
            }

            if (res.data?.status === "success") {
                setImportResult(res.data);
                Toast("success", res.data.message || "Impor kosakata berhasil diselesaikan!");
                fetchWords();
            }
        } catch (err) {
            console.error("Import error:", err);
            const errMsg = err.response?.data?.message || "Gagal melakukan impor Bank Kosakata.";
            Toast("error", errMsg);
            setImportResult({
                status: "error",
                message: errMsg,
                errors: err.response?.data?.errors || []
            });
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
        const config = mode === "guests_only"
            ? {
                title: "Bersihkan Skor Guest?",
                text: "Semua skor dari pemain tamu (Guest / non-login) akan dihapus secara permanen.",
                confirmText: '<i class="fas fa-broom me-1"></i> Ya, Bersihkan Skor Guest'
            }
            : mode === "test_scores"
                ? {
                    title: "Bersihkan Skor Uji Coba?",
                    text: "Semua skor dengan nilai rendah (skor <= 100) akan dihapus dari leaderboard.",
                    confirmText: '<i class="fas fa-broom me-1"></i> Ya, Bersihkan Skor Tes'
                }
                : {
                    title: "Buka Musim Baru MantaType?",
                    text: "Sistem akan memajukan ke musim berikutnya. Papan Peringkat Musiman (Seasonal) akan dimulai dari awal, sementara rekor sepanjang masa (Lifetime) tetap aman tersimpan.",
                    confirmText: '<i class="fas fa-forward me-1"></i> Ya, Buka Musim Baru'
                };

        const result = await Swal.fire({
            title: config.title,
            text: config.text,
            icon: "warning",
            iconColor: "#ef4444",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b",
            confirmButtonText: config.confirmText,
            cancelButtonText: "Batal",
            reverseButtons: true,
            focusCancel: true
        });

        if (!result.isConfirmed) return;

        try {
            setResettingRanked(true);
            const res = await apiInstance.post("/admin/mantatype/reset-leaderboard/", { mode });
            if (res.data?.status === "success") {
                Toast("success", res.data.message || "Papan peringkat berhasil dibersihkan!");
                fetchLeaderboard();
                if (res.data.season_info) {
                    setSeasonInfo(res.data.season_info);
                }
            } else {
                Toast("error", res.data?.message || "Gagal mereset papan peringkat.");
            }
        } catch (err) {
            Toast("error", "Gagal mereset papan peringkat.");
        } finally {
            setResettingRanked(false);
        }
    };

    // Toggle Auto Season Reset (Per 3 Bulan)
    const handleToggleAutoSeasonReset = async () => {
        const nextState = seasonInfo ? !seasonInfo.auto_season_reset : true;
        const confirmResult = await Swal.fire({
            title: nextState ? "Aktifkan Reset Musim Otomatis?" : "Nonaktifkan Reset Musim Otomatis?",
            html: `
                <div style="text-align: left; font-size: 0.88rem; color: #334155;">
                    ${nextState ? `
                        <p style="margin-bottom: 8px;">
                            Sistem akan secara otomatis mereset dan memperbarui peringkat <strong>setiap 3 bulan (Triwulan)</strong>:
                        </p>
                        <ul style="padding-left: 20px; margin-bottom: 8px; color: #0f766e; font-weight: 600;">
                            <li>Triwulan I (Jan - Mar) &bull; Reset: 1 April 00:00 WIB</li>
                            <li>Triwulan II (Apr - Jun) &bull; Reset: 1 Juli 00:00 WIB</li>
                            <li>Triwulan III (Jul - Sep) &bull; Reset: 1 Oktober 00:00 WIB</li>
                            <li>Triwulan IV (Okt - Des) &bull; Reset: 1 Januari 00:00 WIB</li>
                        </ul>
                        <p style="margin: 0; font-size: 0.8rem; color: #64748b;">
                            Setiap triwulan baru dimulai, papan peringkat akan dibersihkan agar seluruh pegawai ASN DPD RI memiliki peluang adil meraih posisi juara musim baru.
                        </p>
                    ` : `
                        <p style="margin-bottom: 8px;">
                            Jika dinonaktifkan, papan peringkat <strong>tidak akan di-reset otomatis</strong> saat pergantian triwulan. Rekor skor akan terus terakumulasi sampai Admin melakukan reset manual.
                        </p>
                    `}
                </div>
            `,
            icon: nextState ? "question" : "warning",
            iconColor: nextState ? "#0d9488" : "#d97706",
            showCancelButton: true,
            confirmButtonColor: nextState ? "#0d9488" : "#d97706",
            cancelButtonColor: "#64748b",
            confirmButtonText: nextState ? '<i class="fas fa-check me-1"></i> Ya, Aktifkan Reset Otomatis' : '<i class="fas fa-pause me-1"></i> Ya, Nonaktifkan',
            cancelButtonText: "Batal",
            reverseButtons: true
        });

        if (!confirmResult.isConfirmed) return;

        try {
            setTogglingAutoReset(true);
            const res = await apiInstance.post("/admin/mantatype/reset-leaderboard/", {
                mode: "toggle_auto_reset",
                auto_season_reset: nextState
            });
            if (res.data?.status === "success") {
                Toast("success", res.data.message || `Reset musim otomatis per 3 bulan ${nextState ? "diaktifkan" : "dinonaktifkan"}.`);
                if (res.data.season_info) {
                    setSeasonInfo(res.data.season_info);
                }
            } else {
                Toast("error", res.data?.message || "Gagal mengubah pengaturan reset musim.");
            }
        } catch (err) {
            Toast("error", "Gagal memperbarui status reset musim otomatis.");
        } finally {
            setTogglingAutoReset(false);
        }
    };

    // Refresh Leaderboard with Toast feedback
    const handleRefreshLeaderboard = async () => {
        await fetchLeaderboard();
        Toast("info", "Papan peringkat MantaType berhasil disegarkan.");
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
                        onClick={async () => {
                            await fetchSettings();
                            if (subTab === "words") await fetchWords();
                            if (subTab === "ranked") await fetchLeaderboard();
                            Toast("info", "Data sistem MantaType berhasil diperbarui.");
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
                            {/* Export Dropdown Group */}
                            <div className="export-dropdown-wrapper" ref={exportDropdownRef}>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-teal d-flex align-items-center gap-1"
                                    onClick={() => setShowExportDropdown(prev => !prev)}
                                    disabled={exportLoading !== null}
                                    title="Ekspor Bank Kosakata ke Excel, CSV, atau JSON"
                                >
                                    <i className={`fas ${exportLoading ? "fa-spinner fa-spin" : "fa-file-export"} me-1`}></i>
                                    <span>{exportLoading ? "Mengekspor..." : "Ekspor Kosakata"}</span>
                                    <i className="fas fa-chevron-down ms-1" style={{ fontSize: "0.68rem" }}></i>
                                </button>

                                {showExportDropdown && (
                                    <div className="export-floating-menu">
                                        <div className="export-menu-header">
                                            <span className="export-menu-title">Cakupan Data:</span>
                                            <div className="export-scope-toggle">
                                                <button
                                                    type="button"
                                                    className={`scope-pill-btn ${exportScope === "all" ? "active" : ""}`}
                                                    onClick={() => setExportScope("all")}
                                                >
                                                    Semua ({wordCounts.total || words.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`scope-pill-btn ${exportScope === "filtered" ? "active" : ""}`}
                                                    onClick={() => setExportScope("filtered")}
                                                    title="Ekspor hanya data yang tampil sesuai filter aktif"
                                                >
                                                    Filter ({words.length})
                                                </button>
                                            </div>
                                        </div>

                                        <div className="export-menu-divider"></div>

                                        <button
                                            type="button"
                                            className="export-menu-item"
                                            onClick={() => handleExport("xlsx")}
                                            disabled={exportLoading !== null}
                                        >
                                            <div className="export-item-icon excel">
                                                <i className="fas fa-file-excel"></i>
                                            </div>
                                            <div className="export-item-text">
                                                <span className="export-item-label">Ekspor Microsoft Excel (.xlsx)</span>
                                                <span className="export-item-desc">Tabel rapi siap baca & edit dengan formatting</span>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            className="export-menu-item"
                                            onClick={() => handleExport("csv")}
                                            disabled={exportLoading !== null}
                                        >
                                            <div className="export-item-icon csv">
                                                <i className="fas fa-file-csv"></i>
                                            </div>
                                            <div className="export-item-text">
                                                <span className="export-item-label">Ekspor CSV Standar (.csv)</span>
                                                <span className="export-item-desc">Format teks UTF-8 kompatibel Google Sheets & Excel</span>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            className="export-menu-item"
                                            onClick={() => handleExport("json")}
                                            disabled={exportLoading !== null}
                                        >
                                            <div className="export-item-icon json">
                                                <i className="fas fa-code"></i>
                                            </div>
                                            <div className="export-item-text">
                                                <span className="export-item-label">Ekspor JSON (.json)</span>
                                                <span className="export-item-desc">Cadangan data struktur penuh (Backup database)</span>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Import Button */}
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-teal d-flex align-items-center gap-1"
                                onClick={() => {
                                    handleResetImportForm();
                                    setShowImportModal(true);
                                }}
                                title="Impor Bank Kosakata dari file Excel (.xlsx), CSV, JSON, atau Teks"
                            >
                                <i className="fas fa-file-import me-1"></i>
                                <span>Impor Kosakata</span>
                            </button>

                            {/* Add Single Word Button */}
                            <button
                                type="button"
                                className="btn btn-sm btn-teal d-flex align-items-center gap-1"
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
                                title="Tambah kosakata tunggal baru"
                            >
                                <i className="fas fa-plus me-1"></i>
                                <span>Tambah Kata</span>
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
                    {/* Season Cycle & Auto-Reset Dashboard Card */}
                    <div className="season-dashboard-card mb-3">
                        <div className="season-card-top">
                            <div className="season-title-group">
                                <div className="season-badge-pill">
                                    <i className="fas fa-crown text-warning me-1"></i>
                                    <span>Siklus Musim 3 Bulan (Triwulan)</span>
                                </div>
                                <h5 className="season-heading mb-1">
                                    {seasonInfo?.season_name || "Musim Triwulan Aktif"}
                                    {seasonInfo?.season_number && (
                                        <span className="badge bg-teal ms-2 fs-6">Edisi #{seasonInfo.season_number}</span>
                                    )}
                                </h5>
                                <div className="season-sub-period text-muted small">
                                    <i className="far fa-calendar-check me-1 text-teal"></i>
                                    Periode Kompetisi: <strong>{seasonInfo?.period_label || "-"}</strong>
                                    {seasonInfo?.last_reset_formatted && (
                                        <span className="ms-2 d-none d-md-inline text-secondary">
                                            &bull; Terakhir reset: {seasonInfo.last_reset_formatted}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="season-countdown-box">
                                <div className="countdown-label text-muted small fw-semibold">
                                    <i className="fas fa-hourglass-half me-1 text-warning"></i>
                                    Sisa Waktu Musim Ini:
                                </div>
                                <div className="countdown-value my-1">
                                    <span className="countdown-days text-teal fw-bold fs-3">
                                        {seasonInfo?.days_left ?? 0}
                                    </span>
                                    <span className="countdown-unit ms-1 fw-bold text-dark">Hari</span>
                                    <span className="countdown-hours text-muted small ms-1">
                                        ({seasonInfo?.hours_left ?? 0} Jam)
                                    </span>
                                </div>
                                <div className="countdown-target text-muted small">
                                    Jadwal reset otomatis: <strong>{seasonInfo?.next_reset_formatted || "-"}</strong>
                                </div>
                            </div>
                        </div>

                        <div className="season-card-bottom">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                                <div className="season-auto-switch">
                                    <div className="form-check form-switch custom-switch mb-0">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="autoSeasonResetSwitch"
                                            checked={seasonInfo ? seasonInfo.auto_season_reset : true}
                                            onChange={handleToggleAutoSeasonReset}
                                            disabled={togglingAutoReset}
                                        />
                                        <label className="form-check-label ms-2" htmlFor="autoSeasonResetSwitch">
                                            <strong className="text-dark">Sistem Reset Musim Otomatis Per 3 Bulan:</strong>{" "}
                                            <span className={`badge ${seasonInfo?.auto_season_reset ? "bg-success-subtle text-success border border-success-subtle" : "bg-secondary-subtle text-secondary border border-secondary-subtle"}`}>
                                                {seasonInfo?.auto_season_reset ? "AKTIF (Otomatis per Triwulan)" : "NONAKTIF (Manual)"}
                                            </span>
                                        </label>
                                    </div>
                                    <div className="season-desc text-muted small mt-1">
                                        <i className="fas fa-info-circle text-teal me-1"></i>
                                        Papan peringkat musiman (Seasonal) otomatis berganti setiap pergantian kuartal (1 Jan, 1 Apr, 1 Jul, 1 Okt). Seluruh rekor masa lalu tetap aman di Papan Peringkat Abadi (Lifetime).
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ranked-action-bar mb-3">
                        <div className="ranked-bar-title">
                            <i className="fas fa-trophy text-warning me-2"></i>
                            <h6 className="mb-0">Papan Peringkat MantaType</h6>
                        </div>

                        <div className="d-flex align-items-center flex-wrap gap-2 ms-auto">
                            {/* Switch 2 Jenis Ranked: Seasonal vs Lifetime (Stick Kanan) */}
                            <div className="btn-group btn-group-sm me-1" role="group">
                                <button
                                    type="button"
                                    className={`btn ${adminRankedTab === "seasonal" ? "btn-teal text-white fw-bold shadow-sm" : "btn-outline-secondary"}`}
                                    onClick={() => setAdminRankedTab("seasonal")}
                                >
                                    <i className="fas fa-calendar-alt me-1"></i>
                                    Musiman (Season) ({seasonalLeaderboard.length})
                                </button>
                                <button
                                    type="button"
                                    className={`btn ${adminRankedTab === "lifetime" ? "btn-warning text-dark fw-bold shadow-sm" : "btn-outline-secondary"}`}
                                    onClick={() => setAdminRankedTab("lifetime")}
                                >
                                    <i className="fas fa-crown me-1"></i>
                                    Sepanjang Masa (Lifetime) ({lifetimeLeaderboard.length})
                                </button>
                            </div>

                            {/* Tombol Aksi Leaderboard (Stick Kanan) */}
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-teal"
                                onClick={handleRefreshLeaderboard}
                                disabled={loadingRanked}
                                title="Segarkan Data Leaderboard"
                            >
                                <i className={`fas fa-sync-alt ${loadingRanked ? "fa-spin" : ""} me-1`}></i>
                                Segarkan
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-warning"
                                onClick={() => handleResetLeaderboard("guests_only")}
                                disabled={resettingRanked}
                                title="Bersihkan skor pemain tamu (Guest / non-login)"
                            >
                                <i className="fas fa-user-slash me-1"></i>
                                Bersihkan Tamu
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => handleResetLeaderboard("test_scores")}
                                disabled={resettingRanked}
                                title="Bersihkan skor uji coba / skor rendah (<= 100)"
                            >
                                <i className="fas fa-broom me-1"></i>
                                Bersihkan Skor Tes
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleResetLeaderboard("all")}
                                disabled={resettingRanked}
                                title="Buka musim baru: peringkat musiman di-reset, rekor lifetime tetap utuh abadi"
                            >
                                <i className="fas fa-forward me-1"></i>
                                Buka Musim Baru (Manual)
                            </button>
                        </div>
                    </div>

                    {/* Banner Info Kategori Ranked yang Sedang Ditampilkan */}
                    {adminRankedTab === "seasonal" ? (
                        <div className="alert alert-info py-2 px-3 d-flex align-items-center justify-content-between mb-3 small">
                            <div>
                                <i className="fas fa-info-circle me-2 text-info"></i>
                                <span>Menampilkan rekor kompetisi musim berjalan: <strong>{seasonInfo?.season_name || "Musim Triwulan Aktif"}</strong>. Peringkat ini di-reset setiap siklus 3 bulan.</span>
                            </div>
                            <span className="badge bg-teal">{seasonInfo?.quarter_label || "Triwulan Aktif"}</span>
                        </div>
                    ) : (
                        <div className="alert alert-warning py-2 px-3 d-flex align-items-center justify-content-between mb-3 small">
                            <div>
                                <i className="fas fa-crown me-2 text-warning"></i>
                                <span>Menampilkan <strong>Hall of Fame Abadi (Lifetime Ranked)</strong>. Rekor skor terbaik sepanjang masa dari seluruh musim dan <strong>tidak pernah di-reset</strong>.</span>
                            </div>
                            <span className="badge bg-warning text-dark fw-bold">Hall of Fame Abadi</span>
                        </div>
                    )}

                    <div className="ranked-table-wrapper">
                        {loadingRanked ? (
                            <div className="loading-state-box">
                                <i className="fas fa-circle-notch fa-spin text-teal fa-2x mb-2"></i>
                                <span>Memuat Peringkat...</span>
                            </div>
                        ) : (adminRankedTab === "seasonal" ? seasonalLeaderboard : lifetimeLeaderboard).length === 0 ? (
                            <div className="empty-state-box">
                                <i className="fas fa-medal text-muted fa-3x mb-2"></i>
                                <h6>{adminRankedTab === "seasonal" ? "Belum Ada Rekor di Musim Ini" : "Belum Ada Rekor Abadi Tersimpan"}</h6>
                                <p className="text-muted">
                                    {adminRankedTab === "seasonal" 
                                        ? "Jadilah yang pertama mencatatkan rekor di musim triwulan aktif ini!" 
                                        : "Semua rekor pemain di MantaType Arcade akan tercatat di Hall of Fame abadi."}
                                </p>
                            </div>
                        ) : (
                            <table className="table table-hover table-compact-manta align-middle">
                                <thead>
                                    <tr>
                                        <th style={{ width: "70px" }}>Rank</th>
                                        <th>Nama Pemain</th>
                                        <th>Tipe Akun</th>
                                        {adminRankedTab === "lifetime" && <th>Musim Asal</th>}
                                        <th className="text-end">Skor</th>
                                        <th className="text-end">Kata Diketik</th>
                                        <th className="text-end">Akurasi</th>
                                        <th className="text-end">WPM</th>
                                        <th className="text-center">Wave Capaian</th>
                                        <th className="text-end">Tanggal Rekor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(adminRankedTab === "seasonal" ? seasonalLeaderboard : lifetimeLeaderboard).map((item, idx) => (
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
                                            {adminRankedTab === "lifetime" && (
                                                <td>
                                                    <span className="badge bg-light text-dark border">
                                                        <i className="far fa-calendar-alt me-1 text-primary"></i>
                                                        {item.season_label || `Musim #${item.season_number || 1}`}
                                                    </span>
                                                </td>
                                            )}
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
                <div 
                    className="mantatype-modal-backdrop"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowAddModal(false);
                            setEditingWord(null);
                        }
                    }}
                >
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
            {/* MODAL: IMPOR BANK KOSAKATA (EXCEL / CSV / JSON / TEXT)            */}
            {/* ================================================================= */}
            {showImportModal && (
                <div 
                    className="mantatype-modal-backdrop"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowImportModal(false);
                            handleResetImportForm();
                        }
                    }}
                >
                    <div className="mantatype-admin-modal large">
                        <div className="modal-head">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fas fa-file-import text-teal fs-5"></i>
                                <div>
                                    <h6 className="mb-0">Impor Bank Kosakata MantaType</h6>
                                    <small className="text-muted">Tambahkan kosakata baru atau perbarui glosarium via Excel, CSV, JSON, atau teks</small>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="close-btn"
                                onClick={() => {
                                    setShowImportModal(false);
                                    handleResetImportForm();
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        {/* Subtabs Input Method */}
                        <div className="modal-subtabs-nav">
                            <button
                                type="button"
                                className={`modal-subtab-btn ${importTab === "file" ? "active" : ""}`}
                                onClick={() => setImportTab("file")}
                            >
                                <i className="fas fa-file-excel me-2"></i>
                                Unggah File Spreadsheet (.xlsx, .csv, .json)
                            </button>
                            <button
                                type="button"
                                className={`modal-subtab-btn ${importTab === "text" ? "active" : ""}`}
                                onClick={() => setImportTab("text")}
                            >
                                <i className="fas fa-keyboard me-2"></i>
                                Salin & Tempel Teks (Quick Input)
                            </button>
                        </div>

                        <form onSubmit={handleExecuteImport}>
                            <div className="modal-body">
                                {/* Result Feedback Banner */}
                                {importResult && (
                                    <div className={`import-result-alert ${importResult.status === "error" ? "error" : "success"} mb-3`}>
                                        <div className="d-flex align-items-start gap-2">
                                            <i className={`fas ${importResult.status === "error" ? "fa-exclamation-triangle text-danger" : "fa-check-circle text-emerald"} fs-5 mt-1`}></i>
                                            <div className="flex-grow-1">
                                                <div className="fw-bold">{importResult.message}</div>
                                                {importResult.status !== "error" && (
                                                    <div className="d-flex flex-wrap gap-2 mt-2">
                                                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                                                            <i className="fas fa-plus me-1"></i> +{importResult.created_count || 0} Kata Baru
                                                        </span>
                                                        <span className="badge bg-info-subtle text-info border border-info-subtle">
                                                            <i className="fas fa-sync-alt me-1"></i> {importResult.updated_count || 0} Diperbarui
                                                        </span>
                                                        <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">
                                                            <i className="fas fa-forward me-1"></i> {importResult.skipped_count || 0} Dilewati
                                                        </span>
                                                        <span className="badge bg-dark text-white">
                                                            Total Bank Kata: {importResult.total_words_now || 0}
                                                        </span>
                                                    </div>
                                                )}

                                                {importResult.errors && importResult.errors.length > 0 && (
                                                    <div className="mt-2 text-danger small">
                                                        <div className="fw-semibold">Catatan baris yang dilewati:</div>
                                                        <ul className="mb-0 ps-3">
                                                            {importResult.errors.map((err, i) => (
                                                                <li key={i}>{err}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 1: UNGGAH FILE */}
                                {importTab === "file" && (
                                    <div className="import-file-section">
                                        {/* Download Template Banner */}
                                        <div className="template-download-card mb-3">
                                            <div className="template-card-left">
                                                <i className="fas fa-info-circle text-teal me-2"></i>
                                                <div>
                                                    <strong>Belum punya format tabel?</strong>
                                                    <div className="text-muted small">Unduh template resmi dengan header dan contoh kolom yang sudah disesuaikan:</div>
                                                </div>
                                            </div>
                                            <div className="template-card-actions">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-success"
                                                    onClick={() => handleDownloadTemplate("xlsx")}
                                                    disabled={downloadingTemplate !== null}
                                                    title="Unduh Template Microsoft Excel (.xlsx)"
                                                >
                                                    <i className={`fas ${downloadingTemplate === "xlsx" ? "fa-spinner fa-spin" : "fa-file-excel"} me-1`}></i>
                                                    <span>Template Excel (.xlsx)</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary"
                                                    onClick={() => handleDownloadTemplate("csv")}
                                                    disabled={downloadingTemplate !== null}
                                                    title="Unduh Template CSV (.csv)"
                                                >
                                                    <i className={`fas ${downloadingTemplate === "csv" ? "fa-spinner fa-spin" : "fa-file-csv"} me-1`}></i>
                                                    <span>Template CSV</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Dropzone */}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            style={{ display: "none" }}
                                            accept=".xlsx,.xls,.csv,.json,.txt"
                                            onChange={(e) => handleFileChange(e.target.files?.[0])}
                                        />

                                        {!importFile ? (
                                            <div
                                                className={`import-dropzone ${isDragging ? "dragging" : ""}`}
                                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setIsDragging(false);
                                                    if (e.dataTransfer.files?.[0]) {
                                                        handleFileChange(e.dataTransfer.files[0]);
                                                    }
                                                }}
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <div className="dropzone-icon">
                                                    <i className="fas fa-cloud-upload-alt fa-3x text-teal"></i>
                                                </div>
                                                <div className="dropzone-text">
                                                    <strong>Pilih file atau seret file ke sini</strong>
                                                    <p className="text-muted small mb-0">Mendukung format Microsoft Excel (<code>.xlsx</code>), CSV (<code>.csv</code>), JSON (<code>.json</code>), atau Teks (<code>.txt</code>)</p>
                                                </div>
                                                <button type="button" className="btn btn-sm btn-teal mt-2">
                                                    <i className="fas fa-folder-open me-1"></i> Jelajahi File
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="selected-file-box mb-3">
                                                <div className="file-info-left">
                                                    <div className="file-icon-badge">
                                                        <i className={`fas ${importFile.name.endsWith(".xlsx") || importFile.name.endsWith(".xls") ? "fa-file-excel text-success" : (importFile.name.endsWith(".json") ? "fa-file-code text-warning" : "fa-file-csv text-primary")} fa-2x`}></i>
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold file-name-display">{importFile.name}</div>
                                                        <div className="text-muted small">
                                                            Ukuran: {(importFile.size / 1024).toFixed(1)} KB
                                                            {filePreview?.totalRows !== undefined && ` • ${filePreview.totalRows} baris kata terdeteksi`}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="file-info-right">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary me-2"
                                                        onClick={() => fileInputRef.current?.click()}
                                                    >
                                                        Ganti File
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => {
                                                            setImportFile(null);
                                                            setFilePreview(null);
                                                            if (fileInputRef.current) fileInputRef.current.value = "";
                                                        }}
                                                    >
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* File Preview */}
                                        {filePreview && filePreview.previewRows && filePreview.previewRows.length > 0 && (
                                            <div className="file-preview-card mt-3">
                                                <div className="preview-head">
                                                    <span className="small fw-semibold text-muted">
                                                        <i className="fas fa-eye me-1 text-teal"></i>
                                                        Pratinjau 5 Baris Pertama Data File:
                                                    </span>
                                                </div>
                                                <div className="preview-table-wrapper">
                                                    <table className="table table-sm table-bordered preview-table mb-0">
                                                        <tbody>
                                                            {filePreview.previewRows.map((r, rIdx) => (
                                                                <tr key={rIdx} className={rIdx === 0 ? "table-light fw-bold" : ""}>
                                                                    <td className="text-muted small text-center" style={{ width: "35px" }}>
                                                                        {rIdx === 0 ? "#" : rIdx}
                                                                    </td>
                                                                    {Array.isArray(r) ? (
                                                                        r.map((col, cIdx) => (
                                                                            <td key={cIdx} className="small text-truncate" style={{ maxWidth: "220px" }}>
                                                                                {String(col || "-")}
                                                                            </td>
                                                                        ))
                                                                    ) : (
                                                                        <td className="small">
                                                                            <strong>{r.word}</strong> ({r.difficulty || "auto"}) - {r.meaning || "-"}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 2: TEMPEL TEKS */}
                                {importTab === "text" && (
                                    <div className="import-text-section">
                                        <p className="section-note mb-2">
                                            Tempel daftar kata yang ingin diimpor. Anda dapat menempel:
                                            <br />
                                            1. <strong>Format Multi-Kolom:</strong> <code>KATA, KESULITAN, KATEGORI, ARTI</code> (misal: <code>SENATOR, medium, keparlemenan, Anggota DPD RI</code>)
                                            <br />
                                            2. <strong>Format Kata Tunggal:</strong> Pisahkan kata dengan baris baru (<code>Enter</code>) atau koma (<code>,</code>).
                                        </p>

                                        <div className="mb-3">
                                            <textarea
                                                rows="7"
                                                className="form-control form-control-compact font-monospace"
                                                placeholder={"Contoh:\nLEGISLASI, medium, keparlemenan, Fungsi perancangan UU oleh parlemen\nBERAKHLAK, hard, berakhlak, Core Values ASN BerAKHLAK\nPARLEMEN, KOMITE, PLENO, INTEGRITAS"}
                                                value={importOptions.words_text}
                                                onChange={(e) => setImportOptions({ ...importOptions, words_text: e.target.value })}
                                                autoFocus
                                            ></textarea>
                                        </div>
                                    </div>
                                )}

                                {/* COMMON CONFIGURATION OPTIONS */}
                                <div className="import-options-card mt-3">
                                    <h6 className="options-card-title">
                                        <i className="fas fa-cog text-teal me-2"></i>
                                        Opsi Pengaturan Impor
                                    </h6>

                                    <div className="form-check form-switch custom-switch mb-3">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="updateExistingCheck"
                                            checked={importOptions.update_existing}
                                            onChange={(e) => setImportOptions({ ...importOptions, update_existing: e.target.checked })}
                                        />
                                        <label className="form-check-label ms-2" htmlFor="updateExistingCheck">
                                            <strong>Perbarui data jika kata sudah terdaftar</strong>
                                            <span className="d-block text-muted small">
                                                Jika dicentang, kata yang sudah ada di database akan diperbarui arti glosarium, tingkat kesulitan, dan kategorinya. Jika tidak, kata yang sudah ada akan dilewati.
                                            </span>
                                        </label>
                                    </div>

                                    <div className="row g-2">
                                        <div className="col-md-6">
                                            <label className="form-label-compact">Default Tingkat Kesulitan</label>
                                            <select
                                                className="form-select form-select-compact"
                                                value={importOptions.default_difficulty}
                                                onChange={(e) => setImportOptions({ ...importOptions, default_difficulty: e.target.value })}
                                            >
                                                <option value="auto">🤖 Otomatis (Berdasarkan Panjang Huruf Kata)</option>
                                                <option value="easy">Wave 1: Mudah (3-4 Huruf)</option>
                                                <option value="medium">Wave 2-3: Menengah (5-7 Huruf)</option>
                                                <option value="hard">Wave 4+: Mahir (8+ Huruf)</option>
                                            </select>
                                            <span className="form-text-hint">Digunakan jika kolom tingkat kesulitan tidak diisi di baris file.</span>
                                        </div>

                                        <div className="col-md-6">
                                            <label className="form-label-compact">Default Kategori / Tema</label>
                                            <select
                                                className="form-select form-select-compact"
                                                value={importOptions.default_category}
                                                onChange={(e) => setImportOptions({ ...importOptions, default_category: e.target.value })}
                                            >
                                                <option value="umum">Kosakata Umum / Kerja (Default)</option>
                                                <option value="keparlemenan">Keparlemenan DPD RI</option>
                                                <option value="berakhlak">Core Values BerAKHLAK</option>
                                                <option value="lms">LMS & Literasi Digital</option>
                                            </select>
                                            <span className="form-text-hint">Digunakan jika kolom kategori tidak terisi di baris file.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-foot">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => {
                                        setShowImportModal(false);
                                        handleResetImportForm();
                                    }}
                                >
                                    {importResult ? "Tutup" : "Batal"}
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-sm btn-teal"
                                    disabled={actionLoading || (importTab === "file" && !importFile) || (importTab === "text" && !importOptions.words_text.trim())}
                                >
                                    <i className={`fas ${actionLoading ? "fa-spinner fa-spin" : "fa-upload"} me-1`}></i>
                                    {actionLoading ? "Memproses Impor..." : "Mulai Impor Kosakata"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

