import React, { useState, useEffect, useMemo, useCallback } from "react";
import Swal from "sweetalert2";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";

/**
 * Enterprise-Grade Instructor Requests Tab
 * Setjen DPD RI Learning Platform
 *
 * Features:
 * - Multi-Select Checkboxes (Grid & Table View)
 * - Floating Bulk Action Bar (Bulk Approve, Bulk Reject with Reason, Bulk Export to CSV, Deselect All)
 * - Active Filter Pills Bar with Individual Clear & Reset All
 * - Excel-Compatible CSV Export with UTF-8 BOM (\uFEFF)
 * - Slide-over Quick Preview Drawer (Complete Profile, Expertise, Bio, Timeline & Quick Actions)
 * - Real-time KPI Sync & Keyboard Shortcuts (Escape to Close)
 */
function InstructorRequestsTab({ onCountsUpdated }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("PENDING"); // 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
    const [searchTerm, setSearchTerm] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'

    // Multi-select & Bulk Moderation
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkProcessing, setBulkProcessing] = useState(false);

    // Slide-over Quick Preview Drawer
    const [previewRequest, setPreviewRequest] = useState(null);

    const [liveStats, setLiveStats] = useState({
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0
    });

    // Close preview drawer on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                setPreviewRequest(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Clear selections when tab or filters change
    useEffect(() => {
        setSelectedIds([]);
    }, [filterStatus, searchTerm, levelFilter]);

    // Fetch requests from API
    const fetchInstructorRequests = useCallback(async () => {
        try {
            setLoading(true);
            const statusParam = filterStatus === "ALL" ? "ALL" : filterStatus;
            const response = await apiInstance.get(
                `/admin/instructor-requests/?status=${statusParam}`
            );

            let data = [];
            if (Array.isArray(response.data)) {
                data = response.data;
            } else if (response.data?.results) {
                data = response.data.results;
            }

            setRequests(data);

            if (response.data?.stats) {
                setLiveStats(response.data.stats);
            } else {
                setLiveStats((prev) => ({
                    ...prev,
                    [filterStatus.toLowerCase()]: data.length,
                    total: Math.max(prev.total, data.length)
                }));
            }
        } catch (error) {
            console.error("Error fetching instructor requests:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat permintaan",
                text: error.response?.data?.detail || "Terjadi kesalahan saat memuat data"
            });
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    // Fetch comprehensive stats across all statuses once on mount
    const fetchComprehensiveStats = useCallback(async () => {
        try {
            const res = await apiInstance.get("/admin/instructor-requests/?status=ALL");
            let allData = [];
            if (Array.isArray(res.data)) {
                allData = res.data;
            } else if (res.data?.results) {
                allData = res.data.results;
            }

            if (res.data?.stats) {
                setLiveStats(res.data.stats);
            } else {
                setLiveStats({
                    pending: allData.filter((r) => r.status === "PENDING").length,
                    approved: allData.filter((r) => r.status === "APPROVED").length,
                    rejected: allData.filter((r) => r.status === "REJECTED").length,
                    total: allData.length
                });
            }
        } catch (e) {
            console.error("Error fetching stats:", e);
        }
    }, []);

    useEffect(() => {
        fetchInstructorRequests();
    }, [fetchInstructorRequests]);

    useEffect(() => {
        fetchComprehensiveStats();
    }, [fetchComprehensiveStats]);

    const getExperienceLevelLabel = (level) => {
        const map = {
            BEGINNER: "Pemula (0-2 thn)",
            INTERMEDIATE: "Menengah (2-5 thn)",
            ADVANCED: "Lanjutan (5+ thn)"
        };
        return map[level] || level || "Tidak Disebutkan";
    };

    // Client-side search and level filter
    const filteredRequests = useMemo(() => {
        return requests.filter((req) => {
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const name = (req.user_name || "").toLowerCase();
                const email = (req.user_email || "").toLowerCase();
                const nip = (req.user_nip || "").toLowerCase();
                const exp = (req.expertise_areas || "").toLowerCase();
                if (!name.includes(q) && !email.includes(q) && !nip.includes(q) && !exp.includes(q)) {
                    return false;
                }
            }
            if (levelFilter !== "all") {
                if ((req.experience_level || "").toUpperCase() !== levelFilter.toUpperCase()) {
                    return false;
                }
            }
            return true;
        });
    }, [requests, searchTerm, levelFilter]);

    // Multi-select helpers
    const isAllSelected = useMemo(() => {
        return filteredRequests.length > 0 && filteredRequests.every((r) => selectedIds.includes(r.id));
    }, [filteredRequests, selectedIds]);

    const isSomeSelected = useMemo(() => {
        return selectedIds.length > 0 && !isAllSelected;
    }, [selectedIds, isAllSelected]);

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredRequests.map((r) => r.id));
        }
    };

    const handleToggleSelectOne = (id) => {
        if (!id) return;
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const selectedRequests = useMemo(() => {
        return requests.filter((r) => selectedIds.includes(r.id));
    }, [requests, selectedIds]);

    const pendingInSelected = useMemo(() => {
        return selectedRequests.filter((r) => r.status === "PENDING");
    }, [selectedRequests]);

    // Active secondary filters tracking (pencarian & tingkat pengalaman)
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (searchTerm.trim()) count++;
        if (levelFilter !== "all") count++;
        return count;
    }, [searchTerm, levelFilter]);

    const hasActiveFilters = useMemo(() => {
        return activeFilterCount > 0;
    }, [activeFilterCount]);

    const handleResetAllFilters = () => {
        setSearchTerm("");
        setLevelFilter("all");
    };

    // Handle single approve
    const handleApproveRequest = async (request) => {
        const result = await Swal.fire({
            title: `Setujui Permintaan Instruktur?`,
            html: `
                <div class="text-start p-2" style="font-size: 0.9rem;">
                    <div class="mb-2"><strong>Nama:</strong> ${request.user_name || "-"}</div>
                    <div class="mb-2"><strong>Email:</strong> ${request.user_email || "-"}</div>
                    <div class="mb-2"><strong>Keahlian:</strong> ${request.expertise_areas || "-"}</div>
                    <div class="mb-2"><strong>Pengalaman:</strong> ${getExperienceLevelLabel(request.experience_level)}</div>
                    <div class="alert alert-info py-2 px-3 small mt-3 mb-0">
                        <i class="fas fa-info-circle me-1"></i> Pengguna akan langsung diberikan hak akses membuat dan mengelola kursus di portal LMS DPD RI.
                    </div>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0f766e",
            cancelButtonColor: "#64748b",
            confirmButtonText: '<i class="fas fa-check me-1"></i> Ya, Setujui',
            cancelButtonText: "Batal"
        });

        if (result.isConfirmed) {
            try {
                await apiInstance.post(`/admin/instructor-request/${request.id}/approve/`);
                Toast().fire({
                    icon: "success",
                    title: "Permintaan Disetujui",
                    text: `"${request.user_name}" kini telah menjadi instruktur aktif.`
                });
                fetchInstructorRequests();
                fetchComprehensiveStats();
                if (typeof onCountsUpdated === "function") {
                    onCountsUpdated();
                }
            } catch (error) {
                Toast().fire({
                    icon: "error",
                    title: "Gagal menyetujui permintaan",
                    text: error.response?.data?.detail || "Terjadi kesalahan"
                });
            }
        }
    };

    // Handle single reject
    const handleRejectRequest = async (request) => {
        const { value: reason } = await Swal.fire({
            title: `Tolak Permintaan Instruktur?`,
            input: "textarea",
            inputLabel: "Alasan Penolakan (Minimal 10 Karakter)",
            inputPlaceholder: "Tuliskan alasan spesifik dan saran perbaikan kompetensi/dokumen...",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
            confirmButtonText: '<i class="fas fa-times me-1"></i> Tolak Permintaan',
            cancelButtonText: "Batal",
            inputValidator: (value) => {
                if (!value || value.trim().length < 10) {
                    return "Alasan penolakan minimal 10 karakter!";
                }
            }
        });

        if (reason) {
            try {
                await apiInstance.post(`/admin/instructor-request/${request.id}/reject/`, {
                    rejection_reason: reason.trim()
                });
                Toast().fire({
                    icon: "success",
                    title: "Permintaan Ditolak",
                    text: `Pemberitahuan penolakan tersimpan di sistem.`
                });
                fetchInstructorRequests();
                fetchComprehensiveStats();
                if (typeof onCountsUpdated === "function") {
                    onCountsUpdated();
                }
            } catch (error) {
                Toast().fire({
                    icon: "error",
                    title: "Gagal menolak permintaan",
                    text: error.response?.data?.detail || "Terjadi kesalahan"
                });
            }
        }
    };

    // Bulk Approve
    const handleBulkApprove = async () => {
        if (pendingInSelected.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Tidak ada permohonan pending",
                text: "Pilih permohonan berstatus tertunda untuk disetujui."
            });
            return;
        }

        const result = await Swal.fire({
            title: `Setujui ${pendingInSelected.length} Permintaan Instruktur Sekaligus?`,
            html: `
                <div class="text-start p-2" style="font-size: 0.88rem;">
                    <p class="mb-2">Anda akan menyetujui <b>${pendingInSelected.length} permohonan instruktur</b> terpilih:</p>
                    <div class="p-2 border rounded bg-light mb-3" style="max-height: 140px; overflow-y: auto;">
                        <ul class="mb-0 ps-3 small text-muted">
                            ${pendingInSelected
                                .map(
                                    (r) =>
                                        `<li><strong class="text-dark">${r.user_name || "-"}</strong> (${r.user_email || "-"}) - <em>${r.expertise_areas || "-"}</em></li>`
                                )
                                .join("")}
                        </ul>
                    </div>
                    <div class="alert alert-info py-2 px-3 small mb-0">
                        <i class="fas fa-info-circle me-1"></i> Seluruh aparatur yang disetujui akan langsung menerima hak akses Instruktur untuk membuat dan mengelola materi kursus di LMS DPD RI.
                    </div>
                </div>
            `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0d9488",
            cancelButtonColor: "#64748b",
            confirmButtonText: `<i class="fas fa-check-circle me-1"></i> Ya, Setujui Semua (${pendingInSelected.length})`,
            cancelButtonText: "Batal",
            reverseButtons: true
        });

        if (!result.isConfirmed) return;

        setBulkProcessing(true);
        let successCount = 0;
        let failCount = 0;

        for (const req of pendingInSelected) {
            try {
                await apiInstance.post(`/admin/instructor-request/${req.id}/approve/`);
                successCount++;
            } catch (err) {
                console.error(`Error approving instructor request ${req.id}:`, err);
                failCount++;
            }
        }

        setBulkProcessing(false);
        setSelectedIds([]);

        Toast().fire({
            icon: successCount > 0 ? "success" : "error",
            title: "Persetujuan Massal Selesai",
            text: `${successCount} permohonan berhasil disetujui.${failCount > 0 ? ` (${failCount} gagal)` : ""}`
        });

        fetchInstructorRequests();
        fetchComprehensiveStats();
        if (typeof onCountsUpdated === "function") {
            onCountsUpdated();
        }
    };

    // Bulk Reject
    const handleBulkReject = async () => {
        if (pendingInSelected.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Tidak ada permohonan pending",
                text: "Pilih permohonan berstatus tertunda untuk ditolak."
            });
            return;
        }

        const { value: reason } = await Swal.fire({
            title: `Tolak ${pendingInSelected.length} Permintaan Sekaligus?`,
            html: `
                <div class="text-start mb-2" style="font-size: 0.86rem;">
                    <p class="mb-2">Tuliskan alasan penolakan untuk <b>${pendingInSelected.length} pemohon instruktur</b> terpilih:</p>
                </div>
            `,
            input: "textarea",
            inputPlaceholder: "Tuliskan alasan spesifik dan saran perbaikan kompetensi/dokumen (minimal 10 karakter)...",
            inputAttributes: {
                style: "min-height: 85px; font-size: 0.85rem;"
            },
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
            confirmButtonText: `<i class="fas fa-times me-1"></i> Ya, Tolak Semua (${pendingInSelected.length})`,
            cancelButtonText: "Batal",
            reverseButtons: true,
            inputValidator: (val) => {
                if (!val || val.trim().length < 10) {
                    return "Alasan penolakan minimal 10 karakter!";
                }
            }
        });

        if (!reason || !reason.trim()) return;

        setBulkProcessing(true);
        let successCount = 0;
        let failCount = 0;

        for (const req of pendingInSelected) {
            try {
                await apiInstance.post(`/admin/instructor-request/${req.id}/reject/`, {
                    rejection_reason: reason.trim()
                });
                successCount++;
            } catch (err) {
                console.error(`Error rejecting instructor request ${req.id}:`, err);
                failCount++;
            }
        }

        setBulkProcessing(false);
        setSelectedIds([]);

        Toast().fire({
            icon: "warning",
            title: "Penolakan Massal Selesai",
            text: `${successCount} permohonan telah ditolak.${failCount > 0 ? ` (${failCount} gagal)` : ""}`
        });

        fetchInstructorRequests();
        fetchComprehensiveStats();
        if (typeof onCountsUpdated === "function") {
            onCountsUpdated();
        }
    };

    // Generic CSV Export function with UTF-8 BOM
    const exportToCSV = (dataset, filename) => {
        try {
            const escapeCSV = (str) => {
                if (str === null || str === undefined) return '""';
                const s = String(str).replace(/"/g, '""').replace(/[\r\n]+/g, " ");
                return `"${s}"`;
            };

            const headers = [
                "No",
                "Nama Pemohon",
                "NIP",
                "Email",
                "Bidang Keahlian",
                "Tingkat Pengalaman",
                "Biografi / Portofolio",
                "Tanggal Pengajuan",
                "Status Permohonan",
                "Diverifikasi Oleh",
                "Tanggal Verifikasi",
                "Alasan Penolakan"
            ];

            const rows = dataset.map((item, idx) => {
                const reqDateStr = item.request_date
                    ? new Date(item.request_date).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                      })
                    : "-";
                const revDateStr = item.reviewed_date
                    ? new Date(item.reviewed_date).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                      })
                    : "-";

                const statusLabel =
                    item.status === "PENDING"
                        ? "Tertunda"
                        : item.status === "APPROVED"
                        ? "Disetujui"
                        : "Ditolak";

                return [
                    idx + 1,
                    escapeCSV(item.user_name || "-"),
                    escapeCSV(item.user_nip || "-"),
                    escapeCSV(item.user_email || "-"),
                    escapeCSV(item.expertise_areas || "-"),
                    escapeCSV(getExperienceLevelLabel(item.experience_level)),
                    escapeCSV(item.bio || "-"),
                    escapeCSV(reqDateStr),
                    escapeCSV(statusLabel),
                    escapeCSV(item.reviewed_by_name || "-"),
                    escapeCSV(revDateStr),
                    escapeCSV(item.rejection_reason || "-")
                ].join(",");
            });

            const csvContent = [headers.map((h) => `"${h}"`).join(","), ...rows].join("\r\n");
            const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            Toast().fire({
                icon: "success",
                title: "Berhasil Mengekspor Data",
                text: `${dataset.length} permohonan berhasil diekspor ke file CSV.`
            });
        } catch (err) {
            console.error("Export error:", err);
            Toast().fire({
                icon: "error",
                title: "Gagal Mengekspor",
                text: "Terjadi kesalahan saat mengekspor data ke CSV."
            });
        }
    };

    // Export current filtered list
    const handleExportCSV = () => {
        if (!filteredRequests || filteredRequests.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Tidak ada data untuk diekspor",
                text: "Daftar permohonan saat ini kosong berdasarkan filter yang dipilih."
            });
            return;
        }
        const dateStamp = new Date().toISOString().slice(0, 10);
        exportToCSV(
            filteredRequests,
            `Rekap_Permintaan_Instruktur_SetjenDPDRI_${filterStatus}_${dateStamp}.csv`
        );
    };

    // Bulk export selected list
    const handleBulkExportSelectedCSV = () => {
        if (selectedRequests.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Tidak ada data dipilih",
                text: "Centang setidaknya satu permohonan instruktur untuk diekspor."
            });
            return;
        }
        const dateStamp = new Date().toISOString().slice(0, 10);
        exportToCSV(
            selectedRequests,
            `Rekap_Permintaan_Instruktur_Terpilih_${dateStamp}.csv`
        );
    };

    return (
        <div className="cm-tab-content cm-requests-v2">
            {/* 1. Header Bar with Live KPIs */}
            <div className="cm-compact-header-card mb-3">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <div className="cm-header-icon-box bg-amber-subtle text-warning">
                            <i className="fas fa-user-tie"></i>
                        </div>
                        <div>
                            <h3 className="cm-module-title mb-0">Permintaan Menjadi Instruktur</h3>
                            <p className="cm-module-desc mb-0">
                                Tinjau, verifikasi kelayakan aparatur, dan terbitkan izin mengajar kursus pada portal LMS DPD RI
                            </p>
                        </div>
                    </div>

                    {/* Live KPI Chips */}
                    <div className="cm-kpi-chips-row">
                        <div className="cm-kpi-chip" title="Total seluruh permohonan instruktur">
                            <i className="fas fa-users text-primary"></i>
                            <span className="cm-kpi-label">Total:</span>
                            <span className="cm-kpi-value">{liveStats.total}</span>
                        </div>
                        <div
                            className={`cm-kpi-chip ${liveStats.pending > 0 ? "cm-kpi-amber" : ""}`}
                            title="Permohonan menunggu tinjauan admin"
                        >
                            <i className="fas fa-clock text-warning"></i>
                            <span className="cm-kpi-label">Tertunda:</span>
                            <span className="cm-kpi-value">{liveStats.pending}</span>
                        </div>
                        <div className="cm-kpi-chip" title="Instruktur telah disetujui">
                            <i className="fas fa-user-check text-success"></i>
                            <span className="cm-kpi-label">Disetujui:</span>
                            <span className="cm-kpi-value">{liveStats.approved}</span>
                        </div>
                        <div className="cm-kpi-chip" title="Permohonan ditolak">
                            <i className="fas fa-user-times text-danger"></i>
                            <span className="cm-kpi-label">Ditolak:</span>
                            <span className="cm-kpi-value">{liveStats.rejected}</span>
                        </div>
                        <button
                            type="button"
                            className="cm-btn-mini-refresh"
                            onClick={() => {
                                fetchInstructorRequests();
                                fetchComprehensiveStats();
                            }}
                            disabled={loading}
                            title="Segarkan data permohonan"
                        >
                            <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`}></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Control Toolbar */}
            <div className={`cm-toolbar-card ${hasActiveFilters ? "mb-2" : "mb-3"}`}>
                <div className="row g-2 align-items-center">
                    {/* Status Segmented Buttons */}
                    <div className="col-12 col-md-auto">
                        <div className="cm-segmented-pills">
                            <button
                                type="button"
                                className={`cm-seg-btn ${filterStatus === "PENDING" ? "active" : ""}`}
                                onClick={() => setFilterStatus("PENDING")}
                            >
                                <i className="fas fa-hourglass-half me-1"></i>
                                Tertunda
                                <span className={`cm-pill-count ${liveStats.pending > 0 ? "pulse-amber" : ""}`}>
                                    {liveStats.pending}
                                </span>
                            </button>
                            <button
                                type="button"
                                className={`cm-seg-btn ${filterStatus === "APPROVED" ? "active" : ""}`}
                                onClick={() => setFilterStatus("APPROVED")}
                            >
                                <i className="fas fa-check-circle me-1"></i>
                                Disetujui
                                <span className="cm-pill-count">{liveStats.approved}</span>
                            </button>
                            <button
                                type="button"
                                className={`cm-seg-btn ${filterStatus === "REJECTED" ? "active" : ""}`}
                                onClick={() => setFilterStatus("REJECTED")}
                            >
                                <i className="fas fa-times-circle me-1"></i>
                                Ditolak
                                <span className="cm-pill-count">{liveStats.rejected}</span>
                            </button>
                            <button
                                type="button"
                                className={`cm-seg-btn ${filterStatus === "ALL" ? "active" : ""}`}
                                onClick={() => setFilterStatus("ALL")}
                            >
                                <i className="fas fa-layer-group me-1"></i>
                                Semua
                                <span className="cm-pill-count">{liveStats.total}</span>
                            </button>
                        </div>
                    </div>

                    {/* Search Field */}
                    <div className="col-12 col-sm-6 col-md">
                        <div className="cm-search-box">
                            <i className="fas fa-search cm-search-icon"></i>
                            <input
                                type="text"
                                className="form-control cm-input-compact"
                                placeholder="Cari nama pemohon, NIP, email, atau bidang keahlian..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    className="cm-search-clear"
                                    onClick={() => setSearchTerm("")}
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Experience Level Filter */}
                    <div className="col-6 col-sm-3 col-md-auto">
                        <select
                            className="form-select cm-select-compact"
                            value={levelFilter}
                            onChange={(e) => setLevelFilter(e.target.value)}
                            title="Filter Tingkat Pengalaman"
                        >
                            <option value="all">Semua Pengalaman</option>
                            <option value="BEGINNER">Pemula (0-2 thn)</option>
                            <option value="INTERMEDIATE">Menengah (2-5 thn)</option>
                            <option value="ADVANCED">Lanjutan (5+ thn)</option>
                        </select>
                    </div>

                    {/* Export CSV Button */}
                    <div className="col-auto">
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-teal d-flex align-items-center gap-1"
                            onClick={handleExportCSV}
                            title="Ekspor daftar permohonan saat ini ke format Excel CSV"
                        >
                            <i className="fas fa-file-csv"></i>
                            <span className="d-none d-md-inline">Ekspor CSV</span>
                        </button>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="col-auto ms-auto d-none d-sm-block">
                        <div className="btn-group btn-group-sm">
                            <button
                                type="button"
                                className={`btn btn-outline-secondary ${viewMode === "grid" ? "active" : ""}`}
                                onClick={() => setViewMode("grid")}
                                title="Tampilan Kartu Kompak"
                            >
                                <i className="fas fa-th-large"></i>
                            </button>
                            <button
                                type="button"
                                className={`btn btn-outline-secondary ${viewMode === "table" ? "active" : ""}`}
                                onClick={() => setViewMode("table")}
                                title="Tampilan Tabel Rapat"
                            >
                                <i className="fas fa-list"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Compact & Eye-Catching Active Filter Pills Bar */}
            {hasActiveFilters && (
                <div className="cm-active-filters-bar mb-2.5">
                    <div className="cm-active-filter-label">
                        <i className="fas fa-filter text-teal me-1"></i>
                        <span>Filter Aktif</span>
                        <span className="cm-af-count-chip">{activeFilterCount}</span>
                        <span className="cm-af-divider">|</span>
                    </div>
                    <div className="cm-filter-pills-list">
                        {searchTerm.trim() && (
                            <span className="cm-filter-pill">
                                <i className="fas fa-search text-muted" style={{ fontSize: "0.65rem" }}></i>
                                <span>
                                    Pencarian: <b>"{searchTerm}"</b>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm("")}
                                    title="Hapus filter pencarian"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        )}
                        {levelFilter !== "all" && (
                            <span className="cm-filter-pill">
                                <i className="fas fa-chart-line text-muted" style={{ fontSize: "0.65rem" }}></i>
                                <span>
                                    Pengalaman: <b>{getExperienceLevelLabel(levelFilter)}</b>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setLevelFilter("all")}
                                    title="Hapus filter pengalaman"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        )}
                        <button
                            type="button"
                            className="cm-btn-reset-all"
                            onClick={handleResetAllFilters}
                            title="Reset semua filter pencarian dan pengalaman"
                        >
                            <i className="fas fa-undo-alt me-1"></i> Reset Filter
                        </button>
                    </div>
                </div>
            )}

            {/* 4. Content Area */}
            {loading ? (
                <div className="cm-loading-box py-5 text-center">
                    <div className="spinner-border text-teal spinner-border-sm me-2" role="status"></div>
                    <span className="text-muted small fw-semibold">Memuat data permohonan instruktur...</span>
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="cm-empty-box py-4 text-center">
                    <div className="cm-empty-icon mb-2">
                        <i className="fas fa-inbox"></i>
                    </div>
                    <h5 className="cm-empty-title mb-1">Tidak Ada Permintaan</h5>
                    <p className="cm-empty-text text-muted small mb-0">
                        {searchTerm || levelFilter !== "all"
                            ? "Tidak ada permohonan yang sesuai dengan filter pencarian Anda."
                            : filterStatus === "PENDING"
                            ? "Tidak ada permohonan instruktur yang tertunda saat ini. Semua pengajuan telah diproses."
                            : `Tidak ada permohonan instruktur dengan status ${filterStatus.toLowerCase()}.`}
                    </p>
                </div>
            ) : viewMode === "grid" ? (
                /* Compact Grid View with Multi-Select */
                <div className="cm-requests-grid">
                    {filteredRequests.map((request) => {
                        const isPending = request.status === "PENDING";
                        const isApproved = request.status === "APPROVED";
                        const isSelected = selectedIds.includes(request.id);

                        return (
                            <div
                                key={request.id}
                                className={`cm-req-card ${isPending ? "card-status-pending" : isApproved ? "card-status-approved" : "card-status-rejected"} ${isSelected ? "is-selected" : ""}`}
                            >
                                {/* Compact Card Top Strip with Checkbox */}
                                <div className="cm-req-card-header">
                                    <div
                                        className="d-flex align-items-center me-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            className="form-check-input m-0 cursor-pointer"
                                            checked={isSelected}
                                            onChange={() => handleToggleSelectOne(request.id)}
                                            style={{ width: "17px", height: "17px" }}
                                            title="Pilih permohonan ini"
                                        />
                                    </div>

                                    <div className="cm-req-avatar-box">
                                        {request.user_image ? (
                                            <img
                                                src={request.user_image}
                                                alt={request.user_name}
                                                className="cm-req-avatar-img"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.style.display = "none";
                                                    if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className="cm-req-avatar-fallback"
                                            style={{ display: request.user_image ? "none" : "flex" }}
                                        >
                                            {(request.user_name || "U").charAt(0).toUpperCase()}
                                        </div>
                                    </div>

                                    <div className="cm-req-user-meta">
                                        <div className="d-flex align-items-center justify-content-between gap-1">
                                            <h4
                                                className="cm-req-name text-truncate mb-0 cursor-pointer"
                                                title={request.user_name}
                                                onClick={() => setPreviewRequest(request)}
                                            >
                                                {request.user_name}
                                            </h4>
                                            <span
                                                className={`cm-badge-status ${isPending ? "badge-amber" : isApproved ? "badge-emerald" : "badge-rose"}`}
                                            >
                                                {isPending ? "Tertunda" : isApproved ? "Disetujui" : "Ditolak"}
                                            </span>
                                        </div>
                                        <div className="cm-req-nip text-truncate">
                                            <i className="fas fa-id-badge text-muted me-1"></i>
                                            <span>NIP: {request.user_nip || "Belum diisi"}</span>
                                        </div>
                                        <div className="cm-req-email text-truncate" title={request.user_email}>
                                            <i className="fas fa-envelope text-muted me-1"></i>
                                            <span>{request.user_email || "-"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Compact Expertise & Level */}
                                <div className="cm-req-body">
                                    <div className="cm-req-meta-row">
                                        <span className="cm-req-meta-label">
                                            <i className="fas fa-lightbulb text-warning me-1"></i>Keahlian:
                                        </span>
                                        <span className="cm-req-meta-value text-truncate" title={request.expertise_areas}>
                                            {request.expertise_areas || "-"}
                                        </span>
                                    </div>

                                    <div className="cm-req-meta-row">
                                        <span className="cm-req-meta-label">
                                            <i className="fas fa-chart-line text-teal me-1"></i>Tingkat:
                                        </span>
                                        <span className="badge bg-light text-dark border cm-level-badge">
                                            {getExperienceLevelLabel(request.experience_level)}
                                        </span>
                                    </div>

                                    {/* Compact Bio Preview */}
                                    <div className="cm-req-bio-box">
                                        <p className="cm-req-bio-text mb-0">
                                            {request.bio || "Tidak ada biografi singkat."}
                                        </p>
                                        {request.bio && request.bio.length > 90 && (
                                            <button
                                                type="button"
                                                className="btn-link cm-bio-more-btn"
                                                onClick={() => setPreviewRequest(request)}
                                            >
                                                Selengkapnya
                                            </button>
                                        )}
                                    </div>

                                    {/* Review info if approved/rejected */}
                                    {!isPending && request.reviewed_date && (
                                        <div
                                            className={`cm-review-info-strip ${isApproved ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`}
                                        >
                                            <i className={`fas ${isApproved ? "fa-check-circle" : "fa-times-circle"} me-1`}></i>
                                            <span>
                                                {isApproved ? "Disetujui" : "Ditolak"} oleh <strong>{request.reviewed_by_name || "Admin"}</strong> (
                                                {new Date(request.reviewed_date).toLocaleDateString("id-ID", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric"
                                                })}
                                                )
                                            </span>
                                        </div>
                                    )}

                                    {/* Rejection reason if available */}
                                    {request.status === "REJECTED" && request.rejection_reason && (
                                        <div className="cm-rejection-reason-strip">
                                            <span className="text-danger fw-semibold d-block tiny mb-0.5">Alasan Penolakan:</span>
                                            <p
                                                className="tiny text-muted mb-0 font-italic text-truncate"
                                                title={request.rejection_reason}
                                            >
                                                "{request.rejection_reason}"
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Compact Footer */}
                                <div className="cm-req-card-footer">
                                    <span className="cm-req-date" title={request.request_date}>
                                        <i className="far fa-calendar-alt me-1"></i>
                                        {new Date(request.request_date).toLocaleDateString("id-ID", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric"
                                        })}
                                    </span>

                                    <div className="d-flex align-items-center gap-1.5">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-secondary cm-btn-action"
                                            onClick={() => setPreviewRequest(request)}
                                            title="Lihat Pratinjau Berkas Lengkap"
                                        >
                                            <i className="fas fa-eye"></i>
                                        </button>

                                        {isPending ? (
                                            <div className="cm-req-actions">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger cm-btn-action"
                                                    onClick={() => handleRejectRequest(request)}
                                                    title="Tolak permohonan instruktur"
                                                >
                                                    <i className="fas fa-times me-1"></i>Tolak
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-teal cm-btn-action"
                                                    onClick={() => handleApproveRequest(request)}
                                                    title="Setujui permohonan instruktur"
                                                >
                                                    <i className="fas fa-check me-1"></i>Setujui
                                                </button>
                                            </div>
                                        ) : (
                                            <span className={`tiny fw-semibold ${isApproved ? "text-success" : "text-danger"}`}>
                                                <i className={`fas ${isApproved ? "fa-user-check" : "fa-ban"} me-1`}></i>
                                                {isApproved ? "Instruktur Aktif" : "Berkas Selesai"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Compact Table View with Multi-Select */
                <div className="cm-table-responsive">
                    <table className="table table-hover cm-dense-table mb-0">
                        <thead>
                            <tr>
                                <th style={{ width: "36px" }} className="text-center">
                                    <input
                                        type="checkbox"
                                        className="form-check-input m-0 cursor-pointer"
                                        checked={isAllSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = isSomeSelected;
                                        }}
                                        onChange={handleToggleSelectAll}
                                        title="Pilih semua yang tampil"
                                    />
                                </th>
                                <th style={{ width: "40px" }}>#</th>
                                <th>Pemohon Instruktur</th>
                                <th>NIP</th>
                                <th>Bidang Keahlian</th>
                                <th>Pengalaman</th>
                                <th>Tgl Pengajuan</th>
                                <th>Status</th>
                                <th style={{ width: "150px" }} className="text-end">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.map((request, idx) => {
                                const isPending = request.status === "PENDING";
                                const isApproved = request.status === "APPROVED";
                                const isSelected = selectedIds.includes(request.id);

                                return (
                                    <tr key={request.id} className={isSelected ? "cm-row-selected" : ""}>
                                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="form-check-input m-0 cursor-pointer"
                                                checked={isSelected}
                                                onChange={() => handleToggleSelectOne(request.id)}
                                                title="Pilih baris ini"
                                            />
                                        </td>
                                        <td className="text-muted small">{idx + 1}</td>
                                        <td>
                                            <div
                                                className="d-flex align-items-center gap-2 cursor-pointer"
                                                onClick={() => setPreviewRequest(request)}
                                                title="Klik untuk membuka pratinjau berkas"
                                            >
                                                <div className="cm-table-avatar">
                                                    {(request.user_name || "U").charAt(0).toUpperCase()}
                                                </div>
                                                <div className="cm-table-userinfo">
                                                    <strong className="d-block text-dark small text-truncate" style={{ maxWidth: "200px" }}>
                                                        {request.user_name}
                                                    </strong>
                                                    <span className="text-muted tiny d-block text-truncate" style={{ maxWidth: "200px" }}>
                                                        {request.user_email}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-muted small font-monospace">
                                            {request.user_nip || "-"}
                                        </td>
                                        <td>
                                            <span
                                                className="small text-dark text-truncate d-block"
                                                style={{ maxWidth: "180px" }}
                                                title={request.expertise_areas}
                                            >
                                                {request.expertise_areas || "-"}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-dark border">
                                                {getExperienceLevelLabel(request.experience_level)}
                                            </span>
                                        </td>
                                        <td className="text-muted tiny">
                                            {new Date(request.request_date).toLocaleDateString("id-ID", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric"
                                            })}
                                        </td>
                                        <td>
                                            <span
                                                className={`cm-badge-status ${isPending ? "badge-amber" : isApproved ? "badge-emerald" : "badge-rose"}`}
                                            >
                                                {isPending ? "Tertunda" : isApproved ? "Disetujui" : "Ditolak"}
                                            </span>
                                        </td>
                                        <td className="text-end">
                                            <div className="d-flex align-items-center justify-content-end gap-1">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary btn-xs"
                                                    onClick={() => setPreviewRequest(request)}
                                                    title="Lihat Pratinjau Berkas"
                                                >
                                                    <i className="fas fa-eye"></i>
                                                </button>
                                                {isPending && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger btn-xs"
                                                            onClick={() => handleRejectRequest(request)}
                                                            title="Tolak Permohonan"
                                                        >
                                                            <i className="fas fa-times"></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-success btn-xs"
                                                            onClick={() => handleApproveRequest(request)}
                                                            title="Setujui Permohonan"
                                                        >
                                                            <i className="fas fa-check"></i>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 5. Floating Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div className="cm-floating-bulk-bar">
                    <div className="cm-bulk-bar-inner">
                        <div className="cm-bulk-count-box">
                            <span className="cm-bulk-count-badge">{selectedIds.length}</span>
                            <span className="cm-bulk-count-text">Permohonan Terpilih</span>
                        </div>

                        <div className="cm-bulk-divider"></div>

                        <div className="cm-bulk-actions-group">
                            {pendingInSelected.length > 0 && (
                                <>
                                    <button
                                        type="button"
                                        className="cm-bulk-btn cm-bulk-approve"
                                        onClick={handleBulkApprove}
                                        disabled={bulkProcessing}
                                        title="Setujui seluruh permohonan instruktur tertunda yang dipilih"
                                    >
                                        {bulkProcessing ? (
                                            <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                        ) : (
                                            <i className="fas fa-check-circle me-1"></i>
                                        )}
                                        Setujui ({pendingInSelected.length})
                                    </button>

                                    <button
                                        type="button"
                                        className="cm-bulk-btn cm-bulk-reject"
                                        onClick={handleBulkReject}
                                        disabled={bulkProcessing}
                                        title="Tolak seluruh permohonan instruktur tertunda yang dipilih"
                                    >
                                        {bulkProcessing ? (
                                            <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                        ) : (
                                            <i className="fas fa-ban me-1"></i>
                                        )}
                                        Tolak ({pendingInSelected.length})
                                    </button>
                                </>
                            )}

                            <button
                                type="button"
                                className="cm-bulk-btn cm-bulk-export"
                                onClick={handleBulkExportSelectedCSV}
                                title="Ekspor permohonan terpilih ke Excel CSV"
                            >
                                <i className="fas fa-file-export me-1"></i>
                                Ekspor CSV ({selectedIds.length})
                            </button>

                            <button
                                type="button"
                                className="cm-bulk-btn cm-bulk-clear"
                                onClick={() => setSelectedIds([])}
                                title="Batalkan semua pilihan"
                            >
                                <i className="fas fa-times me-1"></i>
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. Slide-over Quick Preview Drawer */}
            {previewRequest && (
                <>
                    <div
                        className="cm-drawer-backdrop"
                        onClick={() => setPreviewRequest(null)}
                    />
                    <div className="cm-preview-drawer">
                        {/* Drawer Header */}
                        <div className="cm-drawer-header">
                            <div className="cm-drawer-title-box">
                                <span className="cm-drawer-badge">
                                    <i className="fas fa-user-tie me-1"></i> Pratinjau Berkas Pemohon
                                </span>
                                <h4 className="cm-drawer-title text-truncate" title={previewRequest.user_name}>
                                    {previewRequest.user_name}
                                </h4>
                                <span className="cm-drawer-subtitle">
                                    NIP: {previewRequest.user_nip || "Belum diisi"} &bull; Diajukan{" "}
                                    {new Date(previewRequest.request_date).toLocaleDateString("id-ID", {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric"
                                    })}
                                </span>
                            </div>
                            <button
                                type="button"
                                className="cm-drawer-close-btn"
                                onClick={() => setPreviewRequest(null)}
                                title="Tutup (Esc)"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="cm-drawer-body">
                            {/* Profile Identity Card */}
                            <div className="p-3 bg-light rounded border mb-3">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="cm-req-avatar-box" style={{ width: "52px", height: "52px" }}>
                                        {previewRequest.user_image ? (
                                            <img
                                                src={previewRequest.user_image}
                                                alt={previewRequest.user_name}
                                                className="cm-req-avatar-img"
                                                style={{ width: "52px", height: "52px", borderRadius: "10px" }}
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.style.display = "none";
                                                    if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className="cm-req-avatar-fallback"
                                            style={{
                                                display: previewRequest.user_image ? "none" : "flex",
                                                width: "52px",
                                                height: "52px",
                                                borderRadius: "10px",
                                                fontSize: "1.3rem"
                                            }}
                                        >
                                            {(previewRequest.user_name || "U").charAt(0).toUpperCase()}
                                        </div>
                                    </div>
                                    <div className="flex-grow-1 min-w-0">
                                        <h5 className="mb-0.5 text-dark fw-bold text-truncate">{previewRequest.user_name}</h5>
                                        <div className="text-muted small text-truncate">
                                            <i className="fas fa-envelope me-1"></i>
                                            {previewRequest.user_email || "-"}
                                        </div>
                                        <div className="d-flex align-items-center gap-2 mt-1">
                                            <span
                                                className={`cm-badge-status ${previewRequest.status === "PENDING" ? "badge-amber" : previewRequest.status === "APPROVED" ? "badge-emerald" : "badge-rose"}`}
                                            >
                                                {previewRequest.status === "PENDING"
                                                    ? "Menunggu Tinjauan"
                                                    : previewRequest.status === "APPROVED"
                                                    ? "Disetujui (Instruktur Aktif)"
                                                    : "Ditolak"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Experience & Application Date */}
                            <div className="row g-2 mb-3">
                                <div className="col-12 col-sm-6">
                                    <div className="p-2.5 rounded border bg-white h-100">
                                        <span className="tiny text-muted d-block mb-1 fw-semibold">
                                            <i className="fas fa-chart-line text-teal me-1"></i> Tingkat Pengalaman
                                        </span>
                                        <span className="badge bg-light text-dark border fs-6 fw-bold">
                                            {getExperienceLevelLabel(previewRequest.experience_level)}
                                        </span>
                                    </div>
                                </div>
                                <div className="col-12 col-sm-6">
                                    <div className="p-2.5 rounded border bg-white h-100">
                                        <span className="tiny text-muted d-block mb-1 fw-semibold">
                                            <i className="far fa-calendar-check text-primary me-1"></i> Tanggal Pengajuan
                                        </span>
                                        <span className="small text-dark fw-bold">
                                            {new Date(previewRequest.request_date).toLocaleDateString("id-ID", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric"
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Expertise Badges */}
                            <div className="mb-3">
                                <h6 className="fw-bold text-dark mb-1.5" style={{ fontSize: "0.84rem" }}>
                                    <i className="fas fa-lightbulb text-warning me-1"></i> Bidang Keahlian & Spesialisasi:
                                </h6>
                                <div className="p-2.5 rounded border bg-light">
                                    {previewRequest.expertise_areas ? (
                                        <div className="d-flex flex-wrap gap-1.5">
                                            {previewRequest.expertise_areas.split(",").map((area, idx) => (
                                                <span key={idx} className="badge bg-white text-dark border px-2 py-1 shadow-xs">
                                                    {area.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-muted small">Tidak ada bidang keahlian yang dicantumkan.</span>
                                    )}
                                </div>
                            </div>

                            {/* Bio & Portfolio */}
                            <div className="mb-3">
                                <h6 className="fw-bold text-dark mb-1.5" style={{ fontSize: "0.84rem" }}>
                                    <i className="fas fa-quote-left text-teal me-1"></i> Biografi & Ringkasan Portofolio:
                                </h6>
                                <div
                                    className="p-3 rounded border bg-light text-dark"
                                    style={{
                                        fontSize: "0.88rem",
                                        lineHeight: 1.6,
                                        maxHeight: "180px",
                                        overflowY: "auto",
                                        whiteSpace: "pre-wrap"
                                    }}
                                >
                                    {previewRequest.bio || "Tidak ada biografi singkat yang dilampirkan oleh pemohon."}
                                </div>
                            </div>

                            {/* Review Information if processed */}
                            {previewRequest.status !== "PENDING" && previewRequest.reviewed_date && (
                                <div
                                    className={`p-3 rounded border mb-3 ${previewRequest.status === "APPROVED" ? "bg-success-subtle border-success" : "bg-danger-subtle border-danger"}`}
                                >
                                    <div className="d-flex align-items-center gap-2 mb-1">
                                        <i
                                            className={`fas ${previewRequest.status === "APPROVED" ? "fa-check-circle text-success" : "fa-times-circle text-danger"}`}
                                        ></i>
                                        <strong
                                            className={`small ${previewRequest.status === "APPROVED" ? "text-success" : "text-danger"}`}
                                        >
                                            {previewRequest.status === "APPROVED" ? "Telah Disetujui" : "Telah Ditolak"}
                                        </strong>
                                    </div>
                                    <div className="small text-muted">
                                        Diverifikasi oleh{" "}
                                        <strong>{previewRequest.reviewed_by_name || "Admin LMS"}</strong> pada{" "}
                                        {new Date(previewRequest.reviewed_date).toLocaleDateString("id-ID", {
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric"
                                        })}
                                    </div>
                                    {previewRequest.rejection_reason && (
                                        <div className="mt-2 p-2 bg-white rounded border border-danger-subtle">
                                            <span className="tiny fw-bold text-danger d-block mb-0.5">Alasan Penolakan:</span>
                                            <p className="small text-dark mb-0 font-italic">
                                                "{previewRequest.rejection_reason}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Notice about instructor rights */}
                            {previewRequest.status === "PENDING" && (
                                <div className="alert alert-info py-2 px-3 small mb-0">
                                    <i className="fas fa-info-circle me-1.5"></i>
                                    Persetujuan permohonan ini akan otomatis mengonversi akun aparatur menjadi{" "}
                                    <strong>Instruktur</strong> dengan hak akses penuh membuat kursus, silabus, dan kuis.
                                </div>
                            )}
                        </div>

                        {/* Footer Quick Actions */}
                        <div className="cm-drawer-footer d-flex align-items-center justify-content-between">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setPreviewRequest(null)}
                            >
                                Tutup
                            </button>

                            {previewRequest.status === "PENDING" && (
                                <div className="d-flex align-items-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => {
                                            const req = previewRequest;
                                            setPreviewRequest(null);
                                            handleRejectRequest(req);
                                        }}
                                    >
                                        <i className="fas fa-times me-1"></i> Tolak
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-teal text-white"
                                        style={{ backgroundColor: "#0d9488", borderColor: "#0d9488" }}
                                        onClick={() => {
                                            const req = previewRequest;
                                            setPreviewRequest(null);
                                            handleApproveRequest(req);
                                        }}
                                    >
                                        <i className="fas fa-check me-1"></i> Setujui & Terbitkan Izin
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default React.memo(InstructorRequestsTab);
