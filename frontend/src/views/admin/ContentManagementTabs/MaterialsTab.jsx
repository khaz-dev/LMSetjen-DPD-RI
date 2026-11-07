import React, { useState, useEffect, useMemo, useCallback } from "react";
import apiInstance from "../../../utils/axios";
import Toast from "../../plugin/Toast";

/**
 * Redesigned Compact & Live Materials Management Tab (Categories & Tags)
 * Setjen DPD RI Learning Platform
 */
function MaterialsTab({ onCountsUpdated }) {
    // Active Subtab: 'categories' | 'tags'
    const [activeTab, setActiveTab] = useState("categories");

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

    // Delete Modal State
    const [deleteModal, setDeleteModal] = useState({
        show: false,
        type: 'category', // 'category' | 'tag'
        item: null,
        isDeleting: false
    });

    // Submitting state
    const [submitting, setSubmitting] = useState(false);

    // ============= FETCH DATA =============
    const fetchCategories = useCallback(async () => {
        try {
            setLoadingCategories(true);
            const res = await apiInstance.get("admin/category/");
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
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
            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
            setTags(data);
        } catch (error) {
            console.error("Error fetching tags:", error);
            // Fallback to public tag endpoint if admin 404s
            try {
                const resPublic = await apiInstance.get("course/tag/");
                const dataPublic = Array.isArray(resPublic.data) ? resPublic.data : (resPublic.data?.results || []);
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
        const active = categories.filter(c => c.active).length;
        const withCourses = categories.filter(c => (c.course_count || 0) > 0).length;
        const totalCourses = categories.reduce((sum, c) => sum + (c.course_count || 0), 0);
        return { total, active, withCourses, totalCourses };
    }, [categories]);

    const tagStats = useMemo(() => {
        const total = tags.length;
        const active = tags.filter(t => t.active).length;
        const withCourses = tags.filter(t => (t.course_count || 0) > 0).length;
        const totalCourses = tags.reduce((sum, t) => sum + (t.course_count || 0), 0);
        return { total, active, withCourses, totalCourses };
    }, [tags]);

    // Filtered Categories
    const filteredCategories = useMemo(() => {
        return categories.filter(cat => {
            if (categorySearch.trim()) {
                const q = categorySearch.toLowerCase();
                const title = (cat.title || '').toLowerCase();
                const slug = (cat.slug || '').toLowerCase();
                if (!title.includes(q) && !slug.includes(q)) return false;
            }
            if (categoryStatusFilter !== 'all') {
                const isActive = categoryStatusFilter === 'active';
                if (Boolean(cat.active) !== isActive) return false;
            }
            return true;
        });
    }, [categories, categorySearch, categoryStatusFilter]);

    // Filtered Tags
    const filteredTags = useMemo(() => {
        return tags.filter(tag => {
            if (tagSearch.trim()) {
                const q = tagSearch.toLowerCase();
                const title = (tag.title || '').toLowerCase();
                const slug = (tag.slug || '').toLowerCase();
                if (!title.includes(q) && !slug.includes(q)) return false;
            }
            if (tagStatusFilter !== 'all') {
                const isActive = tagStatusFilter === 'active';
                if (Boolean(tag.active) !== isActive) return false;
            }
            return true;
        });
    }, [tags, tagSearch, tagStatusFilter]);

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
            if (typeof onCountsUpdated === 'function') onCountsUpdated();
        } catch (error) {
            console.error("Error saving category:", error);
            const msg = error.response?.data?.title?.[0] || error.response?.data?.error || "Gagal menyimpan kategori";
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
                title: `Kategori ${!cat.active ? 'diaktifkan' : 'dinonaktifkan'}`
            });
            fetchCategories();
            if (typeof onCountsUpdated === 'function') onCountsUpdated();
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
            if (typeof onCountsUpdated === 'function') onCountsUpdated();
        } catch (error) {
            console.error("Error saving tag:", error);
            const msg = error.response?.data?.title?.[0] || error.response?.data?.error || "Gagal menyimpan tag";
            setTagFormErrors({ submit: msg });
            Toast().fire({ icon: "error", title: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleTagActive = async (tag) => {
        try {
            await apiInstance.put(`admin/tag/${tag.id}/`, {
                title: tag.title,
                active: !(tag.active !== undefined ? tag.active : true)
            });
            Toast().fire({
                icon: "success",
                title: `Tag ${!tag.active ? 'diaktifkan' : 'dinonaktifkan'}`
            });
            fetchTags();
            if (typeof onCountsUpdated === 'function') onCountsUpdated();
        } catch (error) {
            Toast().fire({ icon: "error", title: "Gagal memperbarui status tag" });
        }
    };

    // ============= DELETE HANDLERS =============
    const handleConfirmDelete = async () => {
        const { type, item } = deleteModal;
        if (!item) return;

        setDeleteModal(prev => ({ ...prev, isDeleting: true }));
        try {
            if (type === 'category') {
                await apiInstance.delete(`admin/category/${item.id}/`);
                Toast().fire({ icon: "success", title: "Kategori berhasil dihapus" });
                fetchCategories();
            } else {
                await apiInstance.delete(`admin/tag/${item.id}/`);
                Toast().fire({ icon: "success", title: "Tag berhasil dihapus" });
                fetchTags();
            }
            setDeleteModal({ show: false, type: 'category', item: null, isDeleting: false });
            if (typeof onCountsUpdated === 'function') onCountsUpdated();
        } catch (error) {
            console.error("Error deleting:", error);
            const msg = error.response?.data?.error || error.response?.data?.detail || "Gagal menghapus data";
            Toast().fire({ icon: "warning", title: msg });
            setDeleteModal(prev => ({ ...prev, isDeleting: false }));
        }
    };

    const isLoading = activeTab === 'categories' ? loadingCategories : loadingTags;

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
                            <p className="cm-module-desc mb-0">Atur pengelompokan kurikulum, kategori rumpun ilmu, dan label tag kursus Setjen DPD RI</p>
                        </div>
                    </div>

                    {/* Compact Live KPI Chips */}
                    <div className="cm-kpi-chips-row">
                        {activeTab === 'categories' ? (
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
                            <i className={`fas fa-sync-alt ${isLoading ? 'fa-spin' : ''}`}></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Compact Control Toolbar: Subtabs + Search + Filter + Add Button */}
            <div className="cm-toolbar-card mb-3">
                <div className="row g-2 align-items-center">
                    {/* Subtab Segmented Switcher */}
                    <div className="col-12 col-md-auto">
                        <div className="cm-segmented-pills">
                            <button
                                type="button"
                                className={`cm-seg-btn ${activeTab === 'categories' ? 'active' : ''}`}
                                onClick={() => setActiveTab('categories')}
                            >
                                <i className="fas fa-layer-group me-1"></i>
                                Kategori
                                <span className="cm-pill-count">{categoryStats.total}</span>
                            </button>
                            <button
                                type="button"
                                className={`cm-seg-btn ${activeTab === 'tags' ? 'active' : ''}`}
                                onClick={() => setActiveTab('tags')}
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
                                placeholder={activeTab === 'categories' ? "Cari nama kategori atau slug..." : "Cari tag kursus..."}
                                value={activeTab === 'categories' ? categorySearch : tagSearch}
                                onChange={(e) => activeTab === 'categories' ? setCategorySearch(e.target.value) : setTagSearch(e.target.value)}
                            />
                            {(activeTab === 'categories' ? categorySearch : tagSearch) && (
                                <button
                                    type="button"
                                    className="cm-search-clear"
                                    onClick={() => activeTab === 'categories' ? setCategorySearch('') : setTagSearch('')}
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
                            value={activeTab === 'categories' ? categoryStatusFilter : tagStatusFilter}
                            onChange={(e) => activeTab === 'categories' ? setCategoryStatusFilter(e.target.value) : setTagStatusFilter(e.target.value)}
                        >
                            <option value="all">Semua Status</option>
                            <option value="active">Aktif</option>
                            <option value="inactive">Nonaktif</option>
                        </select>
                    </div>

                    {/* Primary Action Button */}
                    <div className="col-6 col-sm-3 col-md-auto ms-auto text-end">
                        <button
                            type="button"
                            className="btn btn-sm btn-teal cm-btn-action-primary w-100"
                            onClick={activeTab === 'categories' ? handleOpenAddCategory : handleOpenAddTag}
                        >
                            <i className="fas fa-plus me-1"></i>
                            {activeTab === 'categories' ? 'Tambah Kategori' : 'Tambah Tag'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. High-Density Table Area */}
            {isLoading ? (
                <div className="cm-loading-box py-5 text-center">
                    <div className="spinner-border text-teal spinner-border-sm me-2" role="status"></div>
                    <span className="text-muted small fw-semibold">Memuat data taksonomi materi...</span>
                </div>
            ) : activeTab === 'categories' ? (
                /* Categories Table */
                filteredCategories.length === 0 ? (
                    <div className="cm-empty-box py-4 text-center">
                        <div className="cm-empty-icon mb-2">
                            <i className="fas fa-folder-open"></i>
                        </div>
                        <h5 className="cm-empty-title mb-1">Tidak Ada Kategori</h5>
                        <p className="cm-empty-text text-muted small mb-0">
                            {categorySearch ? 'Tidak ada kategori yang cocok dengan pencarian.' : 'Belum ada kategori yang dibuat.'}
                        </p>
                    </div>
                ) : (
                    <div className="cm-table-responsive">
                        <table className="table table-hover cm-dense-table mb-0">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>#</th>
                                    <th>Kategori & Slug</th>
                                    <th>Kursus Terkait</th>
                                    <th>Status Publik</th>
                                    <th style={{ width: '130px' }} className="text-end">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCategories.map((cat, idx) => (
                                    <tr key={cat.id}>
                                        <td className="text-muted small">{idx + 1}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2.5">
                                                <div className="cm-cat-icon-avatar">
                                                    {cat.image ? (
                                                        <img
                                                            src={cat.image}
                                                            alt={cat.title}
                                                            className="cm-cat-thumb"
                                                            onError={(e) => {
                                                                e.target.onerror = null;
                                                                e.target.style.display = 'none';
                                                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                                            }}
                                                        />
                                                    ) : null}
                                                    <div
                                                        className="cm-cat-fallback"
                                                        style={{ display: cat.image ? 'none' : 'flex' }}
                                                    >
                                                        <i className="fas fa-folder"></i>
                                                    </div>
                                                </div>
                                                <div className="cm-cat-text">
                                                    <strong className="text-dark d-block small mb-0.5">{cat.title}</strong>
                                                    <span className="cm-slug-badge font-monospace tiny">/{cat.slug || cat.title.toLowerCase().replace(/\s+/g, '-')}</span>
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
                                                className={`cm-toggle-badge ${cat.active ? 'badge-active' : 'badge-inactive'}`}
                                                onClick={() => handleToggleCategoryActive(cat)}
                                                title="Klik untuk beralih status aktif/nonaktif"
                                            >
                                                <i className={`fas fa-${cat.active ? 'check' : 'ban'} me-1`}></i>
                                                {cat.active ? 'Aktif' : 'Nonaktif'}
                                            </button>
                                        </td>
                                        <td className="text-end">
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
                                                    onClick={() => setDeleteModal({ show: true, type: 'category', item: cat, isDeleting: false })}
                                                    title="Hapus Kategori"
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
                )
            ) : (
                /* Tags Table */
                filteredTags.length === 0 ? (
                    <div className="cm-empty-box py-4 text-center">
                        <div className="cm-empty-icon mb-2">
                            <i className="fas fa-tags"></i>
                        </div>
                        <h5 className="cm-empty-title mb-1">Tidak Ada Tag</h5>
                        <p className="cm-empty-text text-muted small mb-0">
                            {tagSearch ? 'Tidak ada tag yang cocok dengan pencarian.' : 'Belum ada tag yang dibuat.'}
                        </p>
                    </div>
                ) : (
                    <div className="cm-table-responsive">
                        <table className="table table-hover cm-dense-table mb-0">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>#</th>
                                    <th>Tag & Slug</th>
                                    <th>Kursus Terkait</th>
                                    <th>Status</th>
                                    <th style={{ width: '130px' }} className="text-end">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTags.map((tag, idx) => {
                                    const isActive = tag.active !== undefined ? tag.active : true;
                                    return (
                                        <tr key={tag.id}>
                                            <td className="text-muted small">{idx + 1}</td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="cm-tag-icon-circle">
                                                        <i className="fas fa-tag"></i>
                                                    </span>
                                                    <div>
                                                        <strong className="text-dark d-block small mb-0.5">{tag.title}</strong>
                                                        <span className="cm-slug-badge font-monospace tiny">#{tag.slug || tag.title.toLowerCase()}</span>
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
                                                    className={`cm-toggle-badge ${isActive ? 'badge-active' : 'badge-inactive'}`}
                                                    onClick={() => handleToggleTagActive(tag)}
                                                    title="Klik untuk beralih status"
                                                >
                                                    <i className={`fas fa-${isActive ? 'check' : 'ban'} me-1`}></i>
                                                    {isActive ? 'Aktif' : 'Nonaktif'}
                                                </button>
                                            </td>
                                            <td className="text-end">
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
                                                        onClick={() => setDeleteModal({ show: true, type: 'tag', item: tag, isDeleting: false })}
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

            {/* 4. Sleek Category Add/Edit Modal */}
            {showCategoryModal && (
                <div className="cm-modal-backdrop" onClick={() => setShowCategoryModal(false)}>
                    <div className="cm-modal-dialog-compact" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-header-compact">
                            <div className="d-flex align-items-center gap-2">
                                <i className={`fas fa-${categoryModalMode === 'add' ? 'folder-plus' : 'edit'} text-teal`}></i>
                                <h5 className="mb-0 fw-bold">
                                    {categoryModalMode === 'add' ? 'Tambah Kategori Kursus' : 'Ubah Kategori Kursus'}
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
                                <div className="alert alert-danger py-1.5 px-2.5 small mb-2.5">
                                    <i className="fas fa-exclamation-circle me-1"></i>
                                    {categoryFormErrors.submit}
                                </div>
                            )}

                            <div className="mb-2.5">
                                <label className="form-label small fw-semibold text-dark mb-1">
                                    Nama Kategori <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    className={`form-control cm-input-compact ${categoryFormErrors.title ? 'is-invalid' : ''}`}
                                    placeholder="Contoh: Hukum & Regulasi Parlemen"
                                    value={categoryForm.title}
                                    onChange={(e) => {
                                        setCategoryForm(prev => ({ ...prev, title: e.target.value }));
                                        if (categoryFormErrors.title) setCategoryFormErrors({});
                                    }}
                                />
                                {categoryFormErrors.title && (
                                    <div className="invalid-feedback small">{categoryFormErrors.title}</div>
                                )}
                            </div>

                            <div className="mb-2.5">
                                <label className="form-label small fw-semibold text-dark mb-1">
                                    URL Ikon / Gambar Thumbnail
                                </label>
                                <input
                                    type="text"
                                    className="form-control cm-input-compact"
                                    placeholder="https://... atau /media/..."
                                    value={categoryForm.image}
                                    onChange={(e) => setCategoryForm(prev => ({ ...prev, image: e.target.value }))}
                                />
                                <span className="tiny text-muted d-block mt-0.5">Opsional: Gambar preview kategori untuk katalog pembelajaran</span>
                            </div>

                            <div className="form-check form-switch mt-2">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="catActiveSwitch"
                                    checked={categoryForm.active}
                                    onChange={(e) => setCategoryForm(prev => ({ ...prev, active: e.target.checked }))}
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
                                        {categoryModalMode === 'add' ? 'Buat Kategori' : 'Simpan Perubahan'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Sleek Tag Add/Edit Modal */}
            {showTagModal && (
                <div className="cm-modal-backdrop" onClick={() => setShowTagModal(false)}>
                    <div className="cm-modal-dialog-compact" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-header-compact">
                            <div className="d-flex align-items-center gap-2">
                                <i className={`fas fa-${tagModalMode === 'add' ? 'tag' : 'edit'} text-teal`}></i>
                                <h5 className="mb-0 fw-bold">
                                    {tagModalMode === 'add' ? 'Tambah Tag Kursus' : 'Ubah Tag Kursus'}
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
                                <div className="alert alert-danger py-1.5 px-2.5 small mb-2.5">
                                    <i className="fas fa-exclamation-circle me-1"></i>
                                    {tagFormErrors.submit}
                                </div>
                            )}

                            <div className="mb-2.5">
                                <label className="form-label small fw-semibold text-dark mb-1">
                                    Nama Tag <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    className={`form-control cm-input-compact ${tagFormErrors.title ? 'is-invalid' : ''}`}
                                    placeholder="Contoh: Kesekretariatan"
                                    value={tagForm.title}
                                    onChange={(e) => {
                                        setTagForm(prev => ({ ...prev, title: e.target.value }));
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
                                    onChange={(e) => setTagForm(prev => ({ ...prev, active: e.target.checked }))}
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
                                        {tagModalMode === 'add' ? 'Buat Tag' : 'Simpan Perubahan'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. Sleek Delete Confirmation Modal */}
            {deleteModal.show && deleteModal.item && (
                <div className="cm-modal-backdrop" onClick={() => setDeleteModal(prev => ({ ...prev, show: false }))}>
                    <div className="cm-modal-dialog-compact" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-header-compact">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fas fa-exclamation-triangle text-danger"></i>
                                <h5 className="mb-0 fw-bold">
                                    Konfirmasi Hapus {deleteModal.type === 'category' ? 'Kategori' : 'Tag'}
                                </h5>
                            </div>
                            <button
                                type="button"
                                className="cm-modal-close-btn"
                                onClick={() => setDeleteModal(prev => ({ ...prev, show: false }))}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="cm-modal-body-compact">
                            <p className="small text-dark mb-2">
                                Apakah Anda yakin ingin menghapus {deleteModal.type === 'category' ? 'kategori' : 'tag'} <strong>"{deleteModal.item.title}"</strong>?
                            </p>
                            {(deleteModal.item.course_count || 0) > 0 && (
                                <div className="alert alert-warning py-2 px-2.5 small mb-0">
                                    <i className="fas fa-exclamation-triangle me-1"></i>
                                    Perhatian: Ada <strong>{deleteModal.item.course_count} kursus</strong> yang terkait dengan {deleteModal.type === 'category' ? 'kategori' : 'tag'} ini.
                                </div>
                            )}
                        </div>
                        <div className="cm-modal-footer-compact">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setDeleteModal(prev => ({ ...prev, show: false }))}
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
