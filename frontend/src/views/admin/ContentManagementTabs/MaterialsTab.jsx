import React, { useState, useEffect, useMemo, useCallback } from "react";
import Swal from "sweetalert2";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";

/**
 * Enterprise-Grade Materials Management Tab (Categories & Tags)
 * Setjen DPD RI Learning Platform
 *
 * Features:
 * - Multi-Select Checkboxes (Grid & Table View)
 * - Floating Bulk Action Bar (Bulk Activate, Bulk Deactivate, Bulk Delete, Bulk Export CSV, Deselect All)
 * - Compact & Eye-Catching Active Filter Pills Bar (DPD RI Teal Accent)
 * - Excel-Compatible CSV Export with UTF-8 BOM (\uFEFF)
 * - Slide-over Quick Preview Drawer for Categories & Tags
 * - Dual View Modes (Grid & High-Density Table)
 * - Real-time KPI Sync & Keyboard Shortcuts (Escape to Close)
 */
function MaterialsTab({ onCountsUpdated }) {
    // Active Subtab: 'categories' | 'tags'
    const [activeTab, setActiveTab] = useState("categories");
    // View Mode: 'table' | 'grid'
    const [viewMode, setViewMode] = useState("table");

    // Categories State
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [categoryModalMode, setCategoryModalMode] = useState("add"); // 'add' | 'edit'
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categoryForm, setCategoryForm] = useState({ title: "", image: "", active: true });
    const [categoryFormErrors, setCategoryFormErrors] = useState({});
    const [categorySearch, setCategorySearch] = useState("");
    const [categoryStatusFilter, setCategoryStatusFilter] = useState("all");

    // Tags State
    const [tags, setTags] = useState([]);
    const [loadingTags, setLoadingTags] = useState(true);
    const [showTagModal, setShowTagModal] = useState(false);
    const [tagModalMode, setTagModalMode] = useState("add"); // 'add' | 'edit'
    const [selectedTag, setSelectedTag] = useState(null);
    const [tagForm, setTagForm] = useState({ title: "", active: true });
    const [tagFormErrors, setTagFormErrors] = useState({});
    const [tagSearch, setTagSearch] = useState("");
    const [tagStatusFilter, setTagStatusFilter] = useState("all");

    // Multi-Select & Bulk Moderation
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkProcessing, setBulkProcessing] = useState(false);

    // Slide-over Quick Preview Drawer
    const [previewItem, setPreviewItem] = useState(null);
    const [previewType, setPreviewType] = useState("category"); // 'category' | 'tag'

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState({
        show: false,
        type: "category", // 'category' | 'tag'
        item: null,
        isDeleting: false
    });

    // Submitting state
    const [submitting, setSubmitting] = useState(false);

    // Close preview drawer / modals on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                setPreviewItem(null);
                setShowCategoryModal(false);
                setShowTagModal(false);
                setDeleteModal((prev) => ({ ...prev, show: false }));
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Clear selections when tab or filters change
    useEffect(() => {
        setSelectedIds([]);
    }, [activeTab, categorySearch, categoryStatusFilter, tagSearch, tagStatusFilter]);

    // ============= FETCH DATA =============
    const fetchCategories = useCallback(async () => {
        try {
            setLoadingCategories(true);
            const res = await apiInstance.get("admin/category/");
            const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
            setCategories(data);
        } catch (error) {
            console.error("Error fetching categories:", error);
            Toast().fire({
                icon: "error",
                title: "Gagal memuat kategori"
            });
        } finally {
            setLoadingCategories(false);
        }
    }, []);

    const fetchTags = useCallback(async () => {
        try {
            setLoadingTags(true);
            const res = await apiInstance.get("admin/tag/");
            const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
            setTags(data);
        } catch (error) {
            console.error("Error fetching tags:", error);
            // Fallback to public tag endpoint if admin 404s
            try {
                const resPublic = await apiInstance.get("course/tag/");
                const dataPublic = Array.isArray(resPublic.data) ? resPublic.data : resPublic.data?.results || [];
                setTags(dataPublic);
            } catch (e) {
                console.error("Error fetching public tags:", e);
            }
        } finally {
            setLoadingTags(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
        fetchTags();
    }, [fetchCategories, fetchTags]);

    // Live Stats Computed
    const categoryStats = useMemo(() => {
        const total = categories.length;
        const active = categories.filter((c) => c.active).length;
        const withCourses = categories.filter((c) => (c.course_count || 0) > 0).length;
        const totalCourses = categories.reduce((sum, c) => sum + (c.course_count || 0), 0);
        return { total, active, withCourses, totalCourses };
    }, [categories]);

    const tagStats = useMemo(() => {
        const total = tags.length;
        const active = tags.filter((t) => t.active).length;
        const withCourses = tags.filter((t) => (t.course_count || 0) > 0).length;
        const totalCourses = tags.reduce((sum, t) => sum + (t.course_count || 0), 0);
        return { total, active, withCourses, totalCourses };
    }, [tags]);

    // Filtered Categories
    const filteredCategories = useMemo(() => {
        return categories.filter((cat) => {
            if (categorySearch.trim()) {
                const q = categorySearch.toLowerCase();
                const title = (cat.title || "").toLowerCase();
                const slug = (cat.slug || "").toLowerCase();
                if (!title.includes(q) && !slug.includes(q)) return false;
            }
            if (categoryStatusFilter !== "all") {
                const isActive = categoryStatusFilter === "active";
                if (Boolean(cat.active) !== isActive) return false;
            }
            return true;
        });
    }, [categories, categorySearch, categoryStatusFilter]);

    // Filtered Tags
    const filteredTags = useMemo(() => {
        return tags.filter((tag) => {
            if (tagSearch.trim()) {
                const q = tagSearch.toLowerCase();
                const title = (tag.title || "").toLowerCase();
                const slug = (tag.slug || "").toLowerCase();
                if (!title.includes(q) && !slug.includes(q)) return false;
            }
            if (tagStatusFilter !== "all") {
                const isActive = tagStatusFilter === "active";
                if (Boolean(tag.active) !== isActive) return false;
            }
            return true;
        });
    }, [tags, tagSearch, tagStatusFilter]);

    // Active Dataset based on activeTab
    const currentItems = useMemo(() => {
        return activeTab === "categories" ? filteredCategories : filteredTags;
    }, [activeTab, filteredCategories, filteredTags]);

    // Multi-Select Helpers
    const isAllSelected = useMemo(() => {
        return currentItems.length > 0 && currentItems.every((i) => selectedIds.includes(i.id));
    }, [currentItems, selectedIds]);

    const isSomeSelected = useMemo(() => {
        return selectedIds.length > 0 && !isAllSelected;
    }, [selectedIds, isAllSelected]);

    const handleToggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(currentItems.map((i) => i.id));
        }
    };

    const handleToggleSelectOne = (id) => {
        if (!id) return;
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const selectedItems = useMemo(() => {
        const source = activeTab === "categories" ? categories : tags;
        return source.filter((i) => selectedIds.includes(i.id));
    }, [activeTab, categories, tags, selectedIds]);

    const activeInSelected = useMemo(() => {
        return selectedItems.filter((i) => Boolean(i.active));
    }, [selectedItems]);

    const inactiveInSelected = useMemo(() => {
        return selectedItems.filter((i) => !i.active);
    }, [selectedItems]);

    // Active Filters Bar tracking
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (activeTab === "categories") {
            if (categorySearch.trim()) count++;
            if (categoryStatusFilter !== "all") count++;
        } else {
            if (tagSearch.trim()) count++;
            if (tagStatusFilter !== "all") count++;
        }
        return count;
    }, [activeTab, categorySearch, categoryStatusFilter, tagSearch, tagStatusFilter]);

    const hasActiveFilters = useMemo(() => {
        return activeFilterCount > 0;
    }, [activeFilterCount]);

    const handleResetAllFilters = () => {
        if (activeTab === "categories") {
            setCategorySearch("");
            setCategoryStatusFilter("all");
        } else {
            setTagSearch("");
            setTagStatusFilter("all");
        }
    };

    // ============= CATEGORY HANDLERS =============
    const handleOpenAddCategory = () => {
        setCategoryForm({ title: "", image: "", active: true });
        setCategoryFormErrors({});
        setCategoryModalMode("add");
        setSelectedCategory(null);
        setShowCategoryModal(true);
    };

    const handleOpenEditCategory = (cat) => {
        setCategoryForm({
            title: cat.title || "",
            image: cat.image || "",
            active: Boolean(cat.active)
        });
        setCategoryFormErrors({});
        setCategoryModalMode("edit");
        setSelectedCategory(cat);
        setShowCategoryModal(true);
    };

    const handleSaveCategory = async () => {
        if (!categoryForm.title || !categoryForm.title.trim()) {
            setCategoryFormErrors({ title: "Nama kategori wajib diisi" });
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                title: categoryForm.title.trim(),
                image: categoryForm.image || "",
                active: categoryForm.active
            };

            if (categoryModalMode === "add") {
                await apiInstance.post("admin/category/", payload);
                Toast().fire({ icon: "success", title: "Kategori berhasil dibuat" });
            } else {
                await apiInstance.put(`admin/category/${selectedCategory.id}/`, payload);
                Toast().fire({ icon: "success", title: "Kategori berhasil diperbarui" });
            }

            setShowCategoryModal(false);
            fetchCategories();
            if (typeof onCountsUpdated === "function") onCountsUpdated();
        } catch (error) {
            console.error("Error saving category:", error);
            const msg =
                error.response?.data?.title?.[0] ||
                error.response?.data?.error ||
                "Gagal menyimpan kategori";
            setCategoryFormErrors({ submit: msg });
            Toast().fire({ icon: "error", title: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleCategoryActive = async (cat) => {
        try {
            await apiInstance.put(`admin/category/${cat.id}/`, {
                title: cat.title,
                image: cat.image || "",
                active: !cat.active
            });
            Toast().fire({
                icon: "success",
                title: `Kategori ${!cat.active ? "diaktifkan" : "dinonaktifkan"}`
            });
            fetchCategories();
            if (previewItem && previewItem.id === cat.id) {
                setPreviewItem((prev) => ({ ...prev, active: !cat.active }));
            }
            if (typeof onCountsUpdated === "function") onCountsUpdated();
        } catch (error) {
            Toast().fire({ icon: "error", title: "Gagal memperbarui status kategori" });
        }
    };

    // ============= TAG HANDLERS =============
    const handleOpenAddTag = () => {
        setTagForm({ title: "", active: true });
        setTagFormErrors({});
        setTagModalMode("add");
        setSelectedTag(null);
        setShowTagModal(true);
    };

    const handleOpenEditTag = (tag) => {
        setTagForm({
            title: tag.title || "",
            active: tag.active !== undefined ? Boolean(tag.active) : true
        });
        setTagFormErrors({});
        setTagModalMode("edit");
        setSelectedTag(tag);
        setShowTagModal(true);
    };

    const handleSaveTag = async () => {
        if (!tagForm.title || !tagForm.title.trim()) {
            setTagFormErrors({ title: "Nama tag wajib diisi" });
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                title: tagForm.title.trim(),
                active: tagForm.active
            };

            if (tagModalMode === "add") {
                await apiInstance.post("admin/tag/", payload);
                Toast().fire({ icon: "success", title: "Tag berhasil dibuat" });
            } else {
                await apiInstance.put(`admin/tag/${selectedTag.id}/`, payload);
                Toast().fire({ icon: "success", title: "Tag berhasil diperbarui" });
            }

            setShowTagModal(false);
            fetchTags();
            if (typeof onCountsUpdated === "function") onCountsUpdated();
        } catch (error) {
            console.error("Error saving tag:", error);
            const msg =
                error.response?.data?.title?.[0] ||
                error.response?.data?.error ||
                "Gagal menyimpan tag";
            setTagFormErrors({ submit: msg });
            Toast().fire({ icon: "error", title: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleTagActive = async (tag) => {
        try {
            const newActive = !(tag.active !== undefined ? tag.active : true);
            await apiInstance.put(`admin/tag/${tag.id}/`, {
                title: tag.title,
                active: newActive
            });
            Toast().fire({
                icon: "success",
                title: `Tag ${newActive ? "diaktifkan" : "dinonaktifkan"}`
            });
            fetchTags();
            if (previewItem && previewItem.id === tag.id) {
                setPreviewItem((prev) => ({ ...prev, active: newActive }));
            }
            if (typeof onCountsUpdated === "function") onCountsUpdated();
        } catch (error) {
            Toast().fire({ icon: "error", title: "Gagal memperbarui status tag" });
        }
    };

    // ============= DELETE HANDLERS =============
    const handleConfirmDelete = async () => {
        const { type, item } = deleteModal;
        if (!item) return;

        setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
        try {
            if (type === "category") {
                await apiInstance.delete(`admin/category/${item.id}/`);
                Toast().fire({ icon: "success", title: "Kategori berhasil dihapus" });
                fetchCategories();
            } else {
                await apiInstance.delete(`admin/tag/${item.id}/`);
                Toast().fire({ icon: "success", title: "Tag berhasil dihapus" });
                fetchTags();
            }
            setDeleteModal({ show: false, type: "category", item: null, isDeleting: false });
            if (previewItem && previewItem.id === item.id) {
                setPreviewItem(null);
            }
            if (typeof onCountsUpdated === "function") onCountsUpdated();
        } catch (error) {
            console.error("Error deleting:", error);
            const msg =
                error.response?.data?.error ||
                error.response?.data?.detail ||
                "Gagal menghapus data";
            Toast().fire({ icon: "warning", title: msg });
            setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
        }
    };

    // ============= BULK ACTIONS =============
    const handleBulkActivate = async () => {
        if (inactiveInSelected.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Semua sudah aktif",
                text: `Seluruh ${activeTab === "categories" ? "kategori" : "tag"} yang dipilih sudah berstatus aktif.`
            });
            return;
        }

        setBulkProcessing(true);
        let successCount = 0;
        const endpoint = activeTab === "categories" ? "admin/category" : "admin/tag";

        for (const item of inactiveInSelected) {
            try {
                const payload =
                    activeTab === "categories"
                        ? { title: item.title, image: item.image || "", active: true }
                        : { title: item.title, active: true };
                await apiInstance.put(`${endpoint}/${item.id}/`, payload);
                successCount++;
            } catch (err) {
                console.error(`Error activating ${activeTab} ${item.id}:`, err);
            }
        }

        setBulkProcessing(false);
        setSelectedIds([]);
        Toast().fire({
            icon: "success",
            title: "Aktivasi Massal Berhasil",
            text: `${successCount} ${activeTab === "categories" ? "kategori" : "tag"} telah diaktifkan.`
        });

        if (activeTab === "categories") fetchCategories();
        else fetchTags();
        if (typeof onCountsUpdated === "function") onCountsUpdated();
    };

    const handleBulkDeactivate = async () => {
        if (activeInSelected.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Semua sudah nonaktif",
                text: `Seluruh ${activeTab === "categories" ? "kategori" : "tag"} yang dipilih sudah berstatus nonaktif.`
            });
            return;
        }

        setBulkProcessing(true);
        let successCount = 0;
        const endpoint = activeTab === "categories" ? "admin/category" : "admin/tag";

        for (const item of activeInSelected) {
            try {
                const payload =
                    activeTab === "categories"
                        ? { title: item.title, image: item.image || "", active: false }
                        : { title: item.title, active: false };
                await apiInstance.put(`${endpoint}/${item.id}/`, payload);
                successCount++;
            } catch (err) {
                console.error(`Error deactivating ${activeTab} ${item.id}:`, err);
            }
        }

        setBulkProcessing(false);
        setSelectedIds([]);
        Toast().fire({
            icon: "warning",
            title: "Nonaktivasi Massal Berhasil",
            text: `${successCount} ${activeTab === "categories" ? "kategori" : "tag"} telah dinonaktifkan.`
        });

        if (activeTab === "categories") fetchCategories();
        else fetchTags();
        if (typeof onCountsUpdated === "function") onCountsUpdated();
    };

    const handleBulkDelete = async () => {
        if (selectedItems.length === 0) return;

        const totalCourses = selectedItems.reduce((sum, item) => sum + (item.course_count || 0), 0);
        const itemType = activeTab === "categories" ? "kategori" : "tag";

        const result = await Swal.fire({
            title: `Hapus ${selectedItems.length} ${itemType === "kategori" ? "Kategori" : "Tag"} Sekaligus?`,
            html: `
                <div class="text-start p-2" style="font-size: 0.88rem;">
                    <p class="mb-2">Anda akan menghapus <b>${selectedItems.length} ${itemType}</b> terpilih.</p>
                    ${totalCourses > 0
                    ? `<div class="alert alert-warning py-2 px-3 small mb-2">
                                <i class="fas fa-exclamation-triangle me-1"></i>
                                <strong>Perhatian:</strong> Terdapat <b>${totalCourses} kursus</b> yang terhubung dengan data ini.
                            </div>`
                    : ""
                }
                    <p class="text-danger small mb-0"><i class="fas fa-exclamation-circle me-1"></i> Tindakan ini tidak dapat dibatalkan.</p>
                </div>
            `,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#64748b",
            confirmButtonText: `<i class="fas fa-trash-alt me-1"></i> Ya, Hapus Semua (${selectedItems.length})`,
            cancelButtonText: "Batal",
            reverseButtons: true
        });

        if (!result.isConfirmed) return;

        setBulkProcessing(true);
        let successCount = 0;
        let failCount = 0;
        const endpoint = activeTab === "categories" ? "admin/category" : "admin/tag";

        for (const item of selectedItems) {
            try {
                await apiInstance.delete(`${endpoint}/${item.id}/`);
                successCount++;
            } catch (err) {
                console.error(`Error deleting ${activeTab} ${item.id}:`, err);
                failCount++;
            }
        }

        setBulkProcessing(false);
        setSelectedIds([]);

        Toast().fire({
            icon: successCount > 0 ? "success" : "error",
            title: "Penghapusan Massal Selesai",
            text: `${successCount} data berhasil dihapus.${failCount > 0 ? ` (${failCount} gagal)` : ""}`
        });

        if (activeTab === "categories") fetchCategories();
        else fetchTags();
        if (typeof onCountsUpdated === "function") onCountsUpdated();
    };

    // ============= CSV EXPORT =============
    const exportToCSV = (dataset, filename) => {
        try {
            const escapeCSV = (str) => {
                if (str === null || str === undefined) return '""';
                const s = String(str).replace(/"/g, '""').replace(/[\r\n]+/g, " ");
                return `"${s}"`;
            };

            const isCat = activeTab === "categories";
            const headers = isCat
                ? ["No", "Judul Kategori", "Slug", "Jumlah Kursus Terkait", "Status Publikasi"]
                : ["No", "Nama Tag", "Slug", "Jumlah Kursus Terkait", "Status"];

            const rows = dataset.map((item, idx) => {
                return [
                    idx + 1,
                    escapeCSV(item.title || "-"),
                    escapeCSV(item.slug || "-"),
                    item.course_count || 0,
                    escapeCSV(item.active ? "Aktif" : "Nonaktif")
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
                text: `${dataset.length} data taksonomi berhasil diekspor ke file CSV.`
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

    const handleExportCSV = () => {
        if (!currentItems || currentItems.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Tidak ada data untuk diekspor",
                text: "Daftar taksonomi saat ini kosong berdasarkan filter yang dipilih."
            });
            return;
        }
        const dateStamp = new Date().toISOString().slice(0, 10);
        const prefix = activeTab === "categories" ? "Kategori" : "Tag";
        exportToCSV(currentItems, `Rekap_${prefix}_Materi_SetjenDPDRI_${dateStamp}.csv`);
    };

    const handleBulkExportSelectedCSV = () => {
        if (selectedItems.length === 0) {
            Toast().fire({
                icon: "info",
                title: "Tidak ada data dipilih",
                text: "Centang setidaknya satu item untuk diekspor."
            });
            return;
        }
        const dateStamp = new Date().toISOString().slice(0, 10);
        const prefix = activeTab === "categories" ? "Kategori_Terpilih" : "Tag_Terpilih";
        exportToCSV(selectedItems, `Rekap_${prefix}_${dateStamp}.csv`);
    };

    const isLoading = activeTab === "categories" ? loadingCategories : loadingTags;

    return (
        <div className="cm-tab-content cm-materials-v2">
            {/* 1. Header Bar with Live KPIs */}
            <div className="cm-compact-header-card mb-3">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <div className="cm-header-icon-box bg-teal-subtle text-teal">
                            <i className="fas fa-book-atlas"></i>
                        </div>
                        <div>
                            <h3 className="cm-module-title mb-0">Kelola Taksonomi Materi Kursus</h3>
                            <p className="cm-module-desc mb-0">
                                Atur pengelompokan kurikulum, kategori rumpun ilmu, dan label tag kursus Setjen DPD RI
                            </p>
                        </div>
                    </div>

                    {/* Compact Live KPI Chips */}
                    <div className="cm-kpi-chips-row">
                        {activeTab === "categories" ? (
                            <>
                                <div className="cm-kpi-chip" title="Total Kategori">
                                    <i className="fas fa-layer-group text-primary"></i>
                                    <span className="cm-kpi-label">Kategori:</span>
                                    <span className="cm-kpi-value">{categoryStats.total}</span>
                                </div>
                                <div className="cm-kpi-chip" title="Kategori Aktif">
                                    <i className="fas fa-check-circle text-success"></i>
                                    <span className="cm-kpi-label">Aktif:</span>
                                    <span className="cm-kpi-value">{categoryStats.active}</span>
                                </div>
                                <div className="cm-kpi-chip" title="Total Kursus Terkait Kategori">
                                    <i className="fas fa-book text-warning"></i>
                                    <span className="cm-kpi-label">Kursus:</span>
                                    <span className="cm-kpi-value">{categoryStats.totalCourses}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="cm-kpi-chip" title="Total Tag Kursus">
                                    <i className="fas fa-tags text-primary"></i>
                                    <span className="cm-kpi-label">Total Tag:</span>
                                    <span className="cm-kpi-value">{tagStats.total}</span>
                                </div>
                                <div className="cm-kpi-chip" title="Tag Aktif">
                                    <i className="fas fa-check-circle text-success"></i>
                                    <span className="cm-kpi-label">Aktif:</span>
                                    <span className="cm-kpi-value">{tagStats.active}</span>
                                </div>
                                <div className="cm-kpi-chip" title="Kursus Terkait Tag">
                                    <i className="fas fa-book text-teal"></i>
                                    <span className="cm-kpi-label">Kursus:</span>
                                    <span className="cm-kpi-value">{tagStats.totalCourses}</span>
                                </div>
                            </>
                        )}
                        <button
                            type="button"
                            className="cm-btn-mini-refresh"
                            onClick={() => {
                                fetchCategories();
                                fetchTags();
                            }}
                            disabled={isLoading}
                            title="Segarkan data taksonomi"
                        >
                            <i className={`fas fa-sync-alt ${isLoading ? "fa-spin" : ""}`}></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Control Toolbar */}
            <div className={`cm-toolbar-card ${hasActiveFilters ? "mb-2" : "mb-3"}`}>
                <div className="row g-2 align-items-center">
                    {/* Subtab Segmented Switcher */}
                    <div className="col-12 col-md-auto">
                        <div className="cm-segmented-pills">
                            <button
                                type="button"
                                className={`cm-seg-btn ${activeTab === "categories" ? "active" : ""}`}
                                onClick={() => setActiveTab("categories")}
                            >
                                <i className="fas fa-layer-group me-1"></i>
                                Kategori
                                <span className="cm-pill-count">{categoryStats.total}</span>
                            </button>
                            <button
                                type="button"
                                className={`cm-seg-btn ${activeTab === "tags" ? "active" : ""}`}
                                onClick={() => setActiveTab("tags")}
                            >
                                <i className="fas fa-tags me-1"></i>
                                Tag Kursus
                                <span className="cm-pill-count">{tagStats.total}</span>
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
                                placeholder={
                                    activeTab === "categories"
                                        ? "Cari nama kategori atau slug..."
                                        : "Cari tag kursus..."
                                }
                                value={activeTab === "categories" ? categorySearch : tagSearch}
                                onChange={(e) =>
                                    activeTab === "categories"
                                        ? setCategorySearch(e.target.value)
                                        : setTagSearch(e.target.value)
                                }
                            />
                            {(activeTab === "categories" ? categorySearch : tagSearch) && (
                                <button
                                    type="button"
                                    className="cm-search-clear"
                                    onClick={() =>
                                        activeTab === "categories"
                                            ? setCategorySearch("")
                                            : setTagSearch("")
                                    }
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div className="col-6 col-sm-3 col-md-auto">
                        <select
                            className="form-select cm-select-compact"
                            value={activeTab === "categories" ? categoryStatusFilter : tagStatusFilter}
                            onChange={(e) =>
                                activeTab === "categories"
                                    ? setCategoryStatusFilter(e.target.value)
                                    : setTagStatusFilter(e.target.value)
                            }
                            title="Filter Status"
                        >
                            <option value="all">Semua Status</option>
                            <option value="active">Aktif</option>
                            <option value="inactive">Nonaktif</option>
                        </select>
                    </div>

                    {/* Export CSV Button */}
                    <div className="col-auto">
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-teal d-flex align-items-center gap-1"
                            onClick={handleExportCSV}
                            title="Ekspor taksonomi ke format Excel CSV"
                        >
                            <i className="fas fa-file-csv"></i>
                            <span className="d-none d-md-inline">Ekspor CSV</span>
                        </button>
                    </div>

                    {/* Primary Action Button */}
                    <div className="col-auto">
                        <button
                            type="button"
                            className="btn btn-sm btn-teal cm-btn-action-primary"
                            onClick={activeTab === "categories" ? handleOpenAddCategory : handleOpenAddTag}
                            title={activeTab === "categories" ? "Tambah Kategori Baru" : "Tambah Tag Baru"}
                        >
                            <i className="fas fa-plus me-1"></i>
                            <span>{activeTab === "categories" ? "Tambah Kategori" : "Tambah Tag"}</span>
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
                <div className="cm-active-filters-bar mb-2">
                    <div className="cm-active-filter-label">
                        <i className="fas fa-filter text-teal me-1"></i>
                        <span>Filter Aktif</span>
                        <span className="cm-af-count-chip">{activeFilterCount}</span>
                        <span className="cm-af-divider">|</span>
                    </div>
                    <div className="cm-filter-pills-list">
                        {(activeTab === "categories" ? categorySearch : tagSearch).trim() && (
                            <span className="cm-filter-pill">
                                <i className="fas fa-search text-muted" style={{ fontSize: "0.65rem" }}></i>
                                <span>
                                    Pencarian: <b>"{(activeTab === "categories" ? categorySearch : tagSearch)}"</b>
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        activeTab === "categories"
                                            ? setCategorySearch("")
                                            : setTagSearch("")
                                    }
                                    title="Hapus pencarian"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        )}
                        {(activeTab === "categories" ? categoryStatusFilter : tagStatusFilter) !== "all" && (
                            <span className="cm-filter-pill">
                                <i className="fas fa-check-circle text-muted" style={{ fontSize: "0.65rem" }}></i>
                                <span>
                                    Status:{" "}
                                    <b>
                                        {(activeTab === "categories" ? categoryStatusFilter : tagStatusFilter) === "active"
                                            ? "Aktif"
                                            : "Nonaktif"}
                                    </b>
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        activeTab === "categories"
                                            ? setCategoryStatusFilter("all")
                                            : setTagStatusFilter("all")
                                    }
                                    title="Hapus filter status"
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </span>
                        )}
                        <button
                            type="button"
                            className="cm-btn-reset-all"
                            onClick={handleResetAllFilters}
                            title="Reset semua filter aktif"
                        >
                            <i className="fas fa-undo-alt me-1"></i> Reset Filter
                        </button>
                    </div>
                </div>
            )}

            {/* 4. Content Area */}
            {isLoading ? (
                <div className="cm-loading-box py-5 text-center">
                    <div className="spinner-border text-teal spinner-border-sm me-2" role="status"></div>
                    <span className="text-muted small fw-semibold">Memuat data taksonomi materi...</span>
                </div>
            ) : activeTab === "categories" ? (
                /* CATEGORIES VIEW */
                filteredCategories.length === 0 ? (
                    <div className="cm-empty-box py-4 text-center">
                        <div className="cm-empty-icon mb-2">
                            <i className="fas fa-folder-open"></i>
                        </div>
                        <h5 className="cm-empty-title mb-1">Tidak Ada Kategori</h5>
                        <p className="cm-empty-text text-muted small mb-0">
                            {categorySearch
                                ? "Tidak ada kategori yang cocok dengan pencarian."
                                : "Belum ada kategori yang dibuat."}
                        </p>
                    </div>
                ) : viewMode === "grid" ? (
                    /* Categories Grid View */
                    <div className="cm-materials-grid">
                        {filteredCategories.map((cat) => {
                            const isSelected = selectedIds.includes(cat.id);
                            return (
                                <div
                                    key={cat.id}
                                    className={`cm-mat-card ${isSelected ? "is-selected" : ""}`}
                                >
                                    <div className="cm-mat-card-header">
                                        <div
                                            className="d-flex align-items-center me-1"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="checkbox"
                                                className="form-check-input m-0 cursor-pointer"
                                                checked={isSelected}
                                                onChange={() => handleToggleSelectOne(cat.id)}
                                                style={{ width: "17px", height: "17px" }}
                                                title="Pilih kategori ini"
                                            />
                                        </div>

                                        <div className="cm-cat-icon-avatar">
                                            {cat.image ? (
                                                <img
                                                    src={cat.image}
                                                    alt={cat.title}
                                                    className="cm-cat-thumb"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.style.display = "none";
                                                        if (e.target.nextSibling)
                                                            e.target.nextSibling.style.display = "flex";
                                                    }}
                                                />
                                            ) : null}
                                            <div
                                                className="cm-cat-fallback"
                                                style={{ display: cat.image ? "none" : "flex" }}
                                            >
                                                <i className="fas fa-folder"></i>
                                            </div>
                                        </div>

                                        <div className="flex-grow-1 min-w-0">
                                            <h4
                                                className="cm-req-name text-truncate mb-0 cursor-pointer"
                                                title={cat.title}
                                                onClick={() => {
                                                    setPreviewItem(cat);
                                                    setPreviewType("category");
                                                }}
                                            >
                                                {cat.title}
                                            </h4>
                                            <span className="cm-slug-badge font-monospace tiny d-inline-block text-truncate" style={{ maxWidth: "160px" }}>
                                                /{cat.slug || cat.title.toLowerCase().replace(/\s+/g, "-")}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="cm-mat-card-body d-flex align-items-center justify-content-between mt-1">
                                        <span className="cm-course-count-badge">
                                            <i className="fas fa-book-open me-1 text-teal"></i>
                                            <strong>{cat.course_count || 0}</strong> Kursus Terkait
                                        </span>
                                        <button
                                            type="button"
                                            className={`cm-toggle-badge ${cat.active ? "badge-active" : "badge-inactive"}`}
                                            onClick={() => handleToggleCategoryActive(cat)}
                                            title="Klik untuk beralih status aktif/nonaktif"
                                        >
                                            <i className={`fas fa-${cat.active ? "check" : "ban"} me-1`}></i>
                                            {cat.active ? "Aktif" : "Nonaktif"}
                                        </button>
                                    </div>

                                    <div className="cm-mat-card-footer">
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary btn-xs"
                                            onClick={() => {
                                                setPreviewItem(cat);
                                                setPreviewType("category");
                                            }}
                                            title="Pratinjau Kategori"
                                        >
                                            <i className="fas fa-eye me-1"></i> Detail
                                        </button>
                                        <div className="btn-group btn-group-sm">
                                            <button
                                                type="button"
                                                className="btn btn-outline-secondary btn-xs"
                                                onClick={() => handleOpenEditCategory(cat)}
                                                title="Ubah Kategori"
                                            >
                                                <i className="fas fa-pencil-alt"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-outline-danger btn-xs"
                                                onClick={() =>
                                                    setDeleteModal({
                                                        show: true,
                                                        type: "category",
                                                        item: cat,
                                                        isDeleting: false
                                                    })
                                                }
                                                title="Hapus Kategori"
                                            >
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Categories Table View */
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
                                    <th>Kategori & Slug</th>
                                    <th>Kursus Terkait</th>
                                    <th>Status Publik</th>
                                    <th style={{ width: "140px" }} className="text-end">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCategories.map((cat, idx) => {
                                    const isSelected = selectedIds.includes(cat.id);
                                    return (
                                        <tr key={cat.id} className={isSelected ? "cm-row-selected" : ""}>
                                            <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input m-0 cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelectOne(cat.id)}
                                                    title="Pilih baris ini"
                                                />
                                            </td>
                                            <td className="text-muted small">{idx + 1}</td>
                                            <td>
                                                <div
                                                    className="d-flex align-items-center gap-2 cursor-pointer"
                                                    onClick={() => {
                                                        setPreviewItem(cat);
                                                        setPreviewType("category");
                                                    }}
                                                    title="Klik untuk melihat detail kategori"
                                                >
                                                    <div className="cm-cat-icon-avatar">
                                                        {cat.image ? (
                                                            <img
                                                                src={cat.image}
                                                                alt={cat.title}
                                                                className="cm-cat-thumb"
                                                                onError={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.style.display = "none";
                                                                    if (e.target.nextSibling)
                                                                        e.target.nextSibling.style.display = "flex";
                                                                }}
                                                            />
                                                        ) : null}
                                                        <div
                                                            className="cm-cat-fallback"
                                                            style={{ display: cat.image ? "none" : "flex" }}
                                                        >
                                                            <i className="fas fa-folder"></i>
                                                        </div>
                                                    </div>
                                                    <div className="cm-cat-text">
                                                        <strong className="text-dark d-block small mb-0">
                                                            {cat.title}
                                                        </strong>
                                                        <span className="cm-slug-badge font-monospace tiny">
                                                            /{cat.slug || cat.title.toLowerCase().replace(/\s+/g, "-")}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="cm-course-count-badge">
                                                    <i className="fas fa-book-open me-1 text-teal"></i>
                                                    <strong>{cat.course_count || 0}</strong> Kursus
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className={`cm-toggle-badge ${cat.active ? "badge-active" : "badge-inactive"}`}
                                                    onClick={() => handleToggleCategoryActive(cat)}
                                                    title="Klik untuk beralih status aktif/nonaktif"
                                                >
                                                    <i className={`fas fa-${cat.active ? "check" : "ban"} me-1`}></i>
                                                    {cat.active ? "Aktif" : "Nonaktif"}
                                                </button>
                                            </td>
                                            <td className="text-end">
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary btn-xs"
                                                        onClick={() => {
                                                            setPreviewItem(cat);
                                                            setPreviewType("category");
                                                        }}
                                                        title="Pratinjau Kategori"
                                                    >
                                                        <i className="fas fa-eye"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary btn-xs"
                                                        onClick={() => handleOpenEditCategory(cat)}
                                                        title="Ubah Kategori"
                                                    >
                                                        <i className="fas fa-pencil-alt"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger btn-xs"
                                                        onClick={() =>
                                                            setDeleteModal({
                                                                show: true,
                                                                type: "category",
                                                                item: cat,
                                                                isDeleting: false
                                                            })
                                                        }
                                                        title="Hapus Kategori"
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
                    </div>
                )
            ) : (
                /* TAGS VIEW */
                filteredTags.length === 0 ? (
                    <div className="cm-empty-box py-4 text-center">
                        <div className="cm-empty-icon mb-2">
                            <i className="fas fa-tags"></i>
                        </div>
                        <h5 className="cm-empty-title mb-1">Tidak Ada Tag</h5>
                        <p className="cm-empty-text text-muted small mb-0">
                            {tagSearch
                                ? "Tidak ada tag yang cocok dengan pencarian."
                                : "Belum ada tag yang dibuat."}
                        </p>
                    </div>
                ) : viewMode === "grid" ? (
                    /* Tags Grid View */
                    <div className="cm-materials-grid">
                        {filteredTags.map((tag) => {
                            const isSelected = selectedIds.includes(tag.id);
                            const isActive = tag.active !== undefined ? tag.active : true;
                            return (
                                <div
                                    key={tag.id}
                                    className={`cm-mat-card ${isSelected ? "is-selected" : ""}`}
                                >
                                    <div className="cm-mat-card-header">
                                        <div
                                            className="d-flex align-items-center me-1"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="checkbox"
                                                className="form-check-input m-0 cursor-pointer"
                                                checked={isSelected}
                                                onChange={() => handleToggleSelectOne(tag.id)}
                                                style={{ width: "17px", height: "17px" }}
                                                title="Pilih tag ini"
                                            />
                                        </div>

                                        <span className="cm-tag-icon-circle">
                                            <i className="fas fa-tag"></i>
                                        </span>

                                        <div className="flex-grow-1 min-w-0">
                                            <h4
                                                className="cm-req-name text-truncate mb-0 cursor-pointer"
                                                title={tag.title}
                                                onClick={() => {
                                                    setPreviewItem(tag);
                                                    setPreviewType("tag");
                                                }}
                                            >
                                                {tag.title}
                                            </h4>
                                            <span className="cm-slug-badge font-monospace tiny d-inline-block text-truncate" style={{ maxWidth: "160px" }}>
                                                #{tag.slug || tag.title.toLowerCase()}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="cm-mat-card-body d-flex align-items-center justify-content-between mt-1">
                                        <span className="cm-course-count-badge">
                                            <i className="fas fa-book-open me-1 text-teal"></i>
                                            <strong>{tag.course_count || 0}</strong> Kursus Terkait
                                        </span>
                                        <button
                                            type="button"
                                            className={`cm-toggle-badge ${isActive ? "badge-active" : "badge-inactive"}`}
                                            onClick={() => handleToggleTagActive(tag)}
                                            title="Klik untuk beralih status"
                                        >
                                            <i className={`fas fa-${isActive ? "check" : "ban"} me-1`}></i>
                                            {isActive ? "Aktif" : "Nonaktif"}
                                        </button>
                                    </div>

                                    <div className="cm-mat-card-footer">
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary btn-xs"
                                            onClick={() => {
                                                setPreviewItem(tag);
                                                setPreviewType("tag");
                                            }}
                                            title="Pratinjau Tag"
                                        >
                                            <i className="fas fa-eye me-1"></i> Detail
                                        </button>
                                        <div className="btn-group btn-group-sm">
                                            <button
                                                type="button"
                                                className="btn btn-outline-secondary btn-xs"
                                                onClick={() => handleOpenEditTag(tag)}
                                                title="Ubah Tag"
                                            >
                                                <i className="fas fa-pencil-alt"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-outline-danger btn-xs"
                                                onClick={() =>
                                                    setDeleteModal({
                                                        show: true,
                                                        type: "tag",
                                                        item: tag,
                                                        isDeleting: false
                                                    })
                                                }
                                                title="Hapus Tag"
                                            >
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Tags Table View */
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
                                    <th>Tag & Slug</th>
                                    <th>Kursus Terkait</th>
                                    <th>Status</th>
                                    <th style={{ width: "140px" }} className="text-end">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTags.map((tag, idx) => {
                                    const isSelected = selectedIds.includes(tag.id);
                                    const isActive = tag.active !== undefined ? tag.active : true;
                                    return (
                                        <tr key={tag.id} className={isSelected ? "cm-row-selected" : ""}>
                                            <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="form-check-input m-0 cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelectOne(tag.id)}
                                                    title="Pilih baris ini"
                                                />
                                            </td>
                                            <td className="text-muted small">{idx + 1}</td>
                                            <td>
                                                <div
                                                    className="d-flex align-items-center gap-2 cursor-pointer"
                                                    onClick={() => {
                                                        setPreviewItem(tag);
                                                        setPreviewType("tag");
                                                    }}
                                                    title="Klik untuk melihat detail tag"
                                                >
                                                    <span className="cm-tag-icon-circle">
                                                        <i className="fas fa-tag"></i>
                                                    </span>
                                                    <div>
                                                        <strong className="text-dark d-block small mb-0">
                                                            {tag.title}
                                                        </strong>
                                                        <span className="cm-slug-badge font-monospace tiny">
                                                            #{tag.slug || tag.title.toLowerCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="cm-course-count-badge">
                                                    <i className="fas fa-book-open me-1 text-teal"></i>
                                                    <strong>{tag.course_count || 0}</strong> Kursus
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className={`cm-toggle-badge ${isActive ? "badge-active" : "badge-inactive"}`}
                                                    onClick={() => handleToggleTagActive(tag)}
                                                    title="Klik untuk beralih status"
                                                >
                                                    <i className={`fas fa-${isActive ? "check" : "ban"} me-1`}></i>
                                                    {isActive ? "Aktif" : "Nonaktif"}
                                                </button>
                                            </td>
                                            <td className="text-end">
                                                <div className="btn-group btn-group-sm">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary btn-xs"
                                                        onClick={() => {
                                                            setPreviewItem(tag);
                                                            setPreviewType("tag");
                                                        }}
                                                        title="Pratinjau Tag"
                                                    >
                                                        <i className="fas fa-eye"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary btn-xs"
                                                        onClick={() => handleOpenEditTag(tag)}
                                                        title="Ubah Tag"
                                                    >
                                                        <i className="fas fa-pencil-alt"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger btn-xs"
                                                        onClick={() =>
                                                            setDeleteModal({
                                                                show: true,
                                                                type: "tag",
                                                                item: tag,
                                                                isDeleting: false
                                                            })
                                                        }
                                                        title="Hapus Tag"
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
                    </div>
                )
            )}

            {/* 5. Floating Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div className="cm-floating-bulk-bar">
                    <div className="cm-bulk-bar-inner">
                        <div className="cm-bulk-count-box">
                            <span className="cm-bulk-count-badge">{selectedIds.length}</span>
                            <span className="cm-bulk-count-text">
                                {activeTab === "categories" ? "Kategori" : "Tag"} Terpilih
                            </span>
                        </div>

                        <div className="cm-bulk-divider"></div>

                        <div className="cm-bulk-actions-group">
                            {inactiveInSelected.length > 0 && (
                                <button
                                    type="button"
                                    className="cm-bulk-btn cm-bulk-approve"
                                    onClick={handleBulkActivate}
                                    disabled={bulkProcessing}
                                    title={`Aktifkan seluruh ${activeTab === "categories" ? "kategori" : "tag"} yang dipilih`}
                                >
                                    {bulkProcessing ? (
                                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                    ) : (
                                        <i className="fas fa-check-circle me-1"></i>
                                    )}
                                    Aktifkan ({inactiveInSelected.length})
                                </button>
                            )}

                            {activeInSelected.length > 0 && (
                                <button
                                    type="button"
                                    className="cm-bulk-btn cm-bulk-archive"
                                    onClick={handleBulkDeactivate}
                                    disabled={bulkProcessing}
                                    title={`Nonaktifkan seluruh ${activeTab === "categories" ? "kategori" : "tag"} yang dipilih`}
                                >
                                    {bulkProcessing ? (
                                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                    ) : (
                                        <i className="fas fa-ban me-1"></i>
                                    )}
                                    Nonaktifkan ({activeInSelected.length})
                                </button>
                            )}

                            <button
                                type="button"
                                className="cm-bulk-btn cm-bulk-export"
                                onClick={handleBulkExportSelectedCSV}
                                title="Ekspor data terpilih ke format CSV"
                            >
                                <i className="fas fa-file-export me-1"></i>
                                Ekspor CSV ({selectedIds.length})
                            </button>

                            <button
                                type="button"
                                className="cm-bulk-btn cm-bulk-reject"
                                onClick={handleBulkDelete}
                                disabled={bulkProcessing}
                                title={`Hapus seluruh ${activeTab === "categories" ? "kategori" : "tag"} yang dipilih`}
                            >
                                <i className="fas fa-trash-alt me-1"></i>
                                Hapus ({selectedIds.length})
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
            {previewItem && (
                <>
                    <div
                        className="cm-drawer-backdrop"
                        onClick={() => setPreviewItem(null)}
                    />
                    <div className="cm-preview-drawer">
                        {/* Drawer Header */}
                        <div className="cm-drawer-header">
                            <div className="cm-drawer-title-box">
                                <span className="cm-drawer-badge">
                                    <i
                                        className={`fas fa-${previewType === "category" ? "layer-group" : "tag"} me-1`}
                                    ></i>
                                    Detail {previewType === "category" ? "Kategori Kursus" : "Tag Kursus"}
                                </span>
                                <h4 className="cm-drawer-title text-truncate" title={previewItem.title}>
                                    {previewItem.title}
                                </h4>
                                <span className="cm-drawer-subtitle font-monospace">
                                    {previewType === "category" ? "/" : "#"}
                                    {previewItem.slug || previewItem.title.toLowerCase().replace(/\s+/g, "-")}
                                </span>
                            </div>
                            <button
                                type="button"
                                className="cm-drawer-close-btn"
                                onClick={() => setPreviewItem(null)}
                                title="Tutup (Esc)"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="cm-drawer-body">
                            {/* Visual Thumbnail Card */}
                            <div className="p-3 bg-light rounded border mb-3 text-center">
                                {previewType === "category" ? (
                                    previewItem.image ? (
                                        <img
                                            src={previewItem.image}
                                            alt={previewItem.title}
                                            className="rounded border shadow-xs"
                                            style={{
                                                maxHeight: "120px",
                                                maxWidth: "100%",
                                                objectFit: "cover"
                                            }}
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.style.display = "none";
                                                if (e.target.nextSibling)
                                                    e.target.nextSibling.style.display = "flex";
                                            }}
                                        />
                                    ) : null
                                ) : (
                                    <div
                                        className="rounded-circle mx-auto d-flex align-items-center justify-content-center text-teal"
                                        style={{
                                            width: "64px",
                                            height: "64px",
                                            background: "#f0fdfa",
                                            border: "2px solid #ccfbf1",
                                            fontSize: "1.8rem"
                                        }}
                                    >
                                        <i className="fas fa-tag"></i>
                                    </div>
                                )}
                                {previewType === "category" && (
                                    <div
                                        className="cm-cat-fallback mx-auto mt-1"
                                        style={{
                                            display: previewItem.image ? "none" : "flex",
                                            width: "60px",
                                            height: "60px",
                                            fontSize: "1.8rem"
                                        }}
                                    >
                                        <i className="fas fa-folder"></i>
                                    </div>
                                )}
                                <h5 className="mt-2 mb-1 text-dark fw-bold">{previewItem.title}</h5>
                                <span className="cm-slug-badge font-monospace tiny">
                                    {previewType === "category" ? "/" : "#"}
                                    {previewItem.slug || previewItem.title.toLowerCase().replace(/\s+/g, "-")}
                                </span>
                            </div>

                            {/* Metrics & Status */}
                            <div className="row g-2 mb-3">
                                <div className="col-6">
                                    <div className="p-2 rounded border bg-white h-100">
                                        <span className="tiny text-muted d-block mb-1 fw-semibold">
                                            <i className="fas fa-book-open text-teal me-1"></i> Kursus Terkait
                                        </span>
                                        <span className="fs-5 fw-bold text-dark">
                                            {previewItem.course_count || 0}
                                        </span>
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="p-2 rounded border bg-white h-100">
                                        <span className="tiny text-muted d-block mb-1 fw-semibold">
                                            <i className="fas fa-toggle-on text-primary me-1"></i> Status Publik
                                        </span>
                                        <span
                                            className={`cm-badge-status ${previewItem.active ? "badge-emerald" : "badge-rose"}`}
                                        >
                                            {previewItem.active ? "Aktif" : "Nonaktif"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Usage Guideline Box */}
                            <div className="mb-3">
                                <h6 className="fw-bold text-dark mb-1" style={{ fontSize: "0.84rem" }}>
                                    <i className="fas fa-info-circle text-teal me-1"></i> Peran dalam Kurikulum:
                                </h6>
                                <p className="small text-muted p-2 rounded bg-light border mb-0" style={{ lineHeight: 1 }}>
                                    {previewType === "category"
                                        ? "Kategori ini bertindak sebagai kelompok rumpun ilmu utama dalam katalog pembelajaran. Peserta dapat memfilter kursus berdasarkan kategori ini pada halaman jelajah publik."
                                        : "Tag ini digunakan sebagai kata kunci pencarian sekunder untuk memudahkan aparatur menemukan kursus dengan topik spesifik yang relevan."}
                                </p>
                            </div>

                            {(previewItem.course_count || 0) > 0 && (
                                <div className="alert alert-info py-2 px-2 small mb-0">
                                    <i className="fas fa-check-circle me-1"></i>
                                    Terhubung dengan <strong>{previewItem.course_count} kursus aktif</strong> pada platform LMS Setjen DPD RI.
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div className="cm-drawer-footer d-flex align-items-center justify-content-between">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setPreviewItem(null)}
                            >
                                Tutup
                            </button>

                            <div className="d-flex align-items-center gap-1">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => {
                                        const item = previewItem;
                                        setPreviewItem(null);
                                        if (previewType === "category") handleOpenEditCategory(item);
                                        else handleOpenEditTag(item);
                                    }}
                                >
                                    <i className="fas fa-pencil-alt me-1"></i> Ubah
                                </button>

                                <button
                                    type="button"
                                    className={`btn btn-sm ${previewItem.active ? "btn-outline-danger" : "btn-teal text-white"}`}
                                    style={!previewItem.active ? { backgroundColor: "#0d9488", borderColor: "#0d9488" } : {}}
                                    onClick={() => {
                                        if (previewType === "category") handleToggleCategoryActive(previewItem);
                                        else handleToggleTagActive(previewItem);
                                    }}
                                >
                                    <i className={`fas fa-${previewItem.active ? "ban" : "check"} me-1`}></i>
                                    {previewItem.active ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* 7. Sleek Category Add/Edit Modal */}
            {showCategoryModal && (
                <div className="cm-modal-backdrop" onClick={() => setShowCategoryModal(false)}>
                    <div className="cm-modal-dialog-compact" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-header-compact">
                            <div className="d-flex align-items-center gap-2">
                                <i
                                    className={`fas fa-${categoryModalMode === "add" ? "folder-plus" : "edit"} text-teal`}
                                ></i>
                                <h5 className="mb-0 fw-bold">
                                    {categoryModalMode === "add" ? "Tambah Kategori Kursus" : "Ubah Kategori Kursus"}
                                </h5>
                            </div>
                            <button
                                type="button"
                                className="cm-modal-close-btn"
                                onClick={() => setShowCategoryModal(false)}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="cm-modal-body-compact">
                            {categoryFormErrors.submit && (
                                <div className="alert alert-danger py-1 px-2 small mb-2">
                                    <i className="fas fa-exclamation-circle me-1"></i>
                                    {categoryFormErrors.submit}
                                </div>
                            )}

                            <div className="mb-2">
                                <label className="form-label small fw-semibold text-dark mb-1">
                                    Nama Kategori <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    className={`form-control cm-input-compact ${categoryFormErrors.title ? "is-invalid" : ""}`}
                                    placeholder="Contoh: Hukum & Regulasi Parlemen"
                                    value={categoryForm.title}
                                    onChange={(e) => {
                                        setCategoryForm((prev) => ({ ...prev, title: e.target.value }));
                                        if (categoryFormErrors.title) setCategoryFormErrors({});
                                    }}
                                />
                                {categoryFormErrors.title && (
                                    <div className="invalid-feedback small">{categoryFormErrors.title}</div>
                                )}
                            </div>

                            <div className="mb-2">
                                <label className="form-label small fw-semibold text-dark mb-1">
                                    URL Ikon / Gambar Thumbnail
                                </label>
                                <input
                                    type="text"
                                    className="form-control cm-input-compact"
                                    placeholder="https://... atau /media/..."
                                    value={categoryForm.image}
                                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, image: e.target.value }))}
                                />
                                <span className="tiny text-muted d-block mt-0">
                                    Opsional: Gambar preview kategori untuk katalog pembelajaran
                                </span>
                            </div>

                            <div className="form-check form-switch mt-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="catActiveSwitch"
                                    checked={categoryForm.active}
                                    onChange={(e) => setCategoryForm((prev) => ({ ...prev, active: e.target.checked }))}
                                />
                                <label className="form-check-label small fw-semibold text-dark" htmlFor="catActiveSwitch">
                                    Kategori Aktif & Ditampilkan di Katalog
                                </label>
                            </div>
                        </div>
                        <div className="cm-modal-footer-compact">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setShowCategoryModal(false)}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-teal"
                                onClick={handleSaveCategory}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-1"></span>
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-save me-1"></i>
                                        {categoryModalMode === "add" ? "Buat Kategori" : "Simpan Perubahan"}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 8. Sleek Tag Add/Edit Modal */}
            {showTagModal && (
                <div className="cm-modal-backdrop" onClick={() => setShowTagModal(false)}>
                    <div className="cm-modal-dialog-compact" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-header-compact">
                            <div className="d-flex align-items-center gap-2">
                                <i className={`fas fa-${tagModalMode === "add" ? "tag" : "edit"} text-teal`}></i>
                                <h5 className="mb-0 fw-bold">
                                    {tagModalMode === "add" ? "Tambah Tag Kursus" : "Ubah Tag Kursus"}
                                </h5>
                            </div>
                            <button
                                type="button"
                                className="cm-modal-close-btn"
                                onClick={() => setShowTagModal(false)}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="cm-modal-body-compact">
                            {tagFormErrors.submit && (
                                <div className="alert alert-danger py-1 px-2 small mb-2">
                                    <i className="fas fa-exclamation-circle me-1"></i>
                                    {tagFormErrors.submit}
                                </div>
                            )}

                            <div className="mb-2">
                                <label className="form-label small fw-semibold text-dark mb-1">
                                    Nama Tag <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    className={`form-control cm-input-compact ${tagFormErrors.title ? "is-invalid" : ""}`}
                                    placeholder="Contoh: Kesekretariatan"
                                    value={tagForm.title}
                                    onChange={(e) => {
                                        setTagForm((prev) => ({ ...prev, title: e.target.value }));
                                        if (tagFormErrors.title) setTagFormErrors({});
                                    }}
                                />
                                {tagFormErrors.title && (
                                    <div className="invalid-feedback small">{tagFormErrors.title}</div>
                                )}
                            </div>

                            <div className="form-check form-switch mt-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="tagActiveSwitch"
                                    checked={tagForm.active}
                                    onChange={(e) => setTagForm((prev) => ({ ...prev, active: e.target.checked }))}
                                />
                                <label className="form-check-label small fw-semibold text-dark" htmlFor="tagActiveSwitch">
                                    Tag Aktif
                                </label>
                            </div>
                        </div>
                        <div className="cm-modal-footer-compact">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setShowTagModal(false)}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-teal"
                                onClick={handleSaveTag}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-1"></span>
                                        Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-save me-1"></i>
                                        {tagModalMode === "add" ? "Buat Tag" : "Simpan Perubahan"}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 9. Sleek Delete Confirmation Modal */}
            {deleteModal.show && deleteModal.item && (
                <div
                    className="cm-modal-backdrop"
                    onClick={() => setDeleteModal((prev) => ({ ...prev, show: false }))}
                >
                    <div className="cm-modal-dialog-compact" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-header-compact">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fas fa-exclamation-triangle text-danger"></i>
                                <h5 className="mb-0 fw-bold">
                                    Konfirmasi Hapus {deleteModal.type === "category" ? "Kategori" : "Tag"}
                                </h5>
                            </div>
                            <button
                                type="button"
                                className="cm-modal-close-btn"
                                onClick={() => setDeleteModal((prev) => ({ ...prev, show: false }))}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="cm-modal-body-compact">
                            <p className="small text-dark mb-2">
                                Apakah Anda yakin ingin menghapus{" "}
                                {deleteModal.type === "category" ? "kategori" : "tag"}{" "}
                                <strong>"{deleteModal.item.title}"</strong>?
                            </p>
                            {(deleteModal.item.course_count || 0) > 0 && (
                                <div className="alert alert-warning py-2 px-2 small mb-0">
                                    <i className="fas fa-exclamation-triangle me-1"></i>
                                    Perhatian: Ada <strong>{deleteModal.item.course_count} kursus</strong> yang terkait dengan{" "}
                                    {deleteModal.type === "category" ? "kategori" : "tag"} ini.
                                </div>
                            )}
                        </div>
                        <div className="cm-modal-footer-compact">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setDeleteModal((prev) => ({ ...prev, show: false }))}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={handleConfirmDelete}
                                disabled={deleteModal.isDeleting}
                            >
                                {deleteModal.isDeleting ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-1"></span>
                                        Menghapus...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-trash-alt me-1"></i>
                                        Ya, Hapus
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default React.memo(MaterialsTab);
