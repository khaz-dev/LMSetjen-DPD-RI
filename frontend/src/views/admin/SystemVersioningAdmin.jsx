import React, { useState, useEffect, useMemo } from "react";
import apiInstance from "../../utils/axios";
import Toast from "../plugin/Toast";
import useSystemVersion, { dispatchVersionUpdate } from "../../hooks/useSystemVersion";
import dayjs, { moment } from "../../utils/dayjs";
import "./SystemVersioningAdmin.css";

const CATEGORY_CHOICES = [
    { value: "feature", label: "Fitur Baru", icon: "bi-rocket-takeoff-fill", iconClass: "chip-icon-feat", tagClass: "cat-feature" },
    { value: "improvement", label: "Peningkatan", icon: "bi-lightning-charge-fill", iconClass: "chip-icon-imp", tagClass: "cat-improvement" },
    { value: "bugfix", label: "Perbaikan Bug", icon: "bi-bug-fill", iconClass: "chip-icon-fix", tagClass: "cat-bugfix" },
    { value: "security", label: "Keamanan", icon: "bi-shield-check", iconClass: "chip-icon-sec", tagClass: "cat-security" },
    { value: "ui", label: "Antarmuka", icon: "bi-palette-fill", iconClass: "chip-icon-ui", tagClass: "cat-ui" }
];

export default function SystemVersioningAdmin({ isEmbedded = false, refreshTrigger = 0 }) {
    const {
        version: currentVersion,
        releases,
        stats,
        currentRelease,
        suggestedNext,
        serverTelemetry,
        loading,
        fetchReleases
    } = useSystemVersion({ fetchReleases: true });

    // UI state
    const [showBumpForm, setShowBumpForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [submitting, setSubmitting] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [expandedReleaseId, setExpandedReleaseId] = useState(null);

    // Edit modal state
    const [editingRelease, setEditingRelease] = useState(null);

    // Form state for new bump
    const [bumpType, setBumpType] = useState("patch");
    const [formData, setFormData] = useState({
        version: "",
        title: "",
        version_type: "patch",
        release_date: dayjs().format("YYYY-MM-DDTHH:mm"),
        is_current: true,
        summary: "",
        changes: [
            { category: "feature", title: "", module: "", description: "" }
        ],
        raw_notes: ""
    });

    // Auto-update version string when bumpType or suggestedNext changes
    useEffect(() => {
        if (bumpType === "custom") {
            // Keep current value
        } else if (suggestedNext && suggestedNext[bumpType]) {
            setFormData(prev => ({
                ...prev,
                version: suggestedNext[bumpType],
                version_type: bumpType
            }));
        }
    }, [bumpType, suggestedNext]);

    useEffect(() => {
        if (refreshTrigger > 0) {
            fetchReleases(searchQuery, typeFilter === "all" ? "" : typeFilter);
        }
    }, [refreshTrigger, fetchReleases, searchQuery, typeFilter]);

    const handleSearch = (e) => {
        const q = e.target.value;
        setSearchQuery(q);
        fetchReleases(q, typeFilter === "all" ? "" : typeFilter);
    };

    const handleFilterChange = (filter) => {
        setTypeFilter(filter);
        fetchReleases(searchQuery, filter === "all" ? "" : filter);
    };

    // Change items management in form
    const handleAddChangeItem = () => {
        setFormData(prev => ({
            ...prev,
            changes: [...prev.changes, { category: "improvement", title: "", module: "", description: "" }]
        }));
    };

    const handleRemoveChangeItem = (index) => {
        setFormData(prev => ({
            ...prev,
            changes: prev.changes.filter((_, i) => i !== index)
        }));
    };

    const handleItemFieldChange = (index, field, value) => {
        setFormData(prev => {
            const updated = [...prev.changes];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, changes: updated };
        });
    };

    // Submit new release bump
    const handleSubmitRelease = async (e) => {
        e.preventDefault();
        if (!formData.version.trim()) {
            Toast().fire({ title: "Nomor versi harus diisi!", icon: "warning" });
            return;
        }
        if (!formData.title.trim()) {
            Toast().fire({ title: "Judul rilis harus diisi!", icon: "warning" });
            return;
        }

        const validChanges = formData.changes.filter(c => c.title && c.title.trim().length > 0);

        setSubmitting(true);
        try {
            const payload = {
                version: formData.version.trim(),
                title: formData.title.trim(),
                version_type: formData.version_type,
                release_date: formData.release_date ? new Date(formData.release_date).toISOString() : new Date().toISOString(),
                is_current: formData.is_current,
                summary: formData.summary.trim(),
                changes: validChanges,
                raw_notes: formData.raw_notes.trim()
            };

            const res = await apiInstance.post("/system/releases/", payload);
            if (res.data?.success) {
                Toast().fire({
                    title: `Versi ${formData.version} berhasil diterbitkan!`,
                    icon: "success",
                    timer: 3500
                });

                dispatchVersionUpdate({
                    version: formData.version.trim(),
                    release_title: formData.title.trim()
                });

                setShowBumpForm(false);
                setFormData({
                    version: "",
                    title: "",
                    version_type: "patch",
                    release_date: dayjs().format("YYYY-MM-DDTHH:mm"),
                    is_current: true,
                    summary: "",
                    changes: [{ category: "feature", title: "", module: "", description: "" }],
                    raw_notes: ""
                });

                fetchReleases();
            }
        } catch (err) {
            console.error("Error creating release:", err);
            Toast().fire({
                title: err?.response?.data?.error || "Gagal menerbitkan versi baru.",
                icon: "error"
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Promote a release to current
    const handleSetCurrent = async (release) => {
        if (!window.confirm(`Tetapkan v${release.version} (${release.title}) sebagai versi aktif sistem saat ini?`)) {
            return;
        }

        setActionLoadingId(release.id);
        try {
            const res = await apiInstance.post(`/system/releases/${release.id}/set-current/`);
            if (res.data?.success) {
                Toast().fire({
                    title: `v${release.version} sekarang aktif!`,
                    icon: "success"
                });

                dispatchVersionUpdate({
                    version: release.version,
                    release_title: release.title
                });

                fetchReleases();
            }
        } catch (err) {
            console.error("Error setting current release:", err);
            Toast().fire({ title: "Gagal menetapkan versi aktif.", icon: "error" });
        } finally {
            setActionLoadingId(null);
        }
    };

    // Delete release
    const handleDeleteRelease = async (release) => {
        if (!window.confirm(`Hapus catatan rilis v${release.version}? Tindakan ini tidak dapat dibatalkan.`)) {
            return;
        }

        setActionLoadingId(release.id);
        try {
            await apiInstance.delete(`/system/releases/${release.id}/`);
            Toast().fire({
                title: `Log rilis v${release.version} berhasil dihapus.`,
                icon: "success"
            });
            fetchReleases();
        } catch (err) {
            console.error("Error deleting release:", err);
            Toast().fire({ title: "Gagal menghapus catatan rilis.", icon: "error" });
        } finally {
            setActionLoadingId(null);
        }
    };

    // Save edited release
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editingRelease) return;

        setSubmitting(true);
        try {
            const res = await apiInstance.patch(`/system/releases/${editingRelease.id}/`, {
                title: editingRelease.title,
                summary: editingRelease.summary,
                version_type: editingRelease.version_type,
                changes: editingRelease.changes,
                raw_notes: editingRelease.raw_notes,
                is_current: editingRelease.is_current
            });

            if (res.data?.success) {
                Toast().fire({ title: "Catatan rilis berhasil diperbarui!", icon: "success" });
                if (editingRelease.is_current) {
                    dispatchVersionUpdate({
                        version: editingRelease.version,
                        release_title: editingRelease.title
                    });
                }
                setEditingRelease(null);
                fetchReleases();
            }
        } catch (err) {
            console.error("Error updating release:", err);
            Toast().fire({ title: "Gagal memperbarui catatan rilis.", icon: "error" });
        } finally {
            setSubmitting(false);
        }
    };

    const getCategoryMeta = (cat) => {
        const c = String(cat || "").toLowerCase();
        if (c.includes("feat") || c.includes("fitur")) return { label: "Fitur Baru", icon: "bi-rocket-takeoff-fill", iconClass: "chip-icon-feat", tagClass: "cat-feature" };
        if (c.includes("improv") || c.includes("peningkatan") || c.includes("tingkat")) return { label: "Peningkatan", icon: "bi-lightning-charge-fill", iconClass: "chip-icon-imp", tagClass: "cat-improvement" };
        if (c.includes("bug") || c.includes("fix") || c.includes("perbaikan")) return { label: "Perbaikan Bug", icon: "bi-bug-fill", iconClass: "chip-icon-fix", tagClass: "cat-bugfix" };
        if (c.includes("sec") || c.includes("aman")) return { label: "Keamanan", icon: "bi-shield-check", iconClass: "chip-icon-sec", tagClass: "cat-security" };
        if (c.includes("ui") || c.includes("tampilan")) return { label: "Antarmuka", icon: "bi-palette-fill", iconClass: "chip-icon-ui", tagClass: "cat-ui" };
        return { label: cat || "Pembaruan", icon: "bi-check2-circle", iconClass: "chip-icon-feat", tagClass: "cat-feature" };
    };

    return (
        <div className="versioning-admin-compact">
            {/* 1. Compact Action & Real-Time Telemetry Bar */}
            <div className="versioning-action-bar">
                <div className="versioning-bar-left">
                    <div className="version-live-chip" title="Versi Aktif Platform LMSetjen DPD RI">
                        <span className="pulse-dot-live"></span>
                        <span>v{currentVersion || "-"}</span>
                    </div>

                    <div className="versioning-bar-title-block">
                        <h3 className="versioning-bar-title">
                            {currentRelease?.title || "Versi Stabil Terpasang"}
                        </h3>
                        <span className="versioning-bar-meta">
                            Rilis: {currentRelease?.release_date ? moment(currentRelease.release_date).format("DD MMM YYYY, HH:mm WIB") : "-"} &bull; Tipe: {currentRelease?.version_type_display || currentRelease?.version_type || "Patch"}
                        </span>
                    </div>
                </div>

                <div className="versioning-bar-right">
                    {/* Real Live Telemetry Badges */}
                    <div className="telemetry-pills-row">
                        {serverTelemetry?.git_commit && (
                            <span className="telemetry-pill" title={`Git Commit: ${serverTelemetry.git_commit_msg || ''}`}>
                                <i className="bi bi-git"></i>
                                <span>{serverTelemetry.git_commit} ({serverTelemetry.git_branch})</span>
                            </span>
                        )}
                        {serverTelemetry?.django_version && (
                            <span className="telemetry-pill" title="Backend Engine Runtime">
                                <i className="bi bi-cpu"></i>
                                <span>Django {serverTelemetry.django_version} &bull; Py {serverTelemetry.python_version}</span>
                            </span>
                        )}
                        {serverTelemetry?.database_engine && (
                            <span className="telemetry-pill" title="Database Relasional Terhubung">
                                <i className="bi bi-database"></i>
                                <span>{serverTelemetry.database_engine}</span>
                            </span>
                        )}
                    </div>

                    {/* Sticking Action Buttons Group */}
                    <div className="versioning-action-buttons-group">
                        <button
                            type="button"
                            className={`btn btn-sm ${showBumpForm ? "btn-outline-secondary" : "btn-primary"} d-inline-flex align-items-center gap-1 fw-bold px-3 py-1`}
                            onClick={() => {
                                if (!showBumpForm) {
                                    setShowBumpForm(true);
                                    setBumpType("patch");
                                    if (suggestedNext?.patch) {
                                        setFormData(prev => ({
                                            ...prev,
                                            version: suggestedNext.patch,
                                            version_type: "patch"
                                        }));
                                    }
                                } else {
                                    setShowBumpForm(false);
                                }
                            }}
                        >
                            <i className={`bi ${showBumpForm ? "bi-x-lg" : "bi-arrow-up-circle-fill"}`}></i>
                            <span>{showBumpForm ? "Tutup Form" : "Tingkatkan Versi LMS"}</span>
                        </button>

                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary btn-refresh-icon-centered"
                            onClick={() => fetchReleases(searchQuery, typeFilter === "all" ? "" : typeFilter)}
                            title="Segarkan data versi dan catatan rilis"
                            disabled={loading}
                            aria-label="Segarkan data versi"
                        >
                            <i className={`bi bi-arrow-clockwise ${loading ? "is-spinning" : ""}`}></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Compact 4-Column Live Metric Strip */}
            <div className="versioning-metrics-strip">
                <div className="metric-strip-card card-active-version">
                    <div className="metric-strip-icon icon-emerald" aria-hidden="true">
                        <i className="bi bi-check-circle-fill"></i>
                    </div>
                    <div className="metric-strip-info">
                        <p className="metric-strip-label">Versi Aktif Berjalan</p>
                        <div className="metric-strip-value">
                            v{currentVersion || "-"}
                        </div>
                        <p className="metric-strip-sub" title={currentRelease?.title}>
                            {currentRelease?.title || "Versi Stabil Terpasang"}
                        </p>
                    </div>
                </div>

                <div className="metric-strip-card">
                    <div className="metric-strip-icon icon-blue" aria-hidden="true">
                        <i className="bi bi-journal-check"></i>
                    </div>
                    <div className="metric-strip-info">
                        <p className="metric-strip-label">Riwayat Rilis Sistem</p>
                        <div className="metric-strip-value">
                            {stats?.total_releases ?? releases.length} <small style={{ fontSize: "0.75rem", fontWeight: 600 }}>Rilis</small>
                        </div>
                        <p className="metric-strip-sub">
                            {stats?.major_count || 0} Major &bull; {stats?.minor_count || 0} Minor &bull; {stats?.patch_count || 0} Patch
                        </p>
                    </div>
                </div>

                <div className="metric-strip-card">
                    <div className="metric-strip-icon icon-purple" aria-hidden="true">
                        <i className="bi bi-rocket-takeoff-fill"></i>
                    </div>
                    <div className="metric-strip-info">
                        <p className="metric-strip-label">Fitur & Peningkatan</p>
                        <div className="metric-strip-value">
                            {(stats?.total_features || 0) + (stats?.total_improvements || 0)} <small style={{ fontSize: "0.75rem", fontWeight: 600 }}>Item</small>
                        </div>
                        <p className="metric-strip-sub">
                            🚀 {stats?.total_features || 0} Fitur Baru &bull; ⚡ {stats?.total_improvements || 0} Peningkatan
                        </p>
                    </div>
                </div>

                <div className="metric-strip-card">
                    <div className="metric-strip-icon icon-amber" aria-hidden="true">
                        <i className="bi bi-shield-check"></i>
                    </div>
                    <div className="metric-strip-info">
                        <p className="metric-strip-label">Perbaikan & Keamanan</p>
                        <div className="metric-strip-value">
                            {(stats?.total_fixes || 0) + (stats?.total_security || 0)} <small style={{ fontSize: "0.75rem", fontWeight: 600 }}>Item</small>
                        </div>
                        <p className="metric-strip-sub">
                            🐛 {stats?.total_fixes || 0} Perbaikan &bull; 🔒 {stats?.total_security || 0} Patch Keamanan
                        </p>
                    </div>
                </div>
            </div>

            {/* 3. Compact Bump / Publish Version Form */}
            {showBumpForm && (
                <div className="version-bump-compact-card">
                    <div className="bump-compact-header">
                        <h4>
                            <i className="bi bi-arrow-up-right-circle-fill"></i>
                            Peningkatan Versi & Publikasi Log Baru
                        </h4>
                        <span>Semantic Versioning Terintegrasi</span>
                    </div>

                    <form onSubmit={handleSubmitRelease} className="bump-compact-body">
                        {/* Step 1: Preset Pill Buttons */}
                        <div>
                            <div className="bump-pill-selector">
                                <div
                                    className={`bump-pill-btn ${bumpType === "patch" ? "is-selected" : ""}`}
                                    onClick={() => setBumpType("patch")}
                                >
                                    <div className="bump-pill-top">
                                        <span className="bump-pill-tag tag-patch">Patch (Bugfix)</span>
                                    </div>
                                    <div className="bump-pill-version">v{suggestedNext?.patch || "1.0.2"}</div>
                                    <div className="bump-pill-hint">Perbaikan bug & kestabilan</div>
                                </div>

                                <div
                                    className={`bump-pill-btn ${bumpType === "minor" ? "is-selected" : ""}`}
                                    onClick={() => setBumpType("minor")}
                                >
                                    <div className="bump-pill-top">
                                        <span className="bump-pill-tag tag-minor">Minor (Fitur)</span>
                                    </div>
                                    <div className="bump-pill-version">v{suggestedNext?.minor || "1.1.0"}</div>
                                    <div className="bump-pill-hint">Fitur baru kompatibel</div>
                                </div>

                                <div
                                    className={`bump-pill-btn ${bumpType === "major" ? "is-selected" : ""}`}
                                    onClick={() => setBumpType("major")}
                                >
                                    <div className="bump-pill-top">
                                        <span className="bump-pill-tag tag-major">Major (Rilis)</span>
                                    </div>
                                    <div className="bump-pill-version">v{suggestedNext?.major || "2.0.0"}</div>
                                    <div className="bump-pill-hint">Perombakan arsitektur besar</div>
                                </div>

                                <div
                                    className={`bump-pill-btn ${bumpType === "custom" ? "is-selected" : ""}`}
                                    onClick={() => setBumpType("custom")}
                                >
                                    <div className="bump-pill-top">
                                        <span className="bump-pill-tag tag-custom">Kustom</span>
                                    </div>
                                    <div className="bump-pill-version">Kustom</div>
                                    <div className="bump-pill-hint">Tentukan nomor manual</div>
                                </div>
                            </div>
                        </div>

                        {/* Step 2: Dense Metadata Row */}
                        <div className="bump-compact-grid">
                            <div className="form-dense-group">
                                <label>Nomor Versi *</label>
                                <input
                                    type="text"
                                    className="form-control-dense font-monospace fw-bold"
                                    placeholder="Contoh: 1.0.2"
                                    value={formData.version}
                                    onChange={e => setFormData({ ...formData, version: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-dense-group">
                                <label>Tanggal & Waktu Rilis *</label>
                                <input
                                    type="datetime-local"
                                    className="form-control-dense"
                                    value={formData.release_date}
                                    onChange={e => setFormData({ ...formData, release_date: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-dense-group">
                                <label>Judul Rilis Pembaruan *</label>
                                <input
                                    type="text"
                                    className="form-control-dense"
                                    placeholder="Contoh: Pembaruan Sistem Umpan Balik & Peningkatan Stabilitas Player Video"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="form-dense-group">
                            <label>Ringkasan Pembaruan (Dilihat oleh Pengguna di Update Log)</label>
                            <textarea
                                className="form-control-dense"
                                rows={3}
                                style={{ resize: "vertical", minHeight: "68px" }}
                                placeholder="Tuliskan gambaran/paragraf ringkasan pembaruan apa saja yang baru dalam versi ini..."
                                value={formData.summary}
                                onChange={e => setFormData({ ...formData, summary: e.target.value })}
                            />
                        </div>

                        {/* Step 3: Categorized Changes Box */}
                        <div className="changes-compact-box">
                            <div className="changes-compact-head">
                                <h5>
                                    <i className="bi bi-list-check"></i>
                                    Rincian Item Perubahan (Changelog Items)
                                </h5>
                                <button
                                    type="button"
                                    className="btn-add-item-dense"
                                    onClick={handleAddChangeItem}
                                >
                                    <i className="bi bi-plus-lg"></i>
                                    <span>Tambah Item</span>
                                </button>
                            </div>

                            {formData.changes.map((item, idx) => (
                                <div key={idx} className="change-item-compact-row">
                                    <div className="change-item-grid-dense">
                                        <select
                                            className="form-control-dense select-category-dense py-0"
                                            value={item.category}
                                            onChange={e => handleItemFieldChange(idx, "category", e.target.value)}
                                        >
                                            {CATEGORY_CHOICES.map(cat => (
                                                <option key={cat.value} value={cat.value}>
                                                    {cat.label}
                                                </option>
                                            ))}
                                        </select>

                                        <input
                                            type="text"
                                            className="form-control-dense py-0"
                                            placeholder="Judul Perubahan (misal: Dialog Masukan Mengambang)"
                                            value={item.title}
                                            onChange={e => handleItemFieldChange(idx, "title", e.target.value)}
                                            required
                                        />

                                        <input
                                            type="text"
                                            className="form-control-dense py-0 input-module-dense"
                                            placeholder="Modul (Kuis, SSO, Gamifikasi, dll)"
                                            value={item.module}
                                            onChange={e => handleItemFieldChange(idx, "module", e.target.value)}
                                        />

                                        {formData.changes.length > 1 && (
                                            <button
                                                type="button"
                                                className="btn-remove-dense"
                                                onClick={() => handleRemoveChangeItem(idx)}
                                                title="Hapus baris ini"
                                            >
                                                <i className="bi bi-x-lg"></i>
                                            </button>
                                        )}
                                    </div>

                                    <textarea
                                        className="form-control-dense change-item-desc-dense"
                                        rows={2}
                                        style={{ resize: "vertical", minHeight: "52px" }}
                                        placeholder="Keterangan singkat perubahan dan manfaatnya bagi aparatur (dapat berupa paragraf multi-baris)..."
                                        value={item.description}
                                        onChange={e => handleItemFieldChange(idx, "description", e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Options & Action */}
                        <div className="d-flex justify-content-between align-items-center pt-1 border-top">
                            <div className="form-check form-switch p-0 d-flex align-items-center gap-2 mb-0">
                                <input
                                    className="form-check-input ms-0 mt-0 cursor-pointer"
                                    type="checkbox"
                                    id="is_current_switch_compact"
                                    checked={formData.is_current}
                                    onChange={e => setFormData({ ...formData, is_current: e.target.checked })}
                                />
                                <label className="form-check-label fw-bold text-dark cursor-pointer small" htmlFor="is_current_switch_compact">
                                    Tetapkan langsung sebagai Versi Aktif LMSetjen DPD RI
                                </label>
                            </div>

                            <div className="d-flex align-items-center gap-2">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-light px-3"
                                    onClick={() => setShowBumpForm(false)}
                                    disabled={submitting}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 px-3 fw-bold"
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status"></span>
                                            <span>Menerbitkan...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-cloud-arrow-up-fill"></i>
                                            <span>Terbitkan Versi Sekarang</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* 4. Compact History & Release Timeline */}
            <div className="versioning-history-compact">
                <div className="history-toolbar-compact">
                    <div className="history-toolbar-left">
                        <h4 className="history-compact-title">
                            <i className="bi bi-clock-history text-primary"></i>
                            Riwayat Log Rilis & Versi Sistem
                        </h4>
                        <span className="badge bg-light text-secondary border fw-semibold" style={{ fontSize: "0.72rem" }}>
                            {releases.length} Terdata
                        </span>
                    </div>

                    <div className="history-toolbar-right">
                        <div className="history-search-dense">
                            <i className="bi bi-search history-search-icon-dense"></i>
                            <input
                                type="text"
                                className="history-search-input-dense"
                                placeholder="Cari log atau nomor versi..."
                                value={searchQuery}
                                onChange={handleSearch}
                            />
                        </div>

                        <div className="filter-pills-dense">
                            {[
                                { id: "all", label: `Semua (${stats?.total_releases ?? releases.length})` },
                                { id: "major", label: `Major (${stats?.major_count || 0})` },
                                { id: "minor", label: `Minor (${stats?.minor_count || 0})` },
                                { id: "patch", label: `Patch (${stats?.patch_count || 0})` }
                            ].map(f => (
                                <button
                                    key={f.id}
                                    type="button"
                                    className={`filter-pill-dense-btn ${typeFilter === f.id ? "is-active" : ""}`}
                                    onClick={() => handleFilterChange(f.id)}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-4">
                        <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                        <p className="text-muted small mt-1 mb-0">Memuat riwayat pembaruan dari database...</p>
                    </div>
                ) : releases.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                        <i className="bi bi-inbox fs-3 d-block mb-1 text-secondary"></i>
                        <p className="small mb-0 fw-semibold">Belum ada riwayat rilis yang cocok dengan pencarian.</p>
                    </div>
                ) : (
                    <div className="timeline-compact-list">
                        {releases.map(rel => {
                            const isCurrent = rel.is_current;
                            const changes = rel.changes || [];
                            const isExpanded = expandedReleaseId === rel.id;

                            return (
                                <div
                                    key={rel.id}
                                    className={`timeline-compact-card ${isCurrent ? "is-active-release" : ""}`}
                                >
                                    <div className="card-top-dense">
                                        <div className="card-version-group">
                                            <span className="version-dense-tag">v{rel.version}</span>
                                            <span className={`type-dense-badge tag-${rel.version_type || "patch"}`}>
                                                {rel.version_type_display || rel.version_type}
                                            </span>
                                            {isCurrent && (
                                                <span className="badge-active-pill">
                                                    <span className="pulse-dot-live" style={{ width: 6, height: 6 }}></span> Versi Aktif
                                                </span>
                                            )}
                                        </div>

                                        <div className="card-meta-dense">
                                            <span>
                                                <i className="bi bi-calendar3 me-1"></i>
                                                {rel.release_date ? moment(rel.release_date).format("DD MMM YYYY, HH:mm WIB") : "-"}
                                            </span>
                                            <span>&bull;</span>
                                            <span>
                                                <i className="bi bi-person me-1"></i>
                                                {rel.created_by_name || "Admin DPD RI"}
                                            </span>

                                            <div className="card-actions-dense ms-2">
                                                {!isCurrent && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-dense-action btn-outline-success"
                                                        disabled={actionLoadingId === rel.id}
                                                        onClick={() => handleSetCurrent(rel)}
                                                        title="Tetapkan rilis ini sebagai versi aktif"
                                                    >
                                                        <i className="bi bi-check-circle"></i>
                                                        <span>Jadikan Aktif</span>
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    className="btn btn-dense-action btn-outline-secondary"
                                                    onClick={() => setEditingRelease({ ...rel })}
                                                    title="Edit catatan rilis"
                                                >
                                                    <i className="bi bi-pencil"></i>
                                                    <span>Edit</span>
                                                </button>

                                                {!isCurrent && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-dense-action btn-dense-icon-only btn-outline-danger"
                                                        disabled={actionLoadingId === rel.id}
                                                        onClick={() => handleDeleteRelease(rel)}
                                                        title="Hapus log rilis"
                                                        aria-label="Hapus log rilis"
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                )}

                                                {changes.length > 0 && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-dense-action btn-dense-icon-only btn-light border"
                                                        onClick={() => setExpandedReleaseId(isExpanded ? null : rel.id)}
                                                        title={isExpanded ? "Tutup rincian perubahan" : "Lihat rincian perubahan"}
                                                        aria-label={isExpanded ? "Tutup rincian perubahan" : "Lihat rincian perubahan"}
                                                    >
                                                        <i className={`bi ${isExpanded ? "bi-chevron-up" : "bi-chevron-down"}`}></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <h5 className="card-title-dense">{rel.title}</h5>
                                    {rel.summary && (
                                        <p className="card-summary-dense">{rel.summary}</p>
                                    )}

                                    {/* Compact Change Items Chips */}
                                    {changes.length > 0 && (
                                        <div>
                                            <div className="changes-chips-row">
                                                {changes.map((item, idx) => {
                                                    const meta = getCategoryMeta(item.category);
                                                    return (
                                                        <div key={idx} className="change-chip" title={item.description || item.title}>
                                                            <i className={`bi ${meta.icon} ${meta.iconClass}`}></i>
                                                            <span className="chip-title">{item.title}</span>
                                                            {item.module && (
                                                                <span className="chip-module">{item.module}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Detailed expanded breakdown */}
                                            {isExpanded && (
                                                <div className="mt-2 pt-2 border-top">
                                                    <div className="d-flex flex-column gap-1">
                                                        {changes.map((item, idx) => {
                                                            const meta = getCategoryMeta(item.category);
                                                            return (
                                                                <div key={idx} className="d-flex align-items-start gap-2 py-1 px-2 bg-light rounded small">
                                                                    <i className={`bi ${meta.icon} ${meta.iconClass} mt-1`}></i>
                                                                    <div>
                                                                        <div className="fw-bold text-dark">
                                                                            {item.title}
                                                                            {item.module && <span className="badge bg-secondary-subtle text-secondary ms-1">{item.module}</span>}
                                                                        </div>
                                                                        {item.description && <div className="text-muted">{item.description}</div>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingRelease && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(15,23,42,0.6)" }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header bg-light py-2 px-3">
                                <h6 className="modal-title fw-bold mb-0">
                                    <i className="bi bi-pencil-square me-2 text-primary"></i>
                                    Edit Catatan Rilis v{editingRelease.version}
                                </h6>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setEditingRelease(null)}
                                    aria-label="Close"
                                ></button>
                            </div>

                            <form onSubmit={handleSaveEdit}>
                                <div className="modal-body p-3">
                                    <div className="mb-2">
                                        <label className="form-label fw-bold small mb-1">Judul Rilis</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            value={editingRelease.title}
                                            onChange={e => setEditingRelease({ ...editingRelease, title: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="mb-2">
                                        <label className="form-label fw-bold small mb-1">Ringkasan Pembaruan</label>
                                        <textarea
                                            className="form-control form-control-sm"
                                            rows={3}
                                            style={{ resize: "vertical", minHeight: "68px" }}
                                            value={editingRelease.summary || ""}
                                            onChange={e => setEditingRelease({ ...editingRelease, summary: e.target.value })}
                                        />
                                    </div>

                                    <div className="mb-2">
                                        <label className="form-label fw-bold small mb-1">Jenis Rilis</label>
                                        <select
                                            className="form-select form-select-sm"
                                            value={editingRelease.version_type}
                                            onChange={e => setEditingRelease({ ...editingRelease, version_type: e.target.value })}
                                        >
                                            <option value="patch">Patch / Perbaikan Bug</option>
                                            <option value="minor">Minor / Fitur Baru</option>
                                            <option value="major">Major / Rilis Utama</option>
                                        </select>
                                    </div>

                                    <div className="changes-compact-box mt-2">
                                        <div className="changes-compact-head">
                                            <h6 className="small fw-bold mb-0">Item Perubahan</h6>
                                            <button
                                                type="button"
                                                className="btn-add-item-dense"
                                                onClick={() => {
                                                    setEditingRelease({
                                                        ...editingRelease,
                                                        changes: [
                                                            ...(editingRelease.changes || []),
                                                            { category: "improvement", title: "", module: "", description: "" }
                                                        ]
                                                    });
                                                }}
                                            >
                                                <i className="bi bi-plus-lg"></i> Tambah Item
                                            </button>
                                        </div>

                                        {(editingRelease.changes || []).map((item, idx) => (
                                            <div key={idx} className="change-item-compact-row">
                                                <div className="change-item-grid-dense">
                                                    <select
                                                        className="form-control-dense select-category-dense py-0"
                                                        value={item.category}
                                                        onChange={e => {
                                                            const updated = [...editingRelease.changes];
                                                            updated[idx].category = e.target.value;
                                                            setEditingRelease({ ...editingRelease, changes: updated });
                                                        }}
                                                    >
                                                        {CATEGORY_CHOICES.map(c => (
                                                            <option key={c.value} value={c.value}>{c.label}</option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="text"
                                                        className="form-control-dense py-0"
                                                        placeholder="Judul"
                                                        value={item.title}
                                                        onChange={e => {
                                                            const updated = [...editingRelease.changes];
                                                            updated[idx].title = e.target.value;
                                                            setEditingRelease({ ...editingRelease, changes: updated });
                                                        }}
                                                    />
                                                    <input
                                                        type="text"
                                                        className="form-control-dense py-0 input-module-dense"
                                                        placeholder="Modul"
                                                        value={item.module || ""}
                                                        onChange={e => {
                                                            const updated = [...editingRelease.changes];
                                                            updated[idx].module = e.target.value;
                                                            setEditingRelease({ ...editingRelease, changes: updated });
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn-remove-dense"
                                                        onClick={() => {
                                                            const updated = editingRelease.changes.filter((_, i) => i !== idx);
                                                            setEditingRelease({ ...editingRelease, changes: updated });
                                                        }}
                                                    >
                                                        <i className="bi bi-trash-fill"></i>
                                                    </button>
                                                </div>
                                                <textarea
                                                    className="form-control-dense change-item-desc-dense"
                                                    rows={2}
                                                    style={{ resize: "vertical", minHeight: "52px" }}
                                                    placeholder="Deskripsi"
                                                    value={item.description || ""}
                                                    onChange={e => {
                                                        const updated = [...editingRelease.changes];
                                                        updated[idx].description = e.target.value;
                                                        setEditingRelease({ ...editingRelease, changes: updated });
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="modal-footer bg-light py-2 px-3">
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => setEditingRelease(null)}
                                        disabled={submitting}
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-sm btn-primary fw-bold"
                                        disabled={submitting}
                                    >
                                        {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
